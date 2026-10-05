import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0139 result shapes of the human's own commands. */
export interface SharedMaterialRow {
  readonly material_id: string;
  readonly material_kind: string;
  readonly producer_kind: 'HUMAN' | 'QANDEEL';
  readonly established_at: string;
  readonly is_self: boolean | null;
  readonly author_name: string | null;
  readonly text_body: string;
  readonly can_delete: boolean | null;
}
export interface SharedSendRow {
  readonly outcome: 'COMMITTED' | 'UNAVAILABLE';
  readonly material_id: string | null;
  readonly established_at: string | null;
  readonly qandeel_reply_material_id: string | null;
}
export interface SharedConversationCapabilityRow { readonly conversation_available: boolean }
export interface SharedDeleteRow { readonly outcome: 'DELETED' | 'UNAVAILABLE' }

/** One page the Product reads. Bounded by the 0139 read itself (1–200). */
export const SHARED_MATERIAL_PAGE = 50;

/** The keyset position of the oldest material a reader holds: the page read next is strictly older. */
export interface SharedMaterialCursor {
  readonly establishedAt: string;
  readonly materialId: string;
}

/**
 * S4-02 — the human's own Shared conversation commands (migration 0139), on the caller's own token: the database's
 * `auth.uid()` is the human. No author, audience, kind, viewer or persistence identity is ever sent — only the exact
 * World, the caller's command identity and the words. The server-owned QANDEEL reply is not here: it is the server's
 * act and lives in the Connected Worlds composition.
 */
@Injectable()
export class SharedWorldConversationRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  capability(token: string) { return this.rpc<SharedConversationCapabilityRow>(token, 'read_shared_conversation_capability_v1', {}); }

  /** Newest first: the newest page, or the page strictly older than `before`; never more than one page and one row. */
  material(token: string, worldId: string, before: SharedMaterialCursor | null = null, limit: number = SHARED_MATERIAL_PAGE) {
    return this.rpc<SharedMaterialRow>(token, 'list_own_shared_world_material_v1', {
      p_world_id: worldId, p_before_established_at: before?.establishedAt ?? null, p_before_material_id: before?.materialId ?? null,
      p_limit: Math.min(Math.max(limit, 1), SHARED_MATERIAL_PAGE + 1),
    });
  }

  sendText(token: string, commandId: string, worldId: string, content: string) {
    return this.rpc<SharedSendRow>(token, 'send_shared_world_human_text_v1', { p_command_id: commandId, p_world_id: worldId, p_content: content });
  }

  deleteOwn(token: string, commandId: string, worldId: string, materialId: string) {
    return this.rpc<SharedDeleteRow>(token, 'delete_own_shared_world_material_v1', { p_command_id: commandId, p_world_id: worldId, p_material_id: materialId });
  }
}
