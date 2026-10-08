import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** The one durable Public fact a source read names (migration 0147). */
export type PublicActivitySourceKind = 'DISCUSSION_POST' | 'RELATION_REQUEST' | 'RELATION_ACCEPTED' | 'RELATION_ENDED';

/** Exactly the 0147 server pass's row: who may be told now, and which fact it is. Never content, never the actor. */
export interface PublicActivitySourceRow {
  readonly recipient_user_id: string;
  readonly event_kind: string;
  readonly experience_id: string;
  readonly relation_id: string | null;
  readonly occurred_at: string;
}

/**
 * S5-04 — the Public Activity producer's ONE read: the server channel, one 0147 server pass. It sends the identity of one
 * durable Public fact and nothing else — no recipient, actor, Experience, display or time is ever supplied; the database
 * derives every recipient from canonical Public truth. It is not the Public Product transport (that runs on the caller's
 * own token).
 */
@Injectable()
export class PublicActivityRepository {
  constructor(private readonly server: SupabaseServiceRoleApiService) {}

  async source(kind: PublicActivitySourceKind, sourceId: string): Promise<PublicActivitySourceRow[]> {
    const rows = await this.server.rpc<PublicActivitySourceRow[]>('server_read_public_activity_source_v1', { p_source_kind: kind, p_source_id: sourceId });
    return Array.isArray(rows) ? rows : [];
  }
}
