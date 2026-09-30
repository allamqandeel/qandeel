// W3-MEGA-A — Account & Identity Completion + Security v1: the real-PostgreSQL verifier for migration 0129.
//
// It proves, against a fully migrated database:
//   1. the catalog and the privilege boundary: every new function's schema and security mode; every privileged one
//      in the non-exposed `account_private`; the exact client-executable set there; the Shared ID functions and the
//      Login ID ledger reachable by NO client role and not by the server channel;
//   2. the owner's identity read: own row only, and `anon` is refused;
//   3. the Name change: trimmed exactly as sign-up stores it, CHANGED / UNCHANGED / INVALID, another account
//      untouched, and still no client table write;
//   4. the Login ID change: refused without a RECENT password proof (none, stale, or another method) before
//      anything is written; normalized and committed with one; the OLD Login ID stops resolving and the NEW one
//      resolves at the commit, with the Email unchanged; UNCHANGED; INVALID for a malformed value and for the
//      caller's OWN Public ID; UNAVAILABLE for another account's Login ID, which names nobody; the same command
//      replayed is CHANGED; the same command for another value is refused; the ledger keeps a digest, never the
//      value;
//   5. the Shared ID format: the normalizer (case, spaces, hyphens, look-alikes, refusals); the generator's shape
//      and spread; the server-generated regeneration: first setup, replay, a typed lower-case Shared ID resolving
//      through the frozen 0081 submission, and regeneration invalidating the PENDING invitation of the old epoch
//      while the old value stops resolving;
//   6. concurrency on committed state across two connections, each proven to have blocked: two accounts racing
//      for one Login ID → one CHANGED, one UNAVAILABLE; the same command twice → CHANGED twice, one value.
//
// Stages 1–5 run inside one transaction that is rolled back. Stage 6 needs committed rows; its fixtures are
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

const nowSeconds = () => Math.floor(Date.now() / 1000);
/** A provider password authentication `ageSeconds` ago, exactly as the token's `amr` claim carries it. */
const passwordProof = (ageSeconds = 5, method = 'password') => [{ method, timestamp: nowSeconds() - ageSeconds }];

async function actAs(role, userId = null, { amr } = {}, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  const claims = userId ? { sub: userId, role, ...(amr ? { amr } : {}) } : {};
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
}

async function asOwner(userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

/** Sign up through `auth.users`, exactly as Supabase Auth inserts a new account. */
const signUp = (id, email, name, loginId) =>
  client.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)',
    [id, email, JSON.stringify({ qandeel_name: name, qandeel_login_id: loginId })]);

const identityOf = async (userId) => (await rows('SELECT name, login_id, public_id FROM public.users WHERE id = $1', [userId]))[0];
const changeName = async (value) => (await rows('SELECT * FROM public.change_own_account_name_v1($1)', [value]))[0];
const changeLoginId = async (commandId, value) => (await rows('SELECT * FROM public.change_own_login_id_v1($1, $2)', [commandId, value]))[0];
const resolve = async (loginId) => (await rows('SELECT public.resolve_login_id_sign_in_email_v1($1) AS email', [loginId]))[0].email;

const SHARED_ID = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u;

