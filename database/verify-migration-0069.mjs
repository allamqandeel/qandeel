// Real-PostgreSQL verifier for migration 0069 - Thread Runtime Orchestration
// + Integration Readiness v1 (READ / AUDIT substrate only, NO cutover).
//
// Proves against live semantics, never grep alone: the integrated B1+B2 batch
// snapshot (absent, fully integrated non-zero and zero-CU, legacy T-03A2-only,
// B1-only, corrupted evidence / origin / coherence, ownership fail-closed, and
// exact agreement with the ONE 0068 structural authority); the combined
// runtime context (exact clock token, prior CUs in SP order, one canonical B1
// bundle and one attention item per prior CU, same-user/same-session Thread
// bindings at prior SPs only, unique Thread and grounding-focus lineage, and
// fail-closed refusal of legacy or partial prior history); the Thread-capture
// readiness audit (empty passes, fully integrated passes, every legacy or
// partial shape fails THREAD_CAPTURE_CUTOVER_NOT_READY, zero mutation, zero
// clock change, no backfill); the same-SP clock policy ((last_sp, 1) when the
// last Moment carries B1 alone, (last_sp, 2) when it establishes, neither
// normalized); and the production-inert posture with untouched T-03A2
// authority. Every fixture is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
let assertions = 0;
const check = (fn) => { assertions += 1; return fn(); };
const eq = (actual, expected, message) => check(() => assert.deepEqual(actual, expected, message));
const strict = (actual, expected, message) => check(() => assert.equal(actual, expected, message));
const ok = (value, message) => check(() => assert.ok(value, message));

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}
async function rejected(operation, token, codes = ['22023']) {
  assertions += 1;
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

// --------------------------------------------------------------- signatures
const THREAD_SNAPSHOT = 'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const THREAD_CONTEXT = 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)';
const READINESS_AUDIT = 'public.assert_conversation_thread_capture_cutover_ready_v1()';
const BATCH_STATE = 'public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)';
const THREAD_WRITER = 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
const THREAD_COORDINATOR = 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
const FOCUS_WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const FOCUS_COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
const FOCUS_CONTEXT = 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
const FOCUS_SNAPSHOT = 'public.get_conversation_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const LEGACY_PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const THREAD_TABLES = [
  'conversation_world_spatial_authorities', 'conversation_threads', 'conversation_thread_homes',
  'conversation_thread_establishment_events', 'conversation_thread_establishment_evidence',
  'conversation_thread_origin_members', 'conversation_thread_commit_batches'];

const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// ---------------------------------------------- canonical identity vectors
const RFC4122_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function uuidV5(namespace, name) {
  const digest = createHash('sha1').update(Buffer.from(namespace.replace(/-/gu, ''), 'hex')).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const THREAD_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/thread/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);

// ------------------------------------------------------- the shared scenario
const USER_TEXT = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد اللي في الفريق قالّي إن الموضوع ده عادي. أحمد نفسه بدأ يقلقني.';
const ASSISTANT_TEXT = 'تقصد إن أحمد بيتجنبك؟ وإمتى ده بدأ؟';
const U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const U2 = 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.';
const U3 = 'أحمد نفسه بدأ يقلقني.';
const A1 = 'تقصد إن أحمد بيتجنبك؟';
const A2 = 'وإمتى ده بدأ؟';

const points = (value) => Array.from(value);
const spanOf = (content, excerpt, occurrence = 1) => {
  const source = points(content);
  const needle = points(excerpt);
  let seen = 0;
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) {
      seen += 1;
      if (seen === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
};
const unit = (content, excerpt, occurrence = 1, id = randomUUID()) => {
  const { start, end } = spanOf(content, excerpt, occurrence);
  return { unit_id: id, span_start: start, span_end: end };
};
const anchor = (cuText, excerpt, occurrence = 1) => {
  const { start, end } = spanOf(cuText, excerpt, occurrence);
  return { anchor_text: excerpt, anchor_occurrence: occurrence, span_start: start, span_end: end };
};
const resolved = (cuText, excerpt, handle, creates = false, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), state: 'RESOLVED', resolved_handle_id: handle, creates_handle: creates, candidate_handle_ids: [] });
const claim = (cuText, excerpt, kind, handle, frame, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), claimant_kind: kind, claimant_handle_id: handle, claim_frame: frame });
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
const startFocus = (focusId, index, reason = 'DIRECT_SUBJECT') =>
  ({ kind: 'START_NEW_FOCUS', reason, emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: index });
