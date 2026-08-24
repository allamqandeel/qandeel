import { Module } from '@nestjs/common';
import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { GeminiHypothesisEvidenceAssociationProvider } from './gemini-hypothesis-evidence-association.provider';
import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, type HypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.types';

export function createConfiguredHypothesisEvidenceAssociationProvider(environment: NodeJS.ProcessEnv = process.env): HypothesisEvidenceAssociationProvider {
  if (environment.NODE_ENV === 'test') return new FakeHypothesisEvidenceAssociationProvider();
  return GeminiHypothesisEvidenceAssociationProvider.fromEnvironment(environment);
}
@Module({ providers: [{ provide: HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, useFactory: () => createConfiguredHypothesisEvidenceAssociationProvider(process.env) }], exports: [HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER] })
export class HypothesisEvidenceAssociationProviderModule {}
