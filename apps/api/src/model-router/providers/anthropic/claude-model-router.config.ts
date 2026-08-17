import { resolveAnthropicModel } from '../../model-profile.registry';
import type { ProcessingPath } from '../../model-router.types';

export const CLAUDE_MAX_OUTPUT_TOKENS = 1024;
export const CLAUDE_PROVIDER_TIMEOUT_MS = 10_000;
export const CLAUDE_MAX_RETRIES = 0;

export interface ClaudeModelRouterConfig {
  apiKey: string;
  resolveModel: typeof resolveAnthropicModel;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: typeof CLAUDE_MAX_RETRIES;
}

export function loadClaudeModelRouterConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ClaudeModelRouterConfig {
  const apiKey = environment.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for the configured model router.');

  return {
    apiKey,
    resolveModel: (path: ProcessingPath) => resolveAnthropicModel(path),
    maxOutputTokens: CLAUDE_MAX_OUTPUT_TOKENS,
    timeoutMs: CLAUDE_PROVIDER_TIMEOUT_MS,
    maxRetries: CLAUDE_MAX_RETRIES,
  };
}
