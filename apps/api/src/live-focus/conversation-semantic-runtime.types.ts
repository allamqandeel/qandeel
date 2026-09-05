// T-03D - the FINAL semantic-chain runtime boundary types.
//
// These describe exactly what crosses the ONE application mutation authority
// after the cutover: the 0071 integrated snapshot (commitment, B1, B2, B3 and
// LF), the 0071 runtime context (the 0070 context plus the current effective
// LF), the 0071 coordinator request / result, and the fail-closed error
// vocabulary. No Home coordinate, LF label, Thread name, committed text or
// analytical content is representable on the way out; no SP, same-SP
// sequence or LF `from` value is representable on the way in.

import type { CommitFinalizedExchangeWithThreadLifecycleRequest, ConversationThreadLifecycleRuntimeContext, FinalizedExchangeWithThreadLifecycleResult, IntegratedThreadLifecycleBatchSnapshot } from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import type { ThreadCaptureState } from '../thread-establishment/conversation-thread-runtime.types';
import type { CanonicalLiveFocusBatchProvenance, CanonicalLiveFocusPayload } from './durable-live-focus-payload.types';
import type { EffectiveLiveFocus } from './live-focus.types';

/** One durable LF transition as the database delivers it: the SP and the target reference identity only. */
export interface StoredLiveFocusTransition {
  readonly sessionPosition: number;
  readonly to: EffectiveLiveFocus;
}

/**
 * The narrow integrated batch read model, exactly as
 * `get_conversation_full_semantic_integrated_batch_snapshot_v1` returns it:
 * the T-03B3 snapshot plus the full-chain completeness authority, the
 * technical LF capture counters, this batch's LF transitions and the
 * Session's current LF. Nothing semantic beyond LF reference identity.
 */
export interface IntegratedFullSemanticBatchSnapshot extends IntegratedThreadLifecycleBatchSnapshot {
  /** The 0071 full-chain completeness authority's verdict over all five capture layers. */
  readonly full_semantic_capture_state: ThreadCaptureState;
  readonly live_focus_batch_exists: boolean;
  readonly live_focus_unit_count: number;
  readonly live_focus_transition_count: number;
  /** This batch's LF transitions in SP order (empty when absent or unchanged). */
  readonly live_focus_transitions: readonly StoredLiveFocusTransition[];
  /** The Session's current effective LF and the SP at which it became effective (null for NONE with no transition). */
  readonly session_live_focus: EffectiveLiveFocus;
  readonly session_live_focus_sp: number | null;
}

/** The strictly mapped FINAL runtime context: the T-03B3 context plus the current effective LF. */
export interface ConversationSemanticRuntimeContext extends ConversationThreadLifecycleRuntimeContext {
  readonly currentLiveFocus: EffectiveLiveFocus;
  readonly currentLiveFocusSp: number | null;
}

/** The exact payload of `commit_finalized_exchange_with_full_semantic_chain_v1`. */
export interface CommitFinalizedExchangeWithFullSemanticChainRequest
  extends CommitFinalizedExchangeWithThreadLifecycleRequest, CanonicalLiveFocusBatchProvenance {
  readonly userLiveFocusUnits: readonly CanonicalLiveFocusPayload[];
  readonly assistantLiveFocusUnits: readonly CanonicalLiveFocusPayload[];
}

/** The single row the FINAL coordinator returns. */
export interface FinalizedExchangeWithFullSemanticChainResult extends FinalizedExchangeWithThreadLifecycleResult {
  readonly live_focus: EffectiveLiveFocus;
  readonly live_focus_sp: number | null;
  /** The LF transitions created or replayed for BOTH halves, in SP order. */
  readonly live_focus_transitions: readonly StoredLiveFocusTransition[];
}

/**
 * Fail-closed integrity conditions of the FINAL post-finalization chain. None
 * of them marks a completed turn FAILED or regenerates anything, and none of
 * them is ever reported as NONE, NO_THREAD_ACTION or DISTINCT_NEW.
 */
export type ConversationSemanticIntegrityReason =
  | 'INVALID_FINALIZED_EXCHANGE_RELATION'
  | 'PARTIAL_INTEGRATED_EXCHANGE'
  | 'INCOMPLETE_FULL_SEMANTIC_CAPTURE'
  | 'INVALID_INTEGRATED_SNAPSHOT'
  | 'INVALID_SEMANTIC_RUNTIME_CONTEXT'
  | 'LIVE_FOCUS_CONTEXT_NOT_CLOSED'
  | 'LIVE_FOCUS_NOT_CANONICAL'
  | 'LIVE_FOCUS_DELIVERY_MISMATCH'
  | 'FOCUS_SEMANTICS_MISMATCH'
  | 'PROVENANCE_DISAGREEMENT'
  | 'COMMITTED_WITHOUT_DELIVERY_EVENT'
  | 'DELIVERY_RANGE_MISMATCH'
  | 'LIVE_HEAD_NOT_ESTABLISHED'
  | 'SEGMENTATION_FRONTIER_MOVED';

export class ConversationSemanticIntegrityError extends Error {
  constructor(readonly reason: ConversationSemanticIntegrityReason) {
    super(`Conversation semantic establishment integrity failed: ${reason}.`);
    this.name = 'ConversationSemanticIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A retryable post-finalization failure: provider outage, transport failure,
 * or the ONE shared stale-context retry exhausted. The durable USER /
 * ASSISTANT turns remain COMPLETED. Integrity is never collapsed into
 * unavailability, and unavailability is never collapsed into integrity.
 */
export class ConversationSemanticUnavailableError extends Error {
  constructor(
    readonly reason: 'PROVIDER_UNAVAILABLE' | 'TRANSPORT_UNAVAILABLE' | 'STALE_CONTEXT_RETRY_EXHAUSTED',
    options?: { cause?: unknown },
  ) {
    super(`Conversation semantic establishment is unavailable: ${reason}.`, options);
    this.name = 'ConversationSemanticUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The bounded stale-context recovery: exactly ONE semantic re-evaluation per request, shared by BOTH authorities. LF adds none. */
export const MAX_SEMANTIC_STALE_CONTEXT_RETRIES = 1;
