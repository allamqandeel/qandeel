import {
  ACTION_CATALOG,
  AUTHORITATIVE_EVENT_TYPES,
  FROZEN_TASK_IDS,
  KERNEL_ACTION_TYPES,
  METADATA_ONLY_ACTION_TYPES,
  NON_STORE_IDENTITY_TYPES,
  PRODUCT_ACT_IDS,
  RH_ACTION_IDS,
  catalogEntry,
  isRhActionId,
} from '../actions';
import { CanonicalStateError, OwnedByLaterTask, UnauthorizedActionClass, UnauthorizedClassAWrite, type CanonicalStateErrorCode } from '../authority';
import { opaqueRef, sessionPosition, type CanonicalState } from '../classes';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

const SP = sessionPosition;

function init(): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'WORLD' },
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

const SIX_RETURN_ACTS = ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP'] as const;

describe('action registry invariants', () => {
  it('every identity is registered once, keyed by its own id, with a frozen owner', () => {
    expect(PRODUCT_ACT_IDS).toHaveLength(KERNEL_ACTION_TYPES.length + AUTHORITATIVE_EVENT_TYPES.length + METADATA_ONLY_ACTION_TYPES.length + NON_STORE_IDENTITY_TYPES.length);
    for (const id of PRODUCT_ACT_IDS) {
      const entry = ACTION_CATALOG[id];
      expect(entry.id).toBe(id);
      expect(FROZEN_TASK_IDS).toContain(entry.owner);
      expect(entry.frozenSource.length).toBeGreaterThan(0);
    }
  });

  it('the executable kernel is exactly four Product actions and two ingestion seams', () => {
    const kernel = PRODUCT_ACT_IDS.filter((id) => ACTION_CATALOG[id].level === 'KERNEL').sort();
    expect(kernel).toEqual(['COMMIT_LIVE_EDGE', 'COMMIT_MOMENT', 'LIVE_FOCUS_TRANSITION', 'LIVE_HEAD_ADVANCED', 'PAN', 'ZOOM_SEMANTIC']);
    for (const id of KERNEL_ACTION_TYPES) expect(ACTION_CATALOG[id].owner).toBe('T-02');
  });

  it('no Product action holds LH or LF authority; only the two events do (rows 1, 2)', () => {
    for (const id of PRODUCT_ACT_IDS) {
      const entry = ACTION_CATALOG[id];
      if (entry.cls === 'EVENT') continue;
      expect(entry.authority.includes('LH')).toBe(false);
      expect(entry.authority.includes('LF')).toBe(false);
    }
  });

  it('RH-eligible identities are exactly the Class-A Product acts; events and Class C / D are excluded (FIX-T02-03)', () => {
    expect([...RH_ACTION_IDS].sort()).toEqual([...KERNEL_ACTION_TYPES, ...METADATA_ONLY_ACTION_TYPES].sort());
    for (const id of RH_ACTION_IDS) expect(ACTION_CATALOG[id].cls).toBe('A');
    for (const id of [...AUTHORITATIVE_EVENT_TYPES, ...NON_STORE_IDENTITY_TYPES]) expect(isRhActionId(id)).toBe(false);
    expect(isRhActionId('NAVIGATE')).toBe(false);
    expect(isRhActionId(undefined)).toBe(false);
  });

  it('camera kernel authority is the EX02-03 minimum', () => {
    expect([...ACTION_CATALOG.PAN.authority].sort()).toEqual(['MC.anchor', 'MC.destination']);
    expect([...ACTION_CATALOG.ZOOM_SEMANTIC.authority].sort()).toEqual(['MC.anchor', 'MC.depth', 'MC.scale']);
    expect([...ACTION_CATALOG.COMMIT_MOMENT.authority]).toEqual(['TM']);
    expect([...ACTION_CATALOG.COMMIT_LIVE_EDGE.authority]).toEqual(['TM']);
  });

  it('Class C / D identities carry no authority and are never transactional', () => {
    for (const id of NON_STORE_IDENTITY_TYPES) {
      const entry = ACTION_CATALOG[id];
      expect(entry.level).toBe('NOT_STORE_ACTION');
      expect(['C', 'D']).toContain(entry.cls);
      expect(entry.authority.length).toBe(0);
      expect(entry.transactional).toBe('NEVER');
    }
  });

  it('the six return acts stay distinct and owned by T-07; no generic identity exists (rows 12, 13)', () => {
    for (const id of SIX_RETURN_ACTS) {
      expect(ACTION_CATALOG[id].level).toBe('METADATA_ONLY');
      expect(ACTION_CATALOG[id].owner).toBe('T-07');
    }
    expect(new Set(SIX_RETURN_ACTS).size).toBe(6);
    for (const generic of ['NAVIGATE', 'RESET', 'HOME', 'GO_LIVE', 'BACK', 'MAP_FOCUS_OBJECT', 'WORLD_TRUTH_UPDATED', 'INVALIDATE', 'REFRESH', 'SYNC_ALL', 'RESET_FROM_SERVER']) {
      expect(catalogEntry(generic)).toBeUndefined();
    }
    expect(catalogEntry(undefined)).toBeUndefined();
    expect(catalogEntry(42)).toBeUndefined();
    expect(catalogEntry('constructor')).toBeUndefined();
    expect(catalogEntry('__proto__')).toBeUndefined();
  });
});

