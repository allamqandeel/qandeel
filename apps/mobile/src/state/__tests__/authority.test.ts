import { ACTION_CATALOG } from '../actions';
import { CanonicalStateError, UnauthorizedClassAWrite, assertAuthorizedClassAWrites, type CanonicalStateErrorCode } from '../authority';
import { opaqueRef, sessionPosition, type CanonicalState } from '../classes';
import { effectiveTC } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';
import type { ActionTransitionTable } from '../transitions';

const SP = sessionPosition;
const anchor = (v: string) => opaqueRef('WORLD_ANCHOR', v);
const scale = (v: string) => opaqueRef('SCALE_INTENT', v);
const orientation = (v: string) => opaqueRef('WORLD_ORIENTATION', v);
const destination = (v: string) => opaqueRef('SPATIAL_DESTINATION', v);

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
    const rejection = error as CanonicalStateError;
    expect(rejection.code).toBe(code);
    return rejection;
  }
  throw new Error(`expected rejection ${code}`);
}

function expectUnauthorizedField(fn: () => unknown, field: string, actId: string) {
  const rejection = expectRejection(fn, 'UNAUTHORIZED_CLASS_A_WRITE') as UnauthorizedClassAWrite;
  expect(rejection.field).toBe(field);
  expect(rejection.actId).toBe(actId);
}

describe('per-field Class-A writer guard (unit)', () => {
  const store = createCanonicalStore(init());
  const before = store.getState();

  it('reports no change for identical states', () => {
    expect(assertAuthorizedClassAWrites(before, before, [], 'PAN')).toEqual([]);
  });

  it('rejects an LF change under any Product action authority', () => {
    const after: CanonicalState = { ...before, live: { ...before.live, LF: { value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(2) } } };
    expectUnauthorizedField(() => assertAuthorizedClassAWrites(before, after, ACTION_CATALOG.PAN.authority, 'PAN'), 'LF', 'PAN');
    expectUnauthorizedField(() => assertAuthorizedClassAWrites(before, after, ACTION_CATALOG.COMMIT_MOMENT.authority, 'COMMIT_MOMENT'), 'LF', 'COMMIT_MOMENT');
  });

  it('rejects an LH change under any Product action authority', () => {
    const after: CanonicalState = { ...before, live: { ...before.live, LH: SP(6) } };
    expectUnauthorizedField(() => assertAuthorizedClassAWrites(before, after, ACTION_CATALOG.ZOOM_SEMANTIC.authority, 'ZOOM_SEMANTIC'), 'LH', 'ZOOM_SEMANTIC');
  });

  it('rejects camera sub-field writes outside PAN authority (orientation, scale, depth)', () => {
    expectUnauthorizedField(
      () => assertAuthorizedClassAWrites(before, { ...before, camera: { ...before.camera, orientation: orientation('o1') } }, ACTION_CATALOG.PAN.authority, 'PAN'),
      'MC.orientation',
      'PAN',
    );
    expectUnauthorizedField(
      () => assertAuthorizedClassAWrites(before, { ...before, camera: { ...before.camera, scale: scale('s1') } }, ACTION_CATALOG.PAN.authority, 'PAN'),
      'MC.scale',
      'PAN',
    );
    expectUnauthorizedField(
      () => assertAuthorizedClassAWrites(before, { ...before, camera: { ...before.camera, depth: 'THREAD' } }, ACTION_CATALOG.PAN.authority, 'PAN'),
      'MC.depth',
      'PAN',
    );
  });

  it('allows the authorized PAN fields and reports them', () => {
    const after: CanonicalState = { ...before, camera: { ...before.camera, anchor: anchor('a1'), destination: destination('d1') } };
    expect(assertAuthorizedClassAWrites(before, after, ACTION_CATALOG.PAN.authority, 'PAN')).toEqual(['MC.anchor', 'MC.destination']);
  });

  it('rejects an RH write by anything but the boundary', () => {
    const after: CanonicalState = { ...before, history: [...before.history, { act: 'PAN', captured: { tmProvenance: before.temporal, tc: SP(5), ifRef: null, camera: before.camera } }] };
    expectUnauthorizedField(() => assertAuthorizedClassAWrites(before, after, ACTION_CATALOG.PAN.authority, 'PAN'), 'RH', 'PAN');
  });
});

