/**
 * RB-2 / S4-E (the Product Owner's S4 execution directive, 2026-11-24) — Lane B READINESS ONLY: the typed boundary a
 * future in-speech attention source (QAN-BL-INTEL-06, open; INTEL-LIVE-01, not authorised) would hand the Replay, and its
 * deterministic reduction on the SAME presentation clock as Lane A. Nothing produces such events today: every Replay
 * carries the EMPTY track, nothing here is drawn, stored, fetched or logged, and no final schema is claimed.
 *
 *   Lane A  COMMITTED_KNOWLEDGE    S1 → M-2 → S3 → timeline.ts → COSMOS: K(TC), disclosed after the speech that made it
 *   Lane B  IN_SPEECH_ATTENTION    this file: events that may appear WHILE a window is heard (USER or QANDEEL speaking),
 *                                  never before the instant they refer to and never before they were historically
 *                                  available; separate from K(TC) — nothing here enters or reads Lane A's knowledge
 *
 *   disclosedAt(e) = max( availability(e), anchor(e), disclosedAt(previous event on the same subject) )
 *
 * An event SETs or WITHDRAWs one subject (a correction is a later SET of the same subject). The state at t is the
 * reduction of every event disclosed at or before t, in (disclosedAt, sequence) order: a pure function of t, so a seek
 * or a restart gives the identical state. Frames are causal (`causalFrame`, Lane A's own). As in Lane A's CERTIFIED mode,
 * an UNRECORDED event refuses the whole track (the caller holds the empty lane), AFTER_END is never inside the Replay,
 * and a track bound to another Replay, version, revision or presentation map is refused (no leakage across sessions,
 * recordings or versions). Its shape follows the #410 compatibility annex (QANDEEL_S8B07_S4_INCREMENTAL_UNDERSTANDING_
 * REPLAY_COMPATIBILITY_v1.md §3.1) only as far as S4 needs it; provenance, consent, retention and schema versioning are
 * the future producer's contract, not this file's.
 */
import { causalFrame, type ReplayCosmosAvailability, type ReplayCosmosMomentInput, type ReplayScope } from './timeline';

export type ReplayEventSource = 'USER' | 'QANDEEL';

