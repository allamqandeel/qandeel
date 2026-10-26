// S8A-04 CP2 — the integrated proof of the placer binding (Controlled Amendment §7; Product Owner, 2026-10-25: "a proof of
// the real production path, synthetic data only; unit tests alone do not close it"). Operator-only: never a CI step, never
// imported by production code. Launched only by cp2-binding-launch.mjs under scripts/s8a-02/network-guard.cjs (round 20).
//
// What runs is the APPLICATION's composition itself: Nest builds `SharedWorldModule` (the module the API root imports), so
// the reading, the recall, the reply router and the placer are exactly what its providers compose from the environment —
// nothing is constructed by hand. The harness parts are:
//   * the in-process Data API over the disposable PostgreSQL 17 migrated through every migration (cp2-local-data-api.ts);
//   * the fixtures that make people and Worlds through the frozen commands (cp2-worlds.ts);
//   * spies that only RECORD: the pass's outcome (so the run can await the fire-and-forget pass) and what crossed the
//     DeepSeek URL; and, in simulated mode only, a fault injector at that URL (an HTTP 500, a hang until the caller's own
//     timeout aborts it, an empty reading, a reading whose attribution the decoder must refuse, a placement naming no valid
//     anchor). An injected fault never reaches the network guard: it is what a provider failure looks like to the adapter.
// The network guard scrubs MODEL_PROVIDER from the environment it is given; the driver sets it to `deepseek` (the only
// provider the application can select, S8A-03 D1) after the guard, so the application's reply router is composed as an
// operator would configure it. Every request still passes the guard.
// Live mode (round 20, locked until the Product Owner approves its budget) runs scenario A only, with no injected fault.
// Nothing is logged but bounded outcomes; the results file holds the synthetic texts and what the services returned.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { MODEL_ROUTER, type ModelRouter } from '../../apps/api/src/model-router/model-router.types';
import { SharedQandeelReplyService } from '../../apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.service';
import { SharedSemanticPlaceService, type SharedSemanticPassOutcome, type SharedSemanticPassRequest } from '../../apps/api/src/connected-worlds/material-commit/shared-semantic-place.service';
import { SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-knowledge-recall';
import { SHARED_SEMANTIC_READING_INSTRUCTIONS_V2 } from '../../apps/api/src/shared-world/deepseek-shared-semantic-interpreter';
import { DeepSeekSharedSpatialPlacer, SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-spatial-placer';
import { inMeaningOrder, placeNewMeanings, type ExistingFieldPlace } from '../../apps/api/src/shared-world/shared-field-geometry';
import { SharedSemanticFieldService } from '../../apps/api/src/shared-world/shared-semantic-field.service';
import { SHARED_SEMANTIC_INTERPRETER, UnconfiguredSharedSemanticInterpreter } from '../../apps/api/src/shared-world/shared-semantic-interpreter';
import { SHARED_SPATIAL_PLACER, UnconfiguredSharedSpatialPlacer, decodeSharedSpatialPlacement, type SharedSpatialPlacementInput } from '../../apps/api/src/shared-world/shared-spatial-placer';
import { SharedWorldConversationService } from '../../apps/api/src/shared-world/shared-world-conversation.service';
import { SharedWorldLifecycleService } from '../../apps/api/src/shared-world/shared-world-lifecycle.service';
import { SharedWorldModule } from '../../apps/api/src/shared-world/shared-world.module';
import { openLocalDataApi, type LocalDataApi } from './cp2-local-data-api';
import { addMember, enableSharedConversation, ledgerOf, placesOf, signUp, worldOf, type Person } from './cp2-worlds';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const LIVE = process.env.QANDEEL_EVAL_SIMULATE !== '1' && process.env.QANDEEL_EVAL_DRY !== '1';
const RESULTS = process.env.QANDEEL_S8A04_RESULTS_PATH ?? '';
if (!RESULTS) throw new Error('NOT RUN: QANDEEL_S8A04_RESULTS_PATH is required');

// ------------------------------------------------------------------------------------------- the DeepSeek URL: record, inject
type Family = 'SHARED_SEMANTIC_READING' | 'SHARED_SPATIAL_PLACEMENT' | 'SHARED_KNOWLEDGE_RECALL' | 'OTHER';
type Fault = 'HTTP500' | 'HANG' | 'EMPTY' | 'BAD_ATTRIBUTION' | 'NO_ANCHOR';
interface Crossing { readonly scenario: string; readonly family: Family; readonly fault: Fault | null; readonly body: Json; answer: Json; status: number | null; ms: number | null }
const crossings: Crossing[] = [];
let scenarioNow = 'setup';
const faults: { family: Family; fault: Fault }[] = [];

function familyOf(body: Json): Family {
  const system = String(body?.messages?.[0]?.content ?? '');
  if (system.startsWith(SHARED_SEMANTIC_READING_INSTRUCTIONS_V2.slice(0, 80))) return 'SHARED_SEMANTIC_READING';
  if (system.startsWith(SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS.slice(0, 80))) return 'SHARED_SPATIAL_PLACEMENT';
  if (system.startsWith(SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS.slice(0, 80))) return 'SHARED_KNOWLEDGE_RECALL';
  return 'OTHER';
}

function rewrite(response: Response, change: (content: Json) => Json): Promise<Response> {
  return response.json().then((json: Json) => {
    json.choices[0].message.content = JSON.stringify(change(JSON.parse(json.choices[0].message.content)));
    return new Response(JSON.stringify(json), { status: response.status, headers: { 'content-type': 'application/json' } });
  });
}

function installDeepSeekObserver(): void {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: Json, init?: Json) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url !== DEEPSEEK) return inner(input, init);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const family = familyOf(body);
    const planned = LIVE ? -1 : faults.findIndex((entry) => entry.family === family);
    const fault = planned >= 0 ? faults.splice(planned, 1)[0].fault : null;
    const crossing: Crossing = { scenario: scenarioNow, family, fault, body, answer: null, status: null, ms: null };
    crossings.push(crossing);
    const started = Date.now();
    try {
      if (fault === 'HTTP500') {
        crossing.status = 500;
        return new Response(JSON.stringify({ error: { type: 'server_error', code: 'injected', message: 'injected failure' } }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      if (fault === 'HANG') {
        // No answer until the caller's own timeout aborts the request: the adapter's bound, not ours, ends it.
        await new Promise<never>((_, reject) => {
          const signal: AbortSignal | undefined = init?.signal;
          if (!signal) return;
          signal.addEventListener('abort', () => reject(signal.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        });
      }
      let response: Response = await inner(input, init);
      if (fault === 'EMPTY') response = await rewrite(response, () => ({ places: [] }));
      if (fault === 'BAD_ATTRIBUTION') response = await rewrite(response, (answer) => ({ places: answer.places.map((place: Json) => ({ ...place, relayedBy: [...place.holders] })) }));
      if (fault === 'NO_ANCHOR') response = await rewrite(response, (answer) => ({ placements: answer.placements.map((entry: Json) => ({ new: entry.new, anchors: [{ to: entry.new, closeness: 1 }] })) }));
      crossing.status = response.status;
      const copy = response.clone();
      crossing.answer = await copy.json().then((json: Json) => json?.choices?.[0]?.message?.content ?? null).catch(() => null);
      return response;
    } finally {
      crossing.ms = Date.now() - started;
    }
  }) as typeof fetch;
}

// ------------------------------------------------------------------------------------------- checks
interface Check { readonly scenario: string; readonly id: string; readonly pass: boolean; readonly detail: Json }
const checks: Check[] = [];
function check(id: string, pass: boolean, detail: Json = null): boolean {
  checks.push({ scenario: scenarioNow, id, pass, detail });
  console.log(`[cp2-binding] ${pass ? 'PASS' : 'FAIL'} ${scenarioNow} ${id}`);
  return pass;
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

// ------------------------------------------------------------------------------------------- the application
interface App {
  readonly context: INestApplicationContext;
  readonly conversation: SharedWorldConversationService;
  readonly field: SharedSemanticFieldService;
  readonly lifecycle: SharedWorldLifecycleService;
  readonly passes: { request: SharedSemanticPassRequest; outcome: SharedSemanticPassOutcome | null }[];
  readonly placements: { input: SharedSpatialPlacementInput; raw: unknown }[];
  readonly replies: Json[];
  settle(): Promise<void>;
}

async function application(): Promise<App> {
  const context = await NestFactory.createApplicationContext(SharedWorldModule, { logger: false });
  const pass = context.get(SharedSemanticPlaceService);
  const passes: App['passes'] = [];
  const pending: Promise<unknown>[] = [];
  // RECORD ONLY: the conversation service fires the pass and does not wait; the harness keeps its promise to await it.
  const weave = pass.weave.bind(pass);
  pass.weave = (request: SharedSemanticPassRequest) => {
    const entry: App['passes'][number] = { request, outcome: null };
    passes.push(entry);
    const running = weave(request).then((outcome) => { entry.outcome = outcome; return outcome; });
    pending.push(running);
    return running;
  };
  // RECORD ONLY: the reply's own outcome (the conversation service folds every refusal into UNAVAILABLE).
  const replyService = context.get(SharedQandeelReplyService);
  const replies: Json[] = [];
  const reply = replyService.reply.bind(replyService);
  replyService.reply = (async (request: Json) => {
    const outcome: Json = await reply(request).catch((error: Json) => ({ state: 'THREW', name: error?.name ?? 'Error' }));
    replies.push({ scenario: scenarioNow, outcome: { state: outcome?.state, reason: outcome?.reason ?? null } });
    if (outcome?.state === 'THREW') throw new Error('reply threw');
    return outcome;
  }) as typeof replyService.reply;
  // RECORD ONLY: a refusal of the reply's router, by its error class and bounded message (never content).
  const router = context.get<ModelRouter>(MODEL_ROUTER);
  const generate = router.generate.bind(router);
  router.generate = (async (request: Json) => {
    try { return await generate(request); } catch (error) {
      replies.push({ scenario: scenarioNow, routerError: { name: (error as Json)?.name ?? 'Error', message: String((error as Json)?.message ?? '').slice(0, 160) } });
      throw error;
    }
  }) as typeof router.generate;
  // RECORD ONLY: what the bound placer was given and answered (the pass decodes the answer itself).
  const placer = context.get(SHARED_SPATIAL_PLACER);
  const placements: App['placements'] = [];
  if (placer instanceof DeepSeekSharedSpatialPlacer) {
    const place = placer.place.bind(placer);
    placer.place = async (input: SharedSpatialPlacementInput, signal: AbortSignal) => {
      const entry: App['placements'][number] = { input, raw: undefined };
      placements.push(entry);
      entry.raw = await place(input, signal);
      return entry.raw;
    };
  }
  return {
    context, conversation: context.get(SharedWorldConversationService), field: context.get(SharedSemanticFieldService),
    lifecycle: context.get(SharedWorldLifecycleService), passes, placements, replies,
    async settle() { while (pending.length) await pending.shift(); },
  };
}

async function say(app: App, person: Person, worldId: string, text: string) {
  const passesBefore = app.passes.length;
  const sent = await app.conversation.send(person.userId, person.token, worldId, { commandId: randomUUID(), content: text });
  await app.settle();
  return { sent: sent as Json, pass: app.passes[passesBefore] ?? null };
}

async function rowsOf(api: LocalDataApi, sql: string, values: unknown[]): Promise<Json[]> {
  return (await api.owner.query(sql, values)).rows;
}
/** Every trace a place leaves for one World (0148 + 0175 relations), and the World's completed passes and grants. */
async function tracesOf(api: LocalDataApi, worldId: string) {
  const [counts] = await rowsOf(api, `SELECT
      (SELECT count(*) FROM shared_semantic_private.semantic_places WHERE world_id = $1)::int AS places,
      (SELECT count(*) FROM shared_semantic_private.semantic_place_attributions a JOIN shared_semantic_private.semantic_places p USING (material_id) WHERE p.world_id = $1)::int AS attributions,
      (SELECT count(*) FROM shared_semantic_private.semantic_place_people pp JOIN shared_semantic_private.semantic_places p USING (material_id) WHERE p.world_id = $1)::int AS people,
      (SELECT count(*) FROM public.shared_world_materials m WHERE m.world_id = $1 AND m.material_kind = 'QANDEEL_ANALYSIS')::int AS analysis_materials,
      (SELECT count(*) FROM shared_semantic_private.semantic_passes WHERE world_id = $1)::int AS completed_passes,
      (SELECT count(*) FROM shared_semantic_private.semantic_work_grants WHERE world_id = $1)::int AS grants,
      (SELECT count(*) FROM shared_semantic_private.semantic_work_leases WHERE world_id = $1)::int AS live_leases`, [worldId]);
  return counts;
}

/** The server's points for the pass's new meanings, recomputed from the placer's recorded answer by the same pure geometry. */
function expectedPoints(before: Json[], placement: App['placements'][number]) {
  const anchors = decodeSharedSpatialPlacement(placement.raw, placement.input);
  if (anchors === null) return null;
  const refByMeaning = new Map(placement.input.map.map((place) => [place.meaning, place.ref]));
  const occupied: ExistingFieldPlace[] = before.map((place, order) => ({
    ref: refByMeaning.get(place.meaning) ?? place.place_id, point: { x: BigInt(place.x), y: BigInt(place.y) }, region: place.region, order,
  }));
  const news = inMeaningOrder(placement.input.new.map((meaning) => ({ ref: meaning.ref, meaning: meaning.meaning, region: meaning.region })));
  const points = placeNewMeanings(occupied, news, anchors);
  return points === null ? null : new Map(news.map((meaning) => [meaning.meaning, points.get(meaning.ref)]));
}

// ------------------------------------------------------------------------------------------- A. the production path
async function scenarioA(api: LocalDataApi, app: App) {
  scenarioNow = 'A';
  check('the application binds the DeepSeek placer and a bound interpreter',
    app.context.get(SHARED_SPATIAL_PLACER) instanceof DeepSeekSharedSpatialPlacer && !(app.context.get(SHARED_SEMANTIC_INTERPRETER) instanceof UnconfiguredSharedSemanticInterpreter));
  const mona = await signUp(api, 'a-mona', 'منى');
  const ahmed = await signUp(api, 'a-ahmed', 'أحمد');
  const karim = await signUp(api, 'a-karim', 'كريم');
  const worldId = await worldOf(api, [mona, ahmed, karim]);
  const names = new Map([[mona.userId, 'mona'], [ahmed.userId, 'ahmed'], [karim.userId, 'karim']]);
  const out: Json = { worldId: 'A', messages: [] };

  const texts = [
    [mona, 'أنا مش بحب السفر بالطيارة خالص، نفسي الرحلة الجاية تبقى بالقطر'],
    [ahmed, 'وأنا شايف إن القطر أريح لينا كلنا في الرحلة دي'],
  ] as const;
  const placeIdOf = new Map<string, string>();
  for (const [index, [person, text]] of texts.entries()) {
    scenarioNow = `A${index + 1}`;
    const before = await placesOf(api, worldId);
    const crossed = crossings.length;
    const { sent, pass } = await say(app, person, worldId, text);
    const mine = crossings.slice(crossed);
    const readings = mine.filter((call) => call.family === 'SHARED_SEMANTIC_READING');
    const placementCalls = mine.filter((call) => call.family === 'SHARED_SPATIAL_PLACEMENT');
    const after = await placesOf(api, worldId);
    const added = after.filter((place) => !before.some((old) => old.place_id === place.place_id));
    check('the message is committed and its pass runs on it', sent.outcome === 'COMMITTED' && pass?.request.humanMaterialId === sent.materialId, { sent, qandeel: sent.qandeel });
    check('DeepSeek reads the meaning: one reading call', readings.length === 1, { readings: readings.length });
    const reading = readings[0] ? JSON.parse(readings[0].answer ?? 'null') : null;
    check('the reading answers a valid meaning held by the sender’s token', reading?.places?.length === 1 && same(reading.places[0].holders, [`S${index + 1}`]),
      { places: reading?.places });
    check('the meaning reaches the bound placer: one placement call for the pass', placementCalls.length === 1 && app.placements.length >= 1, { calls: placementCalls.length });
    const placement = app.placements.at(-1) as App['placements'][number];
    check('the placement request carries meanings only (no identity, no coordinate)', !UUID_ANYWHERE.test(placementCalls[0]?.body.messages.at(-1).content ?? '')
      && !/world_x|world_y|"x"|"y"/u.test(placementCalls[0]?.body.messages.at(-1).content ?? ''));
    if (index === 1) {
      const anchorsTo = (placement.raw as Json)?.placements?.[0]?.anchors ?? [];
      const firstRef = placement.input.map.find((place) => place.meaning === after.find((row) => row.place_id === placeIdOf.get('A1'))?.meaning)?.ref;
      check('the anchors follow the meaning: the second meaning is anchored to the first place', firstRef !== undefined && anchorsTo.some((anchor: Json) => anchor.to === firstRef), { anchorsTo, firstRef });
    }
    check('the pass is WOVEN with exactly one place', pass?.outcome?.state === 'WOVEN' && (pass.outcome as Json).placeIds.length === 1 && added.length === 1, { outcome: pass?.outcome });
    const saved = added[0];
    if (!saved) return out;
    placeIdOf.set(`A${index + 1}`, saved.place_id);
    const expected = expectedPoints(before, placement);
    const point = expected?.get(saved.meaning);
    check('the server computes the coordinates from the anchors (the pure geometry)', point !== undefined && point.x.toString() === saved.x && point.y.toString() === saved.y,
      { saved: [saved.x, saved.y], expected: point ? [point.x.toString(), point.y.toString()] : null });
    check('meaning, attribution and place are saved together in PostgreSQL', saved.meaning === reading.places[0].meaning && saved.nature === 'VIEW' && saved.standing === 'CURRENT'
      && same(saved.people, [{ role: 'HOLDER', user: person.userId }]) && saved.region === reading.places[0].lensKey,
      { meaning: saved.meaning, people: saved.people.map((p: Json) => [p.role, names.get(p.user)]), region: saved.region });
    const [sources] = await rowsOf(api, `SELECT array_agg(d.source_material_id::text) AS ids FROM public.shared_world_material_dependencies d WHERE d.target_material_id = $1 AND d.dependency_kind = 'MATERIAL_DEPENDENCY'`, [saved.place_id]);
    check('the place rests on the exact message as its source', same(sources?.ids, [sent.materialId]), { sources: sources?.ids ?? null });
    const ledger = (await ledgerOf(api, worldId)).filter((row) => row.message === sent.materialId);
    const ofFamily = (family: string) => ledger.filter((row) => row.family === family);
    check('AI-COST-01: the reading and the placement are each one accounted call, paid by the sender, on their message, in this World',
      ofFamily('SHARED_SEMANTIC_READING').length === 1 && ofFamily('SHARED_SPATIAL_PLACEMENT').length === 1
      && [...ofFamily('SHARED_SEMANTIC_READING'), ...ofFamily('SHARED_SPATIAL_PLACEMENT')].every((row) => row.payer === person.userId && row.attempt === 1 && /^SUCCEEDED/u.test(row.state)),
      ledger.map((row) => ({ family: row.family, state: row.state, attempt: row.attempt, payerIsSender: row.payer === person.userId, completeness: row.completeness })));
    check('every DeepSeek call of this message has exactly one ledger row (none unaccounted)', ledger.length === mine.length, { ledger: ledger.length, calls: mine.length, families: mine.map((call) => call.family) });
    out.messages.push({ by: names.get(person.userId), text, qandeel: sent.qandeel, outcome: pass?.outcome, reading: reading?.places, placementAnswer: placement.raw, saved: { meaning: saved.meaning, x: saved.x, y: saved.y, region: saved.region }, calls: mine.map((call) => call.family) });
  }

  scenarioNow = 'A-display';
  for (const viewer of [mona, ahmed, karim]) {
    const view = await app.field.field(viewer.token, worldId) as Json;
    const rows = await placesOf(api, worldId);
    const shown = view.outcome === 'ALLOW' ? view.places : [];
    const ok = shown.length === rows.length && rows.every((row) => {
      const served = shown.find((place: Json) => place.placeId === row.place_id);
      return served && served.x === row.x && served.y === row.y && served.meaning !== row.meaning && served.meaning.includes(row.meaning);
    });
    check(`the approved display route serves every place to ${names.get(viewer.userId)}, at its point, in the composed safe frame`, ok, shown.map((place: Json) => ({ meaning: place.meaning, x: place.x, y: place.y })));
  }
  const first = placeIdOf.get('A1') as string;
  const detail = await app.field.place(ahmed.token, worldId, first) as Json;
  check('the place panel serves its exact source', detail.outcome === 'ALLOW' && detail.place.sources.length === 1 && detail.place.sources[0].text === texts[0][1], { outcome: detail.outcome });
  out.display = (await app.field.field(karim.token, worldId) as Json).places;

  scenarioNow = 'A-delete';
  const firstMessage = (out.messages[0] && app.passes.find((entry) => entry.outcome && (entry.outcome as Json).placeIds?.includes(first)))?.request.humanMaterialId as string;
  const deleted = await app.conversation.deleteMaterial(mona.token, worldId, firstMessage, { commandId: randomUUID() });
  const afterDelete = await placesOf(api, worldId);
  const viewAfter = await app.field.field(ahmed.token, worldId) as Json;
  check('deleting the source removes its place, attribution and people (the 0175 rule); the other place stays',
    deleted.outcome === 'DELETED' && !afterDelete.some((row) => row.place_id === first) && afterDelete.length === 1
    && viewAfter.outcome === 'ALLOW' && viewAfter.places.length === 1 && viewAfter.places[0].placeId === placeIdOf.get('A2'), { remaining: afterDelete.length });
  const [orphans] = await rowsOf(api, `SELECT (SELECT count(*) FROM shared_semantic_private.semantic_place_attributions WHERE material_id = $1)::int AS a,
      (SELECT count(*) FROM shared_semantic_private.semantic_place_people WHERE material_id = $1)::int AS p`, [first]);
  check('no attribution or people row outlives the deleted place', orphans.a === 0 && orphans.p === 0, orphans);
  check('the deleted place is ABSENT from the panel', ((await app.field.place(ahmed.token, worldId, first)) as Json).outcome === 'ABSENT');

  scenarioNow = 'A-leave';
  const left = await app.lifecycle.leave(karim.token, worldId, { commandId: randomUUID() });
  const karimView = await app.field.field(karim.token, worldId).catch((error: Json) => ({ outcome: `THROWN:${error?.name}` })) as Json;
  check('a member who left loses access to the field (UNAVAILABLE)', left.outcome === 'LEFT' && karimView.outcome === 'UNAVAILABLE', { left: left.outcome, view: karimView.outcome });
  check('the members who remain still see the remaining place', ((await app.field.field(mona.token, worldId)) as Json).places?.length === 1);

  scenarioNow = 'A-outsider';
  const xavier = await signUp(api, 'a-xavier', 'زافيير');
  const ledgerBefore = (await ledgerOf(api, worldId)).length;
  const crossedBefore = crossings.length;
  const outsiderSend = await app.conversation.send(xavier.userId, xavier.token, worldId, { commandId: randomUUID(), content: 'رسالة من خارج العالم' }).catch((error: Json) => ({ outcome: `THROWN:${error?.name}` })) as Json;
  await app.settle();
  const outsiderField = await app.field.field(xavier.token, worldId) as Json;
  check('an outsider can neither write nor read: no pass, no provider call, no ledger row', outsiderSend.outcome === 'UNAVAILABLE' && outsiderField.outcome === 'UNAVAILABLE'
    && crossings.length === crossedBefore && (await ledgerOf(api, worldId)).length === ledgerBefore, { send: outsiderSend.outcome, field: outsiderField.outcome });
  return out;
}

// ------------------------------------------------------------------------------------------- B. privacy before the save
async function scenarioB(api: LocalDataApi, app: App) {
  scenarioNow = 'B';
  const sara = await signUp(api, 'b-sara', 'سارة');
  const yousef = await signUp(api, 'b-yousef', 'يوسف');
  const worldId = await worldOf(api, [sara, yousef]);
  const early = ['سارة شايفة إن الميزانية لازم تتقسم بالتساوي', 'يوسف مش موافق وشايف إن كل واحد يدفع اللي يقدر عليه'];
  await say(app, sara, worldId, early[0]);
  await say(app, yousef, worldId, early[1]);
  const earlyPlaces = await placesOf(api, worldId);
  const laila = await signUp(api, 'b-laila', 'ليلى');
  await addMember(api, worldId, laila, [sara, yousef]);
  const crossed = crossings.length;
  const { pass } = await say(app, laila, worldId, 'أنا ليلى، لسه منضمة، إيه الخطة؟');
  const mine = crossings.slice(crossed);
  const bodies = mine.filter((call) => call.family !== 'OTHER').map((call) => String(call.body.messages.at(-1).content));
  check('two places were saved before the newcomer joined', earlyPlaces.length === 2, { places: earlyPlaces.length });
  check('the newcomer’s pass reads only what EVERY current recipient may see: no earlier word or meaning reaches DeepSeek',
    pass?.outcome?.state === 'WOVEN' && bodies.length >= 1 && bodies.every((body) => early.every((text) => !body.includes(text.slice(0, 20)))
      && earlyPlaces.every((place) => !body.includes(place.meaning.slice(0, 20)))), { outcome: pass?.outcome, families: mine.map((call) => call.family) });
  const lailaField = await app.field.field(laila.token, worldId) as Json;
  const saraField = await app.field.field(sara.token, worldId) as Json;
  check('the newcomer is served only the place of what they may see', lailaField.outcome === 'ALLOW' && lailaField.places.length === 1, { places: lailaField.places?.length });
  check('the earlier members still see every place whose sources they may see', saraField.outcome === 'ALLOW' && saraField.places.length === 3, { places: saraField.places?.length });
}

// ------------------------------------------------------------------------------------------- C. refusals (simulated only)
async function refusal(api: LocalDataApi, app: App, id: string, planned: { family: Family; fault: Fault }[], expected: SharedSemanticPassOutcome, opts: { placementCalls: number }) {
  scenarioNow = `C-${id}`;
  const one = await signUp(api, `c${checks.length}a`, 'هالة');
  const two = await signUp(api, `c${checks.length}b`, 'سامي');
  const worldId = await worldOf(api, [one, two]);
  faults.splice(0, faults.length, ...planned);
  const crossed = crossings.length;
  const started = Date.now();
  const { sent, pass } = await say(app, one, worldId, 'هالة شايفة إن المعاد الأنسب يوم الجمعة');
  const ms = Date.now() - started;
  const mine = crossings.slice(crossed);
  const traces = await tracesOf(api, worldId);
  const ledger = (await ledgerOf(api, worldId)).filter((row) => row.message === sent.materialId);
  const semantic = ledger.filter((row) => row.family === 'SHARED_SEMANTIC_READING' || row.family === 'SHARED_SPATIAL_PLACEMENT');
  check(`the pass answers ${JSON.stringify(expected)}`, same(pass?.outcome, expected), { outcome: pass?.outcome, ms });
  check('the human message stays committed', sent.outcome === 'COMMITTED');
  // A pass that found nothing new is a completed pass (recorded once, so it never runs again); a refused one is not.
  const completed = expected.state === 'WOVEN' ? 1 : 0;
  check(`nothing is written: no place, attribution, people or analysis material; ${completed} completed pass; the lease is returned`,
    traces.places === 0 && traces.attributions === 0 && traces.people === 0 && traces.analysis_materials === 0 && traces.completed_passes === completed && traces.live_leases === 0, traces);
  check(`placement calls: ${opts.placementCalls}`, mine.filter((call) => call.family === 'SHARED_SPATIAL_PLACEMENT').length === opts.placementCalls);
  check('every call made has its one ledger row, paid by the sender; no retry; a failed call is not reported as used',
    semantic.length === mine.filter((call) => call.family === 'SHARED_SEMANTIC_READING' || call.family === 'SHARED_SPATIAL_PLACEMENT').length
    && semantic.every((row) => row.payer === one.userId && row.attempt === 1)
    && semantic.filter((row) => /^FAILED/u.test(row.state)).every((row) => row.completeness === 'ABSENT'),
    semantic.map((row) => ({ family: row.family, state: row.state, completeness: row.completeness, attempt: row.attempt })));
  check('every planned fault was consumed', faults.length === 0, { left: [...faults] });
  faults.splice(0, faults.length);
}

// ------------------------------------------------------------------------------------------- D. outside SYNTHETIC_ONLY
async function scenarioD(api: LocalDataApi) {
  scenarioNow = 'D';
  const saved = process.env.DEEPSEEK_QUALIFICATION_MODE;
  delete process.env.DEEPSEEK_QUALIFICATION_MODE;
  let app: App | null = null;
  try {
    app = await application();
    check('outside SYNTHETIC_ONLY the application composes the refusing placer', app.context.get(SHARED_SPATIAL_PLACER) instanceof UnconfiguredSharedSpatialPlacer);
    const one = await signUp(api, 'd-1', 'نور');
    const two = await signUp(api, 'd-2', 'عمر');
    const worldId = await worldOf(api, [one, two]);
    const crossed = crossings.length;
    const { sent, pass } = await say(app, one, worldId, 'نور عايزة نأجل الاجتماع للأسبوع الجاي');
    const traces = await tracesOf(api, worldId);
    check('the pass returns NO_PROVIDER: no lease, no read, no grant', same(pass?.outcome, { state: 'NOT_RUN', reason: 'NO_PROVIDER' }) && traces.grants === 0 && traces.places === 0, { outcome: pass?.outcome, traces });
    check('no request reaches DeepSeek, and no ledger row is written', crossings.length === crossed && (await ledgerOf(api, worldId)).length === 0, { calls: crossings.length - crossed });
    check('the human message stays committed and the reply is refused safely', sent.outcome === 'COMMITTED' && sent.qandeel !== 'COMMITTED', { qandeel: sent.qandeel });
  } finally {
    if (saved === undefined) delete process.env.DEEPSEEK_QUALIFICATION_MODE; else process.env.DEEPSEEK_QUALIFICATION_MODE = saved;
    await app?.context.close();
  }
}

// ------------------------------------------------------------------------------------------- main
async function main() {
  process.env.MODEL_PROVIDER = 'deepseek';
  const api = await openLocalDataApi(process.env);
  installDeepSeekObserver();
  const results: Json = { mode: LIVE ? 'live' : 'simulated', head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, startedAt: new Date().toISOString() };
  let app: App | null = null;
  try {
    await enableSharedConversation(api);
    app = await application();
    results.A = await scenarioA(api, app);
    results.replies = app.replies;
    if (!LIVE) {
      await scenarioB(api, app);
      await refusal(api, app, 'empty', [{ family: 'SHARED_SEMANTIC_READING', fault: 'EMPTY' }], { state: 'WOVEN', placeIds: [] }, { placementCalls: 0 });
      await refusal(api, app, 'reading-500', [{ family: 'SHARED_SEMANTIC_READING', fault: 'HTTP500' }], { state: 'REFUSED', reason: 'READING_UNAVAILABLE' }, { placementCalls: 0 });
      await refusal(api, app, 'reading-timeout', [{ family: 'SHARED_SEMANTIC_READING', fault: 'HANG' }], { state: 'REFUSED', reason: 'READING_UNAVAILABLE' }, { placementCalls: 0 });
      await refusal(api, app, 'attribution', [{ family: 'SHARED_SEMANTIC_READING', fault: 'BAD_ATTRIBUTION' }], { state: 'REFUSED', reason: 'READING_UNAVAILABLE' }, { placementCalls: 0 });
      await refusal(api, app, 'placement-500', [{ family: 'SHARED_SPATIAL_PLACEMENT', fault: 'HTTP500' }], { state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' }, { placementCalls: 1 });
      await refusal(api, app, 'placement-timeout', [{ family: 'SHARED_SPATIAL_PLACEMENT', fault: 'HANG' }], { state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' }, { placementCalls: 1 });
      await refusal(api, app, 'no-anchor', [{ family: 'SHARED_SPATIAL_PLACEMENT', fault: 'NO_ANCHOR' }], { state: 'REFUSED', reason: 'PLACEMENT_UNAVAILABLE' }, { placementCalls: 1 });
      await app.context.close();
      app = null;
      await scenarioD(api);
    }
  } finally {
    await app?.context.close();
    results.finishedAt = new Date().toISOString();
    results.checks = checks;
    results.passed = checks.filter((entry) => entry.pass).length;
    results.failed = checks.filter((entry) => !entry.pass).length;
    results.calls = crossings.map((call) => ({ scenario: call.scenario, family: call.family, fault: call.fault, status: call.status, ms: call.ms }));
    results.dataApiCalls = Object.fromEntries(api.calls);
    mkdirSync(dirname(RESULTS), { recursive: true });
    writeFileSync(RESULTS, `${JSON.stringify(results, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}\n`);
    await api.close();
  }
  console.log(`[cp2-binding] ${results.passed} passed, ${results.failed} failed; ${crossings.length} DeepSeek requests; results: ${RESULTS}`);
  process.exit(results.failed === 0 && results.passed > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[cp2-binding] NOT COMPLETED: ${(error as Json)?.message ?? error}`);
  process.exit(1);
});
