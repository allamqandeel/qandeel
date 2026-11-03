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
/** S8B-05 CP4 (0192, D-05-07): how a typed exchange's text reply ended (FAILED: nothing generated, no text). */
export type TextReplyState = 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED';

export interface CommitInput {
  readonly userId: string;
  readonly callId: string;
  readonly epoch: number;
  readonly turnId: string;
  readonly commitId: string;
  /** S8B-05 CP4: SPEECH (a spoken turn: band and anchor) or TEXT (TEXT_TURN, typed during the call: neither). */
  readonly channel: 'SPEECH' | 'TEXT';
  readonly content: string;
  readonly band: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  readonly anchorStartMs: number | null;
  readonly anchorEndMs: number | null;
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

/** S8B-05 CP4 (0192, P4): a BARGE_IN's onset, the first one kept while the exchange is open; late (CLOSED) after it. */
export interface BargeInResult {
  readonly outcome: 'RECORDED' | 'ALREADY_RECORDED' | 'CLOSED' | 'FENCED' | 'NOT_FOUND';
  readonly captureMs: number | null;
}

/** S8B-05 CP4 (0192, P5): the call's open exchange as the connection now holding the call finds it. */
export interface OpenExchange {
  readonly outcome: 'OPEN' | 'NONE' | 'FENCED' | 'NOT_FOUND';
  readonly callTurnIndex: number | null;
  readonly userTurnId: string | null;
  readonly content: string | null;
  readonly channel: 'SPEECH' | 'TEXT' | null;
  readonly safety: SafetyDisposition | null;
}

export type ProviderSettleOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED_BEFORE_PROVIDER' | 'UNKNOWN';

export interface CallTurnStore {
  commit(input: CommitInput): Promise<CommitResult>;
  storeSafety(input: { userId: string; callId: string; callTurnIndex: number; disposition: SafetyDisposition }): Promise<'STORED' | 'SAME' | 'NOT_FOUND'>;
  registerSegment(input: {
    userId: string; callId: string; epoch: number; callTurnIndex: number; seq: number; text: string; startMs: number; endMs: number; terms: readonly string[];
  }): Promise<'REGISTERED' | 'CLOSED' | 'FENCED' | 'NOT_FOUND'>;
  finishGeneration(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; state: GenerationEnd; producedMs: number }): Promise<string>;
  /** `clockStartMs` null: the reply's clock start is already stored (a confirmation resent to a newer connection, P5). */
  confirmPlayout(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; playedMs: number; clockStartMs: number | null }): Promise<PlayoutResult>;
  close(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; reason: CloseReason; assistantTurnId: string; eventId: string }): Promise<CloseResult>;
  /** S8B-05 CP4 (0192, P4): the onset of the person's speech that stopped QANDEEL; closes nothing. */
  recordBargeIn(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; captureMs: number }): Promise<BargeInResult>;
  /**
   * S8B-05 CP4 (0192, D-05-07): the close of a typed exchange by its text reply, through the ONE close (the first close
   * wins). Not fenced by the epoch: the text reply is the conversation's, whatever became of the connection.
   */
  closeText(input: {
    userId: string; callId: string; callTurnIndex: number; state: TextReplyState; text: string; terms: readonly string[]; assistantTurnId: string; eventId: string;
  }): Promise<CloseResult>;
  /** S8B-05 CP4 (0192, P5): the open exchange an older connection left, for the connection now holding the call. */
  readOpenExchange(input: { userId: string; callId: string; epoch: number }): Promise<OpenExchange>;
  /** AI-COST-01: one ledger row per synthesis attempt of a call reply (on the exchange's USER turn). */
  beginSpeech(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; providerCallId: string; model: string }): Promise<string>;
  /** AI-COST-01: the call's recognition, one ledger row per recognizer session. */
  beginTranscription(input: { userId: string; callId: string; epoch: number; providerCallId: string; model: string }): Promise<string>;
  settle(input: { userId: string; providerCallId: string; outcome: ProviderSettleOutcome; completeness: 'COMPLETE' | 'INCOMPLETE' | 'ABSENT'; usage: Record<string, number> }): Promise<string>;
}
