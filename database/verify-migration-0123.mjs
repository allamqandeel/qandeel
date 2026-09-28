// W1B-01 — Account identity + first use: the real-PostgreSQL verifier for migration 0123.
//
// It proves, against a fully migrated database:
//   1. the canonical Name and Login ID columns, their shape checks and the case-insensitive
//      uniqueness of the Login ID;
//   2. that `auth.users` provisioning still creates EXACTLY ONE `public.users` row, with the two
//      sign-up values copied in, and that an account created without them keeps NULL (no fallback);
//   3. that malformed or duplicate sign-up values refuse the whole `auth.users` insert, so a modified
//      client cannot bypass the database's validation;
//   4. that the availability check answers a boolean only, to the server channel only;
//   5. that the first-use read and the Welcome completion are the caller's own, and that no client
//      gained a table write on `public.users`;
//   6. that the existing Conversation foreign keys and row-level security still hold for a new account.
//
// Everything runs inside one transaction that is rolled back. The disposable CI bootstrap gives
// `auth.users` only an `id`; the real Supabase table carries `raw_user_meta_data`, so the verifier
// adds that one column inside its own transaction, exactly as Supabase shapes it.
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

/** Sign up through `auth.users`, exactly as Supabase Auth inserts a new account. */
const signUp = (id, meta) => client.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2::jsonb)', [id, meta === undefined ? null : JSON.stringify(meta)]);
const account = async (id) => rows('SELECT id, auth_subject, name, login_id, first_use_completed_at FROM public.users WHERE id = $1', [id]);

