/**
 * S8B-05 CP1 — Live Call protocol v1 (Integrated Live Call Contract v1.2 FINAL, §A6 05-CP1: "one frozen protocol").
 *
 * This file IS the protocol: every constant, message shape, binary layout and limit the phone and the server share. It is
 * pure (no I/O). The human-readable statement of the same protocol is `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v1.md`; the
 * two are kept identical by `tests/s8b-05-live-call-contract.test.mjs`. A change is a new protocol version, never an edit.
 *
 * ## Transport
 *
 *   GET wss://<api>/voice/calls/connect                     (TLS ends at the trusted proxy; no query string, ever)
 *   Sec-WebSocket-Protocol: qandeel.live-call.v1            (required, exactly)
 *   Authorization: Bearer <access token>                    (the token never travels in the URL or in a message body
 *                                                            except TOKEN_REFRESH; no extension is negotiated)
 *
 *   An upgrade is refused with a plain HTTP status before any frame: 400 malformed, 401 not authenticated, 404 another
 *   path (or any query), 426 not WebSocket version 13, 429 rate limited, 503 this instance is full or authentication is
 *   unavailable. A text frame is one JSON control message; a binary frame is one audio frame.
 *   Messages are never fragmented (FIN set on every frame).
 *
 * ## Binary frames (big-endian, 20-byte header, then one Opus packet of 1 ... 1275 bytes)
 *
 *   offset  size  AUDIO (client → server, kind 0x01)        REPLY_AUDIO (server → client, kind 0x02; CP2)
 *        0     1  kind                                       kind
 *        1     1  version = 1                                version = 1
 *        2     2  flags = 0 (reserved)                       flags = 0 (reserved)
 *        4     4  connection epoch                           connection epoch
 *        8     4  seq: per call, +1 per packet produced      call_turn_index of the reply
 *       12     4  captureMs: the call's capture clock        chunkSeq within the reply, from 0
 *       16     4  reserved = 0                               offsetMs within the reply
 *
 *   Uplink audio (D-C1): Opus, mono, 16 kHz, one 20 ms packet per frame, FEC on, DTX off. The capture clock starts at 0 on
 *   the call's first packet and keeps running while muted or reconnecting, so every packet's captureMs is a multiple of 20
 *   and the USER track's clock IS the capture clock. Downlink (CP2): Opus mono 24 kHz, 20 ms.
 *
 * ## Ordering, duplicates, resend
 *
 *   Within one connection seq rises by exactly 1 and captureMs by exactly 20, except where a MUTE / UNMUTE pair explains
 *   the jump. A packet whose captureMs is below what the server already holds is a duplicate (a resend) and is dropped.
 *   After a resume the server's STATE names `resumeFromCaptureMs` (the USER track's durable end); the phone resends what
 *   it still holds from there (at most RESEND_BUFFER_MS) and the rest of the hole becomes a RECONNECTION gap. Control
 *   messages that change state carry a rising `msgId`; the server ACKs each once applied and re-ACKs a repeat without
 *   applying it again; the phone resends what is unacknowledged after a resume (contract §A3.2 P5).
 */

export const LIVE_CALL_PROTOCOL = 'qandeel.live-call.v1';
export const LIVE_CALL_PATH = '/voice/calls/connect';
export const LIVE_CALL_PROTOCOL_VERSION = 1;

export const AUDIO_FRAME_KIND = 0x01;
export const REPLY_AUDIO_FRAME_KIND = 0x02;
export const FRAME_HEADER_BYTES = 20;
/** RFC 6716: the largest Opus packet. */
export const MAX_OPUS_PACKET_BYTES = 1275;
export const MAX_BINARY_FRAME_BYTES = FRAME_HEADER_BYTES + MAX_OPUS_PACKET_BYTES;
export const MAX_TEXT_FRAME_BYTES = 4096;
export const AUDIO_PACKET_MS = 20;

