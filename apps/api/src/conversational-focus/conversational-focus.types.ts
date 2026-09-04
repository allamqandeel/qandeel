// T-03B1a - Reference / Attention Resolution Evaluator + Prepared Focus
// Semantics: the frozen domain types.
//
// This directory is the first slice of canonical Product task T-03B1. It is
// PRODUCTION-INERT: nothing here is a Nest provider, nothing here is imported
// by ConversationModule, ConversationService or the T-03A2 temporal runtime
// path, nothing writes to the database, and no durable identity (reference
// handle, emerging_focus_id, SP) is allocated. The evaluator produces a
// PREPARED result that T-03B1b will later validate and write atomically, one
// Moment at a time, inside the SP-native Session Semantic Clock transaction.
//
// The vocabularies below are FROZEN by Stage 1.2 (CU-04/05/06, CU-10..CU-16)
// and Stage 1.3 (THR-01..THR-04, THR-10..THR-12). They are consumed exactly as
// frozen: no larger taxonomy, no numeric score, no Thread or LF decision.

/**
 * CU-04/05/06 - the frozen minimum conversational-function vocabulary. One CU
 * may carry several functions without duplicating source; a classification
 * that cannot be defended is FUNCTION_UNRESOLVED, which stands alone.
 */
export const CONVERSATIONAL_FUNCTIONS = Object.freeze([
  'INFORM_REPORT',
  'ASK',
  'REQUEST',
  'ACKNOWLEDGE',
  'AGREE',
  'DISAGREE_CHALLENGE',
  'ELABORATE',
  'CLARIFY',
  'CORRECT',
  'RECALL',
  'FOCUS_SHIFT',
  'FUNCTION_UNRESOLVED',
] as const);
export type ConversationalFunction = (typeof CONVERSATIONAL_FUNCTIONS)[number];

/** CU-05 - the frozen minimal sequence position. */
export const SEQUENCE_POSITIONS = Object.freeze(['UNMARKED', 'INITIATING', 'RESPONSIVE', 'FOLLOW_UP'] as const);
export type SequencePosition = (typeof SEQUENCE_POSITIONS)[number];

/** CU-10 - three-state reference resolution. QANDEEL never guesses to complete the structure. */
export const REFERENCE_RESOLUTION_STATES = Object.freeze(['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED'] as const);
export type ReferenceResolutionState = (typeof REFERENCE_RESOLUTION_STATES)[number];

/** CU-13 - the claimant of an embedded claim is independent of the conversational speaker. */
export const CLAIMANT_KINDS = Object.freeze([
  'CURRENT_CONVERSATIONAL_SPEAKER',
  'REFERENCE_HANDLE',
  'NEW_CURRENT_CU_REFERENCE',
  'UNRESOLVED',
] as const);
export type ClaimantKind = (typeof CLAIMANT_KINDS)[number];

/** CU-14 - the attribution frame of a claim inside the current CU. */
export const CLAIM_FRAMES = Object.freeze(['DIRECT_ASSERTION', 'REPORTED_SPEECH', 'DIRECT_QUOTATION'] as const);
export type ClaimFrame = (typeof CLAIM_FRAMES)[number];

/** THR-01/02 - the only three attention outcomes the provider may choose. */
export const ATTENTION_KINDS = Object.freeze(['NO_INDEPENDENT_FOCUS', 'ATTEND_EXISTING_FOCUS', 'START_NEW_FOCUS'] as const);
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

export const ATTENTION_REASONS = Object.freeze([
  'INCIDENTAL_OR_SUBORDINATE',
  'DIRECT_SUBJECT',
  'EXPLICIT_FOCUS_SHIFT',
  'DIRECT_REQUEST_OR_QUESTION',
  'SUBSTANTIVE_ELABORATION',
  'LOCAL_CLARIFICATION_OR_CORRECTION',
  'UNRESOLVED_ATTENTION',
] as const);
export type AttentionReason = (typeof ATTENTION_REASONS)[number];

/**
 * The reasons each attention kind may carry. UNRESOLVED_ATTENTION is a
 * truthful "cannot be defended" from the provider and is therefore only ever
 * paired with NO_INDEPENDENT_FOCUS; it is NOT a technical failure, which never
 * collapses to an attention value at all.
 */
