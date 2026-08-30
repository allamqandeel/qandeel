import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { BoundedForegroundIntelligenceGathererService } from './bounded-foreground-intelligence-gatherer.service';
import { QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS } from './bounded-foreground-intelligence-gatherer.types';
import { MemoryRetrieverService } from '../memory/memory-retriever.service';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import { HypothesisReasoningInvariantError, type HypothesisReasoningContextResult } from '../hypothesis/hypothesis-reasoning-context.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';

// QIR-003 focused gatherer proof. Every timing case runs on deterministic
// deferred promises and Jest fake timers - no wall-clock sleeps - and every
// classification case exercises the REAL classifier over the real service
// boundary types.
describe('BoundedForegroundIntelligenceGathererService (QIR-003)', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
  const memoryValue = [{ type: 'GOAL', content: 'Leave my job', source: 'USER_STATED' }] as const;
  const emptyHypothesis: HypothesisReasoningContextResult = { coverageState: 'EMPTY', candidateHypothesisCount: 0 };
  const availableHypothesis: HypothesisReasoningContextResult = {
    coverageState: 'AVAILABLE',
    context: {
      contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', coverageState: 'AVAILABLE',
      candidateHypothesisCount: 1, includedHypothesisCount: 1, truncated: false, hypotheses: [],
    },
  };

  let memoryRetriever: jest.Mocked<MemoryRetrieverService>;
  let hypothesisContext: jest.Mocked<HypothesisReasoningContextService>;
  let correlation: CorrelationService;
  let telemetry: TelemetryService;
  let recordSource: jest.SpyInstance;
  let recordHypothesisContext: jest.SpyInstance;
  let gatherer: BoundedForegroundIntelligenceGathererService;

  const gather = (path: 'FAST' | 'DEEP' = 'FAST') =>
    gatherer.gather({ userId: 'user', accessToken: 'token', content: 'hello', path });

  beforeEach(() => {
    memoryRetriever = { retrieve: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryRetrieverService>;
    hypothesisContext = { build: jest.fn().mockResolvedValue(emptyHypothesis) } as unknown as jest.Mocked<HypothesisReasoningContextService>;
    correlation = new CorrelationService();
    telemetry = new TelemetryService(correlation);
    recordSource = jest.spyOn(telemetry, 'recordForegroundIntelligenceSource');
    recordHypothesisContext = jest.spyOn(telemetry, 'recordHypothesisContext');
    gatherer = new BoundedForegroundIntelligenceGathererService(memoryRetriever, hypothesisContext, correlation, telemetry);
  });

  describe('concurrent launch (no serial Memory -> Hypothesis stage)', () => {
    it('launches BOTH source reads synchronously before either settles, and never re-issues either read', async () => {
      const memory = deferred<never[]>();
      const hypothesis = deferred<HypothesisReasoningContextResult>();
      memoryRetriever.retrieve.mockReturnValue(memory.promise);
      hypothesisContext.build.mockReturnValue(hypothesis.promise);
      const pending = gather();
      // Drain only microtasks: no deferred has been resolved, yet both reads
      // have already been issued - Hypothesis never waits behind Memory.
      await Promise.resolve(); await Promise.resolve();
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(memoryRetriever.retrieve).toHaveBeenCalledWith('user', 'token', 'hello');
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledWith('user', 'token');
      hypothesis.resolve(emptyHypothesis);
      memory.resolve([]);
      await expect(pending).resolves.toEqual({ memory: { state: 'LEGITIMATE_EMPTY' }, hypothesis: { state: 'LEGITIMATE_EMPTY', value: emptyHypothesis } });
      expect(memoryRetriever.retrieve).toHaveBeenCalledTimes(1);
      expect(hypothesisContext.build).toHaveBeenCalledTimes(1);
    });

    it('settles at the slower source, not their sum: Hypothesis may finish first and Memory later', async () => {
      const memory = deferred<typeof memoryValue>();
      memoryRetriever.retrieve.mockReturnValue(memory.promise as never);
      hypothesisContext.build.mockResolvedValue(availableHypothesis);
      const settled = jest.fn();
      const pending = gather().then((result) => { settled(); return result; });
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();
      memory.resolve(memoryValue);
      await expect(pending).resolves.toEqual({
        memory: { state: 'AVAILABLE', value: memoryValue },
        hypothesis: { state: 'AVAILABLE', value: availableHypothesis },
      });
    });
  });

  describe('Memory outcome classification', () => {
    it('classifies a successful zero-memory selection (cue gate off or zero selected) as LEGITIMATE_EMPTY', async () => {
      memoryRetriever.retrieve.mockResolvedValue([]);
      const { memory } = await gather();
      expect(memory).toEqual({ state: 'LEGITIMATE_EMPTY' });
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'LEGITIMATE_EMPTY', 'FAST');
    });

    it('classifies a successful non-empty selection as AVAILABLE carrying the exact retrieved value', async () => {
      memoryRetriever.retrieve.mockResolvedValue(memoryValue as never);
      const { memory } = await gather();
      expect(memory.state).toBe('AVAILABLE');
      expect(memory.state === 'AVAILABLE' && memory.value).toBe(memoryValue);
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'AVAILABLE', 'FAST');
    });

    it('classifies a ServiceUnavailableException from the canonical transport/configuration path as OPTIONAL_AVAILABILITY_FAILURE', async () => {
      memoryRetriever.retrieve.mockRejectedValue(new ServiceUnavailableException('Memory persistence is unavailable.'));
      const { memory } = await gather();
      expect(memory).toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'OPTIONAL_AVAILABILITY_FAILURE', 'FAST');
    });

    it.each([408, 429, 500, 503, 599])('classifies MemoryDataApiError status %s as OPTIONAL_AVAILABILITY_FAILURE', async (status) => {
      memoryRetriever.retrieve.mockRejectedValue(new MemoryDataApiError(status));
      const { memory } = await gather();
      expect(memory).toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
    });

    it.each([400, 401, 403, 404, 409, 422])('fails CLOSED on MemoryDataApiError status %s with the original error', async (status) => {
      const error = new MemoryDataApiError(status);
      memoryRetriever.retrieve.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'HARD_FAILURE', 'FAST');
    });

    it('fails CLOSED on an unexpected error type with the original error - the default is hard fail', async () => {
      const error = new ForbiddenException('not an approved availability failure');
      memoryRetriever.retrieve.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
    });

    it('fails CLOSED on a malformed non-array Memory result instead of degrading it', async () => {
      memoryRetriever.retrieve.mockResolvedValue({ not: 'an array' } as never);
      await expect(gather()).rejects.toThrow('QIR_FOREGROUND_INTELLIGENCE_MALFORMED_RESULT');
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'HARD_FAILURE', 'FAST');
    });
  });

  describe('Hypothesis outcome classification', () => {
    it('classifies the canonical EMPTY coverage result as LEGITIMATE_EMPTY carrying the exact result', async () => {
      hypothesisContext.build.mockResolvedValue(emptyHypothesis);
      const { hypothesis } = await gather();
      expect(hypothesis.state).toBe('LEGITIMATE_EMPTY');
      expect(hypothesis.state === 'LEGITIMATE_EMPTY' && hypothesis.value).toBe(emptyHypothesis);
      expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'LEGITIMATE_EMPTY', 'FAST');
    });

    it('classifies the canonical AVAILABLE result as AVAILABLE carrying the exact result', async () => {
      hypothesisContext.build.mockResolvedValue(availableHypothesis);
      const { hypothesis } = await gather();
      expect(hypothesis.state).toBe('AVAILABLE');
      expect(hypothesis.state === 'AVAILABLE' && hypothesis.value).toBe(availableHypothesis);
      expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'AVAILABLE', 'FAST');
    });

    it('classifies approved transport availability failures as OPTIONAL_AVAILABILITY_FAILURE', async () => {
      hypothesisContext.build.mockRejectedValue(new ServiceUnavailableException('Memory persistence is not configured.'));
      expect((await gather()).hypothesis).toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
      hypothesisContext.build.mockRejectedValue(new MemoryDataApiError(429));
      expect((await gather()).hypothesis).toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
      expect(recordHypothesisContext).not.toHaveBeenCalled();
    });

    it('fails CLOSED on HypothesisReasoningInvariantError and records the pre-existing rejected outcome', async () => {
      const error = new HypothesisReasoningInvariantError();
      hypothesisContext.build.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
      expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'HARD_FAILURE', 'FAST');
      expect(recordHypothesisContext).toHaveBeenCalledTimes(1);
      expect(recordHypothesisContext).toHaveBeenCalledWith('rejected', 'FAST');
    });

    it('fails CLOSED on an unexpected error and records the pre-existing failed outcome', async () => {
      const error = new Error('private query failure');
      hypothesisContext.build.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
      expect(recordHypothesisContext).toHaveBeenCalledTimes(1);
      expect(recordHypothesisContext).toHaveBeenCalledWith('failed', 'FAST');
    });

    it.each([401, 403])('fails CLOSED on MemoryDataApiError status %s from the Hypothesis read', async (status) => {
      const error = new MemoryDataApiError(status);
      hypothesisContext.build.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
    });

    it.each([
      ['a null result', null],
      ['a non-object result', 'EMPTY'],
      ['an unknown coverage state', { coverageState: 'PARTIAL' }],
      ['EMPTY with a nonzero candidate count', { coverageState: 'EMPTY', candidateHypothesisCount: 2 }],
      ['AVAILABLE without a context object', { coverageState: 'AVAILABLE' }],
      ['AVAILABLE with mismatched inner coverage', { coverageState: 'AVAILABLE', context: { coverageState: 'EMPTY' } }],
    ])('fails CLOSED on a malformed Hypothesis result (%s) - never a fabricated EMPTY', async (_label, malformed) => {
      hypothesisContext.build.mockResolvedValue(malformed as never);
      await expect(gather()).rejects.toThrow('QIR_FOREGROUND_INTELLIGENCE_MALFORMED_RESULT');
      expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'HARD_FAILURE', 'FAST');
    });
  });

  describe('ONE shared 5000 ms foreground deadline', () => {
    it('expires a still-pending source at exactly the shared deadline - not one tick before', async () => {
      jest.useFakeTimers();
      try {
        memoryRetriever.retrieve.mockReturnValue(new Promise(() => undefined));
        hypothesisContext.build.mockResolvedValue(emptyHypothesis);
        const settled = jest.fn();
        const pending = gather().then((result) => { settled(); return result; });
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS - 1);
        expect(settled).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({
          memory: { state: 'FOREGROUND_BUDGET_EXPIRY' },
          hypothesis: { state: 'LEGITIMATE_EMPTY', value: emptyHypothesis },
        });
        expect(recordSource).toHaveBeenCalledWith('MEMORY', 'FOREGROUND_BUDGET_EXPIRY', 'FAST');
      } finally { jest.useRealTimers(); }
    });

    it('lets Hypothesis succeed while Memory expires on the same shared deadline', async () => {
      jest.useFakeTimers();
      try {
        const hypothesis = deferred<HypothesisReasoningContextResult>();
        memoryRetriever.retrieve.mockReturnValue(new Promise(() => undefined));
        hypothesisContext.build.mockReturnValue(hypothesis.promise);
        const pending = gather();
        await jest.advanceTimersByTimeAsync(4000);
        hypothesis.resolve(availableHypothesis);
        await jest.advanceTimersByTimeAsync(1000);
        await expect(pending).resolves.toEqual({
          memory: { state: 'FOREGROUND_BUDGET_EXPIRY' },
          hypothesis: { state: 'AVAILABLE', value: availableHypothesis },
        });
      } finally { jest.useRealTimers(); }
    });

    it('lets Memory succeed while Hypothesis expires on the same shared deadline', async () => {
      jest.useFakeTimers();
      try {
        const memory = deferred<typeof memoryValue>();
        memoryRetriever.retrieve.mockReturnValue(memory.promise as never);
        hypothesisContext.build.mockReturnValue(new Promise(() => undefined));
        const pending = gather();
        await jest.advanceTimersByTimeAsync(2500);
        memory.resolve(memoryValue);
        await jest.advanceTimersByTimeAsync(2500);
        await expect(pending).resolves.toEqual({
          memory: { state: 'AVAILABLE', value: memoryValue },
          hypothesis: { state: 'FOREGROUND_BUDGET_EXPIRY' },
        });
        expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'FOREGROUND_BUDGET_EXPIRY', 'FAST');
      } finally { jest.useRealTimers(); }
    });

    it('expires BOTH sources together at the one shared deadline', async () => {
      jest.useFakeTimers();
      try {
        memoryRetriever.retrieve.mockReturnValue(new Promise(() => undefined));
        hypothesisContext.build.mockReturnValue(new Promise(() => undefined));
        const pending = gather();
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        await expect(pending).resolves.toEqual({
          memory: { state: 'FOREGROUND_BUDGET_EXPIRY' },
          hypothesis: { state: 'FOREGROUND_BUDGET_EXPIRY' },
        });
      } finally { jest.useRealTimers(); }
    });

    it('never grants a second window: a source settling late in the window does NOT restart 5000 ms for the other', async () => {
      jest.useFakeTimers();
      try {
        const memory = deferred<never[]>();
        memoryRetriever.retrieve.mockReturnValue(memory.promise);
        hypothesisContext.build.mockReturnValue(new Promise(() => undefined));
        const pending = gather();
        await jest.advanceTimersByTimeAsync(4999);
        memory.resolve([]);
        // ONE tick later the ORIGINAL absolute deadline fires: the pending
        // Hypothesis expires at 5000, never at 4999 + 5000.
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({
          memory: { state: 'LEGITIMATE_EMPTY' },
          hypothesis: { state: 'FOREGROUND_BUDGET_EXPIRY' },
        });
      } finally { jest.useRealTimers(); }
    });

    it('creates exactly ONE timer per gather and clears it when both sources settle fast (no timer leak)', async () => {
      jest.useFakeTimers();
      try {
        const pending = gather();
        expect(jest.getTimerCount()).toBe(1);
        await expect(pending).resolves.toEqual({
          memory: { state: 'LEGITIMATE_EMPTY' },
          hypothesis: { state: 'LEGITIMATE_EMPTY', value: emptyHypothesis },
        });
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });

    it('discards a late fulfillment: the expired outcome is immutable and no metric is re-emitted', async () => {
      jest.useFakeTimers();
      try {
        const memory = deferred<typeof memoryValue>();
        memoryRetriever.retrieve.mockReturnValue(memory.promise as never);
        const pending = gather();
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        const result = await pending;
        expect(result.memory).toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
        const memoryEmissions = () => recordSource.mock.calls.filter(([source]) => source === 'MEMORY');
        expect(memoryEmissions()).toEqual([['MEMORY', 'FOREGROUND_BUDGET_EXPIRY', 'FAST']]);
        memory.resolve(memoryValue);
        await jest.advanceTimersByTimeAsync(0);
        expect(result.memory).toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
        expect(memoryEmissions()).toEqual([['MEMORY', 'FOREGROUND_BUDGET_EXPIRY', 'FAST']]);
      } finally { jest.useRealTimers(); }
    });

    it('absorbs a late rejection after expiry: handlers stay attached and nothing becomes unhandled', async () => {
      jest.useFakeTimers();
      try {
        const hypothesis = deferred<HypothesisReasoningContextResult>();
        hypothesisContext.build.mockReturnValue(hypothesis.promise);
        const pending = gather();
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        const result = await pending;
        expect(result.hypothesis).toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
        hypothesis.reject(new HypothesisReasoningInvariantError());
        await jest.advanceTimersByTimeAsync(0);
        expect(result.hypothesis).toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
        // The late hard failure is DISCARDED for this turn: no HARD_FAILURE
        // metric and no rejected/failed hypothesis-context outcome after the
        // deadline already classified this source as expired.
        expect(recordSource.mock.calls.filter(([source]) => source === 'HYPOTHESIS'))
          .toEqual([['HYPOTHESIS', 'FOREGROUND_BUDGET_EXPIRY', 'FAST']]);
        expect(recordHypothesisContext).not.toHaveBeenCalled();
      } finally { jest.useRealTimers(); }
    });

    it('fails fast on a hard failure while the other source is still pending, keeping its handlers attached', async () => {
      jest.useFakeTimers();
      try {
        const memory = deferred<never[]>();
        memoryRetriever.retrieve.mockReturnValue(memory.promise);
        const error = new HypothesisReasoningInvariantError();
        hypothesisContext.build.mockRejectedValue(error);
        await expect(gather()).rejects.toBe(error);
        // The still-pending Memory read settles later and is safely absorbed.
        memory.reject(new Error('late private memory failure'));
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
        expect(jest.getTimerCount()).toBe(0);
      } finally { jest.useRealTimers(); }
    });
  });

  describe('bounded fail-soft telemetry', () => {
    it('emits exactly one outcome per source per gather with the DEEP processing path when routed DEEP', async () => {
      memoryRetriever.retrieve.mockResolvedValue(memoryValue as never);
      hypothesisContext.build.mockResolvedValue(availableHypothesis);
      await gather('DEEP');
      expect(recordSource).toHaveBeenCalledTimes(2);
      expect(recordSource).toHaveBeenCalledWith('MEMORY', 'AVAILABLE', 'DEEP');
      expect(recordSource).toHaveBeenCalledWith('HYPOTHESIS', 'AVAILABLE', 'DEEP');
    });

    it('never lets a throwing telemetry sink alter a gather outcome (fail-soft)', async () => {
      recordSource.mockImplementation(() => { throw new Error('telemetry sink down'); });
      recordHypothesisContext.mockImplementation(() => { throw new Error('telemetry sink down'); });
      memoryRetriever.retrieve.mockResolvedValue(memoryValue as never);
      hypothesisContext.build.mockResolvedValue(availableHypothesis);
      await expect(gather()).resolves.toEqual({
        memory: { state: 'AVAILABLE', value: memoryValue },
        hypothesis: { state: 'AVAILABLE', value: availableHypothesis },
      });
      const error = new HypothesisReasoningInvariantError();
      hypothesisContext.build.mockRejectedValue(error);
      await expect(gather()).rejects.toBe(error);
    });

    it('runs both reads inside their pre-existing engine spans under correlation', async () => {
      const withEngine = jest.spyOn(telemetry, 'withEngine');
      await correlation.runRequest(() => gather());
      const engines = withEngine.mock.calls.map(([name]) => name);
      expect(engines).toContain('memory_retrieval');
      expect(engines).toContain('hypothesis_context');
    });
  });
});
