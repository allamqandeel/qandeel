import { ServiceUnavailableException } from '@nestjs/common';
import { AiUsageOperationsWorker, parseAiUsageOperationsSummary } from './ai-usage-operations.worker';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { TelemetryService } from '../observability/telemetry.service';
import { CorrelationService } from '../observability/correlation.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

const ROW = {
  pending_calls: 2, stale_pending_calls: 1, stale_pending_oldest_age_seconds: 420, settled_calls_24h: '30', failed_calls_24h: 3,
  cancelled_calls_24h: 0, usage_unknown_calls_24h: 4, rated_calls_24h: 0, unpriced_calls_24h: 26,
};

describe('AI-COST-01 accounting operations visibility', () => {
  it('reads exactly one aggregate row of non-negative whole numbers', () => {
    expect(parseAiUsageOperationsSummary([ROW])).toEqual({
      pendingCalls: 2, stalePendingCalls: 1, stalePendingOldestAgeSeconds: 420, settledCalls24h: 30, failedCalls24h: 3,
      cancelledCalls24h: 0, usageUnknownCalls24h: 4, ratedCalls24h: 0, unpricedCalls24h: 26,
    });
    for (const bad of [[], [ROW, ROW], [{ ...ROW, pending_calls: -1 }], [{ ...ROW, rated_calls_24h: 1.5 }], [{ ...ROW, unpriced_calls_24h: undefined }], null]) {
      expect(() => parseAiUsageOperationsSummary(bad)).toThrow('AI_USAGE_SUMMARY_INTEGRITY');
    }
  });

  function scanHarness(rpc: jest.Mock) {
    const telemetry = { recordAiUsageOperationsState: jest.fn(), recordOperationalOutcome: jest.fn() };
    const worker = new AiUsageOperationsWorker({ rpc } as unknown as SupabaseServiceRoleApiService, telemetry as unknown as TelemetryService);
    return { worker, telemetry };
  }

  it('a successful scan emits the success outcome and the stale (crash-left, unknown-cost) and unknown / unpriced gauges', async () => {
    const { worker, telemetry } = scanHarness(jest.fn().mockResolvedValueOnce([ROW]));
    await worker.runOnce();
    expect(telemetry.recordOperationalOutcome.mock.calls).toEqual([['AI_USAGE_ACCOUNTING', 'operations_scan', 'success']]);
    const calls = telemetry.recordAiUsageOperationsState.mock.calls;
    expect(calls).toHaveLength(8);
    expect(calls).toContainEqual(['stale_pending', 1, 420]);
    expect(calls).toContainEqual(['usage_unknown_24h', 4]);
    expect(calls).toContainEqual(['unpriced_24h', 26]);
  });

  it.each([
    ['an unconfigured or unreachable server channel', new ServiceUnavailableException('connect ECONNREFUSED 10.0.0.7:5432'), 'transport_failure'],
    ['a Data API 503', new DataApiError(503), 'transport_failure'],
    ['a fetch timeout', Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }), 'transport_failure'],
    ['a Data API 4xx refusal', new DataApiError(400), 'integrity_failure'],
  ])('%s is a fail-soft, visible %s with no gauge, retried on the next cycle', async (_case, error, outcome) => {
    const rpc = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce([ROW]);
    const { worker, telemetry } = scanHarness(rpc);
    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(telemetry.recordOperationalOutcome.mock.calls).toEqual([['AI_USAGE_ACCOUNTING', 'operations_scan', outcome]]);
    expect(telemetry.recordAiUsageOperationsState).not.toHaveBeenCalled();
    await worker.runOnce();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(telemetry.recordOperationalOutcome).toHaveBeenLastCalledWith('AI_USAGE_ACCOUNTING', 'operations_scan', 'success');
  });

  it.each([[[]], [[ROW, ROW]], [[{ ...ROW, pending_calls: -1 }]], [null], ['<html>502</html>']])(
    'a malformed answer %j is a fail-soft, visible integrity_failure with no gauge', async (answer) => {
      const { worker, telemetry } = scanHarness(jest.fn().mockResolvedValueOnce(answer));
      await expect(worker.runOnce()).resolves.toBeUndefined();
      expect(telemetry.recordOperationalOutcome.mock.calls).toEqual([['AI_USAGE_ACCOUNTING', 'operations_scan', 'integrity_failure']]);
      expect(telemetry.recordAiUsageOperationsState).not.toHaveBeenCalled();
    });

  it('a throwing telemetry object fails nothing and is never counted as a failed scan', async () => {
    const rpc = jest.fn().mockResolvedValue([ROW]);
    const { worker, telemetry } = scanHarness(rpc);
    telemetry.recordOperationalOutcome.mockImplementation(() => { throw new Error('exporter down'); });
    telemetry.recordAiUsageOperationsState.mockImplementation(() => { throw new Error('exporter down'); });
    await expect(worker.runOnce()).resolves.toBeUndefined();
    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('server_read_ai_usage_operations_summary_v1', {});
    expect(telemetry.recordOperationalOutcome.mock.calls.every(([, , outcome]) => outcome === 'success')).toBe(true);
  });

  it('no error text, database code, URL or identity reaches telemetry on any path', async () => {
    const secret = Object.assign(new DataApiError(409, undefined), { message: '23505 duplicate key user 11111111-1111-4111-8111-111111111111' });
    const { worker, telemetry } = scanHarness(jest.fn().mockRejectedValueOnce(secret).mockRejectedValueOnce(new TypeError('fetch failed https://x.supabase.co', { cause: new Error('ECONNRESET') })).mockResolvedValueOnce([ROW]));
    for (let i = 0; i < 3; i += 1) await worker.runOnce();
    const emitted = JSON.stringify([telemetry.recordOperationalOutcome.mock.calls, telemetry.recordAiUsageOperationsState.mock.calls]);
    expect(emitted).not.toMatch(/23505|duplicate|1111|supabase|ECONN|fetch|user|session|turn|model/u);
    expect(telemetry.recordOperationalOutcome.mock.calls.map(([, , outcome]) => outcome)).toEqual(['integrity_failure', 'transport_failure', 'success']);
    for (const call of telemetry.recordOperationalOutcome.mock.calls) expect(call).toHaveLength(3);
  });

  it('is disabled under tests and without the server channel', () => {
    const worker = new AiUsageOperationsWorker({ rpc: jest.fn() } as unknown as SupabaseServiceRoleApiService, {} as TelemetryService);
    expect(worker.enabled).toBe(false);
  });
});

