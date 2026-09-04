import { openAiFocusResolutionBinding } from './focus-resolution-binding';
import { OpenAiFocusResolutionProvider } from './openai-focus-resolution.provider';

describe('the lazy focus-resolution binding', () => {
  it('creating the factory reads no environment; only calling it does', () => {
    const factory = openAiFocusResolutionBinding({});
    expect(typeof factory).toBe('function');
    expect(() => factory()).toThrow(/OPENAI_API_KEY/u);
  });

  it('yields the OpenAI adapter and its provenance identity without any network call', () => {
    const binding = openAiFocusResolutionBinding({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_MODEL: 'gpt-5-mini' })();
    expect(binding.provider).toBeInstanceOf(OpenAiFocusResolutionProvider);
    expect(binding.providerName).toBe('OPENAI');
    expect(binding.providerModel).toBe('gpt-5-mini');
  });

  it('refuses a non-OpenAI provider selection', () => {
    expect(() => openAiFocusResolutionBinding({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_PROVIDER: 'ANTHROPIC' })()).toThrow(/must be OPENAI/u);
  });
});
