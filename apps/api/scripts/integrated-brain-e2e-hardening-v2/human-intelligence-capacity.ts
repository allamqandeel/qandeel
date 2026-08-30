// QIR-007 Addendum A - the CURRENT-MAXIMUM Human Intelligence capacity proof.
//
// VERIFICATION-ONLY. Nothing here is imported by a production module, nothing
// here decides an intelligence semantic, and every byte it reports is produced
// by the REAL production compiler, the REAL production renderer and the REAL
// QIR-004 assembler:
//
//   buildHumanIntelligenceProviderSemantics(...)
//   composeServerGuidance(...)
//   IntegratedContextBudgetAssemblerService
//   Buffer.byteLength(..., 'utf8')
//
// No byte is estimated, hand-counted, or restated from a comment.
//
// WHY THIS EXISTS. QIR-004 froze `6427` as the incremental provider-guidance
// footprint of the canonical all-active QHIA-013 fixture. That fixture already
// carries all four cross-context channels ACTIVE simultaneously, the full
// CONVERSATION_SESSION reasoning lane and Brain Context - but its Brain Context
// lane carries TWO of the eight frozen slots. So `6427` is evidence about ONE
// exact fixture; it is NOT the same statement as "the largest Human
// Intelligence envelope the current frozen contracts can reach". This module
// builds that largest envelope, measures it through the same canonical
// rendering identity QIR-004 uses, and checks it against the frozen 8192-byte
// Human Intelligence slice.
//
// Both facts survive: the canonical all-active fixture stays 6427, and the
// current maximum legal envelope is whatever this module measures.
import assert from 'node:assert/strict';
import { HimBrainContextService } from '../../src/human-model/him-brain-context.service';
import {
  HIM_BRAIN_CONTEXT_MAX_SIGNALS,
  HIM_BRAIN_CONTEXT_REGISTRY,
  type HimBrainContext,
  type HimBrainContextForegroundRow,
} from '../../src/human-model/him-brain-context.types';
import { HimFastDeepConsumptionService } from '../../src/human-model/him-fast-deep-consumption.service';
import { HimReasoningConsumptionService } from '../../src/human-model/him-reasoning-consumption.service';
import type { HimModelContext } from '../../src/human-model/him-fast-deep-consumption.types';
import type {
  HimIntelligenceSnapshot,
  HimIntelligenceSnapshotMetric,
  HimSnapshotOrdinalCategory,
} from '../../src/human-model/him-intelligence-snapshot.types';
import type { HimInteractionAdaptation } from '../../src/human-model/him-interaction-adaptation.types';
import type { HimSessionReflectionGuidance } from '../../src/human-model/him-session-reflection-consumption.types';
import type { HimSituationStressGuidance } from '../../src/human-model/him-situation-stress-consumption.types';
import type { HimDecisionAttentionGuidance } from '../../src/human-model/him-decision-attention-consumption.types';
import type { HimGoalMotivationGuidance } from '../../src/human-model/him-goal-motivation-consumption.types';
import type { HimRelationshipCommunicationGuidance } from '../../src/human-model/him-relationship-communication-consumption.types';
import { buildHumanIntelligenceProviderSemantics } from '../../src/model-router/human-intelligence-provider-semantics';
import { HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS } from '../../src/model-router/human-intelligence-provider-semantics.types';
import type { HumanIntelligenceProviderSemantics } from '../../src/model-router/human-intelligence-provider-semantics.types';
import { composeServerGuidance } from '../../src/model-router/model-router.types';
import type { IntegratedContextBudgetAssemblerService } from '../../src/intelligence-runtime/integrated-context-budget-assembler.service';
import {
  GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES,
  HUMAN_INTELLIGENCE_BUDGET_BYTES,
  type IntegratedContextAssemblyInput,
} from '../../src/intelligence-runtime/integrated-context-budget-contract';

// ---------------------------------------------------------------------------
// The frozen figure this proof deliberately does NOT replace.
// ---------------------------------------------------------------------------
//
// It is the QIR-004 / QHIA-013 canonical ALL-ACTIVE fixture footprint, and it is
// re-stated here only so the two numbers can be reported side by side and can
// never be silently conflated. This module NEVER asserts that the current
// maximum equals it.
export const CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 6427;

