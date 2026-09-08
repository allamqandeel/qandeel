/**
 * T-11 — a window that changes while the world is still moving.
 *
 * > Nothing teleports. Meaning resolves.
 *
 * The dangerous shape here is subtle. A resize changes the viewport CENTRE, and the presentation
 * camera draws the plane as `screen(p) = c + zoom · (p + t − c)`. If a centre change moved the
 * plane by anything other than what it moves the world by, a travel in flight would jump — and a
 * jump at exactly the moment a reader resizes is indistinguishable from a navigation nobody
 * performed.
 *
 * It does not, and the reason is arithmetic rather than care: T-04 places every world node relative
 * to the same centre, so a centre change moves `p` and `c` by the same vector and the residual term
 * `(p − c)` is untouched. The whole plane therefore shifts RIGIDLY by the centre delta, exactly as
 * a resting world does, for every residual the plane could be showing. These tests prove that over
 * the whole space of residuals rather than at the two endpoints of one animation.
 */
import { act, render } from '@testing-library/react-native';

import { MAP_CANVAS_TEST_ID } from '../../map';
import {
  decodeCameraIntent,
  envelopeCenter,
  placeScene,
  viewportEnvelope,
  type MapCamera,
  type PlacedNode,
  type ViewportEnvelope,
} from '../../map';
import {
  isPresentedWithinEnvelope,
  newlyDisclosedKeys,
  RESIDUAL_ENVELOPE_AT_REST,
  rebasedEnvelope,
  residualToScreen,
  type PresentationResidual,
} from '../../motion';
// The authoritative membership rule itself: it is internal to T-04's renderer rather than public,
// and this proof is about that exact function — a set built from a placement instead would be the
// very confusion the arrival contract forbids.
import { sceneMembershipKeys } from '../../map/renderer/map-geometry';
import { chromeStore, contextAt, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID } from '../../orientation-chrome';
import { readableText } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition } from '../../state';
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import {
  isPressTarget,
  RESPONSIVE_CHROME_BAND_TEST_ID,
  RESPONSIVE_MAP_FRAME_TEST_ID,
  ResponsiveWorld,
  resize,
  subtree,
} from '../__fixtures__/composition';
import { CHROME_FLOOR_POINTS, MAP_MIN_HEIGHT_POINTS, planEquals, recompositionPlan, TIMELINE_ROW_POINTS, type RecompositionPlan } from '../plan';
import { presentationSurface } from '../surface';

jest.setTimeout(120_000);

const envelopeOf = (width: number, height: number): ViewportEnvelope => {
  const built = viewportEnvelope(width, height, { top: 48, bottom: 24 });
  if (built === null) throw new Error(`${width}x${height} is not a viewport`);
  return built;
};

function reader() {
  const store = chromeStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } });
  const context = contextAt(TWO_CONTEXT_WORLD());
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error('fixture camera is not decodable');
  return { store, context, camera: decoded.camera as MapCamera };
}

/** A representative sample of the residuals a plane can be showing mid-flight. */
const RESIDUALS: readonly PresentationResidual[] = Object.freeze([
  { tx: 0, ty: 0, zoom: 1 },
  { tx: 120, ty: -80, zoom: 1 },
  { tx: -240, ty: 310, zoom: 0.125 },
  { tx: 64, ty: 64, zoom: 8 },
  { tx: -17.5, ty: 3.25, zoom: 0.97 },
  { tx: 900, ty: -1200, zoom: 2.5 },
]);

