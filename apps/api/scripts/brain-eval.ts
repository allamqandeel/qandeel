import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeModelRouter } from '../src/model-router/providers/anthropic/claude-model-router';
import { OpenAIModelRouter } from '../src/model-router/providers/openai/openai-model-router';
import { EVALUATION_ARTIFACT_DIRECTORY, expectedRequestCount, runEvaluation, writeEvaluationArtifacts } from '../src/brain-eval/brain-eval.harness';
import { BRAIN_EVALUATION_SUITE } from '../src/brain-eval/brain-eval.suite';
import { summarizeResults } from '../src/brain-eval/brain-eval.summary';
import { assertPaidRunAllowed, validateEvaluationSuite } from '../src/brain-eval/brain-eval.validation';
import type { CandidateResult } from '../src/brain-eval/brain-eval.types';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'validate' || command === 'dry-run') {
    const report = validateEvaluationSuite(BRAIN_EVALUATION_SUITE);
    console.log(`VALID: ${report.caseCount} synthetic cases (${report.fastCount} FAST, ${report.deepCount} DEEP).`);
    console.log(`PLANNED: ${report.expectedPaidRequests} bounded provider requests in a paid run.`);
    for (const warning of report.warnings) console.log(`PRICING WARNING: ${warning}`);
    console.log('ZERO CALLS: validation/dry-run never constructs a provider client.');
    return;
  }
  if (command === 'run') {
    const planned = expectedRequestCount(BRAIN_EVALUATION_SUITE);
    console.log(`PLANNED PAID REQUESTS: ${planned}. This command will incur provider cost.`);
    assertPaidRunAllowed(process.env);
    validateEvaluationSuite(BRAIN_EVALUATION_SUITE);
    const results = await runEvaluation(BRAIN_EVALUATION_SUITE, { ANTHROPIC: ClaudeModelRouter.fromEnvironment(), OPENAI: OpenAIModelRouter.fromEnvironment() });
    await writeEvaluationArtifacts(BRAIN_EVALUATION_SUITE, results);
    console.log(`COMPLETE: ${results.length} attempts. Local artifacts written under artifacts/evals/.`);
    return;
  }
  if (command === 'summarize') {
    const results = JSON.parse(await readFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'results.json'), 'utf8')) as CandidateResult[];
    const reviews = JSON.parse(await readFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'blinded-review.json'), 'utf8')) as Record<string, unknown>[];
    const summary = summarizeResults(results, reviews);
    await writeFile(join(EVALUATION_ARTIFACT_DIRECTORY, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('SUMMARY COMPLETE: evidence written to artifacts/evals/summary.json; no production winner was selected.');
    return;
  }
  throw new Error('Usage: brain-eval.ts validate|dry-run|run|summarize');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Brain evaluation command failed.');
  process.exitCode = 1;
});
