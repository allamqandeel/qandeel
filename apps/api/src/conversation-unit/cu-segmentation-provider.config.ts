// T-03A1 - CU segmentation provider configuration.
//
// Mirrors the existing hypothesis intent-extraction provider binding: one
// configured provider, an explicit model allowlist shape, a bounded timeout and
// zero provider-side retries. No new dependency is introduced - the existing
// `openai` package is reused.

export const DEFAULT_CU_SEGMENTATION_MODEL = 'gpt-5-mini';
export const DEFAULT_CU_SEGMENTATION_TIMEOUT_MS = 5_000;
export const CU_SEGMENTATION_MAX_OUTPUT_TOKENS = 2_048;
export const CU_SEGMENTATION_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every commitment batch. It changes whenever
 * the instructions that shaped a boundary decision change, so provenance can
 * never silently drift under a stored batch.
 */
export const CU_SEGMENTATION_PROMPT_VERSION = 'cu-segmentation-anchored-v1';

export interface CuSegmentationOpenAIConfig {
  provider: 'OPENAI';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: typeof CU_SEGMENTATION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof CU_SEGMENTATION_MAX_RETRIES;
  promptVersion: typeof CU_SEGMENTATION_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadCuSegmentationOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CuSegmentationOpenAIConfig {
  const provider = environment.CU_SEGMENTATION_PROVIDER?.trim().toUpperCase() || 'OPENAI';
  if (provider !== 'OPENAI') throw new Error('CU_SEGMENTATION_PROVIDER must be OPENAI.');
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for conversational unit segmentation.');
  const model = environment.CU_SEGMENTATION_MODEL?.trim() || DEFAULT_CU_SEGMENTATION_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid conversational unit segmentation model.');
  const timeoutMs = readTimeout(environment.CU_SEGMENTATION_TIMEOUT_MS);
  return {
    provider: 'OPENAI',
    apiKey,
    model,
    timeoutMs,
    maxOutputTokens: CU_SEGMENTATION_MAX_OUTPUT_TOKENS,
    maxRetries: CU_SEGMENTATION_MAX_RETRIES,
    promptVersion: CU_SEGMENTATION_PROMPT_VERSION,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_CU_SEGMENTATION_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 15_000) {
    throw new Error('CU_SEGMENTATION_TIMEOUT_MS must be between 1000 and 15000.');
  }
  return parsed;
}
