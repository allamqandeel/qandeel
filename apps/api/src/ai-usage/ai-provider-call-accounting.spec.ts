import {
  AiProviderCallAccounting,
  AiProviderCallAccountingUnavailableError,
  type AiProviderCallBeginRecord,
  type AiProviderCallLedger,
  type AiProviderCallSettleRecord,
} from './ai-provider-call-accounting';
import { runWithAiUsageAttribution, runWithAiUsageProcessingPath } from './ai-usage-attribution';
import { ABSENT_AI_USAGE, type NormalizedAiUsage } from './ai-usage.types';

const USER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const TURN = '33333333-3333-4333-8333-333333333333';
const DESCRIPTOR = { provider: 'OPENAI', requestedModel: 'gpt-5-mini', featureFamily: 'CU_SEGMENTATION' } as const;
const REPORTED: NormalizedAiUsage = { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 3, CACHE_READ_INPUT_TOKEN: 0, CACHE_WRITE_INPUT_TOKEN: 0, OUTPUT_TOKEN: 4 } };

function harness(overrides: Partial<AiProviderCallLedger> = {}) {
  const events: string[] = [];
  const begun: AiProviderCallBeginRecord[] = [];
  const settled: AiProviderCallSettleRecord[] = [];
  const ledger: AiProviderCallLedger = {
    begin: overrides.begin ?? (async (record) => { events.push('begin'); begun.push(record); }),
    settle: overrides.settle ?? (async (record) => { events.push('settle'); settled.push(record); }),
  };
  const signals = { recordAiProviderCallAccounting: jest.fn(), recordAiProviderCallSettlement: jest.fn() };
  let next = 0;
  const accounting = new AiProviderCallAccounting(ledger, signals, () => ({ session_id: SESSION, turn_id: TURN }),
    () => `00000000-0000-4000-8000-00000000000${next += 1}`);
  return { accounting, events, begun, settled, signals };
}

const attributed = <T>(work: () => Promise<T>) => runWithAiUsageAttribution({ userId: USER }, work);

