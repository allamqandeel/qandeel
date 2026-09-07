/**
 * T-07 — RN07-A: return-family authority isolation.
 *
 * Promoting six acts at once is the moment three boundaries could quietly open. What is proven here
 * is what a passing feature test would never notice: a forged return act is refused, a granted one
 * cannot be replayed or copied, neither neighbouring family's mint satisfies this seam and this
 * seam's mint satisfies neither of theirs, the raw dispatch surface reaches none of the six, and a
 * store built without a Return authority runs no return act at all.
 */
import {
  ACTION_CATALOG,
  MAP_ACTION_TYPES,
  RETURN_ACTION_TYPES,
  TEMPORAL_ACTION_TYPES,
  createCanonicalStore,
  sessionPosition,
  type CanonicalStore,
  type ReturnAction,
  type ReturnActionAuthority,
} from '../../state';
import { WORLD_ORIGIN, canonicalWorldAddress, initialCameraIntent, mapDestination, panByTranslation, spatialDestinationRef, worldAnchorRef } from '../../map';
import { RETURN_ACTION_AUTHORITY, backOneStep, returnLiveHead, returnWorld } from '../return-actions';
import * as publicSurface from '../index';
import { returnSurface, returnTestStore } from '../__fixtures__/return';

/** A canonical world address that is not the origin, so an injected camera write is a real change. */
function elsewhere() {
  const address = canonicalWorldAddress(4096n, 0n);
  if (!address.ok) throw new Error('fixture address must be canonical');
  return address.address;
}

/** A structurally PERFECT return act, built from the Map layer's own encoders — and never minted. */
const forgedReturnAction = (type: ReturnAction['type']): ReturnAction => {
  const destination = mapDestination('THREAD_HOME', 'thread-a', null, WORLD_ORIGIN);
  if (!destination.ok) throw new Error('fixture destination must encode');
  return { type, to: { anchor: worldAnchorRef(WORLD_ORIGIN), destination: spatialDestinationRef(destination.value) } } as ReturnAction;
};

/** Captures the exact action objects the layer sends to the canonical return seam. */
function capturingStore(inner: CanonicalStore): { readonly store: CanonicalStore; readonly sent: ReturnAction[] } {
  const sent: ReturnAction[] = [];
  const store: CanonicalStore = {
    getState: () => inner.getState(),
    subscribe: (listener) => inner.subscribe(listener),
    dispatch: (action) => inner.dispatch(action),
    dispatchMap: (action) => inner.dispatchMap(action),
    dispatchTemporal: (action) => inner.dispatchTemporal(action),
    dispatchReturn: (action) => {
      sent.push(action);
      return inner.dispatchReturn(action);
    },
    ingest: (event) => inner.ingest(event),
  };
  return { store, sent };
}

