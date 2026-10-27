// S8A-05 CP3: the Public semantic interpretation runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; zero retries.
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_PUBLIC_SEMANTIC_INTERPRETATION_TIMEOUT_MS = 15_000;
export const PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS = 1_024;
export const PUBLIC_SEMANTIC_INTERPRETATION_MAX_RETRIES = 0 as const;

export interface PublicSemanticInterpretationDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof PUBLIC_SEMANTIC_INTERPRETATION_MAX_RETRIES;
}

export function loadPublicSemanticInterpretationDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): PublicSemanticInterpretationDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'PUBLIC_SEMANTIC_INTERPRETATION');
  const timeoutMs = readTimeout(environment.PUBLIC_SEMANTIC_INTERPRETATION_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'the Public semantic interpretation');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs,
    maxOutputTokens: PUBLIC_SEMANTIC_INTERPRETATION_MAX_OUTPUT_TOKENS,
    maxRetries: PUBLIC_SEMANTIC_INTERPRETATION_MAX_RETRIES,
  };
}

/** Within the service's own 20 s bound on one interpreter attempt (`public-semantic.service.ts`). */
function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_PUBLIC_SEMANTIC_INTERPRETATION_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 19_000) {
    throw new Error('PUBLIC_SEMANTIC_INTERPRETATION_TIMEOUT_MS must be between 1000 and 19000.');
  }
  return parsed;
}
