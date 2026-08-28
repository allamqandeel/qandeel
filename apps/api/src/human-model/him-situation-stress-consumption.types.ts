import type { HimContextualCurrentBatchSourceRow } from './him-contextual-current-intelligence.types';

// QHIA-007 Authoritative Situation-Bound Stress Foreground Consumption v1.
//
// The first cross-context foreground consumption: exactly one context kind
// (SITUATION) and exactly one metric (hse.stress@1), consumed ONLY when the
// authenticated user has explicitly bound that exact Situation to the exact
// owned conversation session through the QHIA-006 relevance authority.
//
// The resulting guidance shapes the MANNER of interaction only. It is NOT and
// can never be rendered or treated as "the user is stressed right now", a
// diagnosis, anxiety, distress severity, emotional valence, crisis or safety
// evidence, a global/current-person state, a reason to change any
// recommendation, question, hypothesis, safety, or routing decision, or a
// reason to infer any fact about the Situation. It is context-scoped
// intelligence attached to one exact authoritatively relevant Situation -
// never a global user state.

// The frozen exact activation. Anything else is out of scope for QHIA-007.
export const HIM_SITUATION_STRESS_CONTEXT_KIND = 'SITUATION' as const;
export const HIM_SITUATION_STRESS_METRIC_KEY = 'hse.stress' as const;
export const HIM_SITUATION_STRESS_DEFINITION_VERSION = 1 as const;
export const HIM_SITUATION_STRESS_HIF_OWNER = 'HSE' as const;
// The rest of the frozen semantic identity of hse.stress@1. QHIA-007 attaches
// behavioural meaning to this metric's NUMERIC VALUE, so the value is only
// interpretable while the persisted definition still says the number means a
// RESOLVED / STATE reading. A row that is internally coherent but semantically
// something else - a RESOLVED / ALIGNMENT, READINESS, LOAD, or TRAIT reading
// carried under this metric key - is a different quantity wearing the same
// name, and no ordinal mapping may be applied to it.
//
// This bound belongs HERE, at the narrow consumption boundary, and never in
// the shared QHIA-004 projection: that projection is deliberately generic
// across all 17 metrics, several of which are legitimately RESOLVED /
// ALIGNMENT or legitimately UNRESOLVED with a null type.
export const HIM_SITUATION_STRESS_SEMANTIC_MAPPING_STATUS = 'RESOLVED' as const;
export const HIM_SITUATION_STRESS_SEMANTIC_TYPE = 'STATE' as const;

// The two deterministic relevance states the composition RPC can report.
// UNBOUND is a first-class authoritative answer, never an error and never a
// reason to substitute a newest/first/only Situation.
export const HIM_SITUATION_STRESS_BINDING_STATES = Object.freeze([
  'NO_ACTIVE_SITUATION',
  'ACTIVE_SITUATION_BOUND',
] as const);

export type HimSituationStressBindingState = (typeof HIM_SITUATION_STRESS_BINDING_STATES)[number];

// One raw row of rpc/read_him_session_situation_stress_v1 (migration 0056)
// exactly as the composition returns it: the QHIA-006 relevance discriminator
// plus, when bound, the QHIA-004 batch row for exactly hse.stress@1 in the
// authoritatively resolved Situation. This is transport shape only; the
// service validates every field fail-closed before anything is mapped.
export interface HimSituationStressSourceRow extends HimContextualCurrentBatchSourceRow {
  binding_state: string;
  binding_context_id: string | null;
}

// The bounded provider-facing directive. There is exactly ONE non-default
// direction and there is no "upshift": a favorable/lower Situation-stress
// value can never increase response length, cognitive complexity, steering
// pressure, simultaneous asks, assertiveness, or provider freedom.
export type HimSituationStressDirective = 'DEFAULT' | 'REDUCE_INTERACTION_BURDEN';

export interface HimSituationStressGuidance {
  contractVersion: 1;
  guidanceState: 'NONE' | 'ACTIVE';
  directive: HimSituationStressDirective;
}
