// S8A-03 (D1): hypothesis candidate generation runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; thinking is disabled (as Gemini's
// thinking budget was 0); the timeout bounds and zero retries are unchanged. The output bound fits DeepSeek: at most
// five bounded proposals (MAX_GENERATED_HYPOTHESIS_CANDIDATES) need far less than Gemini's former 65 536-token ceiling.
import { HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION } from './hypothesis-candidate-generator-provider.types';
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS = 5_000;
export const DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS = 4_096;
export const MAX_HYPOTHESIS_CANDIDATE_GENERATION_OUTPUT_TOKENS = 8_192;
export const HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES = 0 as const;

export interface HypothesisCandidateGenerationDeepSeekConfig {
  provider: 'DEEPSEEK';
  apiKey: string;
  model: typeof DEEPSEEK_FLASH_MODEL;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries: typeof HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES;
  schemaVersion: typeof HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION;
}

export function loadHypothesisCandidateGenerationDeepSeekConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HypothesisCandidateGenerationDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'HYPOTHESIS_CANDIDATE_GENERATION');
  const timeoutMs = boundedInteger(
    environment.HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS,
    DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS,
    1_000, 10_000,
    'HYPOTHESIS_CANDIDATE_GENERATION_TIMEOUT_MS',
  );
  const maxOutputTokens = boundedInteger(
    environment.HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
    DEFAULT_HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS,
    1_024, MAX_HYPOTHESIS_CANDIDATE_GENERATION_OUTPUT_TOKENS,
    'HYPOTHESIS_CANDIDATE_GENERATION_MAX_OUTPUT_TOKENS',
  );
  const apiKey = requireDeepSeekQualification(environment, 'hypothesis candidate generation');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs, maxOutputTokens,
    maxRetries: HYPOTHESIS_CANDIDATE_GENERATION_MAX_RETRIES,
    schemaVersion: HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION,
  };
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}
