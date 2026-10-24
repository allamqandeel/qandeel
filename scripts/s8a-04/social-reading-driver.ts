// S8A-04 CP1 — the isolated real DeepSeek Flash Shared semantic reading (Product Owner D4 / D5, 2026-10-24). Operator-only:
// never a CI step, never imported by production code. Launched only by social-reading-launch.mjs under
// scripts/s8a-02/network-guard.cjs, round 18 (64 calls, USD 0.15 — a ceiling, not a target; one spend-state file for every
// stage).
//
// Each synthetic scenario is read twice, by the SAME accounted DeepSeek client on the local AI-COST-01 ledger:
//   B — CP1 as shipped: the input the place pass composes (`sharedSemanticSpeakers` over synthetic resolver authors and the
//       visible Names), read by the production `DeepSeekSharedSemanticInterpreter`, feature family SHARED_SEMANTIC_READING.
//   A — the SHARED-VIS-01 input (the words only: no writers, no "from"), with the same instructions minus the authorship
//       sentences, the same schema and envelope. A is a comparison arm and nothing else.
// Both answers pass the production decoder. Recorded per call: the decoded places (or why none), the latency and the ledger
// rows of its synthetic account. The scenarios' criteria are never sent; blind raters read them later.
//
// Nothing here retries a call. The run stops early on two provider failures. Identity confusion is a rater's finding, so
// the stop rule acts between stages: a later stage runs only on the operator's explicit, recorded reason.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDeepSeekEvaluationLedger } from '../../apps/api/scripts/brain-eval-deepseek-ledger';
import { accountedDeepSeekChatCompletionsClient } from '../../apps/api/src/ai-usage/accounted-provider-clients';
import { sharedSemanticSpeakers } from '../../apps/api/src/connected-worlds/material-commit/shared-semantic-place.service';
import {
  createDeepSeekClient, deepSeekJsonContent, deepSeekJsonRequest, escapeDeepSeekData,
} from '../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import {
  DeepSeekSharedSemanticInterpreter, SHARED_SEMANTIC_READING_AUTHORSHIP, SHARED_SEMANTIC_READING_INSTRUCTIONS, SharedSemanticReadingProviderError,
  sharedSemanticReadingSchema,
} from '../../apps/api/src/shared-world/deepseek-shared-semantic-interpreter';
import {
  SHARED_SEMANTIC_INTERPRETATION_CONTRACT, decodeSharedSemanticReading, type SharedSemanticInput,
} from '../../apps/api/src/shared-world/shared-semantic-interpreter';
import { loadSharedSemanticReadingDeepSeekConfig } from '../../apps/api/src/shared-world/shared-semantic-interpreter-provider.config';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
class StopError extends Error {}

const ROUND = 18;
const MAX_ATTEMPTS = 64;
const COST_CAP_USD = 0.15;
const PROVIDER_FAILURES_STOP = 2;

interface Scenario {
  readonly id: string;
  readonly people: Record<string, string>;
  readonly messages: ReadonlyArray<readonly [string, string]>;
  readonly existing: ReadonlyArray<{ readonly meaning: string; readonly sources: ReadonlyArray<number> }>;
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StopError(`${name} is required`);
  return value;
}

/** The arm-A instructions: CP1's, with exactly the authorship sentences removed (proved, not assumed). */
function armAInstructions(): string {
  const removed = SHARED_SEMANTIC_READING_INSTRUCTIONS.replace(` ${SHARED_SEMANTIC_READING_AUTHORSHIP}`, '');
  if (removed === SHARED_SEMANTIC_READING_INSTRUCTIONS || removed.includes('speaker token')) throw new StopError('the arm-A instructions could not be derived');
  return removed;
}

