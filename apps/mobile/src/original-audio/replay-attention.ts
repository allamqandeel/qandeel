/**
 * INTEL-LIVE-01 CP3 (D-CP3, the Product Owner's approval of 2026-11-26) — the phone's typed reading of the Replay Media
 * Service's attention answer: the in-speech attention events of the version's calls (0204), as the database placed them
 * (migration 0205) and the service translated them into the playback map. Pure: no request, no clock, no storage, no
 * repair. Fetching it is `replay-attention-source.ts`; reducing it on the presentation clock is the Replay's Lane B
 * (`replay-cosmos/event-track.ts`).
 *
 * Nothing in the answer is certified (0205): every floor is a position the server itself produced during the call (a
 * development: its produced position; a settlement: the position its turn was settled through), at its hold's elapsed
 * offset — a NON-EXACT placement, never a claim of when the phone displayed it live. AFTER_END: nothing of the presented
 * recordings is at or after that position; the event belongs to the closing display.
 *
 * The answer is refused WHOLE (null: the lane stays empty, Lane A untouched) unless it is exactly well formed and bound to
 * what the player holds: the same Replay and version, every placement inside a run of the map it plays, every floor at or
 * after its anchor's run, each (call, seq) once, a settlement without an anchor, a development with one.
 */
import type { PresentationRun } from './presentation-map';

export type ReplayAttentionTrack = 'USER' | 'QANDEEL';
export type ReplayAttentionOp = 'SET' | 'WITHDRAW' | 'CONFIRMED' | 'EXPIRED';
export type ReplayAttentionBasis = 'PRODUCED_POSITION' | 'SETTLED_THROUGH';
export type ReplayAttentionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReplayAttentionPlace {
  readonly runIndex: number;
  readonly fileMs: number;
}

export type ReplayAttentionFloor =
  | { readonly kind: 'IN_RECORDING'; readonly runIndex: number; readonly fileMs: number; readonly basis: ReplayAttentionBasis }
  | { readonly kind: 'AFTER_END'; readonly basis: ReplayAttentionBasis };

export interface ReplayAttentionEvent {
  /** The call's rank by its first presented run, and 0204's event_seq within that call. */
  readonly call: number;
  readonly seq: number;
  readonly track: ReplayAttentionTrack;
  readonly op: ReplayAttentionOp;
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: string;
  readonly confidence: ReplayAttentionConfidence;
  readonly threadRef: string | null;
  /** The words the event is about (a development); a settlement has none. */
  readonly anchor: ReplayAttentionPlace | null;
  readonly floor: ReplayAttentionFloor;
}

export interface ReplayAttentionBinding {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly sourceWindowBindingDigest: string | null;
  /** The map the events were placed in (null only for an answer with no event). */
  readonly mapDigest: string | null;
}

export interface ReplayAttention {
  readonly binding: ReplayAttentionBinding;
  /** In the server's order: by call, then event_seq. */
  readonly events: readonly ReplayAttentionEvent[];
}

