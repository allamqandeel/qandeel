// Real-PostgreSQL verifier for migration 0067 - Focus Runtime Orchestration
// + Activation Readiness v1 (readiness / read substrate only, NO cutover).
//
// Proves against live semantics: the integrated batch snapshot (absent,
// integrated non-zero and zero-CU complete, legacy T-03A2-only batch
// incomplete but never absent, missing semantic or attention rows explicitly
// incomplete, ownership fail-closed, canonical T-03A2 frontier / LH / event
// values preserved); the cutover-readiness audit (empty passes, integrated
// passes, each legacy or partial shape fails FOCUS_CAPTURE_CUTOVER_NOT_READY,
// zero mutation, no backfill, no Product-state column); the clock policy
// ((last_sp, 0) on the still-live T-03A2 path, (last_sp, 1) on the
// owner-invoked integrated path, neither normalized); and privilege
// preservation (nothing new granted, 0066 still ungranted, T-03A2 grants
// unchanged, the seam internal). Every fixture is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}
async function rejected(operation, token, codes = ['22023']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, `operation unexpectedly succeeded (wanted ${token})`);
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} for ${token}: ${error.message}`);
  assert.ok(String(error.message).includes(token), `expected ${token}, got: ${error.message}`);
  return error;
}

const INTEGRATED_SNAPSHOT = 'public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const READINESS_AUDIT = 'public.assert_conversation_focus_capture_cutover_ready_v1()';
const WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
const CONTEXT = 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const LEGACY_PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];
const FOCUS_TABLES = [
  'conversation_focus_commit_batches', 'conversation_reference_handles', 'conversation_unit_focus_semantics',
  'conversation_reference_resolutions', 'conversation_reference_resolution_candidates', 'conversation_claim_attributions',
  'conversation_emerging_focuses', 'conversation_emerging_focus_attention_events'];

const USER_TEXT = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد نفسه بدأ يقلقني.';
const ASSISTANT_TEXT = 'تقصد إن أحمد بيتجنبك؟';
const U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const U2 = 'أحمد نفسه بدأ يقلقني.';

const points = (value) => Array.from(value);
const spanOf = (content, excerpt) => {
  const source = points(content);
  const needle = points(excerpt);
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) return { start, end: start + needle.length };
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
};
const unit = (content, excerpt, id = randomUUID()) => {
  const { start, end } = spanOf(content, excerpt);
  return { unit_id: id, span_start: start, span_end: end };
};
const anchor = (cuText, excerpt) => {
  const { start, end } = spanOf(cuText, excerpt);
  return { anchor_text: excerpt, anchor_occurrence: 1, span_start: start, span_end: end };
};
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
const bundle = (unitId, overrides = {}) => ({
  unit_id: unitId, functions: overrides.functions ?? ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null,
  references: (overrides.references ?? []).map((r, i) => ({ reference_index: i, ...r })), claim_attributions: [], attention: overrides.attention ?? NO_FOCUS,
});
const newHandleRef = (cuText, excerpt, handle) =>
  ({ ...anchor(cuText, excerpt), state: 'RESOLVED', resolved_handle_id: handle, creates_handle: true, candidate_handle_ids: [] });

const commitWithFocus = (session, user, turn, batch, units, bundles) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)', [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const legacySnapshot = async (session, user, turn, batch) =>
  (await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)', [session, user, turn, batch]))[0];
const integratedSnapshot = async (session, user, turn, batch) =>
  (await rows('SELECT * FROM get_conversation_integrated_batch_snapshot_v1($1,$2,$3,$4)', [session, user, turn, batch]))[0];
const audit = () => q('SELECT assert_conversation_focus_capture_cutover_ready_v1()');
const clockOf = async (session) => (await rows('SELECT * FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
async function worldSnapshot() {
  const snapshot = {};
  for (const table of [...FOCUS_TABLES, 'conversation_units', 'conversation_unit_commit_batches', 'conversation_unit_commit_events', 'session_semantic_clocks']) {
    snapshot[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).map((r) => r.row);
  }
  return snapshot;
}
async function newSession(owner) {
  const id = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [id, owner]);
  return id;
}
async function completedTurns(owner, session, content = USER_TEXT, reply = ASSISTANT_TEXT) {
  await identity('authenticated', owner);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, owner, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

// ---------------------------------------------------------------- static gate
async function verifyStaticAuthority() {
  stage = 'A. migration / privilege preservation';
  for (const [signature, label] of [[INTEGRATED_SNAPSHOT, 'integrated snapshot'], [READINESS_AUDIT, 'readiness audit']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    assert.equal(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [signature]);
    assert.equal(contract.owner, 'postgres', `${label} is postgres-owned`);
    assert.equal(contract.definer, true, `${label} is SECURITY DEFINER`);
    assert.ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${label} has a fixed empty search path`);
    if (signature === READINESS_AUDIT) assert.equal(contract.volatility, 's', 'the audit is STABLE: the database refuses any write from inside it');
  }
  for (const signature of [WRITER, COORDINATOR, CONTEXT, SAME_SP_HELPER, LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    assert.equal(presence.present, true, `${signature} still exists`);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [INTEGRATED_SNAPSHOT, READINESS_AUDIT, WRITER, COORDINATOR, CONTEXT, SAME_SP_HELPER]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      assert.equal(granted, false, `${role} must not execute ${signature}: no cutover in T-03B1b2`);
    }
    for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      assert.equal(granted, role === 'service_role', `the live T-03A2 grant on ${signature} is unchanged for ${role}`);
    }
    for (const table of FOCUS_TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        assert.equal(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // The deployed bodies: the snapshot delegates the commitment half to the
  // T-03A2 read, no timestamp decides completeness, and the audit writes nothing.
  const [{ definition: snapshotBody }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [INTEGRATED_SNAPSHOT]);
  assert.match(snapshotBody, /get_conversation_unit_commit_batch_snapshot_v1\(p_session_id, p_user_id, p_source_turn_id, p_batch_id\)/u);
  assert.doesNotMatch(snapshotBody, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u, 'no timestamp decides completeness');
  const [{ definition: auditBody }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [READINESS_AUDIT]);
  assert.doesNotMatch(auditBody, /INSERT INTO|UPDATE public|DELETE FROM|created_at|historical|PRE_FIRST_SP/u, 'the audit is a proof: no write, no backfill, no historical state');
  const columns = await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* 'focus_enabled|analysis_enabled|semantic_version|historical_ready|cutover_ready|focus_ready'");
  assert.deepEqual(columns, [], 'readiness never became a Product-state column');
}

// ---------------------------------------------- readiness on the empty world
async function verifyEmptyReadiness() {
  stage = 'C. cutover readiness on an empty world';
  await audit();
}

// ------------------------------------------- integrated snapshot + readiness
async function verifyIntegrated(owner, other) {
  stage = 'B/C/D. integrated batches: snapshot complete, readiness passes, clock rests at (last_sp, 1)';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  // Absent: explicit, never invented.
  const missingBatch = randomUUID();
  const absent = await integratedSnapshot(session, owner, turns.userTurn, missingBatch);
  assert.deepEqual(absent, {
    batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
    focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  }, 'an unknown batch is reported absent with no focus metadata invented');

  // Integrated non-zero batch through the 0066 writer.
  const [u1, u2] = [randomUUID(), randomUUID()];
  const [manager, ahmed] = [randomUUID(), randomUUID()];
  const batch = randomUUID();
  await commitWithFocus(session, owner, turns.userTurn, batch, [unit(USER_TEXT, U1, u1), unit(USER_TEXT, U2, u2)], [
    bundle(u1, { references: [newHandleRef(U1, 'المدير', manager)] }),
    bundle(u2, { references: [newHandleRef(U2, 'أحمد', ahmed)], attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: randomUUID(), creates_focus: true, grounding_reference_index: 0 } }),
  ]);
  const integrated = await integratedSnapshot(session, owner, turns.userTurn, batch);
  assert.deepEqual([integrated.batch_exists, integrated.committed_unit_count, integrated.focus_batch_exists, integrated.focus_semantic_count, integrated.focus_attention_count, integrated.focus_complete],
    [true, 2, true, 2, 2, true], 'a fully integrated non-zero batch is complete');
  const legacy = await legacySnapshot(session, owner, turns.userTurn, batch);
  assert.deepEqual([integrated.units, integrated.commit_event, integrated.source_frontier, integrated.live_head],
    [legacy.units, legacy.event, legacy.source_frontier, legacy.live_head], 'the commitment half is exactly the canonical T-03A2 snapshot');
  assert.equal(integrated.live_head, 2);
  assert.deepEqual([integrated.commit_event.first_sp, integrated.commit_event.last_sp], [1, 2]);
  await audit();
  // D. The integrated path rests at (last_sp, 1) and the audit normalizes nothing.
  assert.deepEqual(await clockOf(session), { session_id: session, user_id: owner, current_sp: 2, same_sp_event_sequence: '1' });

  // Integrated zero-CU batch: complete only because its zero-unit focus batch exists.
  const zeroBatch = randomUUID();
  await commitWithFocus(session, owner, turns.assistantTurn, zeroBatch, [], []);
  const zero = await integratedSnapshot(session, owner, turns.assistantTurn, zeroBatch);
  assert.deepEqual([zero.batch_exists, zero.committed_unit_count, zero.focus_batch_exists, zero.focus_complete, zero.commit_event], [true, 0, true, true, null]);
  await audit();
  const before = await worldSnapshot();
  await audit();
  assert.deepEqual(await worldSnapshot(), before, 'the readiness audit mutated zero rows and zero clock coordinates');

  // Ownership fails closed on the integrated read.
  await rejected(() => integratedSnapshot(session, other, turns.userTurn, batch), 'FORBIDDEN', ['42501']);
  await rejected(() => integratedSnapshot(randomUUID(), owner, turns.userTurn, batch), 'FORBIDDEN', ['42501']);
  await rejected(() => integratedSnapshot(session, owner, turns.assistantTurn, batch), 'FORBIDDEN', ['42501']);
  return { session, turns, batch };
}

