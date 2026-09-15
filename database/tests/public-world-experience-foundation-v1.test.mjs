// I-05A - Public World / Identity / Experience Foundation v1: the secret-free
// structural contract for migration 0091.
//
// Live semantics - ACLs, real denials, the singleton, real immutability and
// forward safety - are proven by database/verify-migration-0091.mjs against real
// PostgreSQL, which this file pins into the toolchain and CI. What is proven HERE
// is the structure a migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-05A PART A: that THIS slice created the ONE
// logical Public World, the audience-policy gate beside it, the stable Public
// Identity and its mutable display state, the stable Public Experience, its
// control authority, its immutable versions and its append-only lifecycle truth -
// and nothing beyond them. No writer, no package, no public serving, no semantic
// placement, no discussion, no Replay, no Safety or Launch decision - and that it
// modified no predecessor migration at all.
//
// It deliberately does NOT prove that a later reviewed semantic placement table, a
// public discussion table, a Public QANDEEL producer, a search or vitality
// projection, an owner-deletion writer, a Replay source adapter, a CW2-08 launch
// wrapper or an additive column, index or audit trigger may never appear. Every
// assertion is scoped to migration 0091 itself, the verifier it added, the
// registration lines it added, and the frozen predecessors it was required not to
// modify - pinned by content hash, which proves immutability without banning
// additions. Migrations 0092 and 0093 are deliberately NOT content-pinned: they
// are this slice's own siblings, shipping in the same PR, and pinning a sibling
// would pin a hash that is still moving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0091_public_world_experience_identity_foundation_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0091.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.indexOf('DO $$\nDECLARE');
const deployableSql = executableSql.slice(0, SELF_ASSERT_START);
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const WORLD = 'public_world_state';
const POLICY = 'public_audience_policy_state';
const IDENTITIES = 'public_identities';
const DISPLAY = 'public_identity_display_state';
const EXPERIENCES = 'public_experiences';
const CONTROLLERS = 'public_experience_controllers';
const VERSIONS = 'public_experience_versions';
const LIFECYCLE = 'public_experience_lifecycle_events';
const OWN_TABLES = [WORLD, POLICY, IDENTITIES, DISPLAY, EXPERIENCES, CONTROLLERS, VERSIONS, LIFECYCLE];

const OWN_SCRIPT = 'verify:public-world-experience-foundation:integration';

/** The complete frozen CW2-04 section 3 lifecycle vocabulary. */
const LIFECYCLE_STATES = ['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD'];

/** The frozen predecessor migrations, pinned by content rather than by absence. */
const PINNED_PREDECESSORS = [
  ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
  ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
  ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
  ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
  ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
  ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ['0081_shared_direct_invitation_runtime_v1.sql', '19789819a2076830fbc0d328909e3f4e8a35be66'],
  ['0082_shared_direct_world_birth_transaction_v1.sql', 'c7c575b246f01ce05944c7270428bea89d151a68'],
  ['0083_shared_world_standard_voluntary_leave_v1.sql', '91e4e427a2cfb7071a68bd59e0a9d2e37559d950'],
  ['0084_shared_world_governance_approval_foundation_v1.sql', '7b77087dc229b3dfee10ce1b175ffc9b16008aca'],
  ['0085_shared_world_governed_membership_lifecycle_v1.sql', 'd9d05ca2ec7dd11deea7426c80afc06571ec263c'],
  ['0086_shared_world_governed_settings_v1.sql', '2e78d1b751b5158b3ccf04ebaf1e614d76593f77'],
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0088_shared_world_standard_closure_v1.sql', 'dff71de8fbfc2f834d2d267949359d2ebbd3effe'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
];

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0091 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
const columnLines = (name) => tableBlock(name).split('\n')
  .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line));
const columnNames = (name) => columnLines(name).map((line) => line.trim().split(/\s+/u)[0]);

// ---------------------------------------------------------------------------

