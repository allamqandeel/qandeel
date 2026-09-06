import {
  ACTION_CATALOG,
  UnauthorizedActionClass,
  UnauthorizedMapAction,
  createCanonicalStore,
  effectiveTC,
  opaqueRef,
  sessionPosition,
  type CanonicalStore,
  type InspectionRef,
  type MapAction,
} from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { address, contextOf, envelope, testStore } from '../__fixtures__/store';
import { initialCameraIntent, exploreViewport, zoomSemanticStep } from '../camera';
import {
  MAP_ACTION_AUTHORITY,
  decodeInspectionRef,
  directJump,
  inspectObject,
  resolveEntitledInspection,
  switchContext,
} from '../inspection';
import { spatialDestinationRef, mapDestination, worldAnchorRef } from '../world';

// R1-01 — the Map entitlement authority boundary.
//
// The adversary here is an ordinary application caller who holds the canonical store and knows
// an object's identifier. The T-02 state API deliberately exports `opaqueRef`, so that caller can
// build a structurally perfect `InspectionRef`, `WORLD_ANCHOR` and `SPATIAL_DESTINATION` without
// ever touching `V`. Every test below builds exactly that and proves it cannot mutate anything.

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '3000000', y: '0' },
];

const DISCLOSURE = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: WORLD,
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    readings: [{ id: 'reading-1' }],
  });

/** A structurally valid inspection reference built WITHOUT the T-04 entitlement resolver. */
function forgedInspectionRef(family: string, id: string, bindingId?: string): InspectionRef {
  const base = {
    canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family, id }),
    depth: 'ANALYTICAL_OBJECT' as const,
    lineage: opaqueRef('LINEAGE', { route: 'forged' }),
  };
  return bindingId === undefined
    ? base
    : { ...base, contextualAppearance: opaqueRef('CONTEXTUAL_APPEARANCE', { kind: 'THREAD_READING', bindingId }) };
}

/** Every public route an application caller has to the canonical mutation boundary. */
function rawRoutes(store: CanonicalStore, action: MapAction): (() => unknown)[] {
  return [
    // The public kernel dispatch, exactly as the reviewed head allowed.
    () => (store as unknown as { dispatch: (a: MapAction) => unknown }).dispatch(action),
    // The authorized Map seam, called directly with an act nobody minted.
    () => store.dispatchMap(action),
  ];
}

function expectFailsClosed(store: CanonicalStore, action: MapAction): void {
  const before = store.getState();
  for (const route of rawRoutes(store, action)) {
    expect(route).toThrow(UnauthorizedMapAction);
    // Object identity, not deep equality: nothing was republished, so nothing was written.
    expect(store.getState()).toBe(before);
  }
  expect(store.getState().inspection).toBe(before.inspection);
  expect(store.getState().camera).toBe(before.camera);
  expect(store.getState().temporal).toBe(before.temporal);
  expect(store.getState().live).toBe(before.live);
  expect(store.getState().history).toBe(before.history);
}

