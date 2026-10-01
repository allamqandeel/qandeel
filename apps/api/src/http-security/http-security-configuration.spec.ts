import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clientAddressOf,
  expressTrustProxySetting,
  isTrustableProxyEntry,
  parseProxyConfiguration,
  ProxyConfigurationError,
} from './client-address';
import { ProductionSecurityConfigurationError, runSecurityPreflight } from './production-security-preflight';
import {
  assertRateLimitPolicies,
  CLIENT_LIMIT_PER_MINUTE,
  RATE_LIMIT_POLICIES,
  rateLimitModuleOptions,
  rateLimitTrackerOf,
} from './rate-limit.policy';

/**
 * PROD-SEC-01 — the configuration halves of SEC-A, SEC-B and SEC-D, proved without a socket. The socket halves (real
 * Express resolution, real 429s, real headers) are in `http-security.e2e.spec.ts`.
 */

// Fixture keys. None is a real credential; each only has the SHAPE the preflight must tell apart.
const legacyJwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')}.signature-fixture`;
const PRODUCTION_OK = Object.freeze({
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://project-fixture.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_SERVICE_ROLE_KEY: legacyJwt('service_role'),
  SUPABASE_SECRET_KEY: 'sb_secret_fixture_value',
  QANDEEL_API_PROXY_MODE: 'direct',
});

describe('SEC-B — the proxy topology is parsed once, strictly, and never becomes trust-everything', () => {
  it('defaults to direct (trust nothing) only in an explicit local run', () => {
    expect(parseProxyConfiguration({ NODE_ENV: 'development' })).toEqual({ mode: 'direct', trustedProxies: [] });
    expect(parseProxyConfiguration({ NODE_ENV: 'test' })).toEqual({ mode: 'direct', trustedProxies: [] });
  });

  it('holds an unset or unknown NODE_ENV to production rules: a forgotten NODE_ENV fails closed', () => {
    for (const environment of [{}, { NODE_ENV: 'prod' }, { NODE_ENV: 'staging' }, { NODE_ENV: '' }]) {
      expect(() => parseProxyConfiguration(environment)).toThrow(ProxyConfigurationError);
    }
  });

  it('requires an explicit mode in production', () => {
    expect(() => parseProxyConfiguration({ NODE_ENV: 'production' })).toThrow(ProxyConfigurationError);
    expect(parseProxyConfiguration({ NODE_ENV: 'production', QANDEEL_API_PROXY_MODE: 'direct' }).mode).toBe('direct');
  });

  it('refuses trusted_proxy with an empty or invalid list, in every environment', () => {
    for (const NODE_ENV of ['production', 'development']) {
      expect(() => parseProxyConfiguration({ NODE_ENV, QANDEEL_API_PROXY_MODE: 'trusted_proxy' })).toThrow(ProxyConfigurationError);
      expect(() => parseProxyConfiguration({ NODE_ENV, QANDEEL_API_PROXY_MODE: 'trusted_proxy', QANDEEL_API_TRUSTED_PROXIES: ' , ' })).toThrow(ProxyConfigurationError);
    }
  });

  it.each([
    ['true'], ['1'], ['2'], ['loopback'], ['uniquelocal'], ['0.0.0.0/0'], ['::/0'], ['10.0.0.0/33'], ['10.0.0.0/'],
    ['10.0.0.0/x'], ['not-an-ip'], ['203.0.113.1:443'], ['*'],
    ['::ffff:0.0.0.0/96'], ['::FFFF:10.0.0.1'], ['0:0:0:0:0:ffff:0:0/96'], ['::ffff:a00:1'],
  ])('refuses %s as a trusted proxy entry: only literal addresses / non-zero-prefix CIDRs name a proxy', (entry) => {
    expect(isTrustableProxyEntry(entry)).toBe(false);
    expect(() => parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'trusted_proxy', QANDEEL_API_TRUSTED_PROXIES: entry })).toThrow(ProxyConfigurationError);
  });

  it('accepts literal IPv4 / IPv6 addresses and CIDR ranges and hands Express exactly that list', () => {
    const configuration = parseProxyConfiguration({
      NODE_ENV: 'production',
      QANDEEL_API_PROXY_MODE: 'trusted_proxy',
      QANDEEL_API_TRUSTED_PROXIES: '10.0.0.0/8, 192.0.2.10, 2001:db8::/32, 10.0.0.0/8',
    });
    expect(configuration).toEqual({ mode: 'trusted_proxy', trustedProxies: ['10.0.0.0/8', '192.0.2.10', '2001:db8::/32'] });
    expect(expressTrustProxySetting(configuration)).toEqual(['10.0.0.0/8', '192.0.2.10', '2001:db8::/32']);
  });

  it('refuses an unknown mode and a trusted list without trusted_proxy mode', () => {
    expect(() => parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'true' })).toThrow(ProxyConfigurationError);
    expect(() => parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'hops' })).toThrow(ProxyConfigurationError);
    expect(() => parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'direct', QANDEEL_API_TRUSTED_PROXIES: '10.0.0.1' })).toThrow(ProxyConfigurationError);
    expect(() => parseProxyConfiguration({ QANDEEL_API_TRUSTED_PROXIES: '10.0.0.1' })).toThrow(ProxyConfigurationError);
  });

  it('never produces trust proxy = true or a hop count', () => {
    expect(expressTrustProxySetting({ mode: 'direct', trustedProxies: [] })).toBe(false);
    const source = readFileSync(join(__dirname, 'client-address.ts'), 'utf8') + readFileSync(join(__dirname, 'http-security.ts'), 'utf8');
    expect(source).not.toMatch(/'trust proxy',\s*(true|\d)/u);
  });

  it('errors name the variable and the rule, never the configured value', () => {
    try {
      parseProxyConfiguration({ QANDEEL_API_PROXY_MODE: 'trusted_proxy', QANDEEL_API_TRUSTED_PROXIES: 'secret-looking-value-xyz' });
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-looking-value-xyz');
    }
  });
});

