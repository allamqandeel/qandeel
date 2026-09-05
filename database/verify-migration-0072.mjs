// Real-PostgreSQL verifier for migration 0072 - Historical Coverage Completion
// + Layer A Projection + Layer B Disclosure v1 (T-03C).
//
// Proves against live semantics, never grep alone:
//
//   * the posture: every history table unreachable by every application role,
//     RLS on, append-only through the ONE immutability trigger; `authenticated`
//     executes exactly the owner-scoped Layer-A projection read; `service_role`
//     executes exactly the three managed commands (unchanged public names), the
//     Information Gap synchronization entry and the execution-associated Memory
//     command; the three renamed frozen cores are executable by NO application
//     role; the capture boundary, the hooks, the Thread <-> Reading writers and
//     the expiry mapping are granted to nobody; the projection and the mapping
//     are STABLE SECURITY DEFINER; the identity namespaces re-derive in
//     TypeScript AND in SQL; the Session Semantic Clock is untouched;
//   * R-C1: every pre-existing Session is a LEGACY UNCOVERED SESSION - its
//     Conversation Runtime continues normally (committed CUs / Session
//     Positions / LH through the frozen FINAL authority, the T-03B / T-03D
//     chain, the T-03A2 / T-03D live reads) while it stays historical-disabled
//     through closure: no baseline is ever cut for it, post-deploy capture
//     retained internally upgrades nothing, and the projection fails closed at
//     EVERY Session Position (HISTORICAL_COVERAGE_UNAVAILABLE, never
//     UNKNOWN_AT_TC) so no partial Timeline and no PINNED semantics become
//     addressable. Proven ACROSS THE DEPLOYMENT BOUNDARY (P66-C) on a fresh
//     database: 0001 - 0071, the legacy Session with its pre-coverage Moments,
//     then 0072 exactly as CI applies it, then the continuation. A Session
//     without a coverage decision is projection-refused the same way; a new
//     Session is COVERED at creation;
//   * the baseline: cut at SP(1) under the world-clock row lock, so a world
//     version <= baseline is known at every TC and a world version > baseline
//     never enters this Session (it enters a LATER Session through ITS
//     baseline - REV66-06 section 4.5); an exact boundary, no race gap;
//   * server-owned Session association: the durable post-response execution is
//     the ONE association; an authenticated client write, a caller-supplied
//     session id and a background write without an execution are captured
//     UNASSOCIATED (world version only, no fabricated anchor); a spoofed Session
//     of another user is refused; no caller can supply an SP, a sequence or a
//     world version;
//   * P66-A per exposed family (Reading, Material, Evidence participation, peer
//     relation, Information Gap, Question candidate, Confidence, Thread,
//     Emerging Focus, Live Focus, Formal Question <-> Turn appearance,
//     Thread <-> Reading appearance): UNKNOWN before its own anchor, KNOWN
//     from it on; P66-B then-current validity (status / version / epoch at TC,
//     lineage never mistaken for current); REV66-06 section 4.5 baseline
//     inheritance (a later Session inherits an unassociated fact through its
//     own baseline - this is NOT P66-C); P66-D (an appearance anchored at the exchange's
//     first committed Moment, never before); P66-F (a sealed TC is stable under
//     every later write); open-head evolution (TC = LH changes with an
//     associated write while LH does not move); Z66-03 (an identity created
//     after TC is unknown even when its lineage anchor is known); Z66-04
//     (PREVALID / SUPERSEDED / CURRENT Confidence against the then-current
//     version); Z66-05 (a technical gap fails closed);
//   * R-C5: expiry mapped from the wall-clock domain into SP space - NO_EXPIRY,
//     PRE_FIRST_SP, SP(n) with t(n) <= X < t(n+1), an exact tie EXPIRED at n,
//     the open head, PENDING, NOT_IN_SESSION - and never compared to TC; a
//     Material known ACTIVE at TC = n-1 is EXPIRED at TC = n once SP(n) seals
//     (P66-G / P66-H) while its identity and lineage stay known;
//   * R-C2: no canonical row can be deleted, no identity / provenance /
//     lineage column rewritten, no history row updated or deleted, the world
//     clock never regresses; R-C3: every legacy Evidence-attach path (0005 /
//     0008 / 0021 / 0028) authors exactly one TRACKED participation event and
//     no untracked one; deterministic identities; an identity reused with a
//     different payload is refused; a retry duplicates nothing;
//   * the Thread <-> Reading appearance writers (substrate only - no production
//     path exists because the repository carries no canonical Reading
//     subject-grounding authority; the verifier drives them as the fixture
//     owner): clock-first, Session-bound, derived identity, idempotent,
//     unbound by ordinal, one life per SP;
//   * the verify:auth:smoke fixture teardown replayed from its own source
//     against an identical fixture: compatible with the 0072 coverage
//     decision, zero residue, and the plain Session delete it replaces is
//     exactly the RESTRICT regression;
//   * ONE Home per Thread at every TC; lifecycle at TC from the durable 0070
//     history; LF at TC from the durable 0071 history;
//   * P66-E (last, real PostgreSQL only): concurrent associated writes in one
//     Session serialize on the Session Semantic Clock (AF66-01) and never
//     interleave with a committing exchange.
//
// Every fixture of the main run is rolled back; the concurrency stage commits
// its own bounded fixture and removes it. No paid provider is ever invoked.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const T03C_MIGRATION = '0072_historical_coverage_projection_disclosure_v1.sql';
const migrationSql = await readFile(new URL(T03C_MIGRATION, MIGRATIONS), 'utf8');
// The ONE connection every helper below writes through. The deployment-spanning
// stage swaps it for a connection to a fresh database and swaps it back.
let client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
let assertions = 0;
const check = (fn) => { assertions += 1; return fn(); };
const eq = (actual, expected, message) => check(() => assert.deepEqual(actual, expected, message));
const strict = (actual, expected, message) => check(() => assert.equal(actual, expected, message));
const ok = (value, message) => check(() => assert.ok(value, message));

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];

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
/**
 * The main run is ONE physical transaction standing for many logical ones. The
 * capture context is transaction-local by design, so between two logical
 * transactions the verifier clears it exactly as a commit would have.
 */
async function newLogicalTransaction() {
  await identity('postgres');
  await q("SELECT set_config('qandeel.historical_capture_context', '', true)");
}
/** Fixture surgery as the postgres fixture owner, with every trigger standing aside (as the fixture cleanup helper does). */
async function asReplica(work) {
  await identity('postgres');
  await q("SET LOCAL session_replication_role = 'replica'");
  try { return await work(); } finally { await q("SET LOCAL session_replication_role = 'origin'"); }
}

// --------------------------------------------------------------- signatures
const PROJECTION = 'public.get_session_historical_projection_v1(uuid,integer)';
const EXPIRY = 'public.historical_memory_expiry_at_sp_v1(uuid,timestamptz)';
const WALL_TIME = 'public.historical_session_position_wall_time_v1(uuid,integer)';
const IDENTITY = 'public.historical_event_identity_v1(text)';
const CAPTURE_BEGIN = 'public.historical_capture_begin_v1(uuid,uuid,boolean)';
const CAPTURE_CONTEXT = 'public.historical_capture_context_v1(uuid)';
const CAPTURE_EXECUTION = 'public.historical_capture_begin_for_execution_v1(uuid)';
const IDENTITY_CONFLICT = 'public.historical_event_identity_conflict_v1(text,uuid,jsonb)';
const RECORD_PARTICIPATION = 'public.record_historical_evidence_participation_v1(uuid,uuid,text,text,text,integer,uuid,integer,bigint,bigint)';
const RECORD_RELATION = 'public.record_historical_reading_relation_v1(uuid,uuid,uuid,text,uuid,integer,bigint,bigint)';
const BIND = 'public.bind_reading_to_thread_v1(uuid,uuid,uuid,uuid)';
const UNBIND = 'public.unbind_reading_from_thread_v1(uuid,uuid,uuid)';
// R2: the subject-grounding authority surface.
const RECORD_APPEARANCE = 'public.record_thread_reading_appearance_v1(uuid,uuid,uuid,uuid,integer,bigint,bigint)';
const GROUNDING_IDENTITY = 'public.hypothesis_subject_grounding_identity_v1(uuid,uuid)';
const GROUNDING_HANDLE = 'public.hypothesis_subject_grounding_handle_v1(uuid,uuid)';
const UNIVERSE_PRESENTATION = 'public.hypothesis_subject_grounding_universe_presentation_v1(public.hypothesis_subject_grounding_universes)';
const BUILD_UNIVERSE = 'public.build_hypothesis_subject_grounding_universe_v1(uuid)';
const GROUNDED_COMPLETION = 'public.complete_post_response_grounded_candidates_v1(uuid,text,jsonb,jsonb)';
const PERSIST_GROUNDINGS = 'public.persist_authorized_subject_groundings_v1(uuid)';
const GROUNDING_TRIGGERS = ['public.derive_thread_reading_appearances_for_grounding_v1()', 'public.derive_thread_reading_appearances_for_focus_binding_v1()'];
const MEMORY_FOR_EXECUTION = 'public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const PERSIST = 'public.persist_post_response_hypothesis_generation_v1(uuid)';
const UPDATE_BATCH = 'public.execute_post_response_hypothesis_update_batch_v1(uuid,jsonb)';
const CONFIDENCE_BATCH = 'public.execute_post_response_confidence_batch_v1(uuid)';
const SYNC_V1 = 'public.sync_post_response_information_gaps_v1(uuid)';
const PERSIST_CORE = 'public.persist_post_response_hypothesis_generation_v1_core(uuid)';
const UPDATE_BATCH_CORE = 'public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb)';
const CONFIDENCE_BATCH_CORE = 'public.execute_post_response_confidence_batch_v1_core(uuid)';
const HOOKS = ['public.capture_historical_reading_change_v1()', 'public.capture_historical_material_change_v1()', 'public.capture_historical_gap_change_v1()',
  'public.capture_historical_question_creation_v1()', 'public.capture_historical_confidence_creation_v1()', 'public.capture_historical_thread_availability_v1()',
  'public.capture_session_historical_baseline_v1()', 'public.guard_historical_canonical_row_preservation_v1()',
  'public.reject_historical_projection_mutation_v1()', 'public.guard_historical_world_semantic_clock_v1()', 'public.guard_thread_reading_binding_mutation_v1()',
  'public.provision_session_historical_coverage_v1()'];
const HISTORY_TABLES = ['historical_world_semantic_clocks', 'session_historical_coverage', 'session_historical_baselines', 'historical_thread_availability',
  'historical_reading_events', 'historical_evidence_participation_events', 'historical_reading_relation_events', 'historical_material_events',
  'historical_gap_events', 'historical_question_events', 'historical_confidence_events', 'historical_question_appearance_events', 'thread_reading_bindings',
  'hypothesis_subject_groundings', 'hypothesis_subject_grounding_universes', 'hypothesis_subject_grounding_proposals'];
const CANONICAL_HOOKED = [['hypotheses', 'hypotheses_historical_capture', 'hypotheses_historical_preservation'], ['memories', 'memories_historical_capture', 'memories_historical_preservation'],
  ['question_candidates', 'question_candidates_historical_capture', 'question_candidates_historical_preservation'],
  ['confidence_evaluations', 'confidence_evaluations_historical_capture', 'confidence_evaluations_historical_preservation']];
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';
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
const EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/historical-availability-event/v1');
const READING_BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-reading-binding/v1');
const SUBJECT_GROUNDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/hypothesis-subject-grounding/v1');
const SUBJECT_GROUNDING_HANDLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/subject-grounding-handle/v1');
const THREAD_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/thread/v1');
const HOME_ANCHOR_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1');
const THREAD_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1');
const FOCUS_BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1');
const LIFECYCLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1');
const LIVE_FOCUS_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const focusBindingIdOf = (sessionId, focusId, threadId) => uuidV5(FOCUS_BINDING_NAMESPACE, `${sessionId}:${focusId}:${threadId}`);
const lifecycleEventIdOf = (sessionId, cuId, threadId, toState) => uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
const lfEventIdOf = (sessionId, cuId, kind, ref) => uuidV5(LIVE_FOCUS_NAMESPACE, `${sessionId}:${cuId}:${kind}:${ref ?? 'NONE'}`);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ------------------------------------------------------- the shared scenario
// Session 1 is exactly T-03D's: the manager (SP1, Thread established), an
// incidental Ahmed mention (SP2), Ahmed as a direct concern (SP3, Thread
// established, manager DORMANT), the assistant attends Ahmed twice (SP4, SP5).
const USER_TEXT = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد اللي في الفريق قالّي إن الموضوع ده عادي. أحمد نفسه بدأ يقلقني.';
const ASSISTANT_TEXT = 'تقصد إن أحمد بيتجنبك؟ وإمتى ده بدأ؟';
const U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const U2 = 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.';
const U3 = 'أحمد نفسه بدأ يقلقني.';
const A1 = 'تقصد إن أحمد بيتجنبك؟';
const A2 = 'وإمتى ده بدأ؟';
const QUIET_TEXT = 'وكمان الشغل كتير الأيام دي.';
const QUIET_REPLY = 'فاهم، ده ضغط زيادة.';

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
const transition = (session, cuId, threadId, toState, reasonCode) =>
  ({ thread_id: threadId, to_state: toState, reason_code: reasonCode, lifecycle_event_id: lifecycleEventIdOf(session, cuId, threadId, toState) });
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
  lifecycle_transitions: [...(overrides.lifecycle_transitions ?? [])].sort((a, b) => byText(a.thread_id, b.thread_id)),
});
const establishNew = (session, unitId, focusId, threadId, evidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ESTABLISH_NEW', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'ESTABLISHMENT',
  focus_binding_id: focusBindingIdOf(session, focusId, threadId), identity_evidence: evidence, lifecycle_transitions: transitions,
});
const attendExisting = (unitId, focusId, threadId, transitions = []) => lifecycle(unitId, {
  outcome: 'ATTEND_EXISTING', emerging_focus_id: focusId, thread_id: threadId, lifecycle_transitions: transitions,
});
const noAction = (unitId, focusId = null, transitions = []) => lifecycle(unitId, { emerging_focus_id: focusId, lifecycle_transitions: transitions });
const reopenExisting = (session, unitId, focusId, threadId, others = []) => lifecycle(unitId, {
  outcome: 'REOPEN_EXISTING', emerging_focus_id: focusId, thread_id: threadId,
  lifecycle_transitions: [transition(session, unitId, threadId, 'REOPENED', 'GENUINE_RETURN'), ...others],
});
const lfChange = (session, unitId, kind, ref, reason) => ({
  unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: true, reason_code: reason,
  transition_event_id: lfEventIdOf(session, unitId, kind, ref),
});
const lfSame = (unitId, kind, ref) => ({ unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: false, reason_code: null, transition_event_id: null });

const exchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_full_semantic_chain_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
    $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
  [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads), JSON.stringify(userLifecycle), JSON.stringify(userLiveFocus),
    assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads), JSON.stringify(assistantLifecycle), JSON.stringify(assistantLiveFocus),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, token.sp, token.seq, token.version]);
const legacyCommit = (session, user, turn, batch, units) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)', [session, user, turn, batch, JSON.stringify(units), ...PROVENANCE]);
const clockOf = async (session) => one('SELECT current_sp, same_sp_event_sequence::text seq FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
const identityVersionOf = async (user) =>
  (await one('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1), 0)::text v', [user])).v;
const worldVersionOf = async (user) =>
  Number((await one('SELECT COALESCE((SELECT current_version FROM public.historical_world_semantic_clocks WHERE user_id=$1), 0)::text v', [user])).v);
const FRESH = (version = '0') => ({ sp: null, seq: 0, version });

async function newSession(owner) {
  const id = randomUUID();
  await identity('postgres');
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [id, owner]);
  return id;
}
/** A completed USER -> ASSISTANT exchange; `bindingId` binds the selected formal Question at finalization (0063). */
async function completedTurns(owner, session, content = USER_TEXT, reply = ASSISTANT_TEXT, bindingId = null, beforeFinalize = null) {
  await identity('authenticated', owner);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, userTurn, ...ROUTE]);
  let boundBinding = bindingId;
  if (beforeFinalize) boundBinding = await beforeFinalize(userTurn);
  await identity('service_role');
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, owner, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, boundBinding]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

/** Session 1 of the shared scenario through the FINAL coordinator (SP1..SP5). */
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
  await identity('postgres');
  const [result] = await exchange(session, owner, turns.userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
    turns.assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, FRESH(await identityVersionOf(owner)));
  assert.equal(result.live_head, 5, 'Session 1 committed SP1..SP5');
  return { session, turns, ids, handles, focuses, threads };
}

