import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** Exactly the migration 0145 result shapes. */
export interface PublicSpatialPreparationRow { readonly preparation_state: string }
export interface PublicSpatialRequestRow { readonly outcome: string; readonly request_id: string | null }
export interface PublicSpatialInputRow {
  readonly interpretation_id: string; readonly meaning: string; readonly primary_themes: string[];
  readonly secondary_themes: string[]; readonly semantic_region: string;
}
export interface PublicSpatialCommitRow { readonly outcome: string }

/**
 * S5-03B — the stable-placement boundary's only transport, on two separate channels:
 *
 *   - the HUMAN's own token for the two owner commands (the preparation state, and the request to prepare the place):
 *     the database derives the controller from `auth.uid()`; no call names a user, a coordinate, a region, a model or a
 *     readiness;
 *   - the SERVER channel (service role, never a client credential) for the meaning-only placer input and the commit of
 *     what the placer answered. A client can call neither: a coordinate can only arrive here.
 */
@Injectable()
export class PublicSpatialRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly server: SupabaseServiceRoleApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  preparation(token: string, experienceId: string): Promise<PublicSpatialPreparationRow[]> {
    return this.rpc<PublicSpatialPreparationRow>(token, 'read_own_public_spatial_preparation_v1', { p_experience_id: experienceId });
  }

  request(token: string, commandId: string, experienceId: string): Promise<PublicSpatialRequestRow[]> {
    return this.rpc<PublicSpatialRequestRow>(token, 'request_own_public_spatial_placement_v1', { p_command_id: commandId, p_experience_id: experienceId });
  }

  placementInput(requestId: string): Promise<PublicSpatialInputRow[]> {
    return this.server.rpc<PublicSpatialInputRow[]>('read_public_spatial_placement_input_v1', { p_request_id: requestId });
  }

  commit(requestId: string, layoutVersion: string, x: string, y: string): Promise<PublicSpatialCommitRow[]> {
    // Coordinates cross as exact integer text; the database receives them as bigint, never through a float.
    return this.server.rpc<PublicSpatialCommitRow[]>('commit_public_spatial_placement_v1', {
      p_request_id: requestId, p_layout_version: layoutVersion, p_world_x: x, p_world_y: y,
    });
  }
}
