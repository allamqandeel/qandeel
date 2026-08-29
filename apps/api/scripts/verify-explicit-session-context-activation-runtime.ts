// QHIA-011A Explicit Session Context Activation Application Entry v1 -
// focused real-PostgreSQL runtime proof.
//
// It drives the COMPLETE production application chain
//
//   ConversationContextActivationController
//     -> ConversationContextActivationService
//       -> HimSessionContextBindingService
//         -> HimSessionContextBindingRepository
//           -> migration-0055 set/clear/read RPCs
//
// against real PostgreSQL 17, and then proves the activated context is really
// consumable by the UNCHANGED foreground path: the real
// HimCrossContextForegroundRepository issues the real migration-0060
// aggregate-v3 request and the real HimGoalMotivationConsumptionService decodes
// the resulting raw row into its already-frozen ACTIVE guidance.
//
// Every class above is the real production class. The ONLY substitute is a
// verification-only PostgREST transport adapter, because CI provides PostgreSQL
// without PostgREST; it executes exactly the request shapes the frozen
// production repositories emit, with the same per-request role and the same
// transaction-local JWT claims PostgREST would set, and fails closed on
// anything else. It adds NO authority: ownership, kind, session state, target
// existence, idempotency, atomic replacement and race safety all stay inside
// migration 0055.
//
// Nothing here direct-INSERTs a binding row, and nothing here invents Motivation
// semantics: the GOAL target and its LOW hse.motivation@1 measurement are
// created through the existing canonical structured measurement authorities.
//
// The whole fixture lives inside ONE BEGIN ... ROLLBACK transaction.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConversationContextActivationController } from '../src/conversation/conversation-context-activation.controller';
import { ConversationContextActivationService } from '../src/conversation/conversation-context-activation.service';
import type { AuthenticatedRequest } from '../src/auth/authenticated-request';
import { HimSessionContextBindingRepository } from '../src/human-model/him-session-context-binding.repository';
import { HimSessionContextBindingService } from '../src/human-model/him-session-context-binding.service';
import { HimCrossContextForegroundRepository } from '../src/human-model/him-cross-context-foreground.repository';
import { HimCrossContextForegroundAggregationService } from '../src/human-model/him-cross-context-foreground-aggregation.service';
import { HimSituationStressConsumptionService } from '../src/human-model/him-situation-stress-consumption.service';
import { HimSituationStressRepository } from '../src/human-model/him-situation-stress.repository';
import { HimDecisionAttentionConsumptionService } from '../src/human-model/him-decision-attention-consumption.service';
import { HimDecisionAttentionRepository } from '../src/human-model/him-decision-attention.repository';
import { HimGoalMotivationConsumptionService } from '../src/human-model/him-goal-motivation-consumption.service';
import { HimGoalMotivationRepository } from '../src/human-model/him-goal-motivation.repository';
import { HimRelationshipCommunicationConsumptionService } from '../src/human-model/him-relationship-communication-consumption.service';
import { HimRelationshipCommunicationRepository } from '../src/human-model/him-relationship-communication.repository';
import type { MemoryDataApiService } from '../src/memory/memory-data-api.service';
import { SmokeDbSession } from './a2-e2e-smoke/smoke-db';

// No provider, model, or external HTTP boundary participates in an explicit
// activation. Sealing fetch makes that structural rather than asserted.
globalThis.fetch = ((..._ignored: unknown[]) => {
  throw new Error('EXPLICIT_SESSION_CONTEXT_ACTIVATION_EXTERNAL_HTTP_FORBIDDEN');
}) as unknown as typeof fetch;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_PUBLISHABLE_KEY;

