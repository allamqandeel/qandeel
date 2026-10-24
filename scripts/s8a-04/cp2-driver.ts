// S8A-04 CP2 — the paid stages of the Shared Social Memory Controlled Amendment §11 (guard round 19: 80 calls, USD 0.08 at
// peak, a ceiling and not a target; synthetic data only; no automatic retry). Operator-only: never a CI step, never imported
// by production code. Launched only by cp2-launch.mjs under scripts/s8a-02/network-guard.cjs.
//
// What runs is the PRODUCTION composition, unchanged: the Shared conversation service, the reply service and its frozen
// I-03 chain (the resolvers, the readiness boundary, the revalidator, the commit binder), the semantic pass, the reply
// generator with the World's knowledge, the DeepSeek reading / recall / placer / Model Router compositions and the ONE
// AI-COST-01 accounting boundary (the Shared begin, §5). The only harness parts are:
//   * the in-process Data API (cp2-local-data-api.ts) that answers the services' Data API calls over the disposable
//     database migrated through 0175 — the real functions, roles and grants;
//   * the fixtures that make people and Worlds through the frozen commands (cp2-worlds.ts);
//   * DECLARED TEST SHORTCUTS, each named where it is used: positions seeded by a deterministic seed reader through the real
//     pass and write path (stages 2 and R: the reading is not what they test), filler messages committed through the
//     member's own send command with no reply or reading (stage 3), commit times moved into the past (stages R and 3), the
//     World's pass budget cleared before each seed pass (stage R; the probes run under the real budget), and no pass after
//     the probe replies of stage R (each probe is answered before it has a place);
//   * spies at the ports (reader, recaller, placer, generator) that record what crossed them, and a stage ceiling on top of
//     the guard: each stage's calls exactly, and its USD by the guard's own reservation rule.
// Nothing is logged but bounded outcomes; the results file holds the synthetic texts and what the services returned.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { productionAiProviderCallAccounting } from '../../apps/api/src/ai-usage/production-ai-provider-call-accounting';
import { SharedHumanAudienceResolverService } from '../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service';
import { StandingContextGrantResolverService } from '../../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../../apps/api/src/connected-worlds/delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../../apps/api/src/connected-worlds/effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService } from '../../apps/api/src/connected-worlds/effective-context/shared-pre-model-world-state-resolver.service';
import { SharedQandeelReplyService } from '../../apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.service';
import type { SharedQandeelReplyGenerator, SharedReplyGenerationInput } from '../../apps/api/src/connected-worlds/material-commit/shared-qandeel-reply.types';
import { SharedSemanticPlaceService, type SharedSemanticPassRequest } from '../../apps/api/src/connected-worlds/material-commit/shared-semantic-place.service';
import { UnimplementedPrivateSourceState, UnimplementedSourceDisclosureDetector } from '../../apps/api/src/connected-worlds/material-commit/shared-unavailable-private-context-boundaries';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../../apps/api/src/connected-worlds/source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SharedSourceDisclosureGateService } from '../../apps/api/src/connected-worlds/source-disclosure/shared-source-disclosure-gate.service';
import { SafetyResponseGateService } from '../../apps/api/src/conversation/safety-response-gate.service';
import { SupabaseDataApiService } from '../../apps/api/src/conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../../apps/api/src/conversation/supabase-service-role-api.service';
import { DeepSeekModelRouter } from '../../apps/api/src/model-router/providers/deepseek/deepseek-model-router';
import { correlation } from '../../apps/api/src/observability/shared-correlation';
import { TelemetryService } from '../../apps/api/src/observability/telemetry.service';
import { SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-knowledge-recall';
import { SHARED_SEMANTIC_READING_INSTRUCTIONS_V2 } from '../../apps/api/src/shared-world/deepseek-shared-semantic-interpreter';
import { SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS } from '../../apps/api/src/shared-world/deepseek-shared-spatial-placer';
import { SharedConversationReplyGenerator } from '../../apps/api/src/shared-world/shared-conversation-reply.generator';
import { decodeSharedKnowledgeRecall, type SharedKnowledgeRecallInput, type SharedKnowledgeRecaller } from '../../apps/api/src/shared-world/shared-knowledge-recall';
import { decodeSharedSemanticReading, type SharedSemanticInput, type SharedSemanticInterpreter } from '../../apps/api/src/shared-world/shared-semantic-interpreter';
import { createConfiguredSharedSemanticInterpreter } from '../../apps/api/src/shared-world/shared-semantic-interpreter-provider';
import { createConfiguredSharedKnowledgeRecaller, createQualificationSharedSpatialPlacer } from '../../apps/api/src/shared-world/shared-social-memory-provider';
import { FakeSharedSpatialPlacer, decodeSharedSpatialPlacement, type SharedSpatialPlacementInput, type SharedSpatialPlacer } from '../../apps/api/src/shared-world/shared-spatial-placer';
import { SharedWorldConversationRepository } from '../../apps/api/src/shared-world/shared-world-conversation.repository';
import { SharedWorldConversationService } from '../../apps/api/src/shared-world/shared-world-conversation.service';
import { SharedWorldRepository } from '../../apps/api/src/shared-world/shared-world.repository';
import {
  SHARED_KNOWLEDGE_RECALL_BYTES, decodeSharedWorldKnowledge, recallEntry, sharedKnowledgeEntries, sharedRecallIndex,
} from '../../apps/api/src/shared-world/shared-world-knowledge';
import { openLocalDataApi, type LocalDataApi } from './cp2-local-data-api';
import { addMember, backdatePlaces, clearPassBudget, enableSharedConversation, ledgerOf, placesOf, signUp, worldOf, type Person } from './cp2-worlds';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
class StopError extends Error {}

const ROUND = 19;
const MAX_ATTEMPTS = 80;
const COST_CAP_USD = 0.08;
/** Amendment §11: each stage's own ceiling; together they are the round's. */
const STAGES = {
  reading: { calls: 14, usd: 0.010 }, placement: { calls: 10, usd: 0.006 }, recall: { calls: 24, usd: 0.035 }, integrated: { calls: 32, usd: 0.029 },
} as const;
type StageName = keyof typeof STAGES;
const PROVIDER_FAILURES_STOP = 2;
const DAY = 86_400_000;
const TOKEN_WORD = /(?<![\p{L}\p{N}])S[1-9][0-9]*(?![\p{L}\p{N}])/u;
const NUMBERED = /\([1-9][0-9]*\)/u;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StopError(`${name} is required`);
  return value;
}

