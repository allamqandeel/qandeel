import type { HimModelContext } from '../human-model/him-fast-deep-consumption.types';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import type { HimSessionReflectionGuidance } from '../human-model/him-session-reflection-consumption.types';
import type { HimSituationStressGuidance } from '../human-model/him-situation-stress-consumption.types';
import type { HimDecisionAttentionGuidance } from '../human-model/him-decision-attention-consumption.types';
import type { HimGoalMotivationGuidance } from '../human-model/him-goal-motivation-consumption.types';
import type { HimRelationshipCommunicationGuidance } from '../human-model/him-relationship-communication-consumption.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';
import {
  HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS,
  HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_SOURCE,
  type HumanIntelligenceProviderInstructionId,
  type HumanIntelligenceProviderSemantics,
  type HimProviderSessionReasoningContext,
} from './human-intelligence-provider-semantics.types';

// QHIA-013: the ONE pure synchronous Human Intelligence provider compiler.
//
// It runs AFTER every upstream Human Intelligence runtime output already exists
// in memory, and it does nothing that could produce one. It performs zero I/O,
// zero awaits, zero service calls, zero provider or LLM calls, reads zero
// metrics, reads zero bindings, infers zero relevance, and derives zero new
// behavior from any numeric or ordinal value.
//
// It may only:
//   1. map already-authorized upstream directives to frozen instruction IDs;
//   2. deduplicate those IDs;
//   3. emit them in the frozen canonical order;
//   4. project the already-existing session context into a provider-safe shape;
//   5. copy the already-provider-safe Brain Context as a separate data lane.
//
// It is synchronous CPU-only object normalization. Nothing here can add a
// request, a wait, a timer, a barrier, a retry, or a provider call.

// ---------------------------------------------------------------------------
// The frozen server-authored instruction text, one per ID.
// ---------------------------------------------------------------------------
//
// These strings are the EXACT text already shipped on canonical main. QHIA-013
// consolidates HOW they reach the provider; it rewrites, strengthens, softens,
// summarizes and paraphrases NOTHING. Every byte is preserved.
export const HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS: Readonly<
  Record<HumanIntelligenceProviderInstructionId, string>
> = Object.freeze({
  COMPACT_RESPONSE: 'Keep this response more compact than the normal default.',
  REDUCE_COGNITIVE_LOAD: 'Use simpler structure and avoid unnecessary detail or cognitive burden.',
  SINGLE_CONVERSATIONAL_TRACK: 'Stay on one main conversational track; avoid multiple parallel branches.',
  REDUCE_STEERING_PRESSURE: 'Reduce steering pressure; do not push the user toward an action or conclusion.',
  CALMER_DELIVERY: 'Use calmer, steadier delivery without claiming or naming the user\'s internal state.',
  ONE_STEP_AT_A_TIME: 'When guidance is otherwise appropriate, present one immediate step or unit at a time rather than a bundle.',
  GENTLE_REFLECTION_INVITATION: 'When reflective exploration is already appropriate under the current conversational policy, you may offer at most one simple, optional, non-pressuring invitation to examine the immediate topic. Do not force introspection; if the user is seeking concrete action or reflection would add burden, stay concrete.',
  AVOID_REDUNDANT_REFLECTION: 'Avoid redundant reflective prompting or repeatedly asking the user to revisit material already explored. When otherwise appropriate, prefer synthesis, clarification, or moving forward concretely rather than adding more introspection.',
  SMALL_IMMEDIATE_GOAL_ACTION: 'When goal-related action guidance is otherwise appropriate, keep the immediate action small and bounded rather than expanding it into a larger task bundle.',
  EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING: 'When relationship-related communication guidance is otherwise appropriate, make any suggested wording explicit and concrete rather than relying on hints, implied meaning, or the other person inferring the main point.',
  ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT: 'Keep any suggested message or exchange focused on one main point or request at a time rather than bundling several issues together.',
  CLARITY_NOT_FORCED_AGREEMENT: 'Aim for clear expression and workable understanding; do not make immediate agreement, persuasion, or winning the exchange the goal.',
});

