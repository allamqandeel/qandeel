import type { ProcessingPath } from './model-router.types';

// S8A-01: DeepSeek Flash only. Thinking is ON by default at DeepSeek, so both paths state it explicitly:
// FAST answers without thinking, DEEP thinks at the lowest effort. S8A-03 (D1): the only model profile; the Anthropic
// and OpenAI profiles are removed.
export const DEEPSEEK_MODEL_PROFILE = {
  FAST: { model: 'deepseek-flash', thinking: 'disabled' },
  DEEP: { model: 'deepseek-flash', thinking: 'enabled', reasoningEffort: 'low' },
} as const satisfies Record<ProcessingPath,
  | { model: 'deepseek-flash'; thinking: 'disabled' }
  | { model: 'deepseek-flash'; thinking: 'enabled'; reasoningEffort: 'low' }>;

export type DeepSeekModelConfiguration =
  (typeof DEEPSEEK_MODEL_PROFILE)[ProcessingPath];

export function resolveDeepSeekModel(path: ProcessingPath): DeepSeekModelConfiguration {
  return DEEPSEEK_MODEL_PROFILE[path];
}
