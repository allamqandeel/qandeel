import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assertGuidanceMatchesLabel, attemptKey, inconclusiveCaseIds, createGuidanceComparisonArtifacts, plannedAttempts, currentMessageOf, deepSeekEvaluationRequest, isDeepSeekEvaluationLabel,
  runDeepSeekEvaluation, summarizeDeepSeekRun, type DeepSeekEvaluationResult,
} from '../src/brain-eval/brain-eval.deepseek';
import {
  completionReport, createBlindPacket, guidanceGroups, ROUND3_MINIMUM_REPLIES, pathGroups, renderBlindPacketMarkdown, reviewForm, type BlindGroup,
} from '../src/brain-eval/brain-eval.round2-review';
import { resolveDeepSeekEvaluationSuite, resolveEvaluationSuite, type DeepSeekEvaluationSuiteDefinition } from '../src/brain-eval/brain-eval.suites';
import { CP3_REUSED_CASE_IDS, GOLDEN_CP3_QUALIFICATION_CASES } from '../src/brain-eval/brain-eval.golden-cp3.suite';
import {
  CP3_HUMAN_REVIEW_NOT_STARTED, cp3HumanReviewForm, createCp3Packets, renderCp3HumanPacketMarkdown, type CP3RecordedResult,
} from '../src/brain-eval/brain-eval.cp3-review';
import { GOLDEN_ROUND3_PERSONALITY_ARTIFACT_DIRECTORY } from '../src/brain-eval/brain-eval.paths';
import { summarizeResults } from '../src/brain-eval/brain-eval.summary';
import { assertDeepSeekRunAllowed } from '../src/brain-eval/brain-eval.validation';
import type { BrainEvaluationCase, CandidateResult } from '../src/brain-eval/brain-eval.types';
import { decideFastDeepRoute } from '../src/intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { attributionLayerCommand } from './brain-eval-attribution-layer';
import { openDeepSeekEvaluationLedger, type LedgerRow } from './brain-eval-deepseek-ledger';

