export const DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_MODEL = 'gpt-5-mini';
export const DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS = 5_000;
export const HYPOTHESIS_INTENT_EXTRACTION_MAX_OUTPUT_TOKENS = 256;
export const HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES = 0 as const;

export interface HypothesisIntentExtractionOpenAIConfig {
  provider: 'OPENAI';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: typeof HYPOTHESIS_INTENT_EXTRACTION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES;
  schemaVersion: 1;
}

export function loadHypothesisIntentExtractionOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisIntentExtractionOpenAIConfig {
  const provider = environment.HYPOTHESIS_INTENT_EXTRACTION_PROVIDER?.trim().toUpperCase() || 'OPENAI';
  if (provider !== 'OPENAI') throw new Error('HYPOTHESIS_INTENT_EXTRACTION_PROVIDER must be OPENAI.');
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for hypothesis intent extraction.');
  const model = environment.HYPOTHESIS_INTENT_EXTRACTION_MODEL?.trim() || DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid hypothesis intent extraction model.');
  const timeoutMs = readTimeout(environment.HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS);
  return {
    provider: 'OPENAI', apiKey, model, timeoutMs,
    maxOutputTokens: HYPOTHESIS_INTENT_EXTRACTION_MAX_OUTPUT_TOKENS,
    maxRetries: HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 10_000) {
    throw new Error('HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS must be between 1000 and 10000.');
  }
  return parsed;
}
