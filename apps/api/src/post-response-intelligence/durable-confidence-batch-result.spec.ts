import { CONFIDENCE_BATCH_EFFECT_RESULT_CODES, recoverConfidenceBatchResult } from './durable-confidence-batch-result';
import type { DurableConfidenceBatchReceipt } from './durable-confidence-batch-result';

const ids = {
  firstHypothesis: '10000000-0000-4000-8000-000000000001',
  secondHypothesis: '10000000-0000-4000-8000-000000000002',
  foreignHypothesis: '10000000-0000-4000-8000-000000000003',
  evaluationA: '10000000-0000-4000-8000-00000000001a',
  evaluationB: '10000000-0000-4000-8000-00000000001b',
};

const persisted = [ids.firstHypothesis, ids.secondHypothesis];

const receipt = (ordinal: 1 | 2, overrides: Partial<DurableConfidenceBatchReceipt> = {}): DurableConfidenceBatchReceipt => ({
  ordinal,
  hypothesisId: ordinal === 1 ? ids.firstHypothesis : ids.secondHypothesis,
  targetVersion: ordinal === 1 ? 3 : 1,
  confidenceEvaluationId: ordinal === 1 ? ids.evaluationA : ids.evaluationB,
  ...overrides,
});

const effect = (overrides: Record<string, unknown> = {}) => ({
  result_code: 'CONFIDENCE_BATCH_EVALUATED',
  result_reference: null,
  result_payload: [receipt(1), receipt(2)],
  ...overrides,
});

describe('recoverConfidenceBatchResult', () => {
  it('exposes exactly the two typed batch result codes and no partial/failed code', () => {
    expect(CONFIDENCE_BATCH_EFFECT_RESULT_CODES).toEqual(['NO_CONFIDENCE_TARGETS', 'CONFIDENCE_BATCH_EVALUATED']);
  });

  it('recovers the exact ordered receipts of a fully evaluated batch', () => {
    expect(recoverConfidenceBatchResult(effect(), persisted)).toEqual({
      status: 'CONFIDENCE_BATCH_EVALUATED',
      receipts: [receipt(1), receipt(2)],
    });
  });

  it('recovers a payload-free no-target batch only against zero persisted targets', () => {
    const noTargets = { result_code: 'NO_CONFIDENCE_TARGETS', result_reference: null, result_payload: null };
    expect(recoverConfidenceBatchResult(noTargets, [])).toEqual({ status: 'NO_CONFIDENCE_TARGETS' });
    expect(recoverConfidenceBatchResult(noTargets, persisted)).toEqual({ status: 'INDETERMINATE' });
    expect(recoverConfidenceBatchResult({ ...noTargets, result_payload: [] }, [])).toEqual({ status: 'INDETERMINATE' });
  });

  it('treats an evaluated code with zero persisted targets as indeterminate', () => {
    expect(recoverConfidenceBatchResult(effect({ result_payload: [] }), [])).toEqual({ status: 'INDETERMINATE' });
  });

  it.each([
    ['a legacy pre-0035 all-null generic completion', { result_code: null, result_payload: null }],
    ['an unknown result code', { result_code: 'CONFIDENCE_BATCH_PARTIAL' }],
    ['a reference-bearing result', { result_reference: 'memory:10000000-0000-4000-8000-000000000006' }],
    ['a non-array payload', { result_payload: {} }],
    ['a short receipt list', { result_payload: [receipt(1)] }],
    ['a long receipt list', { result_payload: [receipt(1), receipt(2), receipt(2)] }],
    ['a reordered receipt list', { result_payload: [receipt(2), receipt(1)] }],
    ['a target outside the durable persistence list', { result_payload: [receipt(1, { hypothesisId: ids.foreignHypothesis }), receipt(2)] }],
    ['a non-sequential ordinal', { result_payload: [receipt(1, { ordinal: 2 as 1 }), receipt(2)] }],
    ['a duplicated evaluation identity', { result_payload: [receipt(1), receipt(2, { confidenceEvaluationId: ids.evaluationA })] }],
    ['an evaluation identity reused from the target set', { result_payload: [receipt(1, { confidenceEvaluationId: ids.firstHypothesis }), receipt(2)] }],
    ['a non-canonical evaluation identity', { result_payload: [receipt(1, { confidenceEvaluationId: 'not-a-uuid' }), receipt(2)] }],
    ['a zero target version', { result_payload: [receipt(1, { targetVersion: 0 }), receipt(2)] }],
    ['a fractional target version', { result_payload: [receipt(1, { targetVersion: 1.5 }), receipt(2)] }],
    ['a stringified target version', { result_payload: [receipt(1, { targetVersion: '3' as unknown as number }), receipt(2)] }],
    ['a missing receipt key', { result_payload: [(({ targetVersion, ...rest }) => rest)(receipt(1)), receipt(2)] }],
    ['an extra receipt key', { result_payload: [{ ...receipt(1), extra: true }, receipt(2)] }],
    ['a null receipt', { result_payload: [null, receipt(2)] }],
  ])('classifies %s as indeterminate', (_label, overrides) => {
    expect(recoverConfidenceBatchResult(effect(overrides as Record<string, unknown>), persisted)).toEqual({ status: 'INDETERMINATE' });
  });

  it('rejects more targets than a generation batch can ever produce', () => {
    const six = Array.from({ length: 6 }, (_value, index) => `10000000-0000-4000-8000-00000000010${index}`);
    expect(recoverConfidenceBatchResult(effect({ result_payload: [] }), six)).toEqual({ status: 'INDETERMINATE' });
  });

  it('never reads current Hypothesis state: recovery is a pure function of the effect row and the durable ID list', () => {
    const row = effect();
    const before = JSON.stringify(row);
    recoverConfidenceBatchResult(row, persisted);
    expect(JSON.stringify(row)).toBe(before);
  });
});
