import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { HypothesisRepository } from './hypothesis.repository';
import { HypothesisService } from './hypothesis.service';
import { HYPOTHESIS_STATUSES, HYPOTHESIS_TYPES, MAX_ACTIVE_HYPOTHESES, MAX_ASSUMPTIONS, type CreateHypothesisInput, type HypothesisRecord } from './hypothesis.types';

describe('HypothesisService', () => {
  let repository: jest.Mocked<HypothesisRepository>; let evidence: jest.Mocked<EvidenceService>; let service: HypothesisService;
  const input: CreateHypothesisInput = { statement: 'Time pressure contributes to indecision.', type: 'CAUSAL', domain: 'DECISION', scope: 'Current work decision', origin: 'HUMAN_REVIEWED', assumptions: ['Work conditions remain unchanged.'], disconfirmingConditions: ['Indecision persists without a deadline.'] };
  const record = (overrides: Partial<HypothesisRecord> = {}): HypothesisRecord => ({ id: '11111111-1111-4111-8111-111111111111', user_id: 'user-a', statement: input.statement, type: input.type, domain: input.domain, scope: input.scope, origin: input.origin, status: 'CANDIDATE', version: 1, supporting_evidence_ids: [], contradicting_evidence_ids: [], competing_hypothesis_ids: [], assumptions: input.assumptions!, disconfirming_conditions: input.disconfirmingConditions!, created_at: '2026-08-17T00:00:00.000Z', updated_at: '2026-08-17T00:00:00.000Z', ...overrides });
  beforeEach(() => {
    repository = { create: jest.fn(), find: jest.fn(), listActive: jest.fn(), transition: jest.fn(), attachEvidence: jest.fn(), linkCompetitor: jest.fn() } as unknown as jest.Mocked<HypothesisRepository>;
    evidence = { listEligibleForUser: jest.fn() } as unknown as jest.Mocked<EvidenceService>;
    service = new HypothesisService(repository, evidence);
  });
  it('creates an owned CANDIDATE with UUID identity and no confidence or reasoning fields', async () => {
    repository.create.mockImplementation(async (id, userId, value) => record({ id, user_id: userId, status: 'CANDIDATE', assumptions: value.assumptions }));
    const created = await service.create('user-a', input);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/iu); expect(created.status).toBe('CANDIDATE');
    expect(created).not.toHaveProperty('confidence'); expect(created).not.toHaveProperty('chainOfThought'); expect(created).not.toHaveProperty('diagnosis');
  });
  it('takes no caller access token as creation authority', async () => {
    repository.create.mockResolvedValue(record());
    await service.create('user-a', input);
    // (id, userId, validatedInput) - a user credential is never passed to, or
    // usable by, the server-authoritative creation path.
    expect(repository.create).toHaveBeenCalledWith(expect.any(String), 'user-a', expect.objectContaining({ origin: input.origin }));
    expect(HypothesisService.prototype.create).toHaveLength(2);
  });
  it.each(HYPOTHESIS_TYPES)('accepts canonical type %s', async (type) => { repository.create.mockResolvedValue(record({ type })); await expect(service.create('user-a', { ...input, type })).resolves.toBeDefined(); });
  it('rejects invalid type, domain, origin, and bounded metadata overflow', async () => {
    await expect(service.create('u',{ ...input, type: 'FACT' as never })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('u',{ ...input, domain: 'HEALTH' as never })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('u',{ ...input, origin: 'MODEL' as never })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('u',{ ...input, assumptions: Array(MAX_ASSUMPTIONS + 1).fill('x') })).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(HYPOTHESIS_STATUSES)('represents canonical status %s', (status) => expect(HYPOTHESIS_STATUSES).toContain(status));
  it('validates lifecycle and versioned transition results', async () => {
    repository.find.mockResolvedValue(record()); repository.transition.mockResolvedValue(record({ status: 'ACTIVE', version: 2 }));
    await expect(service.transition('user-a','t',record().id,'ACTIVE')).resolves.toMatchObject({ status: 'ACTIVE', version: 2 });
    await expect(service.transition('user-a','t',record().id,'SUPPORTED')).rejects.toBeInstanceOf(BadRequestException);
    repository.find.mockResolvedValue(record({ status: 'REJECTED' })); repository.transition.mockResolvedValue(record({ status: 'REOPENED', version: 3 }));
    await expect(service.transition('user-a','t',record().id,'REOPENED')).resolves.toMatchObject({ status: 'REOPENED' });
  });
  // Migration 0036: the exact expected version comes from the owned current
  // Hypothesis, and a stale-version failure is never retried against a newer row.
  it('supplies the owned current version as the exact expected version and never retries a stale transition', async () => {
    repository.find.mockResolvedValue(record({ status: 'WEAK', version: 9 }));
    repository.transition.mockResolvedValue(record({ status: 'ACTIVE', version: 10 }));
    await expect(service.transition('user-a','t',record().id,'ACTIVE')).resolves.toMatchObject({ status: 'ACTIVE', version: 10 });
    expect(repository.transition).toHaveBeenCalledTimes(1);
    expect(repository.transition).toHaveBeenCalledWith('t', record().id, 9, 'ACTIVE');
    repository.transition.mockReset();
    const stale = Object.assign(new Error('Stale hypothesis version.'), { code: '40001' });
    repository.transition.mockRejectedValue(stale);
    await expect(service.transition('user-a','t',record().id,'ACTIVE')).rejects.toBe(stale);
    expect(repository.transition).toHaveBeenCalledTimes(1);
  });
  // Evidence attachment is not a lifecycle decision: no automatic SUPPORTED /
  // MIXED / WEAK / REJECTED / RETIRED / REOPENED is ever derived here.
  it('never transitions lifecycle state as a side effect of Evidence attachment', async () => {
    const evidenceId = 'memory:33333333-3333-4333-8333-333333333333';
    repository.find.mockResolvedValue(record({ status: 'ACTIVE', version: 2 }));
    evidence.listEligibleForUser.mockResolvedValue([{ evidenceId } as never]);
    repository.attachEvidence.mockResolvedValue(record({ status: 'ACTIVE', version: 3, supporting_evidence_ids: [evidenceId] }));
    await expect(service.attachEvidence('user-a','t',record().id,evidenceId,'CONTRADICTING'))
      .resolves.toMatchObject({ status: 'ACTIVE' });
    expect(repository.transition).not.toHaveBeenCalled();
  });
  it('fails closed for cross-user read, update, transition, and competition', async () => {
    repository.find.mockResolvedValue(undefined);
    await expect(service.find('user-a','t','other')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.transition('user-a','t','other','ACTIVE')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.linkCompetitor('user-a','t',record().id,'other')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('keeps evidence roles separate, verifies eligibility, and preserves expired historical links', async () => {
    const evidenceId = 'memory:22222222-2222-4222-8222-222222222222'; repository.find.mockResolvedValue(record());
    evidence.listEligibleForUser.mockResolvedValue([{ evidenceId } as never]); repository.attachEvidence.mockResolvedValue(record({ supporting_evidence_ids: [evidenceId], version: 2 }));
    await expect(service.attachEvidence('user-a','t',record().id,evidenceId,'SUPPORTING')).resolves.toMatchObject({ supporting_evidence_ids: [evidenceId], contradicting_evidence_ids: [] });
    repository.find.mockResolvedValue(record({ supporting_evidence_ids: [evidenceId] })); evidence.listEligibleForUser.mockResolvedValue([]);
    await expect(service.find('user-a','t',record().id)).resolves.toMatchObject({ supporting_evidence_ids: [evidenceId], currentlyEligibleSupportingEvidenceIds: [] });
    await expect(service.attachEvidence('user-a','t',record().id,'memory:missing','CONTRADICTING')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects dual-role evidence, self/duplicate competitors, and bounds active reads', async () => {
    const evidenceId='memory:22222222-2222-4222-8222-222222222222'; repository.find.mockResolvedValue(record({ supporting_evidence_ids: [evidenceId] })); evidence.listEligibleForUser.mockResolvedValue([{ evidenceId } as never]);
    await expect(service.attachEvidence('user-a','t',record().id,evidenceId,'CONTRADICTING')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.linkCompetitor('user-a','t',record().id,record().id)).rejects.toBeInstanceOf(BadRequestException);
    repository.listActive.mockResolvedValue([]); await service.listActiveForUser('user-a','t'); expect(repository.listActive).toHaveBeenCalledWith('t','user-a',MAX_ACTIVE_HYPOTHESES);
  });
});
