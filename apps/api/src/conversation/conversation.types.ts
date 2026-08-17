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
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
