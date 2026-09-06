/**
 * T-06 — the one-way bridge from T-05's disclosed presentation to temporal intent, and the composed
 * temporal surface. T-05 gains no store, no dispatch, no selection and no Live commit in return.
 */
export type { PresentationStripGeometry } from './presentation-geometry';
export { MIRROR_EPSILON, markerTranslateX, physicalPresentationX, presentationX, restingMarkerX } from './presentation-geometry';

export { disclosedTargetAt, temporalTargetFromDisclosed } from './disclosed-bridge';

export type {
  ScrubCoordinator,
  ScrubCoordinatorOptions,
  ScrubDependencies,
  ScrubForwarder,
  ScrubHandlers,
  ScrubInteraction,
  ScrubObservers,
  ScrubSurface,
} from './scrub';
export { createScrubCoordinator, createScrubForwarder, createScrubHandlers } from './scrub';

export type { TemporalScrubBinding, TemporalScrubGeometry, TemporalScrubOptions } from './useTemporalScrub';
export { useTemporalScrub } from './useTemporalScrub';

export type { LiveEdgeTargetProps, TemporalTargetLayerProps } from './TemporalTargetLayer';
export {
  TEMPORAL_COMMITTED_MARKER_TEST_ID,
  TEMPORAL_LIVE_EDGE_TEST_ID,
  TEMPORAL_PREVIEW_MARKER_TEST_ID,
  TEMPORAL_TARGET_LAYER_TEST_ID,
  TEMPORAL_TARGET_STRIP_TEST_ID,
  LiveEdgeTarget,
  TemporalTargetLayer,
} from './TemporalTargetLayer';