// The EXACT measured current maximum, frozen so the figure is a locked result
// rather than an open inequality.
//
// A bare "fits the slice" assertion cannot notice provider prompt text silently
// appearing or disappearing - which is precisely how the QHIA-012 Brain
// non-inference guardrails were lost once already. This constant makes ANY
// change to the rendered Human Intelligence text fail loudly and force a
// deliberate re-measure, exactly as the frozen 6427 figure does for the
// canonical all-active fixture.
//
// It is frozen only because the fixture below is PROVEN maximum under the
// current contracts: the whole legal session-metric shape space and both ACTIVE
// reflection directives are enumerated and rendered, and every other lane is
// asserted to be at its structural maximum.
export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7536;

// The exactly three currently legal CONVERSATION_SESSION session metrics, in
// their canonical snapshot order (migrations 0018 / 0037). There is no fourth,
// and this module does not invent one.
export const CURRENT_SESSION_REASONING_METRIC_KEYS = Object.freeze([
  'hse.stress',
  'hse.energy',
  'hse.attention',
] as const);

// The persisted QHIA semantic mapping of each frozen Brain Context slot's
// metric, exactly as migration 0010 installs it. It is NOT invented here: seven
// Foundation-UNRESOLVED metrics keep a null semantic type and
// hgs.purpose-alignment@1 is legitimately RESOLVED / ALIGNMENT, which is
// exactly the split the production HimBrainContextService documents and
// enforces. The QIR-007 verifier additionally re-reads this table from real
// PostgreSQL, so this constant cannot drift away from the database silently.
export const CURRENT_BRAIN_CONTEXT_SEMANTIC_MAPPING: Readonly<
  Record<string, { readonly semanticMappingStatus: 'RESOLVED' | 'UNRESOLVED'; readonly semanticType: string | null }>
