/**
 * T-10 R1 — the six integration findings of the independent Architecture + Motion review.
 *
 * Each one is a place where two different facts had been allowed to wear the same clothes:
 *
 *   R1-01  a drag that outlived its owner, replayed into a store that never saw the finger;
 *   R1-02  presentation culling wearing the clothes of semantic absence;
 *   R1-03  viewport entry wearing the clothes of semantic disclosure;
 *   R1-04  pointer parity proven for the camera but not for the object moving under it;
 *   R1-05  a composite cause that outlived the spatial phase it was supposed to explain;
 *   R1-06  a camera-presentation effect reaching screen-space material the camera never touched.
 *
 * R1-01 lives in `pan.test.tsx`, next to the rest of the drag mechanic. The other five are here.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import {
  MAP_ACCESSIBILITY_TEST_ID,
  MAP_SURFACE_PLANE_TEST_ID,
  MapSurface,
  decodeCameraIntent,
  envelopeCenter,
  hitTest,
  placeScene,
  type MapCamera,
  type PlacedScene,
} from '../../map';
import {
  RESIDUAL_AT_REST,
  arrivalPresentation,
  createArrivalRegistry,
  createMotionCauseChannel,
  disclosureArrivalPlan,
  isPresentedDuringTravel,
  newlyDisclosedKeys,
  rebasedResidual,
  screenToResidual,
  type SharedValue,
} from '..';

const view = envelope();
const center = envelopeCenter(view);

interface TreeNode {
  readonly props?: Record<string, unknown>;
  readonly children?: readonly unknown[];
}

/** Every circle the renderer actually asked Skia to paint, with the ancestors it sits under. */
function circles(json: unknown): { cx: number; cy: number; r: number; underOpacity: boolean }[] {
  const found: { cx: number; cy: number; r: number; underOpacity: boolean }[] = [];
  const walk = (node: unknown, opacityAbove: boolean): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as TreeNode;
    const props = record.props;
    const opacityHere = opacityAbove || (props !== undefined && props.opacity !== undefined && props.origin === undefined);
    if (props !== undefined && typeof props.cx === 'number' && typeof props.cy === 'number' && typeof props.r === 'number') {
      found.push({ cx: props.cx, cy: props.cy, r: props.r, underOpacity: opacityAbove });
    }
    for (const child of record.children ?? []) walk(child, opacityHere);
  };
  walk(json, false);
  return found;
}

/**
 * How many objects are wrapped in an ARRIVAL.
 *
 * The signature is exact and stable: only `DisclosureArrival` renders a group carrying BOTH an
 * opacity and an origin. The plane's own opacity group has no origin, and the per-object
 * counter-scale group has no opacity.
 */
function arrivalWrappers(json: unknown): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as TreeNode;
    const props = record.props;
    if (props !== undefined && props.opacity !== undefined && props.origin !== undefined) count += 1;
    for (const child of record.children ?? []) walk(child);
  };
  walk(json);
  return count;
}

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/** A Home placed at a chosen screen x, so a known number of pans carries it off the glass. */
const homeAtScreenX = (id: string, screenX: number): { id: string; x: string; y: string } => ({
  id,
  x: String(Math.round((screenX - center.x) * 8192)),
  y: '0',
});

// ---------------------------------------------------------------------------------------------
// R1-02 — presentation culling follows the presented viewport, not only the final canonical one
// ---------------------------------------------------------------------------------------------

