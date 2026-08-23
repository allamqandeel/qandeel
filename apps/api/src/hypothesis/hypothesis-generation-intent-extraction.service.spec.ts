import type { EvidenceItem } from '../memory/evidence.types';
import { HypothesisGenerationIntentAuthorityService } from './hypothesis-generation-intent-authority.service';
import { HypothesisGenerationIntentExtractionService } from './hypothesis-generation-intent-extraction.service';
import {
  HypothesisIntentExtractionProviderError,
  type HypothesisIntentExtractionProvider,
  type HypothesisIntentExtractionProviderOutput,
} from './hypothesis-intent-extraction-provider.types';

describe('HypothesisGenerationIntentExtractionService', () => {
  const turnId = '10000000-0000-4000-8000-000000000001';
  const sessionId = '20000000-0000-4000-8000-000000000002';
  const evidenceId = 'memory:30000000-0000-4000-8000-000000000003';
  const evidence: EvidenceItem = {
    evidenceId, evidenceKind: 'USER_STATED_GOAL', memoryType: 'GOAL', statement: 'Change careers',
    source: 'USER_STATED', confidence: 1, importance: 0.8, observedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', originatingMemoryId: evidenceId.slice(7),
  };
  let provider: jest.Mocked<HypothesisIntentExtractionProvider>;
  let service: HypothesisGenerationIntentExtractionService;

  const input = (text: string) => ({
    currentTurn: { id: turnId, sessionId, role: 'USER' as const, status: 'COMPLETED' as const, text },
    eligibility: { status: 'ELIGIBLE' as const, reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' as const },
    triggerReason: 'EXPLICIT_WHY_SELF' as const,
    eligibleEvidence: [evidence],
  });

  beforeEach(() => {
    provider = { extract: jest.fn() };
    service = new HypothesisGenerationIntentExtractionService(
      provider,
      new HypothesisGenerationIntentAuthorityService(),
    );
  });

  it.each([
    ['Why do I keep changing careers?', 'keep changing careers'],
    ['لماذا أنا أكرر نفس القرار؟', 'أكرر نفس القرار'],
    ['ليه أنا كل مرة بغير رأيي؟', 'كل مرة بغير رأيي'],
  ])('authorizes extractively grounded intent for %s', async (text, problemText) => {
    provider.extract.mockResolvedValue({ problemText, domain: 'WORK', selectedEvidenceIds: [evidenceId] });
    await expect(service.extract(input(text))).resolves.toEqual({
      status: 'AUTHORIZED',
      intent: {
        problem: { text: problemText, source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
        domain: 'WORK',
        scope: { kind: 'CONVERSATION_SESSION', sessionId, serialized: `CONVERSATION_SESSION:${sessionId}` },
        evidenceIds: [evidenceId],
      },
    });
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ problemText: 'fear of failure', domain: 'WORK', selectedEvidenceIds: [evidenceId] }, 'PROBLEM_NOT_GROUNDED'],
    [{ problemText: 'diagnosed anxiety', domain: 'GENERAL', selectedEvidenceIds: [evidenceId] }, 'PROBLEM_NOT_GROUNDED'],
    [{ problemText: 'changing careers', domain: 'WORK', selectedEvidenceIds: ['memory:40000000-0000-4000-8000-000000000004'] }, 'EVIDENCE_OUT_OF_UNIVERSE'],
    [{ problemText: 'changing careers', domain: 'WORK', selectedEvidenceIds: [evidenceId, evidenceId] }, 'DUPLICATE_EVIDENCE'],
    [{ problemText: 'changing careers', domain: 'NOT_A_DOMAIN', selectedEvidenceIds: [evidenceId] }, 'INVALID_DOMAIN'],
  ] as const)('leaves semantic rejection to Intent Authority', async (output, authorityReason) => {
    provider.extract.mockResolvedValue(output as unknown as HypothesisIntentExtractionProviderOutput);
    await expect(service.extract(input('Why do I keep changing careers?'))).resolves.toEqual({
      status: 'NOT_AUTHORIZED', reason: 'AUTHORITY_REJECTED', authorityReason,
    });
  });

  it('ignores provider-owned provenance and sends only bounded approved request fields', async () => {
    provider.extract.mockResolvedValue({
      problemText: 'changing careers', domain: 'WORK', selectedEvidenceIds: [evidenceId],
      sourceTurnId: 'provider-turn', scope: { sessionId: 'provider-session' },
    } as unknown as HypothesisIntentExtractionProviderOutput);
    const result = await service.extract(input('Why do I keep changing careers?'));
    expect(result).toMatchObject({
      status: 'AUTHORIZED',
      intent: { problem: { sourceTurnId: turnId }, scope: { sessionId } },
    });
    expect(provider.extract).toHaveBeenCalledWith({
      currentUserText: 'Why do I keep changing careers?', triggerReason: 'EXPLICIT_WHY_SELF',
      allowedDomains: ['GENERAL', 'RELATIONSHIP', 'WORK', 'DECISION', 'GOAL', 'INTERACTION'],
      eligibleEvidence: [{ evidenceId, evidenceKind: 'USER_STATED_GOAL', statement: 'Change careers' }],
      maxSelectedEvidence: 8, schemaVersion: 1,
    });
    expect(Object.keys(provider.extract.mock.calls[0][0])).toEqual([
      'currentUserText', 'triggerReason', 'allowedDomains', 'eligibleEvidence', 'maxSelectedEvidence', 'schemaVersion',
    ]);
  });

  it.each([
    ['UNAVAILABLE', 'PROVIDER_UNAVAILABLE'],
    ['TIMEOUT', 'PROVIDER_TIMEOUT'],
    ['INVALID_STRUCTURED_OUTPUT', 'INVALID_PROVIDER_OUTPUT'],
    ['PROVIDER_ERROR', 'PROVIDER_FAILED'],
  ] as const)('maps %s without retry or error prose', async (code, reason) => {
    provider.extract.mockRejectedValue(new HypothesisIntentExtractionProviderError(code));
    const result = await service.extract(input('Why do I keep changing careers?'));
    expect(result).toEqual({ status: 'NOT_AUTHORIZED', reason });
    expect(provider.extract).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(/provider failed|response|body|careers|memory:/i);
  });

  it('maps an unexpected provider failure to one bounded generic outcome', async () => {
    provider.extract.mockRejectedValue(new Error('raw provider body secret'));
    await expect(service.extract(input('Why do I keep changing careers?'))).resolves.toEqual({
      status: 'NOT_AUTHORIZED', reason: 'PROVIDER_FAILED',
    });
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });

  it('mechanically bounds the reused Evidence projection without another read', async () => {
    const large = { ...evidence, statement: 'x'.repeat(2_000) };
    provider.extract.mockResolvedValue({ problemText: 'changing careers', domain: 'WORK', selectedEvidenceIds: [evidenceId] });
    await service.extract({ ...input('Why do I keep changing careers?'), eligibleEvidence: [large] });
    expect([...provider.extract.mock.calls[0][0].eligibleEvidence[0].statement]).toHaveLength(1_000);
  });
});
