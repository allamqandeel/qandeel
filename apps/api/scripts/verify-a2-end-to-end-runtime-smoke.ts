// A2 End-to-End Runtime Smoke v1.
//
// Proves the full Track A2 runtime composes as ONE integrated system on real
// PostgreSQL + real Redis: canonical conversation finalization → durable
// ConversationTurnCompleted v2 outbox → real RuntimeEventPublisher → real
// Redis Stream → real RedisPostResponseConsumer → real
// PostResponseIntelligenceDispatcherService → Memory WRITE → durable fresh
// Evidence → Association AUTHORIZED_COMMANDS → automatic A2.3c
// HYPOTHESIS_UPDATE_BATCH → canonical Hypothesis mutation + immutable audit +
// exact-version Confidence → generation eligibility → durable
// INTENT_AUTHORIZED → durable VALIDATED_CANDIDATES → atomic
// HYPOTHESIS_PERSISTENCE (generated graph + CANDIDATE → ACTIVE admission +
// immutable lifecycle audit, all before durable completion) → managed
// QAN-AUD-06 generation Confidence Batch against the exact ACTIVE version →
// terminal COMPLETED → Redis ACK → duplicate-delivery zero replay.
//
// Deterministic in-process doubles stand in ONLY at the three model/provider
// boundaries; every authority, validation, durability, mutation and Confidence
// rule runs through the real production services and canonical SQL commands.
// The database fixture lives inside one BEGIN ... ROLLBACK transaction on one
// shared pg client; Redis uses a unique stream/group deleted in finally. No
// paid provider call is possible: a smoke-only global fetch guard throws
// A2_E2E_EXTERNAL_HTTP_FORBIDDEN.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createClient, type RedisClientType } from 'redis';
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
import type { HypothesisService } from '../src/hypothesis/hypothesis.service';
import type { EvidenceService } from '../src/memory/evidence.service';
import {
  DeterministicAssociationProposalProvider,
  DeterministicCandidateGenerator,
  DeterministicIntentExtractionProvider,
} from './a2-e2e-smoke/deterministic-providers';
import { PgBackgroundIntelligenceDataApiAdapter } from './a2-e2e-smoke/pg-background-intelligence-data.adapter';
import { PgPostResponseIntelligenceRepositoryAdapter } from './a2-e2e-smoke/pg-post-response-intelligence.adapter';
import { PgRuntimeEventAdminRepositoryAdapter } from './a2-e2e-smoke/pg-runtime-event-admin.adapter';
import { SmokeDbSession } from './a2-e2e-smoke/smoke-db';

// ---------------------------------------------------------------------------
// External network guard: accidental provider/model HTTP is impossible.
// PostgreSQL (pg) and Redis (node-redis) speak raw sockets and are unaffected.
// No OPENAI/ANTHROPIC/GEMINI/provider API key is read anywhere in this smoke.
// ---------------------------------------------------------------------------
globalThis.fetch = ((..._ignored: unknown[]) => {
  throw new Error('A2_E2E_EXTERNAL_HTTP_FORBIDDEN');
}) as unknown as typeof fetch;
// The production PostgREST repositories must never be reachable either: this
// smoke substitutes verification-only pg transport adapters for them.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

// Unique Redis fixture identities, set BEFORE the real transport/consumer are
// constructed (both read these at construction time) and deleted in finally.
const RUN_ID = randomUUID();
const STREAM = `qandeel:a2-e2e-smoke:${RUN_ID}`;
const GROUP = `qandeel-a2-e2e-smoke-group-${RUN_ID}`;
process.env.RUNTIME_EVENT_STREAM = STREAM;
process.env.POST_RESPONSE_CONSUMER_GROUP = GROUP;
process.env.POST_RESPONSE_CONSUMER_NAME = `qandeel-a2-e2e-smoke-consumer-${RUN_ID}`;

// The source-turn text must satisfy the REAL current deterministic rules at
// BOTH gates (verified in-process before any infrastructure is touched):
//   * MemoryWriteEvaluatorService → WRITE (explicit "i decided to ..." single
//     sentence → DECISION_COMMITMENT);
//   * HypothesisGenerationTriggerClassificationService → TRIGGER
//     (INTERNAL_CONTRADICTION: "I decided ... even though ... I ...").
const SOURCE_TURN_TEXT = 'I decided to train every morning even though I keep skipping my sessions';
const ASSISTANT_TURN_TEXT = 'Acknowledged — a deterministic assistant response for the A2 runtime smoke.';
const SEEDED_HYPOTHESIS_STATEMENT = 'Evening fatigue is the main reason planned training gets skipped.';
const GENERATED_CANDIDATE_STATEMENT = 'Committing to a fixed morning training window reduces skipped sessions.';
const INTENT_DOMAIN = 'DECISION' as const;
const EXPECTED_EFFECT_KEYS = [
  'ASSOCIATION_PROVIDER',
  'CANDIDATE_PROVIDER',
  'CONFIDENCE_BATCH',
  'HYPOTHESIS_PERSISTENCE',
  'HYPOTHESIS_UPDATE_BATCH',
  'INTENT_PROVIDER',
  'MEMORY_WRITE',
] as const;

interface EffectRow {
  effect_key: string;
  state: string;
  result_code: string | null;
  result_reference: string | null;
  result_payload: unknown;
  claimed_at: string;
  completed_at: string | null;
}