// -------------------------------------------- legacy / partial history shapes
async function verifyLegacyAndPartial(owner) {
  stage = 'B/C/D. legacy T-03A2-only and partial semantic history';
  // A legacy non-zero batch on the STILL-LIVE T-03A2 path.
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const legacyBatch = randomUUID();
  const legacyUnit = randomUUID();
  await legacyCommit(session, owner, turns.userTurn, legacyBatch, [unit(USER_TEXT, U1, legacyUnit)]);
  assert.deepEqual(await clockOf(session), { session_id: session, user_id: owner, current_sp: 1, same_sp_event_sequence: '0' },
    'the live T-03A2 path still rests at (last_sp, 0); 0067 normalizes nothing');
  const legacy = await integratedSnapshot(session, owner, turns.userTurn, legacyBatch);
  assert.deepEqual([legacy.batch_exists, legacy.committed_unit_count, legacy.focus_batch_exists, legacy.focus_semantic_count, legacy.focus_attention_count, legacy.focus_complete],
    [true, 1, false, 0, 0, false], 'a legacy batch is incomplete, never absent');
  assert.equal(legacy.live_head, 1);
  const legacyFailure = await rejected(audit, 'FOCUS_CAPTURE_CUTOVER_NOT_READY', ['55000']);
  assert.match(String(legacyFailure.detail ?? ''), /COMMIT_BATCH_WITHOUT_FOCUS_BATCH/u);

  // A legacy zero-CU batch is a blocker too.
  const legacyZero = randomUUID();
  await legacyCommit(session, owner, turns.assistantTurn, legacyZero, []);
  const zero = await integratedSnapshot(session, owner, turns.assistantTurn, legacyZero);
  assert.deepEqual([zero.batch_exists, zero.committed_unit_count, zero.focus_batch_exists, zero.focus_complete], [true, 0, false, false]);
  await rejected(audit, 'FOCUS_CAPTURE_CUTOVER_NOT_READY', ['55000']);

  // Missing CU semantics: a focus batch row exists but no bundle (owner-inserted partial state).
  await q('SAVEPOINT partial');
  await q("INSERT INTO public.conversation_focus_commit_batches(commit_batch_id,user_id,session_id,source_turn_id,unit_count,canonical_fingerprint,focus_evaluator_version,focus_policy_version,focus_provider,focus_model,focus_prompt_version,focus_schema_version) VALUES($1,$2,$3,$4,1,sha256(convert_to('x','UTF8')),'e','p','OPENAI','m','v',1)",
    [legacyBatch, owner, session, turns.userTurn]);
  await q("INSERT INTO public.conversation_focus_commit_batches(commit_batch_id,user_id,session_id,source_turn_id,unit_count,canonical_fingerprint,focus_evaluator_version,focus_policy_version,focus_provider,focus_model,focus_prompt_version,focus_schema_version) VALUES($1,$2,$3,$4,0,sha256(convert_to('y','UTF8')),'e','p','OPENAI','m','v',1)",
    [legacyZero, owner, session, turns.assistantTurn]);
  const noSemantics = await integratedSnapshot(session, owner, turns.userTurn, legacyBatch);
  assert.deepEqual([noSemantics.focus_batch_exists, noSemantics.focus_semantic_count, noSemantics.focus_attention_count, noSemantics.focus_complete], [true, 0, 0, false], 'a missing semantic row is explicitly incomplete');
  const missingSemantics = await rejected(audit, 'FOCUS_CAPTURE_CUTOVER_NOT_READY', ['55000']);
  assert.match(String(missingSemantics.detail ?? ''), /COMMITTED_CU_WITHOUT_FOCUS_SEMANTICS/u);
  // Missing attention history: the bundle exists, the attention row does not.
  await q("INSERT INTO public.conversation_unit_focus_semantics(cu_id,focus_commit_batch_id,user_id,session_id,session_position,same_sp_event_sequence,functions,sequence_position,target_cu_id) VALUES($1,$2,$3,$4,1,1,ARRAY['INFORM_REPORT'],'UNMARKED',NULL)",
    [legacyUnit, legacyBatch, owner, session]);
  const noAttention = await integratedSnapshot(session, owner, turns.userTurn, legacyBatch);
  assert.deepEqual([noAttention.focus_semantic_count, noAttention.focus_attention_count, noAttention.focus_complete], [1, 0, false], 'a missing attention row is explicitly incomplete');
  const missingAttention = await rejected(audit, 'FOCUS_CAPTURE_CUTOVER_NOT_READY', ['55000']);
  assert.match(String(missingAttention.detail ?? ''), /COMMITTED_CU_WITHOUT_ATTENTION_HISTORY/u);
  await q('ROLLBACK TO SAVEPOINT partial');
  await q('RELEASE SAVEPOINT partial');
  // Unit-count mismatch on the focus batch.
  await q('SAVEPOINT mismatch');
  await q("INSERT INTO public.conversation_focus_commit_batches(commit_batch_id,user_id,session_id,source_turn_id,unit_count,canonical_fingerprint,focus_evaluator_version,focus_policy_version,focus_provider,focus_model,focus_prompt_version,focus_schema_version) VALUES($1,$2,$3,$4,0,sha256(convert_to('z','UTF8')),'e','p','OPENAI','m','v',1)",
    [legacyBatch, owner, session, turns.userTurn]);
  const mismatch = await integratedSnapshot(session, owner, turns.userTurn, legacyBatch);
  assert.deepEqual([mismatch.focus_batch_exists, mismatch.focus_complete], [true, false], 'a unit-count mismatch is incomplete');
  await q('ROLLBACK TO SAVEPOINT mismatch');
  await q('RELEASE SAVEPOINT mismatch');
  // Nothing above backfilled anything: the legacy batch still has no semantics.
  const [{ count }] = await rows('SELECT count(*) count FROM public.conversation_unit_focus_semantics WHERE session_id=$1', [session]);
  assert.equal(Number(count), 0, 'no backfill occurred');
  assert.deepEqual(await clockOf(session), { session_id: session, user_id: owner, current_sp: 1, same_sp_event_sequence: '0' }, 'no SP or sequence was rewritten');
}

