// Real-PostgreSQL verifier for migration 0189 (S8B-05 CP1: the live call authority, the shared realtime capacity and the
// call-recording corrections CA-05-04; Integrated Live Call Contract v1.2 FINAL). No provider is called; every scenario but
// LRC runs in one transaction that is rolled back.
//
//   L0   catalogue: the two relations postgres-owned, RLS on, no policy, no grant; calls ACCOUNT_CASCADE with cascading
//        account and session keys; recordings.call_id references calls; the NOT_SPEAKING gap (QANDEEL only); every new or
//        replaced definer service_role only, the ten internals no role's; the policy row (capacity 2, grace 30 s,
//        60-minute call); four scopes DISABLED; the census clean
//   L1   begin: the person's own ACTIVE text session, the PERSONAL_LIVE_CALL gate, the CURRENT consent; idempotent per call
//        id; another human's call id is a conflict; refusals write nothing
//   L2   one non-ENDED call per person across devices (D-05-01), also against a raw insert; a new call after the end
//   L3   activate: started_at written once with the recording opened in the same transaction (retention started_at +
//        30 days); only the current epoch; the replay answers the same started_at; the guard keeps started_at, identity and
//        ENDED final; a CONNECTING call past its deadline ends FAILED without a recording
//   L4   the recording open is the authority's: never for an unknown, foreign, CONNECTING or ENDED call; a sealed recording
//        is RECORDING_CLOSED, never OPENED; a mismatch is COMMAND_CONFLICT; a raw recording needs its call row
//   L5   heartbeat: renews the seat and, explicitly, the recording's writer lease; FENCED for an older epoch; SERVER_ENDED
//        past the maximum length
//   L6   suspend / resume: RECONNECTING keeps the call, its seat and its recording (neither the recovery nor the writer's
//        seal closes it); a resume moves the epoch on and fences every older connection; another device is refused; after
//        the grace the call ends PEER_LOST_AFTER_GRACE and is never resumed into a new call
//   L7   end: once; the connection's reasons only; the recording sealed WRITER; the seat released
//   L8   sweep: the truthful reason for each lapse, the recording sealed RECOVERY; a held call is untouched
//   L9   capacity: N accepted, N+1 CAPACITY_FULL; a live voice note shares it (REALTIME_CAPACITY_FULL, its transaction
//        rolled back: no ledger row); a reconnecting call keeps its seat; a lapsed seat is not counted; the end releases
//   L10  call_turn_index: increasing per call, only for the current epoch of an ACTIVE call
//   L11  NOT_SPEAKING: the QANDEEL track's gap, refused on the USER track by the definer and by the table
//   L12  a live call's turn anchor lies inside its track's recorded or gapped range; where the tracks stand (for a resume)
//   L13  call-truth: ACTIVE while held, NO_CALL_KNOWN otherwise (fails safe on a lapsed, unswept call); per person
//   L14  the call record is durable; account erasure removes the call and its recording
//   L15  the writer fence (PR #374 review): a segment or gap only for the current epoch of an ACTIVE call; the epoch-less
//        0183 entries FENCED for a call not ENDED; an older epoch, a RECONNECTING call: FENCED, nothing written; a segment
//        admitted before the resume completes (its store is epoch-free) and counts in the resumed tracks; one never
//        uploaded is a WRITER_LOSS gap at the end, never silence; ENDED / foreign: UNAVAILABLE
//   LRC  races on two connections: two begins of one person, two people for the last seat, end vs sweep vs resume, two ends,
//        an old epoch's late admission vs a resume, in both orders (one truth, the tracks never interleaved)
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { VOICE_CONSENT_V3 } from './qandeel-voice-0188-anchor.mjs';
import { voiceInternals0189 } from './live-call-0189-anchor.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const rejected = (operation, codes) => rt.rejected(operation, codes);

const RELATIONS = ['voice_private.live_call_policy', 'voice_private.calls'];
const DEFINERS = [
  'public.server_begin_call_v1(uuid,uuid,uuid,uuid)',
  'public.server_activate_call_v1(uuid,uuid,bigint)',
  'public.server_heartbeat_call_v1(uuid,uuid,bigint)',
  'public.server_suspend_call_v1(uuid,uuid,bigint)',
  'public.server_resume_call_v1(uuid,uuid,uuid)',
  'public.server_end_call_v1(uuid,uuid,bigint,text)',
  'public.server_sweep_calls_v1(integer)',
  'public.server_read_call_truth_v1(uuid)',
  'public.server_read_call_tracks_v1(uuid,uuid)',
  'public.server_open_call_recording_v1(uuid,uuid,uuid,timestamptz,integer)',
  'public.server_add_call_segment_v1(uuid,uuid,text,integer,bigint,bigint,bigint,integer)',
  'public.server_add_call_segment_v2(uuid,uuid,bigint,text,integer,bigint,bigint,bigint,integer)',
  'public.server_record_call_gap_v1(uuid,uuid,text,bigint,bigint,text)',
  'public.server_record_call_gap_v2(uuid,uuid,bigint,text,bigint,bigint,text)',
  'public.server_seal_call_recording_v1(uuid,uuid)',
  'public.server_recover_stale_call_recordings_v1(integer,integer)',
  'public.server_attach_turn_voice_source_v1(uuid,uuid,uuid,text,text,text,bigint,bigint,boolean,text)',
];
const INTERNAL = voiceInternals0189();
const LIVE = 'PERSONAL_LIVE_CALL';
const NOTE = 'PERSONAL_VOICE_NOTE';
const RT_MODEL = 'speechmatics-rt-enhanced';

// ------------------------------------------------------------------ helpers
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
async function human() {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  return id;
}
async function newSession(user, status = 'ACTIVE', channel = 'TEXT') {
  const id = randomUUID();
  await owner();
  await q('INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, $3, $4)', [id, user, status, channel]);
  return id;
}
async function setGate(scope = LIVE, flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  await rows("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'verify-0189', 'real-PostgreSQL proof')",
    [scope, flag, requirements]);
}
const grant = async (user) =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), VOICE_CONSENT_V3])).outcome;
const revoke = async (user) => (await one('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()])).outcome;
async function ready() {
  const user = await human();
  const session = await newSession(user);
  await setGate();
  assert.equal(await grant(user), 'GRANTED');
  return { user, session, client: randomUUID() };
}
const begin = async (user, session, client, call = randomUUID()) =>
  ({ call, ...(await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, client])) });
