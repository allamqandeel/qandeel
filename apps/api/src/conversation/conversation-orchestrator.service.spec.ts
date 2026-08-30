import { ServiceUnavailableException } from '@nestjs/common';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { composeServerGuidance } from '../model-router/model-router.types';
import { buildHumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';
import type { ContextBuilder } from './context-builder.types';
import type { BehavioralResponsePolicy } from './behavioral-response-policy.types';
import type { SafetyResponseGate } from './safety-response-gate.types';
import { MemoryRetrieverService } from '../memory/memory-retriever.service';
import { MemoryWriteService } from '../memory/memory-write.service';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import type { HimIntelligenceSnapshot } from '../human-model/him-intelligence-snapshot.types';
import type { HimReasoningContext } from '../human-model/him-reasoning-consumption.types';
import { HimFastDeepConsumptionService } from '../human-model/him-fast-deep-consumption.service';
import type { HimModelContext } from '../human-model/him-fast-deep-consumption.types';
import { HimInteractionAdaptationService } from '../human-model/him-interaction-adaptation.service';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import { HimContextualCurrentIntelligenceService } from '../human-model/him-contextual-current-intelligence.service';
import type { HimContextualCurrentSelection } from '../human-model/him-contextual-current-intelligence.types';
import { HimSessionReflectionConsumptionService } from '../human-model/him-session-reflection-consumption.service';
import type { HimSessionReflectionGuidance } from '../human-model/him-session-reflection-consumption.types';
import { HimSituationStressConsumptionService } from '../human-model/him-situation-stress-consumption.service';
import type { HimSituationStressGuidance } from '../human-model/him-situation-stress-consumption.types';
import { HimDecisionAttentionConsumptionService } from '../human-model/him-decision-attention-consumption.service';
import type { HimDecisionAttentionGuidance } from '../human-model/him-decision-attention-consumption.types';
import { HimGoalMotivationConsumptionService } from '../human-model/him-goal-motivation-consumption.service';
import type { HimGoalMotivationGuidance } from '../human-model/him-goal-motivation-consumption.types';
import { HimRelationshipCommunicationConsumptionService } from '../human-model/him-relationship-communication-consumption.service';
import type { HimRelationshipCommunicationGuidance } from '../human-model/him-relationship-communication-consumption.types';
import { HimCrossContextForegroundAggregationService } from '../human-model/him-cross-context-foreground-aggregation.service';
import { HimBrainContextService } from '../human-model/him-brain-context.service';
import type { HimBrainContext } from '../human-model/him-brain-context.types';
import type { HimCrossContextForegroundGuidance } from '../human-model/him-cross-context-foreground.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import { HypothesisGenerationEligibilityService } from '../hypothesis/hypothesis-generation-eligibility.service';
import { HypothesisGenerationIntentExtractionService } from '../hypothesis/hypothesis-generation-intent-extraction.service';
import { HypothesisGenerationRequestAssemblerService } from '../hypothesis/hypothesis-generation-request-assembler.service';
import type { AuthorizedHypothesisGenerationIntent } from '../hypothesis/hypothesis-generation-intent-authority.types';
import { HypothesisGenerationService } from '../hypothesis/hypothesis-generation.service';
import type { HypothesisCandidateGenerator } from '../hypothesis/hypothesis-generation.types';
import { HypothesisCandidateGeneratorError } from '../hypothesis/hypothesis-candidate-generator-provider.types';
import { ConfidenceService } from '../hypothesis/confidence.service';
import { HypothesisReasoningInvariantError } from '../hypothesis/hypothesis-reasoning-context.types';
import { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';
import { RecommendationGroundingInvariantError, type RecommendationGroundingContext } from '../recommendation/recommendation-grounding.types';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.types';

describe('ConversationOrchestratorService', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let router: jest.Mocked<ModelRouter>;
  let contextBuilder: jest.Mocked<ContextBuilder>;
  let behavioralPolicy: jest.Mocked<BehavioralResponsePolicy>;
  let safetyGate: jest.Mocked<SafetyResponseGate>;
  let memoryRetriever: jest.Mocked<MemoryRetrieverService>;
  let memoryWriter: jest.Mocked<MemoryWriteService>;
  let himSelector: jest.Mocked<HimTurnContextSelectionService>;
  let himSnapshot: jest.Mocked<HimIntelligenceSnapshotService>;
  let himBridge: jest.Mocked<HimReasoningConsumptionService>;
  let himConsumptionPolicy: jest.Mocked<HimFastDeepConsumptionService>;
  let himAdaptation: jest.Mocked<HimInteractionAdaptationService>;
  let himContextualCurrent: jest.Mocked<HimContextualCurrentIntelligenceService>;
  let himReflectionConsumption: jest.Mocked<HimSessionReflectionConsumptionService>;
  let himCrossContextForeground: jest.Mocked<HimCrossContextForegroundAggregationService>;
  let himBrainContext: jest.Mocked<HimBrainContextService>;
  let hypothesisContext: jest.Mocked<HypothesisReasoningContextService>;
  let foregroundGatherer: BoundedForegroundIntelligenceGathererService;
  let recommendationGrounding: jest.Mocked<RecommendationGroundingService>;
  let hypothesisEligibility: jest.Mocked<HypothesisGenerationEligibilityService>;
  let hypothesisExtraction: jest.Mocked<HypothesisGenerationIntentExtractionService>;
  let hypothesisRequestAssembler: jest.Mocked<HypothesisGenerationRequestAssemblerService>;
  let hypothesisGeneration: jest.Mocked<HypothesisGenerationService>;
  let confidence: jest.Mocked<ConfidenceService>;
  let hypothesisCandidateGenerator: jest.Mocked<HypothesisCandidateGenerator>;
  let correlation: CorrelationService;
  let telemetry: TelemetryService;
  let orchestrator: ConversationOrchestratorService;
  const userTurn: ConversationTurn = {
    id: 'user-turn', session_id: 'session', role: 'USER', status: 'RECEIVED', content: 'hello',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request-1',
    created_at: 'now', updated_at: 'now', completed_at: null,
  };
  const claimed: ConversationTurn = { ...userTurn, status: 'GENERATING', processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' };
  const completedUser: ConversationTurn = { ...claimed, status: 'COMPLETED', completed_at: 'now' };
  const assistant: ConversationTurn = {
    ...completedUser, id: 'assistant-turn', role: 'ASSISTANT', content: 'response', source_turn_id: userTurn.id, idempotency_key: null,
  };
  const snapshot = { snapshotContractVersion: 1, coverageState: 'EMPTY' } as HimIntelligenceSnapshot;
  const himReasoningContext = {
    source: 'HIM_INTELLIGENCE_SNAPSHOT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', contextId: 'session', generatedAt: 'now', coverageState: 'EMPTY',
    eligibleMetricCount: 3, assessedMetricCount: 0, unassessedMetricCount: 3, metrics: [],
  } as HimReasoningContext;
  const himContext = {
    contractVersion: 1, source: 'HIM_REASONING_CONTEXT', consumptionMode: 'FAST',
    sourceSnapshotContractVersion: 1, contextKind: 'CONVERSATION_SESSION', contextId: 'session',
    coverageState: 'EMPTY', eligibleMetricCount: 3, knownMetricCount: 0, unknownMetricCount: 3,
    freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', metrics: [],
  } as HimModelContext;
  const noneAdaptation: HimInteractionAdaptation = {
    contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', contextId: 'session', adaptationState: 'NONE',
    directives: {
      responseDensity: 'DEFAULT', cognitiveLoad: 'DEFAULT', branching: 'DEFAULT',
      steeringPressure: 'DEFAULT', deliveryPacing: 'DEFAULT', stepBatching: 'DEFAULT',
    },
    drivers: [],
  };
  const activeAdaptation: HimInteractionAdaptation = {
    ...noneAdaptation, adaptationState: 'ACTIVE',
    directives: { ...noneAdaptation.directives, cognitiveLoad: 'REDUCED', steeringPressure: 'REDUCED', deliveryPacing: 'CALMER' },
    drivers: ['STRESS_HIGH_OR_VERY_HIGH'],
  };
  const reflectionSelection = (numericValue: number | null): HimContextualCurrentSelection => ({
    contractVersion: 1, source: 'HIM_CANONICAL_LATEST_MEASUREMENT',
    contextKind: 'CONVERSATION_SESSION', contextId: 'session',
    coverageState: numericValue === null ? 'EMPTY' : 'FULL', requestedMetricCount: 1,
    knownMetricCount: numericValue === null ? 0 : 1, unknownMetricCount: numericValue === null ? 1 : 0,
    metrics: [{
      metricKey: 'hbs.reflection', definitionVersion: 1, hifOwner: 'HBS',
      semanticMappingStatus: 'UNRESOLVED', semanticType: null,
      knowledgeState: numericValue === null ? 'UNKNOWN' : 'KNOWN', numericValue,
      unknownReason: numericValue === null ? 'NO_CANONICAL_CURRENT_VALUE' : null,
      canonicalBindingId: numericValue === null ? null : '40000000-0000-4000-8000-000000000004',
      observedAt: null, temporalWindowStart: null, temporalWindowEnd: null,
      freshnessState: 'UNASSESSED', freshnessReference: null,
      confidenceState: 'UNASSESSED', confidenceReference: null,
    }],
  });
  const noneSituationStressGuidance: HimSituationStressGuidance = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
  const activeSituationStressGuidance: HimSituationStressGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' };
  const noneDecisionAttentionGuidance: HimDecisionAttentionGuidance = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
  const activeDecisionAttentionGuidance: HimDecisionAttentionGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN' };
  const noneGoalMotivationGuidance: HimGoalMotivationGuidance = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
  const activeGoalMotivationGuidance: HimGoalMotivationGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' };
  const noneRelationshipCommunicationGuidance: HimRelationshipCommunicationGuidance = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
  const activeRelationshipCommunicationGuidance: HimRelationshipCommunicationGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION' };
  // QHIA-013: the eight legacy Human Intelligence provider fields are gone. The
  // Model Router receives exactly ONE envelope, so every expectation about "this
  // guidance reached the provider" is now made against that one envelope.
  //
  // Comparing the WHOLE envelope proves presence and absence together: a channel
  // that should not have reached the provider cannot hide inside a partial
  // match, and a channel that did reach it must map to exactly the frozen
  // instruction IDs the pure compiler produces for it.
  const LEGACY_HUMAN_INTELLIGENCE_REQUEST_FIELDS = [
    'himContext', 'himInteractionAdaptation', 'himSessionReflectionGuidance', 'himSituationStressGuidance',
    'himDecisionAttentionGuidance', 'himGoalMotivationGuidance', 'himRelationshipCommunicationGuidance',
    'himBrainContext',
  ] as const;
  const dispatchedRequest = (call = 0): ModelRouterRequest => router.generate.mock.calls[call][0] as ModelRouterRequest;
  const dispatchedHumanIntelligence = (call = 0) => dispatchedRequest(call).humanIntelligence;
  const dispatchedInstructionIds = (call = 0): string[] => [...(dispatchedHumanIntelligence(call)?.behavioralInstructionIds ?? [])];
  const expectedEnvelope = (
    channels: Parameters<typeof buildHumanIntelligenceProviderSemantics>[0] = {},
    path: 'FAST' | 'DEEP' = 'FAST',
  ) => buildHumanIntelligenceProviderSemantics({
    himContext: { ...himContext, consumptionMode: path } as HimModelContext, ...channels,
  });
  const expectNoLegacyHumanIntelligenceFields = (call = 0): void => {
    for (const legacy of LEGACY_HUMAN_INTELLIGENCE_REQUEST_FIELDS) {
      expect(dispatchedRequest(call)).not.toHaveProperty(legacy);
    }
  };
  // The provider-safe projection of the session-context fixture, written out in
  // full rather than derived, so a silent change to the projection fails here:
  // every runtime field survives and exactly the internal session UUID is gone.
  const providerSessionReasoningContext = (path: 'FAST' | 'DEEP' = 'FAST') => ({
    contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', coverageState: 'EMPTY',
    eligibleMetricCount: 3, knownMetricCount: 0, unknownMetricCount: 3,
    freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: path, metrics: [],
  });
  const expectDispatchedHumanIntelligence = (
    channels: Parameters<typeof buildHumanIntelligenceProviderSemantics>[0] = {},
    { call = 0, path = 'FAST' as 'FAST' | 'DEEP' } = {},
  ): void => {
    expect(dispatchedHumanIntelligence(call)).toEqual(expectedEnvelope(channels, path));
    expectNoLegacyHumanIntelligenceFields(call);
  };
  // QHIA-009/QHIA-010/QHIA-011: the aggregate carries the four EXISTING guidance
  // contracts side by side. It adds no field of its own to the provider request.
  const crossContextGuidance = (
    situationStress: HimSituationStressGuidance,
    decisionAttention: HimDecisionAttentionGuidance,
    goalMotivation: HimGoalMotivationGuidance = noneGoalMotivationGuidance,
    relationshipCommunication: HimRelationshipCommunicationGuidance = noneRelationshipCommunicationGuidance,
  ): HimCrossContextForegroundGuidance => ({ contractVersion: 3, situationStress, decisionAttention, goalMotivation, relationshipCommunication });
  // Raw migration-0060 / 0059 / 0058 / 0056 / 0057 rows for the tests that drive
  // the REAL aggregate over REAL child consumers. Every channel is
  // deterministically unbound, so the decoded answer is bounded NONE on all four
  // sides.
  const CANONICAL_USER = '00000000-0000-4000-8000-000000000001';
  const CANONICAL_SESSION = '00000000-0000-4000-8000-000000000002';
  const nullMetricColumns = {
    binding_context_id: null, slot_order: null, metric_key: null, definition_version: null, hif_owner: null,
    semantic_mapping_status: null, semantic_type: null, calculation_status: null, valid_context_kinds: null,
    context_kind: null, context_id: null, has_canonical_current_value: null,
    source_metric_key: null, source_definition_version: null, source_semantic_mapping_status: null,
    source_semantic_type: null, source_context_kind: null, source_context_id: null,
    value_state: null, numeric_value: null, validity_status: null, confidence_state: null, confidence_reference: null,
    observed_at: null, temporal_window_start: null, temporal_window_end: null,
    canonical_binding_id: null, active_binding_id: null,
  };
  const unboundSituationRow = () => ({ binding_state: 'NO_ACTIVE_SITUATION', ...nullMetricColumns });
  const unboundDecisionRow = () => ({ binding_state: 'NO_ACTIVE_DECISION', ...nullMetricColumns });
  const unboundGoalRow = () => ({ binding_state: 'NO_ACTIVE_GOAL', ...nullMetricColumns });
  const unboundRelationshipRow = () => ({ binding_state: 'NO_ACTIVE_RELATIONSHIP', ...nullMetricColumns });
  const unboundEnvelope = () => [
    { foreground_slot_order: 1, foreground_slot: 'SITUATION_STRESS', ...unboundSituationRow() },
    { foreground_slot_order: 2, foreground_slot: 'DECISION_ATTENTION', ...unboundDecisionRow() },
    { foreground_slot_order: 3, foreground_slot: 'GOAL_MOTIVATION', ...unboundGoalRow() },
    { foreground_slot_order: 4, foreground_slot: 'RELATIONSHIP_COMMUNICATION', ...unboundRelationshipRow() },
  ];
  const noneReflectionGuidance: HimSessionReflectionGuidance = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
  const inviteReflectionGuidance: HimSessionReflectionGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'GENTLE_REFLECTION_INVITATION' };
  const avoidReflectionGuidance: HimSessionReflectionGuidance = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'AVOID_REDUNDANT_REFLECTION' };

  beforeEach(() => {
    repository = {
      claimTurn: jest.fn(), finalizeTurn: jest.fn(), failTurn: jest.fn(), findTurn: jest.fn(),
      findAssistantForSource: jest.fn(), recoverExpiredGeneratingTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    router = { generate: jest.fn().mockResolvedValue({ content: 'response', routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 } }) };
    contextBuilder = {
      build: jest.fn().mockResolvedValue([{ role: 'USER', content: userTurn.content }]),
      assemble: jest.fn((messages, memoryContext) => ({ messages, ...(memoryContext.length ? { memoryContext } : {}) })),
    };
    memoryRetriever = { retrieve: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryRetrieverService>;
    memoryWriter = { evaluateAndWrite: jest.fn().mockResolvedValue({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' }) } as unknown as jest.Mocked<MemoryWriteService>;
    himSelector = { select: jest.fn().mockImplementation((turn: ConversationTurn) => ({
      contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
      sourceTurnId: turn.id, contextKind: 'CONVERSATION_SESSION', contextId: turn.session_id,
      selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
    })) } as unknown as jest.Mocked<HimTurnContextSelectionService>;
    himSnapshot = { getSnapshot: jest.fn().mockResolvedValue(snapshot) } as unknown as jest.Mocked<HimIntelligenceSnapshotService>;
    himBridge = { transform: jest.fn().mockReturnValue(himReasoningContext) } as unknown as jest.Mocked<HimReasoningConsumptionService>;
    himConsumptionPolicy = { project: jest.fn().mockImplementation((path) => ({ ...himContext, consumptionMode: path })) } as unknown as jest.Mocked<HimFastDeepConsumptionService>;
    himAdaptation = { derive: jest.fn().mockReturnValue(noneAdaptation) } as unknown as jest.Mocked<HimInteractionAdaptationService>;
    himContextualCurrent = { getCurrentSelection: jest.fn().mockResolvedValue(reflectionSelection(null)), getCurrentIntelligence: jest.fn() } as unknown as jest.Mocked<HimContextualCurrentIntelligenceService>;
    himReflectionConsumption = { consume: jest.fn().mockReturnValue(noneReflectionGuidance) } as unknown as jest.Mocked<HimSessionReflectionConsumptionService>;
    himCrossContextForeground = { read: jest.fn().mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance)) } as unknown as jest.Mocked<HimCrossContextForegroundAggregationService>;
    himBrainContext = { read: jest.fn().mockResolvedValue(undefined), consumeSourceRows: jest.fn() } as unknown as jest.Mocked<HimBrainContextService>;
    hypothesisContext = { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as jest.Mocked<HypothesisReasoningContextService>;
    recommendationGrounding = { ground: jest.fn().mockReturnValue({ coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' }) } as unknown as jest.Mocked<RecommendationGroundingService>;
    hypothesisEligibility = { evaluateWithContext: jest.fn().mockResolvedValue({ eligibility: { status: 'NOT_ELIGIBLE', reason: 'NO_TRIGGER' } }) } as unknown as jest.Mocked<HypothesisGenerationEligibilityService>;
    hypothesisExtraction = { extract: jest.fn().mockResolvedValue({ status: 'NOT_AUTHORIZED', reason: 'AUTHORITY_REJECTED', authorityReason: 'PROBLEM_NOT_GROUNDED' }) } as unknown as jest.Mocked<HypothesisGenerationIntentExtractionService>;
    hypothesisRequestAssembler = { assemble: jest.fn().mockReturnValue({ status: 'READY', request: { problem: 'problem', domain: 'GENERAL', scope: 'CONVERSATION_SESSION:session', evidenceIds: [] } }) } as unknown as jest.Mocked<HypothesisGenerationRequestAssemblerService>;
    hypothesisGeneration = { generate: jest.fn().mockResolvedValue({ accepted: [], rejected: [] }) } as unknown as jest.Mocked<HypothesisGenerationService>;
    confidence = { evaluateHypothesis: jest.fn().mockResolvedValue({}) } as unknown as jest.Mocked<ConfidenceService>;
    hypothesisCandidateGenerator = { generate: jest.fn().mockResolvedValue([]) };
    behavioralPolicy = { buildTextGuidance: jest.fn().mockReturnValue('server-owned policy') };
    safetyGate = { evaluate: jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW' }) };
    correlation=new CorrelationService();
    telemetry=new TelemetryService(correlation);
    // QIR-003: the REAL bounded Memory + Hypothesis foreground gatherer over
    // the same mocked source services, so every orchestrator proof exercises
    // the real concurrent-launch / shared-deadline / typed-outcome production
    // path rather than a gatherer double.
    foregroundGatherer = new BoundedForegroundIntelligenceGathererService(memoryRetriever, hypothesisContext, correlation, telemetry);
    orchestrator = new ConversationOrchestratorService(repository, contextBuilder, safetyGate, behavioralPolicy, himSelector, himSnapshot, himBridge, himConsumptionPolicy, himAdaptation, himContextualCurrent, himReflectionConsumption, himCrossContextForeground, himBrainContext, foregroundGatherer, recommendationGrounding, router,correlation,telemetry);
  });

  it('orchestrates a successful TEXT turn through the router and persists exactly one assistant result', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    const result = await orchestrator.orchestrate('token', 'user', userTurn);
    expect(result).toEqual({ userTurn: completedUser, assistantTurn: assistant });
    expect(result).not.toHaveProperty('provider');
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('usage');
    expect(result).not.toHaveProperty('routingMetadata');
    expect(result).not.toHaveProperty('behavioralGuidance');
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(contextBuilder.build).toHaveBeenCalledWith('token', 'user', userTurn);
    expect(memoryRetriever.retrieve).toHaveBeenCalledWith('user', 'token', 'hello');
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({safetyDisposition:'ALLOW'}));
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({
      modality: 'TEXT', path: 'FAST', behavioralGuidance: 'server-owned policy',
      context: [{ role: 'USER', content: 'hello' }], humanIntelligence: expectedEnvelope(),
    }));
    expect(behavioralPolicy.buildTextGuidance).toHaveBeenCalledTimes(1);
    expect(repository.recoverExpiredGeneratingTurn).not.toHaveBeenCalled();
    expect(await orchestrator.orchestrate('token', 'user', completedUser)).toEqual({ userTurn: completedUser });
  });

  it('uses Fast by default with an explicit default reason', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'FAST', humanIntelligence: expectedEnvelope() }));
  });

  it('calls extraction exactly once only after a fresh eligible turn is finalized and Memory completes', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    const eligibleEvidence = [{ evidenceId: 'memory:30000000-0000-4000-8000-000000000003' }];
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' },
      eligibleEvidence,
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({ status: 'NOT_AUTHORIZED', reason: 'PROVIDER_TIMEOUT' });

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
    expect(hypothesisRequestAssembler.assemble).not.toHaveBeenCalled();
  });

  it('invokes Controlled Generation exactly once after AUTHORIZED READY using the dedicated generator', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' },
      eligibleEvidence: [{ evidenceId: 'memory:30000000-0000-4000-8000-000000000003' }],
    } as never);
    const authorizedIntent: AuthorizedHypothesisGenerationIntent = {
      problem: { text: 'hello', source: 'CURRENT_USER_TURN', sourceTurnId: '10000000-0000-4000-8000-000000000001' },
      domain: 'GENERAL',
      scope: { kind: 'CONVERSATION_SESSION', sessionId: '20000000-0000-4000-8000-000000000002', serialized: 'CONVERSATION_SESSION:20000000-0000-4000-8000-000000000002' },
      evidenceIds: ['memory:30000000-0000-4000-8000-000000000003'],
    };
    hypothesisExtraction.extract.mockResolvedValue({ status: 'AUTHORIZED', intent: authorizedIntent });
    hypothesisRequestAssembler.assemble.mockReturnValue({
      status: 'READY',
      request: {
        problem: authorizedIntent.problem.text,
        domain: authorizedIntent.domain,
        scope: authorizedIntent.scope.serialized,
        evidenceIds: [...authorizedIntent.evidenceIds],
      },
    });
    hypothesisGeneration.generate.mockResolvedValue({ accepted: [{ id: 'accepted-1' }] as never, rejected: [] });

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(hypothesisRequestAssembler.assemble).not.toHaveBeenCalled();
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it('evaluates each accepted target once and preserves successful snapshots on partial failure', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }, eligibleEvidence: [],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({ status: 'AUTHORIZED', intent: {} } as never);
    hypothesisGeneration.generate.mockResolvedValue({
      accepted: Array.from({ length: 5 }, (_, index) => ({ id: `accepted-${index + 1}` })) as never,
      rejected: [],
    });
    confidence.evaluateHypothesis
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('bounded confidence failure'))
      .mockResolvedValue({} as never);

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it('performs zero Confidence evaluations when generation accepts zero proposals', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }, eligibleEvidence: [],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({ status: 'AUTHORIZED', intent: {} } as never);

    await orchestrator.orchestrate('token', 'user', userTurn);

    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
  });

  it('contains all Confidence failures without retrying or invalidating persisted generation', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }, eligibleEvidence: [],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({ status: 'AUTHORIZED', intent: {} } as never);
    hypothesisGeneration.generate.mockResolvedValue({
      accepted: [{ id: 'accepted-1' }, { id: 'accepted-2' }] as never, rejected: [],
    });
    confidence.evaluateHypothesis.mockRejectedValue(new Error('confidence persistence failure'));

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it.each([
    new HypothesisCandidateGeneratorError('UNAVAILABLE'),
    new HypothesisCandidateGeneratorError('TIMEOUT'),
    new HypothesisCandidateGeneratorError('INVALID_STRUCTURED_OUTPUT'),
    new HypothesisCandidateGeneratorError('PROVIDER_ERROR'),
    new Error('bounded persistence failure'),
  ])('keeps the finalized response authoritative when Controlled Generation fails', async (failure) => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' },
      eligibleEvidence: [{ evidenceId: 'memory:30000000-0000-4000-8000-000000000003' }],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({
      status: 'AUTHORIZED', intent: {
        problem: { text: 'hello', source: 'CURRENT_USER_TURN', sourceTurnId: '10000000-0000-4000-8000-000000000001' },
        domain: 'GENERAL',
        scope: { kind: 'CONVERSATION_SESSION', sessionId: '20000000-0000-4000-8000-000000000002', serialized: 'CONVERSATION_SESSION:20000000-0000-4000-8000-000000000002' },
        evidenceIds: ['memory:30000000-0000-4000-8000-000000000003'],
      },
    });
    hypothesisGeneration.generate.mockRejectedValue(failure);

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it('does not invoke Controlled Generation for NOT_READY assembly', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }, eligibleEvidence: [],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({ status: 'AUTHORIZED', intent: {} } as never);
    hypothesisRequestAssembler.assemble.mockReturnValue({ status: 'NOT_READY', reason: 'BOUND_VIOLATION' });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
  });

  it('keeps the finalized response authoritative when assembly fails', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockResolvedValue({
      eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
      triggerClassification: { classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' },
      eligibleEvidence: [{ evidenceId: 'memory:30000000-0000-4000-8000-000000000003' }],
    } as never);
    hypothesisExtraction.extract.mockResolvedValue({
      status: 'AUTHORIZED',
      intent: { problem: { text: 'hello', source: 'CURRENT_USER_TURN', sourceTurnId: '10000000-0000-4000-8000-000000000001' }, domain: 'GENERAL', scope: { kind: 'CONVERSATION_SESSION', sessionId: '20000000-0000-4000-8000-000000000002', serialized: 'CONVERSATION_SESSION:20000000-0000-4000-8000-000000000002' }, evidenceIds: ['memory:30000000-0000-4000-8000-000000000003'] },
    });
    hypothesisRequestAssembler.assemble.mockImplementation(() => { throw new Error('assembly invariant'); });

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(hypothesisRequestAssembler.assemble).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it('selects Deep with the deterministic v2 input-scale reason', async () => {
    const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
    const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
    repository.claimTurn.mockResolvedValue(deepClaim);
    repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
    await orchestrator.orchestrate('token', 'user', deepTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'DEEP', complexity: 'HIGH', humanIntelligence: expect.objectContaining({ sessionReasoningContext: expect.objectContaining({ consumptionMode: 'DEEP' }) }) }));
    // QHIA-013: the DEEP projection still reaches the provider, but the
    // internal conversation-session UUID no longer travels with it.
    expect(dispatchedHumanIntelligence()).toEqual(expectedEnvelope({}, 'DEEP'));
    expect(dispatchedHumanIntelligence()!.sessionReasoningContext).not.toHaveProperty('contextId');
    expect(router.generate.mock.calls[0][0]).not.toHaveProperty('trend');
  });

  it('terminalizes the source turn safely when the router fails', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    router.generate.mockRejectedValue(new Error('private provider detail'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
    expect(repository.finalizeTurn).not.toHaveBeenCalled();
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
  });

  it('suppresses a late result when atomic finalization reports cancellation or staleness', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue(undefined);
    repository.findTurn.mockResolvedValue({ ...claimed, status: 'CANCELLED' });
    repository.findAssistantForSource.mockResolvedValue(undefined);
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: { ...claimed, status: 'CANCELLED' } });
  });

  it('does not let a delayed provider-neutral OpenAI result defeat cancellation', async () => {
    let release!: (result: Awaited<ReturnType<ModelRouter['generate']>>) => void;
    router.generate.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue(undefined);
    repository.findTurn.mockResolvedValue({ ...claimed, status: 'CANCELLED' });
    repository.findAssistantForSource.mockResolvedValue(undefined);

    const pending = orchestrator.orchestrate('token', 'user', userTurn);
    await new Promise<void>((resolve) => setImmediate(resolve));
    release({
      content: 'late OpenAI text', routingMetadata: { path: 'FAST' },
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await expect(pending).resolves.toEqual({ userTurn: { ...claimed, status: 'CANCELLED' } });
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate routing or assistant side effects for a duplicate request', async () => {
    repository.claimTurn.mockResolvedValue(undefined);
    repository.findTurn.mockResolvedValue(completedUser);
    repository.findAssistantForSource.mockResolvedValue(assistant);
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
    expect(router.generate).not.toHaveBeenCalled();
    expect(memoryRetriever.retrieve).not.toHaveBeenCalled();
    expect(behavioralPolicy.buildTextGuidance).not.toHaveBeenCalled();
    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).not.toHaveBeenCalled();
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
    expect(himSelector.select).not.toHaveBeenCalled();
    expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
    expect(himBridge.transform).not.toHaveBeenCalled();
    expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
    expect(himAdaptation.derive).not.toHaveBeenCalled();
    expect(himContextualCurrent.getCurrentSelection).not.toHaveBeenCalled();
    expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
    expect(hypothesisContext.build).not.toHaveBeenCalled();
    expect(recommendationGrounding.ground).not.toHaveBeenCalled();
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
  });

  it('keeps selected memory separate from history without changing FAST routing', async () => {
    memoryRetriever.retrieve.mockResolvedValue([{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }]);
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    const request = router.generate.mock.calls[0][0];
    expect(request.path).toBe('FAST');
    expect(request.context).toEqual([{ role: 'USER', content: 'hello' }]);
    expect(request.memoryContext).toEqual([{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }]);
    expect(request.humanIntelligence?.sessionReasoningContext).toEqual(providerSessionReasoningContext());
  });

  it('atomically finalizes BLOCK without behavioral policy or router calls', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'BLOCK', deterministicResponse: 'safe deterministic response',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({
      userTurn: completedUser, assistantTurn: { ...assistant, content: 'safe deterministic response' },
    });

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toMatchObject({
      assistantTurn: { content: 'safe deterministic response' },
    });
    expect(router.generate).not.toHaveBeenCalled();
    expect(memoryRetriever.retrieve).not.toHaveBeenCalled();
    expect(behavioralPolicy.buildTextGuidance).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({safetyDisposition:'BLOCK'}));
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
    expect(himSelector.select).not.toHaveBeenCalled();
    expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
    expect(himBridge.transform).not.toHaveBeenCalled();
    expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
    expect(himAdaptation.derive).not.toHaveBeenCalled();
    expect(himContextualCurrent.getCurrentSelection).not.toHaveBeenCalled();
    expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
    expect(hypothesisContext.build).not.toHaveBeenCalled();
    expect(recommendationGrounding.ground).not.toHaveBeenCalled();
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
    expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
  });

  it('keeps a finalized response authoritative when memory persistence fails', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    memoryWriter.evaluateAndWrite.mockRejectedValue(new Error('private memory failure'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    expect(repository.failTurn).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
  });

  it('exposes no synchronous post-finalization enrichment helper', () => {
    expect((orchestrator as any).writeMemoryFailSoft).toBeUndefined();
    expect((orchestrator as any).evaluateEligibilityFailSoft).toBeUndefined();
  });

  it('keeps a finalized response authoritative when eligibility evaluation fails', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    hypothesisEligibility.evaluateWithContext.mockRejectedValue(new Error('eligibility failure'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: completedUser, assistantTurn: assistant,
    });
    expect(repository.failTurn).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
  });

  it('skips automatic writes for GUIDED safety content', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: 'server safety guidance',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
  });

  it('carries GUIDED safety separately and invokes the provider exactly once', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: 'server safety guidance',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(repository.finalizeTurn).toHaveBeenCalledWith(expect.objectContaining({safetyDisposition:'GUIDED'}));
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({
      safetyGuidance: 'server safety guidance',
      context: [{ role: 'USER', content: 'hello' }],
    }));
    expect(router.generate.mock.calls[0][0].context).not.toContainEqual(
      expect.objectContaining({ content: 'server safety guidance' }),
    );
    expect(himConsumptionPolicy.project).toHaveBeenCalledWith('FAST', himReasoningContext);
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ humanIntelligence: expectedEnvelope() }));
    expect(router.generate.mock.calls[0][0].safetyGuidance).toBe('server safety guidance');
  });

  it('suppresses stale BLOCK finalization and does not create a second assistant result', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'VIOLENCE_OR_HARM_TO_OTHERS', disposition: 'BLOCK', deterministicResponse: 'safe response',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue(undefined);
    repository.findTurn.mockResolvedValue({ ...claimed, status: 'CANCELLED' });
    repository.findAssistantForSource.mockResolvedValue(undefined);
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({
      userTurn: { ...claimed, status: 'CANCELLED' },
    });
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
  });

  it('runs ALLOW in selector -> snapshot -> bridge -> router order using the claimed server turn', async () => {
    const serverClaim = { ...claimed, id: 'claimed-turn', session_id: 'claimed-session' };
    himSelector.select.mockReturnValue({
      contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
      sourceTurnId: serverClaim.id, contextKind: 'CONVERSATION_SESSION', contextId: serverClaim.session_id,
      selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
    });
    repository.claimTurn.mockResolvedValue(serverClaim);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });

    await orchestrator.orchestrate('token', 'user', userTurn);

    expect(himSelector.select).toHaveBeenCalledWith(serverClaim);
    expect(himSnapshot.getSnapshot).toHaveBeenCalledWith('token', 'CONVERSATION_SESSION', 'claimed-session');
    expect(himBridge.transform).toHaveBeenCalledWith(snapshot);
    expect(himConsumptionPolicy.project).toHaveBeenCalledWith('FAST', himReasoningContext);
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ humanIntelligence: expectedEnvelope() }));
    expect(himSelector.select.mock.invocationCallOrder[0]).toBeLessThan(himSnapshot.getSnapshot.mock.invocationCallOrder[0]);
    expect(himSnapshot.getSnapshot.mock.invocationCallOrder[0]).toBeLessThan(himBridge.transform.mock.invocationCallOrder[0]);
    expect(himBridge.transform.mock.invocationCallOrder[0]).toBeLessThan(himConsumptionPolicy.project.mock.invocationCallOrder[0]);
    expect(himConsumptionPolicy.project.mock.invocationCallOrder[0]).toBeLessThan(router.generate.mock.invocationCallOrder[0]);
  });

  it.each(['selector', 'snapshot', 'bridge', 'policy'] as const)('fails closed when the HIM %s fails', async (stage) => {
    repository.claimTurn.mockResolvedValue(claimed);
    if (stage === 'selector') himSelector.select.mockImplementation(() => { throw new Error('integrity'); });
    if (stage === 'snapshot') himSnapshot.getSnapshot.mockRejectedValue(new Error('snapshot'));
    if (stage === 'bridge') himBridge.transform.mockImplementation(() => { throw new Error('bridge'); });
    if (stage === 'policy') himConsumptionPolicy.project.mockImplementation(() => { throw new Error('policy'); });

    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
  });

  describe('HIM interaction adaptation orchestration (QHIA-001)', () => {
    it('wires Snapshot -> Reasoning -> Adaptation -> Router with adaptation derived before the FAST/DEEP projection', async () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(1);
      expect(himAdaptation.derive).toHaveBeenCalledWith(himReasoningContext);
      expect(himSnapshot.getSnapshot.mock.invocationCallOrder[0]).toBeLessThan(himBridge.transform.mock.invocationCallOrder[0]);
      expect(himBridge.transform.mock.invocationCallOrder[0]).toBeLessThan(himAdaptation.derive.mock.invocationCallOrder[0]);
      expect(himAdaptation.derive.mock.invocationCallOrder[0]).toBeLessThan(himConsumptionPolicy.project.mock.invocationCallOrder[0]);
      expect(himConsumptionPolicy.project.mock.invocationCallOrder[0]).toBeLessThan(router.generate.mock.invocationCallOrder[0]);
    });

    it('passes an ACTIVE adaptation to router.generate as the typed optional field', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({ himInteractionAdaptation: activeAdaptation });
    });

    it('omits the optional field entirely for a NONE adaptation, preserving the no-adaptation guidance path', async () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
    });

    it('derives the same adaptation from the same reasoning state on FAST and DEEP without influencing path selection', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(2);
      expect(himAdaptation.derive).toHaveBeenNthCalledWith(1, himReasoningContext);
      expect(himAdaptation.derive).toHaveBeenNthCalledWith(2, himReasoningContext);
      expect(dispatchedRequest(0).path).toBe('FAST');
      expect(dispatchedRequest(1).path).toBe('DEEP');
      expectDispatchedHumanIntelligence({ himInteractionAdaptation: activeAdaptation }, { call: 0, path: 'FAST' });
      expectDispatchedHumanIntelligence({ himInteractionAdaptation: activeAdaptation }, { call: 1, path: 'DEEP' });
      // Path selection stays owned by the deterministic input-length rule.
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
    });

    it('fails closed with no provider generation when adaptation integrity rejects the reasoning context', async () => {
      himAdaptation.derive.mockImplementation(() => { throw new Error('INTEGRITY_FAILURE'); });
      repository.claimTurn.mockResolvedValue(claimed);
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
    });
  });

  describe('Session Reflection consumption orchestration (QHIA-005)', () => {
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };

    it('reuses the authoritative session selection for both the HSE Snapshot and the exact one-metric Reflection selective read', async () => {
      const serverClaim = { ...claimed, id: 'claimed-turn', session_id: 'claimed-session' };
      himSelector.select.mockReturnValue({
        contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
        sourceTurnId: serverClaim.id, contextKind: 'CONVERSATION_SESSION', contextId: serverClaim.session_id,
        selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
      });
      repository.claimTurn.mockResolvedValue(serverClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himSelector.select).toHaveBeenCalledTimes(1);
      expect(himSnapshot.getSnapshot).toHaveBeenCalledWith('token', 'CONVERSATION_SESSION', 'claimed-session');
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledWith(
        'user', 'token', 'CONVERSATION_SESSION', 'claimed-session', ['hbs.reflection'],
      );
      // The QHIA-004 selective path only: no full four-slot contextual read.
      expect(himContextualCurrent.getCurrentIntelligence).not.toHaveBeenCalled();
    });

    it('launches the HSE Snapshot and the Reflection selective read concurrently, never as a serial network stage', async () => {
      let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
      let releaseReflection!: (value: HimContextualCurrentSelection) => void;
      himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
      himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise((resolve) => { releaseReflection = resolve; }));
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await new Promise<void>((resolve) => setImmediate(resolve));
      // Both reads are LAUNCHED while both are still unresolved: the
      // Reflection request was issued before the HSE Snapshot promise was
      // released, so an `await snapshot; await reflection` serialization is
      // structurally impossible here.
      expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
      expect(himBridge.transform).not.toHaveBeenCalled();
      // Releasing only the Snapshot does not proceed: the join genuinely waits
      // for the already-launched Reflection read (and vice versa).
      releaseSnapshot(snapshot);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(himBridge.transform).not.toHaveBeenCalled();
      releaseReflection(reflectionSelection(2));
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('still proceeds when the Snapshot is released only after the Reflection read resolves', async () => {
      let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
      himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(null));
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
      expect(himBridge.transform).not.toHaveBeenCalled();
      releaseSnapshot(snapshot);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('consumes the resolved selection through the dedicated pure boundary and passes ACTIVE low guidance to the router', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himReflectionConsumption.consume).toHaveBeenCalledTimes(1);
      expect(himReflectionConsumption.consume).toHaveBeenCalledWith(reflectionSelection(1));
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: inviteReflectionGuidance });
    });

    it('passes ACTIVE high guidance to the router as the typed optional field', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(5));
      himReflectionConsumption.consume.mockReturnValue(avoidReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: avoidReflectionGuidance });
    });

    it('omits the router field entirely for MODERATE (NONE guidance)', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(3));
      himReflectionConsumption.consume.mockReturnValue(noneReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himReflectionConsumption.consume).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
    });

    it('omits the router field entirely for UNKNOWN', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(null));
      himReflectionConsumption.consume.mockReturnValue(noneReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expectDispatchedHumanIntelligence();
    });

    it('degrades a rejected Reflection read to omitted guidance while the turn generates normally', async () => {
      himContextualCurrent.getCurrentSelection.mockRejectedValue(new Error('private data api failure'));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    });

    it('degrades a malformed selection (pure consumption INTEGRITY_FAILURE) to omitted guidance without altering HSE adaptation', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      himReflectionConsumption.consume.mockImplementation(() => { throw new Error('INTEGRITY_FAILURE'); });
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(himReflectionConsumption.consume).toHaveBeenCalledTimes(1);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({ himInteractionAdaptation: activeAdaptation });
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('keeps the HSE Snapshot -> Reasoning -> Adaptation chain exactly unchanged when Reflection guidance is active', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(2));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himSnapshot.getSnapshot).toHaveBeenCalledWith('token', 'CONVERSATION_SESSION', 'session');
      expect(himBridge.transform).toHaveBeenCalledWith(snapshot);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(1);
      expect(himAdaptation.derive).toHaveBeenCalledWith(himReasoningContext);
      expect(himConsumptionPolicy.project).toHaveBeenCalledWith('FAST', himReasoningContext);
      // Reflection never becomes an input of the HSE consumption chain.
      expect(himBridge.transform).not.toHaveBeenCalledWith(expect.objectContaining({ metrics: expect.arrayContaining([expect.objectContaining({ metricKey: 'hbs.reflection' })]) }));
    });

    it('delivers an active HSE adaptation and active Reflection guidance together without cancellation', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(4));
      himReflectionConsumption.consume.mockReturnValue(avoidReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({
        himInteractionAdaptation: activeAdaptation,
        himSessionReflectionGuidance: avoidReflectionGuidance,
      });
    });

    it('gives FAST and DEEP the same Reflection guidance for identical Reflection input and never selects the path', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(2));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(dispatchedRequest(0).path).toBe('FAST');
      expect(dispatchedRequest(1).path).toBe('DEEP');
      expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: inviteReflectionGuidance }, { call: 0, path: 'FAST' });
      expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: inviteReflectionGuidance }, { call: 1, path: 'DEEP' });
      // Path selection stays owned by the deterministic input-length rule:
      // Reflection is consumed after the route is claimed and never selects it.
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
    });

    it('lets a fast Reflection read win the 300 ms foreground budget, deliver guidance, and clear its timer (no leak)', async () => {
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
        himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: inviteReflectionGuidance });
        // The foreground budget timer was cleared on the read's own
        // resolution: no pending QHIA-005 timer survives a fast read.
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });

    it('bounds the foreground wait to exactly 300 ms: a slow pending Reflection degrades to no guidance, never turn failure', async () => {
      jest.useFakeTimers();
      try {
        let releaseReflection!: (value: HimContextualCurrentSelection) => void;
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise((resolve) => { releaseReflection = resolve; }));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        // HSE Snapshot has resolved; Reflection is still pending. One tick
        // before the budget the foreground is still (correctly) waiting.
        await jest.advanceTimersByTimeAsync(299);
        expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
        expect(router.generate).not.toHaveBeenCalled();
        // Crossing the exact 300 ms budget releases the foreground.
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
        expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
        expect(repository.failTurn).not.toHaveBeenCalled();
        // Late fulfillment of the original read after the completed turn is
        // ignored entirely: no consumption, no second provider call, no
        // re-finalization.
        releaseReflection(reflectionSelection(2));
        await jest.advanceTimersByTimeAsync(0);
        expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('absorbs a late Reflection rejection after the budget with no unhandled rejection and no behavioral effect', async () => {
      jest.useFakeTimers();
      try {
        let rejectReflection!: (error: Error) => void;
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise((_resolve, reject) => { rejectReflection = reject; }));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(300);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        rejectReflection(new Error('late private transport failure'));
        await jest.advanceTimersByTimeAsync(0);
        expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('rejects the expired budget INSIDE the him_reflection_context engine work so telemetry records a failed enrichment', async () => {
      const withEngine = jest.spyOn(telemetry, 'withEngine');
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = correlation.runRequest(() => orchestrator.orchestrate('token', 'user', userTurn));
        await jest.advanceTimersByTimeAsync(300);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        const reflectionEngineResults = withEngine.mock.calls
          .map((call, index) => ({ engine: call[0], result: withEngine.mock.results[index] }))
          .filter(({ engine }) => engine === 'him_reflection_context');
        expect(reflectionEngineResults).toHaveLength(1);
        // The engine-wrapped work itself rejected with the budget expiry: the
        // span records a failure, never a false successful enrichment, and the
        // degradation handler sits OUTSIDE the engine boundary.
        await expect(reflectionEngineResults[0].result.value).rejects.toThrow('SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_EXCEEDED');
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
        expect(repository.failTurn).not.toHaveBeenCalled();
      } finally { jest.useRealTimers(); }
    });

    it('clears the foreground budget timer when the Reflection read rejects before the budget', async () => {
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockRejectedValue(new Error('fast private failure'));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(jest.getTimerCount()).toBe(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
      } finally { jest.useRealTimers(); }
    });

    it('adds no Question, Recommendation, Hypothesis, or Memory work: Reflection changes only the router guidance channel', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
      expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
      expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
      expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    });
  });

  describe('Cross-context foreground aggregation (QHIA-009 transport, QHIA-011 v3 envelope)', () => {
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
    const REDUCE_COGNITIVE_LOAD = 'Use simpler structure and avoid unnecessary detail or cognitive burden.';
    const SINGLE_TRACK = 'Stay on one main conversational track; avoid multiple parallel branches.';
    const ONE_AT_A_TIME = 'When guidance is otherwise appropriate, present one immediate step or unit at a time rather than a bundle.';
    const REDUCE_STEERING_PRESSURE = 'Reduce steering pressure; do not push the user toward an action or conclusion.';
    const CALMER_PACING = 'Use calmer, steadier delivery without claiming or naming the user\'s internal state.';
    const SMALL_IMMEDIATE_ACTION = 'When goal-related action guidance is otherwise appropriate, keep the immediate action small and bounded rather than expanding it into a larger task bundle.';
    const EXPLICIT_WORDING = 'When relationship-related communication guidance is otherwise appropriate, make any suggested wording explicit and concrete rather than relying on hints, implied meaning, or the other person inferring the main point.';
    const ONE_MAIN_POINT = 'Keep any suggested message or exchange focused on one main point or request at a time rather than bundling several issues together.';
    const CLARITY_NOT_AGREEMENT = 'Aim for clear expression and workable understanding; do not make immediate agreement, persuasion, or winning the exchange the goal.';
    const COMMUNICATION_INSTRUCTIONS = [EXPLICIT_WORDING, ONE_MAIN_POINT, CLARITY_NOT_AGREEMENT];
    const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

    it('reads the cross-context foreground ONCE per eligible turn, for the authoritative claimed session, through the one aggregate boundary', async () => {
      const serverClaim = { ...claimed, id: 'claimed-turn', session_id: 'claimed-session' };
      himSelector.select.mockReturnValue({
        contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
        sourceTurnId: serverClaim.id, contextKind: 'CONVERSATION_SESSION', contextId: serverClaim.session_id,
        selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
      });
      repository.claimTurn.mockResolvedValue(serverClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himSelector.select).toHaveBeenCalledTimes(1);
      // Exactly ONE cross-context foreground read for the whole turn - the two
      // independent QHIA-007 and QHIA-008 reads it replaces are gone.
      expect(himCrossContextForeground.read).toHaveBeenCalledTimes(1);
      expect(himCrossContextForeground.read).toHaveBeenCalledWith('user', 'token', 'claimed-session');
      // The QHIA-006 application boundary is never used as a foreground
      // fan-out, and the aggregate never becomes a second full contextual read.
      expect(himContextualCurrent.getCurrentIntelligence).not.toHaveBeenCalled();
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledWith(
        'user', 'token', 'CONVERSATION_SESSION', 'claimed-session', ['hbs.reflection'],
      );
    });

    it('LAUNCHES the aggregate read concurrently with the Snapshot and Reflection reads, never after either settles', async () => {
      let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
      let releaseReflection!: (value: HimContextualCurrentSelection) => void;
      himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
      himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise((resolve) => { releaseReflection = resolve; }));
      himCrossContextForeground.read.mockReturnValue(new Promise(() => undefined));
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await flush();
      // All three foreground HIM reads are in flight simultaneously: the
      // aggregate request was issued while the Snapshot and Reflection promises
      // are both still unresolved, so `await snapshot; await aggregate` (or
      // `await reflection; await aggregate`) is structurally impossible.
      expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
      expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
      expect(himCrossContextForeground.read).toHaveBeenCalledTimes(1);
      expect(himBridge.transform).not.toHaveBeenCalled();
      releaseSnapshot(snapshot);
      releaseReflection(reflectionSelection(null));
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('makes ALL FOUR existing guidance fields available to provider construction when the aggregate settles before the existing barrier', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({
        himSituationStressGuidance: activeSituationStressGuidance,
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
    });

    it('carries ONLY the Situation field when Situation is ACTIVE and the other three are NONE', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, noneDecisionAttentionGuidance, noneGoalMotivationGuidance, noneRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expectDispatchedHumanIntelligence({ himSituationStressGuidance: activeSituationStressGuidance });
    });

    it('carries ONLY the Decision field when Decision is ACTIVE and the other three are NONE', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, activeDecisionAttentionGuidance, noneGoalMotivationGuidance, noneRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expectDispatchedHumanIntelligence({ himDecisionAttentionGuidance: activeDecisionAttentionGuidance });
    });

    it('carries ONLY the Goal field when Goal Motivation is ACTIVE and the other three are NONE', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance, activeGoalMotivationGuidance, noneRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({ himGoalMotivationGuidance: activeGoalMotivationGuidance });
    });

    it('carries ONLY the Relationship field when Relationship Communication is ACTIVE and the other three are NONE', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance, noneGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({ himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance });
      // The three bounded communication-scaffolding instructions are the ONLY
      // thing this channel adds: it borrows no existing burden reduction.
      const rendered = composeServerGuidance(dispatched);
      for (const instruction of COMMUNICATION_INSTRUCTIONS) expect(occurrences(rendered, instruction)).toBe(1);
      for (const instruction of [REDUCE_COGNITIVE_LOAD, SINGLE_TRACK, ONE_AT_A_TIME, REDUCE_STEERING_PRESSURE, CALMER_PACING, SMALL_IMMEDIATE_ACTION]) {
        expect(rendered).not.toContain(instruction);
      }
    });

    it('carries EXACTLY the Situation and Relationship fields when those two are ACTIVE, and keeps both channels intact', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, noneDecisionAttentionGuidance, noneGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himSituationStressGuidance: activeSituationStressGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
      const rendered = composeServerGuidance(dispatched);
      for (const instruction of [REDUCE_COGNITIVE_LOAD, REDUCE_STEERING_PRESSURE, CALMER_PACING, ...COMMUNICATION_INSTRUCTIONS]) {
        expect(occurrences(rendered, instruction)).toBe(1);
      }
      expect(rendered).not.toContain(SINGLE_TRACK);
      expect(rendered).not.toContain(SMALL_IMMEDIATE_ACTION);
    });

    it('carries EXACTLY the Decision and Relationship fields when those two are ACTIVE, and keeps both channels intact', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, activeDecisionAttentionGuidance, noneGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
      const rendered = composeServerGuidance(dispatched);
      // The generic one-step-at-a-time instruction and the new one-main-point
      // instruction are DIFFERENT semantic instructions and both stand.
      for (const instruction of [REDUCE_COGNITIVE_LOAD, SINGLE_TRACK, ONE_AT_A_TIME, ...COMMUNICATION_INSTRUCTIONS]) {
        expect(occurrences(rendered, instruction)).toBe(1);
      }
      expect(rendered).not.toContain(CALMER_PACING);
    });

    it('carries EXACTLY the Goal and Relationship fields when those two are ACTIVE, and keeps both channels intact', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
      const rendered = composeServerGuidance(dispatched);
      for (const instruction of [SMALL_IMMEDIATE_ACTION, REDUCE_STEERING_PRESSURE, ONE_AT_A_TIME, ...COMMUNICATION_INSTRUCTIONS]) {
        expect(occurrences(rendered, instruction)).toBe(1);
      }
      expect(rendered).not.toContain(REDUCE_COGNITIVE_LOAD);
    });

    it('carries EXACTLY the Situation and Goal fields when those two are ACTIVE, and renders shared reductions once', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, noneDecisionAttentionGuidance, activeGoalMotivationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himSituationStressGuidance: activeSituationStressGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
      });
      // The shared reduced-steering-pressure instruction is contributed by BOTH
      // channels and rendered exactly once; each channel's own unique
      // instructions still appear.
      const rendered = composeServerGuidance(dispatched);
      expect(occurrences(rendered, REDUCE_STEERING_PRESSURE)).toBe(1);
      expect(occurrences(rendered, REDUCE_COGNITIVE_LOAD)).toBe(1);
      expect(occurrences(rendered, CALMER_PACING)).toBe(1);
      expect(occurrences(rendered, SMALL_IMMEDIATE_ACTION)).toBe(1);
      expect(occurrences(rendered, ONE_AT_A_TIME)).toBe(1);
      expect(rendered).not.toContain(SINGLE_TRACK);
      expect(composeServerGuidance(dispatched)).toBe(rendered);
    });

    it('carries EXACTLY the Decision and Goal fields when those two are ACTIVE, and renders shared reductions once', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
      });
      // The shared one-step-at-a-time instruction is contributed by BOTH
      // channels and rendered exactly once.
      const rendered = composeServerGuidance(dispatched);
      expect(occurrences(rendered, ONE_AT_A_TIME)).toBe(1);
      expect(occurrences(rendered, REDUCE_COGNITIVE_LOAD)).toBe(1);
      expect(occurrences(rendered, SINGLE_TRACK)).toBe(1);
      expect(occurrences(rendered, SMALL_IMMEDIATE_ACTION)).toBe(1);
      expect(occurrences(rendered, REDUCE_STEERING_PRESSURE)).toBe(1);
      expect(rendered).not.toContain(CALMER_PACING);
      expect(composeServerGuidance(dispatched)).toBe(rendered);
    });

    it('omits ALL FOUR router fields entirely when every channel is NONE', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance, noneGoalMotivationGuidance, noneRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expectDispatchedHumanIntelligence();
    });

    it('adds ZERO incremental foreground wait: a still-pending aggregate never delays provider dispatch', async () => {
      jest.useFakeTimers();
      try {
        let releaseAggregate!: (value: HimCrossContextForegroundGuidance) => void;
        himCrossContextForeground.read.mockReturnValue(new Promise((resolve) => { releaseAggregate = resolve; }));
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(2));
        himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
        finalizeNormally();
        // Snapshot and Reflection both complete quickly; the aggregate is still
        // pending. The turn completes with NO timer advance at all, so no
        // additional wait of any duration was introduced.
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        // The still-pending aggregate contributed no instruction, while the
        // optional Reflection enrichment still won its own existing budget:
        // QHIA-013 changed no QHIA-005, QHIA-009 or QHIA-010 semantics.
        expectDispatchedHumanIntelligence({ himSessionReflectionGuidance: inviteReflectionGuidance });
        // No cross-context timer exists: the only foreground timer in the
        // system is the pre-existing Reflection budget, and it was cleared by
        // its own fast resolution. Adding the third server-side slot introduced
        // no new timeout, barrier, or await.
        expect(jest.getTimerCount()).toBe(0);
        // A late completion after dispatch is ignored for this turn.
        releaseAggregate(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
        await jest.advanceTimersByTimeAsync(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('dispatches at the EXISTING 300 ms Reflection barrier and adds no further wait for a pending aggregate', async () => {
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise(() => undefined));
        himCrossContextForeground.read.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(299);
        expect(router.generate).not.toHaveBeenCalled();
        // Crossing the pre-existing QHIA-005 budget releases the foreground,
        // and the still-pending aggregate adds not one millisecond.
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });

    it('degrades a rejected aggregate to ALL FOUR fields omitted while the turn generates normally, with no fallback request', async () => {
      himCrossContextForeground.read.mockRejectedValue(new Error('private data api failure'));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
      // No second request of any kind: the rejected aggregate is not retried,
      // the retired aggregate-v1 endpoint is not used as a fallback, and the
      // direct reads are not fired as backups.
      expect(himCrossContextForeground.read).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    });

    it('absorbs a LATE rejection after dispatch with no unhandled rejection, no mutation, and no second dispatch', async () => {
      jest.useFakeTimers();
      try {
        let rejectAggregate!: (error: Error) => void;
        himCrossContextForeground.read.mockReturnValue(new Promise((_resolve, reject) => { rejectAggregate = reject; }));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        const dispatchedSnapshot = JSON.stringify(router.generate.mock.calls[0][0]);
        rejectAggregate(new Error('late private transport failure'));
        await jest.advanceTimersByTimeAsync(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(router.generate.mock.calls[0][0])).toBe(dispatchedSnapshot);
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('ignores a LATE fulfillment after dispatch: the in-flight provider request is never mutated', async () => {
      jest.useFakeTimers();
      try {
        let releaseAggregate!: (value: HimCrossContextForegroundGuidance) => void;
        himCrossContextForeground.read.mockReturnValue(new Promise((resolve) => { releaseAggregate = resolve; }));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        const dispatchedSnapshot = JSON.stringify(router.generate.mock.calls[0][0]);
        releaseAggregate(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
        await jest.advanceTimersByTimeAsync(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
        expect(JSON.stringify(router.generate.mock.calls[0][0])).toBe(dispatchedSnapshot);
      } finally { jest.useRealTimers(); }
    });

    it('never reuses a late aggregate on the NEXT turn: the second turn reads again and gets its own answer', async () => {
      jest.useFakeTimers();
      try {
        let releaseFirst!: (value: HimCrossContextForegroundGuidance) => void;
        himCrossContextForeground.read.mockReturnValueOnce(new Promise((resolve) => { releaseFirst = resolve; }));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expectDispatchedHumanIntelligence();
        // The first turn's aggregate settles all-ACTIVE only after that turn
        // dispatched.
        releaseFirst(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
        await jest.advanceTimersByTimeAsync(0);
        // The next turn performs its own aggregate read; the stale ACTIVE
        // result is not carried over, and no cross-turn cache exists.
        himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(noneSituationStressGuidance, noneDecisionAttentionGuidance, noneGoalMotivationGuidance));
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(himCrossContextForeground.read).toHaveBeenCalledTimes(2);
        expect(router.generate).toHaveBeenCalledTimes(2);
        expectDispatchedHumanIntelligence({}, { call: 1 });
      } finally { jest.useRealTimers(); }
    });

    it('records the enrichment outcome inside its own him_cross_context_foreground engine span', async () => {
      const withEngine = jest.spyOn(telemetry, 'withEngine');
      himCrossContextForeground.read.mockRejectedValue(new Error('private transport failure'));
      finalizeNormally();
      const pending = correlation.runRequest(() => orchestrator.orchestrate('token', 'user', userTurn));
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      const engineResults = withEngine.mock.calls
        .map((call, index) => ({ engine: call[0], result: withEngine.mock.results[index] }))
        .filter(({ engine }) => engine === 'him_cross_context_foreground');
      expect(engineResults).toHaveLength(1);
      await expect(engineResults[0].result.value).rejects.toThrow('private transport failure');
      // The three retired per-channel spans no longer exist: one transport, one
      // span.
      expect(withEngine.mock.calls.map((call) => call[0])).not.toContain('him_situation_stress_context');
      expect(withEngine.mock.calls.map((call) => call[0])).not.toContain('him_decision_attention_context');
      expect(withEngine.mock.calls.map((call) => call[0])).not.toContain('him_goal_motivation_context');
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('keeps provider rendering byte-compatible for ALL FOUR ACTIVE channels: dedup stays deterministic', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      expectDispatchedHumanIntelligence({
        himInteractionAdaptation: activeAdaptation,
        himSituationStressGuidance: activeSituationStressGuidance,
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
      // The single common rendering path is untouched by QHIA-011: the same
      // request renders byte-identical guidance every time, and every distinct
      // bounded instruction is emitted at most once even when five server-owned
      // channels ask for overlapping ones.
      const rendered = composeServerGuidance(dispatched);
      expect(composeServerGuidance(dispatched)).toBe(rendered);
      for (const instruction of [REDUCE_COGNITIVE_LOAD, SINGLE_TRACK, ONE_AT_A_TIME, REDUCE_STEERING_PRESSURE, CALMER_PACING, SMALL_IMMEDIATE_ACTION, ...COMMUNICATION_INSTRUCTIONS]) {
        expect(occurrences(rendered, instruction)).toBe(1);
      }
      // Four agreeing signals never compound into a stronger interpretation:
      // the rendered union is exactly the set of DISTINCT instructions they
      // requested.
      const bullets = rendered.split('\n').filter((line) => line.startsWith('- '));
      expect(new Set(bullets).size).toBe(bullets.length);
    });

    it('delivers an active HSE adaptation, Reflection, Situation-stress, Decision-attention, Goal-motivation, and Relationship-communication guidance together', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(4));
      himReflectionConsumption.consume.mockReturnValue(avoidReflectionGuidance);
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence({
        himInteractionAdaptation: activeAdaptation,
        himSessionReflectionGuidance: avoidReflectionGuidance,
        himSituationStressGuidance: activeSituationStressGuidance,
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      });
    });

    it('gives FAST and DEEP identical guidance and never participates in path selection', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      const allFourActive = {
        himSituationStressGuidance: activeSituationStressGuidance,
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
      };
      expect(dispatchedRequest(0).path).toBe('FAST');
      expect(dispatchedRequest(1).path).toBe('DEEP');
      expectDispatchedHumanIntelligence(allFourActive, { call: 0, path: 'FAST' });
      expectDispatchedHumanIntelligence(allFourActive, { call: 1, path: 'DEEP' });
      // FAST and DEEP receive IDENTICAL behavioral semantics: only the session
      // reasoning density differs, and Human Intelligence never selects the path.
      expect(dispatchedHumanIntelligence(0)!.behavioralInstructionIds)
        .toEqual(dispatchedHumanIntelligence(1)!.behavioralInstructionIds);
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
    });

    it('keeps the HSE Snapshot -> Reasoning -> Adaptation chain and the Reflection channel exactly unchanged', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance));
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(2));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himSnapshot.getSnapshot).toHaveBeenCalledWith('token', 'CONVERSATION_SESSION', 'session');
      expect(himBridge.transform).toHaveBeenCalledTimes(1);
      expect(himBridge.transform).toHaveBeenCalledWith(snapshot);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(1);
      expect(himAdaptation.derive).toHaveBeenCalledWith(himReasoningContext);
      expect(himConsumptionPolicy.project).toHaveBeenCalledWith('FAST', himReasoningContext);
      expect(himReflectionConsumption.consume).toHaveBeenCalledTimes(1);
      expect(himReflectionConsumption.consume).toHaveBeenCalledWith(reflectionSelection(2));
    });

    it('adds no Question, Recommendation, Hypothesis, Memory, or provider work beyond the guidance channel', async () => {
      himCrossContextForeground.read.mockResolvedValue(crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance));
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
      expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
      expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
      expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    });

    it('performs no cross-context foreground read at all when Safety BLOCKs the turn', async () => {
      safetyGate.evaluate.mockReturnValue({ category: 'SELF_HARM_OR_SUICIDE', disposition: 'BLOCK', deterministicResponse: 'safe deterministic response' });
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himCrossContextForeground.read).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
    });

    // The retired direct boundaries, proven at RUNTIME rather than by absence.
    // The REAL QHIA-007, QHIA-008, QHIA-010 and QHIA-011 consumption services
    // are wired into the orchestrator's dependency graph here - as the
    // aggregate's own children, over their REAL direct repositories - so "the
    // Orchestrator no longer calls read(...)" is a fact about a reachable
    // object, not about an object that was simply removed from the test.
    const realAggregateOrchestrator = () => {
      const crossContextRepository = { readSessionCrossContextForeground: jest.fn().mockResolvedValue(unboundEnvelope()) };
      const situationRepository = { readSessionSituationStress: jest.fn().mockResolvedValue([unboundSituationRow()]) };
      const decisionRepository = { readSessionDecisionAttention: jest.fn().mockResolvedValue([unboundDecisionRow()]) };
      const goalRepository = { readSessionGoalMotivation: jest.fn().mockResolvedValue([unboundGoalRow()]) };
      const relationshipRepository = { readSessionRelationshipCommunication: jest.fn().mockResolvedValue([unboundRelationshipRow()]) };
      const situationConsumption = new HimSituationStressConsumptionService(situationRepository as never);
      const decisionConsumption = new HimDecisionAttentionConsumptionService(decisionRepository as never);
      const goalConsumption = new HimGoalMotivationConsumptionService(goalRepository as never);
      const relationshipConsumption = new HimRelationshipCommunicationConsumptionService(relationshipRepository as never);
      const situationDirectRead = jest.spyOn(situationConsumption, 'read');
      const decisionDirectRead = jest.spyOn(decisionConsumption, 'read');
      const goalDirectRead = jest.spyOn(goalConsumption, 'read');
      const relationshipDirectRead = jest.spyOn(relationshipConsumption, 'read');
      const aggregation = new HimCrossContextForegroundAggregationService(
        crossContextRepository as never, situationConsumption, decisionConsumption, goalConsumption, relationshipConsumption,
      );
      const wired = new ConversationOrchestratorService(
        repository, contextBuilder, safetyGate, behavioralPolicy, himSelector, himSnapshot, himBridge,
        himConsumptionPolicy, himAdaptation, himContextualCurrent, himReflectionConsumption, aggregation, himBrainContext,
        foregroundGatherer, recommendationGrounding, router, correlation, telemetry,
      );
      return { wired, crossContextRepository, situationRepository, decisionRepository, goalRepository, relationshipRepository, situationDirectRead, decisionDirectRead, goalDirectRead, relationshipDirectRead };
    };

    it('never invokes the direct QHIA-007, QHIA-008, QHIA-010 or QHIA-011 read(...) methods, and issues exactly one aggregate transport request', async () => {
      const wiring = realAggregateOrchestrator();
      const canonicalClaim = { ...claimed, session_id: CANONICAL_SESSION };
      himSelector.select.mockReturnValue({
        contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
        sourceTurnId: canonicalClaim.id, contextKind: 'CONVERSATION_SESSION', contextId: CANONICAL_SESSION,
        selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
      });
      repository.claimTurn.mockResolvedValue(canonicalClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await wiring.wired.orchestrate('token', CANONICAL_USER, { ...userTurn, session_id: CANONICAL_SESSION });
      // Exactly one external cross-context foreground request for the turn.
      expect(wiring.crossContextRepository.readSessionCrossContextForeground).toHaveBeenCalledTimes(1);
      expect(wiring.crossContextRepository.readSessionCrossContextForeground).toHaveBeenCalledWith('token', CANONICAL_USER, CANONICAL_SESSION);
      // The old direct entry points are reachable and untouched: no direct
      // read, no direct request, no fallback, and no race.
      expect(wiring.situationDirectRead).not.toHaveBeenCalled();
      expect(wiring.decisionDirectRead).not.toHaveBeenCalled();
      expect(wiring.goalDirectRead).not.toHaveBeenCalled();
      expect(wiring.relationshipDirectRead).not.toHaveBeenCalled();
      expect(wiring.situationRepository.readSessionSituationStress).not.toHaveBeenCalled();
      expect(wiring.decisionRepository.readSessionDecisionAttention).not.toHaveBeenCalled();
      expect(wiring.goalRepository.readSessionGoalMotivation).not.toHaveBeenCalled();
      expect(wiring.relationshipRepository.readSessionRelationshipCommunication).not.toHaveBeenCalled();
      // Provider dispatch happens at most once, with the deterministic
      // unbound answer decoded by the four existing semantic consumers.
      expect(router.generate).toHaveBeenCalledTimes(1);
      expectDispatchedHumanIntelligence();
    });

    it('keeps the direct QHIA-007, QHIA-008, QHIA-010 and QHIA-011 boundaries independently callable and correct after the refactor', async () => {
      const wiring = realAggregateOrchestrator();
      wiring.situationDirectRead.mockRestore();
      wiring.decisionDirectRead.mockRestore();
      wiring.goalDirectRead.mockRestore();
      wiring.relationshipDirectRead.mockRestore();
      const situationConsumption = new HimSituationStressConsumptionService(wiring.situationRepository as never);
      const decisionConsumption = new HimDecisionAttentionConsumptionService(wiring.decisionRepository as never);
      const goalConsumption = new HimGoalMotivationConsumptionService(wiring.goalRepository as never);
      const relationshipConsumption = new HimRelationshipCommunicationConsumptionService(wiring.relationshipRepository as never);
      // Called directly - outside any orchestrator - the retired-from-the-turn
      // authorities still answer exactly as they did before the aggregate.
      await expect(situationConsumption.read(CANONICAL_USER, 'token', CANONICAL_SESSION)).resolves.toEqual(noneSituationStressGuidance);
      await expect(decisionConsumption.read(CANONICAL_USER, 'token', CANONICAL_SESSION)).resolves.toEqual(noneDecisionAttentionGuidance);
      await expect(goalConsumption.read(CANONICAL_USER, 'token', CANONICAL_SESSION)).resolves.toEqual(noneGoalMotivationGuidance);
      await expect(relationshipConsumption.read(CANONICAL_USER, 'token', CANONICAL_SESSION)).resolves.toEqual(noneRelationshipCommunicationGuidance);
      expect(wiring.situationRepository.readSessionSituationStress).toHaveBeenCalledTimes(1);
      expect(wiring.decisionRepository.readSessionDecisionAttention).toHaveBeenCalledTimes(1);
      expect(wiring.goalRepository.readSessionGoalMotivation).toHaveBeenCalledTimes(1);
      expect(wiring.relationshipRepository.readSessionRelationshipCommunication).toHaveBeenCalledTimes(1);
    });
  });

  it('performs zero HIM calls for the COMPLETED early-return path', async () => {
    repository.findTurn.mockResolvedValue(completedUser);
    repository.findAssistantForSource.mockResolvedValue(assistant);
    await orchestrator.orchestrate('token', 'user', completedUser);
    expect(himSelector.select).not.toHaveBeenCalled();
    expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
    expect(himBridge.transform).not.toHaveBeenCalled();
    expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
    expect(himAdaptation.derive).not.toHaveBeenCalled();
    expect(himContextualCurrent.getCurrentSelection).not.toHaveBeenCalled();
    expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
    expect(hypothesisContext.build).not.toHaveBeenCalled();
    expect(recommendationGrounding.ground).not.toHaveBeenCalled();
    expect(hypothesisEligibility.evaluateWithContext).not.toHaveBeenCalled();
    expect(hypothesisExtraction.extract).not.toHaveBeenCalled();
  });

  it('passes AVAILABLE hypothesis data as an independent channel for ALLOW and calls the router once', async () => {
    // QIR-003 Fix 01: the AVAILABLE fixture is a genuinely canonical envelope
    // (one included hypothesis, consistent counts) - the gatherer boundary now
    // fails closed on a malformed one instead of forwarding it.
    const context = { contractVersion: 1 as const, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT' as const, coverageState: 'AVAILABLE' as const, candidateHypothesisCount: 1, includedHypothesisCount: 1, truncated: false, hypotheses: [{ statement: 'statement', type: 'CAUSAL' as const, domain: 'GENERAL' as const, scope: 'session', origin: 'USER_PROPOSED' as const, status: 'ACTIVE' as const, hypothesisVersion: 1, currentlyEligibleSupportingEvidenceCount: 0, currentlyEligibleContradictingEvidenceCount: 0, assumptions: [], disconfirmingConditions: [], confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION' as const, targetVersion: 1 } }] };
    hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context });
    repository.claimTurn.mockResolvedValue(claimed); repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(hypothesisContext.build).toHaveBeenCalledWith('user', 'token'); expect(router.generate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ hypothesisContext: context }));
    expect(router.generate.mock.calls[0][0]).not.toHaveProperty('memoryContext');
    expect(router.generate.mock.calls[0][0].context).toEqual([{ role: 'USER', content: 'hello' }]);
  });

  it('omits the channel for EMPTY and fails closed before routing on query or invariant failure', async () => {
    repository.claimTurn.mockResolvedValue(claimed); repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn); expect(router.generate.mock.calls[0][0]).not.toHaveProperty('hypothesisContext');
    router.generate.mockClear(); hypothesisContext.build.mockRejectedValue(new Error('private query failure'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled(); expect(repository.failTurn).toHaveBeenCalled();
  });

  describe('Recommendation grounding bridge', () => {
    const availableHypothesisContext = {
      contractVersion: 1 as const, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT' as const,
      coverageState: 'AVAILABLE' as const, candidateHypothesisCount: 2, includedHypothesisCount: 1, truncated: true,
      hypotheses: [{
        statement: 'statement', type: 'CAUSAL' as const, domain: 'GENERAL' as const, scope: 'session',
        origin: 'USER_PROPOSED' as const, status: 'ACTIVE' as const, hypothesisVersion: 2,
        currentlyEligibleSupportingEvidenceCount: 1, currentlyEligibleContradictingEvidenceCount: 1,
        assumptions: ['private assumption text'], disconfirmingConditions: [],
        confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION' as const, targetVersion: 2 },
      }],
    };
    const groundedContext: RecommendationGroundingContext = {
      contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', sourceContractVersion: 1,
      currentVersionConfidenceCoverage: 'NONE', actionableMissingInformationCodes: [],
      unverifiedAssumptionsPresent: true, contradictingEvidencePresent: true, sourceTruncated: true,
    };

    it('transforms EMPTY reasoning exactly once and omits recommendationContext from the single router call', async () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(recommendationGrounding.ground).toHaveBeenCalledWith({ coverageState: 'EMPTY', candidateHypothesisCount: 0 });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('recommendationContext');
    });

    it('transforms AVAILABLE reasoning exactly once and passes the minimized context without touching other channels', async () => {
      hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      recommendationGrounding.ground.mockReturnValue({ coverageState: 'AVAILABLE', context: groundedContext });
      memoryRetriever.retrieve.mockResolvedValue([{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }] as never);
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(recommendationGrounding.ground).toHaveBeenCalledWith({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      expect(router.generate).toHaveBeenCalledTimes(1);
      const request = router.generate.mock.calls[0][0];
      expect(request.recommendationContext).toBe(groundedContext);
      expect(request.hypothesisContext).toBe(availableHypothesisContext);
      expect(request.humanIntelligence?.sessionReasoningContext).toEqual(providerSessionReasoningContext());
      expect(request.memoryContext).toEqual([{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }]);
      expect(request.context).toEqual([{ role: 'USER', content: 'hello' }]);
      expect(request.recommendationContext).not.toBe(request.hypothesisContext);
    });

    it('keeps the minimized context free of IDs, statements, and numeric authority fields', async () => {
      hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      recommendationGrounding.ground.mockReturnValue({ coverageState: 'AVAILABLE', context: groundedContext });
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      const serialized = JSON.stringify(router.generate.mock.calls[0][0].recommendationContext);
      expect(serialized).not.toMatch(/user-turn|session|statement|private assumption|memory:|evaluation|score|band|rank|risk|reversibility|readiness|Count/u);
    });

    it('fails closed before the provider call when grounding rejects an impossible source shape', async () => {
      hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      recommendationGrounding.ground.mockImplementation(() => { throw new RecommendationGroundingInvariantError(); });
      repository.claimTurn.mockResolvedValue(claimed);
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(router.generate).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
    });

    it('applies identical grounding semantics on DEEP without changing routing or provider count', async () => {
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      recommendationGrounding.ground.mockReturnValue({ coverageState: 'AVAILABLE', context: groundedContext });
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({
        path: 'DEEP', complexity: 'HIGH', latencyBudgetMs: 10000, recommendationContext: groundedContext,
      }));
    });
  });

  describe('foreground GENERATING turn recovery (bounded fail-closed replay)', () => {
    const failedUser: ConversationTurn = { ...claimed, status: 'FAILED' };

    const expectZeroDownstreamWork = () => {
      expect(repository.claimTurn).not.toHaveBeenCalled();
      expect(contextBuilder.build).not.toHaveBeenCalled();
      expect(safetyGate.evaluate).not.toHaveBeenCalled();
      expect(himSelector.select).not.toHaveBeenCalled();
      expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
      expect(himBridge.transform).not.toHaveBeenCalled();
      expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
      expect(himAdaptation.derive).not.toHaveBeenCalled();
      expect(himContextualCurrent.getCurrentSelection).not.toHaveBeenCalled();
      expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
      expect(memoryRetriever.retrieve).not.toHaveBeenCalled();
      expect(hypothesisContext.build).not.toHaveBeenCalled();
      expect(recommendationGrounding.ground).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
      expect(behavioralPolicy.buildTextGuidance).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(repository.failTurn).not.toHaveBeenCalled();
    };

    it('checks recovery exactly once for a live GENERATING replay and returns the in-progress canonical state', async () => {
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(undefined);
      repository.findTurn.mockResolvedValue(claimed);
      repository.findAssistantForSource.mockResolvedValue(undefined);

      await expect(orchestrator.orchestrate('token', 'user', claimed)).resolves.toEqual({ userTurn: claimed });
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledTimes(1);
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      expectZeroDownstreamWork();
    });

    it('returns the recovered FAILED user turn with no assistant for an expired GENERATING replay', async () => {
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(failedUser);
      repository.findTurn.mockResolvedValue(failedUser);
      repository.findAssistantForSource.mockResolvedValue(undefined);

      const result = await orchestrator.orchestrate('token', 'user', claimed);
      expect(result).toEqual({ userTurn: failedUser });
      expect(result).not.toHaveProperty('assistantTurn');
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledTimes(1);
      expectZeroDownstreamWork();
    });

    it('runs the same bounded recovery check when a stale RECEIVED object loses the claim to a live winner', async () => {
      repository.claimTurn.mockResolvedValue(undefined);
      repository.findTurn.mockResolvedValue(claimed);
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(undefined);
      repository.findAssistantForSource.mockResolvedValue(undefined);

      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: claimed });
      expect(repository.claimTurn).toHaveBeenCalledTimes(1);
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledTimes(1);
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      // The claim loser never starts a second provider call or any engine work.
      expect(router.generate).not.toHaveBeenCalled();
      expect(contextBuilder.build).not.toHaveBeenCalled();
      expect(safetyGate.evaluate).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
    });

    it('returns the recovered FAILED state when the claim-lost winner is already expired', async () => {
      repository.claimTurn.mockResolvedValue(undefined);
      repository.findTurn.mockResolvedValueOnce(claimed).mockResolvedValue(failedUser);
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(failedUser);
      repository.findAssistantForSource.mockResolvedValue(undefined);

      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: failedUser });
      expect(repository.recoverExpiredGeneratingTurn).toHaveBeenCalledTimes(1);
      expect(router.generate).not.toHaveBeenCalled();
    });

    it.each(['FAILED', 'CANCELLED', 'SUPERSEDED'] as const)('never replays generation or recovery for a terminal %s turn', async (status) => {
      const terminal: ConversationTurn = { ...claimed, status };
      repository.claimTurn.mockResolvedValue(undefined);
      repository.findTurn.mockResolvedValue(terminal);
      repository.findAssistantForSource.mockResolvedValue(undefined);

      await expect(orchestrator.orchestrate('token', 'user', terminal)).resolves.toEqual({ userTurn: terminal });
      expect(repository.recoverExpiredGeneratingTurn).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
    });

    it('performs no recovery call for the COMPLETED replay path', async () => {
      repository.findTurn.mockResolvedValue(completedUser);
      repository.findAssistantForSource.mockResolvedValue(assistant);
      await expect(orchestrator.orchestrate('token', 'user', completedUser)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(repository.recoverExpiredGeneratingTurn).not.toHaveBeenCalled();
      expect(repository.claimTurn).not.toHaveBeenCalled();
    });

    it('keeps the normal freshly claimed RECEIVED success at exactly one provider call with zero recovery calls', async () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.recoverExpiredGeneratingTurn).not.toHaveBeenCalled();
      expect(repository.findTurn).not.toHaveBeenCalled();
    });
  });

  // QHIA-012: the zero-incremental-wait acceptance criterion, proven with
  // CONTROLLED DEFERRED PROMISES rather than sleeps or wall-clock races. Every
  // case below decides the ordering explicitly, so none of them can pass or fail
  // because a real timer happened to win.
  describe('QHIA-012 Brain Context bridge (zero incremental foreground wait)', () => {
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };
    const brainContext = (): HimBrainContext => ({
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1',
      availability: 'AVAILABLE',
      signals: [
        { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
        { slot: 'GOAL_PURPOSE_ALIGNMENT', numericValue: 4, semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
      ],
    });

    it('reads Brain Context exactly ONCE per eligible turn, for the authoritative claimed session and the exact current USER turn', async () => {
      const serverClaim = { ...claimed, id: 'claimed-turn', session_id: 'claimed-session' };
      himSelector.select.mockReturnValue({
        contractVersion: 1, selectionState: 'SELECTED', source: 'AUTHORITATIVE_CONVERSATION_TURN',
        sourceTurnId: serverClaim.id, contextKind: 'CONVERSATION_SESSION', contextId: serverClaim.session_id,
        selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
      });
      repository.claimTurn.mockResolvedValue(serverClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...serverClaim, status: 'COMPLETED' }, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himBrainContext.read).toHaveBeenCalledTimes(1);
      // The session identity is the AUTHORITATIVE claimed one, never the
      // client-supplied turn's, and the current-turn identity is the exact
      // claimed turn.
      expect(himBrainContext.read).toHaveBeenCalledWith('user', 'token', 'claimed-session', 'claimed-turn');
    });

    // Case A - Brain resolves BEFORE the existing barrier: the provider receives
    // the exact context.
    it('A: a Brain Context read that settles before the existing barrier reaches the single provider request', async () => {
      const settled = brainContext();
      let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
      himSnapshot.getSnapshot.mockReturnValue(new Promise<HimIntelligenceSnapshot>((resolve) => { releaseSnapshot = resolve; }));
      let releaseBrain!: (value: HimBrainContext) => void;
      himBrainContext.read.mockReturnValue(new Promise((resolve) => { releaseBrain = resolve; }));
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      // The Brain read wins first while the existing awaited dependency is still
      // deliberately held open.
      releaseBrain(settled);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(router.generate).not.toHaveBeenCalled();
      releaseSnapshot(snapshot);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatchedHumanIntelligence()!.brainContext).toEqual(settled);
    });

    // Case B - Brain is STILL PENDING when the barrier closes: the provider
    // starts without it and the foreground never waits.
    it('B: a still-pending Brain Context read never delays provider dispatch and is discarded when it settles late', async () => {
      jest.useFakeTimers();
      try {
        let releaseBrain!: (value: HimBrainContext) => void;
        himBrainContext.read.mockReturnValue(new Promise((resolve) => { releaseBrain = resolve; }));
        finalizeNormally();
        // The turn completes with NO timer advance at all, so no additional wait
        // of any duration was introduced for Brain Context.
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(dispatchedHumanIntelligence()?.brainContext).toBeUndefined();
        // The pre-existing QHIA-005 Reflection budget remains the ONLY foreground
        // timer, and it was cleared by its own fast resolution: QHIA-012 adds no
        // timeout, no sleep and no new barrier.
        expect(jest.getTimerCount()).toBe(0);
        const dispatchedSnapshot = JSON.stringify(router.generate.mock.calls[0][0]);
        releaseBrain(brainContext());
        await jest.advanceTimersByTimeAsync(0);
        // A late result is discarded for this turn: no second provider call, no
        // mutation of the in-flight request, no second finalization.
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(router.generate.mock.calls[0][0])).toBe(dispatchedSnapshot);
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('B2: dispatch still happens at the EXISTING 300 ms Reflection barrier while Brain Context stays pending forever', async () => {
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise(() => undefined));
        himBrainContext.read.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(299);
        expect(router.generate).not.toHaveBeenCalled();
        // Crossing the pre-existing budget releases the foreground, and the
        // still-pending Brain Context read adds not one millisecond.
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(dispatchedHumanIntelligence()?.brainContext).toBeUndefined();
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });

    // Case C - Brain REJECTS: the response continues normally.
    it('C: a rejected Brain Context read omits the field, fails no turn, and triggers no fallback request', async () => {
      himBrainContext.read.mockRejectedValue(new Error('brain context transport failure'));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatchedHumanIntelligence()?.brainContext).toBeUndefined();
      expect(himBrainContext.read).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    });

    it('C2: absorbs a LATE rejection after dispatch with no unhandled rejection and no second dispatch', async () => {
      jest.useFakeTimers();
      try {
        let rejectBrain!: (error: Error) => void;
        himBrainContext.read.mockReturnValue(new Promise((_resolve, reject) => { rejectBrain = reject; }));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        const dispatchedSnapshot = JSON.stringify(router.generate.mock.calls[0][0]);
        rejectBrain(new Error('late brain context transport failure'));
        await jest.advanceTimersByTimeAsync(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(router.generate.mock.calls[0][0])).toBe(dispatchedSnapshot);
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    // Case D - an EMPTY / fully binding-invalid materialization: no provider
    // field at all, rather than an empty block sent to prove the feature ran.
    it('D: an empty or fully binding-invalid materialization omits the provider field entirely', async () => {
      himBrainContext.read.mockResolvedValue(undefined);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatchedHumanIntelligence()?.brainContext).toBeUndefined();
    });

    it('never carries a late Brain Context into the NEXT turn: the second turn reads again and gets its own answer', async () => {
      jest.useFakeTimers();
      try {
        let releaseFirst!: (value: HimBrainContext) => void;
        himBrainContext.read.mockReturnValueOnce(new Promise((resolve) => { releaseFirst = resolve; }));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(dispatchedHumanIntelligence()?.brainContext).toBeUndefined();
        releaseFirst(brainContext());
        await jest.advanceTimersByTimeAsync(0);
        himBrainContext.read.mockResolvedValue(undefined);
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(himBrainContext.read).toHaveBeenCalledTimes(2);
        expect(router.generate).toHaveBeenCalledTimes(2);
        expect(dispatchedHumanIntelligence(1)?.brainContext).toBeUndefined();
      } finally { jest.useRealTimers(); }
    });

    it('keeps Brain Context a SEPARATE advisory channel and renders it through the one shared composition', async () => {
      const settled = brainContext();
      himBrainContext.read.mockResolvedValue(settled);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const dispatched = router.generate.mock.calls[0][0] as ModelRouterRequest;
      // A defensive provider-facing COPY, never a mutable alias of the runtime
      // object, and still its own separate lane inside the one envelope.
      expect(dispatched.humanIntelligence!.brainContext).toEqual(settled);
      expect(dispatched.humanIntelligence!.brainContext as unknown).not.toBe(settled as unknown);
      // It is never merged into any existing HIM guidance field.
      expect(dispatched.humanIntelligence!.sessionReasoningContext).not.toHaveProperty('signals');
      expect(dispatched.humanIntelligence!.brainContext).not.toHaveProperty('metrics');
      expect(dispatched.humanIntelligence!.behavioralInstructionIds).toEqual([]);
      expectNoLegacyHumanIntelligenceFields();
      const rendered = composeServerGuidance(dispatched);
      expect(composeServerGuidance(dispatched)).toBe(rendered);
      expect(rendered).toContain('<him_brain_context>');
      expect(rendered).toContain('DECISION_SELF_CONFIDENCE');
      // Nothing that could identify a context, a turn, a metric, or a moment in
      // time reaches the provider through this channel.
      const block = rendered.slice(rendered.indexOf('Human Intelligence Brain Context follows'));
      for (const forbidden of ['contextId', 'context_id', 'sourceTurnId', 'slotOrder', 'hse.self-confidence', 'hgs.purpose-alignment', 'observedAt', 'canonicalBindingId', 'activeBindingId']) {
        expect(block).not.toContain(forbidden);
      }
    });

    it('performs no Brain Context read at all when Safety BLOCKs the turn', async () => {
      safetyGate.evaluate.mockReturnValue({ category: 'SELF_HARM_OR_SUICIDE', disposition: 'BLOCK', deterministicResponse: 'safe deterministic response' });
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himBrainContext.read).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
    });

    it('gives FAST and DEEP identical Brain Context and never participates in path selection', async () => {
      const settled = brainContext();
      himBrainContext.read.mockResolvedValue(settled);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(dispatchedRequest(0).path).toBe('FAST');
      expect(dispatchedRequest(1).path).toBe('DEEP');
      expect(dispatchedHumanIntelligence(0)!.brainContext).toEqual(settled);
      expect(dispatchedHumanIntelligence(1)!.brainContext).toEqual(settled);
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' });
    });

    it('records the Brain Context outcome inside its own him_brain_context engine span', async () => {
      const withEngine = jest.spyOn(telemetry, 'withEngine');
      himBrainContext.read.mockRejectedValue(new Error('brain context transport failure'));
      finalizeNormally();
      await expect(correlation.runRequest(() => orchestrator.orchestrate('token', 'user', userTurn)))
        .resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      const engineResults = withEngine.mock.calls
        .map((call, index) => ({ engine: call[0], result: withEngine.mock.results[index] }))
        .filter(({ engine }) => engine === 'him_brain_context');
      expect(engineResults).toHaveLength(1);
      await expect(engineResults[0].result.value).rejects.toThrow('brain context transport failure');
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
    });

    it('adds no Memory, Hypothesis, Recommendation, or provider work beyond the one advisory channel', async () => {
      himBrainContext.read.mockResolvedValue(brainContext());
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
      expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
      expect(himCrossContextForeground.read).toHaveBeenCalledTimes(1);
      expect(hypothesisGeneration.generate).not.toHaveBeenCalled();
      expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    });
  });

  describe('QHIA-013 Human Intelligence provider boundary consolidation', () => {
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };

    it('sends exactly ONE Human Intelligence envelope and none of the eight legacy fields', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      himCrossContextForeground.read.mockResolvedValue(
        crossContextGuidance(activeSituationStressGuidance, noneDecisionAttentionGuidance, activeGoalMotivationGuidance, noneRelationshipCommunicationGuidance),
      );
      himBrainContext.read.mockResolvedValue({
        contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
        signals: [{ slot: 'GOAL_CONSISTENCY', numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' }],
      } as HimBrainContext);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledTimes(1);
      const request = dispatchedRequest();
      // Exactly one Human Intelligence key on the whole provider request.
      expect(Object.keys(request).filter((key) => /^him|^humanIntelligence$/u.test(key))).toEqual(['humanIntelligence']);
      expectNoLegacyHumanIntelligenceFields();
      // The envelope is exactly what the pure compiler produces for the upstream
      // values this turn really obtained - no more, no less.
      expectDispatchedHumanIntelligence({
        himInteractionAdaptation: activeAdaptation,
        himSituationStressGuidance: activeSituationStressGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
        himBrainContext: await himBrainContext.read.mock.results[0]!.value,
      });
    });

    it('renders one universal charter, one behavioral block, and no duplicate instruction', () => {
      // Rendering is proven on the REAL composed guidance for the dispatched
      // request, not on a hand-built fixture.
      const envelope = expectedEnvelope({
        himInteractionAdaptation: activeAdaptation,
        himSituationStressGuidance: activeSituationStressGuidance,
        himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
        himGoalMotivationGuidance: activeGoalMotivationGuidance,
      })!;
      const rendered = composeServerGuidance({ behavioralGuidance: 'behavior', humanIntelligence: envelope });
      expect(rendered.split('Human Intelligence below is server-owned support')).toHaveLength(2);
      expect(rendered.split('The following Human Intelligence behavioral instructions')).toHaveLength(2);
      const bullets = rendered.split('\n').filter((line) => line.startsWith('- '));
      expect(new Set(bullets).size).toBe(bullets.length);
      for (const retired of [
        'HIM interaction adaptation', 'Session Reflection guidance', 'Situation-bound interaction guidance',
        'Decision-bound presentation guidance', 'Goal-bound action-pacing guidance',
        'Relationship-bound communication scaffolding guidance',
      ]) expect(rendered).not.toContain(retired);
    });

    it('adds ZERO incremental foreground wait: the compilation introduces no timer, await, or barrier', async () => {
      jest.useFakeTimers();
      try {
        // Both optional no-wait reads stay pending forever. The turn still
        // completes on the pre-existing 300 ms Reflection budget alone, and the
        // envelope is still built and dispatched synchronously after it.
        himContextualCurrent.getCurrentSelection.mockReturnValue(new Promise(() => undefined));
        himCrossContextForeground.read.mockReturnValue(new Promise(() => undefined));
        himBrainContext.read.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(299);
        expect(router.generate).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        // No new timer of any duration was created by the consolidation.
        expect(jest.getTimerCount()).toBe(0);
        // The envelope still exists - the session reasoning lane never depends on
        // an optional read - and carries neither pending lane.
        expectDispatchedHumanIntelligence();
        expect(dispatchedHumanIntelligence()!.sessionReasoningContext).toBeDefined();
        expect(dispatchedHumanIntelligence()!.brainContext).toBeUndefined();
        expect(dispatchedHumanIntelligence()!.behavioralInstructionIds).toEqual([]);
      } finally { jest.useRealTimers(); }
    });

    it('discards a late Brain resolution: the compiled envelope is never mutated after dispatch', async () => {
      jest.useFakeTimers();
      try {
        let releaseBrain!: (value: HimBrainContext) => void;
        himBrainContext.read.mockReturnValue(new Promise((resolve) => { releaseBrain = resolve; }));
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        const dispatchedSnapshot = JSON.stringify(dispatchedRequest());
        releaseBrain({
          contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
          signals: [{ slot: 'GOAL_CONSISTENCY', numericValue: 5, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' }],
        } as HimBrainContext);
        await jest.advanceTimersByTimeAsync(0);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(dispatchedRequest())).toBe(dispatchedSnapshot);
        expect(dispatchedHumanIntelligence()!.brainContext).toBeUndefined();
      } finally { jest.useRealTimers(); }
    });

    it('degrades a rejected optional read normally and still dispatches one envelope, one provider request', async () => {
      himContextualCurrent.getCurrentSelection.mockRejectedValue(new Error('private data api failure'));
      himCrossContextForeground.read.mockRejectedValue(new Error('aggregate transport failure'));
      himBrainContext.read.mockRejectedValue(new Error('brain context transport failure'));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expectDispatchedHumanIntelligence();
    });
  });

  // QHIA-014A: the HSE Snapshot is no longer raw-awaited. It is bounded by the
  // SAME 300 ms shared Human Intelligence foreground budget as Reflection, and
  // a transport that could not answer degrades to OMISSION while an authority,
  // integrity or unexpected failure still fails the turn closed.
  //
  // Everything here is proven with controlled promises and fake timers. No test
  // in this block sleeps, and none proves a bound by wall clock.
  describe('QHIA-014A HSE Snapshot foreground latency-safe degradation', () => {
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };
    const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
    const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
    const finalizeDeepNormally = () => {
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
    };
    const deepResult = { userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } };
    // The envelope a turn compiles when the Snapshot lane is ABSENT: the SAME
    // pure QHIA-013 compiler, given no session reasoning and no QHIA-001
    // adaptation, plus exactly the independent channels that really survived.
    const envelopeWithoutSnapshot = (
      channels: Parameters<typeof buildHumanIntelligenceProviderSemantics>[0] = {},
    ) => buildHumanIntelligenceProviderSemantics({ ...channels });
    // UNAVAILABLE is OMISSION, never a measurement answer: nothing downstream of
    // the Snapshot ran at all, so no EMPTY snapshot, no UNKNOWN metric, no
    // placeholder ordinal category and no fabricated generatedAt can exist.
    const expectSnapshotLaneOmitted = (call = 0): void => {
      expect(himBridge.transform).not.toHaveBeenCalled();
      expect(himAdaptation.derive).not.toHaveBeenCalled();
      expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
      expect(dispatchedHumanIntelligence(call)?.sessionReasoningContext).toBeUndefined();
      expectNoLegacyHumanIntelligenceFields(call);
    };
    const transportUnavailable = () => new ServiceUnavailableException('Human Intelligence Snapshot is unavailable.');
    const pendingForever = <T>() => new Promise<T>(() => undefined);

    describe('19.1 - a Snapshot that wins the budget is consumed exactly as before', () => {
      it('consumes an immediate Snapshot normally with one provider call and one of every HIM request', async () => {
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
        expect(himBridge.transform).toHaveBeenCalledWith(snapshot);
        expect(himAdaptation.derive).toHaveBeenCalledWith(himReasoningContext);
        expect(himConsumptionPolicy.project).toHaveBeenCalledWith('FAST', himReasoningContext);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expectDispatchedHumanIntelligence();
        expect(dispatchedHumanIntelligence()!.sessionReasoningContext).toEqual(providerSessionReasoningContext());
      });

      it('lets a 299 ms Snapshot win the shared budget, deliver its session reasoning, and clear its timer', async () => {
        jest.useFakeTimers();
        try {
          let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
          himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
          finalizeNormally();
          const pending = orchestrator.orchestrate('token', 'user', userTurn);
          await jest.advanceTimersByTimeAsync(299);
          // One tick before the budget the foreground is still correctly waiting.
          expect(router.generate).not.toHaveBeenCalled();
          releaseSnapshot(snapshot);
          await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          expect(himBridge.transform).toHaveBeenCalledWith(snapshot);
          expectDispatchedHumanIntelligence();
          expect(dispatchedHumanIntelligence()!.sessionReasoningContext).toBeDefined();
          // Both bounded budget timers were cleared on their own settlement.
          expect(jest.getTimerCount()).toBe(0);
        } finally { jest.useRealTimers(); }
      });
    });

    describe('19.2 - the Snapshot can never hold the foreground past the shared 300 ms boundary', () => {
      it('dispatches at the 300 ms boundary for a Snapshot that is still pending, omitting the Snapshot lane', async () => {
        jest.useFakeTimers();
        try {
          himSnapshot.getSnapshot.mockReturnValue(pendingForever<HimIntelligenceSnapshot>());
          finalizeNormally();
          const pending = orchestrator.orchestrate('token', 'user', userTurn);
          await jest.advanceTimersByTimeAsync(299);
          expect(router.generate).not.toHaveBeenCalled();
          await jest.advanceTimersByTimeAsync(1);
          await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          expect(router.generate).toHaveBeenCalledTimes(1);
          expectSnapshotLaneOmitted();
          // Every other channel is bounded NONE here, so the compiler correctly
          // emits nothing at all rather than an empty envelope.
          expect(dispatchedRequest()).not.toHaveProperty('humanIntelligence');
          expect(repository.failTurn).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        } finally { jest.useRealTimers(); }
      });

      it.each([301, 1000, 5000])('never waits for a %s ms Snapshot: it dispatches at 300 ms and discards the late success', async (settleAt) => {
        jest.useFakeTimers();
        try {
          let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
          himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
          finalizeNormally();
          const pending = orchestrator.orchestrate('token', 'user', userTurn);
          await jest.advanceTimersByTimeAsync(300);
          await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          expect(router.generate).toHaveBeenCalledTimes(1);
          const dispatched = JSON.stringify(dispatchedRequest());
          expectSnapshotLaneOmitted();
          // The read finally answers well after the boundary. It is discarded
          // for good: no consumption, no envelope mutation, no second dispatch,
          // no second finalization, and nothing kept for any later turn.
          await jest.advanceTimersByTimeAsync(settleAt - 300);
          releaseSnapshot(snapshot);
          await jest.advanceTimersByTimeAsync(0);
          expect(himBridge.transform).not.toHaveBeenCalled();
          expect(himAdaptation.derive).not.toHaveBeenCalled();
          expect(router.generate).toHaveBeenCalledTimes(1);
          expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
          expect(JSON.stringify(dispatchedRequest())).toBe(dispatched);
        } finally { jest.useRealTimers(); }
      });

      it('absorbs a late Snapshot rejection after the boundary with no unhandled rejection and no behavioral effect', async () => {
        jest.useFakeTimers();
        try {
          let rejectSnapshot!: (error: Error) => void;
          himSnapshot.getSnapshot.mockReturnValue(new Promise((_resolve, reject) => { rejectSnapshot = reject; }));
          finalizeNormally();
          const pending = orchestrator.orchestrate('token', 'user', userTurn);
          await jest.advanceTimersByTimeAsync(300);
          await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          // Even an AUTHORITY-class late rejection is inert once the boundary
          // has passed: the turn is already finalized and cannot be failed.
          rejectSnapshot(new Error('INTEGRITY_FAILURE'));
          await jest.advanceTimersByTimeAsync(0);
          expect(router.generate).toHaveBeenCalledTimes(1);
          expect(repository.failTurn).not.toHaveBeenCalled();
          expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
        } finally { jest.useRealTimers(); }
      });
    });

    describe('19.3 - a transport that could not answer degrades immediately', () => {
      it('omits the Snapshot on a ServiceUnavailableException without spending any of the 300 ms budget', async () => {
        jest.useFakeTimers();
        try {
          himSnapshot.getSnapshot.mockRejectedValue(transportUnavailable());
          finalizeNormally();
          // No timer advance at all: the turn completes on the immediate
          // classified transport answer.
          await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          expect(router.generate).toHaveBeenCalledTimes(1);
          expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
          expectSnapshotLaneOmitted();
          expect(repository.failTurn).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        } finally { jest.useRealTimers(); }
      });
    });

    describe('19.5 / 19.6 - authority, integrity and unknown failures stay fail-closed', () => {
      it.each([
        'UNSUPPORTED_CONTEXT', 'INVALID_OR_UNOWNED_CONTEXT', 'INTEGRITY_FAILURE', 'unrecognized upstream database failure',
      ] as const)('fails the turn closed with no provider call when the Snapshot read rejects with %s', async (message) => {
        repository.claimTurn.mockResolvedValue(claimed);
        himSnapshot.getSnapshot.mockRejectedValue(new Error(message));
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(router.generate).not.toHaveBeenCalled();
        expect(repository.finalizeTurn).not.toHaveBeenCalled();
        expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      });

      it.each(['transform', 'derive', 'project'] as const)('keeps the HIM %s integrity boundary fail-closed on an AVAILABLE Snapshot', async (stage) => {
        repository.claimTurn.mockResolvedValue(claimed);
        if (stage === 'transform') himBridge.transform.mockImplementation(() => { throw new Error('INTEGRITY_FAILURE'); });
        if (stage === 'derive') himAdaptation.derive.mockImplementation(() => { throw new Error('INTEGRITY_FAILURE'); });
        if (stage === 'project') himConsumptionPolicy.project.mockImplementation(() => { throw new Error('INTEGRITY_FAILURE'); });
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(router.generate).not.toHaveBeenCalled();
        expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      });
    });

    describe('19.7 - combined worst case', () => {
      it('dispatches at the 300 ms boundary - never 600 - with all four HIM reads pending forever', async () => {
        jest.useFakeTimers();
        try {
          himSnapshot.getSnapshot.mockReturnValue(pendingForever<HimIntelligenceSnapshot>());
          himContextualCurrent.getCurrentSelection.mockReturnValue(pendingForever<HimContextualCurrentSelection>());
          himCrossContextForeground.read.mockReturnValue(pendingForever<HimCrossContextForegroundGuidance>());
          himBrainContext.read.mockReturnValue(pendingForever<HimBrainContext>());
          finalizeNormally();
          const pending = orchestrator.orchestrate('token', 'user', userTurn);
          await jest.advanceTimersByTimeAsync(299);
          expect(router.generate).not.toHaveBeenCalled();
          await jest.advanceTimersByTimeAsync(1);
          await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
          // Dispatch happened at the 300 ms boundary: the Snapshot and Reflection
          // budgets are the SAME budget, joined concurrently, never summed.
          expect(router.generate).toHaveBeenCalledTimes(1);
          expectSnapshotLaneOmitted();
          expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
          expect(dispatchedRequest()).not.toHaveProperty('humanIntelligence');
          expect(jest.getTimerCount()).toBe(0);
          // Exactly one request per channel, and no retry, fallback, per-metric
          // read or second provider call after the boundary.
          expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
          expect(himContextualCurrent.getCurrentSelection).toHaveBeenCalledTimes(1);
          expect(himContextualCurrent.getCurrentIntelligence).not.toHaveBeenCalled();
          expect(himCrossContextForeground.read).toHaveBeenCalledTimes(1);
          expect(himBrainContext.read).toHaveBeenCalledTimes(1);
          await jest.advanceTimersByTimeAsync(10000);
          expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
          expect(router.generate).toHaveBeenCalledTimes(1);
          expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
        } finally { jest.useRealTimers(); }
      });
    });

    describe('19.8 - independent Human Intelligence channels survive Snapshot unavailability', () => {
      const degradedSnapshot = () => { himSnapshot.getSnapshot.mockRejectedValue(transportUnavailable()); };

      it('A - Session Reflection guidance still reaches the provider, with no session reasoning and no QHIA-001 adaptation', async () => {
        degradedSnapshot();
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
        himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(dispatchedHumanIntelligence()).toEqual(envelopeWithoutSnapshot({ himSessionReflectionGuidance: inviteReflectionGuidance }));
        expect(dispatchedInstructionIds()).toEqual(['GENTLE_REFLECTION_INVITATION']);
        expectSnapshotLaneOmitted();
      });

      it('B - aggregate-v3 behavioral instructions still reach the provider', async () => {
        degradedSnapshot();
        himCrossContextForeground.read.mockResolvedValue(
          crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance),
        );
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(dispatchedHumanIntelligence()).toEqual(envelopeWithoutSnapshot({
          himSituationStressGuidance: activeSituationStressGuidance,
          himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
          himGoalMotivationGuidance: activeGoalMotivationGuidance,
          himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
        }));
        expect(dispatchedInstructionIds().length).toBeGreaterThan(0);
        expectSnapshotLaneOmitted();
      });

      it('C - Brain Context still reaches the provider as its own separate data lane', async () => {
        degradedSnapshot();
        const brainContext = {
          contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
          signals: [{ slot: 'GOAL_CONSISTENCY', numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' }],
        } as HimBrainContext;
        himBrainContext.read.mockResolvedValue(brainContext);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(dispatchedHumanIntelligence()).toEqual(envelopeWithoutSnapshot({ himBrainContext: brainContext }));
        expect(dispatchedHumanIntelligence()!.brainContext).toBeDefined();
        expectSnapshotLaneOmitted();
      });

      it('D - all three independent channels survive together and none becomes a second adaptation authority', async () => {
        degradedSnapshot();
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(5));
        himReflectionConsumption.consume.mockReturnValue(avoidReflectionGuidance);
        himCrossContextForeground.read.mockResolvedValue(
          crossContextGuidance(activeSituationStressGuidance, activeDecisionAttentionGuidance, activeGoalMotivationGuidance, activeRelationshipCommunicationGuidance),
        );
        const brainContext = {
          contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE',
          signals: [{ slot: 'SITUATION_AVOIDANCE_FREQUENCY', numericValue: 4, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' }],
        } as HimBrainContext;
        himBrainContext.read.mockResolvedValue(brainContext);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(dispatchedHumanIntelligence()).toEqual(envelopeWithoutSnapshot({
          himSessionReflectionGuidance: avoidReflectionGuidance,
          himSituationStressGuidance: activeSituationStressGuidance,
          himDecisionAttentionGuidance: activeDecisionAttentionGuidance,
          himGoalMotivationGuidance: activeGoalMotivationGuidance,
          himRelationshipCommunicationGuidance: activeRelationshipCommunicationGuidance,
          himBrainContext: brainContext,
        }));
        // The QHIA-001 adaptation is derived from the Snapshot reasoning context
        // and from nothing else: no other channel, no previous turn, no Memory
        // and no provider inference may stand in for it.
        expectSnapshotLaneOmitted();
        expect(router.generate).toHaveBeenCalledTimes(1);
      });
    });

    describe('19.9 - FAST / DEEP parity', () => {
      it('gives DEEP the same 300 ms boundary and the same discarded late Snapshot', async () => {
        jest.useFakeTimers();
        try {
          let releaseSnapshot!: (value: HimIntelligenceSnapshot) => void;
          himSnapshot.getSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
          finalizeDeepNormally();
          const pending = orchestrator.orchestrate('token', 'user', deepTurn);
          await jest.advanceTimersByTimeAsync(299);
          expect(router.generate).not.toHaveBeenCalled();
          await jest.advanceTimersByTimeAsync(1);
          await expect(pending).resolves.toEqual(deepResult);
          expect(dispatchedRequest().path).toBe('DEEP');
          expect(router.generate).toHaveBeenCalledTimes(1);
          expectSnapshotLaneOmitted();
          await jest.advanceTimersByTimeAsync(1);
          releaseSnapshot(snapshot);
          await jest.advanceTimersByTimeAsync(0);
          expect(himBridge.transform).not.toHaveBeenCalled();
          expect(router.generate).toHaveBeenCalledTimes(1);
        } finally { jest.useRealTimers(); }
      });

      it('gives DEEP the same immediate transport degradation and the same surviving independent channels', async () => {
        himSnapshot.getSnapshot.mockRejectedValue(transportUnavailable());
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
        himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
        finalizeDeepNormally();
        await expect(orchestrator.orchestrate('token', 'user', deepTurn)).resolves.toEqual(deepResult);
        expect(dispatchedRequest().path).toBe('DEEP');
        expect(dispatchedHumanIntelligence()).toEqual(envelopeWithoutSnapshot({ himSessionReflectionGuidance: inviteReflectionGuidance }));
        expectSnapshotLaneOmitted();
      });

      it('gives DEEP the same combined worst case: one dispatch at the 300 ms boundary', async () => {
        jest.useFakeTimers();
        try {
          himSnapshot.getSnapshot.mockReturnValue(pendingForever<HimIntelligenceSnapshot>());
          himContextualCurrent.getCurrentSelection.mockReturnValue(pendingForever<HimContextualCurrentSelection>());
          himCrossContextForeground.read.mockReturnValue(pendingForever<HimCrossContextForegroundGuidance>());
          himBrainContext.read.mockReturnValue(pendingForever<HimBrainContext>());
          finalizeDeepNormally();
          const pending = orchestrator.orchestrate('token', 'user', deepTurn);
          await jest.advanceTimersByTimeAsync(299);
          expect(router.generate).not.toHaveBeenCalled();
          await jest.advanceTimersByTimeAsync(1);
          await expect(pending).resolves.toEqual(deepResult);
          expect(router.generate).toHaveBeenCalledTimes(1);
          expect(dispatchedRequest().path).toBe('DEEP');
          expect(dispatchedRequest()).not.toHaveProperty('humanIntelligence');
          expect(jest.getTimerCount()).toBe(0);
        } finally { jest.useRealTimers(); }
      });
    });

    describe('no fabricated, stale, or carried-over Snapshot', () => {
      it('never reuses a previous turn\'s Snapshot when the current turn\'s read is unavailable', async () => {
        // Turn #1 obtains a real canonical Snapshot and dispatches it.
        finalizeNormally();
        await orchestrator.orchestrate('token', 'user', userTurn);
        expect(dispatchedHumanIntelligence(0)!.sessionReasoningContext).toEqual(providerSessionReasoningContext());
        // Turn #2's own read is unavailable. Nothing from turn #1 is carried:
        // there is no cross-turn cache anywhere on this path.
        himSnapshot.getSnapshot.mockRejectedValue(transportUnavailable());
        await orchestrator.orchestrate('token', 'user', userTurn);
        expect(router.generate).toHaveBeenCalledTimes(2);
        expect(dispatchedRequest(1)).not.toHaveProperty('humanIntelligence');
        expect(dispatchedHumanIntelligence(1)).toBeUndefined();
        // Turn #2 performed its OWN read rather than reusing anything.
        expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(2);
        expect(himBridge.transform).toHaveBeenCalledTimes(1);
      });

      it('never fabricates an EMPTY Snapshot, UNKNOWN metrics, or a placeholder ordinal category on omission', async () => {
        himSnapshot.getSnapshot.mockRejectedValue(transportUnavailable());
        himCrossContextForeground.read.mockResolvedValue(
          crossContextGuidance(activeSituationStressGuidance, noneDecisionAttentionGuidance),
        );
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        // The envelope exists (an independent channel survived) but carries NO
        // session reasoning lane at all - not an empty one, not an unknown one.
        const envelope = dispatchedHumanIntelligence()!;
        expect(envelope.sessionReasoningContext).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(envelope, 'sessionReasoningContext')).toBe(false);
        expect(JSON.stringify(envelope)).not.toContain('coverageState');
        expect(JSON.stringify(envelope)).not.toContain('generatedAt');
        expect(JSON.stringify(envelope)).not.toContain('UNKNOWN');
        expectSnapshotLaneOmitted();
      });
    });
  });

  // QIR-002 - the deterministic FAST/DEEP Runtime Decision Policy v2 is the ONE
  // routing authority, computed exactly once on the eligible RECEIVED path,
  // before the canonical claim, with zero intelligence reads and zero extra
  // provider calls.
  describe('QIR-003 - Bounded Foreground Intelligence Gatherer orchestration', () => {
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
    const memoryValue = [{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }];
    const emptyHypothesis = { coverageState: 'EMPTY' as const, candidateHypothesisCount: 0 as const };
    const drainScheduledWork = () => new Promise((resolve) => { setImmediate(resolve); });
    const finalizeNormally = () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    };

    it('launches the frozen Human Intelligence lane, Memory, and Hypothesis in the same post-Safety stage, before awaiting any of them', async () => {
      const snapshotRead = deferred<HimIntelligenceSnapshot>();
      const memoryRead = deferred<typeof memoryValue>();
      const hypothesisRead = deferred<typeof emptyHypothesis>();
      himSnapshot.getSnapshot.mockReturnValue(snapshotRead.promise);
      memoryRetriever.retrieve.mockReturnValue(memoryRead.promise as never);
      hypothesisContext.build.mockReturnValue(hypothesisRead.promise as never);
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await drainScheduledWork();
      // Every controlled deferred is STILL PENDING, yet all three independent
      // foreground lanes have already been started: QHIA before Memory or
      // Hypothesis settles, Memory before QHIA settles, Hypothesis before QHIA
      // settles, and Memory/Hypothesis before either is awaited. Hypothesis is
      // therefore provably not a serial stage after Memory.
      expect(himSnapshot.getSnapshot).toHaveBeenCalledTimes(1);
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
      expect(router.generate).not.toHaveBeenCalled();
      snapshotRead.resolve(snapshot);
      memoryRead.resolve(memoryValue);
      hypothesisRead.resolve(emptyHypothesis);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ memoryContext: memoryValue }));
    });

    it('holds provider dispatch for the gather join when Memory outlives the Human Intelligence lane', async () => {
      const memoryRead = deferred<typeof memoryValue>();
      memoryRetriever.retrieve.mockReturnValue(memoryRead.promise as never);
      finalizeNormally();
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await drainScheduledWork();
      // The frozen Human Intelligence lane has fully settled and been consumed;
      // the still-pending Memory read is the only open lane, and dispatch waits
      // for the join rather than racing past it.
      expect(himBridge.transform).toHaveBeenCalledTimes(1);
      expect(router.generate).not.toHaveBeenCalled();
      memoryRead.resolve(memoryValue);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('waits for the slower of the two lanes - never their sum - when the gather settles first', async () => {
      jest.useFakeTimers();
      try {
        himSnapshot.getSnapshot.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(0);
        // Memory and Hypothesis settled immediately; the Human Intelligence
        // lane is still holding its own frozen 300 ms Snapshot budget. The join
        // dispatches at the 300 ms Human Intelligence boundary - the slower
        // lane - and the settled gather adds zero further wait.
        expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
        expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
        expect(router.generate).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(300);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
      } finally { jest.useRealTimers(); }
    });

    it('bounds the non-HI foreground wait to ONE shared 5000 ms deadline: a pending Hypothesis expires, Memory is delivered, Recommendation is not grounded', async () => {
      jest.useFakeTimers();
      try {
        memoryRetriever.retrieve.mockResolvedValue(memoryValue as never);
        hypothesisContext.build.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS - 1);
        expect(router.generate).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ memoryContext: memoryValue }));
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('hypothesisContext');
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('recommendationContext');
        // An expired Hypothesis grounds NOTHING: no deterministic empty
        // grounding, no fallback, and no fabricated canonical EMPTY result.
        expect(recommendationGrounding.ground).not.toHaveBeenCalled();
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });

    it('lets Hypothesis succeed while Memory expires on the SAME deadline, omitting only the Memory field', async () => {
      jest.useFakeTimers();
      try {
        memoryRetriever.retrieve.mockReturnValue(new Promise(() => undefined));
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('memoryContext');
        // The legitimate EMPTY Hypothesis outcome still grounds normally.
        expect(recommendationGrounding.ground).toHaveBeenCalledTimes(1);
        expect(recommendationGrounding.ground).toHaveBeenCalledWith(emptyHypothesis);
      } finally { jest.useRealTimers(); }
    });

    it('expires BOTH sources together at one deadline - never an additive 5s + 5s wait - and discards every late settlement', async () => {
      jest.useFakeTimers();
      try {
        const memoryRead = deferred<typeof memoryValue>();
        const hypothesisRead = deferred<typeof emptyHypothesis>();
        memoryRetriever.retrieve.mockReturnValue(memoryRead.promise as never);
        hypothesisContext.build.mockReturnValue(hypothesisRead.promise as never);
        finalizeNormally();
        const pending = orchestrator.orchestrate('token', 'user', userTurn);
        // Dispatch happens at exactly the ONE 5000 ms ceiling with both
        // sources omitted - were the deadlines additive, nothing could
        // dispatch before 10000 ms.
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('memoryContext');
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('hypothesisContext');
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('recommendationContext');
        expect(recommendationGrounding.ground).not.toHaveBeenCalled();
        const sent = JSON.stringify(router.generate.mock.calls[0][0]);
        // Late fulfillment AND late rejection after the deadline: both are
        // discarded for this turn with no unhandled rejection, no provider
        // request mutation, no second provider call, and no re-finalization.
        memoryRead.resolve(memoryValue);
        hypothesisRead.reject(new Error('late private hypothesis failure'));
        await jest.advanceTimersByTimeAsync(0);
        expect(JSON.stringify(router.generate.mock.calls[0][0])).toBe(sent);
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
        expect(repository.failTurn).not.toHaveBeenCalled();
        expect(recommendationGrounding.ground).not.toHaveBeenCalled();
      } finally { jest.useRealTimers(); }
    });

    it('degrades an approved Memory availability failure to an omitted Memory field while the turn generates normally', async () => {
      const record = jest.spyOn(telemetry, 'recordForegroundIntelligenceSource');
      for (const failure of [new ServiceUnavailableException('Memory persistence is unavailable.'), new MemoryDataApiError(503), new MemoryDataApiError(408), new MemoryDataApiError(429)]) {
        router.generate.mockClear(); record.mockClear();
        memoryRetriever.retrieve.mockRejectedValue(failure);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('memoryContext');
        expect(record).toHaveBeenCalledWith('MEMORY', 'OPTIONAL_AVAILABILITY_FAILURE', 'FAST');
        expect(repository.failTurn).not.toHaveBeenCalled();
      }
    });

    it('fails CLOSED on a non-approved Memory failure: 4xx authority statuses and unexpected errors never degrade', async () => {
      for (const failure of [new MemoryDataApiError(400), new MemoryDataApiError(401), new MemoryDataApiError(403), new MemoryDataApiError(404), new Error('private memory query failure')]) {
        router.generate.mockClear(); repository.failTurn.mockClear();
        memoryRetriever.retrieve.mockRejectedValue(failure);
        repository.claimTurn.mockResolvedValue(claimed);
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(router.generate).not.toHaveBeenCalled();
        expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      }
    });

    it('degrades an approved Hypothesis availability failure to omitted Hypothesis AND Recommendation, grounding nothing', async () => {
      const record = jest.spyOn(telemetry, 'recordForegroundIntelligenceSource');
      memoryRetriever.retrieve.mockResolvedValue(memoryValue as never);
      hypothesisContext.build.mockRejectedValue(new MemoryDataApiError(503));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ memoryContext: memoryValue }));
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('hypothesisContext');
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('recommendationContext');
      expect(recommendationGrounding.ground).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith('HYPOTHESIS', 'OPTIONAL_AVAILABILITY_FAILURE', 'FAST');
      expect(record).toHaveBeenCalledWith('MEMORY', 'AVAILABLE', 'FAST');
    });

    it('fails CLOSED on a Hypothesis reasoning invariant violation and records the pre-existing rejected outcome', async () => {
      const recordContext = jest.spyOn(telemetry, 'recordHypothesisContext');
      hypothesisContext.build.mockRejectedValue(new HypothesisReasoningInvariantError());
      repository.claimTurn.mockResolvedValue(claimed);
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(router.generate).not.toHaveBeenCalled();
      expect(recommendationGrounding.ground).not.toHaveBeenCalled();
      expect(repository.failTurn).toHaveBeenCalledWith('session', 'user', 'user-turn');
      expect(recordContext).toHaveBeenCalledWith('rejected', 'FAST');
    });

    it('emits the bounded per-source outcome telemetry on the normal turn path with the routed processing path', async () => {
      const record = jest.spyOn(telemetry, 'recordForegroundIntelligenceSource');
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(record).toHaveBeenCalledTimes(2);
      expect(record).toHaveBeenCalledWith('MEMORY', 'LEGITIMATE_EMPTY', 'DEEP');
      expect(record).toHaveBeenCalledWith('HYPOTHESIS', 'LEGITIMATE_EMPTY', 'DEEP');
    });

    it('starts no Memory or Hypothesis work for COMPLETED replay, GENERATING recovery, or a lost claim', async () => {
      repository.findTurn.mockResolvedValue(completedUser);
      repository.findAssistantForSource.mockResolvedValue(assistant);
      await orchestrator.orchestrate('token', 'user', completedUser);
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(undefined);
      await orchestrator.orchestrate('token', 'user', { ...userTurn, status: 'GENERATING' });
      repository.claimTurn.mockResolvedValue(undefined);
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(memoryRetriever.retrieve).not.toHaveBeenCalled();
      expect(hypothesisContext.build).not.toHaveBeenCalled();
      expect(recommendationGrounding.ground).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
    });
  });

  describe('QIR-002 - FAST / DEEP Runtime Decision Policy v2', () => {
    const multiPartTurn = { ...userTurn, content: `${'y'.repeat(45)}. `.repeat(7).trim() };
    const multiPartClaim = { ...claimed, content: multiPartTurn.content, processing_path: 'DEEP' as const, routing_reason: 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART' };

    it('decides exactly once, before the canonical claim, with no intelligence, database or provider read', async () => {
      const record = jest.spyOn(telemetry, 'recordRoutingDecision');
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);

      expect(repository.claimTurn).toHaveBeenCalledTimes(1);
      expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      // The claim boundary carries the durable route PAIR only: the signals and
      // the score never reach persistence.
      expect(Object.keys(repository.claimTurn.mock.calls[0][3]!).sort()).toEqual(['path', 'reason']);

      // NOTHING that could give routing semantic authority runs before the
      // decision is already durable.
      const claimOrder = repository.claimTurn.mock.invocationCallOrder[0];
      for (const [label, mock] of [
        ['ContextBuilder', contextBuilder.build],
        ['Safety', safetyGate.evaluate],
        ['Memory', memoryRetriever.retrieve],
        ['HIM snapshot', himSnapshot.getSnapshot],
        ['HIM FAST/DEEP projection', himConsumptionPolicy.project],
        ['Hypothesis', hypothesisContext.build],
        ['provider', router.generate],
      ] as const) {
        expect(mock).toHaveBeenCalled();
        expect({ [label]: mock.mock.invocationCallOrder[0] > claimOrder }).toEqual({ [label]: true });
      }
      // Exactly one conversational provider call, and exactly one canonical
      // routing decision recorded by the claim winner.
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith({
        policyVersion: 2, path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', complexityScore: 0,
        signals: { codePointCount: 5, questionCount: 0, logicalUnitCount: 1 },
      });
      expect(record.mock.invocationCallOrder[0]).toBeGreaterThan(claimOrder);
    });

    it('routes a short structurally complex turn to DEEP and projects it downstream', async () => {
      repository.claimTurn.mockResolvedValue(multiPartClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...multiPartClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', multiPartTurn);
      expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'DEEP', reason: 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART' });
      // The selected path keeps driving every existing downstream projection.
      expect(himConsumptionPolicy.project).toHaveBeenCalledWith('DEEP', expect.anything());
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'DEEP', complexity: 'HIGH', latencyBudgetMs: 10000 }));
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('counts code points, not UTF-16 units: a long emoji turn stays FAST', async () => {
      const emojiTurn = { ...userTurn, content: '\u{1F600}'.repeat(500) };
      expect(emojiTurn.content.length).toBe(1000);
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', emojiTurn);
      expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'FAST', reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' });
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'FAST', complexity: 'LOW', latencyBudgetMs: 3000 }));
    });

    it('never lets a lost claim create a competing route, provider call, or canonical decision metric', async () => {
      const record = jest.spyOn(telemetry, 'recordRoutingDecision');
      repository.claimTurn.mockResolvedValue(undefined);
      repository.findTurn.mockResolvedValue(completedUser);
      repository.findAssistantForSource.mockResolvedValue(assistant);
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(repository.claimTurn).toHaveBeenCalledTimes(1);
      expect(record).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
    });

    it('never routes, claims, or records a decision on a replayed turn', async () => {
      const record = jest.spyOn(telemetry, 'recordRoutingDecision');
      repository.findTurn.mockResolvedValue(completedUser);
      repository.findAssistantForSource.mockResolvedValue(assistant);
      repository.recoverExpiredGeneratingTurn.mockResolvedValue(undefined);
      await orchestrator.orchestrate('token', 'user', completedUser);
      await orchestrator.orchestrate('token', 'user', { ...userTurn, status: 'GENERATING' });
      expect(repository.claimTurn).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      expect(router.generate).not.toHaveBeenCalled();
    });
  });
});