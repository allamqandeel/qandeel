import type { HypothesisEvidenceAssociationProvider } from './hypothesis-evidence-association-provider.types';
import type {
  HypothesisEvidenceAssociationProposal,
  HypothesisEvidenceAssociationSnapshot,
} from './hypothesis-evidence-association.types';

export class FakeHypothesisEvidenceAssociationProvider implements HypothesisEvidenceAssociationProvider {
  readonly calls: HypothesisEvidenceAssociationSnapshot[] = [];
  private proposals: ReadonlyArray<HypothesisEvidenceAssociationProposal> = [];

  setProposals(proposals: ReadonlyArray<HypothesisEvidenceAssociationProposal>): void {
    this.proposals = structuredClone(proposals);
  }

  async propose(snapshot: HypothesisEvidenceAssociationSnapshot): Promise<ReadonlyArray<HypothesisEvidenceAssociationProposal>> {
    this.calls.push(structuredClone(snapshot));
    return structuredClone(this.proposals);
  }
}
