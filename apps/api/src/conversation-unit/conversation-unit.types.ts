// T-03A1 - Committed Conversational Unit substrate types.
//
// Stage 1.2 (INPUT-01) defines a Conversational Unit as the smallest contiguous
// span of committed conversational source material constituting one
// independently addressable conversational contribution. Stage 6 freezes
// `1 committed CU = 1 Moment` and `1 turn = 0..N committed CUs`.
//
// Nothing in this module is a Nest provider. The directory contains no module
// file and registers nothing in AppModule, so the T-03A1 producer stays
// production-inert until T-03A2 attaches the temporal establishment boundary.
// No SP, LH, Moment addressability or temporary Product state appears here.

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

/** A durable committed CU row, exactly as the database stores it. */
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
  readonly created_at: string;
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
