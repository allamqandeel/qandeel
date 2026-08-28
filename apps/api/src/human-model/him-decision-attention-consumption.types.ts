import type { HimContextualCurrentBatchSourceRow } from './him-contextual-current-intelligence.types';

// QHIA-008 Authoritative Decision-Bound Attention Foreground Consumption v1.
//
// The second cross-context foreground consumption: exactly one context kind
// (DECISION) and exactly one metric (hse.attention@1), consumed ONLY when the
// authenticated user has explicitly bound that exact Decision to the exact
// owned conversation session through the QHIA-006 relevance authority. The
// other runtime-available DECISION metric, hse.self-confidence@1, stays
// INTENTIONALLY DORMANT: it is not requested, not read, not inferred from
// Attention, and not represented anywhere in this boundary.
//
// The resulting guidance shapes the PRESENTATION of decision-related
// interaction only. It is NOT and can never be rendered or treated as "the
// user cannot focus", "the user's attention is low", distraction, cognitive
// overload, impairment, a diagnosis, an executive-function or capacity
// assessment, a readiness, competence, decision-quality, or confidence score,
// safety evidence, a reason to delay/make/avoid a decision, a reason to change
// any recommendation, question, hypothesis, safety, or routing decision, or a
// reason to infer any fact about the Decision. It is context-scoped
// intelligence attached to one exact authoritatively relevant Decision - never
// a global user state.
//
// Core rule: Decision Attention may change the presentation of
// decision-related interaction, never the decision itself.

// The frozen exact activation. Anything else is out of scope for QHIA-008.
export const HIM_DECISION_ATTENTION_CONTEXT_KIND = 'DECISION' as const;
export const HIM_DECISION_ATTENTION_METRIC_KEY = 'hse.attention' as const;
export const HIM_DECISION_ATTENTION_DEFINITION_VERSION = 1 as const;
export const HIM_DECISION_ATTENTION_HIF_OWNER = 'HSE' as const;
// The rest of the frozen semantic identity of hse.attention@1. QHIA-008
// attaches behavioural meaning to this metric's NUMERIC VALUE, so the value is
// only interpretable while the persisted definition still says the number
// means a RESOLVED / STATE reading. A row that is internally coherent but
// semantically something else - a RESOLVED / ALIGNMENT, READINESS, CAPABILITY,
// LOAD, TRAIT, UNCERTAINTY, or PROGRESS reading carried under this metric key
// - is a different quantity wearing the same name, and no ordinal mapping may
// be applied to it.
//
// This bound belongs HERE, at the narrow consumption boundary, and never in
// the shared QHIA-004 projection: that projection is deliberately generic
// across all 17 metrics, several of which are legitimately RESOLVED /
// ALIGNMENT or legitimately UNRESOLVED with a null type.
export const HIM_DECISION_ATTENTION_SEMANTIC_MAPPING_STATUS = 'RESOLVED' as const;
export const HIM_DECISION_ATTENTION_SEMANTIC_TYPE = 'STATE' as const;

// The two deterministic relevance states the composition RPC can report.
// UNBOUND is a first-class authoritative answer, never an error and never a
// reason to substitute a newest/first/only Decision.
export const HIM_DECISION_ATTENTION_BINDING_STATES = Object.freeze([
  'NO_ACTIVE_DECISION',
  'ACTIVE_DECISION_BOUND',
] as const);

export type HimDecisionAttentionBindingState = (typeof HIM_DECISION_ATTENTION_BINDING_STATES)[number];

// One raw row of rpc/read_him_session_decision_attention_v1 (migration 0057)
// exactly as the composition returns it: the QHIA-006 relevance discriminator
// plus, when bound, the QHIA-004 batch row for exactly hse.attention@1 in the
// authoritatively resolved Decision. This is transport shape only; the service
// validates every field fail-closed before anything is mapped.
export interface HimDecisionAttentionSourceRow extends HimContextualCurrentBatchSourceRow {
  binding_state: string;
  binding_context_id: string | null;
}

// The bounded provider-facing directive. There is exactly ONE non-default
// direction and there is no "upshift": a favorable/higher Decision-attention
// value can never increase response length, cognitive complexity, the number
// of options or parallel branches, steering pressure, simultaneous asks,
// assertiveness, or provider freedom.
export type HimDecisionAttentionDirective = 'DEFAULT' | 'REDUCE_PRESENTATION_BURDEN';

export interface HimDecisionAttentionGuidance {
  contractVersion: 1;
  guidanceState: 'NONE' | 'ACTIVE';
  directive: HimDecisionAttentionDirective;
}
