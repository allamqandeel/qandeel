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

/**
 * Defers provider SELECTION to the first generation, without changing what it selects.
 *
 * Nest calls `useFactory` at bootstrap, so registering `createConfiguredModelRouter` directly made
 * choosing a provider a precondition of STARTING the process: an API with no `MODEL_PROVIDER` could
 * not boot, and therefore could not serve `/health`, auth, Session, temporal or projection — routes
 * that reach no provider at all. QANDEEL's production provider choice is deliberately still open,
 * and nothing should force it merely to run the parts of the API that do not generate.
 *
 * `ModelRouter` has exactly one method, so the deferral costs one delegation and adds no
 * abstraction. Selection logic is untouched: `createConfiguredModelRouter` is unchanged, and an
 * unconfigured provider still throws the SAME error — now when something actually tries to generate,
 * which is the moment the missing choice genuinely matters. Generation still fails closed.
 *
 * Only success is memoized. Caching the failure would turn "no provider is configured" into a stale
 * error object that outlives the condition, and re-deriving it costs nothing.
 */
export function deferredModelRouter(resolve: () => ModelRouter): ModelRouter {
  let resolved: ModelRouter | undefined;
  return {
    // `async` deliberately: `resolve()` can throw, and a Promise-returning method that sometimes
    // throws synchronously is a different contract from one that always rejects. Callers `await`
    // this, so the failure must arrive as a rejection whatever its origin.
    generate: async (request) => {
      resolved ??= resolve();
      return resolved.generate(request);
    },
  };
}

@Module({
  imports:[ObservabilityModule],
  providers: [
    {
      provide: MODEL_ROUTER,
      useFactory: (telemetry:TelemetryService) => deferredModelRouter(() => createConfiguredModelRouter(process.env,telemetry)),inject:[TelemetryService],
    },
  ],
  exports: [MODEL_ROUTER],
})
export class ModelRouterModule {}
