/**
 * T-10 — the presentation camera: the rebase, the plan and the binding.
 *
 * The heart of this file is ONE invariant, and it is what makes "nothing teleports" a proof rather
 * than an impression:
 *
 *     rebase(before → after) applied to placeScene(scene, AFTER) reproduces placeScene(scene, BEFORE)
 *
 * If that holds, then the first frame painted after a canonical camera change is EXACTLY the frame
 * that was on the glass before it — for every canonically placed object, at any distance, at any
 * scale ratio. No timing is involved, nothing is "too fast to notice", and the one-frame cluster
 * §13 warns about is not merely unlikely but arithmetically impossible while the rebase is armed.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import {
  cameraTransition,
  decodeCameraIntent,
  envelopeCenter,
  panFromTranslation,
  placeScene,
  reinforcedScale,
  semanticZoom,
  type MapCamera,
} from '../../map';
import { encodeCameraIntent } from '../../map';
import {
  MOTION_DURATIONS_MS,
  REDUCED_RESOLVE_FROM_OPACITY,
  RESIDUAL_AT_REST,
  counterScale,
  presentationTravelPlan,
  rebasedResidual,
  residualIsAtRest,
  residualToScreen,
  screenToResidual,
  travelDurationMs,
  usePresentationCamera,
  type PresentationCameraBinding,
  type PresentationResidual,
} from '..';

const WORLD = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
      { id: 'thread-c', x: '-2500000', y: '1750000' },
    ],
    appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
    readings: [{ id: 'reading-1' }],
  });

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/** A camera at a different anchor and/or scale, built through the frozen T-04 interpreters only. */
function movedCamera(from: MapCamera, translationX: number, translationY: number): MapCamera {
  const resolution = panFromTranslation(from, translationX, translationY);
  if (resolution.outcome !== 'INTENT') throw new Error(`expected an intent, got ${resolution.outcome}`);
  const decoded = decodeCameraIntent(encodeCameraIntent({ ...from, anchor: resolution.anchor }));
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
}

function zoomedCamera(from: MapCamera, direction: 'IN' | 'OUT'): MapCamera {
  const resolution = semanticZoom(from, direction);
  if (resolution.outcome !== 'INTENT') throw new Error('expected a rung to move to');
  const decoded = decodeCameraIntent(encodeCameraIntent({ ...from, depth: resolution.depth, scale: reinforcedScale(from.scale, direction) }));
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
}

