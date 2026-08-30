// Real-PostgreSQL verifier for migration 0063 - QIR-006 Question /
// Information-Gap Closed Loop v1. Proves: the total durable Information Gap
// lifecycle (OPEN/RESOLVED/SUPERSEDED + protected reopen-by-epoch) with its
// closure-metadata constraints and guard trigger; canonical closure/reopen
// reconciliation through the versioned synchronization authority (same-version
// missing-code disappearance RESOLVED, still-present OPEN, stale version /
// ineligible lifecycle SUPERSEDED, recurrence reopening exactly once) with the
// v1 entry point delegating to v2; the narrow service-role-only atomic
// selection command (ownership, GENERATING requirement, automatic-source-only
// eligibility, same-session scope authority, cross-session exclusion,
// stale-version and ineligible-lifecycle exclusion, deterministic ordering,
// same-turn idempotency, one outstanding formal Question per session, per-epoch
// once-only asking); the versioned finalization authority binding atomically
// (BOUND with the completed assistant turn, duplicate finalization no-op,
// stale/foreign/non-SELECTED bindings failing closed) with the retired
// pre-0063 finalization signature closed as a bypass; the ONE database-owned
// terminal release mechanism on finalize-without-consumption, failure,
// cancellation, and expired-GENERATING recovery (idempotent, never blocking a
// later legitimate selection); binding-substrate immutability and zero direct
// role privileges; and a real two-connection concurrent-selection proof.
import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import process from 'node:process'; import pg from 'pg';
const { Client } = pg; const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });

