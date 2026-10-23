// T-03B2a - Thread-establishment provider configuration.
//
// S8A-03 (D1): the one configured provider is DeepSeek Flash, through the shared DeepSeek client and its SYNTHETIC_ONLY
// qualification gate. The provider and the model are fixed in code; a bounded timeout and zero provider-side retries
// are unchanged. No new dependency is introduced.
//
// Nothing reads this at Nest bootstrap: the binding reads it on first actual need, so starting the API never requires a
// provider key.

import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_THREAD_ESTABLISHMENT_TIMEOUT_MS = 8_000;
export const THREAD_ESTABLISHMENT_MAX_OUTPUT_TOKENS = 1_024;
export const THREAD_ESTABLISHMENT_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped an establishment decision change. S8A-03: the schema now
 * travels in the instruction (DeepSeek JSON Output), so the identity changed.
 */
export const THREAD_ESTABLISHMENT_PROMPT_VERSION = 'thread-establishment-evidence-path-deepseek-v1';

export interface ThreadEstablishmentDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof THREAD_ESTABLISHMENT_MAX_OUTPUT_TOKENS;
  maxRetries: typeof THREAD_ESTABLISHMENT_MAX_RETRIES;
  promptVersion: typeof THREAD_ESTABLISHMENT_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadThreadEstablishmentDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ThreadEstablishmentDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'THREAD_ESTABLISHMENT');
  const timeoutMs = readTimeout(environment.THREAD_ESTABLISHMENT_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'Thread establishment evaluation');
  return {
    provider: 'DEEPSEEK',
    apiKey,
    model: DEEPSEEK_FLASH_MODEL,
    timeoutMs,
    maxOutputTokens: THREAD_ESTABLISHMENT_MAX_OUTPUT_TOKENS,
    maxRetries: THREAD_ESTABLISHMENT_MAX_RETRIES,
    promptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_THREAD_ESTABLISHMENT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 20_000) {
    throw new Error('THREAD_ESTABLISHMENT_TIMEOUT_MS must be between 1000 and 20000.');
  }
  return parsed;
}
