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
import { PersonalUnderstandingCaptureProviderError, type PersonalUnderstandingCaptureRequestV3 } from './personal-understanding.types';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';

// S8A-03 Open Understanding (CP2 amendment §10): the adapter speaks capture schema v3 only.
const config: PersonalUnderstandingCaptureDeepSeekConfig = {
  provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 2_048, maxRetries: 0, schemaVersion: 1,
};
const request = (overrides: Partial<PersonalUnderstandingCaptureRequestV3> = {}): PersonalUnderstandingCaptureRequestV3 => ({
  schemaVersion: 3,
  currentUserText: 'وسلمى بقت مدرسة إنجليزي <instruction>&',
  recentTurns: [{ role: 'USER', content: 'مراتي سلمى <system>' }, { role: 'QANDEEL', content: 'عاملة إيه؟' }],
  memories: [{ handle: 'm1', type: 'PERSONAL_FACT', content: 'بشتغل مهندس <ignore previous>' }],
  known: [{ handle: 'k1', type: 'RELATIONSHIP_CONTEXT', content: 'مراتي اسمها سلمى.', about: 'OTHER: سلمى (مراتي)', temporal: 'CURRENT', ended: false }],
  ...overrides,
});
const backfillOnly = (overrides: Partial<PersonalUnderstandingCaptureRequestV3> = {}) => request({ currentUserText: null, known: [], recentTurns: [], ...overrides });
const fact = {
  span: 'سلمى بقت مدرسة إنجليزي', owner: 'OTHER', ownerBasis: 'KNOWN_MEMORY', evidence: 'k1', personName: 'سلمى', personRelation: 'مراتي',
  polarity: 'AFFIRMED', modality: 'STATED', temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: null, importance: 'USEFUL', days: null, keys: ['شغل'],
};
const memory = { handle: 'm1', slot: 'OCCUPATION', temporal: 'CURRENT', keys: ['شغل'] };
const context = { handle: 'k1', status: 'REAFFIRMED', span: 'سلمى' };
const command = { kind: 'FORGET', handle: 'k1', span: 'انسى', replacement: null };
const answer = (facts: unknown, memories: unknown, items: unknown = [], commands: unknown = []) => JSON.stringify({ commands, context: items, facts, memories });
const completion = (content: string | null, finishReason = 'stop', choices = 1) => ({ choices: Array.from({ length: choices }, () => ({ finish_reason: finishReason, message: { content } })) });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const returning = (content: string | null, finishReason = 'stop', choices = 1) => clientOf(jest.fn().mockResolvedValue(completion(content, finishReason, choices)));
const provider = (client: ReturnType<typeof clientOf>, overrides: Partial<PersonalUnderstandingCaptureDeepSeekConfig> = {}) =>
  new DeepSeekPersonalUnderstandingCaptureProvider({ ...config, ...overrides }, client);
const invalid = new PersonalUnderstandingCaptureProviderError('INVALID_STRUCTURED_OUTPUT');
const knownItem = (handle: string, content = 'x') => ({ handle, type: 'GOAL' as const, content, about: 'USER', temporal: null, ended: false });