describe('AI-COST-01 accounting boundary', () => {
  it('writes the durable intent BEFORE the provider is contacted, then settles with the normalized usage', async () => {
    const h = harness();
    const provider = jest.fn(async () => { h.events.push('provider'); return { usage: 'raw' }; });
    const value = await attributed(() => h.accounting.track(DESCRIPTOR, provider, () => REPORTED));
    expect(value).toEqual({ usage: 'raw' });
    expect(h.events).toEqual(['begin', 'provider', 'settle']);
    expect(h.begun).toEqual([{
      callId: '00000000-0000-4000-8000-000000000001', userId: USER, sessionId: SESSION, sourceTurnId: TURN,
      provider: 'OPENAI', requestedModel: 'gpt-5-mini', operation: 'OPENAI_RESPONSES_CREATE', featureFamily: 'CU_SEGMENTATION', processingPath: null,
    }]);
    expect(h.settled).toEqual([{ callId: '00000000-0000-4000-8000-000000000001', userId: USER, outcome: 'SUCCEEDED', usage: REPORTED }]);
  });

  it('refuses an unattributed call before any provider contact (no untracked spend)', async () => {
    const h = harness();
    const provider = jest.fn(async () => ({}));
    await expect(h.accounting.track(DESCRIPTOR, provider, () => REPORTED)).rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect(provider).not.toHaveBeenCalled();
    expect(h.events).toEqual([]);
    expect(h.signals.recordAiProviderCallAccounting).toHaveBeenCalledWith('begin', 'unattributed');
  });

  it('fails closed when the intent cannot be recorded: no provider call, one bounded 503-shaped error', async () => {
    const h = harness({ begin: async () => { throw new Error('ledger down'); } });
    const provider = jest.fn(async () => ({}));
    const error = await attributed(() => h.accounting.track(DESCRIPTOR, provider, () => REPORTED)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect((error as { status: number }).status).toBe(503);
    expect((error as Error).message).not.toMatch(/ledger down/u);
    expect(provider).not.toHaveBeenCalled();
    expect(h.signals.recordAiProviderCallAccounting).toHaveBeenCalledWith('begin', 'failure');
  });

  it('a provider failure is FAILED with unknown usage - never free - and the original error reaches the adapter', async () => {
    const h = harness();
    const original = Object.assign(new Error('upstream 500'), { status: 500 });
    await expect(attributed(() => h.accounting.track(DESCRIPTOR, async () => { throw original; }, () => REPORTED))).rejects.toBe(original);
    expect(h.settled.map((s) => [s.outcome, s.usage])).toEqual([['FAILED', ABSENT_AI_USAGE]]);
  });

  it('a success without readable usage is SUCCEEDED with unknown usage - never zero', async () => {
    const h = harness();
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => 'ok', () => { throw new Error('bad'); }));
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => 'ok', () => ABSENT_AI_USAGE));
    expect(h.settled.map((s) => [s.outcome, s.usage.completeness])).toEqual([['SUCCEEDED', 'ABSENT'], ['SUCCEEDED', 'ABSENT']]);
  });

  it('a transport that answers failure as a value settles FAILED', async () => {
    const h = harness();
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => ({ ok: false }), () => ABSENT_AI_USAGE, undefined, (v) => (v.ok ? 'SUCCEEDED' : 'FAILED')));
    expect(h.settled[0].outcome).toBe('FAILED');
  });

  it('a request cancelled before it started is CANCELLED_BEFORE_PROVIDER and never reaches the provider', async () => {
    const h = harness();
    const controller = new AbortController();
    controller.abort();
    const provider = jest.fn(async () => ({}));
    const error = await attributed(() => h.accounting.track(DESCRIPTOR, provider, () => REPORTED, controller.signal)).catch((e: unknown) => e);
    expect((error as Error).name).toBe('AbortError');
    expect(provider).not.toHaveBeenCalled();
    expect(h.settled.map((s) => s.outcome)).toEqual(['CANCELLED_BEFORE_PROVIDER']);
  });

  it('every external attempt is its own row: two attempts, two ids', async () => {
    const h = harness();
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => 'a', () => REPORTED));
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => 'b', () => REPORTED));
    expect(new Set(h.begun.map((b) => b.callId)).size).toBe(2);
  });

  it('a settlement failure never changes the Product answer: retried once, then visible, row left PENDING', async () => {
    const settle = jest.fn(async () => { throw new Error('down'); });
    const h = harness({ settle });
    await expect(attributed(() => h.accounting.track(DESCRIPTOR, async () => 'answer', () => REPORTED))).resolves.toBe('answer');
    expect(settle).toHaveBeenCalledTimes(2);
    expect(h.signals.recordAiProviderCallAccounting).toHaveBeenCalledWith('settle', 'failure');
    expect(h.signals.recordAiProviderCallSettlement).not.toHaveBeenCalled();
  });

  it('telemetry failures never change the answer', async () => {
    const h = harness();
    h.signals.recordAiProviderCallAccounting.mockImplementation(() => { throw new Error('boom'); });
    h.signals.recordAiProviderCallSettlement.mockImplementation(() => { throw new Error('boom'); });
    await expect(attributed(() => h.accounting.track(DESCRIPTOR, async () => 'answer', () => REPORTED))).resolves.toBe('answer');
  });

  it('carries the explicit attribution and the processing path, preferring them over the request correlation', async () => {
    const h = harness();
    const other = '44444444-4444-4444-8444-444444444444';
    await runWithAiUsageAttribution({ userId: USER, sessionId: other, sourceTurnId: other, processingPath: 'DEEP' },
      () => h.accounting.track(DESCRIPTOR, async () => 'x', () => REPORTED));
    await attributed(() => runWithAiUsageProcessingPath('FAST', () => h.accounting.track(DESCRIPTOR, async () => 'y', () => REPORTED)));
    expect(h.begun.map((b) => [b.sessionId, b.sourceTurnId, b.processingPath])).toEqual([[other, other, 'DEEP'], [SESSION, TURN, 'FAST']]);
  });

  it('refuses a model identity that the ledger could not store, before any provider contact', async () => {
    const h = harness();
    const provider = jest.fn(async () => ({}));
    await expect(attributed(() => h.accounting.track({ ...DESCRIPTOR, requestedModel: '' }, provider, () => REPORTED))).rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect(provider).not.toHaveBeenCalled();
  });

  it('records identities and numbers only - no prompt, response or error text ever reaches the ledger', async () => {
    const h = harness();
    const secret = 'USER SECRET PROMPT';
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => ({ output_text: secret }), () => REPORTED)).catch(() => undefined);
    await attributed(() => h.accounting.track(DESCRIPTOR, async () => { throw new Error(secret); }, () => REPORTED)).catch(() => undefined);
    expect(JSON.stringify([h.begun, h.settled])).not.toContain(secret);
  });

  it('an attribution that is not made of internal UUIDs opens no scope, so its provider attempts fail closed', async () => {
    const h = harness();
    const provider = jest.fn(async () => ({}));
    for (const attribution of [{ userId: 'reader@example.com' }, { userId: USER, sessionId: 'x' }]) {
      await expect(runWithAiUsageAttribution(attribution, () => h.accounting.track(DESCRIPTOR, provider, () => REPORTED)))
        .rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    }
    // ... and it never inherits an enclosing valid scope either.
    await expect(attributed(() => runWithAiUsageAttribution({ userId: 'not-a-uuid' }, () => h.accounting.track(DESCRIPTOR, provider, () => REPORTED))))
      .rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect(provider).not.toHaveBeenCalled();
    expect(runWithAiUsageAttribution({ userId: 'not-a-uuid' }, () => 'unchanged work')).toBe('unchanged work');
  });
});
