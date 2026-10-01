import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Req, type ExecutionContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import { AccountController } from '../account/account.controller';
import { AccountService } from '../account/account.service';
import { LoginIdSignInController } from '../account/login-id-sign-in.controller';
import { LoginIdSignInRepository } from '../account/login-id-sign-in.repository';
import { LoginIdSignInService } from '../account/login-id-sign-in.service';
import { SupabasePasswordGrantService } from '../account/supabase-password-grant.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationController } from '../conversation/conversation.controller';
import { ConversationService } from '../conversation/conversation.service';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { clientAddressOf, parseProxyConfiguration, type ProxyConfiguration } from './client-address';
import { configureHttpSecurity } from './http-security';
import { HttpSecurityModule } from './http-security.module';
import { CLIENT_LIMIT_PER_MINUTE, RATE_LIMIT_POLICIES } from './rate-limit.policy';

/**
 * PROD-SEC-01 — SEC-A / SEC-B / SEC-C / SEC-H over REAL sockets: the real Express trust-proxy resolution, the real
 * global guard with the real route census, the real Helmet registration, the real provider relay (with `fetch` to the
 * provider intercepted, so nothing leaves the process), and the real body parser.
 *
 * The client of these tests is `node:http`, never `fetch`, so intercepting the provider can never intercept the test.
 */

/** A route the census does not name: it proves the fallback is bounded, and it echoes the resolved address. */
@Controller('probe')
class ProbeController {
  @Get('address')
  address(@Req() request: { readonly ip?: string }) {
    return { address: clientAddressOf(request) ?? null };
  }
}

const SECRET = 'sb_secret_fixture_for_forwarding';
const PUBLISHABLE = 'sb_publishable_fixture_never_forwarded';
const SERVICE_ROLE = 'service-role-fixture-never-forwarded';
const KNOWN_LOGIN_ID = 'reader.one';

interface Answer {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly text: string;
}

function call(origin: string, method: string, path: string, options: { headers?: Record<string, string>; body?: string } = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const target = new URL(path, origin);
    const outgoing = httpRequest(
      { host: target.hostname, port: target.port, path: target.pathname + target.search, method, headers: { 'Content-Type': 'application/json', ...options.headers }, agent: false },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    outgoing.on('error', reject);
    if (options.body !== undefined) outgoing.write(options.body);
    outgoing.end();
  });
}

const from = (client: string) => ({ 'X-Forwarded-For': client });
const json = (value: unknown) => JSON.stringify(value);

interface Harness {
  readonly app: NestExpressApplication;
  readonly origin: string;
  readonly readiness: jest.Mock;
  readonly availability: jest.Mock;
}

async function start(proxy: ProxyConfiguration): Promise<Harness> {
  const readiness = jest.fn(async () => ({ status: 'ready' }));
  const availability = jest.fn(async () => ({ available: true }));
  const moduleRef = await Test.createTestingModule({
    imports: [HttpSecurityModule],
    controllers: [HealthController, AccountController, LoginIdSignInController, ConversationController, ProbeController],
    providers: [
      { provide: HealthService, useValue: { readiness } },
      { provide: AccountService, useValue: { checkLoginIdAvailability: availability } },
      { provide: ConversationService, useValue: { listTurns: async () => ({ turns: [] }), resumeSession: async () => ({}), createSession: async () => ({}), createTurn: async () => ({}), cancelTurn: async () => ({}) } },
      { provide: LoginIdSignInRepository, useValue: { signInAddressOf: async (loginId: string) => (loginId === KNOWN_LOGIN_ID ? 'reader@example.com' : null) } },
      LoginIdSignInService,
      SupabasePasswordGrantService,
    ],
  })
    .overrideGuard(SupabaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest().authenticatedUser = { userId: 'user-fixture', accessToken: 'token-fixture' };
        return true;
      },
    })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureHttpSecurity(app, proxy);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, origin: `http://127.0.0.1:${port}`, readiness, availability };
}

const DIRECT = parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'direct' });
const LOOPBACK_PROXY = parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'trusted_proxy', QANDEEL_API_TRUSTED_PROXIES: '127.0.0.1, 10.0.0.0/8' });

let providerCalls: { url: string; headers: Record<string, string> }[] = [];
const savedEnvironment = new Map<string, string | undefined>();

