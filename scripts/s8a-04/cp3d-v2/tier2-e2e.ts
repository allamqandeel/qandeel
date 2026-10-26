// S8A-04 CP3-D V2 — Tier 2: 60 end-to-end scenarios through the APPLICATION's own reply path (Controlled Amendment R4, §11.6;
// the Product Owner's D-7 gate of 2026-10-26). Operator-only: never a CI step, never imported by production code. Launched
// only by launch.mjs under scripts/s8a-02/network-guard.cjs (round 24), and only after Tier 1 was ACCEPTED.
//
// What runs is the application's composition itself (as scripts/s8a-04/cp3-proof.ts): Nest builds `SharedWorldModule`, so the
// conversation service, the reply service, the member-knowledge lane (I-03E admission, the DA, the claim table with the 0178
// Names, CG-6a′, the one V2 check with CG-6b′, the decision, the frozen I-03 gates, the revalidation and the commit), the
// attribution layer, the Model Router on DeepSeek Flash and the AI-COST-01 accounting are what its providers compose.
// Per scenario: a synthetic World of its members on the disposable PostgreSQL 17; the items as the owners' memories; each
// permission state through the owner's own `authenticated` commands; the earlier messages; a member who leaves, leaves;
// then the last message is SENT through the conversation service, exactly as a member's message is (one reply, no retry).
// A scenario marked `comparison` is run a second time in a twin World with the same people, messages and turn and NO items
// (the "without knowledge" arm), for the Product Owner's blind comparison.
// DECLARED TEST SHORTCUTS: the memories are inserted as the database owner with the production index terms (the capture path
// is not under test); a permission request row is inserted as the database owner so that its owner can answer it with the
// real command (the local relevance read that would open it is proved in the free CP3 proof); the earlier messages are
// committed through each member's own send command WITHOUT a QANDEEL reply (QANDEEL has not spoken yet in the scenario); the
// semantic map pass that follows every send (its reading and placement) is replaced by a no-op — it starts after the reply
// is decided, never changes it, and no item reaches it (proved free) — so it makes no provider call; nothing else is changed.
// The harness only RECORDS: the requests and answers that crossed the DeepSeek URL (to show what the generator and the
// checker received and said, and to compute the text the server would have delivered when a reply is withheld), the
// reply's outcome, the committed text, the use records, the cooldowns and the ledger. Synthetic texts only.
// Scoring (PREREGISTRATION.md, RATER_RUBRIC.md): the deterministic checks are computed here; the semantic judgments (a
// violation, a useful use, a justified block) by the preregistered independent rater over tier2-rater-packet.json; the blind
// comparison by the Product Owner over the packet of tier2-blind.mjs. Nothing here decides acceptance on its own.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { SharedQandeelReplyService } from '../../../apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.service';
import { SharedSemanticPlaceService } from '../../../apps/api/src/connected-worlds/material-commit/shared-semantic-place.service';
import { SharedMemberKnowledgeService } from '../../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.service';
import { SHARED_DISCLOSURE_JUDGE, type SharedDisclosureJudge } from '../../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.types';
import { memoryRetrievalTerms } from '../../../apps/api/src/memory/memory-retrieval-terms';
import { DeepSeekSharedDisclosureJudge, SHARED_DISCLOSURE_JUDGE_POLICY_REF } from '../../../apps/api/src/shared-world/deepseek-shared-disclosure-judge';
import { SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS } from '../../../apps/api/src/shared-world/deepseek-shared-knowledge-recall';
import { SHARED_SEMANTIC_READING_INSTRUCTIONS_V2 } from '../../../apps/api/src/shared-world/deepseek-shared-semantic-interpreter';
import { SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS } from '../../../apps/api/src/shared-world/deepseek-shared-spatial-placer';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS, SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS } from '../../../apps/api/src/shared-world/shared-member-knowledge-texts';
import { SharedWorldConversationService } from '../../../apps/api/src/shared-world/shared-world-conversation.service';
import { SharedWorldModule } from '../../../apps/api/src/shared-world/shared-world.module';
import { LOCAL_DATA_API_URL, openLocalDataApi, type LocalDataApi } from '../cp2-local-data-api';
import { enableSharedConversation, ledgerOf, signUp, worldOf, type Person } from '../cp2-worlds';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';
const DRY = process.env.QANDEEL_EVAL_DRY === '1';
const SIMULATED = process.env.QANDEEL_EVAL_SIMULATE === '1';
const RESULTS = process.env.QANDEEL_S8A04_RESULTS_PATH ?? '';
const SCENARIOS_PATH = join(__dirname, 'tier2-scenarios.json');
if (!RESULTS) throw new Error('NOT RUN: QANDEEL_S8A04_RESULTS_PATH is required');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const ATTRIBUTION_READING_MARK = 'You read a group conversation for the server. You do not reply to anyone.';

