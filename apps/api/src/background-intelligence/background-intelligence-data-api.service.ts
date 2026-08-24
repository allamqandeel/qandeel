import { Injectable } from '@nestjs/common';
import type { SessionStatus, TurnStatus } from '../conversation/conversation.types';
import type { MemoryRecord, MemorySource, MemoryStatus, MemoryType } from '../memory/memory.types';
import {
  type BackgroundIntelligenceEventContext,
  type BackgroundIntelligenceExecutionContext,
  isBackgroundIntelligenceEventContext,
  isBackgroundIntelligenceExecutionContext,
} from './background-intelligence-context.factory';

const SESSION_FIELDS = 'id,status,channel';
const TURN_FIELDS = 'id,session_id,role,status,source_turn_id';

export interface BackgroundConversationSessionState { readonly id: string; readonly status: SessionStatus; readonly channel: 'TEXT'; }
export interface BackgroundConversationTurnState { readonly id: string; readonly session_id: string; readonly role: 'USER' | 'ASSISTANT'; readonly status: TurnStatus; readonly source_turn_id: string | null; }

export interface BackgroundMemoryCreateInput {
  readonly id: string;
  readonly type: MemoryType;
  readonly content: string;
  readonly source: MemorySource;
  readonly confidence: number;
  readonly importance: number;
  readonly status: MemoryStatus;
  readonly expiresAt?: string;
}

@Injectable()
export class BackgroundIntelligenceDataApiService {
  async findSession(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationSessionState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: SESSION_FIELDS, id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, limit: '1' });
    return (await this.request<BackgroundConversationSessionState[]>(`conversation_sessions?${query}`))[0];
  }

  async findSourceTurn(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: TURN_FIELDS, id: `eq.${context.sourceTurnId}`, session_id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, limit: '1' });
    return (await this.request<BackgroundConversationTurnState[]>(`conversation_turns?${query}`))[0];
  }

  async findCompletedAssistant(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: TURN_FIELDS, source_turn_id: `eq.${context.sourceTurnId}`, session_id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, role: 'eq.ASSISTANT', status: 'eq.COMPLETED', limit: '1' });
    return (await this.request<BackgroundConversationTurnState[]>(`conversation_turns?${query}`))[0];
  }

  async createMemory(context: BackgroundIntelligenceExecutionContext, input: BackgroundMemoryCreateInput): Promise<MemoryRecord> {
    this.assertExecutionContext(context);
    const rows = await this.request<MemoryRecord[]>('memories', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: input.id,
        user_id: context.userId,
        scope: 'USER',
        type: input.type,
        content: input.content,
        source: input.source,
        confidence: input.confidence,
        importance: input.importance,
        status: input.status,
        expires_at: input.expiresAt ?? null,
      }),
    });
    return rows[0];
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_DISABLED');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...init,
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
    }
    if (!response.ok) throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private assertOwnershipContext(context: BackgroundIntelligenceEventContext): void {
    if (!isBackgroundIntelligenceEventContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_REQUIRED');
  }

  private assertExecutionContext(context: BackgroundIntelligenceExecutionContext): void {
    if (!isBackgroundIntelligenceExecutionContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
  }
}