export const ATTENTION_REASONS_BY_KIND: Readonly<Record<AttentionKind, readonly AttentionReason[]>> = Object.freeze({
  NO_INDEPENDENT_FOCUS: Object.freeze<AttentionReason[]>([
    'INCIDENTAL_OR_SUBORDINATE',
    'LOCAL_CLARIFICATION_OR_CORRECTION',
    'UNRESOLVED_ATTENTION',
  ]),
  ATTEND_EXISTING_FOCUS: Object.freeze<AttentionReason[]>([
    'DIRECT_SUBJECT',
    'DIRECT_REQUEST_OR_QUESTION',
    'SUBSTANTIVE_ELABORATION',
    'LOCAL_CLARIFICATION_OR_CORRECTION',
    'EXPLICIT_FOCUS_SHIFT',
  ]),
  START_NEW_FOCUS: Object.freeze<AttentionReason[]>([
    'DIRECT_SUBJECT',
    'EXPLICIT_FOCUS_SHIFT',
    'DIRECT_REQUEST_OR_QUESTION',
    'SUBSTANTIVE_ELABORATION',
  ]),
});

/**
 * One provider-proposed extractive anchor into `currentCu.committedText`:
 * exact text plus the 1-based occurrence of that text in the source. The
 * provider never authors an offset; the deterministic mapper computes it.
 */
export interface ExtractiveAnchor {
  readonly text: string;
  readonly occurrence: number;
}

/** 0-based, half-open, Unicode code-point coordinates inside the current CU. */
export interface AnchorSpan {
  readonly start: number;
  readonly end: number;
}

/** A mapped anchor: the exact proposal plus its deterministic coordinates. */
export interface MappedAnchor {
  readonly anchor: ExtractiveAnchor;
  readonly span: AnchorSpan;
}

/** The one committed CU under evaluation. `sourceRole` is canonical and never model-authored. */
export interface CurrentCuInput {
  readonly cuId: string;
  readonly sourceTurnId: string;
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly committedText: string;
  readonly ordinalWithinTurn: number;
}

/**
 * One committed CU that is already legitimate BEFORE the current CU. The
 * prepared function/sequence/target fields are `null` when no prepared or
 * durable evaluation of that CU is available to this evaluation.
 */
export interface PriorCuContext {
  readonly cuId: string;
  readonly sourceTurnId: string;
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly committedText: string;
  readonly ordinalWithinTurn: number;
  readonly functions: readonly ConversationalFunction[] | null;
  readonly sequencePosition: SequencePosition | null;
  readonly targetCuId: string | null;
}

/** One exact prior-CU surface that grounds a reference handle. */
export interface ReferenceHandleGrounding {
  readonly cuId: string;
  readonly exactSurface: string;
}

/**
 * A candidate reference handle: an opaque, server-supplied identity plus the
 * exact prior committed grounding that lets the provider tell it apart from a
 * same-name handle (CU-11). The provider may only SELECT from these.
 */
export interface ReferenceHandleCandidate {
  readonly handleId: string;
  readonly grounding: readonly ReferenceHandleGrounding[];
}

/**
 * An already-legitimate Emerging Focus continuity option. Opaque, pre-Thread,
 * pre-geographic. No Thread id exists yet (T-03B2), so none is exposed.
 */
export interface FocusCandidate {
  readonly focusCandidateId: string;
  readonly groundingHandleIds: readonly string[];
  readonly priorGroundingCuIds: readonly string[];
}

/** Everything legitimately known BEFORE the current CU, and nothing later. */
export interface PriorContext {
  readonly priorCus: readonly PriorCuContext[];
  readonly referenceHandles: readonly ReferenceHandleCandidate[];
  readonly focusCandidates: readonly FocusCandidate[];
  readonly currentFocusCandidateId: string | null;
}

/** The one-CU, prior-context-only evaluator input (§6). */
export interface ConversationalFocusEvaluationInput {
  readonly sessionId: string;
  readonly currentCu: CurrentCuInput;
  readonly priorContext: PriorContext;
}

/** A material reference inside the current CU, after deterministic validation. */
export interface PreparedReferenceResolution extends MappedAnchor {
  readonly state: ReferenceResolutionState;
  /** Exactly one allowlisted handle, only when RESOLVED to prior grounding. */
  readonly resolvedHandleId: string | null;
  /** At least two distinct allowlisted handles, only when AMBIGUOUS. */
  readonly candidateHandleIds: readonly string[];
  /** RESOLVED to a NEW reference grounded in the current CU; no id is authored. */
  readonly newReference: boolean;
}