async function verifyCatalog() {
  stage = 'catalog: every 0129 function, its schema and its security mode';
  const fns = await rows(
    `SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname IN ('read_own_account_identity_v1', 'change_own_account_name_v1', 'has_recent_password_proof_v1', 'change_own_login_id_v1',
                          'normalize_shared_id_v1', 'generate_shared_id_v1', 'shared_id_lookup_ref_v1', 'regenerate_own_shared_id_v1') ORDER BY 1, 2`,
  );
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname} ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`), [
    'account_private.change_own_account_name_v1 DEFINER',
    'account_private.change_own_login_id_v1 DEFINER',
    'account_private.generate_shared_id_v1 INVOKER',
    'account_private.has_recent_password_proof_v1 INVOKER',
    'account_private.normalize_shared_id_v1 INVOKER',
    'account_private.regenerate_own_shared_id_v1 DEFINER',
    'account_private.shared_id_lookup_ref_v1 INVOKER',
    'public.change_own_account_name_v1 INVOKER',
    'public.change_own_login_id_v1 INVOKER',
    'public.read_own_account_identity_v1 INVOKER',
  ]);
  for (const f of fns) assert.ok((f.proconfig ?? []).includes('search_path=""'), `${f.schema}.${f.proname} pins an empty search_path`);

  stage = 'catalog: no account parameter on any 0129 command';
  const [{ accountParameters }] = await rows(`SELECT count(*)::int AS "accountParameters" FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname IN ('change_own_account_name_v1', 'change_own_login_id_v1', 'regenerate_own_shared_id_v1')
      AND pg_get_function_identity_arguments(p.oid) ~ 'p_(user|account|actor|owner)'`);
  assert.equal(accountParameters, 0, 'the caller is the token’s, never a parameter');

  stage = 'catalog: the client-executable set of the private schema is exact';
  const executable = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'public') r
    WHERE n.nspname = 'account_private' AND EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname OR r.rolname = 'public')
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(executable, [
    { rolname: 'authenticated', proname: 'change_own_account_name_v1' },
    { rolname: 'authenticated', proname: 'change_own_login_id_v1' },
    { rolname: 'authenticated', proname: 'change_own_public_id_v1' },
  ], 'the Shared ID functions and the proof check are reachable by no client role');

  stage = 'catalog: the ledger is reachable by no client role';
  const [ledger] = await rows(`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'account_private' AND c.relname = 'login_id_change_commands'`);
  assert.equal(ledger.relrowsecurity, true);
  const tablePrivileges = await rows(`SELECT r AS role FROM unnest(ARRAY['anon', 'authenticated']) r
    WHERE has_table_privilege(r, 'account_private.login_id_change_commands', 'SELECT,INSERT,UPDATE,DELETE')`);
  assert.deepEqual(tablePrivileges, [], 'no client privilege on the ledger');
  const [{ ledgerColumns }] = await rows(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) AS "ledgerColumns"
    FROM information_schema.columns WHERE table_schema = 'account_private' AND table_name = 'login_id_change_commands'`);
  assert.equal(ledgerColumns, 'command_id,user_id,requested_digest,committed_at', 'the ledger holds no Login ID in clear');

  stage = 'catalog: still no client table write on the account row';
  const writes = await rows(`SELECT r AS role FROM unnest(ARRAY['anon', 'authenticated']) r
    WHERE has_table_privilege(r, 'public.users', 'INSERT,UPDATE,DELETE')`);
  assert.deepEqual(writes, []);
}

