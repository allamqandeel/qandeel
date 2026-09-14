// I-03A - Shared Standing Context authority: decision vocabulary.
//
// Pre-model authority decision. Must be revalidated before protected
// delivery/commit by a later runtime boundary.
//
// This namespace is the first Connected Worlds RUNTIME authority law. It sits
// beside the frozen I-01A kernel (`../kernel`), reuses its vocabulary (human
// principals, the branded Shared World identity, the Shared exact-world Context
// Admission meaning of owner + exact target World + SHARED_REASONING) and
// interprets nothing anew. It answers exactly one question (CW2-02 §16-§19,
// CW2-03 §39-§40):
//
//   Can private context owned by human H be admitted for QANDEEL reasoning
//   inside exact Shared World W, for exact current human Audience Snapshot A,
//   under the currently resolved Standing Context Grant state G?
//
// with the canonical external vocabulary ALLOW / DENY / UNKNOWN (CW2-02 §5):
// ALLOW only when every required condition is positively satisfied; DENY when
// canonical state positively says the use is not authorized; UNKNOWN when the
// required state is malformed, unresolved, contradictory or otherwise not
// safely knowable. DENY and UNKNOWN both block protected context externally
// and stay distinct internally (CW2-02 B4).
//
// Nothing here looks a grant up, creates or revokes one, invokes a model,
// assembles an EffectiveContext, revalidates delivery, or touches Matching,
// Public, material-disclosure or provenance-disclosure authority.

import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';

// ---------------------------------------------------------------------------
// The exact request. There is deliberately no other action, purpose, target
// kind, source scope or client permission claim representable here.
// ---------------------------------------------------------------------------

/** The only action this family evaluates. REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT (CW2-02 §19, B15). */
export const STANDING_CONTEXT_ACTION = 'REASON_FROM_PRIVATE_CONTEXT' as const;
export type StandingContextAction = typeof STANDING_CONTEXT_ACTION;

/** The only purpose: the kernel's Shared exact-world admission purpose literal. */
export const STANDING_CONTEXT_PURPOSE = 'SHARED_REASONING' as const;
export type StandingContextPurpose = typeof STANDING_CONTEXT_PURPOSE;

/**
 * The exact current HUMAN output audience, already resolved by a later
 * audience resolver (CW2-02 §6, §44). It is never inferred from a UI surface
 * and never manufactured or queried by the evaluator. Every member is human -
 * QANDEEL is not an audience principal - and the set is non-empty and
 * duplicate-free; ordering carries no meaning.
 */
export interface SharedHumanAudienceSnapshot {
  /** Non-empty opaque reference to the resolved snapshot; bound into every ALLOW. */
  readonly snapshotRef: string;
  readonly humans: ReadonlyArray<HumanPrincipal>;
}

/**
 * One exact Shared private-reasoning authority request. The target is a
 * branded `SharedWorldId`, which only a valid Shared World birth produces, so a
 * Public World, a Matching capability, a Replay or an Introduction record can
 * never be named as the target.
 */
export interface StandingContextAuthorityRequest {
  readonly action: StandingContextAction;
  readonly grantor: HumanPrincipal;
  readonly targetWorldId: SharedWorldId;
  readonly purpose: StandingContextPurpose;
  readonly audienceSnapshot: SharedHumanAudienceSnapshot;
}

// ---------------------------------------------------------------------------
// The resolved grant state. One resolution for the exact grantor / World -
// never a list of grants (CW2-02 §12, B10: no permissive union).
// ---------------------------------------------------------------------------

/** In parity with migration 0076's status vocabulary. No PENDING / EXPIRED / PAUSED: TTL and request lifecycle are not frozen. */
export const STANDING_CONTEXT_GRANT_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type StandingContextGrantStatus = (typeof STANDING_CONTEXT_GRANT_STATUSES)[number];

/**
 * The runtime authority facts of one resolved Standing Context Grant - a
 * projection of the 0076 row plus its explicit human audience ceiling, not a
 * new persistence schema. No TTL, no scope, no disclosure flag, no Matching or
 * Public dimension exists, and none can be smuggled in: the evaluator refuses
 * any other property.
 */
export interface StandingContextGrantSnapshot {
  readonly grantId: string;
  readonly worldId: SharedWorldId;
  readonly grantor: HumanPrincipal;
  readonly status: StandingContextGrantStatus;
  /** The humans explicitly authorized at grant / extension time (CW2-02 §18, B13). */
  readonly audienceCeiling: ReadonlyArray<HumanPrincipal>;
}

/** Bounded internal reasons a lookup could not safely establish current grant state. */
export const STANDING_CONTEXT_RESOLUTION_FAILURES = [
  'LOOKUP_FAILED',
  'LOOKUP_TIMED_OUT',
  'AUTHORITY_SNAPSHOT_UNAVAILABLE',
  'CONTRADICTORY_CANONICAL_STATE',
] as const;
export type StandingContextResolutionFailure = (typeof STANDING_CONTEXT_RESOLUTION_FAILURES)[number];

