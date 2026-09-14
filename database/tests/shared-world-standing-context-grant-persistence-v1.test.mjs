// I-02B - Shared Standing Context Grant Persistence Foundation v1: secret-free
// structural contract over migration 0076.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against executable SQL only, and the
// disclosure / scope vocabulary assertions run against the DDL alone (the
// terminal self-assertion block names those words precisely in order to refuse
// them at deploy time). Live semantics (rejections, ACL behaviour, rollback)
// are proven by the real PostgreSQL verifier this file also pins into the
// toolchain and CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0076_shared_world_standing_context_grant_persistence_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const migration0075 = read('../migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql');
const verifier = read('../verify-migration-0076.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const kernelAuthority = read('../../apps/api/src/connected-worlds/kernel/authority.types.ts');
const kernelInvariants = read('../../apps/api/src/connected-worlds/kernel/world-invariants.ts');

const GRANTS = 'shared_world_standing_context_grants';
const AUDIENCE = 'shared_world_standing_context_grant_audience';

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const executableSql = stripComments(migration);
const executableSlice = (from, to) => {
  const start = migration.indexOf(from);
  assert.ok(start >= 0, `migration contains "${from}"`);
  const end = to === undefined ? migration.length : migration.indexOf(to, start);
  assert.ok(end > start, `migration contains "${to}" after "${from}"`);
  return stripComments(migration.slice(start, end));
};
// The DDL: everything before the terminal self-assertion block.
const ddl = executableSlice('BEGIN;', 'DO $$\nDECLARE');
const selfAssertion = executableSlice('DO $$\nDECLARE', 'COMMIT;');
const columnsOf = (table) => [...table.matchAll(/^\s{4}(\w+) (uuid|text|timestamptz)\b([^,\n]*)/gmu)].map((m) => [m[1], m[2], m[3].trim()]);
// Identifier-aware token search: `_` is a separator, so `material_transfer`
// matches while `shared_world` never matches `share`.
const token = (words) => new RegExp(`(?<![A-Za-z0-9])(?:${words})(?![A-Za-z0-9])`, 'iu');

test('0076 exists, is the forward migration after 0075, and edits no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0076 exists');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0075_connected_worlds_shared_persistence_foundation_v1.sql'), '0076 orders after 0075');
  assert.equal(migrations.filter((name) => name.startsWith('0076_')).length, 1, 'exactly one migration carries the 0076 number');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // Forward-only: nothing existing is dropped, altered, rewritten or renumbered.
  assert.doesNotMatch(executableSql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX)/iu);
  assert.doesNotMatch(executableSql, /UPDATE public\.\w+ SET|DELETE FROM public\.\w+|TRUNCATE|INSERT INTO/iu, 'the migration performs no data write');
  // The I-02A substrate this slice builds on is intact in its own migration.
  assert.match(migration0075, /CREATE TABLE public\.shared_worlds \(\s+id uuid PRIMARY KEY,/u);
  assert.match(migration0075, /CREATE TABLE public\.shared_world_membership_episodes \(/u);
  assert.doesNotMatch(migration0075, /standing_context/u, '0075 is not edited to know about grants');
});

test('0076 introduces exactly the grant and audience-ceiling tables and no generic admission, grant, permission or consent-event table', () => {
  const tables = [...executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, [AUDIENCE, GRANTS]);
  assert.doesNotMatch(executableSql, /public\.(?:context_admissions?|grants|permissions?|permission_grants|authority_grants|consent_events?|consent_event_log|matching\w*|public_\w*context\w*|worlds)\b/iu,
    'no generic Context Admission, grant, permission, Matching, Public or consent-event table');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?(?:FUNCTION|PROCEDURE)|CREATE TRIGGER|CREATE POLICY|CREATE VIEW|CREATE EXTENSION|CREATE TYPE|EXCLUDE USING/iu,
    'no function, trigger, policy, view, extension or enum type is introduced');
});