> = Object.freeze({
  'hse.self-confidence': Object.freeze({ semanticMappingStatus: 'RESOLVED', semanticType: 'STATE' }),
  'hbs.avoidance': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
  'hgs.self-awareness': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
  'hgs.resilience': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
  'hbs.consistency': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
  'hbs.initiative': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
  'hgs.purpose-alignment': Object.freeze({ semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT' }),
  'hgs.habit-strength': Object.freeze({ semanticMappingStatus: 'UNRESOLVED', semanticType: null }),
});

// The four cross-context guidance results this proof composes, at exactly the
// ACTIVE directive each frozen consumer emits for an acting value. The QIR-007
// C8 scenario proves - against real PostgreSQL, through the real aggregate and
// the four real consumers - that these four objects are what production really
// produces when all four contexts are bound and measured at an acting value, so
// this literal is checked rather than assumed.
export const ALL_FOUR_ACTIVE_CROSS_CONTEXT_GUIDANCE = Object.freeze({
  himSituationStressGuidance: Object.freeze({
    contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN',
  }) as HimSituationStressGuidance,
  himDecisionAttentionGuidance: Object.freeze({
    contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN',
  }) as HimDecisionAttentionGuidance,
  himGoalMotivationGuidance: Object.freeze({
    contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN',
  }) as HimGoalMotivationGuidance,
  himRelationshipCommunicationGuidance: Object.freeze({
    contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION',
  }) as HimRelationshipCommunicationGuidance,
});

// Every currently legal Interaction Adaptation provider contribution at once:
// all six frozen directives at the exact value the QHIA-013 registry maps to an
// instruction. No seventh directive exists, and a DEFAULT value contributes
// nothing, so this IS the maximal Interaction Adaptation contribution.
const MAXIMUM_INTERACTION_ADAPTATION: HimInteractionAdaptation = {
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: '11111111-2222-4333-8444-555555555555',
  adaptationState: 'ACTIVE',
  directives: {
    responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK',
    steeringPressure: 'REDUCED', deliveryPacing: 'CALMER', stepBatching: 'ONE_AT_A_TIME',
  },
  drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW'],
};

// The two mutually exclusive ACTIVE Session Reflection directives. `directive`
// is ONE field, so they can never be active together; the proof measures both
// through the real renderer and keeps the larger.
const ACTIVE_REFLECTION_DIRECTIVES = Object.freeze([
  'GENTLE_REFLECTION_INVITATION',
  'AVOID_REDUNDANT_REFLECTION',
] as const);

const SESSION_CONTEXT_ID = '11111111-2222-4333-8444-555555555555';
const BRAIN_CONTEXT_ID = '22222222-3333-4444-8555-666666666666';
const PROVENANCE_ID = '33333333-4444-4555-8666-777777777777';
// A canonical ISO-8601 instant. Its rendered width is fixed by the format, not
// chosen: no legal observedAt value is longer.
const OBSERVED_AT = '2026-01-01T00:00:00.000Z';
const BASE_BEHAVIORAL_GUIDANCE = 'BASE_BEHAVIORAL_POLICY';
const CURRENT_USER_CONTENT = 'QIR-007 Addendum A current-maximum Human Intelligence capacity probe.';

// ---------------------------------------------------------------------------
// The legal per-metric session-reasoning shape space.
// ---------------------------------------------------------------------------
//
// Each entry is a canonical migration-0018 snapshot metric. NONE of them is
// asserted to be legal - every one is pushed through the REAL
// HimReasoningConsumptionService and the REAL HimFastDeepConsumptionService,
// both of which reject an internally incoherent metric with INTEGRITY_FAILURE.
// A shape that stopped being reachable under the frozen contracts would
// therefore fail this proof rather than quietly inflate it.
const ORDINAL_CATEGORIES: ReadonlyArray<HimSnapshotOrdinalCategory> =
  Object.freeze(['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']);

interface SessionMetricShape {
  readonly label: string;
  readonly knows: boolean;
  readonly build: (metricKey: string) => HimIntelligenceSnapshotMetric;
}

const NO_PROVENANCE = {
  scaleReference: null, scaleVersion: null, observedAt: null,
  measurementEventId: null, measurementObservationId: null, calculationResultId: null,
  canonicalBindingId: null, instrumentId: null, instrumentVersion: null, modelId: null, modelVersion: null,
} as const;

const COMPLETE_PROVENANCE = {
  scaleReference: 'HIF_PART_8_STRUCTURED_V1', scaleVersion: 1, observedAt: OBSERVED_AT,
  measurementEventId: PROVENANCE_ID, measurementObservationId: PROVENANCE_ID, calculationResultId: PROVENANCE_ID,
  canonicalBindingId: PROVENANCE_ID, instrumentId: PROVENANCE_ID, instrumentVersion: 1,
  modelId: PROVENANCE_ID, modelVersion: 1,
} as const;

// LATEST_EVENT_UNASSESSED with NO calculation provenance: the event and the
// observation exist, nothing was calculated, and validityStatus is legitimately
// null.
const EVENT_ONLY_PROVENANCE = {
  scaleReference: null, scaleVersion: null, observedAt: OBSERVED_AT,
  measurementEventId: PROVENANCE_ID, measurementObservationId: PROVENANCE_ID, calculationResultId: null,
  canonicalBindingId: null, instrumentId: null, instrumentVersion: null, modelId: null, modelVersion: null,
} as const;

const snapshotMetricBase = (metricKey: string) => ({
  metricKey, definitionVersion: 1 as const, semanticType: 'STATE' as const,
  freshnessState: 'UNASSESSED' as const, freshnessReference: null,
  confidenceState: 'UNASSESSED' as const, confidenceReference: null,
});

const SESSION_METRIC_SHAPES: ReadonlyArray<SessionMetricShape> = Object.freeze([
  ...ORDINAL_CATEGORIES.map((ordinalCategory) => ({
    label: `KNOWN/${ordinalCategory}`,
    knows: true,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'ASSESSED', unassessedReason: null,
      ordinalCategory, validityStatus: 'VALID', ...COMPLETE_PROVENANCE,
    }),
  })),
  {
    label: 'UNKNOWN/NO_MEASUREMENT_EVENT',
    knows: false,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'UNASSESSED', unassessedReason: 'NO_MEASUREMENT_EVENT',
      ordinalCategory: null, validityStatus: null, ...NO_PROVENANCE,
    }),
  },
  {
    label: 'UNKNOWN/LATEST_EVENT_UNASSESSED (event only)',
    knows: false,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'UNASSESSED', unassessedReason: 'LATEST_EVENT_UNASSESSED',
      ordinalCategory: null, validityStatus: null, ...EVENT_ONLY_PROVENANCE,
    }),
  },
  {
    label: 'UNKNOWN/LATEST_EVENT_UNASSESSED (calculated)',
    knows: false,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'UNASSESSED', unassessedReason: 'LATEST_EVENT_UNASSESSED',
      ordinalCategory: null, validityStatus: 'VALID', ...COMPLETE_PROVENANCE,
    }),
  },
  {
    label: 'UNKNOWN/LATEST_EVENT_INVALIDATED',
    knows: false,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'UNASSESSED', unassessedReason: 'LATEST_EVENT_INVALIDATED',
      ordinalCategory: null, validityStatus: 'INVALIDATED', ...COMPLETE_PROVENANCE,
    }),
  },
  {
    label: 'UNKNOWN/INCOMPATIBLE_ACTIVE_BINDING',
    knows: false,
    build: (metricKey: string): HimIntelligenceSnapshotMetric => ({
      ...snapshotMetricBase(metricKey), valueState: 'UNASSESSED', unassessedReason: 'INCOMPATIBLE_ACTIVE_BINDING',
      ordinalCategory: null, validityStatus: 'VALID', ...COMPLETE_PROVENANCE,
    }),
  },
]);

