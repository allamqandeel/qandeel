// Real-PostgreSQL verifier for migration 0193 (S8B-06 CP3 R3: the finished-call record from durable truth; the Product
// Owner's CP3 Review R1 decision, option A). No provider is called; every behaviour scenario runs in one transaction that
// is rolled back.
//
//   T0   catalogue: the one new read is postgres-owned, a pinned SECURITY DEFINER, STABLE, EXECUTE to service_role only;
//        it reads voice_private.calls and the call policy (D6) and nothing else (no turn, no content, no recording); it is bounded (100) and
//        returns only ENDED calls that became ACTIVE; nothing else in 0193 creates, alters or grants anything; four scopes
//        DISABLED; the census clean
//   T1   a call that ended with no turn is returned with the server's started_at, ended_at and end_reason; a call with
//        turns too; the newest first; the end reason is the server's (USER_ENDED, SERVER_ENDED)
//   T2   never a call that did not become ACTIVE (ended while CONNECTING), never the live call (ACTIVE, not ENDED)
//   T3   isolation: another person's id reads nothing of this Session; another Session of the same person is not this one's
//   T4   the window: [p_ended_from, p_ended_before) of ended_at, each bound open when NULL
//   T5   the client roles: anon and authenticated may not execute it (42501)
//   T6   D6: at_max_length only for a SERVER_ENDED call that lasted the policy's maximum (within 15 s); an earlier
//        SERVER_ENDED, and the person's own end at any length, are not the maximum length
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { VOICE_CONSENT_V3 } from './qandeel-voice-0188-anchor.mjs';

export const MIGRATION_0193 = '0193_s8b_06_session_finished_calls_read_v1.sql';
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const rejected = (operation, codes, message) => rt.rejected(operation, codes, message);

