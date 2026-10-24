// S8A-03 CP2: Personal Understanding capture runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; zero retries.
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS = 8_000;
export const PERSONAL_UNDERSTANDING_CAPTURE_MAX_OUTPUT_TOKENS = 2_048;
export const PERSONAL_UNDERSTANDING_CAPTURE_MAX_RETRIES = 0 as const;

export interface PersonalUnderstandingCaptureDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: typeof PERSONAL_UNDERSTANDING_CAPTURE_MAX_OUTPUT_TOKENS;
  maxRetries: typeof PERSONAL_UNDERSTANDING_CAPTURE_MAX_RETRIES;
  schemaVersion: 1;
}

export function loadPersonalUnderstandingCaptureDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PersonalUnderstandingCaptureDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'PERSONAL_UNDERSTANDING_CAPTURE');
  const timeoutMs = readTimeout(environment.PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS);
  const apiKey = requireDeepSeekQualification(environment, 'personal understanding capture');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs,
    maxOutputTokens: PERSONAL_UNDERSTANDING_CAPTURE_MAX_OUTPUT_TOKENS,
    maxRetries: PERSONAL_UNDERSTANDING_CAPTURE_MAX_RETRIES,
    schemaVersion: 1,
  };
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 15_000) {
    throw new Error('PERSONAL_UNDERSTANDING_CAPTURE_TIMEOUT_MS must be between 1000 and 15000.');
  }
  return parsed;
}
