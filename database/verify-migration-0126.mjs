// W3-MEGA-U U2 — QANDEEL Understanding: the real-PostgreSQL verifier for migration 0126 (the "talk to QANDEEL about
// this" discussion focus, E2E-D-14).
//
// It proves, against a fully migrated database and inside ONE transaction that is rolled back:
//   1. the catalog: the table, its owner-scoped composite foreign key and row rules, RLS with an owner-only SELECT
//      policy, no client write grant; exactly two Understanding functions in the exposed `public` schema, both
//      INVOKER; the two privileged commands in the non-exposed `understanding_private`, DEFINER, empty search_path;
//      in that schema only those two are executable, by `authenticated` only; nothing for `anon` or `service_role`;
//   2. open: OPENED for the caller's own current item at its exact version; STALE for any other version, writing
//      nothing; NOT_FOUND for another reader's item, a withdrawn item and a missing one, writing nothing; one focus
//      per reader, moved (never duplicated) by a second open;
//   3. close: only the item the focus still names; NONE for another; CLOSED stamps it; a later open reopens it;
//   4. isolation: another reader never sees the focus; `authenticated` cannot write the table directly; `anon`
//      cannot call either Product function; an unauthenticated caller is refused.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}`);
  return refusal;
}

async function actAs(role, userId = null) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : '{}']);
}

async function asOwner() {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', '{}', true)");
}

const open = async (hypothesisId, version) => (await rows('SELECT public.open_understanding_discussion_v1($1, $2) AS answer', [hypothesisId, version]))[0].answer;
const close = async (hypothesisId) => (await rows('SELECT public.close_understanding_discussion_v1($1) AS answer', [hypothesisId]))[0].answer;
const focusOf = async (userId) => rows('SELECT hypothesis_id, hypothesis_version, opened_at::text AS opened_at, closed_at::text AS closed_at FROM public.understanding_discussion_focus WHERE user_id = $1', [userId]);

/** An owned Hypothesis moved to `status` only through the canonical lifecycle core. Returns its current version. */
async function hypothesisIn(userId, status) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin)
     VALUES ($1, $2, 'You prepare early for deadlines.', 'BEHAVIORAL', 'WORK', 'verifier scope', 'SYSTEM_GENERATED')`,
    [id, userId],
  );
  let version = 1;
  const path = { ACTIVE: ['ACTIVE'], REJECTED: ['ACTIVE', 'REJECTED'] }[status];
  for (const next of path) {
    await client.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, id, version, next, 'AUTHENTICATED_TRANSITION']);
    version += 1;
  }
  return { id, version };
}

async function verifyCatalog() {
  stage = 'catalog: the table and its rules';
  const columns = await rows(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'understanding_discussion_focus' ORDER BY ordinal_position`);
  assert.deepEqual(columns, [
    { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
    { column_name: 'hypothesis_id', data_type: 'uuid', is_nullable: 'NO' },
    { column_name: 'hypothesis_version', data_type: 'integer', is_nullable: 'NO' },
    { column_name: 'opened_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
    { column_name: 'closed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
  ], 'a pointer and two instants: no text, no reasoning, no score');
  const constraints = (await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.understanding_discussion_focus'::regclass ORDER BY conname`));
  const byName = Object.fromEntries(constraints.map((c) => [c.conname, c.def]));
  assert.match(byName.understanding_discussion_focus_owner_fk, /FOREIGN KEY \(hypothesis_id, user_id\) REFERENCES hypotheses\(id, user_id\)/u, 'owner-scoped: can never name another tenant’s item');
  assert.match(byName.understanding_discussion_focus_pkey, /PRIMARY KEY \(user_id\)/u, 'one focus per reader');
  assert.ok(byName.understanding_discussion_focus_version_check && byName.understanding_discussion_focus_closed_check);

  stage = 'catalog: row-level security and grants';
  const [{ rls }] = await rows("SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.understanding_discussion_focus'::regclass");
  assert.equal(rls, true);
  const policies = await rows("SELECT policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'understanding_discussion_focus'");
  assert.deepEqual(policies.map((p) => [p.policyname, p.cmd, p.roles]), [['understanding_discussion_focus_select_own', 'SELECT', '{authenticated}']]);
  assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u);
  const tablePrivileges = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'understanding_discussion_focus' AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
    ORDER BY grantee, privilege_type`);
  assert.deepEqual(tablePrivileges, [{ grantee: 'authenticated', privilege_type: 'SELECT' }], 'no client role may write the table');

  stage = 'catalog: the privileged boundary lives in a non-exposed schema';
  const fns = await rows(`SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname ~ 'understanding_discussion' AND n.nspname IN ('public', 'understanding_private') ORDER BY 1, 2`);
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname}(${f.args}) ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`), [
    'public.close_understanding_discussion_v1(p_hypothesis_id uuid) INVOKER',
    'public.open_understanding_discussion_v1(p_hypothesis_id uuid, p_expected_version integer) INVOKER',
    'understanding_private.close_understanding_discussion_v1(p_hypothesis_id uuid) DEFINER',
    'understanding_private.open_understanding_discussion_v1(p_hypothesis_id uuid, p_expected_version integer) DEFINER',
  ], 'the exposed Product RPCs are INVOKER; every DEFINER is private; no caller identity parameter anywhere');
  for (const fn of fns) assert.deepEqual(fn.proconfig, ['search_path=""'], `${fn.proname} has an empty search_path`);
  const [{ namedExposed }] = await rows(`SELECT count(*)::int AS "namedExposed" FROM pg_db_role_setting s, unnest(s.setconfig) c
    WHERE c ~ '^pgrst\\.db_schemas=' AND c ~ 'understanding_private'`);
  assert.equal(namedExposed, 0, 'no Data API configuration exposes understanding_private');

  stage = 'catalog: function privileges';
  const can = async (role, fn) => (await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, fn]))[0].allowed;
  for (const fn of ['public.open_understanding_discussion_v1(uuid, integer)', 'public.close_understanding_discussion_v1(uuid)']) {
    assert.equal(await can('authenticated', fn), true, `authenticated EXECUTE ${fn}`);
    for (const role of ['anon', 'public', 'service_role']) assert.equal(await can(role, fn), false, `${role} EXECUTE ${fn}`);
  }
  const executable = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'public') r
    WHERE n.nspname = 'understanding_private' AND p.proname ~ 'understanding_discussion' AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(executable, [
    { rolname: 'authenticated', proname: 'close_understanding_discussion_v1' },
    { rolname: 'authenticated', proname: 'open_understanding_discussion_v1' },
  ], 'no broad grant on the private schema for the discussion commands (later migrations add their own, verified by their own verifier)');
  const usage = await rows(`SELECT r AS role, has_schema_privilege(r, 'understanding_private', 'USAGE') AS usage
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role', 'public']) r ORDER BY r`);
  assert.deepEqual(usage.filter((u) => u.usage).map((u) => u.role), ['authenticated']);
}

