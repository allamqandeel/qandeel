// Real-PostgreSQL verifier for migration 0066 - Durable Reference / Emerging
// Focus SP-Native Substrate + Per-Moment Integrated DB Writer v1.
//
// Proves against live semantics, never grep alone: the per-Moment integrated
// transaction (SP born, head opened, same-SP sequence 1 reserved through the
// ONE T-03A2 seam, the whole semantic bundle persisted, only then the next
// CU); AF66-01 from the deployed bodies; stale-context protection under the
// clock lock with zero mutation; stable reference-handle and Emerging Focus
// identity; frozen reference / claim / attention / function cardinalities
// revalidated by the database; structural focus uniqueness; exact-anchor
// verification in code points; exact replay with zero mutation, payload and
// provenance conflicts, partial semantic state failing closed; the zero-CU
// batch; the authoritative context snapshot; and the production-inert
// posture (no application role executes anything new, the T-03A2 grants are
// untouched). Every fixture is rolled back or explicitly removed.
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
}

const WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
const CONTEXT = 'public.get_conversation_focus_runtime_context_v1(uuid,uuid)';
const PERSIST = 'public.persist_conversation_unit_focus_semantics_v1(public.conversation_units,uuid,jsonb,bigint)';
const ANCHOR = 'public.validate_conversation_focus_anchor_v1(text,jsonb)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const LEGACY_PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const FOCUS_TABLES = [
  'conversation_focus_commit_batches', 'conversation_reference_handles', 'conversation_unit_focus_semantics',
  'conversation_reference_resolutions', 'conversation_reference_resolution_candidates', 'conversation_claim_attributions',
  'conversation_emerging_focuses', 'conversation_emerging_focus_attention_events'];
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// The Egyptian-Arabic scenario. USER: the manager (CU1, a new focus), an
// incidental Ahmed mention inside a reported claim (CU2, Mention only), then
// Ahmed as a direct concern (CU3, a new focus). ASSISTANT: a question about
// Ahmed (attends the Ahmed focus through a resolved link), then a local
// clarification question (attends it with no reference at all).
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
/** An exact anchor inside ONE CU's committed wording. */
const anchor = (cuText, excerpt, occurrence = 1) => {
  const { start, end } = spanOf(cuText, excerpt, occurrence);
  return { anchor_text: excerpt, anchor_occurrence: occurrence, span_start: start, span_end: end };
};
const resolved = (cuText, excerpt, handle, creates = false, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), state: 'RESOLVED', resolved_handle_id: handle, creates_handle: creates, candidate_handle_ids: [] });
const ambiguous = (cuText, excerpt, candidates, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), state: 'AMBIGUOUS', resolved_handle_id: null, creates_handle: false, candidate_handle_ids: candidates });
const unresolved = (cuText, excerpt, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), state: 'UNRESOLVED', resolved_handle_id: null, creates_handle: false, candidate_handle_ids: [] });
const claim = (cuText, excerpt, kind, handle, frame, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), claimant_kind: kind, claimant_handle_id: handle, claim_frame: frame });
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
const startFocus = (focusId, index, reason = 'DIRECT_SUBJECT') =>
  ({ kind: 'START_NEW_FOCUS', reason, emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: index });
const attendFocus = (focusId, index, reason = 'SUBSTANTIVE_ELABORATION') =>
  ({ kind: 'ATTEND_EXISTING_FOCUS', reason, emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: index });
/** One canonical semantic bundle for one proposed CU. */
const bundle = (unitId, overrides = {}) => {
  const references = (overrides.references ?? []).map((reference, index) => ({ reference_index: index, ...reference }));
  const claims = (overrides.claim_attributions ?? []).map((attribution, index) => ({ attribution_index: index, ...attribution }));
  return {
    unit_id: unitId,
    functions: overrides.functions ?? ['INFORM_REPORT'],
    sequence_position: overrides.sequence_position ?? 'UNMARKED',
    target_cu_id: overrides.target_cu_id ?? null,
    references,
    claim_attributions: claims,
    attention: overrides.attention ?? NO_FOCUS,
  };
};

const commitWithFocus = (session, user, turn, batch, units, bundles, provenance = PROVENANCE, focusProvenance = FOCUS_PROVENANCE) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [session, user, turn, batch, JSON.stringify(units), ...provenance, JSON.stringify(bundles), ...focusProvenance]);
const exchangeWithFocus = (session, user, userTurn, userBatch, userUnits, userBundles, assistantTurn, assistantBatch, assistantUnits, assistantBundles, token, focusProvenance = FOCUS_PROVENANCE) =>
  rows('SELECT * FROM commit_finalized_exchange_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles),
      assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles),
      ...PROVENANCE, ...focusProvenance, token.sp, token.seq]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const contextOf = async (session, user) =>
  (await rows('SELECT * FROM get_conversation_focus_runtime_context_v1($1,$2)', [session, user]))[0];
