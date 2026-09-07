/**
 * T-10 R3 — the four final-path findings of the independent review, over the real Product paths.
 *
 * R1 and R2 corrected the seams. R3 is about the transitions those seams actually run on:
 *
 *   R3-01  a real canonical handoff makes this Map's context stale BEFORE the fresh one arrives, and
 *          the record of what was disclosed was being erased in exactly that gap — so Semantic Zoom,
 *          a committed temporal move and every Return that changes `TC` or depth compared the new
 *          world against nothing. And membership was read from a PLACEMENT, which omits a locus the
 *          camera cannot currently project, so representability could speak for the record;
 *   R3-02  the travel corridor never retired, started a retarget from rest rather than from the
 *          frame on the glass, and was bounded by an endpoint box that is not a bound at all once
 *          translation and reinforcement animate independently;
 *   R3-03  the R2 cut-cover held for a representable transition and not for the one case where the
 *          cut IS the whole transition;
 *   R3-04  the composite cause was a mailbox rather than a binding.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import {
  FINITE_PROJECTION_LIMIT_POINTS,
  MAP_SURFACE_TEST_ID,
  MapSurface,
  decodeCameraIntent,
  envelopeCenter,
  placeScene,
  zoomSemanticStep,
  type MapCamera,
} from '../../map';
import { sceneMembershipKeys } from '../../map/renderer/map-geometry';
import { sessionPosition } from '../../state';
import { returnLiveHead } from '../../return-navigation';
import { returnSurface, returnTestStore, world } from '../../return-navigation/__fixtures__/return';
import {
  RESIDUAL_AT_REST,
  RESIDUAL_ENVELOPE_AT_REST,
  envelopeHull,
  isPresentedWithinEnvelope,
  newlyDisclosedKeys,
  presentationTravelPlan,
  rebasedEnvelope,
  rebasedResidual,
  residualEnvelope,
  residualToScreen,
  type PresentationResidual,
} from '..';
import { arrivalWrappers, circles } from '../__fixtures__/paint';
import * as motionExports from '..';

const view = envelope();
const center = envelopeCenter(view);
const diagonalPoints = Math.hypot(view.width, view.height);

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/**
 * A Home placed at a chosen screen x under the store's CURRENT camera.
 *
 * Through the camera's own exact scale rather than a hard-coded factor, so a fixture written at one
 * rung still means what it says at another.
 */
const homeAtScreenX = (id: string, screenX: number, camera: MapCamera): { id: string; x: string; y: string } => ({
  id,
  x: String((BigInt(Math.round(screenX - center.x)) * camera.scale.numerator) / camera.scale.denominator),
  y: '0',
});

// ---------------------------------------------------------------------------------------------
// R3-01 — a projection handoff is a technical gap, not a change of world
// ---------------------------------------------------------------------------------------------