const ACCESS_TOKEN = 'explicit-session-context-activation-transport-token';
const SET_RPC = 'set_him_session_context_binding_v1';
const CLEAR_RPC = 'clear_him_session_context_binding_v1';
const READ_RPC = 'read_him_session_context_bindings_v1';
const AGGREGATE_RPC = 'read_him_session_cross_context_foreground_v3';
// The exact frozen QHIA-010 answer for a bound Goal whose canonical current
// hse.motivation@1 value is LOW. This verifier invents none of it.
const ACTIVE_GOAL_GUIDANCE = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' } as const;
const NONE_GUIDANCE = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' } as const;
const ACTIVATION_SOURCE = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1';

let stage = 'BASELINE';

/**
 * Verification-only authenticated PostgREST substitute, structurally
 * compatible with MemoryDataApiService: request(accessToken, path, init).
 *
 * The allowlist is deliberately EXACT: the three migration-0055 binding
 * commands plus the migration-0060 aggregate-v3 read. Any other request the
 * production chain might make - a direct binding-table route, a target lookup,
 * a target listing, a measurement write, a second relevance authority - fails
 * closed here and is therefore provably absent rather than merely unobserved.
 *
 * The census records the ATTEMPT before the allowlist decision, so a refused
 * request is still counted; completions are recorded only after the statement
 * really ran.
 */
class PgActivationDataApiAdapter {
  private static readonly ALLOWED = new Set([SET_RPC, CLEAR_RPC, READ_RPC, AGGREGATE_RPC]);
  private readonly attempted = new Map<string, number>();
  private readonly completed = new Map<string, number>();
  private readonly failed = new Map<string, number>();

  constructor(private readonly db: SmokeDbSession) {}

  attempts(name: string): number { return this.attempted.get(name) ?? 0; }
  completions(name: string): number { return this.completed.get(name) ?? 0; }
  failures(name: string): number { return this.failed.get(name) ?? 0; }
  attemptedNames(): string[] { return [...this.attempted.keys()].sort(); }

  private static bump(counts: Map<string, number>, name: string): void {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  async request<T>(_accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('rpc/')) throw new Error(`EXPLICIT_ACTIVATION_UNSUPPORTED_REQUEST:${path.split('?')[0]}`);
    const name = path.slice('rpc/'.length);
    PgActivationDataApiAdapter.bump(this.attempted, name);
    try {
      if (!PgActivationDataApiAdapter.ALLOWED.has(name)) throw new Error(`EXPLICIT_ACTIVATION_UNSUPPORTED_RPC:${name}`);
      if ((init.method ?? 'POST') !== 'POST' || typeof init.body !== 'string') throw new Error('EXPLICIT_ACTIVATION_UNSUPPORTED_RPC_METHOD');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      const entries = Object.entries(body);
      for (const [key] of entries) {
        if (!/^p_[a-z_]+$/u.test(key)) throw new Error('EXPLICIT_ACTIVATION_UNSUPPORTED_RPC_ARGUMENT');
      }
      const args = entries.map(([key], index) => `${key} => $${index + 1}`).join(', ');
      const rows = await this.db.asRole('authenticated', `SELECT * FROM public.${name}(${args})`, entries.map(([, value]) => value));
      PgActivationDataApiAdapter.bump(this.completed, name);
      return rows as T;
    } catch (error) {
      PgActivationDataApiAdapter.bump(this.failed, name);
      throw error;
    }
  }
}

const authenticated = (userId: string): AuthenticatedRequest => ({
  headers: { authorization: 'Bearer verification-only-raw-header-value' },
  authenticatedUser: { userId, accessToken: ACCESS_TOKEN },
});

async function rejects(work: () => Promise<unknown>, label: string): Promise<void> {
  let threw = false;
  try {
    await work();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, `${label} must fail closed`);
}

interface BindingRow {
  id: string;
  user_id: string;
  conversation_session_id: string;
  context_kind: string;
  context_id: string;
  binding_version: number;
  status: string;
  binding_source: string;
  created_at: string;
  retired_at: string | null;
  canonical_provenance: string;
}

