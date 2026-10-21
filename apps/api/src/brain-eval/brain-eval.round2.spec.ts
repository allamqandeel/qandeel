import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { SAFETY_HUMOUR_SUSPENSION_LINE } from '../interaction-preferences/interaction-preference-guidance';
import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import {
  assertGuidanceMatchesLabel, attemptKey, caseRepeats, currentMessageOf, deepSeekEvaluationRequest, plannedAttempts, replyShape, runDeepSeekEvaluation,
  summarizeDeepSeekRun, type DeepSeekEvaluationResult,
} from './brain-eval.deepseek';
import { GOLDEN_EXTENDED_SUITE } from './brain-eval.golden-extended.suite';
import {
  GOLDEN_ROUND2_PATH_SUITE, GOLDEN_ROUND2_SUITE, pathComparisonStem, ROUND2_NEW_CASES, ROUND2_REFERENCED_CASE_IDS,
} from './brain-eval.golden-round2.suite';
import {
  BLOCKING_FAILURES, createBlindPacket, guidanceGroups, NO_REPLY, pathGroups, PERSONALITY_QUALITY, renderBlindPacketMarkdown, reviewAids,
  reviewForm, summarizeBlindReview, xIsA,
} from './brain-eval.round2-review';
import { DEEPSEEK_EVALUATION_SUITES, EVALUATION_SUITES, resolveDeepSeekEvaluationSuite } from './brain-eval.suites';
import type { BrainEvaluationCase } from './brain-eval.types';
import { validateGoldenPathPairSuite, validateGoldenTargetedSuite } from './brain-eval.validation';

// S8A-02 Round 2 (Product Owner decision, 2026-10-21) — zero-call proofs of the Round 2 tooling. No provider is constructed.

const SALT = 'round2-test-salt-0123456789abcdef';
const caseById = (id: string) => GOLDEN_ROUND2_SUITE.find((testCase) => testCase.id === id)!;

function result(testCase: BrainEvaluationCase, label: DeepSeekEvaluationResult['label'], repeat: number, response: string | null): DeepSeekEvaluationResult {
  return {
    caseId: testCase.id, label, repeat, world: testCase.world?.kind ?? 'PERSONAL', path: testCase.path, productionRoute: 'FAST',
    productionRouteReason: 'r', latencyBudgetMs: 3000, latencyMs: 4321, inputTokens: response === null ? null : 1500, outputTokens: response === null ? null : 70,
    success: response !== null, response: response ?? '', shape: response === null ? null : replyShape(response),
    ...(response === null ? { error: 'Provider generation failed.' } : {}),
  };
}

