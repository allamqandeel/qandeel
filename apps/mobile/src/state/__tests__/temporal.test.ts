import { CanonicalStateError, type CanonicalStateErrorCode } from '../authority';
import { SEMANTIC_DEPTHS, opaqueRef, sessionPosition } from '../classes';
import { committedNavigationIntent, effectiveTC, isAddressableMoment, temporalOrientation } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

const SP = sessionPosition;
const anchor = (v: string) => opaqueRef('WORLD_ANCHOR', v);
const scale = (v: string) => opaqueRef('SCALE_INTENT', v);

function init(overrides: Partial<CanonicalStateInit> = {}): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: anchor('a0'), scale: scale('s0'), depth: 'WORLD' },
    ...overrides,
  };
}

function expectRejection(fn: () => unknown, code: CanonicalStateErrorCode): CanonicalStateError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CanonicalStateError);
    expect((error as CanonicalStateError).code).toBe(code);
    return error as CanonicalStateError;
  }
  throw new Error(`expected rejection ${code}`);
}

describe('temporal commit kernel', () => {
  it('COMMIT_MOMENT(m) pins m and appends exactly one RH entry capturing the pre-act viewpoint', () => {
    const store = createCanonicalStore(init());
    const result = store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(3) });
    expect(result.outcome).toBe('APPLIED');
    const state = store.getState();
    expect(state.temporal).toEqual({ kind: 'PINNED', at: SP(3) });
    expect(effectiveTC(state)).toBe(SP(3));
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual({
      act: 'COMMIT_MOMENT',
      captured: { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: SP(5), ifRef: null, camera: init().camera },
    });
  });

  it('Moment(LH) != LIVE_EDGE: PINNED(LH) stays behind while FOLLOW_LIVE advances (row 11)', () => {
    const pinned = createCanonicalStore(init());
    const following = createCanonicalStore(init());
    expect(pinned.dispatch({ type: 'COMMIT_MOMENT', moment: SP(5) }).outcome).toBe('APPLIED');
    expect(pinned.getState().temporal).toEqual({ kind: 'PINNED', at: SP(5) });
    expect(following.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    expect(following.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });

    pinned.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(6) });
    following.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(6) });
    expect(effectiveTC(pinned.getState())).toBe(SP(5));
    expect(effectiveTC(following.getState())).toBe(SP(6));
    expect(pinned.getState().temporal).toEqual({ kind: 'PINNED', at: SP(5) });
  });

  it('FOLLOW_LIVE@LH → PINNED(LH) is an effective change because mode counts (S5-RH-02)', () => {
    const store = createCanonicalStore(init());
    expect(effectiveTC(store.getState())).toBe(SP(5));
    const result = store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(5) });
    expect(result.outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);
  });

  it('COMMIT_LIVE_EDGE from PINNED re-establishes FOLLOW_LIVE with one entry; from FOLLOW_LIVE it is a true no-op', () => {
    const store = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(2) } }));
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0]?.captured.tc).toBe(SP(2));
    const historyBefore = store.getState().history;
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    expect(store.getState().history).toBe(historyBefore);
  });

  it('COMMIT_MOMENT rejects targets beyond LH and non-positions without any state change', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    expectRejection(() => store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(6) }), 'PRECONDITION_FAILED');
    expectRejection(() => store.dispatch({ type: 'COMMIT_MOMENT', moment: 0 as never }), 'PRECONDITION_FAILED');
    expectRejection(() => store.dispatch({ type: 'COMMIT_MOMENT', moment: 2.5 as never }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
  });

  it('isAddressableMoment is exactly 1 <= m <= LH', () => {
    const state = createCanonicalStore(init()).getState();
    expect(isAddressableMoment(state, 1)).toBe(true);
    expect(isAddressableMoment(state, 5)).toBe(true);
    expect(isAddressableMoment(state, 6)).toBe(false);
    expect(isAddressableMoment(state, 0)).toBe(false);
  });
});

describe('LH = null is a technical absence sentinel, never Product temporal state (rows 21, 22; EX02-02)', () => {
  const absent = () => init({ live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } } });

  it('COMMIT_LIVE_EDGE fails with PreconditionFailed, no state change, no RH', () => {
    const store = createCanonicalStore(absent());
    const before = store.getState();
    expectRejection(() => store.dispatch({ type: 'COMMIT_LIVE_EDGE' }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('COMMIT_MOMENT fails with PreconditionFailed, no state change, no RH', () => {
    const store = createCanonicalStore(absent());
    const before = store.getState();
    expectRejection(() => store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(1) }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('nothing is addressable, orientation reports an absent TC, and no null cursor can be projected', () => {
    const state = createCanonicalStore(absent()).getState();
    expect(isAddressableMoment(state, 1)).toBe(false);
    expect(isAddressableMoment(state, 0)).toBe(false);
    expect(temporalOrientation(state)).toEqual({ mode: 'FOLLOW_LIVE', effectiveTC: null });
    const intent = committedNavigationIntent(state);
    expect(intent.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(intent.effectiveTC).toBeNull();
  });

  it('PINNED cannot be constructed over LH = null', () => {
    expectRejection(() => createCanonicalStore(init({ live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } }, temporal: { kind: 'PINNED', at: SP(1) } })), 'INVALID_INITIAL_STATE');
  });

  it('after authoritative SP(1), LH is a valid Session Position and the temporal commits become valid', () => {
    const store = createCanonicalStore(absent());
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(1) }).outcome).toBe('APPLIED');
    expect(store.getState().live.LH).toBe(SP(1));
    expect(store.getState().history).toHaveLength(0);
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(1) }).outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(2);
  });

  it('already FOLLOW_LIVE with a real LH: COMMIT_LIVE_EDGE is a true no-op and writes no RH', () => {
    const store = createCanonicalStore(init());
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('temporal orientation is not historical projection truth (row 20)', () => {
  it('exposes only mode, effective TC and the pinned-earlier-than-LH fact', () => {
    const following = temporalOrientation(createCanonicalStore(init()).getState());
    expect(following).toEqual({ mode: 'FOLLOW_LIVE', effectiveTC: SP(5) });

    const pinnedEarlier = temporalOrientation(createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(3) } })).getState());
    expect(pinnedEarlier).toEqual({ mode: 'PINNED', at: SP(3), effectiveTC: SP(3), earlierThanLiveHead: true });

    const pinnedAtHead = temporalOrientation(createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(5) } })).getState());
    expect(pinnedAtHead).toEqual({ mode: 'PINNED', at: SP(5), effectiveTC: SP(5), earlierThanLiveHead: false });

    for (const orientation of [following, pinnedEarlier, pinnedAtHead]) {
      const keys = Object.keys(orientation);
      for (const forbidden of ['sparse', 'projection', 'K', 'V', 'available', 'complete', 'correct', 'footprint']) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it('is a pure function of Class A: a Live Head advance changes it only through LH', () => {
    const store = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(5) } }));
    expect(temporalOrientation(store.getState())).toMatchObject({ earlierThanLiveHead: false });
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(7) });
    expect(temporalOrientation(store.getState())).toMatchObject({ mode: 'PINNED', at: SP(5), earlierThanLiveHead: true });
  });

  it('the semantic depth rungs are the frozen five with the analytical-object rung (EX02-01)', () => {
    expect(SEMANTIC_DEPTHS).toEqual(['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE']);
    expect((SEMANTIC_DEPTHS as readonly string[]).includes('READING')).toBe(false);
  });
});
