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
 * WHY THIS MECHANISM. `expo-sqlite/kv-store` is one of the officially documented Supabase-on-Expo
 * storage routes: Supabase's Expo quickstart and Expo's own Supabase guide both route session
 * storage through `expo-sqlite`, and its exported `SQLiteStorage` is documented as a drop-in
 * replacement for `@react-native-async-storage/async-storage`. The contract requires following
 * official guidance and forbids inventing cryptography where a maintained adapter already exists.
 *
 * WHAT THAT COSTS, STATED PLAINLY. This storage is NOT encrypted at rest.
 *
 * The official guidance here is MIXED rather than settled, and saying otherwise would be false:
 * Supabase's client reference documents a SecureStore-backed `LargeSecureStore`, and Expo's auth
 * guide recommends `expo-secure-store` and states that AsyncStorage is not secure — while the
 * Supabase and Expo quickstarts both route sessions through `expo-sqlite`. What decides it for v1
 * is not which document is louder: Supabase's own published SecureStore pattern splits the value
 * and encrypts it with hand-rolled AES — exactly the custom cryptography §2.4 forbids. So v1
 * follows a documented route, isolates the store, and states the cost rather than improvising.
 *
 * AC-03 CORRECTION. That pattern is NOT justified by a fixed Expo limit, and this comment used to
 * imply it was. Expo documents no size limit of its own: it states that the underlying platform MAY
 * reject a large value, and that some historical iOS releases rejected values around 2048 bytes.
 * "A session does not fit in SecureStore" is therefore not a fact to reason from. What stands is
 * the narrower and sufficient reason above — the published workaround is hand-rolled cryptography.
 *
 * The boundary that makes this acceptable is stated above and must stay enforced: Product truth and
 * the QANDEEL conversation `sessionId` are forbidden from this store, so what sits here unencrypted
 * is Supabase's own session material and nothing else. `QAN-BL-T12-04` owns the production security
 * disposition and the physical-device validation of this adapter. Every use of this module goes
 * through the single adapter below, so changing the mechanism is a one-file change.
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
