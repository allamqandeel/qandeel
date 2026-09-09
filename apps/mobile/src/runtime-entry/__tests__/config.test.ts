/** T-12P adversarial matrix — Config / auth, P01…P05. */
import { createClient } from '@supabase/supabase-js';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import {
  MOBILE_PUBLIC_CONFIG_KEYS,
  describeConfigFailure,
  readMobilePublicConfig,
} from '../config/mobile-public-config';
import { createEphemeralAuthSessionStorage } from '../auth/auth-session-storage';
import { SUPABASE_AUTH_OPTIONS } from '../auth/supabase-auth-port';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { createMobileRuntimeEntry } from '../mobile-runtime-entry';
import { TEST_CONFIG } from '../__fixtures__/runtime-entry';

const complete = {
  qandeelApiBaseUrl: 'https://api.example.test/v1',
  supabaseUrl: 'https://project.supabase.example',
  supabasePublishableKey: 'sb_publishable_example',
};

test('the authorized dependencies load in this runtime', () => {
  // The whole layer rests on these two: a broken import would fail every other proof for the wrong
  // reason, so it is asserted once, first.
  expect(typeof createClient).toBe('function');
  expect(typeof SQLiteStorage).toBe('function');
});

test('a complete config is accepted and normalised', () => {
  const result = readMobilePublicConfig(complete);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  expect(result.config).toEqual({
    apiBaseUrl: 'https://api.example.test/v1',
    supabaseUrl: 'https://project.supabase.example',
    supabasePublishableKey: 'sb_publishable_example',
  });
});

test('P01 — a missing API base URL fails closed', () => {
  const result = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: undefined });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure).toEqual({ kind: 'MISSING', keys: ['qandeelApiBaseUrl'] });
});

test('P02 — a missing Supabase URL fails closed', () => {
  const result = readMobilePublicConfig({ ...complete, supabaseUrl: '   ' });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure).toEqual({ kind: 'MISSING', keys: ['supabaseUrl'] });
});

test('P03 — a missing publishable key fails closed', () => {
  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: null });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure).toEqual({ kind: 'MISSING', keys: ['supabasePublishableKey'] });
});

test('every missing key is reported at once, not one per attempt', () => {
  const result = readMobilePublicConfig({});
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure).toEqual({ kind: 'MISSING', keys: [...MOBILE_PUBLIC_CONFIG_KEYS] });
});

