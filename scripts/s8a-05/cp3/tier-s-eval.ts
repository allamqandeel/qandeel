// S8A-05 CP3 — Tier S / Tier P: the preregistered quality evaluation of the Public semantic interpretation (Controlled
// Amendment A-4; PREREGISTRATION.md). Operator-only: never a CI step, never imported by production code. Launched only by
// launch.mjs under scripts/s8a-02/network-guard.cjs (round 25).
//
// What runs is the APPLICATION's adapter, unchanged: `DeepSeekPublicSemanticInterpreter` (DeepSeek Flash, JSON Output, the
// closed schema, the configured timeout, zero retries) over the shared DeepSeek client, through the ONE AI-COST-01 accounted
// transport under the family PUBLIC_SEMANTIC_INTERPRETATION, inside a synthetic publisher's attribution scope, bounded by the
// service's own 20 s; every answer is decoded by the port's own strict decoders (`decodePublicSemanticProposal`,
// `decodePublicSemanticAssessment`), exactly as `PublicSemanticService` decodes it.
// DECLARED TEST SHORTCUTS: the package text is the case's fixed text (the database's package reader is proved by
// verify-migration-0181.mjs); the ledger is in memory (the 0181 family on the real ledger is proved by the same verifier and
// the AI-COST-01 contract); there is no database, no Experience and no publication; Tier P places the model's own profiles
// with the exact mirror of 0181's P-dom rule (`public-semantic-regions.ts`, proved equal to the SQL) in the case order.
// Scoring here is the deterministic half (PREREGISTRATION.md §3): the dominant major and sub-region against the fixed labels,
// the correction verdicts, Tier P's similar-closer and the compounds' dominant major. The raters' half (fidelity,
// fabrication, language, the compounds' secondary meaning) is tallied by tier-s-score.mjs from their blind sheets.
// A refusal by the guard, or anything but exactly one provider attempt per request, ends the run as INCOMPLETE.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { accountedDeepSeekChatCompletionsClient } from '../../../apps/api/src/ai-usage/accounted-provider-clients';
import { AiProviderCallAccounting } from '../../../apps/api/src/ai-usage/ai-provider-call-accounting';
import { runWithAiUsageAttribution } from '../../../apps/api/src/ai-usage/ai-usage-attribution';
import { createDeepSeekClient } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import {
  DeepSeekPublicSemanticInterpreter, PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS, PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS,
  PublicSemanticInterpretationProviderError,
} from '../../../apps/api/src/public-world/deepseek-public-semantic-interpreter';
import {
  PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, decodePublicSemanticAssessment, decodePublicSemanticProposal,
} from '../../../apps/api/src/public-world/public-semantic-interpreter';
import { loadPublicSemanticInterpretationDeepSeekConfig } from '../../../apps/api/src/public-world/public-semantic-interpreter-provider.config';
import { SEMANTIC_INTERPRETATION_TIMEOUT_MS } from '../../../apps/api/src/public-world/public-semantic.service';
import {
  PUBLIC_MAJOR_REGIONS, dominantSubRegion, hexSlot, latticePoint, publicSubRegion, type PublicRegionProfile,
} from '../../../apps/api/src/public-world/public-semantic-regions';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const DRY = process.env.QANDEEL_EVAL_DRY === '1';
const SIMULATED = process.env.QANDEEL_EVAL_SIMULATE === '1';
const RESULTS = process.env.QANDEEL_S8A05_RESULTS_PATH ?? '';
const CASES_PATH = join(__dirname, 'tier-s-cases.json');
if (!RESULTS) throw new Error('NOT RUN: QANDEEL_S8A05_RESULTS_PATH is required');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
/** The instructions the adapter sends, as one fingerprint (PREREGISTRATION.md). */
export const INSTRUCTIONS_SHA256 = sha(`${PUBLIC_SEMANTIC_PROPOSAL_INSTRUCTIONS}\n\n${PUBLIC_SEMANTIC_CORRECTION_INSTRUCTIONS}`);
/** The synthetic publisher every call is paid by (never a real account). */
const PUBLISHER = '00000000-0000-4000-8000-0000000c3505';

