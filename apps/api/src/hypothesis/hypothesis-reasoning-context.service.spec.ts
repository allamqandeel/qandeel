import { EvidenceService } from '../memory/evidence.service';
import { ConfidenceRepository } from './confidence.repository';
import { CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord } from './confidence.types';
import { HypothesisReasoningContextService } from './hypothesis-reasoning-context.service';
import { HypothesisReasoningInvariantError, MAX_HYPOTHESIS_CONTEXT_STRING_CHARS, MAX_MODEL_HYPOTHESES } from './hypothesis-reasoning-context.types';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';

const hypothesis = (id: string, statement = `statement ${id}`, version = 2): HypothesisRecord => ({
  id, user_id: 'user', statement, type: 'CAUSAL', domain: 'GENERAL', scope: 'current conversation',
  origin: 'USER_PROPOSED', status: 'ACTIVE', version, supporting_evidence_ids: [`memory:s-${id}`],
  contradicting_evidence_ids: [`memory:c-${id}`, `memory:expired-${id}`], competing_hypothesis_ids: [],
  assumptions: ['assumption'], disconfirming_conditions: ['condition'], created_at: '2026-01-01', updated_at: '2026-01-02',
});
const evaluation = (target: HypothesisRecord, id = 'evaluation'): ConfidenceEvaluationRecord => ({
  id, user_id: 'user', target_id: target.id, target_type: 'HYPOTHESIS', target_version: target.version,
  version: 1, lifecycle_state: 'EVALUATED', numeric_score: null, confidence_band: null,
  calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED', supporting_evidence_ids: [],
  contradicting_evidence_ids: [], assumptions: [], alternative_hypothesis_ids: [],
  missing_information_codes: ['CONFIDENCE_MODEL_UNCALIBRATED'], policy_version: CONFIDENCE_POLICY_VERSION,
  provenance: 'QANDEEL_CONFIDENCE_RUNTIME', created_at: '2026-01-03', updated_at: '2026-01-03',
});

