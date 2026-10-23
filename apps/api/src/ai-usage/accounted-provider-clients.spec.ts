import * as transports from './accounted-provider-clients';
import { accountedDeepSeekChatCompletionsClient } from './accounted-provider-clients';
import { AiProviderCallAccounting, AiProviderCallAccountingUnavailableError, type AiProviderCallBeginRecord, type AiProviderCallSettleRecord } from './ai-provider-call-accounting';
import { runWithAiUsageAttribution } from './ai-usage-attribution';
import { SupabaseAiProviderCallLedger } from './ai-provider-call-ledger.repository';

const USER = '11111111-1111-4111-8111-111111111111';

function recordingAccounting(beginFails = false) {
  const begun: AiProviderCallBeginRecord[] = [];
  const settled: AiProviderCallSettleRecord[] = [];
  const accounting = new AiProviderCallAccounting({
    begin: async (record) => { if (beginFails) throw new Error('down'); begun.push(record); },
    settle: async (record) => { settled.push(record); },
  });
  return { accounting, begun, settled };
}
const attributed = <T>(work: () => Promise<T>) => runWithAiUsageAttribution({ userId: USER }, work);

describe('AI-COST-01 accounted provider transports', () => {
  it('S8A-03 (D1): DeepSeek Chat Completions is the only accounted transport', () => {
    expect(Object.keys(transports).sort()).toEqual(['accountedDeepSeekChatCompletionsClient']);
  });

  it('DeepSeek: a structured adapter request and its options reach the real client unchanged, the model comes from the server-built body', async () => {
    const r = recordingAccounting();
    const completion = { choices: [{ finish_reason: 'stop', message: { content: '{}' } }], usage: { prompt_tokens: 9, prompt_cache_hit_tokens: 4, prompt_cache_miss_tokens: 5, completion_tokens: 2 } };
    const create = jest.fn(async (_body: unknown, _options?: unknown) => completion);
    const client = accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'FOCUS_RESOLUTION', r.accounting);
    const body = { model: 'deepseek-flash', messages: [], response_format: { type: 'json_object' }, thinking: { type: 'disabled' } };
    const options = { timeout: 5, maxRetries: 0 as const, signal: new AbortController().signal };
    await expect(attributed(() => client.chat.completions.create(body as never, options as never))).resolves.toBe(completion);
    expect(create).toHaveBeenCalledWith(body, options);
    expect(r.begun[0]).toMatchObject({ provider: 'DEEPSEEK', operation: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', requestedModel: 'deepseek-flash', featureFamily: 'FOCUS_RESOLUTION' });
    expect(r.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 5, CACHE_READ_INPUT_TOKEN: 4, OUTPUT_TOKEN: 2 } } });
  });

  it('DeepSeek: one accounted attempt per chat.completions.create, intent before the request, its own usage partition', async () => {
    const r = recordingAccounting();
    const completion = { choices: [], usage: { prompt_tokens: 12, prompt_cache_hit_tokens: 8, prompt_cache_miss_tokens: 4, completion_tokens: 3 } };
    const create = jest.fn(async (_body: unknown, _options?: unknown) => { expect(r.begun).toHaveLength(1); return completion; });
    const client = accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'CONVERSATION_REPLY', r.accounting);
    const body = { model: 'deepseek-flash', messages: [] };
    await runWithAiUsageAttribution({ userId: USER, processingPath: 'FAST' }, () => client.chat.completions.create(body as never));
    expect(create).toHaveBeenCalledWith(body, undefined);
    expect(r.begun[0]).toMatchObject({ provider: 'DEEPSEEK', operation: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', requestedModel: 'deepseek-flash', featureFamily: 'CONVERSATION_REPLY', processingPath: 'FAST' });
    expect(r.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 4, CACHE_READ_INPUT_TOKEN: 8, OUTPUT_TOKEN: 3 } } });
  });

  it('DeepSeek: no durable intent, no request - the adapter sees the 503-shaped refusal its classifier maps to UNAVAILABLE', async () => {
    const r = recordingAccounting(true);
    const create = jest.fn(async (_body: unknown) => ({}));
    const client = accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'CU_SEGMENTATION', r.accounting);
    const refusal = attributed(() => client.chat.completions.create({ model: 'deepseek-flash' } as never));
    await expect(refusal).rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    await expect(refusal).rejects.toMatchObject({ status: 503 });
    expect(create).not.toHaveBeenCalled();
  });

  it('DeepSeek: no attribution, no request', async () => {
    const r = recordingAccounting();
    const create = jest.fn(async (_body: unknown) => ({}));
    const client = accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'HYPOTHESIS_EVIDENCE_ASSOCIATION', r.accounting);
    await expect(client.chat.completions.create({ model: 'deepseek-flash' } as never)).rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect(create).not.toHaveBeenCalled();
    expect(r.begun).toHaveLength(0);
  });

  it('DeepSeek: a provider failure is a FAILED attempt with unknown usage and is re-thrown as it was', async () => {
    const r = recordingAccounting();
    const failure = Object.assign(new Error('bad gateway'), { status: 502 });
    const client = accountedDeepSeekChatCompletionsClient({ chat: { completions: { create: jest.fn(async (_body: unknown) => { throw failure; }) } } }, 'HYPOTHESIS_CANDIDATE_GENERATION', r.accounting);
    await expect(attributed(() => client.chat.completions.create({ model: 'deepseek-flash' } as never))).rejects.toBe(failure);
    expect(r.begun[0]).toMatchObject({ provider: 'DEEPSEEK', featureFamily: 'HYPOTHESIS_CANDIDATE_GENERATION' });
    expect(r.settled[0]).toMatchObject({ outcome: 'FAILED', usage: { completeness: 'ABSENT' } });
  });
});

