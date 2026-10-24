// T-03B3 - Thread Continuity provider configuration.
//
// S8A-03 (D1): the one configured provider is DeepSeek Flash, through the shared DeepSeek client and its SYNTHETIC_ONLY
// qualification gate. The provider and the model are fixed in code; a bounded timeout and zero provider-side retries
// are unchanged. No new dependency is introduced.
//
// The provider IDENTITY (provider name + model) is readable WITHOUT a key so
// that the capture provenance of an exchange that never needs a continuity
// call (zero-CU, no independent focus, same-Session already-bound focus,
// replay) is recorded without touching DEEPSEEK_API_KEY. The key - and the
// qualification gate - are read only when an adapter is actually constructed
// for a real call.
//
// Nothing reads this at Nest bootstrap, so starting the API never requires a
// continuity-provider key.

import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_THREAD_CONTINUITY_TIMEOUT_MS = 8_000;
export const THREAD_CONTINUITY_MAX_OUTPUT_TOKENS = 1_024;
export const THREAD_CONTINUITY_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped a continuity decision change. S8A-03: the schema
 * now travels in the instruction (DeepSeek JSON Output), so the identity changed.
 */
export const THREAD_CONTINUITY_PROMPT_VERSION = 'thread-continuity-identity-deepseek-v1';

export interface ThreadContinuityProviderIdentity {
  provider: 'DEEPSEEK';
  model: typeof DEEPSEEK_FLASH_MODEL;
}

export interface ThreadContinuityDeepSeekConfig extends ThreadContinuityProviderIdentity {
  apiKey: string;
  timeoutMs: number;
  maxOutputTokens: typeof THREAD_CONTINUITY_MAX_OUTPUT_TOKENS;
  maxRetries: typeof THREAD_CONTINUITY_MAX_RETRIES;
  promptVersion: typeof THREAD_CONTINUITY_PROMPT_VERSION;
  schemaVersion: 1;
}

/** The provider identity alone. Reads NO credential. */
export function loadThreadContinuityProviderIdentity(environment: NodeJS.ProcessEnv = process.env): ThreadContinuityProviderIdentity {
  assertDeepSeekFlashSelection(environment, 'THREAD_CONTINUITY');
  return { provider: 'DEEPSEEK', model: DEEPSEEK_FLASH_MODEL };
}

export function loadThreadContinuityDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ThreadContinuityDeepSeekConfig {
  const identity = loadThreadContinuityProviderIdentity(environment);
  const timeoutMs = readTimeout(environment.THREAD_CONTINUITY_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'Thread continuity evaluation');
  return {
    ...identity,
    apiKey,
    timeoutMs,
    maxOutputTokens: THREAD_CONTINUITY_MAX_OUTPUT_TOKENS,
    maxRetries: THREAD_CONTINUITY_MAX_RETRIES,
    promptVersion: THREAD_CONTINUITY_PROMPT_VERSION,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_THREAD_CONTINUITY_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 20_000) {
    throw new Error('THREAD_CONTINUITY_TIMEOUT_MS must be between 1000 and 20000.');
  }
  return parsed;
}
