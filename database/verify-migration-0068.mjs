// Real-PostgreSQL verifier for migration 0068 - Durable Thread + Permanent
// Home + Same-SP DB Substrate v1.
//
// Proves against live semantics, never grep alone: the per-Moment integrated
// transaction (SP born, head opened, B1 at same-SP sequence 1, the optional
// whole B2 event at sequence 2, only then the next CU); AF66-01 and the
// Session-clock-before-world-lock order from the deployed bodies; QANDEEL
// OSDAP v1 cross-language parity against the seven frozen T-03B2b1 golden
// vectors plus negative floor division, the projection boundary, dense shell
// escalation, the exact minimum separation, the technical bound skip and
// capacity exhaustion; user/world-scoped canonical Thread identity and the
// immutable EmergingFocus -> Thread lineage; exactly one permanent Home per
// Thread with no relocation path; Conversational Origin persisted as symmetric
// provenance with no parent; the deterministic TE-01 / TE-02 / TE-03 gates and
// the three NO_ESTABLISHMENT states re-proved by the database; exact replay,
// payload conflict, partial / legacy state failing closed, the zero-CU batch,
// atomic rollback with no consumed sequence; and the production-inert posture
// with untouched T-03A2 authority. Every fixture is rolled back or removed.
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
}

// --------------------------------------------------------------- signatures
const WRITER = 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
const COORDINATOR = 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
const VALIDATOR = 'public.validate_conversation_thread_decision_v1(public.conversation_units,jsonb)';
const PERSIST = 'public.persist_conversation_thread_establishment_v1(public.conversation_units,uuid,jsonb,bigint,numeric,numeric,integer,numeric,numeric,bytea,bytea)';
const PLACEMENT = 'public.compute_canonical_home_placement_v1(text,text,text,text[],text[],numeric[],numeric[])';
const SEARCH = 'public.osdap_search_admissible_placement_v1(text,text,bytea,bytea,numeric,numeric,numeric[],numeric[])';
const FOCUS_WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const FOCUS_COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
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

// ------------------------------------------------- canonical identity vectors
// The exact derivation of apps/api/src/thread-establishment/durable-thread-canonicalizer.ts.
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
const HOME_ANCHOR_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1');
const THREAD_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const homeAnchorIdOf = (threadId) => uuidV5(HOME_ANCHOR_NAMESPACE, threadId);
const eventIdOf = (threadId) => uuidV5(THREAD_EVENT_NAMESPACE, threadId);

// ------------------------------------------------------- the shared scenario
// The Egyptian-Arabic fixture of T-03B1b1, extended by Thread establishment.
// USER: the manager (CU1, a new focus, explicitly selected), an incidental
// Ahmed mention inside a reported claim (CU2, Mention only), then Ahmed as a
// direct concern (CU3, a new focus explicitly selected, with the manager
// Thread as its Conversational Origin). ASSISTANT: two CUs that attend the
// already-established Ahmed focus.
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

/** A canonical NO_ESTABLISHMENT decision: the same twelve keys, all empty. */
const noEstablishment = (unitId, reason, focusId = null) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: reason,
  emerging_focus_id: focusId, path: null, thread_id: null, home_anchor_id: null,
  thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});

/** A canonical ESTABLISH_THREAD decision with server-derived identities. */
const establish = (userId, unitId, focusId, path, evidenceCuIds, overrides = {}) => {
  const threadId = overrides.thread_id ?? threadIdOf(userId, focusId);
  return {
    unit_id: unitId,
    decision: 'ESTABLISH_THREAD',
    no_establishment_reason: null,
    emerging_focus_id: focusId,
    path,
    thread_id: threadId,
    home_anchor_id: overrides.home_anchor_id ?? homeAnchorIdOf(threadIdOf(userId, focusId)),
    thread_established_event_id: overrides.thread_established_event_id ?? eventIdOf(threadIdOf(userId, focusId)),
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

const commit = (session, user, turn, batch, units, bundles, threads) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE, JSON.stringify(threads), ...THREAD_PROVENANCE]);

