// S8A-05 CP4 — the one composition of the Public QANDEEL reply's Model Router (Controlled Amendment A-5(d)).
//
//   NODE_ENV=test   the Model Router's own deterministic test seam;
//   otherwise       DeepSeek Flash through the ONE DeepSeek router, behind its SYNTHETIC_ONLY qualification gate, and through
//                   the ONE AI-COST-01 accounting boundary under its own feature family PUBLIC_QANDEEL_REPLY (migration 0182),
//                   paid by the human who invoked @qandeel (the generator's attribution scope). It is built on the first
//                   attempt, so the API starts without a credential; where DeepSeek may not run (a production process, an
//                   undeclared mode, no key) every attempt is refused before any request, and the post's QANDEEL state is
//                   UNAVAILABLE — no QANDEEL words are invented.
//
// The Public World module hands it to the Public generator alone (no second MODEL_ROUTER provider is registered), so the
// Personal and Shared replies keep the application router (CONVERSATION_REPLY), the application's MODEL_ROUTER stays the
// only one in the container, and the Public generator keeps reading the provider-neutral port.
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { FakeModelRouter } from '../model-router/fake-model-router';
import { deferredModelRouter } from '../model-router/model-router.module';
import type { ModelRouter } from '../model-router/model-router.types';
import { DeepSeekModelRouter } from '../model-router/providers/deepseek/deepseek-model-router';

export function createPublicQandeelModelRouter(environment: NodeJS.ProcessEnv = process.env): ModelRouter {
  if (environment.NODE_ENV === 'test') return new FakeModelRouter();
  return deferredModelRouter(() => DeepSeekModelRouter.forPublicQandeel(undefined, productionAiProviderCallAccounting()));
}
