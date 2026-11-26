/**
 * INTEL-LIVE-01 CP2 — Live Call protocol v3: v2 plus the call's provisional attention (the Product Owner's "INTEL-LIVE-01
 * — CP1 Acceptance & CP2 Execution Authorization", 2026-11-25, D-3 approved). The human-readable statement is
 * `docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md`. v1 (`live-call.protocol.ts`) and v2 (`live-call.protocol-v2.ts`) are frozen
 * and unchanged: a phone that offers only v1 or v2 gets exactly that protocol, byte for byte, and is never sent a v3 message.
 *
 *   Negotiation      Android offers `qandeel.live-call.v3, qandeel.live-call.v2, qandeel.live-call.v1`; iOS offers
 *                    `qandeel.live-call.v3, qandeel.live-call.v1`. The server selects the highest offered and echoes it.
 *                    Under v3 the phone's HELLO carries `v: 3`; anything else is a violation.
 *   v2 inside v3     CLOCK_MARK / MARK_ECHO exactly as v2. A phone that cannot resolve a capture position (iOS) answers
 *                    every mark `null` (NOCLOCK), the existing null-certificate policy.
 *   ATTENTION        server → phone, one attention event of the call (migration 0204), sent once the database committed
 *                    it. `seq` is the event's 0204 `event_seq`: DB-assigned under the call's lock, rising across epochs
 *                    and instances. Never a transcript, never an INTERIM.
 *   ATTENTION_STATE  server → phone, the call's open attention as the database holds it (0204's state reader, ONE
 *                    snapshot), as `parts` consecutive frames of at most ATTENTION_STATE_ENTRIES_PER_PART entries each,
 *                    all with the snapshot's `seq` (the call's highest event_seq in that snapshot). Sent after
 *                    `STATE ACTIVE` on every connection, fresh or resumed, and again whenever the database's attention
 *                    may have moved without an ATTENTION frame (a settlement, a frame not delivered). Part 0 REPLACES the
 *                    phone's layer; later parts add to it. The phone then applies only ATTENTION frames with seq > the
 *                    snapshot's seq.
 *   Phone → server   nothing new.
 */
import { MAX_TEXT_FRAME_BYTES, type ServerMessage } from './live-call.protocol';
import {
  CLIENT_MESSAGES_V2, parseClientMessageV2, SERVER_MESSAGES_V2, type ClientMessageV2, type HelloV2, type ServerMessageV2,
} from './live-call.protocol-v2';

export const LIVE_CALL_PROTOCOL_V3 = 'qandeel.live-call.v3';
export const LIVE_CALL_PROTOCOL_V3_VERSION = 3;

/** One ATTENTION_STATE frame carries at most this many entries (every v3 text frame stays within the v1 4096 bound). */
export const ATTENTION_STATE_ENTRIES_PER_PART = 12;

/**
 * Audio first: an attention frame is never queued while more than this waits towards the phone (about ten seconds of
 * reply audio; normally nothing waits). The frame is DROPPED and the database's state is sent again once it keeps up.
 */
export const ATTENTION_OUTBOUND_LIMIT_BYTES = 64 * 1024;

export const ATTENTION_OPS = ['SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED'] as const;
export type AttentionOp = typeof ATTENTION_OPS[number];
export const ATTENTION_TRACKS = ['USER', 'QANDEEL'] as const;
export type AttentionTrackV3 = typeof ATTENTION_TRACKS[number];
export const ATTENTION_KINDS_V3 = ['TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN'] as const;
export const ATTENTION_CONFIDENCES_V3 = ['HIGH', 'MEDIUM', 'LOW'] as const;

/** What an attention subject says: a key, a short label (≤ 40), a kind, a confidence and an optional Thread of the person's. */
export interface AttentionSubjectV3 {
  readonly track: AttentionTrackV3;
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: typeof ATTENTION_KINDS_V3[number];
  readonly confidence: typeof ATTENTION_CONFIDENCES_V3[number];
  readonly threadRef: string | null;
}

export type AttentionMessage = AttentionSubjectV3 & {
  readonly type: 'ATTENTION';
  readonly seq: number;
  readonly op: AttentionOp;
  /** SET / WITHDRAW: the call-clock position the server had ingested when the evaluation produced it; null for settlement. */
  readonly producedClockMs: number | null;
};
export type AttentionStateEntry = AttentionSubjectV3 & { readonly seq: number };
export type AttentionStateMessage = {
  readonly type: 'ATTENTION_STATE';
  readonly seq: number;
  readonly part: number;
  readonly parts: number;
  readonly entries: readonly AttentionStateEntry[];
};

export type HelloV3 = Omit<HelloV2, 'v'> & { readonly v: 3 };
export type ClientMessageV3 = Exclude<ClientMessageV2, { type: 'HELLO' }> | HelloV3;
export type ServerMessageV3 = ServerMessageV2 | AttentionMessage | AttentionStateMessage;

export const CLIENT_MESSAGES_V3 = CLIENT_MESSAGES_V2;
export const SERVER_MESSAGES_V3 = Object.freeze([...SERVER_MESSAGES_V2, 'ATTENTION', 'ATTENTION_STATE'] as const);

/** Parses one v3 client text frame: a HELLO with `v: 3`, or exactly a v2 message other than HELLO. Anything else is null. */
export function parseClientMessageV3(text: string): ClientMessageV3 | null {
  if (text.length > MAX_TEXT_FRAME_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && (value as { type?: unknown }).type === 'HELLO') {
    const m = value as Record<string, unknown>;
    if (m.v !== LIVE_CALL_PROTOCOL_V3_VERSION) return null;
    const v2 = parseClientMessageV2(JSON.stringify({ ...m, v: 2 }));
    return v2 && v2.type === 'HELLO' ? { ...v2, v: 3 } : null;
  }
  const v2 = parseClientMessageV2(text);
  return v2 && v2.type !== 'HELLO' ? v2 : null;
}

export function encodeServerMessageV3(message: ServerMessageV3 | ServerMessage): string {
  return JSON.stringify(message);
}

/** One snapshot as its frames: part 0 replaces the phone's layer, the rest add to it; an empty snapshot is one empty part. */
export function attentionStateFrames(seq: number, entries: readonly AttentionStateEntry[]): AttentionStateMessage[] {
  const parts = Math.max(1, Math.ceil(entries.length / ATTENTION_STATE_ENTRIES_PER_PART));
  return Array.from({ length: parts }, (_, part) => ({
    type: 'ATTENTION_STATE' as const, seq, part, parts,
    entries: entries.slice(part * ATTENTION_STATE_ENTRIES_PER_PART, (part + 1) * ATTENTION_STATE_ENTRIES_PER_PART),
  }));
}
