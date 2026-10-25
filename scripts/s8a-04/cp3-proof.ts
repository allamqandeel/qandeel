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
//   * every consent through the owner's own `authenticated` 0176 command, with the owner's token — never as the server;
//   * spies that only RECORD (the reply's outcome, the fire-and-forget pass and relevance read, what crossed the DeepSeek
//     URL) and, at that URL, injected judge answers and faults, and consent changes made WHILE the judge is being asked
//     (a revoke, a join, a leave, a correction, a forget) — the boundary the free unit suites cannot reach end to end.
// DECLARED TEST SHORTCUTS: the memories are inserted as the database owner (the capture path is not under test); in the
// withheld and during-generation scenarios a request row is inserted as the database owner so that the owner can answer it
// with the real command (the relevance read itself is proved in scenario P); a correction and a forget move the memory to
// SUPERSEDED / DELETED as the database owner, the transitions the memory runtime makes (as verify-migration-0176.mjs
// does). Nothing is logged but bounded outcomes; the results file holds synthetic texts only.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
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
const audienceOf = async (api: LocalDataApi, worldId: string): Promise<string[]> =>
  (await rows(api, 'SELECT user_id FROM public.shared_world_membership_episodes WHERE world_id = $1 AND ended_at IS NULL ORDER BY user_id', [worldId])).map((row) => row.user_id);

/** The owner's own consent through the real command: ALLOW with the exact current members. */
async function allowRequest(api: LocalDataApi, worldId: string, owner: Person, requestId: string): Promise<string | null> {
  return outcomeOf(await asMember(owner, 'answer_own_shared_knowledge_request_v1', {
    p_command_id: randomUUID(), p_request_id: requestId, p_decision: 'ALLOW', p_ceiling_user_ids: await audienceOf(api, worldId),
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
  const mohamedView = await asMember(t.mohamed, 'list_own_shared_knowledge_v1', { p_world_id: t.worldId });
  const halaView = await asMember(t.hala, 'list_own_shared_knowledge_v1', { p_world_id: t.worldId });
  const saraView = await asMember(t.sara, 'list_own_shared_knowledge_v1', { p_world_id: t.worldId });
  check('the owner alone sees the request; the sender and the other member see nothing',
    Array.isArray(mohamedView) && mohamedView.length === 1 && mohamedView[0].section === 'REQUEST' && mohamedView[0].content === ITEMS.mohamed
    && Array.isArray(halaView) && halaView.length === 0 && Array.isArray(saraView) && saraView.length === 0, { mohamed: mohamedView?.length, hala: halaView, sara: saraView });
  const stolen = await asMember(t.sara, 'answer_own_shared_knowledge_request_v1', { p_command_id: randomUUID(), p_request_id: mohamedView[0]?.request_id, p_decision: 'ALLOW', p_ceiling_user_ids: await audienceOf(api, t.worldId) });
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
  const narrow = await asMember(t.mohamed, 'answer_own_shared_knowledge_request_v1', { p_command_id: randomUUID(), p_request_id: requestId, p_decision: 'ALLOW', p_ceiling_user_ids: [t.mohamed.userId, t.hala.userId] });
  check('an ALLOW whose ceiling is not the exact current members is AUDIENCE_CHANGED and writes nothing',
    outcomeOf(narrow) === 'AUDIENCE_CHANGED' && (await rows(api, 'SELECT 1 FROM shared_knowledge_private.reasoning_grants WHERE world_id = $1', [t.worldId])).length === 0, { narrow });
  check('the owner allows through the real authenticated command', (await allowRequest(api, t.worldId, t.mohamed, requestId)) === 'ALLOWED');
  // Sara declines her item: through her own request when the relevance read opened one, else a request made for the test.
  const saraOpen = (await rows(api, "SELECT id, memory_id FROM shared_knowledge_private.requests WHERE world_id = $1 AND owner_user_id = $2 AND state = 'OPEN'", [t.worldId, t.sara.userId]))[0];
  const saraRequest = saraOpen?.memory_id === t.items.sara ? saraOpen.id : await requestFor(api, t.worldId, t.sara, t.items.sara);
  const declined = outcomeOf(await asMember(t.sara, 'answer_own_shared_knowledge_request_v1', { p_command_id: randomUUID(), p_request_id: saraRequest, p_decision: 'DECLINE', p_ceiling_user_ids: null }));
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
  const later = outcomeOf(await asMember(t.sara, 'allow_own_shared_knowledge_v1', { p_command_id: randomUUID(), p_world_id: t.worldId, p_memory_id: t.items.sara, p_ceiling_user_ids: await audienceOf(api, t.worldId) }));
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
  const allowed = await allowRequest(api, t.worldId, t.mohamed, await requestFor(api, t.worldId, t.mohamed, t.items.mohamed));
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
    const view = await asMember(t.mohamed, 'list_own_shared_knowledge_v1', { p_world_id: t.worldId });
    check('the owner sees the item as NEEDS_RECONFIRMATION (the audience grew)', Array.isArray(view) && view.some((row: Json) => row.section === 'NEEDS_RECONFIRMATION' && row.memory_id === t.items.mohamed));
    await nextWithout(t);
    const again = outcomeOf(await asMember(t.mohamed, 'allow_own_shared_knowledge_v1', { p_command_id: randomUUID(), p_world_id: t.worldId, p_memory_id: t.items.mohamed, p_ceiling_user_ids: await audienceOf(api, t.worldId) }));
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
