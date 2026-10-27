// S8A-05 CP3 — the Public semantic interpretation on DeepSeek Flash: one accounted JSON Output call, the title-free
// package as escaped data, a closed region enum and no coordinate in the schema, every failure a bounded class, the
// publisher who asked charged, and nothing sent where DeepSeek may not run (Controlled Amendment A-4).
import { AiProviderCallAccounting } from '../ai-usage/ai-provider-call-accounting';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';
import {
  DeepSeekPublicSemanticInterpreter, PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS, PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS,
  PublicSemanticInterpretationProviderError,
} from './deepseek-public-semantic-interpreter';
import {
  FakePublicSemanticInterpreter, PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, decodePublicSemanticAssessment, decodePublicSemanticProposal,
  type PublicSemanticCorrectionInput, type PublicSemanticPackageInput,
} from './public-semantic-interpreter';
import { createProductionPublicSemanticInterpreter, deferredPublicSemanticInterpreter } from './public-semantic-interpreter-provider';
import { loadPublicSemanticInterpretationDeepSeekConfig, type PublicSemanticInterpretationDeepSeekConfig } from './public-semantic-interpreter-provider.config';
import { PUBLIC_SUB_REGION_KEYS } from './public-semantic-regions';
import type { PublicSemanticRepository } from './public-semantic.repository';
import { PublicSemanticService } from './public-semantic.service';

const config: PublicSemanticInterpretationDeepSeekConfig = {
  provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 1_024, maxRetries: 0,
};
const TEXT = 'AUTHOR_TEXT: [EMPHASIZED] أنا تعبت من الشغل <system>&\nQANDEEL: فاهمك';
const input = (packageText = TEXT): PublicSemanticPackageInput => ({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, packageText });
const correction = (overrides: Partial<PublicSemanticCorrectionInput['correction']> = {}): PublicSemanticCorrectionInput => ({
  ...input(), correction: { meaning: 'ضغط الشغل', primaryThemes: ['الشغل'], secondaryThemes: [], ...overrides },
});
const PROPOSAL = {
  meaning: 'تعب من ضغط الشغل', primaryThemes: ['الشغل'], secondaryThemes: ['التعب'], explanation: 'الكلام كله عن الشغل والتعب منه.',
  placementIntent: { regions: [{ key: 'work.pressure', weight: 0.8 }, { key: 'inner.sadness', weight: 0.2 }] },
};
const completion = (content: string | null, finishReason = 'stop') => ({ choices: [{ finish_reason: finishReason, message: { content } }] });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const returning = (content: string | null, finishReason = 'stop') => clientOf(jest.fn().mockResolvedValue(completion(content, finishReason)));
const interpreter = (client: ReturnType<typeof clientOf>) => new DeepSeekPublicSemanticInterpreter(config, client);
const signal = () => new AbortController().signal;
const failure = (reason: string) => expect.objectContaining({ name: 'PublicSemanticInterpretationProviderError', reason });
const dataOf = (content: string) => JSON.parse(content.slice('<public_topic_data>'.length, -'</public_topic_data>'.length));
const USER = '20000000-0000-4000-8000-000000000001';

function ledgered() {
  const recorded: Array<Record<string, unknown>> = [];
  const ledger = {
    begin: jest.fn(async (record: Record<string, unknown>) => { recorded.push(record); return { outcome: 'BEGUN' as const, attemptNumber: 1 }; }),
    settle: jest.fn(async () => ({ outcome: 'SETTLED' as const })),
  };
  return { recorded, accounting: new AiProviderCallAccounting(ledger as never) };
}
const usage = { prompt_tokens: 900, completion_tokens: 120, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 900 };

