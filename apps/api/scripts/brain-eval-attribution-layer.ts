import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  ATTRIBUTION_LAYER_ARMS, ATTRIBUTION_LAYER_REPEATS, ATTRIBUTION_LAYER_TRANSPORT_MS, attributionLayerCases, createLayerBlindPacket, isAttributionLayerArm,
  joinLayerVerdicts, layerAttemptKey, layerReviewForm, measureLayerArm, plannedLayerCalls, runAttributionLayerArm, scoreAttributionLayer,
  type AttributionLayerArm, type LayerAttemptResult, type LayerItemReview, type LayerMapEntry,
} from '../src/brain-eval/brain-eval.shared-attribution-layer';
import { EVALUATION_ARTIFACT_DIRECTORY, REPOSITORY_ROOT } from '../src/brain-eval/brain-eval.paths';
import { assertDeepSeekRunAllowed } from '../src/brain-eval/brain-eval.validation';
import { openDeepSeekEvaluationLedger, type LedgerRow } from './brain-eval-deepseek-ledger';

// S8A-02 / CP2 Round 10 — the attribution-layer comparison commands of the ONE brain-eval system (operator-only; never a CI
// step; never imported by production code). Founder approval of the final test preparation, 2026-10-22: the commands may be
// built and dry-run; NO paid call runs until the Founder authorizes it, and the guard refuses round 10 live until then.
//
//   attribution-layer-plan                       the pinned 48 cases, tiers and calls per arm; constructs no client
//   attribution-layer-run B|S|S_R                one arm, under the guard (launcher: scripts/s8a-02/deepseek-eval.mjs)
//   attribution-layer-compare                    the blinded packet, the empty forms, the arm map and the measurements
//   attribution-layer-score <final-verdicts>     the pre-registered decision from the completed final verdicts

export const ATTRIBUTION_LAYER_ROUND = 10;
export const ATTRIBUTION_LAYER_ARTIFACT_DIRECTORY = resolve(EVALUATION_ARTIFACT_DIRECTORY, 'shared-attribution-layer');

interface Guard {
  readonly dry: boolean;
  readonly simulated?: boolean;
  readonly round?: number;
  readonly spend: { attempts: Array<Record<string, unknown>>; spentPeakUsd: number; spentApplicableUsd: number };
  readonly run: { blocked: string[] };
  selfTest(): Promise<{ allBlocked: boolean; blockedBySelfTest: number; results: unknown[] }>;
  remainingAttempts(): number;
}

const cases = () => attributionLayerCases((path) => readFileSync(join(REPOSITORY_ROOT, path), 'utf8'));
const simulatedMode = () => `simulated${process.env.QANDEEL_EVAL_SIMULATE_TAG ? `-${process.env.QANDEEL_EVAL_SIMULATE_TAG}` : ''}`;
const mode = (guard: Guard) => (guard.dry ? 'dry' : guard.simulated ? simulatedMode() : 'live');

/** Each recorded call beside the guard's own record of the same request (sequential within an attempt, so in order). */
function perCall(result: LayerAttemptResult, attempts: ReadonlyArray<Record<string, unknown>>) {
  return result.calls.map((call, index) => {
    const sent = attempts[index];
    return { ...call, guard: sent === undefined ? null : {
      n: sent.n, requestBytes: sent.requestBytes, maxTokens: sent.maxTokens, httpStatus: sent.httpStatus ?? null, finishReason: sent.finishReason ?? null,
      usage: sent.usage ?? null, transportError: sent.transportError ?? null, bodyError: sent.bodyError ?? null, headersMs: sent.headersMs ?? null, bodyMs: sent.bodyMs ?? null,
      peakUsd: sent.peakUsd ?? null, applicableUsd: sent.applicableUsd ?? null } };
  });
}
const armDirectory = (arm: AttributionLayerArm, runMode: string) => join(ATTRIBUTION_LAYER_ARTIFACT_DIRECTORY, 'deepseek', runMode === 'live' ? arm : `${arm}-${runMode}`);

