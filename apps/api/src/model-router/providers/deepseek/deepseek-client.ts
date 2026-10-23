import OpenAI from 'openai';

// S8A-01 / S8A-03 - the ONE DeepSeek transport of QANDEEL.
//
// Every production AI call - the conversational reply and the seven structured adapters (CU segmentation, focus
// resolution, Thread establishment, Thread continuity, hypothesis intent extraction, candidate generation and evidence
// association) - is built here: the same fixed endpoint, the same qualification gate, the same client posture. No other
// provider exists in production code (S8A-03 D1), so there is nothing to fall back to.

// The one DeepSeek endpoint. It is a constant, never read from the environment, so no deployment variable
// (OPENAI_BASE_URL included) can send a QANDEEL request anywhere else.
export const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';

/** S8A-03 D1: DeepSeek Flash for every function. Pro needs a new Founder decision, so no variable can select it. */
export const DEEPSEEK_FLASH_MODEL = 'deepseek-flash';

/**
 * S8A-01 qualification boundary. DeepSeek may process synthetic qualification data only: no real user's data may reach
 * it until third-party AI disclosure, consent, a privacy policy and in-app reporting exist (canonical backlog). The
 * operator must declare this mode explicitly, and a production process refuses DeepSeek whatever it declares.
 */
export const DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE = 'SYNTHETIC_ONLY';

/**
 * The qualification gate every DeepSeek adapter passes before it may exist (S8A-03: all eight, not only the router).
 * Returns the API key.
 */
export function requireDeepSeekQualification(environment: NodeJS.ProcessEnv, purpose: string): string {
  if (environment.NODE_ENV === 'production') {
    throw new Error('DeepSeek is qualification-only and cannot be selected in production.');
  }
  if (environment.DEEPSEEK_QUALIFICATION_MODE?.trim() !== DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE) {
    throw new Error('DEEPSEEK_QUALIFICATION_MODE must be SYNTHETIC_ONLY: DeepSeek may process synthetic qualification data only.');
  }
  const apiKey = environment.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error(`DEEPSEEK_API_KEY is required for ${purpose}.`);
  return apiKey;
}

/**
 * A structured adapter's provider and model selection. They are no longer choices: an operator variable left over from
 * the OpenAI or Gemini binding fails loudly instead of being silently ignored.
 */
export function assertDeepSeekFlashSelection(environment: NodeJS.ProcessEnv, prefix: string): void {
  const provider = environment[`${prefix}_PROVIDER`]?.trim();
  if (provider && provider.toUpperCase() !== 'DEEPSEEK') throw new Error(`${prefix}_PROVIDER must be DEEPSEEK.`);
  const model = environment[`${prefix}_MODEL`]?.trim();
  if (model && model !== DEEPSEEK_FLASH_MODEL) throw new Error(`${prefix}_MODEL must be ${DEEPSEEK_FLASH_MODEL}.`);
}

export function createDeepSeekClient(config: { apiKey: string; timeoutMs: number }): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: DEEPSEEK_API_BASE_URL,
    // The SDK would otherwise read these from OPENAI_* variables and send them to DeepSeek as headers.
    organization: null,
    project: null,
    adminAPIKey: null,
    webhookSecret: null,
    maxRetries: 0,
    timeout: config.timeoutMs,
    logLevel: 'off',
  });
}

// ---------------------------------------------------------------------------------------------------------------
// S8A-03 - JSON Output for the seven structured adapters.
//
// DeepSeek's Chat Completions accepts `response_format: json_object` only; it has no json_schema mode. So the schema
// each adapter already built for the OpenAI / Gemini strict mode travels inside the system instruction as the
// description of the answer, and enforcement stays where it always also was: each adapter's own fail-closed parser and
// its deterministic validator. Nothing the model returns is trusted because of the format flag.
// ---------------------------------------------------------------------------------------------------------------

export const DEEPSEEK_JSON_OUTPUT_INSTRUCTION =
  'Respond with exactly one json object and nothing else: no prose, no markdown, no code fence. The object must conform to the following JSON Schema; the server rejects any other key, type, value, length or count.';

export interface DeepSeekJsonRequest {
  model: typeof DEEPSEEK_FLASH_MODEL;
  messages: [{ role: 'system'; content: string }, { role: 'user'; content: string }];
  response_format: { type: 'json_object' };
  // S8A-03 F3: thinking is disabled for every structured function; enabling it for one needs measured evidence.
  thinking: { type: 'disabled' };
  max_tokens: number;
  stream: false;
}

export interface DeepSeekJsonCompletion {
  choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } | null }> | null;
}

export interface DeepSeekJsonClient {
  chat: {
    completions: {
      create(
        body: DeepSeekJsonRequest,
        options: { timeout: number; maxRetries: 0; signal: AbortSignal },
      ): Promise<DeepSeekJsonCompletion>;
    };
  };
}

/** One structured request: the adapter's own instructions, then the answer's schema, then its untrusted-data envelope. */
export function deepSeekJsonRequest(input: { instructions: string; schema: object; data: string; maxTokens: number }): DeepSeekJsonRequest {
  return {
    model: DEEPSEEK_FLASH_MODEL,
    messages: [
      { role: 'system', content: `${input.instructions}\n\n${DEEPSEEK_JSON_OUTPUT_INSTRUCTION}\n${JSON.stringify(input.schema)}` },
      { role: 'user', content: input.data },
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    max_tokens: input.maxTokens,
    stream: false,
  };
}

/** DeepSeek stopped the completion for lack of its own resources: a transient provider condition, not an answer. */
export class DeepSeekUnavailableError extends Error {
  constructor() {
    super('DeepSeek reported insufficient system resources.');
    this.name = 'DeepSeekUnavailableError';
  }
}

/**
 * The JSON text of exactly one complete answer, or `undefined`. A truncated (`length`), filtered or empty completion -
 * DeepSeek documents that JSON Output may occasionally return empty content - is never parsed into a partial answer:
 * each adapter's parser refuses `undefined` as invalid structured output.
 */
export function deepSeekJsonContent(response: DeepSeekJsonCompletion): string | undefined {
  const choice = response?.choices?.length === 1 ? response.choices[0] : undefined;
  if (choice?.finish_reason === 'insufficient_system_resource') throw new DeepSeekUnavailableError();
  const content = choice?.message?.content;
  return choice?.finish_reason === 'stop' && typeof content === 'string' && content.trim().length > 0 ? content : undefined;
}

export function isDeepSeekTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'APIConnectionTimeoutError');
}

export function isDeepSeekUnavailable(error: unknown): boolean {
  const value = error as { name?: unknown; status?: unknown };
  return value?.name === 'APIConnectionError' || value?.name === 'DeepSeekUnavailableError' ||
    value?.status === 429 || value?.status === 502 || value?.status === 503 || value?.status === 504;
}

/** The untrusted-data envelope encoding the adapters already used: JSON with `&`, `<` and `>` escaped. */
export function escapeDeepSeekData(value: unknown): string {
  return JSON.stringify(value).replace(/&/gu, '\\u0026').replace(/</gu, '\\u003c').replace(/>/gu, '\\u003e');
}
