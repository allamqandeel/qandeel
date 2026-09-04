// T-03B2a - Thread Establishment Evaluator + Prepared Promotion Evidence: the
// frozen domain types.
//
// This directory is the first slice of canonical Product task T-03B2 (Thread
// Establishment). Architecture split the task before coding because it holds
// two independent architectural reasons: the Thread Establishment SEMANTIC
// JUDGMENT (this slice) and the durable Thread + permanent Home commitment
// (T-03B2b). This slice is PRODUCTION-INERT: no migration, no Thread row, no
// thread identity allocation, no Home Anchor / Canonical Spatial Address, no
// durable event, no Session Semantic Clock write, no service-role RPC, no
// ConversationService / ConversationModule wiring, no lifecycle write, no LF.
// It produces only a strict PREPARED semantic decision that T-03B2b will
// canonicalize and persist later, inside the same per-Moment SP transaction.
//
// T-03B1 is frozen authority and is consumed, never redone: reference
// resolution, claimant attribution, Emerging Focus identity and
// independent-attention classification arrive here as ONE canonical B1 semantic
// bundle per committed CU. The only Thread-establishment target is the stable
// `emerging_focus_id` that B1 attention (START_NEW_FOCUS / ATTEND_EXISTING_FOCUS)
// already carries.
//
// The vocabularies below are FROZEN by Stage 1.3 (THR-01..THR-24) and the Stage
// 6 promotion contract: exactly three evidence paths, two decisions, and a
// deliberately small engineering-only set of no-establishment reasons. There is
// no Thread score, no keyword threshold, no similarity, no timer, no rank.

import type {
  AttentionKind,
  AttentionReason,
  CurrentCuInput,
  MappedAnchor,
  PriorCuContext,
} from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';

/**
 * THR-07 - the ONLY frozen establishment paths. Promotion is always by an
 * evidence path, never by a score.
 *
 *   TE-01  Explicit user conversational selection
 *   TE-02  Sustained substantive engagement
 *   TE-03  Recurrent independent attention
 */
export const THREAD_ESTABLISHMENT_PATHS = Object.freeze(['TE-01', 'TE-02', 'TE-03'] as const);
export type ThreadEstablishmentPath = (typeof THREAD_ESTABLISHMENT_PATHS)[number];

/** The two decisions a provider may propose. Nothing in between, nothing graded. */
export const THREAD_ESTABLISHMENT_DECISIONS = Object.freeze(['NO_ESTABLISHMENT', 'ESTABLISH_THREAD'] as const);
export type ThreadEstablishmentDecision = (typeof THREAD_ESTABLISHMENT_DECISIONS)[number];

/**
 * Engineering-only reasons a prepared result is NO_ESTABLISHMENT. Not a Product
 * taxonomy: the first two are deterministic pre-provider outcomes, the third is
 * the provider's truthful "no frozen path is defensible yet".
 */
export const NO_ESTABLISHMENT_REASONS = Object.freeze(['NO_INDEPENDENT_FOCUS', 'ALREADY_ESTABLISHED', 'NO_PROMOTION_PATH_PROVEN'] as const);
export type NoEstablishmentReason = (typeof NO_ESTABLISHMENT_REASONS)[number];

/** The B1 attention kinds under which a CU carries a stable Emerging Focus identity (THR-02/THR-04). */
export const FOCUS_BEARING_ATTENTION_KINDS = Object.freeze(['START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS'] as const);
export type FocusBearingAttentionKind = (typeof FOCUS_BEARING_ATTENTION_KINDS)[number];

/**
 * CU-14 frames whose wording belongs to somebody ELSE's speech. An explicit
 * selection wholly inside one of them is that person's selection, not the
 * user's own conversational selection (THR-12), so it can never satisfy TE-01.
 */
export const ATTRIBUTED_CLAIM_FRAMES = Object.freeze(['REPORTED_SPEECH', 'DIRECT_QUOTATION'] as const);

/**
 * The shape of a STABLE Emerging Focus identity as canonicalized by T-03B1b1:
 * a lowercase RFC 4122 UUID (versions 1-5, RFC variant). A transient
 * `prepared:` identity is never a Thread-establishment target.
 */
export const STABLE_FOCUS_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/**
 * One prior CU's canonical B1 attention, append-preserved. No timestamp, no
 * score, no analytical-object count: attention kind, its frozen reason, and the
 * stable focus identity it attended or started (null for NO_INDEPENDENT_FOCUS).
 */
export interface FocusAttentionHistoryEntry {
  readonly cuId: string;
  readonly attentionKind: AttentionKind;
  readonly attentionReason: AttentionReason;
  readonly emergingFocusId: string | null;
}

/**
 * Everything legitimately known BEFORE the current CU, and nothing later.
 *
 *   priorCus              ordered committed prior CUs with their B1 function /
 *                         sequence context
 *   focusAttentionHistory one entry per prior CU whose B1 semantics exist; every
 *                         entry's CU must be in priorCus
 *   establishedFocusIds   stable Emerging Focus ids already promoted by prior
 *                         canonical Thread truth - membership only, no Thread id,
 *                         no Home
 */
export interface ThreadEstablishmentPriorContext {
  readonly priorCus: readonly PriorCuContext[];
  readonly focusAttentionHistory: readonly FocusAttentionHistoryEntry[];
  readonly establishedFocusIds: readonly string[];
}

