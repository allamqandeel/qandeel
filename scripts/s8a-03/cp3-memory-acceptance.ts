// S8A-03 CP3 — Focused Real-Model Memory Acceptance driver (operator-only; never a CI step; never imported by production
// code). Launched only by scripts/s8a-03/cp3-launch.mjs, under scripts/s8a-02/network-guard.cjs (round 11).
//
// It drives the fixed, preregistered cases of scripts/s8a-03/cp3-cases.json ONCE through the real Memory path:
//   natural message → DeepSeek Flash capture proposals → deterministic verifier → ONE atomic 0171 write and index →
//   a later, differently worded question in a NEW session → the semantic index read under the user's own token → the
//   served Memory context → the real reply.
//
// REAL (production code, unmodified): ConversationOrchestratorService; MemoryRetrieverService over MemoryRuntimeService
// WITH MemoryRetrievalIndexRepository; MemoryControlService; PostResponseIntelligenceDispatcherService WITH
// PersonalUnderstandingCaptureService; DeepSeekPersonalUnderstandingCaptureProvider and DeepSeekModelRouter on accounted
// clients over the local AI-COST-01 ledger (apps/api/scripts/brain-eval-deepseek-ledger.ts).
// DOUBLES (no paid call): the three Hypothesis providers, and the reply of every turn that is not a graded question.
// TRANSPORT (copied from scripts/ci-01/intelligence-reality.ts, which runs on import and exports nothing): the bounded
// PostgREST substitute, one transaction per request under the request's role and JWT claims. The two 0171 service-role
// commands run through the PRODUCTION methods (BackgroundIntelligenceDataApiService.listUnindexedMemories and
// PostResponseIntelligenceRepository.completeUnderstandingCapture) with only their private transport replaced.
// OBSERVATION only: capture requests / raw proposals / verified commands, the semantic read's rows, the Router request,
// the reply. FIXTURE (declared): C07's filler Memories, indexed under their own words only.
//
// Any failed precondition is a STOP (exit 3) before a provider call. Nothing here retries a call or changes a case.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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
import { MemoryRetrievalIndexRepository } from '../../apps/api/src/memory/memory-retrieval-index.repository';
import { memoryIndexTerms, memoryRetrievalTerms } from '../../apps/api/src/memory/memory-retrieval-terms';
import { normalizeArabicComparison } from '../../apps/api/src/memory/arabic-text';
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
import { BackgroundIntelligenceDataApiService } from '../../apps/api/src/background-intelligence/background-intelligence-data-api.service';
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
import { InteractionPreferencesService } from '../../apps/api/src/interaction-preferences/interaction-preferences.service';
import { InteractionPreferencesRepository } from '../../apps/api/src/interaction-preferences/interaction-preferences.repository';
import { CorrelationService } from '../../apps/api/src/observability/correlation.service';
import { TelemetryService } from '../../apps/api/src/observability/telemetry.service';
import { ModelAssistedHypothesisAssociationService } from '../../apps/api/src/post-response-intelligence/model-assisted-hypothesis-association.service';
import { PostResponseIntelligenceDispatcherService } from '../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service';
import { PostResponseIntelligenceRepository } from '../../apps/api/src/post-response-intelligence/post-response-intelligence.repository';
import { PostResponseProviderBudgetService } from '../../apps/api/src/post-response-intelligence/post-response-provider-budget.service';
import { RuntimeEventPublisher } from '../../apps/api/src/runtime-events/runtime-event.publisher';
import { runWithAiUsageAttribution } from '../../apps/api/src/ai-usage/ai-usage-attribution';
import { accountedDeepSeekChatCompletionsClient } from '../../apps/api/src/ai-usage/accounted-provider-clients';
import { createDeepSeekClient } from '../../apps/api/src/model-router/providers/deepseek/deepseek-client';
import { DeepSeekPersonalUnderstandingCaptureProvider } from '../../apps/api/src/personal-understanding/deepseek-personal-understanding-capture.provider';
import { loadPersonalUnderstandingCaptureDeepSeekConfig } from '../../apps/api/src/personal-understanding/personal-understanding-capture-provider.config';
import { PersonalUnderstandingCaptureService, capturableMessage } from '../../apps/api/src/personal-understanding/personal-understanding-capture.service';
import { verifyFactProposal } from '../../apps/api/src/personal-understanding/personal-understanding-capture.verifier';
import { PgBackgroundIntelligenceDataApiAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-background-intelligence-data.adapter';
import { PgPostResponseIntelligenceRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-post-response-intelligence.adapter';
import { PgRuntimeEventAdminRepositoryAdapter } from '../../apps/api/scripts/a2-e2e-smoke/pg-runtime-event-admin.adapter';
import { establishFinalSemanticChain } from '../../apps/api/scripts/a2-e2e-smoke/final-semantic-chain-fixture';
import { openDeepSeekEvaluationLedger } from '../../apps/api/scripts/brain-eval-deepseek-ledger';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pg: any = require('pg');
type Json = any;
type Role = 'postgres' | 'service_role' | 'authenticated';

const TOKEN = 's8a03-cp3-synthetic-transport-token'; // transport metadata only; identity is the transaction-local JWT claim
const MAX_ATTEMPTS = 41;
const COST_CAP_USD = 0.15;
const DOUBLE_REPLY = 'تمام.';
class StopError extends Error { constructor(message: string) { super(`QANDEEL_CP3_STOP: ${message}`); } }
const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
const fold = (text: string): string => normalizeArabicComparison(String(text ?? ''));
const required = (name: string): string => { const v = process.env[name]?.trim(); if (!v) throw new StopError(`${name} is not set`); return v; };

// ---- PostgREST substitute (from scripts/ci-01/intelligence-reality.ts, unchanged in behaviour) --------------------------
function toTransportRow<T>(row: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) mapped[k] = v instanceof Date ? v.toISOString() : v;
  return mapped as T;
}
class AutoCommitDb {
  private readonly client: any;
  private queue: Promise<unknown> = Promise.resolve();
  private claims = '';
  constructor(config: Record<string, unknown>) { this.client = new pg.Client({ ...config, connectionTimeoutMillis: 10_000 }); }
  open(): Promise<void> { return this.client.connect(); }
  private serialize<T>(work: () => Promise<T>): Promise<T> { const next = this.queue.then(work, work); this.queue = next.then(() => undefined, () => undefined); return next; }
  observer<R = Json>(text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => (await this.client.query(text, values as unknown[])).rows.map((row: Json) => toTransportRow<R>(row)));
  }
  asRole<R = Json>(role: Role, text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      await this.client.query('BEGIN');
      try {
        await this.client.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', this.claims]);
        if (role !== 'postgres') await this.client.query(`SET LOCAL ROLE ${role}`);
        const r = await this.client.query(text, values as unknown[]);
        await this.client.query('COMMIT');
        return r.rows.map((row: Json) => toTransportRow<R>(row));
      } catch (error) { await this.client.query('ROLLBACK'); throw error; }
    });
  }
  setAuthenticatedClaims(userId: string): void { this.claims = JSON.stringify({ sub: userId }); }
  clearAuthenticatedClaims(): void { this.claims = ''; }
  close(): Promise<void> { return this.client.end(); }
}
const READABLE_TABLES = new Set(['conversation_sessions', 'conversation_turns', 'memories', 'hypotheses', 'confidence_evaluations', 'memory_control_commands',
  'interaction_preferences']);
