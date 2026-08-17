import { NotFoundException } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { ConfidenceRepository } from './confidence.repository';
import { ConfidenceService } from './confidence.service';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisView } from './hypothesis.types';

describe('ConfidenceService', () => {
  let hypotheses: jest.Mocked<HypothesisService>;
  let evidence: jest.Mocked<EvidenceService>;
  let repository: jest.Mocked<ConfidenceRepository>;
  let service: ConfidenceService;
  const hypothesis = (overrides: Partial<HypothesisView> = {}): HypothesisView => ({
    id: '11111111-1111-4111-8111-111111111111', user_id: 'user-a', statement: 'Time pressure contributes.',
    type: 'CAUSAL', domain: 'DECISION', scope: 'Current decision', origin: 'HUMAN_REVIEWED', status: 'ACTIVE', version: 3,
    supporting_evidence_ids: ['memory:22222222-2222-4222-8222-222222222222'],
    contradicting_evidence_ids: ['memory:33333333-3333-4333-8333-333333333333'],
    competing_hypothesis_ids: [], assumptions: [], disconfirming_conditions: [],
    currentlyEligibleSupportingEvidenceIds: [], currentlyEligibleContradictingEvidenceIds: [],
    created_at: '2026-08-17T00:00:00.000Z', updated_at: '2026-08-17T00:00:00.000Z', ...overrides,
  });

  beforeEach(() => {
    hypotheses = { find: jest.fn() } as unknown as jest.Mocked<HypothesisService>;
    evidence = { listEligibleForUser: jest.fn() } as unknown as jest.Mocked<EvidenceService>;
    repository = { create: jest.fn(), listForTarget: jest.fn() } as unknown as jest.Mocked<ConfidenceRepository>;
    repository.create.mockImplementation(async (_token, value) => ({
      ...value, created_at: '2026-08-17T00:00:00.000Z', updated_at: '2026-08-17T00:00:00.000Z',
    }));
    service = new ConfidenceService(hypotheses, evidence, repository);
  });

  it('snapshots only eligible owned evidence while preserving support and contradiction roles', async () => {
    hypotheses.find.mockResolvedValue(hypothesis());
    evidence.listEligibleForUser.mockResolvedValue([{ evidenceId: hypothesis().supporting_evidence_ids[0] } as never]);
    const result = await service.evaluateHypothesis('user-a', 'token-a', hypothesis().id);
    expect(hypotheses.find).toHaveBeenCalledWith('user-a', 'token-a', hypothesis().id);
    expect(evidence.listEligibleForUser).toHaveBeenCalledWith('user-a', 'token-a');
    expect(result.supporting_evidence_ids).toEqual(hypothesis().supporting_evidence_ids);
    expect(result.contradicting_evidence_ids).toEqual([]);
  });

  it('does not invent a numeric score, probability, band, truth, or lifecycle transition', async () => {
    hypotheses.find.mockResolvedValue(hypothesis()); evidence.listEligibleForUser.mockResolvedValue([]);
    const result = await service.evaluateHypothesis('user-a', 'token-a', hypothesis().id);
    expect(result.numeric_score).toBeNull(); expect(result.confidence_band).toBeNull();
    expect(result).not.toHaveProperty('truth'); expect(result).not.toHaveProperty('probability');
    expect(result.target_version).toBe(3); expect(result.lifecycle_state).toBe('EVALUATED');
    expect(hypotheses).not.toHaveProperty('transition');
  });

  it('records bounded structured uncertainty for zero evidence, assumptions, and alternatives', async () => {
    hypotheses.find.mockResolvedValue(hypothesis({ assumptions: ['Deadline remains fixed.'], competing_hypothesis_ids: ['44444444-4444-4444-8444-444444444444'] }));
    evidence.listEligibleForUser.mockResolvedValue([]);
    const result = await service.evaluateHypothesis('user-a', 'token-a', hypothesis().id);
    expect(result.missing_information_codes).toEqual([
      'COMPETING_HYPOTHESES_UNASSESSED', 'UNVERIFIED_ASSUMPTIONS', 'NO_ELIGIBLE_EVIDENCE', 'CONFIDENCE_MODEL_UNCALIBRATED',
    ]);
    expect(result.assumptions).toEqual(['Deadline remains fixed.']);
    expect(result.alternative_hypothesis_ids).toHaveLength(1);
  });

  it('fails closed when the hypothesis is not owned and does not persist', async () => {
    hypotheses.find.mockRejectedValue(new NotFoundException());
    evidence.listEligibleForUser.mockResolvedValue([]);
    await expect(service.evaluateHypothesis('user-a', 'token-a', 'other')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('preserves immutable evaluation history behind the owned hypothesis check', async () => {
    hypotheses.find.mockResolvedValue(hypothesis()); repository.listForTarget.mockResolvedValue([]);
    await service.listHistory('user-a', 'token-a', hypothesis().id);
    expect(repository.listForTarget).toHaveBeenCalledWith('token-a', 'user-a', hypothesis().id);
  });

  it('has no provider, embedding, question, HIM, recommendation, or context dependencies', () => {
    expect(Object.keys(service).sort()).toEqual(['evidence', 'hypotheses', 'repository']);
  });
});
