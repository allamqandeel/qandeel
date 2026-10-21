import { QANDEEL_PERSONALITY_CORE_V2, QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL } from '../conversation/behavioral-response-policy.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
import type { ModelRouter, ModelRouterRequest, ProcessingPath } from '../model-router/model-router.types';
import { buildEvaluationRequest, evaluationGuidance, evaluationSafetyGuidance, stableCaseParity } from './brain-eval.harness';
import type { BrainEvaluationCase } from './brain-eval.types';
import { worldCurrentMessage, worldEvaluationRequest } from './brain-eval.worlds';

// S8A-02 — the DeepSeek-only path of the ONE brain-eval system (Product Owner D3, 2026-10-21).
//
// It compares two GUIDANCE versions on the same production model: a `baseline` run made with the guidance in force before
// the approved personality copy lands, and a `candidate` run made after it. It is not a provider comparison: no OpenAI,
// Anthropic or Gemini client is composed anywhere on this path, and the historical `run` command, its providers and its
// fixed 10 s budget are untouched.
//
// Every case is sent once, on the path its id names (D5: historical labels kept), with the production budget of that path,
// and the path production routing WOULD choose is recorded beside it. The caller supplies the accounted production router
// and the attribution scope (the AI-COST-01 ledger, D3); this module neither reads the environment nor opens a connection.

// Round 1: `baseline` / `candidate`. Round 2 (Product Owner decision, 2026-10-21): `core-v2` / `core-v3`, each the guidance
// rendered at the commit the run is made from.
export const DEEPSEEK_EVALUATION_LABELS = ['baseline', 'candidate', 'core-v2', 'core-v3'] as const;
export type DeepSeekEvaluationLabel = typeof DEEPSEEK_EVALUATION_LABELS[number];

export function isDeepSeekEvaluationLabel(value: string | undefined): value is DeepSeekEvaluationLabel {
  return (DEEPSEEK_EVALUATION_LABELS as readonly string[]).includes(value ?? '');
}

/**
 * Round 2 labels name a guidance version, so a run refuses unless the code it is made from renders that version: `core-v2`
 * needs the approved core v2 (Personal) or its world-neutral derivation (Shared / Public) in every case's guidance, and
 * `core-v3` needs neither. Round 1 labels name a before / after moment, not a text, and are not checked here.
 */
export function assertGuidanceMatchesLabel(cases: ReadonlyArray<BrainEvaluationCase>, label: DeepSeekEvaluationLabel): void {
  if (label !== 'core-v2' && label !== 'core-v3') return;
  const rendersCoreV2 = (testCase: BrainEvaluationCase) => {
    const guidance = deepSeekEvaluationRequest(testCase).behavioralGuidance;
    return guidance.includes(QANDEEL_PERSONALITY_CORE_V2) || guidance.includes(QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL);
  };
  const mismatched = cases.filter((testCase) => rendersCoreV2(testCase) !== (label === 'core-v2')).map((testCase) => testCase.id);
  if (mismatched.length > 0) {
    throw new Error(`NOT RUN: the guidance at this commit is not ${label} for ${mismatched.length} case(s), e.g. ${mismatched[0]}.`);
  }
}

/** The Personal orchestrator's reply budgets (S8A-01, Product Owner 2026-10-21: DEEP 20 s). */
export const PERSONAL_REPLY_LATENCY_BUDGET_MS = { FAST: 3_000, DEEP: 20_000 } as const satisfies Record<ProcessingPath, number>;
/** The Shared and Public assemblers' reply budgets (DEEP stays 10 s: QAN-BL-AI-04). */
export const WORLD_REPLY_LATENCY_BUDGET_MS = { FAST: 3_000, DEEP: 10_000 } as const satisfies Record<ProcessingPath, number>;

/** The message production routing reads for a case: the last Personal turn, the answered Shared turn, the invoking post. */
export function currentMessageOf(testCase: BrainEvaluationCase): string {
  return testCase.world === undefined ? testCase.context.at(-1)?.content ?? '' : worldCurrentMessage(testCase);
}

/**
 * The request a case sends on its named path: production guidance (the Behavioral Runtime's, or the World assembler's),
 * production Safety guidance, and the production budget of that path in that World.
 */
export function deepSeekEvaluationRequest(testCase: BrainEvaluationCase): ModelRouterRequest {
  const safetyGuidance = evaluationSafetyGuidance(testCase);
  const path = testCase.path;
  const complexity = path === 'DEEP' ? 'HIGH' : 'LOW';
  if (testCase.world !== undefined) {
    return { ...worldEvaluationRequest(testCase, safetyGuidance), path, complexity, latencyBudgetMs: WORLD_REPLY_LATENCY_BUDGET_MS[path] };
  }
  return { ...buildEvaluationRequest(testCase, evaluationGuidance(testCase), safetyGuidance), latencyBudgetMs: PERSONAL_REPLY_LATENCY_BUDGET_MS[path] };
}

