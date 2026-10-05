import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0140 result shapes of the human's own lifecycle commands. */
export interface SharedGovernanceCapabilitiesRow { readonly governance_available: boolean; readonly history_available: boolean }
export interface SharedWorldNameRow { readonly world_id: string; readonly world_name: string | null }
export interface SharedWorldSettingsRow { readonly world_name: string | null; readonly world_description: string | null; readonly world_topic: string | null }
export interface SharedMemberHandleRow { readonly member_handle: string; readonly member_name: string | null; readonly is_self: boolean }
export interface SharedProposalRow {
  readonly proposal_id: string;
  readonly operation_kind: string;
  readonly created_at: string;
  readonly proposer_name: string | null;
  readonly proposer_is_self: boolean;
  readonly target_name: string | null;
  readonly proposed_name: string | null;
  readonly proposed_description: string | null;
  readonly proposed_topic: string | null;
  readonly approved_by_self: boolean;
  readonly approved_count: number;
  readonly required_count: number;
}
export interface SharedHistoryCandidateRow {
  readonly material_id: string;
  readonly established_at: string;
  readonly is_self: boolean;
  readonly author_name: string | null;
  readonly text_body: string;
}
export interface SharedHistoryRequestRow {
  readonly package_id: string;
  readonly created_at: string;
  readonly grantee_name: string | null;
  readonly approved_by_self: boolean;
  readonly material_id: string;
  readonly established_at: string;
  readonly text_body: string;
}
export interface SharedFormerHistoryRequestRow {
  readonly package_id: string;
  readonly world_id: string;
  readonly created_at: string;
  readonly approved_by_self: boolean;
  readonly material_id: string;
  readonly established_at: string;
  readonly text_body: string;
}
export interface SharedMembershipRequestRow {
  readonly request_id: string;
  readonly world_id: string;
  readonly request_kind: string;
  readonly proposer_name: string | null;
  readonly created_at: string;
}
export interface SharedClosedWorldRow { readonly world_id: string; readonly closed_at: string; readonly world_name: string | null }
export interface SharedClosedMemberRow { readonly world_id: string; readonly is_self: boolean; readonly member_name: string | null }
export interface SharedClosedMaterialRow {
  readonly material_id: string;
  readonly producer_kind: 'HUMAN' | 'QANDEEL';
  readonly established_at: string;
  readonly is_self: boolean;
  readonly author_name: string | null;
  readonly text_body: string;
}
export interface SharedFormerMaterialRow { readonly material_id: string; readonly world_id: string; readonly established_at: string; readonly text_body: string }
export interface SharedOutcomeRow { readonly outcome: string }
export interface SharedProposedRow { readonly outcome: string; readonly proposal_id: string | null }
export interface SharedPackageRow { readonly outcome: string; readonly package_id: string | null }

/** The keyset position of the oldest row a reader holds: the page read next is strictly older. */
export interface SharedLifecycleCursor { readonly establishedAt: string; readonly materialId: string }

/**
 * S4-03 — the human's own Shared lifecycle commands (migration 0140), on the caller's own token: the database's
 * `auth.uid()` is the human. No user, actor, approver, audience, authority, snapshot, rule or persistence identity is ever
 * sent — only the exact World, the caller's command identity, a Product-safe opaque handle the server re-resolves, the
 * proposed values, and — for an add / rejoin — the Shared ID the proposer typed (resolved and epoch-bound inside the
 * database; nothing about the target comes back). The former-member deletion is S4-02's ungated owner wrapper (0139),
 * consumed unchanged.
 */
