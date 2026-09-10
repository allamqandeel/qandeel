/**
 * T-04 — the composed Map surface: the structural Skia canvas, the drag route, the tap route and
 * the accessible semantic layer over ONE disclosed projection.
 * T-10 — the same surface, over ONE presentation camera.
 *
 * The three routes cannot disagree, because they share one derivation, one placement AND one set of
 * presentation values: a tap is converted through the very residual the frame was painted with, and
 * an object still resolving into view is hit-tested through the very progress its paint is driven
 * by. While the plane is between two viewpoints, or an object is between its host and its slot, a
 * touch selects what the reader is looking at rather than what would be there once motion finished.
 *
 * They also cannot disagree with the store. The surface subscribes to canonical state — not to
 * the camera alone — and asks the ONE freshness rule whether the supplied context still is this
 * Map's `(Session, effective TC, MC.depth)`. When it is not, nothing of the old projection
 * survives: no paint, no placement, no hit testing, no object accessibility, no act. That is a
 * transient projection-availability state during the handoff to a fresh `V`, not a Product state,
 * so the surface stays structurally empty rather than showing anything about it — final chrome,
 * including anything that would explain the wait, is T-08's.
 *
 * ## Three distinctions this surface is responsible for keeping apart (R1)
 *
 *   **semantic absence vs presentation culling.** An object is gone because current `V` excludes
 *   it. An object is unpainted because it is off the glass. Culling therefore follows the PRESENTED
 *   viewport during a travel, so an object still in `V` cannot vanish merely because the viewport
 *   it is travelling toward does not contain it;
 *
 *   **disclosure vs viewport entry.** An arrival is a membership transition in the authoritative
 *   SCENE. Panning the camera over an already-disclosed Home is navigation, and navigation must not
 *   borrow the grammar of meaning becoming known. Nor may finite representability: a locus the
 *   camera cannot currently project is still in `V`, and it does not become known by moving;
 *
 *   **a technical gap vs a change of world.** A canonical temporal or depth change makes this Map's
 *   context stale before the fresh one arrives. Nothing of the old projection may be painted in that
 *   gap — but the RECORD of what was disclosed must survive it, or the new world is compared against
 *   nothing and legitimate new meaning arrives with no explanation at all;
 *
 *   **this authority vs the next.** A drag, the residual it produced, and the disclosure record all
 *   belong to the store they were taken under. If that owner is replaced they are dropped, not
 *   re-aimed.
 *
 * This component is a truthful mechanics substrate. It is deliberately not mounted in the app
 * shell: the technical container is T-01's and stays byte-identical, and where the Map appears in
 * the Product is a later task's decision.
 */
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  RESIDUAL_ENVELOPE_AT_REST,
  createArrivalRegistry,
  createBox,
  envelopeHull,
  isPresentedWithinEnvelope,
  newlyDisclosedKeys,
  rebasedEnvelope,
  residualEnvelope,
  useAuthorityGeneration,
  usePresentationCamera,
  type PresentationCameraBinding,
  type PresentationMotionCause,
  type PresentationResidualEnvelope,
} from '../../motion';
import type { CameraIntent, CanonicalStore } from '../../state';
import { cameraTransition, decodeCameraIntent, envelopeCenter, useMapPanGesture, useMapSemanticZoomGesture, type MapCamera, type ViewportEnvelope } from '../camera';
import { MapAccessibilityLayer } from '../accessibility';
import { inspectObject, type DirectJumpOutcome, type MapInspectionContext } from '../inspection';
import { mapContextFreshness } from '../projection';
import type { MapActionOutcome } from '../outcome';
import { MapCanvas, type CanonicalCameraCommit } from './MapCanvas';
import { CULL_MARGIN_POINTS, hitTest, placeScene, sceneMembershipKeys, type PlacedNode, type PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_SURFACE_TEST_ID = 'qandeel-map-surface';
export const MAP_SURFACE_PLANE_TEST_ID = 'qandeel-map-surface-plane';

export interface MapSurfaceProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly envelope: ViewportEnvelope;
  readonly style?: RenderStyle;
  readonly onOutcome?: (outcome: MapActionOutcome | DirectJumpOutcome) => void;
  /**
   * Asked ONCE, at the instant a canonical camera transition is applied, with the destination this
   * surface is actually travelling to (T-12 §15).
   *
   * The surface neither knows nor asks why the camera moved — it has no access to an outcome, an act
   * or an intent, and it cannot derive one. It carries the question to the integration owner that
   * does, and passes the answer straight to the presentation plan. Absent, every travel is the plain
   * one, which is exactly the behaviour before this prop existed.
   */
  readonly spatialCause?: (destination: CameraIntent) => PresentationMotionCause | null;
}