describe('RN07-A — the return-family authority boundary', () => {
  it('A1 — a forged return action is refused by the return seam, before any transition runs', () => {
    const store = returnTestStore();
    const before = store.getState();
    for (const type of RETURN_ACTION_TYPES) {
      expect(() => store.dispatchReturn(forgedReturnAction(type))).toThrow(/no runtime authorization/u);
    }
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('A2 — a valid-looking return act on the raw dispatch surface is refused by identity', () => {
    const store = returnTestStore();
    const before = store.getState();
    for (const type of RETURN_ACTION_TYPES) {
      expect(() => (store as unknown as { dispatch: (a: unknown) => unknown }).dispatch({ type })).toThrow(/authorized return seam/u);
    }
    expect(store.getState()).toBe(before);
  });

  it('A3, A4 — a return act reaches neither neighbouring seam', () => {
    const store = returnTestStore();
    for (const type of RETURN_ACTION_TYPES) {
      expect(() => (store as unknown as { dispatchMap: (a: unknown) => unknown }).dispatchMap({ type })).toThrow(/is not a promoted Map act/u);
      expect(() => (store as unknown as { dispatchTemporal: (a: unknown) => unknown }).dispatchTemporal({ type })).toThrow(/is not a promoted temporal act/u);
    }
  });

  it('A5, A6 — a Map act, a temporal act, a kernel act and an event are all refused by the return seam', () => {
    const store = returnTestStore();
    for (const type of [...MAP_ACTION_TYPES, ...TEMPORAL_ACTION_TYPES, 'PAN', 'COMMIT_LIVE_EDGE']) {
      expect(() => (store as unknown as { dispatchReturn: (a: unknown) => unknown }).dispatchReturn({ type })).toThrow(/is not a promoted return act/u);
    }
    expect(() => (store as unknown as { dispatchReturn: (a: unknown) => unknown }).dispatchReturn({ type: 'LIVE_HEAD_ADVANCED' })).toThrow(
      /cannot be dispatched as a Product action/u,
    );
    expect(() => (store as unknown as { dispatchReturn: (a: unknown) => unknown }).dispatchReturn({ type: 'CANCEL_PREVIEW' })).toThrow(
      /never reaches the canonical store/u,
    );
  });

  it('A7, A8 — a replayed consumed act and a structural copy of a granted act are both refused', () => {
    const inner = returnTestStore({ temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const capturing = capturingStore(inner);
    expect(returnLiveHead(returnSurface(capturing.store)).outcome).toBe('APPLIED');
    expect(capturing.sent).toHaveLength(1);
    const granted = capturing.sent[0];

    // The exact object again: its authorization was consumed on use.
    expect(() => inner.dispatchReturn(granted)).toThrow(/no runtime authorization/u);
    // A structurally perfect copy, and a JSON round trip, were never in the set at all.
    expect(() => inner.dispatchReturn({ ...granted })).toThrow(/no runtime authorization/u);
    expect(() => inner.dispatchReturn(JSON.parse(JSON.stringify(granted)) as ReturnAction)).toThrow(/no runtime authorization/u);
    expect(inner.getState().history).toHaveLength(1);
  });

  it('A9 — a store built without a Return authority fails closed for every one of the six', () => {
    const store = returnTestStore({ returnAuthority: false, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const before = store.getState();
    for (const type of RETURN_ACTION_TYPES) {
      expect(() => (store as unknown as { dispatchReturn: (a: unknown) => unknown }).dispatchReturn({ type })).toThrow(/without a Return authority/u);
    }
    // ...and so does every public executor, because there is no second path to canonical state.
    const surface = returnSurface(store);
    const live = returnLiveHead(surface);
    expect(live.outcome).toBe('REJECTED');
    if (live.outcome === 'REJECTED') {
      expect(live.code).toBe('UNAUTHORIZED_RETURN_ACTION');
      expect(live.detail).toMatch(/without a Return authority/u);
    }
    expect(returnWorld(surface).outcome).toBe('REJECTED');
    expect(panByTranslation(store, 120, 0).outcome).toBe('APPLIED');
    expect(backOneStep(surface).outcome).toBe('REJECTED');
    // The refused Back consumed nothing: the checkpoint the pan appended is still there.
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().temporal).toEqual(before.temporal);
  });

  it('A10 — an injected transition that writes outside a return act authority is still caught per field', () => {
    const authorized = new WeakSet<ReturnAction>();
    const verifier: ReturnActionAuthority = {
      consume(action) {
        if (!authorized.has(action)) return false;
        authorized.delete(action);
        return true;
      },
    };
    // `RETURN_LIVE_HEAD` holds `TM` alone. A transition that also moved the camera is rejected by the
    // per-field writer guard, not by a convention in the return layer.
    const store = createCanonicalStore(
      {
        session: { id: 'session-1' },
        live: { LH: sessionPosition(6), LF: { value: { kind: 'NONE' }, atSp: null } },
        temporal: { kind: 'PINNED', at: sessionPosition(2) },
        inspection: null,
        camera: initialCameraIntent(WORLD_ORIGIN, undefined, 'SESSION'),
      },
      {
        returnActionAuthority: verifier,
        actionTransitions: {
          RETURN_LIVE_HEAD: (state) => ({
            temporal: { kind: 'FOLLOW_LIVE' },
            inspection: state.inspection,
            camera: { ...state.camera, anchor: worldAnchorRef(elsewhere()) },
          }),
        },
      },
    );
    const before = store.getState();
    const action: ReturnAction = { type: 'RETURN_LIVE_HEAD' };
    authorized.add(action);
    expect(() => store.dispatchReturn(action)).toThrow(/attempted to write Class-A field MC\.anchor without authority/u);
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('R2-01 — the public barrel exposes the six executors and no semantic resolver, at runtime', () => {
    // The static contract pins the barrel's source; this pins the module OBJECT, so a re-export that
    // a regex could miss is caught too.
    const surface = Object.keys(publicSurface).sort();
    expect(surface).toEqual([
      'RETURN_ACTION_AUTHORITY',
      'RETURN_ACT_IDS',
      'backOneStep',
      'exactReturn',
      'goLiveAndLocate',
      // R2-01: the ONE authorized additive surface. A read-only boolean about current provenance,
      // for a presentation that must stop offering an act it can never perform. It grants nothing.
      'isCurrentReturnCheckpointTargetForStore',
      'isReturnCheckpointTarget',
      'latestReturnCheckpoint',
      'liveFocusReturnAvailability',
      'returnAvailability',
      'returnCheckpoints',
      'returnLiveFocus',
      'returnLiveHead',
      'returnMapContext',
      'returnNoOp',
      'returnRejected',
      'returnWorld',
    ]);
    // The six Product executors are the only public routes that execute return semantics...
    for (const executor of ['returnLiveHead', 'returnLiveFocus', 'goLiveAndLocate', 'returnWorld', 'exactReturn', 'backOneStep']) {
      expect(typeof (publicSurface as Record<string, unknown>)[executor]).toBe('function');
    }
    // ...and the raw semantic resolver is not reachable through the official surface at all, so a
    // later consumer cannot hand it an unproven context and read entitlement or locatability out.
    for (const internal of ['focusMapTarget', 'resolveFocusLanding', 'runReturnPlan', 'buildAction', 'requireCurrentContext', 'resolveCheckpointTarget', 'reportReturnDispatch']) {
      expect(surface.includes(internal)).toBe(false);
      expect((publicSurface as Record<string, unknown>)[internal]).toBeUndefined();
    }
  });

  it('the verifier can answer but never mint, and the six keep their frozen owner', () => {
    expect(Object.isFrozen(RETURN_ACTION_AUTHORITY)).toBe(true);
    expect(Object.keys(RETURN_ACTION_AUTHORITY)).toEqual(['consume']);
    expect(RETURN_ACTION_AUTHORITY.consume({ type: 'RETURN_LIVE_HEAD' })).toBe(false);
    expect(RETURN_ACTION_AUTHORITY.consume(null as unknown as ReturnAction)).toBe(false);
    for (const id of RETURN_ACTION_TYPES) expect(ACTION_CATALOG[id].owner).toBe('T-07');
  });
});
