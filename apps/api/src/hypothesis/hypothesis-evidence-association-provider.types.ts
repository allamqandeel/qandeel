import type {
  HypothesisEvidenceAssociationProposal,
  HypothesisEvidenceAssociationSnapshot,
} from './hypothesis-evidence-association.types';

export interface HypothesisEvidenceAssociationProvider {
  propose(snapshot: HypothesisEvidenceAssociationSnapshot): Promise<ReadonlyArray<HypothesisEvidenceAssociationProposal>>;
}
