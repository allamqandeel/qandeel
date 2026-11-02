import type { SpeechSynthesisUsage } from '../speech-synthesis.adapter';

/**
 * S8B-04 (CP2, the Product Owner's D-S3 decision of 2026-11-01) — the durable side of an automatic voice reply: the
 * reply's stream row and one row per spoken segment (the 15-minute store), and the provider-call ledger of each attempt.
 * The database is the authority for every paid state; the service only asks. Bound to the SQL definers by
 * LiveReplyRepository; tests bind an in-memory store.
 */
export const LIVE_REPLY_STORE = Symbol('LIVE_REPLY_STORE');

export type LiveReplyState = 'STREAMING' | 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED' | 'CANCELLED';
export type LiveSegmentState = 'SYNTHESIZING' | 'READY' | 'FAILED' | 'FAILED_UNKNOWN' | 'DISCARDED';

/** How an attempt ended, for its ledger row: UNKNOWN when the provider may have produced (and billed) anything. */
export type LiveSegmentAttemptOutcome = 'FAILED' | 'CANCELLED_BEFORE_PROVIDER' | 'UNKNOWN';

export interface StoredLiveReply {
  readonly state: LiveReplyState;
  /** Known once the reply is finished: how many segments its audio has (a contiguous READY prefix). */
  readonly segmentCount: number | null;
  readonly audioMs: number | null;
  readonly assistantTurnId: string | null;
  readonly segments: readonly { readonly index: number; readonly state: LiveSegmentState }[];
}

export interface LiveReplyStore {
  /** Opens the reply's stream for a committed voice-note turn (consent, gate and ownership re-read in the database). */
  open(input: { userId: string; replyId: string; sessionId: string; sourceTurnId: string }): Promise<'OPENED' | 'REFUSED'>;
  /** ONE paid attempt: the segment SYNTHESIZING and its ledger row PENDING, in one transaction. */
  admitSegment(input: { userId: string; replyId: string; index: number; callId: string; model: string; spokenChars: number; leaseSeconds: number }): Promise<'ADMITTED' | 'BUSY' | 'GONE'>;
  /** A second attempt after a known failure before any audio (its own ledger row). */
  retrySegment(input: { userId: string; replyId: string; index: number; previousCallId: string; callId: string; model: string; leaseSeconds: number }): Promise<'RETRY_BEGUN' | 'GONE'>;
  completeSegment(input: { userId: string; callId: string; pcm: Buffer; usage: SpeechSynthesisUsage }): Promise<'READY' | 'GONE'>;
  failSegment(input: { userId: string; callId: string; outcome: LiveSegmentAttemptOutcome; final: boolean }): Promise<'RETRYABLE' | 'FAILED'>;
  finish(input: { userId: string; replyId: string; state: Exclude<LiveReplyState, 'STREAMING'>; segmentCount: number; audioMs: number; assistantTurnId: string | null }): Promise<void>;
  read(userId: string, replyId: string): Promise<StoredLiveReply | null>;
  readSegmentPcm(userId: string, replyId: string, index: number): Promise<Buffer | null>;
}
