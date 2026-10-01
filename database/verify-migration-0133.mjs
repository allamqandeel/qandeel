// Real-PostgreSQL verifier for migration 0133 - PROD-SEC-01 (SEC-E) Supabase default-privilege drift closure v1.
//
// It proves, never by grep alone:
//   1. on the CI database (migrations 0001-0133 applied, plain PostgreSQL ACL = exactly what migrations grant):
//      login_id_is_available_v1 is executable by service_role only, and the server channel still answers it; the two
//      first-use owner RPCs still work for their owner as `authenticated` and refuse anon; no public trigger function
//      and no 0131 sequence is reachable by a client role; the only anon-executable public function is the deliberate
//      keep-alive;
//   2. in a SCRATCH database carrying hosted Supabase's real `public` default privileges (new functions, tables and
//      sequences granted to anon / authenticated / service_role), every migration 0001-0132 applies unchanged, and the
//      census reproduces the drift EXACTLY - five functions, fourteen PUBLIC trigger functions, one sequence, and
//      nothing else - including anon calling login_id_is_available_v1 for real;
//   3. after 0133 in that scratch database: every public function, table, view and sequence grants anon and
//      authenticated exactly what the CI database grants (hosted == CI, object by object); nothing gained a privilege
//      (every object's ACL is a subset of its pre-0133 ACL, service_role included); row-level security and policies are
//      unchanged; the anon call is refused; and a NEW function, table or sequence created afterwards is granted to no
//      client role.
// The CI database is touched only inside a rolled-back transaction. The scratch database is dropped at the end.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(root, 'database/migrations');
const MIGRATION = '0133_supabase_default_privilege_drift_closure_v1.sql';
const SIM = 'qandeel_prod_sec_01_supabase_acl';
const simUrl = (() => { const url = new URL(databaseUrl); url.pathname = `/${SIM}`; return url.toString(); })();

let stage = 'connect';
const main = new Client({ connectionString: databaseUrl });
const rows = async (on, text, values = []) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(on, operation, codes) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
}

async function actAs(on, role, userId = null) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}

// The exact census the scratch database must reproduce before 0133. Anything else drifting is a new finding.
const DRIFTED_FUNCTIONS = {
  'public.login_id_is_available_v1(text)': ['anon', 'authenticated'],
  'public.read_account_first_use_v1()': ['anon'],
  'public.complete_first_use_welcome_v1()': ['anon'],
  'public.handle_new_auth_user()': ['anon', 'authenticated'],
  'public.provision_qandeel_account_identity_v1()': ['anon', 'authenticated'],
};
const PUBLIC_TRIGGER_FUNCTIONS = [
  'public.guard_him_assessed_snapshot()',
  'public.guard_him_canonical_binding_mutation()',
  'public.introduction_success_approval_pointer_truth_v1()',
  'public.introduction_terminal_commit_truth_v1()',
  'public.public_disappearance_command_answer_required_v1()',
  'public.public_identity_command_answer_required_v1()',
  'public.reject_introduction_disclosure_mutation_v1()',
  'public.reject_introduction_payload_rewrite_v1()',
  'public.reject_introduction_terminal_mutation_v1()',
  'public.reject_matching_reactivation_mutation_v1()',
  'public.reject_public_command_history_mutation_v1()',
  'public.release_formal_question_reservations_v1()',
  'public.shared_world_material_historical_widening_gate_v1()',
  'public.validate_him_canonical_binding()',
];
const DRIFTED_SEQUENCE = 'public.conversation_turn_work_grants_id_seq';

// Every public function (not extension-owned) and what each role may execute.
const FUNCTION_ACL = `
  SELECT p.oid::regprocedure::text AS object, p.prorettype = 'trigger'::regtype AS trigger,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
         has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role,
         EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')`;
