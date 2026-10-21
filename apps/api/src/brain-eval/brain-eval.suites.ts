import {
  EVALUATION_ARTIFACT_DIRECTORY, GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY, GOLDEN_EXTENDED_ARTIFACT_DIRECTORY, GOLDEN_ROUND2_ARTIFACT_DIRECTORY,
  GOLDEN_ROUND2_PATHS_ARTIFACT_DIRECTORY,
} from './brain-eval.paths';
import type { DeepSeekEvaluationLabel } from './brain-eval.deepseek';
import { GOLDEN_EXTENDED_SUITE } from './brain-eval.golden-extended.suite';
import { GOLDEN_ROUND2_PATH_SUITE, GOLDEN_ROUND2_SUITE } from './brain-eval.golden-round2.suite';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import { BRAIN_EVALUATION_SUITE } from './brain-eval.suite';
import { GOLDEN_CONVERSATION_RUBRIC, RUBRIC, type BrainEvaluationCase } from './brain-eval.types';
import {
  validateEvaluationSuite, validateGoldenConversationSuite, validateGoldenPathPairSuite, validateGoldenTargetedSuite, type ValidationReport,
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
  readonly round: 1 | 2;
  /** GUIDANCE: one case under two guidance labels. PATHS: one message on FAST and on DEEP under one label. */
  readonly comparison: 'GUIDANCE' | 'PATHS';
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
} as const satisfies Readonly<Record<string, DeepSeekEvaluationSuiteDefinition>>;

export type DeepSeekEvaluationSuiteName = keyof typeof DEEPSEEK_EVALUATION_SUITES;

export function resolveDeepSeekEvaluationSuite(name: string | undefined): DeepSeekEvaluationSuiteDefinition & { readonly name: DeepSeekEvaluationSuiteName } {
  if (name === undefined || !Object.prototype.hasOwnProperty.call(DEEPSEEK_EVALUATION_SUITES, name)) {
    throw new Error(`Unknown DeepSeek evaluation suite: ${name}. Known: ${Object.keys(DEEPSEEK_EVALUATION_SUITES).join(', ')}.`);
  }
  return { name: name as DeepSeekEvaluationSuiteName, ...DEEPSEEK_EVALUATION_SUITES[name as DeepSeekEvaluationSuiteName] };
}
