import type { HypothesisEvidenceAssociationAuthorization } from '../hypothesis/hypothesis-evidence-association.types';
import {
  MAX_DURABLE_ASSOCIATION_COMMANDS,
  recoverAssociationResult,
  toDurableAssociationResult,
} from './durable-association-result';

const EVIDENCE = 'memory:20000000-0000-4000-8000-000000000001';
const OTHER_EVIDENCE = 'memory:20000000-0000-4000-8000-0000000000ff';
const HYP_A = '30000000-0000-4000-8000-000000000001';
const HYP_B = '30000000-0000-4000-8000-000000000002';

const command = (over: Partial<Record<string, unknown>> = {}) => ({
  hypothesisId: HYP_A, expectedVersion: 3, evidenceId: EVIDENCE, evidenceRole: 'SUPPORTING', ...over,
});
const completed = (over: Partial<Record<string, unknown>> = {}) => ({
  result_code: 'AUTHORIZED_COMMANDS', result_reference: null, result_payload: [command()], ...over,
});

describe('toDurableAssociationResult', () => {
  it('maps NO_ASSOCIATION to a command-free durable result', () => {
    expect(toDurableAssociationResult({ status: 'NO_ASSOCIATION' })).toEqual({ code: 'NO_ASSOCIATION' });
  });

  it('maps a single authorized command preserving every field exactly', () => {
    const commands = [{ hypothesisId: HYP_A, expectedVersion: 9, evidenceId: EVIDENCE, evidenceRole: 'CONTRADICTING' as const }];
    expect(toDurableAssociationResult({ status: 'AUTHORIZED', commands })).toEqual({ code: 'AUTHORIZED_COMMANDS', commands });
  });

  it('maps a multi-command batch up to the contract bound', () => {
    const commands = Array.from({ length: MAX_DURABLE_ASSOCIATION_COMMANDS }, (_unused, index) => ({
      hypothesisId: `30000000-0000-4000-8000-00000000000${index + 1}`, expectedVersion: index + 1,
      evidenceId: EVIDENCE, evidenceRole: 'SUPPORTING' as const,
    }));
    expect(toDurableAssociationResult({ status: 'AUTHORIZED', commands })).toEqual({ code: 'AUTHORIZED_COMMANDS', commands });
  });

  it('never persists a non-success authorization as a durable success', () => {
    const rejections: HypothesisEvidenceAssociationAuthorization[] = [
      { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' },
      { status: 'NOT_AUTHORIZED', reason: 'STALE_HYPOTHESIS_VERSION' },
      { status: 'NOT_AUTHORIZED', reason: 'BOUND_EXCEEDED' },
    ];
    for (const rejection of rejections) expect(toDurableAssociationResult(rejection)).toBeNull();
  });

  it('rejects an empty AUTHORIZED batch, an over-bound batch, and mixed evidence identities', () => {
    expect(toDurableAssociationResult({ status: 'AUTHORIZED', commands: [] })).toBeNull();
    const oversized = Array.from({ length: MAX_DURABLE_ASSOCIATION_COMMANDS + 1 }, (_unused, index) => ({
      hypothesisId: `30000000-0000-4000-8000-00000000000${index + 1}`, expectedVersion: 1, evidenceId: EVIDENCE, evidenceRole: 'SUPPORTING' as const,
    }));
    expect(toDurableAssociationResult({ status: 'AUTHORIZED', commands: oversized })).toBeNull();
    expect(toDurableAssociationResult({ status: 'AUTHORIZED', commands: [
      { hypothesisId: HYP_A, expectedVersion: 1, evidenceId: EVIDENCE, evidenceRole: 'SUPPORTING' },
      { hypothesisId: HYP_B, expectedVersion: 1, evidenceId: OTHER_EVIDENCE, evidenceRole: 'SUPPORTING' },
    ] })).toBeNull();
  });
});

describe('recoverAssociationResult', () => {
  it('recovers a valid NO_ASSOCIATION deterministically', () => {
    expect(recoverAssociationResult({ result_code: 'NO_ASSOCIATION', result_reference: null, result_payload: null }, EVIDENCE))
      .toEqual({ status: 'NO_ASSOCIATION' });
  });

  it('recovers the exact durable command batch preserving every field', () => {
    const commands = [
      command({ hypothesisId: HYP_A, expectedVersion: 12, evidenceRole: 'SUPPORTING' }),
      command({ hypothesisId: HYP_B, expectedVersion: 4, evidenceRole: 'CONTRADICTING' }),
    ];
    expect(recoverAssociationResult(completed({ result_payload: commands }), EVIDENCE)).toEqual({
      status: 'AUTHORIZED_COMMANDS',
      commands: [
        { hypothesisId: HYP_A, expectedVersion: 12, evidenceId: EVIDENCE, evidenceRole: 'SUPPORTING' },
        { hypothesisId: HYP_B, expectedVersion: 4, evidenceId: EVIDENCE, evidenceRole: 'CONTRADICTING' },
      ],
    });
  });

  it.each([
    ['null legacy result', { result_code: null, result_reference: null, result_payload: null }],
    ['unknown result code', { result_code: 'PARTIAL', result_reference: null, result_payload: null }],
    ['NO_ASSOCIATION with commands', { result_code: 'NO_ASSOCIATION', result_reference: null, result_payload: [command()] }],
    ['NO_ASSOCIATION with reference', { result_code: 'NO_ASSOCIATION', result_reference: EVIDENCE, result_payload: null }],
    ['AUTHORIZED with a stray reference', completed({ result_reference: EVIDENCE })],
    ['AUTHORIZED with an empty batch', completed({ result_payload: [] })],
    ['AUTHORIZED with a null batch', completed({ result_payload: null })],
    ['AUTHORIZED over the bound', completed({ result_payload: Array.from({ length: MAX_DURABLE_ASSOCIATION_COMMANDS + 1 }, (_u, index) => command({ hypothesisId: `30000000-0000-4000-8000-00000000000${index + 1}` })) })],
    ['duplicate hypothesis target', completed({ result_payload: [command({ hypothesisId: HYP_A }), command({ hypothesisId: HYP_A, evidenceRole: 'CONTRADICTING' })] })],
    ['wrong evidence identity', completed({ result_payload: [command({ evidenceId: OTHER_EVIDENCE })] })],
    ['extra command field', completed({ result_payload: [{ ...command(), extra: true }] })],
    ['missing command field', completed({ result_payload: [{ hypothesisId: HYP_A, expectedVersion: 1, evidenceId: EVIDENCE }] })],
    ['non-integer expected version', completed({ result_payload: [command({ expectedVersion: 1.5 })] })],
    ['zero expected version', completed({ result_payload: [command({ expectedVersion: 0 })] })],
    ['bad hypothesis uuid', completed({ result_payload: [command({ hypothesisId: 'nope' })] })],
    ['bad evidence reference', completed({ result_payload: [command({ evidenceId: 'memory:nope' })] })],
    ['invalid evidence role', completed({ result_payload: [command({ evidenceRole: 'NEUTRAL' })] })],
    ['non-array batch', completed({ result_payload: { hypothesisId: HYP_A } as unknown as unknown[] })],
  ])('is INDETERMINATE and never infers commands for %s', (_label, effect) => {
    expect(recoverAssociationResult(effect as never, EVIDENCE)).toEqual({ status: 'INDETERMINATE' });
  });

  it('is INDETERMINATE when the fresh evidence identity itself is malformed', () => {
    expect(recoverAssociationResult(completed(), 'memory:not-a-uuid')).toEqual({ status: 'INDETERMINATE' });
  });
});
