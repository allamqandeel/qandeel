import type { ProcessingPath } from './model-router.types';

export const ANTHROPIC_MODEL_PROFILE = {
  FAST: { model: 'claude-haiku-4-5-20251001' },
  DEEP: { model: 'claude-sonnet-4-6' },
} as const satisfies Record<ProcessingPath, { model: string }>;

export const OPENAI_MODEL_PROFILE = {
  FAST: { model: 'gpt-5.6-luna', reasoningEffort: 'none' },
  DEEP: { model: 'gpt-5.6-terra', reasoningEffort: 'low' },
} as const satisfies Record<ProcessingPath, {
  model: string;
  reasoningEffort: 'none' | 'low';
}>;

export type AnthropicModelConfiguration =
  (typeof ANTHROPIC_MODEL_PROFILE)[ProcessingPath];
export type OpenAIModelConfiguration =
  (typeof OPENAI_MODEL_PROFILE)[ProcessingPath];

export function resolveAnthropicModel(path: ProcessingPath): AnthropicModelConfiguration {
  return ANTHROPIC_MODEL_PROFILE[path];
}

export function resolveOpenAIModel(path: ProcessingPath): OpenAIModelConfiguration {
  return OPENAI_MODEL_PROFILE[path];
}
