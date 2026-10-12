import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeModelRouter } from '../src/model-router/providers/anthropic/claude-model-router';
import { OpenAIModelRouter } from '../src/model-router/providers/openai/openai-model-router';
import { expectedRequestCount, runEvaluation, writeEvaluationArtifacts } from '../src/brain-eval/brain-eval.harness';
import { resolveEvaluationSuite } from '../src/brain-eval/brain-eval.suites';
import { summarizeResults } from '../src/brain-eval/brain-eval.summary';
import { assertPaidRunAllowed } from '../src/brain-eval/brain-eval.validation';
import type { CandidateResult } from '../src/brain-eval/brain-eval.types';

async function main(): Promise<void> {
  const command = process.argv[2];
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
  throw new Error('Usage: brain-eval.ts validate|dry-run|run|summarize [brain-bakeoff|golden-conversations]');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Brain evaluation command failed.');
  process.exitCode = 1;
});