export interface PreparedClaimant {
  readonly kind: ClaimantKind;
  /** Allowlisted prior handle, only for REFERENCE_HANDLE. */
  readonly handleId: string | null;
  /** Index into `references` of a RESOLVED new reference, only for NEW_CURRENT_CU_REFERENCE. */
  readonly referenceIndex: number | null;
}

/** One embedded claim/report/quotation attribution inside the current CU. */
export interface PreparedClaimAttribution extends MappedAnchor {
  readonly claimant: PreparedClaimant;
  readonly frame: ClaimFrame;
}

export interface PreparedAttention {
  readonly kind: AttentionKind;
  /** Allowlisted focus candidate, only for ATTEND_EXISTING_FOCUS. */
  readonly existingFocusCandidateId: string | null;
  /** Extractive grounding in the current CU, required for START_NEW_FOCUS. */
  readonly grounding: MappedAnchor | null;
  readonly reason: AttentionReason;
}

/** Technical provenance carried forward for T-03B1b. No wall-clock value, no SP. */
export interface FocusEvaluationProvenance {
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly schemaVersion: number;
}

/**
 * The prepared, in-memory result for ONE committed CU. Not canonical, not
 * client-visible, not historically queryable. T-03B1b consumes it.
 */
export interface PreparedConversationalFocusResult {
  readonly sessionId: string;
  readonly cuId: string;
  readonly sourceTurnId: string;
  /** Copied from the input, never from the provider. */
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly functions: readonly ConversationalFunction[];
  readonly sequencePosition: SequencePosition;
  readonly targetCuId: string | null;
  readonly references: readonly PreparedReferenceResolution[];
  readonly claimAttributions: readonly PreparedClaimAttribution[];
  readonly attention: PreparedAttention;
  readonly provenance: FocusEvaluationProvenance;
}

/** Frozen bounds. The source bound mirrors the committed-CU source bound. */
export const MAX_FOCUS_SOURCE_CHARS = 20_000;
export const MAX_FOCUS_ANCHOR_CHARS = 4_000;
export const MAX_REFERENCES_PER_CU = 32;
export const MAX_CLAIM_ATTRIBUTIONS_PER_CU = 16;
export const MAX_FUNCTIONS_PER_CU = CONVERSATIONAL_FUNCTIONS.length;

/** Evaluator and policy identity recorded on every prepared result. */
export const FOCUS_EVALUATOR_VERSION = 'conversational-focus-evaluator-v1';
export const FOCUS_POLICY_VERSION = 'stage-1.2-1.3-reference-attention-v1';

/**
 * Every reason a one-CU evaluation can fail. All of them are FAIL-CLOSED: no
 * prepared result exists, and a failure is never reported as
 * NO_INDEPENDENT_FOCUS - a technical failure is not truthful absence.
 */
export type FocusEvaluationRejectionReason =
  | 'INVALID_EVALUATION_INPUT'
  | 'FUTURE_CONTEXT_FORBIDDEN'
  /** FIX-T03B1A-01: a handle or focus grounding CU is not in the supplied `priorCus`. */
  | 'PRIOR_GROUNDING_NOT_AVAILABLE'
  | 'FOCUS_PROVIDER_UNAVAILABLE'
  | 'INVALID_PROVIDER_PAYLOAD'
  | 'NON_EXTRACTIVE_REFERENCE'
  | 'OCCURRENCE_OUT_OF_RANGE'
  | 'UNKNOWN_REFERENCE_HANDLE'
  | 'INVALID_REFERENCE_CARDINALITY'
  | 'UNKNOWN_FOCUS_CANDIDATE'
  | 'UNKNOWN_TARGET_CU'
  | 'INVALID_CLAIM_ATTRIBUTION'
  | 'FOCUS_GROUNDING_REQUIRED'
  | 'UNGROUNDED_FOCUS_CONTINUITY'
  /** FIX-T03B1A-02: the RESOLVED grounding handle already grounds a supplied focus candidate. */
  | 'EXISTING_FOCUS_CONTINUITY_REQUIRED';

export class FocusEvaluationRejectedError extends Error {
  constructor(
    readonly reason: FocusEvaluationRejectionReason,
    /** The offending proposal element, or -1 when the failure is not element-local. */
    readonly index: number = -1,
  ) {
    super(`Conversational focus evaluation was rejected: ${reason}.`);
    this.name = 'FocusEvaluationRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
