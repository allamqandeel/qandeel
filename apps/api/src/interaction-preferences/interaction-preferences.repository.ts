import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { MEMORY_SUBJECT_EMBED } from '../memory/memory-subject';
import type { InteractionPreferenceField, InteractionPreferenceValue } from './interaction-preferences.types';

const RECORD_FIELDS = 'reply_length,reply_language,humour,explanation_style,version';
const LEGACY_FIELDS = `id,content,status,type,expires_at,updated_at,${MEMORY_SUBJECT_EMBED}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** The bounded set of the owner's legacy INTERACTION_PREFERENCE Memories the optional review looks at. */
export const LEGACY_REVIEW_CANDIDATE_LIMIT = 64;

/**
 * IP-IMP-01 — every read and owner write with the CALLER's token: row-level security plus an explicit owner filter on
 * reads, `auth.uid()`-only owner commands on writes (migration 0153). No method takes an account parameter that reaches
 * the database as authority. The conversation command's server finalization is the Conversation repository's, because
 * it also finalizes the turn.
 */
@Injectable()
export class InteractionPreferencesRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  /** At most one row (the primary key is the owner); two answers are an integrity failure for the caller to refuse. */
  async read(accessToken: string, userId: string): Promise<unknown> {
    const query = new URLSearchParams({ select: RECORD_FIELDS, user_id: `eq.${userId}`, limit: '2' });
    return this.dataApi.request<unknown>(accessToken, `interaction_preferences?${query}`);
  }

  async set(accessToken: string, field: InteractionPreferenceField, value: InteractionPreferenceValue, expectedVersion: number): Promise<unknown> {
    return this.dataApi.request<unknown>(accessToken, 'rpc/set_own_interaction_preference_v1', {
      method: 'POST',
      body: JSON.stringify({ p_field: field, p_value: value, p_expected_version: expectedVersion }),
    });
  }

  async applyLegacy(
    accessToken: string, memoryId: string, field: InteractionPreferenceField, value: InteractionPreferenceValue, expectedVersion: number,
  ): Promise<unknown> {
    if (!UUID.test(memoryId)) throw new Error('INTERACTION_PREFERENCE_INVALID_IDENTITY');
    return this.dataApi.request<unknown>(accessToken, 'rpc/apply_own_legacy_interaction_preference_v1', {
      method: 'POST',
      body: JSON.stringify({ p_memory_id: memoryId, p_field: field, p_value: value, p_expected_version: expectedVersion }),
    });
  }

  /** The owner's ACTIVE INTERACTION_PREFERENCE Memories with their subject, newest first. Expiry is applied by the caller. */
  async legacyMemories(accessToken: string, userId: string, ids?: readonly string[]): Promise<unknown> {
    if (ids !== undefined && !ids.every((id) => UUID.test(id))) throw new Error('INTERACTION_PREFERENCE_INVALID_IDENTITY');
    const query = new URLSearchParams({
      select: LEGACY_FIELDS, user_id: `eq.${userId}`, type: 'eq.INTERACTION_PREFERENCE', status: 'eq.ACTIVE',
      ...(ids !== undefined ? { id: `in.(${ids.join(',')})` } : {}),
      order: 'updated_at.desc,id.desc', limit: String(LEGACY_REVIEW_CANDIDATE_LIMIT),
    });
    return this.dataApi.request<unknown>(accessToken, `memories?${query}`);
  }
}
