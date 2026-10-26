// S8A-04 CP3 — the Shared disclosure check on DeepSeek Flash (R4 / §11: ONE accounted JSON Output call per reply; V1 made
// one per owner): the reply with its spans under checker ids and the items as escaped data, no Name and no identity, the
// answer enforced key by key against this request's spans and items, every failure a bounded class (the lane withholds on
// any of them and cools nothing). Free: the client is a double.
import { DEEPSEEK_FLASH_MODEL } from '../model-router/providers/deepseek/deepseek-client';
import type { SharedDisclosureCheckRequest } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import {
  DeepSeekSharedDisclosureJudge, SHARED_DISCLOSURE_JUDGE_POLICY_REF, sharedDisclosureCheckResult, sharedDisclosureJudgeSchema,
} from './deepseek-shared-disclosure-judge';
import { createConfiguredSharedDisclosureJudge, FakeSharedDisclosureJudge } from './shared-disclosure-judge-provider';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS, SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS_V1 } from './shared-member-knowledge-texts';
import { loadSharedDisclosureJudgeDeepSeekConfig, type SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';

const config: SharedSocialMemoryDeepSeekConfig = { provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 600, maxRetries: 0 };
const BINDING = { effectiveContextRef: 'sha256:ec', audienceSnapshotRef: 'audience:1', disclosureAuthorizationRef: 'sha256:da', outputDigest: 'sha256:out' };
const request = (overrides: Partial<SharedDisclosureCheckRequest> = {}): SharedDisclosureCheckRequest => ({
  binding: BINDING, reply: '⟦K1: يفضل السفر بالقطار⟧ <system>', spans: ['K1'], items: [{ id: 'K1', item: 'يفضل السفر بالقطار' }], ...overrides,
});
const completion = (content: string | null, finishReason = 'stop') => ({ choices: [{ finish_reason: finishReason, message: { content } }] });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const ANSWER = { spans: [{ id: 'K1', verdict: 'ENTAILED' }], outside: [], sealed: [] };
const failure = (reason: string) => expect.objectContaining({ name: 'SharedDisclosureJudgeProviderError', reason });

describe('DeepSeekSharedDisclosureJudge (S8A-04 CP3, the V2 check)', () => {
  it('makes exactly one Flash JSON Output call with CG-6b′, the data escaped and no identity, and returns the bound CHECKED result', async () => {
    const create = jest.fn().mockResolvedValue(completion(JSON.stringify(ANSWER)));
    const result = await new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(request());
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 600, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    expect(body.messages[0].content.startsWith(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS)).toBe(true);
    expect(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS).not.toBe(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS_V1);
    const data = body.messages[1].content as string;
    expect(data.startsWith('<check_data>')).toBe(true);
    expect(data).not.toContain('<system>');
    expect(data).not.toContain('sha256:');
    expect(data).not.toContain('audience:');
    expect(result).toEqual({
      state: 'CHECKED', checkRef: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u), policyRef: SHARED_DISCLOSURE_JUDGE_POLICY_REF, binding: BINDING, answer: ANSWER,
    });
    expect(SHARED_DISCLOSURE_JUDGE_POLICY_REF).toMatch(/^QANDEEL_S8A04_SHARED_DISCLOSURE_CHECK_V2:sha256:[0-9a-f]{64}$/u);
  });

  it('the schema is this request\'s: one verdict per span exactly, passages only under its item ids; no span means none', () => {
    const schema = sharedDisclosureJudgeSchema(request({ spans: ['K1'], items: [{ id: 'K1', item: 'a' }, { id: 'K2', item: 'b' }] })) as {
      properties: { spans: { minItems: number; maxItems: number; items: { properties: { id: { enum: string[] } } } }; outside: { items: { properties: { id: { enum: string[] } } } } };
    };
    expect([schema.properties.spans.minItems, schema.properties.spans.maxItems, schema.properties.spans.items.properties.id.enum]).toEqual([1, 1, ['K1']]);
    expect(schema.properties.outside.items.properties.id.enum).toEqual(['K1', 'K2']);
    expect((sharedDisclosureJudgeSchema(request({ reply: 'القطار أنسب', spans: [] })) as { properties: { spans: unknown } }).properties.spans).toEqual({ type: 'array', maxItems: 0 });
  });

  it.each([
    ['a missing span verdict', { ...ANSWER, spans: [] }],
    ['an unknown span id', { ...ANSWER, spans: [{ id: 'K2', verdict: 'ENTAILED' }] }],
    ['a repeated span verdict', { ...ANSWER, spans: [ANSWER.spans[0], ANSWER.spans[0]] }],
    ['an unknown verdict', { ...ANSWER, spans: [{ id: 'K1', verdict: 'OWNER' }] }],
    ['an extra span key', { ...ANSWER, spans: [{ ...ANSWER.spans[0], confidence: 0.9 }] }],
    ['an outside passage under an unknown item', { ...ANSWER, outside: [{ id: 'K9', passage: 'x' }] }],
    ['a sealed passage that is not a string', { ...ANSWER, sealed: [{ id: 'K1', passage: 3 }] }],
    ['a missing top-level key', { spans: ANSWER.spans, outside: [] }],
    ['another top-level key', { ...ANSWER, verdict: 'ok' }],
    ['the V1 shape', { items: [{ ref: 'I1', findings: [], attributedTo: 'NONE', unsupportedOwnerClaim: false }] }],
  ])('%s is INVALID_STRUCTURED_OUTPUT', async (_name, answer) => {
    const create = jest.fn().mockResolvedValue(completion(JSON.stringify(answer)));
    await expect(new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(request())).rejects.toEqual(failure('INVALID_STRUCTURED_OUTPUT'));
  });

  it('truncated, empty or non-JSON completions are failures; a provider error is classified; nothing is retried', async () => {
    for (const [content, reason] of [[null, 'stop'], ['{', 'stop'], [JSON.stringify(ANSWER), 'length']] as const) {
      const create = jest.fn().mockResolvedValue(completion(content, reason));
      await expect(new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(request())).rejects.toEqual(failure('INVALID_STRUCTURED_OUTPUT'));
      expect(create).toHaveBeenCalledTimes(1);
    }
    const create = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(request())).rejects.toEqual(failure('PROVIDER_ERROR'));
  });

  it('an invalid request never reaches the provider', async () => {
    const create = jest.fn();
    for (const bad of [
      request({ items: [] }), request({ reply: ' ' }), request({ spans: ['K2'] }), request({ spans: ['K1', 'K1'] }),
      request({ items: [{ id: 'K2', item: 'x' }], spans: [] }), request({ binding: { ...BINDING, outputDigest: '' } }),
      request({ binding: { ...BINDING, extra: 'x' } as unknown as typeof BINDING }),
      request({ spans: [], items: Array.from({ length: 9 }, (_, i) => ({ id: `K${i + 1}`, item: 'x' })) }),
    ]) {
      await expect(new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(bad)).rejects.toEqual(failure('INVALID_REQUEST'));
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('the result references the policy, the binding and the exact answer bytes', () => {
    const a = sharedDisclosureCheckResult(ANSWER, request(), JSON.stringify(ANSWER));
    const b = sharedDisclosureCheckResult(ANSWER, request({ binding: { ...BINDING, outputDigest: 'sha256:other' } }), JSON.stringify(ANSWER));
    expect(a?.checkRef).not.toBe(b?.checkRef);
    expect(sharedDisclosureCheckResult({ ...ANSWER, extra: 1 }, request(), '{}')).toBeNull();
  });
});

describe('the check composition (S8A-04 CP3)', () => {
  it('test mode is the deterministic fake; where DeepSeek may not run there is NO checker', () => {
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'test' })).toBeInstanceOf(FakeSharedDisclosureJudge);
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_API_KEY: 'k' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', SHARED_DISCLOSURE_JUDGE_MODEL: 'other' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toBeInstanceOf(DeepSeekSharedDisclosureJudge);
  });

  it('the config is Flash, its own bound (600 output tokens under R4; V1: 400), zero retries', () => {
    expect(loadSharedDisclosureJudgeDeepSeekConfig({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' }))
      .toEqual({ provider: 'DEEPSEEK', apiKey: 'k', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 6_000, maxOutputTokens: 600, maxRetries: 0 });
  });

  it('the fake: a span is ENTAILED when it carries its item\'s words, else ADDS; an item\'s words outside every span are reported', async () => {
    const fake = new FakeSharedDisclosureJudge();
    const inSpan = await fake.judge(request({ reply: '⟦K1: يفضل السفر بالقطار⟧ فممكن نشوف المواعيد' }));
    const added = await fake.judge(request({ reply: '⟦K1: عنده فوبيا من الطيران⟧' }));
    const outside = await fake.judge(request({ reply: 'في حد هنا يفضل السفر بالقطار', spans: [] }));
    const unsaid = await fake.judge(request({ reply: 'القطار أنسب', spans: [] }));
    expect((inSpan as { answer: unknown }).answer).toEqual({ spans: [{ id: 'K1', verdict: 'ENTAILED' }], outside: [], sealed: [] });
    expect((added as { answer: unknown }).answer).toEqual({ spans: [{ id: 'K1', verdict: 'ADDS' }], outside: [], sealed: [] });
    expect((outside as { answer: unknown }).answer).toEqual({ spans: [], outside: [{ id: 'K1', passage: 'يفضل السفر بالقطار' }], sealed: [] });
    expect((unsaid as { answer: unknown }).answer).toEqual({ spans: [], outside: [], sealed: [] });
  });
});
