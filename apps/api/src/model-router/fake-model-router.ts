import { Injectable } from '@nestjs/common';
import type { ModelRouter, ModelRouterRequest, ModelRouterResult } from './model-router.types';

@Injectable()
export class FakeModelRouter implements ModelRouter {
  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const userInput = request.context.at(-1)?.content ?? '';
    return {
      content: `Qandeel test response: ${userInput}`,
      routingMetadata: { path: request.path },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
