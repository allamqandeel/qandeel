import { ServiceUnavailableException } from '@nestjs/common';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import type { HimSnapshotSourceRow } from '../human-model/him-intelligence-snapshot.types';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from '../human-model/him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from '../human-model/him-interaction-adaptation.service';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimSessionReflectionConsumptionService } from '../human-model/him-session-reflection-consumption.service';
import type { HimContextualCurrentIntelligenceService } from '../human-model/him-contextual-current-intelligence.service';
import type { HimCrossContextForegroundAggregationService } from '../human-model/him-cross-context-foreground-aggregation.service';
import type { HimBrainContextService } from '../human-model/him-brain-context.service';
import type { HimRepository } from '../human-model/him.repository';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import type { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';
import type { ContextBuilder } from './context-builder.types';
import type { BehavioralResponsePolicy } from './behavioral-response-policy.types';
import type { SafetyResponseGate } from './safety-response-gate.types';
import type { MemoryRetrieverService } from '../memory/memory-retriever.service';
import type { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import type { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';

// QHIA-014A permanent remediation proof.
//
// This file exists to reproduce the EXACT QHIA-014 failure and keep it dead. On
// canonical baseline ae3a49a4 the HSE Intelligence Snapshot was raw-awaited
// inside the one HIM Promise.all, so it had no application-level foreground
// budget at all: it ultimately inherited the shared 5000 ms Data API transport
// timeout, a 301 ms / 1000 ms / never-settling read held the foreground for
// exactly that long, and a transport REJECTION failed the whole turn.
//
// Every case below therefore fails on that baseline and passes only after the
// remediation. Unlike the focused Orchestrator spec, the Snapshot here is the
// REAL HimIntelligenceSnapshotService over a controlled HimRepository, so the
// transport-unavailable vs fail-closed classification is proven end to end -
// repository failure -> service classification -> foreground budget boundary ->
// provider dispatch or fail-closed turn - rather than at a mocked seam.
//
// Nothing here sleeps. Every timing claim is made with jest fake timers and
// controlled promises.

const SESSION = '00000000-0000-4000-8000-000000000101';
const TURN = '00000000-0000-4000-8000-000000000102';
const GENERATED_AT = '2026-08-24T00:00:00.000Z';
// The exact frozen CONVERSATION_SESSION slots, in canonical order, with the
// canonical GLOBAL slot ordinals the projector integrity check requires.
const CONVERSATION_SESSION_SLOTS = [
  ['hse.stress', 1], ['hse.energy', 2], ['hse.attention', 5],
] as const;

const sourceRow = (metricKey: string, slotOrder: number): HimSnapshotSourceRow => ({
  generated_at: GENERATED_AT, slot_order: slotOrder, metric_key: metricKey, definition_version: 1,
  semantic_type: 'STATE', context_kind: 'CONVERSATION_SESSION', context_id: SESSION,
  active_binding_id: `active-${metricKey}`, active_instrument_id: `instrument-${metricKey}`, active_instrument_version: 1,
  active_scale_reference: `scale-${metricKey}`, active_scale_version: 1,
  active_model_id: `model-${metricKey}`, active_model_version: 1,
  measurement_event_id: null, event_observed_at: null, measurement_observation_id: null, response_code: null,
  observation_instrument_id: null, observation_instrument_version: null,
  observation_scale_reference: null, observation_scale_version: null,
  snapshot_id: null, value_state: null, numeric_value: null, validity_status: null, snapshot_provenance: null,
  calculation_result_id: null, canonical_binding_id: null, snapshot_scale_reference: null, snapshot_scale_version: null,
  result_state: null, result_numeric_value: null, result_model_id: null, result_model_version: null,
  result_provenance: null, result_confidence_state: null, result_confidence_reference: null,
  source_binding_status: null, source_instrument_id: null, source_instrument_version: null,
  source_scale_reference: null, source_scale_version: null, source_model_id: null, source_model_version: null,
});
const canonicalRows = (): HimSnapshotSourceRow[] =>
  CONVERSATION_SESSION_SLOTS.map(([metricKey, slotOrder]) => sourceRow(metricKey, slotOrder));

describe('QHIA-014A - HSE Snapshot foreground latency-safe degradation (QHIA-014 regression harness)', () => {
  const userTurn: ConversationTurn = {
    id: TURN, session_id: SESSION, role: 'USER', status: 'RECEIVED', content: 'hello',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request-1',
    created_at: 'now', updated_at: 'now', completed_at: null,
  };
  const claimed: ConversationTurn = { ...userTurn, status: 'GENERATING', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT' };
  const completedUser: ConversationTurn = { ...claimed, status: 'COMPLETED', completed_at: 'now' };
  const assistant: ConversationTurn = { ...completedUser, id: '00000000-0000-4000-8000-000000000103', role: 'ASSISTANT', content: 'response', source_turn_id: TURN, idempotency_key: null };
  const deepTurn: ConversationTurn = { ...userTurn, content: 'x'.repeat(1000) };
  const deepClaim: ConversationTurn = { ...claimed, content: deepTurn.content, processing_path: 'DEEP', routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };

  let himRepository: { readIntelligenceSnapshot: jest.Mock };
  let repository: jest.Mocked<ConversationRepository>;
  let router: jest.Mocked<ModelRouter>;
  let orchestrator: ConversationOrchestratorService;

  const dispatched = (call = 0): ModelRouterRequest => router.generate.mock.calls[call][0] as ModelRouterRequest;
  const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

  beforeEach(() => {
    himRepository = { readIntelligenceSnapshot: jest.fn().mockResolvedValue(canonicalRows()) };
    repository = {
      claimTurn: jest.fn().mockResolvedValue(claimed),
      finalizeTurn: jest.fn().mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant }),
      failTurn: jest.fn().mockResolvedValue(undefined),
      findTurn: jest.fn(), findAssistantForSource: jest.fn(), recoverExpiredGeneratingTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    router = { generate: jest.fn().mockResolvedValue({ content: 'response', routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 } }) };
    const contextBuilder = {
      build: jest.fn().mockResolvedValue([{ role: 'USER', content: 'hello' }]),
      assemble: jest.fn((messages: unknown, memoryContext: unknown[]) => ({ messages, ...(memoryContext.length ? { memoryContext } : {}) })),
    } as unknown as ContextBuilder;
    const correlation = new CorrelationService();
    orchestrator = new ConversationOrchestratorService(
      repository,
      contextBuilder,
      { evaluate: jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW' }) } as unknown as SafetyResponseGate,
      { buildTextGuidance: jest.fn().mockReturnValue('server-owned policy') } as unknown as BehavioralResponsePolicy,
      { retrieve: jest.fn().mockResolvedValue([]) } as unknown as MemoryRetrieverService,
      new HimTurnContextSelectionService(),
      // The REAL Snapshot service over a controlled repository: the QHIA-014A
      // classification is proven, never mocked away.
      new HimIntelligenceSnapshotService(himRepository as unknown as HimRepository),
      new HimReasoningConsumptionService(),
      new HimFastDeepConsumptionService(),
      new HimInteractionAdaptationService(),
      { getCurrentSelection: jest.fn().mockRejectedValue(new Error('reflection unavailable')), getCurrentIntelligence: jest.fn() } as unknown as HimContextualCurrentIntelligenceService,
      new HimSessionReflectionConsumptionService(),
      { read: jest.fn().mockRejectedValue(new Error('aggregate unavailable')) } as unknown as HimCrossContextForegroundAggregationService,
      { read: jest.fn().mockResolvedValue(undefined), consumeSourceRows: jest.fn() } as unknown as HimBrainContextService,
      { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as HypothesisReasoningContextService,
      { ground: jest.fn().mockReturnValue({ coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' }) } as unknown as RecommendationGroundingService,
      router,
      correlation,
      new TelemetryService(correlation),
    );
  });

  // -------------------------------------------------------------------------
  // The original QHIA-014 FAIL: a slow Snapshot held the foreground.
  // -------------------------------------------------------------------------

  it('BASELINE FAIL #1 - a 301 ms Snapshot dispatches at the 300 ms boundary, not at 301', async () => {
    jest.useFakeTimers();
    try {
      let releaseRead!: (rows: HimSnapshotSourceRow[]) => void;
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise((resolve) => { releaseRead = resolve; }));
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await jest.advanceTimersByTimeAsync(299);
      expect(router.generate).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatched()).not.toHaveProperty('humanIntelligence');
      // The read answers at 301 ms. It is discarded for this turn: no second
      // dispatch, no second finalization, no mutation of the sent request.
      const sent = JSON.stringify(dispatched());
      await jest.advanceTimersByTimeAsync(1);
      releaseRead(canonicalRows());
      await jest.advanceTimersByTimeAsync(0);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(dispatched())).toBe(sent);
    } finally { jest.useRealTimers(); }
  });

  it('BASELINE FAIL #2 - a 1000 ms Snapshot still dispatches at the 300 ms boundary', async () => {
    jest.useFakeTimers();
    try {
      let releaseRead!: (rows: HimSnapshotSourceRow[]) => void;
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise((resolve) => { releaseRead = resolve; }));
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await jest.advanceTimersByTimeAsync(300);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(700);
      releaseRead(canonicalRows());
      await jest.advanceTimersByTimeAsync(0);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatched()).not.toHaveProperty('humanIntelligence');
    } finally { jest.useRealTimers(); }
  });

  it('BASELINE FAIL #3 - a Snapshot pending forever never holds the foreground past 300 ms', async () => {
    jest.useFakeTimers();
    try {
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise(() => undefined));
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await jest.advanceTimersByTimeAsync(299);
      expect(router.generate).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      // The shared 5000 ms Data API transport timeout is untouched but is no
      // longer reachable as a foreground hold, and nothing fires later.
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(5000);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });

  it('BASELINE FAIL #4 - a Snapshot transport rejection degrades instead of failing the turn', async () => {
    // The exact rejection MemoryDataApiService raises for a fetch/network
    // failure or an AbortSignal transport timeout.
    himRepository.readIntelligenceSnapshot.mockRejectedValue(new ServiceUnavailableException('Memory persistence is unavailable.'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(repository.failTurn).not.toHaveBeenCalled();
    expect(dispatched()).not.toHaveProperty('humanIntelligence');
  });

  it('BASELINE FAIL #5 - combined worst case: every Human Intelligence lane unresolved still dispatches once at 300 ms', async () => {
    jest.useFakeTimers();
    try {
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise(() => undefined));
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await jest.advanceTimersByTimeAsync(299);
      expect(router.generate).not.toHaveBeenCalled();
      // 300, never 300 + 300.
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(600);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });

  // -------------------------------------------------------------------------
  // End-to-end classification through the REAL Snapshot service.
  // -------------------------------------------------------------------------

  it.each([408, 429, 502, 503, 504])('degrades end to end for the transient infrastructure status %s', async (status) => {
    himRepository.readIntelligenceSnapshot.mockRejectedValue(new MemoryDataApiError(status, { code: '57014', message: 'canceling statement due to statement timeout' }));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(repository.failTurn).not.toHaveBeenCalled();
    expect(dispatched()).not.toHaveProperty('humanIntelligence');
    // No raw upstream database text travelled anywhere near the provider.
    expect(JSON.stringify(dispatched())).not.toContain('canceling statement');
    expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 404, 409, 500])('stays fail-closed end to end for the non-transient status %s', async (status) => {
    himRepository.readIntelligenceSnapshot.mockRejectedValue(new MemoryDataApiError(status, { code: '42501', message: 'permission denied' }));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.finalizeTurn).not.toHaveBeenCalled();
    expect(repository.failTurn).toHaveBeenCalledWith(SESSION, 'user', TURN);
  });

  it('stays fail-closed end to end for the explicit database active-binding integrity failure', async () => {
    himRepository.readIntelligenceSnapshot.mockRejectedValue(new Error('HIM Intelligence Snapshot active binding integrity failure'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).toHaveBeenCalledWith(SESSION, 'user', TURN);
  });

  it('stays fail-closed end to end for a malformed Snapshot row set (projector integrity failure)', async () => {
    // A short row set is a real projector integrity failure, not a transport
    // answer, and must never be degraded into benign omission.
    himRepository.readIntelligenceSnapshot.mockResolvedValue(canonicalRows().slice(1));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).toHaveBeenCalledWith(SESSION, 'user', TURN);
  });

  it('stays fail-closed end to end for an unrecognized upstream failure', async () => {
    himRepository.readIntelligenceSnapshot.mockRejectedValue(new Error('unrecognized upstream failure'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).toHaveBeenCalledWith(SESSION, 'user', TURN);
  });

  // -------------------------------------------------------------------------
  // A Snapshot that answers in time is completely unaffected.
  // -------------------------------------------------------------------------

  it('still consumes a canonical Snapshot that answers inside the budget, through the real reasoning chain', async () => {
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
    expect(router.generate).toHaveBeenCalledTimes(1);
    const envelope = dispatched().humanIntelligence;
    expect(envelope?.sessionReasoningContext).toMatchObject({
      source: 'HIM_REASONING_CONTEXT', contextKind: 'CONVERSATION_SESSION',
      consumptionMode: 'FAST', coverageState: 'EMPTY', eligibleMetricCount: 3, knownMetricCount: 0, unknownMetricCount: 3,
    });
    // The provider-safe projection never carries the internal session UUID.
    expect(JSON.stringify(envelope)).not.toContain(SESSION);
  });

  it('launches the Snapshot in the same synchronous step as Reflection, aggregate and Brain', async () => {
    himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      await flushMicrotasks();
      // All four reads are in flight while the Snapshot is unresolved, so a
      // serialized `await snapshot; await reflection` is structurally impossible.
      expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(300);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
    } finally { jest.useRealTimers(); }
  });

  it('gives DEEP identical scheduling and identical degradation', async () => {
    repository.claimTurn.mockResolvedValue(deepClaim);
    repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
    jest.useFakeTimers();
    try {
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise(() => undefined));
      const pending = orchestrator.orchestrate('token', 'user', deepTurn);
      await jest.advanceTimersByTimeAsync(299);
      expect(router.generate).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await pending;
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(dispatched().path).toBe('DEEP');
      expect(dispatched()).not.toHaveProperty('humanIntelligence');
    } finally { jest.useRealTimers(); }
  });
});
