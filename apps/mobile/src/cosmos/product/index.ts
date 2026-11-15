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
  COSMOS_STEP_TEST_ID_SUFFIX, COSMOS_MARK_TEST_ID_INFIX, COSMOS_RELATION_TEST_ID_INFIX, CosmosWorldView,
} from './CosmosWorldView';
