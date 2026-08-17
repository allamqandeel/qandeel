import type { EvaluationProvider } from './brain-eval.types';
import type { ProcessingPath } from '../model-router/model-router.types';

export interface EvaluationPrice {
  inputUsdPerMillionTokens: number | null;
  outputUsdPerMillionTokens: number | null;
  verified: boolean;
  note: string;
}

// Evaluation-only configuration. Verify official prices immediately before a paid run.
export const EVALUATION_PRICING: Record<EvaluationProvider, Record<ProcessingPath, EvaluationPrice>> = {
  ANTHROPIC: {
    FAST: { inputUsdPerMillionTokens: null, outputUsdPerMillionTokens: null, verified: false, note: 'Verify against official Anthropic pricing before first paid bake-off.' },
    DEEP: { inputUsdPerMillionTokens: null, outputUsdPerMillionTokens: null, verified: false, note: 'Verify against official Anthropic pricing before first paid bake-off.' },
  },
  OPENAI: {
    FAST: { inputUsdPerMillionTokens: null, outputUsdPerMillionTokens: null, verified: false, note: 'Verify against official OpenAI pricing before first paid bake-off.' },
    DEEP: { inputUsdPerMillionTokens: null, outputUsdPerMillionTokens: null, verified: false, note: 'Verify against official OpenAI pricing before first paid bake-off.' },
  },
};

export function estimateCostUsd(provider: EvaluationProvider, path: ProcessingPath, inputTokens: number, outputTokens: number): number | null {
  const price = EVALUATION_PRICING[provider][path];
  if (price.inputUsdPerMillionTokens === null || price.outputUsdPerMillionTokens === null) return null;
  return (inputTokens * price.inputUsdPerMillionTokens + outputTokens * price.outputUsdPerMillionTokens) / 1_000_000;
}
