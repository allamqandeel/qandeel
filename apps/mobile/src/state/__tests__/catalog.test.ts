import {
  ACTION_CATALOG,
  AUTHORITATIVE_EVENT_TYPES,
  FROZEN_TASK_IDS,
  KERNEL_ACTION_TYPES,
  METADATA_ONLY_ACTION_TYPES,
  NON_STORE_IDENTITY_TYPES,
  PRODUCT_ACT_IDS,
  catalogEntry,
} from '../actions';
import { CanonicalStateError, OwnedByLaterTask, UnauthorizedActionClass, type CanonicalStateErrorCode } from '../authority';
import { opaqueRef, sessionPosition } from '../classes';
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
      expect(entry.authority.has('LH')).toBe(false);
      expect(entry.authority.has('LF')).toBe(false);
    }
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
      expect(entry.authority.size).toBe(0);
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
