// Memory runtime (migration 0004) verifier, asserting the hardened final state.
//
// Migration 0004 created public.memories with authenticated INSERT/UPDATE and an
// authenticated supersede_memory RPC. Migration 0026 (Memory Authority
// Hardening) removes that write authority: authenticated keeps only the
// owner-scoped read, the permissive write policies are gone, and the legacy RPC
// is no longer executable by an ordinary client. This verifier therefore proves
// the effective post-0026 boundary plus the migration 0004 record semantics
// (canonical vocabulary, bounds, lifecycle, lineage and cross-user isolation)
// that survive unchanged. Migration 0004's historical text is left intact and is
// asserted by database/tests/memory-runtime.test.mjs; the narrow server-only
// write commands are proven by database/verify-migration-0026.mjs.
//
// It fails closed when the canonical schema is absent rather than applying or
// repairing DDL, and every fixture is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
const LEGACY_SUPERSEDE = 'public.supersede_memory(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
let stage = 'connect';

async function rows(text, values = []) { return (await client.query(text, values)).rows; }

async function assertSchemaContract() {
  const [{ table_exists, legacy_exists }] = await rows(`SELECT
    to_regclass('public.memories') IS NOT NULL AS table_exists,
    to_regprocedure($1) IS NOT NULL AS legacy_exists`, [LEGACY_SUPERSEDE]);
  assert.equal(table_exists, true, 'Required canonical Memory schema is absent');
  assert.equal(legacy_exists, true, 'Schema contract mismatch: supersede_memory');
}

async function setIdentity(userId) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
}

async function resetIdentity() {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', '', true)");
}

async function verifyCatalog() {
  const [table] = await rows("SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.memories'::regclass");
  assert.equal(table.rls, true);
  const policies = await rows("SELECT policyname, cmd, roles::text[] roles FROM pg_policies WHERE schemaname='public' AND tablename='memories' ORDER BY policyname");
  // Only the owner-scoped read policy survives; the permissive write policies
  // were dropped so the schema advertises no client write authority.
  assert.deepEqual(policies.map(({ policyname }) => policyname), ['memories_select_own']);
  assert.equal(policies[0].cmd, 'SELECT');
  for (const policy of policies) assert.deepEqual(policy.roles, ['authenticated']);
  for (const [privilege, expected] of [['SELECT', true], ['INSERT', false], ['UPDATE', false], ['DELETE', false]]) {
    const [{ allowed }] = await rows("SELECT has_table_privilege('authenticated','public.memories',$1) AS allowed", [privilege]);
    assert.equal(allowed, expected, `authenticated ${privilege} on public.memories`);
  }
  // The legacy generic mutation RPC is no longer an authenticated bypass.
  const [{ legacy }] = await rows("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS legacy", [LEGACY_SUPERSEDE]);
  assert.equal(legacy, false, 'authenticated EXECUTE on supersede_memory');
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

async function verifyOwnerReadAndClosedWrites(userA, userB, oldId, otherId) {
  stage = 'cross-user RLS and closed client writes';
  await setIdentity(userA);
  // The owner still reads its own Memory; the cross-user row stays invisible.
  assert.deepEqual((await rows('SELECT id FROM public.memories ORDER BY id')).map(({ id }) => id), [oldId]);
  assert.equal((await rows('SELECT id FROM public.memories WHERE id=$1', [otherId])).length, 0);
  // No client write authority remains, on owned or on cross-user rows.
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$2,'STABLE_PREFERENCE','client write','USER_STATED',1,0.6,'ACTIVE')`, [randomUUID(), userA]));
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$2,'PERSONAL_FACT','spoof','USER_STATED',1,1,'ACTIVE')`, [randomUUID(), userB]));
  await expectRejected(() => client.query("UPDATE public.memories SET content='rewritten' WHERE id=$1", [oldId]));
  await expectRejected(() => client.query("UPDATE public.memories SET source='ADMIN_CONTROLLED' WHERE id=$1", [oldId]));
  await expectRejected(() => client.query("UPDATE public.memories SET status='DELETED' WHERE id=$1", [otherId]));
  await expectRejected(() => client.query('DELETE FROM public.memories WHERE id=$1', [oldId]));
  await expectRejected(() => client.query("SELECT * FROM public.supersede_memory($1,$2,'PERSONAL_FACT','Alexandria','USER_CONFIRMED',1,0.8,'ACTIVE',NULL)", [oldId, randomUUID()]));
  await resetIdentity();
}

