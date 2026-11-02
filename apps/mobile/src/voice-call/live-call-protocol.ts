/**
 * S8B-06 CP1 — the phone's statement of the frozen Live Call protocol v1 (`qandeel.live-call.v1`).
 *
 * The protocol is FROZEN by S8B-05 CP1: `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md` and its code statement
 * `apps/api/src/voice/call/live-call.protocol.ts`. This file restates, for the phone, exactly what those two say — the same
 * constants, the same 20-byte binary header, the same exact-key messages — and invents nothing. It is pure (no React
 * Native, no I/O, no clock), so `tests/s8b-06-native-audio-engine-contract.test.mjs` can load it next to the server's file
 * and prove the two agree byte for byte. A difference is a defect here, never a protocol change.
 *
 * What the phone sends: HELLO, AUDIO (binary), PLAYOUT, BARGE_IN, TEXT_TURN, MUTE, UNMUTE, TOKEN_REFRESH, HEARTBEAT, END.
 * What it receives: STATE, ACK, REFUSED, CALL_ENDING, TURN_COMMITTED, REPLY_END and REPLY_AUDIO (binary).
 * PLAYOUT carries `msgId, callTurnIndex, chunkSeq, playedMs`; BARGE_IN carries `msgId, callTurnIndex, captureMs`. The
 * connection epoch travels in the binary frames only; there is no turn epoch field anywhere in v1.
 */

export const LIVE_CALL_PROTOCOL = 'qandeel.live-call.v1';
export const LIVE_CALL_PATH = '/voice/calls/connect';
export const LIVE_CALL_PROTOCOL_VERSION = 1;

export const AUDIO_FRAME_KIND = 0x01;
export const REPLY_AUDIO_FRAME_KIND = 0x02;
export const FRAME_HEADER_BYTES = 20;
export const MAX_OPUS_PACKET_BYTES = 1275;
export const MAX_BINARY_FRAME_BYTES = FRAME_HEADER_BYTES + MAX_OPUS_PACKET_BYTES;
export const MAX_TEXT_FRAME_BYTES = 4096;
export const AUDIO_PACKET_MS = 20;

/** The limits both ends keep (frozen v1 values). */
export const LIVE_CALL_LIMITS = Object.freeze({
  heartbeatIntervalMs: 1000,
  silenceTimeoutMs: 3000,
  leaseRenewalMs: 5000,
  resendBufferMs: 2000,
  framesPerSecond: 100,
  frameBurst: 150,
  controlPerSecond: 20,
  maxPendingAudioBytes: 512 * 1024,
  maxOutboundBufferBytes: 1024 * 1024,
  segmentTargetMs: 10_000,
  tokenFallbackLifetimeMs: 10 * 60_000,
  callEndingNoticeMs: [5 * 60_000, 60_000] as const,
});

export const LIVE_CALL_CLOSE = Object.freeze({
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  TOO_BIG: 1009,
  TOKEN: 4001,
  PROTOCOL_VIOLATION: 4002,
  FENCED: 4003,
  REFUSED: 4004,
  OVERLOADED: 4005,
  SILENCE: 4008,
});

export type CallState = 'CONNECTING' | 'ACTIVE' | 'RECONNECTING' | 'ENDED';
export type CallEndReason = 'USER_ENDED' | 'PEER_LOST_AFTER_GRACE' | 'SYSTEM_INTERRUPTED' | 'FAILED' | 'SERVER_ENDED';
export type RefusalReason =
  | 'PROTOCOL_VIOLATION' | 'NOT_SUPPORTED_YET' | 'CONSENT_REQUIRED' | 'NOT_AVAILABLE_NOW' | 'CAPACITY_FULL' | 'ALREADY_IN_CALL'
  | 'SESSION_NOT_ACTIVE' | 'NOT_FOUND' | 'OTHER_DEVICE' | 'FENCED' | 'TOKEN_INVALID' | 'OVERLOADED' | 'COMMAND_CONFLICT'
  | 'UNAVAILABLE';
export type ReplyDeliveryState = 'COMPLETE' | 'INTERRUPTED' | 'WITHHELD_TAIL' | 'FAILED';

