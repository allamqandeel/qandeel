import { act, fireEvent, render } from '@testing-library/react-native';

import { SEMANTIC_DEPTHS, sessionPosition, type CanonicalStore } from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import {
  MAP_ACCESSIBILITY_TEST_ID,
  MAP_CONTAINER_NEUTRAL_LABEL,
  MAP_VIEWPORT_ACTIONS,
  buildMapAccessibilityTree,
  mapAccessibilityWithoutProjection,
} from '../accessibility';
import { decodeCameraIntent, zoomSemanticStep } from '../camera';
import { directJump, inspectObject, isCurrentMapContext, resolveEntitledInspection, inspectEntitled, switchContext } from '../inspection';
import { mapProjectionRequest } from '../projection';
import { MAP_CANVAS_TEST_ID, MAP_SURFACE_PLANE_TEST_ID, MAP_SURFACE_TEST_ID, MapSurface, placeScene } from '../renderer';

// R2-01 — the stale-V firewall.
//
// A disclosed projection is authority for exactly the canonical tuple it was disclosed for. Every
// test below takes a context that WAS valid, moves canonical state underneath it, and proves that
// nothing of the old projection survives: no paint, no hit target, no accessible node, no act, no
// RH — and that a fresh matching context restores all of it.

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '3000000', y: '0' },
];
const APPEARANCES = [
  { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
  { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
];

const analyticalDisclosure = (tc = 4, sessionId = 'session-1') =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    sessionId,
    tc,
    liveHead: Math.max(tc, 4),
    threads: WORLD,
    appearances: APPEARANCES,
    readings: [{ id: 'reading-1' }, { id: 'reading-only-at-analytical' }],
  });

const threadDisclosure = (tc = 4) =>
  disclosureFixture({ depth: 'THREAD', tc, liveHead: Math.max(tc, 4), threads: WORLD, appearances: APPEARANCES });

const cameraOf = (store: CanonicalStore) => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

const painted = (view: { toJSON: () => unknown }): string => JSON.stringify(view.toJSON() ?? null);

