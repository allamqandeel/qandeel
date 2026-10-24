import { MODEL_ROUTER, type ModelRouterRequest } from '../model-router/model-router.types';
import { FakeHypothesisIntentExtractionProvider } from './fake-hypothesis-intent-extraction.provider';
import { loadHypothesisIntentExtractionDeepSeekConfig } from './hypothesis-intent-extraction-provider.config';
import { createConfiguredHypothesisIntentExtractionProvider } from './hypothesis-intent-extraction-provider.module';
import {
  HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
  HypothesisIntentExtractionProviderError,
} from './hypothesis-intent-extraction-provider.types';

const QUALIFIED = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'test' };

describe('Hypothesis intent extraction provider binding', () => {
  it('uses a separate fake port in tests without provider credentials', () => {
    expect(createConfiguredHypothesisIntentExtractionProvider({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisIntentExtractionProvider);
    expect(HYPOTHESIS_INTENT_EXTRACTION_PROVIDER).not.toBe(MODEL_ROUTER);
  });

  it('leaves the frozen conversation task and FAST/DEEP contract unchanged', () => {
    const task: ModelRouterRequest['task'] = 'CONVERSATIONAL_RESPONSE';
    expect(task).toBe('CONVERSATIONAL_RESPONSE');
    const config = loadHypothesisIntentExtractionDeepSeekConfig(QUALIFIED);
    expect(config).not.toHaveProperty('path');
    expect(config).not.toHaveProperty('task');
    // The provider is named DEEPSEEK; no FAST / DEEP processing path is a value of the extraction configuration.
    expect(Object.values(config)).not.toContain('FAST');
    expect(Object.values(config)).not.toContain('DEEP');
  });

  it('is DeepSeek Flash only, with bounded versioned settings', () => {
    expect(loadHypothesisIntentExtractionDeepSeekConfig(QUALIFIED)).toEqual({
      provider: 'DEEPSEEK', apiKey: 'test', model: 'deepseek-flash',
      timeoutMs: 5_000, maxOutputTokens: 256, maxRetries: 0, schemaVersion: 1,
    });
    expect(loadHypothesisIntentExtractionDeepSeekConfig({
      ...QUALIFIED, HYPOTHESIS_INTENT_EXTRACTION_PROVIDER: 'deepseek',
      HYPOTHESIS_INTENT_EXTRACTION_MODEL: 'deepseek-flash', HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS: '2500',
    })).toMatchObject({ provider: 'DEEPSEEK', model: 'deepseek-flash', timeoutMs: 2_500 });
  });

  it.each([
    [{}, 'SYNTHETIC_ONLY'],
    [{ OPENAI_API_KEY: 'test' }, 'SYNTHETIC_ONLY'],
    [{ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' }, 'DEEPSEEK_API_KEY'],
    [{ ...QUALIFIED, NODE_ENV: 'production' }, 'cannot be selected in production'],
    [{ ...QUALIFIED, HYPOTHESIS_INTENT_EXTRACTION_PROVIDER: 'openai' }, 'must be DEEPSEEK'],
    [{ ...QUALIFIED, HYPOTHESIS_INTENT_EXTRACTION_MODEL: 'gpt-5-mini' }, 'must be deepseek-flash'],
    [{ ...QUALIFIED, HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS: '999' }, 'between 1000 and 10000'],
  ])('fails closed for invalid configuration %#', (environment, message) => {
    expect(() => loadHypothesisIntentExtractionDeepSeekConfig(environment)).toThrow(message);
  });

  it('provides a deterministic call-counting fake with sanitized failures', async () => {
    const fake = new FakeHypothesisIntentExtractionProvider();
    const request = {
      currentUserText: 'text', triggerReason: 'EXPLICIT_WHY_SELF' as const,
      allowedDomains: ['GENERAL'] as const, eligibleEvidence: [], maxSelectedEvidence: 1, schemaVersion: 1 as const,
    };
    fake.setOutput({ problemText: 'text', domain: 'GENERAL', selectedEvidenceIds: ['memory:id'] });
    await expect(fake.extract(request)).resolves.toMatchObject({ domain: 'GENERAL' });
    expect(fake.calls).toHaveLength(1);
    fake.setFailure('TIMEOUT');
    await expect(fake.extract(request)).rejects.toEqual(new HypothesisIntentExtractionProviderError('TIMEOUT'));
    expect(fake.calls).toHaveLength(2);
  });
});