async function identity(id) { await client.query('SET LOCAL ROLE authenticated'); await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, role: 'authenticated' })]); }
async function resetRole() { await client.query('RESET ROLE'); await client.query("SELECT set_config('request.jwt.claims','',true)"); }
async function rejects(text, values, codes) {
  await client.query('SAVEPOINT expected_failure'); let error;
  try { await client.query(text, values); } catch (caught) { error = caught; } finally { await client.query('ROLLBACK TO SAVEPOINT expected_failure'); await client.query('RELEASE SAVEPOINT expected_failure'); }
  assert.ok(error, `expected rejection for: ${text}`);
  if (codes) assert.ok(codes.includes(error.code), `unexpected code ${error.code} (${error.message}) for: ${text}`);
  return error;
}
async function asServiceRole(work) { await client.query('SET LOCAL ROLE service_role'); try { return await work(); } finally { await resetRole(); } }
const rows = async (text, values = []) => (await client.query(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];

async function selectOpportunity(userId, sessionId, turnId) {
  return asServiceRole(async () => one('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [userId, sessionId, turnId]));
}
async function syncGaps(executionId) {
  return asServiceRole(async () => (await one('SELECT public.sync_post_response_information_gaps_v1($1) AS value', [executionId])).value);
}
async function finalizeV2(sessionId, userId, turnId, assistantId, bindingId) {
  return asServiceRole(async () => rows('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [sessionId, userId, turnId, assistantId, 'assistant text', 'ALLOW', randomUUID(), null, null, bindingId ?? null]));
}
async function insertSession(userId, id) {
  await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [id, userId]);
}
async function insertGeneratingTurn(userId, sessionId, id) {
  await client.query("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason) VALUES($1,$2,$3,'USER','GENERATING','question verifier turn','FAST','FAST_DEFAULT')", [id, sessionId, userId]);
}
async function insertHypothesis(userId, id, version, sessionId, status = 'ACTIVE') {
  await client.query("INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,version) VALUES($1,$2,$3,'CAUSAL','GENERAL',$4,'HUMAN_REVIEWED',$5,$6)",
    [id, userId, `verifier-0063 hypothesis ${id}`, `CONVERSATION_SESSION:${sessionId}`, status, version]);
}
async function insertEvaluation(userId, id, hypothesisId, targetVersion, codes) {
  await client.query("INSERT INTO public.confidence_evaluations(id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,alternative_hypothesis_ids,missing_information_codes,policy_version,provenance) VALUES($1,$2,$3,'HYPOTHESIS',$4,1,'EVALUATED',NULL,NULL,'UNCALIBRATED','UNASSESSED','{}','{}','{}','{}',$5,'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME')",
    [id, userId, hypothesisId, targetVersion, codes]);
}
async function insertExecution(userId, id) {
  await client.query("INSERT INTO public.post_response_intelligence_executions(id,event_id,user_id,session_id,source_turn_id,event_version,processing_path,safety_disposition,state,current_stage,outcome_code,terminal_at) VALUES($1,$2,$3,$4,$5,'2.0','FAST','ALLOW','RUNNING','VERIFIER_0063',NULL,NULL)",
    [id, randomUUID(), userId, randomUUID(), randomUUID()]);
}
async function insertConfidenceEffect(executionId, receipts) {
  await client.query("INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,'CONFIDENCE_BATCH','COMPLETED',CURRENT_TIMESTAMP,'CONFIDENCE_BATCH_EVALUATED',$2)",
    [executionId, JSON.stringify(receipts)]);
}
// One durable Confidence statement for (hypothesis, version, codes) delivered
// through a fresh RUNNING execution, exactly as the canonical background path
// would deliver it.
async function statedConfidence(userId, hypothesisId, targetVersion, codes) {
  const evaluationId = randomUUID(); const executionId = randomUUID();
  await insertEvaluation(userId, evaluationId, hypothesisId, targetVersion, [...codes, 'CONFIDENCE_MODEL_UNCALIBRATED']);
  await insertExecution(userId, executionId);
  await insertConfidenceEffect(executionId, [{ ordinal: 1, hypothesisId, targetVersion, confidenceEvaluationId: evaluationId }]);
  return { evaluationId, executionId };
}
async function gapFor(hypothesisId, targetVersion, code) {
  return one('SELECT g.* FROM public.information_gaps g JOIN public.information_gap_confidence_sources s ON s.information_gap_id=g.id WHERE s.hypothesis_id=$1 AND s.target_version=$2 AND s.missing_information_code=$3', [hypothesisId, targetVersion, code]);
}

const SELECT_RPC = 'public.select_formal_question_opportunity_v1(uuid,uuid,uuid)';
const FINALIZE_V2 = 'public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid)';
const RETIRED_FINALIZE = 'public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)';
const SYNC_V1 = 'public.sync_post_response_information_gaps_v1(uuid)';
const SYNC_V2 = 'public.sync_post_response_information_gaps_v2(uuid)';

async function verifyStaticAuthority() {
  // Narrow RPC ACLs: selection, v2 finalization and v2 synchronization are
  // service-role-only definer commands; the v1 synchronization entry point
  // keeps its service-role EXECUTE and is a pure delegation; the retired
  // finalization signature holds zero EXECUTE for every application role.
  for (const [signature, expectations] of [
    [SELECT_RPC, { service: true, authenticated: false, anon: false }],
    [FINALIZE_V2, { service: true, authenticated: false, anon: false }],
    [SYNC_V2, { service: true, authenticated: false, anon: false }],
    [SYNC_V1, { service: true, authenticated: false, anon: false }],
    [RETIRED_FINALIZE, { service: false, authenticated: false, anon: false }],
  ]) {
    const acl = await one("SELECT has_function_privilege('service_role',$1,'EXECUTE') service,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('anon',$1,'EXECUTE') anon", [signature]);
    assert.deepEqual(acl, expectations, `ACL mismatch for ${signature}`);
  }
  const contract = await one(`SELECT
    pg_get_functiondef(to_regprocedure($1)) retired_definition,
    pg_get_functiondef(to_regprocedure($2)) sync_v1_definition,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.formal_question_turn_bindings'::regclass) bindings_rls`,
    [RETIRED_FINALIZE, SYNC_V1]);
  assert.match(contract.retired_definition, /RETIRED_CONVERSATION_FINALIZATION_AUTHORITY/u, 'the retired finalization signature is a raising tombstone');
  assert.doesNotMatch(contract.retired_definition, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|runtime_event_outbox/iu, 'the tombstone contains no write and no outbox reach');
  assert.match(contract.sync_v1_definition, /sync_post_response_information_gaps_v2/u, 'the v1 synchronization entry point delegates to the v2 authority');
  assert.doesNotMatch(contract.sync_v1_definition, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/iu, 'the v1 entry point contains no write of its own');
  assert.equal(contract.bindings_rls, true, 'the binding substrate has RLS enabled');
  // Zero direct binding-substrate privileges for every application role, and
  // information_gaps keeps read-only client access (no direct mutation).
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.formal_question_turn_bindings', privilege]);
      assert.equal(allowed, false, `${role} must hold no ${privilege} on the binding substrate`);
    }
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const { allowed } = await one('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.information_gaps', privilege]);
      assert.equal(allowed, false, `${role} must hold no direct ${privilege} on information_gaps`);
    }
  }
  for (const [table, trigger] of [
    ['public.information_gaps', 'information_gap_lifecycle_guard'],
    ['public.formal_question_turn_bindings', 'formal_question_turn_binding_guard'],
    ['public.conversation_turns', 'conversation_turn_formal_question_release'],
  ]) {
    const found = await one('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND tgname=$2 AND NOT tgisinternal', [table, trigger]);
    assert.equal(found.n, 1, `guard/release trigger ${trigger} exists on ${table}`);
  }
  for (const index of ['formal_question_one_active_reservation_per_gap_epoch', 'formal_question_one_selected_reservation_per_session']) {
    const found = await one("SELECT count(*)::int n FROM pg_indexes WHERE schemaname='public' AND tablename='formal_question_turn_bindings' AND indexname=$1", [index]);
    assert.equal(found.n, 1, `partial unique concurrency index ${index} exists`);
  }
}

