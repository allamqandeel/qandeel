import { ServiceUnavailableException } from '@nestjs/common';
import type { ModelRouter } from '../model-router/model-router.types';
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
import { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';
import { RecommendationGroundingInvariantError, type RecommendationGroundingContext } from '../recommendation/recommendation-grounding.types';

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
  let hypothesisContext: jest.Mocked<HypothesisReasoningContextService>;
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
  const claimed: ConversationTurn = { ...userTurn, status: 'GENERATING', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT' };
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
    orchestrator = new ConversationOrchestratorService(repository, contextBuilder, safetyGate, behavioralPolicy, memoryRetriever, himSelector, himSnapshot, himBridge, himConsumptionPolicy, himAdaptation, himContextualCurrent, himReflectionConsumption, hypothesisContext, recommendationGrounding, router,correlation,telemetry);
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
      context: [{ role: 'USER', content: 'hello' }], himContext,
    }));
    expect(behavioralPolicy.buildTextGuidance).toHaveBeenCalledTimes(1);
    expect(repository.recoverExpiredGeneratingTurn).not.toHaveBeenCalled();
    expect(await orchestrator.orchestrate('token', 'user', completedUser)).toEqual({ userTurn: completedUser });
  });

  it('uses Fast by default with an explicit default reason', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'FAST', reason: 'FAST_DEFAULT' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'FAST', himContext }));
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

  it('selects Deep only with the deterministic input-size reason', async () => {
    const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
    const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };
    repository.claimTurn.mockResolvedValue(deepClaim);
    repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
    await orchestrator.orchestrate('token', 'user', deepTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'DEEP', complexity: 'HIGH', himContext: expect.objectContaining({ consumptionMode: 'DEEP', contextId: 'session' }) }));
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
    expect(request.himContext).toEqual(himContext);
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
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himContext }));
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
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himContext }));
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
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himInteractionAdaptation: activeAdaptation, himContext }));
    });

    it('omits the optional field entirely for a NONE adaptation, preserving the no-adaptation guidance path', async () => {
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(1);
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himInteractionAdaptation');
    });

    it('derives the same adaptation from the same reasoning state on FAST and DEEP without influencing path selection', async () => {
      himAdaptation.derive.mockReturnValue(activeAdaptation);
      repository.claimTurn.mockResolvedValue(claimed);
      repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(himAdaptation.derive).toHaveBeenCalledTimes(2);
      expect(himAdaptation.derive).toHaveBeenNthCalledWith(1, himReasoningContext);
      expect(himAdaptation.derive).toHaveBeenNthCalledWith(2, himReasoningContext);
      expect(router.generate.mock.calls[0][0]).toMatchObject({ path: 'FAST', himInteractionAdaptation: activeAdaptation });
      expect(router.generate.mock.calls[1][0]).toMatchObject({ path: 'DEEP', himInteractionAdaptation: activeAdaptation });
      // Path selection stays owned by the deterministic input-length rule.
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });
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
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himSessionReflectionGuidance: inviteReflectionGuidance, himContext }));
    });

    it('passes ACTIVE high guidance to the router as the typed optional field', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(5));
      himReflectionConsumption.consume.mockReturnValue(avoidReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himSessionReflectionGuidance: avoidReflectionGuidance }));
    });

    it('omits the router field entirely for MODERATE (NONE guidance)', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(3));
      himReflectionConsumption.consume.mockReturnValue(noneReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(himReflectionConsumption.consume).toHaveBeenCalledTimes(1);
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
    });

    it('omits the router field entirely for UNKNOWN', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(null));
      himReflectionConsumption.consume.mockReturnValue(noneReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
    });

    it('degrades a rejected Reflection read to omitted guidance while the turn generates normally', async () => {
      himContextualCurrent.getCurrentSelection.mockRejectedValue(new Error('private data api failure'));
      finalizeNormally();
      await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(himReflectionConsumption.consume).not.toHaveBeenCalled();
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
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
      expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himInteractionAdaptation: activeAdaptation }));
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
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({
        himInteractionAdaptation: activeAdaptation,
        himSessionReflectionGuidance: avoidReflectionGuidance,
      }));
    });

    it('gives FAST and DEEP the same Reflection guidance for identical Reflection input and never selects the path', async () => {
      himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(2));
      himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
      finalizeNormally();
      await orchestrator.orchestrate('token', 'user', userTurn);
      const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(router.generate.mock.calls[0][0]).toMatchObject({ path: 'FAST', himSessionReflectionGuidance: inviteReflectionGuidance });
      expect(router.generate.mock.calls[1][0]).toMatchObject({ path: 'DEEP', himSessionReflectionGuidance: inviteReflectionGuidance });
      // Path selection stays owned by the deterministic input-length rule:
      // Reflection is consumed after the route is claimed and never selects it.
      expect(repository.claimTurn).toHaveBeenNthCalledWith(1, 'session', 'user', 'user-turn', { path: 'FAST', reason: 'FAST_DEFAULT' });
      expect(repository.claimTurn).toHaveBeenNthCalledWith(2, 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });
    });

    it('lets a fast Reflection read win the 300 ms foreground budget, deliver guidance, and clear its timer (no leak)', async () => {
      jest.useFakeTimers();
      try {
        himContextualCurrent.getCurrentSelection.mockResolvedValue(reflectionSelection(1));
        himReflectionConsumption.consume.mockReturnValue(inviteReflectionGuidance);
        finalizeNormally();
        await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
        expect(router.generate).toHaveBeenCalledTimes(1);
        expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ himSessionReflectionGuidance: inviteReflectionGuidance }));
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
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
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
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
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
        expect(router.generate.mock.calls[0][0]).not.toHaveProperty('himSessionReflectionGuidance');
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
    const context = { contractVersion: 1 as const, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT' as const, coverageState: 'AVAILABLE' as const, candidateHypothesisCount: 1, includedHypothesisCount: 1, truncated: false, hypotheses: [] };
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
      expect(request.himContext).toEqual(himContext);
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
      const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };
      hypothesisContext.build.mockResolvedValue({ coverageState: 'AVAILABLE', context: availableHypothesisContext });
      recommendationGrounding.ground.mockReturnValue({ coverageState: 'AVAILABLE', context: groundedContext });
      repository.claimTurn.mockResolvedValue(deepClaim);
      repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
      await orchestrator.orchestrate('token', 'user', deepTurn);
      expect(repository.claimTurn).toHaveBeenCalledWith('session', 'user', 'user-turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });
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
});
