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

// S8A-01: DeepSeek Flash only. Thinking is ON by default at DeepSeek, so both paths state it explicitly:
// FAST answers without thinking, DEEP thinks at the lowest effort.
export const DEEPSEEK_MODEL_PROFILE = {
  FAST: { model: 'deepseek-flash', thinking: 'disabled' },
  DEEP: { model: 'deepseek-flash', thinking: 'enabled', reasoningEffort: 'low' },
} as const satisfies Record<ProcessingPath,
  | { model: 'deepseek-flash'; thinking: 'disabled' }
  | { model: 'deepseek-flash'; thinking: 'enabled'; reasoningEffort: 'low' }>;

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

export type DeepSeekModelConfiguration =
  (typeof DEEPSEEK_MODEL_PROFILE)[ProcessingPath];

export function resolveDeepSeekModel(path: ProcessingPath): DeepSeekModelConfiguration {
  return DEEPSEEK_MODEL_PROFILE[path];
}
