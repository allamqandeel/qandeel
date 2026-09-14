// I-03G - the closed result vocabulary of the Connected Worlds privacy /
// authority delivery-readiness lane: the Source Disclosure Gate result, and the
// ordered readiness result that composes it with the frozen I-03F authority
// revalidation.
//
// Both live here because they are one lane in the frozen CW2-02 §22 delivery
// sequence and share one structural promise: neither of them is permission to
// deliver.
//
//   Provider output
//       -> Source Disclosure Gate          <- I-03G, first
//       -> Authority Snapshot revalidation  \
//       -> Audience Snapshot revalidation   /  I-03F, second
//       -> System / Safety policy check    <- NOT implemented (CW2-08)
//       -> Deliver / commit                <- NOT implemented (I-04)
//
// The two gates I-03 owns are complete here; the two after them are not, and the
// result vocabulary says so with closed literals rather than with a comment:
// `systemSafetyStatus` and `launchGateStatus` are `NOT_EVALUATED`, and
// `deliveryCommitAuthority` is `NOT_GRANTED_BY_THIS_BOUNDARY`. A later gate may
// only narrow an already valid privacy/authority result; it can never manufacture
// missing human privacy authority (CW2-02 §46, B30, B31).
//
// There is deliberately no `deliveryAllowed`, `allowed`, `safe`, `approved`,
// `canDeliver`, `commitReady`, `publishAllowed`, `materialDisclosureAllowed` or
// `sourceDisclosureAuthority: 'GRANTED'` position representable anywhere in this
// vocabulary, and no result in it names an owner, a source, a grant, a finding
// category, private content, provider output, a detector error or a consent
// state (CW2-02 §47, B33).

// ---------------------------------------------------------------------------
// The Source Disclosure Gate result.
// ---------------------------------------------------------------------------

/**
 * Why the gate cleared this exact output:
 *
 *   NO_PROTECTED_PRIVATE_CONTEXT - the EffectiveContext admitted no private
 *     reasoning context, so this gate had no protected private source set to
 *     inspect and no detector was invoked (task §18);
 *   SERVER_DETECTOR_CLEAR - a non-empty protected source set was inspected once
 *     by the server-owned detector, whose exactly bound CLEAR assessment was
 *     validated.
 *
 * Neither basis asserts System / Safety clearance, Shared material visibility or
 * delivery permission.
 */
export const SHARED_SOURCE_DISCLOSURE_GATE_BASES = ['NO_PROTECTED_PRIVATE_CONTEXT', 'SERVER_DETECTOR_CLEAR'] as const;
export type SharedSourceDisclosureGateBasis = (typeof SHARED_SOURCE_DISCLOSURE_GATE_BASES)[number];

/** The facts every clearance carries, whichever basis produced it. */
interface SharedSourceDisclosureClearanceFacts {
  /** `sha256:<64 lowercase hex>` binding the envelope, the exact output identity, the protected source set, the basis and any detector evidence. */
  readonly gateRef: string;
  readonly effectiveContextRef: string;
  /** `sha256:<64 lowercase hex>` over the exact UTF-8 provider output. Never the output itself. */
  readonly outputDigest: string;
  /** `sha256:<64 lowercase hex>` over the exact protected source set, in exact admitted order. Never raw private content. */
  readonly protectedSourceSetRef: string;
  /** The ONE thing a clearance states. It is not `SAFE`, and it is not a permission. */
  readonly sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §19, B15). A clear detector grants no disclosure. */
  readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §25, B18). */
  readonly materialDisclosureAuthority: 'NOT_GRANTED';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §24, B17). */
  readonly provenanceDisclosure: 'SEALED';
  /** CW2-02 §22: delivery / commit is the gate AFTER every check. Clearing one of them is never granting it. */
  readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';
}

/**
 * A cleared gate, discriminated by its basis rather than by optional fields: a
 * clearance that invoked no detector cannot carry detector evidence, and one
 * that did cannot omit it. Both are structurally impossible rather than merely
 * discouraged.
 */
export type SharedSourceDisclosureClearance =
  | (SharedSourceDisclosureClearanceFacts & { readonly basis: 'NO_PROTECTED_PRIVATE_CONTEXT' })
  | (SharedSourceDisclosureClearanceFacts & {
      readonly basis: 'SERVER_DETECTOR_CLEAR';
      /** The exact validated assessment this clearance rests on. Opaque and server-owned. */
      readonly detectorAssessmentRef: string;
      /** The exact detector policy version that produced it. Opaque and server-owned. */
      readonly detectorPolicyRef: string;
    });

/**
 * The ONE blocked reason. Every positively detected category collapses into it:
 * which category was found, which source or owner it came from, what was quoted
 * and what the provider wrote are all withheld (CW2-02 §47, B33; task §41).
 */
export const SHARED_SOURCE_DISCLOSURE_BLOCK_REASON = 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' as const;
export type SharedSourceDisclosureBlockReason = typeof SHARED_SOURCE_DISCLOSURE_BLOCK_REASON;

