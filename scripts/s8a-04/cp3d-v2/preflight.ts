// S8A-04 CP3-D V2 — the FREE pre-flight of both preregistered sets (operator-only; never a CI step; sends NOTHING: no
// database, no network). Run before the sets are fixed, and again by anyone checking them:
//
//   node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.json scripts/s8a-04/cp3d-v2/preflight.ts [out.json]
//
// Tier 1: every case through the production steps before the check (tier1-prepare.ts) — a case the server would refuse
// before any check is a set defect — and the EXACT request each case would send: the real V2 check adapter writes it into a
// recording client that never answers (as cp3d-v2-cost-rehearsal.ts), so its bytes and its worst-case reservation at the
// guard are known per case. Tier 2: the shape and counts the brief fixes, and the admission the turn's 0171 index terms give
// each item (I-03E collects an item only when the answered message shares a term with it): a RELEVANT item that would not be
// admitted, or an IRRELEVANT one that would, is reported (the database run confirms it).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { memoryRetrievalTerms } from '../../../apps/api/src/memory/memory-retrieval-terms';
import { sharedKnowledgeTerms } from '../../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.service';
import { DEEPSEEK_FLASH_MODEL } from '../../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import { decideFastDeepRoute } from '../../../apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { DeepSeekSharedDisclosureJudge } from '../../../apps/api/src/shared-world/deepseek-shared-disclosure-judge';
import { SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS, SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS } from '../../../apps/api/src/shared-world/shared-social-memory-provider.config';
import { prepareTier1Case, type Tier1Case } from './tier1-prepare';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const PEAK = { cacheMiss: 0.30, output: 1.20 }; // USD per million tokens, the guard's peak rate (scripts/s8a-02/network-guard.cjs)
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const problems: string[] = [];
const fail = (what: string) => { problems.push(what); };

// ------------------------------------------------------------------------------------------- Tier 1
const t1Text = readFileSync(join(__dirname, 'tier1-cases.json'), 'utf8');
const t1 = JSON.parse(t1Text) as { schema: string; synthetic: boolean; cases: Tier1Case[] };
const bodies: string[] = [];
const recording = { chat: { completions: { create: async (request: Json) => { bodies.push(JSON.stringify(request)); throw new Error('PREFLIGHT: nothing is sent'); } } } };
const judge = new DeepSeekSharedDisclosureJudge({
  provider: 'DEEPSEEK', apiKey: 'preflight', model: DEEPSEEK_FLASH_MODEL, timeoutMs: SHARED_DISCLOSURE_JUDGE_TIMEOUT_MS,
  maxOutputTokens: SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS, maxRetries: 0,
} as Json, recording as Json);

const T1_COUNTS: Record<string, number> = {
  B_OTHER_MEMBER: 12, B_OUTSIDE_OWNER: 12, B_PRONOUN: 10, B_CO_SUBJECT: 10, B_ADDS: 10, B_OTHER_ITEM: 6, B_ANONYMOUS: 8, B_ADDRESSEE: 6, B_RECORD: 8,
  B_QUOTE_PROVENANCE: 8, A_SPAN: 16, A_ADVICE: 14, A_GROUP: 12, A_MULTI: 10, A_PLAIN: 8,
};
const T1_LANG_MIN: Record<string, number> = { 'ar-EG': 40, 'ar-LEV': 30, 'ar-GULF': 10, 'ar-MSA': 10, en: 25, mixed: 15 };
const count = <T>(list: ReadonlyArray<T>, key: (v: T) => string) => list.reduce((acc: Record<string, number>, v) => { acc[key(v)] = (acc[key(v)] ?? 0) + 1; return acc; }, {});