const AUTHENTICATED_RPC_ALLOWLIST = new Set(['pending_memory_clarification_v1', 'create_conversation_session_v1', 'create_user_conversation_turn',
  'pending_memory_subject_clarification_v1', 'pending_memory_correction_subject_clarification_v1',
  'read_him_intelligence_snapshot_v1', 'read_him_contextual_current_intelligence_batch_v1', 'read_him_session_cross_context_foreground_v3',
  'read_him_brain_context_for_turn_v1', 'set_him_session_context_binding_v1', 'hypothesis_evidence_reliance_v1',
  // S8A-03 CP2 (migration 0171): the semantic Memory read, SECURITY INVOKER under the caller's own token.
  'retrieve_personal_memory_candidates_v1']);
const SERVICE_ROLE_RPC_ALLOWLIST = new Set(['server_finalize_memory_control_turn_v2', 'claim_conversation_turn', 'finalize_conversation_turn_v2',
  'fail_conversation_turn', 'select_formal_question_opportunity_v1']);
// S8A-03 CP2 (migration 0171): the two service-role commands of the capture effect, through their production methods.
const CAPTURE_SERVICE_RPC_ALLOWLIST = new Set(['background_unindexed_memories_v1', 'complete_post_response_personal_capture_v1']);
const SCALAR_RPC = new Set(['complete_post_response_personal_capture_v1']);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
const SELECT_LIST = /^[a-z_][a-z0-9_,]*$/u;
function unsupported(detail: string): never { throw new Error(`CP3_UNSUPPORTED_DATA_API_REQUEST:${detail}`); }
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
    if (key === 'select') {
      const embed = ',memory_subject_attributions(subject)';
      const plain = table === 'memories' && value.endsWith(embed) ? value.slice(0, -embed.length) : value;
      if (!SELECT_LIST.test(plain)) unsupported('select');
      columns = plain.split(',').map(identifier).join(', ');
      if (plain !== value) columns += ", (SELECT json_build_object('subject', a.subject) FROM public.memory_subject_attributions a WHERE a.memory_id = memories.id AND a.user_id = memories.user_id) AS memory_subject_attributions";
    } else if (key === 'order') {
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
async function executePostgrest<T>(db: AutoCommitDb, role: Role, allow: ReadonlySet<string>, path: string, init: RequestInit, observe?: (name: string, rows: Json[]) => void): Promise<T> {
  if (path.startsWith('rpc/')) {
    const name = path.slice(4);
    if (!allow.has(name)) unsupported(`rpc:${name}`);
    if ((init.method ?? 'POST') !== 'POST' || typeof init.body !== 'string') unsupported('rpc-method');
    const { text, values } = rpcCall(name, JSON.parse(init.body) as Record<string, unknown>);
    const rows = await db.asRole(role, text, values);
    observe?.(name, rows);
    // PostgREST answers a scalar function with its value, a set-returning one with its rows.
    return (SCALAR_RPC.has(name) ? rows[0]?.[name] : rows) as T;
  }
  if (init.method && init.method !== 'GET') unsupported('table-method');
  const q = path.indexOf('?');
  const { text, values } = translateTableRead(identifier(q === -1 ? path : path.slice(0, q)), q === -1 ? '' : path.slice(q + 1));
  return (await db.asRole(role, text, values)) as T;
}
class PgAuthenticatedDataApiAdapter {
  observe?: (name: string, rows: Json[]) => void;
  constructor(private readonly db: AutoCommitDb) {}
  request<T>(_accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    return executePostgrest<T>(this.db, 'authenticated', AUTHENTICATED_RPC_ALLOWLIST, path, init, this.observe);
  }
}
class PgConversationServiceRoleApiAdapter {
  constructor(private readonly db: AutoCommitDb) {}
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!SERVICE_ROLE_RPC_ALLOWLIST.has(name)) unsupported(`service-role-rpc:${name}`);
    const { text, values } = rpcCall(name, body);
    return (await this.db.asRole('service_role', text, values)) as T;
  }
}
/** The PRODUCTION method, bound to an instance whose only own property is the replaced private transport. */
function productionMethod<T extends object>(prototype: T, transport: (path: string, init: RequestInit) => Promise<unknown>): T {
  return Object.assign(Object.create(prototype), { request: transport }) as T;
}

