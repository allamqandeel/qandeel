/**
 * The one hard rule (Task 01 §5, and the "Honesty rule carried forward" section of
 * `05_BEAT_TO_VISUAL_PRIMITIVE_MAPPING.md`):
 *
 *   No primitive may render with more visual weight than its `analysis_levels_present`
 *   and its `anchor_weight` / `confidence` actually support.
 *
 * Every emphasis decision in the render tree goes through this module. Nothing else is
 * allowed to pick a stroke width, an opacity or an emphasis step, so the rule is
 * enforced in one place instead of being re-argued per component. When a beat asks for
 * more than its evidence carries, the ask is *lowered and recorded* — never granted and
 * never silently dropped.
 */

import type { AnalysisLevel, AnchorWeight, BeatKind, EnvelopeConfidence } from './types';

const WEIGHT_ORDER: readonly AnchorWeight[] = ['LOW', 'MEDIUM', 'HIGH'];

export function weightRank(weight: AnchorWeight): number {
  return WEIGHT_ORDER.indexOf(weight);
}

function minWeight(a: AnchorWeight, b: AnchorWeight): AnchorWeight {
  return weightRank(a) <= weightRank(b) ? a : b;
}

/**
 * Ceiling implied by provenance alone.
 *
 * The pack does not state this table — doc 05 only says `anchor_weight` is "derived from
 * confidence.band + whether analysis_levels_present is OBSERVED-only vs mixed", and the
 * sample fixture carries no confidence at all. This is the spike's reading of that
 * sentence, and it is deliberately the conservative one: an inference nobody observed
 * cannot reach the top of the ramp.
 */
export function ceilingFromLevels(levels: readonly AnalysisLevel[]): AnchorWeight {
  if (levels.includes('OBSERVED')) return 'HIGH';
  if (levels.includes('DERIVED')) return 'MEDIUM';
  return 'LOW';
}

/** `confidence.band` is an open string in doc 03; anything unrecognised is ignored. */
export function ceilingFromConfidence(confidence?: EnvelopeConfidence): AnchorWeight | undefined {
  if (!confidence?.available) return undefined;

  const band = confidence.band?.trim().toUpperCase();
  if (band === 'LOW' || band === 'MEDIUM' || band === 'HIGH') return band;

  const score = confidence.score;
  if (typeof score === 'number' && Number.isFinite(score)) {
    if (score < 0.34) return 'LOW';
    if (score < 0.67) return 'MEDIUM';
    return 'HIGH';
  }
  return undefined;
}

export interface WeightDecision {
  /** What the beat asked for. `LOW` when `anchor_weight` was absent — never invented upward. */
  asked: AnchorWeight;
  /** What is actually drawn. */
  drawn: AnchorWeight;
  ceiling: AnchorWeight;
  capped: boolean;
  levels: readonly AnalysisLevel[];
}

export function decideAnchorWeight(
  asked: AnchorWeight | undefined,
  levels: readonly AnalysisLevel[],
  confidence?: EnvelopeConfidence
): WeightDecision {
  // Absent `anchor_weight` means "unstated", not "maximum". Task 01 §4: never fabricate
  // weight beyond what `anchor_weight` states.
  const requested: AnchorWeight = asked ?? 'LOW';

  const confidenceCeiling = ceilingFromConfidence(confidence);
  const levelCeiling = ceilingFromLevels(levels);
  const ceiling = confidenceCeiling ? minWeight(levelCeiling, confidenceCeiling) : levelCeiling;

  const drawn = minWeight(requested, ceiling);
  return {
    asked: requested,
    drawn,
    ceiling,
    capped: drawn !== requested,
    levels,
  };
}

/**
 * Thread stroke width. Doc 05 requires `CONTRAST` to read as tension and `CONTRADICT` as
 * conflict — "lighter weight than CONTRADICT" — so weight is a function of the beat kind
 * as well as provenance.
 */
export function threadStrokeWidth(levels: readonly AnalysisLevel[], beatKind: BeatKind): number {
  const base = levels.includes('OBSERVED') ? 2.4 : levels.includes('DERIVED') ? 1.8 : 1.2;
  return beatKind === 'CONTRAST' ? Number((base * 0.65).toFixed(2)) : base;
}

/**
 * Doc 05: `READING_EMERGENCE` "only fires when `primary_object_refs.length >= 2` and
 * `analysis_levels_present` includes `INFERRED`". A frame that fails this is not drawn.
 */
export function emergingFrameThresholdMet(
  primaryObjectRefs: readonly string[],
  levels: readonly AnalysisLevel[]
): boolean {
  return primaryObjectRefs.length >= 2 && levels.includes('INFERRED');
}

/**
 * How loudly a non-anchor surface (card, frame, gap) may present itself. An
 * `INFERRED`-only reading is legible but visibly provisional; it never gets the solid
 * treatment that observed material gets.
 */
export function surfaceProvenance(levels: readonly AnalysisLevel[]): {
  borderOpacity: number;
  fillOpacity: number;
  label: AnalysisLevel;
} {
  if (levels.includes('OBSERVED')) {
    return { borderOpacity: 0.9, fillOpacity: 0.08, label: 'OBSERVED' };
  }
  if (levels.includes('DERIVED')) {
    return { borderOpacity: 0.6, fillOpacity: 0.05, label: 'DERIVED' };
  }
  return { borderOpacity: 0.38, fillOpacity: 0.03, label: 'INFERRED' };
}
