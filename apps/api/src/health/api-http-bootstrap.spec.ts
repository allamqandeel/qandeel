/**
 * T-12 Phase M — the API HTTP bootstrap regression gate.
 *
 * ## The defect this exists to prevent recurring
 *
 * `main.ts` calls `NestFactory.create(AppModule)` and then `app.listen(port)`. That requires a Nest
 * HTTP platform adapter, and `apps/api/package.json` declared none: `@nestjs/platform-express`
 * appeared in the lockfile only as an OPTIONAL peer of `@nestjs/core` and was installed nowhere. The
 * process therefore could not start at all —
 *
 *   ERROR [PackageLoader] No driver (HTTP) has been selected.
 *
 * — which means the QANDEEL API had never been served over HTTP by this repository. Nothing caught
 * it, and the reason is worth writing down: every existing test either constructs services directly
 * or uses `@nestjs/testing`, and the two "end-to-end runtime smoke" verifiers are `ts-node` scripts.
 * Not one of them creates an HTTP application. A defect that lives exactly in the gap between "the
 * modules resolve" and "the process serves" is invisible to all of them.
 *
 * So this gate does the one thing none of them do: it boots the REAL `AppModule` through the REAL
 * production adapter, binds a REAL socket, and makes a REAL HTTP request to `/health`.
 *
 * ## What it deliberately does not touch
 *
 * ## The second defect, and why this gate boots as production
 *
 * `ModelRouterModule` and `HypothesisIntentExtractionProviderModule` registered their providers with
 * `useFactory`, which Nest calls at BOOTSTRAP. Choosing an AI provider was therefore a precondition
 * of STARTING the process — an API with no `MODEL_PROVIDER` could not serve `/health`, auth,
 * Session, temporal or projection, none of which reach a provider at all. QANDEEL's production
 * provider choice is deliberately still open, so nothing may force it just to run those routes.
 *
 * Under Jest that defect is INVISIBLE: both factories short-circuit to a fake when
 * `NODE_ENV === 'test'`, so they read no configuration and the whole existing suite passes either
 * way. A gate that booted as `test` would prove nothing about it. So this one boots the production
 * path explicitly, with no provider configured, and requires the API to serve anyway.
 *
 * ## What it deliberately does not touch
 *
 * No paid provider call, no provider network invocation, no Supabase read or write, no secret.
 *
 * Those are guaranteed structurally rather than by hope:
 *
 *   NO provider configuration is set at all — no `MODEL_PROVIDER`, no `OPENAI_API_KEY`, no
 *   `ANTHROPIC_API_KEY`, no `GOOGLE_AI_API_KEY`. Nothing can call a provider it cannot select, and
 *   the last test below proves generation still fails closed rather than silently degrading;
 *
 *   every `SUPABASE_*` and `REDIS_URL` value is REMOVED for the duration, so the Supabase transports
 *   have no base URL to reach even if something tried — they raise `ServiceUnavailableException`
 *   before any request is built;
 *
 *   the two background workers (`RuntimeEventPublisher`, `PostResponseIntelligenceConsumerService`)
 *   gate their `onModuleInit` on Redis being configured as well as on `NODE_ENV`, and `REDIS_URL` is
 *   removed, so neither arms a timer or opens a connection even under `production`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MODEL_ROUTER, type ModelRouter } from '../model-router/model-router.types';
import {
  HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
  type HypothesisIntentExtractionProvider,
} from '../hypothesis/hypothesis-intent-extraction-provider.types';

/** Every Nest HTTP platform adapter. Exactly one of these must be a declared dependency. */
const HTTP_PLATFORM_ADAPTERS = ['@nestjs/platform-express', '@nestjs/platform-fastify'];

/**
 * Values that must not be visible while the application boots.
 *
 * The provider entries are the point of this list, not an afterthought: the API must start and serve
 * its non-generation routes with NO provider selected, because selecting one is a product decision
 * that has not been made and must not be forced by a bootstrap.
 */
