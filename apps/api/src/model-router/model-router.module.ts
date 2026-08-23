import { Module } from '@nestjs/common';
import { ClaudeModelRouter } from './providers/anthropic/claude-model-router';
import { FakeModelRouter } from './fake-model-router';
import { MODEL_ROUTER, type ModelRouter } from './model-router.types';
import { OpenAIModelRouter } from './providers/openai/openai-model-router';
import { ObservabilityModule } from '../observability/observability.module';
import { TelemetryService } from '../observability/telemetry.service';

export function createConfiguredModelRouter(
  environment: NodeJS.ProcessEnv = process.env,telemetry?:TelemetryService,
): ModelRouter {
  if (environment.NODE_ENV === 'test') return new FakeModelRouter();
  if (!telemetry) throw new Error('TelemetryService is required for a production model router.');

  switch (environment.MODEL_PROVIDER?.trim().toLowerCase()) {
    case 'anthropic':
      return ClaudeModelRouter.fromEnvironment(telemetry);
    case 'openai':
      return OpenAIModelRouter.fromEnvironment(telemetry);
    default:
      throw new Error('MODEL_PROVIDER must be either anthropic or openai.');
  }
}

@Module({
  imports:[ObservabilityModule],
  providers: [
    {
      provide: MODEL_ROUTER,
      useFactory: (telemetry:TelemetryService) => createConfiguredModelRouter(process.env,telemetry),inject:[TelemetryService],
    },
  ],
  exports: [MODEL_ROUTER],
})
export class ModelRouterModule {}
