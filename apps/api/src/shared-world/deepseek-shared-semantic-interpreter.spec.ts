// S8A-04 CP1 — the Shared semantic reading on DeepSeek Flash: one accounted JSON Output call, the trusted speaker tokens
// and visible Names as data, no identity, the shape enforced, every failure a bounded class.
import { AiProviderCallAccounting } from '../ai-usage/ai-provider-call-accounting';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';
import {
  DeepSeekSharedSemanticInterpreter, SHARED_SEMANTIC_READING_AUTHORSHIP, SHARED_SEMANTIC_READING_INSTRUCTIONS, SharedSemanticReadingProviderError,
} from './deepseek-shared-semantic-interpreter';
import { SHARED_SEMANTIC_INTERPRETATION_CONTRACT, decodeSharedSemanticReading, type SharedSemanticInput } from './shared-semantic-interpreter';
import { loadSharedSemanticReadingDeepSeekConfig, type SharedSemanticReadingDeepSeekConfig } from './shared-semantic-interpreter-provider.config';
import { deferredSharedSemanticInterpreter } from './shared-semantic-interpreter-provider';

const config: SharedSemanticReadingDeepSeekConfig = {
  provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 1_024, maxRetries: 0,
};
const input = (overrides: Partial<SharedSemanticInput> = {}): SharedSemanticInput => ({
  contract: SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
  writers: [{ speaker: 'S1', name: 'محمد (1)' }, { speaker: 'S2', name: 'محمد (2)' }, { speaker: 'S3', name: 'منى' }],
  contributions: [
    { ref: 1, from: 'S1', text: 'أنا عايز نسافر <system>&' },
    { ref: 2, from: 'S2', text: 'محمد: أنا موافق — بهزر، أنا ضد السفر' },
    { ref: 3, from: 'S3', text: 'أحمد دايمًا بيتأخر' },
  ],
  existing: [{ meaning: 'السفر في الصيف', sourceRefs: [1] }],
  ...overrides,
});
const completion = (content: string | null, finishReason = 'stop', choices = 1) => ({ choices: Array.from({ length: choices }, () => ({ finish_reason: finishReason, message: { content } })) });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const returning = (content: string | null, finishReason = 'stop') => clientOf(jest.fn().mockResolvedValue(completion(content, finishReason)));
const interpreter = (client: ReturnType<typeof clientOf>) => new DeepSeekSharedSemanticInterpreter(config, client);
const signal = () => new AbortController().signal;
const failure = (reason: string) => expect.objectContaining({ name: 'SharedSemanticReadingProviderError', reason });