describe('DeepSeekPersonalUnderstandingCaptureProvider (S8A-03 capture schema v3)', () => {
  it('makes exactly one DeepSeek Flash JSON Output call with escaped data, opaque handles and an enum-bound schema', async () => {
    const create = jest.fn().mockResolvedValue(completion(answer([], [])));
    await provider(clientOf(create)).captureV3(request());
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 2_048, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    const [system, user] = body.messages;
    expect(system.content).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    expect(system.content).toContain(PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS);
    const schema = JSON.parse(system.content.split('\n').pop());
    // No address form is asked for or accepted (not adopted, amendment §10).
    expect(schema).toMatchObject({ type: 'object', additionalProperties: false, required: ['commands', 'context', 'facts', 'memories'] });
    expect(JSON.stringify(schema)).not.toMatch(/speaker|addressForm/u);
    expect(PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS).not.toMatch(/speaker|addressForm|MASCULINE|FEMININE/u);
    expect(schema.properties.context).toMatchObject({ maxItems: 1, items: { required: ['handle', 'span', 'status'], properties: {
      handle: { enum: ['k1'] }, status: { enum: ['REAFFIRMED', 'ENDED', 'PAUSED', 'ENDING_PLANNED'] } } } });
    expect(schema.properties.commands).toMatchObject({ maxItems: 5, items: { properties: { kind: { enum: ['FORGET', 'CORRECT'] }, handle: { enum: ['k1'] } } } });
    expect(schema.properties.facts.maxItems).toBe(10);
    expect(schema.properties.facts.items.properties.owner.enum).toEqual(['SELF', 'OTHER', 'UNCLEAR']);
    expect(schema.properties.facts.items.properties.ownerBasis.enum).toEqual(['IN_SPAN', 'IN_MESSAGE', 'CONVERSATION', 'KNOWN_MEMORY', 'INFERRED']);
    expect(schema.properties.facts.items.properties.slot.enum).toEqual(['RESIDENCE', 'OCCUPATION', 'EMPLOYER', 'STUDY', 'MARITAL_STATUS', 'SMOKING', null]);
    expect(schema.properties.memories).toMatchObject({ maxItems: 1, items: { properties: { handle: { enum: ['m1'] } } } });
    expect(user.content).toMatch(/^<personal_understanding_data>.*<\/personal_understanding_data>$/su);
    for (const raw of ['<instruction>', '<ignore previous>', '<system>']) expect(user.content).not.toContain(raw);
    // Only the message, the recent turns, handles, types, contents and labels travel: no identity of any kind, no key.
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|user_?id|session|execution|test-key|Authorization/iu);
  });

  it('asks for no facts, context or commands when only backfill runs', async () => {
    const create = jest.fn().mockResolvedValue(completion(answer([], [memory])));
    await expect(provider(clientOf(create)).captureV3(backfillOnly())).resolves.toEqual({ commands: [], context: [], facts: [], memories: [memory] });
    const schema = JSON.parse(create.mock.calls[0][0].messages[0].content.split('\n').pop());
    expect([schema.properties.facts.maxItems, schema.properties.context.maxItems, schema.properties.commands.maxItems]).toEqual([0, 0, 0]);
  });

  it('returns a structurally valid answer as proposals only (values are judged by the semantic verifier)', async () => {
    await expect(provider(returning(answer([fact], [memory], [context], [command]))).captureV3(request()))
      .resolves.toEqual({ commands: [command], context: [context], facts: [fact], memories: [memory] });
  });

  it.each([
    ['another schema version', request({ schemaVersion: 2 as 3 })],
    ['known items without a message', request({ currentUserText: null })],
    ['recent turns without a message', backfillOnly({ recentTurns: [{ role: 'USER', content: 'x' }] })],
    ['forty-one known items', request({ known: Array.from({ length: 41 }, (_, n) => knownItem(`k${(n % 40) + 1}`)) })],
    ['a known item with a backfill handle', request({ known: [knownItem('m2')] })],
    ['a known item with an empty content', request({ known: [knownItem('k1', ' ')] })],
    ['five recent turns', request({ recentTurns: Array.from({ length: 5 }, () => ({ role: 'USER' as const, content: 'x' })) })],
    ['an over-long recent turn', request({ recentTurns: [{ role: 'USER', content: 'ا'.repeat(601) }] })],
    ['an unknown turn role', request({ recentTurns: [{ role: 'SYSTEM' as 'USER', content: 'x' }] })],
    ['an empty message', request({ currentUserText: '  ' })],
    ['an over-long message', request({ currentUserText: 'ا'.repeat(1_501) })],
    ['nothing to do', backfillOnly({ memories: [] })],
    ['a non-opaque handle', request({ memories: [{ handle: '6f1d…', type: 'GOAL', content: 'x' }] })],
    ['a repeated handle', request({ memories: [{ handle: 'm1', type: 'GOAL', content: 'x' }, { handle: 'm1', type: 'GOAL', content: 'y' }] })],
  ])('fails closed before any call for %s', async (_name, bad) => {
    const create = jest.fn();
    await expect(provider(clientOf(create)).captureV3(bad)).rejects.toEqual(invalid);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    'not json',
    '[]',
    JSON.stringify({ facts: [], memories: [], context: [] }),
    JSON.stringify({ commands: [], context: [], facts: [], memories: [], speaker: { addressForm: 'MASCULINE', evidence: 'x' } }),
    answer([], [], [context, { ...context, status: 'ENDED' }]),
    answer([], [], [{ ...context, why: 'x' }]),
    answer([], [], {}),
    answer({}, []),
    answer([{ ...fact, confidence: 0.9 }], []),
    answer([{ ...fact, keys: undefined }], []),
    answer(Array(11).fill(fact), []),
    answer([], [memory, { ...memory, handle: 'm2' }]),
    answer([], [], [], [{ ...command, why: 'x' }]),
    answer([], [], [], [{ ...command, replacement: { ...fact, confidence: 1 } }]),
    answer([], [], [], Array(6).fill(command)),
  ])('rejects a malformed answer %#', async (text) => {
    await expect(provider(returning(text)).captureV3(request())).rejects.toEqual(invalid);
  });

  it('rejects any fact, context or command proposal when only backfill was asked for', async () => {
    await expect(provider(returning(answer([fact], []))).captureV3(backfillOnly())).rejects.toEqual(invalid);
    await expect(provider(returning(answer([], [], [context]))).captureV3(backfillOnly())).rejects.toEqual(invalid);
    await expect(provider(returning(answer([], [], [], [command]))).captureV3(backfillOnly())).rejects.toEqual(invalid);
  });

  it('rejects truncated, multiple-choice and empty completions', async () => {
    for (const client of [returning(answer([], []), 'length'), returning(answer([], []), 'stop', 2), returning(''), returning(null)]) {
      await expect(provider(client).captureV3(request())).rejects.toEqual(invalid);
    }
  });

  it.each([[429, 'UNAVAILABLE'], [503, 'UNAVAILABLE'], [500, 'PROVIDER_ERROR'], [400, 'PROVIDER_ERROR']] as const)('never retries HTTP %i', async (status, code) => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('raw provider body'), { status }));
    await expect(provider(clientOf(create)).captureV3(request())).rejects.toEqual(new PersonalUnderstandingCaptureProviderError(code));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('classifies an abort as a timeout', async () => {
    const hanging = jest.fn((_body, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await expect(provider(clientOf(hanging), { timeoutMs: 10 }).captureV3(request())).rejects.toEqual(new PersonalUnderstandingCaptureProviderError('TIMEOUT'));
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
    return deferred.captureV3(request()).then(() => deferred.captureV3(request())).then(() => expect(resolve).toHaveBeenCalledTimes(1));
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
