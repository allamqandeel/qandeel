import { Module } from '@nestjs/common';
import { ClaudeModelRouter } from './providers/anthropic/claude-model-router';
import { FakeModelRouter } from './fake-model-router';
import { MODEL_ROUTER, type ModelRouter } from './model-router.types';
import { OpenAIModelRouter } from './providers/openai/openai-model-router';

export function createConfiguredModelRouter(
  environment: NodeJS.ProcessEnv = process.env,
): ModelRouter {
  if (environment.NODE_ENV === 'test') return new FakeModelRouter();

  switch (environment.MODEL_PROVIDER?.trim().toLowerCase()) {
    case 'anthropic':
      return ClaudeModelRouter.fromEnvironment();
    case 'openai':
      return OpenAIModelRouter.fromEnvironment();
    default:
      throw new Error('MODEL_PROVIDER must be either anthropic or openai.');
  }
}

@Module({
  providers: [
    {
      provide: MODEL_ROUTER,
      useFactory: () => createConfiguredModelRouter(),
    },
  ],
  exports: [MODEL_ROUTER],
})
export class ModelRouterModule {}