// ------------------------------------------------------------------------------------------- calls, ceilings, spies
interface CallRecord { readonly stage: string; readonly step: string; readonly family: string; attempt: Json | null; refused: string | null; ms: number | null }
const callLog: CallRecord[] = [];
let stageNow: StageName | null = null;
let stepNow = 'setup';
/** What the running stage has gathered so far (the same arrays it returns), so a stopped or failed stage still keeps its evidence. */
let partial: Json = null;
let dryRun = false;
/** A dry run proves the guard refuses the first model call; it stops right after it. */
function dryStop(): void {
  if (dryRun && callLog.length > 0) throw new StopError('dry run: the guard refused the first call, as required');
}
const ATTRIBUTION_READING_MARK = 'You read a group conversation for the server. You do not reply to anyone.';

function familyOf(body: Json): string {
  const system = String(body?.messages?.[0]?.content ?? '');
  if (system.startsWith(SHARED_SEMANTIC_READING_INSTRUCTIONS_V2.slice(0, 80))) return 'SHARED_SEMANTIC_READING';
  if (system.startsWith(SHARED_KNOWLEDGE_RECALL_INSTRUCTIONS.slice(0, 80))) return 'SHARED_KNOWLEDGE_RECALL';
  if (system.startsWith(SHARED_SPATIAL_PLACEMENT_INSTRUCTIONS.slice(0, 80))) return 'SHARED_SPATIAL_PLACEMENT';
  if (system.includes(ATTRIBUTION_READING_MARK)) return 'ATTRIBUTION_READING';
  return 'CONVERSATION_REPLY';
}

/** The stage ceiling, ON TOP of the guard: refused here before the guard (and before any byte leaves the process). */
function installStageCeiling(guard: Json): void {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: Json, init?: Json) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url !== 'https://api.deepseek.com/chat/completions') return inner(input, init);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const record: CallRecord = { stage: stageNow ?? 'none', step: stepNow, family: familyOf(body), attempt: null, refused: null, ms: null };
    callLog.push(record);
    const refuse = (why: string) => { record.refused = why; const error = new Error(`S8A_02_NETWORK_FORBIDDEN:${why}`) as Json; error.code = 'S8A_02_NETWORK_FORBIDDEN'; throw error; };
    if (stageNow === null) refuse('cp2-no-stage');
    const ceiling = STAGES[stageNow as StageName];
    const mine = callLog.filter((call) => call.stage === stageNow && call.attempt !== null);
    if (mine.length >= ceiling.calls) refuse('cp2-stage-call-ceiling');
    const worst = (Buffer.byteLength(String(init.body)) * guard.peakRates.cacheMiss + Number(body.max_tokens) * guard.peakRates.output) / 1e6;
    const settled = mine.reduce((sum, call) => sum + (call.attempt.settled ? call.attempt.peakUsd : call.attempt.worstCaseUsd), 0);
    if (settled + worst > ceiling.usd) refuse('cp2-stage-cost-ceiling');
    const before = guard.spend.attempts.length;
    const started = Date.now();
    const pending = inner(input, init);
    // The guard counts and reserves the attempt synchronously, before its first await: this is that attempt.
    if (guard.spend.attempts.length > before) record.attempt = guard.spend.attempts[guard.spend.attempts.length - 1];
    try { return await pending; } finally { record.ms = Date.now() - started; }
  }) as typeof fetch;
}

const stageCalls = (stage: StageName) => callLog.filter((call) => call.stage === stage && call.attempt !== null);
const stageSpend = (stage: StageName) => {
  const calls = stageCalls(stage);
  return {
    calls: calls.length, refusedByCeiling: callLog.filter((call) => call.stage === stage && call.refused !== null).map((call) => call.refused),
    peakUsd: calls.reduce((sum, call) => sum + (call.attempt.peakUsd ?? call.attempt.worstCaseUsd), 0),
    applicableUsd: calls.reduce((sum, call) => sum + (call.attempt.applicableUsd ?? call.attempt.worstCaseUsd), 0),
    byFamily: Object.fromEntries([...new Set(calls.map((call) => call.family))].map((family) => {
      const of = calls.filter((call) => call.family === family);
      return [family, { calls: of.length, peakUsd: of.reduce((sum, call) => sum + (call.attempt.peakUsd ?? 0), 0),
        usage: of.map((call) => call.attempt.usage ?? null), ms: of.map((call) => call.ms) }];
    })),
  };
};
const stepCalls = (step: string) => callLog.filter((call) => call.step === step).map((call) => ({ family: call.family, refused: call.refused, ms: call.ms,
  usage: call.attempt?.usage ?? null, peakUsd: call.attempt?.peakUsd ?? null }));

// ------------------------------------------------------------------------------------------- the production composition
interface Seeded { readonly sources: ReadonlyArray<string>; readonly meaning: string; readonly region: string; readonly nature: 'VIEW' | 'CLAIM'; readonly hedged: boolean;
  readonly absentHolder?: string; readonly relayer?: string; readonly revises?: string }

/**
 * DECLARED TEST SHORTCUT — the seed reader: it answers a pass with the positions the harness planned, cited from the
 * contributions whose words they name, held by those contributions' writers (or by an absent holder, relayed by the writer).
 * Its answer goes through the production decoder, the identity mapping and the atomic write exactly as a model's would.
 */
class SeedReader implements SharedSemanticInterpreter {
  plan: ReadonlyArray<Seeded> = [];
  async read(input: SharedSemanticInput): Promise<unknown> {
    const refOf = (text: string) => [...input.contributions].reverse().find((contribution) => contribution.text === text);
    return {
      places: this.plan.map((seed) => {
        const cited = seed.sources.map((text) => { const found = refOf(text); if (!found) throw new Error('seed source not in the reading'); return found; });
        const writers = [...new Set(cited.map((contribution) => contribution.from))];
        const revised = seed.revises === undefined ? undefined : input.existing.find((existing) => existing.meaning === seed.revises)?.ref;
        if (seed.revises !== undefined && revised === undefined) throw new Error('the revised position is not among the existing');
        return {
          meaning: seed.meaning, primaryThemes: [seed.region], secondaryThemes: [], sourceRefs: cited.map((contribution) => contribution.ref), lensKey: seed.region,
          nature: seed.nature, holders: seed.absentHolder === undefined ? writers : [], relayedBy: seed.absentHolder === undefined ? [] : writers, about: [], hedged: seed.hedged,
          ...(seed.absentHolder === undefined ? {} : { absentHolder: seed.absentHolder }), ...(revised === undefined ? {} : { revises: revised }),
        };
      }),
    };
  }
}

