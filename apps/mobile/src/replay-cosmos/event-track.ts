/**
 * RB-2 / S4-E built this file as Lane B READINESS (a typed boundary with no producer); INTEL-LIVE-01 CP3 (D-10, D-CP3 —
 * the Product Owner's approval of 2026-11-26) RE-ANCHORS it to its producer, the calls' in-speech attention events
 * (0204, read and placed by 0205, decoded by `original-audio/replay-attention.ts`), and to the Replay §19 placement policy
 * (S4-CORRECTION-01: an uncertified history is placed in source order and labelled, never dropped).
 *
 *   Lane A  COMMITTED_KNOWLEDGE    S1 → M-2 → S3 → timeline.ts → COSMOS: K(TC), disclosed after the speech that made it
 *   Lane B  IN_SPEECH_ATTENTION    this file: what the call was attending to WHILE a window was heard (USER or QANDEEL
 *                                  speaking); separate from K(TC) — nothing here enters or reads Lane A's knowledge
 *
 *   disclosedAt(e) = max( floor(e), anchor(e), disclosedAt(previous event on the same subject) )
 *
 *   floor     when the event could first be seen: a certified instant would be one, but none exists (0205 certifies
 *             nothing), so it is the position the SERVER produced it at during the call — a development's produced
 *             position, a settlement's settled-through position — at its hold's elapsed offset; a NON-EXACT placement
 *             (every step says so), never a claim of when the phone displayed it live. AFTER_END: nothing presented is at
 *             or after it — the closing display.
 *   anchor    the words the event is about (a settlement has none): never shown before them. NEVER the placement alone.
 *
 * An event SETs (opens or updates), WITHDRAWs, or settles (CONFIRMED / EXPIRED) one subject — one subject of one track of
 * one call, the caller's `subjectKey` — exactly as the live layer reduces them: a SET moves its subject to the newest, any
 * other op removes it, in the producer's order (`sequence`). The state at t is the reduction of every event disclosed at
 * or before t, in (disclosedAt, sequence) order: a pure function of t, so a seek or a restart gives the identical state.
 * Frames are causal (`causalFrame`, Lane A's own). A development whose anchor lies in no presented window of its own track
 * stays out (the words it is about are not heard there: no leakage into another speaker's or an earlier window); a track
 * bound to another Replay, version, revision or presentation map is refused whole, and the caller holds the empty lane.
 *
 * CP3 R1 (D-CP3-F2, the Product Owner's approval of 2026-11-26) — the layer's end: live, the phone drops a call's whole
 * layer when that call ends, so nothing of one call is drawn in another. An event may name where its LAYER ends on the
 * presentation clock (`layerEndMs`: its call's own presented end). From that instant its subject is never in the state —
 * an open mark, a later settlement, a mark disclosed only at the closing display alike. A deterministic presentation
 * boundary: no event, instant or visibility is invented, and every event keeps its own placement and order.
 */
import { causalFrame, type ReplayScope } from './timeline';

export type ReplayEventSource = 'USER' | 'QANDEEL';
export type ReplayEventOp = 'SET' | 'WITHDRAW' | 'CONFIRMED' | 'EXPIRED';

/** When an event may first be drawn, on the full presentation clock: the server-produced position, or the closing display. */
export type ReplayEventFloor =
  | { readonly kind: 'PRODUCED'; readonly atMs: number }
  | { readonly kind: 'AFTER_END' };

/** One historical event of Lane B. `P` is the event's content (the attention mark it draws). */
export interface ReplayHistoricalEvent<P = unknown> {
  readonly eventId: string;
  /** What the event is about; a later event on the same subject updates, withdraws or settles it. */
  readonly subjectKey: string;
  readonly op: ReplayEventOp;
  readonly source: ReplayEventSource;
  /** The instant, on the full presentation clock, of the words it is about (a settlement: null). Never shown before it. */
  readonly anchorMs: number | null;
  readonly floor: ReplayEventFloor;
  /** The producer's own order (a tie-break at an equal instant, and the order of corrections on one subject). */
  readonly sequence: number;
  readonly payload: P;
  /**
   * Where the event's layer ends, on the full presentation clock (its call's presented end): from it, its subject is
   * never drawn. Absent or null: the layer has no end before the presentation's.
   */
  readonly layerEndMs?: number | null;
}

export interface ReplayEventTrackBinding {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  /** The presentation map the events were placed in (the server's digest, as Lane A binds S3's answer). */
  readonly mapDigest: string;
}

export interface ReplayHistoricalEventTrack<P = unknown> {
  readonly lane: 'IN_SPEECH_ATTENTION';
  readonly binding: ReplayEventTrackBinding;
  readonly events: readonly ReplayHistoricalEvent<P>[];
}

/** The lane of a Replay whose calls attended to nothing (or whose answer is not held): it draws nothing. */
export function emptyReplayEventTrack<P = unknown>(binding: ReplayEventTrackBinding): ReplayHistoricalEventTrack<P> {
  return { lane: 'IN_SPEECH_ATTENTION', binding, events: [] };
}

