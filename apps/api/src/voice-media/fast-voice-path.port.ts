import type { LiveTranscript } from '../voice/live-note/live-voice-note.service';
import type { LiveReplySink } from '../voice/live-reply/live-reply.service';

/**
 * S8B-04 (CP2, Fast Voice Path) — the one seam between the voice media module (which holds no provider and no AI runtime)
 * and the providers' side of the fast path, which the Voice module provides and which is resolved at call time, exactly
 * like VOICE_NOTE_TURN_RUNNER. Absent (no Voice module, or nothing configured): every upload and commit behaves exactly
 * as in S8B-03 / CP1.
 *
 *   - finishLiveNote: at Send, the transcript heard DURING the recording, finalized at once; UNUSABLE unless it is the
 *     complete final transcript of exactly this recording and qualifies by the batch rule (then the batch path runs).
 *   - discardLiveNote: the upload will not use it (a replay, a refusal): discarded and its ledger row settled now.
 *   - openReply / attachExchange: the automatic voice reply of a committed voice-note turn, and the turn's answer once
 *     the turn is done (so the phone reads the text and the final audio length from one status).
 */
export const FAST_VOICE_PATH = Symbol('FAST_VOICE_PATH');

export interface FastVoicePath {
  finishLiveNote(userId: string, liveId: string, sentChunks: number, provenDurationMs: Promise<number | null>): Promise<LiveTranscript>;
  discardLiveNote(userId: string, liveId: string): Promise<void>;
  openReply(userId: string, sessionId: string, sourceTurnId: string): Promise<LiveReplySink | undefined>;
  attachExchange(userId: string, replyId: string, exchange: unknown): void;
}
