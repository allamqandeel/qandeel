import { createCanonicalStore, opaqueRef, sessionPosition, type CanonicalStateInit, type CanonicalStore } from '../../state';
import { applyCommittedUnitsEvent, applyCommittedUnitsPage, applyDecodedCommittedUnitsEvent } from '../live-head-sync';
import { decodeCommittedUnitsEvent } from '../temporal-wire';

const SP = sessionPosition;

function init(overrides: Partial<CanonicalStateInit> = {}): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'WORLD' },
    ...overrides,
  };
}

const event = (overrides: Record<string, unknown> = {}) => ({
  type: 'CONVERSATIONAL_UNITS_COMMITTED',
  version: 1,
  sessionId: 'session-1',
  batchId: 'batch-1',
  sourceTurnId: 'turn-1',
  firstSp: 1,
  lastSp: 1,
  unitCount: 1,
  ...overrides,
});

function decoded(overrides: Record<string, unknown> = {}) {
  const result = decodeCommittedUnitsEvent(event(overrides));
  if (!result.ok) throw new Error(`fixture is not a valid wire event: ${result.detail}`);
  return result.value;
}

describe('CONVERSATIONAL_UNITS_COMMITTED -> LIVE_HEAD_ADVANCED', () => {
  let store: CanonicalStore;
  beforeEach(() => {
    store = createCanonicalStore(init());
  });

  it('mirrors the block head exactly once: 20..23 advances LH to 23', () => {
    expect(applyCommittedUnitsEvent(store, event({ firstSp: 20, lastSp: 23, unitCount: 4 })))
      .toEqual({ outcome: 'APPLIED', toSp: 23 });
    expect(store.getState().live.LH).toBe(SP(23));
  });

  it('establishes the first Live Head from the technical absence sentinel', () => {
    expect(store.getState().live.LH).toBeNull();
    expect(applyCommittedUnitsEvent(store, event()).outcome).toBe('APPLIED');
    expect(store.getState().live.LH).toBe(SP(1));
  });

  it('never mutates LH directly and never appends RH or touches any Product field', () => {
    const before = store.getState();
    applyCommittedUnitsEvent(store, event({ firstSp: 4, lastSp: 6, unitCount: 3 }));
    const after = store.getState();
    expect(after.live.LH).toBe(SP(6));
    // The mirror is the ONLY thing that moved.
    expect(after.history).toBe(before.history);
    expect(after.history).toHaveLength(0);
    expect(after.temporal).toBe(before.temporal);
    expect(after.inspection).toBe(before.inspection);
    expect(after.camera).toBe(before.camera);
    expect(after.live.LF).toBe(before.live.LF);
    expect(after.session).toBe(before.session);
  });

  it('is idempotent for a redelivered current head', () => {
    applyCommittedUnitsEvent(store, event({ firstSp: 1, lastSp: 3, unitCount: 3 }));
    const settled = store.getState();
    expect(applyCommittedUnitsEvent(store, event({ firstSp: 1, lastSp: 3, unitCount: 3 })))
      .toEqual({ outcome: 'IDEMPOTENT', toSp: 3 });
    expect(store.getState()).toBe(settled);
  });

  it('classifies a stale lower-SP delivery and never retracts the mirrored head', () => {
    applyCommittedUnitsEvent(store, event({ firstSp: 5, lastSp: 7, unitCount: 3 }));
    const settled = store.getState();
    expect(applyCommittedUnitsEvent(store, event({ batchId: 'batch-old', firstSp: 1, lastSp: 2, unitCount: 2 })))
      .toEqual({ outcome: 'STALE', toSp: 2 });
    expect(store.getState()).toBe(settled);
    expect(store.getState().live.LH).toBe(SP(7));
  });

  it('rejects an event addressed to another Session', () => {
    const outcome = applyCommittedUnitsEvent(store, event({ sessionId: 'session-2' }));
    expect(outcome).toMatchObject({ outcome: 'REJECTED', reason: 'SESSION_MISMATCH' });
    expect(store.getState().live.LH).toBeNull();
  });

  it('rejects untrusted transport input before it reaches the kernel', () => {
    for (const payload of [event({ unitCount: 9 }), event({ firstSp: 0 }), { type: 'LIVE_HEAD_ADVANCED', toSp: 3 }, null]) {
      const outcome = applyCommittedUnitsEvent(store, payload);
      expect(outcome.outcome).toBe('REJECTED');
    }
    expect(store.getState().live.LH).toBeNull();
  });

  it('never dispatches a Product action: the store dispatch seam is untouched', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    applyCommittedUnitsEvent(store, event({ firstSp: 2, lastSp: 2, unitCount: 1 }));
    applyCommittedUnitsEvent(store, event({ sessionId: 'other' }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('applies an ordered page and stops at the first payload that never becomes truth', () => {
    const outcomes = applyCommittedUnitsPage(store, [
      decoded({ batchId: 'a', firstSp: 1, lastSp: 2, unitCount: 2 }),
      decoded({ batchId: 'b', firstSp: 3, lastSp: 3, unitCount: 1 }),
    ]);
    expect(outcomes.map((entry) => entry.outcome)).toEqual(['APPLIED', 'APPLIED']);
    expect(store.getState().live.LH).toBe(SP(3));

    const halted = applyCommittedUnitsPage(store, [
      decoded({ batchId: 'c', sessionId: 'session-2', firstSp: 4, lastSp: 4, unitCount: 1 }),
      decoded({ batchId: 'd', firstSp: 5, lastSp: 5, unitCount: 1 }),
    ]);
    expect(halted).toHaveLength(1);
    expect(halted[0]?.outcome).toBe('REJECTED');
    expect(store.getState().live.LH).toBe(SP(3));
  });

  it('accepts an already decoded event through the same seam', () => {
    expect(applyDecodedCommittedUnitsEvent(store, decoded({ firstSp: 9, lastSp: 9, unitCount: 1 })))
      .toEqual({ outcome: 'APPLIED', toSp: 9 });
  });

  it('leaves LF exactly as the T-02 kernel had it: T-03A2 delivers LH only', () => {
    const before = store.getState().live.LF;
    applyCommittedUnitsEvent(store, event({ firstSp: 1, lastSp: 4, unitCount: 4 }));
    const after = store.getState().live.LF;
    expect(after).toBe(before);
    expect(after.value).toEqual({ kind: 'NONE' });
    expect(after.atSp).toBeNull();
  });
});