/** One historical event of Lane B. `P` is the event's content: deliberately open (no final schema, no UI). */
export interface ReplayHistoricalEvent<P = unknown> {
  readonly eventId: string;
  /** What the event is about; a later event on the same subject replaces (SET) or withdraws it. */
  readonly subjectKey: string;
  readonly op: 'SET' | 'WITHDRAW';
  readonly source: ReplayEventSource;
  /** The moment whose window the event was produced in (several events may share one window). */
  readonly momentOrdinal: number;
  /** The instant, on the full presentation clock, the event refers to (inside that window): never shown before it. */
  readonly anchorMs: number;
  /** When it became historically available, as Lane A's: RECORDED{atMs}, AFTER_END, or UNRECORDED. */
  readonly availability: ReplayCosmosAvailability;
  /** The producer's own order (a tie-break at an equal instant, and the order of corrections on one subject). */
  readonly sequence: number;
  readonly payload: P;
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

/** The lane every Replay carries today: nothing produces Lane B events. */
export function emptyReplayEventTrack<P = unknown>(binding: ReplayEventTrackBinding): ReplayHistoricalEventTrack<P> {
  return { lane: 'IN_SPEECH_ATTENTION', binding, events: [] };
}

export interface ReplayEventStep<P = unknown> {
  readonly eventId: string;
  readonly subjectKey: string;
  readonly op: 'SET' | 'WITHDRAW';
  readonly source: ReplayEventSource;
  readonly payload: P;
  /** On the SCOPED clock, and its causal frame. */
  readonly atMs: number;
  readonly frame: number;
}

export interface ReplayAttentionEntry<P = unknown> {
  readonly eventId: string;
  readonly source: ReplayEventSource;
  readonly payload: P;
}

export type ReplayAttentionState<P = unknown> = ReadonlyMap<string, ReplayAttentionEntry<P>>;

export interface ReplayEventTimeline<P = unknown> {
  readonly startMs: number;
  readonly endMs: number;
  readonly fps: number;
  /** The state the scope opens on (every event disclosed at or before its start). */
  readonly opening: ReplayAttentionState<P>;
  readonly steps: readonly ReplayEventStep<P>[];
  /** Events disclosed at or after the scope's end: never drawn in it, never pulled into its last frame. */
  readonly afterEnd: readonly string[];
}

const EMPTY_STATE: ReplayAttentionState<never> = new Map();

export type ReplayEventTrackRefusal =
  | 'BINDING_MISMATCH' | 'DUPLICATE_EVENT' | 'UNKNOWN_MOMENT' | 'ANCHOR_OUTSIDE_WINDOW' | 'UNRECORDED_EVENT' | 'SCOPE';

/**
 * Lane B's timeline for one scope of a version, on the clock Lane A uses (`moments`: the same inputs, `durationMs`: the
 * same presentation length). Refused whole, never repaired.
 */
export function buildReplayEventTimeline<P>(
  track: ReplayHistoricalEventTrack<P>,
  expected: ReplayEventTrackBinding,
  moments: readonly ReplayCosmosMomentInput[],
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
  if (track.events.length === 0) return { ok: true, timeline: { startMs, endMs, fps: options.fps, opening: EMPTY_STATE, steps: [], afterEnd: [] } };

  const windowOf = new Map(moments.map((m) => [m.ordinal, m]));
  const ids = new Set<string>();
  for (const e of track.events) {
    if (ids.has(e.eventId)) return { ok: false, reason: 'DUPLICATE_EVENT' };
    ids.add(e.eventId);
    const m = windowOf.get(e.momentOrdinal);
    if (m === undefined) return { ok: false, reason: 'UNKNOWN_MOMENT' };
    if (!(e.anchorMs >= m.windowStartMs && e.anchorMs <= m.windowEndMs)) return { ok: false, reason: 'ANCHOR_OUTSIDE_WINDOW' };
    if (e.availability.kind === 'UNRECORDED') return { ok: false, reason: 'UNRECORDED_EVENT' };
  }
  // Each subject's events in the producer's order: a correction never shows before what it corrects.
  const ordered = [...track.events].sort((x, y) => x.sequence - y.sequence || (x.eventId < y.eventId ? -1 : x.eventId > y.eventId ? 1 : 0));
  const lastOnSubject = new Map<string, number>();
  const disclosed = ordered.map((e) => {
    const a = e.availability;
    const available = a.kind === 'RECORDED' ? a.atMs : Infinity;
    const at = Math.max(available, e.anchorMs, lastOnSubject.get(e.subjectKey) ?? -Infinity);
    lastOnSubject.set(e.subjectKey, at);
    return { e, at };
  });
  disclosed.sort((x, y) => x.at - y.at || x.e.sequence - y.e.sequence || (x.e.eventId < y.e.eventId ? -1 : x.e.eventId > y.e.eventId ? 1 : 0));

  const opening = new Map<string, ReplayAttentionEntry<P>>();
  const steps: ReplayEventStep<P>[] = [];
  const afterEnd: string[] = [];
  for (const { e, at } of disclosed) {
    if (at >= endMs) { afterEnd.push(e.eventId); continue; }
    if (at <= startMs) { apply(opening, e); continue; }
    const atMs = at - startMs;
    steps.push({ eventId: e.eventId, subjectKey: e.subjectKey, op: e.op, source: e.source, payload: e.payload, atMs, frame: causalFrame(atMs, options.fps) });
  }
  return { ok: true, timeline: { startMs, endMs, fps: options.fps, opening, steps, afterEnd } };
}

function apply<P>(state: Map<string, ReplayAttentionEntry<P>>, e: { readonly subjectKey: string; readonly op: 'SET' | 'WITHDRAW'; readonly eventId: string; readonly source: ReplayEventSource; readonly payload: P }): void {
  if (e.op === 'WITHDRAW') state.delete(e.subjectKey);
  else state.set(e.subjectKey, { eventId: e.eventId, source: e.source, payload: e.payload });
}

function reduce<P>(timeline: ReplayEventTimeline<P>, reached: (step: ReplayEventStep<P>) => boolean): ReplayAttentionState<P> {
  // The empty lane costs nothing: no copy, no allocation.
  if (timeline.steps.length === 0 || !reached(timeline.steps[0]!)) return timeline.opening;
  const state = new Map(timeline.opening);
  for (const step of timeline.steps) {
    if (!reached(step)) break;
    apply(state, step);
  }
  return state;
}

/** Lane B's state at scoped time t: a pure function of t (seek and restart give the identical state). */
export const attentionAt = <P>(timeline: ReplayEventTimeline<P>, t: number): ReplayAttentionState<P> => reduce(timeline, (s) => s.atMs <= t);

/** Lane B's state drawn on frame i (causal), exactly as `attentionAt` at that frame's time. */
export const attentionOnFrame = <P>(timeline: ReplayEventTimeline<P>, frame: number): ReplayAttentionState<P> => reduce(timeline, (s) => s.frame <= frame);
