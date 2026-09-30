import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ConversationExchange, ConversationSession, ConversationTurn } from './conversation.types';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';
import { CorrelationService } from '../observability/correlation.service';
import type { RuntimeRoutePair } from '../intelligence-runtime/fast-deep-routing-contract';
import { MEMORY_CONTROL_OUTCOMES, type MemoryControlOutcome, type MemoryControlPlan } from '../memory/memory-control.types';

const SESSION_FIELDS = 'id,status,channel,created_at,updated_at,last_activity_at,closed_at';
const TURN_FIELDS = 'id,session_id,role,status,content,processing_path,routing_reason,source_turn_id,idempotency_key,created_at,updated_at,completed_at';

@Injectable()
export class ConversationRepository {
  constructor(
    private readonly dataApi: SupabaseDataApiService,
    private readonly serviceApi: SupabaseServiceRoleApiService,
    private readonly correlation:CorrelationService,
  ) {}

  // Session creation runs through the narrow authenticated definer command
  // (migration 0030), never a direct table write. The caller supplies only the
  // server-generated session UUID; owner identity is derived from auth.uid()
  // and status, channel, timestamps, and closed_at are forced server-side to
  // the canonical ACTIVE/TEXT creation shape.
  async createSession(accessToken: string, id: string): Promise<ConversationSession> {
    const rows = await this.dataApi.request<ConversationSession[]>(accessToken, 'rpc/create_conversation_session_v1', {
      method: 'POST',
      body: JSON.stringify({ p_id: id }),
    });
    return rows[0];
  }

