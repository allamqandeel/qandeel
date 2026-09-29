// W3-02 — Account & Identity: the real-PostgreSQL verifier for migration 0125 (the Public ID and its one
// lifetime manual change, E2E-D-09).
//
// It proves, against a fully migrated database:
//   1. the catalog: the three columns, the NOT NULL Public ID, the unique index, the three row rules (shape,
//      change pair, never the own Login ID), the two triggers, the function shapes (no account parameter);
//      the privilege boundary: exactly two W3-02 functions in the exposed `public` schema, both INVOKER,
//      every privileged one in the non-exposed `account_private`; in that schema exactly ONE function is
//      executable by any client role (`authenticated`, for the INVOKER wrapper), USAGE for `authenticated`
//      only; nothing for `anon` or `service_role`; and still no client table write;
//   2. every existing account was backfilled with exactly one well-formed, unique Public ID, never its own
//      Login ID;
//   3. every new account receives one from the server, drawn from the neutral generator and never from its
//      Name, Login ID or id; a colliding draw is drawn again, and so is a draw equal to the excluded value;
//      a sign-up whose Login ID equals its freshly drawn Public ID is redrawn (all seeded, so each collision
//      is real);
//   4. the one lifetime change: normalized, committed once; a second distinct change is ALREADY_USED; the
//      same command replayed is CHANGED with the same committed truth; the same command with another value
//      is refused; confirming the current ID is UNCHANGED and consumes nothing; malformed values are INVALID;
//      a value another account holds is UNAVAILABLE and consumes nothing; the caller's OWN Login ID is INVALID
//      and consumes nothing; ANOTHER account's private Login ID is NOT in the Public namespace (no oracle); no
//      other account is touched;
//   5. the database itself refuses a second change, un-consuming the change, a change that does not
//      consume it, or a Public ID equal to the row's own Login ID — even from the table owner;
//   6. `anon` can neither read nor change; `authenticated` cannot UPDATE the table and reads only its own row;
//   7. the internal I-05 `public_identity_ref` is untouched and distinct;
//   8. concurrency, on committed state across two connections, each race proven to have really blocked:
//      two different commands of one account → exactly one CHANGED; the same command twice → CHANGED twice,
//      one value; two accounts racing for one Public ID → one CHANGED, one UNAVAILABLE.
//
// Stages 1–7 run inside one transaction that is rolled back. Stage 8 needs committed rows; its fixtures are
// removed afterwards and the removal is checked.
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

async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : '{}']);
}

async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}

/** Sign up through `auth.users`, exactly as Supabase Auth inserts a new account. */
const signUp = (id, meta) =>
  client.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2::jsonb)', [id, meta === undefined ? null : JSON.stringify(meta)]);

const GRAMMAR = /^[a-z][a-z0-9]*([._][a-z0-9]+)*$/u;
const GENERATED = /^[a-z]+[0-9]{2,4}$/u;

const publicIdOf = async (userId) => (await rows('SELECT public_id, public_id_changed_at, public_id_change_command_id FROM public.users WHERE id = $1', [userId]))[0];
const change = async (commandId, value) => (await rows('SELECT * FROM public.change_own_public_id_v1($1, $2)', [commandId, value]))[0];
const readOwn = async () => rows('SELECT * FROM public.read_own_public_id_v1()');