// ------------------------------------------------------------------------------------------- the preregistered set
const scenariosText = readFileSync(SCENARIOS_PATH, 'utf8');
const scenariosSha = sha(scenariosText);
if (process.env.QANDEEL_S8A04_V2_TIER2_SHA256 !== scenariosSha) throw new Error('NOT RUN: the Tier 2 scenarios differ from the preregistered fingerprint');
if (process.env.QANDEEL_S8A04_V2_POLICY_REF !== SHARED_DISCLOSURE_JUDGE_POLICY_REF) throw new Error('NOT RUN: the check policy differs from the preregistered one');
type Consent = 'ALLOWED' | 'NONE' | 'DECLINED' | 'REVOKED';
interface Member { readonly key: string; readonly name: string; readonly leftBeforeTurn?: boolean }
interface ScenarioItem { readonly id: string; readonly owner: string; readonly consent: Consent; readonly text: string }
export interface Scenario {
  readonly id: string; readonly kind: 'RELEVANT' | 'BOUNDARY'; readonly boundary: string | null; readonly comparison: boolean; readonly language: string;
  readonly members: ReadonlyArray<Member>; readonly items: ReadonlyArray<ScenarioItem>;
  readonly history: ReadonlyArray<{ readonly from: string; readonly text: string }>; readonly turn: { readonly from: string; readonly text: string };
  readonly relevantItems: ReadonlyArray<string>;
}
const doc = JSON.parse(scenariosText) as { schema: string; synthetic: boolean; scenarios: Scenario[] };
if (doc.schema !== 'QANDEEL_S8A04_CP3D_V2_TIER2_SCENARIOS_V1' || doc.synthetic !== true || doc.scenarios.length !== 60) throw new Error('NOT RUN: not the preregistered set');
const ONLY = process.env.QANDEEL_CP3D_V2_T2_ONLY ? new Set(process.env.QANDEEL_CP3D_V2_T2_ONLY.split(',')) : null;
if (ONLY && !SIMULATED && !DRY) throw new Error('NOT RUN: a subset is allowed in a free run only');

// ------------------------------------------------------------------------------------------- the guard, read only
interface Guard { readonly run: { readonly blocked: string[] }; readonly spend: { attempts: Json[]; spentPeakUsd: number; spentApplicableUsd: number }; readonly maxAttempts: number; readonly costCapUsd: number; readonly round: number }
const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__ as Guard | undefined;
if (!guard) throw new Error('NOT RUN: the network guard is not loaded');

// ------------------------------------------------------------------------------------------- the DeepSeek URL: record only
type Family = 'SHARED_DISCLOSURE_JUDGE' | 'SHARED_SEMANTIC_READING' | 'SHARED_SPATIAL_PLACEMENT' | 'SHARED_KNOWLEDGE_RECALL' | 'ATTRIBUTION_READING' | 'REPLY';
interface Crossing { readonly arm: string; readonly family: Family; readonly text: string; status: number | null; content: string | null; error: string | null }
const crossings: Crossing[] = [];
let armNow = 'setup';

function familyOf(body: Json): Family {
  const system = String(body?.messages?.[0]?.content ?? '');
  if (system.startsWith(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS.slice(0, 80))) return 'SHARED_DISCLOSURE_JUDGE';
  if (system.startsWith(SHARED_SEMANTIC_READING_INSTRUCTIONS_V2.slice(0, 80))) return 'SHARED_SEMANTIC_READING';
  if (system.startsWith(SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS.slice(0, 80))) return 'SHARED_SPATIAL_PLACEMENT';
  if (system.startsWith(SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS.slice(0, 80))) return 'SHARED_KNOWLEDGE_RECALL';
  if (system.includes(ATTRIBUTION_READING_MARK)) return 'ATTRIBUTION_READING';
  return 'REPLY';
}

