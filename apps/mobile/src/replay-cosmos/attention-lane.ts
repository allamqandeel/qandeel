/**
 * INTEL-LIVE-01 CP3 (D-CP3, the Product Owner's approval of 2026-11-26) — Lane B of a Replay: the calls' in-speech
 * attention, from the bound attention answer (`original-audio/replay-attention-source.ts`) to the marks COSMOS draws.
 * Pure: the same lane for the same inputs, so play, pause, seek and restart only move t.
 *
 *   track      each event of the answer on the presentation clock the stage plays: its anchor and its floor at
 *              `runStartMs(runIndex) + fileMs` (the server already placed both in the map: the anchor AT OR AFTER the
 *              words, the floor at its hold's elapsed offset); AFTER_END stays AFTER_END (the closing display). Its
 *              subject is one subject of one track of one call; its order the server's (call, then event_seq)
 *   timeline   `buildReplayEventTimeline` on the clock's own windows, by track — NON-EXACT by construction (no Lane B
 *              instant is certified)
 *   marks      the state at t as the live owner draws its layer: `track:subjectKey`, the thread a CONFIRMED-able subject
 *              names as its body, oldest first (a later call's same subject replaces an earlier call's, as the newest)
 *   call end   (CP3 R1, D-CP3-F2) each call's layer ends at its recording's presented end — the last run before the next
 *              CROSS_RECORDING pause, or the presentation's last — as live drops it at the call's end: nothing of one
 *              call in the next, and nothing provisional in the closing display
 *
 * No lane (null) unless the answer is BOUND to the very map the clock holds and the version is eligible: a pending,
 * refused, unavailable or NOT_FOUND answer, Lane A's NOT_FOUND (the version is not this person's current one), no map,
 * or an answer with no event — then nothing of Lane B is drawn and the frame is exactly Lane A's.
 */
import type { AttentionMark } from '../cosmos/core/stage';
import type { ReplayAttention, ReplayAttentionConfidence, ReplayAttentionTrack } from '../original-audio/replay-attention';
import type { ReplayAttentionPort, ReplayAttentionSourceState } from '../original-audio/replay-attention-source';
import type { ReplayAvailabilitySourceState } from '../original-audio/replay-availability-source';
import {
  buildReplayEventTimeline, type ReplayAttentionState, type ReplayEventTimeline, type ReplayHistoricalEventTrack,
} from './event-track';
import type { ReplayPresentationClock, ReplayStageClock } from './presentation-clock';
import type { ReplayScope } from './timeline';

/** What one Lane B event draws: its mark, and how it was placed (for the record and the tests; never shown). */
export interface ReplayAttentionPayload {
  readonly track: ReplayAttentionTrack;
  readonly subjectKey: string;
  readonly label: string;
  readonly confidence: ReplayAttentionConfidence;
  readonly threadRef: string | null;
  readonly basis: 'PRODUCED_POSITION' | 'SETTLED_THROUGH';
}

export type ReplayAttentionTimeline = ReplayEventTimeline<ReplayAttentionPayload>;

/**
 * CP3 R1 (D-CP3-F2): where each run's recording ends on the presentation clock — the end of the last RUN of the runs
 * joined by SAME_RECORDING pauses; a CROSS_RECORDING pause begins another recording (another call's).
 */
function recordingEndOfRun(clock: ReplayPresentationClock): ReadonlyMap<number, number> {
  const groupOf = new Map<number, number>();
  const ends: number[] = [];
  let group = 0;
  for (const block of clock.blocks) {
    if (block.kind === 'PAUSE' && block.boundary.kind === 'CROSS_RECORDING') group += 1;
    if (block.kind === 'RUN') {
      groupOf.set(block.runIndex, group);
      ends[group] = Math.max(ends[group] ?? 0, block.endMs);
    }
  }
  return new Map([...groupOf].map(([runIndex, g]) => [runIndex, ends[g]!]));
}

/**
 * Each call's presented end (R1): the end of the recording its events were placed in — live, the call's whole layer is
 * dropped when the call ends, so nothing of it is drawn past that boundary (another call, or the closing display).
 */
