// Real-PostgreSQL verifier for migration 0194 - INTEL-04, the Thread lifecycle derivation correction (QAN-BL-INTEL-04).
//
// The defect: 0070's conversation_thread_cu_relation_v1 counted a binding only when it was made strictly BEFORE the CU
// whose relation is read, so the CU that establishes (or binds) a Thread was "away" from it. Followed directly by a CU
// whose attention is elsewhere, the database derived ACTIVE -> DORMANT (SUSTAINED_DEPARTURE) after ONE departure while
// the application's reducer derived nothing, and the canonical payload was refused (THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL).
//
// Proves against live semantics, through 0070's own B3 coordinator:
//   T1  an establishment followed by ONE away CU derives nothing; the canonical payload commits; the old claim is refused
//   T2  two genuine consecutive departures still make the Thread DORMANT, at the SECOND one, never backdated
//   T3  the call shape: the establishing USER CU, a reply with NO unit (cut before a word was heard), then an away CU
//   T4  the neighbours: EXPLICIT_FOCUS_SHIFT right after an establishment, DORMANT -> REOPENED, REOPENED -> ACTIVE,
//       ACTIVATE_EXISTING_IN_SESSION followed by one away CU (same Thread, same Home, no second placement), two Threads
//       established in consecutive CUs (canonical order, the earlier one alone departs), same-SP sequencing, and the SQL
//       reducer re-deriving every stored row
//   T6  the counter-test, in this transaction: 0070's own relation (read from the 0070 file) is put back, and the T1
//       sequence is refused again while the old non-canonical claim is accepted; 0194's relation is restored, and T1 passes
//   and statically (skipped with INTEL04_BEHAVIOUR_ONLY=1, for running the behaviour alone on a database without 0194):
//   the relation's posture (owner, SECURITY DEFINER, search_path, STABLE, no application role), exactly one predicate
//   changed, the derivation / state / validator unchanged, 0194 the last migration and 0070 never edited.
// Every fixture is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const BEHAVIOUR_ONLY = process.env.INTEL04_BEHAVIOUR_ONLY === '1';
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
const RELATION = 'public.conversation_thread_cu_relation_v1(uuid,uuid)';
const REDUCER = 'public.derive_conversation_thread_lifecycle_transitions_v1(public.conversation_units)';
const STATE = 'public.conversation_thread_session_lifecycle_state_v1(uuid,uuid,integer)';
const VALIDATOR = 'public.validate_conversation_thread_lifecycle_decision_v1(public.conversation_units,jsonb,jsonb)';
const M0070 = 'database/migrations/0070_thread_lifecycle_cross_session_continuity_v1.sql';
const M0194 = '0194_intel_04_lifecycle_relation_at_binding_sp_v1.sql';
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// ---------------------------------------------- canonical identity vectors (verify-migration-0070.mjs's derivations)
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

// --------------------------------------------- B1 / B2 / B3 payload builders (verify-migration-0070.mjs's shapes)
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
const unit = (content, excerpt, id = randomUUID()) => {
  const { start, end } = spanOf(content, excerpt);
  return { unit_id: id, span_start: start, span_end: end };
};
const anchor = (cuText, excerpt) => {
  const { start, end } = spanOf(cuText, excerpt);
  return { anchor_text: excerpt, anchor_occurrence: 1, span_start: start, span_end: end };
};
const resolved = (cuText, excerpt, handle, creates) =>
  ({ ...anchor(cuText, excerpt), state: 'RESOLVED', resolved_handle_id: handle, creates_handle: creates, candidate_handle_ids: [] });
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
const startFocus = (focusId, reason = 'DIRECT_SUBJECT') =>
  ({ kind: 'START_NEW_FOCUS', reason, emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: 0 });
const attendFocus = (focusId, reason = 'DIRECT_SUBJECT') =>
  ({ kind: 'ATTEND_EXISTING_FOCUS', reason, emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: 0 });
const bundle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  functions: overrides.functions ?? ['INFORM_REPORT'],
  sequence_position: overrides.sequence_position ?? 'UNMARKED',
  target_cu_id: overrides.target_cu_id ?? null,
  references: (overrides.references ?? []).map((reference, index) => ({ reference_index: index, ...reference })),
  claim_attributions: [],
  attention: overrides.attention ?? NO_FOCUS,
});
const noEstablishment = (unitId, reason, focusId = null) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: reason,
  emerging_focus_id: focusId, path: null, thread_id: null, home_anchor_id: null,
  thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});
