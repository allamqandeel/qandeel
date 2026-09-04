// T-03A1 - the durable commitment seam.
//
// This is the ONLY application path to the durable substrate, and in T-03A1 it
// is deliberately unreachable: migration 0064 grants
// `commit_conversation_units_v1` to no application role, so a call through the
// PostgREST service-role channel is refused by the database. The seam exists so
// T-03A2 can consume it without semantic migration; nothing wires it today.
//
// The request carries only identity, coordinates and provenance. It carries no
// committed wording, source role, speaker state, modality, digest, ordinal,
// SP or fingerprint: those are derived by the database from the locked
// authoritative source row, so a privileged caller cannot forge conversational
// history.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { CommitConversationUnitsRequest, CommittedConversationUnit } from './conversation-unit.types';

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
      p_units: request.units.map((unit) => ({
        unit_id: unit.unitId,
        span_start: unit.spanStart,
        span_end: unit.spanEnd,
      })),
      p_evaluator_version: request.evaluatorVersion,
      p_policy_version: request.policyVersion,
      p_segmentation_provider: request.segmentationProvider,
      p_segmentation_model: request.segmentationModel,
      p_segmentation_prompt_version: request.segmentationPromptVersion,
    });
  }
}
