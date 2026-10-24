// S8A-03 (D1): hypothesis intent extraction runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; the timeout bounds, the output
// bound and zero retries are unchanged.
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS = 5_000;
export const HYPOTHESIS_INTENT_EXTRACTION_MAX_OUTPUT_TOKENS = 256;
export const HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES = 0 as const;

export interface HypothesisIntentExtractionDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof HYPOTHESIS_INTENT_EXTRACTION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof HYPOTHESIS_INTENT_EXTRACTION_MAX_RETRIES;
  schemaVersion: 1;
}

export function loadHypothesisIntentExtractionDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisIntentExtractionDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'HYPOTHESIS_INTENT_EXTRACTION');
  const timeoutMs = readTimeout(environment.HYPOTHESIS_INTENT_EXTRACTION_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'hypothesis intent extraction');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs,
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
