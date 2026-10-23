import { createHash } from 'node:crypto';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { assemblePublicQandeelRequest } from '../public-world/public-qandeel-model-input';
import { assembleSharedConversationRequest } from '../shared-world/shared-conversation-model-input';
import {
  createGuidanceComparisonArtifacts, deepSeekEvaluationRequest, labelShownAsA, PERSONAL_REPLY_LATENCY_BUDGET_MS, replyShape,
  runDeepSeekEvaluation, summarizeDeepSeekRun, WORLD_REPLY_LATENCY_BUDGET_MS,
} from './brain-eval.deepseek';
import { GOLDEN_EXTENDED_SUITE, GOLDEN_SUPPLEMENT_CASES } from './brain-eval.golden-extended.suite';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import { candidateAProvider } from './brain-eval.harness';
import { GOLDEN_EXTENDED_ARTIFACT_DIRECTORY } from './brain-eval.paths';
import { EVALUATION_SUITES, resolveDeepSeekEvaluationSuite } from './brain-eval.suites';
import { GOLDEN_CONVERSATION_RUBRIC } from './brain-eval.types';
import { assertDeepSeekRunAllowed, validateGoldenConversationSuite } from './brain-eval.validation';

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const supplement = (id: string) => GOLDEN_SUPPLEMENT_CASES.find((testCase) => testCase.id === id)!;

