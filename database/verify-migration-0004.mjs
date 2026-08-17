import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const migrationSql = await readFile(new URL('./migrations/0004_memory_runtime.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

async function rows(text, values = []) { return (await client.query(text, values)).rows; }

async function applyIfNeeded() {
  const [{ table_exists }] = await rows("SELECT to_regclass('public.memories') IS NOT NULL AS table_exists");
  const [{ function_count }] = await rows("SELECT count(*)::int AS function_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='supersede_memory'");
  if (!table_exists && function_count === 0) {
    await client.query(migrationSql);
    console.log('Applied migration 0004.');
  } else if (!table_exists || function_count !== 1) {
    throw new Error('Refusing partial migration 0004 state.');
  }
}

async function setIdentity(userId) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
}

async function verifyCatalog() {
  const [table] = await rows("SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.memories'::regclass");
  assert.equal(table.rls, true);
  const policies = await rows("SELECT policyname, cmd, roles::text[] roles FROM pg_policies WHERE schemaname='public' AND tablename='memories' ORDER BY policyname");
  assert.deepEqual(policies.map(({ policyname }) => policyname), ['memories_insert_own', 'memories_select_own', 'memories_update_own']);
  for (const policy of policies) assert.deepEqual(policy.roles, ['authenticated']);
  const [{ can_delete }] = await rows("SELECT has_table_privilege('authenticated','public.memories','DELETE') AS can_delete");
  assert.equal(can_delete, false);
}

async function expectRejected(operation, expectedCodes = ['42501']) {
  await client.query('SAVEPOINT expected_rejection');
  let error;
  try { await operation(); } catch (caught) { error = caught; }
  await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
  await client.query('RELEASE SAVEPOINT expected_rejection');
  assert.ok(error, 'Operation unexpectedly succeeded');
  assert.ok(expectedCodes.includes(error.code), `Unexpected rejection code ${error.code}`);
}

async function verifyBehavior() {
  const userA = randomUUID(); const userB = randomUUID();
  const oldId = randomUUID(); const otherId = randomUUID(); const successorId = randomUUID(); const ownLifecycleId = randomUUID();
  await client.query('BEGIN');
  try {
    await client.query('INSERT INTO public.users (id, auth_subject) VALUES ($1::uuid,$1::text),($2::uuid,$2::text)', [userA, userB]);
    await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$2,'PERSONAL_FACT','Cairo','USER_STATED',0.9,0.7,'ACTIVE'),
             ($3,$4,'GOAL','Private','USER_CONFIRMED',1,0.8,'ACTIVE')`, [oldId, userA, otherId, userB]);

    await setIdentity(userA);
    assert.deepEqual((await rows('SELECT id FROM public.memories ORDER BY id')).map(({ id }) => id), [oldId]);
    await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$2,'STABLE_PREFERENCE','Own memory','USER_STATED',1,0.6,'ACTIVE')`, [ownLifecycleId, userA]);
    assert.equal((await rows('SELECT count(*)::int count FROM public.memories WHERE id=$1', [ownLifecycleId]))[0].count, 1);
    assert.equal((await client.query("UPDATE public.memories SET content='Updated own memory' WHERE id=$1", [ownLifecycleId])).rowCount, 1);
    assert.equal((await client.query("UPDATE public.memories SET content='blocked' WHERE id=$1", [otherId])).rowCount, 0);
    assert.equal((await client.query("UPDATE public.memories SET status='DELETED' WHERE id=$1", [otherId])).rowCount, 0);
    await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$2,'PERSONAL_FACT','spoof','USER_STATED',1,1,'ACTIVE')`, [randomUUID(), userB]));
    await expectRejected(() => client.query(`INSERT INTO public.memories
      (id,user_id,type,content,source,confidence,importance,status,supersedes_memory_id)
      VALUES ($1,$2,'PERSONAL_FACT','cross-user lineage','USER_STATED',1,1,'ACTIVE',$3)`,
      [randomUUID(), userA, otherId]), ['23503']);

    const superseded = await rows("SELECT * FROM public.supersede_memory($1,$2,'PERSONAL_FACT','Alexandria','USER_CONFIRMED',1,0.8,'ACTIVE',NULL)", [oldId, successorId]);
    assert.equal(superseded.length, 1);
    assert.equal(superseded[0].user_id, userA);
    assert.equal(superseded[0].supersedes_memory_id, oldId);
    assert.equal(superseded[0].version, 2);
    assert.equal((await rows('SELECT status FROM public.memories WHERE id=$1', [oldId]))[0].status, 'SUPERSEDED');
    assert.equal((await rows("SELECT * FROM public.supersede_memory($1,$2,'GOAL','cross-user','USER_STATED',1,1,'ACTIVE',NULL)", [otherId, randomUUID()])).length, 0);
    await expectRejected(() => client.query("SELECT * FROM public.supersede_memory($1,$1,'PERSONAL_FACT','self','USER_STATED',1,1,'ACTIVE',NULL)", [successorId]), ['22023']);

    await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$2,'DERIVED_INSIGHT','guess','SYSTEM_DERIVED',0.5,0.5,'ACTIVE')`, [randomUUID(), userA]), ['23514']);
    await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$2,'PERSONAL_FACT','bad','USER_STATED',1.1,0.5,'ACTIVE')`, [randomUUID(), userA]), ['23514']);

    const expiredId = randomUUID();
    await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status,created_at,expires_at)
      VALUES ($1,$2,'TEMPORARY_STATE','temporary','USER_STATED',1,0.4,'ACTIVE',CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP - interval '1 hour')`, [expiredId, userA]);
    await client.query("UPDATE public.memories SET status='DELETED' WHERE id=$1", [ownLifecycleId]);
    await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
      VALUES ($1,$4,'GOAL','disabled','USER_STATED',1,0.5,'DISABLED'),
             ($2,$4,'DERIVED_INSIGHT','pending','SYSTEM_DERIVED',0.4,0.3,'PENDING_CONFIRMATION'),
             ($3,$4,'GOAL','expired lifecycle','USER_STATED',1,0.5,'EXPIRED')`,
      [randomUUID(), randomUUID(), randomUUID(), userA]);
    const active = await rows("SELECT id FROM public.memories WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)");
    assert.deepEqual(active.map(({ id }) => id), [successorId]);
  } finally { await client.query('ROLLBACK'); }
}

async function main() {
  try {
    await client.connect(); stage = 'migration'; await applyIfNeeded();
    stage = 'catalog'; await verifyCatalog(); stage = 'cross-user RLS and lifecycle'; await verifyBehavior();
    console.log('Verified migration 0004 memory constraints, lifecycle, atomic supersession, and cross-user RLS isolation.');
  } finally { await client.end(); }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Memory database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
