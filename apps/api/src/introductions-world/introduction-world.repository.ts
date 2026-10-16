import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0160 result shapes. */
export interface IntroductionWorldRow {
  readonly world_id?: unknown;
  readonly matching_proposal_id?: unknown;
  readonly introduction_state?: unknown;
  readonly other_first_name?: unknown;
}
export interface IntroductionMessageRow {
  readonly introduction_state?: unknown;
  readonly material_id?: unknown;
  readonly established_at?: unknown;
  readonly is_self?: unknown;
  readonly text_body?: unknown;
}
export interface IntroductionSendRow {
  readonly outcome?: unknown;
  readonly material_id?: unknown;
  readonly established_at?: unknown;
}

/** The keyset position of the oldest message a reader holds: the page read next is strictly older. */
export interface IntroductionMessageCursor {
  readonly establishedAt: string;
  readonly materialId: string;
}

/**
 * S6-05 (CP3) - the human's own Introduction World calls (migration 0160), on the CALLER's token: the database derives
 * the human from `auth.uid()`. Nothing here sends a user, a counterpart, an audience, a kind or a persistence identity -
 * only the World, the caller's command and the words. Deletion is not here: it is the existing Shared owner deletion (R-5).
 */
@Injectable()
export class IntroductionWorldRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  worlds(token: string) {
    return this.rpc<IntroductionWorldRow>(token, 'list_my_introduction_worlds_v1', {});
  }

  /** Newest first: the newest page, or the page strictly older than `before`. */
  messages(token: string, worldId: string, before: IntroductionMessageCursor | null, limit: number) {
    return this.rpc<IntroductionMessageRow>(token, 'read_my_introduction_messages_v1', {
      p_world_id: worldId, p_before_established_at: before?.establishedAt ?? null, p_before_material_id: before?.materialId ?? null, p_limit: limit,
    });
  }

  send(token: string, commandId: string, worldId: string, content: string) {
    return this.rpc<IntroductionSendRow>(token, 'send_my_introduction_text_v1', { p_command_id: commandId, p_world_id: worldId, p_content: content });
  }
}
