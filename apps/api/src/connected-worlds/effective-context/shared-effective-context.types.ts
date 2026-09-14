// I-03E - Shared EffectiveContext: pre-model World-state and private Context
// Admission vocabulary.
//
// Pre-model authority envelope. Must be revalidated before protected
// delivery/commit by a later runtime boundary.
//
// This namespace is the Connected Worlds PRE-MODEL privacy boundary for the
// Shared private-reasoning lane (I-00 §7, R2; CW2-02 §21). It is closed
// vocabulary only: the World-state snapshot the pre-model gate consumes, the
// candidate private-context contract a server-owned collector offers, the
// authorized item that survives admission, the EffectiveContext envelope and
// the three-state resolution. It reuses the frozen kernel (MY_WORLD reference,
// content availability, source-context reference, Shared lifecycle / phase)
// and the frozen I-03A decision without reinterpretation, and defines no
// disclosure, publication, history, Replay, Matching, Public, delivery or
// budget vocabulary.

import type { MyWorldRef, SharedWorldId } from '../kernel/world.types';
import type { SharedWorldLifecycle, SharedWorldPhase } from '../kernel/shared-world.types';
import type { ContentAvailability, SourceContextRef } from '../kernel/material.types';
import type { SharedHumanAudienceSnapshot, StandingContextAuthorityDecision } from '../authority/standing-context-authority.types';

// ---------------------------------------------------------------------------
// Shared pre-model World state (migration 0080).
// ---------------------------------------------------------------------------

/** Bounded internal reasons the canonical World state could not be safely established. Never user-facing text (CW2-02 §47). */
export const SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES = [
  'LOOKUP_FAILED',
  'LOOKUP_TIMED_OUT',
  'WORLD_STATE_SNAPSHOT_UNAVAILABLE',
  'CONTRADICTORY_CANONICAL_STATE',
] as const;
export type SharedPreModelWorldStateResolutionFailure = (typeof SHARED_PRE_MODEL_WORLD_STATE_RESOLUTION_FAILURES)[number];

/**
 * The exact canonical lifecycle / phase of one Shared World, with the
 * deterministic reference that identifies exactly that state. The vocabulary
 * is the frozen kernel's (CW2-01 §8, CW2-03 §11); nothing here decides what
 * the state permits.
 */
export interface SharedPreModelWorldStateSnapshot {
  readonly worldId: SharedWorldId;
  readonly lifecycle: SharedWorldLifecycle;
  readonly phase: SharedWorldPhase;
  /** Non-empty deterministic reference to the resolved state; bound into every EffectiveContext. */
  readonly snapshotRef: string;
}

/**
 * What the canonical lookup established for the exact World:
 *
 *   RESOLVED   - the canonical row was found and its state is legal;
 *   UNRESOLVED - the current state could not be safely established: malformed
 *                input, missing server configuration, timeout, transport
 *                failure, a noncanonical World (bounded P0002), or a malformed
 *                / contradictory payload.
 *
 * There is deliberately no NOT_FOUND: a missing canonical World is
 * contradiction, not absence, and never resolves as closed or empty.
 */
export type SharedPreModelWorldStateResolution =
  | { readonly state: 'RESOLVED'; readonly snapshot: SharedPreModelWorldStateSnapshot }
  | { readonly state: 'UNRESOLVED'; readonly failure: SharedPreModelWorldStateResolutionFailure };

// ---------------------------------------------------------------------------
// Candidate private context, as offered by a server-owned collector.
// ---------------------------------------------------------------------------

/** The only candidate kind: private context originating in a human's own MY_WORLD. */
export const SHARED_PRIVATE_CONTEXT_CANDIDATE_KIND = 'MY_WORLD_PRIVATE_CONTEXT' as const;

/** The availabilities under which a candidate carries NO content and can never be admitted or resurrected. */
export type UnavailableContentAvailability = Exclude<ContentAvailability, 'AVAILABLE'>;

interface SharedPrivateContextCandidateIdentity {
  readonly kind: typeof SHARED_PRIVATE_CONTEXT_CANDIDATE_KIND;
  /** Opaque source context identity as the collector knows it; unique per MY_WORLD owner, never assumed to be a UUID. */
  readonly contextId: string;
  /** The exact human MY_WORLD the context originates in. Never a Shared, Public or Matching origin. */
  readonly originWorld: MyWorldRef;
}

/** An AVAILABLE candidate: the exact reasoning content, preserved byte-for-byte if admitted. */
export interface AvailableSharedPrivateContextCandidate extends SharedPrivateContextCandidateIdentity {
  readonly availability: 'AVAILABLE';
  readonly reasoningContent: string;
}

