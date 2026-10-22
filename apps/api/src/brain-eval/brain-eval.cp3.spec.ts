import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { assertGuidanceMatchesLabel, currentMessageOf, plannedAttempts, runDeepSeekEvaluation } from './brain-eval.deepseek';
import {
  CP3_HUMAN_REVIEW_NOT_STARTED, cp3Delivery, cp3HumanReviewForm, createCp3Packets, renderCp3HumanPacketMarkdown, type CP3RecordedResult,
} from './brain-eval.cp3-review';
import {
  CP3_NEW_CASES, CP3_PERSONAL_GOLDEN_CASES, CP3_REUSED_CASE_IDS, GOLDEN_CP3_PERSONAL_SUITE, GOLDEN_CP3_QUALIFICATION_CASES,
} from './brain-eval.golden-cp3.suite';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { DEEPSEEK_EVALUATION_SUITES } from './brain-eval.suites';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';

// S8A-02 CP3 — the qualification run's tooling, with a recording router only: zero DeepSeek calls.
describe('S8A-02 CP3 Personal qualification suite', () => {
  it('holds the 36 Personal Golden cases and the eight approved cases, each on its production route', () => {
    expect(CP3_PERSONAL_GOLDEN_CASES).toHaveLength(36);
    expect(CP3_NEW_CASES).toHaveLength(8);
    expect(GOLDEN_CP3_QUALIFICATION_CASES).toHaveLength(44);
    for (const testCase of GOLDEN_CP3_QUALIFICATION_CASES) {
      expect(testCase.path).toBe(decideFastDeepRoute(currentMessageOf(testCase)).path);
      expect(testCase.world).toBeUndefined();
    }
  });

  it('sends 39 cases × 3 = 117 attempts: the 44 minus the five reused Round 3 cases', () => {
    expect(GOLDEN_CP3_PERSONAL_SUITE).toHaveLength(39);
    expect(GOLDEN_CP3_PERSONAL_SUITE.map((testCase) => testCase.id)).not.toEqual(expect.arrayContaining([...CP3_REUSED_CASE_IDS].slice(0, 1)));
    for (const id of CP3_REUSED_CASE_IDS) expect(GOLDEN_CP3_PERSONAL_SUITE.some((testCase) => testCase.id === id)).toBe(false);
    expect(plannedAttempts(GOLDEN_CP3_PERSONAL_SUITE, 3)).toBe(117);
    expect(GOLDEN_CP3_PERSONAL_SUITE.filter((testCase) => testCase.path === 'DEEP').map((testCase) => testCase.id).sort())
      .toEqual(['deep-golden-complex-en', 'deep-golden-pref-maghrebi-complex-ar']);
  });

  it('every case reaches the model under the production Safety gate: 43 ALLOW and the one labelled GUIDED', () => {
    const gate = new SafetyResponseGateService();
    const dispositions = GOLDEN_CP3_QUALIFICATION_CASES.map((testCase) => [testCase.id, gate.evaluate(currentMessageOf(testCase), testCase.context).disposition]);
    expect(dispositions.filter(([, disposition]) => disposition === 'GUIDED').map(([id]) => id)).toEqual(['fast-golden-guided-humour-ar-eg']);
    expect(dispositions.filter(([, disposition]) => disposition === 'BLOCK')).toEqual([]);
  });

  it('is registered as round 8 with the 20 s transport ceiling and the capped DEEP 2 800 diagnostic, and renders core v3.1', () => {
    const run = DEEPSEEK_EVALUATION_SUITES['golden-cp3-personal'];
    const diagnostic = DEEPSEEK_EVALUATION_SUITES['golden-cp3-deep-2800'];
    expect(run).toMatchObject({ round: 8, repeats: 3, labels: ['core-v3.1'], comparison: 'QUALIFICATION', transportBudgetMs: 20_000 });
    expect(diagnostic).toMatchObject({ round: 8, diagnosticOf: { suite: 'golden-cp3-personal', deepMaxOutputTokens: 2_800, maxAttempts: 6 } });
    expect(run.validate(run.cases).caseCount).toBe(39);
    expect(() => assertGuidanceMatchesLabel(run.cases, 'core-v3.1')).not.toThrow();
  });

  it('the guard holds no round 8 caps: nothing can be sent before the Product Owner approves the run', () => {
    const guard = readFileSync(join(REPOSITORY_ROOT, 'scripts', 's8a-02', 'network-guard.cjs'), 'utf8');
    const caps = /const ROUND_CAPS = \{([\s\S]*?)\};/u.exec(guard)?.[1] ?? '';
    expect(caps).toMatch(/\b7: \{/u);
    expect(caps).not.toMatch(/\b8: \{/u);
  });
});

describe('S8A-02 CP3 runner: full reply on a 20 s transport, production budget recorded', () => {
  const recording = () => {
    const seen: ModelRouterRequest[] = [];
    const router: ModelRouter = { generate: async (request) => { seen.push(request); return { content: 'تمام.', routingMetadata: { path: request.path }, usage: { inputTokens: 1, outputTokens: 1 } }; } };
    return { seen, router };
  };
  const attribute = <T>(_key: string, work: () => Promise<T>) => work();

  it('sends with the transport budget and records the production budget', async () => {
    const { seen, router } = recording();
    const [fast] = GOLDEN_CP3_PERSONAL_SUITE.filter((testCase) => testCase.path === 'FAST');
    const [result] = await runDeepSeekEvaluation([fast], 'core-v3.1', { router, attribute, transportBudgetMs: 20_000 });
    expect(seen[0].latencyBudgetMs).toBe(20_000);
    expect(result).toMatchObject({ latencyBudgetMs: 3_000, transportBudgetMs: 20_000, success: true });
  });

  it('without the option, the request keeps the production budget (every earlier round is unchanged)', async () => {
    const { seen, router } = recording();
    const [fast] = GOLDEN_CP3_PERSONAL_SUITE.filter((testCase) => testCase.path === 'FAST');
    const [result] = await runDeepSeekEvaluation([fast], 'core-v3.1', { router, attribute });
    expect(seen[0].latencyBudgetMs).toBe(3_000);
    expect(result.transportBudgetMs).toBeUndefined();
  });
});

describe('S8A-02 CP3 review packets', () => {
  const result = (caseId: string, repeat: number, success: boolean, extra: Partial<CP3RecordedResult> = {}): CP3RecordedResult => ({
    caseId, label: 'core-v3.1', repeat, world: 'PERSONAL', path: 'FAST', productionRoute: 'FAST', productionRouteReason: 'x', latencyBudgetMs: 3_000,
    latencyMs: 1_000, inputTokens: 1, outputTokens: 1, success, response: success ? `رد تجريبي رقم ${repeat}` : '', shape: null,
    attempts: [{ headersMs: 300, bodyMs: 900, finishReason: success ? 'stop' : 'length', usage: { completion: 50, reasoning: null } }], ...extra,
  });
  const own = GOLDEN_CP3_PERSONAL_SUITE.flatMap((testCase) => [result(testCase.id, 1, false), result(testCase.id, 2, true), result(testCase.id, 3, true)]);
  const reused = CP3_REUSED_CASE_IDS.flatMap((id) => [1, 2, 3].map((repeat) => result(id, repeat, true)));
  const packets = createCp3Packets(GOLDEN_CP3_QUALIFICATION_CASES, own, reused, 'a-salt-of-at-least-16');

  it('the human packet has one reply per case (44), the lowest attempt that replied, and hides how it was produced', () => {
    expect(packets.human).toHaveLength(44);
    expect(packets.human.map((entry) => entry.itemId)).toEqual(Array.from({ length: 44 }, (_, index) => `H${String(index + 1).padStart(2, '0')}`));
    const ownEntry = packets.map.human.find((entry) => entry.source === 'RUN');
    expect(ownEntry?.repeat).toBe(2);
    expect(packets.map.human.filter((entry) => entry.source === 'REUSED_ROUND3')).toHaveLength(5);
    const shown = JSON.stringify(packets.human) + renderCp3HumanPacketMarkdown(packets.human);
    for (const testCase of GOLDEN_CP3_QUALIFICATION_CASES) expect(shown).not.toContain(testCase.id);
    expect(shown).not.toMatch(/REUSED_ROUND3|"repeat"|"path"|"source"|latency|\bFAST\b|\bDEEP\b/u);
  });

  it('the AI-rater packet holds every reply, blind in the same way', () => {
    expect(packets.aiRater).toHaveLength(39 * 3 + 5 * 3);
    for (const testCase of GOLDEN_CP3_QUALIFICATION_CASES) expect(JSON.stringify(packets.aiRater)).not.toContain(testCase.id);
  });

  it('production delivery is decided on the production budget, apart from the review', () => {
    expect(cp3Delivery(result('x', 1, true, { attempts: [{ headersMs: 400, bodyMs: 3_100, finishReason: 'stop' }] })).outcome).toBe('DELIVERY_LIMITED_TIME');
    expect(cp3Delivery(result('x', 1, true)).outcome).toBe('DELIVERED');
    expect(cp3Delivery(result('x', 1, false)).outcome).toBe('TOKEN_LIMITED');
  });

  it('the human review starts NOT_STARTED and the empty form has no verdicts filled in', () => {
    expect(CP3_HUMAN_REVIEW_NOT_STARTED.state).toBe('NOT_STARTED');
    const form = cp3HumanReviewForm(packets.human);
    expect(form).toHaveLength(44);
    expect(Object.values(form[0].critical).every((value) => value === null)).toBe(true);
    expect(Object.values(form[0].rubric)).toHaveLength(13);
  });
});