  async findSession(accessToken: string, id: string, userId: string): Promise<ConversationSession | undefined> {
    const query = new URLSearchParams({ select: SESSION_FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    const rows = await this.dataApi.request<ConversationSession[]>(accessToken, `conversation_sessions?${query}`);
    return rows[0];
  }

  // User-authored turn creation runs through the narrow authenticated definer
  // command. The caller supplies only id/session/content/idempotency key; role,
  // status, user identity, and every server-owned column are forced server-side
  // (identity from auth.uid()). The unique-idempotency 409 path is preserved.
  async createTurn(accessToken: string, input: { id: string; sessionId: string; userId: string; content: string; idempotencyKey?: string }): Promise<ConversationTurn> {
    const rows = await this.dataApi.request<ConversationTurn[]>(accessToken, 'rpc/create_user_conversation_turn', {
      method: 'POST',
      body: JSON.stringify({
        p_id: input.id, p_session_id: input.sessionId, p_content: input.content,
        p_idempotency_key: input.idempotencyKey ?? null,
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

  async findRecentAuthoritativeExchanges(
    accessToken: string,
    sessionId: string,
    userId: string,
    sourceTurnId: string,
    limit: number,
  ): Promise<ConversationExchange[]> {
    const assistantQuery = new URLSearchParams({
      select: TURN_FIELDS,
      session_id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      source_turn_id: `not.eq.${sourceTurnId}`,
      status: 'eq.COMPLETED',
      role: 'eq.ASSISTANT',
      order: 'created_at.desc,id.desc',
      limit: String(limit),
    });
    const assistants = await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${assistantQuery}`);
    if (assistants.length === 0) return [];

    const sourceIds = assistants.map(({ source_turn_id: sourceTurn }) => sourceTurn).filter((id): id is string => id !== null);
    if (sourceIds.length === 0) return [];
    const userQuery = new URLSearchParams({
      select: TURN_FIELDS,
      session_id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      id: `in.(${sourceIds.join(',')})`,
      status: 'eq.COMPLETED',
      role: 'eq.USER',
    });
    const users = await this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${userQuery}`);
    const usersById = new Map(users.map((turn) => [turn.id, turn]));

    return assistants.flatMap((assistantTurn) => {
      const userTurn = assistantTurn.source_turn_id ? usersById.get(assistantTurn.source_turn_id) : undefined;
      return userTurn ? [{ userTurn, assistantTurn }] : [];
    });
  }

  /**
   * W1A-01 (E2E-B-04): one page of the Session's committed USER turns, newest first, read with the
   * CALLER's token so row-level security (`conversation_turns_select_own`) and the explicit owner
   * filter both apply. `before` is the exclusive `(created_at, id)` cursor of the oldest turn the
   * caller already holds; the order matches the existing `(session_id, created_at, id)` index.
   * CANCELLED and the unused lifecycle states are not part of the conversation-so-far.
   */
  async findUserTurnsPage(
    accessToken: string,
    sessionId: string,
    userId: string,
    limit: number,
    before?: { createdAt: string; id: string },
  ): Promise<ConversationTurn[]> {
    const query = new URLSearchParams({
      select: TURN_FIELDS,
      session_id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      role: 'eq.USER',
      status: 'in.(RECEIVED,GENERATING,COMPLETED,FAILED)',
      order: 'created_at.desc,id.desc',
      limit: String(limit),
    });
    if (before) {
      query.set('or', `(created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id}))`);
    }
    return this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`);
  }

  /** W1A-01: the COMPLETED QANDEEL replies of the given source USER turns, under the same scope. */
  async findCompletedAssistantsForSources(
    accessToken: string,
    sessionId: string,
    userId: string,
    sourceTurnIds: readonly string[],
  ): Promise<ConversationTurn[]> {
    if (sourceTurnIds.length === 0) return [];
    const query = new URLSearchParams({
      select: TURN_FIELDS,
      session_id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      role: 'eq.ASSISTANT',
      status: 'eq.COMPLETED',
      source_turn_id: `in.(${sourceTurnIds.join(',')})`,
    });
    return this.dataApi.request<ConversationTurn[]>(accessToken, `conversation_turns?${query}`);
  }

  // Claim / finalize / fail are server authority. They run through the explicit
  // service-role channel — never a caller-supplied user token — and each definer
  // command still validates session/source ownership, role, and state.
  // QIR-002: the claim boundary accepts only a legal CURRENT (v2) route pair.
  // The retired reasons are unrepresentable here at compile time, and migration
  // 0062 enforces the same rule as the server-authoritative claim gate.
  async claimTurn(sessionId: string, userId: string, turnId: string, selection: RuntimeRoutePair): Promise<ConversationTurn | undefined> {
    const rows = await this.serviceApi.rpc<ConversationTurn[]>('claim_conversation_turn', {
      p_session_id: sessionId, p_user_id: userId, p_source_turn_id: turnId,
      p_processing_path: selection.path, p_routing_reason: selection.reason,
    });
    return rows[0];
  }

  // QIR-006: finalization runs through the versioned migration-0063 authority.
  // When the sanitized QuestionContext actually survived final provider-request
  // assembly, the SELECTED reservation identity travels here and is marked
  // BOUND atomically with assistant insertion + user completion + outbox
  // publication. Without it, no reservation can be BOUND, and the one
  // database-owned terminal mechanism retires any reservation still SELECTED
  // for the turn inside the same transaction.
  async finalizeTurn(input: { sessionId: string; userId: string; sourceTurnId: string; assistantTurnId: string; content: string; safetyDisposition:'ALLOW'|'GUIDED'|'BLOCK'; questionBindingId?: string }): Promise<{ userTurn: ConversationTurn; assistantTurn: ConversationTurn } | undefined> {
    const rows = await this.serviceApi.rpc<Array<{ user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>('finalize_conversation_turn_v2', {
      p_session_id: input.sessionId, p_user_id: input.userId, p_source_turn_id: input.sourceTurnId, p_assistant_turn_id: input.assistantTurnId, p_content: input.content, p_safety_disposition: input.safetyDisposition, p_question_binding_id: input.questionBindingId ?? null, ...this.eventMetadata(),
    });
    return rows[0] ? { userTurn: rows[0].user_turn, assistantTurn: rows[0].assistant_turn } : undefined;
  }

  // W3-MEGA-M (E2E-D-13): the Memory-control finalization authority (migration 0128). In ONE transaction the database
  // locks this GENERATING turn, re-validates the target Memory under its row lock, applies the change through the
  // narrow Memory commands, records the command and finalizes through finalize_conversation_turn_v2 with the reply
  // for the outcome it actually committed. Server authority only; a turn that is no longer GENERATING writes nothing.
  async finalizeMemoryControlTurn(input: { sessionId: string; userId: string; sourceTurnId: string; assistantTurnId: string; plan: MemoryControlPlan }): Promise<{ outcome: MemoryControlOutcome; userTurn: ConversationTurn; assistantTurn: ConversationTurn } | undefined> {
    const { plan } = input;
    const rows = await this.serviceApi.rpc<Array<{ outcome: MemoryControlOutcome; user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>('server_finalize_memory_control_turn_v1', {
      p_session_id: input.sessionId, p_user_id: input.userId, p_source_turn_id: input.sourceTurnId, p_assistant_turn_id: input.assistantTurnId,
      p_kind: plan.kind, p_outcome: plan.outcome,
      p_target_memory_id: plan.targetMemoryId ?? null, p_new_memory_id: plan.newMemory?.id ?? null,
      p_type: plan.newMemory?.type ?? null, p_content: plan.newMemory?.content ?? null,
      p_confidence: plan.newMemory?.confidence ?? null, p_importance: plan.newMemory?.importance ?? null,
      p_expires_at: plan.newMemory?.expiresAt ?? null,
      p_candidate_memory_ids: [...plan.candidateMemoryIds], p_answers_command_id: plan.answersCommandId ?? null,
      p_reply: plan.reply, p_reply_if_changed: plan.replyIfChanged ?? null,
      ...this.eventMetadata(),
    });
    const row = rows[0];
    if (!row) return undefined;
    if (!MEMORY_CONTROL_OUTCOMES.has(row.outcome)) throw new Error('MEMORY_CONTROL_OUTCOME_INTEGRITY');
    return { outcome: row.outcome, userTurn: row.user_turn, assistantTurn: row.assistant_turn };
  }

  async failTurn(sessionId: string, userId: string, turnId: string): Promise<void> {
    await this.serviceApi.rpc('fail_conversation_turn', { p_session_id: sessionId, p_user_id: userId, p_source_turn_id: turnId, ...this.eventMetadata() });
  }

  // Bounded fail-closed recovery of an abandoned GENERATING turn (migration
  // 0039). Server authority only — never a caller token. The database alone
  // owns the frozen expiry policy; this method sends no timing value, replays
  // no generation, and returns the recovered FAILED turn only when the
  // canonical command actually terminalized an expired generation claim.
  async recoverExpiredGeneratingTurn(sessionId: string, userId: string, turnId: string): Promise<ConversationTurn | undefined> {
    const rows = await this.serviceApi.rpc<ConversationTurn[]>('recover_expired_generating_conversation_turn_v1', {
      p_session_id: sessionId, p_user_id: userId, p_source_turn_id: turnId, ...this.eventMetadata(),
    });
    return rows[0];
  }

  async cancelTurn(accessToken: string, sessionId: string, turnId: string, userId: string): Promise<ConversationTurn | undefined> {
    const rows=await this.dataApi.request<ConversationTurn[]>(accessToken,'rpc/cancel_conversation_turn',{method:'POST',body:JSON.stringify({p_session_id:sessionId,p_user_id:userId,p_source_turn_id:turnId,...this.eventMetadata()})});
    return rows[0];
  }

  private eventMetadata():{p_event_id:string;p_correlation_id:string|null;p_orchestration_id:string|null}{const current=this.correlation.current();return{p_event_id:randomUUID(),p_correlation_id:current?.request_id??null,p_orchestration_id:current?.orchestration_id??null};}
}