describe('AUTH-01 — a forged inspect cannot reach canonical mutation', () => {
  it('fails closed on every public route, with zero IF_ref and zero RH mutation', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    expectFailsClosed(store, { type: 'INSPECT_OBJECT', ref: forgedInspectionRef('READING', 'reading-1') });
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().history).toHaveLength(0);
  });

  it('a structurally identical COPY of a legitimately authorized act is refused', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const entitled = resolveEntitledInspection(context.disclosure, { family: 'READING', id: 'reading-1' });
    if (!entitled.ok) throw new Error('the fixture target must be entitled');

    // The reference itself is genuine; only the act object is a copy the authority never minted.
    expectFailsClosed(store, { type: 'INSPECT_OBJECT', ref: entitled.entitled.ref });
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().history).toHaveLength(0);
  });

  it('an authorization is single-use: a legitimate act cannot be replayed', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const captured: MapAction[] = [];
    const original = store.dispatchMap.bind(store);
    const spy = { ...store, dispatchMap: (action: MapAction) => { captured.push(action); return original(action); } } as CanonicalStore;

    expect(inspectObject(spy, context, { family: 'READING', id: 'reading-1' }).outcome).toBe('APPLIED');
    expect(captured).toHaveLength(1);
    const after = store.getState();

    // The very object the authority authorized, replayed after its single use.
    expect(() => store.dispatchMap(captured[0])).toThrow(UnauthorizedMapAction);
    expect(store.getState()).toBe(after);
    expect(store.getState().history).toHaveLength(1);
  });

  it('a store built without a Map authority runs no Map act at all', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT', mapAuthority: false });
    const context = contextOf(store, DISCLOSURE());
    const before = store.getState();
    // Even the fully legitimate, V-resolved path fails closed: the boundary defaults to shut.
    expect(inspectObject(store, context, { family: 'READING', id: 'reading-1' })).toMatchObject({
      outcome: 'REJECTED',
      code: 'UNAUTHORIZED_MAP_ACTION',
    });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('AUTH-02 — a forged context switch cannot reach canonical mutation', () => {
  it('leaves a legitimate current inspection and RH untouched', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    expect(
      inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } }).outcome,
    ).toBe('APPLIED');
    const after = store.getState();

    // Same canonical identity, a structurally valid second appearance, no entitlement.
    expectFailsClosed(store, { type: 'SWITCH_CONTEXT', ref: forgedInspectionRef('READING', 'reading-1', 'binding-2') });
    expect(decodeInspectionRef(store.getState().inspection)?.appearance?.bindingId).toBe('binding-1');
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState()).toBe(after);
  });
});