async function verifyIdentityAndName(accounts) {
  const { a, b, legacy } = accounts;

  stage = 'identity read: the owner’s own Name and Login ID, nothing else';
  await actAs('authenticated', a);
  assert.deepEqual(await rows('SELECT * FROM public.read_own_account_identity_v1()'), [{ name: 'Noor Hassan', login_id: 'noor.h' }]);
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.read_own_account_identity_v1()'), ['42501']);

  stage = 'name: trimmed exactly as sign-up stores it, committed once';
  await actAs('authenticated', a);
  assert.deepEqual(await changeName('  Noor A. Hassan  '), { outcome: 'CHANGED', current_name: 'Noor A. Hassan' });
  assert.deepEqual(await changeName('Noor A. Hassan'), { outcome: 'UNCHANGED', current_name: 'Noor A. Hassan' });
  assert.deepEqual(await changeName('نور'), { outcome: 'CHANGED', current_name: 'نور' }, 'one Name field, any script');

  stage = 'name: INVALID writes nothing';
  for (const bad of ['', '   ', 'x'.repeat(81), 'Noor\nHassan', 'Noor\tHassan', null]) {
    assert.deepEqual(await changeName(bad), { outcome: 'INVALID', current_name: 'نور' }, `INVALID: ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(await changeName('x'.repeat(80)), { outcome: 'CHANGED', current_name: 'x'.repeat(80) }, '80 is the bound');

  stage = 'name: an account without a sign-up identity is INVALID (0123 pair rule)';
  await actAs('authenticated', legacy);
  assert.deepEqual(await changeName('Someone'), { outcome: 'INVALID', current_name: null });

  stage = 'name: another account is untouched, and the table is not writable';
  await asOwner();
  assert.equal((await identityOf(b)).name, 'Sara Ali');
  await actAs('authenticated', b);
  await rejected(() => client.query("UPDATE public.users SET name = 'direct' WHERE id = $1", [b]), ['42501']);
  await actAs('anon');
  await rejected(() => changeName('anon'), ['42501']);
  await asOwner();
}

async function verifyLoginIdChange(accounts) {
  const { a, b } = accounts;

  stage = 'login id: no proof, a proof over a minute old, a future one or another method writes nothing';
  for (const amr of [undefined, passwordProof(90), passwordProof(600), passwordProof(5, 'otp'), passwordProof(-600)]) {
    await actAs('authenticated', a, { amr });
    const refusal = await rejected(() => changeLoginId(randomUUID(), 'noor.new'), ['42501']);
    assert.match(refusal.message, /LOGIN_ID_REAUTHENTICATION_REQUIRED/u);
  }
  await asOwner();
  assert.equal((await identityOf(a)).login_id, 'noor.h');
  assert.equal(Number((await rows('SELECT count(*) AS n FROM account_private.login_id_change_commands'))[0].n), 0);

  stage = 'login id: a recent password proof commits the normalized value; the old one stops resolving at once';
  await asOwner();
  assert.equal(await resolve('noor.h'), 'noor@example.test');
  const command = randomUUID();
  await actAs('authenticated', a, { amr: passwordProof() });
  assert.deepEqual(await changeLoginId(command, '  Noor.New  '), { outcome: 'CHANGED', current_login_id: 'noor.new' });
  await asOwner();
  assert.equal(await resolve('noor.h'), null, 'the old Login ID stops working immediately');
  assert.equal(await resolve('NOOR.NEW'), 'noor@example.test', 'the new one signs in to the same account');
  assert.equal((await rows('SELECT email FROM auth.users WHERE id = $1', [a]))[0].email, 'noor@example.test', 'the Email is unchanged');

  stage = 'login id: the ledger keeps a digest of the value, never the value';
  const ledger = await rows('SELECT requested_digest FROM account_private.login_id_change_commands WHERE command_id = $1', [command]);
  assert.equal(ledger.length, 1);
  assert.match(ledger[0].requested_digest, /^[0-9a-f]{64}$/u);
  assert.notEqual(ledger[0].requested_digest, 'noor.new');

  stage = 'login id: replay, conflict, UNCHANGED, INVALID, UNAVAILABLE';
  await actAs('authenticated', a, { amr: passwordProof() });
  assert.deepEqual(await changeLoginId(command, 'noor.new'), { outcome: 'CHANGED', current_login_id: 'noor.new' }, 'the same command replayed');
  const conflict = await rejected(() => changeLoginId(command, 'noor.other'), ['23505']);
  assert.match(conflict.message, /LOGIN_ID_COMMAND_CONFLICT/u);
  assert.deepEqual(await changeLoginId(randomUUID(), 'NOOR.NEW'), { outcome: 'UNCHANGED', current_login_id: 'noor.new' });
  for (const bad of ['no', 'x'.repeat(31), 'noor..h', '.noor', 'noor h', 'نور', '']) {
    assert.deepEqual(await changeLoginId(randomUUID(), bad), { outcome: 'INVALID', current_login_id: 'noor.new' }, `INVALID: ${bad}`);
  }
  await asOwner();
  const { public_id: ownPublicId } = await identityOf(a);
  await actAs('authenticated', a, { amr: passwordProof() });
  assert.deepEqual(await changeLoginId(randomUUID(), ownPublicId.toUpperCase()), { outcome: 'INVALID', current_login_id: 'noor.new' },
    'the caller’s OWN Public ID is INVALID (same-row rule)');
  assert.deepEqual(await changeLoginId(randomUUID(), 'sara.a'), { outcome: 'UNAVAILABLE', current_login_id: 'noor.new' },
    'another account’s Login ID is UNAVAILABLE and names nobody');
  await asOwner();
  assert.equal((await identityOf(b)).login_id, 'sara.a', 'no other account is touched');
  assert.equal((await identityOf(a)).login_id, 'noor.new');

  stage = 'login id: the other account cannot replay this account’s command';
  await actAs('authenticated', b, { amr: passwordProof() });
  await rejected(() => changeLoginId(command, 'noor.new'), ['23505']);

  stage = 'login id: no cooldown and no lifetime limit';
  await actAs('authenticated', a, { amr: passwordProof() });
  assert.equal((await changeLoginId(randomUUID(), 'noor.third')).outcome, 'CHANGED');
  assert.equal((await changeLoginId(randomUUID(), 'noor.h')).outcome, 'CHANGED', 'a released value can be taken back');
  await actAs('anon');
  await rejected(() => changeLoginId(randomUUID(), 'anon.try'), ['42501']);
  await asOwner();
}

async function verifySharedId(accounts) {
  const { a, b } = accounts;

  stage = 'shared id: the normalizer';
  const normalize = async (value) => (await rows('SELECT account_private.normalize_shared_id_v1($1) AS v', [value]))[0].v;
  assert.equal(await normalize('K7QM-4XWD-P9TR'), 'K7QM-4XWD-P9TR');
  assert.equal(await normalize(' k7qm 4xwd p9tr '), 'K7QM-4XWD-P9TR', 'case-insensitive; spaces ignored');
  assert.equal(await normalize('k7qm4xwdp9tr'), 'K7QM-4XWD-P9TR', 'separators are optional');
  assert.equal(await normalize('K7QM-4XWD-P9TO'), 'K7QM-4XWD-P9T0', 'O reads as 0');
  assert.equal(await normalize('K7QM-4XWD-PITL'), 'K7QM-4XWD-P1T1', 'I and L read as 1');
  for (const bad of ['K7QM-4XWD-P9T', 'K7QM-4XWD-P9TRX', 'U7QM-4XWD-P9TR', 'K7QM_4XWD_P9TR', '', null]) {
    assert.equal(await normalize(bad), null, `not a Shared ID: ${bad}`);
  }

  stage = 'shared id: the generator';
  const draws = (await rows('SELECT account_private.generate_shared_id_v1() AS v FROM generate_series(1, 400)')).map((r) => r.v);
  for (const value of draws) assert.match(value, SHARED_ID);
  assert.equal(new Set(draws).size, draws.length, 'no repeat in 400 draws');
  const characters = new Set(draws.join('').replace(/-/gu, ''));
  assert.ok(characters.size >= 30, `the draw spreads over the alphabet (${characters.size})`);
  for (const value of draws) assert.equal(await normalize(value.toLowerCase()), value, 'every generated value survives normalization');

  stage = 'shared id: the derived lookup reference (0081 representation boundary)';
  const refOf = async (value) => (await rows('SELECT account_private.shared_id_lookup_ref_v1($1) AS r', [value]))[0].r;
  const REF = /^sid1:[0-9a-f]{64}$/u;
  assert.match(await refOf('K7QM-4XWD-P9TR'), REF);
  assert.equal(await refOf(' k7qm 4xwd p9tr '), await refOf('K7QM-4XWD-P9TR'), 'one reference for every spelling of one Shared ID');
  assert.notEqual(await refOf('K7QM-4XWD-P9TR'), await refOf('K7QM-4XWD-P9TS'));
  // R1: 'not a shared id' was a wrong fixture — without spaces it is 12 valid alphabet characters. U is outside the
  // alphabet (and not a look-alike), so this cannot be a Shared ID under any spelling.
  assert.equal(await refOf('K7QM 4XWD P9TU'), null, 'not a Shared ID: U is outside the alphabet');

  stage = 'shared id: server-generated first setup; the value is returned once and stored nowhere';
  const regenerate = async (commandId) => (await rows('SELECT * FROM account_private.regenerate_own_shared_id_v1($1)', [commandId]))[0];
  const stateOf = async (userId) => (await rows('SELECT credential_lookup_ref, epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [userId]))[0];
  const setup = randomUUID();
  await asOwner(a);
  const created = await regenerate(setup);
  assert.equal(created.command_id, setup);
  assert.equal(created.credential_epoch, '1');
  assert.match(created.shared_id, SHARED_ID);
  const first = await stateOf(a);
  assert.equal(first.credential_lookup_ref, await refOf(created.shared_id), 'state holds only the derived reference');
  assert.doesNotMatch(first.credential_lookup_ref, SHARED_ID);
  await asOwner();
  const [{ inClear }] = await rows(`SELECT (SELECT count(*) FROM public.shared_world_invite_credential_state WHERE credential_lookup_ref = $1)
      + (SELECT count(*) FROM public.shared_world_invitation_commands WHERE credential_lookup_ref = $1) AS "inClear"`, [created.shared_id]);
  assert.equal(Number(inClear), 0, 'no Shared ID is stored in clear, in state or in command history');
  await asOwner(a);
  assert.deepEqual(await regenerate(setup), { command_id: setup, credential_epoch: '1', shared_id: null }, 'a replay answers its epoch and no value');
  assert.deepEqual(await stateOf(a), first, 'a replay changes nothing');

  stage = 'shared id: a typed lower-case Shared ID reaches its owner through the frozen submission';
  // The typed value becomes its reference where the future W6 boundary will derive it (the private adapter is not a
  // client RPC), then is submitted exactly as 0081 accepts a reference.
  const invitation = randomUUID();
  const typed = created.shared_id.toLowerCase().replace(/-/gu, ' ');
  await asOwner();
  const typedRef = await refOf(typed);
  assert.equal(typedRef, first.credential_lookup_ref);
  await actAs('authenticated', b);
  assert.equal((await rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitation, typedRef]))[0].outcome, 'SUBMITTED');
  await asOwner();
  assert.deepEqual((await rows('SELECT status, target_credential_epoch FROM public.shared_world_direct_invitations WHERE id = $1', [invitation]))[0],
    { status: 'PENDING', target_credential_epoch: '1' });

  stage = 'shared id: regeneration advances the epoch, invalidates the old PENDING invitation, and retires the old value';
  const rotation = randomUUID();
  await asOwner(a);
  const rotated = await regenerate(rotation);
  assert.equal(rotated.credential_epoch, '2');
  assert.match(rotated.shared_id, SHARED_ID);
  assert.notEqual(rotated.shared_id, created.shared_id);
  const second = await stateOf(a);
  assert.equal(second.credential_lookup_ref, await refOf(rotated.shared_id));
  await asOwner();
  assert.equal((await rows('SELECT status FROM public.shared_world_direct_invitations WHERE id = $1', [invitation]))[0].status, 'INVALIDATED');
  await actAs('authenticated', b);
  await rejected(() => rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), randomUUID(), typedRef]), ['P0002']);
  await asOwner(a);
  assert.deepEqual(await regenerate(setup), { command_id: setup, credential_epoch: '1', shared_id: null }, 'the first command still answers its own committed truth');
  assert.deepEqual(await stateOf(a), second);

  stage = 'shared id: no client role may generate, normalize or regenerate';
  for (const role of ['authenticated', 'anon']) {
    await actAs(role, role === 'anon' ? null : a);
    for (const call of ['account_private.generate_shared_id_v1()', "account_private.normalize_shared_id_v1('x')", "account_private.shared_id_lookup_ref_v1('x')", `* FROM account_private.regenerate_own_shared_id_v1('${randomUUID()}')`]) {
      await rejected(() => rows(`SELECT ${call}`), ['42501']);
    }
    await rejected(() => rows('SELECT account_private.has_recent_password_proof_v1()'), ['42501']);
  }
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------
// Stage 6 — concurrency on committed state, across two connections.
// ------------------------------------------------------------------------------------------------------

async function waitUntilBlocked(pid) {
  for (let i = 0; i < 200; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

async function race(firstUser, firstCall, secondUser, secondCall) {
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one.query('BEGIN');
    await actAs('authenticated', firstUser, { amr: passwordProof() }, one);
    const a = (await one.query('SELECT * FROM public.change_own_login_id_v1($1, $2)', firstCall)).rows[0];
    await two.query('BEGIN');
    await actAs('authenticated', secondUser, { amr: passwordProof() }, two);
    const pending = two.query('SELECT * FROM public.change_own_login_id_v1($1, $2)', secondCall).then((r) => r.rows[0]);
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
  const fixtures = Array.from({ length: 3 }, () => randomUUID());
  const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    for (const [index, id] of fixtures.entries()) {
      await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
      await client.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, `Racer ${index}`, `racer${index}${suffix}`]);
    }
    await client.query('COMMIT');
    const [left, right, twice] = fixtures;

    stage = 'concurrency: two accounts racing for one Login ID — one wins, one is UNAVAILABLE';
    const [m, n] = await race(left, [randomUUID(), `contested${suffix}`], right, [randomUUID(), `contested${suffix}`]);
    assert.deepEqual([m.outcome, n.outcome, n.current_login_id], ['CHANGED', 'UNAVAILABLE', `racer1${suffix}`]);
    const [{ holders }] = await rows('SELECT count(*)::int AS holders FROM public.users WHERE login_id = $1', [`contested${suffix}`]);
    assert.equal(holders, 1);

    stage = 'concurrency: the same command twice — one committed value, answered twice';
    const command = randomUUID();
    const [p, q] = await race(twice, [command, `same${suffix}`], twice, [command, `same${suffix}`]);
    assert.deepEqual([p.outcome, q.outcome, q.current_login_id], ['CHANGED', 'CHANGED', `same${suffix}`]);
    const [{ entries }] = await rows('SELECT count(*)::int AS entries FROM account_private.login_id_change_commands WHERE command_id = $1', [command]);
    assert.equal(entries, 1);
  } finally {
    stage = 'concurrency: fixture removal';
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [fixtures]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [fixtures]);
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM account_private.login_id_change_commands WHERE user_id = ANY($1::uuid[])) AS residue`, [fixtures]);
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
      await client.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text');
      await verifyCatalog();
      stage = 'fixtures';
      const accounts = { a: randomUUID(), b: randomUUID(), legacy: randomUUID() };
      await signUp(accounts.a, 'noor@example.test', 'Noor Hassan', 'noor.h');
      await signUp(accounts.b, 'sara@example.test', 'Sara Ali', 'sara.a');
      await client.query('INSERT INTO auth.users (id) VALUES ($1)', [accounts.legacy]);
      await verifyIdentityAndName(accounts);
      await verifyLoginIdChange(accounts);
      await verifySharedId(accounts);
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    console.log('Verified migration 0129: identity read, Name change, Login ID change behind a recent password proof (cut-over, idempotent, concurrent), Shared ID format and server-generated regeneration, privileges.');
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
