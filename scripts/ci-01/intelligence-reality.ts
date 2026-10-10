// CI-01 C1-B — Synthetic Intelligence Reality Baseline driver (dev-only; never run by any CI workflow).
//
// Port of the 2026-10-09 Intelligence Reality Check recipe (session scratchpad `rc/s601-reality.ts` +
// `rc/pg-fg-adapters.ts`), now repository-resident, fixture-driven and bound by C1 Task Contract §0.3.
//
// WHAT RUNS FOR REAL: the production ConversationOrchestratorService (Safety, Memory retrieval, Memory
// control, HIM reads, Hypothesis reasoning, Question selection, budget assembler) and the production
// PostResponseIntelligenceDispatcherService (Memory write, Hypothesis association / generation, Confidence,
// Information Gaps), over a process-owned PostgreSQL 17 built from every migration. Every repository,
// policy, evaluator, classifier and SECURITY DEFINER command is the production one, unmodified.
//
// WHAT IS A DOUBLE (verification-side only): (1) the conversational Model Router — records the exact
// request the orchestrator assembled, answers a fixed string; (2) the three background hypothesis
// providers (intent / candidate / association) — deterministic, content-free; (3) the CU / Focus / Thread
// semantic establishment phase — the frozen A2 fixture (two Moments, no Thread); (4) Redis — in-process
// hand-off of the exact envelope the REAL publisher claimed from the REAL outbox; (5) PostgREST — the
// bounded SQL transport below, same per-request role and JWT claims, autocommit per request;
// (6) OpenTelemetry — a recording meter / tracer so that "no content in telemetry" is measured, not assumed.
//
// WHAT THE NUMBERS ARE NOT (D7): no conversational quality, no naturalness, no calibration, nothing about
// what a real LLM would do. Capture / recall / truth-maintenance / isolation yields of deterministic code
// paths on SYNTHETIC fixtures only. Defects are recorded, never repaired here.
//
// PRECONDITIONS enforced by code: `scripts/ci-01/network-guard.cjs` must have been preloaded (it scrubs
// inherited PG* / SUPABASE_* / DATABASE_URL / provider / proxy variables and makes every outbound transport
// throw); the only connection parameters accepted are the QANDEEL_CI01_* values the parent harness set for
// the cluster it created; the cluster identity / ownership proof is repeated here before anything is read
// or written. Any failure is a STOP (exit 3) — no alternative connection is ever tried.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { metrics, trace } from '@opentelemetry/api';
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
import { CorrelationService } from '../../apps/api/src/observability/correlation.service';
import { TelemetryService } from '../../apps/api/src/observability/telemetry.service';
import { ModelAssistedHypothesisAssociationService } from '../../apps/api/src/post-response-intelligence/model-assisted-hypothesis-association.service';
import { PostResponseIntelligenceDispatcherService } from '../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service';
import { PostResponseProviderBudgetService } from '../../apps/api/src/post-response-intelligence/post-response-provider-budget.service';
import { RuntimeEventPublisher } from '../../apps/api/src/runtime-events/runtime-event.publisher';
import { composeServerGuidance } from '../../apps/api/src/model-router/model-router.types';
import { PgBackgroundIntelligenceDataApiAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-background-intelligence-data.adapter';
import { PgPostResponseIntelligenceRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-post-response-intelligence.adapter';
import { PgRuntimeEventAdminRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-runtime-event-admin.adapter';
import { establishFinalSemanticChain } from '../../apps/api/scripts/a2-e2e-smoke/final-semantic-chain-fixture';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pg: any = require('pg');

const HARNESS = 'qandeel-ci-01-synthetic-intelligence-reality-baseline';
const MARKER_FILE = 'QANDEEL_CI01_HARNESS_MARKER.json';
const TOKEN = 'ci01-synthetic-transport-token'; // transport metadata only; identity is the transaction-local JWT claim
const LINKS_SQL = `SELECT h.id AS hypothesis_id, h.status AS hypothesis_status, m.type AS memory_type, m.status AS memory_status, m.content AS memory_content
  FROM public.hypotheses h CROSS JOIN LATERAL unnest(h.supporting_evidence_ids) AS e(id)
  JOIN public.memories m ON m.id = substring(e.id FROM 8)::uuid WHERE h.user_id = $1 ORDER BY h.created_at, m.created_at`;

type Role = 'postgres' | 'service_role' | 'authenticated' | 'anon';
type Json = any;

class StopError extends Error { constructor(message: string) { super(`QANDEEL_CI01_STOP: ${message}`); } }
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new StopError(`${name} is not set — the driver accepts only the connection its parent harness created`);
  return value;
}
const normalizePath = (p: string): string => p.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------------------------------------
// PostgREST substitute: autocommit per request, per-request role + transaction-local JWT claims.
// ---------------------------------------------------------------------------------------------
function toTransportRow<T>(row: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) mapped[k] = v instanceof Date ? v.toISOString() : v;
  return mapped as T;
}
class AutoCommitDb {
  private readonly client: any;
  private queue: Promise<unknown> = Promise.resolve();
  private claims = '';
  constructor(config: { host: string; port: number; database: string; user: string; password: string }) {
    this.client = new pg.Client({ ...config, connectionTimeoutMillis: 10_000 });
  }
  async open(): Promise<void> { await this.client.connect(); }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work); this.queue = next.then(() => undefined, () => undefined); return next;
  }
  observer<R = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      const r = await this.client.query(text, values as unknown[]);
      return r.rows.map((row: Record<string, unknown>) => toTransportRow<R>(row));
    });
  }
  asRole<R = Record<string, unknown>>(role: Role, text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      await this.client.query('BEGIN');
      try {
        await this.client.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', this.claims]);
        if (role !== 'postgres') await this.client.query(`SET LOCAL ROLE ${role}`);
        const r = await this.client.query(text, values as unknown[]);
        await this.client.query('COMMIT');
        return r.rows.map((row: Record<string, unknown>) => toTransportRow<R>(row));
      } catch (error) { await this.client.query('ROLLBACK'); throw error; }
    });
  }
  async setAuthenticatedClaims(userId: string): Promise<void> { this.claims = JSON.stringify({ sub: userId }); }
  async clearAuthenticatedClaims(): Promise<void> { this.claims = ''; }
  async close(): Promise<void> { await this.client.end(); }
}

// Bounded translation of the exact PostgREST read dialect the frozen production repositories emit.
// Transport plumbing only; every SELECT shape originates verbatim in a production repository.
const READABLE_TABLES = new Set(['conversation_sessions', 'conversation_turns', 'memories', 'hypotheses', 'confidence_evaluations', 'memory_control_commands']);
const AUTHENTICATED_RPC_ALLOWLIST = new Set(['pending_memory_clarification_v1', 'create_conversation_session_v1', 'create_user_conversation_turn',
  'read_him_intelligence_snapshot_v1', 'read_him_contextual_current_intelligence_batch_v1', 'read_him_session_cross_context_foreground_v3',
  'read_him_brain_context_for_turn_v1', 'set_him_session_context_binding_v1']);
const SERVICE_ROLE_RPC_ALLOWLIST = new Set(['server_finalize_memory_control_turn_v1', 'claim_conversation_turn', 'finalize_conversation_turn_v2',
  'fail_conversation_turn', 'select_formal_question_opportunity_v1']);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
