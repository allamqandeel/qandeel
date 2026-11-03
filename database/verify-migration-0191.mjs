// Real-PostgreSQL verifier for migration 0191 (S8B-05 CP3: Ordered Half-Exchange Establishment, the durable ordered
// analysis worker's authority, the shared session lock, the shared background provider permits and the call's end closing
// its last exchange; Integrated Live Call Contract v1.2 FINAL). No provider is called; every scenario but TRC runs in one
// transaction that is rolled back.
//
//   T0   catalogue: the three new relations (RLS, no policy, no grant, ACCOUNT_CASCADE), the queue's new shape; every new
//        definer service_role only, every internal no role's; every forward-replaced function its origin statement plus
//        exactly the declared edits, in 0191 and live; the conversation commit family commits through exactly the full and
//        the half coordinator; every end path goes through end_call_v1; four scopes DISABLED; the census clean
//   T1   the USER half while its turn is GENERATING: committed through the 0071 writer, the item COMPLETE in the same
//        transaction; a replay answers from storage with no token check and no second batch
//   T2   O1: a reply's half never before its USER half (retryable, nothing written); then in order
//   T3   O2: the next USER half never before the whole previous exchange; then in order
//   T4   an empty reply (nothing heard): a zero-unit batch; the ASSISTANT half after a GENERATION_FAILED close
//   T5   stale tokens: the Session clock or the identity clock moved: PT409, nothing written, the item still open
//   T6   O3a: the full coordinator refuses every numbered call turn; a text exchange is unchanged
//   T7   O3b / B1: the unestablished pre-call exchanges after the last established one take the head, in order; the call's
//        USER half waits for them; the worker establishes them through the full coordinator and settles them COMPLETE
//   T7b  O3b as amended by DEC-R1-1: the activation adopts once (a retried activation adopts nothing); an exchange completing
//        between the activation and the first turn is adopted by the first turn after the activation's items; an adoption
//        that does not fit below 1 adopts nothing
//   T8   the worker's claim: one claim per session (WAITING for another live claim), an expired lease re-claimed (a crashed
//        worker), NOT_HOLDER for a stale holder; crash before the commit (nothing written) and after it (ALREADY_SETTLED,
//        REPLAYED, zero providers)
//   T9   L5 / B3: provider failures back off 2 s, 4 s, then PARKED, never skipped (the next item is not claimable); RELEASE
//        refunds the attempt; an integrity failure confirmed once is ABANDONED_INTEGRITY and takes its reply's half with
//        it; the abandoned item is never established later; the daily budget PARKS until the next UTC day
//   T10  the shared session lock: a post-response execution BUSY while an analysis item is held, its reservation honoured
//        by the next claim; NOT_REQUIRED for a text-only session; the next spoken turn never waits for it
//   T11  the permits: per person, the adaptive cap under live generations, a renewal for the same holder, a lapsed lease
//        freeing its slot; L2: WAIT_CRITICAL_WINDOW only while the reply has nothing heard or registered; T11b the cap is a
//        count of the permits held, so a cap shrunk under held permits admits nothing through a freed low slot
//   T12  the call's end, every path: explicit end, the sweep and a new call's recovery close the open exchange with stored
//        Safety once (CALL_ENDING, the ASSISTANT half queued, one ConversationTurnCompleted); with no Safety stored it stays
//        OPEN, cannot be closed, is listed for S3, read with the same reader, then stored once and closed; never on a live call
//   T13  account erasure removes every new row
//   TRC  races on two connections: two workers claim one session, the half commit vs the next spoken turn, the call's end
//        vs the next turn, the call's end vs the natural close, two instances acquiring the last permit
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';
import { VOICE_CONSENT_V3 } from './qandeel-voice-0188-anchor.mjs';
import { MIGRATION_0191, SUBSTITUTIONS, substitutedStatement, voiceInternals0191 } from './live-call-0191-substitutions.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const rejected = (operation, codes, message) => rt.rejected(operation, codes, message);

const NEW_PRIVATE = ['voice_private.session_semantic_leases', 'voice_private.call_analysis_attempt_days', 'voice_private.background_provider_permits'];
const HALF = 'public.commit_conversation_units_call_half_v1(uuid,uuid,uuid,integer,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)';
const DEFINERS = [
  HALF,
  'public.server_acquire_background_permit_v1(uuid,text,uuid,boolean)',
  'public.server_release_background_permit_v1(uuid)',
  'public.server_claim_call_analysis_item_v1(uuid,uuid)',
  'public.server_settle_call_analysis_item_v1(uuid,uuid,integer,text,uuid,text,text)',
  'public.server_list_call_analysis_sessions_v1(integer)',
  'public.server_read_call_analysis_turns_v1(uuid,uuid,uuid[])',
  'public.server_acquire_session_semantic_lease_v1(uuid,uuid,uuid)',
  'public.server_release_session_semantic_lease_v1(uuid,uuid)',
  'public.server_list_unsettled_call_exchanges_v1(integer)',
  'public.server_read_call_context_v1(uuid,uuid,uuid,integer)',
  'public.server_close_ended_call_exchange_v1(uuid,uuid,integer,uuid,uuid)',
];
const INTERNAL = voiceInternals0191();
const LIVE = 'PERSONAL_LIVE_CALL';
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';