const clockOf = async (session) =>
  (await rows('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];

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

const FRESH_TOKEN = { sp: null, seq: 0 };

/** Every canonical Thread row of a world, for zero-mutation and immutability proofs. */
async function worldSnapshot(owner) {
  const snapshot = {};
  for (const table of ['conversation_threads', 'conversation_thread_homes', 'conversation_thread_establishment_events']) {
    snapshot[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t WHERE t.user_id=$1 ORDER BY to_jsonb(t)::text`, [owner])).map((r) => r.row);
  }
  snapshot.evidence = (await rows('SELECT to_jsonb(e) row FROM public.conversation_thread_establishment_evidence e WHERE e.user_id=$1 ORDER BY to_jsonb(e)::text', [owner])).map((r) => r.row);
  snapshot.origins = (await rows(`SELECT to_jsonb(m) row FROM public.conversation_thread_origin_members m
      JOIN public.conversation_threads t ON t.id = m.thread_id WHERE t.user_id=$1 ORDER BY to_jsonb(m)::text`, [owner])).map((r) => r.row);
  return snapshot;
}

// ============================================================== A. static gate
async function verifyStaticAuthority() {
  stage = 'A. schema / privileges / append-only';
  for (const [signature, label] of [[WRITER, 'integrated writer'], [COORDINATOR, 'exchange coordinator'],
    [VALIDATOR, 'decision validator'], [PERSIST, 'establishment persistence helper'],
    [PLACEMENT, 'canonical placement engine'], [SEARCH, 'admissible placement search']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid = to_regprocedure($1)',
      [signature]);
    strict(contract.owner, 'postgres', `${label} is postgres-owned`);
    strict(contract.definer, true, `${label} is SECURITY DEFINER`);
    ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${label} has a fixed empty search path`);
  }
  for (const table of THREAD_TABLES) {
    const [presence] = await rows('SELECT to_regclass($1) IS NOT NULL present', [`public.${table}`]);
    strict(presence.present, true, `${table} exists`);
    const [posture] = await rows(
      "SELECT pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls FROM pg_class c WHERE c.oid = to_regclass($1)", [`public.${table}`]);
    strict(posture.owner, 'postgres', `${table} is postgres-owned`);
    strict(posture.rls, true, `${table} has row level security enabled`);
    const [trigger] = await rows(
      `SELECT count(*)::int total FROM pg_trigger t WHERE t.tgrelid = to_regclass($1) AND NOT t.tgisinternal
         AND t.tgfoid = 'public.reject_conversation_thread_mutation_v1'::regproc`, [`public.${table}`]);
    strict(trigger.total, 1, `${table} carries the append-only trigger`);
  }
  // Nothing was backfilled by the migration.
  for (const table of THREAD_TABLES) {
    const [{ total }] = await rows(`SELECT count(*)::int total FROM public.${table}`);
    strict(total, 0, `${table} is empty: 0068 backfills nothing`);
  }

  // AF66-01 plus the world-lock order, read from the DEPLOYED writer body.
  const [{ definition: writer }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [WRITER]);
  const clockLock = writer.indexOf('FROM public.session_semantic_clocks c');
  const turnLock = writer.indexOf('FROM public.conversation_turns t');
  const cuInsert = writer.indexOf('INSERT INTO public.conversation_units (');
  const headAdvance = writer.indexOf('SET current_sp = this_sp, same_sp_event_sequence = 0');
  const focusPersist = writer.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const threadGate = writer.indexOf('validate_conversation_thread_decision_v1(');
  const worldLock = writer.indexOf('FROM public.conversation_world_spatial_authorities w');
  const placement = writer.indexOf('compute_canonical_home_placement_v1(');
  const threadPersist = writer.indexOf('persist_conversation_thread_establishment_v1(');
  ok(clockLock > 0 && turnLock > clockLock, 'AF66-01: the writer locks the Session clock before the source turn');
  ok(writer.indexOf('FOR UPDATE', clockLock) < turnLock, 'the Session clock lock is FOR UPDATE and precedes the turn lock');
  ok(turnLock < cuInsert && cuInsert < headAdvance && headAdvance < focusPersist && focusPersist < threadGate,
    'per CU: insert with SP -> open the head -> B1 bundle -> B2 gate');
  ok(threadGate < worldLock && worldLock < placement && placement < threadPersist,
    'the user-world spatial authority is locked after the B1 semantic rows and before the placement and the Thread rows');
  ok(clockLock < worldLock, 'AF66-01: the world lock is NEVER taken before the Session Semantic Clock');
  strict((writer.match(/FROM public\.session_semantic_clocks c\s+WHERE c\.session_id = p_session_id AND c\.user_id = p_user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one Session clock is acquired by the writer');
  strict((writer.match(/FROM public\.conversation_world_spatial_authorities w\s+WHERE w\.user_id = turn_row\.user_id\s+FOR UPDATE/gu) ?? []).length, 1,
    'exactly one user-world spatial authority row is locked');
  strict((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 2,
    'the writer reserves through the ONE T-03A2 seam: once for B1, once for the whole B2 event');
  strict((writer.match(/same_sp_event_sequence = c\.same_sp_event_sequence \+ 1/gu) ?? []).length, 0,
    'the writer never increments the same-SP sequence itself');
  ok(/reserved_sequence IS DISTINCT FROM 1::bigint/u.test(writer), 'B1 must hold same-SP sequence 1');
  ok(/reserved_sequence IS DISTINCT FROM 2::bigint/u.test(writer), 'the whole B2 event must hold same-SP sequence 2');
  // No caller-authored coordinate reaches the writer or the coordinator.
  for (const signature of [WRITER, COORDINATOR]) {
    const [{ args }] = await rows("SELECT pg_get_function_arguments(to_regprocedure($1)) args", [signature]);
    ok(!/placement|coordinate|_x |_y |home_x|home_y|world_fingerprint|attempt/iu.test(args),
      'no caller supplies a permanent Home coordinate, base, attempt or fingerprint');
    ok(!/p_same_sp_event_sequence|p_session_position|p_sp\b/u.test(args), 'no caller supplies SP or the same-SP sequence');
  }
  const [{ definition: coordinator }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [COORDINATOR]);
  const cClock = coordinator.indexOf('FROM public.session_semantic_clocks c');
  const cUser = coordinator.indexOf('INTO user_turn_row');
  const cAssistant = coordinator.indexOf('INTO assistant_turn_row');
  const cRelation = coordinator.indexOf('INVALID_FINALIZED_EXCHANGE_RELATION');
  const cStale = coordinator.indexOf('STALE_CONVERSATIONAL_FOCUS_CONTEXT');
  const cWriter = coordinator.indexOf('commit_conversation_units_with_focus_and_thread_v1(');
  ok(cClock > 0 && cClock < cUser && cUser < cAssistant && cAssistant < cRelation && cRelation < cStale && cStale < cWriter,
    'clock lock -> USER row -> ASSISTANT row -> relation gate -> expected-token check -> semantic writes');
  ok(!/conversation_world_spatial_authorities/u.test(coordinator), 'the coordinator never touches the world authority itself');

  // Production-inert: no application role executes anything new, the T-03B1b1
  // writer and coordinator stay ungranted, and the T-03A2 grants are untouched.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [WRITER, COORDINATOR, VALIDATOR, PERSIST, PLACEMENT, SEARCH, FOCUS_WRITER, FOCUS_COORDINATOR, SAME_SP_HELPER]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} must not execute ${signature}`);
    }
    // T-03D (migration 0071) retired the temporary T-03A2 mutation grants; the
    // T-03A2 snapshot read stays live for service_role.
    for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} must not execute the retired temporal-only writer ${signature} (T-03D cutover)`);
    }
    for (const signature of [LEGACY_SNAPSHOT]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, role === 'service_role', `the T-03A2 grant on ${signature} is unchanged for ${role}`);
    }
    for (const table of THREAD_TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows("SELECT has_table_privilege($1::name,$2::text,$3::text) granted", [role, `public.${table}`, privilege]);
        strict(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
}

// =========================================================== B. OSDAP parity
const GOLDEN_USER_WORLD = '0f6a3c2e-9b1d-5c4a-8e7f-2d3b4a5c6d7e';
const GV01 = { id: 'thread-gv01', x: '534265', y: '944722' };
const GV02 = { id: 'thread-gv02', x: '-17692', y: '500000' };
const GV03 = { id: 'thread-gv03', x: '971542', y: '-36077' };
const GV04 = { id: 'thread-gv04', x: '1003065', y: '546434' };
const GV06_LEFT = { id: 'thread-gv06-left', x: '-7000001', y: '3' };
const GV06_RIGHT = { id: 'thread-gv06-right', x: '2', y: '-6000004' };
const GV07_CENTER = { id: 'thread-dense', x: '10000000', y: '10000000' };
function denseWorldAround(center) {
  const homes = [];
  for (let row = -3; row <= 3; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      if (row === 0 && column === 0) { homes.push(center); continue; }
      homes.push({
        id: `${center.id}-r${row + 3}c${column + 3}`,
        x: String(BigInt(center.x) + BigInt(column) * 400000n),
        y: String(BigInt(center.y) + BigInt(row) * 400000n),
      });
    }
  }
  return homes;
}
const GOLDEN_VECTORS = [
  { id: 'GV-01', thread: 'thread-gv01', origin: 'NONE', members: [], world: [],
    x: '534265', y: '944722', attempt: 0, baseX: '0', baseY: '0',
    worldFp: 'd4fc7423a008557724175d0b3847085affc44eeb1fafa5c14fb78d888ec7784a',
    originFp: '51cfd463b6af8a57b3380487f986abf10f137073e9be453e44a7e9a5b4c0e72b' },
  { id: 'GV-02', thread: 'thread-gv02', origin: 'NONE', members: [], world: [GV01],
    x: '-17692', y: '500000', attempt: 0, baseX: '0', baseY: '0',
    worldFp: 'b8ab1ed215d1ce8f6513a27edcecebddc17c035f4a8c763f1fb5ae12dab94ab4',
    originFp: '51cfd463b6af8a57b3380487f986abf10f137073e9be453e44a7e9a5b4c0e72b' },
  { id: 'GV-03', thread: 'thread-gv03', origin: 'RESOLVED', members: [GV01.id], world: [GV02, GV01],
    x: '971542', y: '-36077', attempt: 0, baseX: '534265', baseY: '944722',
    worldFp: 'd48be4f9dd1a713ef907842ccfdd1089dc9d90f8f1ac1386d08f56fbe52eea6e',
    originFp: '73476a608ca28fb1de88e607550191e8b00348bd704bcdbebdd43bc52234a0d0' },
  { id: 'GV-04', thread: 'thread-gv04', origin: 'MULTIPLE', members: [GV02.id, GV01.id], world: [GV01, GV02, GV03],
    x: '1003065', y: '546434', attempt: 0, baseX: '258286', baseY: '722361',
    worldFp: '85e5a1cd5ae02e8561d4bfaeb731350b86f0463e24cce79f98341069c3802d00',
    originFp: '60a8fedd57b29d2257abb441d71324504ed4134ceaf0c7222932624a867cf89e' },
  { id: 'GV-05', thread: 'thread-gv05', origin: 'AMBIGUOUS', members: [GV03.id, GV01.id, GV02.id], world: [GV04, GV03, GV02, GV01],
    x: '122652', y: '1288006', attempt: 0, baseX: '496038', baseY: '469548',
    worldFp: 'dfb5b7edd882aa283ea508a014bb808e4090547043d72942fd159ac4dd221c39',
    originFp: '106304a74372f8be2e457c68edfd12315069e633541f88ad8773b5950fd4ea45' },
  { id: 'GV-06', thread: 'thread-gv06', origin: 'MULTIPLE', members: [GV06_LEFT.id, GV06_RIGHT.id], world: [GV06_RIGHT, GV06_LEFT],
    x: '-2925237', y: '-2344050', attempt: 0, baseX: '-3500000', baseY: '-3000001',
    worldFp: '84ef894a741a419e4113433f22255e4427a5f88c0aefe3387e095b7b43d4c2ef',
    originFp: 'e0bad8f1b17881df07b53cedfe7468844953292b18e13cff6f4445380cb3db52' },
  { id: 'GV-07', thread: 'thread-gv07', origin: 'RESOLVED', members: [GV07_CENTER.id], world: denseWorldAround(GV07_CENTER),
    x: '8240675', y: '9920020', attempt: 34, baseX: '10000000', baseY: '10000000',
    worldFp: '80ae6e4841d5e8c9e194d381b47baa6f71619a20e45ce092d507848b999becdb',
    originFp: 'fac1eda456241d3fca0da7942002d95f7822b23061592488d445003eb59fcf0d' },
];

const placeCanonical = (userWorld, thread, originState, members, world) =>
  rows('SELECT * FROM compute_canonical_home_placement_v1($1,$2,$3,$4::text[],$5::text[],$6::numeric[],$7::numeric[])',
    [userWorld, thread, originState, members, world.map((h) => h.id), world.map((h) => h.x), world.map((h) => h.y)]);

async function verifyOsdapParity() {
  stage = 'B. QANDEEL OSDAP v1 cross-language parity';
  // The exact frozen constants are visible in the deployed bodies.
  const [{ definition: search }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [SEARCH]);
  for (const constant of ['-4611686018427387904', '4611686018427387903', '1000000', '250000', '32', '8192']) {
    ok(search.includes(constant), `the frozen constant ${constant} is present in the deployed search`);
  }
  const [{ definition: digest }] = await rows("SELECT pg_get_functiondef(to_regprocedure('public.osdap_attempt_digest_v1(text,text,bytea,bytea,integer)')) definition");
  ok(digest.includes("'qandeel-osdap-v1'"), 'the frozen digest domain is deployed');

  // Exact integer arithmetic: floor division toward negative infinity.
  for (const [dividend, divisor, expected] of [[7, 2, '3'], [-7, 2, '-4'], [-6, 2, '-3'], [-1, 250000, '-1'], [-7000001 + 2, 2, '-3500000'], [3 - 6000004, 2, '-3000001']]) {
    const [row] = await rows('SELECT public.osdap_floor_div_v1($1::numeric,$2::numeric) v', [dividend, divisor]);
    strict(row.v, expected, `floorDiv(${dividend}, ${divisor})`);
  }
  // The unsigned halves of a digest are big-endian 128-bit integers.
  const [{ v: uX }] = await rows("SELECT public.osdap_unsigned_v1(decode(repeat('ff',32),'hex'),0,16)::text v");
  strict(uX, (2n ** 128n - 1n).toString(), 'the first 16 digest bytes are one unsigned 128-bit integer');
  const [{ v: uZero }] = await rows("SELECT public.osdap_unsigned_v1(decode(repeat('00',32),'hex'),16,32)::text v");
  strict(uZero, '0', 'the last 16 digest bytes are one unsigned 128-bit integer');

  // Fingerprints are order-independent and match the frozen TypeScript vectors.
  const [{ fp: emptyWorld }] = await rows("SELECT encode(public.osdap_world_fingerprint_v1(ARRAY[]::text[],ARRAY[]::numeric[],ARRAY[]::numeric[]),'hex') fp");
  strict(emptyWorld, 'd4fc7423a008557724175d0b3847085affc44eeb1fafa5c14fb78d888ec7784a', 'the empty-world fingerprint is the frozen vector');
  const [{ fp: noneOrigin }] = await rows("SELECT encode(public.osdap_origin_fingerprint_v1('NONE',ARRAY[]::text[],ARRAY[]::numeric[],ARRAY[]::numeric[]),'hex') fp");
  strict(noneOrigin, '51cfd463b6af8a57b3380487f986abf10f137073e9be453e44a7e9a5b4c0e72b', 'the NONE origin fingerprint is the frozen vector');
  const [{ a: forward }] = await rows("SELECT encode(public.osdap_world_fingerprint_v1($1::text[],$2::numeric[],$3::numeric[]),'hex') a",
    [[GV01.id, GV02.id], [GV01.x, GV02.x], [GV01.y, GV02.y]]);
  const [{ a: reverse }] = await rows("SELECT encode(public.osdap_world_fingerprint_v1($1::text[],$2::numeric[],$3::numeric[]),'hex') a",
    [[GV02.id, GV01.id], [GV02.x, GV01.x], [GV02.y, GV01.y]]);
  strict(forward, reverse, 'the world fingerprint is independent of the input order');

  // The seven frozen golden vectors, byte for byte.
  for (const vector of GOLDEN_VECTORS) {
    const [row] = await placeCanonical(GOLDEN_USER_WORLD, vector.thread, vector.origin, vector.members, vector.world);
    strict(row.placement_x, vector.x, `${vector.id} placement x`);
    strict(row.placement_y, vector.y, `${vector.id} placement y`);
    strict(row.placement_attempt, vector.attempt, `${vector.id} attempt`);
    strict(row.base_x, vector.baseX, `${vector.id} base x`);
    strict(row.base_y, vector.baseY, `${vector.id} base y`);
    strict(row.world_fingerprint.toString('hex'), vector.worldFp, `${vector.id} world fingerprint`);
    strict(row.origin_fingerprint.toString('hex'), vector.originFp, `${vector.id} origin fingerprint`);
  }
  // GV-07 additionally proves dense shell escalation and that no lattice Home moved.
  ok(GOLDEN_VECTORS[6].attempt >= 32, 'a dense neighbourhood escalates past shell 1 instead of relocating a committed Home');
  // GV-02's dy is exactly the projected inner boundary of shell 1.
  strict(GOLDEN_VECTORS[1].y, '500000', 'an offset inside the inner half is projected onto the outer half, never re-drawn');

  // Exact minimum separation: a candidate exactly MIN_HOME_SEPARATION away is
  // admissible, one code point closer is not.
  const [far] = await rows("SELECT public.osdap_search_admissible_placement_v1('u','t',$1,$2,0,0,ARRAY[]::numeric[],ARRAY[]::numeric[]) IS NOT NULL present",
    [Buffer.alloc(32), Buffer.alloc(32)]);
  ok(far.present, 'an empty world admits the first candidate');
  const [seed] = await rows("SELECT s.placement_x x, s.placement_y y, s.placement_attempt a FROM public.osdap_search_admissible_placement_v1('u','t',$1,$2,0,0,ARRAY[]::numeric[],ARRAY[]::numeric[]) s",
    [Buffer.alloc(32), Buffer.alloc(32)]);
  const [exact] = await rows("SELECT s.placement_attempt a FROM public.osdap_search_admissible_placement_v1('u','t',$1,$2,0,0,ARRAY[$3::numeric],ARRAY[$4::numeric]) s",
    [Buffer.alloc(32), Buffer.alloc(32), (BigInt(seed.x) + 250000n).toString(), seed.y]);
  strict(exact.a, seed.a, 'a Home exactly MIN_HOME_SEPARATION away does not block the candidate');
  const [closer] = await rows("SELECT s.placement_attempt a FROM public.osdap_search_admissible_placement_v1('u','t',$1,$2,0,0,ARRAY[$3::numeric],ARRAY[$4::numeric]) s",
    [Buffer.alloc(32), Buffer.alloc(32), (BigInt(seed.x) + 249999n).toString(), seed.y]);
  ok(closer.a > seed.a, 'a Home one code point closer than the minimum blocks the candidate and the search advances');

  // Technical bound: candidates outside it are SKIPPED, never clamped or
  // wrapped, and blocking every in-bound candidate of one fixed seed exhausts
  // the frozen attempt budget instead of inventing a placement.
  const MAX = 4611686018427387903n;
  const candidates = await rows(
    `SELECT a.attempt, ($1::numeric + o.offset_dx) x, ($2::numeric + o.offset_dy) y
       FROM generate_series(0, 8191) AS a(attempt),
       LATERAL public.osdap_candidate_offset_v1(
         public.osdap_attempt_digest_v1('u','t',$3,$4,a.attempt), 1000000 * (1 + a.attempt / 32)) o`,
    [MAX.toString(), MAX.toString(), Buffer.alloc(32), Buffer.alloc(32)]);
  const inBound = candidates.filter((row) => BigInt(row.x) <= MAX && BigInt(row.y) <= MAX);
  ok(inBound.length > 0 && inBound.length < candidates.length, 'a corner base makes most candidates fall outside the technical bound');
  const [corner] = await rows("SELECT s.placement_x x, s.placement_y y FROM public.osdap_search_admissible_placement_v1('u','t',$1,$2,$3::numeric,$4::numeric,ARRAY[]::numeric[],ARRAY[]::numeric[]) s",
    [Buffer.alloc(32), Buffer.alloc(32), MAX.toString(), MAX.toString()]);
  strict(corner.x, inBound[0].x, 'the first IN-BOUND candidate wins: out-of-bound candidates are skipped, never clamped');
  strict(corner.y, inBound[0].y, 'the skipped candidates are not wrapped into the opposite corner either');
  await rejected(
    () => rows("SELECT * FROM public.osdap_search_admissible_placement_v1('u','t',$1,$2,$3::numeric,$4::numeric,$5::numeric[],$6::numeric[])",
      [Buffer.alloc(32), Buffer.alloc(32), MAX.toString(), MAX.toString(), inBound.map((r) => r.x), inBound.map((r) => r.y)]),
    'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED', ['55000']);

  // The closed world validation mirrors the frozen engine exactly.
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'NONE', [], [GV01, { ...GV02, id: GV01.id }]), 'DUPLICATE_EXISTING_THREAD_ID');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'NONE', [], [GV01, { ...GV01, id: 'other' }]), 'DUPLICATE_EXISTING_PLACEMENT');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, GV01.id, 'NONE', [], [GV01]), 'THREAD_ALREADY_PLACED');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'RESOLVED', [GV01.id, GV02.id], [GV01, GV02]), 'INVALID_ORIGIN_CARDINALITY');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'MULTIPLE', [GV01.id], [GV01]), 'INVALID_ORIGIN_CARDINALITY');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'MULTIPLE', [GV01.id, GV01.id], [GV01, GV02]), 'DUPLICATE_ORIGIN_HOME');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'RESOLVED', ['thread-unknown'], [GV01]), 'UNKNOWN_ORIGIN_HOME');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'NONE', [], [{ id: 'thread-far', x: '4611686018427387904', y: '0' }]), 'EXISTING_HOME_OUT_OF_BOUNDS');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'bad thread', 'NONE', [], []), 'INVALID_PLACEMENT_INPUT');
  await rejected(() => placeCanonical(GOLDEN_USER_WORLD, 'thread-x', 'PARENT', [], []), 'INVALID_PLACEMENT_INPUT');
}

// ================================ B2. canonical identity authority (FIX-01)
const sha1Hex = (value) => createHash('sha1').update(Buffer.from(value, 'utf8')).digest('hex');

async function verifyIdentityAuthority() {
  stage = 'B2. canonical RFC 4122 version-5 identity authority';
  // The deployed SHA-1 is the real one, across empty, sub-block, exact-block,
  // multi-block and non-ASCII inputs - not a lookalike that happens to agree
  // on one vector.
  for (const message of ['', 'abc', 'The quick brown fox jumps over the lazy dog', 'a'.repeat(55),
    'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(119), 'a'.repeat(200), 'المدير أحمد']) {
    const [row] = await rows("SELECT encode(public.canonical_sha1_v1(convert_to($1,'UTF8')),'hex') digest", [message]);
    strict(row.digest, sha1Hex(message), `the deployed SHA-1 matches the frozen one for a ${message.length}-character input`);
  }
  // The three frozen namespaces are re-derived from their documented URIs,
  // and the derivation reproduces the RFC 4122 appendix vector.
  for (const [uri, expected] of [
    ['https://qandeel.app/world/thread/v1', THREAD_NAMESPACE],
    ['https://qandeel.app/world/home-anchor/v1', HOME_ANCHOR_NAMESPACE],
    ['https://qandeel.app/runtime/thread-established/v1', THREAD_EVENT_NAMESPACE]]) {
    const [row] = await rows('SELECT public.canonical_uuid_v5_v1($1::uuid,$2)::text derived', [RFC4122_URL_NAMESPACE, uri]);
    strict(row.derived, expected, `the namespace of ${uri} is re-derived, not asserted`);
    strict(row.derived, uuidV5(RFC4122_URL_NAMESPACE, uri), 'the SQL derivation equals the TypeScript canonicalizer derivation');
  }
  strict(THREAD_NAMESPACE, '973d2e95-15d7-593c-953d-84ee94be343c', 'the frozen Thread namespace is unchanged');
  strict(HOME_ANCHOR_NAMESPACE, 'ca3acc01-e866-5d84-a15a-5be440c1919e', 'the frozen Home Anchor namespace is unchanged');
  strict(THREAD_EVENT_NAMESPACE, '47cd6b25-dbf8-5fd3-941f-eff9d2386990', 'the frozen event namespace is unchanged');
  const [appendix] = await rows("SELECT public.canonical_uuid_v5_v1('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,'www.example.org')::text v");
  strict(appendix.v, '74738ff5-5367-5958-9aee-98fffdcd1876', 'the RFC 4122 version-5 reference vector is reproduced');

  // The full triple, for the pinned vector and for arbitrary owners/focuses.
  const pinnedUser = '11111111-2222-4333-8444-555555555555';
  const pinnedFocus = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
  const [pinned] = await rows('SELECT c.thread_id::text t, c.home_anchor_id::text h, c.event_id::text e FROM public.canonical_thread_identities_v1($1,$2) c', [pinnedUser, pinnedFocus]);
  eq([pinned.t, pinned.h, pinned.e], ['afc4fd81-fe54-5738-9545-e1053044d919', '61cbba23-76ef-5aea-a453-50aed3a8006b', '76cb9266-87d0-53ac-8fae-f6242f9583ea'],
    'the SQL identity authority reproduces the exact frozen TypeScript vectors');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const user = randomUUID();
    const focus = randomUUID();
    const [derived] = await rows('SELECT c.thread_id::text t, c.home_anchor_id::text h, c.event_id::text e FROM public.canonical_thread_identities_v1($1,$2) c', [user, focus]);
    const threadId = threadIdOf(user, focus);
    eq([derived.t, derived.h, derived.e], [threadId, homeAnchorIdOf(threadId), eventIdOf(threadId)],
      'SQL and TypeScript agree on every derived identity, for arbitrary owners and focuses');
  }
  // Owner-scoped and focus-scoped: changing either changes the Thread.
  const focus = randomUUID();
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const [a] = await rows('SELECT c.thread_id::text t FROM public.canonical_thread_identities_v1($1,$2) c', [ownerA, focus]);
  const [b] = await rows('SELECT c.thread_id::text t FROM public.canonical_thread_identities_v1($1,$2) c', [ownerB, focus]);
  const [c2] = await rows('SELECT c.thread_id::text t FROM public.canonical_thread_identities_v1($1,$2) c', [ownerA, randomUUID()]);
  ok(a.t !== b.t, 'the same Emerging Focus under another owner derives a different Thread identity');
  ok(a.t !== c2.t, 'a different Emerging Focus under the same owner derives a different Thread identity');
  // Home and event follow the THREAD, not the focus.
  const [chain] = await rows('SELECT public.canonical_uuid_v5_v1($1::uuid,$2)::text h, public.canonical_uuid_v5_v1($3::uuid,$2)::text e',
    [HOME_ANCHOR_NAMESPACE, a.t, THREAD_EVENT_NAMESPACE]);
  const [full] = await rows('SELECT c.home_anchor_id::text h, c.event_id::text e FROM public.canonical_thread_identities_v1($1,$2) c', [ownerA, focus]);
  eq([full.h, full.e], [chain.h, chain.e], 'the Home Anchor and the event are derived from the Thread identity itself');
}

// ============================================ C. the integrated per-Moment run
async function verifyIntegratedMoment(owner) {
  stage = 'C. per-Moment integration: B1 seq1 -> optional B2 seq2';
  const session = await newSession(owner);
  const { userTurn, assistantTurn } = await completedTurns(owner, session);
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const userUnits = [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, ids.a1), unit(ASSISTANT_TEXT, A2, 1, ids.a2)];
  const userBundles = [
    bundle(ids.u1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
    bundle(ids.u2, { sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1,
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
  const managerThread = threadIdOf(owner, focuses.manager);
  const ahmedThread = threadIdOf(owner, focuses.ahmed);
  const userThreads = [
    establish(owner, ids.u1, focuses.manager, 'TE-01', [ids.u1], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    noEstablishment(ids.u2, 'NO_INDEPENDENT_FOCUS'),
    establish(owner, ids.u3, focuses.ahmed, 'TE-01', [ids.u3],
      { explicit_selection_grounding: anchor(U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [managerThread] }),
  ];
  const assistantThreads = [
    noEstablishment(ids.a1, 'ALREADY_ESTABLISHED', focuses.ahmed),
    noEstablishment(ids.a2, 'ALREADY_ESTABLISHED', focuses.ahmed),
  ];

  const [result] = await exchange(session, owner, userTurn, randomUUID(), userUnits, userBundles, userThreads,
    assistantTurn, randomUUID(), assistantUnits, assistantBundles, assistantThreads, FRESH_TOKEN);
  strict(result.live_head, 5, 'the exchange allocated SP1..SP5');
  strict(Number(result.same_sp_event_sequence), 1, 'the final Moment carries B1 alone, so the clock rests at sequence 1');

  // Per-Moment same-SP order: B1 always at 1, the whole B2 event at 2, and
  // nothing at all for a truthful non-establishment.
  const semantics = await rows('SELECT session_position sp, same_sp_event_sequence s FROM public.conversation_unit_focus_semantics WHERE session_id=$1 ORDER BY sp', [session]);
  eq(semantics.map((r) => [r.sp, Number(r.s)]), [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], 'every Moment carries its B1 bundle at same-SP sequence 1');
  const events = await rows('SELECT session_position sp, same_sp_event_sequence s, establishment_path p, origin_state o FROM public.conversation_thread_establishment_events WHERE session_id=$1 ORDER BY sp', [session]);
  eq(events.map((r) => [r.sp, Number(r.s)]), [[1, 2], [3, 2]], 'only the establishing Moments carry a B2 event, at same-SP sequence 2');
  eq(events.map((r) => r.p), ['TE-01', 'TE-01'], 'the frozen evidence path is recorded on the event');
  eq(events.map((r) => r.o), ['NONE', 'RESOLVED'], 'the then-known Conversational Origin state is recorded on the event');

  // Global, user/world-scoped Thread identity with an immutable lineage.
  const threads = await rows('SELECT id, user_id, grounding_emerging_focus_id f, established_session_id s, established_cu_id cu, established_sp sp, established_event_sequence seq, establishment_path p FROM public.conversation_threads WHERE user_id=$1 ORDER BY established_sp', [owner]);
  strict(threads.length, 2, 'exactly two Threads were established');
  eq(threads.map((t) => t.id), [managerThread, ahmedThread], 'the canonical Thread ids are the server-derived user/world identities');
  eq(threads.map((t) => t.f), [focuses.manager, focuses.ahmed], 'each Thread carries the exact Emerging Focus it was promoted from');
  eq(threads.map((t) => Number(t.seq)), [2, 2], 'establishment is always the second Stage-6 layer of its Moment');
  eq(threads.map((t) => t.sp), [1, 3], 'the establishing SP is the SP of the establishing CU');
  eq(threads.map((t) => t.s), [session, session], 'the establishing Session is recorded, but identity is not Session-scoped');
  strict(threadIdOf(owner, focuses.manager) === threadIdOf(randomUUID(), focuses.manager), false,
    'Thread identity is owner-scoped: the same focus under another owner would be another Thread');

  // Exactly one permanent Home per Thread, computed by the database.
  const homes = await rows('SELECT thread_id t, home_anchor_id h, address_scheme s, placement_x x, placement_y y, placement_attempt a, placement_base_x bx, placement_base_y by, placement_engine_version v, established_sp sp, established_event_sequence seq FROM public.conversation_thread_homes WHERE user_id=$1 ORDER BY established_sp', [owner]);
  strict(homes.length, 2, 'each Thread received exactly one permanent Home');
  eq(homes.map((h) => h.t), [managerThread, ahmedThread]);
  eq(homes.map((h) => h.h), [homeAnchorIdOf(managerThread), homeAnchorIdOf(ahmedThread)], 'the Home Anchor identity is derived from its Thread');
  eq(homes.map((h) => h.s), ['QANDEEL_OSDAP_V1', 'QANDEEL_OSDAP_V1'], 'the canonical address scheme is recorded on every Home');
  eq(homes.map((h) => h.v), ['canonical-home-placement-engine-v1', 'canonical-home-placement-engine-v1'], 'the placement engine version is recorded as provenance');
  eq([homes[0].bx, homes[0].by], ['0', '0'], 'a Thread without a Conversational Origin is searched from the world datum');
  eq([homes[1].bx, homes[1].by], [homes[0].x, homes[0].y], 'a RESOLVED origin seeds the search at that Thread\'s committed Home');
  ok(homes[0].x !== '0' || homes[0].y !== '0', 'the datum is a search seed, not an automatic first placement');
  const separation = (a, b) => {
    const dx = BigInt(a.x) - BigInt(b.x);
    const dy = BigInt(a.y) - BigInt(b.y);
    const abs = (v) => (v < 0n ? -v : v);
    return abs(dx) > abs(dy) ? abs(dx) : abs(dy);
  };
  ok(separation(homes[0], homes[1]) >= 250000n, 'the two committed Homes respect the exact minimum separation');
  // The DB recomputed the placement itself: it equals the pure engine's answer
  // for the same world, and no caller value could have produced it.
  const [recomputed] = await placeCanonical(owner, ahmedThread, 'RESOLVED', [managerThread],
    [{ id: managerThread, x: homes[0].x, y: homes[0].y }]);
  eq([recomputed.placement_x, recomputed.placement_y, recomputed.placement_attempt], [homes[1].x, homes[1].y, homes[1].a],
    'the stored placement is exactly what the canonical engine computes against the world under the lock');
  strict(recomputed.world_fingerprint.toString('hex'), (await rows('SELECT encode(world_fingerprint,\'hex\') f FROM public.conversation_thread_homes WHERE thread_id=$1', [ahmedThread]))[0].f,
    'the world fingerprint stored with the Home is the fingerprint of the world it was placed against');

  // The one explicit ThreadEstablished event per establishment, and no second
  // sequence for the Home.
  const eventRows = await rows('SELECT event_id, thread_id, home_anchor_id, emerging_focus_id f, commit_batch_id b, session_position sp, same_sp_event_sequence s FROM public.conversation_thread_establishment_events WHERE user_id=$1 ORDER BY session_position', [owner]);
  eq(eventRows.map((e) => e.event_id), [eventIdOf(managerThread), eventIdOf(ahmedThread)], 'the event identity is derived from its Thread');
  eq(eventRows.map((e) => e.home_anchor_id), [homeAnchorIdOf(managerThread), homeAnchorIdOf(ahmedThread)],
    'Thread and Home share ONE B2 semantic event');
  const [{ total: extraEvents }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_establishment_events e WHERE e.same_sp_event_sequence <> 2');
  strict(extraEvents, 0, 'no second same-SP sequence is ever reserved for a Home');

  // Evidence provenance: the establishing CU exactly once, last, same Session.
  const evidence = await rows('SELECT thread_id t, evidence_ordinal o, cu_id, cu_sp, evidence_role r FROM public.conversation_thread_establishment_evidence WHERE user_id=$1 ORDER BY thread_id, evidence_ordinal', [owner]);
  strict(evidence.length, 2, 'TE-01 rests on the establishing CU alone');
  eq(evidence.map((e) => e.r), ['ESTABLISHING_CU', 'ESTABLISHING_CU']);
  eq(new Set(evidence.map((e) => e.cu_id)).size, 2, 'each promotion cites its own establishing CU');

  // Conversational Origin provenance: membership only, no parent anywhere.
  const origins = await rows(`SELECT m.thread_id t, m.origin_member_ordinal o, m.origin_thread_id origin
      FROM public.conversation_thread_origin_members m JOIN public.conversation_threads th ON th.id = m.thread_id
     WHERE th.user_id=$1 ORDER BY m.thread_id, m.origin_member_ordinal`, [owner]);
  eq(origins.map((m) => [m.t, m.o, m.origin]), [[ahmedThread, 0, managerThread]], 'the RESOLVED origin is persisted as one member');
  const [{ columns }] = await rows(`SELECT array_agg(c.column_name::text ORDER BY c.column_name) columns
      FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='conversation_thread_origin_members'`);
  eq(columns, ['origin_member_ordinal', 'origin_thread_id', 'thread_id'],
    'origin provenance carries membership only: no parent, primary, direction, weight or semantic distance');

  // The capture batch distinguishes "evaluated, established nothing".
  const batches = await rows('SELECT unit_count u, establishment_count e FROM public.conversation_thread_commit_batches WHERE session_id=$1 ORDER BY unit_count DESC', [session]);
  eq(batches.map((b) => [b.u, b.e]), [[3, 2], [2, 0]], 'each committed-CU batch carries its own B2 capture row');

  return { session, ids, focuses, handles, managerThread, ahmedThread, userTurn, assistantTurn, homes };
}

// ================================================ D. permanence / immutability
async function verifyPermanence(owner, populated) {
  stage = 'D. permanence: no relocation, no rewrite, no second Home';
  const { managerThread, ahmedThread, homes } = populated;
  await rejected(() => q('UPDATE public.conversation_thread_homes SET placement_x = placement_x + 1 WHERE thread_id=$1', [managerThread]),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_homes WHERE thread_id=$1', [managerThread]),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.conversation_threads SET grounding_emerging_focus_id = $2 WHERE id=$1', [managerThread, randomUUID()]),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.conversation_thread_establishment_events SET origin_state = $2 WHERE thread_id=$1', [managerThread, 'MULTIPLE']),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_establishment_evidence WHERE thread_id=$1', [managerThread]),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.conversation_thread_origin_members SET origin_thread_id=$2 WHERE thread_id=$1', [ahmedThread, managerThread]),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.conversation_world_spatial_authorities SET address_scheme=$2 WHERE user_id=$1', [owner, 'OTHER']),
    'CANONICAL_THREAD_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('INSERT INTO public.conversation_thread_homes (thread_id, home_anchor_id, user_id, address_scheme, placement_x, placement_y, placement_attempt, placement_base_x, placement_base_y, world_fingerprint, origin_fingerprint, placement_engine_version, established_session_id, established_cu_id, established_sp, established_event_sequence) SELECT thread_id, $2, user_id, address_scheme, placement_x + 1000000, placement_y, placement_attempt, placement_base_x, placement_base_y, world_fingerprint, origin_fingerprint, placement_engine_version, established_session_id, established_cu_id, established_sp, established_event_sequence FROM public.conversation_thread_homes WHERE thread_id=$1',
    [managerThread, randomUUID()]), 'duplicate key', ['23505']);
  // A second establishment in the same world never moves an existing Home.
  const before = await worldSnapshot(owner);
  const place = (list) => list.map((h) => `${h.thread_id ?? h.t}:${h.placement_x ?? h.x}:${h.placement_y ?? h.y}`).sort();
  eq(place(before.conversation_thread_homes), place(homes), 'the committed geography is exactly what the first placements wrote');
  return before;
}

// ============================================ E. the deterministic DB gates
async function verifyEstablishmentGates(owner) {
  stage = 'E. TE-01 / TE-02 / TE-03 and the NO_ESTABLISHMENT states';
  const session = await newSession(owner);

  // --- exchange 1: a focus starts, and nothing is promoted yet.
  const first = await completedTurns(owner, session);
  const cu1 = randomUUID();
  const cuA1 = randomUUID();
  const handle = randomUUID();
  const focus = randomUUID();
  const thread = threadIdOf(owner, focus);
  const startBundle = bundle(cu1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) });
  const idleBundle = bundle(cuA1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu1, references: [], attention: NO_FOCUS });
  await exchange(session, owner, first.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu1)], [startBundle], [noEstablishment(cu1, 'NO_PROMOTION_PATH_PROVEN', focus)],
    first.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA1)], [idleBundle], [noEstablishment(cuA1, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);
  const [{ total: none }] = await rows('SELECT count(*)::int total FROM public.conversation_threads WHERE user_id=$1 AND grounding_emerging_focus_id=$2', [owner, focus]);
  strict(none, 0, 'NO_PROMOTION_PATH_PROVEN establishes nothing');
  const clockAfterFirst = await clockOf(session);
  eq([clockAfterFirst.current_sp, Number(clockAfterFirst.same_sp_event_sequence)], [2, 1], 'a batch that establishes nothing reserves no second same-SP event');

  // --- exchange 2: the same USER focus returns after intervening material.
  const second = await completedTurns(owner, session);
  const cu2 = randomUUID();
  const cuA2 = randomUUID();
  const returnBundle = bundle(cu2, { sequence_position: 'FOLLOW_UP', target_cu_id: cu1, references: [resolved(U1, 'المدير', handle, false)], attention: attendFocus(focus, 0) });
  const idle2 = bundle(cuA2, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu2, references: [], attention: NO_FOCUS });
  const token = await clockOf(session);
  const staleToken = { sp: token.current_sp, seq: Number(token.same_sp_event_sequence) };

  // TE-02 is refused when it rests on the establishing CU alone.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-02', [cu2])],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'INSUFFICIENT_SUSTAINED_THREAD_EVIDENCE');
  // TE-01 is refused for a path whose evidence is wider than the establishing CU.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-01', [cu1, cu2], { explicit_selection_grounding: anchor(U1, 'المدير') })],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'INVALID_THREAD_PROMOTION_PATH');
  // TE-02 is refused when the evidence names a CU of another Session or the future.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-02', [randomUUID(), cu2])],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'FUTURE_OR_FOREIGN_THREAD_EVIDENCE');
  // TE-02 is refused when a cited prior CU is not bound to the same focus.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-02', [cuA1, cu2])],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'THREAD_EVIDENCE_NOT_FOCUS_BOUND');
  // The establishing CU must be the LAST evidence row.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [{ ...establish(owner, cu2, focus, 'TE-02', [cu1, cu2]), evidence: [{ evidence_ordinal: 0, cu_id: cu2, evidence_role: 'ESTABLISHING_CU' }, { evidence_ordinal: 1, cu_id: cu1, evidence_role: 'PRIOR_EVIDENCE' }] }],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'INVALID_THREAD_EVIDENCE');
  // The establishing CU may never be missing from its own evidence.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [{ ...establish(owner, cu2, focus, 'TE-02', [cu1, cu2]), evidence: [{ evidence_ordinal: 0, cu_id: cu1, evidence_role: 'ESTABLISHING_CU' }] }],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'CURRENT_CU_THREAD_EVIDENCE_REQUIRED');
  // A Thread is never established for a focus the CU does not attend.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, randomUUID(), 'TE-02', [cu1, cu2])],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'THREAD_ESTABLISHMENT_WITHOUT_FOCUS');
  // A provider-authored identity is refused: the ids are canonical UUIDs only.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [{ ...establish(owner, cu2, focus, 'TE-02', [cu1, cu2]), thread_id: 'thread-1' }],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'INVALID_THREAD_IDENTITY');
  // A caller-authored coordinate has nowhere to go: an extra key is refused.
  await rejected(() => exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [{ ...establish(owner, cu2, focus, 'TE-02', [cu1, cu2]), placement_x: '0' }],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken),
    'INVALID_THREAD_PAYLOAD');

  // TE-02 succeeds on the establishing CU plus one earlier same-focus USER CU.
  const [committed] = await exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-02', [cu1, cu2])],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], staleToken);
  strict(committed.live_head, 4, 'the TE-02 exchange allocated SP3 and SP4');
  const [teTwo] = await rows('SELECT establishment_path p, established_sp sp FROM public.conversation_threads WHERE id=$1', [thread]);
  strict(teTwo.p, 'TE-02', 'sustained substantive engagement was recorded as TE-02');
  strict(teTwo.sp, 3, 'the Thread was established at the SP of its establishing CU');
  const evidence = await rows('SELECT cu_id, cu_sp, evidence_role r FROM public.conversation_thread_establishment_evidence WHERE thread_id=$1 ORDER BY evidence_ordinal', [thread]);
  eq(evidence.map((e) => [e.cu_id, e.cu_sp, e.r]), [[cu1, 1, 'PRIOR_EVIDENCE'], [cu2, 3, 'ESTABLISHING_CU']],
    'the prior evidence CU precedes the establishing CU in Session Position order');
  const clockAfterSecond = await clockOf(session);
  eq([clockAfterSecond.current_sp, Number(clockAfterSecond.same_sp_event_sequence)], [4, 1], 'the last Moment of the batch carries B1 only');

  // ALREADY_ESTABLISHED and its two failure modes.
  const third = await completedTurns(owner, session);
  const cu3 = randomUUID();
  const cuA3 = randomUUID();
  const attendBundle = bundle(cu3, { sequence_position: 'FOLLOW_UP', target_cu_id: cu2, references: [resolved(U1, 'المدير', handle, false)], attention: attendFocus(focus, 0) });
  const idle3 = bundle(cuA3, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu3, references: [], attention: NO_FOCUS });
  const token3 = await clockOf(session);
  const t3 = { sp: token3.current_sp, seq: Number(token3.same_sp_event_sequence) };
  await rejected(() => exchange(session, owner, third.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)], [attendBundle],
    [establish(owner, cu3, focus, 'TE-02', [cu1, cu3])],
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)], [idle3], [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], t3),
    'THREAD_FOCUS_ALREADY_ESTABLISHED');
  await rejected(() => exchange(session, owner, third.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)], [attendBundle],
    [noEstablishment(cu3, 'NO_PROMOTION_PATH_PROVEN', focus)],
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)], [idle3], [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], t3),
    'THREAD_NO_ESTABLISHMENT_MISMATCH');
  await rejected(() => exchange(session, owner, third.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)], [attendBundle],
    [noEstablishment(cu3, 'NO_INDEPENDENT_FOCUS', null)],
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)], [idle3], [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], t3),
    'THREAD_NO_ESTABLISHMENT_MISMATCH');
  await rejected(() => exchange(session, owner, third.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)], [attendBundle],
    [noEstablishment(cu3, 'ALREADY_ESTABLISHED', randomUUID())],
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)], [idle3], [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], t3),
    'THREAD_NO_ESTABLISHMENT_MISMATCH');
  const [alreadyRun] = await exchange(session, owner, third.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)], [attendBundle],
    [noEstablishment(cu3, 'ALREADY_ESTABLISHED', focus)],
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)], [idle3], [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], t3);
  strict(alreadyRun.live_head, 6, 'the ALREADY_ESTABLISHED exchange still allocates its Moments');
  const [{ total: stillOne }] = await rows('SELECT count(*)::int total FROM public.conversation_threads WHERE grounding_emerging_focus_id=$1', [focus]);
  strict(stillOne, 1, 'an Emerging Focus is promoted exactly once');
  return { session, focus, thread, cu1, cu2 };
}

// ============================================================ F. TE-03 and TE-01
async function verifyRecurrenceAndSelection(owner) {
  stage = 'F. TE-03 recurrence boundary and TE-01 attribution restraint';
  const session = await newSession(owner);
  const handle = randomUUID();
  const focus = randomUUID();
  const other = randomUUID();
  const otherHandle = randomUUID();

  // SP1 USER starts the focus; SP2 ASSISTANT departs to nothing.
  const one = await completedTurns(owner, session);
  const cu1 = randomUUID();
  const cuA1 = randomUUID();
  await exchange(session, owner, one.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu1)],
    [bundle(cu1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })],
    [noEstablishment(cu1, 'NO_PROMOTION_PATH_PROVEN', focus)],
    one.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA1)],
    [bundle(cuA1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu1, references: [], attention: NO_FOCUS })],
    [noEstablishment(cuA1, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);

  // SP3 USER returns to the focus: TE-03 with the SP1 CU as the cited boundary.
  const two = await completedTurns(owner, session);
  const cu2 = randomUUID();
  const cuA2 = randomUUID();
  const returnBundle = bundle(cu2, { sequence_position: 'FOLLOW_UP', target_cu_id: cu1, references: [resolved(U1, 'المدير', handle, false)], attention: attendFocus(focus, 0) });
  const idle = bundle(cuA2, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu2, references: [], attention: NO_FOCUS });
  const t = await clockOf(session);
  const token = { sp: t.current_sp, seq: Number(t.same_sp_event_sequence) };
  await exchange(session, owner, two.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [returnBundle],
    [establish(owner, cu2, focus, 'TE-03', [cu1, cu2])],
    two.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], token);
  const [recurrence] = await rows('SELECT establishment_path p FROM public.conversation_threads WHERE grounding_emerging_focus_id=$1', [focus]);
  strict(recurrence.p, 'TE-03', 'a recurrent independent attention was recorded as TE-03');

  // A second focus, to prove the recurrence boundary is derived from the FULL
  // canonical history and never from provider-chosen older evidence.
  const three = await completedTurns(owner, session);
  const cu3 = randomUUID();
  const cuA3 = randomUUID();
  const t3 = await clockOf(session);
  await exchange(session, owner, three.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu3)],
    [bundle(cu3, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', otherHandle, true)], attention: startFocus(other, 0) })],
    [noEstablishment(cu3, 'NO_PROMOTION_PATH_PROVEN', other)],
    three.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA3)],
    [bundle(cuA3, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu3, references: [], attention: NO_FOCUS })],
    [noEstablishment(cuA3, 'NO_INDEPENDENT_FOCUS')], { sp: t3.current_sp, seq: Number(t3.same_sp_event_sequence) });
  const four = await completedTurns(owner, session);
  const cu4 = randomUUID();
  const cuA4 = randomUUID();
  const t4 = await clockOf(session);
  await exchange(session, owner, four.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu4)],
    [bundle(cu4, { sequence_position: 'FOLLOW_UP', target_cu_id: cu3, references: [resolved(U1, 'المدير', otherHandle, false)], attention: attendFocus(other, 0) })],
    [noEstablishment(cu4, 'NO_PROMOTION_PATH_PROVEN', other)],
    four.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA4)],
    [bundle(cuA4, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu4, references: [], attention: NO_FOCUS })],
    [noEstablishment(cuA4, 'NO_INDEPENDENT_FOCUS')], { sp: t4.current_sp, seq: Number(t4.same_sp_event_sequence) });

  // Now cite only the OLD CU of the second focus while a newer one exists: the
  // database derives the boundary itself and refuses the fake recurrence.
  const five = await completedTurns(owner, session);
  const cu5 = randomUUID();
  const cuA5 = randomUUID();
  const t5 = await clockOf(session);
  const token5 = { sp: t5.current_sp, seq: Number(t5.same_sp_event_sequence) };
  const attend5 = bundle(cu5, { sequence_position: 'FOLLOW_UP', target_cu_id: cu4, references: [resolved(U1, 'المدير', otherHandle, false)], attention: attendFocus(other, 0) });
  const idle5 = bundle(cuA5, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu5, references: [], attention: NO_FOCUS });
  await rejected(() => exchange(session, owner, five.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu5)], [attend5],
    [establish(owner, cu5, other, 'TE-03', [cu3, cu5])],
    five.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA5)], [idle5], [noEstablishment(cuA5, 'NO_INDEPENDENT_FOCUS')], token5),
    'THREAD_RECURRENCE_NOT_PROVEN');
  // A local clarification is not an independent return either.
  const clarify = bundle(cu5, { sequence_position: 'FOLLOW_UP', target_cu_id: cu4, references: [resolved(U1, 'المدير', otherHandle, false)], attention: attendFocus(other, 0, 'LOCAL_CLARIFICATION_OR_CORRECTION') });
  await rejected(() => exchange(session, owner, five.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu5)], [clarify],
    [establish(owner, cu5, other, 'TE-03', [cu4, cu5])],
    five.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA5)], [idle5], [noEstablishment(cuA5, 'NO_INDEPENDENT_FOCUS')], token5),
    'THREAD_RECURRENCE_NOT_PROVEN');
  // Citing the LATEST prior same-focus CU proves the return.
  await exchange(session, owner, five.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu5)], [attend5],
    [establish(owner, cu5, other, 'TE-03', [cu4, cu5])],
    five.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA5)], [idle5], [noEstablishment(cuA5, 'NO_INDEPENDENT_FOCUS')], token5);
  const [second] = await rows('SELECT establishment_path p FROM public.conversation_threads WHERE grounding_emerging_focus_id=$1', [other]);
  strict(second.p, 'TE-03', 'the recurrence is proven only when the latest prior same-focus CU is cited');

  // TE-01 attribution restraint, in a fresh Session: a selection wholly inside
  // reported speech is that person's selection, never the user's own.
  const attributed = await newSession(owner);
  const attributedTurns = await completedTurns(owner, attributed);
  const cuAtt = randomUUID();
  const cuAttA = randomUUID();
  const attHandle = randomUUID();
  const attFocus = randomUUID();
  const attBundle = bundle(cuAtt, { sequence_position: 'INITIATING',
    references: [resolved(U2, 'أحمد', attHandle, true)],
    claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'UNRESOLVED', null, 'REPORTED_SPEECH')],
    attention: startFocus(attFocus, 0) });
  const attIdle = bundle(cuAttA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cuAtt, references: [], attention: NO_FOCUS });
  await rejected(() => exchange(attributed, owner, attributedTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, cuAtt)], [attBundle],
    [establish(owner, cuAtt, attFocus, 'TE-01', [cuAtt], { explicit_selection_grounding: anchor(U2, 'الموضوع') })],
    attributedTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuAttA)], [attIdle], [noEstablishment(cuAttA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN),
    'ATTRIBUTED_SELECTION_FORBIDDEN');
  // A selection that is not the exact committed wording is refused too.
  await rejected(() => exchange(attributed, owner, attributedTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, cuAtt)], [attBundle],
    [establish(owner, cuAtt, attFocus, 'TE-01', [cuAtt], { explicit_selection_grounding: { anchor_text: 'الفريق', anchor_occurrence: 1, span_start: 0, span_end: 6 } })],
    attributedTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuAttA)], [attIdle], [noEstablishment(cuAttA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN),
    'NON_EXTRACTIVE_REFERENCE');
  // TE-01 outside attributed wording succeeds.
  await exchange(attributed, owner, attributedTurns.userTurn, randomUUID(), [unit(USER_TEXT, U2, 1, cuAtt)], [attBundle],
    [establish(owner, cuAtt, attFocus, 'TE-01', [cuAtt], { explicit_selection_grounding: anchor(U2, 'أحمد') })],
    attributedTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuAttA)], [attIdle], [noEstablishment(cuAttA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);
  const [selection] = await rows('SELECT establishment_path p FROM public.conversation_threads WHERE grounding_emerging_focus_id=$1', [attFocus]);
  strict(selection.p, 'TE-01', 'an unattributed explicit selection establishes through TE-01');

  // QANDEEL alone never establishes: an ASSISTANT-only TE-02 is refused.
  const assistantOnly = await newSession(owner);
  const aoTurns = await completedTurns(owner, assistantOnly);
  const aoUser = randomUUID();
  const aoA1 = randomUUID();
  const aoFocus = randomUUID();
  const aoHandle = randomUUID();
  await exchange(assistantOnly, owner, aoTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, aoUser)],
    [bundle(aoUser, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })],
    [noEstablishment(aoUser, 'NO_INDEPENDENT_FOCUS')],
    aoTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, aoA1)],
    [bundle(aoA1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', references: [resolved(A1, 'أحمد', aoHandle, true)], attention: startFocus(aoFocus, 0) })],
    [noEstablishment(aoA1, 'NO_PROMOTION_PATH_PROVEN', aoFocus)], FRESH_TOKEN);
  const aoNext = await completedTurns(owner, assistantOnly);
  const aoUser2 = randomUUID();
  const aoA2 = randomUUID();
  const aoToken = await clockOf(assistantOnly);
  await rejected(() => exchange(assistantOnly, owner, aoNext.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, aoUser2)],
    [bundle(aoUser2, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })],
    [noEstablishment(aoUser2, 'NO_INDEPENDENT_FOCUS')],
    aoNext.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, aoA2)],
    [bundle(aoA2, { functions: ['ASK'], sequence_position: 'RESPONSIVE', references: [resolved(A1, 'أحمد', aoHandle, false)], attention: attendFocus(aoFocus, 0) })],
    [establish(owner, aoA2, aoFocus, 'TE-02', [aoA1, aoA2])], { sp: aoToken.current_sp, seq: Number(aoToken.same_sp_event_sequence) }),
    'USER_THREAD_EVIDENCE_REQUIRED');
}

// ================================== G. origin provenance / no fake parenthood
async function verifyOriginProvenance(owner, populated) {
  stage = 'G. Conversational Origin provenance without parenthood';
  const { managerThread, ahmedThread } = populated;
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const cu = randomUUID();
  const cuA = randomUUID();
  const handle = randomUUID();
  const focus = randomUUID();
  const start = bundle(cu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) });
  const idle = bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS });
  const base = (overrides) => establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير'), ...overrides });
  const run = (decision) => exchange(session, owner, turns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu)], [start], [decision],
    turns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA)], [idle], [noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);

  await rejected(() => run(base({ origin_state: 'RESOLVED', origin_thread_ids: [] })), 'INVALID_THREAD_ORIGIN_CARDINALITY');
  await rejected(() => run(base({ origin_state: 'MULTIPLE', origin_thread_ids: [managerThread] })), 'INVALID_THREAD_ORIGIN_CARDINALITY');
  await rejected(() => run(base({ origin_state: 'NONE', origin_thread_ids: [managerThread] })), 'INVALID_THREAD_ORIGIN_CARDINALITY');
  await rejected(() => run(base({ origin_state: 'AMBIGUOUS', origin_thread_ids: [managerThread, managerThread] })), 'DUPLICATE_THREAD_ORIGIN_MEMBER');
  await rejected(() => run(base({ origin_state: 'RESOLVED', origin_thread_ids: [randomUUID()] })), 'UNKNOWN_THREAD_ORIGIN_MEMBER');
  await rejected(() => run({ ...base({ origin_state: 'MULTIPLE' }), origin_thread_ids: [managerThread, ahmedThread].sort().reverse() }),
    'THREAD_ORIGIN_ORDER_NOT_CANONICAL');

  const members = [managerThread, ahmedThread].sort();
  await run(base({ origin_state: 'AMBIGUOUS', origin_thread_ids: members }));
  const thread = threadIdOf(owner, focus);
  const stored = await rows('SELECT origin_member_ordinal o, origin_thread_id t FROM public.conversation_thread_origin_members WHERE thread_id=$1 ORDER BY origin_member_ordinal', [thread]);
  eq(stored.map((m) => [m.o, m.t]), [[0, members[0]], [1, members[1]]], 'AMBIGUOUS stores every member symmetrically, in canonical order');
  const [{ origin_state: state }] = await rows('SELECT origin_state FROM public.conversation_thread_establishment_events WHERE thread_id=$1', [thread]);
  strict(state, 'AMBIGUOUS', 'the then-known ambiguity is recorded, and no candidate is elected true');
  // The base is the exact integer barycenter over ALL members, not one of them.
  const homes = await rows('SELECT thread_id t, placement_x x, placement_y y FROM public.conversation_thread_homes WHERE thread_id = ANY($1)', [members]);
  const byId = Object.fromEntries(homes.map((h) => [h.t, h]));
  const [{ placement_base_x: bx, placement_base_y: by }] = await rows('SELECT placement_base_x, placement_base_y FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]);
  const floorDiv = (a, b) => (a - ((a % b) + b) % b) / b;
  strict(bx, String(floorDiv(BigInt(byId[members[0]].x) + BigInt(byId[members[1]].x), 2n)), 'the base is the exact floor barycenter of all origin members');
  strict(by, String(floorDiv(BigInt(byId[members[0]].y) + BigInt(byId[members[1]].y), 2n)), 'the barycenter is computed in exact integer arithmetic');
  ok(bx !== byId[members[0]].x || by !== byId[members[0]].y, 'no origin member is elected as the seed');
}

// ======================= G2. the DB refuses a valid-but-wrong identity (FIX-01)
async function verifyIdentityEnforcement() {
  stage = 'G2. valid-but-wrong canonical identities are refused before placement';
  // A FRESH owner: nothing of this world exists yet, so if any rejected attempt
  // had reached the user-world lock it would have left the authority row behind.
  const owner = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const cu = randomUUID();
  const cuA = randomUUID();
  const handle = randomUUID();
  const focus = randomUUID();
  const thread = threadIdOf(owner, focus);
  const start = bundle(cu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) });
  const idle = bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS });
  const decision = (overrides) => ({
    ...establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    ...overrides,
  });
  const run = (threads) => exchange(session, owner, turns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu)], [start], [threads],
    turns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA)], [idle], [noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);

  // Every rejected shape below is a perfectly well-formed, mutually distinct
  // RFC 4122 UUID: only the exact derivation is admissible.
  const wrongThread = threadIdOf(owner, randomUUID());
  const wrongHome = homeAnchorIdOf(wrongThread);
  const wrongEvent = eventIdOf(wrongThread);
  await rejected(() => run(decision({ thread_id: wrongThread })), 'INVALID_THREAD_IDENTITY');
  await rejected(() => run(decision({ home_anchor_id: wrongHome })), 'INVALID_THREAD_IDENTITY');
  await rejected(() => run(decision({ thread_established_event_id: wrongEvent })), 'INVALID_THREAD_IDENTITY');
  await rejected(() => run(decision({ thread_id: wrongThread, home_anchor_id: wrongHome, thread_established_event_id: wrongEvent })),
    'INVALID_THREAD_IDENTITY');
  // Even a Home derived from the CORRECT Thread but under the wrong namespace
  // (here: the event namespace) is refused.
  await rejected(() => run(decision({ home_anchor_id: eventIdOf(thread) })), 'INVALID_THREAD_IDENTITY');
  await rejected(() => run(decision({ thread_established_event_id: homeAnchorIdOf(thread) })), 'INVALID_THREAD_IDENTITY');
  const [{ total: authorities }] = await rows('SELECT count(*)::int total FROM public.conversation_world_spatial_authorities WHERE user_id=$1', [owner]);
  strict(authorities, 0, 'a wrong identity is refused BEFORE the user-world lock: no spatial authority row was created');
  const [{ total: placed }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_homes WHERE user_id=$1', [owner]);
  strict(placed, 0, 'a wrong identity is refused BEFORE any placement or durable row');
  const rejectedClock = await clockOf(session);
  eq([rejectedClock.current_sp, Number(rejectedClock.same_sp_event_sequence)], [null, 0], 'a wrong identity consumes no SP and no same-SP sequence');

  // The exact canonical triple is accepted, and the stored rows carry exactly it.
  await run(decision({}));
  const [stored] = await rows('SELECT t.id::text t, h.home_anchor_id::text h, e.event_id::text e FROM public.conversation_threads t JOIN public.conversation_thread_homes h ON h.thread_id=t.id JOIN public.conversation_thread_establishment_events e ON e.thread_id=t.id WHERE t.user_id=$1', [owner]);
  eq([stored.t, stored.h, stored.e], [thread, homeAnchorIdOf(thread), eventIdOf(thread)], 'the accepted establishment stored exactly the derived canonical identities');
  // OSDAP consumed the derived Thread identity: the committed placement equals
  // what the engine computes for THAT id against the empty world.
  const [expected] = await placeCanonical(owner, thread, 'NONE', [], []);
  const [home] = await rows('SELECT placement_x x, placement_y y FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]);
  eq([home.x, home.y], [expected.placement_x, expected.placement_y], 'OSDAP received the validated canonical Thread identity as its placement entropy');
  const [other] = await placeCanonical(owner, wrongThread, 'NONE', [], []);
  ok(other.placement_x !== expected.placement_x || other.placement_y !== expected.placement_y,
    'a substituted Thread identity would have produced a different permanent Home, which is why identity is enforced');
  return { owner, session, focus, thread, cu };
}

// ==================== G3. finalized-exchange half-state gate (FIX-02)
async function verifyExchangeHalfStates() {
  stage = 'G3. finalized-exchange half-state classification before any writer';
  const owner = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
  const state = async (session, turn, batch) =>
    (await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, turn, batch]))[0].s;

  /** One finalized-exchange fixture: two committed turns and both payloads. */
  const fixture = async () => {
    const session = await newSession(owner);
    const turns = await completedTurns(owner, session);
    const cu = randomUUID();
    const cuA = randomUUID();
    const handle = randomUUID();
    const focus = randomUUID();
    return {
      session,
      ...turns,
      userBatch: randomUUID(),
      assistantBatch: randomUUID(),
      cu,
      cuA,
      focus,
      userUnits: [unit(USER_TEXT, U1, 1, cu)],
      userBundles: [bundle(cu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })],
      userThreads: [establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير') })],
      assistantUnits: [unit(ASSISTANT_TEXT, A1, 1, cuA)],
      assistantBundles: [bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS })],
      assistantThreads: [noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')],
    };
  };
  const runExchange = (f, token, overrides = {}) => exchange(f.session, owner, f.userTurn, f.userBatch,
    overrides.userUnits ?? f.userUnits, overrides.userBundles ?? f.userBundles, overrides.userThreads ?? f.userThreads,
    f.assistantTurn, f.assistantBatch, f.assistantUnits, f.assistantBundles, f.assistantThreads, token);
  const tokenOf = async (session) => {
    const clock = await clockOf(session);
    return { sp: clock.current_sp, seq: Number(clock.same_sp_event_sequence) };
  };

  // (5) BOTH ABSENT + a valid token: the normal new exchange.
  const fresh = await fixture();
  strict(await state(fresh.session, fresh.userTurn, fresh.userBatch), 'ABSENT', 'an untouched half classifies as ABSENT');
  strict(await state(fresh.session, fresh.assistantTurn, fresh.assistantBatch), 'ABSENT');
  const [committed] = await runExchange(fresh, FRESH_TOKEN);
  strict(committed.live_head, 2, 'both-absent with a valid token commits the whole exchange');
  strict(await state(fresh.session, fresh.userTurn, fresh.userBatch), 'COMPLETE', 'a whole exchange half classifies as COMPLETE');
  strict(await state(fresh.session, fresh.assistantTurn, fresh.assistantBatch), 'COMPLETE');

  // (7) BOTH COMPLETE + exact payload replays with zero mutation EVEN with a
  //     deliberately stale token: the token is irrelevant to an exact replay.
  const beforeReplay = await worldSnapshot(owner);
  const clockBefore = await clockOf(fresh.session);
  const [replayed] = await runExchange(fresh, { sp: 999, seq: 7 });
  strict(replayed.live_head, 2, 'both-complete replays the stored canonical state');
  eq(await worldSnapshot(owner), beforeReplay, 'the replay mutated nothing');
  const clockAfter = await clockOf(fresh.session);
  eq([clockAfter.current_sp, Number(clockAfter.same_sp_event_sequence)],
    [clockBefore.current_sp, Number(clockBefore.same_sp_event_sequence)], 'the replay consumed no same-SP sequence');

  // (8) BOTH COMPLETE + a changed payload is a conflict, not a repair.
  await rejected(() => runExchange(fresh, FRESH_TOKEN, { userThreads: [noEstablishment(fresh.cu, 'NO_PROMOTION_PATH_PROVEN', fresh.focus)] }),
    'THREAD_BATCH_PAYLOAD_CONFLICT');
  eq(await worldSnapshot(owner), beforeReplay, 'the conflicting replay mutated nothing');

  // (6) BOTH ABSENT + a stale token is a typed stale failure with zero mutation.
  const stale = await fixture();
  await rejected(() => runExchange(stale, { sp: 41, seq: 3 }), 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', ['40001']);
  const [{ total: staleUnits }] = await rows('SELECT count(*)::int total FROM public.conversation_units WHERE session_id=$1', [stale.session]);
  strict(staleUnits, 0, 'the stale-token exchange wrote nothing');

  /** Asserts an asymmetric exchange fails closed and created NOTHING new. */
  const assertAsymmetric = async (f, token, label) => {
    const before = await worldSnapshot(owner);
    const clock = await clockOf(f.session);
    const units = (await rows('SELECT count(*)::int total FROM public.conversation_units WHERE session_id=$1', [f.session]))[0].total;
    const events = (await rows('SELECT count(*)::int total FROM public.conversation_unit_commit_events WHERE session_id=$1', [f.session]))[0].total;
    const focusBatches = (await rows('SELECT count(*)::int total FROM public.conversation_focus_commit_batches WHERE session_id=$1', [f.session]))[0].total;
    const threadBatches = (await rows('SELECT count(*)::int total FROM public.conversation_thread_commit_batches WHERE session_id=$1', [f.session]))[0].total;
    await rejected(() => runExchange(f, token), 'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);
    eq(await worldSnapshot(owner), before, `${label}: no Thread, Home, event, evidence or origin row appeared`);
    const after = await clockOf(f.session);
    eq([after.current_sp, Number(after.same_sp_event_sequence)], [clock.current_sp, Number(clock.same_sp_event_sequence)],
      `${label}: no SP and no same-SP sequence was consumed`);
    strict((await rows('SELECT count(*)::int total FROM public.conversation_units WHERE session_id=$1', [f.session]))[0].total, units,
      `${label}: the missing half's committed CUs were never created`);
    strict((await rows('SELECT count(*)::int total FROM public.conversation_unit_commit_events WHERE session_id=$1', [f.session]))[0].total, events,
      `${label}: the missing half's commit event was never created`);
    strict((await rows('SELECT count(*)::int total FROM public.conversation_focus_commit_batches WHERE session_id=$1', [f.session]))[0].total, focusBatches,
      `${label}: no B1 capture batch was created`);
    strict((await rows('SELECT count(*)::int total FROM public.conversation_thread_commit_batches WHERE session_id=$1', [f.session]))[0].total, threadBatches,
      `${label}: no B2 capture batch was created`);
  };

  // (1) USER COMPLETE + ASSISTANT ABSENT, with the IDENTICAL user payload and a
  //     CURRENT valid token - the case a payload conflict would have masked.
  const halfUser = await fixture();
  await commit(halfUser.session, owner, halfUser.userTurn, halfUser.userBatch, halfUser.userUnits, halfUser.userBundles, halfUser.userThreads);
  strict(await state(halfUser.session, halfUser.userTurn, halfUser.userBatch), 'COMPLETE');
  strict(await state(halfUser.session, halfUser.assistantTurn, halfUser.assistantBatch), 'ABSENT');
  await assertAsymmetric(halfUser, await tokenOf(halfUser.session), 'USER complete + ASSISTANT absent');

  // (2) The rule does not change when the missing half would carry zero CUs.
  const halfZero = await fixture();
  halfZero.assistantUnits = [];
  halfZero.assistantBundles = [];
  halfZero.assistantThreads = [];
  await commit(halfZero.session, owner, halfZero.userTurn, halfZero.userBatch, halfZero.userUnits, halfZero.userBundles, halfZero.userThreads);
  await assertAsymmetric(halfZero, await tokenOf(halfZero.session), 'USER complete + ASSISTANT absent with zero assistant CUs');

  // (3) ASSISTANT COMPLETE + USER ABSENT.
  const halfAssistant = await fixture();
  // The ASSISTANT half is committed FIRST here, so its bundle can name no
  // prior-CU target: the USER CU it would point at does not exist yet.
  halfAssistant.assistantBundles = [bundle(halfAssistant.cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', references: [], attention: NO_FOCUS })];
  await commit(halfAssistant.session, owner, halfAssistant.assistantTurn, halfAssistant.assistantBatch,
    halfAssistant.assistantUnits, halfAssistant.assistantBundles, halfAssistant.assistantThreads);
  strict(await state(halfAssistant.session, halfAssistant.userTurn, halfAssistant.userBatch), 'ABSENT');
  strict(await state(halfAssistant.session, halfAssistant.assistantTurn, halfAssistant.assistantBatch), 'COMPLETE');
  await assertAsymmetric(halfAssistant, await tokenOf(halfAssistant.session), 'ASSISTANT complete + USER absent');

  // (4) USER commitment + B1 but NO B2 capture, ASSISTANT absent.
  const halfLegacy = await fixture();
  await rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [halfLegacy.session, owner, halfLegacy.userTurn, halfLegacy.userBatch, JSON.stringify(halfLegacy.userUnits), ...PROVENANCE,
      JSON.stringify(halfLegacy.userBundles), ...FOCUS_PROVENANCE]);
  strict(await state(halfLegacy.session, halfLegacy.userTurn, halfLegacy.userBatch), 'PARTIAL', 'commitment + B1 without a B2 capture is PARTIAL');
  await assertAsymmetric(halfLegacy, await tokenOf(halfLegacy.session), 'USER commitment+B1 without B2 + ASSISTANT absent');

  // A half whose capture row names another Session / turn is PARTIAL too.
  strict(await state(halfUser.session, halfUser.assistantTurn, halfUser.userBatch), 'PARTIAL',
    'a capture batch that does not belong to the named source turn is PARTIAL');
  return owner;
}

// ================= G4. structural completeness and corruption (FIX-03)
async function verifyStructuralCompleteness() {
  stage = 'G4. full structural completeness: evidence, origin and coherence';
  const owner = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
  const session = await newSession(owner);
  const handle = randomUUID();
  const focus = randomUUID();
  const decoyFocus = randomUUID();
  const decoyHandle = randomUUID();

  // Exchange 1: a decoy establishment (its own batch) - a valid-but-foreign
  // Thread, Home and event to substitute with, plus an origin member.
  const first = await completedTurns(owner, session);
  const decoyCu = randomUUID();
  const decoyA = randomUUID();
  const decoyThread = threadIdOf(owner, decoyFocus);
  await exchange(session, owner, first.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, decoyCu)],
    [bundle(decoyCu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', decoyHandle, true)], attention: startFocus(decoyFocus, 0) })],
    [establish(owner, decoyCu, decoyFocus, 'TE-01', [decoyCu], { explicit_selection_grounding: anchor(U1, 'المدير') })],
    first.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, decoyA)],
    [bundle(decoyA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: decoyCu, references: [], attention: NO_FOCUS })],
    [noEstablishment(decoyA, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);

  // Exchange 2: SP3 starts the target focus; nothing is promoted yet.
  const second = await completedTurns(owner, session);
  const priorCu = randomUUID();
  const priorA = randomUUID();
  const t2 = await tokenFor(session);
  await exchange(session, owner, second.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, priorCu)],
    [bundle(priorCu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })],
    [noEstablishment(priorCu, 'NO_PROMOTION_PATH_PROVEN', focus)],
    second.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, priorA)],
    [bundle(priorA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: priorCu, references: [], attention: NO_FOCUS })],
    [noEstablishment(priorA, 'NO_INDEPENDENT_FOCUS')], t2);

  // Exchange 3: TE-02 promotion with TWO evidence rows and a RESOLVED origin.
  const third = await completedTurns(owner, session);
  const cu = randomUUID();
  const cuA = randomUUID();
  const batch = randomUUID();
  const thread = threadIdOf(owner, focus);
  const units = [unit(USER_TEXT, U1, 1, cu)];
  const bundles = [bundle(cu, { sequence_position: 'FOLLOW_UP', target_cu_id: priorCu, references: [resolved(U1, 'المدير', handle, false)], attention: attendFocus(focus, 0) })];
  const threads = [establish(owner, cu, focus, 'TE-02', [priorCu, cu], { origin_state: 'RESOLVED', origin_thread_ids: [decoyThread] })];
  const t3 = await tokenFor(session);
  await exchange(session, owner, third.userTurn, batch, units, bundles, threads,
    third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA)],
    [bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS })],
    [noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')], t3);

  const batchState = async () =>
    (await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, third.userTurn, batch]))[0].s;
  strict(await batchState(), 'COMPLETE', 'a whole TE-02 establishment with evidence and origin provenance is COMPLETE');

  const replay = () => commit(session, owner, third.userTurn, batch, units, bundles, threads);
  await replay();
  ok(true, 'the uncorrupted batch replays');

  const driftFocus = randomUUID();
  const [priorSp] = await rows('SELECT session_position sp FROM public.conversation_units WHERE id=$1', [priorCu]);

  /**
   * Applies a technical corruption with the append-only triggers and the
   * referential triggers suspended, proves the ONE completeness authority
   * classifies the batch PARTIAL, proves replay fails closed, proves the
   * finalized-exchange gate refuses the same half, then rolls it all back.
   */
  async function corrupted(label, statements) {
    assertions += 1;
    await q('SAVEPOINT corruption');
    try {
      await q("SET session_replication_role = 'replica'");
      for (const [text, values] of statements) await q(text, values);
      await q("SET session_replication_role = 'origin'");
      assert.equal(await batchState(), 'PARTIAL', `${label}: the completeness authority classifies the batch PARTIAL`);
      // Each failing attempt aborts the transaction, so each runs inside its
      // own nested savepoint.
      let replayError;
      await q('SAVEPOINT attempt');
      try { await replay(); } catch (caught) { replayError = caught; }
      await q('ROLLBACK TO SAVEPOINT attempt');
      await q('RELEASE SAVEPOINT attempt');
      assert.ok(replayError, `${label}: a corrupted batch must never replay`);
      assert.equal(replayError.code, '55000', `${label}: unexpected SQLSTATE ${replayError.code}`);
      assert.match(String(replayError.message), /THREAD_CAPTURE_BATCH_INTEGRITY/u, `${label}: ${replayError.message}`);
      let exchangeError;
      const assistantCu = randomUUID();
      await q('SAVEPOINT attempt');
      try {
        await exchange(session, owner, third.userTurn, batch, units, bundles, threads,
          third.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, assistantCu)],
          [bundle(assistantCu, { functions: ['ASK'], sequence_position: 'RESPONSIVE', references: [], attention: NO_FOCUS })],
          [noEstablishment(assistantCu, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);
      } catch (caught) { exchangeError = caught; }
      await q('ROLLBACK TO SAVEPOINT attempt');
      await q('RELEASE SAVEPOINT attempt');
      assert.ok(exchangeError && String(exchangeError.message).includes('THREAD_CAPTURE_BATCH_INTEGRITY'),
        `${label}: the finalized-exchange gate must refuse the same corrupted half; got ${exchangeError?.code ?? 'success'} ${exchangeError?.message ?? ''}`);
    } finally {
      await q("SET session_replication_role = 'origin'").catch(() => undefined);
      await q('ROLLBACK TO SAVEPOINT corruption');
      await q('RELEASE SAVEPOINT corruption');
    }
    assert.equal(await batchState(), 'COMPLETE', `${label}: the corruption fixture left zero residue`);
  }

  await corrupted('missing Home', [['DELETE FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]]]);
  await corrupted('missing ThreadEstablished event', [['DELETE FROM public.conversation_thread_establishment_events WHERE thread_id=$1', [thread]]]);
  await corrupted('missing evidence row', [['DELETE FROM public.conversation_thread_establishment_evidence WHERE thread_id=$1 AND evidence_ordinal=0', [thread]]]);
  await corrupted('missing ESTABLISHING_CU evidence role', [["UPDATE public.conversation_thread_establishment_evidence SET evidence_role='PRIOR_EVIDENCE' WHERE thread_id=$1 AND evidence_role='ESTABLISHING_CU'", [thread]]]);
  await corrupted('evidence naming the wrong CU', [['UPDATE public.conversation_thread_establishment_evidence SET cu_id=$2, cu_sp=$3 WHERE thread_id=$1 AND evidence_ordinal=0', [thread, decoyCu, 1]]]);
  await corrupted('evidence in the wrong order', [
    ["UPDATE public.conversation_thread_establishment_evidence SET evidence_role='PRIOR_EVIDENCE' WHERE thread_id=$1 AND evidence_ordinal=1", [thread]],
    ["UPDATE public.conversation_thread_establishment_evidence SET evidence_role='ESTABLISHING_CU' WHERE thread_id=$1 AND evidence_ordinal=0", [thread]]]);
  await corrupted('missing RESOLVED origin member', [['DELETE FROM public.conversation_thread_origin_members WHERE thread_id=$1', [thread]]]);
  await corrupted('event Home Anchor mismatch', [['UPDATE public.conversation_thread_establishment_events SET home_anchor_id=$2 WHERE thread_id=$1', [thread, homeAnchorIdOf(randomUUID())]]]);
  await corrupted('event SP mismatch', [['UPDATE public.conversation_thread_establishment_events SET session_position=$2 WHERE thread_id=$1', [thread, priorSp.sp]]]);
  // A same-SP sequence other than 2 is not merely classified PARTIAL: it is
  // structurally unrepresentable on all three canonical tables, even with the
  // append-only and referential triggers suspended.
  for (const [table, column, key] of [
    ['conversation_thread_establishment_events', 'same_sp_event_sequence', 'thread_id'],
    ['conversation_threads', 'established_event_sequence', 'id'],
    ['conversation_thread_homes', 'established_event_sequence', 'thread_id']]) {
    await q('SAVEPOINT seq');
    await q("SET session_replication_role = 'replica'");
    await rejected(() => q(`UPDATE public.${table} SET ${column}=3 WHERE ${key}=$1`, [thread]),
      'violates check constraint', ['23514']);
    await q("SET session_replication_role = 'origin'");
    await q('ROLLBACK TO SAVEPOINT seq');
    await q('RELEASE SAVEPOINT seq');
  }
  await corrupted('event focus mismatch', [['UPDATE public.conversation_thread_establishment_events SET emerging_focus_id=$2 WHERE thread_id=$1', [thread, decoyFocus]]]);
  await corrupted('event path mismatch', [["UPDATE public.conversation_thread_establishment_events SET establishment_path='TE-03' WHERE thread_id=$1", [thread]]]);
  await corrupted('Thread lineage rewritten to another focus (identity no longer derivable)', [
    ['UPDATE public.conversation_threads SET grounding_emerging_focus_id=$2 WHERE id=$1', [thread, driftFocus]],
    ['UPDATE public.conversation_thread_establishment_events SET emerging_focus_id=$2 WHERE thread_id=$1', [thread, driftFocus]]]);
  await corrupted('extra durable establishment beyond establishment_count', [
    ['UPDATE public.conversation_threads SET established_cu_id=$2 WHERE id=$1', [decoyThread, cu]],
    ['UPDATE public.conversation_thread_homes SET established_cu_id=$2 WHERE thread_id=$1', [decoyThread, cu]]]);

  // MULTIPLE stored with only one member: a second establishment, then a member removed.
  const fourth = await completedTurns(owner, session);
  const multiCu = randomUUID();
  const multiA = randomUUID();
  const multiFocus = randomUUID();
  const multiHandle = randomUUID();
  const multiBatch = randomUUID();
  const multiThread = threadIdOf(owner, multiFocus);
  const members = [decoyThread, thread].sort();
  const multiUnits = [unit(USER_TEXT, U1, 1, multiCu)];
  const multiBundles = [bundle(multiCu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', multiHandle, true)], attention: startFocus(multiFocus, 0) })];
  const multiThreads = [establish(owner, multiCu, multiFocus, 'TE-01', [multiCu],
    { explicit_selection_grounding: anchor(U1, 'المدير'), origin_state: 'MULTIPLE', origin_thread_ids: members })];
  const t4 = await tokenFor(session);
  await exchange(session, owner, fourth.userTurn, multiBatch, multiUnits, multiBundles, multiThreads,
    fourth.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, multiA)],
    [bundle(multiA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: multiCu, references: [], attention: NO_FOCUS })],
    [noEstablishment(multiA, 'NO_INDEPENDENT_FOCUS')], t4);
  const multiState = async () =>
    (await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, fourth.userTurn, multiBatch]))[0].s;
  strict(await multiState(), 'COMPLETE', 'a MULTIPLE-origin establishment with both members is COMPLETE');
  await q('SAVEPOINT multi');
  await q("SET session_replication_role = 'replica'");
  await q('DELETE FROM public.conversation_thread_origin_members WHERE thread_id=$1 AND origin_member_ordinal=1', [multiThread]);
  await q("SET session_replication_role = 'origin'");
  strict(await multiState(), 'PARTIAL', 'MULTIPLE with only one stored member is PARTIAL');
  await rejected(() => commit(session, owner, fourth.userTurn, multiBatch, multiUnits, multiBundles, multiThreads),
    'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);
  await q('ROLLBACK TO SAVEPOINT multi');
  await q('RELEASE SAVEPOINT multi');
  strict(await multiState(), 'COMPLETE', 'the MULTIPLE corruption fixture left zero residue');

  // Stored evidence / origin that no longer match the canonical payload cannot
  // pass as an exact replay even when every structural rule still holds.
  await q('SAVEPOINT swapped');
  await q("SET session_replication_role = 'replica'");
  await q('UPDATE public.conversation_thread_origin_members SET origin_thread_id=$2 WHERE thread_id=$1 AND origin_member_ordinal=0', [thread, multiThread]);
  await q("SET session_replication_role = 'origin'");
  await rejected(() => replay(), 'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);
  await q('ROLLBACK TO SAVEPOINT swapped');
  await q('RELEASE SAVEPOINT swapped');

  // A NO-establishment batch and a zero-CU batch are COMPLETE, not absent.
  const fifth = await completedTurns(owner, session);
  const noneCu = randomUUID();
  const noneBatch = randomUUID();
  await commit(session, owner, fifth.userTurn, noneBatch, [unit(USER_TEXT, U1, 1, noneCu)],
    [bundle(noneCu, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })],
    [noEstablishment(noneCu, 'NO_INDEPENDENT_FOCUS')]);
  strict((await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, fifth.userTurn, noneBatch]))[0].s,
    'COMPLETE', 'a nonzero batch that established nothing is COMPLETE, not absent');
  const zeroBatch = randomUUID();
  await commit(session, owner, fifth.assistantTurn, zeroBatch, [], [], []);
  strict((await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, fifth.assistantTurn, zeroBatch]))[0].s,
    'COMPLETE', 'a zero-CU capture batch is COMPLETE and carries no SP or B2 row');
  strict((await rows('SELECT public.conversation_thread_batch_state_v1($1,$2,$3,$4) s', [session, owner, fifth.assistantTurn, randomUUID()]))[0].s,
    'ABSENT', 'an unknown batch is ABSENT');
}

