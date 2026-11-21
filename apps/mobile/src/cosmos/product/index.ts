/**
 * COSMOS-INT-01 Slice B — the production COSMOS seam: the stage view and the three world owners over the PRODUCTION
 * authorities. Nothing of the device proof (`../__validation__`) is reachable from here.
 */
export type { CosmosPoint, CosmosRelation, CosmosStepResult, CosmosTapResult, CosmosUnplaced, CosmosWorldOwner, CosmosWorldSnapshot } from './owner-core';
export { aimFixedPoint, cosmosCameraOf, gestureFixedPoint, soleHit, viewOf } from './owner-core';
export { createPublicCosmosOwner } from './owners/public';
export { createSharedCosmosOwner } from './owners/shared';
export type { PersonalCosmosOwnerOptions } from './owners/personal';
export { createPersonalCosmosOwner, inspectionRequestOf } from './owners/personal';
// COSMOS E-2 corrections, Slice C (D-5, Option U): the CURRENT Personal World's owner, beside the Session-bound one.
export type { CurrentPersonalCosmosOwnerOptions } from './owners/personal-current';
export { createCurrentPersonalCosmosOwner, currentThreadIdOf, currentThreadMarkId } from './owners/personal-current';
export type { CosmosProductCopy } from './copy';
export { COSMOS_ACT_LABELS_APPROVED, COSMOS_PRODUCT_COPY_GATE, cosmosProductCopy } from './copy';
export type { CosmosWorldViewProps } from './CosmosWorldView';
export {
  COSMOS_WORLD_VIEW_TEST_ID, COSMOS_BACK_TEST_ID, COSMOS_OVERVIEW_TEST_ID, COSMOS_RAIL_TEST_ID, COSMOS_REGISTER_TEST_ID, COSMOS_NEAREST_TEST_ID,
  COSMOS_STEP_TEST_ID_SUFFIX, COSMOS_MARK_TEST_ID_INFIX, COSMOS_RELATION_TEST_ID_INFIX, COSMOS_OVERVIEW_COMPANION_TEST_ID, CosmosWorldView, railTopOf, usableCentre,
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
// Slice D (Contract v1.5 §19): the COSMOS Detail Sheet — its geometry and snap rule, its presentation state, the view.
export type { SheetGeometry, SheetPhase, SnapInput } from './sheet/sheet-geometry';
export {
  SHEET_ADJACENT_SHARE, SHEET_ASSIST_MAX_SHARE, SHEET_ASSIST_SECONDS, SHEET_ASSIST_VELOCITY, SHEET_CLOSE_SHARE, SHEET_DELIBERATE_MIN, SHEET_HANDLE_HEIGHT, SHEET_PEEK_MAX,
  clampOffset, dragOffset, keyboardLift, keyboardOverlap, rubberband, sheetGeometry, sheetOffset, sheetStops, snapPhase,
} from './sheet/sheet-geometry';
export type { DetailSheet, SheetContent } from './sheet/useDetailSheet';
export { useDetailSheet } from './sheet/useDetailSheet';
export type { CosmosDetailSheetProps } from './sheet/CosmosDetailSheet';
export type { CosmosPeekWordsProps } from './sheet/CosmosPeekWords';
export { COSMOS_PEEK_PLACEHOLDER_INK, CosmosPeekWords, cosmosPeekChipStyles } from './sheet/CosmosPeekWords';
export {
  COSMOS_SHEET_BODY_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, COSMOS_SHEET_HANDLE_TEST_ID, COSMOS_SHEET_SCROLL_TEST_ID, COSMOS_SHEET_STAGE_TEST_ID, COSMOS_SHEET_TEST_ID,
  COSMOS_SHEET_ACCENT_TEST_ID, SHEET_ACTIVE_OFFSET_Y, SHEET_FAIL_OFFSET_X, SHEET_REDUCED_FADE_MS, SHEET_RELEASE, SHEET_REVEAL_MS, SHEET_SETTLE, CosmosDetailSheet, CosmosSheetStage, reopeningOwner,
} from './sheet/CosmosDetailSheet';
