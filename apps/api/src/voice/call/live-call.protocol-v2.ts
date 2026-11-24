/**
 * S8B-07 RB-2 / M-2 — Live Call protocol v2: v1 plus the certified clock marks (the Product Owner's "RB-2 / M-2 + S3
 * PRODUCTION IMPLEMENTATION — Direct Historical Binding" authorization, 2026-11-24, CP3). The human-readable statement is
 * `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md`. v1 (`live-call.protocol.ts`) is frozen and unchanged: a phone that offers
 * only `qandeel.live-call.v1` gets exactly v1, byte for byte, and is never sent a v2 message.
 *
 *   Negotiation   the phone offers `qandeel.live-call.v2, qandeel.live-call.v1`; the server selects v2 when offered and
 *                 echoes the one it selected. Under v2 the phone's HELLO carries `v: 2`; anything else is a violation.
 *   Binary        unchanged (version byte 1, the v1 layout). Every v1 message is unchanged.
 *   CLOCK_MARK    server → phone `{ type, seq }`: sent only while the call is ACTIVE, only after the slot batch that took
 *                 the database snapshot it is bound to has COMMITTED (0203). `seq` rises by 1 per connection, from 1.
 *   MARK_ECHO     phone → server `{ type, seq, captureMs }`: the capture position of the first frame the phone captured
 *                 at least 100 ms after the mark arrived (a multiple of 20 on the call's capture clock), or `null`
 *                 (NOCLOCK: no stable capture timestamp — held, re-establishing after a resume, a start-up gate, iOS).
 *                 Not ACKed: an echo is evidence, never a command. An unknown, duplicate, expired, late or non-rising echo
 *                 is dropped silently; it can only make a certification later, never earlier.
 */
import { MAX_TEXT_FRAME_BYTES, parseClientMessage, type ClientMessage, type ServerMessage } from './live-call.protocol';

export const LIVE_CALL_PROTOCOL_V2 = 'qandeel.live-call.v2';
export const LIVE_CALL_PROTOCOL_V2_VERSION = 2;

/** The frozen M-2 timing (Option B): one mark per call per second, in ten staggered 100 ms slots. */
export const CLOCK_MARK_POLICY = Object.freeze({
  periodMs: 1000,
  slots: 10,
  slotMs: 100,
  /** An echo later than this after its mark is dropped (its snapshot may already be collected, 0203: 120 s). */
  echoLifetimeMs: 10_000,
  /** The phone's margin between a mark's arrival and the capture instant it may echo (HONOR proof: 0 ms is unsafe). */
  androidMarginMs: 100,
  /** Echoes one slot batch carries at most (0203 refuses more than 2000). */
  maxEchoesPerBatch: 1000,
});

export type HelloV2 = { readonly type: 'HELLO'; readonly v: 2; readonly callId: string; readonly sessionId: string; readonly clientInstanceId: string; readonly resume: boolean };
export type MarkEcho = { readonly type: 'MARK_ECHO'; readonly seq: number; readonly captureMs: number | null };
export type ClientMessageV2 = Exclude<ClientMessage, { type: 'HELLO' }> | HelloV2 | MarkEcho;
export type ClockMark = { readonly type: 'CLOCK_MARK'; readonly seq: number };
export type ServerMessageV2 = ServerMessage | ClockMark;

export const CLIENT_MESSAGES_V2 = Object.freeze(['HELLO', 'AUDIO', 'PLAYOUT', 'BARGE_IN', 'TEXT_TURN', 'MUTE', 'UNMUTE', 'TOKEN_REFRESH', 'HEARTBEAT', 'END', 'MARK_ECHO'] as const);
export const SERVER_MESSAGES_V2 = Object.freeze(['STATE', 'TURN_COMMITTED', 'REPLY_AUDIO', 'REPLY_END', 'REFUSED', 'CALL_ENDING', 'ACK', 'CLOCK_MARK'] as const);

const MAX_U32 = 0xffff_ffff;
const isU32 = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_U32;

/** Parses one v2 text frame: MARK_ECHO, a HELLO with `v: 2`, or exactly a v1 message other than HELLO. Anything else is null. */
export function parseClientMessageV2(text: string): ClientMessageV2 | null {
  if (text.length > MAX_TEXT_FRAME_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.type === 'MARK_ECHO') {
    const keys = Object.keys(m);
    return keys.length === 3 && ['type', 'seq', 'captureMs'].every((k) => Object.hasOwn(m, k)) && isU32(m.seq) && m.seq >= 1
      && (m.captureMs === null || (isU32(m.captureMs) && m.captureMs % 20 === 0))
      ? { type: 'MARK_ECHO', seq: m.seq, captureMs: m.captureMs } : null;
  }
  if (m.type === 'HELLO') {
    if (m.v !== LIVE_CALL_PROTOCOL_V2_VERSION) return null;
    const v1 = parseClientMessage(JSON.stringify({ ...m, v: 1 }));
    return v1 && v1.type === 'HELLO' ? { ...v1, v: 2 } : null;
  }
  const v1 = parseClientMessage(text);
  return v1 && v1.type !== 'HELLO' ? v1 : null;
}

export function encodeServerMessageV2(message: ServerMessageV2): string {
  return JSON.stringify(message);
}
