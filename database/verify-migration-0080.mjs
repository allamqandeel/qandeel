// Real-PostgreSQL verifier for migration 0080 - Shared Pre-Model World-State
// Resolution Boundary v1 (I-03E).
//
// Runs against a fully migrated database and proves, from live catalogs and
// live behaviour rather than from the migration text:
//
//   * catalog: the World-state resolver exists exactly once, is owned by
//     postgres, is SECURITY DEFINER and STABLE with an empty search_path,
//     takes exactly (p_world_id uuid) and returns exactly the three minimal
//     columns; its source reads only the Shared World row's lifecycle and
//     phase (never membership, grants, consent, Shared material, Personal
//     context, closed_at / born_at / birth_basis or auth.uid); shared_worlds
//     keeps RLS on with zero policies. (Whether a later migration adds a
//     table, trigger or function elsewhere is not a 0080 property: the static
//     contract proves that migration 0080 itself created no table, view, type,
//     trigger, policy or extension, and this historical verifier asserts no
//     global relation, function or trigger ceiling.)
//   * execute ACL: PUBLIC, anon and authenticated cannot execute it (catalog
//     privilege AND an actual 42501 under SET LOCAL ROLE); service_role can;
//   * direct table ACL stays sealed: anon, authenticated and service_role still
//     hold no SELECT / INSERT / UPDATE / DELETE on shared_worlds (catalog AND
//     actual rejections);
//   * behaviour, inside one rolled-back transaction: NULL is a bounded error;
//     a nonexistent World is P0002 (never zero rows, never a closed row);
//     ACTIVE / STANDARD, ACTIVE / INTRODUCTION, READ_ONLY_CLOSED / STANDARD and
//     READ_ONLY_CLOSED / INTRODUCTION each resolve to exactly their one exact
//     row; another World never leaks into a result; a World with zero
//     membership episodes, zero grants and zero consent events resolves (no
//     membership / grant / material read is needed) and adding those rows
//     changes nothing; resolution mutates nothing; the ONE path works for
//     service_role; a hypothetical later unrelated trigger on shared_worlds
//     does not make this verifier fail; zero fixture residue.
//
// Nothing here weakens an ACL: application roles are used only to prove
// denial, and service_role only to prove the ONE narrow read path. No lifecycle
// mutation command exists and none is invented: closed fixtures are inserted
// closed by the owner, exactly as the 0075 / 0078 / 0079 verifiers do.
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

const FN = 'public.resolve_shared_world_pre_model_state_v1(uuid)';
const FN_NAME = 'resolve_shared_world_pre_model_state_v1';
const WORLDS = 'public.shared_worlds';
const EPISODES = 'public.shared_world_membership_episodes';
const GRANTS = 'public.shared_world_standing_context_grants';
const AUDIENCE = 'public.shared_world_standing_context_grant_audience';
const EVENTS = 'public.shared_world_standing_context_consent_events';
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];
const NO_DATA = ['P0002'];

const resolve = (worldId) => rows(`SELECT world_id, lifecycle, phase FROM public.${FN_NAME}($1)`, [worldId]);

async function verifyCatalog() {
  stage = 'catalog: function';
  const procs = await rows(
    `SELECT pr.oid, pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_userbyid(pr.proowner) owner,
            pg_get_function_identity_arguments(pr.oid) args, pg_get_function_result(pr.oid) result
       FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname = $1`,
    [FN_NAME],
  );
  assert.equal(procs.length, 1, 'the World-state resolver exists exactly once');
  const [fn] = procs;
  assert.equal(fn.owner, 'postgres', 'the World-state resolver is owned by postgres');
  assert.equal(fn.prosecdef, true, 'the World-state resolver is SECURITY DEFINER');
  assert.equal(fn.provolatile, 's', 'the World-state resolver is STABLE');
  assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'), 'the World-state resolver pins an empty search_path');
  assert.equal(fn.args, 'p_world_id uuid', 'the World-state resolver takes exactly the World UUID');
  assert.equal(fn.result, 'TABLE(world_id uuid, lifecycle text, phase text)', 'the World-state resolver returns exactly the three minimal columns');
  assert.match(fn.prosrc, /IF NOT EXISTS \(SELECT 1 FROM public\.shared_worlds w WHERE w\.id = p_world_id\) THEN/u, 'canonical existence is positively checked');
  assert.match(fn.prosrc, /SELECT w\.id, w\.lifecycle, w\.phase\s+FROM public\.shared_worlds w\s+WHERE w\.id = p_world_id;/u, 'exactly the canonical row is returned');
  assert.doesNotMatch(fn.prosrc, /membership_episodes|standing_context|grant|consent|conversation|memor|him_|hypothes|auth\.uid|request\.jwt|INSERT|UPDATE|DELETE|MERGE|TRUNCATE|closed_at|born_at|birth_basis|LIMIT|UNION|JOIN/iu,
    'the World-state resolver reads only the Shared World row\'s lifecycle and phase and writes nothing');

  stage = 'catalog: shared_worlds keeps RLS on with zero policies';
  const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass', [WORLDS]);
  assert.equal(policies, 0, `${WORLDS} carries zero RLS policies`);
  const [{ rls }] = await rows('SELECT c.relrowsecurity rls FROM pg_class c WHERE c.oid=$1::regclass', [WORLDS]);
  assert.equal(rls, true, `${WORLDS} keeps row level security enabled`);
}