// ------------------------------------------------------------------ helpers
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
async function asOwner(user, sql, values = []) {
  await asRole('authenticated', user);
  const result = await rows(sql, values);
  await owner();
  return result;
}
async function human() {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  return id;
}
async function newSession(user) {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
async function setGate(scope = LIVE, flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  await rows("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'verify-0191', 'real-PostgreSQL proof')",
    [scope, flag, requirements]);
}
async function setCapacity(capacity) {
  await owner();
  await rows(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'verify-0191', 'real-PostgreSQL proof') FROM voice_private.live_call_policy p`, [capacity]);
}
async function setPermits(total, minimum, weight, perUser, lease = 120) {
  await owner();
  await rows("SELECT voice_private.set_background_permit_policy_v1($1, $2, $3, $4, $5, 'verify-0191', 'real-PostgreSQL proof')",
    [total, minimum, weight, perUser, lease]);
}
const grant = async (user) =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), VOICE_CONSENT_V3])).outcome;
/** A call begun and activated (optionally in an existing session of the person). */
async function activeCall(existing = null) {
  const user = existing?.user ?? await human();
  const session = existing?.session ?? await newSession(user);
  await setGate();
  if (!existing) assert.equal(await grant(user), 'GRANTED');
  const client = randomUUID();
  const call = randomUUID();
  assert.equal((await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, client])).outcome, 'BEGUN');
  const a = await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [user, call]);
  assert.equal(a.outcome, 'ACTIVE');
  return { user, session, client, call, recording: a.recording_id, epoch: 1, next: { USER: 0, QANDEEL: 0 }, end: { USER: 0, QANDEEL: 0 } };
}
async function audio(x, track, endMs) {
  const r = await one('SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)',
    [x.user, x.recording, x.epoch, track, x.next[track], x.end[track], endMs]);
  assert.equal(r.outcome, 'ADDED', `${track} ${x.end[track]}-${endMs}`);
  x.next[track] += 1;
  x.end[track] = endMs;
}
const COMMIT_SQL = 'SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)';
const commitArgs = (x, o = {}) => [x.user, x.call, x.epoch, o.turn ?? randomUUID(), o.commit ?? randomUUID(), 'SPEECH',
  o.content ?? 'أنا بخير والحمد لله', o.band ?? 'HIGH', o.start ?? 0, o.end ?? x.end.USER, [], randomUUID(), randomUUID()];
const safety = async (x, idx, disposition = 'ALLOW') =>
  (await one('SELECT * FROM public.server_store_call_turn_safety_v1($1, $2, $3, $4)', [x.user, x.call, idx, disposition])).outcome;
const segment = async (x, idx, seq, text, start, endMs) =>
  (await one('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [x.user, x.call, x.epoch, idx, seq, text, start, endMs, []])).outcome;
const finish = async (x, idx, state, produced) =>
  (await one('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, x.epoch, idx, state, produced])).outcome;
const close = (x, idx, reason) =>
  one('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, $3, $4, $5, $6, $7)', [x.user, x.call, x.epoch, idx, reason, randomUUID(), randomUUID()]);
const endCall = async (x, reason = 'USER_ENDED') => (await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, reason])).outcome;
const exchange = async (x, idx) => (await rows('SELECT * FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = $2', [x.call, idx]))[0];
const queueOf = async (session) => rows(`SELECT q.call_turn_index AS idx, q.half, q.queue_state AS state, q.turn_id, q.assistant_turn_id,
    q.attempt_count AS attempts, q.integrity_failures, q.last_failure FROM voice_private.call_analysis_queue q JOIN voice_private.calls c ON c.id = q.call_id
    WHERE q.session_id = $1 ORDER BY c.created_at, c.id, q.call_turn_index, CASE q.half WHEN 'EXCHANGE' THEN 0 WHEN 'USER' THEN 1 ELSE 2 END`, [session]);
const item = async (x, idx, half) => (await rows('SELECT * FROM voice_private.call_analysis_queue WHERE call_id = $1 AND call_turn_index = $2 AND half = $3', [x.call, idx, half]))[0];
/** A spoken turn committed with Safety stored. */
async function spokenTurn(x, o = {}) {
  await audio(x, 'USER', x.end.USER + 1000);
  const r = await one(COMMIT_SQL, commitArgs(x, { ...o, start: x.end.USER - 1000 }));
  assert.equal(r.outcome, 'COMMITTED');
  if (o.safety !== null) assert.equal(await safety(x, r.call_turn_index, o.safety ?? 'ALLOW'), 'STORED');
  return { idx: r.call_turn_index, turn: r.turn_id, content: o.content ?? 'أنا بخير والحمد لله' };
}
/** The reply of exchange `idx`, produced in full and heard in full, closed PLAYED_OUT: returns the reply turn. */
async function playedReply(x, idx, text = 'تمام، احكيلي أكتر.') {
  assert.equal(await segment(x, idx, 0, text, 0, 400), 'REGISTERED');
  assert.equal(await finish(x, idx, 'COMPLETE', 400), 'FINISHED');
  const start = x.end.QANDEEL;
  const p = await one('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, x.epoch, idx, 400, start]);
  assert.equal(p.outcome, 'ADVANCED');
  await audio(x, 'QANDEEL', start + 400);
  const c = await close(x, idx, 'PLAYED_OUT');
  assert.equal(c.outcome, 'CLOSED');
  return c.assistant_turn_id;
}
const points = (value) => Array.from(value);
const clockOf = async (session) =>
  (await rows('SELECT current_sp AS sp, same_sp_event_sequence::text AS seq FROM public.session_semantic_clocks WHERE session_id = $1', [session]))[0];
const versionOf = async (user) =>
  (await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id = $1), 0)::text AS v', [user]))[0].v;
const tokenOf = async (x) => ({ ...(await clockOf(x.session)), version: await versionOf(x.user) });
/** One whole-content CU (or none) with no focus, no Thread, no lifecycle action and an unchanged NONE Live Focus. */
function payload(content) {
  if (!content) return { units: [], bundles: [], threads: [], lifecycles: [], live: [] };
  const id = randomUUID();
  return {
    units: [{ unit_id: id, span_start: 0, span_end: points(content).length }],
    bundles: [{ unit_id: id, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, references: [], claim_attributions: [],
      attention: { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } }],
    threads: [{ unit_id: id, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_INDEPENDENT_FOCUS', emerging_focus_id: null, path: null,
      thread_id: null, home_anchor_id: null, thread_established_event_id: null, evidence: [], explicit_selection_grounding: null, origin_state: 'NONE', origin_thread_ids: [] }],
    lifecycles: [{ unit_id: id, outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null, binding_kind: null, focus_binding_id: null,
      identity_evidence: [], prior_identity_evidence: [], candidate_thread_ids: [], lifecycle_transitions: [] }],
    live: [{ unit_id: id, effective_kind: 'NONE', effective_ref: null, transition: false, reason_code: null, transition_event_id: null }],
  };
}
const HALF_SQL = `SELECT * FROM public.commit_conversation_units_call_half_v1($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
  $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)`;
const halfArgs = (x, idx, half, turn, content, token, batch = randomUUID()) => {
  const p = payload(content);
  return [x.session, x.user, x.call, idx, half, turn, batch, JSON.stringify(p.units), JSON.stringify(p.bundles), JSON.stringify(p.threads),
    JSON.stringify(p.lifecycles), JSON.stringify(p.live), ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE,
    LF_REDUCER_VERSION, token.sp, token.seq, token.version];
};
/** One analysis half through the half coordinator with the current tokens. */
async function commitHalf(x, idx, half, turn, content, o = {}) {
  return one(HALF_SQL, halfArgs(x, idx, half, turn, content, o.token ?? await tokenOf(x), o.batch));
}
const EXCHANGE_SQL = `SELECT * FROM public.commit_finalized_exchange_with_full_semantic_chain_v1(
  $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
  $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`;
async function commitExchange(x, userTurn, userContent, assistantTurn, assistantContent) {
  const u = payload(userContent);
  const a = payload(assistantContent);
  const token = await tokenOf(x);
  return server(EXCHANGE_SQL, [x.session, x.user, userTurn, randomUUID(), JSON.stringify(u.units), JSON.stringify(u.bundles), JSON.stringify(u.threads),
    JSON.stringify(u.lifecycles), JSON.stringify(u.live), assistantTurn, randomUUID(), JSON.stringify(a.units), JSON.stringify(a.bundles),
    JSON.stringify(a.threads), JSON.stringify(a.lifecycles), JSON.stringify(a.live), ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE,
    ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, token.sp, token.seq, token.version]);
}
/** A completed text exchange of the session through the text path's own commands. */
async function textExchange(user, session, content = 'كان يوم طويل في الشغل.', reply = 'إيه اللي خلاه طويل؟') {
  await asRole('authenticated', user);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1, $2, $3, $4)', [userTurn, session, content, null]);
  await asRole('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1, $2, $3, $4, $5)', [session, user, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  await rows('SELECT * FROM finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [session, user, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  await owner();
  // Each text turn is its own transaction in the product; here they share one, so their text order is made explicit.
  await q('UPDATE public.conversation_turns SET created_at = clock_timestamp() WHERE id = $1', [userTurn]);
  await q('UPDATE public.conversation_turns SET created_at = clock_timestamp() WHERE id = $1', [assistantTurn]);
  return { userTurn, assistantTurn, content, reply };
}
const claim = (session, token) => one('SELECT * FROM public.server_claim_call_analysis_item_v1($1, $2)', [session, token]);
const settle = (x, idx, half, token, outcome, code = null) =>
  one('SELECT * FROM public.server_settle_call_analysis_item_v1($1, $2, $3, $4, $5, $6, $7)', [x.session, x.call, idx, half, token, outcome, code]);
const permit = (user, holder, respect = true, kind = 'CALL_ANALYSIS') =>
  one('SELECT * FROM public.server_acquire_background_permit_v1($1, $2, $3, $4)', [user, kind, holder, respect]);
const batchState = async (x, turn) => {
  const [b] = await rows('SELECT id FROM public.conversation_unit_commit_batches WHERE source_turn_id = $1', [turn]);
  if (!b) return 'ABSENT';
  return (await rows('SELECT public.conversation_full_semantic_batch_state_v1($1, $2, $3, $4) AS s', [x.session, x.user, turn, b.id]))[0].s;
};
const batchesOf = async (turn) => (await rows('SELECT count(*)::int AS n FROM public.conversation_unit_commit_batches WHERE source_turn_id = $1', [turn]))[0].n;
const lapse = (x, idx, half, column = 'lease_until') =>
  q(`UPDATE voice_private.call_analysis_queue SET ${column} = clock_timestamp() - interval '1 second' WHERE call_id = $1 AND call_turn_index = $2 AND half = $3`, [x.call, idx, half]);
const outboxCount = async (turn) =>
  (await rows("SELECT count(*)::int AS n FROM public.runtime_event_outbox WHERE subject_turn_id = $1 AND event_type = 'ConversationTurnCompleted'", [turn]))[0].n;

// ------------------------------------------------------------------ T0 catalogue
async function verifyCatalogue(report) {
  await report.section('T0a the three new relations: postgres-owned, RLS, no policy, no grant, ACCOUNT_CASCADE from the account; the queue\'s states, halves, shape and open index', async () => {
    for (const relation of [...NEW_PRIVATE, 'voice_private.background_permit_policy']) {
      const [r] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
          (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema || '.' || g.table_name = $1
              AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) AS grants FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(r, { owner: 'postgres', rls: true, policies: 0, grants: 0 }, relation);
    }
    const coverage = await rows('SELECT relation, coverage FROM account_erasure_private.coverage_registry WHERE relation = ANY($1::text[]) ORDER BY relation', [NEW_PRIVATE]);
    assert.deepEqual(coverage.map((c) => c.coverage), ['ACCOUNT_CASCADE', 'ACCOUNT_CASCADE', 'ACCOUNT_CASCADE']);
    for (const relation of NEW_PRIVATE) {
      const fks = await rows("SELECT confrelid::regclass::text AS target, confdeltype AS del FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'", [relation]);
      assert.ok(fks.every((f) => f.del === 'c') && fks.some((f) => f.target === 'users'), `${relation}: cascades from the account`);
    }
    const defs = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'voice_private.call_analysis_queue'::regclass AND contype = 'c'`)).map((r) => [r.conname, r.def]));
    for (const state of ['PENDING', 'CLAIMED', 'RETRY_WAIT', 'PARKED', 'COMPLETE', 'ABANDONED_INTEGRITY']) assert.match(defs.call_analysis_queue_state_check, new RegExp(`'${state}'`, 'u'));
    assert.match(defs.call_analysis_queue_half_check, /'EXCHANGE'.*call_turn_index < 1/u);
    assert.ok(defs.call_analysis_queue_shape_check, 'the claim / backoff / settlement shape');
    const [{ idx }] = await rows("SELECT indexdef AS idx FROM pg_indexes WHERE schemaname = 'voice_private' AND indexname = 'call_analysis_queue_open_idx'");
    assert.match(idx, /WHERE \(queue_state <> ALL/u);
    const [p] = await rows('SELECT * FROM voice_private.call_analysis_policy_v1()');
    assert.deepEqual([p.max_provider_attempts, p.retry_base_seconds, p.parked_retry_seconds, p.daily_attempt_budget, p.integrity_confirmations,
      p.item_lease_seconds, p.critical_window_seconds], [3, 2, 300, 2000, 2, 120, 10], 'L5 / B3 / L2 constants');
  });
  await report.section('T0b every new definer postgres-owned, pinned, service_role only; every internal no role\'s', async () => {
    assert.ok(INTERNAL.length >= 8, `the internals: ${INTERNAL.length}`);
    for (const fn of [...DEFINERS, ...INTERNAL]) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config, p.prosecdef AS definer,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', fn);
      assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
      assert.equal(p.definer, true, `${fn}: definer`);
      assert.deepEqual([p.anon, p.auth, p.service], [false, false, DEFINERS.includes(fn)], `${fn}: roles`);
    }
  });
  await report.section('T0c every forward-replaced function is its origin statement plus exactly the declared edits, in 0191 and live', async () => {
    const text = readFileSync(new URL(`./migrations/${MIGRATION_0191}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    assert.equal(SUBSTITUTIONS.length, 6);
    for (const substitution of SUBSTITUTIONS) {
      const declared = substitutedStatement(substitution);
      const written = extractStatement(text, substitution.header);
      assert.equal(written.statement, declared, `${substitution.key}: the 0191 statement is the derived one`);
      assert.ok(substitution.edits.every(([, to]) => to.includes('S8B-05 CP3 (0191')), `${substitution.key}: the edit names its task`);
      const name = /FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/u.exec(substitution.header)[1];
      const live = await rows("SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = $1", [name]);
      assert.ok(live.some((r) => r.prosrc.replace(/\r\n/gu, '\n') === written.body), `${substitution.key}: the live body is the 0191 body`);
    }
    assert.doesNotMatch(text, /FUNCTION public\.finalize_conversation_turn_v2\(/u, 'finalize v2 is not redefined');
    assert.doesNotMatch(text, /FUNCTION public\.server_store_call_turn_safety_v1\(/u, 'the one Safety store is reused');
  });
  await report.section('T0d D-05 as amended: the conversation commit family commits for service_role through exactly the full and the half coordinator; the writer for no role', async () => {
    const committing = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
        AND (p.proname LIKE 'commit\\_conversation\\_units%' OR p.proname LIKE 'commit\\_finalized\\_exchange%')
        AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY p.proname`);
    assert.deepEqual(committing.map((r) => r.proname), ['commit_conversation_units_call_half_v1', 'commit_finalized_exchange_with_full_semantic_chain_v1']);
  });
  await report.section('T0e every end path goes through end_call_v1 (explicit, failed, server, grace, recovery, sweep, a new call\'s recovery)', async () => {
    for (const fn of ['server_begin_call_v1', 'server_suspend_call_v1', 'server_resume_call_v1', 'server_end_call_v1', 'server_sweep_calls_v1']) {
      const [{ src }] = await rows("SELECT p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1", [fn]);
      assert.match(src, /voice_private\.end_call_v1\(/u, fn);
      assert.doesNotMatch(src, /SET state = 'ENDED'/u, `${fn}: no END outside end_call_v1`);
    }
  });
  await report.section('T0f four scopes DISABLED / UNSATISFIED; the census clean; the permit policy', async () => {
    const scopes = await rows('SELECT feature_flag_state AS f, launch_requirements_state AS r FROM voice_private.voice_launch_capability_states');
    assert.equal(scopes.length, 4);
    assert.ok(scopes.every((s) => s.f === 'DISABLED' && s.r === 'UNSATISFIED'));
    const census = await rows(`SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c WHERE c.contype = 'f'
        AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
        AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)`);
    assert.deepEqual(census, []);
    const [b] = await rows('SELECT * FROM voice_private.background_permit_policy_v1()');
    assert.deepEqual([b.total_permits, b.minimum_permits, b.live_generation_weight, b.per_user_permits, b.lease_seconds], [16, 2, 2, 2, 120]);
  });
}

// ------------------------------------------------------------------ behaviour (one rolled-back transaction)
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await setCapacity(64);
    await report.isolated('T1 the USER half while GENERATING: committed through the writer, the item COMPLETE in the same transaction; a replay from storage, no token check, no second batch', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x, { content: 'النهارده كان صعب شوية.' });
      assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id = $1', [t.turn]))[0].status, 'GENERATING');
      const batch = randomUUID();
      const r = await commitHalf(x, t.idx, 'USER', t.turn, t.content, { batch });
      assert.equal(r.outcome, 'COMMITTED');
      assert.equal(r.units.length, 1);
      assert.equal(n(r.live_head), 1);
      assert.equal(await batchState(x, t.turn), 'COMPLETE');
      const it = await item(x, t.idx, 'USER');
      assert.deepEqual([it.queue_state, it.claim_token, it.settled_at !== null], ['COMPLETE', null, true]);
      const replay = await commitHalf(x, t.idx, 'USER', t.turn, t.content, { batch, token: { sp: null, seq: '0', version: '0' } });
      assert.deepEqual([replay.outcome, replay.units.map((u) => u.id)], ['REPLAYED', r.units.map((u) => u.id)], 'replayed from storage, no token check');
      assert.equal(await batchesOf(t.turn), 1);
      // A second batch for the same half is not a head any more: refused, nothing written (no duplicate commit).
      await rejected(() => commitHalf(x, t.idx, 'USER', t.turn, t.content), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      assert.equal(await batchesOf(t.turn), 1);
      // A half of a turn of another call, or a turn that is not the item's, is refused.
      await rejected(() => commitHalf(x, t.idx, 'USER', randomUUID(), t.content), ['22023'], /CALL_HALF_NOT_QUEUED/u);
    });

    await report.isolated('T2 O1: the reply\'s half never before its USER half (retryable, nothing written); then both in order', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      const reply = await playedReply(x, t.idx);
      assert.equal((await item(x, t.idx, 'ASSISTANT')).queue_state, 'PENDING', 'R7′: the close queued the reply half');
      await rejected(() => commitHalf(x, t.idx, 'ASSISTANT', reply, 'تمام، احكيلي أكتر.'), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      assert.equal(await batchesOf(reply), 0, 'nothing written');
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content)).outcome, 'COMMITTED');
      const a = await commitHalf(x, t.idx, 'ASSISTANT', reply, 'تمام، احكيلي أكتر.');
      assert.deepEqual([a.outcome, n(a.live_head)], ['COMMITTED', 2]);
      assert.deepEqual((await queueOf(x.session)).map((i) => [i.idx, i.half, i.state]), [[1, 'USER', 'COMPLETE'], [1, 'ASSISTANT', 'COMPLETE']]);
      // A reply turn handed in as the USER half, or a USER turn as the reply half, is a relation error.
      await rejected(() => commitHalf(x, t.idx, 'USER', reply, 'x'), ['22023']);
    });

    await report.isolated('T3 O2: the next USER half never before the whole previous exchange; an N1-closed reply half in between; then in order', async () => {
      const x = await activeCall();
      const t1 = await spokenTurn(x, { content: 'أول حاجة' });
      assert.equal(await segment(x, t1.idx, 0, 'طيب. ', 0, 400), 'REGISTERED');
      const t2 = await spokenTurn(x, { content: 'تاني حاجة' });
      const ex1 = await exchange(x, t1.idx);
      assert.deepEqual([ex1.exchange_state, ex1.close_reason], ['CLOSED', 'NEXT_TURN']);
      assert.deepEqual((await queueOf(x.session)).map((i) => [i.idx, i.half]), [[1, 'USER'], [1, 'ASSISTANT'], [2, 'USER']]);
      await rejected(() => commitHalf(x, t2.idx, 'USER', t2.turn, t2.content), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      assert.equal((await commitHalf(x, t1.idx, 'USER', t1.turn, t1.content)).outcome, 'COMMITTED');
      await rejected(() => commitHalf(x, t2.idx, 'USER', t2.turn, t2.content), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      // The interrupted reply was never heard: its content is empty, so its half is a zero-unit batch.
      const reply = ex1.assistant_turn_id;
      assert.equal((await rows('SELECT content FROM public.conversation_turns WHERE id = $1', [reply]))[0].content, '');
      const a = await commitHalf(x, t1.idx, 'ASSISTANT', reply, '');
      assert.deepEqual([a.outcome, a.units.length], ['COMMITTED', 0]);
      assert.equal((await commitHalf(x, t2.idx, 'USER', t2.turn, t2.content)).outcome, 'COMMITTED');
      const order = await rows(`SELECT u.source_turn_id AS turn, u.session_position AS sp FROM public.conversation_units u WHERE u.session_id = $1 ORDER BY u.session_position`, [x.session]);
      assert.deepEqual(order.map((o) => o.turn), [t1.turn, t2.turn], 'Session Positions follow call_turn_index');
    });

    await report.isolated('T4 an empty reply after GENERATION_FAILED: a zero-unit batch; the reply half after a failed close', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      assert.equal(await finish(x, t.idx, 'FAILED', 0), 'FINISHED');
      const c = await close(x, t.idx, 'GENERATION_FAILED');
      assert.deepEqual([c.outcome, c.delivery_state], ['CLOSED', 'FAILED']);
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content)).outcome, 'COMMITTED');
      const a = await commitHalf(x, t.idx, 'ASSISTANT', c.assistant_turn_id, '');
      assert.deepEqual([a.outcome, a.units], ['COMMITTED', []], JSON.stringify(a));
      assert.equal(await batchState(x, c.assistant_turn_id), 'COMPLETE');
    });

    await report.isolated('T5 stale tokens: the Session clock or the identity clock moved: PT409, nothing written, the item still open', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      const token = await tokenOf(x);
      await rejected(() => commitHalf(x, t.idx, 'USER', t.turn, t.content, { token: { ...token, seq: String(Number(token.seq) + 1) } }), ['PT409'], /STALE_CONVERSATIONAL_FOCUS_CONTEXT/u);
      await rejected(() => commitHalf(x, t.idx, 'USER', t.turn, t.content, { token: { ...token, version: String(Number(token.version) + 1) } }), ['PT409'], /STALE_THREAD_IDENTITY_CONTEXT/u);
      assert.equal(await batchesOf(t.turn), 0);
      assert.equal((await item(x, t.idx, 'USER')).queue_state, 'PENDING');
    });

    await report.isolated('T6 O3a: the full coordinator refuses every numbered call turn; a text exchange of the same session is unchanged', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      const reply = await playedReply(x, t.idx);
      await rejected(() => commitExchange(x, t.turn, t.content, reply, 'تمام، احكيلي أكتر.'), ['55000'], /CALL_TURN_HALF_ESTABLISHMENT_ONLY/u);
      const other = await newSession(x.user);
      const e = await textExchange(x.user, other);
      const r = await commitExchange({ ...x, session: other }, e.userTurn, e.content, e.assistantTurn, e.reply);
      assert.equal(r.length, 1);
      assert.deepEqual([await batchState({ ...x, session: other }, e.userTurn), await batchState({ ...x, session: other }, e.assistantTurn)], ['COMPLETE', 'COMPLETE'], 'both halves committed');
    });

    await report.isolated('T7 O3b / B1: the unestablished pre-call exchanges after the last established one take the head in order; the call waits for them', async () => {
      const user = await human();
      const session = await newSession(user);
      assert.equal(await grant(user), 'GRANTED');
      const old = await textExchange(user, session, 'قديم ومش متأسس.', 'فاهم.');
      const established = await textExchange(user, session, 'ده اتأسس.', 'تمام.');
      await commitExchange({ user, session }, established.userTurn, established.content, established.assistantTurn, established.reply);
      const p1 = await textExchange(user, session, 'لسه ما اتأسسش واحد.', 'طيب.');
      const p2 = await textExchange(user, session, 'ولا ده اتنين.', 'ماشي.');
      const x = await activeCall({ user, session });
      // RE-ANCHORED by DEC-R1-1 (was: adopted at the first turn, numbered -1, 0): the ACTIVATION adopts them, before the person
      // has said anything, ending at -1000 (the slots below the first turn kept for an exchange completing before it).
      assert.deepEqual((await queueOf(session)).map((i) => [i.idx, i.half, i.turn_id].join()),
        [[-1001, 'EXCHANGE', p1.userTurn], [-1000, 'EXCHANGE', p2.userTurn]].map((r) => r.join()), 'adopted at the activation, before any turn');
      const t = await spokenTurn(x);
      const queue = await queueOf(session);
      assert.deepEqual(queue.map((i) => [i.idx, i.half, i.turn_id, i.assistant_turn_id].join()).concat(JSON.stringify({ old, established, p1, p2 })),
        [[-1001, 'EXCHANGE', p1.userTurn, p1.assistantTurn], [-1000, 'EXCHANGE', p2.userTurn, p2.assistantTurn], [1, 'USER', t.turn, null]].map((r) => r.join()).concat(JSON.stringify({ old, established, p1, p2 })),
        'the suffix after the last established exchange, in order; the older gap is the text path\'s own');
      assert.ok(!queue.some((i) => i.turn_id === old.userTurn));
      // The worker's turn read: only turns the session's analysis order names, the owner's, at most two.
      const read = (u, ids) => server('SELECT id FROM public.server_read_call_analysis_turns_v1($1, $2, $3::uuid[])', [u, session, ids]);
      assert.deepEqual((await read(user, [p1.userTurn, p1.assistantTurn])).map((r) => r.id), [p1.userTurn, p1.assistantTurn]);
      assert.deepEqual((await read(user, [t.turn])).map((r) => r.id), [t.turn]);
      assert.equal((await read(user, [old.userTurn, established.userTurn])).length, 0, 'a turn the order does not name is not read');
      assert.equal((await read(await human(), [t.turn])).length, 0, 'another person reads nothing');
      await rejected(() => read(user, [p1.userTurn, p1.assistantTurn, t.turn]), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => commitHalf(x, t.idx, 'USER', t.turn, t.content), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      for (const [idx, e] of [[-1001, p1], [-1000, p2]]) {
        const token = randomUUID();
        const c = await claim(session, token);
        assert.deepEqual([c.outcome, c.call_turn_index, c.half, c.turn_id, c.assistant_turn_id], ['CLAIMED', idx, 'EXCHANGE', e.userTurn, e.assistantTurn]);
        await rejected(() => settle(x, idx, 'EXCHANGE', token, 'COMPLETE'), ['55000'], /CALL_ANALYSIS_ITEM_NOT_ESTABLISHED/u);
        await commitExchange(x, e.userTurn, e.content, e.assistantTurn, e.reply);
        assert.deepEqual([(await settle(x, idx, 'EXCHANGE', token, 'COMPLETE')).queue_state], ['COMPLETE']);
      }
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content)).outcome, 'COMMITTED');
      // The second turn adopts nothing more.
      await spokenTurn(x);
      assert.equal((await queueOf(session)).filter((i) => i.half === 'EXCHANGE').length, 2);
    });

    await report.isolated('T7b O3b as amended by DEC-R1-1: adopted once, at the activation; what completes before the first turn goes after it; nothing after the first turn; nothing that does not fit', async () => {
      const user = await human();
      const session = await newSession(user);
      assert.equal(await grant(user), 'GRANTED');
      const p1 = await textExchange(user, session, 'لسه ما اتأسسش.', 'طيب.');
      // A text reply still generating when the call activates: its USER turn is claimed now and finalized after the activation.
      const lateContent = 'وده كان لسه بيترد عليه.';
      await asRole('authenticated', user);
      const lateUser = randomUUID();
      await rows('SELECT * FROM create_user_conversation_turn($1, $2, $3, $4)', [lateUser, session, lateContent, null]);
      await asRole('service_role');
      await rows('SELECT * FROM claim_conversation_turn($1, $2, $3, $4, $5)', [session, user, lateUser, ...ROUTE]);
      await owner();
      await q('UPDATE public.conversation_turns SET created_at = clock_timestamp() WHERE id = $1', [lateUser]);
      const x = await activeCall({ user, session });
      assert.deepEqual((await queueOf(session)).map((i) => [i.idx, i.half, i.turn_id].join()), [[-1000, 'EXCHANGE', p1.userTurn].join()],
        'the activation adopts the completed exchange only; the one still generating is not an exchange yet');
      // The same activation again (a retried command) adopts nothing more.
      assert.equal((await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [user, x.call])).outcome, 'ACTIVE');
      assert.equal((await queueOf(session)).length, 1, 'once per call');
      await asRole('service_role');
      const lateAssistant = randomUUID();
      await rows('SELECT * FROM finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [session, user, lateUser, lateAssistant, 'ماشي.', 'ALLOW', randomUUID(), null, null, null]);
      await owner();
      await q('UPDATE public.conversation_turns SET created_at = clock_timestamp() WHERE id = $1', [lateAssistant]);
      const t = await spokenTurn(x);
      assert.deepEqual((await queueOf(session)).map((i) => [i.idx, i.half, i.turn_id].join()),
        [[-1000, 'EXCHANGE', p1.userTurn], [-999, 'EXCHANGE', lateUser], [1, 'USER', t.turn]].map((r) => r.join()),
        "the first turn adopts what completed after the activation, after the activation's items: the one order is kept");
      await rejected(() => commitHalf(x, t.idx, 'USER', t.turn, t.content), ['55000'], /CALL_HALF_OUT_OF_ORDER/u);
      for (const [idx, userTurn, content, assistantTurn, reply] of [[-1000, p1.userTurn, p1.content, p1.assistantTurn, p1.reply],
        [-999, lateUser, lateContent, lateAssistant, 'ماشي.']]) {
        const token = randomUUID();
        const c = await claim(session, token);
        assert.deepEqual([c.outcome, c.call_turn_index, c.turn_id], ['CLAIMED', idx, userTurn], 'claimed in order');
        await commitExchange(x, userTurn, content, assistantTurn, reply);
        assert.equal((await settle(x, idx, 'EXCHANGE', token, 'COMPLETE')).queue_state, 'COMPLETE');
      }
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content)).outcome, 'COMMITTED');
      // After the first turn a text exchange is the text path's own, unchanged.
      await playedReply(x, t.idx);
      await textExchange(user, session, 'بعد أول دور.', 'تمام.');
      await spokenTurn(x);
      assert.equal((await queueOf(session)).filter((i) => i.half === 'EXCHANGE').length, 2, 'the second turn adopts nothing');
      // An adoption that would not fit below the first turn adopts nothing (it stays the text path's own) and never takes a
      // turn's index.
      const y = await activeCall();
      const e = await textExchange(y.user, y.session, 'آخر واحد.', 'تمام.');
      await q(`INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id, assistant_turn_id)
        VALUES ($1, 0, 'EXCHANGE', $2, $3, $4, $5)`, [y.call, y.user, y.session, e.userTurn, e.assistantTurn]);
      const g = await textExchange(y.user, y.session, 'ده مش هيلحق.', 'تمام.');
      assert.equal((await rows('SELECT voice_private.adopt_pre_call_exchanges_v1($1, $2, $3, 0) AS n', [y.call, y.user, y.session]))[0].n, 0);
      assert.ok(!(await queueOf(y.session)).some((i) => i.turn_id === g.userTurn), 'not adopted past 0');
      await rejected(() => rows('SELECT voice_private.adopt_pre_call_exchanges_v1($1, $2, $3, -1) AS n', [y.call, y.user, y.session]), ['22023'], /VOICE_REQUEST_INVALID/u);
    });

    await report.isolated('T8 claims: one per session, an expired lease re-claimed, NOT_HOLDER for a stale holder; crash before the commit (nothing written), after it (ALREADY_SETTLED, REPLAYED)', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      const a = randomUUID();
      const b = randomUUID();
      assert.deepEqual([(await claim(x.session, a)).outcome, (await item(x, t.idx, 'USER')).attempt_count], ['CLAIMED', 1]);
      assert.equal((await claim(x.session, b)).outcome, 'WAITING', 'another instance\'s live claim holds the head');
      // A crashed worker: its leases lapse; another instance takes the item over.
      await lapse(x, t.idx, 'USER');
      await q("UPDATE voice_private.session_semantic_leases SET lease_until = clock_timestamp() - interval '1 second' WHERE session_id = $1", [x.session]);
      const c = await claim(x.session, b);
      assert.deepEqual([c.outcome, c.attempt_count], ['CLAIMED', 2], JSON.stringify(c));
      assert.equal((await settle(x, t.idx, 'USER', a, 'PROVIDER_FAILURE', 'PROVIDER_UNAVAILABLE')).outcome, 'NOT_HOLDER');
      // Crash before the commit: the half coordinator's transaction never commits.
      await q('SAVEPOINT crash');
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content)).outcome, 'COMMITTED');
      await q('ROLLBACK TO SAVEPOINT crash');
      assert.deepEqual([await batchesOf(t.turn), (await item(x, t.idx, 'USER')).queue_state], [0, 'CLAIMED']);
      // Crash after the commit, before the settle: the item is already COMPLETE; the settle and a replay are harmless.
      const batch = randomUUID();
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content, { batch })).outcome, 'COMMITTED');
      assert.deepEqual([(await settle(x, t.idx, 'USER', b, 'COMPLETE')).outcome], ['ALREADY_SETTLED']);
      assert.equal((await commitHalf(x, t.idx, 'USER', t.turn, t.content, { batch })).outcome, 'REPLAYED');
      assert.equal((await claim(x.session, b)).outcome, 'IDLE');
    });

    await report.isolated('T9 L5 / B3: backoff 2 s, 4 s, then PARKED, never skipped; RELEASE refunds; integrity confirmed once → ABANDONED_INTEGRITY with its reply; the daily budget PARKS', async () => {
      const x = await activeCall();
      const t1 = await spokenTurn(x);
      await spokenTurn(x);
      const tok = randomUUID();
      assert.equal((await claim(x.session, tok)).outcome, 'CLAIMED');
      assert.deepEqual([(await settle(x, t1.idx, 'USER', tok, 'RELEASE')).queue_state, (await item(x, t1.idx, 'USER')).attempt_count], ['PENDING', 0]);
      const delays = [];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const c = await claim(x.session, tok);
        assert.deepEqual([c.outcome, c.call_turn_index, c.half], ['CLAIMED', t1.idx, 'USER'], `attempt ${attempt}: the head, never the next item ${JSON.stringify(c)}`);
        const s = await settle(x, t1.idx, 'USER', tok, 'PROVIDER_FAILURE', attempt === 2 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE');
        const [{ d }] = await rows('SELECT round(extract(epoch FROM $1::timestamptz - clock_timestamp()))::int AS d', [s.next_attempt_at]);
        delays.push([s.queue_state, d]);
        if (attempt < 3) {
          const w = await claim(x.session, tok);
          assert.deepEqual([w.outcome, w.call_turn_index], ['WAITING', t1.idx], 'the backoff holds the head; the next half waits behind it');
          await q("UPDATE voice_private.call_analysis_queue SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE call_id = $1 AND call_turn_index = $2 AND half = 'USER'", [x.call, t1.idx]);
        }
      }
      assert.deepEqual(delays, [['RETRY_WAIT', 2], ['RETRY_WAIT', 4], ['PARKED', 300]]);
      assert.equal((await claim(x.session, tok)).outcome, 'WAITING', 'PARKED is never skipped');
      await q("UPDATE voice_private.call_analysis_queue SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE call_id = $1 AND call_turn_index = $2 AND half = 'USER'", [x.call, t1.idx]);
      assert.equal((await claim(x.session, tok)).outcome, 'CLAIMED', 'the parked retry');
      // Integrity: the first failure is confirmed by one repeat; then the item and its reply's half are abandoned.
      assert.equal((await settle(x, t1.idx, 'USER', tok, 'INTEGRITY_FAILURE', 'FULL_SEMANTIC_BATCH_INTEGRITY')).queue_state, 'RETRY_WAIT');
      await q("UPDATE voice_private.call_analysis_queue SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE call_id = $1 AND call_turn_index = $2 AND half = 'USER'", [x.call, t1.idx]);
      assert.equal((await claim(x.session, tok)).outcome, 'CLAIMED');
      assert.equal((await settle(x, t1.idx, 'USER', tok, 'INTEGRITY_FAILURE', 'FULL_SEMANTIC_BATCH_INTEGRITY')).queue_state, 'ABANDONED_INTEGRITY');
      await rejected(() => commitHalf(x, t1.idx, 'USER', t1.turn, t1.content), ['55000'], /SEMANTIC_ITEM_ABANDONED/u);
      const next = await claim(x.session, tok);
      assert.deepEqual([next.outcome, next.call_turn_index, next.half], ['CLAIMED', 2, 'USER'], 'the reply half went with it; the next exchange proceeds');
      const q1 = await queueOf(x.session);
      assert.deepEqual(q1.slice(0, 2).map((i) => [i.half, i.state, i.last_failure]),
        [['USER', 'ABANDONED_INTEGRITY', 'FULL_SEMANTIC_BATCH_INTEGRITY'], ['ASSISTANT', 'ABANDONED_INTEGRITY', 'PREDECESSOR_ABANDONED']]);
      assert.equal((await settle(x, 2, 'USER', tok, 'RELEASE')).queue_state, 'PENDING');
      // The daily budget of the analysis lock class.
      await q("UPDATE voice_private.call_analysis_attempt_days SET attempts = 2000 WHERE user_id = $1", [x.user]);
      const parked = await claim(x.session, tok);
      assert.equal(parked.outcome, 'BUDGET_EXHAUSTED');
      const it = await item(x, 2, 'USER');
      assert.deepEqual([it.queue_state, it.last_failure], ['PARKED', 'DAILY_BUDGET_EXHAUSTED']);
    });

    await report.isolated('T10 the shared session lock: BUSY and a reservation while an item is held, honoured next; NOT_REQUIRED for a text session; the next turn never waits', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      const worker = randomUUID();
      const post = randomUUID();
      assert.equal((await claim(x.session, worker)).outcome, 'CLAIMED');
      assert.equal((await one('SELECT * FROM public.server_acquire_session_semantic_lease_v1($1, $2, $3)', [x.user, x.session, post])).outcome, 'BUSY');
      // The live path is not behind the lock: the next spoken turn commits while the item is held.
      const t2 = await spokenTurn(x);
      assert.equal(t2.idx, t.idx + 1, 'the next turn');
      assert.equal((await settle(x, t.idx, 'USER', worker, 'RELEASE')).outcome, 'SETTLED');
      assert.equal((await claim(x.session, worker)).outcome, 'BUSY', 'the post-response reservation goes first: ' + JSON.stringify(await rows('SELECT * FROM voice_private.session_semantic_leases WHERE session_id = $1', [x.session])));
      assert.equal((await one('SELECT * FROM public.server_acquire_session_semantic_lease_v1($1, $2, $3)', [x.user, x.session, post])).outcome, 'ACQUIRED');
      assert.equal((await one('SELECT * FROM public.server_release_session_semantic_lease_v1($1, $2)', [x.session, post])).outcome, 'RELEASED');
      assert.equal((await claim(x.session, worker)).outcome, 'CLAIMED');
      const textUser = await human();
      const textSession = await newSession(textUser);
      assert.equal((await one('SELECT * FROM public.server_acquire_session_semantic_lease_v1($1, $2, $3)', [textUser, textSession, post])).outcome, 'NOT_REQUIRED');
      assert.equal((await one('SELECT * FROM public.server_acquire_session_semantic_lease_v1($1, $2, $3)', [x.user, textSession, post])).outcome, 'NOT_FOUND');
    });

    await report.isolated('T11 the permits: two per person, the cap under live generations, a renewal, a lapsed slot; L2 while nothing is heard or registered', async () => {
      await setPermits(4, 1, 1, 2);
      const x = await activeCall();
      const t = await spokenTurn(x);
      const p1 = await permit(x.user, randomUUID(), true);
      assert.equal(p1.outcome, 'WAIT_CRITICAL_WINDOW', 'L2: the reply has nothing heard and nothing registered');
      const [{ live }] = await rows("SELECT count(*)::int AS live FROM voice_private.call_exchanges WHERE exchange_state = 'OPEN' AND generation_state = 'GENERATING' AND committed_at > clock_timestamp() - interval '2 minutes'");
      const fg = await permit(x.user, randomUUID(), false, 'POST_RESPONSE_INTELLIGENCE');
      assert.deepEqual([fg.outcome, fg.live_generations, fg.capacity], ['GRANTED', live, Math.max(1, 4 - live)]);
      assert.equal(await segment(x, t.idx, 0, 'أهلًا. ', 0, 400), 'REGISTERED');
      const holder = randomUUID();
      assert.equal((await permit(x.user, holder, true)).outcome, 'GRANTED', 'the window ends at the first registered audio');
      assert.equal((await permit(x.user, randomUUID(), true)).outcome, 'WAIT_USER_LIMIT');
      assert.equal((await permit(x.user, holder, true)).outcome, 'GRANTED', 'a renewal of the same holder');
      const others = [await human(), await human()];
      const outcomes = [];
      for (const other of others) for (let i = 0; i < 2; i += 1) outcomes.push((await permit(other, randomUUID(), true)).outcome);
      const cap = Math.max(1, 4 - live);
      assert.equal(outcomes.filter((o) => o === 'GRANTED').length, cap - 2, 'never more than the cap');
      assert.ok(outcomes.includes('WAIT_CAPACITY'));
      await q("UPDATE voice_private.background_provider_permits SET lease_until = granted_at + interval '1 millisecond' WHERE holder = $1", [holder]);
      assert.equal((await permit(others[1], randomUUID(), true)).outcome, 'GRANTED', 'a lapsed lease frees its slot');
      assert.equal((await one('SELECT * FROM public.server_release_background_permit_v1($1)', [holder])).outcome, 'NOT_HELD');
      await rejected(() => permit(x.user, randomUUID(), true, 'LIVE_VOICE_REPLY'), ['22023']);
    });

    await report.isolated('T11b the cap is a count of the permits held: when it shrinks, a freed low slot admits nothing until fewer than the cap remain', async () => {
      await setPermits(6, 1, 1, 2);
      await q('DELETE FROM voice_private.background_provider_permits');
      const [{ live }] = await rows("SELECT count(*)::int AS live FROM voice_private.call_exchanges WHERE exchange_state = 'OPEN' AND generation_state = 'GENERATING' AND committed_at > clock_timestamp() - interval '2 minutes'");
      const cap = Math.max(1, 6 - live);
      assert.ok(cap >= 4, `the scenario needs room under the cap (live generations ${live})`);
      const people = [await human(), await human(), await human()];
      const held = [];
      for (const person of people) for (let i = 0; i < 2 && held.length < cap; i += 1) {
        const holder = randomUUID();
        assert.equal((await permit(person, holder, false)).outcome, 'GRANTED');
        held.push(holder);
      }
      assert.equal(held.length, cap, 'filled to the cap');
      // Two live replies begin generating: the cap shrinks by two while every permit is still held.
      const replies = [await activeCall(), await activeCall()];
      for (const call of replies) await spokenTurn(call);
      const outsider = await human();
      const shrunk = await permit(outsider, randomUUID(), false);
      assert.deepEqual([shrunk.outcome, shrunk.capacity], ['WAIT_CAPACITY', Math.max(1, cap - 2)]);
      // Releasing the LOWEST slot frees a slot number, not capacity: still more permits held than the shrunk cap.
      const [{ holder: lowest }] = await rows('SELECT holder FROM voice_private.background_provider_permits ORDER BY slot LIMIT 1');
      assert.equal((await one('SELECT * FROM public.server_release_background_permit_v1($1)', [lowest])).outcome, 'RELEASED');
      // cap - 1 permits are held against a cap of cap - 2: a slot range would grant slot 1 here; the count refuses.
      const afterOne = await permit(outsider, randomUUID(), false);
      assert.deepEqual([afterOne.outcome, afterOne.capacity], ['WAIT_CAPACITY', cap - 2], 'a freed low slot is not capacity');
      assert.equal(Number((await rows('SELECT count(*)::int AS n FROM voice_private.background_provider_permits'))[0].n), cap - 1);
      // Released down below the shrunk cap: granted again.
      const rest = (await rows('SELECT holder FROM voice_private.background_provider_permits ORDER BY slot')).map((r) => r.holder);
      for (const holder of rest) await one('SELECT * FROM public.server_release_background_permit_v1($1)', [holder]);
      assert.equal((await permit(outsider, randomUUID(), false)).outcome, 'GRANTED');
    });

    await report.isolated('T12a the explicit end closes the open exchange with stored Safety once: CALL_ENDING, the reply half queued, one ConversationTurnCompleted', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      assert.equal(await segment(x, t.idx, 0, 'أكيد. ', 0, 400), 'REGISTERED');
      assert.equal(await endCall(x), 'ENDED');
      const ex = await exchange(x, t.idx);
      assert.deepEqual([ex.exchange_state, ex.close_reason, ex.delivery_state], ['CLOSED', 'CALL_ENDING', 'INTERRUPTED']);
      assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id = $1', [t.turn]))[0].status, 'COMPLETED');
      assert.equal((await item(x, t.idx, 'ASSISTANT')).turn_id, ex.assistant_turn_id);
      assert.equal(await outboxCount(t.turn), 1);
      assert.equal((await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, 'USER_ENDED'])).outcome, 'ALREADY_ENDED');
      assert.equal(await outboxCount(t.turn), 1, 'once');
      assert.deepEqual(await server('SELECT * FROM public.server_list_unsettled_call_exchanges_v1(200) WHERE call_id = $1', [x.call]), []);
    });

    await report.isolated('T12b S3: no Safety stored → OPEN after the END, unclosable, listed, read with the same reader, stored once, closed CALL_ENDING once; never on a live call', async () => {
      const x = await activeCall();
      const t1 = await spokenTurn(x, { content: 'أول دور' });
      await playedReply(x, t1.idx);
      const t2 = await spokenTurn(x, { content: 'تاني دور', safety: null });
      const live = await one('SELECT * FROM public.server_close_ended_call_exchange_v1($1, $2, $3, $4, $5)', [x.user, x.call, t2.idx, randomUUID(), randomUUID()]);
      assert.equal(live.outcome, 'CALL_LIVE');
      assert.equal(await endCall(x), 'ENDED');
      assert.deepEqual([(await exchange(x, t2.idx)).exchange_state, await outboxCount(t2.turn)], ['OPEN', 0], 'the END does not close without Safety');
      await rejected(() => one('SELECT * FROM public.server_close_ended_call_exchange_v1($1, $2, $3, $4, $5)', [x.user, x.call, t2.idx, randomUUID(), randomUUID()]),
        ['55000'], /CALL_EXCHANGE_SAFETY_UNSETTLED/u);
      const listed = await server('SELECT * FROM public.server_list_unsettled_call_exchanges_v1(200) WHERE call_id = $1', [x.call]);
      assert.deepEqual(listed.map((l) => [l.call_turn_index, l.user_turn_id, l.content, l.safety_disposition]), [[t2.idx, t2.turn, 'تاني دور', null]]);
      const viaServer = await server('SELECT * FROM public.server_read_call_context_v1($1, $2, $3, 12)', [x.user, x.session, x.call]);
      const viaOwner = await asOwner(x.user, 'SELECT * FROM public.call_context_exchanges_v1($1, $2, 12)', [x.session, x.call]);
      assert.deepEqual(viaServer, viaOwner, 'the same reader');
      assert.ok(viaServer.length >= 1);
      const stranger = await human();
      assert.deepEqual(await server('SELECT * FROM public.server_read_call_context_v1($1, $2, $3, 12)', [stranger, x.session, x.call]), []);
      assert.equal(await safety(x, t2.idx, 'GUIDED'), 'STORED');
      const c = await one('SELECT * FROM public.server_close_ended_call_exchange_v1($1, $2, $3, $4, $5)', [x.user, x.call, t2.idx, randomUUID(), randomUUID()]);
      assert.deepEqual([c.outcome, c.delivery_state], ['CLOSED', 'INTERRUPTED']);
      const again = await one('SELECT * FROM public.server_close_ended_call_exchange_v1($1, $2, $3, $4, $5)', [x.user, x.call, t2.idx, randomUUID(), randomUUID()]);
      assert.equal(again.outcome, 'ALREADY_CLOSED');
      const [ev] = await rows("SELECT payload FROM public.runtime_event_outbox WHERE subject_turn_id = $1 AND event_type = 'ConversationTurnCompleted'", [t2.turn]);
      assert.equal(ev.payload.safety_disposition, 'GUIDED', 'the recomputed Safety is the one carried');
      assert.equal(await outboxCount(t2.turn), 1);
      assert.equal((await exchange(x, t2.idx)).close_reason, 'CALL_ENDING');
      assert.equal((await item(x, t2.idx, 'ASSISTANT')).queue_state, 'PENDING');
    });

    await report.isolated('T12c the sweep and a new call\'s recovery end a lapsed call and close its exchange with stored Safety in the same transaction', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      await q("UPDATE voice_private.calls SET seat_lease_until = clock_timestamp() - interval '1 hour' WHERE id = $1", [x.call]);
      assert.ok(n((await one('SELECT * FROM public.server_sweep_calls_v1(200)')).ended) >= 1);
      const ex = await exchange(x, t.idx);
      assert.deepEqual([ex.exchange_state, ex.close_reason], ['CLOSED', 'CALL_ENDING']);
      const y = await activeCall();
      const u = await spokenTurn(y);
      await q("UPDATE voice_private.calls SET seat_lease_until = clock_timestamp() - interval '1 hour' WHERE id = $1", [y.call]);
      const next = randomUUID();
      assert.equal((await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [y.user, y.session, next, randomUUID()])).outcome, 'BEGUN');
      assert.equal((await rows('SELECT state FROM voice_private.calls WHERE id = $1', [y.call]))[0].state, 'ENDED');
      assert.equal((await exchange(y, u.idx)).close_reason, 'CALL_ENDING');
      assert.equal(await outboxCount(u.turn), 1);
    });

    await report.isolated('T13 account erasure removes every new row', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      assert.equal((await claim(x.session, randomUUID())).outcome, 'CLAIMED');
      await playedReply(x, t.idx);
      assert.equal((await permit(x.user, randomUUID(), false)).outcome, 'GRANTED');
      assert.equal(await endCall(x), 'ENDED');
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [x.user]);
      assert.equal((await one('SELECT public.server_erase_account_v1($1) AS outcome', [del.id])).outcome, 'ERASED');
      for (const relation of [...NEW_PRIVATE, 'voice_private.call_analysis_queue']) {
        assert.equal((await rows(`SELECT count(*)::int AS n FROM ${relation} WHERE user_id = $1`, [x.user]))[0].n, 0, relation);
      }
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}
const n = Number;