/** Which authority and which canonical camera the last accepted commit was drawn under. */
interface CameraHistory {
  readonly owner: CanonicalStore;
  readonly camera: MapCamera;
}

export function MapSurface({ store, context, envelope, style = DEFAULT_RENDER_STYLE, onOutcome, spatialCause }: MapSurfaceProps) {
  // Canonical state is READ, never held beside the store: the whole state, because the projection
  // tuple is Session + effective TC + `MC.depth`, and the camera alone cannot tell us whether the
  // supplied projection is still this Map.
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const decoded = useMemo(() => decodeCameraIntent(state.camera), [state.camera]);
  const camera = decoded.ok ? decoded.camera : null;
  // The one shared rule, over the state this component subscribed to.
  const freshness = useMemo(() => mapContextFreshness(state, context), [state, context]);
  const usable = camera !== null && freshness.fresh;
  const placed = useMemo(
    () => (usable && camera !== null ? placeScene(context.scene, camera, envelope) : null),
    [usable, context.scene, camera, envelope],
  );

  const center = useMemo(() => envelopeCenter(envelope), [envelope]);
  const diagonalPoints = useMemo(() => Math.hypot(envelope.width, envelope.height), [envelope.width, envelope.height]);

  // Three records with deliberately different lifetimes, held in boxes rather than state: none is
  // rendering input in its own right, and flipping state from an effect would cost a cascading
  // render per commit to say something that changes nothing about what is drawn.
  const [cameraHistory] = useState(() => createBox<CameraHistory | null>(null));
  const [disclosureHistory] = useState(() => createBox<ReadonlySet<string> | null>(null));
  const [cameraBox] = useState(() => createBox<PresentationCameraBinding | null>(null));
  const [arrivals] = useState(() => createArrivalRegistry());
  // The corridor IS rendering input — it decides what is painted — so unlike the two records above
  // it is state. Every writer returns the current value unchanged when nothing moved, so React bails
  // out and an idle world costs no render at all.
  const [corridor, setCorridor] = useState<PresentationResidualEnvelope>(RESIDUAL_ENVELOPE_AT_REST);

  // R3-02a — the corridor retires when the presentation actually stops.
  //
  // Without this the widened candidate set of the LAST movement stays alive for as long as the
  // surface does: the documented travel is ≤540 ms, but nothing ever narrowed the corridor again, so
  // an idle world went on paying for a journey it finished long ago. This is Class D and nothing
  // else — it dispatches nothing, writes no canonical state, names no target, and cannot change what
  // exists or where the camera is. It only says: the extra candidates are no longer needed.
  const retireTravelCorridor = useCallback(
    (restEpoch: number) => {
      const binding = cameraBox.get();
      // A notification that lost a race to a newer motion is discarded rather than applied: the
      // plane it described is not the plane on the glass.
      if (binding === null || restEpoch !== binding.epoch.get()) return;
      setCorridor((current) => (envelopesEqual(current, RESIDUAL_ENVELOPE_AT_REST) ? current : RESIDUAL_ENVELOPE_AT_REST));
    },
    [cameraBox],
  );

  const motion = usePresentationCamera({ center, diagonalPoints, onTravelCorridorRetired: retireTravelCorridor });
  useLayoutEffect(() => {
    cameraBox.set(motion);
  }, [cameraBox, motion]);
  const authority = useAuthorityGeneration(store);
  const { gesture: panGesture } = useMapPanGesture(store, { enabled: usable, camera: motion, authority, onSettled: onOutcome });
  const { gesture: zoomGesture } = useMapSemanticZoomGesture(store, { enabled: usable, authority, onSettled: onOutcome });
  // Simultaneous, not exclusive. The two recognisers are already separated by pointer count — the pan
  // takes one finger and the pinch takes two — so neither has to lose a race, and racing them would
  // make the winner depend on which recogniser happened to activate first. What this composition
  // guarantees is that a second finger reaches the pinch instead of being swallowed by a pan that has
  // already claimed the plane.
  const gesture = useMemo(() => Gesture.Simultaneous(panGesture, zoomGesture), [panGesture, zoomGesture]);

  // What this commit does about the canonical camera, and what the presented viewport is while it
  // does it. Read during render because the presented set is rendering input; applied inside the
  // Skia root, after the positions it preserves.
  const history = cameraHistory.get();
  const authorityReplaced = history !== null && history.owner !== store;
  const cameraChanged = history !== null && !authorityReplaced && history.camera !== camera && camera !== null;
  const transition = cameraChanged && history !== null && camera !== null ? cameraTransition(history.camera, camera, envelope) : null;

  // R3-02b — the corridor is REBASED, exactly as the camera rebases the residual it is showing.
  //
  // The previous version rebased `RESIDUAL_AT_REST` through the new transition, which assumes the
  // plane was already home. Mid-flight it is not, and the camera itself rebases from the live
  // residual — so paint motion and culling continuity started from two different frames, and the
  // renderer could cull an object that was on the glass at the exact retarget commit.
  //
  // Carrying an envelope rather than one residual removes the disagreement without reading a shared
  // value during render and without a per-frame bridge: whatever the plane is actually showing lies
  // inside the corridor by construction, the rebase is affine so it maps the corridor exactly, and
  // the destination — always rest — is added to it. One presentation state, two readers.
  const travelCorridor: PresentationResidualEnvelope =
    authorityReplaced || camera === null
      ? RESIDUAL_ENVELOPE_AT_REST
      : transition === null
        ? corridor
        : envelopeHull(
            transition.destination === null
              ? RESIDUAL_ENVELOPE_AT_REST
              : rebasedEnvelope(corridor, transition.k, transition.destination),
            RESIDUAL_ENVELOPE_AT_REST,
          );

  const commitCamera = useCallback(() => {
    const previous = cameraHistory.get();
    if (previous === null || previous.owner !== store || previous.camera !== camera) {
      if (camera !== null) cameraHistory.set({ owner: store, camera });
    }
    // The corridor of the motion that is ACTUALLY running, read once here — after the change has
    // been applied — rather than predicted from the last one.
    //
    // The render above had to be conservative: it could only widen the previous corridor through
    // this transition, because a travel that finished long ago and a travel still in flight look
    // identical from render. Here they do not: the plane's own residual says where it is, so the
    // corridor becomes exactly "from here to rest" and inherits nothing from a journey already made.
    // It narrows on every commit as a travel proceeds, and it is a bounded read at a commit
    // boundary — never during render, never per frame.
    const exact = envelopeHull(residualEnvelope(motion.readResidual()), RESIDUAL_ENVELOPE_AT_REST);
    // Only a corridor that actually differs costs a second pass; the frame already painted was a
    // superset of this one, so nothing was ever wrongly culled while the two disagreed.
    setCorridor((current) => (envelopesEqual(current, exact) ? current : exact));
  }, [camera, cameraHistory, motion, store]);

  /**
   * The cause of the transition being applied, asked for at APPLY time and never during render.
   *
   * It closes over the exact destination camera this transition travels to, so the question the
   * integration owner is asked names its own answer's target. It is invoked in exactly one place —
   * the branch that applies a transition — so it is asked once per canonical camera change, and
   * never for a reset, never for a render that applies nothing, and never per frame.
   */
  const causeOfTransition = useCallback(
    () => (spatialCause === undefined || camera === null ? null : spatialCause(state.camera)),
    [camera, spatialCause, state.camera],
  );

  const cameraCommit: CanonicalCameraCommit = useMemo(
    () => ({ transition, reset: authorityReplaced, commit: commitCamera, cause: causeOfTransition }),
    [authorityReplaced, causeOfTransition, commitCamera, transition],
  );

  // Presentation culling: what the motion could still put on the glass. At rest the corridor is the
  // degenerate envelope and this is exactly the resting viewport test, so a still world paints what
  // it always painted.
  const presented: readonly PlacedNode[] = useMemo(
    () =>
      placed === null
        ? EMPTY_NODES
        : placed.nodes.filter((node) =>
            isPresentedWithinEnvelope(
              { x: node.x, y: node.y, radius: node.radius },
              // R3-02 — the screen-space register is not camera-transformed, so a world travel must
              // not widen its culling. It is tested against the resting viewport, always.
              node.region === 'UNGEOGRAPHIC_REGISTER' ? RESIDUAL_ENVELOPE_AT_REST : travelCorridor,
              center,
              envelope,
              CULL_MARGIN_POINTS,
            ),
          ),
    [center, envelope, placed, travelCorridor],
  );

  // Which loci BECAME part of the accepted current `V` in this commit (R3-01).
  //
  // Membership is asked of the SCENE, never of a placement. A placement omits a locus that is not
  // finitely representable from the current camera, so a set built from placements would call that
  // locus new the moment the camera made it representable again — presentation answering a question
  // only the record may answer.
  //
  // And it survives a projection handoff. A canonical temporal or depth change makes the old context
  // stale before the fresh one arrives; erasing the record in that gap meant the real Product path
  // for Semantic Zoom, a committed temporal move and every Return that changes `TC` or depth
  // compared the new world against nothing and disclosed nothing. What is preserved is EVIDENCE and
  // not a world: a set of identities, no geometry, no pixels, no entitlement, never painted, and
  // kept only long enough to be compared with the next accepted `V`.
  //
  // A REPLACED authority is the one thing that does erase it, for the same reason the drag and its
  // residual are dropped: the record belongs to the store it was taken under.
  const accepted = useMemo(() => (usable ? sceneMembershipKeys(context.scene) : null), [context.scene, usable]);
  const newlyDisclosed = useMemo(
    () => (accepted === null ? EMPTY_KEYS : newlyDisclosedKeys(authorityReplaced ? null : disclosureHistory.get(), [...accepted])),
    [accepted, authorityReplaced, disclosureHistory],
  );
  useLayoutEffect(() => {
    // Only an ACCEPTED scene updates the record. A technical stale gap leaves it exactly as it was —
    // that is the whole fix — and only a replaced authority discards it.
    if (accepted !== null) disclosureHistory.set(accepted);
    else if (authorityReplaced) disclosureHistory.set(null);
  });

  // The act runs first and the observer is notified afterwards: an optional call would not
  // evaluate its argument when no observer is attached, silently disabling the pointer route.
  const onTap = useCallback(
    (x: number, y: number) => {
      if (placed === null) return;
      // Through the SAME residual the frame was painted with, and the SAME arrival progress each
      // object is drawn at: paint, pointer and act agree while the plane travels AND while an
      // object is still resolving out from its host. Nothing waits for an animation to finish.
      const point = motion.canonicalPointAt({ x, y });
      const drawn: PlacedScene = {
        ...placed,
        visibleNodes: presented.map((node) => {
          const shown = arrivals.presentationOf(node.key);
          return shown === null ? node : { ...node, x: node.x + shown.dx, y: node.y + shown.dy, radius: node.radius * shown.scale };
        }),
      };
      const node = hitTest(drawn, point);
      if (node === null) return;
      if (node.family !== 'THREAD' && node.family !== 'READING' && node.family !== 'EMERGING_FOCUS') return;
      const outcome = inspectObject(store, context, { family: node.family, id: node.id });
      onOutcome?.(outcome);
    },
    [arrivals, context, motion, onOutcome, placed, presented, store],
  );

  // An undecodable camera, or a projection that is no longer this Map's, renders an empty surface
  // rather than a plausible wrong Map. The accessible layer is still mounted when a camera exists:
  // it enforces the same freshness rule itself, so it exposes no object of the old scene, while
  // the viewport routes that could bring the camera back to a matching depth stay reachable.
  if (camera === null || placed === null) {
    return (
      <View testID={MAP_SURFACE_TEST_ID} style={styles.surface}>
        {camera === null ? null : (
          <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={envelope} onOutcome={onOutcome} />
        )}
      </View>
    );
  }

  return (
    <View testID={MAP_SURFACE_TEST_ID} style={styles.surface}>
      <GestureDetector gesture={gesture}>
        <View
          testID={MAP_SURFACE_PLANE_TEST_ID}
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(event) => onTap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        >
          <MapCanvas
            envelope={envelope}
            motion={motion}
            placed={placed}
            presented={presented}
            newlyDisclosed={newlyDisclosed}
            arrivals={arrivals}
            cameraCommit={cameraCommit}
            style={style}
          />
        </View>
      </GestureDetector>
      <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={envelope} onOutcome={onOutcome} />
    </View>
  );
}

const EMPTY_NODES: readonly PlacedNode[] = Object.freeze([]);
const EMPTY_KEYS: ReadonlySet<string> = Object.freeze(new Set<string>());

/** Component-wise, because a corridor is six numbers and a new object with the same six is the same. */
function envelopesEqual(a: PresentationResidualEnvelope, b: PresentationResidualEnvelope): boolean {
  return (
    a.txMin === b.txMin && a.txMax === b.txMax && a.tyMin === b.tyMin && a.tyMax === b.tyMax && a.zoomMin === b.zoomMin && a.zoomMax === b.zoomMax
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
});
