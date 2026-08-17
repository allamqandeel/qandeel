import { ModelRouterProviderError, type ModelRouterRequest } from '../../model-router.types';
import { ClaudeModelRouter, createClaudeClient } from './claude-model-router';
import {
  CLAUDE_MODEL_ID,
  loadClaudeModelRouterConfig,
  type ClaudeModelRouterConfig,
} from './claude-model-router.config';

const request = (path: 'FAST' | 'DEEP' = 'FAST'): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path, complexity: path === 'FAST' ? 'LOW' : 'HIGH',
  context: [
    { role: 'USER', content: 'first' },
    { role: 'ASSISTANT', content: 'second' },
    { role: 'USER', content: 'third' },
  ],
  locale: 'und', modality: 'TEXT', latencyBudgetMs: 3_000,
  costBudget: 'LOW', safetyLevel: 'STANDARD',
});

const config: ClaudeModelRouterConfig = {
  apiKey: 'test-only', model: CLAUDE_MODEL_ID, maxOutputTokens: 1024, timeoutMs: 10_000,
  maxRetries: 0,
};

describe('ClaudeModelRouter', () => {
  it('translates multi-turn context and normalizes text and token usage', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: ' normalized response ' }],
      usage: { input_tokens: 12, output_tokens: 4 },
    });
    const router = new ClaudeModelRouter(config, { messages: { create } });

    await expect(router.generate(request())).resolves.toEqual({
      content: 'normalized response', routingMetadata: { path: 'FAST' },
      usage: { inputTokens: 12, outputTokens: 4 },
    });
    expect(create).toHaveBeenCalledWith({
      model: CLAUDE_MODEL_ID,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ],
    }, { timeout: 3_000 });
  });

  it('disables SDK retries and bounds the single provider attempt to the route budget', async () => {
    const client = createClaudeClient(config);
    expect(client.maxRetries).toBe(0);

    const create = jest.fn().mockRejectedValue(
      Object.assign(new Error('private timeout detail'), { name: 'APIConnectionTimeoutError' }),
    );
    const router = new ClaudeModelRouter(config, { messages: { create } });
    await expect(router.generate(request())).rejects.toEqual(new ModelRouterProviderError());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.any(Object), { timeout: 3_000 });
  });

  it.each(['FAST', 'DEEP'] as const)('keeps %s as metadata without adapter-owned model routing', async (path) => {
    const create = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } });
    const router = new ClaudeModelRouter(config, { messages: { create } });
    await expect(router.generate(request(path))).resolves.toMatchObject({ routingMetadata: { path } });
    expect(create.mock.calls[0][0].model).toBe(CLAUDE_MODEL_ID);
  });

  it('normalizes provider and timeout failures without private detail', async () => {
    const create = jest.fn().mockRejectedValue(
      Object.assign(new Error('secret provider response'), { name: 'APIConnectionTimeoutError' }),
    );
    const router = new ClaudeModelRouter(config, { messages: { create } });
    await expect(router.generate(request())).rejects.toEqual(new ModelRouterProviderError());
  });

  it('fails safely when credentials are missing', () => {
    expect(() => loadClaudeModelRouterConfig({})).toThrow('ANTHROPIC_API_KEY is required');
  });
});