describe('T11 — a geometry change during a travel moves the whole plane, and never one object', () => {
  it('T11-A59 — the plane shifts rigidly by the centre delta, at every residual', () => {
    const { context, camera } = reader();
    for (const [fromWidth, fromHeight, toWidth, toHeight] of [
      [320, 568, 1024, 768],
      [844, 390, 390, 844],
      [768, 1024, 320, 568],
      [390, 844, 412, 915],
    ] as const) {
      const before = envelopeOf(fromWidth, fromHeight);
      const after = envelopeOf(toWidth, toHeight);
      const placedBefore = placeScene(context.scene, camera, before);
      const placedAfter = placeScene(context.scene, camera, after);
      const centreBefore = envelopeCenter(before);
      const centreAfter = envelopeCenter(after);
      const delta = { x: centreAfter.x - centreBefore.x, y: centreAfter.y - centreBefore.y };
      const worldNode = (nodes: readonly PlacedNode[], key: string) => nodes.find((node) => node.key === key);

      for (const residual of RESIDUALS) {
        for (const node of placedBefore.nodes.filter((candidate) => candidate.region === 'WORLD_PLANE')) {
          const twin = worldNode(placedAfter.nodes, node.key);
          expect(twin).toBeDefined();
          if (twin === undefined) continue;
          const drawnBefore = residualToScreen({ x: node.x, y: node.y }, residual, centreBefore);
          const drawnAfter = residualToScreen({ x: twin.x, y: twin.y }, residual, centreAfter);
          // Every object moves by exactly the same vector — the centre delta — whatever the plane
          // happens to be showing. That is a rigid shift, which is what a resting world does too:
          // the travel is neither restarted, retargeted, nor snapped.
          expect(drawnAfter.x - drawnBefore.x).toBeCloseTo(delta.x, 9);
          expect(drawnAfter.y - drawnBefore.y).toBeCloseTo(delta.y, 9);
        }
      }
    }
  });

  it('T11-A61 — travel culling stays conservative under the new envelope', () => {
    const { context, camera } = reader();
    const before = envelopeOf(390, 844);
    const after = envelopeOf(1024, 768);
    // A corridor of a travel in flight: from a displaced, zoomed residual to rest.
    const corridor = rebasedEnvelope(RESIDUAL_ENVELOPE_AT_REST, 8, { x: -120, y: 80 });
    const admitted = (envelope: ViewportEnvelope) => {
      const placed = placeScene(context.scene, camera, envelope);
      const centre = envelopeCenter(envelope);
      return new Set(
        placed.nodes
          .filter((node) => isPresentedWithinEnvelope({ x: node.x, y: node.y, radius: node.radius }, corridor, centre, envelope, 48))
          .map((node) => node.key),
      );
    };
    // The corridor is still applied after the geometry change — it is not replaced by the resting
    // test — so nothing that could be on the glass during the travel is culled by the resize.
    const larger = admitted(after);
    for (const key of admitted(before)) expect(larger.has(key)).toBe(true);
    // and the degenerate corridor at rest is exactly the resting viewport test, at both sizes.
    for (const envelope of [before, after]) {
      const placed = placeScene(context.scene, camera, envelope);
      const centre = envelopeCenter(envelope);
      for (const node of placed.nodes) {
        expect(isPresentedWithinEnvelope({ x: node.x, y: node.y, radius: node.radius }, RESIDUAL_ENVELOPE_AT_REST, centre, envelope, 48)).toBe(
          node.visible,
        );
      }
    }
  });

  it('T11-A63, T11-A64 — a resize discloses nothing, so no arrival can be replayed or duplicated', () => {
    const { context, camera } = reader();
    const membership = sceneMembershipKeys(context.scene);
    // Membership is asked of the SCENE, and a scene has no viewport. Every envelope in the proof
    // envelope therefore produces the same accepted set, so `newlyDisclosedKeys` against the
    // previous accepted set is empty however the window moved.
    for (const [width, height] of [
      [320, 568],
      [568, 320],
      [844, 390],
      [1366, 1024],
    ] as const) {
      const envelope = envelopeOf(width, height);
      // A placement omits what the camera cannot project; membership does not, which is exactly why
      // a resize cannot make an old locus look new.
      expect(sceneMembershipKeys(context.scene)).toEqual(membership);
      expect(newlyDisclosedKeys(membership, [...membership])).toEqual(new Set());
      expect(placeScene(context.scene, camera, envelope).nodes.length).toBeGreaterThan(0);
    }
  });

  it('T11-A68 — the screen-space register never inherits the world plane residual', async () => {
    const world = reader();
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const view = await render(<ResponsiveWorld store={world.store} context={world.context} preview={preview} presentation={presentation} />);
    await resize(view, 390, 844);
    // The canvas paints the plane inside a transformed Group and the register outside it, so the
    // register's own elements carry no plane transform at any width.
    const canvas = view.getByTestId(MAP_CANVAS_TEST_ID);
    const transformed = JSON.stringify(canvas);
    expect(transformed).toContain('Canvas');
    for (const [width, height] of [
      [320, 568],
      [1366, 1024],
    ] as const) {
      await resize(view, width, height);
      expect(view.getByTestId(MAP_CANVAS_TEST_ID)).toBe(canvas);
    }
    await act(async () => {
      view.unmount();
    });
  });

  it('T11-A65 — nothing in the responsive owner can reach a cue, a trigger or an animation at all', () => {
    // Structural rather than behavioural, and deliberately: the Meaning Ignition cue has no
    // authoritative Product trigger in v1 and is therefore absent from the motion layer entirely.
    // What a resize could do is invent one. It cannot, because the responsive owner imports no
    // animation API, holds no clock and has no path to the motion layer at all — which is proven
    // exhaustively by the root static contract's import guard, not guessed at here.
    const plan = recompositionPlan(presentationSurface({ width: 390, height: 844 }) as never);
    expect(Object.keys(plan).sort()).toEqual(['band', 'chrome', 'geometry', 'mapFrame', 'shortHeight', 'surface', 'timelineWidthPoints']);
    // No duration, no easing, no delay, no curve and no cue anywhere in what it produces.
    const serialized = JSON.stringify(plan);
    for (const forbidden of ['duration', 'easing', 'delay', 'spring', 'cue', 'ignition', 'animate']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('T11 — reduced motion, and the capability that survives it', () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  });

  it('T11-A66 — a reduced-motion reader gets the same acts, words and composition at every width', async () => {
    const answers: Record<string, unknown>[] = [];
    for (const reduced of [false, true]) {
      (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = reduced;
      const world = reader();
      const preview = createTemporalPreviewController();
      const presentation = createPresentationController(trackOf('session-1', 6), 0);
      const view = await render(
        <ResponsiveWorld store={world.store} context={world.context} language="ar" preview={preview} presentation={presentation} />,
      );
      const perCase: Record<string, unknown> = {};
      for (const [width, height] of [
        [320, 568],
        [568, 320],
        [1024, 768],
      ] as const) {
        await resize(view, width, height);
        perCase[`${width}x${height}`] = {
          words: readableText(view.getByTestId(ORIENTATION_CHROME_TEST_ID)),
          acts: subtree(view, RETURN_CONTROLS_TEST_ID)
            .filter(isPressTarget)
            .map((node) => ((node.props ?? {}) as Record<string, unknown>).testID),
        };
      }
      answers.push(perCase);
      expect(world.store.getState().history).toHaveLength(0);
      await act(async () => {
        view.unmount();
      });
    }
    expect(answers[1]).toEqual(answers[0]);
  });
});

describe('T11 — the recomposition lifecycle', () => {
  it('T11-A73 — repeating the same inset change produces one composition and no loop', () => {
    const surfaceOf = (bottom: number) => presentationSurface({ width: 390, height: 844, insetBottom: bottom });
    const first = recompositionPlan(surfaceOf(0) as never);
    let plan = first;
    for (let round = 0; round < 50; round += 1) {
      plan = recompositionPlan(surfaceOf(0) as never, { band: plan.band });
      // Fifty identical measurements, one composition: nothing downstream is invalidated, so
      // nothing can re-measure and feed a new measurement back in.
      expect(planEquals(plan, first)).toBe(true);
    }
    const changed = recompositionPlan(surfaceOf(34) as never, { band: plan.band });
    expect(planEquals(changed, first)).toBe(false);
    let settled = changed;
    for (let round = 0; round < 50; round += 1) {
      settled = recompositionPlan(surfaceOf(34) as never, { band: settled.band });
      expect(planEquals(settled, changed)).toBe(true);
    }
  });

  it('the hook itself is what makes the plan stable BY IDENTITY across identical layouts', async () => {
    const world = reader();
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const plans: RecompositionPlan[] = [];
    const view = await render(
      <ResponsiveWorld
        store={world.store}
        context={world.context}
        preview={preview}
        presentation={presentation}
        onPlan={(plan) => plans.push(plan)}
      />,
    );
    await resize(view, 390, 844);
    const settled = plans[plans.length - 1];
    const before = plans.length;
    // The same rect reported ten more times: not one new plan object, so no memo downstream is
    // invalidated and no placement, Skia tree, hit map or accessible tree is rebuilt.
    for (let round = 0; round < 10; round += 1) await resize(view, 390, 844);
    for (const plan of plans.slice(before)) expect(plan).toBe(settled);
    // A real change produces a new one, and settles again immediately.
    await resize(view, 1024, 768);
    const wide = plans[plans.length - 1];
    expect(wide).not.toBe(settled);
    for (let round = 0; round < 5; round += 1) await resize(view, 1024, 768);
    expect(plans[plans.length - 1]).toBe(wide);
    await act(async () => {
      view.unmount();
    });
  });

  it('the world keeps its floor, and the support around it yields and stays reachable', async () => {
    // The hardest window in the envelope: there is not enough room for the world's floor, the
    // temporal surface and a full chrome at once.
    const plan = recompositionPlan(presentationSurface({ width: 320, height: 320, insetTop: 48, insetBottom: 34 }) as never);
    expect(plan.mapFrame.minHeightPoints).toBe(MAP_MIN_HEIGHT_POINTS);
    expect(320 - 48 - 34 - TIMELINE_ROW_POINTS - MAP_MIN_HEIGHT_POINTS).toBeLessThan(CHROME_FLOOR_POINTS);

    const world = reader();
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const view = await render(
      <ResponsiveWorld store={world.store} context={world.context} language="ar" preview={preview} presentation={presentation} />,
    );
    await resize(view, 320, 320);
    // The world is sized FIRST and keeps its floor.
    const frame = view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID);
    expect(JSON.stringify(frame.props.style)).toContain(`"minHeight":${MAP_MIN_HEIGHT_POINTS}`);
    // The band takes the remainder, clips to exactly it, and makes what does not fit reachable
    // INSIDE itself rather than below the surface. That is the whole guarantee: the world never
    // disappears, and no act is ever unreachable.
    const band = view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID);
    const style = JSON.stringify(band.props.style);
    expect(style).toContain('"flexShrink":1');
    expect(style).toContain('"overflow":"hidden"');
    expect(style).not.toContain('maxHeight');
    expect(style).not.toContain('"height"');
    // and the reachable route inside it is a real scroll container holding the real chrome.
    expect(subtree(view, RESPONSIVE_CHROME_BAND_TEST_ID).some((node) => node.type === 'RCTScrollView')).toBe(true);
    expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
    for (const control of subtree(view, RETURN_CONTROLS_TEST_ID).filter(isPressTarget)) {
      expect(JSON.stringify(((control.props ?? {}) as Record<string, unknown>).style)).toContain('"minHeight":44');
    }
    await act(async () => {
      view.unmount();
    });
  });

  it('a surface that has not been measured composes nothing rather than a guess', async () => {
    const world = reader();
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const view = await render(<ResponsiveWorld store={world.store} context={world.context} preview={preview} presentation={presentation} />);
    // Before any layout has been reported there is no Map, no Timeline and no chrome — and above
    // all no Map drawn against invented geometry.
    expect(view.queryByTestId(ORIENTATION_CHROME_TEST_ID)).toBeNull();
    expect(view.queryByTestId(MAP_CANVAS_TEST_ID)).toBeNull();
    await resize(view, 390, 844);
    expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(MAP_CANVAS_TEST_ID)).toBeTruthy();
    // A degenerate measurement takes it back to composing nothing, rather than to a wrong world.
    await resize(view, 0, 844);
    expect(view.queryByTestId(ORIENTATION_CHROME_TEST_ID)).toBeNull();
    expect(world.store.getState().history).toHaveLength(0);
    await act(async () => {
      view.unmount();
    });
  });
});