async function verifyCatalog() {
  stage = 'catalog: columns and rules';
  const columns = await rows(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name LIKE 'public_id%' ORDER BY column_name`,
  );
  assert.deepEqual(columns, [
    { column_name: 'public_id', data_type: 'text', is_nullable: 'NO' },
    { column_name: 'public_id_change_command_id', data_type: 'uuid', is_nullable: 'YES' },
    { column_name: 'public_id_changed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
  ]);
  const [index] = await rows("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_public_id_key'");
  assert.match(index.indexdef, /CREATE UNIQUE INDEX users_public_id_key ON public\.users USING btree \(public_id\)/u);
  const constraints = (await rows("SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname LIKE 'users_public_id%' ORDER BY conname"));
  assert.deepEqual(constraints, [
    { conname: 'users_public_id_change_pair_check', convalidated: true },
    { conname: 'users_public_id_not_own_login_id_check', convalidated: true },
    { conname: 'users_public_id_shape_check', convalidated: true },
  ]);
  const triggers = (await rows(`SELECT t.tgname, n.nspname || '.' || p.proname AS fn FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE t.tgrelid = 'public.users'::regclass AND NOT t.tgisinternal`));
  const triggerFn = Object.fromEntries(triggers.map((r) => [r.tgname, r.fn]));
  assert.equal(triggerFn.assign_public_id, 'account_private.assign_public_id_v1');
  assert.equal(triggerFn.guard_public_id_lifetime_change, 'account_private.guard_public_id_lifetime_change_v1');

  stage = 'catalog: the privileged boundary lives in a non-exposed schema';
  // Every W3-02 function, wherever it lives. Exactly two in the exposed `public` schema, both INVOKER; every
  // privileged one in `account_private`, which no Data API configuration in this database names.
  const fns = await rows(
    `SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'account_private' OR (n.nspname = 'public' AND p.proname ~ 'public_id(_|$)') ORDER BY 1, 2`,
  );
  const signature = fns.map((f) => `${f.schema}.${f.proname}(${f.args}) ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`);
  assert.deepEqual(signature, [
    'account_private.assign_public_id_v1() DEFINER',
    'account_private.change_own_public_id_v1(p_command_id uuid, p_public_id text) DEFINER',
    'account_private.generate_public_id_v1(p_excluded text) INVOKER',
    'account_private.guard_public_id_lifetime_change_v1() DEFINER',
    'account_private.is_well_formed_public_id_v1(p_value text) INVOKER',
    'account_private.normalize_public_id_v1(p_value text) INVOKER',
    'public.change_own_public_id_v1(p_command_id uuid, p_public_id text) INVOKER',
    'public.read_own_public_id_v1() INVOKER',
  ], 'the exposed Product RPCs are INVOKER; no W3-02 DEFINER is in `public`; no account parameter anywhere');
  for (const fn of fns) assert.deepEqual(fn.proconfig, ['search_path=""'], `${fn.proname} has an empty search_path`);
  const [{ exposedDefiners }] = await rows(`SELECT count(*)::int AS "exposedDefiners" FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'graphql_public') AND p.prosecdef AND p.proname ~ 'public_id(_|$)'`);
  assert.equal(exposedDefiners, 0, 'no W3-02 SECURITY DEFINER function in an exposed schema');
  const [{ namedExposed }] = await rows(`SELECT count(*)::int AS "namedExposed" FROM pg_db_role_setting s, unnest(s.setconfig) c
    WHERE c ~ '^pgrst\\.db_schemas=' AND c ~ 'account_private'`);
  assert.equal(namedExposed, 0, 'no Data API configuration exposes account_private');

  stage = 'catalog: privileges';
  const can = async (role, fn) => (await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, fn]))[0].allowed;
  for (const fn of ['public.read_own_public_id_v1()', 'public.change_own_public_id_v1(uuid, text)']) {
    assert.equal(await can('authenticated', fn), true, `authenticated EXECUTE ${fn}`);
    for (const role of ['anon', 'public', 'service_role']) assert.equal(await can(role, fn), false, `${role} EXECUTE ${fn}`);
  }
  // The whole private schema, not a list: exactly ONE function is executable by any client role, by
  // `authenticated` only, because the INVOKER Product wrapper runs as it.
  const executable = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'public') r
    WHERE n.nspname = 'account_private' AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(executable, [{ rolname: 'authenticated', proname: 'change_own_public_id_v1' }], 'no broad grant on the private schema');
  const schemaAccess = await rows(`SELECT r AS role, has_schema_privilege(r, 'account_private', 'USAGE') AS usage, has_schema_privilege(r, 'account_private', 'CREATE') AS "create"
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role', 'public']) r ORDER BY r`);
  assert.deepEqual(schemaAccess, [
    { role: 'anon', usage: false, create: false },
    { role: 'authenticated', usage: true, create: false },
    { role: 'public', usage: false, create: false },
    { role: 'service_role', usage: false, create: false },
  ], 'USAGE for `authenticated` only, CREATE for no client role');
  for (const privilege of ['UPDATE', 'INSERT', 'DELETE']) {
    const [{ allowed }] = await rows("SELECT has_table_privilege('authenticated', 'public.users', $1) AS allowed", [privilege]);
    assert.equal(allowed, false, `authenticated has no ${privilege} on public.users`);
  }
  const [{ anonRead }] = await rows("SELECT has_table_privilege('anon', 'public.users', 'SELECT') AS \"anonRead\"");
  assert.equal(anonRead, false, 'anon cannot read the account table');
  // No Public-ID lookup, search or availability function exists beside the two Product functions.
  // (The exact signature list above is also the proof: nothing else carries a Public-ID name in either schema.)
  const oracles = await rows(`SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'account_private') AND p.proname ~ '(public_id|login_id)(_|$)'
      AND p.proname !~ '^(read_own_public_id_v1|change_own_public_id_v1|login_id_is_available_v1|resolve_login_id_sign_in_email_v1)$'`);
  assert.deepEqual(oracles, [], 'no other Public-ID or Login-ID function (no lookup, no availability oracle)');
}