describe('R3-01 — semantic history survives a real stale to fresh projection handoff', () => {
  it('R3-A01 — a real Semantic Zoom handoff discloses the NEW loci and only those', async () => {
    const store = testStore({ depth: 'SESSION' });
    const shallow = cameraOf(store);
    // Close to the centre, so the rung change — which multiplies every offset — leaves the whole
    // world on the glass and the count below is about disclosure rather than about culling.
    const THREADS = [homeAtScreenX('thread-a', 195, shallow), homeAtScreenX('thread-b', 210, shallow)];

    const before = contextOf(store, disclosureFixture({ depth: 'SESSION', threads: THREADS }));
    const rendered = await render(<MapSurface store={store} context={before} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);
    const paintedBefore = circles(rendered.toJSON()).length;
    expect(paintedBefore).toBeGreaterThan(0);

    // The REAL canonical act. The store moves a rung; this Map's context is now for the old tuple.
    await act(async () => {
      expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    });
    // The stale frame: nothing of the old `V` survives it. Not dimmed, not held, not ghosted.
    expect(circles(rendered.toJSON())).toEqual([]);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    // The fresh projection for the new tuple, disclosing one contextual appearance the shallower
    // rung did not.
    const after = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: THREADS,
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    // What the record says joined, computed with the production functions rather than by hand.
    const joined = newlyDisclosedKeys(sceneMembershipKeys(before.scene), [...sceneMembershipKeys(after.scene)]);
    const placedAfter = placeScene(after.scene, cameraOf(store), view);
    const arriving = placedAfter.nodes.filter((node) => joined.has(node.key));
    expect(arriving.length).toBeGreaterThan(0);
    expect(arriving.every((node) => node.visible)).toBe(true);

    await act(async () => {
      rendered.rerender(<MapSurface store={store} context={after} envelope={view} />);
    });
    // Exactly the loci that JOINED resolve. The Homes that survived the rung change are placed, not
    // announced: with the old erase-on-stale rule NOTHING would have arrived — including the locus
    // that genuinely became known — and with a placement-derived record the survivors would have
    // arrived too.
    expect(arrivalWrappers(rendered.toJSON())).toBe(arriving.length);
    expect(arrivalWrappers(rendered.toJSON())).toBeLessThan(placedAfter.nodes.length);
    expect(circles(rendered.toJSON()).length).toBeGreaterThan(0);
  });

  it('R3-A02 — a real committed temporal move discloses what the new moment added, and only that', async () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(3) } });
    const camera = cameraOf(store);
    const THREAD_A = { id: 'thread-a', x: '0', y: '0' };
    const THREAD_B = { id: 'thread-b', x: '200000', y: '0' };

    const before = contextOf(store, world({ depth: 'SESSION', tc: 3, liveHead: 6, threads: [THREAD_A], focuses: [] }));
    const rendered = await render(<MapSurface store={store} context={before} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);
    expect(circles(rendered.toJSON()).length).toBeGreaterThan(0);

    // The REAL act. Effective `TC` moves from the pinned Moment to the Live Head, so this Map's
    // context is for a tuple that no longer exists.
    await act(async () => {
      expect(returnLiveHead(returnSurface(store)).outcome).toBe('APPLIED');
    });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // Nothing of the old moment survives the gap. Not one pixel.
    expect(circles(rendered.toJSON())).toEqual([]);

    const after = contextOf(store, world({ depth: 'SESSION', tc: 6, liveHead: 6, threads: [THREAD_A, THREAD_B], focuses: [] }));
    const joined = newlyDisclosedKeys(sceneMembershipKeys(before.scene), [...sceneMembershipKeys(after.scene)]);
    const arriving = placeScene(after.scene, camera, view).nodes.filter((node) => joined.has(node.key));
    expect(arriving.length).toBeGreaterThan(0);
    expect(arriving.every((node) => node.visible)).toBe(true);

    await act(async () => {
      rendered.rerender(<MapSurface store={store} context={after} envelope={view} />);
    });
    // The Thread the later moment added resolves; the one that was already known does not.
    expect(arrivalWrappers(rendered.toJSON())).toBe(arriving.length);
  });

  it('R3-A03 — a locus that merely became PROJECTABLE is not newly disclosed', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const deep = cameraOf(store);
    // Far enough that the exact projection is not finitely representable at this rung, and comfortably
    // representable one rung out. It is in `V` throughout: only the camera's arithmetic changes.
    const beyond = (FINITE_PROJECTION_LIMIT_POINTS * deep.scale.numerator * 2n) / deep.scale.denominator;
    const THREADS = [homeAtScreenX('thread-near', 200, deep), { id: 'thread-far', x: beyond.toString(), y: '0' }];

    const before = contextOf(store, disclosureFixture({ depth: 'ANALYTICAL_OBJECT', threads: THREADS }));
    // The premise: in the scene, absent from the placement. That is presentation, not membership.
    expect([...sceneMembershipKeys(before.scene)].some((key) => key.includes('thread-far'))).toBe(true);
    expect(placeScene(before.scene, deep, view).nodes.some((node) => node.id === 'thread-far')).toBe(false);

    const rendered = await render(<MapSurface store={store} context={before} envelope={view} />);
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);

    await act(async () => {
      expect(zoomSemanticStep(store, 'OUT').outcome).toBe('APPLIED');
    });
    const shallow = cameraOf(store);
    const after = contextOf(store, disclosureFixture({ depth: 'SESSION', threads: THREADS }));
    // Now it projects. Same locus, same `V`, different arithmetic.
    expect(placeScene(after.scene, shallow, view).nodes.some((node) => node.id === 'thread-far')).toBe(true);
    expect(sceneMembershipKeys(after.scene)).toEqual(sceneMembershipKeys(before.scene));

    await act(async () => {
      rendered.rerender(<MapSurface store={store} context={after} envelope={view} />);
    });
    // Nothing became known. Becoming drawable is not becoming true.
    expect(arrivalWrappers(rendered.toJSON())).toBe(0);
  });

  it('the membership set is the SCENE, so a placement can never widen or narrow it', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const deep = cameraOf(store);
    const beyond = (FINITE_PROJECTION_LIMIT_POINTS * deep.scale.numerator * 2n) / deep.scale.denominator;
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200, deep), { id: 'thread-far', x: beyond.toString(), y: '0' }],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
      }),
    );
    const membership = sceneMembershipKeys(context.scene);
    const placed = placeScene(context.scene, deep, view);
    // Every placed node's key is a membership key — one definition, used by both.
    for (const node of placed.nodes) expect(membership.has(node.key)).toBe(true);
    // And membership is strictly larger here, which is the whole point.
    expect(membership.size).toBeGreaterThan(placed.nodes.length);
    // A diff over the two would therefore call the far Home "new" the moment it projects.
    expect([...newlyDisclosedKeys(new Set(placed.nodes.map((node) => node.key)), [...membership])].length).toBeGreaterThan(0);
    expect([...newlyDisclosedKeys(membership, [...membership])]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// R3-02 — the culling corridor is a bound, starts where the camera starts, and retires
// ---------------------------------------------------------------------------------------------

describe('R3-02 — presentation culling is conservative, correctly seeded, and bounded in time', () => {
  /** The exact screen position under one residual: what the corridor has to contain. */
  const screenX = (worldX: number, residual: PresentationResidual) =>
    residualToScreen({ x: worldX, y: center.y }, residual, center).x;

  it('R3-A06 — the corridor contains every position a coupled zoom + translation can reach', () => {
    // A start the endpoint box gets WRONG. Translation and reinforcement animate independently, so
    // the plane can be at (tx=0, zoom=2) even though neither endpoint is.
    const start: PresentationResidual = { tx: 100, ty: 0, zoom: 2 };
    const corridor = envelopeHull(residualEnvelope(start), RESIDUAL_ENVELOPE_AT_REST);
    const worldX = center.x - 50;

    // The old endpoint box: between where it starts and where it ends.
    const endpointMin = Math.min(screenX(worldX, start), worldX);
    const endpointMax = Math.max(screenX(worldX, start), worldX);
    const uncoupled = screenX(worldX, { tx: 0, ty: 0, zoom: 2 });
    expect(uncoupled).toBeLessThan(endpointMin);
    expect(endpointMax).toBeGreaterThan(uncoupled);

    // Interval arithmetic answers for the whole RANGE at once, so it needs nothing to be true about
    // how the two animations progress — different durations, a delay, a lead, any of it.
    for (let translation = 0; translation <= 1.00001; translation += 0.05) {
      for (let reinforcement = 0; reinforcement <= 1.00001; reinforcement += 0.05) {
        const live: PresentationResidual = {
          tx: start.tx * (1 - translation),
          ty: 0,
          zoom: start.zoom + (1 - start.zoom) * reinforcement,
        };
        const x = screenX(worldX, live);
        // Contained, at every independent combination — and the object is a paint candidate there.
        expect(isPresentedWithinEnvelope({ x: worldX, y: center.y, radius: 13 }, corridor, center, view, 48)).toBe(true);
        expect(Number.isFinite(x)).toBe(true);
      }
    }

    // And the bound is a bound rather than an opening: something far outside every reachable
    // position is still culled.
    expect(isPresentedWithinEnvelope({ x: center.x - 40_000, y: center.y, radius: 13 }, corridor, center, view, 48)).toBe(false);
  });

  it('R3-A05 — a retarget corridor starts from the frame on the glass, not from rest', () => {
    // One long travel, then a second canonical change while it is still moving.
    const first = rebasedResidual(RESIDUAL_AT_REST, 1, { x: 900, y: 0 });
    const corridor1 = envelopeHull(residualEnvelope(first), RESIDUAL_ENVELOPE_AT_REST);
    // Held at a deterministic intermediate residual: 60 % of the way home.
    const live: PresentationResidual = { tx: first.tx * 0.4, ty: 0, zoom: 1 };
    expect(live.tx).toBeCloseTo(360, 9);

    const second = { k: 1, destination: { x: -200, y: 0 } };
    const corridor2 = envelopeHull(rebasedEnvelope(corridor1, second.k, second.destination), RESIDUAL_ENVELOPE_AT_REST);
    // What the camera itself will do at the retarget: rebase the LIVE residual.
    const rebasedLive = rebasedResidual(live, second.k, second.destination);

    // An object on the glass in that actual intermediate frame, whose destination is off the left.
    const worldX = -110;
    const shownNow = residualToScreen({ x: worldX, y: center.y }, rebasedLive, center).x;
    expect(shownNow).toBeGreaterThan(0);
    expect(shownNow).toBeLessThan(view.width);

    // The corrected corridor keeps it. The old rule — rebasing REST through the second transition —
    // drops it, which is the frame the review caught.
    expect(isPresentedWithinEnvelope({ x: worldX, y: center.y, radius: 13 }, corridor2, center, view, 48)).toBe(true);
    const fromRest = envelopeHull(rebasedEnvelope(RESIDUAL_ENVELOPE_AT_REST, second.k, second.destination), RESIDUAL_ENVELOPE_AT_REST);
    expect(isPresentedWithinEnvelope({ x: worldX, y: center.y, radius: 13 }, fromRest, center, view, 48)).toBe(false);

    // And the containment is structural rather than lucky: the rebase is affine, so every residual
    // inside the first corridor lands inside the second.
    for (let progress = 0; progress <= 1.00001; progress += 0.05) {
      const anywhere: PresentationResidual = { tx: first.tx * progress, ty: 0, zoom: 1 };
      const mapped = rebasedResidual(anywhere, second.k, second.destination);
      expect(mapped.tx).toBeGreaterThanOrEqual(corridor2.txMin - 1e-9);
      expect(mapped.tx).toBeLessThanOrEqual(corridor2.txMax + 1e-9);
    }
  });

  it('R3-A07, R3-A08 — the corridor retires to the resting cull, and an interruption leaves nothing behind', () => {
    const travelling = envelopeHull(residualEnvelope({ tx: 900, ty: 0, zoom: 1 }), RESIDUAL_ENVELOPE_AT_REST);
    const candidate = { x: center.x - 700, y: center.y, radius: 13 };
    expect(isPresentedWithinEnvelope(candidate, travelling, center, view, 48)).toBe(true);

    // A second travel mid-flight widens rather than replaces: nothing on the glass can blink because
    // the corridor changed owners.
    const interrupted = envelopeHull(rebasedEnvelope(travelling, 1, { x: -300, y: 0 }), RESIDUAL_ENVELOPE_AT_REST);
    expect(interrupted.txMin).toBeLessThanOrEqual(travelling.txMin - 300 + 1e-9);
    expect(interrupted.txMax).toBeGreaterThanOrEqual(0);

    // Retirement is the degenerate envelope, and it is EXACTLY the resting viewport test again.
    expect(isPresentedWithinEnvelope(candidate, RESIDUAL_ENVELOPE_AT_REST, center, view, 48)).toBe(false);
    expect(isPresentedWithinEnvelope({ x: 200, y: 400, radius: 13 }, RESIDUAL_ENVELOPE_AT_REST, center, view, 48)).toBe(true);
    expect(residualEnvelope(RESIDUAL_AT_REST)).toEqual(RESIDUAL_ENVELOPE_AT_REST);
  });

  it('R3-A09 — the screen-space register is culled by the resting viewport, whatever the world is doing', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const camera = cameraOf(store);
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [homeAtScreenX('thread-a', 200, camera)],
        focuses: [{ id: 'focus-1', startedSp: 1 }],
      }),
    );
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    const placed = placeScene(context.scene, camera, view);
    const register = placed.nodes.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');
    expect(register.length).toBeGreaterThan(0);

    const painted = circles(rendered.toJSON());
    for (const node of register) {
      // Present, at its own screen coordinates, and NOT under the plane's camera opacity group.
      const drawn = painted.find((circle) => Math.abs(circle.cx - node.x) < 0.5 && Math.abs(circle.cy - node.y) < 0.5);
      expect(drawn).toBeDefined();
      expect(drawn?.underOpacity).toBe(false);
    }

    // A world corridor is a claim about the world plane. Applied to a register slot it would widen
    // what is painted there for no reason, so the register is tested against rest, always.
    const worldCorridor = envelopeHull(residualEnvelope({ tx: 4000, ty: 0, zoom: 1 }), RESIDUAL_ENVELOPE_AT_REST);
    const offGlass = { x: -3600, y: 400, radius: 6 };
    expect(isPresentedWithinEnvelope(offGlass, worldCorridor, center, view, 48)).toBe(true);
    expect(isPresentedWithinEnvelope(offGlass, RESIDUAL_ENVELOPE_AT_REST, center, view, 48)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// R3-03 — no cut is exposed before the resolve that covers it
// ---------------------------------------------------------------------------------------------

describe('R3-03 — an unrepresentable transition earns no beat, so its cut cannot be exposed', () => {
  const plan = (options: { representable: boolean; reducedMotion?: boolean; cause?: 'GO_LIVE_AND_LOCATE' }) =>
    presentationTravelPlan({
      residual: options.representable ? { tx: 700, ty: 0, zoom: 1 } : RESIDUAL_AT_REST,
      viewportDiagonalPoints: diagonalPoints,
      representable: options.representable,
      reducedMotion: options.reducedMotion === true,
      depthChanged: false,
      cause: options.cause ?? null,
    });

  it('R3-A10 — a landed composite whose destination is unrepresentable cuts and resolves together', () => {
    const cut = plan({ representable: false, cause: 'GO_LIVE_AND_LOCATE' });
    expect(cut.kind).toBe('CUT_AND_RESOLVE');
    // Zero. The residual drop and the opacity dip are then issued in the same frame, so there is no
    // window in which the new viewpoint is on the glass at full weight.
    expect(cut.spatialDelayMs).toBe(0);
    expect(cut.resolveMs).toBeGreaterThan(0);
    expect(cut.translationMs).toBe(0);
    expect(cut.zoomMs).toBe(0);
  });

  it('R3-A11 — the same holds under reduced motion', () => {
    const cut = plan({ representable: false, reducedMotion: true, cause: 'GO_LIVE_AND_LOCATE' });
    expect(cut.kind).toBe('CUT_AND_RESOLVE');
    expect(cut.spatialDelayMs).toBe(0);
    expect(cut.resolveMs).toBeGreaterThan(0);

    // And a REPRESENTABLE reduced-motion composite keeps its beat: the residual there is a true
    // preserved frame, so the beat holds something real and the cut still lands under the dip.
    expect(plan({ representable: true, reducedMotion: true, cause: 'GO_LIVE_AND_LOCATE' }).spatialDelayMs).toBe(110);
  });

  it('R3-A12 — a representable composite TRAVEL keeps the legitimate beat, unchanged', () => {
    const travel = plan({ representable: true, cause: 'GO_LIVE_AND_LOCATE' });
    expect(travel.kind).toBe('TRAVEL');
    expect(travel.spatialDelayMs).toBe(110);
    expect(travel.translationMs).toBeGreaterThan(0);
    // Without a cause it is the same plan with no beat: the beat is the ONLY thing a cause changes.
    expect({ ...travel, spatialDelayMs: 0 }).toEqual(plan({ representable: true }));
  });
});

// ---------------------------------------------------------------------------------------------
// R3-04 — the composite binding is deferred, not narrowed
// ---------------------------------------------------------------------------------------------

describe('R3-04 — no production surface can arm the composite beat', () => {
  it('the Map surface takes no cause, and the motion barrel exports none', async () => {
    // The prop is gone: a surface that cannot be handed a cause cannot pass one on.
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(store, disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', 200, cameraOf(store))] }));
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    expect(rendered.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(Object.keys(motionExports).filter((name) => name.toLowerCase().includes('cause'))).toEqual([]);
  });
});
