// Real-PostgreSQL verifier for migration 0070 - Thread Lifecycle +
// Cross-Session Continuity v1 (Active / Dormant / Reopened).
//
// Proves against live semantics, never grep alone: the append-only schema and
// production-inert privileges; focus -> Thread bindings (establishment, later
// Session continuity, no rebind, one per Thread per Session, the original
// grounding focus immutable); source-grounded identity evidence (canonical
// RESOLVED B1 grounding only, exact surfaces, wrong user / session / handle
// refused); cross-Session continuity (same Thread + same Home reused, no
// second placement, same-name ambiguity blocks a duplicate Thread, a
// distinct relational focus stays distinct, an out-of-dossier or unknown
// Thread refused); the user/world Thread Identity Clock (advances on a new
// Thread and on a new continuity binding, never on lifecycle alone, exact
// stale token 40001, Session clock locked first); the Session-local lifecycle
// (ACTIVE baseline through the binding, explicit-shift and sustained-departure
// dormancy, no backdating, brief clarification stays active, DORMANT ->
// REOPENED, REOPENED -> ACTIVE, REOPENED -> DORMANT, impossible transitions
// refused, background analysis cannot touch it); the same-SP rule (B1 seq 1,
// one Thread-layer seq 2, shared by several rows, seq 3 next); replay,
// partial and corruption shapes; and atomic rollback after every stage.
// Every fixture is rolled back.
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
/** Runs `operation` in a savepoint that is always rolled back, returning its value or its error. */
async function isolated(operation) {
  await q('SAVEPOINT iso');
  try { return { value: await operation() }; } catch (error) { return { error }; } finally {
    await q('ROLLBACK TO SAVEPOINT iso'); await q('RELEASE SAVEPOINT iso');
  }
}

// --------------------------------------------------------------- signatures
const WRITER = 'public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)';
const COORDINATOR = 'public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)';
const VALIDATOR = 'public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb)';
const PERSIST = 'public.persist_conversation_thread_lifecycle_layer_v1(public.conversation_units,uuid,jsonb,bigint)';
const REDUCER = 'public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units)';
const RELATION = 'public.conversation_thread_cu_relation_v1(uuid,uuid)';
const STATE = 'public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer)';
const ESTABLISHMENT_EVIDENCE = 'public.derive_conversation_thread_establishment_identity_evidence_v1(public.conversation_units,jsonb)';
const BINDING_ID = 'public.canonical_thread_focus_binding_id_v1(uuid,uuid,uuid)';
const EVENT_ID = 'public.canonical_thread_lifecycle_event_id_v1(uuid,uuid,uuid,text)';
const SEMANTIC_STATE = 'public.conversation_thread_semantic_batch_state_v1(uuid,uuid,uuid,uuid)';
const DOSSIER_PAGE = 'public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)';
const LIFECYCLE_CONTEXT = 'public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)';
const LIFECYCLE_SNAPSHOT = 'public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const READINESS_AUDIT = 'public.assert_conversation_thread_lifecycle_cutover_ready_v1()';
const THREAD_WRITER = 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
const THREAD_COORDINATOR = 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
const THREAD_SNAPSHOT = 'public.get_conversation_focus_thread_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const THREAD_CONTEXT = 'public.get_conversation_focus_thread_runtime_context_v1(uuid,uuid)';
const THREAD_AUDIT = 'public.assert_conversation_thread_capture_cutover_ready_v1()';
const BATCH_STATE = 'public.conversation_thread_batch_state_v1(uuid,uuid,uuid,uuid)';
const FOCUS_WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const FOCUS_COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const LEGACY_PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const LIFECYCLE_TABLES = [
  'conversation_world_thread_identity_clocks', 'conversation_thread_focus_bindings', 'conversation_thread_identity_evidence',
  'conversation_thread_lifecycle_events', 'conversation_thread_semantic_commit_batches', 'conversation_thread_semantic_unit_results'];
const THREAD_TABLES = [
  'conversation_world_spatial_authorities', 'conversation_threads', 'conversation_thread_homes',
  'conversation_thread_establishment_events', 'conversation_thread_establishment_evidence',
  'conversation_thread_origin_members', 'conversation_thread_commit_batches'];

const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// ---------------------------------------------- canonical identity vectors
// The exact derivations of durable-thread-canonicalizer.ts and
// durable-thread-lifecycle-canonicalizer.ts.
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
const BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1');
const LIFECYCLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const bindingIdOf = (sessionId, focusId, threadId) => uuidV5(BINDING_NAMESPACE, `${sessionId}:${focusId}:${threadId}`);
const eventIdOf = (sessionId, cuId, threadId, toState) => uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ------------------------------------------------------- the shared scenario
// Session 1 (Egyptian Arabic): the manager (CU1, explicit selection), an
// incidental Ahmed mention inside a reported claim (CU2), Ahmed as a direct
// concern (CU3, explicit selection, manager as RESOLVED Origin); the
// assistant attends Ahmed twice. Later Sessions return to Ahmed, or name an
// ambiguous Ahmed, or reframe the relationship with Ahmed.
const USER_TEXT = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد اللي في الفريق قالّي إن الموضوع ده عادي. أحمد نفسه بدأ يقلقني.';
const ASSISTANT_TEXT = 'تقصد إن أحمد بيتجنبك؟ وإمتى ده بدأ؟';
const U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const U2 = 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.';
const U3 = 'أحمد نفسه بدأ يقلقني.';
const A1 = 'تقصد إن أحمد بيتجنبك؟';
const A2 = 'وإمتى ده بدأ؟';
const RETURN_TEXT = 'عايز أرجع لأحمد بتاع الشغل.';
const RETURN_REPLY = 'تمام، نرجع لأحمد.';
const AMBIGUOUS_TEXT = 'عايز أتكلم عن أحمد.';
const AMBIGUOUS_REPLY = 'أحمد مين تقصد؟';
const RELATION_TEXT = 'المشكلة مش أحمد كشخص؛ أنا عايز أتكلم عن علاقتي بأحمد نفسها.';
const RELATION_REPLY = 'تمام، نتكلم عن العلاقة.';

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
    home_anchor_id: uuidV5(HOME_ANCHOR_NAMESPACE, threadId),
    thread_established_event_id: uuidV5(THREAD_EVENT_NAMESPACE, threadId),
    evidence: evidenceCuIds.map((cuId, index) => ({
      evidence_ordinal: index, cu_id: cuId,
      evidence_role: index === evidenceCuIds.length - 1 ? 'ESTABLISHING_CU' : 'PRIOR_EVIDENCE',
    })),
    explicit_selection_grounding: overrides.explicit_selection_grounding ?? null,
    origin_state: overrides.origin_state ?? 'NONE',
    origin_thread_ids: [...(overrides.origin_thread_ids ?? [])].sort(byText),
  };
};

// --------------------------------------------- the canonical B3 payloads
const transition = (session, cuId, threadId, toState, reasonCode) =>
  ({ thread_id: threadId, to_state: toState, reason_code: reasonCode, lifecycle_event_id: eventIdOf(session, cuId, threadId, toState) });
const sortTransitions = (transitions) => [...transitions].sort((a, b) => byText(a.thread_id, b.thread_id));
const lifecycle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  outcome: overrides.outcome ?? 'NO_THREAD_ACTION',
  emerging_focus_id: overrides.emerging_focus_id ?? null,
  thread_id: overrides.thread_id ?? null,
  binding_kind: overrides.binding_kind ?? null,
  focus_binding_id: overrides.focus_binding_id ?? null,
  identity_evidence: overrides.identity_evidence ?? [],
  prior_identity_evidence: overrides.prior_identity_evidence ?? [],
  candidate_thread_ids: [...(overrides.candidate_thread_ids ?? [])].sort(byText),
  lifecycle_transitions: sortTransitions(overrides.lifecycle_transitions ?? []),
});
const establishNew = (session, unitId, focusId, threadId, evidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ESTABLISH_NEW', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'ESTABLISHMENT',
  focus_binding_id: bindingIdOf(session, focusId, threadId), identity_evidence: evidence, lifecycle_transitions: transitions,
});
const activateExisting = (session, unitId, focusId, threadId, evidence, priorEvidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ACTIVATE_EXISTING_IN_SESSION', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'SESSION_CONTINUITY',
  focus_binding_id: bindingIdOf(session, focusId, threadId), identity_evidence: evidence, prior_identity_evidence: priorEvidence,
  lifecycle_transitions: transitions,
});
const attendExisting = (unitId, focusId, threadId, transitions = []) => lifecycle(unitId, {
  outcome: 'ATTEND_EXISTING', emerging_focus_id: focusId, thread_id: threadId, lifecycle_transitions: transitions,
});
const reopenExisting = (session, unitId, focusId, threadId, others = []) => lifecycle(unitId, {
  outcome: 'REOPEN_EXISTING', emerging_focus_id: focusId, thread_id: threadId,
  lifecycle_transitions: [transition(session, unitId, threadId, 'REOPENED', 'GENUINE_RETURN'), ...others],
});
const ambiguous = (unitId, focusId, candidates, transitions = []) => lifecycle(unitId, {
  outcome: 'IDENTITY_AMBIGUOUS', emerging_focus_id: focusId, candidate_thread_ids: candidates, lifecycle_transitions: transitions,
});
const noAction = (unitId, focusId = null, transitions = []) => lifecycle(unitId, { emerging_focus_id: focusId, lifecycle_transitions: transitions });

const exchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_focus_thread_lifecycle_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
    $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)`,
  [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads), JSON.stringify(userLifecycle),
    assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads), JSON.stringify(assistantLifecycle),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, token.sp, token.seq, token.version]);
const writer = (session, user, turn, batch, units, bundles, threads, lifecycles) =>
  rows(`SELECT * FROM commit_conversation_units_with_focus_thread_lifecycle_v1(
    $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32)`,
  [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE,
    JSON.stringify(threads), ...THREAD_PROVENANCE, JSON.stringify(lifecycles), ...CONTINUITY_PROVENANCE]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)', [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const focusOnlyCommit = (session, user, turn, batch, units, bundles) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE]);
const b2OnlyExchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads) =>
  rows('SELECT * FROM commit_finalized_exchange_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads),
      assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads),
      ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, null, 0]);

const snapshot = async (session, user, turn, batch) =>
  (await rows('SELECT * FROM get_conversation_thread_lifecycle_integrated_batch_snapshot_v1($1,$2,$3,$4)', [session, user, turn, batch]))[0];
const runtimeContext = async (session, user) =>
  (await rows('SELECT * FROM get_conversation_thread_lifecycle_runtime_context_v1($1,$2)', [session, user]))[0];
const dossierPage = (user, version, after, limit) =>
  rows('SELECT * FROM get_conversation_thread_identity_dossier_page_v1($1,$2,$3,$4)', [user, version, after, limit]);
const semanticState = async (session, user, turn, batch) =>
  (await rows('SELECT public.conversation_thread_semantic_batch_state_v1($1,$2,$3,$4) state', [session, user, turn, batch]))[0].state;
const lifecycleState = async (thread, session, before = null) =>
  (await rows('SELECT public.conversation_thread_session_lifecycle_state_v1($1,$2,$3) state', [thread, session, before]))[0].state;
const audit = () => q('SELECT assert_conversation_thread_lifecycle_cutover_ready_v1()');
const clockOf = async (session) =>
  (await rows('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
const versionOf = async (user) =>
  (await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1), 0)::text v', [user]))[0].v;
const bindingsOf = (session) =>
  rows('SELECT thread_id, emerging_focus_id, bound_cu_id, bound_sp, same_sp_event_sequence::text seq, binding_kind, binding_id FROM public.conversation_thread_focus_bindings WHERE session_id=$1 ORDER BY bound_sp', [session]);
const lifecycleOf = (session) =>
  rows('SELECT thread_id, cu_id, session_position, same_sp_event_sequence::text seq, transition_ordinal, from_state, to_state, reason_code, event_id FROM public.conversation_thread_lifecycle_events WHERE session_id=$1 ORDER BY session_position, transition_ordinal', [session]);
const evidenceOf = (thread) =>
  rows('SELECT evidence_ordinal, session_id, cu_id, reference_index, exact_surface, source_kind FROM public.conversation_thread_identity_evidence WHERE thread_id=$1 ORDER BY evidence_ordinal', [thread]);
const resultsOf = (batch) =>
  rows('SELECT cu_id, session_position, outcome, emerging_focus_id, thread_id, candidate_thread_ids, thread_layer_event_sequence::text seq FROM public.conversation_thread_semantic_unit_results WHERE commit_batch_id=$1 ORDER BY session_position', [batch]);
const homeOf = async (thread) =>
  (await rows('SELECT thread_id, home_anchor_id, placement_x::text x, placement_y::text y, placement_attempt FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]))[0];
const FRESH = (version = '0') => ({ sp: null, seq: 0, version });

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

/** Every row 0070 could ever touch, for the zero-mutation proof. */
async function worldSnapshot() {
  const out = {};
  for (const table of [...LIFECYCLE_TABLES, ...THREAD_TABLES, 'conversation_units', 'conversation_unit_commit_batches',
    'conversation_unit_commit_events', 'conversation_focus_commit_batches', 'conversation_unit_focus_semantics',
    'conversation_emerging_focus_attention_events', 'conversation_emerging_focuses', 'session_semantic_clocks']) {
    out[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).map((r) => r.row);
  }
  return out;
}

/**
 * Session 1 of the shared scenario through the B3 coordinator: the manager
 * Thread at SP1 (evidence: the manager reference), Ahmed as Mention at SP2,
 * the Ahmed Thread at SP3 with the manager as RESOLVED Origin (evidence: the
 * Ahmed reference of CU3), and two assistant CUs attending Ahmed.
 */
async function sessionOne(owner) {
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const threads = { manager: threadIdOf(owner, focuses.manager), ahmed: threadIdOf(owner, focuses.ahmed) };
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const userUnits = [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)];
  const userBundles = [
    bundle(ids.u1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
    bundle(ids.u2, { sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1,
      references: [resolved(U2, 'أحمد', handles.ahmed, true)],
      claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handles.ahmed, 'REPORTED_SPEECH')],
      attention: NO_FOCUS }),
    bundle(ids.u3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u2,
      references: [resolved(U3, 'أحمد', handles.ahmed, false)], attention: startFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  const userThreads = [
    establish(owner, ids.u1, focuses.manager, 'TE-01', [ids.u1], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    noEstablishment(ids.u2, 'NO_INDEPENDENT_FOCUS'),
    establish(owner, ids.u3, focuses.ahmed, 'TE-01', [ids.u3],
      { explicit_selection_grounding: anchor(U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [threads.manager] }),
  ];
  const userLifecycle = [
    establishNew(session, ids.u1, focuses.manager, threads.manager, [{ cu_id: ids.u1, reference_index: 0 }]),
    noAction(ids.u2),
    // CU3 explicitly shifts away from the manager: the manager Thread goes DORMANT at the same seq2.
    establishNew(session, ids.u3, focuses.ahmed, threads.ahmed, [{ cu_id: ids.u3, reference_index: 0 }],
      [transition(session, ids.u3, threads.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, ids.a1), unit(ASSISTANT_TEXT, A2, 1, ids.a2)];
  const assistantBundles = [
    bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u3,
      references: [resolved(A1, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION') }),
    bundle(ids.a2, { functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3,
      references: [], attention: attendFocus(focuses.ahmed, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
  ];
  const assistantThreads = [noEstablishment(ids.a1, 'ALREADY_ESTABLISHED', focuses.ahmed), noEstablishment(ids.a2, 'ALREADY_ESTABLISHED', focuses.ahmed)];
  const assistantLifecycle = [attendExisting(ids.a1, focuses.ahmed, threads.ahmed), attendExisting(ids.a2, focuses.ahmed, threads.ahmed)];
  const payload = { userUnits, userBundles, userThreads, userLifecycle, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle };
  const [result] = await exchange(session, owner, turns.userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle,
    turns.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, FRESH(await versionOf(owner)));
  return { session, turns, ids, handles, focuses, threads, userBatch, assistantBatch, result, payload };
}

// ---------------------------------------------------------------- A. static
async function verifyStaticAuthority() {
  stage = 'A. schema / privilege / immutability';
  for (const [signature, label] of [[WRITER, 'writer'], [COORDINATOR, 'coordinator'], [VALIDATOR, 'validator'], [PERSIST, 'persist'],
    [REDUCER, 'reducer'], [RELATION, 'relation'], [STATE, 'state'], [ESTABLISHMENT_EVIDENCE, 'establishment evidence'],
    [BINDING_ID, 'binding identity'], [EVENT_ID, 'event identity'], [SEMANTIC_STATE, 'semantic batch state'],
    [DOSSIER_PAGE, 'dossier page'], [LIFECYCLE_CONTEXT, 'runtime context'], [LIFECYCLE_SNAPSHOT, 'snapshot'], [READINESS_AUDIT, 'audit']]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [signature]);
    strict(contract.owner, 'postgres', `${label} is postgres-owned`);
    strict(contract.definer, true, `${label} is SECURITY DEFINER`);
    ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${label} has a fixed search path`);
    if ([SEMANTIC_STATE, DOSSIER_PAGE, LIFECYCLE_CONTEXT, LIFECYCLE_SNAPSHOT, READINESS_AUDIT, STATE, RELATION, REDUCER, ESTABLISHMENT_EVIDENCE].includes(signature)) {
      strict(contract.volatility, 's', `${label} is STABLE: the database itself refuses any write from inside it`);
    }
  }
  for (const signature of [THREAD_WRITER, THREAD_COORDINATOR, THREAD_SNAPSHOT, THREAD_CONTEXT, THREAD_AUDIT, BATCH_STATE, FOCUS_WRITER, FOCUS_COORDINATOR, SAME_SP_HELPER, LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `${signature} still exists`);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [WRITER, COORDINATOR, VALIDATOR, PERSIST, REDUCER, RELATION, STATE, ESTABLISHMENT_EVIDENCE, BINDING_ID, EVENT_ID,
      SEMANTIC_STATE, DOSSIER_PAGE, LIFECYCLE_CONTEXT, LIFECYCLE_SNAPSHOT, READINESS_AUDIT,
      THREAD_WRITER, THREAD_COORDINATOR, THREAD_SNAPSHOT, THREAD_CONTEXT, THREAD_AUDIT, BATCH_STATE, FOCUS_WRITER, FOCUS_COORDINATOR, SAME_SP_HELPER]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} must not execute ${signature}: T-03B3 performs no cutover`);
    }
    for (const signature of [LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, role === 'service_role', `the live T-03A2 grant on ${signature} is unchanged for ${role}`);
    }
    for (const table of [...LIFECYCLE_TABLES, ...THREAD_TABLES]) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        strict(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // No lifecycle column on conversation_threads; no global lifecycle / order column anywhere new.
  const threadColumns = await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_threads' ORDER BY column_name");
  eq(threadColumns.map((c) => c.column_name), ['created_at', 'established_cu_id', 'established_event_sequence', 'established_session_id', 'established_sp', 'establishment_path', 'grounding_emerging_focus_id', 'id', 'user_id'],
    'conversation_threads gained no lifecycle, status or global column');
  const globalColumns = await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* 'current_global_lifecycle_state|global_thread_sp|global_session_order|cross_session_last_sp'");
  eq(globalColumns, [], 'no global lifecycle state, global SP or global Session order column exists');
  // The bodies of the reads write nothing and read no timestamp.
  const bodyOf = async (signature) => (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [signature]))[0].definition;
  for (const [signature, label] of [[SEMANTIC_STATE, 'semantic batch state'], [DOSSIER_PAGE, 'dossier page'], [LIFECYCLE_CONTEXT, 'context'], [LIFECYCLE_SNAPSHOT, 'snapshot'], [READINESS_AUDIT, 'audit'], [REDUCER, 'reducer'], [RELATION, 'relation']]) {
    const body = await bodyOf(signature);
    ok(!/INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u.test(body), `the ${label} writes, backfills, repairs and deletes nothing`);
    ok(!/created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u.test(body), `no timestamp participates in the ${label}`);
    ok(!/similar|embedding|score|ILIKE|~\*/u.test(body), `no similarity or fuzzy authority inside the ${label}`);
  }
  const dossierBody = await bodyOf(DOSSIER_PAGE);
  ok(!/placement|home_anchor|conversation_thread_homes|lifecycle|importance|confidence/u.test(dossierBody), 'a dossier carries no Home, lifecycle, importance or confidence');
  ok(dossierBody.includes('COLLATE "C"'), 'dossier paging is deterministic thread_id::text COLLATE "C" order');
  const writerBody = await bodyOf(WRITER);
  const clock = writerBody.indexOf('FROM public.session_semantic_clocks c');
  const identityLock = writerBody.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const world = writerBody.indexOf('FROM public.conversation_world_spatial_authorities w');
  ok(clock > 0 && identityLock > clock && world > identityLock, 'AF66-01: Session clock -> identity clock -> spatial authority, in the deployed body');
  ok(writerBody.includes('persist_conversation_unit_focus_semantics_v1(') && writerBody.indexOf('persist_conversation_unit_focus_semantics_v1(') < identityLock,
    'B1 rows precede the identity clock lock');
  const coordinatorBody = await bodyOf(COORDINATOR);
  ok(coordinatorBody.indexOf("'STALE_CONVERSATIONAL_FOCUS_CONTEXT'") < coordinatorBody.indexOf("'STALE_THREAD_IDENTITY_CONTEXT'"),
    'the Session clock token is compared before the identity version');
  ok(coordinatorBody.indexOf("'STALE_THREAD_IDENTITY_CONTEXT'") < coordinatorBody.indexOf('commit_conversation_units_with_focus_thread_lifecycle_v1('),
    'the identity version is compared before any writer');
  // Pinned identity vectors reproduce.
  const [vectors] = await rows(`SELECT public.canonical_thread_focus_binding_id_v1('33333333-3333-4333-8333-333333333333','4ef8538d-ddda-5e11-b7d9-052be85de59a','afc4fd81-fe54-5738-9545-e1053044d919')::text b,
    public.canonical_thread_lifecycle_event_id_v1('33333333-3333-4333-8333-333333333333','11111111-2222-4333-8444-555555555555','afc4fd81-fe54-5738-9545-e1053044d919','DORMANT')::text d`);
  eq([vectors.b, vectors.d], ['81db0320-39e5-5053-adc5-6d9c993f5ec7', '3150f4a8-1f76-5ed4-9936-53dc2d72ee78'], 'the frozen binding / lifecycle identity vectors reproduce');
  strict(bindingIdOf('33333333-3333-4333-8333-333333333333', '4ef8538d-ddda-5e11-b7d9-052be85de59a', 'afc4fd81-fe54-5738-9545-e1053044d919'), '81db0320-39e5-5053-adc5-6d9c993f5ec7', 'the JS derivation agrees');
  eq([BINDING_NAMESPACE, LIFECYCLE_NAMESPACE], ['194bb7c5-906f-5228-8116-b4c99b34bd76', '9fbd9e6c-f8a4-529b-bd97-46f75cb068d3'], 'the two frozen namespaces re-derive from their documented URIs');
  strict(eventIdOf('33333333-3333-4333-8333-333333333333', '11111111-2222-4333-8444-555555555555', 'afc4fd81-fe54-5738-9545-e1053044d919', 'REOPENED'), '45873543-9eb6-5679-ae70-befb05f4ee86');
}

// ----------------------------------------------------- B. Session 1 baseline
async function verifySessionOne(owner) {
  stage = 'B/F/G. establishment bindings, ACTIVE baseline, explicit-shift dormancy, shared seq2';
  strict(await versionOf(owner), '0', 'a fresh user world starts at identity version 0');
  const world = await sessionOne(owner);
  const { session, ids, focuses, threads, userBatch, assistantBatch, result } = world;
  eq([result.live_head, String(result.same_sp_event_sequence), String(result.world_thread_identity_version)], [5, '1', '2'],
    'the exchange ends at SP5 / seq1 and advanced the identity version once per new Thread');
  const bindings = await bindingsOf(session);
  eq(bindings.map((b) => [b.thread_id, b.emerging_focus_id, b.bound_cu_id, b.bound_sp, b.seq, b.binding_kind]), [
    [threads.manager, focuses.manager, ids.u1, 1, '2', 'ESTABLISHMENT'],
    [threads.ahmed, focuses.ahmed, ids.u3, 3, '2', 'ESTABLISHMENT'],
  ], 'each new Thread carries exactly one ESTABLISHMENT binding of its grounding focus at seq2');
  eq(bindings.map((b) => b.binding_id), [bindingIdOf(session, focuses.manager, threads.manager), bindingIdOf(session, focuses.ahmed, threads.ahmed)], 'binding identities are the derived ones');
  eq(await lifecycleOf(session), [{ thread_id: threads.manager, cu_id: ids.u3, session_position: 3, seq: '2', transition_ordinal: 0,
    from_state: 'ACTIVE', to_state: 'DORMANT', reason_code: 'EXPLICIT_FOCUS_SHIFT', event_id: eventIdOf(session, ids.u3, threads.manager, 'DORMANT') }],
    'the explicit FOCUS_SHIFT makes the manager DORMANT at CU3 - same seq2 as the Ahmed establishment - and no baseline ACTIVE row exists');
  eq([await lifecycleState(threads.manager, session), await lifecycleState(threads.ahmed, session)], ['DORMANT', 'ACTIVE'], 'then-valid Session states');
  eq([await lifecycleState(threads.manager, session, 3), await lifecycleState(threads.manager, session, 1)], ['ACTIVE', null], 'the baseline ACTIVE is derived from the binding; before it there is no footprint');
  eq(await evidenceOf(threads.manager), [{ evidence_ordinal: 0, session_id: session, cu_id: ids.u1, reference_index: 0, exact_surface: 'المدير', source_kind: 'ESTABLISHMENT' }],
    'the manager dossier is the exact source surface of the establishing reference');
  eq(await evidenceOf(threads.ahmed), [{ evidence_ordinal: 0, session_id: session, cu_id: ids.u3, reference_index: 0, exact_surface: 'أحمد', source_kind: 'ESTABLISHMENT' }],
    'the Ahmed dossier is its establishing reference; the Mention inside reported speech (CU2) is not identity evidence');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.thread_id, r.seq]), [
    ['ESTABLISH_NEW', threads.manager, '2'], ['NO_THREAD_ACTION', null, null], ['ESTABLISH_NEW', threads.ahmed, '2']],
    'unit results record the final Thread-layer outcome and whether seq2 was reserved');
  eq((await resultsOf(assistantBatch)).map((r) => [r.outcome, r.thread_id, r.seq]), [['ATTEND_EXISTING', threads.ahmed, null], ['ATTEND_EXISTING', threads.ahmed, null]],
    'attending an ACTIVE Thread reserves nothing');
  eq(await clockOf(session), { current_sp: 5, same_sp_event_sequence: '1' }, 'B1 alone on the last Moment leaves the clock at seq1');
  const [semantic] = await rows('SELECT unit_count, establishment_count, continuity_binding_count, lifecycle_transition_count, ambiguous_count FROM public.conversation_thread_semantic_commit_batches WHERE commit_batch_id=$1', [userBatch]);
  eq(semantic, { unit_count: 3, establishment_count: 2, continuity_binding_count: 0, lifecycle_transition_count: 1, ambiguous_count: 0 });
  strict(await semanticState(session, owner, world.turns.userTurn, userBatch), 'COMPLETE');
  strict(await semanticState(session, owner, world.turns.assistantTurn, assistantBatch), 'COMPLETE');
  await audit();
  assertions += 1;
  // The original grounding focus stays immutable and the Home is exactly one.
  const [thread] = await rows('SELECT grounding_emerging_focus_id FROM public.conversation_threads WHERE id=$1', [threads.ahmed]);
  strict(thread.grounding_emerging_focus_id, focuses.ahmed);
  ok(await homeOf(threads.ahmed), 'the Ahmed Thread holds its permanent Home');
  return world;
}

// ---------------------------------------------- C. cross-Session continuity
async function verifyCrossSessionContinuity(owner, world) {
  stage = 'D/E. cross-Session continuity: same Thread, same Home, no OSDAP, identity version';
  const { threads, focuses } = world;
  const homeBefore = await homeOf(threads.ahmed);
  const versionBefore = await versionOf(owner);
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session, RETURN_TEXT, RETURN_REPLY);
  const ids = { r1: randomUUID(), a1: randomUUID() };
  const handle = randomUUID();
  const focus = randomUUID();
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const returnBundle = bundle(ids.r1, { functions: ['REQUEST'], sequence_position: 'INITIATING', references: [resolved(RETURN_TEXT, 'أحمد', handle, true)], attention: startFocus(focus, 0) });
  const replyBundle = bundle(ids.a1, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.r1,
    references: [resolved(RETURN_REPLY, 'أحمد', handle, false)], attention: attendFocus(focus, 0, 'DIRECT_SUBJECT') });
  const priorEvidence = [{ cu_id: world.ids.u3, exact_surface: 'أحمد' }];
  const bind = activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 0 }], priorEvidence);
  const args = (userLifecycle, assistantLifecycle = [attendExisting(ids.a1, focus, threads.ahmed)], token = FRESH(versionBefore)) => [
    session, owner, turns.userTurn, userBatch, [unit(RETURN_TEXT, RETURN_TEXT, 1, ids.r1)], [returnBundle],
    [noEstablishment(ids.r1, 'NO_PROMOTION_PATH_PROVEN', focus)], userLifecycle,
    turns.assistantTurn, assistantBatch, [unit(RETURN_REPLY, RETURN_REPLY, 1, ids.a1)], [replyBundle],
    [noEstablishment(ids.a1, 'NO_PROMOTION_PATH_PROVEN', focus)], assistantLifecycle, token];

  // The dossier page the runtime screens: exact version, deterministic order, evidence only.
  const page = await dossierPage(owner, versionBefore, null, 32);
  eq(page.map((d) => d.thread_id), [threads.ahmed, threads.manager].sort(byText), 'every Thread of the user, in thread_id::text COLLATE "C" order');
  eq(Object.keys(page[0].identity_evidence[0]).sort(), ['committed_cu_text', 'cu_id', 'exact_surface', 'session_id', 'source_role'], 'a dossier item carries exactly the five source-grounded fields');
  eq(page.map((d) => Object.keys(d).sort()), [['identity_evidence', 'thread_id'], ['identity_evidence', 'thread_id']], 'no Home, lifecycle, importance or timestamp leaves the dossier');
  const [firstPage] = await dossierPage(owner, versionBefore, null, 1);
  const secondPage = await dossierPage(owner, versionBefore, firstPage.thread_id, 1);
  eq([firstPage.thread_id, secondPage[0].thread_id], page.map((d) => d.thread_id), 'fixed-size paging walks the same deterministic order');
  eq(await dossierPage(owner, versionBefore, secondPage[0].thread_id, 1), [], 'the walk terminates after the last Thread');
  await rejected(() => dossierPage(owner, String(Number(versionBefore) + 1), null, 32), 'STALE_THREAD_IDENTITY_CONTEXT', ['40001']);
  await rejected(() => dossierPage(owner, versionBefore, null, 0), 'INVALID_THREAD_DOSSIER_PAGE');
  await rejected(() => dossierPage(owner, versionBefore, null, 65), 'INVALID_THREAD_DOSSIER_PAGE');

  // Adversarial continuity payloads, each refused before any mutation.
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, randomUUID(), [{ cu_id: ids.r1, reference_index: 0 }], priorEvidence)])),
    'UNKNOWN_THREAD_IDENTITY_CANDIDATE');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [], priorEvidence)])), 'THREAD_CONTINUITY_EVIDENCE_REQUIRED');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 0 }], [])])), 'THREAD_CONTINUITY_EVIDENCE_REQUIRED');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 0 }], [{ cu_id: world.ids.u1, exact_surface: 'المدير' }])])),
    'THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 0 }], [{ cu_id: world.ids.u3, exact_surface: 'احمد' }])])),
    'THREAD_CONTINUITY_PRIOR_EVIDENCE_UNKNOWN');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 3 }], priorEvidence)])), 'THREAD_CONTINUITY_EVIDENCE_NOT_GROUNDED');
  await rejected(() => exchange(...args([activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: world.ids.u3, reference_index: 0 }], priorEvidence)])), 'THREAD_CONTINUITY_EVIDENCE_NOT_CURRENT');
  await rejected(() => exchange(...args([{ ...bind, focus_binding_id: randomUUID() }])), 'INVALID_THREAD_IDENTITY');
  await rejected(() => exchange(...args([{ ...bind, binding_kind: 'ESTABLISHMENT' }])), 'INVALID_THREAD_LIFECYCLE_PAYLOAD');
  await rejected(() => exchange(...args([{ ...bind, outcome: 'ESTABLISH_NEW', binding_kind: 'ESTABLISHMENT', focus_binding_id: bindingIdOf(session, focus, threads.ahmed) }])),
    'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH');
  await rejected(() => exchange(...args([noAction(ids.r1, focus)], [attendExisting(ids.a1, focus, threads.ahmed)])), 'THREAD_LIFECYCLE_OUTCOME_MISMATCH');
  // A stale identity version is the exact typed 40001, and it writes nothing.
  await rejected(() => exchange(...args([bind], undefined, FRESH(String(Number(versionBefore) + 1)))), 'STALE_THREAD_IDENTITY_CONTEXT', ['40001']);
  await rejected(() => exchange(...args([bind], undefined, { sp: 9, seq: 0, version: versionBefore })), 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', ['40001']);
  eq(await bindingsOf(session), [], 'no binding was written by any refused attempt');
  eq(await clockOf(session), { current_sp: null, same_sp_event_sequence: '0' });
  // A B2 establishment for a continuity-bound focus is forbidden (duplicate geography).
  const [result] = await exchange(...args([bind]));
  eq([result.live_head, String(result.same_sp_event_sequence), String(result.world_thread_identity_version)], [2, '1', String(Number(versionBefore) + 1)],
    'the continuity binding advanced the identity version exactly once');
  eq((await bindingsOf(session)).map((b) => [b.thread_id, b.emerging_focus_id, b.bound_cu_id, b.bound_sp, b.seq, b.binding_kind]),
    [[threads.ahmed, focus, ids.r1, 1, '2', 'SESSION_CONTINUITY']], 'the later Session binds its own Emerging Focus to the SAME canonical Thread');
  eq(await homeOf(threads.ahmed), homeBefore, 'the same permanent Home is reused: no recalculation, no OSDAP, no second placement');
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 2, 'no second Thread exists');
  strict((await rows('SELECT count(*)::int n FROM public.conversation_thread_homes WHERE user_id=$1', [owner]))[0].n, 2, 'no duplicate geography');
  eq((await evidenceOf(threads.ahmed)).map((e) => [e.evidence_ordinal, e.session_id, e.exact_surface, e.source_kind]),
    [[0, world.session, 'أحمد', 'ESTABLISHMENT'], [1, session, 'أحمد', 'SESSION_BINDING']], 'the dossier grew by the new Session\'s exact source surface');
  const [thread] = await rows('SELECT grounding_emerging_focus_id, established_session_id FROM public.conversation_threads WHERE id=$1', [threads.ahmed]);
  eq([thread.grounding_emerging_focus_id, thread.established_session_id], [focuses.ahmed, world.session], 'the original grounding focus and Session are never rewritten');
  eq([await lifecycleState(threads.ahmed, session), await lifecycleState(threads.ahmed, world.session)], ['ACTIVE', 'ACTIVE'],
    'the first appearance in a new Session starts ACTIVE - not REOPENED - and the earlier Session footprint is untouched');
  eq(await lifecycleOf(session), [], 'the ACTIVE baseline cost no lifecycle row');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.thread_id, r.seq]), [['ACTIVATE_EXISTING_IN_SESSION', threads.ahmed, '2']]);
  await audit();
  assertions += 1;
  // No rebind: a later CU of this Session attending the bound focus can never bind it again (to the same or another Thread).
  const reboundTurns = await completedTurns(owner, session, RETURN_TEXT, RETURN_REPLY);
  const rebound = { r: randomUUID(), a: randomUUID() };
  const reboundVersion = await versionOf(owner);
  for (const target of [threads.ahmed, threads.manager]) {
    await rejected(() => exchange(session, owner, reboundTurns.userTurn, randomUUID(), [unit(RETURN_TEXT, RETURN_TEXT, 1, rebound.r)],
      [bundle(rebound.r, { functions: ['REQUEST'], references: [resolved(RETURN_TEXT, 'أحمد', handle, false)], attention: attendFocus(focus, 0, 'DIRECT_SUBJECT') })],
      [noEstablishment(rebound.r, 'NO_PROMOTION_PATH_PROVEN', focus)],
      [activateExisting(session, rebound.r, focus, target, [{ cu_id: rebound.r, reference_index: 0 }], priorEvidence)],
      reboundTurns.assistantTurn, randomUUID(), [], [], [], [], { sp: 2, seq: 1, version: reboundVersion }), 'THREAD_FOCUS_ALREADY_BOUND');
  }
  eq((await bindingsOf(session)).length, 1, 'the binding is immutable: no rebind was written');
  // The runtime context of the new Session carries the version, the binding and no Home.
  const context = await runtimeContext(session, owner);
  eq([context.base_current_sp, String(context.base_same_sp_event_sequence), String(context.world_thread_identity_version)], [2, '1', String(Number(versionBefore) + 1)]);
  eq(context.session_focus_thread_bindings.map((b) => [b.thread_id, b.emerging_focus_id, b.bound_cu_id, b.bound_sp, b.binding_kind]),
    [[threads.ahmed, focus, ids.r1, 1, 'SESSION_CONTINUITY']]);
  eq(context.established_thread_bindings, [], 'a continuity binding is not an establishment of this Session');
  eq(context.session_thread_lifecycle_history, []);
  eq(Object.keys(context.session_focus_thread_bindings[0]).sort(), ['binding_id', 'binding_kind', 'bound_cu_id', 'bound_sp', 'emerging_focus_id', 'thread_id'], 'a binding carries no Home, no lifecycle and no timestamp');
  ok(!JSON.stringify(context).includes('placement'), 'no Home coordinate crosses the runtime boundary');
  // Same-Session second binding of the same Thread is impossible: a new focus of THIS Session may not bind it again.
  const session3 = await newSession(owner);
  const turns3 = await completedTurns(owner, session3, RETURN_TEXT, RETURN_REPLY);
  const ids3 = { r1: randomUUID(), a1: randomUUID() };
  const handle3 = randomUUID();
  const focus3 = randomUUID();
  const focus3b = randomUUID();
  const handle3b = randomUUID();
  const version3 = await versionOf(owner);
  await rejected(() => exchange(session3, owner, turns3.userTurn, randomUUID(), [unit(RETURN_TEXT, RETURN_TEXT, 1, ids3.r1)],
    [bundle(ids3.r1, { references: [resolved(RETURN_TEXT, 'أحمد', handle3, true)], attention: startFocus(focus3, 0) })],
    [noEstablishment(ids3.r1, 'NO_PROMOTION_PATH_PROVEN', focus3)],
    [activateExisting(session3, ids3.r1, focus3, threads.ahmed, [{ cu_id: ids3.r1, reference_index: 0 }], priorEvidence)],
    turns3.assistantTurn, randomUUID(), [unit(RETURN_REPLY, RETURN_REPLY, 1, ids3.a1)],
    [bundle(ids3.a1, { references: [resolved(RETURN_REPLY, 'أحمد', handle3b, true)], attention: startFocus(focus3b, 0) })],
    [noEstablishment(ids3.a1, 'NO_PROMOTION_PATH_PROVEN', focus3b)],
    [activateExisting(session3, ids3.a1, focus3b, threads.ahmed, [{ cu_id: ids3.a1, reference_index: 0 }], priorEvidence)],
    FRESH(version3)), 'THREAD_ALREADY_BOUND_IN_SESSION');
  return { session, turns, ids, focus, userBatch, assistantBatch };
}

// ------------------------------------------------- D. same-name ambiguity
async function verifyAmbiguityAndDistinctness(owner, world) {
  stage = 'D. same-name ambiguity blocks duplicate establishment; a relational focus stays distinct';
  const { threads } = world;
  // A second Ahmed (the brother) in his own Session, so the world holds two same-name Threads.
  const brotherSession = await newSession(owner);
  const brotherTurns = await completedTurns(owner, brotherSession, 'أخويا أحمد زعلان مني.', 'ليه زعلان؟');
  const brother = { cu: randomUUID(), reply: randomUUID(), handle: randomUUID(), focus: randomUUID() };
  brother.thread = threadIdOf(owner, brother.focus);
  await exchange(brotherSession, owner, brotherTurns.userTurn, randomUUID(), [unit('أخويا أحمد زعلان مني.', 'أخويا أحمد زعلان مني.', 1, brother.cu)],
    [bundle(brother.cu, { references: [resolved('أخويا أحمد زعلان مني.', 'أحمد', brother.handle, true)], attention: startFocus(brother.focus, 0) })],
    [establish(owner, brother.cu, brother.focus, 'TE-01', [brother.cu], { explicit_selection_grounding: anchor('أخويا أحمد زعلان مني.', 'أخويا أحمد') })],
    [establishNew(brotherSession, brother.cu, brother.focus, brother.thread, [{ cu_id: brother.cu, reference_index: 0 }])],
    brotherTurns.assistantTurn, randomUUID(), [unit('ليه زعلان؟', 'ليه زعلان؟', 1, brother.reply)], [bundle(brother.reply, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: brother.cu, attention: attendFocus(brother.focus, null, 'DIRECT_REQUEST_OR_QUESTION') })],
    [noEstablishment(brother.reply, 'ALREADY_ESTABLISHED', brother.focus)], [attendExisting(brother.reply, brother.focus, brother.thread)], FRESH(await versionOf(owner)));
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 3, 'two same-name Ahmed Threads coexist as distinct canonical loci');

  // "عايز أتكلم عن أحمد." - the evidence cannot choose: IDENTITY_AMBIGUOUS, no Thread, no Home, no binding.
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session, AMBIGUOUS_TEXT, AMBIGUOUS_REPLY);
  const ids = { u: randomUUID(), a: randomUUID() };
  const handle = randomUUID();
  const focus = randomUUID();
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const versionBefore = await versionOf(owner);
  const candidates = [threads.ahmed, brother.thread];
  const args = (userThreads, userLifecycle) => [session, owner, turns.userTurn, userBatch, [unit(AMBIGUOUS_TEXT, AMBIGUOUS_TEXT, 1, ids.u)],
    [bundle(ids.u, { functions: ['REQUEST'], references: [resolved(AMBIGUOUS_TEXT, 'أحمد', handle, true)], attention: startFocus(focus, 0) })],
    userThreads, userLifecycle,
    turns.assistantTurn, assistantBatch, [unit(AMBIGUOUS_REPLY, AMBIGUOUS_REPLY, 1, ids.a)],
    [bundle(ids.a, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u, references: [resolved(AMBIGUOUS_REPLY, 'أحمد', handle, false)], attention: attendFocus(focus, 0, 'DIRECT_REQUEST_OR_QUESTION') })],
    [noEstablishment(ids.a, 'NO_PROMOTION_PATH_PROVEN', focus)], [ambiguous(ids.a, focus, candidates)], FRESH(versionBefore)];
  // Ambiguity blocks duplicate establishment: a B2 ESTABLISH beside an ambiguous outcome is refused.
  await rejected(() => exchange(...args([establish(owner, ids.u, focus, 'TE-01', [ids.u], { explicit_selection_grounding: anchor(AMBIGUOUS_TEXT, 'أحمد') })], [ambiguous(ids.u, focus, candidates)])),
    'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH');
  await rejected(() => exchange(...args([noEstablishment(ids.u, 'NO_PROMOTION_PATH_PROVEN', focus)], [ambiguous(ids.u, focus, [threads.ahmed])])), 'INVALID_THREAD_IDENTITY_AMBIGUITY');
  await rejected(() => exchange(...args([noEstablishment(ids.u, 'NO_PROMOTION_PATH_PROVEN', focus)], [ambiguous(ids.u, focus, [threads.ahmed, randomUUID()])])), 'UNKNOWN_THREAD_IDENTITY_CANDIDATE');
  await rejected(() => exchange(...args([noEstablishment(ids.u, 'NO_PROMOTION_PATH_PROVEN', focus)], [{ ...ambiguous(ids.u, focus, candidates), candidate_thread_ids: [...candidates].sort(byText).reverse() }])), 'INVALID_THREAD_IDENTITY_AMBIGUITY');
  await rejected(() => exchange(...args([noEstablishment(ids.u, 'NO_PROMOTION_PATH_PROVEN', focus)], [{ ...ambiguous(ids.u, focus, candidates), thread_id: threads.ahmed }])), 'INVALID_THREAD_LIFECYCLE_PAYLOAD');
  const [result] = await exchange(...args([noEstablishment(ids.u, 'NO_PROMOTION_PATH_PROVEN', focus)], [ambiguous(ids.u, focus, candidates)]));
  eq([result.live_head, String(result.same_sp_event_sequence), String(result.world_thread_identity_version)], [2, '1', versionBefore],
    'an ambiguous outcome allocates SP, reserves no seq2 and does not move the identity version');
  eq(await bindingsOf(session), [], 'no binding');
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 3, 'no third Ahmed: ambiguity blocked the duplicate');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.thread_id, [...r.candidate_thread_ids].sort(byText), r.seq]), [['IDENTITY_AMBIGUOUS', null, [...candidates].sort(byText), null]],
    'the ambiguity is captured technically with its canonical candidate set');
  strict(await semanticState(session, owner, turns.userTurn, userBatch), 'COMPLETE', 'IDENTITY_AMBIGUOUS is a truthful COMPLETE outcome');
  await audit();
  assertions += 1;

  // A distinct relational focus may establish its own Thread beside Ahmed.
  const relSession = await newSession(owner);
  const relTurns = await completedTurns(owner, relSession, RELATION_TEXT, RELATION_REPLY);
  const rel = { cu: randomUUID(), reply: randomUUID(), handleAhmed: randomUUID(), handleRelation: randomUUID(), focus: randomUUID() };
  rel.thread = threadIdOf(owner, rel.focus);
  const relVersion = await versionOf(owner);
  await exchange(relSession, owner, relTurns.userTurn, randomUUID(), [unit(RELATION_TEXT, RELATION_TEXT, 1, rel.cu)],
    [bundle(rel.cu, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], references: [resolved(RELATION_TEXT, 'أحمد', rel.handleAhmed, true), resolved(RELATION_TEXT, 'علاقتي بأحمد', rel.handleRelation, true)], attention: startFocus(rel.focus, 1, 'EXPLICIT_FOCUS_SHIFT') })],
    [establish(owner, rel.cu, rel.focus, 'TE-01', [rel.cu], { explicit_selection_grounding: anchor(RELATION_TEXT, 'علاقتي بأحمد') })],
    [establishNew(relSession, rel.cu, rel.focus, rel.thread, [{ cu_id: rel.cu, reference_index: 1 }])],
    relTurns.assistantTurn, randomUUID(), [unit(RELATION_REPLY, RELATION_REPLY, 1, rel.reply)],
    [bundle(rel.reply, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: rel.cu, attention: attendFocus(rel.focus, null, 'DIRECT_SUBJECT') })],
    [noEstablishment(rel.reply, 'ALREADY_ESTABLISHED', rel.focus)], [attendExisting(rel.reply, rel.focus, rel.thread)], FRESH(relVersion));
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 4, 'Relationship with Ahmed is its own canonical Thread');
  eq((await evidenceOf(rel.thread)).map((e) => e.exact_surface), ['علاقتي بأحمد'], 'its dossier is the relational surface, never the person\'s name');
  strict(await versionOf(owner), String(Number(relVersion) + 1));
  // Establishment evidence is derived, never authored: an omitted or foreign item is refused.
  const relSession2 = await newSession(owner);
  const relTurns2 = await completedTurns(owner, relSession2, RELATION_TEXT, RELATION_REPLY);
  const bad = { cu: randomUUID(), reply: randomUUID(), h1: randomUUID(), h2: randomUUID(), focus: randomUUID() };
  const badVersion = await versionOf(owner);
  const badArgs = (evidence) => [relSession2, owner, relTurns2.userTurn, randomUUID(), [unit(RELATION_TEXT, RELATION_TEXT, 1, bad.cu)],
    [bundle(bad.cu, { references: [resolved(RELATION_TEXT, 'أحمد', bad.h1, true), resolved(RELATION_TEXT, 'علاقتي بأحمد', bad.h2, true)], attention: startFocus(bad.focus, 1) })],
    [establish(owner, bad.cu, bad.focus, 'TE-01', [bad.cu], { explicit_selection_grounding: anchor(RELATION_TEXT, 'علاقتي بأحمد') })],
    [establishNew(relSession2, bad.cu, bad.focus, threadIdOf(owner, bad.focus), evidence)],
    relTurns2.assistantTurn, randomUUID(), [], [], [], [], FRESH(badVersion)];
  await rejected(() => exchange(...badArgs([{ cu_id: bad.cu, reference_index: 0 }])), 'THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL');
  await rejected(() => exchange(...badArgs([])), 'THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL');
  await rejected(() => exchange(...badArgs([{ cu_id: bad.cu, reference_index: 1 }, { cu_id: bad.cu, reference_index: 0 }])), 'THREAD_IDENTITY_EVIDENCE_NOT_CANONICAL');
  return { brother, rel };
}

// --------------------------------------------------- E. Session lifecycle
async function verifyLifecycle(owner) {
  stage = 'F/G. Session-local lifecycle: sustained departure, brief clarification, reopen, continue, shared seq2';
  // A fresh world for a fresh user keeps the reducer proofs independent.
  const user = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [user]);
  const world = await sessionOne(user);
  const { session, ids, focuses, threads } = world;
  // SP1 manager (ACTIVE -> DORMANT at SP3), SP3 Ahmed ACTIVE, SP4/SP5 attend Ahmed.
  // Exchange 2 (SP6..SP9): the user talks about work twice (sustained departure
  // from Ahmed at the SECOND away CU, never backdated), then a brief local
  // clarification about Ahmed's timing (Ahmed stays as it is), then returns to Ahmed.
  const WORK_TEXT = 'الشغل بقى ضاغط جدًا. المشروع الجديد واخد كل وقتي. استنى بس، حصل ده مع أحمد إمتى؟ نرجع لأحمد.';
  const W1 = 'الشغل بقى ضاغط جدًا.';
  const W2 = 'المشروع الجديد واخد كل وقتي.';
  const W3 = 'استنى بس، حصل ده مع أحمد إمتى؟';
  const W4 = 'نرجع لأحمد.';
  const REPLY2 = 'تمام، أحمد.';
  const turns2 = await completedTurns(user, session, WORK_TEXT, REPLY2);
  const w = { w1: randomUUID(), w2: randomUUID(), w3: randomUUID(), w4: randomUUID(), r: randomUUID() };
  const work = { handle: randomUUID(), focus: randomUUID() };
  work.thread = threadIdOf(user, work.focus);
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const versionBefore = await versionOf(user);
  const userUnits = [unit(WORK_TEXT, W1, 1, w.w1), unit(WORK_TEXT, W2, 1, w.w2), unit(WORK_TEXT, W3, 1, w.w3), unit(WORK_TEXT, W4, 1, w.w4)];
  const userBundles = [
    bundle(w.w1, { references: [resolved(W1, 'الشغل', work.handle, true)], attention: startFocus(work.focus, 0) }),
    bundle(w.w2, { sequence_position: 'FOLLOW_UP', target_cu_id: w.w1, references: [], attention: attendFocus(work.focus, null, 'SUBSTANTIVE_ELABORATION') }),
    bundle(w.w3, { functions: ['ASK', 'CLARIFY'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3, references: [resolved(W3, 'أحمد', world.handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
    bundle(w.w4, { functions: ['REQUEST', 'FOCUS_SHIFT'], references: [resolved(W4, 'أحمد', world.handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  const userThreads = [
    establish(user, w.w1, work.focus, 'TE-01', [w.w1], { explicit_selection_grounding: anchor(W1, 'الشغل') }),
    noEstablishment(w.w2, 'ALREADY_ESTABLISHED', work.focus),
    noEstablishment(w.w3, 'ALREADY_ESTABLISHED', focuses.ahmed),
    noEstablishment(w.w4, 'ALREADY_ESTABLISHED', focuses.ahmed),
  ];
  const userLifecycle = [
    // SP6: Work established; Ahmed ACTIVE is attended elsewhere ONCE -> nothing yet (no FOCUS_SHIFT).
    establishNew(session, w.w1, work.focus, work.thread, [{ cu_id: w.w1, reference_index: 0 }]),
    // SP7: second consecutive away CU -> Ahmed DORMANT (SUSTAINED_DEPARTURE), at SP7 only.
    attendExisting(w.w2, work.focus, work.thread, [transition(session, w.w2, threads.ahmed, 'DORMANT', 'SUSTAINED_DEPARTURE')]),
    // SP8: a brief local clarification anchored to Ahmed while Ahmed is DORMANT: a genuine return -> REOPENED; Work is not departed by a clarification.
    reopenExisting(session, w.w3, focuses.ahmed, threads.ahmed),
    // SP9: the next anchored CU continues: REOPENED -> ACTIVE; the explicit FOCUS_SHIFT away from Work makes Work DORMANT, same seq2.
    attendExisting(w.w4, focuses.ahmed, threads.ahmed, [transition(session, w.w4, threads.ahmed, 'ACTIVE', 'CONTINUED_ANCHORING'), transition(session, w.w4, work.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const assistantUnits = [unit(REPLY2, REPLY2, 1, w.r)];
  const assistantBundles = [bundle(w.r, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: w.w4, references: [resolved(REPLY2, 'أحمد', world.handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_SUBJECT') })];
  const assistantThreads = [noEstablishment(w.r, 'ALREADY_ESTABLISHED', focuses.ahmed)];
  const assistantLifecycle = [attendExisting(w.r, focuses.ahmed, threads.ahmed)];
  const args = (ul = userLifecycle, al = assistantLifecycle) => [session, user, turns2.userTurn, userBatch, userUnits, userBundles, userThreads, ul,
    turns2.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, al, { sp: 5, seq: 1, version: versionBefore }];

  // The DB refuses every non-canonical reducer claim: backdated, missing, extra, impossible, wrong reason, wrong from.
  const withTransitions = (index, transitions) => userLifecycle.map((entry, at) => at === index ? { ...entry, lifecycle_transitions: sortTransitions(transitions) } : entry);
  await rejected(() => exchange(...args(withTransitions(0, [transition(session, w.w1, threads.ahmed, 'DORMANT', 'SUSTAINED_DEPARTURE')]))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(withTransitions(1, []))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(withTransitions(1, [transition(session, w.w2, threads.ahmed, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(withTransitions(1, [transition(session, w.w2, threads.ahmed, 'REOPENED', 'GENUINE_RETURN')]))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(withTransitions(1, [transition(session, w.w2, threads.ahmed, 'DORMANT', 'SUSTAINED_DEPARTURE'), transition(session, w.w2, threads.manager, 'REOPENED', 'GENUINE_RETURN')]))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(userLifecycle.map((entry, at) => at === 2 ? attendExisting(w.w3, focuses.ahmed, threads.ahmed) : entry))), 'THREAD_LIFECYCLE_OUTCOME_MISMATCH');
  await rejected(() => exchange(...args(userLifecycle.map((entry, at) => at === 2 ? { ...entry, lifecycle_transitions: [] } : entry))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(userLifecycle.map((entry, at) => at === 3 ? { ...entry, lifecycle_transitions: [transition(session, w.w4, threads.ahmed, 'ACTIVE', 'CONTINUED_ANCHORING')] } : entry))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(...args(userLifecycle.map((entry, at) => at === 3 ? { ...entry, lifecycle_transitions: sortTransitions([{ ...transition(session, w.w4, threads.ahmed, 'ACTIVE', 'CONTINUED_ANCHORING'), lifecycle_event_id: randomUUID() }, transition(session, w.w4, work.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]) } : entry))), 'INVALID_THREAD_IDENTITY');
  await rejected(() => exchange(...args(userLifecycle.map((entry, at) => at === 3 ? { ...entry, lifecycle_transitions: [...entry.lifecycle_transitions].reverse() } : entry))), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  eq(await lifecycleOf(session), [{ thread_id: threads.manager, cu_id: ids.u3, session_position: 3, seq: '2', transition_ordinal: 0, from_state: 'ACTIVE', to_state: 'DORMANT', reason_code: 'EXPLICIT_FOCUS_SHIFT', event_id: eventIdOf(session, ids.u3, threads.manager, 'DORMANT') }],
    'no refused attempt wrote a lifecycle row');

  const [result] = await exchange(...args());
  eq([result.live_head, String(result.same_sp_event_sequence), String(result.world_thread_identity_version)], [10, '1', String(Number(versionBefore) + 1)],
    'lifecycle-only Moments never move the identity version; only the Work establishment did');
  const history = await lifecycleOf(session);
  eq(history.map((e) => [e.session_position, e.transition_ordinal, e.thread_id, e.from_state, e.to_state, e.reason_code, e.seq]), [
    [3, 0, threads.manager, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT', '2'],
    [7, 0, threads.ahmed, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', '2'],
    [8, 0, threads.ahmed, 'DORMANT', 'REOPENED', 'GENUINE_RETURN', '2'],
    ...[[threads.ahmed, 'REOPENED', 'ACTIVE', 'CONTINUED_ANCHORING'], [work.thread, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT']]
      .sort((a, b) => byText(a[0], b[0])).map((t, i) => [9, i, t[0], t[1], t[2], t[3], '2']),
  ], 'sustained departure lands at the SECOND away CU (SP7, never SP6); the clarification reopens; the next anchored CU continues to ACTIVE; two transitions share one seq2 at SP9 in canonical Thread order');
  eq([await lifecycleState(threads.ahmed, session), await lifecycleState(work.thread, session), await lifecycleState(threads.manager, session)], ['ACTIVE', 'DORMANT', 'DORMANT']);
  eq([await lifecycleState(threads.ahmed, session, 7), await lifecycleState(threads.ahmed, session, 8), await lifecycleState(threads.ahmed, session, 9), await lifecycleState(threads.ahmed, session, 10)],
    ['ACTIVE', 'DORMANT', 'REOPENED', 'ACTIVE'], 'the then-valid state at every SP is derivable without any timestamp');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.seq]), [['ESTABLISH_NEW', '2'], ['ATTEND_EXISTING', '2'], ['REOPEN_EXISTING', '2'], ['ATTEND_EXISTING', '2']]);
  eq((await resultsOf(assistantBatch)).map((r) => [r.outcome, r.seq]), [['ATTEND_EXISTING', null]], 'the assistant CU continuing an ACTIVE Ahmed reserves nothing');
  eq((await rows('SELECT session_position sp, same_sp_event_sequence::text seq FROM public.conversation_thread_establishment_events WHERE thread_id=$1', [work.thread]))[0], { sp: 6, seq: '2' });
  strict(await semanticState(session, user, turns2.userTurn, userBatch), 'COMPLETE');
  await audit();
  assertions += 1;
  // The reducer helper agrees with the stored history for every CU of the Session.
  for (const cu of [ids.u3, w.w1, w.w2, w.w3, w.w4, w.r]) {
    const [{ derived }] = await rows('SELECT public.derive_conversation_thread_lifecycle_transitions_v1(u) derived FROM public.conversation_units u WHERE u.id=$1', [cu]);
    const stored = (await rows('SELECT thread_id, from_state, to_state, reason_code FROM public.conversation_thread_lifecycle_events WHERE cu_id=$1 ORDER BY transition_ordinal', [cu]));
    eq(derived, stored, `the SQL reducer re-derives exactly the stored transitions of ${cu}`);
  }
  // Background analysis cannot mutate lifecycle: the reducer reads only durable
  // B1 rows and bindings; nothing analytical is representable as its input.
  const [{ definition }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [REDUCER]);
  ok(!/reading|hypothes|analysis|background|confidence|importance|created_at/iu.test(definition), 'the reducer reads no analytical, background or temporal input');
  // A later internal reservation on the last Moment becomes seq3 (T-03D's future LF position) and is rolled back.
  const probe = await isolated(async () => (await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, user]))[0]);
  eq([probe.value.session_position, String(probe.value.event_sequence)], [10, '2'], 'on a B1-only last Moment the next reservation is seq2');
  const seq3 = await isolated(async () => {
    await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, user]);
    return (await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, user]))[0];
  });
  eq([seq3.value.session_position, String(seq3.value.event_sequence)], [10, '3'], 'after a Thread-layer seq2 the next position is seq3');
  eq(await clockOf(session), { current_sp: 10, same_sp_event_sequence: '1' }, 'the probes rolled back');
  return { user, world, work, session, turns2, userBatch, assistantBatch };
}

// -------------------------------------------- F. replay / partial / corrupt
async function verifyReplayAndCorruption(owner, world) {
  stage = 'H. exact replay, legacy / partial shapes, corruption, zero-CU';
  const { session, turns, userBatch, assistantBatch, payload } = world;
  const before = await worldSnapshot();
  const [replayed] = await exchange(session, owner, turns.userTurn, userBatch, payload.userUnits, payload.userBundles, payload.userThreads, payload.userLifecycle,
    turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, { sp: 99, seq: 0, version: '999' });
  eq([replayed.live_head, replayed.user_units.length, replayed.assistant_units.length], [5, 3, 2], 'an exact replay returns the stored delivery and needs no token');
  eq(await worldSnapshot(), before, 'an exact replay mutates zero rows and zero clock coordinates');
  // A changed B3 payload never replays.
  const changed = payload.userLifecycle.map((entry, at) => at === 2 ? { ...entry, lifecycle_transitions: [] } : entry);
  await rejected(() => exchange(session, owner, turns.userTurn, userBatch, payload.userUnits, payload.userBundles, payload.userThreads, changed,
    turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, FRESH()), 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT');
  const otherProvenance = payload.assistantLifecycle;
  await rejected(() => rows(`SELECT * FROM commit_conversation_units_with_focus_thread_lifecycle_v1(
      $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32)`,
  [session, owner, turns.assistantTurn, assistantBatch, JSON.stringify(payload.assistantUnits), ...PROVENANCE, JSON.stringify(payload.assistantBundles), ...FOCUS_PROVENANCE,
    JSON.stringify(payload.assistantThreads), ...THREAD_PROVENANCE, JSON.stringify(otherProvenance), ...CONTINUITY_PROVENANCE.slice(0, 6), 'thread-lifecycle-reducer-v2']), 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT');

  // Legacy / partial shapes: each is PARTIAL, fails readiness, and blocks the runtime context.
  const shapes = [
    ['a legacy T-03A2-only batch', async (s, t) => { const b = randomUUID(); await legacyCommit(s, owner, t.userTurn, b, [unit(USER_TEXT, U1, 1, randomUUID())]); return [t.userTurn, b]; }],
    ['a B1-only batch', async (s, t) => { const b = randomUUID(); const id = randomUUID(); await focusOnlyCommit(s, owner, t.userTurn, b, [unit(USER_TEXT, U1, 1, id)], [bundle(id)]); return [t.userTurn, b]; }],
    ['a B2-only (0068-complete, no final Thread-layer capture) exchange', async (s, t) => {
      const ub = randomUUID(); const ab = randomUUID(); const id = randomUUID();
      await b2OnlyExchange(s, owner, t.userTurn, ub, [unit(USER_TEXT, U1, 1, id)], [bundle(id)], [noEstablishment(id, 'NO_INDEPENDENT_FOCUS')], t.assistantTurn, ab, [], [], []);
      return [t.userTurn, ub];
    }],
  ];
  for (const [label, build] of shapes) {
    await q('SAVEPOINT partial');
    const s = await newSession(owner);
    const t = await completedTurns(owner, s);
    const [turn, batch] = await build(s, t);
    const state = await snapshot(s, owner, turn, batch);
    strict(state.thread_semantic_capture_state, 'PARTIAL', `${label} is PARTIAL at the final Thread layer`);
    strict(state.thread_semantic_batch_exists, false, `${label} has no final capture batch`);
    strict(state.thread_semantic_capture_state, await semanticState(s, owner, turn, batch), 'the snapshot state IS the authority');
    const failure = await rejected(audit, 'THREAD_LIFECYCLE_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE/u);
    await rejected(() => runtimeContext(s, owner), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    await q('ROLLBACK TO SAVEPOINT partial');
    await q('RELEASE SAVEPOINT partial');
  }
  // A B2-only Thread (established through 0068 alone) has no dossier: the
  // context, the dossier page and the audit all fail closed rather than
  // silently ignoring it.
  await q('SAVEPOINT b2thread');
  {
    const s = await newSession(owner);
    const t = await completedTurns(owner, s);
    const id = randomUUID(); const handle = randomUUID(); const focus = randomUUID();
    await b2OnlyExchange(s, owner, t.userTurn, randomUUID(), [unit(USER_TEXT, U1, 1, id)],
      [bundle(id, { references: [resolved(U1, 'المدير', handle, true)], attention: startFocus(focus, 0) })],
      [establish(owner, id, focus, 'TE-01', [id], { explicit_selection_grounding: anchor(U1, 'المدير') })], t.assistantTurn, randomUUID(), [], [], []);
    const failure = await rejected(audit, 'THREAD_LIFECYCLE_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE/u);
    const versionNow = await versionOf(owner);
    const dossierFailure = await rejected(() => dossierPage(owner, versionNow, null, 32), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    assert.match(String(dossierFailure.detail ?? ''), /THREAD_WITHOUT_IDENTITY_DOSSIER/u);
    await rejected(() => runtimeContext(session, owner), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
  }
  await q('ROLLBACK TO SAVEPOINT b2thread');
  await q('RELEASE SAVEPOINT b2thread');

  // Structural corruption of an OTHERWISE complete B3 capture.
  const corruptions = [
    ['a deleted focus binding', [
      ['DELETE FROM public.conversation_thread_lifecycle_events WHERE session_id = $1', [session]],
      ['DELETE FROM public.conversation_thread_focus_bindings WHERE thread_id = $1', [world.threads.manager]]]],
    ['a deleted identity evidence row', [['DELETE FROM public.conversation_thread_identity_evidence WHERE thread_id = $1', [world.threads.manager]]]],
    ['a rebound focus (binding pointing at another Thread)', [['UPDATE public.conversation_thread_focus_bindings SET thread_id = $2 WHERE emerging_focus_id = $1', [world.focuses.ahmed, randomUUID()]]]],
    ['a lifecycle row with an impossible from_state', [['UPDATE public.conversation_thread_lifecycle_events SET from_state = $2 WHERE thread_id = $1', [world.threads.manager, 'REOPENED']]]],
    ['a lifecycle row at the wrong same-SP sequence claim', [['UPDATE public.conversation_thread_semantic_unit_results SET thread_layer_event_sequence = NULL WHERE cu_id = $1', [world.ids.u3]]]],
    ['an ambiguous outcome beside a permanent Thread mutation', [["UPDATE public.conversation_thread_semantic_unit_results SET outcome = 'IDENTITY_AMBIGUOUS', thread_id = NULL, candidate_thread_ids = ARRAY[$2::uuid, $3::uuid] WHERE cu_id = $1", [world.ids.u3, world.threads.manager, world.threads.ahmed]]]],
    ['a deleted unit result', [['DELETE FROM public.conversation_thread_semantic_unit_results WHERE cu_id = $1', [world.ids.u2]]]],
    ['a deleted permanent Home', [['DELETE FROM public.conversation_thread_homes WHERE thread_id = $1', [world.threads.manager]]]],
  ];
  for (const [label, statements] of corruptions) {
    await q('SAVEPOINT corrupt');
    await q("SET LOCAL session_replication_role = 'replica'");
    for (const [sql, values] of statements) await q(sql, values);
    await q("SET LOCAL session_replication_role = 'origin'");
    const state = await snapshot(session, owner, turns.userTurn, userBatch);
    strict(state.thread_semantic_capture_state, 'PARTIAL', `${label} makes the batch PARTIAL, never COMPLETE`);
    const failure = await rejected(audit, 'THREAD_LIFECYCLE_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_THREAD_LIFECYCLE_COMPLETE/u);
    await rejected(() => runtimeContext(session, owner), 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    await rejected(() => exchange(session, owner, turns.userTurn, userBatch, payload.userUnits, payload.userBundles, payload.userThreads, payload.userLifecycle,
      turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, FRESH()), 'THREAD_SEMANTIC_BATCH_INTEGRITY', ['55000']);
    await q('ROLLBACK TO SAVEPOINT corrupt');
    await q('RELEASE SAVEPOINT corrupt');
  }
  strict((await snapshot(session, owner, turns.userTurn, userBatch)).thread_semantic_capture_state, 'COMPLETE', 'the canonical world is exactly as it was: no repair, no backfill');
  eq(await worldSnapshot(), before, 'nothing above mutated the canonical world');

  // Zero-CU half and asymmetric exchange.
  const zs = await newSession(owner);
  const zt = await completedTurns(owner, zs, U1, A1);
  const zid = randomUUID(); const zub = randomUUID(); const zab = randomUUID();
  await exchange(zs, owner, zt.userTurn, zub, [unit(U1, U1, 1, zid)], [bundle(zid)], [noEstablishment(zid, 'NO_INDEPENDENT_FOCUS')], [noAction(zid)],
    zt.assistantTurn, zab, [], [], [], [], FRESH(await versionOf(owner)));
  const zero = await snapshot(zs, owner, zt.assistantTurn, zab);
  eq([zero.batch_exists, zero.committed_unit_count, zero.thread_capture_state, zero.thread_semantic_capture_state, zero.thread_semantic_batch_exists, zero.thread_semantic_unit_count],
    [true, 0, 'COMPLETE', 'COMPLETE', true, 0], 'a committed zero-CU half is COMPLETE at all four layers');
  eq(await clockOf(zs), { current_sp: 1, same_sp_event_sequence: '1' });
  // Asymmetric: USER complete at B3 + ASSISTANT absent fails before mutation.
  const as = await newSession(owner);
  const at = await completedTurns(owner, as, U1, A1);
  const aid = randomUUID(); const aub = randomUUID();
  await writer(as, owner, at.userTurn, aub, [unit(U1, U1, 1, aid)], [bundle(aid)], [noEstablishment(aid, 'NO_INDEPENDENT_FOCUS')], [noAction(aid)]);
  const asymBefore = await worldSnapshot();
  const asymVersion = await versionOf(owner);
  await rejected(() => exchange(as, owner, at.userTurn, aub, [unit(U1, U1, 1, aid)], [bundle(aid)], [noEstablishment(aid, 'NO_INDEPENDENT_FOCUS')], [noAction(aid)],
    at.assistantTurn, randomUUID(), [], [], [], [], FRESH(asymVersion)), 'THREAD_SEMANTIC_BATCH_INTEGRITY', ['55000']);
  eq(await worldSnapshot(), asymBefore, 'an asymmetric finalized exchange fails before any mutation');
}

// --------------------------------------------------------- G. atomic rollback
async function verifyAtomicRollback(owner) {
  stage = 'I. atomic rollback after every stage';
  const world = await sessionOne(owner);
  const { session, focuses, threads, handles } = world;
  const versionBefore = await versionOf(owner);
  const clockBefore = await clockOf(session);
  const focusNew = randomUUID(); const handleNew = randomUUID();
  const threadNew = threadIdOf(owner, focusNew);
  const ub = randomUUID();
  // A three-CU user batch: reopen the DORMANT manager, establish a new Thread (Work), bind nothing further.
  const WORK = 'نرجع لموضوع المدير. الشغل بقى ضاغط. خلاص.';
  const C1 = 'نرجع لموضوع المدير.'; const C2 = 'الشغل بقى ضاغط.'; const C3 = 'خلاص.';
  const turnsW = await completedTurns(owner, session, WORK, 'تمام.');
  const before = await worldSnapshot();
  const c = { c1: randomUUID(), c2: randomUUID(), c3: randomUUID() };
  const units = [unit(WORK, C1, 1, c.c1), unit(WORK, C2, 1, c.c2), unit(WORK, C3, 1, c.c3)];
  const bundles = [
    bundle(c.c1, { functions: ['REQUEST', 'FOCUS_SHIFT'], references: [resolved(C1, 'المدير', handles.manager, false)], attention: attendFocus(focuses.manager, 0, 'EXPLICIT_FOCUS_SHIFT') }),
    bundle(c.c2, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], references: [resolved(C2, 'الشغل', handleNew, true)], attention: startFocus(focusNew, 0, 'EXPLICIT_FOCUS_SHIFT') }),
    bundle(c.c3, { functions: ['ACKNOWLEDGE'], attention: NO_FOCUS }),
  ];
  const threadsPayload = [
    noEstablishment(c.c1, 'ALREADY_ESTABLISHED', focuses.manager),
    establish(owner, c.c2, focusNew, 'TE-01', [c.c2], { explicit_selection_grounding: anchor(C2, 'الشغل') }),
    noEstablishment(c.c3, 'NO_INDEPENDENT_FOCUS'),
  ];
  const good = [
    reopenExisting(session, c.c1, focuses.manager, threads.manager, [transition(session, c.c1, threads.ahmed, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
    establishNew(session, c.c2, focusNew, threadNew, [{ cu_id: c.c2, reference_index: 0 }], [transition(session, c.c2, threads.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
    noAction(c.c3),
  ];
  const run = (lc, th = threadsPayload) => writer(session, owner, turnsW.userTurn, ub, units, bundles, th, lc);
  // Failures injected after B1 (CU1 valid, CU2 invalid), after the identity clock lock / binding / evidence (CU2 establishes, CU3 malformed),
  // after the lifecycle insert (CU3 payload malformed), and after the semantic capture insert (last CU malformed): everything rolls back.
  const injections = [
    ['after B1 of CU2 (a malformed B3 decision)', () => run([good[0], { ...good[1], binding_kind: 'BOGUS' }, good[2]]), 'INVALID_THREAD_LIFECYCLE_PAYLOAD', ['22023']],
    ['after the Thread establishment + binding + evidence of CU2 (CU3 mismatched)', () => run([good[0], good[1], { ...good[2], unit_id: randomUUID() }]), 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH', ['22023']],
    ['after the lifecycle insert of CU1 (CU2 impossible transition)', () => run([good[0], { ...good[1], lifecycle_transitions: [transition(session, c.c2, threads.ahmed, 'REOPENED', 'GENUINE_RETURN')] }, good[2]]), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL', ['22023']],
    ['after B1 and the reopening of CU1 (the B2 layer refuses the promotion path of CU2)', () => run(good, [threadsPayload[0], { ...threadsPayload[1], path: 'TE-09' }, threadsPayload[2]]), 'INVALID_THREAD_PROMOTION_PATH', ['22023']],
    ['after the semantic capture insert (a unique violation seeded on the last unit result)', async () => {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q("INSERT INTO public.conversation_thread_semantic_unit_results(cu_id, commit_batch_id, user_id, session_id, session_position, outcome) VALUES ($1,$2,$3,$4,$5,'NO_THREAD_ACTION')",
        [c.c3, world.userBatch, owner, session, 999]);
      await q("SET LOCAL session_replication_role = 'origin'");
      return run(good);
    }, 'duplicate key', ['23505']],
    ['after the identity clock lock, the Home placement, the Thread and the focus binding of CU2 (an evidence collision seeded on its reference)', async () => {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q("INSERT INTO public.conversation_thread_identity_evidence(thread_id, evidence_ordinal, user_id, session_id, cu_id, reference_index, exact_surface, source_kind) VALUES ($1,998,$2,$3,$4,0,'x','ESTABLISHMENT')",
        [threads.ahmed, owner, session, c.c2]);
      await q("SET LOCAL session_replication_role = 'origin'");
      return run(good);
    }, 'duplicate key', ['23505']],
  ];
  for (const [label, attempt, token, codes] of injections) {
    await q('SAVEPOINT inject');
    let error;
    try { await attempt(); } catch (caught) { error = caught; }
    await q('ROLLBACK TO SAVEPOINT inject');
    await q('RELEASE SAVEPOINT inject');
    assertions += 1;
    assert.ok(error, `${label}: the writer failed`);
    assert.ok(codes.includes(error.code) && String(error.message).includes(token), `${label}: ${error.code} ${error.message}`);
    eq(await worldSnapshot(), before, `${label}: every row rolled back`);
    eq(await clockOf(session), clockBefore, `${label}: the clock rolled back`);
    strict(await versionOf(owner), versionBefore, `${label}: the identity version rolled back`);
  }
  // And the good payload commits: reopen + shared seq2 + establishment.
  const committed = await run(good);
  strict(committed.length, 3);
  eq((await lifecycleOf(session)).filter((e) => e.session_position >= 6).map((e) => [e.session_position, e.thread_id, e.from_state, e.to_state, e.reason_code]), [
    [6, threads.ahmed, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT'], [6, threads.manager, 'DORMANT', 'REOPENED', 'GENUINE_RETURN'],
    [7, threads.manager, 'REOPENED', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT'],
  ].sort((a, b) => a[0] - b[0] || byText(a[1], b[1])), 'binding + reopening + dormancy share seq2; REOPENED -> DORMANT on a genuine departure');
  eq((await resultsOf(ub)).map((x) => [x.outcome, x.seq]), [['REOPEN_EXISTING', '2'], ['ESTABLISH_NEW', '2'], ['NO_THREAD_ACTION', null]]);
  strict(await versionOf(owner), String(Number(versionBefore) + 1));
}

// ------------------------------------------------------------ H. immutability
async function verifyImmutability(owner, world) {
  stage = 'A. append-only tables and the monotonic identity clock';
  const { session, threads } = world;
  await rejected(() => q('DELETE FROM public.conversation_thread_focus_bindings WHERE session_id=$1', [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("UPDATE public.conversation_thread_focus_bindings SET binding_kind='SESSION_CONTINUITY' WHERE session_id=$1", [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_identity_evidence WHERE thread_id=$1', [threads.ahmed]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_lifecycle_events WHERE session_id=$1', [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("UPDATE public.conversation_thread_lifecycle_events SET to_state='ACTIVE' WHERE session_id=$1", [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_semantic_commit_batches WHERE session_id=$1', [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_thread_semantic_unit_results WHERE session_id=$1', [session]), 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1', [owner]), 'WORLD_THREAD_IDENTITY_CLOCK_IS_PERMANENT', ['55000']);
  await rejected(() => q('UPDATE public.conversation_world_thread_identity_clocks SET current_version = current_version + 2 WHERE user_id=$1', [owner]), 'WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC', ['55000']);
  await rejected(() => q('UPDATE public.conversation_world_thread_identity_clocks SET current_version = current_version - 1 WHERE user_id=$1', [owner]), 'WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC', ['55000']);
  await rejected(() => q("INSERT INTO public.conversation_thread_lifecycle_events(event_id, thread_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, transition_ordinal, from_state, to_state, reason_code) VALUES ($1,$2,$3,$4,$5,$6,1,2,0,'DORMANT','ACTIVE','CONTINUED_ANCHORING')",
    [randomUUID(), threads.manager, owner, session, world.ids.u1, world.userBatch]), 'thread_lifecycle_events_transition_check', ['23514']);
  await rejected(() => q("INSERT INTO public.conversation_thread_lifecycle_events(event_id, thread_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, transition_ordinal, from_state, to_state, reason_code) VALUES ($1,$2,$3,$4,$5,$6,1,2,0,'ACTIVE','REOPENED','GENUINE_RETURN')",
    [randomUUID(), threads.manager, owner, session, world.ids.u1, world.userBatch]), 'thread_lifecycle_events_transition_check', ['23514']);
  await rejected(() => q("INSERT INTO public.conversation_thread_lifecycle_events(event_id, thread_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, transition_ordinal, from_state, to_state, reason_code) VALUES ($1,$2,$3,$4,$5,$6,1,3,0,'ACTIVE','DORMANT','SUSTAINED_DEPARTURE')",
    [randomUUID(), threads.manager, owner, session, world.ids.u1, world.userBatch]), 'thread_lifecycle_events_position_check', ['23514']);
  // Application-role ACL: every new read and write is unreachable.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => snapshot(session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
    await rejected(() => runtimeContext(session, owner), 'permission denied', ['42501']);
    await rejected(() => dossierPage(owner, 0, null, 32), 'permission denied', ['42501']);
    await rejected(audit, 'permission denied', ['42501']);
    await rejected(() => semanticState(session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
  }
  await identity('service_role');
  const [legacy] = await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)', [session, owner, world.turns.userTurn, world.userBatch]);
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
      await audit();
      assertions += 1;
      const world = await verifySessionOne(owner);
      await rejected(() => runtimeContext(world.session, other), 'FORBIDDEN', ['42501']);
      await verifyCrossSessionContinuity(owner, world);
      await verifyAmbiguityAndDistinctness(owner, world);
      await verifyLifecycle(owner);
      await verifyReplayAndCorruption(owner, world);
      await verifyAtomicRollback(owner);
      await verifyImmutability(owner, world);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    console.log(`Verified migration 0070 (${assertions} assertions): focus -> Thread bindings (establishment and later-Session continuity, one Thread per focus forever, one focus per Thread per Session, the original grounding focus immutable); source-grounded identity evidence (canonical RESOLVED B1 grounding only, exact surfaces, derived for establishment, dossier-only prior refs); cross-Session continuity reuses the SAME Thread and the SAME Home with no second placement, same-name ambiguity blocks a duplicate Thread, a relational focus stays distinct; the user/world Thread Identity Clock advances on a new Thread and on a continuity binding only and fails STALE_THREAD_IDENTITY_CONTEXT (40001) exactly; the Session-local lifecycle (ACTIVE baseline through the binding, explicit-shift and second-away sustained dormancy never backdated, a brief clarification never dormant, DORMANT -> REOPENED, REOPENED -> ACTIVE, REOPENED -> DORMANT, impossible transitions refused, the SQL reducer re-derives every stored row); B1 keeps seq1 and the whole Thread layer shares at most one seq2 (seq3 next); exact replay mutates nothing, legacy / B2-only / partial / corrupt shapes are PARTIAL and fail THREAD_LIFECYCLE_CUTOVER_NOT_READY; every injected failure rolls back atomically; and nothing is granted, revoked, backfilled or reachable by an application role.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Thread lifecycle / cross-Session continuity verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
