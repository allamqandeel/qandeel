import type { EvidenceService } from '../memory/evidence.service';
import { HypothesisEvidenceRelianceIntegrityError, projectEvidenceReliance, reliableOnly } from './hypothesis-evidence-reliance';
import type { HypothesisRepository } from './hypothesis.repository';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';

// INTEL-TM-01 (PG-02): the API side of the reliance read only validates the database's answer and applies it.
const item = (id: string, version = 3): HypothesisRecord => ({
  id, user_id: 'user', statement: `statement ${id}`, type: 'CAUSAL', domain: 'GENERAL', scope: 'scope', origin: 'SYSTEM_GENERATED',
  status: 'ACTIVE', version, supporting_evidence_ids: [], contradicting_evidence_ids: [], competing_hypothesis_ids: [], assumptions: [],
  disconfirming_conditions: [], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
});
const row = (id: string, version: number, change: string) => ({ hypothesis_id: id, hypothesis_version: version, evidence_change: change });

describe('INTEL-TM-01 projectEvidenceReliance', () => {
  it('keeps an answer only for the exact version held, and leaves an unanswered item absent', () => {
    const reliance = projectEvidenceReliance([item('a'), item('b'), item('c'), item('d')],
      [row('a', 3, 'NONE'), row('b', 3, 'REVIEW_PENDING'), row('c', 4, 'NONE')]);
    expect([...reliance]).toEqual([['a', 'NONE'], ['b', 'REVIEW_PENDING']]);
    expect(reliableOnly([item('d'), item('c'), item('b'), item('a')], reliance).map(({ id }) => id)).toEqual(['a']);
  });
  it.each([
    ['not an array', { rows: [] }],
    ['an id nobody asked for', [row('z', 3, 'NONE')]],
    ['the same id twice', [row('a', 3, 'NONE'), row('a', 3, 'NONE')]],
    ['a fourth state', [row('a', 3, 'RESTORED')]],
    ['a non-integer version', [row('a', 3.5, 'NONE')]],
    ['a missing version', [{ hypothesis_id: 'a', evidence_change: 'NONE' }]],
    ['a null row', [null]],
    ['more rows than asked', [row('a', 3, 'NONE'), row('b', 3, 'NONE')]],
  ])('fails closed on %s', (_name, rows) => {
    expect(() => projectEvidenceReliance([item('a')], rows)).toThrow(HypothesisEvidenceRelianceIntegrityError);
  });
});

describe('INTEL-TM-01 HypothesisService reliance', () => {
  const service = (active: HypothesisRecord[], rows: unknown) => {
    const repository = { listActive: jest.fn().mockResolvedValue(active), readEvidenceReliance: jest.fn().mockResolvedValue(rows) };
    return { repository, hypotheses: new HypothesisService(repository as unknown as HypothesisRepository, {} as EvidenceService) };
  };
  it('reads reliance for exactly the listed items, after the list, and keeps only NONE in order', async () => {
    const { repository, hypotheses } = service([item('a'), item('b'), item('c')], [row('c', 3, 'NONE'), row('b', 3, 'NO_REMAINING_SUPPORT'), row('a', 3, 'NONE')]);
    await expect(hypotheses.listReliableActiveForUser('user', 'token')).resolves.toEqual([item('a'), item('c')]);
    expect(repository.readEvidenceReliance).toHaveBeenCalledWith('token', ['a', 'b', 'c']);
    expect(repository.listActive.mock.invocationCallOrder[0]).toBeLessThan(repository.readEvidenceReliance.mock.invocationCallOrder[0]);
  });
  it('asks nothing when there is nothing to judge', async () => {
    const { repository, hypotheses } = service([], []);
    await expect(hypotheses.listReliableActiveForUser('user', 'token')).resolves.toEqual([]);
    expect(repository.readEvidenceReliance).not.toHaveBeenCalled();
  });
  it('propagates a malformed answer instead of treating the items as usable', async () => {
    const { hypotheses } = service([item('a')], [row('a', 3, 'MAYBE')]);
    await expect(hypotheses.listReliableActiveForUser('user', 'token')).rejects.toBeInstanceOf(HypothesisEvidenceRelianceIntegrityError);
  });
});