/**
 * What the canonical lookup established for the exact (grantor, World) query:
 *
 *   FOUND      - positively resolved one current grant fact;
 *   NOT_FOUND  - positively established that no current Standing Context
 *                Grant exists for this exact authority query;
 *   UNRESOLVED - the runtime could not safely establish current grant state.
 *
 * NOT_FOUND is a canonical fact and maps to DENY; UNRESOLVED is uncertainty and
 * maps to UNKNOWN. The two are never collapsed into each other.
 */
export type StandingContextGrantResolution =
  | { readonly state: 'FOUND'; readonly authoritySnapshotRef: string; readonly grant: StandingContextGrantSnapshot }
  | { readonly state: 'NOT_FOUND'; readonly authoritySnapshotRef: string }
  | { readonly state: 'UNRESOLVED'; readonly failure: StandingContextResolutionFailure };

// ---------------------------------------------------------------------------
// The decision.
// ---------------------------------------------------------------------------

export const AUTHORITY_DECISIONS = ['ALLOW', 'DENY', 'UNKNOWN'] as const;
export type AuthorityDecision = (typeof AUTHORITY_DECISIONS)[number];

/** Canonical state positively refuses the requested use. Internal audit classes, never user-facing text (CW2-02 §47). */
export const STANDING_CONTEXT_DENY_REASONS = [
  'NO_STANDING_CONTEXT_GRANT',
  'GRANT_REVOKED',
  'GRANTOR_MISMATCH',
  'TARGET_WORLD_MISMATCH',
  'AUDIENCE_EXCEEDS_GRANT_CEILING',
] as const;
export type StandingContextDenyReason = (typeof STANDING_CONTEXT_DENY_REASONS)[number];

/** The required state is not safely knowable. Internal audit classes, never user-facing text. */
export const STANDING_CONTEXT_UNKNOWN_REASONS = [
  'GRANT_STATE_UNRESOLVED',
  'MALFORMED_REQUEST',
  'MALFORMED_AUDIENCE_SNAPSHOT',
  'MALFORMED_GRANT_SNAPSHOT',
  'UNKNOWN_GRANT_STATUS',
  'MISSING_AUTHORITY_SNAPSHOT_REF',
  'MISSING_AUDIENCE_SNAPSHOT_REF',
] as const;
export type StandingContextUnknownReason = (typeof STANDING_CONTEXT_UNKNOWN_REASONS)[number];

/**
 * The narrow constraints that remain true under an ALLOW (CW2-02 §16-§20,
 * §24, B15-B17). Every position is a closed literal with exactly one value, so
 * a Standing Context ALLOW can never be read as material, disclosure or
 * provenance-disclosure authority, nor as delivery authority.
 */
export interface StandingContextAllowConstraints {
  readonly contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT';
  readonly reasoningAuthority: 'ALLOW';
  readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';
  readonly materialDisclosureAuthority: 'NOT_GRANTED';
  readonly provenanceDisclosure: 'SEALED';
  /** Pre-model only: a later runtime boundary revalidates authority and audience before delivery / commit (CW2-02 §6-§8, B7). */
  readonly deliveryAuthority: 'REQUIRES_REVALIDATION';
}

/**
 * Immutable evidence of exactly what was evaluated (CW2-02 §7, B6). It binds
 * the action, the grantor, the exact World, the purpose, the exact audience
 * (human ids canonically ordered - UI order is not authority meaning), the
 * grant and both snapshot references. It is not a bearer permission: it
 * authorizes nothing for a materially different request, carries no
 * evaluator-generated timestamp or identifier, and is not persisted here.
 */
export interface StandingContextDecisionBinding {
  readonly action: StandingContextAction;
  readonly grantorHumanId: string;
  readonly targetWorldId: SharedWorldId;
  readonly purpose: StandingContextPurpose;
  readonly audienceHumanIds: ReadonlyArray<string>;
  readonly grantId: string;
  readonly authoritySnapshotRef: string;
  readonly audienceSnapshotRef: string;
}

/**
 * The evaluator's answer. `externalEffect` makes the CW2-02 §5 rule structural:
 * only ALLOW admits anything, and it admits reasoning-only context; DENY and
 * UNKNOWN both block, differing only in the internal reason class.
 */
export type StandingContextAuthorityDecision =
  | {
      readonly decision: 'ALLOW';
      readonly externalEffect: 'ADMIT_FOR_REASONING_ONLY';
      readonly constraints: StandingContextAllowConstraints;
      readonly binding: StandingContextDecisionBinding;
    }
  | { readonly decision: 'DENY'; readonly externalEffect: 'BLOCKED'; readonly reason: StandingContextDenyReason }
  | { readonly decision: 'UNKNOWN'; readonly externalEffect: 'BLOCKED'; readonly reason: StandingContextUnknownReason };
