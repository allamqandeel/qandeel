import { ACTION_CATALOG, AUTHORITATIVE_EVENT_TYPES } from '../actions';
import { CanonicalStateError, UnauthorizedClassAWrite, type CanonicalStateErrorCode } from '../authority';
import { opaqueRef, sessionPosition, type CanonicalState } from '../classes';
import { effectiveTC } from '../selectors';
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

describe('LIVE_HEAD_ADVANCED ingestion', () => {
  it('advances LH, moves effective TC only under FOLLOW_LIVE, and never writes RH (row 9)', () => {
    const following = createCanonicalStore(init());
    const pinned = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(3) } }));
    for (const store of [following, pinned]) {
      const before = store.getState();
      expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(8) }).outcome).toBe('APPLIED');
      const after = store.getState();
      expect(after.live.LH).toBe(SP(8));
      expect(after.history).toBe(before.history);
      expect(after.temporal).toBe(before.temporal);
      expect(after.inspection).toBe(before.inspection);
      expect(after.camera).toBe(before.camera);
    }
    expect(effectiveTC(following.getState())).toBe(SP(8));
    expect(effectiveTC(pinned.getState())).toBe(SP(3));
  });

  it('rejects retraction and treats redelivery as idempotent', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    expectRejection(() => store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(4) }), 'RETRACTION_REJECTED');
    expect(store.getState()).toBe(before);
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(5) }).outcome).toBe('IDEMPOTENT');
    expect(store.getState()).toBe(before);
    expectRejection(() => store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: 0 as never }), 'PRECONDITION_FAILED');
  });

  it('turns the absence sentinel into SP(1) without any RH', () => {
    const store = createCanonicalStore(init({ live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } } }));
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(1) }).outcome).toBe('APPLIED');
    expect(store.getState().live.LH).toBe(SP(1));
    expect(store.getState().history).toHaveLength(0);
  });

  it('cannot lend transaction authority to an otherwise no-op command (S5-RH-04)', () => {
    const store = createCanonicalStore(init());
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(6) });
    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor('a0') } }).outcome).toBe('NO_OP');
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('LIVE_FOCUS_TRANSITION ingestion', () => {
  it('mirrors the three-valued LF anchored at its SP and never writes RH (row 10)', () => {
    const store = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(2) } }));
    const before = store.getState();
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(3) }).outcome).toBe('APPLIED');
    const after = store.getState();
    expect(after.live.LF).toEqual({ value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(3) });
    expect(after.history).toBe(before.history);
    expect(after.temporal).toBe(before.temporal);
    expect(after.inspection).toBe(before.inspection);
    expect(after.camera).toBe(before.camera);
    expect(effectiveTC(after)).toBe(SP(2));
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 't-1' }, atSp: SP(4) }).outcome).toBe('APPLIED');
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'NONE' }, atSp: SP(5) }).outcome).toBe('APPLIED');
    expect(store.getState().live.LF).toEqual({ value: { kind: 'NONE' }, atSp: SP(5) });
    expect(store.getState().history).toHaveLength(0);
  });

  it('rejects out-of-order and conflicting same-SP deliveries; identical redelivery is idempotent', () => {
    const store = createCanonicalStore(init());
    store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(3) });
    const before = store.getState();
    expectRejection(() => store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'NONE' }, atSp: SP(2) }), 'OUT_OF_ORDER_TRANSITION');
    expectRejection(() => store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'NONE' }, atSp: SP(3) }), 'OUT_OF_ORDER_TRANSITION');
    expect(store.getState()).toBe(before);
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(3) }).outcome).toBe('IDEMPOTENT');
    expect(store.getState()).toBe(before);
    expectRejection(() => store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'READING', id: 'r' } as never, atSp: SP(4) }), 'PRECONDITION_FAILED');
  });
});

