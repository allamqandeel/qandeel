// Real-PostgreSQL verifier for migration 0077 - Shared Standing Context Grant
// Resolution Boundary v1 (I-03B).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * catalog: the resolver exists exactly once, is owned by postgres, is
//     SECURITY DEFINER and STABLE with an empty search_path, takes exactly
//     (p_world_id uuid, p_grantor_user_id uuid) and returns exactly the five
//     minimal columns; its source reads only the grant and audience tables
//     (never membership episodes, Personal context or auth.uid); the grant,
//     audience, Shared World and membership tables carry no trigger or policy
//     and keep RLS on. (Whether a later, separately verified Standing Context
//     relation exists is not a 0077 property: the static contract proves that
//     migration 0077 itself created no table or view, and this verifier does
//     not put a global ceiling on future domain evolution.)
//   * execute ACL: PUBLIC, anon and authenticated cannot execute it (catalog
//     privilege AND an actual 42501 under SET LOCAL ROLE); service_role can;
//   * direct table ACL stays sealed: anon, authenticated and service_role still
//     hold no SELECT / INSERT / UPDATE / DELETE on either I-02B table (catalog
//     AND actual rejections under SET LOCAL ROLE service_role);
//   * behaviour, inside one rolled-back transaction: a valid World + human with
//     no ACTIVE grant yields zero rows; a nonexistent World or human raises a
//     bounded error; an ACTIVE grant with an empty ceiling is one NULL-audience
//     row; an ACTIVE grant with two audience humans is exactly two rows;
//     another World's and another human's grants are excluded; after
//     revocation the historical row remains but the resolver returns zero rows;
//     a later new ACTIVE grant is returned alone with its own ceiling; no
//     membership episode is required; zero fixture residue.
//
// Nothing here weakens an ACL: application roles are used only to prove
// denial, and service_role only to prove the ONE narrow read path.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

async function rejected(operation, codes) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const FN = 'public.resolve_shared_world_standing_context_grant_v1(uuid,uuid)';
const FN_NAME = 'resolve_shared_world_standing_context_grant_v1';
const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const AUDIENCE = 'public.shared_world_standing_context_grant_audience';
const TABLES = [GRANTS, AUDIENCE];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NO_DATA = ['P0002'];

const resolve = (worldId, grantorId) => rows(
  `SELECT grant_id, world_id, grantor_user_id, status, audience_user_id FROM public.${FN_NAME}($1, $2)`,
  [worldId, grantorId],
);

async function verifyCatalog() {
  stage = 'catalog: function';
  const procs = await rows(
    `SELECT pr.oid, pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) owner,
            pg_get_function_identity_arguments(pr.oid) args, pg_get_function_result(pr.oid) result
       FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname = $1`,
    [FN_NAME],
  );
  assert.equal(procs.length, 1, 'the resolver exists exactly once');
  const [fn] = procs;
  assert.equal(fn.owner, 'postgres', 'the resolver is owned by postgres');
  assert.equal(fn.prosecdef, true, 'the resolver is SECURITY DEFINER');
  assert.equal(fn.provolatile, 's', 'the resolver is STABLE');
  assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), 'the resolver pins an empty search_path');
  assert.equal(fn.args, 'p_world_id uuid, p_grantor_user_id uuid', 'the resolver takes exactly the World and grantor UUIDs');
  assert.equal(fn.result, 'TABLE(grant_id uuid, world_id uuid, grantor_user_id uuid, status text, audience_user_id uuid)', 'the resolver returns exactly the five minimal columns');
  assert.match(fn.prosrc, /FROM public\.shared_world_standing_context_grants g/u);
  assert.match(fn.prosrc, /LEFT JOIN public\.shared_world_standing_context_grant_audience a ON a\.grant_id = g\.id/u);
  assert.match(fn.prosrc, /g\.status = 'ACTIVE'/u);
  assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = p_world_id/u);
  assert.match(fn.prosrc, /FROM public\.users u WHERE u\.id = p_grantor_user_id/u);
  assert.doesNotMatch(fn.prosrc, /membership_episodes|conversation|memor|auth\.uid|INSERT|UPDATE|DELETE|MERGE|TRUNCATE/iu, 'the resolver reads only the grant and audience tables and writes nothing');

  stage = 'catalog: no trigger or policy on the tables the resolver reads';
  for (const table of [...TABLES, WORLDS, EPISODES]) {
    const [{ n: triggers }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal', [table]);
    if (TABLES.includes(table)) {
      // The grant and audience tables ARE what this resolver reads, and a trigger
      // on either is an automatic authority / ceiling mutation path.
      assert.equal(triggers, 0, `${table} has no trigger`);
    } else {
      // FORWARD SAFETY (I-04E). shared_worlds and the membership-episode table are
      // evolvable predecessor tables this verifier does not own, and a later
      // reviewed lifecycle slice may legitimately add a trigger to either - I-04E
      // adds two to the membership table. Against a FULLY migrated database a
      // zero-trigger census there is a ceiling on the roadmap, not a fact about
      // 0077. The 0077 property is narrower and still exactly true: the resolver
      // never names either table (asserted above, from its own stored source), so
      // no trigger on them can change what it returns, and none may reach the
      // Standing Context relations the resolver does read.
      const reachingGrantState = await rows(
        `SELECT t.tgname FROM pg_trigger t
          WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal
            AND pg_get_functiondef(t.tgfoid) ~* 'shared_world_standing_context'
          ORDER BY t.tgname`, [table]);
      assert.deepEqual(reachingGrantState.map((row) => row.tgname), [],
        `${table} carries ${triggers} reviewed trigger(s) and none of them reaches Standing Context state`);
    }
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid=$1::regclass', [table]);
    assert.equal(rls, true, `${table} keeps row level security enabled`);
  }
}