async function verifyRecordSemantics(userA, userB, oldId, otherId) {
  stage = 'record vocabulary, bounds, lineage and lifecycle';
  // Migration 0004's table-level guarantees, now exercised through the owner
  // role because clients hold no write authority.
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$2,'DERIVED_INSIGHT','guess','SYSTEM_DERIVED',0.5,0.5,'ACTIVE')`, [randomUUID(), userA]), ['23514']);
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$2,'PERSONAL_FACT','bad','USER_STATED',1.1,0.5,'ACTIVE')`, [randomUUID(), userA]), ['23514']);
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$2,'TRANSCRIPT','bad type','USER_STATED',1,0.5,'ACTIVE')`, [randomUUID(), userA]), ['23514']);
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status,created_at,expires_at)
    VALUES ($1,$2,'TEMPORARY_STATE','elapsed','USER_STATED',1,0.5,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP - interval '1 hour')`, [randomUUID(), userA]), ['23514']);
  // A cross-user lineage reference is refused by the composite foreign key.
  await expectRejected(() => client.query(`INSERT INTO public.memories
    (id,user_id,type,content,source,confidence,importance,status,supersedes_memory_id)
    VALUES ($1,$2,'PERSONAL_FACT','cross-user lineage','USER_STATED',1,1,'ACTIVE',$3)`,
  [randomUUID(), userA, otherId]), ['23503']);

  // Canonical lineage: one successor at version + 1, predecessor retained.
  const successorId = randomUUID();
  await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status,version,supersedes_memory_id)
    VALUES ($1,$2,'PERSONAL_FACT','Alexandria','USER_CONFIRMED',1,0.8,'ACTIVE',2,$3)`, [successorId, userA, oldId]);
  await client.query("UPDATE public.memories SET status='SUPERSEDED', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [oldId]);
  const [successor] = await rows('SELECT * FROM public.memories WHERE id=$1', [successorId]);
  assert.equal(successor.user_id, userA);
  assert.equal(successor.version, 2);
  assert.equal(successor.supersedes_memory_id, oldId);
  assert.equal((await rows('SELECT status FROM public.memories WHERE id=$1', [oldId]))[0].status, 'SUPERSEDED');
  // Self-supersession and a second successor stay impossible.
  await expectRejected(() => client.query('UPDATE public.memories SET supersedes_memory_id=id WHERE id=$1', [successorId]), ['23514']);
  await expectRejected(() => client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status,version,supersedes_memory_id)
    VALUES ($1,$2,'PERSONAL_FACT','second successor','USER_CONFIRMED',1,0.8,'ACTIVE',2,$3)`, [randomUUID(), userA, oldId]), ['23505']);

  // Active selection excludes every non-active and expired lifecycle state.
  await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status,created_at,expires_at)
    VALUES ($1,$2,'TEMPORARY_STATE','temporary','USER_STATED',1,0.4,'ACTIVE',CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP - interval '1 hour')`, [randomUUID(), userA]);
  await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
    VALUES ($1,$4,'GOAL','disabled','USER_STATED',1,0.5,'DISABLED'),
           ($2,$4,'DERIVED_INSIGHT','pending','SYSTEM_DERIVED',0.4,0.3,'PENDING_CONFIRMATION'),
           ($3,$4,'GOAL','expired lifecycle','USER_STATED',1,0.5,'EXPIRED')`,
  [randomUUID(), randomUUID(), randomUUID(), userA]);
  const active = await rows("SELECT id FROM public.memories WHERE user_id=$1 AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)", [userA]);
  assert.deepEqual(active.map(({ id }) => id), [successorId]);
  // The other tenant's Memory is untouched by any of it.
  const [other] = await rows('SELECT user_id, status FROM public.memories WHERE id=$1', [otherId]);
  assert.deepEqual(other, { user_id: userB, status: 'ACTIVE' });
}

async function main() {
  try {
    await client.connect();
    stage = 'schema contract'; await assertSchemaContract();
    stage = 'catalog'; await verifyCatalog();
    const userA = randomUUID(), userB = randomUUID();
    const oldId = randomUUID(), otherId = randomUUID();
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO public.users (id, auth_subject) VALUES ($1::uuid,$1::text),($2::uuid,$2::text)', [userA, userB]);
      await client.query(`INSERT INTO public.memories (id,user_id,type,content,source,confidence,importance,status)
        VALUES ($1,$2,'PERSONAL_FACT','Cairo','USER_STATED',0.9,0.7,'ACTIVE'),
               ($3,$4,'GOAL','Private','USER_CONFIRMED',1,0.8,'ACTIVE')`, [oldId, userA, otherId, userB]);
      await verifyOwnerReadAndClosedWrites(userA, userB, oldId, otherId);
      await verifyRecordSemantics(userA, userB, oldId, otherId);
    } finally { await client.query('ROLLBACK'); }
    console.log('Verified migration 0004 memory constraints, lifecycle, lineage, and cross-user RLS isolation under the hardened server-only write boundary.');
  } finally { await client.end(); }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Memory database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