const READ = 'public.server_read_session_finished_calls_v1(uuid,uuid,timestamptz,timestamptz)';
const READ_SQL = 'SELECT * FROM public.server_read_session_finished_calls_v1($1, $2, $3, $4)';
const LIVE = 'PERSONAL_LIVE_CALL';

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
async function newSession(user) {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
async function setGate() {
  await owner();
  await rows("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, 'ENABLED', 'SATISFIED', 'verify-0193', 'real-PostgreSQL proof')", [LIVE]);
}
async function setCapacity(capacity) {
  await owner();
  await rows(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'verify-0193', 'real-PostgreSQL proof') FROM voice_private.live_call_policy p`, [capacity]);
}
/** A person with the recording consent, and a Session of theirs. */
async function person() {
  const user = await human();
  const session = await newSession(user);
  assert.equal((await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), VOICE_CONSENT_V3])).outcome, 'GRANTED');
  return { user, session };
}
/** A call begun in the person's Session, activated unless `connecting`. */
async function call(p, session = p.session, o = {}) {
  const id = randomUUID();
  assert.equal((await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [p.user, session, id, randomUUID()])).outcome, 'BEGUN');
  const x = { user: p.user, session, call: id, recording: null, epoch: 1 };
  if (o.connecting) return x;
  const a = await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [p.user, id]);
  assert.equal(a.outcome, 'ACTIVE');
  x.recording = a.recording_id;
  return x;
}
const endCall = async (x, reason = 'USER_ENDED') => (await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, reason])).outcome;
const truthOf = async (x) => (await rows('SELECT started_at, ended_at, end_reason FROM voice_private.calls WHERE id = $1', [x.call]))[0];
const read = (user, session, from = null, before = null) => server(READ_SQL, [user, session, from, before]);
const ids = (list) => list.map((r) => r.call_id);
/** One spoken turn committed in the call (the call then has a turn in the history). */
async function spokenTurn(x) {
  const add = await one('SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)', [x.user, x.recording, x.epoch, 'USER', 0, 0, 1000]);
  assert.equal(add.outcome, 'ADDED');
  const r = await one('SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
    [x.user, x.call, x.epoch, randomUUID(), randomUUID(), 'SPEECH', 'أنا بخير والحمد لله', 'HIGH', 0, 1000, [], randomUUID(), randomUUID()]);
  assert.equal(r.outcome, 'COMMITTED');
  return r.turn_id;
}

// ------------------------------------------------------------------ T0 catalogue
async function verifyCatalogue(report) {
  await report.section('T0a the read: postgres-owned, a pinned STABLE SECURITY DEFINER, service_role only', async () => {
    const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config, p.prosecdef AS definer, p.provolatile AS volatility,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service, has_function_privilege('public', p.oid, 'EXECUTE') AS everyone
        FROM pg_proc p WHERE p.oid = $1::regprocedure`, [READ]);
    assert.equal(p.owner, 'postgres');
    assert.deepEqual(p.config, ['search_path=""'], 'pinned');
    assert.equal(p.definer, true, 'definer');
    assert.equal(p.volatility, 's', 'STABLE: it writes nothing');
    assert.deepEqual([p.anon, p.auth, p.service, p.everyone], [false, false, true, false]);
  });
  await report.section('T0b it reads voice_private.calls and the call policy only: no turn, no content, no recording; ENDED and ACTIVE-once only; bounded', async () => {
    const [{ src }] = await rows('SELECT p.prosrc AS src FROM pg_proc p WHERE p.oid = $1::regprocedure', [READ]);
    const relations = [...src.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+\.[a-z_0-9]+)/gu)].map((m) => m[1]);
    assert.deepEqual(relations, ['voice_private.calls', 'voice_private.live_call_policy'], "the calls, and the policy's maximum (D6)");
    assert.doesNotMatch(src, /content|transcript|recording|segment|conversation_turns/u);
    assert.match(src, /c\.user_id = p_user_id AND c\.session_id = p_session_id/u, 'the person and the Session');
    assert.match(src, /c\.state = 'ENDED' AND c\.started_at IS NOT NULL/u, 'only a call that ended after it became ACTIVE');
    assert.match(src, /c\.end_reason = 'SERVER_ENDED'\s+AND c\.ended_at >= c\.started_at \+ make_interval\(secs => p\.max_call_seconds\) - interval '15 seconds'/u,
      "the maximum length is the server's end AND the policy's length, never the reason alone");
    assert.match(src, /LIMIT 100;/u);
  });
  await report.section('T0c 0193 creates exactly the one function, alters no relation and grants no client role', async () => {
    const text = readFileSync(new URL(`./migrations/${MIGRATION_0193}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    const code = text.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
    assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
    assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
    assert.deepEqual([...code.matchAll(/CREATE (?:OR REPLACE )?(FUNCTION|TABLE|VIEW|TRIGGER|INDEX|POLICY) ([a-z_.0-9]+)/gu)].map((m) => `${m[1]} ${m[2]}`),
      ['FUNCTION public.server_read_session_finished_calls_v1']);
    assert.doesNotMatch(code, /\bALTER TABLE\b|\bDROP\b|\bINSERT INTO\b|\bUPDATE\s+[a-z_]+\.|\bDELETE FROM\b/u, 'nothing else changes');
    assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u);
    assert.doesNotMatch(code, /set_voice_launch_capability_v1\(/u, 'no gate is set');
  });
  await report.section('T0d four scopes DISABLED / UNSATISFIED; the census clean', async () => {
    const scopes = await rows('SELECT feature_flag_state AS f, launch_requirements_state AS r FROM voice_private.voice_launch_capability_states');
    assert.equal(scopes.length, 4);
    assert.ok(scopes.every((s) => s.f === 'DISABLED' && s.r === 'UNSATISFIED'));
    const census = await rows(`SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c WHERE c.contype = 'f'
        AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
        AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)`);
    assert.deepEqual(census, []);
  });
}

// ------------------------------------------------------------------ behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await setCapacity(64);
    await setGate();

    await report.isolated('T1 a zero-turn call and a call with a turn: the server\'s started_at, ended_at and end_reason, newest first', async () => {
      const p = await person();
      const silent = await call(p);
      assert.equal(await endCall(silent), 'ENDED');
      const spoken = await call(p);
      await spokenTurn(spoken);
      assert.equal(await endCall(spoken, 'SERVER_ENDED'), 'ENDED');
      const [{ n }] = await rows('SELECT count(*)::int AS n FROM public.conversation_call_turns WHERE call_id = $1', [silent.call]);
      assert.equal(n, 0, 'the first call left no turn');
      const got = await read(p.user, p.session);
      assert.deepEqual(ids(got), [spoken.call, silent.call], 'both, the newest first');
      for (const [row, x, reason] of [[got[0], spoken, 'SERVER_ENDED'], [got[1], silent, 'USER_ENDED']]) {
        const truth = await truthOf(x);
        assert.deepEqual([row.started_at.toISOString(), row.ended_at.toISOString(), row.end_reason],
          [truth.started_at.toISOString(), truth.ended_at.toISOString(), reason], 'the durable instants and reason, as stored');
        assert.ok(row.ended_at >= row.started_at);
        assert.equal(row.at_max_length, false, 'neither reached the maximum length');
      }
    });

    await report.isolated('T2 never a call that did not become ACTIVE, never the live call', async () => {
      const p = await person();
      const refused = await call(p, p.session, { connecting: true });
      assert.equal(await endCall(refused, 'FAILED'), 'ENDED');
      const truth = await truthOf(refused);
      assert.deepEqual([truth.started_at, truth.end_reason], [null, 'FAILED'], 'it ended while CONNECTING');
      assert.deepEqual(await read(p.user, p.session), [], 'a call that never became ACTIVE was not a call');
      const live = await call(p);
      assert.deepEqual(await read(p.user, p.session), [], 'the live call is call truth\'s, not the record\'s');
      assert.equal(await endCall(live), 'ENDED');
      assert.deepEqual(ids(await read(p.user, p.session)), [live.call], 'once it ended, it is the record');
    });

    await report.isolated('T3 isolation: another person reads nothing of this Session; another Session is not this one', async () => {
      const p = await person();
      const other = await person();
      const x = await call(p);
      assert.equal(await endCall(x), 'ENDED');
      assert.deepEqual(await read(other.user, p.session), [], 'another person\'s id');
      const second = await newSession(p.user);
      assert.deepEqual(await read(p.user, second), [], 'another Session of the same person');
      const y = await call(p, second);
      assert.equal(await endCall(y), 'ENDED');
      assert.deepEqual(ids(await read(p.user, second)), [y.call]);
      assert.deepEqual(ids(await read(p.user, p.session)), [x.call]);
      assert.deepEqual(await read(null, p.session), [], 'a NULL person reads nothing');
      assert.deepEqual(await read(p.user, null), [], 'a NULL Session reads nothing');
    });

    await report.isolated('T4 the window [p_ended_from, p_ended_before) of ended_at; a NULL bound is open', async () => {
      const p = await person();
      const a = await call(p);
      assert.equal(await endCall(a), 'ENDED');
      const b = await call(p);
      assert.equal(await endCall(b), 'ENDED');
      const ea = (await truthOf(a)).ended_at;
      const eb = (await truthOf(b)).ended_at;
      assert.ok(ea < eb);
      assert.deepEqual(ids(await read(p.user, p.session, eb)), [b.call], 'from is inclusive');
      assert.deepEqual(ids(await read(p.user, p.session, null, eb)), [a.call], 'before is exclusive');
      assert.deepEqual(ids(await read(p.user, p.session, ea, eb)), [a.call]);
      assert.deepEqual(ids(await read(p.user, p.session, ea)), [b.call, a.call]);
      assert.deepEqual(await read(p.user, p.session, eb, eb), [], 'an empty window');
    });

    await report.isolated('T5 the client roles may not execute it', async () => {
      const p = await person();
      for (const role of ['anon', 'authenticated']) {
        await asRole(role, p.user);
        await rejected(() => rows(READ_SQL, [p.user, p.session, null, null]), ['42501'], /permission denied/u);
        await owner();
      }
    });

    await report.isolated("T6 D6: the maximum length is a SERVER_ENDED call that lasted the policy's maximum, never the reason alone", async () => {
      const p = await person();
      const [{ max }] = await rows('SELECT max_call_seconds AS max FROM voice_private.live_call_policy');
      assert.equal(max, 3600);
      // A call that has lasted `seconds`: its start moved back inside this rolled-back transaction, the call's guard
      // trigger set aside for that one row (started_at is written once by design; nothing else is touched).
      const lasted = async (seconds) => {
        const x = await call(p);
        await owner();
        await q('SET LOCAL session_replication_role = replica');
        await q("UPDATE voice_private.calls SET started_at = started_at - make_interval(secs => $2) WHERE id = $1", [x.call, seconds]);
        await q('SET LOCAL session_replication_role = origin');
        return x;
      };
      const full = await lasted(3600);
      assert.equal(await endCall(full, 'SERVER_ENDED'), 'ENDED');
      const atMargin = await lasted(3590);
      assert.equal(await endCall(atMargin, 'SERVER_ENDED'), 'ENDED');
      const early = await lasted(3580);
      assert.equal(await endCall(early, 'SERVER_ENDED'), 'ENDED');
      const own = await lasted(3600);
      assert.equal(await endCall(own, 'USER_ENDED'), 'ENDED');
      const got = new Map((await read(p.user, p.session)).map((r) => [r.call_id, r]));
      assert.equal(got.size, 4);
      assert.equal(got.get(full.call).at_max_length, true, 'SERVER_ENDED at the maximum');
      assert.equal(got.get(atMargin.call).at_max_length, true, 'SERVER_ENDED within the 15 s margin');
      assert.equal(got.get(early.call).at_max_length, false, 'SERVER_ENDED 20 s before the maximum is not the maximum length');
      assert.equal(got.get(own.call).at_max_length, false, "the person's own end is never the maximum length");
      assert.equal(got.get(early.call).end_reason, 'SERVER_ENDED', 'the same reason, a different fact: the reason alone does not decide');
    });
  } finally {
    await q('ROLLBACK');
  }
}

runVerifier('0193', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0193', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
