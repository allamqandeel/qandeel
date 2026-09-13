// I-02A - Connected Worlds Shared World Core Persistence & Deny-by-Default RLS
// Foundation v1: secret-free structural contract over migration 0075.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only. Live
// semantics (rejections, ACL behaviour, rollback) are proven by the real
// PostgreSQL verifier this file also pins into the toolchain and CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0075_connected_worlds_shared_persistence_foundation_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0075.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const kernelSharedWorld = read('../../apps/api/src/connected-worlds/kernel/shared-world.types.ts');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSlice = (from, to) => {
  const start = migration.indexOf(from);
  assert.ok(start >= 0, `migration contains "${from}"`);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(end > start, `migration contains "${to}" after "${from}"`);
  return migration.slice(start, end).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
};
const kernelLiterals = (name) => {
  const match = kernelSharedWorld.match(new RegExp(`export const ${name} = \\[([^\\]]+)\\] as const;`, 'u'));
  assert.ok(match, `kernel exports ${name}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
const sqlLiterals = (constraint) => {
  const match = executableSql.match(new RegExp(`CONSTRAINT ${constraint}\\s+CHECK \\(\\w+ IN \\(([^)]+)\\)\\)`, 'u'));
  assert.ok(match, `migration defines ${constraint} as an IN-list check`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};

test('0075 exists, is the forward migration after 0074, and edits no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0075 exists');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0074_supabase_keepalive_permission_correction_v1.sql'), '0075 orders after 0074');
  assert.equal(migrations.filter((name) => name.startsWith('0075_')).length, 1, 'exactly one migration carries the 0075 number');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // Forward-only: nothing existing is dropped, altered, rewritten or renumbered.
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX)/iu);
  assert.doesNotMatch(executableSql, /UPDATE public\.\w+ SET|DELETE FROM public\.\w+|TRUNCATE|INSERT INTO/iu, 'the migration performs no data write');
  // The Personal foundation is intact in its own historical migrations: they
  // still carry the definitions this migration must never generalize.
  const migration0001 = read('../migrations/0001_core_conversation_schema.sql');
  const migration0002 = read('../migrations/0002_supabase_auth_identity_rls.sql');
  const migration0030 = read('../migrations/0030_conversation_session_authority_hardening_v1.sql');
  assert.match(migration0001, /CREATE TABLE conversation_sessions \(\s+id uuid PRIMARY KEY,\s+user_id uuid NOT NULL,/u);
  assert.doesNotMatch(migration0001, /world_id/u);
  assert.match(migration0002, /CREATE POLICY conversation_sessions_select_own/u);
  assert.match(migration0030, /CREATE FUNCTION public\.create_conversation_session_v1\(p_id uuid\)/u);
});

test('0075 introduces exactly the two Shared tables and no generic worlds table', () => {
  const tables = [...executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, ['shared_world_membership_episodes', 'shared_worlds']);
  assert.doesNotMatch(executableSql, /CREATE TABLE public\.worlds\b|public\.worlds\b/iu, 'no generic public.worlds table');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?(?:FUNCTION|PROCEDURE)|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE EXTENSION|EXCLUDE USING/iu,
    'no function, trigger, policy, view or extension is introduced');
  // Word-bounded so the frozen birth-basis literals (ACCEPTED_INVITATION, MUTUAL_MATCH) stay legal
  // while an invitations / proposals / grants / material / Public / Replay / Matching table cannot.
  assert.doesNotMatch(executableSql, /\b(?:invitations?|proposals?|history_access\w*|\w*_grants?|consents?|snapshots?|messages?|voice_notes?|materials?|provenance|replays?|public_experiences?|matching\w*|presence\w*|moderation\w*|entitlements?)\b/iu,
    'no invitation, Matching, grant, material, Public, Replay or moderation persistence sneaks in');
});

test('shared_worlds carries the frozen columns and no owner / admin / inviter privilege column', () => {
  const table = executableSlice('CREATE TABLE public.shared_worlds', 'CREATE TABLE public.shared_world_membership_episodes');
  const columns = [...table.matchAll(/^\s{4}(\w+) (uuid|text|timestamptz)\b([^,\n]*)/gmu)].map((m) => [m[1], m[2], m[3].trim()]);
  assert.deepEqual(columns, [
    ['id', 'uuid', 'PRIMARY KEY'],
    ['lifecycle', 'text', 'NOT NULL'],
    ['phase', 'text', 'NOT NULL'],
    ['birth_basis', 'text', 'NOT NULL'],
    ['born_at', 'timestamptz', 'NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['closed_at', 'timestamptz', ''],
  ]);
  assert.doesNotMatch(table, /owner|admin|inviter|creator|initiator|privilege|user_id/iu, 'World identity is not participant ownership');
  // The terminal self-assertion also refuses such a column at deploy time.
  assert.match(executableSql, /column_name ~\* '\(owner\|admin\|inviter\|creator\|initiator\|privilege\)'/u);
});

test('lifecycle, phase and birth-basis literals are in exact parity with the merged I-01A kernel', () => {
  assert.deepEqual(sqlLiterals('shared_worlds_lifecycle_check'), kernelLiterals('SHARED_WORLD_LIFECYCLES'));
  assert.deepEqual(sqlLiterals('shared_worlds_phase_check'), kernelLiterals('SHARED_WORLD_PHASES'));
  assert.deepEqual(sqlLiterals('shared_worlds_birth_basis_check'), kernelLiterals('SHARED_WORLD_BIRTH_BASES'));
  assert.deepEqual(sqlLiterals('shared_worlds_lifecycle_check'), ['ACTIVE', 'READ_ONLY_CLOSED']);
  assert.deepEqual(sqlLiterals('shared_worlds_phase_check'), ['STANDARD', 'INTRODUCTION']);
  assert.deepEqual(sqlLiterals('shared_worlds_birth_basis_check'), ['ACCEPTED_INVITATION', 'MUTUAL_MATCH']);
  // Prospective state is not a World: no invented lifecycle literal anywhere in executable SQL.
  assert.doesNotMatch(executableSql, /'(?:DRAFT|PENDING|DORMANT|ARCHIVED|DELETED)'/u);
});

test('direct-invitation birth cannot coexist with INTRODUCTION and closure is lifecycle-consistent', () => {
  const direct = executableSql.match(/CONSTRAINT shared_worlds_direct_birth_phase_check\s+CHECK \(([^;]+?)\)\n\);/u);
  assert.ok(direct, 'direct-birth phase check exists');
  assert.equal(direct[1].replace(/\s+/gu, ' '), "birth_basis <> 'ACCEPTED_INVITATION' OR phase = 'STANDARD'");
  const closure = executableSql.match(/CONSTRAINT shared_worlds_closure_consistency_check\s+CHECK \(([\s\S]+?)\),\n/u);
  assert.ok(closure, 'closure consistency check exists');
  assert.equal(closure[1].replace(/\s+/gu, ' '),
    "(lifecycle = 'ACTIVE' AND closed_at IS NULL) OR (lifecycle = 'READ_ONLY_CLOSED' AND closed_at IS NOT NULL)");
  assert.match(executableSql, /CONSTRAINT shared_worlds_closed_after_birth_check\s+CHECK \(closed_at IS NULL OR closed_at >= born_at\)/u);
});

test('membership episodes are historical, restrictive on deletion, interval-checked and single-open per (world, user)', () => {
  const table = executableSlice('CREATE TABLE public.shared_world_membership_episodes', 'CREATE UNIQUE INDEX');
  const columns = [...table.matchAll(/^\s{4}(\w+) (uuid|timestamptz)\b([^,\n]*)/gmu)].map((m) => [m[1], m[2], m[3].trim()]);
  assert.deepEqual(columns, [
    ['id', 'uuid', 'PRIMARY KEY'],
    ['world_id', 'uuid', 'NOT NULL'],
    ['user_id', 'uuid', 'NOT NULL'],
    ['joined_at', 'timestamptz', 'NOT NULL'],
    ['ended_at', 'timestamptz', ''],
  ]);
  assert.match(table, /FOREIGN KEY \(world_id\) REFERENCES public\.shared_worlds \(id\) ON DELETE RESTRICT/u);
  assert.match(table, /FOREIGN KEY \(user_id\) REFERENCES public\.users \(id\) ON DELETE RESTRICT/u);
  assert.doesNotMatch(executableSql, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/iu, 'World / history deletion never cascades');
  assert.match(table, /CONSTRAINT shared_world_membership_episodes_interval_check\s+CHECK \(ended_at IS NULL OR ended_at >= joined_at\)/u);
  assert.match(executableSql,
    /CREATE UNIQUE INDEX shared_world_membership_episodes_one_open_idx\s+ON public\.shared_world_membership_episodes \(world_id, user_id\)\s+WHERE ended_at IS NULL;/u);
  // No end_reason / mutable single-row membership shape and no default that would let a persistence field fabricate time.
  assert.doesNotMatch(table, /joined_at timestamptz NOT NULL DEFAULT|ended_at timestamptz DEFAULT/u);
  const indexes = [...executableSql.matchAll(/CREATE (?:UNIQUE )?INDEX (\w+)\s+ON public\.(\w+) \(([^)]+)\)/gu)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(indexes, [
    ['shared_world_membership_episodes_one_open_idx', 'shared_world_membership_episodes', 'world_id, user_id'],
    ['shared_world_membership_episodes_world_joined_idx', 'shared_world_membership_episodes', 'world_id, joined_at'],
    ['shared_world_membership_episodes_user_joined_idx', 'shared_world_membership_episodes', 'user_id, joined_at'],
  ], 'exactly the frozen access-pattern indexes, nothing speculative');
});

test('both tables are RLS-enabled with zero policies and every application role is revoked', () => {
  for (const table of ['shared_worlds', 'shared_world_membership_episodes']) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.shared_worlds, public\.shared_world_membership_episodes\s+FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /IF EXISTS\(SELECT 1 FROM pg_roles WHERE rolname='service_role'\) THEN\s+EXECUTE 'REVOKE ALL ON TABLE public\.shared_worlds, public\.shared_world_membership_episodes FROM service_role';/u);
  assert.doesNotMatch(executableSql, /\bGRANT\b/iu, 'no GRANT of any kind: PUBLIC, anon, authenticated and service_role receive nothing');
  assert.doesNotMatch(executableSql, /CREATE POLICY|DISABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY/iu);
  // The terminal self-assertion refuses a reachable or policy-bearing deploy.
  assert.match(executableSql, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
  assert.match(executableSql, /FOREACH target_privilege IN ARRAY ARRAY\['SELECT','INSERT','UPDATE','DELETE'\]/u);
  assert.match(executableSql, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION/u);
  assert.match(executableSql, /IF EXISTS \(SELECT 1 FROM pg_policy p WHERE p\.polrelid = target_table::regclass\) THEN\s+RAISE EXCEPTION/u);
  assert.match(executableSql, /privilege\.grantee = 0\s*\) THEN\s+RAISE EXCEPTION 'I-02A: PUBLIC must hold no privilege/u);
});

test('0075 creates no RPC or function that writes the Shared tables and alters no Personal table', () => {
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?FUNCTION|LANGUAGE plpgsql SECURITY DEFINER|RETURNS SETOF/iu, 'no birth, lifecycle or membership command exists yet');
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.(?:users|conversation_sessions|conversation_turns)\b/iu);
  assert.doesNotMatch(executableSql, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:users|conversation_sessions|conversation_turns)\b/iu);
  assert.doesNotMatch(executableSql, /runtime_event_outbox|conversation_units|memories|hypothes/iu, 'no other substrate is touched');
  // The only reference to the Personal foundation is the user foreign key.
  const personalReferences = [...executableSql.matchAll(/public\.users\b/gu)].length;
  assert.equal(personalReferences, 1, 'public.users is referenced exactly once, by the membership foreign key');
});

test('the 0075 verifier proves live catalog, ACL, policy and constraint behaviour with rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'has_table_privilege($1,$2,$3)',
    "SET LOCAL ROLE ${role}",
    'relrowsecurity',
    'pg_policy WHERE polrelid',
    'aclexplode(c.relacl)',
    'confdeltype',
    "'(ended_at IS NULL)'",
    'ON DELETE RESTRICT',
    "['23514']",
    "['23505']",
    "['23503']",
    "['42501']",
    "'ACTIVE','INTRODUCTION','ACCEPTED_INVITATION'",
    "'READ_ONLY_CLOSED','STANDARD','ACCEPTED_INVITATION')",
    'leave + rejoin are two episodes',
    'DELETE FROM public.users WHERE id=$1',
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u, 'the verifier never weakens RLS or an ACL to make a proof easy');
});

test('the verifier is wired into the toolchain, API CI after fresh migrations, and the database README', () => {
  assert.match(packageJson, /"verify:connected-worlds-shared-persistence:integration": "node --env-file-if-exists=\.env database\/verify-migration-0075\.mjs"/u);
  assert.equal((workflow.match(/verify:connected-worlds-shared-persistence:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:connected-worlds-shared-persistence:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  assert.ok(step > workflow.indexOf('run: npm run verify:historical-projection:integration'), 'the verifier runs after the 0072 verifier');
  assert.match(workflow, /Verify Connected Worlds Shared persistence foundation against real PostgreSQL/u);
  assert.match(readme, /## Connected Worlds Shared persistence foundation \(migration 0075, I-02A\)/u);
  assert.match(readme, /npm run verify:connected-worlds-shared-persistence:integration/u);
  assert.match(readme, /zero\*\* policies/u);
});