/** Build a legacy-format Supabase key: a JWT whose privilege lives in the `role` claim. */
function legacyKey(role: string): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'supabase', ref: 'proj', role })}.signature`;
}

test('P04 — a new-format elevated Supabase key is refused', () => {
  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: 'sb_secret_abcdef' });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure.kind).toBe('FORBIDDEN_SECRET');
});

test('P04 — a LEGACY elevated key is refused even though "service_role" never appears as plain text', () => {
  // The privilege of a legacy key lives in the base64url payload of a JWT, so a substring scan for
  // `service_role` misses exactly the mistake it is meant to catch. The claim must be decoded.
  const key = legacyKey('service_role');
  expect(key).not.toContain('service_role');

  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: key });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure.kind).toBe('FORBIDDEN_SECRET');
});

test("P04 — a user's own access token pasted into build config is refused", () => {
  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: legacyKey('authenticated') });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.failure.kind).toBe('FORBIDDEN_SECRET');
});

test('P04 — the legacy publishable equivalent is accepted', () => {
  // `anon` IS the legacy publishable key. Refusing it would break a project that has not yet
  // migrated to the new key format, which Supabase supports until the end of 2026.
  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: legacyKey('anon') });
  expect(result.ok).toBe(true);
});

test('P04 — a refusal never echoes the offending value', () => {
  const secret = 'sb_secret_do_not_leak_me';
  const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: secret });
  if (result.ok) throw new Error('unreachable');
  const message = describeConfigFailure(result.failure);
  expect(message).not.toContain('do_not_leak_me');
  expect(JSON.stringify(result.failure)).not.toContain('do_not_leak_me');
});

test('R1-04A — only the two documented publishable shapes are accepted', () => {
  // An ALLOWLIST, not a denylist: an unrecognised key is not evidence of safety, and the SDK is not
  // the right place to find out.
  expect(readMobilePublicConfig({ ...complete, supabasePublishableKey: 'sb_publishable_abc123' }).ok).toBe(true);
  expect(readMobilePublicConfig({ ...complete, supabasePublishableKey: legacyKey('anon') }).ok).toBe(true);
});

test('R2-02 — the new-format prefix is necessary but not sufficient', () => {
  // Documented shape: the `sb_publishable_` prefix, and "short strings, not JWTs". No charset and no
  // length is documented anywhere, and supabase-js itself validates nothing beyond the prefix — so
  // the payload is required to be non-empty printable non-space ASCII and nothing narrower is
  // invented. A guessed alphabet or length would reject a valid production key.
  expect(readMobilePublicConfig({ ...complete, supabasePublishableKey: 'sb_publishable_aB3-_x9' }).ok).toBe(true);

  const malformed: readonly string[] = [
    // Written as ESCAPES on purpose: a literal control or bidi character in source makes git
    // treat the file as binary and would be caught by the repository's own encoding sweep.
    'sb_publishable_', // the bare prefix
    'sb_publishable_ ', // a trailing space
    'sb_publishable_abc def', // an interior space
    'sb_publishable_abc\t', // a tab
    'sb_publishable_abc\n', // a newline
    'sb_publishable_abc\r', // a carriage return - the header-injection shape
    'sb_publishable_abc\u0000', // NUL
    'sb_publishable_abc\u007F', // DEL
    'sb_publishable_abc\u00E9', // non-ASCII
    'sb_publishable_abc\u200E', // a bidi control
  ];
  for (const value of malformed) {
    const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: value });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error(`accepted a malformed key: ${JSON.stringify(value)}`);
    expect(result.failure.kind).toBe('UNSUPPORTED_KEY_SHAPE');
  }
});

test('R2-02 — a refusal never echoes the supplied key, in text or serialised form', () => {
  // Each case carries a distinctive payload. A diagnostic may legitimately name the PREFIX it
  // recognised — that is documentation, not the key — but the payload must never appear.
  const cases: readonly string[] = [
    'sb_publishable_leakyvalue\u0000', // a control character after a real payload
    'sb_secret_leakyvalue',
    'not-a-key-leakyvalue',
    legacyKey('service_role'),
  ];
  for (const value of cases) {
    const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: value });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(describeConfigFailure(result.failure)).not.toContain(value);
    expect(JSON.stringify(result.failure)).not.toContain(value);
    expect(describeConfigFailure(result.failure)).not.toContain('leaky');
  }
});

test('R1-04A — an unrecognised key shape fails closed without echoing the value', () => {
  const cases: readonly string[] = [
    'not-a-key-at-all',
    'sb_something_else_abc',
    'eyJhbGciOiJIUzI1NiJ9',
    'a.b',
    'a.b.c.d',
    'header..signature',
  ];
  for (const value of cases) {
    const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: value });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure.kind).toBe('UNSUPPORTED_KEY_SHAPE');
    expect(describeConfigFailure(result.failure)).not.toContain(value);
  }
});

test('R1-04A — a JWT whose role claim cannot be read is refused', () => {
  const encode = (raw: string) => Buffer.from(raw).toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
  const undecodable = `${encode('{"alg":"HS256"}')}.${encode('not json at all')}.sig`;
  const roleless = `${encode('{"alg":"HS256"}')}.${encode('{"iss":"supabase"}')}.sig`;
  const nonStringRole = `${encode('{"alg":"HS256"}')}.${encode('{"role":42}')}.sig`;
  for (const value of [undecodable, roleless, nonStringRole]) {
    const result = readMobilePublicConfig({ ...complete, supabasePublishableKey: value });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure.kind).toBe('UNSUPPORTED_KEY_SHAPE');
  }
});

test('R1-04B — a cleartext origin is refused by the production reader', () => {
  for (const key of ['qandeelApiBaseUrl', 'supabaseUrl'] as const) {
    const result = readMobilePublicConfig({ ...complete, [key]: 'http://api.example.test/v1' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure.kind).toBe('MALFORMED');
    if (result.failure.kind !== 'MALFORMED') throw new Error('unreachable');
    expect(result.failure.detail).toContain('https');
  }
});

test('R1-04B — even a loopback http origin is refused unless the seam is explicitly opened', () => {
  const result = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: 'http://localhost:3000' });
  expect(result.ok).toBe(false);
});

test('R1-04B — the development seam admits loopback only, never a remote host', () => {
  for (const loopback of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://api.localhost:3000']) {
    const result = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: loopback }, { allowLoopbackHttp: true });
    expect(result.ok).toBe(true);
  }
  // The seam is a local-development affordance, not a way to make a remote cleartext origin valid.
  for (const remote of ['http://api.example.test/v1', 'http://10.0.0.5:3000', 'http://evil.localhost.example.test']) {
    const result = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: remote }, { allowLoopbackHttp: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure.kind).toBe('MALFORMED');
  }
});

test('R1-04B — https is accepted with or without the seam', () => {
  expect(readMobilePublicConfig(complete).ok).toBe(true);
  expect(readMobilePublicConfig(complete, { allowLoopbackHttp: true }).ok).toBe(true);
});

test('a URL that would corrupt a built path is refused', () => {
  // Both transports concatenate `${baseUrl}/conversation/...`, so a trailing slash silently
  // produces a double slash that nothing validates downstream.
  const trailing = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: 'https://api.example.test/' });
  expect(trailing.ok).toBe(false);
  if (trailing.ok) throw new Error('unreachable');
  expect(trailing.failure).toEqual({
    kind: 'MALFORMED',
    key: 'qandeelApiBaseUrl',
    detail: 'must not end with "/": the transports append their own path segments',
  });

  for (const bad of ['api.example.test', 'ftp://api.example.test', 'https://api.example.test?x=1']) {
    const result = readMobilePublicConfig({ ...complete, qandeelApiBaseUrl: bad });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure.kind).toBe('MALFORMED');
  }
});

test('P01/P02/P03 — the runtime refuses to be built at all on malformed config', () => {
  const built = createMobileRuntimeEntry({ config: undefined, authPort: undefined });
  // No Expo `extra` exists under Jest, so this exercises the real production read path.
  expect(built.ok).toBe(false);
  if (built.ok) throw new Error('unreachable');
  expect(built.failure.kind).toBe('MISSING');
  expect(built.detail).toContain('missing');
});

test('a valid config builds the REAL Supabase-backed runtime', async () => {
  // No `authPort` override: this constructs the production `createSupabaseAuthPort`, and therefore
  // the one real `createClient` call in the repository, against the real client options.
  //
  // The storage is the ephemeral adapter rather than the expo-sqlite one for a reason worth
  // stating: expo-sqlite is a native module with no implementation under jest-expo, and touching
  // it here kills the Jest worker outright. So the SQLite-backed store is proven on a device, not
  // here — see the task doc's native-validation section. What IS proven here is everything above
  // it: the client constructs, the port adapts it, and a restore with nothing stored resolves to
  // SIGNED_OUT rather than throwing.
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authStorage: createEphemeralAuthSessionStorage(),
    foreground: createManualForegroundSignal('ACTIVE'),
  });
  expect(built.ok).toBe(true);
  if (!built.ok) throw new Error('unreachable');
  expect(built.runtime.config).toEqual(TEST_CONFIG);

  await built.runtime.start();
  expect(built.runtime.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
  built.runtime.dispose();
});

test('the client options are exactly the official React Native / Expo set', () => {
  // Quoted from the official Supabase guidance: off-browser there is no URL to detect a session in,
  // and the refresh loop must be driven by app state rather than left running forever.
  expect(SUPABASE_AUTH_OPTIONS).toEqual({
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  });
});
