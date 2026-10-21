import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeModelRouter } from '../src/model-router/providers/anthropic/claude-model-router';
import { OpenAIModelRouter } from '../src/model-router/providers/openai/openai-model-router';
import { expectedRequestCount, runEvaluation, writeEvaluationArtifacts } from '../src/brain-eval/brain-eval.harness';
import {
  createGuidanceComparisonArtifacts, currentMessageOf, deepSeekEvaluationRequest, isDeepSeekEvaluationLabel, runDeepSeekEvaluation,
  summarizeDeepSeekRun, type DeepSeekEvaluationResult,
} from '../src/brain-eval/brain-eval.deepseek';
import { resolveDeepSeekEvaluationSuite, resolveEvaluationSuite } from '../src/brain-eval/brain-eval.suites';
import { summarizeResults } from '../src/brain-eval/brain-eval.summary';
import { assertDeepSeekRunAllowed, assertPaidRunAllowed } from '../src/brain-eval/brain-eval.validation';
import type { CandidateResult } from '../src/brain-eval/brain-eval.types';
import { decideFastDeepRoute } from '../src/intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { openDeepSeekEvaluationLedger, type LedgerRow } from './brain-eval-deepseek-ledger';

/** S8A-02: the spend / network guard preload (scripts/s8a-02/network-guard.cjs), when present. */
interface DeepSeekEvaluationGuard {
  readonly dry: boolean;
  readonly spend: { attempts: Array<Record<string, unknown>>; spentPeakUsd: number; spentApplicableUsd: number };
  readonly run: { blocked: string[] };
  selfTest(): Promise<{ allBlocked: boolean; blockedBySelfTest: number; results: unknown[] }>;
  remainingAttempts(): number;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

async function deepSeekRun(suiteName: string | undefined, label: string | undefined): Promise<void> {
  const suite = resolveDeepSeekEvaluationSuite(suiteName);
  if (!isDeepSeekEvaluationLabel(label)) throw new Error('Usage: brain-eval.ts deepseek-run <suite> baseline|candidate');
  const guard = (globalThis as { __QANDEEL_DEEPSEEK_EVAL_GUARD__?: DeepSeekEvaluationGuard }).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  assertDeepSeekRunAllowed(process.env, guard !== undefined);
  if (guard === undefined) return;
  suite.validate(suite.cases);
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new Error('NOT RUN: the network guard self-test let a forbidden destination through.');
  if (!guard.dry && guard.remainingAttempts() < suite.cases.length) {
    throw new Error(`NOT RUN: ${guard.remainingAttempts()} attempts remain under the cumulative cap; this run needs ${suite.cases.length}.`);
  }
  console.log(`DEEPSEEK ${guard.dry ? 'DRY (zero sent)' : 'PAID'} RUN (${suite.name}, ${label}): ${suite.cases.length} cases, one attempt each, no retries.`);

  const ledger = await openDeepSeekEvaluationLedger(process.env);
  const evidence = new Map<string, { attempts: Array<Record<string, unknown>>; ledger: ReadonlyArray<LedgerRow> }>();
  const startedAt = new Date().toISOString();
  let results: ReadonlyArray<DeepSeekEvaluationResult>;
  try {
    results = await runDeepSeekEvaluation(suite.cases, label, {
      router: ledger.router,
      attribute: async <T>(caseId: string, work: () => Promise<T>) => {
        const before = guard.spend.attempts.length;
        const outcome = await ledger.attribute(work);
        evidence.set(caseId, { attempts: guard.spend.attempts.slice(before), ledger: await ledger.ledgerRowsFor(outcome.userId) });
        if (outcome.error !== undefined) throw outcome.error;
        return outcome.value as T;
      },
    });
  } finally {
    await ledger.close();
  }

  // Controls: no case text or reply in the ledger evidence; nothing blocked beyond the self-test's own probes.
  const ledgerText = JSON.stringify([...evidence.values()].map((entry) => entry.ledger));
  const words = [...suite.cases.map(currentMessageOf), ...results.map((result) => result.response)]
    .flatMap((text) => text.split(/\s+/u)).filter((word) => word.length >= 5);
  const directory = join(suite.artifactDirectory, 'deepseek', guard.dry ? `${label}-dry` : label);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'results.json'), JSON.stringify({
    suite: suite.name, label, dry: guard.dry, startedAt, finishedAt: new Date().toISOString(),
    gitHead: process.env.QANDEEL_EVAL_GIT_HEAD ?? null,
    guidanceSha256: Object.fromEntries(suite.cases.map((testCase) => [testCase.id, sha256(deepSeekEvaluationRequest(testCase).behavioralGuidance)])),
    summary: summarizeDeepSeekRun(results),
    controls: {
      guardSelfTest: selfTest.allBlocked, blockedDuringRun: guard.run.blocked.slice(selfTest.blockedBySelfTest),
      contentInLedger: words.filter((word) => ledgerText.includes(word)).length,
      cumulativeAttempts: guard.spend.attempts.length, cumulativePeakUsd: guard.spend.spentPeakUsd, cumulativeApplicableUsd: guard.spend.spentApplicableUsd,
    },
    results: results.map((result) => ({ ...result, ...evidence.get(result.caseId) })),
  }, null, 2));
  const failed = results.filter((result) => !result.success).length;
  console.log(`COMPLETE: ${results.length} cases (${failed} failed, not retried). Cumulative attempts ${guard.spend.attempts.length}; peak-rate USD ${guard.spend.spentPeakUsd.toFixed(6)}.`);
  console.log(`Local artifacts written under ${directory}.`);
}