async function verifyBackfillAndGeneration() {
  stage = 'backfill: every existing account holds exactly one well-formed, unique Public ID';
  const [census] = await rows(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE public_id IS NULL OR NOT account_private.is_well_formed_public_id_v1(public_id))::int AS bad,
      count(*) FILTER (WHERE public_id = login_id)::int AS own_login,
      count(DISTINCT public_id)::int AS distinct_ids FROM public.users`);
  assert.equal(census.bad, 0);
  assert.equal(census.own_login, 0, 'no account holds its own Login ID as its Public ID');
  assert.equal(census.distinct_ids, census.total);

  stage = 'generation: new accounts, from the server, not from private identity';
  const accounts = [];
  for (const [name, loginId] of [['Noor Writes', 'noor.writes'], ['Mohamed Allam', 'mohamed.allam87'], ['أحمد', 'ahmed2']]) {
    const id = randomUUID();
    await signUp(id, { qandeel_name: name, qandeel_login_id: loginId });
    const row = await publicIdOf(id);
    assert.match(row.public_id, GENERATED, `a generated handle: ${row.public_id}`);
    assert.match(row.public_id, GRAMMAR);
    assert.equal(row.public_id_changed_at, null, 'the one change is available');
    for (const fragment of [loginId, loginId.split('.')[0], name.toLowerCase().split(' ')[0], id.slice(0, 8), id.replace(/-/gu, '')]) {
      assert.ok(!row.public_id.includes(fragment), `not derived from private identity: ${fragment}`);
    }
    accounts.push({ id, loginId, publicId: row.public_id });
  }
  assert.equal(new Set(accounts.map((a) => a.publicId)).size, accounts.length, 'distinct');
  const bare = randomUUID();
  await signUp(bare);
  assert.match((await publicIdOf(bare)).public_id, GENERATED, 'an account without sign-up values still gets one');

  stage = 'generation: a colliding draw is drawn again';
  await client.query('SELECT setseed(0.4242)');
  const [{ first }] = await rows('SELECT account_private.generate_public_id_v1(NULL) AS first');
  // Occupy exactly that value through the real change path, then replay the same random sequence.
  const holder = randomUUID();
  await signUp(holder);
  await actAs('authenticated', holder);
  assert.equal((await change(randomUUID(), first)).outcome, 'CHANGED');
  await asOwner();
  await client.query('SELECT setseed(0.4242)');
  const [{ second }] = await rows('SELECT account_private.generate_public_id_v1(NULL) AS second');
  assert.notEqual(second, first, 'the held candidate was not handed out again');
  assert.match(second, GENERATED);

  stage = 'generation: the excluded value (the same account’s Login ID) is drawn again, deterministically';
  await client.query('SELECT setseed(0.2718)');
  const [{ natural }] = await rows('SELECT account_private.generate_public_id_v1(NULL) AS natural');
  await client.query('SELECT setseed(0.2718)');
  const [{ excluded }] = await rows('SELECT account_private.generate_public_id_v1($1) AS excluded', [natural]);
  assert.notEqual(excluded, natural, 'the same random draw, refused because it equals the excluded value');
  assert.match(excluded, GENERATED);

  stage = 'generation: a sign-up whose Login ID equals its freshly drawn Public ID gets a redraw';
  // First prove the seed makes the sign-up draw a KNOWN value, so the redraw below is a real collision.
  await client.query('SELECT setseed(0.3141)');
  const probe = randomUUID();
  await signUp(probe);
  const drawn = (await publicIdOf(probe)).public_id;
  await client.query('DELETE FROM public.users WHERE id = $1', [probe]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [probe]);
  await client.query('SELECT setseed(0.3141)');
  const twin = randomUUID();
  await signUp(twin, { qandeel_name: 'Twin', qandeel_login_id: drawn });
  const [twinRow] = await rows('SELECT public_id, login_id, public_id_changed_at FROM public.users WHERE id = $1', [twin]);
  assert.equal(twinRow.login_id, drawn, 'the sign-up really chose the value the server first drew');
  assert.notEqual(twinRow.public_id, twinRow.login_id, 'the Public ID was redrawn, never left equal to the own Login ID');
  assert.match(twinRow.public_id, GENERATED);
  assert.equal(twinRow.public_id_changed_at, null, 'the redraw consumed nothing');

  stage = 'generation: a supplied value is never trusted';
  const direct = randomUUID();
  await client.query('INSERT INTO public.users (id, auth_subject, public_id) VALUES ($1::uuid, $1::text, $2)', [direct, 'chosen.by.caller']);
  assert.notEqual((await publicIdOf(direct)).public_id, 'chosen.by.caller');
  return accounts;
}

async function verifyOneLifetimeChange(accounts) {
  const [a, b, c] = accounts;

  stage = 'change: malformed values are INVALID and consume nothing';
  await actAs('authenticated', a.id);
  for (const value of ['', '  ', '@', 'ab', 'x'.repeat(25), '1abc', '.abc', 'abc.', 'ab..cd', 'ab._cd', 'ab-cd', 'ab cd', 'نور', 'ab$c', '@@abc', null]) {
    const answer = await change(randomUUID(), value);
    assert.deepEqual([answer.outcome, answer.change_available], ['INVALID', true], `INVALID: ${value}`);
  }
  await rejected(() => change(null, 'fine.value'), ['22023']);

  stage = 'change: confirming the current Public ID is UNCHANGED and consumes nothing';
  const same = await change(randomUUID(), `  @${a.publicId.toUpperCase()} `);
  assert.deepEqual([same.outcome, same.current_public_id, same.change_available], ['UNCHANGED', a.publicId, true]);

  stage = 'change: another account’s Public ID is UNAVAILABLE, in any case, and consumes nothing';
  const taken = await change(randomUUID(), `@${b.publicId.toUpperCase()}`);
  assert.deepEqual([taken.outcome, taken.current_public_id, taken.change_available], ['UNAVAILABLE', a.publicId, true]);
  assert.deepEqual(Object.keys(taken), ['outcome', 'current_public_id', 'change_available'], 'nothing about the holder is returned');

  stage = 'change: normalized and committed once';
  const command = randomUUID();
  const done = await change(command, '  @Noor.Writes٢٧ ');
  assert.deepEqual([done.outcome, done.current_public_id, done.change_available], ['CHANGED', 'noor.writes27', false]);
  await asOwner();
  const committed = await publicIdOf(a.id);
  assert.deepEqual([committed.public_id, committed.public_id_change_command_id], ['noor.writes27', command]);
  assert.ok(committed.public_id_changed_at instanceof Date);
  assert.equal((await publicIdOf(b.id)).public_id, b.publicId, 'no other account was touched');

  stage = 'change: the same command replayed answers the committed truth';
  await actAs('authenticated', a.id);
  const replay = await change(command, 'NOOR.WRITES27');
  assert.deepEqual([replay.outcome, replay.current_public_id, replay.change_available], ['CHANGED', 'noor.writes27', false]);
  await rejected(() => change(command, 'another.value'), ['23505']);

  stage = 'change: a second distinct change fails closed';
  const second = await change(randomUUID(), 'another.value');
  assert.deepEqual([second.outcome, second.current_public_id, second.change_available], ['ALREADY_USED', 'noor.writes27', false]);
  const stillSame = await change(randomUUID(), '@noor.writes27');
  assert.equal(stillSame.outcome, 'UNCHANGED', 'confirming the current value is never a failure');
  await asOwner();
  const after = await publicIdOf(a.id);
  assert.deepEqual([after.public_id, after.public_id_change_command_id, after.public_id_changed_at.getTime()],
    [committed.public_id, committed.public_id_change_command_id, committed.public_id_changed_at.getTime()], 'nothing moved');

  stage = 'change: the caller’s OWN Login ID is INVALID, in any case and form, and consumes nothing';
  await actAs('authenticated', c.id);
  for (const value of [c.loginId, `  @${c.loginId.toUpperCase()} `, c.loginId.replace('2', '٢')]) {
    const own = await change(randomUUID(), value);
    assert.deepEqual([own.outcome, own.current_public_id, own.change_available], ['INVALID', c.publicId, true], `own Login ID: ${value}`);
  }
  await asOwner();
  assert.equal((await publicIdOf(c.id)).public_id_changed_at, null, 'nothing was consumed');

  stage = 'change: another account’s private Login ID is not in the Public namespace (no oracle)';
  // Another account's Login ID is neither INVALID nor UNAVAILABLE: it is never consulted.
  await actAs('authenticated', c.id);
  const loginIdAsPublic = await change(randomUUID(), b.loginId);
  assert.equal(loginIdAsPublic.outcome, 'CHANGED', 'another account’s Login ID is not "unavailable": the namespaces are separate');

  stage = 'read: the caller’s own Public ID and allowance, nothing else';
  await actAs('authenticated', b.id);
  assert.deepEqual(await readOwn(), [{ current_public_id: b.publicId, change_available: true }]);
  await actAs('authenticated', a.id);
  assert.deepEqual(await readOwn(), [{ current_public_id: 'noor.writes27', change_available: false }]);
  const visible = await rows('SELECT id FROM public.users');
  assert.deepEqual(visible.map((r) => r.id), [a.id], 'authenticated sees only its own account row');
  await asOwner();
}

async function verifyDatabaseAuthority(accounts) {
  const [, b] = accounts;
  stage = 'authority: the database refuses what the app must never be trusted with';
  // Changing without consuming.
  await rejected(() => client.query("UPDATE public.users SET public_id = 'sneaky.change' WHERE id = $1", [b.id]), ['23514']);
  // The own-Login-ID rule binds the owner too, from either side: a consuming change to it, …
  const ownChange = await rejected(() => client.query('UPDATE public.users SET public_id = login_id, public_id_changed_at = clock_timestamp(), public_id_change_command_id = gen_random_uuid() WHERE id = $1', [b.id]), ['23514']);
  assert.equal(ownChange.constraint, 'users_public_id_not_own_login_id_check');
  // … and moving an assigned Login ID onto the Public ID (only the FIRST assignment at sign-up is redrawn).
  const ownMove = await rejected(() => client.query('UPDATE public.users SET login_id = public_id WHERE id = $1', [b.id]), ['23514']);
  assert.equal(ownMove.constraint, 'users_public_id_not_own_login_id_check');
  // Consuming it properly once (as the owner, to prove the rule binds the owner too) …
  await client.query("UPDATE public.users SET public_id = 'owner.path', public_id_changed_at = clock_timestamp(), public_id_change_command_id = gen_random_uuid() WHERE id = $1", [b.id]);
  // … then a second change, and un-consuming it, are refused.
  await rejected(() => client.query("UPDATE public.users SET public_id = 'second.change', public_id_changed_at = clock_timestamp(), public_id_change_command_id = gen_random_uuid() WHERE id = $1", [b.id]), ['23514']);
  await rejected(() => client.query('UPDATE public.users SET public_id_changed_at = NULL, public_id_change_command_id = NULL WHERE id = $1', [b.id]), ['23514']);
  await rejected(() => client.query("UPDATE public.users SET public_id = 'Upper.Case' WHERE id = $1", [b.id]), ['23514']);
  // Unrelated account writes still work (the guard is not a lock on the row).
  await client.query("UPDATE public.users SET updated_at = clock_timestamp() WHERE id = $1", [b.id]);

  stage = 'authority: client roles';
  await actAs('anon');
  await rejected(() => readOwn(), ['42501']);
  await rejected(() => change(randomUUID(), 'anon.try'), ['42501']);
  await actAs('authenticated', b.id);
  await rejected(() => client.query("UPDATE public.users SET public_id = 'direct.write' WHERE id = $1", [b.id]), ['42501']);
  for (const internal of ['account_private.generate_public_id_v1(NULL)', "account_private.normalize_public_id_v1('x')", "account_private.is_well_formed_public_id_v1('abc')"]) {
    await rejected(() => rows(`SELECT ${internal}`), ['42501']);
  }
  await actAs('anon');
  await rejected(() => rows(`SELECT * FROM account_private.change_own_public_id_v1('${randomUUID()}', 'anon.try')`), ['42501']);
  await asOwner();

  stage = 'authority: the internal Public ref is untouched and distinct';
  const refColumns = (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_identities' ORDER BY ordinal_position")).map((r) => r.column_name);
  assert.deepEqual(refColumns, ['public_identity_ref', 'user_id', 'created_at'], 'the I-05 relation is unchanged');
  const [{ refUsesPublicId }] = await rows(`SELECT count(*)::int AS "refUsesPublicId" FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'account_private' OR (n.nspname = 'public' AND p.proname ~ 'public_id(_|$)')) AND p.prosrc ~ 'public_identit'`);
  assert.equal(refUsesPublicId, 0, 'the Public ID functions never read or write the internal Public ref');
}

// ------------------------------------------------------------------------------------------------------
// Stage 8 — concurrency on committed state, across two connections.
// ------------------------------------------------------------------------------------------------------

async function waitUntilBlocked(pid) {
  for (let i = 0; i < 200; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

/** Run `first` to its lock, start `second` and prove it blocks, then commit both. */
async function race(firstUser, firstCall, secondUser, secondCall) {
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one.query('BEGIN');
    await actAs('authenticated', firstUser, one);
    const a = (await one.query('SELECT * FROM public.change_own_public_id_v1($1, $2)', firstCall)).rows[0];
    await two.query('BEGIN');
    await actAs('authenticated', secondUser, two);
    const pending = two.query('SELECT * FROM public.change_own_public_id_v1($1, $2)', secondCall).then((r) => r.rows[0]);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    const b = await pending;
    await two.query('COMMIT');
    return [a, b];
  } finally {
    await one.end();
    await two.end();
  }
}

async function verifyConcurrency() {
  const fixtures = Array.from({ length: 4 }, () => randomUUID());
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    for (const id of fixtures) await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
    await client.query('COMMIT');
    const [solo, twice, left, right] = fixtures;
    const suffix = randomUUID().slice(0, 6).replace(/[^a-z0-9]/gu, 'x');

    stage = 'concurrency: two different commands of one account — exactly one wins';
    const [x, y] = await race(solo, [randomUUID(), `race.one${suffix}`], solo, [randomUUID(), `race.two${suffix}`]);
    assert.deepEqual([x.outcome, y.outcome], ['CHANGED', 'ALREADY_USED']);
    assert.equal(y.current_public_id, `race.one${suffix}`);

    stage = 'concurrency: the same command twice — one committed value, answered twice';
    const command = randomUUID();
    const [p, q] = await race(twice, [command, `same.cmd${suffix}`], twice, [command, `same.cmd${suffix}`]);
    assert.deepEqual([p.outcome, q.outcome, q.current_public_id], ['CHANGED', 'CHANGED', `same.cmd${suffix}`]);

    stage = 'concurrency: two accounts racing for one Public ID — one wins, one is UNAVAILABLE';
    const [m, n] = await race(left, [randomUUID(), `contested${suffix}`], right, [randomUUID(), `contested${suffix}`]);
    assert.deepEqual([m.outcome, n.outcome, n.change_available], ['CHANGED', 'UNAVAILABLE', true]);
    const [{ holders }] = await rows('SELECT count(*)::int AS holders FROM public.users WHERE public_id = $1', [`contested${suffix}`]);
    assert.equal(holders, 1);
  } finally {
    stage = 'concurrency: fixture removal';
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [fixtures]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [fixtures]);
    const [{ residue }] = await rows('SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS residue', [fixtures]);
    assert.equal(Number(residue), 0, 'the committed fixtures are gone');
  }
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      stage = 'fixture shape';
      await client.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb');
      await verifyCatalog();
      const accounts = await verifyBackfillAndGeneration();
      await verifyOneLifetimeChange(accounts);
      await verifyDatabaseAuthority(accounts);
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    console.log('Verified migration 0125 Public ID: backfill, server generation, the one lifetime change (idempotent, concurrent, database-enforced), privileges and no oracle.');
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
