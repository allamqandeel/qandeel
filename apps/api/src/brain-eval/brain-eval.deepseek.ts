import {
  QANDEEL_PERSONALITY_CORE_V2, QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL, QANDEEL_PERSONALITY_CORE_V3, QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL,
  QANDEEL_PERSONALITY_CORE_V3_1, QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL, QANDEEL_PERSONALITY_CORE_V3_2,
} from '../conversation/behavioral-response-policy.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
import type { ModelRouter, ModelRouterRequest, ProcessingPath } from '../model-router/model-router.types';
import { buildEvaluationRequest, evaluationGuidance, evaluationSafetyGuidance, stableCaseParity } from './brain-eval.harness';
import type { BrainEvaluationCase } from './brain-eval.types';
import { assembleSourcedSharedConversationRequest, boundedSharedContext, separatedSharedContext } from '../shared-world/shared-conversation-model-input';
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
// rendered at the commit the run is made from. Round 3 (Product Owner review of Round 2, 2026-10-21): `core-v3` against
// `core-v3.1`, core v3 with a revised world-neutral paragraph 3 (the Personal core is the same in both). Shared attribution
// (Product Owner Shared Attribution Engineering Decision, 2026-10-21): `shared-merged` against `shared-separated`, the same
// core v3.1 guidance on two representations of the same Shared conversation; only the provider message boundaries differ.
// Shared attribution integrity (Product Owner decision, 2026-10-21): `shared-sourced`, the server-sourced record candidate,
// differs from production only in its context and in the Shared frame that explains the record; the core is the same.
// S8A-02 CP3 correction (Product Owner, 2026-10-22): `core-v3.2`, the Personal core v3.2 (gender form kept consistent; an
// ambiguous word not built on one guess) with the standing-preference block leading; the Worlds keep world-neutral v3.1.
export const DEEPSEEK_EVALUATION_LABELS = ['baseline', 'candidate', 'core-v2', 'core-v3', 'core-v3.1', 'core-v3.2', 'shared-merged', 'shared-separated', 'shared-sourced'] as const;
export type DeepSeekEvaluationLabel = typeof DEEPSEEK_EVALUATION_LABELS[number];

export function isDeepSeekEvaluationLabel(value: string | undefined): value is DeepSeekEvaluationLabel {
  return (DEEPSEEK_EVALUATION_LABELS as readonly string[]).includes(value ?? '');
}

/**
 * Round 2 labels name a guidance version, so a run refuses unless the code it is made from renders that version: every
 * case's guidance must carry that core (Personal) or its world-neutral derivation (Shared / Public). Round 1 labels name a
 * before / after moment, not a text, and are not checked here.
 */
// The core each guidance label must render, in Personal and in a World. core v3.1 (S8A-02 Round 3) was null, and so refused,
// at the Round 3 tooling commit, which defines no core v3.1.
const GUIDANCE_CORES: Readonly<Record<Exclude<DeepSeekEvaluationLabel, 'baseline' | 'candidate'>, { personal: string; world: string } | null>> = {
  'core-v2': { personal: QANDEEL_PERSONALITY_CORE_V2, world: QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL },
  'core-v3': { personal: QANDEEL_PERSONALITY_CORE_V3, world: QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL },
  'core-v3.1': { personal: QANDEEL_PERSONALITY_CORE_V3_1, world: QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL },
  'core-v3.2': { personal: QANDEEL_PERSONALITY_CORE_V3_2, world: QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL },
  'shared-merged': { personal: QANDEEL_PERSONALITY_CORE_V3_1, world: QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL },
  'shared-separated': { personal: QANDEEL_PERSONALITY_CORE_V3_1, world: QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL },
  'shared-sourced': { personal: QANDEEL_PERSONALITY_CORE_V3_1, world: QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL },
};

/** The Shared representation a label names: production's merged context, or an experimental candidate: separated (a-1), sourced. */
export const SHARED_REPRESENTATION_LABELS = { 'shared-merged': 'MERGED', 'shared-separated': 'SEPARATED', 'shared-sourced': 'SOURCED' } as const;
const isRepresentationLabel = (label: DeepSeekEvaluationLabel): label is keyof typeof SHARED_REPRESENTATION_LABELS =>
  Object.prototype.hasOwnProperty.call(SHARED_REPRESENTATION_LABELS, label);

export function assertGuidanceMatchesLabel(cases: ReadonlyArray<BrainEvaluationCase>, label: DeepSeekEvaluationLabel): void {
  if (label === 'baseline' || label === 'candidate') return;
  if (isRepresentationLabel(label)) {
    const notShared = cases.filter((testCase) => testCase.world?.kind !== 'SHARED').map((testCase) => testCase.id);
    if (notShared.length > 0) throw new Error(`NOT RUN: ${label} names a Shared representation; ${notShared[0]} is not a Shared case.`);
  }
  const cores = GUIDANCE_CORES[label];
  const renders = (testCase: BrainEvaluationCase) => cores !== null
    && deepSeekEvaluationRequest(testCase).behavioralGuidance.includes(testCase.world === undefined ? cores.personal : cores.world);
  const mismatched = cases.filter((testCase) => !renders(testCase)).map((testCase) => testCase.id);
  if (mismatched.length > 0) {
    throw new Error(`NOT RUN: the guidance at this commit is not ${label} for ${mismatched.length} case(s), e.g. ${mismatched[0]}.`);
  }
}