/** Deterministic, observational facts about a reply's form. They score nothing; the reviewer judges. */
export interface ReplyShape {
  characters: number;
  words: number;
  paragraphs: number;
  questionMarks: number;
  endsWithQuestion: boolean;
  boldSpans: number;
  headingLines: number;
  bulletLines: number;
  numberedLines: number;
  usesMarkdown: boolean;
}

const TRAILING_DECORATION = /[\s\p{Extended_Pictographic}‍️.!…)»"']+$/u;

export function replyShape(reply: string): ReplyShape {
  const text = reply.trim();
  const lines = text.split(/\r?\n/u);
  const boldSpans = (text.match(/\*\*[^*\n]+\*\*|__[^_\n]+__/gu) ?? []).length;
  const headingLines = lines.filter((line) => /^\s{0,3}#{1,6}\s/u.test(line)).length;
  const bulletLines = lines.filter((line) => /^\s*[-*•]\s+\S/u.test(line)).length;
  const numberedLines = lines.filter((line) => /^\s*(?:\d+|[٠-٩]+)[.)]\s+\S/u.test(line)).length;
  return {
    characters: [...text].length,
    words: text.length === 0 ? 0 : text.split(/\s+/u).length,
    paragraphs: text.length === 0 ? 0 : text.split(/\n\s*\n/u).length,
    questionMarks: (text.match(/[?؟]/gu) ?? []).length,
    endsWithQuestion: /[?؟]$/u.test(text.replace(TRAILING_DECORATION, '')),
    boldSpans, headingLines, bulletLines, numberedLines,
    usesMarkdown: boldSpans + headingLines + bulletLines + numberedLines > 0,
  };
}

export interface DeepSeekEvaluationResult {
  caseId: string;
  label: DeepSeekEvaluationLabel;
  /** 1-based attempt number of this case within the run (Round 2 repeats each case; Round 1 ran each once). */
  repeat: number;
  world: 'PERSONAL' | 'SHARED' | 'PUBLIC';
  /** The path the case was sent on: the one its id names (D5). */
  path: ProcessingPath;
  /** The path production routing would choose for this message, and why (recorded, never applied: D5). */
  productionRoute: ProcessingPath;
  productionRouteReason: string;
  latencyBudgetMs: number;
  latencyMs: number;
  /** Provider-reported usage; null when unknown, never zero (AI-COST-01). */
  inputTokens: number | null;
  outputTokens: number | null;
  success: boolean;
  response: string;
  shape: ReplyShape | null;
  error?: string;
}

export interface DeepSeekEvaluationDependencies {
  /** The accounted production DeepSeek router. */
  readonly router: ModelRouter;
  /**
   * Opens the attribution scope (and anything the caller records) around ONE attempt's provider work. The key is the case
   * id, or `caseId#repeat` when a run repeats its cases.
   */
  readonly attribute: <T>(attemptKey: string, work: () => Promise<T>) => Promise<T>;
  readonly now?: () => number;
}

/** The evidence key of one attempt: the case id alone in a single-attempt run, `caseId#repeat` otherwise. */
export const attemptKey = (caseId: string, repeat: number, repeats: number): string => (repeats === 1 ? caseId : `${caseId}#${repeat}`);

/**
 * `repeats` attempts per case, round-robin (every case's first attempt, then every case's second, ...) so that time-of-day
 * drift is spread across repeats instead of landing on one. A failure is recorded with unknown usage and never retried.
 */
export async function runDeepSeekEvaluation(
  cases: ReadonlyArray<BrainEvaluationCase>,
  label: DeepSeekEvaluationLabel,
  dependencies: DeepSeekEvaluationDependencies,
  repeats = 1,
): Promise<ReadonlyArray<DeepSeekEvaluationResult>> {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('A DeepSeek evaluation run repeats each case 1 to 3 times.');
  const now = dependencies.now ?? (() => performance.now());
  const results: DeepSeekEvaluationResult[] = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) for (const testCase of cases) {
    const request = deepSeekEvaluationRequest(testCase);
    const route = decideFastDeepRoute(currentMessageOf(testCase));
    const base = {
      caseId: testCase.id, label, repeat, world: testCase.world?.kind ?? 'PERSONAL' as const, path: testCase.path,
      productionRoute: route.path, productionRouteReason: route.reason, latencyBudgetMs: request.latencyBudgetMs,
    };
    const started = now();
    try {
      const result = await dependencies.attribute(attemptKey(testCase.id, repeat, repeats), () => dependencies.router.generate(request));
      results.push({
        ...base, latencyMs: Math.max(0, now() - started), inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
        success: true, response: result.content, shape: replyShape(result.content),
      });
    } catch {
      results.push({
        ...base, latencyMs: Math.max(0, now() - started), inputTokens: null, outputTokens: null,
        success: false, response: '', shape: null, error: 'Provider generation failed.',
      });
    }
  }
  return results;
}

