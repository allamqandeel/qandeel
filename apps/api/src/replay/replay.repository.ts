import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** A migration 0169 result row, untrusted until the service has checked every field. */
export type ReplayRow = Readonly<Record<string, unknown>>;

/**
 * S7-01 - the human's own Personal Replay calls (migration 0169), on the CALLER's token: the database derives the human
 * from `auth.uid()`. Nothing here sends a user, an owner, a source class, a Conversation Unit, a manifest or a version
 * identity the database did not hand out - only the caller's command, the conversation, the range and the coordinates
 * the caller already holds. No service_role path exists in this module.
 */
@Injectable()
export class ReplayRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc(token: string, name: string, body: Record<string, unknown>): Promise<ReplayRow[]> {
    return this.dataApi.request<ReplayRow[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  capability(token: string) {
    return this.rpc(token, 'read_my_replay_capability_v1', {});
  }

  conversationReplays(token: string, sessionId: string) {
    return this.rpc(token, 'list_my_conversation_replays_v1', { p_session_id: sessionId });
  }

  createDraft(token: string, commandId: string, sessionId: string, firstTc: number, lastTc: number) {
    return this.rpc(token, 'create_my_replay_draft_v1', { p_command_id: commandId, p_session_id: sessionId, p_first_tc: firstTc, p_last_tc: lastTc });
  }

  reviseDraft(token: string, commandId: string, replayId: string, expectedDraftRevision: number, firstTc: number, lastTc: number) {
    return this.rpc(token, 'revise_my_replay_draft_v1', {
      p_command_id: commandId, p_replay_id: replayId, p_expected_draft_revision: expectedDraftRevision, p_first_tc: firstTc, p_last_tc: lastTc,
    });
  }

  preparePreview(token: string, commandId: string, replayId: string, expectedDraftRevision: number) {
    return this.rpc(token, 'prepare_my_replay_preview_v1', { p_command_id: commandId, p_replay_id: replayId, p_expected_draft_revision: expectedDraftRevision });
  }

  finalize(token: string, commandId: string, replayId: string, expectedVersionId: string) {
    return this.rpc(token, 'finalize_my_replay_version_v1', { p_command_id: commandId, p_replay_id: replayId, p_expected_replay_version_id: expectedVersionId });
  }

  reopen(token: string, commandId: string, replayId: string, expectedVersionId: string) {
    return this.rpc(token, 'reopen_my_replay_for_revision_v1', { p_command_id: commandId, p_replay_id: replayId, p_expected_replay_version_id: expectedVersionId });
  }

  replay(token: string, replayId: string) {
    return this.rpc(token, 'read_my_replay_v1', { p_replay_id: replayId });
  }

  version(token: string, replayId: string, versionId: string) {
    return this.rpc(token, 'read_my_replay_version_v1', { p_replay_id: replayId, p_replay_version_id: versionId });
  }

  moments(token: string, replayId: string, versionId: string) {
    return this.rpc(token, 'read_my_replay_moments_v1', { p_replay_id: replayId, p_replay_version_id: versionId });
  }

  momentAnalysis(token: string, replayId: string, versionId: string, ordinal: number) {
    return this.rpc(token, 'read_my_replay_moment_analysis_v1', { p_replay_id: replayId, p_replay_version_id: versionId, p_selected_ordinal: ordinal });
  }
}
