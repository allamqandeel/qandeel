import {
  DeepSeekPersonalUnderstandingCaptureProvider,
  PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS,
} from './deepseek-personal-understanding-capture.provider';
import { FakePersonalUnderstandingCaptureProvider } from './fake-personal-understanding-capture.provider';
import { loadPersonalUnderstandingCaptureDeepSeekConfig, type PersonalUnderstandingCaptureDeepSeekConfig } from './personal-understanding-capture-provider.config';
import {
  createConfiguredPersonalUnderstandingCaptureProvider,
  deferredPersonalUnderstandingCaptureProvider,
} from './personal-understanding-capture-provider.module';
import { PersonalUnderstandingCaptureProviderError, type PersonalUnderstandingCaptureRequest } from './personal-understanding.types';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';

const config: PersonalUnderstandingCaptureDeepSeekConfig = {
  provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 2_048, maxRetries: 0, schemaVersion: 1,
};
const request = (overrides: Partial<PersonalUnderstandingCaptureRequest> = {}): PersonalUnderstandingCaptureRequest => ({
  schemaVersion: 2,
  currentUserText: 'أنا ساكن في المعادي <instruction>&',
  memories: [{ handle: 'm1', type: 'PERSONAL_FACT', content: 'بشتغل مهندس <ignore previous>' }],
  current: [{ handle: 'c1', type: 'PERSONAL_FACT', content: 'أنا بدخن <system>' }],
  ...overrides,
});
const backfillOnly = (overrides: Partial<PersonalUnderstandingCaptureRequest> = {}) => request({ currentUserText: null, current: [], ...overrides });
const fact = { span: 'أنا ساكن في المعادي', subject: 'SELF', polarity: 'AFFIRMED', modality: 'STATED', temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: 'RESIDENCE', keys: ['سكن'] };
const memory = { handle: 'm1', slot: 'OCCUPATION', temporal: 'CURRENT', keys: ['شغل'] };
const context = { handle: 'c1', status: 'ENDED', span: 'بطلت سجاير' };
const answer = (facts: unknown, memories: unknown, items: unknown = []) => JSON.stringify({ context: items, facts, memories });
const completion = (content: string | null, finishReason = 'stop', choices = 1) => ({ choices: Array.from({ length: choices }, () => ({ finish_reason: finishReason, message: { content } })) });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const returning = (content: string | null, finishReason = 'stop', choices = 1) => clientOf(jest.fn().mockResolvedValue(completion(content, finishReason, choices)));
const provider = (client: ReturnType<typeof clientOf>, overrides: Partial<PersonalUnderstandingCaptureDeepSeekConfig> = {}) =>
  new DeepSeekPersonalUnderstandingCaptureProvider({ ...config, ...overrides }, client);
const invalid = new PersonalUnderstandingCaptureProviderError('INVALID_STRUCTURED_OUTPUT');