/**
 * The gate could not answer. Bounded internal classes only: never user-facing
 * text, a raw exception, a response body, an upstream failure string or a secret.
 */
export const SHARED_SOURCE_DISCLOSURE_UNRESOLVED_REASONS = [
  'MALFORMED_GENERATION_ARTIFACT',
  'DETECTOR_UNRESOLVED',
  'DETECTOR_BINDING_MISMATCH',
] as const;
export type SharedSourceDisclosureUnresolvedReason = (typeof SHARED_SOURCE_DISCLOSURE_UNRESOLVED_REASONS)[number];

/**
 * The three-state answer:
 *
 *   CLEAR      - no protected-source disclosure was detected for this exact
 *                output, on one of the two bases above;
 *   BLOCKED    - a valid, exactly bound assessment positively detected protected
 *                source disclosure. In the reasoning-only lane no direct
 *                disclosure authority exists, so every detection blocks (task
 *                §21);
 *   UNRESOLVED - the generation artifact is malformed, or the detector could not
 *                be trusted to have answered about this operation.
 *
 * BLOCKED and UNRESOLVED both stop delivery and are never collapsed into each
 * other: "we found a disclosure" and "we could not tell" are different facts.
 */
export type SharedSourceDisclosureGateResult =
  | { readonly state: 'CLEAR'; readonly gate: SharedSourceDisclosureClearance }
  | { readonly state: 'BLOCKED'; readonly reason: SharedSourceDisclosureBlockReason }
  | { readonly state: 'UNRESOLVED'; readonly reason: SharedSourceDisclosureUnresolvedReason };

// ---------------------------------------------------------------------------
// The ordered privacy / authority delivery-readiness result.
// ---------------------------------------------------------------------------

/**
 * Two independent proofs about ONE exact operation, and an explicit statement of
 * the gates that have NOT run. It is not a bearer permission: it authorizes
 * nothing for any other output, any other envelope or any later moment.
 */
export interface SharedPrivacyAuthorityDeliveryReadinessDetail {
  /** `sha256:<64 lowercase hex>` binding the envelope, the exact output identity and both boundary references. */
  readonly readinessRef: string;
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  /** The exact I-03G gate reference that cleared this output. */
  readonly sourceDisclosureGateRef: string;
  /** The exact frozen I-03F revalidation reference that found authority current for this output. */
  readonly authorityRevalidationRef: string;
  readonly sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED';
  readonly authorityStatus: 'CURRENT';
  /** CW2-02 §22, §46: a separate boundary that may narrow this result and never manufacture authority (B31). CW2-08 owns it. */
  readonly systemSafetyStatus: 'NOT_EVALUATED';
  /** CW2-08 §24-§25: launch eligibility and emergency disable are a separate boundary. Feature enablement never grants privacy authority. */
  readonly launchGateStatus: 'NOT_EVALUATED';
  /** CW2-02 §22: the gate after every check. I-04 owns Shared delivery and commit; this boundary grants neither. */
  readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';
}

/** The required privacy / authority state could not be safely established, or the two boundaries did not describe the same operation. */
export const SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_UNRESOLVED_REASONS = [
  'MALFORMED_GENERATION_ARTIFACT',
  'SOURCE_DISCLOSURE_UNRESOLVED',
  'AUTHORITY_UNRESOLVED',
  'OPERATION_BINDING_MISMATCH',
] as const;
export type SharedPrivacyAuthorityDeliveryReadinessUnresolvedReason =
  (typeof SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_UNRESOLVED_REASONS)[number];

/**
 * The four-state answer of the ordered boundary:
 *
 *   READY_FOR_LATER_DELIVERY_GATES - the exact output passed the I-03 Source
 *     Disclosure Gate and its privacy / authority state is current. It is named
 *     for what it is: readiness for the gates that come next, not permission;
 *   BLOCKED  - the Source Disclosure Gate blocked. The per-category, per-owner
 *     and per-source detail stays inside the gate;
 *   STALE    - authority or audience moved after generation. The old output must
 *     be discarded or regenerated under current authority (CW2-02 §8, §48, B34).
 *     The per-owner stale detail stays inside I-03F;
 *   UNRESOLVED - a required fact is not safely knowable, or the two boundaries
 *     did not agree about which operation they judged.
 */
export type SharedPrivacyAuthorityDeliveryReadiness =
  | { readonly state: 'READY_FOR_LATER_DELIVERY_GATES'; readonly readiness: SharedPrivacyAuthorityDeliveryReadinessDetail }
  | { readonly state: 'BLOCKED'; readonly reason: 'SOURCE_DISCLOSURE_BLOCKED' }
  | { readonly state: 'STALE'; readonly reason: 'AUTHORITY_STALE' }
  | { readonly state: 'UNRESOLVED'; readonly reason: SharedPrivacyAuthorityDeliveryReadinessUnresolvedReason };
