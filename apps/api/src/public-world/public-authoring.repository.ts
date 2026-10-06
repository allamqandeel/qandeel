import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0143 result shapes. */
export interface PublicDraftRow {
  readonly experience_id: string; readonly current_lifecycle: string; readonly created_at: string;
  readonly has_package: boolean; readonly item_count: number;
}
export interface PublicAuthoringSourceRow {
  readonly source_kind: string; readonly source_id: string; readonly world_id: string | null; readonly material_kind: string | null;
  readonly established_at: string; readonly is_self: boolean; readonly author_name: string | null; readonly text_body: string;
}
export interface PublicDraftStartRow { readonly outcome: string; readonly experience_id: string; readonly current_lifecycle: string }
export interface PublicPackageRow { readonly outcome: string; readonly item_count: number | null; readonly required_approver_count: number | null }
export interface PublicReviewRow {
  readonly review_state: string; readonly current_lifecycle: string; readonly version_ordinal: number | null; readonly manifest_version_id: string | null;
  readonly publisher_label_mode: string | null; readonly publisher_display_label: string | null; readonly item_count: number | null;
  readonly required_approver_count: number | null; readonly effective_approval_count: number | null;
  readonly own_approval_state: string | null; readonly ready_allowed: boolean; readonly item_ordinal: number | null;
  readonly derivative_classification: string | null; readonly public_text_body: string | null;
}
export interface PublicApprovalRequestRow {
  readonly manifest_version_id: string; readonly request_state: string; readonly current_lifecycle: string;
  readonly publisher_label_mode: string | null; readonly publisher_display_label: string | null; readonly item_count: number | null;
  readonly own_item_count: number | null; readonly required_approver_count: number | null;
  readonly effective_approval_count: number | null; readonly own_approval_state: string | null;
  readonly item_ordinal: number | null; readonly public_text_body: string | null;
}
export interface PublicApproveRow { readonly outcome: string; readonly own_approval_state: string | null }
export interface PublicWithdrawRow { readonly outcome: string }
export interface PublicReadyRow { readonly outcome: string; readonly current_lifecycle: string | null }

/**
 * S5-02 — the Public authoring boundary's only transport. Every call runs on the caller's own token, so the database
 * derives the human from `auth.uid()`; no call names a user, a Public ref, a label, an approver, an authority, an
 * audience or a body. Every identity it sends is either the caller's own fresh command id or an id the database itself
 * returned to this caller.
 */
@Injectable()
export class PublicAuthoringRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  drafts(token: string): Promise<PublicDraftRow[]> {
    return this.rpc<PublicDraftRow>(token, 'list_own_public_drafts_v1');
  }

  sources(token: string): Promise<PublicAuthoringSourceRow[]> {
    return this.rpc<PublicAuthoringSourceRow>(token, 'list_own_public_authoring_sources_v1');
  }

  startDraft(token: string, commandId: string): Promise<PublicDraftStartRow[]> {
    return this.rpc<PublicDraftStartRow>(token, 'start_own_public_experience_draft_v1', { p_command_id: commandId });
  }

  preparePackage(token: string, commandId: string, experienceId: string, personalUnitIds: readonly string[],
    sharedWorldIds: readonly string[], sharedMaterialIds: readonly string[]): Promise<PublicPackageRow[]> {
    return this.rpc<PublicPackageRow>(token, 'prepare_own_public_experience_package_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_personal_unit_ids: [...personalUnitIds],
      p_shared_world_ids: [...sharedWorldIds], p_shared_material_ids: [...sharedMaterialIds],
    });
  }

  review(token: string, experienceId: string): Promise<PublicReviewRow[]> {
    return this.rpc<PublicReviewRow>(token, 'read_own_public_experience_review_v1', { p_experience_id: experienceId });
  }

  approvalRequests(token: string): Promise<PublicApprovalRequestRow[]> {
    return this.rpc<PublicApprovalRequestRow>(token, 'list_own_public_approval_requests_v1');
  }

  approve(token: string, commandId: string, manifestId: string): Promise<PublicApproveRow[]> {
    return this.rpc<PublicApproveRow>(token, 'approve_own_public_package_v1', { p_command_id: commandId, p_manifest_version_id: manifestId });
  }

  withdraw(token: string, commandId: string, manifestId: string): Promise<PublicWithdrawRow[]> {
    return this.rpc<PublicWithdrawRow>(token, 'withdraw_own_public_approval_v1', { p_command_id: commandId, p_manifest_version_id: manifestId });
  }

  ready(token: string, commandId: string, experienceId: string): Promise<PublicReadyRow[]> {
    return this.rpc<PublicReadyRow>(token, 'commit_own_public_experience_ready_v1', { p_command_id: commandId, p_experience_id: experienceId });
  }
}