// ---- doubles and observation ------------------------------------------------------------------------------------------
function unused<T>(name: string): T { return new Proxy({}, { get() { throw new Error(`CP3_UNUSED_DEPENDENCY_${name}`); } }) as unknown as T; }
class SwitchRouter {
  graded = false;
  readonly calls: Array<{ graded: boolean; request: Json; result?: Json; error?: string; ms: number }> = [];
  constructor(private readonly real: { generate(request: Json): Promise<Json> }) {}
  async generate(request: Json): Promise<Json> {
    const started = performance.now();
    const call: Json = { graded: this.graded, request: structuredClone(request), ms: 0 };
    this.calls.push(call);
    try {
      const result = this.graded ? await this.real.generate(request) : { content: DOUBLE_REPLY, routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } };
      call.result = { content: result.content, path: result.routingMetadata?.path ?? null };
      return result;
    } catch (error) { call.error = (error as Error)?.name ?? 'Error'; throw error; } finally { call.ms = Math.round(performance.now() - started); }
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
class IntentDouble { calls = 0; async extract(req: Json): Promise<Json> { this.calls += 1; return { problemText: req.currentUserText, domain: 'GENERAL', selectedEvidenceIds: req.eligibleEvidence.map((e: Json) => e.evidenceId) }; } }
class CandidateDouble { calls = 0; async generate(): Promise<Json[]> { this.calls += 1; return []; } }
class AssociationDouble { calls = 0; async propose(): Promise<Json[]> { this.calls += 1; return []; } }

async function proveIdentity(db: AutoCommitDb, port: number, database: string, dataDir: string): Promise<void> {
  const [row] = await db.observer(`SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS db,
    current_setting('server_version_num') AS version, current_setting('data_directory') AS dir`);
  const norm = (p: unknown) => String(p).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
  if (row.addr !== '127.0.0.1' || Number(row.port) !== port || row.db !== database || !String(row.version).startsWith('17') || norm(row.dir) !== norm(dataDir)) {
    throw new StopError('the database is not the disposable local cluster this run started');
  }
}

// ---- main ---------------------------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const guard = (globalThis as Json).__QANDEEL_DEEPSEEK_EVAL_GUARD__;
  if (!guard) throw new StopError('the spend / network guard is not preloaded');
  if (guard.round !== 11 || guard.maxAttempts !== MAX_ATTEMPTS || guard.costCapUsd !== COST_CAP_USD) {
    if (!(guard.simulated && guard.round === 11)) throw new StopError(`guard round ${guard.round} with ${guard.maxAttempts} / ${guard.costCapUsd} is not round 11 (41, USD 0.15)`);
  }
  const selfTest = await guard.selfTest();
  if (!selfTest.allBlocked) throw new StopError(`guard self-test did not block every transport: ${JSON.stringify(selfTest.results)}`);
  const casesFile = required('QANDEEL_CP3_CASES_FILE');
  const suite = JSON.parse(readFileSync(casesFile, 'utf8'));
  // The canonical hash (the parsed content), the one PREREGISTRATION_CP3.md records: a line-ending conversion cannot move it.
  const casesSha256 = sha256(JSON.stringify(suite));
  if (casesSha256 !== required('QANDEEL_CP3_CASES_SHA256')) throw new StopError('the case file is not the preregistered one');
  const resultsPath = required('QANDEEL_CP3_RESULTS_PATH');
  const mode = guard.dry ? 'DRY' : guard.simulated ? 'SIMULATED' : 'LIVE';

  // The SYNTHETIC_ONLY gate and the Flash selection are checked here, before any provider exists.
  const captureConfig = loadPersonalUnderstandingCaptureDeepSeekConfig(process.env);
  const ledger = await openDeepSeekEvaluationLedger(process.env);
  const port = Number(required('QANDEEL_EVAL_LEDGER_DB_PORT'));
  const database = required('QANDEEL_EVAL_LEDGER_DB_NAME');
  const db = new AutoCommitDb({ host: '127.0.0.1', port, database, user: 'postgres', password: required('QANDEEL_EVAL_LEDGER_DB_PASSWORD') });
  await db.open();
  await proveIdentity(db, port, database, required('QANDEEL_EVAL_LEDGER_DB_DATA_DIR'));
  console.log(`[s8a-03 cp3] ${mode}: cluster ${database} @ 127.0.0.1:${port}; guard round ${guard.round} (${guard.maxAttempts} attempts, USD ${guard.costCapUsd}); self-test blocked ${selfTest.results.length}/${selfTest.results.length}`);

