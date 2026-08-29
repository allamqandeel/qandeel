import type { HimContextualCurrentBatchSourceRow } from './him-contextual-current-intelligence.types';

// QHIA-011 Authoritative Relationship-Bound Communication Foreground
// Consumption v1.
//
// The fourth cross-context foreground consumption and the FIRST HRS foreground
// runtime activation: exactly one context kind (RELATIONSHIP) and exactly one
// metric (hrs.communication@1), consumed ONLY when the authenticated user has
// explicitly bound that exact Relationship to the exact owned conversation
// session through the QHIA-006 relevance authority.
//
// The three sibling HRS metrics that share the RELATIONSHIP runtime context -
// Relationship Trust, Repair, and Emotional Safety - stay INTENTIONALLY
// DORMANT. They are not requested, not read, not inferred from the
// Communication reading, not averaged with it, and not represented anywhere
// here.
//
// The canonical meaning is preserved exactly and is never reinterpreted: this
// is the user's own current report of how workable it is, in ONE EXACT
// relationship, for important points to be expressed, heard, clarified, and
// understood well enough for the exchange to continue constructively -
// including when there is disagreement. It is NOT and can never be rendered or
// treated as the amount or frequency of talking, sociability, verbosity,
// agreement, absence of conflict, relationship satisfaction, love, closeness,
// intimacy, honesty, either person's objective communication skill,
// conflict-resolution success, persuasion, compliance, compatibility,
// relationship health, Relationship Trust, Repair, Emotional Safety, a clinical
// construct, a Safety verdict, or Recommendation authority. It is
// context-scoped intelligence attached to one exact authoritatively relevant
// relationship - never a global user state, never a statement about the user,
// and never a statement about the other person.
//
// The resulting guidance changes the STRUCTURE of relationship communication
// guidance that is ALREADY independently appropriate, and nothing else. It does
// not make communication, contact, disclosure, or confrontation appropriate by
// itself, it never evaluates the relationship or either person, and it
// authorizes no recommendation, question, hypothesis, safety, or routing
// decision.
//
// Core rule: scaffold an already-authorized communication suggestion; never
// create the recommendation to communicate.

// The frozen exact activation. Anything else is out of scope for QHIA-011.
export const HIM_RELATIONSHIP_COMMUNICATION_CONTEXT_KIND = 'RELATIONSHIP' as const;
export const HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY = 'hrs.communication' as const;
export const HIM_RELATIONSHIP_COMMUNICATION_DEFINITION_VERSION = 1 as const;
export const HIM_RELATIONSHIP_COMMUNICATION_HIF_OWNER = 'HRS' as const;
// The rest of the frozen semantic identity of hrs.communication@1. QHIA-011
// attaches behavioural meaning to this metric's NUMERIC VALUE, so the value is
// only interpretable while the persisted definition still says the number means
// exactly this HRS-owned, Foundation-UNRESOLVED reading with NO semantic type.
//
// UNRESOLVED / null is the EXPECTED VALID canonical identity of this metric in
// v1 - not a defect, not a gap, and never a reason to reject the row. The HSE
// consumers next door legitimately require RESOLVED / STATE because their
// metrics carry that persisted mapping; this one legitimately requires the
// opposite. A row that is internally coherent but semantically something else -
// a RESOLVED reading of any type, or any non-null semantic type carried under
// this metric key - is a different quantity wearing the same name, and no
// ordinal mapping may be applied to it.
//
// This bound belongs HERE, at the narrow consumption boundary, and never in the
// shared QHIA-004 projection: that projection is deliberately generic across all
// 17 metrics, several of which are legitimately RESOLVED with a non-null type.
// A future explicit migration may resolve the HRS semantic mapping; QHIA-011 v1
// deliberately does not anticipate it and fails closed if it changes.
export const HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS = 'UNRESOLVED' as const;
export const HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE = null;

// The two deterministic relevance states the composition RPC can report.
// UNBOUND is a first-class authoritative answer, never an error and never a
// reason to substitute a newest/first/only/most-recently-measured relationship,
// a relationship matched by display label, or a relationship inferred from
// conversation text.
export const HIM_RELATIONSHIP_COMMUNICATION_BINDING_STATES = Object.freeze([
  'NO_ACTIVE_RELATIONSHIP',
  'ACTIVE_RELATIONSHIP_BOUND',
] as const);

export type HimRelationshipCommunicationBindingState = (typeof HIM_RELATIONSHIP_COMMUNICATION_BINDING_STATES)[number];

// One raw row of rpc/read_him_session_relationship_communication_v1 (migration
// 0060) exactly as the composition returns it: the QHIA-006 relevance
// discriminator plus, when bound, the QHIA-004 batch row for exactly
// hrs.communication@1 in the authoritatively resolved relationship. This is
// transport shape only; the service validates every field fail-closed before
// anything is mapped.
export interface HimRelationshipCommunicationSourceRow extends HimContextualCurrentBatchSourceRow {
  binding_state: string;
  binding_context_id: string | null;
}

// The bounded provider-facing directive. There is exactly ONE non-default
// direction and there is no "upshift": a favorable/higher Communication value
// can never authorize more complex communication, longer scripts, more topics,
// more disclosure, more confrontation, greater persuasion, more options,
// greater pressure, less explanation, stronger recommendations, or more
// provider freedom. Human Intelligence can reduce ambiguity and bundling when
// authorized; it can never increase communication burden because a score is
// favorable.
export type HimRelationshipCommunicationDirective = 'DEFAULT' | 'STRUCTURE_RELATIONSHIP_COMMUNICATION';

export interface HimRelationshipCommunicationGuidance {
  contractVersion: 1;
  guidanceState: 'NONE' | 'ACTIVE';
  directive: HimRelationshipCommunicationDirective;
}