describe('SEC-B — the client address is normalized and validated before it keys anything', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::FFFF:203.0.113.7', '203.0.113.7'],
    ['2001:db8::1', '2001:db8::1'],
    ['fe80::1%eth0', 'fe80::1'],
  ])('%s → %s', (raw, expected) => expect(clientAddressOf({ ip: raw })).toBe(expected));

  it.each([[undefined], [''], ['attacker'], ['203.0.113.7, 10.0.0.1'], [42]])('refuses %p', (raw) => {
    expect(clientAddressOf({ ip: raw })).toBeUndefined();
  });
});

describe('SEC-D — the production security preflight', () => {
  it('admits a complete production configuration and returns the parsed topology', () => {
    expect(runSecurityPreflight(PRODUCTION_OK).proxy).toEqual({ mode: 'direct', trustedProxies: [] });
  });

  it('requires nothing in an explicit local run: development and test keep their partial configuration', () => {
    expect(() => runSecurityPreflight({ NODE_ENV: 'test' })).not.toThrow();
    expect(() => runSecurityPreflight({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('holds a deployment that forgot NODE_ENV to the production rules', () => {
    expect(() => runSecurityPreflight({})).toThrow(ProductionSecurityConfigurationError);
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = PRODUCTION_OK;
    expect(() => runSecurityPreflight(withoutNodeEnv)).not.toThrow();
    expect(() => runSecurityPreflight({ ...withoutNodeEnv, SUPABASE_SECRET_KEY: undefined })).toThrow(ProductionSecurityConfigurationError);
  });

  it('admits one new-format secret key serving as both the service-role and the forwarding key', () => {
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_shared_fixture', SUPABASE_SECRET_KEY: 'sb_secret_shared_fixture' })).not.toThrow();
  });

  it.each(['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'QANDEEL_API_PROXY_MODE'])(
    'refuses production without %s',
    (name) => {
      expect(() => runSecurityPreflight({ ...PRODUCTION_OK, [name]: undefined })).toThrow(ProductionSecurityConfigurationError);
      expect(() => runSecurityPreflight({ ...PRODUCTION_OK, [name]: '   ' })).toThrow(ProductionSecurityConfigurationError);
    },
  );

  it('refuses a non-https project URL in production', () => {
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_URL: 'http://project-fixture.supabase.co' })).toThrow(/https/u);
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_URL: 'not a url' })).toThrow(/https/u);
  });

  it('refuses every substitute for the secret key: there is no fallback credential', () => {
    const refused = [
      PRODUCTION_OK.SUPABASE_PUBLISHABLE_KEY, // the publishable key itself
      PRODUCTION_OK.SUPABASE_SERVICE_ROLE_KEY, // the service-role key itself
      'sb_publishable_another_fixture', // any publishable key
      legacyJwt('anon'), // a legacy anon key
      legacyJwt('service_role'), // a legacy service_role key that is not the configured one
    ];
    for (const SUPABASE_SECRET_KEY of refused) {
      expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_SECRET_KEY })).toThrow(ProductionSecurityConfigurationError);
    }
  });

  it('pins no secret-key format: a future secret key shape is admitted', () => {
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_SECRET_KEY: 'sb_secret_v2.some-future-format' })).not.toThrow();
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, SUPABASE_SECRET_KEY: 'opaque-future-secret' })).not.toThrow();
  });

  it('never prints a value, prefix or fragment of any key', () => {
    const environment = { ...PRODUCTION_OK, SUPABASE_SECRET_KEY: PRODUCTION_OK.SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL: 'http://leak-me.example' };
    try {
      runSecurityPreflight(environment);
      throw new Error('expected a refusal');
    } catch (error) {
      const message = (error as Error).message;
      for (const value of [PRODUCTION_OK.SUPABASE_PUBLISHABLE_KEY, PRODUCTION_OK.SUPABASE_SERVICE_ROLE_KEY, 'sb_publishable_fixture', 'leak-me', 'fixture']) {
        expect(message).not.toContain(value);
      }
      expect(message).toMatch(/^PRODUCTION_SECURITY_CONFIGURATION_INVALID: /u);
    }
  });

  it('reports a bad proxy configuration through the same refusal', () => {
    expect(() => runSecurityPreflight({ ...PRODUCTION_OK, QANDEEL_API_PROXY_MODE: 'trusted_proxy' })).toThrow(ProductionSecurityConfigurationError);
  });
});

