import { CanonicalStateError, type CanonicalStateErrorCode } from '../authority';
import { opaqueRef, opaqueValueEquals, sessionPosition, type RhEntry } from '../classes';
import { appendIfEffective, captureCheckpoint, isEffectiveChange, phiEff, phiEffEquals } from '../history';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

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

const SP = sessionPosition;
const anchor = (v: string | Record<string, string | number>) => opaqueRef('WORLD_ANCHOR', v);
const scale = (v: string) => opaqueRef('SCALE_INTENT', v);
const destination = (v: string) => opaqueRef('SPATIAL_DESTINATION', v);

function init(overrides: Partial<CanonicalStateInit> = {}): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: anchor({ x: 1, y: 2 }), scale: scale('s0'), depth: 'WORLD' },
    ...overrides,
  };
}

describe('RH append boundary', () => {
  it('a true no-op writes nothing and keeps the state object identical (row 15)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor({ x: 1, y: 2 }) } }).outcome).toBe('NO_OP');
    expect(store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'WORLD' }).outcome).toBe('NO_OP');
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('NO_OP');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toBe(before.history);
    expect(store.getState().history).toHaveLength(0);
  });

  it('COMMIT_MOMENT(t) while already PINNED(t) is a true no-op', () => {
    const store = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(2) } }));
    const before = store.getState();
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) }).outcome).toBe('NO_OP');
    expect(store.getState()).toBe(before);
  });

  it('one effective transaction appends exactly one exact pre-act checkpoint', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    const result = store.dispatch({ type: 'PAN', to: { anchor: anchor('a1'), destination: destination('d1') } });
    expect(result.outcome).toBe('APPLIED');
    const state = store.getState();
    expect(state.history).toHaveLength(1);
    const entry = state.history[0];
    expect(entry).toBe(result.outcome === 'APPLIED' ? result.entry : null);
    expect(entry).toEqual({
      act: 'PAN',
      captured: { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: SP(5), ifRef: null, camera: before.camera },
    });
    expect(entry?.captured.camera).toBe(before.camera);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(state.camera.destination).toEqual(destination('d1'));
  });

  it('history is append-only: earlier entries keep their identity', () => {
    const store = createCanonicalStore(init());
    store.dispatch({ type: 'PAN', to: { anchor: anchor('a1') } });
    const first = store.getState().history[0];
    store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'SESSION' });
    expect(store.getState().history).toHaveLength(2);
    expect(store.getState().history[0]).toBe(first);
    expect(store.getState().history[1]?.act).toBe('ZOOM_SEMANTIC');
    expect(store.getState().history[1]?.captured.camera.anchor).toEqual(anchor('a1'));
  });

  it('Φ_eff treats mode as effective even at equal temporal coordinates', () => {
    const following = createCanonicalStore(init()).getState();
    const pinnedAtHead = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(5) } })).getState();
    expect(phiEff(following).tc).toBe(phiEff(pinnedAtHead).tc);
    expect(phiEffEquals(phiEff(following), phiEff(pinnedAtHead))).toBe(false);
    expect(isEffectiveChange(following, pinnedAtHead)).toBe(true);
  });

  it('Φ_eff compares canonical intent by deterministic value equality, key order ignored', () => {
    const store = createCanonicalStore(init());
    expect(opaqueValueEquals({ x: 1, y: 2 }, { y: 2, x: 1 })).toBe(true);
    expect(opaqueValueEquals({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
    expect(opaqueValueEquals('a', { a: 'a' })).toBe(false);
    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor({ y: 2, x: 1 }) } }).outcome).toBe('NO_OP');
    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor({ y: 2, x: 1, z: 0 }) } }).outcome).toBe('APPLIED');
  });

  it('Φ_eff contains only tm, tc, ifRef and camera intent', () => {
    const state = createCanonicalStore(init()).getState();
    expect(Object.keys(phiEff(state)).sort()).toEqual(['camera', 'ifRef', 'tc', 'tm']);
    expect(Object.keys(phiEff(state).camera).sort()).toEqual(['anchor', 'depth', 'scale']);
  });

  it('no RH checkpoint can capture the technical absence sentinel: effective acts before SP(1) fail closed (FIX-T02-04)', () => {
    const absent = () => init({ live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } } });
    const store = createCanonicalStore(absent());
    const before = store.getState();

    expectRejection(() => store.dispatch({ type: 'PAN', to: { anchor: anchor('a1') } }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
    expectRejection(() => store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'THREAD' }), 'PRECONDITION_FAILED');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);

    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor({ x: 1, y: 2 }) } }).outcome).toBe('NO_OP');
    expect(store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'WORLD' }).outcome).toBe('NO_OP');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);

    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(1) }).outcome).toBe('APPLIED');
    const panResult = store.dispatch({ type: 'PAN', to: { anchor: anchor('a1') } });
    expect(panResult.outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'THREAD' }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);
    for (const entry of store.getState().history) {
      expect(entry.captured.tc).toBe(SP(1));
      expect(entry.captured.tmProvenance).toEqual({ kind: 'FOLLOW_LIVE' });
    }

    expectRejection(() => captureCheckpoint(before, 'PAN'), 'PRECONDITION_FAILED');
    const invalidEntry = { act: 'PAN', captured: { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: null, ifRef: null, camera: init().camera } } as unknown as RhEntry;
    expectRejection(() => createCanonicalStore(init({ history: [invalidEntry] })), 'INVALID_INITIAL_STATE');
  });

  it('initial history is validated structurally: only RH-eligible acts with exact checkpoints are accepted (FIX-T02-03)', () => {
    const checkpoint = { tmProvenance: { kind: 'FOLLOW_LIVE' } as const, tc: SP(3), ifRef: null, camera: init().camera };
    const valid: RhEntry = { act: 'BACK_ONE_STEP', captured: checkpoint };
    expect(createCanonicalStore(init({ history: [valid, { act: 'PAN', captured: checkpoint }] })).getState().history).toHaveLength(2);

    for (const act of ['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION', 'PREVIEW_TEMPORAL_TARGET', 'PRESENTATION_WINDOW_MOVE', 'RESPONSIVE_RECOMPOSITION', 'NAVIGATE', 'MAP_FOCUS_OBJECT', undefined]) {
      const rejection = expectRejection(() => createCanonicalStore(init({ history: [{ act, captured: checkpoint } as unknown as RhEntry] })), 'INVALID_INITIAL_STATE');
      expect(rejection.message).toMatch(/history\[0\]\.act/);
    }
    for (const malformed of [
      { act: 'PAN', captured: { ...checkpoint, extra: 1 } },
      { act: 'PAN', captured: { tmProvenance: checkpoint.tmProvenance, tc: SP(3), ifRef: null } },
      { act: 'PAN', captured: { ...checkpoint, tmProvenance: { kind: 'SETTLING' } } },
      { act: 'PAN', captured: { ...checkpoint, tmProvenance: { kind: 'PINNED' } } },
      { act: 'PAN', captured: { ...checkpoint, tc: 0 } },
      { act: 'PAN', captured: { ...checkpoint, ifRef: { canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'x'), depth: 'WORLD' } } },
      { act: 'PAN', captured: { ...checkpoint, camera: { ...checkpoint.camera, width: 375 } } },
      { act: 'PAN', captured: checkpoint, note: 'extra' },
      { act: 'PAN' },
      'PAN',
      null,
    ]) {
      expectRejection(() => createCanonicalStore(init({ history: [malformed as unknown as RhEntry] })), 'INVALID_INITIAL_STATE');
    }
    expectRejection(() => createCanonicalStore(init({ history: 'none' as unknown as RhEntry[] })), 'INVALID_INITIAL_STATE');
  });

  it('appendIfEffective and captureCheckpoint are pure over the states they are given', () => {
    const before = createCanonicalStore(init()).getState();
    const same = appendIfEffective(before, before, 'PAN');
    expect(same.entry).toBeNull();
    expect(same.history).toBe(before.history);
    const after = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(4) } })).getState();
    const appended = appendIfEffective(before, after, 'COMMIT_MOMENT');
    expect(appended.entry).toEqual(captureCheckpoint(before, 'COMMIT_MOMENT'));
    expect(appended.history).toHaveLength(1);
    expect(before.history).toHaveLength(0);
  });
});
