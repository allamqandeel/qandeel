// S8A-04 CP3 — the FREE integrated proof of Personal Knowledge in a Shared World (Controlled Amendment §8; Product Owner
// Final Implementation Authorization of 2026-10-25, §8: "synthetic data only; no paid DeepSeek call without a new
// approval"). Operator-only: never a CI step, never imported by production code. Launched only by cp3-launch.mjs under
// scripts/s8a-02/network-guard.cjs (round 21: dry and simulated only; no paid allowance).
//
// What runs is the APPLICATION's composition itself: Nest builds `SharedWorldModule`, so the reply service, the member-
// knowledge lane, the judge, the reply router, the semantic pass and the AI-COST-01 accounting are exactly what its providers
// compose from the environment. The harness parts are:
//   * the in-process Data API over the disposable PostgreSQL 17 migrated through every migration, 0176 included
//     (cp2-local-data-api.ts), and the CP2 fixtures for people and Worlds (cp2-worlds.ts);
//   * synthetic memories written as the database owner with their 0171 index terms (the production term function);
//   * every consent through the owner's own `authenticated` command (0177's v2, over the 0176 one), with the owner's token —
//     never as the server;
//   * spies that only RECORD (the reply's outcome, the fire-and-forget pass and relevance read, what crossed the DeepSeek
//     URL) and, at that URL, injected judge answers and faults, and consent changes made WHILE the judge is being asked
//     (a revoke, a join, a leave, a correction, a forget) — the boundary the free unit suites cannot reach end to end.
// DECLARED TEST SHORTCUTS: the memories are inserted as the database owner (the capture path is not under test); in the
// withheld and during-generation scenarios a request row is inserted as the database owner so that the owner can answer it
// with the real command (the relevance read itself is proved in scenario P); a correction and a forget move the memory to
// SUPERSEDED / DELETED as the database owner, the transitions the memory runtime makes (as verify-migration-0176.mjs
// does). Nothing is logged but bounded outcomes; the results file holds synthetic texts only.
// CP3-C (Product Owner authorization of 2026-10-25, §6): scenario C drives the owner's permission surface through the Shared World
// controller's own routes under each member's token, and scenario A proves, separately, that no Activity, push or outbox row
// and no other table outside the private lane carries a private item, a request, a decision or its owner.
import 'reflect-metadata';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../../apps/api/src/ai-usage/ai-usage-attribution';
import { SharedQandeelReplyService } from '../../apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.service';
import { SharedSemanticPlaceService, type SharedSemanticPassRequest } from '../../apps/api/src/connected-worlds/material-commit/shared-semantic-place.service';
import { SharedMemberKnowledgeService } from '../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.service';
import { SHARED_DISCLOSURE_JUDGE, type SharedDisclosureJudge } from '../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.types';
import { memoryRetrievalTerms } from '../../apps/api/src/memory/memory-retrieval-terms';
import { DeepSeekSharedDisclosureJudge } from '../../apps/api/src/shared-world/deepseek-shared-disclosure-judge';
import { SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-knowledge-recall';
import { SHARED_SEMANTIC_READING_INSTRUCTIONS_V2 } from '../../apps/api/src/shared-world/deepseek-shared-semantic-interpreter';
import { SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-spatial-placer';
import { SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS, SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS } from '../../apps/api/src/shared-world/shared-member-knowledge-texts';
import { SharedWorldConversationService } from '../../apps/api/src/shared-world/shared-world-conversation.service';
import { SharedWorldController } from '../../apps/api/src/shared-world/shared-world.controller';
import { SharedWorldModule } from '../../apps/api/src/shared-world/shared-world.module';
import { LOCAL_DATA_API_URL, openLocalDataApi, type LocalDataApi } from './cp2-local-data-api';
import { addMember, enableSharedConversation, ledgerOf, placesOf, signUp, worldOf, type Person } from './cp2-worlds';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';
const DRY = process.env.QANDEEL_EVAL_DRY === '1';
const RESULTS = process.env.QANDEEL_S8A04_RESULTS_PATH ?? '';
if (!RESULTS) throw new Error('NOT RUN: QANDEEL_S8A04_RESULTS_PATH is required');
if (process.env.QANDEEL_EVAL_SIMULATE !== '1' && !DRY) throw new Error('NOT RUN: CP3 has no live mode (no paid call is authorized)');
const ATTRIBUTION_READING_MARK = 'You read a group conversation for the server. You do not reply to anyone.';
const CP3_SIMULATED_JUDGE_MARK = 'You check one reply written by QANDEEL in a group. You are given that reply and the private items of ONE member (OWNER).';

// ------------------------------------------------------------------------------------------- the DeepSeek URL: record, inject, act
type Family = 'SHARED_DISCLOSURE_JUDGE' | 'SHARED_SEMANTIC_READING' | 'SHARED_SPATIAL_PLACEMENT' | 'SHARED_KNOWLEDGE_RECALL' | 'ATTRIBUTION_READING' | 'REPLY';
type Fault = 'HTTP500' | 'MALFORMED' | 'QUOTE' | 'OTHER_PERSON' | 'SEALED' | 'UNSUPPORTED';
interface Crossing { readonly scenario: string; readonly family: Family; readonly fault: Fault | null; readonly text: string; status: number | null }
const crossings: Crossing[] = [];
let scenarioNow = 'setup';
const faults: { family: Family; fault: Fault }[] = [];
const actions: { family: Family; label: string; run: () => Promise<unknown> }[] = [];
const acted: { scenario: string; label: string; result: unknown }[] = [];

function familyOf(body: Json): Family {
  const system = String(body?.messages?.[0]?.content ?? '');
  if (system.startsWith(SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS.slice(0, 80))) return 'SHARED_DISCLOSURE_JUDGE';
  if (system.startsWith(SHARED_SEMANTIC_READING_INSTRUCTIONS_V2.slice(0, 80))) return 'SHARED_SEMANTIC_READING';
  if (system.startsWith(SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS.slice(0, 80))) return 'SHARED_SPATIAL_PLACEMENT';
  if (system.startsWith(SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS.slice(0, 80))) return 'SHARED_KNOWLEDGE_RECALL';
  if (system.includes(ATTRIBUTION_READING_MARK)) return 'ATTRIBUTION_READING';
  return 'REPLY';
}

async function rewrite(response: Response, change: (content: string) => string): Promise<Response> {
  const json: Json = await response.json();
  json.choices[0].message.content = change(json.choices[0].message.content);
  return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
}
const judgeAnswer = (change: (item: Json) => Json) => (content: string) => JSON.stringify({ items: JSON.parse(content).items.map(change) });

function installDeepSeekObserver(): void {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: Json, init?: Json) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url !== DEEPSEEK) return inner(input, init);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const family = familyOf(body);
    const planned = faults.findIndex((entry) => entry.family === family);
    const fault = planned >= 0 ? faults.splice(planned, 1)[0].fault : null;
    const crossing: Crossing = { scenario: scenarioNow, family, fault, text: (body.messages ?? []).map((message: Json) => String(message.content ?? '')).join('\n'), status: null };
    crossings.push(crossing);
    // A consent change made while this request is in flight, before its answer (the boundary under test).
    const act = actions.findIndex((entry) => entry.family === family);
    if (act >= 0) {
      const [entry] = actions.splice(act, 1);
      acted.push({ scenario: scenarioNow, label: entry.label, result: await entry.run().catch((error: Json) => ({ threw: String(error?.message ?? error).slice(0, 120) })) });
    }
    if (fault === 'HTTP500') {
      crossing.status = 500;
      return new Response(JSON.stringify({ error: { type: 'server_error', code: 'injected', message: 'injected failure' } }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    let response: Response = await inner(input, init);
    if (fault === 'MALFORMED') response = await rewrite(response, () => 'not a JSON assessment');
    if (fault === 'QUOTE') response = await rewrite(response, judgeAnswer((item) => ({ ...item, findings: ['PRIVATE_QUOTE'], attributedTo: 'OWNER' })));
    if (fault === 'OTHER_PERSON') response = await rewrite(response, judgeAnswer((item) => ({ ...item, findings: ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'], attributedTo: 'OTHER' })));
    if (fault === 'SEALED') response = await rewrite(response, judgeAnswer((item) => ({ ...item, findings: ['DIRECT_PROTECTED_SOURCE_FACT', 'SEALED_PROVENANCE_DISCLOSURE'], attributedTo: 'OWNER' })));
    if (fault === 'UNSUPPORTED') response = await rewrite(response, judgeAnswer((item) => ({ ...item, unsupportedOwnerClaim: true })));
    crossing.status = response.status;
    return response;
  }) as typeof fetch;
}

// ------------------------------------------------------------------------------------------- checks
interface Check { readonly scenario: string; readonly id: string; readonly pass: boolean; readonly detail: Json }
const checks: Check[] = [];
function check(id: string, pass: boolean, detail: Json = null): boolean {
  checks.push({ scenario: scenarioNow, id, pass, detail });
  console.log(`[cp3] ${pass ? 'PASS' : 'FAIL'} ${scenarioNow} ${id}`);
  return pass;
}

// ------------------------------------------------------------------------------------------- the application
interface App {
  readonly context: INestApplicationContext;
  readonly conversation: SharedWorldConversationService;
  readonly judge: SharedDisclosureJudge | null;
  readonly replies: Json[];
  settle(): Promise<void>;
}

async function application(): Promise<App> {
  const context = await NestFactory.createApplicationContext(SharedWorldModule, { logger: false });
  const pending: Promise<unknown>[] = [];
  // RECORD ONLY: the fire-and-forget semantic pass and relevance read, so the run can await them.
  const pass = context.get(SharedSemanticPlaceService);
  const weave = pass.weave.bind(pass);
  pass.weave = (request: SharedSemanticPassRequest) => { const running = weave(request); pending.push(running); return running; };
  const knowledge = context.get(SharedMemberKnowledgeService);
  const propose = knowledge.propose.bind(knowledge);
  knowledge.propose = (...args: Parameters<typeof propose>) => { const running = propose(...args); pending.push(running); return running; };
  // RECORD ONLY: the reply's own outcome (the conversation service folds every refusal into UNAVAILABLE).
  const replyService = context.get(SharedQandeelReplyService);
  const replies: Json[] = [];
  const reply = replyService.reply.bind(replyService);
  replyService.reply = (async (request: Json) => {
    const outcome: Json = await reply(request).catch((error: Json) => ({ state: 'THREW', name: error?.name ?? 'Error' }));
    replies.push({ scenario: scenarioNow, state: outcome?.state, reason: outcome?.reason ?? null, materialId: outcome?.materialId ?? null });
    if (outcome?.state === 'THREW') throw new Error('reply threw');
    return outcome;
  }) as typeof replyService.reply;
  return {
    context, conversation: context.get(SharedWorldConversationService), judge: context.get(SHARED_DISCLOSURE_JUDGE, { strict: false }) ?? null, replies,
    async settle() { while (pending.length) await pending.shift()?.catch(() => undefined); },
  };
}

async function say(app: App, person: Person, worldId: string, text: string) {
  const crossed = crossings.length;
  const replied = app.replies.length;
  const sent: Json = await app.conversation.send(person.userId, person.token, worldId, { commandId: randomUUID(), content: text });
  await app.settle();
  return { sent, reply: app.replies[replied] ?? null, calls: crossings.slice(crossed) };
}

// ------------------------------------------------------------------------------------------- the database, observed and set up
async function rows(api: LocalDataApi, sql: string, values: unknown[] = []): Promise<Json[]> {
  return (await api.owner.query(sql, values)).rows;
}
/** A member's own call through the in-process Data API with their token (the `authenticated` channel). */
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

/** DECLARED TEST SHORTCUT: an open request for the owner's item (the relevance read is proved in scenario P). */
async function requestFor(api: LocalDataApi, worldId: string, owner: Person, memoryId: string): Promise<string> {
  const [row] = await rows(api, `INSERT INTO shared_knowledge_private.requests (id, world_id, owner_user_id, membership_episode_id, memory_id)
    SELECT gen_random_uuid(), $1, $2, e.id, $3 FROM public.shared_world_membership_episodes e WHERE e.world_id = $1 AND e.user_id = $2 AND e.ended_at IS NULL
    RETURNING id`, [worldId, owner.userId, memoryId]);
  return row.id;
}

/** The opaque reference of the audience a member's own read shows them now (0177), or null when they have nothing here. */
async function refOf(person: Person, worldId: string): Promise<string | null> {
  const view = await asMember(person, 'list_own_shared_knowledge_v2', { p_world_id: worldId });
  return Array.isArray(view) ? view[0]?.audience_ref ?? null : null;
}
/** The owner's own consent through the real command: ALLOW over the audience their own read shows them. */
async function allowRequest(worldId: string, owner: Person, requestId: string): Promise<string | null> {
  return outcomeOf(await asMember(owner, 'answer_own_shared_knowledge_request_v2', {
    p_command_id: randomUUID(), p_request_id: requestId, p_decision: 'ALLOW', p_audience_ref: await refOf(owner, worldId),
  }));
}

async function traces(api: LocalDataApi, worldId: string) {
  const [counts] = await rows(api, `SELECT
      (SELECT count(*) FROM public.shared_world_materials m WHERE m.world_id = $1 AND m.material_kind = 'QANDEEL_OUTPUT')::int AS qandeel,
      (SELECT count(*) FROM shared_knowledge_private.uses u WHERE u.world_id = $1)::int AS uses,
      (SELECT count(*) FROM public.shared_world_material_dependencies d WHERE d.world_id = $1 AND d.dependency_kind = 'REASONING_DEPENDENCY')::int AS reasoning,
      (SELECT count(*) FROM shared_knowledge_private.cooldowns k WHERE k.world_id = $1 AND k.until > now() + interval '3500 seconds')::int AS cooled`, [worldId]);
  return counts;
}
const judgeRows = async (api: LocalDataApi, worldId: string) => (await ledgerOf(api, worldId)).filter((row) => row.family === 'SHARED_DISCLOSURE_JUDGE');

// ------------------------------------------------------------------------------------------- the synthetic people and texts
const ITEMS = {
  mohamed: 'أفضّل السفر بالقطار في الرحلات الطويلة',
  sara: 'أحب السفر بالطيارة لأنها أسرع',
  hala: 'أتوتر من السفر بالليل',
};
const ASK = 'نفكر في السفر للرحلة الطويلة الجاية، بالقطار ولا بالطيارة؟';
const ASK_AGAIN = 'طيب نحسم السفر للرحلة الطويلة: بالقطار ولا بالطيارة؟';
const SMALL_TALK = 'صباح الخير يا جماعة';
const none = (calls: ReadonlyArray<Crossing>, texts: ReadonlyArray<string>) => calls.every((call) => texts.every((text) => !call.text.includes(text)));
/** The items one judge request carries (its data block; the reply it judges is a separate field). */
const judgeItems = (call: Crossing): string[] => {
  const data = /<judge_data>([\s\S]*)<\/judge_data>/u.exec(call.text);
  return data === null ? [] : (JSON.parse(data[1]).items as Json[]).map((entry) => String(entry.item));
};

interface Trio { readonly hala: Person; readonly mohamed: Person; readonly sara: Person; readonly worldId: string; readonly items: { mohamed: string; sara: string; hala: string } }
async function trio(api: LocalDataApi, tag: string): Promise<Trio> {
  const hala = await signUp(api, `${tag}-hala`, 'هالة');
  const mohamed = await signUp(api, `${tag}-mohamed`, 'محمد');
  const sara = await signUp(api, `${tag}-sara`, 'سارة');
  const worldId = await worldOf(api, [hala, mohamed, sara]);
  const items = {
    mohamed: await memory(api, mohamed, ITEMS.mohamed, 0.9),
    sara: await memory(api, sara, ITEMS.sara, 0.6),
    hala: await memory(api, hala, ITEMS.hala, 0.3),
  };
  return { hala, mohamed, sara, worldId, items };
}

// ------------------------------------------------------------------------------------------- P. consent, requests, use, accounting
async function scenarioP(api: LocalDataApi, app: App) {
  scenarioNow = 'P0';
  check('the application composes the DeepSeek disclosure judge (SYNTHETIC_ONLY) and the stand-in recognises CG-6b',
    app.judge instanceof DeepSeekSharedDisclosureJudge && SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS.startsWith(CP3_SIMULATED_JUDGE_MARK));
  const t = await trio(api, 'p');
  const allItems = Object.values(ITEMS);
  const askTerms = new Set(memoryRetrievalTerms(ASK));
  check('the synthetic message shares index terms with every member\'s item (the relevance read has candidates)',
    allItems.every((item) => memoryRetrievalTerms(item).some((term) => askTerms.has(term))));

  scenarioNow = 'P1';
  const first = await say(app, t.hala, t.worldId, ASK);
  check('before any consent the reply commits and no judge is asked', first.sent.qandeel === 'COMMITTED' && first.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE'),
    { sent: first.sent, families: first.calls.map((call) => call.family) });
  check('before any consent no member\'s item text reaches DeepSeek', none(first.calls, allItems));
  const ledger1 = await ledgerOf(api, t.worldId);
  check('before any consent every ledger row is paid by the sender and none is a judge row',
    ledger1.length > 0 && ledger1.every((row) => row.payer === t.hala.userId) && ledger1.every((row) => row.family !== 'SHARED_DISCLOSURE_JUDGE'),
    ledger1.map((row) => ({ family: row.family, payer: row.payer === t.hala.userId ? 'hala' : 'OTHER' })));
  const open1 = await rows(api, "SELECT owner_user_id, memory_id FROM shared_knowledge_private.requests WHERE world_id = $1 AND state = 'OPEN'", [t.worldId]);
  check('the local relevance read opens ONE private request, for the strongest item (Mohamed\'s)',
    open1.length === 1 && open1[0].owner_user_id === t.mohamed.userId && open1[0].memory_id === t.items.mohamed, { open: open1.length });
  const mohamedView = await asMember(t.mohamed, 'list_own_shared_knowledge_v2', { p_world_id: t.worldId });
  const halaView = await asMember(t.hala, 'list_own_shared_knowledge_v2', { p_world_id: t.worldId });
  const saraView = await asMember(t.sara, 'list_own_shared_knowledge_v2', { p_world_id: t.worldId });
  check('the owner alone sees the request; the sender and the other member see nothing',
    Array.isArray(mohamedView) && mohamedView.length === 1 && mohamedView[0].section === 'REQUEST' && mohamedView[0].content === ITEMS.mohamed
    && Array.isArray(halaView) && halaView.length === 0 && Array.isArray(saraView) && saraView.length === 0, { mohamed: mohamedView?.length, hala: halaView, sara: saraView });
  const stolen = await asMember(t.sara, 'answer_own_shared_knowledge_request_v2', { p_command_id: randomUUID(), p_request_id: mohamedView[0]?.request_id, p_decision: 'ALLOW', p_audience_ref: mohamedView[0]?.audience_ref });
  check('another member cannot answer the owner\'s request (UNAVAILABLE, nothing written)',
    outcomeOf(stolen) === 'UNAVAILABLE' && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.reasoning_grants WHERE world_id = $1', [t.worldId])).length === 0, { stolen });

  scenarioNow = 'P2';
  const second = await say(app, t.hala, t.worldId, ASK_AGAIN);
  check('an item is never used before consent (no judge, no item text)', second.sent.qandeel === 'COMMITTED' && second.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE') && none(second.calls, allItems));
  const requests2 = await rows(api, 'SELECT owner_user_id, state FROM shared_knowledge_private.requests WHERE world_id = $1', [t.worldId]);
  const perOwner = (person: Person) => requests2.filter((row) => row.owner_user_id === person.userId).length;
  check('no repeated request: the owner still has exactly one; another member may be asked once', perOwner(t.mohamed) === 1 && perOwner(t.sara) <= 1 && perOwner(t.hala) <= 1,
    { mohamed: perOwner(t.mohamed), sara: perOwner(t.sara), hala: perOwner(t.hala) });

  scenarioNow = 'P3';
  const requestId = mohamedView[0]?.request_id;
  const narrow = await asMember(t.mohamed, 'answer_own_shared_knowledge_request_v2', { p_command_id: randomUUID(), p_request_id: requestId, p_decision: 'ALLOW', p_audience_ref: `sha256:${'0'.repeat(64)}` });
  check('an ALLOW over a reference that is not the exact current members\' is AUDIENCE_CHANGED and writes nothing',
    outcomeOf(narrow) === 'AUDIENCE_CHANGED' && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.reasoning_grants WHERE world_id = $1', [t.worldId])).length === 0, { narrow });
  check('the owner allows through the real authenticated command', (await allowRequest(t.worldId, t.mohamed, requestId)) === 'ALLOWED');
  // Sara declines her item: through her own request when the relevance read opened one, else a request made for the test.
  const saraOpen = (await rows(api, "SELECT id, memory_id FROM shared_knowledge_private.requests WHERE world_id = $1 AND owner_user_id = $2 AND state = 'OPEN'", [t.worldId, t.sara.userId]))[0];
  const saraRequest = saraOpen?.memory_id === t.items.sara ? saraOpen.id : await requestFor(api, t.worldId, t.sara, t.items.sara);
  const declined = outcomeOf(await asMember(t.sara, 'answer_own_shared_knowledge_request_v2', { p_command_id: randomUUID(), p_request_id: saraRequest, p_decision: 'DECLINE', p_audience_ref: null }));
  check('the other member declines through the real command (no grant)', declined === 'DECLINED'
    && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.reasoning_grants WHERE owner_user_id = $1', [t.sara.userId])).length === 0, { declined, viaRelevance: saraOpen?.memory_id === t.items.sara });

  scenarioNow = 'P4';
  const third = await say(app, t.hala, t.worldId, ASK);
  const judged = third.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE');
  const replyCalls = third.calls.filter((call) => call.family === 'REPLY');
  check('after consent, a LATER turn uses the allowed item: the reply commits', third.sent.qandeel === 'COMMITTED', { reply: third.reply });
  check('the reply request carries CG-6a and the allowed item, and never the declined or unasked items',
    replyCalls.some((call) => call.text.includes(SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS) && call.text.includes(ITEMS.mohamed)) && none(third.calls, [ITEMS.sara, ITEMS.hala]));
  check('exactly one judge call (one per owner), carrying only that owner\'s item', judged.length === 1 && JSON.stringify(judgeItems(judged[0])) === JSON.stringify([ITEMS.mohamed]) && none(judged, [ITEMS.sara, ITEMS.hala]));
  const [committed] = await rows(api, 'SELECT b.body_text FROM public.shared_world_text_material_bodies b WHERE b.material_id = $1', [third.reply?.materialId]);
  check('the committed reply mentions the item as its owner\'s (AUTHORIZED_DISCLOSURE, not CLEAR)', typeof committed?.body_text === 'string' && committed.body_text.includes(ITEMS.mohamed) && committed.body_text.includes('محمد'));
  const uses = await rows(api, 'SELECT owner_user_id, memory_id, disclosed, reasoning_grant_id FROM shared_knowledge_private.uses WHERE material_id = $1', [third.reply?.materialId]);
  const deps = await rows(api, "SELECT source_context_ref FROM public.shared_world_material_dependencies WHERE target_material_id = $1 AND dependency_kind = 'REASONING_DEPENDENCY'", [third.reply?.materialId]);
  check('one use record (disclosed) and the REASONING_DEPENDENCY on the opaque grant reference',
    uses.length === 1 && uses[0].owner_user_id === t.mohamed.userId && uses[0].disclosed === true
    && deps.length === 1 && deps[0].source_context_ref === `shared-knowledge:${uses[0].reasoning_grant_id}`, { uses: uses.length, deps });
  const judgeLedger = (await judgeRows(api, t.worldId)).filter((row) => row.message === third.sent.materialId);
  check('the judge call is paid by the verified sender of the causing message, attempt 1, exactly one ledger row per call',
    judgeLedger.length === judged.length && judgeLedger.every((row) => row.payer === t.hala.userId && row.attempt === 1), judgeLedger.map((row) => ({ state: row.state, attempt: row.attempt })));
  const everyRow = await ledgerOf(api, t.worldId);
  check('no AI cost is ever charged to the owner or the other member for Hala\'s messages', everyRow.every((row) => row.payer === t.hala.userId));
  const places = await placesOf(api, t.worldId);
  const semantic = crossings.filter((call) => call.family === 'SHARED_SEMANTIC_READING' || call.family === 'SHARED_SPATIAL_PLACEMENT' || call.family === 'SHARED_KNOWLEDGE_RECALL');
  check('no private item reaches the map, its reading, its placement or its recall', places.every((place) => allItems.every((item) => !String(place.meaning).includes(item))) && none(semantic, allItems),
    { places: places.length, semanticCalls: semantic.length });
  const afterDecline = await rows(api, 'SELECT count(*)::int AS n FROM shared_knowledge_private.requests WHERE owner_user_id = $1 AND memory_id = $2', [t.sara.userId, t.items.sara]);
  check('after "no", no automatic request ever re-opens the declined item', afterDecline[0].n === 1);

  scenarioNow = 'P5';
  const later = outcomeOf(await asMember(t.sara, 'allow_own_shared_knowledge_v2', { p_command_id: randomUUID(), p_world_id: t.worldId, p_memory_id: t.items.sara, p_audience_ref: await refOf(t.sara, t.worldId) }));
  check('the member who declined allows it later herself («اسمح الآن»)', later === 'ALLOWED');
  const fourth = await say(app, t.hala, t.worldId, ASK_AGAIN);
  const judged4 = fourth.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE');
  check('two owners\' items: two judge calls, each with its own owner\'s item only, both paid by the sender',
    fourth.sent.qandeel === 'COMMITTED' && judged4.length === 2
    && judged4.filter((call) => JSON.stringify(judgeItems(call)) === JSON.stringify([ITEMS.mohamed])).length === 1
    && judged4.filter((call) => JSON.stringify(judgeItems(call)) === JSON.stringify([ITEMS.sara])).length === 1
    && (await judgeRows(api, t.worldId)).filter((row) => row.message === fourth.sent.materialId).every((row) => row.payer === t.hala.userId), { judged: judged4.length, reply: fourth.reply });
  check('Hala\'s own item, never asked about or allowed, never reached DeepSeek in the whole scenario', none(crossings.filter((call) => call.scenario.startsWith('P')), [ITEMS.hala]));

  scenarioNow = 'P6';
  // A payer who is not the author: the judge itself, asked under Mohamed's identity for Hala's message, is refused by the
  // AI-COST-01 boundary before any provider request, and no ledger row names Mohamed.
  const crossed = crossings.length;
  let refusal: Json = null;
  try {
    await runWithAiUsageAttribution({ userId: t.mohamed.userId, sourceWorldId: t.worldId, sourceSharedMaterialId: fourth.sent.materialId }, async () => app.judge?.judge({
      binding: { effectiveContextRef: 'sha256:x', outputDigest: 'sha256:y', protectedSourceSetRef: 'sha256:z' }, reply: `محمد: ${ITEMS.mohamed}`, owner: 'محمد', members: ['هالة', 'سارة'],
      items: [{ contentDigest: 'sha256:d', item: ITEMS.mohamed }],
    }));
  } catch (error) {
    refusal = { name: (error as Json)?.name ?? 'Error', message: String((error as Json)?.message ?? '') };
  }
  check('a payer who is not the author is refused before any provider request', refusal !== null && crossings.length === crossed, { refusal: refusal?.name ?? null });
  check('the refusal reveals no item, name or identity', refusal !== null && !refusal.message.includes(ITEMS.mohamed) && !refusal.message.includes('محمد') && !refusal.message.includes(t.mohamed.userId) && !refusal.message.includes(t.hala.userId));
  check('no ledger row was written for the refused payer', (await ledgerOf(api, t.worldId)).every((row) => row.payer !== t.mohamed.userId));

  scenarioNow = 'P7';
  const talk = await say(app, t.hala, t.worldId, SMALL_TALK);
  check('ordinary conversation with no relevant knowledge: no judge, the reply as before', talk.sent.qandeel === 'COMMITTED' && talk.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE'));
}

// ------------------------------------------------------------------------------------------- W. withheld replies
let short = 0; // fixture keys stay within the login-id shape
async function consented(api: LocalDataApi, tag: string): Promise<Trio> {
  const t = await trio(api, tag);
  const allowed = await allowRequest(t.worldId, t.mohamed, await requestFor(api, t.worldId, t.mohamed, t.items.mohamed));
  if (allowed !== 'ALLOWED') throw new Error(`setup: the consent was not written (${allowed})`);
  return t;
}

async function withheld(api: LocalDataApi, app: App, tag: string, fault: Fault, expectCooldown = true) {
  scenarioNow = `W-${tag}`;
  const t = await consented(api, `w${++short}`);
  faults.push({ family: 'SHARED_DISCLOSURE_JUDGE', fault });
  const before = await traces(api, t.worldId);
  const turn = await say(app, t.hala, t.worldId, ASK);
  const after = await traces(api, t.worldId);
  const judged = turn.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE');
  check(`${fault}: the reply is withheld with the neutral provider-failure answer`, turn.sent.outcome === 'COMMITTED' && turn.sent.qandeel === 'UNAVAILABLE'
    && Object.keys(turn.sent).sort().join() === 'materialId,outcome,qandeel', { sent: turn.sent, reply: turn.reply });
  check(`${fault}: no QANDEEL material, no use record, no dependency (no partial write)`, after.qandeel === before.qandeel && after.uses === 0 && after.reasoning === before.reasoning, { before, after });
  check(`${fault}: one judge call and exactly one ledger row for it, paid by the sender, attempt 1`, judged.length === 1
    && (await judgeRows(api, t.worldId)).every((row) => row.payer === t.hala.userId && row.attempt === 1) && (await judgeRows(api, t.worldId)).length === 1);
  check(`${fault}: ${expectCooldown ? 'the item rests for the one-hour cooldown' : 'no cooldown'}`, expectCooldown ? after.cooled === 1 : after.cooled === 0, { cooled: after.cooled });
  const next = await say(app, t.hala, t.worldId, ASK_AGAIN);
  check(`${fault}: the next turn is generated without the item (no judge) and commits; nothing is regenerated`,
    next.sent.qandeel === 'COMMITTED' && next.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE') && none(next.calls.filter((call) => call.family === 'REPLY'), [ITEMS.mohamed]));
  check(`${fault}: the reply was attempted once (no automatic regeneration)`, turn.calls.filter((call) => call.family === 'REPLY').length === 1);
}

async function providerFailureShape(api: LocalDataApi, app: App) {
  scenarioNow = 'W-shape';
  const hala = await signUp(api, 'shape-hala', 'هالة');
  const omar = await signUp(api, 'shape-omar', 'عمر');
  const worldId = await worldOf(api, [hala, omar]);
  faults.push({ family: 'REPLY', fault: 'HTTP500' });
  const turn = await say(app, hala, worldId, ASK);
  check('the reference: an ordinary provider failure gives the same answer shape and qandeel value as every withheld reply',
    turn.sent.outcome === 'COMMITTED' && turn.sent.qandeel === 'UNAVAILABLE' && Object.keys(turn.sent).sort().join() === 'materialId,outcome,qandeel', { sent: turn.sent });
}

// ------------------------------------------------------------------------------------------- G. consent changing during generation
async function during(api: LocalDataApi, app: App, tag: string, label: string, change: (t: Trio) => Promise<unknown>, after: (t: Trio) => Promise<void>) {
  scenarioNow = `G-${tag}`;
  const t = await consented(api, `g${++short}`);
  actions.push({ family: 'SHARED_DISCLOSURE_JUDGE', label, run: () => change(t) });
  const before = await traces(api, t.worldId);
  const turn = await say(app, t.hala, t.worldId, ASK);
  const now = await traces(api, t.worldId);
  check(`${label} while the judge runs: the change happened`, acted.some((entry) => entry.scenario === scenarioNow && !(entry.result as Json)?.threw && !(entry.result as Json)?.error), acted.filter((entry) => entry.scenario === scenarioNow));
  check(`${label} while the judge runs: the reply is NOT committed with the no-longer-authorized item; nothing partial`,
    turn.sent.qandeel === 'UNAVAILABLE' && now.qandeel === before.qandeel && now.uses === 0 && now.reasoning === before.reasoning, { reply: turn.reply, before, now });
  check(`${label}: STALE, not a judged block — no cooldown is written`, now.cooled === 0);
  await after(t);
}

async function scenarioG(api: LocalDataApi, app: App) {
  const nextWithout = async (t: Trio, speaker: Person = t.hala) => {
    const next = await say(app, speaker, t.worldId, ASK_AGAIN);
    check('the next turn does not use the item and commits', next.sent.qandeel === 'COMMITTED' && next.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE') && none(next.calls, [ITEMS.mohamed]));
  };
  await during(api, app, 'revoke', 'the owner revokes', (t) => asMember(t.mohamed, 'revoke_own_shared_knowledge_v1', { p_command_id: randomUUID(), p_world_id: t.worldId, p_memory_id: t.items.mohamed }),
    async (t) => nextWithout(t));
  const newcomers: Person[] = [];
  await during(api, app, 'join', 'a new member joins', async (t) => {
    const newcomer = await signUp(api, `gjoin-${newcomers.length}`, 'كريم');
    newcomers.push(newcomer);
    await addMember(api, t.worldId, newcomer, [t.hala, t.mohamed, t.sara]);
  }, async (t) => {
    const view = await asMember(t.mohamed, 'list_own_shared_knowledge_v2', { p_world_id: t.worldId });
    check('the owner sees the item as NEEDS_RECONFIRMATION (the audience grew)', Array.isArray(view) && view.some((row: Json) => row.section === 'NEEDS_RECONFIRMATION' && row.memory_id === t.items.mohamed));
    await nextWithout(t);
    const again = outcomeOf(await asMember(t.mohamed, 'allow_own_shared_knowledge_v2', { p_command_id: randomUUID(), p_world_id: t.worldId, p_memory_id: t.items.mohamed, p_audience_ref: await refOf(t.mohamed, t.worldId) }));
    const used = await say(app, t.hala, t.worldId, ASK);
    check('after the owner reconfirms for the new audience, a later turn uses the item again', again === 'ALLOWED' && used.sent.qandeel === 'COMMITTED'
      && used.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE').length === 1, { again, reply: used.reply });
  });
  await during(api, app, 'leave', 'the owner leaves', (t) => asMember(t.mohamed, 'leave_shared_world_v1', { p_command_id: randomUUID(), p_world_id: t.worldId }), async (t) => {
    // The governed REJOIN itself (0140) and that it starts afresh are proved on real PostgreSQL by verify-migration-0176.mjs
    // ("leave and rejoin"); here: the departed owner's item is never used again and its grant has ended.
    await nextWithout(t);
    const old = await rows(api, 'SELECT s.state, s.reason FROM shared_knowledge_private.reasoning_grants r CROSS JOIN LATERAL shared_knowledge_private.grant_state_v1(r.id) s WHERE r.world_id = $1', [t.worldId]);
    check('leaving ends the grant (ENDED / LEFT); nothing revives it', old.length === 1 && old[0].state === 'ENDED' && old[0].reason === 'LEFT', old);
  });
  await during(api, app, 'correct', 'the owner corrects the memory', (t) => rows(api, "UPDATE public.memories SET status = 'SUPERSEDED' WHERE id = $1 AND user_id = $2 RETURNING status", [t.items.mohamed, t.mohamed.userId]),
    async (t) => nextWithout(t));
  await during(api, app, 'forget', 'the owner forgets the memory', (t) => rows(api, "UPDATE public.memories SET status = 'DELETED' WHERE id = $1 AND user_id = $2 RETURNING status", [t.items.mohamed, t.mohamed.userId]),
    async (t) => nextWithout(t));
}

// ------------------------------------------------------------------------------------------- C. CP3-C: the owner's permission surface, end to end
// The CP3-C authorization §6: every permission act through the APPLICATION's own routes (the Shared World controller, under
// each member's own token — standing in for the auth guard is the only harness part), every message through the send route
// (so the S4-04 Activity producer runs exactly as in production), and a separate Activity / notification proof (A).
// DECLARED TEST SHORTCUTS (as above): the memories; a correction and a forget as the database owner; the governance launch
// capability for the governed rejoin (the 0176 verifier's own fixture); a new member joined through the fixture's governed
// add path; the returning member's fresh Shared ID (no sealing key in the harness). The rejoin's proposal, approvals and
// acceptance, every permission act and every message go through the routes.
type Ctl = SharedWorldController;
const as = (person: Person) => ({ authenticatedUser: { userId: person.userId, accessToken: person.token } }) as never;
const cmd = (extra: Record<string, unknown> = {}) => ({ commandId: randomUUID(), ...extra });
/** What a route answered, or the HTTP status and body of the exception it threw (the client's view of an error). */
async function route(work: () => Promise<unknown>): Promise<Json> {
  try {
    return await work();
  } catch (error) {
    return { status: (error as Json)?.getStatus?.() ?? 'THREW', body: (error as Json)?.getResponse?.() ?? null };
  }
}
async function sayVia(app: App, ctl: Ctl, person: Person, worldId: string, text: string) {
  const crossed = crossings.length;
  const replied = app.replies.length;
  const sent: Json = await ctl.send(as(person), worldId, cmd({ content: text }));
  await app.settle();
  return { sent, reply: app.replies[replied] ?? null, calls: crossings.slice(crossed) };
}
const view = (ctl: Ctl, person: Person, worldId: string): Promise<Json> => route(() => ctl.permissionsOf(as(person), worldId));
const emptyView = (seen: Json) => seen?.outcome === 'READ' && ['requests', 'allowed', 'reconfirm', 'declined', 'ended'].every((key) => Array.isArray(seen[key]) && seen[key].length === 0);
const NEUTRAL = '{"outcome":"UNAVAILABLE"}';
/** A member's own read that shows nothing of another member's item (they may have a request of their own). */
const blind = (seen: Json, needles: ReadonlyArray<string>) => seen?.outcome === 'READ' && needles.every((needle) => !JSON.stringify(seen).includes(needle));

/** Everything a member could be told outside the conversation: Activity (items and their members), push, the outbox. */
async function attention(api: LocalDataApi): Promise<string> {
  const [snapshot] = await rows(api, `SELECT
      (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]') FROM public.activity_items a)::text AS items,
      (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.user_id, m.candidate_key), '[]') FROM public.activity_item_members m)::text AS members,
      (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY to_jsonb(p)::text), '[]') FROM public.push_delivery_attempts p)::text AS push,
      (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text), '[]') FROM public.runtime_event_outbox o)::text AS outbox`);
  return JSON.stringify(snapshot);
}
/** Permission acts that must leave every attention surface exactly as it was. */
const quiet: { label: string; same: boolean }[] = [];
async function silently<T>(api: LocalDataApi, label: string, act: () => Promise<T>): Promise<T> {
  const before = await attention(api);
  const result = await act();
  quiet.push({ label, same: (await attention(api)) === before });
  return result;
}
/** Each recipient's Activity for one World, without ids and times: what each member was told. */
async function toldIn(api: LocalDataApi, worldId: string): Promise<Map<string, string[]>> {
  const told = await rows(api, `SELECT m.user_id, a.kind, a.category, a.interruption_class, a.speaker, a.entry_destination, a.body_ar, a.body_en, a.secondary_ar,
      a.secondary_en, a.context_label_ar, a.context_label_en, a.disclosure_max, a.actionable, a.member_count, m.candidate_key
    FROM public.activity_items a JOIN public.activity_item_members m ON m.item_id = a.id WHERE a.context_ref = $1 ORDER BY m.candidate_key`, [worldId.toLowerCase()]);
  const out = new Map<string, string[]>();
  for (const row of told) out.set(row.user_id, [...(out.get(row.user_id) ?? []), JSON.stringify({ ...row, user_id: undefined })]);
  return out;
}
/** Every base table whose rows mention `needle` (schema.table → rows). */
async function whereIs(api: LocalDataApi, tables: ReadonlyArray<Json>, needle: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const { s, t } of tables) {
    const [hit] = await rows(api, `SELECT count(*)::int AS n FROM "${s}"."${t}" x WHERE strpos(x::text, $1) > 0`, [needle]);
    if (hit.n > 0) out[`${s}.${t}`] = hit.n;
  }
  return out;
}

/**
 * DECLARED TEST SHORTCUT: a fresh Shared ID for `member`, rotated as the database owner under the member's claims (the 0176
 * verifier's own fixture) — the harness has no Shared ID sealing key, so the identity route cannot show one here.
 */
async function sharedIdOf(api: LocalDataApi, member: Person): Promise<string> {
  const sharedId = Array.from({ length: 12 }, () => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[randomInt(32)]).join('').replace(/^(.{4})(.{4})/u, '$1-$2-');
  const client = await (api.owner as Json).connect();
  try {
    await client.query('BEGIN');
    const [state] = (await client.query('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [member.userId])).rows;
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: member.userId })]);
    await client.query('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)',
      [randomUUID(), `sid1:${createHash('sha256').update(sharedId, 'utf8').digest('hex')}`, state ? state.epoch : null]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return sharedId;
}

/** The governed REJOIN (0140) through the routes: the proposal by Shared ID, every approval, the returning member's acceptance. */
async function rejoinVia(api: LocalDataApi, ctl: Ctl, worldId: string, member: Person, current: ReadonlyArray<Person>): Promise<string> {
  const sharedId = await sharedIdOf(api, member);
  const proposed: Json = await route(() => ctl.proposeMember(as(current[0]), worldId, cmd({ sharedId })));
  if (proposed?.outcome !== 'SUBMITTED') return `proposed ${JSON.stringify(proposed)}`;
  const listed = await asMember(current[0], 'list_own_shared_world_proposals_v1', { p_world_id: worldId });
  const proposal = (Array.isArray(listed) ? listed : []).find((row: Json) => row.operation_kind === 'REJOIN_MEMBER')?.proposal_id;
  if (!proposal) return 'no rejoin proposal';
  for (const human of current) {
    const approved: Json = await route(() => ctl.approve(as(human), worldId, proposal, cmd()));
    if (!['APPROVED', 'INVITED'].includes(approved?.outcome)) return `approved ${JSON.stringify(approved)}`;
  }
  const joined: Json = await route(() => ctl.acceptMembershipRequest(as(member), worldId, proposal, cmd()));
  return joined?.outcome === 'JOINED' ? 'JOINED' : `accepted ${JSON.stringify(joined)}`;
}
/**
 * The lane did not serve the item to this turn: no judge was asked and no reply request carried the member-knowledge block.
 * (Words QANDEEL already said in the World stay in its history — CG-4 "What was already said stays as it is" — so a later
 * request may quote that earlier reply; that is the conversation, not a new use.)
 */
const noUse = (calls: ReadonlyArray<Crossing>) => calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE' && !call.text.includes('<member_knowledge>'));
const usage = (calls: ReadonlyArray<Crossing>) => calls.map((call) => ({ family: call.family, block: call.text.includes('<member_knowledge>'), words: call.text.includes(ITEMS.mohamed) }));
const grantsIn = async (api: LocalDataApi, worldId: string) => (await rows(api, 'SELECT 1 FROM shared_knowledge_private.reasoning_grants WHERE world_id = $1', [worldId])).length;

async function scenarioC(api: LocalDataApi, app: App) {
  const ctl = app.context.get(SharedWorldController);
  await rows(api, 'SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
    ['SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED', 's8a-04-cp3c-harness', 'synthetic fixture (the governed rejoin)']);
  const trios: Trio[] = [];
  const ids: string[] = [];
  const started = async (tag: string) => {
    const made = await trio(api, tag);
    trios.push(made);
    ids.push(made.items.mohamed, made.items.sara, made.items.hala);
    return made;
  };
  /** Hala asks; Mohamed reads his request and allows it over the audience he is shown. */
  const consentedVia = async (made: Trio) => {
    await sayVia(app, ctl, made.hala, made.worldId, ASK);
    const seen = await view(ctl, made.mohamed, made.worldId);
    ids.push(...(seen?.requests ?? []).map((row: Json) => row.requestId));
    return route(() => ctl.answerPermission(as(made.mohamed), made.worldId, seen?.requests?.[0]?.requestId, cmd({ decision: 'ALLOW', audienceRef: seen?.audienceRef })));
  };

  // ---------------------------------------------------------------- C1. the ten-step journey (§6)
  scenarioNow = 'C1';
  const t = await started('c');
  const ask = await sayVia(app, ctl, t.hala, t.worldId, ASK);
  check('1/3. Hala asks; the reply commits WITHOUT any member\'s item (no judge, no item text to DeepSeek)',
    ask.sent.outcome === 'COMMITTED' && ask.sent.qandeel === 'COMMITTED' && ask.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE') && none(ask.calls, Object.values(ITEMS)),
    { sent: ask.sent, families: ask.calls.map((call) => call.family) });
  const asked = await rows(api, "SELECT id, owner_user_id, memory_id FROM shared_knowledge_private.requests WHERE world_id = $1 AND state = 'OPEN'", [t.worldId]);
  check('2. the server found Mohamed\'s relevant item locally and opened ONE private request, for him',
    asked.length === 1 && asked[0].owner_user_id === t.mohamed.userId && asked[0].memory_id === t.items.mohamed, { open: asked.length });
  ids.push(...asked.map((row) => row.id));
  const mohamedSees = await view(ctl, t.mohamed, t.worldId);
  const halaSees = await view(ctl, t.hala, t.worldId);
  const saraSees = await view(ctl, t.sara, t.worldId);
  check('4. GET permissions: the request reaches Mohamed — his item, the other members by name in join order, an opaque audience reference',
    mohamedSees?.outcome === 'READ' && mohamedSees.requests.length === 1 && mohamedSees.requests[0].text === ITEMS.mohamed
    && mohamedSees.requests[0].itemId === t.items.mohamed && JSON.stringify(mohamedSees.members) === JSON.stringify(['هالة', 'سارة'])
    && /^sha256:[0-9a-f]{64}$/u.test(mohamedSees.audienceRef), { members: mohamedSees?.members, requests: mohamedSees?.requests?.length });
  check('4. Hala (who asked) and Sara see nothing of it', emptyView(halaSees) && emptyView(saraSees)
    && ![JSON.stringify(halaSees), JSON.stringify(saraSees)].some((seen) => seen.includes(ITEMS.mohamed) || seen.includes(asked[0]?.id) || seen.includes(t.items.mohamed)),
    { hala: halaSees, sara: saraSees });
  check('4. no route answer carries a user id', [mohamedSees, halaSees, saraSees].every((seen) => [t.hala, t.mohamed, t.sara].every((p) => !JSON.stringify(seen).includes(p.userId))));
  const requestId: string = mohamedSees.requests[0].requestId;
  const ref: string = mohamedSees.audienceRef;
  const foreignAnswer = await silently(api, 'another member answers the owner\'s request', () => route(() => ctl.answerPermission(as(t.sara), t.worldId, requestId, cmd({ decision: 'ALLOW', audienceRef: ref }))));
  const unknownAnswer = await silently(api, 'an unknown request is answered', () => route(() => ctl.answerPermission(as(t.sara), t.worldId, randomUUID(), cmd({ decision: 'ALLOW', audienceRef: ref }))));
  const foreignAllow = await silently(api, 'another member allows the owner\'s item', () => route(() => ctl.allowPermission(as(t.sara), t.worldId, t.items.mohamed, cmd({ audienceRef: ref }))));
  const foreignWithdraw = await silently(api, 'another member withdraws the owner\'s item', () => route(() => ctl.withdrawPermission(as(t.sara), t.worldId, t.items.mohamed, cmd())));
  const foreignWorld = await view(ctl, t.mohamed, randomUUID());
  check('no member can answer, allow or withdraw another member\'s request or item: the same neutral UNAVAILABLE as an unknown request or World, nothing written',
    [foreignAnswer, unknownAnswer, foreignAllow, foreignWithdraw, foreignWorld].every((answer) => JSON.stringify(answer) === NEUTRAL)
    && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.consent_events WHERE world_id = $1', [t.worldId])).length === 0,
    { foreignAnswer, unknownAnswer, foreignAllow, foreignWithdraw, foreignWorld });
  const stale = await silently(api, 'the owner answers over a reference that is not this audience', () => route(() => ctl.answerPermission(as(t.mohamed), t.worldId, requestId,
    cmd({ decision: 'ALLOW', audienceRef: `sha256:${'0'.repeat(64)}` }))));
  const malformed = await route(() => ctl.answerPermission(as(t.mohamed), t.worldId, requestId, cmd({ decision: 'ALLOW' })));
  const smuggled = await route(() => ctl.answerPermission(as(t.mohamed), t.worldId, requestId, cmd({ decision: 'ALLOW', audienceRef: ref, ceiling: [t.hala.userId] })));
  check('a stale reference is AUDIENCE_CHANGED and writes nothing; a malformed body or an extra field (a user-id ceiling) is the neutral 400',
    stale?.outcome === 'AUDIENCE_CHANGED' && malformed?.status === 400 && JSON.stringify(malformed.body) === '{"outcome":"INVALID_REQUEST"}'
    && smuggled?.status === 400 && JSON.stringify(smuggled.body) === '{"outcome":"INVALID_REQUEST"}' && (await grantsIn(api, t.worldId)) === 0, { stale, malformed, smuggled });
  const allowed = await silently(api, 'the owner allows', () => route(() => ctl.answerPermission(as(t.mohamed), t.worldId, requestId, cmd({ decision: 'ALLOW', audienceRef: ref }))));
  const afterAllow = await view(ctl, t.mohamed, t.worldId);
  check('5. Mohamed allows through POST …/answer over the audience he was shown; the item moves to «ما سمحت به هنا»',
    allowed?.outcome === 'ALLOWED' && afterAllow.requests.length === 0 && afterAllow.allowed.length === 1 && afterAllow.allowed[0].itemId === t.items.mohamed, { allowed, afterAllow });
  const replay = await silently(api, 'the answered request is answered again', () => route(() => ctl.answerPermission(as(t.mohamed), t.worldId, requestId, cmd({ decision: 'ALLOW', audienceRef: ref }))));
  check('the answered request cannot be answered again (UNAVAILABLE); one consent event only', JSON.stringify(replay) === NEUTRAL
    && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.consent_events WHERE world_id = $1', [t.worldId])).length === 1, { replay });
  const used = await sayVia(app, ctl, t.hala, t.worldId, ASK_AGAIN);
  const judged = used.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE');
  check('6. a LATER turn uses the item within the consent (its reply request carries it; no other member\'s item)',
    used.sent.qandeel === 'COMMITTED' && used.calls.some((call) => call.family === 'REPLY' && call.text.includes(ITEMS.mohamed)) && none(used.calls, [ITEMS.sara, ITEMS.hala]), { reply: used.reply });
  check('7. the judge checks the reply: one call, Mohamed\'s item only, paid by Hala (attempt 1)', judged.length === 1 && JSON.stringify(judgeItems(judged[0])) === JSON.stringify([ITEMS.mohamed])
    && (await judgeRows(api, t.worldId)).filter((row) => row.message === used.sent.materialId).every((row) => row.payer === t.hala.userId && row.attempt === 1));
  const uses = await rows(api, 'SELECT reasoning_grant_id FROM shared_knowledge_private.uses WHERE material_id = $1', [used.reply?.materialId]);
  const deps = await rows(api, "SELECT source_context_ref FROM public.shared_world_material_dependencies WHERE target_material_id = $1 AND dependency_kind = 'REASONING_DEPENDENCY'", [used.reply?.materialId]);
  const grant = await rows(api, 'SELECT r.id, s.state FROM shared_knowledge_private.reasoning_grants r CROSS JOIN LATERAL shared_knowledge_private.grant_state_v1(r.id) s WHERE r.world_id = $1', [t.worldId]);
  check('8/9. consent and audience revalidated at commit (the grant is ACTIVE for this audience); one use and the REASONING_DEPENDENCY on the opaque grant reference',
    uses.length === 1 && deps.length === 1 && deps[0].source_context_ref === `shared-knowledge:${uses[0].reasoning_grant_id}` && grant.length === 1 && grant[0].state === 'ACTIVE', { uses, deps, grant });
  ids.push(...grant.map((row) => row.id));
  const [body] = await rows(api, 'SELECT body_text FROM public.shared_world_text_material_bodies WHERE material_id = $1', [used.reply?.materialId]);
  const SOURCE_WORDS = ['إذن', 'سمح', 'طلب', 'خاص', 'أخبرني', 'قال لي', 'ذكرت لي', 'محادثة', 'permission', 'allow', 'request', 'private'];
  check('10. the reply reads naturally: the item as Mohamed\'s, and no word of consent, request, source or private talk',
    typeof body?.body_text === 'string' && body.body_text.includes(ITEMS.mohamed) && SOURCE_WORDS.every((word) => !body.body_text.includes(word)), { body: body?.body_text });
  for (const reader of [t.hala, t.sara, t.mohamed]) {
    const seen = JSON.stringify(await route(() => ctl.materials(as(reader), t.worldId)));
    check(`10. ${reader.key}'s conversation read shows the reply and nothing of the grant, the request, the item id or the dependency`,
      seen.includes(ITEMS.mohamed) && ![uses[0]?.reasoning_grant_id, requestId, t.items.mohamed, 'shared-knowledge:', 'REASONING_DEPENDENCY'].some((needle) => needle && seen.includes(needle)));
  }

  // ---------------------------------------------------------------- C2. decline, «اسمح الآن», withdraw
  scenarioNow = 'C2';
  const d = await started('cd');
  await sayVia(app, ctl, d.hala, d.worldId, ASK);
  const dView = await view(ctl, d.mohamed, d.worldId);
  ids.push(...(dView?.requests ?? []).map((row: Json) => row.requestId));
  const declined = await silently(api, 'the owner declines', () => route(() => ctl.answerPermission(as(d.mohamed), d.worldId, dView.requests[0]?.requestId, cmd({ decision: 'DECLINE' }))));
  const dAfter = await view(ctl, d.mohamed, d.worldId);
  check('decline: DECLINED, no grant, the item listed under «رفضته»', declined?.outcome === 'DECLINED' && dAfter.declined.length === 1 && dAfter.declined[0].itemId === d.items.mohamed
    && dAfter.allowed.length === 0 && (await grantsIn(api, d.worldId)) === 0, { declined, dAfter });
  const dAgain = await sayVia(app, ctl, d.hala, d.worldId, ASK_AGAIN);
  const dRequests = await rows(api, 'SELECT count(*)::int AS n FROM shared_knowledge_private.requests WHERE world_id = $1 AND owner_user_id = $2', [d.worldId, d.mohamed.userId]);
  check('decline: no repeated automatic request, and the item is never used', dRequests[0].n === 1 && noUse(dAgain.calls) && (await view(ctl, d.mohamed, d.worldId)).requests.length === 0);
  const nowRef = (await view(ctl, d.mohamed, d.worldId)).audienceRef;
  const later = await silently(api, 'the owner allows now («اسمح الآن»)', () => route(() => ctl.allowPermission(as(d.mohamed), d.worldId, d.items.mohamed, cmd({ audienceRef: nowRef }))));
  const dUsed = await sayVia(app, ctl, d.hala, d.worldId, ASK);
  check('«اسمح الآن»: ALLOWED, and a later turn uses the item', later?.outcome === 'ALLOWED' && dUsed.sent.qandeel === 'COMMITTED'
    && dUsed.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE').length === 1, { later, reply: dUsed.reply });
  const saidBefore = await rows(api, "SELECT count(*)::int AS n FROM public.shared_world_materials WHERE world_id = $1 AND material_kind = 'QANDEEL_OUTPUT'", [d.worldId]);
  const withdrawn = await silently(api, 'the owner withdraws', () => route(() => ctl.withdrawPermission(as(d.mohamed), d.worldId, d.items.mohamed, cmd())));
  const wView = await view(ctl, d.mohamed, d.worldId);
  const wNext = await sayVia(app, ctl, d.hala, d.worldId, ASK_AGAIN);
  const saidAfter = await rows(api, "SELECT count(*)::int AS n FROM public.shared_world_materials WHERE world_id = $1 AND material_kind = 'QANDEEL_OUTPUT'", [d.worldId]);
  check('withdraw: WITHDRAWN, the item leaves «مسموح», future use stops', withdrawn?.outcome === 'WITHDRAWN' && wView.allowed.length === 0
    && wNext.sent.qandeel === 'COMMITTED' && noUse(wNext.calls), { withdrawn, wView, calls: usage(wNext.calls) });
  check('withdraw: what was already said stays (no QANDEEL message deleted)', saidAfter[0].n === saidBefore[0].n + 1
    && JSON.stringify(await route(() => ctl.materials(as(d.hala), d.worldId))).includes(ITEMS.mohamed), { before: saidBefore[0].n, after: saidAfter[0].n });

  // ---------------------------------------------------------------- C3. correct and forget
  for (const [tag, status, reason] of [['cc', 'SUPERSEDED', 'CORRECTED'], ['cf', 'DELETED', 'FORGOTTEN']] as const) {
    scenarioNow = `C3-${reason}`;
    const e = await started(tag);
    const consent = await consentedVia(e);
    await rows(api, 'UPDATE public.memories SET status = $3 WHERE id = $1 AND user_id = $2', [e.items.mohamed, e.mohamed.userId, status]);
    const ended = await view(ctl, e.mohamed, e.worldId);
    const next = await sayVia(app, ctl, e.hala, e.worldId, ASK_AGAIN);
    check(`${reason.toLowerCase()}: the permission ends, shown to the owner only (${reason}), and the item is never used again`,
      consent?.outcome === 'ALLOWED' && ended.allowed.length === 0 && ended.ended.some((row: Json) => row.itemId === e.items.mohamed && row.reason === reason)
      && noUse(next.calls) && blind(await view(ctl, e.hala, e.worldId), [ITEMS.mohamed, e.items.mohamed]) && blind(await view(ctl, e.sara, e.worldId), [ITEMS.mohamed, e.items.mohamed]),
      { consent, ended: ended.ended, calls: usage(next.calls) });
    if (reason === 'FORGOTTEN') check('forget: the ended row no longer carries the forgotten words', ended.ended.every((row: Json) => row.text !== ITEMS.mohamed), ended.ended);
  }

  // ---------------------------------------------------------------- C4. audience growth
  scenarioNow = 'C4';
  const g = await started('cg');
  await sayVia(app, ctl, g.hala, g.worldId, ASK);
  const gView = await view(ctl, g.mohamed, g.worldId);
  const gAllowed = await route(() => ctl.answerPermission(as(g.mohamed), g.worldId, gView.requests[0]?.requestId, cmd({ decision: 'ALLOW', audienceRef: gView.audienceRef })));
  const karim = await signUp(api, 'cg-karim', 'كريم');
  await addMember(api, g.worldId, karim, [g.hala, g.mohamed, g.sara]);
  const grown = await view(ctl, g.mohamed, g.worldId);
  check('growth: no automatic widening — the item waits for reconfirmation, privately, naming the new member; the reference changed',
    gAllowed?.outcome === 'ALLOWED' && grown.allowed.length === 0 && grown.reconfirm.length === 1 && JSON.stringify(grown.reconfirm[0].newMembers) === JSON.stringify(['كريم'])
    && JSON.stringify(grown.members) === JSON.stringify(['هالة', 'سارة', 'كريم']) && grown.audienceRef !== gView.audienceRef, { grown });
  check('growth: the newcomer and the other members see nothing of it', emptyView(await view(ctl, karim, g.worldId)) && emptyView(await view(ctl, g.sara, g.worldId)));
  const waiting = await sayVia(app, ctl, g.hala, g.worldId, ASK_AGAIN);
  check('growth: until the owner chooses, the item is not used', noUse(waiting.calls));
  const oldRef = await silently(api, 'the owner reconfirms over the earlier audience', () => route(() => ctl.allowPermission(as(g.mohamed), g.worldId, g.items.mohamed, cmd({ audienceRef: gView.audienceRef }))));
  const everyone = await silently(api, 'the owner allows for everyone («اسمح للجميع»)', () => route(() => ctl.allowPermission(as(g.mohamed), g.worldId, g.items.mohamed, cmd({ audienceRef: grown.audienceRef }))));
  const widened = await sayVia(app, ctl, g.hala, g.worldId, ASK);
  check('growth: the earlier reference is AUDIENCE_CHANGED; «اسمح للجميع» over the new one is ALLOWED and a later turn uses it',
    oldRef?.outcome === 'AUDIENCE_CHANGED' && everyone?.outcome === 'ALLOWED' && widened.calls.filter((call) => call.family === 'SHARED_DISCLOSURE_JUDGE').length === 1, { oldRef, everyone });

  // ---------------------------------------------------------------- C5. leave and rejoin
  scenarioNow = 'C5';
  const l = await started('cl');
  const lConsent = await consentedVia(l);
  const left: Json = await ctl.leave(as(l.mohamed), l.worldId, cmd());
  const outside = await view(ctl, l.mohamed, l.worldId);
  const lNext = await sayVia(app, ctl, l.hala, l.worldId, ASK_AGAIN);
  check('leave: LEFT; the departed owner reads only the neutral UNAVAILABLE; the item is not used', lConsent?.outcome === 'ALLOWED' && left?.outcome === 'LEFT'
    && JSON.stringify(outside) === NEUTRAL && noUse(lNext.calls), { lConsent, left, outside });
  const rejoined = await rejoinVia(api, ctl, l.worldId, l.mohamed, [l.hala, l.sara]);
  const back = await view(ctl, l.mohamed, l.worldId);
  const lAfter = await sayVia(app, ctl, l.hala, l.worldId, ASK);
  check('rejoin (governed, through the routes): the earlier permission shows as ended because he left; nothing is revived or used',
    rejoined === 'JOINED' && back?.outcome === 'READ' && back.allowed.length === 0 && back.ended.some((row: Json) => row.itemId === l.items.mohamed && row.reason === 'LEFT')
    && lAfter.calls.every((call) => call.family !== 'SHARED_DISCLOSURE_JUDGE'), { rejoined, ended: back?.ended, requests: back?.requests?.length });

  // ---------------------------------------------------------------- A. Activity and notifications: a separate proof
  scenarioNow = 'A';
  const worlds = trios.map((made) => made.worldId);
  check('A1. every permission act (allow, decline, «اسمح الآن», «اسمح للجميع», withdraw, refused, stale and replayed acts) left Activity, its members, push and the outbox byte-identical',
    quiet.length >= 12 && quiet.every((entry) => entry.same), quiet);
  const live = await rows(api, 'SELECT count(*)::int AS n FROM public.activity_items WHERE context_ref = ANY($1::text[])', [worlds.map((w) => w.toLowerCase())]);
  check('A2. the Activity channel is live in this run (the send, leave and rejoin routes produced Activity), so the silence above is meaningful', live[0].n > 0, { items: live[0].n });
  const told = await toldIn(api, t.worldId);
  check('A3. the turns that opened, answered and used Mohamed\'s permission told Mohamed exactly what they told Sara (no sign of a request, a decision or its owner)',
    (told.get(t.mohamed.userId)?.length ?? 0) > 0 && JSON.stringify(told.get(t.mohamed.userId)) === JSON.stringify(told.get(t.sara.userId)),
    { mohamed: told.get(t.mohamed.userId)?.length ?? 0, sara: told.get(t.sara.userId)?.length ?? 0 });
  const attentionText = await attention(api);
  const CONSENT_WORDS = ['ما سمحت به هنا', 'سحب الإذن', 'اسمح', 'رفضته', 'allowed here', 'Withdraw', 'Allow', 'permission'];
  check('A4. no Activity, push or outbox row carries any item\'s words, an item / request / grant id, or the permission words',
    Object.values(ITEMS).every((item) => !attentionText.includes(item)) && ids.every((id) => !attentionText.includes(id)) && CONSENT_WORDS.every((word) => !attentionText.includes(word)));
  const payers = await rows(api, 'SELECT DISTINCT user_id FROM public.ai_provider_calls WHERE source_world_id = ANY($1::uuid[])', [worlds]);
  const speakers = new Set(trios.map((made) => made.hala.userId));
  check('A5. accounting: every provider call of these Worlds is charged to the one who spoke; no owner who answered a request is ever named',
    payers.length > 0 && payers.every((row) => speakers.has(row.user_id)), { payers: payers.length });
  const tables = await rows(api, `SELECT table_schema AS s, table_name AS t FROM information_schema.tables
    WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2`);
  const homeOfWords = (table: string) => table.startsWith('shared_knowledge_private.') || table === 'public.memories' || table === 'public.shared_world_text_material_bodies';
  // The owner's own memory history (0072) is keyed by the memory: personal, never shared — A7 checks it holds the owner's rows only.
  const homeOfIds = (table: string) => table.startsWith('shared_knowledge_private.') || table.startsWith('public.memor') || table === 'public.shared_world_material_dependencies'
    || table === 'public.historical_material_events';
  const strays: Record<string, Record<string, number>> = {};
  for (const [needle, home] of [...Object.values(ITEMS).map((item) => [item, homeOfWords] as const), ...ids.map((id) => [id, homeOfIds] as const)]) {
    const found = await whereIs(api, tables, needle);
    const stray = Object.keys(found).filter((table) => !home(table));
    if (stray.length) strays[needle.slice(0, 12)] = Object.fromEntries(stray.map((table) => [table, found[table]]));
  }
  check('A6. a whole-database scan: an item\'s words live only in its memory, the private lane and the consented replies; its ids only in the private lane, the memory and the opaque dependency',
    Object.keys(strays).length === 0, strays);
  const [history] = await rows(api, `SELECT count(*)::int AS n FROM public.historical_material_events h JOIN public.memories m ON m.id = h.memory_id
    WHERE h.memory_id = ANY($1::uuid[]) AND h.user_id <> m.user_id`, [ids]);
  check('A7. the memory history that names an item is its owner\'s own, only', history.n === 0, history);
}

// ------------------------------------------------------------------------------------------- main
async function main() {
  process.env.MODEL_PROVIDER = 'deepseek';
  const api = await openLocalDataApi(process.env);
  installDeepSeekObserver();
  const results: Json = { mode: DRY ? 'dry' : 'simulated', head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, startedAt: new Date().toISOString() };
  let app: App | null = null;
  try {
    await enableSharedConversation(api);
    app = await application();
    if (DRY) {
      scenarioNow = 'dry';
      const t = await trio(api, 'dry');
      const turn = await say(app, t.hala, t.worldId, ASK);
      check('dry: the guard refuses the first DeepSeek request and the reply is withheld safely', turn.sent.qandeel !== 'COMMITTED', { sent: turn.sent });
    } else {
      await scenarioP(api, app);
      await providerFailureShape(api, app);
      for (const [tag, fault] of [['quote', 'QUOTE'], ['misattribution', 'OTHER_PERSON'], ['source', 'SEALED'], ['unsupported', 'UNSUPPORTED'], ['http500', 'HTTP500'], ['malformed', 'MALFORMED']] as const) {
        await withheld(api, app, tag, fault);
      }
      await scenarioG(api, app);
      await scenarioC(api, app);
      scenarioNow = 'end';
      check('every planned fault and consent change was consumed', faults.length === 0 && actions.length === 0, { faults, actions: actions.map((entry) => entry.label) });
    }
  } finally {
    await app?.context.close();
    results.finishedAt = new Date().toISOString();
    results.checks = checks;
    results.passed = checks.filter((entry) => entry.pass).length;
    results.failed = checks.filter((entry) => !entry.pass).length;
    results.replies = app?.replies ?? [];
    results.acted = acted;
    results.calls = crossings.map((call) => ({ scenario: call.scenario, family: call.family, fault: call.fault, status: call.status }));
    results.dataApiCalls = Object.fromEntries(api.calls);
    mkdirSync(dirname(RESULTS), { recursive: true });
    writeFileSync(RESULTS, `${JSON.stringify(results, null, 2)}\n`);
    await api.close();
  }
  console.log(`[cp3] ${results.passed} passed, ${results.failed} failed; ${crossings.length} DeepSeek requests (${DRY ? 'all refused by the guard' : 'simulated'}); results: ${RESULTS}`);
  process.exit(results.failed === 0 && results.passed > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[cp3] NOT COMPLETED: ${(error as Json)?.message ?? error}`);
  process.exit(1);
});