const attendFocus = (focusId, index, reason = 'SUBSTANTIVE_ELABORATION') =>
  ({ kind: 'ATTEND_EXISTING_FOCUS', reason, emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: index });
const bundle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  functions: overrides.functions ?? ['INFORM_REPORT'],
  sequence_position: overrides.sequence_position ?? 'UNMARKED',
  target_cu_id: overrides.target_cu_id ?? null,
  references: (overrides.references ?? []).map((reference, index) => ({ reference_index: index, ...reference })),
  claim_attributions: (overrides.claim_attributions ?? []).map((attribution, index) => ({ attribution_index: index, ...attribution })),
  attention: overrides.attention ?? NO_FOCUS,
});
const noEstablishment = (unitId, reason, focusId = null) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: reason,
  emerging_focus_id: focusId, path: null, thread_id: null, home_anchor_id: null,
  thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});
const establish = (userId, unitId, focusId, path, evidenceCuIds, overrides = {}) => {
  const threadId = threadIdOf(userId, focusId);
  return {
    unit_id: unitId, decision: 'ESTABLISH_THREAD', no_establishment_reason: null, emerging_focus_id: focusId, path,
    thread_id: threadId,
    home_anchor_id: uuidV5(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1'), threadId),
    thread_established_event_id: uuidV5(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1'), threadId),
    evidence: evidenceCuIds.map((cuId, index) => ({
      evidence_ordinal: index, cu_id: cuId,
      evidence_role: index === evidenceCuIds.length - 1 ? 'ESTABLISHING_CU' : 'PRIOR_EVIDENCE',
    })),
    explicit_selection_grounding: overrides.explicit_selection_grounding ?? null,
    origin_state: overrides.origin_state ?? 'NONE',
    origin_thread_ids: [...(overrides.origin_thread_ids ?? [])].sort(),
  };
};

const exchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, token) =>
  rows('SELECT * FROM commit_finalized_exchange_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads),
      assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads),
      ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, token.sp, token.seq]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)', [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const focusOnlyCommit = (session, user, turn, batch, units, bundles) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE]);

const snapshot = async (session, user, turn, batch) =>
  (await rows('SELECT * FROM get_conversation_focus_thread_integrated_batch_snapshot_v1($1,$2,$3,$4)', [session, user, turn, batch]))[0];
const runtimeContext = async (session, user) =>
  (await rows('SELECT * FROM get_conversation_focus_thread_runtime_context_v1($1,$2)', [session, user]))[0];
const batchState = async (session, user, turn, batch) =>
  (await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) state', [session, user, turn, batch]))[0].state;