// ------------------------------------------------------------------------------------------- the preregistered set
export interface Case {
  readonly id: string; readonly kind: string; readonly language: string; readonly traps: string[]; readonly packageText: string; readonly gloss: string;
  readonly expected: { readonly major?: string; readonly acceptableMajors?: string[]; readonly subRegions: string[] };
  readonly compound: null | { readonly secondaryMajor: string; readonly secondaryMeaning: string };
}
export interface Correction {
  readonly id: string; readonly caseId: string; readonly expected: 'CONSISTENT' | 'NOT_SUPPORTED_BY_PACKAGE';
  readonly correction: { readonly meaning: string; readonly primaryThemes: string[]; readonly secondaryThemes: string[] }; readonly why: string;
}
export interface Triplet { readonly id: string; readonly anchor: string; readonly similar: string; readonly different: string; readonly why: string }
const casesText = readFileSync(CASES_PATH, 'utf8');
const casesSha = sha(casesText);
if (process.env.QANDEEL_S8A05_TIER_S_SHA256 !== casesSha) throw new Error('NOT RUN: the cases differ from the preregistered fingerprint');
if (process.env.QANDEEL_S8A05_INSTRUCTIONS_SHA256 !== INSTRUCTIONS_SHA256) throw new Error('NOT RUN: the instructions differ from the preregistered fingerprint');
const doc = JSON.parse(casesText) as { schema: string; synthetic: boolean; cases: Case[]; corrections: Correction[]; triplets: Triplet[] };
if (doc.schema !== 'QANDEEL_S8A05_CP3_TIER_S_CASES_V1' || doc.synthetic !== true || doc.cases.length !== 80
  || doc.corrections.length !== 20 || doc.triplets.length !== 40) throw new Error('NOT RUN: not the preregistered set');
const byId = new Map(doc.cases.map((c) => [c.id, c]));
const COMPOUNDS = doc.cases.filter((c) => c.compound !== null);
if (COMPOUNDS.length !== 10) throw new Error('NOT RUN: the set does not hold 10 compounds');
const CONSISTENT = doc.corrections.filter((c) => c.expected === 'CONSISTENT').length;
if (CONSISTENT !== 10) throw new Error('NOT RUN: the set does not hold 10 / 10 corrections');
/** PREREGISTRATION.md §3 — fixed before the run. */
const ACCEPT = Object.freeze({ major: 72, sub: 0.75, consistent: 9, unsupported: 9, similarCloser: 34, compoundDominant: 8, maxInvalid: 2 });

// ------------------------------------------------------------------------------------------- the guard, read only
interface Guard { readonly run: { readonly blocked: string[] }; readonly spend: { attempts: Json[]; spentPeakUsd: number; spentApplicableUsd: number }; readonly maxAttempts: number; readonly costCapUsd: number; readonly round: number }
const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__ as Guard | undefined;
if (!guard) throw new Error('NOT RUN: the network guard is not loaded');
/** Simulated mode only: the case's fixed labels, for the harness's own stand-in (tier-s-simulated.cjs). Never set live. */
const oracle = (globalThis as Json).__QANDEEL_S8A05_TIER_S_ORACLE__ as { current: Json } | undefined;
if (oracle && !SIMULATED) throw new Error('NOT RUN: the oracle stand-in is loaded outside simulated mode');

const majorOf = (key: string | null) => (key === null ? null : publicSubRegion(key)?.major ?? null);
const majorsAccepted = (c: Case) => (c.expected.major ? [c.expected.major] : c.expected.acceptableMajors ?? []);

