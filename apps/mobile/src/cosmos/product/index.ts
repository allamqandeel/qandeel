/**
 * COSMOS-INT-01 Slice B — the production COSMOS seam: the stage view and the three world owners over the PRODUCTION
 * authorities. Nothing of the device proof (`../__validation__`) is reachable from here.
 */
export type { CosmosPoint, CosmosRelation, CosmosStepResult, CosmosTapResult, CosmosUnplaced, CosmosWorldOwner, CosmosWorldSnapshot } from './owner-core';
export { cosmosCameraOf, gestureFixedPoint, viewOf } from './owner-core';
export { createPublicCosmosOwner } from './owners/public';
export { createSharedCosmosOwner } from './owners/shared';
export type { PersonalCosmosOwnerOptions } from './owners/personal';
export { createPersonalCosmosOwner, inspectionRequestOf } from './owners/personal';
export type { CosmosProductCopy } from './copy';
export { COSMOS_PRODUCT_COPY_GATE, cosmosProductCopy } from './copy';
export type { CosmosWorldViewProps } from './CosmosWorldView';
export {
  COSMOS_WORLD_VIEW_TEST_ID, COSMOS_BACK_TEST_ID, COSMOS_OVERVIEW_TEST_ID, COSMOS_RAIL_TEST_ID, COSMOS_REGISTER_TEST_ID, COSMOS_NEAREST_TEST_ID,
  COSMOS_STEP_TEST_ID_SUFFIX, COSMOS_MARK_TEST_ID_INFIX, COSMOS_RELATION_TEST_ID_INFIX, COSMOS_OVERVIEW_COMPANION_TEST_ID, CosmosWorldView,
} from './CosmosWorldView';
// Slice C (Contract v1.3 §15): the accepted bottom rail and the compact contextual controls of the Personal stage.
export type { CosmosTimelineRailProps } from './chrome/CosmosTimelineRail';
export {
  COSMOS_RAIL_COMMITTED_TEST_ID, COSMOS_RAIL_EARLIER_TEST_ID, COSMOS_RAIL_HEADLESS_TEST_ID, COSMOS_RAIL_LATER_TEST_ID, COSMOS_RAIL_LIVE_TEST_ID,
  COSMOS_RAIL_ACTS_ROW_TEST_ID, COSMOS_RAIL_LABEL_TEST_ID, COSMOS_RAIL_MOMENT_TEST_ID_PREFIX, COSMOS_RAIL_PREVIEW_TEST_ID, COSMOS_RAIL_SEGMENTS_TEST_ID, COSMOS_TIMELINE_RAIL_TEST_ID, CosmosTimelineRail,
  RAIL_MIN_PITCH, RAIL_ROW_HEIGHT, railWindow,
} from './chrome/CosmosTimelineRail';
export type { RailScrubBinding, RailScrubGeometry, RailScrubOptions } from './chrome/useRailScrub';
export { RAIL_SCRUB_GESTURE_TEST_ID, railSegmentAt, useRailScrub } from './chrome/useRailScrub';
export type { CosmosContextualActsProps } from './chrome/CosmosContextualActs';
export { COSMOS_ACTS_NOTE_TEST_ID, COSMOS_ACTS_TEST_ID, COSMOS_ACT_TEST_ID_PREFIX, COSMOS_CONTEXT_TEST_ID_PREFIX, COSMOS_OVERVIEW_ACT_TEST_ID, CosmosContextualActs, RAIL_ACTS, chipActs } from './chrome/CosmosContextualActs';
