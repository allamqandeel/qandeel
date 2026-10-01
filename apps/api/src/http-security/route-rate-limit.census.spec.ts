import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { parseProxyConfiguration } from './client-address';
import { configureHttpSecurity } from './http-security';
import { RATE_LIMIT_POLICIES, type RateLimitClass } from './rate-limit.policy';
import { censusClassOf, ROUTE_RATE_LIMIT_CENSUS } from './route-rate-limit.census';

/**
 * PROD-SEC-01 (SEC-A) — the route census against the REAL application graph. Every controller reachable from
 * AppModule, every routed handler on it: each one is named by the census with a deliberate class, nothing stale is
 * named, and every route that carries no authentication guard is classified as health or pre-authentication.
 */

type Constructor = abstract new (...args: never[]) => unknown;

function controllersOf(root: unknown): Set<Constructor> {
  const found = new Set<Constructor>();
  const seen = new Set<unknown>();
  const walk = (entry: unknown): void => {
    if (entry === undefined || entry === null || seen.has(entry)) return;
    seen.add(entry);
    const module = typeof entry === 'object' && 'module' in (entry as object) ? (entry as { module: unknown }).module : entry;
    if (typeof module !== 'function') return;
    for (const controller of (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as Constructor[] | undefined) ?? []) found.add(controller);
    for (const imported of (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as unknown[] | undefined) ?? []) walk(imported);
    if (typeof entry === 'object') for (const imported of ((entry as { imports?: unknown[] }).imports ?? [])) walk(imported);
  };
  walk(root);
  return found;
}

function handlersOf(controller: Constructor): string[] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor' && typeof prototype[name] === 'function' && Reflect.getMetadata(METHOD_METADATA, prototype[name] as object) !== undefined,
  );
}

const isGuarded = (controller: Constructor, handler: string) =>
  ((Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[] | undefined)?.length ?? 0) > 0 ||
  ((Reflect.getMetadata(GUARDS_METADATA, (controller.prototype as Record<string, object>)[handler]) as unknown[] | undefined)?.length ?? 0) > 0;

describe('the route census covers the real application exactly', () => {
  const controllers = controllersOf(AppModule);

  it('finds the application controllers', () => {
    expect(controllers.size).toBe(ROUTE_RATE_LIMIT_CENSUS.size);
  });

  it('names every routed handler of every controller with a deliberate class', () => {
    const unclassified: string[] = [];
    for (const controller of controllers) {
      for (const handler of handlersOf(controller)) {
        if (censusClassOf(controller, handler) === 'UNCLASSIFIED') unclassified.push(`${controller.name}.${handler}`);
      }
    }
    expect(unclassified).toEqual([]);
  });

  it('names nothing that does not exist', () => {
    const stale: string[] = [];
    for (const [controller, routes] of ROUTE_RATE_LIMIT_CENSUS) {
      if (!controllers.has(controller)) stale.push(`${controller.name} (not in AppModule)`);
      const handlers = new Set(handlersOf(controller));
      for (const handler of Object.keys(routes)) if (!handlers.has(handler)) stale.push(`${controller.name}.${handler}`);
    }
    expect(stale).toEqual([]);
  });

  it('classifies every route without an authentication guard as health or pre-authentication, and nothing else that way', () => {
    const unauthenticatedClasses = new Set<RateLimitClass>(['HEALTH', 'PRE_AUTH_LOOKUP', 'PRE_AUTH_CREDENTIAL', 'PRE_AUTH_MAIL']);
    const mismatched: string[] = [];
    const unauthenticated: string[] = [];
    for (const controller of controllers) {
      for (const handler of handlersOf(controller)) {
        const routeClass = censusClassOf(controller, handler);
        const guarded = isGuarded(controller, handler);
        if (!guarded) unauthenticated.push(`${String(Reflect.getMetadata(PATH_METADATA, controller))}.${handler}`);
        if (guarded === unauthenticatedClasses.has(routeClass)) mismatched.push(`${controller.name}.${handler} (${routeClass}, guarded=${guarded})`);
      }
    }
    expect(mismatched).toEqual([]);
    // The pre-authentication surface, stated: health and the three Login ID routes plus availability.
    expect(unauthenticated.sort()).toEqual([
      'account.checkLoginIdAvailability', 'account.resendLoginIdVerification', 'account.signInWithLoginId', 'account.verifyLoginIdEmail',
      'health.getHealth', 'health.getLive', 'health.getReady',
    ]);
  });
});

/**
 * The REAL AppModule, booted the way the T-12 Phase M gate boots it (production code path, no Supabase or provider
 * configuration visible), with `main.ts`'s own HTTP boundary applied: the global guard and the header baseline are
 * wired in the real application, not only in a test module.
 */
describe('the real application carries the guard and the header baseline', () => {
  const WITHHELD = [
    'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'REDIS_URL', 'DATABASE_URL',
    'MODEL_PROVIDER', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY',
    'HYPOTHESIS_INTENT_EXTRACTION_PROVIDER', 'HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER',
  ];
  const saved = new Map<string, string | undefined>();
  let app: NestExpressApplication | undefined;
  let port = 0;

  const get = (path: string, method = 'GET') =>
    new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }>((resolve, reject) => {
      const outgoing = httpRequest({ host: '127.0.0.1', port, path, method, agent: false, headers: { 'Content-Type': 'application/json' } }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
      });
      outgoing.on('error', reject);
      outgoing.end(method === 'GET' ? undefined : '{}');
    });

  beforeAll(async () => {
    for (const name of [...WITHHELD, 'NODE_ENV']) saved.set(name, process.env[name]);
    for (const name of WITHHELD) delete process.env[name];
    process.env.NODE_ENV = 'production';
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, abortOnError: false });
    configureHttpSecurity(app, parseProxyConfiguration({ NODE_ENV: 'production', QANDEEL_API_PROXY_MODE: 'direct' }));
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }, 60_000);

  const baseline = (headers: Record<string, string | string[] | undefined>) => {
    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeDefined();
    expect(headers['access-control-allow-origin']).toBeUndefined();
  };

  it('2xx, 404 and the authentication refusal all carry the baseline', async () => {
    const health = await get('/health');
    expect(health.status).toBe(200);
    expect(JSON.parse(health.text)).toEqual({ status: 'ok', service: 'qandeel-api' });
    baseline(health.headers);
    const missing = await get('/nothing-here');
    expect(missing.status).toBe(404);
    baseline(missing.headers);
    const refused = await get('/conversation/sessions', 'POST');
    expect(refused.status).toBe(401);
    baseline(refused.headers);
  });

  it('the global guard bounds a real route of the real application', async () => {
    // One request above has already been spent on /health.
    for (let index = 1; index < RATE_LIMIT_POLICIES.HEALTH.perMinute; index += 1) expect((await get('/health')).status).toBe(200);
    const limited = await get('/health');
    expect(limited.status).toBe(429);
    expect(JSON.parse(limited.text)).toEqual({ outcome: 'RATE_LIMITED' });
    baseline(limited.headers);
    // Other routes keep their own window.
    expect((await get('/health/live')).status).toBe(200);
  }, 60_000);
});
