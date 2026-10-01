import OpenAI from 'openai';
import {
  ModelRouterProviderError,
  composeServerGuidance,
  type ModelRouter,
  type ModelRouterRequest,
  type ModelRouterResult,
} from '../../model-router.types';
import {
  loadOpenAIModelRouterConfig,
  type OpenAIModelRouterConfig,
} from './openai-model-router.config';
import { TelemetryService } from '../../../observability/telemetry.service';
import { assertForegroundProviderBudget } from '../../../conversation/foreground-turn-work';
import type { AiProviderCallAccounting } from '../../../ai-usage/ai-provider-call-accounting';
import { accountedOpenAIResponsesClient } from '../../../ai-usage/accounted-provider-clients';
import { runWithAiUsageProcessingPath } from '../../../ai-usage/ai-usage-attribution';

interface OpenAIResponse {
  output_text: string;
  usage?: { input_tokens: number; output_tokens: number } | null;
}

interface OpenAIResponsesClient {
  responses: {
    create(
      body: {
        model: string;
        instructions: string;
        input: Array<{ role: 'user' | 'assistant'; content: string }>;
        max_output_tokens: number;
        reasoning: { effort: 'none' | 'low' };
        store: false;
      },
      options: { timeout: number; maxRetries: 0; signal: AbortSignal },
    ): Promise<OpenAIResponse>;
  };
}

export class OpenAIModelRouter implements ModelRouter {
  /**
   * AI-COST-01: production composition passes the accounting boundary, so every reply attempt is one ledger row;
   * the operator-only evaluation harness (brain-eval, not production) composes without it.
   */
  static fromEnvironment(telemetry?:TelemetryService, accounting?: AiProviderCallAccounting): OpenAIModelRouter {
    const config = loadOpenAIModelRouterConfig();
    const client = createOpenAIClient(config);
    return new OpenAIModelRouter(config, accounting ? accountedOpenAIResponsesClient(client, 'CONVERSATION_REPLY', accounting) : client, telemetry);
  }

  constructor(
    private readonly config: OpenAIModelRouterConfig,
    private readonly client: OpenAIResponsesClient,
    private readonly telemetry?:TelemetryService,
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

    try {
      const call=()=>this.client.responses.create(
        {
          model: modelConfiguration.model,
          instructions: composeServerGuidance(request),
          input: request.context.map((message) => ({
            role: message.role === 'USER' ? 'user' : 'assistant',
            content: message.content,
          })),
          max_output_tokens: this.config.maxOutputTokens,
          reasoning: { effort: modelConfiguration.reasoningEffort },
          store: false,
        },
        { timeout, maxRetries: 0, signal: controller.signal },
      );
      const response = this.telemetry
        ? await this.telemetry.withProvider('openai',modelConfiguration.model,request.path,timeout,call,value=>value.usage?{inputTokens:value.usage.input_tokens,outputTokens:value.usage.output_tokens}:undefined)
        : await call();
      const content = response.output_text.trim();
      if (!content) throw new ModelRouterProviderError();

      return {
        content,
        routingMetadata: { path: request.path },
        // AI-COST-01: a usage the provider did not report is unknown, never zero.
        usage: {
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null,
        },
      };
    } catch {
      throw new ModelRouterProviderError();
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createOpenAIClient(config: OpenAIModelRouterConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    maxRetries: config.maxRetries,
    timeout: config.timeoutMs,
    logLevel: 'off',
  });
}