let stage = 'BASELINE';

/** Never-called foreground dependencies of real services; fail fast if touched. */
function unusedDependency<T>(name: string): T {
  return new Proxy({}, {
    get() {
      throw new Error(`A2_E2E_SMOKE_UNUSED_DEPENDENCY_${name}`);
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
  console.log(`A2_E2E_SMOKE fixture precheck: memory=${memoryCandidate!.type} trigger=${triggerPrecheck.reason}`);

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the A2 E2E runtime smoke.');
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the A2 E2E runtime smoke.');

  const db = new SmokeDbSession(process.env.DATABASE_URL);
  const redisObserver: RedisClientType = createClient({ url: process.env.REDIS_URL });
  redisObserver.on('error', () => undefined);
  const transport = new RedisStreamsTransport();
  const consumer = new RedisPostResponseConsumer();
  const timings = { foreground_finalize_ms: 0, outbox_publish_ms: 0, background_dispatch_ms: 0, total_smoke_ms: 0 };
  let rolledBack = false;

  try {
    await db.open();
    await redisObserver.connect();

    // Managed Supabase gives service_role the platform BYPASSRLS attribute;
    // the ephemeral CI role does not carry it (see verify-migration-0030).
    // Grant it INSIDE the smoke transaction only — catalog DDL is
    // transactional, so ROLLBACK restores the role exactly as found. No
    // repository ACL, policy, constraint or effect semantic is changed.
    const [{ rolbypassrls: initialBypass }] = await db.observer<{ rolbypassrls: boolean }>(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'");
    await db.observer('ALTER ROLE service_role BYPASSRLS');

    // -----------------------------------------------------------------------
    stage = 'FIXTURE';
    // -----------------------------------------------------------------------
    const userId = randomUUID();
    const sessionId = randomUUID();
    const sourceTurnId = randomUUID();
    const assistantTurnId = randomUUID();
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const orchestrationId = randomUUID();
    const seededHypothesisId = randomUUID();
    const sessionScope = `CONVERSATION_SESSION:${sessionId}`;

    await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
    assert.equal((await db.observer('SELECT id FROM public.users WHERE id = $1', [userId])).length, 1,
      'auth trigger provisions the canonical user');

    // Foreground identity: the exact transport PostgREST gives a user request.
    await db.setAuthenticatedClaims(userId);
    const [session] = await db.asRole<{ id: string; status: string; channel: string }>(
      'authenticated', 'SELECT * FROM public.create_conversation_session_v1($1)', [sessionId]);
    assert.equal(session?.status, 'ACTIVE');
    assert.equal(session?.channel, 'TEXT');
    const [received] = await db.asRole<{ id: string; status: string }>(
      'authenticated', 'SELECT * FROM public.create_user_conversation_turn($1, $2, $3)', [sourceTurnId, sessionId, SOURCE_TURN_TEXT]);
    assert.equal(received?.status, 'RECEIVED');

    // Server claim: canonical FAST path.
    const [claimed] = await db.asRole<{ status: string; processing_path: string; routing_reason: string }>(
      'service_role', 'SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)',
      [sessionId, userId, sourceTurnId, 'FAST', 'FAST_DEFAULT']);
    assert.equal(claimed?.status, 'GENERATING');

    // Seed exactly ONE existing session-scoped Hypothesis (version 1) through
    // the canonical narrow server command, before finalization.
    const [seeded] = await db.asRole<{ id: string; version: number; status: string; origin: string; scope: string }>(
      'service_role', 'SELECT * FROM public.background_create_system_hypothesis_v1($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, seededHypothesisId, SEEDED_HYPOTHESIS_STATEMENT, 'CAUSAL', 'GENERAL', sessionScope, [], []]);
    assert.equal(seeded?.id, seededHypothesisId);
    assert.equal(seeded?.version, 1, 'seeded Hypothesis starts at version 1');
    assert.equal(seeded?.status, 'CANDIDATE');
    assert.equal(seeded?.origin, 'SYSTEM_GENERATED');

    // HIM Runtime Consumption v1 fixture: seed exactly ONE session HIM metric
    // (Stress = HIGH) through the canonical authenticated measurement +
    // calculation path, so the session snapshot is genuinely PARTIAL: stress
    // KNOWN, energy and attention UNKNOWN. No raw noncanonical HIM row exists.
    const [stressObservation] = await db.asRole<{ id: string; metric_key: string; response_code: string }>(
      'authenticated', "SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION', $1, 'HIGH', NULL)", [sessionId]);
    assert.equal(stressObservation?.metric_key, 'hse.stress');
    assert.equal(stressObservation?.response_code, 'HIGH');
    const [stressSnapshot] = await db.asRole<{ value_state: string; numeric_value: number }>(
      'authenticated', 'SELECT * FROM public.calculate_hse_stress_measurement($1)', [stressObservation.id]);
    assert.equal(stressSnapshot?.value_state, 'ASSESSED', 'canonical stress calculation produced the assessed session state');
    assert.equal(Number(stressSnapshot?.numeric_value), 4, 'HIGH stores the canonical ordinal code 4');

    // -----------------------------------------------------------------------
    stage = 'CONVERSATION_FINALIZE';
    // -----------------------------------------------------------------------
    const finalizeStart = performance.now();
    const [finalized] = await db.asRole<{ user_turn: Record<string, unknown>; assistant_turn: Record<string, unknown> }>(
      'service_role', 'SELECT * FROM public.finalize_conversation_turn($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [sessionId, userId, sourceTurnId, assistantTurnId, ASSISTANT_TURN_TEXT, 'ALLOW', eventId, correlationId, orchestrationId]);
    timings.foreground_finalize_ms = performance.now() - finalizeStart;
    assert.ok(finalized, 'canonical finalization returns the finalized pair');
    assert.equal(finalized.user_turn.status, 'COMPLETED');
    assert.equal(finalized.assistant_turn.status, 'COMPLETED');
    assert.equal(finalized.assistant_turn.source_turn_id, sourceTurnId);
    // Background work never sees a user JWT: drop the foreground claims now.
    await db.clearAuthenticatedClaims();

    // -----------------------------------------------------------------------
    stage = 'FOREGROUND_ISOLATION';
    // -----------------------------------------------------------------------
    // Providers exist and have never been called; nothing background has run.
    const associationProvider = new DeterministicAssociationProposalProvider(seededHypothesisId, 'SUPPORTING');
    const intentProvider = new DeterministicIntentExtractionProvider(INTENT_DOMAIN);
    const candidateGenerator = new DeterministicCandidateGenerator(GENERATED_CANDIDATE_STATEMENT, 'BEHAVIORAL');

    const [outboxRow] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.runtime_event_outbox WHERE event_id = $1', [eventId]);
    assert.ok(outboxRow, 'durable ConversationTurnCompleted outbox row exists');
    assert.equal(outboxRow.status, 'PENDING', 'outbox row is not yet published');
    assert.equal(outboxRow.event_type, 'ConversationTurnCompleted');
    assert.equal(outboxRow.event_version, '2.0');
    assert.equal(outboxRow.schema_ref, 'qandeel.runtime.conversation-turn-completed.v2');
    assert.equal(outboxRow.subject_user_id, userId);
    assert.equal(outboxRow.subject_session_id, sessionId);
    assert.equal(outboxRow.subject_turn_id, sourceTurnId);
    const outboxPayload = outboxRow.payload as Record<string, unknown>;
    assert.equal(outboxPayload.processing_path, 'FAST');
    assert.equal(outboxPayload.routing_reason, 'FAST_DEFAULT');
    assert.equal(outboxPayload.safety_disposition, 'ALLOW');
    assert.equal(outboxPayload.terminal_status, 'COMPLETED');

    const executionsBefore = await db.observer('SELECT id FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [sourceTurnId]);
    assert.equal(executionsBefore.length, 0, 'no Post-Response execution exists before background start');
    assert.equal(associationProvider.callCount, 0, 'Association provider not called in foreground');
    assert.equal(intentProvider.callCount, 0, 'Intent provider not called in foreground');
    assert.equal(candidateGenerator.callCount, 0, 'Candidate generator not called in foreground');
    const [seededBefore] = await db.observer<{ version: number }>('SELECT version FROM public.hypotheses WHERE id = $1', [seededHypothesisId]);
    assert.equal(seededBefore.version, 1, 'seeded Hypothesis untouched before background start');
    assert.equal((await db.observer('SELECT id FROM public.hypothesis_updates WHERE user_id = $1', [userId])).length, 0,
      'no post-response Hypothesis mutation before background start');
    assert.equal((await db.observer('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length, 0,
      'no turn-derived Memory before background start');
    assert.equal(Number(await redisObserver.exists(STREAM)), 0, 'nothing published to Redis before background start');
    console.log('A2_E2E_SMOKE foreground complete; Post-Response Intelligence provably not started.');

    // -----------------------------------------------------------------------
    stage = 'OUTBOX_PUBLISH';
    // -----------------------------------------------------------------------
    const telemetry = new TelemetryService(new CorrelationService());
    const adminRepository = new PgRuntimeEventAdminRepositoryAdapter(db) as unknown as RuntimeEventAdminRepository;
    const publisher = new RuntimeEventPublisher(adminRepository, transport, telemetry);
    await transport.connect();
    const publishStart = performance.now();
    await publisher.processOnce();
    timings.outbox_publish_ms = performance.now() - publishStart;

    const [publishedRow] = await db.observer<{ status: string; transport_message_id: string | null }>(
      'SELECT status, transport_message_id FROM public.runtime_event_outbox WHERE event_id = $1', [eventId]);
    assert.equal(publishedRow.status, 'PUBLISHED', 'real publisher acknowledged the canonical outbox row');
    assert.ok(publishedRow.transport_message_id, 'outbox carries the real Redis message id');
    const transportMessageId = publishedRow.transport_message_id as string;
    assert.equal(Number(await redisObserver.xLen(STREAM)), 1, 'exactly one real Redis Stream entry');

    // -----------------------------------------------------------------------
    stage = 'REDIS_READ';
    // -----------------------------------------------------------------------
    const pgDataAdapter = new PgBackgroundIntelligenceDataApiAdapter(db);
    const dataApi = pgDataAdapter as unknown as BackgroundIntelligenceDataApiService;
    const ledger = new PgPostResponseIntelligenceRepositoryAdapter(db) as unknown as PostResponseIntelligenceRepository;
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
    assert.equal(entries[0].id, transportMessageId, 'consumer entry id is the acked transport message id');
    const envelope = JSON.parse(entries[0].envelope) as RuntimeEventEnvelope;
    assert.ok(isCompletedRuntimeEventV2(envelope), 'published envelope is a canonical ConversationTurnCompleted v2');
    assert.equal(envelope.event_id, eventId);
    assert.equal(envelope.subject_user_id, userId);
    assert.equal(envelope.subject_session_id, sessionId);
    assert.equal(envelope.subject_turn_id, sourceTurnId);
    assert.equal(envelope.payload.processing_path, 'FAST');
    assert.equal(envelope.payload.safety_disposition, 'ALLOW');

    // One consumer-cycle equivalent: read → dispatch(real envelope) → ACK only
    // when terminal=true (mirrors PostResponseIntelligenceConsumerService).
    const dispatchStart = performance.now();
    const terminal = await dispatcher.dispatch(entries[0].envelope);
    timings.background_dispatch_ms = performance.now() - dispatchStart;
    const [executionRow] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [sourceTurnId]);
    assert.ok(executionRow, 'exactly one execution acquired');
    assert.equal(terminal, true,
      `dispatcher must be terminal (state=${executionRow.state} outcome=${executionRow.outcome_code} stage=${executionRow.current_stage})`);
    const executionId = executionRow.id as string;

    const effectRows = async (): Promise<EffectRow[]> => db.observer<EffectRow>(
      'SELECT effect_key, state, result_code, result_reference, result_payload, claimed_at, completed_at FROM public.post_response_intelligence_effects WHERE execution_id = $1 ORDER BY effect_key', [executionId]);
    const effects = await effectRows();
    const effect = (key: string): EffectRow => {
      const found = effects.find((row) => row.effect_key === key);
      assert.ok(found, `effect ${key} exists`);
      return found;
    };

    // -----------------------------------------------------------------------
    stage = 'MEMORY';
    // -----------------------------------------------------------------------
    const memories = await db.observer<Record<string, unknown>>('SELECT * FROM public.memories WHERE user_id = $1', [userId]);
    assert.equal(memories.length, 1, 'exactly one fresh Memory written');
    assert.equal(memories[0].type, memoryCandidate!.type, 'real evaluator decided the Memory type');
    assert.equal(memories[0].content, memoryCandidate!.content, 'canonical evaluator content stored');
    assert.equal(memories[0].status, 'ACTIVE');
    assert.equal(memories[0].source, 'USER_STATED');
    const freshEvidenceId = `memory:${memories[0].id as string}`;
    const memoryEffect = effect('MEMORY_WRITE');
    assert.equal(memoryEffect.state, 'COMPLETED');
    assert.equal(memoryEffect.result_code, 'FRESH_EVIDENCE_CREATED');
    assert.equal(memoryEffect.result_reference, freshEvidenceId, 'durable fresh Evidence reference is exact');

    // -----------------------------------------------------------------------
    stage = 'ASSOCIATION';
    // -----------------------------------------------------------------------
    assert.equal(associationProvider.callCount, 1, 'Association provider called exactly once');
    const snapshot = associationProvider.snapshots[0];
    assert.equal(snapshot.freshEvidence.evidenceId, freshEvidenceId, 'provider saw the exact fresh Evidence');
    assert.ok(snapshot.candidateHypotheses.some((candidate) => candidate.hypothesisId === seededHypothesisId),
      'provider saw the seeded Hypothesis candidate');
    const associationEffect = effect('ASSOCIATION_PROVIDER');
    assert.equal(associationEffect.state, 'COMPLETED');
    assert.equal(associationEffect.result_code, 'AUTHORIZED_COMMANDS');
    assert.deepEqual(associationEffect.result_payload, [{
      hypothesisId: seededHypothesisId, expectedVersion: 1, evidenceId: freshEvidenceId, evidenceRole: 'SUPPORTING',
    }], 'durable authorized command batch is exact');

    // -----------------------------------------------------------------------
    stage = 'UPDATE_BATCH';
    // -----------------------------------------------------------------------
    const updateBatchEffect = effect('HYPOTHESIS_UPDATE_BATCH');
    assert.equal(updateBatchEffect.state, 'COMPLETED');
    assert.equal(updateBatchEffect.result_code, 'UPDATES_APPLIED');
    const receipts = updateBatchEffect.result_payload as Array<Record<string, unknown>>;
    assert.equal(receipts.length, 1, 'exactly one durable update receipt');
    const receipt = receipts[0];
    assert.equal(receipt.commandOrdinal, 1);
    assert.equal(receipt.hypothesisId, seededHypothesisId);
    assert.equal(receipt.expectedVersion, 1);
    assert.equal(receipt.beforeVersion, 1);
    assert.equal(receipt.afterVersion, 2);
    assert.equal(receipt.evidenceId, freshEvidenceId);
    assert.equal(receipt.evidenceRole, 'SUPPORTING');
    assert.equal(receipt.confidenceStatus, 'EVALUATED', 'happy-path receipt Confidence status is EVALUATED');

    const [mutated] = await db.observer<{ version: number; supporting_evidence_ids: string[]; contradicting_evidence_ids: string[] }>(
      'SELECT version, supporting_evidence_ids, contradicting_evidence_ids FROM public.hypotheses WHERE id = $1', [seededHypothesisId]);
    assert.equal(mutated.version, 2, 'seeded Hypothesis version incremented exactly once');
    assert.deepEqual(mutated.supporting_evidence_ids, [freshEvidenceId], 'exact Evidence attached exactly once in the requested role');
    assert.deepEqual(mutated.contradicting_evidence_ids, []);

    const audits = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypothesis_updates WHERE hypothesis_id = $1', [seededHypothesisId]);
    assert.equal(audits.length, 1, 'exactly one immutable hypothesis_updates audit');
    assert.equal(audits[0].id, receipt.updateId, 'audit row carries the exact receipt update id');
    assert.equal(audits[0].source, 'QANDEEL_HYPOTHESIS_UPDATE_LOOP');
    assert.equal(audits[0].before_version, 1);
    assert.equal(audits[0].after_version, 2);
    assert.equal(audits[0].evidence_id, freshEvidenceId);

    // -----------------------------------------------------------------------
    stage = 'UPDATE_CONFIDENCE';
    // -----------------------------------------------------------------------
    const [updateConfidence] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.confidence_evaluations WHERE id = $1', [receipt.confidenceEvaluationId as string]);
    assert.ok(updateConfidence, 'exact-version post-update Confidence row exists under the exact receipt id');
    assert.equal(updateConfidence.target_id, seededHypothesisId);
    assert.equal(updateConfidence.target_type, 'HYPOTHESIS');
    assert.equal(updateConfidence.target_version, 2, 'Confidence targets exactly the receipt afterVersion');
    assert.equal(updateConfidence.user_id, userId);
    assert.equal(updateConfidence.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');

    // -----------------------------------------------------------------------
    stage = 'INTENT';
    // -----------------------------------------------------------------------
    assert.equal(intentProvider.callCount, 1, 'Intent provider called exactly once');
    const intentEffect = effect('INTENT_PROVIDER');
    assert.equal(intentEffect.state, 'COMPLETED');
    assert.equal(intentEffect.result_code, 'INTENT_AUTHORIZED');
    const durableIntent = intentEffect.result_payload as Record<string, unknown>;
    assert.equal(durableIntent.domain, INTENT_DOMAIN);
    assert.deepEqual(durableIntent.evidenceIds, [freshEvidenceId], 'authorized Intent bound to the exact fresh Evidence set');
    const intentScope = durableIntent.scope as Record<string, unknown>;
    assert.equal(intentScope.kind, 'CONVERSATION_SESSION');
    assert.equal(intentScope.sessionId, sessionId, 'Intent scope bound to the current conversation session');
    assert.equal(intentScope.serialized, sessionScope);
    assert.equal((durableIntent.problem as Record<string, unknown>).sourceTurnId, sourceTurnId);

    // -----------------------------------------------------------------------
    stage = 'CANDIDATE';
    // -----------------------------------------------------------------------
    assert.equal(candidateGenerator.callCount, 1, 'Candidate generator called exactly once');
    const candidateEffect = effect('CANDIDATE_PROVIDER');
    assert.equal(candidateEffect.state, 'COMPLETED');
    assert.equal(candidateEffect.result_code, 'VALIDATED_CANDIDATES');
    const validated = candidateEffect.result_payload as Array<Record<string, unknown>>;
    assert.equal(validated.length, 1, 'exactly one validated durable candidate');
    const generatedHypothesisId = validated[0].hypothesisId as string;
    assert.match(generatedHypothesisId, /^[0-9a-f-]{36}$/iu, 'stable server-assigned candidate UUID');
    assert.equal(validated[0].statement, GENERATED_CANDIDATE_STATEMENT);
    assert.equal(validated[0].domain, INTENT_DOMAIN);
    assert.equal(validated[0].scope, sessionScope);
    assert.deepEqual(validated[0].supportingEvidenceIds, [freshEvidenceId]);

    // -----------------------------------------------------------------------
    stage = 'HIM_CONSUMPTION';
    // -----------------------------------------------------------------------
    // HIM Runtime Consumption v1: the fresh Candidate Generator received the
    // EXACT minimized session HIM structured state - canonical metric order
    // stress -> energy -> attention, the seeded KNOWN Stress category exact,
    // energy/attention explicitly UNKNOWN with null categories - via exactly
    // one canonical background snapshot read taken before the Candidate claim.
    assert.equal(pgDataAdapter.himSnapshotReadCount, 1, 'exactly one canonical background HIM snapshot read');
    const receivedHimContext = candidateGenerator.requests[0].himContext;
    assert.deepEqual(receivedHimContext, {
      contractVersion: 1, source: 'HIM_STRUCTURED_STATE', contextKind: 'CONVERSATION_SESSION',
      metrics: [
        { metricKey: 'hse.stress', knowledgeState: 'KNOWN', ordinalCategory: 'HIGH' },
        { metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null },
        { metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', ordinalCategory: null },
      ],
    }, 'provider-facing HIM context is the exact minimized partial-state contract');
    const serializedHim = JSON.stringify(receivedHimContext);
    assert.ok(!serializedHim.includes(userId), 'no user UUID in the provider-facing HIM context');
    assert.ok(!serializedHim.includes(sessionId), 'no session UUID in the provider-facing HIM context');
    assert.doesNotMatch(serializedHim, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/iu, 'no UUID of any kind leaks through HIM');
    assert.doesNotMatch(serializedHim, /observedAt|generatedAt|freshness|confidence|numeric|instrument|scale|model|binding|calculation|provenance|event|observation|trend|score|readiness|diagnosis/iu,
      'no numeric storage value, timestamp, provenance identifier, or inferred field leaks through HIM');

    // -----------------------------------------------------------------------
    stage = 'PERSISTENCE';
    // -----------------------------------------------------------------------
    const persistenceEffect = effect('HYPOTHESIS_PERSISTENCE');
    assert.equal(persistenceEffect.state, 'COMPLETED');
    assert.equal(persistenceEffect.result_code, 'HYPOTHESES_PERSISTED');
    assert.deepEqual(persistenceEffect.result_payload, [generatedHypothesisId],
      'atomic persistence recorded the exact same stable Hypothesis UUID');
    const [generated] = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypotheses WHERE id = $1', [generatedHypothesisId]);
    assert.ok(generated, 'generated Hypothesis exists');
    assert.equal(generated.user_id, userId);
    assert.equal(generated.statement, GENERATED_CANDIDATE_STATEMENT);
    assert.equal(generated.domain, INTENT_DOMAIN);
    assert.equal(generated.scope, sessionScope);
    assert.equal(generated.origin, 'SYSTEM_GENERATED');
    // Migration 0036: the generated Hypothesis is admitted CANDIDATE -> ACTIVE
    // inside this same atomic persistence transaction, so by the time
    // HYPOTHESIS_PERSISTENCE is durably COMPLETED it is already ACTIVE.
    assert.equal(generated.status, 'ACTIVE',
      'the generated Hypothesis is durably ACTIVE by the time HYPOTHESIS_PERSISTENCE is completed');
    assert.deepEqual(generated.supporting_evidence_ids, [freshEvidenceId]);
    const generatedVersion = generated.version as number;
    const lifecycleAudits = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1 ORDER BY created_at, id',
      [generatedHypothesisId]);
    assert.equal(lifecycleAudits.length, 1, 'exactly one CANDIDATE -> ACTIVE lifecycle audit for the generated target');
    assert.equal(lifecycleAudits[0].user_id, userId);
    assert.equal(lifecycleAudits[0].before_status, 'CANDIDATE');
    assert.equal(lifecycleAudits[0].after_status, 'ACTIVE');
    assert.equal(lifecycleAudits[0].source, 'SYSTEM_GENERATION_ACTIVATION');
    assert.equal(lifecycleAudits[0].after_version, (lifecycleAudits[0].before_version as number) + 1,
      'the activation incremented the version exactly once');
    assert.equal(lifecycleAudits[0].after_version, generatedVersion,
      'the audited post-activation version is the durable ACTIVE version');
    // The seeded Hypothesis was mutated by the Update Loop, never transitioned:
    // Evidence attachment is not a lifecycle decision.
    assert.equal((await db.observer(
      'SELECT id FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1', [seededHypothesisId])).length, 0,
      'Evidence attachment produced no lifecycle transition on the seeded Hypothesis');

    // -----------------------------------------------------------------------
    stage = 'GENERATION_CONFIDENCE';
    // -----------------------------------------------------------------------
    const confidenceBatchEffect = effect('CONFIDENCE_BATCH');
    assert.equal(confidenceBatchEffect.state, 'COMPLETED');
    // QAN-AUD-06: CONFIDENCE_BATCH is managed and typed. Its durable result is
    // the exact ordered receipt of every frozen target, so a completed batch
    // proves every generated Hypothesis really has its Confidence snapshot.
    assert.equal(confidenceBatchEffect.result_code, 'CONFIDENCE_BATCH_EVALUATED', 'CONFIDENCE_BATCH carries the typed durable result');
    assert.equal(confidenceBatchEffect.result_reference, null);
    const confidenceReceipts = confidenceBatchEffect.result_payload as Array<Record<string, unknown>>;
    assert.equal(confidenceReceipts.length, 1, 'exactly one Confidence receipt for the single persisted Hypothesis');
    assert.equal(confidenceReceipts[0].ordinal, 1);
    assert.equal(confidenceReceipts[0].hypothesisId, generatedHypothesisId, 'the receipt targets the exact durably persisted Hypothesis');
    assert.equal(confidenceReceipts[0].targetVersion, generatedVersion,
      'the receipt carries the exact frozen post-activation ACTIVE version, never the pre-activation Candidate version');
    const generatedConfidence = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.confidence_evaluations WHERE target_id = $1', [generatedHypothesisId]);
    assert.equal(generatedConfidence.length, 1, 'generation Confidence Batch happy path succeeded');
    assert.equal(generatedConfidence[0].id, confidenceReceipts[0].confidenceEvaluationId,
      'the receipt points at the exact generated Confidence evaluation');
    assert.equal(generatedConfidence[0].user_id, userId);
    assert.equal(generatedConfidence[0].target_type, 'HYPOTHESIS');
    assert.equal(generatedConfidence[0].target_version, generatedVersion, 'canonical Confidence targets the exact frozen generated version');
    // The evaluated snapshot is the ACTIVE state: the target version it froze is
    // exactly the version the CANDIDATE -> ACTIVE activation produced, and the
    // Evidence it recorded is the ACTIVE row's Evidence.
    assert.equal(generatedConfidence[0].target_version, lifecycleAudits[0].after_version,
      'the Confidence evaluation targets the exact post-activation ACTIVE version');
    assert.notEqual(generatedConfidence[0].target_version, lifecycleAudits[0].before_version,
      'no generated Confidence receipt refers to the pre-activation Candidate version');
    assert.deepEqual(generatedConfidence[0].supporting_evidence_ids, generated.supporting_evidence_ids,
      'the Confidence snapshot is the ACTIVE Hypothesis state');
    assert.equal(generatedConfidence[0].provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
    const confidenceItems = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_confidence_batch_items WHERE execution_id = $1 ORDER BY ordinal', [executionId]);
    assert.equal(confidenceItems.length, 1, 'exactly one durable Confidence batch item');
    assert.equal(confidenceItems[0].state, 'EVALUATED');
    assert.equal(confidenceItems[0].failure_code, null);
    assert.equal(confidenceItems[0].hypothesis_id, generatedHypothesisId);
    assert.equal(confidenceItems[0].target_version, generatedVersion);
    assert.equal(confidenceItems[0].confidence_evaluation_id, confidenceReceipts[0].confidenceEvaluationId);

    // -----------------------------------------------------------------------
    stage = 'TERMINAL';
    // -----------------------------------------------------------------------
    const allExecutions = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId]);
    assert.equal(allExecutions.length, 1, 'exactly one Post-Response execution');
    assert.equal(allExecutions[0].state, 'COMPLETED');
    assert.equal(allExecutions[0].outcome_code, 'COMPLETED');
    assert.ok(allExecutions[0].terminal_at, 'terminal_at recorded');
    assert.equal(allExecutions[0].attempt_count, 1);
    assert.equal(allExecutions[0].event_id, eventId);
    assert.equal(allExecutions[0].event_version, '2.0');
    assert.equal(allExecutions[0].processing_path, 'FAST');
    assert.equal(allExecutions[0].safety_disposition, 'ALLOW');
    assert.deepEqual(effects.map((row) => row.effect_key).sort(), [...EXPECTED_EFFECT_KEYS],
      'exact expected effect set with no stray effect');
    assert.ok(effects.every((row) => row.state === 'COMPLETED'), 'every effect is COMPLETED');

    // -----------------------------------------------------------------------
    stage = 'REDIS_ACK';
    // -----------------------------------------------------------------------
    await consumer.ack(entries[0].id);
    const pendingAfterAck = await redisObserver.xPending(STREAM, GROUP);
    assert.equal(pendingAfterAck.pending, 0, 'primary Redis message ACKed; group pending count is zero');

    // -----------------------------------------------------------------------
    stage = 'DUPLICATE_DELIVERY';
    // -----------------------------------------------------------------------
    const effectsBeforeDuplicate = JSON.stringify(await effectRows());
    const confidenceItemRows = async (): Promise<unknown[]> => db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_confidence_batch_items WHERE execution_id = $1 ORDER BY ordinal', [executionId]);
    const confidenceItemsBeforeDuplicate = JSON.stringify(await confidenceItemRows());
    const lifecycleAuditRows = async (): Promise<unknown[]> => db.observer<Record<string, unknown>>(
      'SELECT * FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1 ORDER BY created_at, id', [userId]);
    const lifecycleBeforeDuplicate = JSON.stringify(await lifecycleAuditRows());
    const countsBefore = {
      memories: (await db.observer('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length,
      hypotheses: (await db.observer('SELECT id FROM public.hypotheses WHERE user_id = $1', [userId])).length,
      audits: (await db.observer('SELECT id FROM public.hypothesis_updates WHERE user_id = $1', [userId])).length,
      confidence: (await db.observer('SELECT id FROM public.confidence_evaluations WHERE user_id = $1', [userId])).length,
      lifecycle: (await db.observer('SELECT id FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1', [userId])).length,
    };
    assert.deepEqual(countsBefore, { memories: 1, hypotheses: 2, audits: 1, confidence: 2, lifecycle: 1 });

    // One duplicate Redis message carrying the byte-identical runtime envelope.
    await redisObserver.xAdd(STREAM, '*', { event_id: eventId, envelope: entries[0].envelope });
    const duplicateEntries = await consumer.read();
    assert.equal(duplicateEntries.length, 1, 'real consumer reads the duplicate delivery');
    assert.equal(duplicateEntries[0].envelope, entries[0].envelope, 'duplicate envelope is byte-identical');
    const duplicateTerminal = await dispatcher.dispatch(duplicateEntries[0].envelope);
    assert.equal(duplicateTerminal, true, 'duplicate dispatch is terminal');
    await consumer.ack(duplicateEntries[0].id);
    assert.equal((await redisObserver.xPending(STREAM, GROUP)).pending, 0, 'duplicate ACKed; pending back to zero');

    const executionsAfterDuplicate = await db.observer<Record<string, unknown>>(
      'SELECT * FROM public.post_response_intelligence_executions WHERE user_id = $1', [userId]);
    assert.equal(executionsAfterDuplicate.length, 1, 'no second execution');
    assert.equal(executionsAfterDuplicate[0].attempt_count, 1, 'terminal execution attempt count unchanged');
    assert.equal(executionsAfterDuplicate[0].state, 'COMPLETED');
    const countsAfter = {
      memories: (await db.observer('SELECT id FROM public.memories WHERE user_id = $1', [userId])).length,
      hypotheses: (await db.observer('SELECT id FROM public.hypotheses WHERE user_id = $1', [userId])).length,
      audits: (await db.observer('SELECT id FROM public.hypothesis_updates WHERE user_id = $1', [userId])).length,
      confidence: (await db.observer('SELECT id FROM public.confidence_evaluations WHERE user_id = $1', [userId])).length,
      lifecycle: (await db.observer('SELECT id FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1', [userId])).length,
    };
    assert.deepEqual(countsAfter, countsBefore,
      'no second Memory write, Hypothesis mutation, audit, generated Hypothesis, lifecycle transition or duplicate Confidence');
    const [seededAfter] = await db.observer<{ version: number }>('SELECT version FROM public.hypotheses WHERE id = $1', [seededHypothesisId]);
    assert.equal(seededAfter.version, 2, 'seeded Hypothesis version unchanged by redelivery');
    const [generatedAfter] = await db.observer<{ version: number; status: string }>(
      'SELECT version, status FROM public.hypotheses WHERE id = $1', [generatedHypothesisId]);
    assert.deepEqual({ version: generatedAfter.version, status: generatedAfter.status },
      { version: generatedVersion, status: 'ACTIVE' }, 'generated Hypothesis lifecycle unchanged by redelivery');
    assert.equal(JSON.stringify(await lifecycleAuditRows()), lifecycleBeforeDuplicate,
      'durable lifecycle audit rows byte-equivalent after duplicate: no duplicate transition, no duplicate audit row');
    assert.equal(JSON.stringify(await effectRows()), effectsBeforeDuplicate, 'durable effect payloads byte-equivalent after duplicate');
    assert.equal(JSON.stringify(await confidenceItemRows()), confidenceItemsBeforeDuplicate,
      'durable Confidence batch items byte-equivalent after duplicate: no re-evaluation, no new item, no state churn');
    assert.equal(associationProvider.callCount, 1, 'no Association provider replay');
    assert.equal(intentProvider.callCount, 1, 'no Intent provider replay');
    assert.equal(candidateGenerator.callCount, 1, 'no Candidate generator replay');
    assert.equal(pgDataAdapter.himSnapshotReadCount, 1,
      'zero HIM re-consumption after durable Candidate completion: the duplicate delivery performed no snapshot reread');

    // -----------------------------------------------------------------------
    stage = 'CLEANUP';
    // -----------------------------------------------------------------------
    await db.rollback();
    rolledBack = true;
    assert.equal((await db.afterRollback('SELECT id FROM public.users WHERE id = $1', [userId])).length, 0, 'fixture user rolled back');
    assert.equal((await db.afterRollback('SELECT event_id FROM public.runtime_event_outbox WHERE event_id = $1', [eventId])).length, 0, 'outbox row rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.post_response_intelligence_executions WHERE source_turn_id = $1', [sourceTurnId])).length, 0, 'execution rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.hypotheses WHERE user_id = $1', [userId])).length, 0, 'hypotheses rolled back');
    assert.equal((await db.afterRollback('SELECT ordinal FROM public.post_response_confidence_batch_items WHERE execution_id = $1', [executionId])).length, 0,
      'Confidence batch items rolled back');
    assert.equal((await db.afterRollback('SELECT id FROM public.hypothesis_lifecycle_transitions WHERE user_id = $1', [userId])).length, 0,
      'lifecycle transition audit rolled back');
    const [{ rolbypassrls: finalBypass }] = await db.afterRollback<{ rolbypassrls: boolean }>(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'");
    assert.equal(finalBypass, initialBypass, 'transaction-scoped service_role attribute restored by rollback');

    timings.total_smoke_ms = performance.now() - totalStart;
    console.log('A2_E2E_TIMINGS');
    console.log(`foreground_finalize_ms=${timings.foreground_finalize_ms.toFixed(1)}`);
    console.log(`outbox_publish_ms=${timings.outbox_publish_ms.toFixed(1)}`);
    console.log(`background_dispatch_ms=${timings.background_dispatch_ms.toFixed(1)}`);
    console.log(`total_smoke_ms=${timings.total_smoke_ms.toFixed(1)}`);
    console.log('A2_E2E_RUNTIME_SMOKE PASS: full canonical A2 path composed end-to-end on real PostgreSQL + Redis; duplicate delivery was a zero-replay no-op; DB fixture rolled back.');
  } finally {
    if (!rolledBack) await db.rollback().catch(() => undefined);
    await consumer.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
    try {
      if (redisObserver.isOpen) {
        await redisObserver.del(STREAM);
        const remaining = Number(await redisObserver.exists(STREAM));
        console.log(`A2_E2E_SMOKE Redis fixture stream deleted (exists=${remaining}).`);
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
  console.error(`A2_E2E_RUNTIME_SMOKE FAILED stage=${stage}: ${message}`);
  process.exitCode = 1;
});