const audit = () => q('SELECT assert_conversation_thread_capture_cutover_ready_v1()');
const clockOf = async (session) =>
  (await rows('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
const FRESH_TOKEN = { sp: null, seq: 0 };

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

/** Every row 0069 could ever touch, for the zero-mutation proof. */
async function worldSnapshot() {
  const out = {};
  for (const table of [...THREAD_TABLES, 'conversation_units', 'conversation_unit_commit_batches',
    'conversation_unit_commit_events', 'conversation_focus_commit_batches', 'conversation_unit_focus_semantics',
    'conversation_emerging_focus_attention_events', 'conversation_emerging_focuses', 'session_semantic_clocks']) {
    out[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).map((r) => r.row);
  }
  return out;
}

/**
 * The canonical integrated exchange of the shared scenario: the manager Thread
 * at SP1, an incidental Ahmed mention at SP2, the Ahmed Thread at SP3 with the
 * manager Thread as its RESOLVED Conversational Origin, and two ASSISTANT CUs
 * that attend the already-established Ahmed focus.
 */
async function integratedExchange(owner) {
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const userThreads = [
    establish(owner, ids.u1, focuses.manager, 'TE-01', [ids.u1], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    noEstablishment(ids.u2, 'NO_INDEPENDENT_FOCUS'),
    establish(owner, ids.u3, focuses.ahmed, 'TE-01', [ids.u3],
      { explicit_selection_grounding: anchor(U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [threadIdOf(owner, focuses.manager)] }),
  ];
  const [result] = await exchange(session, owner, turns.userTurn, userBatch,
    [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)],
    [
      bundle(ids.u1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
      bundle(ids.u2, { sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1,
        references: [resolved(U2, 'أحمد', handles.ahmed, true)],
        claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handles.ahmed, 'REPORTED_SPEECH')],
        attention: NO_FOCUS }),
      bundle(ids.u3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u2,
        references: [resolved(U3, 'أحمد', handles.ahmed, false)], attention: startFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
    ],
    userThreads,
    turns.assistantTurn, assistantBatch,
    [unit(ASSISTANT_TEXT, A1, 1, ids.a1), unit(ASSISTANT_TEXT, A2, 1, ids.a2)],
    [
      bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u3,
        references: [resolved(A1, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION') }),
      bundle(ids.a2, { functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3,
        references: [], attention: attendFocus(focuses.ahmed, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
    ],
    [noEstablishment(ids.a1, 'ALREADY_ESTABLISHED', focuses.ahmed), noEstablishment(ids.a2, 'ALREADY_ESTABLISHED', focuses.ahmed)],
    FRESH_TOKEN);
  return { session, turns, ids, handles, focuses, userBatch, assistantBatch, result };
}

// ---------------------------------------------------------------- A. static
async function verifyStaticAuthority() {
  stage = 'A. schema / privilege / read-only declaration';
  for (const [signature, label] of [[THREAD_SNAPSHOT, 'integrated B1+B2 snapshot'], [THREAD_CONTEXT, 'combined runtime context'], [READINESS_AUDIT, 'Thread capture readiness audit']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [signature]);
    strict(contract.owner, 'postgres', `${label} is postgres-owned`);
    strict(contract.definer, true, `${label} is SECURITY DEFINER`);
    ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${label} has a fixed search path`);
    strict(contract.volatility, 's', `${label} is STABLE: the database itself refuses any write from inside it`);
  }
  for (const signature of [BATCH_STATE, THREAD_WRITER, THREAD_COORDINATOR, FOCUS_WRITER, FOCUS_COORDINATOR, FOCUS_CONTEXT, FOCUS_SNAPSHOT, SAME_SP_HELPER, LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `${signature} still exists`);
  }
  // AC-B2B3-01: no cutover. Nothing integrated is executable by an application
  // role, and every live T-03A2 grant is exactly where it was.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [THREAD_SNAPSHOT, THREAD_CONTEXT, READINESS_AUDIT, BATCH_STATE, THREAD_WRITER,
      THREAD_COORDINATOR, FOCUS_WRITER, FOCUS_COORDINATOR, FOCUS_CONTEXT, FOCUS_SNAPSHOT, SAME_SP_HELPER]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} must not execute ${signature}: T-03B2b3 performs no cutover`);
    }
    // T-03D (migration 0071) retired the temporary T-03A2 mutation grants; the
    // T-03A2 snapshot read stays live for service_role.
    for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} must not execute the retired temporal-only writer ${signature} (T-03D cutover)`);
    }
    for (const signature of [LEGACY_SNAPSHOT]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, role === 'service_role', `the live T-03A2 grant on ${signature} is unchanged for ${role}`);
    }
    for (const table of THREAD_TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        strict(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // ED-B2B3-01: the deployed bodies REUSE the single 0068 authority and write
  // nothing. No timestamp decides any state.
  const bodyOf = async (signature) => (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [signature]))[0].definition;
  const snapshotBody = await bodyOf(THREAD_SNAPSHOT);
  const contextBody = await bodyOf(THREAD_CONTEXT);
  const auditBody = await bodyOf(READINESS_AUDIT);
  for (const [body, label] of [[snapshotBody, 'snapshot'], [contextBody, 'context'], [auditBody, 'audit']]) {
    ok(body.includes('conversation_thread_batch_state_v1'), `the ${label} reads the ONE 0068 completeness authority`);
    ok(!/INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u.test(body), `the ${label} writes, backfills, repairs and deletes nothing`);
    ok(!/created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u.test(body), `no timestamp participates in the ${label}`);
  }
  ok(snapshotBody.includes('get_conversation_integrated_batch_snapshot_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id)'),
    'the commitment and B1 halves are the T-03B1b2 read, preserved by delegation');
  ok(contextBody.includes('get_conversation_focus_runtime_context_v1(p_session_id, p_user_id)'),
    'the token and the B1 prior context are the T-03B1b1 read, preserved by delegation');
  ok(!/reserve_session_same_sp_event_v1|session_semantic_clocks c\s+SET/u.test(`${snapshotBody}${contextBody}${auditBody}`),
    'no SP is allocated, no LH advanced and no same-SP sequence reserved');
  const columns = await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* 'focus_enabled|analysis_enabled|thread_enabled|semantic_version|historical_ready|cutover_ready|focus_ready|thread_ready'");
  eq(columns, [], 'readiness never became a Product-state or historical-eligibility column');
}

// ------------------------------------------------- B. empty-world readiness
async function verifyEmptyReadiness() {
  stage = 'D. readiness on an empty world';
  await audit();
  assertions += 1;
}

// ------------------------------------- C. integrated snapshot + readiness
async function verifyIntegrated(owner, other) {
  stage = 'B/D/E. fully integrated exchange: snapshot COMPLETE, readiness passes, clock rests at (last_sp, 1)';
  const world = await integratedExchange(owner);
  const { session, turns, userBatch, assistantBatch } = world;

  // Absent is explicit, never invented: an unknown batch of a populated
  // Session still carries the Session's canonical frontier and LH from the
  // T-03A2 read, and NOTHING of its own.
  const absent = await snapshot(session, owner, turns.userTurn, randomUUID());
  eq([absent.batch_exists, absent.committed_unit_count, absent.units, absent.commit_event, absent.focus_batch_exists,
    absent.focus_semantic_count, absent.focus_attention_count, absent.focus_complete,
    absent.thread_capture_state, absent.thread_batch_exists, absent.thread_unit_count, absent.thread_establishment_count],
    [false, 0, [], null, false, 0, 0, false, 'ABSENT', false, 0, 0],
    'an unknown batch is reported ABSENT with no B1 or B2 metadata invented');
  // And on a Session with no commitment at all, every coordinate is empty too.
  const emptySession = await newSession(owner);
  const emptyTurns = await completedTurns(owner, emptySession);
  eq(await snapshot(emptySession, owner, emptyTurns.userTurn, randomUUID()), {
    batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
    focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
    thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  }, 'an absent commitment on an untouched Session invents no coordinate at all');

  const user = await snapshot(session, owner, turns.userTurn, userBatch);
  eq([user.batch_exists, user.committed_unit_count, user.focus_batch_exists, user.focus_semantic_count, user.focus_attention_count, user.focus_complete],
    [true, 3, true, 3, 3, true], 'the commitment and B1 halves are exactly the T-03B1b2 read');
  eq([user.thread_capture_state, user.thread_batch_exists, user.thread_unit_count, user.thread_establishment_count],
    ['COMPLETE', true, 3, 2], 'a fully integrated non-zero batch is COMPLETE and reports its own B2 counters');
  strict(user.live_head, 5);
  eq([user.commit_event.first_sp, user.commit_event.last_sp], [1, 3]);
  const assistant = await snapshot(session, owner, turns.assistantTurn, assistantBatch);
  eq([assistant.thread_capture_state, assistant.thread_unit_count, assistant.thread_establishment_count], ['COMPLETE', 2, 0],
    'a batch that established nothing is COMPLETE with zero establishments: "B2 evaluated and established nothing" is not "B2 never ran"');
  // ED-B2B3-01: the reported state IS the 0068 authority's, never a second opinion.
  for (const [turn, batch] of [[turns.userTurn, userBatch], [turns.assistantTurn, assistantBatch]]) {
    strict((await snapshot(session, owner, turn, batch)).thread_capture_state, await batchState(session, owner, turn, batch),
      'the snapshot state is exactly conversation_thread_batch_state_v1');
  }
  await audit();
  assertions += 1;
  eq(await clockOf(session), { current_sp: 5, same_sp_event_sequence: '1' },
    'the last Moment carried B1 alone, so the open SP rests at same-SP sequence 1; 0069 normalizes nothing');

  // Ownership fails closed on every read.
  await rejected(() => snapshot(session, other, turns.userTurn, userBatch), 'FORBIDDEN', ['42501']);
  await rejected(() => snapshot(randomUUID(), owner, turns.userTurn, userBatch), 'FORBIDDEN', ['42501']);
  await rejected(() => snapshot(session, owner, turns.assistantTurn, userBatch), 'FORBIDDEN', ['42501']);
  await rejected(() => runtimeContext(session, other), 'FORBIDDEN', ['42501']);
  await rejected(() => snapshot(null, owner, turns.userTurn, userBatch), 'INVALID_COMMIT_IDENTITY', ['22023']);
  await rejected(() => runtimeContext(session, null), 'INVALID_COMMIT_IDENTITY', ['22023']);
  return world;
}

// ------------------------------------------------------- D. runtime context
async function verifyRuntimeContext(owner, world, other) {
  stage = 'C. combined B1+B2 runtime context';
  const { session, ids, focuses, handles } = world;
  const context = await runtimeContext(session, owner);
  eq([context.base_current_sp, String(context.base_same_sp_event_sequence)], [5, '1'], 'the context carries the exact semantic-clock token');

  const priorCus = context.prior_cus;
  eq(priorCus.map((cu) => cu.cu_id), [ids.u1, ids.u2, ids.u3, ids.a1, ids.a2], 'every prior committed CU appears exactly once, ordered by SP');
  eq(priorCus.map((cu) => cu.session_position), [1, 2, 3, 4, 5]);
  eq(priorCus.map((cu) => cu.source_role), ['USER', 'USER', 'USER', 'ASSISTANT', 'ASSISTANT']);

  // One COMPLETE canonical B1 bundle per prior CU, in the same SP order.
  const semantics = context.prior_focus_semantics;
  strict(semantics.length, priorCus.length, 'no prior B1 bundle is silently filtered');
  eq(semantics.map((s) => s.unit_id), priorCus.map((cu) => cu.cu_id), 'the bundles are keyed on the exact committed CU ids, in SP order');
  eq(semantics.map((s) => s.attention.kind), ['START_NEW_FOCUS', 'NO_INDEPENDENT_FOCUS', 'START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS', 'ATTEND_EXISTING_FOCUS']);
  eq(semantics.map((s) => s.attention.emerging_focus_id), [focuses.manager, null, focuses.ahmed, focuses.ahmed, focuses.ahmed]);
  eq(semantics.map((s) => s.attention.creates_focus), [true, false, true, false, false], 'creates_focus is derived from the durable started-CU column');
  eq(semantics[0].references, [{ reference_index: 0, ...anchor(U1, 'المدير'), state: 'RESOLVED', resolved_handle_id: handles.manager, creates_handle: true, candidate_handle_ids: [] }],
    'the canonical reference grounding is returned with its exact code-point anchor');
  eq(semantics[2].references[0].creates_handle, false, 'a handle first grounded by an earlier CU is not re-created by a later one');
  eq(semantics[1].claim_attributions.map((a) => [a.claimant_kind, a.claim_frame]), [['REFERENCE_HANDLE', 'REPORTED_SPEECH']],
    'claim attribution provenance travels with the bundle');
  eq(semantics.map((s) => s.target_cu_id), [null, ids.u1, ids.u2, ids.u3, ids.u3], 'the canonical sequence link of every prior CU is preserved');

  // One append-preserved attention item per prior CU: the T-03B2a history shape.
  const history = context.focus_attention_history;
  strict(history.length, priorCus.length, 'one attention item per prior committed CU');
  eq(history.map((entry) => entry.cu_id), priorCus.map((cu) => cu.cu_id));
  eq(history.map((entry) => entry.emerging_focus_id), [focuses.manager, null, focuses.ahmed, focuses.ahmed, focuses.ahmed]);
  eq(Object.keys(history[0]).sort(), ['attention_kind', 'attention_reason', 'cu_id', 'emerging_focus_id'],
    'the attention item carries no score, no timestamp and no analytical count');

  // Canonical Thread truth: same user, same Session, prior SPs only, unique.
  const bindings = context.established_thread_bindings;
  eq(bindings.map((b) => [b.thread_id, b.emerging_focus_id, b.established_cu_id, b.established_sp]), [
    [threadIdOf(owner, focuses.manager), focuses.manager, ids.u1, 1],
    [threadIdOf(owner, focuses.ahmed), focuses.ahmed, ids.u3, 3],
  ], 'the already-canonical Thread bindings are returned in SP order with their exact lineage');
  strict(new Set(bindings.map((b) => b.thread_id)).size, bindings.length, 'Thread ids are unique');
  strict(new Set(bindings.map((b) => b.emerging_focus_id)).size, bindings.length, 'grounding Emerging Focus ids are unique');
  ok(bindings.every((b) => b.established_sp <= context.base_current_sp), 'no Thread is established at a future SP');
  eq(Object.keys(bindings[0]).sort(), ['emerging_focus_id', 'established_cu_id', 'established_sp', 'thread_id'],
    'a binding carries no Home coordinate, no lifecycle, no label and no LF');

  // No cross-session and no cross-user leak: a second Session of the SAME user
  // sees only its own Threads, and another user's world is unreachable.
  const second = await integratedExchange(owner);
  const secondContext = await runtimeContext(second.session, owner);
  eq(secondContext.established_thread_bindings.map((b) => b.established_cu_id), [second.ids.u1, second.ids.u3],
    'a second Session sees only the Threads established inside it: no cross-session reopening or sameness is inferred');
  ok(!secondContext.established_thread_bindings.some((b) => b.thread_id === threadIdOf(owner, focuses.manager)),
    'the first Session\'s Threads never leak into another Session\'s runtime context');
  const otherSession = await newSession(other);
  const otherContext = await runtimeContext(otherSession, other);
  eq([otherContext.prior_cus, otherContext.prior_focus_semantics, otherContext.focus_attention_history, otherContext.established_thread_bindings],
    [[], [], [], []], 'another user\'s fresh Session carries no history at all');
  eq([otherContext.base_current_sp, String(otherContext.base_same_sp_event_sequence)], [null, '0'],
    'before the first SP the token is exactly (null, 0)');
  await audit();
  assertions += 1;
}

// ------------------------------------------------- E. the zero-CU exchange
async function verifyZeroCuCapture(owner) {
  stage = 'B/D. a committed zero-CU half is a supported COMPLETE capture';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session, U1, A1);
  const id = randomUUID();
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  await exchange(session, owner, turns.userTurn, userBatch,
    [unit(U1, U1, 1, id)], [bundle(id)], [noEstablishment(id, 'NO_INDEPENDENT_FOCUS')],
    turns.assistantTurn, assistantBatch, [], [], [], FRESH_TOKEN);
  const zero = await snapshot(session, owner, turns.assistantTurn, assistantBatch);
  eq([zero.batch_exists, zero.committed_unit_count, zero.commit_event, zero.focus_batch_exists, zero.focus_complete,
    zero.thread_capture_state, zero.thread_batch_exists, zero.thread_unit_count, zero.thread_establishment_count],
    [true, 0, null, true, true, 'COMPLETE', true, 0, 0],
    'a committed zero-CU batch with its zero-unit B1 and B2 capture rows is COMPLETE, with no SP and no event of its own');
  strict(zero.thread_capture_state, await batchState(session, owner, turns.assistantTurn, assistantBatch), 'the 0068 authority agrees');
  await audit();
  assertions += 1;
  eq(await clockOf(session), { current_sp: 1, same_sp_event_sequence: '1' }, 'a zero-CU half allocated no SP and reserved no same-SP sequence');
}

// ------------------------------------------- E. the second clock resting place
async function verifyEstablishingClock(owner) {
  stage = 'E. the clock policy 0069 must not normalize';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session, U1, A1);
  const ids = { u1: randomUUID(), a1: randomUUID() };
  const focus = randomUUID();
  const handle = randomUUID();
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  await exchange(session, owner, turns.userTurn, userBatch,
    [unit(U1, U1, 1, ids.u1)],
    [bundle(ids.u1, { references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })],
    [noEstablishment(ids.u1, 'NO_PROMOTION_PATH_PROVEN', focus)],
    turns.assistantTurn, assistantBatch,
    [unit(A1, A1, 1, ids.a1)],
    [bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u1,
      references: [resolved(A1, 'أحمد', handle, false)], attention: attendFocus(focus, 0, 'DIRECT_REQUEST_OR_QUESTION') })],
    [establish(owner, ids.a1, focus, 'TE-02', [ids.u1, ids.a1])],
    FRESH_TOKEN);
  eq(await clockOf(session), { current_sp: 2, same_sp_event_sequence: '2' },
    'the last Moment established a Thread, so the open SP rests at same-SP sequence 2');
  const context = await runtimeContext(session, owner);
  eq([context.base_current_sp, String(context.base_same_sp_event_sequence)], [2, '2'], 'the context reports that exact token, unnormalized');
  await audit();
  assertions += 1;
  eq(await clockOf(session), { current_sp: 2, same_sp_event_sequence: '2' }, 'reading the context and the audit changed no clock coordinate');
}

// ------------------------------------------------- F. legacy / partial shapes
async function verifyLegacyAndPartial(owner) {
  stage = 'B/C/D. legacy and structurally partial capture';
  const world = await integratedExchange(owner);

  const shapes = [
    ['a legacy T-03A2-only non-zero batch', async (session, turns) => {
      const batch = randomUUID();
      await legacyCommit(session, owner, turns.userTurn, batch, [unit(USER_TEXT, U1, 1, randomUUID())]);
      return { turn: turns.userTurn, batch, focusBatch: false };
    }],
    ['a legacy T-03A2-only zero-CU batch', async (session, turns) => {
      const batch = randomUUID();
      await legacyCommit(session, owner, turns.userTurn, batch, []);
      return { turn: turns.userTurn, batch, focusBatch: false };
    }],
    ['a B1-only batch whose B2 capture never ran', async (session, turns) => {
      const batch = randomUUID();
      const id = randomUUID();
      await focusOnlyCommit(session, owner, turns.userTurn, batch, [unit(USER_TEXT, U1, 1, id)], [bundle(id)]);
      return { turn: turns.userTurn, batch, focusBatch: true };
    }],
  ];
  for (const [label, build] of shapes) {
    await q('SAVEPOINT partial');
    const session = await newSession(owner);
    const turns = await completedTurns(owner, session);
    const { turn, batch, focusBatch } = await build(session, turns);
    const state = await snapshot(session, owner, turn, batch);
    strict(state.batch_exists, true, `${label} exists: it is incomplete, never absent`);
    strict(state.thread_capture_state, 'PARTIAL', `${label} is PARTIAL`);
    strict(state.focus_batch_exists, focusBatch, `${label} reports its B1 half truthfully`);
    strict(state.thread_batch_exists, false, `${label} has no B2 capture batch`);
    strict(state.thread_capture_state, await batchState(session, owner, turn, batch), 'the 0068 authority agrees');
    const failure = await rejected(audit, 'THREAD_CAPTURE_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_THREAD_COMPLETE/u);
    // The runtime context of that Session refuses to serve partial history.
    await rejected(() => runtimeContext(session, owner), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    await q('ROLLBACK TO SAVEPOINT partial');
    await q('RELEASE SAVEPOINT partial');
  }

  // Structural corruption of an OTHERWISE complete B2 capture: evidence, origin
  // provenance and Thread / Home / event coherence each make the batch PARTIAL.
  const managerThread = threadIdOf(owner, world.focuses.manager);
  const ahmedThread = threadIdOf(owner, world.focuses.ahmed);
  const corruptions = [
    ['a deleted establishment-evidence row', ['DELETE FROM public.conversation_thread_establishment_evidence WHERE thread_id = $1', [managerThread]]],
    ['a deleted Conversational Origin member', ['DELETE FROM public.conversation_thread_origin_members WHERE thread_id = $1', [ahmedThread]]],
    ['an incoherent establishment path between Thread and event', ['UPDATE public.conversation_threads SET establishment_path = $2 WHERE id = $1', [managerThread, 'TE-03']]],
    ['a deleted permanent Home', ['DELETE FROM public.conversation_thread_homes WHERE thread_id = $1', [managerThread]]],
  ];
  for (const [label, [sql, values]] of corruptions) {
    await q('SAVEPOINT corrupt');
    await q("SET LOCAL session_replication_role = 'replica'");
    await q(sql, values);
    await q("SET LOCAL session_replication_role = 'origin'");
    const state = await snapshot(world.session, owner, world.turns.userTurn, world.userBatch);
    strict(state.thread_capture_state, 'PARTIAL', `${label} makes the batch PARTIAL, never COMPLETE`);
    strict(state.thread_batch_exists, true, `${label} keeps the capture batch visible: the corruption is reported, never hidden`);
    strict(state.thread_capture_state, await batchState(world.session, owner, world.turns.userTurn, world.userBatch), 'the 0068 authority agrees');
    await rejected(audit, 'THREAD_CAPTURE_CUTOVER_NOT_READY', ['55000']);
    await rejected(() => runtimeContext(world.session, owner), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    await q('ROLLBACK TO SAVEPOINT corrupt');
    await q('RELEASE SAVEPOINT corrupt');
  }
  // Nothing above backfilled, repaired or rewrote anything.
  strict((await snapshot(world.session, owner, world.turns.userTurn, world.userBatch)).thread_capture_state, 'COMPLETE',
    'the canonical world is exactly as it was: no repair, no backfill');
  await audit();
  assertions += 1;
}

// ---------------------------------------------------------- G. zero mutation
async function verifyZeroMutation(owner, world) {
  stage = 'D. the reads and the audit mutate zero rows and zero clock coordinates';
  const before = await worldSnapshot();
  await snapshot(world.session, owner, world.turns.userTurn, world.userBatch);
  await snapshot(world.session, owner, world.turns.assistantTurn, world.assistantBatch);
  await runtimeContext(world.session, owner);
  await audit();
  await audit();
  eq(await worldSnapshot(), before, 'three reads and two audits mutated zero rows and zero clock coordinates');
  const [{ count }] = await rows('SELECT count(*)::int count FROM public.conversation_thread_commit_batches');
  ok(count >= 1, 'no B2 capture row was created or destroyed by reading');
}

// -------------------------------------------------------- H. application ACL
async function verifyRuntimeAcl(owner, world) {
  stage = 'A. production-inert runtime ACL';
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => snapshot(world.session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
    await rejected(() => runtimeContext(world.session, owner), 'permission denied', ['42501']);
    await rejected(audit, 'permission denied', ['42501']);
    await rejected(() => batchState(world.session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
  }
  // The live T-03A2 read still answers service_role exactly as before.
  await identity('service_role');
  const [legacy] = await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)',
    [world.session, owner, world.turns.userTurn, world.userBatch]);
  strict(legacy.batch_exists, true, 'the T-03A2 snapshot read remains live for service_role');
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
      const world = await verifyIntegrated(owner, other);
      await verifyRuntimeContext(owner, world, other);
      await verifyZeroCuCapture(owner);
      await verifyEstablishingClock(owner);
      await verifyLegacyAndPartial(owner);
      await verifyZeroMutation(owner, world);
      await verifyRuntimeAcl(owner, world);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    console.log(`Verified migration 0069 (${assertions} assertions): the integrated B1+B2 snapshot reports ABSENT, COMPLETE (non-zero, zero-establishment and zero-CU) and PARTIAL (legacy T-03A2-only, B1-only, corrupted evidence, corrupted origin provenance, incoherent Thread/Home/event) exactly as migration 0068's single structural authority does; the combined runtime context returns one exact clock token, every prior CU in SP order with exactly one canonical B1 bundle and one attention item each, and only same-user same-Session Thread bindings at prior SPs, refusing legacy or partial prior history with INCOMPLETE_PRIOR_THREAD_HISTORY and leaking nothing across Sessions or users; the readiness audit passes an empty and a fully integrated world and fails THREAD_CAPTURE_CUTOVER_NOT_READY on every legacy or partial shape; the clock rests at (last_sp, 1) with B1 alone and (last_sp, 2) after an establishment with neither normalized; and nothing is granted, nothing is revoked, nothing is backfilled and no row or clock coordinate is mutated.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Thread runtime integration readiness verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
