import { resolveDeepSeekModel } from '../../model-profile.registry';
import type { ProcessingPath } from '../../model-router.types';

// S8A-01: the one DeepSeek endpoint. It is a constant, never read from the environment, so no deployment variable
// (OPENAI_BASE_URL included) can send a QANDEEL request anywhere else.
export const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';
// DEEP thinks before it answers, and DeepSeek counts the thinking inside max_tokens, so DEEP needs room for both.
export const DEEPSEEK_MAX_OUTPUT_TOKENS = { FAST: 1024, DEEP: 2048 } as const satisfies Record<ProcessingPath, number>;
// S8A-01 (Product Owner, 2026-10-21): 20 s, the DEEP budget measured at CP4. FAST stays at its 3 s request budget,
// because the router applies min(request budget, this ceiling).
export const DEEPSEEK_PROVIDER_TIMEOUT_MS = 20_000;
export const DEEPSEEK_MAX_RETRIES = 0;

/**
 * S8A-01 qualification boundary. DeepSeek may process synthetic qualification data only: no real user's data may reach
 * it until third-party AI disclosure, consent, a privacy policy and in-app reporting exist (canonical backlog). The
 * operator must declare this mode explicitly, and a production process refuses DeepSeek whatever it declares.
 */
export const DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE = 'SYNTHETIC_ONLY';

export interface DeepSeekModelRouterConfig {
  apiKey: string;
  resolveModel: typeof resolveDeepSeekModel;
  maxOutputTokens: typeof DEEPSEEK_MAX_OUTPUT_TOKENS;
  timeoutMs: number;
  maxRetries: typeof DEEPSEEK_MAX_RETRIES;
}

export function loadDeepSeekModelRouterConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DeepSeekModelRouterConfig {
  if (environment.NODE_ENV === 'production') {
    throw new Error('DeepSeek is qualification-only and cannot be selected in production.');
  }
  if (environment.DEEPSEEK_QUALIFICATION_MODE?.trim() !== DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE) {
    throw new Error('DEEPSEEK_QUALIFICATION_MODE must be SYNTHETIC_ONLY: DeepSeek may process synthetic qualification data only.');
  }
  const apiKey = environment.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required for the configured model router.');

  return {
    apiKey,
    resolveModel: (path: ProcessingPath) => resolveDeepSeekModel(path),
    maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
    timeoutMs: DEEPSEEK_PROVIDER_TIMEOUT_MS,
    maxRetries: DEEPSEEK_MAX_RETRIES,
  };
}