/** Which guidance version is shown as candidate A for a case: stable per case id, independent of run order. */
export function labelShownAsA(caseId: string): DeepSeekEvaluationLabel {
  return stableCaseParity(caseId) === 0 ? 'baseline' : 'candidate';
}

/**
 * The blinded before / after review: per case, the two replies as A and B with no guidance identity, the case's notes,
 * the 13-dimension rubric, the unfit-register FAIL mark, the case's explicit FAIL condition, and the D6 question "does
 * this read as QANDEEL or as a generic AI assistant?". The label map is written apart from it.
 */
export function createGuidanceComparisonArtifacts(
  cases: ReadonlyArray<BrainEvaluationCase>,
  baseline: ReadonlyArray<DeepSeekEvaluationResult>,
  candidate: ReadonlyArray<DeepSeekEvaluationResult>,
  rubric: ReadonlyArray<string>,
) {
  const reply = (results: ReadonlyArray<DeepSeekEvaluationResult>, caseId: string) => results.find((result) => result.caseId === caseId);
  const blindedReview = cases.map((testCase) => {
    const aIsBaseline = labelShownAsA(testCase.id) === 'baseline';
    const a = reply(aIsBaseline ? baseline : candidate, testCase.id);
    const b = reply(aIsBaseline ? candidate : baseline, testCase.id);
    return {
      caseId: testCase.id, path: testCase.path, productionRoute: a?.productionRoute ?? b?.productionRoute ?? null,
      world: testCase.world?.kind ?? 'PERSONAL',
      context: testCase.world === undefined ? testCase.context : testCase.world,
      reviewNotes: testCase.reviewNotes, styleFocus: testCase.styleFocus ?? [],
      declaredPreferences: testCase.world === undefined ? testCase.interactionPreferences ?? DEFAULT_INTERACTION_PREFERENCES : null,
      safetyGuided: testCase.safety === 'GUIDED',
      candidateA: a?.success ? a.response : null, candidateB: b?.success ? b.response : null,
      scores: Object.fromEntries(rubric.map((name) => [name, { A: null as number | null, B: null as number | null }])),
      unfitRegisterFail: { A: null as boolean | null, B: null as boolean | null },
      explicitFailConditionMet: { A: null as boolean | null, B: null as boolean | null },
      readsAsQandeel: { A: null as 'QANDEEL' | 'GENERIC_ASSISTANT' | 'MIXED' | null, B: null as 'QANDEEL' | 'GENERIC_ASSISTANT' | 'MIXED' | null },
      overallPreference: null as 'A' | 'B' | 'Tie' | null,
      reviewerNote: '',
    };
  });
  const labelMap = cases.map((testCase) => ({ caseId: testCase.id, A: labelShownAsA(testCase.id), B: labelShownAsA(testCase.id) === 'baseline' ? 'candidate' : 'baseline' }));
  return { blindedReview, labelMap };
}

const average = (values: ReadonlyArray<number>): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percentile = (values: ReadonlyArray<number>, fraction: number): number | null => {
  if (!values.length) return null;
  const ordered = [...values].sort((x, y) => x - y);
  return ordered[Math.ceil(fraction * ordered.length) - 1];
};
const rate = (count: number, total: number): number | null => total ? count / total : null;

/** The measurable D6 facts of one run, per path; usage that is unknown is counted as unknown, never as zero. */
export function summarizeDeepSeekRun(results: ReadonlyArray<DeepSeekEvaluationResult>) {
  return Object.fromEntries((['FAST', 'DEEP'] as const).map((path) => {
    const rows = results.filter((row) => row.path === path);
    const ok = rows.filter((row) => row.success);
    const shapes = ok.map((row) => row.shape).filter((shape): shape is ReplyShape => shape !== null);
    return [path, {
      cases: rows.length, succeeded: ok.length, failed: rows.length - ok.length,
      usageUnknown: rows.filter((row) => row.inputTokens === null || row.outputTokens === null).length,
      p50LatencyMs: percentile(ok.map((row) => row.latencyMs), 0.5), maxLatencyMs: ok.length ? Math.max(...ok.map((row) => row.latencyMs)) : null,
      averageInputTokens: average(ok.map((row) => row.inputTokens).filter((value): value is number => value !== null)),
      averageOutputTokens: average(ok.map((row) => row.outputTokens).filter((value): value is number => value !== null)),
      averageCharacters: average(shapes.map((shape) => shape.characters)),
      endsWithQuestionRate: rate(shapes.filter((shape) => shape.endsWithQuestion).length, shapes.length),
      markdownRate: rate(shapes.filter((shape) => shape.usesMarkdown).length, shapes.length),
      productionRouteDiffers: rows.filter((row) => row.productionRoute !== row.path).length,
    }];
  }));
}
