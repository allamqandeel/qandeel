import {
  EVALUATION_ARTIFACT_DIRECTORY, GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY, GOLDEN_EXTENDED_ARTIFACT_DIRECTORY, GOLDEN_ROUND2_ARTIFACT_DIRECTORY,
  GOLDEN_ROUND2_PATHS_ARTIFACT_DIRECTORY, GOLDEN_ROUND3_SHARED_ARTIFACT_DIRECTORY, GOLDEN_ROUND3_PERSONALITY_ARTIFACT_DIRECTORY,
  SHARED_ATTRIBUTION_ARTIFACT_DIRECTORY, SHARED_ATTRIBUTION_LANGUAGE_ARTIFACT_DIRECTORY, SHARED_ATTRIBUTION_PROBE_ARTIFACT_DIRECTORY,
  SHARED_ATTRIBUTION_SOURCED_ARTIFACT_DIRECTORY, GOLDEN_CP3_ARTIFACT_DIRECTORY, GOLDEN_CP3_DIAGNOSTIC_ARTIFACT_DIRECTORY,
  GOLDEN_CP3_CORRECTION_ARTIFACT_DIRECTORY,
} from './brain-eval.paths';
import { GOLDEN_CP3_CORRECTION_SUITE } from './brain-eval.golden-cp3-correction.suite';
import {
  CP3_DIAGNOSTIC_DEEP_MAX_OUTPUT_TOKENS, CP3_DIAGNOSTIC_MAX_ATTEMPTS, CP3_TRANSPORT_BUDGET_MS, GOLDEN_CP3_PERSONAL_SUITE,
} from './brain-eval.golden-cp3.suite';
import type { DeepSeekEvaluationLabel } from './brain-eval.deepseek';
import { GOLDEN_EXTENDED_SUITE } from './brain-eval.golden-extended.suite';
import { GOLDEN_ROUND2_PATH_SUITE, GOLDEN_ROUND2_SUITE } from './brain-eval.golden-round2.suite';
import { GOLDEN_ROUND3_PERSONALITY_SUITE, GOLDEN_ROUND3_SHARED_SUITE } from './brain-eval.golden-round3.suite';
import { SHARED_ATTRIBUTION_PROBE_SUITE, SHARED_ATTRIBUTION_SOURCED_SUITE, SHARED_ATTRIBUTION_SUITE } from './brain-eval.shared-attribution.suite';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import { BRAIN_EVALUATION_SUITE } from './brain-eval.suite';
import { GOLDEN_CONVERSATION_RUBRIC, RUBRIC, type BrainEvaluationCase } from './brain-eval.types';
import {
  validateEvaluationSuite, validateGoldenConversationSuite, validateGoldenFocusedSuite, validateGoldenPathPairSuite, validateGoldenTargetedSuite, validateGoldenQualificationSuite, type ValidationReport,
} from './brain-eval.validation';

// ACE-01 (WP3) — the named suites of the ONE evaluation system: one validator bound, one harness, one CLI, one blinded
// review. The suite only chooses which synthetic cases, rubric and git-ignored artifact directory are used.

export interface EvaluationSuiteDefinition {
  readonly cases: ReadonlyArray<BrainEvaluationCase>;
  readonly rubric: ReadonlyArray<string>;
  readonly artifactDirectory: string;
  readonly validate: (cases: ReadonlyArray<BrainEvaluationCase>) => ValidationReport;
}

export const EVALUATION_SUITES = {
  'brain-bakeoff': { cases: BRAIN_EVALUATION_SUITE, rubric: RUBRIC, artifactDirectory: EVALUATION_ARTIFACT_DIRECTORY, validate: validateEvaluationSuite },
  'golden-conversations': {
    cases: GOLDEN_CONVERSATION_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC,
    artifactDirectory: GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY, validate: validateGoldenConversationSuite,
  },
} as const satisfies Readonly<Record<string, EvaluationSuiteDefinition>>;

export type EvaluationSuiteName = keyof typeof EVALUATION_SUITES;
export const DEFAULT_EVALUATION_SUITE: EvaluationSuiteName = 'brain-bakeoff';

export function resolveEvaluationSuite(name: string | undefined): EvaluationSuiteDefinition & { readonly name: EvaluationSuiteName } {
  const selected = name ?? DEFAULT_EVALUATION_SUITE;
  if (!Object.prototype.hasOwnProperty.call(EVALUATION_SUITES, selected)) {
    throw new Error(`Unknown evaluation suite: ${selected}. Known: ${Object.keys(EVALUATION_SUITES).join(', ')}.`);
  }
  return { name: selected as EvaluationSuiteName, ...EVALUATION_SUITES[selected as EvaluationSuiteName] };
}

/**
 * S8A-02 — what a DeepSeek-only run of a suite is, fixed in the registry rather than chosen on a command line: how many
 * attempts each case gets in one run, which guidance labels may run it, which approved spend round (and so which caps)
 * governs it, and what its blinded comparison sets side by side.
 */
