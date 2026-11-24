/**
 * RB-2 / S4 (the Product Owner's S4 execution directive, 2026-11-24) — which timeline a Replay's COSMOS stage draws.
 * Pure: the same answer for the same inputs, whatever the position, so play, pause, seek and restart only move t.
 *
 *   ORDINAL_ONLY  no audio clock (every V1 version, a V2 version of text alone): the pre-RB-2 presentation guards over
 *                 the declared reading pace (D-RB2-12) — labelled as ordinal, never a historical-availability claim
 *   CERTIFIED     an audio clock whose map is held AND an availability answer bound to that very map: every disclosure at
 *                 max(availability, windowStart, completeAt, previous); AFTER_END never inside the Replay
 *   NEUTRAL       an audio clock with anything less — no map yet, the answer pending, refused, not found or unavailable,
 *                 or any moment it leaves UNRECORDED (U-N): the same windows and clock, nothing disclosed. Never the
 *                 last snapshot, never the guards alone standing in for a certified time
 */
import type { ReplayAvailabilitySourceState } from '../original-audio/replay-availability-source';
import { withReplayAvailability, type ReplayPresentationClock } from './presentation-clock';
import {
  buildReplayCosmosTimeline, neutralReplayCosmosTimeline, UNRECORDED_IN_CERTIFIED,
  type ReplayCosmosMomentInput, type ReplayCosmosTimeline, type ReplayScope,
} from './timeline';

export type ReplayStageBasis =
  /** No audio clock: the version is presented by its declared reading pace. */
  | { readonly kind: 'TEXT_ONLY' }
  /** An audio clock: its presentation clock once the map is held (null before), and the availability the stage reads (null: none). */
  | { readonly kind: 'AUDIO'; readonly presentation: ReplayPresentationClock | null; readonly availability: ReplayAvailabilitySourceState | null };

export type ReplayStageTimelineKind = 'ORDINAL_ONLY' | 'CERTIFIED' | 'NEUTRAL';

export interface ReplayStageTimeline {
  readonly kind: ReplayStageTimelineKind;
  readonly timeline: ReplayCosmosTimeline;
  /** NEUTRAL: why (for the record and the tests; never shown, never logged). */
  readonly reason: string | null;
}

/**
 * The stage's timeline. `windows` are the paced windows the world lays out when no presentation clock exists (a text-only
 * version, or an audio version whose map is not held yet); with a presentation clock its own inputs are used.
 */
export function replayStageTimeline(
  windows: readonly ReplayCosmosMomentInput[],
  scope: ReplayScope,
  basis: ReplayStageBasis,
  fps: number,
): ReplayStageTimeline | null {
  if (basis.kind === 'TEXT_ONLY') {
    const built = buildReplayCosmosTimeline(windows, scope, { fps, mode: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' });
    return built.ok ? { kind: 'ORDINAL_ONLY', timeline: built.timeline, reason: null } : null;
  }
  const { presentation, availability } = basis;
  const neutral = (inputs: readonly ReplayCosmosMomentInput[], reason: string, durationMs?: number): ReplayStageTimeline | null => {
    const built = neutralReplayCosmosTimeline(inputs, scope, { fps, ...(durationMs === undefined ? {} : { durationMs }) });
    return built.ok ? { kind: 'NEUTRAL', timeline: built.timeline, reason } : null;
  };
  if (presentation === null) return neutral(windows, 'NO_MAP');
  if (availability === null) return neutral(presentation.inputs, 'NO_AVAILABILITY_SOURCE', presentation.durationMs);
  if (availability.kind !== 'BOUND') {
    return neutral(presentation.inputs, availability.kind === 'REFUSED' ? `REFUSED:${availability.reason}` : availability.kind, presentation.durationMs);
  }
  const built = buildReplayCosmosTimeline(withReplayAvailability(presentation, availability.answer), scope, {
    fps, mode: 'CERTIFIED', durationMs: presentation.durationMs,
  });
  if (built.ok) return { kind: 'CERTIFIED', timeline: built.timeline, reason: null };
  return built.reason === UNRECORDED_IN_CERTIFIED ? neutral(presentation.inputs, UNRECORDED_IN_CERTIFIED, presentation.durationMs) : null;
}
