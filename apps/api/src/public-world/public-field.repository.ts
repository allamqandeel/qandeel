import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0145 viewer result shapes. Coordinates are exact integer text. */
export interface PublicFieldEntryRow {
  readonly experience_id: string; readonly world_x: string; readonly world_y: string; readonly meaning: string; readonly semantic_region: string;
}
export interface PublicFieldExperienceRow {
  readonly experience_id: string; readonly version_ordinal: number; readonly meaning: string; readonly primary_themes: string[];
  readonly secondary_themes: string[]; readonly semantic_region: string; readonly publisher_label_mode: string;
  readonly publisher_display_label: string | null; readonly published_at: string; readonly discussion_post_count: number;
  readonly qandeel_response_count: number; readonly world_x: string; readonly world_y: string;
}
export interface PublicFieldContentRow { readonly item_ordinal: number; readonly item_kind: string; readonly item_text: string }

/**
 * S5-03B — the Public semantic field's only transport. Every call runs on the VIEWER's own token, so the database
 * derives the viewer from `auth.uid()` and admits them itself; no call names a viewer, an audience, a visibility, a
 * lifecycle, a version, a region or a rank. What a call may send is navigation only: a bounded world rectangle, a search
 * query, or the id of an Experience the field showed.
 */
@Injectable()
export class PublicFieldRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  field(token: string, minX: string, minY: string, maxX: string, maxY: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'read_public_semantic_field_v1', { p_min_x: minX, p_min_y: minY, p_max_x: maxX, p_max_y: maxY });
  }

  search(token: string, query: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'search_public_semantic_field_v1', { p_query: query });
  }

  experience(token: string, experienceId: string): Promise<PublicFieldExperienceRow[]> {
    return this.rpc<PublicFieldExperienceRow>(token, 'read_public_semantic_experience_v1', { p_experience_id: experienceId });
  }

  content(token: string, experienceId: string): Promise<PublicFieldContentRow[]> {
    return this.rpc<PublicFieldContentRow>(token, 'read_public_semantic_experience_content_v1', { p_experience_id: experienceId });
  }

  nearby(token: string, experienceId: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'read_public_semantic_nearby_v1', { p_experience_id: experienceId });
  }
}
