import { FakeModelRouter } from './fake-model-router';
import { createConfiguredModelRouter } from './model-router.module';
import { ClaudeModelRouter } from './providers/anthropic/claude-model-router';
import { OpenAIModelRouter } from './providers/openai/openai-model-router';
import { DeepSeekModelRouter } from './providers/deepseek/deepseek-model-router';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';

describe('ModelRouter provider activation', () => {
  const telemetry=new TelemetryService(new CorrelationService());
  afterEach(() => jest.restoreAllMocks());

  it('keeps the deterministic fake test-only without provider credentials', () => {
    expect(createConfiguredModelRouter({ NODE_ENV: 'test' })).toBeInstanceOf(FakeModelRouter);
  });

  it.each([
    ['anthropic', ClaudeModelRouter],
    ['openai', OpenAIModelRouter],
    ['deepseek', DeepSeekModelRouter],
  ] as const)('selects only the server-owned %s configuration', (provider, Router) => {
    const instance = {} as InstanceType<typeof Router>;
    jest.spyOn(Router, 'fromEnvironment').mockReturnValue(instance);
    expect(createConfiguredModelRouter({ NODE_ENV: 'production', MODEL_PROVIDER: provider },telemetry)).toBe(instance);
  });

  it.each([undefined, '', 'client-choice', 'claude'])('fails closed for invalid production configuration: %s', (provider) => {
    expect(() => createConfiguredModelRouter({
      NODE_ENV: 'production',
      ...(provider === undefined ? {} : { MODEL_PROVIDER: provider }),
    },telemetry)).toThrow('MODEL_PROVIDER must be one of anthropic, openai or deepseek.');
  });

  it('S8A-01: composes DeepSeek accounted, and its qualification configuration refuses a production process', () => {
    const fromEnvironment = jest.spyOn(DeepSeekModelRouter, 'fromEnvironment');
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { NODE_ENV: 'production', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'test-only' });
      expect(() => createConfiguredModelRouter({ NODE_ENV: 'production', MODEL_PROVIDER: 'deepseek' }, telemetry)).toThrow('cannot be selected in production');
      expect(fromEnvironment).toHaveBeenCalledWith(telemetry, expect.any(Object));
    } finally { process.env = saved; }
  });

  it('requires canonical telemetry for every production provider',()=>{
    expect(()=>createConfiguredModelRouter({NODE_ENV:'production',MODEL_PROVIDER:'openai'})).toThrow('TelemetryService is required');
  });
});