async function tier1() {
  if (t1.schema !== 'QANDEEL_S8A04_CP3D_V2_TIER1_CASES_V1' || t1.synthetic !== true) fail('t1: schema');
  if (t1.cases.length !== 150) fail(`t1: ${t1.cases.length} cases`);
  const ids = t1.cases.map((c) => c.id);
  if (new Set(ids).size !== ids.length || !ids.every((id) => /^T1-(0[0-9]{2}|1[0-4][0-9]|150)$/u.test(id))) fail('t1: ids');
  const byCategory = count(t1.cases, (c) => c.category);
  for (const [category, n] of Object.entries(T1_COUNTS)) if (byCategory[category] !== n) fail(`t1: ${category} ${byCategory[category] ?? 0} != ${n}`);
  for (const c of t1.cases) if ((c.category.startsWith('B_') ? 'BLOCK' : 'ALLOW') !== c.expected) fail(`t1: ${c.id} label vs category`);
  const byLanguage = count(t1.cases, (c) => c.language);
  for (const [language, n] of Object.entries(T1_LANG_MIN)) if ((byLanguage[language] ?? 0) < n) fail(`t1: ${language} ${byLanguage[language] ?? 0} < ${n}`);
  const indirect = t1.cases.filter((c) => c.expected === 'BLOCK' && c.indirect === true).length;
  if (indirect < 30) fail(`t1: indirect ${indirect} < 30`);
  const hard = t1.cases.filter((c) => c.expected === 'ALLOW' && c.hardNegative === true).length;
  if (hard < 20) fail(`t1: hard negatives ${hard} < 20`);
  const fake = (name: string) => `00000000-0000-4000-8000-${sha(name).slice(0, 12)}`;
  const perCase: Json[] = [];
  for (const c of t1.cases) {
    try {
      const prepared = prepareTier1Case(c, fake);
      bodies.length = 0;
      await judge.judge(prepared.request).catch(() => undefined);
      if (bodies.length !== 1) { fail(`t1: ${c.id} the adapter built ${bodies.length} requests`); continue; }
      const bytes = Buffer.byteLength(bodies[0]);
      perCase.push({ id: c.id, bytes, items: c.items.length, spans: prepared.view.spanIds.length, worstUsd: (bytes * PEAK.cacheMiss + SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS * PEAK.output) / 1e6 });
    } catch (error) {
      fail(`t1: ${(error as Error).message}`);
    }
  }
  const bytes = perCase.map((p) => p.bytes);
  return {
    sha256: sha(t1Text), cases: t1.cases.length, byCategory, byLanguage, indirectBlocks: indirect, hardNegatives: hard,
    claimableFalse: t1.cases.filter((c) => c.items.some((i) => !i.claimable)).length, itemsPerCase: count(t1.cases, (c) => String(c.items.length)),
    requestBytes: bytes.length ? { min: Math.min(...bytes), median: [...bytes].sort((a, b) => a - b)[bytes.length >> 1], max: Math.max(...bytes), total: bytes.reduce((s, b) => s + b, 0) } : null,
    maxOutputTokens: SHARED_DISCLOSURE_JUDGE_MAX_OUTPUT_TOKENS,
    worstCaseAllUsd: perCase.reduce((s, p) => s + p.worstUsd, 0), worstCaseOneUsd: Math.max(...perCase.map((p) => p.worstUsd)),
    perCase,
  };
}

// ------------------------------------------------------------------------------------------- Tier 2
const t2Text = readFileSync(join(__dirname, 'tier2-scenarios.json'), 'utf8');
const t2 = JSON.parse(t2Text) as { schema: string; synthetic: boolean; scenarios: Json[] };
const T2_BOUNDARY: Record<string, number> = { NONE: 3, DECLINED: 3, REVOKED: 3, OWNER_LEFT: 2, AMBIGUOUS_NAME: 3, IRRELEVANT: 3, PROBE: 3 };
const T2_LANG_MIN: Record<string, number> = { 'ar-EG': 18, 'ar-LEV': 12, 'ar-GULF': 6, 'ar-MSA': 6, en: 12, mixed: 6 };
const T2_REL_LANG_MIN: Record<string, number> = { 'ar-EG': 12, 'ar-LEV': 8, 'ar-GULF': 4, 'ar-MSA': 4, en: 8, mixed: 4 };

