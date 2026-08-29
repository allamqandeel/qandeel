// Full Intelligence End-to-End Runtime Smoke v1.
//
// The final Phase II composition proof: QANDEEL's foreground conversational
// intelligence and its durable background intelligence compose as ONE closed
// runtime loop on real PostgreSQL 17 + real Redis 7:
//
//   Foreground Turn #1 → real ConversationOrchestratorService (real
//   ContextBuilder, Safety gate, Behavioral policy, Memory retrieval, HIM
//   snapshot/reasoning/FAST projection, Hypothesis reasoning context,
//   Recommendation grounding, real composeServerGuidance, ONE deterministic
//   conversational ModelRouter call) → canonical claim + finalization →
//   durable TURN_FINALIZED (ConversationTurnCompleted v2) outbox → real
//   RuntimeEventPublisher → real Redis Stream → real RedisPostResponseConsumer
//   → real PostResponseIntelligenceDispatcherService → canonical Memory /
//   Evidence / Hypothesis update / controlled generation + activation /
//   exact-version Confidence / Information Gap synchronization → duplicate
//   delivery no-op proof → Foreground Turn #2 through the SAME real
//   orchestrator consuming the background-created Memory, the session HIM
//   state, both current Hypotheses with exact-current Confidence, and FULL
//   Recommendation grounding coverage — in one more single conversational
//   ModelRouter call.
//
// This verifier adds NO intelligence semantics: every authority, validation,
// mutation, Confidence and Information Gap rule runs through the real
// production services and canonical SECURITY DEFINER commands. Deterministic
// in-process doubles stand in ONLY at the four model/provider transport
// boundaries (one conversational router, three background providers — reused
// from the frozen A2 smoke). The database fixture lives inside one
// BEGIN ... ROLLBACK transaction; Redis uses a unique stream/group deleted in
// finally. No paid provider call is possible: a smoke-only global fetch guard
// throws FULL_INTELLIGENCE_E2E_EXTERNAL_HTTP_FORBIDDEN.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createClient, type RedisClientType } from 'redis';
// Foreground production services (real intelligence semantics).
import { ConversationOrchestratorService } from '../src/conversation/conversation-orchestrator.service';
import { ConversationRepository } from '../src/conversation/conversation.repository';
// QHIA-011A: the production explicit session context activation entry. It is
// used ONCE, deliberately, during fixture setup - never from a turn.
import { ConversationContextActivationService } from '../src/conversation/conversation-context-activation.service';
import { ContextBuilderService } from '../src/conversation/context-builder.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import { BehavioralResponsePolicyService } from '../src/conversation/behavioral-response-policy.service';
import type { SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import { MemoryRetrieverService } from '../src/memory/memory-retriever.service';
import { MemoryRuntimeService } from '../src/memory/memory-runtime.service';
import { MemoryRepository } from '../src/memory/memory.repository';
import type { MemoryDataApiService } from '../src/memory/memory-data-api.service';
import type { MemoryServiceRoleApiService } from '../src/memory/memory-service-role-api.service';
import { EvidenceService } from '../src/memory/evidence.service';
import { HimTurnContextSelectionService } from '../src/human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../src/human-model/him-intelligence-snapshot.service';
import { HimFastDeepConsumptionService } from '../src/human-model/him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from '../src/human-model/him-interaction-adaptation.service';
import { HimContextualCurrentIntelligenceService } from '../src/human-model/him-contextual-current-intelligence.service';
import { HimSessionReflectionConsumptionService } from '../src/human-model/him-session-reflection-consumption.service';
import { HimSituationStressConsumptionService } from '../src/human-model/him-situation-stress-consumption.service';
import { HimSituationStressRepository } from '../src/human-model/him-situation-stress.repository';
import { HimDecisionAttentionConsumptionService } from '../src/human-model/him-decision-attention-consumption.service';
import { HimDecisionAttentionRepository } from '../src/human-model/him-decision-attention.repository';
import { HimGoalMotivationConsumptionService } from '../src/human-model/him-goal-motivation-consumption.service';
import { HimGoalMotivationRepository } from '../src/human-model/him-goal-motivation.repository';
import { HimRelationshipCommunicationConsumptionService } from '../src/human-model/him-relationship-communication-consumption.service';
import { HimRelationshipCommunicationRepository } from '../src/human-model/him-relationship-communication.repository';
import { HimCrossContextForegroundAggregationService } from '../src/human-model/him-cross-context-foreground-aggregation.service';
import { HimCrossContextForegroundRepository } from '../src/human-model/him-cross-context-foreground.repository';
import { HimBrainContextService } from '../src/human-model/him-brain-context.service';
import { HimBrainContextRepository } from '../src/human-model/him-brain-context.repository';
import { HIM_BRAIN_CONTEXT_REGISTRY } from '../src/human-model/him-brain-context.types';
import { HimSessionContextBindingRepository } from '../src/human-model/him-session-context-binding.repository';
import { HimSessionContextBindingService } from '../src/human-model/him-session-context-binding.service';
import { HimRepository } from '../src/human-model/him.repository';
import { HypothesisService } from '../src/hypothesis/hypothesis.service';
import { HypothesisRepository } from '../src/hypothesis/hypothesis.repository';
import type { HypothesisServiceRoleApiService } from '../src/hypothesis/hypothesis-service-role-api.service';
import { ConfidenceRepository } from '../src/hypothesis/confidence.repository';
import { CONFIDENCE_POLICY_VERSION } from '../src/hypothesis/confidence.types';
import { HypothesisReasoningContextService } from '../src/hypothesis/hypothesis-reasoning-context.service';
import { RecommendationGroundingService } from '../src/recommendation/recommendation-grounding.service';
// Background production services (same real classes the frozen A2 smoke runs).
import { BackgroundIntelligenceAuthorityService } from '../src/background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from '../src/background-intelligence/background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService } from '../src/background-intelligence/background-intelligence-data-api.service';
import { BackgroundIntelligenceEnrichmentService } from '../src/background-intelligence/background-intelligence-enrichment.service';
import { HypothesisEvidenceAssociationAuthorityService } from '../src/hypothesis/hypothesis-evidence-association-authority.service';
import { HypothesisGenerationIntentAuthorityService } from '../src/hypothesis/hypothesis-generation-intent-authority.service';
import { HypothesisGenerationIntentExtractionService } from '../src/hypothesis/hypothesis-generation-intent-extraction.service';
import { HypothesisGenerationRequestAssemblerService } from '../src/hypothesis/hypothesis-generation-request-assembler.service';
import { HypothesisGenerationTriggerClassificationService } from '../src/hypothesis/hypothesis-generation-trigger-classification.service';
import { HimReasoningConsumptionService } from '../src/human-model/him-reasoning-consumption.service';
import { MemoryWriteEvaluatorService } from '../src/memory/memory-write-evaluator.service';
import { CorrelationService } from '../src/observability/correlation.service';
import { TelemetryService } from '../src/observability/telemetry.service';
import { ModelAssistedHypothesisAssociationService } from '../src/post-response-intelligence/model-assisted-hypothesis-association.service';
import { PostResponseIntelligenceDispatcherService } from '../src/post-response-intelligence/post-response-intelligence-dispatcher.service';
import type { PostResponseIntelligenceRepository } from '../src/post-response-intelligence/post-response-intelligence.repository';
import { RedisPostResponseConsumer } from '../src/post-response-intelligence/redis-post-response-consumer';
import { RedisStreamsTransport } from '../src/runtime-events/redis-streams.transport';
import type { RuntimeEventAdminRepository } from '../src/runtime-events/runtime-event-admin.repository';
import { RuntimeEventPublisher } from '../src/runtime-events/runtime-event.publisher';
import { isCompletedRuntimeEventV2, type RuntimeEventEnvelope } from '../src/runtime-events/runtime-event.types';
// Reused frozen A2 verification helpers (transport plumbing + provider doubles).
import {
  DeterministicAssociationProposalProvider,
  DeterministicCandidateGenerator,
  DeterministicIntentExtractionProvider,
} from './a2-e2e-smoke/deterministic-providers';
import { PgBackgroundIntelligenceDataApiAdapter } from './a2-e2e-smoke/pg-background-intelligence-data.adapter';
import { PgPostResponseIntelligenceRepositoryAdapter } from './a2-e2e-smoke/pg-post-response-intelligence.adapter';
import { PgRuntimeEventAdminRepositoryAdapter } from './a2-e2e-smoke/pg-runtime-event-admin.adapter';
import { SmokeDbSession } from './a2-e2e-smoke/smoke-db';
// New verifier-only doubles/adapters for the foreground transport boundaries.
import { DeterministicConversationalModelRouter } from './full-intelligence-e2e-smoke/deterministic-conversational-router';
import {
  PgAuthenticatedDataApiAdapter,
  PgConversationServiceRoleApiAdapter,
} from './full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters';

// ---------------------------------------------------------------------------
// External network guard: accidental provider/model HTTP is impossible.
// PostgreSQL (pg) and Redis (node-redis) speak raw sockets and are unaffected.
// No provider API key is read anywhere in this smoke, and the PostgREST
// transports are substituted by verification-only pg adapters, so the real
// Supabase configuration must be unreachable too.
// ---------------------------------------------------------------------------
globalThis.fetch = ((..._ignored: unknown[]) => {
  throw new Error('FULL_INTELLIGENCE_E2E_EXTERNAL_HTTP_FORBIDDEN');
}) as unknown as typeof fetch;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_PUBLISHABLE_KEY;

// Unique Redis fixture identities, set BEFORE the real transport/consumer are
// constructed (both read these at construction time) and deleted in finally.
const RUN_ID = randomUUID();
const STREAM = `qandeel:full-intelligence-e2e-smoke:${RUN_ID}`;
const GROUP = `qandeel-full-intelligence-e2e-smoke-group-${RUN_ID}`;
process.env.RUNTIME_EVENT_STREAM = STREAM;
process.env.POST_RESPONSE_CONSUMER_GROUP = GROUP;
process.env.POST_RESPONSE_CONSUMER_NAME = `qandeel-full-intelligence-e2e-smoke-consumer-${RUN_ID}`;

// The exact canonical A2 fixture texts: the first turn satisfies the REAL
// current deterministic rules at both background gates (Memory WRITE +
// generation TRIGGER); the second turn is a deterministic Memory-overlap
// recall query that the real retrieval policy must select the fresh Memory
// for. The access token is transport metadata only — the pg adapters derive
// the authenticated identity from transaction-local request.jwt.claims,
// exactly as PostgREST does.
const SOURCE_TURN_TEXT = 'I decided to train every morning even though I keep skipping my sessions';
const SECOND_TURN_TEXT = 'Remember what I told you about training every morning?';
const ASSISTANT_TURN_TEXT = 'Acknowledged — a deterministic assistant response for the Full Intelligence runtime smoke.';
const SEEDED_HYPOTHESIS_STATEMENT = 'Evening fatigue is the main reason planned training gets skipped.';
const GENERATED_CANDIDATE_STATEMENT = 'Committing to a fixed morning training window reduces skipped sessions.';
const SEEDED_HYPOTHESIS_ASSUMPTION = 'Evening fatigue persists on rest days.';
const GENERATED_CANDIDATE_ASSUMPTION = 'A fixed morning window stays available on workdays.';
const ACCESS_TOKEN = 'full-intelligence-e2e-smoke-transport-token';
const INTENT_DOMAIN = 'DECISION' as const;

// QHIA-009/QHIA-010/QHIA-011 foreground transport identities this smoke
// censuses by name.
//
// The aggregate is OPTIONAL foreground enrichment and the Orchestrator
// deliberately degrades when it rejects, so a green smoke proves nothing about
// migration 0060 unless the transport itself is counted: the aggregate-v3
// endpoint must be attempted AND completed once per eligible turn, and the
// retired aggregate-v1 and aggregate-v2 endpoints and the four direct
// per-channel authorities must never be attempted at all.
const CROSS_CONTEXT_FOREGROUND_RPC = 'read_him_session_cross_context_foreground_v3';
const RETIRED_AGGREGATE_TRANSPORT_RPCS = [
  'read_him_session_cross_context_foreground_v1',
  'read_him_session_cross_context_foreground_v2',
] as const;
const DIRECT_FOREGROUND_RPCS = [
  'read_him_session_situation_stress_v1',
  'read_him_session_decision_attention_v1',
  'read_him_session_goal_motivation_v1',
  'read_him_session_relationship_communication_v1',
] as const;
const RELEVANCE_AUTHORITY_RPC = 'read_him_session_context_bindings_v1';

