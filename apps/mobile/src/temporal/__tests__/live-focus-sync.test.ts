import { createCanonicalStore, opaqueRef, sessionPosition, type CanonicalStateInit, type CanonicalStore } from '../../state';
import { applyCommittedUnitsEvent } from '../live-head-sync';
import {
  applyDecodedLiveFocusTransitionEvent,
  applyLiveFocusEventsPage,
  applyLiveFocusTransitionEvent,
  liveTruthFromSnapshot,
  toMirrorLiveFocus,
} from '../live-focus-sync';
import { decodeLiveFocusTransitionEvent } from '../temporal-wire';

const SP = sessionPosition;
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';

function init(overrides: Partial<CanonicalStateInit> = {}): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'WORLD' },
    ...overrides,
  };
}

const event = (overrides: Record<string, unknown> = {}) => ({
  type: 'LIVE_FOCUS_TRANSITION',
  version: 1,
  sessionId: 'session-1',
  atSp: 3,
  value: { kind: 'EMERGING', emergingFocusId: FOCUS },
  ...overrides,
});

function decoded(overrides: Record<string, unknown> = {}) {
  const result = decodeLiveFocusTransitionEvent(event(overrides));
  if (!result.ok) throw new Error(`fixture is not a valid wire event: ${result.detail}`);
  return result.value;
}