describe('AI-COST-01 telemetry: closed labels, no identity, unknown never zero', () => {
  function instrumented() {
    const t = new TelemetryService(new CorrelationService());
    const sinks = { calls: jest.fn(), tokens: jest.fn(), accounting: jest.fn(), state: jest.fn(), age: jest.fn() };
    Object.assign(t as unknown as Record<string, unknown>, {
      aiUsageProviderCalls: { add: sinks.calls }, aiUsageTokens: { add: sinks.tokens }, aiUsageAccounting: { add: sinks.accounting },
      aiUsageOperationStateCounts: { record: sinks.state }, aiUsageOperationOldestAges: { record: sinks.age },
    });
    return { t, sinks };
  }

  it('emits a call count and the reported quantities as VALUES only', () => {
    const { t, sinks } = instrumented();
    t.recordAiProviderCallSettlement('OPENAI', 'CONVERSATION_REPLY', 'SUCCEEDED', { completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 12 } });
    expect(sinks.calls).toHaveBeenCalledWith(1, { provider: 'OPENAI', feature_family: 'CONVERSATION_REPLY', outcome: 'SUCCEEDED', usage_completeness: 'INCOMPLETE', policy_version: '1' });
    expect(sinks.tokens).toHaveBeenCalledTimes(1);
    expect(sinks.tokens).toHaveBeenCalledWith(12, { provider: 'OPENAI', feature_family: 'CONVERSATION_REPLY', usage_kind: 'OUTPUT_TOKEN', policy_version: '1' });
    t.recordAiProviderCallSettlement('GEMINI', 'HYPOTHESIS_CANDIDATE_GENERATION', 'FAILED', { completeness: 'ABSENT' });
    expect(sinks.tokens).toHaveBeenCalledTimes(1);
    for (const labels of [...sinks.calls.mock.calls, ...sinks.tokens.mock.calls].map((call) => JSON.stringify(call[1]))) {
      expect(labels).not.toMatch(/user|session|turn|call_id|model/u);
    }
  });

  it('drops anything outside the registries', () => {
    const { t, sinks } = instrumented();
    t.recordAiProviderCallSettlement('QWEN', 'CONVERSATION_REPLY', 'SUCCEEDED', { completeness: 'ABSENT' });
    t.recordAiProviderCallSettlement('OPENAI', '11111111-1111-4111-8111-111111111111', 'SUCCEEDED', { completeness: 'ABSENT' });
    t.recordAiProviderCallSettlement('OPENAI', 'CONVERSATION_REPLY', 'MAYBE', { completeness: 'ABSENT' });
    t.recordAiProviderCallAccounting('begin', 'oops');
    t.recordAiProviderCallAccounting('settle', 'unattributed');
    t.recordAiUsageOperationsState('pending', 1, 5);
    t.recordAiUsageOperationsState('stale_pending', 1);
    t.recordAiUsageOperationsState('nope', 1);
    t.recordAiUsageOperationsState('pending', -1);
    expect([sinks.calls, sinks.accounting, sinks.state, sinks.age].map((sink) => sink.mock.calls.length)).toEqual([0, 0, 0, 0]);
    t.recordAiProviderCallAccounting('begin', 'unattributed');
    t.recordAiUsageOperationsState('stale_pending', 2, 600);
    expect(sinks.accounting).toHaveBeenCalledWith(1, { stage: 'begin', outcome: 'unattributed', policy_version: '1' });
    expect(sinks.age).toHaveBeenCalledWith(600, { state: 'stale_pending', policy_version: '1' });
  });
});
