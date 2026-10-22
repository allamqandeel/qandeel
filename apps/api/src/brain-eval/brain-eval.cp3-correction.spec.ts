import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { DEEPSEEK_MAX_OUTPUT_TOKENS } from '../model-router/providers/deepseek/deepseek-model-router.config';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { INTERACTION_PREFERENCE_GUIDANCE_HEADER } from '../interaction-preferences/interaction-preference-guidance';
import { assertGuidanceMatchesLabel, currentMessageOf, deepSeekEvaluationRequest, plannedAttempts, runDeepSeekEvaluation } from './brain-eval.deepseek';
import { cp3Delivery, createCp3Packets, type CP3RecordedResult } from './brain-eval.cp3-review';
import { CP3C_NEW_CASES, CP3C_REUSED_CASE_IDS, GOLDEN_CP3_CORRECTION_SUITE } from './brain-eval.golden-cp3-correction.suite';
import { GOLDEN_CP3_QUALIFICATION_CASES } from './brain-eval.golden-cp3.suite';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { DEEPSEEK_EVALUATION_SUITES } from './brain-eval.suites';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';

// S8A-02 CP3 Final Integrated Correction (Product Owner, 2026-10-22) — the acceptance suite's tooling, with a recording router
// only: zero DeepSeek calls.
describe('S8A-02 CP3 correction acceptance suite (zero calls)', () => {
  const run = DEEPSEEK_EVALUATION_SUITES['golden-cp3-correction'];

  it('holds the 19 existing cases by reference, unchanged, and 25 new ones, each on its production route', () => {
    expect(CP3C_REUSED_CASE_IDS).toHaveLength(19);
    expect(CP3C_NEW_CASES).toHaveLength(25);
    expect(GOLDEN_CP3_CORRECTION_SUITE).toHaveLength(44);
    for (const id of CP3C_REUSED_CASE_IDS) {
      expect(GOLDEN_CP3_CORRECTION_SUITE.find((testCase) => testCase.id === id)).toBe(GOLDEN_CP3_QUALIFICATION_CASES.find((testCase) => testCase.id === id));
    }
    // The human-review failure references are all present: H07, H15, H23, H25, H28, H42 (and H45).
    for (const id of ['deep-golden-declared-brevity-complex-ar-eg', 'fast-golden-no-invented-history-ar-eg', 'fast-golden-pref-english-simpler-from-ar',
      'fast-golden-pref-gulf-ar', 'fast-golden-gender-caregiving-ar-eg', 'fast-golden-pref-msa-direct-ar', 'fast-golden-gender-unknown-ar-eg']) {
      expect(CP3C_REUSED_CASE_IDS).toContain(id);
    }
    for (const testCase of GOLDEN_CP3_CORRECTION_SUITE) {
      expect(testCase.path).toBe(decideFastDeepRoute(currentMessageOf(testCase)).path);
      expect(testCase.world).toBeUndefined();
    }
    expect(run.validate(run.cases)).toMatchObject({ caseCount: 44, fastCount: 40, deepCount: 4 });
  });

  it('is round 9, three repeats = 132 attempts, renders core v3.2, and is sent at the PRODUCTION budgets', () => {
    expect(run).toMatchObject({ round: 9, repeats: 3, labels: ['core-v3.2'], comparison: 'QUALIFICATION' });
    expect(run).not.toHaveProperty('transportBudgetMs');
    expect(run).not.toHaveProperty('diagnosticOf');
    expect(plannedAttempts(run.cases, run.repeats)).toBe(132);
    expect(() => assertGuidanceMatchesLabel(run.cases, 'core-v3.2')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(run.cases, 'core-v3.1')).toThrow('not core-v3.1 for 44 case(s)');
    for (const testCase of run.cases) {
      expect(deepSeekEvaluationRequest(testCase).latencyBudgetMs).toBe(testCase.path === 'DEEP' ? 25_000 : 10_000);
    }
    expect(DEEPSEEK_MAX_OUTPUT_TOKENS).toEqual({ FAST: 1024, DEEP: 2800 });
  });

  it('every declared preference reaches the request as production renders it, leading the guidance', () => {
    const policy = new BehavioralResponsePolicyService();
    for (const testCase of run.cases.filter((candidate) => candidate.interactionPreferences !== undefined)) {
      const { behavioralGuidance } = deepSeekEvaluationRequest(testCase);
      expect(behavioralGuidance).toBe(policy.buildTextGuidance({ preferences: testCase.interactionPreferences!, safetyGuided: false }));
      expect(behavioralGuidance.startsWith(INTERACTION_PREFERENCE_GUIDANCE_HEADER)).toBe(true);
    }
  });

  it('the preference-change case carries the exact server acknowledgement production writes for the command', () => {
    const changed = run.cases.find((testCase) => testCase.id === 'fast-golden-cp3c-pref-changed-en-to-eg')!;
    expect(changed.context[3]).toEqual({ role: 'ASSISTANT', content: 'تم حفظ التفضيل. اللغة واللهجة: مصري.' });
  });

  it('the guard holds exactly the approved round 9 caps: 132 attempts, USD 0.20 (Product Owner approval, 2026-10-22)', () => {
    const guard = readFileSync(join(REPOSITORY_ROOT, 'scripts', 's8a-02', 'network-guard.cjs'), 'utf8');
    const caps = /const ROUND_CAPS = \{([\s\S]*?)\};/u.exec(guard)?.[1] ?? '';
    expect(caps).toMatch(/\b8: \{ maxAttempts: 123, costCapUsd: 0\.25 \}/u);
    expect(caps).toMatch(/\b9: \{ maxAttempts: 132, costCapUsd: 0\.2 \}/u);
    const launcher = readFileSync(join(REPOSITORY_ROOT, 'scripts', 's8a-02', 'deepseek-eval.mjs'), 'utf8');
    expect(launcher).toContain("'golden-cp3-correction': { round: 9, labels: ['core-v3.2'], spendSuite: 'golden-cp3-correction' },");
  });

  it('the runner sends the production budget itself (no transport override) and records it', async () => {
    const seen: ModelRouterRequest[] = [];
    const router: ModelRouter = { generate: async (request) => { seen.push(request); return { content: 'تمام.', routingMetadata: { path: request.path }, usage: { inputTokens: 1, outputTokens: 1 } }; } };
    const [fast] = run.cases.filter((testCase) => testCase.path === 'FAST');
    const [result] = await runDeepSeekEvaluation([fast], 'core-v3.2', { router, attribute: (_key, work) => work() });
    expect(seen[0].latencyBudgetMs).toBe(10_000);
    expect(result.latencyBudgetMs).toBe(10_000);
    expect(result.transportBudgetMs).toBeUndefined();
  });
});

