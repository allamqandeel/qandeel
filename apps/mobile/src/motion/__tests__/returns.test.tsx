/**
 * T-10 §8 — the six Return choreographies, over the REAL T-07 executors.
 *
 * Nothing here decides a return. Every act below is run by its own frozen executor against a real
 * canonical store, and what is asserted is only what the presentation then does with the canonical
 * camera it finds — which is the whole architecture in one sentence: **the act is already true
 * before motion explains it, and the explanation is read from what actually changed.**
 *
 * That is why five of the six need no cause at all. Return to Live Head moves no camera, so there
 * is nothing to travel; Return to World changes the rung and not the anchor, so there is a
 * reinforcement and no recentring; Back and Exact Return restore a captured viewpoint, so they get
 * whatever their own dimensions changed. Only the one composite act carries a cause, and only
 * because it is two truths in one transaction.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { address, contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import {
  MapCanvas,
  cameraTransition,
  decodeCameraIntent,
  envelopeCenter,
  initialCameraIntent,
  placeScene,
  projectAddress,
  type MapCamera,
} from '../../map';
import { sessionPosition, type CanonicalStore } from '../../state';
import {
  backOneStep,
  exactReturn,
  goLiveAndLocate,
  latestReturnCheckpoint,
  returnLiveFocus,
  returnLiveHead,
  returnWorld,
} from '../../return-navigation';
import { contextAt, providing, providingNothing, returnSurface, returnTestStore, world } from '../../return-navigation/__fixtures__/return';
import {
  MOTION_DURATIONS_MS,
  RESIDUAL_AT_REST,
  createMotionCauseChannel,
  presentationTravelPlan,
  rebasedResidual,
  type CanonicalCameraChange,
  type PresentationTravelPlan,
} from '..';
import { canvasProps } from '../__fixtures__/canvas';
import { stubPresentationCamera } from '../__fixtures__/presentation-camera';

const SP = sessionPosition;
const THREAD_A = { id: 'thread-a', x: '1000000', y: '0' };
const THREAD_B = { id: 'thread-b', x: '2000000', y: '0' };
const here = (tc: number, liveHead: number, depth: 'WORLD' | 'THREAD' | 'SESSION' = 'SESSION') =>
  world({ depth, tc, liveHead, threads: [THREAD_A, THREAD_B], focuses: depth === 'SESSION' ? [{ id: 'focus-1', startedSp: 1 }] : [] });

const view = envelope();
const center = envelopeCenter(view);
const diagonalPoints = Math.hypot(view.width, view.height);

const cameraOf = (store: CanonicalStore): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/** A neutral scene to paint. What is drawn is irrelevant here; how the camera is shown is not. */
const paintScene = () => contextOf(testStore({ depth: 'ANALYTICAL_OBJECT' }), disclosureFixture({ depth: 'ANALYTICAL_OBJECT', threads: [THREAD_A] })).scene;

interface Choreography {
  readonly changes: readonly CanonicalCameraChange[];
  readonly plans: readonly PresentationTravelPlan[];
}

/**
 * Paints the world at the camera BEFORE an act, runs the act, repaints at the camera AFTER, and
 * reports what the renderer's own rebase asked for. The derivation under test is the production
 * one: `MapCanvas` computes it, and this only records the result.
 */
async function choreographyOf(
  store: CanonicalStore,
  run: () => void,
  options: { cause?: ReturnType<typeof createMotionCauseChannel>; reducedMotion?: boolean } = {},
): Promise<Choreography> {
  const scene = paintScene();
  const before = cameraOf(store);
  const motion = stubPresentationCamera({ center, reducedMotion: options.reducedMotion === true });
  const rendered = await render(
    <MapCanvas {...canvasProps({ placed: placeScene(scene, before, view), motion: motion, envelope: view })} />,
  );

  run();

  const after = cameraOf(store);
  // The production derivation, from the two canonical cameras the executors actually left behind.
  // `cameraTransition` is the same function the surface calls; what this file is about is what the
  // presentation then DOES with it, act by act.
  const transition = cameraTransition(before, after, view);
  await act(async () => {
    rendered.rerender(
      <MapCanvas {...canvasProps({ placed: placeScene(scene, after, view), motion: motion, envelope: view, transition })} />,
    );
  });

  const plans = motion.changes.map((change) => {
    const residual = change.destination === null ? RESIDUAL_AT_REST : rebasedResidual(RESIDUAL_AT_REST, change.k, change.destination);
    return presentationTravelPlan({
      residual,
      viewportDiagonalPoints: diagonalPoints,
      representable: change.destination !== null,
      reducedMotion: options.reducedMotion === true,
      depthChanged: change.depthChanged,
      cause: options.cause?.take() ?? null,
    });
  });
  return { changes: motion.changes, plans };
}

