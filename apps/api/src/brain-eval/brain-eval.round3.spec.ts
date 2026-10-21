import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { assertGuidanceMatchesLabel, currentMessageOf, plannedAttempts, replyShape, type DeepSeekEvaluationResult } from './brain-eval.deepseek';
import { GOLDEN_ROUND2_SUITE } from './brain-eval.golden-round2.suite';
import {
  GOLDEN_ROUND3_PERSONALITY_SUITE, GOLDEN_ROUND3_SHARED_SUITE, ROUND3_NEW_CASES, ROUND3_PERSONALITY_NEW_CASES, ROUND3_PERSONALITY_REFERENCED_CASE_IDS,
  ROUND3_REFERENCED_CASE_IDS,
} from './brain-eval.golden-round3.suite';
import { completionReport, createBlindPacket, guidanceGroups, ROUND3_MINIMUM_REPLIES } from './brain-eval.round2-review';
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

  it('plans 36 + 42 = 78 attempts for Parts A and B, within the one 80-attempt Round 3 guard, core v3 against core v3.1', () => {
    const [partA, partB] = [resolveDeepSeekEvaluationSuite('golden-round3-shared'), resolveDeepSeekEvaluationSuite('golden-round3-personality')];
    for (const suite of [partA, partB]) expect(suite).toMatchObject({ repeats: 3, labels: ['core-v3', 'core-v3.1'], round: 3, comparison: 'GUIDANCE' });
    const attempts = (suite: typeof partA) => plannedAttempts(suite.cases, suite.repeats) * suite.labels.length;
    expect([attempts(partA), attempts(partB)]).toEqual([36, 42]);
    expect(attempts(partA) + attempts(partB)).toBeLessThanOrEqual(80);
  });

  it('Part B holds five Round 2 cases unchanged and two new ones, each on the path production would choose or declared DEEP', () => {
    expect(GOLDEN_ROUND3_PERSONALITY_SUITE).toHaveLength(7);
    for (const id of ROUND3_PERSONALITY_REFERENCED_CASE_IDS) {
      expect(GOLDEN_ROUND3_PERSONALITY_SUITE.find((testCase) => testCase.id === id)).toBe(GOLDEN_ROUND2_SUITE.find((testCase) => testCase.id === id));
    }
    expect(validateGoldenFocusedSuite(GOLDEN_ROUND3_PERSONALITY_SUITE)).toMatchObject({ caseCount: 7, fastCount: 4, deepCount: 3 });
    const [caregiving, briefComplex] = ROUND3_PERSONALITY_NEW_CASES;
    expect(decideFastDeepRoute(currentMessageOf(caregiving)).path).toBe('FAST');
    const complex = GOLDEN_ROUND2_SUITE.find((testCase) => testCase.id === 'deep-golden-complex-decision-ar-eg')!;
    expect(briefComplex.context).toEqual(complex.context);
    expect([complex.interactionPreferences?.replyLength ?? 'DEFAULT', briefComplex.interactionPreferences?.replyLength]).toEqual(['DEFAULT', 'ALWAYS_BRIEF']);
    // Core v3.1 is rendered since the Round 3 copy commit; arm A (core-v3) runs from the tooling commit before it.
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_PERSONALITY_SUITE, 'core-v3.1')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_PERSONALITY_SUITE, 'core-v3')).toThrow('not core-v3 for 7 case(s)');
  });

  it('counts attempts with no reply apart, judges them neither way, and marks an item INCONCLUSIVE below the minimum replies', () => {
    const testCase = GOLDEN_ROUND3_SHARED_SUITE[0];
    const failed = (label: DeepSeekEvaluationResult['label'], repeat: number): DeepSeekEvaluationResult => ({ ...result(testCase, label, repeat), success: false, response: '', shape: null, error: 'FAST time budget exceeded' });
    const first = [result(testCase, 'core-v3', 1), failed('core-v3', 2), result(testCase, 'core-v3', 3)];
    const second = [failed('core-v3.1', 1), failed('core-v3.1', 2), result(testCase, 'core-v3.1', 3)];
    const report = completionReport(guidanceGroups([testCase], first, second, ['core-v3', 'core-v3.1']), ROUND3_MINIMUM_REPLIES);
    expect(ROUND3_MINIMUM_REPLIES).toBe(2);
    expect(report.inconclusiveItems).toEqual([testCase.id]);
    expect(report.items[0]).toMatchObject({
      verdict: 'INCONCLUSIVE',
      'core-v3': { attempts: 3, replies: 2, noReply: 1, failureReasons: ['FAST time budget exceeded'] },
      'core-v3.1': { attempts: 3, replies: 1, noReply: 2 },
    });
    const { packet } = createBlindPacket(guidanceGroups([testCase], first, second, ['core-v3', 'core-v3.1']), 'round3-test-salt-0123456789');
    expect([...packet[0].X, ...packet[0].Y].filter((reply) => reply.reply === null)).toHaveLength(3);
    expect(() => completionReport([], 0)).toThrow('positive integer');
  });

  it('runs core-v3.1 at this commit, which renders it, and refuses core-v3, whose arm runs from the tooling commit', () => {
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_SHARED_SUITE, 'core-v3.1')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND3_SHARED_SUITE, 'core-v3')).toThrow('not core-v3 for 6 case(s)');
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_SUITE, 'core-v3.1')).not.toThrow();
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