beforeAll(() => {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) savedEnvironment.set(name, process.env[name]);
  process.env.SUPABASE_URL = 'https://project-fixture.supabase.co';
  process.env.SUPABASE_SECRET_KEY = SECRET;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE;
});
afterAll(() => {
  for (const [name, value] of savedEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
beforeEach(() => {
  providerCalls = [];
  // The provider is intercepted: its answer is a credential refusal, and every request it would have received is kept.
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    providerCalls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    return new Response(json({ error_code: 'invalid_credentials' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => jest.restoreAllMocks());

describe('SEC-B — direct mode: the socket peer is the client, and forwarding headers are ignored', () => {
  let harness: Harness;
  beforeAll(async () => (harness = await start(DIRECT)), 60_000);
  afterAll(async () => harness.app.close());

  it('ignores a forged X-Forwarded-For', async () => {
    const answer = await call(harness.origin, 'GET', '/probe/address', { headers: from('203.0.113.66') });
    expect(JSON.parse(answer.text)).toEqual({ address: '127.0.0.1' });
  });

  it('forwards the SOCKET address to the provider, with the secret key only', async () => {
    const answer = await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.66'), body: json({ loginId: KNOWN_LOGIN_ID, password: 'pw' }) });
    expect(answer.status).toBe(401);
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0].headers['Sb-Forwarded-For']).toBe('127.0.0.1');
    expect(providerCalls[0].headers.apikey).toBe(SECRET);
    expect(JSON.stringify(providerCalls[0].headers)).not.toMatch(new RegExp(`${PUBLISHABLE}|${SERVICE_ROLE}`, 'u'));
  });
});

describe('SEC-B — trusted_proxy mode: only listed proxies are believed, and the first untrusted hop is the client', () => {
  let harness: Harness;
  beforeAll(async () => (harness = await start(LOOPBACK_PROXY)), 60_000);
  afterAll(async () => harness.app.close());

  it('resolves the client named by a trusted proxy', async () => {
    const answer = await call(harness.origin, 'GET', '/probe/address', { headers: from('203.0.113.9') });
    expect(JSON.parse(answer.text)).toEqual({ address: '203.0.113.9' });
  });

  it('walks a chain of trusted proxies to the first untrusted address, ignoring what the client wrote before it', async () => {
    const answer = await call(harness.origin, 'GET', '/probe/address', { headers: from('6.6.6.6, 198.51.100.7, 10.1.2.3') });
    expect(JSON.parse(answer.text)).toEqual({ address: '198.51.100.7' });
  });

  it('forwards that resolved client to the provider, with the secret key only', async () => {
    await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('6.6.6.6, 198.51.100.7, 10.1.2.3'), body: json({ loginId: 'nobody', password: 'pw' }) });
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0].headers['Sb-Forwarded-For']).toBe('198.51.100.7');
    expect(providerCalls[0].headers.apikey).toBe(SECRET);
  });

  it('never accepts an address from the body or the query', async () => {
    await call(harness.origin, 'POST', '/account/login-id-sign-in?ip=192.0.2.200', { headers: from('203.0.113.10'), body: json({ loginId: KNOWN_LOGIN_ID, password: 'pw' }) });
    expect(providerCalls[0].headers['Sb-Forwarded-For']).toBe('203.0.113.10');
  });
});

describe('SEC-B — an untrusted peer cannot name a client', () => {
  let harness: Harness;
  beforeAll(async () => (harness = await start(parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'trusted_proxy', QANDEEL_API_TRUSTED_PROXIES: '10.0.0.1' }))), 60_000);
  afterAll(async () => harness.app.close());

  it('keeps the socket peer when the peer is not a listed proxy', async () => {
    const answer = await call(harness.origin, 'GET', '/probe/address', { headers: from('203.0.113.9') });
    expect(JSON.parse(answer.text)).toEqual({ address: '127.0.0.1' });
    await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.9'), body: json({ loginId: KNOWN_LOGIN_ID, password: 'pw' }) });
    expect(providerCalls[0].headers['Sb-Forwarded-For']).toBe('127.0.0.1');
  });
});

/** Send `count` requests and return their statuses. */
async function burst(count: number, send: (index: number) => Promise<Answer>): Promise<number[]> {
  const statuses: number[] = [];
  for (let index = 0; index < count; index += 1) statuses.push((await send(index)).status);
  return statuses;
}