interface Ports {
  reader: 'seed' | 'real';
  placer: 'fake' | 'real';
  pass: 'run' | 'skip';
}

function compose(api: LocalDataApi) {
  const seed = new SeedReader();
  const realReader = createConfiguredSharedSemanticInterpreter(process.env);
  const realPlacer = createQualificationSharedSpatialPlacer(process.env, productionAiProviderCallAccounting());
  const fakePlacer = new FakeSharedSpatialPlacer();
  const ports: Ports = { reader: 'seed', placer: 'fake', pass: 'run' };
  const seen = { readings: [] as Json[], placements: [] as Json[], recalls: [] as Json[], replies: [] as Json[], passes: [] as Json[] };
  const reader: SharedSemanticInterpreter = {
    async read(input, signal) {
      const record: Json = { step: stepNow, by: ports.reader, input, raw: undefined, error: null };
      seen.readings.push(record);
      try { record.raw = await (ports.reader === 'seed' ? seed : realReader).read(input, signal); return record.raw; } catch (error) {
        record.error = (error as Json)?.reason ?? (error as Json)?.code ?? (error as Json)?.name ?? 'Error'; throw error;
      }
    },
  };
  const placer: SharedSpatialPlacer = {
    async place(input: SharedSpatialPlacementInput, signal: AbortSignal) {
      const record: Json = { step: stepNow, by: ports.placer, input, raw: undefined, error: null };
      seen.placements.push(record);
      try { record.raw = await (ports.placer === 'fake' ? fakePlacer : realPlacer).place(input, signal); return record.raw; } catch (error) {
        record.error = (error as Json)?.reason ?? (error as Json)?.code ?? (error as Json)?.name ?? 'Error'; throw error;
      }
    },
  };
  const productionRecaller = createConfiguredSharedKnowledgeRecaller(process.env);
  const recaller: SharedKnowledgeRecaller = {
    async recall(input: SharedKnowledgeRecallInput, signal: AbortSignal) {
      const started = Date.now();
      const record: Json = { step: stepNow, offered: input.knowledge.length, bytes: Buffer.byteLength(JSON.stringify(input.knowledge)), input, raw: undefined, error: null, ms: null };
      seen.recalls.push(record);
      try { record.raw = await productionRecaller.recall(input, signal); return record.raw; } catch (error) {
        record.error = (error as Json)?.reason ?? (error as Json)?.code ?? (error as Json)?.name ?? 'Error'; throw error;
      } finally { record.ms = Date.now() - started; }
    },
  };
  const telemetry = new TelemetryService(correlation);
  const router = DeepSeekModelRouter.fromEnvironment(telemetry, productionAiProviderCallAccounting());
  const productionGenerator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService(), recaller);
  const generator: SharedQandeelReplyGenerator = {
    async generate(input: SharedReplyGenerationInput) {
      const started = Date.now();
      const record: Json = { step: stepNow, knowledge: input.knowledge ?? [], window: input.conversation.length, result: undefined, ms: null };
      seen.replies.push(record);
      try { record.result = await productionGenerator.generate(input); return record.result; } finally { record.ms = Date.now() - started; }
    },
  };
  // The frozen chain, exactly as SHARED_QANDEEL_REPLY_PROVIDERS composes it (the two unimplemented private-context
  // boundaries are bound fail-closed there too).
  const worldState = new SharedPreModelWorldStateResolverService();
  const audience = new SharedHumanAudienceResolverService();
  const grants = new StandingContextGrantResolverService();
  const effective = new SharedEffectiveContextService(worldState, audience, grants);
  const revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, grants, new UnimplementedPrivateSourceState());
  const readiness = new SharedPrivacyAuthorityDeliveryReadinessService(new SharedSourceDisclosureGateService(new UnimplementedSourceDisclosureDetector()), revalidator);
  const server = new SupabaseServiceRoleApiService();
  const replies = new SharedQandeelReplyService(effective, readiness, revalidator, audience, server, generator);
  const pass = new SharedSemanticPlaceService(effective, readiness, revalidator, audience, server, reader, placer);
  const dataApi = new SupabaseDataApiService();
  const repository = new SharedWorldConversationRepository(dataApi);
  // The conversation service's pass: run (awaited by the harness), or — stage R's declared shortcut — not run.
  const pending: Promise<unknown>[] = [];
  const passPort = {
    weave(request: SharedSemanticPassRequest) {
      const record: Json = { step: stepNow, request: { recalledPlaceIds: request.recalledPlaceIds ?? [] }, outcome: ports.pass === 'skip' ? 'SKIPPED_BY_HARNESS' : undefined };
      seen.passes.push(record);
      if (ports.pass === 'skip') return Promise.resolve({ state: 'NOT_RUN', reason: 'DONE' });
      const running = pass.weave(request).then((outcome) => { record.outcome = outcome; return outcome; });
      pending.push(running);
      return running;
    },
  } as unknown as SharedSemanticPlaceService;
  const conversation = new SharedWorldConversationService(new SharedWorldRepository(dataApi), repository, replies, passPort);
  const settle = async () => { while (pending.length) await pending.shift(); };

  /** A member's message committed through their own send command (no reply, no reading). */
  async function commit(person: Person, worldId: string, text: string) {
    const commandId = randomUUID();
    const [sent] = await repository.sendText(person.token, commandId, worldId, text);
    if (sent?.outcome !== 'COMMITTED' || typeof sent.material_id !== 'string') throw new Error(`the message was not committed: ${sent?.outcome}`);
    return { commandId, materialId: sent.material_id as string, by: person, text };
  }
  /** The pass on one committed message, as the conversation service runs it, with its sender's own read for the Names. */
  async function weave(sent: { commandId: string; materialId: string; by: Person }, worldId: string, recalledPlaceIds: string[] = []) {
    const view = await (conversation as Json).requesterView(sent.by.token, worldId) as Array<{ materialId: string; authorName: string | null }> | null;
    const request: SharedSemanticPassRequest = { worldId, humanCommandId: sent.commandId, humanMaterialId: sent.materialId, requesterUserId: sent.by.userId,
      authorNames: (view ?? []).map((material) => ({ materialId: material.materialId, authorName: material.authorName })), recalledPlaceIds };
    const record: Json = { step: stepNow, request: { recalledPlaceIds }, outcome: undefined };
    seen.passes.push(record);
    record.outcome = await pass.weave(request);
    return record.outcome;
  }
  /** One human message through the PRODUCTION send: the reply, then (when `ports.pass` is run) the pass, awaited. */
  async function say(person: Person, worldId: string, text: string) {
    const replyIndex = seen.replies.length;
    const sent = await conversation.send(person.userId, person.token, worldId, { commandId: randomUUID(), content: text });
    await settle();
    return { sent, reply: seen.replies[replyIndex] ?? null };
  }
  async function deleteOwn(person: Person, worldId: string, materialId: string) {
    const [row] = await repository.deleteOwn(person.token, randomUUID(), worldId, materialId);
    if (row?.outcome !== 'DELETED') throw new Error(`the message was not deleted: ${row?.outcome}`);
  }
  /** What a member is shown of the World's field: the composed meanings (P1–P6), never the bare text. */
  async function fieldAs(person: Person, worldId: string): Promise<Json[]> {
    return dataApi.request<Json[]>(person.token, 'rpc/list_own_shared_semantic_field_v2', { method: 'POST', body: JSON.stringify({ p_world_id: worldId, p_locale: null }) });
  }
  async function knowledgeFor(worldId: string, viewer: Person) {
    return decodeSharedWorldKnowledge(await server.rpc<unknown>('list_shared_world_knowledge_v1', { p_world_id: worldId, p_viewer_user_id: viewer.userId }));
  }
  return { ports, seed, seen, commit, weave, say, deleteOwn, fieldAs, knowledgeFor, settle };
}
type Harness = ReturnType<typeof compose>;

