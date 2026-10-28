// S8B-01 CP2 — Stage P, the Orchestrator pre-generation, measured locally (the Product Owner's order, 2026-10-28; record
// §9.22). Operator-only; never imported by production code; no paid call (the network guard blocks every transport but the
// process-owned PostgreSQL port).
//
// WHAT IS MEASURED: P = from the entry of the production ConversationOrchestratorService.orchestrate() to the instant it
// calls the Model Router for the reply (conversation-orchestrator.service.ts, `this.router.generate`): context, Safety,
// Memory control, interaction preferences, the HIM lane, Memory / Hypothesis gathering, Question selection, the guidance
// and the budget assembly, every one the production code, unmodified.
//
// WHAT IS A DOUBLE: the Model Router (it stamps the time and answers a fixed line); PostgREST (a pooled SQL transport,
// one transaction per request with the request's role and JWT claims, as CI-01's — so the parallel lanes stay parallel);
// the background hypothesis providers and the semantic-chain fixture of CI-01, so that Memory and HIM rows accumulate the
// way the post-response pipeline writes them. Composition and PostgREST translation follow scripts/ci-01/intelligence-reality.ts.
//
// WHAT IT IS NOT: the hosted round trips. Production reaches PostgREST over HTTP; here a request costs a local query. The
// second pass adds a fixed delay per request (an ASSUMPTION, labelled as such) to show how the round trips add up.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ConversationOrchestratorService } from '../../apps/api/src/conversation/conversation-orchestrator.service';
import { BoundedForegroundIntelligenceGathererService } from '../../apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { IntegratedContextBudgetAssemblerService } from '../../apps/api/src/intelligence-runtime/integrated-context-budget-assembler.service';
import { QuestionForegroundSelectionService } from '../../apps/api/src/question/question-foreground-selection.service';
import { ConversationRepository } from '../../apps/api/src/conversation/conversation.repository';
import { ContextBuilderService } from '../../apps/api/src/conversation/context-builder.service';
import { SafetyResponseGateService } from '../../apps/api/src/conversation/safety-response-gate.service';
import { BehavioralResponsePolicyService } from '../../apps/api/src/conversation/behavioral-response-policy.service';
import { MemoryRetrieverService } from '../../apps/api/src/memory/memory-retriever.service';
import { MemoryRuntimeService } from '../../apps/api/src/memory/memory-runtime.service';
import { MemoryRepository } from '../../apps/api/src/memory/memory.repository';
import { EvidenceService } from '../../apps/api/src/memory/evidence.service';
import { HimTurnContextSelectionService } from '../../apps/api/src/human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../../apps/api/src/human-model/him-intelligence-snapshot.service';
import { HimFastDeepConsumptionService } from '../../apps/api/src/human-model/him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from '../../apps/api/src/human-model/him-interaction-adaptation.service';
import { HimContextualCurrentIntelligenceService } from '../../apps/api/src/human-model/him-contextual-current-intelligence.service';
import { HimSessionReflectionConsumptionService } from '../../apps/api/src/human-model/him-session-reflection-consumption.service';
import { HimSituationStressConsumptionService } from '../../apps/api/src/human-model/him-situation-stress-consumption.service';
import { HimSituationStressRepository } from '../../apps/api/src/human-model/him-situation-stress.repository';
import { HimDecisionAttentionConsumptionService } from '../../apps/api/src/human-model/him-decision-attention-consumption.service';
import { HimDecisionAttentionRepository } from '../../apps/api/src/human-model/him-decision-attention.repository';
import { HimGoalMotivationConsumptionService } from '../../apps/api/src/human-model/him-goal-motivation-consumption.service';
import { HimGoalMotivationRepository } from '../../apps/api/src/human-model/him-goal-motivation.repository';
import { HimRelationshipCommunicationConsumptionService } from '../../apps/api/src/human-model/him-relationship-communication-consumption.service';
import { HimRelationshipCommunicationRepository } from '../../apps/api/src/human-model/him-relationship-communication.repository';
import { HimCrossContextForegroundAggregationService } from '../../apps/api/src/human-model/him-cross-context-foreground-aggregation.service';
import { HimCrossContextForegroundRepository } from '../../apps/api/src/human-model/him-cross-context-foreground.repository';
import { HimBrainContextService } from '../../apps/api/src/human-model/him-brain-context.service';
import { HimBrainContextRepository } from '../../apps/api/src/human-model/him-brain-context.repository';
import { HimRepository } from '../../apps/api/src/human-model/him.repository';
import { HypothesisService } from '../../apps/api/src/hypothesis/hypothesis.service';
import { HypothesisRepository } from '../../apps/api/src/hypothesis/hypothesis.repository';
import { ConfidenceRepository } from '../../apps/api/src/hypothesis/confidence.repository';
import { HypothesisReasoningContextService } from '../../apps/api/src/hypothesis/hypothesis-reasoning-context.service';
import { RecommendationGroundingService } from '../../apps/api/src/recommendation/recommendation-grounding.service';
import { BackgroundIntelligenceAuthorityService } from '../../apps/api/src/background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from '../../apps/api/src/background-intelligence/background-intelligence-context.factory';
import { BackgroundIntelligenceEnrichmentService } from '../../apps/api/src/background-intelligence/background-intelligence-enrichment.service';
import { HypothesisEvidenceAssociationAuthorityService } from '../../apps/api/src/hypothesis/hypothesis-evidence-association-authority.service';
import { HypothesisGenerationIntentAuthorityService } from '../../apps/api/src/hypothesis/hypothesis-generation-intent-authority.service';
import { HypothesisGenerationIntentExtractionService } from '../../apps/api/src/hypothesis/hypothesis-generation-intent-extraction.service';
import { HypothesisGenerationRequestAssemblerService } from '../../apps/api/src/hypothesis/hypothesis-generation-request-assembler.service';
import { HypothesisGenerationTriggerClassificationService } from '../../apps/api/src/hypothesis/hypothesis-generation-trigger-classification.service';
import { HimReasoningConsumptionService } from '../../apps/api/src/human-model/him-reasoning-consumption.service';
import { MemoryWriteEvaluatorService } from '../../apps/api/src/memory/memory-write-evaluator.service';
import { MemoryControlRepository } from '../../apps/api/src/memory/memory-control.repository';
import { MemoryControlService } from '../../apps/api/src/memory/memory-control.service';
import { InteractionPreferencesRepository } from '../../apps/api/src/interaction-preferences/interaction-preferences.repository';
import { InteractionPreferencesService } from '../../apps/api/src/interaction-preferences/interaction-preferences.service';
import { CorrelationService } from '../../apps/api/src/observability/correlation.service';
import { TelemetryService } from '../../apps/api/src/observability/telemetry.service';
import { ModelAssistedHypothesisAssociationService } from '../../apps/api/src/post-response-intelligence/model-assisted-hypothesis-association.service';
import { PostResponseIntelligenceDispatcherService } from '../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service';
import { PostResponseProviderBudgetService } from '../../apps/api/src/post-response-intelligence/post-response-provider-budget.service';
import { RuntimeEventPublisher } from '../../apps/api/src/runtime-events/runtime-event.publisher';
import { PgBackgroundIntelligenceDataApiAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-background-intelligence-data.adapter';
import { PgPostResponseIntelligenceRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-post-response-intelligence.adapter';
import { PgRuntimeEventAdminRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-runtime-event-admin.adapter';
import { establishFinalSemanticChain } from '../../apps/api/scripts/a2-e2e-smoke/final-semantic-chain-fixture';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pg: any = require('pg');
type Json = any;
type Role = 'postgres' | 'service_role' | 'authenticated';
const TOKEN = 's8b01-stage-p-transport-token'; // transport metadata only; identity is the transaction-local JWT claim

const env = (name: string): string => { const v = process.env[name]; if (!v) throw new Error(`S8B01_STAGE_P: ${name} is not set`); return v; };
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** PostgREST stand-in: a pool, one transaction per request, the request's role and claims; an optional fixed delay. */
class PooledDb {
  readonly pool: any;
  claims = '';
  delayMs = 0;
  requests = 0;
  constructor(config: Json) { this.pool = new pg.Pool({ ...config, max: 10, connectionTimeoutMillis: 10_000 }); }
  private rows<R>(r: Json): R[] { return r.rows.map((row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]))) as R[]; }
  async observer<R = Json>(text: string, values: readonly unknown[] = []): Promise<R[]> { return this.rows<R>(await this.pool.query(text, values as unknown[])); }
  async asRole<R = Json>(role: Role, text: string, values: readonly unknown[] = []): Promise<R[]> {
    this.requests += 1;
    const claims = this.claims;
    await sleep(this.delayMs);
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', claims]);
      if (role !== 'postgres') await c.query(`SET LOCAL ROLE ${role}`);
      const r = await c.query(text, values as unknown[]);
      await c.query('COMMIT');
      return this.rows<R>(r);
    } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
  }
  async setAuthenticatedClaims(userId: string): Promise<void> { this.claims = JSON.stringify({ sub: userId }); }
  async clearAuthenticatedClaims(): Promise<void> { this.claims = ''; }
}

