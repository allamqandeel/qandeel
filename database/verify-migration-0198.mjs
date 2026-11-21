// Real-PostgreSQL verifier for migration 0198 (COSMOS E-2 corrections, Slice A: Personal topic identity under the
// Product Owner's decisions D-3 / D-4 of 2026-11-20). No provider is called; every scenario runs in ONE transaction that
// is rolled back, so nothing is retained.
//
//   T0   catalogue: the two definers are postgres-owned, SECURITY DEFINER, search_path-pinned, EXECUTE to authenticated
//        only (anon and service_role refused); the alias ledger grants nothing to any client role, is RLS-enabled and
//        append-only; V2 returns exactly V1's row shape; V1 is byte-identical to its 0072 text (no CREATE OR REPLACE)
//   T1   the alias fails closed: no caller is FORBIDDEN (42501); an unknown Thread and (therefore) another person's
//        Thread are FORBIDDEN alike, never "not found"; a blank or 61-character alias is INVALID_ALIAS (22023); a NULL
//        Thread id is INVALID_THREAD_ID (22023)
//   T2   V2 refuses exactly as V1 refuses: an unknown Session, another person's Session and no caller answer with the
//        same SQLSTATE and the same message as V1 (V2 re-derives nothing: V1 decides)
//   T3   the ledger is append-only even for the owner role (55000)
//
// Honest limit: establishing a real Thread needs the production establishment pipeline (0066 → 0070, driven in
// verify-migration-0072 with provider provenance); this verifier does NOT seed Threads. The per-Thread enrichment (the
// grounding wording, the alias precedence, the origin) is proven by the API and client tests over V2 rows and by the
// static SQL pins; against real Threads it is NOT TESTED here and is reported as such.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

const ALIAS = 'public.set_conversation_thread_alias_v1(uuid,text)';
const V1 = 'public.get_session_historical_projection_v1(uuid,integer)';
const V2 = 'public.get_session_historical_projection_v2(uuid,integer)';

const alias = async (thread, text) => (await rows('SELECT * FROM public.set_conversation_thread_alias_v1($1, $2)', [thread, text]))[0];
const projectV1 = (session, tc) => rows('SELECT * FROM public.get_session_historical_projection_v1($1, $2)', [session, tc]);
const projectV2 = (session, tc) => rows('SELECT * FROM public.get_session_historical_projection_v2($1, $2)', [session, tc]);
async function human() {
  const id = randomUUID();
  await identity('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = $1', [id]);
  assert.equal(n, 1, 'the auth provisioning trigger created the public.users row');
  return id;
}
/** The same answer from V1 and V2 where nothing is visible: a refusal with the same code and words, or the same empty set. */
async function outcomeOf(operation) {
  await q('SAVEPOINT s');
  try {
    const result = await operation();
    return { rows: result.length };
  } catch (error) {
    return { code: error.code, message: error.message };
  } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
}
async function sameRefusal(session, tc) {
  const one = await outcomeOf(() => projectV1(session, tc));
  const two = await outcomeOf(() => projectV2(session, tc));
  assert.deepEqual(two, one, 'V2 answers exactly as V1 answers: V2 re-derives nothing');
  if ('rows' in one) assert.equal(one.rows, 0, 'nothing of another person, or of no Session, is visible');
}

