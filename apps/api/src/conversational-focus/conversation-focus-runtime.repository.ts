// T-03B1b2 - the production-inert Focus Runtime Repository.
//
// The ONLY application seam over the three future integrated RPCs of
// migrations 0066/0067. It runs through the explicit server-authority channel
// (`SupabaseServiceRoleApiService`), sends only identity, coordinates,
// canonical semantic payload, provenance and the expected clock token, and
// maps ONE exact database condition to a typed domain error:
//
//   SQLSTATE 40001 + message naming STALE_CONVERSATIONAL_FOCUS_CONTEXT
//   -> StaleConversationalFocusContextError
//
// Any other serialization failure, any other status, and any status-only
// transport error stay what they are. NOT registered in Nest (AC-B1B2-01):
// the RPCs it calls are executable by no application role in this task.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { mapConversationFocusRuntimeContext, mapIntegratedBatchSnapshot } from './conversation-focus-runtime-mapper';
import {
  StaleConversationalFocusContextError,
  type CommitFinalizedExchangeWithFocusRequest,
  type ConversationFocusRuntimeContext,
  type FinalizedExchangeWithFocusResult,
  type IntegratedBatchSnapshot,
  type ProposedFocusUnit,
} from './conversation-focus-runtime.types';

export const STALE_CONVERSATIONAL_FOCUS_CONTEXT_SQLSTATE = '40001';
export const STALE_CONVERSATIONAL_FOCUS_CONTEXT_TOKEN = 'STALE_CONVERSATIONAL_FOCUS_CONTEXT';

/** The narrow boundary the establishment service depends on; tests inject a fake. */
export interface ConversationFocusRuntimeBoundary {
  readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedBatchSnapshot>;
  readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationFocusRuntimeContext>;
  commitFinalizedExchangeWithFocus(request: CommitFinalizedExchangeWithFocusRequest): Promise<FinalizedExchangeWithFocusResult>;
}

function wireUnits(units: readonly ProposedFocusUnit[]) {
  return units.map((unit) => ({ unit_id: unit.unitId, span_start: unit.spanStart, span_end: unit.spanEnd }));
}

/** True only for the exact typed database condition, never for a generic 40001. */
export function isStaleConversationalFocusContext(error: unknown): boolean {
  if (!(error instanceof DataApiError)) return false;
  const { databaseCode, databaseMessage } = readDataApiUpstreamIdentity(error);
  return databaseCode === STALE_CONVERSATIONAL_FOCUS_CONTEXT_SQLSTATE
    && typeof databaseMessage === 'string'
    && databaseMessage.includes(STALE_CONVERSATIONAL_FOCUS_CONTEXT_TOKEN);
}

export class ConversationFocusRuntimeRepository implements ConversationFocusRuntimeBoundary {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedBatchSnapshot> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_integrated_batch_snapshot_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
      p_source_turn_id: request.sourceTurnId,
      p_batch_id: request.batchId,
    });
    return mapIntegratedBatchSnapshot(Array.isArray(rows) ? rows[0] : undefined);
  }

  async readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationFocusRuntimeContext> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_focus_runtime_context_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
    });
    return mapConversationFocusRuntimeContext(Array.isArray(rows) ? rows[0] : undefined, request);
  }

  async commitFinalizedExchangeWithFocus(request: CommitFinalizedExchangeWithFocusRequest): Promise<FinalizedExchangeWithFocusResult> {
    try {
      const rows = await this.serviceApi.rpc<FinalizedExchangeWithFocusResult[]>('commit_finalized_exchange_with_focus_v1', {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_user_source_turn_id: request.userSourceTurnId,
        p_user_batch_id: request.userBatchId,
        p_user_units: wireUnits(request.userUnits),
        p_user_focus_units: request.userFocusUnits,
        p_assistant_source_turn_id: request.assistantSourceTurnId,
        p_assistant_batch_id: request.assistantBatchId,
        p_assistant_units: wireUnits(request.assistantUnits),
        p_assistant_focus_units: request.assistantFocusUnits,
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
