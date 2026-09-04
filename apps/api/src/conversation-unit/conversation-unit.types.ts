// T-03A1 - Committed Conversational Unit substrate types, extended by T-03A2
// with the Session Position that is now born atomically with every committed CU.
//
// Stage 1.2 (INPUT-01) defines a Conversational Unit as the smallest contiguous
// span of committed conversational source material constituting one
// independently addressable conversational contribution. Stage 6 freezes
// `1 committed CU = 1 Moment` and `1 turn = 0..N committed CUs`.
//
// Nothing in this module is a Nest provider: no file in this directory carries
// a Nest decorator, and the T-03A2 wiring registers these plain classes through
// explicit factories in ConversationModule. There is still no temporary Product
// state anywhere - no SP_PENDING, no PRE_MOMENT, no COMMITTED_WITHOUT_SP - and
// after T-03A2 activation a committed CU without a Session Position is
// unrepresentable.

/** The canonical span coordinate system: 0-based, half-open, Unicode code points. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * One proposed committed CU: an application-generated identity plus canonical
 * source coordinates. The wording is deliberately absent - the database slices
 * committed text from the locked canonical source, so a caller has no channel
 * through which to forge it.
 */
export interface ProposedCommitUnit {
  readonly unitId: string;
  readonly spanStart: number;
  readonly spanEnd: number;
}

/** The commitment provenance carried by one batch. */
export interface CommitBatchProvenance {
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly segmentationProvider: string;
  readonly segmentationModel: string;
  readonly segmentationPromptVersion: string;
}

/** The exact payload the durable producer accepts. */
export interface CommitConversationUnitsRequest extends CommitBatchProvenance {
  readonly sessionId: string;
  readonly userId: string;
  readonly sourceTurnId: string;
  readonly batchId: string;
  readonly units: readonly ProposedCommitUnit[];
}

/**
 * A durable committed CU row, exactly as the database stores it.
 *
 * `session_position` is the canonical Session Position (SP) of this Moment. It
 * is allocated by the database inside the same transaction that inserts the
 * row, is immutable by the append-only trigger, and is never caller-supplied.
 */
export interface CommittedConversationUnit {
  readonly id: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly source_turn_id: string;
  readonly commit_batch_id: string;
  readonly source_role: 'USER' | 'ASSISTANT';
  readonly speaker_state: 'RESOLVED' | 'UNRESOLVED';
  readonly source_modality: 'TEXT';
  readonly ordinal_within_turn: number;
  readonly source_span_start: number;
  readonly source_span_end: number;
  readonly committed_text: string;
  readonly source_content_sha256: string;
  readonly session_position: number;
  readonly created_at: string;
}

/** A durable committed-CU delivery event row, exactly as the database stores it. */
export interface CommittedConversationUnitEventRow {
  readonly commit_batch_id: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly source_turn_id: string;
  readonly first_sp: number;
  readonly last_sp: number;
  readonly unit_count: number;
  readonly created_at: string;
}

/** The exact payload the atomic finalized-exchange coordinator accepts. */
export interface CommitFinalizedExchangeRequest extends CommitBatchProvenance {
  readonly sessionId: string;
  readonly userId: string;
  readonly userSourceTurnId: string;
  readonly userBatchId: string;
  readonly userUnits: readonly ProposedCommitUnit[];
  readonly assistantSourceTurnId: string;
  readonly assistantBatchId: string;
  readonly assistantUnits: readonly ProposedCommitUnit[];
}

/** The single row the atomic finalized-exchange coordinator returns. */
export interface FinalizedExchangeCommitResult {
  readonly live_head: number | null;
  readonly user_units: readonly CommittedConversationUnit[];
  readonly assistant_units: readonly CommittedConversationUnit[];
  readonly user_event: CommittedConversationUnitEventRow | null;
  readonly assistant_event: CommittedConversationUnitEventRow | null;
}

/**
 * The narrow service-role snapshot of one automatic commitment batch plus the
 * committed source frontier of its turn and the Session's derived Live Head.
 *
 * `source_frontier` is source-span ordering data: it is NOT SP and NOT LH.
 * `live_head` is `null`, never `0`, when no committed CU exists yet.
 */