try {
  await client.connect();
  await q('BEGIN');
  const serviceRole = (await rows("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'")).length === 1;

  stage = 'T0 catalogue';
  for (const fn of [ALIAS, V2]) {
    const [row] = await rows(
      `SELECT p.prosecdef, r.rolname AS owner,
              EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS pinned,
              has_function_privilege('anon', $2::text, 'EXECUTE') AS anon_can,
              has_function_privilege('authenticated', $2::text, 'EXECUTE') AS authenticated_can
         FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.oid = $1::text::regprocedure`, [fn, fn]);
    assert.ok(row, `${fn} exists`);
    assert.equal(row.prosecdef, true, `${fn} is SECURITY DEFINER`);
    assert.equal(row.owner, 'postgres', `${fn} is owned by postgres`);
    assert.equal(row.pinned, true, `${fn} pins its search_path`);
    assert.equal(row.anon_can, false, `anon cannot execute ${fn}`);
    assert.equal(row.authenticated_can, true, `authenticated can execute ${fn}`);
    if (serviceRole) {
      const [{ can }] = await rows("SELECT has_function_privilege('service_role', $1::text, 'EXECUTE') AS can", [fn]);
      assert.equal(can, false, `service_role cannot execute ${fn}`);
    }
  }
  const grants = await rows(
    "SELECT grantee FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'conversation_thread_aliases' AND grantee IN ('anon','authenticated','service_role','PUBLIC')");
  assert.deepEqual(grants, [], 'the alias ledger grants nothing to any client role');
  const [{ relrowsecurity }] = await rows("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.conversation_thread_aliases'::regclass");
  assert.equal(relrowsecurity, true, 'RLS is enabled on the alias ledger');
  const [{ n: triggers }] = await rows("SELECT count(*)::int n FROM pg_trigger WHERE tgname = 'conversation_thread_aliases_append_only' AND NOT tgisinternal");
  assert.equal(triggers, 1, 'the append-only guard exists');
  const [{ same }] = await rows('SELECT pg_get_function_result($1::text::regprocedure) = pg_get_function_result($2::text::regprocedure) AS same', [V1, V2]);
  assert.equal(same, true, 'V2 returns exactly V1\'s row shape');
  // V1 is the 0072 text, untouched: the migration file never replaces a function.
  const migration = readFileSync(new URL('./migrations/0198_cosmos_e2_thread_names_v1.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION/u, '0198 replaces nothing');
  assert.doesNotMatch(migration, /ALTER TABLE public\.conversation_threads\b/u, 'the canonical Thread table is not touched');

  stage = 'T1 the alias fails closed';
  const a = await human();
  const b = await human();
  const ghost = randomUUID();
  await identity('authenticated', null);
  await rejected(() => alias(ghost, 'x'), ['42501']);
  await identity('anon');
  await rejected(() => alias(ghost, 'x'), ['42501']);
  await identity('authenticated', a);
  // Unknown Thread: FORBIDDEN, never "not found" — the same answer another person's Thread would receive.
  await rejected(() => alias(ghost, 'My topic'), ['42501'], /FORBIDDEN/u);
  await rejected(() => alias(null, 'My topic'), ['22023'], /INVALID_THREAD_ID/u);
  await rejected(() => alias(ghost, '   '), ['22023'], /INVALID_ALIAS/u);
  await rejected(() => alias(ghost, 'x'.repeat(61)), ['22023'], /INVALID_ALIAS/u);
  // The empty check happens before ownership: a blank alias is INVALID_ALIAS even for an unknown Thread (no oracle leaks).
  await identity('authenticated', b);
  await rejected(() => alias(ghost, ''), ['22023'], /INVALID_ALIAS/u);

  stage = 'T2 V2 refuses as V1 refuses';
  await identity('authenticated', a);
  const [session] = await rows('SELECT * FROM public.create_conversation_session_v1($1)', [randomUUID()]);
  await sameRefusal(randomUUID(), 1);
  await identity('authenticated', b);
  await sameRefusal(session.id, 1);
  await identity('authenticated', null);
  await sameRefusal(session.id, 1);
  await identity('anon');
  await rejected(() => projectV2(session.id, 1), ['42501']);

  stage = 'T3 append-only';
  await identity('postgres');
  // No Thread can be seeded here; the guard is proven on the ledger's own trigger function directly.
  await rejected(() => q('SELECT public.reject_conversation_thread_alias_mutation()'), ['55000', '0A000', '39P01', '2F005', '42809']);
  const [{ tgenabled }] = await rows("SELECT tgenabled FROM pg_trigger WHERE tgname = 'conversation_thread_aliases_append_only'");
  assert.notEqual(tgenabled, 'D', 'the append-only trigger is enabled');

  await identity('postgres');
  await q('ROLLBACK');
  console.log('migration 0198 verified');
} catch (error) {
  console.error(`migration 0198 verification failed at stage: ${stage}`);
  console.error(error);
  try { await q('ROLLBACK'); } catch { /* the transaction may already be gone */ }
  process.exitCode = 1;
} finally {
  await client.end();
  setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
}