async function verifyCatalog() {
  stage = 'catalog';
  const columns = await rows(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = ANY ($1::text[]) ORDER BY column_name`,
    [['name', 'login_id', 'first_use_completed_at']],
  );
  assert.deepEqual(columns, [
    { column_name: 'first_use_completed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    { column_name: 'login_id', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'name', data_type: 'text', is_nullable: 'YES' },
  ], 'the three additive columns are nullable, so every existing row stays valid');

  const [index] = await rows("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_login_id_key'");
  assert.match(index?.indexdef ?? '', /CREATE UNIQUE INDEX users_login_id_key ON public\.users USING btree \(login_id\)/u);

  const triggers = await rows(
    `SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
        AND tgname IN ('provision_qandeel_user', 'provision_qandeel_user_identity') ORDER BY tgname`,
  );
  assert.deepEqual(triggers.map((t) => t.tgname), ['provision_qandeel_user', 'provision_qandeel_user_identity'],
    'the 0002 provisioning trigger is still there, and the identity trigger sorts after it');

  const functions = await rows(
    `SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY ($1::text[]) ORDER BY p.proname`,
    [['complete_first_use_welcome_v1', 'login_id_is_available_v1', 'provision_qandeel_account_identity_v1', 'read_account_first_use_v1']],
  );
  assert.deepEqual(functions.map((f) => [f.proname, f.prosecdef, f.proconfig]), [
    ['complete_first_use_welcome_v1', true, ['search_path=""']],
    ['login_id_is_available_v1', true, ['search_path=""']],
    ['provision_qandeel_account_identity_v1', true, ['search_path=""']],
    ['read_account_first_use_v1', false, ['search_path=""']],
  ]);

  stage = 'execute privileges';
  const execute = [
    ['login_id_is_available_v1(text)', 'service_role', true],
    ['login_id_is_available_v1(text)', 'anon', false],
    ['login_id_is_available_v1(text)', 'authenticated', false],
    ['read_account_first_use_v1()', 'authenticated', true],
    ['read_account_first_use_v1()', 'anon', false],
    ['complete_first_use_welcome_v1()', 'authenticated', true],
    ['complete_first_use_welcome_v1()', 'anon', false],
    ['provision_qandeel_account_identity_v1()', 'anon', false],
    ['provision_qandeel_account_identity_v1()', 'authenticated', false],
  ];
  for (const [fn, role, expected] of execute) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS allowed', [role, `public.${fn}`]);
    assert.equal(allowed, expected, `${role} EXECUTE ${fn}`);
  }
  // No client gained a table write on the account row.
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
    for (const role of ['anon', 'authenticated']) {
      const [{ allowed }] = await rows('SELECT has_table_privilege($1, \'public.users\', $2) AS allowed', [role, privilege]);
      assert.equal(allowed, false, `${role} ${privilege} on public.users`);
    }
  }
}

async function verifyProvisioning() {
  stage = 'provisioning';
  const ahmed = randomUUID();
  await signUp(ahmed, { qandeel_name: '  أحمد علي ', qandeel_login_id: 'Mohamed.Allam87', email_verified: false });
  assert.deepEqual(await account(ahmed), [{ id: ahmed, auth_subject: ahmed, name: 'أحمد علي', login_id: 'mohamed.allam87', first_use_completed_at: null }],
    'exactly one QANDEEL account, with the trimmed Name and the canonical lowercase Login ID');

  // No sign-up values (a legacy / operator identity): the bare 0002 row, no fallback.
  const legacy = randomUUID();
  await signUp(legacy);
  assert.deepEqual(await account(legacy), [{ id: legacy, auth_subject: legacy, name: null, login_id: null, first_use_completed_at: null }]);
  const other = randomUUID();
  await signUp(other, { email_verified: false, sub: other });
  assert.deepEqual((await account(other)).map((r) => [r.name, r.login_id]), [[null, null]], 'unrelated metadata is not an identity');

  stage = 'case-insensitive uniqueness';
  for (const duplicate of ['mohamed.allam87', 'MOHAMED.ALLAM87', 'Mohamed.Allam87']) {
    const id = randomUUID();
    await rejected(() => signUp(id, { qandeel_name: 'Someone', qandeel_login_id: duplicate }), ['23505']);
    assert.deepEqual(await rows('SELECT 1 FROM auth.users WHERE id = $1', [id]), [], 'the refused sign-up left no auth account behind');
  }

  stage = 'malformed sign-up values';
  const malformed = [
    [{ qandeel_name: 'A', qandeel_login_id: 'ab' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'a'.repeat(31) }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: '.abc' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'abc.' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'ab..cd' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'ab_-cd' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'ab cd' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'محمد123' }, '23514'],
    [{ qandeel_name: 'A', qandeel_login_id: 'abc@def' }, '23514'],
    [{ qandeel_name: '', qandeel_login_id: 'valid.one' }, '23514'],
    [{ qandeel_name: '    ', qandeel_login_id: 'valid.two' }, '23514'],
    [{ qandeel_name: 'x'.repeat(81), qandeel_login_id: 'valid.three' }, '23514'],
    [{ qandeel_name: 'bad\u0007name', qandeel_login_id: 'valid.four' }, '23514'],
    [{ qandeel_name: 'Only a name' }, '22023'],
    [{ qandeel_login_id: 'only.login' }, '22023'],
    [{ qandeel_name: 42, qandeel_login_id: 'valid.five' }, '22023'],
    [{ qandeel_name: 'A', qandeel_login_id: ['valid.six'] }, '22023'],
  ];
  for (const [meta, code] of malformed) {
    const id = randomUUID();
    await rejected(() => signUp(id, meta), [code]);
    assert.deepEqual(await rows('SELECT 1 FROM auth.users WHERE id = $1', [id]), [], `the refused sign-up ${JSON.stringify(meta)} left no auth account`);
  }

  // The grammar's legal edges are accepted.
  for (const legal of ['abc', 'a'.repeat(30), 'a.b-c_d', '007', 'x1.y2']) {
    const id = randomUUID();
    await signUp(id, { qandeel_name: 'Legal', qandeel_login_id: legal });
    assert.deepEqual((await account(id)).map((r) => r.login_id), [legal.toLowerCase()]);
  }
  // The pair rule holds even for a direct write that bypasses the trigger.
  await rejected(() => client.query("UPDATE public.users SET name = 'Half' WHERE id = $1", [legacy]), ['23514']);
  return { ahmed, legacy };
}

async function verifyAvailability() {
  stage = 'availability';
  await actAs('service_role');
  const answer = async (loginId) => (await rows('SELECT public.login_id_is_available_v1($1) AS available', [loginId]))[0].available;
  assert.equal(await answer('mohamed.allam87'), false, 'a taken Login ID is unavailable');
  assert.equal(await answer('MOHAMED.allam87'), false, 'in any case');
  assert.equal(await answer('fresh.choice'), true, 'a free, well-formed Login ID is available');
  for (const bad of [null, 'ab', '.abc', 'ab..cd', 'محمد', 'ab cd']) {
    assert.equal(await answer(bad), false, `a malformed Login ID is never available: ${bad}`);
  }
  const shape = await rows('SELECT * FROM public.login_id_is_available_v1($1)', ['fresh.choice']);
  assert.deepEqual(Object.keys(shape[0]), ['login_id_is_available_v1'], 'a boolean and nothing else');
  for (const role of ['anon', 'authenticated']) {
    await actAs(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => client.query('SELECT public.login_id_is_available_v1($1)', ['fresh.choice']), ['42501']);
  }
  await asOwner();
}

async function verifyFirstUse({ ahmed, legacy }) {
  stage = 'first-use read';
  const read = async () => rows('SELECT * FROM public.read_account_first_use_v1()');
  await actAs('authenticated', ahmed);
  assert.deepEqual(await read(), [{ name: 'أحمد علي', welcome_completed: false, has_conversed: false }], 'the caller’s own facts, and no Login ID');
  await actAs('authenticated', legacy);
  assert.deepEqual(await read(), [{ name: null, welcome_completed: false, has_conversed: false }], 'a legacy account has no Name, and none is invented');
  await actAs('anon');
  await rejected(() => client.query('SELECT * FROM public.read_account_first_use_v1()'), ['42501']);

  stage = 'welcome completion';
  await actAs('authenticated', ahmed);
  await client.query('SELECT public.complete_first_use_welcome_v1()');
  await asOwner();
  const [first] = await rows('SELECT first_use_completed_at::text AS at FROM public.users WHERE id = $1', [ahmed]);
  assert.ok(first.at, 'the Welcome step is complete');
  await actAs('authenticated', ahmed);
  await client.query('SELECT public.complete_first_use_welcome_v1()');
  await asOwner();
  const [again] = await rows('SELECT first_use_completed_at::text AS at FROM public.users WHERE id = $1', [ahmed]);
  assert.equal(again.at, first.at, 'completion is idempotent: the first completion time is kept');
  assert.deepEqual((await account(legacy)).map((r) => r.first_use_completed_at), [null], 'another account is untouched');
  await actAs('authenticated', ahmed);
  assert.deepEqual((await read()).map((r) => r.welcome_completed), [true]);
  await actAs('authenticated');
  await rejected(() => client.query('SELECT public.complete_first_use_welcome_v1()'), ['42501']);
  await actAs('authenticated', randomUUID());
  await rejected(() => client.query('SELECT public.complete_first_use_welcome_v1()'), ['P0002']);
  await actAs('authenticated', ahmed);
  await rejected(() => client.query("UPDATE public.users SET first_use_completed_at = NULL WHERE id = $1", [ahmed]), ['42501']);
  await rejected(() => client.query("UPDATE public.users SET login_id = 'stolen.id' WHERE id = $1", [ahmed]), ['42501']);

  stage = 'conversation compatibility';
  // A new account still owns Sessions and turns through the existing foreign keys, and its first
  // committed turn is what consumes the First Conversation Opening.
  await asOwner();
  const session = randomUUID();
  await client.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, ahmed]);
  await client.query("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'w1b-fixture')", [randomUUID(), session, ahmed]);
  await actAs('authenticated', ahmed);
  assert.deepEqual((await read()).map((r) => r.has_conversed), [true], 'the first committed turn consumes the First Conversation Opening');
  assert.deepEqual((await rows('SELECT id FROM public.conversation_sessions')).map((r) => r.id), [session], 'the owner reads its own Session');
  await actAs('authenticated', legacy);
  assert.deepEqual((await read()).map((r) => r.has_conversed), [false], 'another account’s turn consumes nothing of this one');
  assert.deepEqual(await rows('SELECT id FROM public.conversation_sessions'), [], 'and reads no other account’s Session');
  assert.deepEqual((await rows('SELECT id, name, login_id FROM public.users')).map((r) => r.id), [legacy], 'nor any other account row');
  await asOwner();
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      stage = 'fixture shape';
      await client.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb');
      await verifyCatalog();
      const fixtures = await verifyProvisioning();
      await verifyAvailability();
      await verifyFirstUse(fixtures);
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0123 account identity, case-insensitive Login ID uniqueness, provisioning, availability and first-use isolation.');
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
