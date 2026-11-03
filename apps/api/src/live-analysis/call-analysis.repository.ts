// S8B-05 CP3 - the call analysis worker's ONE seam over migration 0191's service_role commands.
//
// Identity, coordinates and closed outcomes cross it; a turn's content is read only for the claimed item's own turns and
// handed straight to the establishment walk, never logged and never returned in an outcome.

import type { ConversationTurn } from '../conversation/conversation.types';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

export type CallAnalysisHalf = 'EXCHANGE' | 'USER' | 'ASSISTANT';

export type CallAnalysisClaim =
  | {
    readonly outcome: 'CLAIMED';
    readonly callId: string;
    readonly callTurnIndex: number;
    readonly half: CallAnalysisHalf;
    readonly userId: string;
    readonly turnId: string;
    readonly assistantTurnId: string | null;
    readonly attemptCount: number;
  }
  | { readonly outcome: 'IDLE' | 'BUSY' }
  | { readonly outcome: 'WAITING' | 'BUDGET_EXHAUSTED'; readonly nextAttemptAt: string | null };

export type CallAnalysisSettleOutcome = 'COMPLETE' | 'RELEASE' | 'PROVIDER_FAILURE' | 'INTEGRITY_FAILURE';

export interface CallAnalysisSettlement {
  readonly outcome: 'SETTLED' | 'ALREADY_SETTLED' | 'NOT_HOLDER' | 'NOT_FOUND';
  readonly queueState: string | null;
  readonly nextAttemptAt: string | null;
}

/** An exchange of an ENDED call left OPEN because its Safety was never stored (S3, A3.1). */
export interface UnsettledCallExchange {
  readonly userId: string;
  readonly sessionId: string;
  readonly callId: string;
  readonly callTurnIndex: number;
  readonly userTurnId: string;
  readonly content: string;
  readonly safetyDisposition: 'ALLOW' | 'GUIDED' | 'BLOCK' | null;
}

export interface CallAnalysisStore {
  listSessions(limit: number): Promise<readonly { readonly sessionId: string; readonly userId: string }[]>;
  claim(sessionId: string, claimToken: string): Promise<CallAnalysisClaim>;
  settle(input: {
    sessionId: string; callId: string; callTurnIndex: number; half: CallAnalysisHalf; claimToken: string;
    outcome: CallAnalysisSettleOutcome; failureCode: string | null;
  }): Promise<CallAnalysisSettlement>;
  readTurns(userId: string, sessionId: string, turnIds: readonly string[]): Promise<readonly ConversationTurn[]>;
  listUnsettledExchanges(limit: number): Promise<readonly UnsettledCallExchange[]>;
  readCallContext(userId: string, sessionId: string, callId: string, limit: number): Promise<unknown>;
  storeSafety(userId: string, callId: string, callTurnIndex: number, disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<string>;
  closeEndedExchange(userId: string, callId: string, callTurnIndex: number, assistantTurnId: string, eventId: string): Promise<string>;
}

const first = <T>(rows: unknown): T | undefined => (Array.isArray(rows) ? (rows[0] as T | undefined) : undefined);

interface ClaimRow {
  outcome: string; call_id: string | null; call_turn_index: number | null; half: string | null; user_id: string | null;
  turn_id: string | null; assistant_turn_id: string | null; attempt_count: number | null; next_attempt_at: string | null;
}

export class CallAnalysisRepository implements CallAnalysisStore {
  constructor(private readonly serviceApi: Pick<SupabaseServiceRoleApiService, 'rpc'>) {}

  async listSessions(limit: number): Promise<readonly { readonly sessionId: string; readonly userId: string }[]> {
    const rows = await this.serviceApi.rpc<{ session_id: string; user_id: string }[]>('server_list_call_analysis_sessions_v1', { p_limit: limit });
    return (Array.isArray(rows) ? rows : []).map((row) => ({ sessionId: row.session_id, userId: row.user_id }));
  }