  // ---- composition (CI-01's, plus the capture stage and the semantic index read) ---------------------------------------
  const adb = db as Json;
  const api = new PgAuthenticatedDataApiAdapter(db);
  const serviceRoleApi = new PgConversationServiceRoleApiAdapter(db) as Json;
  const correlation = new CorrelationService();
  const telemetry = new TelemetryService(correlation);
  const conversationRepository = new ConversationRepository(api as Json, serviceRoleApi, correlation);
  const memoryRuntime = new MemoryRuntimeService(new MemoryRepository(api as Json), new MemoryRetrievalIndexRepository(api as Json));
  const memoryRetriever = new MemoryRetrieverService(memoryRuntime);
  const evidenceService = new EvidenceService(memoryRuntime);
  const himRepository = new HimRepository(api as Json);
  const stress = new HimSituationStressConsumptionService(new HimSituationStressRepository(api as Json));
  const decision = new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(api as Json));
  const goal = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(api as Json));
  const relation = new HimRelationshipCommunicationConsumptionService(new HimRelationshipCommunicationRepository(api as Json));
  const cross = new HimCrossContextForegroundAggregationService(new HimCrossContextForegroundRepository(api as Json), stress, decision, goal, relation);
  const hypothesisService = new HypothesisService(new HypothesisRepository(api as Json, unused('HYPOTHESIS_SERVICE_ROLE')), evidenceService);
  const reasoning = new HypothesisReasoningContextService(hypothesisService, evidenceService, new ConfidenceRepository(api as Json));
  const router = new SwitchRouter(ledger.router as Json);
  const orchestrator = new ConversationOrchestratorService(
    conversationRepository, new ContextBuilderService(conversationRepository), new SafetyResponseGateService(), new BehavioralResponsePolicyService(),
    new HimTurnContextSelectionService(), new HimIntelligenceSnapshotService(himRepository), new HimReasoningConsumptionService(),
    new HimFastDeepConsumptionService(), new HimInteractionAdaptationService(), new HimContextualCurrentIntelligenceService(himRepository),
    new HimSessionReflectionConsumptionService(), cross, new HimBrainContextService(new HimBrainContextRepository(api as Json)),
    new BoundedForegroundIntelligenceGathererService(memoryRetriever, reasoning, correlation, telemetry),
    new QuestionForegroundSelectionService(serviceRoleApi, correlation, telemetry),
    new IntegratedContextBudgetAssemblerService(telemetry), new RecommendationGroundingService(),
    router as Json, correlation, telemetry,
    new MemoryControlService(new MemoryControlRepository(api as Json), new MemoryWriteEvaluatorService()),
    new InteractionPreferencesService(new InteractionPreferencesRepository(api as Json)));
  const transport = new InProcessTransport();
  const publisher = new RuntimeEventPublisher(new PgRuntimeEventAdminRepositoryAdapter(adb) as Json, transport as Json, telemetry);
  const captureRpc = (path: string, init: RequestInit) => executePostgrest(db, 'service_role', CAPTURE_SERVICE_RPC_ALLOWLIST, path, init);
  const productionData = productionMethod(BackgroundIntelligenceDataApiService.prototype, captureRpc);
  const productionLedger = productionMethod(PostResponseIntelligenceRepository.prototype, captureRpc);
  const dataApi = new PgBackgroundIntelligenceDataApiAdapter(adb) as Json;
  dataApi.listUnindexedMemories = (context: Json, limit: number) => productionData.listUnindexedMemories(context, limit);
  const effectLedger = new PgPostResponseIntelligenceRepositoryAdapter(adb) as Json;
  effectLedger.completeUnderstandingCapture = (id: string, command: Json) => productionLedger.completeUnderstandingCapture(id, command);
  const authority = new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), dataApi);
  const enrichment = new BackgroundIntelligenceEnrichmentService(dataApi, new MemoryWriteEvaluatorService(),
    new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService());
  const captureLog: Json[] = [];
  const realCapture = new DeepSeekPersonalUnderstandingCaptureProvider(captureConfig,
    accountedDeepSeekChatCompletionsClient(createDeepSeekClient(captureConfig), 'PERSONAL_UNDERSTANDING_CAPTURE', ledger.accounting));
  const recordingCapture = {
    async capture(request: Json): Promise<Json> {
      const entry: Json = { request: structuredClone(request), ms: 0 }; captureLog.push(entry);
      const started = performance.now();
      try { entry.output = await realCapture.capture(request as Json); return entry.output; }
      catch (error) { entry.error = (error as Json)?.code ?? (error as Error)?.name ?? 'Error'; throw error; }
      finally { entry.ms = Math.round(performance.now() - started); }
    },
  };
  const understanding = new PersonalUnderstandingCaptureService(enrichment, recordingCapture as Json);
  const propose = understanding.propose.bind(understanding);
  const commandLog: Json[] = [];
  understanding.propose = async (plan: Json, now?: Date) => { const command = await propose(plan, now); commandLog.push({ plan: structuredClone(plan), command: structuredClone(command) }); return command; };
  const intent = new IntentDouble(); const cand = new CandidateDouble(); const assoc = new AssociationDouble();
  const association = new ModelAssistedHypothesisAssociationService(enrichment,
    new HypothesisEvidenceAssociationAuthorityService(unused('EVIDENCE'), unused('HYPOTHESIS')), authority, assoc as Json);
  const dispatcher = new PostResponseIntelligenceDispatcherService(effectLedger, authority, enrichment,
    new HypothesisGenerationIntentExtractionService(intent as Json, new HypothesisGenerationIntentAuthorityService()),
    new HypothesisGenerationRequestAssemblerService(), cand as Json, association, new PostResponseProviderBudgetService(), telemetry, understanding);

  // ---- reads used by the record (observer role) ----------------------------------------------------------------------
  const memoriesOf = (userId: string) => db.observer(`SELECT m.id, m.type, m.content, m.source, m.status, m.confidence, m.updated_at,
      coalesce(a.subject, 'UNATTRIBUTED') AS subject, p.semantic_indexed, p.slot, p.temporal,
      (SELECT count(*)::int FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id) AS terms
    FROM public.memories m LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
    LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id WHERE m.user_id = $1 ORDER BY m.created_at, m.id`, [userId]);
  const recent32 = async (userId: string) => (await db.observer(`SELECT id FROM public.memories WHERE user_id = $1 AND status = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > now()) ORDER BY updated_at DESC, id DESC LIMIT 32`, [userId])).map((r: Json) => r.id);
  const attempts = () => (guard.dry ? 0 : guard.spend.attempts.length);

  // C07's declared fixture: synthetic filler Memories written by the canonical server writer AFTER the squash Memory, so it
  // falls outside the recent 32; each is indexed under its own words only (never a model key), so none reaches the backfill.
  async function insertFillers(userId: string): Promise<void> {
    for (const content of suite.fillers as string[]) {
      const id = randomUUID();
      await db.observer("SELECT id FROM public.server_create_memory_v1($1, $2, 'PERSONAL_FACT', $3, 'USER_STATED', 0.80, 0.5, 'ACTIVE', NULL)", [userId, id, content]);
      await db.observer("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, 'SELF', 'EXPLICIT_STATEMENT')", [id, userId]);
      await db.observer("INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, temporal) VALUES ($1, $2, true, 'CURRENT')", [id, userId]);
      for (const term of memoryIndexTerms(content, [])) {
        await db.observer('INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, userId, term]);
      }
    }
  }

  async function turn(userId: string, sessionId: string, step: Json): Promise<Json> {
    const rec: Json = { text: step.text, session: step.session, question: Boolean(step.question), graded: Boolean(step.graded), control: step.control ?? null,
      sentToCapture: capturableMessage(step.text) !== null, questionTerms: memoryRetrievalTerms(step.text) };
    const before = { attempts: attempts(), capture: captureLog.length, command: commandLog.length, router: router.calls.length, memories: (await memoriesOf(userId)).length };
    rec.recent32 = await recent32(userId);
    const semanticRows: Json[] = [];
    api.observe = (name, rows) => { if (name === 'retrieve_personal_memory_candidates_v1') semanticRows.push(...rows.map((r: Json) => ({ id: r.id, user_id: r.user_id, content: r.content, hits: r.hits, slot: r.slot, unsettled: r.unsettled }))); };
    const started = performance.now();
    db.setAuthenticatedClaims(userId);
    const turnRow: Json = await conversationRepository.createTurn(TOKEN, { id: randomUUID(), sessionId, userId, content: step.text });
    router.graded = rec.graded;
    let result: Json;
    try { result = await runWithAiUsageAttribution({ userId }, () => correlation.runRequest(() => orchestrator.orchestrate(TOKEN, userId, turnRow))); }
    catch (e) { rec.foregroundError = (e as Error).message; }
    router.graded = false;
    api.observe = undefined;
    rec.foregroundMs = Math.round(performance.now() - started);
    const call = router.calls.length > before.router ? router.calls[router.calls.length - 1] : undefined;
    rec.router = call ? { graded: call.graded, path: call.request.path, ms: call.ms, error: call.error ?? null } : null;
    rec.served = call?.request?.memoryContext ?? [];
    rec.reply = call?.result?.content ?? result?.assistantTurn?.content ?? null;
    rec.semanticRows = semanticRows;
    if (result?.assistantTurn) {
      await establishFinalSemanticChain(adb, { sessionId, userId, userTurnId: turnRow.id, userText: result.userTurn.content,
        assistantTurnId: result.assistantTurn.id, assistantText: result.assistantTurn.content });
    }
    db.clearAuthenticatedClaims();
    await publisher.processOnce();
    rec.dispatch = [];
    for (const envelope of transport.drain()) {
      try { rec.dispatch.push(await runWithAiUsageAttribution({ userId }, () => dispatcher.dispatch(JSON.stringify(envelope)))); }
      catch (e) { rec.dispatch.push(`ERR ${(e as Error).message}`); }
    }
    const [exec] = await db.observer('SELECT id, state, outcome_code, current_stage FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [turnRow.id]);
    rec.execution = exec ? `${exec.state}/${exec.outcome_code ?? '-'}/${exec.current_stage ?? '-'}` : 'NONE';
    rec.effects = exec ? (await db.observer('SELECT effect_key, state, result_code FROM public.post_response_intelligence_effects WHERE execution_id = $1 ORDER BY effect_key', [exec.id]))
      .map((r: Json) => `${r.effect_key}:${r.state}:${r.result_code ?? '-'}`) : [];
    const [command] = await db.observer('SELECT kind, outcome FROM public.memory_control_commands WHERE source_turn_id = $1', [turnRow.id]);
    rec.memoryControlCommand = command ? `${command.kind}/${command.outcome}` : 'NONE';
    rec.capture = captureLog.slice(before.capture).map((entry: Json) => ({ ...entry,
      verdicts: (entry.output?.facts ?? []).map((fact: Json) => {
        const v = entry.request.currentUserText === null ? { rejected: 'NO_MESSAGE' } : verifyFactProposal(fact, entry.request.currentUserText, new Date());
        return { span: fact.span, subject: fact.subject, polarity: fact.polarity, modality: fact.modality, temporal: fact.temporal, type: fact.type, slot: fact.slot, keys: fact.keys,
          verdict: 'kept' in v ? 'KEPT' : v.rejected };
      }) }));
    rec.commands = commandLog.slice(before.command).map((c: Json) => ({ items: c.command.items.map((i: Json) => ({ content: i.content, type: i.type, slot: i.slot, temporal: i.temporal, terms: i.terms })),
      index: c.command.index.map((i: Json) => ({ memoryId: i.memoryId, slot: i.slot, temporal: i.temporal, terms: i.terms })) }));
    const after = await memoriesOf(userId);
    rec.newMemories = after.slice(before.memories).map((m: Json) => ({ id: m.id, type: m.type, content: m.content, source: m.source, confidence: m.confidence, subject: m.subject }));
    rec.memoriesAfter = after.map((m: Json) => ({ id: m.id, type: m.type, content: m.content, status: m.status, subject: m.subject, confidence: m.confidence,
      semanticIndexed: m.semantic_indexed, slot: m.slot, temporal: m.temporal, terms: m.terms }));
    rec.providerAttempts = attempts() - before.attempts;
    rec.attemptDetail = guard.dry ? [] : guard.spend.attempts.slice(before.attempts).map((a: Json) => ({ n: a.n, maxTokens: a.maxTokens, requestBytes: a.requestBytes,
      worstCaseUsd: a.worstCaseUsd, peakUsd: a.peakUsd ?? null, applicableUsd: a.applicableUsd ?? null, headersMs: a.headersMs ?? null, bodyMs: a.bodyMs ?? null,
      finishReason: a.finishReason ?? null, httpStatus: a.httpStatus ?? null, transportError: a.transportError ?? null, usage: a.usage ?? null }));
    rec.totalMs = Math.round(performance.now() - started);
    return rec;
  }

  // ---- the fixed cases, once each ------------------------------------------------------------------------------------
  const records: Json[] = [];
  for (const kase of suite.cases) {
    const userId = randomUUID();
    await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
    const sessions = new Map<string, string>();
    const rec: Json = { id: kase.id, userId, turns: [] };
    for (const step of kase.turns) {
      if (!sessions.has(step.session)) {
        const sessionId = randomUUID();
        db.setAuthenticatedClaims(userId);
        const s: Json = await conversationRepository.createSession(TOKEN, sessionId);
        db.clearAuthenticatedClaims();
        if (s?.status !== 'ACTIVE') throw new StopError(`session not ACTIVE for ${kase.id}`);
        sessions.set(step.session, sessionId);
      }
      if (attempts() >= MAX_ATTEMPTS && !guard.dry) console.log(`[s8a-03 cp3] attempt cap reached before ${kase.id}; the guard refuses every further call`);
      rec.turns.push(await turn(userId, sessions.get(step.session)!, step));
      if (step.fixtureAfter === 'FILLERS') { await insertFillers(userId); rec.fixture = { fillers: suite.fillers.length }; }
    }
    rec.ledgerRows = guard.dry ? [] : await ledger.ledgerRowsFor(userId);
    records.push(rec);
    console.log(`[s8a-03 cp3] ${kase.id}: ${rec.turns.length} turns, provider attempts ${rec.turns.reduce((n: number, t: Json) => n + t.providerAttempts, 0)} (total ${attempts()})`);
  }

  // ---- isolation and permission probes (no provider call) --------------------------------------------------------------
  const probes: Json = {};
  const userOf = (id: string) => records.find((r) => r.id === id)?.userId;
  try { await api.request(TOKEN, 'rpc/complete_post_response_personal_capture_v1', { method: 'POST', body: '{}' }); probes.authenticatedCannotCallTheCaptureCommand = false; }
  catch (e) { probes.authenticatedCannotCallTheCaptureCommand = /CP3_UNSUPPORTED_DATA_API_REQUEST:rpc:/u.test((e as Error).message); }
  try { await db.asRole('authenticated', 'SELECT * FROM public.background_unindexed_memories_v1($1::uuid, 4)', [randomUUID()]); probes.grantRefusesTheBackfillReadToAuthenticated = false; }
  catch (e) { probes.grantRefusesTheBackfillReadToAuthenticated = (e as Json)?.code === '42501'; }
  db.setAuthenticatedClaims(userOf('C01')!);
  const foreign = await executePostgrest<Json[]>(db, 'authenticated', AUTHENTICATED_RPC_ALLOWLIST, 'rpc/retrieve_personal_memory_candidates_v1',
    { method: 'POST', body: JSON.stringify({ p_terms: memoryRetrievalTerms('أنا ساكن في طنطا'), p_limit: 32 }) });
  db.clearAuthenticatedClaims();
  probes.anotherUsersMemoryIsNeverReturned = foreign.every((row: Json) => row.user_id === userOf('C01'));

  const grading = grade(suite, records, guard);
  const output = {
    suite: suite.suite, mode, head: process.env.QANDEEL_EVAL_GIT_HEAD ?? null, casesSha256,
    preregistrationSha256: process.env.QANDEEL_CP3_PREREG_SHA256 ?? null, startedAt: new Date().toISOString(),
    guard: { round: guard.round, maxAttempts: guard.maxAttempts, costCapUsd: guard.costCapUsd, dry: guard.dry, simulated: guard.simulated,
      attempts: attempts(), spentPeakUsd: guard.dry ? 0 : guard.spend.spentPeakUsd, spentApplicableUsd: guard.dry ? 0 : guard.spend.spentApplicableUsd,
      refused: guard.run.blocked.slice(selfTest.blockedBySelfTest) },
    simulatedStub: (globalThis as Json).__QANDEEL_SIMULATED_DEEPSEEK__?.counts ?? null,
    probes, grading, records,
  };
  mkdirSync(dirname(resultsPath), { recursive: true });
  writeFileSync(resultsPath, JSON.stringify(output, null, 1));
  console.log(JSON.stringify({ mode, attempts: output.guard.attempts, spentPeakUsd: output.guard.spentPeakUsd, refused: output.guard.refused.length, probes, summary: grading.summary }, null, 1));
  console.log(`[s8a-03 cp3] results → ${resultsPath}`);
  await db.close(); await ledger.close();
}

// ---- preregistered grading (PREREGISTRATION_CP3.md §4-§5) ----------------------------------------------------------------
// Automated, from the fixed lists of scripts/s8a-03/cp3-cases.json. A forbidden word is an automatic critical breach only
// when nothing around it qualifies it; when the same text also names another person («أخويا», «أختك»…) or marks the past or
// a negation («زمان», «كنت», «مبقتش», «مش»…), it is listed under `review` for the written note per case (PREREGISTRATION §5:
// a case the lists cannot decide is INCONCLUSIVE, never rerun). H1 (an invented detail) is decided by the written notes only.
const NEGATION = /(?:^|\s)(?:و?مش|لا|ما|مبق\S*|لم|لست|عمري\s+ما)(?:\s|$)|م\S+ش(?:\s|$)/u;
const OTHER_PERSON = /^(?:[وفب]?)(?:اخو\S*|اخت\S*|اخ|ابو\S*|ابوي|ام|امي|امك|امه|مرات\S*|جوز\S*|صاحب\S*|زميل\S*|بنت\S*|ابن\S*|ولاد\S*)$/u;
const PAST = new Set(['زمان', 'كنت', 'كان', 'كانت', 'قبل', 'سابقا', 'الماضي', 'قديم', 'مبقتش', 'مبقاش', 'مبقيتش']);
function qualified(foldedText: string): boolean {
  const words = foldedText.split(/[\s\p{P}]+/u).filter(Boolean);
  return NEGATION.test(foldedText) || words.some((w) => OTHER_PERSON.test(w) || PAST.has(w));
}
type Hard = Record<'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6', string[]>;
function grade(suite: Json, records: Json[], guard: Json): Json {
  const findings: Json[] = [];
  const hard: Hard = { H1: [], H2: [], H3: [], H4: [], H5: [], H6: [] };
  const review: string[] = [];
  const breach = (criterion: keyof Hard, foldedText: string, line: string) => (qualified(foldedText) ? review.push(`${criterion}? ${line}`) : hard[criterion].push(line));
  let keyPass = 0; let keyTotal = 0; let retrievalPass = 0; let retrievalEligible = 0; let retrievalTotal = 0; let replyPass = 0; let replyReview = 0; let replyTotal = 0; let c07 = 'NOT_RUN';
  for (const kase of suite.cases) {
    const rec = records.find((r) => r.id === kase.id);
    if (!rec) continue;
    const finalMemories: Json[] = rec.turns.at(-1)?.memoriesAfter ?? [];
    const own = (m: Json) => m.status === 'ACTIVE' && m.subject !== 'OTHER';
    const f: Json = { id: kase.id, keyFacts: [], retrieval: [], reply: null };
    for (const kf of kase.keyFacts ?? []) {
      keyTotal += 1;
      const snapshot: Json[] = kf.beforeTurn !== undefined ? rec.turns[kf.beforeTurn - 1]?.memoriesAfter ?? [] : finalMemories;
      const match = snapshot.find((m) => own(m) && fold(m.content).includes(fold(kf.token)) && (!kf.negated || NEGATION.test(fold(m.content))) && m.temporal !== 'PAST');
      const proposed = rec.turns.flatMap((t: Json) => t.capture).flatMap((c: Json) => c.verdicts).filter((v: Json) => fold(v.span).includes(fold(kf.token)));
      const fault = match ? null : !rec.turns.some((t: Json) => t.sentToCapture && fold(t.text).includes(fold(kf.token))) ? 'PRE-SCREEN'
        : proposed.length === 0 ? 'MODEL' : `VERIFIER(${[...new Set(proposed.map((v: Json) => v.verdict))].join(',')})`;
      if (match) keyPass += 1;
      f.keyFacts.push({ token: kf.token, pass: Boolean(match), memory: match?.content ?? null, source: match?.source ?? null, subject: match?.subject ?? null, fault });
    }
    for (const token of kase.forbiddenSelf ?? []) for (const m of finalMemories) {
      if (own(m) && fold(m.content).includes(fold(token))) breach('H2', fold(m.content), `${kase.id} Memory (${m.subject}): ${m.content}`);
    }
    for (const token of kase.forbiddenAffirmed ?? []) for (const m of finalMemories) {
      if (m.status === 'ACTIVE' && fold(m.content).includes(fold(token)) && !NEGATION.test(fold(m.content))) hard.H5.push(`${kase.id} Memory: ${m.content}`);
    }
    for (const rule of kase.forbiddenCurrent ?? []) for (const m of finalMemories) {
      if (m.status === 'ACTIVE' && fold(m.content).includes(fold(rule.token)) && !rule.allowTypes.includes(m.type) && !rule.allowTemporals.includes(m.temporal)) {
        breach(kase.id === 'C14' ? 'H3' : 'H4', fold(m.content), `${kase.id} Memory: ${m.content} (${m.type}/${m.temporal ?? '-'})`);
      }
    }
    if (kase.expectNoMemory && finalMemories.length > 0) hard.H4.push(`${kase.id}: ${finalMemories.map((m) => m.content).join(' | ')}`);
    rec.turns.forEach((t: Json) => { if (t.question && t.newMemories.length > 0) hard.H4.push(`${kase.id} question «${t.text}»: ${t.newMemories.map((m: Json) => m.content).join(' | ')}`); });
    for (const t of rec.turns) {
      for (const row of t.semanticRows) if (row.user_id !== rec.userId) hard.H6.push(`${kase.id}: a foreign row was returned`);
      const ownContents = new Set((t.memoriesAfter as Json[]).map((m) => m.content));
      for (const item of t.served) if (!ownContents.has(item.content)) hard.H6.push(`${kase.id}: a served item is not the user's own Memory`);
    }
    for (const check of kase.retrieval ?? []) {
      const t = rec.turns[check.turn];
      const served = (t?.served ?? []).map((s: Json) => fold(s.content));
      for (const token of check.mustNotServe ?? []) for (const s of served) {
        if (s.includes(fold(token))) breach(kase.id === 'C10' || kase.id === 'C11' ? 'H3' : 'H2', s, `${kase.id} served «${token}»: ${s}`);
      }
      if (check.targets.length === 0) continue;
      retrievalTotal += 1;
      const before: Json[] = rec.turns[check.turn - 1]?.memoriesAfter ?? [];
      const targets = check.targets.map((token: string) => {
        const memory = before.find((m) => own(m) && fold(m.content).includes(fold(token)));
        const indexHit = (t?.semanticRows ?? []).some((r: Json) => fold(r.content).includes(fold(token)));
        const isServed = served.some((s: string) => s.includes(fold(token)));
        const outside = memory ? !(t?.recent32 ?? []).includes(memory.id) : null;
        return { token, exists: Boolean(memory), indexHit, served: isServed, outsideRecent32: outside };
      });
      const eligible = targets.every((x: Json) => x.exists);
      const pass = eligible && targets.every((x: Json) => x.indexHit && x.served && (!check.outsideRecent32 || x.outsideRecent32 === true));
      const fault = !eligible ? 'EXTRACTION (target Memory missing)' : pass ? null
        : targets.some((x: Json) => !x.indexHit) ? 'INDEX' : check.outsideRecent32 && targets.some((x: Json) => x.outsideRecent32 !== true) ? 'FIXTURE (inside the recent 32)' : 'RETRIEVAL';
      if (eligible) retrievalEligible += 1;
      if (pass) retrievalPass += 1;
      if (check.mandatory) c07 = pass ? 'PASS' : eligible ? 'FAIL' : 'NOT_ELIGIBLE';
      f.retrieval.push({ turn: check.turn, question: t?.text, targets, pass, fault, servedItems: t?.served?.length ?? 0,
        unsettled: (t?.served ?? []).filter((s: Json) => s.standing === 'UNSETTLED').length });
    }
    if (kase.reply) {
      replyTotal += 1;
      const t = rec.turns[kase.reply.turn];
      const text = fold(t?.reply ?? '');
      const graded = t?.router?.graded === true && !t?.router?.error;
      const missing = kase.reply.mustInclude.filter((group: string[]) => !group.some((token) => text.includes(fold(token))));
      const forbidden = kase.reply.mustNot.filter((token: string) => text.includes(fold(token)));
      const criterion: keyof Hard | null = kase.id === 'C10' || kase.id === 'C11' ? 'H3' : kase.id === 'C04' || kase.id === 'C13' ? 'H2' : null;
      if (forbidden.length && criterion) breach(criterion, text, `${kase.id} reply names «${forbidden.join('», «')}»`);
      // A forbidden word in a qualified sentence («وأخوك دكتور أسنان») is neither a pass nor a fail until the written note.
      const pending = graded && missing.length === 0 && forbidden.length > 0 && qualified(text);
      const pass = graded && missing.length === 0 && forbidden.length === 0;
      if (pass) replyPass += 1;
      if (pending) replyReview += 1;
      f.reply = { reply: t?.reply ?? null, graded, missing, forbidden, pass: pending ? 'REVIEW' : pass, review: kase.reply.review ?? null,
        fault: pass || pending ? null : !graded ? 'NOT_GRADED (no real reply)' : 'REPLY or RETRIEVAL (see served)' };
    }
    findings.push(f);
  }
  const attempts = guard.dry ? 0 : guard.spend.attempts.length;
  if (attempts > MAX_ATTEMPTS) hard.H6.push(`attempts ${attempts} > ${MAX_ATTEMPTS}`);
  if (!guard.dry && guard.spend.spentPeakUsd > COST_CAP_USD) hard.H6.push(`spend ${guard.spend.spentPeakUsd} > ${COST_CAP_USD}`);
  const hardClean = Object.values(hard).every((list) => list.length === 0);
  const passed = hardClean && keyPass >= 14 && retrievalPass >= 12 && c07 === 'PASS' && replyPass + replyReview >= 9;
  const summary = {
    H: Object.fromEntries(Object.entries(hard).map(([k, v]) => [k, v.length])), review: review.length,
    P1: `${keyPass}/${keyTotal} (≥ 14)`, P2: `${retrievalPass}/${retrievalTotal}, eligible ${retrievalEligible} (≥ 12 of 13), C07 ${c07}`, P3: `${replyPass}/${replyTotal} certain + ${replyReview} pending review (≥ 9)`,
    automatedVerdict: passed ? 'PASS (pending the written notes: H1 and every review item)' : 'NOT PASSED',
  };
  return { summary, hard, review, findings };
}

main().catch((error) => {
  console.error(error instanceof StopError ? error.message : `QANDEEL_CP3_FATAL: ${(error as Error)?.stack ?? error}`);
  process.exitCode = 3;
});
