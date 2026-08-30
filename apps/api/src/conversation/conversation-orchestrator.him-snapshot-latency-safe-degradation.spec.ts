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
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import type { QuestionForegroundSelectionService } from '../question/question-foreground-selection.service';
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
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
  const claimed: ConversationTurn = { ...userTurn, status: 'GENERATING', processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' };
  const completedUser: ConversationTurn = { ...claimed, status: 'COMPLETED', completed_at: 'now' };
  const assistant: ConversationTurn = { ...completedUser, id: '00000000-0000-4000-8000-000000000103', role: 'ASSISTANT', content: 'response', source_turn_id: TURN, idempotency_key: null };
  const deepTurn: ConversationTurn = { ...userTurn, content: 'x'.repeat(1000) };
  const deepClaim: ConversationTurn = { ...claimed, content: deepTurn.content, processing_path: 'DEEP', routing_reason: 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE' };

  let himRepository: { readIntelligenceSnapshot: jest.Mock };
  let reflectionRead: jest.Mock;
  let aggregateRead: jest.Mock;
  let brainRead: jest.Mock;
  let repository: jest.Mocked<ConversationRepository>;
  let router: jest.Mocked<ModelRouter>;
  let orchestrator: ConversationOrchestratorService;

  const dispatched = (call = 0): ModelRouterRequest => router.generate.mock.calls[call][0] as ModelRouterRequest;

  beforeEach(() => {
    himRepository = { readIntelligenceSnapshot: jest.fn().mockResolvedValue(canonicalRows()) };
    // The three independent Human Intelligence channels, held as spec-level
    // handles so individual cases - the genuine all-four-pending worst case in
    // particular - can replace their settlement behavior per test.
    reflectionRead = jest.fn().mockRejectedValue(new Error('reflection unavailable'));
    aggregateRead = jest.fn().mockRejectedValue(new Error('aggregate unavailable'));
    brainRead = jest.fn().mockResolvedValue(undefined);
    repository = {
      claimTurn: jest.fn().mockResolvedValue(claimed),
      finalizeTurn: jest.fn().mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant }),
      failTurn: jest.fn().mockResolvedValue(undefined),
      findTurn: jest.fn(), findAssistantForSource: jest.fn(), recoverExpiredGeneratingTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    router = { generate: jest.fn().mockResolvedValue({ content: 'response', routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 } }) };
    // QIR-004: the double mirrors production - it appends the SOURCE turn's own
    // content as the final USER message - because the assembler validates the
    // canonical conversation boundary and fails the turn closed on a mismatch.
    const contextBuilder = {
      build: jest.fn().mockImplementation((_accessToken: string, _userId: string, sourceTurn: { content: string }) =>
        Promise.resolve([{ role: 'USER', content: sourceTurn.content }])),
    } as unknown as ContextBuilder;
    const correlation = new CorrelationService();
    const telemetry = new TelemetryService(correlation);
    // QIR-003: the REAL bounded Memory + Hypothesis gatherer over this spec's
    // immediate doubles - the two sources settle instantly, so every timing
    // proof below still measures ONLY the Human Intelligence lane.
    const foregroundGatherer = new BoundedForegroundIntelligenceGathererService(
      { retrieve: jest.fn().mockResolvedValue([]) } as unknown as MemoryRetrieverService,
      { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as HypothesisReasoningContextService,
      correlation,
      telemetry,
    );
    orchestrator = new ConversationOrchestratorService(
      repository,
      contextBuilder,
      { evaluate: jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW' }) } as unknown as SafetyResponseGate,
      { buildTextGuidance: jest.fn().mockReturnValue('server-owned policy') } as unknown as BehavioralResponsePolicy,
      new HimTurnContextSelectionService(),
      // The REAL Snapshot service over a controlled repository: the QHIA-014A
      // classification is proven, never mocked away.
      new HimIntelligenceSnapshotService(himRepository as unknown as HimRepository),
      new HimReasoningConsumptionService(),
      new HimFastDeepConsumptionService(),
      new HimInteractionAdaptationService(),
      { getCurrentSelection: reflectionRead, getCurrentIntelligence: jest.fn() } as unknown as HimContextualCurrentIntelligenceService,
      new HimSessionReflectionConsumptionService(),
      { read: aggregateRead } as unknown as HimCrossContextForegroundAggregationService,
      { read: brainRead, consumeSourceRows: jest.fn() } as unknown as HimBrainContextService,
      foregroundGatherer,
      // QIR-006: an instantly-empty Question selection double, so every timing
      // proof below still measures ONLY the Human Intelligence lane and no
      // extra timer ever enters the fake-timer accounting.
      { select: jest.fn().mockResolvedValue({ state: 'LEGITIMATE_EMPTY', reason: 'NO_ELIGIBLE_GAP' }) } as unknown as QuestionForegroundSelectionService,
      // QIR-004: the REAL assembler, so this QHIA-014A remediation proof keeps
      // running against the production provider-request assembly boundary.
      new IntegratedContextBudgetAssemblerService(telemetry),
      { ground: jest.fn().mockReturnValue({ coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' }) } as unknown as RecommendationGroundingService,
      router,
      correlation,
      telemetry,
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
    // QHIA-014 proof closure: the GENUINE all-four-pending worst case. Every
    // one of the four foreground Human Intelligence reads - Snapshot,
    // Reflection, aggregate-v3 AND Brain Context - is a controlled promise that
    // stays pending forever. Reflection and aggregate do NOT reject
    // immediately, and Brain does NOT resolve undefined: nothing settles until
    // this test settles it, long after dispatch.
    jest.useFakeTimers();
    try {
      let releaseSnapshot!: (rows: HimSnapshotSourceRow[]) => void;
      let rejectReflection!: (error: Error) => void;
      let resolveAggregate!: (value: unknown) => void;
      let rejectBrain!: (error: Error) => void;
      himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise((resolve) => { releaseSnapshot = resolve; }));
      reflectionRead.mockReturnValue(new Promise((_resolve, reject) => { rejectReflection = reject; }));
      aggregateRead.mockReturnValue(new Promise((resolve) => { resolveAggregate = resolve; }));
      brainRead.mockReturnValue(new Promise((_resolve, reject) => { rejectBrain = reject; }));
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      // Flush microtasks WITHOUT advancing the clock, then prove all four read
      // functions are ALREADY in flight, exactly once each, BEFORE any fake
      // time advances: the four launches share one synchronous step, so no
      // read can be a consequence of another read settling.
      await jest.advanceTimersByTimeAsync(0);
      expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
      expect(reflectionRead).toHaveBeenCalledTimes(1);
      expect(aggregateRead).toHaveBeenCalledTimes(1);
      expect(brainRead).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(299);
      expect(router.generate).not.toHaveBeenCalled();
      // 300, never 300 + 300.
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ userTurn: completedUser, assistantTurn: assistant });
      expect(router.generate).toHaveBeenCalledTimes(1);
      // Every channel was still unresolved at dispatch, so none contributes:
      // the one provider request carries no Human Intelligence envelope at all.
      expect(dispatched()).not.toHaveProperty('humanIntelligence');
      const sent = JSON.stringify(dispatched());
      await jest.advanceTimersByTimeAsync(600);
      expect(router.generate).toHaveBeenCalledTimes(1);
      // Much later: still exactly one provider call and one finalization, and
      // no read was ever relaunched as a retry or fallback.
      await jest.advanceTimersByTimeAsync(59_100);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
      expect(reflectionRead).toHaveBeenCalledTimes(1);
      expect(aggregateRead).toHaveBeenCalledTimes(1);
      expect(brainRead).toHaveBeenCalledTimes(1);
      // Combined late-settlement isolation: settle the four old promises in a
      // deliberately mixed success/rejection order. Nothing may mutate the
      // dispatched request, trigger a second provider call, or re-finalize.
      rejectReflection(new Error('late reflection rejection'));
      await jest.advanceTimersByTimeAsync(0);
      resolveAggregate({ situationStress: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' } });
      await jest.advanceTimersByTimeAsync(0);
      releaseSnapshot(canonicalRows());
      await jest.advanceTimersByTimeAsync(0);
      rejectBrain(new Error('late brain rejection'));
      await jest.advanceTimersByTimeAsync(0);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.finalizeTurn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(dispatched())).toBe(sent);
      expect(jest.getTimerCount()).toBe(0);
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
    // QHIA-014 proof closure: the concurrent-launch proof covers ALL FOUR
    // reads, not just the Snapshot. Every channel is a controlled pending
    // promise, so nothing has settled when the call counts are asserted:
    // launch cannot be a consequence of any settlement.
    himRepository.readIntelligenceSnapshot.mockReturnValue(new Promise(() => undefined));
    reflectionRead.mockReturnValue(new Promise(() => undefined));
    aggregateRead.mockReturnValue(new Promise(() => undefined));
    brainRead.mockReturnValue(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      const pending = orchestrator.orchestrate('token', 'user', userTurn);
      // Flush the microtask queue WITHOUT advancing the clock: Jest's modern
      // fake timers also fake setImmediate, so a setImmediate flush would never
      // resolve here.
      await jest.advanceTimersByTimeAsync(0);
      // All four reads are in flight - exactly once each - while every one of
      // them is still unresolved, so a serialized `await snapshot; await
      // reflection` (or any read launched by another read's settlement) is
      // structurally impossible.
      expect(himRepository.readIntelligenceSnapshot).toHaveBeenCalledTimes(1);
      expect(reflectionRead).toHaveBeenCalledTimes(1);
      expect(aggregateRead).toHaveBeenCalledTimes(1);
      expect(brainRead).toHaveBeenCalledTimes(1);
      expect(router.generate).not.toHaveBeenCalled();
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
