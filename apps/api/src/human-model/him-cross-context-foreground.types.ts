import type { HimSituationStressGuidance, HimSituationStressSourceRow } from './him-situation-stress-consumption.types';
import type { HimDecisionAttentionGuidance, HimDecisionAttentionSourceRow } from './him-decision-attention-consumption.types';

// QHIA-009 Cross-Context Foreground Aggregation v1.
//
// TRANSPORT ONLY. This boundary abstracts how the already-approved QHIA-007
// and QHIA-008 foreground results reach the turn - two external Data API
// requests become exactly ONE - and abstracts nothing else. It activates NO
// new metric, NO new context kind, and NO new behavioural meaning; it holds no
// threshold, no wording, no relevance rule, and no measurement authority.
//
// Stress meaning stays entirely inside QHIA-007. Attention meaning stays
// entirely inside QHIA-008. This module deliberately contains no metric key,
// no ordinal, no directive, and no semantic type: an aggregate that could
// "understand" either channel would already be the generic metric-to-behaviour
// mapper this task must not create.

// The frozen transport envelope. Exactly two slots exist today, each wrapping
// one already-proven foreground authority:
//
//   1  SITUATION_STRESS    -> migration 0056 (QHIA-007)
//   2  DECISION_ATTENTION  -> migration 0057 (QHIA-008)
//
// foreground_slot_order is TRANSPORT ORDER ONLY. It is not a priority, a rank,
// a weight, a preference, or a fallback order, and nothing in this application
// may read it as one.
export const HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT = 'SITUATION_STRESS' as const;
export const HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT = 'DECISION_ATTENTION' as const;

export const HIM_CROSS_CONTEXT_FOREGROUND_SLOTS = Object.freeze([
  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),
  Object.freeze({ order: 2, slot: HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT }),
] as const);

export type HimCrossContextForegroundSlot = (typeof HIM_CROSS_CONTEXT_FOREGROUND_SLOTS)[number]['slot'];

// One raw row of rpc/read_him_session_cross_context_foreground_v1 (migration
// 0058) exactly as the aggregate returns it: the two outer transport
// discriminators followed by the nested authority row VERBATIM. The nested
// shape is identical to what the direct QHIA-007 and QHIA-008 RPCs return, so
// each row is handed to its existing semantic consumer unchanged - never
// repaired, defaulted, merged, or re-projected here.
export interface HimCrossContextForegroundEnvelopeRow extends HimSituationStressSourceRow, HimDecisionAttentionSourceRow {
  foreground_slot_order: number;
  foreground_slot: string;
}

// The aggregate result: the two EXISTING guidance contracts, side by side and
// unchanged. There is no combined value, no composite score, no ranking, and
// no cross-channel field of any kind - the two channels never meet.
export interface HimCrossContextForegroundGuidance {
  contractVersion: 1;
  situationStress: HimSituationStressGuidance;
  decisionAttention: HimDecisionAttentionGuidance;
}
