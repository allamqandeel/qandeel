import { readFileSync } from 'node:fs';
import {
  buildHumanIntelligenceProviderSemantics,
  HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS,
  type HumanIntelligenceProviderSemanticsInput,
} from './human-intelligence-provider-semantics';
import {
  HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS,
  type HumanIntelligenceProviderInstructionId,
} from './human-intelligence-provider-semantics.types';
import type { HimModelContext, HimFastModelContext } from '../human-model/him-fast-deep-consumption.types';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import type { HimInteractionAdaptationDirectives } from '../human-model/him-interaction-adaptation.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';

// QHIA-013: the compiler is the ONE place upstream Human Intelligence becomes
// provider semantics. These specs lock the frozen registry, the frozen
// source -> instruction-ID mapping, semantic-ID deduplication, canonical
// ordering, the provider-safe session projection, and the hard
// anti-second-authority invariants.

const SESSION_CONTEXT_ID = '20000000-0000-4000-8000-000000000001';

const adaptation = (directives: Partial<HimInteractionAdaptationDirectives>): HimInteractionAdaptation => ({
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID,
  adaptationState: Object.keys(directives).length ? 'ACTIVE' : 'NONE',
  directives: {
    responseDensity: 'DEFAULT', cognitiveLoad: 'DEFAULT', branching: 'DEFAULT',
    steeringPressure: 'DEFAULT', deliveryPacing: 'DEFAULT', stepBatching: 'DEFAULT',
    ...directives,
  },
  drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW'],
});

const ALL_ACTIVE_DIRECTIVES: HimInteractionAdaptationDirectives = {
  responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK',
  steeringPressure: 'REDUCED', deliveryPacing: 'CALMER', stepBatching: 'ONE_AT_A_TIME',
};

const active = <D extends string>(directive: D) => ({ contractVersion: 1 as const, guidanceState: 'ACTIVE' as const, directive });
const none = <D extends string>(directive: D) => ({ contractVersion: 1 as const, guidanceState: 'NONE' as const, directive });

const ids = (input: HumanIntelligenceProviderSemanticsInput): ReadonlyArray<HumanIntelligenceProviderInstructionId> =>
  buildHumanIntelligenceProviderSemantics(input)?.behavioralInstructionIds ?? [];

const himContext = (mode: 'FAST' | 'DEEP'): HimModelContext => {
  const base = {
    contractVersion: 1 as const, source: 'HIM_REASONING_CONTEXT' as const,
    sourceSnapshotContractVersion: 1 as const, contextKind: 'CONVERSATION_SESSION' as const,
    contextId: SESSION_CONTEXT_ID, coverageState: 'PARTIAL' as const,
    eligibleMetricCount: 2, knownMetricCount: 1, unknownMetricCount: 1,
    freshnessPolicy: 'UNASSESSED' as const, confidencePolicy: 'UNASSESSED' as const,
  };
  return mode === 'FAST'
    ? { ...base, consumptionMode: 'FAST', metrics: [
      { metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'VERY_HIGH' },
      { metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null },
    ] }
    : { ...base, consumptionMode: 'DEEP', metrics: [
      {
        metricKey: 'hse.stress', knowledgeState: 'KNOWN', unknownReason: null, ordinalCategory: 'VERY_HIGH',
        observationQualifier: 'LATEST_KNOWN', observedAt: '2026-01-01T00:00:00.000Z',
        freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID',
      },
      {
        metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', unknownReason: 'NO_MEASUREMENT', ordinalCategory: null,
        observationQualifier: null, observedAt: null,
        freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: null,
      },
    ] };
};

