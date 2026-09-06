/**
 * T-04 — inspection, context switching, direct addressability and the locatability substrate.
 * Every reference and every locus here is minted from the disclosed projection `V` alone.
 */
export type {
  DecodedInspectionRef,
  EntitledInspection,
  EntitlementRefusal,
  EntitlementRejectionReason,
  EntitlementResolution,
  InspectionAppearanceRequest,
  InspectionRequest,
} from './entitlement';
export { INSPECTABLE_FAMILIES, decodeInspectionRef, isEntitledInspection, resolveEntitledInspection } from './entitlement';

export type { EntitledLocus, LocatabilityResult } from './locatability';
export { entitledLoci, isEntitledLocus, locusForBinding, resolveLocatability } from './locatability';

export type { DirectJumpOutcome, DirectJumpRequest, MapContextResolution, MapInspectionContext } from './map-actions';
export {
  MAP_ACTION_AUTHORITY,
  directJump,
  disclosedAppearances,
  inspectEntitled,
  inspectObject,
  mapInspectionContext,
  switchContext,
  switchContextEntitled,
} from './map-actions';
