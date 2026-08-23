import { HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION } from './hypothesis-candidate-generator-provider.types';

export const DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MODEL = 'gemini-2.5-flash';
export const DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS = 5_000;
export const DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS = 65_536;
export const HYPOTHESIS_CANDIDATE_GENERATION_THINKING_BUDGET = 0 as const;
export const HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES = 0 as const;

export interface HypothesisCandidateGenerationGeminiConfig {
  provider: 'GEMINI';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  thinkingBudget: typeof HYPOTHESIS_CANDIDATE_GENERATION_THINKING_BUDGET;
  maxRetries: typeof HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES;
  schemaVersion: typeof HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION;
}

export function loadHypothesisCandidateGenerationGeminiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisCandidateGenerationGeminiConfig {
  const provider = environment.HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER?.trim().toUpperCase() || 'GEMINI';
  if (provider !== 'GEMINI') throw new Error('HYPOTHESIS_CANDIDATE_GENERATION_PROVIDER must be GEMINI.');
  const apiKey = environment.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is required for hypothesis candidate generation.');
  const model = environment.HYPOTHESIS_CANDIDATE_GENERATION_MODEL?.trim() ||
    DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) {
    throw new Error('Invalid hypothesis candidate generation model.');
  }
  return {
    provider: 'GEMINI', apiKey, model,
    timeoutMs: boundedInteger(
      environment.HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS,
      DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS,
      1_000, 10_000,
      'HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS',
    ),
    maxOutputTokens: boundedInteger(
      environment.HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
      DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
      1_024, DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
      'HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS',
    ),
    thinkingBudget: HYPOTHESIS_CANDIDATE_GENERATION_THINKING_BUDGET,
    maxRetries: HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES,
    schemaVersion: HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION,
  };
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}
