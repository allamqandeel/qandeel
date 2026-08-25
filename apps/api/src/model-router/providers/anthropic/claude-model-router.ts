import Anthropic from '@anthropic-ai/sdk';
import {
  ModelRouterProviderError,
  composeServerGuidance,
  type ModelRouter,
  type ModelRouterRequest,
  type ModelRouterResult,
} from '../../model-router.types';
import {
  loadClaudeModelRouterConfig,
  type ClaudeModelRouterConfig,
} from './claude-model-router.config';
import { TelemetryService } from '../../../observability/telemetry.service';

interface AnthropicTextBlock { type: 'text'; text: string }
interface AnthropicMessageResponse {
  content: Array<AnthropicTextBlock | { type: string }>;
  usage: { input_tokens: number; output_tokens: number };
}
interface AnthropicMessagesClient {
  messages: {
    create(
      body: {
        model: string;
        max_tokens: number;
        system: string;
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      },
      options: { timeout: number },
    ): Promise<AnthropicMessageResponse>;
  };
}

export class ClaudeModelRouter implements ModelRouter {
  static fromEnvironment(telemetry?:TelemetryService): ClaudeModelRouter {
    const config = loadClaudeModelRouterConfig();
    return new ClaudeModelRouter(config, createClaudeClient(config),telemetry);
  }

  constructor(
    private readonly config: ClaudeModelRouterConfig,
    private readonly client: AnthropicMessagesClient,
    private readonly telemetry?:TelemetryService,
  ) {}

  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const modelConfiguration = this.config.resolveModel(request.path);
    try {
      const call=()=>this.client.messages.create(
        {
          model: modelConfiguration.model,
          max_tokens: this.config.maxOutputTokens,
          system: composeServerGuidance(request),
          messages: request.context.map((message) => ({
            role: message.role === 'USER' ? 'user' : 'assistant',
            content: message.content,
          })),
        },
        { timeout: Math.min(request.latencyBudgetMs, this.config.timeoutMs) },
      );
      const response=this.telemetry?await this.telemetry.withProvider('anthropic',modelConfiguration.model,request.path,Math.min(request.latencyBudgetMs,this.config.timeoutMs),call,value=>({inputTokens:value.usage.input_tokens,outputTokens:value.usage.output_tokens})):await call();
      const content = response.content
        .filter((block): block is AnthropicTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      if (!content) throw new ModelRouterProviderError();

      return {
        content,
        routingMetadata: { path: request.path },
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch {
      throw new ModelRouterProviderError();
    }
  }
}

export function createClaudeClient(config: ClaudeModelRouterConfig): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey,
    maxRetries: config.maxRetries,
    timeout: config.timeoutMs,
  });
}
