// T-03D - the FINAL Semantic Runtime Repository: the ONE application seam
// over the 0071 reads (integrated snapshot, runtime context), the 0070
// exhaustive dossier paging and the ONE 0071 coordinator.
//
// It runs through the explicit server-authority channel, sends only
// identity, coordinates, canonical semantic payloads, provenance and the two
// expected optimistic tokens, and maps exactly TWO database conditions to
// typed domain errors:
//
//   SQLSTATE 40001 + message EXACTLY 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'
//   -> StaleConversationalFocusContextError   (predicate REUSED from T-03B1b2)
//   SQLSTATE 40001 + message EXACTLY 'STALE_THREAD_IDENTITY_CONTEXT'
//   -> StaleThreadIdentityContextError        (predicate REUSED from T-03B3)
//
// LF introduces NO third stale authority and no new mutation RPC beyond the
// final coordinator. Any other serialization failure, any other status and
// any status-only transport error stay what they are. No Home coordinate,
// LF label, SP or same-SP sequence crosses this boundary as authority.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { isStaleConversationalFocusContext } from '../conversational-focus/conversation-focus-runtime.repository';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { isStaleThreadIdentityContext } from '../thread-lifecycle/conversation-thread-lifecycle-runtime.repository';
import { mapThreadIdentityDossierPage } from '../thread-lifecycle/conversation-thread-lifecycle-runtime-mapper';
import {
  StaleThreadIdentityContextError,
  type ProposedLifecycleUnit,
  type ThreadIdentityDossierPage,
  type ThreadIdentityDossierPageRequest,
} from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import {
  mapConversationSemanticRuntimeContext,
  mapFinalizedExchangeWithFullSemanticChainResult,
  mapIntegratedFullSemanticBatchSnapshot,
} from './conversation-semantic-runtime-mapper';
import type {
  CommitFinalizedExchangeWithFullSemanticChainRequest,
  ConversationSemanticRuntimeContext,
  FinalizedExchangeWithFullSemanticChainResult,
  IntegratedFullSemanticBatchSnapshot,
} from './conversation-semantic-runtime.types';

/** The narrow boundary the FINAL establishment service depends on; tests inject a fake. */
export interface ConversationSemanticRuntimeBoundary {
  readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedFullSemanticBatchSnapshot>;
  readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationSemanticRuntimeContext>;
  readIdentityDossierPage(request: ThreadIdentityDossierPageRequest): Promise<ThreadIdentityDossierPage>;
  commitFinalizedExchangeWithFullSemanticChain(request: CommitFinalizedExchangeWithFullSemanticChainRequest): Promise<FinalizedExchangeWithFullSemanticChainResult>;
}

function wireUnits(units: readonly ProposedLifecycleUnit[]) {
  return units.map((unit) => ({ unit_id: unit.unitId, span_start: unit.spanStart, span_end: unit.spanEnd }));
}

function typedStale(error: unknown): never {
  if (isStaleConversationalFocusContext(error)) throw new StaleConversationalFocusContextError();
  if (isStaleThreadIdentityContext(error)) throw new StaleThreadIdentityContextError();
  throw error;
}

export class ConversationSemanticRuntimeRepository implements ConversationSemanticRuntimeBoundary {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedFullSemanticBatchSnapshot> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_full_semantic_integrated_batch_snapshot_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
      p_source_turn_id: request.sourceTurnId,
      p_batch_id: request.batchId,
    });
    return mapIntegratedFullSemanticBatchSnapshot(Array.isArray(rows) ? rows[0] : undefined);
  }

  async readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationSemanticRuntimeContext> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_full_semantic_runtime_context_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
    });
    return mapConversationSemanticRuntimeContext(Array.isArray(rows) ? rows[0] : undefined, request);
  }

  async readIdentityDossierPage(request: ThreadIdentityDossierPageRequest): Promise<ThreadIdentityDossierPage> {
    try {
      const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_thread_identity_dossier_page_v1', {
        p_user_id: request.userId,
        p_expected_world_thread_identity_version: request.expectedWorldThreadIdentityVersion,
        p_after_thread_id: request.afterThreadId,
        p_limit: request.limit,
      });
      return mapThreadIdentityDossierPage(rows, request);
    } catch (error) {
      return typedStale(error);
    }
  }

  async commitFinalizedExchangeWithFullSemanticChain(request: CommitFinalizedExchangeWithFullSemanticChainRequest): Promise<FinalizedExchangeWithFullSemanticChainResult> {
    try {
      const rows = await this.serviceApi.rpc<unknown[]>('commit_finalized_exchange_with_full_semantic_chain_v1', {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_user_source_turn_id: request.userSourceTurnId,
        p_user_batch_id: request.userBatchId,
        p_user_units: wireUnits(request.userUnits),
        p_user_focus_units: request.userFocusUnits,
        p_user_thread_units: request.userThreadUnits,
        p_user_lifecycle_units: request.userLifecycleUnits,
        p_user_live_focus_units: request.userLiveFocusUnits,
        p_assistant_source_turn_id: request.assistantSourceTurnId,
        p_assistant_batch_id: request.assistantBatchId,
        p_assistant_units: wireUnits(request.assistantUnits),
        p_assistant_focus_units: request.assistantFocusUnits,
        p_assistant_thread_units: request.assistantThreadUnits,
        p_assistant_lifecycle_units: request.assistantLifecycleUnits,
        p_assistant_live_focus_units: request.assistantLiveFocusUnits,
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
        p_continuity_evaluator_version: request.continuityEvaluatorVersion,
        p_continuity_policy_version: request.continuityPolicyVersion,
        p_continuity_provider: request.continuityProvider,
        p_continuity_model: request.continuityModel,
        p_continuity_prompt_version: request.continuityPromptVersion,
        p_continuity_schema_version: request.continuitySchemaVersion,
        p_lifecycle_reducer_version: request.lifecycleReducerVersion,
        p_lf_reducer_version: request.lfReducerVersion,
        p_expected_current_sp: request.expectedCurrentSp,
        p_expected_same_sp_event_sequence: request.expectedSameSpEventSequence,
        p_expected_world_thread_identity_version: request.expectedWorldThreadIdentityVersion,
      });
      return mapFinalizedExchangeWithFullSemanticChainResult(Array.isArray(rows) ? rows[0] : undefined);
    } catch (error) {
      return typedStale(error);
    }
  }
}
