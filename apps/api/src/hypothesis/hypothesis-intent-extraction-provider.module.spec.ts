import { MODEL_ROUTER, type ModelRouterRequest } from '../model-router/model-router.types';
import { FakeHypothesisIntentExtractionProvider } from './fake-hypothesis-intent-extraction.provider';
import {
  DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_MODEL,
  loadHypothesisIntentExtractionOpenAIConfig,
} from './hypothesis-intent-extraction-provider.config';
import { createConfiguredHypothesisIntentExtractionProvider } from './hypothesis-intent-extraction-provider.module';
import {
  HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
  HypothesisIntentExtractionProviderError,
} from './hypothesis-intent-extraction-provider.types';

describe('Hypothesis intent extraction provider binding', () => {
  it('uses a separate fake port in tests without provider credentials', () => {
    expect(createConfiguredHypothesisIntentExtractionProvider({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisIntentExtractionProvider);
    expect(HYPOTHESIS_INTENT_EXTRACTION_PROVIDER).not.toBe(MODEL_ROUTER);
  });

  it('leaves the frozen conversation task and FAST/DEEP contract unchanged', () => {
    const task: ModelRouterRequest['task'] = 'CONVERSATIONAL_RESPONSE';
    expect(task).toBe('CONVERSATIONAL_RESPONSE');
    const config = loadHypothesisIntentExtractionOpenAIConfig({ OPENAI_API_KEY: 'test' });
    expect(config).not.toHaveProperty('path');
    expect(config).not.toHaveProperty('task');
    expect(JSON.stringify(config)).not.toMatch(/FAST|DEEP/);
  });

  it('defaults independently to OPENAI gpt-5-mini with bounded versioned settings', () => {
    expect(loadHypothesisIntentExtractionOpenAIConfig({ OPENAI_API_KEY: 'test' })).toEqual({
      provider: 'OPENAI', apiKey: 'test', model: DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_MODEL,
      timeoutMs: 5_000, maxOutputTokens: 256, maxRetries: 0, schemaVersion: 1,
    });
    expect(loadHypothesisIntentExtractionOpenAIConfig({
      OPENAI_API_KEY: 'test', HYPOTHESIS_INTENT_EXTRACTION_PROVIDER: 'openai',
      HYPOTHESIS_INTENT_EXTRACTION_MODEL: 'configured-model', HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS: '2500',
    })).toMatchObject({ provider: 'OPENAI', model: 'configured-model', timeoutMs: 2_500 });
  });

  it.each([
    [{}, 'OPENAI_API_KEY'],
    [{ OPENAI_API_KEY: 'test', HYPOTHESIS_INTENT_EXTRACTION_PROVIDER: 'anthropic' }, 'must be OPENAI'],
    [{ OPENAI_API_KEY: 'test', HYPOTHESIS_INTENT_EXTRACTION_MODEL: 'bad model' }, 'Invalid hypothesis'],
    [{ OPENAI_API_KEY: 'test', HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS: '999' }, 'between 1000 and 10000'],
  ])('fails closed for invalid configuration %#', (environment, message) => {
    expect(() => loadHypothesisIntentExtractionOpenAIConfig(environment)).toThrow(message);
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
