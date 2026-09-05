// T-03B2b3 - the production-inert Thread Runtime Repository.
//
// The ONLY application seam over the two 0069 reads and the ONE existing 0068
// integrated coordinator. It runs through the explicit server-authority
// channel (`SupabaseServiceRoleApiService`), sends only identity, coordinates,
// canonical semantic payload, provenance and the expected clock token, and
// maps ONE exact database condition to a typed domain error:
//
//   SQLSTATE 40001 + message EXACTLY 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'
//   -> StaleConversationalFocusContextError
//
// That predicate is REUSED from the T-03B1b2 repository rather than restated,
// so exact equality (never containment, regex, case folding, trimming or
// normalization) stays a single fact in the codebase. Any other serialization
// failure, any other status, and any status-only transport error stay what
// they are.
//
// It introduces NO new mutation RPC: the only write is the existing
// `commit_finalized_exchange_with_focus_and_thread_v1`, and NO Home
// coordinate, base, attempt or fingerprint crosses this boundary in either
// direction - the database computes the permanent placement under its own
// per-user-world lock.
//
// NOT registered in Nest (AC-B2B3-01): every RPC it calls is executable by no
// application role in this task.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { isStaleConversationalFocusContext } from '../conversational-focus/conversation-focus-runtime.repository';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { mapConversationThreadRuntimeContext, mapIntegratedFocusThreadBatchSnapshot } from './conversation-thread-runtime-mapper';
import type {
  CommitFinalizedExchangeWithFocusAndThreadRequest,
  ConversationThreadRuntimeContext,
  FinalizedExchangeWithFocusAndThreadResult,
  IntegratedFocusThreadBatchSnapshot,
  ProposedThreadUnit,
} from './conversation-thread-runtime.types';

/** The narrow boundary the establishment service depends on; tests inject a fake. */
export interface ConversationThreadRuntimeBoundary {
  readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedFocusThreadBatchSnapshot>;
  readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationThreadRuntimeContext>;
  commitFinalizedExchangeWithFocusAndThread(request: CommitFinalizedExchangeWithFocusAndThreadRequest): Promise<FinalizedExchangeWithFocusAndThreadResult>;
}

function wireUnits(units: readonly ProposedThreadUnit[]) {
  return units.map((unit) => ({ unit_id: unit.unitId, span_start: unit.spanStart, span_end: unit.spanEnd }));
}

export class ConversationThreadRuntimeRepository implements ConversationThreadRuntimeBoundary {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedFocusThreadBatchSnapshot> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_focus_thread_integrated_batch_snapshot_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
      p_source_turn_id: request.sourceTurnId,
      p_batch_id: request.batchId,
    });
    return mapIntegratedFocusThreadBatchSnapshot(Array.isArray(rows) ? rows[0] : undefined);
  }

  async readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationThreadRuntimeContext> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_focus_thread_runtime_context_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
    });
    return mapConversationThreadRuntimeContext(Array.isArray(rows) ? rows[0] : undefined, request);
  }

  async commitFinalizedExchangeWithFocusAndThread(request: CommitFinalizedExchangeWithFocusAndThreadRequest): Promise<FinalizedExchangeWithFocusAndThreadResult> {
    try {
      const rows = await this.serviceApi.rpc<FinalizedExchangeWithFocusAndThreadResult[]>('commit_finalized_exchange_with_focus_and_thread_v1', {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_user_source_turn_id: request.userSourceTurnId,
        p_user_batch_id: request.userBatchId,
        p_user_units: wireUnits(request.userUnits),
        p_user_focus_units: request.userFocusUnits,
        p_user_thread_units: request.userThreadUnits,
        p_assistant_source_turn_id: request.assistantSourceTurnId,
        p_assistant_batch_id: request.assistantBatchId,
        p_assistant_units: wireUnits(request.assistantUnits),
        p_assistant_focus_units: request.assistantFocusUnits,
        p_assistant_thread_units: request.assistantThreadUnits,
        p_evaluator_version: request.evaluatorVersion,
        p_policy_version: request.policyVersion,
        p_segmentation_provider: request.segmentationProvider,
        p_segmentation_model: request.segmentationModel,
        p_segmentation_prompt_version: request.segmentationPromptVersion,
        p_focus_evaluator_version: request.focusEvaluatorVersion,
        p_focus_policy_version: request.focusPolicyVersion,
        p_focus_provider: request.focusProvider,
        p_focus_model: request.focusModel,
        p_focus_prompt_version: request.focusPromptVersion,
        p_focus_schema_version: request.focusSchemaVersion,
        p_thread_evaluator_version: request.threadEvaluatorVersion,
        p_thread_policy_version: request.threadPolicyVersion,
        p_thread_provider: request.threadProvider,
        p_thread_model: request.threadModel,
        p_thread_prompt_version: request.threadPromptVersion,
        p_thread_schema_version: request.threadSchemaVersion,
        p_expected_current_sp: request.expectedCurrentSp,
        p_expected_same_sp_event_sequence: request.expectedSameSpEventSequence,
      });
      return rows[0];
    } catch (error) {
      if (isStaleConversationalFocusContext(error)) throw new StaleConversationalFocusContextError();
      throw error;
    }
  }
}
