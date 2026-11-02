import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { liveCallFetch } from '../http-transport/live-call-keep-alive-fetch';
import type { ModelRouter } from '../model-router/model-router.types';
import { DeepSeekModelRouter } from '../model-router/providers/deepseek/deepseek-model-router';
import type { TelemetryService } from '../observability/telemetry.service';
import { deferredLiveCallRouter } from './live-call-reply.service';

/**
 * S8B-05 CP2 (contract §5, L1): the live call's production REALTIME router — its own DeepSeek router (FAST without
 * thinking, first token 2 000 ms, 5 000 ms, max_tokens 160) over the call's keep-alive transport, every attempt through
 * the one AI-COST-01 boundary. Selected at its first generation, like the text reply's: composing it reads nothing.
 */
export function productionLiveCallRouter(telemetry: TelemetryService): ModelRouter {
  return deferredLiveCallRouter(() => {
    if (process.env.MODEL_PROVIDER?.trim().toLowerCase() !== 'deepseek') throw new Error('MODEL_PROVIDER must be deepseek.');
    return DeepSeekModelRouter.forLiveCall(telemetry, productionAiProviderCallAccounting(), liveCallFetch());
  });
}
