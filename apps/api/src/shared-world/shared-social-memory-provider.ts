// S8A-04 CP2 — the compositions of the Shared knowledge recall and the Shared spatial placer.
//
//   recall:  NODE_ENV=test → the deterministic test recaller; otherwise DeepSeek Flash through the shared client, behind the
//            SYNTHETIC_ONLY gate and the ONE AI-COST-01 boundary (family SHARED_KNOWLEDGE_RECALL), built on the first call
//            like the CP1 reading. Where DeepSeek may not run, every recall is refused before any request, and the reply
//            takes the safe path.
//   placer:  the production factory stays `createConfiguredSharedSpatialPlacer` (`shared-spatial-placer.ts`), which refuses
//            outside tests until the §11 binding conditions hold (§7). `createQualificationSharedSpatialPlacer` composes
//            the DeepSeek placer for the synthetic qualification harness only; nothing in the application calls it.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import type { AiProviderCallAccounting } from '../ai-usage/ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekSharedKnowledgeRecaller } from './deepseek-shared-knowledge-recall';
import { DeepSeekSharedSpatialPlacer } from './deepseek-shared-spatial-placer';
import { FakeSharedKnowledgeRecaller, type SharedKnowledgeRecaller } from './shared-knowledge-recall';
import { loadSharedKnowledgeRecallDeepSeekConfig, loadSharedSpatialPlacementDeepSeekConfig } from './shared-social-memory-provider.config';
import type { SharedSpatialPlacer } from './shared-spatial-placer';

export function createConfiguredSharedKnowledgeRecaller(environment: NodeJS.ProcessEnv = process.env): SharedKnowledgeRecaller {
  if (environment.NODE_ENV === 'test') return new FakeSharedKnowledgeRecaller();
  let resolved: SharedKnowledgeRecaller | undefined;
  return {
    recall: async (input, signal) => {
      resolved ??= (() => {
        const config = loadSharedKnowledgeRecallDeepSeekConfig(environment);
        return new DeepSeekSharedKnowledgeRecaller(config, accountedDeepSeekChatCompletionsClient(
          createDeepSeekClient(config), 'SHARED_KNOWLEDGE_RECALL', productionAiProviderCallAccounting()));
      })();
      return resolved.recall(input, signal);
    },
  };
}

/** The synthetic qualification harness's DeepSeek placer (S8A-04 CP2 §11). Not the application's composition (§7). */
export function createQualificationSharedSpatialPlacer(
  environment: NodeJS.ProcessEnv, accounting: AiProviderCallAccounting,
): SharedSpatialPlacer {
  const config = loadSharedSpatialPlacementDeepSeekConfig(environment);
  return new DeepSeekSharedSpatialPlacer(config, accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'SHARED_SPATIAL_PLACEMENT', accounting));
}
