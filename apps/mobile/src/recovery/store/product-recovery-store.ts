/**
 * T-13 §2 / §4 / §15 — the Product recovery persistence boundary.
 *
 * > **Separate from auth. Namespaced by identity. Atomic per record. Serialized per store.**
 *
 * ## Separate from auth, by construction
 *
 * The auth store (`runtime-entry/auth/auth-session-storage.ts`) holds Supabase's own session material
 * under Supabase's own keys in `qandeel-auth-session.db`. This store holds the Product recovery record
 * under this module's own keys in a DIFFERENT database file. Nothing here names a token, a refresh
 * token, a provider or a credential; nothing there names a Session locator, a viewpoint or a
 * checkpoint. The two are independently testable and independently clearable, and a static contract
 * proves that each module stays free of the other's vocabulary.
 *
 * The mechanism is the same officially documented one the auth store already uses — `expo-sqlite`'s
 * `kv-store` — so no persistence library is introduced. The adapter exposes exactly three operations,
 * so `clear`, `getAllKeys`, `multiSet` and raw SQL are unreachable from anywhere in the app through it.
 *
 * ## Namespaced by identity
 *
 * Every record lives under a key derived from the authenticated owner's user id, and the record inside
 * it names that owner again. A load for identity B reads B's key and would still refuse a record that
 * named A. Sign-out deletes nothing: A's record stays durably stored and simply cannot be reached until
 * A is authenticated again — there is no path from a signed-out or foreign runtime to it.
 *
 * ## Atomic and serialized
 *
 * One record is one value under one key, written in one `setItem`: there is no partial record to read.
 * Every write and every load goes through ONE promise chain per store, so two writes can never
 * interleave and a load never observes a write in flight. On top of the ordering, each record carries a
 * monotonic `sequence`, and a write whose sequence is not greater than the last one COMMITTED for that
 * owner is refused as superseded — so an older async write that resolves late can never overwrite a
 * newer snapshot, whatever the storage's own timing. On crash, the last committed record is the
 * recovery source of record.
 */
import { SQLiteStorage } from 'expo-sqlite/kv-store';

import {
  decodeProductRecoveryRecord,
  encodeProductRecoveryRecord,
  migrateRecoveryRecord,
  parseProductRecoveryPayload,
  type ProductRecoveryRecord,
  type RecoveryMigrationRejection,
  type RecoveryRecordRejection,
} from '../schema';

/** Its OWN database file, deliberately not the auth store's. */
export const PRODUCT_RECOVERY_DATABASE_NAME = 'qandeel-product-recovery.db';

/** The key prefix. The owner's identity locator follows it, so each identity is its own namespace. */
export const PRODUCT_RECOVERY_KEY_PREFIX = 'qandeel.product.recovery.v1:';

/** The storage contract, declared structurally so tests can substitute a plain in-memory double. */
export interface ProductRecoveryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The production adapter: three operations over the recovery database, and nothing else. */
export function createProductRecoveryStorage(databaseName: string = PRODUCT_RECOVERY_DATABASE_NAME): ProductRecoveryStorage {
  const store = new SQLiteStorage(databaseName);
  return {
    getItem: (key) => store.getItemAsync(key),
    setItem: (key, value) => store.setItemAsync(key, value),
    removeItem: async (key) => {
      await store.removeItemAsync(key);
    },
  };
}

/** An in-memory storage with the same contract, for the focused tests and for any host without SQLite. */
export function createEphemeralProductRecoveryStorage(): ProductRecoveryStorage {
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

/** The namespace key of one owner. An empty owner is refused: there is no anonymous namespace. */
export function namespaceKeyFor(ownerUserId: string): string {
  if (typeof ownerUserId !== 'string' || ownerUserId.length === 0) throw new RangeError('a recovery namespace requires an authenticated owner identity');
  return `${PRODUCT_RECOVERY_KEY_PREFIX}${ownerUserId}`;
}

export type RecoveryLoadRejection = RecoveryRecordRejection | RecoveryMigrationRejection | 'OWNER_MISMATCH';

export type RecoveryLoadOutcome =
  /** Nothing is stored for this owner. The clean fresh-Session path applies. */
  | { readonly kind: 'NO_RECORD' }
  | { readonly kind: 'RECORD'; readonly record: ProductRecoveryRecord }
  /** Something is stored and it is not usable. Recovery must fail closed, never guess. */
  | { readonly kind: 'INVALID'; readonly reason: RecoveryLoadRejection; readonly detail: string }
  /** The storage itself could not answer. Whether a record exists is unknown, so nothing may be assumed. */
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

export type RecoveryWriteOutcome =
  | { readonly kind: 'COMMITTED'; readonly sequence: number }
  /** A newer snapshot for this owner was already committed; this older one was not written. */
  | { readonly kind: 'SUPERSEDED'; readonly sequence: number; readonly latest: number }
  /** The caller's own guard said the writing runtime is no longer current. Nothing was written. */
  | { readonly kind: 'SKIPPED' }
  | { readonly kind: 'FAILED'; readonly detail: string };

export interface RecoveryWriteOptions {
  /**
   * Re-checked inside the serialized section, immediately before the write. A runtime generation that
   * was retired while this write waited in the queue writes nothing — late work from a retired identity
   * never commits, exactly as the live driver's own gate refuses a late canonical write.
   */
  readonly admit?: () => boolean;
}

export interface ProductRecoveryStore {
  /** The owner's record, validated end to end, or the exact reason there is none usable. */
  load(ownerUserId: string): Promise<RecoveryLoadOutcome>;
  /** Commit one whole record for its owner, in order, unless superseded or no longer admitted. */
  write(record: ProductRecoveryRecord, options?: RecoveryWriteOptions): Promise<RecoveryWriteOutcome>;
  /** Remove one owner's record. Provided so the boundary is independently clearable; no Product act calls it. */
  clear(ownerUserId: string): Promise<void>;
}

const describe = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback);

