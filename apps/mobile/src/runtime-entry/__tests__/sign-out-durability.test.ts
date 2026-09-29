/**
 * W3-01 (E2E-D-07) — "leave this device signed out" survives an app restart, even when the provider's
 * sign-out fails.
 *
 * Nothing here is a double of the SDK: the port is the production one over the REAL `@supabase/supabase-js`
 * client and its real session handling, with the auth store's in-memory implementation standing in for the
 * device database (the SQLite adapter is proven on a device, not under Jest — see config.test.ts). The only
 * thing stood in for is the network, through the global `fetch` the SDK uses.
 *
 * The shape of the failure is the SDK's own: a persisted session whose access token has expired must be
 * refreshed before it can be signed out; when that refresh cannot reach the network, the SDK's `signOut`
 * returns the error WITHOUT removing the stored session (auth-js `_signOut`: `if (sessionError && …) return`).
 * A later launch with the network back would then silently restore the identity the reader asked to leave.
 */
import { createClient } from '@supabase/supabase-js';

import { createEphemeralAuthSessionStorage, type AuthSessionStorage } from '../auth/auth-session-storage';
import { createMobileAuthAuthority } from '../auth/mobile-auth-authority';
import { SUPABASE_AUTH_OPTIONS, createSupabaseAuthPort, supabaseSessionStorageKey, supabaseSessionStorageKeys } from '../auth/supabase-auth-port';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { TEST_CONFIG } from '../__fixtures__/runtime-entry';

const KEY = supabaseSessionStorageKey(TEST_CONFIG.supabaseUrl);
const USER = { id: 'alice', aud: 'authenticated', role: 'authenticated', email: 'alice@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

/** A persisted session whose access token has already expired, exactly as the SDK stores one. */
function expiredSession(): string {
  const past = Math.floor(Date.now() / 1000) - 3600;
  return JSON.stringify({ access_token: 'expired-access', refresh_token: 'refresh-alice', token_type: 'bearer', expires_in: 3600, expires_at: past, user: USER });
}

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) };
}