// ------------------------------------------------------------------ races (committed fixtures, erased afterwards)
async function verifyRaces(report) {
  const { q2, close: closeSecondary } = await rt.openSecondary();
  const sr = async (client, sql, values) => {
    await client('BEGIN');
    await client('SET LOCAL ROLE service_role');
    return (await client(sql, values)).rows[0];
  };
  const calls = [];
  await owner();
  const [gate] = await rows('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = $1', [LIVE]);
  const [policy] = await rows('SELECT * FROM voice_private.live_call_policy');
  const [permits] = await rows('SELECT * FROM voice_private.background_permit_policy');
  const fresh = async () => {
    const x = await activeCall();
    calls.push(x);
    return x;
  };
  try {
    await setCapacity(64);
    await report.section('TRC-1 two workers claim one session at once: exactly one CLAIMED', async () => {
      const x = await fresh();
      await spokenTurn(x);
      await owner();
      const a = await sr(q, 'SELECT * FROM public.server_claim_call_analysis_item_v1($1, $2)', [x.session, randomUUID()]);
      const b = sr(q2, 'SELECT * FROM public.server_claim_call_analysis_item_v1($1, $2)', [x.session, randomUUID()]);
      assert.equal(await rt.stillPending(b), true, 'the second claim waits on the session lease row');
      await q('COMMIT');
      await owner();
      const r = await b;
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['CLAIMED', 'BUSY']);
    });

    await report.section('TRC-2 the half commit holds the USER turn; the next spoken turn waits only for that transaction (no provider, no lease), then commits; no deadlock', async () => {
      const x = await fresh();
      const t = await spokenTurn(x);
      assert.equal(await segment(x, t.idx, 0, 'آه. ', 0, 400), 'REGISTERED');
      await audio(x, 'USER', x.end.USER + 1000);
      await owner();
      const h = await sr(q, HALF_SQL, halfArgs(x, t.idx, 'USER', t.turn, t.content, await tokenOf(x)));
      const started = Date.now();
      const b = sr(q2, COMMIT_SQL, commitArgs(x, { start: x.end.USER - 1000 }));
      assert.equal(await rt.stillPending(b, 200), true, 'the N1 close waits for the USER turn row');
      await q('COMMIT');
      await owner();
      const r = await b;
      const waited = Date.now() - started;
      await q2('COMMIT');
      assert.deepEqual([h.outcome, r.outcome, r.closed_call_turn_index], ['COMMITTED', 'COMMITTED', t.idx]);
      assert.ok(waited < 5000, `bounded by the half transaction: ${waited} ms`);
      assert.deepEqual((await queueOf(x.session)).map((i) => [i.idx, i.half, i.state]),
        [[t.idx, 'USER', 'COMPLETE'], [t.idx, 'ASSISTANT', 'PENDING'], [t.idx + 1, 'USER', 'PENDING']]);
    });

    await report.section('TRC-3 the call\'s end holds the call; the next turn waits and is FENCED: one close, one reply half, one event', async () => {
      const x = await fresh();
      const t = await spokenTurn(x);
      await audio(x, 'USER', x.end.USER + 1000);
      await owner();
      const e = await sr(q, 'SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, 'USER_ENDED']);
      const b = sr(q2, COMMIT_SQL, commitArgs(x, { start: x.end.USER - 1000 }));
      assert.equal(await rt.stillPending(b), true);
      await q('COMMIT');
      await owner();
      const r = await b;
      await q2('COMMIT');
      assert.deepEqual([e.outcome, r.outcome], ['ENDED', 'FENCED']);
      assert.equal((await exchange(x, t.idx)).close_reason, 'CALL_ENDING');
      assert.equal(await outboxCount(t.turn), 1);
      assert.equal((await queueOf(x.session)).filter((i) => i.half === 'ASSISTANT').length, 1);
    });

    await report.section('TRC-4 the natural close holds the exchange; the call\'s end waits, finds it closed and closes nothing twice', async () => {
      const x = await fresh();
      const t = await spokenTurn(x);
      assert.equal(await segment(x, t.idx, 0, 'تمام.', 0, 400), 'REGISTERED');
      assert.equal(await finish(x, t.idx, 'COMPLETE', 400), 'FINISHED');
      await owner();
      const c = await sr(q, 'SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, $3, $4, $5, $6, $7)', [x.user, x.call, x.epoch, t.idx, 'PLAYED_OUT', randomUUID(), randomUUID()]);
      const e = sr(q2, 'SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, 'USER_ENDED']);
      assert.equal(await rt.stillPending(e), true);
      await q('COMMIT');
      await owner();
      const r = await e;
      await q2('COMMIT');
      assert.deepEqual([c.outcome, r.outcome, (await exchange(x, t.idx)).close_reason], ['CLOSED', 'ENDED', 'PLAYED_OUT']);
      assert.equal(await outboxCount(t.turn), 1);
    });

    await report.section('TRC-5 two instances acquire the last permit: the global serialization grants exactly one', async () => {
      await setPermits(1, 1, 0, 1);
      const x = await fresh();
      const y = await fresh();
      await owner();
      const a = await sr(q, 'SELECT * FROM public.server_acquire_background_permit_v1($1, $2, $3, $4)', [x.user, 'TEXT_SEMANTIC_ANALYSIS', randomUUID(), false]);
      const b = sr(q2, 'SELECT * FROM public.server_acquire_background_permit_v1($1, $2, $3, $4)', [y.user, 'TEXT_SEMANTIC_ANALYSIS', randomUUID(), false]);
      assert.equal(await rt.stillPending(b), true, 'serialized by the permit lock');
      await q('COMMIT');
      await owner();
      const r = await b;
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['GRANTED', 'WAIT_CAPACITY']);
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await closeSecondary();
    await removeRaceFixtures(calls, gate, policy, permits);
  }
}

// The TRC fixtures are committed, and in CI the next steps share this database: every fixture call ends, every fixture
// person is erased through the account erasure itself (which removes every row the races wrote, the semantic chain
// included), the deletion records and the people go, and the gate and both policies return to the state they had.
async function removeRaceFixtures(calls, gate, policy, permits) {
  await owner();
  const humans = [...new Set(calls.map((x) => x.user))];
  for (const x of calls) {
    const ended = await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, 'USER_ENDED']);
    assert.ok(['ENDED', 'ALREADY_ENDED'].includes(ended.outcome), ended.outcome);
  }
  await q('DELETE FROM voice_private.background_provider_permits WHERE user_id = ANY($1::uuid[])', [humans]);
  // The account erasure queues the fixtures' segment keys for physical erasure (0183 erase_voice_v1), and those keys are
  // never in any store. The queue keys on storage_key, so nothing below reaches them: left behind, they come due and take
  // places in the media erasure worker's oldest-first claim of a later suite (S8B-05 CP3 R2, the S6-06 proof's P04).
  const mediaKeys = (await rows(`SELECT o.storage_key FROM voice_private.recording_objects o JOIN voice_private.recordings r ON r.id = o.recording_id
      WHERE r.user_id = ANY($1::uuid[])`, [humans])).map((row) => row.storage_key);
  for (const user of humans) {
    const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
    assert.equal((await one('SELECT public.server_erase_account_v1($1) AS outcome', [del.id])).outcome, 'ERASED');
  }
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [mediaKeys]);
    await q('DELETE FROM account_erasure_private.media_pending WHERE storage_key = ANY($1::text[])', [mediaKeys]);
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [humans]);
    if (gate) {
      await q(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
                 restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await q('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2', [gate.capability_scope, gate.restriction_version]);
    }
    if (policy) {
      await q(`UPDATE voice_private.live_call_policy SET realtime_session_capacity = $1, reconnect_grace_seconds = $2, connect_timeout_seconds = $3,
                 seat_lease_seconds = $4, max_call_seconds = $5, policy_version = $6, decided_by = $7, policy_basis = $8, decided_at = $9`,
      [policy.realtime_session_capacity, policy.reconnect_grace_seconds, policy.connect_timeout_seconds, policy.seat_lease_seconds,
        policy.max_call_seconds, policy.policy_version, policy.decided_by, policy.policy_basis, policy.decided_at]);
    }
    if (permits) {
      await q(`UPDATE voice_private.background_permit_policy SET total_permits = $1, minimum_permits = $2, live_generation_weight = $3,
                 per_user_permits = $4, lease_seconds = $5, policy_version = $6, decided_by = $7, policy_basis = $8, decided_at = $9`,
      [permits.total_permits, permits.minimum_permits, permits.live_generation_weight, permits.per_user_permits, permits.lease_seconds,
        permits.policy_version, permits.decided_by, permits.policy_basis, permits.decided_at]);
    }
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeFixtureHumans(humans);
  const [left] = await rows(`SELECT (SELECT count(*) FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]))::int AS queue,
      (SELECT count(*) FROM account_erasure_private.media_pending WHERE storage_key = ANY($1::text[]))::int AS pending`, [mediaKeys]);
  assert.deepEqual([left.queue, left.pending], [0, 0], `the race fixtures left erasure keys behind: ${JSON.stringify(left)}`);
}

runVerifier('0191', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0191', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('races');
  await verifyRaces(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
