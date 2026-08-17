import { execFileSync } from 'node:child_process';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { CLAUDE_MAX_OUTPUT_TOKENS, CLAUDE_MAX_RETRIES } from '../model-router/providers/anthropic/claude-model-router.config';
import { OPENAI_MAX_OUTPUT_TOKENS, OPENAI_MAX_RETRIES } from '../model-router/providers/openai/openai-model-router.config';
import { expectedRequestCount } from './brain-eval.harness';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { EVALUATION_PRICING } from './brain-eval.pricing';
import type { BrainEvaluationCase } from './brain-eval.types';

export interface ValidationReport { caseCount: number; fastCount: number; deepCount: number; expectedPaidRequests: number; warnings: string[] }

export function validateEvaluationSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  if (cases.length < 20 || cases.length > 30) throw new Error('Evaluation suite must contain 20-30 cases.');
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (!/^(fast|deep)-[a-z0-9-]+$/u.test(testCase.id)) throw new Error(`Invalid stable case id: ${testCase.id}`);
    if (ids.has(testCase.id)) throw new Error(`Duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.context.length || testCase.context.at(-1)?.role !== 'USER') throw new Error(`${testCase.id} must end in a USER message.`);
    if (!testCase.reviewNotes.length) throw new Error(`${testCase.id} requires human-review notes.`);
  }
  if (!new BehavioralResponsePolicyService().buildTextGuidance().trim()) throw new Error('Production Behavioral Response Policy returned empty guidance.');
  if (CLAUDE_MAX_OUTPUT_TOKENS !== OPENAI_MAX_OUTPUT_TOKENS) throw new Error('Provider output token bounds differ.');
  if (CLAUDE_MAX_RETRIES !== 0 || OPENAI_MAX_RETRIES !== 0) throw new Error('Evaluation requires zero hidden retries.');
  const ignored = execFileSync('git', ['-C', REPOSITORY_ROOT, 'check-ignore', '-q', 'artifacts/evals/probe.json'], { stdio: 'ignore' });
  void ignored;
  const warnings = Object.values(EVALUATION_PRICING).flatMap((paths) => Object.values(paths)).filter((price) => !price.verified).map((price) => price.note);
  return {
    caseCount: cases.length,
    fastCount: cases.filter(({ path }) => path === 'FAST').length,
    deepCount: cases.filter(({ path }) => path === 'DEEP').length,
    expectedPaidRequests: expectedRequestCount(cases),
    warnings: [...new Set(warnings)],
  };
}

export function assertPaidRunAllowed(environment: NodeJS.ProcessEnv): void {
  if (environment.QANDEEL_ALLOW_PAID_EVAL !== '1') throw new Error('NOT RUN: QANDEEL_ALLOW_PAID_EVAL=1 is required. No paid evaluation ran.');
  if (!environment.ANTHROPIC_API_KEY?.trim()) throw new Error('NOT RUN: ANTHROPIC_API_KEY is required. No provider calls were made.');
  if (!environment.OPENAI_API_KEY?.trim()) throw new Error('NOT RUN: OPENAI_API_KEY is required. No provider calls were made.');
}