/** The network: down, or up and willing to refresh any session it is asked to. */
const network = { up: false, calls: [] as string[] };
const fetchDouble = jest.fn(async (input: unknown) => {
  const url = String(input);
  network.calls.push(url);
  if (!network.up) throw new TypeError('Network request failed');
  if (url.includes('/token')) {
    return json(200, { access_token: 'fresh-access', refresh_token: 'fresh-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER });
  }
  return json(204, {});
});

let realFetch: typeof globalThis.fetch;
beforeAll(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = fetchDouble as unknown as typeof globalThis.fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => {
  network.up = false;
  network.calls = [];
  // The SDK retries a refresh that cannot reach the network with exponential backoff for up to ~30 s before
  // its sign-out answers. That is real latency on a device; here its clock is driven instead of waited on.
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Settle SDK work, advancing the fake clock (and Date) through its retry backoff. */
async function run<T>(work: Promise<T>): Promise<T> {
  let done = false;
  let value: T | undefined;
  let failure: unknown = null;
  work.then(
    (result) => {
      done = true;
      value = result;
    },
    (cause: unknown) => {
      done = true;
      failure = cause ?? new Error('rejected');
    },
  );
  for (let step = 0; step < 240 && !done; step += 1) await jest.advanceTimersByTimeAsync(500);
  if (!done) throw new Error('the SDK work did not settle within two simulated minutes');
  if (failure !== null) throw failure;
  return value as T;
}

async function seeded(): Promise<AuthSessionStorage> {
  const storage = createEphemeralAuthSessionStorage();
  await storage.setItem(KEY, expiredSession());
  return storage;
}

test('the explicit storage key is exactly the SDK’s own default, so every existing persisted session is read as before', () => {
  expect(KEY).toBe('sb-project-auth-token');
  expect(supabaseSessionStorageKeys(KEY)).toEqual([KEY, `${KEY}-user`, `${KEY}-code-verifier`]);
});

test('NON-VACUITY — the SDK alone leaves the session stored when a network failure precedes its sign-out, and the next launch restores it', async () => {
  const storage = await seeded();
  const client = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabasePublishableKey, { auth: { storage, storageKey: KEY, ...SUPABASE_AUTH_OPTIONS } });
  const { error } = await run(client.auth.signOut());
  expect(error).not.toBeNull();
  expect(await storage.getItem(KEY)).not.toBeNull();

  // The next launch, with the network back: the identity the reader asked to leave comes back.
  network.up = true;
  const port = createSupabaseAuthPort({ config: TEST_CONFIG, storage });
  const restored = await run(port.restoreSession());
  expect(restored).toEqual({ ok: true, value: { userId: 'alice', accessToken: 'fresh-access' } });
});

test('the production port retires this device’s session even though the provider sign-out failed', async () => {
  const storage = await seeded();
  const port = createSupabaseAuthPort({ config: TEST_CONFIG, storage });
  const result = await run(port.signOut());
  // The provider's own answer is still reported: it did fail.
  expect(result.ok).toBe(false);
  for (const key of supabaseSessionStorageKeys(KEY)) expect(await storage.getItem(key)).toBeNull();
});

test('after that failed sign-out, the next app start is SIGNED OUT — not restored, not "session ended" — even with the network back', async () => {
  const storage = await seeded();
  // INACTIVE: the SDK's auto-refresh ticker is never started, so no interval outlives the test.
  const foreground = createManualForegroundSignal('INACTIVE');

  // Launch 1: the reader is restored with a refreshed session... then the network drops and they sign out.
  network.up = true;
  const first = createMobileAuthAuthority({ port: createSupabaseAuthPort({ config: TEST_CONFIG, storage }), foreground });
  await run(first.start());
  expect(first.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'alice' });
  network.up = false;
  // Make the stored session need a refresh again, as it would after the access token lapsed.
  await storage.setItem(KEY, expiredSession());
  const signedOut = await run(first.signOut());
  expect(signedOut.ok).toBe(false);
  expect(first.getState()).toEqual({ kind: 'SIGNED_OUT' });
  first.dispose();

  // Launch 2: a new process over the same device storage, network back.
  network.up = true;
  network.calls = [];
  const second = createMobileAuthAuthority({ port: createSupabaseAuthPort({ config: TEST_CONFIG, storage }), foreground });
  await run(second.start());
  expect(second.getState()).toEqual({ kind: 'SIGNED_OUT' });
  // Nothing was even attempted: there was no session left to refresh.
  expect(network.calls.filter((url) => url.includes('/token'))).toEqual([]);
  second.dispose();
});

test('a successful sign-out also leaves nothing behind, and a later explicit sign-in works', async () => {
  const storage = createEphemeralAuthSessionStorage();
  network.up = true;
  const port = createSupabaseAuthPort({ config: TEST_CONFIG, storage });
  await storage.setItem(KEY, expiredSession());
  expect((await run(port.restoreSession())).ok).toBe(true);
  expect((await run(port.signOut())).ok).toBe(true);
  expect(await storage.getItem(KEY)).toBeNull();

  const authority = createMobileAuthAuthority({ port: createSupabaseAuthPort({ config: TEST_CONFIG, storage }), foreground: createManualForegroundSignal('INACTIVE') });
  await run(authority.start());
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  const signedIn = await run(authority.signInWithPassword('alice@example.test', 'secret'));
  expect(signedIn.ok).toBe(true);
  expect(authority.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'alice' });
  expect(await storage.getItem(KEY)).not.toBeNull();
  authority.dispose();
});

/** The one `/logout` request a sign-out made, with the network up and a live session. */
async function logoutRequestOf(signOut: (storage: AuthSessionStorage) => Promise<unknown>): Promise<string> {
  const storage = await seeded();
  network.up = true;
  const port = createSupabaseAuthPort({ config: TEST_CONFIG, storage });
  await run(port.restoreSession());
  network.calls = [];
  await run(signOut(storage));
  const logout = network.calls.filter((url) => url.includes('/logout'));
  expect(logout).toHaveLength(1);
  return logout[0];
}

test('W3-01 R1 NON-VACUITY — the SDK’s default sign-out, with no scope, asks the provider for GLOBAL', async () => {
  // So "not others" proves nothing: an omitted scope would also end the reader's other devices.
  const request = await logoutRequestOf((storage) =>
    createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabasePublishableKey, { auth: { storage, storageKey: KEY, ...SUPABASE_AUTH_OPTIONS } }).auth.signOut());
  expect(request).toMatch(/\/logout\?scope=global$/u);
});

test('W3-01 R1 — the final Sign out is THIS session on THIS device only: the provider is asked for LOCAL scope', async () => {
  let succeeded = false;
  const request = await logoutRequestOf(async (storage) => {
    succeeded = (await createSupabaseAuthPort({ config: TEST_CONFIG, storage }).signOut()).ok;
  });
  expect(succeeded).toBe(true);
  expect(request).toBe(`${TEST_CONFIG.supabaseUrl}/auth/v1/logout?scope=local`);
});
