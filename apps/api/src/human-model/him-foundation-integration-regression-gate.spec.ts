import { ServiceUnavailableException } from '@nestjs/common';
import { ConversationOrchestratorService } from '../conversation/conversation-orchestrator.service';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import type { ConversationTurn } from '../conversation/conversation.types';
import { composeServerGuidance, type ModelRouterRequest } from '../model-router/model-router.types';
import { HimTurnContextSelectionService } from './him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from './him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from './him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from './him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from './him-interaction-adaptation.service';
import { HimContextualCurrentIntelligenceService } from './him-contextual-current-intelligence.service';
import { HimSessionReflectionConsumptionService } from './him-session-reflection-consumption.service';
import { HimSituationStressConsumptionService } from './him-situation-stress-consumption.service';
import { HimSituationStressRepository } from './him-situation-stress.repository';
import { HimDecisionAttentionConsumptionService } from './him-decision-attention-consumption.service';
import { HimDecisionAttentionRepository } from './him-decision-attention.repository';
import { HimGoalMotivationConsumptionService } from './him-goal-motivation-consumption.service';
import { HimGoalMotivationRepository } from './him-goal-motivation.repository';
import { HimRelationshipCommunicationConsumptionService } from './him-relationship-communication-consumption.service';
import { HimRelationshipCommunicationRepository } from './him-relationship-communication.repository';
import { HimCrossContextForegroundAggregationService } from './him-cross-context-foreground-aggregation.service';
import { HimCrossContextForegroundRepository } from './him-cross-context-foreground.repository';
import { HimBrainContextService } from './him-brain-context.service';
import { HimBrainContextRepository } from './him-brain-context.repository';
import { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';
import type { HimSnapshotSourceRow } from './him-intelligence-snapshot.types';

const inputSession = '20000000-0000-4000-8000-000000000001';
const claimedSession = '20000000-0000-4000-8000-000000000002';
const turnId = '10000000-0000-4000-8000-000000000001';
const canonicalUser = '30000000-0000-4000-8000-000000000001';
const generated = '2026-08-24T00:00:00.000Z';
const slots = [['hse.stress', 1], ['hse.energy', 2], ['hse.attention', 5]] as const;
const active = (metricKey: string, order: number): HimSnapshotSourceRow => ({
  generated_at: generated, slot_order: order, metric_key: metricKey, definition_version: 1,
  semantic_type: 'STATE', context_kind: 'CONVERSATION_SESSION', context_id: claimedSession,
  active_binding_id: `binding-${metricKey}`, active_instrument_id: `instrument-${metricKey}`,
  active_instrument_version: 1, active_scale_reference: `scale-${metricKey}`, active_scale_version: 1,
  active_model_id: `model-${metricKey}`, active_model_version: 1,
  measurement_event_id: null, event_observed_at: null, measurement_observation_id: null,
  response_code: null, observation_instrument_id: null, observation_instrument_version: null,
  observation_scale_reference: null, observation_scale_version: null, snapshot_id: null,
  value_state: null, numeric_value: null, validity_status: null, snapshot_provenance: null,
  calculation_result_id: null, canonical_binding_id: null, snapshot_scale_reference: null,
  snapshot_scale_version: null, result_state: null, result_numeric_value: null,
  result_model_id: null, result_model_version: null, result_provenance: null,
  result_confidence_state: null, result_confidence_reference: null, source_binding_status: null,
  source_instrument_id: null, source_instrument_version: null, source_scale_reference: null,
  source_scale_version: null, source_model_id: null, source_model_version: null,
});
const assessed = (metricKey: string, order: number, numericValue = 3): HimSnapshotSourceRow => {
  const row = active(metricKey, order);
  return { ...row, measurement_event_id: `event-${metricKey}`, event_observed_at: '2026-08-23T00:00:00.000Z',
    measurement_observation_id: `observation-${metricKey}`,
    response_code: ['', 'VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'][numericValue],
    observation_instrument_id: row.active_instrument_id, observation_instrument_version: 1,
    observation_scale_reference: row.active_scale_reference, observation_scale_version: 1,
    snapshot_id: `snapshot-${metricKey}`, value_state: 'ASSESSED', numeric_value: numericValue,
    validity_status: 'VALID', snapshot_provenance: 'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',
    calculation_result_id: `result-${metricKey}`, canonical_binding_id: row.active_binding_id,
    snapshot_scale_reference: row.active_scale_reference, snapshot_scale_version: 1,
    result_state: 'ASSESSED', result_numeric_value: numericValue, result_model_id: row.active_model_id,
    result_model_version: 1, result_provenance: 'QANDEEL_HIM_CALCULATION_RUNTIME_V1',
    result_confidence_state: 'UNASSESSED', result_confidence_reference: null, source_binding_status: 'ACTIVE',
    source_instrument_id: row.active_instrument_id, source_instrument_version: 1,
    source_scale_reference: row.active_scale_reference, source_scale_version: 1,
    source_model_id: row.active_model_id, source_model_version: 1 };
};
const rows = {
  FULL: slots.map(([key, order], index) => assessed(key, order, index + 2)),
  PARTIAL: [assessed('hse.stress', 1, 2), active('hse.energy', 2), assessed('hse.attention', 5, 4)],
  EMPTY: slots.map(([key, order]) => active(key, order)),
};
const userTurn = (content = 'hello'): ConversationTurn => ({
  id: turnId, session_id: inputSession, role: 'USER', status: 'RECEIVED', content,
  processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request',
  created_at: generated, updated_at: generated, completed_at: null,
});
const claimed = (content = 'hello'): ConversationTurn => ({ ...userTurn(content), session_id: claimedSession, status: 'GENERATING' });

function setup(sourceRows: HimSnapshotSourceRow[], content = 'hello') {
  const snapshotRepository = { readIntelligenceSnapshot: jest.fn().mockResolvedValue(sourceRows) };
  const snapshot = new HimIntelligenceSnapshotService(snapshotRepository as never);
  const selector = new HimTurnContextSelectionService();
  const bridge = new HimReasoningConsumptionService();
  const policy = new HimFastDeepConsumptionService();
  const repository = { claimTurn: jest.fn().mockResolvedValue(claimed(content)), finalizeTurn: jest.fn().mockResolvedValue({ userTurn: { ...claimed(content), status: 'COMPLETED' }, assistantTurn: { ...claimed(content), id: '30000000-0000-4000-8000-000000000003', role: 'ASSISTANT', status: 'COMPLETED', content: 'response' } }), failTurn: jest.fn(), findTurn: jest.fn(), findAssistantForSource: jest.fn() };
  const contextBuilder = { build: jest.fn().mockResolvedValue([{ role: 'USER', content }]), assemble: jest.fn((messages, memoryContext) => ({ messages, ...(memoryContext.length ? { memoryContext } : {}) })) };
  const safety = { evaluate: jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW' }) };
  const memoryRetriever = { retrieve: jest.fn().mockResolvedValue([{ type: 'GOAL', content: 'memory-only' }]) };
  const memoryWriter = { evaluateAndWrite: jest.fn().mockResolvedValue({ decision: 'SKIP' }) };
  const router = { generate: jest.fn().mockResolvedValue({ content: 'response', routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 } }) };
  const hypothesisContext = { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) };
  const hypothesisEligibility = { evaluateWithContext: jest.fn().mockResolvedValue({ eligibility: { status: 'NOT_ELIGIBLE', reason: 'NO_TRIGGER' } }) };
  const hypothesisExtraction = { extract: jest.fn() };
  const hypothesisRequestAssembler = { assemble: jest.fn() };
  const correlation=new CorrelationService();
  const hypothesisGeneration = { generate: jest.fn().mockResolvedValue({ accepted: [], rejected: [] }) };
  const confidence = { evaluateHypothesis: jest.fn().mockResolvedValue({}) };
  const hypothesisCandidateGenerator = { generate: jest.fn().mockResolvedValue([]) };
  // QHIA-005: the optional Reflection selective read runs over the REAL
  // contextual-current service; this gate's repository double rejects the
  // batch transport, exercising the graceful-degradation contract (guidance
  // omitted, HSE foreground behavior unchanged) rather than mocking it away.
  const reflectionBatchRepository = { readContextualCurrentIntelligenceBatch: jest.fn().mockRejectedValue(new Error('foundation gate: reflection transport unavailable')) };
  // QHIA-009/QHIA-010/QHIA-011: the REAL cross-context foreground aggregate over
  // a real repository whose Data API double rejects, so this gate exercises the
  // zero-incremental-wait graceful-degradation contract (ALL FOUR existing
  // guidance fields omitted, HSE foreground behaviour unchanged) rather than
  // mocking it away. Its four child consumers are the REAL QHIA-007, QHIA-008,
  // QHIA-010 and QHIA-011 semantic boundaries over their REAL direct
  // repositories, whose own Data API doubles are proven never to be called: the
  // turn issues exactly one cross-context foreground request and no direct
  // 007/008/010/011 fallback exists.
  const situationStressDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: situation stress transport unavailable')) };
  const decisionAttentionDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: decision attention transport unavailable')) };
  const goalMotivationDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: goal motivation transport unavailable')) };
  const relationshipCommunicationDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: relationship communication transport unavailable')) };
  const crossContextForegroundDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: cross-context foreground transport unavailable')) };
  // QHIA-012: the REAL Brain Context boundary over a real repository whose Data
  // API double rejects, so this gate exercises the same zero-incremental-wait
  // graceful-degradation contract for the new advisory channel (the provider
  // field omitted, HSE foreground behaviour unchanged) rather than mocking it
  // away.
  const brainContextDataApi = { request: jest.fn().mockRejectedValue(new Error('foundation gate: brain context transport unavailable')) };
  const situationStressConsumption = new HimSituationStressConsumptionService(new HimSituationStressRepository(situationStressDataApi as never));
  const decisionAttentionConsumption = new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(decisionAttentionDataApi as never));
  const goalMotivationConsumption = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(goalMotivationDataApi as never));
  const relationshipCommunicationConsumption = new HimRelationshipCommunicationConsumptionService(new HimRelationshipCommunicationRepository(relationshipCommunicationDataApi as never));
  const telemetry = new TelemetryService(correlation);
  // QIR-003: the REAL bounded Memory + Hypothesis foreground gatherer over the
  // gate's Memory/Hypothesis doubles, so the gate drives the real concurrent
  // post-Safety launch topology and the real typed-outcome join.
  const foregroundGatherer = new BoundedForegroundIntelligenceGathererService(memoryRetriever as never, hypothesisContext as never, correlation, telemetry);
  const orchestrator = new ConversationOrchestratorService(repository as never, contextBuilder as never, safety as never, { buildTextGuidance: jest.fn().mockReturnValue('behavior') } as never, selector, snapshot, bridge, policy, new HimInteractionAdaptationService(), new HimContextualCurrentIntelligenceService(reflectionBatchRepository as never), new HimSessionReflectionConsumptionService(), new HimCrossContextForegroundAggregationService(new HimCrossContextForegroundRepository(crossContextForegroundDataApi as never), situationStressConsumption, decisionAttentionConsumption, goalMotivationConsumption, relationshipCommunicationConsumption), new HimBrainContextService(new HimBrainContextRepository(brainContextDataApi as never)), foregroundGatherer, new RecommendationGroundingService(), router,correlation,telemetry);
  return { orchestrator, repository, snapshotRepository, safety, memoryRetriever, hypothesisContext, router, selector, snapshot, bridge, policy, situationStressDataApi, decisionAttentionDataApi, goalMotivationDataApi, relationshipCommunicationDataApi, crossContextForegroundDataApi, brainContextDataApi };
}