describe('authority policy is runtime-immutable (FIX-T02-01)', () => {
  const snapshot = () => Object.fromEntries(PRODUCT_ACT_IDS.map((id) => [id, [...ACTION_CATALOG[id].authority]]));
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch {
      // a frozen target may throw; throwing is an acceptable outcome, silent no-effect is the other
    }
  };

  it('the registry, every entry and every authority array are frozen, and no authority is a Set', () => {
    expect(Object.isFrozen(ACTION_CATALOG)).toBe(true);
    for (const id of PRODUCT_ACT_IDS) {
      const entry = ACTION_CATALOG[id];
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Array.isArray(entry.authority)).toBe(true);
      expect(Object.isFrozen(entry.authority)).toBe(true);
      expect(entry.authority instanceof Set).toBe(false);
      expect('add' in (entry.authority as object)).toBe(false);
    }
    expect(Object.isFrozen(PRODUCT_ACT_IDS)).toBe(true);
    expect(Object.isFrozen(RH_ACTION_IDS)).toBe(true);
    expect(Object.isFrozen(KERNEL_ACTION_TYPES)).toBe(true);
    expect(Object.isFrozen(FROZEN_TASK_IDS)).toBe(true);
  });

  it('mutation attempts through runtime casts fail or have no effect; the policy is identical afterwards', () => {
    const before = snapshot();
    const panEntry = ACTION_CATALOG.PAN;
    const panAuthority = ACTION_CATALOG.PAN.authority;
    attempt(() => (ACTION_CATALOG.PAN.authority as unknown as string[]).push('LF'));
    attempt(() => (ACTION_CATALOG.PAN.authority as unknown as string[]).unshift('LF'));
    attempt(() => {
      (ACTION_CATALOG.ZOOM_SEMANTIC.authority as unknown as string[])[0] = 'LH';
    });
    attempt(() => {
      (ACTION_CATALOG.ZOOM_SEMANTIC.authority as unknown as string[]).length = 0;
    });
    attempt(() => (ACTION_CATALOG.ZOOM_SEMANTIC.authority as unknown as string[]).splice(0, 1, 'LH'));
    attempt(() => {
      (ACTION_CATALOG.PAN as unknown as { authority: string[] }).authority = ['LF', 'LH'];
    });
    attempt(() => {
      (ACTION_CATALOG as unknown as Record<string, unknown>).PAN = { ...ACTION_CATALOG.PAN, authority: ['LF'] };
    });
    attempt(() => Object.defineProperty(ACTION_CATALOG, 'PAN', { value: { ...ACTION_CATALOG.PAN, authority: ['LF'] } }));
    attempt(() => Object.defineProperty(ACTION_CATALOG.PAN, 'authority', { value: ['LF'] }));
    attempt(() => {
      delete (ACTION_CATALOG as unknown as Record<string, unknown>).PAN;
    });
    attempt(() => Object.setPrototypeOf(ACTION_CATALOG.PAN.authority, { includes: () => true }));
    expect(snapshot()).toEqual(before);
    expect(ACTION_CATALOG.PAN).toBe(panEntry);
    expect(ACTION_CATALOG.PAN.authority).toBe(panAuthority);
    expect([...ACTION_CATALOG.PAN.authority].sort()).toEqual(['MC.anchor', 'MC.destination']);
    expect([...ACTION_CATALOG.ZOOM_SEMANTIC.authority].sort()).toEqual(['MC.anchor', 'MC.depth', 'MC.scale']);
    expect(catalogEntry('PAN')).toBe(panEntry);
  });

  it('after the mutation attempts PAN still cannot write LF and ZOOM_SEMANTIC still cannot write LH', () => {
    const panStore = createCanonicalStore(init(), {
      actionTransitions: { PAN: ((s: CanonicalState) => ({ ...s, live: { ...s.live, LF: { value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'ef-9' }, atSp: SP(5) } } })) as never },
    });
    const panBefore = panStore.getState();
    const lf = expectRejection(() => panStore.dispatch({ type: 'PAN', to: { anchor: opaqueRef('WORLD_ANCHOR', 'a1') } }), 'UNAUTHORIZED_CLASS_A_WRITE') as UnauthorizedClassAWrite;
    expect(lf.field).toBe('LF');
    expect(panStore.getState()).toBe(panBefore);

    const zoomStore = createCanonicalStore(init(), {
      actionTransitions: { ZOOM_SEMANTIC: ((s: CanonicalState) => ({ ...s, live: { ...s.live, LH: SP(9) }, camera: { ...s.camera, depth: 'THREAD' } })) as never },
    });
    const zoomBefore = zoomStore.getState();
    const lh = expectRejection(() => zoomStore.dispatch({ type: 'ZOOM_SEMANTIC', depth: 'THREAD' }), 'UNAUTHORIZED_CLASS_A_WRITE') as UnauthorizedClassAWrite;
    expect(lh.field).toBe('LH');
    expect(zoomStore.getState()).toBe(zoomBefore);
  });
});