// QHIA-012 Brain Context bridge identities this smoke censuses by name.
//
// The foreground read is OPTIONAL no-wait enrichment and the Orchestrator
// deliberately degrades when it is still pending, so a green smoke proves
// nothing about migration 0061 unless the transport itself is counted: the
// authenticated foreground endpoint must be attempted AND completed once per
// eligible turn, while the service-role background source and the managed
// durable completion must NEVER appear on the authenticated channel at all.
const BRAIN_CONTEXT_FOREGROUND_RPC = 'read_him_brain_context_for_turn_v1';
const BRAIN_CONTEXT_BACKGROUND_SOURCE_RPC = 'background_read_him_brain_context_source_v1';
const BRAIN_CONTEXT_COMPLETION_RPC = 'complete_post_response_him_brain_context_materialization_v1';
const BRAIN_CONTEXT_EFFECT_KEY = 'HIM_BRAIN_CONTEXT_MATERIALIZATION';
const BRAIN_CONTEXT_MATERIALIZED_CODE = 'HIM_BRAIN_CONTEXT_MATERIALIZED';
// The one frozen Brain slot this fixture measures, on the exact Goal the
// product explicitly activated. hbs.consistency@1 is GOAL-approved in the
// persisted definition authority, is NOT one of the four metrics that already
// have dedicated foreground consumption, and is semantically UNRESOLVED with a
// null semantic type - so the smoke proves the UNRESOLVED branch of the frozen
// payload contract rather than only the RESOLVED one.
const BRAIN_CONTEXT_FIXTURE_SLOT = 'GOAL_CONSISTENCY';
const BRAIN_CONTEXT_FIXTURE_SLOT_ORDER = 5;
const BRAIN_CONTEXT_FIXTURE_NUMERIC_VALUE = 2;

// QHIA-011A explicit activation identities.
//
// The activation write is a SETUP command issued once through the new
// authenticated product application entry, before any turn. Censusing it by
// name is what makes two separate claims checkable at the same time:
//
//   * the deliberate explicit activation really executed against real
//     PostgreSQL (attempted = completed = 1, failed = 0), so this smoke no
//     longer covers only the all-unbound cross-context state; and
//   * it never became a per-turn foreground call - the count stays 1 across
//     both eligible turns, and the sibling clear and application binding-read
//     commands are never issued at all.
const EXPLICIT_ACTIVATION_SET_RPC = 'set_him_session_context_binding_v1';
const EXPLICIT_ACTIVATION_CLEAR_RPC = 'clear_him_session_context_binding_v1';
const EXPLICIT_ACTIVATION_SOURCE = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1';
// The already-frozen QHIA-010 answer for a bound Goal whose canonical current
// hse.motivation@1 reading is LOW. This smoke invents none of it.
const ACTIVE_GOAL_MOTIVATION_GUIDANCE = Object.freeze({
  contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN',
});

let stage = 'BASELINE';

/** Never-called dependencies of real services; fail fast if touched. */
function unusedDependency<T>(name: string): T {
  return new Proxy({}, {
    get() {
      throw new Error(`FULL_INTELLIGENCE_E2E_SMOKE_UNUSED_DEPENDENCY_${name}`);
    },
  }) as unknown as T;
}