test('the grant row is exact-world, human-grantor, ACTIVE|REVOKED, and carries no generic scope / purpose / action / source / permissions column', () => {
  const table = executableSlice(`CREATE TABLE public.${GRANTS}`, 'CREATE UNIQUE INDEX');
  assert.deepEqual(columnsOf(table), [
    ['id', 'uuid', 'PRIMARY KEY'],
    ['world_id', 'uuid', 'NOT NULL'],
    ['grantor_user_id', 'uuid', 'NOT NULL'],
    ['status', 'text', 'NOT NULL'],
    ['granted_at', 'timestamptz', 'NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['revoked_at', 'timestamptz', ''],
  ]);
  // Target is a NON-NULL foreign key to shared_worlds: no nullable or polymorphic
  // target, so a grant can never point at Matching, the Public World or nothing.
  assert.match(table, /world_id uuid NOT NULL,/u);
  assert.match(table, /FOREIGN KEY \(world_id\) REFERENCES public\.shared_worlds \(id\) ON DELETE RESTRICT/u);
  assert.match(table, /grantor_user_id uuid NOT NULL,/u);
  assert.match(table, /FOREIGN KEY \(grantor_user_id\) REFERENCES public\.users \(id\) ON DELETE RESTRICT/u);
  assert.doesNotMatch(ddl, /target_type|target_kind|world_type|scope|purpose|action|source|permissions?|jsonb?\b|\btext\[\]|uuid\[\]/iu,
    'grant semantics are fixed by table identity: no generic or widenable column exists');
  assert.doesNotMatch(table, /owner|admin|inviter|creator|initiator|privilege|system|qandeel/iu, 'no superior authority column and no system-actor column');
  // Vocabulary is exactly ACTIVE / REVOKED.
  const status = executableSql.match(new RegExp(`CONSTRAINT ${GRANTS}_status_check\\s+CHECK \\(status IN \\(([^)]+)\\)\\)`, 'u'));
  assert.ok(status, 'status check exists as an IN-list');
  assert.deepEqual([...status[1].matchAll(/'([A-Za-z_]+)'/gu)].map((m) => m[1]), ['ACTIVE', 'REVOKED']);
  assert.doesNotMatch(executableSql, /'(?:PENDING|DECLINED|EXPIRED|PAUSED|SUPERSEDED|PUBLIC|MATCHING|GRANTED|REQUESTED)'/u, 'no request / decline / TTL / Matching / Public status literal');
  // No TTL column: grant TTL is not frozen.
  assert.doesNotMatch(ddl, /valid_until|expires_at|ttl/iu);
});

test('status / revoked_at consistency and revoked_at >= granted_at are constrained exactly', () => {
  const consistency = executableSql.match(new RegExp(`CONSTRAINT ${GRANTS}_revocation_consistency_check\\s+CHECK \\(([\\s\\S]+?)\\),\\n`, 'u'));
  assert.ok(consistency, 'revocation consistency check exists');
  assert.equal(consistency[1].replace(/\s+/gu, ' '),
    "(status = 'ACTIVE' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL)");
  const ordering = executableSql.match(new RegExp(`CONSTRAINT ${GRANTS}_revoked_after_granted_check\\s+CHECK \\(([^;]+?)\\)\\n\\);`, 'u'));
  assert.ok(ordering, 'revoked-after-granted check exists');
  assert.equal(ordering[1].replace(/\s+/gu, ' '), 'revoked_at IS NULL OR revoked_at >= granted_at');
  // No default on revoked_at: a persistence field never fabricates a revocation time.
  assert.doesNotMatch(executableSql, /revoked_at timestamptz (?:NOT NULL )?DEFAULT/u);
});

test('exactly one current ACTIVE grant per (world, grantor) and exactly the frozen index set', () => {
  assert.match(executableSql,
    new RegExp(`CREATE UNIQUE INDEX ${GRANTS}_one_active_idx\\s+ON public\\.${GRANTS} \\(world_id, grantor_user_id\\)\\s+WHERE status = 'ACTIVE';`, 'u'));
  const indexes = [...executableSql.matchAll(/CREATE (UNIQUE )?INDEX (\w+)\s+ON public\.(\w+) \(([^)]+)\)/gu)].map((m) => [Boolean(m[1]), m[2], m[3], m[4]]);
  assert.deepEqual(indexes, [
    [true, `${GRANTS}_one_active_idx`, GRANTS, 'world_id, grantor_user_id'],
    [false, `${GRANTS}_world_grantor_idx`, GRANTS, 'world_id, grantor_user_id'],
    [false, `${AUDIENCE}_user_idx`, AUDIENCE, 'audience_user_id'],
  ], 'the one-ACTIVE partial unique index, the (world, grantor) history index and the audience reverse lookup; nothing speculative');
});