describe('LIVE_FOCUS_TRANSITION (wire) -> LIVE_FOCUS_TRANSITION (mirror)', () => {
  let store: CanonicalStore;
  beforeEach(() => {
    store = createCanonicalStore(init());
  });

  it('maps the closed wire vocabulary onto the frozen T-02 mirror vocabulary and nothing more', () => {
    expect(toMirrorLiveFocus({ kind: 'NONE' })).toEqual({ kind: 'NONE' });
    expect(toMirrorLiveFocus({ kind: 'EMERGING', emergingFocusId: FOCUS })).toEqual({ kind: 'EMERGING_FOCUS', emergingFocusId: FOCUS });
    expect(toMirrorLiveFocus({ kind: 'THREAD', threadId: THREAD })).toEqual({ kind: 'ESTABLISHED_THREAD', threadId: THREAD });
  });

  it('mirrors an Emerging Focus, a Thread and a departure to NONE, each anchored at its SP', () => {
    expect(applyLiveFocusTransitionEvent(store, event())).toEqual({ outcome: 'APPLIED', atSp: 3 });
    expect(store.getState().live.LF).toEqual({ value: { kind: 'EMERGING_FOCUS', emergingFocusId: FOCUS }, atSp: SP(3) });
    expect(applyLiveFocusTransitionEvent(store, event({ atSp: 4, value: { kind: 'THREAD', threadId: THREAD } }))).toEqual({ outcome: 'APPLIED', atSp: 4 });
    expect(store.getState().live.LF).toEqual({ value: { kind: 'ESTABLISHED_THREAD', threadId: THREAD }, atSp: SP(4) });
    expect(applyLiveFocusTransitionEvent(store, event({ atSp: 5, value: { kind: 'NONE' } }))).toEqual({ outcome: 'APPLIED', atSp: 5 });
    expect(store.getState().live.LF).toEqual({ value: { kind: 'NONE' }, atSp: SP(5) });
  });

  it('changes LF ONLY: LH, TM, TC, IF_ref, MC and RH are untouched, also while historically pinned', () => {
    for (const temporal of [{ kind: 'FOLLOW_LIVE' } as const, { kind: 'PINNED', at: SP(2) } as const]) {
      const pinned = createCanonicalStore(init({ temporal }));
      const before = pinned.getState();
      applyLiveFocusTransitionEvent(pinned, event({ atSp: 4, value: { kind: 'THREAD', threadId: THREAD } }));
      const after = pinned.getState();
      expect(after.live.LF).toEqual({ value: { kind: 'ESTABLISHED_THREAD', threadId: THREAD }, atSp: SP(4) });
      expect(after.live.LH).toBe(before.live.LH);
      expect(after.temporal).toBe(before.temporal);
      expect(after.inspection).toBe(before.inspection);
      expect(after.camera).toBe(before.camera);
      expect(after.history).toBe(before.history);
      expect(after.history).toHaveLength(0);
      expect(after.session).toBe(before.session);
    }
  });

  it('never dispatches a Product action: passive LF evolution moves no camera and creates no focus-follow', () => {
    const dispatch = jest.spyOn(store, 'dispatch');
    applyLiveFocusTransitionEvent(store, event());
    applyLiveFocusTransitionEvent(store, event({ sessionId: 'other' }));
    applyLiveFocusTransitionEvent(store, event({ atSp: 1 }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().camera).toEqual(init().camera);
  });

  it('is idempotent for a redelivered transition and classifies an out-of-order or conflicting delivery without rewriting the mirror', () => {
    applyLiveFocusTransitionEvent(store, event());
    const settled = store.getState();
    expect(applyLiveFocusTransitionEvent(store, event())).toEqual({ outcome: 'IDEMPOTENT', atSp: 3 });
    expect(store.getState()).toBe(settled);
    expect(applyLiveFocusTransitionEvent(store, event({ atSp: 2, value: { kind: 'NONE' } }))).toEqual({ outcome: 'OUT_OF_ORDER', atSp: 2 });
    expect(applyLiveFocusTransitionEvent(store, event({ atSp: 3, value: { kind: 'THREAD', threadId: THREAD } }))).toEqual({ outcome: 'OUT_OF_ORDER', atSp: 3 });
    expect(store.getState()).toBe(settled);
  });

  it('rejects an event addressed to another Session', () => {
    expect(applyLiveFocusTransitionEvent(store, event({ sessionId: 'session-2' }))).toMatchObject({ outcome: 'REJECTED', reason: 'SESSION_MISMATCH' });
    expect(store.getState().live.LF).toEqual({ value: { kind: 'NONE' }, atSp: null });
  });

  it('rejects untrusted transport input before it reaches the kernel: a label, a Home, a sequence or a fourth kind never enters the mirror', () => {
    for (const payload of [
      event({ value: { kind: 'READING', id: 'r' } }),
      event({ value: { kind: 'THREAD', threadId: THREAD, label: 'Ahmed' } }),
      event({ value: { kind: 'THREAD', threadId: THREAD, home: { x: 1, y: 2 } } }),
      event({ sameSpEventSequence: 3 }),
      event({ atSp: 0 }),
      event({ version: 2 }),
      { type: 'LIVE_HEAD_ADVANCED', toSp: 3 },
      null,
    ]) {
      expect(applyLiveFocusTransitionEvent(store, payload).outcome).toBe('REJECTED');
    }
    expect(store.getState().live.LF).toEqual({ value: { kind: 'NONE' }, atSp: null });
  });

  it('applies an ordered page and stops at the first payload that never becomes truth', () => {
    const outcomes = applyLiveFocusEventsPage(store, [decoded({ atSp: 1 }), decoded({ atSp: 2, value: { kind: 'THREAD', threadId: THREAD } })]);
    expect(outcomes.map((entry) => entry.outcome)).toEqual(['APPLIED', 'APPLIED']);
    const halted = applyLiveFocusEventsPage(store, [decoded({ atSp: 3, sessionId: 'session-2' }), decoded({ atSp: 4, value: { kind: 'NONE' } })]);
    expect(halted).toHaveLength(1);
    expect(halted[0]?.outcome).toBe('REJECTED');
    expect(store.getState().live.LF).toEqual({ value: { kind: 'ESTABLISHED_THREAD', threadId: THREAD }, atSp: SP(2) });
  });

  it('accepts an already decoded event through the same seam', () => {
    expect(applyDecodedLiveFocusTransitionEvent(store, decoded({ atSp: 9 }))).toEqual({ outcome: 'APPLIED', atSp: 9 });
  });

  it('builds the startup live truth from the authoritative snapshot so no replay is needed to know current LF', () => {
    expect(liveTruthFromSnapshot({ sessionId: 'session-1', liveHead: 7, liveFocus: { kind: 'THREAD', threadId: THREAD }, liveFocusAtSp: 6 }))
      .toEqual({ LH: SP(7), LF: { value: { kind: 'ESTABLISHED_THREAD', threadId: THREAD }, atSp: SP(6) } });
    expect(liveTruthFromSnapshot({ sessionId: 'session-1', liveHead: null, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null }))
      .toEqual({ LH: null, LF: { value: { kind: 'NONE' }, atSp: null } });
    const started = createCanonicalStore(init({ live: liveTruthFromSnapshot({ sessionId: 'session-1', liveHead: 7, liveFocus: { kind: 'EMERGING', emergingFocusId: FOCUS }, liveFocusAtSp: 6 }) }));
    // A catch-up transition older than the snapshot never regresses the mirror; a newer one applies.
    expect(applyLiveFocusTransitionEvent(started, event({ atSp: 4, value: { kind: 'NONE' } })).outcome).toBe('OUT_OF_ORDER');
    expect(applyLiveFocusTransitionEvent(started, event({ atSp: 7, value: { kind: 'THREAD', threadId: THREAD } })).outcome).toBe('APPLIED');
  });

  it('the two seams stay independent: LH ingestion leaves LF alone and LF ingestion leaves LH alone', () => {
    applyCommittedUnitsEvent(store, { type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, sessionId: 'session-1', batchId: 'b', sourceTurnId: 't', firstSp: 6, lastSp: 8, unitCount: 3 });
    expect(store.getState().live.LF).toEqual({ value: { kind: 'NONE' }, atSp: null });
    applyLiveFocusTransitionEvent(store, event({ atSp: 8 }));
    expect(store.getState().live.LH).toBe(SP(8));
    expect(store.getState().live.LF.atSp).toBe(SP(8));
  });
});
