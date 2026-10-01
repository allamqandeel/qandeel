import { ServiceUnavailableException } from '@nestjs/common';
import {
  assertForegroundProviderBudget,
  enterForegroundTurnWork,
  FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS,
  FOREGROUND_TURN_WORK_DEADLINE_MAX_MS,
  FOREGROUND_TURN_WORK_DEADLINE_MIN_MS,
  ForegroundTurnDeadlineExceededError,
  foregroundTurnWorkDeadlineMs,
  guardForegroundBinding,
  runForegroundTurnWork,
  type ForegroundTurnWorkBegin,
} from './foreground-turn-work';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import type { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { OpenAIModelRouter } from '../model-router/providers/openai/openai-model-router';
import type { OpenAIModelRouterConfig } from '../model-router/providers/openai/openai-model-router.config';
import { resolveOpenAIModel } from '../model-router/model-profile.registry';

// PROD-SEC-02 - the request-scoped foreground work context: the deadline that stops NEW provider calls, and the
// database work lease that must be held before provider-bearing work starts.

const gateAnswering = (...answers: ForegroundTurnWorkBegin[]) => {
  const begin = jest.fn<Promise<ForegroundTurnWorkBegin>, [string, string]>();
  for (const answer of answers) begin.mockResolvedValueOnce(answer);
  return { begin, end: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined) };
};
const clock = (start = 1_000_000) => {
  let at = start;
  return { now: () => at, advance: (ms: number) => { at += ms; } };
};

describe('foregroundTurnWorkDeadlineMs - an engineering default with hard bounds', () => {
  it('defaults when unset or malformed, honours a value inside the bounds, and clamps outside them', () => {
    expect(foregroundTurnWorkDeadlineMs({})).toBe(FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS);
    for (const raw of ['', 'abc', '-5', '1e5', '90000.5', ' 60000']) {
      expect(foregroundTurnWorkDeadlineMs({ CONVERSATION_TURN_WORK_DEADLINE_MS: raw })).toBe(FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS);
    }
    expect(foregroundTurnWorkDeadlineMs({ CONVERSATION_TURN_WORK_DEADLINE_MS: '45000' })).toBe(45_000);
    expect(foregroundTurnWorkDeadlineMs({ CONVERSATION_TURN_WORK_DEADLINE_MS: '0' })).toBe(FOREGROUND_TURN_WORK_DEADLINE_MIN_MS);
    expect(foregroundTurnWorkDeadlineMs({ CONVERSATION_TURN_WORK_DEADLINE_MS: '999999999' })).toBe(FOREGROUND_TURN_WORK_DEADLINE_MAX_MS);
  });

  it('can never be configured past the database work lease: the ceiling leaves room for one in-flight call and the commits', () => {
    // The work lease is the frozen 120-second foreground lease (migration 0039, reused by 0131).
    expect(FOREGROUND_TURN_WORK_DEADLINE_MAX_MS).toBeLessThanOrEqual(120_000 - 10_000 - 10_000);
    expect(FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS).toBeLessThanOrEqual(FOREGROUND_TURN_WORK_DEADLINE_MAX_MS);
  });
});

