import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
}

// Final-state policy expectations. Migration 0002 created permissive
// INSERT/UPDATE policies on both conversation tables; migration 0025
// (Conversation Authority Hardening) dropped the conversation_turns write
// policies and migration 0030 (Conversation Session Authority Hardening)
// dropped the conversation_sessions write policies, so conversational and
// session authority are server-only. This verifier proves the hardened
// effective state, not the superseded 0002 grants. Migration 0002's historical
// text is left intact and asserted by database/tests/auth-rls.test.mjs.
const expectedPolicies = new Map([
  ['users_select_own', ['users', 'SELECT']],
  ['conversation_sessions_select_own', ['conversation_sessions', 'SELECT']],
  ['conversation_turns_select_own', ['conversation_turns', 'SELECT']],
]);
const migrationUrl = new URL('./migrations/0002_supabase_auth_identity_rls.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const client = new Client({ connectionString: databaseUrl });
let verificationStage = 'connect';

async function queryRows(text, values = []) {
  return (await client.query(text, values)).rows;
}

async function migrationObjects() {
  const functionRows = await queryRows(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_auth_user'`,
  );
  const triggerRows = await queryRows(
    `SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass
        AND tgname = 'provision_qandeel_user' AND NOT tgisinternal`,
  );
  const policyRows = await queryRows(
    `SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND policyname = ANY ($1::text[])`,
    [[...expectedPolicies.keys()]],
  );
  return functionRows.length + triggerRows.length + policyRows.length;
}

async function applyMigrationIfNeeded() {
  const objectCount = await migrationObjects();
  const expectedCount = expectedPolicies.size + 2;
  if (objectCount === 0) {
    await client.query(migrationSql);
    console.log('Applied migration 0002.');
  } else if (objectCount !== expectedCount) {
    throw new Error(`Refusing partial migration 0002 state (${objectCount}/${expectedCount} objects found).`);
  } else {
    console.log('Migration 0002 already applied; verifying without reapplying.');
  }
}

async function verifyProvisioningDefinition() {
  const [definition] = await queryRows(
    `SELECT p.prosecdef AS security_definer, p.proconfig AS configuration,
            pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_auth_user'`,
  );
  assert.ok(definition, 'Missing auth provisioning function');
  assert.equal(definition.security_definer, true);
  assert.deepEqual(definition.configuration, ['search_path=""']);
  assert.match(definition.definition, /INSERT INTO public\.users \(id, auth_subject\)/i);
  assert.doesNotMatch(definition.definition, /email|metadata/i);

  const [trigger] = await queryRows(
    `SELECT pg_get_triggerdef(oid, true) AS definition FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass
        AND tgname = 'provision_qandeel_user' AND NOT tgisinternal`,
  );
  assert.match(trigger?.definition ?? '', /AFTER INSERT ON auth\.users/i);
}

async function verifyAuthProvisioningBehavior() {
  const userId = randomUUID();
  await client.query('BEGIN');
  try {
    await client.query('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
    const rows = await queryRows('SELECT id, auth_subject FROM public.users WHERE id = $1', [userId]);
    assert.deepEqual(rows, [{ id: userId, auth_subject: userId }]);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyRlsCatalog() {
  verificationStage = 'RLS table flags';
  const rlsRows = await queryRows(
    `SELECT relname AS table_name, relrowsecurity AS enabled
       FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'public'
        AND relname = ANY ($1::text[]) ORDER BY relname`,
    [['users', 'conversation_sessions', 'conversation_turns']],
  );
  assert.deepEqual(rlsRows, [
    { table_name: 'conversation_sessions', enabled: true },
    { table_name: 'conversation_turns', enabled: true },
    { table_name: 'users', enabled: true },
  ]);

  verificationStage = 'RLS policy definitions';
  const policies = await queryRows(
    `SELECT policyname, tablename, cmd, roles::text[] AS roles FROM pg_policies
      WHERE schemaname = 'public' AND policyname = ANY ($1::text[])`,
    [[...expectedPolicies.keys()]],
  );
  assert.equal(policies.length, expectedPolicies.size);
  for (const policy of policies) {
    assert.deepEqual(policy.roles, ['authenticated'], `${policy.policyname} role scope`);
    assert.deepEqual([policy.tablename, policy.cmd], expectedPolicies.get(policy.policyname));
  }
}

async function verifyTablePrivileges() {
  verificationStage = 'table privileges';
  const checks = [
    ['authenticated', 'users', 'SELECT', true],
    ['authenticated', 'users', 'INSERT', false],
    ['authenticated', 'users', 'UPDATE', false],
    ['authenticated', 'users', 'DELETE', false],
    // conversation_sessions is read-only for authenticated after migration
    // 0030: creation flows through the narrow create_conversation_session_v1
    // definer command and no direct lifecycle mutation exists.
    ['authenticated', 'conversation_sessions', 'SELECT', true],
    ['authenticated', 'conversation_sessions', 'INSERT', false],
    ['authenticated', 'conversation_sessions', 'UPDATE', false],
    ['authenticated', 'conversation_sessions', 'DELETE', false],
    // conversation_turns is read-only for authenticated after migration 0025:
    // all write authority flows through server-owned definer commands.
    ['authenticated', 'conversation_turns', 'SELECT', true],
    ['authenticated', 'conversation_turns', 'INSERT', false],
    ['authenticated', 'conversation_turns', 'UPDATE', false],
    ['authenticated', 'conversation_turns', 'DELETE', false],
  ];

  for (const [role, table, privilege, expected] of checks) {
    const [{ allowed }] = await queryRows(
      'SELECT has_table_privilege($1, $2, $3) AS allowed',
      [role, `public.${table}`, privilege],
    );
    assert.equal(allowed, expected, `${role} ${privilege} on ${table}`);
  }

  for (const table of ['users', 'conversation_sessions', 'conversation_turns']) {
    const [{ allowed }] = await queryRows(
      "SELECT has_table_privilege('anon', $1, 'SELECT,INSERT,UPDATE,DELETE') AS allowed",
      [`public.${table}`],
    );
    assert.equal(allowed, false, `anon application access on ${table}`);
  }
}

async function setLocalIdentity(role, userId = null) {
  if (role === 'authenticated') {
    await client.query('SET LOCAL ROLE authenticated');
  } else if (role === 'anon') {
    await client.query('SET LOCAL ROLE anon');
  } else {
    throw new Error('Unsupported verification role');
  }
  const claims = userId ? JSON.stringify({ sub: userId, role }) : '{}';
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
}

async function expectRejected(operation, expectedCodes = ['42501']) {
  let rejection;
  await client.query('SAVEPOINT expected_rejection');
  try {
    await operation();
  } catch (error) {
    rejection = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    await client.query('RELEASE SAVEPOINT expected_rejection');
  }
  assert.ok(rejection, 'Operation unexpectedly succeeded');
  assert.ok(expectedCodes.includes(rejection.code), `Unexpected rejection code ${rejection.code}`);
}

async function verifyRlsBehavior() {
  const userA = randomUUID();
  const userB = randomUUID();
  const sessionA = randomUUID();
  const sessionB = randomUUID();
  const turnA = randomUUID();
  const turnB = randomUUID();

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO public.users (id, auth_subject)
       VALUES ($1::uuid, $1::text), ($2::uuid, $2::text)`, [userA, userB],
    );
    await client.query(
      `INSERT INTO public.conversation_sessions (id, user_id, status, channel)
       VALUES ($1, $2, 'ACTIVE', 'TEXT'), ($3, $4, 'ACTIVE', 'TEXT')`,
      [sessionA, userA, sessionB, userB],
    );
    await client.query(
      `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
       VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'A'),
              ($4, $5, $6, 'USER', 'RECEIVED', 'B')`,
      [turnA, sessionA, userA, turnB, sessionB, userB],
    );

    await setLocalIdentity('authenticated', userA);
    assert.deepEqual((await queryRows('SELECT id FROM public.users')).map((row) => row.id), [userA]);
    assert.deepEqual((await queryRows('SELECT id FROM public.conversation_sessions')).map((row) => row.id), [sessionA]);
    assert.deepEqual((await queryRows('SELECT id FROM public.conversation_turns')).map((row) => row.id), [turnA]);

    // After migration 0030 the authenticated role holds no direct Session DML
    // at all: even an own-tenant, fully canonical INSERT and an own-session
    // lifecycle UPDATE are rejected, alongside the cross-tenant attempts.
    await expectRejected(() => client.query(
      `INSERT INTO public.conversation_sessions (id, user_id, status, channel)
       VALUES ($1, $2, 'ACTIVE', 'TEXT')`, [randomUUID(), userA],
    ));
    await expectRejected(() => client.query(
      `INSERT INTO public.conversation_sessions (id, user_id, status, channel)
       VALUES ($1, $2, 'ACTIVE', 'TEXT')`, [randomUUID(), userB],
    ));
    await expectRejected(() => client.query(
      `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
       VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'cross-user')`,
      [randomUUID(), sessionB, userA],
    ), ['23503', '42501']);

    await expectRejected(() => client.query(
      "UPDATE public.conversation_sessions SET status = 'IDLE' WHERE id = $1", [sessionA],
    ));
    await expectRejected(() => client.query(
      "UPDATE public.conversation_sessions SET status = 'IDLE' WHERE id = $1", [sessionB],
    ));
    await expectRejected(() => client.query(
      'UPDATE public.conversation_sessions SET user_id = $1 WHERE id = $2', [userB, sessionA],
    ));
    await expectRejected(() => client.query(
      'UPDATE public.conversation_turns SET user_id = $1 WHERE id = $2', [userB, turnA],
    ));
    await expectRejected(() => client.query(
      'DELETE FROM public.conversation_sessions WHERE id = $1', [sessionB],
    ));

    await client.query('RESET ROLE');
    await setLocalIdentity('anon');
    await expectRejected(() => client.query('SELECT * FROM public.users'));
    await expectRejected(() => client.query('SELECT * FROM public.conversation_sessions'));
    await expectRejected(() => client.query('SELECT * FROM public.conversation_turns'));
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  try {
    await client.connect();
    verificationStage = 'migration state';
    await applyMigrationIfNeeded();
    verificationStage = 'provisioning definition';
    await verifyProvisioningDefinition();
    verificationStage = 'provisioning behavior';
    await verifyAuthProvisioningBehavior();
    verificationStage = 'RLS catalog';
    await verifyRlsCatalog();
    await verifyTablePrivileges();
    verificationStage = 'RLS behavior';
    await verifyRlsBehavior();
    console.log('Verified migration 0002 auth provisioning, RLS catalog, and user isolation.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${verificationStage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
