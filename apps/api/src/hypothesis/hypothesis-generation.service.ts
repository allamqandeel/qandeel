import { Injectable } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';
import {
  MAX_GENERATED_HYPOTHESIS_CANDIDATES,
  type HypothesisCandidateGenerator, type HypothesisGenerationInput,
  type HypothesisGenerationRequest, type HypothesisGenerationResult,
} from './hypothesis-generation.types';
import { hypothesisCollisionKey, normalizeGenerationInput, validateGenerationEvidenceIds, validateHypothesisCandidate } from './hypothesis-generation.policy';

@Injectable()
export class HypothesisGenerationService {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly hypotheses: HypothesisService,
  ) {}

  async generate(
    userId: string,
    accessToken: string,
    input: HypothesisGenerationInput,
    generator: HypothesisCandidateGenerator,
  ): Promise<HypothesisGenerationResult> {
    const request = await this.buildRequest(userId, accessToken, input);
    const proposals = await generator.generate(request);
    if (!Array.isArray(proposals)) throw new BadRequestException('Generator returned an invalid candidate batch.');

    const accepted: HypothesisRecord[] = [];
    const rejected: HypothesisGenerationResult['rejected'] = [];
    const seen = new Set<string>();
    const active = new Set(request.existingActiveHypotheses.map((item) => hypothesisCollisionKey(item.statement, item.scope)));

    for (let index = 0; index < proposals.length; index += 1) {
      if (index >= request.maxCandidateCount) {
        rejected.push({ candidateIndex: index, reason: 'CANDIDATE_LIMIT_EXCEEDED' });
        continue;
      }
      const reason = validateHypothesisCandidate(proposals[index], request, seen, active);
      if (reason) {
        rejected.push({ candidateIndex: index, reason });
        continue;
      }
      const proposal = proposals[index];
      const created = await this.hypotheses.create(userId, accessToken, {
        statement: proposal.statement,
        type: proposal.type,
        domain: proposal.domain,
        scope: proposal.scope,
        origin: 'SYSTEM_GENERATED',
        assumptions: proposal.assumptions,
        disconfirmingConditions: proposal.disconfirmingConditions,
      });
      let persisted = created;
      for (const evidenceId of proposal.supportingEvidenceIds) {
        persisted = await this.hypotheses.attachEvidence(userId, accessToken, persisted.id, evidenceId, 'SUPPORTING');
      }
      for (const evidenceId of proposal.contradictingEvidenceIds) {
        persisted = await this.hypotheses.attachEvidence(userId, accessToken, persisted.id, evidenceId, 'CONTRADICTING');
      }
      for (const alternative of accepted) {
        await this.hypotheses.linkCompetitor(userId, accessToken, alternative.id, persisted.id);
      }
      accepted.push(persisted);
      active.add(hypothesisCollisionKey(proposal.statement, proposal.scope));
    }

    return { accepted, rejected };
  }

  private async buildRequest(userId: string, accessToken: string, input: HypothesisGenerationInput): Promise<HypothesisGenerationRequest> {
    const {problem,domain,scope}=normalizeGenerationInput(input);validateGenerationEvidenceIds(input.evidenceIds);
    const eligible = await this.evidence.listEligibleForUser(userId, accessToken);
    const eligibleById = new Map(eligible.map((item) => [item.evidenceId, item]));
    const requested = input.evidenceIds.map((id) => eligibleById.get(id));
    if (requested.some((item) => !item)) throw new BadRequestException('Generation evidence is not currently eligible.');
    return {
      userId,
      problem,
      domain,
      scope,
      eligibleEvidence: requested as HypothesisGenerationRequest['eligibleEvidence'],
      existingActiveHypotheses: await this.hypotheses.listActiveForUser(userId, accessToken),
      maxCandidateCount: MAX_GENERATED_HYPOTHESIS_CANDIDATES,
    };
  }

}