/** The limits both ends keep (CP1). Engineering bounds, not Product law; a change is a protocol version. */
export const LIVE_CALL_LIMITS = Object.freeze({
  /** The phone sends HEARTBEAT this often. */
  heartbeatIntervalMs: 1000,
  /** No frame at all for this long: the connection is lost (ACTIVE → RECONNECTING). */
  silenceTimeoutMs: 3000,
  /** The server renews the call's seat and recording lease this often (the lease itself is 20 s, migration 0189). */
  leaseRenewalMs: 5000,
  /** The phone keeps at most this much sent audio for a resend after a resume. */
  resendBufferMs: 2000,
  /** Inbound frames per second (50 audio + control) with a burst allowance. */
  framesPerSecond: 100,
  frameBurst: 150,
  /** Control (text) messages per second. */
  controlPerSecond: 20,
  /** USER audio received but not yet acknowledged STORED, per connection. */
  maxPendingAudioBytes: 512 * 1024,
  /** Bytes queued towards the phone before the connection is treated as a stalled consumer. */
  maxOutboundBufferBytes: 1024 * 1024,
  /** One USER-track segment covers about this much audio before it is written (Ogg Opus, its own file). */
  segmentTargetMs: 10_000,
  /** Without a fresh token the connection closes at the token's own expiry, or after this much when it names none. */
  tokenFallbackLifetimeMs: 10 * 60_000,
  /** The 60-minute warnings (D-05-06): CALL_ENDING is sent this long before the server ends the call. */
  callEndingNoticeMs: [5 * 60_000, 60_000] as const,
});

/** WebSocket close codes the server uses (1000 normal; 4xxx this protocol's). */
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

// ------------------------------------------------------------------ client → server (text)
export type ClientMessage =
  | { readonly type: 'HELLO'; readonly v: 1; readonly callId: string; readonly sessionId: string; readonly clientInstanceId: string; readonly resume: boolean }
  | { readonly type: 'HEARTBEAT'; readonly n: number }
  | { readonly type: 'MUTE'; readonly msgId: number; readonly captureMs: number }
  | { readonly type: 'UNMUTE'; readonly msgId: number; readonly captureMs: number }
  | { readonly type: 'TOKEN_REFRESH'; readonly msgId: number; readonly accessToken: string }
  | { readonly type: 'END'; readonly msgId: number }
  // Shapes frozen in v1; their logic is CP2 / CP4. CP1 answers REFUSED NOT_SUPPORTED_YET and never claims success.
  | { readonly type: 'PLAYOUT'; readonly msgId: number; readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }
  | { readonly type: 'BARGE_IN'; readonly msgId: number; readonly callTurnIndex: number; readonly captureMs: number }
  | { readonly type: 'TEXT_TURN'; readonly msgId: number; readonly clientTurnId: string; readonly text: string };

export type ClientMessageType = ClientMessage['type'];
/** Every client→server message of v1, AUDIO (binary) included. */
export const CLIENT_MESSAGES = Object.freeze(['HELLO', 'AUDIO', 'PLAYOUT', 'BARGE_IN', 'TEXT_TURN', 'MUTE', 'UNMUTE', 'TOKEN_REFRESH', 'HEARTBEAT', 'END'] as const);
/** Every server→client message of v1, REPLY_AUDIO (binary) included. */
export const SERVER_MESSAGES = Object.freeze(['STATE', 'TURN_COMMITTED', 'REPLY_AUDIO', 'REPLY_END', 'REFUSED', 'CALL_ENDING', 'ACK'] as const);
/** The client messages whose logic is not in CP1 (frozen shape, refused honestly). */
export const NOT_YET_SUPPORTED: ReadonlySet<ClientMessageType> = new Set(['PLAYOUT', 'BARGE_IN', 'TEXT_TURN']);