const CALL_STATES: ReadonlySet<string> = new Set(['CONNECTING', 'ACTIVE', 'RECONNECTING', 'ENDED']);
const END_REASONS: ReadonlySet<string> = new Set(['USER_ENDED', 'PEER_LOST_AFTER_GRACE', 'SYSTEM_INTERRUPTED', 'FAILED', 'SERVER_ENDED']);
const REFUSALS: ReadonlySet<string> = new Set([
  'PROTOCOL_VIOLATION', 'NOT_SUPPORTED_YET', 'CONSENT_REQUIRED', 'NOT_AVAILABLE_NOW', 'CAPACITY_FULL', 'ALREADY_IN_CALL',
  'SESSION_NOT_ACTIVE', 'NOT_FOUND', 'OTHER_DEVICE', 'FENCED', 'TOKEN_INVALID', 'OVERLOADED', 'COMMAND_CONFLICT', 'UNAVAILABLE',
]);
const DELIVERY_STATES: ReadonlySet<string> = new Set(['COMPLETE', 'INTERRUPTED', 'WITHHELD_TAIL', 'FAILED']);

// ------------------------------------------------------------------ phone → server (text)
export type ClientMessage =
  | { readonly type: 'HELLO'; readonly v: 1; readonly callId: string; readonly sessionId: string; readonly clientInstanceId: string; readonly resume: boolean }
  | { readonly type: 'HEARTBEAT'; readonly n: number }
  | { readonly type: 'MUTE'; readonly msgId: number; readonly captureMs: number }
  | { readonly type: 'UNMUTE'; readonly msgId: number; readonly captureMs: number }
  | { readonly type: 'TOKEN_REFRESH'; readonly msgId: number; readonly accessToken: string }
  | { readonly type: 'END'; readonly msgId: number }
  | { readonly type: 'PLAYOUT'; readonly msgId: number; readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }
  | { readonly type: 'BARGE_IN'; readonly msgId: number; readonly callTurnIndex: number; readonly captureMs: number }
  | { readonly type: 'TEXT_TURN'; readonly msgId: number; readonly clientTurnId: string; readonly text: string };

/**
 * Serializes one phone message with exactly the frozen keys, in the frozen order. The values are written as given; the
 * client never builds one with a value the server's parser would refuse (`isValidClientMessage` is the same rule).
 */
export function encodeClientMessage(message: ClientMessage): string {
  switch (message.type) {
    case 'HELLO':
      return JSON.stringify({ type: 'HELLO', v: 1, callId: message.callId, sessionId: message.sessionId, clientInstanceId: message.clientInstanceId, resume: message.resume });
    case 'HEARTBEAT':
      return JSON.stringify({ type: 'HEARTBEAT', n: message.n });
    case 'MUTE':
    case 'UNMUTE':
      return JSON.stringify({ type: message.type, msgId: message.msgId, captureMs: message.captureMs });
    case 'TOKEN_REFRESH':
      return JSON.stringify({ type: 'TOKEN_REFRESH', msgId: message.msgId, accessToken: message.accessToken });
    case 'END':
      return JSON.stringify({ type: 'END', msgId: message.msgId });
    case 'PLAYOUT':
      return JSON.stringify({ type: 'PLAYOUT', msgId: message.msgId, callTurnIndex: message.callTurnIndex, chunkSeq: message.chunkSeq, playedMs: message.playedMs });
    case 'BARGE_IN':
      return JSON.stringify({ type: 'BARGE_IN', msgId: message.msgId, callTurnIndex: message.callTurnIndex, captureMs: message.captureMs });
    case 'TEXT_TURN':
      return JSON.stringify({ type: 'TEXT_TURN', msgId: message.msgId, clientTurnId: message.clientTurnId, text: message.text });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_U32 = 0xffff_ffff;
export const isU32 = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_U32;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
export const isCaptureMs = (value: unknown): value is number => isU32(value) && value % AUDIO_PACKET_MS === 0;

/** The server's acceptance rule for a phone message, restated (the contract test compares it with the server's parser). */
export function isValidClientMessage(message: ClientMessage): boolean {
  switch (message.type) {
    case 'HELLO':
      return isUuid(message.callId) && isUuid(message.sessionId) && isUuid(message.clientInstanceId) && typeof message.resume === 'boolean';
    case 'HEARTBEAT':
      return isU32(message.n);
    case 'MUTE':
    case 'UNMUTE':
      return isU32(message.msgId) && isCaptureMs(message.captureMs);
    case 'TOKEN_REFRESH':
      return isU32(message.msgId) && message.accessToken.length > 0 && message.accessToken.length <= 3500 && !/\s/u.test(message.accessToken);
    case 'END':
      return isU32(message.msgId);
    case 'PLAYOUT':
      return isU32(message.msgId) && isU32(message.callTurnIndex) && isU32(message.chunkSeq) && isU32(message.playedMs);
    case 'BARGE_IN':
      return isU32(message.msgId) && isU32(message.callTurnIndex) && isCaptureMs(message.captureMs);
    case 'TEXT_TURN':
      return isU32(message.msgId) && isUuid(message.clientTurnId) && message.text.trim().length > 0 && message.text.length <= 2000;
  }
}

// ------------------------------------------------------------------ server → phone (text)
export type ServerMessage =
  | {
    readonly type: 'STATE'; readonly callId: string; readonly state: CallState; readonly epoch: number | null;
    readonly startedAt: string | null; readonly resumeFromCaptureMs: number | null; readonly lastMsgId: number;
    readonly endsAt: string | null; readonly endReason: CallEndReason | null; readonly heartbeatMs: number;
  }
  | { readonly type: 'ACK'; readonly msgId: number }
  | { readonly type: 'REFUSED'; readonly reason: RefusalReason; readonly msgId: number | null }
  | { readonly type: 'CALL_ENDING'; readonly endsInMs: number }
  | { readonly type: 'TURN_COMMITTED'; readonly callTurnIndex: number; readonly role: 'USER' | 'ASSISTANT'; readonly turnId: string; readonly clientTurnId: string | null }
  | { readonly type: 'REPLY_END'; readonly callTurnIndex: number; readonly chunks: number; readonly deliveryState: ReplyDeliveryState };

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(record);
  return own.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(record, k));
}

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isU32OrNull = (value: unknown): value is number | null => value === null || isU32(value);

