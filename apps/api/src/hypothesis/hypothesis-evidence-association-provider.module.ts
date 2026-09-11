import { Module } from '@nestjs/common';
import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { GeminiHypothesisEvidenceAssociationProvider } from './gemini-hypothesis-evidence-association.provider';
import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, type HypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.types';

export function createConfiguredHypothesisEvidenceAssociationProvider(environment: NodeJS.ProcessEnv = process.env): HypothesisEvidenceAssociationProvider {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisEvidenceAssociationProvider();
  return GeminiHypothesisEvidenceAssociationProvider.fromEnvironment(environment);
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
