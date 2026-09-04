// T-03B2a - Thread-establishment provider configuration.
//
// Mirrors the T-03B1a focus-resolution binding: one configured provider, an
// explicit model shape, a bounded timeout and zero provider-side retries. The
// existing `openai` dependency is reused; no new dependency is introduced.
//
// Nothing reads this at Nest bootstrap. T-03B2a is not wired into the
// application, so starting the API never requires a Thread-provider key.

export const DEFAULT_THREAD_ESTABLISHMENT_MODEL = 'gpt-5-mini';
export const DEFAULT_THREAD_ESTABLISHMENT_TIMEOUT_MS = 8_000;
export const THREAD_ESTABLISHMENT_MAX_OUTPUT_TOKENS = 1_024;
export const THREAD_ESTABLISHMENT_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped an establishment decision change.
 */
export const THREAD_ESTABLISHMENT_PROMPT_VERSION = 'thread-establishment-evidence-path-v1';

export interface ThreadEstablishmentOpenAIConfig {
  provider: 'OPENAI';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: typeof THREAD_ESTABLISHMENT_MAX_OUTPUT_TOKENS;
  maxRetries: typeof THREAD_ESTABLISHMENT_MAX_RETRIES;
  promptVersion: typeof THREAD_ESTABLISHMENT_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadThreadEstablishmentOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ThreadEstablishmentOpenAIConfig {
  const provider = environment.THREAD_ESTABLISHMENT_PROVIDER?.trim().toUpperCase() || 'OPENAI';
  if (provider !== 'OPENAI') throw new Error('THREAD_ESTABLISHMENT_PROVIDER must be OPENAI.');
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for Thread establishment evaluation.');
  const model = environment.THREAD_ESTABLISHMENT_MODEL?.trim() || DEFAULT_THREAD_ESTABLISHMENT_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid Thread establishment model.');
  const timeoutMs = readTimeout(environment.THREAD_ESTABLISHMENT_TIMEOUT_MS);
  return {
    provider: 'OPENAI',
    apiKey,
    model,
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