async function verifyExecuteAcl() {
  stage = 'execute ACL: catalog';
  for (const role of ['public', 'anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the World-state resolver`);
  }
  const [{ allowed: serviceRole }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', ['service_role', FN, 'EXECUTE']);
  assert.equal(serviceRole, true, 'service_role executes the World-state resolver');

  stage = 'execute ACL: behaviour';
  for (const role of ['anon', 'authenticated']) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => resolve(randomUUID()), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function verifyDirectTableAclSealed() {
  stage = 'direct table ACL: catalog';
  for (const role of APPLICATION_ROLES) {
    for (const privilege of PRIVILEGES) {
      const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, WORLDS, privilege]);
      assert.equal(allowed, false, `${role} must still not hold ${privilege} on ${WORLDS}`);
    }
  }
  const [{ n: publicGrants }] = await rows('SELECT count(*)::int n FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0', [WORLDS]);
  assert.equal(publicGrants, 0, `no PUBLIC grant on ${WORLDS}`);

  stage = 'direct table ACL: behaviour';
  for (const role of APPLICATION_ROLES) {
    await identity(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => q(`SELECT * FROM ${WORLDS} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`SELECT lifecycle, phase FROM ${WORLDS} WHERE id=$1`, [randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`DELETE FROM ${WORLDS}`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION')`, [randomUUID()]), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${WORLDS} SET lifecycle='READ_ONLY_CLOSED', closed_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE);
    await rejected(() => q(`UPDATE ${WORLDS} SET lifecycle='ACTIVE', closed_at=NULL`), INSUFFICIENT_PRIVILEGE);
  }
  await identity('postgres');
}

async function counts(worldIds) {
  const [c] = await rows(
    `SELECT (SELECT count(*)::int FROM ${WORLDS} WHERE id = ANY($1::uuid[])) worlds,
            (SELECT count(*)::int FROM ${WORLDS} WHERE id = ANY($1::uuid[]) AND lifecycle = 'ACTIVE') active,
            (SELECT count(*)::int FROM ${EPISODES} WHERE world_id = ANY($1::uuid[])) episodes,
            (SELECT count(*)::int FROM ${GRANTS} WHERE world_id = ANY($1::uuid[])) grants,
            (SELECT count(*)::int FROM ${AUDIENCE} a JOIN ${GRANTS} g ON g.id=a.grant_id WHERE g.world_id = ANY($1::uuid[])) ceiling,
            (SELECT count(*)::int FROM ${EVENTS} WHERE world_id = ANY($1::uuid[])) events`,
    [worldIds],
  );
  return c;
}

async function verifyBehaviour(f) {
  const { activeStandard, activeIntroduction, closedStandard, closedIntroduction, mohamed, hadir } = f;
  const worlds = [activeStandard, activeIntroduction, closedStandard, closedIntroduction];
  const e1 = randomUUID(), e2 = randomUUID(), grant = randomUUID();
  await identity('postgres');

  stage = 'behaviour: NULL is a bounded error; a nonexistent World is P0002, never zero rows and never a closed row';
  await rejected(() => resolve(null), INVALID_PARAMETER);
  await rejected(() => resolve(randomUUID()), NO_DATA);

  stage = 'behaviour: a World with zero episodes, grants and events resolves - no membership, grant or material read is needed';
  assert.deepEqual(await counts([activeStandard]), { worlds: 1, active: 1, episodes: 0, grants: 0, ceiling: 0, events: 0 });
  assert.deepEqual(await resolve(activeStandard), [{ world_id: activeStandard, lifecycle: 'ACTIVE', phase: 'STANDARD' }], 'ACTIVE / STANDARD is exactly its one row');

  stage = 'behaviour: every legal state resolves to exactly its own row';
  assert.deepEqual(await resolve(activeIntroduction), [{ world_id: activeIntroduction, lifecycle: 'ACTIVE', phase: 'INTRODUCTION' }], 'ACTIVE / INTRODUCTION is exactly its one row');
  assert.deepEqual(await resolve(closedStandard), [{ world_id: closedStandard, lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }], 'READ_ONLY_CLOSED / STANDARD is exactly its one closed row');
  assert.deepEqual(await resolve(closedIntroduction), [{ world_id: closedIntroduction, lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }], 'READ_ONLY_CLOSED / INTRODUCTION is exactly its one closed row');

  stage = 'behaviour: another World never leaks into a result';
  for (const target of worlds) {
    const result = await resolve(target);
    assert.equal(result.length, 1, 'exactly one row');
    assert.equal(result[0].world_id, target, 'the row is the requested World');
    assert.deepEqual(Object.keys(result[0]).sort(), ['lifecycle', 'phase', 'world_id'], 'only identity, lifecycle and phase are returned');
  }

  stage = 'behaviour: membership, grant and consent rows change nothing in the World-state answer';
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP),($4,$2,$5,CURRENT_TIMESTAMP)`, [e1, activeStandard, mohamed, e2, hadir]);
  await q(`INSERT INTO ${GRANTS}(id,world_id,grantor_user_id,status) VALUES($1,$2,$3,'ACTIVE')`, [grant, activeStandard, mohamed]);
  await q(`INSERT INTO ${AUDIENCE}(grant_id,audience_user_id) VALUES($1,$2),($1,$3)`, [grant, mohamed, hadir]);
  assert.deepEqual(await resolve(activeStandard), [{ world_id: activeStandard, lifecycle: 'ACTIVE', phase: 'STANDARD' }], 'occupancy and Standing Context state never enter the World-state answer');
  // A closed World keeps resolving as closed whatever open episodes it carries: audience state is I-03D's separate fact.
  await q(`INSERT INTO ${EPISODES}(id,world_id,user_id,joined_at) VALUES($1,$2,$3,'2026-01-01T00:00:00Z')`, [randomUUID(), closedStandard, mohamed]);
  assert.deepEqual(await resolve(closedStandard), [{ world_id: closedStandard, lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }], 'an open episode does not reopen a closed World');

  stage = 'behaviour: resolution mutates nothing';
  const before = await counts(worlds);
  for (const target of worlds) await resolve(target);
  await rejected(() => resolve(randomUUID()), NO_DATA);
  assert.deepEqual(await counts(worlds), before, 'no World, episode, grant, ceiling or consent row changed');
  assert.deepEqual(before, { worlds: 4, active: 2, episodes: 3, grants: 1, ceiling: 2, events: 0 });
  const [{ same }] = await rows(`SELECT bool_and((lifecycle, phase) IN (('ACTIVE','STANDARD'),('ACTIVE','INTRODUCTION'),('READ_ONLY_CLOSED','STANDARD'),('READ_ONLY_CLOSED','INTRODUCTION'))) same FROM ${WORLDS} WHERE id = ANY($1::uuid[])`, [worlds]);
  assert.equal(same, true, 'lifecycle and phase are unchanged');

  stage = 'behaviour: the ONE path works for service_role';
  await identity('service_role');
  assert.deepEqual(await resolve(activeIntroduction), [{ world_id: activeIntroduction, lifecycle: 'ACTIVE', phase: 'INTRODUCTION' }], 'service_role resolves through the RPC without any direct table privilege');
  assert.deepEqual(await resolve(closedIntroduction), [{ world_id: closedIntroduction, lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }]);
  await rejected(() => resolve(randomUUID()), NO_DATA);
  await identity('postgres');
  return [e1, e2, grant];
}

// Forward safety / non-vacuity. A later, separately reviewed lifecycle or
// governance migration may legitimately add a trigger on shared_worlds. This
// proves that such a trigger does not make the historical 0080 verifier fail
// merely by existing: the catalog proofs and the read path are unaffected.
// Everything is created inside the rolled-back fixture transaction.
async function verifyForwardSafety(f) {
  stage = 'forward safety: a later unrelated trigger on shared_worlds is not a 0080 failure';
  await identity('postgres');
  const probe = `i03e_forward_safety_probe_${randomUUID().replace(/-/gu, '')}`;
  await q(`CREATE FUNCTION public.${probe}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$`);
  await q(`CREATE TRIGGER ${probe}_worlds AFTER UPDATE ON ${WORLDS} FOR EACH ROW EXECUTE FUNCTION public.${probe}()`);
  const [{ n }] = await rows('SELECT count(*)::int n FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal', [WORLDS]);
  assert.ok(n >= 1, `${WORLDS} now carries the hypothetical later trigger`);
  await verifyCatalog();
  assert.deepEqual(await resolve(f.activeStandard), [{ world_id: f.activeStandard, lifecycle: 'ACTIVE', phase: 'STANDARD' }], 'the read path is unaffected by the unrelated trigger');
  await identity('service_role');
  assert.deepEqual(await resolve(f.closedStandard), [{ world_id: f.closedStandard, lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }]);
  await identity('postgres');
  return probe;
}

async function main() {
  const f = { activeStandard: randomUUID(), activeIntroduction: randomUUID(), closedStandard: randomUUID(), closedIntroduction: randomUUID(), mohamed: randomUUID(), hadir: randomUUID() };
  let fixtureIds = [];
  let probe = 'i03e_forward_safety_probe_none';
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await verifyExecuteAcl();
      await verifyDirectTableAclSealed();
      await identity('postgres');
      // Fixture humans are provisioned the canonical way (auth.users -> the
      // migration-0002 trigger -> public.users); fixture Worlds are inserted by
      // the owner in their legal states exactly as the 0075 / 0078 / 0079
      // verifiers do. No lifecycle command exists yet, and none is invented here.
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [f.mohamed, f.hadir]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis) VALUES($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION'),($2,'ACTIVE','INTRODUCTION','MUTUAL_MATCH')`, [f.activeStandard, f.activeIntroduction]);
      await q(`INSERT INTO ${WORLDS}(id,lifecycle,phase,birth_basis,born_at,closed_at) VALUES($1,'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z'),($2,'READ_ONLY_CLOSED','INTRODUCTION','MUTUAL_MATCH','2026-01-01T00:00:00Z','2026-01-03T00:00:00Z')`, [f.closedStandard, f.closedIntroduction]);
      fixtureIds = await verifyBehaviour(f);
      probe = await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }
    stage = 'fixture residue';
    const worlds = [f.activeStandard, f.activeIntroduction, f.closedStandard, f.closedIntroduction];
    const humans = [f.mohamed, f.hadir];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${WORLDS} WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]) OR user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${GRANTS} WHERE id = ANY($2::uuid[]) OR world_id = ANY($1::uuid[]) OR grantor_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${AUDIENCE} WHERE grant_id = ANY($2::uuid[]) OR audience_user_id = ANY($3::uuid[]))
            + (SELECT count(*) FROM ${EVENTS} WHERE world_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($3::uuid[]))
            + (SELECT count(*) FROM pg_proc WHERE proname = $4)
            + (SELECT count(*) FROM pg_trigger WHERE tgname LIKE $4 || '%') AS n`,
      [worlds, fixtureIds, humans, probe],
    );
    assert.equal(Number(n), 0, 'no fixture row remains after completion');
    console.log('Verified migration 0080: resolve_shared_world_pre_model_state_v1 exists once as a STABLE SECURITY DEFINER function with an empty search_path and exactly (world uuid) -> (world_id, lifecycle, phase); PUBLIC/anon/authenticated cannot execute it and service_role can; anon/authenticated/service_role still hold no direct SELECT/INSERT/UPDATE/DELETE on shared_worlds; NULL is a bounded error and a nonexistent World is P0002 (never zero rows, never a closed row); ACTIVE/STANDARD, ACTIVE/INTRODUCTION, READ_ONLY_CLOSED/STANDARD and READ_ONLY_CLOSED/INTRODUCTION each resolve to exactly their own row; no membership, grant or material read is needed and none changes the answer; resolution mutates nothing; a hypothetical later trigger on shared_worlds does not fail this verifier; zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Shared pre-model World-state resolution verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
