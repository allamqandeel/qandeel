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
/** S8A-05 CP2 (migration 0180): one page of a served topic's items, in their sealed order — the panel's content. */
export interface PublicTopicItemsRow { readonly item_count: number; readonly page: number; readonly page_count: number; readonly items: unknown }
/** S5-03C (migration 0146): one explicit relation of a served Experience — the OTHER endpoint's served entry and the id. */
export interface PublicFieldRelationRow extends PublicFieldEntryRow { readonly relation_id: string }
/** S8A-05 CP1 (migration 0179): the human title and section of a served topic (NULL for an Experience that has none). */
export interface PublicTopicHeaderRow { readonly experience_id: string; readonly title: string | null; readonly section_key: string | null }

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

  /**
   * S8A-05 CP2: one page of 50 of a served Experience's items, through the same visible-entry derivation and serving
   * resolver as the 0145 content read it replaces here (a topic from a conversation may hold up to 10,000 items, so the
   * panel never reads them all at once). Each item keeps its 0145 kind, or the role its topic sealed.
   */
  topicItems(token: string, experienceId: string, page: number): Promise<PublicTopicItemsRow[]> {
    return this.rpc<PublicTopicItemsRow>(token, 'read_public_topic_items_v1', { p_experience_id: experienceId, p_page: page });
  }

  nearby(token: string, experienceId: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'read_public_semantic_nearby_v1', { p_experience_id: experienceId });
  }

  /** S5-03C: the ACTIVE explicit relations of a served Experience whose two bound endpoints are both served now. */
  relations(token: string, experienceId: string): Promise<PublicFieldRelationRow[]> {
    return this.rpc<PublicFieldRelationRow>(token, 'read_public_semantic_relations_v1', { p_experience_id: experienceId });
  }

  /** S8A-05 CP1: the human title and section of up to 400 Experiences the field served — nothing for anything not served. */
  topicHeaders(token: string, experienceIds: readonly string[]): Promise<PublicTopicHeaderRow[]> {
    return this.rpc<PublicTopicHeaderRow>(token, 'read_public_topic_headers_v1', { p_experience_ids: [...experienceIds] });
  }

  /** S8A-05 CP1: served topics whose human title matches the query, each with its place (the 0145 search shape). */
  titleSearch(token: string, query: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'read_public_topic_title_matches_v1', { p_query: query });
  }

  /** S8A-05 CP1: served topics of ONE section whose title, meaning, themes or public text match (the 0145 search shape). */
  sectionSearch(token: string, query: string, section: string): Promise<PublicFieldEntryRow[]> {
    return this.rpc<PublicFieldEntryRow>(token, 'read_public_section_topic_matches_v1', { p_query: query, p_section_key: section });
  }
}