describe('Foundation integration / regression gate v1', () => {
  it.each(['FULL', 'PARTIAL', 'EMPTY'] as const)('executes the real Snapshot -> Bridge -> policy chain for %s coverage', async (coverage) => {
    const { snapshot, bridge, policy } = setup(rows[coverage]);
    const canonical = await snapshot.getSnapshot('access-token', 'CONVERSATION_SESSION', claimedSession);
    const reasoning = bridge.transform(canonical);
    expect(policy.project('FAST', reasoning)).toMatchObject({ coverageState: coverage, eligibleMetricCount: 3, contextId: claimedSession });
  });

  it('runs authoritative claimed-session FAST end to end and keeps Memory/HIM separate', async () => {
    const { orchestrator, snapshotRepository, router } = setup(rows.PARTIAL);
    await orchestrator.orchestrate('access-token', 'user', userTurn());
    expect(snapshotRepository.readIntelligenceSnapshot).toHaveBeenCalledWith('access-token', { contextKind: 'CONVERSATION_SESSION', contextId: claimedSession });
    const request = router.generate.mock.calls[0][0] as ModelRouterRequest;
    // QHIA-013: the session reasoning data reaches the provider inside the ONE
    // Human Intelligence envelope, with the internal session UUID stripped and
    // every remaining FAST field - metricKey included - preserved exactly.
    expect(request).toMatchObject({ path: 'FAST', memoryContext: [{ type: 'GOAL', content: 'memory-only' }], humanIntelligence: { sessionReasoningContext: { consumptionMode: 'FAST', eligibleMetricCount: 3 } } });
    expect(request).not.toHaveProperty('himContext');
    const sessionReasoningContext = request.humanIntelligence!.sessionReasoningContext!;
    expect(sessionReasoningContext).not.toHaveProperty('contextId');
    expect(request.context).toEqual([{ role: 'USER', content: 'hello' }]);
    expect(sessionReasoningContext.metrics.map((metric) => Object.keys(metric))).toEqual(Array(3).fill(['metricKey', 'knowledgeState', 'ordinalCategory']));
    expect(sessionReasoningContext.metrics).toContainEqual({ metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null });
    const guidance = composeServerGuidance(request);
    expect(guidance).toContain('<user_memory_context>'); expect(guidance).toContain('<him_reasoning_context>');
    expect(guidance).toContain('FAST intentionally omits timestamps');
  });

  it('selects DEEP independently and exposes semantic metadata without provenance or trends', async () => {
    const content = 'x'.repeat(1000); const { orchestrator, router } = setup(rows.PARTIAL, content);
    await orchestrator.orchestrate('access-token', 'user', userTurn(content));
    const request = router.generate.mock.calls[0][0] as ModelRouterRequest;
    expect(request.path).toBe('DEEP');
    const sessionReasoningContext = request.humanIntelligence!.sessionReasoningContext!;
    expect(sessionReasoningContext).toMatchObject({ consumptionMode: 'DEEP', contextKind: 'CONVERSATION_SESSION' });
    expect(sessionReasoningContext).not.toHaveProperty('contextId');
    const unknown = sessionReasoningContext.metrics.find((metric) => metric.knowledgeState === 'UNKNOWN')!;
    expect(unknown).toMatchObject({ unknownReason: 'NO_MEASUREMENT', ordinalCategory: null, observationQualifier: null, observedAt: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: null });
    for (const forbidden of ['measurementEventId','measurementObservationId','calculationResultId','canonicalBindingId','scaleReference','instrumentId','modelId','trend',claimedSession]) expect(JSON.stringify(sessionReasoningContext)).not.toContain(forbidden);
    expect(composeServerGuidance(request)).toContain('does not authorize trend or decay inference');
  });

  it('short-circuits BLOCK before Snapshot, Memory, and Router', async () => {
    const s = setup(rows.FULL); s.safety.evaluate.mockReturnValue({ category: 'RISK', disposition: 'BLOCK', deterministicResponse: 'safe' });
    await s.orchestrator.orchestrate('access-token', 'user', userTurn());
    expect(s.snapshotRepository.readIntelligenceSnapshot).not.toHaveBeenCalled(); expect(s.memoryRetriever.retrieve).not.toHaveBeenCalled(); expect(s.hypothesisContext.build).not.toHaveBeenCalled(); expect(s.router.generate).not.toHaveBeenCalled();
  });

  it('performs zero HIM/model work for COMPLETED and claim-miss currentResult paths', async () => {
    const completed = setup(rows.FULL); completed.repository.findTurn.mockResolvedValue({ ...userTurn(), status: 'COMPLETED' });
    await completed.orchestrator.orchestrate('access-token', 'user', { ...userTurn(), status: 'COMPLETED' });
    expect(completed.snapshotRepository.readIntelligenceSnapshot).not.toHaveBeenCalled(); expect(completed.router.generate).not.toHaveBeenCalled();
    const missed = setup(rows.FULL); missed.repository.claimTurn.mockResolvedValue(undefined); await missed.orchestrator.orchestrate('access-token', 'user', userTurn());
    expect(missed.snapshotRepository.readIntelligenceSnapshot).not.toHaveBeenCalled(); expect(missed.router.generate).not.toHaveBeenCalled();
  });

  it('uses the existing fail-closed orchestrator path for malformed Snapshot rows', async () => {
    const malformed = rows.FULL.map((row, index) => index ? row : { ...row, metric_key: 'hse.energy' });
    const s = setup(malformed);
    await expect(s.orchestrator.orchestrate('access-token', 'user', userTurn())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s.repository.failTurn).toHaveBeenCalled(); expect(s.router.generate).not.toHaveBeenCalled();
  });

  it('issues EXACTLY ONE cross-context foreground request through the real aggregate and no direct QHIA-007/QHIA-008/QHIA-010/QHIA-011 request', async () => {
    const s = setup(rows.FULL);
    // The one gate turn driven with a canonical authenticated identity, so the
    // real aggregate boundary passes its own fail-closed identity check and the
    // external transport is genuinely reached rather than short-circuited.
    await s.orchestrator.orchestrate('access-token', canonicalUser, userTurn());
    // One aggregate request against the migration-0060 aggregate-v3 RPC,
    // carrying only the authenticated user and the exact owned session. The
    // retired aggregate-v1 and aggregate-v2 endpoints are never requested.
    expect(s.crossContextForegroundDataApi.request).toHaveBeenCalledTimes(1);
    expect(s.crossContextForegroundDataApi.request.mock.calls[0][1]).toBe('rpc/read_him_session_cross_context_foreground_v3');
    expect(JSON.parse(s.crossContextForegroundDataApi.request.mock.calls[0][2].body as string)).toEqual({ p_user_id: canonicalUser, p_session_id: claimedSession });
    // The REAL direct QHIA-007, QHIA-008, QHIA-010 and QHIA-011 boundaries are
    // wired into this graph and reachable; the turn never touches their
    // transports, so no separate, fallback, or backup request exists on the
    // foreground path.
    expect(s.situationStressDataApi.request).not.toHaveBeenCalled();
    expect(s.decisionAttentionDataApi.request).not.toHaveBeenCalled();
    expect(s.goalMotivationDataApi.request).not.toHaveBeenCalled();
    expect(s.relationshipCommunicationDataApi.request).not.toHaveBeenCalled();
    // The rejecting aggregate degrades to omitted guidance: the turn still
    // dispatches once, with no extra wait. After QHIA-013 the four channels are
    // no longer separate provider fields, so "none of them was used" is proven
    // where the provider actually sees it - the one envelope carries the session
    // reasoning lane and NOT ONE behavioral instruction.
    expect(s.router.generate).toHaveBeenCalledTimes(1);
    const request = s.router.generate.mock.calls[0][0] as ModelRouterRequest;
    expect(request.humanIntelligence).toBeDefined();
    expect(request.humanIntelligence!.behavioralInstructionIds).toEqual([]);
    expect(request.humanIntelligence!.sessionReasoningContext).toBeDefined();
    expect(request.humanIntelligence!.brainContext).toBeUndefined();
    for (const legacy of [
      'himContext', 'himInteractionAdaptation', 'himSessionReflectionGuidance', 'himSituationStressGuidance',
      'himDecisionAttentionGuidance', 'himGoalMotivationGuidance', 'himRelationshipCommunicationGuidance',
      'himBrainContext',
    ]) expect(request).not.toHaveProperty(legacy);
    expect(s.repository.failTurn).not.toHaveBeenCalled();
  });
});
