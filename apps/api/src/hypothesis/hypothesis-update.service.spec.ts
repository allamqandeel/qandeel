import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HypothesisUpdateService } from './hypothesis-update.service';

const user = '10000000-0000-4000-8000-000000000001';
const hypothesisId = '20000000-0000-4000-8000-000000000002';
const evidenceId = 'memory:30000000-0000-4000-8000-000000000003';
const mutation = (role: 'SUPPORTING' | 'CONTRADICTING' = 'SUPPORTING') => ({
  update: { id: '40000000-0000-4000-8000-000000000004', user_id: user, hypothesis_id: hypothesisId, before_version: 3, after_version: 4, evidence_id: evidenceId, evidence_role: role, source: 'QANDEEL_HYPOTHESIS_UPDATE_LOOP', created_at: new Date().toISOString() },
  hypothesis: { id: hypothesisId, user_id: user, version: 4, status: 'ACTIVE', supporting_evidence_ids: role === 'SUPPORTING' ? [evidenceId] : [], contradicting_evidence_ids: role === 'CONTRADICTING' ? [evidenceId] : [], assumptions: ['unchanged'], scope: 'unchanged', competing_hypothesis_ids: [] },
});

describe('HypothesisUpdateService', () => {
  const request = { hypothesisId, expectedVersion: 3, evidenceId, evidenceRole: 'SUPPORTING' as const };
  const setup = () => {
    const repository = { apply: jest.fn().mockResolvedValue(mutation()) };
    const confidence = { evaluateHypothesis: jest.fn().mockResolvedValue({ id: 'confidence', target_version: 4 }) };
    return { service: new HypothesisUpdateService(repository as never, confidence as never), repository, confidence };
  };

  it('preserves the explicit role and requests confidence only after a successful exact-version mutation', async () => {
    const { service, repository, confidence } = setup();
    const result = await service.apply(user, 'token', request);
    expect(repository.apply).toHaveBeenCalledWith('token', expect.any(String), request);
    expect(result.update.evidence_role).toBe('SUPPORTING');
    expect(result.hypothesis.version).toBe(4);
    expect(result.hypothesis.status).toBe('ACTIVE');
    expect(result.hypothesis.assumptions).toEqual(['unchanged']);
    expect(result.hypothesis.scope).toBe('unchanged');
    expect(result.hypothesis.competing_hypothesis_ids).toEqual([]);
    expect(confidence.evaluateHypothesis).toHaveBeenCalledWith(user, 'token', hypothesisId);
    expect(result.confidenceStatus).toBe('EVALUATED');
  });

  it('preserves a contradicting role without inference', async () => {
    const { service, repository } = setup(); repository.apply.mockResolvedValue(mutation('CONTRADICTING'));
    const result = await service.apply(user, 'token', { ...request, evidenceRole: 'CONTRADICTING' });
    expect(result.update.evidence_role).toBe('CONTRADICTING');
  });

  it('does not evaluate confidence when the mutation fails closed', async () => {
    const { service, repository, confidence } = setup(); repository.apply.mockResolvedValue(undefined);
    await expect(service.apply(user, 'token', request)).rejects.toBeInstanceOf(NotFoundException);
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
  });

  it('reports the post-commit confidence partial failure without a false evaluation', async () => {
    const { service, confidence } = setup(); confidence.evaluateHypothesis.mockRejectedValue(new Error('unavailable'));
    const result = await service.apply(user, 'token', request);
    expect(result.confidenceStatus).toBe('PENDING_RETRY');
    expect(result.confidenceEvaluation).toBeNull();
  });

  it.each([
    [{ ...request, expectedVersion: 0 }],
    [{ ...request, evidenceRole: 'INFERRED' }],
    [{ ...request, evidenceId: 'not-evidence' }],
  ])('rejects malformed or non-explicit requests before persistence', async (invalid) => {
    const { service, repository } = setup();
    await expect(service.apply(user, 'token', invalid as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.apply).not.toHaveBeenCalled();
  });
});
