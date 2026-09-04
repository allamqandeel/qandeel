// T-03B1b2 - Focus Runtime Orchestration + Activation Readiness: the runtime
// boundary types.
//
// PRODUCTION-INERT (AC-B1B2-01). Nothing here is a Nest provider, nothing is
// registered in ConversationModule, nothing is called by ConversationService,
// and the database functions these types describe are executable by NO
// application role. The live T-03A2 path stays exactly live until T-03B2
// (Thread) and T-03D (LF) have extended the SAME per-Moment chain and T-03D
// performs the final authority cutover.

import type { CommittedConversationUnit, CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import type { PriorContext } from './conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from './durable-focus-payload.types';

/**
 * The narrow integrated-batch read model, exactly as
 * `get_conversation_integrated_batch_snapshot_v1` returns it. It carries the
 * T-03A2 commitment snapshot plus TECHNICAL B1 completeness metadata, and
 * nothing semantic: no reference, claim, focus, Thread, LF or K/V content.
 */
export interface IntegratedBatchSnapshot {
  readonly batch_exists: boolean;
  readonly committed_unit_count: number;
  readonly units: readonly CommittedConversationUnit[];
  readonly commit_event: CommittedConversationUnitEventRow | null;
  /** Source-span ordering data of the turn: NOT SP and NOT LH. */
  readonly source_frontier: number;
  readonly live_head: number | null;
  readonly focus_batch_exists: boolean;
  readonly focus_semantic_count: number;
  readonly focus_attention_count: number;
  /** True only when the B1 semantic batch is structurally complete for every committed CU. */
  readonly focus_complete: boolean;
}

/** The optimistic semantic-clock token the evaluation was seeded against. */
export interface FocusContextToken {
  /** `null` before the first SP: a technical absence, never PRE_FIRST_SP. */
  readonly currentSp: number | null;
  readonly sameSpEventSequence: number;
}

/** The strictly mapped authoritative B1 context: the T-03B1a input shape plus the token. */
export interface ConversationFocusRuntimeContext {
  readonly sessionId: string;
  readonly token: FocusContextToken;
  readonly priorContext: PriorContext;
}

/** One proposed committed CU of one half of the exchange, as the T-03A2 evaluator proposed it. */
export interface ProposedFocusUnit {
  readonly unitId: string;
  readonly spanStart: number;
  readonly spanEnd: number;
}

/** The exact payload of `commit_finalized_exchange_with_focus_v1`. */
export interface CommitFinalizedExchangeWithFocusRequest extends CanonicalFocusBatchProvenance {
  readonly sessionId: string;
  readonly userId: string;
  readonly userSourceTurnId: string;
  readonly userBatchId: string;
  readonly userUnits: readonly ProposedFocusUnit[];
  readonly userFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly assistantSourceTurnId: string;
  readonly assistantBatchId: string;
  readonly assistantUnits: readonly ProposedFocusUnit[];
  readonly assistantFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly segmentationProvider: string;
  readonly segmentationModel: string;
  readonly segmentationPromptVersion: string;
  /** The token read with the context; the database compares it under the clock lock. */
  readonly expectedCurrentSp: number | null;
  readonly expectedSameSpEventSequence: number;
}

/** The single row the integrated coordinator returns. */
export interface FinalizedExchangeWithFocusResult {
  readonly live_head: number | null;
  readonly same_sp_event_sequence: number;
  readonly user_units: readonly CommittedConversationUnit[];
  readonly assistant_units: readonly CommittedConversationUnit[];
  readonly user_event: CommittedConversationUnitEventRow | null;
  readonly assistant_event: CommittedConversationUnitEventRow | null;
}

/**
 * The ONE exact database concurrency condition the runtime handles: the
 * Session Semantic Clock moved after the prior context was read. Raised by
 * the repository only when SQLSTATE 40001 carries the exact technical token.
 */
export class StaleConversationalFocusContextError extends Error {
  constructor() {
    super('The conversational focus context is stale: the Session Semantic Clock moved after it was read.');
    this.name = 'StaleConversationalFocusContextError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Fail-closed integrity conditions of post-finalization focus establishment.
 * None of them marks a completed turn FAILED or regenerates anything.
 */
export type ConversationFocusIntegrityReason =
  | 'INVALID_FINALIZED_EXCHANGE_RELATION'
  | 'PARTIAL_INTEGRATED_EXCHANGE'
  | 'INCOMPLETE_FOCUS_SEMANTICS'
  | 'INVALID_INTEGRATED_SNAPSHOT'
  | 'INVALID_RUNTIME_CONTEXT'
  | 'CONTEXT_GROUNDING_NOT_CLOSED'
  | 'COMMITTED_WITHOUT_DELIVERY_EVENT'
  | 'DELIVERY_RANGE_MISMATCH'
  | 'LIVE_HEAD_NOT_ESTABLISHED'
  | 'PROVENANCE_DISAGREEMENT'
  | 'SEGMENTATION_FRONTIER_MOVED';

export class ConversationFocusIntegrityError extends Error {
  constructor(readonly reason: ConversationFocusIntegrityReason) {
    super(`Conversational focus establishment integrity failed: ${reason}.`);
    this.name = 'ConversationFocusIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A retryable post-finalization failure: provider outage, transport failure,
 * or the bounded stale-context retry exhausted. The durable USER/ASSISTANT
 * turns remain COMPLETED; the future wiring surfaces it as service
 * unavailability exactly as T-03A2 does.
 */
export class ConversationFocusEstablishmentUnavailableError extends Error {
  constructor(
    readonly reason: 'PROVIDER_UNAVAILABLE' | 'TRANSPORT_UNAVAILABLE' | 'STALE_CONTEXT_RETRY_EXHAUSTED',
    options?: { cause?: unknown },
  ) {
    super(`Conversational focus establishment is unavailable: ${reason}.`, options);
    this.name = 'ConversationFocusEstablishmentUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The bounded stale-context recovery: exactly one focus re-evaluation per request. */
export const MAX_STALE_CONTEXT_RETRIES = 1;