describe('S8A-02 CP3 correction: delivery and packets', () => {
  const base = (over: Partial<CP3RecordedResult>): CP3RecordedResult => ({
    caseId: 'fast-golden-cp3c-humour-default', label: 'core-v3.2', repeat: 1, world: 'PERSONAL', path: 'FAST', productionRoute: 'FAST',
    productionRouteReason: 'x', latencyBudgetMs: 10_000, latencyMs: 2_000, inputTokens: 1, outputTokens: 1, success: true, response: 'رد', shape: null,
    attempts: [{ headersMs: 500, bodyMs: 1_900, finishReason: 'stop', usage: { completion: 40, reasoning: null } }], ...over,
  });

  it('an attempt sent at its production budget and aborted when it ran out is TIME_LIMITED, never a generic failure', () => {
    const aborted = base({ success: false, response: '', latencyMs: 10_004, attempts: [{ headersMs: 10_003, transportError: 'AbortError', usage: null }] });
    expect(cp3Delivery(aborted)).toMatchObject({ outcome: 'TIME_LIMITED', deliveredInProduction: false });
    // A failure before the budget ran out stays FAILED; a length stop stays TOKEN_LIMITED; a reply inside the budget is DELIVERED.
    expect(cp3Delivery({ ...aborted, latencyMs: 400 }).outcome).toBe('FAILED');
    expect(cp3Delivery(base({ success: false, response: '', attempts: [{ headersMs: 300, bodyMs: 19_000, finishReason: 'length', usage: null }] })).outcome).toBe('TOKEN_LIMITED');
    expect(cp3Delivery(base({})).outcome).toBe('DELIVERED');
    // Round 8's 20 s transport attempts keep their earlier meaning.
    expect(cp3Delivery({ ...aborted, transportBudgetMs: 20_000 }).outcome).toBe('FAILED');
  });

  it('packets cover all 44 cases from the run alone, blind, with no reused source', () => {
    const results = GOLDEN_CP3_CORRECTION_SUITE.flatMap((testCase) => [1, 2, 3].map((repeat) => base({ caseId: testCase.id, repeat, path: testCase.path, response: `رد ${repeat}` })));
    const packets = createCp3Packets(GOLDEN_CP3_CORRECTION_SUITE, results, [], 'a-salt-of-at-least-16');
    expect(packets.human).toHaveLength(44);
    expect(packets.aiRater).toHaveLength(132);
    expect(new Set(packets.map.human.map((entry) => entry.source))).toEqual(new Set(['RUN']));
    expect(JSON.stringify(packets.human)).not.toMatch(/fast-golden|deep-golden|latency|FAST|DEEP/u);
  });
});