export interface DeepSeekEvaluationSuiteDefinition extends EvaluationSuiteDefinition {
  readonly repeats: number;
  readonly labels: ReadonlyArray<DeepSeekEvaluationLabel>;
  readonly round: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /**
   * GUIDANCE: one case under two guidance labels. PATHS: one message on FAST and on DEEP under one label. QUALIFICATION (CP3):
   * one label, judged on its own against the preregistered criteria, with a blind human packet of one reply per case.
   */
  readonly comparison: 'GUIDANCE' | 'PATHS' | 'QUALIFICATION';
  /**
   * CP3: the transport timeout every attempt is sent with (the adapter's ceiling), so the full reply exists to be judged;
   * the production budget is recorded beside it and production delivery is decided afterwards. Never a production setting.
   */
  readonly transportBudgetMs?: number;
  /**
   * CP3 Arm L: a diagnostic re-send of the named suite's DEEP attempts that stopped at `length`, once each, with this DEEP
   * max_tokens and at most this many attempts. The evaluation router is composed with it; production config is untouched.
   */
  readonly diagnosticOf?: { readonly suite: string; readonly deepMaxOutputTokens: number; readonly maxAttempts: number };
  /** Stop the run, sending nothing more, once more than this many cases are INCONCLUSIVE (S8A-02 Shared attribution D3). */
  readonly stopWhenInconclusiveExceeds?: number;
}

const ROUND1 = { repeats: 1, labels: ['baseline', 'candidate'], round: 1, comparison: 'GUIDANCE' } as const;