function tier2() {
  if (t2.schema !== 'QANDEEL_S8A04_CP3D_V2_TIER2_SCENARIOS_V1' || t2.synthetic !== true) fail('t2: schema');
  if (t2.scenarios.length !== 60) fail(`t2: ${t2.scenarios.length} scenarios`);
  const relevant = t2.scenarios.filter((s) => s.kind === 'RELEVANT');
  const boundary = t2.scenarios.filter((s) => s.kind === 'BOUNDARY');
  if (relevant.length !== 40 || boundary.length !== 20) fail(`t2: ${relevant.length} relevant / ${boundary.length} boundary`);
  const byBoundary = count(boundary, (s) => String(s.boundary));
  for (const [kind, n] of Object.entries(T2_BOUNDARY)) if (byBoundary[kind] !== n) fail(`t2: boundary ${kind} ${byBoundary[kind] ?? 0} != ${n}`);
  if (t2.scenarios.filter((s) => s.comparison === true).length !== 20 || boundary.some((s) => s.comparison === true)) fail('t2: comparison must be 20 RELEVANT');
  const byLanguage = count(t2.scenarios, (s) => s.language);
  for (const [language, n] of Object.entries(T2_LANG_MIN)) if ((byLanguage[language] ?? 0) < n) fail(`t2: ${language} ${byLanguage[language] ?? 0} < ${n}`);
  const relLanguage = count(relevant, (s) => s.language);
  for (const [language, n] of Object.entries(T2_REL_LANG_MIN)) if ((relLanguage[language] ?? 0) < n) fail(`t2: relevant ${language} ${relLanguage[language] ?? 0} < ${n}`);
  const admission: Json[] = [];
  for (const s of t2.scenarios) {
    const keys = new Map((s.members as Json[]).map((m) => [m.key, m]));
    if (keys.size !== s.members.length || s.members.length < 2 || s.members.length > 4) fail(`t2: ${s.id} members`);
    if (!keys.has(s.turn?.from) || keys.get(s.turn.from)?.leftBeforeTurn) fail(`t2: ${s.id} sender`);
    if ((s.history as Json[]).some((h) => !keys.has(h.from)) || s.history.length > 4) fail(`t2: ${s.id} history`);
    const names = (s.members as Json[]).map((m) => m.name);
    if ((new Set(names).size !== names.length) !== (s.boundary === 'AMBIGUOUS_NAME')) fail(`t2: ${s.id} shared Names only in AMBIGUOUS_NAME`);
    if ((s.members as Json[]).filter((m) => m.leftBeforeTurn).length > 0 && s.members.length - (s.members as Json[]).filter((m) => m.leftBeforeTurn).length < 2) fail(`t2: ${s.id} fewer than two remain`);
    for (const item of s.items as Json[]) {
      if (!keys.has(item.owner) || !['ALLOWED', 'NONE', 'DECLINED', 'REVOKED'].includes(item.consent) || typeof item.text !== 'string' || item.text.length > 120) fail(`t2: ${s.id} item ${item.id}`);
    }
    for (const id of s.relevantItems as string[]) if ((s.items as Json[]).find((i) => i.id === id)?.consent !== 'ALLOWED') fail(`t2: ${s.id} relevant ${id} not ALLOWED`);
    // I-03E collection by the answered message's 0171 index terms (one item per owner; the database confirms).
    const turnTerms = new Set(sharedKnowledgeTerms(s.turn.text));
    const permitted = (s.items as Json[]).filter((i) => i.consent === 'ALLOWED' && !keys.get(i.owner)?.leftBeforeTurn);
    const shares = (item: Json) => memoryRetrievalTerms(item.text).filter((t) => turnTerms.has(t));
    const admitted = permitted.filter((i) => shares(i).length > 0).map((i) => ({ id: i.id, terms: shares(i) }));
    const missing = (s.relevantItems as string[]).filter((id) => !admitted.some((a) => a.id === id));
    if (s.kind === 'RELEVANT' && missing.length > 0) fail(`t2: ${s.id} relevant item(s) ${missing.join(',')} share no index term with the turn`);
    if (s.boundary === 'IRRELEVANT' && admitted.length > 0) fail(`t2: ${s.id} IRRELEVANT but ${admitted.map((a) => a.id).join(',')} shares a term`);
    if (['NONE', 'DECLINED', 'REVOKED', 'OWNER_LEFT'].includes(s.boundary)) {
      const blocked = (s.items as Json[]).filter((i) => i.consent !== 'ALLOWED' || keys.get(i.owner)?.leftBeforeTurn);
      if (!blocked.some((i) => memoryRetrievalTerms(i.text).some((t) => turnTerms.has(t)))) fail(`t2: ${s.id} ${s.boundary}: the withheld item does not even share a term (the boundary is not exercised)`);
    }
    admission.push({ id: s.id, kind: s.kind, boundary: s.boundary, path: decideFastDeepRoute(s.turn.text).path, admitted, missing });
  }
  return {
    sha256: sha(t2Text), scenarios: t2.scenarios.length, relevant: relevant.length, boundary: byBoundary, byLanguage, relevantByLanguage: relLanguage,
    comparison: t2.scenarios.filter((s) => s.comparison === true).length,
    twoRelevantItems: relevant.filter((s) => s.relevantItems.length >= 2).length,
    ownerIsSender: relevant.filter((s) => (s.items as Json[]).some((i) => s.relevantItems.includes(i.id) && i.owner === s.turn.from)).length,
    paths: count(admission, (a) => a.path), historyLengths: count(t2.scenarios, (s) => String(s.history.length)),
    admission,
  };
}

async function main() {
  const report = { tier1: await tier1(), tier2: tier2(), problems };
  const out = process.argv[2];
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  const { perCase, ...t1Summary } = report.tier1;
  const { admission, ...t2Summary } = report.tier2;
  console.log(JSON.stringify({ tier1: t1Summary, tier2: t2Summary, problems }, null, 2));
  process.exit(problems.length === 0 ? 0 : 1);
}
main().catch((error) => { console.error(`[preflight] NOT COMPLETED: ${error?.message ?? error}`); process.exit(1); });
