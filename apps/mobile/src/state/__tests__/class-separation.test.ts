import { CanonicalStateError, type CanonicalStateErrorCode } from '../authority';
import { CLASS_A_FIELDS, opaqueRef, sessionPosition } from '../classes';
import { phiEff } from '../history';
import { committedNavigationIntent } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

const SP = sessionPosition;

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

function expectRejection(fn: () => unknown, code: CanonicalStateErrorCode) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CanonicalStateError);
    expect((error as CanonicalStateError).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection ${code}`);
}

const FORBIDDEN_STATE_KEYS = ['K', 'V', 'kTC', 'ifRender', 'divergence', 'locatable', 'PTC', 'ptc', 'preview', 'window', 'position', 'footprint', 'viewport', 'width', 'height', 'aspect', 'animation', 'layout', 'focus'];

describe('four-class separation', () => {
  it('Class A is the only stored class: the state has exactly the six canonical keys (row 8)', () => {
    const state = createCanonicalStore(init()).getState();
    expect(Object.keys(state).sort()).toEqual(['camera', 'history', 'inspection', 'live', 'session', 'temporal']);
    for (const key of FORBIDDEN_STATE_KEYS) expect(key in state).toBe(false);
    expect(Object.keys(state.camera).sort()).toEqual(['anchor', 'depth', 'scale']);
    expect(Object.keys(state.live).sort()).toEqual(['LF', 'LH']);
    expect([...CLASS_A_FIELDS]).toEqual(['LH', 'LF', 'TM', 'IF_ref', 'MC.anchor', 'MC.orientation', 'MC.scale', 'MC.destination', 'MC.depth', 'RH']);
  });

  it('published state is deeply immutable', () => {
    const state = createCanonicalStore(init()).getState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.camera)).toBe(true);
    expect(Object.isFrozen(state.camera.anchor)).toBe(true);
    expect(Object.isFrozen(state.live.LF)).toBe(true);
    // Metro's Babel preset compiles modules in sloppy mode, where a frozen-property assignment
    // fails silently instead of throwing; the invariant is that the value does not change.
    (state.camera as { depth: string }).depth = 'THREAD';
    (state.live.LF as { atSp: number | null }).atSp = 99;
    expect(state.camera.depth).toBe('WORLD');
    expect(state.live.LF.atSp).toBeNull();
    expect(() => {
      (state.history as unknown as unknown[]).push({});
    }).toThrow();
    expect(state.history).toHaveLength(0);
  });

  it('a responsive envelope can change without any canonical camera intent or RH change (row 18)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    for (const envelope of [
      { width: 375, height: 812, aspect: 375 / 812 },
      { width: 1024, height: 768, aspect: 1024 / 768 },
    ]) {
      expectRejection(() => store.dispatch({ type: 'RESPONSIVE_RECOMPOSITION', envelope } as never), 'UNAUTHORIZED_ACTION_CLASS');
      expectRejection(() => store.ingest({ type: 'RESPONSIVE_RECOMPOSITION', envelope } as never), 'UNAUTHORIZED_ACTION_CLASS');
    }
    expect(store.getState()).toBe(before);
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().history).toBe(before.history);
    const phi = phiEff(before);
    expect(Object.keys(phi).sort()).toEqual(['camera', 'ifRef', 'tc', 'tm']);
    for (const key of ['width', 'height', 'aspect', 'footprint', 'viewport', 'animation', 'ptc', 'window', 'focus']) {
      expect(key in phi).toBe(false);
      expect(key in phi.camera).toBe(false);
    }
  });

  it('the committed-navigation projection for T-13 carries TM as a mode and never LH, LF or transient state', () => {
    const state = createCanonicalStore(init({ temporal: { kind: 'PINNED', at: SP(2) } })).getState();
    const intent = committedNavigationIntent(state);
    expect(Object.keys(intent).sort()).toEqual(['camera', 'effectiveTC', 'history', 'inspection', 'temporal']);
    for (const key of ['LH', 'LF', 'live', ...FORBIDDEN_STATE_KEYS]) expect(key in intent).toBe(false);
    expect(intent.temporal).toEqual({ kind: 'PINNED', at: SP(2) });
    expect(intent.effectiveTC).toBe(SP(2));
  });

  it('no derived value can be dispatched as state (row 8)', () => {
    const store = createCanonicalStore(init());
    for (const type of ['SET_K_TC', 'SET_V', 'SET_IF_RENDER', 'SET_DIVERGENCE', 'SET_FOOTPRINT']) {
      expectRejection(() => store.dispatch({ type, value: {} } as never), 'UNKNOWN_ACTION');
    }
  });
});
