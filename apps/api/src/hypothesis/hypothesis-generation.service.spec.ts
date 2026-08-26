import { BadRequestException } from '@nestjs/common';
import { EvidenceService } from '../memory/evidence.service';
import { HypothesisGenerationService } from './hypothesis-generation.service';
import type { HypothesisCandidateGenerator, HypothesisCandidateProposal, HypothesisGenerationRequest } from './hypothesis-generation.types';
import { MAX_GENERATED_HYPOTHESIS_CANDIDATES } from './hypothesis-generation.types';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';

const evidenceId = 'memory:22222222-2222-4222-8222-222222222222';
const candidate = (overrides: Partial<HypothesisCandidateProposal> = {}): HypothesisCandidateProposal => ({
  statement: 'Time pressure may contribute to indecision.', type: 'CAUSAL', domain: 'DECISION',
  scope: 'Current work decision', supportingEvidenceIds: [evidenceId], contradictingEvidenceIds: [],
  assumptions: ['The deadline remains relevant.'], disconfirmingConditions: ['Indecision persists after the deadline is removed.'], ...overrides,
});
const record = (overrides: Partial<HypothesisRecord> = {}): HypothesisRecord => ({
  id: '11111111-1111-4111-8111-111111111111', user_id: 'user-a', statement: candidate().statement,
  type: 'CAUSAL', domain: 'DECISION', scope: 'Current work decision', origin: 'SYSTEM_GENERATED',
  status: 'CANDIDATE', version: 1, supporting_evidence_ids: [], contradicting_evidence_ids: [],
  competing_hypothesis_ids: [], assumptions: candidate().assumptions, disconfirming_conditions: candidate().disconfirmingConditions,
  created_at: '2026-08-17T00:00:00.000Z', updated_at: '2026-08-17T00:00:00.000Z', ...overrides,
});

class DeterministicFakeGenerator implements HypothesisCandidateGenerator {
  request?: HypothesisGenerationRequest;
  constructor(private readonly fixtures: ReadonlyArray<HypothesisCandidateProposal>) {}
  async generate(request: HypothesisGenerationRequest): Promise<ReadonlyArray<HypothesisCandidateProposal>> {
    this.request = request;
    return this.fixtures;
  }
}

