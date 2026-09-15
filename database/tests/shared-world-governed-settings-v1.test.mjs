// I-04E - Governed Shared Settings v1: the secret-free structural contract for
// migration 0086.
//
// Live semantics - ACLs, real denials, the neutral state, the committed pointer and
// SETTING_CHANGED on one instant, the non-reusable approval, the exact count delta
// showing nothing else moved, the multi-connection races and forward safety - are
// proven by database/verify-migration-0086.mjs against real PostgreSQL, which this
// file pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04E PART B: that THIS slice implemented the
// governed WORLD_SETTINGS_CHANGE operation over the frozen I-04D substrate, with
// exactly the four frozen v1 fields as REAL optional columns - and nothing beyond
// it. No generic settings engine, JSON blob or key/value store; no membership,
// invitation, grant, consent or history-access mutation; no World creation or
// closure; no commercial, safety, moderation or entitlement setting; no owner,
// admin, creator or moderator authority; no Launch Gate, wrapper, controller or
// route - and that it modified no predecessor migration at all.
//
// It deliberately does NOT prove that a later reviewed setting may never appear. The
// whole point of choosing real columns over a blob is that a later setting is an
// ADDITIVE column or table, which this file forbids nowhere. So every assertion is
// scoped to migration 0086 itself, the verifier it added, the registration lines it
// added, and the frozen predecessors it was required not to modify - pinned by
// content hash, which proves immutability without banning additions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-world-governed-settings-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04E_SETTINGS_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0086_shared_world_governed_settings_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0086.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const VERSIONS = 'shared_world_settings_versions';
const SETTINGS_STATE = 'shared_world_settings_state';
const CHANGED_EVENTS = 'shared_world_setting_changed_events';
const CHANGE_COMMANDS = 'shared_world_settings_change_commands';
const OWN_TABLES = [VERSIONS, SETTINGS_STATE, CHANGED_EVENTS, CHANGE_COMMANDS];

const PREPARE_FN = 'prepare_shared_world_settings_change_governance_v1';
const COMMIT_FN = 'commit_shared_world_settings_change_v1';
const OWN_FUNCTIONS = [PREPARE_FN, COMMIT_FN];
const OWN_SCRIPT = 'verify:shared-world-governed-settings:integration';

/** The exact frozen v1 settings surface (CW2-03 section 30). */
const FROZEN_SETTINGS = ['name', 'description', 'topic', 'general_visual_marker'];