const clockOf = async (session) =>
  (await rows('SELECT * FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
const eventsOfSession = (session) =>
  rows('SELECT * FROM public.conversation_unit_commit_events WHERE session_id=$1 ORDER BY first_sp', [session]);
/** Every semantic row of a Session across the eight tables plus the CUs, for zero-mutation proofs. */
async function semanticSnapshot(session) {
  const snapshot = {};
  for (const table of [...FOCUS_TABLES, 'conversation_units', 'conversation_unit_commit_events', 'conversation_unit_commit_batches']) {
    snapshot[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t WHERE t.session_id=$1 ORDER BY to_jsonb(t)::text`, [session])).map((r) => r.row);
  }
  snapshot.clock = await clockOf(session);
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

/** The full scenario payload: 3 USER CUs then 2 ASSISTANT CUs with their semantic bundles. */
function scenario() {
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const userUnits = [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, ids.a1), unit(ASSISTANT_TEXT, A2, 1, ids.a2)];
  const userBundles = [
    bundle(ids.u1, { functions: ['INFORM_REPORT'], sequence_position: 'INITIATING',
      references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
    bundle(ids.u2, { functions: ['INFORM_REPORT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1,
      references: [resolved(U2, 'أحمد', handles.ahmed, true)],
      claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handles.ahmed, 'REPORTED_SPEECH')],
      attention: NO_FOCUS }),
    bundle(ids.u3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u2,
      references: [resolved(U3, 'أحمد', handles.ahmed, false)], attention: startFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  const assistantBundles = [
    bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u3,
      references: [resolved(A1, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION') }),
    bundle(ids.a2, { functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3,
      references: [], attention: attendFocus(focuses.ahmed, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
  ];
  return { ids, handles, focuses, userUnits, assistantUnits, userBundles, assistantBundles };
}

const FRESH_TOKEN = { sp: null, seq: 0 };

// ---------------------------------------------------------------- static gate
async function verifyStaticAuthority() {
  stage = 'A. schema / immutability / privileges';
  for (const [signature, label] of [[WRITER, 'integrated writer'], [COORDINATOR, 'focus exchange coordinator'],
    [CONTEXT, 'context snapshot'], [PERSIST, 'semantic persistence helper'], [ANCHOR, 'anchor validator']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    assert.equal(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid = to_regprocedure($1)',
      [signature]);
    assert.equal(contract.owner, 'postgres', `${label} is postgres-owned`);
    assert.equal(contract.definer, true, `${label} is SECURITY DEFINER`);
    assert.ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')),
      `${label} has a fixed empty search path`);
  }
  // 0064 / 0065 objects remain valid.
  for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT, SAME_SP_HELPER]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    assert.equal(presence.present, true, `${signature} still exists`);
  }
  for (const table of ['conversation_units', 'conversation_unit_commit_batches', 'session_semantic_clocks', 'conversation_unit_commit_events', ...FOCUS_TABLES]) {
    const [presence] = await rows("SELECT to_regclass($1) IS NOT NULL present", [`public.${table}`]);
    assert.equal(presence.present, true, `${table} exists`);
  }

  // AF66-01 from the DEPLOYED bodies. The writer: clock FOR UPDATE, then the
  // source turn, then (per CU) the CU insert, the head advance, the ONE
  // same-SP seam, then the semantic persistence - and nothing else advances
  // the sequence.
  const [{ definition: writer }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [WRITER]);
  const clockLock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turnLock = writer.indexOf('FROM public.conversation_turns t');
  assert.ok(clockLock > 0 && turnLock > 0 && clockLock < turnLock, 'AF66-01: the writer reads the Session clock before the source turn');
  assert.ok(writer.indexOf('FOR UPDATE', clockLock) < turnLock, 'the clock lock is FOR UPDATE and precedes the turn lock');
  assert.equal((writer.match(/FROM public\.session_semantic_clocks c\s+WHERE c\.session_id = p_session_id AND c\.user_id = p_user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one Session clock is acquired by the writer');
  const cuInsert = writer.indexOf('INSERT INTO public.conversation_units (');
  const headAdvance = writer.indexOf('SET current_sp = this_sp, same_sp_event_sequence = 0');
  const reservation = writer.indexOf('reserve_session_same_sp_event_v1(p_session_id, p_user_id)');
  const persistence = writer.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const deliveryEvent = writer.indexOf('INSERT INTO public.conversation_unit_commit_events');
  assert.ok(turnLock < cuInsert && cuInsert < headAdvance && headAdvance < reservation && reservation < persistence && persistence < deliveryEvent,
    'per CU: insert with SP -> open the head -> reserve through the seam -> persist the bundle; the delivery event follows the loop');
  assert.equal((writer.match(/same_sp_event_sequence = c\.same_sp_event_sequence \+ 1/gu) ?? []).length, 0,
    'the writer never increments the same-SP sequence itself: the T-03A2 seam is the ONE sequence authority');
  assert.equal((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 1, 'the seam is called exactly once per CU, in the loop');
  assert.match(writer, /reserved_sequence IS DISTINCT FROM 1::bigint/u, 'the first Stage-6 semantic layer after commitment is sequence 1');
  assert.doesNotMatch(writer.slice(writer.indexOf('this_sp := COALESCE')), /CURRENT_TIMESTAMP|now\(\)|clock_timestamp|created_at/u,
    'no wall-clock value participates in SP, sequence or semantic ordering');
  // The coordinator: clock first, USER then ASSISTANT source rows, the
  // relation gate, then the token check, then the two writer calls.
  const [{ definition: coordinator }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [COORDINATOR]);
  const cClock = coordinator.indexOf('FROM public.session_semantic_clocks c');
  const cUser = coordinator.indexOf('INTO user_turn_row');
  const cAssistant = coordinator.indexOf('INTO assistant_turn_row');
  const cRelation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const cStale = coordinator.indexOf('STALE_CONVERSATIONAL_FOCUS_CONTEXT');
  const cWriter = coordinator.indexOf('commit_conversation_units_with_focus_v1(');
  assert.ok(cClock > 0 && cClock < cUser && cUser < cAssistant && cAssistant < cRelation && cRelation < cStale && cStale < cWriter,
    'clock lock -> USER row -> ASSISTANT row -> relation gate -> expected-token check -> semantic writes');
  assert.equal((coordinator.match(/FROM public\.session_semantic_clocks c\s+WHERE c\.session_id = p_session_id AND c\.user_id = p_user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one Session clock is acquired by one semantic transaction');
  assert.match(coordinator, /clock_row\.current_sp IS DISTINCT FROM p_expected_current_sp\s+OR clock_row\.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence/u,
    'the token is compared against the LOCKED clock row');
  const [{ definition: context }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [CONTEXT]);
  assert.doesNotMatch(context, /created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u, 'no timestamp influences the returned semantic order');
  assert.match(context, /ORDER BY cu\.session_position/u, 'prior CUs are ordered by Session Position');
  assert.match(context, /ORDER BY e\.session_position DESC, e\.same_sp_event_sequence DESC/u, 'the current focus is the latest START/ATTEND by (SP, sequence)');

  // Production-inert: no application role executes anything new; the T-03A2
  // grants are untouched; the seam stays internal.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [WRITER, COORDINATOR, CONTEXT, PERSIST, ANCHOR, SAME_SP_HELPER]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      assert.equal(granted, false, `${role} must not execute ${signature}`);
    }
    for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      assert.equal(granted, role === 'service_role', `the T-03A2 grant on ${signature} is unchanged for ${role}`);
    }
    for (const table of FOCUS_TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        assert.equal(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // Append-only on every table, structural focus uniqueness, no Thread/LF/Home/K-V column.
  for (const table of FOCUS_TABLES) {
    const [{ count }] = await rows(
      "SELECT count(*) count FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal AND tgfoid='public.reject_conversation_focus_semantic_mutation_v1'::regproc",
      [`public.${table}`]);
    assert.equal(Number(count), 1, `${table} is append-only`);
  }
  const [{ count: focusUnique }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_emerging_focuses'::regclass AND contype='u' AND conname='emerging_focuses_grounding_unique' AND pg_get_constraintdef(oid)='UNIQUE (session_id, grounding_handle_id)'");
  assert.equal(Number(focusUnique), 1, 'UNIQUE(session_id, grounding_handle_id) exists on Emerging Focus');
  // One semantic bundle per Session Position, structurally, and every bundle
  // SP is a real SP of its own Session.
  const [{ count: bundleUnique }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_unit_focus_semantics'::regclass AND conname='cu_focus_semantics_sp_unique' AND pg_get_constraintdef(oid)='UNIQUE (session_id, session_position)'");
  assert.equal(Number(bundleUnique), 1, 'UNIQUE(session_id, session_position) exists on the CU semantic bundle');
  const [{ count: bundleSpFk }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_unit_focus_semantics'::regclass AND conname='cu_focus_semantics_sp_fk' AND contype='f'");
  assert.equal(Number(bundleSpFk), 1, 'the bundle SP is foreign-keyed to (session_id, session_position) of conversation_units');
  const columns = await rows(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1::text[])", [FOCUS_TABLES]);
  assert.deepEqual(columns.filter((c) => /thread|home|live_focus|lifecycle|status|score|confidence|embedding|label|active|sealed|timeline|knowledge|normalized/iu.test(c.column_name)), [],
    'no Thread/Home/lifecycle/LF/status/score/label/K-V column exists');
  const focusColumns = columns.filter((c) => c.table_name === 'conversation_emerging_focuses').map((c) => c.column_name).sort();
  assert.deepEqual(focusColumns, ['created_at', 'grounding_handle_id', 'id', 'session_id', 'started_cu_id', 'started_event_sequence', 'started_sp', 'user_id'],
    'an Emerging Focus is a stable, non-geographic, provisional identity and nothing more');
  const handleColumns = columns.filter((c) => c.table_name === 'conversation_reference_handles').map((c) => c.column_name).sort();
  assert.deepEqual(handleColumns, ['created_at', 'first_cu_id', 'first_event_sequence', 'first_sp', 'id', 'session_id', 'user_id'],
    'a reference handle carries no name, label, embedding or type');
  // The clock is unchanged.
  const clockColumns = (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='session_semantic_clocks' ORDER BY column_name")).map((r) => r.column_name);
  assert.deepEqual(clockColumns, ['current_sp', 'same_sp_event_sequence', 'session_id', 'user_id']);
}

// --------------------------------------------------- per-Moment temporal integrity
async function verifyPerMomentIntegrity(owner) {
  stage = 'B. per-Moment temporal integrity';
  // One CU: SP1, B1 sequence 1, then an owner-internal reservation gets 2.
  const single = await newSession(owner);
  const singleTurns = await completedTurns(owner, single);
  const only = randomUUID();
  const handle = randomUUID();
  const committed = await commitWithFocus(single, owner, singleTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, only)],
    [bundle(only, { references: [resolved(U1, 'المدير', handle, true)] })]);
  assert.equal(committed.length, 1);
  assert.equal(committed[0].session_position, 1, 'the first committed CU is SP(1)');
  const [semantics] = await rows('SELECT * FROM public.conversation_unit_focus_semantics WHERE cu_id=$1', [only]);
  assert.equal(semantics.session_position, 1);
  assert.equal(Number(semantics.same_sp_event_sequence), 1, 'B1 semantics sit at same-SP sequence 1 of the SP the CU was born at');
  assert.deepEqual(await clockOf(single), { session_id: single, user_id: owner, current_sp: 1, same_sp_event_sequence: '1' },
    'after B1 the head is open at sequence 1');
  const [reserved] = await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [single, owner]);
  assert.equal(reserved.session_position, 1);
  assert.equal(Number(reserved.event_sequence), 2, 'a later owner-internal same-SP reservation gets sequence 2 on the open head');
  const [handleRow] = await rows('SELECT * FROM public.conversation_reference_handles WHERE id=$1', [handle]);
  assert.deepEqual([handleRow.first_cu_id, handleRow.first_sp, Number(handleRow.first_event_sequence)], [only, 1, 1],
    'the handle is born at the exact (SP, sequence) of its first grounding');

  // Three USER + two ASSISTANT CUs: contiguous SP1..SP5, every bundle at
  // sequence 1, semantics in place before the next SP sealed each one,
  // final clock (5, 1).
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const s = scenario();
  const [result] = await exchangeWithFocus(session, owner, turns.userTurn, randomUUID(), s.userUnits, s.userBundles,
    turns.assistantTurn, randomUUID(), s.assistantUnits, s.assistantBundles, FRESH_TOKEN);
  assert.equal(result.live_head, 5, 'the exchange advanced LH to SP(5)');
  assert.equal(Number(result.same_sp_event_sequence), 1, 'the final head carries B1 at sequence 1');
  assert.deepEqual(result.user_units.map((r) => r.session_position), [1, 2, 3]);
  assert.deepEqual(result.assistant_units.map((r) => r.session_position), [4, 5]);
  assert.equal(result.user_event.first_sp, 1); assert.equal(result.user_event.last_sp, 3);
  assert.equal(result.assistant_event.first_sp, 4); assert.equal(result.assistant_event.last_sp, 5);
  const bundles = await rows(
    'SELECT s.cu_id, s.session_position, s.same_sp_event_sequence, cu.session_position cu_sp FROM public.conversation_unit_focus_semantics s JOIN public.conversation_units cu ON cu.id=s.cu_id WHERE s.session_id=$1 ORDER BY s.session_position', [session]);
  assert.deepEqual(bundles.map((r) => [r.session_position, r.cu_sp, Number(r.same_sp_event_sequence)]), [[1, 1, 1], [2, 2, 1], [3, 3, 1], [4, 4, 1], [5, 5, 1]],
    'every CU carries its semantic bundle at its own SP and sequence 1: each was written before the next SP sealed it');
  const attention = await rows('SELECT session_position, attention_kind, emerging_focus_id, grounding_reference_index FROM public.conversation_emerging_focus_attention_events WHERE session_id=$1 ORDER BY session_position', [session]);
  assert.deepEqual(attention.map((r) => r.attention_kind), ['START_NEW_FOCUS', 'NO_INDEPENDENT_FOCUS', 'START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS', 'ATTEND_EXISTING_FOCUS']);
  assert.deepEqual(await clockOf(session), { session_id: session, user_id: owner, current_sp: 5, same_sp_event_sequence: '1' });
  const sealed = await rows('SELECT session_position sp, (session_position < 5) is_sealed FROM public.conversation_units WHERE session_id=$1 ORDER BY session_position', [session]);
  assert.deepEqual(sealed.map((r) => r.is_sealed), [true, true, true, true, false], 'SP1..SP4 are sealed, SP5 is open');

  // No writer can anchor NEW B1 semantic truth to a sealed earlier SP: a
  // second bundle for SP1 is structurally impossible, and the head-only seam
  // is the only sequence authority (proven in family A).
  await rejected(() => q(
    "INSERT INTO public.conversation_unit_focus_semantics(cu_id,focus_commit_batch_id,user_id,session_id,session_position,same_sp_event_sequence,functions,sequence_position,target_cu_id) "
    + "SELECT $1, s.focus_commit_batch_id, s.user_id, s.session_id, 1, 2, ARRAY['ASK'], 'UNMARKED', NULL FROM public.conversation_unit_focus_semantics s WHERE s.session_id=$2 AND s.session_position=1",
    [randomUUID(), session]), 'duplicate key', ['23505']);
  await rejected(() => q(
    "INSERT INTO public.conversation_emerging_focus_attention_events(cu_id,user_id,session_id,session_position,same_sp_event_sequence,attention_kind,attention_reason,emerging_focus_id,grounding_reference_index) "
    + "SELECT e.cu_id, e.user_id, e.session_id, 1, 2, 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', NULL, NULL FROM public.conversation_emerging_focus_attention_events e WHERE e.session_id=$1 AND e.session_position=5",
    [session]), 'duplicate key', ['23505']);
  return { session, turns, scenario: s };
}

// -------------------------------------------------------- reference semantics
async function verifyReferenceSemantics(owner, populated) {
  stage = 'C. reference semantics';
  const { session, turns, scenario: s } = populated;
  const handles = await rows('SELECT * FROM public.conversation_reference_handles WHERE session_id=$1 ORDER BY first_sp', [session]);
  assert.deepEqual(handles.map((h) => [h.id, h.first_cu_id, h.first_sp, Number(h.first_event_sequence)]),
    [[s.handles.manager, s.ids.u1, 1, 1], [s.handles.ahmed, s.ids.u2, 2, 1]],
    'each new reference created exactly one stable handle at its first grounding');
  const resolutions = await rows('SELECT cu_id, reference_index, state, resolved_handle_id, anchor_text, span_start, span_end FROM public.conversation_reference_resolutions WHERE session_id=$1 ORDER BY session_position, reference_index', [session]);
  assert.deepEqual(resolutions.map((r) => [r.state, r.resolved_handle_id]),
    [['RESOLVED', s.handles.manager], ['RESOLVED', s.handles.ahmed], ['RESOLVED', s.handles.ahmed], ['RESOLVED', s.handles.ahmed]],
    'the existing Ahmed handle is reused by later references, never re-minted');
  for (const r of resolutions) {
    const [{ committed_text }] = await rows('SELECT committed_text FROM public.conversation_units WHERE id=$1', [r.cu_id]);
    assert.equal(points(committed_text).slice(r.span_start, r.span_end).join(''), r.anchor_text, 'the stored span slices exactly the anchor in code points');
  }

  // Same-name handles remain distinct, and AMBIGUOUS needs two distinct
  // same-Session candidates.
  const twins = await newSession(owner);
  const twinText = 'أحمد اللي في الفريق زعلان. أحمد ابن عمي زارنا. أحمد اتصل بيا امبارح.';
  const twinTurns = await completedTurns(owner, twins, twinText, ASSISTANT_TEXT);
  const [teamCu, cousinCu, callerCu] = [randomUUID(), randomUUID(), randomUUID()];
  const [teamAhmed, cousinAhmed] = [randomUUID(), randomUUID()];
  const T1 = 'أحمد اللي في الفريق زعلان.';
  const T2 = 'أحمد ابن عمي زارنا.';
  const T3 = 'أحمد اتصل بيا امبارح.';
  const twinUnits = [unit(twinText, T1, 1, teamCu), unit(twinText, T2, 1, cousinCu), unit(twinText, T3, 1, callerCu)];
  await commitWithFocus(twins, owner, twinTurns.userTurn, randomUUID(), twinUnits, [
    bundle(teamCu, { references: [resolved(T1, 'أحمد', teamAhmed, true)] }),
    bundle(cousinCu, { references: [resolved(T2, 'أحمد', cousinAhmed, true)] }),
    bundle(callerCu, { references: [ambiguous(T3, 'أحمد', [teamAhmed, cousinAhmed])], attention: { ...NO_FOCUS, reason: 'UNRESOLVED_ATTENTION' } }),
  ]);
  const twinHandles = await rows('SELECT id, first_cu_id FROM public.conversation_reference_handles WHERE session_id=$1 ORDER BY first_sp', [twins]);
  assert.deepEqual(twinHandles.map((h) => [h.id, h.first_cu_id]), [[teamAhmed, teamCu], [cousinAhmed, cousinCu]], 'two handles named أحمد are distinct identities');
  const candidates = await rows('SELECT handle_id FROM public.conversation_reference_resolution_candidates WHERE cu_id=$1 ORDER BY handle_id', [callerCu]);
  assert.deepEqual(candidates.map((c) => c.handle_id).sort(), [teamAhmed, cousinAhmed].sort(), 'the AMBIGUOUS reference stored both candidates and no identity');
  const [ambiguousRow] = await rows('SELECT state, resolved_handle_id FROM public.conversation_reference_resolutions WHERE cu_id=$1', [callerCu]);
  assert.deepEqual(ambiguousRow, { state: 'AMBIGUOUS', resolved_handle_id: null });
  const twinContext = await contextOf(twins, owner);
  assert.deepEqual(twinContext.reference_handles.map((h) => [h.handle_id, h.grounding.map((g) => [g.cu_id, g.exact_surface])]),
    [[teamAhmed, [[teamCu, 'أحمد']]], [cousinAhmed, [[cousinCu, 'أحمد']]]],
    'the context distinguishes same-name handles by their exact grounding CU');

  // Rejections. Each attempt is a fresh batch against a fresh CU proposal.
  const rejectionSession = await newSession(owner);
  const rejectionTurns = await completedTurns(owner, rejectionSession);
  const attempt = (bundles, units = [unit(USER_TEXT, U2, 1, bundles[0].unit_id)]) =>
    commitWithFocus(rejectionSession, owner, rejectionTurns.userTurn, randomUUID(), units, bundles);
  const fresh = () => randomUUID();
  let id = fresh();
  await rejected(() => attempt([bundle(id, { references: [ambiguous(U2, 'أحمد', [s.handles.ahmed, s.handles.manager])] })]), 'UNKNOWN_REFERENCE_HANDLE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [resolved(U2, 'أحمد', s.handles.ahmed, false)] })]), 'UNKNOWN_REFERENCE_HANDLE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [{ ...resolved(U2, 'أحمد', fresh(), true), anchor_text: 'احمد' }] })]), 'NON_EXTRACTIVE_REFERENCE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [{ ...resolved(U2, 'أحمد', fresh(), true), span_end: 3 }] })]), 'NON_EXTRACTIVE_REFERENCE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [{ ...resolved(U2, 'أحمد', fresh(), true), span_start: 0, span_end: 400 }] })]), 'NON_EXTRACTIVE_REFERENCE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [{ ...resolved(U2, 'أحمد', fresh(), true), anchor_occurrence: 2 }] })]), 'OCCURRENCE_OUT_OF_RANGE');
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [resolved(U2, 'أحمد', fresh(), true), unresolved(U2, 'ده'), { ...resolved(U2, 'الموضوع', fresh(), true), anchor_occurrence: 0 }] })]), 'OCCURRENCE_OUT_OF_RANGE');
  // A unique surface named as its second occurrence, and a second occurrence
  // that does not exist: both are the repetition that is not there.
  const repeatedSession = await newSession(owner);
  const repeatedText = 'أحمد زعلان، وأحمد مش عايز يتكلم.';
  const repeatedTurns = await completedTurns(owner, repeatedSession, repeatedText, ASSISTANT_TEXT);
  const rep = fresh();
  const two = fresh();
  const both = await commitWithFocus(repeatedSession, owner, repeatedTurns.userTurn, randomUUID(), [unit(repeatedText, repeatedText, 1, rep)],
    [bundle(rep, { references: [resolved(repeatedText, 'أحمد', two, true, 1), resolved(repeatedText, 'أحمد', two, false, 2)] })]);
  assert.equal(both.length, 1);
  const repeated = await rows('SELECT reference_index, anchor_occurrence, span_start FROM public.conversation_reference_resolutions WHERE cu_id=$1 ORDER BY reference_index', [rep]);
  assert.deepEqual(repeated.map((r) => [r.anchor_occurrence, r.span_start]),
    [[1, spanOf(repeatedText, 'أحمد', 1).start], [2, spanOf(repeatedText, 'أحمد', 2).start]],
    'occurrences 1 and 2 map to their distinct exact spans');
  assert.notEqual(repeated[0].span_start, repeated[1].span_start);
  // Cardinality.
  id = fresh();
  await rejected(() => attempt([bundle(id, { references: [ambiguous(U2, 'أحمد', [fresh()])] })]), 'UNKNOWN_REFERENCE_HANDLE');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [ambiguous(A1, 'أحمد', [teamAhmed])] })]), 'INVALID_REFERENCE_CARDINALITY');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [ambiguous(A1, 'أحمد', [teamAhmed, teamAhmed])] })]), 'INVALID_REFERENCE_CARDINALITY');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...unresolved(A1, 'أحمد'), resolved_handle_id: teamAhmed }] })]), 'INVALID_REFERENCE_CARDINALITY');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...unresolved(A1, 'أحمد'), candidate_handle_ids: [teamAhmed, cousinAhmed] }] })]), 'INVALID_REFERENCE_CARDINALITY');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...resolved(A1, 'أحمد', teamAhmed, false), candidate_handle_ids: [cousinAhmed] }] })]), 'INVALID_REFERENCE_CARDINALITY');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...resolved(A1, 'أحمد', null, true) }] })]), 'INVALID_REFERENCE_CARDINALITY');
  // A new handle cannot claim first grounding by a different CU: the id already exists.
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [resolved(A1, 'أحمد', teamAhmed, true)] })]), 'REFERENCE_HANDLE_ALREADY_GROUNDED');
  // A prepared identity never crosses the boundary.
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [resolved(A1, 'أحمد', 'prepared:reference:x:0', false)] })]), 'UNKNOWN_REFERENCE_HANDLE');
  // A reference with a widened or narrowed shape is refused.
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...resolved(A1, 'أحمد', teamAhmed, false), score: 0.9 }] })]), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)],
    [bundle(id, { references: [{ ...resolved(A1, 'أحمد', teamAhmed, false), reference_index: 5 }] })]), 'INVALID_FOCUS_PAYLOAD');
  return { twins, twinTurns, teamAhmed, cousinAhmed, teamCu, rejectionSession, rejectionTurns };
}

// ------------------------------------------------------------ claim attribution
async function verifyClaimAttribution(owner, populated, twinsInfo) {
  stage = 'D. claim attribution';
  const { session, scenario: s } = populated;
  const [stored] = await rows('SELECT * FROM public.conversation_claim_attributions WHERE cu_id=$1', [s.ids.u2]);
  assert.deepEqual([stored.claimant_kind, stored.claimant_handle_id, stored.claim_frame, stored.anchor_text],
    ['REFERENCE_HANDLE', s.handles.ahmed, 'REPORTED_SPEECH', 'إن الموضوع ده عادي'],
    'the same-CU new reference is the canonical claimant through its newly created stable handle');
  // The conversational speaker is DB-derived on the CU row; no payload key can carry one.
  const [cu] = await rows('SELECT source_role, speaker_state FROM public.conversation_units WHERE id=$1', [s.ids.u2]);
  assert.deepEqual(cu, { source_role: 'USER', speaker_state: 'RESOLVED' });
  const { twins, twinTurns, teamAhmed } = twinsInfo;
  const attempt = (overrides, id = randomUUID()) =>
    commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, id)], [bundle(id, overrides)]);
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'CURRENT_CONVERSATIONAL_SPEAKER', teamAhmed, 'DIRECT_ASSERTION')] }), 'INVALID_CLAIM_ATTRIBUTION');
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'UNRESOLVED', teamAhmed, 'DIRECT_QUOTATION')] }), 'INVALID_CLAIM_ATTRIBUTION');
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'REFERENCE_HANDLE', null, 'REPORTED_SPEECH')] }), 'INVALID_CLAIM_ATTRIBUTION');
  // The prepared-only pointer is unrepresentable in the durable schema.
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'NEW_CURRENT_CU_REFERENCE', null, 'REPORTED_SPEECH')] }), 'INVALID_CLAIM_ATTRIBUTION');
  await rejected(() => attempt({ claim_attributions: [{ ...claim(A1, 'أحمد بيتجنبك', 'UNRESOLVED', null, 'REPORTED_SPEECH'), referenceIndex: 0 }] }), 'INVALID_CLAIM_ATTRIBUTION');
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'REFERENCE_HANDLE', teamAhmed, 'HEARSAY')] }), 'INVALID_CLAIM_ATTRIBUTION');
  // A claimant handle must belong to the same Session.
  await rejected(() => attempt({ claim_attributions: [claim(A1, 'أحمد بيتجنبك', 'REFERENCE_HANDLE', s.handles.ahmed, 'REPORTED_SPEECH')] }), 'UNKNOWN_REFERENCE_HANDLE');
  await rejected(() => attempt({ claim_attributions: [{ ...claim(A1, 'أحمد بيتجنبك', 'UNRESOLVED', null, 'REPORTED_SPEECH'), anchor_text: 'أحمد بيتجنب' }] }), 'NON_EXTRACTIVE_REFERENCE');
  // A bundle with a smuggled speaker key is refused by shape.
  await rejected(() => commitWithFocus(twins, owner, twinTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, 'ffffffff-ffff-4fff-8fff-ffffffffffff')],
    [{ ...bundle('ffffffff-ffff-4fff-8fff-ffffffffffff'), speaker: 'ASSISTANT' }]), 'INVALID_FOCUS_PAYLOAD');
  // Accepted, on a fresh source turn: an UNRESOLVED quoted claimant beside a
  // claimant that is a handle first grounded by this very CU.
  const { rejectionSession, rejectionTurns } = twinsInfo;
  const accepted = randomUUID();
  const sami = randomUUID();
  const stored2 = await commitWithFocus(rejectionSession, owner, rejectionTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, accepted)], [
    bundle(accepted, {
      references: [resolved(U2, 'أحمد', sami, true)],
      claim_attributions: [
        claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', sami, 'REPORTED_SPEECH'),
        claim(U2, 'عادي', 'UNRESOLVED', null, 'DIRECT_QUOTATION'),
      ],
    })]);
  assert.equal(stored2.length, 1);
  const claims = await rows('SELECT attribution_index, claimant_kind, claimant_handle_id, claim_frame FROM public.conversation_claim_attributions WHERE cu_id=$1 ORDER BY attribution_index', [accepted]);
  assert.deepEqual(claims.map((c) => [c.attribution_index, c.claimant_kind, c.claimant_handle_id, c.claim_frame]),
    [[0, 'REFERENCE_HANDLE', sami, 'REPORTED_SPEECH'], [1, 'UNRESOLVED', null, 'DIRECT_QUOTATION']],
    'a same-CU new reference is a canonical claimant, and an unresolved claimant stays unresolved');
}

// ------------------------------------------------------- Emerging Focus continuity
async function verifyEmergingFocus(owner, populated, twinsInfo) {
  stage = 'E. Emerging Focus continuity';
  const { session, turns, scenario: s } = populated;
  const focuses = await rows('SELECT * FROM public.conversation_emerging_focuses WHERE session_id=$1 ORDER BY started_sp', [session]);
  assert.deepEqual(focuses.map((f) => [f.id, f.grounding_handle_id, f.started_cu_id, f.started_sp, Number(f.started_event_sequence)]),
    [[s.focuses.manager, s.handles.manager, s.ids.u1, 1, 1], [s.focuses.ahmed, s.handles.ahmed, s.ids.u3, 3, 1]],
    'START created exactly one stable focus per grounded identity, at its (SP, sequence)');
  const [incidental] = await rows('SELECT attention_kind, emerging_focus_id FROM public.conversation_emerging_focus_attention_events WHERE cu_id=$1', [s.ids.u2]);
  assert.deepEqual(incidental, { attention_kind: 'NO_INDEPENDENT_FOCUS', emerging_focus_id: null },
    'the incidental Ahmed Mention created a handle but no Emerging Focus (THR-01)');
  const attends = await rows('SELECT cu_id, emerging_focus_id, grounding_reference_index FROM public.conversation_emerging_focus_attention_events WHERE session_id=$1 AND attention_kind=$2 ORDER BY session_position', [session, 'ATTEND_EXISTING_FOCUS']);
  assert.deepEqual(attends.map((a) => [a.cu_id, a.emerging_focus_id, a.grounding_reference_index]),
    [[s.ids.a1, s.focuses.ahmed, 0], [s.ids.a2, s.focuses.ahmed, null]],
    'ATTEND reuses the same focus id: once through a resolved link, once as a local continuation');
  assert.equal(focuses.length, 2, 'attending created no focus');

  const { twins, twinTurns, teamAhmed, cousinAhmed } = twinsInfo;
  const attempt = (overrides, id = randomUUID(), content = ASSISTANT_TEXT, excerpt = A1, turn = twinTurns.assistantTurn) =>
    commitWithFocus(twins, owner, turn, randomUUID(), [unit(content, excerpt, 1, id)], [bundle(id, overrides)]);
  // START needs same-CU RESOLVED grounding.
  await rejected(() => attempt({ references: [ambiguous(A1, 'أحمد', [teamAhmed, cousinAhmed])], attention: startFocus(randomUUID(), 0) }), 'FOCUS_GROUNDING_REQUIRED');
  await rejected(() => attempt({ references: [unresolved(A1, 'أحمد')], attention: startFocus(randomUUID(), 0) }), 'FOCUS_GROUNDING_REQUIRED');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: { ...startFocus(randomUUID(), 0), grounding_reference_index: null } }), 'FOCUS_GROUNDING_REQUIRED');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: startFocus(randomUUID(), 3) }), 'FOCUS_GROUNDING_REQUIRED');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: { ...startFocus(randomUUID(), 0), creates_focus: false } }), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: { ...startFocus(randomUUID(), 0), reason: 'INCIDENTAL_OR_SUBORDINATE' } }), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => attempt({ attention: { ...NO_FOCUS, emerging_focus_id: randomUUID() } }), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => attempt({ attention: { kind: 'MAYBE_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } }), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => attempt({ attention: { ...NO_FOCUS, score: 0.9 } }), 'INVALID_FOCUS_PAYLOAD');
  // A prepared focus id never crosses the boundary; a cross-Session focus is unknown.
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: attendFocus('prepared:focus:x', 0) }), 'UNKNOWN_FOCUS_CANDIDATE');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: attendFocus(s.focuses.ahmed, 0) }), 'UNKNOWN_FOCUS_CANDIDATE');
  await rejected(() => attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: attendFocus(randomUUID(), 0) }), 'UNKNOWN_FOCUS_CANDIDATE');

  // A handle that existed only as a Mention may later START one focus - and
  // only one: a second START on the same identity is refused, typed and
  // structurally.
  const teamFocus = randomUUID();
  const started = randomUUID();
  await attempt({ references: [resolved(A1, 'أحمد', teamAhmed, false)], attention: startFocus(teamFocus, 0) }, started);
  const [teamFocusRow] = await rows('SELECT grounding_handle_id, started_cu_id FROM public.conversation_emerging_focuses WHERE id=$1', [teamFocus]);
  assert.deepEqual(teamFocusRow, { grounding_handle_id: teamAhmed, started_cu_id: started }, 'the Mention-only handle started exactly one focus');
  await rejected(() => attempt({ references: [resolved(A2, 'ده', teamAhmed, false)], attention: startFocus(randomUUID(), 0) }, randomUUID(), ASSISTANT_TEXT, A2), 'EXISTING_FOCUS_CONTINUITY_REQUIRED');
  await rejected(() => q(
    'INSERT INTO public.conversation_emerging_focuses(id,user_id,session_id,grounding_handle_id,started_cu_id,started_sp,started_event_sequence) '
    + 'SELECT $1, f.user_id, f.session_id, f.grounding_handle_id, f.started_cu_id, f.started_sp, f.started_event_sequence FROM public.conversation_emerging_focuses f WHERE f.id=$2',
    [randomUUID(), teamFocus]), 'emerging_focuses_grounding_unique', ['23505']);
  await rejected(() => attempt({ references: [resolved(A2, 'ده', teamAhmed, false)], attention: startFocus(teamFocus, 0) }, randomUUID(), ASSISTANT_TEXT, A2), 'EMERGING_FOCUS_ALREADY_EXISTS');
  // ATTEND with a link to a different handle than the focus grounding, or an
  // identity-free continuation that is not clean.
  await rejected(() => attempt({ references: [resolved(A2, 'ده', cousinAhmed, false)], attention: attendFocus(teamFocus, 0) }, randomUUID(), ASSISTANT_TEXT, A2), 'UNGROUNDED_FOCUS_CONTINUITY');
  await rejected(() => attempt({ references: [ambiguous(A2, 'ده', [teamAhmed, cousinAhmed])], attention: attendFocus(teamFocus, null) }, randomUUID(), ASSISTANT_TEXT, A2), 'UNGROUNDED_FOCUS_CONTINUITY');
  const cousinFocus = randomUUID();
  await attempt({ references: [resolved(A2, 'ده', cousinAhmed, false)], attention: startFocus(cousinFocus, 0) }, randomUUID(), ASSISTANT_TEXT, A2);
  // teamFocus is no longer the current focus, so a clean local continuation of it is ungrounded...
  const twinsSecond = await completedTurns(owner, twins, USER_TEXT, ASSISTANT_TEXT);
  await rejected(() => attempt({ functions: ['CLARIFY'], attention: attendFocus(teamFocus, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }, randomUUID(), USER_TEXT, U1, twinsSecond.userTurn), 'UNGROUNDED_FOCUS_CONTINUITY');
  // ...while the current one may be continued locally, and the team focus through a resolved link.
  const local = randomUUID();
  await commitWithFocus(twins, owner, twinsSecond.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, local)],
    [bundle(local, { functions: ['CLARIFY'], attention: attendFocus(cousinFocus, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') })]);
  const linked = randomUUID();
  await commitWithFocus(twins, owner, twinsSecond.userTurn, randomUUID(), [unit(USER_TEXT, U3, 1, linked)],
    [bundle(linked, { references: [resolved(U3, 'أحمد', teamAhmed, false)], attention: attendFocus(teamFocus, 0) })]);
  // A relationship reframing is a distinct focus beside the person focus.
  const relationshipSession = await newSession(owner);
  const relationshipText = 'أحمد بقى بيقلقني. علاقتي بأحمد بقت مرهقة.';
  const relationshipTurns = await completedTurns(owner, relationshipSession, relationshipText, ASSISTANT_TEXT);
  const R1 = 'أحمد بقى بيقلقني.';
  const R2 = 'علاقتي بأحمد بقت مرهقة.';
  const [r1, r2] = [randomUUID(), randomUUID()];
  const [ahmed, relationship] = [randomUUID(), randomUUID()];
  const [ahmedFocus, relationshipFocus] = [randomUUID(), randomUUID()];
  await commitWithFocus(relationshipSession, owner, relationshipTurns.userTurn, randomUUID(),
    [unit(relationshipText, R1, 1, r1), unit(relationshipText, R2, 1, r2)], [
      bundle(r1, { references: [resolved(R1, 'أحمد', ahmed, true)], attention: startFocus(ahmedFocus, 0) }),
      bundle(r2, { references: [resolved(R2, 'أحمد', ahmed, false), resolved(R2, 'علاقتي بأحمد', relationship, true)], attention: startFocus(relationshipFocus, 1) }),
    ]);
  const relationshipFocuses = await rows('SELECT id, grounding_handle_id FROM public.conversation_emerging_focuses WHERE session_id=$1 ORDER BY started_sp', [relationshipSession]);
  assert.deepEqual(relationshipFocuses.map((f) => [f.id, f.grounding_handle_id]), [[ahmedFocus, ahmed], [relationshipFocus, relationship]],
    'the relationship focus is distinct because it is grounded by its own newly canonical handle');
  // No mutable status/home/thread/LF mutation path exists: every table refuses UPDATE and DELETE, owner included.
  for (const [table, key] of [['conversation_emerging_focuses', 'id'], ['conversation_reference_handles', 'id'],
    ['conversation_unit_focus_semantics', 'cu_id'], ['conversation_emerging_focus_attention_events', 'cu_id'],
    ['conversation_reference_resolutions', 'cu_id'], ['conversation_claim_attributions', 'cu_id'],
    ['conversation_reference_resolution_candidates', 'cu_id'], ['conversation_focus_commit_batches', 'session_id']]) {
    await rejected(() => q(`UPDATE public.${table} SET user_id=user_id WHERE ${key} IS NOT NULL`), 'CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE', ['55000']);
    await rejected(() => q(`DELETE FROM public.${table} WHERE ${key} IS NOT NULL`), 'CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE', ['55000']);
  }
  assert.ok(turns);
}

// -------------------------------------------------- sequence / target semantics
async function verifySequenceAndTarget(owner, populated) {
  stage = 'F. sequence / target semantics';
  const { session, scenario: s } = populated;
  const semantics = await rows('SELECT cu_id, functions, sequence_position, target_cu_id FROM public.conversation_unit_focus_semantics WHERE session_id=$1 ORDER BY session_position', [session]);
  assert.deepEqual(semantics.map((r) => [r.functions, r.sequence_position, r.target_cu_id]), [
    [['INFORM_REPORT'], 'INITIATING', null],
    [['INFORM_REPORT'], 'FOLLOW_UP', s.ids.u1],
    [['INFORM_REPORT', 'FOCUS_SHIFT'], 'FOLLOW_UP', s.ids.u2],
    [['ASK'], 'RESPONSIVE', s.ids.u3],
    [['ASK'], 'FOLLOW_UP', s.ids.u3],
  ], 'one CU holds several frozen functions without duplication, and prior same-Session targets are stored');

  const other = await newSession(owner);
  const otherTurns = await completedTurns(owner, other);
  const attempt = (overrides, id = randomUUID()) =>
    commitWithFocus(other, owner, otherTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, id)], [bundle(id, overrides)]);
  await rejected(() => attempt({ functions: ['GREET'] }), 'INVALID_FOCUS_FUNCTION');
  await rejected(() => attempt({ functions: ['FUNCTION_UNRESOLVED', 'ASK'] }), 'INVALID_FOCUS_FUNCTION');
  await rejected(() => attempt({ functions: ['ASK', 'ASK'] }), 'INVALID_FOCUS_FUNCTION');
  await rejected(() => attempt({ functions: [] }), 'INVALID_FOCUS_FUNCTION');
  await rejected(() => attempt({ functions: 'ASK' }), 'INVALID_FOCUS_PAYLOAD');
  await rejected(() => attempt({ sequence_position: 'OPENING' }), 'INVALID_FOCUS_PAYLOAD');
  const current = randomUUID();
  await rejected(() => attempt({ sequence_position: 'RESPONSIVE', target_cu_id: current }, current), 'UNKNOWN_TARGET_CU');
  await rejected(() => attempt({ sequence_position: 'RESPONSIVE', target_cu_id: randomUUID() }), 'UNKNOWN_TARGET_CU');
  await rejected(() => attempt({ sequence_position: 'RESPONSIVE', target_cu_id: s.ids.u1 }), 'UNKNOWN_TARGET_CU');
  const accepted = await attempt({ functions: ['FUNCTION_UNRESOLVED'] });
  assert.equal(accepted.length, 1, 'FUNCTION_UNRESOLVED stands alone and is accepted');
  await rejected(() => commitWithFocus(other, owner, otherTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, current)],
    [bundle(current, { sequence_position: 'INITIATING', target_cu_id: accepted[0].id })]), 'INVALID_FOCUS_PAYLOAD');
  const bound = await commitWithFocus(other, owner, otherTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, current)],
    [bundle(current, { sequence_position: 'RESPONSIVE', target_cu_id: accepted[0].id })]);
  assert.equal(bound[0].session_position, 2, 'a prior same-Session target is accepted');
}

// ------------------------------------------------------------- replay / atomicity
async function verifyReplayAndAtomicity(owner, populated) {
  stage = 'G. replay / atomicity';
  const { session, turns, scenario: s } = populated;
  const [userBatch, assistantBatch] = await Promise.all([
    rows('SELECT commit_batch_id FROM public.conversation_unit_commit_events WHERE session_id=$1 AND first_sp=1', [session]),
    rows('SELECT commit_batch_id FROM public.conversation_unit_commit_events WHERE session_id=$1 AND first_sp=4', [session]),
  ]).then(([u, a]) => [u[0].commit_batch_id, a[0].commit_batch_id]);
  const before = await semanticSnapshot(session);
  // Exact replay: zero mutation, including the same-SP sequence, with ANY token.
  const [replayed] = await exchangeWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, s.userBundles,
    turns.assistantTurn, assistantBatch, s.assistantUnits, s.assistantBundles, { sp: 99, seq: 99 });
  assert.equal(replayed.live_head, 5);
  assert.deepEqual(replayed.user_units.map((r) => r.session_position), [1, 2, 3]);
  assert.deepEqual(await semanticSnapshot(session), before, 'the exact replay performed zero mutation across every semantic table and the clock');
  const [single] = await commitWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, s.userBundles);
  assert.equal(single.session_position, 1);
  assert.deepEqual(await semanticSnapshot(session), before, 'the single-batch replay performed zero mutation');
  // Payload / provenance conflicts on the same batch id.
  const changedAttention = s.userBundles.map((b, i) => (i === 1 ? { ...b, attention: { ...NO_FOCUS, reason: 'UNRESOLVED_ATTENTION' } } : b));
  await rejected(() => commitWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, changedAttention), 'FOCUS_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commitWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, s.userBundles, PROVENANCE,
    ['conversational-focus-evaluator-v2', ...FOCUS_PROVENANCE.slice(1)]), 'FOCUS_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commitWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, s.userBundles, PROVENANCE,
    [...FOCUS_PROVENANCE.slice(0, 5), 2]), 'FOCUS_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commitWithFocus(session, owner, turns.userTurn, userBatch, [s.userUnits[0]], [s.userBundles[0]]), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commitWithFocus(session, owner, turns.userTurn, userBatch, s.userUnits, s.userBundles, ['other-evaluator', ...PROVENANCE.slice(1)]), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  assert.deepEqual(await semanticSnapshot(session), before, 'conflicting replays performed zero mutation');

  // An ASSISTANT semantic failure rolls the whole exchange back, USER CUs and
  // USER semantics included.
  const rollback = await newSession(owner);
  const rollbackTurns = await completedTurns(owner, rollback);
  const r = scenario();
  const broken = r.assistantBundles.map((b, i) => (i === 1 ? { ...b, functions: ['GREET'] } : b));
  await rejected(() => exchangeWithFocus(rollback, owner, rollbackTurns.userTurn, randomUUID(), r.userUnits, r.userBundles,
    rollbackTurns.assistantTurn, randomUUID(), r.assistantUnits, broken, FRESH_TOKEN), 'INVALID_FOCUS_FUNCTION');
  assert.equal((await clockOf(rollback)).current_sp, null, 'the failed exchange allocated no Session Position');
  for (const table of [...FOCUS_TABLES, 'conversation_units', 'conversation_unit_commit_events']) {
    const [{ count }] = await rows(`SELECT count(*) count FROM public.${table} WHERE session_id=$1`, [rollback]);
    assert.equal(Number(count), 0, `${table}: the USER block rolled back with the ASSISTANT block`);
  }
  // Zero-CU batch: complete, mutates neither clock coordinate, no rows.
  const zero = await newSession(owner);
  const zeroTurns = await completedTurns(owner, zero);
  const zeroBatch = randomUUID();
  assert.deepEqual(await commitWithFocus(zero, owner, zeroTurns.userTurn, zeroBatch, [], []), [], 'a zero-CU batch commits no unit');
  assert.deepEqual(await clockOf(zero), { session_id: zero, user_id: owner, current_sp: null, same_sp_event_sequence: '0' });
  const [zeroRow] = await rows('SELECT unit_count FROM public.conversation_focus_commit_batches WHERE commit_batch_id=$1', [zeroBatch]);
  assert.equal(zeroRow.unit_count, 0, 'the zero-unit semantic batch is recorded for exact replay completeness');
  assert.deepEqual(await commitWithFocus(zero, owner, zeroTurns.userTurn, zeroBatch, [], []), [], 'and replays with zero mutation');
  assert.deepEqual(await clockOf(zero), { session_id: zero, user_id: owner, current_sp: null, same_sp_event_sequence: '0' });
  await rejected(() => commitWithFocus(zero, owner, zeroTurns.userTurn, randomUUID(), [], [bundle(randomUUID())]), 'FOCUS_UNIT_MAPPING_MISMATCH');
  const swapped = scenario();
  await rejected(() => commitWithFocus(zero, owner, zeroTurns.userTurn, randomUUID(), swapped.userUnits, [swapped.userBundles[1], swapped.userBundles[0], swapped.userBundles[2]]), 'FOCUS_UNIT_MAPPING_MISMATCH');
  await rejected(() => commitWithFocus(zero, owner, zeroTurns.userTurn, randomUUID(), swapped.userUnits, swapped.userBundles.slice(0, 2)), 'FOCUS_UNIT_MAPPING_MISMATCH');
  // Both halves zero: LH stays null.
  const [bothZero] = await exchangeWithFocus(zero, owner, zeroTurns.userTurn, randomUUID(), [], [], zeroTurns.assistantTurn, randomUUID(), [], [], FRESH_TOKEN);
  assert.equal(bothZero.live_head, null, 'LH is null, never 0, when nothing was committed');
  assert.equal(Number(bothZero.same_sp_event_sequence), 0);
  assert.deepEqual([bothZero.user_event, bothZero.assistant_event], [null, null]);
  // Partial semantic state: a batch written by the LEGACY producer has CUs
  // but no semantics; the integrated writer refuses to repair it.
  const partial = await newSession(owner);
  const partialTurns = await completedTurns(owner, partial);
  const legacyBatch = randomUUID();
  const legacyUnit = randomUUID();
  await legacyCommit(partial, owner, partialTurns.userTurn, legacyBatch, [unit(USER_TEXT, U1, 1, legacyUnit)]);
  await rejected(() => commitWithFocus(partial, owner, partialTurns.userTurn, legacyBatch, [unit(USER_TEXT, U1, 1, legacyUnit)], [bundle(legacyUnit)]),
    'FOCUS_SEMANTIC_BATCH_INTEGRITY', ['55000']);
  const [{ count: partialSemantics }] = await rows('SELECT count(*) count FROM public.conversation_unit_focus_semantics WHERE session_id=$1', [partial]);
  assert.equal(Number(partialSemantics), 0, "nothing was backfilled from today's inference");
  // Delivery events stay exactly one per non-zero batch.
  const events = await eventsOfSession(session);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => [e.first_sp, e.last_sp, e.unit_count]), [[1, 3, 3], [4, 5, 2]]);
}

// ------------------------------------------------------------- context snapshot
async function verifyContextSnapshot(owner, other, populated) {
  stage = 'H. context snapshot';
  const { session, scenario: s } = populated;
  const context = await contextOf(session, owner);
  assert.deepEqual([context.base_current_sp, Number(context.base_same_sp_event_sequence)], [5, 1], 'the exact clock token is returned');
  assert.deepEqual(context.prior_cus.map((c) => [c.session_position, c.cu_id, c.source_role, c.sequence_position, c.target_cu_id]), [
    [1, s.ids.u1, 'USER', 'INITIATING', null], [2, s.ids.u2, 'USER', 'FOLLOW_UP', s.ids.u1], [3, s.ids.u3, 'USER', 'FOLLOW_UP', s.ids.u2],
    [4, s.ids.a1, 'ASSISTANT', 'RESPONSIVE', s.ids.u3], [5, s.ids.a2, 'ASSISTANT', 'FOLLOW_UP', s.ids.u3],
  ], 'every prior CU is returned in SP order with its durable semantics');
  assert.deepEqual(context.prior_cus.map((c) => c.functions), [['INFORM_REPORT'], ['INFORM_REPORT'], ['INFORM_REPORT', 'FOCUS_SHIFT'], ['ASK'], ['ASK']]);
  assert.deepEqual(context.prior_cus.map((c) => c.committed_text), [U1, U2, U3, A1, A2], 'exact committed wording is returned');
  const priorIds = new Set(context.prior_cus.map((c) => c.cu_id));
  assert.deepEqual(context.reference_handles.map((h) => [h.handle_id, h.grounding.map((g) => [g.cu_id, g.exact_surface])]), [
    [s.handles.manager, [[s.ids.u1, 'المدير']]],
    [s.handles.ahmed, [[s.ids.u2, 'أحمد'], [s.ids.u3, 'أحمد'], [s.ids.a1, 'أحمد']]],
  ], 'handles carry their exact committed surface grounding');
  for (const h of context.reference_handles) for (const g of h.grounding) assert.ok(priorIds.has(g.cu_id), 'handle grounding is closed over prior CUs');
  assert.deepEqual(context.focus_candidates.map((f) => [f.focus_candidate_id, f.grounding_handle_ids, f.prior_grounding_cu_ids]), [
    [s.focuses.manager, [s.handles.manager], [s.ids.u1]],
    [s.focuses.ahmed, [s.handles.ahmed], [s.ids.u3, s.ids.a1, s.ids.a2]],
  ], 'focus candidates are keyed on the durable emerging_focus_id with their START/ATTEND history');
  for (const f of context.focus_candidates) for (const id of f.prior_grounding_cu_ids) assert.ok(priorIds.has(id), 'focus grounding is closed over prior CUs');
  assert.equal(context.current_focus_candidate_id, s.focuses.ahmed, 'the current focus is the latest START/ATTEND');
  // A later NO_INDEPENDENT_FOCUS neither mints nor clears the current focus.
  const laterTurns = await completedTurns(owner, session);
  const later = randomUUID();
  await commitWithFocus(session, owner, laterTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, later)],
    [bundle(later, { references: [resolved(U1, 'المدير', s.handles.manager, false)], attention: NO_FOCUS })]);
  const afterwards = await contextOf(session, owner);
  assert.equal(afterwards.current_focus_candidate_id, s.focuses.ahmed, 'NO_INDEPENDENT_FOCUS did not erase the continuity context');
  assert.equal(afterwards.focus_candidates.length, 2, 'NO_INDEPENDENT_FOCUS minted no focus');
  assert.deepEqual([afterwards.base_current_sp, Number(afterwards.base_same_sp_event_sequence)], [6, 1]);
  // Before the first SP the token is (NULL, 0) and everything is empty.
  const empty = await newSession(owner);
  const emptyContext = await contextOf(empty, owner);
  assert.deepEqual([emptyContext.base_current_sp, Number(emptyContext.base_same_sp_event_sequence), emptyContext.prior_cus, emptyContext.reference_handles, emptyContext.focus_candidates, emptyContext.current_focus_candidate_id],
    [null, 0, [], [], [], null]);
  // Cross-user / cross-Session reads fail closed.
  await rejected(() => contextOf(session, other), 'FORBIDDEN', ['42501']);
  await rejected(() => contextOf(randomUUID(), owner), 'FORBIDDEN', ['42501']);
}

// ------------------------------------------------------- application ACL gate
async function verifyRuntimeAcl(owner, populated) {
  stage = 'A. production-inert runtime ACL';
  const { session, turns } = populated;
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => commitWithFocus(session, owner, turns.userTurn, randomUUID(), [], []), 'permission denied', ['42501']);
    await rejected(() => exchangeWithFocus(session, owner, turns.userTurn, randomUUID(), [], [], turns.assistantTurn, randomUUID(), [], [], FRESH_TOKEN), 'permission denied', ['42501']);
    await rejected(() => contextOf(session, owner), 'permission denied', ['42501']);
    await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, owner]), 'permission denied', ['42501']);
    for (const table of FOCUS_TABLES) {
      await rejected(() => q(`SELECT count(*) FROM public.${table}`), 'permission denied', ['42501']);
    }
  }
  // service_role still runs the T-03A2 legacy producer: the activation is untouched.
  await identity('service_role');
  const legacy = await legacyCommit(session, owner, turns.assistantTurn, randomUUID(), []);
  assert.deepEqual(legacy, [], 'the T-03A2 producer remains executable by service_role');
  await identity('postgres');
}

// --------------------------------------------------------------- concurrency
async function verifyConcurrency() {
  stage = 'B. concurrency: serialization and the stale-token loser';
  const owner = randomUUID();
  const session = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const turnOne = randomUUID();
  const turnTwo = randomUUID();
  const assistantOne = randomUUID();
  const assistantTwo = randomUUID();
  const EXCHANGE = 'SELECT * FROM commit_finalized_exchange_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)';
  const args = (userTurn, assistantTurn, token) => {
    const s = scenario();
    return [session, owner, userTurn, randomUUID(), JSON.stringify(s.userUnits), JSON.stringify(s.userBundles),
      assistantTurn, randomUUID(), JSON.stringify(s.assistantUnits), JSON.stringify(s.assistantBundles),
      ...PROVENANCE, ...FOCUS_PROVENANCE, token.sp, token.seq];
  };
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
    for (const [id, role, content, source] of [[turnOne, 'USER', USER_TEXT, null], [assistantOne, 'ASSISTANT', ASSISTANT_TEXT, turnOne],
      [turnTwo, 'USER', USER_TEXT, null], [assistantTwo, 'ASSISTANT', ASSISTANT_TEXT, turnTwo]]) {
      await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id) VALUES($1,$2,$3,$4,'COMPLETED',$5,$6)",
        [id, session, owner, role, content, source]);
    }
    await clientA.connect(); await clientB.connect();

    // Both writers read the same fresh token (NULL, 0). A holds its
    // transaction open; B blocks on the Session clock instead of racing.
    await clientA.query('BEGIN');
    const held = await clientA.query(EXCHANGE, args(turnOne, assistantOne, FRESH_TOKEN));
    assert.equal(held.rows[0].live_head, 5, 'the first exchange allocated SP1..SP5 inside its open transaction');
    const pending = clientB.query(EXCHANGE, args(turnTwo, assistantTwo, FRESH_TOKEN));
    pending.catch(() => undefined);
    const raced = await Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    assert.equal(raced, 'BLOCKED', 'the concurrent semantic writer blocks on the Session Semantic Clock');
    await clientA.query('COMMIT');
    let stale;
    try { await pending; } catch (error) { stale = error; }
    assert.ok(stale, 'the losing writer did not silently write over an obsolete prior context');
    assert.equal(stale.code, '40001');
    assert.match(stale.message, /STALE_CONVERSATIONAL_FOCUS_CONTEXT/u);
    const [{ count: units }] = (await q('SELECT count(*) count FROM public.conversation_units WHERE session_id=$1', [session])).rows;
    assert.equal(Number(units), 5, 'the stale-token loser mutated nothing');
    const [{ count: batches }] = (await q('SELECT count(*) count FROM public.conversation_focus_commit_batches WHERE session_id=$1', [session])).rows;
    assert.equal(Number(batches), 2);
    const [clock] = (await q('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session])).rows;
    assert.deepEqual([clock.current_sp, Number(clock.same_sp_event_sequence)], [5, 1]);
    // With the fresh token re-read under the new head, the second exchange commits after the first.
    const second = await clientB.query(EXCHANGE, args(turnTwo, assistantTwo, { sp: 5, seq: 1 }));
    assert.equal(second.rows[0].live_head, 10);
    assert.deepEqual(second.rows[0].user_units.map((r) => r.session_position), [6, 7, 8]);
    const final = (await q('SELECT session_position FROM public.conversation_units WHERE session_id=$1 ORDER BY session_position', [session])).rows.map((r) => r.session_position);
    assert.deepEqual(final, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Session sequence is gapless and duplicate-free after the race');
    const sequences = (await q('SELECT same_sp_event_sequence s FROM public.conversation_unit_focus_semantics WHERE session_id=$1', [session])).rows.map((r) => Number(r.s));
    assert.deepEqual(sequences, Array(10).fill(1), 'every Moment carries its B1 semantics at sequence 1');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
    await q("SET session_replication_role = 'replica'").catch(() => undefined);
    for (const table of ['conversation_emerging_focus_attention_events', 'conversation_emerging_focuses', 'conversation_claim_attributions',
      'conversation_reference_resolution_candidates', 'conversation_reference_resolutions', 'conversation_reference_handles',
      'conversation_unit_focus_semantics', 'conversation_focus_commit_batches', 'conversation_unit_commit_events',
      'conversation_units', 'conversation_unit_commit_batches', 'session_semantic_clocks', 'conversation_turns']) {
      await q(`DELETE FROM public.${table} WHERE session_id=$1`, [session]).catch(() => undefined);
    }
    await q('DELETE FROM public.conversation_sessions WHERE id=$1', [session]).catch(() => undefined);
    await q('DELETE FROM public.users WHERE id=$1', [owner]).catch(() => undefined);
    await q('DELETE FROM auth.users WHERE id=$1', [owner]).catch(() => undefined);
    await q("SET session_replication_role = 'origin'").catch(() => undefined);
    const [{ count: residue }] = await rows('SELECT count(*) count FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
    assert.equal(Number(residue), 0, 'the concurrency proof left zero fixture residue');
  }
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
      const populated = await verifyPerMomentIntegrity(owner);
      const twinsInfo = await verifyReferenceSemantics(owner, populated);
      await verifyClaimAttribution(owner, populated, twinsInfo);
      await verifyEmergingFocus(owner, populated, twinsInfo);
      await verifySequenceAndTarget(owner, populated);
      await verifyReplayAndAtomicity(owner, populated);
      await verifyContextSnapshot(owner, other, populated);
      await verifyRuntimeAcl(owner, populated);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrency();
    console.log('Verified migration 0066: the per-Moment integrated writer allocates each SP, opens it as the head, reserves same-SP sequence 1 through the one T-03A2 seam and persists the whole reference / focus bundle before the next CU seals it; AF66-01 from the deployed bodies; stale-context protection under the clock lock with zero mutation; stable session-scoped reference handles and Emerging Focus identities with structural uniqueness per locus; frozen reference, claim, attention and function cardinalities revalidated by the database against exact code-point anchors; exact replay with zero mutation, payload and provenance conflicts, partial semantic state failing closed, the zero-CU batch; the authoritative context snapshot closed over prior CUs; the production-inert posture with untouched T-03A2 grants; and zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Durable reference / Emerging Focus substrate verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
