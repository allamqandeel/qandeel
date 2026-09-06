/**
 * T-04 — Semantic Zoom mechanics for the frozen `ZOOM_SEMANTIC` act.
 *
 * Semantic Zoom is DISCLOSURE along the frozen five-rung lineage
 * `WORLD → THREAD → SESSION → ANALYTICAL_OBJECT → SOURCE_PROVENANCE`. The depth is the only
 * semantic authority in this task. A geometric reinforcement travels with the depth change so
 * the transition is legible, but it is a consequence, never the cause: no reader of the Map may
 * derive a rung from a magnitude, the scale is clamped into a representable band without ever
 * changing the rung, and a pinch that produced no depth change would produce no disclosure.
 *
 * Depth is also not a route stack. There is no screen to push and no history to pop: the same
 * camera, over the same world, discloses more or less of the same canonical identities. On a
 * narrow viewport the consequence is fewer things visible at once — reduced simultaneity — never
 * a different world, a different Home or a different object.
 */
import { SEMANTIC_DEPTHS, type SemanticDepth, type ZoomIntent } from '../../state';
import { scaleBy, scaleIntentRef, type MapScale } from '../world';
import type { MapCamera } from './camera';

export const SEMANTIC_ZOOM_DIRECTIONS = Object.freeze(['IN', 'OUT'] as const);
export type SemanticZoomDirection = (typeof SEMANTIC_ZOOM_DIRECTIONS)[number];

/**
 * One rung of geometric reinforcement: eight times fewer world units per point when disclosing
 * deeper. An engineering constant of the presentation transform; it carries no Product quantity.
 */
export const SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR = 1n;
export const SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR = 8n;

export function depthIndex(depth: SemanticDepth): number {
  return SEMANTIC_DEPTHS.indexOf(depth);
}

/** The next rung along the frozen lineage, or `null` at the World floor / Provenance ceiling. */
export function adjacentDepth(depth: SemanticDepth, direction: SemanticZoomDirection): SemanticDepth | null {
  const index = depthIndex(depth);
  if (index < 0) return null;
  const next = direction === 'IN' ? index + 1 : index - 1;
  return next >= 0 && next < SEMANTIC_DEPTHS.length ? SEMANTIC_DEPTHS[next] : null;
}

export function reinforcedScale(scale: MapScale, direction: SemanticZoomDirection): MapScale {
  return direction === 'IN'
    ? scaleBy(scale, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR, SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR)
    : scaleBy(scale, SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR);
}

export type SemanticZoomResolution =
  | { readonly outcome: 'INTENT'; readonly depth: SemanticDepth; readonly to: ZoomIntent; readonly scale: MapScale }
  | { readonly outcome: 'AT_RUNG_BOUNDARY' };

/**
 * Resolves one semantic-depth step. The focal anchor is deliberately not written: a depth change
 * discloses more or less about the same place, so the camera stays where the reader put it
 * unless an explicitly authorized act moves it.
 */
export function semanticZoom(camera: MapCamera, direction: SemanticZoomDirection): SemanticZoomResolution {
  const depth = adjacentDepth(camera.depth, direction);
  if (depth === null) return { outcome: 'AT_RUNG_BOUNDARY' };
  const scale = reinforcedScale(camera.scale, direction);
  return { outcome: 'INTENT', depth, to: { scale: scaleIntentRef(scale) }, scale };
}
