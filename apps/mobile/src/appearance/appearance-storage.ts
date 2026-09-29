/**
 * W3-01 — the appearance preference, kept on THIS device, per identity.
 *
 * > **Device-local. Namespaced by identity. Its own database. No server, no migration, no sync.**
 *
 * Cross-device sync of the preference is not frozen by any authority, so W3-01 keeps it here and nowhere
 * else. The mechanism is the officially documented `expo-sqlite/kv-store` both the auth store and the T-13
 * recovery store already use, so no persistence library is introduced — in its OWN database file, so it can
 * never read or clobber session material or a recovery record through an unrelated key.
 *
 * The synchronous operations are used deliberately: the preference is one short word, and reading it in the
 * same turn the identity is bound means a reader who chose Light never sees their world painted Dark first.
 *
 * Every key is derived from the authenticated owner's user id, so identity B reads B's key and can never be
 * handed A's choice; signing out deletes nothing, and A's choice is there again at A's next sign-in.
 */
import { SQLiteStorage } from 'expo-sqlite/kv-store';

import { isAppearancePreference, type AppearancePreference, type AppearancePreferenceStore } from './appearance-authority';

/** Its OWN database file — neither the auth store's nor the recovery store's. */
export const APPEARANCE_DATABASE_NAME = 'qandeel-appearance.db';

/** The key prefix. The owner's identity locator follows it, so each identity is its own namespace. */
export const APPEARANCE_KEY_PREFIX = 'qandeel.appearance.v1:';

/** The namespace key of one owner. There is no anonymous namespace: signed out is the default, not a key. */
export function appearanceKeyFor(userId: string): string {
  if (typeof userId !== 'string' || userId.length === 0) throw new RangeError('an appearance preference requires an authenticated owner identity');
  return `${APPEARANCE_KEY_PREFIX}${userId}`;
}

/**
 * The production store: two operations over the appearance database, and nothing else. The database is
 * opened on first use, so a host that never binds an identity never opens it.
 */
export function createAppearancePreferenceStore(databaseName: string = APPEARANCE_DATABASE_NAME): AppearancePreferenceStore {
  let storage: SQLiteStorage | null = null;
  const open = () => (storage ??= new SQLiteStorage(databaseName));
  return {
    read(userId) {
      const value = open().getItemSync(appearanceKeyFor(userId));
      return isAppearancePreference(value) ? value : null;
    },
    write(userId, preference) {
      open().setItemSync(appearanceKeyFor(userId), preference);
    },
  };
}

/** An in-memory store with the same contract, for the focused tests and any host without SQLite. */
export function createEphemeralAppearancePreferenceStore(initial: Readonly<Record<string, AppearancePreference>> = {}): AppearancePreferenceStore {
  const values = new Map<string, AppearancePreference>(Object.entries(initial).map(([userId, value]) => [appearanceKeyFor(userId), value]));
  return {
    read: (userId) => values.get(appearanceKeyFor(userId)) ?? null,
    write: (userId, preference) => {
      values.set(appearanceKeyFor(userId), preference);
    },
  };
}