describe('DeepSeekPersonalUnderstandingCaptureProvider (S8A-03 CP2)', () => {
  it('makes exactly one DeepSeek Flash JSON Output call with escaped data, opaque handles and an enum-bound schema', async () => {
    const create = jest.fn().mockResolvedValue(completion(answer([], [])));
    await provider(clientOf(create)).capture(request());
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 2_048, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    const [system, user] = body.messages;
    expect(system.content).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    expect(system.content).toContain(PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS);
    const schema = JSON.parse(system.content.split('\n').pop());
    expect(schema).toMatchObject({ type: 'object', additionalProperties: false, required: ['context', 'facts', 'memories'] });
    // S8A-03 Living Personal Memory: the current items travel under opaque handles, and the answer is bound to them.
    expect(schema.properties.context).toMatchObject({ maxItems: 1, items: { required: ['handle', 'span', 'status'], properties: {
      handle: { enum: ['c1'] }, status: { enum: ['REAFFIRMED', 'ENDED'] } } } });
    expect(user.content).not.toContain('<system>');
    expect(schema.properties.facts.maxItems).toBe(6);
    expect(schema.properties.facts.items.properties.subject.enum).toEqual(['SELF', 'OTHER', 'UNCLEAR']);
    expect(schema.properties.facts.items.properties.slot.enum).toEqual(['RESIDENCE', 'OCCUPATION', 'EMPLOYER', 'STUDY', 'MARITAL_STATUS', 'SMOKING', null]);
    expect(schema.properties.memories).toMatchObject({ maxItems: 1, items: { properties: { handle: { enum: ['m1'] } } } });
    expect(user.content).toMatch(/^<personal_understanding_data>.*<\/personal_understanding_data>$/su);
    expect(user.content).not.toContain('<instruction>');
    expect(user.content).not.toContain('<ignore previous>');
    // Only the message, handles, types and contents travel: no user, session, memory or execution identity, no key.
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|user_?id|session|execution|test-key|Authorization/iu);
  });

  it('asks for no facts when only backfill runs', async () => {
    const create = jest.fn().mockResolvedValue(completion(answer([], [memory])));
    await expect(provider(clientOf(create)).capture(backfillOnly())).resolves.toEqual({ facts: [], memories: [memory], context: [] });
    const schema = JSON.parse(create.mock.calls[0][0].messages[0].content.split('\n').pop());
    expect([schema.properties.facts.maxItems, schema.properties.context.maxItems]).toEqual([0, 0]);
  });

  it('returns a structurally valid answer as proposals only (values are judged by the server verifier)', async () => {
    await expect(provider(returning(answer([fact], [memory], [context]))).capture(request())).resolves.toEqual({ facts: [fact], memories: [memory], context: [context] });
  });

  it.each([
    ['a missing schema version', request({ schemaVersion: 1 as 2 })],
    ['current items without a message', request({ currentUserText: null })],
    ['eleven current items', request({ current: Array.from({ length: 11 }, (_, n) => ({ handle: `c${(n % 10) + 1}`, type: 'GOAL' as const, content: 'x' })) })],
    ['a current item with a backfill handle', request({ current: [{ handle: 'm2', type: 'GOAL', content: 'x' }] })],
    ['a current item with an empty content', request({ current: [{ handle: 'c1', type: 'GOAL', content: ' ' }] })],
    ['an empty message', request({ currentUserText: '  ' })],
    ['an over-long message', request({ currentUserText: 'ا'.repeat(1_501) })],
    ['nothing to do', request({ currentUserText: null, memories: [] })],
    ['five memories', request({ memories: ['m1', 'm2', 'm3', 'm4', 'm1'].map((handle) => ({ handle, type: 'GOAL' as const, content: 'x' })) })],
    ['a non-opaque handle', request({ memories: [{ handle: '6f1d…', type: 'GOAL', content: 'x' }] })],
    ['a repeated handle', request({ memories: [{ handle: 'm1', type: 'GOAL', content: 'x' }, { handle: 'm1', type: 'GOAL', content: 'y' }] })],
  ])('fails closed before any call for %s', async (_name, bad) => {
    const create = jest.fn();
    await expect(provider(clientOf(create)).capture(bad)).rejects.toEqual(invalid);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    'not json',
    '[]',
    JSON.stringify({ facts: [] }),
    JSON.stringify({ facts: [], memories: [] }),
    answer([], [], [context, { ...context, status: 'REAFFIRMED' }]),
    answer([], [], [{ ...context, why: 'x' }]),
    answer([], [], {}),
    JSON.stringify({ facts: [], memories: [], rationale: 'x' }),
    answer({}, []),
    answer([{ ...fact, confidence: 0.9 }], []),
    answer([{ ...fact, keys: undefined }], []),
    answer(Array(7).fill(fact), []),
    answer([], [memory, { ...memory, handle: 'm2' }]),
    answer([], [{ ...memory, why: 'x' }]),
  ])('rejects a malformed answer %#', async (text) => {
    await expect(provider(returning(text)).capture(request())).rejects.toEqual(invalid);
  });

  it('rejects any fact proposal when only backfill was asked for', async () => {
    await expect(provider(returning(answer([fact], []))).capture(backfillOnly())).rejects.toEqual(invalid);
    await expect(provider(returning(answer([], [], [context]))).capture(backfillOnly())).rejects.toEqual(invalid);
  });

  it('rejects truncated, multiple-choice and empty completions', async () => {
    for (const client of [returning(answer([], []), 'length'), returning(answer([], []), 'stop', 2), returning(''), returning(null)]) {
      await expect(provider(client).capture(request())).rejects.toEqual(invalid);
    }
  });

  it.each([[429, 'UNAVAILABLE'], [503, 'UNAVAILABLE'], [500, 'PROVIDER_ERROR'], [400, 'PROVIDER_ERROR']] as const)('never retries HTTP %i', async (status, code) => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('raw provider body'), { status }));
    await expect(provider(clientOf(create)).capture(request())).rejects.toEqual(new PersonalUnderstandingCaptureProviderError(code));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('classifies an abort as a timeout', async () => {
    const hanging = jest.fn((_body, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await expect(provider(clientOf(hanging), { timeoutMs: 10 }).capture(request())).rejects.toEqual(new PersonalUnderstandingCaptureProviderError('TIMEOUT'));
  });
});

