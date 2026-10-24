// S8A-03 (D1): hypothesis evidence association runs on DeepSeek Flash only, through the shared DeepSeek client and its
// SYNTHETIC_ONLY qualification gate. The provider and the model are fixed in code; thinking is disabled (as Gemini's
// thinking budget was 0); the timeout and output bounds and zero retries are unchanged.
import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION } from './hypothesis-evidence-association-provider.types';
import { assertDeepSeekFlashSelection, DEEPSEEK_FLASH_MODEL, requireDeepSeekQualification } from '../model-router/providers/deepseek/deepseek-client';

export const DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS = 5_000;
export const DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS = 256;
export const MAX_HYPOTHESIS_EVIDENCE_ASSOCIATION_OUTPUT_TOKENS = 512;
export const HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES = 0 as const;

export interface HypothesisEvidenceAssociationDeepSeekConfig {
  provider: 'DEEPSEEK'; apiKey: string; model: typeof DEEPSEEK_FLASH_MODEL; timeoutMs: number; maxOutputTokens: number;
  maxRetries: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES;
  schemaVersion: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION;
}

export function loadHypothesisEvidenceAssociationDeepSeekConfig(environment: NodeJS.ProcessEnv = process.env): HypothesisEvidenceAssociationDeepSeekConfig {
  assertDeepSeekFlashSelection(environment, 'HYPOTHESIS_EVIDENCE_ASSOCIATION');
  const timeoutMs = bounded(environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS, DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS, 1_000, 10_000, 'HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS');
  const maxOutputTokens = bounded(environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS, DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS, 1, MAX_HYPOTHESIS_EVIDENCE_ASSOCIATION_OUTPUT_TOKENS, 'HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS');
  const apiKey = requireDeepSeekQualification(environment, 'hypothesis evidence association');
  return {
    provider: 'DEEPSEEK', apiKey, model: DEEPSEEK_FLASH_MODEL, timeoutMs, maxOutputTokens,
    maxRetries: HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES,
    schemaVersion: HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION,
  };
}

function bounded(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return parsed;
}
