// T-03B2b3 - Thread Runtime Orchestration + Integration Readiness: the runtime
// boundary types.
//
// PRODUCTION-INERT (AC-B2B3-01). Nothing here is a Nest provider, nothing is
// registered in ConversationModule, nothing is called by ConversationService,
// and the database functions these types describe are executable by NO
// application role. The live T-03A2 path stays exactly live until T-03D has
// extended the SAME per-Moment chain with effective LF and performed the final
// semantic-chain authority cutover.

import type { CommittedConversationUnit, CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import type { PriorContext } from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from '../conversational-focus/durable-focus-payload.types';
import type { CanonicalThreadBatchProvenance, CanonicalThreadEstablishmentPayload } from './durable-thread-payload.types';
import type { FocusAttentionHistoryEntry } from './thread-establishment.types';

/**
 * The ONE structural B2 capture vocabulary. It is READ from migration 0068's
 * `conversation_thread_batch_state_v1` through 0069 and never recomputed on
 * this side: PARTIAL can never become COMPLETE by application inference.
 */
export const THREAD_CAPTURE_STATES = Object.freeze(['ABSENT', 'COMPLETE', 'PARTIAL'] as const);
export type ThreadCaptureState = (typeof THREAD_CAPTURE_STATES)[number];

/**
 * The narrow integrated B1+B2 batch read model, exactly as
 * `get_conversation_focus_thread_integrated_batch_snapshot_v1` returns it. It
 * carries the T-03A2 commitment snapshot plus TECHNICAL B1 and B2 completeness
 * metadata, and nothing semantic: no reference, claim, focus, Thread, Home,
 * Origin, LF or K/V content.
 */
export interface IntegratedFocusThreadBatchSnapshot {
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
  /** The 0068 structural authority's verdict over all three capture layers. */
  readonly thread_capture_state: ThreadCaptureState;
  readonly thread_batch_exists: boolean;
  readonly thread_unit_count: number;
  readonly thread_establishment_count: number;
}

/** The optimistic semantic-clock token the evaluation was seeded against. */
export interface ThreadContextToken {
  /** `null` before the first SP: a technical absence, never PRE_FIRST_SP. */
  readonly currentSp: number | null;
  readonly sameSpEventSequence: number;
}

/**
 * One canonical Thread already established BEFORE the returned token, in this
 * Session. Membership and lineage only: no Home coordinate, no lifecycle, no
 * label, no cross-session sameness and no LF.
 */
export interface EstablishedThreadBinding {
  readonly threadId: string;
  readonly emergingFocusId: string;
  readonly establishedCuId: string;
  readonly establishedSp: number;
}

/**
 * The strictly mapped authoritative combined context: the T-03B1a input shape,
 * the canonical B1 semantic bundles and attention history the T-03B2a
 * evaluator needs, the already-canonical Thread bindings, and the token.
 */
export interface ConversationThreadRuntimeContext {
  readonly sessionId: string;
  readonly token: ThreadContextToken;
  readonly priorContext: PriorContext;
  /** One complete canonical B1 bundle per prior committed CU, ordered by SP. */
  readonly priorFocusSemantics: readonly CanonicalCuFocusSemanticPayload[];
  /** One append-preserved attention item per prior committed CU, ordered by SP. */
  readonly focusAttentionHistory: readonly FocusAttentionHistoryEntry[];
  readonly establishedThreadBindings: readonly EstablishedThreadBinding[];
}

/** One proposed committed CU of one half of the exchange, as the T-03A2 evaluator proposed it. */
export interface ProposedThreadUnit {
  readonly unitId: string;
  readonly spanStart: number;
  readonly spanEnd: number;
}

/** The exact payload of `commit_finalized_exchange_with_focus_and_thread_v1`. */
export interface CommitFinalizedExchangeWithFocusAndThreadRequest
  extends CanonicalFocusBatchProvenance, CanonicalThreadBatchProvenance {
  readonly sessionId: string;
  readonly userId: string;
  readonly userSourceTurnId: string;
  readonly userBatchId: string;
  readonly userUnits: readonly ProposedThreadUnit[];
  readonly userFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly userThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
  readonly assistantSourceTurnId: string;
  readonly assistantBatchId: string;
  readonly assistantUnits: readonly ProposedThreadUnit[];
  readonly assistantFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly assistantThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
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
export interface FinalizedExchangeWithFocusAndThreadResult {
  readonly live_head: number | null;
  readonly same_sp_event_sequence: number;
  readonly user_units: readonly CommittedConversationUnit[];
  readonly assistant_units: readonly CommittedConversationUnit[];
  readonly user_event: CommittedConversationUnitEventRow | null;
  readonly assistant_event: CommittedConversationUnitEventRow | null;
}

/**
 * Fail-closed integrity conditions of post-finalization Thread establishment.
 * None of them marks a completed turn FAILED or regenerates anything, and none
 * of them is ever reported as NO_ESTABLISHMENT: a technical failure is not a
 * truthful non-establishment.
 */
export type ConversationThreadIntegrityReason =
  | 'INVALID_FINALIZED_EXCHANGE_RELATION'
  | 'PARTIAL_INTEGRATED_EXCHANGE'
  | 'INCOMPLETE_THREAD_CAPTURE'
  | 'INVALID_INTEGRATED_SNAPSHOT'
  | 'INVALID_THREAD_RUNTIME_CONTEXT'
  | 'INCOMPLETE_PRIOR_THREAD_HISTORY'
  | 'INVALID_CONVERSATIONAL_ORIGIN_CONTEXT'
  | 'CONTEXT_GROUNDING_NOT_CLOSED'
  | 'FOCUS_SEMANTICS_MISMATCH'
  | 'PROVENANCE_DISAGREEMENT'
  | 'THREAD_PROVENANCE_DISAGREEMENT'
  | 'COMMITTED_WITHOUT_DELIVERY_EVENT'
  | 'DELIVERY_RANGE_MISMATCH'
  | 'LIVE_HEAD_NOT_ESTABLISHED'
  | 'SEGMENTATION_FRONTIER_MOVED';

export class ConversationThreadIntegrityError extends Error {
  constructor(readonly reason: ConversationThreadIntegrityReason) {
    super(`Thread establishment integrity failed: ${reason}.`);
    this.name = 'ConversationThreadIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A retryable post-finalization failure: provider outage, transport failure,
 * or the bounded stale-context retry exhausted. The durable USER/ASSISTANT
 * turns remain COMPLETED; the future wiring surfaces it as service
 * unavailability exactly as T-03A2 does. Integrity is never collapsed into
 * unavailability, and unavailability is never collapsed into integrity.
 */
export class ConversationThreadEstablishmentUnavailableError extends Error {
  constructor(
    readonly reason: 'PROVIDER_UNAVAILABLE' | 'TRANSPORT_UNAVAILABLE' | 'STALE_CONTEXT_RETRY_EXHAUSTED',
    options?: { cause?: unknown },
  ) {
    super(`Thread establishment is unavailable: ${reason}.`, options);
    this.name = 'ConversationThreadEstablishmentUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The bounded stale-context recovery: exactly one semantic re-evaluation per request. */
export const MAX_THREAD_STALE_CONTEXT_RETRIES = 1;