describe('the foreground scope', () => {
  it('is inert outside a scope: background and post-response work is never limited here', async () => {
    expect(() => assertForegroundProviderBudget()).not.toThrow();
    await expect(enterForegroundTurnWork('session', 'turn')).resolves.toBe('UNSCOPED');
  });

  it('allows provider calls before the deadline and refuses every NEW one at or after it', async () => {
    const time = clock();
    await runForegroundTurnWork(gateAnswering(), 30_000, async () => {
      expect(() => assertForegroundProviderBudget()).not.toThrow();
      time.advance(29_999);
      expect(() => assertForegroundProviderBudget()).not.toThrow();
      time.advance(1);
      expect(() => assertForegroundProviderBudget()).toThrow(ForegroundTurnDeadlineExceededError);
    }, time.now);
  });

  it('takes one lease per exchange, reuses it for the rest of the request, and returns it when the request ends', async () => {
    const gate = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-1' });
    await runForegroundTurnWork(gate, 90_000, async () => {
      await expect(enterForegroundTurnWork('session', 'turn')).resolves.toBe('GRANTED');
      await expect(enterForegroundTurnWork('session', 'turn')).resolves.toBe('GRANTED');
      expect(gate.end).not.toHaveBeenCalled();
    });
    expect(gate.begin).toHaveBeenCalledTimes(1);
    expect(gate.end).toHaveBeenCalledWith('turn', 'lease-1');
  });

  it('holds nothing when the database says IN_PROGRESS or LIMITED, and asks again next time', async () => {
    const gate = gateAnswering({ outcome: 'LIMITED' }, { outcome: 'IN_PROGRESS' });
    await runForegroundTurnWork(gate, 90_000, async () => {
      await expect(enterForegroundTurnWork('session', 'turn')).resolves.toBe('LIMITED');
      await expect(enterForegroundTurnWork('session', 'turn')).resolves.toBe('IN_PROGRESS');
    });
    expect(gate.begin).toHaveBeenCalledTimes(2);
    expect(gate.end).not.toHaveBeenCalled();
  });

  it('returns its lease when the request fails, and a failed return never changes the answer', async () => {
    const failing = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-2' });
    await expect(runForegroundTurnWork(failing, 90_000, async () => {
      await enterForegroundTurnWork('session', 'turn');
      throw new Error('work failed');
    })).rejects.toThrow('work failed');
    expect(failing.end).toHaveBeenCalledWith('turn', 'lease-2');

    const unreturnable = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-3' });
    unreturnable.end.mockRejectedValue(new Error('database unavailable'));
    await expect(runForegroundTurnWork(unreturnable, 90_000, async () => {
      await enterForegroundTurnWork('session', 'turn');
      return 'answer';
    })).resolves.toBe('answer');
  });

  it('keeps concurrent requests apart: one request never sees another request\'s lease or deadline', async () => {
    const early = clock();
    const a = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-a' });
    const b = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-b' });
    await Promise.all([
      runForegroundTurnWork(a, 30_000, async () => {
        await enterForegroundTurnWork('session-a', 'turn-a');
        early.advance(30_000);
        expect(() => assertForegroundProviderBudget()).toThrow(ForegroundTurnDeadlineExceededError);
      }, early.now),
      runForegroundTurnWork(b, 90_000, async () => {
        await enterForegroundTurnWork('session-b', 'turn-b');
        expect(() => assertForegroundProviderBudget()).not.toThrow();
      }),
    ]);
    expect(a.end).toHaveBeenCalledWith('turn-a', 'lease-a');
    expect(b.end).toHaveBeenCalledWith('turn-b', 'lease-b');
  });
});

describe('the deadline stops NEW provider calls - it never races or abandons a call already in flight', () => {
  const routerConfig: OpenAIModelRouterConfig = { apiKey: 'test-only', resolveModel: resolveOpenAIModel, maxOutputTokens: 1024, timeoutMs: 10_000, maxRetries: 0 };
  const routerRequest: ModelRouterRequest = {
    task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW', behavioralGuidance: 'policy',
    context: [{ role: 'USER', content: 'hello' }], locale: 'und', modality: 'TEXT', latencyBudgetMs: 3_000,
    costBudget: 'LOW', safetyLevel: 'STANDARD',
  };
  it('the reply router opens no provider request once the deadline has passed', async () => {
    const create = jest.fn();
    const router = new OpenAIModelRouter(routerConfig, { responses: { create } });
    const time = clock();
    await runForegroundTurnWork(gateAnswering(), 30_000, async () => {
      time.advance(30_000);
      await expect(router.generate(routerRequest)).rejects.toBeInstanceOf(ForegroundTurnDeadlineExceededError);
    }, time.now);
    expect(create).not.toHaveBeenCalled();
  });

  it('a call that started before the deadline finishes normally under its own provider timeout', async () => {
    const time = clock();
    const create = jest.fn(async () => {
      time.advance(60_000); // the deadline passes while this call is in flight
      return { output_text: 'reply', usage: { input_tokens: 1, output_tokens: 1 } };
    });
    const router = new OpenAIModelRouter(routerConfig, { responses: { create } });
    await runForegroundTurnWork(gateAnswering(), 30_000, async () => {
      await expect(router.generate(routerRequest)).resolves.toMatchObject({ content: 'reply' });
    }, time.now);
    expect(create).toHaveBeenCalledTimes(1);
  });

});