function installDeepSeekRecorder(): void {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: Json, init?: Json) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url !== DEEPSEEK) return inner(input, init);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const crossing: Crossing = {
      arm: armNow, family: familyOf(body), text: (body.messages ?? []).map((message: Json) => String(message.content ?? '')).join('\n'), status: null, content: null, error: null,
    };
    crossings.push(crossing);
    try {
      const response: Response = await inner(input, init);
      crossing.status = response.status;
      try { crossing.content = (await response.clone().json())?.choices?.[0]?.message?.content ?? null; } catch { crossing.content = null; }
      return response;
    } catch (error) {
      crossing.error = (error as Json)?.name ?? 'Error';
      throw error;
    }
  }) as typeof fetch;
}

// ------------------------------------------------------------------------------------------- the application
interface App { readonly context: INestApplicationContext; readonly conversation: SharedWorldConversationService; readonly judge: SharedDisclosureJudge | null; readonly replies: Json[]; settle(): Promise<void> }

async function application(): Promise<App> {
  const context = await NestFactory.createApplicationContext(SharedWorldModule, { logger: false });
  const pending: Promise<unknown>[] = [];
  // DECLARED TEST SHORTCUT: the semantic map pass is a no-op here (it runs after the reply is decided and never changes it).
  const pass = context.get(SharedSemanticPlaceService);
  pass.weave = (async () => ({ state: 'SKIPPED_BY_HARNESS' })) as unknown as typeof pass.weave;
  // RECORD ONLY: the fire-and-forget relevance read (local SQL, no provider), so the run can await it.
  const knowledge = context.get(SharedMemberKnowledgeService);
  const propose = knowledge.propose.bind(knowledge);
  knowledge.propose = (...args: Parameters<typeof propose>) => { const running = propose(...args); pending.push(running); return running; };
  // RECORD ONLY: the reply's own outcome (the conversation service folds every refusal into UNAVAILABLE).
  const replyService = context.get(SharedQandeelReplyService);
  const replies: Json[] = [];
  const reply = replyService.reply.bind(replyService);
  replyService.reply = (async (request: Json) => {
    const outcome: Json = await reply(request).catch((error: Json) => ({ state: 'THREW', name: error?.name ?? 'Error' }));
    replies.push({ arm: armNow, state: outcome?.state, reason: outcome?.reason ?? null, materialId: outcome?.materialId ?? null });
    if (outcome?.state === 'THREW') throw new Error('reply threw');
    return outcome;
  }) as typeof replyService.reply;
  return {
    context, conversation: context.get(SharedWorldConversationService), judge: context.get(SHARED_DISCLOSURE_JUDGE, { strict: false }) ?? null, replies,
    async settle() { while (pending.length) await pending.shift()?.catch(() => undefined); },
  };
}