/** S8A-02: the spend / network guard preload (scripts/s8a-02/network-guard.cjs), when present. */
interface DeepSeekEvaluationGuard {
  readonly dry: boolean;
  /** The approved spend round whose caps this guard enforces (absent on a guard older than Round 2). */
  readonly round?: number;
  readonly spend: { attempts: Array<Record<string, unknown>>; spentPeakUsd: number; spentApplicableUsd: number };
  readonly run: { blocked: string[] };
  selfTest(): Promise<{ allBlocked: boolean; blockedBySelfTest: number; results: unknown[] }>;
  remainingAttempts(): number;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

async function deepSeekRun(suiteName: string | undefined, label: string | undefined): Promise<void> {
  const suite = resolveDeepSeekEvaluationSuite(suiteName);
  if (!isDeepSeekEvaluationLabel(label) || !suite.labels.includes(label)) {
    throw new Error(`Usage: brain-eval.ts deepseek-run ${suite.name} ${suite.labels.join('|')}`);
  }
  const guard = (globalThis as { __QANDEEL_DEEPSEEK_EVAL_GUARD__?: DeepSeekEvaluationGuard }).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  assertDeepSeekRunAllowed(process.env, guard !== undefined);
  if (guard === undefined) return;
  // The suite fixes its round; a guard enforcing another round's caps (or a pre-Round 2 guard on a Round 2 suite) refuses.
  if ((guard.round ?? 1) !== suite.round) throw new Error(`NOT RUN: the guard enforces round ${guard.round ?? 1} caps; ${suite.name} is round ${suite.round}.`);
  // CP3 Arm L: only the DEEP attempts of the qualification run that stopped at `length`, once each, capped.
  const cases = suite.diagnosticOf === undefined ? suite.cases : await diagnosticCases(suite.cases, suite.diagnosticOf, label);
  if (cases.length === 0) { console.log(`NOT RUN: ${suite.name} has nothing to re-send (no DEEP attempt stopped at length).`); return; }
  suite.validate(cases);
  assertGuidanceMatchesLabel(cases, label);
  const planned = plannedAttempts(cases, suite.repeats);
  if (suite.diagnosticOf !== undefined && planned > suite.diagnosticOf.maxAttempts) throw new Error(`NOT RUN: Arm L may send at most ${suite.diagnosticOf.maxAttempts} attempts; ${planned} selected.`);
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new Error('NOT RUN: the network guard self-test let a forbidden destination through.');
  if (!guard.dry && guard.remainingAttempts() < planned) {
    throw new Error(`NOT RUN: ${guard.remainingAttempts()} attempts remain under the cumulative cap; this run needs ${planned}.`);
  }
  console.log(`DEEPSEEK ${guard.dry ? 'DRY (zero sent)' : 'PAID'} RUN (${suite.name}, ${label}, round ${suite.round}): ${cases.length} cases, up to ${suite.repeats} repeats = ${planned} attempts, no retries.`);

  // S8A-02 Shared attribution D3: stop, sending nothing more, once more than the suite's limit of cases are INCONCLUSIVE.
  let stoppedEarly: string | null = null;
  const stopRule = (sofar: ReadonlyArray<DeepSeekEvaluationResult>) => {
    const inconclusive = inconclusiveCaseIds(cases, sofar, suite.repeats, ROUND3_MINIMUM_REPLIES);
    if (suite.stopWhenInconclusiveExceeds !== undefined && inconclusive.length > suite.stopWhenInconclusiveExceeds) {
      stoppedEarly ??= `${inconclusive.length} cases INCONCLUSIVE (more than ${suite.stopWhenInconclusiveExceeds}): ${inconclusive.join(', ')}`;
    }
    return stoppedEarly;
  };
  const ledger = await openDeepSeekEvaluationLedger(process.env,
    suite.diagnosticOf === undefined ? {} : { diagnosticDeepMaxOutputTokens: suite.diagnosticOf.deepMaxOutputTokens });
  const evidence = new Map<string, { attempts: Array<Record<string, unknown>>; ledger: ReadonlyArray<LedgerRow> }>();
  const startedAt = new Date().toISOString();
  let results: ReadonlyArray<DeepSeekEvaluationResult>;
  try {
    results = await runDeepSeekEvaluation(cases, label, {
      router: ledger.router,
      ...(suite.transportBudgetMs === undefined ? {} : { transportBudgetMs: suite.transportBudgetMs }),
      ...(suite.stopWhenInconclusiveExceeds === undefined ? {} : { stopWhen: stopRule }),
      attribute: async <T>(key: string, work: () => Promise<T>) => {
        const before = guard.spend.attempts.length;
        const outcome = await ledger.attribute(work);
        evidence.set(key, { attempts: guard.spend.attempts.slice(before), ledger: await ledger.ledgerRowsFor(outcome.userId) });
        if (outcome.error !== undefined) throw outcome.error;
        return outcome.value as T;
      },
    }, suite.repeats);
  } finally {
    await ledger.close();
  }

  // Controls: no case text or reply in the ledger evidence; nothing blocked beyond the self-test's own probes.
  const ledgerText = JSON.stringify([...evidence.values()].map((entry) => entry.ledger));
  const words = [...cases.map(currentMessageOf), ...results.map((result) => result.response)]
    .flatMap((text) => text.split(/\s+/u)).filter((word) => word.length >= 5);
  const directory = join(suite.artifactDirectory, 'deepseek', guard.dry ? `${label}-dry` : label);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'results.json'), JSON.stringify({
    suite: suite.name, label, round: suite.round, repeats: suite.repeats, dry: guard.dry, startedAt, finishedAt: new Date().toISOString(),
    gitHead: process.env.QANDEEL_EVAL_GIT_HEAD ?? null,
    stoppedEarly,
    transportBudgetMs: suite.transportBudgetMs ?? null,
    diagnosticOf: suite.diagnosticOf ?? null,
    guidanceSha256: Object.fromEntries(cases.map((testCase) => [testCase.id, sha256(deepSeekEvaluationRequest(testCase, label).behavioralGuidance)])),
    // S8A-02 Shared attribution: the context each case sent under this label (merged or separated), as a hash and a count.
    context: Object.fromEntries(cases.map((testCase) => {
      const { context } = deepSeekEvaluationRequest(testCase, label);
      return [testCase.id, { messages: context.length, sha256: sha256(JSON.stringify(context)) }];
    })),
    summary: summarizeDeepSeekRun(results),
    controls: {
      guardSelfTest: selfTest.allBlocked, blockedDuringRun: guard.run.blocked.slice(selfTest.blockedBySelfTest),
      contentInLedger: words.filter((word) => ledgerText.includes(word)).length,
      cumulativeAttempts: guard.spend.attempts.length, cumulativePeakUsd: guard.spend.spentPeakUsd, cumulativeApplicableUsd: guard.spend.spentApplicableUsd,
    },
    results: results.map((result) => ({ ...result, ...evidence.get(attemptKey(result.caseId, result.repeat, suite.repeats)) })),
  }, null, 2));
  const failed = results.filter((result) => !result.success).length;
  if (stoppedEarly !== null) console.log(`STOPPED EARLY, nothing more sent: ${stoppedEarly}.`);
  console.log(`COMPLETE: ${results.length} attempts (${failed} failed, not retried). Cumulative attempts ${guard.spend.attempts.length}; peak-rate USD ${guard.spend.spentPeakUsd.toFixed(6)}.`);
  console.log(`Local artifacts written under ${directory}.`);
}

