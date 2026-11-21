// Real-PostgreSQL verifier for migration 0197 (COSMOS E-2 corrections, Slice B: the Personal conversation catalog under
// the Product Owner's decision D-2 of 2026-11-20). No provider is called; every scenario runs in ONE transaction that is
// rolled back, so nothing is retained.
//
//   T0   catalogue: the three definers are postgres-owned, SECURITY DEFINER, search_path-pinned, EXECUTE to authenticated
//        only (anon and service_role refused); the title ledger grants nothing to any client role; the partial unique
//        index and the append-only guard exist; the 0030 creation still works and leaves client_request_id NULL
//   T1   idempotent creation: the same person and the same request identity answer the EARLIER Session (one row, the
//        first id), a different request identity a second Session; neither erases or changes the other
//   T2   isolation: another person with the SAME request identity gets their own Session; their catalog never shows
//        this person's Sessions; titling another person's Session is FORBIDDEN (42501), never "not found"; no caller
//        identity is FORBIDDEN on all three
//   T3   the catalog: newest ACTIVITY first (the newest turn, else the creation); the opening is the first user message,
//        whitespace-normalised, at most 120 characters; turn_count and last_turn_at are the Session's own; p_limit is
//        clamped to [1, 100]
//   T4   the title: a rename appends (two ledger rows, the newest shown); whitespace is normalised; empty, blank and
//        81-character titles are INVALID_TITLE (22023); no ledger row is ever rewritten (55000, even by the owner role)
//   T5   a Session's deletion (the governed 0130 account erasure, run for a third person) takes its titles with it;
//        another person's Sessions, titles and catalog are untouched
//   T6   two connections, committed fixtures removed afterwards: a creation of the same request that waits on an
//        uncommitted one answers the EARLIER Session once it commits (one row, no 40001), and a creation that waits on
//        an uncommitted one that rolls back creates its own Session
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes = ['42501'], message = null) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

/** T6: real races on two connections; the committed person and Sessions are removed in `finally`. */
async function verifyConcurrentCreation() {
  const first = new Client({ connectionString: process.env.DATABASE_URL });
  const second = new Client({ connectionString: process.env.DATABASE_URL });
  await first.connect(); await second.connect();
  const person = randomUUID();
  const as = async (c) => {
    await c.query('SET LOCAL ROLE authenticated');
    await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: person, role: 'authenticated' })]);
  };
  const createOn = async (c, id, request) => (await c.query('SELECT * FROM public.create_conversation_session_v2($1, $2)', [id, request])).rows[0];
  const blocked = async (c) => {
    for (let i = 0; i < 200; i += 1) {
      const { rows: waiting } = await client.query(
        "SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'", [c.processID]);
      if (waiting.length) return;
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    throw new Error('the second creation never waited on the first');
  };
  try {
    await client.query('INSERT INTO auth.users(id) VALUES ($1)', [person]);
    // (a) the winner commits: the waiter answers the EARLIER Session, never a second one and never 40001.
    const winnerId = randomUUID();
    await first.query('BEGIN'); await as(first);
    assert.equal((await createOn(first, winnerId, 'race-1')).id, winnerId);
    await second.query('BEGIN'); await as(second);
    const waiter = createOn(second, randomUUID(), 'race-1');
    await blocked(second);
    await first.query('COMMIT');
    const answered = await waiter;
    await second.query('COMMIT');
    assert.equal(answered.id, winnerId, 'the waiting creation answers the EARLIER Session');
    assert.equal((await client.query("SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1 AND client_request_id = 'race-1'", [person])).rows[0].n, 1,
      'exactly one Session for the request');
    // (b) the first creator rolls back: the waiter creates its own Session.
    const loserId = randomUUID(); const ownId = randomUUID();
    await first.query('BEGIN'); await as(first);
    assert.equal((await createOn(first, loserId, 'race-2')).id, loserId);
    await second.query('BEGIN'); await as(second);
    const own = createOn(second, ownId, 'race-2');
    await blocked(second);
    await first.query('ROLLBACK');
    assert.equal((await own).id, ownId, 'after a rollback the waiting creation is the Session');
    await second.query('COMMIT');
    assert.equal((await client.query("SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1 AND client_request_id = 'race-2'", [person])).rows[0].n, 1);
  } finally {
    for (const c of [first, second]) { try { await c.query('ROLLBACK'); } catch { /* none open */ } await c.end(); }
    // The committed person and Sessions leave through the governed 0130 erasure, the one path that may delete them.
    await client.query('BEGIN');
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, person, randomUUID()]);
    await client.query('SET LOCAL ROLE service_role');
    const { rows: [{ outcome }] } = await client.query('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]);
    await client.query('RESET ROLE');
    await client.query('COMMIT');
    assert.equal(outcome, 'ERASED', 'the race fixtures are erased');
    await client.query('DELETE FROM auth.users WHERE id = $1', [person]);
    assert.equal((await client.query('SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1', [person])).rows[0].n, 0,
      'the race fixtures are removed');
  }
}

