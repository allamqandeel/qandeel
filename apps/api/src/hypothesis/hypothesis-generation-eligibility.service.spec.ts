import { EvidenceService, MAX_ELIGIBLE_EVIDENCE } from '../memory/evidence.service';
import { HypothesisGenerationEligibilityService } from './hypothesis-generation-eligibility.service';
import { HypothesisGenerationTriggerClassificationService } from './hypothesis-generation-trigger-classification.service';

describe('HypothesisGenerationEligibilityService', () => {
  let evidence: jest.Mocked<EvidenceService>;
  let classifier: jest.Mocked<HypothesisGenerationTriggerClassificationService>;
  let service: HypothesisGenerationEligibilityService;

  const eligibleEvidence = { evidenceId: 'memory:10000000-0000-4000-8000-000000000001' };

  beforeEach(() => {
    evidence = { listEligibleForUser: jest.fn().mockResolvedValue([eligibleEvidence]) } as never;
    classifier = { classify: jest.fn().mockReturnValue({ classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }) } as never;
    service = new HypothesisGenerationEligibilityService(evidence, classifier);
  });

  it('is eligible only for ALLOW + TRIGGER + canonical eligible Evidence', async () => {
    await expect(service.evaluate('user', 'token', 'Why do I repeat this?', 'ALLOW')).resolves.toEqual({
      status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE',
    });
    expect(evidence.listEligibleForUser).toHaveBeenCalledWith('user', 'token');
    expect(classifier.classify).toHaveBeenCalledWith({ text: 'Why do I repeat this?', safetyDisposition: 'ALLOW' });
    expect(evidence.listEligibleForUser.mock.invocationCallOrder[0]).toBeLessThan(classifier.classify.mock.invocationCallOrder[0]);
  });

  it('rejects a trigger when no eligible Evidence exists', async () => {
    evidence.listEligibleForUser.mockResolvedValue([]);
    await expect(service.evaluate('user', 'token', 'Why do I repeat this?', 'ALLOW')).resolves.toEqual({
      status: 'NOT_ELIGIBLE', reason: 'NO_ELIGIBLE_EVIDENCE',
    });
  });

  it.each([
    [{ classification: 'NO_TRIGGER', reason: 'ORDINARY_FACT' }, 'NO_TRIGGER'],
    [{ classification: 'AMBIGUOUS', reason: 'TRIGGER_LIKE_BUT_UNRESOLVED' }, 'AMBIGUOUS_TRIGGER'],
  ] as const)('maps %s to bounded non-eligibility', async (classification, reason) => {
    classifier.classify.mockReturnValue(classification);
    await expect(service.evaluate('user', 'token', 'text', 'ALLOW')).resolves.toEqual({ status: 'NOT_ELIGIBLE', reason });
  });

  it.each(['GUIDED', 'BLOCK'] as const)('makes %s safety-ineligible without Evidence or classification', async (disposition) => {
    await expect(service.evaluate('user', 'token', 'sensitive text', disposition)).resolves.toEqual({
      status: 'NOT_ELIGIBLE', reason: 'SAFETY_INELIGIBLE',
    });
    expect(evidence.listEligibleForUser).not.toHaveBeenCalled();
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('fails closed when classification throws', async () => {
    classifier.classify.mockImplementation(() => { throw new Error('classification failed'); });
    await expect(service.evaluate('user', 'token', 'text', 'ALLOW')).resolves.toEqual({ status: 'NOT_ELIGIBLE', reason: 'EVALUATION_FAILED' });
  });

  it('fails closed when the Evidence read fails or violates its bounded projection invariant', async () => {
    evidence.listEligibleForUser.mockRejectedValueOnce(new Error('read failed'));
    await expect(service.evaluate('user', 'token', 'text', 'ALLOW')).resolves.toEqual({ status: 'NOT_ELIGIBLE', reason: 'EVALUATION_FAILED' });

    evidence.listEligibleForUser.mockResolvedValueOnce(Array.from({ length: MAX_ELIGIBLE_EVIDENCE + 1 }, (_, index) => ({ evidenceId: `memory:${index}` })) as never);
    await expect(service.evaluate('user', 'token', 'text', 'ALLOW')).resolves.toEqual({ status: 'NOT_ELIGIBLE', reason: 'EVALUATION_FAILED' });
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('does not copy Evidence content or identifiers into the result', async () => {
    const result = await service.evaluate('user', 'token', 'Why do I repeat this?', 'ALLOW');
    expect(JSON.stringify(result)).not.toContain('memory:');
    expect(Object.keys(result)).toEqual(['status', 'reason']);
  });
});