describe('SEC-A — the rate-limit policy table', () => {
  it('is a set of positive whole numbers, checked at startup', () => {
    expect(() => assertRateLimitPolicies()).not.toThrow();
    expect(Number.isSafeInteger(CLIENT_LIMIT_PER_MINUTE) && CLIENT_LIMIT_PER_MINUTE > 0).toBe(true);
  });

  it('makes pre-authentication stricter than ordinary authenticated use, and mail the strictest', () => {
    const { AUTHENTICATED, CONVERSATION, PRE_AUTH_LOOKUP, PRE_AUTH_CREDENTIAL, PRE_AUTH_MAIL, AUTHENTICATED_MAIL, SECURITY_SENSITIVE, UNCLASSIFIED } = RATE_LIMIT_POLICIES;
    for (const preAuth of [PRE_AUTH_LOOKUP, PRE_AUTH_CREDENTIAL, PRE_AUTH_MAIL]) {
      expect(preAuth.perMinute).toBeLessThan(AUTHENTICATED.perMinute);
      expect(preAuth.perMinute).toBeLessThan(CONVERSATION.perMinute);
      expect(preAuth.perHour).not.toBeNull();
    }
    expect(SECURITY_SENSITIVE.perMinute).toBeLessThan(AUTHENTICATED.perMinute);
    for (const mail of [PRE_AUTH_MAIL, AUTHENTICATED_MAIL]) {
      for (const policy of Object.values(RATE_LIMIT_POLICIES)) expect(mail.perMinute).toBeLessThanOrEqual(policy.perMinute);
    }
    // An unclassified route is bounded like a credential route, never like an ordinary one.
    expect(UNCLASSIFIED.perMinute).toBeLessThanOrEqual(PRE_AUTH_CREDENTIAL.perMinute);
    expect(UNCLASSIFIED.perHour).not.toBeNull();
  });

  it('keeps the 5-second foreground poll far inside its class', () => {
    // A poll every 5 s is 12 requests a minute per route; ten readers behind one shared address are 120.
    expect(RATE_LIMIT_POLICIES.CONVERSATION.perMinute).toBeGreaterThanOrEqual(10 * 12 * 2);
    expect(RATE_LIMIT_POLICIES.AUTHENTICATED.perMinute).toBeGreaterThanOrEqual(10 * 12 * 2);
    expect(RATE_LIMIT_POLICIES.HEALTH.perMinute).toBeGreaterThanOrEqual(60 * 2);
  });

  it('defines three throttlers with no counter headers, and no environment can change any number', () => {
    const options = rateLimitModuleOptions();
    expect(Array.isArray(options)).toBe(false);
    const { throttlers, setHeaders, storage } = options as Exclude<typeof options, unknown[]>;
    expect(throttlers.map((throttler) => throttler.name)).toEqual(['client', 'route_minute', 'route_hour']);
    expect(setHeaders).toBe(false);
    expect(storage).toBeUndefined(); // process-local: no external store whose failure could mean "unlimited"
    for (const file of ['rate-limit.policy.ts', 'route-rate-limit.census.ts', 'http-security.module.ts']) {
      expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(/process\.env|from '(?:redis|ioredis)'|ThrottlerStorageRedis|storage:/u);
    }
  });

  it('tracks the trusted client address only — never a body field, header or token', () => {
    const request = {
      ip: '::ffff:203.0.113.9',
      body: { loginId: 'reader.one', password: 'p', email: 'reader@example.com' },
      headers: { authorization: 'Bearer token-fixture', 'x-forwarded-for': '198.51.100.1' },
    };
    expect(rateLimitTrackerOf(request)).toBe('203.0.113.9');
    expect(rateLimitTrackerOf({ ip: '2001:db8:1:2:3:4:5:6' })).toBe('2001:db8:1:2::/64');
    expect(rateLimitTrackerOf({})).toBe('unresolved-client-address');
  });
});
