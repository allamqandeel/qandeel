import { IntegratedContextBudgetAssemblerService } from './integrated-context-budget-assembler.service';
import {
  FUTURE_RESERVED_BUDGET_BYTES,
  GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES,
  HISTORY_BUDGET_BYTES,
  HUMAN_INTELLIGENCE_BUDGET_BYTES,
  HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES,
  IntegratedContextBudgetInvariantError,
  MANDATORY_CORE_BUDGET_BYTES,
  MEMORY_BUDGET_BYTES,
  type IntegratedContextAssemblyInput,
  type IntegratedContextAssemblyResult,
  type IntegratedContextBudgetSource,
  type IntegratedContextSourceDecision,
} from './integrated-context-budget-contract';
import {
  composeServerGuidance,
  type ModelRouterContextMessage,
  type ModelRouterMemoryContext,
} from '../model-router/model-router.types';
import { buildHumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics';
import type { HumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics.types';
import type { HimModelContext } from '../human-model/him-fast-deep-consumption.types';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';
import type {
  HypothesisReasoningContext,
  HypothesisReasoningItem,
} from '../hypothesis/hypothesis-reasoning-context.types';
import type { RecommendationGroundingContext } from '../recommendation/recommendation-grounding.types';
import type { TelemetryService } from '../observability/telemetry.service';

// QIR-004 Integrated Context Budget & Conflict Resolution v1.
//
// Every proof here is a DETERMINISTIC PURE FIXTURE. There is no real provider
// call, no network, no database, no timer, and no timing assertion: QIR-004 is
// a structural budget, not a latency task.

const utf8 = (value: string): number => Buffer.byteLength(value, 'utf8');

const BEHAVIOR = 'server-owned behavioral policy';
const CURRENT_USER = 'the canonical current user turn';

const telemetryDouble = () => ({
  recordContextBudgetSourceDecision: jest.fn(),
  recordContextBudgetBytes: jest.fn(),
});

const assembler = (telemetry: unknown = telemetryDouble()) =>
  new IntegratedContextBudgetAssemblerService(telemetry as TelemetryService);

const exchange = (userContent: string, assistantContent: string): ModelRouterContextMessage[] => [
  { role: 'USER', content: userContent },
  { role: 'ASSISTANT', content: assistantContent },
];

const conversation = (
  history: ReadonlyArray<ModelRouterContextMessage>,
  currentUserContent = CURRENT_USER,
): Pick<IntegratedContextAssemblyInput, 'messages' | 'currentUserContent'> => ({
  messages: [...history, { role: 'USER', content: currentUserContent }],
  currentUserContent,
});

const input = (overrides: Partial<IntegratedContextAssemblyInput> = {}): IntegratedContextAssemblyInput => ({
  task: 'CONVERSATIONAL_RESPONSE',
  path: 'FAST',
  complexity: 'LOW',
  behavioralGuidance: BEHAVIOR,
  ...conversation([]),
  locale: 'und',
  modality: 'TEXT',
  latencyBudgetMs: 3_000,
  costBudget: 'LOW',
  safetyLevel: 'STANDARD',
  ...overrides,
});

// Independent re-measurement through the SAME canonical renderer the production
// boundary uses. Nothing here re-implements the rendering.
const baseGuidanceBytes = (safetyGuidance?: string): number =>
  utf8(composeServerGuidance({ behavioralGuidance: BEHAVIOR, ...(safetyGuidance ? { safetyGuidance } : {}) }));
const contributionBytes = (
  source: Partial<Parameters<typeof composeServerGuidance>[0]>,
  safetyGuidance?: string,
): number =>
  utf8(composeServerGuidance({ behavioralGuidance: BEHAVIOR, ...(safetyGuidance ? { safetyGuidance } : {}), ...source }))
  - baseGuidanceBytes(safetyGuidance);

const decisionFor = (
  result: IntegratedContextAssemblyResult,
  source: IntegratedContextBudgetSource,
): IntegratedContextSourceDecision => result.decisions.find((decision) => decision.source === source)!;

// ---------------------------------------------------------------------------
// Human Intelligence fixtures.
// ---------------------------------------------------------------------------
const SESSION_CONTEXT_ID = '11111111-2222-4333-8444-555555555555';

const himContext = (metricCount: number): HimModelContext => ({
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID, coverageState: 'PARTIAL',
  eligibleMetricCount: 3, knownMetricCount: 2, unknownMetricCount: 1,
  freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: 'DEEP',
  metrics: Array.from({ length: metricCount }, (_, index) => ({
    metricKey: `hse.fixture-metric-${index}`, knowledgeState: 'UNKNOWN' as const, ordinalCategory: null,
    unknownReason: 'NO_MEASUREMENT' as const, observationQualifier: null, observedAt: null,
    freshnessState: 'UNASSESSED' as const, confidenceState: 'UNASSESSED' as const, validityStatus: null,
  })),
});

const himInteractionAdaptation: HimInteractionAdaptation = {
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID, adaptationState: 'ACTIVE',
  directives: {
    responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK',
    steeringPressure: 'REDUCED', deliveryPacing: 'CALMER', stepBatching: 'ONE_AT_A_TIME',
  },
  drivers: ['STRESS_HIGH_OR_VERY_HIGH'],
};

const himBrainContext: HimBrainContext = {
  contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
  signals: [
    { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
    { slot: 'GOAL_CONSISTENCY', numericValue: 4, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
  ],
};

// The canonical all-active QHIA-013 envelope: exactly the frozen fixture whose
// incremental provider-guidance footprint is 6427 UTF-8 bytes.
const QHIA_013_ALL_ACTIVE_INCREMENTAL_BYTES = 6427;
const allActiveHumanIntelligence = (): HumanIntelligenceProviderSemantics => buildHumanIntelligenceProviderSemantics({
  himContext: {
    contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', contextId: SESSION_CONTEXT_ID, coverageState: 'PARTIAL',
    eligibleMetricCount: 3, knownMetricCount: 2, unknownMetricCount: 1,
    freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: 'DEEP',
    metrics: [
      { metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'HIGH', unknownReason: null, observationQualifier: 'LATEST_KNOWN', observedAt: '2026-01-01T00:00:00.000Z', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID' },
      { metricKey: 'hse.attention', knowledgeState: 'KNOWN', ordinalCategory: 'LOW', unknownReason: null, observationQualifier: 'LATEST_KNOWN', observedAt: '2026-01-01T00:00:00.000Z', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID' },
      { metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null, unknownReason: 'NO_MEASUREMENT', observationQualifier: null, observedAt: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: null },
    ],
  },
  himInteractionAdaptation: {
    ...himInteractionAdaptation,
    drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ATTENTION_LOW_OR_VERY_LOW'],
  },
  himSessionReflectionGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'GENTLE_REFLECTION_INVITATION' },
  himSituationStressGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' },
  himDecisionAttentionGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN' },
  himGoalMotivationGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' },
  himRelationshipCommunicationGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION' },
  himBrainContext,
})!;

// An envelope whose ACTUAL rendered contribution exceeds the 8 KiB slice.
const oversizedHumanIntelligence = (): HumanIntelligenceProviderSemantics =>
  buildHumanIntelligenceProviderSemantics({ himContext: himContext(200) })!;

// ---------------------------------------------------------------------------
// Hypothesis / Recommendation fixtures.
// ---------------------------------------------------------------------------
const hypothesisItem = (statement: string): HypothesisReasoningItem => ({
  statement, type: 'BEHAVIORAL', domain: 'GENERAL', scope: 'CONVERSATION_SESSION:fixture',
  origin: 'SYSTEM_GENERATED', status: 'ACTIVE', hypothesisVersion: 1,
  currentlyEligibleSupportingEvidenceCount: 2, currentlyEligibleContradictingEvidenceCount: 1,
  assumptions: ['the user keeps the same schedule'],
  disconfirmingConditions: ['the user reports a different schedule'],
  confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: 1 },
});

const hypothesisContext = (statements: ReadonlyArray<string>): HypothesisReasoningContext => ({
  contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', coverageState: 'AVAILABLE',
  candidateHypothesisCount: statements.length, includedHypothesisCount: statements.length, truncated: false,
  hypotheses: statements.map((statement) => hypothesisItem(statement)),
});

const recommendationContext: RecommendationGroundingContext = {
  contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', sourceContractVersion: 1,
  currentVersionConfidenceCoverage: 'PARTIAL',
  actionableMissingInformationCodes: ['NO_ELIGIBLE_EVIDENCE', 'UNVERIFIED_ASSUMPTIONS'],
  unverifiedAssumptionsPresent: true, contradictingEvidencePresent: true, sourceTruncated: false,
};

const smallHypothesisContext = hypothesisContext(['the user prefers concrete next steps']);
const oversizedHypothesisContext = hypothesisContext(
  Array.from({ length: 8 }, (_, index) => `${'h'.repeat(3_200)}-${index}`),
);

describe('QIR-004 exact frozen provider-neutral budget partition', () => {
  it('freezes the exact v1 constants', () => {
    expect(GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES).toBe(131072);
    expect(MANDATORY_CORE_BUDGET_BYTES).toBe(65536);
    expect(HISTORY_BUDGET_BYTES).toBe(16384);
    expect(MEMORY_BUDGET_BYTES).toBe(8192);
    expect(HUMAN_INTELLIGENCE_BUDGET_BYTES).toBe(8192);
    expect(HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES).toBe(24576);
    expect(FUTURE_RESERVED_BUDGET_BYTES).toBe(8192);
  });

  it('partitions the global ceiling exactly, with the 8 KiB reserve unusable in v1', () => {
    const allocated = MANDATORY_CORE_BUDGET_BYTES + HISTORY_BUDGET_BYTES + MEMORY_BUDGET_BYTES
      + HUMAN_INTELLIGENCE_BUDGET_BYTES + HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES;
    expect(allocated + FUTURE_RESERVED_BUDGET_BYTES).toBe(GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES);
    // No v1 source owns the reserve, so a compliant request cannot intentionally
    // consume more than 120 KiB.
    expect(allocated).toBe(GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES - FUTURE_RESERVED_BUDGET_BYTES);
  });
});

describe('QIR-004 UTF-8 measurement and exact accounting identity', () => {
  it('counts ASCII history content as one byte per character', () => {
    const result = assembler().assemble(input(conversation(exchange('a'.repeat(100), 'b'.repeat(200)))));
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBe(300);
    expect(result.finalTextBytes).toBe(result.mandatoryCoreBytes + 300);
  });

  it('counts Arabic content by UTF-8 bytes, never by JavaScript .length', () => {
    const arabic = 'س'.repeat(1_000);
    expect(arabic.length).toBe(1_000);
    const result = assembler().assemble(input(conversation(exchange(arabic, ''))));
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBe(2_000);
  });

  it('counts non-BMP emoji surrogate pairs as four bytes each, never as two code units', () => {
    const emoji = '😀'.repeat(500);
    expect(emoji.length).toBe(1_000);
    const result = assembler().assemble(input(conversation(exchange(emoji, ''))));
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBe(2_000);
  });

  it('charges the current user turn by UTF-8 bytes inside Mandatory Core', () => {
    const mixed = `${'ص'.repeat(10)}${'🙂'.repeat(5)}ascii`;
    const result = assembler().assemble(input(conversation([], mixed)));
    expect(result.mandatoryCoreBytes).toBe(baseGuidanceBytes() + 20 + 20 + 5);
  });

  it('budgets Memory by its rendered contribution AFTER canonical markup escaping, never by raw content length', () => {
    const memoryContext: ModelRouterMemoryContext[] = [{ type: 'GOAL', content: '<goal> & </goal>' }];
    const result = assembler().assemble(input({ memoryContext }));
    const rendered = composeServerGuidance(result.request);
    expect(rendered).toContain('\\u003cgoal\\u003e \\u0026 \\u003c/goal\\u003e');
    // Each escaped markup character costs SIX rendered bytes, so the rendered
    // contribution is strictly larger than the raw content length.
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBe(contributionBytes({ memoryContext }));
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBeGreaterThan(memoryContext[0].content.length);
  });

  it('reconciles source accounting EXACTLY to the final normalized rendered request', () => {
    const memoryContext: ModelRouterMemoryContext[] = [{ type: 'GOAL', content: 'leave work earlier' }];
    const result = assembler().assemble(input({
      ...conversation([...exchange('older question', 'older answer'), ...exchange('newer question', 'newer answer')]),
      safetyGuidance: 'safety guidance for this turn',
      memoryContext,
      humanIntelligence: allActiveHumanIntelligence(),
      hypothesisContext: smallHypothesisContext,
      recommendationContext,
    }));
    // 1. The final total equals the canonical definition, measured on the REAL
    //    assembled request through the REAL renderer.
    const canonicalTotal = utf8(composeServerGuidance(result.request))
      + result.request.context.reduce((total, message) => total + utf8(message.content), 0);
    expect(result.finalTextBytes).toBe(canonicalTotal);
    // 2. The per-source accounting reconciles to it exactly.
    const accounted = result.mandatoryCoreBytes
      + result.decisions.reduce((total, decision) => total + decision.retainedBytes, 0);
    expect(result.finalTextBytes).toBe(accounted);
  });
});

describe('QIR-004 Mandatory Core', () => {
  it('retains hard Behavioral Guidance, Safety Guidance, the charter, and the exact current user turn last', () => {
    const result = assembler().assemble(input({
      ...conversation(exchange('older question', 'older answer')),
      safetyGuidance: 'safety guidance for this turn',
    }));
    expect(result.request.behavioralGuidance).toBe(BEHAVIOR);
    expect(result.request.safetyGuidance).toBe('safety guidance for this turn');
    const rendered = composeServerGuidance(result.request);
    expect(rendered.split('Integrated intelligence authority for this turn:')).toHaveLength(2);
    expect(result.request.context.at(-1)).toEqual({ role: 'USER', content: CURRENT_USER });
    expect(result.mandatoryCoreBytes)
      .toBe(baseGuidanceBytes('safety guidance for this turn') + utf8(CURRENT_USER));
  });

  it('accepts Mandatory Core at EXACTLY 64 KiB', () => {
    const currentUserContent = 'u'.repeat(MANDATORY_CORE_BUDGET_BYTES - baseGuidanceBytes());
    const result = assembler().assemble(input(conversation([], currentUserContent)));
    expect(result.mandatoryCoreBytes).toBe(MANDATORY_CORE_BUDGET_BYTES);
    expect(result.request.context.at(-1)!.content).toBe(currentUserContent);
  });

  it('fails CLOSED one byte over 64 KiB rather than shrinking hard authority', () => {
    const currentUserContent = 'u'.repeat(MANDATORY_CORE_BUDGET_BYTES - baseGuidanceBytes() + 1);
    expect(() => assembler().assemble(input(conversation([], currentUserContent))))
      .toThrow(IntegratedContextBudgetInvariantError);
  });

  it('never lets optional source pressure alter Mandatory Core', () => {
    const pressured = assembler().assemble(input({
      memoryContext: [{ type: 'GOAL', content: 'g'.repeat(20_000) }],
      humanIntelligence: oversizedHumanIntelligence(),
      hypothesisContext: oversizedHypothesisContext,
    }));
    const bare = assembler().assemble(input());
    expect(pressured.mandatoryCoreBytes).toBe(bare.mandatoryCoreBytes);
    expect(pressured.request.behavioralGuidance).toBe(BEHAVIOR);
    expect(pressured.request.context.at(-1)).toEqual({ role: 'USER', content: CURRENT_USER });
    expect(composeServerGuidance(pressured.request).split('Integrated intelligence authority for this turn:'))
      .toHaveLength(2);
  });

  it('never truncates a current user turn that alone dominates the whole request', () => {
    const currentUserContent = 'u'.repeat(40_000);
    const result = assembler().assemble(input({
      ...conversation(exchange('older question', 'older answer'), currentUserContent),
      memoryContext: [{ type: 'GOAL', content: 'remembered goal' }],
    }));
    expect(result.request.context.at(-1)!.content).toBe(currentUserContent);
    expect(result.request.context.at(-1)!.content.length).toBe(40_000);
  });
});

describe('QIR-004 canonical conversation shape fails closed', () => {
  const rejected: ReadonlyArray<[string, Partial<IntegratedContextAssemblyInput>]> = [
    ['an empty messages array', { messages: [], currentUserContent: CURRENT_USER }],
    ['a non-array messages value', { messages: undefined as never, currentUserContent: CURRENT_USER }],
    ['a null message', { messages: [null as never], currentUserContent: CURRENT_USER }],
    ['a non-object message', { messages: ['USER' as never], currentUserContent: CURRENT_USER }],
    ['an array-shaped message', { messages: [[] as never], currentUserContent: CURRENT_USER }],
    ['an unknown role', { messages: [{ role: 'SYSTEM' as never, content: CURRENT_USER }], currentUserContent: CURRENT_USER }],
    ['a non-string content', { messages: [{ role: 'USER', content: 42 as never }], currentUserContent: CURRENT_USER }],
    ['a final message that is not USER', {
      messages: [{ role: 'USER', content: 'q' }, { role: 'ASSISTANT', content: CURRENT_USER }],
      currentUserContent: CURRENT_USER,
    }],
    ['a current-user content mismatch', {
      messages: [{ role: 'USER', content: 'a different turn' }], currentUserContent: CURRENT_USER,
    }],
    ['a non-string canonical current user content', {
      messages: [{ role: 'USER', content: CURRENT_USER }], currentUserContent: undefined as never,
    }],
    ['an odd historical prefix', {
      messages: [{ role: 'USER', content: 'q' }, { role: 'USER', content: CURRENT_USER }],
      currentUserContent: CURRENT_USER,
    }],
    ['a USER/USER historical pair', {
      messages: [
        { role: 'USER', content: 'q1' }, { role: 'USER', content: 'q2' },
        { role: 'USER', content: CURRENT_USER },
      ],
      currentUserContent: CURRENT_USER,
    }],
    ['an ASSISTANT/USER historical pair', {
      messages: [
        { role: 'ASSISTANT', content: 'a1' }, { role: 'USER', content: 'q1' },
        { role: 'USER', content: CURRENT_USER },
      ],
      currentUserContent: CURRENT_USER,
    }],
    ['an ASSISTANT/ASSISTANT historical pair', {
      messages: [
        { role: 'ASSISTANT', content: 'a1' }, { role: 'ASSISTANT', content: 'a2' },
        { role: 'USER', content: CURRENT_USER },
      ],
      currentUserContent: CURRENT_USER,
    }],
  ];

  it.each(rejected)('rejects %s', (_label, overrides) => {
    expect(() => assembler().assemble(input(overrides))).toThrow(IntegratedContextBudgetInvariantError);
  });

  it('emits no budget telemetry when the conversation shape fails closed', () => {
    const telemetry = telemetryDouble();
    expect(() => assembler(telemetry).assemble(input({ messages: [], currentUserContent: CURRENT_USER })))
      .toThrow(IntegratedContextBudgetInvariantError);
    expect(telemetry.recordContextBudgetSourceDecision).not.toHaveBeenCalled();
    expect(telemetry.recordContextBudgetBytes).not.toHaveBeenCalled();
  });
});

describe('QIR-004 History budget', () => {
  it('retains full history unchanged when it fits 16 KiB', () => {
    const history = [...exchange('q1', 'a1'), ...exchange('q2', 'a2'), ...exchange('q3', 'a3')];
    const result = assembler().assemble(input(conversation(history)));
    expect(result.request.context).toEqual([...history, { role: 'USER', content: CURRENT_USER }]);
    expect(decisionFor(result, 'HISTORY').outcome).toBe('INCLUDED_FULL');
  });

  it('removes the OLDEST whole exchanges first and keeps the newest contiguous ones', () => {
    const history = [
      ...exchange(`oldest-${'o'.repeat(6_000)}`, 'o'.repeat(6_000)),
      ...exchange(`newest-${'n'.repeat(6_000)}`, 'n'.repeat(6_000)),
    ];
    const result = assembler().assemble(input(conversation(history)));
    expect(result.request.context).toEqual([...history.slice(2), { role: 'USER', content: CURRENT_USER }]);
    expect(decisionFor(result, 'HISTORY').outcome).toBe('PARTIALLY_RETAINED');
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES);
  });

  it('never retains half an exchange and never truncates a message', () => {
    const history = [
      ...exchange('o'.repeat(6_000), 'o'.repeat(6_000)),
      ...exchange('m'.repeat(6_000), 'm'.repeat(6_000)),
      ...exchange('n'.repeat(6_000), 'n'.repeat(6_000)),
    ];
    const result = assembler().assemble(input(conversation(history)));
    const retained = result.request.context.slice(0, -1);
    expect(retained.length % 2).toBe(0);
    expect(retained.map(({ role }) => role)).toEqual(['USER', 'ASSISTANT']);
    for (const message of retained) expect(message.content.length).toBe(6_000);
  });

  it('retains ZERO history when the newest exchange alone does not fit, never skipping it for an older smaller one', () => {
    const olderSmall = exchange('tiny question', 'tiny answer');
    const newestOversized = exchange('x'.repeat(9_000), 'y'.repeat(9_000));
    const result = assembler().assemble(input(conversation([...olderSmall, ...newestOversized])));
    expect(result.request.context).toEqual([{ role: 'USER', content: CURRENT_USER }]);
    expect(decisionFor(result, 'HISTORY').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBe(0);
    expect(result.request.context.some(({ content }) => content === 'tiny question')).toBe(false);
  });

  it('never counts the current user turn against the History slice', () => {
    const history = exchange('q'.repeat(8_000), 'a'.repeat(8_000));
    const shortCurrentUser = assembler().assemble(input(conversation(history, 'short')));
    const longCurrentUser = assembler().assemble(input(conversation(history, 'u'.repeat(20_000))));
    expect(decisionFor(shortCurrentUser, 'HISTORY').retainedBytes).toBe(16_000);
    expect(decisionFor(longCurrentUser, 'HISTORY').retainedBytes).toBe(16_000);
    expect(longCurrentUser.request.context).toHaveLength(3);
  });

  it('reports NOT_PRESENT for a first turn with no history at all', () => {
    const result = assembler().assemble(input());
    expect(decisionFor(result, 'HISTORY').outcome).toBe('NOT_PRESENT');
    expect(result.request.context).toEqual([{ role: 'USER', content: CURRENT_USER }]);
  });
});

describe('QIR-004 Memory budget', () => {
  it('retains the full ranked list unchanged when its rendered contribution fits 8 KiB', () => {
    const memoryContext: ModelRouterMemoryContext[] = [
      { type: 'GOAL', content: 'leave work earlier' },
      { type: 'PREFERENCE', content: 'prefers concrete steps' },
    ];
    const result = assembler().assemble(input({ memoryContext }));
    expect(result.request.memoryContext).toBe(memoryContext);
    expect(decisionFor(result, 'MEMORY').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBe(contributionBytes({ memoryContext }));
  });

  it('retains the longest highest-ranked PREFIX and STOPS at the first over-budget item', () => {
    const memoryContext: ModelRouterMemoryContext[] = [
      { type: 'GOAL', content: 'a'.repeat(3_000) },
      { type: 'GOAL', content: 'b'.repeat(6_000) },
      // Small enough to fit on its own - and therefore exactly the item a
      // first-come pool would wrongly admit after skipping the oversized one.
      { type: 'GOAL', content: 'c' },
    ];
    const result = assembler().assemble(input({ memoryContext }));
    expect(result.request.memoryContext).toEqual([memoryContext[0]]);
    expect(decisionFor(result, 'MEMORY').outcome).toBe('PARTIALLY_RETAINED');
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBe(contributionBytes({ memoryContext: [memoryContext[0]] }));
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES);
  });

  it('never reranks, reorders, splits, or rewrites a Memory item', () => {
    const memoryContext: ModelRouterMemoryContext[] = [
      { type: 'GOAL', content: 'a'.repeat(4_000) },
      { type: 'PREFERENCE', content: 'b'.repeat(30) },
      { type: 'CONSTRAINT', content: 'c'.repeat(20) },
    ];
    const snapshot = JSON.parse(JSON.stringify(memoryContext));
    const result = assembler().assemble(input({ memoryContext }));
    expect(memoryContext).toEqual(snapshot);
    expect(result.request.memoryContext!.map(({ type }) => type))
      .toEqual(memoryContext.slice(0, result.request.memoryContext!.length).map(({ type }) => type));
    for (const item of result.request.memoryContext!) {
      expect(memoryContext.some((original) => original.content === item.content)).toBe(true);
    }
  });

  it('omits Memory entirely when even the first item exceeds the slice', () => {
    const memoryContext: ModelRouterMemoryContext[] = [
      { type: 'GOAL', content: 'a'.repeat(MEMORY_BUDGET_BYTES + 1) },
      { type: 'GOAL', content: 'tiny' },
    ];
    const result = assembler().assemble(input({ memoryContext }));
    expect(result.request.memoryContext).toBeUndefined();
    expect(decisionFor(result, 'MEMORY').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBe(0);
  });

  it('reports NOT_PRESENT for an absent or empty Memory channel and omits the provider field', () => {
    for (const memoryContext of [undefined, [] as ModelRouterMemoryContext[]]) {
      const result = assembler().assemble(input({ memoryContext }));
      expect(result.request.memoryContext).toBeUndefined();
      expect(decisionFor(result, 'MEMORY').outcome).toBe('NOT_PRESENT');
    }
  });
});

describe('QIR-004 atomic Human Intelligence budget', () => {
  it('fits the canonical all-active QHIA-013 envelope, whose incremental footprint is exactly 6427 bytes', () => {
    const humanIntelligence = allActiveHumanIntelligence();
    expect(contributionBytes({ humanIntelligence })).toBe(QHIA_013_ALL_ACTIVE_INCREMENTAL_BYTES);
    const result = assembler().assemble(input({ humanIntelligence }));
    expect(result.request.humanIntelligence).toBe(humanIntelligence);
    expect(decisionFor(result, 'HUMAN_INTELLIGENCE').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(result, 'HUMAN_INTELLIGENCE').retainedBytes).toBe(QHIA_013_ALL_ACTIVE_INCREMENTAL_BYTES);
    expect(QHIA_013_ALL_ACTIVE_INCREMENTAL_BYTES).toBeLessThanOrEqual(HUMAN_INTELLIGENCE_BUDGET_BYTES);
  });

  it('omits an oversized envelope ATOMICALLY, trimming no instruction, metric, or Brain signal', () => {
    const humanIntelligence = oversizedHumanIntelligence();
    expect(contributionBytes({ humanIntelligence })).toBeGreaterThan(HUMAN_INTELLIGENCE_BUDGET_BYTES);
    const result = assembler().assemble(input({ humanIntelligence }));
    expect(result.request.humanIntelligence).toBeUndefined();
    expect(decisionFor(result, 'HUMAN_INTELLIGENCE').outcome).toBe('OMITTED_BUDGET');
    const rendered = composeServerGuidance(result.request);
    expect(rendered).not.toContain('<him_reasoning_context>');
    expect(rendered).not.toContain('<him_brain_context>');
    expect(rendered).not.toContain('Human Intelligence below is server-owned support');
  });

  it('never mutates the original envelope when it omits it', () => {
    const humanIntelligence = oversizedHumanIntelligence();
    const snapshot = JSON.parse(JSON.stringify(humanIntelligence));
    assembler().assemble(input({ humanIntelligence }));
    expect(JSON.parse(JSON.stringify(humanIntelligence))).toEqual(snapshot);
  });

  it('reports NOT_PRESENT when no envelope exists', () => {
    const result = assembler().assemble(input());
    expect(decisionFor(result, 'HUMAN_INTELLIGENCE').outcome).toBe('NOT_PRESENT');
    expect(result.request.humanIntelligence).toBeUndefined();
  });
});

describe('QIR-004 atomic Hypothesis + Recommendation package budget', () => {
  it('retains a fitting combined package unchanged, by identity', () => {
    const result = assembler().assemble(input({
      hypothesisContext: smallHypothesisContext, recommendationContext,
    }));
    expect(result.request.hypothesisContext).toBe(smallHypothesisContext);
    expect(result.request.recommendationContext).toBe(recommendationContext);
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').retainedBytes)
      .toBe(contributionBytes({ hypothesisContext: smallHypothesisContext, recommendationContext }));
  });

  it('fails CLOSED when Recommendation is present without its owning Hypothesis', () => {
    expect(() => assembler().assemble(input({ recommendationContext })))
      .toThrow(IntegratedContextBudgetInvariantError);
  });

  it('omits BOTH when the combined package exceeds 24 KiB', () => {
    expect(contributionBytes({ hypothesisContext: oversizedHypothesisContext, recommendationContext }))
      .toBeGreaterThan(HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES);
    const result = assembler().assemble(input({
      hypothesisContext: oversizedHypothesisContext, recommendationContext,
    }));
    expect(result.request.hypothesisContext).toBeUndefined();
    expect(result.request.recommendationContext).toBeUndefined();
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('OMITTED_BUDGET');
    const rendered = composeServerGuidance(result.request);
    expect(rendered).not.toContain('<hypothesis_reasoning_context>');
    expect(rendered).not.toContain('<recommendation_grounding_context>');
  });

  it('never lets Recommendation survive a budget omission of the Hypothesis it is derived from', () => {
    const result = assembler().assemble(input({
      hypothesisContext: oversizedHypothesisContext, recommendationContext,
    }));
    expect(result.request.hypothesisContext).toBeUndefined();
    expect(result.request.recommendationContext).toBeUndefined();
  });

  it('never mutates hypotheses, counts, truncation, assumptions, or Recommendation fields', () => {
    const snapshot = JSON.parse(JSON.stringify({ smallHypothesisContext, recommendationContext }));
    const result = assembler().assemble(input({
      hypothesisContext: smallHypothesisContext, recommendationContext,
    }));
    expect(JSON.parse(JSON.stringify({ smallHypothesisContext, recommendationContext }))).toEqual(snapshot);
    expect(result.request.hypothesisContext!.includedHypothesisCount).toBe(smallHypothesisContext.includedHypothesisCount);
    expect(result.request.hypothesisContext!.candidateHypothesisCount).toBe(smallHypothesisContext.candidateHypothesisCount);
    expect(result.request.hypothesisContext!.truncated).toBe(smallHypothesisContext.truncated);
    expect(result.request.hypothesisContext!.hypotheses).toEqual(smallHypothesisContext.hypotheses);
    expect(result.request.recommendationContext).toEqual(recommendationContext);
  });

  it('budgets a forward-compatible Hypothesis-only package without ever deriving Recommendation', () => {
    const result = assembler().assemble(input({ hypothesisContext: smallHypothesisContext }));
    expect(result.request.hypothesisContext).toBe(smallHypothesisContext);
    expect(result.request.recommendationContext).toBeUndefined();
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').retainedBytes)
      .toBe(contributionBytes({ hypothesisContext: smallHypothesisContext }));
  });

  it('reports NOT_PRESENT when neither Hypothesis nor Recommendation exists', () => {
    const result = assembler().assemble(input());
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('NOT_PRESENT');
  });
});

describe('QIR-004 source isolation: budget slices are resource isolation, never truth ranking', () => {
  const memoryContext: ModelRouterMemoryContext[] = [{ type: 'GOAL', content: 'leave work earlier' }];
  const oversizedHistory = [
    ...exchange('o'.repeat(9_000), 'o'.repeat(9_000)),
    ...exchange('n'.repeat(9_000), 'n'.repeat(9_000)),
  ];
  const oversizedMemory: ModelRouterMemoryContext[] = [{ type: 'GOAL', content: 'm'.repeat(MEMORY_BUDGET_BYTES + 1) }];

  it('an oversized History cannot consume the Memory slice', () => {
    const isolated = assembler().assemble(input({ ...conversation(oversizedHistory), memoryContext }));
    const alone = assembler().assemble(input({ memoryContext }));
    expect(decisionFor(isolated, 'MEMORY').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(isolated, 'MEMORY').retainedBytes).toBe(decisionFor(alone, 'MEMORY').retainedBytes);
  });

  it('an oversized Memory cannot consume the Human Intelligence slice', () => {
    const humanIntelligence = allActiveHumanIntelligence();
    const isolated = assembler().assemble(input({ memoryContext: oversizedMemory, humanIntelligence }));
    expect(decisionFor(isolated, 'MEMORY').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(isolated, 'HUMAN_INTELLIGENCE').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(isolated, 'HUMAN_INTELLIGENCE').retainedBytes).toBe(QHIA_013_ALL_ACTIVE_INCREMENTAL_BYTES);
  });

  it('an oversized Human Intelligence cannot consume the Hypothesis/Recommendation slice', () => {
    const isolated = assembler().assemble(input({
      humanIntelligence: oversizedHumanIntelligence(),
      hypothesisContext: smallHypothesisContext, recommendationContext,
    }));
    expect(decisionFor(isolated, 'HUMAN_INTELLIGENCE').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(isolated, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('INCLUDED_FULL');
  });

  it('an oversized Hypothesis package cannot evict History, Memory, or Human Intelligence', () => {
    const history = exchange('q1', 'a1');
    const humanIntelligence = allActiveHumanIntelligence();
    const isolated = assembler().assemble(input({
      ...conversation(history), memoryContext, humanIntelligence,
      hypothesisContext: oversizedHypothesisContext, recommendationContext,
    }));
    expect(decisionFor(isolated, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(isolated, 'HISTORY').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(isolated, 'MEMORY').outcome).toBe('INCLUDED_FULL');
    expect(decisionFor(isolated, 'HUMAN_INTELLIGENCE').outcome).toBe('INCLUDED_FULL');
    expect(isolated.request.context).toEqual([...history, { role: 'USER', content: CURRENT_USER }]);
  });

  it('an ABSENT Memory does not enlarge the Hypothesis/Recommendation budget', () => {
    const withoutMemory = assembler().assemble(input({
      hypothesisContext: oversizedHypothesisContext, recommendationContext,
    }));
    const withMemory = assembler().assemble(input({
      memoryContext, hypothesisContext: oversizedHypothesisContext, recommendationContext,
    }));
    expect(decisionFor(withoutMemory, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('OMITTED_BUDGET');
    expect(decisionFor(withMemory, 'HYPOTHESIS_RECOMMENDATION').outcome).toBe('OMITTED_BUDGET');
  });

  it('an ABSENT Human Intelligence does not enlarge the History budget', () => {
    const history = [
      ...exchange('o'.repeat(6_000), 'o'.repeat(6_000)),
      ...exchange('n'.repeat(6_000), 'n'.repeat(6_000)),
    ];
    const withoutHumanIntelligence = assembler().assemble(input(conversation(history)));
    const withHumanIntelligence = assembler().assemble(input({
      ...conversation(history), humanIntelligence: allActiveHumanIntelligence(),
    }));
    expect(decisionFor(withoutHumanIntelligence, 'HISTORY').retainedBytes)
      .toBe(decisionFor(withHumanIntelligence, 'HISTORY').retainedBytes);
    expect(decisionFor(withoutHumanIntelligence, 'HISTORY').outcome).toBe('PARTIALLY_RETAINED');
  });

  it('unused Mandatory Core capacity does not expand any optional slice', () => {
    const oversizedMemoryList: ModelRouterMemoryContext[] = [
      { type: 'GOAL', content: 'a'.repeat(3_000) },
      { type: 'GOAL', content: 'b'.repeat(6_000) },
    ];
    const tinyCore = assembler().assemble(input({ memoryContext: oversizedMemoryList }));
    const largeCore = assembler().assemble(input({
      ...conversation([], 'u'.repeat(30_000)), memoryContext: oversizedMemoryList,
    }));
    expect(decisionFor(tinyCore, 'MEMORY').outcome).toBe('PARTIALLY_RETAINED');
    expect(decisionFor(largeCore, 'MEMORY').outcome).toBe('PARTIALLY_RETAINED');
    expect(decisionFor(tinyCore, 'MEMORY').retainedBytes).toBe(decisionFor(largeCore, 'MEMORY').retainedBytes);
    expect(tinyCore.request.memoryContext).toEqual(largeCore.request.memoryContext);
  });

  it('leaves the 8 KiB future reserve unused: a maximally pressured turn stays under 120 KiB', () => {
    const result = assembler().assemble(input({
      ...conversation([
        ...exchange('o'.repeat(9_000), 'o'.repeat(9_000)),
        ...exchange('n'.repeat(8_000), 'n'.repeat(8_000)),
      ], 'u'.repeat(30_000)),
      safetyGuidance: 's'.repeat(2_000),
      memoryContext: [{ type: 'GOAL', content: 'g'.repeat(4_000) }],
      humanIntelligence: allActiveHumanIntelligence(),
      hypothesisContext: hypothesisContext(Array.from({ length: 8 }, (_, index) => `${'h'.repeat(2_000)}-${index}`)),
      recommendationContext,
    }));
    for (const decision of result.decisions) expect(decision.outcome).not.toBe('NOT_PRESENT');
    // Non-vacuity: this really is a heavily loaded turn, not an empty one.
    expect(result.finalTextBytes).toBeGreaterThan(60_000);
    expect(result.finalTextBytes)
      .toBeLessThanOrEqual(GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES - FUTURE_RESERVED_BUDGET_BYTES);
  });
});

describe('QIR-004 global hard ceiling', () => {
  it('keeps every included source inside its own exact slice and the total inside 128 KiB', () => {
    const result = assembler().assemble(input({
      ...conversation([
        ...exchange('o'.repeat(9_000), 'o'.repeat(9_000)),
        ...exchange('n'.repeat(8_000), 'n'.repeat(8_000)),
      ], 'u'.repeat(20_000)),
      memoryContext: [{ type: 'GOAL', content: 'g'.repeat(4_000) }],
      humanIntelligence: allActiveHumanIntelligence(),
      hypothesisContext: smallHypothesisContext,
      recommendationContext,
    }));
    expect(result.mandatoryCoreBytes).toBeLessThanOrEqual(MANDATORY_CORE_BUDGET_BYTES);
    expect(decisionFor(result, 'HISTORY').retainedBytes).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES);
    expect(decisionFor(result, 'MEMORY').retainedBytes).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES);
    expect(decisionFor(result, 'HUMAN_INTELLIGENCE').retainedBytes).toBeLessThanOrEqual(HUMAN_INTELLIGENCE_BUDGET_BYTES);
    expect(decisionFor(result, 'HYPOTHESIS_RECOMMENDATION').retainedBytes)
      .toBeLessThanOrEqual(HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES);
    expect(result.finalTextBytes).toBeLessThanOrEqual(GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES);
  });

  it('fails CLOSED - never trimming Mandatory Core - when the guidance renderer stops being additive', () => {
    // The accounting identity can only break if guidance rendering becomes
    // cross-source / non-additive, so the proof simulates exactly that at the
    // one seam the guard watches: the FINAL rendered request, identified by the
    // fact that it is the only rendering carrying BOTH source containers.
    const service = assembler();
    const original = Object.getOwnPropertyDescriptor(Buffer, 'byteLength')!;
    const nonAdditive = (value: string, encoding: BufferEncoding): number => original.value(value, encoding)
      + (typeof value === 'string'
        && value.includes('<user_memory_context>')
        && value.includes('<hypothesis_reasoning_context>') ? 1 : 0);
    const request = input({
      memoryContext: [{ type: 'GOAL', content: 'leave work earlier' }],
      hypothesisContext: smallHypothesisContext,
    });
    // Non-vacuity: the identical fixture assembles cleanly with the real,
    // additive renderer.
    expect(() => service.assemble(request)).not.toThrow();
    Object.defineProperty(Buffer, 'byteLength', { configurable: true, value: nonAdditive });
    try {
      expect(() => service.assemble(request)).toThrow(IntegratedContextBudgetInvariantError);
    } finally {
      Object.defineProperty(Buffer, 'byteLength', original);
    }
  });
});

describe('QIR-004 bounded fail-soft telemetry', () => {
  it('emits exactly one finite source decision per source and byte VALUES, never byte labels', () => {
    const telemetry = telemetryDouble();
    const result = assembler(telemetry).assemble(input({
      ...conversation(exchange('q1', 'a1')),
      memoryContext: [{ type: 'GOAL', content: 'leave work earlier' }],
      humanIntelligence: allActiveHumanIntelligence(),
      hypothesisContext: smallHypothesisContext,
      recommendationContext,
    }));
    expect(telemetry.recordContextBudgetSourceDecision.mock.calls.map(([source]) => source))
      .toEqual(['HISTORY', 'MEMORY', 'HUMAN_INTELLIGENCE', 'HYPOTHESIS_RECOMMENDATION']);
    for (const [, outcome, path] of telemetry.recordContextBudgetSourceDecision.mock.calls) {
      expect(['NOT_PRESENT', 'INCLUDED_FULL', 'PARTIALLY_RETAINED', 'OMITTED_BUDGET']).toContain(outcome);
      expect(path).toBe('FAST');
    }
    const byteCalls = telemetry.recordContextBudgetBytes.mock.calls;
    expect(byteCalls[0]).toEqual(['MANDATORY_CORE', 'RETAINED', 'FAST', result.mandatoryCoreBytes]);
    expect(byteCalls.at(-1)).toEqual(['FINAL_TOTAL', 'FINAL', 'FAST', result.finalTextBytes]);
    for (const [component, measurement, path, bytes] of byteCalls) {
      expect(['MANDATORY_CORE', 'HISTORY', 'MEMORY', 'HUMAN_INTELLIGENCE', 'HYPOTHESIS_RECOMMENDATION', 'FINAL_TOTAL'])
        .toContain(component);
      expect(['OFFERED', 'RETAINED', 'FINAL']).toContain(measurement);
      expect(path).toBe('FAST');
      expect(typeof bytes).toBe('number');
      expect(Number.isSafeInteger(bytes)).toBe(true);
    }
  });

  it('emits no content, identifier, or raw source data', () => {
    const telemetry = telemetryDouble();
    assembler(telemetry).assemble(input({
      ...conversation(exchange('a private question', 'a private answer'), 'a private current turn'),
      memoryContext: [{ type: 'GOAL', content: 'a private memory' }],
    }));
    const emitted = JSON.stringify([
      telemetry.recordContextBudgetSourceDecision.mock.calls,
      telemetry.recordContextBudgetBytes.mock.calls,
    ]);
    for (const secret of ['private', SESSION_CONTEXT_ID, 'GOAL']) expect(emitted).not.toContain(secret);
  });

  it('cannot alter the assembly when it throws', () => {
    const throwing = {
      recordContextBudgetSourceDecision: jest.fn(() => { throw new Error('telemetry exploded'); }),
      recordContextBudgetBytes: jest.fn(() => { throw new Error('telemetry exploded'); }),
    };
    const withTelemetry = assembler(throwing).assemble(input(conversation(exchange('q1', 'a1'))));
    const withoutTelemetry = assembler().assemble(input(conversation(exchange('q1', 'a1'))));
    expect(withTelemetry.request).toEqual(withoutTelemetry.request);
    expect(withTelemetry.finalTextBytes).toBe(withoutTelemetry.finalTextBytes);
  });
});

describe('QIR-004 carries execution semantics it does not own', () => {
  it('passes task, path, complexity, latency budget, cost budget, safety level, locale, and modality through unchanged', () => {
    for (const [path, complexity, latencyBudgetMs] of [['FAST', 'LOW', 3_000], ['DEEP', 'HIGH', 10_000]] as const) {
      const result = assembler().assemble(input({ path, complexity, latencyBudgetMs }));
      expect(result.request.task).toBe('CONVERSATIONAL_RESPONSE');
      expect(result.request.path).toBe(path);
      expect(result.request.complexity).toBe(complexity);
      expect(result.request.latencyBudgetMs).toBe(latencyBudgetMs);
      expect(result.request.costBudget).toBe('LOW');
      expect(result.request.safetyLevel).toBe('STANDARD');
      expect(result.request.locale).toBe('und');
      expect(result.request.modality).toBe('TEXT');
    }
  });
});