const SELECT_LIST = /^[a-z_][a-z0-9_,]*$/u;
function unsupported(detail: string): never { throw new Error(`CI01_UNSUPPORTED_DATA_API_REQUEST:${detail}`); }
function identifier(value: string): string { if (!IDENTIFIER.test(value)) unsupported('identifier'); return value; }
function translateTableRead(table: string, queryString: string): { text: string; values: unknown[] } {
  if (!READABLE_TABLES.has(table)) unsupported(`table:${table}`);
  const params = new URLSearchParams(queryString);
  const values: unknown[] = []; const conditions: string[] = [];
  let columns = '*'; let orderBy = ''; let limit = '';
  const bind = (value: unknown): string => { values.push(value); return `$${values.length}`; };
  const simple = (column: string, expression: string): string => {
    const col = identifier(column);
    if (expression.startsWith('eq.')) return `${col} = ${bind(expression.slice(3))}`;
    if (expression.startsWith('not.eq.')) return `${col} <> ${bind(expression.slice(7))}`;
    if (expression.startsWith('gt.')) return `${col} > ${bind(expression.slice(3))}`;
    if (expression === 'is.null') return `${col} IS NULL`;
    if (expression.startsWith('in.(') && expression.endsWith(')')) {
      const items = expression.slice(4, -1).split(',').filter((item) => item.length > 0);
      if (items.length === 0) unsupported('empty-in-list');
      return `${col} IN (${items.map((item) => bind(item)).join(', ')})`;
    }
    return unsupported(`filter:${expression.split('.')[0] ?? expression}`);
  };
  const or = (expression: string): string => {
    if (!expression.startsWith('(') || !expression.endsWith(')')) unsupported('or-shape');
    const inner = expression.slice(1, -1);
    if (inner.startsWith('and(')) {
      const groups = [...inner.matchAll(/and\(([a-z_]+)\.eq\.([^,()]+),([a-z_]+)\.eq\.([^,()]+)\)/gu)];
      if (groups.length === 0 || groups.map((g) => g[0]).join(',') !== inner) unsupported('or-and-shape');
      return `(${groups.map((g) => `(${identifier(g[1])} = ${bind(g[2])} AND ${identifier(g[3])} = ${bind(g[4])})`).join(' OR ')})`;
    }
    const terms = inner.split(',');
    if (terms.length < 2) unsupported('or-term-count');
    return `(${terms.map((term) => { const dot = term.indexOf('.'); if (dot <= 0) unsupported('or-term'); return simple(term.slice(0, dot), term.slice(dot + 1)); }).join(' OR ')})`;
  };
  for (const [key, value] of params.entries()) {
    if (key === 'select') { if (!SELECT_LIST.test(value)) unsupported('select'); columns = value.split(',').map(identifier).join(', '); }
    else if (key === 'order') {
      orderBy = ` ORDER BY ${value.split(',').map((segment) => { const [column, direction] = segment.split('.'); if (direction !== 'asc' && direction !== 'desc') unsupported('order'); return `${identifier(column)} ${direction.toUpperCase()}`; }).join(', ')}`;
    } else if (key === 'limit') { if (!/^\d{1,6}$/u.test(value)) unsupported('limit'); limit = ` LIMIT ${Number(value)}`; }
    else if (key === 'or') conditions.push(or(value));
    else conditions.push(simple(key, value));
  }
  return { text: `SELECT ${columns} FROM public.${table}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}${orderBy}${limit}`, values };
}
function rpcCall(name: string, body: Record<string, unknown>): { text: string; values: unknown[] } {
  const entries = Object.entries(body);
  return { text: `SELECT * FROM public.${identifier(name)}(${entries.map(([key], i) => `${identifier(key)} => $${i + 1}`).join(', ')})`, values: entries.map(([, v]) => v) };
}
class RpcCensus {
  readonly attempted = new Map<string, number>(); readonly completed = new Map<string, number>(); readonly failed = new Map<string, number>();
  private static bump(m: Map<string, number>, k: string): void { m.set(k, (m.get(k) ?? 0) + 1); }
  attempt(n: string): void { RpcCensus.bump(this.attempted, n); } complete(n: string): void { RpcCensus.bump(this.completed, n); } fail(n: string): void { RpcCensus.bump(this.failed, n); }
  toJSON(): Json { return { attempted: Object.fromEntries(this.attempted), completed: Object.fromEntries(this.completed), failed: Object.fromEntries(this.failed) }; }
}
async function executePostgrest<T>(db: AutoCommitDb, role: Role, allow: ReadonlySet<string>, path: string, init: RequestInit, census?: RpcCensus): Promise<T> {
  if (path.startsWith('rpc/')) {
    const name = path.slice(4); census?.attempt(name);
    try {
      if (!allow.has(name)) unsupported(`rpc:${name}`);
      if ((init.method ?? 'POST') !== 'POST' || typeof init.body !== 'string') unsupported('rpc-method');
      const { text, values } = rpcCall(name, JSON.parse(init.body) as Record<string, unknown>);
      const rows = (await db.asRole(role, text, values)) as T; census?.complete(name); return rows;
    } catch (error) { census?.fail(name); throw error; }
  }
  if (init.method && init.method !== 'GET') unsupported('table-method');
  const q = path.indexOf('?');
  const { text, values } = translateTableRead(identifier(q === -1 ? path : path.slice(0, q)), q === -1 ? '' : path.slice(q + 1));
  return (await db.asRole(role, text, values)) as T;
}
/** Structurally compatible with SupabaseDataApiService / MemoryDataApiService. */
class PgAuthenticatedDataApiAdapter {
  readonly rpcCensus = new RpcCensus();
  constructor(private readonly db: AutoCommitDb) {}
  request<T>(_accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    return executePostgrest<T>(this.db, 'authenticated', AUTHENTICATED_RPC_ALLOWLIST, path, init, this.rpcCensus);
  }
}
/** Structurally compatible with SupabaseServiceRoleApiService. */
class PgConversationServiceRoleApiAdapter {
  constructor(private readonly db: AutoCommitDb) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!SERVICE_ROLE_RPC_ALLOWLIST.has(name)) unsupported(`service-role-rpc:${name}`);
    const { text, values } = rpcCall(name, body);
    return (await this.db.asRole('service_role', text, values)) as T;
  }
}

