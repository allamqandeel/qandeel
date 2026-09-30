import type { EvidenceService } from '../memory/evidence.service';
import type { ConfidenceRepository } from './confidence.repository';
import { HypothesisReasoningContextService } from './hypothesis-reasoning-context.service';
import { HypothesisReasoningInvariantError } from './hypothesis-reasoning-context.types';
import type { HypothesisService } from './hypothesis.service';
import type { HypothesisRecord } from './hypothesis.types';
import { DISCUSSION_FOCUS_WINDOW_MS, type HypothesisUserSignalRepository } from './hypothesis-user-signal.repository';

// W3-MEGA-U — the reader's own explicit Understanding signals reach the provider-facing Hypothesis context.
const hypothesis = (id: string): HypothesisRecord => ({
  id, user_id: 'user', statement: `statement ${id}`, type: 'CAUSAL', domain: 'GENERAL', scope: 'scope',
  origin: 'SYSTEM_GENERATED', status: 'ACTIVE', version: 2, supporting_evidence_ids: [], contradicting_evidence_ids: [],
  competing_hypothesis_ids: [], assumptions: [], disconfirming_conditions: [], created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z',
});
const recently = () => new Date(Date.now() - 60_000).toISOString();

describe('HypothesisReasoningContextService — U2 discussion focus', () => {
  let hypotheses: jest.Mocked<HypothesisService>, signals: jest.Mocked<HypothesisUserSignalRepository>, service: HypothesisReasoningContextService;
  beforeEach(() => {
    hypotheses = { listActiveForUser: jest.fn().mockResolvedValue([hypothesis('a'), hypothesis('b'), hypothesis('c')]) } as unknown as jest.Mocked<HypothesisService>;
    const evidence = { listEligibleForUser: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<EvidenceService>;
    const confidence = { listExactVersionsForTargets: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<ConfidenceRepository>;
    signals = { readOpenDiscussionFocus: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<HypothesisUserSignalRepository>;
    service = new HypothesisReasoningContextService(hypotheses, evidence, confidence, signals);
  });
  const items = async () => {
    const result = await service.build('user', 'token');
    if (result.coverageState !== 'AVAILABLE') throw new Error('expected AVAILABLE');
    return result.context.hypotheses;
  };

  it('without a focus, nothing is marked and the repository order is kept', async () => {
    expect((await items()).map((item) => [item.statement, item.userDiscussion])).toEqual([
      ['statement a', undefined], ['statement b', undefined], ['statement c', undefined],
    ]);
    expect(signals.readOpenDiscussionFocus).toHaveBeenCalledWith('token', 'user');
  });

  it('marks the ONE item the reader chose and offers it first, with no identifier in the context', async () => {
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'c', hypothesis_version: 2, opened_at: recently() });
    const context = await items();
    expect(context.map((item) => item.statement)).toEqual(['statement c', 'statement a', 'statement b']);
    expect(context.filter((item) => item.userDiscussion === 'OPENED_FROM_UNDERSTANDING')).toHaveLength(1);
    expect(JSON.stringify(context)).not.toMatch(/"c"|hypothesis_id|opened_at/u);
  });

  it('forgets a focus older than its bounded window, and one naming no current item', async () => {
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'c', hypothesis_version: 2, opened_at: new Date(Date.now() - DISCUSSION_FOCUS_WINDOW_MS - 1_000).toISOString() });
    expect((await items()).some((item) => item.userDiscussion)).toBe(false);
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'withdrawn', hypothesis_version: 2, opened_at: recently() });
    expect((await items()).some((item) => item.userDiscussion)).toBe(false);
  });

  it('R2: the focus holds only at the EXACT revision the reader chose — an advanced item is never silently rebound', async () => {
    const at = (version: number) => ({ ...hypothesis('c'), version });
    // Same revision: the reader chose v3, the item is still v3.
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis('a'), at(3)]);
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'c', hypothesis_version: 3, opened_at: recently() });
    expect((await items()).map((item) => [item.statement, item.hypothesisVersion, item.userDiscussion])).toEqual([
      ['statement c', 3, 'OPENED_FROM_UNDERSTANDING'], ['statement a', 2, undefined],
    ]);
    // Advanced revision: the same item is now v4 — an interpretation the reader never saw. Nothing is marked or moved.
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis('a'), at(4)]);
    expect((await items()).map((item) => [item.statement, item.hypothesisVersion, item.userDiscussion])).toEqual([
      ['statement a', 2, undefined], ['statement c', 4, undefined],
    ]);
    // Never a lower version either: equality, not "at least".
    hypotheses.listActiveForUser.mockResolvedValue([hypothesis('a'), at(2)]);
    expect((await items()).some((item) => item.userDiscussion)).toBe(false);
  });

  it('R2: a focus on one item never marks another item that happens to share its version', async () => {
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'elsewhere', hypothesis_version: 2, opened_at: recently() });
    expect((await items()).some((item) => item.userDiscussion)).toBe(false);
  });

  it('R2: a focus row without a well-formed stored version fails closed — it is never read as "any version"', async () => {
    for (const hypothesis_version of [undefined, null, 0, 2.5, '2']) {
      signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'c', hypothesis_version, opened_at: recently() } as never);
      await expect(service.build('user', 'token')).rejects.toBeInstanceOf(HypothesisReasoningInvariantError);
    }
  });

  it('fails closed on a malformed focus row, and never reads signals when there is nothing to mark', async () => {
    signals.readOpenDiscussionFocus.mockResolvedValue({ hypothesis_id: 'c', hypothesis_version: 2, opened_at: 'not a time' });
    await expect(service.build('user', 'token')).rejects.toBeInstanceOf(HypothesisReasoningInvariantError);
    hypotheses.listActiveForUser.mockResolvedValue([]);
    signals.readOpenDiscussionFocus.mockClear();
    await expect(service.build('user', 'token')).resolves.toEqual({ coverageState: 'EMPTY', candidateHypothesisCount: 0 });
    expect(signals.readOpenDiscussionFocus).not.toHaveBeenCalled();
  });

  it('a failed signal read fails the whole context, so no item is ever consumed without it', async () => {
    signals.readOpenDiscussionFocus.mockRejectedValue(new Error('unavailable'));
    await expect(service.build('user', 'token')).rejects.toThrow('unavailable');
  });
});
