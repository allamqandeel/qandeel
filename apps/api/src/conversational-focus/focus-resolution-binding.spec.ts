import { deepSeekFocusResolutionBinding, type FocusResolutionClientDecorator } from './focus-resolution-binding';
import { DeepSeekFocusResolutionProvider } from './deepseek-focus-resolution.provider';

const QUALIFIED = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'k' };

describe('the lazy focus-resolution binding', () => {
  it('creating the factory reads no environment; only calling it does', () => {
    const decorate = jest.fn((client) => client);
    const factory = deepSeekFocusResolutionBinding({}, decorate);
    expect(typeof factory).toBe('function');
    expect(() => factory()).toThrow(/SYNTHETIC_ONLY/u);
    expect(decorate).not.toHaveBeenCalled();
  });

  it('yields the DeepSeek adapter over the decorated (accounted) client and its provenance identity without any network call', () => {
    const decorated = { chat: { completions: { create: jest.fn() } } };
    const decorate = jest.fn(() => decorated);
    const binding = deepSeekFocusResolutionBinding(QUALIFIED, decorate)();
    expect(binding.provider).toBeInstanceOf(DeepSeekFocusResolutionProvider);
    expect(decorate).toHaveBeenCalledTimes(1);
    expect(binding.providerName).toBe('DEEPSEEK');
    expect(binding.providerModel).toBe('deepseek-flash');
    expect(decorated.chat.completions.create).not.toHaveBeenCalled();
  });

  it('refuses a leftover provider or model selection, an OpenAI key alone, and production', () => {
    const decorate: FocusResolutionClientDecorator = (client) => client;
    expect(() => deepSeekFocusResolutionBinding({ ...QUALIFIED, FOCUS_RESOLUTION_PROVIDER: 'OPENAI' }, decorate)()).toThrow(/must be DEEPSEEK/u);
    expect(() => deepSeekFocusResolutionBinding({ ...QUALIFIED, FOCUS_RESOLUTION_MODEL: 'gpt-5-mini' }, decorate)()).toThrow(/must be deepseek-flash/u);
    expect(() => deepSeekFocusResolutionBinding({ OPENAI_API_KEY: 'k' }, decorate)()).toThrow(/SYNTHETIC_ONLY/u);
    expect(() => deepSeekFocusResolutionBinding({ ...QUALIFIED, NODE_ENV: 'production' }, decorate)()).toThrow(/cannot be selected in production/u);
  });
});
