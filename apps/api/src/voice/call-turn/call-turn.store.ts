/**
 * S8B-05 CP2 — the call turn authority's commands as the API sees them (migration 0190). The database decides every truth
 * of a spoken turn: its number, the exchange and its single open state, the stored Safety, the registered reply segments,
 * the playout mark, the one close and the delivery state. The API holds only what it needs to act. Every command but the
 * Safety store and the ledger settle carries the connection's epoch: an older connection is FENCED and changes nothing.
 */
export const CALL_TURN_STORE = Symbol('CALL_TURN_STORE');

export type CommitOutcome = 'COMMITTED' | 'ALREADY_COMMITTED' | 'FENCED' | 'NOT_FOUND' | 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED' | 'CALL_TURN_LIMIT'
  | 'UNAVAILABLE';
export type DeliveryState = 'COMPLETE' | 'INTERRUPTED' | 'WITHHELD_TAIL' | 'FAILED';
export type SafetyDisposition = 'ALLOW' | 'GUIDED' | 'BLOCK';
export type GenerationEnd = 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED';
export type CloseReason = 'PLAYED_OUT' | 'GENERATION_FAILED' | 'CALL_ENDING';

export interface CommitInput {
  readonly userId: string;
  readonly callId: string;
  readonly epoch: number;
  readonly turnId: string;
  readonly commitId: string;
  readonly content: string;
  readonly band: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly anchorStartMs: number;
  readonly anchorEndMs: number;
  readonly terms: readonly string[];
  /** The ids the previous open exchange is closed with (N1), when there is one. */
  readonly closeAssistantTurnId: string;
  readonly closeEventId: string;
}

export interface CommitResult {
  readonly outcome: CommitOutcome;
  readonly callTurnIndex: number | null;
  readonly turnId: string | null;
  /** N1: the exchange this commit closed in its own transaction, if any. */
  readonly closed: { readonly callTurnIndex: number; readonly assistantTurnId: string; readonly deliveryState: DeliveryState; readonly heardMarkMs: number } | null;
}

export interface CloseResult {
  readonly outcome: 'CLOSED' | 'ALREADY_CLOSED' | 'NOT_FOUND' | 'FENCED';
  readonly assistantTurnId: string | null;
  readonly deliveryState: DeliveryState | null;
  readonly heardMarkMs: number | null;
}

export interface PlayoutResult {
  readonly outcome: 'ADVANCED' | 'IGNORED' | 'CLOSED' | 'FENCED' | 'NOT_FOUND';
  readonly markMs: number | null;
  readonly clockStartMs: number | null;
}

export type ProviderSettleOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED_BEFORE_PROVIDER' | 'UNKNOWN';

export interface CallTurnStore {
  commit(input: CommitInput): Promise<CommitResult>;
  storeSafety(input: { userId: string; callId: string; callTurnIndex: number; disposition: SafetyDisposition }): Promise<'STORED' | 'SAME' | 'NOT_FOUND'>;
  registerSegment(input: {
    userId: string; callId: string; epoch: number; callTurnIndex: number; seq: number; text: string; startMs: number; endMs: number; terms: readonly string[];
  }): Promise<'REGISTERED' | 'CLOSED' | 'FENCED' | 'NOT_FOUND'>;
  finishGeneration(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; state: GenerationEnd; producedMs: number }): Promise<string>;
  confirmPlayout(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; playedMs: number; clockStartMs: number }): Promise<PlayoutResult>;
  close(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; reason: CloseReason; assistantTurnId: string; eventId: string }): Promise<CloseResult>;
  /** AI-COST-01: one ledger row per synthesis attempt of a call reply (on the exchange's USER turn). */
  beginSpeech(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; providerCallId: string; model: string }): Promise<string>;
  /** AI-COST-01: the call's recognition, one ledger row per recognizer session. */
  beginTranscription(input: { userId: string; callId: string; epoch: number; providerCallId: string; model: string }): Promise<string>;
  settle(input: { userId: string; providerCallId: string; outcome: ProviderSettleOutcome; completeness: 'COMPLETE' | 'INCOMPLETE' | 'ABSENT'; usage: Record<string, number> }): Promise<string>;
}
