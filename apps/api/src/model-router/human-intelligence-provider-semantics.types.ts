import type { HimSnapshotCoverageState } from '../human-model/him-intelligence-snapshot.types';
import type { HimFastModelMetric, HimDeepModelMetric } from '../human-model/him-fast-deep-consumption.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';

// QHIA-013 Human Intelligence Provider Semantics Consolidation v1.
//
// ONE bounded, deterministic Human Intelligence provider contract.
//
// Many Human Intelligence sources may inform one response, but the model
// provider receives exactly ONE Human Intelligence envelope - never a stack of
// competing per-source mini-policies each restating its own authority prose.
//
// This consolidates DELIVERY SEMANTICS ONLY. It consolidates no measurement, no
// value, no evidence, no relevance, no score, and no authority. The eight
// upstream Human Intelligence runtime outputs remain independent and unchanged;
// they simply stop being independent provider-request API surface.
//
// Everything in this file is provider-READY: it is what a provider is allowed to
// see. It deliberately carries NO source-channel guidance object, NO adaptation
// driver, NO guidanceState, NO raw directive enum name, NO internal task name,
// NO threshold, NO raw measurement row, and NO session or context identifier.
// The provider learns WHAT bounded behavior and context are available, never
// WHICH internal measurement subsystem produced them.

// ---------------------------------------------------------------------------
// The FROZEN behavioral instruction registry, in exactly this canonical order.
// ---------------------------------------------------------------------------
//
// Twelve IDs. There is no thirteenth in v1.
//
// An ID is a SEMANTIC IDENTITY, not a string comparison key: deduplication
// happens on the ID, so two upstream sources authorizing the same bounded
// instruction produce it exactly once regardless of how their instruction text
// is spelled. The rendered order is this array's order and nothing else, so the
// provider payload is deterministic and independent of which source ran first.
//
// The IDs themselves are INTERNAL. They are never rendered to a provider: only
// the frozen instruction TEXT is. See HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS.
export const HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS = Object.freeze([
  'COMPACT_RESPONSE',
  'REDUCE_COGNITIVE_LOAD',
  'SINGLE_CONVERSATIONAL_TRACK',
  'REDUCE_STEERING_PRESSURE',
  'CALMER_DELIVERY',
  'ONE_STEP_AT_A_TIME',
  'GENTLE_REFLECTION_INVITATION',
  'AVOID_REDUNDANT_REFLECTION',
  'SMALL_IMMEDIATE_GOAL_ACTION',
  'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
  'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',
  'CLARITY_NOT_FORCED_AGREEMENT',
] as const);

export type HumanIntelligenceProviderInstructionId =
  (typeof HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS)[number];

// ---------------------------------------------------------------------------
// The provider-safe session reasoning projection.
// ---------------------------------------------------------------------------
//
// The runtime HimModelContext is UNCHANGED inside Human Model runtime. This is a
// separate, freshly-built provider projection of it that preserves the existing
// FAST/DEEP data semantics exactly and strips exactly one field: the internal
// conversation-session UUID.
//
// metricKey is DELIBERATELY PRESERVED. The provider still needs the semantic
// identity of the session metric it is reasoning over; removing it would leave
// anonymous ordinals the provider could only guess at.
//
// No value is reinterpreted here. UNKNOWN stays UNKNOWN, ordinal categories stay
// ordinal, observedAt never becomes freshness, and validity never becomes
// confidence.
interface HimProviderSessionReasoningContextBase {
  contractVersion: 1;
  source: 'HIM_REASONING_CONTEXT';
  sourceSnapshotContractVersion: 1;
  contextKind: 'CONVERSATION_SESSION';
  // contextId is INTENTIONALLY ABSENT. No conversation-session UUID reaches a
  // provider through Human Intelligence after QHIA-013.
  coverageState: HimSnapshotCoverageState;
  eligibleMetricCount: number;
  knownMetricCount: number;
  unknownMetricCount: number;
  freshnessPolicy: 'UNASSESSED';
  confidencePolicy: 'UNASSESSED';
}

export interface HimProviderFastSessionReasoningContext extends HimProviderSessionReasoningContextBase {
  consumptionMode: 'FAST';
  metrics: ReadonlyArray<HimFastModelMetric>;
}

export interface HimProviderDeepSessionReasoningContext extends HimProviderSessionReasoningContextBase {
  consumptionMode: 'DEEP';
  metrics: ReadonlyArray<HimDeepModelMetric>;
}

export type HimProviderSessionReasoningContext =
  | HimProviderFastSessionReasoningContext
  | HimProviderDeepSessionReasoningContext;

// ---------------------------------------------------------------------------
// The ONE provider envelope.
// ---------------------------------------------------------------------------
//
// sessionReasoningContext and brainContext are SEPARATE DATA LANES inside one
// organizational envelope. The envelope is organizational, never analytical:
// their arrays are never merged, their values are never compared, no shared
// score exists, and neither lane's numbers can create a behavioral instruction.
export const HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_SOURCE =
  'QANDEEL_HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_V1' as const;

export interface HumanIntelligenceProviderSemantics {
  contractVersion: 1;
  source: typeof HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_SOURCE;
  behavioralInstructionIds: ReadonlyArray<HumanIntelligenceProviderInstructionId>;
  sessionReasoningContext?: HimProviderSessionReasoningContext;
  brainContext?: HimBrainContext;
}