test('0091 is the forward migration after 0090, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0091 exists');
  assert.equal(migrations.filter((n) => n.startsWith('0091_')).length, 1, 'exactly one migration carries the 0091 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0090_shared_world_material_commit_owner_deletion_v1.sql'),
    '0091 orders after 0090, whose Shared material truth I-05A consumes');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-05A reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0091 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0091 alters, writes to and reads no predecessor domain', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0091 did not create');
  // The ONE predecessor relation 0091 may name is `users`, and only as the human
  // identity a Public Identity belongs to.
  const referenced = [...new Set([...deployableSql.matchAll(/REFERENCES public\.(\w+)/gu)].map((m) => m[1]))];
  assert.deepEqual(referenced.filter((t) => !OWN_TABLES.includes(t)).sort(), ['users'],
    'the only predecessor relation PART A binds is public.users');
  for (const forbidden of ['shared_worlds', 'shared_world_membership_episodes', 'shared_world_materials',
    'shared_world_invite_credential_state', 'conversation_units', 'conversation_turns', 'conversation_sessions',
    'standing_context', 'matching_', 'introduction_', 'memories', 'hypothes']) {
    assert.ok(!executableSql.includes(forbidden),
      `PART A names no ${forbidden}: Public depends on no Shared membership and copies no Personal state`);
  }
  assert.doesNotMatch(deployableSql, /UPDATE public\.\w+\s+SET|DELETE FROM/iu, '0091 updates and deletes nothing');
});

test('0091 seeds exactly its own two singleton envelopes and no user data', () => {
  const inserts = deployableSql.match(/INSERT INTO public\.(\w+)/gu) ?? [];
  assert.deepEqual(inserts, [`INSERT INTO public.${WORLD}`, `INSERT INTO public.${POLICY}`],
    'the only rows PART A writes are the ONE Public World and the ONE audience-policy envelope');
  assert.match(deployableSql, /VALUES \(true, 'PUBLIC_WORLD', 1, CURRENT_TIMESTAMP\)/u,
    'the Public World is seeded as PUBLIC_WORLD at authority snapshot version 1');
  assert.match(deployableSql, /VALUES \(true, 'REGISTERED_ONLY', 'UNRESOLVED', 1, CURRENT_TIMESTAMP\)/u,
    'the current direction is registered members and the signed-out policy stays UNRESOLVED');
});

test('exactly one logical Public World is representable, and a Public Experience is not a World', () => {
  const world = tableBlock(WORLD);
  assert.match(world, /singleton boolean NOT NULL,/u);
  assert.match(world, /CONSTRAINT public_world_state_pk PRIMARY KEY \(singleton\)/u,
    'the singleton discriminator IS the primary key');
  assert.match(world, /CONSTRAINT public_world_state_singleton_check CHECK \(singleton\)/u,
    'and it is pinned true, so a second Public World is unrepresentable');
  assert.match(world, /CHECK \(world_type = 'PUBLIC_WORLD'\)/u, 'this relation can describe no other World type');
  assert.deepEqual(columnNames(WORLD), ['singleton', 'world_type', 'state_version', 'established_at'],
    'the Public World carries no owner, no member list, no coordinate, no ordering and no policy');

  // Every Public object belongs to the ONE World, structurally.
  assert.match(tableBlock(EXPERIENCES), /public_world_singleton boolean NOT NULL,/u);
  assert.match(tableBlock(EXPERIENCES), /CHECK \(public_world_singleton\)/u);
  assert.match(tableBlock(EXPERIENCES),
    /FOREIGN KEY \(public_world_singleton\)\s*\n\s*REFERENCES public\.public_world_state \(singleton\) ON DELETE RESTRICT/u);
  // And it is an OBJECT, not a World row.
  for (const banned of ['world_type', 'phase', 'birth_basis', 'world_id', 'member_count', 'membership_episode_id']) {
    assert.ok(!columnNames(EXPERIENCES).includes(banned), `a Public Experience carries no ${banned}`);
  }
  assert.ok(!executableSql.includes('public_worlds'), 'there is no plural Public World relation');
});

test('the Public audience policy is a gate, referenced by nothing', () => {
  const policy = tableBlock(POLICY);
  assert.match(policy, /CHECK \(registered_viewing_policy IN \('REGISTERED_ONLY', 'REGISTERED_AND_SIGNED_OUT'\)\)/u);
  assert.match(policy, /CHECK \(signed_out_viewing_policy IN \('UNRESOLVED', 'ALLOWED', 'DENIED'\)\)/u,
    'the frozen CW2-08 SIGNED_OUT_PUBLIC_VIEW_POLICY is representable as unresolved and fails closed');
  assert.ok(!deployableSql.includes(`REFERENCES public.${POLICY}`),
    'no object binds its identity to the viewing policy: changing it later creates no new World');
  assert.match(selfAssertions, /Public audience policy is a gate; no object may bind its identity to it/u);
});