test('the audience ceiling is per-grant, human-only, unique per (grant, human) and never derived from membership', () => {
  const table = executableSlice(`CREATE TABLE public.${AUDIENCE}`, `CREATE INDEX ${AUDIENCE}_user_idx`);
  assert.deepEqual(columnsOf(table), [
    ['grant_id', 'uuid', 'NOT NULL'],
    ['audience_user_id', 'uuid', 'NOT NULL'],
  ]);
  assert.match(table, /PRIMARY KEY \(grant_id, audience_user_id\)/u, 'the composite primary key is the audience duplicate uniqueness and the grant_id lookup');
  assert.match(table, new RegExp(`FOREIGN KEY \\(grant_id\\) REFERENCES public\\.${GRANTS} \\(id\\) ON DELETE RESTRICT`, 'u'));
  assert.match(table, /FOREIGN KEY \(audience_user_id\) REFERENCES public\.users \(id\) ON DELETE RESTRICT/u);
  // Membership is never read: the executable SQL references the episode table
  // nowhere, so "current members = authorized audience" cannot be encoded here
  // and no membership expansion has a database path into the ceiling.
  assert.doesNotMatch(executableSql, /shared_world_membership_episodes|joined_at|ended_at|member/iu, 'the ceiling is explicit rows, never current membership');
  assert.doesNotMatch(executableSql, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/iu, 'grant truth never cascades away');
  const restrictiveForeignKeys = [...executableSql.matchAll(/FOREIGN KEY \((\w+)\) REFERENCES public\.(\w+) \(id\) ON DELETE RESTRICT/gu)].map((m) => [m[1], m[2]]);
  assert.deepEqual(restrictiveForeignKeys, [['world_id', 'shared_worlds'], ['grantor_user_id', 'users'], ['grant_id', GRANTS], ['audience_user_id', 'users']],
    'all three human / World references plus the ceiling-to-grant reference are restrictive on delete');
});

test('no material-disclosure, Matching or Public private-admission vocabulary exists in the DDL', () => {
  assert.doesNotMatch(ddl, token('disclos\\w*|quote|copy|publish\\w*|share|export|provenance|material\\w*|transfer|attribution'),
    'REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT: the row can imply no material permission');
  assert.doesNotMatch(ddl, token('matching\\w*|public_world|public_experience\\w*|introduction\\w*|replay\\w*|history_access\\w*|one_time\\w*'),
    'no Matching, Public, Replay or history-grant scope is persisted here');
  // The terminal self-assertion refuses such a column at deploy time, and refuses a JSON column.
  assert.match(selfAssertion, /c\.column_name ~\* '\(scope\|purpose\|action\|source\|permission\|disclos\|quote\|copy\|publish\|share\|export\|provenance\|transfer\|owner\|admin\|ttl\|expir\)'/u);
  assert.match(selfAssertion, /c\.data_type IN \('json','jsonb','ARRAY'\)/u);
  assert.match(selfAssertion, new RegExp(`c\\.table_name IN \\('${GRANTS}','${AUDIENCE}'\\)`, 'u'));
});