// ---------------------------------------------------------------------------------------------
// Doubles (verification-side; content-free; prove nothing about any real model).
// ---------------------------------------------------------------------------------------------
function unused<T>(name: string): T {
  return new Proxy({}, { get() { throw new Error(`CI01_UNUSED_DEPENDENCY_${name}`); } }) as unknown as T;
}
class RecordingRouter {
  readonly calls: Array<{ request: Json; guidanceBytes: number }> = [];
  async generate(request: Json): Promise<Json> {
    this.calls.push({ request: structuredClone(request), guidanceBytes: Buffer.byteLength(composeServerGuidance(request)) });
    return { content: 'تمام، فاهمك.', routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
class InProcessTransport {
  readonly readinessStatus = 'available' as const;
  private n = 0; private pending: Json[] = [];
  async connect(): Promise<void> { /* in-process */ }
  async publish(event: Json): Promise<string> { this.pending.push(event); this.n += 1; return `${Date.now()}-${this.n}`; }
  async close(): Promise<void> { /* in-process */ }
  drain(): Json[] { const p = this.pending; this.pending = []; return p; }
}
class IntentDouble {
  calls = 0;
  async extract(req: Json): Promise<Json> { this.calls += 1; return { problemText: req.currentUserText, domain: 'GENERAL', selectedEvidenceIds: req.eligibleEvidence.map((e: Json) => e.evidenceId) }; }
}
class CandidateDouble {
  calls = 0;
  async generate(req: Json): Promise<Json[]> {
    this.calls += 1;
    return [{ statement: `SYNTHETIC_DOUBLE_CANDIDATE_${this.calls}`, type: 'BEHAVIORAL', domain: req.domain, scope: req.scope,
      supportingEvidenceIds: req.eligibleEvidence.map((e: Json) => e.evidenceId), contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [] }];
  }
}
class AssociationDouble { calls = 0; async propose(): Promise<Json[]> { this.calls += 1; return []; } }

/** Recording OpenTelemetry meter + tracer: captures every attribute / value / event / exception production would emit. */
class RecordingTelemetry {
  readonly records: Array<{ kind: string; name: string; value?: unknown; attributes?: Record<string, unknown>; message?: string }> = [];
  install(): void {
    const push = (kind: string, name: string, value?: unknown, attributes?: Json, message?: string): void => {
      this.records.push({ kind, name, value, attributes: attributes ? structuredClone(attributes) : undefined, message });
    };
    const instrument = (name: string) => ({
      add: (value: number, attributes?: Json) => push('metric.add', name, value, attributes),
      record: (value: number, attributes?: Json) => push('metric.record', name, value, attributes),
      addCallback() { /* observable: never read here */ }, removeCallback() { /* observable */ },
    });
    const meter = {
      createCounter: instrument, createHistogram: instrument, createGauge: instrument, createUpDownCounter: instrument,
      createObservableGauge: instrument, createObservableCounter: instrument, createObservableUpDownCounter: instrument,
      addBatchObservableCallback() { /* observable */ }, removeBatchObservableCallback() { /* observable */ },
    };
    metrics.disable(); metrics.setGlobalMeterProvider({ getMeter: () => meter } as Json);
    const span = (name: string, options?: Json) => {
      push('span.start', name, undefined, options?.attributes);
      return {
        setAttribute: (k: string, v: unknown) => push('span.attribute', name, v, { [k]: v }),
        setAttributes: (a: Json) => push('span.attributes', name, undefined, a),
        addEvent: (eventName: string, a?: Json) => push('span.event', `${name}/${eventName}`, undefined, a),
        setStatus: (s: Json) => push('span.status', name, s?.code, undefined, s?.message),
        recordException: (e: Json) => push('span.exception', name, undefined, undefined, String(e?.message ?? e)),
        updateName() { /* no-op */ }, end() { /* no-op */ }, isRecording: () => true, addLink() { /* no-op */ }, addLinks() { /* no-op */ },
        spanContext: () => ({ traceId: '0'.repeat(32), spanId: '0'.repeat(16), traceFlags: 0 }),
      };
    };
    const tracer = {
      startSpan: span,
      startActiveSpan: (name: string, ...args: Json[]) => { const fn = args[args.length - 1]; const options = args.length > 1 && typeof args[0] === 'object' ? args[0] : undefined; return fn(span(name, options)); },
    };
    trace.disable(); trace.setGlobalTracerProvider({ getTracer: () => tracer } as Json);
  }
  strings(): string[] {
    const out: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
    };
    for (const r of this.records) { out.push(r.name); walk(r.attributes); walk(r.value); if (r.message) out.push(r.message); }
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// §0.3 — identity / ownership proof, repeated by the driver before anything is read or written.
// ---------------------------------------------------------------------------------------------
async function proveClusterIdentity(db: AutoCommitDb, expected: { port: number; database: string; dataDir: string; nonce: string; createdByPid: number }): Promise<Json> {
  const [row] = await db.observer<Json>(`
    SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS database, version() AS version,
           current_setting('data_directory') AS data_directory, pg_postmaster_start_time() AS started_at,
           (SELECT count(*)::int FROM pg_database WHERE datname NOT IN ('postgres', 'template0', 'template1') AND datname <> $1) AS foreign_databases,
           pg_read_file($2) AS marker`, [expected.database, MARKER_FILE]);
  const marker = JSON.parse(row.marker);
  const checks = {
    loopbackAddress: row.addr === '127.0.0.1', harnessPort: Number(row.port) === expected.port, database: row.database === expected.database,
    postgres17: /^PostgreSQL 17\./u.test(row.version), dataDirectoryIsOurs: normalizePath(row.data_directory) === normalizePath(expected.dataDir),
    markerNonceMatches: marker.nonce === expected.nonce && marker.harness === HARNESS, markerPidIsParentHarness: marker.createdByPid === expected.createdByPid,
    noForeignDatabases: row.foreign_databases === 0,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const proof = { checkedAt: new Date().toISOString(), address: row.addr, port: Number(row.port), database: row.database, version: row.version,
    dataDirectory: row.data_directory, postmasterStartedAt: row.started_at, markerNonce: marker.nonce, foreignDatabases: row.foreign_databases, checks, passed: failed.length === 0 };
  if (failed.length > 0) throw new StopError(`driver-side cluster identity proof FAILED: ${failed.join(', ')} — ${JSON.stringify(proof)}`);
  return proof;
}

// ---------------------------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const guard = (globalThis as Json).__QANDEEL_CI01_NETWORK_GUARD__;
  if (!guard) throw new StopError('network guard not preloaded — run through scripts/ci-01/local-db.mjs run-baseline');
  const selfTest = guard.selfTest();
  if (!selfTest.allBlocked) throw new StopError(`network guard self-test did not block every transport: ${JSON.stringify(selfTest.probes.filter((p: Json) => p.outcome !== 'BLOCKED'))}`);
  const blockedAfterSelfTest = guard.blockedAttempts.length;

  const expected = {
    host: requiredEnv('QANDEEL_CI01_DB_HOST'), port: Number(requiredEnv('QANDEEL_CI01_DB_PORT')), database: requiredEnv('QANDEEL_CI01_DB_NAME'),
    user: requiredEnv('QANDEEL_CI01_DB_USER'), password: requiredEnv('QANDEEL_CI01_DB_PASSWORD'), dataDir: requiredEnv('QANDEEL_CI01_DATA_DIR'),
    nonce: requiredEnv('QANDEEL_CI01_NONCE'), createdByPid: Number(requiredEnv('QANDEEL_CI01_CREATED_BY_PID')),
  };
  if (expected.host !== '127.0.0.1') throw new StopError('only 127.0.0.1 is accepted');
  const context = JSON.parse(readFileSync(requiredEnv('QANDEEL_CI01_CONTEXT_FILE'), 'utf8'));
  const resultsPath = requiredEnv('QANDEEL_CI01_RESULTS_PATH');
  const fixturesDir = requiredEnv('QANDEEL_CI01_FIXTURES_DIR');
  const only = process.env.QANDEEL_CI01_ONLY;

  // host is a literal: the environment value was only checked to equal it, never used as a connection target
  const db = new AutoCommitDb({ host: '127.0.0.1', port: expected.port, database: expected.database, user: expected.user, password: expected.password });
  await db.open();
  const driverProof = await proveClusterIdentity(db, expected);
  console.log(`[ci-01 driver] cluster identity proof PASSED (${driverProof.database} @ 127.0.0.1:${driverProof.port}, marker ${String(driverProof.markerNonce).slice(0, 8)}…)`);

  const telemetryRecorder = new RecordingTelemetry();
  telemetryRecorder.install();

  // ---- production composition (identical to the 2026-10-09 recipe) --------------------------------
  const adb = db as Json;
  const authenticatedDataApi = new PgAuthenticatedDataApiAdapter(db);
  const api = authenticatedDataApi as Json;
  const serviceRoleApi = new PgConversationServiceRoleApiAdapter(db) as Json;
  const correlation = new CorrelationService();
  const telemetry = new TelemetryService(correlation);
  const conversationRepository = new ConversationRepository(api, serviceRoleApi, correlation);
  const memoryRuntime = new MemoryRuntimeService(new MemoryRepository(api, unused('MEMORY_SERVICE_ROLE')));
  const memoryRetriever = new MemoryRetrieverService(memoryRuntime);
  const evidenceService = new EvidenceService(memoryRuntime);
  const himRepository = new HimRepository(api);
  const stress = new HimSituationStressConsumptionService(new HimSituationStressRepository(api));
  const decision = new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(api));
  const goal = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(api));
  const relation = new HimRelationshipCommunicationConsumptionService(new HimRelationshipCommunicationRepository(api));
  const cross = new HimCrossContextForegroundAggregationService(new HimCrossContextForegroundRepository(api), stress, decision, goal, relation);
  const hypothesisService = new HypothesisService(new HypothesisRepository(api, unused('HYPOTHESIS_SERVICE_ROLE')), evidenceService);
  const reasoning = new HypothesisReasoningContextService(hypothesisService, evidenceService, new ConfidenceRepository(api));
  const router = new RecordingRouter();
  const orchestrator = new ConversationOrchestratorService(
    conversationRepository, new ContextBuilderService(conversationRepository), new SafetyResponseGateService(), new BehavioralResponsePolicyService(),
    new HimTurnContextSelectionService(), new HimIntelligenceSnapshotService(himRepository), new HimReasoningConsumptionService(),
    new HimFastDeepConsumptionService(), new HimInteractionAdaptationService(), new HimContextualCurrentIntelligenceService(himRepository),
    new HimSessionReflectionConsumptionService(), cross, new HimBrainContextService(new HimBrainContextRepository(api)),
    new BoundedForegroundIntelligenceGathererService(memoryRetriever, reasoning, correlation, telemetry),
    new QuestionForegroundSelectionService(serviceRoleApi, correlation, telemetry),
    new IntegratedContextBudgetAssemblerService(telemetry), new RecommendationGroundingService(),
    router as Json, correlation, telemetry,
    new MemoryControlService(new MemoryControlRepository(api), new MemoryWriteEvaluatorService()));
  const transport = new InProcessTransport();
  const publisher = new RuntimeEventPublisher(new PgRuntimeEventAdminRepositoryAdapter(adb) as Json, transport as Json, telemetry);
  const dataApi = new PgBackgroundIntelligenceDataApiAdapter(adb) as Json;
  const ledger = new PgPostResponseIntelligenceRepositoryAdapter(adb) as Json;
  const authority = new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), dataApi);
  const enrichment = new BackgroundIntelligenceEnrichmentService(dataApi, new MemoryWriteEvaluatorService(),
    new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService());
  const intent = new IntentDouble(); const cand = new CandidateDouble(); const assoc = new AssociationDouble();
  const association = new ModelAssistedHypothesisAssociationService(enrichment,
    new HypothesisEvidenceAssociationAuthorityService(unused('EVIDENCE'), unused('HYPOTHESIS')), authority, assoc as Json);
  const dispatcher = new PostResponseIntelligenceDispatcherService(ledger, authority, enrichment,
    new HypothesisGenerationIntentExtractionService(intent as Json, new HypothesisGenerationIntentAuthorityService()),
    new HypothesisGenerationRequestAssemblerService(), cand as Json, association, new PostResponseProviderBudgetService());
  const evaluator = new MemoryWriteEvaluatorService();
  const classifier = new HypothesisGenerationTriggerClassificationService();
  const safety = new SafetyResponseGateService();

