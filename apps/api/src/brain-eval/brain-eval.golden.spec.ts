import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { AMBIGUOUS_SAFETY_GUIDANCE } from '../conversation/safety-response-gate.service';
import { SAFETY_HUMOUR_SUSPENSION_LINE } from '../interaction-preferences/interaction-preference-guidance';
import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
import { createReviewArtifacts, expectedRequestCount, runEvaluation } from './brain-eval.harness';
import { GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY, EVALUATION_ARTIFACT_DIRECTORY } from './brain-eval.paths';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import { BRAIN_EVALUATION_SUITE } from './brain-eval.suite';
import { DEFAULT_EVALUATION_SUITE, EVALUATION_SUITES, resolveEvaluationSuite } from './brain-eval.suites';
import { summarizeResults } from './brain-eval.summary';
import { GOLDEN_CONVERSATION_RUBRIC, GOLDEN_CONVERSATION_STYLE_RUBRIC, RUBRIC, STYLE_FOCUS, type BrainEvaluationCase } from './brain-eval.types';
import { validateEvaluationSuite, validateGoldenConversationSuite } from './brain-eval.validation';

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const result = { content: 'synthetic response', routingMetadata: { path: 'FAST' as const }, usage: { inputTokens: 40, outputTokens: 10 } };
const router = (requests: ModelRouterRequest[]): ModelRouter => ({ generate: jest.fn(async (request) => { requests.push(request); return { ...result, routingMetadata: { path: request.path } }; }) });
const golden = (id: string) => GOLDEN_CONVERSATION_SUITE.find((testCase) => testCase.id === id)!;
const replace = (id: string, over: Partial<BrainEvaluationCase>) => GOLDEN_CONVERSATION_SUITE.map((testCase) => testCase.id === id ? { ...testCase, ...over } : testCase);

