import {
  ModelRouterProviderError,
  composeServerGuidance,
  type ModelRouter,
  type ModelRouterRequest,
  type ModelRouterResult,
  type ModelRouterStreamOptions,
  type ModelRouterStreamResult,
  type ModelRouterStreamUsage,
  type ModelRouterStreamWithheldReason,
} from '../../model-router.types';
import { releaseModelOutput } from '../../model-output-release-guard';
import { IncrementalReleaseGuard, type IncrementalReleaseOutcome } from '../../incremental-release-guard';
import { loadDeepSeekModelRouterConfig, type DeepSeekModelRouterConfig } from './deepseek-model-router.config';
import { createDeepSeekClient } from './deepseek-client';
import { TelemetryService } from '../../../observability/telemetry.service';
import { assertForegroundProviderBudget } from '../../../conversation/foreground-turn-work';
import type { AiProviderCallAccounting } from '../../../ai-usage/ai-provider-call-accounting';
import {
  accountedDeepSeekChatCompletionsClient,
  accountedDeepSeekStreamingChatCompletions,
  type DeepSeekStreamedCompletion,
  type DeepSeekStreamingChatCompletionsClient,
} from '../../../ai-usage/accounted-provider-clients';
import { runWithAiUsageProcessingPath } from '../../../ai-usage/ai-usage-attribution';

// S8A-01: DeepSeek through its OpenAI-format Chat Completions API. Only `message.content` is ever read: the reasoning
// trace DeepSeek returns beside it in thinking mode is not part of the reply, so it is never read, kept, logged or sent
// back. No `tools` are sent, so DeepSeek never requires a reasoning trace to be returned in a later turn. No end-user
// identifier is sent while DeepSeek is qualification-only.
interface DeepSeekChatCompletion {
  choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } | null }> | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/** The request both paths send; only `stream` (and, when streaming, `stream_options`) differs. */
interface DeepSeekChatCompletionsBody {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_tokens: number;
  thinking: { type: 'enabled' | 'disabled' };
  reasoning_effort?: 'low';
}

interface DeepSeekChatCompletionsClient {
  chat: {
    completions: {
      create(
        body: DeepSeekChatCompletionsBody & { stream: false },
        options: { timeout: number; maxRetries: 0; signal: AbortSignal },
      ): Promise<DeepSeekChatCompletion>;
    };
  };
}

export class DeepSeekModelRouter implements ModelRouter {
  /** AI-COST-01: there is no unaccounted DeepSeek composition; every reply attempt is one ledger row. */
  static fromEnvironment(telemetry: TelemetryService | undefined, accounting: AiProviderCallAccounting): DeepSeekModelRouter {
    const config = loadDeepSeekModelRouterConfig();
    // S8B-04 CP2: the same raw client feeds the accounted create and the accounted stream (one ledger row per attempt each).
    const client = createDeepSeekClient(config);
    return new DeepSeekModelRouter(
      config,
      accountedDeepSeekChatCompletionsClient(client, 'CONVERSATION_REPLY', accounting),
      telemetry,
      accountedDeepSeekStreamingChatCompletions(client, 'CONVERSATION_REPLY', accounting),
    );
  }

  /**
   * S8A-05 CP4 (Controlled Amendment A-5(d)): the Public QANDEEL reply — the same router, the same SYNTHETIC_ONLY gate and
   * the same accounting boundary, under its own family (migration 0182), paid by the human who invoked @qandeel.
   */
  static forPublicQandeel(telemetry: TelemetryService | undefined, accounting: AiProviderCallAccounting): DeepSeekModelRouter {
    const config = loadDeepSeekModelRouterConfig();
    const client = createDeepSeekClient(config);
    return new DeepSeekModelRouter(
      config,
      accountedDeepSeekChatCompletionsClient(client, 'PUBLIC_QANDEEL_REPLY', accounting),
      telemetry,
      accountedDeepSeekStreamingChatCompletions(client, 'PUBLIC_QANDEEL_REPLY', accounting),
    );
  }

  constructor(
    private readonly config: DeepSeekModelRouterConfig,
    private readonly client: DeepSeekChatCompletionsClient,
    private readonly telemetry?: TelemetryService,
    /** S8B-04 CP2: the accounted streaming transport; without it `stream` fails exactly as a failed generation. */
    private readonly streamingClient?: DeepSeekStreamingChatCompletionsClient,
  ) {}

  generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    return runWithAiUsageProcessingPath(request.path, () => this.generateOnce(request));
  }

  private async generateOnce(request: ModelRouterRequest): Promise<ModelRouterResult> {
    assertForegroundProviderBudget();
    const modelConfiguration = this.config.resolveModel(request.path);
    const timeout = Math.min(request.latencyBudgetMs, this.config.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const serverGuidance = composeServerGuidance(request);

    try {
      const call = () => this.client.chat.completions.create(
        { ...this.requestBody(request, serverGuidance, modelConfiguration), stream: false },
        { timeout, maxRetries: 0, signal: controller.signal },
      );
      const response = this.telemetry
        ? await this.telemetry.withProvider('deepseek', modelConfiguration.model, request.path, timeout, call, value => value.usage && typeof value.usage.prompt_tokens === 'number' && typeof value.usage.completion_tokens === 'number' ? { inputTokens: value.usage.prompt_tokens, outputTokens: value.usage.completion_tokens } : undefined)
        : await call();
      // One complete answer only: a filtered, truncated, aborted or resource-starved completion is a refusal to answer,
      // never a partial reply.
      const choice = response.choices?.length === 1 ? response.choices[0] : undefined;
      const candidate = choice?.message?.content;
      if (choice?.finish_reason !== 'stop' || typeof candidate !== 'string') throw new ModelRouterProviderError();

      return {
        content: releaseModelOutput(candidate, serverGuidance),
        routingMetadata: { path: request.path },
        // AI-COST-01: a usage the provider did not report is unknown, never zero.
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
      };
    } catch {
      throw new ModelRouterProviderError();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * S8B-04 CP2 (Fast Voice Path, D-S2): a VOICE NOTE reply, streamed. Each content delta goes through the incremental
   * release guard and every released piece reaches `onRelease` before the reply is complete. The request is the one
   * `generate` sends, plus `stream: true` and the usage chunk. Only `delta.content` is read: a reasoning trace never is.
   */
  stream(request: ModelRouterRequest, options: ModelRouterStreamOptions): Promise<ModelRouterStreamResult> {
    return runWithAiUsageProcessingPath(request.path, () => this.streamOnce(request, options));
  }

  private async streamOnce(request: ModelRouterRequest, options: ModelRouterStreamOptions): Promise<ModelRouterStreamResult> {
    assertForegroundProviderBudget();
    const streamingClient = this.streamingClient;
    if (!streamingClient) throw new ModelRouterProviderError();
    const modelConfiguration = this.config.resolveModel(request.path);
    const timeout = Math.min(request.latencyBudgetMs, this.config.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const abortOnExternal = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', abortOnExternal, { once: true });
    const serverGuidance = composeServerGuidance(request);
    const guard = new IncrementalReleaseGuard({ serverGuidance, safetyGuided: options.safetyGuided });
    const routingMetadata = { path: request.path };

    // Nothing released: the turn fails exactly as `generate` fails. Something released: it is kept as what it is (it may
    // already have been heard) and the rest is withheld.
    const withheld = (reason: ModelRouterStreamWithheldReason, usage: ModelRouterStreamUsage): ModelRouterStreamResult => {
      const released = guard.releasedText;
      if (released.length === 0) throw new ModelRouterProviderError();
      return { kind: 'WITHHELD_TAIL', released, reason, routingMetadata, usage };
    };

    // Synchronous and in order; an onRelease that throws ends the stream as a provider failure.
    const onDelta = (content: string): void => {
      const before = guard.releasedText.length;
      const piece = guard.push(content);
      if (piece.length > 0) {
        const { expression, hints } = guard.releasedSpeech;
        options.onRelease(piece, {
          expression,
          hints: hints.filter((hint) => hint.at > before).map((hint) => ({ word: hint.word, at: hint.at - before })),
        });
      }
    };

    let completion: DeepSeekStreamedCompletion;
    try {
      const call = () => streamingClient.stream(
        { ...this.requestBody(request, serverGuidance, modelConfiguration), stream: true, stream_options: { include_usage: true } },
        { timeout, maxRetries: 0, signal: controller.signal },
        onDelta,
      );
      completion = this.telemetry
        ? await this.telemetry.withProvider('deepseek', modelConfiguration.model, request.path, timeout, call, (value) => {
          const usage = streamedUsage(value);
          return usage.inputTokens !== null && usage.outputTokens !== null
            ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }
            : undefined;
        })
        : await call();
    } catch {
      controller.abort();
      return withheld('PROVIDER_FAILED', UNKNOWN_USAGE);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortOnExternal);
    }

    const usage = streamedUsage(completion);
    // One complete answer only: a filtered, truncated or resource-starved stream is never a complete reply.
    if (completion.choices[0]?.finish_reason !== 'stop') return withheld('TRUNCATED', usage);
    let outcome: IncrementalReleaseOutcome;
    try {
      outcome = guard.end();
    } catch {
      return withheld('PROVIDER_FAILED', usage);
    }
    switch (outcome.kind) {
      case 'COMPLETE':
        return { kind: 'COMPLETE', text: outcome.text, tail: outcome.tail, expression: outcome.expression, hints: outcome.hints, routingMetadata, usage };
      case 'WITHHELD_TAIL':
        return { kind: 'WITHHELD_TAIL', released: outcome.released, reason: outcome.reason, routingMetadata, usage };
      default:
        throw new ModelRouterProviderError();
    }
  }

  /** The request body both paths share; `generate` adds `stream: false`, `stream` adds the streaming fields. */
  private requestBody(
    request: ModelRouterRequest,
    serverGuidance: string,
    modelConfiguration: ReturnType<DeepSeekModelRouterConfig['resolveModel']>,
  ): DeepSeekChatCompletionsBody {
    return {
      model: modelConfiguration.model,
      messages: [
        { role: 'system', content: serverGuidance },
        ...request.context.map((message) => ({
          role: message.role === 'USER' ? 'user' as const : 'assistant' as const,
          content: message.content,
        })),
      ],
      max_tokens: this.config.maxOutputTokens[request.path],
      thinking: { type: modelConfiguration.thinking },
      ...('reasoningEffort' in modelConfiguration ? { reasoning_effort: modelConfiguration.reasoningEffort } : {}),
    };
  }
}

const UNKNOWN_USAGE: ModelRouterStreamUsage = { inputTokens: null, outputTokens: null };

/** AI-COST-01: a usage the provider did not report is unknown, never zero. */
function streamedUsage(completion: DeepSeekStreamedCompletion): ModelRouterStreamUsage {
  const count = (value: unknown): number | null => (typeof value === 'number' ? value : null);
  return { inputTokens: count(completion.usage?.prompt_tokens), outputTokens: count(completion.usage?.completion_tokens) };
}
