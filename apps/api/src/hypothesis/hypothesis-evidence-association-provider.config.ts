import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION } from './hypothesis-evidence-association-provider.types';

export const DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL = 'gemini-2.5-flash-lite';
export const DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS = 5_000;
export const DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS = 256;
export const MAX_HYPOTHESIS_EVIDENCE_ASSOCIATION_OUTPUT_TOKENS = 512;
export const HYPOTHESIS_EVIDENCE_ASSOCIATION_THINKING_BUDGET = 0 as const;
export const HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES = 0 as const;

export interface HypothesisEvidenceAssociationGeminiConfig {
  provider: 'GEMINI'; apiKey: string; model: string; timeoutMs: number; maxOutputTokens: number;
  thinkingBudget: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_THINKING_BUDGET;
  maxRetries: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES;
  schemaVersion: typeof HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION;
}

export function loadHypothesisEvidenceAssociationGeminiConfig(environment: NodeJS.ProcessEnv = process.env): HypothesisEvidenceAssociationGeminiConfig {
  const provider = environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER?.trim().toUpperCase() || 'GEMINI';
  if (provider !== 'GEMINI') throw new Error('HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER must be GEMINI.');
  const apiKey = environment.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is required for hypothesis evidence association.');
  const model = environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL?.trim() || DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new Error('Invalid hypothesis evidence association model.');
  return {
    provider: 'GEMINI', apiKey, model,
    timeoutMs: bounded(environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS, DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS, 1_000, 10_000, 'HYPOTHESIS_EVIDENCE_ASSOCIATION_TIMEOUT_MS'),
    maxOutputTokens: bounded(environment.HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS, DEFAULT_HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS, 1, MAX_HYPOTHESIS_EVIDENCE_ASSOCIATION_OUTPUT_TOKENS, 'HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_OUTPUT_TOKENS'),
    thinkingBudget: HYPOTHESIS_EVIDENCE_ASSOCIATION_THINKING_BUDGET, maxRetries: HYPOTHESIS_EVIDENCE_ASSOCIATION_MAX_RETRIES,
    schemaVersion: HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION,
  };
}

function bounded(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return parsed;
}
