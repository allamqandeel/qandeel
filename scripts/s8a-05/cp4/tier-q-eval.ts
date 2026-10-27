// S8A-05 CP4 — Tier Q: the preregistered quality evaluation of the Public @qandeel answer over a discussion thread
// (Controlled Amendment A-5(c); PREREGISTRATION.md). Operator-only: never a CI step, never imported by production code.
// Launched only by launch.mjs under scripts/s8a-02/network-guard.cjs (round 26).
//
// What runs is the APPLICATION's path, unchanged, from the server's context rows onwards: `publicQandeelContextOf` (0182's
// branch rows → the assembler's input), `PublicQandeelGenerator` (the canonical Safety Response Gate → the one Public
// assembler → the Model Router, inside the asker's AI-COST-01 attribution scope) and the router the Public World module
// composes for production, `DeepSeekModelRouter.forPublicQandeel` (DeepSeek Flash, family PUBLIC_QANDEEL_REPLY, zero
// retries, FAST 3 s / DEEP 25 s).
// DECLARED TEST SHORTCUTS: the context rows are built here from the case, in exactly 0182's shape (the database's branch,
// speaker and topic rows are proved by verify-migration-0182.mjs); the ledger is in memory (the family on the real ledger
// is proved by the same verifier and the AI-COST-01 contract); there is no database, no lease and no discussion write.
// Scoring here is the deterministic half (PREREGISTRATION.md §3). The raters' half (attribution, corrections, identity,
// language, the question, restraint) is tallied by tier-q-score.mjs from two blind raters' sheets.
// A refusal by the guard, or anything but exactly one provider attempt per answered case, ends the run as INCOMPLETE.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AiProviderCallAccounting } from '../../../apps/api/src/ai-usage/ai-provider-call-accounting';
import { SafetyResponseGateService } from '../../../apps/api/src/conversation/safety-response-gate.service';
import { DeepSeekModelRouter } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-model-router';
import { assemblePublicQandeelRequest } from '../../../apps/api/src/public-world/public-qandeel-model-input';
import { PublicQandeelGenerator, publicQandeelContextOf } from '../../../apps/api/src/public-world/public-qandeel-reply.service';
import { instructionsSha256, rowsOf, type Case } from './rows';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const DRY = process.env.QANDEEL_EVAL_DRY === '1';
const SIMULATED = process.env.QANDEEL_EVAL_SIMULATE === '1';
const RESULTS = process.env.QANDEEL_S8A05_RESULTS_PATH ?? '';
const CASES_PATH = join(__dirname, 'tier-q-cases.json');
if (!RESULTS) throw new Error('NOT RUN: QANDEEL_S8A05_RESULTS_PATH is required');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
/** The synthetic asker every call is paid by (never a real account). */
const ASKER = '00000000-0000-4000-8000-0000000c4505';

const casesText = readFileSync(CASES_PATH, 'utf8');
const casesSha = sha(casesText);
const doc = JSON.parse(casesText) as { version: number; cases: Case[] };
if (doc.version !== 1 || doc.cases.length !== 30) throw new Error('NOT RUN: not the preregistered set');
/** The words the model is instructed with, recomputed from the code that runs (PREREGISTRATION.md §1). */
const INSTRUCTIONS_SHA256 = instructionsSha256(doc.cases[0]);
/** PREREGISTRATION.md §3 — fixed before the run. */
const ACCEPT = Object.freeze({ answered: 29, maxInvalid: 1 });

interface Guard { readonly run: { readonly blocked: string[] }; readonly spend: { attempts: Json[] }; readonly maxAttempts: number; readonly costCapUsd: number; readonly round: number }
const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__ as Guard | undefined;

