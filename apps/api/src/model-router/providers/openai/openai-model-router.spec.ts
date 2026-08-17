import { ModelRouterProviderError, type ModelRouterRequest } from '../../model-router.types';
import { createOpenAIClient, OpenAIModelRouter } from './openai-model-router';
import {
  loadOpenAIModelRouterConfig,
  OPENAI_TEXT_MODEL_ID,
  type OpenAIModelRouterConfig,
} from './openai-model-router.config';

const request = (path: 'FAST' | 'DEEP' = 'FAST'): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path, complexity: path === 'FAST' ? 'LOW' : 'HIGH',
  behavioralGuidance: 'provider-neutral policy',
  context: [
    { role: 'USER', content: 'first' },
    { role: 'ASSISTANT', content: 'second' },
    { role: 'USER', content: 'third' },
  ],
  locale: 'und', modality: 'TEXT', latencyBudgetMs: 3_000,
  costBudget: 'LOW', safetyLevel: 'STANDARD',
});

const config: OpenAIModelRouterConfig = {
  apiKey: 'test-only', model: OPENAI_TEXT_MODEL_ID, maxOutputTokens: 1024,
  timeoutMs: 10_000, maxRetries: 0,
};

describe('OpenAIModelRouter', () => {
  it('translates multi-turn context and normalizes Responses text and usage', async () => {
    const create = jest.fn().mockResolvedValue({
      output_text: ' normalized response ', usage: { input_tokens: 12, output_tokens: 4 },
    });
    const router = new OpenAIModelRouter(config, { responses: { create } });

    await expect(router.generate(request())).resolves.toEqual({
      content: 'normalized response', routingMetadata: { path: 'FAST' },
      usage: { inputTokens: 12, outputTokens: 4 },
    });
    expect(create).toHaveBeenCalledWith({
      model: OPENAI_TEXT_MODEL_ID,
      instructions: 'provider-neutral policy',
      input: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ],
      max_output_tokens: 1024,
      store: false,
    }, expect.objectContaining({ timeout: 3_000, maxRetries: 0 }));
  });

  it('keeps behavioral guidance out of USER/ASSISTANT history', async () => {
    const create = jest.fn().mockResolvedValue({ output_text: 'ok', usage: null });
    const router = new OpenAIModelRouter(config, { responses: { create } });
    await router.generate(request());
    const body = create.mock.calls[0][0];
    expect(body.instructions).toBe('provider-neutral policy');
    expect(JSON.stringify(body.input)).not.toContain('provider-neutral policy');
  });

  it.each(['FAST', 'DEEP'] as const)('uses the same centralized model for provider-neutral %s', async (path) => {
    const create = jest.fn().mockResolvedValue({ output_text: 'ok', usage: { input_tokens: 1, output_tokens: 1 } });
    const router = new OpenAIModelRouter(config, { responses: { create } });
    await expect(router.generate(request(path))).resolves.toMatchObject({ routingMetadata: { path } });
    expect(create.mock.calls[0][0].model).toBe(OPENAI_TEXT_MODEL_ID);
  });

  it('disables hidden retries and bounds one attempt to the FAST route budget', async () => {
    const client = createOpenAIClient(config);
    expect(client.maxRetries).toBe(0);
    const create = jest.fn().mockRejectedValue(new Error('private request id and provider body'));
    const router = new OpenAIModelRouter(config, { responses: { create } });
    await expect(router.generate(request())).rejects.toEqual(new ModelRouterProviderError());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ timeout: 3_000, maxRetries: 0 }));
  });

  it('uses the tighter provider timeout and suppresses raw provider failures', async () => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error('secret'), { request_id: 'private' }));
    const router = new OpenAIModelRouter({ ...config, timeoutMs: 100 }, { responses: { create } });
    await expect(router.generate({ ...request('DEEP'), latencyBudgetMs: 10_000 })).rejects.toEqual(new ModelRouterProviderError());
    expect(create).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ timeout: 100 }));
  });

  it('fails safely when credentials are missing', () => {
    expect(() => loadOpenAIModelRouterConfig({})).toThrow('OPENAI_API_KEY is required');
  });
});
