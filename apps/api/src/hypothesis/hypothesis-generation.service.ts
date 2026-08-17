import { BadRequestException, Injectable } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { HypothesisService } from './hypothesis.service';
import {
  HYPOTHESIS_DOMAINS, HYPOTHESIS_TYPES, MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS,
  MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH, type HypothesisRecord,
} from './hypothesis.types';
import {
  MAX_GENERATED_HYPOTHESIS_CANDIDATES, MAX_GENERATION_EVIDENCE_ITEMS,
  type HypothesisCandidateGenerator, type HypothesisCandidateProposal,
  type HypothesisCandidateRejectionReason, type HypothesisGenerationInput,
  type HypothesisGenerationRequest, type HypothesisGenerationResult,
} from './hypothesis-generation.types';

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
    const active = new Set(request.existingActiveHypotheses.map((item) => this.collisionKey(item.statement, item.scope)));

    for (let index = 0; index < proposals.length; index += 1) {
      if (index >= request.maxCandidateCount) {
        rejected.push({ candidateIndex: index, reason: 'CANDIDATE_LIMIT_EXCEEDED' });
        continue;
      }
      const reason = this.validateProposal(proposals[index], request, seen, active);
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
      active.add(this.collisionKey(proposal.statement, proposal.scope));
    }

    return { accepted, rejected };
  }

  private async buildRequest(userId: string, accessToken: string, input: HypothesisGenerationInput): Promise<HypothesisGenerationRequest> {
    if (!HYPOTHESIS_DOMAINS.includes(input.domain)) throw new BadRequestException('Invalid hypothesis domain.');
    const problem = this.text(input.problem, MAX_STATEMENT_LENGTH);
    const scope = this.text(input.scope, MAX_SCOPE_LENGTH);
    if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length > MAX_GENERATION_EVIDENCE_ITEMS || new Set(input.evidenceIds).size !== input.evidenceIds.length) {
      throw new BadRequestException('Invalid generation evidence set.');
    }
    const eligible = await this.evidence.listEligibleForUser(userId, accessToken);
    const eligibleById = new Map(eligible.map((item) => [item.evidenceId, item]));
    const requested = input.evidenceIds.map((id) => eligibleById.get(id));
    if (requested.some((item) => !item)) throw new BadRequestException('Generation evidence is not currently eligible.');
    return {
      userId,
      problem,
      domain: input.domain,
      scope,
      eligibleEvidence: requested as HypothesisGenerationRequest['eligibleEvidence'],
      existingActiveHypotheses: await this.hypotheses.listActiveForUser(userId, accessToken),
      maxCandidateCount: MAX_GENERATED_HYPOTHESIS_CANDIDATES,
    };
  }

  private validateProposal(
    value: HypothesisCandidateProposal,
    request: HypothesisGenerationRequest,
    seen: Set<string>,
    active: Set<string>,
  ): HypothesisCandidateRejectionReason | undefined {
    const allowedFields = new Set([
      'statement', 'type', 'domain', 'scope', 'supportingEvidenceIds', 'contradictingEvidenceIds',
      'assumptions', 'disconfirmingConditions',
    ]);
    if (!value || typeof value !== 'object' || Object.keys(value).some((key) => !allowedFields.has(key)) ||
      !HYPOTHESIS_TYPES.includes(value.type) || value.domain !== request.domain || value.scope !== request.scope ||
      !this.validText(value.statement, MAX_STATEMENT_LENGTH) ||
      !this.validList(value.assumptions, MAX_ASSUMPTIONS) ||
      !this.validList(value.disconfirmingConditions, MAX_DISCONFIRMING_CONDITIONS) ||
      !this.validIds(value.supportingEvidenceIds) || !this.validIds(value.contradictingEvidenceIds)) return 'INVALID_CANDIDATE';
    const allowed = new Set(request.eligibleEvidence.map((item) => item.evidenceId));
    if ([...value.supportingEvidenceIds, ...value.contradictingEvidenceIds].some((id) => !allowed.has(id))) return 'EVIDENCE_OUTSIDE_REQUEST';
    if (value.supportingEvidenceIds.some((id) => value.contradictingEvidenceIds.includes(id))) return 'EVIDENCE_ROLE_CONFLICT';
    const key = this.collisionKey(value.statement, value.scope);
    if (seen.has(key)) return 'DUPLICATE_IN_BATCH';
    seen.add(key);
    if (active.has(key)) return 'DUPLICATE_ACTIVE_HYPOTHESIS';
    return undefined;
  }

  private validIds(values: string[]): boolean {
    return Array.isArray(values) && values.length <= MAX_GENERATION_EVIDENCE_ITEMS && new Set(values).size === values.length && values.every((value) => typeof value === 'string' && value.length > 0);
  }

  private validList(values: string[], max: number): boolean {
    return Array.isArray(values) && values.length <= max && new Set(values).size === values.length && values.every((value) => this.validText(value, MAX_STRUCTURED_TEXT_LENGTH));
  }

  private validText(value: string, max: number): boolean {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
  }

  private text(value: string, max: number): string {
    if (!this.validText(value, max)) throw new BadRequestException('Invalid hypothesis generation request.');
    return value.trim();
  }

  private collisionKey(statement: string, scope: string): string {
    return `${statement.normalize('NFKC').trim().replace(/\s+/gu, ' ')}\u0000${scope.normalize('NFKC').trim().replace(/\s+/gu, ' ')}`;
  }
}
