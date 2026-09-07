/**
 * T-10 — Living Analysis Map Motion System v1.
 *
 * > **Nothing teleports. Meaning resolves.**
 *
 * A narrow PRESENTATION owner. It holds the cross-cutting motion vocabulary, the presentation
 * camera that keeps the world spatially continuous across an already-authorized canonical change,
 * the arrival recipes for objects that are legitimately in the current `V`, and the ONE crossing
 * between the UI runtime and the Product runtime.
 *
 * What this owner may never contain, and does not:
 *
 *   a canonical store or any second one; a second navigation state; temporal mode, `TC` or `RH`
 *   authority; a Product dispatch of any kind; ownership of the Preview controller; locatability,
 *   entitlement or `K(t)`; projection truth; Live Focus truth; Exact Return provenance; responsive
 *   policy; locale policy; app-shell integration.
 *
 * The consequence is stated once and holds everywhere: an animation completion NEVER dispatches a
 * canonical action, authorizes a Return, commits or cancels a Preview, changes a temporal mode,
 * mutates `RH`, decides locatability, decides entitlement, decides whether an object exists, or
 * decides where the camera lands. A Product act is already true before any of this explains it,
 * and a motion that never finishes changes nothing about what is true.
 *
 * ## `COMPOSITE_SPATIAL_CAUSE_BINDING_DEFERRED_TO_T12`
 *
 * The composite choreography — the explanatory beat between the two truths of Go Live + Locate —
 * remains here as a PURE, tested plan: `presentationTravelPlan` accepts the cause and returns the
 * beat. What does NOT ship is a way to arm it.
 *
 * A generic pending mailbox is exactly the wrong shape for it. An outcome can be noted while the Map
 * is between projections and therefore cannot consume it, and the accessible viewport routes stay
 * deliberately reachable during that gap — so a beat armed by one act could be worn by an unrelated
 * later camera change once a fresh Map mounts. Narrowing the arming condition does not fix that;
 * only binding the cause to ONE exact transition does, and the transition is not knowable here. This
 * owner is deliberately not app-shell mounted, and which canonical change an outcome belongs to is a
 * composition fact that T-12 owns. Binding it here would mean taking that ownership.
 *
 * So the capability is kept and the arming is deferred. No production path can produce a cause, and
 * the camera passes `null` unconditionally.
 */
export {
  ACT_DAMPING_RATIO,
  DISCLOSURE_ENTRY_SCALE,
  MOTION_DURATIONS_MS,
  QANDEEL_EASE_OUT,
  REDUCED_RESOLVE_FROM_OPACITY,
  REST_EPSILON_POINTS,
  REST_EPSILON_ZOOM,
  TRAVEL_CEILING_DIAGONALS,
  TRAVEL_LONG_FLIGHT_DIAGONALS,
  travelDurationMs,
} from './tokens';

export type { PresentationResidualEnvelope, PresentedCandidate, PresentedViewport } from './presentation-camera/culling';
export {
  RESIDUAL_ENVELOPE_AT_REST,
  envelopeHull,
  isPresentedWithinEnvelope,
  rebasedEnvelope,
  residualEnvelope,
} from './presentation-camera/culling';

export type { PresentationPoint, PresentationResidual } from './presentation-camera/residual';
export {
  RESIDUAL_AT_REST,
  counterScale,
  planeTransformTriple,
  rebasedResidual,
  residualToScreen,
  residualTravelPoints,
  residualZoomDistance,
  screenToResidual,
} from './presentation-camera/residual';

export type {
  PresentationMotionCause,
  PresentationTravelInput,
  PresentationTravelKind,
  PresentationTravelPlan,
} from './presentation-camera/travel-plan';
export { presentationTravelPlan, residualIsAtRest } from './presentation-camera/travel-plan';

export type {
  CanonicalCameraChange,
  ObjectTransform,
  PlaneTransform,
  PresentationCameraBinding,
  PresentationCameraOptions,
} from './presentation-camera/usePresentationCamera';
export { usePresentationCamera } from './presentation-camera/usePresentationCamera';

export type { ArrivalPresentation, DisclosureArrivalInput, DisclosureArrivalPlan } from './presence/arrival';
export { ARRIVAL_AT_REST, arrivalPresentation, disclosureArrivalPlan, newlyDisclosedKeys } from './presence/arrival';

export type { ArrivalRegistry } from './presence/arrival-registry';
export { createArrivalRegistry } from './presence/arrival-registry';

export type { DisclosureArrivalProps } from './presence/DisclosureArrival';
export { DisclosureArrival } from './presence/DisclosureArrival';

export type { AuthorityGeneration } from './runtime/authority';
export { useAuthorityGeneration } from './runtime/authority';

export type { DerivedValue, SharedValue } from './runtime/bridge';
export { handoffToProduct } from './runtime/bridge';

export type { MutableBox } from './runtime/box';
export { createBox } from './runtime/box';
