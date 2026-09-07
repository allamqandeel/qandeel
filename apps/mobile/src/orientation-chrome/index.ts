/**
 * T-08 — Inspection + Orientation + Return Chrome: the Living Analysis Map made understandable and
 * operable as a Product surface.
 *
 * This layer invents no navigation semantics. It consumes the owners that already exist — T-02's
 * canonical state, T-03C's historical disclosure, T-04's Map and entitlement substrate, T-05's
 * presentation, T-06's temporal interaction and T-07's six return acts — and adds exactly one thing:
 * a truthful, read-only account of where the reader is, together with controls that reach the
 * existing executors and no others.
 *
 * Layer order, and the reason each boundary exists:
 *
 *   `types`                   the five orientation dimensions, kept apart in the type system so a
 *                             collapsed answer would be a type error rather than a wording mistake;
 *   `inspection-orientation`  `IF_ref` in, `IF_render` out, under one rule: an identity may be named
 *                             only where `K(TC)` confirms it;
 *   `return-orientation`      which of the six frozen acts is meaningful, and what each may promise;
 *   `context-orientation`     the disclosed contextual route and the disclosed appearances, ranked
 *                             by nothing and electing nothing;
 *   `model`                   the freshness gate: no semantic answer is derived from a projection
 *                             that has not been proven to be this viewpoint's;
 *   the components            the same truth as native semantics, with a non-drag route to every act.
 *
 * What this layer does NOT do: it stores no canonical field, adds no Product act, adds no temporal
 * mode, writes no `TM`, `TC`, `LH`, `LF`, `IF_ref` or camera, keeps no second copy of any of them,
 * mints no return authorization, reads no reversible-history internals, builds no history browser,
 * implements no second freshness rule, no projection cache, no second locatability resolver and no
 * second Live Focus resolver, fetches nothing, persists nothing, routes nothing, mounts nothing in
 * the app shell, animates nothing and adds no dependency at all.
 *
 * This barrel is the layer's whole public surface, and it is an allowlist: the static contract pins
 * the exact set of names below, so nothing can drift back into it by accident.
 */
export type {
  ChromeProjectionState,
  ContextAppearanceOption,
  ContextChrome,
  ContextStep,
  ContextStepKind,
  InspectionChrome,
  InspectionRenderState,
  LiveChrome,
  NoncurrentVersionState,
  OrientationModel,
  ReturnChrome,
  ReturnEffect,
  ReturnOpportunity,
  ReturnOpportunityId,
  SpatialChrome,
  TemporalChrome,
} from './types';
export { RETURN_OPPORTUNITY_IDS } from './types';

export { contextLineage, inspectionRender, renderableIdentity } from './inspection-orientation';

export type { ReturnCapabilityInputs } from './return-orientation';
export { opportunity, returnOrientation } from './return-orientation';

export type { ContextOrientationInputs } from './context-orientation';
export { CONTEXT_ORDERING_NOTE, contextOrientation, currentBindingOf, mapFamilyOf } from './context-orientation';

export type { ChromeProjection, OrientationModelOptions } from './model';
export { chromeProjection, mapProjectionRequest, orientationModel } from './model';

export type { OrientationChromeProps } from './OrientationChrome';
export {
  ORIENTATION_CHROME_LABEL,
  ORIENTATION_CHROME_TEST_ID,
  OrientationChrome,
  liveStatement,
  spatialStatement,
  temporalStatement,
} from './OrientationChrome';

export type { InspectionOrientationProps } from './InspectionOrientation';
export {
  CONTEXT_CHOICE_TEST_ID,
  INSPECTION_ORIENTATION_LABEL,
  INSPECTION_ORIENTATION_TEST_ID,
  InspectionOrientation,
  contextStepLabel,
  inspectionStatement,
} from './InspectionOrientation';

export type { ReturnControlsProps } from './ReturnControls';
export { RETURN_CONTROLS_LABEL, RETURN_CONTROLS_TEST_ID, ReturnControls } from './ReturnControls';