// Every public relation and sequence, with every privilege each role holds on it.
const RELATION_ACL = `
  SELECT 'public.' || c.relname AS object, c.relkind::text AS kind, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
         coalesce(c.reloptions::text, '') AS options,
         ARRAY(SELECT r.role || ':' || x.privilege
                 FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r(role),
                      unnest(CASE WHEN c.relkind = 'S' THEN ARRAY['USAGE', 'SELECT', 'UPDATE']
                                  ELSE ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] END) AS x(privilege)
                WHERE CASE WHEN c.relkind = 'S' THEN has_sequence_privilege(r.role, c.oid, x.privilege)
                           ELSE has_table_privilege(r.role, c.oid, x.privilege) END
                ORDER BY 1) AS privileges
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')`;
const POLICIES = `SELECT schemaname || '.' || tablename || '.' || policyname AS policy, permissive, roles::text, cmd, coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check FROM pg_policies ORDER BY 1`;

async function snapshot(on) {
  const functions = new Map((await rows(on, FUNCTION_ACL)).map((row) => [row.object, row]));
  const relations = new Map((await rows(on, RELATION_ACL)).map((row) => [row.object, row]));
  const policies = await rows(on, POLICIES);
  return { functions, relations, policies };
}

const ROLES = ['anon', 'authenticated', 'service_role'];

// ------------------------------------------------------------------------------------------------------------------
// 1. The CI database.
// ------------------------------------------------------------------------------------------------------------------
async function verifyCiDatabase() {
  stage = 'ci: the migration is the next slot, forward-only';
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(files.at(-1), MIGRATION, '0133 is the latest migration');
  assert.equal(files.at(-2), '0132_operational_readiness_failure_visibility_v1.sql');
  const migration = readFileSync(join(MIGRATIONS, MIGRATION), 'utf8').replace(/--.*$/gmu, '');
  assert.doesNotMatch(migration, /\bGRANT\s+(?!EXECUTE ON FUNCTION public\.(?:login_id_is_available_v1\(text\) TO service_role|read_account_first_use_v1\(\) TO authenticated|complete_first_use_welcome_v1\(\) TO authenticated);)/u,
    'the only GRANTs re-state the three explicit intended grants; nothing is broadened');
  assert.doesNotMatch(migration, /CREATE (?:OR REPLACE )?(?:FUNCTION|TABLE|VIEW|POLICY)|ALTER TABLE|DROP |DISABLE ROW LEVEL SECURITY|ALTER POLICY/iu,
    'privileges only: no object, policy or row-level-security change');

  stage = 'ci: the privilege matrix';
  const ci = await snapshot(main);
  const fn = (signature) => {
    const row = ci.functions.get(signature);
    assert.ok(row, `${signature} exists`);
    return row;
  };
  assert.deepEqual(pick(fn('public.login_id_is_available_v1(text)')), { anon: false, authenticated: false, service_role: true, public: false },
    'login_id_is_available_v1 is server-only');
  for (const signature of ['public.read_account_first_use_v1()', 'public.complete_first_use_welcome_v1()']) {
    assert.deepEqual(pick(fn(signature)), { anon: false, authenticated: true, service_role: false, public: false }, `${signature} is the owner's own RPC`);
  }
  for (const signature of ['public.handle_new_auth_user()', 'public.provision_qandeel_account_identity_v1()', ...PUBLIC_TRIGGER_FUNCTIONS]) {
    const row = fn(signature);
    assert.equal(row.trigger, true, `${signature} is a trigger function`);
    assert.equal(row.anon || row.authenticated || row.public, false, `${signature} is executable by no client role and not by PUBLIC`);
  }
  const triggersReachable = [...ci.functions.values()].filter((row) => row.trigger && (row.anon || row.authenticated || row.public));
  assert.deepEqual(triggersReachable.map((row) => row.object), [], 'no public trigger function is client- or PUBLIC-executable');
  const publicExecutable = [...ci.functions.values()].filter((row) => row.public).map((row) => row.object);
  assert.deepEqual(publicExecutable, [], 'no public function keeps PostgreSQL\'s PUBLIC EXECUTE');
  const anonExecutable = [...ci.functions.values()].filter((row) => row.anon).map((row) => row.object).sort();
  assert.deepEqual(anonExecutable, ['public.qandeel_keepalive()'], 'the ONLY anon-executable public function is the deliberate keep-alive');
  const sequence = ci.relations.get(DRIFTED_SEQUENCE);
  assert.ok(sequence, 'the 0131 sequence exists');
  assert.deepEqual(sequence.privileges, [], 'the 0131 sequence is reachable by no application role');
  const clientRelations = [...ci.relations.values()].filter((row) => row.kind === 'S' && row.privileges.some((p) => /^(anon|authenticated):/u.test(p)));
  assert.deepEqual(clientRelations.map((row) => row.object), [], 'no public sequence is reachable by a client role');

  stage = 'ci: the server channel and the owner RPCs still work, and the clients are refused';
  await main.query('BEGIN');
  try {
    await main.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb');
    await main.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text');
    const owner = randomUUID();
    const taken = `sec01.${owner.slice(0, 8)}`;
    await main.query('INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1, $2::jsonb)', [owner, JSON.stringify({ qandeel_name: 'Reader', qandeel_login_id: taken })]);

    await actAs(main, 'service_role');
    const answer = async (loginId) => (await rows(main, 'SELECT public.login_id_is_available_v1($1) AS available', [loginId]))[0].available;
    assert.equal(await answer(taken), false, 'the server channel answers a taken Login ID');
    assert.equal(await answer(`fresh.${owner.slice(0, 8)}`), true, 'the server channel answers a free Login ID');
    for (const role of ['anon', 'authenticated']) {
      await actAs(main, role, role === 'authenticated' ? owner : null);
      await rejected(main, () => main.query('SELECT public.login_id_is_available_v1($1)', [taken]), ['42501']);
    }

    await actAs(main, 'authenticated', owner);
    const [firstUse] = await rows(main, 'SELECT * FROM public.read_account_first_use_v1()');
    assert.ok(firstUse, 'the owner reads their own first-use facts');
    await main.query('SELECT public.complete_first_use_welcome_v1()');
    await actAs(main, 'anon');
    await rejected(main, () => main.query('SELECT * FROM public.read_account_first_use_v1()'), ['42501']);
    await rejected(main, () => main.query('SELECT public.complete_first_use_welcome_v1()'), ['42501']);
  } finally {
    await main.query('ROLLBACK');
  }
}

