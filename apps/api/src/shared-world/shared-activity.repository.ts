import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** The one durable Shared fact a source read names (migration 0141). */
export type SharedActivitySourceKind = 'HUMAN_TEXT' | 'PROPOSAL' | 'MEMBER_REQUEST' | 'JOINED' | 'BIRTH' | 'LEFT';

/** Exactly the 0141 server pass's row: who may be told now, and the bounded facts the sentence needs. Never content. */
export interface SharedActivitySourceRow {
  readonly recipient_user_id: string;
  readonly world_id: string;
  readonly world_name: string | null;
  readonly actor_name: string | null;
  readonly subject_name: string | null;
  readonly operation_kind: string | null;
  readonly occurred_at: string;
}

/**
 * S4-04 — the Shared Activity producer's ONE read: the server channel, one 0141 server pass. It sends the identity of
 * one durable Shared fact and nothing else — no recipient, actor, World, Name or time is ever supplied; the database
 * derives every recipient from durable Shared truth. It is not the Shared Product transport (that one runs only on the
 * caller's own token, `shared-world.repository.ts`).
 */
@Injectable()
export class SharedActivityRepository {
  constructor(private readonly server: SupabaseServiceRoleApiService) {}

  async source(kind: SharedActivitySourceKind, sourceId: string): Promise<SharedActivitySourceRow[]> {
    const rows = await this.server.rpc<SharedActivitySourceRow[]>('server_read_shared_activity_source_v1', { p_source_kind: kind, p_source_id: sourceId });
    return Array.isArray(rows) ? rows : [];
  }
}