describe('injected violating transitions are caught at the store boundary (TypeScript bypassed)', () => {
  type Rogue = Partial<ActionTransitionTable>;

  function storeWith(rogue: Rogue, overrides: Partial<CanonicalStateInit> = {}) {
    return createCanonicalStore(init(overrides), { actionTransitions: rogue });
  }

  const pan = { type: 'PAN', to: { anchor: anchor('a1') } } as const;
  const zoom = { type: 'ZOOM_SEMANTIC', depth: 'THREAD' } as const;

  it('PAN cannot write LF (row 1)', () => {
    const store = storeWith({
      PAN: ((state: CanonicalState) => ({ ...state, live: { ...state.live, LF: { value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-1' }, atSp: SP(3) } } })) as never,
    });
    const before = store.getState();
    expectUnauthorizedField(() => store.dispatch(pan), 'LF', 'PAN');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toBe(before.history);
  });

  it('PAN cannot fabricate LH (row 2)', () => {
    const store = storeWith({ PAN: ((state: CanonicalState) => ({ ...state, live: { ...state.live, LH: SP(9) } })) as never });
    const before = store.getState();
    expectUnauthorizedField(() => store.dispatch(pan), 'LH', 'PAN');
    expect(store.getState()).toBe(before);
  });

  it('PAN cannot write TM / effective TC (row 5)', () => {
    const store = storeWith({ PAN: ((state: CanonicalState) => ({ ...state, temporal: { kind: 'PINNED', at: SP(2) } })) as never });
    const before = store.getState();
    expectUnauthorizedField(() => store.dispatch(pan), 'TM', 'PAN');
    expect(store.getState()).toBe(before);
    expect(effectiveTC(store.getState())).toBe(SP(5));
  });

  it('PAN cannot write orientation, scale or depth (row 6, EX02-03)', () => {
    for (const [field, camera] of [
      ['MC.orientation', (s: CanonicalState) => ({ ...s.camera, orientation: orientation('o1') })],
      ['MC.scale', (s: CanonicalState) => ({ ...s.camera, scale: scale('s1') })],
      ['MC.depth', (s: CanonicalState) => ({ ...s.camera, depth: 'SESSION' as const })],
    ] as const) {
      const store = storeWith({ PAN: ((state: CanonicalState) => ({ temporal: state.temporal, inspection: state.inspection, camera: camera(state) })) as never });
      const before = store.getState();
      expectUnauthorizedField(() => store.dispatch(pan), field, 'PAN');
      expect(store.getState()).toBe(before);
    }
  });

  it('PAN cannot write IF_ref', () => {
    const store = storeWith({
      PAN: ((state: CanonicalState) => ({
        ...state,
        inspection: { canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'x'), depth: 'WORLD', lineage: opaqueRef('LINEAGE', 'l') },
      })) as never,
    });
    const before = store.getState();
    expectUnauthorizedField(() => store.dispatch(pan), 'IF_ref', 'PAN');
    expect(store.getState()).toBe(before);
  });

  it('PAN cannot append RH itself', () => {
    const store = storeWith({
      PAN: ((state: CanonicalState) => ({ ...state, history: [...state.history, { act: 'PAN', captured: { tmProvenance: state.temporal, tc: SP(5), ifRef: null, camera: state.camera } }] })) as never,
    });
    const before = store.getState();
    expectUnauthorizedField(() => store.dispatch(pan), 'RH', 'PAN');
    expect(store.getState()).toBe(before);
  });

  it('ZOOM_SEMANTIC cannot write TM, orientation or destination (row 7, EX02-03)', () => {
    const cases = [
      ['TM', (s: CanonicalState) => ({ ...s, temporal: { kind: 'PINNED', at: SP(1) } as const })],
      ['MC.orientation', (s: CanonicalState) => ({ ...s, camera: { ...s.camera, orientation: orientation('o1') } })],
      ['MC.destination', (s: CanonicalState) => ({ ...s, camera: { ...s.camera, destination: destination('d1') } })],
    ] as const;
    for (const [field, make] of cases) {
      const store = storeWith({ ZOOM_SEMANTIC: (make as unknown) as never });
      const before = store.getState();
      expectUnauthorizedField(() => store.dispatch(zoom), field, 'ZOOM_SEMANTIC');
      expect(store.getState()).toBe(before);
    }
  });

  it('COMMIT_MOMENT cannot write camera intent or IF_ref (row 25)', () => {
    const rogueCamera = storeWith({ COMMIT_MOMENT: ((s: CanonicalState) => ({ ...s, temporal: { kind: 'PINNED', at: SP(2) }, camera: { ...s.camera, anchor: anchor('a9') } })) as never });
    expectUnauthorizedField(() => rogueCamera.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) }), 'MC.anchor', 'COMMIT_MOMENT');
    const rogueInspection = storeWith({
      COMMIT_MOMENT: ((s: CanonicalState) => ({
        ...s,
        temporal: { kind: 'PINNED', at: SP(2) },
        inspection: { canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', 'x'), depth: 'WORLD', lineage: opaqueRef('LINEAGE', 'l') },
      })) as never,
    });
    expectUnauthorizedField(() => rogueInspection.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) }), 'IF_ref', 'COMMIT_MOMENT');
  });

  it('an injected table never widens authority: an honest rogue PAN is still bounded to PAN fields', () => {
    const store = storeWith({ PAN: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, anchor: anchor('a1') } })) as never });
    expect(store.dispatch(pan).outcome).toBe('APPLIED');
    expect(store.getState().camera.anchor).toEqual(anchor('a1'));
    expect(store.getState().camera.scale).toEqual(scale('s0'));
  });
});

