/**
 * T-04 — camera mechanics: the concrete representation behind `MC`, the Class-D presentation
 * envelope, the pan and semantic-zoom interpreters, and the executors that turn one completed
 * input into exactly one canonical act.
 */
export type { CameraDecode, MapCamera } from './camera';
export {
  DEFAULT_MAP_SCALE,
  DEFAULT_WORLD_UNITS_PER_POINT_DENOMINATOR,
  DEFAULT_WORLD_UNITS_PER_POINT_NUMERATOR,
  WORLD_ORIGIN,
  decodeCameraIntent,
  encodeCameraIntent,
  initialCameraIntent,
} from './camera';

export type { ScreenPoint, ViewportEnvelope, ViewportInsets, WorldFootprint } from './viewport';
export {
  FINITE_PROJECTION_LIMIT_POINTS,
  POINT_SUBDIVISION,
  envelopeAspectRatio,
  envelopeCenter,
  exactPoints,
  footprintEquals,
  isWithinFootprint,
  pointsForWorldDelta,
  projectAddress,
  safeAreaHeight,
  safeAreaWidth,
  unprojectPoint,
  viewportEnvelope,
  visibleFootprint,
  worldDeltaForPoints,
} from './viewport';

export type { PanResolution, ViewportExplorationDirection } from './pan';
export {
  EXPLORATION_STEP_DENOMINATOR,
  EXPLORATION_STEP_NUMERATOR,
  VIEWPORT_EXPLORATION_DIRECTIONS,
  panFromExplorationStep,
  panFromTranslation,
} from './pan';

export type { SemanticZoomDirection, SemanticZoomResolution } from './zoom';
export {
  SEMANTIC_ZOOM_DIRECTIONS,
  SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR,
  SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR,
  adjacentDepth,
  depthIndex,
  reinforcedScale,
  semanticZoom,
} from './zoom';

export { currentCamera, exploreViewport, panByTranslation, zoomSemanticStep } from './map-camera-actions';

export type { MapPanGestureBinding, MapPanGestureOptions, MapPanProgress } from './useMapPanGesture';
export { IDLE_PAN_PROGRESS, useMapPanGesture } from './useMapPanGesture';
