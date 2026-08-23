import { ServiceUnavailableException } from '@nestjs/common';
import { ConversationOrchestratorService } from '../conversation/conversation-orchestrator.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import type { ConversationTurn } from '../conversation/conversation.types';
import { composeServerGuidance, type ModelRouterRequest } from '../model-router/model-router.types';
import { HimTurnContextSelectionService } from './him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from './him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from './him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from './him-fast-deep-consumption.service';
import type { HimSnapshotSourceRow } from './him-intelligence-snapshot.types';

const inputSession = '20000000-0000-4000-8000-000000000001';
const claimedSession = '20000000-0000-4000-8000-000000000002';
const turnId = '10000000-0000-4000-8000-000000000001';
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
  const correlation=new CorrelationService();
  const orchestrator = new ConversationOrchestratorService(repository as never, contextBuilder as never, safety as never, { buildTextGuidance: jest.fn().mockReturnValue('behavior') } as never, memoryRetriever as never, memoryWriter as never, selector, snapshot, bridge, policy, router,correlation,new TelemetryService(correlation));
  return { orchestrator, repository, snapshotRepository, safety, memoryRetriever, router, selector, snapshot, bridge, policy };
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
    expect(request).toMatchObject({ path: 'FAST', memoryContext: [{ type: 'GOAL', content: 'memory-only' }], himContext: { consumptionMode: 'FAST', contextId: claimedSession, eligibleMetricCount: 3 } });
    expect(request.context).toEqual([{ role: 'USER', content: 'hello' }]);
    expect(request.himContext!.metrics.map((metric) => Object.keys(metric))).toEqual(Array(3).fill(['metricKey', 'knowledgeState', 'ordinalCategory']));
    expect(request.himContext!.metrics).toContainEqual({ metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null });
    const guidance = composeServerGuidance(request);
    expect(guidance).toContain('<user_memory_context>'); expect(guidance).toContain('<him_reasoning_context>');
    expect(guidance).toContain('FAST intentionally omits timestamps');
  });

  it('selects DEEP independently and exposes semantic metadata without provenance or trends', async () => {
    const content = 'x'.repeat(1000); const { orchestrator, router } = setup(rows.PARTIAL, content);
    await orchestrator.orchestrate('access-token', 'user', userTurn(content));
    const request = router.generate.mock.calls[0][0] as ModelRouterRequest;
    expect(request.path).toBe('DEEP'); expect(request.himContext).toMatchObject({ consumptionMode: 'DEEP', contextKind: 'CONVERSATION_SESSION', contextId: claimedSession });
    const unknown = request.himContext!.metrics.find((metric) => metric.knowledgeState === 'UNKNOWN')!;
    expect(unknown).toMatchObject({ unknownReason: 'NO_MEASUREMENT', ordinalCategory: null, observationQualifier: null, observedAt: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: null });
    for (const forbidden of ['measurementEventId','measurementObservationId','calculationResultId','canonicalBindingId','scaleReference','instrumentId','modelId','trend']) expect(JSON.stringify(request.himContext)).not.toContain(forbidden);
    expect(composeServerGuidance(request)).toContain('does not authorize trend or decay inference');
  });

  it('short-circuits BLOCK before Snapshot, Memory, and Router', async () => {
    const s = setup(rows.FULL); s.safety.evaluate.mockReturnValue({ category: 'RISK', disposition: 'BLOCK', deterministicResponse: 'safe' });
    await s.orchestrator.orchestrate('access-token', 'user', userTurn());
    expect(s.snapshotRepository.readIntelligenceSnapshot).not.toHaveBeenCalled(); expect(s.memoryRetriever.retrieve).not.toHaveBeenCalled(); expect(s.router.generate).not.toHaveBeenCalled();
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
});