describe('HypothesisGenerationService', () => {
  let evidence: jest.Mocked<EvidenceService>;
  let hypotheses: jest.Mocked<HypothesisService>;
  let service: HypothesisGenerationService;

  beforeEach(() => {
    evidence = { listEligibleForUser: jest.fn().mockResolvedValue([{ evidenceId, statement: 'A deadline exists.' } as never]) } as unknown as jest.Mocked<EvidenceService>;
    hypotheses = {
      listActiveForUser: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue(record()),
      attachEvidence: jest.fn().mockImplementation(async (_u, _t, _id, id, role) => record(role === 'SUPPORTING' ? { supporting_evidence_ids: [id] } : { contradicting_evidence_ids: [id] })),
      linkCompetitor: jest.fn().mockResolvedValue(record()),
    } as unknown as jest.Mocked<HypothesisService>;
    service = new HypothesisGenerationService(evidence, hypotheses);
  });

  const run = (generator: HypothesisCandidateGenerator, evidenceIds = [evidenceId]) => service.generate(
    'user-a', 'token-a', { problem: 'Why is this decision stalled?', domain: 'DECISION', scope: 'Current work decision', evidenceIds }, generator,
  );

  it('builds a bounded user-scoped request for a provider-neutral deterministic generator', async () => {
    const generator = new DeterministicFakeGenerator([candidate()]);
    await run(generator);
    expect(evidence.listEligibleForUser).toHaveBeenCalledWith('user-a', 'token-a');
    expect(hypotheses.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a');
    expect(generator.request).toEqual(expect.objectContaining({ userId: 'user-a', domain: 'DECISION', scope: 'Current work decision', maxCandidateCount: 5 }));
    expect(generator.request?.eligibleEvidence).toHaveLength(1);
    for (const forbidden of ['conversation', 'rawTranscript', 'providerPayload', 'safetyHistory', 'hiddenReasoning']) expect(generator.request).not.toHaveProperty(forbidden);
  });

  it('keeps proposals transient until validation and persists accepted candidates through HypothesisService', async () => {
    const invalid = candidate({ domain: 'WORK' });
    const result = await run(new DeterministicFakeGenerator([invalid, candidate()]));
    expect(result.rejected).toEqual([{ candidateIndex: 0, reason: 'INVALID_CANDIDATE' }]);
    expect(hypotheses.create).toHaveBeenCalledTimes(1);
    // Creation is server-authoritative: the owner is passed, the caller token is not.
    expect(hypotheses.create).toHaveBeenCalledWith('user-a', expect.objectContaining({ origin: 'SYSTEM_GENERATED' }));
    expect(hypotheses.create.mock.calls[0]).toHaveLength(2);
    expect(result.accepted[0]).toMatchObject({ origin: 'SYSTEM_GENERATED', status: 'CANDIDATE' });
  });

  it('grounds separate supporting and contradicting roles in the request evidence universe', async () => {
    const contradiction = 'memory:33333333-3333-4333-8333-333333333333';
    evidence.listEligibleForUser.mockResolvedValue([{ evidenceId } as never, { evidenceId: contradiction } as never]);
    const result = await run(new DeterministicFakeGenerator([candidate({ contradictingEvidenceIds: [contradiction] })]), [evidenceId, contradiction]);
    expect(result.rejected).toEqual([]);
    expect(hypotheses.attachEvidence).toHaveBeenNthCalledWith(1, 'user-a', 'token-a', expect.any(String), evidenceId, 'SUPPORTING');
    expect(hypotheses.attachEvidence).toHaveBeenNthCalledWith(2, 'user-a', 'token-a', expect.any(String), contradiction, 'CONTRADICTING');
  });

  it.each([
    [candidate({ type: 'FACT' as never }), 'INVALID_CANDIDATE'],
    [candidate({ scope: 'Another scope' }), 'INVALID_CANDIDATE'],
    [candidate({ supportingEvidenceIds: ['memory:outside'] }), 'EVIDENCE_OUTSIDE_REQUEST'],
    [candidate({ contradictingEvidenceIds: [evidenceId] }), 'EVIDENCE_ROLE_CONFLICT'],
    [candidate({ assumptions: Array(9).fill('bounded') }), 'INVALID_CANDIDATE'],
    [candidate({ disconfirmingConditions: ['x'.repeat(501)] }), 'INVALID_CANDIDATE'],
  ] as const)('rejects invalid or ungrounded proposal %#', async (proposal, reason) => {
    const result = await run(new DeterministicFakeGenerator([proposal]));
    expect(result.rejected).toEqual([{ candidateIndex: 0, reason }]);
    expect(hypotheses.create).not.toHaveBeenCalled();
  });

  it('rejects nonexistent, ineligible, or cross-user evidence before invoking the generator', async () => {
    const generator = new DeterministicFakeGenerator([candidate()]);
    evidence.listEligibleForUser.mockResolvedValue([]);
    await expect(run(generator)).rejects.toBeInstanceOf(BadRequestException);
    expect(generator.request).toBeUndefined();
  });

  it('rejects exact normalized batch and active-scope duplicates', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([record({ statement: 'Existing explanation.' })]);
    const result = await run(new DeterministicFakeGenerator([
      candidate(), candidate({ statement: '  Time   pressure may contribute to indecision.  ' }), candidate({ statement: 'Existing explanation.' }),
    ]));
    expect(result.rejected).toEqual([
      { candidateIndex: 1, reason: 'DUPLICATE_IN_BATCH' },
      { candidateIndex: 2, reason: 'DUPLICATE_ACTIVE_HYPOTHESIS' },
    ]);
  });

  it('enforces the server cap, preserves distinct alternatives, links competition, and selects no winner', async () => {
    const proposals = Array.from({ length: MAX_GENERATED_HYPOTHESIS_CANDIDATES + 1 }, (_, index) => candidate({ statement: `Alternative ${index}` }));
    hypotheses.create.mockImplementation(async (_u, value) => record({ id: `id-${value.statement}`, statement: value.statement }));
    const result = await run(new DeterministicFakeGenerator(proposals));
    expect(result.accepted).toHaveLength(MAX_GENERATED_HYPOTHESIS_CANDIDATES);
    expect(result.rejected).toContainEqual({ candidateIndex: 5, reason: 'CANDIDATE_LIMIT_EXCEEDED' });
    expect(hypotheses.linkCompetitor).toHaveBeenCalledTimes(10);
    expect(result).not.toHaveProperty('winner');
    expect(result).not.toHaveProperty('primaryHypothesis');
  });

  it('allows a provisional zero-support candidate and has no confidence, ranking, question, personality, diagnosis, or HIM fields', async () => {
    const proposal = candidate({ supportingEvidenceIds: [], contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [] });
    const result = await run(new DeterministicFakeGenerator([proposal]), []);
    expect(result.accepted).toHaveLength(1);
    expect(hypotheses.attachEvidence).not.toHaveBeenCalled();
    const shape = proposal as unknown as Record<string, unknown>;
    for (const forbidden of ['confidence', 'probability', 'ranking', 'question', 'personality', 'diagnosis', 'him', 'chainOfThought', 'hiddenRationale']) expect(shape).not.toHaveProperty(forbidden);
  });

  it.each(['confidence', 'ranking', 'chainOfThought', 'personality', 'diagnosis', 'him'])('rejects forbidden generator field %s', async (field) => {
    const proposal = { ...candidate(), [field]: 'forbidden' } as HypothesisCandidateProposal;
    const result = await run(new DeterministicFakeGenerator([proposal]));
    expect(result.rejected).toEqual([{ candidateIndex: 0, reason: 'INVALID_CANDIDATE' }]);
    expect(hypotheses.create).not.toHaveBeenCalled();
  });
});
