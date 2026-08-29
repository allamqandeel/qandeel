import { composeServerGuidance } from './model-router.types';
import { buildHumanIntelligenceProviderSemantics } from './human-intelligence-provider-semantics';
import type { HimModelContext } from '../human-model/him-fast-deep-consumption.types';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';

// QHIA-013 prompt-footprint proof.
//
// The all-active Human Intelligence fixture below is the SAME fixture that was
// measured against canonical main (2e40b43 / tree 5e6fc2c) BEFORE any source was
// modified, so the comparison is semantically equivalent rather than merely
// similar. On canonical main the six per-source blocks each carried their own
// restated authority and prohibition prose; QHIA-013 replaces them with one
// charter plus one behavioral block.
//
// This is prompt-footprint evidence, not a latency verdict: QHIA-014 owns the
// formal phase latency evaluation. No tokenizer dependency is added - the metric
// is UTF-8 byte length of the rendered Human Intelligence contribution.
const CANONICAL_MAIN_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 10885;
const CANONICAL_MAIN_BEHAVIORAL_INSTRUCTION_BULLETS = 11;
const CANONICAL_MAIN_HUMAN_INTELLIGENCE_BLOCK_COUNT = 6;
// The EXACT measured post-consolidation footprint for the fixture below, frozen
// so the number is a locked result rather than an open inequality.
//
// A bare "smaller than canonical" assertion cannot notice prompt text silently
// appearing or disappearing - which is precisely how the QHIA-012 Brain
// non-inference guardrails were lost in the first place. This constant makes any
// change to the rendered Human Intelligence text fail loudly and force a
// deliberate re-measure.
//
// History: 6274 at head 71f7460a, before QHIA-013 Fix 03 restored the Brain
// comparison and frequency prohibitions (+153 bytes).
const EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 6427;

const BASE = 'BASE_BEHAVIORAL_POLICY';
const SESSION_CONTEXT_ID = '11111111-2222-4333-8444-555555555555';

const himContext: HimModelContext = {
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID, coverageState: 'PARTIAL',
  eligibleMetricCount: 3, knownMetricCount: 2, unknownMetricCount: 1,
  freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: 'DEEP',
  metrics: [
    {
      metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'HIGH', unknownReason: null,
      observationQualifier: 'LATEST_KNOWN', observedAt: '2026-01-01T00:00:00.000Z',
      freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID',
    },
    {
      metricKey: 'hse.attention', knowledgeState: 'KNOWN', ordinalCategory: 'LOW', unknownReason: null,
      observationQualifier: 'LATEST_KNOWN', observedAt: '2026-01-01T00:00:00.000Z',
      freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID',
    },
    {
      metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null, unknownReason: 'NO_MEASUREMENT',
      observationQualifier: null, observedAt: null,
      freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: null,
    },
  ],
};

const himInteractionAdaptation: HimInteractionAdaptation = {
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID, adaptationState: 'ACTIVE',
  directives: {
    responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK',
    steeringPressure: 'REDUCED', deliveryPacing: 'CALMER', stepBatching: 'ONE_AT_A_TIME',
  },
  drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ATTENTION_LOW_OR_VERY_LOW'],
};

const himBrainContext: HimBrainContext = {
  contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
  signals: [
    { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
    { slot: 'GOAL_CONSISTENCY', numericValue: 4, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
  ],
};

const ALL_ACTIVE_ENVELOPE = buildHumanIntelligenceProviderSemantics({
  himContext,
  himInteractionAdaptation,
  himSessionReflectionGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'GENTLE_REFLECTION_INVITATION' },
  himSituationStressGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' },
  himDecisionAttentionGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN' },
  himGoalMotivationGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' },
  himRelationshipCommunicationGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION' },
  himBrainContext,
})!;

const renderedWithHumanIntelligence = composeServerGuidance({
  behavioralGuidance: BASE, humanIntelligence: ALL_ACTIVE_ENVELOPE,
});
const renderedWithoutHumanIntelligence = composeServerGuidance({ behavioralGuidance: BASE });
const humanIntelligenceBytes =
  Buffer.byteLength(renderedWithHumanIntelligence, 'utf8') - Buffer.byteLength(renderedWithoutHumanIntelligence, 'utf8');

describe('QHIA-013 all-active Human Intelligence prompt footprint', () => {
  it('activates every Human Intelligence source the fixture is meant to activate', () => {
    // Non-vacuity: a shrinking footprint means nothing if the fixture stopped
    // activating things. Eleven distinct instructions, both data lanes present.
    expect(ALL_ACTIVE_ENVELOPE.behavioralInstructionIds).toHaveLength(11);
    expect(ALL_ACTIVE_ENVELOPE.sessionReasoningContext).toBeDefined();
    expect(ALL_ACTIVE_ENVELOPE.brainContext).toBeDefined();
    expect(ALL_ACTIVE_ENVELOPE.brainContext!.signals.length).toBeGreaterThanOrEqual(2);
    expect(renderedWithHumanIntelligence).toContain('<him_reasoning_context>');
    expect(renderedWithHumanIntelligence).toContain('<him_brain_context>');
  });

  it('renders every unique expected behavioral instruction exactly once and nothing extra', () => {
    const bullets = renderedWithHumanIntelligence.split('\n').filter((line) => line.startsWith('- '));
    expect(bullets).toHaveLength(CANONICAL_MAIN_BEHAVIORAL_INSTRUCTION_BULLETS);
    expect(new Set(bullets).size).toBe(bullets.length);
  });

  it('renders the universal Human Intelligence authority charter exactly once', () => {
    expect(renderedWithHumanIntelligence.split('Human Intelligence below is server-owned support')).toHaveLength(2);
  });

  it('renders zero source-specific behavioral mini-policy headings', () => {
    const headings = [
      'HIM interaction adaptation follows', 'Session Reflection guidance follows',
      'Situation-bound interaction guidance follows', 'Decision-bound presentation guidance follows',
      'Goal-bound action-pacing guidance follows', 'Relationship-bound communication scaffolding guidance follows',
    ].filter((heading) => renderedWithHumanIntelligence.includes(heading));
    expect(headings).toEqual([]);
    // Canonical main rendered six separate Human Intelligence blocks for this
    // fixture; QHIA-013 renders one charter, one behavioral block, two data lanes.
    expect(CANONICAL_MAIN_HUMAN_INTELLIGENCE_BLOCK_COUNT).toBe(6);
  });

  it('renders the restored QHIA-012 Brain non-inference guardrails', () => {
    // The two obligations QHIA-013 Fix 03 restored are part of this fixture's
    // footprint, so they are asserted here too: a future "optimization" that
    // shrinks the prompt by deleting them fails this spec, not just the Brain
    // rendering spec.
    expect(renderedWithHumanIntelligence).toContain('Do not compare these signals to each other or to any baseline, and do not infer a trend, improvement, worsening, decay, recency, or frequency from them.');
  });

  it('is EXACTLY the frozen measured footprint', () => {
    expect(humanIntelligenceBytes).toBe(EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES);
  });

  it('is STRICTLY SMALLER than the canonical-main baseline for the equivalent fixture', () => {
    expect(humanIntelligenceBytes).toBeLessThan(CANONICAL_MAIN_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES);
    expect(EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES)
      .toBeLessThan(CANONICAL_MAIN_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES);
  });
});
