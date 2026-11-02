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

/**
 * S8B-04 CP2 (D-S2): one streamed DeepSeek completion, aggregated in the non-streaming shape so the unchanged usage
 * normaliser reads it. Only `delta.content` of the one choice is kept: `reasoning_content` is never read.
 */
export interface DeepSeekStreamedCompletion {
  readonly choices: readonly [{ readonly finish_reason: string | null; readonly message: { readonly content: string } }];
  readonly usage: { readonly prompt_tokens?: unknown; readonly completion_tokens?: unknown } | null;
}

/** A streamed Chat Completions attempt: every `delta.content` goes to `onDelta` in order, then the aggregate resolves. */
export interface DeepSeekStreamingChatCompletionsClient {
  stream(
    body: object,
    options: { timeout: number; maxRetries: 0; signal: AbortSignal },
    onDelta: (content: string) => void,
  ): Promise<DeepSeekStreamedCompletion>;
}

interface StreamedChunk {
  choices?: Array<{ index?: number; finish_reason?: string | null; delta?: { content?: string | null } | null }> | null;
  usage?: DeepSeekStreamedCompletion['usage'];
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof (value as { [Symbol.asyncIterator]?: unknown } | null)?.[Symbol.asyncIterator] === 'function';
}

/**
 * S8B-04 CP2 (D-S2): the streaming counterpart of accountedDeepSeekChatCompletionsClient. The WHOLE stream is consumed
 * inside ONE accounted invoke, so one streamed attempt is one ledger row, settled after the stream ends with the usage the
 * provider reported in its final chunk. A stream that fails part-way (an abort included, or an `onDelta` that throws)
 * settles FAILED with unknown usage and the error is re-thrown as it was.
 */
export function accountedDeepSeekStreamingChatCompletions(
  client: ChatCompletionsCreateClient,
  featureFamily: AiFeatureFamily,
  accounting: AiProviderCallAccounting,
): DeepSeekStreamingChatCompletionsClient {
  const stream = (body: object, options: { timeout: number; maxRetries: 0; signal: AbortSignal }, onDelta: (content: string) => void) =>
    accounting.track(
      { provider: 'DEEPSEEK', requestedModel: modelOf(body), featureFamily },
      async (): Promise<DeepSeekStreamedCompletion> => {
        const chunks: unknown = await (client.chat.completions.create as (b: unknown, o?: unknown) => Promise<unknown>)(body, options);
        if (!isAsyncIterable(chunks)) throw new Error('The provider did not return a stream.');
        let content = '';
        let finishReason: string | null = null;
        let usage: DeepSeekStreamedCompletion['usage'] = null;
        for await (const value of chunks) {
          const chunk = value as StreamedChunk | null;
          if (chunk?.usage && typeof chunk.usage === 'object') usage = chunk.usage;
          // No `n` is sent, so the reply is choice 0; any other choice is never read into it.
          const choice = chunk?.choices?.find((candidate) => candidate?.index === undefined || candidate.index === 0);
          const delta = choice?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            content += delta;
            onDelta(delta);
          }
          if (typeof choice?.finish_reason === 'string') finishReason = choice.finish_reason;
        }
        return { choices: [{ finish_reason: finishReason, message: { content } }], usage };
      },
      normalizeDeepSeekChatCompletionsUsage,
      options.signal,
    );
  return { stream };
}
