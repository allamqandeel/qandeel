// T-03A1 - CU segmentation provider configuration.
//
// S8A-03 (D1): the one configured provider is DeepSeek Flash, through the shared DeepSeek client and its SYNTHETIC_ONLY
// qualification gate. The provider and the model are fixed in code; a bounded timeout and zero provider-side retries
// are unchanged. No new dependency is introduced.

import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_CU_SEGMENTATION_TIMEOUT_MS = 5_000;
export const CU_SEGMENTATION_MAX_OUTPUT_TOKENS = 2_048;
export const CU_SEGMENTATION_MAX_RETRIES = 0 as const;

/**
 * The prompt identity recorded on every commitment batch. It changes whenever
 * the instructions that shaped a boundary decision change, so provenance can
 * never silently drift under a stored batch. S8A-03: the schema now travels in
 * the instruction (DeepSeek JSON Output), so the identity changed.
 */
export const CU_SEGMENTATION_PROMPT_VERSION = 'cu-segmentation-anchored-deepseek-v1';

export interface CuSegmentationDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof CU_SEGMENTATION_MAX_OUTPUT_TOKENS;
  maxRetries: typeof CU_SEGMENTATION_MAX_RETRIES;
  promptVersion: typeof CU_SEGMENTATION_PROMPT_VERSION;
  schemaVersion: 1;
}

export function loadCuSegmentationDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CuSegmentationDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'CU_SEGMENTATION');
  const timeoutMs = readTimeout(environment.CU_SEGMENTATION_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'conversational unit segmentation');
  return {
    provider: 'DEEPSEEK',
    apiKey,
    model: DEEPSEEK_FLASH_MODEL,
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
