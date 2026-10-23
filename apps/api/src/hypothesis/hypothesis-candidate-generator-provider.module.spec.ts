import { FakeHypothesisCandidateGenerator } from './fake-hypothesis-candidate.generator';
import { DeepSeekHypothesisCandidateGenerator } from './deepseek-hypothesis-candidate.generator';
import {
  DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
  loadHypothesisCandidateGenerationDeepSeekConfig,
} from './hypothesis-candidate-generator-provider.config';
import { createConfiguredHypothesisCandidateGenerator } from './hypothesis-candidate-generator-provider.module';

const QUALIFIED = { DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'test' };

describe('HypothesisCandidateGeneratorProviderModule', () => {
  it('uses the deterministic fake in tests without a real credential', () => {
    expect(createConfiguredHypothesisCandidateGenerator({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisCandidateGenerator);
  });

  it('binds the synthetic qualification environment to DeepSeek Flash with the exact bounded defaults', () => {
    const environment = { NODE_ENV: 'development', ...QUALIFIED };
    expect(createConfiguredHypothesisCandidateGenerator(environment)).toBeInstanceOf(DeepSeekHypothesisCandidateGenerator);
    expect(loadHypothesisCandidateGenerationDeepSeekConfig(environment)).toEqual({
      provider: 'DEEPSEEK', apiKey: 'test', model: 'deepseek-flash', timeoutMs: 5_000,
      maxOutputTokens: DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
      maxRetries: 0, schemaVersion: 1,
    });
    expect(DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS).toBe(4_096);
  });

  it.each([
    [{ NODE_ENV: 'production', ...QUALIFIED }, 'cannot be selected in production'],
    [{ GOOGLE_AI_API_KEY: 'test' }, 'SYNTHETIC_ONLY'],
    [{ DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY' }, 'DEEPSEEK_API_KEY is required'],
    [{ ...QUALIFIED, HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER: 'GEMINI' }, 'must be DEEPSEEK'],
    [{ ...QUALIFIED, HYPOTHESIS_CANDIDATE_GENERATION_MODEL: 'gemini-2.5-flash' }, 'must be deepseek-flash'],
    [{ ...QUALIFIED, HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS: '10001' }, 'must be between 1000 and 10000'],
    [{ ...QUALIFIED, HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS: '8193' }, 'must be between 1024 and 8192'],
  ])('fails closed for invalid configuration %#', (environment, message) => {
    expect(() => loadHypothesisCandidateGenerationDeepSeekConfig(environment)).toThrow(message);
  });

  it('keeps the fake deterministic and preserves the existing generator port', async () => {
    const fake = new FakeHypothesisCandidateGenerator();
    fake.setOutput([]);
    const request = { userId: 'u', problem: 'p', domain: 'GENERAL', scope: 's', eligibleEvidence: [], existingActiveHypotheses: [], maxCandidateCount: 5 } as const;
    await expect(fake.generate(request)).resolves.toEqual([]);
    expect(fake.calls).toEqual([request]);
  });
});
