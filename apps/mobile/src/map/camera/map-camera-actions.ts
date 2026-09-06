/**
 * T-04 — the executors that turn an interpreted input into ONE authorized canonical camera act.
 *
 * Every function here dispatches at most one `PAN` or one `ZOOM_SEMANTIC` through the existing
 * canonical store, and therefore through the existing per-field authority guard, `Φ_eff` no-op
 * detection and RH boundary. There is no second navigation store, no direct write and no bypass:
 * a rejected input simply produces no act.
 *
 * None of these can reach `TM`, `TC` or `LF`: the frozen authority of `PAN` is `MC.anchor` and
 * `MC.destination`, and of `ZOOM_SEMANTIC` `MC.depth`, `MC.scale` and `MC.anchor`. A transition
 * that tried anything else would be rejected by T-02's guard, not by a convention here.
 */
import type { CanonicalStore } from '../../state';
import { dispatchKernelAction, rejected, type MapActionOutcome } from '../outcome';
import { decodeCameraIntent, type MapCamera } from './camera';
import { panFromExplorationStep, panFromTranslation, type PanResolution, type ViewportExplorationDirection } from './pan';
import type { ViewportEnvelope } from './viewport';
import { semanticZoom, type SemanticZoomDirection } from './zoom';

/** The camera the canonical state currently holds, or a typed refusal. Never a repaired default. */
export function currentCamera(store: CanonicalStore): { readonly ok: true; readonly camera: MapCamera } | { readonly ok: false; readonly detail: string } {
  return decodeCameraIntent(store.getState().camera);
}

function applyPan(store: CanonicalStore, resolution: PanResolution): MapActionOutcome {
  switch (resolution.outcome) {
    case 'INTENT':
      return dispatchKernelAction(store, { type: 'PAN', to: resolution.intent });
    case 'NO_MOVEMENT':
      return { outcome: 'NO_OP' };
    case 'BEYOND_CANONICAL_BOUND':
      return rejected('BEYOND_CANONICAL_BOUND', 'the requested camera position is not a canonical coordinate');
    case 'INVALID_INPUT':
      return rejected('INVALID_INPUT', 'the input did not describe a finite displacement');
    default: {
      const exhaustive: never = resolution;
      return exhaustive;
    }
  }
}

/**
 * One completed drag → one `PAN`. Call this on gesture end only: the in-progress translation is
 * presentation progress and must never reach the store, or RH would fill with gesture frames.
 */
export function panByTranslation(store: CanonicalStore, translationX: number, translationY: number): MapActionOutcome {
  const camera = currentCamera(store);
  if (!camera.ok) return rejected('CAMERA_NOT_DECODABLE', camera.detail);
  return applyPan(store, panFromTranslation(camera.camera, translationX, translationY));
}

/** One activation of the non-drag route → one `PAN`, identical in authority to the drag route. */
export function exploreViewport(
  store: CanonicalStore,
  envelope: ViewportEnvelope,
  direction: ViewportExplorationDirection,
): MapActionOutcome {
  const camera = currentCamera(store);
  if (!camera.ok) return rejected('CAMERA_NOT_DECODABLE', camera.detail);
  return applyPan(store, panFromExplorationStep(camera.camera, envelope, direction));
}

/**
 * One semantic-depth step → one `ZOOM_SEMANTIC` carrying the new rung and its geometric
 * reinforcement. At the World floor or the Provenance ceiling there is no rung to move to, so
 * nothing is dispatched: a boundary is not a no-op act, it is the absence of one.
 */
export function zoomSemanticStep(store: CanonicalStore, direction: SemanticZoomDirection): MapActionOutcome {
  const camera = currentCamera(store);
  if (!camera.ok) return rejected('CAMERA_NOT_DECODABLE', camera.detail);
  const resolution = semanticZoom(camera.camera, direction);
  if (resolution.outcome === 'AT_RUNG_BOUNDARY') {
    return rejected('AT_RUNG_BOUNDARY', `the ${camera.camera.depth} rung is the ${direction === 'IN' ? 'deepest' : 'shallowest'} disclosure of the frozen lineage`);
  }
  return dispatchKernelAction(store, { type: 'ZOOM_SEMANTIC', depth: resolution.depth, to: resolution.to });
}