// ------------------------------------------------------------------ server → client (text)
export type ServerMessage =
  | {
    readonly type: 'STATE'; readonly callId: string; readonly state: CallState; readonly epoch: number | null;
    readonly startedAt: string | null; readonly resumeFromCaptureMs: number | null; readonly lastMsgId: number;
    readonly endsAt: string | null; readonly endReason: CallEndReason | null; readonly heartbeatMs: number;
  }
  | { readonly type: 'ACK'; readonly msgId: number }
  | { readonly type: 'REFUSED'; readonly reason: RefusalReason; readonly msgId: number | null }
  | { readonly type: 'CALL_ENDING'; readonly endsInMs: number }
  // Shapes frozen in v1, sent from CP2.
  | { readonly type: 'TURN_COMMITTED'; readonly callTurnIndex: number; readonly role: 'USER' | 'ASSISTANT'; readonly turnId: string; readonly clientTurnId: string | null }
  | { readonly type: 'REPLY_END'; readonly callTurnIndex: number; readonly chunks: number; readonly deliveryState: 'COMPLETE' | 'INTERRUPTED' | 'WITHHELD_TAIL' | 'FAILED' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_U32 = 0xffff_ffff;
const MAX_TEXT_TURN_CHARS = 2000;
/** A refreshed token must fit one text frame with its envelope. */
const MAX_TOKEN_CHARS = 3500;

const isU32 = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_U32;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isCapture = (value: unknown): value is number => isU32(value) && value % AUDIO_PACKET_MS === 0;

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(record);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(record, k));
}

/** Parses one text frame. Anything not exactly a v1 message (unknown type, missing or extra field, bad value) is null. */
export function parseClientMessage(text: string): ClientMessage | null {
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
    case 'HELLO':
      return exactKeys(m, ['type', 'v', 'callId', 'sessionId', 'clientInstanceId', 'resume']) && m.v === 1 && isUuid(m.callId)
        && isUuid(m.sessionId) && isUuid(m.clientInstanceId) && typeof m.resume === 'boolean'
        ? { type: 'HELLO', v: 1, callId: m.callId, sessionId: m.sessionId, clientInstanceId: m.clientInstanceId, resume: m.resume } : null;
    case 'HEARTBEAT':
      return exactKeys(m, ['type', 'n']) && isU32(m.n) ? { type: 'HEARTBEAT', n: m.n } : null;
    case 'MUTE':
    case 'UNMUTE':
      return exactKeys(m, ['type', 'msgId', 'captureMs']) && isU32(m.msgId) && isCapture(m.captureMs)
        ? { type: m.type, msgId: m.msgId, captureMs: m.captureMs } : null;
    case 'TOKEN_REFRESH':
      return exactKeys(m, ['type', 'msgId', 'accessToken']) && isU32(m.msgId) && typeof m.accessToken === 'string'
        && m.accessToken.length > 0 && m.accessToken.length <= MAX_TOKEN_CHARS && !/\s/u.test(m.accessToken)
        ? { type: 'TOKEN_REFRESH', msgId: m.msgId, accessToken: m.accessToken } : null;
    case 'END':
      return exactKeys(m, ['type', 'msgId']) && isU32(m.msgId) ? { type: 'END', msgId: m.msgId } : null;
    case 'PLAYOUT':
      return exactKeys(m, ['type', 'msgId', 'callTurnIndex', 'chunkSeq', 'playedMs']) && isU32(m.msgId) && isU32(m.callTurnIndex)
        && isU32(m.chunkSeq) && isU32(m.playedMs)
        ? { type: 'PLAYOUT', msgId: m.msgId, callTurnIndex: m.callTurnIndex, chunkSeq: m.chunkSeq, playedMs: m.playedMs } : null;
    case 'BARGE_IN':
      return exactKeys(m, ['type', 'msgId', 'callTurnIndex', 'captureMs']) && isU32(m.msgId) && isU32(m.callTurnIndex) && isCapture(m.captureMs)
        ? { type: 'BARGE_IN', msgId: m.msgId, callTurnIndex: m.callTurnIndex, captureMs: m.captureMs } : null;
    case 'TEXT_TURN':
      return exactKeys(m, ['type', 'msgId', 'clientTurnId', 'text']) && isU32(m.msgId) && isUuid(m.clientTurnId)
        && typeof m.text === 'string' && m.text.trim().length > 0 && m.text.length <= MAX_TEXT_TURN_CHARS
        ? { type: 'TEXT_TURN', msgId: m.msgId, clientTurnId: m.clientTurnId, text: m.text } : null;
    default:
      return null;
  }
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