test('both tables are RLS-enabled with zero policies, every application role is revoked, and the self-assertion refuses drift', () => {
  for (const table of [GRANTS, AUDIENCE]) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
  }
  assert.match(executableSql, new RegExp(`REVOKE ALL ON TABLE public\\.${GRANTS}, public\\.${AUDIENCE}\\s+FROM PUBLIC, anon, authenticated;`, 'u'));
  assert.match(executableSql, new RegExp(`IF EXISTS\\(SELECT 1 FROM pg_roles WHERE rolname='service_role'\\) THEN\\s+EXECUTE 'REVOKE ALL ON TABLE public\\.${GRANTS}, public\\.${AUDIENCE} FROM service_role';`, 'u'));
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'no GRANT of any kind: PUBLIC, anon, authenticated and service_role receive nothing');
  assert.doesNotMatch(executableSql, /CREATE POLICY|DISABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY|SECURITY DEFINER/iu);
  assert.match(selfAssertion, new RegExp(`FOREACH target_table IN ARRAY ARRAY\\['public\\.${GRANTS}','public\\.${AUDIENCE}'\\]`, 'u'));
  assert.match(selfAssertion, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
  assert.match(selfAssertion, /FOREACH target_privilege IN ARRAY ARRAY\['SELECT','INSERT','UPDATE','DELETE'\]/u);
  assert.match(selfAssertion, /IF has_table_privilege\(target_role, target_table, target_privilege\) THEN\s+RAISE EXCEPTION/u);
  assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_policy p WHERE p\.polrelid = target_table::regclass\) THEN\s+RAISE EXCEPTION/u);
  assert.match(selfAssertion, /IF EXISTS \(SELECT 1 FROM pg_trigger t WHERE t\.tgrelid = target_table::regclass AND NOT t\.tgisinternal\) THEN\s+RAISE EXCEPTION/u);
  assert.match(selfAssertion, /privilege\.grantee = 0\s*\) THEN\s+RAISE EXCEPTION 'I-02B: PUBLIC must hold no privilege/u);
  assert.match(selfAssertion, /IF NOT rls_enabled THEN\s+RAISE EXCEPTION/u);
});

test('0076 creates no grant / revoke RPC, function or trigger and alters no Shared, membership, Personal or kernel substrate', () => {
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?FUNCTION|LANGUAGE plpgsql SECURITY DEFINER|RETURNS SETOF|RETURNS TABLE/iu, 'no grant, revoke or effective-authority command exists yet');
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.(?:users|conversation_sessions|conversation_turns|shared_worlds|shared_world_membership_episodes)\b/iu);
  assert.doesNotMatch(executableSql, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:users|conversation_sessions|conversation_turns|shared_worlds|shared_world_membership_episodes)\b/iu);
  assert.doesNotMatch(executableSql, /runtime_event_outbox|conversation_units|memories|hypothes|him_/iu, 'no other substrate is touched');
  // The Personal foundation and the I-02A World are referenced only as foreign-key parents.
  assert.equal([...executableSql.matchAll(/public\.users\b/gu)].length, 2, 'public.users is referenced exactly twice: grantor FK and audience FK');
  assert.equal([...executableSql.matchAll(/public\.shared_worlds\b/gu)].length, 1, 'public.shared_worlds is referenced exactly once: the grant target FK');
  assert.equal([...executableSql.matchAll(/public\.shared_world_membership_episodes\b/gu)].length, 0, 'membership episodes are never referenced');
  // The consent-event log is a documented deferral, not an invented half-generic schema.
  assert.match(migration, /CONSENT_EVENT_LOG/u, 'the migration documents the CW2-02 section 10 event-log deferral');
  assert.doesNotMatch(executableSql, /consent|event/iu);
});