/** A stored position as a rater reads it: its meaning and its people by Name (the owner's observation, never model input). */
function described(place: Json, names: ReadonlyMap<string, string>) {
  const named = (role: string) => place.people.filter((person: Json) => person.role === role).map((person: Json) => names.get(person.user) ?? '?');
  return { meaning: place.meaning, nature: place.nature, holders: named('HOLDER'), absentHolder: place.absent_holder_label, relayedBy: named('RELAYER'), about: named('ABOUT'),
    uncertain: place.hedged, standing: place.standing, revisesEarlier: place.earlier_place_id !== null, region: place.region, x: place.x, y: place.y };
}
/** A person as the blind raters see them: the Name, with the scenario key when another person here has the same Name. */
function raterName(person: Person, people: ReadonlyMap<string, Person>): string {
  return [...people.values()].filter((other) => other.name === person.name).length > 1 ? `${person.name} (${person.key})` : person.name;
}
const leaksLabel = (text: string) => TOKEN_WORD.test(text) || NUMBERED.test(text);

// ------------------------------------------------------------------------------------------- stage 1: reading V2
async function readingStage(api: LocalDataApi, h: Harness, data: Json, cp1: Json[]): Promise<Json> {
  const byId = new Map<string, Json>([...cp1, ...data.reading.added].map((scenario: Json) => [scenario.id, scenario]));
  const runs: string[] = [...data.reading.cp1, ...data.reading.added.map((scenario: Json) => scenario.id), ...data.reading.again];
  const items: Json[] = [];
  const failures: Record<string, number> = {};
  partial = { items, repeatedCaseFailures: failures };
  let structural = 0;
  let providerFailures = 0;
  for (const [index, id] of runs.entries()) {
    const scenario = byId.get(id);
    if (!scenario) throw new StopError(`unknown scenario ${id}`);
    stepNow = `reading:${index + 1}:${id}`;
    const people = new Map<string, Person>();
    for (const [key, name] of Object.entries(scenario.people)) people.set(key, await signUp(api, key, name as string));
    const worldId = await worldOf(api, [...people.values()]);
    // The raters' view only: a Name two people share is shown with each one's scenario key (the people keep the same Name).
    const names = new Map([...people.values()].map((person) => [person.userId, raterName(person, people)]));
    const sent: Json[] = [];
    // The CP1 scenario's existing meaning (S6), saved first through the seed reader: a claim of the writers it rests on.
    const seedAfter = scenario.existing.length ? Math.max(...scenario.existing.flatMap((meaning: Json) => meaning.sources)) : 0;
    for (const [position, [key, text]] of scenario.messages.entries()) {
      sent.push(await h.commit(people.get(key) as Person, worldId, text));
      if (position + 1 === seedAfter) {
        h.ports.reader = 'seed'; h.ports.placer = 'fake';
        h.seed.plan = scenario.existing.map((meaning: Json) => ({ sources: meaning.sources.map((ref: number) => scenario.messages[ref - 1][1]), meaning: meaning.meaning, region: 'plans', nature: 'CLAIM', hedged: false }));
        const seeded = await h.weave(sent[position], worldId);
        if (seeded?.state !== 'WOVEN') throw new StopError(`the existing meaning of ${id} was not saved: ${JSON.stringify(seeded)}`);
      }
    }
    h.ports.reader = 'real'; h.ports.placer = 'fake';
    const readIndex = h.seen.readings.length;
    const outcome = await h.weave(sent.at(-1), worldId);
    dryStop();
    const reading = h.seen.readings[readIndex] ?? null;
    const decoded = reading && reading.raw !== undefined ? decodeSharedSemanticReading(reading.raw, reading.input) : null;
    const stored = (await placesOf(api, worldId)).map((place) => described(place, names));
    const shown = (await h.fieldAs(people.values().next().value as Person, worldId)).map((row: Json) => row.meaning);
    const tokenStored = stored.some((place: Json) => leaksLabel(place.meaning) || (place.absentHolder !== null && leaksLabel(place.absentHolder)));
    const refusedStructurally = reading !== null && reading.error === null && decoded === null;
    if (refusedStructurally) structural += 1;
    if (reading?.error && reading.error !== 'S8A_02_NETWORK_FORBIDDEN') providerFailures += 1;
    // The objective halves of the two repeated cases (the raters judge the rest).
    let caseHolds: boolean | null = null;
    if (id === 'N3-absent-view-and-own-fact') caseHolds = stored.some((place: Json) => place.absentHolder !== null && place.relayedBy.includes('مراد'));
    if (id === 'V2-relayed-view') caseHolds = stored.some((place: Json) => place.holders.includes('رنا') && place.relayedBy.includes('سامي'));
    if (caseHolds === false) failures[id] = (failures[id] ?? 0) + 1;
    items.push({
      run: index + 1, scenario: id, outcome, failure: reading?.error ?? null, decoded: reading === null ? 'NOT_READ' : decoded === null ? 'REFUSED_BY_DECODER' : 'VALID',
      writers: reading?.input.writers ?? null, from: reading?.input.contributions.map((contribution: Json) => contribution.from) ?? null,
      raw: refusedStructurally ? reading.raw : undefined, stored, shown, tokenStored, caseHolds, calls: stepCalls(stepNow),
    });
    console.log(`[s8a-04 cp2] reading ${index + 1}/${runs.length} ${id}: ${outcome?.state}${outcome?.reason ? ` ${outcome.reason}` : ''}; ${stored.length} stored${tokenStored ? '; TOKEN STORED' : ''}${caseHolds === false ? '; CASE FAILED' : ''}`);
    if (tokenStored) throw new StopError(`a token or label was stored (${id})`);
    if (Object.values(failures).some((count) => count >= 2)) throw new StopError('N3 or the relayed view failed twice');
    if (structural > 3) throw new StopError(`${structural} of ${runs.length} readings refused structurally`);
    if (providerFailures >= PROVIDER_FAILURES_STOP) throw new StopError(`${providerFailures} provider failures: stopped (no retries)`);
  }
  return { items, structuralRefusals: structural, repeatedCaseFailures: failures };
}

