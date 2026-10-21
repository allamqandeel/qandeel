import { ModelRouterProviderError, composeServerGuidance, type ModelRouterRequest } from '../../model-router.types';
import { createDeepSeekClient, DeepSeekModelRouter } from './deepseek-model-router';
import {
  DEEPSEEK_MAX_OUTPUT_TOKENS,
  loadDeepSeekModelRouterConfig,
  type DeepSeekModelRouterConfig,
} from './deepseek-model-router.config';
import { resolveDeepSeekModel } from '../../model-profile.registry';

const request = (path: 'FAST' | 'DEEP' = 'FAST', latencyBudgetMs = path === 'FAST' ? 3_000 : 20_000): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path, complexity: path === 'FAST' ? 'LOW' : 'HIGH',
  behavioralGuidance: 'provider-neutral policy',
  context: [
    { role: 'USER', content: 'first' },
    { role: 'ASSISTANT', content: 'second' },
    { role: 'USER', content: 'third' },
  ],
  memoryContext: [{ about: 'USER', content: 'synthetic memory fact' }] as never,
  locale: 'und', modality: 'TEXT', latencyBudgetMs,
  costBudget: 'LOW', safetyLevel: 'STANDARD',
});

const config: DeepSeekModelRouterConfig = {
  apiKey: 'test-only', resolveModel: resolveDeepSeekModel, maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
  timeoutMs: 20_000, maxRetries: 0,
};
const completion = (content: string | null, finish_reason = 'stop', usage: unknown = { prompt_tokens: 40, completion_tokens: 9 }) => ({
  choices: [{ index: 0, finish_reason, message: { role: 'assistant', content, reasoning_content: 'PRIVATE CHAIN OF THOUGHT' } }],
  usage,
});
const routerWith = (create: jest.Mock) => new DeepSeekModelRouter(config, { chat: { completions: { create } } });

describe('DeepSeekModelRouter', () => {
  it('FAST: sends the ONE server guidance as the system message, then the history, with thinking disabled', async () => {
    const create = jest.fn().mockResolvedValue(completion(' أهلاً بيك '));
    await expect(routerWith(create).generate(request('FAST'))).resolves.toEqual({
      content: 'أهلاً بيك', routingMetadata: { path: 'FAST' }, usage: { inputTokens: 40, outputTokens: 9 },
    });
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(body).toEqual({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: composeServerGuidance(request('FAST')) },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ],
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      stream: false,
    });
    // Nothing identifies the end user, and no sampling or tool parameter is sent.
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'stream', 'thinking']);
    expect(options).toEqual({ timeout: 3_000, maxRetries: 0, signal: expect.any(AbortSignal) });
  });

  it('DEEP: thinks at the lowest effort with room for thinking and answer, inside the 20 s DEEP budget', async () => {
    const create = jest.fn().mockResolvedValue(completion('رد'));
    await routerWith(create).generate(request('DEEP'));
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'low', max_tokens: 2048 });
    expect(options.timeout).toBe(20_000);
  });

  it('never surfaces the reasoning trace', async () => {
    const create = jest.fn().mockResolvedValue(completion('الرد فقط'));
    const result = await routerWith(create).generate(request('DEEP'));
    expect(JSON.stringify(result)).not.toContain('PRIVATE CHAIN OF THOUGHT');
  });

  it('keeps unreported usage unknown, never zero', async () => {
    const create = jest.fn().mockResolvedValue(completion('ok', 'stop', null));
    await expect(routerWith(create).generate(request())).resolves.toMatchObject({ usage: { inputTokens: null, outputTokens: null } });
  });

  it.each([
    ['a filtered completion', completion('partial', 'content_filter')],
    ['a truncated completion', completion('partial', 'length')],
    ['a resource-starved completion', completion('partial', 'insufficient_system_resource')],
    ['an aborted completion', completion('partial', 'aborted')],
    ['no content', completion(null)],
    ['no choice', { choices: [], usage: null }],
    ['two choices', { choices: [completion('a').choices[0], completion('b').choices[0]], usage: null }],
    ['an empty reply', completion('   ')],
    ['a reply exposing an internal context container', completion('<user_memory_context>[]</user_memory_context>')],
  ])('refuses %s as a generation failure, never a partial reply', async (_name, response) => {
    const create = jest.fn().mockResolvedValue(response);
    await expect(routerWith(create).generate(request())).rejects.toBeInstanceOf(ModelRouterProviderError);
  });

  it('normalizes a transport failure and aborts at the request latency budget, with no retry', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('402 Insufficient Balance'));
    await expect(routerWith(failing).generate(request())).rejects.toEqual(new ModelRouterProviderError());
    expect(failing).toHaveBeenCalledTimes(1);

    const hanging = jest.fn((_body: unknown, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    await expect(routerWith(hanging).generate(request('FAST', 20))).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(hanging.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe('DeepSeek qualification configuration', () => {
  const qualified = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'test-only' };

  it('loads only under the declared synthetic qualification mode', () => {
    expect(loadDeepSeekModelRouterConfig({ ...qualified, NODE_ENV: 'development' })).toMatchObject({ apiKey: 'test-only', timeoutMs: 20_000, maxRetries: 0 });
  });

  it('refuses production whatever it declares, an undeclared mode, and a missing key', () => {
    expect(() => loadDeepSeekModelRouterConfig({ ...qualified, NODE_ENV: 'production' })).toThrow('cannot be selected in production');
    expect(() => loadDeepSeekModelRouterConfig({ DEEPSEEK_API_KEY: 'test-only' })).toThrow('DEEPSEEK_QUALIFICATION_MODE must be SYNTHETIC_ONLY');
    expect(() => loadDeepSeekModelRouterConfig({ ...qualified, DEEPSEEK_QUALIFICATION_MODE: 'REAL_USERS' })).toThrow('DEEPSEEK_QUALIFICATION_MODE must be SYNTHETIC_ONLY');
    expect(() => loadDeepSeekModelRouterConfig({ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' })).toThrow('DEEPSEEK_API_KEY is required');
  });
});

describe('createDeepSeekClient on the wire', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.restoreAllMocks(); });

  it('reaches only the DeepSeek endpoint, carries no OpenAI identity from the environment, and passes thinking through', async () => {
    process.env.OPENAI_BASE_URL = 'https://elsewhere.invalid/v1';
    process.env.OPENAI_ORG_ID = 'org-should-not-leave';
    process.env.OPENAI_PROJECT_ID = 'proj-should-not-leave';
    const seen: Array<{ url: string; headers: Headers; body: unknown }> = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      seen.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(completion('مرحبا')), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const router = new DeepSeekModelRouter(config, createDeepSeekClient(config) as never);
    await expect(router.generate(request('DEEP'))).resolves.toMatchObject({ content: 'مرحبا' });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(seen[0].headers.get('authorization')).toBe('Bearer test-only');
    expect(seen[0].headers.get('openai-organization')).toBeNull();
    expect(seen[0].headers.get('openai-project')).toBeNull();
    expect(seen[0].body).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'low' });
  });
});