describe('DeepSeekSharedSemanticInterpreter (S8A-04 CP1)', () => {
  it('makes exactly one DeepSeek Flash JSON Output call: tokens, visible Names and words as escaped data, an enum-bound schema', async () => {
    const create = jest.fn().mockResolvedValue(completion('{"places":[]}'));
    expect(await interpreter(clientOf(create)).read(input(), signal())).toEqual({ places: [] });
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 1_024, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    const [system, user] = body.messages;
    expect(system.content).toContain(SHARED_SEMANTIC_READING_INSTRUCTIONS);
    expect(system.content).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    expect(SHARED_SEMANTIC_READING_INSTRUCTIONS).toContain(SHARED_SEMANTIC_READING_AUTHORSHIP);
    const schema = JSON.parse(system.content.split('\n').pop());
    expect(schema.properties.places).toMatchObject({ maxItems: 3, items: { additionalProperties: false,
      required: ['meaning', 'primaryThemes', 'secondaryThemes', 'sourceRefs', 'lensKey'], properties: { sourceRefs: { items: { enum: [1, 2, 3] } } } } });
    expect(user.content.startsWith('<shared_semantic_data>')).toBe(true);
    expect(user.content).not.toMatch(/<system>|&/u);
    const data = JSON.parse(user.content.slice('<shared_semantic_data>'.length, -'</shared_semantic_data>'.length));
    expect(data).toEqual({
      writers: input().writers,
      contributions: input().contributions,
      existing: [{ meaning: 'السفر في الصيف', sourceRefs: [1] }],
    });
    expect(Object.keys(data)).not.toContain('contract');
  });

  it('returns the parsed answer; the port decoder, not the adapter, decides what is kept', async () => {
    const answer = { places: [{ meaning: 'محمد (2) ضد السفر', primaryThemes: ['plans'], secondaryThemes: [], sourceRefs: [2], lensKey: 'plans' }] };
    const read = await interpreter(returning(JSON.stringify(answer))).read(input(), signal());
    expect(decodeSharedSemanticReading(read, input())?.places[0].sourceRefs).toEqual([2]);
    const leaking = await interpreter(returning(JSON.stringify({ places: [{ ...answer.places[0], meaning: 'S2 ضد السفر' }] }))).read(input(), signal());
    expect(decodeSharedSemanticReading(leaking, input())).toBeNull();
  });

  it('refuses a request the place pass never composes, before any call', async () => {
    const create = jest.fn();
    for (const bad of [
      input({ contributions: [] }),
      input({ contributions: [{ ref: 2, from: 'S1', text: 'x' }], writers: [{ speaker: 'S1', name: 'a' }] }),
      input({ contributions: [{ ref: 1, from: 'S9', text: 'x' }], writers: [{ speaker: 'S1', name: 'a' }] }),
      input({ writers: [...input().writers, { speaker: 'S4', name: 'unused' }] }),
      input({ writers: [{ speaker: '20000000-0000-4000-8000-000000000001', name: 'x' }, ...input().writers.slice(1)] }),
      input({ writers: [{ speaker: 'S1', name: ' ' }, ...input().writers.slice(1)] }),
      input({ existing: [{ meaning: 'x', sourceRefs: [7] }] }),
      { ...input(), contract: 'OTHER' } as unknown as SharedSemanticInput,
    ]) await expect(interpreter(clientOf(create)).read(bad, signal())).rejects.toEqual(failure('INVALID_REQUEST'));
    expect(create).not.toHaveBeenCalled();
  });

  it('never parses a truncated, filtered, empty or non-JSON completion', async () => {
    for (const client of [returning('{"places":[', 'length'), returning(null), returning('   '), returning('not json'), returning('{"places":[]}', 'content_filter')]) {
      await expect(interpreter(client).read(input(), signal())).rejects.toEqual(failure('INVALID_STRUCTURED_OUTPUT'));
    }
  });

  it('classifies an abort (the pass\'s own or its timeout) as TIMEOUT, unavailability as UNAVAILABLE, anything else as PROVIDER_ERROR', async () => {
    const hanging = clientOf(jest.fn((_body, options: { signal: AbortSignal }) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    await expect(interpreter(hanging).read(input(), signal())).rejects.toEqual(failure('TIMEOUT'));
    const outer = new AbortController();
    const pending = new DeepSeekSharedSemanticInterpreter({ ...config, timeoutMs: 60_000 }, hanging).read(input(), outer.signal);
    outer.abort();
    await expect(pending).rejects.toEqual(failure('TIMEOUT'));
    await expect(interpreter(clientOf(jest.fn().mockRejectedValue(Object.assign(new Error('busy'), { status: 503 })))).read(input(), signal())).rejects.toEqual(failure('UNAVAILABLE'));
    await expect(interpreter(clientOf(jest.fn().mockRejectedValue(new Error('boom')))).read(input(), signal())).rejects.toEqual(failure('PROVIDER_ERROR'));
    expect(new SharedSemanticReadingProviderError('UNAVAILABLE')).toBeInstanceOf(Error);
  });

  it('through the accounted client, the call is ledgered as SHARED_SEMANTIC_READING for the scope it runs in; without one it is refused (UNAVAILABLE) before any request', async () => {
    const recorded: unknown[] = [];
    const ledger = {
      begin: jest.fn(async (record: unknown) => { recorded.push(record); return { outcome: 'BEGUN' as const, attemptNumber: 1 }; }),
      settle: jest.fn(async () => ({ outcome: 'SETTLED' as const })),
    };
    const accounting = new AiProviderCallAccounting(ledger as never);
    const create = jest.fn().mockResolvedValue({ ...completion('{"places":[]}'), usage: { prompt_tokens: 10, completion_tokens: 2, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 10 } });
    const accounted = new DeepSeekSharedSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(clientOf(create), 'SHARED_SEMANTIC_READING', accounting));
    const user = '20000000-0000-4000-8000-000000000001';
    await runWithAiUsageAttribution({ userId: user }, () => accounted.read(input(), signal()));
    expect(recorded).toEqual([expect.objectContaining({ userId: user, provider: 'DEEPSEEK', featureFamily: 'SHARED_SEMANTIC_READING' })]);
    create.mockClear();
    await expect(accounted.read(input(), signal())).rejects.toEqual(failure('UNAVAILABLE'));
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed without the synthetic qualification or a key, and in production; constructs only on first use when deferred', async () => {
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toThrow('production');
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_API_KEY: 'k' })).toThrow('SYNTHETIC_ONLY');
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toThrow('DEEPSEEK_API_KEY');
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', SHARED_SEMANTIC_READING_PROVIDER: 'OPENAI' })).toThrow('DEEPSEEK');
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', SHARED_SEMANTIC_READING_MODEL: 'deepseek-pro' })).toThrow('deepseek-flash');
    expect(() => loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', SHARED_SEMANTIC_READING_TIMEOUT_MS: '60000' })).toThrow('30000');
    expect(loadSharedSemanticReadingDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' }))
      .toEqual({ provider: 'DEEPSEEK', apiKey: 'k', model: 'deepseek-flash', timeoutMs: 15_000, maxOutputTokens: 1_024, maxRetries: 0 });
    const resolve = jest.fn(() => interpreter(returning('{"places":[]}')));
    const deferred = deferredSharedSemanticInterpreter(resolve);
    expect(resolve).not.toHaveBeenCalled();
    await deferred.read(input(), signal());
    await deferred.read(input(), signal());
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