// ------------------------------------------------------------------------------------------- stage 2: placement
async function placementStage(api: LocalDataApi, h: Harness, data: Json): Promise<Json> {
  const worlds: Json[] = [];
  partial = { worlds };
  for (const world of data.placement.worlds) {
    const people = new Map<string, Person>();
    for (const [key, name] of Object.entries(world.people)) people.set(key, await signUp(api, key, name as string));
    const worldId = await worldOf(api, [...people.values()]);
    const names = new Map([...people.values()].map((person) => [person.userId, person.name]));
    const batches: Json[] = [];
    for (const [index, batch] of world.batches.entries()) {
      stepNow = `placement:${world.id}:${index + 1}`;
      const sent: Json[] = [];
      for (const [key, text] of batch) sent.push(await h.commit(people.get(key) as Person, worldId, text));
      // DECLARED TEST SHORTCUT: the reading is the seed reader's (the meanings are the test data); the placer is DeepSeek.
      h.ports.reader = 'seed'; h.ports.placer = 'real';
      h.seed.plan = batch.map(([, text, meaning, region]: string[]) => ({ sources: [text], meaning, region, nature: 'VIEW', hedged: false }));
      const placeIndex = h.seen.placements.length;
      const outcome = await h.weave(sent.at(-1), worldId);
      dryStop();
      const placement = h.seen.placements[placeIndex] ?? null;
      const anchors = placement && placement.raw !== undefined ? decodeSharedSpatialPlacement(placement.raw, placement.input) : null;
      batches.push({ batch: index + 1, outcome, failure: placement?.error ?? null, decoded: placement === null ? 'NOT_CALLED' : anchors === null ? 'REFUSED_BY_DECODER' : 'VALID',
        input: placement?.input ?? null, anchors: anchors === null ? (placement?.raw ?? null) : Object.fromEntries(anchors), calls: stepCalls(stepNow) });
      console.log(`[s8a-04 cp2] placement ${world.id} batch ${index + 1}: ${outcome?.state}${outcome?.reason ? ` ${outcome.reason}` : ''}`);
      if (batches.filter((entry) => entry.failure && entry.failure !== 'S8A_02_NETWORK_FORBIDDEN').length >= PROVIDER_FAILURES_STOP) throw new StopError('two placement failures: stopped');
    }
    const places = (await placesOf(api, worldId)).map((place) => described(place, names));
    worlds.push({ world: world.id, batches, places, neighbours: neighbours(places) });
  }
  return { worlds };
}

/** For the raters: each place's two nearest and two farthest places on the map (exact integer distances). */
function neighbours(places: Json[]) {
  const point = (place: Json) => ({ x: BigInt(place.x), y: BigInt(place.y) });
  const distance = (a: Json, b: Json) => { const p = point(a); const q = point(b); const dx = p.x - q.x; const dy = p.y - q.y; return dx * dx + dy * dy; };
  return places.map((place) => {
    const others = places.filter((other) => other !== place).sort((a, b) => { const d = distance(place, a) - distance(place, b); return d < 0n ? -1 : d > 0n ? 1 : 0; });
    return { meaning: place.meaning, region: place.region, nearest: others.slice(0, 2).map((other) => other.meaning), farthest: others.slice(-2).map((other) => other.meaning) };
  });
}

