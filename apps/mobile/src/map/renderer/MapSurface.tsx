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
 *
 * S5-03B Phase 1 — the presentation mechanics this surface always ran (one presentation camera, the travel and
 * drag corridor, the rebase, presentation culling, the membership record and the residual-true pointer) now live
 * in the generic `useWorldMotion` / `useWorldFrame` (`./useWorldSurface`), called at exactly the two places this
 * surface performed that work, so every effect still runs in the order it did. This file remains the Personal
 * owner: the canonical store, the ONE freshness rule, the disclosed scene, the gestures that dispatch into the
 * store, inspection and the accessible Map are all here and nowhere else. The golden equivalence suite proves the
 * Personal Map paints exactly what it did.
 *
 * S5-03B R1 — the world VIEW is now the Living Analysis surface's own (`./WorldViewSurface`): `useWorldView` runs the
 * mechanics above in the order this surface always ran them, and `WorldViewSurface` composes the surface, the
 * gesture plane, the tap route and the accessible layer. This file is still the Personal owner and nothing of its
 * role moved: the store, the freshness rule, the disclosed scene, the two acts a drag and a pinch become (`PAN`,
 * `ZOOM_SEMANTIC`), inspection, the Personal paint and the accessible Map. The screen golden and the Map golden
 * prove the Personal Map is unchanged.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { PresentationMotionCause } from '../../motion';
import type { AnalysisLanguage } from '../../analysis-language';
import type { CameraIntent, CanonicalStore } from '../../state';
import { decodeCameraIntent, panByTranslation, zoomSemanticStep, type MapCamera, type SemanticZoomDirection, type ViewportEnvelope } from '../camera';
import { MapAccessibilityLayer } from '../accessibility';
import { inspectObject, type DirectJumpOutcome, type MapInspectionContext } from '../inspection';
import { mapContextFreshness } from '../projection';
import type { MapActionOutcome } from '../outcome';
import { MapCanvas } from './MapCanvas';
import { placeScene, sceneMembershipKeys, type PlacedNode } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';
import { WorldViewSurface, useWorldView } from './WorldViewSurface';

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
  /** The reader's Product language, for the accessible Map's words only (W1A-01). */
  readonly language?: AnalysisLanguage;
}

export function MapSurface({ store, context, envelope, style = DEFAULT_RENDER_STYLE, onOutcome, spatialCause, language = 'en' }: MapSurfaceProps) {
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
  // Which loci are part of the accepted current `V` (R3-01): asked of the SCENE, never of a placement, and
  // only of a scene that is still this Map. A technical stale gap passes none, so the record survives it.
  const accepted = useMemo(() => (usable ? sceneMembershipKeys(context.scene) : null), [context.scene, usable]);
  // The Personal Map's two camera acts: one completed drag is one `PAN`, and one finished pinch is one `ZOOM_SEMANTIC`
  // along the frozen lineage — each dispatched into THIS store, the authority the view draws under.
  const pan = useCallback((translationX: number, translationY: number) => panByTranslation(store, translationX, translationY), [store]);
  const step = useCallback((direction: SemanticZoomDirection) => zoomSemanticStep(store, direction), [store]);
  // S5-03B R1 — the world view of the one Living Analysis surface: the presentation camera and its corridor, the
  // world's expression, the drag and the step, then the camera commit, culling and membership, in the order this
  // surface always ran them. The STORE is this surface's authority: a replaced store drops the residual, the drag
  // and the record.
  const { worldMotion, world, gesture, cameraCommit, presented, newlyDisclosed, nodeAt } = useWorldView<MapCamera, PlacedNode, MapActionOutcome>({
    owner: store,
    envelope,
    camera,
    placed,
    membership: accepted,
    cause: causeOfTransition,
    enabled: usable,
    inspection: state.inspection,
    pan,
    step,
    onSettled: onOutcome,
  });

  // The act runs first and the observer is notified afterwards: an optional call would not
  // evaluate its argument when no observer is attached, silently disabling the pointer route.
  const onTap = useCallback(
    (x: number, y: number) => {
      if (placed === null) return;
      // Through the SAME residual the frame was painted with, and the SAME arrival progress each
      // object is drawn at: paint, pointer and act agree while the plane travels AND while an
      // object is still resolving out from its host. Nothing waits for an animation to finish.
      const node = nodeAt(x, y);
      if (node === null) return;
      if (node.family !== 'THREAD' && node.family !== 'READING' && node.family !== 'EMERGING_FOCUS') return;
      const outcome = inspectObject(store, context, { family: node.family, id: node.id });
      onOutcome?.(outcome);
    },
    [context, nodeAt, onOutcome, placed, store],
  );

  // An undecodable camera, or a projection that is no longer this Map's, renders an empty surface
  // rather than a plausible wrong Map. The accessible layer is still mounted when a camera exists:
  // it enforces the same freshness rule itself, so it exposes no object of the old scene, while
  // the viewport routes that could bring the camera back to a matching depth stay reachable.
  return (
    <WorldViewSurface
      testID={MAP_SURFACE_TEST_ID}
      planeTestID={MAP_SURFACE_PLANE_TEST_ID}
      composed={camera !== null && placed !== null}
      gesture={gesture}
      onTap={onTap}
      canvas={
        placed === null ? null : (
          <MapCanvas
            envelope={envelope}
            motion={worldMotion.motion}
            placed={placed}
            presented={presented}
            newlyDisclosed={newlyDisclosed}
            arrivals={worldMotion.arrivals}
            cameraCommit={cameraCommit}
            style={style}
            world={world}
          />
        )
      }
      accessibility={
        camera === null ? null : (
          <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={envelope} onOutcome={onOutcome} language={language} />
        )
      }
    />
  );
}