function plan(): void {
  const all = cases();
  const planned = plannedLayerCalls(all);
  console.log(`PLANNED (round ${ATTRIBUTION_LAYER_ROUND}): ${all.length} cases, ${planned.gated} gated / ${planned.ungated} not; ${planned.repeats} repeats.`);
  for (const arm of ATTRIBUTION_LAYER_ARMS) console.log(`  ${arm}: ${JSON.stringify(planned.perArm[arm])}`);
  console.log(`  total: ${JSON.stringify(planned.total)}. ZERO CALLS: no client was constructed.`);
}

async function run(arm: string | undefined): Promise<void> {
  if (!isAttributionLayerArm(arm)) throw new Error(`Usage: brain-eval.ts attribution-layer-run ${ATTRIBUTION_LAYER_ARMS.join('|')}`);
  const guard = (globalThis as { __QANDEEL_DEEPSEEK_EVAL_GUARD__?: Guard }).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  assertDeepSeekRunAllowed(process.env, guard !== undefined);
  if (guard === undefined) return;
  if ((guard.round ?? 1) !== ATTRIBUTION_LAYER_ROUND) throw new Error(`NOT RUN: the guard enforces round ${guard.round ?? 1} caps; the attribution layer is round ${ATTRIBUTION_LAYER_ROUND}.`);
  const all = cases();
  const planned = plannedLayerCalls(all).perArm[arm];
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new Error('NOT RUN: the network guard self-test let a forbidden destination through.');
  if (!guard.dry && guard.remainingAttempts() < planned.providerCalls) {
    throw new Error(`NOT RUN: ${guard.remainingAttempts()} attempts remain under the cumulative cap; ${arm} needs up to ${planned.providerCalls} provider calls.`);
  }
  const runMode = mode(guard);
  console.log(`ATTRIBUTION LAYER ${runMode.toUpperCase()} RUN (round ${ATTRIBUTION_LAYER_ROUND}, arm ${arm}): ${planned.cases} cases x ${ATTRIBUTION_LAYER_REPEATS} = ${planned.attempts} attempts, up to ${planned.providerCalls} provider calls, no retries.`);

  // A cap refusal stops the arm at once: nothing more is sent, and the round is INCONCLUSIVE.
  let stoppedByCap: string | null = null;
  const stopWhen = () => {
    const capped = guard.run.blocked.slice(selfTest.blockedBySelfTest).find((what) => /^fetch:(?:attempt|cost)-cap$/u.test(what));
    if (capped !== undefined) stoppedByCap ??= capped;
    return stoppedByCap;
  };
  const ledger = await openDeepSeekEvaluationLedger(process.env);
  const evidence = new Map<string, { attempts: Array<Record<string, unknown>>; ledger: ReadonlyArray<LedgerRow> }>();
  const startedAt = new Date().toISOString();
  let results: LayerAttemptResult[];
  try {
    results = await runAttributionLayerArm(all, arm, {
      router: ledger.router,
      replyTransportMs: ATTRIBUTION_LAYER_TRANSPORT_MS.reply, readingTransportMs: ATTRIBUTION_LAYER_TRANSPORT_MS.reading,
      stopWhen,
      attribute: async <T>(key: string, work: () => Promise<T>) => {
        const before = guard.spend.attempts.length;
        const outcome = await ledger.attribute(work);
        evidence.set(key, { attempts: guard.spend.attempts.slice(before), ledger: await ledger.ledgerRowsFor(outcome.userId) });
        if (outcome.error !== undefined) throw outcome.error;
        return outcome.value as T;
      },
    });
  } finally {
    await ledger.close();
  }
  // Controls: no case text or reply in the ledger evidence; nothing blocked beyond the self-test's own probes and caps.
  const ledgerText = JSON.stringify([...evidence.values()].map((entry) => entry.ledger));
  const words = [...all.flatMap((testCase) => testCase.messages.map((message) => message.text)), ...results.map((result) => result.response)]
    .flatMap((text) => text.split(/\s+/u)).filter((word) => word.length >= 5);
  const directory = armDirectory(arm, runMode);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'results.json'), JSON.stringify({
    suite: 'shared-attribution-layer', arm, round: ATTRIBUTION_LAYER_ROUND, mode: runMode, repeats: ATTRIBUTION_LAYER_REPEATS,
    startedAt, finishedAt: new Date().toISOString(), gitHead: process.env.QANDEEL_EVAL_GIT_HEAD ?? null,
    transportBudgetMs: ATTRIBUTION_LAYER_TRANSPORT_MS, planned, stoppedByCap,
    measured: measureLayerArm(results),
    controls: {
      guardSelfTest: selfTest.allBlocked, blockedDuringRun: guard.run.blocked.slice(selfTest.blockedBySelfTest),
      contentInLedger: words.filter((word) => ledgerText.includes(word)).length,
      callsMatchGuardAttempts: results.every((result) => (evidence.get(layerAttemptKey(result.arm, result.caseId, result.repeat))?.attempts.length ?? 0) === result.calls.length),
      ...(guard.simulated ? { simulator: (globalThis as { __QANDEEL_SIMULATED_DEEPSEEK__?: { counts: unknown } }).__QANDEEL_SIMULATED_DEEPSEEK__?.counts ?? null } : {}),
      cumulativeAttempts: guard.spend.attempts.length, cumulativePeakUsd: guard.spend.spentPeakUsd, cumulativeApplicableUsd: guard.spend.spentApplicableUsd,
    },
    results: results.map((result) => {
      const found = evidence.get(layerAttemptKey(result.arm, result.caseId, result.repeat));
      return { ...result, calls: perCall(result, found?.attempts ?? []), guardAttemptsForThisAttempt: found?.attempts.length ?? 0, ledger: found?.ledger ?? [] };
    }),
  }, null, 2));
  const failed = results.filter((result) => !result.success).length;
  if (stoppedByCap !== null) console.log(`STOPPED BY CAP (${stoppedByCap}), nothing more sent: the round is INCONCLUSIVE.`);
  console.log(`COMPLETE: ${results.length} attempts (${failed} without a reply, not retried), ${results.reduce((sum, result) => sum + result.calls.length, 0)} provider calls. Cumulative guard attempts ${guard.spend.attempts.length}; peak-rate USD ${guard.spend.spentPeakUsd.toFixed(6)}.`);
  console.log(`Local artifacts written under ${directory}.`);
}

