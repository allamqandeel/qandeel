/**
 * T-13 W01…W08 — the writer advances the durable snapshot from the ONE store, on effective acts only.
 */
import { canonicalWorldAddress, initialCameraIntent, worldAnchorRef } from '../../map';
import { createCanonicalStore, sessionPosition, type CanonicalStore } from '../../state';
import { attachRecoveryWriter, createProductRecoveryStore, namespaceKeyFor } from '..';
import { OWNER_A, SESSION_R, recordingStorage } from '../__fixtures__/records';

function liveStore(liveHead: number | null = 4): CanonicalStore {
  return createCanonicalStore({
    session: { id: SESSION_R },
    live: { LH: liveHead === null ? null : sessionPosition(liveHead), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: initialCameraIntent(),
  });
}

const pan = (store: CanonicalStore, x: bigint) => {
  const address = canonicalWorldAddress(x, 0n);
  if (!address.ok) throw new Error('fixture address');
  return store.dispatch({ type: 'PAN', to: { anchor: worldAnchorRef(address.address) } });
};

const stored = (storage: ReturnType<typeof recordingStorage>) => {
  const text = storage.values.get(namespaceKeyFor(OWNER_A));
  return text === undefined ? null : (JSON.parse(text) as { sessionId: string; sequence: number; viewpoint: { temporal: { kind: string; at?: number }; history: unknown[] } });
};

function attach(store: CanonicalStore, storage = recordingStorage(), startSequence = 0, isCurrent: () => boolean = () => true) {
  const recovery = createProductRecoveryStore(storage);
  const writer = attachRecoveryWriter({ store, recovery, ownerUserId: OWNER_A, sessionId: SESSION_R, isCurrent, startSequence });
  return { storage, writer };
}

describe('W01…W08', () => {
  it('W01 — the recovery locator is written at attach, before any act, naming the Session and the entry viewpoint', async () => {
    const { storage, writer } = attach(liveStore());
    await writer.settled();
    expect(writer.status()).toMatchObject({ issued: 1, committed: 1, lastSequence: 1 });
    const record = stored(storage);
    expect(record?.sessionId).toBe(SESSION_R);
    expect(record?.viewpoint.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(record?.viewpoint.history).toEqual([]);
  });

  it('W02 — a Live Head advance or a Live Focus transition issues NO write and copies nothing', async () => {
    const store = liveStore(4);
    const { storage, writer } = attach(store);
    await writer.settled();
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(9) }).outcome).toBe('APPLIED');
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 't-1' }, atSp: sessionPosition(9) }).outcome).toBe('APPLIED');
    await writer.settled();
    expect(writer.status().issued).toBe(1);
    expect(storage.values.get(namespaceKeyFor(OWNER_A))).not.toContain('"LH"');
    expect(storage.values.get(namespaceKeyFor(OWNER_A))).not.toContain('t-1');
  });

  it('W03 — an effective act advances the snapshot, with the sequence strictly increasing', async () => {
    const store = liveStore(4);
    const { storage, writer } = attach(store);
    expect(pan(store, 10n).outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(2) }).outcome).toBe('APPLIED');
    await writer.settled();
    expect(writer.status()).toMatchObject({ issued: 3, committed: 3, lastSequence: 3 });
    const record = stored(storage);
    expect(record?.sequence).toBe(3);
    expect(record?.viewpoint.temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(record?.viewpoint.history).toHaveLength(2);
  });

  it('W04 — a true no-op act writes nothing: the persisted subset did not change', async () => {
    const store = liveStore(4);
    const { writer } = attach(store);
    await writer.settled();
    // Committing the Live Edge while already following Live is a no-op in the kernel.
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    await writer.settled();
    expect(writer.status().issued).toBe(1);
  });

  it('W05 — writes continue strictly above the sequence a resumed record carried', async () => {
    const store = liveStore(4);
    const { storage, writer } = attach(store, recordingStorage(), 41);
    await writer.settled();
    expect(stored(storage)?.sequence).toBe(42);
    pan(store, 5n);
    await writer.settled();
    expect(stored(storage)?.sequence).toBe(43);
  });

  it('W06 — a retired writer observes nothing more, and a write queued before retirement never commits', async () => {
    const store = liveStore(4);
    const storage = recordingStorage();
    let current = true;
    const { writer } = attach(store, storage, 0, () => current);
    await writer.settled();
    const held = storage.holdNextWrite();
    pan(store, 7n);
    // Retired while that write waits in the chain.
    current = false;
    writer.retire();
    held.release();
    await writer.settled();
    pan(store, 8n);
    await writer.settled();
    expect(writer.status()).toMatchObject({ attached: false, issued: 2, committed: 1, skipped: 1 });
    expect(stored(storage)?.viewpoint.history).toEqual([]);
  });

  it('W07 — out-of-order storage completion cannot leave an older snapshot as the record', async () => {
    const store = liveStore(4);
    const storage = recordingStorage();
    const { writer } = attach(store, storage);
    await writer.settled();
    const held = storage.holdNextWrite();
    pan(store, 1n);
    pan(store, 2n);
    pan(store, 3n);
    held.release();
    await writer.settled();
    const sets = storage.log.filter((entry) => entry.op === 'set').map((entry) => (JSON.parse(entry.value as string) as { sequence: number }).sequence);
    expect(sets).toEqual([1, 2, 3, 4]);
    expect(stored(storage)?.sequence).toBe(4);
    expect(stored(storage)?.viewpoint.history).toHaveLength(3);
  });

  it('W08 — the store is never blocked: a held write does not delay the act that caused it', async () => {
    const store = liveStore(4);
    const storage = recordingStorage();
    const { writer } = attach(store, storage);
    await writer.settled();
    const held = storage.holdNextWrite();
    const before = store.getState();
    const outcome = pan(store, 9n);
    // The act has already published while the write is still held open.
    expect(outcome.outcome).toBe('APPLIED');
    expect(store.getState()).not.toBe(before);
    held.release();
    await writer.settled();
    expect(writer.status().committed).toBe(2);
  });
});