describe('separate authority paths', () => {
  it('the event catalog is closed to the two ingestion seams, each with one authority field', () => {
    expect([...AUTHORITATIVE_EVENT_TYPES]).toEqual(['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION']);
    expect([...ACTION_CATALOG.LIVE_HEAD_ADVANCED.authority]).toEqual(['LH']);
    expect([...ACTION_CATALOG.LIVE_FOCUS_TRANSITION.authority]).toEqual(['LF']);
    expect(ACTION_CATALOG.LIVE_HEAD_ADVANCED.transactional).toBe('NEVER');
    expect(ACTION_CATALOG.LIVE_FOCUS_TRANSITION.transactional).toBe('NEVER');
  });

  it('a generic authoritative event fails closed by name (row 19)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    for (const type of ['WORLD_TRUTH_UPDATED', 'INVALIDATE', 'REFRESH', 'SYNC_ALL', 'RESET_FROM_SERVER', 'PROJECTION_CHANGED']) {
      expectRejection(() => store.ingest({ type } as never), 'UNKNOWN_EVENT');
    }
    expect(store.getState()).toBe(before);
  });

  it('events cannot be dispatched and Product actions cannot be ingested', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    expectRejection(() => store.dispatch({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) } as never), 'UNAUTHORIZED_ACTION_CLASS');
    expectRejection(() => store.dispatch({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'NONE' }, atSp: SP(9) } as never), 'UNAUTHORIZED_ACTION_CLASS');
    expectRejection(() => store.ingest({ type: 'PAN', to: { anchor: anchor('a1') } } as never), 'UNAUTHORIZED_ACTION_CLASS');
    expectRejection(() => store.ingest({ type: 'COMMIT_MOMENT', moment: SP(1) } as never), 'UNAUTHORIZED_ACTION_CLASS');
    expectRejection(() => store.ingest({ type: 'BACK_ONE_STEP' } as never), 'UNAUTHORIZED_ACTION_CLASS');
    expect(store.getState()).toBe(before);
    expect(store.getState().live.LH).toBe(SP(5));
  });

  it('an injected rogue event transition cannot reach TM, IF_ref, MC or RH and cannot cross into the other live field', () => {
    const crossing = createCanonicalStore(init(), {
      eventTransitions: {
        LIVE_HEAD_ADVANCED: ((state: CanonicalState) => ({ LH: SP(9), LF: { value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-x' }, atSp: SP(9) } })) as never,
      },
    });
    const before = crossing.getState();
    const rejection = expectRejection(() => crossing.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) }), 'UNAUTHORIZED_CLASS_A_WRITE') as UnauthorizedClassAWrite;
    expect(rejection.field).toBe('LF');
    expect(crossing.getState()).toBe(before);

    const smuggling = createCanonicalStore(init(), {
      eventTransitions: {
        LIVE_HEAD_ADVANCED: ((state: CanonicalState) => ({ ...state.live, LH: SP(9), temporal: { kind: 'PINNED', at: SP(1) }, camera: null, history: [] })) as never,
      },
    });
    const smugglingBefore = smuggling.getState();
    expectRejection(() => smuggling.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) }), 'INVALID_CANONICAL_SHAPE');
    expect(smuggling.getState()).toBe(smugglingBefore);
    expect(smuggling.getState().live.LH).toBe(SP(5));
  });

  it('an event returning a valid LH plus an unknown key inside live is rejected (FIX-T02-02)', () => {
    const store = createCanonicalStore(init(), {
      eventTransitions: {
        LIVE_HEAD_ADVANCED: ((state: CanonicalState) => ({ LH: SP(9), LF: state.live.LF, projection: 'stale' })) as never,
      },
    });
    const before = store.getState();
    const rejection = expectRejection(() => store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) }), 'INVALID_CANONICAL_SHAPE');
    expect(rejection.message).toMatch(/state\.live: unknown key projection/);
    expect(store.getState()).toBe(before);

    const focusExtra = createCanonicalStore(init(), {
      eventTransitions: {
        LIVE_FOCUS_TRANSITION: ((state: CanonicalState) => ({ LH: state.live.LH, LF: { value: { kind: 'NONE', importance: 1 }, atSp: SP(6) } })) as never,
      },
    });
    const focusBefore = focusExtra.getState();
    expectRejection(() => focusExtra.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'NONE' }, atSp: SP(6) }), 'INVALID_CANONICAL_SHAPE');
    expect(focusExtra.getState()).toBe(focusBefore);
  });

  it('an event payload value with extra keys never enters the mirror', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    expectRejection(() => store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 't-1', rank: 3 } as never, atSp: SP(6) }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
  });
});
