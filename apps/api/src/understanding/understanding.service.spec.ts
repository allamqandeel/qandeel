import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfidenceRepository } from '../hypothesis/confidence.repository';
import type { ConfidenceService } from '../hypothesis/confidence.service';
import { CONFIDENCE_POLICY_VERSION, type ConfidenceEvaluationRecord } from '../hypothesis/confidence.types';
import type { HypothesisService } from '../hypothesis/hypothesis.service';
import type { HypothesisRecord } from '../hypothesis/hypothesis.types';
import type { EvidenceService } from '../memory/evidence.service';
import { understandingItemRef, understandingRevision } from './understanding-projection';
import type { UnderstandingRepository } from './understanding.repository';
import { UnderstandingService } from './understanding.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const H1 = 'a1a1a1a1-0000-4000-8000-000000000001';
const H2 = 'a1a1a1a1-0000-4000-8000-000000000002';

const hypothesis = (id: string, overrides: Partial<HypothesisRecord> = {}): HypothesisRecord => ({
  id, user_id: USER, statement: `You tend to prepare early (${id.slice(-1)}).`, type: 'BEHAVIORAL', domain: 'WORK',
  scope: `SESSION:${'9'.repeat(8)}-0000-4000-8000-000000000000`, origin: 'SYSTEM_GENERATED', status: 'ACTIVE', version: 2,
  supporting_evidence_ids: ['memory:s1'], contradicting_evidence_ids: [], competing_hypothesis_ids: [],
  assumptions: [], disconfirming_conditions: ['If you stop planning.'],
  created_at: '2026-09-28T10:00:00.000000+00:00', updated_at: '2026-09-29T10:00:00.000000+00:00', ...overrides,
});
const evaluation = (target: HypothesisRecord, overrides: Partial<ConfidenceEvaluationRecord> = {}): ConfidenceEvaluationRecord => ({
  id: 'e1', user_id: USER, target_id: target.id, target_type: 'HYPOTHESIS', target_version: target.version,
  version: 1, lifecycle_state: 'EVALUATED', numeric_score: null, confidence_band: null,
  calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED', supporting_evidence_ids: [], contradicting_evidence_ids: [],
  assumptions: [], alternative_hypothesis_ids: [], missing_information_codes: ['CONFIDENCE_MODEL_UNCALIBRATED'],
  policy_version: CONFIDENCE_POLICY_VERSION, provenance: 'QANDEEL_CONFIDENCE_RUNTIME',
  created_at: '2026-09-29T10:00:01.000000+00:00', updated_at: '2026-09-29T10:00:01.000000+00:00', ...overrides,
});
const evidence = (id: string, statement: string, confidence = 0.97) =>
  ({ evidenceId: id, statement, confidence, importance: 0.8 }) as never;

