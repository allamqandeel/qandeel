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