describe('T10-A38, A46…A55 — the six return choreographies', () => {
  it('A38 — Return to Live Head moves no camera at all', async () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(3) } });
    const { changes } = await choreographyOf(store, () => {
      const outcome = returnLiveHead(returnSurface(store));
      expect(outcome.outcome).toBe('APPLIED');
    });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // The act is temporal. There is no camera transition, so there is nothing to travel — not a
    // travel of zero length, and not a plan that resolves to nothing: no rebase happened at all.
    expect(changes).toEqual([]);
  });

  it('A46, A47 — Return to Live Focus travels only when it legitimately landed, and never moves TC', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(6) },
      liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' },
    });
    const { changes, plans } = await choreographyOf(store, () => {
      const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) });
      expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(changes).toHaveLength(1);
    expect(plans[0].kind).toBe('TRAVEL');
    expect(plans[0].translationMs).toBeGreaterThanOrEqual(MOTION_DURATIONS_MS.travelMin);
    expect(plans[0].translationMs).toBeLessThanOrEqual(MOTION_DURATIONS_MS.travelLongMax);
    expect(plans[0].dampingRatio).toBe(1);
    // A one-shot spatial act changes no rung, so nothing reinforces.
    expect(changes[0].depthChanged).toBe(false);
  });

  it('A46 — a bound referent with no legitimate place moves no camera, and invents no travel', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(6) },
      liveFocus: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' },
    });
    const { changes } = await choreographyOf(store, () => {
      const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) });
      expect(outcome.outcome).toBe('NO_OP');
    });
    expect(changes).toEqual([]);
  });

  it('A48 — Go Live + Locate with a landing explains the temporal half first, then travels', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(3) },
      liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' },
    });
    const cause = createMotionCauseChannel();
    const { changes, plans } = await choreographyOf(
      store,
      () => {
        const outcome = goLiveAndLocate(returnSurface(store), { liveContext: providing(contextAt(here(6, 6))) });
        expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
        // Written from the outcome T-07 has ALREADY returned, exactly as T-08 reports it.
        cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', outcome);
      },
      { cause },
    );
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(changes).toHaveLength(1);
    expect(plans[0].kind).toBe('TRAVEL');
    expect(plans[0].spatialDelayMs).toBe(MOTION_DURATIONS_MS.compositeSpatialBeat);
    expect(plans[0].spatialDelayMs).toBeGreaterThanOrEqual(80);
    expect(plans[0].spatialDelayMs).toBeLessThanOrEqual(140);
  });

  it('A49 — Go Live + Locate with no landing shows no spatial phase whatsoever', async () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'NONE' } });
    const cause = createMotionCauseChannel();
    const { changes } = await choreographyOf(
      store,
      () => {
        const outcome = goLiveAndLocate(returnSurface(store), { liveContext: providingNothing });
        expect(outcome.outcome).toBe('APPLIED');
        cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', { outcome: 'APPLIED', locate: 'LANDED' });
      },
      { cause },
    );
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // The temporal half stood alone. No camera moved, so the interaction is complete with zero
    // spatial motion — not a travel of zero distance, and not a fake settle.
    expect(changes).toEqual([]);
  });

  it('A50, A51 — Return to World keeps TC, opens the rung, and the presentation invents no travel', async () => {
    // A reader who has explored away from the World/Z0 target, so the act really has a camera to
    // restore and there is something a presentation could be caught inventing.
    const displaced = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(4) },
      camera: initialCameraIntent(address(1_400_000n, -900_000n), undefined, 'SESSION'),
    });
    const before = cameraOf(displaced);
    const { changes, plans } = await choreographyOf(displaced, () => {
      expect(returnWorld(returnSurface(displaced)).outcome).toBe('APPLIED');
    });
    expect(displaced.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(displaced.getState().camera.depth).toBe('WORLD');
    expect(changes).toHaveLength(1);
    expect(changes[0].depthChanged).toBe(true);

    // A51 — the presentation adds NOTHING to the act. The travel it shows is exactly the canonical
    // anchor the act landed on, projected from the camera the reader was at: no recentring of its
    // own, no fitting to what happens to be visible, no invented translation.
    const after = cameraOf(displaced);
    const projected = projectAddress(before, view, after.anchor);
    if (projected === null) throw new Error('expected a representable World target');
    expect(changes[0].destination).toEqual({ x: projected.x - center.x, y: projected.y - center.y });
    expect(plans[0].kind).toBe('TRAVEL');
    expect(plans[0].dampingRatio).toBe(1);
  });

  it('a rung change that moves no camera is shown by disclosure alone', async () => {
    // Already at the World/Z0 camera: the act opens the rung and the camera has nowhere to go.
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(4) }, depth: 'SESSION' });
    const anchorBefore = store.getState().camera.anchor;
    const { changes } = await choreographyOf(store, () => {
      expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
    });
    expect(store.getState().camera.depth).toBe('WORLD');
    expect(store.getState().camera.anchor).toEqual(anchorBefore);
    // No camera transition at all — not a travel of zero length. Depth is disclosure, and
    // disclosure is not a camera move.
    expect(changes).toEqual([]);
  });

  it('A52 — Back restores the captured viewpoint, and its choreography is read from what changed', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(4) },
      camera: initialCameraIntent(address(1_400_000n, -900_000n), undefined, 'SESSION'),
    });
    // A real recorded journey: one Return to World, whose checkpoint Back then consumes.
    expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
    const { changes, plans } = await choreographyOf(store, () => {
      const outcome = backOneStep(returnSurface(store));
      expect(outcome.outcome === 'APPLIED' && outcome.consumed).toBe(1);
    });
    expect(store.getState().camera.depth).toBe('SESSION');
    expect(store.getState().history).toHaveLength(0);
    expect(changes).toHaveLength(1);
    expect(changes[0].depthChanged).toBe(true);
    expect(plans[0].dampingRatio).toBe(1);
    expect(plans[0].kind).toBe('TRAVEL');
  });

  it('A53, A54 — Exact Return restores the exact viewpoint and gets no frame of its own', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(4) },
      camera: initialCameraIntent(address(1_400_000n, -900_000n), undefined, 'SESSION'),
    });
    const captured = store.getState().camera;
    expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
    const target = latestReturnCheckpoint(store);
    if (target === null) throw new Error('expected a recorded checkpoint');

    const { changes, plans } = await choreographyOf(store, () => {
      const outcome = exactReturn(returnSurface(store), target);
      expect(outcome.outcome).toBe('APPLIED');
    });
    // Exact, in the captured tuple itself — which is where exactness lives.
    expect(store.getState().camera).toEqual(captured);

    // And the choreography is the SAME vocabulary Back uses for the same dimensional change. There
    // is no lock frame, no ink border, no brass and no special-cased plan field to carry one.
    expect(changes).toHaveLength(1);
    expect(Object.keys(plans[0]).sort()).toEqual([
      'dampingRatio',
      'kind',
      'resolveMs',
      'spatialDelayMs',
      'translationMs',
      'zoomDelayMs',
      'zoomMs',
    ]);
    expect(plans[0].dampingRatio).toBe(1);
  });

  it('A55 — a cause is one-shot and cannot attach itself to a later, unrelated act', () => {
    const cause = createMotionCauseChannel();
    cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', { outcome: 'APPLIED', locate: 'LANDED' });
    expect(cause.take()).toBe('GO_LIVE_AND_LOCATE');
    // Consumed. The next camera change — whatever moved it — explains itself.
    expect(cause.take()).toBeNull();
    // A refused or no-op act arms nothing at all.
    cause.noteReturnOutcome('GO_LIVE_AND_LOCATE', { outcome: 'REJECTED' });
    expect(cause.take()).toBeNull();
    // And no other act can borrow the composite beat.
    for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD']) {
      cause.noteReturnOutcome(id, { outcome: 'APPLIED', locate: 'LANDED' });
      expect(cause.take()).toBeNull();
    }
  });

  it('A56, A57 — reduced motion reaches the same canonical state by the same acts', async () => {
    const store = returnTestStore({
      liveHead: 6,
      temporal: { kind: 'PINNED', at: SP(4) },
      camera: initialCameraIntent(address(1_400_000n, -900_000n), undefined, 'SESSION'),
    });
    const { changes, plans } = await choreographyOf(
      store,
      () => {
        expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
      },
      { reducedMotion: true },
    );
    // Same act, same destination, same history — only the transition changed.
    expect(store.getState().camera.depth).toBe('WORLD');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(store.getState().history).toHaveLength(1);
    expect(changes).toHaveLength(1);
    expect(plans[0].kind).toBe('CUT_AND_RESOLVE');
    expect(plans[0].translationMs).toBe(0);
    expect(plans[0].zoomMs).toBe(0);
    expect(plans[0].resolveMs).toBe(MOTION_DURATIONS_MS.reducedResolve);
  });
});