/** A presented window of one track, on the full presentation clock (the presentation clock's `windows`). */
export interface ReplayEventWindow {
  readonly track: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface ReplayEventStep<P = unknown> {
  readonly eventId: string;
  readonly subjectKey: string;
  readonly op: ReplayEventOp;
  readonly source: ReplayEventSource;
  readonly payload: P;
  /** On the SCOPED clock, and its causal frame. */
  readonly atMs: number;
  readonly frame: number;
  /** Where its layer ends, on the SCOPED clock, and that instant's causal frame (Infinity: no end). */
  readonly layerEndMs: number;
  readonly layerEndFrame: number;
  /** Always false: no Lane B instant is certified (a server-produced position, placed in source order). */
  readonly exact: false;
}

export interface ReplayAttentionEntry<P = unknown> {
  readonly eventId: string;
  readonly source: ReplayEventSource;
  readonly payload: P;
  /** Its layer's end on the SCOPED clock and that instant's frame (Infinity: none): from it, the entry is not drawn. */
  readonly layerEndMs: number;
  readonly layerEndFrame: number;
}

/** subjectKey → its entry, oldest first (a SET moves its subject to the end, as the live layer does). */
export type ReplayAttentionState<P = unknown> = ReadonlyMap<string, ReplayAttentionEntry<P>>;

export interface ReplayEventTimeline<P = unknown> {
  readonly startMs: number;
  readonly endMs: number;
  /** The scope's own length (Lane A's `durationMs` for the same scope). */
  readonly durationMs: number;
  readonly fps: number;
  /** The state the scope opens on (every event disclosed at or before its start). */
  readonly opening: ReplayAttentionState<P>;
  readonly steps: readonly ReplayEventStep<P>[];
  /**
   * The closing display (a scope that ends at the presentation's end): events disclosed at or after it, applied only at
   * t ≥ durationMs, in order — never on a frame inside the scope.
   */
  readonly closing: readonly ReplayEventStep<P>[];
  /** Events disclosed at or after the end of a scope that ends BEFORE the presentation's end: never drawn in it. */
  readonly afterEnd: readonly string[];
  /** Developments whose anchor lies in no presented window of their track: out, never drawn. */
  readonly outside: readonly string[];
  /** Whether any event names its layer's end (false: the state is never filtered, and the empty lane allocates nothing). */
  readonly layered: boolean;
}

const EMPTY_STATE: ReplayAttentionState<never> = new Map();

export type ReplayEventTrackRefusal = 'BINDING_MISMATCH' | 'DUPLICATE_EVENT' | 'MALFORMED_EVENT' | 'SCOPE';

const isTime = (value: number): boolean => Number.isFinite(value) && value >= 0;

/**
 * Lane B's timeline for one scope of a version, on the clock Lane A uses (`windows`: the presentation clock's, by track;
 * `durationMs`: the same presentation length). Refused whole, never repaired.
 */
export function buildReplayEventTimeline<P>(
  track: ReplayHistoricalEventTrack<P>,
  expected: ReplayEventTrackBinding,
  windows: readonly ReplayEventWindow[],
  scope: ReplayScope,
  options: { readonly fps: number; readonly durationMs: number },
): { readonly ok: true; readonly timeline: ReplayEventTimeline<P> } | { readonly ok: false; readonly reason: ReplayEventTrackRefusal } {
  const b = track.binding;
  if (track.lane !== 'IN_SPEECH_ATTENTION' || b.replayId !== expected.replayId || b.versionId !== expected.versionId || b.revision !== expected.revision
      || b.mapDigest !== expected.mapDigest) {
    return { ok: false, reason: 'BINDING_MISMATCH' };
  }
  const startMs = scope.kind === 'FULL' ? 0 : scope.startMs;
  const endMs = scope.kind === 'FULL' ? options.durationMs : scope.endMs;
  if (!(options.fps > 0 && startMs >= 0 && endMs > startMs && endMs <= options.durationMs)) return { ok: false, reason: 'SCOPE' };
  const durationMs = endMs - startMs;
  if (track.events.length === 0) {
    return { ok: true, timeline: { startMs, endMs, durationMs, fps: options.fps, opening: EMPTY_STATE, steps: [], closing: [], afterEnd: [], outside: [], layered: false } };
  }

  const ids = new Set<string>();
  const outside: string[] = [];
  const admitted: ReplayHistoricalEvent<P>[] = [];
  for (const e of track.events) {
    if (ids.has(e.eventId)) return { ok: false, reason: 'DUPLICATE_EVENT' };
    ids.add(e.eventId);
    const development = e.op === 'SET' || e.op === 'WITHDRAW';
    if (!Number.isSafeInteger(e.sequence) || (e.floor.kind === 'PRODUCED' && !isTime(e.floor.atMs))
        || (e.layerEndMs !== undefined && e.layerEndMs !== null && !isTime(e.layerEndMs))
        || (development ? e.anchorMs === null || !isTime(e.anchorMs) : e.anchorMs !== null)) {
      return { ok: false, reason: 'MALFORMED_EVENT' };
    }
    const anchor = e.anchorMs;
    if (anchor !== null && !windows.some((w) => w.track === e.source && w.startMs <= anchor && anchor <= w.endMs)) { outside.push(e.eventId); continue; }
    admitted.push(e);
  }
  // Each subject's events in the producer's order: a correction or a settlement never shows before what it follows.
  const ordered = admitted.sort((x, y) => x.sequence - y.sequence || (x.eventId < y.eventId ? -1 : x.eventId > y.eventId ? 1 : 0));
  const lastOnSubject = new Map<string, number>();
  const disclosed = ordered.map((e) => {
    const floor = e.floor.kind === 'PRODUCED' ? e.floor.atMs : Infinity;
    const at = Math.max(floor, e.anchorMs ?? -Infinity, lastOnSubject.get(e.subjectKey) ?? -Infinity);
    lastOnSubject.set(e.subjectKey, at);
    return { e, at };
  });
  disclosed.sort((x, y) => x.at - y.at || x.e.sequence - y.e.sequence || (x.e.eventId < y.e.eventId ? -1 : x.e.eventId > y.e.eventId ? 1 : 0));

  const opening = new Map<string, ReplayAttentionEntry<P>>();
  const steps: ReplayEventStep<P>[] = [];
  const closing: ReplayEventStep<P>[] = [];
  const afterEnd: string[] = [];
  const layered = ordered.some((e) => e.layerEndMs !== undefined && e.layerEndMs !== null);
  const stepOf = (e: ReplayHistoricalEvent<P>, atMs: number): ReplayEventStep<P> => {
    const layerEndMs = e.layerEndMs === undefined || e.layerEndMs === null ? Infinity : e.layerEndMs - startMs;
    return {
      eventId: e.eventId, subjectKey: e.subjectKey, op: e.op, source: e.source, payload: e.payload, atMs, frame: causalFrame(atMs, options.fps), exact: false,
      layerEndMs, layerEndFrame: layerEndMs === Infinity ? Infinity : causalFrame(Math.max(0, layerEndMs), options.fps),
    };
  };
  for (const { e, at } of disclosed) {
    // At or after the scope's end: never on a frame inside it. At the PRESENTATION's end: the closing display.
    if (at >= endMs) {
      if (endMs === options.durationMs) closing.push(stepOf(e, durationMs));
      else afterEnd.push(e.eventId);
      continue;
    }
    if (at <= startMs) { apply(opening, stepOf(e, 0)); continue; }
    steps.push(stepOf(e, at - startMs));
  }
  return { ok: true, timeline: { startMs, endMs, durationMs, fps: options.fps, opening, steps, closing, afterEnd, outside, layered } };
}

function apply<P>(state: Map<string, ReplayAttentionEntry<P>>, e: ReplayEventStep<P>): void {
  // As the live layer: a SET opens or updates its subject as the newest; WITHDRAW, CONFIRMED and EXPIRED remove it.
  state.delete(e.subjectKey);
  if (e.op === 'SET') state.set(e.subjectKey, { eventId: e.eventId, source: e.source, payload: e.payload, layerEndMs: e.layerEndMs, layerEndFrame: e.layerEndFrame });
}

function reduce<P>(
  timeline: ReplayEventTimeline<P>, reached: (step: ReplayEventStep<P>) => boolean, closed: boolean, ended: (entry: ReplayAttentionEntry<P>) => boolean,
): ReplayAttentionState<P> {
  // The empty lane, and every instant before the first step, cost nothing: no copy, no allocation.
  const any = (timeline.steps.length > 0 && reached(timeline.steps[0]!)) || (closed && timeline.closing.length > 0);
  let state: Map<string, ReplayAttentionEntry<P>> | null = null;
  if (any) {
    state = new Map(timeline.opening);
    for (const step of timeline.steps) {
      if (!reached(step)) break;
      apply(state, step);
    }
    if (closed) for (const step of timeline.closing) apply(state, step);
  }
  if (!timeline.layered) return state ?? timeline.opening;
  // R1: a layer that has ended draws nothing of its call — its subjects leave at its call's presented end.
  const base: ReplayAttentionState<P> = state ?? timeline.opening;
  for (const [subject, entry] of base) {
    if (!ended(entry)) continue;
    state ??= new Map(base);
    state.delete(subject);
  }
  return state ?? base;
}

/** Lane B's state at scoped time t: a pure function of t (seek and restart give the identical state). */
export const attentionAt = <P>(timeline: ReplayEventTimeline<P>, t: number): ReplayAttentionState<P> =>
  reduce(timeline, (s) => s.atMs <= t, t >= timeline.durationMs, (e) => e.layerEndMs <= t);

/** Lane B's state drawn on frame i (causal), exactly as `attentionAt` at that frame's time; the closing display only at or after the presentation's end. */
export const attentionOnFrame = <P>(timeline: ReplayEventTimeline<P>, frame: number): ReplayAttentionState<P> =>
  reduce(timeline, (s) => s.frame <= frame, frame >= causalFrame(timeline.durationMs, timeline.fps), (e) => e.layerEndFrame <= frame);