// ------------------------------------------------------------------------------------------- stage R: recall among hundreds
async function recallStage(api: LocalDataApi, h: Harness, data: Json): Promise<Json> {
  const spec = data.recall;
  const people = new Map<string, Person>();
  for (const [key, name] of Object.entries(spec.people)) people.set(key, await signUp(api, key, name as string));
  const all = [...people.values()];
  const worldId = await worldOf(api, all);
  const names = new Map(all.map((person) => [person.userId, person.name]));
  const fill = (template: string, fragment: string) => template.replace('{f}', fragment);
  // The plan: every topic's fragments, each held by all three, in time order fragment by fragment (the oldest first); the
  // revisions after the 200th position and the revisions whose source is later deleted after the 220th.
  const keyOf = (topic: string, fragment: number, person: string) => `${topic}#${fragment}#${person}`;
  const plan: Array<{ key: string; person: string; text: string; seed: Seeded; revisesKey?: string }> = [];
  for (let fragment = 0; fragment < 4; fragment += 1) {
    for (const topic of spec.topics) {
      for (const person of Object.keys(spec.people)) {
        const stance = spec.stances[person];
        const words = topic.fragments[fragment];
        const text = fill(stance.text, words);
        plan.push({ key: keyOf(topic.key, fragment, person), person, text, seed: { sources: [text], meaning: fill(stance.meaning, words), region: topic.key, nature: stance.nature, hedged: stance.hedged } });
      }
    }
  }
  const topicOf = new Map(spec.topics.map((topic: Json) => [topic.key, topic]));
  const revision = (topic: string, fragment: number, tag: string) => {
    const words = (topicOf.get(topic) as Json).fragments[fragment];
    const earlier = plan.find((entry) => entry.key === keyOf(topic, fragment, 'karim')) as Json;
    const text = fill(spec.revision.text, words);
    return { key: `${keyOf(topic, fragment, 'karim')}#${tag}`, person: 'karim', text, seed: { sources: [text], meaning: fill(spec.revision.meaning, words), region: topic, nature: 'VIEW' as const, hedged: false, revises: earlier.seed.meaning }, revisesKey: earlier.key };
  };
  plan.splice(200, 0, ...spec.revised.map(([topic, fragment]: [string, number]) => revision(topic, fragment, 'revised')));
  plan.splice(220, 0, ...spec.deletedSuccessor.map(([topic, fragment]: [string, number]) => revision(topic, fragment, 'successor')));

  stepNow = 'recall:seed';
  h.ports.reader = 'seed'; h.ports.placer = 'fake';
  const placeOf = new Map<string, string>();
  const sentOf = new Map<string, Json>();
  for (const entry of plan) {
    const sent = await h.commit(people.get(entry.person) as Person, worldId, entry.text);
    sentOf.set(entry.key, sent);
    h.seed.plan = [entry.seed];
    // DECLARED TEST SHORTCUT: the World's pass budget is cleared before each seed pass (cp2-worlds.ts clearPassBudget).
    await clearPassBudget(api, worldId);
    const outcome = await h.weave(sent, worldId, entry.revisesKey ? [placeOf.get(entry.revisesKey) as string] : []);
    if (outcome?.state !== 'WOVEN' || outcome.placeIds.length !== 1) throw new StopError(`seeding stopped at ${entry.key}: ${JSON.stringify(outcome)}`);
    placeOf.set(entry.key, outcome.placeIds[0]);
  }
  // The deleted successors: Karim deletes the message his revision rests on; the earlier position stays SUPERSEDED.
  for (const [topic, fragment] of spec.deletedSuccessor) await h.deleteOwn(people.get('karim') as Person, worldId, sentOf.get(`${keyOf(topic, fragment, 'karim')}#successor`).materialId);
  // DECLARED TEST SHORTCUT: the positions' commit times spread over six months, oldest first, order kept.
  const now = Date.now();
  const span = spec.months * 30 * DAY;
  const seeded = await backdatePlaces(api, worldId, (index, total) => new Date(now - span + Math.floor((index * (span - 3 * DAY)) / Math.max(1, total - 1))));
  const stored = await placesOf(api, worldId);
  const standingOf = new Map(stored.map((place: Json) => [place.place_id, place.standing]));
  const meaningOfPlace = new Map(stored.map((place: Json) => [place.place_id, place.meaning]));

  // Free diagnostics: the knowledge as the reply composes it, and how much of it the 48 KB index can offer.
  const positions = await h.knowledgeFor(worldId, all[0]);
  const entries = sharedKnowledgeEntries(positions ?? [], new Map(all.map((person) => [person.userId, person.name])), new Set(all.map((person) => person.userId))).entries;
  const index = sharedRecallIndex(entries);
  const diagnostics = { stored: stored.length, seeded, knowledgeEntries: entries.length, indexed: index.length, indexBytes: Buffer.byteLength(JSON.stringify(index.map(recallEntry))),
    allBytes: Buffer.byteLength(JSON.stringify(entries.map(recallEntry))), indexBudget: SHARED_KNOWLEDGE_RECALL_BYTES,
    oldestIndexedSince: index[0]?.since ?? null, superseded: stored.filter((place: Json) => place.standing === 'SUPERSEDED').length };
  console.log(`[s8a-04 cp2] recall World: ${stored.length} positions stored (${diagnostics.superseded} superseded); the 48 KB index offers ${index.length} of ${entries.length} (oldest ${diagnostics.oldestIndexedSince})`);

  // The probes: each through the PRODUCTION send, answered before it has a place (the pass is not run: declared shortcut).
  h.ports.pass = 'skip';
  const probes: Json[] = [];
  partial = { diagnostics, probes };
  for (const probe of spec.probes) {
    stepNow = `recall:${probe.id}`;
    const [topic, fragment, holder] = probe.target;
    let targetKey = keyOf(topic, fragment, holder);
    if (probe.kind === 'revised') targetKey = `${targetKey}#revised`;
    const target = placeOf.get(targetKey) as string;
    const recallIndex = h.seen.recalls.length;
    const { sent, reply } = await h.say(people.get(probe.by) as Person, worldId, probe.text);
    dryStop();
    const recall = h.seen.recalls[recallIndex] ?? null;
    const given = (reply?.result?.knowledgeRefs ?? []).map((ref: string) => (reply.knowledge as Json[]).find((entry) => entry.ref === ref)).filter(Boolean);
    const offeredMeanings = recall ? recall.input.knowledge.map((entry: Json) => entry.meaning) : [];
    const targetMeaning = meaningOfPlace.get(target);
    const chosenRefs = recall && recall.raw !== undefined ? decodeSharedKnowledgeRecall(recall.raw, recall.input) : null;
    const chosenMeanings = (chosenRefs ?? []).map((ref) => recall.input.knowledge.find((entry: Json) => entry.ref === ref)?.meaning);
    // Binding: nothing SUPERSEDED offered as current — every entry given as current must be a CURRENT position.
    const currentMeanings = new Set(stored.filter((place: Json) => place.standing === 'CURRENT').map((place: Json) => place.meaning));
    const earlierAsCurrent = given.filter((entry: Json) => entry.current && !currentMeanings.has(entry.meaning)).map((entry: Json) => entry.meaning);
    const deletedUsed = given.filter((entry: Json) => !stored.some((place: Json) => place.meaning === entry.meaning)).map((entry: Json) => entry.meaning);
    probes.push({
      probe: probe.id, kind: probe.kind, by: spec.people[probe.by], text: probe.text, qandeel: sent?.qandeel ?? null, target: targetMeaning,
      targetStanding: standingOf.get(target), inIndex: offeredMeanings.includes(targetMeaning), chosen: chosenMeanings.includes(targetMeaning),
      given: given.some((entry: Json) => entry.meaning === targetMeaning), recall: recall ? { offered: recall.offered, bytes: recall.bytes, error: recall.error, ms: recall.ms, chosen: chosenMeanings } : null,
      reply: reply ? { text: reply.result?.text ?? null, state: reply.result?.state ?? null, ms: reply.ms, knowledge: given } : null,
      earlierAsCurrent, deletedUsed, calls: stepCalls(stepNow),
    });
    console.log(`[s8a-04 cp2] ${probe.id}: QANDEEL ${sent?.qandeel}; recall ${recall ? (recall.error ?? `${chosenMeanings.length} chosen`) : 'not called'}; target ${probes.at(-1).chosen ? 'FOUND' : 'not found'}${earlierAsCurrent.length || deletedUsed.length ? '; BINDING VIOLATION' : ''}`);
    if (earlierAsCurrent.length || deletedUsed.length) throw new StopError(`${probe.id}: a revised or deleted-successor position offered as current, or unauthorized knowledge used`);
  }
  h.ports.pass = 'run';
  const found = probes.filter((probe) => probe.chosen).length;
  // The Product Owner's split (2026-10-25): the probes whose target the 48 KB index offers measure the choice; the others
  // measure the system at the limit, never DeepSeek's quality.
  const split = (inIndex: boolean) => { const group = probes.filter((probe) => probe.inIndex === inIndex); return { found: group.filter((probe) => probe.chosen).length, of: group.length, probes: group.map((probe) => probe.probe) }; };
  return { diagnostics, probes, found, of: probes.length, inIndex: split(true), outsideIndex: split(false), ledger: await ledgerOf(api, worldId).then((rows) => rows.filter((row: Json) => row.family !== 'SHARED_SEMANTIC_READING')) };
}