export interface ReplayAttentionExpectation {
  readonly replayId: string;
  readonly versionId: string;
  readonly runs: readonly Pick<PresentationRun, 'durationMs'>[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
/** 0204's own shapes: a bounded subject key, a short label without control characters. */
const SUBJECT = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const LABEL_MAX = 40;
const TRACKS: readonly string[] = ['USER', 'QANDEEL'];
const OPS: readonly string[] = ['SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED'];
const KINDS: readonly string[] = ['TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN'];
const CONFIDENCES: readonly string[] = ['HIGH', 'MEDIUM', 'LOW'];
const EVENT_KEYS = ['call', 'seq', 'track', 'op', 'subjectKey', 'label', 'kind', 'confidence', 'threadRef', 'anchor', 'floor'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const digestOrNull = (value: unknown): value is string | null => value === null || (typeof value === 'string' && DIGEST.test(value));
const sameId = (value: unknown, expected: string): boolean => typeof value === 'string' && UUID.test(value) && value.toLowerCase() === expected.toLowerCase();
const isLabel = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && Array.from(value).length <= LABEL_MAX && !CONTROL.test(value);

function placeOf(value: unknown, runs: ReplayAttentionExpectation['runs']): ReplayAttentionPlace | null {
  if (!isRecord(value) || !hasExactly(value, ['runIndex', 'fileMs'])) return null;
  const { runIndex, fileMs } = value;
  if (!isCount(runIndex) || !isCount(fileMs)) return null;
  const run = runs[runIndex];
  return run === undefined || fileMs > run.durationMs ? null : { runIndex, fileMs };
}

function floorOf(value: unknown, basis: ReplayAttentionBasis, runs: ReplayAttentionExpectation['runs']): ReplayAttentionFloor | null {
  if (!isRecord(value) || value.basis !== basis) return null;
  if (value.kind === 'AFTER_END') return hasExactly(value, ['kind', 'basis']) ? { kind: 'AFTER_END', basis } : null;
  if (value.kind !== 'IN_RECORDING' || !hasExactly(value, ['kind', 'runIndex', 'fileMs', 'basis'])) return null;
  const place = placeOf({ runIndex: value.runIndex, fileMs: value.fileMs }, runs);
  return place === null ? null : { kind: 'IN_RECORDING', runIndex: place.runIndex, fileMs: place.fileMs, basis };
}

function eventOf(value: unknown, runs: ReplayAttentionExpectation['runs']): ReplayAttentionEvent | null {
  if (!isRecord(value) || !hasExactly(value, EVENT_KEYS)) return null;
  const { call, seq, track, op, subjectKey, label, kind, confidence, threadRef } = value;
  if (!isCount(call) || call < 1 || !isCount(seq) || seq < 1) return null;
  if (typeof track !== 'string' || !TRACKS.includes(track) || typeof op !== 'string' || !OPS.includes(op)) return null;
  if (typeof subjectKey !== 'string' || !SUBJECT.test(subjectKey) || !isLabel(label)) return null;
  if (typeof kind !== 'string' || !KINDS.includes(kind) || typeof confidence !== 'string' || !CONFIDENCES.includes(confidence)) return null;
  if (threadRef !== null && (typeof threadRef !== 'string' || !UUID.test(threadRef))) return null;
  const development = op === 'SET' || op === 'WITHDRAW';
  // A development is about words (its anchor); a settlement settles one and has none.
  let anchor: ReplayAttentionPlace | null = null;
  if (development) {
    anchor = placeOf(value.anchor, runs);
    if (anchor === null) return null;
  } else if (value.anchor !== null) {
    return null;
  }
  const floor = floorOf(value.floor, development ? 'PRODUCED_POSITION' : 'SETTLED_THROUGH', runs);
  if (floor === null) return null;
  // Never before the words' own run: the floor is a position at or after the evidence, which is at or after the anchor.
  if (anchor !== null && floor.kind === 'IN_RECORDING' && floor.runIndex < anchor.runIndex) return null;
  return {
    call, seq, track: track as ReplayAttentionTrack, op: op as ReplayAttentionOp, subjectKey, label, kind,
    confidence: confidence as ReplayAttentionConfidence, threadRef, anchor, floor,
  };
}

/** The attention answer, bound to the version the player holds and the runs of its map, or null: refused whole. */
export function decodeReplayAttention(body: unknown, expected: ReplayAttentionExpectation): ReplayAttention | null {
  if (!isRecord(body) || !hasExactly(body, ['replayId', 'versionId', 'revision', 'sourceWindowBindingDigest', 'mapDigest', 'events'])) return null;
  if (!sameId(body.replayId, expected.replayId) || !sameId(body.versionId, expected.versionId)) return null;
  if (!isCount(body.revision) || body.revision < 1 || !digestOrNull(body.sourceWindowBindingDigest) || !digestOrNull(body.mapDigest)) return null;
  if (!Array.isArray(body.events)) return null;
  const events: ReplayAttentionEvent[] = [];
  const seen = new Set<string>();
  for (const raw of body.events) {
    const event = eventOf(raw, expected.runs);
    if (event === null) return null;
    const key = `${event.call}:${event.seq}`;
    if (seen.has(key)) return null;
    const last = events[events.length - 1];
    // The server's order (call, then seq): anything else is not its answer.
    if (last !== undefined && (event.call < last.call || (event.call === last.call && event.seq < last.seq))) return null;
    seen.add(key);
    events.push(event);
  }
  // Events are placed in a map: the answer names it.
  if (events.length > 0 && body.mapDigest === null) return null;
  return {
    binding: {
      replayId: expected.replayId, versionId: expected.versionId, revision: body.revision,
      sourceWindowBindingDigest: body.sourceWindowBindingDigest, mapDigest: body.mapDigest,
    },
    events,
  };
}

export interface ReplayAttentionHeld {
  readonly revision: number;
  /** The digest of the map the player holds (`presentationMapDigest`, the server's serialization). */
  readonly mapDigest: string;
  /** The source windows pinned for this version in this session (by an availability or an attention answer), if any. */
  readonly sourceWindowBindingDigest: string | null;
}

export type ReplayAttentionBindingRefusal = 'REVISION_MISMATCH' | 'MAP_DIGEST_MISMATCH' | 'SOURCE_WINDOWS_UNBOUND' | 'SOURCE_WINDOWS_CHANGED';

/**
 * A decoded answer is used only when it is bound to exactly what the player presents: the version's revision; the same
 * map, by the server's own digest (an answer with no event names none and places nothing); source windows named and the
 * same as any answer pinned before for this version in this session. Anything else refuses the whole answer: the lane is
 * empty, Lane A is untouched.
 */
export function bindReplayAttention(
  answer: ReplayAttention,
  held: ReplayAttentionHeld,
): { readonly ok: true } | { readonly ok: false; readonly reason: ReplayAttentionBindingRefusal } {
  const b = answer.binding;
  if (b.revision !== held.revision) return { ok: false, reason: 'REVISION_MISMATCH' };
  if (answer.events.length > 0 && b.mapDigest !== held.mapDigest) return { ok: false, reason: 'MAP_DIGEST_MISMATCH' };
  if (b.sourceWindowBindingDigest === null) return { ok: false, reason: 'SOURCE_WINDOWS_UNBOUND' };
  if (held.sourceWindowBindingDigest !== null && held.sourceWindowBindingDigest !== b.sourceWindowBindingDigest) return { ok: false, reason: 'SOURCE_WINDOWS_CHANGED' };
  return { ok: true };
}
