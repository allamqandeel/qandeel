// Real-PostgreSQL verifier for migration 0199 (COSMOS E-2 corrections, Slice C: the user-level CURRENT Personal World
// under the Product Owner's decision D-5, Option U, 2026-11-20). No provider is called; every scenario runs in ONE
// transaction that is rolled back, so nothing is retained.
//
//   T0   catalogue: the definer is postgres-owned, SECURITY DEFINER, search_path-pinned, EXECUTE to authenticated only
//        (anon and service_role refused); the migration replaces nothing and touches no Thread / Home table
//   T1   fails closed: no caller is FORBIDDEN (42501); anon is refused
//   T2   a person with no Thread receives ONE row with an empty list and a present `as_of` — a truthful empty world
//   T3   the frozen Session-bound projection is untouched: V1 and V2 still answer exactly as before for the same caller
//
// Honest limit: establishing a real Thread needs the production establishment pipeline (0066 → 0070); this verifier
// does NOT seed Threads. The per-Thread row (Home, name, origin) is proven by the API and client tests over served rows
// and by the static SQL pins; against real Threads it is NOT TESTED here and is reported as such.
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

const FN = 'public.get_user_current_personal_world_v1()';
const world = () => rows('SELECT * FROM public.get_user_current_personal_world_v1()');
async function human() {
  const id = randomUUID();
  await identity('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = $1', [id]);
  assert.equal(n, 1, 'the auth provisioning trigger created the public.users row');
  return id;
}
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

try {
  await client.connect();
  await q('BEGIN');
  const serviceRole = (await rows("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'")).length === 1;

  stage = 'T0 catalogue';
  const [row] = await rows(
    `SELECT p.prosecdef, r.rolname AS owner,
            EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS pinned,
            has_function_privilege('anon', $2::text, 'EXECUTE') AS anon_can,
            has_function_privilege('authenticated', $2::text, 'EXECUTE') AS authenticated_can
       FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.oid = $1::text::regprocedure`, [FN, FN]);
  assert.ok(row, `${FN} exists`);
  assert.equal(row.prosecdef, true, `${FN} is SECURITY DEFINER`);
  assert.equal(row.owner, 'postgres', `${FN} is owned by postgres`);
  assert.equal(row.pinned, true, `${FN} pins its search_path`);
  assert.equal(row.anon_can, false, `anon cannot execute ${FN}`);
  assert.equal(row.authenticated_can, true, `authenticated can execute ${FN}`);
  if (serviceRole) {
    const [{ can }] = await rows("SELECT has_function_privilege('service_role', $1::text, 'EXECUTE') AS can", [FN]);
    assert.equal(can, false, `service_role cannot execute ${FN}`);
  }
  const migration = readFileSync(new URL('./migrations/0199_cosmos_e2_current_personal_world_v1.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION/u, '0199 replaces nothing');
  assert.doesNotMatch(migration, /(?:CREATE|ALTER|DROP)\s+TABLE|INSERT\s+INTO|UPDATE\s+public\./u, '0199 creates, alters or writes no table');

  stage = 'T1 fails closed';
  await identity('authenticated', null);
  await rejected(world, ['42501']);
  await identity('anon');
  await rejected(world, ['42501']);

  stage = 'T2 an empty world is one truthful row';
  const a = await human();
  await identity('authenticated', a);
  const served = await world();
  assert.equal(served.length, 1, 'exactly one row');
  assert.ok(served[0].as_of instanceof Date, 'as_of is the instant of the read');
  assert.deepEqual(served[0].threads, [], 'a person with no Thread has an empty world, not an error');

  stage = 'T3 the Session-bound projection is untouched';
  const [session] = await rows('SELECT * FROM public.create_conversation_session_v1($1)', [randomUUID()]);
  const v1 = await outcomeOf(() => rows('SELECT * FROM public.get_session_historical_projection_v1($1, $2)', [session.id, 1]));
  const v2 = await outcomeOf(() => rows('SELECT * FROM public.get_session_historical_projection_v2($1, $2)', [session.id, 1]));
  assert.deepEqual(v2, v1, 'V2 still answers exactly as V1 answers');
  assert.ok('code' in v1, 'a Session with no Live Head is still refused by the frozen law (LIVE_HEAD_NOT_ESTABLISHED)');

  await identity('postgres');
  await q('ROLLBACK');
  console.log('migration 0199 verified');
} catch (error) {
  console.error(`migration 0199 verification failed at stage: ${stage}`);
  console.error(error);
  try { await q('ROLLBACK'); } catch { /* the transaction may already be gone */ }
  process.exitCode = 1;
} finally {
  await client.end();
  setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
}