export interface CommitBatchSnapshot {
  readonly batch_exists: boolean;
  readonly committed_unit_count: number;
  readonly units: readonly CommittedConversationUnit[];
  readonly event: CommittedConversationUnitEventRow | null;
  readonly source_frontier: number;
  readonly live_head: number | null;
}

/** The canonical source material a commitment evaluation runs over. */
export interface CommitmentSource {
  readonly sessionId: string;
  readonly userId: string;
  readonly turnId: string;
  /** Server-forced conversational speaker. SYSTEM is not committable in v1. */
  readonly role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  readonly status: string;
  readonly channel: string;
  /** Committed surface wording exactly as stored. Never normalized. */
  readonly content: string;
  /**
   * The committed source frontier of this turn: the end of the last committed
   * CU, or 0. It bounds NEW batches only - an existing-batch replay is
   * historical identity verification and is never re-checked against it.
   */
  readonly sourceFrontier: number;
}

/** The frozen v1 batch and excerpt bounds, mirrored by the database producer. */
export const MAX_UNITS_PER_COMMIT_BATCH = 64;
export const MAX_SOURCE_EXCERPT_CHARS = 4_000;
export const MAX_COMMITTABLE_SOURCE_CHARS = 20_000;

/**
 * The commitment policy and evaluator identity recorded on every batch. They
 * change only when the commit decision itself changes, so a retry of the same
 * prepared batch always carries identical provenance.
 */
export const CU_COMMITMENT_POLICY_VERSION = 'stage-1.2-cu-commitment-v1';
export const CU_BOUNDARY_EVALUATOR_VERSION = 'cu-anchor-mapper-v1';

/**
 * Every reason a commitment evaluation can fail. All of them are fail-closed:
 * no batch is committed, and the whole turn is never collapsed to one CU.
 */
export type CommitmentRejectionReason =
  | 'SOURCE_TURN_NOT_COMMITTABLE'
  | 'UNSUPPORTED_SOURCE_ROLE'
  | 'UNSUPPORTED_SOURCE_MODALITY'
  | 'SEGMENTATION_UNAVAILABLE'
  | 'NON_EXTRACTIVE_ANCHOR'
  | 'AMBIGUOUS_ANCHOR'
  | 'OCCURRENCE_OUT_OF_RANGE'
  | 'ANCHOR_BEFORE_CURSOR'
  | 'INVALID_ANCHOR_PAYLOAD'
  | 'INVALID_UNIT_PAYLOAD'
  | 'DUPLICATE_UNIT_ID'
  | 'SPAN_OUT_OF_RANGE'
  | 'SPAN_NOT_FORWARD_ORDERED'
  | 'SPAN_BEFORE_SOURCE_FRONTIER';

export class CommitmentRejectedError extends Error {
  constructor(
    readonly reason: CommitmentRejectionReason,
    readonly unitIndex: number = -1,
  ) {
    super(`Conversational unit commitment was rejected: ${reason}.`);
    this.name = 'CommitmentRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * T-03A2 temporal-establishment integrity failures. Every one of them is
 * fail-closed: the durable committed source is never repaired by guessing, and
 * an already-committed batch is never overwritten or re-segmented.
 */
export type ConversationTemporalIntegrityReason =
  /** Exactly one half of an atomic USER/ASSISTANT automatic pair exists. */
  | 'PARTIAL_AUTOMATIC_EXCHANGE_COMMITMENT'
  /** A non-zero committed batch carries no durable delivery event. */
  | 'COMMITTED_WITHOUT_DELIVERY_EVENT'
  /** A delivery event disagrees with its own stored Session Position range. */
  | 'DELIVERY_RANGE_MISMATCH'
  /** The two halves of one exchange carry different commitment provenance. */
  | 'PROVENANCE_DISAGREEMENT'
  /** Committed CUs exist for this exchange but the Session carries no Live Head. */
  | 'LIVE_HEAD_NOT_ESTABLISHED';

export class ConversationTemporalIntegrityError extends Error {
  constructor(readonly reason: ConversationTemporalIntegrityReason) {
    super(`Conversation temporal establishment integrity failed: ${reason}.`);
    this.name = 'ConversationTemporalIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