describe('R1-02 — a current-V object does not vanish because the DESTINATION viewport excludes it', () => {
  const WORLD = () =>
    disclosureFixture({
      depth: 'THREAD',
      threads: [homeAtScreenX('thread-near-edge', 20), homeAtScreenX('thread-centre', 200)],
    });

  it('A13, A36 — it is still PAINTED where it was in the first rebased frame, then culled once it truly leaves', async () => {
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(store, WORLD());
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);

    const before = placeScene(context.scene, cameraOf(store), view);
    const edge = before.nodes.find((node) => node.id === 'thread-near-edge');
    if (edge === undefined) throw new Error('expected the edge Home');
    expect(edge.visible).toBe(true);
    expect(circles(rendered.toJSON()).some((circle) => Math.abs(circle.cx - edge.x) < 0.5)).toBe(true);

    // ONE authorized camera step to the right. The Home is still disclosed by exactly the same `V`.
    await act(async () => {
      fireEvent(rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN']);

    const after = placeScene(context.scene, cameraOf(store), view);
    const moved = after.nodes.find((node) => node.id === 'thread-near-edge');
    if (moved === undefined) throw new Error('the Home left the scene, which is not what this test is about');
    // The FINAL canonical viewport excludes it — which is exactly the trap.
    expect(moved.visible).toBe(false);
    // ...and it is still painted, because the presentation camera still shows it travelling out.
    const painted = circles(rendered.toJSON());
    expect(painted.some((circle) => Math.abs(circle.cx - moved.x) < 0.5)).toBe(true);
    // Semantic membership never wavered: it is still in current `V`.
    expect(context.scene.keys.has('THREAD:thread-near-edge')).toBe(true);

    // A second step, and now it has genuinely left the presented viewport too: culling may remove it.
    await act(async () => {
      fireEvent(rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });
    const gone = placeScene(context.scene, cameraOf(store), view).nodes.find((node) => node.id === 'thread-near-edge');
    if (gone === undefined) throw new Error('expected the Home to still be placed');
    expect(circles(rendered.toJSON()).some((circle) => Math.abs(circle.cx - gone.x) < 0.5)).toBe(false);
    // The centre Home was never in question.
    expect(circles(rendered.toJSON()).length).toBeGreaterThan(0);
  });

  it('at rest the presented set IS the resting viewport set: a still world paints what it always painted', () => {
    const node = { x: 500, y: 100, radius: 13 };
    // 500 is beyond the 390-wide viewport plus its 61-point margin.
    expect(isPresentedDuringTravel(node, RESIDUAL_AT_REST, center, view, 48)).toBe(false);
    expect(isPresentedDuringTravel({ x: 200, y: 400, radius: 13 }, RESIDUAL_AT_REST, center, view, 48)).toBe(true);
  });

  it('during travel the candidate set is a strict SUPERSET, and bounded by the travel itself', () => {
    // A travel that started 400 points to the right of where it ends: an object whose FINAL
    // position is off the left edge began on the glass, and must be painted travelling out.
    const travelling = rebasedResidual(RESIDUAL_AT_REST, 1, { x: 400, y: 0 });
    expect(travelling.tx).toBeCloseTo(400, 9);
    expect(isPresentedDuringTravel({ x: -300, y: 400, radius: 13 }, travelling, center, view, 48)).toBe(true);
    // The resting test would have removed it, which is exactly the frame the review caught.
    expect(isPresentedDuringTravel({ x: -300, y: 400, radius: 13 }, RESIDUAL_AT_REST, center, view, 48)).toBe(false);
    // And a node that is off the glass at BOTH ends of the travel is still not painted: the
    // superset is bounded by the travel, not opened up for everything.
    expect(isPresentedDuringTravel({ x: -3000, y: 400, radius: 13 }, travelling, center, view, 48)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// R1-03 — viewport entry is not disclosure
// ---------------------------------------------------------------------------------------------

describe('R1-03 — an arrival is a membership transition in V, never a mount', () => {
  it('Case A — an already-disclosed Home entering the viewport gets NO semantic arrival', async () => {
    const store = testStore({ depth: 'THREAD' });
    // Off the glass to the right, so a pan brings it in without `V` changing at all.
    const context = contextOf(
      store,
      disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-centre', 200), homeAtScreenX('thread-offscreen', 560)] }),
    );
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    await act(async () => {
      fireEvent(rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });
    await act(async () => {
      fireEvent(rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });

    // The camera moved; `V` did not. Ordinary spatial continuity, and not one frame of the grammar
    // that means "this became known".
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN', 'PAN']);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);
  });

  it('Case B — an already-disclosed contextual appearance entering the viewport does not unfold', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 560)],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        fireEvent(rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
      });
    }
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);
  });

  it('Case C — a locus that legitimately joins V DOES resolve, from its real current host', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const before = contextOf(
      store,
      disclosureFixture({ depth: 'ANALYTICAL_OBJECT', threads: [homeAtScreenX('thread-a', 200)], readings: [] }),
    );
    const rendered = await render(<MapSurface store={store} context={before} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    // The SAME viewpoint, now disclosing one more contextual appearance.
    const after = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200)],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    await act(async () => {
      rendered.rerender(<MapSurface store={store} context={after} envelope={view} />);
    });
    // Exactly one object became known, so exactly one thing resolves.
    expect(arrivalWrappers(rendered.toJSON())).toBe(1);
  });

  it('Case D — a remount with an identical V announces nothing as new', async () => {
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(store, disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', 200)] }));
    const first = await render(<MapSurface store={store} context={context} envelope={view} />);
    expect(arrivalWrappers(first.toJSON())).toBe(0);
    await act(async () => {
      first.unmount();
    });
    const second = await render(<MapSurface store={store} context={context} envelope={view} />);
    // A fresh surface has no earlier `V` for anything to have joined; it places, it does not arrive.
    expect(arrivalWrappers(second.toJSON())).toBe(0);
  });

  it('Case E - replacing the authority does not announce the new world as newly disclosed', async () => {
    const owner = testStore({ depth: 'THREAD' });
    const before = contextOf(owner, disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', 200)] }));
    const rendered = await render(<MapSurface store={owner} context={before} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    // A DIFFERENT authority: another world, none of whose loci were in the previous placement. Read
    // literally, every one of them is a membership transition -- and presenting them that way would
    // dress a whole-world truth cut in the grammar of meaning becoming known, which is the exact
    // category error R1-03 exists to prevent. The disclosure history belongs to the store it was
    // recorded under, the same way the drag and its residual do.
    const replacement = testStore({ depth: 'THREAD' });
    const after = contextOf(
      replacement,
      disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-b', 240), homeAtScreenX('thread-c', 300)] }),
    );
    await act(async () => {
      rendered.rerender(<MapSurface store={replacement} context={after} envelope={view} />);
    });
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    // And the replacement's OWN later disclosures still resolve: the history was re-based onto the
    // new authority, not switched off.
    const grown = contextOf(
      replacement,
      disclosureFixture({
        depth: 'THREAD',
        threads: [homeAtScreenX('thread-b', 240), homeAtScreenX('thread-c', 300), homeAtScreenX('thread-d', 160)],
      }),
    );
    await act(async () => {
      rendered.rerender(<MapSurface store={replacement} context={grown} envelope={view} />);
    });
    expect(arrivalWrappers(rendered.toJSON())).toBe(1);
  });

  it('the membership diff itself compares FULL placements, so culling can never look like disclosure', () => {
    // A key absent from the previous set is new; a key merely absent from the previous VIEWPORT is
    // not, because the previous set is the whole placement rather than what was on the glass.
    expect([...newlyDisclosedKeys(new Set(['a', 'b']), ['a', 'b', 'c'])]).toEqual(['c']);
    expect([...newlyDisclosedKeys(new Set(['a', 'b', 'c']), ['a', 'b', 'c'])]).toEqual([]);
    // The first painted frame is not an arrival.
    expect([...newlyDisclosedKeys(null, ['a', 'b'])]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// R1-04 — pointer parity for an object that is itself moving
// ---------------------------------------------------------------------------------------------

describe('R1-04 — a touch reaches an arriving object where it is DRAWN, not where it is going', () => {
  const registryAt = (key: string, progress: number, hostOffset: { x: number; y: number }) => {
    const registry = createArrivalRegistry();
    const plan = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset, reducedMotion: false });
    // A real registry, holding the very kind of value the component registers.
    const box = { value: progress, get: () => progress, set: () => undefined } as unknown as SharedValue<number>;
    registry.bind(key, plan, box);
    return { registry, plan };
  };

  /** Exactly the adjustment the surface applies before hit testing. */
  const drawn = (placed: PlacedScene, registry: ReturnType<typeof createArrivalRegistry>): PlacedScene => ({
    ...placed,
    visibleNodes: placed.visibleNodes.map((node) => {
      const shown = registry.presentationOf(node.key);
      return shown === null ? node : { ...node, x: node.x + shown.dx, y: node.y + shown.dy, radius: node.radius * shown.scale };
    }),
  });

  const arrivingScene = () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200)],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    return placeScene(context.scene, cameraOf(store), view);
  };

  it('mid-arrival, the drawn position hits and the final-only position does not', () => {
    const placed = arrivingScene();
    const appearance = placed.visibleNodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    const host = placed.visibleNodes.find((node) => node.locus?.kind === 'THREAD_HOME');
    if (appearance === undefined || host === undefined) throw new Error('expected a hosted appearance');

    const hostOffset = { x: host.x - appearance.x, y: host.y - appearance.y };
    const { registry, plan } = registryAt(appearance.key, 0.4, hostOffset);
    const shown = arrivalPresentation(plan, 0.4);
    const scene = drawn(placed, registry);

    // Where the renderer draws it: the same recipe, the same progress, the same numbers.
    const drawnPoint = { x: appearance.x + shown.dx, y: appearance.y + shown.dy };
    expect(hitTest(scene, drawnPoint)?.key).toBe(appearance.key);
    // Its final destination is not occupied yet, and must not answer for it.
    expect(hitTest(scene, { x: appearance.x, y: appearance.y })?.key).not.toBe(appearance.key);
    // The travel is real, so the two points are genuinely apart.
    expect(Math.hypot(shown.dx, shown.dy)).toBeGreaterThan(appearance.radius);
  });

  it('the same holds with a camera residual also in flight', () => {
    const placed = arrivingScene();
    const appearance = placed.visibleNodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    const host = placed.visibleNodes.find((node) => node.locus?.kind === 'THREAD_HOME');
    if (appearance === undefined || host === undefined) throw new Error('expected a hosted appearance');

    const hostOffset = { x: host.x - appearance.x, y: host.y - appearance.y };
    const { registry, plan } = registryAt(appearance.key, 0.35, hostOffset);
    const shown = arrivalPresentation(plan, 0.35);
    const residual = { tx: 70, ty: -25, zoom: 1 };
    const scene = drawn(placed, registry);

    // A touch at the point on the GLASS, converted through the plane residual exactly as the
    // surface converts it, then tested against the object's own drawn position.
    const onGlass = { x: appearance.x + shown.dx + residual.tx, y: appearance.y + shown.dy + residual.ty };
    expect(hitTest(scene, screenToResidual(onGlass, residual, center))?.key).toBe(appearance.key);
    // And the final-only position, seen through the same residual, still selects nothing.
    const finalOnGlass = { x: appearance.x + residual.tx, y: appearance.y + residual.ty };
    expect(hitTest(scene, screenToResidual(finalOnGlass, residual, center))?.key).not.toBe(appearance.key);
  });

  it('a resolved object is at its own placement again, and an object that never arrived is untouched', () => {
    const placed = arrivingScene();
    const appearance = placed.visibleNodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    if (appearance === undefined) throw new Error('expected an appearance');
    const { registry } = registryAt(appearance.key, 1, { x: -40, y: 0 });
    expect(hitTest(drawn(placed, registry), { x: appearance.x, y: appearance.y })?.key).toBe(appearance.key);
    // A key nobody registered is presented as itself: no arrival, no adjustment, no surprise.
    expect(createArrivalRegistry().presentationOf(appearance.key)).toBeNull();
  });

  it('the surface hit-tests an arriving object through the registry, not around it', async () => {
    // Live wiring: a genuinely new disclosure remains tappable at its own placement once resolved,
    // through the same pointer route, with the registry in the path.
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const before = contextOf(store, disclosureFixture({ depth: 'ANALYTICAL_OBJECT', threads: [homeAtScreenX('thread-a', 200)], readings: [] }));
    const rendered = await render(<MapSurface store={store} context={before} envelope={view} />);
    const after = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200)],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    await act(async () => {
      rendered.rerender(<MapSurface store={store} context={after} envelope={view} />);
    });
    const placed = placeScene(after.scene, cameraOf(store), view);
    const appearance = placed.visibleNodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    if (appearance === undefined) throw new Error('expected an appearance');
    await act(async () => {
      fireEvent(rendered.getByTestId(MAP_SURFACE_PLANE_TEST_ID), 'responderRelease', {
        nativeEvent: { locationX: appearance.x, locationY: appearance.y },
      });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT']);
  });
});

// ---------------------------------------------------------------------------------------------
// R1-05 — the composite cause may not outlive its spatial phase
// ---------------------------------------------------------------------------------------------

describe('R1-05 — the composite beat belongs to the landing that earned it', () => {
  const composite = (locate?: string, outcome = 'APPLIED') => ({ outcome, locate });

  it('APPLIED with no landing arms nothing, so a later camera act inherits no beat', () => {
    for (const locate of ['NO_FOCUS', 'NOT_ENTITLED', 'NOT_LOCATABLE', 'AMBIGUOUS_LOCUS', 'PROJECTION_NOT_AVAILABLE', 'STALE_PROJECTION', 'NOT_ATTEMPTED']) {
      const cause = createMotionCauseChannel();
      cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', composite(locate));
      expect(cause.take()).toBeNull();
    }
  });

  it('APPLIED but ALREADY_THERE arms nothing: no camera moved, so there is nothing to explain', () => {
    const cause = createMotionCauseChannel();
    cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', composite('ALREADY_THERE'));
    expect(cause.take()).toBeNull();
  });

  it('a real landing arms exactly one cause, and only the transition that consumes it gets the beat', () => {
    const cause = createMotionCauseChannel();
    cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', composite('LANDED'));
    expect(cause.take()).toBe('GO_LIVE_AND_LOCATE');
    // The next camera change — whatever moved it — explains itself.
    expect(cause.take()).toBeNull();
  });

  it('a rejected or no-op composite never arms', () => {
    for (const outcome of ['REJECTED', 'NO_OP']) {
      const cause = createMotionCauseChannel();
      cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', composite('LANDED', outcome));
      expect(cause.take()).toBeNull();
    }
  });

  it('any later return outcome clears a pending cause rather than letting it be inherited', () => {
    const cause = createMotionCauseChannel();
    cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', composite('LANDED'));
    // An unrelated act happens before any camera change consumed the beat.
    cause.noteReturnOutcome('BACK_ONE_STEP', { outcome: 'APPLIED', locate: 'NOT_ATTEMPTED' });
    expect(cause.take()).toBeNull();
  });

  it('no other act can borrow the composite beat, however it landed', () => {
    for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD']) {
      const cause = createMotionCauseChannel();
      cause.noteReturnOutcome(id, composite('LANDED'));
      expect(cause.take()).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// R1-06 — camera opacity belongs to the world plane
// ---------------------------------------------------------------------------------------------

describe('R1-06 — the screen-space register does not dim because the camera moved', () => {
  it('the register is painted OUTSIDE the plane opacity; the world plane is inside it', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200)],
        focuses: [{ id: 'focus-1', startedSp: 1 }],
        readings: [{ id: 'reading-orphan' }],
      }),
    );
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    const placed = placeScene(context.scene, cameraOf(store), view);
    const register = placed.visibleNodes.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');
    const plane = placed.visibleNodes.filter((node) => node.region === 'WORLD_PLANE');
    expect(register.length).toBeGreaterThan(0);
    expect(plane.length).toBeGreaterThan(0);

    const painted = circles(rendered.toJSON());
    for (const node of register) {
      const drawn = painted.find((circle) => Math.abs(circle.cx - node.x) < 0.5 && Math.abs(circle.cy - node.y) < 0.5);
      expect(drawn).toBeDefined();
      // Its position and its truth are unrelated to where the camera is, so a camera cut cannot
      // reach it: it sits under no camera-opacity group at all.
      expect(drawn!.underOpacity).toBe(false);
    }
    for (const node of plane) {
      const drawn = painted.find((circle) => Math.abs(circle.cx - node.x) < 0.5 && Math.abs(circle.cy - node.y) < 0.5);
      expect(drawn).toBeDefined();
      expect(drawn!.underOpacity).toBe(true);
    }
  });
});