describe('STALE-01 — semantic depth drift hides the old deeper scene', () => {
  it('the AO-only object is present while the context is current', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, analyticalDisclosure());
    expect(context.scene.keys.has('READING:reading-only-at-analytical')).toBe(true);
    expect(isCurrentMapContext(store, context).fresh).toBe(true);
  });

  it('after ZOOM_SEMANTIC moves canonical depth, the stale scene is not painted, hit or announced', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, analyticalDisclosure());
    const camera = cameraOf(store);
    const placed = placeScene(context.scene, camera, envelope());
    const home = placed.nodes.find((node) => node.id === 'thread-a' && node.locus?.kind === 'THREAD_HOME');
    if (home === undefined) throw new Error('expected a placed Home');

    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    expect(view.getByTestId(MAP_CANVAS_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:READING:reading-only-at-analytical`)).toBeTruthy();

    // Canonical depth moves shallower. The context is NOT replaced.
    await act(async () => {
      expect(zoomSemanticStep(store, 'OUT').outcome).toBe('APPLIED');
    });
    expect(store.getState().camera.depth).toBe('SESSION');
    expect(isCurrentMapContext(store, context)).toMatchObject({ fresh: false, reason: 'SEMANTIC_DEPTH_CHANGED' });

    // Nothing of the old scene is painted, and the canvas itself is gone.
    expect(view.queryByTestId(MAP_CANVAS_TEST_ID)).toBeNull();
    expect(view.queryByTestId(MAP_SURFACE_PLANE_TEST_ID)).toBeNull();
    expect(painted(view)).not.toContain('"cx"');
    // No accessibility-only retention: the object nodes disappear with the pixels.
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:READING:reading-only-at-analytical`)).toBeNull();
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`)).toBeNull();
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();

    // R2-FIX-01 — and neither does the container carry stale disclosure semantics. A collection
    // role would publish a set size, and a label naming the old rung would tell a reader that the
    // Map still discloses it. Both are derived from the scene, so both are gone with it.
    const container = view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    expect(container.props.accessibilityRole).toBe('none');
    expect(container.props.accessibilityLabel).toBe(MAP_CONTAINER_NEUTRAL_LABEL);
    expect(container.props.accessibilityLabel).not.toContain('ANALYTICAL_OBJECT');
    expect(container.props.accessibilityLabel).not.toContain('disclosed at');
    for (const depth of SEMANTIC_DEPTHS) expect(container.props.accessibilityLabel).not.toContain(depth);
    // Nothing anywhere in the rendered surface still names the depth the scene was disclosed at.
    expect(painted(view)).not.toContain('ANALYTICAL_OBJECT');
    // The intentionally allowed viewport routes remain: they act on the camera, not on the world.
    expect((container.props.accessibilityActions as { name: string }[]).map((action) => action.name).sort()).toEqual([...MAP_VIEWPORT_ACTIONS].sort());
    await act(async () => {
      fireEvent(container, 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['ZOOM_SEMANTIC', 'PAN']);
    // Exploring moved the camera and nothing else: the context is still not this Map.
    expect(isCurrentMapContext(store, context).fresh).toBe(false);

    // And no object action can run from the stale context, by any route.
    const before = store.getState();
    expect(inspectObject(store, context, { family: 'READING', id: 'reading-only-at-analytical' })).toMatchObject({
      outcome: 'REJECTED',
      code: 'STALE_PROJECTION',
    });
    expect(directJump(store, context, { family: 'THREAD', id: 'thread-a' })).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['ZOOM_SEMANTIC', 'PAN']);
    await act(async () => {
      view.unmount();
    });
  });

  it('an entitlement minted from the deeper projection is refused after the depth moved', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, analyticalDisclosure());
    const entitled = resolveEntitledInspection(context.disclosure, { family: 'READING', id: 'reading-only-at-analytical' });
    if (!entitled.ok) throw new Error('the fixture target must be entitled');
    expect(entitled.entitled.projection).toEqual({ sessionId: 'session-1', tc: 4, depth: 'ANALYTICAL_OBJECT' });

    expect(zoomSemanticStep(store, 'OUT').outcome).toBe('APPLIED');
    const after = store.getState();
    // The `...Entitled` shortcut never sees a context, so the entitlement's own tuple is what
    // makes it refusable.
    expect(inspectEntitled(store, entitled.entitled)).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(after);
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().history).toHaveLength(1);
  });
});

describe('STALE-02 — a later-TC context cannot authorize at an earlier pinned TC', () => {
  it('fails closed with the state object-identical and RH unchanged', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT', liveHead: 10 });
    const context = contextOf(store, analyticalDisclosure(10));
    expect(isCurrentMapContext(store, context).fresh).toBe(true);

    // Canonical temporal state moves to an earlier Moment. The context stays in memory.
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(2) }).outcome).toBe('APPLIED');
    expect(mapProjectionRequest(store.getState())?.tc).toBe(2);
    expect(isCurrentMapContext(store, context)).toMatchObject({ fresh: false, reason: 'TEMPORAL_POSITION_CHANGED' });

    const after = store.getState();
    for (const attempt of [
      () => inspectObject(store, context, { family: 'READING', id: 'reading-1' }),
      () => switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } }),
      () => directJump(store, context, { family: 'THREAD', id: 'thread-b' }),
    ]) {
      expect(attempt()).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
      expect(store.getState()).toBe(after);
    }
    expect(store.getState().inspection).toBeNull();
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT']);
  });
});

describe('STALE-03 — a FOLLOW_LIVE head advance invalidates the old head context', () => {
  it('fails closed once LH moves, with zero mutation', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT', liveHead: 4 });
    const context = contextOf(store, analyticalDisclosure(4));
    expect(isCurrentMapContext(store, context).fresh).toBe(true);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });

    // The authoritative mirror advances; under FOLLOW_LIVE the effective TC moves with it.
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(5) }).outcome).toBe('APPLIED');
    expect(mapProjectionRequest(store.getState())?.tc).toBe(5);
    expect(isCurrentMapContext(store, context)).toMatchObject({ fresh: false, reason: 'TEMPORAL_POSITION_CHANGED' });

    const after = store.getState();
    expect(inspectObject(store, context, { family: 'THREAD', id: 'thread-a' })).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(after);
    expect(store.getState().inspection).toBeNull();
    // An authoritative event never writes RH, and the refused act adds nothing either.
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('STALE-04 — a context for another Session fails closed', () => {
  it('renders nothing, exposes no accessible object and authorizes nothing', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    // A structurally valid, internally coherent context — for a different Session.
    const foreign = { disclosure: analyticalDisclosure(4, 'session-other'), scene: contextOf(testStore({ depth: 'ANALYTICAL_OBJECT', sessionId: 'session-other' }), analyticalDisclosure(4, 'session-other')).scene };
    expect(isCurrentMapContext(store, foreign)).toMatchObject({ fresh: false, reason: 'SESSION_CHANGED' });

    const view = await render(<MapSurface store={store} context={foreign} envelope={envelope()} />);
    expect(view.queryByTestId(MAP_CANVAS_TEST_ID)).toBeNull();
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`)).toBeNull();
    expect(painted(view)).not.toContain('"cx"');

    const before = store.getState();
    expect(inspectObject(store, foreign, { family: 'THREAD', id: 'thread-a' })).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
    await act(async () => {
      view.unmount();
    });
  });

  it('a context whose disclosure and scene are different projections is incoherent, not current', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const current = contextOf(store, analyticalDisclosure());
    // A current scene paired with a foreign disclosure: the disclosure is the entitlement source,
    // so the pairing itself has to be refused.
    const spliced = { scene: current.scene, disclosure: analyticalDisclosure(4, 'session-other') };
    expect(isCurrentMapContext(store, spliced)).toMatchObject({ fresh: false, reason: 'CONTEXT_INCOHERENT' });
    const before = store.getState();
    expect(inspectObject(store, spliced, { family: 'THREAD', id: 'thread-a' })).toMatchObject({ outcome: 'REJECTED', code: 'STALE_PROJECTION' });
    expect(store.getState()).toBe(before);
  });
});