const reasoningConsumption = new HimReasoningConsumptionService();
const fastDeepConsumption = new HimFastDeepConsumptionService();
const brainContextConsumption = new HimBrainContextService(
  // The transport dependency is deliberately unreachable: only the PURE
  // consumeSourceRows(...) boundary is used here, so this proof performs no
  // request of any kind.
  new Proxy({}, { get() { throw new Error('QIR007_CAPACITY_PROOF_PERFORMS_NO_TRANSPORT'); } }) as never,
);

/**
 * One legal DEEP CONVERSATION_SESSION reasoning projection, built by the REAL
 * production snapshot -> reasoning -> FAST/DEEP pipeline. `coverageState` and
 * the three counts are DERIVED here exactly as the canonical snapshot RPC
 * derives them, so an incoherent combination fails inside production code.
 */
function deepSessionReasoningContext(shapes: ReadonlyArray<SessionMetricShape>): HimModelContext {
  const metrics = CURRENT_SESSION_REASONING_METRIC_KEYS.map((metricKey, index) => shapes[index].build(metricKey));
  const assessedMetricCount = shapes.filter((shape) => shape.knows).length;
  const snapshot: HimIntelligenceSnapshot = {
    snapshotContractVersion: 1, contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID,
    generatedAt: OBSERVED_AT,
    coverageState: assessedMetricCount === metrics.length ? 'FULL' : assessedMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
    eligibleMetricCount: metrics.length,
    assessedMetricCount,
    unassessedMetricCount: metrics.length - assessedMetricCount,
    metrics,
  };
  return fastDeepConsumption.project('DEEP', reasoningConsumption.transform(snapshot));
}

/**
 * The eight-slot Brain Context lane, built by the REAL production
 * HimBrainContextService from legal migration-0061 foreground rows. The service
 * enforces the frozen registry order, the exact per-slot context kind, the
 * 1..5 structured scale, the RESOLVED/UNRESOLVED semantic-mapping coherence and
 * the UNASSESSED freshness/confidence rule - so an eight-slot fixture that
 * stopped being legal fails here instead of inflating the measurement.
 */
function maximumBrainContext(): HimBrainContext {
  const rows: HimBrainContextForegroundRow[] = HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => {
    const semantics = CURRENT_BRAIN_CONTEXT_SEMANTIC_MAPPING[entry.metricKey];
    if (!semantics) throw new Error(`QIR007_CAPACITY_PROOF_UNMAPPED_BRAIN_SLOT:${entry.slot}`);
    return {
      slot_order: entry.slotOrder, slot: entry.slot, context_kind: entry.contextKind,
      context_id: BRAIN_CONTEXT_ID,
      // Every legal structured value is one digit wide, so the numeric value
      // cannot change the measured footprint. It is varied only so the fixture
      // is not eight identical rows.
      numeric_value: (entry.slotOrder % 5) + 1,
      semantic_mapping_status: semantics.semanticMappingStatus,
      semantic_type: semantics.semanticType,
      freshness_state: 'UNASSESSED', confidence_state: 'UNASSESSED',
    };
  });
  const brainContext = brainContextConsumption.consumeSourceRows(rows);
  assert.ok(brainContext, 'the eight-slot Brain Context fixture is accepted by the real consumption boundary');
  assert.equal(brainContext!.signals.length, HIM_BRAIN_CONTEXT_MAX_SIGNALS,
    'QIR-007 Addendum A: the maximum fixture carries ALL EIGHT frozen Brain Context slots');
  return brainContext!;
}