// ------------------------------------------------------------------ binary frames
export interface AudioFrame {
  readonly epoch: number;
  readonly seq: number;
  readonly captureMs: number;
  readonly packet: Buffer;
}

export interface ReplyAudioFrame {
  readonly epoch: number;
  readonly callTurnIndex: number;
  readonly chunkSeq: number;
  readonly offsetMs: number;
  readonly packet: Buffer;
}

/** Decodes one client binary frame. A wrong kind, version, flag, reserved word or size is null (a protocol violation). */
export function decodeAudioFrame(frame: Buffer): AudioFrame | null {
  if (frame.length <= FRAME_HEADER_BYTES || frame.length > MAX_BINARY_FRAME_BYTES) return null;
  if (frame.readUInt8(0) !== AUDIO_FRAME_KIND || frame.readUInt8(1) !== LIVE_CALL_PROTOCOL_VERSION) return null;
  if (frame.readUInt16BE(2) !== 0 || frame.readUInt32BE(16) !== 0) return null;
  const captureMs = frame.readUInt32BE(12);
  if (captureMs % AUDIO_PACKET_MS !== 0) return null;
  return { epoch: frame.readUInt32BE(4), seq: frame.readUInt32BE(8), captureMs, packet: frame.subarray(FRAME_HEADER_BYTES) };
}

export function encodeAudioFrame(frame: AudioFrame): Buffer {
  return encodeFrame(AUDIO_FRAME_KIND, frame.epoch, frame.seq, frame.captureMs, 0, frame.packet);
}

export function encodeReplyAudioFrame(frame: ReplyAudioFrame): Buffer {
  return encodeFrame(REPLY_AUDIO_FRAME_KIND, frame.epoch, frame.callTurnIndex, frame.chunkSeq, frame.offsetMs, frame.packet);
}

export function decodeReplyAudioFrame(frame: Buffer): ReplyAudioFrame | null {
  if (frame.length <= FRAME_HEADER_BYTES || frame.length > MAX_BINARY_FRAME_BYTES) return null;
  if (frame.readUInt8(0) !== REPLY_AUDIO_FRAME_KIND || frame.readUInt8(1) !== LIVE_CALL_PROTOCOL_VERSION || frame.readUInt16BE(2) !== 0) return null;
  return {
    epoch: frame.readUInt32BE(4), callTurnIndex: frame.readUInt32BE(8), chunkSeq: frame.readUInt32BE(12), offsetMs: frame.readUInt32BE(16),
    packet: frame.subarray(FRAME_HEADER_BYTES),
  };
}

function encodeFrame(kind: number, epoch: number, a: number, b: number, c: number, packet: Buffer): Buffer {
  if (![epoch, a, b, c].every(isU32) || packet.length < 1 || packet.length > MAX_OPUS_PACKET_BYTES) throw new RangeError('LIVE_CALL_FRAME_INVALID');
  const out = Buffer.alloc(FRAME_HEADER_BYTES + packet.length);
  out.writeUInt8(kind, 0);
  out.writeUInt8(LIVE_CALL_PROTOCOL_VERSION, 1);
  out.writeUInt16BE(0, 2);
  out.writeUInt32BE(epoch, 4);
  out.writeUInt32BE(a, 8);
  out.writeUInt32BE(b, 12);
  out.writeUInt32BE(c, 16);
  packet.copy(out, FRAME_HEADER_BYTES);
  return out;
}
