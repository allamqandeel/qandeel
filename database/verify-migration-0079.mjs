// Real-PostgreSQL verifier for migration 0079 - Shared Human Audience Snapshot
// Resolution Boundary v1 (I-03D).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * catalog: the audience resolver exists exactly once, is owned by
//     postgres, is SECURITY DEFINER and STABLE with an empty search_path,
//     takes exactly (p_world_id uuid) and returns exactly the three minimal
//     columns; its source reads only the Shared World row and the membership
//     episodes (never lifecycle, grants, Shared material, Personal context or
//     auth.uid); the two I-02A tables keep RLS on with zero policies. (Whether
//     a later migration adds a trigger elsewhere is not a 0079 property: the
//     static contract proves that migration 0079 itself created no table,
//     view, type, trigger or policy.)
//   * execute ACL: PUBLIC, anon and authenticated cannot execute it (catalog
//     privilege AND an actual 42501 under SET LOCAL ROLE); service_role can;
//   * direct table ACL stays sealed: anon, authenticated and service_role still
//     hold no SELECT / INSERT / UPDATE / DELETE on shared_worlds or
//     shared_world_membership_episodes (catalog AND actual rejections);
//   * behaviour, inside one rolled-back transaction: a nonexistent World is a
//     bounded error (never an empty audience); a World with two open episodes
//     yields exactly two rows ordered by user then episode; a closed historical
//     episode and another World's member are excluded; one current human is
//     one row; a canonical World with zero open episodes yields zero rows; a
//     Standing Context grant ceiling naming a non-member changes nothing;
//     ending an episode removes that human; a rejoin episode returns the NEW
//     episode id; a READ_ONLY_CLOSED World with open episodes is not rejected;
//     no membership, World, grant or consent row is mutated by resolution; the
//     ONE path works for service_role; zero fixture residue.
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
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
}

const FN = 'public.resolve_shared_world_human_audience_snapshot_v1(uuid)';
const FN_NAME = 'resolve_shared_world_human_audience_snapshot_v1';
const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const AUDIENCE = 'public.shared_world_standing_context_grant_audience';
const EVENTS = 'public.shared_world_standing_context_consent_events';
const TABLES = [WORLDS, EPISODES];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NO_DATA = ['P0002'];

const resolve = (worldId) => rows(`SELECT world_id, membership_episode_id, user_id FROM public.${FN_NAME}($1)`, [worldId]);
const byUserThenEpisode = (a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : a.membership_episode_id < b.membership_episode_id ? -1 : a.membership_episode_id > b.membership_episode_id ? 1 : 0);