/** The Personal orchestrator's reply budgets (S8A-01, Product Owner 2026-10-21: DEEP 20 s; S8A-02 CP3 correction: FAST 10 s, DEEP 25 s). */
export const PERSONAL_REPLY_LATENCY_BUDGET_MS = { FAST: 10_000, DEEP: 25_000 } as const satisfies Record<ProcessingPath, number>;
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
export function deepSeekEvaluationRequest(testCase: BrainEvaluationCase, label?: DeepSeekEvaluationLabel): ModelRouterRequest {
  const safetyGuidance = evaluationSafetyGuidance(testCase);
  const path = testCase.path;
  const complexity = path === 'DEEP' ? 'HIGH' : 'LOW';
  if (testCase.world !== undefined) {
    const request: ModelRouterRequest = { ...worldEvaluationRequest(testCase, safetyGuidance), path, complexity, latencyBudgetMs: WORLD_REPLY_LATENCY_BUDGET_MS[path] };
    // The separated arm replaces only the context, with the candidate (a-1) of the same conversation; everything else is the
    // production request. S8A-02 CP1 (2026-10-22): production now sends the separated context itself, so the merged arm is
    // the one that replaces it — with the pre-CP1 merged context — and each label keeps the representation it was run with.
    if (label !== undefined && isRepresentationLabel(label) && SHARED_REPRESENTATION_LABELS[label] === 'SEPARATED') {
      if (testCase.world.kind !== 'SHARED') throw new Error(`${testCase.id}: ${label} applies to Shared cases only.`);
      return { ...request, context: separatedSharedContext(testCase.world.conversation) };
    }
    if (label !== undefined && isRepresentationLabel(label) && SHARED_REPRESENTATION_LABELS[label] === 'MERGED') {
      if (testCase.world.kind !== 'SHARED') throw new Error(`${testCase.id}: ${label} applies to Shared cases only.`);
      return { ...request, context: boundedSharedContext(testCase.world.conversation) };
    }
    // The sourced arm replaces the context and the Shared frame only; everything else is the production request.
    if (label !== undefined && isRepresentationLabel(label) && SHARED_REPRESENTATION_LABELS[label] === 'SOURCED') {
      if (testCase.world.kind !== 'SHARED') throw new Error(`${testCase.id}: ${label} applies to Shared cases only.`);
      const sourced = assembleSourcedSharedConversationRequest(testCase.world.conversation, safetyGuidance);
      if (sourced === null) throw new Error(`${testCase.id}: the sourced candidate refuses this conversation.`);
      return { ...request, behavioralGuidance: sourced.behavioralGuidance, context: sourced.context };
    }
    return request;
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
  /** CP3: the transport timeout the attempt was actually sent with, when it differs from the production budget. */
  transportBudgetMs?: number;
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
  /**
   * Checked before every attempt: a reason to stop the run, or null to go on. The attempt it stops is never sent, so a stop
   * spends nothing further (S8A-02 Shared attribution D3).
   */
  readonly stopWhen?: (results: ReadonlyArray<DeepSeekEvaluationResult>) => string | null;
  /**
   * CP3: send every attempt with this transport timeout instead of the production budget, which is still recorded as
   * `latencyBudgetMs` so production delivery can be decided afterwards. Never a production setting.
   */
  readonly transportBudgetMs?: number;
}

/**
 * The cases that can no longer reach `minimumReplies` replies: more attempts failed than the case can lose. Such a case is
 * INCONCLUSIVE in this run whatever its remaining attempts do.
 */
export function inconclusiveCaseIds(
  cases: ReadonlyArray<BrainEvaluationCase>, results: ReadonlyArray<DeepSeekEvaluationResult>, repeats: number, minimumReplies: number,
): string[] {
  return cases.filter((testCase) => {
    const failed = results.filter((result) => result.caseId === testCase.id && !result.success).length;
    return failed > caseRepeats(testCase, repeats) - minimumReplies;
  }).map((testCase) => testCase.id);
}

/** The evidence key of one attempt: the case id alone in a single-attempt run, `caseId#repeat` otherwise. */
export const attemptKey = (caseId: string, repeat: number, repeats: number): string => (repeats === 1 ? caseId : `${caseId}#${repeat}`);

/** How many times one case runs: the suite's repeats, or fewer when the case sets `maxRepeats`. */
export const caseRepeats = (testCase: BrainEvaluationCase, repeats: number): number => {
  const limit = testCase.maxRepeats ?? repeats;
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`${testCase.id}: maxRepeats must be a positive integer.`);
  return Math.min(limit, repeats);
};

/** The attempts one run of these cases makes (no retries, so this is also the most it can send). */
export const plannedAttempts = (cases: ReadonlyArray<BrainEvaluationCase>, repeats: number): number =>
  cases.reduce((sum, testCase) => sum + caseRepeats(testCase, repeats), 0);

/**
 * `repeats` attempts per case, round-robin (every case's first attempt, then every case's second, ...) so that time-of-day
 * drift is spread across repeats instead of landing on one; a case with `maxRepeats` sits out the later rounds. A failure is
 * recorded with unknown usage and never retried.
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
  for (const testCase of cases) caseRepeats(testCase, repeats);
  run: for (let repeat = 1; repeat <= repeats; repeat += 1) for (const testCase of cases) {
    if (repeat > caseRepeats(testCase, repeats)) continue;
    if (dependencies.stopWhen?.(results) != null) break run;
    const productionRequest = deepSeekEvaluationRequest(testCase, label);
    const transport = dependencies.transportBudgetMs;
    const request = transport === undefined ? productionRequest : { ...productionRequest, latencyBudgetMs: transport };
    const route = decideFastDeepRoute(currentMessageOf(testCase));
    const base = {
      caseId: testCase.id, label, repeat, world: testCase.world?.kind ?? 'PERSONAL' as const, path: testCase.path,
      productionRoute: route.path, productionRouteReason: route.reason, latencyBudgetMs: productionRequest.latencyBudgetMs,
      ...(transport === undefined ? {} : { transportBudgetMs: transport }),
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
