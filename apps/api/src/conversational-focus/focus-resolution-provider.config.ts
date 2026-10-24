// T-03B1a - focus-resolution provider configuration.
//
// S8A-03 (D1): the one configured provider is DeepSeek Flash, through the shared DeepSeek client and its SYNTHETIC_ONLY
// qualification gate. The provider and the model are fixed in code; a bounded timeout and zero provider-side retries
// are unchanged. No new dependency is introduced.
//
// Nothing reads this at Nest bootstrap: the binding reads it on first actual need, so starting the API never requires a
// provider key.

import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_FOCUS_RESOLUTION_TIMEOUT_MS = 8_000;
export const FOCUS_RESOLUTION_MAX_OUTPUT_TOKENS = 4_096;
export const FOCUS_RESOLUTION_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped a resolution decision change. S8A-03: the schema
 * now travels in the instruction (DeepSeek JSON Output), so the identity changed.
 */
export const FOCUS_RESOLUTION_PROMPT_VERSION = 'focus-resolution-anchored-deepseek-v1';

export interface FocusResolutionDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof FOCUS_RESOLUTION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof FOCUS_RESOLUTION_MAX_RETRIES;
  promptVersion: typeof FOCUS_RESOLUTION_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadFocusResolutionDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FocusResolutionDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'FOCUS_RESOLUTION');
  const timeoutMs = readTimeout(environment.FOCUS_RESOLUTION_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'conversational focus resolution');
  return {
    provider: 'DEEPSEEK',
    apiKey,
    model: DEEPSEEK_FLASH_MODEL,
    timeoutMs,
    maxOutputTokens: FOCUS_RESOLUTION_MAX_OUTPUT_TOKENS,
    maxRetries: FOCUS_RESOLUTION_MAX_RETRIES,
    promptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_FOCUS_RESOLUTION_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 20_000) {
    throw new Error('FOCUS_RESOLUTION_TIMEOUT_MS must be between 1000 and 20000.');
  }
  return parsed;
}
