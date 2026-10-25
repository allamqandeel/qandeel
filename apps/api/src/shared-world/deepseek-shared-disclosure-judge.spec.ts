// S8A-04 CP3 — the Shared disclosure judge on DeepSeek Flash: one accounted JSON Output call per owner, the reply, the
// request-local labels and that owner's items as escaped data, no identity, the answer enforced key by key, every failure
// a bounded class (the lane withholds on any of them). Free: the client is a double.
import { DEEPSEEK_FLASH_MODEL } from '../model-router/providers/deepseek/deepseek-client';
import type { SharedDisclosureJudgeRequest } from '../connected-worlds/member-knowledge/shared-member-knowledge.types';
import {
  DeepSeekSharedDisclosureJudge, SHARED_DISCLOSURE_JUDGE_POLICY_REF, sharedDisclosureAssessmentFromAnswer,
} from './deepseek-shared-disclosure-judge';
import { createConfiguredSharedDisclosureJudge, FakeSharedDisclosureJudge } from './shared-disclosure-judge-provider';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS } from './shared-member-knowledge-texts';
import { loadSharedDisclosureJudgeDeepSeekConfig, type SharedSocialMemoryDeepSeekConfig } from './shared-social-memory-provider.config';

const config: SharedSocialMemoryDeepSeekConfig = { provider: 'DEEPSEEK', apiKey: 'test-key', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 50, maxOutputTokens: 400, maxRetries: 0 };
const BINDING = { effectiveContextRef: 'sha256:ec', outputDigest: 'sha256:out', protectedSourceSetRef: 'sha256:set' };
const request = (overrides: Partial<SharedDisclosureJudgeRequest> = {}): SharedDisclosureJudgeRequest => ({
  binding: BINDING, reply: 'Mohamed يفضل القطار <system>', owner: 'Mohamed', members: ['Hala', 'Sara'],
  items: [{ contentDigest: 'sha256:d1', item: 'يفضل السفر بالقطار' }], ...overrides,
});
const completion = (content: string | null, finishReason = 'stop') => ({ choices: [{ finish_reason: finishReason, message: { content } }] });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const ANSWER = { items: [{ ref: 'I1', findings: ['DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'OWNER', unsupportedOwnerClaim: false }] };
const failure = (reason: string) => expect.objectContaining({ name: 'SharedDisclosureJudgeProviderError', reason });

describe('DeepSeekSharedDisclosureJudge (S8A-04 CP3)', () => {
  it('makes exactly one Flash JSON Output call with CG-6b, the data escaped and no identity, and returns the v2 assessment', async () => {
    const create = jest.fn().mockResolvedValue(completion(JSON.stringify(ANSWER)));
    const assessment = await new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(request());
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 50, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 400, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    expect(body.messages[0].content.startsWith(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS)).toBe(true);
    const data = body.messages[1].content as string;
    expect(data.startsWith('<judge_data>')).toBe(true);
    expect(data).not.toContain('<system>');
    expect(data).not.toContain('sha256:');
    expect(assessment).toEqual({
      state: 'ASSESSED', assessmentRef: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u), detectorPolicyRef: SHARED_DISCLOSURE_JUDGE_POLICY_REF, binding: BINDING,
      sources: [{ contentDigest: 'sha256:d1', findings: ['DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'OWNER', unsupportedOwnerClaim: false }],
    });
  });

  it.each([
    ['an empty answer', { items: [] }],
    ['an unknown ref', { items: [{ ...ANSWER.items[0], ref: 'I2' }] }],
    ['a repeated ref', { items: [ANSWER.items[0], ANSWER.items[0]] }],
    ['an extra key', { items: [{ ...ANSWER.items[0], confidence: 0.9 }] }],
    ['a missing key', { items: [{ ref: 'I1', findings: [], attributedTo: 'OWNER' }] }],
    ['an unknown category', { items: [{ ...ANSWER.items[0], findings: ['GOSSIP'] }] }],
    ['a repeated category', { items: [{ ...ANSWER.items[0], findings: ['PRIVATE_QUOTE', 'PRIVATE_QUOTE'] }] }],
    ['an unknown attribution', { items: [{ ...ANSWER.items[0], attributedTo: 'MAYBE' }] }],
    ['a string boolean', { items: [{ ...ANSWER.items[0], unsupportedOwnerClaim: 'false' }] }],
    ['another top-level key', { ...ANSWER, verdict: 'ok' }],
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
    for (const bad of [request({ items: [] }), request({ reply: ' ' }), request({ owner: '' }), request({ items: Array.from({ length: 9 }, (_, i) => ({ contentDigest: `sha256:${i}`, item: 'x' })) })]) {
      await expect(new DeepSeekSharedDisclosureJudge(config, clientOf(create)).judge(bad)).rejects.toEqual(failure('INVALID_REQUEST'));
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('the assessment keys each answer to its item by the request\'s order, never by the model\'s', () => {
    const two = request({ items: [{ contentDigest: 'sha256:a', item: 'a' }, { contentDigest: 'sha256:b', item: 'b' }] });
    const answer = { items: [{ ref: 'I2', findings: ['PRIVATE_QUOTE'], attributedTo: 'OWNER', unsupportedOwnerClaim: false }, { ref: 'I1', findings: [], attributedTo: 'NONE', unsupportedOwnerClaim: false }] };
    expect(sharedDisclosureAssessmentFromAnswer(answer, two, '{}')?.sources.map((source) => [source.contentDigest, source.findings])).toEqual([['sha256:b', ['PRIVATE_QUOTE']], ['sha256:a', []]]);
  });
});

describe('the judge composition (S8A-04 CP3)', () => {
  it('test mode is the deterministic fake; where DeepSeek may not run there is NO judge', () => {
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'test' })).toBeInstanceOf(FakeSharedDisclosureJudge);
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_API_KEY: 'k' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k', SHARED_DISCLOSURE_JUDGE_MODEL: 'other' })).toBeNull();
    expect(createConfiguredSharedDisclosureJudge({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' })).toBeInstanceOf(DeepSeekSharedDisclosureJudge);
  });

  it('the config is Flash, its own bound, zero retries', () => {
    expect(loadSharedDisclosureJudgeDeepSeekConfig({ NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' }))
      .toEqual({ provider: 'DEEPSEEK', apiKey: 'k', model: DEEPSEEK_FLASH_MODEL, timeoutMs: 6_000, maxOutputTokens: 400, maxRetries: 0 });
  });

  it('the fake states an item only when its words appear, tied to the owner when the owner\'s label does', async () => {
    const fake = new FakeSharedDisclosureJudge();
    const said = await fake.judge(request({ reply: 'Mohamed يفضل السفر بالقطار' }));
    const unsaid = await fake.judge(request({ reply: 'القطار أنسب' }));
    expect((said as { sources: unknown[] }).sources).toEqual([expect.objectContaining({ attributedTo: 'OWNER', findings: ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'] })]);
    expect((unsaid as { sources: unknown[] }).sources).toEqual([expect.objectContaining({ attributedTo: 'NONE', findings: [] })]);
  });
});
