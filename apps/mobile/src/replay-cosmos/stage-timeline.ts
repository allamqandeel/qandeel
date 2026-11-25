/**
 * RB-2 / S4 (the Product Owner's S4 execution directive, 2026-11-24) — which timeline a Replay's COSMOS stage draws.
 * Pure: the same answer for the same inputs, whatever the position, so play, pause, seek and restart only move t.
 *
 * S4-CORRECTION-01 (the Product Owner's decision of 2026-11-24 on PR #413, superseding S4's display policy): Replay is
 * the original conversation PLUS the visibly evolving analysis of what QANDEEL understood. Two questions are kept apart:
 *
 *   ELIGIBILITY   is the analysis this authorised, viewable version's own? Decided by the history read (S7-03 governed
 *                 snapshots, the composite controller, the version's viewing state) and by the availability SOURCE's one
 *                 eligibility answer, NOT_FOUND (not this person's current version). Fail closed: the NEUTRAL stage.
 *   PLACEMENT     WHEN each eligible disclosure is drawn. A certified instant is used where there is one; where there is
 *                 none — the answer pending, refused, unavailable, no source (a bare clock, iOS), no map yet, or a moment
 *                 the answer leaves AFTER_END or UNRECORDED — the moment is placed by SOURCE ORDER: after its own speech
 *                 is complete, after the knowledge before it, labelled as a non-exact placement. Never a recorded instant,
 *                 never a claim of what was live, and never a reason to withhold the analysis.
 *
 *   ORDINAL_ONLY  no audio clock (every V1 version, a V2 version of text alone): the guards over the declared reading
 *                 pace (D-RB2-12) — labelled as ordinal, never a historical-availability claim
 *   CERTIFIED     an audio clock whose map is held, an availability answer bound to that very map, and EVERY moment
 *                 RECORDED: each disclosure at max(availability, windowStart, completeAt, previous)
 *   SOURCE_ORDER  an audio clock with anything less: the same windows and clock; a RECORDED moment keeps its certified
 *                 instant, every other moment is placed by the guards alone. `reason` says why it is not CERTIFIED
 *   NEUTRAL       the source answered NOT_FOUND: the same windows and clock, nothing disclosed (U-N)
 *
 * Before the correction, everything but CERTIFIED on an audio clock was NEUTRAL (one uncertified or AFTER_END moment
 * blanked the whole Replay, every iOS Replay included). That policy is superseded, not the safety line under it.
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

export type ReplayStageTimelineKind = 'ORDINAL_ONLY' | 'CERTIFIED' | 'SOURCE_ORDER' | 'NEUTRAL';

export interface ReplayStageTimeline {
  readonly kind: ReplayStageTimelineKind;
  readonly timeline: ReplayCosmosTimeline;
  /** SOURCE_ORDER: why the placement is not certified; NEUTRAL: why nothing is drawn (for the record and the tests; never shown, never logged). */
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
  const sourceOrder = (inputs: readonly ReplayCosmosMomentInput[], reason: string, durationMs?: number): ReplayStageTimeline | null => {
    const built = buildReplayCosmosTimeline(inputs, scope, { fps, mode: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', ...(durationMs === undefined ? {} : { durationMs }) });
    return built.ok ? { kind: 'SOURCE_ORDER', timeline: built.timeline, reason } : null;
  };
  // Eligibility, the one answer of the source that withholds the version itself: fail closed, whatever the map.
  if (availability?.kind === 'NOT_FOUND') {
    const inputs = presentation === null ? windows : presentation.inputs;
    const built = neutralReplayCosmosTimeline(inputs, scope, { fps, ...(presentation === null ? {} : { durationMs: presentation.durationMs }) });
    return built.ok ? { kind: 'NEUTRAL', timeline: built.timeline, reason: 'NOT_FOUND' } : null;
  }
  // Placement. No map yet: the paced windows, in source order (the world holds t at the start of the moment shown).
  if (presentation === null) return sourceOrder(windows, 'NO_MAP');
  if (availability === null) return sourceOrder(presentation.inputs, 'NO_AVAILABILITY_SOURCE', presentation.durationMs);
  if (availability.kind !== 'BOUND') {
    return sourceOrder(presentation.inputs, availability.kind === 'REFUSED' ? `REFUSED:${availability.reason}` : availability.kind, presentation.durationMs);
  }
  // A bound answer: certified where every moment is RECORDED; otherwise each certified instant is kept and the rest is
  // placed by source order — one uncertified moment never neutralises the others.
  const inputs = withReplayAvailability(presentation, availability.answer);
  const built = buildReplayCosmosTimeline(inputs, scope, { fps, mode: 'CERTIFIED', durationMs: presentation.durationMs });
  if (built.ok) return { kind: 'CERTIFIED', timeline: built.timeline, reason: null };
  return built.reason === UNRECORDED_IN_CERTIFIED ? sourceOrder(inputs, UNRECORDED_IN_CERTIFIED, presentation.durationMs) : null;
}
