// T-03A1 - the durable commitment seam, activated by T-03A2.
//
// This is the ONLY application path to the durable substrate. Migration 0065
// grants the canonical producer and the atomic finalized-exchange coordinator
// to `service_role` and to no other role, so every call runs through the
// explicit server-authority channel; no caller access token ever reaches them,
// and no direct table INSERT/UPDATE/DELETE grant exists for any role.
//
// The request carries only identity, coordinates and provenance. It carries no
// committed wording, source role, speaker state, modality, digest, ordinal,
// SP or fingerprint: those are derived by the database from the locked
// authoritative source row, so a privileged caller cannot forge conversational
// history. SP in particular is allocated by the database under the Session
// Semantic Clock lock and has no parameter here.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type {
  CommitBatchSnapshot,
  CommitConversationUnitsRequest,
  CommitFinalizedExchangeRequest,
  CommittedConversationUnit,
  FinalizedExchangeCommitResult,
} from './conversation-unit.types';

function wireUnits(units: readonly { unitId: string; spanStart: number; spanEnd: number }[]) {
  return units.map((unit) => ({ unit_id: unit.unitId, span_start: unit.spanStart, span_end: unit.spanEnd }));
}

export class ConversationUnitRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  /**
   * Commits one batch of conversational units, or replays an existing batch.
   *
   * Retry contract (REV03A1-06): the same batch id with the identical payload
   * returns the stored rows with zero mutation and is NOT re-checked against
   * today's committed source frontier, so an exact replay still succeeds after
   * later batches advanced it. The same batch id with a changed payload fails
   * closed with `COMMIT_BATCH_PAYLOAD_CONFLICT`. A NEW batch whose first span
   * precedes the frontier fails closed with `SPAN_BEFORE_SOURCE_FRONTIER`.
   */
  async commitUnits(request: CommitConversationUnitsRequest): Promise<readonly CommittedConversationUnit[]> {
    return this.serviceApi.rpc<CommittedConversationUnit[]>('commit_conversation_units_v1', {
      p_session_id: request.sessionId,
      p_user_id: request.userId,
      p_source_turn_id: request.sourceTurnId,
      p_batch_id: request.batchId,
      p_units: wireUnits(request.units),
      p_evaluator_version: request.evaluatorVersion,
      p_policy_version: request.policyVersion,
      p_segmentation_provider: request.segmentationProvider,
      p_segmentation_model: request.segmentationModel,
      p_segmentation_prompt_version: request.segmentationPromptVersion,
    });
  }

  /**
   * Commits the prepared USER batch and then the prepared ASSISTANT batch of
   * ONE finalized exchange, inside ONE database transaction under ONE Session
   * Semantic Clock lock.
   *
   * They remain two separate source turns and two separate batches - there is
   * no combined USER+ASSISTANT CU and no combined Moment - but no other Session
   * SP writer can interleave between the two blocks, and either half failing
   * rolls both back. The coordinator reuses the canonical producer, so every
   * 0064 rejection, idempotency and source-frontier rule still applies.
   */
  async commitFinalizedExchange(request: CommitFinalizedExchangeRequest): Promise<FinalizedExchangeCommitResult> {
    const rows = await this.serviceApi.rpc<FinalizedExchangeCommitResult[]>(
      'commit_finalized_exchange_conversation_units_v1',
      {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_user_source_turn_id: request.userSourceTurnId,
        p_user_batch_id: request.userBatchId,
        p_user_units: wireUnits(request.userUnits),
        p_assistant_source_turn_id: request.assistantSourceTurnId,
        p_assistant_batch_id: request.assistantBatchId,
        p_assistant_units: wireUnits(request.assistantUnits),
        p_evaluator_version: request.evaluatorVersion,
        p_policy_version: request.policyVersion,
        p_segmentation_provider: request.segmentationProvider,
        p_segmentation_model: request.segmentationModel,
        p_segmentation_prompt_version: request.segmentationPromptVersion,
      },
    );
    return rows[0];
  }

  /**
   * Narrow ownership-validated read of one automatic commitment batch.
   *
   * It exists so the runtime never re-invokes the segmentation provider for a
   * batch that is already committed - a committed ZERO-CU batch counts as
   * complete - and never trusts a stale caller-supplied source frontier. No
   * direct table SELECT grant is required or created.
   */
  async readBatchSnapshot(request: {
    sessionId: string;
    userId: string;
    sourceTurnId: string;
    batchId: string;
  }): Promise<CommitBatchSnapshot> {
    const rows = await this.serviceApi.rpc<CommitBatchSnapshot[]>(
      'get_conversation_unit_commit_batch_snapshot_v1',
      {
        p_session_id: request.sessionId,
        p_user_id: request.userId,
        p_source_turn_id: request.sourceTurnId,
        p_batch_id: request.batchId,
      },
    );
    return rows[0];
  }
}
