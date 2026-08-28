import type { HimContextualCurrentBatchSourceRow } from './him-contextual-current-intelligence.types';

// QHIA-010 Authoritative Goal-Bound Motivation Foreground Consumption v1.
//
// The third cross-context foreground consumption: exactly one context kind
// (GOAL) and exactly one metric (hse.motivation@1), consumed ONLY when the
// authenticated user has explicitly bound that exact Goal to the exact owned
// conversation session through the QHIA-006 relevance authority.
//
// hse.motivation@1 is measurement-valid in BOTH the GOAL and the SITUATION
// context. This boundary activates the GOAL context ONLY. Situation-bound
// Motivation stays INTENTIONALLY DORMANT: it is not requested, not read, not
// inferred from the Goal reading, and not represented anywhere here.
//
// The canonical meaning is preserved exactly and is never reinterpreted: this
// is the current self-reported motivational drive toward ONE EXACT target. It
// is NOT and can never be rendered or treated as Energy, readiness, ability,
// availability, importance, obligation, execution, productivity, excitement,
// mood, priority, commitment, discipline, capacity, evidence count, Memory
// content, model inference, Goal quality, or a reason to keep, abandon, delay,
// accelerate, or re-prioritise the Goal. It is context-scoped intelligence
// attached to one exact authoritatively relevant Goal - never a global user
// state and never a statement about the user.
//
// The resulting guidance changes the SIZE and PACING of an action step and
// nothing else. It does not make action guidance appropriate by itself, it
// never changes the direction or evaluation of the Goal, and it authorizes no
// recommendation, question, hypothesis, safety, or routing decision.
//
// Core rule: change the size of the step, never the direction or evaluation of
// the Goal.

// The frozen exact activation. Anything else is out of scope for QHIA-010.
export const HIM_GOAL_MOTIVATION_CONTEXT_KIND = 'GOAL' as const;
export const HIM_GOAL_MOTIVATION_METRIC_KEY = 'hse.motivation' as const;
export const HIM_GOAL_MOTIVATION_DEFINITION_VERSION = 1 as const;
export const HIM_GOAL_MOTIVATION_HIF_OWNER = 'HSE' as const;
// The rest of the frozen semantic identity of hse.motivation@1. QHIA-010
// attaches behavioural meaning to this metric's NUMERIC VALUE, so the value is
// only interpretable while the persisted definition still says the number means
// a RESOLVED / STATE reading. A row that is internally coherent but semantically
// something else - a RESOLVED / ALIGNMENT, TRAIT, READINESS, CAPABILITY,
// UNCERTAINTY, PROGRESS, or LOAD reading carried under this metric key - is a
// different quantity wearing the same name, and no ordinal mapping may be
// applied to it. This matters especially here: canonical Motivation is
// explicitly a STATE, never readiness and never ability.
//
// This bound belongs HERE, at the narrow consumption boundary, and never in the
// shared QHIA-004 projection: that projection is deliberately generic across all
// 17 metrics, several of which are legitimately RESOLVED / ALIGNMENT or
// legitimately UNRESOLVED with a null type.
export const HIM_GOAL_MOTIVATION_SEMANTIC_MAPPING_STATUS = 'RESOLVED' as const;
export const HIM_GOAL_MOTIVATION_SEMANTIC_TYPE = 'STATE' as const;

// The two deterministic relevance states the composition RPC can report.
// UNBOUND is a first-class authoritative answer, never an error and never a
// reason to substitute a newest/first/only/most-recently-measured Goal.
export const HIM_GOAL_MOTIVATION_BINDING_STATES = Object.freeze([
  'NO_ACTIVE_GOAL',
  'ACTIVE_GOAL_BOUND',
] as const);

export type HimGoalMotivationBindingState = (typeof HIM_GOAL_MOTIVATION_BINDING_STATES)[number];

// One raw row of rpc/read_him_session_goal_motivation_v1 (migration 0059)
// exactly as the composition returns it: the QHIA-006 relevance discriminator
// plus, when bound, the QHIA-004 batch row for exactly hse.motivation@1 in the
// authoritatively resolved Goal. This is transport shape only; the service
// validates every field fail-closed before anything is mapped.
export interface HimGoalMotivationSourceRow extends HimContextualCurrentBatchSourceRow {
  binding_state: string;
  binding_context_id: string | null;
}

// The bounded provider-facing directive. There is exactly ONE non-default
// direction and there is no "upshift": a favorable/higher Goal-motivation value
// can never increase the number of steps, task size, complexity, options,
// pressure, steering, pacing, or provider freedom. Human Intelligence can reduce
// burden when authorized; it can never amplify burden because a score is
// favorable.
export type HimGoalMotivationDirective = 'DEFAULT' | 'REDUCE_GOAL_ACTION_BURDEN';

export interface HimGoalMotivationGuidance {
  contractVersion: 1;
  guidanceState: 'NONE' | 'ACTIVE';
  directive: HimGoalMotivationDirective;
}