  // ---- fixture execution -------------------------------------------------------------------------------
  const users = new Map<string, string>();
  const sessions = new Map<string, string>();
  const fixtureTexts: string[] = [];
  async function user(label: string): Promise<string> {
    let id = users.get(label);
    if (!id) { id = randomUUID(); await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [id]); users.set(label, id); }
    return id;
  }
  async function newSession(label: string, sessionLabel: string): Promise<string> {
    const userId = await user(label);
    const sessionId = randomUUID();
    await db.setAuthenticatedClaims(userId);
    const s: Json = await conversationRepository.createSession(TOKEN, sessionId);
    if (s?.status !== 'ACTIVE') throw new Error(`session not ACTIVE for ${label}/${sessionLabel}`);
    await db.clearAuthenticatedClaims();
    sessions.set(`${label}:${sessionLabel}`, sessionId);
    return sessionId;
  }
  const memories = (userId: string) => db.observer<Json>('SELECT type, content, source, status, version FROM public.memories WHERE user_id = $1 ORDER BY created_at, id', [userId]);
  const hypothesisCount = async (userId: string) => Number((await db.observer<Json>('SELECT count(*)::int AS n FROM public.hypotheses WHERE user_id = $1', [userId]))[0].n);

  async function turn(step: Json): Promise<Json> {
    const userId = await user(step.user);
    const sessionId = sessions.get(`${step.user}:${step.session}`);
    if (!sessionId) throw new Error(`step ${step.id}: session ${step.session} was not opened`);
    fixtureTexts.push(step.text);
    const rec: Json = { stepId: step.id, text: step.text, measure: step.measure ?? {}, note: step.note };
    rec.safety = safety.evaluate(step.text, []).disposition;
    const md: Json = evaluator.evaluate(step.text);
    rec.memoryEvaluator = md.decision === 'WRITE' ? `WRITE ${md.candidate.type}` : `SKIP ${md.reason}`;
    const tc = classifier.classify({ text: step.text, safetyDisposition: 'ALLOW' });
    rec.triggerClassifier = `${tc.classification} ${tc.reason}`;
    const memBefore = (await memories(userId)).length;
    const hypBefore = await hypothesisCount(userId);
    const pBefore = { intent: intent.calls, cand: cand.calls, assoc: assoc.calls };
    await db.setAuthenticatedClaims(userId);
    const turnRow: Json = await conversationRepository.createTurn(TOKEN, { id: randomUUID(), sessionId, userId, content: step.text });
    const before = router.calls.length;
    let result: Json;
    try { result = await correlation.runRequest(() => orchestrator.orchestrate(TOKEN, userId, turnRow)); }
    catch (e) { rec.foregroundError = (e as Error).message; }
    const call = router.calls.length > before ? router.calls[router.calls.length - 1].request : undefined;
    rec.routerCalled = Boolean(call);
    rec.memoryContext = call?.memoryContext ? call.memoryContext.map((m: Json) => `${m.type}: ${m.content}`) : [];
    rec.hypothesisContextItems = call?.hypothesisContext ? (Array.isArray(call.hypothesisContext) ? call.hypothesisContext.length : (call.hypothesisContext.hypotheses?.length ?? 1)) : 0;
    rec.humanIntelligence = call?.humanIntelligence ? {
      behavioralInstructionIds: call.humanIntelligence.behavioralInstructionIds ?? [],
      coverageState: call.humanIntelligence.sessionReasoningContext?.coverageState ?? null,
      knownMetricCount: call.humanIntelligence.sessionReasoningContext?.knownMetricCount ?? null,
      knownMetrics: (call.humanIntelligence.sessionReasoningContext?.metrics ?? []).filter((m: Json) => m.knowledgeState !== 'UNKNOWN').map((m: Json) => `${m.metricKey}=${m.ordinalCategory}`),
    } : null;
    rec.questionContextPresent = Boolean(call?.questionContext);
    rec.guidanceBytes = call ? router.calls[router.calls.length - 1].guidanceBytes : null;
    rec.assistantTurn = Boolean(result?.assistantTurn);
    if (result?.assistantTurn && step.semantic !== false) {
      await establishFinalSemanticChain(adb, { sessionId, userId, userTurnId: turnRow.id, userText: result.userTurn.content,
        assistantTurnId: result.assistantTurn.id, assistantText: result.assistantTurn.content });
      rec.semanticChain = 'FIXTURE_NO_THREAD';
    } else rec.semanticChain = 'ABSENT';
    await db.clearAuthenticatedClaims();
    await publisher.processOnce();
    const envelopes = transport.drain();
    rec.outboxEventsPublished = envelopes.length;
    rec.dispatch = [];
    for (const envelope of envelopes) {
      try { rec.dispatch.push(await dispatcher.dispatch(JSON.stringify(envelope))); } catch (e) { rec.dispatch.push(`ERR ${(e as Error).message}`); }
    }
    const [exec] = await db.observer<Json>('SELECT id, state, outcome_code, current_stage, attempt_count FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [turnRow.id]);
    rec.execution = exec ? `${exec.state}/${exec.outcome_code ?? '-'}/${exec.current_stage ?? '-'}` : 'NONE';
    if (exec) rec.effects = (await db.observer<Json>('SELECT effect_key, state, result_code FROM public.post_response_intelligence_effects WHERE execution_id = $1 ORDER BY effect_key', [exec.id])).map((r: Json) => `${r.effect_key}:${r.state}:${r.result_code ?? '-'}`);
    const memAfter = await memories(userId);
    rec.newMemories = memAfter.slice(memBefore).map((m: Json) => ({ type: m.type, source: m.source, status: m.status, version: m.version, content: m.content }));
    rec.memoryVersionsChanged = memAfter.length === memBefore && memAfter.some((m: Json) => m.version > 1);
    rec.newHypotheses = (await hypothesisCount(userId)) - hypBefore;
    rec.providerDoubleCalls = { intent: intent.calls - pBefore.intent, candidate: cand.calls - pBefore.cand, association: assoc.calls - pBefore.assoc };
    // derived measurements (definitions live in the fixture; nothing here judges "good" or "bad")
    const m = step.measure ?? {};
    const served = rec.memoryContext.join('\n');
    if (m.valueStatement || m.factStatement) rec.captured = rec.newMemories.length > 0;
    if (m.recallProbe) rec.recallHit = m.recallProbe.anyOf.some((token: string) => served.includes(token));
    if (m.staleProbe) rec.staleServed = m.staleProbe.staleTokens.some((token: string) => served.includes(token));
    if (m.forgottenProbe) rec.forgottenServed = m.forgottenProbe.noneOf.some((token: string) => served.includes(token));
    if (m.hypothesisInjectionProbe) rec.hypothesisInjected = rec.hypothesisContextItems > 0;
    if (m.thirdParty) rec.thirdPartyStoredAsUserMemory = rec.newMemories.map((x: Json) => x.type);
    return rec;
  }
  async function finalState(label: string): Promise<Json> {
    const userId = await user(label);
    const mems = await memories(userId);
    const activeByContent = new Map<string, number>();
    for (const m of mems) if (m.status === 'ACTIVE') activeByContent.set(m.content, (activeByContent.get(m.content) ?? 0) + 1);
    return {
      memories: mems.map((m: Json) => ({ type: m.type, source: m.source, status: m.status, version: m.version, content: m.content })),
      memoryStatusCounts: mems.reduce((acc: Json, m: Json) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }), {}),
      duplicateActiveMemories: [...activeByContent.values()].filter((n) => n > 1).length,
      hypotheses: (await db.observer<Json>('SELECT status, scope, origin, version, statement FROM public.hypotheses WHERE user_id = $1 ORDER BY created_at', [userId]))
        .map((h: Json) => ({ status: h.status, origin: h.origin, version: h.version, scope: String(h.scope).replace(/:[0-9a-f-]{36}$/u, ':<session>'), statement: h.statement })),
      himObservations: Number((await db.observer<Json>('SELECT count(*)::int AS n FROM public.him_measurement_observations WHERE user_id = $1', [userId]))[0].n),
      himSnapshots: Number((await db.observer<Json>('SELECT count(*)::int AS n FROM public.him_metric_snapshots WHERE user_id = $1', [userId]))[0].n),
      informationGaps: Number((await db.observer<Json>('SELECT count(*)::int AS n FROM public.information_gaps WHERE user_id = $1', [userId]))[0].n),
      questionCandidates: Number((await db.observer<Json>('SELECT count(*)::int AS n FROM public.question_candidates WHERE user_id = $1', [userId]))[0].n),
    };
  }
  function yields(turns: Json[], finals: Record<string, Json>, links: Record<string, Json[]>): Json {
    const count = (pred: (t: Json) => boolean) => turns.filter(pred).length;
    const y: Json = {};
    const values = turns.filter((t) => t.measure.valueStatement);
    if (values.length) y.captureYield = { valueStatements: values.length, captured: values.filter((t) => t.captured).length, hedgedCaptured: count((t) => t.measure.hedged && t.captured) };
    const facts = turns.filter((t) => t.measure.factStatement);
    if (facts.length) y.factCapture = { factStatements: facts.length, captured: facts.filter((t) => t.captured).length, storedForms: facts.flatMap((t) => t.newMemories.map((m: Json) => m.content)) };
    const probes = turns.filter((t) => t.measure.recallProbe);
    if (probes.length) y.recall = { probes: probes.length, hits: probes.filter((t) => t.recallHit).length, perProbe: probes.map((t) => ({ step: t.stepId, hit: t.recallHit, servedItems: t.memoryContext.length })) };
    const stale = turns.filter((t) => t.measure.staleProbe);
    if (stale.length) y.truthMaintenance = { staleProbes: stale.length, staleServed: stale.filter((t) => t.staleServed).length, perProbe: stale.map((t) => ({ step: t.stepId, staleServed: t.staleServed, servedItems: t.memoryContext.length })),
      duplicateActiveMemoriesAtEnd: Object.values(finals).reduce((n: number, f: Json) => n + f.duplicateActiveMemories, 0), memoryStatusCountsAtEnd: Object.fromEntries(Object.entries(finals).map(([k, f]) => [k, f.memoryStatusCounts])) };
    const forgotten = turns.filter((t) => t.measure.forgottenProbe);
    if (forgotten.length) {
      y.forget = { controlCommands: turns.filter((t) => t.measure.memoryControl).map((t) => ({ step: t.stepId, command: t.measure.memoryControl, routerCalled: t.routerCalled, assistantTurn: t.assistantTurn })),
        forgottenProbes: forgotten.length, forgottenServed: forgotten.filter((t) => t.forgottenServed).length,
        hypothesisInjectedAfterForget: turns.filter((t) => t.measure.hypothesisInjectionProbe && t.hypothesisInjected).length,
        memoryStatusCountsAtEnd: Object.fromEntries(Object.entries(finals).map(([k, f]) => [k, f.memoryStatusCounts])) };
      const after = links.after ?? [];
      y.pg02 = { hypothesisEvidenceLinksBefore: (links.before ?? []).map((l: Json) => `${l.hypothesis_status}/${l.memory_type}:${l.memory_status}`),
        hypothesisEvidenceLinksAfter: after.map((l: Json) => `${l.hypothesis_status}/${l.memory_type}:${l.memory_status}`),
        activeHypothesesOverNonActiveEvidence: new Set(after.filter((l: Json) => l.hypothesis_status === 'ACTIVE' && l.memory_status !== 'ACTIVE').map((l: Json) => l.hypothesis_id)).size };
    }
    const third = turns.filter((t) => t.measure.thirdParty);
    if (third.length) y.thirdParty = { thirdPartyStatements: third.length, storedAsUserMemory: third.filter((t) => t.newMemories.length > 0).length,
      perStatement: third.map((t) => ({ step: t.stepId, explicitRemember: Boolean(t.measure.explicitRemember), storedTypes: t.thirdPartyStoredAsUserMemory })),
      selfStatementsStored: count((t) => (t.measure.selfRelation || t.measure.selfPreferenceMentioningOther) && t.newMemories.length > 0) };
    const him = turns.filter((t) => t.measure.himProbe);
    if (him.length) y.him = him.map((t) => ({ step: t.stepId, coverageState: t.humanIntelligence?.coverageState ?? null, knownMetrics: t.humanIntelligence?.knownMetrics ?? [], behavioralInstructionIds: t.humanIntelligence?.behavioralInstructionIds ?? [] }));
    const triggers = turns.filter((t) => t.measure.triggerProbe);
    if (triggers.length) y.triggers = triggers.map((t) => ({ step: t.stepId, probe: t.measure.triggerProbe, classifier: t.triggerClassifier, semanticChain: t.semanticChain, execution: t.execution, newHypotheses: t.newHypotheses, providerDoubleCalls: t.providerDoubleCalls }));
    y.background = { turns: turns.length, executions: turns.reduce((acc: Json, t: Json) => ({ ...acc, [t.execution]: (acc[t.execution] ?? 0) + 1 }), {}),
      newMemories: turns.reduce((n: number, t: Json) => n + t.newMemories.length, 0), newHypotheses: turns.reduce((n: number, t: Json) => n + t.newHypotheses, 0),
      foregroundErrors: turns.filter((t) => t.foregroundError).map((t) => ({ step: t.stepId, error: t.foregroundError })) };
    return y;
  }

  const out: Json = { scenarios: {}, controls: {}, census: {} };
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort();
  let controlsFixture: Json = null;
  let failures = 0;
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));
    if (fixture.scenario === 'CONTROLS') { controlsFixture = fixture; continue; }
    if (only && only !== fixture.scenario) continue;
    const turns: Json[] = []; const links: Record<string, Json[]> = {};
    try {
      for (const step of fixture.steps) {
        if (step.kind === 'session') await newSession(step.user, step.session);
        else if (step.kind === 'turn') turns.push(await turn(step));
        else if (step.kind === 'hypothesis_links') links[step.label] = await db.observer<Json>(LINKS_SQL, [await user(step.user)]);
        else if (step.kind === 'him_seed') {
          const userId = await user(step.user); const sessionId = sessions.get(`${step.user}:${step.session}`);
          if (step.metric !== 'hse.stress') throw new Error(`him_seed metric ${step.metric} not supported by this harness`);
          await db.setAuthenticatedClaims(userId);
          const [obs] = await db.asRole<Json>('authenticated', "SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION', $1, $2, NULL)", [sessionId, step.responseCode]);
          await db.asRole<Json>('authenticated', 'SELECT * FROM public.calculate_hse_stress_measurement($1)', [obs.id]);
          await db.clearAuthenticatedClaims();
        } else throw new Error(`unknown step kind ${step.kind}`);
      }
      const labels = [...new Set(fixture.steps.map((s: Json) => s.user).filter(Boolean))] as string[];
      const finals: Record<string, Json> = {};
      for (const label of labels) finals[label] = await finalState(label);
      out.scenarios[fixture.scenario] = { title: fixture.title, purpose: fixture.purpose, fixture: file, status: 'RUN', yields: yields(turns, finals, links), turns, finalState: finals,
        ...(Object.keys(links).length ? { hypothesisEvidenceLinks: links } : {}) };
      console.log(`[ci-01 driver] SCENARIO ${fixture.scenario} RUN (${turns.length} turns)`);
    } catch (e) {
      failures += 1;
      out.scenarios[fixture.scenario] = { title: fixture.title, fixture: file, status: 'HARNESS_FAILURE', error: (e as Error).message, stack: (e as Error).stack?.split('\n').slice(0, 8), turns };
      console.log(`[ci-01 driver] SCENARIO ${fixture.scenario} HARNESS_FAILURE ${(e as Error).message}`);
    }
  }

  // ---- controls -----------------------------------------------------------------------------------------
  if (controlsFixture && (!only || only === 'CONTROLS')) {
    // Isolation (CI-01-L1), two-sided and non-vacuous: for each target, the OWNER reads its own rows through the
    // production RLS path (authenticated role + its own claims) and must see exactly the ground truth (observer count,
    // > 0); a NON-OWNER reads through the same path by user_id, by the target's row ids and unfiltered, and must see
    // nothing. Retrieval is measured the same way on both sides. A zero for the non-owner only counts when the owner
    // positively sees the same rows.
    const iso = controlsFixture.isolation;
    const targetLabels = [iso.targetUser, iso.hypothesisTargetUser].filter(Boolean) as string[];
    if (targetLabels.every((label) => users.has(label))) {
      const probeId = await user(iso.probeUser);
      const pairs: Json[] = [];
      for (const label of targetLabels) {
        const targetId = users.get(label)!;
        const truthMem = await db.observer<Json>('SELECT id, content FROM public.memories WHERE user_id = $1 ORDER BY id', [targetId]);
        const truthHyp = await db.observer<Json>('SELECT id FROM public.hypotheses WHERE user_id = $1 ORDER BY id', [targetId]);
        await db.setAuthenticatedClaims(targetId);
        const ownMem = await db.asRole<Json>('authenticated', 'SELECT id, content FROM public.memories WHERE user_id = $1 ORDER BY id', [targetId]);
        const ownHyp = await db.asRole<Json>('authenticated', 'SELECT id FROM public.hypotheses WHERE user_id = $1 ORDER BY id', [targetId]);
        const ownRetrieved = label === iso.targetUser ? (await memoryRetriever.retrieve(targetId, TOKEN, iso.retrievalQuery)).length : null;
        await db.clearAuthenticatedClaims();
        await db.setAuthenticatedClaims(probeId);
        const otherMem = await db.asRole<Json>('authenticated', 'SELECT content FROM public.memories WHERE user_id = $1', [targetId]);
        const otherHyp = await db.asRole<Json>('authenticated', 'SELECT statement FROM public.hypotheses WHERE user_id = $1', [targetId]);
        const otherMemById = await db.asRole<Json>('authenticated', 'SELECT content FROM public.memories WHERE id = ANY($1::uuid[])', [truthMem.map((r: Json) => r.id)]);
        const otherHypById = await db.asRole<Json>('authenticated', 'SELECT statement FROM public.hypotheses WHERE id = ANY($1::uuid[])', [truthHyp.map((r: Json) => r.id)]);
        const otherRetrieved = label === iso.targetUser ? (await memoryRetriever.retrieve(probeId, TOKEN, iso.retrievalQuery)).length : null;
        await db.clearAuthenticatedClaims();
        const sameIds = (a: Json[], b: Json[]) => a.length === b.length && a.every((r, i) => r.id === b[i].id);
        pairs.push({
          target: label,
          groundTruthViaObserver: { memories: truthMem.length, hypotheses: truthHyp.length },
          ownerViaRls: { memories: ownMem.length, hypotheses: ownHyp.length, memoryRowsIdenticalToGroundTruth: sameIds(ownMem, truthMem) && ownMem.every((r: Json, i: number) => r.content === truthMem[i].content),
            hypothesisRowsIdenticalToGroundTruth: sameIds(ownHyp, truthHyp), retrievedItems: ownRetrieved },
          nonOwnerViaRls: { memoriesByUserId: otherMem.length, hypothesesByUserId: otherHyp.length, memoriesByRowId: otherMemById.length, hypothesesByRowId: otherHypById.length, retrievedItems: otherRetrieved },
        });
      }
      await db.setAuthenticatedClaims(probeId);
      const [probeTotal] = await db.asRole<Json>('authenticated', 'SELECT (SELECT count(*)::int FROM public.memories) AS memories, (SELECT count(*)::int FROM public.hypotheses) AS hypotheses');
      await db.clearAuthenticatedClaims();
      const [allRows] = await db.observer<Json>('SELECT (SELECT count(*)::int FROM public.memories) AS memories, (SELECT count(*)::int FROM public.hypotheses) AS hypotheses, (SELECT count(DISTINCT user_id)::int FROM public.memories) AS memory_owners');
      const [probeOwn] = await db.observer<Json>('SELECT (SELECT count(*)::int FROM public.memories WHERE user_id = $1) AS memories, (SELECT count(*)::int FROM public.hypotheses WHERE user_id = $1) AS hypotheses', [probeId]);
      const nonVacuous = {
        ownerMemoriesSeen: pairs.some((x) => x.groundTruthViaObserver.memories > 0 && x.ownerViaRls.memories > 0),
        ownerHypothesesSeen: pairs.some((x) => x.groundTruthViaObserver.hypotheses > 0 && x.ownerViaRls.hypotheses > 0),
        ownerRetrievalReturnedItems: pairs.some((x) => (x.ownerViaRls.retrievedItems ?? 0) > 0),
        otherUsersHoldRows: allRows.memories - probeOwn.memories > 0 && allRows.hypotheses - probeOwn.hypotheses > 0,
      };
      const positiveOwnership = pairs.every((x) => x.ownerViaRls.memories === x.groundTruthViaObserver.memories && x.ownerViaRls.hypotheses === x.groundTruthViaObserver.hypotheses
        && x.ownerViaRls.memoryRowsIdenticalToGroundTruth && x.ownerViaRls.hypothesisRowsIdenticalToGroundTruth);
      const negativeCrossUser = pairs.every((x) => x.nonOwnerViaRls.memoriesByUserId === 0 && x.nonOwnerViaRls.hypothesesByUserId === 0
        && x.nonOwnerViaRls.memoriesByRowId === 0 && x.nonOwnerViaRls.hypothesesByRowId === 0 && (x.nonOwnerViaRls.retrievedItems ?? 0) === 0)
        && probeTotal.memories === probeOwn.memories && probeTotal.hypotheses === probeOwn.hypotheses;
      out.controls.isolation = {
        method: 'owner reads its own rows through RLS (authenticated + its own JWT claims) and must equal the observer ground truth; the non-owner probe reads the same rows by user_id, by row id and unfiltered through the same RLS path and must get nothing; retrieval measured on both sides. holds only when every non-vacuity flag is true.',
        probeUser: iso.probeUser, probeUserOwnRows: probeOwn, probeUserTotalVisibleViaRls: probeTotal, allUsersRowsViaObserver: allRows,
        pairs, nonVacuous, positiveOwnership, negativeCrossUser,
        holds: positiveOwnership && negativeCrossUser && Object.values(nonVacuous).every(Boolean),
      };
    } else out.controls.isolation = { skipped: `targets ${targetLabels.join(', ')} did not all run`, holds: false };

    // content corpus: every fixture turn text + every stored Memory content + every hypothesis statement
    const corpus = new Set<string>();
    for (const t of fixtureTexts) if (t.length >= controlsFixture.contentLeakScan.minimumFragmentLength) corpus.add(t);
    for (const r of await db.observer<Json>('SELECT content FROM public.memories')) corpus.add(r.content);
    for (const r of await db.observer<Json>('SELECT statement FROM public.hypotheses')) corpus.add(r.statement);
    const fragments = [...corpus].filter((f) => f.length >= controlsFixture.contentLeakScan.minimumFragmentLength);
    const leaksIn = (texts: string[]) => texts.filter((text) => fragments.some((f) => text.includes(f))).length;
    const arabicIn = (texts: string[]) => texts.filter((text) => /[؀-ۿ]/u.test(text)).length;
    const telemetryStrings = telemetryRecorder.strings();
    out.controls.telemetry = { recordsCaptured: telemetryRecorder.records.length, distinctInstrumentNames: [...new Set(telemetryRecorder.records.map((r) => r.name))].sort(),
      stringsScanned: telemetryStrings.length, corpusFragments: fragments.length, contentLeaks: leaksIn(telemetryStrings), arabicScriptStrings: arabicIn(telemetryStrings),
      holds: leaksIn(telemetryStrings) === 0 };
    out.controls.databaseSurfaces = {};
    for (const surface of controlsFixture.contentLeakScan.databaseSurfaces) {
      const raw = await db.observer<Json>(surface.sql);
      const rows = raw.map((r: Json) => r.t as string);
      const hitsByKey: Record<string, number> = {};
      for (const r of raw) if (r.k && fragments.some((frag) => String(r.t).includes(frag))) hitsByKey[r.k] = (hitsByKey[r.k] ?? 0) + 1;
      out.controls.databaseSurfaces[surface.name] = { rows: rows.length, contentLeaks: leaksIn(rows), arabicScriptRows: arabicIn(rows),
        ...(Object.keys(hitsByKey).length ? { hitsByEffectKey: hitsByKey } : {}),
        ...(surface.verbatimContentByDesign ? { verbatimContentByDesign: surface.verbatimContentByDesign, countedAgainstControls: false } : { countedAgainstControls: true }) };
    }
    const [outbox] = await db.observer<Json>('SELECT count(*)::int AS total, count(*) FILTER (WHERE contains_content) ::int AS with_content, count(*) FILTER (WHERE status = $1)::int AS published FROM public.runtime_event_outbox', ['PUBLISHED']);
    out.controls.outbox = outbox;
    const [ledgerRows] = await db.observer<Json>('SELECT (SELECT count(*)::int FROM public.ai_provider_calls) AS provider_calls, (SELECT count(*)::int FROM public.post_response_intelligence_executions) AS executions, (SELECT count(*)::int FROM public.post_response_intelligence_effects) AS effects');
    out.controls.ledgerShape = { ...ledgerRows, note: 'the conversational router is a double here, so no ai_provider_calls row can exist; the post-response ledger rows carry codes and identifiers only' };
    out.controls.allHold = Boolean(out.controls.isolation.holds) && out.controls.telemetry.holds && outbox.with_content === 0
      && Object.values(out.controls.databaseSurfaces).every((s: Json) => !s.countedAgainstControls || s.contentLeaks === 0);
    out.controls.durableLedgerContent = Object.entries(out.controls.databaseSurfaces).filter(([, s]: [string, Json]) => s.verbatimContentByDesign)
      .map(([name, s]: [string, Json]) => ({ surface: name, rowsWithFixtureContent: s.contentLeaks, byDesign: s.verbatimContentByDesign }));
  }

  out.census = { conversationalRouterCalls: router.calls.length, intentDoubleCalls: intent.calls, candidateDoubleCalls: cand.calls, associationDoubleCalls: assoc.calls,
    authenticatedRpcCensus: authenticatedDataApi.rpcCensus.toJSON(), syntheticUsers: users.size, sessions: sessions.size,
    networkAttemptsBlockedDuringRun: guard.blockedAttempts.length - blockedAfterSelfTest, externalHttp: 'impossible — every transport throws (see networkGuard.selfTest)' };

  const here = dirname(__filename);
  const read = (p: string) => readFileSync(p, 'utf8');
  const versionOf = (name: string): string => JSON.parse(read(join(here, '..', '..', 'node_modules', name, 'package.json'))).version;
  const tooling = {
    node: process.version, pgDriver: versionOf('pg'), tsNode: versionOf('ts-node'), typescript: versionOf('typescript'),
    openTelemetryApi: versionOf('@opentelemetry/api'), postgres: context.cluster.pgVersion,
    driverSha256: sha256(read(__filename)), networkGuardSha256: sha256(read(join(here, 'network-guard.cjs'))), localDbSha256: sha256(read(join(here, 'local-db.mjs'))),
    fixtureSha256: Object.fromEntries(files.map((f) => [f, sha256(read(join(fixturesDir, f)))])),
    command: 'npm run verify:ci-01:intelligence-reality:local  (QANDEEL_CI01_PG_BIN=<PostgreSQL 17 bin dir>)',
  };
  const summary: Json = {};
  for (const [name, s] of Object.entries<Json>(out.scenarios)) summary[name] = s.status === 'RUN' ? { status: 'RUN', ...pickSummary(s.yields) } : { status: s.status, error: s.error };
  const result = {
    record: 'QANDEEL CI-01 C1-B — Synthetic Intelligence Reality Baseline (results)',
    status: failures === 0 ? 'RUN_COMPLETE' : 'RUN_COMPLETE_WITH_HARNESS_FAILURES',
    readThisFirst: [
      'SYNTHETIC fixtures only; no real user, no real conversation, no provider. Every text here is from scripts/ci-01/fixtures.',
      'Run success (this file exists, status RUN) is NOT a capability pass. Yields below record what the deterministic pipeline did, including its defects.',
      'Nothing here is a conversational-quality, naturalness or calibration figure, and nothing predicts what a bound LLM would do (D7).',
      'Defects are recorded, not repaired (C1 contract §0.4, decision 3). Owners stay in the canonical backlog; this file assigns none.',
    ],
    generatedAt: new Date().toISOString(), repository: context.repository, cluster: context.cluster, driverIdentityProof: driverProof,
    networkGuard: { version: guard.version, scrubbedInheritedEnvNames: guard.scrubbedInheritedEnvNames, selfTest }, tooling,
    doubles: ['conversational Model Router (recording; fixed reply)', 'intent / candidate / association hypothesis providers (deterministic, content-free)',
      'CU/Focus/Thread semantic establishment (frozen A2 two-Moment fixture, no Thread)', 'Redis (in-process envelope hand-off from the real outbox publisher)',
      'PostgREST (bounded SQL transport; same role + JWT claims per request; autocommit)', 'OpenTelemetry meter + tracer (recording, for the content-leak control)'],
    summary, controls: out.controls, census: out.census, scenarios: out.scenarios,
  };
  const shareable = portableResultText(result, [[context.cluster.pgBin, '<QANDEEL_CI01_PG_BIN>'], [dirname(expected.dataDir), '<harness-temp-root>']]);
  mkdirSync(dirname(resultsPath), { recursive: true });
  writeFileSync(resultsPath, shareable);
  console.log(`[ci-01 driver] ${result.status}; ${Object.keys(out.scenarios).length} scenario(s); controls hold = ${out.controls.allHold}; results → ${basename(resultsPath)}`);
  await db.close();
  if (failures > 0) process.exitCode = 1;
}