@Injectable()
export class SharedWorldLifecycleRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  capabilities(token: string) { return this.rpc<SharedGovernanceCapabilitiesRow>(token, 'read_shared_governance_capabilities_v1'); }
  worldNames(token: string) { return this.rpc<SharedWorldNameRow>(token, 'list_own_shared_world_names_v1'); }
  settings(token: string, worldId: string) { return this.rpc<SharedWorldSettingsRow>(token, 'read_own_shared_world_settings_v1', { p_world_id: worldId }); }
  members(token: string, worldId: string) { return this.rpc<SharedMemberHandleRow>(token, 'list_own_shared_world_member_handles_v1', { p_world_id: worldId }); }
  proposals(token: string, worldId: string) { return this.rpc<SharedProposalRow>(token, 'list_own_shared_world_proposals_v1', { p_world_id: worldId }); }
  historyCandidates(token: string, worldId: string, memberHandle: string, before: SharedLifecycleCursor | null, limit: number) {
    return this.rpc<SharedHistoryCandidateRow>(token, 'list_own_shared_history_share_candidates_v1', {
      p_world_id: worldId, p_member_handle: memberHandle, p_before_established_at: before?.establishedAt ?? null,
      p_before_material_id: before?.materialId ?? null, p_limit: limit,
    });
  }
  formerHistoryRequests(token: string) { return this.rpc<SharedFormerHistoryRequestRow>(token, 'list_own_former_shared_history_share_requests_v1'); }
  membershipRequests(token: string) { return this.rpc<SharedMembershipRequestRow>(token, 'list_own_shared_membership_requests_v1'); }
  historyRequests(token: string, worldId: string) { return this.rpc<SharedHistoryRequestRow>(token, 'list_own_shared_history_share_requests_v1', { p_world_id: worldId }); }
  closedWorlds(token: string) { return this.rpc<SharedClosedWorldRow>(token, 'list_own_closed_shared_worlds_v1'); }
  closedMembers(token: string) { return this.rpc<SharedClosedMemberRow>(token, 'list_own_closed_shared_world_members_v1'); }
  closedMaterial(token: string, worldId: string, before: SharedLifecycleCursor | null, limit: number) {
    return this.rpc<SharedClosedMaterialRow>(token, 'list_own_closed_shared_world_material_v1', {
      p_world_id: worldId, p_before_established_at: before?.establishedAt ?? null, p_before_material_id: before?.materialId ?? null, p_limit: limit,
    });
  }
  formerMaterial(token: string, before: SharedLifecycleCursor | null, limit: number) {
    return this.rpc<SharedFormerMaterialRow>(token, 'list_own_former_shared_world_material_v1', {
      p_before_established_at: before?.establishedAt ?? null, p_before_material_id: before?.materialId ?? null, p_limit: limit,
    });
  }

  leave(token: string, commandId: string, worldId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'leave_shared_world_v1', { p_command_id: commandId, p_world_id: worldId });
  }
  proposeSettings(token: string, commandId: string, worldId: string, values: { name: string; description: string; topic: string }) {
    return this.rpc<SharedProposedRow>(token, 'propose_shared_world_settings_v1', {
      p_command_id: commandId, p_world_id: worldId, p_name: values.name, p_description: values.description, p_topic: values.topic,
    });
  }
  proposeRemoval(token: string, commandId: string, worldId: string, memberHandle: string) {
    return this.rpc<SharedProposedRow>(token, 'propose_shared_world_member_removal_v1', { p_command_id: commandId, p_world_id: worldId, p_member_handle: memberHandle });
  }
  proposeEnd(token: string, commandId: string, worldId: string) {
    return this.rpc<SharedProposedRow>(token, 'propose_shared_world_end_v1', { p_command_id: commandId, p_world_id: worldId });
  }
  proposeMember(token: string, commandId: string, worldId: string, sharedId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'propose_shared_world_member_v1', { p_command_id: commandId, p_world_id: worldId, p_shared_id: sharedId });
  }
  acceptMembershipRequest(token: string, commandId: string, worldId: string, requestId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'accept_shared_membership_request_v1', { p_command_id: commandId, p_world_id: worldId, p_request_id: requestId });
  }
  approve(token: string, commandId: string, worldId: string, proposalId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'approve_shared_world_proposal_v1', { p_command_id: commandId, p_world_id: worldId, p_proposal_id: proposalId });
  }
  proposeHistoryShare(token: string, commandId: string, worldId: string, memberHandle: string, materialIds: readonly string[]) {
    return this.rpc<SharedPackageRow>(token, 'propose_shared_world_history_share_v1', {
      p_command_id: commandId, p_world_id: worldId, p_member_handle: memberHandle, p_material_ids: materialIds,
    });
  }
  approveHistoryShare(token: string, commandId: string, worldId: string, packageId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'approve_shared_world_history_share_v1', { p_command_id: commandId, p_world_id: worldId, p_package_id: packageId });
  }
  deleteOwnFormer(token: string, commandId: string, worldId: string, materialId: string) {
    return this.rpc<SharedOutcomeRow>(token, 'delete_own_shared_world_material_v1', { p_command_id: commandId, p_world_id: worldId, p_material_id: materialId });
  }
}