/** The current optimistic clock token of a Session. */
async function tokenFor(session) {
  const clock = await clockOf(session);
  return { sp: clock.current_sp, seq: Number(clock.same_sp_event_sequence) };
}

// ============================== H. replay / conflict / partial state / zero-CU
async function verifyReplayAndAtomicity(owner) {
  stage = 'H. replay, conflict, partial state, zero-CU and atomic rollback';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const cu = randomUUID();
  const cuA = randomUUID();
  const handle = randomUUID();
  const focus = randomUUID();
  const thread = threadIdOf(owner, focus);
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const userUnits = [unit(USER_TEXT, U1, 1, cu)];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, cuA)];
  const userBundles = [bundle(cu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })];
  const assistantBundles = [bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS })];
  const userThreads = [establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير') })];
  const assistantThreads = [noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')];
  const run = (threads, token = FRESH_TOKEN) => exchange(session, owner, turns.userTurn, userBatch, userUnits, userBundles, threads,
    turns.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, token);

  // --- atomic rollback: the failure of a LATER CU rolls back the whole batch,
  //     including an establishment that already inserted its Thread, Home,
  //     event, evidence and origin rows.
  const poisonCu = randomUUID();
  await rejected(() => exchange(session, owner, turns.userTurn, userBatch, [...userUnits, unit(USER_TEXT, U2, 1, poisonCu)],
    [...userBundles, bundle(poisonCu, { sequence_position: 'FOLLOW_UP', target_cu_id: cu, references: [], attention: NO_FOCUS })],
    [...userThreads, noEstablishment(poisonCu, 'ALREADY_ESTABLISHED', randomUUID())],
    turns.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, FRESH_TOKEN),
    'THREAD_NO_ESTABLISHMENT_MISMATCH');
  const [{ total: strandedThreads }] = await rows('SELECT count(*)::int total FROM public.conversation_threads WHERE established_session_id=$1', [session]);
  strict(strandedThreads, 0, 'the establishment of the FIRST CU rolled back with the failure of a later CU: no orphan Thread');
  const [{ total: strandedHomes }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_homes WHERE established_session_id=$1', [session]);
  strict(strandedHomes, 0, 'no orphan Home survives');
  const [{ total: strandedEvents }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_establishment_events WHERE session_id=$1', [session]);
  strict(strandedEvents, 0, 'no orphan establishment event, evidence or origin row survives');
  const [{ total: strandedCapture }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_commit_batches WHERE commit_batch_id=$1', [userBatch]);
  strict(strandedCapture, 0, 'the Thread capture batch of the rejected transaction is rolled back too');
  const [{ total: rolledBack }] = await rows('SELECT count(*)::int total FROM public.conversation_units WHERE session_id=$1', [session]);
  strict(rolledBack, 0, 'a rejected integrated batch leaves no committed CU behind');
  const emptyClock = await clockOf(session);
  eq([emptyClock.current_sp, Number(emptyClock.same_sp_event_sequence)], [null, 0], 'no SP and no same-SP sequence was consumed by the rejected batch');

  // --- injection after the world lock and the placement: a Thread id that
  //     collides with an already-canonical Thread fails at the Thread insert.
  const [firstRun] = await run(userThreads);
  strict(firstRun.live_head, 2, 'the batch committed SP1 and SP2');
  const beforeConflict = await worldSnapshot(owner);

  const secondSession = await newSession(owner);
  const secondTurns = await completedTurns(owner, secondSession);
  const cu2 = randomUUID();
  const cuA2 = randomUUID();
  const handle2 = randomUUID();
  const focus2 = randomUUID();
  const start2 = bundle(cu2, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle2, true)], attention: startFocus(focus2, 0) });
  const idle2 = bundle(cuA2, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu2, references: [], attention: NO_FOCUS });
  const thread2 = threadIdOf(owner, focus2);
  const runInjected = (overrides = {}) => exchange(secondSession, owner, secondTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, cu2)], [start2],
    [establish(owner, cu2, focus2, 'TE-01', [cu2], { explicit_selection_grounding: anchor(U1, 'المدير'), ...overrides })],
    secondTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, cuA2)], [idle2], [noEstablishment(cuA2, 'NO_INDEPENDENT_FOCUS')], FRESH_TOKEN);
  /**
   * Since FIX-T03B2B2-01 the identities are DERIVED, so a failure can no longer
   * be injected by handing the writer a wrong id. Instead the collision is
   * seeded in advance, with the append-only and referential triggers suspended,
   * so the real establishment fails at exactly one stage of the persistence.
   */
  async function injectedAt(label, statements, token, codes, overrides = {}) {
    assertions += 1;
    await q('SAVEPOINT injected');
    let error;
    try {
      await q("SET session_replication_role = 'replica'");
      for (const [text, values] of statements) await q(text, values);
      await q("SET session_replication_role = 'origin'");
      try { await runInjected(overrides); } catch (caught) { error = caught; }
    } finally {
      await q("SET session_replication_role = 'origin'").catch(() => undefined);
      await q('ROLLBACK TO SAVEPOINT injected');
      await q('RELEASE SAVEPOINT injected');
    }
    assert.ok(error, `${label}: the injected failure did not fire`);
    assert.ok(codes.includes(error.code), `${label}: unexpected SQLSTATE ${error.code}: ${error.message}`);
    assert.ok(String(error.message).includes(token), `${label}: expected ${token}, got ${error.message}`);
  }
  // ... under the world lock, inside the placement itself: a Thread already
  //     present in the committed world is never placed a second time;
  await injectedAt('after the world lock, inside the placement',
    [['UPDATE public.conversation_thread_homes SET thread_id=$2 WHERE thread_id=$1', [thread, thread2]]],
    'THREAD_ALREADY_PLACED', ['22023']);
  // ... after the Thread insert, at the Home insert;
  await injectedAt('after the Thread insert, at the Home insert',
    [['UPDATE public.conversation_thread_homes SET home_anchor_id=$2 WHERE thread_id=$1', [thread, homeAnchorIdOf(thread2)]]],
    'duplicate key', ['23505']);
  // ... after the Thread and Home inserts, at the establishment event;
  await injectedAt('after the Thread and Home inserts, at the event',
    [['UPDATE public.conversation_thread_establishment_events SET event_id=$2 WHERE thread_id=$1', [thread, eventIdOf(thread2)]]],
    'duplicate key', ['23505']);
  // ... and after the evidence insert, at the Conversational Origin provenance.
  await injectedAt('after the evidence insert, at the origin provenance',
    [['INSERT INTO public.conversation_thread_origin_members (thread_id, origin_member_ordinal, origin_thread_id) VALUES ($1, 0, $2)', [thread2, thread]]],
    'duplicate key', ['23505'], { origin_state: 'RESOLVED', origin_thread_ids: [thread] });
  eq(await worldSnapshot(owner), beforeConflict, 'every injected failure rolled back the whole B2 layer, leaving the committed world untouched');
  const [{ total: strandedCus }] = await rows('SELECT count(*)::int total FROM public.conversation_units WHERE session_id=$1', [secondSession]);
  strict(strandedCus, 0, 'no orphan CU, Thread or Home survives a failed establishment');
  const injectedClock = await clockOf(secondSession);
  eq([injectedClock.current_sp, Number(injectedClock.same_sp_event_sequence)], [null, 0], 'no same-SP sequence 2 is consumed after a rollback');

  // --- exact replay: identical payload, zero mutation, zero new rows.
  const before = await worldSnapshot(owner);
  const [{ total: seqBefore }] = await rows('SELECT same_sp_event_sequence total FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
  const [replayed] = await run(userThreads);
  strict(replayed.live_head, 2, 'exact replay returns the stored canonical state');
  eq(await worldSnapshot(owner), before, 'exact replay mutates nothing at all');
  const [{ total: seqAfter }] = await rows('SELECT same_sp_event_sequence total FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
  strict(String(seqAfter), String(seqBefore), 'exact replay consumes no same-SP sequence');

  // --- payload conflict: any changed B2 element fails closed.
  for (const [label, threads] of [
    ['a changed decision', [noEstablishment(cu, 'NO_PROMOTION_PATH_PROVEN', focus)]],
    ['a changed path', [establish(owner, cu, focus, 'TE-02', [cu], { explicit_selection_grounding: anchor(U1, 'المدير') })]],
    ['a changed grounding', [establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'بيتعامل') })]],
    ['a changed origin', [establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير'), origin_state: 'RESOLVED', origin_thread_ids: [thread] })]],
  ]) {
    await rejected(() => run(threads), 'THREAD_BATCH_PAYLOAD_CONFLICT', ['22023']);
    ok(true, `${label} is refused as a Thread capture conflict`);
  }
  await rejected(() => rows('SELECT * FROM commit_finalized_exchange_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)',
    [session, owner, turns.userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads),
      turns.assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads),
      ...PROVENANCE, ...FOCUS_PROVENANCE, 'thread-establishment-evaluator-v2', ...THREAD_PROVENANCE.slice(1), FRESH_TOKEN.sp, FRESH_TOKEN.seq]),
    'THREAD_BATCH_PAYLOAD_CONFLICT');

  // --- partial / legacy state: CU + B1 without a B2 capture is never upgraded.
  const legacySession = await newSession(owner);
  const legacyTurns = await completedTurns(owner, legacySession);
  const legacyCu = randomUUID();
  const legacyBatch = randomUUID();
  const legacyUnits = [unit(USER_TEXT, U1, 1, legacyCu)];
  const legacyBundles = [bundle(legacyCu, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })];
  await rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [legacySession, owner, legacyTurns.userTurn, legacyBatch, JSON.stringify(legacyUnits), ...PROVENANCE, JSON.stringify(legacyBundles), ...FOCUS_PROVENANCE]);
  await rejected(() => commit(legacySession, owner, legacyTurns.userTurn, legacyBatch, legacyUnits, legacyBundles, [noEstablishment(legacyCu, 'NO_INDEPENDENT_FOCUS')]),
    'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);
  const [{ total: notUpgraded }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_commit_batches WHERE commit_batch_id=$1', [legacyBatch]);
  strict(notUpgraded, 0, 'partial legacy state is never backfilled into a B2 capture');
  // A T-03A2-only legacy batch is likewise never completed.
  const a2Batch = randomUUID();
  const a2Turns = await completedTurns(owner, legacySession);
  const a2Cu = randomUUID();
  const a2Units = [unit(USER_TEXT, U1, 1, a2Cu)];
  await rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',
    [legacySession, owner, a2Turns.userTurn, a2Batch, JSON.stringify(a2Units), ...PROVENANCE]);
  await rejected(() => commit(legacySession, owner, a2Turns.userTurn, a2Batch, a2Units,
    [bundle(a2Cu, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })], [noEstablishment(a2Cu, 'NO_INDEPENDENT_FOCUS')]),
    'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);

  // --- the zero-CU batch is a complete evaluation batch.
  const zeroSession = await newSession(owner);
  const zeroTurns = await completedTurns(owner, zeroSession);
  const zeroBatch = randomUUID();
  await commit(zeroSession, owner, zeroTurns.userTurn, zeroBatch, [], [], []);
  const [zero] = await rows('SELECT unit_count u, establishment_count e FROM public.conversation_thread_commit_batches WHERE commit_batch_id=$1', [zeroBatch]);
  eq([zero.u, zero.e], [0, 0], 'a zero-CU batch records that B2 evaluated and established nothing');
  const zeroClock = await clockOf(zeroSession);
  eq([zeroClock.current_sp, Number(zeroClock.same_sp_event_sequence)], [null, 0], 'a zero-CU batch allocates no SP and no same-SP sequence');
  const [{ total: zeroThreads }] = await rows('SELECT count(*)::int total FROM public.conversation_thread_establishment_events WHERE commit_batch_id=$1', [zeroBatch]);
  strict(zeroThreads, 0, 'a zero-CU batch establishes nothing');

  // --- one exchange half complete and the other absent fails closed at the
  //     half-state gate, BEFORE either writer and regardless of the payload.
  //     The identical-payload / current-token form of this case is proven in
  //     full by the finalized-exchange half-state stage above.
  const halfSession = await newSession(owner);
  const halfTurns = await completedTurns(owner, halfSession);
  const halfUserBatch = randomUUID();
  const halfCu = randomUUID();
  const halfA = randomUUID();
  const halfUnits = [unit(USER_TEXT, U1, 1, halfCu)];
  const halfBundles = [bundle(halfCu, { sequence_position: 'INITIATING', references: [], attention: NO_FOCUS })];
  await commit(halfSession, owner, halfTurns.userTurn, halfUserBatch, halfUnits, halfBundles, [noEstablishment(halfCu, 'NO_INDEPENDENT_FOCUS')]);
  const halfClock = await clockOf(halfSession);
  const halfToken = { sp: halfClock.current_sp, seq: Number(halfClock.same_sp_event_sequence) };
  await rejected(() => exchange(halfSession, owner, halfTurns.userTurn, halfUserBatch, halfUnits, halfBundles, [noEstablishment(halfCu, 'ALREADY_ESTABLISHED', randomUUID())],
    halfTurns.assistantTurn, randomUUID(), [unit(ASSISTANT_TEXT, A1, 1, halfA)],
    [bundle(halfA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', references: [], attention: NO_FOCUS })],
    [noEstablishment(halfA, 'NO_INDEPENDENT_FOCUS')], halfToken),
    'THREAD_CAPTURE_BATCH_INTEGRITY', ['55000']);
  const [{ total: halfAssistant }] = await rows('SELECT count(*)::int total FROM public.conversation_units WHERE source_turn_id=$1', [halfTurns.assistantTurn]);
  strict(halfAssistant, 0, 'the second half is never finished from a conflicting first half');
}

// ================================================= I. concurrency (two clients)
async function verifyConcurrency() {
  stage = 'I. per-user-world serialization of concurrent Home allocation';
  const owner = randomUUID();
  const sessionA = randomUUID();
  const sessionB = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const created = [];
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    for (const session of [sessionA, sessionB]) {
      await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
    }
    const fixtures = [];
    for (const session of [sessionA, sessionB]) {
      const userTurn = randomUUID();
      const assistantTurn = randomUUID();
      await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id) VALUES($1,$2,$3,'USER','COMPLETED',$4,NULL)", [userTurn, session, owner, USER_TEXT]);
      await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id) VALUES($1,$2,$3,'ASSISTANT','COMPLETED',$4,$5)", [assistantTurn, session, owner, ASSISTANT_TEXT, userTurn]);
      const cu = randomUUID();
      const cuA = randomUUID();
      const handle = randomUUID();
      const focus = randomUUID();
      fixtures.push({ session, userTurn, assistantTurn, cu, cuA, focus, thread: threadIdOf(owner, focus),
        args: [session, owner, userTurn, randomUUID(), JSON.stringify([unit(USER_TEXT, U1, 1, cu)]),
          JSON.stringify([bundle(cu, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })]),
          JSON.stringify([establish(owner, cu, focus, 'TE-01', [cu], { explicit_selection_grounding: anchor(U1, 'المدير') })]),
          assistantTurn, randomUUID(), JSON.stringify([unit(ASSISTANT_TEXT, A1, 1, cuA)]),
          JSON.stringify([bundle(cuA, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu, references: [], attention: NO_FOCUS })]),
          JSON.stringify([noEstablishment(cuA, 'NO_INDEPENDENT_FOCUS')]),
          ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, null, 0] });
      created.push(session);
    }
    await clientA.connect(); await clientB.connect();
    const EXCHANGE = 'SELECT * FROM commit_finalized_exchange_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)';

    // Two DIFFERENT Sessions of the SAME user establish concurrently: the
    // Session clocks do not collide, so the user-world row is what serializes.
    await clientA.query('BEGIN');
    await clientA.query(EXCHANGE, fixtures[0].args);
    const pending = clientB.query(EXCHANGE, fixtures[1].args);
    pending.catch(() => undefined);
    const raced = await Promise.race([
      pending.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    strict(raced, 'BLOCKED', 'the concurrent establishment blocks on the user-world spatial authority');
    await clientA.query('COMMIT');
    await pending;
    const homes = (await q('SELECT thread_id, placement_x x, placement_y y, encode(world_fingerprint,\'hex\') f FROM public.conversation_thread_homes WHERE user_id=$1 ORDER BY created_at', [owner])).rows;
    strict(homes.length, 2, 'both concurrent establishments received a permanent Home');
    ok(homes[0].x !== homes[1].x || homes[0].y !== homes[1].y, 'no duplicate Home was allocated under contention');
    const winner = homes.find((h) => h.thread_id === fixtures[0].thread);
    const loser = homes.find((h) => h.thread_id === fixtures[1].thread);
    strict(winner.f, 'd4fc7423a008557724175d0b3847085affc44eeb1fafa5c14fb78d888ec7784a', 'the winner placed against the empty world');
    ok(loser.f !== winner.f, 'the loser recomputed its placement against the winner-inclusive world, not a stale pre-lock world');
    const [expected] = (await q('SELECT s.placement_x x, s.placement_y y FROM public.compute_canonical_home_placement_v1($1,$2,$3,$4::text[],$5::text[],$6::numeric[],$7::numeric[]) s',
      [owner, fixtures[1].thread, 'NONE', [], [winner.thread_id], [winner.x], [winner.y]])).rows;
    eq([loser.x, loser.y], [expected.x, expected.y], 'the loser placed exactly where the engine places against the winner-inclusive world');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
    await q("SET session_replication_role = 'replica'").catch(() => undefined);
    await q(`DELETE FROM public.conversation_thread_origin_members m USING public.conversation_threads t WHERE t.id = m.thread_id AND t.user_id=$1`, [owner]).catch(() => undefined);
    for (const table of ['conversation_thread_establishment_evidence', 'conversation_thread_establishment_events',
      'conversation_thread_homes', 'conversation_threads']) {
      await q(`DELETE FROM public.${table} WHERE user_id=$1`, [owner]).catch(() => undefined);
    }
    await q('DELETE FROM public.conversation_world_spatial_authorities WHERE user_id=$1', [owner]).catch(() => undefined);
    for (const session of created) {
      for (const table of ['conversation_thread_commit_batches', 'conversation_emerging_focus_attention_events', 'conversation_emerging_focuses',
        'conversation_claim_attributions', 'conversation_reference_resolution_candidates', 'conversation_reference_resolutions',
        'conversation_reference_handles', 'conversation_unit_focus_semantics', 'conversation_focus_commit_batches',
        'conversation_unit_commit_events', 'conversation_units', 'conversation_unit_commit_batches',
        'session_semantic_clocks', 'conversation_turns']) {
        await q(`DELETE FROM public.${table} WHERE session_id=$1`, [session]).catch(() => undefined);
      }
      await q('DELETE FROM public.conversation_sessions WHERE id=$1', [session]).catch(() => undefined);
    }
    await q('DELETE FROM public.users WHERE id=$1', [owner]).catch(() => undefined);
    await q('DELETE FROM auth.users WHERE id=$1', [owner]).catch(() => undefined);
    await q("SET session_replication_role = 'origin'").catch(() => undefined);
    const [{ count: residue }] = (await q('SELECT count(*) count FROM public.conversation_threads WHERE user_id=$1', [owner])).rows;
    strict(Number(residue), 0, 'the concurrency proof left zero fixture residue');
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
      await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
      await verifyOsdapParity();
      await verifyIdentityAuthority();
      const populated = await verifyIntegratedMoment(owner);
      await verifyPermanence(owner, populated);
      await verifyEstablishmentGates(owner);
      await verifyRecurrenceAndSelection(owner);
      await verifyOriginProvenance(owner, populated);
      await verifyIdentityEnforcement();
      await verifyExchangeHalfStates();
      await verifyStructuralCompleteness();
      await verifyReplayAndAtomicity(owner);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrency();
    console.log(`Verified migration 0068 (${assertions} assertions): the per-Moment integrated writer allocates each SP, opens it as the head, persists T-03B1 at same-SP sequence 1 and, only for a proven establishment, locks this user's world, recomputes the canonical QANDEEL_OSDAP_V1 Home against the world as it actually stands, reserves sequence 2 through the one T-03A2 seam and inserts the Thread, its permanent one-to-one Home, the explicit ThreadEstablished event, its evidence and its symmetric Conversational Origin provenance atomically; SQL/TypeScript placement parity on all seven frozen golden vectors plus negative floor division, projection, dense escalation, exact separation, bound skip and capacity exhaustion; the database's OWN RFC 4122 version-5 identity authority reproducing the frozen SHA-1, namespaces and vectors, refusing every valid-but-wrong Thread, Home or event identity before the world lock, and feeding OSDAP only the derived Thread; AF66-01 with the world lock strictly after the Session clock; user/world-scoped Thread identity with an immutable EmergingFocus lineage and no relocation path; the deterministic TE-01/02/03 gates and the three NO_ESTABLISHMENT states re-proved by the database; the finalized-exchange half-state gate classifying BOTH halves ABSENT / COMPLETE / PARTIAL before either writer so an asymmetric exchange can never be finished; full structural completeness over evidence, Conversational Origin provenance and Thread/Home/event coherence, with every corruption fixture failing replay closed and classifying the half PARTIAL; exact replay, payload conflict, legacy state failing closed, the zero-CU batch, atomic rollback with no consumed sequence; per-user-world serialization of concurrent placement; and the production-inert posture with untouched T-03A2 authority and zero fixture residue.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Durable Thread / permanent Home substrate verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
