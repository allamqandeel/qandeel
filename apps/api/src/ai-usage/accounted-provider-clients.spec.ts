import { accountedAnthropicMessagesClient, accountedGeminiTransport, accountedOpenAIResponsesClient } from './accounted-provider-clients';
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
  it('OpenAI: the body and options reach the real client unchanged, the model comes from the server-built body', async () => {
    const r = recordingAccounting();
    const response = { output_text: 'x', usage: { input_tokens: 9, input_tokens_details: { cached_tokens: 4, cache_write_tokens: 0 }, output_tokens: 2 } };
    const create = jest.fn(async (_body: unknown, _options?: unknown) => response);
    const client = accountedOpenAIResponsesClient({ responses: { create } }, 'FOCUS_RESOLUTION', r.accounting);
    const body = { model: 'gpt-5-mini', input: [] };
    const options = { timeout: 5, maxRetries: 0 as const, signal: new AbortController().signal };
    await expect(attributed(() => client.responses.create(body as never, options as never))).resolves.toBe(response);
    expect(create).toHaveBeenCalledWith(body, options);
    expect(r.begun[0]).toMatchObject({ provider: 'OPENAI', operation: 'OPENAI_RESPONSES_CREATE', requestedModel: 'gpt-5-mini', featureFamily: 'FOCUS_RESOLUTION' });
    expect(r.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 5, CACHE_READ_INPUT_TOKEN: 4, CACHE_WRITE_INPUT_TOKEN: 0, OUTPUT_TOKEN: 2 } } });
  });

  it('OpenAI: no intent, no request - the adapter sees the 503-shaped refusal its classifier maps to UNAVAILABLE', async () => {
    const r = recordingAccounting(true);
    const create = jest.fn(async (_body: unknown) => ({}));
    const client = accountedOpenAIResponsesClient({ responses: { create } }, 'CU_SEGMENTATION', r.accounting);
    await expect(attributed(() => client.responses.create({ model: 'gpt-5-mini' } as never))).rejects.toMatchObject({ status: 503 });
    expect(create).not.toHaveBeenCalled();
  });

  it('Anthropic: one accounted attempt per messages.create, with its own usage partition', async () => {
    const r = recordingAccounting();
    const message = { content: [], usage: { input_tokens: 7, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 3 } };
    const client = accountedAnthropicMessagesClient({ messages: { create: jest.fn(async (_body: unknown) => message) } }, 'CONVERSATION_REPLY', r.accounting);
    await runWithAiUsageAttribution({ userId: USER, processingPath: 'DEEP' }, () => client.messages.create({ model: 'claude-sonnet-4-6' } as never));
    expect(r.begun[0]).toMatchObject({ provider: 'ANTHROPIC', operation: 'ANTHROPIC_MESSAGES_CREATE', requestedModel: 'claude-sonnet-4-6', processingPath: 'DEEP' });
    expect(r.settled[0].usage).toEqual({ completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 7, CACHE_READ_INPUT_TOKEN: 0, CACHE_WRITE_INPUT_TOKEN: 0, OUTPUT_TOKEN: 3 } });
  });

  it('Gemini: the 2xx body is read once for usage and handed to the adapter unchanged', async () => {
    const r = recordingAccounting();
    const body = { candidates: [{ content: { parts: [{ text: '[]' }] } }], usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 2 } };
    const json = jest.fn(async () => body);
    const transport = accountedGeminiTransport(async () => ({ ok: true, status: 200, json }), 'gemini-2.5-flash', 'HYPOTHESIS_CANDIDATE_GENERATION', r.accounting);
    const response = await attributed(() => transport('https://example.invalid', { method: 'POST' }));
    await expect(response.json()).resolves.toBe(body);
    expect(json).toHaveBeenCalledTimes(1);
    expect(r.begun[0]).toMatchObject({ provider: 'GEMINI', operation: 'GEMINI_GENERATE_CONTENT', requestedModel: 'gemini-2.5-flash' });
    expect(r.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 30, CACHE_READ_INPUT_TOKEN: 0, OUTPUT_TOKEN: 2 } } });
  });

  it('Gemini: a non-2xx answer is a FAILED attempt with unknown usage and passes through untouched', async () => {
    const r = recordingAccounting();
    const original = { ok: false, status: 503, json: jest.fn() };
    const transport = accountedGeminiTransport(async () => original, 'gemini-2.5-flash', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', r.accounting);
    await expect(attributed(() => transport('u', {}))).resolves.toBe(original);
    expect(original.json).not.toHaveBeenCalled();
    expect(r.settled[0]).toMatchObject({ outcome: 'FAILED', usage: { completeness: 'ABSENT' } });
  });

  it('Gemini: an unreadable 2xx body is SUCCEEDED with unknown usage, and the adapter sees the same error', async () => {
    const r = recordingAccounting();
    const broken = new SyntaxError('bad json');
    const transport = accountedGeminiTransport(async () => ({ ok: true, status: 200, json: async () => { throw broken; } }), 'gemini-2.5-flash', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', r.accounting);
    const response = await attributed(() => transport('u', {}));
    await expect(response.json()).rejects.toBe(broken);
    expect(r.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'ABSENT' } });
  });

  it('Gemini: a network failure is FAILED with unknown usage and re-thrown as it was', async () => {
    const r = recordingAccounting();
    const network = new TypeError('fetch failed');
    const transport = accountedGeminiTransport(async () => { throw network; }, 'gemini-2.5-flash', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', r.accounting);
    await expect(attributed(() => transport('u', {}))).rejects.toBe(network);
    expect(r.settled[0]).toMatchObject({ outcome: 'FAILED', usage: { completeness: 'ABSENT' } });
  });

  it('Gemini: no attribution, no request', async () => {
    const r = recordingAccounting();
    const http = jest.fn();
    const transport = accountedGeminiTransport(http, 'gemini-2.5-flash', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', r.accounting);
    await expect(transport('u', {})).rejects.toBeInstanceOf(AiProviderCallAccountingUnavailableError);
    expect(http).not.toHaveBeenCalled();
  });
});

describe('AI-COST-01 ledger repository (service-role channel)', () => {
  const begin = { callId: 'c', userId: USER, sessionId: null, sourceTurnId: null, provider: 'GEMINI', requestedModel: 'm', operation: 'GEMINI_GENERATE_CONTENT', featureFamily: 'HYPOTHESIS_CANDIDATE_GENERATION', processingPath: 'FAST' } as const;
  it('sends identities and numbers only, and accepts only the defined outcomes', async () => {
    const rpc = jest.fn().mockResolvedValueOnce([{ begin_outcome: 'BEGUN', attempt_number: 1 }]).mockResolvedValueOnce([{ settle_outcome: 'ALREADY_SETTLED' }]);
    const ledger = new SupabaseAiProviderCallLedger({ rpc });
    await ledger.begin(begin);
    await ledger.settle({ callId: 'c', userId: USER, outcome: 'SUCCEEDED', usage: { completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 3 } } });
    expect(rpc).toHaveBeenNthCalledWith(1, 'begin_ai_provider_call_v1', {
      p_call_id: 'c', p_user_id: USER, p_session_id: null, p_source_turn_id: null, p_provider: 'GEMINI', p_requested_model: 'm',
      p_operation: 'GEMINI_GENERATE_CONTENT', p_feature_family: 'HYPOTHESIS_CANDIDATE_GENERATION', p_processing_path: 'FAST',
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
