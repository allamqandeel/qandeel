// T-03B2b2 - the canonical durable Thread-establishment payload boundary.
//
// T-03B2a produces a PREPARED, transient promotion decision per committed CU.
// T-03B2b1 froze the pure permanent placement engine. Migration 0068's
// integrated per-Moment writer accepts NEITHER of them directly: it takes a
// canonical decision payload whose Thread, Home Anchor and event identities are
// stable RFC 4122 version-5 UUIDs derived server-side by the canonicalizer, and
// it computes the permanent placement itself under a per-user-world lock.
//
// One canonical decision object corresponds exactly to one proposed committed
// CU `unit_id`, including the CUs that establish nothing: "B2 evaluated and
// established nothing" and "B2 never ran" must stay distinguishable forever.
//
// What deliberately CANNOT be expressed here:
//   - a Home coordinate, a base, a shell, an attempt or a fingerprint (the
//     database is the only permanent-placement authority);
//   - a score, similarity, confidence, rank or importance;
//   - a parent, primary or preferred Conversational Origin member;
//   - a lifecycle state, a Live Focus, a Session Position or a same-SP
//     sequence (all allocated by the database, none caller-authored);
//   - a Reading, Timeline, projection, Neighborhood or Thread merge.
//
// Nothing here is a Nest provider and nothing here is wired into a runtime
// path: T-03B2b3 owns runtime orchestration and T-03D owns the live cutover.

import type { MappedAnchor } from '../conversational-focus/conversational-focus.types';
import type {
  NoEstablishmentReason,
  ThreadEstablishmentDecision,
  ThreadEstablishmentPath,
} from './thread-establishment.types';

/**
 * The closed technical Conversational Origin vocabulary of this boundary.
 * Origin is placement INPUT and durable provenance only - never parenthood,
 * hierarchy, causality, ownership or mandatory adjacency. T-03B2b2 does NOT
 * infer it from conversation text; it is a closed input that T-03B2b3 will
 * map from the frozen semantics it owns.
 */
export const PREPARED_ORIGIN_STATES = Object.freeze(['NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS'] as const);
export type PreparedOriginState = (typeof PREPARED_ORIGIN_STATES)[number];

/**
 * The Conversational Origin of ONE proposed establishment, naming already
 * canonical Threads of the same user world. No member is marked primary:
 * MULTIPLE and AMBIGUOUS are handled symmetrically over ALL members.
 */
export type PreparedConversationalOrigin =
  | { readonly state: 'NONE' }
  | { readonly state: 'RESOLVED'; readonly originThreadIds: readonly [string] }
  | { readonly state: 'MULTIPLE'; readonly originThreadIds: readonly string[] }
  | { readonly state: 'AMBIGUOUS'; readonly originThreadIds: readonly string[] };

/**
 * The two durable evidence roles. Evidence rows are PROVENANCE of one
 * promotion, never hierarchy edges and never a Thread relation.
 */
export const THREAD_EVIDENCE_ROLES = Object.freeze(['PRIOR_EVIDENCE', 'ESTABLISHING_CU'] as const);
export type ThreadEvidenceRole = (typeof THREAD_EVIDENCE_ROLES)[number];

/** One committed CU the promotion rests on, in canonical evidence order. */
export interface CanonicalThreadEvidence {
  readonly evidence_ordinal: number;
  readonly cu_id: string;
  readonly evidence_role: ThreadEvidenceRole;
}

/** TE-01 only: the exact current-CU wording of the user's selection, in code points. */
export interface CanonicalSelectionGrounding {
  readonly anchor_text: string;
  readonly anchor_occurrence: number;
  readonly span_start: number;
  readonly span_end: number;
}

/**
 * One canonical Thread-establishment decision for one proposed committed CU.
 * Exactly these twelve keys cross the database boundary, for BOTH decisions:
 * a NO_ESTABLISHMENT payload is the same shape with every establishment field
 * null or empty, so a decision is never absent and never inferred.
 */
export interface CanonicalThreadEstablishmentPayload {
  readonly unit_id: string;
  readonly decision: ThreadEstablishmentDecision;
  readonly no_establishment_reason: NoEstablishmentReason | null;
  /** The stable B1 focus this decision is about; null only when B1 found no independent focus. */
  readonly emerging_focus_id: string | null;
  readonly path: ThreadEstablishmentPath | null;
  /** Derived, never provider-authored. Null for NO_ESTABLISHMENT. */
  readonly thread_id: string | null;
  readonly home_anchor_id: string | null;
  readonly thread_established_event_id: string | null;
  readonly evidence: readonly CanonicalThreadEvidence[];
  readonly explicit_selection_grounding: CanonicalSelectionGrounding | null;
  readonly origin_state: PreparedOriginState;
  /** Canonical (textual) order; never a parent list and never a primary. */
  readonly origin_thread_ids: readonly string[];
}

/** The technical provenance the writer records on the Thread capture batch. */
export interface CanonicalThreadBatchProvenance {
  readonly threadEvaluatorVersion: string;
  readonly threadPolicyVersion: string;
  readonly threadProvider: string;
  readonly threadModel: string;
  readonly threadPromptVersion: string;
  readonly threadSchemaVersion: number;
}

/** A canonicalized ordered sequence: the exact B2 input of one integrated writer call per source turn. */
export interface CanonicalThreadSequence {
  readonly units: readonly CanonicalThreadEstablishmentPayload[];
  /** stable emerging_focus_id -> canonical thread_id, for every Thread this sequence establishes. */
  readonly threadIds: ReadonlyMap<string, string>;
}

export type ThreadCanonicalizationFailure =
  | 'INVALID_CANONICAL_UNIT_ID'
  | 'INVALID_DURABLE_IDENTITY'
  | 'ESTABLISHMENT_WITHOUT_FOCUS'
  | 'INVALID_PROMOTION_PATH'
  | 'INVALID_EVIDENCE_SHAPE'
  | 'INVALID_ORIGIN_CARDINALITY'
  | 'DUPLICATE_ORIGIN_THREAD'
  | 'ORIGIN_FORBIDDEN_WITHOUT_ESTABLISHMENT'
  | 'PREPARED_IDENTITY_LEAKED';

export class ThreadCanonicalizationError extends Error {
  constructor(
    readonly reason: ThreadCanonicalizationFailure,
    readonly cuId: string | null = null,
  ) {
    super(`Durable Thread canonicalization failed: ${reason}.`);
    this.name = 'ThreadCanonicalizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The prepared selection anchor as T-03B2a hands it over; re-shaped, never re-measured. */
export type PreparedSelectionGrounding = MappedAnchor;
