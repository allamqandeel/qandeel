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
  static fromEnvironment(): OpenAIModelRouter {
    const config = loadOpenAIModelRouterConfig();
    return new OpenAIModelRouter(config, createOpenAIClient(config));
  }

  constructor(
    private readonly config: OpenAIModelRouterConfig,
    private readonly client: OpenAIResponsesClient,
  ) {}

  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const modelConfiguration = this.config.resolveModel(request.path);
    const timeout = Math.min(request.latencyBudgetMs, this.config.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client.responses.create(
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
      const content = response.output_text.trim();
      if (!content) throw new ModelRouterProviderError();

      return {
        content,
        routingMetadata: { path: request.path },
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
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
