// S8A-04 CP2 — the compositions of the Shared knowledge recall and the Shared spatial placer.
//
//   recall:  NODE_ENV=test → the deterministic test recaller; otherwise DeepSeek Flash through the shared client, behind the
//            SYNTHETIC_ONLY gate and the ONE AI-COST-01 boundary (family SHARED_KNOWLEDGE_RECALL), built on the first call
//            like the CP1 reading. Where DeepSeek may not run, every recall is refused before any request, and the reply
//            takes the safe path.
//   placer:  NODE_ENV=test → the deterministic test placer; otherwise DeepSeek Flash through the shared client, behind the
//            SYNTHETIC_ONLY gate and the ONE AI-COST-01 boundary (family SHARED_SPATIAL_PLACEMENT), bound by S8A-04 CP2 §7
//            (2026-10-25, CP2's last change). The gate is read when the placer is composed: where
//            DeepSeek may not run (a production process, an undeclared mode, no key), the placer is the refusing one, so the
//            pass returns NO_PROVIDER before it leases, reads or spends anything — never a fallback or a fake point.
//            `createQualificationSharedSpatialPlacer` is the synthetic harness's, with the accounting it is handed.
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import type { AiProviderCallAccounting } from '../ai-usage/ai-provider-call-accounting';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekSharedKnowledgeRecaller } from './deepseek-shared-knowledge-recall';
import { DeepSeekSharedSpatialPlacer } from './deepseek-shared-spatial-placer';
import { FakeSharedKnowledgeRecaller, type SharedKnowledgeRecaller } from './shared-knowledge-recall';
import {
  loadSharedKnowledgeRecallDeepSeekConfig, loadSharedSpatialPlacementDeepSeekConfig, type SharedSocialMemoryDeepSeekConfig,
} from './shared-social-memory-provider.config';
import { FakeSharedSpatialPlacer, UnconfiguredSharedSpatialPlacer, type SharedSpatialPlacer } from './shared-spatial-placer';

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

/** The application's placer (S8A-04 CP2 §7). */
export function createConfiguredSharedSpatialPlacer(environment: NodeJS.ProcessEnv = process.env): SharedSpatialPlacer {
  if (environment.NODE_ENV === 'test') return new FakeSharedSpatialPlacer();
  let config: SharedSocialMemoryDeepSeekConfig;
  try {
    config = loadSharedSpatialPlacementDeepSeekConfig(environment);
  } catch {
    return new UnconfiguredSharedSpatialPlacer();
  }
  return deepSeekSharedSpatialPlacer(config, productionAiProviderCallAccounting());
}

/** The synthetic qualification harness's DeepSeek placer (S8A-04 CP2 §11), with the accounting it is handed. */
export function createQualificationSharedSpatialPlacer(
  environment: NodeJS.ProcessEnv, accounting: AiProviderCallAccounting,
): SharedSpatialPlacer {
  return deepSeekSharedSpatialPlacer(loadSharedSpatialPlacementDeepSeekConfig(environment), accounting);
}

/** The one DeepSeek placer composition: one accounted client, one call per pass, zero retries. */
function deepSeekSharedSpatialPlacer(config: SharedSocialMemoryDeepSeekConfig, accounting: AiProviderCallAccounting): SharedSpatialPlacer {
  return new DeepSeekSharedSpatialPlacer(config, accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'SHARED_SPATIAL_PLACEMENT', accounting));
}
