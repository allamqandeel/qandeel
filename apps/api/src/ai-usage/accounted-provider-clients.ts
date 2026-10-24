// AI-COST-01 - the transport seam. Each production adapter receives its client by injection, so the accounting boundary
// wraps THAT client, at the one place each production adapter is composed. The adapter classes still build their own
// request, keep their own timeout and classification, and never learn about accounting. One call of the wrapped
// transport is one external provider attempt, and therefore one ledger row.
//
// S8A-03 (D1): DeepSeek Chat Completions is the only production transport - the Model Router and the seven structured
// adapters - so this is the only wrapper. The OpenAI Responses, Anthropic Messages and Gemini generateContent wrappers
// were removed with their adapters. The ledger itself stays provider-neutral (its vocabulary and normalizers are those of
// migrations 0135 / 0170), and no client of any other provider exists in production code.
//
// Provider and model identity come from server authority only: the provider is fixed by the wrapper, and the model is
// the one the adapter's server configuration put in the request. Nothing is read from a client request body.

import type { AiProviderCallAccounting } from './ai-provider-call-accounting';
import { normalizeDeepSeekChatCompletionsUsage } from './ai-usage-normalization';
import type { AiFeatureFamily } from './ai-usage.types';

function modelOf(body: unknown): string {
  const model = (body as { model?: unknown } | null)?.model;
  return typeof model === 'string' ? model : '';
}

function signalOf(options: unknown): AbortSignal | undefined {
  const signal = (options as { signal?: unknown } | null | undefined)?.signal;
  return signal instanceof AbortSignal ? signal : undefined;
}

interface ChatCompletionsCreateClient {
  chat: { completions: { create(...args: never[]): Promise<unknown> } };
}

/** S8A-01: a DeepSeek Chat Completions client whose every `chat.completions.create` is one accounted attempt. */
export function accountedDeepSeekChatCompletionsClient<C extends ChatCompletionsCreateClient>(
  client: C,
  featureFamily: AiFeatureFamily,
  accounting: AiProviderCallAccounting,
): C {
  const create = (body: unknown, options?: unknown) => accounting.track(
    { provider: 'DEEPSEEK', requestedModel: modelOf(body), featureFamily },
    () => (client.chat.completions.create as (b: unknown, o?: unknown) => Promise<unknown>)(body, options),
    normalizeDeepSeekChatCompletionsUsage,
    signalOf(options),
  );
  return { chat: { completions: { create } } } as unknown as C;
}