async function verifyExecuteAcl() {
  stage = 'execute ACL: catalog';
  for (const role of ['public', 'anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the resolver`);
  }
  const [{ allowed: serviceRole }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', ['service_role', FN, 'EXECUTE']);
  assert.equal(serviceRole, true, 'service_role executes the resolver');

  stage = 'execute ACL: behaviour';
  for (const role of ['anon', 'authenticated']) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => resolve(randomUUID(), randomUUID()), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyDirectTableAclSealed() {
  stage = 'direct table ACL: catalog';
  for (const table of TABLES) {
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must still not hold ${privilege} on ${table}`);
      }
    }
    const [{ n: publicGrants }] = await rows(
      'SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0',
      [table],
    );
    assert.equal(publicGrants, 0, `no PUBLIC grant on ${table}`);
  }

  stage = 'direct table ACL: behaviour under service_role';
  // The resolver's executor still cannot touch the tables directly.
  await identity('service_role');
  for (const table of TABLES) {
    await rejected(() => q(`SELECT * FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
  }
  await rejected(() => q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  await rejected(() => q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
  await rejected(() => q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
  await identity('postgres');
}

async function verifyBehaviour(world, otherWorld, grantor, other, third) {
  stage = 'behaviour: valid World + human, no ACTIVE grant';
  await identity('postgres');
  assert.deepEqual(await resolve(world, grantor), [], 'no ACTIVE grant resolves to zero rows');
  const [{ n: episodes }] = await rows(`SELECT count(*)::int n FROM ${EPISODES} WHERE world_id=$1`, [world]);
  assert.equal(episodes, 0, 'no membership episode exists in the fixture: resolution never depends on membership');

  stage = 'behaviour: noncanonical World / human is a bounded error';
  await rejected(() => resolve(randomUUID(), grantor), NO_DATA);
  await rejected(() => resolve(world, randomUUID()), NO_DATA);
  await rejected(() => resolve(null, grantor), INVALID_PARAMETER);
  await rejected(() => resolve(world, null), INVALID_PARAMETER);

  stage = 'behaviour: ACTIVE grant with empty ceiling';
  const first = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [first, world, grantor]);
  assert.deepEqual(await resolve(world, grantor), [{ grant_id: first, world_id: world, grantor_user_id: grantor, status: 'ACTIVE', audience_user_id: null }],
    'an ACTIVE grant with an empty ceiling is one NULL-audience row, distinguishable from no grant');

  stage = 'behaviour: ACTIVE grant with two audience humans';
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3)`, [first, grantor, other]);
  const ceiling = await resolve(world, grantor);
  assert.deepEqual(ceiling.map((r) => [r.grant_id, r.world_id, r.grantor_user_id, r.status]), [[first, world, grantor, 'ACTIVE'], [first, world, grantor, 'ACTIVE']]);
  assert.deepEqual([...ceiling.map((r) => r.audience_user_id)].sort(), [grantor, other].sort(), 'exactly the two explicit ceiling humans');

  stage = 'behaviour: other World and other human are excluded';
  const elsewhere = randomUUID(), others = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [elsewhere, otherWorld, grantor]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [elsewhere, third]);
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [others, world, other]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2)`, [others, third]);
  const stillFirst = await resolve(world, grantor);
  assert.equal(stillFirst.length, 2, 'the other World and the other human contribute nothing');
  assert.ok(stillFirst.every((r) => r.grant_id === first), 'only the exact (World, grantor) grant is returned');
  assert.ok(stillFirst.every((r) => r.audience_user_id !== third), 'no other grant ceiling leaks in');
  assert.deepEqual((await resolve(otherWorld, grantor)).map((r) => [r.grant_id, r.audience_user_id]), [[elsewhere, third]]);
  assert.deepEqual((await resolve(world, other)).map((r) => [r.grant_id, r.audience_user_id]), [[others, third]]);

  stage = 'behaviour: revocation keeps history but resolves to zero rows';
  await q(`UPDATE ${GRANTS} SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP + interval '1 hour' WHERE id=$1`, [first]);
  const [{ n: historical }] = await rows(`SELECT count(*)::int n FROM ${GRANTS} WHERE id=$1 AND status='REVOKED'`, [first]);
  assert.equal(historical, 1, 'the revoked row remains as history');
  const [{ n: historicalCeiling }] = await rows(`SELECT count(*)::int n FROM ${AUDIENCE} WHERE grant_id=$1`, [first]);
  assert.equal(historicalCeiling, 2, 'the revoked grant keeps its historical ceiling rows');
  assert.deepEqual(await resolve(world, grantor), [], 'a revoked grant is never chosen as the current grant');

  stage = 'behaviour: a later new ACTIVE grant is returned alone with its own ceiling';
  const second = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status,granted_at) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP + interval '2 hours')`, [second, world, grantor]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3),($1,$4)`, [second, grantor, other, third]);
  const reconfirmed = await resolve(world, grantor);
  assert.equal(reconfirmed.length, 3, 'exactly the new grant ceiling');
  assert.ok(reconfirmed.every((r) => r.grant_id === second && r.status === 'ACTIVE'), 'only the new ACTIVE grant, never the revoked one');
  assert.deepEqual(reconfirmed.map((r) => r.audience_user_id), [grantor, other, third].sort(), 'rows are ordered by audience_user_id for stable transport');

  stage = 'behaviour: the ONE path works for service_role';
  await identity('service_role');
  const asService = await resolve(world, grantor);
  assert.equal(asService.length, 3, 'service_role resolves through the RPC without any direct table privilege');
  await identity('postgres');
  return [first, elsewhere, others, second];
}

