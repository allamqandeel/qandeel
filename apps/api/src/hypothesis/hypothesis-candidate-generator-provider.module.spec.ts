import { FakeHypothesisCandidateGenerator } from './fake-hypothesis-candidate.generator';
import { GeminiHypothesisCandidateGenerator } from './gemini-hypothesis-candidate.generator';
import {
  DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
  loadHypothesisCandidateGenerationGeminiConfig,
} from './hypothesis-candidate-generator-provider.config';
import { createConfiguredHypothesisCandidateGenerator } from './hypothesis-candidate-generator-provider.module';

describe('HypothesisCandidateGeneratorProviderModule', () => {
  it('uses the deterministic fake in tests without a real credential', () => {
    expect(createConfiguredHypothesisCandidateGenerator({ NODE_ENV: 'test' })).toBeInstanceOf(FakeHypothesisCandidateGenerator);
  });

  it('binds production to Gemini with the exact frozen defaults', () => {
    const environment = { NODE_ENV: 'production', GOOGLE_AI_API_KEY: 'test' };
    expect(createConfiguredHypothesisCandidateGenerator(environment)).toBeInstanceOf(GeminiHypothesisCandidateGenerator);
    expect(loadHypothesisCandidateGenerationGeminiConfig(environment)).toEqual({
      provider: 'GEMINI', apiKey: 'test', model: 'gemini-2.5-flash', timeoutMs: 5_000,
      maxOutputTokens: DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
      thinkingBudget: 0, maxRetries: 0, schemaVersion: 1,
    });
  });

  it.each([
    [{ NODE_ENV: 'production' }, 'GOOGLE_AI_API_KEY is required'],
    [{ GOOGLE_AI_API_KEY: 'test', HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER: 'OPENAI' }, 'must be GEMINI'],
    [{ GOOGLE_AI_API_KEY: 'test', HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS: '10001' }, 'must be between 1000 and 10000'],
    [{ GOOGLE_AI_API_KEY: 'test', HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS: '65537' }, 'must be between 1024 and 65536'],
  ])('fails closed for invalid production config %#', (environment, message) => {
    expect(() => loadHypothesisCandidateGenerationGeminiConfig(environment)).toThrow(message);
  });

  it('keeps the fake deterministic and preserves the existing generator port', async () => {
    const fake = new FakeHypothesisCandidateGenerator();
    fake.setOutput([]);
    const request = { userId: 'u', problem: 'p', domain: 'GENERAL', scope: 's', eligibleEvidence: [], existingActiveHypotheses: [], maxCandidateCount: 5 } as const;
    await expect(fake.generate(request)).resolves.toEqual([]);
    expect(fake.calls).toEqual([request]);
  });
});