/** The one-CU, prior-context-only evaluator input (task §6). */
export interface ThreadEstablishmentEvaluationInput {
  readonly sessionId: string;
  readonly currentCu: CurrentCuInput;
  /** The canonical B1 semantic bundle of exactly this CU (`unit_id === currentCu.cuId`). */
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  readonly priorContext: ThreadEstablishmentPriorContext;
}

/** Technical provenance carried forward for T-03B2b. No wall-clock value, no SP. */
export interface ThreadEstablishmentProvenance {
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: number;
}

/**
 * The prepared, in-memory result for ONE committed CU. Not canonical, not
 * client-visible, not historically queryable, and geography-free: no Thread
 * id, no Home, no SP, no LF. T-03B2b consumes it.
 */
export interface PreparedThreadEstablishmentResult {
  readonly sessionId: string;
  readonly cuId: string;
  readonly sourceTurnId: string;
  /** Copied from the committed CU, never from the provider. */
  readonly sourceRole: 'USER' | 'ASSISTANT';
  /** The stable B1 focus this decision is about; null only when B1 found no independent focus. */
  readonly emergingFocusId: string | null;
  readonly decision: ThreadEstablishmentDecision;
  readonly path: ThreadEstablishmentPath | null;
  readonly noEstablishmentReason: NoEstablishmentReason | null;
  /** The committed CUs the decision rests on: the current CU plus validated same-focus prior CUs. */
  readonly evidenceCuIds: readonly string[];
  /** TE-01 only: the exact current-CU wording of the user's selection, with code-point coordinates. */
  readonly explicitSelectionGrounding: MappedAnchor | null;
  readonly provenance: ThreadEstablishmentProvenance;
}

/** Evaluator and policy identity recorded on every prepared result. */
export const THREAD_ESTABLISHMENT_EVALUATOR_VERSION = 'thread-establishment-evaluator-v1';
export const THREAD_ESTABLISHMENT_POLICY_VERSION = 'stage-1.3-thread-establishment-v1';

/**
 * Every reason a one-CU evaluation can fail. All of them are FAIL-CLOSED: no
 * prepared result exists, and a failure is never reported as NO_ESTABLISHMENT -
 * a technical failure is not truthful non-establishment, and a malformed
 * context is not truthful history.
 */
export type ThreadEstablishmentRejectionReason =
  | 'INVALID_EVALUATION_INPUT'
  /** `currentFocusSemantics.unit_id` is not the current CU. */
  | 'FOCUS_SEMANTICS_MISMATCH'
  /** The current CU, or a later CU of its turn, appears as "prior" context. */
  | 'FUTURE_CONTEXT_FORBIDDEN'
  /** A focus-attention history CU is not in the supplied `priorCus`. */
  | 'PRIOR_EVIDENCE_NOT_AVAILABLE'
  /** History outside the frozen B1 attention vocabulary, or a non-stable focus identity. */
  | 'INVALID_ATTENTION_HISTORY'
  | 'THREAD_PROVIDER_UNAVAILABLE'
  | 'INVALID_PROVIDER_PAYLOAD'
  /** Decision / path / evidence / anchor shape inconsistent with the named path. */
  | 'INVALID_PROMOTION_PATH'
  /** ESTABLISH_THREAD proposed while B1 supplies no stable Emerging Focus identity (THR-04/THR-11). */
  | 'ESTABLISHMENT_WITHOUT_FOCUS'
  /** ESTABLISH_THREAD proposed for a focus already promoted (THR-14). */
  | 'FOCUS_ALREADY_ESTABLISHED'
  | 'CURRENT_CU_EVIDENCE_REQUIRED'
  /** An evidence CU that is neither the current CU nor a supplied prior CU (unknown or future). */
  | 'UNKNOWN_EVIDENCE_CU'
  | 'DUPLICATE_EVIDENCE_CU'
  /** A prior evidence CU whose B1 attention is not tied to the SAME target focus (THR-10/THR-11). */
  | 'EVIDENCE_NOT_FOCUS_BOUND'
  /** TE-02 / TE-03 evidence carried by QANDEEL CUs alone (THR-06/THR-13). */
  | 'USER_EVIDENCE_REQUIRED'
  /** TE-01 proposed for an ASSISTANT CU: QANDEEL cannot select on the user's behalf. */
  | 'EXPLICIT_SELECTION_ROLE_FORBIDDEN'
  | 'EXPLICIT_SELECTION_REQUIRED'
  | 'NON_EXTRACTIVE_SELECTION'
  | 'OCCURRENCE_OUT_OF_RANGE'
  /** The selection lies wholly inside reported speech or a direct quotation (THR-12). */
  | 'ATTRIBUTED_SELECTION_FORBIDDEN'
  /** TE-02 below the semantic minimum: fewer than two distinct committed CUs, or no prior CU. */
  | 'INSUFFICIENT_SUSTAINED_EVIDENCE'
  /** TE-03 without an earlier same-focus CU, intervening committed material, or an independent return. */
  | 'RECURRENCE_NOT_PROVEN';

export class ThreadEstablishmentRejectedError extends Error {
  constructor(
    readonly reason: ThreadEstablishmentRejectionReason,
    /** The offending evidence element, or -1 when the failure is not element-local. */
    readonly index: number = -1,
  ) {
    super(`Thread establishment evaluation was rejected: ${reason}.`);
    this.name = 'ThreadEstablishmentRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