interface MeasurementCensus {
  events: string;
  observations: string;
  calculations: string;
  snapshots: string;
  targets: string;
  snapshot_digest: string | null;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the explicit session context activation runtime verifier.');
  }
  const db = new SmokeDbSession(process.env.DATABASE_URL);
  let rolledBack = false;

  try {
    await db.open();

    // -----------------------------------------------------------------------
    stage = 'FIXTURE';
    // -----------------------------------------------------------------------
    const ownerId = randomUUID();
    const intruderId = randomUUID();
    const ownerSessionId = randomUUID();
    const ownerInactiveSessionId = randomUUID();
    const intruderSessionId = randomUUID();

    await db.observer('INSERT INTO auth.users (id) VALUES ($1), ($2)', [ownerId, intruderId]);

    // The intruder's own owned session and owned GOAL target, created under the
    // intruder's own authenticated identity. They exist so cross-user isolation
    // is proven against REAL foreign rows, never against absence.
    await db.setAuthenticatedClaims(intruderId);
    await db.asRole('authenticated', 'SELECT * FROM public.create_conversation_session_v1($1)', [intruderSessionId]);
    const [intruderGoal] = await db.asRole<{ id: string }>(
      'authenticated', "SELECT * FROM public.create_him_motivation_measurement_target('GOAL', 'qhia-011a foreign goal')");

    // The owner's fixture.
    await db.setAuthenticatedClaims(ownerId);
    const [ownerSession] = await db.asRole<{ id: string; status: string; channel: string }>(
      'authenticated', 'SELECT * FROM public.create_conversation_session_v1($1)', [ownerSessionId]);
    assert.equal(ownerSession.status, 'ACTIVE', 'the canonical session authority created an ACTIVE session');
    assert.equal(ownerSession.channel, 'TEXT');
    await db.asRole('authenticated', 'SELECT * FROM public.create_conversation_session_v1($1)', [ownerInactiveSessionId]);
    // conversation_sessions carries no mutation guard trigger, so the inactive
    // fixture is a direct superuser status flip - never an application path.
    await db.observer("UPDATE public.conversation_sessions SET status = 'CLOSED' WHERE id = $1", [ownerInactiveSessionId]);

    // The exact owned GOAL context and its canonical LOW hse.motivation@1
    // measurement, both through the EXISTING canonical authorities.
    const [goalTarget] = await db.asRole<{ id: string; context_kind: string }>(
      'authenticated', "SELECT * FROM public.create_him_motivation_measurement_target('GOAL', 'qhia-011a activated goal')");
    assert.equal(goalTarget.context_kind, 'GOAL');
    const [replacementGoal] = await db.asRole<{ id: string }>(
      'authenticated', "SELECT * FROM public.create_him_motivation_measurement_target('GOAL', 'qhia-011a replacement goal')");
    const [situationTarget] = await db.asRole<{ id: string; context_kind: string }>(
      'authenticated', "SELECT * FROM public.create_him_motivation_measurement_target('SITUATION', 'qhia-011a coexisting situation')");
    assert.equal(situationTarget.context_kind, 'SITUATION');
    const [motivationObservation] = await db.asRole<{ id: string; metric_key: string; response_code: string }>(
      'authenticated', "SELECT * FROM public.create_hse_motivation_measurement($1, 'LOW', NULL)", [goalTarget.id]);
    assert.equal(motivationObservation.metric_key, 'hse.motivation');
    assert.equal(motivationObservation.response_code, 'LOW');
    const [motivationSnapshot] = await db.asRole<{ value_state: string; numeric_value: number }>(
      'authenticated', 'SELECT * FROM public.calculate_hse_motivation_measurement($1)', [motivationObservation.id]);
    assert.equal(motivationSnapshot.value_state, 'ASSESSED', 'the canonical calculation produced the assessed Goal state');
    assert.equal(motivationSnapshot.numeric_value, 2, 'the canonical LOW ordinal is 2 on the frozen five-point scale');

    // The REAL production chain over the verification-only transport.
    const transport = new PgActivationDataApiAdapter(db);
    const dataApi = transport as unknown as MemoryDataApiService;
    const bindingRepository = new HimSessionContextBindingRepository(dataApi);
    const bindingService = new HimSessionContextBindingService(bindingRepository);
    const activationService = new ConversationContextActivationService(bindingService);
    const activationController = new ConversationContextActivationController(activationService);
    // The unchanged foreground consumption path, composed exactly as the
    // Conversation Orchestrator composes it.
    const goalMotivationConsumer = new HimGoalMotivationConsumptionService(new HimGoalMotivationRepository(dataApi));
    const crossContextRepository = new HimCrossContextForegroundRepository(dataApi);
    const crossContext = new HimCrossContextForegroundAggregationService(
      crossContextRepository,
      new HimSituationStressConsumptionService(new HimSituationStressRepository(dataApi)),
      new HimDecisionAttentionConsumptionService(new HimDecisionAttentionRepository(dataApi)),
      goalMotivationConsumer,
      new HimRelationshipCommunicationConsumptionService(new HimRelationshipCommunicationRepository(dataApi)),
    );

    const bindingRows = (userId: string): Promise<BindingRow[]> => db.observer<BindingRow>(
      'SELECT * FROM public.him_session_context_bindings WHERE user_id = $1 ORDER BY context_kind, binding_version', [userId]);
    const measurementCensus = (userId: string): Promise<MeasurementCensus[]> => db.observer<MeasurementCensus>(
      `SELECT
         (SELECT count(*) FROM public.him_measurement_events WHERE user_id = $1) events,
         (SELECT count(*) FROM public.him_measurement_observations WHERE user_id = $1) observations,
         (SELECT count(*) FROM public.him_calculation_results WHERE user_id = $1) calculations,
         (SELECT count(*) FROM public.him_metric_snapshots WHERE user_id = $1) snapshots,
         (SELECT count(*) FROM public.him_measurement_targets WHERE user_id = $1) targets,
         (SELECT md5(string_agg(s.id::text || ':' || coalesce(s.numeric_value::text, '-') || ':' || s.value_state
            || ':' || s.validity_status || ':' || s.snapshot_version::text, ',' ORDER BY s.id))
          FROM public.him_metric_snapshots s WHERE s.user_id = $1) snapshot_digest`, [userId]);

    assert.equal((await bindingRows(ownerId)).length, 0, 'no relevance binding exists before the explicit product action');
    const [measurementBefore] = await measurementCensus(ownerId);
    assert.equal(transport.attempts(SET_RPC), 0, 'the fixture issued no activation write of its own');

    // -----------------------------------------------------------------------
    stage = 'EXPLICIT_ACTIVATION';
    // -----------------------------------------------------------------------
    const activated = await activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: goalTarget.id });
    assert.deepEqual(activated, {
      contractVersion: 1,
      source: ACTIVATION_SOURCE,
      sessionId: ownerSessionId,
      activeBinding: { contextKind: 'GOAL', contextId: goalTarget.id },
    }, 'the product response carries the exact active context and no internal binding lifecycle metadata');
    for (const internal of ['bindingId', 'bindingVersion', 'binding_source', 'canonical_provenance', 'created_at', 'retired_at', 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING']) {
      assert.equal(JSON.stringify(activated).includes(internal), false, `the product response never exposes ${internal}`);
    }
    // Exactly ONE authority command, and no read-before-write of any kind.
    assert.equal(transport.attempts(SET_RPC), 1, 'exactly one migration-0055 set command was issued');
    assert.equal(transport.completions(SET_RPC), 1, 'the set command really ran against real PostgreSQL');
    assert.equal(transport.failures(SET_RPC), 0);
    assert.equal(transport.attempts(READ_RPC), 0, 'the activation performed no read before the write');
    assert.equal(transport.attempts(CLEAR_RPC), 0, 'the activation performed no clear before the write');

    let rows = await bindingRows(ownerId);
    assert.equal(rows.length, 1, 'exactly one binding row exists');
    assert.equal(rows[0].status, 'ACTIVE');
    assert.equal(rows[0].binding_version, 1);
    assert.equal(rows[0].context_kind, 'GOAL');
    assert.equal(rows[0].context_id, goalTarget.id);
    assert.equal(rows[0].conversation_session_id, ownerSessionId);
    assert.equal(rows[0].user_id, ownerId);
    assert.equal(rows[0].retired_at, null);
    assert.equal(rows[0].binding_source, 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING');
    assert.equal(rows[0].canonical_provenance, 'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1');

    // -----------------------------------------------------------------------
    stage = 'FOREGROUND_CONSUMPTION';
    // -----------------------------------------------------------------------
    // The UNCHANGED foreground path consumes the explicit activation: one real
    // migration-0060 aggregate-v3 request, four rows, the Goal slot genuinely
    // bound to the exact activated target.
    const boundEnvelope = await crossContextRepository.readSessionCrossContextForeground(ACCESS_TOKEN, ownerId, ownerSessionId);
    assert.equal(boundEnvelope.length, 4, 'the aggregate answers with exactly four transport rows');
    assert.deepEqual(
      boundEnvelope.map((row) => [row.foreground_slot_order, row.foreground_slot, row.binding_state]),
      [[1, 'SITUATION_STRESS', 'NO_ACTIVE_SITUATION'], [2, 'DECISION_ATTENTION', 'NO_ACTIVE_DECISION'],
        [3, 'GOAL_MOTIVATION', 'ACTIVE_GOAL_BOUND'], [4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP']],
      'only the explicitly activated Goal slot is bound; the three unactivated channels stay authoritatively unbound');
    const goalRow = boundEnvelope[2];
    assert.equal(goalRow.binding_context_id, goalTarget.id, 'the aggregate resolved exactly the activated Goal');
    assert.equal(goalRow.metric_key, 'hse.motivation');
    assert.equal(goalRow.definition_version, 1);
    assert.equal(goalRow.context_kind, 'GOAL');
    assert.equal(goalRow.context_id, goalTarget.id);
    assert.equal(goalRow.has_canonical_current_value, true);
    assert.equal(goalRow.value_state, 'ASSESSED');
    assert.equal(goalRow.numeric_value, 2);
    for (const unbound of [boundEnvelope[0], boundEnvelope[1], boundEnvelope[3]]) {
      assert.equal(unbound.binding_context_id, null, 'an unactivated slot resolved no context');
      assert.equal(unbound.metric_key, null, 'an unactivated slot read no metric');
      assert.equal(unbound.numeric_value, null, 'an unactivated slot carries no value');
    }
    // The REAL QHIA-010 consumer alone, and then through the REAL aggregate.
    assert.deepEqual(goalMotivationConsumer.consumeSourceRows([goalRow]), ACTIVE_GOAL_GUIDANCE,
      'the real Goal-motivation consumer decodes the activated LOW reading into its already-frozen ACTIVE guidance');
    assert.deepEqual(await crossContext.read(ownerId, ACCESS_TOKEN, ownerSessionId), {
      contractVersion: 3,
      situationStress: NONE_GUIDANCE,
      decisionAttention: NONE_GUIDANCE,
      goalMotivation: ACTIVE_GOAL_GUIDANCE,
      relationshipCommunication: NONE_GUIDANCE,
    }, 'the unchanged aggregate yields ACTIVE Goal guidance and nothing else changed');

    // -----------------------------------------------------------------------
    stage = 'EXPLICIT_READ';
    // -----------------------------------------------------------------------
    const read = await activationController.readActiveContexts(authenticated(ownerId), ownerSessionId);
    assert.deepEqual(read, {
      contractVersion: 1, source: ACTIVATION_SOURCE, sessionId: ownerSessionId, bindingCount: 1,
      bindings: [{ contextKind: 'GOAL', contextId: goalTarget.id }],
    }, 'the product read carries exact identity facts only');
    assert.equal(transport.attempts(READ_RPC), 1, 'the product read issued exactly one migration-0055 read command');

    // -----------------------------------------------------------------------
    stage = 'IDEMPOTENT_REPLAY';
    // -----------------------------------------------------------------------
    const replayed = await activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: goalTarget.id });
    assert.deepEqual(replayed, activated, 'replaying the same exact target answers identically');
    assert.equal(transport.attempts(SET_RPC), 2, 'the replay was one more single set command, never a clear plus a set');
    assert.equal(transport.attempts(CLEAR_RPC), 0);
    rows = await bindingRows(ownerId);
    assert.equal(rows.length, 1, 'the same-target replay created no new binding version');
    assert.equal(rows[0].binding_version, 1);
    assert.equal(rows[0].status, 'ACTIVE');
    assert.equal(rows[0].retired_at, null);
    const replayRowId = rows[0].id;

    // -----------------------------------------------------------------------
    stage = 'REPLACEMENT';
    // -----------------------------------------------------------------------
    const replaced = await activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: replacementGoal.id });
    assert.deepEqual(replaced.activeBinding, { contextKind: 'GOAL', contextId: replacementGoal.id });
    assert.equal(transport.attempts(SET_RPC), 3, 'replacement is ONE set command');
    assert.equal(transport.attempts(CLEAR_RPC), 0, 'replacement is never implemented as clear then set');
    rows = await bindingRows(ownerId);
    assert.equal(rows.length, 2, 'the previous binding is retired in place, never deleted');
    const retired = rows.find((row) => row.id === replayRowId);
    const current = rows.find((row) => row.id !== replayRowId);
    assert.ok(retired && current, 'both the retired and the next binding version exist');
    assert.equal(retired!.status, 'RETIRED');
    assert.equal(retired!.context_id, goalTarget.id);
    assert.ok(retired!.retired_at !== null && retired!.retired_at >= retired!.created_at,
      'the retired binding keeps a non-reversed lifecycle chronology');
    assert.equal(current!.status, 'ACTIVE');
    assert.equal(current!.binding_version, 2);
    assert.equal(current!.context_id, replacementGoal.id);
    assert.equal(current!.retired_at, null);

    // -----------------------------------------------------------------------
    stage = 'CROSS_KIND_COEXISTENCE';
    // -----------------------------------------------------------------------
    const situationActivated = await activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'SITUATION', { contextId: situationTarget.id });
    assert.deepEqual(situationActivated.activeBinding, { contextKind: 'SITUATION', contextId: situationTarget.id });
    const coexisting = await activationController.readActiveContexts(authenticated(ownerId), ownerSessionId);
    assert.deepEqual(coexisting.bindings, [
      { contextKind: 'GOAL', contextId: replacementGoal.id },
      { contextKind: 'SITUATION', contextId: situationTarget.id },
    ], 'the two kinds coexist independently, in the canonical fixed kind order');
    assert.equal(coexisting.bindingCount, 2);
    const activeAfterCoexistence = (await bindingRows(ownerId)).filter((row) => row.status === 'ACTIVE');
    assert.equal(activeAfterCoexistence.length, 2, 'activating one kind cleared no other kind');

    // -----------------------------------------------------------------------
    stage = 'NEGATIVE_ISOLATION';
    // -----------------------------------------------------------------------
    const setAttemptsBeforeNegatives = transport.attempts(SET_RPC);
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), intruderSessionId, 'GOAL', { contextId: goalTarget.id }), 'a foreign conversation session');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: intruderGoal.id }), 'a foreign measurement target');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: situationTarget.id }), 'a wrong-kind measurement target');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: randomUUID() }), 'an unknown measurement target');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), randomUUID(), 'GOAL', { contextId: goalTarget.id }), 'an unknown conversation session');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerInactiveSessionId, 'GOAL', { contextId: goalTarget.id }), 'an inactive conversation session');
    await rejects(() => activationController.readActiveContexts(
      authenticated(ownerId), ownerInactiveSessionId), 'reading an inactive conversation session');
    await rejects(() => activationController.readActiveContexts(
      authenticated(ownerId), intruderSessionId), 'reading a foreign conversation session');
    // Structural rejections never reach the authority at all.
    const attemptsBeforeStructural = transport.attempts(SET_RPC);
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GLOBAL', { contextId: goalTarget.id }), 'the GLOBAL kind');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'CONVERSATION_SESSION', { contextId: goalTarget.id }), 'the CONVERSATION_SESSION kind');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: 'my current problem' }), 'a free-text target');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', { contextId: goalTarget.id, displayText: 'quit my job' }), 'an extra display field');
    await rejects(() => activationController.activateContext(
      authenticated(ownerId), ownerSessionId, 'GOAL', undefined), 'a missing body');
    assert.equal(transport.attempts(SET_RPC), attemptsBeforeStructural,
      'every structural rejection happened before transport: the authority was never asked');
    assert.equal(transport.failures(SET_RPC), attemptsBeforeStructural - setAttemptsBeforeNegatives,
      'every authority-level rejection was a real refused command, never a silent success');
    // Nothing leaked: the owner's binding state is exactly what it was.
    const afterNegatives = (await bindingRows(ownerId)).filter((row) => row.status === 'ACTIVE');
    assert.equal(afterNegatives.length, 2, 'no rejected activation created, replaced, or retired anything');
    assert.equal((await bindingRows(intruderId)).length, 0, 'no binding was ever created for the other user');

    // -----------------------------------------------------------------------
    stage = 'EXPLICIT_CLEAR';
    // -----------------------------------------------------------------------
    const cleared = await activationController.deactivateContext(authenticated(ownerId), ownerSessionId, 'GOAL');
    assert.deepEqual(cleared, {
      contractVersion: 1, source: ACTIVATION_SOURCE, sessionId: ownerSessionId, contextKind: 'GOAL', cleared: true,
    }, 'the clear response reports only whether an active context of that kind existed');
    assert.equal(JSON.stringify(cleared).includes(replacementGoal.id), false, 'the clear response discloses no retired target identity');
    assert.equal(transport.attempts(CLEAR_RPC), 1, 'exactly one migration-0055 clear command was issued');
    const clearedAgain = await activationController.deactivateContext(authenticated(ownerId), ownerSessionId, 'GOAL');
    assert.equal(clearedAgain.cleared, false, 'clearing an already-clear kind is idempotent');
    assert.equal(transport.attempts(CLEAR_RPC), 2);
    // The unrelated kind is untouched.
    const afterClear = await activationController.readActiveContexts(authenticated(ownerId), ownerSessionId);
    assert.deepEqual(afterClear.bindings, [{ contextKind: 'SITUATION', contextId: situationTarget.id }],
      'clearing one kind left the other kind active');
    // Preserved QHIA-006 lifecycle semantics: clear stays available on an owned
    // session that is no longer ACTIVE.
    const inactiveClear = await activationController.deactivateContext(authenticated(ownerId), ownerInactiveSessionId, 'GOAL');
    assert.equal(inactiveClear.cleared, false, 'clearing an owned inactive session keeps its existing QHIA-006 behavior');
    await rejects(() => activationController.deactivateContext(
      authenticated(ownerId), intruderSessionId, 'GOAL'), 'clearing a foreign conversation session');
    // The coexisting kind is cleared through the same product entry, so the
    // final state below is exactly the pre-activation state again.
    assert.equal((await activationController.deactivateContext(authenticated(ownerId), ownerSessionId, 'SITUATION')).cleared, true);
    assert.equal((await activationController.readActiveContexts(authenticated(ownerId), ownerSessionId)).bindingCount, 0,
      'the session has no explicit activation left');

    // -----------------------------------------------------------------------
    stage = 'UNBOUND_AGAIN';
    // -----------------------------------------------------------------------
    const unboundEnvelope = await crossContextRepository.readSessionCrossContextForeground(ACCESS_TOKEN, ownerId, ownerSessionId);
    assert.deepEqual(
      unboundEnvelope.map((row) => [row.foreground_slot_order, row.foreground_slot, row.binding_state]),
      [[1, 'SITUATION_STRESS', 'NO_ACTIVE_SITUATION'], [2, 'DECISION_ATTENTION', 'NO_ACTIVE_DECISION'],
        [3, 'GOAL_MOTIVATION', 'NO_ACTIVE_GOAL'], [4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP']],
      'clearing through the product entry returned every channel to authoritatively unbound');
    assert.equal(unboundEnvelope[2].binding_context_id, null);
    assert.equal(unboundEnvelope[2].numeric_value, null);
    assert.deepEqual(goalMotivationConsumer.consumeSourceRows([unboundEnvelope[2]]), NONE_GUIDANCE,
      'the real Goal-motivation consumer decodes the cleared channel back to NONE / DEFAULT');
    assert.deepEqual(await crossContext.read(ownerId, ACCESS_TOKEN, ownerSessionId), {
      contractVersion: 3,
      situationStress: NONE_GUIDANCE,
      decisionAttention: NONE_GUIDANCE,
      goalMotivation: NONE_GUIDANCE,
      relationshipCommunication: NONE_GUIDANCE,
    }, 'the aggregate Goal channel is NONE again and nothing else changed');

    // -----------------------------------------------------------------------
    stage = 'NON_MUTATION';
    // -----------------------------------------------------------------------
    const [measurementAfter] = await measurementCensus(ownerId);
    assert.deepEqual(measurementAfter, measurementBefore,
      'no activation, replacement, read, clear, or rejection created, changed, or invalidated a measurement target, event, observation, calculation, or snapshot');
    // The entire run touched EXACTLY the four allowlisted authorities and
    // nothing else: no target lookup, no target listing, no direct binding
    // table route, no second relevance authority, no measurement write.
    assert.deepEqual(transport.attemptedNames(), [AGGREGATE_RPC, CLEAR_RPC, READ_RPC, SET_RPC].sort(),
      'the production chain requested exactly the existing QHIA-006 commands and the unchanged aggregate');
    console.log('EXPLICIT_SESSION_CONTEXT_ACTIVATION census: '
      + `set_attempted=${transport.attempts(SET_RPC)} set_completed=${transport.completions(SET_RPC)} `
      + `set_failed=${transport.failures(SET_RPC)} clear_attempted=${transport.attempts(CLEAR_RPC)} `
      + `read_attempted=${transport.attempts(READ_RPC)} aggregate_attempted=${transport.attempts(AGGREGATE_RPC)}`);

    // -----------------------------------------------------------------------
    stage = 'CLEANUP';
    // -----------------------------------------------------------------------
    await db.rollback();
    rolledBack = true;
    assert.equal((await db.afterRollback(
      'SELECT id FROM public.him_session_context_bindings WHERE user_id = ANY($1::uuid[])', [[ownerId, intruderId]])).length, 0,
      'every binding fixture is discarded by the transaction rollback');
    assert.equal((await db.afterRollback('SELECT id FROM auth.users WHERE id = ANY($1::uuid[])', [[ownerId, intruderId]])).length, 0,
      'every user fixture is discarded by the transaction rollback');
    console.log('Explicit Session Context Activation runtime: PASS');
  } catch (error) {
    console.error(`Explicit Session Context Activation runtime FAILED at stage ${stage}`);
    throw error;
  } finally {
    if (!rolledBack) {
      try { await db.rollback(); } catch { /* the connection is closed below regardless */ }
    }
    await db.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