describe('UnderstandingService', () => {
  let hypotheses: jest.Mocked<HypothesisService>, evidenceService: jest.Mocked<EvidenceService>;
  let confidence: jest.Mocked<ConfidenceRepository>, repository: jest.Mocked<UnderstandingRepository>, service: UnderstandingService;
  let confidenceRuntime: jest.Mocked<ConfidenceService>;

  beforeEach(() => {
    hypotheses = { listActiveForUser: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<HypothesisService>;
    evidenceService = { listEligibleForUser: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<EvidenceService>;
    confidence = { listExactVersionsForTargets: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<ConfidenceRepository>;
    repository = {
      listEvidenceUpdates: jest.fn().mockResolvedValue([]), listLifecycleTransitions: jest.fn().mockResolvedValue([]),
      listContestsUnderReview: jest.fn().mockResolvedValue([]), recordDisagreement: jest.fn(),
    } as unknown as jest.Mocked<UnderstandingRepository>;
    confidenceRuntime = { evaluateHypothesisVersion: jest.fn().mockResolvedValue({}) } as unknown as jest.Mocked<ConfidenceService>;
    service = new UnderstandingService(hypotheses, evidenceService, confidence, repository, confidenceRuntime);
  });

  it('is honestly empty: no current understanding, no further reads, nothing manufactured', async () => {
    await expect(service.list(USER, 'token', {})).resolves.toEqual({ items: [] });
    expect(evidenceService.listEligibleForUser).not.toHaveBeenCalled();
    expect(confidence.listExactVersionsForTargets).not.toHaveBeenCalled();
  });

  it('reads only with the caller’s own identity and exposes only the Product shape', async () => {
    const value = hypothesis(H1, { status: 'SUPPORTED' });
    hypotheses.listActiveForUser.mockResolvedValue([value]);
    evidenceService.listEligibleForUser.mockResolvedValue([evidence('memory:s1', 'I plan my week on Sunday.')]);
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(value)]);
    const view = await service.list(USER, 'token', {});
    expect(hypotheses.listActiveForUser).toHaveBeenCalledWith(USER, 'token');
    expect(confidence.listExactVersionsForTargets).toHaveBeenCalledWith('token', USER, [{ id: H1, version: 2 }]);
    expect(view).toEqual({ items: [{
      ref: understandingItemRef(USER, H1), revision: understandingRevision(USER, H1, 2),
      theme: 'WORK', summary: value.statement, confidence: 'CLEAR', underReview: false,
    }] });
    const serialized = JSON.stringify(view);
    for (const leaked of [H1, USER, 'SESSION:', 'SUPPORTED', 'memory:', 'UNCALIBRATED', '0.97', 'BEHAVIORAL', 'SYSTEM_GENERATED']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('shows only current understanding: CANDIDATE, REOPENED and withdrawn interpretations are not listed', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([
      hypothesis(H1, { status: 'CANDIDATE' }), hypothesis(H2, { status: 'REOPENED' }),
    ]);
    await expect(service.list(USER, 'token', {})).resolves.toEqual({ items: [] });
  });

  it('never substitutes an older version’s Confidence: a stale-only history is NEEDS_MORE', async () => {
    const value = hypothesis(H1, { status: 'SUPPORTED', version: 5 });
    hypotheses.listActiveForUser.mockResolvedValue([value]);
    evidenceService.listEligibleForUser.mockResolvedValue([evidence('memory:s1', 'x')]);
    // The exact-version read returns nothing for v5 (only v4 exists); the projection is conservative.
    confidence.listExactVersionsForTargets.mockResolvedValue([]);
    const view = await service.list(USER, 'token', {});
    expect(view.items[0].confidence).toBe('NEEDS_MORE');
    // A stale row smuggled into the exact-version answer fails closed instead of being trusted.
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(value, { target_version: 4 })]);
    await expect(service.list(USER, 'token', {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses a numeric score or band from upstream instead of passing it on', async () => {
    const value = hypothesis(H1);
    hypotheses.listActiveForUser.mockResolvedValue([value]);
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(value, { numeric_score: 0.8 as never })]);
    await expect(service.list(USER, 'token', {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(value, { confidence_band: 'HIGH' as never })]);
    await expect(service.list(USER, 'token', {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed on a cross-user row reaching it, even though RLS already filters', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { user_id: OTHER })]);
    await expect(service.list(USER, 'token', {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('bounds the list and refuses any other query parameter, including a client-supplied user id', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1), hypothesis(H2)]);
    await expect(service.list(USER, 'token', { limit: '1' })).resolves.toMatchObject({ items: [{ ref: understandingItemRef(USER, H1) }] });
    for (const query of [{ userId: OTHER }, { user_id: OTHER }, { limit: '0' }, { limit: '33' }, { limit: '1.5' }, { limit: ['1'] }]) {
      await expect(service.list(USER, 'token', query)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('resolves a detail only among the caller’s own current items, with one 404 for everything else', async () => {
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1)]);
    for (const ref of [understandingItemRef(OTHER, H1), H1, 'nonsense', understandingItemRef(USER, H2)]) {
      await expect(service.detail(USER, 'token', ref)).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('explains with the reader’s own context, alternatives, unresolved points and evolution — never reasoning or counts', async () => {
    const main = hypothesis(H1, {
      supporting_evidence_ids: ['memory:s1', 'memory:gone'], contradicting_evidence_ids: ['memory:c1'],
      competing_hypothesis_ids: [H2], assumptions: ['Deadlines matter to you.'],
    });
    const rival = hypothesis(H2, { statement: 'You prepare early only for others.' });
    hypotheses.listActiveForUser.mockResolvedValue([main, rival]);
    evidenceService.listEligibleForUser.mockResolvedValue([
      evidence('memory:s1', 'I plan my week on Sunday.'), evidence('memory:c1', 'I left the report to the last night.'),
    ]);
    repository.listEvidenceUpdates.mockResolvedValue([{ evidence_role: 'CONTRADICTING', created_at: '2026-09-29T09:00:00.000000+00:00' }]);
    repository.listLifecycleTransitions.mockResolvedValue([
      { before_status: 'CANDIDATE', after_status: 'ACTIVE', after_version: 2, source: 'SYSTEM_GENERATION_ACTIVATION', created_at: '2026-09-28T10:00:00.000000+00:00' },
    ]);
    const view = await service.detail(USER, 'token', understandingItemRef(USER, H1));
    expect(view).toEqual({
      ref: understandingItemRef(USER, H1), revision: understandingRevision(USER, H1, 2), theme: 'WORK',
      summary: main.statement, confidence: 'MIXED', underReview: false,
      evidence: ['I plan my week on Sunday.'], contradictions: ['I left the report to the last night.'],
      alternatives: ['You prepare early only for others.'], unresolved: ['Deadlines matter to you.'],
      evolution: [
        { kind: 'CHALLENGE_ADDED', at: '2026-09-29T09:00:00.000000+00:00' },
        { kind: 'FIRST_SEEN', at: '2026-09-28T10:00:00.000000+00:00' },
      ],
    });
    expect(repository.listEvidenceUpdates).toHaveBeenCalledWith('token', USER, H1);
    // The disconfirming conditions and the internal scope are not a Product field.
    expect(JSON.stringify(view)).not.toContain('If you stop planning.');
    expect(JSON.stringify(view)).not.toContain('SESSION:');
  });

  describe('U2 — talk to QANDEEL about this (discussion focus)', () => {
    beforeEach(() => {
      repository.openDiscussion = jest.fn().mockResolvedValue('OPENED');
      repository.closeDiscussion = jest.fn().mockResolvedValue('CLOSED');
    });

    it('records the caller’s choice of their own current item at the exact version they saw', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 4 })]);
      await expect(service.openDiscussion(USER, 'token', understandingItemRef(USER, H1), { revision: understandingRevision(USER, H1, 4) })).resolves.toBeUndefined();
      expect(repository.openDiscussion).toHaveBeenCalledWith('token', H1, 4);
    });

    it('never records a choice against a newer interpretation than the one seen', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 5 })]);
      await expect(service.openDiscussion(USER, 'token', understandingItemRef(USER, H1), { revision: understandingRevision(USER, H1, 4) }))
        .rejects.toMatchObject({ status: 409, response: { code: 'UNDERSTANDING_ITEM_CHANGED' } });
      expect(repository.openDiscussion).not.toHaveBeenCalled();
      // The database's own recheck under lock answers STALE when the item moved in between.
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 4 })]);
      (repository.openDiscussion as jest.Mock).mockResolvedValue('STALE');
      await expect(service.openDiscussion(USER, 'token', understandingItemRef(USER, H1), { revision: understandingRevision(USER, H1, 4) }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('refuses another reader’s ref, a withdrawn item and any widened body', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1), hypothesis(H2, { status: 'REJECTED' })]);
      const revision = understandingRevision(USER, H1, 2);
      await expect(service.openDiscussion(USER, 'token', understandingItemRef(OTHER, H1), { revision })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.openDiscussion(USER, 'token', understandingItemRef(USER, H2), { revision: understandingRevision(USER, H2, 2) })).rejects.toBeInstanceOf(NotFoundException);
      for (const body of [{}, { revision, userId: OTHER }, { revision: 'x' }, null, [revision]]) {
        await expect(service.openDiscussion(USER, 'token', understandingItemRef(USER, H1), body)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(repository.openDiscussion).not.toHaveBeenCalled();
    });

    it('closes only the named item, idempotently, and fails closed on an unknown answer', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1)]);
      await expect(service.closeDiscussion(USER, 'token', understandingItemRef(USER, H1))).resolves.toBeUndefined();
      expect(repository.closeDiscussion).toHaveBeenCalledWith('token', H1);
      await expect(service.closeDiscussion(USER, 'token', understandingItemRef(OTHER, H1))).resolves.toBeUndefined();
      expect(repository.closeDiscussion).toHaveBeenCalledTimes(1);
      (repository.closeDiscussion as jest.Mock).mockResolvedValue('SOMETHING');
      await expect(service.closeDiscussion(USER, 'token', understandingItemRef(USER, H1))).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('U3 — explicit disagreement → Contested / Under Review (PG-01)', () => {
    const COMMAND = '5b2f6c3e-7a1d-4c2e-9f00-1234567890ab';
    const ask = (version: number, commandId = COMMAND) =>
      service.disagree(USER, 'token', understandingItemRef(USER, H1), { commandId, revision: understandingRevision(USER, H1, version) });

    it('records against the exact version seen, then evaluates the exact re-evaluated version once', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 3 })]);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'RECORDED', contested_version: 3, reevaluated_version: 4 }]);
      await expect(ask(3)).resolves.toEqual({ underReview: true, revision: understandingRevision(USER, H1, 4) });
      expect(repository.recordDisagreement).toHaveBeenCalledWith('token', COMMAND, H1, 3);
      expect(confidence.listExactVersionsForTargets).toHaveBeenLastCalledWith('token', USER, [{ id: H1, version: 4 }]);
      expect(confidenceRuntime.evaluateHypothesisVersion).toHaveBeenCalledWith(USER, 'token', H1, 4);
    });

    it('a replay whose answer was lost binds to the version before the re-evaluation and never evaluates twice', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 4, status: 'MIXED' })]);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'RECORDED', contested_version: 3, reevaluated_version: 4 }]);
      confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(hypothesis(H1, { version: 4 }))]);
      await expect(ask(3)).resolves.toEqual({ underReview: true, revision: understandingRevision(USER, H1, 4) });
      expect(repository.recordDisagreement).toHaveBeenCalledWith('token', COMMAND, H1, 3);
      expect(confidenceRuntime.evaluateHypothesisVersion).not.toHaveBeenCalled();
    });

    it('a Confidence failure never undoes or hides the committed contest', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 3 })]);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'RECORDED', contested_version: 3, reevaluated_version: 4 }]);
      confidenceRuntime.evaluateHypothesisVersion.mockRejectedValue(new Error('stale'));
      await expect(ask(3)).resolves.toMatchObject({ underReview: true });
    });

    it('never applies an objection to a different interpretation: a changed item is 409 and nothing is recorded', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 6 })]);
      await expect(ask(3)).rejects.toMatchObject({ status: 409, response: { code: 'UNDERSTANDING_ITEM_CHANGED' } });
      expect(repository.recordDisagreement).not.toHaveBeenCalled();
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 3 })]);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'STALE', contested_version: null, reevaluated_version: null }]);
      await expect(ask(3)).rejects.toMatchObject({ status: 409, response: { code: 'UNDERSTANDING_ITEM_CHANGED' } });
      expect(confidenceRuntime.evaluateHypothesisVersion).not.toHaveBeenCalled();
    });

    it('a second disagreement on an item already under review is idempotent and mutates nothing', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 4, status: 'MIXED' })]);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'ALREADY_UNDER_REVIEW', contested_version: 3, reevaluated_version: 4 }]);
      await expect(ask(4, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).resolves.toMatchObject({ underReview: true });
      // R1: nothing is mutated, but a missing exact-version evaluation of the re-evaluated version is repaired, once.
      expect(repository.recordDisagreement).toHaveBeenCalledTimes(1);
      expect(confidenceRuntime.evaluateHypothesisVersion).toHaveBeenCalledTimes(1);
      expect(confidenceRuntime.evaluateHypothesisVersion).toHaveBeenCalledWith(USER, 'token', H1, 4);
      confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(hypothesis(H1, { version: 4 }))]);
      await expect(ask(4, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).resolves.toMatchObject({ underReview: true });
      expect(confidenceRuntime.evaluateHypothesisVersion).toHaveBeenCalledTimes(1);
      // An old revision on an item already under review answers the same, without a command.
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 9, status: 'MIXED' })]);
      repository.listContestsUnderReview.mockResolvedValue([{ hypothesis_id: H1, reevaluation_after_version: 4, created_at: '2026-09-30T10:00:00Z' }]);
      (repository.recordDisagreement as jest.Mock).mockClear();
      await expect(ask(3)).resolves.toMatchObject({ underReview: true });
      expect(repository.recordDisagreement).not.toHaveBeenCalled();
    });

    it('refuses another reader’s item, a spent command, and any widened body — no text is ever accepted', async () => {
      hypotheses.listActiveForUser.mockResolvedValue([hypothesis(H1, { version: 3 })]);
      await expect(service.disagree(USER, 'token', understandingItemRef(OTHER, H1), { commandId: COMMAND, revision: understandingRevision(USER, H1, 3) }))
        .rejects.toBeInstanceOf(NotFoundException);
      (repository.recordDisagreement as jest.Mock).mockResolvedValue([{ outcome: 'COMMAND_CONFLICT', contested_version: null, reevaluated_version: null }]);
      await expect(ask(3)).rejects.toMatchObject({ status: 409, response: { code: 'UNDERSTANDING_COMMAND_CONFLICT' } });
      const revision = understandingRevision(USER, H1, 3);
      for (const body of [{ revision }, { commandId: COMMAND }, { commandId: COMMAND, revision, message: 'I disagree because…' },
        { commandId: COMMAND, revision, userId: OTHER }, { commandId: 'not-a-uuid', revision }, null]) {
        await expect(service.disagree(USER, 'token', understandingItemRef(USER, H1), body)).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('once contested, the item is Mixed and under review — not deleted — and its evolution says the reader disagreed', async () => {
      const contested = hypothesis(H1, { version: 4, status: 'MIXED' });
      hypotheses.listActiveForUser.mockResolvedValue([contested]);
      evidenceService.listEligibleForUser.mockResolvedValue([evidence('memory:s1', 'x')]);
      confidence.listExactVersionsForTargets.mockResolvedValue([evaluation(contested)]);
      repository.listContestsUnderReview.mockResolvedValue([{ hypothesis_id: H1, reevaluation_after_version: 4, created_at: '2026-09-30T10:00:00.000000+00:00' }]);
      repository.listLifecycleTransitions.mockResolvedValue([
        { before_status: 'SUPPORTED', after_status: 'MIXED', after_version: 4, source: 'AUTHENTICATED_TRANSITION', created_at: '2026-09-30T10:00:00.000000+00:00' },
      ]);
      await expect(service.list(USER, 'token', {})).resolves.toMatchObject({ items: [{ confidence: 'MIXED', underReview: true }] });
      // R1: the contest read is bound to the exact current items — never a capped window that could drop one.
      expect(repository.listContestsUnderReview).toHaveBeenLastCalledWith('token', USER, [H1]);
      const detail = await service.detail(USER, 'token', understandingItemRef(USER, H1));
      expect(detail).toMatchObject({ confidence: 'MIXED', underReview: true, summary: contested.statement });
      expect(detail.evolution.map((entry) => entry.kind)).toEqual(['YOU_DISAGREED', 'FIRST_SEEN']);
    });
  });

  it('sanitizes an upstream failure into one generic 503', async () => {
    hypotheses.listActiveForUser.mockRejectedValue(new Error('upstream secret detail'));
    await expect(service.list(USER, 'token', {})).rejects.toThrow('Understanding is unavailable.');
  });
});
