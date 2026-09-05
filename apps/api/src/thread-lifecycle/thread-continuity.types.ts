// T-03B3 - Cross-Session Thread continuity: the frozen domain types.
//
// Architecture Decision B3-02: cross-Session continuity is SEMANTIC IDENTITY
// resolution, never name / similarity authority. A later Session Emerging
// Focus binds to an existing user/world Thread only when QANDEEL can defend
// that the current focus refers to the SAME canonical conversational locus.
// Never because of the same name alone, repeated wording, embedding distance,
// a similarity score, Home proximity, relation count, importance, confidence,
// recency, popularity, Thread age or a "best match". Same-name ambiguity
// stays ambiguity; a genuinely distinct focus with overlapping wording stays
// distinct.
//
// Architecture Decision B3-03: candidate screening is EXHAUSTIVE and
// DETERMINISTIC over every canonical Thread dossier of the user, in
// `thread_id` textual order, in fixed-size chunks, against ONE exact
// user/world identity version; the final resolution runs once over the union
// of every nominated Thread. No retrieval heuristic can silently drop a
// Thread. The provider cannot mint a Thread id, and a technical failure is
// never DISTINCT_NEW.

import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type { CurrentCuInput } from '../conversational-focus/conversational-focus.types';

/** The fixed technical screening chunk. Adjustable only if tests prove behaviour does not change. */
export const THREAD_CONTINUITY_SCREEN_CHUNK_SIZE = 32;

/** The closed final continuity decisions. Nothing graded, nothing provisional. */
export const THREAD_CONTINUITY_DECISIONS = Object.freeze(['DISTINCT_NEW', 'BIND_EXISTING', 'AMBIGUOUS_EXISTING'] as const);
export type ThreadContinuityDecision = (typeof THREAD_CONTINUITY_DECISIONS)[number];

/** Evaluator and policy identity recorded on every prepared continuity result. */
export const THREAD_CONTINUITY_EVALUATOR_VERSION = 'thread-continuity-evaluator-v1';

/**
 * One source-grounded identity-evidence item of a user/world Thread dossier,
 * exactly as migration 0070 exposes it. Committed wording only: no alias, no
 * normalized key, no Home coordinate, no lifecycle, no analytical metadata.
 */
export interface ThreadIdentityEvidenceItem {
  readonly sessionId: string;
  readonly cuId: string;
  readonly exactSurface: string;
  readonly committedCuText: string;
  readonly sourceRole: 'USER' | 'ASSISTANT';
}

/** One user/world Thread identity dossier. */
export interface ThreadIdentityDossier {
  readonly threadId: string;
  readonly identityEvidence: readonly ThreadIdentityEvidenceItem[];
}

/** One exact prior committed surface that grounds the CURRENT Session focus (its handle grounding). */
export interface CurrentFocusGroundingSurface {
  readonly cuId: string;
  readonly exactSurface: string;
  readonly committedCuText: string;
}

/**
 * The current Session focus grounding the provider may see: the stable focus
 * identity and its exact committed grounding surfaces. Nothing later, nothing
 * spatial, nothing analytical.
 */
export interface CurrentFocusGrounding {
  readonly emergingFocusId: string;
  readonly groundingSurfaces: readonly CurrentFocusGroundingSurface[];
}

/** One prior identity-evidence reference the provider cites for BIND_EXISTING: an existing dossier item of the bound Thread. */
export interface PriorIdentityEvidenceRef {
  readonly cuId: string;
  readonly exactSurface: string;
}

/** The one-CU continuity evaluation input. `dossiers` is the EXHAUSTIVE candidate set the evaluator will screen. */
export interface ThreadContinuityEvaluationInput {
  readonly sessionId: string;
  readonly currentCu: CurrentCuInput;
  /** The canonical B1 semantic bundle of exactly this CU (`unit_id === currentCu.cuId`). */
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  readonly currentFocusGrounding: CurrentFocusGrounding;
  /** Every canonical Thread dossier of the user that may be a candidate, in `threadId` textual order. */
  readonly dossiers: readonly ThreadIdentityDossier[];
}

/** Technical provenance carried forward to the durable capture. No wall-clock value, no SP. */
export interface ThreadContinuityProvenance {
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: number;
}

/**
 * The prepared, in-memory continuity result for ONE committed CU. Geography-
 * free and score-free: no Home, no confidence, no rank, no rationale.
 */
export interface PreparedThreadContinuityResult {
  readonly sessionId: string;
  readonly cuId: string;
  readonly emergingFocusId: string;
  readonly decision: ThreadContinuityDecision;
  /** Exactly one existing Thread for BIND_EXISTING; null otherwise. */
  readonly threadId: string | null;
  /** At least two existing Threads for AMBIGUOUS_EXISTING, in canonical textual order; empty otherwise. */
  readonly candidateThreadIds: readonly string[];
  /** BIND_EXISTING only: current-CU RESOLVED reference indexes whose handle grounds the focus. */
  readonly currentEvidenceReferenceIndexes: readonly number[];
  /** BIND_EXISTING only: existing dossier items of the bound Thread. */
  readonly priorEvidenceRefs: readonly PriorIdentityEvidenceRef[];
  /** Every Thread id that was screened, in the exact deterministic order: the exhaustiveness proof. */
  readonly screenedThreadIds: readonly string[];
  readonly provenance: ThreadContinuityProvenance;
}

/**
 * Every reason a continuity evaluation can fail. All FAIL-CLOSED: no prepared
 * result exists, and a failure is never reported as DISTINCT_NEW.
 */
export type ThreadContinuityRejectionReason =
  | 'INVALID_EVALUATION_INPUT'
  | 'FOCUS_SEMANTICS_MISMATCH'
  /** The current CU carries no stable independent focus: continuity is not a question for it. */
  | 'NO_INDEPENDENT_FOCUS'
  | 'INVALID_DOSSIER'
  | 'CONTINUITY_PROVIDER_UNAVAILABLE'
  | 'INVALID_PROVIDER_PAYLOAD'
  /** A nominated or resolved Thread id is not in the supplied set. */
  | 'UNKNOWN_CANDIDATE_THREAD'
  | 'DUPLICATE_CANDIDATE_THREAD'
  /** BIND_EXISTING without exactly one Thread, or DISTINCT_NEW / AMBIGUOUS with one. */
  | 'INVALID_DECISION_SHAPE'
  /** AMBIGUOUS_EXISTING with fewer than two candidates. */
  | 'INSUFFICIENT_AMBIGUITY_CANDIDATES'
  /** BIND_EXISTING without a current RESOLVED reference whose handle grounds the focus. */
  | 'CURRENT_EVIDENCE_REQUIRED'
  | 'CURRENT_EVIDENCE_NOT_GROUNDED'
  /** BIND_EXISTING without at least one prior dossier item of the bound Thread. */
  | 'PRIOR_EVIDENCE_REQUIRED'
  | 'PRIOR_EVIDENCE_NOT_IN_DOSSIER';

export class ThreadContinuityRejectedError extends Error {
  constructor(
    readonly reason: ThreadContinuityRejectionReason,
    /** The offending element, or -1 when the failure is not element-local. */
    readonly index: number = -1,
  ) {
    super(`Thread continuity evaluation was rejected: ${reason}.`);
    this.name = 'ThreadContinuityRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Locale-independent UTF-16 code-unit ordering, identical to `thread_id::text COLLATE "C"` over canonical UUIDs. */
export function compareThreadIdText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
