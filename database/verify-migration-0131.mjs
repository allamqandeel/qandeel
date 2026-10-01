// Real-PostgreSQL verifier for migration 0131 - PROD-SEC-02 Turn Admission Concurrency & Cost Bound v1.
// Proves, against live semantics (never grep alone): the admission bound (one in-flight turn per session, two per
// user, the rolling 10-minute and 24-hour allowances) is enforced atomically by the authenticated RPC itself, so a
// direct caller cannot bypass it; a refusal is the one typed PT429 TURN_ADMISSION_LIMITED and commits nothing; an
// idempotent replay is never limited and never charged; terminal, stale-RECEIVED and expired-GENERATING turns free
// their slot by themselves; the service-role work lease bounds provider-bearing work for banked RECEIVED turns and
// for cancelled-but-still-working turns; the durable per-user work-start budget stops a retry loop on one
// completed-but-unestablished exchange, charges every grant exactly once and nothing else, and rolls open again;
// every authority is exactly as narrow as before; lease state disappears
// with the account's turns; and committed multi-connection races serialize one user without serializing two users
// and without deadlock.
import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import process from 'node:process'; import pg from 'pg';
const { Client } = pg; const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

/** Runs an operation that must fail inside a savepoint and returns the error, so the transaction stays usable. */
async function refusalOf(operation) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  return error;
}
async function rejected(operation, codes = ['42501']) {
  const error = await refusalOf(operation);
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const CREATE = 'public.create_user_conversation_turn(uuid,uuid,text,text)';
const BEGIN_WORK = 'public.begin_conversation_turn_work_v1(uuid,uuid,uuid)';
const END_WORK = 'public.end_conversation_turn_work_v1(uuid,uuid,uuid)';
const POLICY = 'public.conversation_turn_admission_policy_v1()';
const IN_FLIGHT = 'public.conversation_turns_in_flight_v1(uuid,boolean)';
const LOCK = 'public.lock_conversation_turn_admission_v1(uuid)';
const BUDGET = 'public.conversation_turn_work_budget_spent_v1(uuid)';
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// ------------------------------------------------------------------ fixtures (postgres authority)
async function freshOwner(sessionCount = 1) {
  await identity('postgres');
  const user = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [user]);
  const sessions = [];
  for (let index = 0; index < sessionCount; index += 1) {
    const session = randomUUID();
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, user]);
    sessions.push(session);
  }
  return { user, sessions };
}

/** One admission through the real authenticated RPC, exactly as PostgREST would run it. */
async function admit(user, session, key = null) {
  await identity('authenticated', user);
  const id = randomUUID();
  const [created] = await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [id, session, 'admission fixture', key]);
  await identity('postgres');
  assert.equal(created.id, id);
  assert.equal(created.status, 'RECEIVED');
  return id;
}

/** A refused admission: the one typed answer, and no row. */
async function admissionLimited(user, session, key = null) {
  await identity('authenticated', user);
  const id = randomUUID();
  const error = await refusalOf(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [id, session, 'over the bound', key]));
  await identity('postgres');
  assert.equal(error.code, 'PT429', `a bounded admission answers PT429 (got ${error.code})`);
  assert.equal(error.message, 'TURN_ADMISSION_LIMITED', 'the refusal names the condition and nothing else');
  assert.equal(error.detail ?? null, null, 'no detail is disclosed');
  assert.equal(error.hint ?? null, null, 'no hint is disclosed');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turns WHERE id=$1', [id]))[0].n, 0, 'a refusal commits nothing');
}

const userTurnTotal = async (user) => (await rows("SELECT count(*)::int n FROM public.conversation_turns WHERE user_id=$1 AND role='USER'", [user]))[0].n;
const ageAdmission = (turn) => q("UPDATE public.conversation_turns SET created_at = created_at - interval '121 seconds', updated_at = updated_at - interval '121 seconds' WHERE id=$1", [turn]);
const expireGeneration = (turn) => q("UPDATE public.conversation_turns SET generation_claimed_at=now()-interval '10 minutes', generation_lease_expires_at=now()-interval '8 minutes' WHERE id=$1", [turn]);
const expireWork = (turn) => q("UPDATE public.conversation_turn_work_leases SET acquired_at=now()-interval '10 minutes', expires_at=now()-interval '8 minutes' WHERE user_turn_id=$1", [turn]);