// ---------------------------------------------------------------------------
// The frozen source -> instruction-ID mapping.
// ---------------------------------------------------------------------------
//
// Every entry maps an ALREADY-AUTHORIZED upstream directive value to bounded
// provider instruction IDs. No entry reads a metric, a numeric value, an ordinal
// category, a driver, a threshold, or a binding: the directive contracts are
// already the authoritative output of their own runtime, and re-deriving
// behavior from the underlying numbers here would create a second, competing
// Human Intelligence authority.

// QHIA-001. Mapped from the DIRECTIVES object only - never from `drivers`.
// `drivers` is internal provenance explaining WHY the directive was set; the
// directive is the authoritative output, and using the drivers instead would
// both leak provenance and re-derive behavior a second way. DEFAULT contributes
// nothing.
const INTERACTION_ADAPTATION_INSTRUCTION_IDS: ReadonlyArray<
  readonly [
    keyof HimInteractionAdaptation['directives'],
    HimInteractionAdaptation['directives'][keyof HimInteractionAdaptation['directives']],
    HumanIntelligenceProviderInstructionId,
  ]
> = Object.freeze([
  ['responseDensity', 'COMPACT', 'COMPACT_RESPONSE'],
  ['cognitiveLoad', 'REDUCED', 'REDUCE_COGNITIVE_LOAD'],
  ['branching', 'SINGLE_TRACK', 'SINGLE_CONVERSATIONAL_TRACK'],
  ['steeringPressure', 'REDUCED', 'REDUCE_STEERING_PRESSURE'],
  ['deliveryPacing', 'CALMER', 'CALMER_DELIVERY'],
  ['stepBatching', 'ONE_AT_A_TIME', 'ONE_STEP_AT_A_TIME'],
] as const);

// QHIA-005. DEFAULT and NONE contribute nothing.
const SESSION_REFLECTION_INSTRUCTION_IDS: Readonly<
  Partial<Record<HimSessionReflectionGuidance['directive'], ReadonlyArray<HumanIntelligenceProviderInstructionId>>>
> = Object.freeze({
  GENTLE_REFLECTION_INVITATION: Object.freeze(['GENTLE_REFLECTION_INVITATION'] as const),
  AVOID_REDUNDANT_REFLECTION: Object.freeze(['AVOID_REDUNDANT_REFLECTION'] as const),
});

// QHIA-007.
const SITUATION_STRESS_INSTRUCTION_IDS: Readonly<
  Partial<Record<HimSituationStressGuidance['directive'], ReadonlyArray<HumanIntelligenceProviderInstructionId>>>
> = Object.freeze({
  REDUCE_INTERACTION_BURDEN: Object.freeze([
    'REDUCE_COGNITIVE_LOAD',
    'REDUCE_STEERING_PRESSURE',
    'CALMER_DELIVERY',
  ] as const),
});

// QHIA-008.
const DECISION_ATTENTION_INSTRUCTION_IDS: Readonly<
  Partial<Record<HimDecisionAttentionGuidance['directive'], ReadonlyArray<HumanIntelligenceProviderInstructionId>>>
> = Object.freeze({
  REDUCE_PRESENTATION_BURDEN: Object.freeze([
    'REDUCE_COGNITIVE_LOAD',
    'SINGLE_CONVERSATIONAL_TRACK',
    'ONE_STEP_AT_A_TIME',
  ] as const),
});

// QHIA-010.
const GOAL_MOTIVATION_INSTRUCTION_IDS: Readonly<
  Partial<Record<HimGoalMotivationGuidance['directive'], ReadonlyArray<HumanIntelligenceProviderInstructionId>>>
> = Object.freeze({
  REDUCE_GOAL_ACTION_BURDEN: Object.freeze([
    'SMALL_IMMEDIATE_GOAL_ACTION',
    'REDUCE_STEERING_PRESSURE',
    'ONE_STEP_AT_A_TIME',
  ] as const),
});

