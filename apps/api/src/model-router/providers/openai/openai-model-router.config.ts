export const OPENAI_TEXT_MODEL_ID = 'gpt-5.4';
export const OPENAI_MAX_OUTPUT_TOKENS = 1024;
export const OPENAI_PROVIDER_TIMEOUT_MS = 10_000;
export const OPENAI_MAX_RETRIES = 0;

export interface OpenAIModelRouterConfig {
  apiKey: string;
  model: typeof OPENAI_TEXT_MODEL_ID;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: typeof OPENAI_MAX_RETRIES;
}

export function loadOpenAIModelRouterConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAIModelRouterConfig {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for the configured model router.');

  return {
    apiKey,
    model: OPENAI_TEXT_MODEL_ID,
    maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
    timeoutMs: OPENAI_PROVIDER_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  };
}