async function claim(user, session, turn) {
  await identity('service_role');
  const claimed = await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, user, turn, ...ROUTE]);
  await identity('postgres');
  assert.equal(claimed.length, 1, 'fixture claim succeeded');
}
async function cancel(user, session, turn) {
  await identity('authenticated', user);
  const cancelled = await rows('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, user, turn, randomUUID(), null, null]);
  await identity('postgres');
  assert.equal(cancelled.length, 1, 'fixture cancel succeeded');
}
async function beginWork(user, session, turn) {
  await identity('service_role');
  const [row] = await rows('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, user, turn]);
  await identity('postgres');
  return row;
}
async function endWork(user, turn, lease) {
  await identity('service_role');
  const [{ end_conversation_turn_work_v1: ended }] = await rows('SELECT end_conversation_turn_work_v1($1,$2,$3)', [user, turn, lease]);
  await identity('postgres');
  return ended;
}

// ------------------------------------------------------------------ static authority
async function verifyStaticAuthority() {
  stage = 'static authority';
  const [contract] = await rows(`SELECT
      to_regprocedure($1) IS NOT NULL create_present, to_regprocedure($2) IS NOT NULL begin_present,
      to_regprocedure($3) IS NOT NULL end_present, to_regprocedure($4) IS NOT NULL policy_present,
      to_regprocedure($5) IS NOT NULL in_flight_present, to_regprocedure($6) IS NOT NULL lock_present,
      to_regprocedure($7) IS NOT NULL budget_present,
      pg_get_functiondef(to_regprocedure($1)) create_definition,
      pg_get_functiondef(to_regprocedure($2)) begin_definition,
      pg_get_functiondef(to_regprocedure($3)) end_definition,
      (SELECT proconfig FROM pg_proc WHERE oid = to_regprocedure($1)) create_config,
      (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = to_regprocedure($1)) create_owner`,
  [CREATE, BEGIN_WORK, END_WORK, POLICY, IN_FLIGHT, LOCK, BUDGET]);
  for (const key of ['create_present', 'begin_present', 'end_present', 'policy_present', 'in_flight_present', 'lock_present', 'budget_present']) {
    assert.equal(contract[key], true, `${key}: the exact signature exists`);
  }
  assert.deepEqual(contract.create_config, ['search_path=""'], 'the admission command keeps exactly one setting: an empty search_path');
  assert.equal(contract.create_owner, 'postgres');
  for (const [name, definition] of [['admission', contract.create_definition], ['begin work', contract.begin_definition], ['end work', contract.end_definition]]) {
    assert.match(definition, /SECURITY DEFINER/u, `${name} is SECURITY DEFINER`);
    assert.match(definition, /search_path TO ''/u, `${name} search path is fixed empty`);
    assert.doesNotMatch(definition, /openai|anthropic|gemini|provider_call|http|fetch/iu, `${name} carries no provider concept`);
  }
  // Every pre-0131 admission rule is still there, unchanged and in front of the bound.
  assert.match(contract.create_definition, /status<>'ACTIVE' OR session_row\.channel<>'TEXT'/u);
  assert.match(contract.create_definition, /SESSION_NOT_ACTIVE_TEXT/u);
  assert.match(contract.create_definition, /lock_conversation_turn_admission_v1\(u\)/u, 'admission decides under the per-user lock');
  assert.ok(contract.create_definition.indexOf('INVALID_IDEMPOTENCY_KEY') < contract.create_definition.indexOf('lock_conversation_turn_admission_v1'),
    'validation precedes the lock, so no caller can hold a lock with an invalid request');
  assert.match(contract.create_definition, /PT429/u);
  assert.match(contract.create_definition, /conversation_turn_work_budget_spent_v1\(u\)/u, 'admission refuses while the work-start budget is spent');
  assert.match(contract.begin_definition, /conversation_turn_work_budget_spent_v1\(p_user_id\)/u, 'every grant is decided against the work-start budget');
  assert.doesNotMatch(contract.begin_definition, /auth\.uid|request\.jwt/iu, 'the work lease derives no identity from caller claims: ownership is explicit');
  assert.doesNotMatch(contract.end_definition, /conversation_turn_work_grants/u, 'returning a lease never refunds its grant');

  stage = 'static policy';
  const [policy] = await rows(`SELECT session_in_flight_limit, user_in_flight_limit, short_window_limit, long_window_limit,
      work_short_window_limit, work_long_window_limit,
      short_window = interval '10 minutes' short_exact, long_window = interval '24 hours' long_exact
    FROM public.conversation_turn_admission_policy_v1()`);
  assert.deepEqual(policy, { session_in_flight_limit: 1, user_in_flight_limit: 2, short_window_limit: 40, long_window_limit: 600,
    work_short_window_limit: 60, work_long_window_limit: 900, short_exact: true, long_exact: true },
  'the engineering defaults are exactly the documented ones');
  assert.ok(policy.work_short_window_limit > policy.short_window_limit && policy.work_long_window_limit > policy.long_window_limit,
    'the work-start budget always covers every admission it allows, so ordinary use is never deferred by it');

  stage = 'static privileges';
  const matrix = [
    ['authenticated', CREATE, true], ['anon', CREATE, false], ['service_role', CREATE, false],
    ['service_role', BEGIN_WORK, true], ['authenticated', BEGIN_WORK, false], ['anon', BEGIN_WORK, false],
    ['service_role', END_WORK, true], ['authenticated', END_WORK, false], ['anon', END_WORK, false],
  ];
  for (const internal of [POLICY, IN_FLIGHT, LOCK, BUDGET]) {
    for (const role of ['anon', 'authenticated', 'service_role']) matrix.push([role, internal, false]);
  }
  for (const [role, signature, expected] of matrix) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
    assert.equal(allowed, expected, `${role} EXECUTE ${signature}`);
  }
  for (const relation of ['public.conversation_turn_work_leases', 'public.conversation_turn_work_grants']) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, relation, privilege]);
        assert.equal(allowed, false, `${role} has no ${privilege} on ${relation}`);
      }
    }
    const [table] = await rows(`SELECT c.relrowsecurity rls,
        (SELECT confdeltype FROM pg_constraint WHERE conrelid = c.oid AND contype = 'f') delete_rule,
        (SELECT confrelid::regclass::text FROM pg_constraint WHERE conrelid = c.oid AND contype = 'f') referenced
      FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
    assert.deepEqual(table, { rls: true, delete_rule: 'c', referenced: 'conversation_turns' }, `${relation}: RLS on, and its rows cascade away with their turn`);
  }
}

// ------------------------------------------------------------------ admission bound
async function verifySessionBoundAndRefusalShape() {
  stage = 'one in-flight turn per session';
  const { user, sessions: [session] } = await freshOwner(1);
  const first = await admit(user, session, 'session-bound-1');
  await admissionLimited(user, session);
  await admissionLimited(user, session, 'a-different-command');

  stage = 'pre-existing errors keep their order at the bound';
  const closed = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel,closed_at) VALUES($1,$2,'CLOSED','TEXT',now())", [closed, user]);
  await identity('authenticated', user);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), closed, 'x', null]), ['55000']);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, '   ', null]), ['22023']);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'x', 'k'.repeat(129)]), ['22023']);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), randomUUID(), 'x', null]), ['42501']);
  await identity('postgres');

  stage = 'idempotent replay is never limited and never charged';
  const before = await userTurnTotal(user);
  await identity('authenticated', user);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'replay', 'session-bound-1']), ['23505']);
  await identity('postgres');
  assert.equal(await userTurnTotal(user), before, 'the replay created nothing');
  assert.equal((await rows("SELECT id FROM public.conversation_turns WHERE session_id=$1 AND idempotency_key='session-bound-1'", [session]))[0].id, first,
    'the key still names the original turn');

  stage = 'a terminal turn frees its session';
  await cancel(user, session, first);
  const second = await admit(user, session);
  await claim(user, session, second);
  await admissionLimited(user, session);
  await identity('service_role');
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, user, second, randomUUID(), 'reply', 'ALLOW', randomUUID(), null, null]);
  await identity('postgres');
  assert.equal(finalized.length, 1);
  await admit(user, session);
}

async function verifyUserBoundAcrossSessions() {
  stage = 'two in-flight turns per user, whatever the number of sessions';
  const { user, sessions } = await freshOwner(4);
  await admit(user, sessions[0]);
  await admit(user, sessions[1]);
  await admissionLimited(user, sessions[2]);
  await admissionLimited(user, sessions[3]);

  stage = 'another user is never affected';
  const other = await freshOwner(1);
  await admit(other.user, other.sessions[0]);
}

async function verifyStaleWorkNeverLocksOut() {
  stage = 'a stale RECEIVED turn frees its slot by itself';
  const { user, sessions: [session] } = await freshOwner(1);
  const abandoned = await admit(user, session);
  await admissionLimited(user, session);
  await ageAdmission(abandoned);
  const next = await admit(user, session);
  assert.equal((await rows('SELECT status FROM public.conversation_turns WHERE id=$1', [abandoned]))[0].status, 'RECEIVED',
    'nothing deleted or rewrote the abandoned canonical turn');

  stage = 'an expired GENERATING turn frees its slot by itself';
  await claim(user, session, next);
  await admissionLimited(user, session);
  await expireGeneration(next);
  const after = await admit(user, session);

  stage = 'a legacy null-lease GENERATING row uses the 0039 fallback';
  await cancel(user, session, after);
  const legacy = randomUUID();
  await q(`INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,updated_at)
    VALUES($1,$2,$3,'USER','GENERATING','legacy',$4,$5,now()-interval '10 minutes')`, [legacy, session, user, ...ROUTE]);
  await admit(user, session);
}

async function verifySustainedAllowance() {
  stage = 'the rolling 10-minute allowance';
  const [policy] = await rows('SELECT short_window_limit, long_window_limit FROM public.conversation_turn_admission_policy_v1()');
  const { user, sessions: [session] } = await freshOwner(1);
  const fill = (count, age) => q(`INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,created_at,updated_at,completed_at)
    SELECT gen_random_uuid(), $1, $2, 'USER', 'COMPLETED', 'allowance fixture', now() - $4::interval, now() - $4::interval, now() - $4::interval
      FROM generate_series(1, $3)`, [session, user, count, age]);
  await fill(policy.short_window_limit - 1, '1 minute');
  const last = await admit(user, session);
  await cancel(user, session, last);
  await admissionLimited(user, session);
  // The allowance rolls: the same turns, older than the window, no longer count.
  await q("UPDATE public.conversation_turns SET created_at = created_at - interval '10 minutes' WHERE user_id=$1", [user]);
  await admit(user, session);

  stage = 'the rolling 24-hour allowance';
  const day = await freshOwner(1);
  const fillDay = (count, age) => q(`INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,created_at,updated_at,completed_at)
    SELECT gen_random_uuid(), $1, $2, 'USER', 'COMPLETED', 'allowance fixture', now() - $4::interval, now() - $4::interval, now() - $4::interval
      FROM generate_series(1, $3)`, [day.sessions[0], day.user, count, age]);
  await fillDay(policy.long_window_limit, '2 hours');
  await admissionLimited(day.user, day.sessions[0]);
  await q("UPDATE public.conversation_turns SET created_at = created_at - interval '1 day' WHERE user_id=$1", [day.user]);
  await admit(day.user, day.sessions[0]);

  stage = 'separate users have separate allowances';
  const neighbour = await freshOwner(1);
  await admit(neighbour.user, neighbour.sessions[0]);
}

// ------------------------------------------------------------------ work lease
async function verifyWorkLease() {
  stage = 'work lease: grant, single flight, release';
  const { user, sessions: [session] } = await freshOwner(1);
  const turn = await admit(user, session);
  const granted = await beginWork(user, session, turn);
  assert.equal(granted.work_outcome, 'GRANTED');
  assert.match(granted.work_lease_id, /^[0-9a-f-]{36}$/u);
  assert.deepEqual(await beginWork(user, session, turn), { work_outcome: 'IN_PROGRESS', work_lease_id: null }, 'one exchange is never worked twice at once');
  const [window] = await rows(`SELECT (expires_at - acquired_at) = public.foreground_generation_lease_interval_v1() exact
    FROM public.conversation_turn_work_leases WHERE user_turn_id=$1`, [turn]);
  assert.equal(window.exact, true, 'a lease lasts exactly the frozen foreground lease');

  stage = 'admit, cancel, admit cannot outrun work still running';
  await cancel(user, session, turn);
  await admissionLimited(user, session);
  assert.equal(await endWork(user, turn, randomUUID()), false, 'a foreign lease id releases nothing');
  await admissionLimited(user, session);
  assert.equal(await endWork(user, turn, granted.work_lease_id), true);
  await admit(user, session);

  stage = 'banked RECEIVED turns are never worked beside the user\'s other work';
  const bank = await freshOwner(3);
  const banked = [];
  for (const bankSession of bank.sessions) {
    const id = await admit(bank.user, bankSession);
    await ageAdmission(id);
    banked.push(id);
  }
  assert.equal((await beginWork(bank.user, bank.sessions[0], banked[0])).work_outcome, 'GRANTED');
  assert.equal((await beginWork(bank.user, bank.sessions[1], banked[1])).work_outcome, 'GRANTED');
  assert.deepEqual(await beginWork(bank.user, bank.sessions[2], banked[2]), { work_outcome: 'LIMITED', work_lease_id: null }, 'the user bound holds for banked turns');
  await expireWork(banked[0]);
  assert.equal((await beginWork(bank.user, bank.sessions[2], banked[2])).work_outcome, 'GRANTED', 'an expired lease frees its slot by itself');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_turn_id=$1', [banked[0]]))[0].n, 0,
    'expired leases of the user are cleared when the next one is granted');

  stage = 'the session bound holds for banked turns of one session';
  const single = await freshOwner(1);
  const early = await admit(single.user, single.sessions[0]);
  await ageAdmission(early);
  const late = await admit(single.user, single.sessions[0]);
  await ageAdmission(late);
  assert.equal((await beginWork(single.user, single.sessions[0], early)).work_outcome, 'GRANTED');
  assert.equal((await beginWork(single.user, single.sessions[0], late)).work_outcome, 'LIMITED');

  stage = 'a live GENERATING turn without a lease still counts as work';
  const legacy = await freshOwner(1);
  const claimed = await admit(legacy.user, legacy.sessions[0]);
  await claim(legacy.user, legacy.sessions[0], claimed);
  const queued = randomUUID();
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','RECEIVED','queued')", [queued, legacy.sessions[0], legacy.user]);
  assert.equal((await beginWork(legacy.user, legacy.sessions[0], queued)).work_outcome, 'LIMITED');
}

// ------------------------------------------------------------------ work-start budget
const grantsOf = async (user) => (await rows('SELECT count(*)::int n FROM public.conversation_turn_work_grants WHERE user_id=$1', [user]))[0].n;
const leasesOf = async (user) => (await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_id=$1', [user]))[0].n;
const fillGrants = (user, turn, total, age) => q(`INSERT INTO public.conversation_turn_work_grants(user_turn_id, user_id, granted_at)
  SELECT $1, $2, now() - $4::interval FROM generate_series(1, $3)`, [turn, user, total, age]);

/** A COMPLETED exchange whose semantic establishment never happened: every replay of it would walk it again. */
async function completedUnestablished(user, session) {
  const turn = await admit(user, session);
  await claim(user, session, turn);
  await identity('service_role');
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)', [session, user, turn, randomUUID(), 'reply', 'ALLOW', randomUUID(), null, null]);
  await identity('postgres');
  assert.equal(finalized.length, 1, 'fixture finalize succeeded');
  return turn;
}

async function verifyWorkStartBudget() {
  const [policy] = await rows('SELECT work_short_window_limit, work_long_window_limit FROM public.conversation_turn_admission_policy_v1()');

  stage = 'work-start budget: repeated semantic retries of one exchange eventually stop';
  const { user, sessions: [session] } = await freshOwner(1);
  const exchange = await completedUnestablished(user, session);
  const baseline = await grantsOf(user);
  let grantedRetries = 0;
  for (;;) {
    const attempt = await beginWork(user, session, exchange);
    if (attempt.work_outcome !== 'GRANTED') {
      assert.deepEqual(attempt, { work_outcome: 'LIMITED', work_lease_id: null }, 'an exhausted budget is the ordinary LIMITED answer');
      break;
    }
    grantedRetries += 1;
    assert.ok(grantedRetries <= policy.work_short_window_limit, 'the retry loop never outruns the 10-minute budget');
    assert.equal(await endWork(user, exchange, attempt.work_lease_id), true, 'each retry returns its lease, exactly like a finished request');
  }
  assert.equal(grantedRetries, policy.work_short_window_limit, 'exactly the 10-minute work-start budget was granted, one start per retry');
  assert.equal(await grantsOf(user) - baseline, policy.work_short_window_limit, 'a returned lease is still charged: ending work refunds nothing');

  stage = 'work-start budget: no provider-bearing work begins once it is spent';
  assert.equal(await leasesOf(user), 0, 'the refused attempt holds no lease, so no provider work may start');
  assert.equal((await beginWork(user, session, exchange)).work_outcome, 'LIMITED', 'asking again changes nothing');
  assert.equal(await grantsOf(user) - baseline, policy.work_short_window_limit, 'a refusal is never charged');
  await admissionLimited(user, session, 'new-turn-after-budget');

  stage = 'work-start budget: users are isolated';
  const neighbour = await freshOwner(1);
  const neighbourTurn = await admit(neighbour.user, neighbour.sessions[0]);
  assert.equal((await beginWork(neighbour.user, neighbour.sessions[0], neighbourTurn)).work_outcome, 'GRANTED', 'another user\'s budget is untouched');

  stage = 'work-start budget: the 10-minute window rolls, so a spent budget is never a permanent lockout';
  await q("UPDATE public.conversation_turn_work_grants SET granted_at = granted_at - interval '10 minutes' WHERE user_id=$1", [user]);
  const recovered = await beginWork(user, session, exchange);
  assert.equal(recovered.work_outcome, 'GRANTED', 'the same exchange may be worked again once the window has rolled');
  await endWork(user, exchange, recovered.work_lease_id);
  await admit(user, session, 'new-turn-after-window');

  stage = 'work-start budget: the 24-hour window, and its pruning';
  const day = await freshOwner(1);
  const dayExchange = await completedUnestablished(day.user, day.sessions[0]);
  await fillGrants(day.user, dayExchange, policy.work_long_window_limit, '2 hours');
  assert.equal((await beginWork(day.user, day.sessions[0], dayExchange)).work_outcome, 'LIMITED', 'the daily budget holds even when the 10-minute window is empty');
  await admissionLimited(day.user, day.sessions[0]);
  await q("UPDATE public.conversation_turn_work_grants SET granted_at = granted_at - interval '1 day' WHERE user_id=$1", [day.user]);
  assert.equal((await beginWork(day.user, day.sessions[0], dayExchange)).work_outcome, 'GRANTED');
  assert.equal(await grantsOf(day.user), 1, 'grants older than the longest window are pruned when the next one is granted');

  stage = 'work-start budget: a crashed request is charged once and never locks out';
  const crash = await freshOwner(1);
  const crashed = await completedUnestablished(crash.user, crash.sessions[0]);
  const crashBaseline = await grantsOf(crash.user);
  assert.equal((await beginWork(crash.user, crash.sessions[0], crashed)).work_outcome, 'GRANTED');
  // The request dies without returning its lease: the lease expires on its own and the next replay may work again.
  await expireWork(crashed);
  assert.equal((await beginWork(crash.user, crash.sessions[0], crashed)).work_outcome, 'GRANTED', 'an expired lease never blocks the exchange');
  assert.equal(await grantsOf(crash.user) - crashBaseline, 2, 'the crashed start and the recovery start are each charged once');

  stage = 'work-start budget: standing aside is free';
  const aside = await freshOwner(1);
  const asideTurn = await completedUnestablished(aside.user, aside.sessions[0]);
  const asideBaseline = await grantsOf(aside.user);
  assert.equal((await beginWork(aside.user, aside.sessions[0], asideTurn)).work_outcome, 'GRANTED');
  assert.equal((await beginWork(aside.user, aside.sessions[0], asideTurn)).work_outcome, 'IN_PROGRESS');
  assert.equal(await grantsOf(aside.user) - asideBaseline, 1, 'an IN_PROGRESS answer (the request reusing the exchange\'s work) is never charged again');
}

async function verifyAuthorityDoesNotWiden() {
  stage = 'authority does not widen';
  const { user, sessions: [session] } = await freshOwner(1);
  const other = await freshOwner(1);
  const turn = await admit(user, session);
  const assistant = randomUUID();
  await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'ASSISTANT','RECEIVED','assistant')", [assistant, session, user]);

  await identity('authenticated', user);
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, user, turn]));
  await rejected(() => q('SELECT end_conversation_turn_work_v1($1,$2,$3)', [user, turn, randomUUID()]));
  await rejected(() => q('SELECT * FROM public.conversation_turn_admission_policy_v1()'));
  await rejected(() => q('SELECT * FROM public.conversation_turns_in_flight_v1($1,true)', [user]));
  await rejected(() => q('SELECT public.lock_conversation_turn_admission_v1($1)', [user]));
  await rejected(() => q('SELECT * FROM public.conversation_turn_work_leases'));
  await rejected(() => q("INSERT INTO public.conversation_turn_work_leases VALUES($1,$2,$3,$4,now(),now()+interval '1 hour')", [turn, user, session, randomUUID()]));
  await rejected(() => q('DELETE FROM public.conversation_turn_work_leases'));
  await rejected(() => q('SELECT public.conversation_turn_work_budget_spent_v1($1)', [user]));
  await rejected(() => q('SELECT * FROM public.conversation_turn_work_grants'));
  await rejected(() => q('DELETE FROM public.conversation_turn_work_grants'));
  await rejected(() => q('INSERT INTO public.conversation_turn_work_grants(user_turn_id,user_id,granted_at) VALUES($1,$2,now())', [turn, user]));
  await identity('anon');
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'anon', null]));
  // Another user's token cannot spend, read or reach this user's admission state.
  await identity('authenticated', other.user);
  await rejected(() => q('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [randomUUID(), session, 'intrude', null]));

  await identity('service_role');
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, null, turn]), ['22023']);
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, other.user, turn]));
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [other.sessions[0], other.user, turn]));
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, user, assistant]));
  await rejected(() => q('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [session, user, randomUUID()]));
  await identity('postgres');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_id IN ($1,$2)', [user, other.user]))[0].n, 0,
    'no refused attempt created a lease');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turn_work_grants WHERE user_id IN ($1,$2)', [user, other.user]))[0].n, 0,
    'no refused attempt was charged');
}

async function verifyLeaseStateGoesWithTheTurns() {
  stage = 'lease state disappears with the account\'s turns';
  const { user, sessions: [session] } = await freshOwner(1);
  const turn = await admit(user, session);
  assert.equal((await beginWork(user, session, turn)).work_outcome, 'GRANTED');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_id=$1', [user]))[0].n, 1);
  assert.equal(await grantsOf(user), 1);
  await q('DELETE FROM public.runtime_event_outbox WHERE subject_user_id=$1', [user]);
  await q('DELETE FROM public.conversation_turns WHERE user_id=$1', [user]);
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_id=$1', [user]))[0].n, 0, 'no orphan lease survives its turn');
  assert.equal(await grantsOf(user), 0, 'no orphan grant survives its turn');
}

// ------------------------------------------------------------------ committed races
async function connectAs(role, user) {
  const connection = new Client({ connectionString: databaseUrl });
  await connection.connect();
  await connection.query("SET lock_timeout = '10s'");
  await connection.query(`SET ROLE ${role}`);
  await connection.query("SELECT set_config('request.jwt.claims', $1, false)", [user ? JSON.stringify({ sub: user, role }) : '']);
  return connection;
}
const blockedFor = (pending, ms = 750) => Promise.race([pending.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), ms))]);
const outcome = (pending) => pending.then(() => 'ADMITTED', (error) => error.code);
const createSql = 'SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)';

async function verifyCommittedRaces() {
  stage = 'committed races: fixtures';
  const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const sessions = new Map(users.map((user) => [user, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]]));
  const connections = [];
  try {
    for (const user of users) {
      await q('INSERT INTO auth.users(id) VALUES($1)', [user]);
      for (const session of sessions.get(user)) {
        await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, user]);
      }
    }
    const [sameSessionUser, sameUser, independentA, independentB, budgetPair, budgetBurst] = users;

    stage = 'committed race: one session never admits two turns';
    const a = await connectAs('authenticated', sameSessionUser); connections.push(a);
    const b = await connectAs('authenticated', sameSessionUser); connections.push(b);
    const [target] = sessions.get(sameSessionUser);
    await a.query('BEGIN');
    await a.query(createSql, [randomUUID(), target, 'first', null]);
    const pending = b.query(createSql, [randomUUID(), target, 'second', null]);
    pending.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    assert.equal(await blockedFor(pending), 'BLOCKED', 'the second admission waits on the per-user lock instead of checking early');
    await a.query('COMMIT');
    assert.equal(await outcome(pending), 'PT429', 'after the first commits, the second is refused');
    assert.equal((await rows("SELECT count(*)::int n FROM public.conversation_turns WHERE session_id=$1 AND role='USER'", [target]))[0].n, 1);

    stage = 'committed race: one user never admits beyond two across sessions';
    const c = await connectAs('authenticated', sameUser); connections.push(c);
    const d = await connectAs('authenticated', sameUser); connections.push(d);
    const own = sessions.get(sameUser);
    await c.query(createSql, [randomUUID(), own[0], 'already in flight', null]);
    await c.query('BEGIN');
    await c.query(createSql, [randomUUID(), own[1], 'second of two', null]);
    const third = d.query(createSql, [randomUUID(), own[2], 'third', null]);
    third.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    assert.equal(await blockedFor(third), 'BLOCKED');
    await c.query('COMMIT');
    assert.equal(await outcome(third), 'PT429');

    stage = 'committed race: two users never serialize on each other';
    const e = await connectAs('authenticated', independentA); connections.push(e);
    const f = await connectAs('authenticated', independentB); connections.push(f);
    await e.query('BEGIN');
    await e.query(createSql, [randomUUID(), sessions.get(independentA)[0], 'holds A', null]);
    const neighbour = f.query(createSql, [randomUUID(), sessions.get(independentB)[0], 'B is free', null]);
    neighbour.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    assert.equal(await blockedFor(neighbour, 5000), 'COMPLETED', 'another user is admitted while the first user\'s lock is held');
    assert.equal(await outcome(neighbour), 'ADMITTED');
    await e.query('COMMIT');

    stage = 'committed race: a burst from one user converges without deadlock';
    const burst = [];
    for (let index = 0; index < 4; index += 1) { const connection = await connectAs('authenticated', independentB); connections.push(connection); burst.push(connection); }
    // B already holds one turn in flight (above), so exactly one more of the four may pass.
    const results = await Promise.all(burst.map((connection, index) => outcome(connection.query(createSql, [randomUUID(), sessions.get(independentB)[index], `burst ${index}`, null]))));
    assert.equal(results.filter((result) => result === 'ADMITTED').length, 1, `exactly one burst admission passes (${results.join(',')})`);
    assert.equal(results.filter((result) => result === 'PT429').length, 3, 'every other burst admission is the typed refusal - never a deadlock or a timeout');

    stage = 'committed race: one exchange gets one work lease';
    const [{ id: worked }] = await rows("SELECT id FROM public.conversation_turns WHERE user_id=$1 AND session_id=$2 AND role='USER'", [sameSessionUser, target]);
    const g = await connectAs('service_role', null); connections.push(g);
    const h = await connectAs('service_role', null); connections.push(h);
    const leases = await Promise.all([g, h].map((connection) => connection.query('SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)', [target, sameSessionUser, worked]).then((r) => r.rows[0].work_outcome)));
    assert.deepEqual(leases.sort(), ['GRANTED', 'IN_PROGRESS'], 'two concurrent requests for one exchange: one works, one stands aside');

    // The work-start budget under committed concurrency. Each user gets four COMPLETED exchanges in four sessions,
    // none in flight, so the in-flight bound would admit two of them at once: any refusal beyond that is the budget.
    const [{ work_short_window_limit: workLimit }] = await rows('SELECT work_short_window_limit FROM public.conversation_turn_admission_policy_v1()');
    const exchangesOf = async (user, spent) => {
      const turns = [];
      for (const session of sessions.get(user)) {
        const turn = randomUUID();
        await q(`INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,completed_at)
          VALUES($1,$2,$3,'USER','COMPLETED','budget race fixture',now())`, [turn, session, user]);
        turns.push({ turn, session });
      }
      await fillGrants(user, turns[0].turn, spent, '1 minute');
      return turns;
    };
    const beginSql = 'SELECT * FROM begin_conversation_turn_work_v1($1,$2,$3)';

    stage = 'committed race: the last unit of budget is granted once';
    const pair = await exchangesOf(budgetPair, workLimit - 1);
    const i = await connectAs('service_role', null); connections.push(i);
    const j = await connectAs('service_role', null); connections.push(j);
    await i.query('BEGIN');
    assert.equal((await i.query(beginSql, [pair[0].session, budgetPair, pair[0].turn])).rows[0].work_outcome, 'GRANTED');
    const rival = j.query(beginSql, [pair[1].session, budgetPair, pair[1].turn]);
    rival.catch(() => undefined); // guarded branch: a teardown-path rejection must never become an unhandled rejection
    assert.equal(await blockedFor(rival), 'BLOCKED', 'the rival grant waits on the per-user lock instead of counting early');
    await i.query('COMMIT');
    assert.equal((await rival).rows[0].work_outcome, 'LIMITED', 'after the last unit commits, the rival is refused');
    assert.equal(await grantsOf(budgetPair), workLimit, 'the budget was never over-granted');

    stage = 'committed race: a burst of grants never over-spends the budget';
    const burstExchanges = await exchangesOf(budgetBurst, workLimit - 1);
    const grantBurst = [];
    for (let index = 0; index < burstExchanges.length; index += 1) { const connection = await connectAs('service_role', null); connections.push(connection); grantBurst.push(connection); }
    const grants = await Promise.all(grantBurst.map((connection, index) => connection.query(beginSql, [burstExchanges[index].session, budgetBurst, burstExchanges[index].turn]).then((r) => r.rows[0].work_outcome)));
    assert.equal(grants.filter((result) => result === 'GRANTED').length, 1, `exactly one concurrent start is granted (${grants.join(',')})`);
    assert.equal(grants.filter((result) => result === 'LIMITED').length, burstExchanges.length - 1, 'every other start is LIMITED - never a deadlock or a timeout');
    assert.equal(await grantsOf(budgetBurst), workLimit, 'the burst never over-spent the budget');
  } finally {
    for (const connection of connections) await connection.end().catch(() => undefined);
    await q('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [users]);
    await q('DELETE FROM public.conversation_turns WHERE user_id = ANY($1::uuid[])', [users]);
    // As in the 0039 / 0064 / 0065 teardowns: a Session carries its Semantic Clock, its historical coverage and
    // baseline, and a user its World Semantic Clock; the fixture owner removes those append-only rows in replica
    // mode before the Sessions and the users go.
    await q("SET session_replication_role = 'replica'");
    try {
      const allSessions = [...sessions.values()].flat();
      await q('DELETE FROM public.session_historical_baselines WHERE session_id = ANY($1::uuid[])', [allSessions]);
      await q('DELETE FROM public.session_historical_coverage WHERE session_id = ANY($1::uuid[])', [allSessions]);
      await q('DELETE FROM public.historical_world_semantic_clocks WHERE user_id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM public.session_semantic_clocks WHERE session_id = ANY($1::uuid[])', [allSessions]);
      await q('DELETE FROM public.conversation_sessions WHERE id = ANY($1::uuid[])', [allSessions]);
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await q("SET session_replication_role = 'origin'");
    }
    const [{ n: residue }] = await rows('SELECT count(*)::int n FROM public.conversation_turn_work_leases WHERE user_id = ANY($1::uuid[])', [users]);
    assert.equal(residue, 0, 'the concurrency proof left no lease behind');
    const [{ n: charged }] = await rows('SELECT count(*)::int n FROM public.conversation_turn_work_grants WHERE user_id = ANY($1::uuid[])', [users]);
    assert.equal(charged, 0, 'the concurrency proof left no grant behind');
  }
}

async function main() {
  try {
    await client.connect();
    await verifyStaticAuthority();
    await q('BEGIN');
    try {
      await verifySessionBoundAndRefusalShape();
      await verifyUserBoundAcrossSessions();
      await verifyStaleWorkNeverLocksOut();
      await verifySustainedAllowance();
      await verifyWorkLease();
      await verifyWorkStartBudget();
      await verifyAuthorityDoesNotWiden();
      await verifyLeaseStateGoesWithTheTurns();
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyCommittedRaces();
    console.log('Verified migration 0131: one in-flight turn per session and two per user, the rolling 10-minute and 24-hour allowances, all decided atomically by the authenticated RPC under a per-user lock; one typed PT429 refusal that commits and discloses nothing; idempotent replay never limited or charged; terminal, stale-RECEIVED and expired-GENERATING turns free their slot by themselves; the service-role work lease bounds banked and cancelled-but-working turns and grants one exchange once; the durable rolling work-start budget stops repeated semantic retries, refuses new work and new admissions once spent, never charges a refusal or a stand-aside, never refunds a returned lease, isolates users and rolls back open after a crash; authority unchanged; leases and grants cascade with their turns; committed races serialize one user, never two, never over-grant the budget, without deadlock.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Turn admission concurrency and cost bound verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
