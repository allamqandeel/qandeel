/**
 * T-13 S01…S14 — the Product recovery store: separate, namespaced, atomic, serialized, fail-closed.
 */
import {
  PRODUCT_RECOVERY_DATABASE_NAME,
  PRODUCT_RECOVERY_KEY_PREFIX,
  createEphemeralProductRecoveryStorage,
  createProductRecoveryStore,
  namespaceKeyFor,
} from '..';
import { OWNER_A, OWNER_B, SESSION_R, rawRecord, record, recordingStorage, seed } from '../__fixtures__/records';

describe('S01…S05 — namespace and separation', () => {
  it('S01 — the recovery database is its own file, not the auth store’s', () => {
    expect(PRODUCT_RECOVERY_DATABASE_NAME).toBe('qandeel-product-recovery.db');
    expect(PRODUCT_RECOVERY_DATABASE_NAME).not.toBe('qandeel-auth-session.db');
  });

  it('S02 — every record lives under a key derived from its owner, and there is no anonymous namespace', () => {
    expect(namespaceKeyFor(OWNER_A)).toBe(`${PRODUCT_RECOVERY_KEY_PREFIX}${OWNER_A}`);
    expect(namespaceKeyFor(OWNER_A)).not.toBe(namespaceKeyFor(OWNER_B));
    expect(() => namespaceKeyFor('')).toThrow(RangeError);
  });

  it('S03 — an owner with nothing stored gets NO_RECORD and touches no other owner’s key', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_B, rawRecord({ owner: OWNER_B }));
    expect(await store.load(OWNER_A)).toEqual({ kind: 'NO_RECORD' });
    expect(storage.log.map((entry) => entry.key)).toEqual([namespaceKeyFor(OWNER_B), namespaceKeyFor(OWNER_A)]);
  });

  it('S04 — A’s record is invisible to B: B’s load never reads A’s key and never returns A’s Session', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    expect((await store.write(record({ owner: OWNER_A }))).kind).toBe('COMMITTED');
    storage.log.length = 0;
    const loaded = await store.load(OWNER_B);
    expect(loaded).toEqual({ kind: 'NO_RECORD' });
    expect(storage.log).toEqual([{ op: 'get', key: namespaceKeyFor(OWNER_B) }]);
    // A's record is still exactly where it was.
    const a = await store.load(OWNER_A);
    expect(a.kind).toBe('RECORD');
    if (a.kind === 'RECORD') expect(a.record.sessionId).toBe(SESSION_R);
  });

  it('S05 — a record under one owner’s key that names another owner is refused as OWNER_MISMATCH', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_A, rawRecord({ owner: OWNER_B }));
    const loaded = await store.load(OWNER_A);
    expect(loaded.kind).toBe('INVALID');
    if (loaded.kind === 'INVALID') expect(loaded.reason).toBe('OWNER_MISMATCH');
  });
});

describe('S06…S10 — fail-closed loads', () => {
  it('S06 — a corrupt payload is INVALID, never repaired', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_A, '{"schemaVersion":1,"ownerUserId":"user-a"');
    const loaded = await store.load(OWNER_A);
    expect(loaded.kind).toBe('INVALID');
    if (loaded.kind === 'INVALID') expect(loaded.reason).toBe('MALFORMED_PAYLOAD');
  });

  it('S07 — an unknown future schema version is INVALID / INCOMPATIBLE_SCHEMA', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_A, { ...rawRecord(), schemaVersion: 99 });
    const loaded = await store.load(OWNER_A);
    expect(loaded.kind).toBe('INVALID');
    if (loaded.kind === 'INVALID') expect(loaded.reason).toBe('INCOMPATIBLE_SCHEMA');
  });

  it('S08 — a semantically invalid record is INVALID with the codec’s reason, and nothing of it is loaded', async () => {
    const storage = createEphemeralProductRecoveryStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_A, { ...rawRecord(), sessionId: 'session-1' });
    const loaded = await store.load(OWNER_A);
    expect(loaded).toEqual({ kind: 'INVALID', reason: 'INVALID_SESSION', detail: expect.any(String) });
  });

  it('S09 — a storage that cannot be read is UNAVAILABLE, never NO_RECORD', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    await seed(storage, OWNER_A, rawRecord());
    storage.failReads('database locked');
    const loaded = await store.load(OWNER_A);
    expect(loaded).toEqual({ kind: 'UNAVAILABLE', detail: 'database locked' });
    // The chain survives a refusal: the next operation still runs.
    storage.failReads(null);
    expect((await store.load(OWNER_A)).kind).toBe('RECORD');
  });

  it('S10 — the store never writes an invalid record, so it cannot manufacture a corrupt payload', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    const outcome = await store.write({ ...record(), sessionId: 'not-a-uuid' });
    expect(outcome.kind).toBe('FAILED');
    expect(storage.log.filter((entry) => entry.op === 'set')).toEqual([]);
  });
});

