import { recoverHypothesisUpdateBatchResult } from './durable-hypothesis-update-batch-result';
import type { DurableHypothesisUpdateReceipt } from './durable-hypothesis-update-batch-result';
import type { HypothesisUpdateRequest } from '../hypothesis/hypothesis-update.types';

const ids = {
  firstHypothesis: '10000000-0000-4000-8000-000000000001',
  secondHypothesis: '10000000-0000-4000-8000-000000000002',
  evidence: 'memory:10000000-0000-4000-8000-000000000006',
  updateA: '10000000-0000-4000-8000-00000000001a',
  confidenceA: '10000000-0000-4000-8000-00000000001b',
  updateB: '10000000-0000-4000-8000-00000000002a',
  confidenceB: '10000000-0000-4000-8000-00000000002b',
};

const commands: HypothesisUpdateRequest[] = [
  { hypothesisId: ids.firstHypothesis, expectedVersion: 4, evidenceId: ids.evidence, evidenceRole: 'SUPPORTING' },
  { hypothesisId: ids.secondHypothesis, expectedVersion: 2, evidenceId: ids.evidence, evidenceRole: 'CONTRADICTING' },
];

const receipt = (ordinal: 1 | 2, overrides: Partial<DurableHypothesisUpdateReceipt> = {}): DurableHypothesisUpdateReceipt => ({
  commandOrdinal: ordinal,
  updateId: ordinal === 1 ? ids.updateA : ids.updateB,
  confidenceEvaluationId: ordinal === 1 ? ids.confidenceA : ids.confidenceB,
  hypothesisId: commands[ordinal - 1].hypothesisId,
  expectedVersion: commands[ordinal - 1].expectedVersion,
  evidenceId: ids.evidence,
  evidenceRole: commands[ordinal - 1].evidenceRole,
  beforeVersion: commands[ordinal - 1].expectedVersion,
  afterVersion: commands[ordinal - 1].expectedVersion + 1,
  confidenceStatus: 'EVALUATED',
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  result_code: 'UPDATES_APPLIED' as string | null,
  result_reference: null as string | null,
  result_payload: [receipt(1), receipt(2)] as unknown,
  ...overrides,
});

describe('durable hypothesis update batch recovery', () => {
  it('recovers the exact ordered receipts against the durable Association commands', () => {
    const recovered = recoverHypothesisUpdateBatchResult(row(), commands);
    if (recovered.status !== 'UPDATES_APPLIED') throw new Error('expected an applied recovery');
    expect(recovered.receipts).toEqual([receipt(1), receipt(2)]);
    expect(recovered.receipts.map((item) => item.confidenceStatus)).toEqual(['EVALUATED', 'EVALUATED']);
  });
  it('recovers a durable PENDING_RETRY Confidence outcome without repairing it', () => {
    const recovered = recoverHypothesisUpdateBatchResult(row({ result_payload: [receipt(1), receipt(2, { confidenceStatus: 'PENDING_RETRY' })] }), commands);
    if (recovered.status !== 'UPDATES_APPLIED') throw new Error('expected an applied recovery');
    expect(recovered.receipts[1].confidenceStatus).toBe('PENDING_RETRY');
  });
  it('recovers a payload-free UPDATES_REJECTED', () => {
    expect(recoverHypothesisUpdateBatchResult(row({ result_code: 'UPDATES_REJECTED', result_payload: null }), commands))
      .toEqual({ status: 'UPDATES_REJECTED' });
  });
  it.each([
    ['an unknown result code', { result_code: 'PARTIALLY_APPLIED' }],
    ['a legacy null result', { result_code: null, result_payload: null }],
    ['UPDATES_REJECTED with a payload', { result_code: 'UPDATES_REJECTED' }],
    ['UPDATES_APPLIED without a payload', { result_payload: null }],
    ['a reference-bearing result', { result_reference: 'memory:x' }],
    ['a non-array payload', { result_payload: {} }],
    ['an empty receipt list', { result_payload: [] }],
    ['a truncated receipt list', { result_payload: [receipt(1)] }],
    ['a bad ordinal', { result_payload: [receipt(1, { commandOrdinal: 2 }), receipt(2)] }],
    ['an order mismatch', { result_payload: [receipt(2, { commandOrdinal: 1 }), receipt(1, { commandOrdinal: 2 })] }],
    ['a missing key', { result_payload: [(({ updateId, ...rest }) => rest)(receipt(1)), receipt(2)] }],
    ['an extra key', { result_payload: [{ ...receipt(1), extra: true }, receipt(2)] }],
    ['an invalid update id', { result_payload: [receipt(1, { updateId: 'not-a-uuid' }), receipt(2)] }],
    ['an invalid confidence id', { result_payload: [receipt(1, { confidenceEvaluationId: 'not-a-uuid' }), receipt(2)] }],
    ['duplicate update ids', { result_payload: [receipt(1), receipt(2, { updateId: ids.updateA })] }],
    ['duplicate confidence ids', { result_payload: [receipt(1), receipt(2, { confidenceEvaluationId: ids.confidenceA })] }],
    ['a UUID reused across the identity sets', { result_payload: [receipt(1), receipt(2, { confidenceEvaluationId: ids.updateA })] }],
    ['a command target mismatch', { result_payload: [receipt(1, { hypothesisId: ids.secondHypothesis }), receipt(2)] }],
    ['a wrong expected version', { result_payload: [receipt(1, { expectedVersion: 9, beforeVersion: 9, afterVersion: 10 }), receipt(2)] }],
    ['wrong Evidence', { result_payload: [receipt(1, { evidenceId: 'memory:10000000-0000-4000-8000-0000000000ff' }), receipt(2)] }],
    ['a wrong role', { result_payload: [receipt(1, { evidenceRole: 'CONTRADICTING' }), receipt(2)] }],
    ['a before/expected mismatch', { result_payload: [receipt(1, { beforeVersion: 5 }), receipt(2)] }],
    ['a wrong after version', { result_payload: [receipt(1, { afterVersion: 6 }), receipt(2)] }],
    ['an invalid confidence status', { result_payload: [receipt(1, { confidenceStatus: 'DONE' as never }), receipt(2)] }],
  ])('treats %s as INDETERMINATE without repair or inference', (_label, overrides) => {
    expect(recoverHypothesisUpdateBatchResult(row(overrides as Record<string, unknown>), commands)).toEqual({ status: 'INDETERMINATE' });
  });
});
