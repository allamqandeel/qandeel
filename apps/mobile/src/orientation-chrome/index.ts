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
  ChromeLanguage,
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
  PreviewChrome,
  ReturnChrome,
  ReturnEffect,
  ReturnEffects,
  ReturnIntent,
  ReturnOpportunity,
  ReturnOpportunityId,
  ReturnPromise,
  SpatialChrome,
  TemporalChrome,
  TemporalPreviewSource,
} from './types';
export { RETURN_OPPORTUNITY_IDS } from './types';

export { contextLineage, inspectionRender, renderableIdentity } from './inspection-orientation';

// The ONE place any reader-facing word is written, in BOTH Product languages — every sentence,
// every control label, every control hint, every region name and the ordering note. That is what
// makes "no engineering vocabulary reaches the Product surface" checkable rather than aspirational,
// and it is enforced statically: no other module of this layer contains a reader-facing string at
// all. Every one of these takes the language as its first argument and decides nothing.
export type { ReturnWords } from './product-copy';
export {
  contextChoiceLabel,
  contextChoiceTitle,
  contextOrderingNote,
  contextPathSentence,
  contextStepWord,
  inspectionOrientationLabel,
  inspectionSentence,
  liveSentence,
  orientationChromeLabel,
  previewSentence,
  returnActWords,
  returnControlsLabel,
  spatialSentence,
  temporalSentence,
} from './product-copy';

export type { ReturnCapabilityInputs } from './return-orientation';
export { opportunity, returnMeaning, returnOrientation } from './return-orientation';

// R3-04, closed by T-12 §14 rather than continued.
//
// `bindExactReturnOrigin` once turned ANY currently valid T-07 checkpoint into a Product capability
// labelled "return to the original inspection". Same-store provenance is necessary and it is proven —
// but it is not evidence that the checkpoint IS the named origin of a real explicit inspection
// journey, and a checkpoint recorded by Return to World is not an original inspection however valid
// its handle. R3 answered that by removing the mint from this barrel, which stopped the defect and
// left the legitimate binding with no route at all.
//
// The mint is public again because the defect is now refused by the mint ITSELF: it admits only a
// target T-07 confirms was recorded by an act that can begin an explicit inspection journey, so a
// Return-to-World checkpoint — or a Back, a pan, a zoom, a commit, a context switch, or any of the
// six return acts — cannot become one, whatever a caller passes. That is strictly stronger than
// obscurity was. Which journey-capable checkpoint began THIS journey remains a composition fact this
// layer does not have, and the integration gate binds it at the real boundary; T-07 still re-proves
// provenance and presence independently at execution, which remains the only authority. Until an
// origin is supplied the Exact Return control is simply absent.
export type { ExactReturnOrigin } from './exact-return-origin';
export { bindExactReturnOrigin, exactReturnTargetFor, isExactReturnOrigin } from './exact-return-origin';

export type { ContextOrientationInputs } from './context-orientation';
export { contextOrientation, currentBindingOf, mapFamilyOf } from './context-orientation';

export type { ChromeProjection, OrientationModelOptions } from './model';
export { chromeProjection, mapProjectionRequest, orientationModel } from './model';

export type { OrientationChromeProps } from './OrientationChrome';
export { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from './OrientationChrome';

export type { InspectionOrientationProps } from './InspectionOrientation';
export { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID, InspectionOrientation } from './InspectionOrientation';

export type { ReturnControlsProps } from './ReturnControls';
export { RETURN_CONTROLS_TEST_ID, ReturnControls } from './ReturnControls';
