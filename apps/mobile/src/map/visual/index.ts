/**
 * VPORT-01 — the Living Analysis World's visual expression. See `world-resolver.ts` for what it may
 * express and the rule behind it, and `apps/mobile/scripts/generate-world-visual.mjs` for where every
 * value comes from.
 */
export { WORLD_VISUAL, worldSchedule, type WorldSchedule } from './world-visual.generated';
export {
  MARK_RADIUS_POINTS,
  approachOf,
  hsla,
  morphologyPath,
  placementOf,
  presentationRotation,
  presentedApproach,
  scheduleAt,
  stratumDrift,
  tierOf,
  unitsPerPoint,
  worldPalette,
  type StratumDrift,
  type WorldContrast,
  type WorldPlacement,
  type WorldTier,
} from './world-resolver';
export {
  DEFAULT_WORLD_PRESENTATION,
  isSelectedNode,
  worldPresentation,
  worldSelection,
  type WorldPresentation,
  type WorldSelection,
} from './world-presentation';
export { useWorldResponse, type WorldResponse } from './useWorldResponse';
export { WorldAtmosphere, WorldGround, WorldVeil, type WorldStrataDrift } from './WorldStrata';
export { RegisterMark, WorldObject, WorldTether, markerRadius } from './WorldMarks';
