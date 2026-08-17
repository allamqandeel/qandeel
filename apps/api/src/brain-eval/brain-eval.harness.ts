import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { resolveAnthropicModel, resolveOpenAIModel } from '../model-router/model-profile.registry';
import type { ModelRouter, ModelRouterRequest, ProcessingPath } from '../model-router/model-router.types';
import { estimateCostUsd } from './brain-eval.pricing';
import { RUBRIC, type BrainEvaluationCase, type CandidateResult, type EvaluationProvider } from './brain-eval.types';

export const EVALUATION_ARTIFACT_DIRECTORY = resolve(process.cwd(), 'artifacts', 'evals');
export const PROVIDERS: ReadonlyArray<EvaluationProvider> = ['ANTHROPIC', 'OPENAI'];

export interface EvaluationRouters { ANTHROPIC: ModelRouter; OPENAI: ModelRouter }

export function expectedRequestCount(cases: ReadonlyArray<BrainEvaluationCase>): number {
  return cases.length * PROVIDERS.length;
}

export function buildEvaluationRequest(testCase: BrainEvaluationCase, guidance: string): ModelRouterRequest {
  return {
    task: 'CONVERSATIONAL_RESPONSE',
    path: testCase.path,
    complexity: testCase.path === 'FAST' ? 'LOW' : 'HIGH',
    behavioralGuidance: guidance,
    context: testCase.context.map((message) => ({ ...message })),
    locale: testCase.locale,
    modality: 'TEXT',
    latencyBudgetMs: 10_000,
    costBudget: 'LOW',
    safetyLevel: 'STANDARD',
  };
}

function modelId(provider: EvaluationProvider, path: ProcessingPath): string {
  return provider === 'ANTHROPIC' ? resolveAnthropicModel(path).model : resolveOpenAIModel(path).model;
}

export async function runEvaluation(
  cases: ReadonlyArray<BrainEvaluationCase>,
  routers: EvaluationRouters,
  now: () => number = () => performance.now(),
): Promise<ReadonlyArray<CandidateResult>> {
  const guidance = new BehavioralResponsePolicyService().buildTextGuidance();
  const results: CandidateResult[] = [];
  for (const testCase of cases) {
    for (const provider of PROVIDERS) {
      const request = buildEvaluationRequest(testCase, guidance);
      const started = now();
      try {
        const result = await routers[provider].generate(request);
        const latencyMs = Math.max(0, now() - started);
        results.push({
          caseId: testCase.id, path: testCase.path, provider,
          profile: `${provider}_${testCase.path}`, modelId: modelId(provider, testCase.path),
          latencyMs, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
          success: true, response: result.content,
          estimatedCostUsd: estimateCostUsd(provider, testCase.path, result.usage.inputTokens, result.usage.outputTokens),
        });
      } catch {
        results.push({
          caseId: testCase.id, path: testCase.path, provider,
          profile: `${provider}_${testCase.path}`, modelId: modelId(provider, testCase.path),
          latencyMs: Math.max(0, now() - started), inputTokens: 0, outputTokens: 0,
          success: false, response: '', estimatedCostUsd: null, error: 'Provider generation failed.',
        });
      }
    }
  }
  return results;
}

export function createReviewArtifacts(cases: ReadonlyArray<BrainEvaluationCase>, results: ReadonlyArray<CandidateResult>) {
  const blindedReview = cases.map((testCase) => {
    const pair = results.filter((result) => result.caseId === testCase.id);
    return {
      caseId: testCase.id, path: testCase.path, context: testCase.context, reviewNotes: testCase.reviewNotes,
      candidateA: pair[0]?.response ?? '', candidateB: pair[1]?.response ?? '',
      scores: Object.fromEntries(RUBRIC.map((name) => [name, { A: null, B: null }])),
      overallPreference: null as 'A' | 'B' | 'Tie' | null,
      reviewerNote: '',
    };
  });
  const providerMap = cases.map((testCase) => {
    const pair = results.filter((result) => result.caseId === testCase.id);
    return { caseId: testCase.id, A: pair[0] ? { provider: pair[0].provider, modelId: pair[0].modelId } : null, B: pair[1] ? { provider: pair[1].provider, modelId: pair[1].modelId } : null };
  });
  return { blindedReview, providerMap };
}

export async function writeEvaluationArtifacts(cases: ReadonlyArray<BrainEvaluationCase>, results: ReadonlyArray<CandidateResult>): Promise<void> {
  const { blindedReview, providerMap } = createReviewArtifacts(cases, results);
  await mkdir(EVALUATION_ARTIFACT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'results.json'), JSON.stringify(results, null, 2)),
    writeFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'blinded-review.json'), JSON.stringify(blindedReview, null, 2)),
    writeFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'provider-map.json'), JSON.stringify(providerMap, null, 2)),
  ]);
}
