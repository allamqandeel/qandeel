import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** One row of `read_my_introduction_disclosures_v1` (migration 0162). Never a user id. */
export interface DisclosureRow {
  readonly introduction_state: string;
  readonly item_kind: string;
  readonly is_mine: boolean | null;
  readonly disclosure_material_id: string | null;
  readonly disclosure_version_id: string | null;
  readonly resource_type: string | null;
  readonly field_key: string | null;
  readonly text_value: string | null;
  readonly image_series_id: string | null;
  readonly image_stage: number | null;
  readonly media_handle: string | null;
  readonly series_state: string | null;
  readonly established_at: string | null;
}

export interface DisplayNamesRow {
  readonly introduction_state: string;
  readonly my_displayed_version_id: string | null;
  readonly other_display_name: string | null;
}

export interface ShareRow {
  readonly world_id: string;
  readonly introduction_state: string;
  readonly other_first_name: string | null;
  readonly disclosure_material_id: string;
  readonly disclosure_version_id: string;
  readonly resource_type: string;
  readonly field_key: string | null;
  readonly text_value: string | null;
  readonly image_series_id: string | null;
  readonly image_stage: number | null;
  readonly is_displayed: boolean;
  readonly established_at: string;
}

/** One row of `list_my_introduction_photo_renditions_v1` (migration 0168): the caller's OWN renditions. Never a user id. */
export interface OwnRenditionRow {
  readonly world_id: string;
  readonly introduction_started_at: string;
  readonly stage: number;
  readonly media_handle: string;
  readonly is_shared: boolean;
}

export interface OutcomeRow { readonly outcome: string }
export interface DisclosedRow extends OutcomeRow { readonly disclosed_material_id: string | null; readonly disclosed_at: string | null }
export interface BegunRow extends OutcomeRow { readonly image_series_id: string | null }
export interface UploadKeyRow { readonly stage: number; readonly storage_key: string }
export interface ClaimRow { readonly storage_key: string; readonly lease_id: string }

/**
 * S6-06 — the disclosure, photo and display-name boundaries of migration 0162. The human's calls ride the human's own
 * token, so the database derives the human from auth.uid(); the storage calls are the API's own, through the server-only
 * service_role channel, and carry no human identity at all.
 */
@Injectable()
export class IntroductionDisclosureRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly serverApi: SupabaseServiceRoleApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  readDisclosures(token: string, worldId: string): Promise<DisclosureRow[]> {
    return this.rpc(token, 'read_my_introduction_disclosures_v1', { p_world_id: worldId });
  }

  readDisplayNames(token: string, worldId: string): Promise<DisplayNamesRow[]> {
    return this.rpc(token, 'read_my_introduction_display_names_v1', { p_world_id: worldId });
  }

  listShares(token: string): Promise<ShareRow[]> {
    return this.rpc(token, 'list_my_introduction_shares_v1', {});
  }

  shareText(token: string, commandId: string, worldId: string, resourceType: string, fieldKey: string | null, text: string): Promise<DisclosedRow[]> {
    return this.rpc(token, 'disclose_my_introduction_text_v1', {
      p_command_id: commandId, p_world_id: worldId, p_resource_type: resourceType, p_field_key: fieldKey, p_text: text,
    });
  }

  beginImage(token: string, commandId: string, worldId: string): Promise<BegunRow[]> {
    return this.rpc(token, 'begin_my_introduction_image_v1', { p_command_id: commandId, p_world_id: worldId });
  }

  shareStage(token: string, commandId: string, worldId: string, seriesId: string, stage: number): Promise<DisclosedRow[]> {
    return this.rpc(token, 'disclose_my_introduction_image_stage_v1', {
      p_command_id: commandId, p_world_id: worldId, p_series_id: seriesId, p_stage: stage,
    });
  }

  removeImage(token: string, commandId: string, worldId: string, seriesId: string): Promise<OutcomeRow[]> {
    return this.rpc(token, 'remove_my_introduction_image_v1', { p_command_id: commandId, p_world_id: worldId, p_series_id: seriesId });
  }

  /** S6-07 (CP4): the caller's own photo renditions, for Export My Data only (migration 0168). */
  listOwnPhotoRenditions(token: string): Promise<OwnRenditionRow[]> {
    return this.rpc(token, 'list_my_introduction_photo_renditions_v1', {});
  }

  authorizeMedia(token: string, worldId: string, handle: string): Promise<OutcomeRow[]> {
    return this.rpc(token, 'authorize_my_introduction_media_v1', { p_world_id: worldId, p_handle: handle });
  }

  grantDisplayName(token: string, commandId: string, worldId: string, versionId: string): Promise<OutcomeRow[]> {
    return this.rpc(token, 'grant_my_introduction_name_display_v1', {
      p_command_id: commandId, p_world_id: worldId, p_resource_version_id: versionId,
    });
  }

  revokeDisplayName(token: string, commandId: string, worldId: string): Promise<OutcomeRow[]> {
    return this.rpc(token, 'revoke_my_introduction_name_display_v1', { p_command_id: commandId, p_world_id: worldId });
  }

  // ---- the API's own storage boundary (service_role)
  uploadKeys(seriesId: string): Promise<UploadKeyRow[]> {
    return this.serverApi.rpc('server_read_introduction_image_upload_v1', { p_series_id: seriesId });
  }

  completeImage(seriesId: string): Promise<OutcomeRow[]> {
    return this.serverApi.rpc('server_complete_introduction_image_v1', { p_series_id: seriesId });
  }

  mediaKey(handle: string): Promise<Array<{ storage_key: string }>> {
    return this.serverApi.rpc('server_read_introduction_media_key_v1', { p_handle: handle });
  }

  sweep(limit: number): Promise<Array<{ swept_series: number; released_renditions: number }>> {
    return this.serverApi.rpc('server_sweep_introduction_media_v1', { p_limit: limit });
  }

  claimErasures(limit: number, leaseSeconds: number): Promise<ClaimRow[]> {
    return this.serverApi.rpc('server_claim_introduction_media_erasures_v1', { p_limit: limit, p_lease_seconds: leaseSeconds });
  }

  confirmErased(key: string, leaseId: string): Promise<OutcomeRow[]> {
    return this.serverApi.rpc('server_confirm_introduction_media_erased_v1', { p_storage_key: key, p_lease_id: leaseId });
  }

  deferErasure(key: string, leaseId: string): Promise<OutcomeRow[]> {
    return this.serverApi.rpc('server_defer_introduction_media_erasure_v1', { p_storage_key: key, p_lease_id: leaseId });
  }

  enqueueUnknown(keys: readonly string[]): Promise<Array<{ enqueued: number }>> {
    return this.serverApi.rpc('server_enqueue_unknown_introduction_media_v1', { p_storage_keys: keys });
  }
}