const WITHHELD = [
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'REDIS_URL', 'DATABASE_URL',
  'MODEL_PROVIDER', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY',
  'HYPOTHESIS_INTENT_EXTRACTION_PROVIDER', 'HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER',
];

const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('the API declares an HTTP platform adapter', () => {
  it('names exactly one Nest HTTP platform adapter as a runtime dependency', () => {
    const declared = HTTP_PLATFORM_ADAPTERS.filter((name) => name in manifest.dependencies);
    // A dependency, never a devDependency: `main.ts` needs it in production, and a devDependency
    // would pass every test here and still fail to serve wherever the API is actually deployed.
    expect(declared).toHaveLength(1);
  });

  it('is on the same major line as @nestjs/core', () => {
    const [adapter] = HTTP_PLATFORM_ADAPTERS.filter((name) => name in manifest.dependencies);
    const major = (range: string) => range.replace(/^[^\d]*/u, '').split('.')[0];
    expect(major(manifest.dependencies[adapter])).toBe(major(manifest.dependencies['@nestjs/core']));
  });
});

describe('the real API bootstraps over HTTP with no provider configured, and answers /health', () => {
  const saved = new Map<string, string | undefined>();
  let app: INestApplication | undefined;
  let origin = '';

  beforeAll(async () => {
    for (const name of [...WITHHELD, 'NODE_ENV']) saved.set(name, process.env[name]);
    for (const name of WITHHELD) delete process.env[name];
    // The production code path, on purpose. Under `test` both provider factories return a fake and
    // read nothing, so a `test` boot cannot see the defect this gate exists to prevent recurring.
    process.env.NODE_ENV = 'production';

    // The REAL application module and the REAL factory `main.ts` uses. Logging is off because a
    // passing gate should say nothing; a failure still throws with the driver-selection message.
    // `abortOnError: false` matters for a gate: Nest's default teardown calls `process.exit(1)`,
    // which kills the runner and reports "process.exit called with 1" instead of the actual reason.
    // With it off, a bootstrap failure surfaces as an ordinary rejection carrying the real message.
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    // A real socket on the loopback interface, on a port the OS chooses, so a busy port on a
    // developer machine or a CI runner can never make this gate flake.
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  }, 120_000);

  afterAll(async () => {
    // Closing is part of the claim: an application that serves but cannot shut down cleanly leaves
    // the runner hanging, and that is a deployment defect too.
    await app?.close();
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }, 60_000);

  it('serves GET /health with the canonical liveness body', async () => {
    const response = await fetch(`${origin}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'qandeel-api' });
  });

  it('serves GET /health/live', async () => {
    const response = await fetch(`${origin}/health/live`);
    expect(response.status).toBe(200);
  });

  it('refuses an authenticated route without a credential, over real HTTP', async () => {
    // The guard is the boundary the Phase-M validation depends on, and this is the only place it is
    // exercised through a real request rather than through a testing-module double.
    const response = await fetch(`${origin}/conversation/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(401);
  });

  it('booted with no Supabase and no provider configuration visible', () => {
    // Proves the two guarantees this gate rests on: nothing could have read or written Supabase, and
    // nothing selected an AI provider in order to start.
    for (const name of WITHHELD) expect(process.env[name]).toBeUndefined();
    expect(process.env.NODE_ENV).toBe('production');
  });

  it('still FAILS CLOSED when something actually asks it to generate', async () => {
    // The other half of the repair, and the one that keeps it honest. Deferring provider selection
    // must not become "generate anyway": with no provider configured, a generation attempt has to
    // fail with the same error it always did, and it must arrive as a rejection.
    const router = app!.get<ModelRouter>(MODEL_ROUTER);
    await expect(router.generate({} as never)).rejects.toThrow('MODEL_PROVIDER must be either anthropic or openai.');
  });

  it('still FAILS CLOSED when something actually asks it to extract', async () => {
    const provider = app!.get<HypothesisIntentExtractionProvider>(HYPOTHESIS_INTENT_EXTRACTION_PROVIDER);
    await expect(provider.extract({} as never)).rejects.toThrow('OPENAI_API_KEY is required for hypothesis intent extraction.');
  });
});