/** A quiet USER -> ASSISTANT exchange with no focus change: two more Moments, LF unchanged (THREAD ahmed). */
async function quietExchange(owner, world, beforeFinalize = null) {
  const turns = await completedTurns(owner, world.session, QUIET_TEXT, QUIET_REPLY, null, beforeFinalize);
  const ids = { u: randomUUID(), a: randomUUID() };
  const token = { ...(await clockOf(world.session)), version: await identityVersionOf(owner) };
  await identity('postgres');
  const [result] = await exchange(world.session, owner, turns.userTurn, randomUUID(),
    [unit(QUIET_TEXT, QUIET_TEXT, 1, ids.u)],
    [bundle(ids.u, { sequence_position: 'FOLLOW_UP', references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.u, 'NO_INDEPENDENT_FOCUS')], [noAction(ids.u)], [lfSame(ids.u, 'THREAD', world.threads.ahmed)],
    turns.assistantTurn, randomUUID(),
    [unit(QUIET_REPLY, QUIET_REPLY, 1, ids.a)],
    [bundle(ids.a, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u, references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.a, 'NO_INDEPENDENT_FOCUS')], [noAction(ids.a)], [lfSame(ids.a, 'THREAD', world.threads.ahmed)],
    { sp: token.current_sp, seq: Number(token.seq), version: token.version });
  return { turns, ids, liveHead: result.live_head };
}

// ------------------------------------------------------------ projection
async function project(owner, session, tc) {
  await identity('authenticated', owner);
  const row = await one('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [session, tc]);
  await identity('postgres');
  return row;
}
const idsOf = (list) => list.map((entry) => entry.id).sort(byText);
const withoutRevision = ({ revision: _revision, ...rest }) => rest;
async function beginCapture(owner, session, require = true) {
  await identity('postgres');
  return one('SELECT session_id, session_position, same_sp_event_sequence::text seq, world_version::text wv FROM public.historical_capture_begin_v1($1,$2,$3)', [owner, session, require]);
}
const eventsOf = (table, where, values) => rows(`SELECT event_kind, session_id, session_position, same_sp_event_sequence::text seq, world_version::text wv FROM public.${table} WHERE ${where} ORDER BY world_version, same_sp_event_sequence NULLS FIRST`, values);

/** A post-deploy focus shift in an existing Session: a new reference handle, a new Emerging Focus, TE-01 establishment, the displaced Thread DORMANT, LF replaced - the frozen T-03B / T-03D chain end to end. */
const SHIFT_TEXT = 'الشغل بقى ضاغط عليا الأيام دي.';
const SHIFT_REPLY = 'فاهم، الضغط ده جديد.';
async function establishingExchange(owner, world) {
  const turns = await completedTurns(owner, world.session, SHIFT_TEXT, SHIFT_REPLY);
  const ids = { u: randomUUID(), a: randomUUID() };
  const handle = randomUUID();
  const focus = randomUUID();
  const thread = threadIdOf(owner, focus);
  const token = { ...(await clockOf(world.session)), version: await identityVersionOf(owner) };
  await identity('postgres');
  const [result] = await exchange(world.session, owner, turns.userTurn, randomUUID(),
    [unit(SHIFT_TEXT, SHIFT_TEXT, 1, ids.u)],
    [bundle(ids.u, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], references: [resolved(SHIFT_TEXT, 'الشغل', handle, true)], attention: startFocus(focus, 0, 'EXPLICIT_FOCUS_SHIFT') })],
    [establish(owner, ids.u, focus, 'TE-01', [ids.u], { explicit_selection_grounding: anchor(SHIFT_TEXT, 'الشغل') })],
    [establishNew(world.session, ids.u, focus, thread, [{ cu_id: ids.u, reference_index: 0 }], [transition(world.session, ids.u, world.threads.ahmed, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')])],
    [lfChange(world.session, ids.u, 'THREAD', thread, 'FOCUS_REPLACEMENT')],
    turns.assistantTurn, randomUUID(),
    [unit(SHIFT_REPLY, SHIFT_REPLY, 1, ids.a)],
    [bundle(ids.a, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u, references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.a, 'NO_INDEPENDENT_FOCUS')], [noAction(ids.a)], [lfSame(ids.a, 'THREAD', thread)],
    { sp: token.current_sp, seq: Number(token.seq), version: token.version });
  return { turns, ids, thread, focus, liveHead: result.live_head };
}

// ------------------------------------------- B0. P66-C across the deployment
// The frozen P66-C fixture spans deployment: a Session exists and has committed
// Moments BEFORE T-03C capture is active, 0072 deploys, and the user continues
// that Session. PASS means the Session stays historical-disabled through
// closure while the normal Conversation Runtime continues - never that the
// runtime is disabled. Proven on a FRESH database: 0001 - 0071 applied, the
// legacy Session and its pre-coverage Moments written through the frozen FINAL
// authority, then 0072 applied exactly as CI applies it (the whole file), then
// the continuation. Runs outside the main transaction because CREATE DATABASE
// cannot run inside one; the database is dropped afterwards.
const SPAN_BOOTSTRAP = `
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
ALTER FUNCTION auth.uid() OWNER TO postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
`;
async function verifyDeploymentSpan() {
  stage = 'B0. R-C1 / P66-C across the deployment boundary: fresh database, 0001-0071, a legacy Session with pre-coverage Moments, then 0072, then the Session continues';
  const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
  const preCoverage = files.filter((name) => name < '0072_');
  ok(files.includes(T03C_MIGRATION), 'the T-03C migration exists');
  strict(preCoverage.at(-1), '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql', 'the deployment boundary is 0071 -> 0072');
  const spanName = `qandeel_t03c_span_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  const spanUrl = new URL(databaseUrl);
  spanUrl.pathname = `/${spanName}`;
  await q(`CREATE DATABASE ${spanName}`);
  const mainClient = client;
  const spanClient = new Client({ connectionString: spanUrl.toString() });
  try {
    await spanClient.connect();
    client = spanClient;
    await q(SPAN_BOOTSTRAP);
    for (const name of preCoverage) await q(await readFile(new URL(name, MIGRATIONS), 'utf8'));
    strict((await one("SELECT to_regclass('public.session_historical_coverage') IS NULL absent")).absent, true, 'before 0072 no coverage decision exists anywhere: the Session below predates T-03C capture');
    // 1 + 2. The Session and its pre-coverage conversational state: SP1..SP5
    // through the frozen FINAL coordinator (two Threads, LF), plus a legacy
    // analytical fact - all of it written before any capture hook exists.
    const owner = randomUUID();
    await q('BEGIN');
    await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    const world = await sessionOne(owner);
    await identity('service_role');
    const H0 = randomUUID();
    await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, H0, 'pre-coverage reading', 'CAUSAL', 'GENERAL', 'legacy scope', 'HUMAN_REVIEWED', [], []]);
    await identity('postgres');
    await q('COMMIT');
    eq((await clockOf(world.session)).current_sp, 5, 'pre-coverage: SP1..SP5 committed with no history captured anywhere');
    // 3. T-03C deploys: the real 0072 text, exactly as CI applies it.
    await q(migrationSql);
    await q('BEGIN');
    eq(await one('SELECT coverage_state FROM public.session_historical_coverage WHERE session_id=$1', [world.session]), { coverage_state: 'LEGACY_UNCOVERED' }, 'the deployment decides the pre-existing Session LEGACY_UNCOVERED');
    strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [world.session])).n, 0, 'no baseline exists for it');
    eq((await eventsOf('historical_reading_events', 'hypothesis_id=$1', [H0])).map((e) => [e.event_kind, e.session_id, e.wv]), [['LEGACY_BASELINE', null, '0']], 'the pre-coverage Reading carries its legacy baseline event');
    eq((await rows('SELECT world_version::text wv FROM public.historical_thread_availability WHERE thread_id = ANY($1)', [[world.threads.manager, world.threads.ahmed]])).map((r) => r.wv), ['0', '0'], 'the pre-coverage Threads are legacy world identities');
    // 4 + 5. The user continues the Session through the normal current authority:
    // two quiet exchanges (SP6..SP9) and a focus shift that establishes a new
    // Thread (SP10..SP11) - committed CUs, SPs, LH, B1 / B2 / B3 / LF continue.
    const first = await quietExchange(owner, world);
    eq(first.liveHead, 7, 'post-deploy exchange 1 committed SP6 and SP7 through the FINAL authority');
    const second = await quietExchange(owner, world);
    eq(second.liveHead, 9, 'post-deploy exchange 2 committed SP8 and SP9');
    const shift = await establishingExchange(owner, world);
    eq(shift.liveHead, 11, 'post-deploy exchange 3 committed SP10 and SP11 and established a new Thread through the frozen T-03B / T-03D chain');
    eq((await clockOf(world.session)).current_sp, 11, 'LH advanced normally for runtime');
    ok(Number((await one('SELECT world_version::text wv FROM public.historical_thread_availability WHERE thread_id=$1', [shift.thread])).wv) > 0, 'the post-deploy Thread is captured with a world version (a world identity, never a Session anchor)');
    eq((await one('SELECT count(*)::int n FROM public.conversation_thread_homes WHERE thread_id=$1', [shift.thread])).n, 1, 'and its ONE Home');
    await identity('authenticated', owner);
    const live = await one('SELECT * FROM public.get_session_live_state_v1($1)', [world.session]);
    eq([live.live_head, live.live_focus_kind, live.live_focus_ref, live.live_focus_sp], [11, 'THREAD', shift.thread, 10], 'the T-03D live read serves the legacy Session normally: LH and LF continue');
    eq(await one('SELECT live_head FROM public.get_session_temporal_state_v1($1)', [world.session]), { live_head: 11 }, 'the T-03A2 temporal delivery serves it normally');
    await identity('postgres');
    // A post-deploy analytical write associated with the legacy Session is
    // captured with its truthful anchor (technical history, retained internally) ...
    const ctx = await beginCapture(owner, world.session, true);
    eq([ctx.session_id, ctx.session_position], [world.session, 11], 'the association anchors at the legacy Session\'s current Session Position');
    await identity('service_role');
    const H1 = randomUUID();
    await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, H1, 'post-deploy reading in the legacy Session', 'CAUSAL', 'GENERAL', `CONVERSATION_SESSION:${world.session}`, 'SYSTEM_GENERATED', [], []]);
    await newLogicalTransaction();
    eq((await eventsOf('historical_reading_events', 'hypothesis_id=$1', [H1])).map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', world.session, 11]], 'retained internally with its truthful anchor');
    // 6 + 7. ... and upgrades nothing: coverage unchanged, no baseline fabricated.
    eq(await one('SELECT coverage_state FROM public.session_historical_coverage WHERE session_id=$1', [world.session]), { coverage_state: 'LEGACY_UNCOVERED' }, 'coverage stays LEGACY_UNCOVERED through every post-deploy commit and capture');
    strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [world.session])).n, 0, 'no baseline was fabricated by the post-deploy Moments');
    // 8 + 9. Historical projection fails closed at EVERY Session Position the
    // Session now has - and outside them - with HISTORICAL_COVERAGE_UNAVAILABLE:
    // no TC is addressable, no PINNED semantics exist, no partial Timeline.
    await identity('authenticated', owner);
    for (const tc of [0, 1, 5, 6, 9, 10, 11, 12]) {
      await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, tc]), 'HISTORICAL_COVERAGE_UNAVAILABLE', ['55000']);
    }
    await identity('postgres');
    // The same deployment serves a Session created after it normally: COVERED
    // at creation, baseline at SP(1), projection open. The legacy Session's
    // facts enter it only through its baseline (REV66-06 section 4.5), never
    // through the legacy Session's own anchors.
    const fresh = await newSession(owner);
    eq(await one('SELECT coverage_state FROM public.session_historical_coverage WHERE session_id=$1', [fresh]), { coverage_state: 'COVERED' }, 'a Session created after the deployment is COVERED');
    const freshTurns = await completedTurns(owner, fresh);
    await identity('postgres');
    await legacyCommit(fresh, owner, freshTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1)]);
    await newLogicalTransaction();
    strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [fresh])).n, 1, 'a COVERED Session cuts its baseline at SP(1)');
    const k = await project(owner, fresh, 1);
    eq([k.live_head, k.tc, k.moments.length], [1, 1, 1]);
    ok(idsOf(k.readings).includes(H0) && idsOf(k.readings).includes(H1), 'the legacy-baseline Reading and the legacy Session\'s post-deploy Reading are both PRE_FIRST_SP knowledge of the covered Session (world version <= its baseline)');
    ok([world.threads.manager, world.threads.ahmed, shift.thread].every((id) => idsOf(k.threads).includes(id)), 'the legacy Session\'s Threads are inherited through world availability');
    eq(k.threads.filter((t) => [world.threads.manager, world.threads.ahmed, shift.thread].includes(t.id)).map((t) => t.sessionLifecycle), [null, null, null], 'with no Session-local lifecycle in the covered Session');
    await q('ROLLBACK');
  } finally {
    client = mainClient;
    await spanClient.end().catch(() => undefined);
    await q(`DROP DATABASE IF EXISTS ${spanName} WITH (FORCE)`);
  }
}

// ---------------------------------------------------------------- A. static
async function verifyStaticAuthority() {
  stage = 'A. schema / privilege / posture / declarations';
  const definer = async (signature) => one('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [signature]);
  const R2_SURFACE = [RECORD_APPEARANCE, GROUNDING_IDENTITY, GROUNDING_HANDLE, UNIVERSE_PRESENTATION, BUILD_UNIVERSE, GROUNDED_COMPLETION, PERSIST_GROUNDINGS, ...GROUNDING_TRIGGERS];
  for (const signature of [PROJECTION, EXPIRY, WALL_TIME, IDENTITY, CAPTURE_BEGIN, CAPTURE_CONTEXT, CAPTURE_EXECUTION, IDENTITY_CONFLICT, RECORD_PARTICIPATION, RECORD_RELATION,
    BIND, UNBIND, MEMORY_FOR_EXECUTION, PERSIST, UPDATE_BATCH, CONFIDENCE_BATCH, SYNC_V1, PERSIST_CORE, UPDATE_BATCH_CORE, CONFIDENCE_BATCH_CORE, ...HOOKS, ...R2_SURFACE]) {
    const contract = await definer(signature);
    ok(contract, `${signature} exists with its exact signature`);
    strict(contract.owner, 'postgres', `${signature} is postgres-owned`);
    ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')), `${signature} has a fixed search path`);
    // The four pure row guards read NEW / OLD only and need no definer rights;
    // the pure identity derivations and the pure presentation read nothing;
    // everything that reads or writes a history table runs as its owner.
    const pureGuard = ['public.guard_historical_canonical_row_preservation_v1()', 'public.guard_historical_world_semantic_clock_v1()',
      'public.guard_thread_reading_binding_mutation_v1()', 'public.reject_historical_projection_mutation_v1()', IDENTITY,
      GROUNDING_IDENTITY, GROUNDING_HANDLE, UNIVERSE_PRESENTATION].includes(signature);
    strict(contract.definer, !pureGuard, `${signature} ${pureGuard ? 'is a pure guard: no definer rights' : 'is SECURITY DEFINER'}`);
  }
  for (const signature of [PROJECTION, EXPIRY, WALL_TIME]) strict((await definer(signature)).volatility, 's', `${signature} is STABLE: the database refuses any write from inside it`);
  strict((await definer(IDENTITY)).volatility, 'i', 'the event identity derivation is IMMUTABLE');
  for (const signature of [GROUNDING_IDENTITY, GROUNDING_HANDLE, UNIVERSE_PRESENTATION]) strict((await definer(signature)).volatility, 'i', `${signature} is IMMUTABLE: a pure derivation`);
  // THE AUTHORITY POSTURE.
  const authenticatedExecutable = [PROJECTION];
  const serviceExecutable = [PERSIST, UPDATE_BATCH, CONFIDENCE_BATCH, SYNC_V1, MEMORY_FOR_EXECUTION, BUILD_UNIVERSE, GROUNDED_COMPLETION];
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [PROJECTION, EXPIRY, WALL_TIME, IDENTITY, CAPTURE_BEGIN, CAPTURE_CONTEXT, CAPTURE_EXECUTION, IDENTITY_CONFLICT, RECORD_PARTICIPATION, RECORD_RELATION,
      BIND, UNBIND, MEMORY_FOR_EXECUTION, PERSIST, UPDATE_BATCH, CONFIDENCE_BATCH, SYNC_V1, PERSIST_CORE, UPDATE_BATCH_CORE, CONFIDENCE_BATCH_CORE, ...HOOKS, ...R2_SURFACE]) {
      const { granted } = await one("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      const expected = (role === 'authenticated' && authenticatedExecutable.includes(signature)) || (role === 'service_role' && serviceExecutable.includes(signature));
      strict(granted, expected, `${role} ${expected ? 'executes' : 'must not execute'} ${signature}`);
    }
    for (const table of HISTORY_TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const { granted } = await one('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, `public.${table}`, privilege]);
        strict(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  for (const table of HISTORY_TABLES) {
    const { rls } = await one('SELECT relrowsecurity rls FROM pg_class WHERE oid = $1::regclass', [`public.${table}`]);
    strict(rls, true, `${table} has row level security enabled`);
    const guard = table === 'historical_world_semantic_clocks' ? 'public.guard_historical_world_semantic_clock_v1'
      : table === 'thread_reading_bindings' ? 'public.guard_thread_reading_binding_mutation_v1' : 'public.reject_historical_projection_mutation_v1';
    const { n } = await one('SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal AND t.tgfoid = $2::regproc', [`public.${table}`, guard]);
    strict(n, 1, `${table} is guarded by exactly ONE mutation trigger`);
  }
  // R2: the A-1 appearance is derived by exactly the two production triggers.
  for (const [table, fn] of [['hypothesis_subject_groundings', 'public.derive_thread_reading_appearances_for_grounding_v1'], ['conversation_thread_focus_bindings', 'public.derive_thread_reading_appearances_for_focus_binding_v1']]) {
    const { n } = await one("SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal AND t.tgfoid = $2::regproc AND t.tgenabled = 'O' AND (t.tgtype & 2) = 0 AND (t.tgtype & 4) = 4", [`public.${table}`, fn]);
    strict(n, 1, `${table} derives Thread <-> Reading appearances through exactly ONE AFTER INSERT trigger`);
  }
  strict((await one("SELECT count(*)::int n FROM pg_trigger t WHERE t.tgrelid = 'public.conversation_thread_focus_bindings'::regclass AND NOT t.tgisinternal AND t.tgname LIKE '%appearance%'")).n, 1,
    'the frozen 0070 focus-binding table carries exactly the ONE 0072 appearance trigger');
  for (const [table, capture, preservation] of CANONICAL_HOOKED) {
    const names = (await rows('SELECT tgname FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal AND tgname LIKE $2 ORDER BY tgname', [`public.${table}`, '%historical%'])).map((r) => r.tgname);
    eq(names, [capture, preservation].sort(byText), `${table} carries exactly its capture hook and its preservation guard`);
  }
  for (const [table, trigger] of [['information_gaps', 'information_gaps_historical_capture'], ['conversation_threads', 'conversation_threads_historical_availability'],
    ['conversation_units', 'conversation_units_historical_baseline'], ['conversation_sessions', 'conversation_sessions_provision_historical_coverage']]) {
    const { n } = await one('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = $1::regclass AND tgname = $2 AND tgenabled = $3', [`public.${table}`, trigger, 'O']);
    strict(n, 1, `${table}.${trigger} is present and enabled`);
  }
  // R-C1 (R1-01): coverage gates historical projection, never the Conversation
  // Runtime. The ONE 0072 trigger on conversation_units is the AFTER INSERT
  // baseline hook; no committed-CU coverage gate exists.
  strict((await one("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = 'public.conversation_units'::regclass AND NOT tgisinternal AND tgname LIKE '%historical%'")).n, 1,
    'exactly ONE 0072 trigger on conversation_units: the AFTER INSERT baseline hook');
  strict((await one("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = 'public.conversation_units'::regclass AND NOT tgisinternal AND tgname LIKE '%historical%' AND (tgtype & 2) = 2")).n, 0,
    'no BEFORE trigger of 0072 stands between the runtime and a committed CU');
  strict((await one("SELECT to_regprocedure('public.guard_session_historical_coverage_v1()') IS NULL absent")).absent, true, 'the committed-CU coverage gate does not exist');
  // Deployed bodies: the projection and the mapping write nothing; the wrappers
  // enter the boundary and then run exactly their frozen core; the cores know
  // nothing of history; the synchronization entry still delegates to v2 with
  // no DML text; the Session clock is untouched.
  const bodyOf = async (signature) => (await one('SELECT pg_get_functiondef(to_regprocedure($1)) definition', [signature])).definition;
  for (const signature of [PROJECTION, EXPIRY, WALL_TIME]) {
    const body = await bodyOf(signature);
    ok(!/INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE|set_config/u.test(body), `${signature} writes, backfills, repairs and deletes nothing`);
  }
  ok(!/created_at|now\(\)|CURRENT_TIMESTAMP|clock_timestamp/u.test(await bodyOf(PROJECTION)), 'no timestamp participates in the projection itself (R-C5 lives in the mapping)');
  for (const [wrapper, core] of [[PERSIST, 'persist_post_response_hypothesis_generation_v1_core'], [UPDATE_BATCH, 'execute_post_response_hypothesis_update_batch_v1_core'], [CONFIDENCE_BATCH, 'execute_post_response_confidence_batch_v1_core']]) {
    const body = await bodyOf(wrapper);
    ok(body.includes('PERFORM public.historical_capture_begin_for_execution_v1(p_execution_id);'), `${wrapper} enters the capture boundary first`);
    ok(body.includes(`public.${core}(`), `${wrapper} then runs exactly its frozen core`);
    ok(!/INSERT INTO|UPDATE public\.|DELETE FROM/u.test(body), `${wrapper} carries no DML of its own`);
  }
  // R2: the persist wrapper records the authorized groundings in the SAME transaction as the frozen core, after it, and only when it persisted.
  const persistBody = await bodyOf(PERSIST);
  ok(persistBody.includes('persisted := public.persist_post_response_hypothesis_generation_v1_core(p_execution_id);') && persistBody.includes('IF persisted THEN')
    && persistBody.includes('PERFORM public.persist_authorized_subject_groundings_v1(p_execution_id);') && persistBody.indexOf('_core(') < persistBody.indexOf('persist_authorized_subject_groundings_v1'),
    'the persist wrapper runs the frozen core and then records the authorized subject groundings atomically');
  const groundedCompletion = await bodyOf(GROUNDED_COMPLETION);
  ok(groundedCompletion.includes('public.complete_post_response_candidate_provider_effect_v1(p_execution_id, p_result_code, p_result_payload)'), 'the grounded completion delegates to the frozen 0033 completion in the same transaction');
  ok(/SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE/u.test(groundedCompletion) && /SUBJECT_GROUNDING_TARGET_NOT_CANDIDATE/u.test(groundedCompletion), 'and judges the proposal against the exact stored universe and candidate plan');
  const universeBuilder = await bodyOf(BUILD_UNIVERSE);
  ok(!/similar|ILIKE|~\*|embedding|score|rank/u.test(universeBuilder) && universeBuilder.includes('FROM public.conversation_emerging_focuses f') && universeBuilder.includes('FROM public.conversation_thread_focus_bindings b'),
    'the universe is built from the frozen B1 focus rows and the B2 / B3 focus -> Thread bindings, never from text similarity');
  for (const core of [PERSIST_CORE, UPDATE_BATCH_CORE, CONFIDENCE_BATCH_CORE]) ok(!/historical_/u.test(await bodyOf(core)), `${core} is the frozen body: it knows nothing of history`);
  const sync = await bodyOf(SYNC_V1);
  ok(sync.includes('historical_capture_begin_for_execution_v1') && sync.includes('sync_post_response_information_gaps_v2'), 'the v1 synchronization entry enters the boundary and delegates to the v2 authority');
  ok(!/INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/u.test(sync), 'the v1 synchronization entry carries no DML');
  const baselineHook = await bodyOf('public.capture_session_historical_baseline_v1()');
  ok(baselineHook.includes('FOR UPDATE'), 'the baseline is cut under the world-clock row lock: no race gap with SP(1)');
  ok(baselineHook.includes("coverage = 'COVERED'") && baselineHook.indexOf("coverage = 'COVERED'") < baselineHook.indexOf('INSERT INTO public.session_historical_baselines'),
    'the baseline is cut for a COVERED Session only: a LEGACY UNCOVERED SESSION that commits a Moment gets none');
  const clockColumns = (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='session_semantic_clocks' ORDER BY ordinal_position")).map((c) => c.column_name);
  eq(clockColumns, ['session_id', 'user_id', 'current_sp', 'same_sp_event_sequence'], 'T-03C must not alter the Session Semantic Clock');
  // Identities: TypeScript and SQL derive the same namespaces and vectors.
  strict(EVENT_NAMESPACE, '79466f6b-04fd-5150-aa23-59682098057c', 'the event namespace re-derives in TypeScript');
  strict(READING_BINDING_NAMESPACE, '11be3a36-745a-54fd-a938-3f14eaedee14', 'the Thread <-> Reading binding namespace re-derives in TypeScript');
  ok(migrationSql.includes("'79466f6b-04fd-5150-aa23-59682098057c'") && migrationSql.includes("'11be3a36-745a-54fd-a938-3f14eaedee14'"), 'both namespaces are pinned in SQL');
  // R2: the subject-grounding identity and handle namespaces re-derive in both languages, with their pinned vectors.
  strict(SUBJECT_GROUNDING_NAMESPACE, '1592a69d-781e-57ce-bb2c-6744a6ac3ceb', 'the subject-grounding namespace re-derives in TypeScript');
  strict(SUBJECT_GROUNDING_HANDLE_NAMESPACE, '8feaee1d-fe51-5e9e-8594-52499b414e64', 'the subject-grounding handle namespace re-derives in TypeScript');
  ok(migrationSql.includes("'1592a69d-781e-57ce-bb2c-6744a6ac3ceb'") && migrationSql.includes("'8feaee1d-fe51-5e9e-8594-52499b414e64'"), 'both R2 namespaces are pinned in SQL');
  const groundingVector = await one("SELECT public.hypothesis_subject_grounding_identity_v1('11111111-2222-4333-8444-555555555555','4ef8538d-ddda-5e11-b7d9-052be85de59a') g, public.hypothesis_subject_grounding_handle_v1('10000000-0000-4000-8000-000000000005','4ef8538d-ddda-5e11-b7d9-052be85de59a') h");
  strict(groundingVector.g, uuidV5(SUBJECT_GROUNDING_NAMESPACE, '11111111-2222-4333-8444-555555555555:4ef8538d-ddda-5e11-b7d9-052be85de59a'), 'the database and TypeScript derive the same grounding identity');
  strict(groundingVector.g, 'a89b9e67-501f-5c0d-bede-122763231f6e', 'the pinned grounding vector reproduces');
  strict(groundingVector.h, uuidV5(SUBJECT_GROUNDING_HANDLE_NAMESPACE, '10000000-0000-4000-8000-000000000005:4ef8538d-ddda-5e11-b7d9-052be85de59a'), 'the database and TypeScript derive the same opaque handle');
  strict(groundingVector.h, '22d3c5d1-02cc-55e5-97c8-7b5563e5332f', 'the pinned handle vector reproduces');
  const { v } = await one("SELECT public.historical_event_identity_v1('reading-created:11111111-2222-4333-8444-555555555555') v");
  strict(v, uuidV5(EVENT_NAMESPACE, 'reading-created:11111111-2222-4333-8444-555555555555'), 'the database and TypeScript derive the same event identity');
  strict(v, '91dc104c-e42b-54ff-8638-6dd7776f318c', 'the pinned identity vector reproduces');
  await rejected(() => q("SELECT public.historical_event_identity_v1('')"), 'INVALID_HISTORICAL_EVENT_IDENTITY');
}

// ------------------------------------------------------------ B. coverage
async function verifyCoverage(owner, legacyOwner) {
  stage = 'B. R-C1 coverage in the migrated database: a LEGACY UNCOVERED SESSION keeps its Conversation Runtime and stays historical-disabled; a Session without a decision is projection-refused; a new Session is COVERED';
  // A pre-0072 Session as the migration left it: the row, its clock and the
  // LEGACY_UNCOVERED decision (fixture surgery stands in for the deployment
  // boundary that stage B0 crosses for real). It belongs to the second fixture
  // user so that the Reading captured in it below stays out of the first
  // user's world (whose baselines the later stages pin exactly).
  const owner1 = owner;
  owner = legacyOwner;
  const legacy = randomUUID();
  await asReplica(async () => {
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [legacy, owner]);
    await q('INSERT INTO public.session_semantic_clocks(session_id,user_id,current_sp,same_sp_event_sequence) VALUES($1,$2,NULL,0)', [legacy, owner]);
    await q("INSERT INTO public.session_historical_coverage(session_id,user_id,coverage_state) VALUES($1,$2,'LEGACY_UNCOVERED')", [legacy, owner]);
  });
  await identity('postgres');
  const turns = await completedTurns(owner, legacy);
  await identity('postgres');
  // The Conversation Runtime is not gated by coverage: the committed CU lands,
  // the Session Position is allocated, LH advances - and no baseline appears.
  const [committed] = await legacyCommit(legacy, owner, turns.userTurn, randomUUID(), [unit(USER_TEXT, U1)]);
  strict(committed.session_position, 1, 'a LEGACY UNCOVERED SESSION keeps committing Session Positions through the frozen runtime authority');
  strict((await one('SELECT count(*)::int n FROM public.conversation_units WHERE session_id=$1', [legacy])).n, 1, 'the committed CU exists');
  eq((await clockOf(legacy)).current_sp, 1, 'LH advances normally for runtime');
  strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [legacy])).n, 0, 'a LEGACY UNCOVERED SESSION never gets a baseline - not even at its first post-deploy Moment');
  // Post-deploy capture associated with the legacy Session is retained
  // internally with its truthful anchor and upgrades nothing.
  const ctx = await beginCapture(owner, legacy, true);
  eq([ctx.session_id, ctx.session_position], [legacy, 1], 'the association anchors at the legacy Session\'s Session Position');
  await identity('service_role');
  const captured = randomUUID();
  await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, captured, 'post-deploy reading in a legacy Session', 'CAUSAL', 'GENERAL', `CONVERSATION_SESSION:${legacy}`, 'SYSTEM_GENERATED', [], []]);
  await newLogicalTransaction();
  eq((await eventsOf('historical_reading_events', 'hypothesis_id=$1', [captured])).map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', legacy, 1]]);
  eq(await one('SELECT coverage_state FROM public.session_historical_coverage WHERE session_id=$1', [legacy]), { coverage_state: 'LEGACY_UNCOVERED' }, 'post-deploy capture never upgrades coverage');
  strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [legacy])).n, 0, 'and never fabricates a baseline');
  await identity('authenticated', owner);
  eq(await one('SELECT live_head FROM public.get_session_temporal_state_v1($1)', [legacy]), { live_head: 1 }, 'the frozen T-03A2 delivery serves the legacy Session');
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [legacy, 1]), 'HISTORICAL_COVERAGE_UNAVAILABLE', ['55000']);
  // A Session with NO coverage decision at all: the runtime is equally
  // ungated, no baseline can be cut, and the projection refuses the same way.
  const undecided = randomUUID();
  await asReplica(async () => {
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [undecided, owner]);
    await q('INSERT INTO public.session_semantic_clocks(session_id,user_id,current_sp,same_sp_event_sequence) VALUES($1,$2,NULL,0)', [undecided, owner]);
  });
  await identity('postgres');
  const undecidedTurns = await completedTurns(owner, undecided);
  await identity('postgres');
  const [undecidedCommit] = await legacyCommit(undecided, owner, undecidedTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1)]);
  strict(undecidedCommit.session_position, 1, 'a Session without a coverage decision still commits Session Positions');
  strict((await one('SELECT count(*)::int n FROM public.session_historical_baselines WHERE session_id=$1', [undecided])).n, 0, 'no baseline without a COVERED decision');
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [undecided, 1]), 'HISTORICAL_COVERAGE_UNAVAILABLE', ['55000']);
  owner = owner1;
  // A new Session is COVERED at creation and, before its first Moment, has no
  // addressable TC (technical absence, never UNKNOWN_AT_TC).
  const fresh = await newSession(owner);
  eq(await one('SELECT coverage_state FROM public.session_historical_coverage WHERE session_id=$1', [fresh]), { coverage_state: 'COVERED' }, 'a new Session is COVERED at creation');
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [fresh, 1]), 'LIVE_HEAD_NOT_ESTABLISHED', ['55000']);
  await identity('postgres');
  await rejected(() => q("UPDATE public.session_historical_coverage SET coverage_state='COVERED' WHERE session_id=$1", [legacy]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.session_historical_coverage WHERE session_id=$1', [legacy]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("INSERT INTO public.session_historical_coverage(session_id,user_id,coverage_state) VALUES($1,$2,'PARTIAL')", [fresh, owner]), 'session_historical_coverage', ['23514', '23505']);
}

// --------------------------------------------------- C. the legacy world
async function legacyWorld(owner) {
  stage = 'C. legacy analytical world before any covered Session (unassociated writes)';
  await identity('service_role');
  const H0 = randomUUID();
  await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, H0, 'legacy reading: the manager avoids direct feedback', 'CAUSAL', 'GENERAL', 'legacy scope', 'HUMAN_REVIEWED', ['assumes one team'], ['direct feedback observed']]);
  await newLogicalTransaction();
  await identity('service_role');
  const M0 = randomUUID();
  await rows('SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, M0, 'GOAL', 'legacy material: wants a calmer team', 'USER_STATED', 1, 0.8, 'ACTIVE', null]);
  await newLogicalTransaction();
  await identity('service_role');
  const M6 = randomUUID();
  await rows('SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, M6, 'TEMPORARY_STATE', 'legacy material with an expiry', 'USER_STATED', 1, 0.5, 'ACTIVE', new Date(Date.now() + 86_400_000).toISOString()]);
  await newLogicalTransaction();
  await identity('service_role');
  const M7 = randomUUID();
  await rows('SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, M7, 'TEMPORARY_STATE', 'legacy material expiring exactly at a Moment', 'USER_STATED', 1, 0.5, 'ACTIVE', new Date(Date.now() + 86_400_000).toISOString()]);
  await newLogicalTransaction();
  await identity('service_role');
  await rows("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [owner, H0, `memory:${M0}`]);
  await newLogicalTransaction();
  await identity('authenticated', owner);
  const [active] = await rows('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)', [H0, 2, 'ACTIVE']);
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.version, 3);
  await newLogicalTransaction();
  const reading = await eventsOf('historical_reading_events', 'hypothesis_id=$1', [H0]);
  eq(reading.map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', null, null], ['VERSION_ADVANCED', null, null], ['STATUS_TRANSITION', null, null]],
    'unassociated writes are captured with a world version and NO Session anchor (never untracked, never fabricated)');
  ok(new Set(reading.map((e) => e.wv)).size === 3, 'each logical transaction advanced the world clock by exactly one');
  eq((await eventsOf('historical_evidence_participation_events', 'hypothesis_id=$1', [H0])).map((e) => e.event_kind), ['ATTACHED']);
  await identity('service_role');
  const M9 = randomUUID();
  await rows('SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, M9, 'GOAL', 'legacy material that stays eligible Evidence', 'USER_CONFIRMED', 1, 0.7, 'ACTIVE', null]);
  await newLogicalTransaction();
  await identity('service_role');
  const M10 = randomUUID();
  await rows('SELECT * FROM public.server_create_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, M10, 'GOAL', 'a second legacy material that stays eligible Evidence', 'USER_CONFIRMED', 1, 0.7, 'ACTIVE', null]);
  await newLogicalTransaction();
  return { H0, M0, M6, M7, M9, M10, worldBefore: await worldVersionOf(owner) };
}

// ------------------------------------------ D. Session 1 and the baseline
async function verifyBaselineAndFamilies(owner, other, legacy) {
  stage = 'D. baseline at SP(1), world-known vs Session-anchored knowledge, Thread / LF / Emerging Focus / Moments at TC';
  const world = await sessionOne(owner);
  await newLogicalTransaction();
  const baseline = await one('SELECT baseline_world_version::text v FROM public.session_historical_baselines WHERE session_id=$1', [world.session]);
  strict(Number(baseline.v), legacy.worldBefore, 'the baseline is exactly the world version at SP(1): every earlier unassociated fact is known, nothing later');
  const availability = await rows('SELECT thread_id, world_version::text wv FROM public.historical_thread_availability WHERE thread_id = ANY($1) ORDER BY thread_id', [[world.threads.manager, world.threads.ahmed]]);
  ok(availability.length === 2 && availability.every((a) => Number(a.wv) > legacy.worldBefore), 'the two Threads established in Session 1 carry a world version beyond the baseline');
  await rejected(() => project(other, world.session, 1), 'FORBIDDEN', ['42501']);
  await identity('anon');
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, 1]), 'permission denied', ['42501']);
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, 0]), 'SESSION_POSITION_NOT_ADDRESSABLE');
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, 6]), 'SESSION_POSITION_NOT_ADDRESSABLE');
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, null]), 'SESSION_POSITION_NOT_ADDRESSABLE');
  await identity('postgres');

  const k1 = await project(owner, world.session, 1);
  eq([k1.live_head, k1.tc, k1.sealed], [5, 1, true]);
  eq(k1.moments.map((m) => [m.sp, m.sourceRole]), [[1, 'USER']], 'exactly the Moments with SP <= TC');
  eq(idsOf(k1.threads), [world.threads.manager], 'a Thread established at SP3 is UNKNOWN at TC = 1 (P66-A)');
  eq(k1.threads[0].sessionLifecycle, 'ACTIVE');
  eq(k1.threads[0].establishedInSession, true);
  eq(k1.threads[0].establishedSp, 1);
  ok(/^-?[0-9]+$/u.test(k1.threads[0].home.x) && /^-?[0-9]+$/u.test(k1.threads[0].home.y), 'the ONE Home crosses as exact integer text');
  eq([k1.live_focus.kind, k1.live_focus.ref, k1.live_focus.atSp, k1.live_focus.reasonCode], ['THREAD', world.threads.manager, 1, 'NEW_INDEPENDENT_FOCUS'], 'LF at TC from the durable 0071 history');
  eq(k1.emerging_focuses.map((f) => [f.id, f.startedSp, f.promotedThreadId]), [[world.focuses.manager, 1, world.threads.manager]], 'the Emerging Focus and its same-Moment promotion at TC = 1');
  eq(idsOf(k1.readings), [legacy.H0], 'the legacy Reading is known through the baseline');
  eq([k1.readings[0].statusAtTc, k1.readings[0].versionAtTc], ['ACTIVE', 3], 'then-current status and version at TC');
  eq(k1.readings[0].lineage.map((s) => s.kind), ['CREATED', 'VERSION_ADVANCED', 'STATUS_TRANSITION'], 'known lineage stays known, never mistaken for current');
  eq(idsOf(k1.materials), [legacy.M0, legacy.M6, legacy.M7, legacy.M9, legacy.M10].sort(byText));
  eq(k1.evidence_participations, [{ hypothesisId: legacy.H0, evidenceId: `memory:${legacy.M0}`, memoryId: legacy.M0, role: 'SUPPORTING' }]);
  eq([k1.reading_relations, k1.gaps, k1.questions, k1.question_appearances, k1.confidences, k1.thread_reading_appearances], [[], [], [], [], [], []]);

  const k3 = await project(owner, world.session, 3);
  eq(idsOf(k3.threads), [world.threads.manager, world.threads.ahmed].sort(byText), 'both Threads known at TC = 3');
  eq(Object.fromEntries(k3.threads.map((t) => [t.id, t.sessionLifecycle])), { [world.threads.manager]: 'DORMANT', [world.threads.ahmed]: 'ACTIVE' }, 'lifecycle at TC from the durable 0070 history');
  eq([k3.live_focus.kind, k3.live_focus.ref, k3.live_focus.atSp, k3.live_focus.reasonCode], ['THREAD', world.threads.ahmed, 3, 'FOCUS_REPLACEMENT']);
  eq(k3.emerging_focuses.map((f) => [f.startedSp, f.promotedThreadId]).sort((a, b) => a[0] - b[0]), [[1, world.threads.manager], [3, world.threads.ahmed]]);
  const k2 = await project(owner, world.session, 2);
  eq(Object.fromEntries(k2.threads.map((t) => [t.id, t.sessionLifecycle])), { [world.threads.manager]: 'ACTIVE' }, 'at TC = 2 the manager is still ACTIVE: the DORMANT transition at SP3 is unknown');
  const k5 = await project(owner, world.session, 5);
  eq([k5.sealed, k5.moments.length, k5.emerging_focuses.map((f) => f.lastAttentionSp).sort()], [false, 5, [1, 5]], 'the open head: 5 Moments, the assistant attended Ahmed through SP5');
  eq(k5.threads.map((t) => t.home), k3.threads.map((t) => t.home), 'ONE Home per Thread at every TC');

  // A world-only write AFTER the baseline never enters Session 1 (any TC), and
  // enters a LATER Session through ITS baseline (REV66-06 section 4.5: baseline
  // inheritance across Sessions - a useful proof, but NOT the deployment-spanning
  // P66-C, which stage B0 proves on a fresh database).
  await identity('service_role');
  const H1 = randomUUID();
  await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, H1, 'reading written without a Session association after the baseline', 'CAUSAL', 'GENERAL', 'later scope', 'HUMAN_REVIEWED', [], []]);
  await newLogicalTransaction();
  ok(!idsOf((await project(owner, world.session, 5)).readings).includes(H1), 'an unassociated later fact is not this Session\'s knowledge even at LH');
  const laterSession = await newSession(owner);
  const laterTurns = await completedTurns(owner, laterSession);
  await identity('postgres');
  await legacyCommit(laterSession, owner, laterTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1)]);
  await newLogicalTransaction();
  ok(idsOf((await project(owner, laterSession, 1)).readings).includes(H1), 'REV66-06 section 4.5: the later Session inherits it through its own baseline at SP(1)');
  ok(idsOf((await project(owner, laterSession, 1)).threads).includes(world.threads.ahmed), 'and inherits the Threads of Session 1 through the world availability');
  eq((await project(owner, laterSession, 1)).threads.find((t) => t.id === world.threads.ahmed).sessionLifecycle, null, 'a Thread never bound in this Session has no Session-local lifecycle here');
  return { world, H1, laterSession };
}

// --------------------------------------- E. associated analytical writes
async function verifyAssociatedWrites(owner, legacy, worldState) {
  stage = 'E. server-owned Session association, per-family P66-A / P66-B / Z66-04, open-head evolution';
  const { world } = worldState;
  const before4 = await project(owner, world.session, 4);
  const before = await project(owner, world.session, 5);
  // An associated write: the execution owns the Session; the boundary is
  // entered first (Session clock -> seam -> world clock), then the writes.
  const ctx = await beginCapture(owner, world.session, true);
  eq([ctx.session_id, ctx.session_position], [world.session, 5], 'the association anchors at the current committed Session Position');
  const seq = Number(ctx.seq);
  // SP5 is the assistant's clarification: B1 took seq 1, no Thread-layer event,
  // no LF transition - the associated write continues the same-SP order after
  // the CU's own semantic events, never before or beside them.
  ok(seq >= 2, `the same-SP sequence continues after the Moment's own semantic events: got ${seq}`);
  const again = await beginCapture(owner, world.session, true);
  eq(again, ctx, 'the boundary is entered once per (user, Session) per transaction: a retry reserves nothing new');
  await identity('service_role');
  const H2 = randomUUID();
  await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [owner, H2, 'reading created in Session 1 at SP5', 'CAUSAL', 'GENERAL', `CONVERSATION_SESSION:${world.session}`, 'SYSTEM_GENERATED', [], []]);
  await rows("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [owner, H2, `memory:${legacy.M0}`]);
  await rows('SELECT * FROM public.background_link_competing_hypotheses_v1($1,$2,$3)', [owner, H2, legacy.H0]);
  const C1 = randomUUID();
  await identity('postgres');
  const [linked] = await rows('SELECT version FROM public.hypotheses WHERE id=$1', [H2]);
  await identity('service_role');
  await rows('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)', [owner, C1, H2, linked.version]);
  await identity('authenticated', owner);
  const [admitted] = await rows('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)', [H2, linked.version, 'ACTIVE']);
  await identity('service_role');
  const C2 = randomUUID();
  await rows('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)', [owner, C2, H2, admitted.version]);
  await newLogicalTransaction();
  const anchored = await eventsOf('historical_reading_events', 'hypothesis_id=$1', [H2]);
  ok(anchored.length >= 3 && anchored.every((e) => e.session_id === world.session && e.session_position === 5 && e.seq === ctx.seq && e.wv === ctx.wv),
    'every write of the transaction carries the ONE context: Session, SP, same-SP sequence and world version');
  const k4 = await project(owner, world.session, 4);
  ok(!idsOf(k4.readings).includes(H2), 'P66-A: the Reading created at SP5 is UNKNOWN at TC = 4');
  eq([k4.reading_relations, k4.confidences], [[], []], 'no relation stub and no Confidence for an unknown Reading');
  const k5 = await project(owner, world.session, 5);
  const h2 = k5.readings.find((r) => r.id === H2);
  eq([h2.statusAtTc, h2.versionAtTc], ['ACTIVE', admitted.version], 'then-current status and version at TC = 5');
  eq(k5.reading_relations, [{ a: [legacy.H0, H2].sort(byText)[0], b: [legacy.H0, H2].sort(byText)[1] }], 'the peer relation is known only when both endpoints are known');
  eq(k5.evidence_participations.filter((p) => p.hypothesisId === H2), [{ hypothesisId: H2, evidenceId: `memory:${legacy.M0}`, memoryId: legacy.M0, role: 'SUPPORTING' }]);
  eq(Object.fromEntries(k5.confidences.map((c) => [c.id, c.resolution])), { [C1]: 'SUPERSEDED', [C2]: 'CURRENT' }, 'Z66-04: a Confidence of an earlier version is SUPERSEDED, the latest of the then-current version is CURRENT');
  eq(withoutRevision(before4), withoutRevision(k4), 'TC = 4 is sealed: identical before and after the associated write at SP5');
  ok(JSON.stringify(withoutRevision(before)) !== JSON.stringify(withoutRevision(k5)), 'the open head (TC = LH = 5) evolved with the associated write while LH did not move');
  eq(k5.live_head, 5, 'LH did not move');
  // Z66-04 PREVALID: a Confidence whose target version this Session does not
  // know (the version advance was unassociated) is PREVALID, never CURRENT.
  await identity('authenticated', owner);
  const [drifted] = await rows('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)', [H2, admitted.version, 'SUPPORTED']);
  await newLogicalTransaction();
  await beginCapture(owner, world.session, true);
  await identity('service_role');
  const C3 = randomUUID();
  await rows('SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)', [owner, C3, H2, drifted.version]);
  await newLogicalTransaction();
  const k5b = await project(owner, world.session, 5);
  eq(k5b.readings.find((r) => r.id === H2).statusAtTc, 'ACTIVE', 'the unassociated SUPPORTED transition is not this Session\'s knowledge');
  eq(k5b.confidences.find((c) => c.id === C3).resolution, 'PREVALID', 'Z66-04: the associated Confidence targets a version this Session does not know');
  return { H2, C1, C2, C3 };
}

// -------------------------------- F. Information Gaps, Questions, appearance
async function verifyGapsQuestionsAndAppearance(owner, worldState, readings) {
  stage = 'F. Information Gap / Question candidate / Formal Question <-> Turn appearance (P66-D) / Thread <-> Reading appearance';
  const { world } = worldState;
  // A durable Confidence statement delivered through a RUNNING execution of
  // THIS Session, synchronized through the unchanged v1 entry (now a wrapper).
  const E1 = randomUUID();
  const evaluation = randomUUID();
  await identity('postgres');
  await q("INSERT INTO public.confidence_evaluations(id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,alternative_hypothesis_ids,missing_information_codes,policy_version,provenance) VALUES($1,$2,$3,'HYPOTHESIS',(SELECT version FROM public.hypotheses WHERE id=$3),1,'EVALUATED',NULL,NULL,'UNCALIBRATED','UNASSESSED','{}','{}','{}','{}',$4,'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME')",
    [evaluation, owner, readings.H2, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED']]);
  await q("INSERT INTO public.post_response_intelligence_executions(id,event_id,user_id,session_id,source_turn_id,event_version,processing_path,safety_disposition,state,current_stage,outcome_code,terminal_at) VALUES($1,$2,$3,$4,$5,'2.0','FAST','ALLOW','RUNNING','VERIFIER_0072',NULL,NULL)",
    [E1, randomUUID(), owner, world.session, randomUUID()]);
  await q("INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,'CONFIDENCE_BATCH','COMPLETED',CURRENT_TIMESTAMP,'CONFIDENCE_BATCH_EVALUATED',$2)",
    [E1, JSON.stringify([{ ordinal: 1, hypothesisId: readings.H2, targetVersion: (await one('SELECT version FROM public.hypotheses WHERE id=$1', [readings.H2])).version, confidenceEvaluationId: evaluation }])]);
  await newLogicalTransaction();
  await identity('service_role');
  const synced = await one('SELECT public.sync_post_response_information_gaps_v1($1) value', [E1]);
  ok(synced.value, 'the v1 synchronization entry still works through the wrapper');
  await newLogicalTransaction();
  const gap = await one('SELECT g.* FROM public.information_gaps g JOIN public.information_gap_confidence_sources s ON s.information_gap_id=g.id WHERE s.hypothesis_id=$1 AND s.missing_information_code=$2', [readings.H2, 'UNVERIFIED_ASSUMPTIONS']);
  ok(gap, 'the synchronization created the Information Gap');
  const gapEvents = await eventsOf('historical_gap_events', 'information_gap_id=$1', [gap.id]);
  eq(gapEvents.map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', world.session, 5]], 'the Gap is anchored through the execution\'s Session at SP5: the caller supplied no session id');
  // The Question candidate (the 0007 creator) anchors only through an
  // associated context; the verifier associates it to Session 1 at SP5 exactly
  // as an execution-owned writer would, then creates it through the frozen creator.
  await beginCapture(owner, world.session, true);
  await identity('authenticated', owner);
  const questionId = randomUUID();
  const [question] = await rows('SELECT * FROM public.create_validated_question_candidate($1::jsonb)', [JSON.stringify({
    id: questionId, informationGapId: gap.id, questionText: 'When did the tension with the team start?', questionType: 'FACT_FINDING',
    targetHypothesisIds: [readings.H2], dependencyIds: [], informationNeeded: 'the timeframe of the tension', answerFormat: 'FREE_TEXT' })]);
  await newLogicalTransaction();
  eq((await eventsOf('historical_question_events', 'question_candidate_id=$1', [question.id])).map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', world.session, 5]]);
  const k4 = await project(owner, world.session, 4);
  eq([k4.gaps, k4.questions], [[], []], 'P66-A: unknown at TC = 4');
  const k5 = await project(owner, world.session, 5);
  eq(k5.gaps.map((g) => [g.id, g.statusAtTc, g.openEpochAtTc, g.readingIds]), [[gap.id, 'OPEN', 1, [readings.H2]]]);
  eq(k5.questions.map((x) => [x.id, x.informationGapId, x.targetReadingIds]), [[question.id, gap.id, [readings.H2]]]);
  eq(k5.question_appearances, [], 'no Formal Question appearance exists before it is bound at a Turn');

  // The Thread <-> Reading appearance at SP5, before the next exchange.
  await identity('postgres');
  const bound = await one('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, world.session, world.threads.manager, readings.H2]);
  eq([bound.bound_sp, bound.unbound_sp], [5, null]);
  strict(bound.binding_id, uuidV5(READING_BINDING_NAMESPACE, `${world.session}:${world.threads.manager}:${readings.H2}:5`), 'the appearance identity is derived, never random');
  const rebound = await one('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, world.session, world.threads.manager, readings.H2]);
  eq(rebound, bound, 'binding an already current appearance is idempotent');
  await newLogicalTransaction();
  eq((await project(owner, world.session, 5)).thread_reading_appearances, [{ bindingId: bound.binding_id, threadId: world.threads.manager, hypothesisId: readings.H2, boundSp: 5, current: true }]);
  eq((await project(owner, world.session, 4)).thread_reading_appearances, [], 'P66-A for the appearance');

  // The next exchange binds the selected formal Question at finalization; the
  // appearance is anchored at the exchange's FIRST committed Moment (SP6).
  const selection = { binding: null };
  const quiet = await quietExchange(owner, world, async (userTurn) => {
    await identity('service_role');
    const selected = await one('SELECT * FROM public.select_formal_question_opportunity_v1($1,$2,$3)', [owner, world.session, userTurn]);
    assert.equal(selected.outcome, 'SELECTED', `a formal Question opportunity is selected for the generating turn (${selected.outcome})`);
    selection.binding = selected.binding_id;
    return selected.binding_id;
  });
  await newLogicalTransaction();
  eq(quiet.liveHead, 7, 'the quiet exchange committed SP6 and SP7');
  const bindingRow = await one('SELECT state, source_turn_id FROM public.formal_question_turn_bindings WHERE id=$1', [selection.binding]);
  eq([bindingRow.state, bindingRow.source_turn_id], ['BOUND', quiet.turns.userTurn]);
  eq(await rows('SELECT session_position, same_sp_event_sequence::text seq FROM public.historical_question_appearance_events WHERE binding_id=$1', [selection.binding]), [{ session_position: 6, seq: '0' }],
    'P66-D: the appearance is anchored at the first committed Moment of its exchange, at sequence 0');
  eq((await project(owner, world.session, 5)).question_appearances, [], 'unknown before the Moment that carries it');
  const k6 = await project(owner, world.session, 6);
  eq(k6.question_appearances.map((a) => [a.bindingId, a.informationGapId, a.hypothesisId, a.sourceTurnId, a.appearedAtSp]), [[selection.binding, gap.id, readings.H2, quiet.turns.userTurn, 6]]);
  eq(k6.moments.map((m) => m.sp), [1, 2, 3, 4, 5, 6]);
  eq([k6.live_focus.kind, k6.live_focus.ref, k6.live_focus.atSp], ['THREAD', world.threads.ahmed, 3], 'LF unchanged through the quiet exchange');

  // Gap closure at SP7 through the frozen 0063 authorized transition shape,
  // inside an associated context: CLOSED at SP7, OPEN at SP6.
  await beginCapture(owner, world.session, true);
  await q("SELECT set_config('qandeel.information_gap_lifecycle_transition','authorized',true)");
  await q("UPDATE public.information_gaps SET status='RESOLVED', closed_at=CURRENT_TIMESTAMP, closure_reason='MISSING_INFORMATION_CODE_ABSENT', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [gap.id]);
  await q("SELECT set_config('qandeel.information_gap_lifecycle_transition','',true)");
  await newLogicalTransaction();
  eq((await project(owner, world.session, 6)).gaps.find((g) => g.id === gap.id).statusAtTc, 'OPEN', 'P66-B: still OPEN at TC = 6');
  const closed = (await project(owner, world.session, 7)).gaps.find((g) => g.id === gap.id);
  eq([closed.statusAtTc, closed.closureReasonAtTc, closed.openEpochAtTc], ['RESOLVED', 'MISSING_INFORMATION_CODE_ABSENT', 1], 'RESOLVED at TC = 7 with its closure reason');
  // Unbind the Thread <-> Reading appearance at SP7: current at 5..6, not at 7.
  await identity('postgres');
  const unbound = await one('SELECT * FROM public.unbind_reading_from_thread_v1($1,$2,$3)', [owner, world.session, bound.binding_id]);
  eq([unbound.bound_sp, unbound.unbound_sp], [5, 7]);
  eq(await one('SELECT * FROM public.unbind_reading_from_thread_v1($1,$2,$3)', [owner, world.session, bound.binding_id]), unbound, 'unbinding twice is idempotent');
  await newLogicalTransaction();
  eq((await project(owner, world.session, 6)).thread_reading_appearances[0].current, true);
  eq((await project(owner, world.session, 7)).thread_reading_appearances.map((a) => a.current), [false]);
  await identity('postgres');
  const life2 = await one('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, world.session, world.threads.manager, readings.H2]);
  eq([life2.bound_sp, life2.unbound_sp], [7, null], 'a second life of the appearance starts at SP7');
  await one('SELECT * FROM public.unbind_reading_from_thread_v1($1,$2,$3)', [owner, world.session, life2.binding_id]);
  await rejected(() => q('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, world.session, world.threads.manager, readings.H2]), 'THREAD_READING_BINDING_IDENTITY_CONFLICT');
  await rejected(() => q('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, world.session, randomUUID(), readings.H2]), 'FORBIDDEN', ['42501']);
  // A different Session of the same owner is a legitimate association: the
  // appearance simply lives in THAT Session, at ITS current Session Position.
  await newLogicalTransaction();
  const elsewhere = await one('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, worldState.laterSession, world.threads.manager, readings.H2]);
  eq([elsewhere.bound_sp, elsewhere.unbound_sp], [1, null], 'bound at the later Session\'s own SP(1)');
  await newLogicalTransaction();
  ok(!(await project(owner, world.session, 7)).thread_reading_appearances.some((a) => a.bindingId === elsewhere.binding_id), 'an appearance of another Session is not this Session\'s knowledge');
  await rejected(() => q("UPDATE public.thread_reading_bindings SET thread_id=$2 WHERE binding_id=$1", [bound.binding_id, world.threads.ahmed]), 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.thread_reading_bindings WHERE binding_id=$1', [bound.binding_id]), 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE', ['55000']);
  return { gap, question, binding: selection.binding, appearance: bound.binding_id, liveHead: 7 };
}

// -------------------------------------------------- G. R-C5 expiry mapping
async function verifyExpiry(owner, legacy, worldState) {
  stage = 'G. R-C5 expiry mapped into SP space (PRE_FIRST_SP / SP(n) / tie / open head / PENDING / NOT_IN_SESSION), P66-G / P66-H';
  const { world } = worldState;
  // Fixture wall times: one physical transaction has ONE CURRENT_TIMESTAMP, so
  // the committed Moments are given distinct audit times by the fixture owner
  // (t(k) = base + k minutes, all in the past), and the legacy Materials get
  // expiries placed against them. This is fixture surgery on verifier-owned
  // rows, never canonical behaviour.
  const base = "(now() - interval '100 minutes')";
  await asReplica(async () => {
    await q(`UPDATE public.conversation_units SET created_at = ${base} + (session_position * interval '1 minute') WHERE session_id=$1`, [world.session]);
    await q(`UPDATE public.memories SET created_at = ${base} - interval '1 hour', expires_at = ${base} + interval '4 minutes 30 seconds' WHERE id=$1`, [legacy.M6]);
    await q(`UPDATE public.memories SET created_at = ${base} - interval '1 hour', expires_at = ${base} + interval '4 minutes' WHERE id=$1`, [legacy.M7]);
  });
  await identity('postgres');
  const t = async (k) => (await one('SELECT public.historical_session_position_wall_time_v1($1,$2) t', [world.session, k])).t;
  ok((await t(1)) < (await t(2)) && (await t(6)) < (await t(7)), 'the fixture Moments carry strictly increasing wall times');
  const mapping = async (expression) => one(`SELECT mapping, session_position FROM public.historical_memory_expiry_at_sp_v1($1, ${expression})`, [world.session]);
  eq(await mapping('NULL::timestamptz'), { mapping: 'NO_EXPIRY', session_position: null });
  eq(await mapping(`${base} + interval '30 seconds'`), { mapping: 'PRE_FIRST_SP', session_position: null }, 'X < t(1): expired at every addressable SP');
  eq(await mapping(`${base} + interval '4 minutes 30 seconds'`), { mapping: 'SP', session_position: 4 }, 't(4) <= X < t(5) maps to SP(4)');
  eq(await mapping(`${base} + interval '4 minutes'`), { mapping: 'SP', session_position: 4 }, 'P66-H: an exact tie X = t(4) is EXPIRED at SP(4), half-open');
  eq(await mapping(`${base} + interval '3 minutes 59 seconds'`), { mapping: 'SP', session_position: 3 }, 'one second before t(4) belongs to SP(3)');
  eq(await mapping(`${base} + interval '7 minutes 30 seconds'`), { mapping: 'SP', session_position: 7 }, 't(LH) <= X <= now: expired inside the open head');
  eq(await mapping("now() + interval '1 day'"), { mapping: 'PENDING', session_position: null }, 'a future expiry belongs to no SP yet');
  await q("UPDATE public.conversation_sessions SET status='CLOSED', closed_at = now() - interval '10 minutes' WHERE id=$1", [world.session]).catch(async () => {
    await q("UPDATE public.conversation_sessions SET closed_at = now() - interval '10 minutes' WHERE id=$1", [world.session]);
  });
  eq(await mapping("now() - interval '5 minutes'"), { mapping: 'NOT_IN_SESSION', session_position: null }, 'an expiry after the Session closed belongs to no SP of it');
  eq(await mapping(`${base} + interval '7 minutes 30 seconds'`), { mapping: 'SP', session_position: 7 }, 'an expiry before the close still maps into the Session');
  await q("UPDATE public.conversation_sessions SET status='ACTIVE', closed_at = NULL WHERE id=$1", [world.session]).catch(async () => {
    await q('UPDATE public.conversation_sessions SET closed_at = NULL WHERE id=$1', [world.session]);
  });
  // P66-G: known ACTIVE at TC = 3, EXPIRED at TC = 4 (M6 expires inside SP(4));
  // P66-H: M7 expires exactly at t(4): EXPIRED at TC = 4, ACTIVE at TC = 3.
  for (const [memory, label] of [[legacy.M6, 'inside SP(4)'], [legacy.M7, 'exactly at t(4)']]) {
    const at3 = (await project(owner, world.session, 3)).materials.find((m) => m.id === memory);
    const at4 = (await project(owner, world.session, 4)).materials.find((m) => m.id === memory);
    const at7 = (await project(owner, world.session, 7)).materials.find((m) => m.id === memory);
    eq([at3.statusAtTc, at4.statusAtTc, at7.statusAtTc], ['ACTIVE', 'EXPIRED', 'EXPIRED'], `a Material expiring ${label} is ACTIVE at TC = 3 and EXPIRED from TC = 4 on`);
    eq(at4.expiry, { mapping: 'SP', sp: 4 });
    eq([at3.id, at3.version], [memory, 1], 'identity and lineage stay known after expiry');
  }
  // Expiry never advances LH, never moves TC and never writes RH: it is a mapping.
  eq((await clockOf(world.session)).current_sp, 7);
  // A supersession within an associated context: the predecessor becomes
  // SUPERSEDED at SP7 and its successor is created there; lineage both ways.
  await beginCapture(owner, world.session, true);
  await identity('service_role');
  const M5 = randomUUID();
  await rows('SELECT * FROM public.server_supersede_memory_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [owner, legacy.M0, M5, 'GOAL', 'the calmer team, restated', 'USER_CONFIRMED', 1, 0.9, 'ACTIVE', null]);
  await newLogicalTransaction();
  const k6 = await project(owner, world.session, 6);
  eq(k6.materials.find((m) => m.id === legacy.M0).statusAtTc, 'ACTIVE', 'the predecessor is still ACTIVE at TC = 6');
  ok(!idsOf(k6.materials).includes(M5), 'the successor is UNKNOWN at TC = 6 (Z66-03: a later identity, even with a known lineage anchor)');
  eq(k6.materials.find((m) => m.id === legacy.M0).supersededByMemoryId, null, 'no forward lineage to an unknown successor');
  const k7 = await project(owner, world.session, 7);
  eq([k7.materials.find((m) => m.id === legacy.M0).statusAtTc, k7.materials.find((m) => m.id === legacy.M0).supersededByMemoryId], ['SUPERSEDED', M5]);
  eq(k7.materials.find((m) => m.id === M5).supersedesMemoryId, legacy.M0, 'lineage in both directions once both are known');
  return { M5 };
}

// ---------------------------- H. the managed commands and the Memory command
async function verifyManagedCommands(owner, legacy, worldState) {
  stage = 'H. the three managed commands + the execution-associated Memory command anchor through the execution; cores unreachable; wrappers unchanged for callers';
  const { world } = worldState;
  const execution = { id: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q('SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)', [execution.id, randomUUID(), owner, world.session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [execution.id, 'INTENT_PROVIDER'])).ok, true);
  const intent = { problem: { text: 'Why does the team feel tense?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn }, domain: 'GENERAL',
    scope: { kind: 'CONVERSATION_SESSION', sessionId: world.session, serialized: `CONVERSATION_SESSION:${world.session}` }, evidenceIds: [`memory:${legacy.M9}`] };
  strict((await one('SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok', [execution.id, 'INTENT_AUTHORIZED', JSON.stringify(intent)])).ok, true);
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [execution.id, 'CANDIDATE_PROVIDER'])).ok, true);
  const generated = randomUUID();
  const candidates = [{ hypothesisId: generated, statement: `generated reading ${generated}`, type: 'CAUSAL', domain: 'GENERAL', scope: `CONVERSATION_SESSION:${world.session}`,
    supportingEvidenceIds: [`memory:${legacy.M9}`], contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [] }];
  strict((await one('SELECT public.complete_post_response_candidate_provider_effect_v1($1,$2,$3) ok', [execution.id, 'VALIDATED_CANDIDATES', JSON.stringify(candidates)])).ok, true);
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [execution.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true);
  await newLogicalTransaction();
  await identity('service_role');
  strict((await one('SELECT public.persist_post_response_hypothesis_generation_v1($1) ok', [execution.id])).ok, true, 'the managed generation command keeps its name, signature, result and grant');
  await newLogicalTransaction();
  const events = await eventsOf('historical_reading_events', 'hypothesis_id=$1', [generated]);
  ok(events.length >= 2 && events.every((e) => e.session_id === world.session && e.session_position === 7), 'the generated Reading is anchored through the execution\'s Session at the current SP - no caller supplied it');
  const countBefore = (await one('SELECT count(*)::int n FROM public.historical_reading_events WHERE hypothesis_id=$1', [generated])).n;
  await identity('service_role');
  strict(typeof (await one('SELECT public.persist_post_response_hypothesis_generation_v1($1) ok', [execution.id])).ok, 'boolean', 'a durable retry is answered as the frozen core answers it (a bounded no-op)');
  await newLogicalTransaction();
  strict((await one('SELECT count(*)::int n FROM public.historical_reading_events WHERE hypothesis_id=$1', [generated])).n, countBefore, 'and duplicates no history');
  eq((await project(owner, world.session, 7)).readings.find((r) => r.id === generated).statusAtTc, 'ACTIVE', 'known ACTIVE at the open head');
  eq((await project(owner, world.session, 6)).readings.find((r) => r.id === generated), undefined, 'unknown at TC = 6');
  for (const [core, args] of [[PERSIST_CORE, [execution.id]], [CONFIDENCE_BATCH_CORE, [execution.id]]]) {
    await identity('service_role');
    await rejected(() => q(`SELECT public.${core.slice('public.'.length).replace(/\(.*$/u, '')}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args), 'permission denied', ['42501']);
  }
  await identity('service_role');
  await rejected(() => q('SELECT public.execute_post_response_hypothesis_update_batch_v1_core($1,$2::jsonb)', [execution.id, '[]']), 'permission denied', ['42501']);
  // The other two wrappers run (bounded no-op for this execution) through the boundary.
  strict(typeof (await one('SELECT public.execute_post_response_confidence_batch_v1($1) v', [execution.id])).v, 'string', 'the confidence batch command answers through its wrapper');
  await newLogicalTransaction();
  // A missing execution is a no-op for the boundary, never a failure or a fabricated anchor.
  await identity('postgres');
  await q('SELECT public.historical_capture_begin_for_execution_v1($1)', [randomUUID()]);
  eq((await one("SELECT current_setting('qandeel.historical_capture_context', true) c")).c, '', 'no execution, no context');
  // The execution-associated Memory command: owner AND Session from the RUNNING
  // execution keyed by the canonical source turn; nothing weaker qualifies.
  const memoryExecution = { id: randomUUID(), turn: randomUUID() };
  await q('SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)', [memoryExecution.id, randomUUID(), owner, world.session, memoryExecution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  await rejected(() => q("SELECT * FROM public.server_create_memory_for_execution_v1($1,$2,'GOAL','memory before the claim','USER_STATED',1,0.5,'ACTIVE',NULL)", [memoryExecution.turn, randomUUID()]), 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED', ['42501']);
  await rejected(() => q("SELECT * FROM public.server_create_memory_for_execution_v1($1,$2,'GOAL','memory of no execution','USER_STATED',1,0.5,'ACTIVE',NULL)", [randomUUID(), randomUUID()]), 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED', ['42501']);
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [memoryExecution.id, 'MEMORY_WRITE'])).ok, true);
  const M8 = randomUUID();
  const [created] = await rows("SELECT * FROM public.server_create_memory_for_execution_v1($1,$2,'GOAL','memory written inside its execution','USER_STATED',1,0.5,'ACTIVE',NULL)", [memoryExecution.turn, M8]);
  eq([created.id, created.user_id, created.status, created.version], [M8, owner, 'ACTIVE', 1], 'the same record shape as the 0026 command');
  await newLogicalTransaction();
  eq((await eventsOf('historical_material_events', 'memory_id=$1', [M8])).map((e) => [e.event_kind, e.session_id, e.session_position]), [['CREATED', world.session, 7]], 'anchored through the execution: the caller named no user and no Session');
  return { generated, M8 };
}

// ----------------------------------------- SG. canonical subject grounding (R2)
// The provider proposes opaque handles; the server authorizes them against the
// exact stored universe; the database persists the grounding atomically with
// the Hypothesis it grounds; the A-1 appearance is DERIVED from the grounding
// and the frozen focus -> Thread truth at its own availability. Every fact
// below is written through the production authorities - the FINAL coordinator
// for Moments / focuses / Threads, the durable generation commands for
// Readings and groundings - never by a verifier helper.
const AMBIGUOUS_TEXT = 'هو قال إنه مش هيجي.';
const AMBIGUOUS_REPLY = 'مين تقصد؟';
const SPORT_TEXT = 'الرياضة بقت جزء من يومي.';
const SPORT_REPLY = 'حلو.';
const SPORT_MORE_TEXT = 'الرياضة فعلاً بقت مهمة ليا.';
const SPORT_MORE_REPLY = 'واضح.';
const RETURN_TEXT = 'نرجع لموضوع أحمد.';
const RETURN_REPLY = 'تمام.';
const HANDLE_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
/** ONE user CU with caller-supplied semantics plus ONE assistant ACKNOWLEDGE CU, through the FINAL coordinator. */
async function semanticExchange(owner, world, text, reply, user, assistantLf, assistantLifecycle = (a) => noAction(a)) {
  stage = `${stage.split(' [')[0]} [exchange: ${text}]`;
  const turns = await completedTurns(owner, world.session, text, reply);
  const ids = { u: randomUUID(), a: randomUUID() };
  const token = { ...(await clockOf(world.session)), version: await identityVersionOf(owner) };
  await identity('postgres');
  const [result] = await exchange(world.session, owner, turns.userTurn, randomUUID(),
    [unit(text, text, 1, ids.u)], [user.bundle(ids.u)], [user.thread(ids.u)], [user.lifecycle(ids.u)], [user.lf(ids.u)],
    turns.assistantTurn, randomUUID(),
    [unit(reply, reply, 1, ids.a)],
    [bundle(ids.a, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u, references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.a, 'NO_INDEPENDENT_FOCUS')], [assistantLifecycle(ids.a)], [assistantLf(ids.a)],
    { sp: token.current_sp, seq: Number(token.seq), version: token.version });
  return { turns, ids, liveHead: result.live_head };
}
/** ONE durable generation of `owner` in `session`, up to the CANDIDATE_PROVIDER claim: Intent authorized, universe built by the server. */
async function beginGeneration(owner, session, legacy, { buildUniverse = true } = {}) {
  const execution = { id: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q('SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)', [execution.id, randomUUID(), owner, session, execution.turn, '2.0', 'FAST', 'ALLOW']);
  await identity('service_role');
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [execution.id, 'INTENT_PROVIDER'])).ok, true);
  const intent = { problem: { text: 'What is going on with the people around me?', source: 'CURRENT_USER_TURN', sourceTurnId: execution.turn }, domain: 'GENERAL',
    scope: { kind: 'CONVERSATION_SESSION', sessionId: session, serialized: `CONVERSATION_SESSION:${session}` }, evidenceIds: [`memory:${legacy.M9}`, `memory:${legacy.M10}`] };
  strict((await one('SELECT public.complete_post_response_intent_provider_effect_v1($1,$2,$3) ok', [execution.id, 'INTENT_AUTHORIZED', JSON.stringify(intent)])).ok, true);
  const universe = buildUniverse ? (await one('SELECT public.build_hypothesis_subject_grounding_universe_v1($1) u', [execution.id])).u : undefined;
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [execution.id, 'CANDIDATE_PROVIDER'])).ok, true);
  const handleOf = (subjectText) => {
    const entry = (universe?.entries ?? []).find((candidate) => candidate.subjectText === subjectText);
    if (!entry) throw new Error(`the universe carries no subject ${subjectText}`);
    return entry.handle;
  };
  const candidatesOf = (list) => list.map((candidate) => ({ hypothesisId: candidate.id, statement: candidate.statement, type: 'CAUSAL', domain: 'GENERAL', scope: `CONVERSATION_SESSION:${session}`,
    supportingEvidenceIds: candidate.evidence ?? [`memory:${legacy.M9}`], contradictingEvidenceIds: [], assumptions: [], disconfirmingConditions: [] }));
  const selectionsOf = (list) => list.map((candidate) => ({ hypothesisId: candidate.id, handles: candidate.handles ?? [] }));
  return { id: execution.id, turn: execution.turn, session, universe, handleOf, candidatesOf, selectionsOf };
}
/** The grounded Candidate completion and the ONE atomic persistence of a begun generation. */
async function completeAndPersist(generation, candidates) {
  generation.plan = generation.candidatesOf(candidates);
  generation.selections = generation.selectionsOf(candidates);
  await identity('service_role');
  strict((await one('SELECT public.complete_post_response_grounded_candidates_v1($1,$2,$3::jsonb,$4::jsonb) ok', [generation.id, 'VALIDATED_CANDIDATES', JSON.stringify(generation.plan), JSON.stringify(generation.selections)])).ok, true, 'the grounded Candidate completion');
  strict((await one('SELECT public.claim_post_response_intelligence_effect_v1($1,$2) ok', [generation.id, 'HYPOTHESIS_PERSISTENCE'])).ok, true);
  strict((await one('SELECT public.persist_post_response_hypothesis_generation_v1($1) ok', [generation.id])).ok, true, 'the ONE atomic persistence (Hypotheses + groundings + derived appearances)');
  await newLogicalTransaction();
}
const groundingsOf = (hypothesis) => rows('SELECT grounding_id, emerging_focus_id, session_id, session_position, universe_frontier_sp, same_sp_event_sequence::text seq, world_version::text wv, execution_id FROM public.hypothesis_subject_groundings WHERE hypothesis_id=$1 ORDER BY session_position, grounding_id', [hypothesis]);
const appearancesOf = (hypothesis) => rows('SELECT binding_id, thread_id, bound_sp, bound_event_sequence::text seq, world_version::text wv, unbound_sp FROM public.thread_reading_bindings WHERE hypothesis_id=$1 ORDER BY bound_sp, binding_id', [hypothesis]);
const lifecycleOf = async (thread, session, beforeSp) => (await one('SELECT public.conversation_thread_session_lifecycle_state_v1($1,$2,$3) s', [thread, session, beforeSp])).s;
const homeOf = (thread) => one('SELECT placement_x::text x, placement_y::text y FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]);

async function verifySubjectGrounding(owner, other, legacy) {
  stage = 'SG. R2 canonical Reading subject grounding: server-built universe, opaque handles, server authorization, atomic persistence, derived A-1 appearances (SG-01 .. SG-18, P66-D)';
  // A fresh covered Session of the owner: SP1..SP5, the manager (Thread at SP1)
  // and Ahmed (Thread at SP3), LF = THREAD Ahmed.
  const world = await sessionOne(owner);
  await newLogicalTransaction();
  const S = world.session;

  // --- The universe: server-built from committed B1 / B2 truth, stored once,
  //     presented as opaque handles only (SG-17).
  const g0 = await beginGeneration(owner, S, legacy);
  eq(g0.universe.frontierSp, 5, 'the universe frontier is the Live Head at build time');
  eq(g0.universe.entries.map((entry) => [entry.subjectText, entry.startedSp, entry.lastAttentionSp]), [['المدير', 1, 1], ['أحمد', 3, 5]], 'exactly the committed focuses of the Session, each with its first committed wording and its Session Positions');
  for (const entry of g0.universe.entries) {
    eq(Object.keys(entry).sort(), ['handle', 'lastAttentionSp', 'startedSp', 'subjectText'], 'a provider sees a handle, the wording and Session Positions - never a focus, Thread or Session identity');
    ok(HANDLE_SHAPE.test(entry.handle) && ![world.focuses.manager, world.focuses.ahmed, world.threads.manager, world.threads.ahmed].includes(entry.handle), 'SG-17: the handle is an opaque v5 identity, never the raw focus or Thread UUID');
  }
  strict(g0.handleOf('أحمد'), uuidV5(SUBJECT_GROUNDING_HANDLE_NAMESPACE, `${g0.id}:${world.focuses.ahmed}`), 'a handle re-derives in TypeScript: uuidV5(handle namespace, execution:focus)');
  await identity('postgres');
  const storedUniverse = await one('SELECT user_id, session_id, source_turn_id, frontier_sp, entries FROM public.hypothesis_subject_grounding_universes WHERE execution_id=$1', [g0.id]);
  eq([storedUniverse.user_id, storedUniverse.session_id, storedUniverse.source_turn_id, storedUniverse.frontier_sp], [owner, S, g0.turn, 5], 'the universe is stored per execution with its server-owned provenance');
  const ahmedEntry = storedUniverse.entries.find((entry) => entry.emergingFocusId === world.focuses.ahmed);
  eq([ahmedEntry.groundingHandleId, ahmedEntry.startedCuId, ahmedEntry.threadId, ahmedEntry.threadBoundSp], [world.handles.ahmed, world.ids.u3, world.threads.ahmed, 3], 'each entry carries its committed provenance: the grounding reference handle, the starting CU and the Thread the focus already resolves to');
  await identity('service_role');
  eq((await one('SELECT public.build_hypothesis_subject_grounding_universe_v1($1) u', [g0.id])).u, g0.universe, 'building again returns the SAME universe: the first build is the universe of the execution for good');

  // --- SG-01 / SG-03 / SG-06 / SG-07 / SG-08: one generation, three fates.
  const HA = randomUUID();
  const HM2 = randomUUID();
  const HN = randomUUID();
  await completeAndPersist(g0, [
    { id: HA, statement: 'reading grounded to Ahmed', handles: [g0.handleOf('أحمد')] },
    { id: HM2, statement: 'reading grounded to the manager and to Ahmed', handles: [g0.handleOf('المدير'), g0.handleOf('أحمد')] },
    { id: HN, statement: 'أحمد بيتجنبني عشان الشغل - a statement that names Ahmed, shares his Evidence and is written while Ahmed is the Live Focus, yet grounds nothing', handles: [], evidence: [`memory:${legacy.M9}`] },
  ]);
  const groundingA = await groundingsOf(HA);
  eq(groundingA.map((g) => [g.emerging_focus_id, g.session_id, g.session_position, g.universe_frontier_sp, g.execution_id]), [[world.focuses.ahmed, S, 5, 5, g0.id]], 'SG-01: one canonical grounding, anchored at the execution association (SP5) with the universe frontier it was judged against');
  strict(groundingA[0].grounding_id, uuidV5(SUBJECT_GROUNDING_NAMESPACE, `${HA}:${world.focuses.ahmed}`), 'the grounding identity is derived, never random');
  const appearanceA = await appearancesOf(HA);
  eq(appearanceA.map((b) => [b.thread_id, b.bound_sp, b.seq, b.wv, b.unbound_sp]), [[world.threads.ahmed, 5, groundingA[0].seq, groundingA[0].wv, null]], 'SG-01: the focus already resolves to a Thread -> ONE A-1 appearance, production-authored in the same transaction, at the grounding\'s own anchor');
  strict(appearanceA[0].binding_id, uuidV5(READING_BINDING_NAMESPACE, `${S}:${world.threads.ahmed}:${HA}:5`), 'the appearance identity is the frozen derivation');
  eq((await appearancesOf(HM2)).map((b) => b.thread_id).sort(byText), [world.threads.manager, world.threads.ahmed].sort(byText), 'SG-03: two legitimate grounded focuses -> two appearances of ONE analytical identity');
  strict((await one('SELECT count(*)::int n FROM public.hypotheses WHERE id = ANY($1)', [[HA, HM2, HN]])).n, 3, 'exactly one Hypothesis row each: an appearance never duplicates identity or creates ownership');
  eq(await groundingsOf(HN), [], 'SG-06 / SG-07 / SG-08: shared Evidence, a statement that names the subject and the current LF ground nothing');
  eq(await appearancesOf(HN), [], 'and derive no appearance');
  strict((await one("SELECT count(*)::int n FROM public.historical_evidence_participation_events WHERE hypothesis_id=$1 AND event_kind='ATTACHED'", [HN])).n, 1, 'the ungrounded Reading\'s Evidence participation is recorded as Evidence - a different family, never membership');
  const k5 = await project(owner, S, 5);
  eq(k5.readings.find((r) => r.id === HA).subjectGroundings, [{ emergingFocusId: world.focuses.ahmed, groundedAtSp: 5 }], 'the projection carries the grounding at its own SP');
  eq(k5.readings.find((r) => r.id === HN).subjectGroundings, [], 'and an empty list for the ungrounded Reading');
  eq(k5.thread_reading_appearances.filter((a) => a.hypothesisId === HA).map((a) => [a.threadId, a.boundSp, a.current]), [[world.threads.ahmed, 5, true]]);
  eq(k5.thread_reading_appearances.filter((a) => a.hypothesisId === HN), []);
  eq((await project(owner, S, 4)).thread_reading_appearances, [], 'P66-A for the appearance: unknown before the grounding');

  // --- SG-10: the durable retry persists nothing twice; a repeated grounded
  //     completion of a completed effect is a bounded no-op.
  const countsBefore = { groundings: (await one('SELECT count(*)::int n FROM public.hypothesis_subject_groundings WHERE execution_id=$1', [g0.id])).n, appearances: (await one('SELECT count(*)::int n FROM public.thread_reading_bindings WHERE hypothesis_id = ANY($1)', [[HA, HM2]])).n };
  await identity('service_role');
  strict(typeof (await one('SELECT public.persist_post_response_hypothesis_generation_v1($1) ok', [g0.id])).ok, 'boolean', 'a durable persistence retry is answered by the frozen core');
  strict((await one('SELECT public.complete_post_response_grounded_candidates_v1($1,$2,$3::jsonb,$4::jsonb) ok', [g0.id, 'VALIDATED_CANDIDATES', JSON.stringify(g0.plan), JSON.stringify(g0.selections)])).ok, false, 'a repeated grounded completion of a completed effect changes nothing');
  await newLogicalTransaction();
  eq({ groundings: (await one('SELECT count(*)::int n FROM public.hypothesis_subject_groundings WHERE execution_id=$1', [g0.id])).n, appearances: (await one('SELECT count(*)::int n FROM public.thread_reading_bindings WHERE hypothesis_id = ANY($1)', [[HA, HM2]])).n }, countsBefore, 'SG-10: no duplicate grounding and no duplicate appearance');

  // --- SG-05 / SG-16 / SG-17: the grounded completion refuses every handle the
  //     server did not issue for THIS execution, and every malformed proposal,
  //     rolling the completion back with it.
  const otherWorld = await sessionOne(other);
  await newLogicalTransaction();
  const foreign = await beginGeneration(other, otherWorld.session, legacy);
  const gNeg = await beginGeneration(owner, S, legacy);
  const HX = randomUUID();
  const attempt = (selections, code = 'VALIDATED_CANDIDATES', plan = gNeg.candidatesOf([{ id: HX, statement: 'a candidate under attack' }])) =>
    q('SELECT public.complete_post_response_grounded_candidates_v1($1,$2,$3::jsonb,$4::jsonb)', [gNeg.id, code, plan === null ? null : JSON.stringify(plan), selections === null ? null : JSON.stringify(selections)]);
  await identity('service_role');
  for (const [label, handles, token] of [
    ['SG-05: a handle the server never issued', ['not-a-handle'], 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE'],
    ['SG-17: the raw focus UUID', [world.focuses.ahmed], 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE'],
    ['SG-17: the raw Thread UUID', [world.threads.ahmed], 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE'],
    ['SG-16: a handle of another user\'s universe', [foreign.handleOf('أحمد')], 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE'],
    ['a handle of another execution of the same user', [g0.handleOf('أحمد')], 'SUBJECT_GROUNDING_HANDLE_OUTSIDE_UNIVERSE'],
    ['a duplicate handle', [gNeg.handleOf('أحمد'), gNeg.handleOf('أحمد')], 'SUBJECT_GROUNDING_DUPLICATE_HANDLE'],
    ['more handles than the bound', Array.from({ length: 9 }, () => gNeg.handleOf('أحمد')), 'SUBJECT_GROUNDING_LIMIT_EXCEEDED'],
    ['a non-string handle', [7], 'INVALID_SUBJECT_GROUNDING_PROPOSAL'],
  ]) {
    const error = await rejected(() => attempt([{ hypothesisId: HX, handles }]), token);
    ok(error, label);
  }
  await rejected(() => attempt([{ hypothesisId: randomUUID(), handles: [] }]), 'SUBJECT_GROUNDING_TARGET_NOT_CANDIDATE');
  await rejected(() => attempt([]), 'INVALID_SUBJECT_GROUNDING_PROPOSAL');
  await rejected(() => attempt([{ hypothesisId: HX, handles: [], extra: true }]), 'INVALID_SUBJECT_GROUNDING_PROPOSAL');
  await rejected(() => attempt(null), 'INVALID_SUBJECT_GROUNDING_PROPOSAL');
  await rejected(() => attempt([], 'NO_ACCEPTED_CANDIDATES', null), 'INVALID_SUBJECT_GROUNDING_PROPOSAL');
  await identity('postgres');
  eq(await one("SELECT state, result_code FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key='CANDIDATE_PROVIDER'", [gNeg.id]), { state: 'CLAIMED', result_code: null }, 'a refused proposal never completes the effect: no partial grounding, no silent fallback');
  strict((await one('SELECT count(*)::int n FROM public.hypothesis_subject_grounding_proposals WHERE execution_id=$1', [gNeg.id])).n, 0, 'and stores no proposal');
  await newLogicalTransaction();

  // --- No universe, no grounded result: a generation whose universe the server
  //     never built cannot complete a VALIDATED Candidate result at all - the
  //     frozen completion rolls back with the refusal, so no Hypothesis can ever
  //     be persisted without the universe it was judged against.
  const unbuilt = await beginGeneration(owner, S, legacy, { buildUniverse: false });
  const HU = randomUUID();
  await identity('service_role');
  await rejected(() => q('SELECT public.complete_post_response_grounded_candidates_v1($1,$2,$3::jsonb,$4::jsonb)',
    [unbuilt.id, 'VALIDATED_CANDIDATES', JSON.stringify(unbuilt.candidatesOf([{ id: HU, statement: 'a candidate without a universe' }])), JSON.stringify([{ hypothesisId: HU, handles: [] }])]),
  'SUBJECT_GROUNDING_UNIVERSE_MISSING', ['55000']);
  await identity('postgres');
  eq(await one("SELECT state, result_code FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key='CANDIDATE_PROVIDER'", [unbuilt.id]), { state: 'CLAIMED', result_code: null }, 'the frozen completion is not left behind: the refusal rolled the whole grounded completion back');
  strict((await one('SELECT count(*)::int n FROM public.hypothesis_subject_grounding_universes WHERE execution_id=$1', [unbuilt.id])).n, 0, 'and no universe was fabricated on the way');
  await newLogicalTransaction();

  // --- SG-04: an AMBIGUOUS reference never becomes a focus, so the universe
  //     cannot name it and no definite grounding can ever target it.
  const ambiguousExchange = await semanticExchange(owner, world, AMBIGUOUS_TEXT, AMBIGUOUS_REPLY, {
    bundle: (u) => bundle(u, { sequence_position: 'FOLLOW_UP',
      references: [{ ...anchor(AMBIGUOUS_TEXT, 'هو'), state: 'AMBIGUOUS', resolved_handle_id: null, creates_handle: false, candidate_handle_ids: [world.handles.manager, world.handles.ahmed].sort(byText) }],
      attention: { kind: 'NO_INDEPENDENT_FOCUS', reason: 'UNRESOLVED_ATTENTION', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } }),
    thread: (u) => noEstablishment(u, 'NO_INDEPENDENT_FOCUS'), lifecycle: (u) => noAction(u), lf: (u) => lfSame(u, 'THREAD', world.threads.ahmed),
  }, (a) => lfSame(a, 'THREAD', world.threads.ahmed));
  eq(ambiguousExchange.liveHead, 7, 'the ambiguous exchange committed SP6 and SP7');
  const g4 = await beginGeneration(owner, S, legacy);
  eq(g4.universe.entries.map((entry) => entry.subjectText), ['المدير', 'أحمد'], 'SG-04: the ambiguous "هو" is no focus and therefore no candidate subject - no definite grounding can target it');
  await newLogicalTransaction();

  // --- SG-02 (Case B) + SG-18: a focus grounded while still Emerging; the
  //     appearance is born only when the focus later becomes a Thread, at THAT
  //     Moment; the grounding itself anchors where it became canonical.
  const sport = { handle: randomUUID(), focus: randomUUID() };
  sport.thread = threadIdOf(owner, sport.focus);
  const sportStart = await semanticExchange(owner, world, SPORT_TEXT, SPORT_REPLY, {
    bundle: (u) => bundle(u, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], references: [resolved(SPORT_TEXT, 'الرياضة', sport.handle, true)], attention: startFocus(sport.focus, 0, 'EXPLICIT_FOCUS_SHIFT') }),
    thread: (u) => noEstablishment(u, 'NO_PROMOTION_PATH_PROVEN', sport.focus),
    lifecycle: (u) => noAction(u, sport.focus, [transition(S, u, world.threads.ahmed, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
    lf: (u) => lfChange(S, u, 'EMERGING', sport.focus, 'FOCUS_REPLACEMENT'),
  }, (a) => lfSame(a, 'EMERGING', sport.focus));
  eq(sportStart.liveHead, 9, 'the sport focus started at SP8 and is Emerging');
  strict(await lifecycleOf(world.threads.ahmed, S, 10), 'DORMANT', 'Ahmed went DORMANT at the explicit focus shift');
  const g1 = await beginGeneration(owner, S, legacy);
  eq(g1.universe.entries.map((entry) => [entry.subjectText, entry.startedSp, entry.lastAttentionSp]), [['المدير', 1, 1], ['أحمد', 3, 5], ['الرياضة', 8, 8]], 'an Emerging focus is a legitimate subject: the universe names it before any Thread exists');
  const HS = randomUUID();
  await completeAndPersist(g1, [{ id: HS, statement: 'reading grounded to a focus that is still Emerging', handles: [g1.handleOf('الرياضة')] }]);
  eq((await groundingsOf(HS)).map((g) => [g.emerging_focus_id, g.session_position, g.universe_frontier_sp]), [[sport.focus, 9, 9]], 'SG-18: the grounding is anchored where it actually became canonical (SP9, the Live Head at persistence) - not at the focus start (SP8), not at the causal source turn');
  eq(await appearancesOf(HS), [], 'SG-02: no Thread exists for the focus yet -> no appearance, nothing backdated');
  const k9 = await project(owner, S, 9);
  eq(k9.readings.find((r) => r.id === HS).subjectGroundings, [{ emergingFocusId: sport.focus, groundedAtSp: 9 }], 'the Reading is known at SP9 with its grounding to the Emerging focus');
  eq(k9.thread_reading_appearances.filter((a) => a.hypothesisId === HS), [], 'and without any appearance');
  ok(!idsOf((await project(owner, S, 8)).readings).includes(HS), 'SG-18: a sealed earlier Session Position never learns of a later grounding');
  const promotion = await semanticExchange(owner, world, SPORT_MORE_TEXT, SPORT_MORE_REPLY, {
    bundle: (u) => bundle(u, { functions: ['INFORM_REPORT', 'ELABORATE'], sequence_position: 'FOLLOW_UP', references: [resolved(SPORT_MORE_TEXT, 'الرياضة', sport.handle, false)], attention: attendFocus(sport.focus, 0, 'SUBSTANTIVE_ELABORATION') }),
    thread: (u) => establish(owner, u, sport.focus, 'TE-02', [sportStart.ids.u, u]),
    lifecycle: (u) => establishNew(S, u, sport.focus, sport.thread, [{ cu_id: sportStart.ids.u, reference_index: 0 }, { cu_id: u, reference_index: 0 }]),
    lf: (u) => lfChange(S, u, 'THREAD', sport.thread, 'THREAD_PROMOTION'),
  }, (a) => lfSame(a, 'THREAD', sport.thread));
  eq(promotion.liveHead, 11, 'the sport focus was promoted to a Thread at SP10 (TE-02) through the frozen FINAL chain');
  const appearanceS = await appearancesOf(HS);
  eq(appearanceS.map((b) => [b.thread_id, b.bound_sp, b.seq, b.unbound_sp]), [[sport.thread, 10, '2', null]], 'SG-02: the appearance is born in the establishing transaction, at the focus binding\'s own Session Position and Thread-layer same-SP sequence - production-authored, never a verifier helper');
  strict(appearanceS[0].binding_id, uuidV5(READING_BINDING_NAMESPACE, `${S}:${sport.thread}:${HS}:10`));
  eq((await project(owner, S, 9)).thread_reading_appearances.filter((a) => a.hypothesisId === HS), [], 'SG-12 / P66-D: absent at TC = 9 although the Reading and its grounding are known');
  eq((await project(owner, S, 10)).thread_reading_appearances.filter((a) => a.hypothesisId === HS).map((a) => [a.threadId, a.boundSp, a.current]), [[sport.thread, 10, true]], 'SG-12 / P66-D: present exactly from its own bind SP');
  // A later grounding to the now-established focus appears at once (Case A after Case B), and the universe reports the Thread.
  const g2 = await beginGeneration(owner, S, legacy);
  eq(g2.universe.entries.map((entry) => entry.subjectText), ['المدير', 'أحمد', 'الرياضة']);
  await identity('postgres');
  eq((await one('SELECT entries FROM public.hypothesis_subject_grounding_universes WHERE execution_id=$1', [g2.id])).entries.find((entry) => entry.emergingFocusId === sport.focus).threadId, sport.thread, 'the stored universe now records the Thread the focus resolves to');
  const HS2 = randomUUID();
  await completeAndPersist(g2, [{ id: HS2, statement: 'reading grounded to the sport focus after its promotion', handles: [g2.handleOf('الرياضة')] }]);
  eq((await appearancesOf(HS2)).map((b) => [b.thread_id, b.bound_sp]), [[sport.thread, 11]], 'Case A after Case B: the appearance is born with the grounding, at the grounding\'s anchor');

  // --- SG-13: Dormant / Reopened change no appearance and no Home.
  const homeBefore = await homeOf(world.threads.ahmed);
  const ahmedAppearance = (await appearancesOf(HA))[0];
  const back = await semanticExchange(owner, world, RETURN_TEXT, RETURN_REPLY, {
    bundle: (u) => bundle(u, { functions: ['REQUEST', 'FOCUS_SHIFT'], sequence_position: 'INITIATING', references: [resolved(RETURN_TEXT, 'أحمد', world.handles.ahmed, false)], attention: attendFocus(world.focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
    thread: (u) => noEstablishment(u, 'ALREADY_ESTABLISHED', world.focuses.ahmed),
    lifecycle: (u) => reopenExisting(S, u, world.focuses.ahmed, world.threads.ahmed, [transition(S, u, sport.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
    lf: (u) => lfChange(S, u, 'THREAD', world.threads.ahmed, 'RETURN_TO_THREAD'),
  }, (a) => lfSame(a, 'THREAD', world.threads.ahmed),
  // The assistant's acknowledgement targets the returning CU, which the frozen
  // B3 reducer reads as continued anchoring: REOPENED -> ACTIVE at SP13.
  (a) => noAction(a, null, [transition(S, a, world.threads.ahmed, 'ACTIVE', 'CONTINUED_ANCHORING')]));
  eq(back.liveHead, 13, 'the user returned to Ahmed at SP12');
  strict(await lifecycleOf(world.threads.ahmed, S, 13), 'REOPENED', 'Ahmed was REOPENED by the genuine return at SP12');
  strict(await lifecycleOf(world.threads.ahmed, S, 14), 'ACTIVE', 'and ACTIVE again once the assistant anchored on it at SP13');
  eq((await appearancesOf(HA))[0], ahmedAppearance, 'SG-13: ACTIVE -> DORMANT -> REOPENED -> ACTIVE left the SAME appearance current: dormancy and return are neither unbinding nor rebinding');
  eq(await homeOf(world.threads.ahmed), homeBefore, 'and the SAME permanent Home');
  const k12 = await project(owner, S, 12);
  eq(k12.threads.find((t) => t.id === world.threads.ahmed).sessionLifecycle, 'REOPENED');
  ok(k12.thread_reading_appearances.some((a) => a.hypothesisId === HA && a.threadId === world.threads.ahmed && a.current), 'the reopened Thread still shows its Reading');
  const k13 = await project(owner, S, 13);
  eq(k13.threads.find((t) => t.id === world.threads.ahmed).sessionLifecycle, 'ACTIVE');
  ok(k13.thread_reading_appearances.some((a) => a.hypothesisId === HA && a.threadId === world.threads.ahmed && a.current), 'and so does the re-activated one');
  eq(k13.readings.find((r) => r.id === HM2).subjectGroundings.map((g) => g.emergingFocusId).sort(byText), [world.focuses.manager, world.focuses.ahmed].sort(byText), 'SG-03 on the wire: both groundings of the one Reading');

  // --- SG-14: an Evidence-only update never rebinds or unbinds.
  await identity('service_role');
  await rows("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [owner, HA, `memory:${legacy.M10}`]);
  await newLogicalTransaction();
  eq((await appearancesOf(HA))[0], ahmedAppearance, 'SG-14: an Evidence attach changes no appearance');
  eq((await groundingsOf(HA)).map((g) => g.emerging_focus_id), [world.focuses.ahmed], 'and no grounding');

  // --- SG-15: legacy Hypotheses carry no grounding and no appearance, ever.
  eq(await groundingsOf(legacy.H0), [], 'SG-15: a legacy Hypothesis receives no guessed grounding');
  eq(await appearancesOf(legacy.H0), [], 'and no appearance');
  eq(k13.readings.find((r) => r.id === legacy.H0).subjectGroundings, [], 'the legacy Reading known through the baseline carries no subject grounding in the projection');
  ok(!k13.thread_reading_appearances.some((a) => a.hypothesisId === legacy.H0));

  // --- SG-09: no application role can author a grounding or an appearance.
  for (const role of ['authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => q('SELECT * FROM public.record_thread_reading_appearance_v1($1,$2,$3,$4,13,2,1)', [owner, S, world.threads.ahmed, HN]), 'permission denied', ['42501']);
    await rejected(() => q('SELECT public.persist_authorized_subject_groundings_v1($1)', [g0.id]), 'permission denied', ['42501']);
    await rejected(() => q('SELECT * FROM public.bind_reading_to_thread_v1($1,$2,$3,$4)', [owner, S, world.threads.ahmed, HN]), 'permission denied', ['42501']);
    await rejected(() => q('SELECT * FROM public.unbind_reading_from_thread_v1($1,$2,$3)', [owner, S, ahmedAppearance.binding_id]), 'permission denied', ['42501']);
    for (const table of ['hypothesis_subject_groundings', 'hypothesis_subject_grounding_universes', 'hypothesis_subject_grounding_proposals']) {
      await rejected(() => q(`SELECT * FROM public.${table}`), 'permission denied', ['42501']);
      await rejected(() => q(`DELETE FROM public.${table}`), 'permission denied', ['42501']);
    }
  }
  await identity('authenticated', owner);
  await rejected(() => q('SELECT public.build_hypothesis_subject_grounding_universe_v1($1)', [g0.id]), 'permission denied', ['42501']);
  await rejected(() => q('SELECT public.complete_post_response_grounded_candidates_v1($1,$2,$3::jsonb,$4::jsonb)', [g0.id, 'NO_ACCEPTED_CANDIDATES', null, null]), 'permission denied', ['42501']);
  await identity('postgres');
  await rejected(() => q('UPDATE public.hypothesis_subject_groundings SET emerging_focus_id=$2 WHERE hypothesis_id=$1', [HA, world.focuses.manager]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.hypothesis_subject_groundings WHERE hypothesis_id=$1', [HA]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.hypothesis_subject_grounding_universes SET entries=$2::jsonb WHERE execution_id=$1', [g0.id, '[]']), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.hypothesis_subject_grounding_proposals SET selections=$2::jsonb WHERE execution_id=$1', [g0.id, '[]']), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);

  // --- SG-16 (pairs): a Thread of another user is FORBIDDEN even for the
  //     fixture owner; a durable proposal that names another user's Hypothesis
  //     is refused by the persistence writer.
  await rejected(() => q('SELECT * FROM public.record_thread_reading_appearance_v1($1,$2,$3,$4,13,2,1)', [owner, S, otherWorld.threads.ahmed, HA]), 'FORBIDDEN', ['42501']);
  await q('SAVEPOINT foreign_target');
  await identity('service_role');
  const HO = randomUUID();
  await rows('SELECT * FROM public.server_create_hypothesis_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', [other, HO, 'a reading of the other user', 'CAUSAL', 'GENERAL', 'other scope', 'HUMAN_REVIEWED', [], []]);
  await asReplica(() => q('UPDATE public.hypothesis_subject_grounding_proposals SET selections=$2::jsonb WHERE execution_id=$1', [g0.id, JSON.stringify([{ hypothesisId: HO, handles: [g0.handleOf('أحمد')] }])]));
  await identity('postgres');
  await beginCapture(owner, S, true);
  await rejected(() => q('SELECT public.persist_authorized_subject_groundings_v1($1)', [g0.id]), 'SUBJECT_GROUNDING_TARGET_MISSING', ['55000']);
  await q('ROLLBACK TO SAVEPOINT foreign_target'); await q('RELEASE SAVEPOINT foreign_target');

  // --- SG-11: the same grounding identity with a different semantic payload
  //     fails closed; an identical replay writes nothing.
  await q('SAVEPOINT identity_conflict');
  await asReplica(() => q('UPDATE public.hypothesis_subject_groundings SET source_turn_id=$2 WHERE hypothesis_id=$1', [HA, randomUUID()]));
  await identity('postgres');
  await beginCapture(owner, S, true);
  await rejected(() => q('SELECT public.persist_authorized_subject_groundings_v1($1)', [g0.id]), 'SUBJECT_GROUNDING_IDENTITY_CONFLICT');
  await q('ROLLBACK TO SAVEPOINT identity_conflict'); await q('RELEASE SAVEPOINT identity_conflict');
  await identity('postgres');
  await beginCapture(owner, S, true);
  strict((await one('SELECT public.persist_authorized_subject_groundings_v1($1) n', [g0.id])).n, 0, 'SG-11: an identical replay of the authorized groundings writes nothing');
  await newLogicalTransaction();
  return { session: S, HA, HM2, HN, HS, sport };
}

// ------------------------------------------------- I. R-C2 / R-C3 / identity
async function verifyPreservationAndTracking(owner, other, legacy, worldState, readings) {
  stage = 'I. R-C2 preservation, R-C3 tracked legacy attach paths, identity conflict, spoofing, immutability of history';
  const { world } = worldState;
  await identity('postgres');
  await rejected(() => q('DELETE FROM public.hypotheses WHERE id=$1', [readings.H2]), 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED', ['55000']);
  await rejected(() => q("UPDATE public.hypotheses SET statement='rewritten' WHERE id=$1", [readings.H2]), 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('UPDATE public.hypotheses SET user_id=$2 WHERE id=$1', [readings.H2, other]), 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.memories WHERE id=$1', [legacy.M0]), 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED', ['55000']);
  await rejected(() => q("UPDATE public.memories SET content='rewritten' WHERE id=$1", [legacy.M0]), 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', ['55000']);
  await rejected(() => q("UPDATE public.memories SET source='USER_CONFIRMED' WHERE id=$1", [legacy.M0]), 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.confidence_evaluations WHERE target_id=$1', [readings.H2]), 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED', ['55000']);
  await rejected(() => q("UPDATE public.confidence_evaluations SET target_version=99 WHERE target_id=$1", [readings.H2]), 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE', ['55000']);
  await rejected(() => q('DELETE FROM public.question_candidates WHERE user_id=$1', [owner]), 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED', ['55000']);
  // Allowed lifecycle columns still move (the frozen writers keep working).
  const h0Version = (await one('SELECT version FROM public.hypotheses WHERE id=$1', [legacy.H0])).version;
  await identity('authenticated', owner);
  const [moved] = await rows('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)', [legacy.H0, h0Version, 'SUPPORTED']);
  eq([moved.status, moved.version], ['SUPPORTED', h0Version + 1], 'status / version transitions remain possible');
  await newLogicalTransaction();
  for (const table of HISTORY_TABLES.filter((t) => !['historical_world_semantic_clocks', 'thread_reading_bindings'].includes(t))) {
    const column = table === 'session_historical_coverage' ? "coverage_state='COVERED'" : table === 'session_historical_baselines' ? 'baseline_world_version=0'
      : table === 'hypothesis_subject_grounding_universes' ? "entries='[]'::jsonb" : table === 'hypothesis_subject_grounding_proposals' ? "selections='[]'::jsonb"
      : 'world_version=0';
    await rejected(() => q(`UPDATE public.${table} SET ${column} WHERE user_id=$1`, [owner]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
    await rejected(() => q(`DELETE FROM public.${table} WHERE user_id=$1`, [owner]), 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE', ['55000']);
  }
  await rejected(() => q('UPDATE public.historical_world_semantic_clocks SET current_version = current_version + 2 WHERE user_id=$1', [owner]), 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC', ['55000']);
  await rejected(() => q('UPDATE public.historical_world_semantic_clocks SET current_version = current_version - 1 WHERE user_id=$1', [owner]), 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC', ['55000']);
  await rejected(() => q('DELETE FROM public.historical_world_semantic_clocks WHERE user_id=$1', [owner]), 'WORLD_SEMANTIC_CLOCK_IS_PERMANENT', ['55000']);
  // Z66-05: a missing baseline is technical corruption, never epistemic absence.
  await q('SAVEPOINT corruption');
  await asReplica(() => q('DELETE FROM public.session_historical_baselines WHERE session_id=$1', [world.session]));
  await identity('authenticated', owner);
  await rejected(() => q('SELECT * FROM public.get_session_historical_projection_v1($1,$2)', [world.session, 1]), 'HISTORICAL_BASELINE_MISSING', ['55000']);
  await identity('postgres');
  await q('ROLLBACK TO SAVEPOINT corruption'); await q('RELEASE SAVEPOINT corruption');
  // R-C3: every legacy attach path authors exactly ONE tracked participation and
  // no untracked one; none carries a fabricated Session anchor.
  const participations = (hyp, evidence, role) => rows('SELECT event_kind, session_id, world_version::text wv FROM public.historical_evidence_participation_events WHERE hypothesis_id=$1 AND evidence_id=$2 AND evidence_role=$3 ORDER BY world_version', [hyp, evidence, role]);
  await identity('authenticated', owner);
  const [viaClient] = await rows("SELECT * FROM public.attach_hypothesis_evidence($1,$2,'CONTRADICTING')", [legacy.H0, `memory:${legacy.M9}`]);
  ok(viaClient.contradicting_evidence_ids.includes(`memory:${legacy.M9}`));
  await newLogicalTransaction();
  const clientEvents = await participations(legacy.H0, `memory:${legacy.M9}`, 'CONTRADICTING');
  eq(clientEvents.map((e) => [e.event_kind, e.session_id]), [['ATTACHED', null]], '0005 attach_hypothesis_evidence: exactly one TRACKED participation, unassociated (no server-owned Session)');
  await identity('service_role');
  await rows("SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,'SUPPORTING')", [owner, readings.H2, `memory:${legacy.M9}`]);
  await newLogicalTransaction();
  eq((await participations(readings.H2, `memory:${legacy.M9}`, 'SUPPORTING')).map((e) => [e.event_kind, e.session_id]), [['ATTACHED', null]], '0021 background attach without an execution: one tracked, unassociated participation');
  const versionNow = (await one('SELECT version FROM public.hypotheses WHERE id=$1', [readings.H2])).version;
  await identity('authenticated', owner);
  await rows('SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)', [randomUUID(), readings.H2, versionNow, `memory:${legacy.M10}`, 'SUPPORTING']);
  await newLogicalTransaction();
  eq((await participations(readings.H2, `memory:${legacy.M10}`, 'SUPPORTING')).map((e) => [e.event_kind, e.session_id]), [['ATTACHED', null]], '0008 apply_hypothesis_evidence_update: one tracked, unassociated participation');
  const k7Participations = (await project(owner, world.session, 7)).evidence_participations;
  ok(!k7Participations.some((p) => (p.hypothesisId === legacy.H0 && p.memoryId === legacy.M9) || (p.hypothesisId === readings.H2 && (p.memoryId === legacy.M9 || p.memoryId === legacy.M10))),
    'none of the three unassociated attaches is this Session\'s knowledge: no fabricated anchor');
  // Identity conflict: the same stable identity with a different payload is refused; the same payload is a no-op.
  await identity('postgres');
  const wv = await worldVersionOf(owner);
  await q('SELECT public.record_historical_evidence_participation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [owner, readings.H2, 'memory:00000000-0000-4000-8000-000000000001', 'SUPPORTING', 'ATTACHED', 99, null, null, null, wv]);
  await q('SELECT public.record_historical_evidence_participation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [owner, readings.H2, 'memory:00000000-0000-4000-8000-000000000001', 'SUPPORTING', 'ATTACHED', 99, null, null, null, wv]);
  strict((await one("SELECT count(*)::int n FROM public.historical_evidence_participation_events WHERE evidence_id='memory:00000000-0000-4000-8000-000000000001'")).n, 1, 'an identical retry duplicates nothing');
  await rejected(() => q('SELECT public.record_historical_evidence_participation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [owner, readings.H2, 'memory:00000000-0000-4000-8000-000000000001', 'CONTRADICTING', 'ATTACHED', 99, null, null, null, wv]), 'HISTORICAL_EVENT_IDENTITY_CONFLICT');
  // Spoofing: no application role reaches the boundary or a history table; a
  // Session of another user is refused; no SP, sequence or version can be supplied.
  for (const role of ['authenticated', 'service_role']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => q('SELECT * FROM public.historical_capture_begin_v1($1,$2,true)', [owner, world.session]), 'permission denied', ['42501']);
    await rejected(() => q('INSERT INTO public.historical_reading_events(event_id,user_id,hypothesis_id,event_kind,to_status,to_version,world_version) VALUES($1,$2,$3,$4,$5,1,0)', [randomUUID(), owner, readings.H2, 'CREATED', 'ACTIVE']), 'permission denied', ['42501']);
    await rejected(() => q('SELECT * FROM public.historical_reading_events'), 'permission denied', ['42501']);
  }
  await identity('postgres');
  const foreignSession = await newSession(other);
  const foreignTurns = await completedTurns(other, foreignSession);
  await identity('postgres');
  await legacyCommit(foreignSession, other, foreignTurns.userTurn, randomUUID(), [unit(USER_TEXT, U1)]);
  await newLogicalTransaction();
  await rejected(() => q('SELECT * FROM public.historical_capture_begin_v1($1,$2,true)', [owner, foreignSession]), 'HISTORICAL_CAPTURE_ASSOCIATION_INTEGRITY', ['55000']);
  await rejected(() => q('SELECT * FROM public.historical_capture_begin_v1($1,$2,true)', [owner, randomUUID()]), 'FORBIDDEN', ['42501']);
  await newLogicalTransaction();
}

// -------------------------------------------- I2. Auth smoke teardown parity
// database/verify-supabase-auth.mjs used to remove its two fixture Sessions
// with plain DELETE statements; 0072 attaches a coverage decision to every
// Session behind an ON DELETE RESTRICT FK, so the smoke's teardown now removes
// the fixture's T-03C technical rows first, in the same controlled postgres /
// replica-mode pattern the historical verifiers' fixture cleanup uses. The
// live smoke needs real Supabase credentials; this stage replays the smoke's
// ACTUAL teardown statements (extracted from its source, never retyped)
// against an identical fixture and proves they leave no residue - and that the
// plain Session delete they replace is exactly the RESTRICT regression.
async function verifyAuthSmokeTeardownCompatibility(owner) {
  stage = 'I2. verify:auth:smoke fixture teardown stays compatible with the 0072 coverage decision (replayed from the smoke source)';
  const smoke = await readFile(new URL('./verify-supabase-auth.mjs', import.meta.url), 'utf8');
  const start = smoke.indexOf('async function cleanupRows()');
  const end = smoke.indexOf('\nasync function main()', start);
  ok(start > 0 && end > start, 'the smoke defines cleanupRows() before main()');
  const statements = [...smoke.slice(start, end).matchAll(/database\.query\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`]*)`)/gu)]
    .map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\s+/gu, ' ').trim())
    .filter((sql) => !/^(?:BEGIN|COMMIT|ROLLBACK)$/u.test(sql));
  ok(statements.length >= 7, `the teardown carries its statements (${statements.length})`);
  const at = (pattern) => statements.findIndex((sql) => pattern.test(sql));
  strict(at(/^SET LOCAL session_replication_role = 'replica'$/u), 0, 'the teardown enters replica mode first: triggers and RESTRICT FKs stand aside for the fixture owner only');
  const order = [/DELETE FROM public\.conversation_turns/u, /DELETE FROM public\.session_historical_baselines/u, /DELETE FROM public\.session_historical_coverage/u, /DELETE FROM public\.session_semantic_clocks/u,
    /DELETE FROM public\.conversation_sessions/u, /DELETE FROM public\.users/u, /^SELECT .*AS total$/u].map(at);
  ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), `turns, then the T-03C decisions, the clock, the Sessions, the user, then the residue postcondition (${order.join(',')})`);
  // The smoke's exact fixture shape: the signed-in user's own Session + turn,
  // a cross-user user + Session + turn.
  const own = { session: randomUUID(), turn: randomUUID() };
  const other = { user: randomUUID(), session: randomUUID(), turn: randomUUID() };
  await identity('postgres');
  await q('INSERT INTO public.users (id, auth_subject) VALUES ($1::uuid, $1::text)', [other.user]);
  for (const [session, user] of [[own.session, owner], [other.session, other.user]]) {
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
  }
  for (const [turn, session, user] of [[own.turn, own.session, owner], [other.turn, other.session, other.user]]) {
    await q("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'auth-smoke-fixture')", [turn, session, user]);
  }
  strict((await one('SELECT count(*)::int n FROM public.session_historical_coverage WHERE session_id = ANY($1::uuid[])', [[own.session, other.session]])).n, 2, 'both fixture Sessions received a coverage decision at creation');
  // The regression the review named: the pre-R1 teardown removed the turns and
  // the clocks, then deleted the Sessions directly - which the coverage
  // decision's ON DELETE RESTRICT relationship refuses.
  await rejected(async () => {
    await q('DELETE FROM public.conversation_turns WHERE id = ANY($1::uuid[])', [[own.turn, other.turn]]);
    await q('DELETE FROM public.session_semantic_clocks WHERE session_id = ANY($1::uuid[])', [[own.session, other.session]]);
    await q('DELETE FROM public.conversation_sessions WHERE id = ANY($1::uuid[])', [[own.session, other.session]]);
  }, 'session_historical_coverage', ['23001', '23503']);
  // The corrected teardown, replayed verbatim with the smoke's own parameter shapes.
  const bind = (sql) => {
    if (!sql.includes('$1')) return [];
    if (sql.includes('$3')) return [[own.session, other.session], [own.turn, other.turn], other.user];
    if (/conversation_turns/u.test(sql)) return [[own.turn, other.turn]];
    if (/public\.users/u.test(sql)) return [other.user];
    return [[own.session, other.session]];
  };
  let residue = null;
  for (const sql of statements) {
    const result = await q(sql, bind(sql));
    if (/^SELECT/u.test(sql)) residue = result.rows[0];
  }
  await q("SET LOCAL session_replication_role = 'origin'");
  ok(residue !== null && Number(residue.total) === 0, 'the smoke\'s own residue postcondition reports zero');
  strict(Number((await one(`SELECT (SELECT count(*) FROM public.conversation_sessions WHERE id = ANY($1::uuid[]))
    + (SELECT count(*) FROM public.session_historical_coverage WHERE session_id = ANY($1::uuid[]))
    + (SELECT count(*) FROM public.session_semantic_clocks WHERE session_id = ANY($1::uuid[]))
    + (SELECT count(*) FROM public.conversation_turns WHERE id = ANY($2::uuid[]))
    + (SELECT count(*) FROM public.users WHERE id = $3::uuid) AS total`, [[own.session, other.session], [own.turn, other.turn], other.user])).total), 0,
  'the fixture is gone: Sessions, their coverage decisions, their clocks, the turns and the cross-user user');
  strict((await one('SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id=$1', [owner])).n > 0, true, 'and nothing beyond the fixture was touched');
}

// -------------------------------------------------------- J. sealing / stability
async function verifySealing(owner, worldState, sealedBefore) {
  stage = 'J. P66-F: a sealed TC is stable under every later write; disclosure inputs are typed and family-aware';
  const { world } = worldState;
  const now = await project(owner, world.session, 3);
  // What is sealed is K(TC): every family and every then-current value. The
  // header (live_head, revision) describes the Session now, and a PENDING
  // expiry descriptor may later resolve into the open head - but never into a
  // sealed Session Position, so statusAtTc of a sealed TC never moves.
  const sealedView = ({ revision: _revision, live_head: _liveHead, ...rest }) => ({ ...rest, materials: rest.materials.map(({ expiry: _expiry, ...material }) => material) });
  eq(sealedView(now), sealedView(sealedBefore), 'K(SP3) is identical to its earlier projection despite every later commit, analytical write and expiry');
  eq(Object.keys(now).sort(), ['confidences', 'emerging_focuses', 'evidence_participations', 'gaps', 'live_focus', 'live_head', 'materials', 'moments', 'question_appearances', 'questions', 'reading_relations', 'readings', 'revision', 'sealed', 'session_id', 'thread_reading_appearances', 'threads', 'tc'].sort(byText),
    'the typed family transport is closed: no generic world-truth blob, no score, no label');
  eq(Object.keys(now.revision).sort(), ['liveHead', 'pendingExpiries', 'sameSpEventSequence', 'worldVersion']);
  for (const reading of now.readings) eq(Object.keys(reading).sort(), ['assumptions', 'disconfirmingConditions', 'domain', 'id', 'lineage', 'origin', 'scope', 'statement', 'statusAtTc', 'subjectGroundings', 'type', 'versionAtTc']);
  for (const material of now.materials) eq(Object.keys(material).sort(), ['confidence', 'content', 'expiry', 'id', 'importance', 'source', 'statusAtTc', 'supersededByMemoryId', 'supersedesMemoryId', 'type', 'version']);
  for (const thread of now.threads) eq(Object.keys(thread).sort(), ['establishedInSession', 'establishedSp', 'establishmentPath', 'groundingEmergingFocusId', 'home', 'id', 'sessionLifecycle']);
}

// ------------------------------------------------------------ K. concurrency
async function verifyConcurrency() {
  stage = 'K. P66-E concurrency (real PostgreSQL): associated writes serialize on the Session Semantic Clock, never interleave with a committing exchange';
  const owner = randomUUID();
  const session = randomUUID();
  const turnOne = randomUUID();
  const turnTwo = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const CALL = 'SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)';
  const first = spanOf(USER_TEXT, U1);
  const second = spanOf(USER_TEXT, U2);
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
    for (const [id, source] of [[turnOne, null], [turnTwo, null]]) {
      await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,source_turn_id) VALUES($1,$2,$3,'USER','COMPLETED',$4,$5)", [id, session, owner, USER_TEXT, source]);
    }
    await q(CALL, [session, owner, turnOne, randomUUID(), JSON.stringify([{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }]), ...PROVENANCE]);
    await clientA.connect(); await clientB.connect();
    // An associated analytical write holds the Session clock (AF66-01) ...
    await clientA.query('BEGIN');
    const held = await clientA.query('SELECT session_position, same_sp_event_sequence::text seq FROM public.historical_capture_begin_v1($1,$2,true)', [owner, session]);
    assert.equal(held.rows[0].session_position, 1);
    // ... so a concurrent exchange in the same Session cannot advance the clock
    // underneath it: the anchored SP stays the SP the write observed.
    const pending = clientB.query(CALL, [session, owner, turnTwo, randomUUID(), JSON.stringify([{ unit_id: randomUUID(), span_start: second.start, span_end: second.end }]), ...PROVENANCE]);
    pending.catch(() => undefined);
    const raced = await Promise.race([pending.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750))]);
    assert.equal(raced, 'BLOCKED', 'the concurrent Session commit blocks on the Session Semantic Clock held by the associated write');
    await clientA.query("SELECT * FROM public.server_create_hypothesis_v1($1,$2,'reading written while holding the clock','CAUSAL','GENERAL','scope','HUMAN_REVIEWED','{}','{}')", [owner, randomUUID()]);
    await clientA.query('COMMIT');
    const serialized = await pending;
    assert.equal(serialized.rows[0].session_position, 2, 'the serialized commit took the next Session Position strictly after the write');
    const anchored = await q('SELECT DISTINCT session_position FROM public.historical_reading_events WHERE user_id=$1 AND session_id=$2', [owner, session]);
    assert.deepEqual(anchored.rows.map((r) => r.session_position), [1], 'the associated write is anchored at the SP it observed, never at the SP committed after it');
    // Two associated writes of the same Session serialize on the same clock.
    await clientA.query('BEGIN');
    await clientA.query('SELECT * FROM public.historical_capture_begin_v1($1,$2,true)', [owner, session]);
    const pendingB = clientB.query('BEGIN').then(() => clientB.query('SELECT same_sp_event_sequence::text seq FROM public.historical_capture_begin_v1($1,$2,true)', [owner, session]));
    pendingB.catch(() => undefined);
    const racedB = await Promise.race([pendingB.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750))]);
    assert.equal(racedB, 'BLOCKED', 'a second associated write blocks on the Session clock');
    await clientA.query('COMMIT');
    const laterB = await pendingB;
    await clientB.query('COMMIT');
    assert.ok(Number(laterB.rows[0].seq) >= 2, 'the serialized write took a later same-SP sequence');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
    await q("SET session_replication_role = 'replica'").catch(() => undefined);
    for (const table of ['historical_reading_events', 'historical_evidence_participation_events', 'historical_reading_relation_events', 'historical_material_events', 'historical_gap_events',
      'historical_question_events', 'historical_confidence_events', 'historical_question_appearance_events', 'thread_reading_bindings', 'historical_thread_availability',
      'session_historical_baselines', 'session_historical_coverage', 'historical_world_semantic_clocks', 'hypotheses', 'conversation_unit_commit_events', 'conversation_units',
      'conversation_unit_commit_batches', 'session_semantic_clocks', 'conversation_turns', 'conversation_sessions', 'users']) {
      await q(`DELETE FROM public.${table} WHERE user_id=$1`, [owner]).catch(async () => { await q(`DELETE FROM public.${table} WHERE id=$1`, [owner]).catch(() => undefined); });
    }
    await q('DELETE FROM auth.users WHERE id=$1', [owner]).catch(() => undefined);
    await q("SET session_replication_role = 'origin'").catch(() => undefined);
  }
}

async function main() {
  try {
    await client.connect();
    await verifyDeploymentSpan();
    await q('BEGIN');
    try {
      await identity('postgres');
      await verifyStaticAuthority();
      const owner = randomUUID();
      const other = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
      await verifyCoverage(owner, other);
      const legacy = await legacyWorld(owner);
      const worldState = await verifyBaselineAndFamilies(owner, other, legacy);
      const sealed = await project(owner, worldState.world.session, 3);
      const readings = await verifyAssociatedWrites(owner, legacy, worldState);
      await verifyGapsQuestionsAndAppearance(owner, worldState, readings);
      await verifyExpiry(owner, legacy, worldState);
      await verifyManagedCommands(owner, legacy, worldState);
      await verifySubjectGrounding(owner, other, legacy);
      await verifyPreservationAndTracking(owner, other, legacy, worldState, readings);
      await verifyAuthSmokeTeardownCompatibility(owner);
      await verifySealing(owner, worldState, sealed);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrency();
    console.log(`Verified migration 0072 (${assertions} assertions): every pre-existing Session is a LEGACY UNCOVERED SESSION whose Conversation Runtime continues normally while it can never become partially historical (proven across the deployment boundary on a fresh database, P66-C) and every new Session is COVERED at creation; the baseline is cut at SP(1) for COVERED Sessions only, under the world-clock lock, so world versions <= baseline are known at every TC and later unassociated facts enter only a later Session through its own baseline; the verify:auth:smoke teardown replayed from its source leaves no residue under 0072; the durable execution is the ONE server-owned Session association (the caller supplies no session id, no SP, no sequence, no version), an authenticated / caller-scoped write is captured unassociated, a foreign Session is refused; each exposed family is UNKNOWN before its own anchor and KNOWN from it on with then-current status / version / epoch and known lineage never mistaken for current; a Formal Question appearance anchors at the first committed Moment of its exchange; Thread <-> Reading appearances are clock-first, derived, idempotent and one life per SP; expiry is mapped from the wall clock into SP space (PRE_FIRST_SP / SP(n) half-open with an exact tie EXPIRED / open head / PENDING / NOT_IN_SESSION) and a Material known ACTIVE at TC = n-1 is EXPIRED from TC = n with identity and lineage intact; the three managed commands and the synchronization entry keep their names and grants while their frozen cores are executable by no application role; no canonical row can be deleted or rewritten, no history row updated or deleted, the world clock never regresses; every legacy attach path authors exactly one tracked participation; a sealed TC is byte-stable under every later write while the open head evolves without moving LH; and associated writes serialize on the Session Semantic Clock.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Historical coverage / projection / disclosure verification failed at ${stage} (${code}): ${error?.message ?? error}${error?.detail ? ` [${error.detail}]` : ''}`);
  process.exitCode = 1;
});