describe('SEC-A — every class is bounded per client, with one generic 429', () => {
  let harness: Harness;
  beforeEach(async () => (harness = await start(LOOPBACK_PROXY)), 60_000);
  afterEach(async () => harness.app.close());

  it('pre-auth Login ID availability: bounded per client, separate clients separate buckets, one generic answer', async () => {
    const limit = RATE_LIMIT_POLICIES.PRE_AUTH_LOOKUP.perMinute;
    // Alternating Login IDs share the bucket: the key is the client, never the identifier.
    const statuses = await burst(limit, (index) => call(harness.origin, 'POST', '/account/login-id-availability', { headers: from('203.0.113.1'), body: json({ loginId: `candidate${index % 3}` }) }));
    expect(statuses.every((status) => status === 200)).toBe(true);

    const refused = await call(harness.origin, 'POST', '/account/login-id-availability', { headers: from('203.0.113.1'), body: json({ loginId: 'secret.login.id' }) });
    expect(refused.status).toBe(429);
    expect(JSON.parse(refused.text)).toEqual({ outcome: 'RATE_LIMITED' });
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(refused.text).not.toMatch(/secret\.login\.id|203\.0\.113|remaining|ttl|reset|\d/iu);
    expect(Object.keys(refused.headers).filter((name) => /ratelimit/iu.test(name))).toEqual([]);
    expect(harness.availability).toHaveBeenCalledTimes(limit); // the refused request reached no service

    const other = await call(harness.origin, 'POST', '/account/login-id-availability', { headers: from('203.0.113.2'), body: json({ loginId: 'candidate0' }) });
    expect(other.status).toBe(200);
  }, 60_000);

  it('Login ID sign-in: bounded, and the refused attempt never reaches the database or the provider', async () => {
    const limit = RATE_LIMIT_POLICIES.PRE_AUTH_CREDENTIAL.perMinute;
    const send = () => call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.3'), body: json({ loginId: KNOWN_LOGIN_ID, password: 'pw' }) });
    const statuses = await burst(limit, send);
    expect(statuses.every((status) => status === 401)).toBe(true);
    const refused = await send();
    expect(refused.status).toBe(429);
    expect(JSON.parse(refused.text)).toEqual({ outcome: 'RATE_LIMITED' });
    expect(providerCalls).toHaveLength(limit);
    // Non-enumeration is unchanged: an unknown Login ID from another client meets the same answers.
    const unknown = await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.4'), body: json({ loginId: 'nobody', password: 'pw' }) });
    expect(unknown.status).toBe(401);
    expect(JSON.parse(unknown.text)).toEqual(expect.objectContaining({ outcome: 'INVALID_CREDENTIALS' }));
  }, 60_000);

  it('Login-ID-origin code verification: bounded like a credential', async () => {
    const limit = RATE_LIMIT_POLICIES.PRE_AUTH_CREDENTIAL.perMinute;
    const send = () => call(harness.origin, 'POST', '/account/login-id-verify-email', { headers: from('203.0.113.5'), body: json({ loginId: KNOWN_LOGIN_ID, code: '123456' }) });
    expect((await burst(limit, send)).every((status) => status === 401)).toBe(true);
    expect((await send()).status).toBe(429);
  }, 60_000);

  it('verification resend: the mail-producing route is the tightest', async () => {
    const limit = RATE_LIMIT_POLICIES.PRE_AUTH_MAIL.perMinute;
    const send = () => call(harness.origin, 'POST', '/account/login-id-resend-verification', { headers: from('203.0.113.6'), body: json({ loginId: KNOWN_LOGIN_ID }) });
    expect((await burst(limit, send)).every((status) => status === 200)).toBe(true);
    const refused = await send();
    expect(refused.status).toBe(429);
    expect(providerCalls).toHaveLength(limit); // no mail request beyond the bound
  }, 60_000);

  it('the foreground poll is never throttled under expected use, and the conversation class is still bounded', async () => {
    // Ten readers behind one shared address, each polling every 5 s for a minute: 120 reads of one route.
    const poll = () => call(harness.origin, 'GET', '/conversation/sessions/session-fixture/turns', { headers: from('203.0.113.7') });
    expect((await burst(120, poll)).every((status) => status === 200)).toBe(true);
    const remaining = RATE_LIMIT_POLICIES.CONVERSATION.perMinute - 120;
    expect((await burst(remaining, poll)).every((status) => status === 200)).toBe(true);
    expect((await poll()).status).toBe(429);
  }, 120_000);

  it('health stays admitted at load-balancer cadence and keeps its readiness single-flight path', async () => {
    // Two probes a second from one balancer address, across the three health routes, for a minute.
    const routes = ['/health', '/health/live', '/health/ready'];
    const statuses = await burst(120, (index) => call(harness.origin, 'GET', routes[index % 3], { headers: from('10.9.9.9') }));
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(harness.readiness).toHaveBeenCalledTimes(40);
  }, 60_000);

  it('a route the census does not classify is still bounded, strictly', async () => {
    const limit = RATE_LIMIT_POLICIES.UNCLASSIFIED.perMinute;
    const send = () => call(harness.origin, 'GET', '/probe/address', { headers: from('203.0.113.8') });
    expect((await burst(limit, send)).every((status) => status === 200)).toBe(true);
    expect((await send()).status).toBe(429);
  }, 60_000);

  it('the aggregate window bounds one client across all routes together', async () => {
    // Five distinct conversation handlers, so no route reaches its own bound before the aggregate does.
    const routes: [string, string][] = [['GET', '/conversation/sessions/a/turns'], ['GET', '/conversation/sessions/a'], ['POST', '/conversation/sessions'], ['POST', '/conversation/sessions/a/turns'], ['PATCH', '/conversation/sessions/a/turns/t/cancel']];
    expect(CLIENT_LIMIT_PER_MINUTE / routes.length).toBeLessThan(RATE_LIMIT_POLICIES.CONVERSATION.perMinute);
    const statuses = await burst(CLIENT_LIMIT_PER_MINUTE, (index) => call(harness.origin, routes[index % routes.length][0], routes[index % routes.length][1], { headers: from('203.0.113.12'), ...(routes[index % routes.length][0] === 'GET' ? {} : { body: '{}' }) }));
    expect(statuses.filter((status) => status < 200 || status >= 300)).toEqual([]); // no single route reached its own bound
    expect((await call(harness.origin, 'GET', '/health', { headers: from('203.0.113.12') })).status).toBe(429);
    expect((await call(harness.origin, 'GET', '/health', { headers: from('203.0.113.13') })).status).toBe(200);
  }, 180_000);

  it('keys hold no identifier: two Login IDs from one client touch exactly the same digests', async () => {
    const storage = harness.app.get<ThrottlerStorage>(getStorageToken());
    const keys: string[] = [];
    const increment = storage.increment.bind(storage);
    jest.spyOn(storage, 'increment').mockImplementation((key, ...rest) => {
      keys.push(key);
      return increment(key, ...rest);
    });
    await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.14'), body: json({ loginId: KNOWN_LOGIN_ID, password: 'first' }) });
    const first = [...keys];
    keys.length = 0;
    await call(harness.origin, 'POST', '/account/login-id-sign-in', { headers: from('203.0.113.14'), body: json({ loginId: 'someone.else', password: 'second' }) });
    expect(keys).toEqual(first);
    expect(first.length).toBe(3);
    for (const key of first) expect(key).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe('SEC-C / SEC-H — the header baseline on every answer, and no wildcard CORS', () => {
  let harness: Harness;
  beforeAll(async () => (harness = await start(DIRECT)), 60_000);
  afterAll(async () => harness.app.close());

  const expectBaseline = (answer: Answer) => {
    expect(answer.headers['x-powered-by']).toBeUndefined();
    expect(answer.headers['x-content-type-options']).toBe('nosniff');
    expect(answer.headers['content-security-policy']).toEqual(expect.stringContaining("default-src 'self'"));
    expect(answer.headers['strict-transport-security']).toEqual(expect.stringContaining('max-age='));
    expect(answer.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(answer.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(answer.headers['referrer-policy']).toBe('no-referrer');
    expect(answer.headers['access-control-allow-origin']).toBeUndefined();
  };

  it('2xx, with the JSON body unchanged', async () => {
    const answer = await call(harness.origin, 'GET', '/health', { headers: { Origin: 'https://evil.example' } });
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.text)).toEqual({ status: 'ok', service: 'qandeel-api' });
    expectBaseline(answer);
  });

  it('404', async () => {
    const answer = await call(harness.origin, 'GET', '/no-such-route');
    expect(answer.status).toBe(404);
    expectBaseline(answer);
  });

  it('an application error', async () => {
    const answer = await call(harness.origin, 'POST', '/account/login-id-sign-in', { body: json({ loginId: 'x' }) });
    expect(answer.status).toBe(400);
    expect(JSON.parse(answer.text)).toEqual(expect.objectContaining({ outcome: 'INVALID_REQUEST' }));
    expectBaseline(answer);
  });

  it('429', async () => {
    let answer: Answer | undefined;
    for (let index = 0; index <= RATE_LIMIT_POLICIES.PRE_AUTH_MAIL.perMinute; index += 1) {
      answer = await call(harness.origin, 'POST', '/account/login-id-resend-verification', { body: json({ loginId: KNOWN_LOGIN_ID }) });
    }
    expect(answer?.status).toBe(429);
    expectBaseline(answer as Answer);
  });

  it('a CORS preflight is not answered with any allowed origin', async () => {
    const answer = await call(harness.origin, 'OPTIONS', '/account/login-id-sign-in', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    expect(answer.headers['access-control-allow-origin']).toBeUndefined();
    expect(answer.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('request bodies stay bounded by the existing parser limit (100 kB): a larger JSON body is refused before any route', async () => {
    const oversized = json({ loginId: 'a'.repeat(200 * 1024) });
    const answer = await call(harness.origin, 'POST', '/account/login-id-availability', { body: oversized });
    expect(answer.status).toBe(413);
    expect(harness.availability).not.toHaveBeenCalled();
    expectBaseline(answer);
  });
});
