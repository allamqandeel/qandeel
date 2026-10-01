import { Injectable } from '@nestjs/common';
import type { ForegroundTurnWorkBegin } from './foreground-turn-work';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';

/**
 * PROD-SEC-02 (migration 0131): the per-user foreground work lease of one exchange.
 *
 * Server authority only - the explicit service-role channel, never a caller token. The database owns the bound,
 * the per-user lock and the lease lifetime; this class sends only the server-known identities and reads the typed
 * outcome. It carries no duration, no limit and no clock: those cannot be chosen by the application.
 */
@Injectable()
export class ConversationTurnWorkRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  /** Anything but the three known outcomes is an integrity failure, never a grant. */
  async begin(sessionId: string, userId: string, userTurnId: string): Promise<ForegroundTurnWorkBegin> {
    const rows = await this.serviceApi.rpc<Array<{ work_outcome: string; work_lease_id: string | null }>>('begin_conversation_turn_work_v1', {
      p_session_id: sessionId, p_user_id: userId, p_source_turn_id: userTurnId,
    });
    const row = rows[0];
    if (row?.work_outcome === 'GRANTED' && typeof row.work_lease_id === 'string') return { outcome: 'GRANTED', leaseId: row.work_lease_id };
    if (row?.work_outcome === 'IN_PROGRESS' || row?.work_outcome === 'LIMITED') return { outcome: row.work_outcome };
    throw new Error('TURN_WORK_OUTCOME_INTEGRITY');
  }

  /** Returns exactly the lease this request holds; a lease that already expired is simply gone. */
  async end(userId: string, userTurnId: string, leaseId: string): Promise<void> {
    await this.serviceApi.rpc('end_conversation_turn_work_v1', { p_user_id: userId, p_source_turn_id: userTurnId, p_lease_id: leaseId });
  }
}