describe('S8A-02 — the extended Golden suite and the DeepSeek-only path of the ONE brain-eval system', () => {
  it('extends the 22 Golden cases by reference, unchanged, with 8 supplementary cases validated by the same Golden validator', () => {
    expect(GOLDEN_CONVERSATION_SUITE).toHaveLength(22);
    expect(GOLDEN_EXTENDED_SUITE.slice(0, 22)).toEqual(GOLDEN_CONVERSATION_SUITE);
    expect(GOLDEN_EXTENDED_SUITE.slice(0, 22).every((testCase, index) => testCase === GOLDEN_CONVERSATION_SUITE[index])).toBe(true);
    expect(GOLDEN_SUPPLEMENT_CASES).toHaveLength(8);
    expect(Object.keys(EVALUATION_SUITES)).toEqual(['brain-bakeoff', 'golden-conversations']);
    expect(resolveDeepSeekEvaluationSuite('golden-conversations-extended')).toMatchObject({ cases: GOLDEN_EXTENDED_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_EXTENDED_ARTIFACT_DIRECTORY });
    expect(validateGoldenConversationSuite(GOLDEN_EXTENDED_SUITE)).toMatchObject({ caseCount: 30, fastCount: 18, deepCount: 12 });
  });

  it('declares, between the supplement and the Golden cases, every durable reply language and explanation style of IP-IMP-01', () => {
    const declared = GOLDEN_EXTENDED_SUITE.flatMap((testCase) => testCase.interactionPreferences ? [testCase.interactionPreferences] : []);
    expect(new Set(declared.map((preferences) => preferences.replyLanguage))).toEqual(new Set(['DEFAULT', 'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'ENGLISH', 'MAGHREBI_ARABIC', 'EGYPTIAN_ARABIC']));
    expect(new Set(declared.map((preferences) => preferences.explanationStyle))).toEqual(new Set(['DEFAULT', 'DIRECT', 'SIMPLER', 'SIMPLER_AND_DIRECT']));
    expect(new Set(declared.map((preferences) => preferences.humour))).toEqual(new Set(['DEFAULT', 'WELCOME', 'DECLINED']));
    // GULF_ARABIC as a durable preference is not in round one; it is recorded for the targeted round, never claimed.
    expect(declared.some((preferences) => preferences.replyLanguage === 'GULF_ARABIC')).toBe(false);
  });

  it('labels every supplementary case with the path production routing chooses, and no message is a durable preference command', () => {
    for (const testCase of GOLDEN_SUPPLEMENT_CASES) {
      const current = testCase.world === undefined ? testCase.context.at(-1)!.content : testCase.world.kind === 'SHARED'
        ? testCase.world.conversation.at(-1)!.text : testCase.world.discussion.posts.find((post) => post.invoking)!.text;
      expect([testCase.id, decideFastDeepRoute(current).path]).toEqual([testCase.id, testCase.path]);
      expect(interpretInteractionPreferenceCommand(current)).toBeNull();
    }
    expect(GOLDEN_SUPPLEMENT_CASES.filter((testCase) => testCase.path === 'DEEP').map((testCase) => testCase.id))
      .toEqual(['deep-golden-pref-maghrebi-complex-ar', 'deep-golden-complex-decision-ar-eg']);
  });

  it('builds Shared and Public cases with their own production assemblers: world-neutral guidance, und, no Personal preference', () => {
    const sharedCase = supplement('fast-golden-shared-mixed-dialects');
    const publicCase = supplement('fast-golden-public-neutral-msa');
    if (sharedCase.world?.kind !== 'SHARED' || publicCase.world?.kind !== 'PUBLIC') throw new Error('world cases missing');
    expect(deepSeekEvaluationRequest(sharedCase)).toEqual(assembleSharedConversationRequest(sharedCase.world.conversation));
    expect(deepSeekEvaluationRequest(publicCase)).toEqual(assemblePublicQandeelRequest(publicCase.world.discussion));
    for (const testCase of [sharedCase, publicCase]) {
      const request = deepSeekEvaluationRequest(testCase);
      expect(request.locale).toBe('und');
      expect(testCase.interactionPreferences).toBeUndefined();
      expect(request.behavioralGuidance).not.toContain('Standing interaction preferences the user explicitly chose');
      expect(request.behavioralGuidance).not.toBe(new BehavioralResponsePolicyService().buildTextGuidance());
    }
  });

  it('sends every case on its NAMED path with that path\'s production budget, and Personal guidance exactly as production renders it', () => {
    for (const testCase of GOLDEN_EXTENDED_SUITE) {
      const request = deepSeekEvaluationRequest(testCase);
      expect(request.path).toBe(testCase.path);
      expect(request.latencyBudgetMs).toBe((testCase.world ? WORLD_REPLY_LATENCY_BUDGET_MS : PERSONAL_REPLY_LATENCY_BUDGET_MS)[testCase.path]);
    }
    // S8A-02 CP3 correction (Product Owner, 2026-10-22): Personal FAST 10 s; the Worlds are unchanged.
    expect(PERSONAL_REPLY_LATENCY_BUDGET_MS).toEqual({ FAST: 10_000, DEEP: 25_000 });
    expect(WORLD_REPLY_LATENCY_BUDGET_MS).toEqual({ FAST: 3_000, DEEP: 10_000 });
    const brevity = GOLDEN_CONVERSATION_SUITE.find((testCase) => testCase.id === 'deep-golden-declared-brevity-ar-eg')!;
    expect(deepSeekEvaluationRequest(brevity).behavioralGuidance).toBe(new BehavioralResponsePolicyService().buildTextGuidance({ preferences: brevity.interactionPreferences!, safetyGuided: false }));
  });

  it('runs once per case, records the production route beside the named path, and keeps a failure\'s usage unknown, never zero', async () => {
    const requests: ModelRouterRequest[] = [];
    let call = 0;
    const router: ModelRouter = { generate: jest.fn(async (request: ModelRouterRequest) => {
      requests.push(request);
      call += 1;
      if (call === 3) throw new Error('provider down');
      return { content: call === 1 ? 'تمام، خد نفس.\n\nإيه اللي حصل؟' : '**Plan**\n- one\n- two', routingMetadata: { path: request.path }, usage: { inputTokens: 1200, outputTokens: 60 } };
    }) };
    const attributed: string[] = [];
    const cases = GOLDEN_EXTENDED_SUITE.slice(0, 4);
    const results = await runDeepSeekEvaluation(cases, 'baseline', { router, attribute: async (caseId, work) => { attributed.push(caseId); return work(); } });
    expect(requests).toHaveLength(4);
    expect(attributed).toEqual(cases.map((testCase) => testCase.id));
    expect(results[2]).toMatchObject({ caseId: 'deep-golden-humour-to-serious-ar-eg', path: 'DEEP', productionRoute: 'FAST', success: false, inputTokens: null, outputTokens: null, shape: null });
    expect(results[0]).toMatchObject({ path: 'FAST', productionRoute: 'FAST', success: true, inputTokens: 1200, label: 'baseline' });
    expect(results[0].shape).toMatchObject({ endsWithQuestion: true, usesMarkdown: false, paragraphs: 2 });
    expect(results[1].shape).toMatchObject({ endsWithQuestion: false, usesMarkdown: true, boldSpans: 1, bulletLines: 2 });
    expect(summarizeDeepSeekRun(results).DEEP).toMatchObject({ cases: 2, succeeded: 1, failed: 1, usageUnknown: 1, productionRouteDiffers: 2 });
  });

  it('measures form deterministically: trailing questions through emoji and punctuation, Markdown in any of its forms', () => {
    expect(replyShape('خلّيك على راحتك 🙂').endsWithQuestion).toBe(false);
    expect(replyShape('طب إيه رأيك؟ 😄').endsWithQuestion).toBe(true);
    expect(replyShape('What happened?"').endsWithQuestion).toBe(true);
    expect(replyShape('## Title\ntext').headingLines).toBe(1);
    expect(replyShape('١. أولًا\n٢. ثانيًا').numberedLines).toBe(2);
    expect(replyShape('plain prose, no lists.').usesMarkdown).toBe(false);
  });

  it('blinds before / after per case with the historical parity, and keeps the label map apart from the review', () => {
    for (const testCase of GOLDEN_EXTENDED_SUITE) {
      expect(labelShownAsA(testCase.id)).toBe(candidateAProvider(testCase.id) === 'ANTHROPIC' ? 'baseline' : 'candidate');
    }
    const make = (label: 'baseline' | 'candidate') => GOLDEN_EXTENDED_SUITE.map((testCase) => ({
      caseId: testCase.id, label, repeat: 1, world: 'PERSONAL' as const, path: testCase.path, productionRoute: testCase.path, productionRouteReason: 'r',
      latencyBudgetMs: 3000, latencyMs: 1, inputTokens: 1, outputTokens: 1, success: true, response: `${label} reply`, shape: replyShape(`${label} reply`),
    }));
    const { blindedReview, labelMap } = createGuidanceComparisonArtifacts(GOLDEN_EXTENDED_SUITE, make('baseline'), make('candidate'), GOLDEN_CONVERSATION_RUBRIC);
    expect(blindedReview).toHaveLength(30);
    expect(JSON.stringify(blindedReview)).not.toMatch(/"label"|baseline"|candidate"|DEEPSEEK|deepseek/u);
    for (const review of blindedReview) {
      const map = labelMap.find((entry) => entry.caseId === review.caseId)!;
      expect(review.candidateA).toBe(`${map.A} reply`);
      expect(Object.keys(review.scores)).toEqual([...GOLDEN_CONVERSATION_RUBRIC]);
      expect(review).toMatchObject({ unfitRegisterFail: { A: null, B: null }, explicitFailConditionMet: { A: null, B: null }, readsAsQandeel: { A: null, B: null } });
    }
    expect(new Set(labelMap.map((entry) => entry.A))).toEqual(new Set(['baseline', 'candidate']));
  });

  it('refuses a paid DeepSeek run without the switch, synthetic mode, the key, the guard, or with another provider present', () => {
    const ok = { QANDEEL_ALLOW_PAID_EVAL: '1', NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'sk-synthetic' };
    expect(() => assertDeepSeekRunAllowed(ok, true)).not.toThrow();
    expect(() => assertDeepSeekRunAllowed({ ...ok, QANDEEL_ALLOW_PAID_EVAL: undefined }, true)).toThrow('QANDEEL_ALLOW_PAID_EVAL');
    expect(() => assertDeepSeekRunAllowed({ ...ok, NODE_ENV: 'production' }, true)).toThrow('production');
    expect(() => assertDeepSeekRunAllowed({ ...ok, DEEPSEEK_QUALIFICATION_MODE: 'LIVE' }, true)).toThrow('SYNTHETIC_ONLY');
    expect(() => assertDeepSeekRunAllowed({ ...ok, DEEPSEEK_API_KEY: ' ' }, true)).toThrow('DEEPSEEK_API_KEY');
    expect(() => assertDeepSeekRunAllowed({ ...ok, OPENAI_API_KEY: 'x' }, true)).toThrow('DeepSeek only');
    expect(() => assertDeepSeekRunAllowed(ok, false)).toThrow('guard');
  });

  it('keeps the 22-case Golden suite byte-stable while adding the extension', () => {
    expect(sha256(GOLDEN_CONVERSATION_SUITE)).toBe(sha256(GOLDEN_EXTENDED_SUITE.slice(0, 22)));
  });
});
