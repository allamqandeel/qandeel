import OpenAI from 'openai';
import {
  ModelRouterProviderError,
  composeServerGuidance,
  type ModelRouter,
  type ModelRouterRequest,
  type ModelRouterResult,
} from '../../model-router.types';
import { releaseModelOutput } from '../../model-output-release-guard';
import {
  DEEPSEEK_API_BASE_URL,
  loadDeepSeekModelRouterConfig,
  type DeepSeekModelRouterConfig,
} from './deepseek-model-router.config';
import { TelemetryService } from '../../../observability/telemetry.service';
import { assertForegroundProviderBudget } from '../../../conversation/foreground-turn-work';
import type { AiProviderCallAccounting } from '../../../ai-usage/ai-provider-call-accounting';
import { accountedDeepSeekChatCompletionsClient } from '../../../ai-usage/accounted-provider-clients';
import { runWithAiUsageProcessingPath } from '../../../ai-usage/ai-usage-attribution';

// S8A-01: DeepSeek through its OpenAI-format Chat Completions API. Only `message.content` is ever read: the reasoning
// trace DeepSeek returns beside it in thinking mode is not part of the reply, so it is never read, kept, logged or sent
// back. No `tools` are sent, so DeepSeek never requires a reasoning trace to be returned in a later turn. No end-user
// identifier is sent while DeepSeek is qualification-only.
interface DeepSeekChatCompletion {
  choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } | null }> | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

interface DeepSeekChatCompletionsClient {
  chat: {
    completions: {
      create(
        body: {
          model: string;
          messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
          max_tokens: number;
          thinking: { type: 'enabled' | 'disabled' };
          reasoning_effort?: 'low';
          stream: false;
        },
        options: { timeout: number; maxRetries: 0; signal: AbortSignal },
      ): Promise<DeepSeekChatCompletion>;
    };
  };
}

export class DeepSeekModelRouter implements ModelRouter {
  /** AI-COST-01: there is no unaccounted DeepSeek composition; every reply attempt is one ledger row. */
  static fromEnvironment(telemetry: TelemetryService | undefined, accounting: AiProviderCallAccounting): DeepSeekModelRouter {
    const config = loadDeepSeekModelRouterConfig();
    return new DeepSeekModelRouter(config, accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'CONVERSATION_REPLY', accounting), telemetry);
  }

  constructor(
    private readonly config: DeepSeekModelRouterConfig,
    private readonly client: DeepSeekChatCompletionsClient,
    private readonly telemetry?: TelemetryService,
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
        {
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
          stream: false,
        },
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
}

export function createDeepSeekClient(config: DeepSeekModelRouterConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: DEEPSEEK_API_BASE_URL,
    // The SDK would otherwise read these from OPENAI_* variables and send them to DeepSeek as headers.
    organization: null,
    project: null,
    adminAPIKey: null,
    webhookSecret: null,
    maxRetries: config.maxRetries,
    timeout: config.timeoutMs,
    logLevel: 'off',
  });
}
