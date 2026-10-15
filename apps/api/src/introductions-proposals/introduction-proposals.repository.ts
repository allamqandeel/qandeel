import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** One row of migration 0158's two reads, exactly as the database answers it. */
export interface ProposalRow {
  readonly recipient_view_id?: unknown;
  readonly matching_proposal_id?: unknown;
  readonly neutral_outcome?: unknown;
  readonly available_actions?: unknown;
}

/** One row of migration 0158's three decision boundaries. */
export interface ProposalDecisionRow { readonly outcome?: unknown; readonly neutral_outcome?: unknown }

/** The three decisions, each the ONE migration 0158 boundary it names. */
export const PROPOSAL_DECISION_RPC = {
  'forward-approval': 'approve_my_matching_proposal_forward_v1',
  decline: 'decline_my_matching_proposal_v1',
  withdrawal: 'withdraw_my_matching_proposal_v1',
} as const;
export type ProposalDecisionKind = keyof typeof PROPOSAL_DECISION_RPC;

/**
 * S6-04 - the calls, each with the CALLER's token, to the five migration 0158 boundaries. The database derives the human
 * from `auth.uid()`, chooses the decline core from the caller's own view and reads the state a withdrawal moves out of;
 * nothing here takes an account, a counterpart, a role or a state.
 */
@Injectable()
export class IntroductionProposalsRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  list(accessToken: string, after: string | null, limit: number): Promise<ProposalRow[]> {
    return this.rpc(accessToken, 'list_my_matching_proposals_v1', { p_after_proposal_id: after, p_limit: limit });
  }

  get(accessToken: string, proposalId: string): Promise<ProposalRow[]> {
    return this.rpc(accessToken, 'get_my_matching_proposal_v1', { p_proposal_id: proposalId });
  }

  decide(accessToken: string, kind: ProposalDecisionKind, commandId: string, proposalId: string, viewId: string): Promise<ProposalDecisionRow[]> {
    return this.rpc(accessToken, PROPOSAL_DECISION_RPC[kind], { p_command_id: commandId, p_proposal_id: proposalId, p_expected_view_id: viewId });
  }

  private rpc<T>(accessToken: string, name: string, body: Record<string, unknown>): Promise<T> {
    return this.dataApi.request<T>(accessToken, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }
}