// The PostgREST read dialect the production repositories emit (as CI-01 translates it; any table, identifiers checked).
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
const id = (v: string): string => { if (!IDENTIFIER.test(v)) throw new Error(`S8B01_STAGE_P_UNSUPPORTED:identifier:${v}`); return v; };
function tableRead(table: string, qs: string): { text: string; values: unknown[] } {
  const params = new URLSearchParams(qs); const values: unknown[] = []; const where: string[] = [];
  let columns = '*'; let order = ''; let limit = '';
  const bind = (v: unknown) => { values.push(v); return `$${values.length}`; };
  const simple = (col: string, e: string): string => {
    const c = id(col);
    if (e.startsWith('eq.')) return `${c} = ${bind(e.slice(3))}`;
    if (e.startsWith('not.eq.')) return `${c} <> ${bind(e.slice(7))}`;
    if (e.startsWith('gt.')) return `${c} > ${bind(e.slice(3))}`;
    if (e === 'is.null') return `${c} IS NULL`;
    if (e.startsWith('in.(') && e.endsWith(')')) return `${c} IN (${e.slice(4, -1).split(',').filter(Boolean).map(bind).join(', ')})`;
    throw new Error(`S8B01_STAGE_P_UNSUPPORTED:filter:${e.split('.')[0]}`);
  };
  const or = (e: string): string => {
    const inner = e.slice(1, -1);
    if (inner.startsWith('and(')) {
      const groups = [...inner.matchAll(/and\(([a-z_]+)\.eq\.([^,()]+),([a-z_]+)\.eq\.([^,()]+)\)/gu)];
      return `(${groups.map((g) => `(${id(g[1])} = ${bind(g[2])} AND ${id(g[3])} = ${bind(g[4])})`).join(' OR ')})`;
    }
    return `(${inner.split(',').map((t) => { const d = t.indexOf('.'); return simple(t.slice(0, d), t.slice(d + 1)); }).join(' OR ')})`;
  };
  for (const [k, v] of params.entries()) {
    if (k === 'select') {
      const embed = ',memory_subject_attributions(subject)';
      const plain = table === 'memories' && v.endsWith(embed) ? v.slice(0, -embed.length) : v;
      columns = plain.split(',').map(id).join(', ');
      if (plain !== v) columns += ", (SELECT json_build_object('subject', a.subject) FROM public.memory_subject_attributions a WHERE a.memory_id = memories.id AND a.user_id = memories.user_id) AS memory_subject_attributions";
    } else if (k === 'order') order = ` ORDER BY ${v.split(',').map((s) => { const [c, d] = s.split('.'); return `${id(c)} ${d === 'desc' ? 'DESC' : 'ASC'}`; }).join(', ')}`;
    else if (k === 'limit') limit = ` LIMIT ${Number(v)}`;
    else if (k === 'or') where.push(or(v));
    else where.push(simple(k, v));
  }
  return { text: `SELECT ${columns} FROM public.${id(table)}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${order}${limit}`, values };
}
const rpc = (name: string, body: Record<string, unknown>) => {
  const e = Object.entries(body);
  return { text: `SELECT * FROM public.${id(name)}(${e.map(([k], i) => `${id(k)} => $${i + 1}`).join(', ')})`, values: e.map(([, v]) => v) };
};
function postgrest<T>(db: PooledDb, role: Role, path: string, init: RequestInit = {}): Promise<T> {
  if (path.startsWith('rpc/')) { const q = rpc(path.slice(4), JSON.parse(String(init.body ?? '{}'))); return db.asRole(role, q.text, q.values) as Promise<T>; }
  const i = path.indexOf('?');
  const q = tableRead(i === -1 ? path : path.slice(0, i), i === -1 ? '' : path.slice(i + 1));
  return db.asRole(role, q.text, q.values) as Promise<T>;
}
const unused = <T>(name: string): T => new Proxy({}, { get() { throw new Error(`S8B01_STAGE_P_UNUSED_${name}`); } }) as unknown as T;

