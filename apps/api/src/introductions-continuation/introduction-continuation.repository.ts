import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

export interface SuccessRow {
  readonly introduction_state: string;
  readonly transition_version_id: string | null;
  readonly my_approval_state: string | null;
  readonly my_current_event_id: string | null;
}
export interface ApprovalRow { readonly outcome: string; readonly approval_event_id: string | null }
export interface ParticipationRow {
  readonly participation_state: string;
  readonly pause_reason: string | null;
  readonly participation_event_id: string | null;
}

/**
 * S6-06 — the SUCCESS and reactivation boundaries of migration 0163, on the human's own token only. There is no
 * service_role call here: no background actor reaches a Matching write (SEC-MATCH-00).
 */
@Injectable()
export class IntroductionContinuationRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  readSuccess(token: string, worldId: string): Promise<SuccessRow[]> {
    return this.rpc(token, 'read_my_introduction_success_v1', { p_world_id: worldId });
  }

  approve(token: string, commandId: string, worldId: string, versionId: string, expected: string | null): Promise<ApprovalRow[]> {
    return this.rpc(token, 'approve_my_introduction_success_v1', {
      p_command_id: commandId, p_world_id: worldId, p_transition_version_id: versionId, p_expected_current_event_id: expected,
    });
  }

  withdraw(token: string, commandId: string, worldId: string, versionId: string, expected: string): Promise<ApprovalRow[]> {
    return this.rpc(token, 'withdraw_my_introduction_success_v1', {
      p_command_id: commandId, p_world_id: worldId, p_transition_version_id: versionId, p_expected_current_event_id: expected,
    });
  }

  complete(token: string, worldId: string): Promise<Array<{ outcome: string }>> {
    return this.rpc(token, 'complete_my_introduction_success_v1', { p_world_id: worldId });
  }

  /** The caller's own Matching setup (0109, RETAINED by SEC-MATCH-00): only its participation columns are used. */
  readParticipation(token: string): Promise<ParticipationRow[]> {
    return this.rpc(token, 'get_my_matching_setup_v1', {});
  }

  reactivate(token: string, commandId: string, expected: string, channel: string | null): Promise<Array<{ outcome: string; participation_state: string | null }>> {
    return this.rpc(token, 'reactivate_my_introductions_v1', {
      p_command_id: commandId, p_expected_current_event_id: expected, p_entry_channel: channel,
    });
  }
}
