import { Injectable } from '@nestjs/common';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { SupabaseDataApiService } from './supabase-data-api.service';

const SESSION_FIELDS = 'id,status,channel,created_at,updated_at,last_activity_at,closed_at';
const TURN_FIELDS = 'id,session_id,role,status,content,processing_path,routing_reason,source_turn_id,idempotency_key,created_at,updated_at,completed_at';

@Injectable()
export class ConversationRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  async createSession(accessToken: string, id: string, userId: string): Promise<ConversationSession> {
    const rows = await this.dataApi.request<ConversationSession[]>(accessToken, 'conversation_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id, user_id: userId, status: 'ACTIVE', channel: 'TEXT' }),
    });
    return rows[0];
  }

  async findSession(accessToken: string, id: string, userId: string): Promise<ConversationSession | undefined> {
    const query = new URLSearchParams({ select: SESSION_FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    const rows = await this.dataApi.request<ConversationSession[]>(accessToken, `conversation_sessions?${query}`);
    return rows[0];
  }

  async createTurn(accessToken: string, input: { id: string; sessionId: string; userId: string; content: string; idempotencyKey?: string }): Promise<ConversationTurn> {
    const rows = await this.dataApi.request<ConversationTurn[]>(accessToken, 'conversation_turns', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: input.id, session_id: input.sessionId, user_id: input.userId,
        role: 'USER', status: 'RECEIVED', content: input.content,
        idempotency_key: input.idempotencyKey ?? null,
      }),
    });
    return rows[0];
  }

  async findTurnByIdempotencyKey(accessToken: string, sessionId: string, userId: string, key: string): Promise<ConversationTurn | undefined> {
    const query = new URLSearchParams({
      select: TURN_FIELDS, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`,
      idempotency_key: `eq.${key}`, limit: '1',
    });
    const rows = await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`);
    return rows[0];
  }

  async findTurn(accessToken: string, sessionId: string, userId: string, turnId: string): Promise<ConversationTurn | undefined> {
    const query = new URLSearchParams({ select: TURN_FIELDS, id: `eq.${turnId}`, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`, limit: '1' });
    return (await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`))[0];
  }

  async findAssistantForSource(accessToken: string, sessionId: string, userId: string, sourceTurnId: string): Promise<ConversationTurn | undefined> {
    const query = new URLSearchParams({ select: TURN_FIELDS, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`, source_turn_id: `eq.${sourceTurnId}`, role: 'eq.ASSISTANT', limit: '1' });
    return (await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`))[0];
  }

  async claimTurn(accessToken: string, sessionId: string, userId: string, turnId: string, selection: { path: 'FAST' | 'DEEP'; reason: string }): Promise<ConversationTurn | undefined> {
    const query = new URLSearchParams({ select: TURN_FIELDS, id: `eq.${turnId}`, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`, status: 'eq.RECEIVED' });
    const rows = await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'GENERATING', processing_path: selection.path, routing_reason: selection.reason }),
    });
    return rows[0];
  }

  async finalizeTurn(accessToken: string, input: { sessionId: string; userId: string; sourceTurnId: string; assistantTurnId: string; content: string }): Promise<{ userTurn: ConversationTurn; assistantTurn: ConversationTurn } | undefined> {
    const rows = await this.dataApi.request<Array<{ user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>(accessToken, 'rpc/finalize_conversation_turn', {
      method: 'POST',
      body: JSON.stringify({ p_session_id: input.sessionId, p_user_id: input.userId, p_source_turn_id: input.sourceTurnId, p_assistant_turn_id: input.assistantTurnId, p_content: input.content }),
    });
    return rows[0] ? { userTurn: rows[0].user_turn, assistantTurn: rows[0].assistant_turn } : undefined;
  }

  async failTurn(accessToken: string, sessionId: string, userId: string, turnId: string): Promise<void> {
    const query = new URLSearchParams({ id: `eq.${turnId}`, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`, status: 'eq.GENERATING' });
    await this.dataApi.request(accessToken, `conversation_turns?${query}`, { method: 'PATCH', body: JSON.stringify({ status: 'FAILED' }) });
  }

  async cancelTurn(accessToken: string, sessionId: string, turnId: string, userId: string): Promise<ConversationTurn | undefined> {
    const query = new URLSearchParams({
      select: TURN_FIELDS, id: `eq.${turnId}`, session_id: `eq.${sessionId}`, user_id: `eq.${userId}`,
      status: 'in.(RECEIVED,VALIDATED,CONTEXT_BUILDING,PROCESSING,GENERATING,STREAMING)',
    });
    const rows = await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'CANCELLED' }),
    });
    return rows[0];
  }
}