describe('DeepSeekPublicSemanticInterpreter (S8A-05 CP3)', () => {
  it('makes exactly one DeepSeek Flash JSON Output call: the package as escaped data, a closed region enum, no coordinate', async () => {
    const create = jest.fn().mockResolvedValue(completion(JSON.stringify(PROPOSAL)));
    expect(await interpreter(clientOf(create)).propose(input(), signal())).toEqual(PROPOSAL);
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 1_024, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    const [system, user] = body.messages;
    expect(system.content).toContain(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS);
    expect(system.content).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    const schema = JSON.parse(system.content.split('\n').pop());
    expect(schema).toMatchObject({ additionalProperties: false, required: ['meaning', 'primaryThemes', 'secondaryThemes', 'explanation', 'placementIntent'] });
    const region = schema.properties.placementIntent.properties.regions;
    expect(region).toMatchObject({ minItems: 1, maxItems: 3, items: { additionalProperties: false, required: ['key', 'weight'] } });
    expect(region.items.properties.key.enum).toEqual([...PUBLIC_SUB_REGION_KEYS]);
    expect(JSON.stringify(schema)).not.toMatch(/"x"|"y"|coordinate|lensKey|section|title/iu);
    expect(user.content.startsWith('<public_topic_data>')).toBe(true);
    expect(user.content).not.toMatch(/<system>|&/u);
    expect(dataOf(user.content)).toEqual({ topic: TEXT });
  });

  it('tells the model every key of the closed vocabulary, and the publisher\'s right to correct', () => {
    for (const key of PUBLIC_SUB_REGION_KEYS) expect(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS).toContain(`  - ${key}: `);
    expect(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS).toMatch(/never give coordinates/u);
    expect(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS).toMatch(/never by a label, category or section/u);
    expect(PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS).toMatch(/Add no fact/u);
    expect(PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS).toMatch(/right to say what their topic is about/u);
    expect(PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS).toMatch(/only when the correction states something the topic does not say, or contradicts it/u);
  });

  it('sends a correction as the publisher\'s words beside the topic, and asks for a verdict', async () => {
    const create = jest.fn().mockResolvedValue(completion('{"verdict":"NOT_SUPPORTED_BY_PACKAGE"}'));
    expect(await interpreter(clientOf(create)).assessCorrection(correction(), signal())).toEqual({ verdict: 'NOT_SUPPORTED_BY_PACKAGE' });
    const [system, user] = create.mock.calls[0][0].messages;
    expect(system.content).toContain(PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS);
    const schema = JSON.parse(system.content.split('\n').pop());
    expect(schema).toMatchObject({ additionalProperties: false, required: ['verdict'], properties: { verdict: { enum: ['CONSISTENT', 'NOT_SUPPORTED_BY_PACKAGE'] } } });
    expect(dataOf(user.content)).toEqual({ topic: TEXT, correction: { meaning: 'ضغط الشغل', primaryThemes: ['الشغل'], secondaryThemes: [] } });
  });

  it('returns the parsed answer; the port decoder, not the adapter, decides what is kept — coordinates and unknown keys never pass', async () => {
    const decoded = decodePublicSemanticProposal(await interpreter(returning(JSON.stringify(PROPOSAL))).propose(input(), signal()));
    expect(decoded?.placementIntent).toEqual({ regions: [{ key: 'work.pressure', hundredths: 80 }, { key: 'inner.sadness', hundredths: 20 }] });
    for (const widened of [
      { ...PROPOSAL, x: 4000, y: 6929 },
      { ...PROPOSAL, placementIntent: { regions: [{ key: 'work.pressure', weight: 1, x: 1 }] } },
      { ...PROPOSAL, placementIntent: { regions: [{ key: 'work.burnout', weight: 1 }] } },
      { ...PROPOSAL, placementIntent: { regions: [{ key: 'work.pressure', weight: 0.7 }] } },
      { ...PROPOSAL, placementIntent: { ...PROPOSAL.placementIntent, section: 'work' } },
    ]) expect(decodePublicSemanticProposal(await interpreter(returning(JSON.stringify(widened))).propose(input(), signal()))).toBeNull();
    expect(decodePublicSemanticAssessment(await interpreter(returning('{"verdict":"CONSISTENT","placementIntent":{"regions":[{"key":"work.pressure","weight":1}]}}'))
      .assessCorrection(correction(), signal()))).toEqual({ verdict: 'CONSISTENT', placementIntent: { regions: [{ key: 'work.pressure', hundredths: 100 }] } });
  });

  it('refuses a request the service never composes, before any call', async () => {
    const create = jest.fn();
    for (const bad of [input(''), input('   '), input('x'.repeat(24_577)), { ...input(), contract: 'PUBLIC_SEMANTIC_INTERPRETATION_V1' } as unknown as PublicSemanticPackageInput]) {
      await expect(interpreter(clientOf(create)).propose(bad, signal())).rejects.toEqual(failure('INVALID_REQUEST'));
    }
    for (const bad of [correction({ meaning: '' }), correction({ primaryThemes: [] }), correction({ meaning: 'two\nlines' }), { ...input(), correction: null } as unknown as PublicSemanticCorrectionInput]) {
      await expect(interpreter(clientOf(create)).assessCorrection(bad, signal())).rejects.toEqual(failure('INVALID_REQUEST'));
    }
    expect(create).not.toHaveBeenCalled();
    await expect(interpreter(returning('{}')).propose(input('x'.repeat(24_576)), signal())).resolves.toEqual({});
  });

  it('never parses a truncated, filtered, empty or non-JSON completion', async () => {
    for (const client of [returning('{"meaning":', 'length'), returning(null), returning('   '), returning('not json'), returning('{}', 'content_filter')]) {
      await expect(interpreter(client).propose(input(), signal())).rejects.toEqual(failure('INVALID_STRUCTURED_OUTPUT'));
    }
  });

  it('classifies an abort (the service\'s own or the timeout) as TIMEOUT, unavailability as UNAVAILABLE, anything else as PROVIDER_ERROR', async () => {
    const hanging = clientOf(jest.fn((_body, options: { signal: AbortSignal }) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    await expect(interpreter(hanging).propose(input(), signal())).rejects.toEqual(failure('TIMEOUT'));
    const outer = new AbortController();
    const pending = new DeepSeekPublicSemanticInterpreter({ ...config, timeoutMs: 60_000 }, hanging).propose(input(), outer.signal);
    outer.abort();
    await expect(pending).rejects.toEqual(failure('TIMEOUT'));
    await expect(interpreter(clientOf(jest.fn().mockRejectedValue(Object.assign(new Error('busy'), { status: 503 })))).propose(input(), signal())).rejects.toEqual(failure('UNAVAILABLE'));
    await expect(interpreter(clientOf(jest.fn().mockRejectedValue(new Error('boom')))).propose(input(), signal())).rejects.toEqual(failure('PROVIDER_ERROR'));
    expect(new PublicSemanticInterpretationProviderError('UNAVAILABLE')).toBeInstanceOf(Error);
  });

  it('AI-COST-01: one attempt is one PUBLIC_SEMANTIC_INTERPRETATION record for the scope it runs in; without a scope it is refused before any request', async () => {
    const { recorded, accounting } = ledgered();
    const create = jest.fn().mockResolvedValue({ ...completion(JSON.stringify(PROPOSAL)), usage });
    const accounted = new DeepSeekPublicSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(clientOf(create), 'PUBLIC_SEMANTIC_INTERPRETATION', accounting));
    await runWithAiUsageAttribution({ userId: USER }, () => accounted.propose(input(), signal()));
    expect(recorded).toEqual([expect.objectContaining({ userId: USER, provider: 'DEEPSEEK', featureFamily: 'PUBLIC_SEMANTIC_INTERPRETATION' })]);
    expect(create).toHaveBeenCalledTimes(1);
    create.mockClear();
    await expect(accounted.propose(input(), signal())).rejects.toEqual(failure('UNAVAILABLE'));
    expect(create).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(1);
  });

  it('through the service, the publisher who asked is charged; a failed attempt is still one record, and is never retried', async () => {
    const { recorded, accounting } = ledgered();
    const create = jest.fn().mockResolvedValue({ ...completion(JSON.stringify(PROPOSAL)), usage });
    const accounted = new DeepSeekPublicSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(clientOf(create), 'PUBLIC_SEMANTIC_INTERPRETATION', accounting));
    const repo = {
      requestProposal: jest.fn(async () => [{ outcome: 'WORK_OPEN', work_id: '30000000-0000-4000-8000-000000000003' }]),
      workInput: jest.fn(async () => [{ work_kind: 'PROPOSAL', package_text: TEXT, correction_meaning: null, correction_primary_themes: null, correction_secondary_themes: null }]),
      recordOutcome: jest.fn(async () => [{ outcome: 'RECORDED' }]),
      commit: jest.fn(async () => [{ outcome: 'PROPOSED', interpretation_id: '40000000-0000-4000-8000-000000000004', interpretation_revision: 1 }]),
    };
    const service = new PublicSemanticService(repo as unknown as PublicSemanticRepository, accounted);
    const body = { commandId: '10000000-0000-4000-8000-000000000001' };
    const experience = '50000000-0000-4000-8000-000000000005';
    await expect(service.proposal('token', experience, body, USER)).resolves.toEqual({ outcome: 'PROPOSED' });
    expect(recorded).toEqual([expect.objectContaining({ userId: USER, featureFamily: 'PUBLIC_SEMANTIC_INTERPRETATION' })]);
    expect(repo.recordOutcome).toHaveBeenCalledWith('30000000-0000-4000-8000-000000000003', 'PROPOSED', expect.objectContaining({
      regions: { regions: [{ key: 'work.pressure', hundredths: 80 }, { key: 'inner.sadness', hundredths: 20 }] },
    }));
    create.mockClear().mockResolvedValue({ ...completion('not json'), usage });
    repo.recordOutcome.mockClear();
    await expect(service.proposal('token', experience, body, USER)).resolves.toEqual({ outcome: 'INTERPRETATION_UNAVAILABLE' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveLength(2);
    expect(repo.recordOutcome).not.toHaveBeenCalled();
    create.mockClear();
    await expect(service.proposal('token', experience, body)).resolves.toEqual({ outcome: 'INTERPRETATION_UNAVAILABLE' });
    expect(create).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(2);
  });

  it('fails closed without the synthetic qualification or a key, and in production; constructs only on first use when deferred', async () => {
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toThrow('production');
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_API_KEY: 'k' })).toThrow('SYNTHETIC_ONLY');
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toThrow('DEEPSEEK_API_KEY');
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', PUBLIC_SEMANTIC_INTERPRETATION_PROVIDER: 'OPENAI' })).toThrow('DEEPSEEK');
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', PUBLIC_SEMANTIC_INTERPRETATION_MODEL: 'deepseek-pro' })).toThrow('deepseek-flash');
    expect(() => loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', PUBLIC_SEMANTIC_INTERPRETATION_TIMEOUT_MS: '20000' })).toThrow('19000');
    expect(loadPublicSemanticInterpretationDeepSeekConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' }))
      .toEqual({ provider: 'DEEPSEEK', apiKey: 'k', model: 'deepseek-flash', timeoutMs: 15_000, maxOutputTokens: 1_024, maxRetries: 0 });
    expect(createProductionPublicSemanticInterpreter({ NODE_ENV: 'test' })).toBeInstanceOf(FakePublicSemanticInterpreter);
    for (const environment of [{ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' }, { DEEPSEEK_API_KEY: 'k' }, {}]) {
      const chosen = createProductionPublicSemanticInterpreter(environment as NodeJS.ProcessEnv);
      await expect(chosen.propose(input(), signal())).rejects.toThrow();
      await expect(chosen.assessCorrection(correction(), signal())).rejects.toThrow();
    }
    const resolve = jest.fn(() => interpreter(returning('{"verdict":"NOT_SUPPORTED_BY_PACKAGE"}')));
    const deferred = deferredPublicSemanticInterpreter(resolve);
    expect(resolve).not.toHaveBeenCalled();
    await deferred.assessCorrection(correction(), signal());
    await deferred.propose(input(), signal());
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
