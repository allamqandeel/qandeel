import type { RefusalReason, ServerMessage } from './live-call.protocol';

/**
 * S8B-05 CP1 / CP2 — where a live call's decoded uplink goes: PCM s16le mono 16 kHz, the recognizer's input (D-C1), in capture
 * order, and where the phone's PLAYOUT confirmations go.
 *
 * CP1 bound the null sink below: it kept nothing and sent nothing anywhere. CP2 binds the call turn engine
 * (`voice/call-turn/`) here when a realtime recognizer and the conversation are composed: endpointing, the committed user
 * turn, QANDEEL's spoken reply (REPLY_AUDIO) and the playout truth. This directory stays provider-free: the engine reaches
 * the socket, the tracks and the connection's identity only through the channel below.
 */
export const LIVE_CALL_SPEECH_SINK = Symbol('LIVE_CALL_SPEECH_SINK');

/** One reply packet towards the phone (REPLY_AUDIO, Opus 24 kHz, 20 ms). */
export interface ReplyAudioPacket {
  readonly callTurnIndex: number;
  readonly chunkSeq: number;
  readonly offsetMs: number;
  readonly packet: Buffer;
}

/** The connection's side of a call turn engine: its identity, its socket and its two recording tracks. */
export interface LiveCallTurnChannel {
  readonly userId: string;
  readonly callId: string;
  readonly sessionId: string;
  readonly epoch: number;
  /** The person's current access token (refreshed by TOKEN_REFRESH): owner-scoped reads only, never logged. */
  accessToken(): string;
  /** The capture instant of the latest uplink packet received (the call's clock). */
  latestCaptureMs(): number;
  /** Writes what the USER track has taken and answers its durable end; null when the track can no longer be written. */
  settleUserTrack(): Promise<number | null>;
  /** The QANDEEL track's accepted end (the next confirmed packet's clock instant). */
  qandeelEndMs(): number;
  /** A NOT_SPEAKING gap on the QANDEEL track up to `endMs`. */
  qandeelSilence(endMs: number): void;
  /** One confirmed reply packet on the QANDEEL track at `clockMs` (contiguous with what it holds). */
  qandeelAppend(packet: Buffer, clockMs: number): void;
  /** Writes what the QANDEEL track has taken and answers its durable end; null when it can no longer be written. */
  settleQandeelTrack(): Promise<number | null>;
  send(message: ServerMessage): void;
  sendReplyAudio(packet: ReplyAudioPacket): void;
}

/** A PLAYOUT the engine judged: APPLIED, IGNORED (older, duplicate or after the close: P1 / P3), or a VIOLATION. */
export type PlayoutVerdict = 'APPLIED' | 'IGNORED' | 'VIOLATION';

/** S8B-05 CP4: a TEXT_TURN's outcome: its USER turn committed (once, by its clientTurnId), or refused with a reason. */
export type TextTurnVerdict = { readonly kind: 'COMMITTED' } | { readonly kind: 'REFUSED'; readonly reason: RefusalReason };

export interface LiveCallSpeechStream {
  /** One decoded 20 ms frame at its capture instant. Never awaited on the audio path. */
  push(pcm16k: Buffer, captureMs: number): void;
  /** A PLAYOUT confirmation of the reply `callTurnIndex` (CP2). */
  playout(input: { readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }): Promise<PlayoutVerdict>;
  /** S8B-05 CP4 (P4): the person began to speak over QANDEEL's reply `callTurnIndex` at `captureMs` (the call's clock). */
  bargeIn(input: { readonly callTurnIndex: number; readonly captureMs: number }): Promise<'APPLIED' | 'IGNORED'>;
  /** S8B-05 CP4 (D-05-07, P4): a message typed during the call; settles once its USER turn is committed, or refused. */
  textTurn(input: { readonly clientTurnId: string; readonly text: string }): Promise<TextTurnVerdict>;
  /**
   * S8B-05 CP4: the connection is going (not ended): what the person said is committed while the connection still holds
   * the call, before its tracks close (no lost words); bounded in time. Then `close`.
   */
  drain(): Promise<void>;
  close(): void;
}

export interface LiveCallSpeechSink {
  open(channel: LiveCallTurnChannel): LiveCallSpeechStream;
}

/** No engine composed: the decoded audio stops here and a PLAYOUT has nothing to confirm. */
export const NULL_LIVE_CALL_SPEECH_SINK: LiveCallSpeechSink = Object.freeze({
  open: (): LiveCallSpeechStream => ({
    push: () => undefined, playout: async () => 'IGNORED' as const, bargeIn: async () => 'IGNORED' as const,
    textTurn: async () => ({ kind: 'REFUSED' as const, reason: 'UNAVAILABLE' as const }), drain: async () => undefined, close: () => undefined,
  }),
});
