import { recoverCandidateProviderResult, recoverHypothesisPersistenceResult } from './durable-generation-result';
import type { CandidateProviderRecovery, DurableGenerationCandidate } from './durable-generation-result';
import type { AuthorizedHypothesisGenerationIntent } from '../hypothesis/hypothesis-generation-intent-authority.types';

const ids = {
  session: '10000000-0000-4000-8000-000000000003',
  turn: '10000000-0000-4000-8000-000000000004',
  evidence: '10000000-0000-4000-8000-000000000006',
  otherEvidence: '10000000-0000-4000-8000-000000000007',
  first: '10000000-0000-4000-8000-00000000000a',
  second: '10000000-0000-4000-8000-00000000000b',
};

const intent = (): AuthorizedHypothesisGenerationIntent => ({
  problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: ids.turn },
  domain: 'GENERAL',
  scope: { kind: 'CONVERSATION_SESSION', sessionId: ids.session, serialized: `CONVERSATION_SESSION:${ids.session}` },
  evidenceIds: [`memory:${ids.evidence}`, `memory:${ids.otherEvidence}`],
});

const candidate = (overrides: Partial<DurableGenerationCandidate> = {}): DurableGenerationCandidate => ({
  hypothesisId: ids.first,
  statement: 'I procrastinate when goals feel vague.',
  type: 'CAUSAL',
  domain: 'GENERAL',
  scope: `CONVERSATION_SESSION:${ids.session}`,
  supportingEvidenceIds: [`memory:${ids.evidence}`],
  contradictingEvidenceIds: [`memory:${ids.otherEvidence}`],
  assumptions: ['Assumes vague goals recur'],
  disconfirmingConditions: ['A vague goal is finished on time'],
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  result_code: 'VALIDATED_CANDIDATES' as string | null,
  result_reference: null as string | null,
  result_payload: [candidate()] as unknown,
  ...overrides,
});

describe('durable generation result recovery', () => {
  it('recovers the exact validated plan with the exact pre-assigned IDs, never new ones', () => {
    const stored = [candidate(), candidate({ hypothesisId: ids.second, statement: 'A second distinct statement.' })];
    const recovered = recoverCandidateProviderResult(row({ result_payload: stored }), intent());
    if (recovered.status !== 'VALIDATED_CANDIDATES') throw new Error('expected a validated recovery');
    expect(recovered.candidates).toEqual(stored);
    expect(recovered.candidates.map((item) => item.hypothesisId)).toEqual([ids.first, ids.second]);
  });
  it('recovers a payload-free NO_ACCEPTED_CANDIDATES', () => {
    expect(recoverCandidateProviderResult(row({ result_code: 'NO_ACCEPTED_CANDIDATES', result_payload: null }), intent()))
      .toEqual({ status: 'NO_ACCEPTED_CANDIDATES' });
  });
  it.each([
    ['a legacy pre-0033 null result', { result_code: null, result_payload: null }],
    ['an impossible code/payload pairing', { result_code: 'NO_ACCEPTED_CANDIDATES' }],
    ['a foreign result code', { result_code: 'AUTHORIZED_COMMANDS' }],
    ['a reference-bearing result', { result_reference: `memory:${ids.evidence}` }],
    ['a non-array payload', { result_payload: {} }],
    ['an empty plan', { result_payload: [] }],
    ['an oversized plan', { result_payload: Array.from({ length: 6 }, (unused, index) => candidate({ hypothesisId: `10000000-0000-4000-8000-00000000010${index}`, statement: `Statement ${index}` })) }],
    ['a missing field', { result_payload: [(({ assumptions, ...rest }) => rest)(candidate())] }],
    ['an extra field', { result_payload: [{ ...candidate(), extra: true }] }],
    ['a malformed Hypothesis ID', { result_payload: [candidate({ hypothesisId: 'not-a-uuid' })] }],
    ['duplicate Hypothesis IDs', { result_payload: [candidate(), candidate({ statement: 'A second distinct statement.' })] }],
    ['a domain outside the durable Intent', { result_payload: [candidate({ domain: 'WORK' })] }],
    ['a scope outside the durable Intent', { result_payload: [candidate({ scope: 'CONVERSATION_SESSION:20000000-0000-4000-8000-000000000003' })] }],
    ['Evidence outside the durable Intent set', { result_payload: [candidate({ supportingEvidenceIds: ['memory:20000000-0000-4000-8000-00000000ffff'] })] }],
    ['duplicate Evidence within a role', { result_payload: [candidate({ supportingEvidenceIds: [`memory:${ids.evidence}`, `memory:${ids.evidence}`] })] }],
    ['cross-role Evidence conflict', { result_payload: [candidate({ contradictingEvidenceIds: [`memory:${ids.evidence}`] })] }],
    ['an invalid candidate type', { result_payload: [candidate({ type: 'GUESS' as never })] }],
    ['a blank statement', { result_payload: [candidate({ statement: '   ' })] }],
    ['a duplicate collision key', { result_payload: [candidate(), candidate({ hypothesisId: ids.second, statement: ' I procrastinate   when goals feel vague. ' })] }],
  ])('treats %s as INDETERMINATE instead of guessing', (_label, overrides) => {
    expect(recoverCandidateProviderResult(row(overrides as Record<string, unknown>), intent())).toEqual({ status: 'INDETERMINATE' });
  });

  const validated: Exclude<CandidateProviderRecovery, { status: 'INDETERMINATE' }> = {
    status: 'VALIDATED_CANDIDATES',
    candidates: [candidate(), candidate({ hypothesisId: ids.second, statement: 'A second distinct statement.' })],
  };
  it('recovers the exact ordered persisted ID list against the candidate plan', () => {
    expect(recoverHypothesisPersistenceResult(row({ result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.first, ids.second] }), validated))
      .toEqual({ status: 'HYPOTHESES_PERSISTED', hypothesisIds: [ids.first, ids.second] });
    expect(recoverHypothesisPersistenceResult(row({ result_code: 'NO_HYPOTHESES_PERSISTED', result_payload: null }), { status: 'NO_ACCEPTED_CANDIDATES' }))
      .toEqual({ status: 'NO_HYPOTHESES_PERSISTED', hypothesisIds: [] });
  });
  it.each([
    ['a legacy null persistence result', { result_code: null, result_payload: null }, validated],
    ['a reordered ID list', { result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.second, ids.first] }, validated],
    ['a truncated ID list', { result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.first] }, validated],
    ['an ID from another plan', { result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.first, ids.evidence] }, validated],
    ['NO_HYPOTHESES_PERSISTED paired with a validated plan', { result_code: 'NO_HYPOTHESES_PERSISTED', result_payload: null }, validated],
    ['HYPOTHESES_PERSISTED paired with an empty plan', { result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.first] }, { status: 'NO_ACCEPTED_CANDIDATES' } as const],
    ['a payload-bearing NO_HYPOTHESES_PERSISTED', { result_code: 'NO_HYPOTHESES_PERSISTED', result_payload: [] }, { status: 'NO_ACCEPTED_CANDIDATES' } as const],
    ['a reference-bearing persistence result', { result_code: 'HYPOTHESES_PERSISTED', result_payload: [ids.first, ids.second], result_reference: 'memory:x' }, validated],
  ])('treats %s as an INDETERMINATE candidate/persistence mismatch', (_label, overrides, candidateRecovery) => {
    expect(recoverHypothesisPersistenceResult(row(overrides as Record<string, unknown>), candidateRecovery as Exclude<CandidateProviderRecovery, { status: 'INDETERMINATE' }>))
      .toEqual({ status: 'INDETERMINATE' });
  });
});
