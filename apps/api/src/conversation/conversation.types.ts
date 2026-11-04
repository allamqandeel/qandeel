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
   * reinterpreted. Since T-03D the production path delivers the additive
   * `ConversationLiveDelivery` subtype here (current Live Focus + the LF
   * transitions of the exchange); the frozen LH fields are unchanged.
   */
  temporal?: ConversationTemporalDelivery;
}

export interface ConversationExchange {
  userTurn: ConversationTurn;
  assistantTurn: ConversationTurn;
}

/**
 * W1A-01 (E2E-B-04) — the authoritative conversation-so-far of one owned Session, as the mobile
 * Conversation surface reads it. It is raw Conversation history, never the Analysis projection.
 *
 * One exchange per COMMITTED user turn, oldest to newest. A user turn whose QANDEEL reply failed is
 * kept with `replyState: 'FAILED'` — the committed words are never silently dropped — and a turn
 * still awaiting its reply is `PENDING`. A CANCELLED turn is not part of the conversation-so-far.
 */
export type ConversationReplyState = 'COMPLETED' | 'FAILED' | 'PENDING';

export interface ConversationHistoryExchange {
  userTurn: {
    id: string;
    content: string;
    /** The caller's own submission identity, so an ambiguous send can be reconciled by reading. */
    idempotencyKey: string | null;
    createdAt: string;
  };
  replyState: ConversationReplyState;
  assistantTurn: { id: string; content: string; createdAt: string } | null;
  /** S8B-03: present only for a turn that came from a Voice Note; never a storage key or a confidence band. */
  voiceNote?: { recordingId: string; available: boolean; availableUntil: string | null; durationMs: number | null };
  /**
   * S8B-05 CP2 (CA-05-02): present only for a live call reply. The reply's content is what was heard: INTERRUPTED,
   * WITHHELD_TAIL and FAILED replies are not complete answers (an empty one is never shown as a bubble, S8B-06).
   */
  deliveryState?: 'COMPLETE' | 'INTERRUPTED' | 'WITHHELD_TAIL' | 'FAILED';
}

/**
 * S8B-06 CP3 R3 (0193): a finished call of the Session, from the server's durable call record: a call that ended after it
 * became ACTIVE. Its instants and its end reason are the server's; a call that never became ACTIVE is never one.
 */
export interface ConversationHistoryFinishedCall {
  callId: string;
  startedAt: string;
  endedAt: string;
  endReason: 'USER_ENDED' | 'PEER_LOST_AFTER_GRACE' | 'SYSTEM_INTERRUPTED' | 'FAILED' | 'SERVER_ENDED';
  /** D6 (Copy Gate, 2026-11-04): the call ended at the policy's maximum length (0193 decides it, never the reason alone). */
  atMaxLength: boolean;
}

export interface ConversationHistoryPage {
  exchanges: ConversationHistoryExchange[];
  /** True when older committed user turns exist before the first exchange of this page. */
  hasOlder: boolean;
  /**
   * S8B-06 CP3 R3 (0193): present only when the page's window holds a finished call, oldest to newest by its end. The
   * window is the page's own: from this page's oldest user turn (open when there is no older page) up to the cursor (open
   * for the newest page), so every finished call is on exactly one page, a call that left no turn included.
   */
  calls?: ConversationHistoryFinishedCall[];
}