// ------------------------------------------------------- application ACL gate
async function verifyRuntimeAcl(owner, populated) {
  stage = 'A. production-inert runtime ACL';
  const { session, turns, batch } = populated;
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => integratedSnapshot(session, owner, turns.userTurn, batch), 'permission denied', ['42501']);
    await rejected(audit, 'permission denied', ['42501']);
  }
  // The live T-03A2 read still answers service_role exactly as before.
  await identity('service_role');
  const legacy = await legacySnapshot(session, owner, turns.userTurn, batch);
  assert.equal(legacy.batch_exists, true, 'the T-03A2 snapshot read remains live for service_role');
  await identity('postgres');
}

async function main() {
  try {
    await client.connect();
    await verifyStaticAuthority();
    await q('BEGIN');
    try {
      await identity('postgres');
      const owner = randomUUID();
      const other = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
      await verifyEmptyReadiness();
      const populated = await verifyIntegrated(owner, other);
      await verifyLegacyAndPartial(owner);
      await verifyRuntimeAcl(owner, populated);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    console.log('Verified migration 0067: the integrated batch snapshot reports absent, complete (non-zero and zero-CU), legacy-incomplete and partial-incomplete states explicitly over the canonical T-03A2 commitment snapshot; the cutover-readiness audit passes an empty or fully integrated world and fails FOCUS_CAPTURE_CUTOVER_NOT_READY on every legacy or partial shape with zero mutation and no backfill; the live T-03A2 path still rests at (last_sp, 0) and the integrated path at (last_sp, 1) with neither normalized; nothing new is granted, the 0066 substrate stays ungranted, the T-03A2 grants are unchanged, and the same-SP seam stays internal.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Focus runtime integration readiness verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
