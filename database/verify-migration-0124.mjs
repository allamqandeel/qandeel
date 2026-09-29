// W2-01 — Final Account Access Lifecycle: the real-PostgreSQL verifier for migration 0124.
//
// It proves, against a fully migrated database:
//   1. `resolve_login_id_sign_in_email_v1` exists as SECURITY DEFINER with an empty search_path;
//   2. ONLY the server channel (`service_role`) may execute it — `anon`, `authenticated` and PUBLIC may
//      not, so no client role can turn a Login ID into an Email (P1 §3: no client-visible directory);
//   3. it resolves a Login ID case-insensitively to the Email of the account holding it, and answers
//      NULL — never an error, never a hint — for an unknown or malformed Login ID and for an account
//      that has no Login ID;
//   4. it answers a single text value and nothing else (no id, no Name, no row).
//
// Everything runs inside one transaction that is rolled back. The disposable CI bootstrap gives
// `auth.users` only an `id`; the real Supabase table carries `email` and `raw_user_meta_data`, so the
// verifier adds those two columns inside its own transaction, exactly as Supabase shapes them.
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
const signUp = (id, email, meta) =>
  client.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)', [id, email, meta === undefined ? null : JSON.stringify(meta)]);

const FN = 'public.resolve_login_id_sign_in_email_v1(text)';

async function verifyCatalog() {
  stage = 'catalog';
  const [fn] = await rows(
    `SELECT p.prosecdef, p.proconfig, pg_get_function_result(p.oid) AS result FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'resolve_login_id_sign_in_email_v1'`,
  );
  assert.deepEqual(fn, { prosecdef: true, proconfig: ['search_path=""'], result: 'text' }, 'SECURITY DEFINER, empty search_path, one text answer');

  stage = 'execute privileges';
  for (const [role, expected] of [['service_role', true], ['anon', false], ['authenticated', false], ['public', false]]) {
    const [{ allowed }] = await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, FN]);
    assert.equal(allowed, expected, `${role} EXECUTE ${FN}`);
  }
}

async function verifyResolution() {
  stage = 'fixtures';
  const owner = randomUUID();
  await signUp(owner, 'owner@example.test', { qandeel_name: 'Owner', qandeel_login_id: 'Mohamed.Allam87' });
  const unverified = randomUUID();
  await signUp(unverified, 'pending@example.test', { qandeel_name: 'Pending', qandeel_login_id: 'pending.one' });
  const legacy = randomUUID();
  await signUp(legacy, 'legacy@example.test');

  stage = 'resolution';
  await actAs('service_role');
  const resolve = async (loginId) => (await rows('SELECT public.resolve_login_id_sign_in_email_v1($1) AS email', [loginId]))[0].email;
  for (const typed of ['mohamed.allam87', 'MOHAMED.ALLAM87', 'Mohamed.Allam87']) {
    assert.equal(await resolve(typed), 'owner@example.test', `the Login ID resolves in any case: ${typed}`);
  }
  assert.equal(await resolve('pending.one'), 'pending@example.test', 'an account awaiting Email verification still resolves; the provider decides the rest');
  for (const unknown of ['nobody.here', 'legacy', null, 'ab', '.abc', 'ab..cd', 'محمد', 'a b', 'owner@example.test', 'x'.repeat(31)]) {
    assert.equal(await resolve(unknown), null, `an unknown or malformed Login ID answers NULL: ${unknown}`);
  }
  const shape = await rows('SELECT * FROM public.resolve_login_id_sign_in_email_v1($1)', ['mohamed.allam87']);
  assert.deepEqual(Object.keys(shape[0]), ['resolve_login_id_sign_in_email_v1'], 'one text value and nothing else');

  stage = 'client roles refused';
  for (const role of ['anon', 'authenticated']) {
    await actAs(role, role === 'authenticated' ? owner : null);
    await rejected(() => client.query('SELECT public.resolve_login_id_sign_in_email_v1($1)', ['mohamed.allam87']), ['42501']);
  }
  await asOwner();
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      stage = 'fixture shape';
      await client.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text');
      await client.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb');
      await verifyCatalog();
      await verifyResolution();
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0124 server-only Login ID sign-in resolution: grants, case-insensitive resolution and NULL for every unknown or malformed Login ID.');
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
