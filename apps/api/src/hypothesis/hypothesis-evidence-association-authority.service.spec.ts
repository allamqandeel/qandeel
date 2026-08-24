import { EvidenceService } from '../memory/evidence.service';
import type { EvidenceItem } from '../memory/evidence.types';
import { HypothesisEvidenceAssociationAuthorityService } from './hypothesis-evidence-association-authority.service';
import {
  MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES,
  MAX_FRESH_EVIDENCE_ASSOCIATIONS,
} from './hypothesis-evidence-association.types';
import { FakeHypothesisEvidenceAssociationProvider } from './fake-hypothesis-evidence-association.provider';
import { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';

const SESSION = '10000000-0000-4000-8000-000000000001';
const EVIDENCE_ID = 'memory:20000000-0000-4000-8000-000000000002';

describe('HypothesisEvidenceAssociationAuthorityService', () => {
  let evidence: jest.Mocked<EvidenceService>;
  let hypotheses: jest.Mocked<HypothesisService>;
  let service: HypothesisEvidenceAssociationAuthorityService;

  beforeEach(() => {
    evidence = { listEligibleForUser: jest.fn().mockResolvedValue([evidenceItem()]) } as unknown as jest.Mocked<EvidenceService>;
    hypotheses = { listActiveForUser: jest.fn().mockResolvedValue([hypothesis()]) } as unknown as jest.Mocked<HypothesisService>;
    service = new HypothesisEvidenceAssociationAuthorityService(evidence, hypotheses);
  });

  it('revalidates the exact fresh Evidence and exposes only approved provider fields', async () => {
    const result = await service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID);
    expect(evidence.listEligibleForUser).toHaveBeenCalledWith('user-a', 'token-a');
    expect(hypotheses.listActiveForUser).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'PREPARED', snapshot: {
      contractVersion: 1, maxAssociationCount: MAX_FRESH_EVIDENCE_ASSOCIATIONS,
      freshEvidence: {
        evidenceId: EVIDENCE_ID, evidenceKind: 'USER_STATED_GOAL',
        statement: 'Fresh statement', source: 'USER_STATED',
      },
    } });
    expect(Object.keys((result as any).snapshot.freshEvidence).sort()).toEqual([
      'evidenceId', 'evidenceKind', 'source', 'statement',
    ]);
    expect(Object.keys((result as any).snapshot.candidateHypotheses[0]).sort()).toEqual([
      'alreadyContradicting', 'alreadySupporting', 'assumptions', 'disconfirmingConditions',
      'domain', 'hypothesisId', 'hypothesisVersion', 'scope', 'statement', 'type',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/originatingMemoryId|user-a|competiting|confidence/i);
  });

  it('fails closed when the exact fresh ID is absent and never substitutes another item', async () => {
    evidence.listEligibleForUser.mockResolvedValue([evidenceItem({ evidenceId: 'memory:30000000-0000-4000-8000-000000000003' })]);
    await expect(service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID)).resolves.toEqual({
      status: 'NOT_AUTHORIZED', reason: 'FRESH_EVIDENCE_NOT_ELIGIBLE',
    });
  });

  it('filters to exact current-session scope while preserving repository order', async () => {
    const first = hypothesis({ id: id(1), statement: 'first' });
    const otherSession = hypothesis({ id: id(2), scope: 'CONVERSATION_SESSION:90000000-0000-4000-8000-000000000009' });
    const global = hypothesis({ id: id(3), scope: 'GLOBAL' });
    const second = hypothesis({ id: id(4), statement: 'second' });
    hypotheses.listActiveForUser.mockResolvedValue([first, otherSession, global, second]);
    const result = await service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID);
    expect((result as any).snapshot.candidateHypotheses.map((item: any) => item.hypothesisId)).toEqual([first.id, second.id]);
  });

  it('returns EMPTY for no same-session candidates without falling back', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis({ scope: 'GLOBAL' })]);
    await expect(service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID)).resolves.toEqual({
      status: 'EMPTY', reason: 'NO_SAME_SESSION_HYPOTHESES',
    });
  });

  it('keeps at most eight complete candidates in canonical order', async () => {
    hypotheses.listActiveForUser.mockResolvedValue(Array.from({ length: 12 }, (_, index) => hypothesis({ id: id(index + 1) })));
    const result = await service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID);
    expect((result as any).snapshot.candidateHypotheses).toHaveLength(MAX_ASSOCIATION_HYPOTHESIS_CANDIDATES);
    expect((result as any).snapshot.candidateHypotheses[0].hypothesisId).toBe(id(1));
  });

  it('uses a Unicode-character whole-item prefix and stops at the first over-budget candidate', async () => {
    const textList = (prefix: string) => Array.from({ length: 8 }, (_, index) =>
      `${prefix}${index}${'أ'.repeat(498 - [...prefix].length)}`);
    const heavy = {
      statement: 'أ'.repeat(2000), assumptions: textList('a'), disconfirming_conditions: textList('d'),
    };
    const first = hypothesis({ id: id(1), ...heavy });
    const second = hypothesis({ id: id(2), ...heavy });
    const overBudget = hypothesis({ id: id(3), ...heavy });
    const laterSmall = hypothesis({ id: id(4), statement: 'small' });
    hypotheses.listActiveForUser.mockResolvedValue([first, second, overBudget, laterSmall]);
    const result = await service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID);
    expect((result as any).snapshot.candidateHypotheses.map((item: any) => item.hypothesisId)).toEqual([first.id, second.id]);
  });

  it('returns NO_ASSOCIATION for an empty semantic proposal array', async () => {
    const snapshot = await prepared();
    await expect(service.authorize('user-a', 'token-a', SESSION, snapshot, [])).resolves.toEqual({ status: 'NO_ASSOCIATION' });
    expect(hypotheses.listActiveForUser).toHaveBeenCalledTimes(1);
  });

  it('authorizes canonical current-version update commands without mutation', async () => {
    const snapshot = await prepared();
    const result = await service.authorize('user-a', 'token-a', SESSION, snapshot, [
      { hypothesisId: id(1), evidenceRole: 'SUPPORTING' },
    ]);
    expect(result).toEqual({ status: 'AUTHORIZED', commands: [{
      hypothesisId: id(1), expectedVersion: 3, evidenceId: EVIDENCE_ID, evidenceRole: 'SUPPORTING',
    }] });
    expect(hypotheses.listActiveForUser).toHaveBeenCalledTimes(2);
    expect(evidence.listEligibleForUser).toHaveBeenCalledTimes(2);
  });

  it.each([
    [[{ hypothesisId: id(1), evidenceRole: 'UNKNOWN' }], 'INVALID_PROVIDER_OUTPUT'],
    [[{ hypothesisId: id(1), evidenceRole: 'SUPPORTING', rationale: 'because' }], 'INVALID_PROVIDER_OUTPUT'],
    [[{ hypothesisId: id(1), evidenceRole: 'SUPPORTING' }, { hypothesisId: id(1), evidenceRole: 'CONTRADICTING' }], 'DUPLICATE_TARGET'],
    [[{ hypothesisId: id(9), evidenceRole: 'SUPPORTING' }], 'TARGET_OUT_OF_UNIVERSE'],
    [Array.from({ length: 5 }, (_, index) => ({ hypothesisId: id(index + 1), evidenceRole: 'SUPPORTING' })), 'BOUND_EXCEEDED'],
  ])('rejects invalid closed proposals without repair', async (proposals, reason) => {
    const snapshot = await prepared();
    await expect(service.authorize('user-a', 'token-a', SESSION, snapshot, proposals)).resolves.toEqual({
      status: 'NOT_AUTHORIZED', reason,
    });
  });

  it.each([
    [{ supporting_evidence_ids: [EVIDENCE_ID] }, 'SUPPORTING', 'ALREADY_ATTACHED'],
    [{ contradicting_evidence_ids: [EVIDENCE_ID] }, 'SUPPORTING', 'OPPOSITE_ROLE_CONFLICT'],
  ])('rejects attached-role conflicts', async (overrides, role, reason) => {
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis(overrides)]);
    const snapshot = await prepared();
    await expect(service.authorize('user-a', 'token-a', SESSION, snapshot, [
      { hypothesisId: id(1), evidenceRole: role },
    ])).resolves.toEqual({ status: 'NOT_AUTHORIZED', reason });
  });

  it('fails closed when the target version changes after provider snapshot', async () => {
    const snapshot = await prepared();
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis({ version: 4 })]);
    await expect(service.authorize('user-a', 'token-a', SESSION, snapshot, [
      { hypothesisId: id(1), evidenceRole: 'SUPPORTING' },
    ])).resolves.toEqual({ status: 'NOT_AUTHORIZED', reason: 'STALE_HYPOTHESIS_VERSION' });
  });

  it('fails closed when fresh Evidence is no longer eligible at final authorization', async () => {
    const snapshot = await prepared();
    evidence.listEligibleForUser.mockResolvedValue([]);
    await expect(service.authorize('user-a', 'token-a', SESSION, snapshot, [
      { hypothesisId: id(1), evidenceRole: 'SUPPORTING' },
    ])).resolves.toEqual({ status: 'NOT_AUTHORIZED', reason: 'FRESH_EVIDENCE_NOT_ELIGIBLE' });
  });

  it('provides a deterministic provider-neutral fake with no production binding', async () => {
    const snapshot = await prepared();
    const fake = new FakeHypothesisEvidenceAssociationProvider();
    fake.setProposals([{ hypothesisId: id(1), evidenceRole: 'CONTRADICTING' }]);
    await expect(fake.propose(snapshot)).resolves.toEqual([{ hypothesisId: id(1), evidenceRole: 'CONTRADICTING' }]);
    expect(fake.calls).toHaveLength(1);
  });

  async function prepared() {
    const result = await service.prepare('user-a', 'token-a', SESSION, EVIDENCE_ID);
    if (result.status !== 'PREPARED') throw new Error('test preparation failed');
    return result.snapshot;
  }
});

function id(number: number): string { return `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`; }
function hypothesis(overrides: Partial<HypothesisRecord> = {}): HypothesisRecord {
  return {
    id: id(1), user_id: 'user-a', statement: 'Candidate statement', type: 'CAUSAL', domain: 'GENERAL',
    scope: `CONVERSATION_SESSION:${SESSION}`, origin: 'SYSTEM_GENERATED', status: 'CANDIDATE', version: 3,
    supporting_evidence_ids: [], contradicting_evidence_ids: [], competing_hypothesis_ids: [], assumptions: [],
    disconfirming_conditions: [], created_at: '2026-08-24T00:00:00.000Z', updated_at: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}
function evidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: EVIDENCE_ID, evidenceKind: 'USER_STATED_GOAL', memoryType: 'GOAL', statement: 'Fresh statement',
    source: 'USER_STATED', confidence: 0.95, importance: 0.85, observedAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z', originatingMemoryId: EVIDENCE_ID.slice(7), ...overrides,
  };
}