describe('STALE-05 — a fresh replacement restores the accepted behaviour', () => {
  it('after depth drift, a context for the new rung paints, announces and acts again', async () => {
    const store = testStore({ depth: 'THREAD' });
    const stale = contextOf(testStore({ depth: 'ANALYTICAL_OBJECT' }), analyticalDisclosure());
    expect(isCurrentMapContext(store, stale)).toMatchObject({ fresh: false, reason: 'SEMANTIC_DEPTH_CHANGED' });

    const staleView = await render(<MapSurface store={store} context={stale} envelope={envelope()} />);
    expect(staleView.queryByTestId(MAP_CANVAS_TEST_ID)).toBeNull();
    await act(async () => {
      staleView.unmount();
    });

    // A fresh V for the exact current (Session, TC, depth).
    const fresh = contextOf(store, threadDisclosure());
    expect(isCurrentMapContext(store, fresh).fresh).toBe(true);

    const view = await render(<MapSurface store={store} context={fresh} envelope={envelope()} />);
    expect(view.getByTestId(MAP_CANVAS_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`)).toBeTruthy();
    // The AO-only object is legitimately absent at THREAD depth — the fresh scene, not the old one.
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:READING:reading-only-at-analytical`)).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`), 'accessibilityAction', {
        nativeEvent: { actionName: 'inspect' },
      });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT']);

    // A context switch keeps the canonical identity, so the Reading is inspected through a named
    // context first; then all three promoted acts run exactly as accepted.
    expect(
      inspectObject(store, fresh, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } }).outcome,
    ).toBe('APPLIED');
    expect(switchContext(store, fresh, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } }).outcome).toBe('APPLIED');
    expect(directJump(store, fresh, { family: 'THREAD', id: 'thread-b' }).outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual([
      'INSPECT_OBJECT',
      'INSPECT_OBJECT',
      'SWITCH_CONTEXT',
      'DIRECT_JUMP',
    ]);
    await act(async () => {
      view.unmount();
    });
  });

  it('after a temporal move, a context for the new TC works again', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT', liveHead: 10 });
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(2) }).outcome).toBe('APPLIED');
    const fresh = contextOf(store, disclosureFixture({ depth: 'ANALYTICAL_OBJECT', tc: 2, liveHead: 10, threads: WORLD }));
    expect(isCurrentMapContext(store, fresh).fresh).toBe(true);
    expect(inspectObject(store, fresh, { family: 'THREAD', id: 'thread-a' }).outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT', 'INSPECT_OBJECT']);
  });
});

describe('R2-FIX-01 — a Map with no current projection publishes no disclosure semantics', () => {
  it('the no-projection tree is built without a scene and carries only the viewport routes', () => {
    const tree = mapAccessibilityWithoutProjection();
    expect(tree.nodes).toEqual([]);
    expect([...tree.keys]).toEqual([]);
    expect(tree.containerRole).toBe('none');
    expect(tree.containerLabel).toBe(MAP_CONTAINER_NEUTRAL_LABEL);
    // The label names the surface and nothing about a disclosure.
    for (const depth of SEMANTIC_DEPTHS) expect(tree.containerLabel).not.toContain(depth);
    expect(tree.containerLabel).not.toMatch(/disclosed|rung|depth|TC|Session/u);
    expect(tree.viewportActions.map((action) => action.name).sort()).toEqual([...MAP_VIEWPORT_ACTIONS].sort());
  });

  it('a fully disclosed scene still takes its collection role while it is current', async () => {
    const store = testStore({ depth: 'SOURCE_PROVENANCE' });
    const context = contextOf(
      store,
      disclosureFixture({ depth: 'SOURCE_PROVENANCE', threads: WORLD, appearances: APPEARANCES, readings: [{ id: 'reading-1' }] }),
    );
    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    const container = view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    // The accepted fresh behaviour is preserved exactly: the role and the label are unchanged.
    expect(container.props.accessibilityRole).toBe('list');
    expect(container.props.accessibilityLabel).toBe('Living Analysis Map, disclosed at SOURCE_PROVENANCE');
    expect(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`)).toBeTruthy();
    await act(async () => {
      view.unmount();
    });
  });

  it('a foreign-Session context publishes the neutral container too', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const foreign = {
      disclosure: analyticalDisclosure(4, 'session-other'),
      scene: contextOf(testStore({ depth: 'ANALYTICAL_OBJECT', sessionId: 'session-other' }), analyticalDisclosure(4, 'session-other')).scene,
    };
    const view = await render(<MapSurface store={store} context={foreign} envelope={envelope()} />);
    const container = view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    expect(container.props.accessibilityRole).toBe('none');
    expect(container.props.accessibilityLabel).toBe(MAP_CONTAINER_NEUTRAL_LABEL);
    expect(painted(view)).not.toContain('session-other');
    await act(async () => {
      view.unmount();
    });
  });
});

describe('the freshness rule is one rule, and it is the accepted projection tuple', () => {
  it('the accessible tree and the surface agree because both ask the same question', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, analyticalDisclosure());
    const camera = cameraOf(store);
    // The pure builders stay pure: they describe a scene, and the freshness rule decides whether
    // that scene may be shown at all.
    expect(buildMapAccessibilityTree(context.scene, camera, envelope()).nodes.length).toBeGreaterThan(0);
    expect(isCurrentMapContext(store, context).fresh).toBe(true);

    zoomSemanticStep(store, 'OUT');
    expect(isCurrentMapContext(store, context).fresh).toBe(false);
    // The tuple check is exactly the store's current projection request.
    const request = mapProjectionRequest(store.getState());
    expect(request).toMatchObject({ sessionId: 'session-1', tc: 4, depth: 'SESSION' });
    expect({ sessionId: context.scene.sessionId, tc: context.scene.tc, depth: context.scene.depth }).toMatchObject({
      sessionId: 'session-1',
      tc: 4,
      depth: 'ANALYTICAL_OBJECT',
    });
  });
});
