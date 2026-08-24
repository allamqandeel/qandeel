import { Inject, Injectable } from '@nestjs/common';
import { BackgroundIntelligenceAuthorityService, type BackgroundIntelligenceExecutionContext } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceEnrichmentService } from '../background-intelligence/background-intelligence-enrichment.service';
import { HypothesisEvidenceAssociationAuthorityService } from '../hypothesis/hypothesis-evidence-association-authority.service';
import { HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER, type HypothesisEvidenceAssociationProvider } from '../hypothesis/hypothesis-evidence-association-provider.types';
import type { HypothesisEvidenceAssociationAuthorization, HypothesisEvidenceAssociationPreparation, HypothesisEvidenceAssociationSnapshot } from '../hypothesis/hypothesis-evidence-association.types';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

@Injectable()
export class ModelAssistedHypothesisAssociationService {
  constructor(
    private readonly enrichment: BackgroundIntelligenceEnrichmentService,
    private readonly associationAuthority: HypothesisEvidenceAssociationAuthorityService,
    private readonly backgroundAuthority: BackgroundIntelligenceAuthorityService,
    @Inject(HYPOTHESIS_EVIDENCE_ASSOCIATION_PROVIDER) private readonly provider: HypothesisEvidenceAssociationProvider,
  ) {}

  async prepare(context: BackgroundIntelligenceExecutionContext, freshEvidenceId: string): Promise<HypothesisEvidenceAssociationPreparation> {
    const [evidence, hypotheses] = await Promise.all([
      this.enrichment.listEligibleEvidence(context), this.enrichment.listActiveHypotheses(context),
    ]);
    return this.associationAuthority.prepareFromCanonicalState(context.userId, context.sessionId, freshEvidenceId, evidence, hypotheses);
  }

  async proposeAndAuthorize(event: RuntimeEventEnvelope, original: BackgroundIntelligenceExecutionContext, snapshot: HypothesisEvidenceAssociationSnapshot): Promise<HypothesisEvidenceAssociationAuthorization> {
    const proposals = await this.provider.propose(snapshot);
    const reread = await this.backgroundAuthority.authorize(event);
    if (reread.outcome !== 'AUTHORIZED' || !reread.context || !sameAuthority(original, reread.context)) throw new Error('ASSOCIATION_CANONICAL_AUTHORITY_CHANGED');
    const [evidence, hypotheses] = await Promise.all([
      this.enrichment.listEligibleEvidence(reread.context), this.enrichment.listActiveHypotheses(reread.context),
    ]);
    return this.associationAuthority.authorizeFromCanonicalState(reread.context.userId, reread.context.sessionId, snapshot, proposals, evidence, hypotheses);
  }
}

function sameAuthority(a: BackgroundIntelligenceExecutionContext, b: BackgroundIntelligenceExecutionContext): boolean {
  return a.eventId === b.eventId && a.userId === b.userId && a.sessionId === b.sessionId && a.sourceTurnId === b.sourceTurnId;
}
