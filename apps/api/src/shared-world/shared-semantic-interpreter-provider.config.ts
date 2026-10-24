// S8A-04 CP1: the Shared semantic reading runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; zero retries.
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_SHARED_SEMANTIC_READING_TIMEOUT_MS = 15_000;
export const SHARED_SEMANTIC_READING_MAX_OUTPUT_TOKENS = 1_024;
export const SHARED_SEMANTIC_READING_MAX_RETRIES = 0 as const;

export interface SharedSemanticReadingDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof SHARED_SEMANTIC_READING_MAX_OUTPUT_TOKENS;
  maxRetries: typeof SHARED_SEMANTIC_READING_MAX_RETRIES;
}

export function loadSharedSemanticReadingDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): SharedSemanticReadingDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'SHARED_SEMANTIC_READING');
  const timeoutMs = readTimeout(environment.SHARED_SEMANTIC_READING_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'the Shared semantic reading');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs,
    maxOutputTokens: SHARED_SEMANTIC_READING_MAX_OUTPUT_TOKENS,
    maxRetries: SHARED_SEMANTIC_READING_MAX_RETRIES,
  };
}

/** Within the place pass's own 30 s reading bound (`shared-semantic-place.service.ts`). */
function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_SHARED_SEMANTIC_READING_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 30_000) {
    throw new Error('SHARED_SEMANTIC_READING_TIMEOUT_MS must be between 1000 and 30000.');
  }
  return parsed;
}