/** The Model Router double: it stamps the instant the orchestrator asks for the reply. */
class StampingRouter {
  calledAt: number | null = null;
  requestsAtCall: number | null = null;
  path: string | null = null;
  constructor(private readonly db: { requests: number }) {}
  async generate(request: Json): Promise<Json> {
    if (this.calledAt === null) { this.calledAt = performance.now(); this.requestsAtCall = this.db.requests; }
    this.path = request.path ?? null;
    return { content: 'تمام، فاهمك.', routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

const pct = (xs: number[], p: number): number | null => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] : null;
};

async function main(): Promise<void> {
  const guard = (globalThis as Json).__QANDEEL_CI01_NETWORK_GUARD__;
  if (!guard?.selfTest().allBlocked) throw new Error('S8B01_STAGE_P: the network guard must be preloaded and block every transport');
  if (env('QANDEEL_CI01_DB_HOST') !== '127.0.0.1') throw new Error('S8B01_STAGE_P: 127.0.0.1 only');
  const plan = JSON.parse(readFileSync(env('S8B01_STAGE_P_PLAN'), 'utf8'));
  const db = new PooledDb({ host: '127.0.0.1', port: Number(env('QANDEEL_CI01_DB_PORT')), database: env('QANDEEL_CI01_DB_NAME'),
    user: env('QANDEEL_CI01_DB_USER'), password: env('QANDEEL_CI01_DB_PASSWORD') });
  const [who] = await db.observer<Json>('SELECT current_setting(\'data_directory\') AS d, version() AS v, pg_read_file(\'QANDEEL_CI01_HARNESS_MARKER.json\') AS m');
  if (JSON.parse(who.m).nonce !== env('QANDEEL_CI01_NONCE') || !/^PostgreSQL 17\./u.test(who.v)) throw new Error('S8B01_STAGE_P: not the process-owned cluster');

  const adb = db as Json;
  const api = { request: <T>(_t: string, path: string, init: RequestInit = {}) => postgrest<T>(db, 'authenticated', path, init) } as Json;
  const serviceRoleApi = { rpc: <T>(name: string, body: Record<string, unknown>) => postgrest<T>(db, 'service_role', `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }) } as Json;
  const correlation = new CorrelationService();
  const telemetry = new TelemetryService(correlation);
  const conversationRepository = new ConversationRepository(api, serviceRoleApi, correlation);
  const memoryRuntime = new MemoryRuntimeService(new MemoryRepository(api, unused('MEMORY_SERVICE_ROLE')));
  const evidenceService = new EvidenceService(memoryRuntime);
  const himRepository = new HimRepository(api);
  const stress = new HimSituationStressConsumptionService(new HimSituationStressRepository(api));
  const decision = new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(api));
  const goal = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(api));
  const relation = new HimRelationshipCommunicationConsumptionService(new HimRelationshipCommunicationRepository(api));
  const cross = new HimCrossContextForegroundAggregationService(new HimCrossContextForegroundRepository(api), stress, decision, goal, relation);
  const hypothesisService = new HypothesisService(new HypothesisRepository(api, unused('HYPOTHESIS_SERVICE_ROLE')), evidenceService);
  const reasoning = new HypothesisReasoningContextService(hypothesisService, evidenceService, new ConfidenceRepository(api));
  const router = new StampingRouter(db);
  const orchestrator = new ConversationOrchestratorService(
    conversationRepository, new ContextBuilderService(conversationRepository), new SafetyResponseGateService(), new BehavioralResponsePolicyService(),
    new HimTurnContextSelectionService(), new HimIntelligenceSnapshotService(himRepository), new HimReasoningConsumptionService(),
    new HimFastDeepConsumptionService(), new HimInteractionAdaptationService(), new HimContextualCurrentIntelligenceService(himRepository),
    new HimSessionReflectionConsumptionService(), cross, new HimBrainContextService(new HimBrainContextRepository(api)),
    new BoundedForegroundIntelligenceGathererService(new MemoryRetrieverService(memoryRuntime), reasoning, correlation, telemetry),
    new QuestionForegroundSelectionService(serviceRoleApi, correlation, telemetry),
    new IntegratedContextBudgetAssemblerService(telemetry), new RecommendationGroundingService(),
    router as Json, correlation, telemetry,
    new MemoryControlService(new MemoryControlRepository(api), new MemoryWriteEvaluatorService()),
    new InteractionPreferencesService(new InteractionPreferencesRepository(api)));
  // The post-response pipeline, as CI-01 composes it, so that Memory and HIM rows accumulate between turns.
  const pending: Json[] = [];
  const transport = { readinessStatus: 'available', connect: async () => undefined, close: async () => undefined,
    publish: async (e: Json) => { pending.push(e); return `${Date.now()}-${pending.length}`; } };
  const publisher = new RuntimeEventPublisher(new PgRuntimeEventAdminRepositoryAdapter(adb) as Json, transport as Json, telemetry);
  const dataApi = new PgBackgroundIntelligenceDataApiAdapter(adb) as Json;
  const authority = new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), dataApi);
  const enrichment = new BackgroundIntelligenceEnrichmentService(dataApi, new MemoryWriteEvaluatorService(), new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService());
  const dispatcher = new PostResponseIntelligenceDispatcherService(new PgPostResponseIntelligenceRepositoryAdapter(adb) as Json, authority, enrichment,
    new HypothesisGenerationIntentExtractionService({ extract: async (r: Json) => ({ problemText: r.currentUserText, domain: 'GENERAL', selectedEvidenceIds: r.eligibleEvidence.map((e: Json) => e.evidenceId) }) } as Json, new HypothesisGenerationIntentAuthorityService()),
    new HypothesisGenerationRequestAssemblerService(), { generate: async () => [] } as Json,
    new ModelAssistedHypothesisAssociationService(enrichment, new HypothesisEvidenceAssociationAuthorityService(unused('EVIDENCE'), unused('HYPOTHESIS')), authority, { propose: async () => [] } as Json),
    new PostResponseProviderBudgetService());

  const rows: Json[] = [];
  for (const pass of plan.passes) {
    db.delayMs = pass.perRequestDelayMs;
    for (let u = 0; u < plan.users + plan.warmupUsers; u += 1) {
      const userId = randomUUID();
      await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
      await db.setAuthenticatedClaims(userId);
      const session: Json = await conversationRepository.createSession(TOKEN, randomUUID());
      for (const [k, text] of plan.turns.entries()) {
        await db.setAuthenticatedClaims(userId);
        const turnRow: Json = await conversationRepository.createTurn(TOKEN, { id: randomUUID(), sessionId: session.id, userId, content: text });
        router.calledAt = null; router.requestsAtCall = null;
        const before = db.requests;
        const t0 = performance.now();
        let error: string | null = null;
        let result: Json = null;
        try { result = await correlation.runRequest(() => orchestrator.orchestrate(TOKEN, userId, turnRow)); } catch (e) { error = (e as Error).message; }
        const t1 = performance.now();
        const preRouterRequests = router.requestsAtCall === null ? null : router.requestsAtCall - before; // data requests before the reply call
        rows.push({ pass: pass.id, warmup: u < plan.warmupUsers, user: u, turn: k + 1, path: router.path, routerCalled: router.calledAt !== null,
          pMs: router.calledAt === null ? null : Number((router.calledAt - t0).toFixed(1)), turnMs: Number((t1 - t0).toFixed(1)), requests: preRouterRequests, error });
        if (result?.assistantTurn) {
          await establishFinalSemanticChain(adb, { sessionId: session.id, userId, userTurnId: turnRow.id, userText: result.userTurn.content,
            assistantTurnId: result.assistantTurn.id, assistantText: result.assistantTurn.content });
        }
        await db.clearAuthenticatedClaims();
        db.delayMs = 0; // the post-response pipeline is not Stage P
        await publisher.processOnce();
        for (const e of pending.splice(0)) await dispatcher.dispatch(JSON.stringify(e)).catch(() => undefined);
        db.delayMs = pass.perRequestDelayMs;
      }
    }
  }
  const measured = (pass: string) => rows.filter((r) => r.pass === pass && !r.warmup && r.pMs !== null).map((r) => r.pMs as number);
  const summary = Object.fromEntries(plan.passes.map((p: Json) => {
    const xs = measured(p.id);
    const all = rows.filter((r) => r.pass === p.id && !r.warmup);
    return [p.id, { n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? Math.max(...xs) : null,
      routerNotCalled: all.filter((r) => !r.routerCalled).length, errors: all.filter((r) => r.error).length,
      requestsBeforeReply: { p50: pct(all.filter((r) => r.requests !== null).map((r) => r.requests), 50), max: Math.max(...all.filter((r) => r.requests !== null).map((r) => r.requests)) },
      paths: all.reduce((a: Json, r) => ({ ...a, [r.path ?? 'none']: (a[r.path ?? 'none'] ?? 0) + 1 }), {}),
      byTurnP50: plan.turns.map((_: string, k: number) => pct(all.filter((r) => r.turn === k + 1 && r.pMs !== null).map((r) => r.pMs), 50)),
      warmupFirstTurnMs: rows.find((r) => r.pass === p.id && r.warmup)?.pMs ?? null }];
  }));
  const out = env('S8B01_STAGE_P_RESULTS');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ kind: 'S8B-01 CP2 Stage P (local)', node: process.version, pg: who.v, blocked: guard.blockedAttempts.length, summary, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  await db.pool.end();
}

main().catch((e) => { console.error('S8B01_STAGE_P_FATAL', e); process.exit(1); });