/** One attempt, exactly as the service makes it: attributed to the publisher, bounded by its 20 s, decoded strictly. */
async function attempt(work: (signal: AbortSignal) => Promise<unknown>): Promise<{ raw: unknown; failure: string | null; ms: number }> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const t0 = Date.now();
  try {
    const raw = await Promise.race([
      runWithAiUsageAttribution({ userId: PUBLISHER }, () => work(controller.signal)),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('SERVICE_TIMEOUT')); }, SEMANTIC_INTERPRETATION_TIMEOUT_MS); }),
    ]);
    return { raw, failure: null, ms: Date.now() - t0 };
  } catch (error) {
    return { raw: null, failure: error instanceof PublicSemanticInterpretationProviderError ? error.reason : (error as Error)?.message === 'SERVICE_TIMEOUT' ? 'SERVICE_TIMEOUT' : 'THREW', ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Tier P: the model's dominant sub-regions placed by the exact P-dom mirror, in the case order. */
export function placeAll(dominants: ReadonlyArray<readonly [string, string | null]>): Map<string, readonly [bigint, bigint]> {
  const occupied = new Set<string>();
  const next = new Map<string, bigint>();
  const points = new Map<string, readonly [bigint, bigint]>();
  for (const [id, key] of dominants) {
    const centre = key === null ? undefined : publicSubRegion(key);
    if (!centre) continue; // an invalid answer is never placed
    let k = next.get(centre.key) ?? 0n;
    for (;;) {
      const [dq, dr] = hexSlot(k);
      const q = centre.q + dq;
      const r = centre.r + dr;
      if (!occupied.has(`${q},${r}`)) { occupied.add(`${q},${r}`); points.set(id, latticePoint(q, r)); next.set(centre.key, k + 1n); break; }
      k += 1n;
    }
  }
  return points;
}
const distance = (a: readonly [bigint, bigint], b: readonly [bigint, bigint]) => Math.hypot(Number(a[0] - b[0]), Number(a[1] - b[1]));

async function main() {
  const results: Json = {
    mode: DRY ? 'dry' : SIMULATED ? 'simulated' : 'live', head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, startedAt: new Date().toISOString(),
    casesSha256: casesSha, instructionsSha256: INSTRUCTIONS_SHA256, contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT,
    guardRound: guard!.round, caps: { attempts: guard!.maxAttempts, usd: guard!.costCapUsd }, accept: ACCEPT,
  };
  const ledger: Json[] = [];
  const settled: Json[] = [];
  const accounting = new AiProviderCallAccounting({ begin: async (record) => { ledger.push(record); }, settle: async (record) => { settled.push(record); } });
  const config = loadPublicSemanticInterpretationDeepSeekConfig(process.env);
  const interpreter = new DeepSeekPublicSemanticInterpreter(config, accountedDeepSeekChatCompletionsClient(
    createDeepSeekClient(config), 'PUBLIC_SEMANTIC_INTERPRETATION', accounting));
  const proposals: Json[] = [];
  const assessments: Json[] = [];
  let incomplete: string | null = null;

  const once = async (label: string, expected: Json, work: (signal: AbortSignal) => Promise<unknown>) => {
    if (oracle) oracle.current = expected;
    const blockedBefore = guard!.run.blocked.length;
    const attemptsBefore = guard!.spend.attempts.length;
    const outcome = await attempt(work);
    if (guard!.run.blocked.length > blockedBefore) { incomplete = `${label}: the guard refused (${guard!.run.blocked.at(-1)})`; return null; }
    if (guard!.spend.attempts.length - attemptsBefore !== 1) { incomplete = `${label}: ${guard!.spend.attempts.length - attemptsBefore} provider attempts instead of one`; return null; }
    const a = guard!.spend.attempts.at(-1);
    return { ...outcome, attempt: { requestBytes: a?.requestBytes, usage: a?.usage ?? null, peakUsd: a?.peakUsd ?? null, httpStatus: a?.httpStatus ?? null, transportError: a?.transportError ?? null } };
  };

  try {
    for (const c of doc.cases) {
      const done = await once(c.id, { kind: 'PROPOSAL', case: c }, (signal) => interpreter.propose({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, packageText: c.packageText }, signal));
      if (done === null) break;
      const proposal = done.failure === null ? decodePublicSemanticProposal(done.raw) : null;
      const invalid = done.failure ?? (proposal === null ? 'UNDECODABLE' : null);
      const dominant = proposal ? dominantSubRegion(proposal.placementIntent as PublicRegionProfile) : null;
      const major = majorOf(dominant);
      proposals.push({
        id: c.id, kind: c.kind, language: c.language, traps: c.traps, compound: c.compound !== null, invalid, ms: done.ms, attempt: done.attempt,
        proposal, dominant, major,
        majorCorrect: major !== null && majorsAccepted(c).includes(major),
        subScored: c.expected.subRegions.length > 0, subCorrect: dominant !== null && c.expected.subRegions.includes(dominant),
        regionsMajors: proposal ? (proposal.placementIntent as PublicRegionProfile).regions.map((r) => majorOf(r.key)) : [],
      });
      console.log(`[s8a-05 cp3 tier-s] ${c.id} -> ${invalid ?? `${dominant}`}`);
    }
    for (const k of incomplete === null ? doc.corrections : []) {
      const c = byId.get(k.caseId) as Case;
      const done = await once(k.id, { kind: 'CORRECTION', correction: k, case: c }, (signal) => interpreter.assessCorrection({
        contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, packageText: c.packageText, correction: k.correction }, signal));
      if (done === null) break;
      const assessment = done.failure === null ? decodePublicSemanticAssessment(done.raw) : null;
      const invalid = done.failure ?? (assessment === null ? 'UNDECODABLE' : null);
      assessments.push({ id: k.id, caseId: k.caseId, expected: k.expected, invalid, ms: done.ms, attempt: done.attempt, assessment,
        verdict: assessment?.verdict ?? null, correct: assessment?.verdict === k.expected });
      console.log(`[s8a-05 cp3 tier-s] ${k.id} ${k.expected} -> ${invalid ?? assessment?.verdict}`);
    }
  } finally {
    const complete = incomplete === null && proposals.length === 80 && assessments.length === 20;
    results.incomplete = incomplete ?? (complete ? null : `${proposals.length} / 80 proposals and ${assessments.length} / 20 assessments`);
    const subScored = proposals.filter((p) => p.subScored);
    const invalid = [...proposals, ...assessments].filter((p) => p.invalid !== null);
    results.major = { correct: proposals.filter((p) => p.majorCorrect).length, of: 80, ids: proposals.filter((p) => !p.majorCorrect).map((p) => p.id) };
    results.sub = { correct: subScored.filter((p) => p.subCorrect).length, of: subScored.length, ids: subScored.filter((p) => !p.subCorrect).map((p) => p.id) };
    const verdicts = (kind: string) => assessments.filter((a) => a.expected === kind);
    results.corrections = {
      consistent: { correct: verdicts('CONSISTENT').filter((a) => a.correct).length, of: 10, ids: verdicts('CONSISTENT').filter((a) => !a.correct).map((a) => a.id) },
      unsupported: { correct: verdicts('NOT_SUPPORTED_BY_PACKAGE').filter((a) => a.correct).length, of: 10, ids: verdicts('NOT_SUPPORTED_BY_PACKAGE').filter((a) => !a.correct).map((a) => a.id) },
      // Reported only: whether a CONSISTENT answer placed the corrected meaning in the case's own major.
      consistentInCaseMajor: verdicts('CONSISTENT').filter((a) => a.assessment?.verdict === 'CONSISTENT'
        && majorsAccepted(byId.get(a.caseId) as Case).includes(majorOf(dominantSubRegion(a.assessment.placementIntent)) as string)).length,
    };
    results.invalid = { count: invalid.length, of: 100, ids: invalid.map((p) => `${p.id}:${p.invalid}`) };

    // Tier P: no further model call — the proposals above, placed.
    const points = placeAll(proposals.map((p) => [p.id, p.dominant] as const));
    const triplets = doc.triplets.map((t) => {
      const [a, s, d] = [points.get(t.anchor), points.get(t.similar), points.get(t.different)];
      const closer = !!a && !!s && !!d && distance(a, s) < distance(a, d);
      return { id: t.id, closer, anchorToSimilar: a && s ? Math.round(distance(a, s)) : null, anchorToDifferent: a && d ? Math.round(distance(a, d)) : null };
    });
    results.tierP = {
      similarCloser: { count: triplets.filter((t) => t.closer).length, of: 40, ids: triplets.filter((t) => !t.closer).map((t) => t.id) },
      compoundDominant: { count: COMPOUNDS.filter((c) => proposals.find((p) => p.id === c.id)?.majorCorrect).length, of: 10 },
      // Reported for the raters' C question (the deciding measure is theirs): a secondary sub-region in the secondary major.
      compoundSecondaryInProfile: COMPOUNDS.filter((c) => proposals.find((p) => p.id === c.id)?.regionsMajors.includes(c.compound!.secondaryMajor)).length,
      triplets,
      points: Object.fromEntries([...points].map(([id, [x, y]]) => [id, [x.toString(), y.toString()]])),
    };

    // The ledger: one PUBLIC_SEMANTIC_INTERPRETATION record per attempt, paid by the synthetic publisher, nothing Shared.
    results.ledger = {
      begun: ledger.length, settled: settled.length,
      families: [...new Set(ledger.map((r) => r.featureFamily))],
      everyRecordPaidByPublisher: ledger.every((r) => r.userId === PUBLISHER),
      noSharedOrSession: ledger.every((r) => r.sessionId === null && r.sourceTurnId === null && !('sourceWorldId' in r) && !('sourceSharedMaterialId' in r)),
    };
    const attempts = guard!.spend.attempts;
    results.ledgerSound = results.ledger.begun === attempts.length && results.ledger.everyRecordPaidByPublisher && results.ledger.noSharedOrSession
      && results.ledger.families.join() === (attempts.length ? 'PUBLIC_SEMANTIC_INTERPRETATION' : '');
    results.deterministicAccepted = results.incomplete === null && results.ledgerSound
      && results.major.correct >= ACCEPT.major && results.sub.correct >= Math.ceil(ACCEPT.sub * results.sub.of)
      && results.corrections.consistent.correct >= ACCEPT.consistent && results.corrections.unsupported.correct >= ACCEPT.unsupported
      && results.tierP.similarCloser.count >= ACCEPT.similarCloser && results.tierP.compoundDominant.count >= ACCEPT.compoundDominant
      && results.invalid.count <= ACCEPT.maxInvalid;
    results.byLanguage = Object.fromEntries(['EGY', 'FUSHA', 'EN', 'MIXED'].map((language) => {
      const rows = proposals.filter((p) => p.language === language);
      return [language, { cases: rows.length, major: rows.filter((p) => p.majorCorrect).length, sub: rows.filter((p) => p.subScored && p.subCorrect).length, subOf: rows.filter((p) => p.subScored).length }];
    }));
    results.byTrap = Object.fromEntries(['SECTION_LABEL', 'INJECTION', 'THIN', 'NEAR_MISS', 'LONG', 'QANDEEL_HEAVY'].map((trap) => {
      const rows = proposals.filter((p) => p.traps.includes(trap));
      return [trap, { cases: rows.length, major: rows.filter((p) => p.majorCorrect).length }];
    }));
    results.majors = PUBLIC_MAJOR_REGIONS.map((m) => m.key);
    results.proposals = proposals;
    results.assessments = assessments;
    const bytes = attempts.map((a: Json) => Number(a.requestBytes));
    results.provider = {
      attempts: attempts.length, spentPeakUsd: guard!.spend.spentPeakUsd, spentApplicableUsd: guard!.spend.spentApplicableUsd,
      models: [...new Set(attempts.map((a: Json) => a.model))], thinking: [...new Set(attempts.map((a: Json) => a.thinking))], maxTokens: [...new Set(attempts.map((a: Json) => a.maxTokens))],
      httpStatuses: attempts.reduce((acc: Record<string, number>, a: Json) => { const k = String(a.httpStatus ?? a.transportError ?? 'none'); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}),
      requestBytes: bytes.length ? { min: Math.min(...bytes), max: Math.max(...bytes), total: bytes.reduce((s: number, b: number) => s + b, 0) } : null,
    };
    results.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULTS), { recursive: true });
    writeFileSync(RESULTS, `${JSON.stringify(results, null, 2)}\n`);
  }
  console.log(`[s8a-05 cp3 tier-s] ${results.incomplete ? `INCOMPLETE: ${results.incomplete}; ` : ''}major ${results.major.correct}/80, sub ${results.sub.correct}/${results.sub.of}, `
    + `corrections ${results.corrections.consistent.correct}/10 + ${results.corrections.unsupported.correct}/10, similar-closer ${results.tierP.similarCloser.count}/40, `
    + `compounds ${results.tierP.compoundDominant.count}/10, invalid ${results.invalid.count}/100; ledger ${results.ledgerSound ? 'sound' : 'NOT SOUND'} — deterministic half `
    + `${results.deterministicAccepted ? 'MET' : 'NOT MET'} (raters pending); ${results.provider.attempts} attempts, USD ${results.provider.spentPeakUsd.toFixed(6)} at peak; results: ${RESULTS}`);
  process.exit(results.incomplete === null ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[s8a-05 cp3 tier-s] NOT COMPLETED: ${(error as Json)?.message ?? error}`);
    process.exit(1);
  });
}