async function deepSeekCompare(suiteName: string | undefined): Promise<void> {
  const suite = resolveDeepSeekEvaluationSuite(suiteName);
  const directory = join(suite.artifactDirectory, 'deepseek');
  const load = async (label: string) => JSON.parse(await readFile(join(directory, label, 'results.json'), 'utf8')) as { results: DeepSeekEvaluationResult[]; summary: unknown };
  const [baseline, candidate] = [await load('baseline'), await load('candidate')];
  const { blindedReview, labelMap } = createGuidanceComparisonArtifacts(suite.cases, baseline.results, candidate.results, suite.rubric);
  await Promise.all([
    writeFile(join(directory, 'blinded-review.json'), JSON.stringify(blindedReview, null, 2)),
    writeFile(join(directory, 'label-map.json'), JSON.stringify(labelMap, null, 2)),
    writeFile(join(directory, 'measured-comparison.json'), JSON.stringify({ baseline: baseline.summary, candidate: candidate.summary }, null, 2)),
  ]);
  console.log(`COMPARISON WRITTEN: blinded review, label map and measured comparison under ${directory}. No winner is selected by this command.`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  // S8A-02: the DeepSeek-only path (guidance before / after on one model). `deepseek-plan` constructs nothing.
  if (command === 'deepseek-plan') {
    const suite = resolveDeepSeekEvaluationSuite(process.argv[3]);
    suite.validate(suite.cases);
    for (const testCase of suite.cases) {
      const request = deepSeekEvaluationRequest(testCase);
      const route = decideFastDeepRoute(currentMessageOf(testCase));
      console.log(`${testCase.id}: ${testCase.world?.kind ?? 'PERSONAL'} ${testCase.path} (${request.latencyBudgetMs} ms); production route ${route.path}${route.path === testCase.path ? '' : ' (differs)'}`);
    }
    console.log(`PLANNED: ${suite.cases.length} DeepSeek calls per run (baseline, candidate). ZERO CALLS: no client was constructed.`);
    return;
  }
  if (command === 'deepseek-run') return deepSeekRun(process.argv[3], process.argv[4]);
  if (command === 'deepseek-compare') return deepSeekCompare(process.argv[3]);
  // ACE-01 (WP3): an optional suite name selects a named suite of the same system; the default is the Brain Bake-off.
  const suite = resolveEvaluationSuite(process.argv[3]);
  if (command === 'validate' || command === 'dry-run') {
    const report = suite.validate(suite.cases);
    console.log(`SUITE: ${suite.name}.`);
    console.log(`VALID: ${report.caseCount} synthetic cases (${report.fastCount} FAST, ${report.deepCount} DEEP).`);
    console.log(`PLANNED: ${report.expectedPaidRequests} bounded provider requests in a paid run.`);
    for (const warning of report.warnings) console.log(`PRICING WARNING: ${warning}`);
    console.log('ZERO CALLS: validation/dry-run never constructs a provider client.');
    return;
  }
  if (command === 'run') {
    const planned = expectedRequestCount(suite.cases);
    console.log(`PLANNED PAID REQUESTS (${suite.name}): ${planned}. This command will incur provider cost.`);
    assertPaidRunAllowed(process.env);
    suite.validate(suite.cases);
    const results = await runEvaluation(suite.cases, { ANTHROPIC: ClaudeModelRouter.fromEnvironment(), OPENAI: OpenAIModelRouter.fromEnvironment() });
    await writeEvaluationArtifacts(suite.cases, results, suite.artifactDirectory, suite.rubric);
    console.log(`COMPLETE: ${results.length} attempts. Local artifacts written under ${suite.artifactDirectory}.`);
    return;
  }
  if (command === 'summarize') {
    const results = JSON.parse(await readFile(join(suite.artifactDirectory, 'results.json'), 'utf8')) as CandidateResult[];
    const reviews = JSON.parse(await readFile(join(suite.artifactDirectory, 'blinded-review.json'), 'utf8')) as Record<string, unknown>[];
    const summary = summarizeResults(results, reviews);
    await writeFile(join(suite.artifactDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`SUMMARY COMPLETE: evidence written to ${join(suite.artifactDirectory, 'summary.json')}; no production winner was selected.`);
    return;
  }
  throw new Error('Usage: brain-eval.ts validate|dry-run|run|summarize|deepseek-plan|deepseek-run|deepseek-compare [brain-bakeoff|golden-conversations|golden-conversations-extended] [baseline|candidate]');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Brain evaluation command failed.');
  process.exitCode = 1;
});
