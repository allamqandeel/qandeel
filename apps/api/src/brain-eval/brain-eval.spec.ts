import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { candidateAProvider, createReviewArtifacts, EVALUATION_ARTIFACT_DIRECTORY, expectedRequestCount, providerExecutionOrder, runEvaluation } from './brain-eval.harness';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { estimateCostUsd } from './brain-eval.pricing';
import { BRAIN_EVALUATION_SUITE } from './brain-eval.suite';
import { assertPaidRunAllowed, validateEvaluationSuite } from './brain-eval.validation';

const result = { content: 'synthetic response', routingMetadata: { path: 'FAST' as const }, usage: { inputTokens: 40, outputTokens: 10 } };
const router = (requests: ModelRouterRequest[]): ModelRouter => ({ generate: jest.fn(async (request) => { requests.push(request); return { ...result, routingMetadata: { path: request.path } }; }) });

describe('Brain Bake-off evaluation harness', () => {
  it('validates deterministically without provider calls', () => {
    const report = validateEvaluationSuite(BRAIN_EVALUATION_SUITE);
    expect(report.expectedPaidRequests).toBe(BRAIN_EVALUATION_SUITE.length * 2);
    expect(expectedRequestCount(BRAIN_EVALUATION_SUITE)).toBe(48);
  });

  it('refuses paid execution without acknowledgement or either credential', () => {
    expect(() => assertPaidRunAllowed({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' })).toThrow('QANDEEL_ALLOW_PAID_EVAL=1');
    expect(() => assertPaidRunAllowed({ QANDEEL_ALLOW_PAID_EVAL: '1', OPENAI_API_KEY: 'o' })).toThrow('ANTHROPIC_API_KEY');
    expect(() => assertPaidRunAllowed({ QANDEEL_ALLOW_PAID_EVAL: '1', ANTHROPIC_API_KEY: 'a' })).toThrow('OPENAI_API_KEY');
  });

  it('sends identical context, production guidance, path, and bounds to corresponding profiles', async () => {
    const anthropic: ModelRouterRequest[] = [];
    const openai: ModelRouterRequest[] = [];
    const cases = [BRAIN_EVALUATION_SUITE.find(({ path }) => path === 'FAST')!, BRAIN_EVALUATION_SUITE.find(({ path }) => path === 'DEEP')!];
    await runEvaluation(cases, { ANTHROPIC: router(anthropic), OPENAI: router(openai) }, (() => { let time = 0; return () => time += 5; })());
    expect(anthropic).toEqual(openai);
    expect(anthropic.map(({ path }) => path)).toEqual(['FAST', 'DEEP']);
    expect(anthropic.every(({ behavioralGuidance }) => behavioralGuidance === new BehavioralResponsePolicyService().buildTextGuidance())).toBe(true);
    expect(anthropic.map(({ context }) => context)).toEqual(cases.map(({ context }) => context));
  });

  it('normalizes timing and token metrics and keeps unverified cost explicitly separate', async () => {
    const results = await runEvaluation([BRAIN_EVALUATION_SUITE[0]], { ANTHROPIC: router([]), OPENAI: router([]) }, (() => { let time = 0; return () => time += 7; })());
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ latencyMs: 7, inputTokens: 40, outputTokens: 10, estimatedCostUsd: null });
    expect(estimateCostUsd('ANTHROPIC', 'FAST', 40, 10)).toBeNull();
  });

  it('blinds candidate identity and stores provider mapping separately', async () => {
    const cases = [BRAIN_EVALUATION_SUITE[0]];
    const results = await runEvaluation(cases, { ANTHROPIC: router([]), OPENAI: router([]) });
    const artifacts = createReviewArtifacts(cases, results);
    expect(JSON.stringify(artifacts.blindedReview)).not.toMatch(/ANTHROPIC|OPENAI|claude|gpt-/iu);
    expect(JSON.stringify(artifacts.providerMap)).toMatch(/ANTHROPIC|OPENAI/u);
    expect(artifacts.blindedReview[0].overallPreference).toBeNull();
  });

  it('assigns A/B and execution order reproducibly and evenly across providers', () => {
    const assignments = BRAIN_EVALUATION_SUITE.map(({ id }) => candidateAProvider(id));
    expect(assignments.filter((provider) => provider === 'ANTHROPIC')).toHaveLength(12);
    expect(assignments.filter((provider) => provider === 'OPENAI')).toHaveLength(12);
    expect(BRAIN_EVALUATION_SUITE.map(({ id }) => providerExecutionOrder(id)[0])).toEqual(assignments);
    expect(BRAIN_EVALUATION_SUITE.map(({ id }) => candidateAProvider(id))).toEqual(assignments);
  });

  it('maps Candidate A/B by assignment rather than result execution order', async () => {
    const cases = BRAIN_EVALUATION_SUITE.slice(0, 2);
    const responseRouter = (content: string): ModelRouter => ({
      generate: jest.fn(async (request) => ({ ...result, content, routingMetadata: { path: request.path } })),
    });
    const results = await runEvaluation(cases, {
      ANTHROPIC: responseRouter('first neutral response'),
      OPENAI: responseRouter('second neutral response'),
    });
    const forward = createReviewArtifacts(cases, results);
    const reversed = createReviewArtifacts(cases, [...results].reverse());
    expect(reversed).toEqual(forward);
    expect(forward.providerMap.map(({ A }) => A?.provider)).toEqual(cases.map(({ id }) => candidateAProvider(id)));
    expect(forward.blindedReview.map(({ candidateA }) => candidateA)).toEqual(
      cases.map(({ id }) => candidateAProvider(id) === 'ANTHROPIC' ? 'first neutral response' : 'second neutral response'),
    );
  });

  it.each(['.', 'apps/api'])('resolves repository artifacts independently of cwd %s', (relativeCwd) => {
    const originalCwd = process.cwd();
    try {
      process.chdir(resolve(REPOSITORY_ROOT, relativeCwd));
      expect(EVALUATION_ARTIFACT_DIRECTORY).toBe(resolve(REPOSITORY_ROOT, 'artifacts', 'evals'));
      expect(readFileSync(resolve(REPOSITORY_ROOT, '.gitignore'), 'utf8')).toContain('artifacts/evals/');
      expect(() => validateEvaluationSuite(BRAIN_EVALUATION_SUITE)).not.toThrow();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
