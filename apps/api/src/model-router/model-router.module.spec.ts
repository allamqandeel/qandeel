import { FakeModelRouter } from './fake-model-router';
import { createConfiguredModelRouter } from './model-router.module';
import { ClaudeModelRouter } from './providers/anthropic/claude-model-router';
import { OpenAIModelRouter } from './providers/openai/openai-model-router';

describe('ModelRouter provider activation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps the deterministic fake test-only without provider credentials', () => {
    expect(createConfiguredModelRouter({ NODE_ENV: 'test' })).toBeInstanceOf(FakeModelRouter);
  });

  it.each([
    ['anthropic', ClaudeModelRouter],
    ['openai', OpenAIModelRouter],
  ] as const)('selects only the server-owned %s configuration', (provider, Router) => {
    const instance = {} as InstanceType<typeof Router>;
    jest.spyOn(Router, 'fromEnvironment').mockReturnValue(instance);
    expect(createConfiguredModelRouter({ NODE_ENV: 'production', MODEL_PROVIDER: provider })).toBe(instance);
  });

  it.each([undefined, '', 'client-choice', 'claude'])('fails closed for invalid production configuration: %s', (provider) => {
    expect(() => createConfiguredModelRouter({
      NODE_ENV: 'production',
      ...(provider === undefined ? {} : { MODEL_PROVIDER: provider }),
    })).toThrow('MODEL_PROVIDER must be either anthropic or openai.');
  });
});