describe('T10 — the rebase preserves the visible frame exactly (A13, A36)', () => {
  const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
  const scene = contextOf(store, WORLD()).scene;
  const view = envelope();
  const center = envelopeCenter(view);

  const rebaseOf = (before: MapCamera, after: MapCamera): PresentationResidual => {
    const transition = cameraTransition(before, after, view);
    if (transition === null) throw new Error('expected a camera transition');
    if (transition.destination === null) throw new Error('expected a representable destination');
    return rebasedResidual(RESIDUAL_AT_REST, transition.k, transition.destination);
  };

  it.each([
    ['a short pan', (c: MapCamera) => movedCamera(c, -40, 25)],
    ['a long pan across the world', (c: MapCamera) => movedCamera(c, -1800, 1200)],
    ['a pan that only moves one axis', (c: MapCamera) => movedCamera(c, 0, -640)],
  ])('%s reproduces every placed node exactly', (_name, move) => {
    const before = cameraOf(store);
    const after = move(before);
    const residual = rebaseOf(before, after);
    const placedBefore = placeScene(scene, before, view);
    const placedAfter = placeScene(scene, after, view);
    expect(placedAfter.nodes.length).toBeGreaterThan(0);

    for (const node of placedAfter.nodes) {
      const original = placedBefore.nodes.find((candidate) => candidate.key === node.key);
      if (original === undefined) throw new Error(`node ${node.key} left the scene on a pure camera move`);
      const shown = residualToScreen({ x: node.x, y: node.y }, residual, center);
      // A pan changes no scale, so EVERY node — canonical Home, screen-space ring slot and all —
      // is drawn in the identical place it was drawn in one frame earlier.
      expect(shown.x).toBeCloseTo(original.x, 3);
      expect(shown.y).toBeCloseTo(original.y, 3);
    }
  });

  it.each([
    ['deeper', 'IN' as const],
    ['shallower', 'OUT' as const],
  ])('a Semantic Zoom %s reproduces every canonical Home exactly', (_name, direction) => {
    const before = cameraOf(testStore({ depth: 'SESSION' }));
    const after = zoomedCamera(before, direction);
    const residual = rebaseOf(before, after);
    const placedBefore = placeScene(scene, before, view);
    const placedAfter = placeScene(scene, after, view);

    const homes = placedAfter.nodes.filter((node) => node.locus?.kind === 'THREAD_HOME');
    expect(homes.length).toBeGreaterThan(0);
    for (const node of homes) {
      const original = placedBefore.nodes.find((candidate) => candidate.key === node.key);
      if (original === undefined) throw new Error('a Home left the scene on a depth change');
      const shown = residualToScreen({ x: node.x, y: node.y }, residual, center);
      expect(shown.x).toBeCloseTo(original.x, 3);
      expect(shown.y).toBeCloseTo(original.y, 3);
    }

    // A contextual appearance's ring slot is SCREEN space and deliberately not a world quantity,
    // so it is the one thing the rebase does not reproduce at a changed scale: it is carried at
    // the residual's scale and resolves to its own slot with the reinforcement. Stated here rather
    // than hidden, because it is the only place the frame is not literally identical.
    const appearance = placedAfter.nodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    const host = placedAfter.nodes.find((node) => node.locus?.kind === 'THREAD_HOME' && node.locus.threadId === 'thread-a');
    const appearanceBefore = placedBefore.nodes.find((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    const hostBefore = placedBefore.nodes.find((node) => node.locus?.kind === 'THREAD_HOME' && node.locus.threadId === 'thread-a');
    if (appearance === undefined || host === undefined || appearanceBefore === undefined || hostBefore === undefined) {
      throw new Error('expected a hosted appearance in both placements');
    }
    const shown = residualToScreen({ x: appearance.x, y: appearance.y }, residual, center);
    const shownOffset = { x: shown.x - hostBefore.x, y: shown.y - hostBefore.y };
    const trueOffset = { x: appearanceBefore.x - hostBefore.x, y: appearanceBefore.y - hostBefore.y };
    const k = direction === 'IN' ? 8 : 1 / 8;
    expect(shownOffset.x).toBeCloseTo(trueOffset.x / k, 3);
    expect(shownOffset.y).toBeCloseTo(trueOffset.y / k, 3);
  });

  it('a preserved frame keeps its SIZES, not only its positions (PM-04)', () => {
    // Found by the visual proof, not by a passing test: the plane's residual zoom would otherwise
    // scale every object with it, shrinking a Home to an eighth on a depth step and growing it
    // back — an optical zoom wearing Semantic Zoom's clothes.
    const before = cameraOf(testStore({ depth: 'SESSION' }));
    const after = zoomedCamera(before, 'IN');
    const residual = rebaseOf(before, after);
    // Undoing the plane's zoom about the object's own centre restores its true screen size.
    expect(residual.zoom * counterScale(residual.zoom)).toBeCloseTo(1, 12);
    expect(counterScale(residual.zoom)).toBeCloseTo(8, 9);
    // At rest it is the identity, so a still world carries no correction at all.
    expect(counterScale(RESIDUAL_AT_REST.zoom)).toBe(1);
    // And it never divides by zero.
    expect(counterScale(0)).toBe(1);
  });

  it('the inverse is exact, so a touch reaches what the eye sees (A37)', () => {
    const before = cameraOf(store);
    const after = movedCamera(before, -260, 140);
    const residual = rebaseOf(before, after);
    for (const point of [
      { x: 10, y: 10 },
      { x: 195, y: 422 },
      { x: 389, y: 843 },
    ]) {
      const canonical = screenToResidual(point, residual, center);
      const roundTrip = residualToScreen(canonical, residual, center);
      expect(roundTrip.x).toBeCloseTo(point.x, 6);
      expect(roundTrip.y).toBeCloseTo(point.y, 6);
    }
  });

  it('a rebase arriving mid-travel composes onto the residual on screen, never onto rest (A15)', () => {
    const before = cameraOf(store);
    const mid = movedCamera(before, -300, 0);
    const after = movedCamera(mid, -300, 0);
    const first = rebaseOf(before, mid);
    // Half way home: this is what is on the glass when the second act lands.
    const inFlight: PresentationResidual = { tx: first.tx / 2, ty: first.ty / 2, zoom: first.zoom };
    const second = cameraTransition(mid, after, view);
    if (second === null || second.destination === null) throw new Error('expected a representable second transition');
    const retargeted = rebasedResidual(inFlight, second.k, second.destination);

    const placedInFlight = residualToScreen({ x: 100, y: 100 }, inFlight, center);
    // The frame does not jump when the second act lands: the same world point is drawn in the same
    // place, one commit before and one commit after, under the NEW placement.
    const movedPoint = { x: 100 - 300, y: 100 };
    const placedAfter = residualToScreen(movedPoint, retargeted, center);
    expect(placedAfter.x).toBeCloseTo(placedInFlight.x, 3);
    expect(placedAfter.y).toBeCloseTo(placedInFlight.y, 3);
  });

  it('a completed drag leaves nothing to animate: the world holds its place (Q1)', () => {
    const before = cameraOf(store);
    // Exactly the frozen mechanic: one drag, committed from the finger's own total translation.
    const after = movedCamera(before, -137, 64);
    const residual = rebasedResidual({ tx: -137, ty: 64, zoom: 1 }, cameraTransition(before, after, view)!.k, cameraTransition(before, after, view)!.destination!);
    expect(residualIsAtRest(residual)).toBe(true);
    expect(
      presentationTravelPlan({
        residual,
        viewportDiagonalPoints: 928,
        representable: true,
        reducedMotion: false,
        depthChanged: false,
        cause: null,
      }).kind,
    ).toBe('AT_REST');
  });
});

describe('T10 — the travel plan (A17, A18, A19, A20, A33, A34)', () => {
  const plan = (residual: PresentationResidual, overrides: Partial<Parameters<typeof presentationTravelPlan>[0]> = {}) =>
    presentationTravelPlan({
      residual,
      viewportDiagonalPoints: 928,
      representable: true,
      reducedMotion: false,
      depthChanged: false,
      cause: null,
      ...overrides,
    });

  it('a residual at rest plans nothing at all', () => {
    expect(plan(RESIDUAL_AT_REST).kind).toBe('AT_REST');
    expect(plan({ tx: 1 / 4096, ty: 0, zoom: 1 }).kind).toBe('AT_REST');
  });

  it('a normal landing travels inside the 260–380 ms band', () => {
    const short = plan({ tx: 60, ty: 0, zoom: 1 });
    expect(short.kind).toBe('TRAVEL');
    expect(short.translationMs).toBeGreaterThanOrEqual(MOTION_DURATIONS_MS.travelMin);
    expect(short.translationMs).toBeLessThanOrEqual(MOTION_DURATIONS_MS.travelMax);
  });

  it('an exceptional same-world flight travels, never cuts, and stays under the ceiling (A17, A20)', () => {
    for (const distance of [1200, 4000, 25_000, 1_000_000]) {
      const long = plan({ tx: distance, ty: 0, zoom: 1 });
      expect(long.kind).toBe('TRAVEL');
      expect(long.translationMs).toBeLessThanOrEqual(MOTION_DURATIONS_MS.travelLongMax);
      expect(long.translationMs).toBeLessThanOrEqual(560);
      expect(long.translationMs).toBeGreaterThan(MOTION_DURATIONS_MS.travelMax);
    }
    // Monotonic in distance, and never a cut at any distance: a fade-teleport across one world is
    // exactly what the North Star forbids.
    expect(travelDurationMs(200, 928)).toBeLessThanOrEqual(travelDurationMs(900, 928));
    expect(travelDurationMs(900, 928)).toBeLessThanOrEqual(travelDurationMs(9000, 928));
  });

  it('no act-driven motion is ever underdamped (A19, A34)', () => {
    for (const residual of [{ tx: 40, ty: 0, zoom: 1 }, { tx: 0, ty: 0, zoom: 8 }, { tx: 2000, ty: 900, zoom: 0.125 }]) {
      expect(plan(residual).dampingRatio).toBe(1);
      expect(plan(residual, { reducedMotion: true }).dampingRatio).toBe(1);
      expect(plan(residual, { depthChanged: true }).dampingRatio).toBe(1);
    }
  });

  it('a depth step reinforces within the allowed overlap and inside the disclosure budget (A33)', () => {
    const depth = plan({ tx: 0, ty: 0, zoom: 8 }, { depthChanged: true });
    expect(depth.zoomDelayMs).toBeLessThanOrEqual(60);
    expect(depth.zoomDelayMs).toBeGreaterThanOrEqual(0);
    expect(depth.zoomMs).toBeGreaterThanOrEqual(240);
    // The lead and the duration are ONE budget: the reinforcement is finished 320 ms after the
    // ACT, not 320 ms after whenever it happened to start.
    expect(depth.zoomDelayMs + depth.zoomMs).toBeLessThanOrEqual(320);
    // And the disclosure it explains leads it, or starts with it — never the other way round.
    expect(MOTION_DURATIONS_MS.disclosure).toBeLessThanOrEqual(depth.zoomDelayMs + depth.zoomMs);
    // A scale change that is NOT a rung change is a local correction, not an explanation.
    expect(plan({ tx: 0, ty: 0, zoom: 1.02 }).zoomDelayMs).toBe(0);
  });

  it('reduced motion cuts the travel and keeps an opacity resolve (A18)', () => {
    const reduced = plan({ tx: 900, ty: 400, zoom: 8 }, { reducedMotion: true });
    expect(reduced.kind).toBe('CUT_AND_RESOLVE');
    expect(reduced.translationMs).toBe(0);
    expect(reduced.zoomMs).toBe(0);
    expect(reduced.resolveMs).toBeGreaterThanOrEqual(120);
    expect(reduced.resolveMs).toBeLessThanOrEqual(180);
  });

  it('the dip that covers a cut has ONE fixed depth (/review-animations R3)', () => {
    // Two cuts inside one resolve must read as two cuts. Deriving the dip from the weight already on
    // the glass fails that in both directions: with a beat the sample is stale by the time it lands
    // and drops the plane backwards, and without one a cut arriving late in a resolve is covered by
    // whatever is left — at 0.99 opacity, by nothing at all. A constant cannot be either, and the
    // plan carries no per-act depth for anything to derive one from.
    expect(REDUCED_RESOLVE_FROM_OPACITY).toBeGreaterThan(0);
    expect(REDUCED_RESOLVE_FROM_OPACITY).toBeLessThan(1);
    const cut = plan({ tx: 40, ty: 0, zoom: 1 }, { representable: false });
    expect(cut.kind).toBe('CUT_AND_RESOLVE');
    expect(Object.keys(cut)).not.toContain('resolveFromOpacity');
    expect(Object.keys(cut)).not.toContain('opacityFrom');
    // The cut and the dip share one delay, so they cannot be issued in different frames.
    expect(cut.spatialDelayMs).toBe(0);
    expect(cut.resolveMs).toBeGreaterThan(0);
  });

  it('a destination that is not representable resolves in place rather than inventing a path', () => {
    const unreachable = plan({ tx: 40, ty: 0, zoom: 1 }, { representable: false });
    expect(unreachable.kind).toBe('CUT_AND_RESOLVE');
  });

  it('only the composite act earns an explanatory beat, and only an 80–140 ms one (A48)', () => {
    const composite = plan({ tx: 600, ty: 0, zoom: 1 }, { cause: 'GO_LIVE_AND_LOCATE' });
    expect(composite.spatialDelayMs).toBeGreaterThanOrEqual(80);
    expect(composite.spatialDelayMs).toBeLessThanOrEqual(140);
    expect(plan({ tx: 600, ty: 0, zoom: 1 }).spatialDelayMs).toBe(0);
  });
});

describe('T10 — the binding (A14, A16, A29, A37)', () => {
  const options = { center: { x: 195, y: 422 }, diagonalPoints: 928 };

  /** Mounts the real hook and hands back the real binding. No stand-in anywhere in this block. */
  async function bind(): Promise<PresentationCameraBinding> {
    const holder: { current: PresentationCameraBinding | null } = { current: null };
    const keep = (binding: PresentationCameraBinding) => {
      holder.current = binding;
    };
    function Probe() {
      keep(usePresentationCamera(options));
      return null;
    }
    await render(<Probe />);
    if (holder.current === null) throw new Error('the presentation camera did not mount');
    return holder.current;
  }

  it('a drag is 1:1 in the plane, with no easing applied to it at all (A01, A02)', async () => {
    const camera = await bind();
    await act(async () => {
      camera.grab();
      camera.dragBy(10, -4);
      camera.dragBy(30, 9);
    });
    const transform = camera.planeTransform.get();
    expect(transform[0].translateX).toBeCloseTo(40, 6);
    expect(transform[1].translateY).toBeCloseTo(5, 6);
    expect(transform[2].scale).toBe(1);
  });

  it('an interruption is structural: there is no queue, only the latest truth (A14, A16)', async () => {
    const camera = await bind();
    await act(async () => {
      camera.applyCanonicalChange({ k: 1, destination: { x: 400, y: 0 }, depthChanged: false });
      // A finger arriving mid-travel owns the frame from that instant.
      camera.grab();
      camera.dragBy(12, 0);
    });
    // Nothing was queued behind the travel: the plane is exactly where the last mover put it.
    expect(camera.planeTransform.get()[0].translateX).toBeCloseTo(12, 6);
  });

  it('a canonical change with no camera movement plans nothing (A38, A51)', async () => {
    const camera = await bind();
    let kind = '';
    await act(async () => {
      kind = camera.applyCanonicalChange({ k: 1, destination: { x: 0, y: 0 }, depthChanged: false }).kind;
    });
    expect(kind).toBe('AT_REST');
    expect(camera.planeTransform.get()[0].translateX).toBe(0);
  });

  it('a reset drops the residual outright, leaving no old pixels behind (A29)', async () => {
    const camera = await bind();
    await act(async () => {
      camera.grab();
      camera.dragBy(80, 80);
      camera.reset();
    });
    expect(camera.planeTransform.get()).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
    expect(camera.planeOpacity.get()).toBe(1);
  });

  it('the canonical point under a touch is read through the residual on the glass (A37)', async () => {
    const camera = await bind();
    await act(async () => {
      camera.grab();
      camera.dragBy(50, 20);
    });
    // The world was dragged 50 points right, so a touch 50 points right of a node's canonical
    // placement is a touch ON that node.
    const canonical = camera.canonicalPointAt({ x: 150, y: 100 });
    expect(canonical.x).toBeCloseTo(100, 6);
    expect(canonical.y).toBeCloseTo(80, 6);
  });
});
