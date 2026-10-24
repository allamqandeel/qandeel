import { Module } from '@nestjs/common';
import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { DeepSeekHypothesisEvidenceAssociationProvider } from './deepseek-hypothesis-evidence-association.provider';
import { loadHypothesisEvidenceAssociationDeepSeekConfig } from './hypothesis-evidence-association-provider.config';
import { accountedDeepSeekChatCompletionsClient } from '../ai-usage/accounted-provider-clients';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import { productionAiProviderCallAccounting } from '../ai-usage/production-ai-provider-call-accounting';
import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, type HypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.types';

export function createConfiguredHypothesisEvidenceAssociationProvider(environment: NodeJS.ProcessEnv = process.env): HypothesisEvidenceAssociationProvider {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisEvidenceAssociationProvider();
  // AI-COST-01: every proposal attempt passes the one accounting boundary. S8A-03: DeepSeek Flash, behind the
  // SYNTHETIC_ONLY qualification gate; this is the adapter's only composition.
  const config = loadHypothesisEvidenceAssociationDeepSeekConfig(environment);
  return new DeepSeekHypothesisEvidenceAssociationProvider(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'HYPOTHESIS_EVIDENCE_ASSOCIATION', productionAiProviderCallAccounting()));
}
/**
 * Defers association-provider construction to the first proposal, for the same reason as
 * `deferredModelRouter`: a provider credential must not be a precondition of STARTING the API, and
 * proposing an association is not something `/health`, auth, Session, temporal or projection do.
 * Validation is unchanged, and proposing still fails closed when nothing is configured.
 */
export function deferredHypothesisEvidenceAssociationProvider(
  resolve: () => HypothesisEvidenceAssociationProvider,
): HypothesisEvidenceAssociationProvider {
  let resolved: HypothesisEvidenceAssociationProvider | undefined;
  return {
    propose: async (snapshot) => {
      resolved ??= resolve();
      return resolved.propose(snapshot);
    },
  };
}

@Module({ providers: [{ provide: HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, useFactory: () => deferredHypothesisEvidenceAssociationProvider(() => createConfiguredHypothesisEvidenceAssociationProvider(process.env)) }], exports: [HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER] })
export class HypothesisEvidenceAssociationProviderModule {}