const activate = (user, call, epoch = 1) => one('SELECT * FROM public.server_activate_call_v1($1, $2, $3)', [user, call, epoch]);
const heartbeat = (user, call, epoch = 1) => one('SELECT * FROM public.server_heartbeat_call_v1($1, $2, $3)', [user, call, epoch]);
const suspend = (user, call, epoch = 1) => one('SELECT * FROM public.server_suspend_call_v1($1, $2, $3)', [user, call, epoch]);
const resume = (user, call, client) => one('SELECT * FROM public.server_resume_call_v1($1, $2, $3)', [user, call, client]);
const end = (user, call, epoch, reason = 'USER_ENDED') => one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [user, call, epoch, reason]);
const sweep = async (limit = 200) => (await one('SELECT * FROM public.server_sweep_calls_v1($1)', [limit])).ended;
const truth = (user) => one('SELECT * FROM public.server_read_call_truth_v1($1)', [user]);
const recover = async (grace = 0) => (await one('SELECT * FROM public.server_recover_stale_call_recordings_v1(200, $1)', [grace])).recovered;
const callRow = async (call) => (await rows('SELECT * FROM voice_private.calls WHERE id = $1', [call]))[0];
const recordingOf = async (call) => (await rows('SELECT * FROM voice_private.recordings WHERE call_id = $1', [call]))[0];
const seatsInUse = async () => { await owner(); return (await rows('SELECT voice_private.realtime_seats_in_use_v1() AS n'))[0].n; };
async function setCapacity(capacity) {
  await owner();
  await rows(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'verify-0189', 'real-PostgreSQL proof') FROM voice_private.live_call_policy p`, [capacity]);
}
/** A call begun and activated: { user, session, client, call, recording, started }. */
async function activeCall(ctx = null) {
  const c = ctx ?? await ready();
  const b = await begin(c.user, c.session, c.client);
  assert.equal(b.outcome, 'BEGUN');
  const a = await activate(c.user, b.call);
  assert.equal(a.outcome, 'ACTIVE');
  return { ...c, call: b.call, recording: a.recording_id, started: a.started_at };
}
/**
 * Moves a call's or a recording's instants into the past, as if time had passed. Under the replica replication role (no
 * trigger runs): the transition guard keeps connect_deadline and started_at immutable on purpose, and this stands in for a
 * clock, not for a transition.
 */
async function age(table, id, assignments) {
  await owner();
  await q("SET LOCAL session_replication_role = 'replica'");
  try {
    await q(`UPDATE ${table} SET ${assignments} WHERE id = $1`, [id]);
  } finally {
    await q("SET LOCAL session_replication_role = 'origin'");
  }
}
const lapse = (call, assignments) => age('voice_private.calls', call, assignments);
async function turn(user, session, role) {
  const id = randomUUID();
  await owner();
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, completed_at)
           VALUES ($1, $2, $3, $4, 'COMPLETED', 'x', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', clock_timestamp())`, [id, session, user, role]);
  return id;
}
/** A USER turn's source is machine ASR; an ASSISTANT turn's is QANDEEL's spoken reply (0183's role shapes). */
const attach = (user, turnId, recording, start, endMs, role = 'USER') => (role === 'USER'
  ? one(`SELECT * FROM public.server_attach_turn_voice_source_v1($1, $2, $3, 'LIVE_CALL_SPEECH', 'MACHINE_ASR', 'HIGH', $4, $5, NULL, NULL)`,
    [user, turnId, recording, start, endMs])
  : one(`SELECT * FROM public.server_attach_turn_voice_source_v1($1, $2, $3, 'LIVE_CALL_SPEECH', NULL, NULL, $4, $5, true, 'COMPLETE')`,
    [user, turnId, recording, start, endMs]));
/** The live call's writes: the fenced entries (0189), with the writing connection's epoch. */
const addSegment = async (user, recording, track, index, start, endMs, epoch = 1) =>
  (await one('SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)', [user, recording, epoch, track, index, start, endMs])).outcome;
const gap = async (user, recording, track, start, endMs, kind, epoch = 1) =>
  (await one('SELECT * FROM public.server_record_call_gap_v2($1, $2, $3, $4, $5, $6, $7)', [user, recording, epoch, track, start, endMs, kind])).outcome;
const storeSegment = async (user, recording, track, index) =>
  (await one('SELECT * FROM public.server_store_call_segment_v1($1, $2, $3, $4, 4096)', [user, recording, track, index])).outcome;
/** 0183's epoch-less entries. */
const addSegmentV1 = async (user, recording, track, index, start, endMs) =>
  (await one('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, 4096, 20)', [user, recording, track, index, start, endMs])).outcome;
const gapV1 = async (user, recording, track, start, endMs, kind) =>
  (await one('SELECT * FROM public.server_record_call_gap_v1($1, $2, $3, $4, $5, $6)', [user, recording, track, start, endMs, kind])).outcome;
const writes = async (recording) => {
  await owner();
  return (await rows(`SELECT (SELECT count(*)::int FROM voice_private.recording_objects WHERE recording_id = $1) AS objects,
      (SELECT count(*)::int FROM voice_private.recording_gaps WHERE recording_id = $1) AS gaps`, [recording]))[0];
};
/** One track's pieces in clock order: each starts where the previous ended (never interleaved, never overlapping). */
async function assertContiguous(recording, track) {
  await owner();
  const pieces = await rows(`SELECT clock_start_ms::bigint AS s, clock_end_ms::bigint AS e, kind FROM (
      SELECT clock_start_ms, clock_end_ms, 'SEGMENT:' || object_state AS kind FROM voice_private.recording_objects
       WHERE recording_id = $1 AND track = $2 AND object_state <> 'DISCARDED'
      UNION ALL SELECT clock_start_ms, clock_end_ms, gap_kind FROM voice_private.recording_gaps WHERE recording_id = $1 AND track = $2) x
      ORDER BY clock_start_ms, clock_end_ms`, [recording, track]);
  let at = 0;
  for (const piece of pieces) {
    assert.equal(Number(piece.s), at, `${track} track: ${piece.kind} starts where the previous piece ended`);
    at = Number(piece.e);
  }
  return pieces.map((x) => `${x.kind} ${x.s}-${x.e}`);
}
const ledgerRows = async (user) => (await rows('SELECT count(*)::int AS n FROM public.ai_provider_calls WHERE user_id = $1', [user]))[0].n;