const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0086 creates ${name}`);
  const start = migration.indexOf("SET search_path='' AS $$", create);
  assert.ok(start > create, `${name} pins an empty search_path`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + "SET search_path='' AS $$".length, end + '\nEND'.length);
};
const BODY = Object.fromEntries(OWN_FUNCTIONS.map((name) => [name, functionBody(name)]));

const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const close = migration.indexOf(') RETURNS', open);
  assert.ok(close > open, `${name} has a terminated parameter list`);
  return migration.slice(open, close);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_]+)\s+(?:uuid|text)/gu)].map((m) => m[1]);

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0086 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};

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
];

// ---------------------------------------------------------------------------

test('0086 is the forward migration after 0085, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0086 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0086_')).length, 1, 'exactly one migration carries the 0086 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0085_shared_world_governed_membership_lifecycle_v1.sql'),
    '0086 orders after 0085');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04E reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0086 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0086 alters no predecessor table at all and installs no trigger of its own', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0086 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'migration 0086 creates no trigger at all');
  assert.doesNotMatch(executableSql, /RETURNS trigger/iu, 'and no trigger function for one to call');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger either');
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'and no RLS policy');
  // A settings change moves no topology, so it terminalizes no member invitation.
  assert.ok(!deployableSql.includes('shared_world_member_invitations'),
    '0086 never names a member invitation: a settings change moves no membership topology');
  assert.ok(selfAssertions.includes('I-04E: % must terminalize no member invitation: a settings change moves no topology'));
  assert.ok(selfAssertions.includes('I-04E: the two reviewed topology triggers migration 0085 owns must still be in place'));
});

test('the frozen v1 settings surface is four REAL optional text columns, and never a generic engine', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the four relations, and nothing else');
  const block = tableBlock(VERSIONS);
  for (const field of FROZEN_SETTINGS) {
    assert.match(block, new RegExp(`^ {4}${field} text,$`, 'mu'),
      `${field} is a REAL nullable text column with no default: optional, and visible to the schema`);
  }
  // NOT a generic settings engine, and not a role record. Scoped to the COLUMN
  // DECLARATIONS rather than the whole block: a composite foreign key legitimately
  // NAMES the I-04D column `proposed_payload_version_id`, and a ban that read the
  // constraint text would fire on the binding it exists to require.
  for (const name of OWN_TABLES) {
    const table = tableBlock(name);
    // Every COLUMN declaration, whatever its type - a type allowlist here would let
    // exactly the jsonb blob this ban exists to refuse slip past it.
    const declarations = table.split('\n')
      .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line));
    assert.ok(declarations.length > 0, `${name} declares columns`);
    for (const declaration of declarations) {
      assert.doesNotMatch(declaration, /\b(?:json|jsonb|hstore)\b|\[\]/iu, `${name}: ${declaration.trim()} stores no JSON, array or hstore`);
      assert.doesNotMatch(declaration, /(owner|admin|creator|initiator|proposer|moderator|privilege|capability|permission|entitlement|commercial|safety|moderation|flag|metadata|payload|blob|document|setting_key|setting_value)/iu,
        `${name}: ${declaration.trim()} is no key/value store, no policy engine and no role`);
    }
    assert.match(table, /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(table, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
  }
  assert.ok(selfAssertions.includes('I-04E: Shared settings are exact columns under unanimity, never a JSON blob, a role or a policy engine'));
  assert.ok(selfAssertions.includes('I-04E: the frozen v1 settings surface must be exactly these columns, in place, not %'));
  // No avatar or media storage decision is taken here.
  assert.doesNotMatch(deployableSql, /avatar|image_url|media_url|storage_bucket/iu,
    'general_visual_marker is a text marker: where a future image lives is not this slice to decide');
});

test('a settings version is immutable and binds its exact proposal, World and operation structurally', () => {
  const block = tableBlock(VERSIONS);
  assert.match(block, /^ {4}id uuid NOT NULL,/mu, 'the version IS the opaque I-04D payload version identity');
  assert.match(block, /CHECK \(governance_operation_kind = 'WORLD_SETTINGS_CHANGE'\)/u,
    'and it can belong to no other operation');
  assert.match(block, /FOREIGN KEY \(governance_proposal_id, world_id, governance_operation_kind, id\)\s*\n?\s*REFERENCES public\.shared_world_governance_proposals \(id, world_id, operation_kind, proposed_payload_version_id\) ON DELETE RESTRICT/u,
    'the four-column composite key makes the binding structural rather than procedural');
  assert.match(block, /CONSTRAINT shared_world_settings_versions_proposal_key UNIQUE \(governance_proposal_id\)/u,
    'one proposal carries at most one settings version');
  assert.match(block, /CONSTRAINT shared_world_settings_versions_world_version_key UNIQUE \(world_id, id\)/u,
    'and exposes the composite key the current pointer must reference');
  // The pointer is the ONLY mutable relation, one row per World, and no row is the
  // valid neutral state.
  const pointer = tableBlock(SETTINGS_STATE);
  assert.match(pointer, /CONSTRAINT shared_world_settings_state_pk PRIMARY KEY \(world_id\)/u,
    'exactly one current settings row per World, and no row at all is the neutral default');
  assert.match(pointer, /FOREIGN KEY \(world_id, current_settings_version_id\)\s*\n?\s*REFERENCES public\.shared_world_settings_versions \(world_id, id\) ON DELETE RESTRICT/u,
    'a World can never point at another World settings version');
  // The commit moves the pointer; it never rewrites a version.
  assert.doesNotMatch(BODY[COMMIT_FN], /UPDATE public\.shared_world_settings_versions/u,
    'a committed settings version is immutable: a changed value is a NEW version');
  assert.match(BODY[COMMIT_FN], /INSERT INTO public\.shared_world_settings_state[\s\S]{0,400}ON CONFLICT ON CONSTRAINT shared_world_settings_state_pk\s*\n?\s*DO UPDATE SET/u,
    'the pointer is created on the first change and moved atomically on every later one');
  // An old approval is never a reusable settings permission.
  assert.match(BODY[COMMIT_FN], /public\.resolve_shared_world_governance_approval_v1\([\s\S]{0,80}'WORLD_SETTINGS_CHANGE', settings_version\.id\)/u,
    'the commit names the exact operation AND the exact version it is about to apply');
  assert.ok(selfAssertions.includes('I-04E: a settings commit must revalidate the exact operation AND the exact version it is about to apply'));
  assert.ok(selfAssertions.includes('I-04E: a committed settings version is immutable: a changed value is a NEW version'));
  // Every proposed value is compared exactly, NULLs included, so a different value is
  // never an equivalent retry.
  for (const field of FROZEN_SETTINGS) {
    assert.ok(BODY[PREPARE_FN].includes(`committed.${field} IS NOT DISTINCT FROM p_${field}`),
      `an equivalent settings retry must match ${field} exactly, NULL included`);
  }
});

test('both primitives are sealed, pinned, actor-free and executable by no application role at all', () => {
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'migration 0086 grants nothing to anybody');
  for (const name of OWN_FUNCTIONS) {
    assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${name}\\([^)]*\\) OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role`, 'u'),
      `${name} is revoked from service_role too, because the frozen Launch Gate precondition is unimplemented`);
    assert.match(executableSql, new RegExp(`public\\.${name}\\([\\s\\S]{0,800}?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'));
    // SETTINGS AUTHORITY IS UNANIMITY, NEVER A ROLE and never whoever transmits it.
    assert.doesNotMatch(BODY[name], /auth\.uid/u, `${name} derives and records no settings actor`);
    assert.doesNotMatch(BODY[name], /pg_advisory|LOCK TABLE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(BODY[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${name} accepts no clock but the database's own`);
    assert.doesNotMatch(BODY[name], /DELETE FROM|TRUNCATE/iu, `${name} deletes no canonical history`);
    assert.match(BODY[name], /FROM public\.shared_worlds w WHERE w\.id = (?:p_world_id|target_world) FOR UPDATE/u,
      `${name} locks the exact World row first`);
    assert.equal((BODY[name].match(/FOR UPDATE/gu) ?? []).length, 1,
      `${name} takes exactly one row lock of its own, and it is the World row`);
  }
  for (const phrase of [
    'I-04E: PUBLIC must not execute the governed settings surface before the launch gate exists',
    'I-04E: % must not execute the governed settings surface before the launch gate exists',
    'I-04E: % records no settings actor: the authority is the exact unanimous approval set',
    'I-04E: % must be SECURITY DEFINER',
    'I-04E: % must pin an empty search_path',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0086 refuses to deploy without: ${phrase}`);
  for (const name of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
});

test('both primitives accept exactly their frozen parameter list, and no authority parameter at all', () => {
  assert.deepEqual(parameters(PREPARE_FN),
    ['p_proposal_id', 'p_membership_snapshot_id', 'p_settings_version_id', 'p_world_id',
      'p_name', 'p_description', 'p_topic', 'p_general_visual_marker'],
    'the preparation accepts four opaque identities and exactly the four frozen optional values');
  assert.deepEqual(parameters(COMMIT_FN), ['p_command_id', 'p_proposal_id', 'p_setting_changed_event_id'],
    'the commit accepts three opaque identities and no value at all: the values are already immutable');
  for (const name of OWN_FUNCTIONS) {
    for (const parameter of parameters(name)) {
      assert.doesNotMatch(parameter, /actor|user_id|initiator|proposer|owner|admin|approver|approval_set|member_ids|episode|audience|count|launch|gate|timestamp|instant|_at$/u,
        `${name} must not accept ${parameter}: an authority, topology, count or clock parameter`);
    }
    assert.doesNotMatch(signature(name), /DEFAULT/u,
      `${name} declares no defaulted parameter, so a widened list cannot arrive silently`);
  }
});

test('0086 consumes the frozen I-04D governance and mutates nothing outside its own four relations', () => {
  assert.match(BODY[PREPARE_FN], /public\.capture_shared_world_governance_proposal_v1\(/u,
    'the preparation opens its proposal through the frozen I-04D capture');
  assert.match(BODY[PREPARE_FN], /'WORLD_SETTINGS_CHANGE', p_settings_version_id,\s*\n\s*'ALL_CURRENT_MEMBERS', NULL\)/u,
    'exactly WORLD_SETTINGS_CHANGE under ALL_CURRENT_MEMBERS, with no exclusion');
  assert.match(BODY[PREPARE_FN], /captured\.snapshot_captured_at/u,
    'and persists the exact instant the frozen capture owned');
  assert.doesNotMatch(BODY[PREPARE_FN], /clock_timestamp/u, 'reading no clock of its own');
  assert.doesNotMatch(BODY[PREPARE_FN], /public\.shared_world_settings_state/u,
    'preparing a settings change moves no current pointer');
  assert.match(BODY[COMMIT_FN], /change_instant := clock_timestamp\(\);/u,
    'the commit reads ONE database-owned instant');
  assert.equal((BODY[COMMIT_FN].match(/change_instant := /gu) ?? []).length, 1, 'exactly once');
  for (const name of OWN_FUNCTIONS) {
    for (const coupled of [
      'INSERT INTO public.shared_world_membership_episodes', 'UPDATE public.shared_world_membership_episodes',
      'INSERT INTO public.shared_worlds', 'UPDATE public.shared_worlds',
      'INSERT INTO public.shared_world_governance_proposals', 'UPDATE public.shared_world_governance_proposals',
      'INSERT INTO public.shared_world_governance_approvals', 'UPDATE public.shared_world_governance_approvals',
      'INSERT INTO public.shared_world_membership_snapshot',
      'public.shared_world_standing_context_grants', 'public.shared_world_standing_context_grant_audience',
      'public.shared_world_standing_context_consent_events',
    ]) assert.ok(!BODY[name].includes(coupled), `${name} never performs: ${coupled}`);
  }
  // No closure, no history access, no entitlement, no Launch Gate, no other domain.
  for (const absent of [
    'history_access', 'HISTORY_ACCESS_GRANT', 'CLOSED_WORLD_VIEW_ENTITLEMENT', 'READ_ONLY_CLOSED',
    'closed_at', 'WORLD_ENDED', 'launch_gate', 'feature_flag', 'introduction', 'matching', 'replay',
  ]) {
    assert.ok(!deployableSql.toLowerCase().includes(absent.toLowerCase()),
      `migration 0086 never writes ${absent}: I-04F owns closure and history access, and this slice invents neither`);
  }
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0086.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0086/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0086\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0086_shared_world_governed_settings_v1\.sql/u, 'the README records migration 0086');
  assert.match(readme, /general_visual_marker/u);
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0086 did not create is proven from 0086 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.doesNotMatch(verifier, /FROM pg_trigger/u,
    'no live trigger census: that 0086 installs no trigger is proven from 0086 own text, and a later reviewed audit trigger is not an 0086 regression');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  // S5: the probe adds exactly the later additive settings schema this slice permits.
  for (const authorized of ['_language_preference text', '_consumer_metadata jsonb', '_settings_media',
    'CREATE INDEX', 'CREATE TRIGGER', '_launch_gates']) {
    assert.ok(verifier.includes(authorized), `the probe proves a later additive ${authorized} is not an 0086 regression`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0086 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated EXECUTE on the settings commit', (text) => text.replace(
        `REVOKE ALL ON FUNCTION public.${COMMIT_FN}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${COMMIT_FN}(uuid, uuid, uuid) TO authenticated;`)],
      ['turns the settings surface into a JSON blob', (text) => text.replace(
        '    general_visual_marker text,', '    general_visual_marker text,\n    settings_json jsonb,')],
      ['drops a frozen v1 setting', (text) => text.replace('    topic text,\n', '')],
      ['records a settings actor', (text) => text.replace(
        'DECLARE\n  committed public.shared_world_settings_change_commands;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_settings_change_commands;')],
      ['lets the commit apply a version it did not name', (text) => text.replace(
        "    p_proposal_id, 'WORLD_SETTINGS_CHANGE', settings_version.id);",
        "    p_proposal_id, 'WORLD_SETTINGS_CHANGE', settings_version.id);\n  -- weakened")],
      ['rewrites a committed settings version in place', (text) => text.replace(
        '    INSERT INTO public.shared_world_setting_changed_events',
        '    UPDATE public.shared_world_settings_versions SET name = name WHERE id = settings_version.id;\n'
        + '    INSERT INTO public.shared_world_setting_changed_events')],
      ['lets a World point at another World settings version', (text) => text.replace(
        '        FOREIGN KEY (world_id, current_settings_version_id)\n        REFERENCES public.shared_world_settings_versions (world_id, id) ON DELETE RESTRICT',
        '        FOREIGN KEY (current_settings_version_id)\n        REFERENCES public.shared_world_settings_versions (id) ON DELETE RESTRICT')],
      ['lets a World hold two current settings rows', (text) => text.replace(
        '    CONSTRAINT shared_world_settings_state_pk PRIMARY KEY (world_id),',
        '    CONSTRAINT shared_world_settings_state_pk PRIMARY KEY (world_id, current_settings_version_id),')],
      ['terminalizes a member invitation from a settings change', (text) => text.replace(
        '    INSERT INTO public.shared_world_settings_change_commands',
        "    UPDATE public.shared_world_member_invitations SET invitation_state = 'STALE_GOVERNANCE' WHERE world_id = settings_version.world_id;\n"
        + '    INSERT INTO public.shared_world_settings_change_commands')],
      ['closes the World from a settings change', (text) => text.replace(
        '    INSERT INTO public.shared_world_setting_changed_events',
        "    UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = settings_version.world_id;\n"
        + '    INSERT INTO public.shared_world_setting_changed_events')],
      ['adds a moderator role to the settings surface', (text) => text.replace(
        '    general_visual_marker text,', '    general_visual_marker text,\n    moderator_user_id uuid,')],
      ['stops comparing a proposed value exactly', (text) => text.replace(
        '       AND committed.topic IS NOT DISTINCT FROM p_topic\n', '')],
      ['lets a caller supply the settings instant', (text) => text.replace(
        '  p_command_id uuid, p_proposal_id uuid, p_setting_changed_event_id uuid\n) RETURNS TABLE(outcome text, settings_command_id uuid',
        '  p_command_id uuid, p_proposal_id uuid, p_setting_changed_event_id uuid, p_changed_at timestamptz DEFAULT NULL\n) RETURNS TABLE(outcome text, settings_command_id uuid')],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0086`);
      const sql = weakened.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      const body = sql.slice(0, sql.indexOf('DO $$\nDECLARE'));
      const bodies = Object.fromEntries(OWN_FUNCTIONS.map((name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const start = weakened.indexOf("SET search_path='' AS $$", create);
        const end = weakened.indexOf('\nEND$$;', start);
        return [name, create < 0 || start < 0 || end < 0 ? '' : weakened.slice(start, end)];
      }));
      const declared = (name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const open = create + `CREATE FUNCTION public.${name}(`.length;
        return weakened.slice(open, weakened.indexOf(') RETURNS', open));
      };
      const caught = [
        () => assert.doesNotMatch(sql, /\bGRANT\b/u),
        () => assert.doesNotMatch(body, /\b(?:json|jsonb)\b/iu),
        () => { for (const field of FROZEN_SETTINGS) assert.match(body, new RegExp(`^ {4}${field} text,$`, 'mu')); },
        () => assert.doesNotMatch(bodies[COMMIT_FN], /auth\.uid/u),
        () => assert.match(bodies[COMMIT_FN], /'WORLD_SETTINGS_CHANGE', settings_version\.id\);\n\n  IF proof/u),
        () => assert.doesNotMatch(bodies[COMMIT_FN], /UPDATE public\.shared_world_settings_versions/u),
        () => assert.match(body, /FOREIGN KEY \(world_id, current_settings_version_id\)/u),
        () => assert.match(body, /PRIMARY KEY \(world_id\),/u),
        () => assert.ok(!body.includes('shared_world_member_invitations')),
        () => assert.ok(!body.includes('UPDATE public.shared_worlds')),
        () => assert.doesNotMatch(body, /moderator/iu),
        () => { for (const field of FROZEN_SETTINGS) assert.ok(bodies[PREPARE_FN].includes(`committed.${field} IS NOT DISTINCT FROM p_${field}`)); },
        () => assert.doesNotMatch(declared(COMMIT_FN), /DEFAULT|_at\b/u),
      ];
      let refused = false;
      for (const check of caught) {
        try { check(); } catch { refused = true; break; }
      }
      assert.ok(refused, `a migration that ${reason} must be refused by at least one structural check`);
    }
  });

