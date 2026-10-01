/**
 * VPORT-01 — the presentation facts the world's expression reads, gathered in one place.
 *
 * Four inputs, all of which the Map already holds, and none of which is an input to anything that
 * decides what exists, where it is, what a tap hits or what the accessible tree says:
 *
 *   the camera's optical distance   → `approach`, the I-08B1 FAR / MID / NEAR material;
 *   the camera's anchor and scale   → `drift`, where the world-anchored atmosphere tiles sit;
 *   the platform contrast setting   → `contrast`, the F1 increased-contrast override;
 *   the current inspection (`IF_ref`) → `selection`, the E1R SELECTED expression.
 *
 * The selection is the inspected IDENTITY, and — when the inspection names one — the contextual
 * appearance it was made through. An identity inspected without a named appearance is shown as
 * selected wherever it is drawn; one inspected through a named appearance is shown there only. That
 * is exactly what `IF_ref` says, and the T-08 chrome already says it in words, so the marker is never
 * the only carrier of the fact.
 */
import type { MapCamera } from '../camera';
import { decodeInspectionRef } from '../inspection';
import type { InspectionRef } from '../../state';
import type { PlacedNode } from '../renderer/map-geometry';
import { mapSceneObjectKey } from '../projection';
import { WORLD_DUST, WORLD_NEBULA, WORLD_STARS } from './world-field.generated';
import { WORLD_VISUAL } from './world-visual.generated';
import { approachOf, stratumDrift, type StratumDrift, type WorldContrast } from './world-resolver';

export interface WorldSelection {
  readonly objectKey: string;
  /** The contextual appearance the inspection names, or `null` for the identity itself. */
  readonly bindingId: string | null;
}

export interface WorldPresentation {
  readonly approach: number;
  readonly contrast: WorldContrast;
  readonly selection: WorldSelection | null;
  readonly drift: { readonly nebula: StratumDrift; readonly stars: StratumDrift; readonly dust: StratumDrift };
}

const STILL: StratumDrift = Object.freeze({ offsetX: 0, offsetY: 0, follow: 1 });

/** The world at its widest distance, unanchored, standard contrast, nothing inspected. */
export const DEFAULT_WORLD_PRESENTATION: WorldPresentation = Object.freeze({
  approach: 0,
  contrast: 'standard',
  selection: null,
  drift: Object.freeze({ nebula: STILL, stars: STILL, dust: STILL }),
});

/** The current inspection, in the world's terms. */
export function worldSelection(inspection: InspectionRef | null): WorldSelection | null {
  const decoded = decodeInspectionRef(inspection);
  if (decoded === null) return null;
  if (decoded.family !== 'THREAD' && decoded.family !== 'READING' && decoded.family !== 'EMERGING_FOCUS') return null;
  return {
    objectKey: mapSceneObjectKey(decoded.family, decoded.id),
    bindingId: decoded.appearance?.kind === 'THREAD_READING' ? decoded.appearance.bindingId : null,
  };
}

export function isSelectedNode(selection: WorldSelection | null, node: PlacedNode): boolean {
  if (selection === null || selection.objectKey !== node.objectKey) return false;
  if (selection.bindingId === null) return true;
  return node.locus?.kind === 'CONTEXTUAL_APPEARANCE' && node.locus.bindingId === selection.bindingId;
}

/**
 * The strata's D2R depth planes. Clouds are the furthest plane, stars the middle one, and the dust lies
 * in the world itself (the canonical painter tiles it "in WORLD space under the map's own transform").
 */
export function worldPresentation(
  camera: MapCamera,
  options: { readonly reducedMotion: boolean; readonly contrast: WorldContrast; readonly inspection: InspectionRef | null },
): WorldPresentation {
  const { reducedMotion, contrast, inspection } = options;
  const p = WORLD_VISUAL.parallax;
  return {
    approach: approachOf(camera.scale),
    contrast,
    selection: worldSelection(inspection),
    drift: {
      nebula: stratumDrift(camera.anchor, camera.scale, WORLD_NEBULA.tile, p.far, reducedMotion),
      stars: stratumDrift(camera.anchor, camera.scale, WORLD_STARS.tile, p.mid, reducedMotion),
      dust: stratumDrift(camera.anchor, camera.scale, WORLD_DUST.tile, p.near, reducedMotion),
    },
  };
}