// ------------------------------------------------------------------ L0 catalogue
async function verifyCatalogue(report) {
  await report.section('L0a the two relations: postgres-owned, RLS on, no policy, no client grant; calls ACCOUNT_CASCADE with cascading keys; recordings reference calls; NOT_SPEAKING on QANDEEL only', async () => {
    for (const relation of RELATIONS) {
      const [p] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
          (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema || '.' || g.table_name = $1
              AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) AS grants
          FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(p, { owner: 'postgres', rls: true, policies: 0, grants: 0 }, relation);
    }
    const [{ coverage }] = await rows("SELECT coverage FROM account_erasure_private.coverage_registry WHERE relation = 'voice_private.calls'");
    assert.equal(coverage, 'ACCOUNT_CASCADE');
    const fks = await rows(`SELECT confrelid::regclass::text AS target, confdeltype AS del FROM pg_constraint
        WHERE conrelid = 'voice_private.calls'::regclass AND contype = 'f' ORDER BY 1`);
    assert.deepEqual(fks, [{ target: 'conversation_sessions', del: 'c' }, { target: 'users', del: 'c' }]);
    const [callFk] = await rows(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'voice_private.recordings'::regclass AND conname = 'recordings_call_fk'`);
    assert.match(callFk.def, /FOREIGN KEY \(call_id\) REFERENCES voice_private\.calls\(id\)$/u);
    const [kind] = await rows(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'voice_private.recording_gaps'::regclass AND conname = 'recording_gaps_kind_check'`);
    assert.match(kind.def, /NOT_SPEAKING/u);
    const [{ unique }] = await rows("SELECT indexdef AS unique FROM pg_indexes WHERE schemaname = 'voice_private' AND indexname = 'calls_one_open_idx'");
    assert.match(unique, /UNIQUE INDEX .* \(user_id\) WHERE \(state <> 'ENDED'::text\)/u);
  });
  await report.section('L0b every new or replaced definer postgres-owned, pinned search_path, service_role only; the ten internals no role', async () => {
    assert.equal(INTERNAL.length, 10);
    for (const fn of [...DEFINERS, ...INTERNAL]) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', fn);
      assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
      assert.equal(p.anon || p.auth, false, `${fn}: no client role`);
      assert.equal(p.service, DEFINERS.includes(fn), `${fn}: service_role ${DEFINERS.includes(fn) ? 'only' : 'never'}`);
    }
  });
  await report.section('L0c the controlled policy (capacity 2 = the evaluation account, grace 30 s, 60-minute call); four scopes DISABLED / UNSATISFIED; the census clean', async () => {
    const [p] = await rows('SELECT * FROM voice_private.live_call_policy');
    assert.deepEqual([p.realtime_session_capacity, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds, p.max_call_seconds],
      [2, 30, 15, 20, 3600]);
    const scopes = await rows('SELECT feature_flag_state AS f, launch_requirements_state AS r FROM voice_private.voice_launch_capability_states');
    assert.equal(scopes.length, 4);
    assert.ok(scopes.every((s) => s.f === 'DISABLED' && s.r === 'UNSATISFIED'));
    const census = await rows(`SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c WHERE c.contype = 'f'
        AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
        AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)`);
    assert.deepEqual(census, []);
  });
}