// ---------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
// ---------------------------------------------------------------------------

const MIRRORED = ['database', '.github/workflows/api-ci.yml', 'package.json', 'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04e-settings-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    const to = join(mirror, entry);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}

function runInMirror(mirror, file = SELF) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'database', 'tests', file)], { cwd: mirror, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `the mirrored contract could not be started: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

const write = (mirror, relative, content) => {
  const target = join(mirror, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
};
const patch = (mirror, relative, from, to) => {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the regression probe needs ${from} in ${relative}`);
  writeFileSync(target, text.replace(from, to));
};

test('later reviewed settings, I-04F closure and a Launch Gate leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    t.after(() => removeHarnessMirror(mirror));
    try {
      write(mirror, 'database/migrations/0087_shared_world_additive_settings_and_closure_v1.sql',
        '-- A later reviewed slice: additive settings, plus I-04F closure.\n'
        + 'BEGIN;\n'
        + 'ALTER TABLE public.shared_world_settings_versions ADD COLUMN language_preference text;\n'
        + 'ALTER TABLE public.shared_world_settings_versions ADD COLUMN consumer_metadata jsonb;\n'
        + 'CREATE TABLE public.shared_world_settings_media (id uuid PRIMARY KEY, settings_version_id uuid\n'
        + '  REFERENCES public.shared_world_settings_versions (id) ON DELETE SET NULL);\n'
        + 'CREATE TABLE public.shared_world_history_access_grants (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL);\n'
        + 'CREATE INDEX shared_world_settings_versions_world_idx ON public.shared_world_settings_versions (world_id, created_at);\n'
        + 'CREATE FUNCTION public.change_shared_world_settings_gated_v1(p_command_id uuid, p_proposal_id uuid, p_event_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + `BEGIN\n  PERFORM 1 FROM public.${COMMIT_FN}(p_command_id, p_proposal_id, p_event_id);\nEND$fn$;\n`
        + 'GRANT EXECUTE ON FUNCTION public.change_shared_world_settings_gated_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0087.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-additive-settings-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'later additive settings columns, a settings-media table, the I-04F history substrate, a Launch Gate, '
        + 'a gated wrapper, a later index and migration 0087 must all leave this contract passing');

      const regressions = [
        ['0086 itself grants EXECUTE', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid, text, text, text, text) TO authenticated;`)],
        ['a frozen predecessor migration is edited', () => patch(mirror, 'database/migrations/0084_shared_world_governance_approval_foundation_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0086 turns the settings surface into a blob', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '    general_visual_marker text,', '    general_visual_marker text,\n    settings_json jsonb,')],
        ['0086 alters a predecessor table', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'CREATE TABLE public.shared_world_settings_versions (',
          'ALTER TABLE public.shared_world_governance_proposals ADD COLUMN settings_note text;\nCREATE TABLE public.shared_world_settings_versions (')],
        ['0086 installs a trigger of its own', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '-- ---------------------------------------------------------------------------\n-- 4. Deny-by-default posture',
          'CREATE TRIGGER shared_world_settings_audit AFTER INSERT ON public.shared_world_settings_versions\n'
          + '  FOR EACH ROW EXECUTE FUNCTION public.qandeel_keepalive();\n'
          + '-- ---------------------------------------------------------------------------\n-- 4. Deny-by-default posture')],
        ['the CI step for this slice is removed', () => patch(mirror, '.github/workflows/api-ci.yml',
          `run: npm run ${OWN_SCRIPT}}`, 'run: echo skipped}')],
      ];
      for (const [reason, plant] of regressions) {
        const snapshot = buildMirror();
        try {
          plant(mirror);
          assert.equal(runInMirror(mirror).ok, false, `a repository where ${reason} must still be refused`);
        } finally {
          const wiped = removeHarnessMirror(mirror);
          assert.ok(wiped.removed,
            `the mirror must be wiped before the snapshot is restored: ${wiped.error?.message ?? wiped.refused ?? ''}`);
          cpSync(snapshot, mirror, { recursive: true });
          removeHarnessMirror(snapshot);
        }
      }
    } finally {
      removeHarnessMirror(mirror);
    }
  });