const CREATE_V1 = 'public.create_conversation_session_v1(uuid)';
const CREATE_V2 = 'public.create_conversation_session_v2(uuid,text)';
const LIST = 'public.list_conversation_sessions_v1(integer)';
const TITLE = 'public.set_conversation_session_title_v1(uuid,text)';

const create = async (user, id, request) => (await rows('SELECT * FROM public.create_conversation_session_v2($1, $2)', [id, request]))[0];
const list = async (limit = null) => rows('SELECT * FROM public.list_conversation_sessions_v1($1)', [limit]);
const title = async (session, text) => (await rows('SELECT * FROM public.set_conversation_session_title_v1($1, $2)', [session, text]))[0];
async function human() {
  const id = randomUUID();
  await identity('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = $1', [id]);
  assert.equal(n, 1, 'the auth provisioning trigger created the public.users row');
  return id;
}
/** One committed USER turn of the person's Session, placed at an exact instant so ordering is deterministic. */
async function userTurn(user, session, content, at) {
  await identity('authenticated', user);
  const id = randomUUID();
  await rows('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, NULL)', [id, session, content]);
  await identity('postgres');
  await q('UPDATE public.conversation_turns SET created_at = $2 WHERE id = $1', [id, at]);
  return id;
}

try {
  await client.connect();
  await q('BEGIN');
  const serviceRole = (await rows("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'")).length === 1;

  // ---------------------------------------------------------------------------------------------------------- T0
  stage = 'T0 catalogue';
  for (const fn of [CREATE_V2, LIST, TITLE]) {
    const [p] = await rows(`SELECT prosecdef, proowner::regrole::text AS owner, proconfig,
        has_function_privilege('anon', $2::text, 'EXECUTE') AS anon_exec, has_function_privilege('authenticated', $2::text, 'EXECUTE') AS auth_exec
      FROM pg_proc WHERE oid = $1::text::regprocedure`, [fn, fn]);
    assert.ok(p, `${fn} exists`);
    assert.equal(p.prosecdef, true, `${fn} is SECURITY DEFINER`);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.ok(p.proconfig.some((cfg) => cfg.startsWith('search_path=')), `${fn} pins search_path`);
    assert.equal(p.anon_exec, false, `${fn}: anon may not execute`);
    assert.equal(p.auth_exec, true, `${fn}: the person may execute`);
    if (serviceRole) {
      const [{ ok }] = await rows("SELECT has_function_privilege('service_role', $1::text, 'EXECUTE') AS ok", [fn]);
      assert.equal(ok, false, `${fn}: service_role may not execute`);
    }
  }
  assert.equal((await rows(`SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'conversation_session_titles' AND grantee IN ('anon','authenticated','service_role','PUBLIC')`)).length, 0,
  'no client role holds a privilege on the title ledger');
  assert.equal((await rows("SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'conversation_sessions_user_client_request_unique'")).length, 1);
  assert.equal((await rows("SELECT 1 FROM pg_trigger WHERE tgname = 'conversation_session_titles_append_only' AND NOT tgisinternal")).length, 1);
  const a = await human();
  await identity('authenticated', a);
  const legacyId = randomUUID();
  const [legacy] = await rows('SELECT * FROM public.create_conversation_session_v1($1)', [legacyId]);
  assert.equal(legacy.id, legacyId, 'the 0030 creation still answers the minted id');
  assert.equal(legacy.client_request_id, null, 'the 0030 creation carries no request identity');

  // ---------------------------------------------------------------------------------------------------------- T1
  stage = 'T1 idempotent creation';
  const firstId = randomUUID();
  const first = await create(a, firstId, 'request-1');
  assert.equal(first.id, firstId);
  assert.equal(first.client_request_id, 'request-1');
  assert.equal(first.status, 'ACTIVE'); assert.equal(first.channel, 'TEXT'); assert.equal(first.closed_at, null);
  const again = await create(a, randomUUID(), 'request-1');
  assert.equal(again.id, firstId, 'the same request identity answers the EARLIER Session');
  assert.equal(again.created_at.getTime(), first.created_at.getTime(), 'the earlier Session is answered unchanged');
  const secondId = randomUUID();
  const second = await create(a, secondId, 'request-2');
  assert.notEqual(second.id, firstId, 'a different request identity is a second Session');
  await identity('postgres');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1', [a]))[0].n, 3,
    'the legacy Session, request-1 and request-2: a new conversation never erased or replaced an existing one');
  assert.equal((await rows("SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1 AND client_request_id = 'request-1'", [a]))[0].n, 1);
  await identity('authenticated', a);
  await rejected(() => create(a, randomUUID(), ''), ['22023'], /INVALID_CLIENT_REQUEST_ID/u);
  await rejected(() => create(a, randomUUID(), 'x'.repeat(129)), ['22023'], /INVALID_CLIENT_REQUEST_ID/u);
  await rejected(() => create(a, randomUUID(), null), ['22023'], /INVALID_CLIENT_REQUEST_ID/u);
  await rejected(() => create(a, null, 'request-3'), ['22023'], /INVALID_SESSION_ID/u);

  // ---------------------------------------------------------------------------------------------------------- T2
  stage = 'T2 isolation';
  const b = await human();
  await identity('authenticated', b);
  const bFirst = await create(b, randomUUID(), 'request-1');
  assert.notEqual(bFirst.id, firstId, 'the request identity is per person: another person gets their own Session');
  const bList = await list();
  assert.deepEqual(bList.map((s) => s.id), [bFirst.id], 'the other person sees only their own Session');
  await rejected(() => title(firstId, 'Theirs'), ['42501'], /FORBIDDEN/u);
  await rejected(() => title(randomUUID(), 'Nobody'), ['42501'], /FORBIDDEN/u);
  await identity('authenticated', null);
  await rejected(() => create(a, randomUUID(), 'request-9'), ['42501'], /FORBIDDEN/u);
  await rejected(() => list(), ['42501'], /FORBIDDEN/u);
  await rejected(() => title(firstId, 'Nobody'), ['42501'], /FORBIDDEN/u);
  await identity('anon');
  await rejected(() => create(a, randomUUID(), 'request-9'), ['42501']);
  await rejected(() => list(), ['42501']);
  await rejected(() => title(firstId, 'Nobody'), ['42501']);
  if (serviceRole) {
    await identity('service_role');
    await rejected(() => list(), ['42501']);
    await rejected(() => rows('SELECT * FROM public.conversation_session_titles'), ['42501']);
  }

  // ---------------------------------------------------------------------------------------------------------- T3
  stage = 'T3 the catalog';
  await identity('postgres');
  // Distinct creation instants: legacy < first < second.
  await q('UPDATE public.conversation_sessions SET created_at = $2 WHERE id = $1', [legacyId, '2026-01-01T00:00:00Z']);
  await q('UPDATE public.conversation_sessions SET created_at = $2 WHERE id = $1', [firstId, '2026-01-02T00:00:00Z']);
  await q('UPDATE public.conversation_sessions SET created_at = $2 WHERE id = $1', [secondId, '2026-01-03T00:00:00Z']);
  await identity('authenticated', a);
  let catalog = await list();
  assert.deepEqual(catalog.map((s) => s.id), [secondId, firstId, legacyId], 'without turns, the newest creation first');
  for (const s of catalog) {
    assert.equal(s.title, null); assert.equal(s.title_at, null); assert.equal(s.opening, null);
    assert.equal(s.last_turn_at, null); assert.equal(s.turn_count, 0);
  }
  const long = `  first   ${'m'.repeat(200)}  `;
  await userTurn(a, firstId, long, '2026-02-01T00:00:00Z');
  await userTurn(a, firstId, 'second message', '2026-02-02T00:00:00Z');
  await userTurn(a, legacyId, 'legacy message', '2026-01-15T00:00:00Z');
  await identity('authenticated', a);
  catalog = await list();
  assert.deepEqual(catalog.map((s) => s.id), [firstId, legacyId, secondId], 'the newest ACTIVITY first: a turn outranks a later creation');
  const firstRow = catalog.find((s) => s.id === firstId);
  assert.equal(firstRow.opening, `first ${'m'.repeat(200)}`.slice(0, 120), 'the opening is the FIRST user message, normalised, at most 120 characters');
  assert.equal(firstRow.opening.length, 120);
  assert.equal(firstRow.turn_count, 2);
  assert.equal(new Date(firstRow.last_turn_at).toISOString(), '2026-02-02T00:00:00.000Z');
  assert.equal(catalog.find((s) => s.id === legacyId).opening, 'legacy message');
  assert.equal(catalog.find((s) => s.id === secondId).turn_count, 0);
  assert.equal((await list(0)).length, 1, 'p_limit below 1 is clamped to 1');
  assert.equal((await list(1)).length, 1);
  assert.equal((await list(1000)).length, 3, 'p_limit above 100 is clamped, never refused');
  assert.equal((await list(null)).length, 3, 'a NULL limit is the default');

  // ---------------------------------------------------------------------------------------------------------- T4
  stage = 'T4 the title';
  const t1 = await title(firstId, '  My   first   topic ');
  assert.equal(t1.session_id, firstId);
  assert.equal(t1.title, 'My first topic', 'whitespace is normalised');
  catalog = await list();
  assert.equal(catalog.find((s) => s.id === firstId).title, 'My first topic');
  assert.ok(catalog.find((s) => s.id === firstId).title_at !== null);
  const t2 = await title(firstId, 'Renamed');
  assert.equal(t2.title, 'Renamed');
  await identity('postgres');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_session_titles WHERE session_id = $1', [firstId]))[0].n, 2,
    'a rename APPENDS: the earlier title stays in the ledger');
  await rejected(() => q("UPDATE public.conversation_session_titles SET title = 'Rewritten' WHERE session_id = $1", [firstId]), ['55000'], /append-only/u);
  await rejected(() => q("UPDATE public.conversation_session_titles SET created_at = created_at WHERE session_id = $1", [firstId]), ['55000'], /append-only/u);
  assert.deepEqual((await rows('SELECT title FROM public.conversation_session_titles WHERE session_id = $1 ORDER BY id', [firstId])).map((r) => r.title),
    ['My first topic', 'Renamed'], 'the ledger keeps the order of appending');
  await identity('authenticated', a);
  catalog = await list();
  assert.equal(catalog.find((s) => s.id === firstId).title, 'Renamed', 'the newest title is the title');
  await rejected(() => title(firstId, ''), ['22023'], /INVALID_TITLE/u);
  await rejected(() => title(firstId, '   \n  '), ['22023'], /INVALID_TITLE/u);
  await rejected(() => title(firstId, 'x'.repeat(81)), ['22023'], /INVALID_TITLE/u);
  await rejected(() => title(firstId, null), ['22023'], /INVALID_TITLE/u);
  assert.equal((await title(firstId, 'y'.repeat(80))).title.length, 80, '80 characters are the bound, inclusive');
  await rejected(() => title(null, 'Nowhere'), ['22023'], /INVALID_SESSION_ID/u);

  // ---------------------------------------------------------------------------------------------------------- T5
  stage = 'T5 deletion';
  // The one path that deletes a Session is the governed 0130 account erasure (Session history is append-only otherwise),
  // so T5 runs it, for a third person with two titled Sessions, beside this person's untouched catalog.
  await identity('authenticated', a);
  await title(secondId, 'Second');
  const catalogBefore = (await list()).map((s) => s.id);
  const c = await human();
  await identity('authenticated', c);
  const doomed = [await create(c, randomUUID(), 'request-c1'), await create(c, randomUUID(), 'request-c2')].map((s) => s.id);
  await title(doomed[0], 'Mine'); await title(doomed[1], 'Also mine'); await title(doomed[1], 'Renamed');
  await identity('postgres');
  const deletionId = randomUUID();
  await q(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
    VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, c, randomUUID()]);
  await identity('service_role');
  assert.equal((await rows('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))[0].outcome, 'ERASED');
  await identity('postgres');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_sessions WHERE user_id = $1', [c]))[0].n, 0, 'the erasure removed the Sessions');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_session_titles WHERE session_id = ANY($1::uuid[])', [doomed]))[0].n, 0,
    'the deleted Sessions took their titles with them');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_session_titles WHERE session_id = $1', [firstId]))[0].n, 3,
    'another person’s Session kept every title row');
  assert.equal((await rows('SELECT count(*)::int n FROM public.conversation_session_titles WHERE session_id = $1', [secondId]))[0].n, 1);
  await identity('authenticated', a);
  assert.deepEqual((await list()).map((s) => s.id), catalogBefore, 'another person’s catalog is unchanged');

  await identity('postgres');
  await q('ROLLBACK');

  // ---------------------------------------------------------------------------------------------------------- T6
  stage = 'T6 concurrent creation';
  await verifyConcurrentCreation();
  console.log('migration 0197 verified');
} catch (error) {
  console.error(`migration 0197 verification failed at stage: ${stage}`);
  console.error(error);
  try { await q('ROLLBACK'); } catch { /* the transaction may already be gone */ }
  process.exitCode = 1;
} finally {
  await client.end();
  setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
}