describe('S8A-02 Round 2 — targeted suites, repeats and the blinded set review (zero calls)', () => {
  it('references 19 Round 1 cases unchanged and adds 11, validated per case without a coverage quota', () => {
    expect(GOLDEN_ROUND2_SUITE).toHaveLength(30);
    expect(ROUND2_NEW_CASES).toHaveLength(11);
    for (const id of ROUND2_REFERENCED_CASE_IDS) expect(caseById(id)).toBe(GOLDEN_EXTENDED_SUITE.find((testCase) => testCase.id === id));
    expect(validateGoldenTargetedSuite(GOLDEN_ROUND2_SUITE)).toMatchObject({ caseCount: 30, expectedPaidRequests: 30 });
    expect(Object.keys(EVALUATION_SUITES)).toEqual(['brain-bakeoff', 'golden-conversations']);
  });

  it('labels every new case with the path production routing chooses, and no current message is a durable preference command', () => {
    for (const testCase of ROUND2_NEW_CASES) {
      expect([testCase.id, decideFastDeepRoute(currentMessageOf(testCase)).path]).toEqual([testCase.id, testCase.path]);
      expect(interpretInteractionPreferenceCommand(currentMessageOf(testCase))).toBeNull();
    }
  });

  it('runs the Shared and Public Safety cases as GUIDED, with the approved humour suspension in their guidance', () => {
    for (const id of ['fast-golden-shared-guided', 'fast-golden-public-guided']) {
      const testCase = caseById(id);
      expect(testCase.safety).toBe('GUIDED');
      expect(deepSeekEvaluationRequest(testCase).behavioralGuidance.endsWith(SAFETY_HUMOUR_SUSPENSION_LINE)).toBe(true);
    }
    expect(caseById('fast-golden-pref-gulf-ar').interactionPreferences?.replyLanguage).toBe('GULF_ARABIC');
  });

  it('declares each short complex decision once on FAST and once on DEEP with identical content, all routed FAST today', () => {
    expect(GOLDEN_ROUND2_PATH_SUITE).toHaveLength(12);
    expect(validateGoldenPathPairSuite(GOLDEN_ROUND2_PATH_SUITE)).toMatchObject({ caseCount: 12, fastCount: 6, deepCount: 6, expectedPaidRequests: 12 });
    for (const testCase of GOLDEN_ROUND2_PATH_SUITE) expect(decideFastDeepRoute(currentMessageOf(testCase)).path).toBe('FAST');
    const [fast, deep] = GOLDEN_ROUND2_PATH_SUITE;
    expect(pathComparisonStem(fast.id)).toBe(pathComparisonStem(deep.id));
    const altered = GOLDEN_ROUND2_PATH_SUITE.map((testCase) => (testCase === deep ? { ...deep, context: [{ role: 'USER' as const, content: 'different' }] } : testCase));
    expect(() => validateGoldenPathPairSuite(altered)).toThrow();
    expect(() => validateGoldenPathPairSuite(GOLDEN_ROUND2_PATH_SUITE.slice(1))).toThrow();
  });

  it('fixes repeats, labels and round in the registry, and plans 200 attempts: exactly the 200-attempt cap, no retries', () => {
    const round2 = resolveDeepSeekEvaluationSuite('golden-round2');
    const paths = resolveDeepSeekEvaluationSuite('golden-round2-paths');
    expect(round2).toMatchObject({ repeats: 3, labels: ['core-v2', 'core-v3'], round: 2, comparison: 'GUIDANCE' });
    expect(paths).toMatchObject({ repeats: 2, labels: ['core-v3'], round: 2, comparison: 'PATHS' });
    const planned = plannedAttempts(round2.cases, round2.repeats) * round2.labels.length + plannedAttempts(paths.cases, paths.repeats) * paths.labels.length;
    expect([plannedAttempts(round2.cases, round2.repeats), plannedAttempts(paths.cases, paths.repeats)]).toEqual([88, 24]);
    expect(planned).toBe(200);
    expect(planned).toBeLessThanOrEqual(200);
    for (const name of ['brain-bakeoff', 'golden-conversations', 'golden-conversations-extended'] as const) {
      expect(DEEPSEEK_EVALUATION_SUITES[name]).toMatchObject({ repeats: 1, labels: ['baseline', 'candidate'], round: 1, comparison: 'GUIDANCE' });
    }
  });

  it('repeats round-robin with one evidence key per attempt, records a failure with unknown usage and never retries it', async () => {
    let call = 0;
    const router: ModelRouter = { generate: jest.fn(async (request: ModelRouterRequest) => {
      call += 1;
      if (call === 2) throw new Error('timeout');
      return { content: 'تمام', routingMetadata: { path: request.path }, usage: { inputTokens: 900, outputTokens: 20 } };
    }) };
    const keys: string[] = [];
    const cases = GOLDEN_ROUND2_SUITE.slice(0, 2);
    const results = await runDeepSeekEvaluation(cases, 'core-v2', { router, attribute: async (key, work) => { keys.push(key); return work(); } }, 3);
    expect(router.generate).toHaveBeenCalledTimes(6);
    expect(keys).toEqual([1, 2, 3].flatMap((repeat) => cases.map((testCase) => `${testCase.id}#${repeat}`)));
    expect(results.map((row) => [row.caseId, row.repeat])).toEqual([1, 2, 3].flatMap((repeat) => cases.map((testCase) => [testCase.id, repeat])));
    expect(results[1]).toMatchObject({ success: false, inputTokens: null, outputTokens: null, repeat: 1 });
    expect(summarizeDeepSeekRun(results)[cases[1].path]).toMatchObject({ failed: 1, usageUnknown: 1 });
    expect(attemptKey('x', 1, 1)).toBe('x');
    await expect(runDeepSeekEvaluation(cases, 'core-v2', { router, attribute: async (_key, work) => work() }, 4)).rejects.toThrow('1 to 3');
  });

  it('states R2-10 as a request for later replies, and runs its one-reply counterpart R2-11 once per version', async () => {
    expect(JSON.stringify(caseById('fast-golden-shared-english-request-owner').world)).toContain('for the rest of this conversation, not just this once');
    const counterpart = caseById('fast-golden-shared-one-reply-language-request');
    expect(JSON.stringify(counterpart.world)).toContain('المرة دي بس');
    expect([counterpart.world?.kind, counterpart.maxRepeats, caseRepeats(counterpart, 3)]).toEqual(['SHARED', 1, 1]);
    expect(GOLDEN_ROUND2_SUITE.filter((testCase) => testCase.maxRepeats !== undefined).map((testCase) => testCase.id)).toEqual([counterpart.id]);
    const router: ModelRouter = { generate: jest.fn(async (request: ModelRouterRequest) => ({ content: 'تمام', routingMetadata: { path: request.path }, usage: { inputTokens: 900, outputTokens: 20 } })) };
    const keys: string[] = [];
    const cases = [GOLDEN_ROUND2_SUITE[0], counterpart];
    await runDeepSeekEvaluation(cases, 'core-v2', { router, attribute: async (key, work) => { keys.push(key); return work(); } }, 3);
    expect(keys).toEqual([`${cases[0].id}#1`, `${counterpart.id}#1`, `${cases[0].id}#2`, `${cases[0].id}#3`]);
    expect(plannedAttempts(cases, 3)).toBe(4);
    expect(() => caseRepeats({ ...counterpart, maxRepeats: 0 }, 3)).toThrow('positive integer');
  });

  it('refuses a run whose label does not match the guidance this commit renders', () => {
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_SUITE, 'core-v2')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_PATH_SUITE, 'core-v2')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_SUITE, 'core-v3')).toThrow('not core-v3 for 30 case(s)');
    expect(() => assertGuidanceMatchesLabel(GOLDEN_ROUND2_SUITE, 'baseline')).not.toThrow();
  });

  it('blinds whole sets per item by a salted hash: every attempt and failure shown, no condition, path, latency or tokens', () => {
    const cases = GOLDEN_ROUND2_SUITE;
    const v2 = cases.flatMap((testCase) => [1, 2, 3].map((repeat) => result(testCase, 'core-v2', repeat, repeat === 2 ? null : `ردّ النسخة الأولى ${repeat}`)));
    const v3 = cases.flatMap((testCase) => [3, 1, 2].map((repeat) => result(testCase, 'core-v3', repeat, `ردّ النسخة الثانية ${repeat}`)));
    const { packet, labelMap } = createBlindPacket(guidanceGroups(cases, v2, v3), SALT);
    expect(createBlindPacket(guidanceGroups(cases, v2, v3), SALT)).toEqual({ packet, labelMap });
    expect(packet).toHaveLength(30);
    const serialized = JSON.stringify(packet) + renderBlindPacketMarkdown('t', packet);
    expect(serialized).not.toMatch(/core-v|"label"|latency|Tokens|productionRoute|"path"|4321|1500|baseline|candidate/u);
    expect(labelMap.salt).toBe(SALT);
    for (const item of packet) {
      const map = labelMap.items.find((entry) => entry.itemId === item.itemId)!;
      expect(map.X).toBe(xIsA(SALT, item.itemId) ? 'core-v2' : 'core-v3');
      const v2Set = map.X === 'core-v2' ? item.X : item.Y;
      const v3Set = map.X === 'core-v2' ? item.Y : item.X;
      expect(v2Set.map((reply) => reply.reply)).toEqual(['ردّ النسخة الأولى 1', null, 'ردّ النسخة الأولى 3']);
      expect(v2Set[1]).toMatchObject({ attempt: 2, failure: NO_REPLY, aids: null });
      expect(v3Set.map((reply) => reply.reply)).toEqual([1, 2, 3].map((repeat) => `ردّ النسخة الثانية ${repeat}`));
    }
    expect(new Set(labelMap.items.map((entry) => entry.X))).toEqual(new Set(['core-v2', 'core-v3']));
    expect(() => createBlindPacket([], 'short')).toThrow('salt');
    const guided = packet.find((item) => item.itemId === 'fast-golden-shared-guided')!;
    expect(guided).toMatchObject({ world: 'SHARED', safetyGuided: true, declaredPreferences: null });
  });

  it('pairs FAST and DEEP per message under ids that name no path', () => {
    const results = GOLDEN_ROUND2_PATH_SUITE.flatMap((testCase) => [1, 2].map((repeat) => result(testCase, 'core-v3', repeat, `${testCase.path === 'FAST' ? 'قصير' : 'مفصّل'} ${repeat}`)));
    const groups = pathGroups(GOLDEN_ROUND2_PATH_SUITE, results);
    expect(groups.map((group) => group.itemId)).toEqual(['alzheimer-care-ar-eg', 'medicine-engineering-ar-eg', 'pay-cut-en', 'emigration-ar-eg', 'two-offers-ar-eg', 'stable-job-project-ar-eg'].map((stem) => `pathcmp-${stem}`));
    const { packet, labelMap } = createBlindPacket(groups, SALT);
    expect(JSON.stringify(packet)).not.toMatch(/FAST|DEEP|fast-|deep-/u);
    for (const item of packet) {
      const map = labelMap.items.find((entry) => entry.itemId === item.itemId)!;
      expect(item[map.X === 'FAST' ? 'X' : 'Y'].map((reply) => reply.reply)).toEqual(['قصير 1', 'قصير 2']);
    }
  });

  it('flags form, gendered address, dialect markers and script for attention, scoring nothing', () => {
    const aids = reviewAids('**خلاصة**\nانتي تعبانة النهارده؟ وبدك ترتاحي شوي، ارتاحي. OK');
    expect(aids.markdown.bold).toBe(1);
    expect(aids.genderedAddress.feminine).toEqual(expect.arrayContaining(['انتي', 'تعبانة', 'ارتاحي']));
    expect(aids.genderedAddress.masculine).toEqual([]);
    expect(aids.dialectMarkers.LEVANTINE).toEqual(['بدك']);
    expect(aids.latinLetterShare).toBeGreaterThan(0);
    expect(reviewAids('هل أنت جاهز؟ وش رايك الحين').genderedAddress.masculine).toEqual(['جاهز']);
    expect(reviewAids('وش رايك الحين').dialectMarkers.GULF).toEqual(['وش', 'الحين']);
    expect(reviewAids('A plain reply.')).toMatchObject({ latinLetterShare: 1, endsWithQuestion: false, questionMarks: 0 });
  });

  it('un-blinds a completed form per condition: blocking failures summed, quality means without NA or blanks, preferences counted', () => {
    const cases = GOLDEN_ROUND2_SUITE.slice(0, 2);
    const v2 = cases.map((testCase) => result(testCase, 'core-v2', 1, 'أ'));
    const v3 = cases.map((testCase) => result(testCase, 'core-v3', 1, 'ب'));
    const { packet, labelMap } = createBlindPacket(guidanceGroups(cases, v2, v3), SALT);
    const form = reviewForm(packet);
    expect(Object.keys(form[0].X.blocking)).toEqual([...BLOCKING_FAILURES]);
    expect(Object.keys(form[0].X.quality)).toEqual([...PERSONALITY_QUALITY]);
    for (const item of form) {
      const v3Side = labelMap.items.find((entry) => entry.itemId === item.itemId)!.X === 'core-v3' ? 'X' : 'Y';
      const v2Side = v3Side === 'X' ? 'Y' : 'X';
      item[v2Side].blocking.INVENTED_FACT = 1;
      item[v2Side].quality.NATURALNESS = 2;
      item[v3Side].quality.NATURALNESS = 4;
      item[v3Side].quality.FITTING_HUMOUR = 'NA';
      item[v3Side].readsAsQandeel = 'QANDEEL';
      item.preference = v3Side;
    }
    const summary = summarizeBlindReview(form, labelMap);
    expect(summary.conditions['core-v2']).toMatchObject({ items: 2, preferred: 0, blockingFailures: { INVENTED_FACT: 2 }, qualityMeans: { NATURALNESS: 2 } });
    expect(summary.conditions['core-v3']).toMatchObject({
      items: 2, preferred: 2, readsAsQandeel: 2, blockingFailures: { INVENTED_FACT: 0 }, qualityMeans: { NATURALNESS: 4, FITTING_HUMOUR: null },
      qualityRated: { FITTING_HUMOUR: 0 },
    });
    expect(summary).toMatchObject({ equalPreference: 0, unratedPreference: 0 });
    expect(() => summarizeBlindReview([{ ...form[0], itemId: 'unknown' }], labelMap)).toThrow('no entry');
  });
});