const brainContext: HimBrainContext = {
  contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
  signals: [
    { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 1, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
    { slot: 'GOAL_CONSISTENCY', numericValue: 5, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
  ],
};

describe('QHIA-013 frozen provider instruction registry', () => {
  it('is exactly the twelve frozen IDs in exactly the frozen canonical order', () => {
    expect([...HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS]).toEqual([
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
    ]);
    expect(HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS).toHaveLength(12);
  });

  it('carries the EXACT pre-existing server-authored instruction text for every ID', () => {
    // Byte-for-byte the strings shipped on canonical main. QHIA-013 consolidates
    // how they reach the provider and rewrites none of them.
    expect(HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS).toEqual({
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
  });

  it('holds the EXACT instruction strings the retired per-channel renderer shipped', () => {
    // The pre-QHIA-013 renderer is gone, so this reads the strings back from the
    // one place they now live and proves the retired constants' text survived
    // rather than being paraphrased during consolidation.
    const source = readFileSync(`${__dirname}/human-intelligence-provider-semantics.ts`, 'utf8');
    for (const text of Object.values(HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS)) {
      expect(source).toContain(text.replace(/'/gu, '\\\''));
    }
  });
});

describe('QHIA-013 frozen source -> instruction-ID mapping matrix', () => {
  it('QHIA-001 all DEFAULT produces no instruction at all', () => {
    expect(ids({ himInteractionAdaptation: adaptation({}) })).toEqual([]);
  });

  it('QHIA-001 full ACTIVE reductions produce exactly the six mapped IDs in canonical order', () => {
    expect(ids({ himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES) })).toEqual([
      'COMPACT_RESPONSE', 'REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK',
      'REDUCE_STEERING_PRESSURE', 'CALMER_DELIVERY', 'ONE_STEP_AT_A_TIME',
    ]);
  });

  it('QHIA-001 maps each directive independently and DEFAULT contributes nothing', () => {
    expect(ids({ himInteractionAdaptation: adaptation({ responseDensity: 'COMPACT' }) })).toEqual(['COMPACT_RESPONSE']);
    expect(ids({ himInteractionAdaptation: adaptation({ cognitiveLoad: 'REDUCED' }) })).toEqual(['REDUCE_COGNITIVE_LOAD']);
    expect(ids({ himInteractionAdaptation: adaptation({ branching: 'SINGLE_TRACK' }) })).toEqual(['SINGLE_CONVERSATIONAL_TRACK']);
    expect(ids({ himInteractionAdaptation: adaptation({ steeringPressure: 'REDUCED' }) })).toEqual(['REDUCE_STEERING_PRESSURE']);
    expect(ids({ himInteractionAdaptation: adaptation({ deliveryPacing: 'CALMER' }) })).toEqual(['CALMER_DELIVERY']);
    expect(ids({ himInteractionAdaptation: adaptation({ stepBatching: 'ONE_AT_A_TIME' }) })).toEqual(['ONE_STEP_AT_A_TIME']);
  });

  it('QHIA-005 GENTLE maps to GENTLE only', () => {
    expect(ids({ himSessionReflectionGuidance: active('GENTLE_REFLECTION_INVITATION') }))
      .toEqual(['GENTLE_REFLECTION_INVITATION']);
  });

  it('QHIA-005 AVOID maps to AVOID only', () => {
    expect(ids({ himSessionReflectionGuidance: active('AVOID_REDUNDANT_REFLECTION') }))
      .toEqual(['AVOID_REDUNDANT_REFLECTION']);
  });

  it('QHIA-005 DEFAULT and NONE contribute nothing', () => {
    expect(ids({ himSessionReflectionGuidance: active('DEFAULT') })).toEqual([]);
    expect(ids({ himSessionReflectionGuidance: none('GENTLE_REFLECTION_INVITATION') })).toEqual([]);
  });

  it('QHIA-007 ACTIVE maps to cognitive load + steering pressure + calmer delivery', () => {
    expect(ids({ himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN') }))
      .toEqual(['REDUCE_COGNITIVE_LOAD', 'REDUCE_STEERING_PRESSURE', 'CALMER_DELIVERY']);
  });

  it('QHIA-008 ACTIVE maps to cognitive load + single track + one step', () => {
    expect(ids({ himDecisionAttentionGuidance: active('REDUCE_PRESENTATION_BURDEN') }))
      .toEqual(['REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK', 'ONE_STEP_AT_A_TIME']);
  });

  it('QHIA-010 ACTIVE maps to small immediate goal action + steering pressure + one step', () => {
    expect(ids({ himGoalMotivationGuidance: active('REDUCE_GOAL_ACTION_BURDEN') }))
      .toEqual(['REDUCE_STEERING_PRESSURE', 'ONE_STEP_AT_A_TIME', 'SMALL_IMMEDIATE_GOAL_ACTION']);
  });

  it('QHIA-011 ACTIVE maps to exactly the three relationship communication instructions', () => {
    expect(ids({ himRelationshipCommunicationGuidance: active('STRUCTURE_RELATIONSHIP_COMMUNICATION') })).toEqual([
      'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
      'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',
      'CLARITY_NOT_FORCED_AGREEMENT',
    ]);
  });

  it('treats a NONE guidance as identical to an absent one for every channel', () => {
    expect(ids({
      himSituationStressGuidance: none('REDUCE_INTERACTION_BURDEN'),
      himDecisionAttentionGuidance: none('REDUCE_PRESENTATION_BURDEN'),
      himGoalMotivationGuidance: none('REDUCE_GOAL_ACTION_BURDEN'),
      himRelationshipCommunicationGuidance: none('STRUCTURE_RELATIONSHIP_COMMUNICATION'),
    })).toEqual([]);
  });

  it('maps an unrecognized directive value to nothing rather than guessing', () => {
    expect(ids({ himSituationStressGuidance: active('SOMETHING_ELSE' as never) })).toEqual([]);
  });
});

describe('QHIA-013 semantic-ID deduplication and canonical order', () => {
  it('Adaptation + Situation Stress: cognitive load, steering, calmer each appear once', () => {
    const result = ids({
      himInteractionAdaptation: adaptation({ cognitiveLoad: 'REDUCED', steeringPressure: 'REDUCED', deliveryPacing: 'CALMER' }),
      himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN'),
    });
    expect(result).toEqual(['REDUCE_COGNITIVE_LOAD', 'REDUCE_STEERING_PRESSURE', 'CALMER_DELIVERY']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('Adaptation + Decision Attention: cognitive load, single track, one step each appear once', () => {
    const result = ids({
      himInteractionAdaptation: adaptation({ cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK', stepBatching: 'ONE_AT_A_TIME' }),
      himDecisionAttentionGuidance: active('REDUCE_PRESENTATION_BURDEN'),
    });
    expect(result).toEqual(['REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK', 'ONE_STEP_AT_A_TIME']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('Adaptation + Goal Motivation: steering and one-step each appear once', () => {
    const result = ids({
      himInteractionAdaptation: adaptation({ steeringPressure: 'REDUCED', stepBatching: 'ONE_AT_A_TIME' }),
      himGoalMotivationGuidance: active('REDUCE_GOAL_ACTION_BURDEN'),
    });
    expect(result).toEqual(['REDUCE_STEERING_PRESSURE', 'ONE_STEP_AT_A_TIME', 'SMALL_IMMEDIATE_GOAL_ACTION']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('all six sources active produce the canonical set union only', () => {
    const result = ids({
      himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES),
      himSessionReflectionGuidance: active('GENTLE_REFLECTION_INVITATION'),
      himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN'),
      himDecisionAttentionGuidance: active('REDUCE_PRESENTATION_BURDEN'),
      himGoalMotivationGuidance: active('REDUCE_GOAL_ACTION_BURDEN'),
      himRelationshipCommunicationGuidance: active('STRUCTURE_RELATIONSHIP_COMMUNICATION'),
    });
    // Every ID except AVOID_REDUNDANT_REFLECTION, which the GENTLE directive
    // structurally excludes: one Reflection directive is active per turn.
    expect(result).toEqual([
      'COMPACT_RESPONSE', 'REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK',
      'REDUCE_STEERING_PRESSURE', 'CALMER_DELIVERY', 'ONE_STEP_AT_A_TIME',
      'GENTLE_REFLECTION_INVITATION', 'SMALL_IMMEDIATE_GOAL_ACTION',
      'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING', 'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',
      'CLARITY_NOT_FORCED_AGREEMENT',
    ]);
    expect(new Set(result).size).toBe(result.length);
  });

  it('four sources agreeing on one instruction still produce it exactly once: no count, vote, or multiplier', () => {
    const single = ids({ himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN') })
      .filter((id) => id === 'REDUCE_COGNITIVE_LOAD');
    const many = ids({
      himInteractionAdaptation: adaptation({ cognitiveLoad: 'REDUCED' }),
      himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN'),
      himDecisionAttentionGuidance: active('REDUCE_PRESENTATION_BURDEN'),
    }).filter((id) => id === 'REDUCE_COGNITIVE_LOAD');
    expect(single).toEqual(['REDUCE_COGNITIVE_LOAD']);
    expect(many).toEqual(['REDUCE_COGNITIVE_LOAD']);
  });

  it('emits canonical registry order, never source order', () => {
    // Relationship (IDs 10-12) is supplied first here and Adaptation (IDs 1-6)
    // last; the output is still registry order.
    const result = ids({
      himRelationshipCommunicationGuidance: active('STRUCTURE_RELATIONSHIP_COMMUNICATION'),
      himInteractionAdaptation: adaptation({ responseDensity: 'COMPACT' }),
    });
    expect(result).toEqual([
      'COMPACT_RESPONSE', 'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
      'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT', 'CLARITY_NOT_FORCED_AGREEMENT',
    ]);
    const indexes = result.map((id) => HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS.indexOf(id));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('is monotonic: adding a source never removes or weakens another source instruction', () => {
    const base = ids({ himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES) });
    const withMore = ids({
      himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES),
      himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN'),
      himRelationshipCommunicationGuidance: active('STRUCTURE_RELATIONSHIP_COMMUNICATION'),
    });
    for (const id of base) expect(withMore).toContain(id);
  });

  it('is deterministic and pure: identical input always yields an identical envelope', () => {
    const input = {
      himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES),
      himContext: himContext('DEEP'),
      himBrainContext: brainContext,
    };
    expect(buildHumanIntelligenceProviderSemantics(input))
      .toEqual(buildHumanIntelligenceProviderSemantics(input));
  });
});

describe('QHIA-013 envelope shape', () => {
  it('returns undefined when no provider-ready Human Intelligence content exists', () => {
    expect(buildHumanIntelligenceProviderSemantics({})).toBeUndefined();
    expect(buildHumanIntelligenceProviderSemantics({ himInteractionAdaptation: adaptation({}) })).toBeUndefined();
  });

  it('carries the frozen version and source identity', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({ himContext: himContext('FAST') })!;
    expect(envelope.contractVersion).toBe(1);
    expect(envelope.source).toBe('QANDEEL_HUMAN_INTELLIGENCE_PROVIDER_SEMANTICS_V1');
  });

  it('omits an absent lane entirely rather than sending an empty one', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({
      himInteractionAdaptation: adaptation({ responseDensity: 'COMPACT' }),
    })!;
    expect(Object.prototype.hasOwnProperty.call(envelope, 'sessionReasoningContext')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(envelope, 'brainContext')).toBe(false);
  });

  it('carries only the four contract keys: no source guidance object survives into the envelope', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({
      himContext: himContext('DEEP'),
      himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES),
      himSessionReflectionGuidance: active('GENTLE_REFLECTION_INVITATION'),
      himSituationStressGuidance: active('REDUCE_INTERACTION_BURDEN'),
      himDecisionAttentionGuidance: active('REDUCE_PRESENTATION_BURDEN'),
      himGoalMotivationGuidance: active('REDUCE_GOAL_ACTION_BURDEN'),
      himRelationshipCommunicationGuidance: active('STRUCTURE_RELATIONSHIP_COMMUNICATION'),
      himBrainContext: brainContext,
    })!;
    expect(Object.keys(envelope).sort()).toEqual([
      'behavioralInstructionIds', 'brainContext', 'contractVersion', 'sessionReasoningContext', 'source',
    ]);
    const serialized = JSON.stringify(envelope);
    for (const forbidden of [
      'guidanceState', 'adaptationState', 'drivers', 'directives', 'sourceSnapshotContractVersion"' + ':2',
      'STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW',
      'REDUCE_INTERACTION_BURDEN', 'REDUCE_PRESENTATION_BURDEN', 'REDUCE_GOAL_ACTION_BURDEN',
      'STRUCTURE_RELATIONSHIP_COMMUNICATION', 'QHIA',
    ]) expect(serialized).not.toContain(forbidden);
  });
});

describe('QHIA-013 provider-safe session reasoning projection', () => {
  it('strips the internal conversation-session contextId', () => {
    for (const mode of ['FAST', 'DEEP'] as const) {
      const projected = buildHumanIntelligenceProviderSemantics({ himContext: himContext(mode) })!.sessionReasoningContext!;
      expect(Object.prototype.hasOwnProperty.call(projected, 'contextId')).toBe(false);
      expect(JSON.stringify(projected)).not.toContain(SESSION_CONTEXT_ID);
    }
  });

  it('preserves metricKey: the provider still needs the semantic identity of the metric', () => {
    for (const mode of ['FAST', 'DEEP'] as const) {
      const projected = buildHumanIntelligenceProviderSemantics({ himContext: himContext(mode) })!.sessionReasoningContext!;
      expect(projected.metrics.map((metric) => metric.metricKey)).toEqual(['hse.stress', 'hse.energy']);
    }
  });

  it('preserves every remaining envelope field with its exact runtime value', () => {
    const runtime = himContext('DEEP');
    const projected = buildHumanIntelligenceProviderSemantics({ himContext: runtime })!.sessionReasoningContext!;
    expect(projected).toEqual({
      contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
      contextKind: 'CONVERSATION_SESSION', coverageState: 'PARTIAL',
      eligibleMetricCount: 2, knownMetricCount: 1, unknownMetricCount: 1,
      freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: 'DEEP',
      metrics: runtime.metrics,
    });
  });

  it('preserves the exact FAST metric semantics and adds no DEEP field', () => {
    const projected = buildHumanIntelligenceProviderSemantics({ himContext: himContext('FAST') })!.sessionReasoningContext!;
    expect(projected.consumptionMode).toBe('FAST');
    expect(Object.keys(projected.metrics[0]).sort()).toEqual(['knowledgeState', 'metricKey', 'ordinalCategory']);
  });

  it('preserves the exact DEEP metric semantics without reinterpreting any of them', () => {
    const projected = buildHumanIntelligenceProviderSemantics({ himContext: himContext('DEEP') })!.sessionReasoningContext!;
    expect(projected.consumptionMode).toBe('DEEP');
    if (projected.consumptionMode !== 'DEEP') throw new Error('expected the DEEP projection');
    expect(Object.keys(projected.metrics[0]).sort()).toEqual([
      'confidenceState', 'freshnessState', 'knowledgeState', 'metricKey', 'observationQualifier',
      'observedAt', 'ordinalCategory', 'unknownReason', 'validityStatus',
    ]);
    // UNKNOWN stays UNKNOWN; no ordinal, freshness, or confidence is invented.
    const unknown = projected.metrics[1];
    expect(unknown.knowledgeState).toBe('UNKNOWN');
    expect(unknown.ordinalCategory).toBeNull();
    expect(unknown.observedAt).toBeNull();
    expect(unknown.validityStatus).toBeNull();
    expect(unknown.freshnessState).toBe('UNASSESSED');
    expect(unknown.confidenceState).toBe('UNASSESSED');
  });

  it('is a FRESH projection: the runtime HimModelContext keeps every field it had', () => {
    const runtime = himContext('DEEP');
    const projected = buildHumanIntelligenceProviderSemantics({ himContext: runtime })!.sessionReasoningContext!;
    expect(runtime.contextId).toBe(SESSION_CONTEXT_ID);
    expect(projected as unknown).not.toBe(runtime as unknown);
    expect(projected.metrics as unknown).not.toBe(runtime.metrics as unknown);
  });
});

describe('QHIA-013 Brain Context stays a separate provider data lane', () => {
  it('is copied defensively rather than aliased', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({ himBrainContext: brainContext })!;
    expect(envelope.brainContext).toEqual(brainContext);
    expect(envelope.brainContext as unknown).not.toBe(brainContext as unknown);
    expect(envelope.brainContext!.signals as unknown).not.toBe(brainContext.signals as unknown);
  });

  it('preserves the frozen UNASSESSED freshness and confidence semantics', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({ himBrainContext: brainContext })!;
    expect(envelope.brainContext!.signals.every((signal) =>
      signal.freshnessState === 'UNASSESSED' && signal.confidenceState === 'UNASSESSED')).toBe(true);
  });

  it('never merges Brain signals into the session reasoning lane', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({
      himContext: himContext('DEEP'), himBrainContext: brainContext,
    })!;
    expect(envelope.sessionReasoningContext!.metrics).toHaveLength(2);
    expect(JSON.stringify(envelope.sessionReasoningContext)).not.toContain('DECISION_SELF_CONFIDENCE');
    expect(JSON.stringify(envelope.brainContext)).not.toContain('hse.stress');
    expect(Object.prototype.hasOwnProperty.call(envelope.sessionReasoningContext!, 'signals')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(envelope.brainContext!, 'metrics')).toBe(false);
  });

  it('carries no Brain identifier of any kind into the provider envelope', () => {
    const serialized = JSON.stringify(buildHumanIntelligenceProviderSemantics({ himBrainContext: brainContext }));
    for (const forbidden of [
      'contextId', 'context_id', 'contextKind', 'sourceTurnId', 'source_turn_id', 'slotOrder', 'slot_order',
      'metricKey', 'metric_key', 'hse.self-confidence', 'hbs.consistency', 'observedAt', 'bindingId',
      'canonicalBindingId', 'activeBindingId', 'measurementEventId', 'observationId', 'snapshotId', 'effect',
    ]) expect(serialized).not.toContain(forbidden);
  });
});

describe('QHIA-013 hard anti-second-authority invariants', () => {
  it('derives NO behavioral instruction from Brain Context numeric values', () => {
    // Every legal numeric value, at both extremes, on every frozen slot.
    for (const numericValue of [1, 2, 3, 4, 5] as const) {
      const envelope = buildHumanIntelligenceProviderSemantics({
        himBrainContext: { ...brainContext, signals: brainContext.signals.map((signal) => ({ ...signal, numericValue })) },
      })!;
      expect(envelope.behavioralInstructionIds).toEqual([]);
    }
  });

  it('derives NO behavioral instruction from session metric ordinal categories', () => {
    for (const ordinalCategory of ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const) {
      const context = himContext('FAST') as HimFastModelContext;
      const envelope = buildHumanIntelligenceProviderSemantics({
        himContext: {
          ...context,
          metrics: context.metrics.map((metric) => ({ ...metric, knowledgeState: 'KNOWN' as const, ordinalCategory })),
        },
      })!;
      expect(envelope.behavioralInstructionIds).toEqual([]);
    }
  });

  it('derives NO behavioral instruction from adaptation drivers', () => {
    // All three drivers present, every directive DEFAULT: the directives are the
    // authoritative output, so the drivers alone authorize nothing.
    const envelope = buildHumanIntelligenceProviderSemantics({
      himInteractionAdaptation: { ...adaptation({}), adaptationState: 'ACTIVE', drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW'] },
    });
    expect(envelope).toBeUndefined();
  });

  it('never branches on a numeric or ordinal value anywhere in the compiler source', () => {
    const source = readFileSync(`${__dirname}/human-intelligence-provider-semantics.ts`, 'utf8');
    // No comparison operator against a numeric/ordinal value, and no read of the
    // numeric/ordinal fields outside the verbatim copy-through projections.
    expect(source).not.toMatch(/numericValue\s*(<|>|<=|>=|===\s*\d|!==\s*\d)/u);
    expect(source).not.toMatch(/ordinalCategory\s*(<|>|<=|>=|===\s*'|!==\s*')/u);
    for (const forbidden of ['VERY_LOW', 'VERY_HIGH', 'MODERATE', '.some(', '.reduce(', 'Math.']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('performs no I/O and no async work: the compiler source has no await, Promise, or timer', () => {
    const source = readFileSync(`${__dirname}/human-intelligence-provider-semantics.ts`, 'utf8');
    for (const forbidden of [
      'await ', 'async ', 'Promise', 'setTimeout', 'setInterval', 'fetch(', 'require(',
      'Repository', 'Service', 'this.',
    ]) expect(source).not.toContain(forbidden);
  });

  it('returns a plain synchronous value, never a thenable', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({ himContext: himContext('FAST') });
    expect(envelope).toBeDefined();
    expect(typeof (envelope as unknown as { then?: unknown }).then).toBe('undefined');
  });

  it('performs no cross-lane arithmetic, ranking, comparison, or composite scoring', () => {
    const envelope = buildHumanIntelligenceProviderSemantics({
      himContext: himContext('DEEP'),
      himInteractionAdaptation: adaptation(ALL_ACTIVE_DIRECTIVES),
      himBrainContext: brainContext,
    })!;
    const serialized = JSON.stringify(envelope);
    for (const forbidden of ['score', 'Score', 'rank', 'Rank', 'weight', 'Weight', 'composite', 'overall', 'readiness', 'confidenceLevel']) {
      expect(serialized).not.toContain(forbidden);
    }
    // The only cross-source operation is set-union dedup of instruction IDs.
    expect(envelope.behavioralInstructionIds.every((id) =>
      HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS.includes(id))).toBe(true);
  });
});