const pick = (row) => ({ anon: row.anon, authenticated: row.authenticated, service_role: row.service_role, public: row.public });

// ------------------------------------------------------------------------------------------------------------------
// 2 + 3. The scratch database carrying hosted Supabase's public default privileges.
// ------------------------------------------------------------------------------------------------------------------
const SUPABASE_PUBLIC_DEFAULTS = `
-- Hosted Supabase's posture for objects the migration role creates in public (supabase/postgres initial schema).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

function psql(file) {
  try {
    execFileSync('psql', [simUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`psql failed on ${file}: ${String(error.stderr ?? error.message).slice(0, 4000)}`);
  }
}

async function verifySupabaseDefaults(ci) {
  stage = 'scratch: create';
  await main.query(`DROP DATABASE IF EXISTS ${SIM}`);
  await main.query(`CREATE DATABASE ${SIM}`);
  const work = mkdtempSync(join(tmpdir(), 'prod-sec-01-'));
  const sim = new Client({ connectionString: simUrl });
  try {
    // The ONE canonical bootstrap, minus the cluster-wide roles the CI database already created.
    const bootstrap = readFileSync(join(root, 'database/supabase-compatible-bootstrap.sql'), 'utf8').replace(/^CREATE ROLE [^;]*;$/gmu, '');
    writeFileSync(join(work, 'bootstrap.sql'), bootstrap + SUPABASE_PUBLIC_DEFAULTS);
    psql(join(work, 'bootstrap.sql'));

    stage = 'scratch: every historical migration applies unchanged under Supabase defaults';
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
    for (const file of files.filter((name) => name < '0133')) psql(join(MIGRATIONS, file));
    await sim.connect();
    await sim.query("SET search_path = ''"); // every regprocedure renders schema-qualified
    const before = await snapshot(sim);

    stage = 'scratch: the census reproduces the drift exactly';
    const drift = {};
    for (const [object, row] of before.functions) {
      const intended = ci.functions.get(object);
      assert.ok(intended, `${object} exists in both databases`);
      const roles = ['anon', 'authenticated'].filter((role) => row[role] && !intended[role]);
      if (roles.length > 0) drift[object] = roles;
    }
    // Measured against the CI ACL AFTER 0133, the PUBLIC trigger functions are client-reachable before 0133 too.
    const expectedDrift = { ...DRIFTED_FUNCTIONS, ...Object.fromEntries(PUBLIC_TRIGGER_FUNCTIONS.map((signature) => [signature, ['anon', 'authenticated']])) };
    assert.deepEqual(drift, expectedDrift, 'exactly the five drifted functions and the fourteen PUBLIC trigger functions, for exactly these roles');
    const publicTriggers = [...before.functions.values()].filter((row) => row.public).map((row) => row.object).sort();
    assert.deepEqual(publicTriggers, [...PUBLIC_TRIGGER_FUNCTIONS].sort(), 'exactly the fourteen PUBLIC trigger functions');
    const relationDrift = [...before.relations.values()]
      .filter((row) => row.privileges.some((p) => /^(anon|authenticated):/u.test(p) && !ci.relations.get(row.object).privileges.includes(p)))
      .map((row) => row.object);
    assert.deepEqual(relationDrift, [DRIFTED_SEQUENCE], 'exactly one relation drifted: the 0131 sequence');

    stage = 'scratch: the drift is real - anon calls the Login ID oracle before 0133';
    await sim.query('BEGIN');
    try {
      await actAs(sim, 'anon');
      const [{ available }] = await rows(sim, "SELECT public.login_id_is_available_v1('nobody.home') AS available");
      assert.equal(available, true, 'before 0133, anon answers the Login ID oracle directly on a hosted-shaped project');
    } finally {
      await sim.query('ROLLBACK');
    }

    stage = 'scratch: apply 0133';
    psql(join(MIGRATIONS, MIGRATION));
    const after = await snapshot(sim);

    stage = 'scratch: hosted == CI, object by object';
    assert.deepEqual([...after.functions.keys()].sort(), [...ci.functions.keys()].sort(), 'the same functions');
    for (const [object, row] of after.functions) {
      const intended = ci.functions.get(object);
      for (const role of ['anon', 'authenticated']) assert.equal(row[role], intended[role], `${role} EXECUTE ${object} matches the explicit migrations`);
      assert.equal(row.public, false, `${object} keeps no PUBLIC EXECUTE`);
    }
    for (const [object, row] of after.relations) {
      const intended = ci.relations.get(object);
      assert.ok(intended, `${object} exists in both databases`);
      assert.deepEqual(row.privileges.filter((p) => !p.startsWith('service_role:')), intended.privileges.filter((p) => !p.startsWith('service_role:')),
        `${object}: client privileges match the explicit migrations`);
    }

    stage = 'scratch: nothing gained a privilege, and row-level security is unchanged';
    for (const [object, row] of after.functions) {
      const prior = before.functions.get(object);
      for (const role of [...ROLES, 'public']) if (row[role]) assert.equal(prior[role], true, `${object}: ${role} gained EXECUTE`);
    }
    for (const [object, row] of after.relations) {
      const prior = before.relations.get(object);
      for (const privilege of row.privileges) assert.ok(prior.privileges.includes(privilege), `${object}: ${privilege} was broadened`);
      assert.equal(row.rls, prior.rls, `${object}: row-level security unchanged`);
      assert.equal(row.force_rls, prior.force_rls, `${object}: forced row-level security unchanged`);
      assert.equal(row.options, prior.options, `${object}: options (security_invoker) unchanged`);
    }
    assert.deepEqual(after.policies, before.policies, 'every policy is unchanged');
    // Only the census objects lost anything: no broad revoke.
    const narrowed = [];
    for (const [object, row] of after.functions) {
      const prior = before.functions.get(object);
      if (ROLES.some((role) => prior[role] && !row[role]) || (prior.public && !row.public)) narrowed.push(object);
    }
    assert.deepEqual(narrowed.sort(), [...Object.keys(DRIFTED_FUNCTIONS), ...PUBLIC_TRIGGER_FUNCTIONS].sort(), 'only the census functions were narrowed');

    stage = 'scratch: the oracle refuses clients and still answers the server channel';
    await sim.query('BEGIN');
    try {
      for (const role of ['anon', 'authenticated']) {
        await actAs(sim, role, role === 'authenticated' ? randomUUID() : null);
        await rejected(sim, () => sim.query("SELECT public.login_id_is_available_v1('nobody.home')"), ['42501']);
      }
      await actAs(sim, 'service_role');
      const [{ available }] = await rows(sim, "SELECT public.login_id_is_available_v1('nobody.home') AS available");
      assert.equal(available, true);
    } finally {
      await sim.query('ROLLBACK');
    }

    stage = 'scratch: prevention - a NEW public object is granted to no client role';
    await sim.query('BEGIN');
    try {
      await sim.query('RESET ROLE');
      await sim.query('CREATE FUNCTION public.prod_sec_01_probe_v1() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$');
      await sim.query('CREATE TABLE public.prod_sec_01_probe (id bigserial PRIMARY KEY)');
      const [probe] = await rows(sim, `SELECT
          (SELECT a.grantee FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = 'public.prod_sec_01_probe_v1()'::regprocedure)) a
            WHERE a.grantee IN ('anon'::regrole, 'authenticated'::regrole) LIMIT 1) AS named_function_grantee,
          has_table_privilege('anon', 'public.prod_sec_01_probe', 'SELECT') OR has_table_privilege('authenticated', 'public.prod_sec_01_probe', 'SELECT') AS table_reachable,
          has_sequence_privilege('anon', 'public.prod_sec_01_probe_id_seq', 'USAGE') OR has_sequence_privilege('authenticated', 'public.prod_sec_01_probe_id_seq', 'USAGE') AS sequence_reachable`);
      assert.equal(probe.named_function_grantee, null, 'a new function names no client role in its ACL');
      assert.equal(probe.table_reachable, false, 'a new table is granted to no client role');
      assert.equal(probe.sequence_reachable, false, 'a new sequence is granted to no client role');
    } finally {
      await sim.query('ROLLBACK');
    }
  } finally {
    await sim.end().catch(() => undefined);
    rmSync(work, { recursive: true, force: true });
    await main.query(`DROP DATABASE IF EXISTS ${SIM}`);
  }
}

try {
  await main.connect();
  await main.query("SET search_path = ''"); // every regprocedure renders schema-qualified
  await verifyCiDatabase();
  stage = 'ci: snapshot for comparison';
  const ci = await snapshot(main);
  await verifySupabaseDefaults(ci);
  console.log('Migration 0133 verified: the Supabase default-privilege census is closed (5 functions, 14 trigger functions, 1 sequence), hosted == CI for every public object, nothing broadened, and new public objects reach no client role.');
} catch (error) {
  console.error(`Migration 0133 verification failed at stage: ${stage}`);
  throw error;
} finally {
  await main.end();
}
