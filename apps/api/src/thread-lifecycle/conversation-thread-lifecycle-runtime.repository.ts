// T-03B3 - the production-inert Thread Lifecycle Runtime Repository.
//
// The ONLY application seam over the 0070 reads (integrated snapshot, runtime
// context, exhaustive dossier paging) and the ONE 0070 coordinator. It runs
// through the explicit server-authority channel, sends only identity,
// coordinates, canonical semantic payload, provenance and the two expected
// optimistic tokens, and maps exactly TWO database conditions to typed
// domain errors:
//
//   SQLSTATE 40001 + message EXACTLY 'STALE_CONVERSATIONAL_FOCUS_CONTEXT'
//   -> StaleConversationalFocusContextError   (predicate REUSED from T-03B1b2)
//   SQLSTATE 40001 + message EXACTLY 'STALE_THREAD_IDENTITY_CONTEXT'
//   -> StaleThreadIdentityContextError        (the same exact-equality rule)
//
// Any other serialization failure, any other status and any status-only
// transport error stay what they are. No Home coordinate, base, attempt or
// fingerprint crosses this boundary in either direction. NOT registered in
// Nest: every RPC it calls is executable by no application role in this task.

import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { isStaleConversationalFocusContext } from '../conversational-focus/conversation-focus-runtime.repository';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import {
  mapConversationThreadLifecycleRuntimeContext,
  mapIntegratedThreadLifecycleBatchSnapshot,
  mapThreadIdentityDossierPage,
} from './conversation-thread-lifecycle-runtime-mapper';
import {
  StaleThreadIdentityContextError,
  type CommitFinalizedExchangeWithThreadLifecycleRequest,
  type ConversationThreadLifecycleRuntimeContext,
  type FinalizedExchangeWithThreadLifecycleResult,
  type IntegratedThreadLifecycleBatchSnapshot,
  type ProposedLifecycleUnit,
  type ThreadIdentityDossierPage,
  type ThreadIdentityDossierPageRequest,
} from './conversation-thread-lifecycle-runtime.types';

export const STALE_THREAD_IDENTITY_CONTEXT_SQLSTATE = '40001';
export const STALE_THREAD_IDENTITY_CONTEXT_TOKEN = 'STALE_THREAD_IDENTITY_CONTEXT';

/** The narrow boundary the establishment service depends on; tests inject a fake. */
export interface ConversationThreadLifecycleRuntimeBoundary {
  readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedThreadLifecycleBatchSnapshot>;
  readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationThreadLifecycleRuntimeContext>;
  readIdentityDossierPage(request: ThreadIdentityDossierPageRequest): Promise<ThreadIdentityDossierPage>;
  commitFinalizedExchangeWithThreadLifecycle(request: CommitFinalizedExchangeWithThreadLifecycleRequest): Promise<FinalizedExchangeWithThreadLifecycleResult>;
}

/**
 * True only for the exact typed identity-version condition, never for a
 * generic 40001 and never for a message that merely contains the token.
 */
export function isStaleThreadIdentityContext(error: unknown): boolean {
  if (!(error instanceof DataApiError)) return false;
  const { databaseCode, databaseMessage } = readDataApiUpstreamIdentity(error);
  return databaseCode === STALE_THREAD_IDENTITY_CONTEXT_SQLSTATE && databaseMessage === STALE_THREAD_IDENTITY_CONTEXT_TOKEN;
}

function wireUnits(units: readonly ProposedLifecycleUnit[]) {
  return units.map((unit) => ({ unit_id: unit.unitId, span_start: unit.spanStart, span_end: unit.spanEnd }));
}

function typedStale(error: unknown): never {
  if (isStaleConversationalFocusContext(error)) throw new StaleConversationalFocusContextError();
  if (isStaleThreadIdentityContext(error)) throw new StaleThreadIdentityContextError();
  throw error;
}

export class ConversationThreadLifecycleRuntimeRepository implements ConversationThreadLifecycleRuntimeBoundary {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async readIntegratedBatchSnapshot(request: { sessionId: string; userId: string; sourceTurnId: string; batchId: string }): Promise<IntegratedThreadLifecycleBatchSnapshot> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_thread_lifecycle_integrated_batch_snapshot_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
      p_source_turn_id: request.sourceTurnId,
      p_batch_id: request.batchId,
    });
    return mapIntegratedThreadLifecycleBatchSnapshot(Array.isArray(rows) ? rows[0] : undefined);
  }

  async readRuntimeContext(request: { sessionId: string; userId: string }): Promise<ConversationThreadLifecycleRuntimeContext> {
    const rows = await this.serviceApi.rpc<unknown[]>('get_conversation_thread_lifecycle_runtime_context_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
    });
    return mapConversationThreadLifecycleRuntimeContext(Array.isArray(rows) ? rows[0] : undefined, request);
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

  async commitFinalizedExchangeWithThreadLifecycle(request: CommitFinalizedExchangeWithThreadLifecycleRequest): Promise<FinalizedExchangeWithThreadLifecycleResult> {
    try {
      const rows = await this.serviceApi.rpc<FinalizedExchangeWithThreadLifecycleResult[]>('commit_finalized_exchange_with_focus_thread_lifecycle_v1', {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_user_source_turn_id: request.userSourceTurnId,
        p_user_batch_id: request.userBatchId,
        p_user_units: wireUnits(request.userUnits),
        p_user_focus_units: request.userFocusUnits,
        p_user_thread_units: request.userThreadUnits,
        p_user_lifecycle_units: request.userLifecycleUnits,
        p_assistant_source_turn_id: request.assistantSourceTurnId,
        p_assistant_batch_id: request.assistantBatchId,
        p_assistant_units: wireUnits(request.assistantUnits),
        p_assistant_focus_units: request.assistantFocusUnits,
        p_assistant_thread_units: request.assistantThreadUnits,
        p_assistant_lifecycle_units: request.assistantLifecycleUnits,
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
        p_expected_current_sp: request.expectedCurrentSp,
        p_expected_same_sp_event_sequence: request.expectedSameSpEventSequence,
        p_expected_world_thread_identity_version: request.expectedWorldThreadIdentityVersion,
      });
      return rows[0];
    } catch (error) {
      return typedStale(error);
    }
  }
}
