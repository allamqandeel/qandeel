// Real-PostgreSQL verifier for migration 0071 - Effective Live Focus + FINAL
// Same-SP Semantic Chain + Production Authority Cutover v1 (T-03D).
//
// Proves against live semantics, never grep alone: the cutover posture (the
// FINAL coordinator is the ONE committing function executable by
// service_role, the temporary T-03A2 producer and coordinator are retired, no
// temporal-only fallback writer is granted, the authenticated LF reads exist
// and nothing else is reachable); the LF domain (exactly NONE / EMERGING /
// THREAD, no label / Home / content / score column); the deterministic LF
// reducer (LF-01 new independent focus, LF-02 unchanged through attention and
// through a brief local clarification, LF-03 explicit replacement and
// return, same-Moment Emerging -> Thread promotion, LF-04 conservative
// departure ONLY under exact committed FOCUS_SHIFT evidence, never for an
// anchored shift, never for a clarification) re-derived by the database for
// every CU and refusing any payload that differs; the frozen same-SP rule (B1
// seq 1, the Thread layer at most one seq 2, an LF transition at seq 2 when no
// Thread-layer event exists and seq 3 after a Thread-layer seq 2, nothing for
// an unchanged LF, no sealed SP reopened); AF66-01 (Session Semantic Clock
// FIRST) in the deployed writer body; both exact typed stale tokens through
// the FINAL coordinator with no third authority; exact replay, legacy / B1 /
// B2 / B3-only and corrupt shapes (PARTIAL, never upgraded, never a fallback);
// atomic rollback after every stage; append-only LF truth; and the
// owner-scoped LF snapshot / catch-up delivery. Every fixture is rolled back.
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
const FINAL_WRITER = 'public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text)';
const FINAL_COORDINATOR = 'public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)';
const FINAL_SNAPSHOT = 'public.get_conversation_full_semantic_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const FINAL_CONTEXT = 'public.get_conversation_full_semantic_runtime_context_v1(uuid,uuid)';
const LF_STATE_READ = 'public.get_session_live_state_v1(uuid)';
const LF_EVENTS_READ = 'public.get_live_focus_transition_events_v1(uuid,integer,integer)';
const LF_VALIDATOR = 'public.validate_conversation_live_focus_decision_v1(public.conversation_units,jsonb)';
const LF_PERSIST = 'public.persist_conversation_live_focus_transition_v1(public.conversation_units,uuid,text,uuid,text,uuid,text,bigint)';
const LF_REDUCER = 'public.derive_conversation_effective_live_focus_v1(public.conversation_units)';
const LF_BEFORE = 'public.conversation_session_live_focus_before_v1(uuid,integer)';
const LF_CURRENT = 'public.conversation_session_current_live_focus_v1(uuid,uuid)';
const LF_IDENTITY = 'public.canonical_live_focus_transition_id_v1(uuid,uuid,text,uuid)';
const FULL_STATE = 'public.conversation_full_semantic_batch_state_v1(uuid,uuid,uuid,uuid)';
const READINESS_AUDIT = 'public.assert_conversation_full_semantic_chain_cutover_ready_v1()';
const DOSSIER_PAGE = 'public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)';
const LIFECYCLE_WRITER = 'public.commit_conversation_units_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text)';
const LIFECYCLE_COORDINATOR = 'public.commit_finalized_exchange_with_focus_thread_lifecycle_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,integer,bigint,bigint)';
const LIFECYCLE_SNAPSHOT = 'public.get_conversation_thread_lifecycle_integrated_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const LIFECYCLE_CONTEXT = 'public.get_conversation_thread_lifecycle_runtime_context_v1(uuid,uuid)';
const LIFECYCLE_AUDIT = 'public.assert_conversation_thread_lifecycle_cutover_ready_v1()';
const THREAD_WRITER = 'public.commit_conversation_units_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer)';
const THREAD_COORDINATOR = 'public.commit_finalized_exchange_with_focus_and_thread_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,integer,bigint)';
const FOCUS_WRITER = 'public.commit_conversation_units_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer)';
const FOCUS_COORDINATOR = 'public.commit_finalized_exchange_with_focus_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,integer,bigint)';
const SAME_SP_HELPER = 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
const LEGACY_PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_COORDINATOR = 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
const LEGACY_SNAPSHOT = 'public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)';
const TEMPORAL_STATE = 'public.get_session_temporal_state_v1(uuid)';
const DELIVERY_EVENTS = 'public.get_conversational_units_committed_events_v1(uuid,integer,integer)';
const LF_TABLES = ['conversation_live_focus_transitions', 'conversation_live_focus_commit_batches'];
const SEMANTIC_TABLES = [
  'conversation_world_thread_identity_clocks', 'conversation_thread_focus_bindings', 'conversation_thread_identity_evidence',
  'conversation_thread_lifecycle_events', 'conversation_thread_semantic_commit_batches', 'conversation_thread_semantic_unit_results',
  'conversation_world_spatial_authorities', 'conversation_threads', 'conversation_thread_homes',
  'conversation_thread_establishment_events', 'conversation_thread_establishment_evidence',
  'conversation_thread_origin_members', 'conversation_thread_commit_batches',
  'conversation_units', 'conversation_unit_commit_batches', 'conversation_unit_commit_events', 'conversation_focus_commit_batches',
  'conversation_unit_focus_semantics', 'conversation_emerging_focus_attention_events', 'conversation_emerging_focuses', 'session_semantic_clocks'];

const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// ---------------------------------------------- canonical identity vectors
// The exact derivations of durable-thread-canonicalizer.ts,
// durable-thread-lifecycle-canonicalizer.ts and durable-live-focus-canonicalizer.ts.
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
const LIVE_FOCUS_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const bindingIdOf = (sessionId, focusId, threadId) => uuidV5(BINDING_NAMESPACE, `${sessionId}:${focusId}:${threadId}`);
const eventIdOf = (sessionId, cuId, threadId, toState) => uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
const lfEventIdOf = (sessionId, cuId, kind, ref) => uuidV5(LIVE_FOCUS_NAMESPACE, `${sessionId}:${cuId}:${kind}:${ref ?? 'NONE'}`);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ------------------------------------------------------- the shared scenario
// Session 1 (Egyptian Arabic), exactly T-03B3's: the manager (CU1, explicit
// selection), an incidental Ahmed mention inside a reported claim (CU2), Ahmed
// as a direct concern (CU3, explicit shift, manager as RESOLVED Origin); the
// assistant attends Ahmed twice. Later Sessions return to Ahmed, name an
// ambiguous Ahmed, or reframe the relationship; a fresh world exercises the
// lifecycle, the conservative departure and the Emerging-only Live Focus.
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
const NO_FOCUS_CLARIFICATION = { ...NO_FOCUS, reason: 'LOCAL_CLARIFICATION_OR_CORRECTION' };
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

// ---------------------------------------------- the canonical LF payloads
/** A CU whose effective LF CHANGED to (kind, ref) for `reason`: exactly the six frozen keys, identity derived. */
const lfChange = (session, unitId, kind, ref, reason) => ({
  unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: true, reason_code: reason,
  transition_event_id: lfEventIdOf(session, unitId, kind, ref),
});
/** A CU whose effective LF is (kind, ref) and did not change. */
const lfSame = (unitId, kind, ref) => ({ unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: false, reason_code: null, transition_event_id: null });
const lfNone = (unitId) => lfSame(unitId, 'NONE', null);

const exchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_full_semantic_chain_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
    $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
  [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads), JSON.stringify(userLifecycle), JSON.stringify(userLiveFocus),
    assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads), JSON.stringify(assistantLifecycle), JSON.stringify(assistantLiveFocus),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, token.sp, token.seq, token.version]);
const writer = (session, user, turn, batch, units, bundles, threads, lifecycles, liveFocus, reducerVersion = LF_REDUCER_VERSION) =>
  rows(`SELECT * FROM commit_conversation_units_with_full_semantic_chain_v1(
    $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34)`,
  [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE,
    JSON.stringify(threads), ...THREAD_PROVENANCE, JSON.stringify(lifecycles), ...CONTINUITY_PROVENANCE, JSON.stringify(liveFocus), reducerVersion]);
const lifecycleExchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_focus_thread_lifecycle_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
    $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)`,
  [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads), JSON.stringify(userLifecycle),
    assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads), JSON.stringify(assistantLifecycle),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, token.sp, token.seq, token.version]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)', [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const legacyExchange = (session, user, userTurn, userBatch, userUnits, assistantTurn, assistantBatch, assistantUnits) =>
  rows('SELECT * FROM commit_finalized_exchange_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits), assistantTurn, assistantBatch, JSON.stringify(assistantUnits), ...PROVENANCE]);
const focusOnlyCommit = (session, user, turn, batch, units, bundles) =>
  rows('SELECT * FROM commit_conversation_units_with_focus_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)',
    [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE, JSON.stringify(bundles), ...FOCUS_PROVENANCE]);
const b2OnlyExchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads) =>
  rows('SELECT * FROM commit_finalized_exchange_with_focus_and_thread_v1($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)',
    [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads),
      assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads),
      ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, null, 0]);

const snapshot = async (session, user, turn, batch) =>
  (await rows('SELECT * FROM get_conversation_full_semantic_integrated_batch_snapshot_v1($1,$2,$3,$4)', [session, user, turn, batch]))[0];
const runtimeContext = async (session, user) =>
  (await rows('SELECT * FROM get_conversation_full_semantic_runtime_context_v1($1,$2)', [session, user]))[0];
const dossierPage = (user, version, after, limit) =>
  rows('SELECT * FROM get_conversation_thread_identity_dossier_page_v1($1,$2,$3,$4)', [user, version, after, limit]);
const fullState = async (session, user, turn, batch) =>
  (await rows('SELECT public.conversation_full_semantic_batch_state_v1($1,$2,$3,$4) state', [session, user, turn, batch]))[0].state;
const lfBefore = async (session, before) =>
  (await rows('SELECT live_focus_kind kind, live_focus_ref ref, live_focus_sp sp FROM public.conversation_session_live_focus_before_v1($1,$2)', [session, before]))[0];
const lfCurrent = async (session, user) =>
  (await rows('SELECT live_focus_kind kind, live_focus_ref ref, live_focus_sp sp FROM public.conversation_session_current_live_focus_v1($1,$2)', [session, user]))[0];
const derive = async (cu) =>
  (await rows('SELECT d.prior_kind, d.prior_ref, d.effective_kind, d.effective_ref, d.changed, d.reason_code FROM public.conversation_units u, LATERAL public.derive_conversation_effective_live_focus_v1(u) d WHERE u.id=$1', [cu]))[0];
const audit = () => q('SELECT assert_conversation_full_semantic_chain_cutover_ready_v1()');
const liveState = (session) => rows('SELECT * FROM get_session_live_state_v1($1)', [session]);
const lfEvents = (session, after, limit) => rows('SELECT * FROM get_live_focus_transition_events_v1($1,$2,$3)', [session, after, limit]);
const clockOf = async (session) =>
  (await rows('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session]))[0];
const versionOf = async (user) =>
  (await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1), 0)::text v', [user]))[0].v;
const transitionsOf = (session) =>
  rows('SELECT cu_id, commit_batch_id, session_position sp, same_sp_event_sequence::text seq, from_kind, from_ref, to_kind, to_ref, reason_code, event_id FROM public.conversation_live_focus_transitions WHERE session_id=$1 ORDER BY session_position', [session]);
const lfBatchOf = async (batch) =>
  (await rows('SELECT unit_count, transition_count, lf_reducer_version, length(canonical_fingerprint) digest FROM public.conversation_live_focus_commit_batches WHERE commit_batch_id=$1', [batch]))[0];
const resultsOf = (batch) =>
  rows('SELECT cu_id, outcome, thread_id, thread_layer_event_sequence::text seq FROM public.conversation_thread_semantic_unit_results WHERE commit_batch_id=$1 ORDER BY session_position', [batch]);
const homeOf = async (thread) =>
  (await rows('SELECT thread_id, home_anchor_id, placement_x::text x, placement_y::text y, placement_attempt FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]))[0];
const FRESH = (version = '0') => ({ sp: null, seq: 0, version });
const lfOf = (result) => ({ kind: result.live_focus_kind, ref: result.live_focus_ref, sp: result.live_focus_sp });
const lfTransitionsOf = (result) => result.live_focus_transitions.map((t) => [t.session_position, t.to_kind, t.to_ref]);

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

/** Every row 0071 (or anything it calls) could ever touch, for the zero-mutation proofs. */
async function worldSnapshot() {
  const out = {};
  for (const table of [...LF_TABLES, ...SEMANTIC_TABLES]) {
    out[table] = (await rows(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).map((r) => r.row);
  }
  return out;
}

/**
 * Session 1 of the shared scenario through the FINAL coordinator. Effective LF:
 *   SP1 U1 manager established        NONE            -> THREAD(manager)  NEW_INDEPENDENT_FOCUS  seq 3
 *   SP2 U2 incidental Ahmed mention    THREAD(manager)  unchanged (no FOCUS_SHIFT, no focus)
 *   SP3 U3 explicit shift to Ahmed     THREAD(manager) -> THREAD(ahmed)    FOCUS_REPLACEMENT      seq 3
 *   SP4 A1 attends Ahmed               unchanged
 *   SP5 A2 brief local clarification   unchanged
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
    establishNew(session, ids.u3, focuses.ahmed, threads.ahmed, [{ cu_id: ids.u3, reference_index: 0 }],
      [transition(session, ids.u3, threads.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const userLiveFocus = [
    lfChange(session, ids.u1, 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'),
    lfSame(ids.u2, 'THREAD', threads.manager),
    lfChange(session, ids.u3, 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT'),
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
  const assistantLiveFocus = [lfSame(ids.a1, 'THREAD', threads.ahmed), lfSame(ids.a2, 'THREAD', threads.ahmed)];
  const payload = { userUnits, userBundles, userThreads, userLifecycle, userLiveFocus, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus };
  const [result] = await exchange(session, owner, turns.userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
    turns.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, FRESH(await versionOf(owner)));
  return { session, turns, ids, handles, focuses, threads, userBatch, assistantBatch, result, payload };
}
const replayArgs = (world, token) => [world.session, world.owner ?? null, world.turns.userTurn, world.userBatch, world.payload.userUnits, world.payload.userBundles, world.payload.userThreads, world.payload.userLifecycle, world.payload.userLiveFocus,
  world.turns.assistantTurn, world.assistantBatch, world.payload.assistantUnits, world.payload.assistantBundles, world.payload.assistantThreads, world.payload.assistantLifecycle, world.payload.assistantLiveFocus, token];

// ---------------------------------------------------------------- A. static
async function verifyStaticAuthority() {
  stage = 'A. schema / privilege / cutover posture / immutability declarations';
  const lfFunctions = [[FINAL_WRITER, 'final writer'], [FINAL_COORDINATOR, 'final coordinator'], [FINAL_SNAPSHOT, 'final snapshot'], [FINAL_CONTEXT, 'final context'],
    [LF_STATE_READ, 'LF snapshot read'], [LF_EVENTS_READ, 'LF catch-up read'], [LF_VALIDATOR, 'LF validator'], [LF_PERSIST, 'LF persist'],
    [LF_REDUCER, 'LF reducer'], [LF_BEFORE, 'prior-LF authority'], [LF_CURRENT, 'current-LF authority'], [LF_IDENTITY, 'LF identity'],
    [FULL_STATE, 'full-chain completeness authority'], [READINESS_AUDIT, 'cutover-readiness audit']];
  for (const [signature, label] of lfFunctions) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `the ${label} exists with its exact signature`);
    const [contract] = await rows('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [signature]);
    strict(contract.owner, 'postgres', `${label} is postgres-owned`);
    strict(contract.definer, true, `${label} is SECURITY DEFINER`);
    ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${label} has a fixed search path`);
    if ([FINAL_SNAPSHOT, FINAL_CONTEXT, LF_VALIDATOR, LF_REDUCER, LF_BEFORE, LF_CURRENT, FULL_STATE, READINESS_AUDIT].includes(signature)) {
      strict(contract.volatility, 's', `${label} is STABLE: the database itself refuses any write from inside it`);
    }
    if (signature === LF_IDENTITY) strict(contract.volatility, 'i', 'the LF identity derivation is IMMUTABLE');
  }
  for (const signature of [LIFECYCLE_WRITER, LIFECYCLE_COORDINATOR, LIFECYCLE_SNAPSHOT, LIFECYCLE_CONTEXT, LIFECYCLE_AUDIT, DOSSIER_PAGE,
    THREAD_WRITER, THREAD_COORDINATOR, FOCUS_WRITER, FOCUS_COORDINATOR, SAME_SP_HELPER, LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT, TEMPORAL_STATE, DELIVERY_EVENTS]) {
    const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [signature]);
    strict(presence.present, true, `${signature} still exists: 0064-0070 are deployed and byte-identical`);
  }
  // THE CUTOVER POSTURE. service_role executes exactly the final coordinator,
  // its two reads, the 0070 dossier page and the T-03A2 snapshot read;
  // authenticated executes exactly the two LF delivery reads beside the two
  // T-03A2 delivery reads; anon executes nothing; no table is reachable.
  const serviceExecutable = [FINAL_COORDINATOR, FINAL_SNAPSHOT, FINAL_CONTEXT, DOSSIER_PAGE, LEGACY_SNAPSHOT];
  const authenticatedExecutable = [LF_STATE_READ, LF_EVENTS_READ, TEMPORAL_STATE, DELIVERY_EVENTS];
  const everything = [...lfFunctions.map(([signature]) => signature), DOSSIER_PAGE, LIFECYCLE_WRITER, LIFECYCLE_COORDINATOR, LIFECYCLE_SNAPSHOT, LIFECYCLE_CONTEXT, LIFECYCLE_AUDIT,
    THREAD_WRITER, THREAD_COORDINATOR, FOCUS_WRITER, FOCUS_COORDINATOR, SAME_SP_HELPER, LEGACY_PRODUCER, LEGACY_COORDINATOR, LEGACY_SNAPSHOT, TEMPORAL_STATE, DELIVERY_EVENTS];
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of everything) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      const expected = (role === 'service_role' && serviceExecutable.includes(signature)) || (role === 'authenticated' && authenticatedExecutable.includes(signature));
      strict(granted, expected, `${role} ${expected ? 'executes' : 'must not execute'} ${signature} after the T-03D cutover`);
    }
    for (const table of [...LF_TABLES, ...SEMANTIC_TABLES.filter((t) => t !== 'session_semantic_clocks')]) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        strict(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  // Exactly ONE committing function is executable by service_role: the
  // temporal-only T-03A2 producer and coordinator are retired, no fallback exists.
  const committing = await rows("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'commit\\_%' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY p.proname");
  eq(committing.map((r) => r.proname), ['commit_finalized_exchange_with_full_semantic_chain_v1'], 'exactly ONE committing function is executable by service_role after T-03D');
  // The LF domain and nothing beside it.
  const columns = async (table) => (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table])).map((c) => c.column_name);
  eq(await columns('conversation_live_focus_transitions'), ['event_id', 'user_id', 'session_id', 'cu_id', 'commit_batch_id', 'session_position', 'same_sp_event_sequence', 'from_kind', 'from_ref', 'to_kind', 'to_ref', 'reason_code', 'created_at'],
    'an LF transition is exactly a change of reference identity at (SP, sequence): no label, Home, content, score, direction or projection column');
  eq(await columns('conversation_live_focus_commit_batches'), ['commit_batch_id', 'user_id', 'session_id', 'source_turn_id', 'unit_count', 'transition_count', 'canonical_fingerprint', 'lf_reducer_version', 'created_at'],
    'the technical LF capture carries no SP and no same-SP sequence: it is not a Timeline object');
  eq(await columns('session_semantic_clocks'), ['session_id', 'user_id', 'current_sp', 'same_sp_event_sequence'], 'T-03D must not alter the Session Semantic Clock');
  for (const table of LF_TABLES) {
    const [{ rls }] = await rows('SELECT relrowsecurity rls FROM pg_class WHERE oid = $1::regclass', [`public.${table}`]);
    strict(rls, true, `${table} has row level security enabled`);
    const [{ n }] = await rows('SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal AND t.tgfoid = $2::regproc', [`public.${table}`, 'public.reject_conversation_live_focus_mutation_v1']);
    strict(n, 1, `${table} is append-only through the ONE immutability trigger`);
  }
  // Deployed bodies: the reads write nothing and read no timestamp; the
  // reducer reads no analytical, spatial or temporal input; AF66-01 holds.
  const bodyOf = async (signature) => (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [signature]))[0].definition;
  for (const [signature, label] of [[FINAL_SNAPSHOT, 'final snapshot'], [FINAL_CONTEXT, 'final context'], [LF_VALIDATOR, 'LF validator'], [LF_REDUCER, 'LF reducer'],
    [LF_BEFORE, 'prior-LF authority'], [LF_CURRENT, 'current-LF authority'], [FULL_STATE, 'completeness authority'], [READINESS_AUDIT, 'audit'], [LF_STATE_READ, 'LF snapshot read'], [LF_EVENTS_READ, 'LF catch-up read']]) {
    const body = await bodyOf(signature);
    ok(!/INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u.test(body), `the ${label} writes, backfills, repairs and deletes nothing`);
    ok(!/created_at|CURRENT_TIMESTAMP|now\(\)|clock_timestamp/u.test(body), `no timestamp participates in the ${label}`);
    ok(!/similar|embedding|score|confidence|importance|ILIKE|~\*/u.test(body), `no similarity, score or importance authority inside the ${label}`);
  }
  const reducerBody = await bodyOf(LF_REDUCER);
  ok(!/reading|hypothes|analysis|background|camera|viewport|inspection|placement_|thread_homes|home_anchor|interval|EXTRACT\(|age\(/iu.test(reducerBody), 'the LF reducer reads no analytical, spatial, camera or temporal input');
  for (const rule of ["'FOCUS_SHIFT' = ANY (sem.functions)", "att.attention_reason <> 'LOCAL_CLARIFICATION_OR_CORRECTION'", 'conversation_session_live_focus_before_v1(p_cu.session_id, p_cu.session_position)',
    "'THREAD_PROMOTION'", "'RETURN_TO_THREAD'", "'FOCUS_REPLACEMENT'", "'STABLE_DEPARTURE_NO_REPLACEMENT'", "'NEW_INDEPENDENT_FOCUS'", 'b.bound_sp <= p_cu.session_position']) {
    ok(reducerBody.includes(rule), `the deployed reducer carries: ${rule}`);
  }
  const writerBody = await bodyOf(FINAL_WRITER);
  const clock = writerBody.indexOf('FROM public.session_semantic_clocks c');
  const turn = writerBody.indexOf('FROM public.conversation_turns t');
  const focusPersist = writerBody.indexOf('persist_conversation_unit_focus_semantics_v1(');
  const identityLock = writerBody.indexOf('FROM public.conversation_world_thread_identity_clocks w');
  const world = writerBody.indexOf('FROM public.conversation_world_spatial_authorities w');
  const lifecyclePersist = writerBody.indexOf('persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence)');
  const lfValidate = writerBody.indexOf('validate_conversation_live_focus_decision_v1(inserted_cu, lf_unit)');
  const lfPersist = writerBody.indexOf('persist_conversation_live_focus_transition_v1(');
  ok(clock > 0 && turn > clock && focusPersist > turn && identityLock > focusPersist && world > identityLock && lifecyclePersist > world && lfValidate > lifecyclePersist && lfPersist > lfValidate,
    'AF66-01 in the deployed body: Session clock FIRST -> source turn -> B1 rows -> identity clock -> spatial authority -> Thread-layer rows -> LF derived AFTER the final Thread-layer truth -> LF row');
  strict((writerBody.match(/FOR UPDATE/gu) ?? []).length, 4, 'exactly four row locks: Session clock, source turn, identity clock, spatial authority - LF adds no lock');
  strict((writerBody.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 3, 'the ONE T-03A2 seam: sequence 1 for B1, sequence 2 once for the Thread layer, once more for an LF transition');
  ok(writerBody.includes('CASE WHEN has_change THEN 3::bigint ELSE 2::bigint END'), 'an LF transition is exactly seq 3 after a Thread-layer seq 2 and exactly seq 2 otherwise');
  const coordinatorBody = await bodyOf(FINAL_COORDINATOR);
  ok(coordinatorBody.indexOf('FROM public.session_semantic_clocks c') < coordinatorBody.indexOf("'STALE_CONVERSATIONAL_FOCUS_CONTEXT'")
    && coordinatorBody.indexOf("'STALE_CONVERSATIONAL_FOCUS_CONTEXT'") < coordinatorBody.indexOf("'STALE_THREAD_IDENTITY_CONTEXT'")
    && coordinatorBody.indexOf("'STALE_THREAD_IDENTITY_CONTEXT'") < coordinatorBody.indexOf('commit_conversation_units_with_full_semantic_chain_v1('),
    'the Session clock is locked first, its token compared before the identity version, both before any writer; LF adds no third stale authority');
  strict((coordinatorBody.match(/ERRCODE='40001'/gu) ?? []).length, 2, 'exactly two exact typed stale conditions');
  // Pinned identity vectors reproduce, in SQL and in JS.
  const [vectors] = await rows(`SELECT public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333','11111111-2222-4333-8444-555555555555','NONE',NULL)::text n,
    public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333','11111111-2222-4333-8444-555555555555','EMERGING','4ef8538d-ddda-5e11-b7d9-052be85de59a')::text e,
    public.canonical_live_focus_transition_id_v1('33333333-3333-4333-8333-333333333333','11111111-2222-4333-8444-555555555555','THREAD','afc4fd81-fe54-5738-9545-e1053044d919')::text t`);
  eq([vectors.n, vectors.e, vectors.t], ['31ae1e67-d4f8-541a-8188-f9db29f6cc20', 'ebf823d1-1081-5ae2-94ac-aa69b9d62ccc', '12ac4f9b-1865-5bfd-8c5e-cebb1e178b98'], 'the frozen LF transition identity vectors reproduce');
  strict(LIVE_FOCUS_NAMESPACE, '14cd67f4-be9d-54f6-b735-cbe38a7cb311', 'the frozen namespace re-derives from its documented URI');
  eq([lfEventIdOf('33333333-3333-4333-8333-333333333333', '11111111-2222-4333-8444-555555555555', 'NONE', null),
    lfEventIdOf('33333333-3333-4333-8333-333333333333', '11111111-2222-4333-8444-555555555555', 'THREAD', 'afc4fd81-fe54-5738-9545-e1053044d919')],
  ['31ae1e67-d4f8-541a-8188-f9db29f6cc20', '12ac4f9b-1865-5bfd-8c5e-cebb1e178b98'], 'the JS derivation agrees');
}

// ----------------------------------------------------- B. Session 1 baseline
async function verifySessionOne(owner) {
  stage = 'B. new independent focus, unchanged through a Mention, explicit replacement, attention and clarification keep LF; seq 3 beside the Thread layer';
  await rejected(() => rows("SELECT public.canonical_live_focus_transition_id_v1($1,$2,'READING',NULL)", [randomUUID(), randomUUID()]), 'INVALID_LIVE_FOCUS_IDENTITY');
  await rejected(() => rows("SELECT public.canonical_live_focus_transition_id_v1($1,$2,'NONE',$3)", [randomUUID(), randomUUID(), randomUUID()]), 'INVALID_LIVE_FOCUS_IDENTITY');
  const world = await sessionOne(owner);
  world.owner = owner;
  const { session, ids, threads, focuses, userBatch, assistantBatch, result, turns } = world;
  eq([result.live_head, String(result.same_sp_event_sequence), String(result.world_thread_identity_version)], [5, '1', '2'], 'the exchange ends at SP5 / seq1 with two new Threads');
  eq(lfOf(result), { kind: 'THREAD', ref: threads.ahmed, sp: 3 }, 'the coordinator returns the current effective LF and the SP it became effective at');
  eq(lfTransitionsOf(result), [[1, 'THREAD', threads.manager], [3, 'THREAD', threads.ahmed]], 'the LF transitions of both halves, reference identity only, in SP order');
  eq(Object.keys(result.live_focus_transitions[0]).sort(), ['session_position', 'to_kind', 'to_ref'], 'no same-SP sequence, label or reason crosses the delivery boundary');
  const transitions = await transitionsOf(session);
  eq(transitions.map((t) => [t.cu_id, t.sp, t.seq, t.from_kind, t.from_ref, t.to_kind, t.to_ref, t.reason_code]), [
    [ids.u1, 1, '3', 'NONE', null, 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'],
    [ids.u3, 3, '3', 'THREAD', threads.manager, 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT'],
  ], 'LF-01 at SP1 and LF-03 at SP3, each at seq 3 after the Thread-layer seq 2; the Mention (SP2), the attention (SP4) and the brief clarification (SP5) leave LF unchanged and reserve nothing');
  eq(transitions.map((t) => t.event_id), [lfEventIdOf(session, ids.u1, 'THREAD', threads.manager), lfEventIdOf(session, ids.u3, 'THREAD', threads.ahmed)], 'transition identities are the derived ones');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.seq]), [['ESTABLISH_NEW', '2'], ['NO_THREAD_ACTION', null], ['ESTABLISH_NEW', '2']], 'the Thread layer kept its seq 2');
  eq(await clockOf(session), { current_sp: 5, same_sp_event_sequence: '1' }, 'the last Moment carries B1 alone: seq 1');
  eq(await lfBatchOf(userBatch), { unit_count: 3, transition_count: 2, lf_reducer_version: LF_REDUCER_VERSION, digest: 32 }, 'the technical LF capture of the user half');
  eq(await lfBatchOf(assistantBatch), { unit_count: 2, transition_count: 0, lf_reducer_version: LF_REDUCER_VERSION, digest: 32 }, 'an LF-unchanged half is captured as evaluated-and-unchanged, never as never-evaluated');
  eq(await lfCurrent(session, owner), { kind: 'THREAD', ref: threads.ahmed, sp: 3 });
  eq(await lfBefore(session, 1), { kind: 'NONE', ref: null, sp: null }, 'no LF before the first SP');
  eq(await lfBefore(session, 3), { kind: 'THREAD', ref: threads.manager, sp: 1 }, 'the prior LF of SP3 is the manager Thread');
  eq(await lfBefore(session, 4), { kind: 'THREAD', ref: threads.ahmed, sp: 3 });
  for (const [cu, expected] of [
    [ids.u1, ['NONE', null, 'THREAD', threads.manager, true, 'NEW_INDEPENDENT_FOCUS']],
    [ids.u2, ['THREAD', threads.manager, 'THREAD', threads.manager, false, null]],
    [ids.u3, ['THREAD', threads.manager, 'THREAD', threads.ahmed, true, 'FOCUS_REPLACEMENT']],
    [ids.a1, ['THREAD', threads.ahmed, 'THREAD', threads.ahmed, false, null]],
    [ids.a2, ['THREAD', threads.ahmed, 'THREAD', threads.ahmed, false, null]],
  ]) {
    const d = await derive(cu);
    eq([d.prior_kind, d.prior_ref, d.effective_kind, d.effective_ref, d.changed, d.reason_code], expected, `the SQL reducer re-derives ${cu} from durable rows alone`);
  }
  for (const [turn, batch] of [[turns.userTurn, userBatch], [turns.assistantTurn, assistantBatch]]) {
    strict(await fullState(session, owner, turn, batch), 'COMPLETE');
    const s = await snapshot(session, owner, turn, batch);
    eq([s.thread_semantic_capture_state, s.full_semantic_capture_state, s.live_focus_batch_exists], ['COMPLETE', 'COMPLETE', true]);
    eq([s.session_live_focus_kind, s.session_live_focus_ref, s.session_live_focus_sp], ['THREAD', threads.ahmed, 3], 'the snapshot carries the Session\'s current LF');
  }
  const userSnapshot = await snapshot(session, owner, turns.userTurn, userBatch);
  eq([userSnapshot.live_focus_unit_count, userSnapshot.live_focus_transition_count, userSnapshot.live_focus_transitions.map((t) => [t.session_position, t.to_kind, t.to_ref])],
    [3, 2, [[1, 'THREAD', threads.manager], [3, 'THREAD', threads.ahmed]]]);
  const context = await runtimeContext(session, owner);
  eq([context.base_current_sp, String(context.base_same_sp_event_sequence), String(context.world_thread_identity_version)], [5, '1', '2']);
  eq([context.current_live_focus_kind, context.current_live_focus_ref, context.current_live_focus_sp], ['THREAD', threads.ahmed, 3], 'the FINAL context carries the current effective LF beside the 0070 context');
  eq(Object.keys(context).length, 15, 'the FINAL context is the 0070 context plus exactly the three LF fields');
  await audit();
  assertions += 1;
  ok(await homeOf(threads.ahmed), 'the Ahmed Thread holds its permanent Home');
  strict(focuses.ahmed.length, 36);
  return world;
}

// ------------------------------------- C. adversarial LF payloads / tokens
async function verifyAdversarialPayloads(owner, world) {
  stage = 'C. no forced value, no invented or hidden transition, no authored reason or identity, exact tokens, nothing written';
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session);
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const threads = { manager: threadIdOf(owner, focuses.manager), ahmed: threadIdOf(owner, focuses.ahmed) };
  const version = await versionOf(owner);
  const userUnits = [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)];
  const userBundles = [
    bundle(ids.u1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
    bundle(ids.u2, { sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1, references: [resolved(U2, 'أحمد', handles.ahmed, true)],
      claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handles.ahmed, 'REPORTED_SPEECH')], attention: NO_FOCUS }),
    bundle(ids.u3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u2,
      references: [resolved(U3, 'أحمد', handles.ahmed, false)], attention: startFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  // The world already holds an Ahmed and a manager Thread (Session 1), so the
  // new focuses of this Session are DISTINCT_NEW establishments with Origins.
  const userThreads = [
    establish(owner, ids.u1, focuses.manager, 'TE-01', [ids.u1], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    noEstablishment(ids.u2, 'NO_INDEPENDENT_FOCUS'),
    establish(owner, ids.u3, focuses.ahmed, 'TE-01', [ids.u3], { explicit_selection_grounding: anchor(U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [threads.manager] }),
  ];
  const userLifecycle = [
    establishNew(session, ids.u1, focuses.manager, threads.manager, [{ cu_id: ids.u1, reference_index: 0 }]),
    noAction(ids.u2),
    establishNew(session, ids.u3, focuses.ahmed, threads.ahmed, [{ cu_id: ids.u3, reference_index: 0 }], [transition(session, ids.u3, threads.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const good = [lfChange(session, ids.u1, 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'), lfSame(ids.u2, 'THREAD', threads.manager), lfChange(session, ids.u3, 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT')];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, ids.a1)];
  const assistantBundles = [bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u3, references: [resolved(A1, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION') })];
  const assistantThreads = [noEstablishment(ids.a1, 'ALREADY_ESTABLISHED', focuses.ahmed)];
  const assistantLifecycle = [attendExisting(ids.a1, focuses.ahmed, threads.ahmed)];
  const assistantGood = [lfSame(ids.a1, 'THREAD', threads.ahmed)];
  const args = (userLf = good, assistantLf = assistantGood, token = FRESH(version)) => [session, owner, turns.userTurn, randomUUID(), userUnits, userBundles, userThreads, userLifecycle, userLf,
    turns.assistantTurn, randomUUID(), assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLf, token];
  const at = (index, patch) => good.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
  const before = await worldSnapshot();
  // Forced values, invented / hidden transitions, authored reasons.
  await rejected(() => exchange(...args(at(0, { effective_kind: 'EMERGING', effective_ref: focuses.manager, transition_event_id: lfEventIdOf(session, ids.u1, 'EMERGING', focuses.manager) }))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(at(0, { transition: false, reason_code: null, transition_event_id: null }))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(at(1, lfChange(session, ids.u2, 'EMERGING', focuses.ahmed, 'FOCUS_REPLACEMENT')))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(at(1, lfNone(ids.u2)))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(at(2, { reason_code: 'RETURN_TO_THREAD' }))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(at(2, { reason_code: 'THREAD_PROMOTION' }))), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(good, [lfChange(session, ids.a1, 'THREAD', threads.ahmed, 'RETURN_TO_THREAD')])), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...args(good, [lfNone(ids.a1)])), 'LIVE_FOCUS_NOT_CANONICAL');
  // Identity: derived, never authored.
  await rejected(() => exchange(...args(at(0, { transition_event_id: randomUUID() }))), 'INVALID_LIVE_FOCUS_IDENTITY');
  await rejected(() => exchange(...args(at(0, { transition_event_id: lfEventIdOf(session, ids.u1, 'THREAD', threads.ahmed) }))), 'INVALID_LIVE_FOCUS_IDENTITY');
  await rejected(() => exchange(...args(at(0, { transition_event_id: 'not-a-uuid' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  // Shape: exactly six keys, exactly three kinds, an unchanged LF carries nothing.
  await rejected(() => exchange(...args(at(0, { label: 'المدير' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(0, { home_anchor_id: randomUUID() }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(good.map((entry, i) => (i === 0 ? (({ reason_code: _r, ...rest }) => rest)(entry) : entry)))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(0, { effective_kind: 'READING' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(1, { effective_kind: 'NONE' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(1, { reason_code: 'FOCUS_REPLACEMENT' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(1, { transition_event_id: randomUUID() }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(0, { reason_code: 'BECAUSE' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(0, { transition: 'yes' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  await rejected(() => exchange(...args(at(0, { effective_ref: 'thread-1' }))), 'INVALID_LIVE_FOCUS_PAYLOAD');
  // Mapping: one canonical decision per proposed CU, in order.
  await rejected(() => exchange(...args(at(0, { unit_id: randomUUID() }))), 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH');
  await rejected(() => exchange(...args(good.slice(0, 2))), 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH');
  await rejected(() => exchange(...args([good[1], good[0], good[2]])), 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH');
  await rejected(() => rows(`SELECT * FROM commit_conversation_units_with_full_semantic_chain_v1(
      $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34)`,
  [session, owner, turns.userTurn, randomUUID(), JSON.stringify(userUnits), ...PROVENANCE, JSON.stringify(userBundles), ...FOCUS_PROVENANCE,
    JSON.stringify(userThreads), ...THREAD_PROVENANCE, JSON.stringify(userLifecycle), ...CONTINUITY_PROVENANCE, JSON.stringify(good), '']), 'INVALID_LIVE_FOCUS_PROVENANCE');
  // Both exact typed stale conditions through the FINAL coordinator: 40001, nothing written, LF adds no third authority.
  await rejected(() => exchange(...args(good, assistantGood, { sp: 9, seq: 0, version })), 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', ['40001']);
  await rejected(() => exchange(...args(good, assistantGood, { sp: null, seq: 1, version })), 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', ['40001']);
  await rejected(() => exchange(...args(good, assistantGood, FRESH(String(Number(version) + 1)))), 'STALE_THREAD_IDENTITY_CONTEXT', ['40001']);
  eq(await worldSnapshot(), before, 'every refused attempt wrote nothing: no CU, no SP, no clock coordinate, no LF row');
  eq(await clockOf(session), { current_sp: null, same_sp_event_sequence: '0' });
  // The canonical payload then commits: the LF rows are the DB derivation.
  const [result] = await exchange(...args());
  eq(lfOf(result), { kind: 'THREAD', ref: threads.ahmed, sp: 3 });
  eq((await transitionsOf(session)).map((t) => [t.sp, t.seq, t.to_kind, t.to_ref, t.reason_code]), [[1, '3', 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'], [3, '3', 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT']]);
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 4, 'this Session established its own two Threads beside Session 1\'s');
  ok(world.threads.ahmed !== threads.ahmed, 'distinct Sessions, distinct focuses, distinct canonical Threads');
}

// ---------------------------------------- D. continuity, ambiguity, promotion
async function verifyContinuityAndPromotion(owner, world) {
  stage = 'D. cross-Session continuity makes the reused Thread the LF; ambiguity keeps LF Emerging at seq 2; a later binding promotes it to the Thread';
  const { threads } = world;
  // Session 2: the user returns to Ahmed of the workplace.
  const session = await newSession(owner);
  const turns = await completedTurns(owner, session, RETURN_TEXT, RETURN_REPLY);
  const ids = { r1: randomUUID(), a1: randomUUID() };
  const handle = randomUUID();
  const focus = randomUUID();
  const userBatch = randomUUID();
  const assistantBatch = randomUUID();
  const versionBefore = await versionOf(owner);
  const homeBefore = await homeOf(threads.ahmed);
  const priorEvidence = [{ cu_id: world.ids.u3, exact_surface: 'أحمد' }];
  const [result] = await exchange(session, owner, turns.userTurn, userBatch, [unit(RETURN_TEXT, RETURN_TEXT, 1, ids.r1)],
    [bundle(ids.r1, { functions: ['REQUEST'], sequence_position: 'INITIATING', references: [resolved(RETURN_TEXT, 'أحمد', handle, true)], attention: startFocus(focus, 0) })],
    [noEstablishment(ids.r1, 'NO_PROMOTION_PATH_PROVEN', focus)],
    [activateExisting(session, ids.r1, focus, threads.ahmed, [{ cu_id: ids.r1, reference_index: 0 }], priorEvidence)],
    [lfChange(session, ids.r1, 'THREAD', threads.ahmed, 'NEW_INDEPENDENT_FOCUS')],
    turns.assistantTurn, assistantBatch, [unit(RETURN_REPLY, RETURN_REPLY, 1, ids.a1)],
    [bundle(ids.a1, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.r1, references: [resolved(RETURN_REPLY, 'أحمد', handle, false)], attention: attendFocus(focus, 0, 'DIRECT_SUBJECT') })],
    [noEstablishment(ids.a1, 'NO_PROMOTION_PATH_PROVEN', focus)], [attendExisting(ids.a1, focus, threads.ahmed)], [lfSame(ids.a1, 'THREAD', threads.ahmed)], FRESH(versionBefore));
  eq([result.live_head, String(result.world_thread_identity_version)], [2, String(Number(versionBefore) + 1)]);
  eq(lfOf(result), { kind: 'THREAD', ref: threads.ahmed, sp: 1 }, 'the FIRST appearance in a new Session binds the SAME canonical Thread and makes it the LF at that SP');
  eq((await transitionsOf(session)).map((t) => [t.sp, t.seq, t.from_kind, t.to_kind, t.to_ref, t.reason_code]), [[1, '3', 'NONE', 'THREAD', threads.ahmed, 'NEW_INDEPENDENT_FOCUS']],
    'a continuity binding is a Thread-layer seq 2, so the LF transition takes seq 3; a new Session starts from NONE, never from another Session\'s LF');
  eq(await homeOf(threads.ahmed), homeBefore, 'the same permanent Home is reused: LF names a Thread, never a coordinate');
  eq(await lfCurrent(world.session, owner), { kind: 'THREAD', ref: threads.ahmed, sp: 3 }, 'Session 1\'s LF is untouched: LF is Session-local');
  // A second same-name Ahmed (the brother) in his own Session.
  const brotherSession = await newSession(owner);
  const brotherTurns = await completedTurns(owner, brotherSession, 'أخويا أحمد زعلان مني.', 'ليه زعلان؟');
  const brother = { cu: randomUUID(), reply: randomUUID(), handle: randomUUID(), focus: randomUUID() };
  brother.thread = threadIdOf(owner, brother.focus);
  const [brotherResult] = await exchange(brotherSession, owner, brotherTurns.userTurn, randomUUID(), [unit('أخويا أحمد زعلان مني.', 'أخويا أحمد زعلان مني.', 1, brother.cu)],
    [bundle(brother.cu, { references: [resolved('أخويا أحمد زعلان مني.', 'أحمد', brother.handle, true)], attention: startFocus(brother.focus, 0) })],
    [establish(owner, brother.cu, brother.focus, 'TE-01', [brother.cu], { explicit_selection_grounding: anchor('أخويا أحمد زعلان مني.', 'أخويا أحمد') })],
    [establishNew(brotherSession, brother.cu, brother.focus, brother.thread, [{ cu_id: brother.cu, reference_index: 0 }])],
    [lfChange(brotherSession, brother.cu, 'THREAD', brother.thread, 'NEW_INDEPENDENT_FOCUS')],
    brotherTurns.assistantTurn, randomUUID(), [unit('ليه زعلان؟', 'ليه زعلان؟', 1, brother.reply)],
    [bundle(brother.reply, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: brother.cu, attention: attendFocus(brother.focus, null, 'DIRECT_REQUEST_OR_QUESTION') })],
    [noEstablishment(brother.reply, 'ALREADY_ESTABLISHED', brother.focus)], [attendExisting(brother.reply, brother.focus, brother.thread)], [lfSame(brother.reply, 'THREAD', brother.thread)], FRESH(await versionOf(owner)));
  eq(lfOf(brotherResult), { kind: 'THREAD', ref: brother.thread, sp: 1 });
  // "عايز أتكلم عن أحمد." - the evidence cannot choose: IDENTITY_AMBIGUOUS, so
  // the LF is the Emerging Focus itself, at seq 2 (no Thread-layer event).
  // The assistant's clarifying question then resolves it: the SAME canonical
  // Ahmed Thread is bound at the attending CU, and the LF is promoted from
  // EMERGING(focus) to THREAD(ahmed) at that same Moment - THREAD_PROMOTION, seq 3.
  const ambSession = await newSession(owner);
  const ambTurns = await completedTurns(owner, ambSession, AMBIGUOUS_TEXT, AMBIGUOUS_REPLY);
  const amb = { u: randomUUID(), a: randomUUID(), handle: randomUUID(), focus: randomUUID() };
  const candidates = [threads.ahmed, brother.thread];
  const ambVersion = await versionOf(owner);
  const ambUserBatch = randomUUID();
  const ambAssistantBatch = randomUUID();
  const ambArgs = (assistantLifecycle, assistantLf) => [ambSession, owner, ambTurns.userTurn, ambUserBatch, [unit(AMBIGUOUS_TEXT, AMBIGUOUS_TEXT, 1, amb.u)],
    [bundle(amb.u, { functions: ['REQUEST'], references: [resolved(AMBIGUOUS_TEXT, 'أحمد', amb.handle, true)], attention: startFocus(amb.focus, 0) })],
    [noEstablishment(amb.u, 'NO_PROMOTION_PATH_PROVEN', amb.focus)], [ambiguous(amb.u, amb.focus, candidates)],
    [lfChange(ambSession, amb.u, 'EMERGING', amb.focus, 'NEW_INDEPENDENT_FOCUS')],
    ambTurns.assistantTurn, ambAssistantBatch, [unit(AMBIGUOUS_REPLY, AMBIGUOUS_REPLY, 1, amb.a)],
    [bundle(amb.a, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: amb.u, references: [resolved(AMBIGUOUS_REPLY, 'أحمد', amb.handle, false)], attention: attendFocus(amb.focus, 0, 'DIRECT_REQUEST_OR_QUESTION') })],
    [noEstablishment(amb.a, 'NO_PROMOTION_PATH_PROVEN', amb.focus)], assistantLifecycle, assistantLf, FRESH(ambVersion)];
  // A payload that claims the Thread while the identity is still ambiguous is refused: LF never outruns the Thread layer.
  await rejected(() => exchange(...ambArgs([ambiguous(amb.a, amb.focus, candidates)], [lfChange(ambSession, amb.a, 'THREAD', threads.ahmed, 'THREAD_PROMOTION')])), 'LIVE_FOCUS_NOT_CANONICAL');
  // And an ambiguity kept ambiguous keeps the Emerging LF unchanged (proven in isolation, then rolled back).
  const stillAmbiguous = await isolated(async () => (await exchange(...ambArgs([ambiguous(amb.a, amb.focus, candidates)], [lfSame(amb.a, 'EMERGING', amb.focus)])))[0]);
  ok(!stillAmbiguous.error, `an unresolved ambiguity keeps LF at the Emerging Focus: ${stillAmbiguous.error?.message ?? ''}`);
  eq(lfOf(stillAmbiguous.value), { kind: 'EMERGING', ref: amb.focus, sp: 1 });
  eq(lfTransitionsOf(stillAmbiguous.value), [[1, 'EMERGING', amb.focus]]);
  eq(await clockOf(ambSession), { current_sp: null, same_sp_event_sequence: '0' }, 'the isolated proof rolled back');
  const [ambResult] = await exchange(...ambArgs(
    [activateExisting(ambSession, amb.a, amb.focus, threads.ahmed, [{ cu_id: amb.a, reference_index: 0 }], priorEvidence)],
    [lfChange(ambSession, amb.a, 'THREAD', threads.ahmed, 'THREAD_PROMOTION')]));
  eq(lfOf(ambResult), { kind: 'THREAD', ref: threads.ahmed, sp: 2 });
  eq((await transitionsOf(ambSession)).map((t) => [t.sp, t.seq, t.from_kind, t.from_ref, t.to_kind, t.to_ref, t.reason_code]), [
    [1, '2', 'NONE', null, 'EMERGING', amb.focus, 'NEW_INDEPENDENT_FOCUS'],
    [2, '3', 'EMERGING', amb.focus, 'THREAD', threads.ahmed, 'THREAD_PROMOTION'],
  ], 'an ambiguous start is EMERGING at seq 2 (no Thread-layer event); the later binding of the SAME focus promotes the LF to the Thread at seq 3');
  eq((await resultsOf(ambUserBatch)).map((r) => [r.outcome, r.seq]), [['IDENTITY_AMBIGUOUS', null]]);
  eq((await resultsOf(ambAssistantBatch)).map((r) => [r.outcome, r.seq]), [['ACTIVATE_EXISTING_IN_SESSION', '2']]);
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [owner]))[0].n, 5, 'no third Ahmed: ambiguity blocked the duplicate and continuity reused the Thread');
  await audit();
  assertions += 1;
  return { session, turns, ids, focus, userBatch, assistantBatch, brother, amb, ambSession, ambTurns, ambUserBatch, ambAssistantBatch };
}

// ------------------------------------------- E. lifecycle, departure, Emerging
async function verifyDepartureAndEmerging() {
  stage = 'E. replacement at establishment, return through a clarification, conservative departure only under exact FOCUS_SHIFT evidence, Emerging-only LF';
  const user = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [user]);
  const world = await sessionOne(user);
  world.owner = user;
  const { session, ids, focuses, threads, handles } = world;
  // Exchange 2 (SP6..SP10): work established (LF replaced), work elaborated
  // (Ahmed DORMANT, LF unchanged), a brief clarification returns to DORMANT
  // Ahmed (REOPENED; LF returns to Ahmed), an explicit return continues, the
  // assistant acknowledges.
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
    bundle(w.w3, { functions: ['ASK', 'CLARIFY'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3, references: [resolved(W3, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
    bundle(w.w4, { functions: ['REQUEST', 'FOCUS_SHIFT'], references: [resolved(W4, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  const userThreads = [
    establish(user, w.w1, work.focus, 'TE-01', [w.w1], { explicit_selection_grounding: anchor(W1, 'الشغل') }),
    noEstablishment(w.w2, 'ALREADY_ESTABLISHED', work.focus),
    noEstablishment(w.w3, 'ALREADY_ESTABLISHED', focuses.ahmed),
    noEstablishment(w.w4, 'ALREADY_ESTABLISHED', focuses.ahmed),
  ];
  const userLifecycle = [
    establishNew(session, w.w1, work.focus, work.thread, [{ cu_id: w.w1, reference_index: 0 }]),
    attendExisting(w.w2, work.focus, work.thread, [transition(session, w.w2, threads.ahmed, 'DORMANT', 'SUSTAINED_DEPARTURE')]),
    reopenExisting(session, w.w3, focuses.ahmed, threads.ahmed),
    attendExisting(w.w4, focuses.ahmed, threads.ahmed, [transition(session, w.w4, threads.ahmed, 'ACTIVE', 'CONTINUED_ANCHORING'), transition(session, w.w4, work.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const userLiveFocus = [
    lfChange(session, w.w1, 'THREAD', work.thread, 'FOCUS_REPLACEMENT'),
    lfSame(w.w2, 'THREAD', work.thread),
    lfChange(session, w.w3, 'THREAD', threads.ahmed, 'RETURN_TO_THREAD'),
    lfSame(w.w4, 'THREAD', threads.ahmed),
  ];
  const assistantUnits = [unit(REPLY2, REPLY2, 1, w.r)];
  const assistantBundles = [bundle(w.r, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: w.w4, references: [resolved(REPLY2, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_SUBJECT') })];
  const assistantThreads = [noEstablishment(w.r, 'ALREADY_ESTABLISHED', focuses.ahmed)];
  const assistantLifecycle = [attendExisting(w.r, focuses.ahmed, threads.ahmed)];
  const assistantLiveFocus = [lfSame(w.r, 'THREAD', threads.ahmed)];
  // The LF of W3 (the brief clarification) is a RETURN: the conservative rule
  // never lets a clarification CLEAR the LF, and a clarification anchored to a
  // different Thread genuinely moves attention there.
  await rejected(() => exchange(session, user, turns2.userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle,
    userLiveFocus.map((e, i) => (i === 2 ? lfSame(w.w3, 'THREAD', work.thread) : e)),
    turns2.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, { sp: 5, seq: 1, version: versionBefore }), 'LIVE_FOCUS_NOT_CANONICAL');
  const [result] = await exchange(session, user, turns2.userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
    turns2.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, { sp: 5, seq: 1, version: versionBefore });
  eq([result.live_head, String(result.same_sp_event_sequence)], [10, '1']);
  eq(lfOf(result), { kind: 'THREAD', ref: threads.ahmed, sp: 8 });
  eq((await transitionsOf(session)).map((t) => [t.sp, t.seq, t.from_kind, t.from_ref, t.to_kind, t.to_ref, t.reason_code]), [
    [1, '3', 'NONE', null, 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'],
    [3, '3', 'THREAD', threads.manager, 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT'],
    [6, '3', 'THREAD', threads.ahmed, 'THREAD', work.thread, 'FOCUS_REPLACEMENT'],
    [8, '3', 'THREAD', work.thread, 'THREAD', threads.ahmed, 'RETURN_TO_THREAD'],
  ], 'SP6 replaces (establishment); SP7 elaborates work while Ahmed goes DORMANT with NO LF change; SP8 returns to Ahmed (RETURN_TO_THREAD, seq 3 after the REOPENED seq 2); SP9 and SP10 keep it');
  eq((await resultsOf(userBatch)).map((r) => [r.outcome, r.seq]), [['ESTABLISH_NEW', '2'], ['ATTEND_EXISTING', '2'], ['REOPEN_EXISTING', '2'], ['ATTEND_EXISTING', '2']]);
  // Exchange 3 (SP11..SP14): the conservative departure. A FOCUS_SHIFT that
  // still targets the LF's own CU is anchored (unchanged); a FOCUS_SHIFT
  // inside a local clarification never clears (unchanged); a committed
  // FOCUS_SHIFT with no replacement and no anchoring target clears to NONE.
  const DEPART_TEXT = 'خلاص فهمت. طيب سؤال صغير عن الوقت. مش عايز أكمل في ده دلوقتي.';
  const D1 = 'خلاص فهمت.';
  const D2 = 'طيب سؤال صغير عن الوقت.';
  const D3 = 'مش عايز أكمل في ده دلوقتي.';
  const REPLY3 = 'تمام.';
  const turns3 = await completedTurns(user, session, DEPART_TEXT, REPLY3);
  const d = { d1: randomUUID(), d2: randomUUID(), d3: randomUUID(), r: randomUUID() };
  const departUnits = [unit(DEPART_TEXT, D1, 1, d.d1), unit(DEPART_TEXT, D2, 1, d.d2), unit(DEPART_TEXT, D3, 1, d.d3)];
  const departBundles = [
    bundle(d.d1, { functions: ['ACKNOWLEDGE', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: w.w4, attention: NO_FOCUS }),
    bundle(d.d2, { functions: ['ASK', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: null, attention: NO_FOCUS_CLARIFICATION }),
    bundle(d.d3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: null, attention: NO_FOCUS }),
  ];
  const departThreads = [noEstablishment(d.d1, 'NO_INDEPENDENT_FOCUS'), noEstablishment(d.d2, 'NO_INDEPENDENT_FOCUS'), noEstablishment(d.d3, 'NO_INDEPENDENT_FOCUS')];
  const departLifecycle = [noAction(d.d1), noAction(d.d2), noAction(d.d3)];
  const departLiveFocus = [lfSame(d.d1, 'THREAD', threads.ahmed), lfSame(d.d2, 'THREAD', threads.ahmed), lfChange(session, d.d3, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT')];
  const departReply = [unit(REPLY3, REPLY3, 1, d.r)];
  const departReplyBundles = [bundle(d.r, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: d.d3, attention: NO_FOCUS })];
  const departToken = { sp: 10, seq: 1, version: await versionOf(user) };
  const departArgs = (lf = departLiveFocus) => [session, user, turns3.userTurn, randomUUID(), departUnits, departBundles, departThreads, departLifecycle, lf,
    turns3.assistantTurn, randomUUID(), departReply, departReplyBundles, [noEstablishment(d.r, 'NO_INDEPENDENT_FOCUS')], [noAction(d.r)], [lfNone(d.r)], departToken];
  // Each conservative rule is enforced by the database, not merely by the client.
  await rejected(() => exchange(...departArgs([lfChange(session, d.d1, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT'), lfNone(d.d2), lfNone(d.d3)])), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...departArgs([lfSame(d.d1, 'THREAD', threads.ahmed), lfChange(session, d.d2, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT'), lfNone(d.d3)])), 'LIVE_FOCUS_NOT_CANONICAL');
  await rejected(() => exchange(...departArgs([lfSame(d.d1, 'THREAD', threads.ahmed), lfSame(d.d2, 'THREAD', threads.ahmed), lfSame(d.d3, 'THREAD', threads.ahmed)])), 'LIVE_FOCUS_NOT_CANONICAL');
  const [departed] = await exchange(...departArgs());
  eq([departed.live_head, lfOf(departed)], [14, { kind: 'NONE', ref: null, sp: 13 }], 'the departure is effective at SP13 and the assistant\'s acknowledgement keeps NONE');
  eq(lfTransitionsOf(departed), [[13, 'NONE', null]]);
  const departure = (await transitionsOf(session)).at(-1);
  eq([departure.sp, departure.seq, departure.from_kind, departure.from_ref, departure.to_kind, departure.to_ref, departure.reason_code], [13, '2', 'THREAD', threads.ahmed, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT'],
    'a departure with no Thread-layer event is seq 2; an anchored shift (SP11) and a clarification (SP12) never cleared it');
  eq(await lfCurrent(session, user), { kind: 'NONE', ref: null, sp: 13 });
  // Exchange 4 (SP15..SP17): Emerging-only LF. A new focus with no promotion
  // path is the LF itself; a second one replaces it; both at seq 2.
  const SPORT_TEXT = 'الرياضة بقت جزء من يومي. والقراية كمان رجعت لها.';
  const E1 = 'الرياضة بقت جزء من يومي.';
  const E2 = 'والقراية كمان رجعت لها.';
  const REPLY4 = 'حلو.';
  const turns4 = await completedTurns(user, session, SPORT_TEXT, REPLY4);
  const e = { e1: randomUUID(), e2: randomUUID(), r: randomUUID(), h1: randomUUID(), h2: randomUUID(), f1: randomUUID(), f2: randomUUID() };
  const [emerging] = await exchange(session, user, turns4.userTurn, randomUUID(), [unit(SPORT_TEXT, E1, 1, e.e1), unit(SPORT_TEXT, E2, 1, e.e2)],
    [bundle(e.e1, { references: [resolved(E1, 'الرياضة', e.h1, true)], attention: startFocus(e.f1, 0) }),
      bundle(e.e2, { references: [resolved(E2, 'القراية', e.h2, true)], attention: startFocus(e.f2, 0) })],
    [noEstablishment(e.e1, 'NO_PROMOTION_PATH_PROVEN', e.f1), noEstablishment(e.e2, 'NO_PROMOTION_PATH_PROVEN', e.f2)],
    // E2 is the second consecutive CU away from the ACTIVE Ahmed Thread: the
    // frozen 0070 reducer makes Ahmed DORMANT there (a Thread-layer seq 2), so
    // E2's Emerging LF transition takes seq 3 while E1's takes seq 2.
    [noAction(e.e1, e.f1), noAction(e.e2, e.f2, [transition(session, e.e2, threads.ahmed, 'DORMANT', 'SUSTAINED_DEPARTURE')])],
    [lfChange(session, e.e1, 'EMERGING', e.f1, 'NEW_INDEPENDENT_FOCUS'), lfChange(session, e.e2, 'EMERGING', e.f2, 'FOCUS_REPLACEMENT')],
    turns4.assistantTurn, randomUUID(), [unit(REPLY4, REPLY4, 1, e.r)], [bundle(e.r, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: e.e2, attention: NO_FOCUS })],
    [noEstablishment(e.r, 'NO_INDEPENDENT_FOCUS')], [noAction(e.r)], [lfSame(e.r, 'EMERGING', e.f2)], { sp: 14, seq: 1, version: await versionOf(user) });
  eq([emerging.live_head, lfOf(emerging)], [17, { kind: 'EMERGING', ref: e.f2, sp: 16 }]);
  eq((await transitionsOf(session)).slice(-2).map((t) => [t.sp, t.seq, t.from_kind, t.from_ref, t.to_kind, t.to_ref, t.reason_code]), [
    [15, '2', 'NONE', null, 'EMERGING', e.f1, 'NEW_INDEPENDENT_FOCUS'],
    [16, '3', 'EMERGING', e.f1, 'EMERGING', e.f2, 'FOCUS_REPLACEMENT'],
  ], 'an Emerging Focus is a direct LF value (seq 2 with no Thread-layer event); a later independent start replaces it (seq 3 beside the sustained-departure seq 2)');
  eq(await clockOf(session), { current_sp: 17, same_sp_event_sequence: '1' });
  // A later internal reservation on the last Moment becomes seq 2 (rolled back):
  // an unchanged LF reserved nothing on SP17.
  const probe = await isolated(async () => (await rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, user]))[0]);
  eq([probe.value.session_position, String(probe.value.event_sequence)], [17, '2'], 'an unchanged LF reserves no same-SP sequence');
  // The SQL reducer re-derives every stored decision of this Session.
  for (const cu of [ids.u1, ids.u2, ids.u3, ids.a1, ids.a2, w.w1, w.w2, w.w3, w.w4, w.r, d.d1, d.d2, d.d3, d.r, e.e1, e.e2, e.r]) {
    const derived = await derive(cu);
    const [stored] = await rows('SELECT from_kind, from_ref, to_kind, to_ref, reason_code FROM public.conversation_live_focus_transitions WHERE cu_id=$1', [cu]);
    if (stored) {
      eq([derived.changed, derived.prior_kind, derived.prior_ref, derived.effective_kind, derived.effective_ref, derived.reason_code], [true, stored.from_kind, stored.from_ref, stored.to_kind, stored.to_ref, stored.reason_code], `the SQL reducer re-derives the stored transition of ${cu}`);
    } else {
      eq([derived.changed, derived.reason_code], [false, null], `the SQL reducer re-derives "unchanged" for ${cu}`);
    }
  }
  await audit();
  assertions += 1;
  const context = await runtimeContext(session, user);
  eq([context.base_current_sp, context.current_live_focus_kind, context.current_live_focus_ref, context.current_live_focus_sp], [17, 'EMERGING', e.f2, 16]);
  return { user, world, work, session };
}

// -------------------------------------------- F. replay / partial / corrupt
async function verifyReplayAndCorruption(owner, world) {
  stage = 'F. exact replay, no upgrade of legacy / B1 / B2 / B3-only history, corruption is PARTIAL, zero-CU, asymmetric';
  const { session, turns, userBatch, assistantBatch, payload } = world;
  const before = await worldSnapshot();
  const [replayed] = await exchange(...replayArgs(world, { sp: 99, seq: 0, version: '999' }));
  eq([replayed.live_head, replayed.user_units.length, replayed.assistant_units.length, lfOf(replayed), lfTransitionsOf(replayed)],
    [5, 3, 2, { kind: 'THREAD', ref: world.threads.ahmed, sp: 3 }, [[1, 'THREAD', world.threads.manager], [3, 'THREAD', world.threads.ahmed]]],
    'an exact replay returns the stored delivery, LF included, and needs no token');
  eq(await worldSnapshot(), before, 'an exact replay mutates zero rows and zero clock coordinates');
  // A changed LF payload or LF provenance never replays.
  const changedLf = payload.userLiveFocus.map((entry, at) => (at === 1 ? lfChange(session, world.ids.u2, 'EMERGING', world.focuses.ahmed, 'FOCUS_REPLACEMENT') : entry));
  await rejected(() => exchange(session, owner, turns.userTurn, userBatch, payload.userUnits, payload.userBundles, payload.userThreads, payload.userLifecycle, changedLf,
    turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, payload.assistantLiveFocus, FRESH()), 'LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => writer(session, owner, turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, payload.assistantLiveFocus, 'live-focus-reducer-v2'), 'LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT');
  const changedLifecycle = payload.userLifecycle.map((entry, at) => (at === 2 ? { ...entry, lifecycle_transitions: [] } : entry));
  await rejected(() => exchange(session, owner, turns.userTurn, userBatch, payload.userUnits, payload.userBundles, payload.userThreads, changedLifecycle, payload.userLiveFocus,
    turns.assistantTurn, assistantBatch, payload.assistantUnits, payload.assistantBundles, payload.assistantThreads, payload.assistantLifecycle, payload.assistantLiveFocus, FRESH()), 'THREAD_SEMANTIC_BATCH_PAYLOAD_CONFLICT');
  eq(await worldSnapshot(), before, 'a refused replay mutates nothing');

  // Legacy / partial shapes: each is PARTIAL at the FINAL layer, fails
  // readiness, blocks the FINAL context, and is never upgraded by the FINAL
  // coordinator: there is no temporal-only fallback and no backfill.
  const shapes = [
    ['a legacy T-03A2-only batch', async (s, t) => { const b = randomUUID(); await legacyCommit(s, owner, t.userTurn, b, [unit(USER_TEXT, U1, 1, randomUUID())]); return [t.userTurn, b, null]; }],
    ['a legacy T-03A2-only exchange', async (s, t) => { const ub = randomUUID(); await legacyExchange(s, owner, t.userTurn, ub, [unit(USER_TEXT, U1, 1, randomUUID())], t.assistantTurn, randomUUID(), []); return [t.userTurn, ub, null]; }],
    ['a B1-only batch', async (s, t) => { const b = randomUUID(); const id = randomUUID(); await focusOnlyCommit(s, owner, t.userTurn, b, [unit(USER_TEXT, U1, 1, id)], [bundle(id)]); return [t.userTurn, b, null]; }],
    ['a B2-only (0068-complete) exchange', async (s, t) => {
      const ub = randomUUID(); const ab = randomUUID(); const id = randomUUID();
      await b2OnlyExchange(s, owner, t.userTurn, ub, [unit(USER_TEXT, U1, 1, id)], [bundle(id)], [noEstablishment(id, 'NO_INDEPENDENT_FOCUS')], t.assistantTurn, ab, [], [], []);
      return [t.userTurn, ub, null];
    }],
    ['a B3-only (0070-complete, no LF capture) exchange', async (s, t) => {
      const ub = randomUUID(); const ab = randomUUID(); const id = randomUUID();
      await lifecycleExchange(s, owner, t.userTurn, ub, [unit(USER_TEXT, U1, 1, id)], [bundle(id)], [noEstablishment(id, 'NO_INDEPENDENT_FOCUS')], [noAction(id)], t.assistantTurn, ab, [], [], [], [], FRESH(await versionOf(owner)));
      return [t.userTurn, ub, { id, ab }];
    }],
  ];
  for (const [label, build] of shapes) {
    await q('SAVEPOINT partial');
    const s = await newSession(owner);
    const t = await completedTurns(owner, s);
    const [turn, batch, b3] = await build(s, t);
    const state = await snapshot(s, owner, turn, batch);
    strict(state.full_semantic_capture_state, 'PARTIAL', `${label} is PARTIAL at the FINAL layer`);
    strict(state.live_focus_batch_exists, false, `${label} has no LF capture: "never evaluated" stays distinguishable`);
    strict(state.full_semantic_capture_state, await fullState(s, owner, turn, batch), 'the snapshot state IS the ONE authority');
    const failure = await rejected(audit, 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_FULL_SEMANTIC_CHAIN_COMPLETE/u);
    // The FINAL context delegates to the 0070 read first: history that is not
    // even B3-complete fails there (INCOMPLETE_PRIOR_THREAD_HISTORY); history
    // that IS B3-complete but LF-less fails at the FINAL layer with the
    // PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE detail. Either way: closed, never "no LF yet".
    const contextFailure = await rejected(() => runtimeContext(s, owner), b3 ? 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY' : 'INCOMPLETE_PRIOR_THREAD_HISTORY', ['55000']);
    if (b3) {
      assert.match(String(contextFailure.detail ?? ''), /PRIOR_BATCH_NOT_FULL_CHAIN_COMPLETE/u);
      strict(state.thread_semantic_capture_state, 'COMPLETE', 'a B3-complete batch without LF is COMPLETE at the Thread layer and PARTIAL at the FINAL layer');
      // The FINAL coordinator never upgrades it: no LF is backfilled from today's inference.
      const b3Version = await versionOf(owner);
      await rejected(() => exchange(s, owner, t.userTurn, batch, [unit(USER_TEXT, U1, 1, b3.id)], [bundle(b3.id)], [noEstablishment(b3.id, 'NO_INDEPENDENT_FOCUS')], [noAction(b3.id)], [lfNone(b3.id)],
        t.assistantTurn, b3.ab, [], [], [], [], [], FRESH(b3Version)), 'FULL_SEMANTIC_BATCH_INTEGRITY', ['55000']);
      await rejected(() => writer(s, owner, t.userTurn, batch, [unit(USER_TEXT, U1, 1, b3.id)], [bundle(b3.id)], [noEstablishment(b3.id, 'NO_INDEPENDENT_FOCUS')], [noAction(b3.id)], [lfNone(b3.id)]), 'FULL_SEMANTIC_BATCH_INTEGRITY', ['55000']);
      strict((await snapshot(s, owner, turn, batch)).live_focus_batch_exists, false, 'no repair, no backfill');
    }
    await q('ROLLBACK TO SAVEPOINT partial');
    await q('RELEASE SAVEPOINT partial');
  }

  // Structural corruption of an OTHERWISE complete FINAL capture.
  const { ids, focuses, threads } = world;
  const corruptions = [
    ['a deleted LF transition', [['DELETE FROM public.conversation_live_focus_transitions WHERE cu_id = $1', [ids.u3]]]],
    ['a deleted technical LF capture row', [['DELETE FROM public.conversation_live_focus_commit_batches WHERE commit_batch_id = $1', [userBatch]]]],
    ['a transition at the wrong same-SP sequence claim', [['UPDATE public.conversation_live_focus_transitions SET same_sp_event_sequence = 2 WHERE cu_id = $1', [ids.u1]]]],
    ['a transition to a value the reducer never derived', [['UPDATE public.conversation_live_focus_transitions SET to_kind = $2, to_ref = $3 WHERE cu_id = $1', [ids.u1, 'EMERGING', focuses.manager]]]],
    ['an authored reason', [['UPDATE public.conversation_live_focus_transitions SET reason_code = $2 WHERE cu_id = $1', [ids.u3, 'RETURN_TO_THREAD']]]],
    ['a broken chain (a from value that is not the previous to value)', [["UPDATE public.conversation_live_focus_transitions SET from_kind = 'NONE', from_ref = NULL, reason_code = 'NEW_INDEPENDENT_FOCUS' WHERE cu_id = $1", [ids.u3]]]],
    ['an extra transition where the LF did not change', [["INSERT INTO public.conversation_live_focus_transitions(event_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, from_kind, from_ref, to_kind, to_ref, reason_code) VALUES ($1,$2,$3,$4,$5,2,2,'THREAD',$6,'EMERGING',$7,'FOCUS_REPLACEMENT')",
      [lfEventIdOf(session, ids.u2, 'EMERGING', focuses.ahmed), owner, session, ids.u2, userBatch, threads.manager, focuses.ahmed]]]],
    ['a transition re-attributed to another batch', [['UPDATE public.conversation_live_focus_transitions SET commit_batch_id = $2 WHERE cu_id = $1', [ids.u3, assistantBatch]]]],
    ['a deleted Thread-layer unit result (the reused 0070 authority)', [['DELETE FROM public.conversation_thread_semantic_unit_results WHERE cu_id = $1', [ids.u2]]]],
    ['a deleted permanent Home (the reused 0068 authority)', [['DELETE FROM public.conversation_thread_homes WHERE thread_id = $1', [threads.manager]]]],
  ];
  for (const [label, statements] of corruptions) {
    await q('SAVEPOINT corrupt');
    await q("SET LOCAL session_replication_role = 'replica'");
    for (const [sql, values] of statements) await q(sql, values);
    await q("SET LOCAL session_replication_role = 'origin'");
    const state = await snapshot(session, owner, turns.userTurn, userBatch);
    strict(state.full_semantic_capture_state, 'PARTIAL', `${label} makes the batch PARTIAL, never COMPLETE`);
    const failure = await rejected(audit, 'FULL_SEMANTIC_CHAIN_CUTOVER_NOT_READY', ['55000']);
    assert.match(String(failure.detail ?? ''), /COMMIT_BATCH_NOT_FULL_SEMANTIC_CHAIN_COMPLETE/u);
    // A corruption of the reused 0070 / 0068 layers fails the delegated read first; an LF corruption fails at the FINAL layer.
    await rejected(() => runtimeContext(session, owner), label.includes('reused') ? 'INCOMPLETE_PRIOR_THREAD_HISTORY' : 'INCOMPLETE_PRIOR_SEMANTIC_HISTORY', ['55000']);
    await rejected(() => exchange(...replayArgs(world, FRESH())), 'FULL_SEMANTIC_BATCH_INTEGRITY', ['55000']);
    await q('ROLLBACK TO SAVEPOINT corrupt');
    await q('RELEASE SAVEPOINT corrupt');
  }
  strict((await snapshot(session, owner, turns.userTurn, userBatch)).full_semantic_capture_state, 'COMPLETE', 'the canonical world is exactly as it was: no repair, no backfill');
  eq(await worldSnapshot(), before, 'nothing above mutated the canonical world');

  // Zero-CU half and asymmetric exchange.
  const zs = await newSession(owner);
  const zt = await completedTurns(owner, zs, U1, A1);
  const zid = randomUUID(); const zub = randomUUID(); const zab = randomUUID();
  const [zero] = await exchange(zs, owner, zt.userTurn, zub, [unit(U1, U1, 1, zid)], [bundle(zid)], [noEstablishment(zid, 'NO_INDEPENDENT_FOCUS')], [noAction(zid)], [lfNone(zid)],
    zt.assistantTurn, zab, [], [], [], [], [], FRESH(await versionOf(owner)));
  eq([zero.live_head, lfOf(zero), lfTransitionsOf(zero)], [1, { kind: 'NONE', ref: null, sp: null }, []], 'a first CU without independent focus leaves LF NONE with no transition and no effective SP');
  const zeroHalf = await snapshot(zs, owner, zt.assistantTurn, zab);
  eq([zeroHalf.batch_exists, zeroHalf.committed_unit_count, zeroHalf.thread_semantic_capture_state, zeroHalf.full_semantic_capture_state, zeroHalf.live_focus_batch_exists, zeroHalf.live_focus_unit_count, zeroHalf.live_focus_transition_count],
    [true, 0, 'COMPLETE', 'COMPLETE', true, 0, 0], 'a committed zero-CU half is COMPLETE at all five layers');
  eq(await clockOf(zs), { current_sp: 1, same_sp_event_sequence: '1' });
  const as = await newSession(owner);
  const at = await completedTurns(owner, as, U1, A1);
  const aid = randomUUID(); const aub = randomUUID();
  await writer(as, owner, at.userTurn, aub, [unit(U1, U1, 1, aid)], [bundle(aid)], [noEstablishment(aid, 'NO_INDEPENDENT_FOCUS')], [noAction(aid)], [lfNone(aid)]);
  const asymBefore = await worldSnapshot();
  const asymVersion = await versionOf(owner);
  await rejected(() => exchange(as, owner, at.userTurn, aub, [unit(U1, U1, 1, aid)], [bundle(aid)], [noEstablishment(aid, 'NO_INDEPENDENT_FOCUS')], [noAction(aid)], [lfNone(aid)],
    at.assistantTurn, randomUUID(), [], [], [], [], [], FRESH(asymVersion)), 'FULL_SEMANTIC_BATCH_INTEGRITY', ['55000']);
  eq(await worldSnapshot(), asymBefore, 'an asymmetric finalized exchange fails before any mutation');
}

// --------------------------------------------------------- G. atomic rollback
async function verifyAtomicRollback(owner) {
  stage = 'G. atomic rollback after every stage, LF rows included; a sealed SP is never reopened';
  const world = await sessionOne(owner);
  const { session, focuses, threads, handles } = world;
  const versionBefore = await versionOf(owner);
  const clockBefore = await clockOf(session);
  const focusNew = randomUUID(); const handleNew = randomUUID();
  const threadNew = threadIdOf(owner, focusNew);
  const ub = randomUUID();
  // A three-CU user batch: reopen the DORMANT manager (LF returns), establish a new Thread (LF replaced), acknowledge (LF unchanged).
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
  const goodLf = [
    lfChange(session, c.c1, 'THREAD', threads.manager, 'RETURN_TO_THREAD'),
    lfChange(session, c.c2, 'THREAD', threadNew, 'FOCUS_REPLACEMENT'),
    lfSame(c.c3, 'THREAD', threadNew),
  ];
  const run = (lc = good, lf = goodLf, th = threadsPayload) => writer(session, owner, turnsW.userTurn, ub, units, bundles, th, lc, lf);
  const injections = [
    ['after B1 + Thread layer + LF of CU1 (CU2 hides its LF transition)', () => run(good, [goodLf[0], lfSame(c.c2, 'THREAD', threads.manager), goodLf[2]]), 'LIVE_FOCUS_NOT_CANONICAL', ['22023']],
    ['after the LF rows of CU1 and CU2 (CU3 invents a transition)', () => run(good, [goodLf[0], goodLf[1], lfChange(session, c.c3, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT')]), 'LIVE_FOCUS_NOT_CANONICAL', ['22023']],
    ['after the LF rows of CU1 and CU2 (CU3 authors an identity)', () => run(good, [goodLf[0], goodLf[1], { ...goodLf[2], transition_event_id: randomUUID() }]), 'INVALID_LIVE_FOCUS_PAYLOAD', ['22023']],
    ['after the LF row of CU1 (CU2 forges its transition identity)', () => run(good, [goodLf[0], { ...goodLf[1], transition_event_id: randomUUID() }, goodLf[2]]), 'INVALID_LIVE_FOCUS_IDENTITY', ['22023']],
    ['after B1 of CU2 (a malformed B3 decision, the reused 0070 gate)', () => run([good[0], { ...good[1], binding_kind: 'BOGUS' }, good[2]]), 'INVALID_THREAD_LIFECYCLE_PAYLOAD', ['22023']],
    ['after B1 and the reopening of CU1 (the reused B2 gate refuses the promotion path of CU2)', () => run(good, goodLf, [threadsPayload[0], { ...threadsPayload[1], path: 'TE-09' }, threadsPayload[2]]), 'INVALID_THREAD_PROMOTION_PATH', ['22023']],
    ['after the LF capture insert (a unique violation seeded on the LF transition identity of CU1)', async () => {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q("INSERT INTO public.conversation_live_focus_transitions(event_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, from_kind, from_ref, to_kind, to_ref, reason_code) VALUES ($1,$2,$3,$4,$5,2,2,'THREAD',$6,'THREAD',$7,'RETURN_TO_THREAD')",
        [lfEventIdOf(session, c.c1, 'THREAD', threads.manager), owner, session, c.c1, world.userBatch, threads.ahmed, threads.manager]);
      await q("SET LOCAL session_replication_role = 'origin'");
      return run();
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
    eq(await clockOf(session), clockBefore, `${label}: the clock rolled back - no sealed SP was reopened and no half-written Moment survives`);
    strict(await versionOf(owner), versionBefore, `${label}: the identity version rolled back`);
  }
  // And the good payload commits: return + replacement, each at seq 3 after the Thread-layer seq 2.
  const committed = await run();
  strict(committed.length, 3);
  eq((await transitionsOf(session)).filter((t) => t.sp >= 6).map((t) => [t.sp, t.seq, t.from_kind, t.from_ref, t.to_kind, t.to_ref, t.reason_code]), [
    [6, '3', 'THREAD', threads.ahmed, 'THREAD', threads.manager, 'RETURN_TO_THREAD'],
    [7, '3', 'THREAD', threads.manager, 'THREAD', threadNew, 'FOCUS_REPLACEMENT'],
  ], 'a genuine return to the DORMANT manager is RETURN_TO_THREAD; the new Thread replaces it; the acknowledgement changes nothing');
  eq((await resultsOf(ub)).map((x) => [x.outcome, x.seq]), [['REOPEN_EXISTING', '2'], ['ESTABLISH_NEW', '2'], ['NO_THREAD_ACTION', null]]);
  eq(await clockOf(session), { current_sp: 8, same_sp_event_sequence: '1' });
  strict(await versionOf(owner), String(Number(versionBefore) + 1));
}

// ------------------------------------------------ H. immutability and ACL
async function verifyImmutabilityAndAcl(owner, world, other) {
  stage = 'H. append-only LF truth, CHECK-level shape, application-role reachability, owner-scoped LF delivery';
  const { session, threads, ids } = world;
  await rejected(() => q('DELETE FROM public.conversation_live_focus_transitions WHERE session_id=$1', [session]), 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("UPDATE public.conversation_live_focus_transitions SET reason_code='RETURN_TO_THREAD' WHERE session_id=$1", [session]), 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.conversation_live_focus_commit_batches WHERE session_id=$1', [session]), 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("UPDATE public.conversation_live_focus_commit_batches SET lf_reducer_version='x' WHERE session_id=$1", [session]), 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE', ['55000']);
  const insert = (sp, seq, fromKind, fromRef, toKind, toRef, reason) => q(
    'INSERT INTO public.conversation_live_focus_transitions(event_id, user_id, session_id, cu_id, commit_batch_id, session_position, same_sp_event_sequence, from_kind, from_ref, to_kind, to_ref, reason_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [randomUUID(), owner, session, ids.u2, world.userBatch, sp, seq, fromKind, fromRef, toKind, toRef, reason]);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'THREAD', threads.manager, 'RETURN_TO_THREAD'), 'live_focus_transitions_change_check', ['23514']);
  await rejected(() => insert(2, 4, 'THREAD', threads.manager, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT'), 'live_focus_transitions_position_check', ['23514']);
  await rejected(() => insert(2, 1, 'THREAD', threads.manager, 'NONE', null, 'STABLE_DEPARTURE_NO_REPLACEMENT'), 'live_focus_transitions_position_check', ['23514']);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'READING', randomUUID(), 'FOCUS_REPLACEMENT'), 'live_focus_transitions_kind_check', ['23514']);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'NONE', randomUUID(), 'STABLE_DEPARTURE_NO_REPLACEMENT'), 'live_focus_transitions_shape_check', ['23514']);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'NONE', null, 'FOCUS_REPLACEMENT'), 'live_focus_transitions_reason_shape_check', ['23514']);
  await rejected(() => insert(2, 2, 'NONE', null, 'THREAD', threads.ahmed, 'RETURN_TO_THREAD'), 'live_focus_transitions_reason_shape_check', ['23514']);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'THREAD', threads.ahmed, 'THREAD_PROMOTION'), 'live_focus_transitions_reason_shape_check', ['23514']);
  await rejected(() => insert(2, 2, 'THREAD', threads.manager, 'THREAD', threads.ahmed, 'BECAUSE'), 'live_focus_transitions_reason_check', ['23514']);
  await rejected(() => insert(1, 2, 'THREAD', threads.manager, 'THREAD', threads.ahmed, 'RETURN_TO_THREAD'), 'live_focus_transitions_one_per_sp', ['23505']);
  await rejected(() => q("INSERT INTO public.conversation_live_focus_commit_batches(commit_batch_id, user_id, session_id, source_turn_id, unit_count, transition_count, canonical_fingerprint, lf_reducer_version) VALUES ($1,$2,$3,$4,1,2,sha256('x'::bytea),'v')",
    [randomUUID(), owner, session, world.turns.userTurn]), 'live_focus_batches_count_check', ['23514']);

  // Application-role reachability, live.
  const transitionsBefore = (await transitionsOf(session)).map((t) => [t.sp, t.to_kind, t.to_ref]);
  const current = await lfCurrent(session, owner);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => rows('SELECT * FROM get_conversation_thread_lifecycle_integrated_batch_snapshot_v1($1,$2,$3,$4)', [session, owner, world.turns.userTurn, world.userBatch]), 'permission denied', ['42501']);
    await rejected(() => rows('SELECT * FROM get_conversation_thread_lifecycle_runtime_context_v1($1,$2)', [session, owner]), 'permission denied', ['42501']);
    await rejected(audit, 'permission denied', ['42501']);
    await rejected(() => fullState(session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
    await rejected(() => lfCurrent(session, owner), 'permission denied', ['42501']);
    await rejected(() => derive(ids.u1), 'permission denied', ['42501']);
    await rejected(() => rows('SELECT * FROM reserve_session_same_sp_event_v1($1,$2)', [session, owner]), 'permission denied', ['42501']);
    await rejected(() => legacyCommit(session, owner, world.turns.userTurn, randomUUID(), []), 'permission denied', ['42501']);
    await rejected(() => legacyExchange(session, owner, world.turns.userTurn, randomUUID(), [], world.turns.assistantTurn, randomUUID(), []), 'permission denied', ['42501']);
    await rejected(() => lifecycleExchange(session, owner, world.turns.userTurn, randomUUID(), [], [], [], [], world.turns.assistantTurn, randomUUID(), [], [], [], [], FRESH()), 'permission denied', ['42501']);
    await rejected(() => writer(session, owner, world.turns.userTurn, randomUUID(), [], [], [], [], []), 'permission denied', ['42501']);
    await rejected(() => q('SELECT * FROM public.conversation_live_focus_transitions LIMIT 1'), 'permission denied', ['42501']);
    if (role === 'service_role') {
      // The ONE live mutation path and its reads, as the application role: an exact replay through the FINAL coordinator.
      const [replayed] = await exchange(...replayArgs(world, { sp: 42, seq: 0, version: '42' }));
      eq(lfOf(replayed), { kind: 'THREAD', ref: threads.ahmed, sp: 3 }, 'service_role commits (here: replays) through the FINAL coordinator');
      strict((await snapshot(session, owner, world.turns.userTurn, world.userBatch)).full_semantic_capture_state, 'COMPLETE', 'service_role reads the FINAL snapshot');
      strict((await runtimeContext(session, owner)).current_live_focus_kind, 'THREAD', 'service_role reads the FINAL context');
      ok((await dossierPage(owner, await (async () => { await identity('postgres'); const v = await versionOf(owner); await identity('service_role'); return v; })(), null, 32)).length >= 2, 'service_role reads the dossier page the FINAL runtime screens');
      const [legacy] = await rows('SELECT * FROM get_conversation_unit_commit_batch_snapshot_v1($1,$2,$3,$4)', [session, owner, world.turns.userTurn, world.userBatch]);
      strict(legacy.batch_exists, true, 'the T-03A2 snapshot read remains live for service_role');
      await rejected(() => liveState(session), 'permission denied', ['42501']);
      await rejected(() => lfEvents(session, null, 64), 'permission denied', ['42501']);
    } else {
      await rejected(() => exchange(...replayArgs(world, FRESH())), 'permission denied', ['42501']);
      await rejected(() => snapshot(session, owner, world.turns.userTurn, world.userBatch), 'permission denied', ['42501']);
      await rejected(() => runtimeContext(session, owner), 'permission denied', ['42501']);
      await rejected(() => dossierPage(owner, 0, null, 32), 'permission denied', ['42501']);
    }
    if (role === 'authenticated') {
      // The owner-scoped LF delivery: the current LF and the SP it became effective at, and the transition catch-up.
      eq(await liveState(session), [{ session_id: session, live_head: 5, live_focus_kind: current.kind, live_focus_ref: current.ref, live_focus_sp: current.sp }], 'the authenticated snapshot carries LH and the current LF');
      const page = await lfEvents(session, null, 64);
      eq(page.map((r) => [r.session_position, r.to_kind, r.to_ref]), transitionsBefore, 'the catch-up page is the transition history in SP order');
      eq(Object.keys(page[0]).sort(), ['session_id', 'session_position', 'to_kind', 'to_ref'], 'no same-SP sequence, reason, label, Home or content crosses');
      eq((await lfEvents(session, 1, 64)).map((r) => r.session_position), transitionsBefore.map((t) => t[0]).filter((sp) => sp > 1), 'the cursor is exclusive');
      eq((await lfEvents(session, null, 1)).length, 1, 'the page is bounded');
      eq(await lfEvents(session, transitionsBefore.at(-1)[0], 64), [], 'the walk terminates');
      await rejected(() => lfEvents(session, 0, 64), 'INVALID_DELIVERY_CURSOR');
      await rejected(() => lfEvents(session, null, 0), 'INVALID_DELIVERY_LIMIT');
      await rejected(() => lfEvents(session, null, 257), 'INVALID_DELIVERY_LIMIT');
      const [temporal] = await rows('SELECT * FROM get_session_temporal_state_v1($1)', [session]);
      strict(temporal.live_head, 5, 'the T-03A2 temporal read is untouched beside the LF read');
      await identity('authenticated', other);
      eq(await liveState(session), [], 'another user sees no live state of this Session');
      await rejected(() => lfEvents(session, null, 64), 'FORBIDDEN', ['42501']);
    }
    if (role === 'anon') {
      await rejected(() => liveState(session), 'permission denied', ['42501']);
      await rejected(() => lfEvents(session, null, 64), 'permission denied', ['42501']);
    }
  }
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
      await verifyAdversarialPayloads(owner, world);
      await verifyContinuityAndPromotion(owner, world);
      await verifyDepartureAndEmerging();
      await verifyReplayAndCorruption(owner, world);
      await verifyAtomicRollback(owner);
      await verifyImmutabilityAndAcl(owner, world, other);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    console.log(`Verified migration 0071 (${assertions} assertions): the FINAL coordinator is the ONE committing function executable by service_role and the temporary T-03A2 producer / coordinator are retired with no temporal-only fallback; the LF domain is exactly NONE / EMERGING / THREAD with no label, Home, content or score column; the deterministic reducer (new independent focus, unchanged through a Mention, attention and a brief clarification, explicit replacement, return, same-Moment Emerging -> Thread promotion, conservative departure only under exact committed FOCUS_SHIFT evidence, Emerging-only LF) is re-derived by the database for every CU and refuses every forced value, invented / hidden transition, authored reason or identity; B1 keeps seq 1, the Thread layer at most one seq 2, an LF transition takes seq 2 without a Thread-layer event and seq 3 after one, an unchanged LF reserves nothing; AF66-01 holds in the deployed body; both exact typed stale tokens fail 40001 through the FINAL coordinator with no third authority; exact replay mutates nothing; legacy / B1 / B2 / B3-only and corrupt shapes are PARTIAL, block readiness and the FINAL context, and are never upgraded; every injected failure rolls back atomically without reopening a sealed SP; LF truth is append-only and CHECK-shaped; and the owner-scoped LF snapshot / catch-up delivery exposes reference identity only.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Effective Live Focus / final semantic-chain cutover verification failed at ${stage} (${code}): ${error?.message ?? error}${error?.detail ? ` [${error.detail}]` : ''}`);
  process.exitCode = 1;
});