// ------------------------------------------------------------------------------------------- the database, set up and observed
async function rows(api: LocalDataApi, sql: string, values: unknown[] = []): Promise<Json[]> {
  return (await api.owner.query(sql, values)).rows;
}
async function asMember(person: Person, name: string, body: Record<string, unknown>): Promise<Json> {
  const response = await fetch(`${LOCAL_DATA_API_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { authorization: `Bearer ${person.token}`, apikey: process.env.SUPABASE_PUBLISHABLE_KEY as string, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = response.status === 204 ? null : await response.json();
  return response.ok ? json : { error: response.status, code: json?.code ?? null };
}
const outcomeOf = (answer: Json) => (Array.isArray(answer) ? answer[0]?.outcome ?? null : answer);

/** DECLARED TEST SHORTCUT: one of the owner's eligible memories, with the production index terms of its words. */
async function memory(api: LocalDataApi, owner: Person, content: string, importance: number): Promise<string> {
  const id = randomUUID();
  const client = await (api.owner as Json).connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
      VALUES ($1, $2, 'PERSONAL_FACT', $3, 'USER_STATED', 0.9, $4, 'ACTIVE', NULL, now(), now())`, [id, owner.userId, content, importance]);
    await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, 'SELF', 'EXPLICIT_STATEMENT')", [id, owner.userId]);
    for (const term of memoryRetrievalTerms(content)) await client.query('INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, $3)', [id, owner.userId, term]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return id;
}
/** DECLARED TEST SHORTCUT: an open request for the owner's item, which the owner then answers with the real command. */
async function requestFor(api: LocalDataApi, worldId: string, owner: Person, memoryId: string): Promise<string> {
  const [row] = await rows(api, `INSERT INTO shared_knowledge_private.requests (id, world_id, owner_user_id, membership_episode_id, memory_id)
    SELECT gen_random_uuid(), $1, $2, e.id, $3 FROM public.shared_world_membership_episodes e WHERE e.world_id = $1 AND e.user_id = $2 AND e.ended_at IS NULL
    RETURNING id`, [worldId, owner.userId, memoryId]);
  return row.id;
}
async function refOf(person: Person, worldId: string): Promise<string | null> {
  const view = await asMember(person, 'list_own_shared_knowledge_v2', { p_world_id: worldId });
  return Array.isArray(view) ? view[0]?.audience_ref ?? null : null;
}
/** Each permission state through the owner's own commands. */
async function consent(api: LocalDataApi, worldId: string, owner: Person, memoryId: string, state: Consent): Promise<void> {
  if (state === 'NONE') return;
  const requestId = await requestFor(api, worldId, owner, memoryId);
  const decision = state === 'DECLINED' ? 'DECLINE' : 'ALLOW';
  const answered = outcomeOf(await asMember(owner, 'answer_own_shared_knowledge_request_v2', {
    p_command_id: randomUUID(), p_request_id: requestId, p_decision: decision, p_audience_ref: decision === 'ALLOW' ? await refOf(owner, worldId) : null,
  }));
  if (answered !== (decision === 'ALLOW' ? 'ALLOWED' : 'DECLINED')) throw new Error(`setup: the ${decision} was not written (${answered})`);
  if (state === 'REVOKED') {
    const revoked = outcomeOf(await asMember(owner, 'revoke_own_shared_knowledge_v1', { p_command_id: randomUUID(), p_world_id: worldId, p_memory_id: memoryId }));
    if (revoked !== 'REVOKED') throw new Error(`setup: the revocation was not written (${revoked})`);
  }
}

// ------------------------------------------------------------------------------------------- one arm of one scenario
const MEMBER_KNOWLEDGE = /<member_knowledge>([\s\S]*?)<\/member_knowledge>/u;
const CHECK_DATA = /<check_data>([\s\S]*)<\/check_data>/u;
const RESIDUE = /[⟦⟧]|F[1-9][0-9]{0,2}·[a-z2-7]{6}/u;

/** What the server would have delivered from the generated text (its rendering rule), for a reply that was withheld. */
function wouldDeliver(generated: string, refs: ReadonlyArray<Json>): string {
  const nameOf = new Map(refs.filter((entry) => typeof entry.ref === 'string').map((entry) => [entry.ref, entry.member]));
  return generated.replace(/⟦(F[1-9][0-9]{0,2}·[a-z2-7]{6})(@?):([^⟦⟧]*)⟧/gu, (whole, ref: string, at: string, predicate: string) => {
    const name = nameOf.get(ref);
    if (name === undefined) return whole;
    const p = predicate.trim();
    return `${name}${at ? (/^[^\p{L}]*[؀-ۿ]/u.test(p) ? '، ' : ', ') : ' '}${p}`;
  });
}

