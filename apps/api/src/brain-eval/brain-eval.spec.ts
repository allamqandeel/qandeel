import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { createReviewArtifacts, EVALUATION_ARTIFACT_DIRECTORY, expectedRequestCount, runEvaluation } from './brain-eval.harness';
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

  it('targets an ignored local artifact directory', () => {
    expect(EVALUATION_ARTIFACT_DIRECTORY).toBe(resolve(process.cwd(), 'artifacts', 'evals'));
    expect(readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8')).toContain('artifacts/evals/');
  });
});
