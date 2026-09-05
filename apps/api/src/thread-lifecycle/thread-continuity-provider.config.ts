// T-03B3 - Thread Continuity provider configuration.
//
// Mirrors the T-03B1a / T-03B2a bindings: one configured provider, an
// explicit model shape, a bounded timeout and zero provider-side retries. The
// existing `openai` dependency is reused; no new dependency is introduced.
//
// The provider IDENTITY (provider name + model) is readable WITHOUT a key so
// that the capture provenance of an exchange that never needs a continuity
// call (zero-CU, no independent focus, same-Session already-bound focus,
// replay) is recorded without touching OPENAI_API_KEY. The key is read only
// when an adapter is actually constructed for a real call.
//
// Nothing reads this at Nest bootstrap. T-03B3 is not wired into the
// application, so starting the API never requires a continuity-provider key.

export const DEFAULT_THREAD_CONTINUITY_MODEL = 'gpt-5-mini';
export const DEFAULT_THREAD_CONTINUITY_TIMEOUT_MS = 8_000;
export const THREAD_CONTINUITY_MAX_OUTPUT_TOKENS = 1_024;
export const THREAD_CONTINUITY_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped a continuity decision change.
 */
export const THREAD_CONTINUITY_PROMPT_VERSION = 'thread-continuity-identity-v1';

export interface ThreadContinuityProviderIdentity {
  provider: 'OPENAI';
  model: string;
}

export interface ThreadContinuityOpenAIConfig extends ThreadContinuityProviderIdentity {
  apiKey: string;
  timeoutMs: number;
  maxOutputTokens: typeof THREAD_CONTINUITY_MAX_OUTPUT_TOKENS;
  maxRetries: typeof THREAD_CONTINUITY_MAX_RETRIES;
  promptVersion: typeof THREAD_CONTINUITY_PROMPT_VERSION;
  schemaVersion: 1;
}

/** The provider identity alone. Reads NO credential. */
export function loadThreadContinuityProviderIdentity(environment: NodeJS.ProcessEnv = process.env): ThreadContinuityProviderIdentity {
  const provider = environment.THREAD_CONTINUITY_PROVIDER?.trim().toUpperCase() || 'OPENAI';
  if (provider !== 'OPENAI') throw new Error('THREAD_CONTINUITY_PROVIDER must be OPENAI.');
  const model = environment.THREAD_CONTINUITY_MODEL?.trim() || DEFAULT_THREAD_CONTINUITY_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid Thread continuity model.');
  return { provider: 'OPENAI', model };
}

export function loadThreadContinuityOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ThreadContinuityOpenAIConfig {
  const identity = loadThreadContinuityProviderIdentity(environment);
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for Thread continuity evaluation.');
  const timeoutMs = readTimeout(environment.THREAD_CONTINUITY_TIMEOUT_MS);
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