/**
 * CP3 Arm L: the qualification run's DEEP attempts that stopped at `length` (read from the guard evidence recorded with
 * each attempt), each re-sent once: a case with n such stops runs n times (maxRepeats).
 */
async function diagnosticCases(
  candidates: ReadonlyArray<BrainEvaluationCase>, diagnostic: { suite: string; maxAttempts: number }, label: string,
): Promise<BrainEvaluationCase[]> {
  const source = resolveDeepSeekEvaluationSuite(diagnostic.suite);
  const recorded = JSON.parse(await readFile(join(source.artifactDirectory, 'deepseek', label, 'results.json'), 'utf8')) as {
    dry: boolean; results: Array<DeepSeekEvaluationResult & { attempts?: Array<{ finishReason?: string }> }>;
  };
  if (recorded.dry) throw new Error(`NOT RUN: ${diagnostic.suite} ${label} is a dry run; Arm L needs the paid qualification results.`);
  const stops = new Map<string, number>();
  for (const result of recorded.results) {
    if (result.path === 'DEEP' && result.attempts?.some((attempt) => attempt.finishReason === 'length')) stops.set(result.caseId, (stops.get(result.caseId) ?? 0) + 1);
  }
  return candidates.filter((testCase) => stops.has(testCase.id)).map((testCase) => ({ ...testCase, maxRepeats: stops.get(testCase.id) }));
}