async function runArm(api: LocalDataApi, app: App, s: Scenario, arm: 'KNOWLEDGE' | 'WITHOUT'): Promise<Json> {
  armNow = `${s.id}:${arm}`;
  const people = new Map<string, Person>();
  for (const [index, member] of s.members.entries()) people.set(member.key, await signUp(api, `t2${s.id.slice(3)}${arm === 'KNOWLEDGE' ? 'k' : 'w'}${index}`, member.name));
  const worldId = await worldOf(api, [...people.values()]);
  const memoryIds = new Map<string, string>();
  if (arm === 'KNOWLEDGE') {
    for (const item of s.items) {
      const owner = people.get(item.owner) as Person;
      const memoryId = await memory(api, owner, item.text, s.relevantItems.includes(item.id) ? 0.9 : 0.6);
      memoryIds.set(item.id, memoryId);
      await consent(api, worldId, owner, memoryId, item.consent);
    }
  }
  for (const message of s.history) {
    const sent = outcomeOf(await asMember(people.get(message.from) as Person, 'send_shared_world_human_text_v1', { p_command_id: randomUUID(), p_world_id: worldId, p_content: message.text }));
    if (sent !== 'COMMITTED') throw new Error(`setup: an earlier message was not committed (${sent})`);
  }
  for (const member of s.members) {
    if (!member.leftBeforeTurn) continue;
    const left = outcomeOf(await asMember(people.get(member.key) as Person, 'leave_shared_world_v1', { p_command_id: randomUUID(), p_world_id: worldId }));
    if (left === null || (typeof left === 'object' && left.error)) throw new Error(`setup: the member did not leave (${JSON.stringify(left)})`);
  }

  const sender = people.get(s.turn.from) as Person;
  const crossed = crossings.length;
  const replied = app.replies.length;
  const attemptsBefore = guard!.spend.attempts.length;
  const blockedBefore = guard!.run.blocked.length;
  const t0 = Date.now();
  const sent: Json = await app.conversation.send(sender.userId, sender.token, worldId, { commandId: randomUUID(), content: s.turn.text });
  await app.settle();
  const ms = Date.now() - t0;
  const calls = crossings.slice(crossed);
  const families = calls.reduce((acc: Record<string, number>, call) => { acc[call.family] = (acc[call.family] ?? 0) + 1; return acc; }, {});
  const replyCall = calls.find((call) => call.family === 'REPLY') ?? null;
  const checkCall = calls.find((call) => call.family === 'SHARED_DISCLOSURE_JUDGE') ?? null;
  const knowledgeBlock = replyCall === null ? null : MEMBER_KNOWLEDGE.exec(replyCall.text);
  const sentToGenerator: Json[] = knowledgeBlock === null ? [] : JSON.parse(knowledgeBlock[1]);
  const generated = replyCall?.content ?? null;
  const [committed] = typeof sent?.materialId === 'string'
    ? await rows(api, `SELECT b.body_text FROM public.shared_world_materials m JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
        WHERE m.world_id = $1 AND m.material_kind = 'QANDEEL_OUTPUT' ORDER BY m.established_at DESC LIMIT 1`, [worldId])
    : [];
  const uses = await rows(api, 'SELECT owner_user_id, memory_id, disclosed FROM shared_knowledge_private.uses WHERE world_id = $1', [worldId]);
  const cooled = (await rows(api, "SELECT count(*)::int AS n FROM shared_knowledge_private.cooldowns WHERE world_id = $1 AND until > now()", [worldId]))[0]?.n ?? 0;
  const ledger = await ledgerOf(api, worldId);
  const itemIdOf = new Map([...memoryIds].map(([id, memoryId]) => [memoryId, id]));
  const delivered = sent?.qandeel === 'COMMITTED';
  const decision = delivered ? (checkCall ? 'READY' : 'NO_ITEM') : checkCall === null ? 'NOT_GENERATED_OR_NO_CHECK' : cooled > 0 ? 'BLOCKED' : 'UNRESOLVED_OR_STALE';

  // Deterministic checks (no judgment): consent, single calls, accounting, residue.
  const forbiddenTexts = arm === 'KNOWLEDGE'
    ? s.items.filter((item) => item.consent !== 'ALLOWED' || s.members.find((m) => m.key === item.owner)?.leftBeforeTurn).map((item) => item.text)
    : s.items.map((item) => item.text);
  const ambiguousOwners = new Set(s.members.filter((m) => s.members.filter((n) => n.name === m.name).length > 1).map((m) => m.key));
  const ambiguousTexts = s.items.filter((item) => ambiguousOwners.has(item.owner)).map((item) => item.text);
  const deterministic = {
    noUnpermittedItemReachedDeepSeek: calls.every((call) => forbiddenTexts.every((text) => !call.text.includes(text))),
    ambiguousOwnerNeverClaimable: sentToGenerator.every((entry) => !ambiguousTexts.includes(entry.item) || entry.ref === undefined),
    oneReplyCall: (families.REPLY ?? 0) === 1,
    atMostOneCheck: (families.SHARED_DISCLOSURE_JUDGE ?? 0) <= 1,
    checkOnlyWithItems: (families.SHARED_DISCLOSURE_JUDGE ?? 0) === 0 || sentToGenerator.length > 0,
    noOtherFamilies: Object.keys(families).every((family) => ['REPLY', 'ATTRIBUTION_READING', 'SHARED_DISCLOSURE_JUDGE'].includes(family)),
    oneAttemptPerCrossing: guard!.spend.attempts.length - attemptsBefore === calls.length,
    guardRefusedNothing: guard!.run.blocked.length === blockedBefore,
    // 0170 numbers attempts per (payer, turn, ledger family): the attribution reading shares CONVERSATION_REPLY with the
    // reply, so it is that family's attempt 2 — a second call, not a retry (retries are excluded by oneAttemptPerCrossing).
    // Sound = one row per call, every row paid by the sender, and each family's attempts exactly 1..n with no gap or repeat.
    everyLedgerRowPaidBySender: ledger.length === calls.length && ledger.every((row) => row.payer === sender.userId)
      && Object.values(ledger.reduce<Record<string, number[]>>((acc, row) => { (acc[String(row.family)] ??= []).push(Number(row.attempt)); return acc; }, {}))
        .every((attempts) => [...attempts].sort((a, b) => a - b).every((attempt, index) => attempt === index + 1)),
    deliveredTextClean: !delivered || (typeof committed?.body_text === 'string' && !RESIDUE.test(committed.body_text)),
    usesOnlyPermitted: uses.every((use) => { const id = itemIdOf.get(use.memory_id); const item = s.items.find((i) => i.id === id); return item?.consent === 'ALLOWED'; }),
  };
  return {
    scenario: s.id, arm, ms, qandeel: sent?.qandeel ?? null, delivered, decision,
    replyOutcome: app.replies[replied] ?? null, families,
    sentToGenerator: sentToGenerator.map((entry) => ({ item: s.items.find((i) => i.text === entry.item)?.id ?? 'UNKNOWN', claimable: typeof entry.ref === 'string' })),
    generated, wouldDeliver: generated === null ? null : wouldDeliver(generated, sentToGenerator),
    deliveredText: delivered ? committed?.body_text ?? null : null,
    check: checkCall === null ? null : { status: checkCall.status, error: checkCall.error, data: (() => { const m = CHECK_DATA.exec(checkCall.text); return m ? JSON.parse(m[1]) : null; })(), answer: checkCall.content },
    replyStatus: replyCall === null ? null : { status: replyCall.status, error: replyCall.error },
    uses: uses.map((use) => ({ item: itemIdOf.get(use.memory_id) ?? 'UNKNOWN', disclosed: use.disclosed })), cooled,
    ledger: ledger.map((row) => ({ family: row.family, state: row.state, attempt: row.attempt, paidBySender: row.payer === sender.userId })),
    deterministic,
  };
}

