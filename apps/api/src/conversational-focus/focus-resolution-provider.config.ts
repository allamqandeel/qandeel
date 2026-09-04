// T-03B1a - focus-resolution provider configuration.
//
// Mirrors the T-03A1 segmentation binding: one configured provider, an
// explicit model shape, a bounded timeout and zero provider-side retries. The
// existing `openai` dependency is reused; no new dependency is introduced.
//
// Nothing reads this at Nest bootstrap. T-03B1a is not wired into the
// application, so starting the API never requires a focus-provider key.

export const DEFAULT_FOCUS_RESOLUTION_MODEL = 'gpt-5-mini';
export const DEFAULT_FOCUS_RESOLUTION_TIMEOUT_MS = 8_000;
export const FOCUS_RESOLUTION_MAX_OUTPUT_TOKENS = 4_096;
export const FOCUS_RESOLUTION_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every prepared result. It changes whenever
 * the instructions that shaped a resolution decision change.
 */
export const FOCUS_RESOLUTION_PROMPT_VERSION = 'focus-resolution-anchored-v1';

export interface FocusResolutionOpenAIConfig {
  provider: 'OPENAI';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: typeof FOCUS_RESOLUTION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof FOCUS_RESOLUTION_MAX_RETRIES;
  promptVersion: typeof FOCUS_RESOLUTION_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadFocusResolutionOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FocusResolutionOpenAIConfig {
  const provider = environment.FOCUS_RESOLUTION_PROVIDER?.trim().toUpperCase() || 'OPENAI';
  if (provider !== 'OPENAI') throw new Error('FOCUS_RESOLUTION_PROVIDER must be OPENAI.');
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for conversational focus resolution.');
  const model = environment.FOCUS_RESOLUTION_MODEL?.trim() || DEFAULT_FOCUS_RESOLUTION_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid conversational focus resolution model.');
  const timeoutMs = readTimeout(environment.FOCUS_RESOLUTION_TIMEOUT_MS);
  return {
    provider: 'OPENAI',
    apiKey,
    model,
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
