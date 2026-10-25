import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0177 owner read (and 0176's withdrawal) row shapes. */
export interface SharedPermissionRow {
  readonly section: string;
  readonly memory_id: string;
  readonly content: string | null;
  readonly request_id: string | null;
  readonly ended_reason: string | null;
  readonly member_names: readonly (string | null)[] | null;
  readonly new_member_names: readonly (string | null)[] | null;
  readonly audience_ref: string;
}
export interface SharedPermissionOutcomeRow { readonly outcome: string }

/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in ONE Shared World, on the caller's OWN token, through
 * migration 0177's owner read and commands (member names and an opaque audience reference, never a user id) and 0176's
 * withdrawal. The database derives the owner from `auth.uid()`; no account, item owner, audience or grant is ever sent.
 */
@Injectable()
export class SharedWorldPermissionsRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  list(token: string, worldId: string) {
    return this.rpc<SharedPermissionRow>(token, 'list_own_shared_knowledge_v2', { p_world_id: worldId });
  }
  answer(token: string, commandId: string, requestId: string, decision: 'ALLOW' | 'DECLINE', audienceRef: string | null) {
    return this.rpc<SharedPermissionOutcomeRow>(token, 'answer_own_shared_knowledge_request_v2',
      { p_command_id: commandId, p_request_id: requestId, p_decision: decision, p_audience_ref: audienceRef });
  }
  allow(token: string, commandId: string, worldId: string, itemId: string, audienceRef: string) {
    return this.rpc<SharedPermissionOutcomeRow>(token, 'allow_own_shared_knowledge_v2',
      { p_command_id: commandId, p_world_id: worldId, p_memory_id: itemId, p_audience_ref: audienceRef });
  }
  withdraw(token: string, commandId: string, worldId: string, itemId: string) {
    return this.rpc<SharedPermissionOutcomeRow>(token, 'revoke_own_shared_knowledge_v1',
      { p_command_id: commandId, p_world_id: worldId, p_memory_id: itemId });
  }
}
