import type {
  HypothesisEvidenceAssociationProposal,
  HypothesisEvidenceAssociationSnapshot,
} from './hypothesis-evidence-association.types';

export interface HypothesisEvidenceAssociationProvider {
  propose(snapshot: HypothesisEvidenceAssociationSnapshot): Promise<ReadonlyArray<HypothesisEvidenceAssociationProposal>>;
}

export const HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER = Symbol('HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER');
export const HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER_SCHEMA_VERSION = 1 as const;

export type HypothesisEvidenceAssociationProviderErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'PROVIDER_ERROR';

export class HypothesisEvidenceAssociationProviderError extends Error {
  constructor(readonly code: HypothesisEvidenceAssociationProviderErrorCode) {
    super('Hypothesis evidence association provider failed.');
    this.name = 'HypothesisEvidenceAssociationProviderError';
  }
}
