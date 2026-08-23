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
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';

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
  let hypothesisContext: jest.Mocked<HypothesisReasoningContextService>;
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

  beforeEach(() => {
    repository = {
      claimTurn: jest.fn(), finalizeTurn: jest.fn(), failTurn: jest.fn(), findTurn: jest.fn(),
      findAssistantForSource: jest.fn(),
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
    hypothesisContext = { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as jest.Mocked<HypothesisReasoningContextService>;
    behavioralPolicy = { buildTextGuidance: jest.fn().mockReturnValue('server-owned policy') };
    safetyGate = { evaluate: jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW' }) };
    const correlation=new CorrelationService();
    orchestrator = new ConversationOrchestratorService(repository, contextBuilder, safetyGate, behavioralPolicy, memoryRetriever, memoryWriter, himSelector, himSnapshot, himBridge, himConsumptionPolicy, hypothesisContext, router,correlation,new TelemetryService(correlation));
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
    expect(memoryWriter.evaluateAndWrite).toHaveBeenCalledWith('user', 'token', 'hello');
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({
      modality: 'TEXT', path: 'FAST', behavioralGuidance: 'server-owned policy',
      context: [{ role: 'USER', content: 'hello' }], himContext,
    }));
    expect(behavioralPolicy.buildTextGuidance).toHaveBeenCalledTimes(1);
    expect(await orchestrator.orchestrate('token', 'user', completedUser)).toEqual({ userTurn: completedUser });
  });

  it('uses Fast by default with an explicit default reason', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('token', 'session', 'user', 'user-turn', { path: 'FAST', reason: 'FAST_DEFAULT' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'FAST', himContext }));
  });

  it('selects Deep only with the deterministic input-size reason', async () => {
    const deepTurn = { ...userTurn, content: 'x'.repeat(1000) };
    const deepClaim = { ...claimed, content: deepTurn.content, processing_path: 'DEEP' as const, routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' };
    repository.claimTurn.mockResolvedValue(deepClaim);
    repository.finalizeTurn.mockResolvedValue({ userTurn: { ...deepClaim, status: 'COMPLETED' }, assistantTurn: { ...assistant, processing_path: 'DEEP' } });
    await orchestrator.orchestrate('token', 'user', deepTurn);
    expect(repository.claimTurn).toHaveBeenCalledWith('token', 'session', 'user', 'user-turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ path: 'DEEP', complexity: 'HIGH', himContext: expect.objectContaining({ consumptionMode: 'DEEP', contextId: 'session' }) }));
    expect(router.generate.mock.calls[0][0]).not.toHaveProperty('trend');
  });

  it('terminalizes the source turn safely when the router fails', async () => {
    repository.claimTurn.mockResolvedValue(claimed);
    router.generate.mockRejectedValue(new Error('private provider detail'));
    await expect(orchestrator.orchestrate('token', 'user', userTurn)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.failTurn).toHaveBeenCalledWith('token', 'session', 'user', 'user-turn');
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
    expect(hypothesisContext.build).not.toHaveBeenCalled();
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
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
    expect(himSelector.select).not.toHaveBeenCalled();
    expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
    expect(himBridge.transform).not.toHaveBeenCalled();
    expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
    expect(hypothesisContext.build).not.toHaveBeenCalled();
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
  });

  it('skips automatic writes for GUIDED safety content', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: 'server safety guidance',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
    expect(memoryWriter.evaluateAndWrite).not.toHaveBeenCalled();
  });

  it('carries GUIDED safety separately and invokes the provider exactly once', async () => {
    safetyGate.evaluate.mockReturnValue({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: 'server safety guidance',
    });
    repository.claimTurn.mockResolvedValue(claimed);
    repository.finalizeTurn.mockResolvedValue({ userTurn: completedUser, assistantTurn: assistant });
    await orchestrator.orchestrate('token', 'user', userTurn);
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
    expect(repository.failTurn).toHaveBeenCalledWith('token', 'session', 'user', 'user-turn');
  });

  it('performs zero HIM calls for the COMPLETED early-return path', async () => {
    repository.findTurn.mockResolvedValue(completedUser);
    repository.findAssistantForSource.mockResolvedValue(assistant);
    await orchestrator.orchestrate('token', 'user', completedUser);
    expect(himSelector.select).not.toHaveBeenCalled();
    expect(himSnapshot.getSnapshot).not.toHaveBeenCalled();
    expect(himBridge.transform).not.toHaveBeenCalled();
    expect(himConsumptionPolicy.project).not.toHaveBeenCalled();
    expect(hypothesisContext.build).not.toHaveBeenCalled();
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
});
