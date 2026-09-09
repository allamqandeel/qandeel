/**
 * T-12P §2.4 — the authentication session store. PRIVATE to the runtime-entry layer.
 *
 * This holds AUTHENTICATION MATERIAL ONLY: whatever `@supabase/supabase-js` serialises for a
 * session — the access token, the refresh token and their expiry. It is not, and must never become,
 * Product persistence. `CanonicalState`, the camera, TC/PTC, RH, inspection, Live Focus, Return
 * state, the disclosure cache and the QANDEEL conversation `sessionId` are all owned by T-13 and
 * none of them may be written here. The store is keyed and namespaced so that is checkable: the
 * auth database holds Supabase's own keys and nothing this repository writes by hand.
 *
 * WHY THIS MECHANISM. `expo-sqlite/kv-store` is the current official Supabase-on-Expo storage
 * recommendation: Supabase's Expo quickstart and Expo's own Supabase guide both route session
 * storage through `expo-sqlite`, and its exported `SQLiteStorage` is documented as a drop-in
 * replacement for `@react-native-async-storage/async-storage`. The contract requires following that
 * guidance and forbids inventing cryptography where an official maintained adapter exists.
 *
 * WHAT THAT COSTS, STATED PLAINLY. This storage is NOT encrypted at rest. `expo-secure-store` is
 * keystore-backed but Supabase's own guidance does not use it for sessions, because a serialised
 * session can exceed SecureStore's value-size limit; Supabase's published workaround splits the
 * value and encrypts it with hand-rolled AES, which is exactly the custom cryptography §2.4
 * forbids. So the honest v1 position is: follow official guidance, isolate the store, and put the
 * hardening question to the Security review rather than answer it by improvisation. Every use of
 * this module goes through the single adapter below, so changing the mechanism is a one-file change.
 */
import { SQLiteStorage } from 'expo-sqlite/kv-store';

/**
 * The auth store gets its OWN database file rather than sharing a general-purpose one, so nothing
 * else in the app can read or clobber session material through an unrelated key.
 */
export const AUTH_SESSION_DATABASE_NAME = 'qandeel-auth-session.db';

/**
 * The storage shape `@supabase/supabase-js` accepts for `auth.storage`. Declared structurally here
 * rather than imported so this module states its own contract and the tests can substitute a
 * plain in-memory double without the SDK.
 */
export interface AuthSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The production adapter. It exposes exactly the three operations Supabase needs and nothing else,
 * so the broader SQLite surface — `clear`, `getAllKeys`, `multiSet`, raw SQL — is unreachable from
 * anywhere in the app through this seam.
 */
export function createAuthSessionStorage(databaseName: string = AUTH_SESSION_DATABASE_NAME): AuthSessionStorage {
  const store = new SQLiteStorage(databaseName);
  return {
    getItem: (key) => store.getItemAsync(key),
    setItem: (key, value) => store.setItemAsync(key, value),
    removeItem: async (key) => {
      await store.removeItemAsync(key);
    },
  };
}

/**
 * An in-memory store with the same contract. Used by the focused tests, and by any environment
 * where persisting a session would be wrong. It is exported because a caller choosing NOT to
 * persist credentials should be able to say so explicitly rather than by omission.
 */
export function createEphemeralAuthSessionStorage(): AuthSessionStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}
