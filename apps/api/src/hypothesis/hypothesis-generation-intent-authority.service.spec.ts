import type { EvidenceItem } from '../memory/evidence.types';
import { HYPOTHESIS_DOMAINS, MAX_STATEMENT_LENGTH, type HypothesisDomain } from './hypothesis.types';
import { HypothesisGenerationIntentAuthorityService } from './hypothesis-generation-intent-authority.service';
import type {
  HypothesisGenerationIntentAuthorityInput,
  HypothesisGenerationIntentCandidate,
} from './hypothesis-generation-intent-authority.types';

describe('HypothesisGenerationIntentAuthorityService', () => {
  const turnId = '10000000-0000-4000-8000-000000000001';
  const sessionId = '20000000-0000-4000-8000-000000000002';
  const text = 'I do not understand why I pull away every time someone gets close.';
  const service = new HypothesisGenerationIntentAuthorityService();

  const evidence = (index: number): EvidenceItem => {
    const id = `30000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
    return {
      evidenceId: `memory:${id}`,
      evidenceKind: 'USER_STATED_FACT',
      memoryType: 'PERSONAL_FACT',
      statement: `fact ${index}`,
      source: 'USER_STATED',
      confidence: 1,
      importance: 0.5,
      observedAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
      originatingMemoryId: id,
    };
  };

  const candidate = (change: Partial<HypothesisGenerationIntentCandidate> = {}): HypothesisGenerationIntentCandidate => ({
    problem: { text: 'why I pull away every time someone gets close', source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
    domain: 'RELATIONSHIP',
    scope: { kind: 'CONVERSATION_SESSION', sessionId },
    evidenceIds: [evidence(1).evidenceId],
    ...change,
  });

  const input = (
    proposed = candidate(),
    universe: ReadonlyArray<EvidenceItem> = [evidence(1)],
    turnText = text,
  ): HypothesisGenerationIntentAuthorityInput => ({
    eligibility: { status: 'ELIGIBLE', reason: 'TRIGGER_AND_EVIDENCE_AVAILABLE' },
    currentTurn: { id: turnId, sessionId, role: 'USER', status: 'COMPLETED', text: turnText },
    eligibleEvidenceUniverse: universe,
    candidate: proposed,
  });

  it('authorizes an exact normalized English extract with canonical session scope', () => {
    const result = service.authorize(input(candidate({
      problem: { text: '  why I pull away   every time someone gets close  ', source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
    })));
    expect(result).toEqual({
      status: 'AUTHORIZED',
      intent: {
        problem: { text: 'why I pull away every time someone gets close', source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
        domain: 'RELATIONSHIP',
        scope: { kind: 'CONVERSATION_SESSION', sessionId, serialized: `CONVERSATION_SESSION:${sessionId}` },
        evidenceIds: [evidence(1).evidenceId],
      },
    });
  });

  it('authorizes an extractively grounded Egyptian Arabic span', () => {
    const arabic = 'مش فاهم ليه كل مرة حد يقرب مني ببعد عنه';
    expect(service.authorize(input(candidate({
      problem: { text: 'كل مرة حد يقرب مني ببعد عنه', source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
    }), [evidence(1)], arabic))).toMatchObject({ status: 'AUTHORIZED' });
  });

  it.each([
    ['Fear of emotional commitment', 'PROBLEM_NOT_GROUNDED'],
    ['', 'INVALID_CANDIDATE'],
    ['general', 'INVALID_CANDIDATE'],
  ])('rejects an ungrounded, empty, or generic problem: %s', (problem, reason) => {
    expect(service.authorize(input(candidate({ problem: { text: problem, source: 'CURRENT_USER_TURN', sourceTurnId: turnId } })))).toEqual({ status: 'NOT_AUTHORIZED', reason });
  });

  it('rejects an over-bound problem without truncating it', () => {
    const over = 'x'.repeat(MAX_STATEMENT_LENGTH + 1);
    expect(service.authorize(input(candidate({ problem: { text: over, source: 'CURRENT_USER_TURN', sourceTurnId: turnId } }), [evidence(1)], over))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'INPUT_BOUND_EXCEEDED' });
  });

  it('rejects problem provenance from another turn', () => {
    expect(service.authorize(input(candidate({
      problem: { text: 'why I pull away', source: 'CURRENT_USER_TURN', sourceTurnId: '10000000-0000-4000-8000-000000000009' },
    })))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'TURN_PROVENANCE_MISMATCH' });
  });

  it.each(HYPOTHESIS_DOMAINS)('accepts canonical domain %s without fallback or reinterpretation', (domain) => {
    expect(service.authorize(input(candidate({ domain })))).toMatchObject({ status: 'AUTHORIZED', intent: { domain } });
  });

  it('rejects custom domain values', () => {
    expect(service.authorize(input(candidate({ domain: 'HEALTH' as HypothesisDomain })))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'INVALID_DOMAIN' });
  });

  it('rejects wrong-session and non-session scope authority', () => {
    expect(service.authorize(input(candidate({ scope: { kind: 'CONVERSATION_SESSION', sessionId: '20000000-0000-4000-8000-000000000009' } })))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'SESSION_PROVENANCE_MISMATCH' });
    expect(service.authorize(input(candidate({ scope: { kind: 'GLOBAL' as never, sessionId } })))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'INVALID_SCOPE_AUTHORITY' });
  });

  it('accepts one through eight Evidence IDs and canonicalizes them to universe order', () => {
    const universe = Array.from({ length: 8 }, (_, index) => evidence(index + 1));
    expect(service.authorize(input(candidate({ evidenceIds: [universe[2].evidenceId, universe[0].evidenceId] }), universe))).toMatchObject({
      status: 'AUTHORIZED', intent: { evidenceIds: [universe[0].evidenceId, universe[2].evidenceId] },
    });
    expect(service.authorize(input(candidate({ evidenceIds: universe.map((item) => item.evidenceId) }), universe))).toMatchObject({ status: 'AUTHORIZED' });
  });

  it.each([
    [[], 'NO_SELECTED_EVIDENCE'],
    [[evidence(1).evidenceId, evidence(1).evidenceId], 'DUPLICATE_EVIDENCE'],
    [[evidence(9).evidenceId], 'EVIDENCE_OUT_OF_UNIVERSE'],
  ] as const)('rejects malformed Evidence selection %#', (evidenceIds, reason) => {
    expect(service.authorize(input(candidate({ evidenceIds: [...evidenceIds] })))).toEqual({ status: 'NOT_AUTHORIZED', reason });
  });

  it('rejects nine selected Evidence IDs and malformed canonical universe provenance', () => {
    const universe = Array.from({ length: 9 }, (_, index) => evidence(index + 1));
    expect(service.authorize(input(candidate({ evidenceIds: universe.map((item) => item.evidenceId) }), universe))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'TOO_MANY_SELECTED_EVIDENCE' });
    expect(service.authorize(input(candidate(), [{ ...evidence(1), originatingMemoryId: '30000000-0000-4000-8000-000000000009' }]))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'EVIDENCE_UNIVERSE_INVALID' });
  });

  it('is deterministic, dependency-free, non-persistent, and returns no forbidden semantic fields', () => {
    const first = service.authorize(input());
    expect(service.authorize(input())).toEqual(first);
    expect(HypothesisGenerationIntentAuthorityService.length).toBe(0);
    expect(JSON.stringify(first)).not.toMatch(/supporting|contradicting|confidence|probability|diagnosis|personality|motive|question|provider|hypothesisType|HIM/i);
  });

  it('rejects candidates with provider payload or extra schema fields', () => {
    const proposed = { ...candidate(), providerPayload: { hidden: true } };
    expect(service.authorize(input(proposed as never))).toEqual({ status: 'NOT_AUTHORIZED', reason: 'INVALID_CANDIDATE' });
  });
});