describe('AUTH-03 — a forged direct jump cannot reach canonical mutation', () => {
  it('leaves IF_ref, the camera, temporal state, LF and RH untouched', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const destination = mapDestination('THREAD_HOME', 'thread-b', null, address(3_000_000n, 0n));
    if (!destination.ok) throw new Error('fixture destination');

    const before = store.getState();
    expectFailsClosed(store, {
      type: 'DIRECT_JUMP',
      ref: forgedInspectionRef('THREAD', 'thread-b'),
      to: {
        depth: 'ANALYTICAL_OBJECT',
        anchor: worldAnchorRef(address(3_000_000n, 0n)),
        destination: spatialDestinationRef(destination.value),
      },
    });

    expect(store.getState().inspection).toBeNull();
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().camera.destination).toBeUndefined();
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(effectiveTC(store.getState())).toBe(effectiveTC(before));
    expect(store.getState().live.LF).toBe(before.live.LF);
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('AUTH-04 — the legitimate V-resolved paths still work exactly as accepted', () => {
  it('INSPECT_OBJECT, SWITCH_CONTEXT and DIRECT_JUMP keep their accepted state and RH behaviour', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());

    expect(
      inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } }).outcome,
    ).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT']);

    // A true no-op is still a no-op: the authority does not turn one into a transaction.
    expect(
      inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } }),
    ).toEqual({ outcome: 'NO_OP' });
    expect(store.getState().history).toHaveLength(1);

    expect(
      switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } }).outcome,
    ).toBe('APPLIED');
    expect(decodeInspectionRef(store.getState().inspection)?.appearance?.bindingId).toBe('binding-2');

    expect(directJump(store, context, { family: 'THREAD', id: 'thread-b' }).outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP']);

    // The kernel acts are untouched by the split and still run on the public dispatch.
    expect(exploreViewport(store, envelope(), 'RIGHT').outcome).toBe('APPLIED');
    expect(zoomSemanticStep(store, 'OUT').outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual([
      'INSPECT_OBJECT',
      'SWITCH_CONTEXT',
      'DIRECT_JUMP',
      'PAN',
      'ZOOM_SEMANTIC',
    ]);
    // Still no temporal or LF write anywhere on the authorized path.
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().live.LF.value).toEqual({ kind: 'NONE' });
  });

  it('a multi-context direct jump still refuses to elect, and writes nothing', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const before = store.getState();
    const outcome = directJump(store, context, { family: 'READING', id: 'reading-1' });
    expect(outcome.outcome).toBe('CONTEXT_SELECTION_REQUIRED');
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('AUTH-05 — knowing an identifier is not entitlement', () => {
  it('a future, off-depth or unknown identity cannot reach mutation by any route', () => {
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'THREAD',
        threads: WORLD,
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    const before = store.getState();

    // Off-depth: the ANALYTICAL_OBJECT rung is withheld, so a Material is not entitled...
    expect(inspectObject(store, context, { family: 'MATERIAL', id: 'material-1' })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    // ...and constructing its reference by hand does not help either.
    expectFailsClosed(store, { type: 'INSPECT_OBJECT', ref: forgedInspectionRef('MATERIAL', 'material-1') });
    // A future identity whose id the caller happens to know.
    expect(inspectObject(store, context, { family: 'READING', id: 'reading-not-yet' })).toMatchObject({ outcome: 'REJECTED', code: 'NOT_ENTITLED' });
    expectFailsClosed(store, { type: 'INSPECT_OBJECT', ref: forgedInspectionRef('READING', 'reading-not-yet') });

    expect(store.getState()).toBe(before);
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('the authority is a runtime property, not a type claim or a flag', () => {
  it('the verifier can answer but cannot mint, and mints nothing for a look-alike', () => {
    // `MAP_ACTION_AUTHORITY` exposes exactly one member: `consume`. There is no `grant`, no
    // `authorize`, no set to add to, and the object is frozen.
    expect(Object.keys(MAP_ACTION_AUTHORITY)).toEqual(['consume']);
    expect(Object.isFrozen(MAP_ACTION_AUTHORITY)).toBe(true);
    const forged = { type: 'INSPECT_OBJECT', ref: forgedInspectionRef('READING', 'reading-1') } as const;
    expect(MAP_ACTION_AUTHORITY.consume(forged)).toBe(false);
    // Neither a boolean flag nor a token string changes the answer.
    expect(MAP_ACTION_AUTHORITY.consume({ ...forged, authorized: true } as unknown as MapAction)).toBe(false);
    expect(MAP_ACTION_AUTHORITY.consume({ ...forged, authorization: 'MAP_ACTION_AUTHORITY' } as unknown as MapAction)).toBe(false);
    expect(MAP_ACTION_AUTHORITY.consume(null as unknown as MapAction)).toBe(false);
  });

  it('a permissive authority is a different store, and never the canonical one', () => {
    const permissive = createCanonicalStore(
      {
        session: { id: 'session-1' },
        live: { LH: sessionPosition(4), LF: { value: { kind: 'NONE' }, atSp: null } },
        temporal: { kind: 'FOLLOW_LIVE' },
        inspection: null,
        camera: initialCameraIntent(),
      },
      { mapActionAuthority: { consume: () => true } },
    );
    // The canonical store built with the real authority is unaffected by anyone else's store.
    const canonical = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const before = canonical.getState();
    permissive.dispatchMap({ type: 'INSPECT_OBJECT', ref: forgedInspectionRef('READING', 'reading-1') });
    expect(canonical.getState()).toBe(before);
    expectFailsClosed(canonical, { type: 'INSPECT_OBJECT', ref: forgedInspectionRef('READING', 'reading-1') });
  });

  it('the Map seam runs only promoted Map acts, and the kernel dispatch runs only kernel acts', () => {
    const store = testStore();
    const before = store.getState();
    // A kernel act cannot borrow the Map seam...
    expect(() => (store as unknown as { dispatchMap: (a: unknown) => unknown }).dispatchMap({ type: 'COMMIT_LIVE_EDGE' })).toThrow(UnauthorizedActionClass);
    // ...and an act of another promoted family reaches neither entry point.
    expect(() => (store as unknown as { dispatchMap: (a: unknown) => unknown }).dispatchMap({ type: 'BACK_ONE_STEP' })).toThrow(UnauthorizedActionClass);
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
    for (const id of ['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'] as const) {
      expect(ACTION_CATALOG[id].level).toBe('EXECUTABLE');
    }
  });
});