// QHIA-011.
const RELATIONSHIP_COMMUNICATION_INSTRUCTION_IDS: Readonly<
  Partial<Record<HimRelationshipCommunicationGuidance['directive'], ReadonlyArray<HumanIntelligenceProviderInstructionId>>>
> = Object.freeze({
  STRUCTURE_RELATIONSHIP_COMMUNICATION: Object.freeze([
    'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
    'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',
    'CLARITY_NOT_FORCED_AGREEMENT',
  ] as const),
});

// ---------------------------------------------------------------------------
// Internal compilation input.
// ---------------------------------------------------------------------------
//
// This is NOT part of ModelRouterRequest and never reaches a provider adapter.
// It is the already-computed upstream runtime output of one turn, handed to the
// compiler at the provider boundary and discarded there.
export interface HumanIntelligenceProviderSemanticsInput {
  himContext?: HimModelContext;
  himInteractionAdaptation?: HimInteractionAdaptation;
  himSessionReflectionGuidance?: HimSessionReflectionGuidance;
  himSituationStressGuidance?: HimSituationStressGuidance;
  himDecisionAttentionGuidance?: HimDecisionAttentionGuidance;
  himGoalMotivationGuidance?: HimGoalMotivationGuidance;
  himRelationshipCommunicationGuidance?: HimRelationshipCommunicationGuidance;
  himBrainContext?: HimBrainContext;
}

/**
 * Compile the already-existing Human Intelligence runtime outputs of one turn
 * into the ONE provider envelope. Pure, synchronous, and total: it never throws
 * on absent channels and returns undefined when there is nothing provider-ready
 * to send, so an empty envelope is never dispatched merely to prove the feature
 * ran.
 */
export function buildHumanIntelligenceProviderSemantics(
  input: HumanIntelligenceProviderSemanticsInput,
): HumanIntelligenceProviderSemantics | undefined {
  // Semantic-ID set union. Dedup is by INSTRUCTION ID, never by comparing
  // instruction strings: identity, not spelling, decides. Two, three, or six
  // sources authorizing the same instruction yield exactly one ID - there is no
  // count, no vote, no multiplier, no confidence increase, and no stronger
  // interpretation because signals agree. The union is monotonic: no source can
  // remove or weaken an instruction another source authorized.
  const authorized = new Set<HumanIntelligenceProviderInstructionId>();

  const directives = input.himInteractionAdaptation?.directives;
  if (directives) {
    for (const [directive, activeValue, instructionId] of INTERACTION_ADAPTATION_INSTRUCTION_IDS) {
      if (directives[directive] === activeValue) authorized.add(instructionId);
    }
  }
  addAuthorized(authorized, SESSION_REFLECTION_INSTRUCTION_IDS, input.himSessionReflectionGuidance);
  addAuthorized(authorized, SITUATION_STRESS_INSTRUCTION_IDS, input.himSituationStressGuidance);
  addAuthorized(authorized, DECISION_ATTENTION_INSTRUCTION_IDS, input.himDecisionAttentionGuidance);
  addAuthorized(authorized, GOAL_MOTIVATION_INSTRUCTION_IDS, input.himGoalMotivationGuidance);
  addAuthorized(authorized, RELATIONSHIP_COMMUNICATION_INSTRUCTION_IDS, input.himRelationshipCommunicationGuidance);

  // Canonical order comes from the frozen registry, never from the order the
  // sources happened to run in, so the payload is fully deterministic.
  const behavioralInstructionIds = HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS
    .filter((instructionId) => authorized.has(instructionId));

  const sessionReasoningContext = projectSessionReasoningContext(input.himContext);
  const brainContext = copyBrainContext(input.himBrainContext);

  if (!behavioralInstructionIds.length && !sessionReasoningContext && !brainContext) return undefined;

  return {
    contractVersion: 1,
    source: HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_SOURCE,
    behavioralInstructionIds,
    ...(sessionReasoningContext ? { sessionReasoningContext } : {}),
    ...(brainContext ? { brainContext } : {}),
  };
}

