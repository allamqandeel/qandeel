import { Module } from '@nestjs/common';
import { ClaudeModelRouter } from './providers/anthropic/claude-model-router';
import { FakeModelRouter } from './fake-model-router';
import { MODEL_ROUTER } from './model-router.types';

@Module({
  providers: [
    {
      provide: MODEL_ROUTER,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') return new FakeModelRouter();
        return ClaudeModelRouter.fromEnvironment();
      },
    },
  ],
  exports: [MODEL_ROUTER],
})
export class ModelRouterModule {}