test('the Public Identity ref is stable and opaque, and is neither the account id nor a contact endpoint', () => {
  const identities = tableBlock(IDENTITIES);
  assert.deepEqual(columnNames(IDENTITIES), ['public_identity_ref', 'user_id', 'created_at']);
  assert.match(identities, /CONSTRAINT public_identities_user_key UNIQUE \(user_id\)/u,
    'one stable Public Identity per human in v1');
  assert.match(identities, /CONSTRAINT public_identities_ref_user_key UNIQUE \(public_identity_ref, user_id\)/u,
    'so a dependant can bind the public ref and the human together in one constraint');
  assert.match(identities, /CHECK \(public_identity_ref <> user_id\)/u,
    'the opaque public ref is structurally distinct from the private account identifier');
  for (const table of OWN_TABLES) {
    for (const column of columnNames(table)) {
      assert.doesNotMatch(column, /email|phone|msisdn|address|contact|credential|invite|secret|token|password/u,
        `${table}.${column}: public identity presentation is not contact authority`);
    }
  }
});

test('a display label is mutable, non-unique, and reaches no Experience, version or package', () => {
  const display = tableBlock(DISPLAY);
  assert.match(display, /CHECK \(label_mode IN \('PSEUDONYM', 'REAL_NAME'\)\)/u, 'both frozen label modes');
  assert.match(display, /CHECK \(label_revision > 0\)/u);
  assert.doesNotMatch(display, /UNIQUE \(display_label\)/u,
    'labels are deliberately not unique: uniqueness would invent a public namespace no contract states');
  const refs = [...display.matchAll(/REFERENCES public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(refs, [IDENTITIES], 'display state reaches nothing but its own identity');
  // Historical alias rendering is deferred, so there is no label history relation.
  assert.ok(!executableSql.includes('public_identity_display_label_versions'));
  assert.ok(!executableSql.includes('display_label_history'));
  for (const kyc of ['verified', 'kyc', 'verification']) {
    assert.ok(!executableSql.toLowerCase().includes(kyc), `REAL_NAME asserts no ${kyc}: I-05A implements no identity verification`);
  }
});

test('Experience control is normalized, creator-scoped and never derived from an approval', () => {
  const controllers = tableBlock(CONTROLLERS);
  assert.match(controllers, /PRIMARY KEY \(experience_id, controller_public_identity_ref\)/u,
    'control is a normalized (Experience, controller) relation, not an owner column, so a later reviewed '
    + 'multi-controller semantics is additive');
  assert.match(controllers, /UNIQUE \(experience_id, controller_user_id\)/u);
  assert.match(controllers,
    /FOREIGN KEY \(controller_public_identity_ref, controller_user_id\)\s*\n\s*REFERENCES public\.public_identities \(public_identity_ref, user_id\)/u,
    'a controller row can never pair one human public identity with another human account');
  for (const banned of ['approval_id', 'manifest_version_id', 'package_item_id', 'rightsholder_user_id']) {
    assert.ok(!columnNames(CONTROLLERS).includes(banned), `Experience control is not derived from ${banned}`);
  }
  // `control_basis` is deliberately an open bounded string, not a closed vocabulary.
  assert.match(controllers, /CHECK \(length\(btrim\(control_basis\)\) > 0 AND length\(control_basis\) <= 64\)/u);
  assert.doesNotMatch(controllers, /control_basis IN \(/u,
    'no frozen contract enumerates control bases, so pinning one here would force a later reviewed transfer to reopen 0091');
  assert.ok(!executableSql.includes('transfer'), 'and I-05A invents no transfer or co-owner workflow');
});

test('an Experience Version is immutable, ordinal and carries no semantic placement', () => {
  const versions = tableBlock(VERSIONS);
  assert.match(versions, /UNIQUE \(package_manifest_version_id\)/u, 'one manifest produces at most one version');
  assert.match(versions, /UNIQUE \(experience_id, version_ordinal\)/u, 'a deterministic predecessor relation');
  assert.match(versions, /CHECK \(version_ordinal >= 1\)/u);
  for (const banned of ['semantic', 'placement', 'coordinate', 'embedding', 'vitality', 'rank', 'lifecycle', 'visibility']) {
    assert.ok(!columnNames(VERSIONS).some((c) => c.includes(banned)),
      `a version carries no ${banned} column: semantic interpretation binds to the exact version in I-05B`);
  }
  // Immutability is a trigger, not a privilege, because a privilege does not bind the owner.
  assert.match(executableSql,
    /CREATE TRIGGER public_experience_versions_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.public_experience_versions/u);
  assert.match(executableSql,
    /CREATE TRIGGER public_experience_lifecycle_events_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.public_experience_lifecycle_events/u);
  assert.match(executableSql, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE'/u);
});

test('the lifecycle vocabulary is complete and forward-safe, and PART A can produce none of it', () => {
  for (const state of LIFECYCLE_STATES) {
    assert.ok(tableBlock(EXPERIENCES).includes(`'${state}'`), `${state} is representable on the Experience`);
    assert.ok(tableBlock(LIFECYCLE).includes(`'${state}'`), `and on the append-only transition truth`);
  }
  assert.match(tableBlock(LIFECYCLE), /CHECK \(from_lifecycle IS NULL OR from_lifecycle <> to_lifecycle\)/u,
    'a transition moves');
  assert.match(tableBlock(LIFECYCLE), /from_lifecycle IS NULL AND experience_version_id IS NULL AND to_lifecycle = 'DRAFT'/u,
    'birth has no predecessor state and no version; every other transition names one');
  // PART A creates no writer at all, so it produces no lifecycle.
  assert.doesNotMatch(deployableSql, /INSERT INTO public\.public_experiences|UPDATE public\.public_experiences/u);
  const created = [...executableSql.matchAll(/^CREATE FUNCTION public\.(\w+)/gmu)].map((m) => m[1]);
  assert.deepEqual(created, ['reject_public_experience_history_mutation_v1'],
    'the ONE function PART A owns is the append-only trigger function: every primitive is migration 0093');
  assert.match(executableSql, /RETURNS trigger/u);
});

test('no public serving, discussion, Replay, Safety, Launch or entitlement state is created', () => {
  for (const banned of ['semantic', 'placement', 'coordinate', 'embedding', 'vitality', 'ranking',
    'discussion', 'reply', 'thread', 'visibility', 'moderation', 'safety', 'launch', 'entitlement',
    'premium', 'feature_flag', 'replay', 'search_index', 'lens']) {
    for (const table of OWN_TABLES) {
      assert.ok(!columnNames(table).some((c) => c.includes(banned)),
        `${table} carries no ${banned} column`);
    }
    assert.ok(!executableSql.includes(`CREATE TABLE public.public_${banned}`), `and no public_${banned} relation`);
  }
  assert.doesNotMatch(executableSql, /@Controller|@Get|@Post|@Module|CREATE POLICY|CREATE EVENT TRIGGER|CREATE RULE/u);
});

test('every relation is postgres-owned, RLS-enabled with zero policies, and revoked from every application role', () => {
  for (const table of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.ok(executableSql.includes(`public.${table},`) || executableSql.includes(`public.${table}\n`),
      `${table} appears in the REVOKE list`);
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM service_role/u);
  assert.doesNotMatch(executableSql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE/u,
    'no application role receives a direct table privilege');
  assert.doesNotMatch(executableSql, /GRANT EXECUTE/u, 'and PART A grants EXECUTE on nothing at all');
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'exactly one logical Public World must exist',
    'a second Public World must be unrepresentable, not merely absent',
    'SIGNED_OUT_PUBLIC_VIEW_POLICY must remain UNRESOLVED',
    'Public audience policy is a gate; no object may bind its identity to it',
    'a Public Experience must bind the ONE Public World by restrictive foreign key',
    'a Public Experience is an object, never a World',
    'the Public Identity ref must be structurally distinct from the account id',
    'Public identity is not contact authority',
    'Experience control must not be derived from a content approval',
    'Experience versions and lifecycle transitions must be append-only',
    'the ONE function PART A owns must be the append-only trigger function',
    'must have row level security enabled',
    'must carry zero policies',
    'must be postgres-owned',
    'must hold no privilege for',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  // PUBLIC is a pseudo-role: has_table_privilege resolves it, and the ACL form
  // would silently pass on a NULL relacl.
  assert.match(selfAssertions, /has_table_privilege\(banned, \('public\.' \|\| t\)::regclass, 'SELECT'\)/u);
  assert.match(selfAssertions, /ARRAY\['public', 'anon', 'authenticated', 'service_role'\]/u);
});

test('0091 is registered in the toolchain, in CI and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0091\\.mjs"`, 'u'));
  assert.ok(workflow.includes(`run: npm run ${OWN_SCRIPT}}`), 'the verifier runs in API CI');
  assert.match(readme, /0091_public_world_experience_identity_foundation_v1\.sql/u, 'the README records migration 0091');
  assert.match(verifier, /verifier for migration 0091/iu);
  // A CI step name lives inside a YAML flow mapping, where a comma ends the entry.
  const step = /- \{name: ([^,}]*), run: npm run verify:public-world-experience-foundation:integration\}/u.exec(workflow);
  assert.ok(step, 'the CI step is one well-formed flow mapping whose name carries no comma');
});