async function main(): Promise<void> {
  const totalStart = performance.now();

  // In-process fixture precheck against the REAL current deterministic rules —
  // no guessing, no mocking of eligibility. Runs before any infrastructure so
  // a rule drift fails fast and diagnosably.
  const memoryDecision = new MemoryWriteEvaluatorService().evaluate(SOURCE_TURN_TEXT);
  assert.equal(memoryDecision.decision, 'WRITE', 'fixture text must classify as a real Memory WRITE');
  const memoryCandidate = memoryDecision.decision === 'WRITE' ? memoryDecision.candidate : undefined;
  assert.ok(memoryCandidate, 'memory candidate present');
  const triggerPrecheck = new HypothesisGenerationTriggerClassificationService()
    .classify({ text: SOURCE_TURN_TEXT, safetyDisposition: 'ALLOW' });
  assert.equal(triggerPrecheck.classification, 'TRIGGER', 'fixture text must fire the real trigger classifier');
  const safetyPrecheck = new SafetyResponseGateService();
  assert.equal(safetyPrecheck.evaluate(SOURCE_TURN_TEXT, []).disposition, 'ALLOW', 'first turn must be Safety ALLOW');
  assert.equal(safetyPrecheck.evaluate(SECOND_TURN_TEXT, []).disposition, 'ALLOW', 'second turn must be Safety ALLOW');
  console.log(`FULL_INTELLIGENCE_E2E_SMOKE fixture precheck: memory=${memoryCandidate!.type} trigger=${triggerPrecheck.reason} safety=ALLOW`);

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the Full Intelligence E2E runtime smoke.');
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the Full Intelligence E2E runtime smoke.');

  const db = new SmokeDbSession(process.env.DATABASE_URL);
  const redisObserver: RedisClientType = createClient({ url: process.env.REDIS_URL });
  redisObserver.on('error', () => undefined);
  const transport = new RedisStreamsTransport();
  const consumer = new RedisPostResponseConsumer();
  const timings = { foreground_turn_1_ms: 0, background_dispatch_ms: 0, foreground_turn_2_ms: 0, total_smoke_ms: 0 };
  let rolledBack = false;

  try {
    await db.open();
    await redisObserver.connect();

    // Managed Supabase gives service_role the platform BYPASSRLS attribute;
    // the ephemeral CI role does not carry it. Grant it INSIDE the smoke
    // transaction only — ROLLBACK restores the role exactly as found.
    const [{ rolbypassrls: initialBypass }] = await db.observer<{ rolbypassrls: boolean }>(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'");
    await db.observer('ALTER ROLE service_role BYPASSRLS');

    // -----------------------------------------------------------------------
    stage = 'FIXTURE';
    // -----------------------------------------------------------------------
    const userId = randomUUID();
    const sessionId = randomUUID();
    const firstTurnId = randomUUID();
    const secondTurnId = randomUUID();
    const seededHypothesisId = randomUUID();
    const sessionScope = `CONVERSATION_SESSION:${sessionId}`;

    await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
    assert.equal((await db.observer('SELECT id FROM public.users WHERE id = $1', [userId])).length, 1,
      'auth trigger provisions the canonical user');
    await db.setAuthenticatedClaims(userId);

    // Real foreground production composition over verification-only pg
    // transport adapters. Every service below is the real production class.
    const authenticatedDataApi = new PgAuthenticatedDataApiAdapter(db);
    const conversationDataApi = authenticatedDataApi as unknown as SupabaseDataApiService;
    const memoryDataApi = authenticatedDataApi as unknown as MemoryDataApiService;
    const serviceRoleApi = new PgConversationServiceRoleApiAdapter(db) as unknown as SupabaseServiceRoleApiService;
    const correlation = new CorrelationService();
    const telemetry = new TelemetryService(correlation);
    const conversationRepository = new ConversationRepository(conversationDataApi, serviceRoleApi, correlation);
    const contextBuilder = new ContextBuilderService(conversationRepository);
    const memoryRuntime = new MemoryRuntimeService(
      new MemoryRepository(memoryDataApi, unusedDependency<MemoryServiceRoleApiService>('MEMORY_SERVICE_ROLE_API')));
    const memoryRetriever = new MemoryRetrieverService(memoryRuntime);
    const evidenceService = new EvidenceService(memoryRuntime);
    const himRepository = new HimRepository(memoryDataApi);
    const himSnapshotService = new HimIntelligenceSnapshotService(himRepository);
    // QHIA-005: the REAL contextual-current service over the same repository;
    // its one-metric hbs.reflection selective read runs concurrently with the
    // HSE Snapshot read through the same authenticated transport adapter. No
    // Reflection fixture exists in this smoke, so the canonical batch read
    // resolves UNKNOWN and the derived guidance stays NONE (omitted).
    const himContextualCurrentService = new HimContextualCurrentIntelligenceService(himRepository);
    // QHIA-007: the REAL Situation-stress semantic consumption boundary. After
    // QHIA-009 it is reached through the aggregate rather than through its own
    // foreground request, but it remains the only owner of Stress meaning and
    // its direct repository stays a valid canonical authority.
    const himSituationStressService = new HimSituationStressConsumptionService(new HimSituationStressRepository(memoryDataApi));
    // QHIA-008: likewise the REAL Decision-attention semantic consumption
    // boundary, the only owner of Attention meaning.
    const himDecisionAttentionService = new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(memoryDataApi));
    // QHIA-010: likewise the REAL Goal-motivation semantic consumption
    // boundary, the only owner of Goal Motivation meaning.
    const himGoalMotivationService = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(memoryDataApi));
    // QHIA-011: likewise the REAL Relationship-communication semantic
    // consumption boundary, the only owner of Communication meaning and the
    // first HRS foreground activation.
    const himRelationshipCommunicationRepository = new HimRelationshipCommunicationRepository(memoryDataApi);
    const himRelationshipCommunicationService = new HimRelationshipCommunicationConsumptionService(himRelationshipCommunicationRepository);
    // QHIA-009/QHIA-010/QHIA-011: the REAL cross-context foreground aggregate
    // over the same authenticated transport adapter. It is launched
    // concurrently with the HSE Snapshot and Reflection reads and adds no
    // foreground wait, and it is still the ONLY cross-context foreground
    // request the turn issues - exactly one migration-0060 aggregate-v3 call
    // carrying all four channels.
    //
    // Since QHIA-011A this smoke no longer covers only the all-unbound state:
    // fixture setup performs ONE deliberate explicit product activation
    // (GOAL -> an existing owned Goal carrying a canonical LOW hse.motivation@1
    // reading) through the new authenticated application activation service. So
    // the wrapped migration-0059 Goal authority answers ACTIVE_GOAL_BOUND and
    // the real QHIA-010 consumer decodes it into its already-frozen ACTIVE
    // guidance, while Situation, Decision and Relationship are never activated
    // and their authorities still return the deterministic
    // NO_ACTIVE_SITUATION / NO_ACTIVE_DECISION / NO_ACTIVE_RELATIONSHIP answers
    // whose derived guidance stays NONE (omitted from the provider request).
    //
    // All four per-channel repositories above stay REAL and fully reachable
    // over this same authenticated adapter. They are never called: the transport
    // census below proves zero direct attempts through a path that genuinely
    // exists, which is a stronger claim than removing them would be. The same
    // holds for the retired aggregate-v1 and aggregate-v2 endpoints, which
    // remain canonical database authorities this smoke proves production never
    // requests.
    const himCrossContextForegroundRepository = new HimCrossContextForegroundRepository(memoryDataApi);
    const himCrossContextForegroundService = new HimCrossContextForegroundAggregationService(
      himCrossContextForegroundRepository, himSituationStressService, himDecisionAttentionService, himGoalMotivationService,
      himRelationshipCommunicationService);
    // QHIA-011A: the REAL production explicit session context activation entry,
    // composed over the REAL existing QHIA-006 service and its ONE existing
    // repository - no second binding repository and no direct RPC path exists.
    // It is used exactly once, in fixture setup below, to make this smoke cover
    // a genuinely ACTIVATED cross-context state instead of only the all-unbound
    // one. It is deliberately NOT given to the Orchestrator, to any provider,
    // or to any background service: nothing on a turn can reach it.
    const contextActivationService = new ConversationContextActivationService(
      new HimSessionContextBindingService(new HimSessionContextBindingRepository(memoryDataApi)));
    const hypothesisService = new HypothesisService(
      new HypothesisRepository(memoryDataApi, unusedDependency<HypothesisServiceRoleApiService>('HYPOTHESIS_SERVICE_ROLE_API')),
      evidenceService);
    const hypothesisReasoningContext = new HypothesisReasoningContextService(
      hypothesisService, evidenceService, new ConfidenceRepository(memoryDataApi));
    // QHIA-009/QHIA-010/QHIA-011 transport census gate. `expectedTurns` is the
    // number of eligible foreground turns that should have driven the aggregate
    // so far.
    //
    // Attempted AND completed must both equal that number: attempted-only would
    // mean the request was issued and rejected, which the Orchestrator hides
    // behind its graceful degradation, and that is exactly the false-green this
    // gate exists to catch. Zero aggregate-v1 and aggregate-v2 attempts proves
    // the application really moved to the v3 endpoint rather than keeping an old
    // one as a fallback, and zero direct per-channel attempts proves there is no
    // backup and no race against the retired per-request shapes.
    const assertCrossContextForegroundTransport = (expectedTurns: number, label: string): void => {
      const census = authenticatedDataApi.rpcCensus;
      assert.equal(census.attempts(CROSS_CONTEXT_FOREGROUND_RPC), expectedTurns,
        `${label}: exactly ${expectedTurns} migration-0060 aggregate-v3 transport attempt(s)`);
      assert.equal(census.completions(CROSS_CONTEXT_FOREGROUND_RPC), expectedTurns,
        `${label}: every aggregate attempt COMPLETED against real PostgreSQL - a successful authoritative read, never graceful degradation`);
      assert.equal(census.failures(CROSS_CONTEXT_FOREGROUND_RPC), 0,
        `${label}: no aggregate transport failure occurred`);
      for (const retired of RETIRED_AGGREGATE_TRANSPORT_RPCS) {
        assert.equal(census.attempts(retired), 0,
          `${label}: zero ${retired} application attempts - the v3 endpoint is not shadowed by, raced against, or backed up by a retired transport`);
      }
      for (const direct of DIRECT_FOREGROUND_RPCS) {
        assert.equal(census.attempts(direct), 0, `${label}: zero direct foreground attempts for ${direct}`);
      }
      assert.equal(census.attempts(RELEVANCE_AUTHORITY_RPC), 0,
        `${label}: the QHIA-006 relevance authority is never requested from the application`);
      assert.deepEqual(
        census.attemptedNames().filter((name) => /situation_stress|decision_attention|goal_motivation|relationship_communication|context_bindings|cross_context_foreground_v1|cross_context_foreground_v2/u.test(name)), [],
        `${label}: no direct, fallback, or backup cross-context foreground request of any kind was issued`);
      // QHIA-011A: the explicit activation census. The setup write happened
      // exactly ONCE, before any turn, and no turn ever repeats it - so the
      // explicit product command can never be misclassified as foreground
      // transport, and the foreground can never silently activate a context.
      assert.equal(census.attempts(EXPLICIT_ACTIVATION_SET_RPC), 1,
        `${label}: exactly one explicit setup activation write exists for the whole smoke`);
      assert.equal(census.completions(EXPLICIT_ACTIVATION_SET_RPC), 1,
        `${label}: the explicit setup activation COMPLETED against real PostgreSQL - never refused and silently degraded`);
      assert.equal(census.failures(EXPLICIT_ACTIVATION_SET_RPC), 0,
        `${label}: no explicit activation transport failure occurred`);
      assert.equal(census.attempts(EXPLICIT_ACTIVATION_CLEAR_RPC), 0,
        `${label}: no clear command is issued anywhere - replacement is never clear plus set, and no turn deactivates a context`);
    };

    // QHIA-012 foreground Brain Context transport census. `expectedTurns` is the
    // number of eligible foreground turns that should have driven the ONE
    // optional Brain Context read so far.
    //
    // Attempted AND completed must both equal that number: attempted-only would
    // mean the request was issued and rejected, which the Orchestrator hides
    // behind its graceful degradation, and that is exactly the false-green this
    // gate exists to catch. The service-role background source and the managed
    // durable completion must never appear on the authenticated channel at all,
    // and no metric, currentness, or relevance request may be issued for Brain
    // Context anywhere in the foreground.
    const assertBrainContextForegroundTransport = (expectedTurns: number, label: string): void => {
      const census = authenticatedDataApi.rpcCensus;
      assert.equal(census.attempts(BRAIN_CONTEXT_FOREGROUND_RPC), expectedTurns,
        `${label}: exactly ${expectedTurns} migration-0061 foreground Brain Context attempt(s) - max one per eligible turn`);
      assert.equal(census.completions(BRAIN_CONTEXT_FOREGROUND_RPC), expectedTurns,
        `${label}: every Brain Context attempt COMPLETED against real PostgreSQL - a successful authoritative read, never graceful degradation`);
      assert.equal(census.failures(BRAIN_CONTEXT_FOREGROUND_RPC), 0,
        `${label}: no Brain Context transport failure occurred`);
      for (const backgroundOnly of [BRAIN_CONTEXT_BACKGROUND_SOURCE_RPC, BRAIN_CONTEXT_COMPLETION_RPC]) {
        assert.equal(census.attempts(backgroundOnly), 0,
          `${label}: the foreground never reaches the background-only ${backgroundOnly}`);
      }
      // Zero metric rereads for Brain Context: the foreground issues no
      // canonical-latest call, no QHIA-004 batch call for a Brain slot, and no
      // separate relevance read. The aggregate-v3 request is the ONE existing
      // pre-QHIA-012 cross-context transport and is counted by its own gate.
      assert.equal(census.attempts('read_him_latest_measurement_v1'), 0,
        `${label}: the foreground rereads no canonical latest measurement for Brain Context`);
      assert.equal(census.attempts('read_him_latest_measurement_core_v1'), 0,
        `${label}: the trusted internal canonical core is unreachable from the foreground`);
      // Read through a local binding rather than repeating the QHIA-011A
      // census literal verbatim: that exact expression is the QHIA-011A
      // contract's own anti-vacuity anchor, and duplicating it here would let a
      // regression in the aggregate census hide behind this assertion.
      const relevanceAuthorityAttempts = census.attempts(RELEVANCE_AUTHORITY_RPC);
      assert.equal(relevanceAuthorityAttempts, 0,
        `${label}: the foreground issues no separate QHIA-006 relevance read for Brain Context`);
      assert.deepEqual(
        census.attemptedNames().filter((name) => /brain_context/u.test(name) && name !== BRAIN_CONTEXT_FOREGROUND_RPC), [],
        `${label}: no second, fallback, per-slot, or background Brain Context request of any kind was issued from the foreground`);
    };

    // QHIA-011A: the ACTIVATED Goal channel as the provider may see it.
    //
    // The aggregate is OPTIONAL no-wait foreground enrichment: the Orchestrator
    // records it only if it settles before the existing foreground barrier, and
    // whether it wins that real wall-clock race on any given turn is a timing
    // fact, not an architectural one. Asserting that it must always win would
    // be flaky, and asserting that it must never appear would be false. So the
    // provider-side assertion is the exact, non-flaky one: this field is either
    // absent or EXACTLY the already-frozen ACTIVE Goal guidance - never a
    // different guidance state, never a different directive, and never an
    // invented value. Whether the activated Goal is really consumable is proven
    // deterministically further below, off the race, through the same real
    // repository, the same real aggregate and the same real QHIA-010 consumer.
    const assertGoalMotivationProviderField = (field: unknown, label: string): void => {
      if (field === undefined) return;
      assert.deepEqual(field, ACTIVE_GOAL_MOTIVATION_GUIDANCE,
        `${label}: a present Goal-motivation guidance field is exactly the frozen ACTIVE contract`);
    };

    // QHIA-012: the REAL Brain Context boundary over the same authenticated
    // transport adapter. It is the ONE optional Brain Context foreground read -
    // the heavy Human Intelligence work already happened in the previous turn's
    // post-response background path, and this turn only collects it.
    const himBrainContextRepository = new HimBrainContextRepository(memoryDataApi);
    const himBrainContextService = new HimBrainContextService(himBrainContextRepository);

    // VERIFICATION-ONLY DETERMINISTIC FOREGROUND BARRIER.
    //
    // Brain Context is optional no-wait enrichment: production records it only
    // if it settles before the existing foreground barrier, and whether it wins
    // that real wall-clock race on any given turn is a timing fact, not an
    // architectural one. Asserting that it must always win would be flaky.
    //
    // So this smoke CONTROLS the ordering instead of racing it. The two wrappers
    // below are pure scheduling doubles around the REAL services: the Brain
    // wrapper delegates to the real HimBrainContextService and releases a
    // deferred when that read settles; the Snapshot wrapper delegates to the
    // real HimIntelligenceSnapshotService but only after that deferred resolves.
    // Because the Orchestrator creates the Snapshot promise BEFORE it launches
    // the Brain read in the same synchronous step, the existing awaited barrier
    // therefore closes strictly after the Brain read has settled - with NO
    // sleep, NO timer, and NO change to any production class.
    //
    // Nothing about the production contract is faked: the Orchestrator still
    // never awaits the Brain promise, still adds no timeout, and still discards
    // a late result. This double only removes the wall clock from the proof.
    let releaseSnapshotGate: () => void = () => undefined;
    const deterministicSnapshotService = {
      getSnapshot: (accessToken: string, contextKind: 'CONVERSATION_SESSION', contextId: string) => {
        const gate = new Promise<void>((resolve) => { releaseSnapshotGate = resolve; });
        return gate.then(() => himSnapshotService.getSnapshot(accessToken, contextKind, contextId));
      },
    } as unknown as HimIntelligenceSnapshotService;
    const deterministicBrainContextService = {
      read: (userIdentity: string, accessToken: string, session: string, currentTurnId: string) => {
        const pending = himBrainContextService.read(userIdentity, accessToken, session, currentTurnId);
        pending.then(() => releaseSnapshotGate(), () => releaseSnapshotGate());
        return pending;
      },
      consumeSourceRows: (rows: Parameters<HimBrainContextService['consumeSourceRows']>[0]) =>
        himBrainContextService.consumeSourceRows(rows),
    } as unknown as HimBrainContextService;

    const conversationalRouter = new DeterministicConversationalModelRouter(ASSISTANT_TURN_TEXT);
    const orchestrator = new ConversationOrchestratorService(
      conversationRepository, contextBuilder, new SafetyResponseGateService(), new BehavioralResponsePolicyService(),
      memoryRetriever, new HimTurnContextSelectionService(), deterministicSnapshotService, new HimReasoningConsumptionService(),
      new HimFastDeepConsumptionService(), new HimInteractionAdaptationService(), himContextualCurrentService, new HimSessionReflectionConsumptionService(), himCrossContextForegroundService,
      deterministicBrainContextService,
      hypothesisReasoningContext, new RecommendationGroundingService(),
      conversationalRouter, correlation, telemetry);

    // Background provider doubles exist from the start so the foreground phase
    // can prove they were never touched before background dispatch.
    const associationProvider = new DeterministicAssociationProposalProvider(seededHypothesisId, 'SUPPORTING');
    const intentProvider = new DeterministicIntentExtractionProvider(INTENT_DOMAIN);
    const candidateGenerator = new DeterministicCandidateGenerator(
      GENERATED_CANDIDATE_STATEMENT, 'BEHAVIORAL', [GENERATED_CANDIDATE_ASSUMPTION]);

    // Canonical session through the REAL ConversationRepository authority path.
    const session = await conversationRepository.createSession(ACCESS_TOKEN, sessionId);
    assert.equal(session?.status, 'ACTIVE');
    assert.equal(session?.channel, 'TEXT');

    // HIM fixture: exactly ONE structured session metric (Stress = HIGH)
    // through the canonical authenticated measurement + calculation path, so
    // the session snapshot is genuinely PARTIAL: stress KNOWN, energy and
    // attention UNKNOWN. No raw noncanonical HIM row exists.
    const [stressObservation] = await db.asRole<{ id: string; metric_key: string; response_code: string }>(
      'authenticated', "SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION', $1, 'HIGH', NULL)", [sessionId]);
    assert.equal(stressObservation?.metric_key, 'hse.stress');
    assert.equal(stressObservation?.response_code, 'HIGH');
    const [stressSnapshot] = await db.asRole<{ value_state: string; numeric_value: number }>(
      'authenticated', 'SELECT * FROM public.calculate_hse_stress_measurement($1)', [stressObservation.id]);
    assert.equal(stressSnapshot?.value_state, 'ASSESSED', 'canonical stress calculation produced the assessed session state');

    // Seed exactly ONE system-owned session-scoped Hypothesis (version 1, one
    // unverified assumption, no Confidence evaluation) through the canonical
    // narrow service-role command — never a direct hypotheses insert.
    const [seeded] = await db.asRole<{ id: string; version: number; status: string; origin: string }>(
      'service_role', 'SELECT * FROM public.background_create_system_hypothesis_v1($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, seededHypothesisId, SEEDED_HYPOTHESIS_STATEMENT, 'CAUSAL', 'GENERAL', sessionScope, [SEEDED_HYPOTHESIS_ASSUMPTION], []]);
    assert.equal(seeded?.id, seededHypothesisId);
    assert.equal(seeded?.version, 1, 'seeded Hypothesis starts at version 1');
    assert.equal(seeded?.status, 'CANDIDATE');
    assert.equal(seeded?.origin, 'SYSTEM_GENERATED');
    assert.equal((await db.observer('SELECT id FROM public.confidence_evaluations WHERE user_id = $1', [userId])).length, 0,
      'no current-version Confidence evaluation exists for the seeded Hypothesis');
    // QHIA-011A explicit setup activation.
    //
    // ONE deliberate explicit product action, before any turn: the user selects
    // an exact already-owned, already-measured Goal for this exact session. The
    // Goal and its canonical LOW hse.motivation@1 reading come from the
    // EXISTING structured measurement authorities; the binding itself is
    // written ONLY through the new production application activation service,
    // never by a direct row write and never by calling the QHIA-006 SQL here.
    const [goalTarget] = await db.asRole<{ id: string; context_kind: string }>(
      'authenticated', "SELECT * FROM public.create_him_motivation_measurement_target('GOAL', 'full intelligence smoke goal')");
    assert.equal(goalTarget?.context_kind, 'GOAL');
    const [motivationObservation] = await db.asRole<{ id: string; metric_key: string; response_code: string }>(
      'authenticated', "SELECT * FROM public.create_hse_motivation_measurement($1, 'LOW', NULL)", [goalTarget.id]);
    assert.equal(motivationObservation?.metric_key, 'hse.motivation');
    assert.equal(motivationObservation?.response_code, 'LOW');
    const [motivationSnapshot] = await db.asRole<{ value_state: string; numeric_value: number }>(
      'authenticated', 'SELECT * FROM public.calculate_hse_motivation_measurement($1)', [motivationObservation.id]);
    assert.equal(motivationSnapshot?.value_state, 'ASSESSED', 'canonical Motivation calculation produced the assessed Goal state');
    assert.equal(motivationSnapshot?.numeric_value, 2, 'the canonical LOW ordinal is 2 on the frozen five-point scale');
    // QHIA-012 Brain Context fixture: exactly ONE frozen Brain slot is measured,
    // on the very Goal the product explicitly activates below, through the
    // existing canonical authenticated measurement + calculation authorities.
    // hbs.consistency@1 is GOAL-approved in the persisted definition authority,
    // is not one of the four already-dedicated foreground metrics, and stays
    // semantically UNRESOLVED with a null semantic type - so the smoke exercises
    // the UNRESOLVED branch of the frozen durable payload contract.
    //
    // The other seven frozen slots are deliberately left UNMEASURED, so the
    // materialization proves "UNKNOWN stays ABSENT" rather than only "KNOWN is
    // carried".
    const [consistencyObservation] = await db.asRole<{ id: string; metric_key: string; response_code: string }>(
      'authenticated', "SELECT * FROM public.create_hbs_consistency_measurement_v1($1, 'RARELY', NULL)", [goalTarget.id]);
    assert.equal(consistencyObservation?.metric_key, 'hbs.consistency');
    assert.equal(consistencyObservation?.response_code, 'RARELY');
    const [consistencySnapshot] = await db.asRole<{ id: string; value_state: string; numeric_value: number; semantic_mapping_status: string; semantic_type: string | null }>(
      'authenticated', 'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)', [consistencyObservation.id]);
    assert.equal(consistencySnapshot?.value_state, 'ASSESSED', 'canonical Consistency calculation produced the assessed Goal state');
    assert.equal(consistencySnapshot?.numeric_value, BRAIN_CONTEXT_FIXTURE_NUMERIC_VALUE,
      'the canonical RARELY ordinal is 2 on the frozen five-point scale');
    assert.equal(consistencySnapshot?.semantic_mapping_status, 'UNRESOLVED',
      'the frozen hbs.consistency@1 Foundation semantic mapping is UNRESOLVED and this task does not resolve it');
    assert.equal(consistencySnapshot?.semantic_type, null, 'no semantic type is invented for an UNRESOLVED mapping');
    const activation = await contextActivationService.activateContext(
      userId, ACCESS_TOKEN, sessionId, 'GOAL', { contextId: goalTarget.id });
    assert.deepEqual(activation, {
      contractVersion: 1, source: EXPLICIT_ACTIVATION_SOURCE, sessionId,
      activeBinding: { contextKind: 'GOAL', contextId: goalTarget.id },
    }, 'the explicit product activation returns the minimal projection of exactly the selected Goal');
    // The fixture stage drives authenticated RPCs of its own, so the census
    // starts from a proven-clean cross-context baseline before Turn #1 - with
    // the one explicit setup activation already counted.
    assertCrossContextForegroundTransport(0, 'before any foreground turn');
    assertBrainContextForegroundTransport(0, 'before any foreground turn');
    // Exactly ONE explicit relevance binding exists: the Goal the product
    // activated. Situation, Decision and Relationship are never activated, so
    // those three wrapped authorities must still answer with their
    // deterministic unbound results.
    const bindingRows = await db.observer<{ context_kind: string; context_id: string; status: string; binding_version: number }>(
      'SELECT context_kind, context_id, status, binding_version FROM public.him_session_context_bindings WHERE user_id = $1', [userId]);
    assert.deepEqual(bindingRows, [{ context_kind: 'GOAL', context_id: goalTarget.id, status: 'ACTIVE', binding_version: 1 }],
      'exactly one ACTIVE GOAL binding exists and no Situation, Decision, or Relationship is bound to the session');

    // -----------------------------------------------------------------------
    stage = 'FOREGROUND_TURN_1';
    // -----------------------------------------------------------------------
    // First USER turn through the canonical conversation authority, then the
    // REAL orchestrator end to end. No manual finalization exists anywhere in
    // this smoke: canonical finalization and the durable TURN_FINALIZED outbox
    // event must be produced by foreground orchestration itself.
    const firstTurn = await conversationRepository.createTurn(ACCESS_TOKEN, {
      id: firstTurnId, sessionId, userId, content: SOURCE_TURN_TEXT,
    });
    assert.equal(firstTurn?.status, 'RECEIVED');
    const firstStart = performance.now();
    const firstResult = await correlation.runRequest(() => orchestrator.orchestrate(ACCESS_TOKEN, userId, firstTurn));
    timings.foreground_turn_1_ms = performance.now() - firstStart;

    // Conversation/routing: FAST route, LOW complexity, unchanged budgets,
    // Safety ALLOW, exactly one conversational ModelRouter call.
    assert.equal(conversationalRouter.callCount, 1, 'exactly one conversational ModelRouter call on Turn #1');
    const firstCall = conversationalRouter.calls[0];
    assert.equal(firstCall.request.task, 'CONVERSATIONAL_RESPONSE');
    assert.equal(firstCall.request.path, 'FAST', 'route is FAST');
    assert.equal(firstCall.request.complexity, 'LOW', 'complexity is LOW');
    assert.equal(firstCall.request.latencyBudgetMs, 3000, 'existing FAST latency budget unchanged');
    assert.equal(firstCall.request.costBudget, 'LOW', 'existing cost budget unchanged');
    assert.equal(firstCall.request.safetyLevel, 'STANDARD', 'existing safety level unchanged');
    assert.equal(firstCall.request.locale, 'und');
    assert.equal(firstCall.request.modality, 'TEXT');
    assert.equal(firstCall.request.safetyGuidance, undefined, 'ALLOW disposition adds no safety guidance');
    assert.deepEqual(firstCall.request.context, [{ role: 'USER', content: SOURCE_TURN_TEXT }],
      'Turn #1 conversational history is exactly the current USER turn');

    // Memory: nothing from this source turn exists before background
    // processing, so the first request carries no memoryContext.
    assert.equal(firstCall.request.memoryContext, undefined, 'no memoryContext before background Memory work');
    assert.equal((await db.observer('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length, 0,
      'no Memory from this source turn exists before post-response processing');

    // HIM: the real DB-derived partial session snapshot in the FAST projection.
    assert.deepEqual(firstCall.request.himContext, {
      contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
      contextKind: 'CONVERSATION_SESSION', contextId: sessionId, coverageState: 'PARTIAL',
      eligibleMetricCount: 3, knownMetricCount: 1, unknownMetricCount: 2,
      freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', consumptionMode: 'FAST',
      metrics: [
        { metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'HIGH' },
        { metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null },
        { metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', ordinalCategory: null },
      ],
    }, 'real PARTIAL session HIM context: stress KNOWN/HIGH, energy and attention UNKNOWN/null, FAST fields only, policies UNASSESSED');

    // QHIA-009/QHIA-010/QHIA-011: the cross-context foreground aggregate really
    // ran on this turn. Exactly one migration-0060 aggregate-v3 request was
    // attempted AND completed through the authenticated PostgREST substitute
    // against real PostgreSQL, and neither the retired aggregate-v1 and
    // aggregate-v2 endpoints nor any of the four direct per-channel authorities
    // was ever requested.
    assertCrossContextForegroundTransport(1, 'after foreground Turn #1');
    // QHIA-012: the ONE optional Brain Context read really ran on this turn and
    // completed authoritatively. It answered EMPTY for a structural reason, not
    // a transport one: Turn #1 is the session's first USER turn, so there is no
    // immediately preceding canonical USER turn to consume - and there is no
    // older fallback to reach for.
    assertBrainContextForegroundTransport(1, 'after foreground Turn #1');
    assert.equal(firstCall.request.himBrainContext, undefined,
      'the first turn of a session has no immediately preceding USER turn, so no Brain Context field is sent');
    assert.doesNotMatch(firstCall.serverGuidance, /<him_brain_context>/u,
      'no Brain Context block is rendered when there is nothing to consume');
    // Provider contract unchanged. Three of the four wrapped authorities
    // answered authoritatively UNBOUND, so their guidance fields are
    // structurally omitted; only the ONE explicitly activated Goal channel may
    // legitimately appear, and only as its exact frozen ACTIVE contract.
    assert.equal(firstCall.request.himSituationStressGuidance, undefined,
      'an authoritatively unbound Situation adds no Situation-stress guidance field');
    assert.equal(firstCall.request.himDecisionAttentionGuidance, undefined,
      'an authoritatively unbound Decision adds no Decision-attention guidance field');
    assertGoalMotivationProviderField(firstCall.request.himGoalMotivationGuidance, 'Turn #1');
    assert.equal(firstCall.request.himRelationshipCommunicationGuidance, undefined,
      'an authoritatively unbound Relationship adds no Relationship-communication guidance field');

    // Hypothesis reasoning: the seeded Hypothesis through the real context
    // service — v1, structural counts 0/0, assumption present, Confidence
    // NOT_EVALUATED_FOR_CURRENT_VERSION targeting version 1.
    assert.ok(firstCall.request.hypothesisContext, 'hypothesis reasoning context AVAILABLE on Turn #1');
    const firstHypothesisContext = firstCall.request.hypothesisContext!;
    assert.equal(firstHypothesisContext.candidateHypothesisCount, 1);
    assert.equal(firstHypothesisContext.includedHypothesisCount, 1);
    assert.equal(firstHypothesisContext.truncated, false);
    assert.deepEqual(firstHypothesisContext.hypotheses, [{
      statement: SEEDED_HYPOTHESIS_STATEMENT, type: 'CAUSAL', domain: 'GENERAL', scope: sessionScope,
      origin: 'SYSTEM_GENERATED', status: 'CANDIDATE', hypothesisVersion: 1,
      currentlyEligibleSupportingEvidenceCount: 0, currentlyEligibleContradictingEvidenceCount: 0,
      assumptions: [SEEDED_HYPOTHESIS_ASSUMPTION], disconfirmingConditions: [],
      confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: 1 },
    }], 'the seeded Hypothesis is consumed at version 1 with no current-version Confidence');

    // Recommendation grounding: real transform, coverage NONE (coverage only —
    // never confidence strength), empty actionable set, structural booleans.
    assert.deepEqual(firstCall.request.recommendationContext, {
      contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', sourceContractVersion: 1,
      currentVersionConfidenceCoverage: 'NONE', actionableMissingInformationCodes: [],
      unverifiedAssumptionsPresent: true, contradictingEvidencePresent: false, sourceTruncated: false,
    }, 'real Recommendation grounding: NONE coverage (coverage only, never low confidence), no actionable codes yet');

    // Central guidance: the recorded output of the REAL composeServerGuidance
    // contains the separate HIM / Hypothesis / Recommendation server blocks,
    // and none of them leaks into USER/ASSISTANT conversational history.
    assert.match(firstCall.serverGuidance, /<him_reasoning_context>/u, 'central guidance carries the HIM block');
    assert.match(firstCall.serverGuidance, /<hypothesis_reasoning_context>/u, 'central guidance carries the Hypothesis block');
    assert.match(firstCall.serverGuidance, /<recommendation_grounding_context>/u, 'central guidance carries the Recommendation grounding block');
    assert.doesNotMatch(firstCall.serverGuidance, /<user_memory_context>/u, 'no Memory block before background Memory work');
    assert.ok(firstCall.request.context.every(({ content }) =>
      !content.includes('him_reasoning_context') && !content.includes('hypothesis_reasoning_context') &&
      !content.includes('recommendation_grounding_context')),
      'structured server guidance blocks stay out of USER/ASSISTANT history');

    // Finalization/outbox: exactly one completed ASSISTANT turn, the source
    // USER turn completed through canonical finalization, and exactly one
    // pending durable TURN_FINALIZED (ConversationTurnCompleted v2) event.
    assert.equal(firstResult.userTurn.status, 'COMPLETED', 'source USER turn canonically finalized');
    assert.equal(firstResult.assistantTurn?.status, 'COMPLETED');
    assert.equal(firstResult.assistantTurn?.content, ASSISTANT_TURN_TEXT);
    assert.equal(firstResult.assistantTurn?.source_turn_id, firstTurnId);
    assert.equal((await db.observer(
      "SELECT id FROM public.conversation_turns WHERE session_id = $1 AND role = 'ASSISTANT'", [sessionId])).length, 1,
      'exactly one completed ASSISTANT turn persisted');
    const firstOutboxRows = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.runtime_event_outbox WHERE subject_turn_id = $1', [firstTurnId]);
    assert.equal(firstOutboxRows.length, 1, 'exactly one pending TURN_FINALIZED outbox event for the source turn');
    const firstOutbox = firstOutboxRows[0];
    assert.equal(firstOutbox.status, 'PENDING');
    assert.equal(firstOutbox.event_type, 'ConversationTurnCompleted');
    assert.equal(firstOutbox.event_version, '2.0');
    assert.equal(firstOutbox.subject_user_id, userId);
    assert.equal(firstOutbox.subject_session_id, sessionId);
    const firstOutboxPayload = firstOutbox.payload as Record<string, unknown>;
    assert.equal(firstOutboxPayload.processing_path, 'FAST');
    assert.equal(firstOutboxPayload.routing_reason, 'FAST_DEFAULT');
    assert.equal(firstOutboxPayload.safety_disposition, 'ALLOW', 'server-owned Safety disposition is ALLOW');
    assert.equal(firstOutboxPayload.terminal_status, 'COMPLETED');
    const firstEventId = firstOutbox.event_id as string;

    // Foreground isolation: nothing background has run and no provider double
    // was touched by the foreground turn.
    assert.equal((await db.observer('SELECT id FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId])).length, 0,
      'no Post-Response execution exists before background start');
    assert.equal(associationProvider.callCount, 0, 'Association provider not called in foreground');
    assert.equal(intentProvider.callCount, 0, 'Intent provider not called in foreground');
    assert.equal(candidateGenerator.callCount, 0, 'Candidate generator not called in foreground');
    assert.equal(Number(await redisObserver.exists(STREAM)), 0, 'nothing published to Redis before background start');
    // Background work never sees a user JWT: drop the foreground claims now.
    await db.clearAuthenticatedClaims();
    console.log('FULL_INTELLIGENCE_E2E_SMOKE foreground turn #1 complete; background provably not started.');

    // -----------------------------------------------------------------------
    stage = 'OUTBOX_PUBLISH';
    // -----------------------------------------------------------------------
    const adminRepository = new PgRuntimeEventAdminRepositoryAdapter(db) as unknown as RuntimeEventAdminRepository;
    const publisher = new RuntimeEventPublisher(adminRepository, transport, telemetry);
    await transport.connect();
    await publisher.processOnce();
    const [publishedRow] = await db.observer<{ status: string; transport_message_id: string | null }>(
      'SELECT status, transport_message_id FROM public.runtime_event_outbox WHERE event_id = $1', [firstEventId]);
    assert.equal(publishedRow.status, 'PUBLISHED', 'real publisher acknowledged the canonical outbox row');
    assert.ok(publishedRow.transport_message_id, 'outbox carries the real Redis message id');
    assert.equal(Number(await redisObserver.xLen(STREAM)), 1, 'exactly one real Redis Stream entry');

    // -----------------------------------------------------------------------
    stage = 'BACKGROUND_DISPATCH';
    // -----------------------------------------------------------------------
    const pgDataAdapter = new PgBackgroundIntelligenceDataApiAdapter(db);
    const dataApi = pgDataAdapter as unknown as BackgroundIntelligenceDataApiService;
    const pgLedgerAdapter = new PgPostResponseIntelligenceRepositoryAdapter(db);
    const ledger = pgLedgerAdapter as unknown as PostResponseIntelligenceRepository;
    const authority = new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), dataApi);
    const enrichment = new BackgroundIntelligenceEnrichmentService(
      dataApi, new MemoryWriteEvaluatorService(), new HypothesisGenerationTriggerClassificationService(),
      new HimReasoningConsumptionService());
    const associationAuthority = new HypothesisEvidenceAssociationAuthorityService(
      unusedDependency<EvidenceService>('EVIDENCE_SERVICE'), unusedDependency<HypothesisService>('HYPOTHESIS_SERVICE'));
    const association = new ModelAssistedHypothesisAssociationService(enrichment, associationAuthority, authority, associationProvider);
    const extraction = new HypothesisGenerationIntentExtractionService(intentProvider, new HypothesisGenerationIntentAuthorityService());
    const dispatcher = new PostResponseIntelligenceDispatcherService(
      ledger, authority, enrichment, extraction, new HypothesisGenerationRequestAssemblerService(), candidateGenerator, association);

    await consumer.connect();
    const entries = await consumer.read();
    assert.equal(entries.length, 1, 'real Redis consumer reads exactly the published entry');
    const envelope = JSON.parse(entries[0].envelope) as RuntimeEventEnvelope;
    assert.ok(isCompletedRuntimeEventV2(envelope), 'published envelope is a canonical ConversationTurnCompleted v2');
    assert.equal(envelope.event_id, firstEventId);
    assert.equal(envelope.subject_turn_id, firstTurnId);
    const dispatchStart = performance.now();
    const terminal = await dispatcher.dispatch(entries[0].envelope);
    timings.background_dispatch_ms = performance.now() - dispatchStart;
    const [executionRow] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [firstTurnId]);
    assert.ok(executionRow, 'exactly one execution acquired');
    assert.equal(terminal, true,
      `dispatcher must be terminal (state=${executionRow.state} outcome=${executionRow.outcome_code} stage=${executionRow.current_stage})`);
    assert.equal(executionRow.state, 'COMPLETED');
    assert.equal(Number(executionRow.attempt_count), 1);
    const executionId = executionRow.id as string;

    // Essential composed background state for the next foreground turn — the
    // deep per-effect A2 assertions stay in the frozen A2 smoke.
    // Memory: the source turn produced the canonical eligible Memory.
    const memories = await db.observer<Record<string, unknown>>('SELECT * FROM public.memories WHERE user_id = $1', [userId]);
    assert.equal(memories.length, 1, 'the first source turn produced exactly one canonical Memory');
    assert.equal(memories[0].type, memoryCandidate!.type, 'real evaluator decided the Memory type');
    assert.equal(memories[0].content, memoryCandidate!.content, 'canonical evaluator content stored');
    assert.equal(memories[0].status, 'ACTIVE');
    assert.equal(memories[0].source, 'USER_STATED');
    const freshEvidenceId = `memory:${memories[0].id as string}`;
    const effectRows = async (): Promise<Array<Record<string, unknown>>> => db.observer<Record<string, unknown>>(
      'SELECT effect_key, state, result_code, result_reference, result_payload, claimed_at, completed_at FROM public.post_response_intelligence_effects WHERE execution_id = $1 ORDER BY effect_key', [executionId]);
    const effects = await effectRows();
    const effect = (key: string): Record<string, unknown> => {
      const found = effects.find((row) => row.effect_key === key);
      assert.ok(found, `effect ${key} exists`);
      return found;
    };
    const memoryEffect = effect('MEMORY_WRITE');
    assert.equal(memoryEffect.state, 'COMPLETED');
    assert.equal(memoryEffect.result_code, 'FRESH_EVIDENCE_CREATED', 'fresh Evidence created through the canonical Evidence authority');
    assert.equal(memoryEffect.result_reference, freshEvidenceId, 'durable fresh Evidence reference is exact');

    // QHIA-012: the post-response background path materialized the Brain Context
    // the NEXT turn may consume. Everything below is proven on the DURABLE row,
    // not on an in-memory value.
    const brainEffect = effect(BRAIN_CONTEXT_EFFECT_KEY);
    assert.equal(brainEffect.state, 'COMPLETED', 'the managed Brain Context effect is durably COMPLETED');
    assert.equal(brainEffect.result_code, BRAIN_CONTEXT_MATERIALIZED_CODE,
      'the durable typed result is HIM_BRAIN_CONTEXT_MATERIALIZED: at least one KNOWN canonical signal existed');
    assert.equal(brainEffect.result_reference, null, 'the Brain Context result carries no reference');
    // No CLAIMED state ever existed: the managed command inserts the effect
    // DIRECTLY as COMPLETED, so claimed_at and completed_at are one instant and
    // no crash window between claim and completion exists at all.
    assert.ok(brainEffect.claimed_at, 'the durable row carries its insertion instant');
    assert.equal(String(brainEffect.claimed_at), String(brainEffect.completed_at),
      'the Brain Context effect was inserted directly as COMPLETED: there is no CLAIMED-then-COMPLETED window');
    assert.equal((await db.observer(
      "SELECT effect_key FROM public.post_response_intelligence_effects WHERE effect_key = $1 AND state = 'CLAIMED'", [BRAIN_CONTEXT_EFFECT_KEY])).length, 0,
      'no CLAIMED Brain Context row exists anywhere - the constraint makes it unrepresentable and the dispatcher never claims it');
    const brainPayload = brainEffect.result_payload as Record<string, unknown>;
    assert.equal(brainPayload.contractVersion, 1);
    assert.equal(brainPayload.source, 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1');
    assert.equal(brainPayload.sourceTurnId, firstTurnId,
      'the durable materialization is bound to EXACTLY the execution source turn');
    // Exactly the one measured frozen slot: UNKNOWN stays ABSENT, the seven
    // unmeasured slots contribute nothing, and no unbound context kind appears.
    assert.deepEqual(brainPayload.signals, [{
      slotOrder: BRAIN_CONTEXT_FIXTURE_SLOT_ORDER,
      slot: BRAIN_CONTEXT_FIXTURE_SLOT,
      contextKind: 'GOAL',
      contextId: goalTarget.id,
      numericValue: BRAIN_CONTEXT_FIXTURE_NUMERIC_VALUE,
      semanticMappingStatus: 'UNRESOLVED',
      semanticType: null,
      freshnessState: 'UNASSESSED',
      confidenceState: 'UNASSESSED',
    }], 'exactly the one KNOWN bound frozen slot is durable: UNKNOWN stays absent and no unbound kind is materialized');
    // The bounded payload leaks nothing: no metric key, no measurement /
    // observation / snapshot / binding identity, no timestamp, no transcript.
    const brainPayloadText = JSON.stringify(brainPayload);
    for (const forbidden of [
      'hbs.consistency', 'metricKey', 'metric_key', 'observedAt', 'observed_at', 'temporalWindow',
      'measurementEventId', 'observationId', 'snapshotId', 'canonicalBindingId', 'activeBindingId',
      'bindingId', 'confidenceReference', 'freshnessReference', SOURCE_TURN_TEXT, ASSISTANT_TURN_TEXT,
      consistencyObservation.id, consistencySnapshot.id,
    ]) assert.equal(brainPayloadText.includes(forbidden), false, `the durable Brain payload never carries ${forbidden}`);
    // One execution-bound background source request, one managed typed
    // completion. No per-slot fan-out and no generic claim exist on this path.
    assert.equal(pgDataAdapter.himBrainContextSourceReadCount, 1,
      'exactly ONE execution-bound background Brain Context source request for the whole execution - never eight per-slot reads');
    assert.equal(pgLedgerAdapter.himBrainContextCompletionCount, 1,
      'exactly ONE managed typed Brain Context completion command');

    // Seeded Hypothesis: updated 1 → 2, supported by the fresh eligible Evidence.
    const [seededAfterUpdate] = await db.observer<{ version: number; supporting_evidence_ids: string[]; contradicting_evidence_ids: string[] }>(
      'SELECT version, supporting_evidence_ids, contradicting_evidence_ids FROM public.hypotheses WHERE id = $1', [seededHypothesisId]);
    assert.equal(seededAfterUpdate.version, 2, 'seeded Hypothesis updated from version 1 to version 2');
    assert.deepEqual(seededAfterUpdate.supporting_evidence_ids, [freshEvidenceId], 'the update is supported by the fresh eligible Evidence');
    assert.deepEqual(seededAfterUpdate.contradicting_evidence_ids, []);
    const updateBatchEffect = effect('HYPOTHESIS_UPDATE_BATCH');
    assert.equal(updateBatchEffect.state, 'COMPLETED');
    const updateReceipts = updateBatchEffect.result_payload as Array<Record<string, unknown>>;
    assert.equal(updateReceipts.length, 1);
    assert.equal(updateReceipts[0].hypothesisId, seededHypothesisId);
    assert.equal(updateReceipts[0].afterVersion, 2);
    const updateConfidenceEvaluationId = updateReceipts[0].confidenceEvaluationId as string;

    // Generated Hypothesis: the controlled generation path produced it, the
    // frozen lifecycle contract activated it, and it is current for reasoning.
    const candidateEffect = effect('CANDIDATE_PROVIDER');
    assert.equal(candidateEffect.state, 'COMPLETED');
    assert.equal(candidateEffect.result_code, 'VALIDATED_CANDIDATES');
    const validatedCandidates = candidateEffect.result_payload as Array<Record<string, unknown>>;
    assert.equal(validatedCandidates.length, 1, 'the controlled generation path produced the expected generated Hypothesis');
    const generatedHypothesisId = validatedCandidates[0].hypothesisId as string;
    const [generated] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypotheses WHERE id = $1', [generatedHypothesisId]);
    assert.ok(generated, 'generated Hypothesis exists');
    assert.equal(generated.statement, GENERATED_CANDIDATE_STATEMENT);
    assert.equal(generated.status, 'ACTIVE', 'the generated Hypothesis is current/active for reasoning consumption');
    assert.deepEqual(generated.supporting_evidence_ids, [freshEvidenceId]);
    const generatedVersion = generated.version as number;
    const lifecycleAudits = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1', [userId]);
    assert.equal(lifecycleAudits.length, 1, 'lifecycle activation occurred through the frozen lifecycle contract');
    assert.equal(lifecycleAudits[0].hypothesis_id, generatedHypothesisId);
    assert.equal(lifecycleAudits[0].before_status, 'CANDIDATE');
    assert.equal(lifecycleAudits[0].after_status, 'ACTIVE');
    assert.equal(lifecycleAudits[0].source, 'SYSTEM_GENERATION_ACTIVATION');
    assert.equal(lifecycleAudits[0].after_version, generatedVersion);

    // Confidence: exact-current evaluations exist for BOTH current versions —
    // null score, null band, UNCALIBRATED, UNASSESSED. Nothing numeric is
    // invented anywhere.
    const confidenceRows = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.confidence_evaluations WHERE user_id = $1', [userId]);
    assert.equal(confidenceRows.length, 2, 'exact-current Confidence evaluations exist for both current Hypothesis versions');
    const seededConfidence = confidenceRows.find((row) => row.target_id === seededHypothesisId);
    const generatedConfidence = confidenceRows.find((row) => row.target_id === generatedHypothesisId);
    assert.ok(seededConfidence, 'seeded-Hypothesis Confidence exists');
    assert.ok(generatedConfidence, 'generated-Hypothesis Confidence exists');
    assert.equal(seededConfidence!.id, updateConfidenceEvaluationId, 'the update Confidence is the exact durable receipt evaluation');
    for (const [row, expectedVersion] of [[seededConfidence!, 2], [generatedConfidence!, generatedVersion]] as const) {
      assert.equal(row.target_type, 'HYPOTHESIS');
      assert.equal(row.target_version, expectedVersion, 'exact target version matches the current Hypothesis version');
      assert.equal(row.numeric_score, null, 'numericScore stays null');
      assert.equal(row.confidence_band, null, 'confidenceBand stays null');
      assert.equal(row.calibration_state, 'UNCALIBRATED', 'calibration remains UNCALIBRATED');
      assert.equal(row.stability, 'UNASSESSED', 'stability remains UNASSESSED');
      assert.equal(row.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
      assert.deepEqual(row.missing_information_codes, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'],
        'canonical Confidence carries UNVERIFIED_ASSUMPTIONS alongside the calibration-only code');
    }

    // Information Gaps / Questions: canonical automatic gaps synchronized from
    // exact Confidence sources; the calibration-only code materialized nothing;
    // zero automatic Question Candidates.
    const informationGaps = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.information_gaps WHERE user_id = $1', [userId]);
    assert.equal(informationGaps.length, 2, 'canonical automatic Information Gaps were synchronized from exact Confidence sources');
    const gapSources = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.information_gap_confidence_sources WHERE user_id = $1 ORDER BY hypothesis_id', [userId]);
    assert.equal(gapSources.length, 2, 'exactly one durable source row per automatic gap');
    assert.ok(gapSources.every((row) => row.missing_information_code === 'UNVERIFIED_ASSUMPTIONS'),
      'the current fixed actionable semantics are unchanged');
    assert.equal(gapSources.some((row) => row.missing_information_code === 'CONFIDENCE_MODEL_UNCALIBRATED'), false,
      'CONFIDENCE_MODEL_UNCALIBRATED itself does not materialize as a user-answerable gap');
    assert.ok(informationGaps.every((gap) => gap.user_answerability === 'UNASSESSED'),
      'automatic answerability is never inferred');
    assert.equal((await db.observer('SELECT id FROM public.question_candidates WHERE user_id = $1', [userId])).length, 0,
      'automatic question_candidates count remains exactly zero');

    // HIM authority: the seeded structured hse.stress = HIGH measurement is
    // the canonical state the background generation context reflected — never
    // provider-fabricated HIM.
    assert.equal(pgDataAdapter.himSnapshotReadCount, 1, 'exactly one canonical background HIM snapshot read');
    assert.deepEqual(candidateGenerator.requests[0].himContext, {
      contractVersion: 1, source: 'HIM_STRUCTURED_STATE', contextKind: 'CONVERSATION_SESSION',
      metrics: [
        { metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'HIGH' },
        { metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null },
        { metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', ordinalCategory: null },
      ],
    }, 'the background HIM generation context reflects the canonical structured state');

    // Background deterministic provider census after first processing.
    assert.equal(associationProvider.callCount, 1, 'association provider called exactly once');
    assert.equal(intentProvider.callCount, 1, 'intent provider called exactly once');
    assert.equal(candidateGenerator.callCount, 1, 'candidate generator called exactly once');

    await consumer.ack(entries[0].id);
    assert.equal((await redisObserver.xPending(STREAM, GROUP)).pending, 0, 'primary Redis message ACKed');
    console.log('FULL_INTELLIGENCE_E2E_SMOKE background intelligence complete for turn #1.');

    // -----------------------------------------------------------------------
    stage = 'DUPLICATE_DELIVERY';
    // -----------------------------------------------------------------------
    const domainCounts = async (): Promise<Record<string, number>> => ({
      memories: (await db.observer('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length,
      hypotheses: (await db.observer('SELECT id FROM public.hypotheses WHERE user_id = $1', [userId])).length,
      updates: (await db.observer('SELECT id FROM public.hypothesis_updates WHERE user_id = $1', [userId])).length,
      confidence: (await db.observer('SELECT id FROM public.confidence_evaluations WHERE user_id = $1', [userId])).length,
      lifecycle: (await db.observer('SELECT id FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1', [userId])).length,
      informationGaps: (await db.observer('SELECT id FROM public.information_gaps WHERE user_id = $1', [userId])).length,
      gapSources: (await db.observer('SELECT information_gap_id FROM public.information_gap_confidence_sources WHERE user_id = $1', [userId])).length,
      questionCandidates: (await db.observer('SELECT id FROM public.question_candidates WHERE user_id = $1', [userId])).length,
      executions: (await db.observer('SELECT id FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId])).length,
    });
    const countsBefore = await domainCounts();
    assert.deepEqual(countsBefore, {
      memories: 1, hypotheses: 2, updates: 1, confidence: 2, lifecycle: 1,
      informationGaps: 2, gapSources: 2, questionCandidates: 0, executions: 1,
    });
    const effectsBeforeDuplicate = JSON.stringify(await effectRows());

    // Replay the byte-identical finalized-turn event through the same
    // consumer/dispatcher path: it must resolve terminally and be ACKable
    // under the existing frozen durable semantics.
    await redisObserver.xAdd(STREAM, '*', { event_id: firstEventId, envelope: entries[0].envelope });
    const duplicateEntries = await consumer.read();
    assert.equal(duplicateEntries.length, 1, 'real consumer reads the duplicate delivery');
    assert.equal(duplicateEntries[0].envelope, entries[0].envelope, 'duplicate envelope is byte-identical');
    assert.equal(await dispatcher.dispatch(duplicateEntries[0].envelope), true, 'duplicate dispatch resolves terminally');
    await consumer.ack(duplicateEntries[0].id);
    assert.equal((await redisObserver.xPending(STREAM, GROUP)).pending, 0, 'duplicate ACKed; pending back to zero');

    assert.equal(associationProvider.callCount, 1, 'association provider count remains 1 after duplicate');
    assert.equal(intentProvider.callCount, 1, 'intent provider count remains 1 after duplicate');
    assert.equal(candidateGenerator.callCount, 1, 'candidate generator count remains 1 after duplicate');
    assert.deepEqual(await domainCounts(), countsBefore,
      'no duplicate Memory, Hypothesis version advance, generated Hypothesis, Confidence, Information Gap or execution');
    assert.equal(JSON.stringify(await effectRows()), effectsBeforeDuplicate, 'durable receipts/results remain stable after duplicate');
    // QHIA-012 idempotency: the already-completed materialization is REUSED, not
    // recomputed. The redelivery issued no second background source request and
    // no second managed completion command, and the first durable result was not
    // overwritten.
    assert.equal(pgDataAdapter.himBrainContextSourceReadCount, 1,
      'the redelivery re-read no Brain Context source: an already-valid durable materialization is reused, never recomputed');
    assert.equal(pgLedgerAdapter.himBrainContextCompletionCount, 1,
      'the redelivery issued no second managed Brain Context completion: the first durable result is immutable');
    assert.equal((await db.observer(
      'SELECT effect_key FROM public.post_response_intelligence_effects WHERE effect_key = $1', [BRAIN_CONTEXT_EFFECT_KEY])).length, 1,
      'exactly one durable Brain Context effect exists for the source turn after redelivery');
    const [executionAfterDuplicate] = await db.observer<{ attempt_count: number; state: string }>(
      'SELECT attempt_count, state FROM public.post_response_intelligence_executions WHERE id = $1', [executionId]);
    assert.equal(Number(executionAfterDuplicate.attempt_count), 1, 'terminal execution attempt count unchanged');
    assert.equal(executionAfterDuplicate.state, 'COMPLETED');
    console.log('FULL_INTELLIGENCE_E2E_SMOKE duplicate delivery was a terminal no-op.');

    // -----------------------------------------------------------------------
    stage = 'FOREGROUND_TURN_2';
    // -----------------------------------------------------------------------
    await db.setAuthenticatedClaims(userId);
    // The background-created Memory is readable through the canonical Memory
    // runtime path before the turn even starts.
    const runtimeMemories = await memoryRuntime.listActiveForUser(userId, ACCESS_TOKEN, 32);
    assert.equal(runtimeMemories.length, 1, 'background-created Memory readable through the canonical Memory runtime path');
    assert.equal(runtimeMemories[0].type, memoryCandidate!.type);
    assert.equal(runtimeMemories[0].content, memoryCandidate!.content);

    const secondTurn = await conversationRepository.createTurn(ACCESS_TOKEN, {
      id: secondTurnId, sessionId, userId, content: SECOND_TURN_TEXT,
    });
    assert.equal(secondTurn?.status, 'RECEIVED');
    const secondStart = performance.now();
    const secondResult = await correlation.runRequest(() => orchestrator.orchestrate(ACCESS_TOKEN, userId, secondTurn));
    timings.foreground_turn_2_ms = performance.now() - secondStart;

    // Conversation/routing: FAST again, exactly one NEW conversational call,
    // total foreground ModelRouter calls = 2. No Recommendation provider call
    // exists anywhere.
    assert.equal(conversationalRouter.callCount, 2, 'exactly one additional conversational ModelRouter call; total = 2');
    const secondCall = conversationalRouter.calls[1];
    assert.equal(secondCall.request.path, 'FAST', 'route remains FAST');
    assert.equal(secondCall.request.complexity, 'LOW');
    assert.equal(secondCall.request.task, 'CONVERSATIONAL_RESPONSE');

    // Context continuity per the existing ContextBuilder limits/order: the
    // previous completed exchange plus the new USER turn — from the real
    // repository, never fabricated in the router double.
    assert.deepEqual(secondCall.request.context, [
      { role: 'USER', content: SOURCE_TURN_TEXT },
      { role: 'ASSISTANT', content: ASSISTANT_TURN_TEXT },
      { role: 'USER', content: SECOND_TURN_TEXT },
    ], 'model request context carries the previous completed USER + ASSISTANT turns and the new USER turn in order');

    // Memory consumption — the central acceptance condition: the Memory
    // actually written by Turn #1 background processing is consumed by the
    // next real foreground orchestration. Semantic identity, not row order.
    assert.ok(secondCall.request.memoryContext, 'second request contains a memoryContext');
    assert.deepEqual(secondCall.request.memoryContext, [{
      type: memoryCandidate!.type, content: memoryCandidate!.content, source: 'USER_STATED',
    }], 'background-created Memory is consumed by the next real foreground orchestration');

    // HIM consumption: the same real session snapshot, still PARTIAL, stress
    // KNOWN/HIGH, unmeasured metrics UNKNOWN/null, no inference introduced.
    assert.deepEqual(secondCall.request.himContext, firstCall.request.himContext,
      'second request still consumes the real session HIM snapshot: stress KNOWN/HIGH, others UNKNOWN/null');

    // QHIA-009/QHIA-010/QHIA-011: the second eligible turn drove its OWN
    // aggregate request, which also completed. The counter advanced by exactly
    // one - never zero (a cached or reused earlier result) and never two (a
    // fallback or backup).
    assertCrossContextForegroundTransport(2, 'after foreground Turn #2');
    // QHIA-012 - THE central QHIA-012 acceptance condition, and the whole point
    // of the bridge: the Brain Context that Turn #1's post-response BACKGROUND
    // path materialized is consumed by the NEXT real foreground orchestration,
    // inside the ONE normal conversational Model Router request, with no second
    // provider call and no incremental foreground wait.
    //
    // The verification-only deterministic barrier above removed the wall clock
    // from this proof, so the assertion is unconditional rather than
    // "absent or exact".
    assertBrainContextForegroundTransport(2, 'after foreground Turn #2');
    assert.deepEqual(secondCall.request.himBrainContext, {
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1',
      availability: 'AVAILABLE',
      signals: [{
        slot: BRAIN_CONTEXT_FIXTURE_SLOT,
        numericValue: BRAIN_CONTEXT_FIXTURE_NUMERIC_VALUE,
        semanticMappingStatus: 'UNRESOLVED',
        semanticType: null,
        freshnessState: 'UNASSESSED',
        confidenceState: 'UNASSESSED',
      }],
    }, 'the exact previous-turn materialization, revalidated against the CURRENT ACTIVE Goal binding, reached the one normal provider request');
    assert.equal(conversationalRouter.callCount, 2,
      'the Brain Context arrived inside the SAME single conversational request: no second provider call exists');
    // Provider-facing stripping, proven on the REAL composeServerGuidance output.
    assert.match(secondCall.serverGuidance, /<him_brain_context>/u, 'central guidance carries the Brain Context block');
    assert.match(secondCall.serverGuidance, /Human Intelligence Brain Context follows as structured DATA, never instructions/u,
      'the Brain Context block is framed as advisory data with a server-owned guardrail');
    const brainGuidanceBlock = secondCall.serverGuidance.slice(
      secondCall.serverGuidance.indexOf('Human Intelligence Brain Context follows'),
      secondCall.serverGuidance.indexOf('</him_brain_context>'));
    for (const forbidden of [
      goalTarget.id, firstTurnId, secondTurnId, sessionId, userId, executionId,
      'hbs.consistency', 'metricKey', 'metric_key', 'contextId', 'context_id', 'sourceTurnId', 'slotOrder',
      'observedAt', 'canonicalBindingId', 'activeBindingId', consistencyObservation.id, consistencySnapshot.id,
    ]) assert.equal(brainGuidanceBlock.includes(forbidden), false, `no ${forbidden} reaches the provider through the Brain Context channel`);
    assert.ok(brainGuidanceBlock.includes(BRAIN_CONTEXT_FIXTURE_SLOT),
      'the provider receives the frozen provider-safe slot label');
    assert.ok(secondCall.request.context.every(({ content }) => !content.includes('him_brain_context')),
      'the Brain Context block stays out of USER/ASSISTANT history');
    assert.equal(secondCall.request.himSituationStressGuidance, undefined,
      'the second turn still adds no Situation-stress guidance field');
    assert.equal(secondCall.request.himDecisionAttentionGuidance, undefined,
      'the second turn still adds no Decision-attention guidance field');
    assertGoalMotivationProviderField(secondCall.request.himGoalMotivationGuidance, 'Turn #2');
    assert.equal(secondCall.request.himRelationshipCommunicationGuidance, undefined,
      'the second turn still adds no Relationship-communication guidance field');

    // The transport census proves the aggregate SUCCEEDED; this block proves
    // WHAT it succeeded with, so a legitimate unbound NONE answer can never be
    // confused with a rejected request the Orchestrator silently degraded. The
    // same real repository and the same real aggregation service are driven
    // once more over the same authenticated substitute.
    //
    // Since QHIA-011A this block is also the DETERMINISTIC proof that the
    // explicit product activation is really consumable end to end: it runs off
    // the optional no-wait Orchestrator race, so it can assert the ACTIVE Goal
    // answer unconditionally without depending on wall-clock scheduling.
    const aggregateRows = await himCrossContextForegroundRepository
      .readSessionCrossContextForeground(ACCESS_TOKEN, userId, sessionId);
    assert.equal(aggregateRows.length, 4, 'migration 0060 answers with exactly four transport rows');
    assert.deepEqual(
      aggregateRows.map((row) => [row.foreground_slot_order, row.foreground_slot, row.binding_state]),
      [[1, 'SITUATION_STRESS', 'NO_ACTIVE_SITUATION'], [2, 'DECISION_ATTENTION', 'NO_ACTIVE_DECISION'], [3, 'GOAL_MOTIVATION', 'ACTIVE_GOAL_BOUND'], [4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP']],
      'the frozen transport order, the explicitly activated Goal, and the deterministic unbound states of the three unactivated authorities');
    for (const row of [aggregateRows[0], aggregateRows[1], aggregateRows[3]]) {
      assert.equal(row.binding_context_id, null, 'an unbound slot resolved no context');
      assert.equal(row.metric_key, null, 'an unbound slot read no metric');
      assert.equal(row.numeric_value, null, 'an unbound slot carries no value');
    }
    // QHIA-011A non-vacuity, off the Orchestrator race: the aggregate Goal row
    // is truly bound to the exact target the product activated, and carries the
    // exact canonical LOW reading created through the existing measurement
    // authority.
    assert.equal(aggregateRows[2].binding_context_id, goalTarget.id,
      'the aggregate Goal slot resolved exactly the explicitly activated Goal');
    assert.equal(aggregateRows[2].metric_key, 'hse.motivation');
    assert.equal(aggregateRows[2].definition_version, 1);
    assert.equal(aggregateRows[2].context_kind, 'GOAL');
    assert.equal(aggregateRows[2].context_id, goalTarget.id);
    assert.equal(aggregateRows[2].has_canonical_current_value, true);
    assert.equal(aggregateRows[2].value_state, 'ASSESSED');
    assert.equal(aggregateRows[2].numeric_value, 2, 'the canonical current Goal Motivation reading is the LOW ordinal');
    const aggregateGuidance = await himCrossContextForegroundService.read(userId, ACCESS_TOKEN, sessionId);
    assert.deepEqual(aggregateGuidance, {
      contractVersion: 3,
      situationStress: { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },
      decisionAttention: { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },
      goalMotivation: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' },
      relationshipCommunication: { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },
    }, 'the REAL QHIA-007, QHIA-008, QHIA-010 and QHIA-011 semantic consumers decoded the successful aggregate: ACTIVE for the explicitly activated Goal, bounded NONE for the three unactivated channels');
    // The third slot decoded by the REAL QHIA-010 consumer alone, so
    // "explicitly activated Goal + canonical LOW therefore ACTIVE /
    // REDUCE_GOAL_ACTION_BURDEN" is proven as its own fact rather than only
    // inside the aggregate result.
    assert.deepEqual(
      himGoalMotivationService.consumeSourceRows([aggregateRows[2]]), ACTIVE_GOAL_MOTIVATION_GUIDANCE,
      'the real Goal-motivation consumer decodes the activated LOW reading to ACTIVE / REDUCE_GOAL_ACTION_BURDEN');
    // The fourth slot decoded by the REAL QHIA-011 consumer alone, so
    // "authoritative NO_ACTIVE_RELATIONSHIP therefore NONE / DEFAULT" is proven
    // as its own fact rather than only inside the aggregate result.
    assert.deepEqual(
      himRelationshipCommunicationService.consumeSourceRows([aggregateRows[3]]),
      { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },
      'the real Relationship-communication consumer decodes the successful NO_ACTIVE_RELATIONSHIP row to NONE / DEFAULT');
    assertCrossContextForegroundTransport(4, 'after the direct aggregate transport proof');

    // QHIA-012 non-vacuity. The provider assertion above is already the strong
    // one: that value travelled through the REAL repository, the REAL
    // consumption service and the REAL Orchestrator, deterministically. What
    // remains to prove is that it could ONLY have come from Turn #1's
    // materialization - which is a fact about the durable ledger, not about
    // another read.
    //
    // No second foreground read is issued here on purpose. The migration-0061
    // read requires the current turn to be in the foreground GENERATING state,
    // and Turn #2 is canonically COMPLETED by now: an off-race repeat would be
    // asking the wrong question, and the census must stay at exactly one attempt
    // per eligible turn.
    assert.equal(HIM_BRAIN_CONTEXT_REGISTRY.length, 8, 'the Brain Context registry is frozen at exactly eight slots');
    assert.deepEqual(
      HIM_BRAIN_CONTEXT_REGISTRY.find((entry) => entry.slotOrder === BRAIN_CONTEXT_FIXTURE_SLOT_ORDER),
      { slotOrder: 5, slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL', metricKey: 'hbs.consistency' },
      'the consumed slot is exactly the frozen registry entry, at its frozen ordinal and its one frozen context kind');
    // The consumed materialization can ONLY have come from Turn #1's execution:
    // Turn #2 has no post-response execution at all, so there is no second
    // materialization anywhere in this session to have been picked instead, and
    // the one that exists is bound to Turn #1 by its own durable sourceTurnId.
    assert.equal((await db.observer(
      'SELECT id FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [secondTurnId])).length, 0,
      'Turn #2 has no post-response execution: the consumed materialization is necessarily Turn #1\'s');
    assert.deepEqual(
      (await db.observer<{ execution_id: string }>(
        'SELECT execution_id FROM public.post_response_intelligence_effects WHERE effect_key = $1', [BRAIN_CONTEXT_EFFECT_KEY]))
        .map((row) => row.execution_id),
      [executionId],
      'exactly one Brain Context materialization exists in the whole session, and it belongs to the Turn #1 execution');
    // The exact bound Goal the background materialized against is still the
    // CURRENT ACTIVE binding, which is why the signal survived revalidation.
    assert.deepEqual(
      await db.observer<{ context_kind: string; context_id: string }>(
        "SELECT context_kind, context_id FROM public.him_session_context_bindings WHERE user_id = $1 AND status = 'ACTIVE'", [userId]),
      [{ context_kind: 'GOAL', context_id: goalTarget.id }],
      'the surviving signal was revalidated against exactly the still-ACTIVE Goal binding it was materialized against');
    assertBrainContextForegroundTransport(2, 'after the Brain Context durable-provenance proof');
    const aggregateCensus = authenticatedDataApi.rpcCensus;
    console.log('FULL_INTELLIGENCE_E2E_SMOKE QHIA-012 Brain Context census: '
      + `foreground_attempted=${aggregateCensus.attempts(BRAIN_CONTEXT_FOREGROUND_RPC)} `
      + `foreground_completed=${aggregateCensus.completions(BRAIN_CONTEXT_FOREGROUND_RPC)} `
      + `foreground_failed=${aggregateCensus.failures(BRAIN_CONTEXT_FOREGROUND_RPC)} `
      + `foreground_background_source=${aggregateCensus.attempts(BRAIN_CONTEXT_BACKGROUND_SOURCE_RPC)} `
      + `foreground_completion_command=${aggregateCensus.attempts(BRAIN_CONTEXT_COMPLETION_RPC)} `
      + `foreground_canonical_latest=${aggregateCensus.attempts('read_him_latest_measurement_v1')} `
      + `background_source_reads=${pgDataAdapter.himBrainContextSourceReadCount} `
      + `background_completions=${pgLedgerAdapter.himBrainContextCompletionCount}`);
    console.log('FULL_INTELLIGENCE_E2E_SMOKE QHIA-011 aggregate-v3 transport census: '
      + `attempted=${aggregateCensus.attempts(CROSS_CONTEXT_FOREGROUND_RPC)} `
      + `completed=${aggregateCensus.completions(CROSS_CONTEXT_FOREGROUND_RPC)} `
      + `failed=${aggregateCensus.failures(CROSS_CONTEXT_FOREGROUND_RPC)} `
      + `aggregate_v1=${aggregateCensus.attempts(RETIRED_AGGREGATE_TRANSPORT_RPCS[0])} `
      + `aggregate_v2=${aggregateCensus.attempts(RETIRED_AGGREGATE_TRANSPORT_RPCS[1])} `
      + `direct_qhia007=${aggregateCensus.attempts(DIRECT_FOREGROUND_RPCS[0])} `
      + `direct_qhia008=${aggregateCensus.attempts(DIRECT_FOREGROUND_RPCS[1])} `
      + `direct_qhia010=${aggregateCensus.attempts(DIRECT_FOREGROUND_RPCS[2])} `
      + `direct_qhia011=${aggregateCensus.attempts(DIRECT_FOREGROUND_RPCS[3])} `
      + `relevance_authority=${aggregateCensus.attempts(RELEVANCE_AUTHORITY_RPC)}`);
    console.log('FULL_INTELLIGENCE_E2E_SMOKE QHIA-011A explicit activation census: '
      + `set_attempted=${aggregateCensus.attempts(EXPLICIT_ACTIVATION_SET_RPC)} `
      + `set_completed=${aggregateCensus.completions(EXPLICIT_ACTIVATION_SET_RPC)} `
      + `set_failed=${aggregateCensus.failures(EXPLICIT_ACTIVATION_SET_RPC)} `
      + `clear_attempted=${aggregateCensus.attempts(EXPLICIT_ACTIVATION_CLEAR_RPC)} `
      + `foreground_binding_read=${aggregateCensus.attempts(RELEVANCE_AUTHORITY_RPC)}`);

    // Hypothesis reasoning consumption: both post-background current
    // hypotheses by stable statement identity — never array position.
    assert.ok(secondCall.request.hypothesisContext, 'hypothesis reasoning context AVAILABLE on Turn #2');
    const secondHypothesisContext = secondCall.request.hypothesisContext!;
    assert.equal(secondHypothesisContext.candidateHypothesisCount, 2);
    assert.equal(secondHypothesisContext.includedHypothesisCount, 2);
    assert.equal(secondHypothesisContext.truncated, false);
    const seededItem = secondHypothesisContext.hypotheses.find((item) => item.statement === SEEDED_HYPOTHESIS_STATEMENT);
    const generatedItem = secondHypothesisContext.hypotheses.find((item) => item.statement === GENERATED_CANDIDATE_STATEMENT);
    assert.ok(seededItem, 'initially seeded hypothesis is consumed');
    assert.ok(generatedItem, 'generated hypothesis is consumed');
    assert.equal(seededItem!.hypothesisVersion, 2, 'seeded hypothesis is now current version 2');
    assert.equal(seededItem!.currentlyEligibleSupportingEvidenceCount, 1, 'seeded hypothesis has the expected eligible supporting Evidence');
    assert.equal(seededItem!.currentlyEligibleContradictingEvidenceCount, 0);
    assert.equal(generatedItem!.status, 'ACTIVE', 'generated hypothesis is lifecycle-current/active for reasoning');
    assert.equal(generatedItem!.hypothesisVersion, generatedVersion, 'generated hypothesis carries its exact current version');
    assert.equal(generatedItem!.currentlyEligibleSupportingEvidenceCount, 1, 'generated hypothesis has the expected eligible supporting Evidence');
    for (const [item, expectedVersion] of [[seededItem!, 2], [generatedItem!, generatedVersion]] as const) {
      assert.deepEqual(item.confidence, {
        state: 'EXACT_CURRENT_VERSION_EVALUATED', targetVersion: expectedVersion,
        numericScore: null, confidenceBand: null, calibrationState: 'UNCALIBRATED', stability: 'UNASSESSED',
        missingInformationCodes: ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'],
        policyVersion: CONFIDENCE_POLICY_VERSION,
      }, 'exact-current Confidence targets the exact current version and stays null/UNCALIBRATED');
    }

    // Recommendation grounding: FULL coverage (coverage only — never
    // confidence strength) and the exact canonical actionable set implied by
    // the production Confidence outputs of this fixture.
    assert.deepEqual(secondCall.request.recommendationContext, {
      contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', sourceContractVersion: 1,
      currentVersionConfidenceCoverage: 'FULL',
      actionableMissingInformationCodes: ['UNVERIFIED_ASSUMPTIONS'],
      unverifiedAssumptionsPresent: true, contradictingEvidencePresent: false, sourceTruncated: false,
    }, 'FULL coverage (never confidence strength) with the canonical actionable missing-information set');

    // Full central guidance composition: Memory + HIM + Hypothesis +
    // Recommendation together as separate bounded server-owned blocks, outside
    // the USER/ASSISTANT history.
    assert.match(secondCall.serverGuidance, /<user_memory_context>/u, 'central guidance carries the Memory block');
    assert.match(secondCall.serverGuidance, /<him_reasoning_context>/u, 'central guidance carries the HIM block');
    assert.match(secondCall.serverGuidance, /<hypothesis_reasoning_context>/u, 'central guidance carries the Hypothesis block');
    assert.match(secondCall.serverGuidance, /<recommendation_grounding_context>/u, 'central guidance carries the Recommendation grounding block');
    assert.ok(secondCall.request.context.every(({ content }) =>
      !content.includes('user_memory_context') && !content.includes('him_reasoning_context') &&
      !content.includes('hypothesis_reasoning_context') && !content.includes('recommendation_grounding_context')),
      'structured server channels stay separate from USER/ASSISTANT history');

    // Question / Information Gap boundary: the foreground turn read no gap as
    // a live blocker, created no Question Candidate and invoked no Question
    // provider — gap state is unchanged and question_candidates stays zero.
    assert.equal((await db.observer('SELECT id FROM public.information_gaps WHERE user_id = $1', [userId])).length, 2,
      'foreground consumed no Information Gap and created none');
    assert.equal((await db.observer('SELECT id FROM public.question_candidates WHERE user_id = $1', [userId])).length, 0,
      'foreground created no Question Candidate');

    // Turn #2 finalization creates its own pending durable event; the second
    // background cycle is deliberately NOT run in this smoke.
    assert.equal(secondResult.userTurn.status, 'COMPLETED');
    assert.equal(secondResult.assistantTurn?.status, 'COMPLETED');
    const secondOutboxRows = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.runtime_event_outbox WHERE subject_turn_id = $1', [secondTurnId]);
    assert.equal(secondOutboxRows.length, 1, 'Turn #2 created exactly one new durable TURN_FINALIZED outbox event');
    assert.equal(secondOutboxRows[0].status, 'PENDING', 'the Turn #2 event stays pending — no second background cycle runs');
    assert.equal(secondOutboxRows[0].event_type, 'ConversationTurnCompleted');
    assert.equal(secondOutboxRows[0].event_version, '2.0');
    assert.equal((await db.observer('SELECT id FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId])).length, 1,
      'no background execution exists for Turn #2');
    assert.equal(associationProvider.callCount, 1, 'background providers untouched by Turn #2');
    assert.equal(intentProvider.callCount, 1, 'background providers untouched by Turn #2');
    assert.equal(candidateGenerator.callCount, 1, 'background providers untouched by Turn #2');
    console.log('FULL_INTELLIGENCE_E2E_SMOKE foreground turn #2 consumed the composed background intelligence.');

    // -----------------------------------------------------------------------
    stage = 'CLEANUP';
    // -----------------------------------------------------------------------
    await db.rollback();
    rolledBack = true;
    assert.equal((await db.afterRollback('SELECT id FROM public.users WHERE id = $1', [userId])).length, 0, 'fixture user rolled back');
    assert.equal((await db.afterRollback('SELECT event_id FROM public.runtime_event_outbox WHERE subject_session_id = $1', [sessionId])).length, 0,
      'outbox rows rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId])).length, 0,
      'execution rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.hypotheses WHERE user_id = $1', [userId])).length, 0, 'hypotheses rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length, 0, 'memories rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.information_gaps WHERE user_id = $1', [userId])).length, 0,
      'automatic Information Gaps rolled back');
    const [{ rolbypassrls: finalBypass }] = await db.afterRollback<{ rolbypassrls: boolean }>(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'");
    assert.equal(finalBypass, initialBypass, 'transaction-scoped service_role attribute restored by rollback');

    timings.total_smoke_ms = performance.now() - totalStart;
    console.log('FULL_INTELLIGENCE_E2E_TIMINGS');
    console.log(`foreground_turn_1_ms=${timings.foreground_turn_1_ms.toFixed(1)}`);
    console.log(`background_dispatch_ms=${timings.background_dispatch_ms.toFixed(1)}`);
    console.log(`foreground_turn_2_ms=${timings.foreground_turn_2_ms.toFixed(1)}`);
    console.log(`total_smoke_ms=${timings.total_smoke_ms.toFixed(1)}`);
    console.log('Full Intelligence End-to-End Runtime: PASS');
  } finally {
    if (!rolledBack) await db.rollback().catch(() => undefined);
    await consumer.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
    try {
      if (redisObserver.isOpen) {
        await redisObserver.del(STREAM);
        const remaining = Number(await redisObserver.exists(STREAM));
        console.log(`FULL_INTELLIGENCE_E2E_SMOKE Redis fixture stream deleted (exists=${remaining}).`);
        await redisObserver.quit();
      }
    } catch {
      if (redisObserver.isOpen) redisObserver.destroy();
    }
    await db.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FULL_INTELLIGENCE_E2E_RUNTIME FAILED stage=${stage}: ${message}`);
  process.exitCode = 1;
});