// ------------------------------------------------------------------ behaviour (one rolled-back transaction)
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('L1 begin: own ACTIVE text session, the PERSONAL_LIVE_CALL gate, the CURRENT consent; idempotent per call id; refusals write nothing', async () => {
      const user = await human();
      const session = await newSession(user);
      const client = randomUUID();
      await setGate(LIVE, 'DISABLED', 'UNSATISFIED');
      assert.equal((await begin(user, session, client)).outcome, 'NOT_AVAILABLE_NOW', 'the gate is closed');
      await setGate();
      assert.equal((await begin(user, session, client)).outcome, 'CONSENT_REQUIRED', 'no consent');
      assert.equal(await grant(user), 'GRANTED');
      assert.equal((await begin(user, randomUUID(), client)).outcome, 'NOT_FOUND', 'unknown session');
      const stranger = await ready();
      assert.equal((await begin(user, stranger.session, client)).outcome, 'NOT_FOUND', 'another human\'s session');
      assert.equal((await begin(user, await newSession(user, 'CLOSED'), client)).outcome, 'SESSION_NOT_ACTIVE');
      assert.equal((await begin(user, await newSession(user, 'ACTIVE', 'VOICE'), client)).outcome, 'SESSION_NOT_ACTIVE', 'the call lives in the text session');
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.calls WHERE user_id = $1', [user]))[0].n, 0, 'refusals write nothing');
      const b = await begin(user, session, client);
      assert.deepEqual([b.outcome, b.call_state, Number(b.connection_epoch)], ['BEGUN', 'CONNECTING', 1]);
      const replay = await begin(user, session, client, b.call);
      assert.deepEqual([replay.outcome, Number(replay.connection_epoch)], ['BEGUN', 1], 'the same begin again');
      assert.equal((await begin(user, session, randomUUID(), b.call)).outcome, 'COMMAND_CONFLICT', 'another client instance');
      assert.equal((await begin(stranger.user, stranger.session, stranger.client, b.call)).outcome, 'COMMAND_CONFLICT', 'another human, same call id');
      const row = await callRow(b.call);
      assert.deepEqual([row.user_id, row.session_id, row.state, row.started_at, row.next_call_turn_index], [user, session, 'CONNECTING', null, 1]);
      assert.equal(await recordingOf(b.call), undefined, 'no recording before ACTIVE');
      await rejected(() => server('SELECT * FROM public.server_begin_call_v1($1, $2, NULL, $3)', [user, session, client]), ['22023']);
    });

    await report.isolated('L2 one non-ENDED call per person across devices and sessions (D-05-01), also against a raw insert; a new call after the end', async () => {
      const c = await ready();
      const first = await begin(c.user, c.session, c.client);
      assert.equal(first.outcome, 'BEGUN');
      assert.equal((await begin(c.user, c.session, randomUUID())).outcome, 'ALREADY_IN_CALL', 'a second device');
      assert.equal((await begin(c.user, await newSession(c.user), c.client)).outcome, 'ALREADY_IN_CALL', 'another session');
      await owner();
      await rejected(() => q(`INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, connect_deadline, seat_lease_until)
          VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), 'CONNECTING', 1, clock_timestamp() + interval '1 minute', clock_timestamp() + interval '1 minute')`,
      [c.user, c.session]), ['23505']);
      assert.equal((await activate(c.user, first.call)).outcome, 'ACTIVE');
      assert.equal((await end(c.user, first.call, 1)).outcome, 'ENDED');
      assert.equal((await begin(c.user, c.session, c.client)).outcome, 'BEGUN', 'a new call after the end');
    });

    await report.isolated('L3 activate: started_at once + the recording in the same transaction; only the current epoch; replay; guard; a late CONNECTING call ends FAILED', async () => {
      const c = await ready();
      const b = await begin(c.user, c.session, c.client);
      assert.equal((await activate(c.user, b.call, 2)).outcome, 'FENCED', 'an epoch the call never had');
      assert.equal((await activate(randomUUID(), b.call)).outcome, 'NOT_FOUND', 'another human');
      const a = await activate(c.user, b.call);
      assert.equal(a.outcome, 'ACTIVE');
      const row = await callRow(b.call);
      const rec = await recordingOf(b.call);
      assert.equal(row.started_at.getTime(), a.started_at.getTime());
      assert.deepEqual([rec.id, rec.recording_kind, rec.recording_state, rec.session_id], [a.recording_id, 'LIVE_CALL', 'RECORDING', c.session]);
      assert.equal(rec.started_at.getTime(), row.started_at.getTime(), 'the recording starts where the call starts');
      assert.equal(rec.retention_expires_at.getTime() - rec.started_at.getTime(), 30 * 86400000, 'retention started_at + 30 days');
      const replay = await activate(c.user, b.call);
      assert.deepEqual([replay.outcome, replay.started_at.getTime(), replay.recording_id], ['ACTIVE', a.started_at.getTime(), a.recording_id]);
      await owner();
      await rejected(() => q("UPDATE voice_private.calls SET started_at = clock_timestamp() WHERE id = $1", [b.call]), ['55000']);
      await rejected(() => q('UPDATE voice_private.calls SET session_id = $2 WHERE id = $1', [b.call, randomUUID()]), ['55000', '23503']);
      await rejected(() => q("UPDATE voice_private.calls SET state = 'CONNECTING', started_at = NULL WHERE id = $1", [b.call]), ['55000', '23514']);
      await rejected(() => q('UPDATE voice_private.calls SET connection_epoch = 0 WHERE id = $1', [b.call]), ['55000', '23514']);
      const spare = await newSession(c.user);
      await rejected(() => q(`INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, connect_deadline,
          seat_lease_until, started_at) VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), 'ACTIVE', 1, clock_timestamp() + interval '1 minute',
          clock_timestamp() + interval '1 minute', clock_timestamp())`, [c.user, spare]), ['55000', '23505']);
      assert.equal((await end(c.user, b.call, 1)).outcome, 'ENDED');
      await rejected(() => q("UPDATE voice_private.calls SET state = 'ACTIVE', end_reason = NULL, ended_at = NULL, seat_lease_until = clock_timestamp() WHERE id = $1", [b.call]), ['55000']);
      assert.equal((await activate(c.user, b.call)).outcome, 'ENDED');
      // A call that did not become ACTIVE before its deadline ends FAILED, with no recording.
      const late = await begin(c.user, c.session, c.client);
      await lapse(late.call, "created_at = clock_timestamp() - interval '2 minutes', connect_deadline = clock_timestamp() - interval '1 minute'");
      assert.equal((await activate(c.user, late.call)).outcome, 'ENDED');
      const lateRow = await callRow(late.call);
      assert.deepEqual([lateRow.state, lateRow.end_reason, lateRow.started_at], ['ENDED', 'FAILED', null]);
      assert.equal(await recordingOf(late.call), undefined);
      // The gate closed between begin and activate: nothing opens, the call stays CONNECTING (it times out on its own).
      const gated = await begin(c.user, c.session, c.client);
      await setGate(LIVE, 'DISABLED', 'UNSATISFIED');
      assert.equal((await activate(c.user, gated.call)).outcome, 'NOT_AVAILABLE_NOW');
      await setGate();
      assert.equal(await revoke(c.user), 'WITHDRAWN');
      assert.equal((await activate(c.user, gated.call)).outcome, 'CONSENT_REQUIRED');
      assert.deepEqual([(await callRow(gated.call)).state, await recordingOf(gated.call)], ['CONNECTING', undefined]);
    });

    await report.isolated('L4 the recording open is the authority\'s: unknown / foreign / CONNECTING / ENDED calls get none; RECORDING_CLOSED after the seal; COMMAND_CONFLICT on a mismatch; a raw recording needs its call', async () => {
      const c = await ready();
      const openRec = (user, session, call, started) =>
        one('SELECT * FROM public.server_open_call_recording_v1($1, $2, $3, $4, 20)', [user, session, call, started]);
      const now = new Date(Date.now() - 1000);
      assert.equal((await openRec(c.user, c.session, randomUUID(), now)).outcome, 'UNAVAILABLE', 'no call row');
      const b = await begin(c.user, c.session, c.client);
      assert.equal((await openRec(c.user, c.session, b.call, now)).outcome, 'UNAVAILABLE', 'a CONNECTING call');
      const stranger = await ready();
      assert.equal((await openRec(stranger.user, stranger.session, b.call, now)).outcome, 'UNAVAILABLE', 'another human\'s call');
      const a = await activate(c.user, b.call);
      // The call's own started_at, at the database's precision (a JS Date keeps milliseconds only).
      const [{ started }] = await rows('SELECT started_at::text AS started FROM voice_private.calls WHERE id = $1', [b.call]);
      const same = await openRec(c.user, c.session, b.call, started);
      assert.deepEqual([same.outcome, same.recording_id], ['OPENED', a.recording_id], 'the replay while RECORDING');
      assert.equal((await openRec(c.user, c.session, b.call, now)).outcome, 'COMMAND_CONFLICT', 'another started_at');
      assert.equal((await openRec(c.user, await newSession(c.user), b.call, started)).outcome, 'COMMAND_CONFLICT', 'another session');
      assert.equal((await end(c.user, b.call, 1)).outcome, 'ENDED');
      assert.equal((await recordingOf(b.call)).recording_state, 'STORED', 'the end sealed it');
      assert.equal((await openRec(c.user, c.session, b.call, started)).outcome, 'RECORDING_CLOSED', 'a sealed recording is never OPENED again');
      await owner();
      // One instant for the anchor and its expiry (statement_timestamp() is fixed within the statement): two
      // clock_timestamp() calls may differ by a microsecond, and recordings_retention_check (expiry = anchor + 30 days)
      // would then refuse the row (23514) before the missing call could (S8B-05 CP3 R2, API CI run 41610402755).
      await rejected(() => q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
          recording_state, writer_lease_until) VALUES (gen_random_uuid(), $1, $2, 'LIVE_CALL', gen_random_uuid(), statement_timestamp(),
          statement_timestamp() + interval '30 days', 'RECORDING', clock_timestamp() + interval '20 seconds')`, [c.user, c.session]), ['23503']);
    });

    await report.isolated('L5 heartbeat renews the seat and the recording\'s writer lease explicitly; FENCED for an older epoch; SERVER_ENDED past the maximum length', async () => {
      const x = await activeCall();
      await lapse(x.call, "seat_lease_until = clock_timestamp() + interval '1 second'");
      await age('voice_private.recordings', x.recording, "writer_lease_until = clock_timestamp() + interval '1 second'");
      const h = await heartbeat(x.user, x.call);
      assert.deepEqual([h.outcome, h.call_state], ['ALIVE', 'ACTIVE']);
      assert.equal(h.ends_at.getTime() - x.started.getTime(), 3600 * 1000, 'ALIVE names when the server ends it: started_at + the policy maximum');
      const row = await callRow(x.call);
      const rec = await recordingOf(x.call);
      assert.ok(row.seat_lease_until.getTime() > Date.now() + 15000, 'the seat lease moved on');
      assert.ok(rec.writer_lease_until.getTime() > Date.now() + 15000, 'the writer lease moved on with it (no segment needed)');
      assert.equal((await heartbeat(x.user, x.call, 7)).outcome, 'FENCED');
      assert.equal((await heartbeat(randomUUID(), x.call)).outcome, 'NOT_FOUND');
      await lapse(x.call, "started_at = clock_timestamp() - interval '61 minutes'");
      const over = await heartbeat(x.user, x.call);
      assert.deepEqual([over.outcome, over.call_state], ['ENDED', 'SERVER_ENDED']);
      assert.deepEqual([(await callRow(x.call)).end_reason, (await recordingOf(x.call)).recording_state], ['SERVER_ENDED', 'STORED']);
    });

    await report.isolated('L6 suspend / resume: RECONNECTING keeps call, seat and recording; the resume fences every older connection; another device refused; after the grace PEER_LOST_AFTER_GRACE, never a new call', async () => {
      const x = await activeCall();
      const s = await suspend(x.user, x.call);
      assert.equal(s.outcome, 'SUSPENDED');
      const row = await callRow(x.call);
      assert.equal(row.state, 'RECONNECTING');
      assert.ok(Math.abs(row.grace_until.getTime() - Date.now() - 30000) < 5000, 'grace 30 s');
      assert.equal((await suspend(x.user, x.call)).outcome, 'SUSPENDED', 'idempotent');
      assert.equal((await heartbeat(x.user, x.call)).outcome, 'RECONNECTING');
      // Neither the recovery (even with the writer lease long lapsed) nor the writer's own seal closes it inside the grace.
      await age('voice_private.recordings', x.recording, "writer_lease_until = clock_timestamp() - interval '1 hour'");
      assert.equal(await recover(0), 0);
      assert.equal((await one('SELECT * FROM public.server_seal_call_recording_v1($1, $2)', [x.user, x.recording])).outcome, 'CALL_LIVE');
      assert.equal((await recordingOf(x.call)).recording_state, 'RECORDING');
      assert.equal((await resume(x.user, x.call, randomUUID())).outcome, 'OTHER_DEVICE', 'D-05-01: no transfer between devices');
      const r = await resume(x.user, x.call, x.client);
      assert.deepEqual([r.outcome, r.call_state, Number(r.connection_epoch), r.recording_id], ['RESUMED', 'ACTIVE', 2, x.recording]);
      assert.equal(r.started_at.getTime(), x.started.getTime(), 'started_at never reset');
      assert.ok((await recordingOf(x.call)).writer_lease_until.getTime() > Date.now(), 'the resume renewed the writer lease');
      // The older connection is fenced: it can neither heartbeat, suspend, end nor reserve a turn.
      assert.equal((await heartbeat(x.user, x.call, 1)).outcome, 'FENCED');
      assert.equal((await suspend(x.user, x.call, 1)).outcome, 'FENCED');
      assert.equal((await end(x.user, x.call, 1)).outcome, 'FENCED');
      assert.equal((await callRow(x.call)).state, 'ACTIVE', 'the fenced suspend changed nothing');
      // A resume of an ACTIVE call (the server lost the socket first) also fences the connection before it.
      assert.equal(Number((await resume(x.user, x.call, x.client)).connection_epoch), 3);
      assert.equal((await heartbeat(x.user, x.call, 2)).outcome, 'FENCED');
      // After the grace the call ends; a resume never becomes a new call.
      assert.equal((await suspend(x.user, x.call, 3)).outcome, 'SUSPENDED');
      await lapse(x.call, "grace_until = clock_timestamp() - interval '1 second', seat_lease_until = clock_timestamp() - interval '1 second'");
      const late = await resume(x.user, x.call, x.client);
      assert.deepEqual([late.outcome, late.call_state], ['ENDED', 'PEER_LOST_AFTER_GRACE']);
      const rec = await recordingOf(x.call);
      assert.deepEqual([rec.recording_state, rec.sealed_by], ['STORED', 'RECOVERY']);
      assert.deepEqual([(await resume(x.user, x.call, x.client)).outcome], ['ENDED']);
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.calls WHERE user_id = $1', [x.user]))[0].n, 1, 'no call was created');
      // A call lost before it was ever ACTIVE ends FAILED.
      const b = await begin(x.user, x.session, x.client);
      assert.equal((await suspend(x.user, b.call)).outcome, 'ENDED');
      assert.equal((await callRow(b.call)).end_reason, 'FAILED');
    });

    await report.isolated('L7 end: once; the connection\'s reasons only; the recording sealed WRITER; the seat released', async () => {
      const x = await activeCall();
      const before = await seatsInUse();
      await rejected(() => end(x.user, x.call, 1, 'PEER_LOST_AFTER_GRACE'), ['22023']);
      await rejected(() => end(x.user, x.call, 1, 'SYSTEM_INTERRUPTED'), ['22023']);
      const e = await end(x.user, x.call, 1);
      assert.deepEqual([e.outcome, e.end_reason], ['ENDED', 'USER_ENDED']);
      const row = await callRow(x.call);
      assert.deepEqual([row.state, row.end_reason, row.seat_lease_until, row.grace_until], ['ENDED', 'USER_ENDED', null, null]);
      assert.ok(row.ended_at instanceof Date);
      const rec = await recordingOf(x.call);
      assert.deepEqual([rec.recording_state, rec.sealed_by], ['STORED', 'WRITER']);
      assert.equal(await seatsInUse(), before - 1, 'the seat is released');
      const again = await end(x.user, x.call, 1, 'SERVER_ENDED');
      assert.deepEqual([again.outcome, again.end_reason], ['ALREADY_ENDED', 'USER_ENDED'], 'a call ends once');
      assert.equal(await sweep(), 0);
      assert.equal((await callRow(x.call)).end_reason, 'USER_ENDED');
    });

    await report.isolated('L8 sweep: FAILED / SYSTEM_INTERRUPTED / PEER_LOST_AFTER_GRACE / SERVER_ENDED, each recording sealed RECOVERY; a held call untouched', async () => {
      await setCapacity(1000);
      const connecting = await ready();
      const c1 = await begin(connecting.user, connecting.session, connecting.client);
      await lapse(c1.call, "created_at = clock_timestamp() - interval '2 minutes', connect_deadline = clock_timestamp() - interval '1 minute'");
      const crashed = await activeCall();
      await lapse(crashed.call, "seat_lease_until = clock_timestamp() - interval '31 seconds'");
      const lost = await activeCall();
      await suspend(lost.user, lost.call);
      await lapse(lost.call, "grace_until = clock_timestamp() - interval '1 second', seat_lease_until = clock_timestamp() - interval '1 second'");
      const long = await activeCall();
      await lapse(long.call, "started_at = clock_timestamp() - interval '61 minutes'");
      const held = await activeCall();
      const reconnecting = await activeCall();
      await suspend(reconnecting.user, reconnecting.call);
      // An ACTIVE call whose server stopped renewing it keeps its seat for the grace (a resume elsewhere can continue it).
      const recent = await activeCall();
      await lapse(recent.call, "seat_lease_until = clock_timestamp() - interval '5 seconds'");
      assert.ok(await sweep() >= 4);
      const reason = async (call) => (await callRow(call)).end_reason;
      assert.deepEqual([await reason(c1.call), await reason(crashed.call), await reason(lost.call), await reason(long.call)],
        ['FAILED', 'SYSTEM_INTERRUPTED', 'PEER_LOST_AFTER_GRACE', 'SERVER_ENDED']);
      for (const x of [crashed, lost, long]) {
        const rec = await recordingOf(x.call);
        assert.deepEqual([rec.recording_state, rec.sealed_by], ['STORED', 'RECOVERY'], x.call);
      }
      assert.deepEqual([(await callRow(held.call)).state, (await callRow(reconnecting.call)).state, (await callRow(recent.call)).state],
        ['ACTIVE', 'RECONNECTING', 'ACTIVE']);
      assert.equal((await recordingOf(reconnecting.call)).recording_state, 'RECORDING');
      assert.equal((await resume(recent.user, recent.call, recent.client)).outcome, 'RESUMED', 'a crashed server\'s call resumes inside the grace');
      await rejected(() => sweep(0), ['22023']);
    });

    await report.isolated('L9 capacity: N accepted, N+1 CAPACITY_FULL; a live voice note shares it; a reconnecting call keeps its seat; a lapsed seat is not counted; the end releases', async () => {
      const base = await seatsInUse();
      await setCapacity(base + 2);
      await setGate(NOTE);
      const a = await activeCall();
      const b = await ready();
      const bb = await begin(b.user, b.session, b.client);
      assert.equal(bb.outcome, 'BEGUN');
      assert.equal(await seatsInUse(), base + 2);
      const c = await ready();
      const refused = await begin(c.user, c.session, c.client);
      assert.equal(refused.outcome, 'CAPACITY_FULL', 'N+1');
      assert.equal(await callRow(refused.call), undefined, 'a refusal writes no call');
      // A live voice note takes a seat from the same capacity: refused explicitly, its whole transaction rolled back.
      // P0001 (not a PTnnn code, which PostgREST would turn into that HTTP status): the API reads the message.
      await rt.rejected(() => server('SELECT * FROM public.server_open_live_voice_note_v1($1, $2, $3, $4, $5)', [c.user, c.session, randomUUID(), randomUUID(), RT_MODEL]),
        ['P0001'], /^REALTIME_CAPACITY_FULL$/u);
      assert.equal(await ledgerRows(c.user), 0, 'no ledger row for the refused note');
      // A reconnecting call keeps its seat.
      await suspend(a.user, a.call);
      assert.equal((await begin(c.user, c.session, c.client)).outcome, 'CAPACITY_FULL', 'the grace keeps the seat');
      // A lapsed seat is not counted (no seat is held for ever): the CONNECTING call whose holder died.
      await lapse(bb.call, "seat_lease_until = clock_timestamp() - interval '1 second'");
      assert.equal(await seatsInUse(), base + 1);
      const note = await one('SELECT * FROM public.server_open_live_voice_note_v1($1, $2, $3, $4, $5)', [c.user, c.session, randomUUID(), randomUUID(), RT_MODEL]);
      assert.equal(note.outcome, 'OPENED', 'the live note takes the freed seat');
      assert.equal((await begin(c.user, await newSession(c.user), randomUUID())).outcome, 'CAPACITY_FULL', 'the note holds it');
      // The end releases a seat.
      const r = await resume(a.user, a.call, a.client);
      assert.equal((await end(a.user, a.call, Number(r.connection_epoch))).outcome, 'ENDED');
      assert.equal(await seatsInUse(), base + 1);
      const d = await ready();
      assert.equal((await begin(d.user, d.session, d.client)).outcome, 'BEGUN');
    });

    await report.isolated('L10 call_turn_index: 1, 2, 3 per call; only the current epoch of an ACTIVE call', async () => {
      const x = await activeCall();
      const reserve = async (epoch) => (await rows('SELECT voice_private.reserve_call_turn_index_v1($1, $2, $3) AS i', [x.user, x.call, epoch]))[0].i;
      await owner();
      assert.deepEqual([await reserve(1), await reserve(1), await reserve(1)], [1, 2, 3]);
      await resume(x.user, x.call, x.client);
      await owner();
      await rejected(() => reserve(1), ['55000']);
      assert.equal(await reserve(2), 4, 'the index continues across a resume');
      await suspend(x.user, x.call, 2);
      await owner();
      await rejected(() => reserve(2), ['55000']);
      await owner();
      await rejected(() => q('UPDATE voice_private.calls SET next_call_turn_index = 1 WHERE id = $1', [x.call]), ['55000']);
    });

    await report.isolated('L11 NOT_SPEAKING is the QANDEEL track\'s gap: refused on the USER track by the definer and by the table', async () => {
      const x = await activeCall();
      assert.equal(await gap(x.user, x.recording, 'QANDEEL', 0, 4000, 'NOT_SPEAKING'), 'RECORDED');
      assert.equal(await gap(x.user, x.recording, 'QANDEEL', 0, 4000, 'NOT_SPEAKING'), 'RECORDED', 'idempotent');
      assert.equal(await gap(x.user, x.recording, 'QANDEEL', 5000, 6000, 'NOT_SPEAKING'), 'DISCONTINUOUS');
      await rejected(() => gap(x.user, x.recording, 'USER', 0, 4000, 'NOT_SPEAKING'), ['22023']);
      await rejected(() => gap(x.user, x.recording, 'QANDEEL', 4000, 5000, 'WRITER_LOSS'), ['22023']);
      assert.equal(await gap(x.user, x.recording, 'USER', 0, 1500, 'MUTED'), 'RECORDED');
      await owner();
      await rejected(() => q("INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind) VALUES ($1, 'USER', 1500, 2000, 'NOT_SPEAKING')",
        [x.recording]), ['23514']);
    });

    await report.isolated('L12 a live call\'s anchor lies inside its track\'s recorded or gapped range (USER track for the person, QANDEEL track for QANDEEL)', async () => {
      const x = await activeCall();
      assert.equal(await addSegment(x.user, x.recording, 'USER', 0, 0, 10000), 'ADDED');
      assert.equal(await gap(x.user, x.recording, 'QANDEEL', 0, 6000, 'NOT_SPEAKING'), 'RECORDED');
      // Where the tracks stand, for a connection resuming on another instance; nothing for another human.
      const [tracks] = await server('SELECT * FROM public.server_read_call_tracks_v1($1, $2)', [x.user, x.call]);
      assert.deepEqual([tracks.recording_id, tracks.recording_state, Number(tracks.user_track_end_ms), tracks.user_next_segment,
        Number(tracks.qandeel_track_end_ms), tracks.qandeel_next_segment], [x.recording, 'RECORDING', 10000, 1, 6000, 0]);
      assert.deepEqual(await server('SELECT * FROM public.server_read_call_tracks_v1($1, $2)', [randomUUID(), x.call]), []);
      const u1 = await turn(x.user, x.session, 'USER');
      await rejected(() => attach(x.user, u1, x.recording, 2000, 10001), ['22023']);
      assert.equal((await attach(x.user, u1, x.recording, 2000, 10000)).outcome, 'ATTACHED');
      const q1 = await turn(x.user, x.session, 'ASSISTANT');
      await rejected(() => attach(x.user, q1, x.recording, 0, 6001, 'ASSISTANT'), ['22023']);
      assert.equal((await attach(x.user, q1, x.recording, 0, 6000, 'ASSISTANT')).outcome, 'ATTACHED');
    });

    await report.isolated('L13 call-truth: ACTIVE while held, NO_CALL_KNOWN otherwise (fails safe on a lapsed call the sweep has not ended); per person', async () => {
      const x = await activeCall();
      const t = await truth(x.user);
      assert.deepEqual([t.call_truth, t.call_id, t.call_state], ['ACTIVE', x.call, 'ACTIVE']);
      assert.equal((await truth(randomUUID())).call_truth, 'NO_CALL_KNOWN', 'another human');
      await suspend(x.user, x.call);
      assert.deepEqual([(await truth(x.user)).call_truth, (await truth(x.user)).call_state], ['ACTIVE', 'RECONNECTING']);
      await lapse(x.call, "grace_until = clock_timestamp() - interval '1 second', seat_lease_until = clock_timestamp() - interval '1 second'");
      assert.equal((await truth(x.user)).call_truth, 'NO_CALL_KNOWN', 'lapsed but not yet swept');
      assert.equal((await callRow(x.call)).state, 'RECONNECTING', 'the read changes nothing');
      await sweep();
      assert.deepEqual([(await truth(x.user)).call_truth, (await truth(x.user)).call_id], ['NO_CALL_KNOWN', null]);
    });

    await report.isolated('L14 the call record is durable; account erasure removes the call and its recording', async () => {
      const x = await activeCall();
      await owner();
      await rejected(() => q('DELETE FROM voice_private.calls WHERE id = $1', [x.call]), ['55000', '23503']);
      await end(x.user, x.call, 1);
      await owner();
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [x.user]);
      const [{ outcome }] = await server('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]);
      assert.equal(outcome, 'ERASED');
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.calls WHERE user_id = $1', [x.user]))[0].n, 0);
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.recordings WHERE user_id = $1', [x.user]))[0].n, 0);
    });

    await report.isolated('L15 the writer fence: a segment or gap only for the current epoch of an ACTIVE call; an admitted segment completes or is a WRITER_LOSS gap', async () => {
      const x = await activeCall();
      // 0183's epoch-less entries cannot prove the authority: FENCED, nothing written.
      assert.equal(await addSegmentV1(x.user, x.recording, 'USER', 0, 0, 1000), 'FENCED');
      assert.equal(await gapV1(x.user, x.recording, 'USER', 0, 1000, 'MUTED'), 'FENCED');
      assert.deepEqual(await writes(x.recording), { objects: 0, gaps: 0 });
      await rejected(() => addSegment(x.user, x.recording, 'USER', 0, 0, 1000, null), ['22023']);
      await owner();
      await rejected(() => gap(x.user, x.recording, 'USER', 0, 1000, 'MUTED', 0), ['22023']);
      await owner();
      assert.equal(await addSegment(randomUUID(), x.recording, 'USER', 0, 0, 1000), 'UNAVAILABLE', 'another human');
      assert.equal(await addSegment(x.user, x.recording, 'USER', 0, 0, 1000, 2), 'FENCED', 'an epoch the call never gave');
      // The current epoch: 0183's rules apply. Segment 0 stored; segment 1 admitted and still uploading.
      assert.equal(await addSegment(x.user, x.recording, 'USER', 0, 0, 1000), 'ADDED');
      assert.equal(await storeSegment(x.user, x.recording, 'USER', 0), 'STORED');
      assert.equal(await addSegment(x.user, x.recording, 'USER', 1, 1000, 2000), 'ADDED');
      // The connection is lost: RECONNECTING; even its own epoch writes nothing more.
      assert.equal((await suspend(x.user, x.call, 1)).outcome, 'SUSPENDED');
      assert.equal(await addSegment(x.user, x.recording, 'USER', 2, 2000, 3000), 'FENCED');
      assert.equal(await gap(x.user, x.recording, 'USER', 2000, 3000, 'RECONNECTION'), 'FENCED');
      // The resume moves the epoch on. The admitted segment counts in the tracks the new connection reads.
      const r = await resume(x.user, x.call, x.client);
      assert.deepEqual([r.outcome, Number(r.connection_epoch)], ['RESUMED', 2]);
      const [tracks] = await server('SELECT * FROM public.server_read_call_tracks_v1($1, $2)', [x.user, x.call]);
      assert.deepEqual([Number(tracks.user_track_end_ms), tracks.user_next_segment], [2000, 2]);
      // The older epoch's late writes: FENCED, nothing written (the index and the clock are untouched).
      assert.equal(await addSegment(x.user, x.recording, 'USER', 2, 2000, 3000, 1), 'FENCED');
      assert.equal(await gap(x.user, x.recording, 'USER', 2000, 3000, 'RECONNECTION', 1), 'FENCED');
      assert.equal(await addSegment(x.user, x.recording, 'USER', 1, 1000, 2000, 1), 'FENCED', 'not even its own replay');
      assert.deepEqual(await writes(x.recording), { objects: 2, gaps: 0 });
      // ...but the segment it was admitted for before the resume still completes: its audio is not lost.
      assert.equal(await storeSegment(x.user, x.recording, 'USER', 1), 'STORED');
      // The new epoch writes on from where the tracks stand.
      assert.equal(await gap(x.user, x.recording, 'USER', 2000, 2600, 'RECONNECTION', 2), 'RECORDED');
      assert.equal(await addSegment(x.user, x.recording, 'USER', 2, 2600, 3600, 2), 'ADDED');
      assert.deepEqual(await assertContiguous(x.recording, 'USER'),
        ['SEGMENT:STORED 0-1000', 'SEGMENT:STORED 1000-2000', 'RECONNECTION 2000-2600', 'SEGMENT:PENDING_UPLOAD 2600-3600']);
      // Segment 2 never uploads: the end seals the recording and it becomes a WRITER_LOSS gap, never silence or audio.
      assert.equal((await end(x.user, x.call, 2)).outcome, 'ENDED');
      assert.deepEqual(await assertContiguous(x.recording, 'USER'),
        ['SEGMENT:STORED 0-1000', 'SEGMENT:STORED 1000-2000', 'RECONNECTION 2000-2600', 'WRITER_LOSS 2600-3600']);
      assert.equal(await addSegment(x.user, x.recording, 'USER', 3, 3600, 4600, 2), 'UNAVAILABLE', 'an ENDED call');
      assert.equal(await gapV1(x.user, x.recording, 'USER', 3600, 4600, 'MUTED'), 'UNAVAILABLE', 'its recording is sealed');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ races (committed fixtures, removed afterwards)
async function verifyRaces(report) {
  const { q2, close } = await rt.openSecondary();
  const sr = async (client, sql, values) => {
    await client('BEGIN');
    await client('SET LOCAL ROLE service_role');
    return client(sql, values);
  };
  const people = [randomUUID(), randomUUID(), randomUUID()];
  await owner();
  const [gate] = await rows('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = $1', [LIVE]);
  const [policy] = await rows('SELECT * FROM voice_private.live_call_policy');
  try {
    await rt.provisionHumans(people);
    await owner();
    await setGate();
    const sessions = [];
    for (const person of people) {
      assert.equal(await grant(person), 'GRANTED');
      sessions.push(await newSession(person));
    }
    const [P, Q, R] = people;
    const client = randomUUID();

    await report.section('LRC-1 two begins of one person on two connections: one BEGUN, one ALREADY_IN_CALL', async () => {
      await setCapacity(1000);
      const sql = 'SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)';
      const a = (await sr(q, sql, [P, sessions[0], randomUUID(), client])).rows[0];
      const b = sr(q2, sql, [P, sessions[0], randomUUID(), randomUUID()]);
      assert.equal(await rt.stillPending(b), true, 'the second waits on the per-person lock');
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['BEGUN', 'ALREADY_IN_CALL']);
    });

    await report.section('LRC-2 two people for the last seat: one BEGUN, one CAPACITY_FULL', async () => {
      await setCapacity(await seatsInUse() + 1);
      const sql = 'SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)';
      const a = (await sr(q, sql, [Q, sessions[1], randomUUID(), randomUUID()])).rows[0];
      const b = sr(q2, sql, [R, sessions[2], randomUUID(), randomUUID()]);
      assert.equal(await rt.stillPending(b), true, 'the second waits on the capacity lock');
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['BEGUN', 'CAPACITY_FULL']);
      await setCapacity(1000);
    });

    await report.section('LRC-3 end vs sweep vs resume on one lapsing call: the sweep skips the held row, the call ends once', async () => {
      const [{ id: call }] = await rows("SELECT id FROM voice_private.calls WHERE user_id = $1 AND state <> 'ENDED'", [P]);
      assert.equal((await activate(P, call)).outcome, 'ACTIVE');
      assert.equal((await suspend(P, call)).outcome, 'SUSPENDED');
      await owner();
      await q('BEGIN');
      await lapse(call, "grace_until = clock_timestamp() - interval '1 second', seat_lease_until = clock_timestamp() - interval '1 second'");
      await q('COMMIT');
      // The resume holds the row; the sweep on the other connection does not wait for it and ends nothing.
      const resumed = (await sr(q, 'SELECT * FROM public.server_resume_call_v1($1, $2, $3)', [P, call, client])).rows[0];
      const swept = (await sr(q2, 'SELECT * FROM public.server_sweep_calls_v1(200)', [])).rows[0];
      await q2('COMMIT');
      await q('COMMIT');
      await owner();
      assert.deepEqual([resumed.outcome, resumed.call_state], ['ENDED', 'PEER_LOST_AFTER_GRACE']);
      const [row] = await rows('SELECT state, end_reason FROM voice_private.calls WHERE id = $1', [call]);
      assert.deepEqual(row, { state: 'ENDED', end_reason: 'PEER_LOST_AFTER_GRACE' });
      assert.ok(Number.isInteger(swept.ended));
      assert.equal((await one('SELECT * FROM public.server_end_call_v1($1, $2, 1, $3)', [P, call, 'USER_ENDED'])).outcome, 'ALREADY_ENDED');
    });

    await report.section('LRC-4 two ends of one call on two connections: one ENDED, one ALREADY_ENDED, one seal', async () => {
      const [{ id: call }] = await rows("SELECT id FROM voice_private.calls WHERE user_id = $1 AND state <> 'ENDED'", [Q]);
      assert.equal((await activate(Q, call)).outcome, 'ACTIVE');
      await owner();
      const sql = 'SELECT * FROM public.server_end_call_v1($1, $2, 1, $3)';
      const a = (await sr(q, sql, [Q, call, 'USER_ENDED'])).rows[0];
      const b = sr(q2, sql, [Q, call, 'SERVER_ENDED']);
      assert.equal(await rt.stillPending(b), true, 'the second waits on the call row');
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome, r.end_reason], ['ENDED', 'ALREADY_ENDED', 'USER_ENDED']);
      const [rec] = await rows('SELECT recording_state, sealed_by FROM voice_private.recordings WHERE call_id = $1', [call]);
      assert.deepEqual(rec, { recording_state: 'STORED', sealed_by: 'WRITER' });
    });

    // R's call: the instance holding epoch 1 is writing when the phone resumes elsewhere (the connection is lost first).
    const rClient = randomUUID();
    const rb = await begin(R, sessions[2], rClient);
    assert.equal(rb.outcome, 'BEGUN');
    const ra = await activate(R, rb.call);
    const [rCall, rRec] = [rb.call, ra.recording_id];
    const addSql = 'SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)';
    const resumeSql = 'SELECT * FROM public.server_resume_call_v1($1, $2, $3)';

    await report.section('LRC-5 an old epoch\'s admission holds the call; the resume waits for it; the segment counts in the resumed tracks and still completes', async () => {
      assert.equal(await addSegment(R, rRec, 'USER', 0, 0, 1000), 'ADDED');
      assert.equal(await storeSegment(R, rRec, 'USER', 0), 'STORED');
      await owner();
      const late = (await sr(q, addSql, [R, rRec, 1, 'USER', 1, 1000, 2000])).rows[0];
      assert.equal(late.outcome, 'ADDED', 'epoch 1 still holds the call: admitted');
      const resumed = sr(q2, resumeSql, [R, rCall, rClient]);
      assert.equal(await rt.stillPending(resumed), true, 'the resume waits on the admission\'s call lock');
      await q('COMMIT');
      await owner();
      const r = (await resumed).rows[0];
      await q2('COMMIT');
      assert.deepEqual([r.outcome, Number(r.connection_epoch)], ['RESUMED', 2]);
      const [tracks] = await server('SELECT * FROM public.server_read_call_tracks_v1($1, $2)', [R, rCall]);
      assert.deepEqual([Number(tracks.user_track_end_ms), tracks.user_next_segment], [2000, 2], 'the resumed connection writes after it');
      // The old instance finishes its upload after the authority moved: the admitted audio is kept.
      assert.equal(await storeSegment(R, rRec, 'USER', 1), 'STORED');
      // Its next write is fenced.
      assert.equal(await addSegment(R, rRec, 'USER', 2, 2000, 3000, 1), 'FENCED');
    });

    await report.section('LRC-6 the resume holds the call; an old epoch\'s late admission waits for it and is FENCED: nothing written, the tracks one truth', async () => {
      assert.equal((await suspend(R, rCall, 2)).outcome, 'SUSPENDED');
      await owner();
      const r = (await sr(q, resumeSql, [R, rCall, rClient])).rows[0];
      assert.deepEqual([r.outcome, Number(r.connection_epoch)], ['RESUMED', 3]);
      const late = sr(q2, addSql, [R, rRec, 2, 'USER', 2, 2000, 3000]);
      assert.equal(await rt.stillPending(late), true, 'the late admission waits on the resume\'s call lock');
      await q('COMMIT');
      await owner();
      const l = (await late).rows[0];
      await q2('COMMIT');
      assert.equal(l.outcome, 'FENCED', 'epoch 2 lost the call before its admission ran');
      assert.deepEqual(await writes(rRec), { objects: 2, gaps: 0 });
      // The holder of epoch 3 writes on; the ended call's tracks are one contiguous truth.
      assert.equal(await gap(R, rRec, 'USER', 2000, 2400, 'RECONNECTION', 3), 'RECORDED');
      assert.equal(await addSegment(R, rRec, 'USER', 2, 2400, 3400, 3), 'ADDED');
      assert.equal(await storeSegment(R, rRec, 'USER', 2), 'STORED');
      assert.equal((await end(R, rCall, 3)).outcome, 'ENDED');
      assert.deepEqual(await assertContiguous(rRec, 'USER'),
        ['SEGMENT:STORED 0-1000', 'SEGMENT:STORED 1000-2000', 'RECONNECTION 2000-2400', 'SEGMENT:STORED 2400-3400']);
      const [row] = await rows('SELECT state, end_reason, connection_epoch::int AS epoch FROM voice_private.calls WHERE id = $1', [rCall]);
      assert.deepEqual(row, { state: 'ENDED', end_reason: 'USER_ENDED', epoch: 3 });
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await close();
    await removeRaceFixtures(people, gate, policy);
  }
}

// The LRC fixtures are committed, and in CI the next steps share this database: the gate and the policy go back to the
// state they had and every row of the fixture humans goes, so the run leaves nothing behind.
async function removeRaceFixtures(humans, gate, policy) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.recording_gaps WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recording_objects WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
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
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeHistoricalFixture(humans);
  await rt.removeFixtureHumans(humans);
}

runVerifier('0189', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0189', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('races');
  await verifyRaces(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
