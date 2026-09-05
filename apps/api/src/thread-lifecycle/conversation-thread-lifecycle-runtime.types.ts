// T-03B3 - Thread Lifecycle + Cross-Session Continuity: the runtime boundary
// types.
//
// PRODUCTION-INERT. Nothing here is a Nest provider, nothing is registered in
// ConversationModule, nothing is called by ConversationService, and the
// database functions these types describe (migration 0070) are executable by
// NO application role. The live T-03A2 path stays exactly live until T-03D has
// extended the SAME per-Moment chain with effective LF and performed the final
// semantic-chain authority cutover.

import type { CommittedConversationUnit, CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from '../conversational-focus/durable-focus-payload.types';
import type { CanonicalThreadBatchProvenance, CanonicalThreadEstablishmentPayload } from '../thread-establishment/durable-thread-payload.types';
import type { ConversationThreadRuntimeContext, IntegratedFocusThreadBatchSnapshot, ThreadCaptureState } from '../thread-establishment/conversation-thread-runtime.types';
import type { CanonicalThreadLifecycleBatchProvenance, CanonicalThreadLifecyclePayload } from './durable-thread-lifecycle-payload.types';
import type { ThreadIdentityDossier } from './thread-continuity.types';
import type { SessionThreadFocusBinding, SessionThreadLifecycleEvent } from './thread-lifecycle.types';

/**
 * The narrow integrated batch read model, exactly as
 * `get_conversation_thread_lifecycle_integrated_batch_snapshot_v1` returns
 * it: the T-03B2b3 snapshot (commitment + B1 + B2) plus the FINAL Thread-layer
 * capture state and its technical counters. Nothing semantic: no binding, no
 * lifecycle, no evidence, no Home.
 */
export interface IntegratedThreadLifecycleBatchSnapshot extends IntegratedFocusThreadBatchSnapshot {
  /** The 0070 B3 completeness authority's verdict over all four capture layers. */
  readonly thread_semantic_capture_state: ThreadCaptureState;
  readonly thread_semantic_batch_exists: boolean;
  readonly thread_semantic_unit_count: number;
  readonly continuity_binding_count: number;
  readonly lifecycle_transition_count: number;
}

/**
 * The strictly mapped B3 runtime context: the T-03B2b3 combined context (token,
 * B1 prior context, canonical B1 bundles, attention history, this Session's
 * establishment bindings) plus the user/world identity version, every Session
 * focus -> Thread binding and the Session-local lifecycle history.
 */
export interface ConversationThreadLifecycleRuntimeContext extends ConversationThreadRuntimeContext {
  /** The technical optimistic version of the user's Thread identity dossiers (never Product time). */
  readonly worldThreadIdentityVersion: number;
  /** Every focus -> Thread binding of this Session, in bound-SP order. */
  readonly sessionFocusThreadBindings: readonly SessionThreadFocusBinding[];
  /** Every lifecycle transition of this Session, in (SP, transition ordinal) order. */
  readonly sessionThreadLifecycleHistory: readonly SessionThreadLifecycleEvent[];
}

/** One proposed committed CU of one half of the exchange, as the T-03A2 evaluator proposed it. */
export interface ProposedLifecycleUnit {
  readonly unitId: string;
  readonly spanStart: number;
  readonly spanEnd: number;
}

/** The exact payload of `commit_finalized_exchange_with_focus_thread_lifecycle_v1`. */
export interface CommitFinalizedExchangeWithThreadLifecycleRequest
  extends CanonicalFocusBatchProvenance, CanonicalThreadBatchProvenance, CanonicalThreadLifecycleBatchProvenance {
  readonly sessionId: string;
  readonly userId: string;
  readonly userSourceTurnId: string;
  readonly userBatchId: string;
  readonly userUnits: readonly ProposedLifecycleUnit[];
  readonly userFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly userThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
  readonly userLifecycleUnits: readonly CanonicalThreadLifecyclePayload[];
  readonly assistantSourceTurnId: string;
  readonly assistantBatchId: string;
  readonly assistantUnits: readonly ProposedLifecycleUnit[];
  readonly assistantFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly assistantThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
  readonly assistantLifecycleUnits: readonly CanonicalThreadLifecyclePayload[];
  readonly evaluatorVersion: string;
  readonly policyVersion: string;
  readonly segmentationProvider: string;
  readonly segmentationModel: string;
  readonly segmentationPromptVersion: string;
  /** The Session-clock token read with the context; the database compares it under the clock lock. */
  readonly expectedCurrentSp: number | null;
  readonly expectedSameSpEventSequence: number;
  /** The user/world identity version the dossiers were screened against; compared under the identity lock. */
  readonly expectedWorldThreadIdentityVersion: number;
}

/** The single row the B3 coordinator returns. */
export interface FinalizedExchangeWithThreadLifecycleResult {
  readonly live_head: number | null;
  readonly same_sp_event_sequence: number;
  readonly world_thread_identity_version: number;
  readonly user_units: readonly CommittedConversationUnit[];
  readonly assistant_units: readonly CommittedConversationUnit[];
  readonly user_event: CommittedConversationUnitEventRow | null;
  readonly assistant_event: CommittedConversationUnitEventRow | null;
}

/** One exhaustive dossier page request: exact version, deterministic cursor, fixed size. */
export interface ThreadIdentityDossierPageRequest {
  readonly userId: string;
  readonly expectedWorldThreadIdentityVersion: number;
  readonly afterThreadId: string | null;
  readonly limit: number;
}

export type ThreadIdentityDossierPage = readonly ThreadIdentityDossier[];

/**
 * Fail-closed integrity conditions of the post-finalization Thread layer.
 * None of them marks a completed turn FAILED or regenerates anything, and none
 * of them is ever reported as NO_THREAD_ACTION or DISTINCT_NEW.
 */
export type ConversationThreadLifecycleIntegrityReason =
  | 'INVALID_FINALIZED_EXCHANGE_RELATION'
  | 'PARTIAL_INTEGRATED_EXCHANGE'
  | 'INCOMPLETE_THREAD_LIFECYCLE_CAPTURE'
  | 'INVALID_INTEGRATED_SNAPSHOT'
  | 'INVALID_THREAD_LIFECYCLE_CONTEXT'
  | 'INCOMPLETE_PRIOR_THREAD_HISTORY'
  | 'LIFECYCLE_CONTEXT_NOT_CLOSED'
  | 'INVALID_LIFECYCLE_CHAIN'
  | 'INVALID_THREAD_IDENTITY_DOSSIER'
  | 'FOCUS_SEMANTICS_MISMATCH'
  | 'PROVENANCE_DISAGREEMENT'
  | 'THREAD_PROVENANCE_DISAGREEMENT'
  | 'CONTINUITY_PROVENANCE_DISAGREEMENT'
  | 'COMMITTED_WITHOUT_DELIVERY_EVENT'
  | 'DELIVERY_RANGE_MISMATCH'
  | 'LIVE_HEAD_NOT_ESTABLISHED'
  | 'SEGMENTATION_FRONTIER_MOVED';

export class ConversationThreadLifecycleIntegrityError extends Error {
  constructor(readonly reason: ConversationThreadLifecycleIntegrityReason) {
    super(`Thread lifecycle integrity failed: ${reason}.`);
    this.name = 'ConversationThreadLifecycleIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A retryable post-finalization failure: provider outage, transport failure,
 * or the bounded stale-context retry exhausted. The durable USER/ASSISTANT
 * turns remain COMPLETED. Integrity is never collapsed into unavailability,
 * and unavailability is never collapsed into integrity.
 */
export class ConversationThreadLifecycleUnavailableError extends Error {
  constructor(
    readonly reason: 'PROVIDER_UNAVAILABLE' | 'TRANSPORT_UNAVAILABLE' | 'STALE_CONTEXT_RETRY_EXHAUSTED',
    options?: { cause?: unknown },
  ) {
    super(`Thread lifecycle establishment is unavailable: ${reason}.`, options);
    this.name = 'ConversationThreadLifecycleUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The SECOND optimistic authority: the user/world Thread identity version
 * moved between the dossier screening and the commit (SQLSTATE 40001 with the
 * message EXACTLY `STALE_THREAD_IDENTITY_CONTEXT`). It shares the ONE bounded
 * retry with the Session-clock stale condition.
 */
export class StaleThreadIdentityContextError extends Error {
  constructor() {
    super('STALE_THREAD_IDENTITY_CONTEXT');
    this.name = 'StaleThreadIdentityContextError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The bounded stale-context recovery: exactly one semantic re-evaluation per request, shared by BOTH authorities. */
export const MAX_THREAD_LIFECYCLE_STALE_CONTEXT_RETRIES = 1;