const establish = (userId, unitId, focusId, grounding) => {
  const threadId = threadIdOf(userId, focusId);
  return {
    unit_id: unitId, decision: 'ESTABLISH_THREAD', no_establishment_reason: null, emerging_focus_id: focusId, path: 'TE-01',
    thread_id: threadId, home_anchor_id: uuidV5(HOME_ANCHOR_NAMESPACE, threadId), thread_established_event_id: uuidV5(THREAD_EVENT_NAMESPACE, threadId),
    evidence: [{ evidence_ordinal: 0, cu_id: unitId, evidence_role: 'ESTABLISHING_CU' }],
    explicit_selection_grounding: grounding, origin_state: 'NONE', origin_thread_ids: [],
  };
};
const transition = (session, cuId, threadId, toState, reasonCode) =>
  ({ thread_id: threadId, to_state: toState, reason_code: reasonCode, lifecycle_event_id: eventIdOf(session, cuId, threadId, toState) });
const lifecycle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  outcome: overrides.outcome ?? 'NO_THREAD_ACTION',
  emerging_focus_id: overrides.emerging_focus_id ?? null,
  thread_id: overrides.thread_id ?? null,
  binding_kind: overrides.binding_kind ?? null,
  focus_binding_id: overrides.focus_binding_id ?? null,
  identity_evidence: overrides.identity_evidence ?? [],
  prior_identity_evidence: overrides.prior_identity_evidence ?? [],
  candidate_thread_ids: [],
  lifecycle_transitions: [...(overrides.lifecycle_transitions ?? [])].sort((a, b) => byText(a.thread_id, b.thread_id)),
});
const establishNew = (session, unitId, focusId, threadId, transitions = []) => lifecycle(unitId, {
  outcome: 'ESTABLISH_NEW', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'ESTABLISHMENT',
  focus_binding_id: bindingIdOf(session, focusId, threadId), identity_evidence: [{ cu_id: unitId, reference_index: 0 }], lifecycle_transitions: transitions,
});
const activateExisting = (session, unitId, focusId, threadId, priorEvidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ACTIVATE_EXISTING_IN_SESSION', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'SESSION_CONTINUITY',
  focus_binding_id: bindingIdOf(session, focusId, threadId), identity_evidence: [{ cu_id: unitId, reference_index: 0 }],
  prior_identity_evidence: priorEvidence, lifecycle_transitions: transitions,
});
const attendExisting = (unitId, focusId, threadId, transitions = []) =>
  lifecycle(unitId, { outcome: 'ATTEND_EXISTING', emerging_focus_id: focusId, thread_id: threadId, lifecycle_transitions: transitions });
const reopenExisting = (session, unitId, focusId, threadId, others = []) => lifecycle(unitId, {
  outcome: 'REOPEN_EXISTING', emerging_focus_id: focusId, thread_id: threadId,
  lifecycle_transitions: [transition(session, unitId, threadId, 'REOPENED', 'GENUINE_RETURN'), ...others],
});
const noAction = (unitId, focusId = null, transitions = []) => lifecycle(unitId, { emerging_focus_id: focusId, lifecycle_transitions: transitions });