/**
 * A DELETED_BY_OWNER or UNAVAILABLE candidate. It carries no content, by type
 * (`reasoningContent?: never`) and by runtime validation: an unavailable
 * candidate that still carries content is a malformed candidate set (CW2-02
 * §27, B19; CW2-03 §37, C32).
 */
export interface UnavailableSharedPrivateContextCandidate extends SharedPrivateContextCandidateIdentity {
  readonly availability: UnavailableContentAvailability;
  readonly reasoningContent?: never;
}

export type SharedPrivateContextCandidate = AvailableSharedPrivateContextCandidate | UnavailableSharedPrivateContextCandidate;

// ---------------------------------------------------------------------------
// The authorized item and the envelope.
// ---------------------------------------------------------------------------

/** Exactly the frozen I-03A ALLOW branch: reasoning-only, no disclosure, sealed provenance, delivery requires revalidation. */
export type StandingContextAllowDecision = Extract<StandingContextAuthorityDecision, { readonly decision: 'ALLOW' }>;

/** A kernel SourceContextRef whose origin is a human MY_WORLD. Never a SourceMaterialRef: admission is reasoning influence, not material transfer. */
export interface PrivateSourceContextRef extends SourceContextRef {
  readonly originWorld: MyWorldRef;
}

/**
 * One admitted private reasoning context. `authority` is structurally the
 * exact I-03A ALLOW decision for this owner, this World and this audience
 * snapshot; its constraints are carried, never reinterpreted. `contentDigest`
 * detects content drift and replaces nothing.
 */
export interface AuthorizedPrivateReasoningContext {
  readonly kind: 'AUTHORIZED_PRIVATE_REASONING_CONTEXT';
  readonly source: PrivateSourceContextRef;
  readonly reasoningContent: string;
  /** `sha256:<64 lowercase hex>` over the exact UTF-8 reasoning content. */
  readonly contentDigest: string;
  readonly authority: StandingContextAllowDecision;
}

/**
 * The Shared EffectiveContext for one exact World under one exact World-state
 * snapshot and one exact audience snapshot. It carries no material,
 * publication, history, Replay, Matching, Public or delivery permission: every
 * admitted item stays `deliveryAuthority = REQUIRES_REVALIDATION`.
 */
export interface SharedEffectiveContext {
  /** `sha256:<64 lowercase hex>` binding World, World-state snapshot, audience snapshot and every admitted item in order. */
  readonly effectiveContextRef: string;
  readonly targetWorldId: SharedWorldId;
  readonly worldStateSnapshotRef: string;
  readonly audienceSnapshot: SharedHumanAudienceSnapshot;
  /** Admitted items in offered candidate order; at most one per offered candidate. */
  readonly privateReasoningContexts: ReadonlyArray<AuthorizedPrivateReasoningContext>;
}

/** Known canonical state that blocks ordinary pre-model Shared generation. Not uncertainty. */
export const SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS = ['WORLD_READ_ONLY_CLOSED', 'NO_ACTIVE_HUMANS'] as const;
export type SharedEffectiveContextBlockReason = (typeof SHARED_EFFECTIVE_CONTEXT_BLOCK_REASONS)[number];

/** Uncertainty or contradiction: no EffectiveContext can be built. Never user-facing text. */
export const SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS = ['WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED', 'MALFORMED_CANDIDATE_SET'] as const;
export type SharedEffectiveContextUnresolvedReason = (typeof SHARED_EFFECTIVE_CONTEXT_UNRESOLVED_REASONS)[number];

/**
 * The pre-model answer:
 *
 *   READY      - an ACTIVE World with a non-empty current human audience; the
 *                envelope carries every admitted item (possibly none);
 *   BLOCKED    - known canonical state blocks ordinary generation;
 *   UNRESOLVED - the required state is not safely knowable, or the candidate
 *                set is malformed / contradictory.
 *
 * No per-owner DENY / UNKNOWN detail exists in any shape: excluded candidates
 * are simply absent from a READY envelope (CW2-02 §47, B33).
 */
export type SharedEffectiveContextResolution =
  | { readonly state: 'READY'; readonly effectiveContext: SharedEffectiveContext }
  | { readonly state: 'BLOCKED'; readonly reason: SharedEffectiveContextBlockReason }
  | { readonly state: 'UNRESOLVED'; readonly reason: SharedEffectiveContextUnresolvedReason };