  async claim(sessionId: string, claimToken: string): Promise<CallAnalysisClaim> {
    const row = first<ClaimRow>(await this.serviceApi.rpc('server_claim_call_analysis_item_v1', { p_session_id: sessionId, p_claim_token: claimToken }));
    switch (row?.outcome) {
      case 'CLAIMED':
        if (!row.call_id || row.call_turn_index === null || !row.user_id || !row.turn_id
          || (row.half !== 'EXCHANGE' && row.half !== 'USER' && row.half !== 'ASSISTANT')) break;
        return {
          outcome: 'CLAIMED', callId: row.call_id, callTurnIndex: row.call_turn_index, half: row.half, userId: row.user_id,
          turnId: row.turn_id, assistantTurnId: row.assistant_turn_id, attemptCount: row.attempt_count ?? 0,
        };
      case 'IDLE':
      case 'BUSY':
        return { outcome: row.outcome };
      case 'WAITING':
      case 'BUDGET_EXHAUSTED':
        return { outcome: row.outcome, nextAttemptAt: row.next_attempt_at };
      default:
        break;
    }
    throw new Error('The call analysis claim returned an unknown outcome.');
  }

  async settle(input: {
    sessionId: string; callId: string; callTurnIndex: number; half: CallAnalysisHalf; claimToken: string;
    outcome: CallAnalysisSettleOutcome; failureCode: string | null;
  }): Promise<CallAnalysisSettlement> {
    const row = first<{ outcome: CallAnalysisSettlement['outcome']; queue_state: string | null; next_attempt_at: string | null }>(
      await this.serviceApi.rpc('server_settle_call_analysis_item_v1', {
        p_session_id: input.sessionId, p_call_id: input.callId, p_call_turn_index: input.callTurnIndex, p_half: input.half,
        p_claim_token: input.claimToken, p_outcome: input.outcome, p_failure_code: input.failureCode,
      }),
    );
    if (!row) throw new Error('The call analysis settlement returned no row.');
    return { outcome: row.outcome, queueState: row.queue_state, nextAttemptAt: row.next_attempt_at };
  }

  async readTurns(userId: string, sessionId: string, turnIds: readonly string[]): Promise<readonly ConversationTurn[]> {
    const rows = await this.serviceApi.rpc<ConversationTurn[]>('server_read_call_analysis_turns_v1', {
      p_user_id: userId, p_session_id: sessionId, p_turn_ids: turnIds,
    });
    return Array.isArray(rows) ? rows : [];
  }

  async listUnsettledExchanges(limit: number): Promise<readonly UnsettledCallExchange[]> {
    const rows = await this.serviceApi.rpc<{
      user_id: string; session_id: string; call_id: string; call_turn_index: number; user_turn_id: string; content: string;
      safety_disposition: UnsettledCallExchange['safetyDisposition'];
    }[]>('server_list_unsettled_call_exchanges_v1', { p_limit: limit });
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      userId: row.user_id, sessionId: row.session_id, callId: row.call_id, callTurnIndex: row.call_turn_index,
      userTurnId: row.user_turn_id, content: row.content, safetyDisposition: row.safety_disposition,
    }));
  }

  readCallContext(userId: string, sessionId: string, callId: string, limit: number): Promise<unknown> {
    return this.serviceApi.rpc('server_read_call_context_v1', { p_user_id: userId, p_session_id: sessionId, p_call_id: callId, p_limit: limit });
  }

  async storeSafety(userId: string, callId: string, callTurnIndex: number, disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<string> {
    const row = first<{ outcome: string }>(await this.serviceApi.rpc('server_store_call_turn_safety_v1', {
      p_user_id: userId, p_call_id: callId, p_call_turn_index: callTurnIndex, p_safety_disposition: disposition,
    }));
    return row?.outcome ?? 'NOT_FOUND';
  }

  async closeEndedExchange(userId: string, callId: string, callTurnIndex: number, assistantTurnId: string, eventId: string): Promise<string> {
    const row = first<{ outcome: string }>(await this.serviceApi.rpc('server_close_ended_call_exchange_v1', {
      p_user_id: userId, p_call_id: callId, p_call_turn_index: callTurnIndex, p_assistant_turn_id: assistantTurnId, p_event_id: eventId,
    }));
    return row?.outcome ?? 'NOT_FOUND';
  }
}