interface ArmFile { mode: string; stoppedByCap: string | null; measured: unknown; results: LayerAttemptResult[] }

async function loadArms(runMode: string): Promise<Record<AttributionLayerArm, ArmFile>> {
  const arms = {} as Record<AttributionLayerArm, ArmFile>;
  for (const arm of ATTRIBUTION_LAYER_ARMS) {
    const file = join(armDirectory(arm, runMode), 'results.json');
    if (!existsSync(file)) throw new Error(`NOT COMPARED: ${arm} has no ${runMode} results.`);
    arms[arm] = JSON.parse(await readFile(file, 'utf8')) as ArmFile;
  }
  return arms;
}

async function compare(runMode = 'live'): Promise<void> {
  if (runMode.startsWith('dry')) throw new Error('NOT COMPARED: a dry run has no replies.');
  const all = cases();
  const arms = await loadArms(runMode);
  const results = ATTRIBUTION_LAYER_ARMS.flatMap((arm) => arms[arm].results);
  const { packet, map } = createLayerBlindPacket(all, results, randomBytes(24).toString('hex'));
  const directory = join(ATTRIBUTION_LAYER_ARTIFACT_DIRECTORY, runMode === 'live' ? 'compare' : `compare-${runMode}`);
  const [review, unblinded] = [join(directory, 'review'), join(directory, 'unblinded')];
  await Promise.all([mkdir(review, { recursive: true }), mkdir(unblinded, { recursive: true })]);
  const markdown = packet.map((item) => [
    `## ${item.itemId}`, '', ...item.conversation.map((turn) => `- **${turn.speaker}:** ${turn.text.replace(/\n/gu, ' / ')}`), '',
    `**Key:** ${JSON.stringify(item.key)}`, '', ...item.replies.map((reply) => `- **${reply.replyId}:** ${reply.reply ?? reply.failure}`), '',
  ].join('\n')).join('\n');
  await Promise.all([
    writeFile(join(review, 'blinded-packet.json'), JSON.stringify(packet, null, 2)),
    writeFile(join(review, 'blinded-packet.md'), `# QANDEEL — attribution layer, blinded packet (${packet.length} items)\n\n${markdown}`),
    writeFile(join(review, 'ai-rater-form.json'), JSON.stringify(layerReviewForm(packet), null, 2)),
    writeFile(join(review, 'human-review-form.json'), JSON.stringify(layerReviewForm(packet), null, 2)),
    writeFile(join(review, 'human-review-status.json'), JSON.stringify({ state: 'NOT_STARTED', note: 'Only the Founder completes the human review; no command marks it complete.' }, null, 2)),
    writeFile(join(unblinded, 'arm-map.json'), JSON.stringify({ suite: 'shared-attribution-layer', mode: runMode, ...map }, null, 2)),
    writeFile(join(unblinded, 'measured.json'), JSON.stringify(Object.fromEntries(ATTRIBUTION_LAYER_ARMS.map((arm) => [arm, { measured: arms[arm].measured, stoppedByCap: arms[arm].stoppedByCap }])), null, 2)),
  ]);
  console.log(`BLINDED PACKET WRITTEN: ${packet.length} items, ${packet.reduce((sum, item) => sum + item.replies.length, 0)} replies under ${review}; the arm map and measurements under ${unblinded}.`);
  console.log('HUMAN REVIEW: NOT STARTED. No winner is selected by this command.');
}

