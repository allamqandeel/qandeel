import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HypothesisUpdateService } from './hypothesis-update.service';

const user = '10000000-0000-4000-8000-000000000001';
const hypothesisId = '20000000-0000-4000-8000-000000000002';
const evidenceId = 'memory:30000000-0000-4000-8000-000000000003';
const mutation = (updateId: string, role: 'SUPPORTING' | 'CONTRADICTING' = 'SUPPORTING', overrides: { update?: Record<string, unknown>; hypothesis?: Record<string, unknown> } = {}) => ({
  update: { id: updateId, user_id: user, hypothesis_id: hypothesisId, before_version: 3, after_version: 4, evidence_id: evidenceId, evidence_role: role, source: 'QANDEEL_HYPOTHESIS_UPDATE_LOOP', created_at: new Date().toISOString(), ...overrides.update },
  hypothesis: { id: hypothesisId, user_id: user, version: 4, status: 'ACTIVE', supporting_evidence_ids: role === 'SUPPORTING' ? [evidenceId] : [], contradicting_evidence_ids: role === 'CONTRADICTING' ? [evidenceId] : [], assumptions: ['unchanged'], scope: 'unchanged', competing_hypothesis_ids: [], ...overrides.hypothesis },
});

describe('HypothesisUpdateService', () => {
  const request = { hypothesisId, expectedVersion: 3, evidenceId, evidenceRole: 'SUPPORTING' as const };
  const setup = () => {
    const repository = { apply: jest.fn().mockImplementation(async (_token: string, updateId: string) => mutation(updateId)) };
    const confidence = { evaluateHypothesisVersion: jest.fn().mockResolvedValue({ id: 'confidence', target_version: 4 }), evaluateHypothesis: jest.fn() };
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
    // Finding 09: the Confidence target is EXACTLY mutation.update.after_version
    // from this invocation - never a later ID-only latest-version re-read.
    expect(confidence.evaluateHypothesisVersion).toHaveBeenCalledWith(user, 'token', hypothesisId, 4);
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    expect(result.confidenceStatus).toBe('EVALUATED');
  });

  it('preserves a contradicting role without inference', async () => {
    const { service, repository } = setup();
    repository.apply.mockImplementation(async (_token: string, updateId: string) => mutation(updateId, 'CONTRADICTING'));
    const result = await service.apply(user, 'token', { ...request, evidenceRole: 'CONTRADICTING' });
    expect(result.update.evidence_role).toBe('CONTRADICTING');
  });

  it('does not evaluate confidence when the mutation fails closed', async () => {
    const { service, repository, confidence } = setup(); repository.apply.mockResolvedValue(undefined);
    await expect(service.apply(user, 'token', request)).rejects.toBeInstanceOf(NotFoundException);
    expect(confidence.evaluateHypothesisVersion).not.toHaveBeenCalled();
  });

  it('reports the post-commit confidence partial failure without a false evaluation', async () => {
    const { service, confidence } = setup(); confidence.evaluateHypothesisVersion.mockRejectedValue(new Error('unavailable'));
    const result = await service.apply(user, 'token', request);
    expect(result.confidenceStatus).toBe('PENDING_RETRY');
    expect(result.confidenceEvaluation).toBeNull();
  });

  it('reproduces the QAN-AUD-07 race: a later version is never evaluated on this mutation\'s behalf', async () => {
    // Update A commits V(3) -> V+1(4); update B advances the canonical
    // Hypothesis to V+2(5) before A's Confidence commits, so the exact V+1
    // evaluation is rejected as stale by the database guard.
    const { service, repository, confidence } = setup();
    confidence.evaluateHypothesisVersion.mockRejectedValue(new Error('Stale hypothesis version.'));
    const result = await service.apply(user, 'token', request);
    // The exact after_version was the one and only requested target.
    expect(confidence.evaluateHypothesisVersion).toHaveBeenCalledTimes(1);
    expect(confidence.evaluateHypothesisVersion).toHaveBeenCalledWith(user, 'token', hypothesisId, 4);
    // No latest-version fallback and no V+2 evaluation on behalf of update A.
    expect(confidence.evaluateHypothesis).not.toHaveBeenCalled();
    // The committed mutation stands, is reported, and is never replayed.
    expect(result.confidenceStatus).toBe('PENDING_RETRY');
    expect(result.confidenceEvaluation).toBeNull();
    expect(result.update.after_version).toBe(4);
    expect(repository.apply).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a foreign update owner', { update: { user_id: '40000000-0000-4000-8000-000000000009' } }],
    ['a different hypothesis', { update: { hypothesis_id: '40000000-0000-4000-8000-000000000008' }, hypothesis: { id: '40000000-0000-4000-8000-000000000008' } }],
    ['a different evidence identity', { update: { evidence_id: 'memory:40000000-0000-4000-8000-000000000007' } }],
    ['a flipped evidence role', { update: { evidence_role: 'CONTRADICTING' } }],
    ['a wrong before version', { update: { before_version: 2 } }],
    ['a wrong after version', { update: { after_version: 5 } }],
    ['a hypothesis/audit version mismatch', { hypothesis: { version: 5 } }],
    ['a foreign audit source', { update: { source: 'FORGED_SOURCE' } }],
    ['a foreign audit update id', { update: { id: '40000000-0000-4000-8000-000000000006' } }],
  ] as const)('fails closed before Confidence on a returned mutation carrying %s', async (_label, overrides) => {
    const { service, repository, confidence } = setup();
    repository.apply.mockImplementation(async (_token: string, updateId: string) => mutation(updateId, 'SUPPORTING', overrides as never));
    await expect(service.apply(user, 'token', request)).rejects.toThrow(/HYPOTHESIS_UPDATE_INTEGRITY|Hypothesis update target not found\./);
    expect(confidence.evaluateHypothesisVersion).not.toHaveBeenCalled();
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
