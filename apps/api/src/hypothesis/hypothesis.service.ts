import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EvidenceService } from '../memory/evidence.service';
import { canTransitionHypothesis } from './hypothesis-lifecycle';
import { HypothesisRepository } from './hypothesis.repository';
import { HYPOTHESIS_DOMAINS, HYPOTHESIS_ORIGINS, HYPOTHESIS_STATUSES, HYPOTHESIS_TYPES, MAX_ACTIVE_HYPOTHESES, MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH, type CreateHypothesisInput, type EvidenceRole, type HypothesisRecord, type HypothesisStatus, type HypothesisView } from './hypothesis.types';

@Injectable()
export class HypothesisService {
  constructor(private readonly repository: HypothesisRepository, private readonly evidence: EvidenceService) {}
  // Creation takes no access token. After migration 0027 the authoritative
  // Hypothesis write is a server-authority command, so a caller credential is
  // never the authority for one; validation is unchanged, and reads and the
  // existing constrained mutation commands keep the owner-scoped
  // authenticated path.
  async create(userId: string, input: CreateHypothesisInput): Promise<HypothesisRecord> {
    return this.repository.create(randomUUID(), userId, this.validateCreate(input));
  }
  async find(userId: string, token: string, id: string): Promise<HypothesisView> {
    const hypothesis = await this.getOwned(userId, token, id);
    const eligible = new Set((await this.evidence.listEligibleForUser(userId, token)).map((item) => item.evidenceId));
    return { ...hypothesis, currentlyEligibleSupportingEvidenceIds: hypothesis.supporting_evidence_ids.filter((item) => eligible.has(item)), currentlyEligibleContradictingEvidenceIds: hypothesis.contradicting_evidence_ids.filter((item) => eligible.has(item)) };
  }
  listActiveForUser(userId: string, token: string): Promise<HypothesisRecord[]> {
    return this.repository.listActive(token, userId, MAX_ACTIVE_HYPOTHESES);
  }
  async transition(userId: string, token: string, id: string, status: HypothesisStatus): Promise<HypothesisRecord> {
    if (!HYPOTHESIS_STATUSES.includes(status)) throw new BadRequestException('Invalid hypothesis status.');
    const current = await this.getOwned(userId, token, id);
    if (!canTransitionHypothesis(current.status, status)) throw new BadRequestException('Invalid hypothesis status transition.');
    return this.requireResult(await this.repository.transition(token, id, status));
  }
  async attachEvidence(userId: string, token: string, id: string, evidenceId: string, role: EvidenceRole): Promise<HypothesisRecord> {
    const current = await this.getOwned(userId, token, id);
    if (role !== 'SUPPORTING' && role !== 'CONTRADICTING') throw new BadRequestException('Invalid evidence role.');
    if (!(await this.evidence.listEligibleForUser(userId, token)).some((item) => item.evidenceId === evidenceId)) throw new BadRequestException('Evidence is not currently eligible.');
    const own = role === 'SUPPORTING' ? current.supporting_evidence_ids : current.contradicting_evidence_ids;
    const opposite = role === 'SUPPORTING' ? current.contradicting_evidence_ids : current.supporting_evidence_ids;
    if (own.includes(evidenceId)) throw new BadRequestException('Evidence is already attached.');
    if (opposite.includes(evidenceId)) throw new BadRequestException('Evidence cannot have both roles.');
    return this.requireResult(await this.repository.attachEvidence(token, id, evidenceId, role));
  }
  async linkCompetitor(userId: string, token: string, id: string, competitorId: string): Promise<HypothesisRecord> {
    if (id === competitorId) throw new BadRequestException('A hypothesis cannot compete with itself.');
    const [current, competitor] = await Promise.all([this.getOwned(userId, token, id), this.getOwned(userId, token, competitorId)]);
    if (current.competing_hypothesis_ids.includes(competitor.id)) throw new BadRequestException('Hypotheses are already competitors.');
    return this.requireResult(await this.repository.linkCompetitor(token, id, competitor.id));
  }
  private async getOwned(userId: string, token: string, id: string): Promise<HypothesisRecord> {
    const value = await this.repository.find(token, userId, id);
    if (!value || value.user_id !== userId) throw new NotFoundException('Hypothesis not found.');
    return value;
  }
  private requireResult(value: HypothesisRecord | undefined): HypothesisRecord {
    if (!value) throw new NotFoundException('Hypothesis not found.');
    return value;
  }
  private validateCreate(input: CreateHypothesisInput): CreateHypothesisInput {
    if (!HYPOTHESIS_TYPES.includes(input.type)) throw new BadRequestException('Invalid hypothesis type.');
    if (!HYPOTHESIS_DOMAINS.includes(input.domain)) throw new BadRequestException('Invalid hypothesis domain.');
    if (!HYPOTHESIS_ORIGINS.includes(input.origin)) throw new BadRequestException('Invalid hypothesis origin.');
    return { ...input, statement: this.text(input.statement, MAX_STATEMENT_LENGTH, 'statement'), scope: this.text(input.scope, MAX_SCOPE_LENGTH, 'scope'), assumptions: this.list(input.assumptions ?? [], MAX_ASSUMPTIONS, 'assumptions'), disconfirmingConditions: this.list(input.disconfirmingConditions ?? [], MAX_DISCONFIRMING_CONDITIONS, 'disconfirming conditions') };
  }
  private list(values: string[], max: number, name: string): string[] {
    if (!Array.isArray(values) || values.length > max) throw new BadRequestException(`Too many ${name}.`);
    const normalized = values.map((value) => this.text(value, MAX_STRUCTURED_TEXT_LENGTH, name));
    if (new Set(normalized).size !== normalized.length) throw new BadRequestException(`Duplicate ${name}.`);
    return normalized;
  }
  private text(value: string, max: number, name: string): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) throw new BadRequestException(`Invalid hypothesis ${name}.`);
    return value.trim();
  }
}