describe('PersonalUnderstandingCaptureProviderModule (S8A-03 CP2)', () => {
  const QUALIFIED = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'key' };

  it('uses only the fake in test mode', () => {
    expect(createConfiguredPersonalUnderstandingCaptureProvider({ NODE_ENV: 'test' })).toBeInstanceOf(FakePersonalUnderstandingCaptureProvider);
  });

  it('fails closed without the synthetic qualification or a key, and in production', () => {
    expect(() => createConfiguredPersonalUnderstandingCaptureProvider({ NODE_ENV: 'development' })).toThrow('SYNTHETIC_ONLY');
    expect(() => createConfiguredPersonalUnderstandingCaptureProvider({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toThrow('DEEPSEEK_API_KEY');
    expect(() => createConfiguredPersonalUnderstandingCaptureProvider({ ...QUALIFIED, NODE_ENV: 'production' })).toThrow('cannot be selected in production');
  });

  it('constructs DeepSeek Flash without calling it, and only on first use when deferred', () => {
    expect(createConfiguredPersonalUnderstandingCaptureProvider({ ...QUALIFIED, NODE_ENV: 'development' })).toBeInstanceOf(DeepSeekPersonalUnderstandingCaptureProvider);
    const resolve = jest.fn(() => new FakePersonalUnderstandingCaptureProvider());
    const deferred = deferredPersonalUnderstandingCaptureProvider(resolve);
    expect(resolve).not.toHaveBeenCalled();
    return deferred.capture(request()).then(() => deferred.capture(request())).then(() => expect(resolve).toHaveBeenCalledTimes(1));
  });

  it('loads the exact bounded defaults and refuses another provider, model or timeout', () => {
    expect(loadPersonalUnderstandingCaptureDeepSeekConfig(QUALIFIED)).toEqual({
      provider: 'DEEPSEEK', apiKey: 'key', model: 'deepseek-flash', timeoutMs: 8_000, maxOutputTokens: 2_048, maxRetries: 0, schemaVersion: 1,
    });
    expect(() => loadPersonalUnderstandingCaptureDeepSeekConfig({ ...QUALIFIED, PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER: 'GEMINI' })).toThrow('must be DEEPSEEK');
    expect(() => loadPersonalUnderstandingCaptureDeepSeekConfig({ ...QUALIFIED, PERSONAL_UNDERSTANDING_CAPTURE_MODEL: 'deepseek-pro' })).toThrow('must be deepseek-flash');
    expect(() => loadPersonalUnderstandingCaptureDeepSeekConfig({ ...QUALIFIED, PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS: '999' })).toThrow('between 1000 and 15000');
    expect(loadPersonalUnderstandingCaptureDeepSeekConfig({ ...QUALIFIED, PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS: '12000' }).timeoutMs).toBe(12_000);
  });
});