const exchange = (session, user, turns, user_, assistant_, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_focus_thread_lifecycle_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
    $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)`,
  [session, user, turns.userTurn, user_.batch, JSON.stringify(user_.units), JSON.stringify(user_.bundles), JSON.stringify(user_.threads), JSON.stringify(user_.lifecycles),
    turns.assistantTurn, assistant_.batch, JSON.stringify(assistant_.units), JSON.stringify(assistant_.bundles), JSON.stringify(assistant_.threads), JSON.stringify(assistant_.lifecycles),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, token.sp, token.seq, token.version]);

const versionOf = async (user) =>
  (await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1), 0)::text v', [user]))[0].v;
const tokenOf = async (session, user) => {
  const [clock] = await rows('SELECT current_sp, same_sp_event_sequence FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
  return { sp: clock?.current_sp ?? null, seq: Number(clock?.same_sp_event_sequence ?? 0), version: await versionOf(user) };
};
const lifecycleOf = async (session) =>
  (await rows('SELECT session_position sp, transition_ordinal o, thread_id, from_state, to_state, reason_code, same_sp_event_sequence::text seq FROM public.conversation_thread_lifecycle_events WHERE session_id=$1 ORDER BY session_position, transition_ordinal', [session]))
    .map((e) => [e.sp, e.o, e.thread_id, e.from_state, e.to_state, e.reason_code, e.seq]);
const bindingsOf = async (session) =>
  (await rows('SELECT thread_id, emerging_focus_id, bound_sp, same_sp_event_sequence::text seq, binding_kind FROM public.conversation_thread_focus_bindings WHERE session_id=$1 ORDER BY bound_sp', [session]))
    .map((b) => [b.thread_id, b.emerging_focus_id, b.bound_sp, b.seq, b.binding_kind]);
const relationOf = async (cu, thread) => (await rows('SELECT * FROM public.conversation_thread_cu_relation_v1($1,$2)', [cu, thread]))[0];
const derivedOf = async (cu) => (await rows('SELECT public.derive_conversation_thread_lifecycle_transitions_v1(u) d FROM public.conversation_units u WHERE u.id=$1', [cu]))[0].d;
const stateOf = async (thread, session, before = null) =>
  (await rows('SELECT public.conversation_thread_session_lifecycle_state_v1($1,$2,$3) s', [thread, session, before]))[0].s;
const homeOf = async (thread) =>
  (await rows('SELECT home_anchor_id, placement_x::text x, placement_y::text y, placement_attempt FROM public.conversation_thread_homes WHERE thread_id=$1', [thread]))[0];

async function newPerson() {
  const user = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [user]);
  return user;
}
async function newSession(user) {
  const id = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [id, user]);
  return id;
}
async function completedTurns(user, session, content, reply) {
  await identity('authenticated', user);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, user, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, user, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

/** Every stored lifecycle row of these CUs is exactly what the SQL reducer derives for its CU now. */
async function rederives(cus, label) {
  for (const cu of cus) {
    const stored = await rows('SELECT thread_id, from_state, to_state, reason_code FROM public.conversation_thread_lifecycle_events WHERE cu_id=$1 ORDER BY transition_ordinal', [cu]);
    eq(await derivedOf(cu), stored, `${label}: the SQL reducer re-derives exactly the stored transitions of every CU`);
  }
}

// ---------------------------------------------------------------- the sentences (synthetic, Egyptian Arabic)
const TRAVEL = 'السفر الجاي مقلقني.';
const WORK = 'الشغل كمان كتير.';
const SLEEP = 'والنوم مش مظبوط.';
const OK_REPLY = 'تمام، فاهمك.';

/**
 * One user turn of focus-bearing sentences and a one-CU reply with no focus. `spec[i]` is
 * { text, focus, handle, threads, lifecycles, functions } for the user's CU i. The reply's units can be omitted
 * (the call shape: a reply cut before a word was heard has no unit).
 */
function writtenExchange(content, reply, cuSpecs, { replyUnits = true } = {}) {
  const user_ = { batch: randomUUID(), units: [], bundles: [], threads: [], lifecycles: [] };
  for (const spec of cuSpecs) {
    user_.units.push(unit(content, spec.text, spec.id));
    user_.bundles.push(bundle(spec.id, {
      functions: spec.functions, sequence_position: spec.sequence_position,
      references: [resolved(spec.text, spec.anchor, spec.handle, spec.creates ?? true)],
      attention: spec.attention,
    }));
    user_.threads.push(spec.thread);
    user_.lifecycles.push(spec.lifecycle);
  }
  const replyId = randomUUID();
  const assistant_ = replyUnits
    ? { batch: randomUUID(), id: replyId, units: [unit(reply, reply, replyId)], bundles: [bundle(replyId, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE' })],
      threads: [noEstablishment(replyId, 'NO_INDEPENDENT_FOCUS')], lifecycles: [noAction(replyId)] }
    : { batch: randomUUID(), id: null, units: [], bundles: [], threads: [], lifecycles: [] };
  return { user_, assistant_ };
}
const withLifecycle = (side, index, lifecycles) => ({ ...side, lifecycles: side.lifecycles.map((l, at) => (at === index ? lifecycles : l)) });

// ---------------------------------------------------------------- T1: establishment, then ONE away CU
async function t1EstablishThenOneDeparture() {
  stage = 'T1. an establishment followed by ONE away CU derives nothing';
  const user = await newPerson();
  const session = await newSession(user);
  const content = `${TRAVEL} ${WORK}`;
  const turns = await completedTurns(user, session, content, OK_REPLY);
  const c1 = randomUUID();
  const c2 = randomUUID();
  const travel = { focus: randomUUID(), handle: randomUUID() };
  const work = { focus: randomUUID(), handle: randomUUID() };
  travel.thread = threadIdOf(user, travel.focus);
  const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
    { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
      thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
    { id: c2, text: WORK, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus),
      thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', work.focus), lifecycle: noAction(c2, work.focus) },
  ]);
  const token = await tokenOf(session, user);
  // The defect's derivation is no longer canonical: ONE departure never makes the new Thread DORMANT.
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 1, noAction(c2, work.focus, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  // The reducer's payload (no transition) is the canonical one: it commits.
  const [result] = await exchange(session, user, turns, user_, assistant_, token);
  strict(result.live_head, 3, 'the exchange committed: two user CUs and the reply');
  eq(await lifecycleOf(session), [], 'no lifecycle row: the establishment is the ACTIVE baseline and one departure changes nothing');
  eq(await bindingsOf(session), [[travel.thread, travel.focus, 1, '2', 'ESTABLISHMENT']], 'the one binding, at the establishing CU, seq2');
  const relation = await relationOf(c1, travel.thread);
  eq([relation.attention_on, relation.away, relation.explicit_shift], [true, false, false], 'the establishing CU is ON its own Thread, never away from it');
  const awayCu = await relationOf(c2, travel.thread);
  eq([awayCu.attention_on, awayCu.away], [false, true], 'the next CU, attending another focus, is away');
  strict(await stateOf(travel.thread, session), 'ACTIVE', 'the Thread stays ACTIVE');
  await rederives([c1, c2, assistant_.id], 'T1');
  return { user, session, travel, c1 };
}

// ---------------------------------------------------------------- T2: two genuine departures, then T4 reopen / continue
async function t2TwoDeparturesThenReturn() {
  stage = 'T2. two consecutive departures make the Thread DORMANT at the second; T4 reopen and continue';
  const user = await newPerson();
  const session = await newSession(user);
  const content = `${TRAVEL} ${WORK} ${SLEEP}`;
  const turns = await completedTurns(user, session, content, OK_REPLY);
  const [c1, c2, c3] = [randomUUID(), randomUUID(), randomUUID()];
  const travel = { focus: randomUUID(), handle: randomUUID() };
  const work = { focus: randomUUID(), handle: randomUUID() };
  const sleep = { focus: randomUUID(), handle: randomUUID() };
  travel.thread = threadIdOf(user, travel.focus);
  const departed = transition(session, c3, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE');
  const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
    { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
      thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
    { id: c2, text: WORK, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus),
      thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', work.focus), lifecycle: noAction(c2, work.focus) },
    { id: c3, text: SLEEP, anchor: 'النوم', handle: sleep.handle, attention: startFocus(sleep.focus),
      thread: noEstablishment(c3, 'NO_PROMOTION_PATH_PROVEN', sleep.focus), lifecycle: noAction(c3, sleep.focus, [departed]) },
  ]);
  const token = await tokenOf(session, user);
  await rejected(() => exchange(session, user, turns, withLifecycle(withLifecycle(user_, 1, noAction(c2, work.focus, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), 2, noAction(c3, sleep.focus)), assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 2, noAction(c3, sleep.focus)), assistant_, token), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 2, noAction(c3, sleep.focus, [transition(session, c3, travel.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')])), assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await exchange(session, user, turns, user_, assistant_, token);
  eq(await lifecycleOf(session), [[3, 0, travel.thread, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', '2']],
    'ACTIVE -> DORMANT still happens, at the SECOND consecutive away CU (SP3), never at SP2 and never backdated');
  eq([await stateOf(travel.thread, session, 3), await stateOf(travel.thread, session, 4), await stateOf(travel.thread, session)], ['ACTIVE', 'DORMANT', 'DORMANT']);

  // T4: DORMANT -> REOPENED (GENUINE_RETURN), then REOPENED -> ACTIVE (CONTINUED_ANCHORING).
  const back = 'نرجع للسفر.';
  const more = 'السفر ده مهم ليا.';
  const content2 = `${back} ${more}`;
  const turns2 = await completedTurns(user, session, content2, OK_REPLY);
  const [r1, r2] = [randomUUID(), randomUUID()];
  const second = writtenExchange(content2, OK_REPLY, [
    { id: r1, text: back, anchor: 'للسفر', handle: travel.handle, creates: false, attention: attendFocus(travel.focus, 'EXPLICIT_FOCUS_SHIFT'), functions: ['REQUEST', 'FOCUS_SHIFT'],
      thread: noEstablishment(r1, 'ALREADY_ESTABLISHED', travel.focus), lifecycle: reopenExisting(session, r1, travel.focus, travel.thread) },
    { id: r2, text: more, anchor: 'السفر', handle: travel.handle, creates: false, attention: attendFocus(travel.focus, 'SUBSTANTIVE_ELABORATION'),
      thread: noEstablishment(r2, 'ALREADY_ESTABLISHED', travel.focus), lifecycle: attendExisting(r2, travel.focus, travel.thread, [transition(session, r2, travel.thread, 'ACTIVE', 'CONTINUED_ANCHORING')]) },
  ]);
  await exchange(session, user, turns2, second.user_, second.assistant_, await tokenOf(session, user));
  eq(await lifecycleOf(session), [
    [3, 0, travel.thread, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', '2'],
    [5, 0, travel.thread, 'DORMANT', 'REOPENED', 'GENUINE_RETURN', '2'],
    [6, 0, travel.thread, 'REOPENED', 'ACTIVE', 'CONTINUED_ANCHORING', '2'],
  ], 'DORMANT -> REOPENED on the return, REOPENED -> ACTIVE on the next anchored CU');
  await rederives([c1, c2, c3, assistant_.id, r1, r2, second.assistant_.id], 'T2/T4');
}

// ---------------------------------------------------------------- T4: an explicit shift right after the establishment
async function t4ExplicitShiftAfterEstablishment() {
  stage = 'T4. EXPLICIT_FOCUS_SHIFT right after an establishment is unchanged';
  const user = await newPerson();
  const session = await newSession(user);
  const shift = 'بس خليني أتكلم عن الشغل.';
  const content = `${TRAVEL} ${shift}`;
  const turns = await completedTurns(user, session, content, OK_REPLY);
  const [c1, c2] = [randomUUID(), randomUUID()];
  const travel = { focus: randomUUID(), handle: randomUUID() };
  const work = { focus: randomUUID(), handle: randomUUID() };
  travel.thread = threadIdOf(user, travel.focus);
  const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
    { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
      thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
    { id: c2, text: shift, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus, 'EXPLICIT_FOCUS_SHIFT'), functions: ['REQUEST', 'FOCUS_SHIFT'],
      thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', work.focus),
      lifecycle: noAction(c2, work.focus, [transition(session, c2, travel.thread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]) },
  ]);
  const token = await tokenOf(session, user);
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 1, noAction(c2, work.focus)), assistant_, token), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await exchange(session, user, turns, user_, assistant_, token);
  eq(await lifecycleOf(session), [[2, 0, travel.thread, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT', '2']], 'an explicit shift still makes the Thread DORMANT at once');
  strict((await relationOf(c2, travel.thread)).explicit_shift, true);
  await rederives([c1, c2, assistant_.id], 'T4 explicit shift');
}

// ---------------------------------------------------------------- T4: two Threads established in consecutive CUs
async function t4TwoThreadsInOrder() {
  stage = 'T4. two Threads established in consecutive CUs: canonical order, the earlier one alone departs';
  const user = await newPerson();
  const session = await newSession(user);
  const content = `${TRAVEL} ${WORK} ${SLEEP}`;
  const turns = await completedTurns(user, session, content, OK_REPLY);
  const [c1, c2, c3] = [randomUUID(), randomUUID(), randomUUID()];
  const travel = { focus: randomUUID(), handle: randomUUID() };
  const work = { focus: randomUUID(), handle: randomUUID() };
  const sleep = { focus: randomUUID(), handle: randomUUID() };
  travel.thread = threadIdOf(user, travel.focus);
  work.thread = threadIdOf(user, work.focus);
  const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
    { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
      thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
    // SP2 establishes the second Thread; the first is departed once (by SP2) - nothing.
    { id: c2, text: WORK, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus),
      thread: establish(user, c2, work.focus, anchor(WORK, 'الشغل')), lifecycle: establishNew(session, c2, work.focus, work.thread) },
    // SP3: away from both. The first was departed by SP2 and SP3 -> DORMANT; the second was ESTABLISHED by SP2 -> nothing.
    { id: c3, text: SLEEP, anchor: 'النوم', handle: sleep.handle, attention: startFocus(sleep.focus),
      thread: noEstablishment(c3, 'NO_PROMOTION_PATH_PROVEN', sleep.focus),
      lifecycle: noAction(c3, sleep.focus, [transition(session, c3, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')]) },
  ]);
  const token = await tokenOf(session, user);
  const both = [transition(session, c3, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE'), transition(session, c3, work.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')];
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 2, noAction(c3, sleep.focus, both)), assistant_, token), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 1, establishNew(session, c2, work.focus, work.thread, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await exchange(session, user, turns, user_, assistant_, token);
  eq(await lifecycleOf(session), [[3, 0, travel.thread, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', '2']]);
  eq(await bindingsOf(session), [[travel.thread, travel.focus, 1, '2', 'ESTABLISHMENT'], [work.thread, work.focus, 2, '2', 'ESTABLISHMENT']],
    'one binding per Thread, each at its own establishing CU, seq2');
  const threads = await rows('SELECT id, established_sp FROM public.conversation_threads WHERE user_id=$1 ORDER BY id::text COLLATE "C"', [user]);
  eq(threads.map((t) => t.id), [travel.thread, work.thread].sort(byText), 'exactly the two Threads, in canonical textual order');
  const homes = await rows('SELECT placement_x::text x, placement_y::text y FROM public.conversation_thread_homes WHERE user_id=$1', [user]);
  strict(homes.length, 2, 'two Homes');
  strict(new Set(homes.map((h) => `${h.x},${h.y}`)).size, 2, 'no two Threads share a position');
  await rederives([c1, c2, c3, assistant_.id], 'T4 two Threads');
}

// ---------------------------------------------------------------- T4: ACTIVATE_EXISTING_IN_SESSION then ONE away CU
async function t4ActivateExistingThenOneDeparture(world) {
  stage = 'T4. a Session-continuity binding followed by ONE away CU derives nothing';
  const { user, travel, c1: priorCu } = world;
  const homeBefore = await homeOf(travel.thread);
  const versionBefore = await versionOf(user);
  const session = await newSession(user);
  const again = 'السفر تاني شاغلني.';
  const food = 'والأكل كمان مش مظبوط.';
  const content = `${again} ${food}`;
  const turns = await completedTurns(user, session, content, OK_REPLY);
  const [c1, c2] = [randomUUID(), randomUUID()];
  const travel2 = { focus: randomUUID(), handle: randomUUID() };
  const meal = { focus: randomUUID(), handle: randomUUID() };
  const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
    { id: c1, text: again, anchor: 'السفر', handle: travel2.handle, attention: startFocus(travel2.focus), sequence_position: 'INITIATING',
      thread: noEstablishment(c1, 'NO_PROMOTION_PATH_PROVEN', travel2.focus),
      lifecycle: activateExisting(session, c1, travel2.focus, travel.thread, [{ cu_id: priorCu, exact_surface: 'السفر' }]) },
    { id: c2, text: food, anchor: 'الأكل', handle: meal.handle, attention: startFocus(meal.focus),
      thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', meal.focus), lifecycle: noAction(c2, meal.focus) },
  ]);
  const token = await tokenOf(session, user);
  await rejected(() => exchange(session, user, turns, withLifecycle(user_, 1, noAction(c2, meal.focus, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  const [result] = await exchange(session, user, turns, user_, assistant_, token);
  strict(String(result.world_thread_identity_version), String(Number(versionBefore) + 1), 'the continuity binding advanced the identity version once');
  eq(await bindingsOf(session), [[travel.thread, travel2.focus, 1, '2', 'SESSION_CONTINUITY']], 'the SAME Thread is bound to this Session\'s focus');
  eq(await lifecycleOf(session), [], 'the continuity baseline is ACTIVE and one departure changes nothing');
  eq((await relationOf(c1, travel.thread)).attention_on, true, 'the CU binding an existing Thread is on it');
  eq(await homeOf(travel.thread), homeBefore, 'the same permanent Home: no second placement');
  strict((await rows('SELECT count(*)::int n FROM public.conversation_threads WHERE user_id=$1', [user]))[0].n, 1, 'no second Thread');
  eq([await stateOf(travel.thread, session), await stateOf(travel.thread, world.session)], ['ACTIVE', 'ACTIVE'], 'each Session keeps its own state');
  await rederives([c1, c2, assistant_.id], 'T4 continuity');
}

// ---------------------------------------------------------------- T3: the call shape (a reply with no unit)
async function t3CallShape() {
  stage = 'T3. the call shape: establishing USER CU, a reply with NO unit, then ONE away CU in the next exchange';
  const user = await newPerson();
  const session = await newSession(user);
  // Exchange 1: the reply was cut before a word was heard, so it committed no unit (its turn holds what was heard: nothing).
  const turns1 = await completedTurns(user, session, TRAVEL, OK_REPLY);
  const c1 = randomUUID();
  const travel = { focus: randomUUID(), handle: randomUUID() };
  const work = { focus: randomUUID(), handle: randomUUID() };
  travel.thread = threadIdOf(user, travel.focus);
  const first = writtenExchange(TRAVEL, OK_REPLY, [
    { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
      thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
  ], { replyUnits: false });
  await exchange(session, user, turns1, first.user_, first.assistant_, await tokenOf(session, user));
  strict((await tokenOf(session, user)).sp, 1, 'exchange 1 committed exactly the one USER CU (the reply has none)');
  // Exchange 2: the next USER CU starts another focus; its previous committed CU is the establishing one.
  const turns2 = await completedTurns(user, session, WORK, OK_REPLY);
  const c2 = randomUUID();
  const second = writtenExchange(WORK, OK_REPLY, [
    { id: c2, text: WORK, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus), sequence_position: 'INITIATING',
      thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', work.focus), lifecycle: noAction(c2, work.focus) },
  ]);
  const token = await tokenOf(session, user);
  await rejected(() => exchange(session, user, turns2, withLifecycle(second.user_, 0, noAction(c2, work.focus, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), second.assistant_, token),
    'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
  await exchange(session, user, turns2, second.user_, second.assistant_, token);
  eq(await lifecycleOf(session), [], 'one departure after the establishment, across two exchanges: nothing');
  strict(await stateOf(travel.thread, session), 'ACTIVE');
  await rederives([c1, c2, second.assistant_.id], 'T3');
}

// ---------------------------------------------------------------- T6: the counter-test, in this transaction
/** 0070's own relation, read from the 0070 file (never retyped), as a CREATE OR REPLACE. */
function relation0070() {
  const text = readFileSync(M0070, 'utf8');
  const start = text.indexOf('CREATE FUNCTION public.conversation_thread_cu_relation_v1(');
  const end = text.indexOf('END;$$;', start) + 'END;$$;'.length;
  assert.ok(start > 0 && end > start, 'the 0070 relation is found in the 0070 file');
  return text.slice(start, end).replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
}
async function t6CounterTest() {
  stage = 'T6. the counter-test: 0070\'s relation restored, T1 is refused again; 0194\'s relation restored, T1 passes';
  const before = (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) d', [RELATION]))[0].d;
  await q('SAVEPOINT counter');
  try {
    await q(relation0070());
    ok((await rows('SELECT pg_get_functiondef(to_regprocedure($1)) d', [RELATION]))[0].d.includes('b.bound_sp < cu.session_position);\n  targets_thread'),
      'the defective relation is in place for the counter-test');
    const user = await newPerson();
    const session = await newSession(user);
    const content = `${TRAVEL} ${WORK}`;
    const turns = await completedTurns(user, session, content, OK_REPLY);
    const [c1, c2] = [randomUUID(), randomUUID()];
    const travel = { focus: randomUUID(), handle: randomUUID() };
    const work = { focus: randomUUID(), handle: randomUUID() };
    travel.thread = threadIdOf(user, travel.focus);
    const { user_, assistant_ } = writtenExchange(content, OK_REPLY, [
      { id: c1, text: TRAVEL, anchor: 'السفر', handle: travel.handle, attention: startFocus(travel.focus), sequence_position: 'INITIATING',
        thread: establish(user, c1, travel.focus, anchor(TRAVEL, 'السفر')), lifecycle: establishNew(session, c1, travel.focus, travel.thread) },
      { id: c2, text: WORK, anchor: 'الشغل', handle: work.handle, attention: startFocus(work.focus),
        thread: noEstablishment(c2, 'NO_PROMOTION_PATH_PROVEN', work.focus), lifecycle: noAction(c2, work.focus) },
    ]);
    const token = await tokenOf(session, user);
    // With the defect, the reducer's (canonical) payload is refused - the INTEL-04 stall - ...
    await rejected(() => exchange(session, user, turns, user_, assistant_, token), 'THREAD_LIFECYCLE_TRANSITIONS_NOT_CANONICAL');
    // ... and the database's own derivation is SUSTAINED_DEPARTURE after ONE departure.
    await exchange(session, user, turns, withLifecycle(user_, 1, noAction(c2, work.focus, [transition(session, c2, travel.thread, 'DORMANT', 'SUSTAINED_DEPARTURE')])), assistant_, token);
    eq(await lifecycleOf(session), [[2, 0, travel.thread, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', '2']], 'the defective derivation, observed');
    eq([(await relationOf(c1, travel.thread)).attention_on, (await relationOf(c1, travel.thread)).away], [false, true], 'the defect: the establishing CU is "away" from its own Thread');
  } finally {
    await q('ROLLBACK TO SAVEPOINT counter');
    await q('RELEASE SAVEPOINT counter');
  }
  strict((await rows('SELECT pg_get_functiondef(to_regprocedure($1)) d', [RELATION]))[0].d, before, 'the corrected relation is back, byte-identical');
  await t1EstablishThenOneDeparture();
}

// ---------------------------------------------------------------- static
async function verifyStatic() {
  stage = 'S. the relation\'s posture, the one changed predicate, everything else unchanged';
  const [contract] = await rows('SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.provolatile volatility FROM pg_proc p WHERE p.oid = to_regprocedure($1)', [RELATION]);
  eq([contract.owner, contract.definer, contract.config, contract.volatility], ['postgres', true, ['search_path=""'], 's'], 'postgres-owned, SECURITY DEFINER, empty search_path, STABLE');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [RELATION, REDUCER, STATE, VALIDATOR]) {
      const [{ granted }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') granted", [role, signature]);
      strict(granted, false, `${role} does not execute ${signature}`);
    }
  }
  const bodyOf = async (signature) => (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) d', [signature]))[0].d;
  const relation = await bodyOf(RELATION);
  const relation70 = relation0070();
  const core = (text) => text.slice(text.indexOf('DECLARE'), text.lastIndexOf('END;')).replace(/^\s*-- INTEL-04.*\n/mu, '').replace(/\s+/gu, ' ').trim();
  strict(core(relation), core(relation70).replace('AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp < cu.session_position',
    'AND b.emerging_focus_id = att.emerging_focus_id AND b.bound_sp <= cu.session_position'),
  'the deployed relation is 0070\'s, with exactly ONE predicate changed (attention_on: < becomes <=)');
  ok(relation.includes('AND b.thread_id = p_thread_id AND b.bound_sp < cu.session_position'), 'targets_thread keeps its strict reading');
  const reducer = await bodyOf(REDUCER);
  strict((reducer.match(/b\.bound_sp < p_cu\.session_position/gu) ?? []).length, 2, 'the derivation keeps own_thread and its loop strictly before the current CU');
  ok(!/bound_sp <=/u.test(reducer), 'the derivation itself is not changed');
  ok((await bodyOf(STATE)).includes('b.bound_sp < p_before_sp'), 'the then-valid state still reads strictly before');
  ok((await bodyOf(VALIDATOR)).includes('bound.bound_sp >= p_cu.session_position'), 'the validator still refuses a binding at or after the current CU');
  const migrations = readdirSync('database/migrations').filter((name) => name.endsWith('.sql')).sort();
  // RE-ANCHORED by S8B-07 CP1-A (was: 0194 is the last migration; the Product Owner's CP1-A authorization, a declared
  // re-anchor): exactly 0195, the original-audio source truth, follows 0194 and nothing else does (verify-migration-0195).
  // RE-ANCHORED by S8B-07 CP1-B (was: 0195 is the last migration; the Product Owner's CP1-B execution authorization, a
  // declared re-anchor): exactly 0196, the transient media authority, follows 0195 and nothing else does (verify-migration-0196).
  strict(migrations.at(-3), M0194, '0194 is followed only by 0195');
  strict(migrations.at(-2), '0195_s8b_07_replay_original_audio_source_truth_v1.sql', 'exactly 0195 follows 0194');
  strict(migrations.at(-1), '0196_s8b_07_transient_media_v1.sql', 'exactly 0196 follows 0195');
  const m0194 = readFileSync(`database/migrations/${M0194}`, 'utf8');
  const executable = m0194.replace(/^\s*--.*$/gmu, '');
  ok(!/GRANT /u.test(executable), '0194 grants nothing');
  ok(!/INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE|call_analysis_queue/u.test(executable.replace(/\$\$[\s\S]*?\$\$/gu, '')), '0194 writes, rewrites or backfills nothing and touches no queue');
  strict((executable.match(/CREATE OR REPLACE FUNCTION/gu) ?? []).length, 1, '0194 replaces exactly one function');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    try {
      await identity('postgres');
      const world = await t1EstablishThenOneDeparture();
      await t2TwoDeparturesThenReturn();
      await t3CallShape();
      await t4ExplicitShiftAfterEstablishment();
      await t4TwoThreadsInOrder();
      await t4ActivateExistingThenOneDeparture(world);
      await t6CounterTest();
      if (!BEHAVIOUR_ONLY) await verifyStatic();
    } finally { await q('ROLLBACK'); }
    console.log(`Verified migration 0194 (${assertions} assertions${BEHAVIOUR_ONLY ? ', behaviour only' : ''}): the CU that establishes or binds a Thread is ON it (INTEL-04); an establishment followed by ONE away CU derives nothing and the reducer's payload commits, written and in the call shape (a reply with no unit); two consecutive departures still make the Thread DORMANT at the second; EXPLICIT_FOCUS_SHIFT, DORMANT -> REOPENED, REOPENED -> ACTIVE and ACTIVATE_EXISTING_IN_SESSION are unchanged; two Threads keep their order, bindings, Homes and positions; the SQL reducer re-derives every stored row; the counter-test with 0070's own relation reproduces the refusal and 0194 removes it; exactly one predicate changed, nothing granted, written or backfilled.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`INTEL-04 (0194) verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