describe('AI-COST-01 ledger repository (service-role channel)', () => {
  const begin = { callId: 'c', userId: USER, sessionId: null, sourceTurnId: null, provider: 'DEEPSEEK', requestedModel: 'm', operation: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', featureFamily: 'HYPOTHESIS_CANDIDATE_GENERATION', processingPath: 'FAST' } as const;
  it('sends identities and numbers only, and accepts only the defined outcomes', async () => {
    const rpc = jest.fn().mockResolvedValueOnce([{ begin_outcome: 'BEGUN', attempt_number: 1 }]).mockResolvedValueOnce([{ settle_outcome: 'ALREADY_SETTLED' }]);
    const ledger = new SupabaseAiProviderCallLedger({ rpc });
    await ledger.begin(begin);
    await ledger.settle({ callId: 'c', userId: USER, outcome: 'SUCCEEDED', usage: { completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 3 } } });
    expect(rpc).toHaveBeenNthCalledWith(1, 'begin_ai_provider_call_v1', {
      p_call_id: 'c', p_user_id: USER, p_session_id: null, p_source_turn_id: null, p_provider: 'DEEPSEEK', p_requested_model: 'm',
      p_operation: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', p_feature_family: 'HYPOTHESIS_CANDIDATE_GENERATION', p_processing_path: 'FAST',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'settle_ai_provider_call_v1', {
      p_call_id: 'c', p_user_id: USER, p_outcome: 'SUCCEEDED', p_usage_completeness: 'INCOMPLETE', p_usage: { OUTPUT_TOKEN: 3 },
    });
  });
  it('an absent usage is sent as an empty object, never as zeros', async () => {
    const rpc = jest.fn().mockResolvedValue([{ settle_outcome: 'SETTLED' }]);
    await new SupabaseAiProviderCallLedger({ rpc }).settle({ callId: 'c', userId: USER, outcome: 'FAILED', usage: { completeness: 'ABSENT' } });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_usage_completeness: 'ABSENT', p_usage: {} });
  });
  it('anything else is an integrity failure', async () => {
    await expect(new SupabaseAiProviderCallLedger({ rpc: jest.fn().mockResolvedValue([{ begin_outcome: 'MAYBE' }]) }).begin(begin)).rejects.toThrow('AI_PROVIDER_CALL_BEGIN_INTEGRITY');
    await expect(new SupabaseAiProviderCallLedger({ rpc: jest.fn().mockResolvedValue([]) }).settle({ callId: 'c', userId: USER, outcome: 'FAILED', usage: { completeness: 'ABSENT' } })).rejects.toThrow('AI_PROVIDER_CALL_SETTLE_INTEGRITY');
  });
});