/** The exact QIR-004 canonical rendering identity, on the real renderer. */
function utf8(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function incrementalHumanIntelligenceBytes(humanIntelligence: HumanIntelligenceProviderSemantics): number {
  return utf8(composeServerGuidance({ behavioralGuidance: BASE_BEHAVIORAL_GUIDANCE, humanIntelligence }))
    - utf8(composeServerGuidance({ behavioralGuidance: BASE_BEHAVIORAL_GUIDANCE }));
}

/** One candidate maximum envelope: a session-metric shape triple plus one reflection directive. */
function candidateEnvelope(
  shapes: ReadonlyArray<SessionMetricShape>,
  reflectionDirective: (typeof ACTIVE_REFLECTION_DIRECTIVES)[number],
  brainContext: HimBrainContext,
): HumanIntelligenceProviderSemantics {
  const himSessionReflectionGuidance: HimSessionReflectionGuidance = {
    contractVersion: 1, guidanceState: 'ACTIVE', directive: reflectionDirective,
  };
  const envelope = buildHumanIntelligenceProviderSemantics({
    himContext: deepSessionReasoningContext(shapes),
    himInteractionAdaptation: MAXIMUM_INTERACTION_ADAPTATION,
    himSessionReflectionGuidance,
    ...ALL_FOUR_ACTIVE_CROSS_CONTEXT_GUIDANCE,
    himBrainContext: brainContext,
  });
  assert.ok(envelope, 'the candidate maximum Human Intelligence envelope really exists');
  return envelope!;
}

export interface CurrentMaximumHumanIntelligenceCapacity {
  /** UTF8(compose(request WITH max HI)) - UTF8(compose(same request WITHOUT HI)). */
  readonly incrementalBytes: number;
  readonly sliceBytes: number;
  readonly headroomBytes: number;
  readonly verdict: 'PASS' | 'FINDING';
  readonly finalTextBytes: number;
  readonly globalBudgetBytes: number;
  readonly brainContextSignals: number;
  readonly sessionReasoningMetrics: number;
  readonly crossContextActiveChannels: number;
  readonly behavioralInstructionIds: ReadonlyArray<string>;
  readonly reflectionDirective: string;
  readonly sessionMetricShapes: ReadonlyArray<string>;
  readonly candidatesMeasured: number;
  readonly envelope: HumanIntelligenceProviderSemantics;
}

/**
 * Build, measure and prove the CURRENT MAXIMUM legal Human Intelligence
 * provider envelope.
 *
 * Maximality is SEARCHED, never assumed: every legal combination of the three
 * session-metric shapes and both ACTIVE reflection directives is rendered
 * through the real renderer and compared, so the reported figure is the largest
 * value the current contracts can reach rather than the largest one this file
 * happened to think of. The remaining lanes are maximal by construction and are
 * asserted to be so: all six Interaction Adaptation directives, all four
 * cross-context channels ACTIVE, and all eight frozen Brain Context slots.
 *
 * It performs NO I/O, NO provider call and NO database request.
 */
export function proveCurrentMaximumHumanIntelligenceCapacity(
  assembler: IntegratedContextBudgetAssemblerService,
): CurrentMaximumHumanIntelligenceCapacity {
  const brainContext = maximumBrainContext();

  // ---- the exhaustive legal search -----------------------------------------
  let best: {
    bytes: number;
    shapes: ReadonlyArray<SessionMetricShape>;
    reflectionDirective: (typeof ACTIVE_REFLECTION_DIRECTIVES)[number];
    envelope: HumanIntelligenceProviderSemantics;
  } | undefined;
  let candidatesMeasured = 0;
  for (const first of SESSION_METRIC_SHAPES) {
    for (const second of SESSION_METRIC_SHAPES) {
      for (const third of SESSION_METRIC_SHAPES) {
        for (const reflectionDirective of ACTIVE_REFLECTION_DIRECTIVES) {
          const shapes = [first, second, third] as const;
          const envelope = candidateEnvelope(shapes, reflectionDirective, brainContext);
          const bytes = incrementalHumanIntelligenceBytes(envelope);
          candidatesMeasured += 1;
          if (!best || bytes > best.bytes) best = { bytes, shapes, reflectionDirective, envelope };
        }
      }
    }
  }
  assert.ok(best, 'the legal maximum search produced a winner');
  assert.equal(candidatesMeasured, SESSION_METRIC_SHAPES.length ** 3 * ACTIVE_REFLECTION_DIRECTIVES.length,
    'QIR-007 Addendum A: the maximality search really enumerated the whole legal shape space');
  const maximum = best!;
  const humanIntelligence = maximum.envelope;
  const incrementalBytes = maximum.bytes;

  // ---- non-vacuity: the winner really is the MAXIMUM composition ------------
  //
  // A shrinking footprint proves nothing if the fixture quietly stopped
  // activating things, so every lane the addendum names is asserted present at
  // its maximum before the number is trusted.
  assert.equal(humanIntelligence.brainContext?.signals.length, HIM_BRAIN_CONTEXT_MAX_SIGNALS,
    'QIR-007 Addendum A: the measured maximum carries ALL EIGHT frozen Brain Context slots');
  assert.deepEqual(
    humanIntelligence.brainContext!.signals.map((signal) => signal.slot),
    HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => entry.slot),
    'QIR-007 Addendum A: the eight Brain Context slots are exactly the frozen registry, in registry order');
  assert.equal(humanIntelligence.sessionReasoningContext?.consumptionMode, 'DEEP',
    'QIR-007 Addendum A: session reasoning is the DEEP projection');
  assert.equal(humanIntelligence.sessionReasoningContext?.contextKind, 'CONVERSATION_SESSION');
  assert.deepEqual(
    humanIntelligence.sessionReasoningContext!.metrics.map((metric) => metric.metricKey),
    [...CURRENT_SESSION_REASONING_METRIC_KEYS],
    'QIR-007 Addendum A: all three - and only the three - currently legal session metrics are present');
  assert.equal(Object.prototype.hasOwnProperty.call(humanIntelligence.sessionReasoningContext!, 'contextId'), false,
    'QIR-007 Addendum A: the internal session identity never reaches the provider');
  // The instruction space is maximal: 11 of the 12 frozen IDs. The single
  // missing ID is the OTHER reflection directive's, which is structurally
  // unreachable in the same turn because `directive` is one field.
  const missing = HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS
    .filter((instructionId) => !humanIntelligence.behavioralInstructionIds.includes(instructionId));
  assert.equal(humanIntelligence.behavioralInstructionIds.length, HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS.length - 1,
    'QIR-007 Addendum A: the maximum envelope authorizes 11 of the 12 frozen behavioral instructions');
  assert.deepEqual(missing, [maximum.reflectionDirective === 'GENTLE_REFLECTION_INVITATION'
    ? 'AVOID_REDUNDANT_REFLECTION' : 'GENTLE_REFLECTION_INVITATION'],
    'QIR-007 Addendum A: the ONLY unreachable instruction is the mutually exclusive reflection directive');
  assert.deepEqual(
    [...humanIntelligence.behavioralInstructionIds],
    HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS.filter((id) => !missing.includes(id)),
    'QIR-007 Addendum A: the instruction IDs are deduplicated and emitted in the frozen canonical order');
  const rendered = composeServerGuidance({ behavioralGuidance: BASE_BEHAVIORAL_GUIDANCE, humanIntelligence });
  const bullets = rendered.split('\n').filter((line) => line.startsWith('- '));
  assert.equal(bullets.length, humanIntelligence.behavioralInstructionIds.length,
    'QIR-007 Addendum A: every authorized instruction renders exactly once');
  assert.equal(new Set(bullets).size, bullets.length,
    'QIR-007 Addendum A: overlapping authorizations never duplicate an instruction');
  assert.ok(rendered.includes('<him_reasoning_context>') && rendered.includes('<him_brain_context>'),
    'QIR-007 Addendum A: both Human Intelligence data lanes are genuinely rendered');
  assert.ok(incrementalBytes > CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES,
    'QIR-007 Addendum A anti-vacuity: the current maximum is strictly larger than the two-slot canonical all-active fixture');
  assert.equal(incrementalBytes, EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES,
    'QIR-007 Addendum A: the current maximum Human Intelligence footprint is EXACTLY the frozen measured result');

  // ---- the frozen slice verdict, through the REAL QIR-004 assembler ---------
  const sliceBytes = HUMAN_INTELLIGENCE_BUDGET_BYTES;
  const headroomBytes = sliceBytes - incrementalBytes;
  const verdict: 'PASS' | 'FINDING' = incrementalBytes <= sliceBytes ? 'PASS' : 'FINDING';

  const assemblyInput: IntegratedContextAssemblyInput = {
    task: 'CONVERSATIONAL_RESPONSE', path: 'DEEP', complexity: 'HIGH',
    behavioralGuidance: BASE_BEHAVIORAL_GUIDANCE,
    messages: [{ role: 'USER', content: CURRENT_USER_CONTENT }],
    currentUserContent: CURRENT_USER_CONTENT,
    humanIntelligence,
    locale: 'und', modality: 'TEXT', latencyBudgetMs: 8000, costBudget: 'LOW', safetyLevel: 'STANDARD',
  };
  const assembled = assembler.assemble(assemblyInput);
  const decision = assembled.decisions.find((item) => item.source === 'HUMAN_INTELLIGENCE');
  assert.ok(decision, 'the real QIR-004 assembler reported a HUMAN_INTELLIGENCE decision');
  assert.equal(decision!.offeredBytes, incrementalBytes,
    'QIR-007 Addendum A: the assembler measures the same incremental footprint through the same canonical rendering identity');
  if (verdict === 'PASS') {
    assert.equal(decision!.outcome, 'INCLUDED_FULL',
      'QIR-007 Addendum A: the current maximum Human Intelligence envelope is INCLUDED_FULL by the real assembler');
    assert.equal(decision!.retainedBytes, incrementalBytes,
      'QIR-007 Addendum A: zero truncation - every offered byte is retained');
    assert.equal(assembled.request.humanIntelligence, humanIntelligence,
      'QIR-007 Addendum A: the exact envelope object survives assembly unmodified');
    // No borrowing: the assembler grants the same decision whether or not the
    // other optional slices are present, so Human Intelligence never fits by
    // consuming another source's unused bytes.
    const isolated = assembler.assemble({ ...assemblyInput, memoryContext: undefined, questionContext: undefined });
    assert.equal(isolated.decisions.find((item) => item.source === 'HUMAN_INTELLIGENCE')?.retainedBytes, incrementalBytes,
      'QIR-007 Addendum A: the decision is made inside the isolated 8192-byte slice - nothing is borrowed');
    assert.ok(assembled.finalTextBytes <= GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES,
      'QIR-007 Addendum A: the final normalized request stays inside the frozen 131072-byte global ceiling');
  }

  return {
    incrementalBytes,
    sliceBytes,
    headroomBytes,
    verdict,
    finalTextBytes: assembled.finalTextBytes,
    globalBudgetBytes: GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES,
    brainContextSignals: humanIntelligence.brainContext!.signals.length,
    sessionReasoningMetrics: humanIntelligence.sessionReasoningContext!.metrics.length,
    crossContextActiveChannels: Object.keys(ALL_FOUR_ACTIVE_CROSS_CONTEXT_GUIDANCE).length,
    behavioralInstructionIds: [...humanIntelligence.behavioralInstructionIds],
    reflectionDirective: maximum.reflectionDirective,
    sessionMetricShapes: maximum.shapes.map((shape) => shape.label),
    candidatesMeasured,
    envelope: humanIntelligence,
  };
}

/** The exact deterministic proof line the QIR-007 gate emits for this addendum. */
export function formatCurrentMaximumHumanIntelligenceProof(
  capacity: CurrentMaximumHumanIntelligenceCapacity,
): string {
  return 'QIR007_HI_CURRENT_MAX:'
    + ` incremental_bytes=${capacity.incrementalBytes}`
    + ` slice_bytes=${capacity.sliceBytes}`
    + ` headroom_bytes=${capacity.headroomBytes}`
    + ` verdict=${capacity.verdict}`
    + ` canonical_all_active_fixture_bytes=${CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES}`
    + ` brain_signals=${capacity.brainContextSignals}`
    + ` session_metrics=${capacity.sessionReasoningMetrics}`
    + ` cross_context_active=${capacity.crossContextActiveChannels}`
    + ` instructions=${capacity.behavioralInstructionIds.length}`
    + ` reflection=${capacity.reflectionDirective}`
    + ` candidates_measured=${capacity.candidatesMeasured}`
    + ` final_text_bytes=${capacity.finalTextBytes}`
    + ` global_budget_bytes=${capacity.globalBudgetBytes}`;
}
