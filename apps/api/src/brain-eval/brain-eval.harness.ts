import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
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

/**
 * ACE-01 (WP3): the production Safety guidance for a case the production Safety gate decides GUIDED, else undefined.
 * A case labelled GUIDED that the gate does not decide GUIDED is refused, so a label never stands in for Safety.
 */
export function evaluationSafetyGuidance(testCase: BrainEvaluationCase): string | undefined {
  if (testCase.safety !== 'GUIDED') return undefined;
  const decision = new SafetyResponseGateService().evaluate(testCase.context.at(-1)?.content ?? '', testCase.context);
  if (decision.disposition !== 'GUIDED' || !decision.safetyGuidance) throw new Error(`${testCase.id} is not GUIDED by the production Safety gate.`);
  return decision.safetyGuidance;
}

/**
 * The production Behavioral Runtime guidance for a case. A case without declared preferences or GUIDED Safety gets the
 * plain production guidance; a Golden case gets it exactly as the orchestrator renders it, compiled preferences and the
 * GUIDED humour suspension included.
 */
export function evaluationGuidance(testCase: BrainEvaluationCase, policy = new BehavioralResponsePolicyService()): string {
  const safetyGuided = testCase.safety === 'GUIDED';
  if (testCase.interactionPreferences === undefined && !safetyGuided) return policy.buildTextGuidance();
  return policy.buildTextGuidance({ preferences: testCase.interactionPreferences ?? DEFAULT_INTERACTION_PREFERENCES, safetyGuided });
}

export function buildEvaluationRequest(testCase: BrainEvaluationCase, guidance: string, safetyGuidance?: string): ModelRouterRequest {
  return {
    task: 'CONVERSATIONAL_RESPONSE',
    path: testCase.path,
    complexity: testCase.path === 'FAST' ? 'LOW' : 'HIGH',
    behavioralGuidance: guidance,
    ...(safetyGuidance === undefined ? {} : { safetyGuidance }),
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
  const policy = new BehavioralResponsePolicyService();
  const results: CandidateResult[] = [];
  for (const testCase of cases) {
    const guidance = evaluationGuidance(testCase, policy);
    const safetyGuidance = evaluationSafetyGuidance(testCase);
    for (const provider of providerExecutionOrder(testCase.id)) {
      const request = buildEvaluationRequest(testCase, guidance, safetyGuidance);
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
          // A failed attempt's usage is unknown, never zero (AI-COST-01).
          latencyMs: Math.max(0, now() - started), inputTokens: null, outputTokens: null,
          success: false, response: '', estimatedCostUsd: null, error: 'Provider generation failed.',
        });
      }
    }
  }
  return results;
}

export function createReviewArtifacts(
  cases: ReadonlyArray<BrainEvaluationCase>,
  results: ReadonlyArray<CandidateResult>,
  rubric: ReadonlyArray<string> = RUBRIC,
) {
  const blindedReview = cases.map((testCase) => {
    const pair = results.filter((result) => result.caseId === testCase.id);
    const aProvider = candidateAProvider(testCase.id);
    const candidateA = pair.find((result) => result.provider === aProvider);
    const candidateB = pair.find((result) => result.provider !== aProvider);
    return {
      caseId: testCase.id, path: testCase.path, context: testCase.context, reviewNotes: testCase.reviewNotes,
      // ACE-01 (WP3): a Golden case tells the blinded reviewer what it measures and which canonical authority applied,
      // and carries the explicit unfit-register FAIL mark (true = FAIL, whatever the scores). No model identity.
      ...(testCase.styleFocus === undefined ? {} : {
        styleFocus: testCase.styleFocus,
        declaredPreferences: testCase.interactionPreferences ?? DEFAULT_INTERACTION_PREFERENCES,
        safetyGuided: testCase.safety === 'GUIDED',
        unfitRegisterFail: { A: null as boolean | null, B: null as boolean | null },
      }),
      candidateA: candidateA?.response ?? '', candidateB: candidateB?.response ?? '',
      scores: Object.fromEntries(rubric.map((name) => [name, { A: null, B: null }])),
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

export async function writeEvaluationArtifacts(
  cases: ReadonlyArray<BrainEvaluationCase>,
  results: ReadonlyArray<CandidateResult>,
  directory: string = EVALUATION_ARTIFACT_DIRECTORY,
  rubric: ReadonlyArray<string> = RUBRIC,
): Promise<void> {
  const { blindedReview, providerMap } = createReviewArtifacts(cases, results, rubric);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, 'results.json'), JSON.stringify(results, null, 2)),
    writeFile(join(directory, 'blinded-review.json'), JSON.stringify(blindedReview, null, 2)),
    writeFile(join(directory, 'provider-map.json'), JSON.stringify(providerMap, null, 2)),
  ]);
}