/** CP3: the qualification packets (blind human set of one reply per case, AI-rater set of every reply) from the run + reuse. */
async function cp3Compare(suite: DeepSeekEvaluationSuiteDefinition & { readonly name: string }, directory: string): Promise<void> {
  const [label] = suite.labels;
  const own = JSON.parse(await readFile(join(directory, label, 'results.json'), 'utf8')) as { dry: boolean; results: CP3RecordedResult[] };
  // CP3 (round 8) adds the five byte-identical Round 3 attempts it reused; the correction (round 9) reuses no attempt.
  const packets = suite.name === 'golden-cp3-personal'
    ? createCp3Packets(GOLDEN_CP3_QUALIFICATION_CASES, own.results, (JSON.parse(await readFile(join(GOLDEN_ROUND3_PERSONALITY_ARTIFACT_DIRECTORY, 'deepseek', 'core-v3.1', 'results.json'), 'utf8')) as { results: CP3RecordedResult[] })
      .results.filter((result) => (CP3_REUSED_CASE_IDS as readonly string[]).includes(result.caseId)), randomBytes(24).toString('hex'))
    : createCp3Packets(suite.cases, own.results, [], randomBytes(24).toString('hex'));
  const suiteName = suite.name;
  const [review, unblinded] = [join(directory, 'review'), join(directory, 'unblinded')];
  await Promise.all([mkdir(review, { recursive: true }), mkdir(unblinded, { recursive: true })]);
  await Promise.all([
    writeFile(join(review, 'human-packet.md'), renderCp3HumanPacketMarkdown(packets.human)),
    writeFile(join(review, 'human-packet.json'), JSON.stringify(packets.human, null, 2)),
    writeFile(join(review, 'human-review-form.json'), JSON.stringify(cp3HumanReviewForm(packets.human), null, 2)),
    writeFile(join(review, 'human-review-status.json'), JSON.stringify(CP3_HUMAN_REVIEW_NOT_STARTED, null, 2)),
    writeFile(join(review, 'ai-rater-packet.json'), JSON.stringify(packets.aiRater, null, 2)),
    writeFile(join(unblinded, 'item-map.json'), JSON.stringify({ suite: suiteName, dry: own.dry, ...packets.map }, null, 2)),
    writeFile(join(unblinded, 'delivery.json'), JSON.stringify(packets.delivery, null, 2)),
  ]);
  console.log(`CP3 PACKETS WRITTEN: ${packets.human.length} human items, ${packets.aiRater.length} AI-rater items under ${review}; the map and delivery under ${unblinded}.`);
  console.log('HUMAN REVIEW: NOT STARTED. Only the reviewer completes it; no command marks it complete.');
}

async function deepSeekCompare(suiteName: string | undefined): Promise<void> {
  const suite = resolveDeepSeekEvaluationSuite(suiteName);
  const directory = join(suite.artifactDirectory, 'deepseek');
  const load = async (label: string) => JSON.parse(await readFile(join(directory, label, 'results.json'), 'utf8')) as { results: DeepSeekEvaluationResult[]; summary: unknown };
  if (suite.comparison === 'QUALIFICATION') return cp3Compare(suite, directory);
  if (suite.round >= 2) return round2Compare(suite.name, suite.comparison, suite.cases, suite.labels, directory, load);
  const [baseline, candidate] = [await load('baseline'), await load('candidate')];
  const { blindedReview, labelMap } = createGuidanceComparisonArtifacts(suite.cases, baseline.results, candidate.results, suite.rubric);
  await Promise.all([
    writeFile(join(directory, 'blinded-review.json'), JSON.stringify(blindedReview, null, 2)),
    writeFile(join(directory, 'label-map.json'), JSON.stringify(labelMap, null, 2)),
    writeFile(join(directory, 'measured-comparison.json'), JSON.stringify({ baseline: baseline.summary, candidate: candidate.summary }, null, 2)),
  ]);
  console.log(`COMPARISON WRITTEN: blinded review, label map and measured comparison under ${directory}. No winner is selected by this command.`);
}

/**
 * S8A-02 Round 2: the blinded set packet. `review/` holds only what a reviewer (the Product Owner, or the second AI rater)
 * may see: the packet and the empty form. `unblinded/` holds the label map, its random salt and the measured per-condition
 * facts; it is opened only after the review is complete.
 */
