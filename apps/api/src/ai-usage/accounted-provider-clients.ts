// AI-COST-01 - the transport seam. Each production adapter already receives its client by injection (the Model Router
// and the semantic adapters take a `responses` / `messages` client, the Gemini adapters an HTTP function), so the
// accounting boundary wraps THAT client, at the one place each production adapter is composed. The frozen adapter
// classes stay byte-identical: they still build their own request, keep their own timeout and classification, and
// never learn about accounting. One call of the wrapped transport is one external provider attempt, and therefore one
// ledger row.
//
// Provider and model identity come from server authority only: the provider is fixed by which wrapper is used, and the
// model is the one the adapter's server configuration put in the request (or, for Gemini's URL-addressed model, the
// configured model passed here). Nothing is read from a client request body.

import type { AiProviderCallAccounting } from './ai-provider-call-accounting';
import {
  normalizeAnthropicMessagesUsage,
  normalizeGeminiGenerateContentUsage,
  normalizeOpenAIResponsesUsage,
} from './ai-usage-normalization';
import { ABSENT_AI_USAGE, type AiFeatureFamily, type NormalizedAiUsage } from './ai-usage.types';

interface ResponsesCreateClient {
  responses: { create(...args: never[]): Promise<unknown> };
}
interface MessagesCreateClient {
  messages: { create(...args: never[]): Promise<unknown> };
}

function modelOf(body: unknown): string {
  const model = (body as { model?: unknown } | null)?.model;
  return typeof model === 'string' ? model : '';
}

function signalOf(options: unknown): AbortSignal | undefined {
  const signal = (options as { signal?: unknown } | null | undefined)?.signal;
  return signal instanceof AbortSignal ? signal : undefined;
}

/** An OpenAI Responses client whose every `responses.create` is one accounted attempt. */
export function accountedOpenAIResponsesClient<C extends ResponsesCreateClient>(
  client: C,
  featureFamily: AiFeatureFamily,
  accounting: AiProviderCallAccounting,
): C {
  const create = (body: unknown, options?: unknown) => accounting.track(
    { provider: 'OPENAI', requestedModel: modelOf(body), featureFamily },
    () => (client.responses.create as (b: unknown, o?: unknown) => Promise<unknown>)(body, options),
    normalizeOpenAIResponsesUsage,
    signalOf(options),
  );
  return { responses: { create } } as unknown as C;
}

/** An Anthropic Messages client whose every `messages.create` is one accounted attempt. */
export function accountedAnthropicMessagesClient<C extends MessagesCreateClient>(
  client: C,
  featureFamily: AiFeatureFamily,
  accounting: AiProviderCallAccounting,
): C {
  const create = (body: unknown, options?: unknown) => accounting.track(
    { provider: 'ANTHROPIC', requestedModel: modelOf(body), featureFamily },
    () => (client.messages.create as (b: unknown, o?: unknown) => Promise<unknown>)(body, options),
    normalizeAnthropicMessagesUsage,
    signalOf(options),
  );
  return { messages: { create } } as unknown as C;
}

export interface GeminiTransportResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type GeminiTransport = (url: string, init: RequestInit) => Promise<GeminiTransportResponse>;

/**
 * A Gemini `generateContent` transport whose every request is one accounted attempt. A 2xx body is read once here
 * for its usageMetadata and handed to the adapter unchanged (an unreadable body reaches the adapter as the same
 * error); a non-2xx status is a FAILED attempt with unknown usage, and its response is passed through untouched.
 */
export function accountedGeminiTransport(
  transport: GeminiTransport,
  requestedModel: string,
  featureFamily: AiFeatureFamily,
  accounting: AiProviderCallAccounting,
): GeminiTransport {
  return async (url, init) => {
    let usage: NormalizedAiUsage = ABSENT_AI_USAGE;
    return accounting.track(
      { provider: 'GEMINI', requestedModel, featureFamily },
      async () => {
        const response = await transport(url, init);
        if (!response.ok) return response;
        let body: unknown;
        let failure: unknown;
        let failed = false;
        try {
          body = await response.json();
          usage = normalizeGeminiGenerateContentUsage(body);
        } catch (error) {
          failed = true;
          failure = error;
        }
        return {
          ok: response.ok,
          status: response.status,
          json: async () => {
            if (failed) throw failure;
            return body;
          },
        };
      },
      () => usage,
      init.signal ?? undefined,
      (response) => (response.ok ? 'SUCCEEDED' : 'FAILED'),
    );
  };
}