/** Parses one server text frame. Anything not exactly a v1 server message is null (the phone treats it as a fault). */
export function parseServerMessage(text: string): ServerMessage | null {
  if (text.length > MAX_TEXT_FRAME_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case 'STATE':
      return exactKeys(m, ['type', 'callId', 'state', 'epoch', 'startedAt', 'resumeFromCaptureMs', 'lastMsgId', 'endsAt', 'endReason', 'heartbeatMs'])
        && isUuid(m.callId) && typeof m.state === 'string' && CALL_STATES.has(m.state) && isU32OrNull(m.epoch)
        && isStringOrNull(m.startedAt) && (m.resumeFromCaptureMs === null || isCaptureMs(m.resumeFromCaptureMs)) && isU32(m.lastMsgId)
        && isStringOrNull(m.endsAt) && (m.endReason === null || (typeof m.endReason === 'string' && END_REASONS.has(m.endReason))) && isU32(m.heartbeatMs)
        ? m as unknown as ServerMessage : null;
    case 'ACK':
      return exactKeys(m, ['type', 'msgId']) && isU32(m.msgId) ? { type: 'ACK', msgId: m.msgId } : null;
    case 'REFUSED':
      return exactKeys(m, ['type', 'reason', 'msgId']) && typeof m.reason === 'string' && REFUSALS.has(m.reason) && isU32OrNull(m.msgId)
        ? { type: 'REFUSED', reason: m.reason as RefusalReason, msgId: m.msgId } : null;
    case 'CALL_ENDING':
      return exactKeys(m, ['type', 'endsInMs']) && isU32(m.endsInMs) ? { type: 'CALL_ENDING', endsInMs: m.endsInMs } : null;
    case 'TURN_COMMITTED':
      return exactKeys(m, ['type', 'callTurnIndex', 'role', 'turnId', 'clientTurnId']) && isU32(m.callTurnIndex)
        && (m.role === 'USER' || m.role === 'ASSISTANT') && isUuid(m.turnId) && (m.clientTurnId === null || isUuid(m.clientTurnId))
        ? { type: 'TURN_COMMITTED', callTurnIndex: m.callTurnIndex, role: m.role, turnId: m.turnId, clientTurnId: m.clientTurnId } : null;
    case 'REPLY_END':
      return exactKeys(m, ['type', 'callTurnIndex', 'chunks', 'deliveryState']) && isU32(m.callTurnIndex) && isU32(m.chunks)
        && typeof m.deliveryState === 'string' && DELIVERY_STATES.has(m.deliveryState)
        ? { type: 'REPLY_END', callTurnIndex: m.callTurnIndex, chunks: m.chunks, deliveryState: m.deliveryState as ReplyDeliveryState } : null;
    default:
      return null;
  }
}