describe('exact canonical shape at the trust boundary (FIX-T02-02)', () => {
  const pan = { type: 'PAN', to: { anchor: anchor('a1') } } as const;
  const zoom = { type: 'ZOOM_SEMANTIC', depth: 'THREAD' } as const;

  function rogueStore(table: Partial<ActionTransitionTable>) {
    return createCanonicalStore(init(), { actionTransitions: table });
  }

  it('PAN with an authorized anchor change plus a smuggled camera.width is rejected, state object-identical', () => {
    const store = rogueStore({
      PAN: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, anchor: anchor('a1'), width: 375 } })) as never,
    });
    const before = store.getState();
    const rejection = expectRejection(() => store.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
    expect(rejection.message).toMatch(/state\.camera: unknown key width/);
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toBe(before.history);
  });

  it('PAN smuggling an arbitrary unknown camera key is rejected (allowlist, not blacklist)', () => {
    const store = rogueStore({
      PAN: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, anchor: anchor('a1'), somethingNew: { any: 'shape' } } })) as never,
    });
    const before = store.getState();
    expectRejection(() => store.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
    expect(store.getState()).toBe(before);
  });

  it('PAN changing anchor plus session.id is rejected as an immutable-context violation', () => {
    const store = rogueStore({
      PAN: ((s: CanonicalState) => ({ ...s, session: { id: 'another-session' }, camera: { ...s.camera, anchor: anchor('a1') } })) as never,
    });
    const before = store.getState();
    expectRejection(() => store.dispatch(pan), 'IMMUTABLE_CONTEXT_VIOLATION');
    expect(store.getState()).toBe(before);
    expect(store.getState().session.id).toBe('session-1');
  });

  it('a session object with an extra key is rejected even when the id is unchanged', () => {
    const store = rogueStore({
      PAN: ((s: CanonicalState) => ({ ...s, session: { id: s.session.id, tenant: 'x' }, camera: { ...s.camera, anchor: anchor('a1') } })) as never,
    });
    const before = store.getState();
    expectRejection(() => store.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
    expect(store.getState()).toBe(before);
  });

  it('ZOOM_SEMANTIC changing depth plus a smuggled presentation envelope is rejected', () => {
    for (const smuggle of [{ viewport: { width: 375, height: 812 } }, { footprint: [0, 0, 1, 1] }, { aspect: 0.46 }, { clipping: true }, { layout: 'narrow' }, { animation: 0.5 }]) {
      const store = rogueStore({
        ZOOM_SEMANTIC: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, depth: 'THREAD', ...smuggle } })) as never,
      });
      const before = store.getState();
      expectRejection(() => store.dispatch(zoom), 'INVALID_CANONICAL_SHAPE');
      expect(store.getState()).toBe(before);
    }
  });

  it('a transition cannot add a top-level state key (PTC, K, V, ifRender) or replace nested shapes', () => {
    for (const extra of [{ PTC: SP(4) }, { K: {} }, { V: {} }, { ifRender: null }, { window: 0.2 }]) {
      const store = rogueStore({ PAN: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, anchor: anchor('a1') }, ...extra })) as never });
      const before = store.getState();
      expectRejection(() => store.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
      expect(store.getState()).toBe(before);
    }
    const malformedTemporal = rogueStore({ PAN: ((s: CanonicalState) => ({ temporal: { kind: 'FOLLOW_LIVE', at: SP(2) }, inspection: s.inspection, camera: { ...s.camera, anchor: anchor('a1') } })) as never });
    expectRejection(() => malformedTemporal.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
    const malformedRef = rogueStore({ PAN: ((s: CanonicalState) => ({ temporal: s.temporal, inspection: s.inspection, camera: { ...s.camera, anchor: { kind: 'WORLD_ANCHOR', value: 'a1', extra: 1 } } })) as never });
    expectRejection(() => malformedRef.dispatch(pan), 'INVALID_CANONICAL_SHAPE');
  });

  it('honest kernel results keep passing the exact-shape rule', () => {
    const store = createCanonicalStore(init());
    expect(store.dispatch({ type: 'PAN', to: { anchor: anchor('a1'), destination: destination('d1') } }).outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'SESSION', to: { scale: scale('s1'), anchor: anchor('a2') } }).outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) }).outcome).toBe('APPLIED');
    expect(store.dispatch({ type: 'COMMIT_LIVE_EDGE' }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(4);
    expect(Object.keys(store.getState().camera).sort()).toEqual(['anchor', 'depth', 'destination', 'scale']);
  });
});

describe('the real kernel keeps temporal state and live truth untouched on spatial acts', () => {
  for (const temporal of [{ kind: 'FOLLOW_LIVE' } as const, { kind: 'PINNED', at: SP(3) } as const]) {
    it(`PAN and ZOOM_SEMANTIC under ${temporal.kind} (rows 5, 6)`, () => {
      const store = createCanonicalStore(init({ temporal }));
      const before = store.getState();
      store.dispatch({ type: 'PAN', to: { anchor: anchor('a1') } });
      store.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'THREAD', to: { scale: scale('s1') } });
      const after = store.getState();
      expect(after.temporal).toBe(before.temporal);
      expect(effectiveTC(after)).toBe(effectiveTC(before));
      expect(after.live).toBe(before.live);
      expect(after.inspection).toBe(before.inspection);
      expect(after.camera.anchor).toEqual(anchor('a1'));
      expect(after.camera.depth).toBe('THREAD');
      expect(after.camera.scale).toEqual(scale('s1'));
      expect(after.camera.orientation).toBeUndefined();
    });
  }
});