test('database vocabulary is compatible with the merged kernel: Shared exact-world admission is reasoning-only and never Public', () => {
  // The kernel's Shared admission is exact-World + SHARED_REASONING and answers
  // MATERIAL_DISCLOSURE with false; there is no Public scope. The table encodes
  // exactly that shape: one non-null shared_worlds target, no purpose column
  // (SHARED_REASONING is fixed by table identity), no disclosure vocabulary.
  const scopes = kernelAuthority.match(/export const CONTEXT_ADMISSION_SCOPES = \[([^\]]+)\] as const;/u);
  assert.ok(scopes, 'kernel exports CONTEXT_ADMISSION_SCOPES');
  assert.deepEqual([...scopes[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), ['SHARED_EXACT_WORLD', 'MATCHING']);
  assert.match(kernelAuthority, /readonly scope: 'SHARED_EXACT_WORLD';\s+readonly owner: ConsentPrincipal;\s+readonly targetWorldId: SharedWorldId;\s+readonly purpose: 'SHARED_REASONING';/u);
  assert.match(kernelInvariants, /case 'MATERIAL_DISCLOSURE':\s+return false;/u);
  assert.match(migration, /purpose = SHARED_REASONING/u, 'the migration names the kernel purpose literal it is fixed to');
  assert.doesNotMatch(executableSql, /'SHARED_REASONING'|'MATCHING_CAPABILITY'|'SHARED_EXACT_WORLD'/u, 'the purpose is table identity, not a widenable data value');
  assert.doesNotMatch(ddl, token('public_world|public_experience\\w*|world_type|target_type'), 'no Public World target and no polymorphic target exists');
});

test('the 0076 verifier proves live catalog, ACL, policy and constraint behaviour with rolled-back fixtures', () => {
  for (const proof of [
    'process.env.DATABASE_URL',
    'has_table_privilege($1,$2,$3)',
    "SET LOCAL ROLE ${role}",
    'relrowsecurity',
    'pg_policy WHERE polrelid',
    'aclexplode(c.relacl)',
    'confdeltype',
    "(status = 'ACTIVE'::text)",
    'ON DELETE RESTRICT',
    "['23514']",
    "['23505']",
    "['23503']",
    "['23502']",
    "['42501']",
    "SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP`), INSUFFICIENT_PRIVILEGE",
    "VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP)",
    "'REVOKED','2026-02-01T00:00:00Z','2026-01-01T00:00:00Z'",
    "['PENDING', 'DECLINED', 'EXPIRED', 'PAUSED', 'SUPERSEDED', 'PUBLIC', 'MATCHING'",
    'revocation keeps the historical row and the reconfirmation is a new row',
    "SET status='ACTIVE', revoked_at=NULL WHERE id=$1`, [first]), UNIQUE_VIOLATION",
    'each grant carries exactly its own explicitly authorized ceiling',
    "DELETE FROM ${WORLDS} WHERE id=$1`, [world]), FK_VIOLATION",
    "DELETE FROM public.users WHERE id=$1', [grantor]), FK_VIOLATION",
    "DELETE FROM public.users WHERE id=$1', [third]), FK_VIOLATION",
    "DELETE FROM ${GRANTS} WHERE id=$1`, [grants.first]), FK_VIOLATION",
    'no fixture row remains after completion',
    "await q('ROLLBACK')",
  ]) {
    assert.ok(verifier.includes(proof), `verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  assert.doesNotMatch(verifier, /\bGRANT\b|CREATE POLICY|DISABLE ROW LEVEL SECURITY/u, 'the verifier never weakens RLS or an ACL to make a proof easy');
});

test('the verifier is wired into the toolchain, API CI after fresh migrations, and the database README', () => {
  assert.match(packageJson, /"verify:shared-world-standing-context-grants:integration": "node --env-file-if-exists=\.env database\/verify-migration-0076\.mjs"/u);
  assert.equal((workflow.match(/verify:shared-world-standing-context-grants:integration/gu) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf('run: npm run verify:shared-world-standing-context-grants:integration');
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  assert.ok(step > workflow.indexOf('run: npm run verify:connected-worlds-shared-persistence:integration'), 'the verifier runs after the 0075 verifier');
  assert.match(workflow, /Verify Shared Standing Context Grant persistence foundation against real PostgreSQL/u);
  assert.match(readme, /## Shared Standing Context Grant persistence foundation \(migration 0076, I-02B\)/u);
  assert.match(readme, /npm run verify:shared-world-standing-context-grants:integration/u);
  assert.match(readme, /CONSENT_EVENT_LOG/u, 'the README documents the deferred consent-event log');
});