async function verifyCatalog() {
  stage = 'catalog: function';
  const procs = await rows(
    `SELECT pr.oid, pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) owner,
            pg_get_function_identity_arguments(pr.oid) args, pg_get_function_result(pr.oid) result
       FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname = $1`,
    [FN_NAME],
  );
  assert.equal(procs.length, 1, 'the audience resolver exists exactly once');
  const [fn] = procs;
  assert.equal(fn.owner, 'postgres', 'the audience resolver is owned by postgres');
  assert.equal(fn.prosecdef, true, 'the audience resolver is SECURITY DEFINER');
  assert.equal(fn.provolatile, 's', 'the audience resolver is STABLE');
  assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), 'the audience resolver pins an empty search_path');
  assert.equal(fn.args, 'p_world_id uuid', 'the audience resolver takes exactly the World UUID');
  assert.equal(fn.result, 'TABLE(world_id uuid, membership_episode_id uuid, user_id uuid)', 'the audience resolver returns exactly the three minimal columns');
  assert.match(fn.prosrc, /FROM public\.shared_worlds w WHERE w\.id = p_world_id/u);
  assert.match(fn.prosrc, /FROM public\.shared_world_membership_episodes e\s+WHERE e\.world_id = p_world_id\s+AND e\.ended_at IS NULL\s+ORDER BY e\.user_id, e\.id;/u);
  assert.doesNotMatch(fn.prosrc, /lifecycle|READ_ONLY_CLOSED|'ACTIVE'|standing_context|grant|conversation|memor|him_|hypothes|auth\.uid|request\.jwt|INSERT|UPDATE|DELETE|MERGE|TRUNCATE|joined_at|LIMIT|DISTINCT ON|UNION/iu,
    'the audience resolver reads only open membership episodes of the exact World and writes nothing');

  stage = 'catalog: the I-02A tables keep RLS on with zero policies';
  for (const table of TABLES) {
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
    assert.equal(allowed, false, `${role} must not execute the audience resolver`);
  }
  const [{ allowed: serviceRole }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', ['service_role', FN, 'EXECUTE']);
  assert.equal(serviceRole, true, 'service_role executes the audience resolver');

  stage = 'execute ACL: behaviour';
  for (const role of ['anon', 'authenticated']) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => resolve(randomUUID()), INSUFFICIENT_PRIVILEGE);
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
    const [{ n: publicGrants }] = await rows('SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0', [table]);
    assert.equal(publicGrants, 0, `no PUBLIC grant on ${table}`);
  }

  stage = 'direct table ACL: behaviour';
  for (const role of APPLICATION_ROLES) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    for (const table of TABLES) {
      await rejected(() => q(`SELECT * FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
      await rejected(() => q(`DELETE FROM ${table}`), INSUFFICIENT_PRIVILEGE);
    }
    await rejected(() => q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [randomUUID(), randomUUID(), randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${EPISODES} SET ended_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED', closed_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function counts(worldIds) {
  const [c] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS} WHERE id = ANY($1::uuid[])) worlds,
            (SELECT count(*)::int FROM ${EPISODES} WHERE world_id = ANY($1::uuid[])) episodes,
            (SELECT count(*)::int FROM ${EPISODES} WHERE world_id = ANY($1::uuid[]) AND ended_at IS NULL) open,
            (SELECT count(*)::int FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])) grants,
            (SELECT count(*)::int FROM ${AUDIENCE} a JOIN ${GRANTS} g ON g.id=a.grant_id WHERE g.world_id = ANY($1::uuid[])) ceiling,
            (SELECT count(*)::int FROM ${EVENTS} WHERE world_id = ANY($1::uuid[])) events`,
    [worldIds],
  );
  return c;
}

async function verifyBehaviour(f) {
  const { world, otherWorld, closedWorld, emptyWorld, mohamed, hadir, ahmed } = f;
  const worlds = [world, otherWorld, closedWorld, emptyWorld];
  const e1 = randomUUID(), e2 = randomUUID(), e3 = randomUUID(), closedEpisode = randomUUID(), elsewhere = randomUUID(), historical = randomUUID(), closedWorldEpisode = randomUUID();
  await identity('postgres');

  stage = 'behaviour: nonexistent World is a bounded error, never an empty audience';
  await rejected(() => resolve(randomUUID()), NO_DATA);
  await rejected(() => resolve(null), INVALID_PARAMETER);

  stage = 'behaviour: canonical World with zero open episodes yields zero rows';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at,ended_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')`, [historical, emptyWorld, mohamed]);
  assert.deepEqual(await resolve(emptyWorld), [], 'a closed historical episode alone is an empty current audience, and the World is still canonical');

  stage = 'behaviour: two open episodes yield exactly two rows, ordered by user then episode';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP),($4,$2,$5,CURRENT_TIMESTAMP)`, [e1, world, mohamed, e2, hadir]);
  const pair = await resolve(world);
  assert.deepEqual(pair, [{ world_id: world, membership_episode_id: e1, user_id: mohamed }, { world_id: world, membership_episode_id: e2, user_id: hadir }].sort(byUserThenEpisode), 'exactly the two open episodes, each with its episode identity');

  stage = 'behaviour: a closed historical episode and another World\'s member are excluded';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at,ended_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z')`, [closedEpisode, world, ahmed]);
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)`, [elsewhere, otherWorld, ahmed]);
  const stillPair = await resolve(world);
  assert.equal(stillPair.length, 2, 'the closed episode and the other World contribute nothing');
  assert.ok(stillPair.every((r) => r.user_id !== ahmed && r.world_id === world), 'Ahmed (closed here, open elsewhere) is not in the current audience of this World');

  stage = 'behaviour: one current human is one row';
  assert.deepEqual(await resolve(otherWorld), [{ world_id: otherWorld, membership_episode_id: elsewhere, user_id: ahmed }]);

  stage = 'behaviour: a Standing Context grant ceiling never defines the audience';
  const grant = randomUUID();
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [grant, world, mohamed]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3),($1,$4)`, [grant, mohamed, hadir, ahmed]);
  const withCeiling = await resolve(world);
  assert.equal(withCeiling.length, 2, 'a ceiling naming a non-member does not widen the current audience');
  assert.ok(withCeiling.every((r) => r.user_id !== ahmed), 'the ceiling is compared to the audience later; it never defines it');

  stage = 'behaviour: ending an episode removes that human';
  await q(`UPDATE ${EPISODES} SET ended_at=CURRENT_TIMESTAMP WHERE id=$1`, [e2]);
  assert.deepEqual(await resolve(world), [{ world_id: world, membership_episode_id: e1, user_id: mohamed }], 'after Hadir leaves only Mohamed is current');

  stage = 'behaviour: a rejoin episode returns the NEW episode identity';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP + interval '1 hour')`, [e3, world, hadir]);
  const rejoined = await resolve(world);
  assert.deepEqual(rejoined.map((r) => r.user_id).sort(), [mohamed, hadir].sort(), 'the human set is the same as before the leave');
  const hadirRow = rejoined.find((r) => r.user_id === hadir);
  assert.equal(hadirRow.membership_episode_id, e3, 'but the episode identity is the rejoin episode');
  assert.notEqual(hadirRow.membership_episode_id, e2, 'the closed episode is never chosen as "latest"');
  assert.deepEqual(rejoined, [...rejoined].sort(byUserThenEpisode), 'rows are ordered by user_id then episode id');

  stage = 'behaviour: a READ_ONLY_CLOSED World with open episodes is not rejected merely by lifecycle';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [closedWorldEpisode, closedWorld, mohamed]);
  assert.deepEqual(await resolve(closedWorld), [{ world_id: closedWorld, membership_episode_id: closedWorldEpisode, user_id: mohamed }], 'audience-state resolution is not generation permission: persisted open episodes are reported as-is');

  stage = 'behaviour: resolution mutates nothing';
  const before = await counts(worlds);
  for (const target of worlds) await resolve(target);
  await rejected(() => resolve(randomUUID()), NO_DATA);
  assert.deepEqual(await counts(worlds), before, 'no World, episode, grant, ceiling or consent row changed');
  assert.deepEqual(before, { worlds: 4, episodes: 7, open: 4, grants: 1, ceiling: 3, events: 0 });

  stage = 'behaviour: the ONE path works for service_role';
  await identity('service_role');
  const asService = await resolve(world);
  assert.equal(asService.length, 2, 'service_role resolves through the RPC without any direct table privilege');
  await rejected(() => resolve(randomUUID()), NO_DATA);
  await identity('postgres');
  return [e1, e2, e3, closedEpisode, elsewhere, historical, closedWorldEpisode];
}

async function main() {
  const f = { world: randomUUID(), otherWorld: randomUUID(), closedWorld: randomUUID(), emptyWorld: randomUUID(), mohamed: randomUUID(), hadir: randomUUID(), ahmed: randomUUID() };
  let episodeIds = [];
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyExecuteAcl();
      await verifyDirectTableAclSealed();
      await identity('postgres');
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); fixture Worlds and episodes are
      // inserted by the owner exactly as the 0075 / 0078 verifiers do. No
      // lifecycle or membership command exists yet, and none is invented here.
      await q('INSERT INTO auth.users(id) VALUES($1),($2),($3)', [f.mohamed, f.hadir, f.ahmed]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION'),($2,'ACTIVE','INTRODUCTION','MUTUAL_MATCH'),($3,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [f.world, f.otherWorld, f.emptyWorld]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,born_at,closed_at) VALUES($1,'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z')`, [f.closedWorld]);
      episodeIds = await verifyBehaviour(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }
    stage = 'fixture residue';
    const worlds = [f.world, f.otherWorld, f.closedWorld, f.emptyWorld];
    const humans = [f.mohamed, f.hadir, f.ahmed];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]) OR user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${AUDIENCE} WHERE audience_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($3::uuid[])) AS n`,
      [worlds, episodeIds, humans],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0079: resolve_shared_world_human_audience_snapshot_v1 exists once as a STABLE SECURITY DEFINER function with an empty search_path and exactly (world uuid) -> (world_id, membership_episode_id, user_id); PUBLIC/anon/authenticated cannot execute it and service_role can; anon/authenticated/service_role still hold no direct SELECT/INSERT/UPDATE/DELETE on shared_worlds or shared_world_membership_episodes; a nonexistent World is a bounded error and never an empty audience; the current audience is exactly the open episodes of the exact World (closed episodes, other Worlds and grant ceilings excluded; lifecycle not a filter); leave removes the human and rejoin returns the new episode id; resolution mutates nothing; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Shared human audience snapshot resolution verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