async function score(finalVerdictsPath: string | undefined, runMode = 'live'): Promise<void> {
  if (finalVerdictsPath === undefined) throw new Error('Usage: brain-eval.ts attribution-layer-score <final-verdicts.json> [simulated]');
  const all = cases();
  const arms = await loadArms(runMode);
  const results = ATTRIBUTION_LAYER_ARMS.flatMap((arm) => arms[arm].results);
  const directory = join(ATTRIBUTION_LAYER_ARTIFACT_DIRECTORY, runMode === 'live' ? 'compare' : `compare-${runMode}`);
  const map = JSON.parse(await readFile(join(directory, 'unblinded', 'arm-map.json'), 'utf8')) as { items: Array<{ itemId: string; replies: LayerMapEntry[] }> };
  const verdicts = JSON.parse(await readFile(finalVerdictsPath, 'utf8')) as LayerItemReview[];
  const outcome = scoreAttributionLayer(joinLayerVerdicts(all, results, map, verdicts), results, ATTRIBUTION_LAYER_ARMS.some((arm) => arms[arm].stoppedByCap !== null));
  await writeFile(join(directory, 'unblinded', 'score.json'), JSON.stringify(outcome, null, 2));
  console.log(`S vs B: ${outcome.sVersusB.verdict}; S_R vs S: ${outcome.srVersusS.verdict}. Written to ${join(directory, 'unblinded', 'score.json')}. QAN-BL-AI-09 and S8A-02 stay open whatever the result.`);
}

export async function attributionLayerCommand(command: string, args: ReadonlyArray<string>): Promise<void> {
  if (command === 'attribution-layer-plan') return plan();
  if (command === 'attribution-layer-run') return run(args[0]);
  if (command === 'attribution-layer-compare') return compare(args[0]);
  if (command === 'attribution-layer-score') return score(args[0], args[1]);
  throw new Error(`Unknown attribution-layer command: ${command}`);
}