// The committed results file must be shareable: the machine-local PostgreSQL bin directory and the harness-owned
// temporary cluster root are replaced by placeholders at write time, after every identity proof ran on the real paths.
// Any absolute path left over stops the run instead of being published.
function portableResultText(result: Json, replacements: Array<[string, string]>): string {
  const variants = (path: string): string[] => [...new Set([path, path.split('\\').join('/'), path.split('/').join('\\')])];
  const pairs = replacements.flatMap(([path, label]) => variants(path).map((v): [string, string] => [JSON.stringify(v).slice(1, -1), label]))
    .sort((a, b) => b[0].length - a[0].length);
  result.portability = { placeholders: replacements.map(([, label]) => label),
    note: 'machine-local absolute paths are replaced at write time; the identity checks above ran on the real values' };
  const text = pairs.reduce((acc, [from, label]) => acc.split(from).join(label), JSON.stringify(result, null, 1));
  const leak = /(?<![A-Za-z])[A-Za-z]:(?:\\\\|\/)|\/(?:Users|home|tmp|var\/folders)\//u.exec(text);
  if (leak) throw new StopError(`results would publish an absolute local path near: ${text.slice(Math.max(0, leak.index - 40), leak.index + 40)}`);
  return text;
}

function pickSummary(y: Json): Json {
  const s: Json = {};
  if (y.captureYield) s.captureYield = `${y.captureYield.captured}/${y.captureYield.valueStatements}`;
  if (y.factCapture) s.factCapture = `${y.factCapture.captured}/${y.factCapture.factStatements}`;
  if (y.recall) s.recall = `${y.recall.hits}/${y.recall.probes}`;
  if (y.truthMaintenance) s.staleServed = `${y.truthMaintenance.staleServed}/${y.truthMaintenance.staleProbes}`, s.duplicateActiveAtEnd = y.truthMaintenance.duplicateActiveMemoriesAtEnd;
  if (y.forget) s.forgottenServed = `${y.forget.forgottenServed}/${y.forget.forgottenProbes}`, s.hypothesisInjectedAfterForget = y.forget.hypothesisInjectedAfterForget;
  if (y.pg02) s.pg02ActiveHypothesesOverNonActiveEvidence = y.pg02.activeHypothesesOverNonActiveEvidence;
  if (y.thirdParty) s.thirdPartyStoredAsUserMemory = `${y.thirdParty.storedAsUserMemory}/${y.thirdParty.thirdPartyStatements}`;
  if (y.him) s.himCoverage = y.him.map((h: Json) => `${h.step}:${h.coverageState}/${h.knownMetrics.length}known/${h.behavioralInstructionIds.length}instr`);
  if (y.triggers) s.triggers = y.triggers.map((t: Json) => `${t.step}:${t.classifier}→${t.execution}(+${t.newHypotheses}h)`);
  s.newMemories = y.background.newMemories; s.newHypotheses = y.background.newHypotheses; s.foregroundErrors = y.background.foregroundErrors.length;
  return s;
}

main().catch((error) => {
  if (error instanceof StopError) { console.error(error.message); process.exit(3); }
  console.error('QANDEEL_CI01_DRIVER_FATAL', error); process.exit(1);
});
