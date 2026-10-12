import { GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY, EVALUATION_ARTIFACT_DIRECTORY } from './brain-eval.paths';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import { BRAIN_EVALUATION_SUITE } from './brain-eval.suite';
import { GOLDEN_CONVERSATION_RUBRIC, RUBRIC, type BrainEvaluationCase } from './brain-eval.types';
import { validateEvaluationSuite, validateGoldenConversationSuite, type ValidationReport } from './brain-eval.validation';

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