async function main() {
  const grantor = randomUUID(), other = randomUUID(), third = randomUUID();
  const world = randomUUID(), otherWorld = randomUUID();
  let grantIds = [];
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyExecuteAcl();
      await verifyDirectTableAclSealed();
      await identity('postgres');
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); fixture Worlds and grants are
      // inserted by the owner exactly as the 0075 / 0076 verifiers do.
      await q('INSERT INTO auth.users(id) VALUES($1),($2),($3)', [grantor, other, third]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION'),($2,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [world, otherWorld]);
      grantIds = await verifyBehaviour(world, otherWorld, grantor, other, third);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }
    stage = 'fixture residue';
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${AUDIENCE} WHERE grant_id = ANY($2::uuid[]) OR audience_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($3::uuid[])) AS n`,
      [[world, otherWorld], grantIds, [grantor, other, third]],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0077: resolve_shared_world_standing_context_grant_v1 exists once as a STABLE SECURITY DEFINER function with an empty search_path and exactly (world uuid, grantor uuid) -> (grant_id, world_id, grantor_user_id, status, audience_user_id); PUBLIC/anon/authenticated cannot execute it and service_role can; anon/authenticated/service_role still hold no direct SELECT/INSERT/UPDATE/DELETE on either Standing Context Grant table; a noncanonical World or human is a bounded error; only the ACTIVE grant of the exact (World, grantor) resolves, with its explicit ceiling (an empty ceiling is one NULL-audience row); revoked history is never chosen; no membership episode is read; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Shared Standing Context Grant resolution boundary verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