// S8A-02 — the suites the DeepSeek-only path may run: every historical suite above, unchanged, plus the extended Golden suite
// (Round 1: the 22 Golden cases by reference and the 8-case supplement, validated by the same Golden validator) and the two
// Round 2 suites (Product Owner decision, 2026-10-21: core v2 against core v3, three repeats; the FAST / DEEP pairs on the
// core under test, two repeats). The historical registry and its two-provider `run` stay exactly as ACE-01 left them.
export const DEEPSEEK_EVALUATION_SUITES = {
  'brain-bakeoff': { ...EVALUATION_SUITES['brain-bakeoff'], ...ROUND1 },
  'golden-conversations': { ...EVALUATION_SUITES['golden-conversations'], ...ROUND1 },
  'golden-conversations-extended': {
    cases: GOLDEN_EXTENDED_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC,
    artifactDirectory: GOLDEN_EXTENDED_ARTIFACT_DIRECTORY, validate: validateGoldenConversationSuite, ...ROUND1,
  },
  'golden-round2': {
    cases: GOLDEN_ROUND2_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_ROUND2_ARTIFACT_DIRECTORY,
    validate: validateGoldenTargetedSuite, repeats: 3, labels: ['core-v2', 'core-v3'], round: 2, comparison: 'GUIDANCE',
  },
  'golden-round2-paths': {
    cases: GOLDEN_ROUND2_PATH_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_ROUND2_PATHS_ARTIFACT_DIRECTORY,
    validate: validateGoldenPathPairSuite, repeats: 2, labels: ['core-v3'], round: 2, comparison: 'PATHS',
  },
  // Round 3 (Product Owner Round 3 decisions, 2026-10-21; runs only after the final copy is approved verbatim): core v3
  // against core v3.1. Part A: the three Shared language rules, each in two conversations. Part B: gender without evidence
  // and declared brevity on DEEP. Three repeats; both parts share the one Round 3 guard (80 attempts, USD 0.22).
  'golden-round3-shared': {
    cases: GOLDEN_ROUND3_SHARED_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_ROUND3_SHARED_ARTIFACT_DIRECTORY,
    validate: validateGoldenFocusedSuite, repeats: 3, labels: ['core-v3', 'core-v3.1'], round: 3, comparison: 'GUIDANCE',
  },
  'golden-round3-personality': {
    cases: GOLDEN_ROUND3_PERSONALITY_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_ROUND3_PERSONALITY_ARTIFACT_DIRECTORY,
    validate: validateGoldenFocusedSuite, repeats: 3, labels: ['core-v3', 'core-v3.1'], round: 3, comparison: 'GUIDANCE',
  },
  // Shared attribution (Product Owner Shared Attribution Engineering Decision, 2026-10-21). Round 4 is the D2 probe: one
  // conversation on FAST and on DEEP, separated only, at most 2 attempts and USD 0.02. Round 5 is Part T (attribution),
  // merged against separated: 60 attempts and USD 0.12 (Attribution Probe Review D1); a run stops, sending nothing more,
  // once more than 2 of its 10 conversations are INCONCLUSIVE (D3). Round 6 is Part L (the Round 3 Shared language cases):
  // registered for the free checks only; the guard gives round 6 no caps, so it sends nothing until it is authorized.
  'shared-attribution-probe': {
    cases: SHARED_ATTRIBUTION_PROBE_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: SHARED_ATTRIBUTION_PROBE_ARTIFACT_DIRECTORY,
    validate: validateGoldenPathPairSuite, repeats: 1, labels: ['shared-separated'], round: 4, comparison: 'PATHS',
  },
  'shared-attribution': {
    cases: SHARED_ATTRIBUTION_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: SHARED_ATTRIBUTION_ARTIFACT_DIRECTORY,
    validate: validateGoldenFocusedSuite, repeats: 3, labels: ['shared-merged', 'shared-separated'], round: 5, comparison: 'GUIDANCE',
    stopWhenInconclusiveExceeds: 2,
  },
  'shared-attribution-language': {
    cases: GOLDEN_ROUND3_SHARED_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: SHARED_ATTRIBUTION_LANGUAGE_ARTIFACT_DIRECTORY,
    validate: validateGoldenFocusedSuite, repeats: 3, labels: ['shared-merged', 'shared-separated'], round: 6, comparison: 'GUIDANCE',
  },
  // Round 7 (Product Owner Shared Attribution Integrity decision, 2026-10-21): the focused check of the server-sourced
  // candidate against production on the five conversations that decide it. Approved by the Attribution Integrity Prototype
  // decision (D1, 2026-10-21): 30 attempts and USD 0.04 (the guard's round 7 caps, its own spend file); a run stops,
  // sending nothing more, once more than 1 of its 5 conversations is INCONCLUSIVE.
  'shared-attribution-sourced': {
    cases: SHARED_ATTRIBUTION_SOURCED_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: SHARED_ATTRIBUTION_SOURCED_ARTIFACT_DIRECTORY,
    validate: validateGoldenFocusedSuite, repeats: 3, labels: ['shared-merged', 'shared-sourced'], round: 7, comparison: 'GUIDANCE',
    stopWhenInconclusiveExceeds: 1,
  },
  // Round 8 (S8A-02 CP3, preregistration v2): the Personal qualification run, 39 cases × 3 on their production route (the
  // other 5 of the 44 reuse byte-identical Round 3 attempts), then Arm L. Registered for the free checks only until the
  // Product Owner approves the run: the guard holds no round 8 caps, so it sends nothing before that approval.
  'golden-cp3-personal': {
    cases: GOLDEN_CP3_PERSONAL_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_CP3_ARTIFACT_DIRECTORY,
    validate: validateGoldenQualificationSuite, repeats: 3, labels: ['core-v3.1'], round: 8, comparison: 'QUALIFICATION',
    transportBudgetMs: CP3_TRANSPORT_BUDGET_MS,
  },
  'golden-cp3-deep-2800': {
    cases: GOLDEN_CP3_PERSONAL_SUITE.filter((testCase) => testCase.path === 'DEEP'), rubric: GOLDEN_CONVERSATION_RUBRIC,
    artifactDirectory: GOLDEN_CP3_DIAGNOSTIC_ARTIFACT_DIRECTORY, validate: validateGoldenQualificationSuite, repeats: 3,
    labels: ['core-v3.1'], round: 8, comparison: 'QUALIFICATION', transportBudgetMs: CP3_TRANSPORT_BUDGET_MS,
    diagnosticOf: { suite: 'golden-cp3-personal', deepMaxOutputTokens: CP3_DIAGNOSTIC_DEEP_MAX_OUTPUT_TOKENS, maxAttempts: CP3_DIAGNOSTIC_MAX_ATTEMPTS },
  },
  // Round 9 (S8A-02 CP3 Final Integrated Correction, Product Owner, 2026-10-22): the acceptance run of the corrected Personal
  // guidance (core v3.2 with the leading preference block) and budgets, 44 cases × 3 on their production route, sent at the
  // PRODUCTION budgets (no transport override), so every time or token limit is a real production outcome. Registered for
  // the free checks only: the guard holds no round 9 caps, so it sends nothing before the Product Owner approves the run.
  'golden-cp3-correction': {
    cases: GOLDEN_CP3_CORRECTION_SUITE, rubric: GOLDEN_CONVERSATION_RUBRIC, artifactDirectory: GOLDEN_CP3_CORRECTION_ARTIFACT_DIRECTORY,
    validate: validateGoldenQualificationSuite, repeats: 3, labels: ['core-v3.2'], round: 9, comparison: 'QUALIFICATION',
  },
} as const satisfies Readonly<Record<string, DeepSeekEvaluationSuiteDefinition>>;

export type DeepSeekEvaluationSuiteName = keyof typeof DEEPSEEK_EVALUATION_SUITES;

export function resolveDeepSeekEvaluationSuite(name: string | undefined): DeepSeekEvaluationSuiteDefinition & { readonly name: DeepSeekEvaluationSuiteName } {
  if (name === undefined || !Object.prototype.hasOwnProperty.call(DEEPSEEK_EVALUATION_SUITES, name)) {
    throw new Error(`Unknown DeepSeek evaluation suite: ${name}. Known: ${Object.keys(DEEPSEEK_EVALUATION_SUITES).join(', ')}.`);
  }
  return { name: name as DeepSeekEvaluationSuiteName, ...DEEPSEEK_EVALUATION_SUITES[name as DeepSeekEvaluationSuiteName] };
}
