import { resolveDeepSeekModel } from '../../model-profile.registry';
import type { ProcessingPath } from '../../model-router.types';

// S8A-01: the one DeepSeek endpoint. It is a constant, never read from the environment, so no deployment variable
// (OPENAI_BASE_URL included) can send a QANDEEL request anywhere else.
export const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';
// DEEP thinks before it answers, and DeepSeek counts the thinking inside max_tokens, so DEEP needs room for both.
// S8A-02 CP3 correction (Product Owner, 2026-10-22): DEEP 2800 (was 2048). DEEP stopped at `length` in 7 / 108 attempts
// before CP3 and 1 / 6 in Round 8, each time with the reasoning holding 1 700–2 048 of the 2 048 tokens and the answer cut
// off; a stopped attempt is billed and delivers nothing. 2800 completes inside the 20 s (now 25 s) Personal DEEP budget (provider time ≈ 1.4 s + 6.4 ms per token ≈ 19.3 s at 2800); Round 8 Arm L completed the stopped case at
// 2800 in 13.3 s. Only an answer that needs the room uses it.
export const DEEPSEEK_MAX_OUTPUT_TOKENS = { FAST: 1024, DEEP: 2800 } as const satisfies Record<ProcessingPath, number>;
// S8A-01 (Product Owner, 2026-10-21): 20 s, the DEEP budget measured at CP4. S8A-02 CP3 Final Correction Approval (Product
// Owner, 2026-10-22): 25 s, the Personal DEEP budget. Every request is capped by its own budget, because the router applies
// min(request budget, this ceiling): Personal FAST 10 s; Shared / Public FAST 3 s and DEEP 10 s, unchanged.
export const DEEPSEEK_PROVIDER_TIMEOUT_MS = 25_000;
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