async function main() { await client.connect(); try {
  await verifyStaticAuthority();
  await client.query('BEGIN'); try {
  const alice = randomUUID(), mallory = randomUUID();
  await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)', [alice, mallory]);
  const sessionA = randomUUID(), sessionB = randomUUID(), sessionM = randomUUID();
  await insertSession(alice, sessionA); await insertSession(alice, sessionB); await insertSession(mallory, sessionM);
  // Hypotheses: two session-A questioning targets, one session-B target, one
  // lifecycle-ineligible target and one whose version will move on.
  const hFirst = randomUUID(), hSecond = randomUUID(), hOther = randomUUID(), hRejected = randomUUID(), hStale = randomUUID();
  await insertHypothesis(alice, hFirst, 2, sessionA);
  await insertHypothesis(alice, hSecond, 1, sessionA, 'CANDIDATE');
  await insertHypothesis(alice, hOther, 1, sessionB);
  await insertHypothesis(alice, hRejected, 1, sessionA);
  await insertHypothesis(alice, hStale, 1, sessionA);
  // Materialize the automatic gaps through the canonical synchronization
  // authority - never a hand INSERT.
  const firstStatement = await statedConfidence(alice, hFirst, 2, ['UNVERIFIED_ASSUMPTIONS']);
  await syncGaps(firstStatement.executionId);
  const secondStatement = await statedConfidence(alice, hSecond, 1, ['NO_ELIGIBLE_EVIDENCE']);
  await syncGaps(secondStatement.executionId);
  const otherStatement = await statedConfidence(alice, hOther, 1, ['COMPETING_HYPOTHESES_UNASSESSED']);
  await syncGaps(otherStatement.executionId);
  const rejectedStatement = await statedConfidence(alice, hRejected, 1, ['UNVERIFIED_ASSUMPTIONS']);
  await syncGaps(rejectedStatement.executionId);
  const staleStatement = await statedConfidence(alice, hStale, 1, ['UNVERIFIED_ASSUMPTIONS']);
  await syncGaps(staleStatement.executionId);
  // Post-materialization ineligibility fixtures.
  await client.query("UPDATE public.hypotheses SET status='REJECTED' WHERE id=$1", [hRejected]);
  await client.query('UPDATE public.hypotheses SET version=3 WHERE id=$1', [hStale]);
  // A manual (non-automatic) gap must never be a selection target.
  await identity(alice);
  await client.query('SELECT * FROM public.create_information_gap($1::jsonb)', [{
    id: randomUUID(), information_needed: 'manual need', why_it_matters: 'manual reason',
    related_hypothesis_ids: [hFirst], confidence_evaluation_id: null,
  }]);
  await resetRole();

  // --- A. Durable lifecycle shape and closure-metadata constraints ----------
  const firstGap = await gapFor(hFirst, 2, 'UNVERIFIED_ASSUMPTIONS');
  const secondGap = await gapFor(hSecond, 1, 'NO_ELIGIBLE_EVIDENCE');
  const otherGap = await gapFor(hOther, 1, 'COMPETING_HYPOTHESES_UNASSESSED');
  assert.deepEqual([firstGap.status, firstGap.open_epoch, firstGap.closed_at, firstGap.closure_reason], ['OPEN', 1, null, null],
    'a materialized automatic gap is an epoch-1 OPEN row with no closure metadata');
  await rejects("INSERT INTO public.information_gaps(id,user_id,information_needed,why_it_matters,status) VALUES($1,$2,'x','y','RESOLVED')", [randomUUID(), alice], ['23514']);
  await rejects("INSERT INTO public.information_gaps(id,user_id,information_needed,why_it_matters,status,closed_at,closure_reason) VALUES($1,$2,'x','y','RESOLVED',CURRENT_TIMESTAMP,'HYPOTHESIS_VERSION_ADVANCED')", [randomUUID(), alice], ['23514']);
  await rejects("INSERT INTO public.information_gaps(id,user_id,information_needed,why_it_matters,status,open_epoch) VALUES($1,$2,'x','y','OPEN',0)", [randomUUID(), alice], ['23514']);
  // Illegal direct lifecycle mutation fails even for the superuser path: the
  // protected transition authorization is required, so no API role - which
  // holds no UPDATE/DELETE privilege at all - can ever forge closure or reopen.
  await rejects("UPDATE public.information_gaps SET status='RESOLVED',closed_at=CURRENT_TIMESTAMP,closure_reason='MISSING_INFORMATION_CODE_ABSENT',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [firstGap.id], ['42501']);
  await rejects('DELETE FROM public.information_gaps WHERE id=$1', [firstGap.id], ['55000']);
  // Even WITH the internal transition authorization, non-lifecycle columns are
  // immutable and a non-monotonic epoch jump is refused: reopen is +1 exactly.
  await client.query("SELECT set_config('qandeel.information_gap_lifecycle_transition','authorized',true)");
  await rejects("UPDATE public.information_gaps SET information_needed='rewritten' WHERE id=$1", [firstGap.id], ['42501']);
  await rejects("UPDATE public.information_gaps SET status='OPEN',open_epoch=open_epoch+2 WHERE id=$1", [firstGap.id], ['42501']);
  await client.query("SELECT set_config('qandeel.information_gap_lifecycle_transition','',true)");

  // --- B. Selection: ownership, GENERATING requirement, eligibility ---------
  const turnA1 = randomUUID(), turnA2 = randomUUID(), turnB1 = randomUUID(), turnM1 = randomUUID();
  await insertGeneratingTurn(alice, sessionA, turnA1);
  await insertGeneratingTurn(alice, sessionA, turnA2);
  await insertGeneratingTurn(alice, sessionB, turnB1);
  await insertGeneratingTurn(mallory, sessionM, turnM1);
  await client.query('SET LOCAL ROLE anon');
  await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionA, turnA1], ['42501']);
  await resetRole();
  await identity(alice);
  await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionA, turnA1], ['42501']);
  await resetRole();
  await asServiceRole(async () => {
    await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [mallory, sessionA, turnA1], ['42501']);
    await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionM, turnM1], ['42501']);
    await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionB, turnA1], ['42501']);
    await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionA, randomUUID()], ['42501']);
  });
  const receivedTurn = randomUUID();
  await client.query("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','RECEIVED','not yet claimed')", [receivedTurn, sessionA, alice]);
  await asServiceRole(async () => {
    await rejects('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [alice, sessionA, receivedTurn], ['22023']);
  });
  // Deterministic ordering: both session-A gaps share the transaction-frozen
  // creation instant, so the canonical (created_at, id) ordering degenerates
  // to the stable UUID tie-break - assert exactly that.
  const eligible = [firstGap, secondGap].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  // The fixture ids are random, so derive the roles from the CANONICAL
  // ordering itself: `primary` is whichever eligible gap the deterministic
  // ordering makes first (and therefore the one turnA1 reserves), `spare` is
  // the other. Every later closure/reopen scenario targets `primary`.
  const primary = eligible[0].id === firstGap.id
    ? { gap: firstGap, hypothesis: hFirst, version: 2, code: 'UNVERIFIED_ASSUMPTIONS', questionType: 'VALIDATION' }
    : { gap: secondGap, hypothesis: hSecond, version: 1, code: 'NO_ELIGIBLE_EVIDENCE', questionType: 'FACT_FINDING' };
  const spare = eligible[0].id === firstGap.id ? secondGap : firstGap;
  const firstSelection = await selectOpportunity(alice, sessionA, turnA1);
  assert.equal(firstSelection.outcome, 'SELECTED');
  const binding = await one('SELECT * FROM public.formal_question_turn_bindings WHERE id=$1', [firstSelection.binding_id]);
  assert.equal(binding.information_gap_id, primary.gap.id, 'selection follows the canonical creation ordinal with the stable UUID tie-break');
  assert.equal(firstSelection.question_type, primary.questionType, 'the server-derived question type maps the exact source category');
  assert.deepEqual({ user: binding.user_id, session: binding.session_id, turn: binding.source_turn_id, epoch: binding.gap_open_epoch, state: binding.state, assistant: binding.assistant_turn_id },
    { user: alice, session: sessionA, turn: turnA1, epoch: 1, state: 'SELECTED', assistant: null },
    'the reservation snapshots exact ownership and the exact reserved open epoch');
  const boundSource = await one('SELECT * FROM public.information_gap_confidence_sources WHERE information_gap_id=$1', [binding.information_gap_id]);
  assert.deepEqual({ hypothesis: binding.hypothesis_id, version: binding.hypothesis_version, code: binding.missing_information_code },
    { hypothesis: boundSource.hypothesis_id, version: boundSource.target_version, code: boundSource.missing_information_code },
    'the reservation snapshots exactly the automatic source tuple');
  // Same-turn idempotency: the SAME reservation is reused, no second row.
  const retry = await selectOpportunity(alice, sessionA, turnA1);
  assert.deepEqual(retry, firstSelection, 'a legitimate same-turn retry reuses the same SELECTED reservation');
  assert.equal((await rows('SELECT id FROM public.formal_question_turn_bindings WHERE source_turn_id=$1', [turnA1])).length, 1);
  // One outstanding reservation per session: a concurrent GENERATING turn of
  // the same session legitimately answers empty.
  const concurrent = await selectOpportunity(alice, sessionA, turnA2);
  assert.deepEqual(concurrent, { outcome: 'OUTSTANDING_OPEN_QUESTION', binding_id: null, question_type: null });
  // Cross-session authority: session B selects ONLY its own session-scoped
  // gap; the session-A gaps are invisible to it and vice versa.
  const otherSelection = await selectOpportunity(alice, sessionB, turnB1);
  assert.equal(otherSelection.outcome, 'SELECTED');
  const otherBinding = await one('SELECT * FROM public.formal_question_turn_bindings WHERE id=$1', [otherSelection.binding_id]);
  assert.equal(otherBinding.information_gap_id, otherGap.id, 'cross-session gaps are never selectable: scope authority is the canonical Hypothesis session scope');
  assert.equal(otherSelection.question_type, 'DISCRIMINATING');
  // Lifecycle-ineligible and stale-version gaps are excluded; a released
  // session-B world with no remaining eligible gap answers NO_ELIGIBLE_GAP.
  await asServiceRole(async () => { await client.query('SELECT * FROM public.fail_conversation_turn($1,$2,$3,$4,$5,$6)', [sessionB, alice, turnB1, randomUUID(), null, null]); });
  const turnB2 = randomUUID(); await insertGeneratingTurn(alice, sessionB, turnB2);
  const afterRelease = await selectOpportunity(alice, sessionB, turnB2);
  assert.equal(afterRelease.outcome, 'SELECTED', 'a RELEASED reservation never blocks a later legitimate selection of the same gap epoch');
  assert.equal((await one('SELECT count(*)::int n FROM public.formal_question_turn_bindings WHERE information_gap_id=$1', [otherGap.id])).n, 2, 'the released epoch was reserved again by a fresh reservation row');

  // --- C. The ONE database-owned release mechanism on every terminal path ---
  const releasedB1 = await one('SELECT * FROM public.formal_question_turn_bindings WHERE source_turn_id=$1', [turnB1]);
  assert.equal(releasedB1.state, 'RELEASED', 'fail_conversation_turn released the unconsumed reservation in the same transaction');
  assert.ok(releasedB1.released_at !== null && releasedB1.assistant_turn_id === null && releasedB1.bound_at === null);
  // Idempotent: a second failure attempt of the same turn is a no-op and the
  // release stays exactly once.
  await asServiceRole(async () => { await client.query('SELECT * FROM public.fail_conversation_turn($1,$2,$3,$4,$5,$6)', [sessionB, alice, turnB1, randomUUID(), null, null]); });
  assert.equal((await one('SELECT state FROM public.formal_question_turn_bindings WHERE id=$1', [releasedB1.id])).state, 'RELEASED');
  // Cancellation path (authenticated user command).
  const cancelBinding = await one('SELECT id FROM public.formal_question_turn_bindings WHERE source_turn_id=$1', [turnB2]);
  await identity(alice);
  await client.query('SELECT * FROM public.cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [sessionB, alice, turnB2, randomUUID(), null, null]);
  await resetRole();
  assert.equal((await one('SELECT state FROM public.formal_question_turn_bindings WHERE id=$1', [cancelBinding.id])).state, 'RELEASED', 'cancellation released the unconsumed reservation');
  // Expired-GENERATING recovery path.
  const turnB3 = randomUUID(); await insertGeneratingTurn(alice, sessionB, turnB3);
  const recoverySelection = await selectOpportunity(alice, sessionB, turnB3);
  assert.equal(recoverySelection.outcome, 'SELECTED');
  await client.query("UPDATE public.conversation_turns SET updated_at=CURRENT_TIMESTAMP-interval '10 minutes', generation_claimed_at=CURRENT_TIMESTAMP-interval '10 minutes', generation_lease_expires_at=CURRENT_TIMESTAMP-interval '5 minutes' WHERE id=$1", [turnB3]);
  await asServiceRole(async () => {
    const recovered = await rows('SELECT * FROM public.recover_expired_generating_conversation_turn_v1($1,$2,$3,$4,$5,$6)', [sessionB, alice, turnB3, randomUUID(), null, null]);
    assert.equal(recovered.length, 1); assert.equal(recovered[0].status, 'FAILED');
  });
  assert.equal((await one('SELECT state FROM public.formal_question_turn_bindings WHERE id=$1', [recoverySelection.binding_id])).state, 'RELEASED', 'expired-GENERATING recovery released the unconsumed reservation');

  // --- D. Versioned finalization: atomic BOUND, bypass closed, fail-closed --
  // The retired pre-0063 signature is not an executable bypass: service_role
  // holds no EXECUTE, and even the owner path only reaches a raising tombstone.
  await asServiceRole(async () => {
    await rejects('SELECT * FROM public.finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [sessionA, alice, turnA1, randomUUID(), 'bypass attempt', 'ALLOW', randomUUID(), null, null], ['42501']);
  });
  const tombstone = await rejects('SELECT * FROM public.finalize_conversation_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)', [sessionA, alice, turnA1, randomUUID(), 'bypass attempt', 'ALLOW', randomUUID(), null, null], ['0A000']);
  assert.match(tombstone.message, /RETIRED_CONVERSATION_FINALIZATION_AUTHORITY/u);
  assert.equal((await one('SELECT status FROM public.conversation_turns WHERE id=$1', [turnA1])).status, 'GENERATING', 'the bypass attempt terminalized nothing');
  // Foreign/stale/impossible bindings fail the finalization closed with zero
  // durable writes.
  await asServiceRole(async () => {
    await rejects('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [sessionA, alice, turnA2, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null, firstSelection.binding_id], ['42501']);
    await rejects('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [sessionA, alice, turnA1, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null, releasedB1.id], ['42501']);
    await rejects('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [sessionA, alice, turnA1, randomUUID(), 'x', 'ALLOW', randomUUID(), null, null, randomUUID()], ['42501']);
  });
  assert.equal((await one('SELECT status FROM public.conversation_turns WHERE id=$1', [turnA1])).status, 'GENERATING', 'a failed-closed binding left the source turn untouched');
  assert.equal((await one('SELECT state FROM public.formal_question_turn_bindings WHERE id=$1', [firstSelection.binding_id])).state, 'SELECTED');
  // The legitimate consumption: assistant insertion + BOUND + user completion
  // + outbox commit together.
  const assistantA1 = randomUUID();
  const finalizedA1 = await finalizeV2(sessionA, alice, turnA1, assistantA1, firstSelection.binding_id);
  assert.equal(finalizedA1.length, 1);
  const boundBinding = await one('SELECT * FROM public.formal_question_turn_bindings WHERE id=$1', [firstSelection.binding_id]);
  assert.deepEqual({ state: boundBinding.state, assistant: boundBinding.assistant_turn_id }, { state: 'BOUND', assistant: assistantA1 },
    'the reservation is BOUND to the exact completed assistant turn');
  assert.ok(boundBinding.bound_at !== null && boundBinding.released_at === null);
  assert.equal((await one('SELECT status FROM public.conversation_turns WHERE id=$1', [turnA1])).status, 'COMPLETED');
  assert.equal((await one("SELECT count(*)::int n FROM public.runtime_event_outbox WHERE subject_turn_id=$1 AND event_type='ConversationTurnCompleted'", [turnA1])).n, 1);
  // Repeated finalization cannot double-bind.
  assert.equal((await finalizeV2(sessionA, alice, turnA1, randomUUID(), firstSelection.binding_id)).length, 0);
  assert.equal((await one('SELECT count(*)::int n FROM public.formal_question_turn_bindings WHERE source_turn_id=$1', [turnA1])).n, 1);
  // One outstanding BOUND-with-OPEN-gap question per session.
  const whileOutstanding = await selectOpportunity(alice, sessionA, turnA2);
  assert.deepEqual(whileOutstanding, { outcome: 'OUTSTANDING_OPEN_QUESTION', binding_id: null, question_type: null },
    'no second formal Question is selected while the first bound gap remains OPEN');
  // Finalization WITHOUT consumption releases the outstanding reservation of
  // that turn - here turnA2 holds none, so completing it changes nothing and a
  // later turn is still governed by the outstanding rule.
  await finalizeV2(sessionA, alice, turnA2, randomUUID(), null);
  // Binding-substrate immutability: no path returns to SELECTED, no BOUND row
  // can be released, and DELETE is always rejected.
  await rejects("UPDATE public.formal_question_turn_bindings SET state='RELEASED',released_at=CURRENT_TIMESTAMP,assistant_turn_id=NULL,bound_at=NULL WHERE id=$1", [boundBinding.id], ['42501']);
  await rejects('DELETE FROM public.formal_question_turn_bindings WHERE id=$1', [boundBinding.id], ['55000']);
  await client.query("SELECT set_config('qandeel.formal_question_binding_transition','authorized',true)");
  await rejects("UPDATE public.formal_question_turn_bindings SET state='BOUND',bound_at=CURRENT_TIMESTAMP WHERE id=$1", [releasedB1.id], ['42501']);
  await client.query("SELECT set_config('qandeel.formal_question_binding_transition','',true)");

  // --- E. Canonical closure: RESOLVED / OPEN / SUPERSEDED / reopen ----------
  // Still present at the same exact current version: stays OPEN, and repeated
  // synchronization of the same durable statement never duplicates or bumps.
  const stillPresent = await statedConfidence(alice, primary.hypothesis, primary.version, [primary.code]);
  await syncGaps(stillPresent.executionId);
  const countsBefore = await one('SELECT count(*)::int n FROM public.information_gaps WHERE user_id=$1', [alice]);
  await syncGaps(stillPresent.executionId);
  let reconciled = await one('SELECT status,open_epoch FROM public.information_gaps WHERE id=$1', [primary.gap.id]);
  assert.deepEqual(reconciled, { status: 'OPEN', open_epoch: 1 }, 'a still-present missing code keeps the gap OPEN with no epoch movement');
  assert.deepEqual(await one('SELECT count(*)::int n FROM public.information_gaps WHERE user_id=$1', [alice]), countsBefore, 'repeated synchronization creates no duplicate gap');
  // Same exact current version, code no longer present: RESOLVED.
  const resolvedStatement = await statedConfidence(alice, primary.hypothesis, primary.version, []);
  await syncGaps(resolvedStatement.executionId);
  reconciled = await one('SELECT status,open_epoch,closed_at,closure_reason FROM public.information_gaps WHERE id=$1', [primary.gap.id]);
  assert.equal(reconciled.status, 'RESOLVED');
  assert.equal(reconciled.closure_reason, 'MISSING_INFORMATION_CODE_ABSENT');
  assert.ok(reconciled.closed_at !== null && reconciled.open_epoch === 1, 'closure never moves the epoch');
  // Closure is per exact tuple, decided only by canonical Confidence state:
  // the sibling OPEN gap is untouched by the completed turns above.
  assert.equal((await one('SELECT status FROM public.information_gaps WHERE id=$1', [spare.id])).status, 'OPEN');
  // Legitimate recurrence: the SAME canonical tuple becomes actionable again -
  // the SAME gap identity reopens with open_epoch+1 exactly once, and re-sync
  // does not increment again.
  const recurrence = await statedConfidence(alice, primary.hypothesis, primary.version, [primary.code]);
  const recurrenceResult = await syncGaps(recurrence.executionId);
  assert.equal(recurrenceResult.gaps[0].informationGapId, primary.gap.id, 'recurrence reuses the canonical gap identity');
  reconciled = await one('SELECT status,open_epoch,closed_at,closure_reason FROM public.information_gaps WHERE id=$1', [primary.gap.id]);
  assert.deepEqual(reconciled, { status: 'OPEN', open_epoch: 2, closed_at: null, closure_reason: null }, 'a legitimate recurrence reopens with epoch+1 and cleared closure metadata');
  await syncGaps(recurrence.executionId);
  assert.equal((await one('SELECT open_epoch FROM public.information_gaps WHERE id=$1', [primary.gap.id])).open_epoch, 2, 'repeated synchronization never repeatedly increments the epoch');
  // The reopened epoch is selectable even though epoch 1 was BOUND, and the
  // epoch-1 BOUND row no longer counts as outstanding. The primary gap sorts
  // first among the eligible set by construction, so the reopened epoch is the
  // deterministic selection.
  const turnA3 = randomUUID(); await insertGeneratingTurn(alice, sessionA, turnA3);
  const reopenedSelection = await selectOpportunity(alice, sessionA, turnA3);
  assert.equal(reopenedSelection.outcome, 'SELECTED');
  const reopenedBinding = await one('SELECT information_gap_id,gap_open_epoch FROM public.formal_question_turn_bindings WHERE id=$1', [reopenedSelection.binding_id]);
  assert.deepEqual(reopenedBinding, { information_gap_id: primary.gap.id, gap_open_epoch: 2 }, 'a reopened epoch may be formally asked once more');
  await asServiceRole(async () => { await client.query('SELECT * FROM public.fail_conversation_turn($1,$2,$3,$4,$5,$6)', [sessionA, alice, turnA3, randomUUID(), null, null]); });
  // SUPERSEDED by version movement: the current Hypothesis version moved away
  // from the exact source target.
  const staleFresh = await statedConfidence(alice, hStale, 3, ['UNVERIFIED_ASSUMPTIONS']);
  await syncGaps(staleFresh.executionId);
  const staleGap = await gapFor(hStale, 1, 'UNVERIFIED_ASSUMPTIONS');
  assert.deepEqual({ status: staleGap.status, reason: staleGap.closure_reason, epoch: staleGap.open_epoch },
    { status: 'SUPERSEDED', reason: 'HYPOTHESIS_VERSION_ADVANCED', epoch: 1 },
    'a stale exact source target is SUPERSEDED, never left OPEN to block the session');
  assert.equal((await gapFor(hStale, 3, 'UNVERIFIED_ASSUMPTIONS')).status, 'OPEN', 'the current-version tuple materialized as its own OPEN gap');
  // SUPERSEDED by lifecycle: the Hypothesis left the questioning-eligible set.
  const rejectedFresh = await statedConfidence(alice, hRejected, 1, ['UNVERIFIED_ASSUMPTIONS']);
  await syncGaps(rejectedFresh.executionId);
  const rejectedGap = await gapFor(hRejected, 1, 'UNVERIFIED_ASSUMPTIONS');
  assert.deepEqual({ status: rejectedGap.status, reason: rejectedGap.closure_reason },
    { status: 'SUPERSEDED', reason: 'HYPOTHESIS_LIFECYCLE_INELIGIBLE' });
  // Selection still finds a legitimate target after every reconciliation
  // above (the reopened primary epoch and the untouched spare gap remain
  // eligible), while the SUPERSEDED, manual, and ineligible-lifecycle gaps
  // stay structurally invisible to it - a stale gap never blocks the session.
  const turnA4 = randomUUID(); await insertGeneratingTurn(alice, sessionA, turnA4);
  const drained = await selectOpportunity(alice, sessionA, turnA4);
  assert.equal(drained.outcome, 'SELECTED');
  await asServiceRole(async () => { await client.query('SELECT * FROM public.fail_conversation_turn($1,$2,$3,$4,$5,$6)', [sessionA, alice, turnA4, randomUUID(), null, null]); });

  await client.query('ROLLBACK');
  } catch (error) { await client.query('ROLLBACK'); throw error; }

  // --- F. Real two-connection concurrent selection: the same session cannot
  // reserve twice, and the winner/loser resolve deterministically. -----------
  const raceUser = randomUUID(), raceSession = randomUUID(), raceHypothesis = randomUUID();
  const raceTurnX = randomUUID(), raceTurnY = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  try {
    await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text)', [raceUser]);
    await insertSession(raceUser, raceSession);
    await insertHypothesis(raceUser, raceHypothesis, 1, raceSession);
    const raceStatement = await statedConfidence(raceUser, raceHypothesis, 1, ['UNVERIFIED_ASSUMPTIONS']);
    await syncGaps(raceStatement.executionId);
    await insertGeneratingTurn(raceUser, raceSession, raceTurnX);
    await insertGeneratingTurn(raceUser, raceSession, raceTurnY);
    await clientA.connect(); await clientB.connect();
    // A holds the session selection serialization key inside an open
    // transaction; B's selection must BLOCK on it rather than racing the
    // outstanding checks, then observe A's committed reservation.
    await clientA.query('BEGIN');
    await clientA.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`qandeel_formal_question_selection:${raceUser}:${raceSession}`]);
    const { rows: [selectionA] } = await clientA.query('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [raceUser, raceSession, raceTurnX]);
    assert.equal(selectionA.outcome, 'SELECTED');
    const pendingB = clientB.query('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [raceUser, raceSession, raceTurnY]);
    pendingB.catch(() => undefined);
    const winner = await Promise.race([pendingB.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750))]);
    assert.equal(winner, 'BLOCKED', 'the concurrent same-session selection blocks on the serialization key instead of racing');
    await clientA.query('COMMIT');
    const { rows: [selectionB] } = await pendingB;
    assert.deepEqual(selectionB, { outcome: 'OUTSTANDING_OPEN_QUESTION', binding_id: null, question_type: null },
      'the loser observes the winner\'s committed reservation: one live reservation per session, never two');
    const raceState = await one('SELECT count(*)::int total,(SELECT count(*)::int FROM public.formal_question_turn_bindings WHERE user_id=$1 AND state=$2) selected FROM public.formal_question_turn_bindings WHERE user_id=$1', [raceUser, 'SELECTED']);
    assert.deepEqual(raceState, { total: 1, selected: 1 }, 'exactly one reservation row survived the race: the gap epoch was never double-reserved');
  } finally {
    await clientA.end().catch(() => undefined); await clientB.end().catch(() => undefined);
    await client.query("SET session_replication_role='replica'");
    await client.query('DELETE FROM public.formal_question_turn_bindings WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.information_gap_confidence_sources WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.information_gap_hypotheses WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.information_gaps WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.post_response_intelligence_effects WHERE execution_id IN (SELECT id FROM public.post_response_intelligence_executions WHERE user_id=$1)', [raceUser]);
    await client.query('DELETE FROM public.post_response_intelligence_executions WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.confidence_evaluations WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.hypotheses WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.conversation_turns WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.conversation_sessions WHERE user_id=$1', [raceUser]);
    await client.query('DELETE FROM public.users WHERE id=$1', [raceUser]);
    await client.query("SET session_replication_role='origin'");
    const residue = await one('SELECT count(*)::int n FROM public.formal_question_turn_bindings');
    assert.equal(residue.n, 0, 'the verifier left zero residue in the binding substrate');
  }
} finally { await client.end(); } }

main().then(() => console.log('Verified migration 0063: total durable Information Gap lifecycle with protected closure/reopen, canonical RESOLVED/SUPERSEDED/recurrence reconciliation through the delegating synchronization authority, service-role-only atomic same-session selection with deterministic ordering, idempotent retry, cross-session exclusion and one-outstanding-per-session, atomic BOUND finalization with the retired signature closed as a bypass, the one database-owned terminal release on finalize/fail/cancel/recovery, immutable binding history with zero direct role privileges, and race-safe concurrent selection with zero residue.')).catch((error) => { console.error(`Question closed-loop verification failed (${error?.code ?? 'verification'}): ${error?.message ?? error}`); process.exitCode = 1; });