// ------------------------------------------------------------------------------------------- the run
async function main() {
  process.env.MODEL_PROVIDER = 'deepseek';
  const api = await openLocalDataApi(process.env);
  installDeepSeekRecorder();
  const results: Json = {
    mode: DRY ? 'dry' : SIMULATED ? 'simulated' : 'live', head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, startedAt: new Date().toISOString(),
    scenariosSha256: scenariosSha, checkPolicyRef: SHARED_DISCLOSURE_JUDGE_POLICY_REF, memberKnowledgeTextSha256: sha(SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS),
    guardRound: guard!.round, caps: { attempts: guard!.maxAttempts, usd: guard!.costCapUsd }, subset: ONLY ? [...ONLY] : null,
  };
  const arms: Json[] = [];
  let incomplete: string | null = null;
  let app: App | null = null;
  try {
    app = await application();
    if (!(app.judge instanceof DeepSeekSharedDisclosureJudge)) throw new Error('NOT RUN: the application did not compose the DeepSeek checker');
    await enableSharedConversation(api);
    for (const s of doc.scenarios) {
      if (ONLY && !ONLY.has(s.id)) continue;
      for (const arm of s.comparison ? (['KNOWLEDGE', 'WITHOUT'] as const) : (['KNOWLEDGE'] as const)) {
        const result = await runArm(api, app, s, arm);
        arms.push(result);
        console.log(`[cp3d-v2 t2] ${s.id} ${arm} ${result.qandeel} ${result.decision} ${JSON.stringify(result.families)}`);
        if (!result.deterministic.guardRefusedNothing) { incomplete = `${s.id} ${arm}: the guard refused (${guard!.run.blocked.at(-1)})`; break; }
        if (!result.deterministic.oneAttemptPerCrossing) { incomplete = `${s.id} ${arm}: provider attempts and crossings differ`; break; }
      }
      if (incomplete) break;
    }
  } finally {
    const expected = doc.scenarios.filter((s) => !ONLY || ONLY.has(s.id)).reduce((n, s) => n + (s.comparison ? 2 : 1), 0);
    results.incomplete = incomplete ?? (arms.length === expected ? null : `${arms.length} of ${expected} arms run`);
    results.arms = arms;
    const knowledge = arms.filter((a) => a.arm === 'KNOWLEDGE');
    results.deterministic = {
      allHold: arms.every((a) => Object.values(a.deterministic).every(Boolean)),
      failures: arms.flatMap((a) => Object.entries(a.deterministic).filter(([, ok]) => !ok).map(([check]) => `${a.scenario}:${a.arm}:${check}`)),
      relevantAdmission: doc.scenarios.filter((s) => s.kind === 'RELEVANT' && (!ONLY || ONLY.has(s.id))).map((s) => {
        const arm = knowledge.find((a) => a.scenario === s.id);
        return { scenario: s.id, relevant: s.relevantItems, reachedGenerator: arm ? arm.sentToGenerator.map((e: Json) => e.item) : null };
      }),
      deliveredKnowledge: knowledge.filter((a) => a.delivered).length, withheldKnowledge: knowledge.filter((a) => !a.delivered).length,
    };
    const attempts = guard!.spend.attempts;
    results.provider = {
      attempts: attempts.length, spentPeakUsd: guard!.spend.spentPeakUsd, spentApplicableUsd: guard!.spend.spentApplicableUsd,
      families: crossings.reduce((acc: Record<string, number>, c) => { acc[c.family] = (acc[c.family] ?? 0) + 1; return acc; }, {}),
      models: [...new Set(attempts.map((a: Json) => a.model))], maxTokens: [...new Set(attempts.map((a: Json) => a.maxTokens))],
      httpStatuses: attempts.reduce((acc: Record<string, number>, a: Json) => { const k = String(a.httpStatus ?? a.transportError ?? 'none'); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}),
      perCall: crossings.map((c, i) => ({ arm: c.arm, family: c.family, requestBytes: attempts[i]?.requestBytes ?? null, maxTokens: attempts[i]?.maxTokens ?? null, worstCaseUsd: attempts[i]?.worstCaseUsd ?? null, usage: attempts[i]?.usage ?? null })),
    };
    results.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULTS), { recursive: true });
    writeFileSync(RESULTS, `${JSON.stringify(results, null, 2)}\n`);
    await app?.context.close().catch(() => undefined);
    await api.close();
  }
  console.log(`[cp3d-v2 t2] ${arms.length} arms${results.incomplete ? ` — INCOMPLETE: ${results.incomplete}` : ''}; deterministic checks ${results.deterministic.allHold ? 'all hold' : `FAIL: ${results.deterministic.failures.join(', ')}`}; ${results.provider.attempts} provider attempts, USD ${results.provider.spentPeakUsd.toFixed(6)} at peak; results: ${RESULTS}`);
  process.exit(results.incomplete === null ? 0 : 1);
}

main().catch((error) => {
  console.error(`[cp3d-v2 t2] NOT COMPLETED: ${(error as Json)?.message ?? error}`);
  process.exit(1);
});