describe('store boundary for non-kernel identities', () => {
  it('a later-owner act fails closed with OwnedByLaterTask, state and RH untouched (row 16)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    for (const id of METADATA_ONLY_ACTION_TYPES) {
      const rejection = expectRejection(() => store.dispatch({ type: id } as never), 'OWNED_BY_LATER_TASK') as OwnedByLaterTask;
      expect(rejection.id).toBe(id);
      expect(rejection.owner).toBe(ACTION_CATALOG[id].owner);
    }
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('router back is not Back One Step: BACK_ONE_STEP is a T-07 Product act, never a route event (row 13)', () => {
    const store = createCanonicalStore(init());
    const rejection = expectRejection(() => store.dispatch({ type: 'BACK_ONE_STEP' } as never), 'OWNED_BY_LATER_TASK') as OwnedByLaterTask;
    expect(rejection.owner).toBe('T-07');
  });

  it('Class C / D identities fail through the non-store boundary without touching temporal state, camera or RH (rows 3, 4, 14)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    for (const id of NON_STORE_IDENTITY_TYPES) {
      const rejection = expectRejection(() => store.dispatch({ type: id, width: 375, height: 812, ptc: SP(4), offset: 0.5 } as never), 'UNAUTHORIZED_ACTION_CLASS') as UnauthorizedActionClass;
      expect(rejection.id).toBe(id);
    }
    expect(store.getState()).toBe(before);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);
  });

  it('a generic navigate(), a focus-traversal identity and a derived-state write are unknown (rows 8, 12, 24)', () => {
    const store = createCanonicalStore(init());
    const before = store.getState();
    for (const type of ['NAVIGATE', 'MAP_FOCUS_OBJECT', 'FOCUS_MOVED', 'SET_K_TC', 'SET_PROJECTION', 'RESET']) {
      expectRejection(() => store.dispatch({ type } as never), 'UNKNOWN_ACTION');
    }
    expectRejection(() => store.dispatch(undefined as never), 'UNKNOWN_ACTION');
    expectRejection(() => store.dispatch({} as never), 'UNKNOWN_ACTION');
    expect(store.getState()).toBe(before);
  });
});