async function round2Compare(
  suiteName: string, comparison: 'GUIDANCE' | 'PATHS', cases: ReadonlyArray<BrainEvaluationCase>, labels: ReadonlyArray<string>, directory: string,
  load: (label: string) => Promise<{ results: DeepSeekEvaluationResult[]; summary: unknown }>,
): Promise<void> {
  let groups: BlindGroup[];
  let measured: Record<string, unknown>;
  if (comparison === 'GUIDANCE') {
    const [firstLabel, secondLabel] = labels;
    const [first, second] = [await load(firstLabel), await load(secondLabel)];
    groups = guidanceGroups(cases, first.results, second.results, [firstLabel, secondLabel]);
    measured = { [firstLabel]: first.summary, [secondLabel]: second.summary };
  } else {
    const coreV3 = await load('core-v3');
    groups = pathGroups(cases, coreV3.results);
    measured = { 'core-v3': coreV3.summary };
  }
  const { packet, labelMap } = createBlindPacket(groups, randomBytes(24).toString('hex'));
  // Failed attempts are counted apart and judged neither way; too few replies makes an item inconclusive (Round 3 D4).
  const completion = completionReport(groups, ROUND3_MINIMUM_REPLIES);
  const [review, unblinded] = [join(directory, 'review'), join(directory, 'unblinded')];
  await Promise.all([mkdir(review, { recursive: true }), mkdir(unblinded, { recursive: true })]);
  await Promise.all([
    writeFile(join(review, 'blinded-packet.json'), JSON.stringify(packet, null, 2)),
    writeFile(join(review, 'blinded-packet.md'), renderBlindPacketMarkdown(`QANDEEL — blinded review packet (${packet.length} items)`, packet)),
    writeFile(join(review, 'review-form.json'), JSON.stringify(reviewForm(packet), null, 2)),
    writeFile(join(unblinded, 'label-map.json'), JSON.stringify({ suite: suiteName, comparison, ...labelMap }, null, 2)),
    writeFile(join(unblinded, 'measured-comparison.json'), JSON.stringify(measured, null, 2)),
    writeFile(join(unblinded, 'completion.json'), JSON.stringify(completion, null, 2)),
  ]);
  console.log(`BLINDED PACKET WRITTEN: ${packet.length} items under ${review}; label map, measurements and completion under ${unblinded}. No winner is selected by this command.`);
  console.log(`COMPLETION: ${completion.inconclusiveItems.length} of ${groups.length} item(s) INCONCLUSIVE (fewer than ${completion.minimumReplies} replies in a set)${completion.inconclusiveItems.length ? `: ${completion.inconclusiveItems.join(', ')}` : ''}.`);
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
    const perRun = plannedAttempts(suite.cases, suite.repeats);
    console.log(`PLANNED (round ${suite.round}): ${suite.cases.length} cases, up to ${suite.repeats} repeats = ${perRun} DeepSeek calls per run (${suite.labels.join(', ')}). ZERO CALLS: no client was constructed.`);
    return;
  }
  if (command === 'deepseek-run') return deepSeekRun(process.argv[3], process.argv[4]);
  // S8A-02 / CP2 Round 10: the attribution-layer comparison (three arms, two call kinds) has its own commands.
  if (command?.startsWith('attribution-layer-')) return attributionLayerCommand(command, process.argv.slice(3));
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
  // S8A-03 (D1): the Anthropic / OpenAI bake-off `run` was removed with those providers; its recorded artifacts and the
  // offline commands over them (validate, dry-run, summarize) remain. Paid evaluation is DeepSeek only (`deepseek-run`).
  if (command === 'summarize') {
    const results = JSON.parse(await readFile(join(suite.artifactDirectory, 'results.json'), 'utf8')) as CandidateResult[];
    const reviews = JSON.parse(await readFile(join(suite.artifactDirectory, 'blinded-review.json'), 'utf8')) as Record<string, unknown>[];
    const summary = summarizeResults(results, reviews);
    await writeFile(join(suite.artifactDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`SUMMARY COMPLETE: evidence written to ${join(suite.artifactDirectory, 'summary.json')}; no production winner was selected.`);
    return;
  }
  throw new Error('Usage: brain-eval.ts validate|dry-run|summarize|deepseek-plan|deepseek-run|deepseek-compare [brain-bakeoff|golden-conversations|golden-conversations-extended|golden-round2|golden-round2-paths] [label]');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Brain evaluation command failed.');
  process.exitCode = 1;
});
