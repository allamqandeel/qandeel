/**
 * T-06 — the temporal motion contract and its Reanimated binding. Motion explains Product truth and
 * never carries it: nothing here can dispatch, commit, cancel or reach canonical state.
 */
export type { TemporalMotionGeometry, TemporalMotionInput, TemporalMotionPlan } from './temporal-motion';
export {
  CANCEL_DAMPING_RATIO,
  COMMIT_SETTLE_SCALE,
  EASE_OUT_BEZIER,
  TEMPORAL_MOTION_DURATIONS,
  cursorOffsetFor,
  temporalMotionPlan,
  trackOffsetFor,
} from './temporal-motion';

export type { TemporalMotionBinding } from './useTemporalMotion';
export { PREVIEW_MARKER_OPACITY, useTemporalMotion } from './useTemporalMotion';