describe('guardForegroundBinding - the semantic providers are guarded at their binding seam, never edited', () => {
  class CountingProvider {
    calls = 0;
    readonly label = 'counting';
    async propose(input: string): Promise<string> { this.calls += 1; return `${this.label}:${input}`; }
  }
  const binding = () => ({ provider: new CountingProvider(), providerName: 'OPENAI', providerModel: 'model-x' });

  it('delegates unchanged before the deadline, keeping the provider\'s own `this` and the binding identity', async () => {
    const guarded = guardForegroundBinding(binding)();
    await runForegroundTurnWork(gateAnswering(), 30_000, async () => {
      await expect(guarded.provider.propose('a')).resolves.toBe('counting:a');
    });
    expect(guarded.provider.calls).toBe(1);
    expect(guarded.provider.label).toBe('counting');
    expect({ name: guarded.providerName, model: guarded.providerModel }).toEqual({ name: 'OPENAI', model: 'model-x' });
  });

  it('refuses with the typed deadline error before entering the provider once the deadline has passed', async () => {
    const guarded = guardForegroundBinding(binding)();
    const time = clock();
    await runForegroundTurnWork(gateAnswering(), 30_000, async () => {
      time.advance(30_000);
      await expect(guarded.provider.propose('b')).rejects.toBeInstanceOf(ForegroundTurnDeadlineExceededError);
    }, time.now);
    expect(guarded.provider.calls).toBe(0);
  });

  it('is inert outside a foreground scope', async () => {
    const guarded = guardForegroundBinding(binding)();
    await expect(guarded.provider.propose('c')).resolves.toBe('counting:c');
  });
});

describe('the orchestrator takes the exchange\'s work lease before the generation claim', () => {
  const turn = (overrides: Partial<ConversationTurn> = {}): ConversationTurn => ({
    id: 'turn-1', session_id: 'session-1', role: 'USER', status: 'RECEIVED', content: 'hello',
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'k-1',
    created_at: 'now', updated_at: 'now', completed_at: null, ...overrides,
  });
  let repository: jest.Mocked<ConversationRepository>;
  let router: jest.Mocked<ModelRouter>;
  let orchestrator: ConversationOrchestratorService;

  beforeEach(() => {
    repository = {
      claimTurn: jest.fn().mockResolvedValue(undefined),
      findTurn: jest.fn(async () => turn()),
      findAssistantForSource: jest.fn().mockResolvedValue(undefined),
      recoverExpiredGeneratingTurn: jest.fn().mockResolvedValue(undefined),
      failTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    router = { generate: jest.fn() };
    const correlation = new CorrelationService();
    const inert = {} as never;
    orchestrator = new ConversationOrchestratorService(
      repository, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert, inert,
      router, correlation, new TelemetryService(correlation), inert,
    );
  });

  it('LIMITED: the committed turn is deferred - no claim, no provider, no failure, a retryable 503', async () => {
    const gate = gateAnswering({ outcome: 'LIMITED' });
    await expect(runForegroundTurnWork(gate, 90_000, () => orchestrator.orchestrate('token', 'user-1', turn())))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(gate.begin).toHaveBeenCalledWith('session-1', 'turn-1');
    expect(repository.claimTurn).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
    expect(repository.failTurn).not.toHaveBeenCalled();
  });

  it('IN_PROGRESS: another request owns this exchange, so this one reports canonical state and starts nothing', async () => {
    const gate = gateAnswering({ outcome: 'IN_PROGRESS' });
    await expect(runForegroundTurnWork(gate, 90_000, () => orchestrator.orchestrate('token', 'user-1', turn())))
      .resolves.toEqual({ userTurn: turn() });
    expect(repository.claimTurn).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('GRANTED: the lease is taken strictly before the claim, and returned when the request ends', async () => {
    const gate = gateAnswering({ outcome: 'GRANTED', leaseId: 'lease-9' });
    await runForegroundTurnWork(gate, 90_000, () => orchestrator.orchestrate('token', 'user-1', turn()));
    expect(repository.claimTurn).toHaveBeenCalledTimes(1);
    expect(gate.begin.mock.invocationCallOrder[0]).toBeLessThan(repository.claimTurn.mock.invocationCallOrder[0]);
    expect(gate.end).toHaveBeenCalledWith('turn-1', 'lease-9');
  });

  it('a COMPLETED or GENERATING replay is a read, never work: no lease is requested, so a poll is never refused', async () => {
    const gate = gateAnswering();
    await runForegroundTurnWork(gate, 90_000, async () => {
      await orchestrator.orchestrate('token', 'user-1', turn({ status: 'COMPLETED' }));
      await orchestrator.orchestrate('token', 'user-1', turn({ status: 'GENERATING' }));
    });
    expect(gate.begin).not.toHaveBeenCalled();
    expect(repository.claimTurn).not.toHaveBeenCalled();
  });
});
