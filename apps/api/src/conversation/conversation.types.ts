import type { ConversationTemporalDelivery } from '@qandeel/runtime';

export type SessionStatus = 'ACTIVE' | 'IDLE' | 'CLOSED' | 'EXPIRED';
export type TurnStatus =
  | 'RECEIVED' | 'VALIDATED' | 'CONTEXT_BUILDING' | 'PROCESSING' | 'GENERATING'
  | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'SUPERSEDED';

export interface ConversationSession {
  id: string;
  status: SessionStatus;
  channel: 'TEXT';
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface ConversationTurn {
  id: string;
  session_id: string;
  role: 'USER' | 'ASSISTANT';
  status: TurnStatus;
  content: string;
  processing_path: 'FAST' | 'DEEP' | null;
  routing_reason: string | null;
  source_turn_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface OrchestratedTurnResult {
  userTurn: ConversationTurn;
  assistantTurn?: ConversationTurn;
  /**
   * T-03A2: the ADDITIVE temporal delivery of a completed exchange - the
   * authoritative Live Head plus the committed-CU advancement events created or
   * replayed for it. Absent while the exchange is not a completed USER +
   * ASSISTANT pair; `userTurn` and `assistantTurn` are never removed or
   * reinterpreted. It carries no Live Focus: T-03D owns LF.
   */
  temporal?: ConversationTemporalDelivery;
}

export interface ConversationExchange {
  userTurn: ConversationTurn;
  assistantTurn: ConversationTurn;
}
