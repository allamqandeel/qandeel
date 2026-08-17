import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { resolveAnthropicModel, resolveOpenAIModel } from '../model-router/model-profile.registry';
import type { ModelRouter, ModelRouterRequest, ProcessingPath } from '../model-router/model-router.types';
import { estimateCostUsd } from './brain-eval.pricing';
import { EVALUATION_ARTIFACT_DIRECTORY } from './brain-eval.paths';
import { RUBRIC, type BrainEvaluationCase, type CandidateResult, type EvaluationProvider } from './brain-eval.types';

export const PROVIDERS: ReadonlyArray<EvaluationProvider> = ['ANTHROPIC', 'OPENAI'];
export { EVALUATION_ARTIFACT_DIRECTORY } from './brain-eval.paths';

export interface EvaluationRouters { ANTHROPIC: ModelRouter; OPENAI: ModelRouter }

export function expectedRequestCount(cases: ReadonlyArray<BrainEvaluationCase>): number {
  return cases.length * PROVIDERS.length;
}

export function candidateAProvider(caseId: string): EvaluationProvider {
  let hash = 2_166_136_261;
  for (const character of caseId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % 2 === 0 ? 'ANTHROPIC' : 'OPENAI';
}

export function providerExecutionOrder(caseId: string): readonly [EvaluationProvider, EvaluationProvider] {
  const first = candidateAProvider(caseId);
  return first === 'ANTHROPIC' ? ['ANTHROPIC', 'OPENAI'] : ['OPENAI', 'ANTHROPIC'];
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
    for (const provider of providerExecutionOrder(testCase.id)) {
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
    const aProvider = candidateAProvider(testCase.id);
    const candidateA = pair.find((result) => result.provider === aProvider);
    const candidateB = pair.find((result) => result.provider !== aProvider);
    return {
      caseId: testCase.id, path: testCase.path, context: testCase.context, reviewNotes: testCase.reviewNotes,
      candidateA: candidateA?.response ?? '', candidateB: candidateB?.response ?? '',
      scores: Object.fromEntries(RUBRIC.map((name) => [name, { A: null, B: null }])),
      overallPreference: null as 'A' | 'B' | 'Tie' | null,
      reviewerNote: '',
    };
  });
  const providerMap = cases.map((testCase) => {
    const pair = results.filter((result) => result.caseId === testCase.id);
    const aProvider = candidateAProvider(testCase.id);
    const candidateA = pair.find((result) => result.provider === aProvider);
    const candidateB = pair.find((result) => result.provider !== aProvider);
    return { caseId: testCase.id, A: candidateA ? { provider: candidateA.provider, modelId: candidateA.modelId } : null, B: candidateB ? { provider: candidateB.provider, modelId: candidateB.modelId } : null };
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