/** The production input for one scenario: synthetic resolver authors, the pass's own speaker derivation. */
function compose(scenario: Scenario): { input: SharedSemanticInput; authorOf: Record<string, string> } {
  const authorOf = Object.fromEntries(Object.keys(scenario.people).map((person) => [person, randomUUID()]));
  const visible = scenario.messages.map(([person, text], index) => ({
    materialId: randomUUID(), kind: 'HUMAN_TEXT', text, establishedAt: new Date(Date.UTC(2026, 9, 24, 10, index)).toISOString(), author: authorOf[person],
  }));
  const names = visible.map((material, index) => ({ materialId: material.materialId, authorName: scenario.people[scenario.messages[index][0]] }));
  const speakers = sharedSemanticSpeakers(visible, visible, names);
  return {
    authorOf,
    input: Object.freeze({
      contract: SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
      writers: speakers.writers,
      contributions: visible.map((material, index) => Object.freeze({ ref: index + 1, from: speakers.tokens[index], text: material.text })),
      existing: scenario.existing.map((meaning) => Object.freeze({ meaning: meaning.meaning, sourceRefs: [...meaning.sources] })),
    }),
  };
}

async function main(): Promise<void> {
  const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  if (!guard) throw new StopError('the spend / network guard is not preloaded');
  if (guard.round !== ROUND || ((guard.maxAttempts !== MAX_ATTEMPTS || guard.costCapUsd !== COST_CAP_USD) && !guard.simulated)) {
    throw new StopError(`guard round ${guard.round} with ${guard.maxAttempts} / ${guard.costCapUsd} is not round ${ROUND} (${MAX_ATTEMPTS}, USD ${COST_CAP_USD})`);
  }
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new StopError(`guard self-test did not block every transport: ${JSON.stringify(selfTest.results)}`);

  const scenariosText = readFileSync(env('QANDEEL_S8A04_SCENARIOS_FILE'), 'utf8');
  const scenariosSha256 = createHash('sha256').update(JSON.stringify(JSON.parse(scenariosText))).digest('hex');
  if (scenariosSha256 !== env('QANDEEL_S8A04_SCENARIOS_SHA256')) throw new StopError('the scenario file changed after the launcher fixed it');
  const all: Scenario[] = JSON.parse(scenariosText).scenarios;
  const only = process.env.QANDEEL_S8A04_ONLY?.split(',').filter(Boolean) ?? [];
  const scenarios = only.length ? all.filter((scenario) => only.includes(scenario.id)) : all;
  if (only.length && scenarios.length !== only.length) throw new StopError(`unknown scenario in ${only.join(',')}`);
  const arms = (process.env.QANDEEL_S8A04_ARMS ?? 'B,A').split(',');
  if (!arms.length || arms.some((arm) => arm !== 'A' && arm !== 'B')) throw new StopError('arms must be A and/or B');
  const repeat = Number(process.env.QANDEEL_S8A04_REPEAT ?? '1');
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 4) throw new StopError('repeat must be 1..4');
  const planned = scenarios.length * arms.length * repeat;
  if (!guard.dry && planned > guard.remainingAttempts()) throw new StopError(`${planned} calls planned, ${guard.remainingAttempts()} attempts remain under round ${ROUND}`);

  const config = loadSharedSemanticReadingDeepSeekConfig(process.env);
  const ledger = await openDeepSeekEvaluationLedger(process.env);
  const client = accountedDeepSeekChatCompletionsClient(createDeepSeekClient(config), 'SHARED_SEMANTIC_READING', ledger.accounting);
  const interpreter = new DeepSeekSharedSemanticInterpreter(config, client);
  const armA = armAInstructions();
  const mode = guard.dry ? 'DRY' : guard.simulated ? 'SIMULATED' : 'LIVE';
  console.log(`[s8a-04 cp1] ${mode}: guard round ${guard.round} (${guard.maxAttempts} attempts, USD ${guard.costCapUsd}); self-test blocked ${selfTest.results.length}/${selfTest.results.length}; ${planned} calls planned`);

  const results: Json[] = [];
  let failures = 0;
  try {
    for (let pass = 1; pass <= repeat; pass += 1) {
      for (const scenario of scenarios) {
        const { input } = compose(scenario);
        for (const arm of arms) {
          if (failures >= PROVIDER_FAILURES_STOP) throw new StopError(`${failures} provider failures: stopped (no retries)`);
          const started = Date.now();
          const attributed = await ledger.attribute(async () => {
            if (arm === 'B') return interpreter.read(input, new AbortController().signal);
            const response = await client.chat.completions.create(deepSeekJsonRequest({
              instructions: armA,
              schema: sharedSemanticReadingSchema(input),
              data: `<shared_semantic_data>${escapeDeepSeekData({
                contributions: input.contributions.map((contribution) => ({ ref: contribution.ref, text: contribution.text })),
                existing: input.existing.map((meaning) => ({ meaning: meaning.meaning, sourceRefs: [...meaning.sourceRefs] })),
              })}</shared_semantic_data>`,
              maxTokens: config.maxOutputTokens,
            }), { timeout: config.timeoutMs, maxRetries: 0 });
            const content = deepSeekJsonContent(response);
            if (content === undefined) throw new SharedSemanticReadingProviderError('INVALID_STRUCTURED_OUTPUT');
            try { return JSON.parse(content); } catch { throw new SharedSemanticReadingProviderError('INVALID_STRUCTURED_OUTPUT'); }
          });
          const latencyMs = Date.now() - started;
          const rows = await ledger.ledgerRowsFor(attributed.userId);
          const failure = attributed.error === undefined ? null
            : attributed.error instanceof SharedSemanticReadingProviderError ? attributed.error.reason
              : (attributed.error as Json)?.code === 'S8A_02_NETWORK_FORBIDDEN' ? 'GUARD_REFUSED' : 'PROVIDER_ERROR';
          const decoded = failure === null ? decodeSharedSemanticReading(attributed.value, input) : null;
          if (failure !== null && failure !== 'GUARD_REFUSED') failures += 1;
          results.push({
            pass, scenario: scenario.id, arm, latencyMs, failure,
            // What arm B was told about who wrote what (arm A was told nothing of it): the tokens and the visible Names.
            writers: arm === 'B' ? input.writers : null, from: arm === 'B' ? input.contributions.map((contribution) => contribution.from) : null,
            decoded: failure === null ? (decoded === null ? 'REFUSED_BY_DECODER' : 'VALID') : null,
            places: decoded?.places ?? null,
            // The raw answer only when the production decoder refused it: what it said is the finding.
            refusedAnswer: failure === null && decoded === null ? attributed.value : undefined,
            ledger: rows.map((row) => ({ family: row.featureFamily, state: row.callState, usage: row.usage, completeness: row.usageCompleteness })),
          });
          console.log(`[s8a-04 cp1] pass ${pass} ${scenario.id} ${arm}: ${failure ?? (decoded === null ? 'REFUSED_BY_DECODER' : `${decoded.places.length} place(s)`)} in ${latencyMs} ms; ledger ${rows.map((row) => `${row.featureFamily}/${row.callState}`).join(',') || 'none'}`);
          if (guard.dry) throw new StopError('dry run: the guard refused the first call, as required');
        }
      }
    }
  } catch (error) {
    if (!(error instanceof StopError)) throw error;
    console.log(`[s8a-04 cp1] STOPPED: ${error.message}`);
  } finally {
    await ledger.close();
  }

  const path = env('QANDEEL_S8A04_RESULTS_PATH');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    mode, round: ROUND, gitHead: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, scenariosSha256, arms, repeat, scenarios: scenarios.map((scenario) => scenario.id),
    instructionsSha256: { B: createHash('sha256').update(SHARED_SEMANTIC_READING_INSTRUCTIONS).digest('hex'), A: createHash('sha256').update(armA).digest('hex') },
    config: { timeoutMs: config.timeoutMs, maxOutputTokens: config.maxOutputTokens },
    spend: { attempts: guard.spend.attempts.length, spentPeakUsd: guard.spend.spentPeakUsd, spentApplicableUsd: guard.spend.spentApplicableUsd },
    results,
  }, null, 2)}\n`);
  console.log(`[s8a-04 cp1] ${results.length} result(s) written; spend ${guard.spend.attempts.length} attempt(s), USD ${guard.spend.spentPeakUsd.toFixed(6)} at peak`);
}

main().catch((error) => {
  console.error(`[s8a-04 cp1] NOT COMPLETED: ${error instanceof StopError ? error.message : (error as Error)?.name ?? 'error'}`);
  process.exit(1);
});