describe('HypothesisReasoningContextService', () => {
  let hypotheses: jest.Mocked<HypothesisService>, evidence: jest.Mocked<EvidenceService>, confidence: jest.Mocked<ConfidenceRepository>, service: HypothesisReasoningContextService;
  beforeEach(() => {
    hypotheses = { listActiveForUser: jest.fn() } as unknown as jest.Mocked<HypothesisService>;
    evidence = { listEligibleForUser: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<EvidenceService>;
    confidence = { listExactVersionsForTargets: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<ConfidenceRepository>;
    service = new HypothesisReasoningContextService(hypotheses, evidence, confidence);
  });
  it('distinguishes EMPTY and performs no Evidence or Confidence reads', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([]);
    await expect(service.build('user', 'token')).resolves.toEqual({ coverageState: 'EMPTY', candidateHypothesisCount: 0 });
    expect(evidence.listEligibleForUser).not.toHaveBeenCalled(); expect(confidence.listExactVersionsForTargets).not.toHaveBeenCalled();
  });
  it('preserves repository order, counts only current eligibility, and exposes no IDs or Evidence content', async () => {
    const values = [hypothesis('newer'), hypothesis('older')]; hypotheses.listActiveForUser.mockResolvedValue(values);
    evidence.listEligibleForUser.mockResolvedValue([{ evidenceId: 'memory:s-newer' } as never, { evidenceId: 'memory:c-newer' } as never]);
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(values[0])]);
    const result = await service.build('user', 'token'); expect(result.coverageState).toBe('AVAILABLE');
    if (result.coverageState !== 'AVAILABLE') return;
    expect(result.context.hypotheses.map((item) => item.statement)).toEqual(['statement newer', 'statement older']);
    expect(result.context.hypotheses[0]).toMatchObject({ currentlyEligibleSupportingEvidenceCount: 1, currentlyEligibleContradictingEvidenceCount: 1, confidence: { state: 'EXACT_CURRENT_VERSION_EVALUATED', targetVersion: 2 } });
    expect(result.context.hypotheses[1].confidence).toEqual({ state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: 2 });
    const serialized = JSON.stringify(result.context); expect(serialized).not.toMatch(/memory:|evaluation|user_id|target_id|evidenceId|Evidence content/);
    expect(evidence.listEligibleForUser).toHaveBeenCalledTimes(1); expect(confidence.listExactVersionsForTargets).toHaveBeenCalledTimes(1);
  });
  it('takes at most eight complete items and marks the deterministic prefix truncated', async () => {
    hypotheses.listActiveForUser.mockResolvedValue(Array.from({ length: 10 }, (_, index) => hypothesis(String(index))));
    const result = await service.build('user', 'token'); if (result.coverageState !== 'AVAILABLE') throw new Error();
    expect(result.context.hypotheses).toHaveLength(MAX_MODEL_HYPOTHESES); expect(result.context.truncated).toBe(true);
    expect(result.context.hypotheses.map((item) => item.statement)).toEqual(Array.from({ length: 8 }, (_, index) => `statement ${index}`));
  });
  it('selects the first exact-version evaluation in canonical history order and never calls evaluation or writes', async () => {
    const target = hypothesis('h'); hypotheses.listActiveForUser.mockResolvedValue([target]);
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(target, 'latest-id'), { ...evaluation(target, 'older-id'), policy_version: CONFIDENCE_POLICY_VERSION }]);
    const result = await service.build('user', 'token'); if (result.coverageState !== 'AVAILABLE') throw new Error();
    expect(result.context.hypotheses[0].confidence).toMatchObject({ state: 'EXACT_CURRENT_VERSION_EVALUATED', targetVersion: target.version });
    expect(confidence.listExactVersionsForTargets).toHaveBeenCalledWith('token', 'user', [{ id: 'h', version: 2 }]);
    expect((hypotheses as unknown as { evaluateHypothesis?: jest.Mock }).evaluateHypothesis).toBeUndefined();
    expect((confidence as unknown as { create?: jest.Mock }).create).toBeUndefined();
  });
  it('stops before the first over-budget item and never selects a later smaller item or truncates strings', async () => {
    const large = (id: string) => ({ ...hypothesis(id, id.repeat(2000).slice(0, 2000)), assumptions: Array.from({ length: 8 }, (_, i) => `${i}${'a'.repeat(498)}`), disconfirming_conditions: Array.from({ length: 8 }, (_, i) => `${i}${'d'.repeat(498)}`) });
    const first = large('a'), second = large('b'), tooLarge = large('c'), later = hypothesis('later', 'small');
    hypotheses.listActiveForUser.mockResolvedValue([first, second, tooLarge, later]);
    const result = await service.build('user', 'token'); if (result.coverageState !== 'AVAILABLE') throw new Error();
    expect(result.context.hypotheses).toHaveLength(2); expect(result.context.hypotheses[0].statement).toBe(first.statement);
    expect(result.context.hypotheses.map((item) => item.statement)).not.toContain('small'); expect(result.context.truncated).toBe(true);
    expect(result.context.hypotheses.reduce((sum, item) => sum + item.statement.length + item.scope.length + item.assumptions.join('').length + item.disconfirmingConditions.join('').length, 0)).toBeLessThanOrEqual(MAX_HYPOTHESIS_CONTEXT_STRING_CHARS);
  });
  it.each([
    ['ownership', { user_id: 'other' }], ['target', { target_id: 'other' }], ['type', { target_type: 'OTHER' }],
    ['version', { target_version: 1 }], ['provenance', { provenance: 'OTHER' }], ['policy', { policy_version: 'other' }],
    ['calibration', { calibration_state: 'CALIBRATED' }], ['score', { numeric_score: 0.5 }], ['band', { confidence_band: 'HIGH' }],
  ])('rejects malformed Confidence %s invariants', async (_name, change) => {
    const target = hypothesis('h'); hypotheses.listActiveForUser.mockResolvedValue([target]);
    confidence.listExactVersionsForTargets.mockResolvedValue([{ ...evaluation(target), ...change } as never]);
    await expect(service.build('user', 'token')).rejects.toBeInstanceOf(HypothesisReasoningInvariantError);
  });
  it.each([
    [hypothesis('duplicate'), (h: HypothesisRecord) => { h.supporting_evidence_ids = ['memory:x', 'memory:x']; }],
    [hypothesis('cross'), (h: HypothesisRecord) => { h.supporting_evidence_ids = ['memory:x']; h.contradicting_evidence_ids = ['memory:x']; }],
  ])('rejects duplicate or cross-role canonical Evidence links', async (target, corrupt) => {
    corrupt(target); hypotheses.listActiveForUser.mockResolvedValue([target]);
    await expect(service.build('user', 'token')).rejects.toBeInstanceOf(HypothesisReasoningInvariantError);
  });
});