async function main() {
  if (process.env.QANDEEL_S8A05_TIER_Q_SHA256 !== casesSha) throw new Error('NOT RUN: the cases differ from the preregistered fingerprint');
  if (process.env.QANDEEL_S8A05_INSTRUCTIONS_SHA256 !== INSTRUCTIONS_SHA256) throw new Error('NOT RUN: the instructions differ from the preregistered fingerprint');
  if (!guard) throw new Error('NOT RUN: the network guard is not loaded');
  const results: Json = {
    mode: DRY ? 'dry' : SIMULATED ? 'simulated' : 'live', head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, startedAt: new Date().toISOString(),
    casesSha256: casesSha, instructionsSha256: INSTRUCTIONS_SHA256, guardRound: guard.round, caps: { attempts: guard.maxAttempts, usd: guard.costCapUsd }, accept: ACCEPT,
  };
  const ledger: Json[] = [];
  const settled: Json[] = [];
  const accounting = new AiProviderCallAccounting({ begin: async (record) => { ledger.push(record); }, settle: async (record) => { settled.push(record); } });
  const generator = new PublicQandeelGenerator(DeepSeekModelRouter.forPublicQandeel(undefined, accounting), new SafetyResponseGateService());
  const answers: Json[] = [];
  let incomplete: string | null = null;
  try {
    for (const [index, c] of doc.cases.entries()) {
      const context = publicQandeelContextOf(rowsOf(c, index));
      if (context === null) { incomplete = `${c.id}: the case does not parse as 0182 context rows`; break; }
      const request = assemblePublicQandeelRequest(context);
      const blockedBefore = guard.run.blocked.length;
      const attemptsBefore = guard.spend.attempts.length;
      const t0 = Date.now();
      const reply = await generator.generate(context, ASKER);
      const ms = Date.now() - t0;
      if (guard.run.blocked.length > blockedBefore) { incomplete = `${c.id}: the guard refused (${guard.run.blocked.at(-1)})`; break; }
      const made = guard.spend.attempts.length - attemptsBefore;
      // The Safety Gate may answer with its own deterministic words and call no provider: zero attempts is then correct.
      if (made > 1) { incomplete = `${c.id}: ${made} provider attempts instead of one`; break; }
      const a = guard.spend.attempts.at(-1);
      answers.push({
        id: c.id, kind: c.kind, language: c.language, traps: c.traps, path: request?.path ?? null, providerCalled: made === 1, ms,
        reply, invalid: reply === null ? 'NO_ANSWER' : null,
        attempt: made === 1 ? { requestBytes: a?.requestBytes, usage: a?.usage ?? null, peakUsd: a?.peakUsd ?? null, httpStatus: a?.httpStatus ?? null } : null,
        // Deterministic: no identifier of the fixture (post or version ids) ever comes back.
        leaksId: reply !== null && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu.test(reply),
      });
      console.log(`[s8a-05 cp4 tier-q] ${c.id} ${request?.path} -> ${reply === null ? 'NO_ANSWER' : `${reply.length} chars`}`);
    }
  } finally {
    const invalid = answers.filter((x) => x.invalid !== null);
    results.incomplete = incomplete ?? (answers.length === 30 ? null : `${answers.length} / 30 answers`);
    results.answered = { count: answers.length - invalid.length, of: 30, ids: invalid.map((x) => x.id) };
    results.invalid = { count: invalid.length, of: 30 };
    results.leaksId = answers.filter((x) => x.leaksId).map((x) => x.id);
    results.accounted = {
      records: ledger.length, settled: settled.length, providerCalls: answers.filter((x) => x.providerCalled).length,
      families: [...new Set(ledger.map((r) => r.featureFamily))],
      payers: [...new Set(ledger.map((r) => r.userId))],
      shared: ledger.filter((r) => r.sourceWorldId !== undefined || r.sourceSharedMaterialId !== undefined).length,
    };
    results.deterministic = {
      complete: results.incomplete === null,
      answered: results.answered.count >= ACCEPT.answered && invalid.length <= ACCEPT.maxInvalid,
      noIdentifier: results.leaksId.length === 0,
      oneRecordPerCall: ledger.length === results.accounted.providerCalls && settled.length === ledger.length,
      paidByTheAsker: ledger.every((r) => r.userId === ASKER && r.featureFamily === 'PUBLIC_QANDEEL_REPLY') && results.accounted.shared === 0,
    };
    results.deterministicMet = Object.values(results.deterministic).every(Boolean);
    results.answers = answers;
    results.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULTS), { recursive: true });
    writeFileSync(RESULTS, JSON.stringify(results, null, 2));
    console.log(`[s8a-05 cp4 tier-q] ${results.incomplete ?? 'complete'}; deterministic half ${results.deterministicMet ? 'MET' : 'NOT MET'}; results ${RESULTS}`);
  }
}
main().catch((error) => { console.error(`[s8a-05 cp4 tier-q] ${(error as Error).message}`); process.exit(1); });