describe('ACE-01 WP3 — Golden Conversations, the second named suite of the ONE brain-eval system', () => {
  it('keeps the original Brain Bake-off suite, rubric and validator exactly as they were', () => {
    expect(BRAIN_EVALUATION_SUITE).toHaveLength(24);
    expect(sha256(BRAIN_EVALUATION_SUITE)).toBe('ff55017a0e028be59b035adcb7ca4c560a3da04debb4d6121455b0c7ef83067c');
    expect(sha256(RUBRIC)).toBe('9654fee09da93d2686d1a893d697987deca7436604566ff36c431c83b45d9e0a');
    expect(BRAIN_EVALUATION_SUITE.some((testCase) => testCase.styleFocus || testCase.interactionPreferences || testCase.safety)).toBe(false);
    expect(validateEvaluationSuite(BRAIN_EVALUATION_SUITE).expectedPaidRequests).toBe(48);
    expect(DEFAULT_EVALUATION_SUITE).toBe('brain-bakeoff');
    expect(resolveEvaluationSuite(undefined)).toMatchObject({ name: 'brain-bakeoff', cases: BRAIN_EVALUATION_SUITE, rubric: RUBRIC, artifactDirectory: EVALUATION_ARTIFACT_DIRECTORY });
    // The 20–30 bound is unchanged and applies to the Golden suite too.
    expect(() => validateEvaluationSuite(GOLDEN_CONVERSATION_SUITE.slice(0, 19))).toThrow('20-30 cases');
  });

  it('validates the Golden suite structurally, deterministically and with ZERO provider calls', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network'); });
    try {
      const report = validateGoldenConversationSuite(GOLDEN_CONVERSATION_SUITE);
      expect(report).toMatchObject({ caseCount: 22, fastCount: 12, deepCount: 10, expectedPaidRequests: 44 });
      expect(expectedRequestCount(GOLDEN_CONVERSATION_SUITE)).toBe(44);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
    // The CLI path selects the suite; validation and dry-run never construct a provider client.
    expect(resolveEvaluationSuite('golden-conversations')).toMatchObject({ cases: GOLDEN_CONVERSATION_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY });
    expect(() => resolveEvaluationSuite('deepseek')).toThrow('Unknown evaluation suite');
    const validation = readFileSync(join(__dirname, 'brain-eval.validation.ts'), 'utf8');
    expect(validation).not.toMatch(/fromEnvironment|new (?:Claude|OpenAI)ModelRouter/u);
    expect(Object.keys(EVALUATION_SUITES)).toEqual(['brain-bakeoff', 'golden-conversations']);
  });

  it('covers the twelve measurement items with synthetic cases, explicit negative controls and the four approved style dimensions', () => {
    const covered = new Set(GOLDEN_CONVERSATION_SUITE.flatMap((testCase) => testCase.styleFocus ?? []));
    expect([...covered].sort()).toEqual([...STYLE_FOCUS].sort());
    const negative = GOLDEN_CONVERSATION_SUITE.filter((testCase) => testCase.styleFocus?.includes('NEGATIVE_CONTROL'));
    expect(negative.length).toBeGreaterThanOrEqual(6);
    expect(negative.every((testCase) => testCase.reviewNotes.some((note) => note.startsWith('FAIL if ')))).toBe(true);
    expect(GOLDEN_CONVERSATION_RUBRIC).toEqual([...RUBRIC, ...GOLDEN_CONVERSATION_STYLE_RUBRIC]);
    expect(GOLDEN_CONVERSATION_STYLE_RUBRIC).toEqual([
      'Register fit (warm / serious / playful / direct as the moment asks)',
      'Personality consistency across the conversation',
      'Humour initiative: fitting when present, absent where it must be',
      'Adherence to declared preferences',
    ]);
    // Arabic (several dialects) and English, FAST and DEEP; the approved scenario wording is kept.
    expect(new Set(GOLDEN_CONVERSATION_SUITE.map(({ locale }) => locale))).toEqual(new Set(['ar', 'en']));
    expect(golden('deep-golden-unfit-tone-ar-eg').context).toEqual([{ role: 'USER', content: 'اتخانقت مع جوزي وهو مشي من البيت' }]);
    expect(golden('fast-golden-levantine-ar').context.at(-1)?.content).toBe('شو رأيك أعمل بهاد الوضع؟');
  });

  it('declared preferences are canonical authority rendered as production renders them, never a line of dialogue', async () => {
    const policy = new BehavioralResponsePolicyService();
    const requests: ModelRouterRequest[] = [];
    const cases = [golden('deep-golden-declared-brevity-ar-eg'), golden('fast-golden-declared-no-humour-ar-eg'), golden('fast-golden-everyday-ar-eg')];
    await runEvaluation(cases, { ANTHROPIC: router(requests), OPENAI: router([]) });
    expect(requests[0].behavioralGuidance).toBe(policy.buildTextGuidance({ preferences: { ...DEFAULT_INTERACTION_PREFERENCES, replyLength: 'ALWAYS_BRIEF' }, safetyGuided: false }));
    // S8A-02 CP3 correction (Product Owner, 2026-10-22): the v2 brevity line.
    expect(requests[0].behavioralGuidance).toContain('- Reply length: keep every reply brief, even on a complex question: give your answer and only the points that matter most, in a few sentences.');
    expect(requests[1].behavioralGuidance).toContain('- Humour: do not use humour.');
    expect(requests[2].behavioralGuidance).toBe(policy.buildTextGuidance());
    // The old dialogue line is not used as a stand-in.
    expect(JSON.stringify(cases.map(({ context }) => context))).not.toMatch(/دايمًا|من غير هزار معايا/u);
    // A DECLARED_PREFERENCES case without a canonical value, or a canonical value without the tag, is refused.
    expect(() => validateGoldenConversationSuite(replace('deep-golden-declared-brevity-ar-eg', { interactionPreferences: undefined }))).toThrow('DECLARED_PREFERENCES');
    expect(() => validateGoldenConversationSuite(replace('fast-golden-everyday-ar-eg', { interactionPreferences: { ...DEFAULT_INTERACTION_PREFERENCES, humour: 'WELCOME' } }))).toThrow('DECLARED_PREFERENCES');
    expect(() => validateGoldenConversationSuite(replace('deep-golden-declared-brevity-ar-eg', { interactionPreferences: { ...DEFAULT_INTERACTION_PREFERENCES, replyLength: 'ALWAYS_LONG' as never } }))).toThrow('non-canonical');
  });

  it('the GUIDED case carries the production Safety guidance and the humour suspension; a mislabelled case is refused', async () => {
    const requests: ModelRouterRequest[] = [];
    await runEvaluation([golden('fast-golden-guided-humour-ar-eg')], { ANTHROPIC: router(requests), OPENAI: router([]) });
    expect(requests[0].safetyGuidance).toBe(AMBIGUOUS_SAFETY_GUIDANCE);
    expect(requests[0].behavioralGuidance.endsWith(`\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`)).toBe(true);
    expect(() => validateGoldenConversationSuite(replace('fast-golden-everyday-ar-eg', { safety: 'GUIDED' }))).toThrow('production Safety gate');
    expect(() => validateGoldenConversationSuite(replace('fast-golden-guided-humour-ar-eg', { safety: undefined }))).toThrow('production Safety gate');
  });

  it('refuses a negative control without a FAIL condition, a missing focus, a hand-picked locale and a non-Golden id', () => {
    expect(() => validateGoldenConversationSuite(replace('deep-golden-unfit-tone-ar-eg', { reviewNotes: ['Steady'] }))).toThrow('explicit FAIL condition');
    expect(() => validateGoldenConversationSuite(GOLDEN_CONVERSATION_SUITE.map((testCase) => ({ ...testCase, styleFocus: testCase.styleFocus?.filter((focus) => focus !== 'DISAGREEMENT').concat(testCase.styleFocus.length === 1 ? ['NATURALNESS'] : []) })))).toThrow('does not cover: DISAGREEMENT');
    expect(() => validateGoldenConversationSuite(replace('fast-golden-levantine-ar', { locale: 'en' }))).toThrow('production locale');
    expect(() => validateGoldenConversationSuite(replace('fast-golden-levantine-ar', { styleFocus: [] }))).toThrow('styleFocus');
    expect(() => validateGoldenConversationSuite(replace('fast-golden-levantine-ar', { id: 'fast-levantine' }))).toThrow('Golden case id');
  });

  it('blinded review: thirteen dimensions, the explicit unfit-register FAIL mark, the authority shown, no model identity', async () => {
    const cases = GOLDEN_CONVERSATION_SUITE.slice(0, 3);
    const results = await runEvaluation(cases, { ANTHROPIC: router([]), OPENAI: router([]) });
    const { blindedReview, providerMap } = createReviewArtifacts(cases, results, GOLDEN_CONVERSATION_RUBRIC);
    expect(Object.keys(blindedReview[0].scores)).toEqual([...GOLDEN_CONVERSATION_RUBRIC]);
    expect(blindedReview[0]).toMatchObject({ unfitRegisterFail: { A: null, B: null }, safetyGuided: false, declaredPreferences: DEFAULT_INTERACTION_PREFERENCES });
    expect(JSON.stringify(blindedReview)).not.toMatch(/ANTHROPIC|OPENAI|claude|gpt-/iu);
    expect(JSON.stringify(providerMap)).toMatch(/ANTHROPIC|OPENAI/u);
    // The original suite's artifact shape is unchanged.
    const bakeoff = createReviewArtifacts([BRAIN_EVALUATION_SUITE[0]], await runEvaluation([BRAIN_EVALUATION_SUITE[0]], { ANTHROPIC: router([]), OPENAI: router([]) }));
    expect(Object.keys(bakeoff.blindedReview[0])).toEqual(['caseId', 'path', 'context', 'reviewNotes', 'candidateA', 'candidateB', 'scores', 'overallPreference', 'reviewerNote']);
    // An unfit register marked by a reviewer is counted as an explicit failure; no invented score exists before review.
    const summary = summarizeResults(results, blindedReview.map((review, index) => ({ ...review, unfitRegisterFail: { A: index === 0, B: false } })));
    expect(summary.unfitRegisterFailures).toEqual({ cases: 3, A: 1, B: 0 });
    expect(summarizeResults(results, blindedReview).unfitRegisterFailures).toEqual({ cases: 3, A: 0, B: 0 });
    expect(Object.values(summarizeResults(results, blindedReview).rubricAverages).every(({ A, B }) => A === null && B === null)).toBe(true);
    expect('unfitRegisterFailures' in summarizeResults(results, bakeoff.blindedReview)).toBe(false);
  });
});
