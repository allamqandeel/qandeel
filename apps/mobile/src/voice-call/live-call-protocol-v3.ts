/**
 * INTEL-LIVE-01 CP2 — the phone's side of Live Call protocol v3 (`docs/voice/QANDEEL_LIVE_CALL_PROTOCOL_v3.md`): v2 plus
 * the call's provisional attention, server → phone only. v1 and v2 are frozen and unchanged.
 *
 * Both platforms offer v3 first: Android `v3, v2, v1`, iOS `v3, v1`. Under v3 the CLOCK_MARK of v2 still arrives; a phone
 * that cannot resolve a capture position (iOS) answers it `null` (NOCLOCK), the existing null-certificate policy.
 *
 *   ATTENTION        one attention event the database committed; `seq` is its 0204 event_seq (rising across the call).
 *   ATTENTION_STATE  the call's open attention as ONE read of the database holds it, in `parts` frames with the snapshot's
 *                    `seq`; part 0 replaces the phone's layer, later parts add to it. After it, only ATTENTION with a
 *                    higher seq applies.
 */
import { MAX_TEXT_FRAME_BYTES } from './live-call-protocol';
import { parseServerMessageV2, type ServerMessageV2 } from './live-call-protocol-v2';

export const LIVE_CALL_PROTOCOL_V3 = 'qandeel.live-call.v3';
export const LIVE_CALL_PROTOCOL_V3_VERSION = 3;
export const ATTENTION_STATE_ENTRIES_PER_PART = 12;

export type AttentionOp = 'SET' | 'WITHDRAW' | 'CONFIRMED' | 'EXPIRED';
export type AttentionTrack = 'USER' | 'QANDEEL';
export type AttentionKind = 'TOPIC' | 'PERSON' | 'PLACE' | 'EXPERIENCE' | 'CONCERN' | 'PLAN';
export type AttentionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AttentionSubject {
  readonly track: AttentionTrack;
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: AttentionKind;
  readonly confidence: AttentionConfidence;
  readonly threadRef: string | null;
}

export type AttentionMessage = AttentionSubject & {
  readonly type: 'ATTENTION';
  readonly seq: number;
  readonly op: AttentionOp;
  readonly producedClockMs: number | null;
};
export type AttentionStateEntry = AttentionSubject & { readonly seq: number };
export type AttentionStateMessage = {
  readonly type: 'ATTENTION_STATE';
  readonly seq: number;
  readonly part: number;
  readonly parts: number;
  readonly entries: readonly AttentionStateEntry[];
};
export type ServerMessageV3 = ServerMessageV2 | AttentionMessage | AttentionStateMessage;

const OPS: readonly unknown[] = ['SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED'];
const TRACKS: readonly unknown[] = ['USER', 'QANDEEL'];
const KINDS: readonly unknown[] = ['TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN'];
const CONFIDENCES: readonly unknown[] = ['HIGH', 'MEDIUM', 'LOW'];
const SUBJECT_KEYS = ['track', 'subjectKey', 'label', 'kind', 'confidence', 'threadRef'] as const;

const isSeq = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length >= 1 && v.length <= max;

function subjectOf(m: Record<string, unknown>): AttentionSubject | null {
  if (!TRACKS.includes(m.track) || !isText(m.subjectKey, 64) || !isText(m.label, 80) || !KINDS.includes(m.kind)
    || !CONFIDENCES.includes(m.confidence) || !(m.threadRef === null || isText(m.threadRef, 64))) return null;
  return {
    track: m.track as AttentionTrack, subjectKey: m.subjectKey, label: m.label, kind: m.kind as AttentionKind,
    confidence: m.confidence as AttentionConfidence, threadRef: m.threadRef as string | null,
  };
}

const exactKeys = (m: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(m).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(m, k));

/** Parses one v3 server text frame: ATTENTION, ATTENTION_STATE, or exactly a v2 server message. Anything else is null. */
export function parseServerMessageV3(text: string): ServerMessageV3 | null {
  if (text.length > MAX_TEXT_FRAME_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.type === 'ATTENTION') {
    if (!exactKeys(m, ['type', 'seq', 'op', ...SUBJECT_KEYS, 'producedClockMs']) || !isSeq(m.seq, 1) || !OPS.includes(m.op)
      || !(m.producedClockMs === null || isSeq(m.producedClockMs, 0))) return null;
    const subject = subjectOf(m);
    return subject ? { type: 'ATTENTION', seq: m.seq, op: m.op as AttentionOp, ...subject, producedClockMs: m.producedClockMs as number | null } : null;
  }
  if (m.type === 'ATTENTION_STATE') {
    if (!exactKeys(m, ['type', 'seq', 'part', 'parts', 'entries']) || !isSeq(m.seq, 0) || !isSeq(m.parts, 1) || !isSeq(m.part, 0)
      || m.part >= m.parts || !Array.isArray(m.entries) || m.entries.length > ATTENTION_STATE_ENTRIES_PER_PART) return null;
    const entries: AttentionStateEntry[] = [];
    for (const raw of m.entries as unknown[]) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const e = raw as Record<string, unknown>;
      if (!exactKeys(e, [...SUBJECT_KEYS, 'seq']) || !isSeq(e.seq, 1) || e.seq > (m.seq as number)) return null;
      const subject = subjectOf(e);
      if (!subject) return null;
      entries.push({ ...subject, seq: e.seq });
    }
    return { type: 'ATTENTION_STATE', seq: m.seq, part: m.part, parts: m.parts, entries };
  }
  return parseServerMessageV2(text);
}