// One ACTIVE-gated directive lookup, shared by the five single-directive
// channels. A guidance whose state is not ACTIVE contributes nothing at all:
// absence and NONE are identical, and neither is ever a favorable signal.
function addAuthorized(
  authorized: Set<HumanIntelligenceProviderInstructionId>,
  registry: Readonly<Partial<Record<string, ReadonlyArray<HumanIntelligenceProviderInstructionId>>>>,
  guidance: { guidanceState: 'NONE' | 'ACTIVE'; directive: string } | undefined,
): void {
  if (guidance?.guidanceState !== 'ACTIVE') return;
  for (const instructionId of registry[guidance.directive] ?? []) authorized.add(instructionId);
}

// The provider-safe session projection. A FRESH object is built rather than
// mutating or deleting fields from the runtime HimModelContext, so the runtime
// contract keeps every field it had and no caller downstream of Human Model
// observes a stripped object.
//
// Exactly one field is dropped - contextId. Every remaining field is copied
// through verbatim: no value is normalized, rounded, defaulted, bucketed, or
// reinterpreted, and the FAST/DEEP metric shapes are preserved exactly,
// metricKey included.
function projectSessionReasoningContext(
  himContext: HimModelContext | undefined,
): HimProviderSessionReasoningContext | undefined {
  if (!himContext) return undefined;
  const base = {
    contractVersion: himContext.contractVersion,
    source: himContext.source,
    sourceSnapshotContractVersion: himContext.sourceSnapshotContractVersion,
    contextKind: himContext.contextKind,
    coverageState: himContext.coverageState,
    eligibleMetricCount: himContext.eligibleMetricCount,
    knownMetricCount: himContext.knownMetricCount,
    unknownMetricCount: himContext.unknownMetricCount,
    freshnessPolicy: himContext.freshnessPolicy,
    confidencePolicy: himContext.confidencePolicy,
  } as const;
  return himContext.consumptionMode === 'FAST'
    ? {
      ...base,
      consumptionMode: 'FAST',
      metrics: himContext.metrics.map((metric) => ({
        metricKey: metric.metricKey,
        knowledgeState: metric.knowledgeState,
        ordinalCategory: metric.ordinalCategory,
      })),
    }
    : {
      ...base,
      consumptionMode: 'DEEP',
      metrics: himContext.metrics.map((metric) => ({
        metricKey: metric.metricKey,
        knowledgeState: metric.knowledgeState,
        unknownReason: metric.unknownReason,
        ordinalCategory: metric.ordinalCategory,
        observationQualifier: metric.observationQualifier,
        observedAt: metric.observedAt,
        freshnessState: metric.freshnessState,
        confidenceState: metric.confidenceState,
        validityStatus: metric.validityStatus,
      })),
    };
}

// A defensive provider-facing copy of the already-provider-safe QHIA-012 Brain
// Context, so the envelope never carries a mutable alias of a runtime object.
// It stays a SEPARATE data lane: its signals are never merged into the session
// metric array, never compared with a session metric, never translated into a
// metric key, and never mapped into a behavioral instruction. Freshness and
// confidence stay exactly UNASSESSED - this lane derives neither, ever.
function copyBrainContext(brainContext: HimBrainContext | undefined): HimBrainContext | undefined {
  if (!brainContext) return undefined;
  return {
    contractVersion: brainContext.contractVersion,
    source: brainContext.source,
    availability: brainContext.availability,
    signals: brainContext.signals.map((signal) => ({
      slot: signal.slot,
      numericValue: signal.numericValue,
      semanticMappingStatus: signal.semanticMappingStatus,
      semanticType: signal.semanticType,
      freshnessState: signal.freshnessState,
      confidenceState: signal.confidenceState,
    })),
  };
}