// ------------------------------------------------------------------------------------------- stage 3: integrated
async function integratedStage(api: LocalDataApi, h: Harness, data: Json): Promise<Json> {
  const spec = data.integrated;
  const worlds: Json[] = [];
  partial = { worlds };
  for (const world of spec.worlds) {
    const people = new Map<string, Person>();
    for (const [key, name] of Object.entries(world.people)) people.set(key, await signUp(api, key, name as string));
    const joining = new Set(world.steps.filter((step: Json) => step.join).map((step: Json) => step.join));
    const members = [...people.values()].filter((person) => !joining.has(person.key));
    const worldId = await worldOf(api, members);
    const names = new Map([...people.values()].map((person) => [person.userId, person.name]));
    const said: Json[] = [];
    const steps: Json[] = [];
    let filler = 0;
    for (const [index, step] of world.steps.entries()) {
      stepNow = `integrated:${world.id}:${index + 1}`;
      if (step.say || step.ask) {
        h.ports.reader = 'real'; h.ports.placer = 'real'; h.ports.pass = 'run';
        const person = people.get(step.say ?? step.ask) as Person;
        const before = new Set((await placesOf(api, worldId)).map((place: Json) => place.place_id));
        const passIndex = h.seen.passes.length;
        const { sent, reply } = await h.say(person, worldId, step.text);
        dryStop();
        said.push({ person, materialId: sent && 'materialId' in sent ? sent.materialId : null });
        const after = await placesOf(api, worldId);
        const given = (reply?.result?.knowledgeRefs ?? []).map((ref: string) => (reply.knowledge as Json[]).find((entry) => entry.ref === ref)).filter(Boolean);
        steps.push({
          step: index + 1, kind: step.ask ? 'ask' : 'say', by: person.name, text: step.text, qandeel: sent && 'qandeel' in sent ? sent.qandeel : null,
          reply: reply ? { text: reply.result?.text ?? null, ms: reply.ms, window: reply.window, knowledge: given } : null,
          pass: h.seen.passes[passIndex]?.outcome ?? null,
          saved: after.filter((place: Json) => !before.has(place.place_id)).map((place) => described(place, names)), calls: stepCalls(stepNow),
        });
        console.log(`[s8a-04 cp2] ${world.id} step ${index + 1} (${step.ask ? 'ask' : 'say'}): QANDEEL ${steps.at(-1).qandeel}; ${given.length} knowledge given; pass ${steps.at(-1).pass?.state ?? 'none'}`);
      } else if (step.age) {
        await backdatePlaces(api, worldId, (_, __, committedAt) => new Date(Date.parse(committedAt) - step.age * DAY));
        steps.push({ step: index + 1, kind: 'age', days: step.age });
      } else if (step.filler) {
        // DECLARED TEST SHORTCUT: the old messages leave the 50-message window through filler that runs no reply or reading.
        const current = [...people.values()].filter((person) => !joining.has(person.key));
        for (let count = 0; count < spec.fillerCount; count += 1) {
          await h.commit(current[count % current.length], worldId, spec.filler[(filler + count) % spec.filler.length]);
        }
        filler += spec.fillerCount;
        steps.push({ step: index + 1, kind: 'filler', messages: spec.fillerCount });
      } else if (step.delete !== undefined) {
        const target = said[step.delete];
        await h.deleteOwn(target.person, worldId, target.materialId);
        steps.push({ step: index + 1, kind: 'delete', of: step.delete + 1, by: target.person.name });
      } else if (step.join) {
        const newcomer = people.get(step.join) as Person;
        await addMember(api, worldId, newcomer, [...people.values()].filter((person) => !joining.has(person.key)));
        joining.delete(step.join);
        steps.push({ step: index + 1, kind: 'join', who: newcomer.name });
      }
    }
    const stored = await placesOf(api, worldId);
    const current = new Set(stored.filter((place: Json) => place.standing === 'CURRENT').map((place: Json) => place.meaning));
    const everStored = new Set(steps.flatMap((step) => (step.saved ?? []).map((place: Json) => place.meaning)));
    const asks = steps.filter((step) => step.kind === 'ask');
    // Binding (objective halves): an earlier position offered as current; a relayed position given without its relayer;
    // knowledge given that is no longer stored (deleted) or that the asker may not see now.
    const earlierAsCurrent = asks.flatMap((step) => step.reply?.knowledge ?? []).filter((entry: Json) => entry.current && !current.has(entry.meaning)).map((entry: Json) => entry.meaning);
    const relayedStored = stored.filter((place: Json) => place.absent_holder_label !== null);
    const relayerDropped = asks.flatMap((step) => step.reply?.knowledge ?? []).filter((entry: Json) => relayedStored.some((place: Json) => place.meaning === entry.meaning) && entry.relayedBy.length === 0).map((entry: Json) => entry.meaning);
    const asker = people.get(world.steps.find((step: Json) => step.ask).ask) as Person;
    const visibleNow = new Set(((await h.knowledgeFor(worldId, asker)) ?? []).map((position) => position.meaning));
    const unauthorized = asks.flatMap((step) => step.reply?.knowledge ?? []).filter((entry: Json) => !visibleNow.has(entry.meaning) && everStored.has(entry.meaning)).map((entry: Json) => entry.meaning);
    worlds.push({ world: world.id, tests: world.tests, steps, stored: stored.map((place) => described(place, names)), earlierAsCurrent, relayerDropped, unauthorized,
      ledger: await ledgerOf(api, worldId) });
    if (earlierAsCurrent.length || relayerDropped.length || unauthorized.length) throw new StopError(`${world.id}: an earlier position offered as current, a dropped relayer, or unauthorized knowledge used`);
  }
  return { worlds };
}