function callEnds(answer: ReplayAttention, clock: ReplayPresentationClock): ReadonlyMap<number, number> {
  const endOfRun = recordingEndOfRun(clock);
  const ends = new Map<number, number>();
  const note = (call: number, runIndex: number) => {
    const end = endOfRun.get(runIndex);
    if (end !== undefined) ends.set(call, Math.max(ends.get(call) ?? 0, end));
  };
  for (const e of answer.events) {
    if (e.anchor !== null) note(e.call, e.anchor.runIndex);
    if (e.floor.kind === 'IN_RECORDING') note(e.call, e.floor.runIndex);
  }
  return ends;
}

/** The answer as a Lane B track on `clock` (bound by the caller to the map the clock was laid out from). */
export function replayAttentionTrack(answer: ReplayAttention, clock: ReplayPresentationClock, mapDigest: string): ReplayHistoricalEventTrack<ReplayAttentionPayload> {
  const b = answer.binding;
  const ends = callEnds(answer, clock);
  return {
    lane: 'IN_SPEECH_ATTENTION',
    binding: { replayId: b.replayId, versionId: b.versionId, revision: b.revision, mapDigest },
    events: answer.events.map((e, i) => ({
      eventId: `${e.call}:${e.seq}`,
      subjectKey: `${e.call}:${e.track}:${e.subjectKey}`,
      op: e.op,
      source: e.track,
      anchorMs: e.anchor === null ? null : clock.runStartMs(e.anchor.runIndex) + e.anchor.fileMs,
      floor: e.floor.kind === 'AFTER_END' ? { kind: 'AFTER_END' } : { kind: 'PRODUCED', atMs: clock.runStartMs(e.floor.runIndex) + e.floor.fileMs },
      // The server's order is (call, event_seq): its index is that order across calls.
      sequence: i,
      payload: { track: e.track, subjectKey: e.subjectKey, label: e.label, confidence: e.confidence, threadRef: e.threadRef, basis: e.floor.basis },
      layerEndMs: ends.get(e.call) ?? null,
    })),
  };
}

/** The attention answer of a stage clock that carries the Lane B port; null for any other clock (Lane B empty). */
export function replayAttentionOf(clock: ReplayStageClock | null): ReplayAttentionSourceState | null {
  const port = clock as (ReplayStageClock & Partial<ReplayAttentionPort>) | null;
  return port !== null && typeof port.attention === 'function' ? port.attention() : null;
}

export interface ReplayAttentionLaneInput {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly presentation: ReplayPresentationClock | null;
  /** The digest of the map the clock holds (null: none held, or unreadable). */
  readonly mapDigest: string | null;
  readonly availability: ReplayAvailabilitySourceState | null;
  readonly attention: ReplayAttentionSourceState | null;
  readonly scope: ReplayScope;
  readonly fps: number;
}

/** Lane B's timeline for the stage, or null (nothing of Lane B drawn). Refused whole, never repaired; Lane A is never read. */
export function replayAttentionLane(input: ReplayAttentionLaneInput): ReplayAttentionTimeline | null {
  const { presentation, mapDigest, attention } = input;
  if (presentation === null || mapDigest === null || attention === null || attention.kind !== 'BOUND' || input.availability?.kind === 'NOT_FOUND') return null;
  if (attention.mapDigest !== mapDigest || attention.answer.events.length === 0) return null;
  const built = buildReplayEventTimeline(
    replayAttentionTrack(attention.answer, presentation, mapDigest),
    { replayId: input.replayId, versionId: input.versionId, revision: input.revision, mapDigest },
    presentation.windows,
    input.scope,
    { fps: input.fps, durationMs: presentation.durationMs },
  );
  return built.ok ? built.timeline : null;
}

/** The marks of a state, oldest first, as the live owner draws its layer (`track:subjectKey`; the newest of one kept). */
export function replayAttentionMarks(state: ReplayAttentionState<ReplayAttentionPayload>): readonly AttentionMark[] {
  const marks = new Map<string, AttentionMark>();
  for (const { payload } of state.values()) {
    const subjectKey = `${payload.track}:${payload.subjectKey}`;
    marks.delete(subjectKey);
    marks.set(subjectKey, { subjectKey, label: payload.label, entityId: payload.threadRef === null ? null : `THREAD:${payload.threadRef}`, confidence: payload.confidence });
  }
  return [...marks.values()];
}

/** A state's identity (which events it holds, in order): equal keys draw the identical marks. */
export function replayAttentionKey(state: ReplayAttentionState<ReplayAttentionPayload>): string {
  let key = '';
  for (const [subject, entry] of state) key += `${subject}=${entry.eventId};`;
  return key;
}