// ------------------------------------------------------------------ binary frames (big-endian, 20-byte header)
export interface AudioFrame {
  readonly epoch: number;
  readonly seq: number;
  readonly captureMs: number;
  readonly packet: Uint8Array;
}

export interface ReplyAudioFrame {
  readonly epoch: number;
  readonly callTurnIndex: number;
  readonly chunkSeq: number;
  readonly offsetMs: number;
  readonly packet: Uint8Array;
}

function encodeFrame(kind: number, epoch: number, a: number, b: number, c: number, packet: Uint8Array): Uint8Array {
  if (![epoch, a, b, c].every(isU32) || packet.length < 1 || packet.length > MAX_OPUS_PACKET_BYTES) throw new RangeError('LIVE_CALL_FRAME_INVALID');
  const out = new Uint8Array(FRAME_HEADER_BYTES + packet.length);
  const view = new DataView(out.buffer);
  view.setUint8(0, kind);
  view.setUint8(1, LIVE_CALL_PROTOCOL_VERSION);
  view.setUint16(2, 0);
  view.setUint32(4, epoch);
  view.setUint32(8, a);
  view.setUint32(12, b);
  view.setUint32(16, c);
  out.set(packet, FRAME_HEADER_BYTES);
  return out;
}

/** AUDIO (kind 0x01): epoch, seq, captureMs, reserved 0, then one Opus packet. */
export function encodeAudioFrame(frame: AudioFrame): Uint8Array {
  if (frame.captureMs % AUDIO_PACKET_MS !== 0) throw new RangeError('LIVE_CALL_FRAME_INVALID');
  return encodeFrame(AUDIO_FRAME_KIND, frame.epoch, frame.seq, frame.captureMs, 0, frame.packet);
}

export function decodeAudioFrame(frame: Uint8Array): AudioFrame | null {
  if (frame.length <= FRAME_HEADER_BYTES || frame.length > MAX_BINARY_FRAME_BYTES) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint8(0) !== AUDIO_FRAME_KIND || view.getUint8(1) !== LIVE_CALL_PROTOCOL_VERSION) return null;
  if (view.getUint16(2) !== 0 || view.getUint32(16) !== 0) return null;
  const captureMs = view.getUint32(12);
  if (captureMs % AUDIO_PACKET_MS !== 0) return null;
  return { epoch: view.getUint32(4), seq: view.getUint32(8), captureMs, packet: frame.subarray(FRAME_HEADER_BYTES) };
}

/** REPLY_AUDIO (kind 0x02): epoch, callTurnIndex, chunkSeq, offsetMs, then one Opus packet. */
export function encodeReplyAudioFrame(frame: ReplyAudioFrame): Uint8Array {
  return encodeFrame(REPLY_AUDIO_FRAME_KIND, frame.epoch, frame.callTurnIndex, frame.chunkSeq, frame.offsetMs, frame.packet);
}

export function decodeReplyAudioFrame(frame: Uint8Array): ReplyAudioFrame | null {
  if (frame.length <= FRAME_HEADER_BYTES || frame.length > MAX_BINARY_FRAME_BYTES) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint8(0) !== REPLY_AUDIO_FRAME_KIND || view.getUint8(1) !== LIVE_CALL_PROTOCOL_VERSION || view.getUint16(2) !== 0) return null;
  return {
    epoch: view.getUint32(4), callTurnIndex: view.getUint32(8), chunkSeq: view.getUint32(12), offsetMs: view.getUint32(16),
    packet: frame.subarray(FRAME_HEADER_BYTES),
  };
}

/** RFC 6716 §3.1 TOC: true only for one mono Opus packet of exactly 20 ms (the uplink rule D-C1, as the server checks it). */
export function isMono20msOpusPacket(packet: Uint8Array): boolean {
  if (packet.length < 1) return false;
  const toc = packet[0]!;
  if ((toc & 0x04) !== 0) return false;
  const config = toc >> 3;
  const code = toc & 0x03;
  let frames: number;
  if (code === 0) frames = 1;
  else if (code === 1 || code === 2) frames = 2;
  else {
    if (packet.length < 2) return false;
    frames = packet[1]! & 0x3f;
    if (frames === 0) return false;
  }
  const tenths = config < 12 ? [100, 200, 400, 600][config % 4]! : config < 16 ? [100, 200][config % 2]! : [25, 50, 100, 200][config % 4]!;
  return frames * tenths === 200;
}
