import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { assertGuidanceMatchesLabel, currentMessageOf, plannedAttempts, replyShape, type DeepSeekEvaluationResult } from './brain-eval.deepseek';
import { GOLDEN_ROUND2_SUITE } from './brain-eval.golden-round2.suite';
import { GOLDEN_ROUND3_SHARED_SUITE, ROUND3_NEW_CASES, ROUND3_REFERENCED_CASE_IDS } from './brain-eval.golden-round3.suite';
import { createBlindPacket, guidanceGroups } from './brain-eval.round2-review';
import { resolveDeepSeekEvaluationSuite } from './brain-eval.suites';
import type { BrainEvaluationCase } from './brain-eval.types';
import { validateGoldenFocusedSuite } from './brain-eval.validation';

// S8A-02 Round 3 (Product Owner review of Round 2, 2026-10-21) — zero-call proofs of the focused Shared language
// comparison. No provider is constructed; nothing here authorizes a paid run.

const result = (testCase: BrainEvaluationCase, label: DeepSeekEvaluationResult['label'], repeat: number): DeepSeekEvaluationResult => ({
  caseId: testCase.id, label, repeat, world: 'SHARED', path: 'FAST', productionRoute: 'FAST', productionRouteReason: 'r', latencyBudgetMs: 3000,
  latencyMs: 1200, inputTokens: 1500, outputTokens: 60, success: true, response: `reply ${label === 'core-v3' ? 'first' : 'second'} ${repeat}`, shape: replyShape('reply'),
});

describe('S8A-02 Round 3 — the focused Shared language comparison (zero calls)', () => {
  it('holds the three Round 2 conversations unchanged (bar the Round 2 single-repeat limit) and one new conversation per rule', () => {
    expect(GOLDEN_ROUND3_SHARED_SUITE).toHaveLength(6);
    expect(ROUND3_NEW_CASES).toHaveLength(3);
    for (const id of ROUND3_REFERENCED_CASE_IDS) {
      const { maxRepeats: _limit, ...roundTwo } = GOLDEN_ROUND2_SUITE.find((testCase) => testCase.id === id)!;
      expect(GOLDEN_ROUND3_SHARED_SUITE.find((testCase) => testCase.id === id)).toEqual(roundTwo);
    }
    expect(GOLDEN_ROUND3_SHARED_SUITE.every((testCase) => testCase.maxRepeats === undefined && testCase.world?.kind === 'SHARED')).toBe(true);
    expect(validateGoldenFocusedSuite(GOLDEN_ROUND3_SHARED_SUITE)).toMatchObject({ caseCount: 6, fastCount: 6, deepCount: 0 });
    expect(() => validateGoldenFocusedSuite([...GOLDEN_ROUND3_SHARED_SUITE, GOLDEN_ROUND3_SHARED_SUITE[0]])).toThrow('Duplicate');
  });

  it('routes every case FAST as production does, and no current message is a durable preference command', () => {
    for (const testCase of GOLDEN_ROUND3_SHARED_SUITE) {
      expect([testCase.id, decideFastDeepRoute(currentMessageOf(testCase)).path]).toEqual([testCase.id, 'FAST']);
      expect(interpretInteractionPreferenceCommand(currentMessageOf(testCase))).toBeNull();
    }
  });

  it('plans 36 attempts within its own 40-attempt round, with core v3 against core v3.1', () => {
    const suite = resolveDeepSeekEvaluationSuite('golden-round3-shared');
    expect(suite).toMatchObject({ repeats: 3, labels: ['core-v3', 'core-v3.1'], round: 3, comparison: 'GUIDANCE' });
    expect(plannedAttempts(suite.cases, suite.repeats) * suite.labels.length).toBe(36);
  });

  it('runs core-v3 at this commit and refuses core-v3.1 until the revised world-neutral paragraph 3 is rendered', () => {
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_SHARED_SUITE, 'core-v3')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_SHARED_SUITE, 'core-v3.1')).toThrow('not core-v3.1 for 6 case(s)');
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_SUITE, 'core-v3')).not.toThrow();
  });

  it('blinds the two labels of the suite, whatever they are', () => {
    const cases = GOLDEN_ROUND3_SHARED_SUITE;
    const first = cases.flatMap((testCase) => [1, 2, 3].map((repeat) => result(testCase, 'core-v3', repeat)));
    const second = cases.flatMap((testCase) => [1, 2, 3].map((repeat) => result(testCase, 'core-v3.1', repeat)));
    const { packet, labelMap } = createBlindPacket(guidanceGroups(cases, first, second, ['core-v3', 'core-v3.1']), 'round3-test-salt-0123456789');
    expect(packet).toHaveLength(6);
    expect(JSON.stringify(packet)).not.toMatch(/core-v/u);
    expect(new Set(labelMap.items.flatMap((item) => [item.X, item.Y]))).toEqual(new Set(['core-v3', 'core-v3.1']));
  });
});