describe('S11…S14 — atomic, serialized, monotonic writes', () => {
  it('S11 — a write is ONE value under ONE key, and a load reads it back exactly', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    const written = record({ sequence: 4 });
    expect(await store.write(written)).toEqual({ kind: 'COMMITTED', sequence: 4 });
    const sets = storage.log.filter((entry) => entry.op === 'set');
    expect(sets).toHaveLength(1);
    expect(sets[0].key).toBe(namespaceKeyFor(OWNER_A));
    const loaded = await store.load(OWNER_A);
    expect(loaded).toEqual({ kind: 'RECORD', record: written });
  });

  it('S12 — an older sequence can never overwrite a newer committed snapshot', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    expect((await store.write(record({ sequence: 5 }))).kind).toBe('COMMITTED');
    expect(await store.write(record({ sequence: 3 }))).toEqual({ kind: 'SUPERSEDED', sequence: 3, latest: 5 });
    expect(await store.write(record({ sequence: 5 }))).toEqual({ kind: 'SUPERSEDED', sequence: 5, latest: 5 });
    expect(storage.log.filter((entry) => entry.op === 'set')).toHaveLength(1);
    // A load seeds the gate too: a second process that loaded sequence 5 refuses its own stale 2.
    const second = createProductRecoveryStore(storage);
    expect((await second.load(OWNER_A)).kind).toBe('RECORD');
    expect((await second.write(record({ sequence: 2 }))).kind).toBe('SUPERSEDED');
    expect((await second.write(record({ sequence: 6 }))).kind).toBe('COMMITTED');
  });

  it('S13 — writes are serialized: a slow earlier write cannot land after a later one', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    const held = storage.holdNextWrite();
    const first = store.write(record({ sequence: 1 }));
    const second = store.write(record({ sequence: 2 }));
    // Nothing has landed while the first write is held open — including the second, which waits.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storage.log.filter((entry) => entry.op === 'set')).toHaveLength(0);
    held.release();
    expect((await first).kind).toBe('COMMITTED');
    expect((await second).kind).toBe('COMMITTED');
    const sets = storage.log.filter((entry) => entry.op === 'set');
    expect(sets.map((entry) => (JSON.parse(entry.value as string) as { sequence: number }).sequence)).toEqual([1, 2]);
    const loaded = await store.load(OWNER_A);
    if (loaded.kind !== 'RECORD') throw new Error('unreachable');
    expect(loaded.record.sequence).toBe(2);
  });

  it('S14 — `admit` is re-asked inside the serialized section: a retired writer commits nothing', async () => {
    const storage = recordingStorage();
    const store = createProductRecoveryStore(storage);
    let current = true;
    const held = storage.holdNextWrite();
    const first = store.write(record({ sequence: 1 }), { admit: () => current });
    const second = store.write(record({ sequence: 2 }), { admit: () => current });
    // Let the first write enter the serialized section (and pass its admission) before retiring.
    await new Promise((resolve) => setTimeout(resolve, 0));
    current = false;
    held.release();
    // The first write had already passed its admission check before it was held open; the second
    // asks again when its turn comes, after the retirement, and writes nothing.
    expect((await first).kind).toBe('COMMITTED');
    expect((await second).kind).toBe('SKIPPED');
    expect(storage.log.filter((entry) => entry.op === 'set')).toHaveLength(1);
    // `clear` makes the boundary independently clearable.
    await store.clear(OWNER_A);
    expect(await store.load(OWNER_A)).toEqual({ kind: 'NO_RECORD' });
  });
});
