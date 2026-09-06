/**
 * T-06 — addressability, the commit boundary, locate resolution and the two promoted temporal acts.
 * Every temporal target in the layer is judged here, and nowhere else.
 */
export type { ForwardStep, TargetResolution, TemporalBounds, TemporalTargetIntent } from './addressability';
export { LIVE_EDGE_INTENT, isAddressableTarget, nextForwardTarget, resolveTemporalTarget, targetRefusal, temporalBounds } from './addressability';

export {
  commitLiveEdge,
  commitLiveEdgeIntent,
  commitMoment,
  commitPreviewedTarget,
  commitTemporalIntent,
  committedPosition,
} from './commit';

export type { LocateResolution, TemporalLocateTarget } from './locate';
export { legitimateLoci, resolveLocateAtTarget } from './locate';

export type { ChooseLocusRequest, CommitMomentAndLocateOutcome, CommitMomentAndLocateRequest } from './temporal-actions';
export { TEMPORAL_ACTION_AUTHORITY, chooseLocus, commitMomentAndLocate, projectionMoment } from './temporal-actions';