// ------------------------------------------------------------------------------------------- main
async function main(): Promise<void> {
  const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  if (!guard) throw new StopError('the spend / network guard is not preloaded');
  if (guard.round !== ROUND || ((guard.maxAttempts !== MAX_ATTEMPTS || guard.costCapUsd !== COST_CAP_USD) && !guard.simulated)) {
    throw new StopError(`guard round ${guard.round} with ${guard.maxAttempts} / ${guard.costCapUsd} is not round ${ROUND} (${MAX_ATTEMPTS}, USD ${COST_CAP_USD})`);
  }
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new StopError(`guard self-test did not block every transport: ${JSON.stringify(selfTest.results)}`);
  const stage = env('QANDEEL_S8A04_STAGE') as StageName;
  if (!(stage in STAGES)) throw new StopError(`unknown stage ${stage}`);

  const text = readFileSync(env('QANDEEL_S8A04_SCENARIOS_FILE'), 'utf8');
  const sha = createHash('sha256').update(JSON.stringify(JSON.parse(text))).digest('hex');
  if (sha !== env('QANDEEL_S8A04_SCENARIOS_SHA256')) throw new StopError('the scenario file changed after the launcher fixed it');
  const cp1Text = readFileSync(env('QANDEEL_S8A04_CP1_SCENARIOS_FILE'), 'utf8');
  const cp1Sha = createHash('sha256').update(JSON.stringify(JSON.parse(cp1Text))).digest('hex');
  if (cp1Sha !== env('QANDEEL_S8A04_CP1_SCENARIOS_SHA256')) throw new StopError('the CP1 scenario file changed after the launcher fixed it');
  const data = JSON.parse(text);
  if (guard.remainingAttempts() < STAGES[stage].calls && !guard.dry) throw new StopError(`${STAGES[stage].calls} calls are this stage's ceiling; ${guard.remainingAttempts()} attempts remain under round ${ROUND}`);

  dryRun = guard.dry === true;
  const api = await openLocalDataApi(process.env);
  installStageCeiling(guard);
  await enableSharedConversation(api);
  const mode = guard.dry ? 'DRY' : guard.simulated ? 'SIMULATED' : 'LIVE';
  console.log(`[s8a-04 cp2] ${mode}: guard round ${guard.round} (${guard.maxAttempts} attempts, USD ${guard.costCapUsd}); self-test blocked ${selfTest.results.length}/${selfTest.results.length}; stage ${stage} (${STAGES[stage].calls} calls, USD ${STAGES[stage].usd})`);
  const h = compose(api);
  let result: Json = null;
  let stopped: string | null = null;
  let failed: unknown = null;
  try {
    stageNow = stage;
    if (stage === 'reading') result = await readingStage(api, h, data, JSON.parse(cp1Text).scenarios);
    if (stage === 'placement') result = await placementStage(api, h, data);
    if (stage === 'recall') result = await recallStage(api, h, data);
    if (stage === 'integrated') result = await integratedStage(api, h, data);
  } catch (error) {
    // A stop is a result; any other failure is recorded too (its name only), the results are written, and then it is rethrown.
    if (error instanceof StopError) stopped = error.message; else { failed = error; stopped = `NOT COMPLETED: ${(error as Error)?.name ?? 'error'} at ${stepNow}`; }
    console.log(`[s8a-04 cp2] STOPPED: ${stopped}`);
  } finally {
    stageNow = null;
    await h.settle().catch(() => undefined);
    await api.close();
  }
  const path = env('QANDEEL_S8A04_RESULTS_PATH');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    mode, round: ROUND, stage, ceiling: STAGES[stage], gitHead: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, scenariosSha256: sha, cp1ScenariosSha256: cp1Sha, stopped,
    spend: { stage: stageSpend(stage), round: { attempts: guard.spend.attempts.length, spentPeakUsd: guard.spend.spentPeakUsd, spentApplicableUsd: guard.spend.spentApplicableUsd } },
    result: result ?? (partial === null ? null : { partial: true, ...partial }), readings: h.seen.readings.filter((reading) => reading.by === 'real').map((reading) => ({ step: reading.step, error: reading.error })),
  }, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}\n`);
  const spent = stageSpend(stage);
  console.log(`[s8a-04 cp2] stage ${stage}: ${spent.calls} call(s), USD ${spent.peakUsd.toFixed(6)} at peak (${spent.applicableUsd.toFixed(6)} applicable); round ${guard.spend.attempts.length} attempt(s), USD ${guard.spend.spentPeakUsd.toFixed(6)}; results → ${join(path)}`);
  if (failed !== null) throw failed;
}

main().catch((error) => {
  console.error(`[s8a-04 cp2] NOT COMPLETED: ${error instanceof StopError ? error.message : (error as Error)?.name ?? 'error'}`);
  if (process.env.QANDEEL_S8A04_DEBUG === '1') console.error(error);
  process.exit(1);
});