/**
 * The store over one storage. Production passes nothing and gets the SQLite adapter; the tests pass the
 * in-memory one, so the consumer never names the storage mechanism at all.
 */
export function createProductRecoveryStore(storage: ProductRecoveryStorage = createProductRecoveryStorage()): ProductRecoveryStore {
  /** The last sequence COMMITTED per owner in this process. Seeded by a load, advanced by a commit. */
  const committed = new Map<string, number>();
  /** The one chain every operation joins. A rejected step never breaks the chain for the next one. */
  let tail: Promise<unknown> = Promise.resolve();

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation, operation);
    tail = next.catch(() => undefined);
    return next;
  }

  return {
    load(ownerUserId) {
      return serialized(async (): Promise<RecoveryLoadOutcome> => {
        const key = namespaceKeyFor(ownerUserId);
        let text: string | null;
        try {
          text = await storage.getItem(key);
        } catch (cause) {
          return { kind: 'UNAVAILABLE', detail: describe(cause, 'the recovery storage could not be read') };
        }
        if (text === null) return { kind: 'NO_RECORD' };

        const parsed = parseProductRecoveryPayload(text);
        if (!parsed.ok) return { kind: 'INVALID', reason: 'MALFORMED_PAYLOAD', detail: parsed.detail };
        const migrated = migrateRecoveryRecord(parsed.value);
        if (!migrated.ok) return { kind: 'INVALID', reason: migrated.reason, detail: migrated.detail };
        const decoded = decodeProductRecoveryRecord(migrated.record);
        if (!decoded.ok) return { kind: 'INVALID', reason: decoded.reason, detail: decoded.detail };
        // The namespace already selected this owner; the record must AGREE, or it is not this reader's.
        if (decoded.record.ownerUserId !== ownerUserId) {
          return { kind: 'INVALID', reason: 'OWNER_MISMATCH', detail: 'the stored record names a different owner than its namespace' };
        }
        const known = committed.get(key);
        if (known === undefined || decoded.record.sequence > known) committed.set(key, decoded.record.sequence);
        return { kind: 'RECORD', record: decoded.record };
      });
    },

    write(record, options = {}) {
      return serialized(async (): Promise<RecoveryWriteOutcome> => {
        // The same strict decoder guards the write: an unencodable or malformed record is never stored,
        // so a corrupt payload cannot be produced by this code path at all.
        const decoded = decodeProductRecoveryRecord(JSON.parse(encodeProductRecoveryRecord(record)) as unknown);
        if (!decoded.ok) return { kind: 'FAILED', detail: `refusing to write an invalid record: ${decoded.detail}` };
        const key = namespaceKeyFor(record.ownerUserId);
        const latest = committed.get(key);
        if (latest !== undefined && record.sequence <= latest) return { kind: 'SUPERSEDED', sequence: record.sequence, latest };
        if (options.admit !== undefined && !options.admit()) return { kind: 'SKIPPED' };
        try {
          await storage.setItem(key, encodeProductRecoveryRecord(decoded.record));
        } catch (cause) {
          return { kind: 'FAILED', detail: describe(cause, 'the recovery storage could not be written') };
        }
        committed.set(key, record.sequence);
        return { kind: 'COMMITTED', sequence: record.sequence };
      });
    },

    clear(ownerUserId) {
      return serialized(async () => {
        const key = namespaceKeyFor(ownerUserId);
        await storage.removeItem(key);
        committed.delete(key);
      });
    },
  };
}