async function verifyBehaviour() {
  stage = 'fixtures: two readers and their items';
  const reader = randomUUID();
  const other = randomUUID();
  for (const id of [reader, other]) await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  const first = await hypothesisIn(reader, 'ACTIVE');
  const second = await hypothesisIn(reader, 'ACTIVE');
  const withdrawn = await hypothesisIn(reader, 'REJECTED');
  const theirs = await hypothesisIn(other, 'ACTIVE');

  stage = 'open: the caller’s own current item at the exact version';
  await actAs('authenticated', reader);
  assert.equal(await open(first.id, first.version), 'OPENED');
  let focus = await focusOf(reader);
  assert.equal(focus.length, 1);
  assert.equal(focus[0].hypothesis_id, first.id);
  assert.equal(focus[0].hypothesis_version, first.version);
  assert.equal(focus[0].closed_at, null);

  stage = 'open: another version is STALE and writes nothing';
  const before = focus[0].opened_at;
  assert.equal(await open(second.id, second.version + 1), 'STALE');
  assert.equal(await open(second.id, second.version - 1), 'STALE');
  focus = await focusOf(reader);
  assert.equal(focus[0].hypothesis_id, first.id, 'a stale open never moves the focus');
  assert.equal(focus[0].opened_at, before);

  stage = 'open: not one of the caller’s current items is NOT_FOUND and writes nothing';
  assert.equal(await open(theirs.id, theirs.version), 'NOT_FOUND', 'another reader’s item');
  assert.equal(await open(withdrawn.id, withdrawn.version), 'NOT_FOUND', 'a withdrawn item');
  assert.equal(await open(randomUUID(), 1), 'NOT_FOUND', 'no such item');
  assert.equal((await focusOf(reader))[0].hypothesis_id, first.id);
  await rejected(() => open(first.id, 0), ['22023']);

  stage = 'open: one focus per reader, moved by a second open';
  assert.equal(await open(second.id, second.version), 'OPENED');
  focus = await focusOf(reader);
  assert.equal(focus.length, 1, 'moved, not duplicated');
  assert.equal(focus[0].hypothesis_id, second.id);

  stage = 'close: only the item the focus still names';
  assert.equal(await close(first.id), 'NONE', 'closing an old context never closes the newer one');
  assert.equal((await focusOf(reader))[0].closed_at, null);
  assert.equal(await close(second.id), 'CLOSED');
  assert.notEqual((await focusOf(reader))[0].closed_at, null);
  assert.equal(await close(second.id), 'NONE', 'idempotent');
  assert.equal(await open(second.id, second.version), 'OPENED');
  assert.equal((await focusOf(reader))[0].closed_at, null, 'a later open reopens it');

  stage = 'isolation: another reader sees nothing and cannot close it';
  await actAs('authenticated', other);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.understanding_discussion_focus'))[0].n, 0);
  assert.equal(await close(second.id), 'NONE');
  await asOwner();
  assert.equal((await focusOf(reader))[0].closed_at, null, 'the other reader changed nothing');

  stage = 'isolation: no direct write, no anon, no anonymous caller';
  await actAs('authenticated', reader);
  await rejected(() => client.query('UPDATE public.understanding_discussion_focus SET closed_at = clock_timestamp()'), ['42501']);
  await rejected(() => client.query('DELETE FROM public.understanding_discussion_focus'), ['42501']);
  await rejected(() => client.query('INSERT INTO public.understanding_discussion_focus (user_id, hypothesis_id, hypothesis_version, opened_at) VALUES ($1, $2, 1, clock_timestamp())', [reader, theirs.id]), ['42501']);
  await actAs('anon');
  await rejected(() => open(first.id, first.version), ['42501']);
  await rejected(() => close(first.id), ['42501']);
  await actAs('authenticated', null);
  await rejected(() => open(first.id, first.version), ['42501']);
  await asOwner();
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyCatalog();
      await verifyBehaviour();
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0126 Understanding discussion focus: owner-only, exact-version, one focus per reader, privileges.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
});
