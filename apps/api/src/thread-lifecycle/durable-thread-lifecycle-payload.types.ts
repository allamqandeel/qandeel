// T-03B3 - the canonical durable Thread-layer (B3) payload boundary.
//
// The orchestration prepares, per committed CU, ONE final Thread-layer
// decision that combines the B2 establishment decision (frozen 0068 payload,
// produced by the T-03B2b2 canonicalizer), the cross-Session continuity
// resolution and the deterministic lifecycle reduction. Migration 0070's
// integrated writer accepts a canonical decision payload whose binding and
// lifecycle-event identities are stable RFC 4122 version-5 UUIDs derived
// server-side by the canonicalizer, and it re-derives, re-validates and
// re-reduces everything itself.
//
// One canonical decision object corresponds exactly to one proposed committed
// CU `unit_id`, including the CUs that change nothing: "B3 evaluated and
// changed nothing" and "B3 never ran" must stay distinguishable forever.
//
// What deliberately CANNOT be expressed here: a Home coordinate, a score /
// similarity / confidence / rank / importance, a `from_state` (DB-derived), a
// timestamp, an SP or same-SP sequence (DB-allocated), a global lifecycle
// state, a Thread merge, a Reading, a Timeline or an LF.

import type { ThreadFocusBindingKind, ThreadLifecycleReasonCode, ThreadLifecycleState } from './thread-lifecycle.types';

/** The closed final Thread-layer outcome vocabulary (task section 8.1). */
export const THREAD_LAYER_OUTCOMES = Object.freeze([
  'NO_THREAD_ACTION',
  'ESTABLISH_NEW',
  'ATTEND_EXISTING',
  'ACTIVATE_EXISTING_IN_SESSION',
  'REOPEN_EXISTING',
  'IDENTITY_AMBIGUOUS',
] as const);
export type ThreadLayerOutcome = (typeof THREAD_LAYER_OUTCOMES)[number];

/** One current-CU canonical RESOLVED reference cited as identity evidence. */
export interface CanonicalIdentityEvidenceRef {
  readonly cu_id: string;
  readonly reference_index: number;
}

/** One existing dossier item of the bound Thread cited as prior evidence. */
export interface CanonicalPriorIdentityEvidenceRef {
  readonly cu_id: string;
  readonly exact_surface: string;
}

/** One canonical lifecycle transition at this CU. `from_state` is never here: the database derives it. */
export interface CanonicalLifecycleTransition {
  readonly thread_id: string;
  readonly to_state: ThreadLifecycleState;
  readonly reason_code: ThreadLifecycleReasonCode;
  /** Derived, never provider-authored. */
  readonly lifecycle_event_id: string;
}

/**
 * One canonical final Thread-layer decision for one proposed committed CU.
 * Exactly these ten keys cross the database boundary, for EVERY outcome.
 */
export interface CanonicalThreadLifecyclePayload {
  readonly unit_id: string;
  readonly outcome: ThreadLayerOutcome;
  /** The stable B1 focus of this CU; null only when B1 found no independent focus. */
  readonly emerging_focus_id: string | null;
  /** The bound / established Thread for the four binding-bearing outcomes; null otherwise. */
  readonly thread_id: string | null;
  readonly binding_kind: ThreadFocusBindingKind | null;
  /** Derived, never provider-authored. Non-null only when a binding is created at this CU. */
  readonly focus_binding_id: string | null;
  readonly identity_evidence: readonly CanonicalIdentityEvidenceRef[];
  readonly prior_identity_evidence: readonly CanonicalPriorIdentityEvidenceRef[];
  /** Canonical (textual) order; at least two for IDENTITY_AMBIGUOUS, empty otherwise. */
  readonly candidate_thread_ids: readonly string[];
  /** Canonical (textual Thread) order; every transition shares this CU's same-SP sequence 2. */
  readonly lifecycle_transitions: readonly CanonicalLifecycleTransition[];
}

/** The technical provenance the writer records on the final Thread-layer capture batch. */
export interface CanonicalThreadLifecycleBatchProvenance {
  readonly continuityEvaluatorVersion: string;
  readonly continuityPolicyVersion: string;
  readonly continuityProvider: string;
  readonly continuityModel: string;
  readonly continuityPromptVersion: string;
  readonly continuitySchemaVersion: number;
  readonly lifecycleReducerVersion: string;
}

/** A canonicalized ordered sequence: the exact B3 input of one integrated writer call per source turn. */
export interface CanonicalThreadLifecycleSequence {
  readonly units: readonly CanonicalThreadLifecyclePayload[];
}

export type ThreadLifecycleCanonicalizationFailure =
  | 'INVALID_CANONICAL_UNIT_ID'
  | 'INVALID_DURABLE_IDENTITY'
  | 'INVALID_OUTCOME_SHAPE'
  | 'INVALID_EVIDENCE_SHAPE'
  | 'INVALID_CANDIDATE_CARDINALITY'
  | 'DUPLICATE_CANDIDATE_THREAD'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_TRANSITION_THREAD'
  | 'PREPARED_IDENTITY_LEAKED';

export class ThreadLifecycleCanonicalizationError extends Error {
  constructor(
    readonly reason: ThreadLifecycleCanonicalizationFailure,
    readonly cuId: string | null = null,
  ) {
    super(`Durable Thread-layer canonicalization failed: ${reason}.`);
    this.name = 'ThreadLifecycleCanonicalizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
