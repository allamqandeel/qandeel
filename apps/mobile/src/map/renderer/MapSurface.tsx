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
 *   placement. Panning the camera over an already-disclosed Home is navigation, and navigation must
 *   not borrow the grammar of meaning becoming known;
 *
 *   **this authority vs the next.** A drag, and the residual it produced, belong to the store they
 *   began under. If that owner is replaced they are dropped, not re-aimed.
 *
 * This component is a truthful mechanics substrate. It is deliberately not mounted in the app
 * shell: the technical container is T-01's and stays byte-identical, and where the Map appears in
 * the Product is a later task's decision.
 */
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  RESIDUAL_AT_REST,
  createArrivalRegistry,
  createBox,
  isPresentedDuringTravel,
  newlyDisclosedKeys,
  rebasedResidual,
  useAuthorityGeneration,
  usePresentationCamera,
  type MotionCauseChannel,
  type PresentationResidual,
} from '../../motion';
import type { CanonicalStore } from '../../state';
import { cameraTransition, decodeCameraIntent, envelopeCenter, useMapPanGesture, type MapCamera, type ViewportEnvelope } from '../camera';
import { MapAccessibilityLayer } from '../accessibility';
import { inspectObject, type DirectJumpOutcome, type MapInspectionContext } from '../inspection';
import { mapContextFreshness } from '../projection';
import type { MapActionOutcome } from '../outcome';
import { MapCanvas, type CanonicalCameraCommit } from './MapCanvas';
import { CULL_MARGIN_POINTS, hitTest, placeScene, type PlacedNode, type PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_SURFACE_TEST_ID = 'qandeel-map-surface';
export const MAP_SURFACE_PLANE_TEST_ID = 'qandeel-map-surface-plane';

export interface MapSurfaceProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly envelope: ViewportEnvelope;
  readonly style?: RenderStyle;
  /**
   * A presentation-only note of which ALREADY-EXECUTED act the next camera change explains.
   *
   * Optional, and correctness never depends on it: absent one, every choreography is read from
   * what actually changed. Its only effect is the explanatory beat between the two halves of the
   * one composite Product act, and only when that act actually landed a camera somewhere. It is
   * written by whoever composes this surface with T-08's chrome, from an outcome T-07 has already
   * returned.
   */
  readonly cause?: MotionCauseChannel;
  readonly onOutcome?: (outcome: MapActionOutcome | DirectJumpOutcome) => void;
}

/**
 * What the last camera-changing commit left behind.
 *
 * `startResidual` is the residual armed for that change, and it OUTLIVES the commit deliberately:
 * an incidental re-render during a travel must not collapse presentation culling back onto the
 * final canonical viewport while the plane is still crossing the distance.
 */
interface CameraHistory {
  readonly owner: CanonicalStore;
  readonly camera: MapCamera;
  readonly startResidual: PresentationResidual;
}

export function MapSurface({ store, context, envelope, style = DEFAULT_RENDER_STYLE, cause, onOutcome }: MapSurfaceProps) {
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
  const motion = usePresentationCamera({ center, diagonalPoints, cause });
  const authority = useAuthorityGeneration(store);
  const { gesture } = useMapPanGesture(store, { enabled: usable, camera: motion, authority, onSettled: onOutcome });

  // Two histories with deliberately different lifetimes, held in boxes rather than state: neither
  // is rendering input, and flipping state from an effect would cost a cascading render per commit
  // to say something that changes nothing about what is drawn.
  const [cameraHistory] = useState(() => createBox<CameraHistory | null>(null));
  const [disclosureHistory] = useState(() => createBox<ReadonlySet<string> | null>(null));
  const [arrivals] = useState(() => createArrivalRegistry());

  // What this commit does about the canonical camera, and what the presented viewport is while it
  // does it. Read during render because the presented set is rendering input; applied inside the
  // Skia root, after the positions it preserves.
  const history = cameraHistory.get();
  const authorityReplaced = history !== null && history.owner !== store;
  const cameraChanged = history !== null && !authorityReplaced && history.camera !== camera && camera !== null;
  const transition = cameraChanged && history !== null && camera !== null ? cameraTransition(history.camera, camera, envelope) : null;
  const startResidual: PresentationResidual =
    transition !== null && transition.destination !== null
      ? rebasedResidual(RESIDUAL_AT_REST, transition.k, transition.destination)
      : !cameraChanged && !authorityReplaced && history !== null
        ? history.startResidual
        : RESIDUAL_AT_REST;

  const commitCamera = useCallback(() => {
    const previous = cameraHistory.get();
    if (previous === null || previous.owner !== store || previous.camera !== camera) {
      if (camera !== null) cameraHistory.set({ owner: store, camera, startResidual });
    }
  }, [camera, cameraHistory, startResidual, store]);

  const cameraCommit: CanonicalCameraCommit = useMemo(
    () => ({ transition, reset: authorityReplaced, commit: commitCamera }),
    [authorityReplaced, commitCamera, transition],
  );

  // Presentation culling: what the travel could still put on the glass. At rest the residual is the
  // identity and this is exactly the resting viewport test, so a still world paints what it always
  // painted (R1-02).
  const presented: readonly PlacedNode[] = useMemo(
    () =>
      placed === null
        ? EMPTY_NODES
        : placed.nodes.filter((node) =>
            isPresentedDuringTravel({ x: node.x, y: node.y, radius: node.radius }, startResidual, center, envelope, CULL_MARGIN_POINTS),
          ),
    [center, envelope, placed, startResidual],
  );

  // Which loci BECAME part of `V` in this commit, compared against the previous commit's FULL
  // placement — so a node that was merely off the glass is not new when culling lets it back in,
  // and a remount with the same `V` discloses nothing (R1-03).
  //
  // A REPLACED authority passes `null` for that comparison, which is the same rule the first painted
  // frame already uses: there is no earlier `V` of this authority's for anything to have joined. The
  // history belongs to the store it was recorded under, exactly as the drag and its residual do —
  // and without that, replacing the store would announce every locus of the new world as newly
  // disclosed, dressing a whole-world truth cut in the grammar of meaning becoming known. That is
  // the category error R1-03 exists to prevent, at world scale.
  const newlyDisclosed = useMemo(
    () =>
      placed === null
        ? EMPTY_KEYS
        : newlyDisclosedKeys(authorityReplaced ? null : disclosureHistory.get(), placed.nodes.map((node) => node.key)),
    [authorityReplaced, disclosureHistory, placed],
  );
  useLayoutEffect(() => {
    // `null` when there is no placement at all: a projection handoff is not a disclosure event, so
    // the next real placement starts clean rather than announcing the whole world as new.
    disclosureHistory.set(placed === null ? null : new Set(placed.nodes.map((node) => node.key)));
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

const styles = StyleSheet.create({
  surface: { flex: 1 },
});
