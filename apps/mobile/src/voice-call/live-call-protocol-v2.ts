/**
 * S8B-07 RB-2 / M-2 — the phone's side of Live Call protocol v2 (`docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v2.md`): v1 plus
 * CLOCK_MARK (server → phone) and MARK_ECHO (phone → server). v1 (`live-call-protocol.ts`) is frozen and unchanged.
 *
 * Only a phone whose engine can resolve a certified capture position offers v2 (Android); iOS offers v1 only, so it is
 * never asked for an echo and no moment of its calls is placed inside a recording (fail-closed, AFTER_END).
 */
import { isCaptureMs, isU32, MAX_TEXT_FRAME_BYTES, parseServerMessage, type ServerMessage } from './live-call-protocol';

export const LIVE_CALL_PROTOCOL_V2 = 'qandeel.live-call.v2';
export const LIVE_CALL_PROTOCOL_V2_VERSION = 2;

export type ClockMarkMessage = { readonly type: 'CLOCK_MARK'; readonly seq: number };
export type ServerMessageV2 = ServerMessage | ClockMarkMessage;

/** Parses one v2 server text frame: CLOCK_MARK, or exactly a v1 server message. Anything else is null (a fault). */
export function parseServerMessageV2(text: string): ServerMessageV2 | null {
  if (text.length > MAX_TEXT_FRAME_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && (value as { type?: unknown }).type === 'CLOCK_MARK') {
    const m = value as Record<string, unknown>;
    return Object.keys(m).length === 2 && isU32(m.seq) && m.seq >= 1 ? { type: 'CLOCK_MARK', seq: m.seq } : null;
  }
  return parseServerMessage(text);
}

/** MARK_ECHO: the capture position the engine resolved for the mark, or null (NOCLOCK). */
export function encodeMarkEcho(seq: number, captureMs: number | null): string {
  if (!isU32(seq) || seq < 1 || (captureMs !== null && !isCaptureMs(captureMs))) throw new RangeError('LIVE_CALL_MESSAGE_INVALID');
  return JSON.stringify({ type: 'MARK_ECHO', seq, captureMs });
}
