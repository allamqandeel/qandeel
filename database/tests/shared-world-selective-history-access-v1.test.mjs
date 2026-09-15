// I-04F - Selective Historical Access v1: the secret-free structural contract for
// migration 0087.
//
// Live semantics - ACLs, real denials, the FROM_JOIN_FORWARD default, rejoin,
// mixed-owner approver unions, the former-member approver, stale manifests, the
// availability-dominates rule, the multi-connection races and forward safety - are
// proven by database/verify-migration-0087.mjs against real PostgreSQL, which this
// file pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04F PART A: that THIS slice implemented the
// selective-history visibility and authority substrate - a history-visibility
// PROJECTION, an exact baseline audience, exact per-item material authorities, an
// immutable manifest bound to the exact grantee episode, a derived required
// approver set, human approvals and one committed HISTORY_ACCESS_GRANT - and
// nothing beyond it. No Shared material or content of any kind; no generic JSON,
// predicate language or audience blob; no membership, World-lifecycle, governance,
// grant-withdrawal or entitlement mutation; no Launch Gate, wrapper, controller or
// route - and that it modified no predecessor migration at all.
//
// It deliberately does NOT prove that a later reviewed table, column, index,
// trigger or consumer may never appear. I-04G's real material store binds to the
// history item identity this slice creates, and 0088 adds the closure entitlement
// the resolver's closed branch reads; both are forbidden nowhere here. So every
// assertion is scoped to migration 0087 itself, the verifier it added, the
// registration lines it added, and the frozen predecessors it was required not to
// modify - pinned by content hash, which proves immutability without banning
// additions.
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
const SELF = 'shared-world-selective-history-access-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04F_HISTORY_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0087_shared_world_selective_history_access_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0087.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const ITEMS = 'shared_world_history_items';
const BASELINE = 'shared_world_history_item_baseline_viewers';
const ITEM_APPROVERS = 'shared_world_history_item_required_approvers';
const MANIFESTS = 'shared_world_history_package_manifest_versions';
const MANIFEST_ITEMS = 'shared_world_history_package_manifest_items';
const PACKAGE_APPROVERS = 'shared_world_history_package_required_approvers';
const PACKAGE_APPROVALS = 'shared_world_history_package_approvals';
const GRANTS = 'shared_world_history_access_grants';
const GRANTED_EVENTS = 'shared_world_history_granted_events';
const GRANT_COMMANDS = 'shared_world_history_grant_commands';
const OWN_TABLES = [ITEMS, BASELINE, ITEM_APPROVERS, MANIFESTS, MANIFEST_ITEMS,
  PACKAGE_APPROVERS, PACKAGE_APPROVALS, GRANTS, GRANTED_EVENTS, GRANT_COMMANDS];

const PREPARE_FN = 'prepare_shared_world_history_package_v1';
const APPROVE_FN = 'commit_shared_world_history_package_approval_v1';
const GRANT_FN = 'commit_shared_world_history_access_grant_v1';
const RESOLVE_FN = 'resolve_shared_world_history_visibility_v1';
const TRIGGER_FN = 'shared_world_history_item_temporal_truth_v1';
const MUTATION_FUNCTIONS = [PREPARE_FN, APPROVE_FN, GRANT_FN];
const OWN_FUNCTIONS = [...MUTATION_FUNCTIONS, RESOLVE_FN, TRIGGER_FN];
const OWN_SCRIPT = 'verify:shared-world-selective-history-access:integration';

/** The exactly two writer meanings an empty approver relation may carry. */
const AUTHORITY_MODES = ['EXACT_HUMAN_APPROVER_SET', 'NO_HUMAN_APPROVAL_REQUIRED'];
/** The canonical availability vocabulary, in parity with the merged I-01A kernel. */
const AVAILABILITIES = ['AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE'];

const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0087 creates ${name}`);
  const start = migration.indexOf('AS $$', create);
  assert.ok(start > create, `${name} opens a dollar-quoted body`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + 'AS $$'.length, end + '\nEND'.length);
};
const BODY = Object.fromEntries(OWN_FUNCTIONS.map((name) => [name, functionBody(name)]));

const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const close = migration.indexOf(') RETURNS', open);
  assert.ok(close > open, `${name} has a terminated parameter list`);
  return migration.slice(open, close);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_]+)\s+(?:uuid\[\]|uuid|text)/gu)].map((m) => m[1]);

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0087 creates ${name}`);
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
  ['0085_shared_world_governed_membership_lifecycle_v1.sql', 'd9d05ca2ec7dd11deea7426c80afc06571ec263c'],
  ['0086_shared_world_governed_settings_v1.sql', '2e78d1b751b5158b3ccf04ebaf1e614d76593f77'],
];

// ---------------------------------------------------------------------------

test('0087 is the forward migration after 0086, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0087 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0087_')).length, 1, 'exactly one migration carries the 0087 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0086_shared_world_governed_settings_v1.sql'),
    '0087 orders after 0086');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04F reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0087 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0087 alters no predecessor table and installs exactly one trigger, on a relation it created', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0087 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'and no RLS policy');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger');
  const triggers = [...executableSql.matchAll(/CREATE TRIGGER (\w+)\s*\n?\s*(?:BEFORE|AFTER) [\s\S]*?ON public\.(\w+)/gu)];
  assert.equal(triggers.length, 1, 'migration 0087 installs exactly one trigger');
  assert.equal(triggers[0][1], 'shared_world_history_item_immutable_truth');
  assert.equal(triggers[0][2], ITEMS, 'and it is on a relation this slice created itself');
  assert.ok(selfAssertions.includes('I-04F: the history projection carries exactly one reviewed immutability trigger'));
  assert.ok(selfAssertions.includes('I-04F: the two reviewed topology triggers migration 0085 owns must still be in place'));
});

test('the history item is an opaque visibility projection, and never Shared material', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the ten relations, and nothing else');
  for (const name of OWN_TABLES) {
    const table = tableBlock(name);
    const declarations = table.split('\n')
      .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line));
    assert.ok(declarations.length > 0, `${name} declares columns`);
    for (const declaration of declarations) {
      // Every COLUMN declaration, whatever its type - a type allowlist here would
      // let exactly the payload blob this ban exists to refuse slip past it.
      assert.doesNotMatch(declaration, /\b(?:json|jsonb|hstore|bytea)\b|\[\]/iu,
        `${name}: ${declaration.trim()} stores no JSON, array, hstore or binary body`);
      assert.doesNotMatch(declaration, /(body|transcript|audio|content|payload|blob|document|analysis|message|provenance|summary|title|label|metadata|owner|admin|creator|initiator|moderator|privilege|capability|permission|entitlement|commercial|safety|moderation)/iu,
        `${name}: ${declaration.trim()} carries no material content, provenance, role or policy`);
    }
    assert.match(table, /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(table, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
  }
  // The one relation that could have become a material store is pinned exactly.
  const item = tableBlock(ITEMS);
  for (const column of ['id uuid NOT NULL,', 'world_id uuid NOT NULL,', 'occurred_at timestamptz NOT NULL,',
    'authority_requirement_mode text NOT NULL,', 'availability_state text NOT NULL,',
    'availability_revision bigint NOT NULL,', 'registered_at timestamptz NOT NULL,']) {
    assert.match(item, new RegExp(`^ {4}${column.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'mu'),
      `the history item carries exactly ${column}`);
  }
  assert.equal(item.split('\n').filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line)).length, 7,
    'the history item has SEVEN columns and no eighth place for content to hide in');
  assert.ok(selfAssertions.includes('I-04F: the history projection carries visibility and authority metadata only, never material content, a role or a status lifecycle'));
  // No Shared material / conversation runtime is started here: that is I-04G.
  for (const absent of ['HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS',
    'shared_world_material', 'shared_world_turns', 'shared_world_messages', 'launch_gate', 'feature_flag',
    'INTRODUCTION_ENDED', 'INTRODUCTION_RECORD', 'public_experience', 'replay']) {
    assert.ok(!deployableSql.toLowerCase().includes(absent.toLowerCase()),
      `migration 0087 never writes ${absent}: the Shared material store belongs to I-04G`);
  }
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('authority metadata is exact in both directions, and an empty approver set is never ambiguous', () => {
  const item = tableBlock(ITEMS);
  assert.match(item, new RegExp(`CHECK \\(authority_requirement_mode IN \\('${AUTHORITY_MODES[0]}', '${AUTHORITY_MODES[1]}'\\)\\)`, 'u'),
    'the item carries exactly the two frozen writer meanings');
  assert.match(item, new RegExp(`CHECK \\(availability_state IN \\('${AVAILABILITIES.join("', '")}'\\)\\)`, 'u'),
    'and exactly the canonical availability vocabulary');
  assert.match(item, /CHECK \(availability_revision > 0\)/u, 'the availability revision is positive');
  // Both directions are validated at preparation AND again at grant commit.
  for (const name of [PREPARE_FN, GRANT_FN]) {
    assert.match(BODY[name], new RegExp(`authority_requirement_mode = '${AUTHORITY_MODES[0]}'[\\s\\S]{0,240}NOT EXISTS`, 'u'),
      `${name}: EXACT_HUMAN_APPROVER_SET with no approver is missing metadata, and fails closed`);
    assert.match(BODY[name], new RegExp(`authority_requirement_mode = '${AUTHORITY_MODES[1]}'[\\s\\S]{0,240}AND EXISTS`, 'u'),
      `${name}: NO_HUMAN_APPROVAL_REQUIRED carrying an approver is contradictory, and fails closed`);
  }
  assert.match(BODY[GRANT_FN], /IF required = 0 AND EXISTS \(/u,
    'a zero required set is authority ONLY for a manifest whose every item is explicitly approval-free');
  assert.ok(selfAssertions.includes('I-04F: a zero required set is authority ONLY for an explicitly approval-free manifest'));
});

test('the required approver set is DERIVED as the exact union, and is never caller-supplied', () => {
  assert.deepEqual(parameters(PREPARE_FN),
    ['p_manifest_version_id', 'p_world_id', 'p_grantee_user_id', 'p_history_item_ids'],
    'the preparation accepts two opaque identities, the exact grantee human and the exact item identities');
  assert.match(BODY[PREPARE_FN], /INSERT INTO public\.shared_world_history_package_required_approvers[\s\S]{0,300}SELECT DISTINCT p_manifest_version_id, ra\.approver_user_id[\s\S]{0,200}shared_world_history_item_required_approvers ra/u,
    'the derived set is the exact UNION over the included items required approvers');
  // Structural, not merely procedural: only a derived required approver can approve.
  assert.match(tableBlock(PACKAGE_APPROVALS),
    /FOREIGN KEY \(manifest_version_id, approver_user_id\)\s*\n?\s*REFERENCES public\.shared_world_history_package_required_approvers\s*\n?\s*\(manifest_version_id, approver_user_id\) ON DELETE RESTRICT/u,
    'an approval by a human the manifest does not require is structurally impossible');
  assert.match(tableBlock(PACKAGE_APPROVALS), /UNIQUE \(manifest_version_id, approver_user_id\)/u,
    'one effective approval per (manifest, approver): one human never covers another human requirement');
  assert.ok(selfAssertions.includes('I-04F: the required approver set must be DERIVED as the exact union over the included items'));
  assert.ok(selfAssertions.includes('I-04F: the approver must be in the exact DERIVED required set, and nothing else may qualify'));
});

test('the manifest is immutable, holds an exact item set and binds the exact grantee episode', () => {
  const manifest = tableBlock(MANIFESTS);
  assert.match(manifest, /^ {4}grantee_membership_episode_id uuid NOT NULL,$/mu,
    'the manifest binds the grantee EXACT open episode, so a rejoin never revives it');
  assert.match(manifest, /FOREIGN KEY \(grantee_membership_episode_id\)\s*\n?\s*REFERENCES public\.shared_world_membership_episodes \(id\) ON DELETE RESTRICT/u);
  assert.match(manifest, /UNIQUE \(id, world_id, grantee_user_id, grantee_membership_episode_id\)/u,
    'and exposes the composite key the committed grant must reference');
  const items = tableBlock(MANIFEST_ITEMS);
  assert.match(items, /PRIMARY KEY \(manifest_version_id, history_item_id\)/u, 'the item set is normalized rows');
  assert.match(items, /^ {4}captured_availability_revision bigint NOT NULL,$/mu,
    'each item carries its exact availability revision at preparation');
  assert.match(items, /FOREIGN KEY \(history_item_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_history_items \(id, world_id\) ON DELETE RESTRICT/u,
    'every item belongs to the exact same World as the manifest, structurally');
  assert.match(items, /FOREIGN KEY \(manifest_version_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_history_package_manifest_versions \(id, world_id\) ON DELETE RESTRICT/u);
  // No JSON manifest blob, and no generic predicate or query language.
  assert.ok(!deployableSql.includes('manifest_json') && !deployableSql.includes('selection_predicate')
    && !deployableSql.includes('scope_expression'),
    'the manifest is the exact item set, never a blob and never a predicate language');
  // Every committed manifest, approval and grant is immutable.
  for (const name of MUTATION_FUNCTIONS) {
    for (const forbidden of ['UPDATE public.shared_world_history_package_manifest_versions',
      'UPDATE public.shared_world_history_package_manifest_items',
      'UPDATE public.shared_world_history_package_approvals',
      'UPDATE public.shared_world_history_access_grants',
      'UPDATE public.shared_world_history_granted_events']) {
      assert.ok(!BODY[name].includes(forbidden), `${name} never performs: ${forbidden}`);
    }
  }
  assert.ok(selfAssertions.includes('I-04F: % must rewrite no committed manifest, approval or grant: they are immutable history'));
});

test('a committed grant has no withdrawal semantics: frozen canon defers that policy', () => {
  const grants = tableBlock(GRANTS);
  assert.doesNotMatch(grants, /status|revoked|withdrawn|expires|valid_until|rescinded/iu,
    'the grant carries no mutable status lifecycle at all');
  assert.match(grants, /UNIQUE \(manifest_version_id\)/u, 'one manifest commits at most one grant');
  for (const name of MUTATION_FUNCTIONS) {
    assert.doesNotMatch(BODY[name], /revoke[d_]|withdraw|rescind|retroactive/iu,
      `${name} invents no history-grant withdrawal`);
    assert.doesNotMatch(BODY[name], /DELETE FROM|TRUNCATE/iu, `${name} deletes no canonical history`);
  }
  assert.ok(selfAssertions.includes('I-04F: % must invent no history-grant withdrawal: frozen canon defers that policy'));
});

test('all three mutation primitives are sealed, pinned, World-first and executable by no application role', () => {
  // The ONLY grant in this migration is service_role EXECUTE on the read-only resolver.
  const grantLines = executableSql.split('\n').filter((line) => /\bGRANT\b/u.test(line));
  assert.equal(grantLines.length, 1, 'migration 0087 contains exactly one GRANT statement');
  assert.match(grantLines[0],
    new RegExp(`^GRANT EXECUTE ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) TO service_role;$`, 'u'),
    'and it is service_role EXECUTE on the read-only visibility resolver, nothing else');
  for (const name of MUTATION_FUNCTIONS) {
    assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${name}\\([^)]*\\) OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role`, 'u'),
      `${name} is revoked from service_role too, because the frozen Launch Gate precondition is unimplemented`);
    assert.match(executableSql, new RegExp(`public\\.${name}\\([\\s\\S]{0,900}?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'));
    assert.doesNotMatch(BODY[name], /pg_advisory|LOCK TABLE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(BODY[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${name} accepts no clock but the database's own`);
    assert.equal((BODY[name].match(/clock_timestamp\(\)/gu) ?? []).length, 1,
      `${name} reads the canonical instant exactly once`);
    assert.match(BODY[name], /FROM public\.shared_worlds w WHERE w\.id = (?:p_world_id|target_world) FOR UPDATE/u,
      `${name} locks the exact World row first`);
    // Selective history changes nothing else.
    for (const coupled of [
      'INSERT INTO public.shared_world_membership_episodes', 'UPDATE public.shared_world_membership_episodes',
      'INSERT INTO public.shared_worlds', 'UPDATE public.shared_worlds',
      'public.shared_world_member_invitations',
      'INSERT INTO public.shared_world_governance_proposals', 'INSERT INTO public.shared_world_governance_approvals',
      'INSERT INTO public.shared_world_membership_snapshot',
      'public.shared_world_standing_context_grants', 'public.shared_world_standing_context_grant_audience',
      'public.shared_world_standing_context_consent_events', 'public.shared_world_settings_state',
    ]) assert.ok(!BODY[name].includes(coupled), `${name} never performs: ${coupled}`);
    for (const absent of ['READ_ONLY_CLOSED', 'closed_at', 'WORLD_ENDED', 'CLOSED_WORLD_VIEW_ENTITLEMENT']) {
      assert.ok(!BODY[name].includes(absent), `${name} writes no closure literal: 0088 owns closure`);
    }
  }
  for (const phrase of [
    'I-04F: PUBLIC must not execute the selective history surface before the launch gate exists',
    'I-04F: % must not execute the selective history surface before the launch gate exists',
    'I-04F: % must be SECURITY DEFINER',
    'I-04F: % must pin an empty search_path',
    'I-04F: % must lock the exact World row',
    'I-04F: % must read the canonical instant exactly once',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0087 refuses to deploy without: ${phrase}`);
  for (const name of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
});

test('no primitive accepts an authority, topology, availability, count or clock parameter', () => {
  assert.deepEqual(parameters(APPROVE_FN), ['p_approval_id', 'p_manifest_version_id'],
    'the approval accepts two opaque identities and derives its human from the session');
  assert.deepEqual(parameters(GRANT_FN),
    ['p_command_id', 'p_manifest_version_id', 'p_history_access_grant_id', 'p_history_granted_event_id'],
    'the grant commit accepts four opaque identities and no actor at all');
  for (const name of MUTATION_FUNCTIONS) {
    for (const parameter of parameters(name)) {
      assert.doesNotMatch(parameter, /initiator|proposer|actor|owner|admin|approver|approval_set|member_ids|episode|availability|revision|audience|count|launch|gate|timestamp|instant|_at$/u,
        `${name} must not accept ${parameter}: an authority, topology, availability, count or clock parameter`);
    }
    assert.doesNotMatch(signature(name), /DEFAULT/u,
      `${name} declares no defaulted parameter, so a widened list cannot arrive silently`);
  }
  // The approving human is the session subject, and the grant commit has no actor.
  assert.match(BODY[APPROVE_FN], /u uuid := auth\.uid\(\);/u, 'the approver is derived, never supplied');
  assert.doesNotMatch(BODY[GRANT_FN], /auth\.uid/u,
    'the grant commit derives no granting actor: the authority is the completed material-authority set');
  assert.doesNotMatch(BODY[PREPARE_FN], /auth\.uid/u, 'and preparation records no proposer');
  assert.ok(selfAssertions.includes('I-04F: the history grant commit derives no granting actor: the authority is the exact completed material-authority set'));
});

test('material authority survives membership loss, and approving restores no World browsing', () => {
  // The approval requires the exact derived required set and NOT current membership.
  assert.match(BODY[APPROVE_FN], /public\.shared_world_history_package_required_approvers pa[\s\S]{0,200}pa\.approver_user_id = u/u);
  assert.ok(!/e\.user_id = u\b/u.test(BODY[APPROVE_FN]),
    'a former member who still holds the material authority is never refused for not being a member');
  assert.ok(!BODY[APPROVE_FN].includes('INSERT INTO public.shared_world_membership_episodes'),
    'and approving writes no membership episode, so it restores no browsing');
  assert.ok(selfAssertions.includes('I-04F: material authority survives membership loss: the approver must not be required to be a current member'));
  // Preparation and every revalidation bind the GRANTEE exact open episode instead.
  for (const name of [APPROVE_FN, GRANT_FN]) {
    assert.match(BODY[name], /e\.id = manifest\.grantee_membership_episode_id[\s\S]{0,200}e\.ended_at IS NULL/u,
      `${name} revalidates the exact grantee episode, so a leave stales the manifest`);
    assert.match(BODY[name], /i\.availability_revision <> mi\.captured_availability_revision/u,
      `${name} refuses an item whose availability moved after preparation`);
  }
});

test('the canonical lock order is World, then manifest, then the exact items in identity order', () => {
  assert.match(BODY[PREPARE_FN], /ORDER BY i\.id FOR UPDATE/u, 'items are locked in deterministic identity order');
  for (const name of [APPROVE_FN, GRANT_FN]) {
    const world = BODY[name].indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
    const manifest = BODY[name].indexOf('WHERE m.id = p_manifest_version_id FOR UPDATE');
    const items = BODY[name].indexOf('ORDER BY i.id FOR UPDATE');
    assert.ok(world > 0 && manifest > world && items > manifest,
      `${name} locks World, then manifest, then the exact items`);
  }
  const write = BODY[GRANT_FN].indexOf('INSERT INTO public.shared_world_history_access_grants');
  assert.ok(write > BODY[GRANT_FN].indexOf('ORDER BY i.id FOR UPDATE'), 'and only then writes the grant');
  assert.ok(selfAssertions.includes('I-04F: the canonical lock order is World, then manifest, then the exact items, then the write'));
});

test('temporal truth is immutable, and availability is the only future-evolvable item state', () => {
  assert.match(BODY[TRIGGER_FN], /NEW\.occurred_at <> OLD\.occurred_at/u, 'an item time can never be rewritten');
  assert.match(BODY[TRIGGER_FN], /NEW\.world_id <> OLD\.world_id/u, 'nor its World');
  assert.match(BODY[TRIGGER_FN], /NEW\.authority_requirement_mode <> OLD\.authority_requirement_mode/u,
    'nor its authority requirement mode');
  assert.match(BODY[TRIGGER_FN], /NEW\.availability_revision < OLD\.availability_revision/u,
    'and the availability revision never regresses');
  assert.match(BODY[TRIGGER_FN], /NEW\.availability_state IS DISTINCT FROM OLD\.availability_state[\s\S]{0,120}availability_revision <= OLD\.availability_revision/u,
    'a changed availability must carry a new revision');
  assert.match(executableSql, /CREATE TRIGGER shared_world_history_item_immutable_truth\s*\n\s*BEFORE UPDATE ON public\.shared_world_history_items/u);
});

test('owner deletion is TERMINAL: no revision can resurrect or relabel a DELETED_BY_OWNER item', () => {
  assert.match(BODY[TRIGGER_FN],
    /OLD\.availability_state = 'DELETED_BY_OWNER'\s*\n\s*AND \(NEW\.availability_state <> 'DELETED_BY_OWNER'\s*\n\s*OR NEW\.availability_revision <> OLD\.availability_revision\)/u,
    'once owner-deleted, BOTH availability fields this slice owns are frozen exactly as they are');
  assert.match(BODY[TRIGGER_FN], /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u,
    'and the rule fails closed with its own bounded class');
  // Scoped to the two owned fields, NOT a table freeze: a later reviewed slice may
  // still append a column and write it on an owner-deleted item.
  assert.doesNotMatch(BODY[TRIGGER_FN], /RETURN OLD|NEW IS DISTINCT FROM OLD|to_jsonb/u,
    'the terminal rule freezes the two owned availability fields, never the whole row');
  // UNAVAILABLE is deliberately NOT declared terminal: frozen canon does not require it.
  assert.ok(!/OLD\.availability_state = 'UNAVAILABLE'/u.test(BODY[TRIGGER_FN]),
    'an item that is merely UNAVAILABLE may legitimately become available again');
  assert.ok(selfAssertions.includes('I-04F: owner deletion must be terminal: a higher revision may never resurrect or relabel it'));
});

test('the meaning of occurred_at is frozen, and deployed into the catalog rather than only commented', () => {
  assert.match(executableSql, /COMMENT ON COLUMN public\.shared_world_history_items\.occurred_at IS/u,
    'the frozen meaning reaches the catalog, where the slice that later writes this column will read it');
  const comment = executableSql.slice(executableSql.indexOf('COMMENT ON COLUMN public.shared_world_history_items.occurred_at'));
  // The statement is written as adjacent SQL string literals across several lines,
  // which PostgreSQL concatenates into one comment - so assert on the value the
  // catalog will actually hold, not on the source layout.
  const text = (comment.slice(0, comment.indexOf(';')).match(/'((?:[^']|'')*)'/gu) ?? [])
    .map((part) => part.slice(1, -1)).join('');
  assert.match(text, /canonical Shared-World establishment\/commit instant/u,
    'occurred_at is the establishment instant of the history item in this exact World');
  assert.match(text, /only instant history visibility compares against a membership episode/u);
  assert.match(text, /NOT an underlying recalled event time, source-event semantic timestamp or provenance event time/u,
    'and is explicitly not a source or provenance event time');
  assert.match(text, /I-04G material\/provenance/u, 'which belongs to I-04G');
  // The resolver really does compare THAT column against the membership interval.
  assert.match(BODY[RESOLVE_FN], /i\.occurred_at >= e\.joined_at/u);
  assert.ok(selfAssertions.includes('I-04F: occurred_at must carry its frozen Shared-World establishment meaning in the catalog'));
});

test('the visibility resolver is read-only, service-role-only and returns identity and time only', () => {
  assert.match(executableSql, new RegExp(`public\\.${RESOLVE_FN}\\(p_world_id uuid, p_user_id uuid\\)\\s*\\nRETURNS TABLE\\(world_id uuid, history_item_id uuid, occurred_at timestamptz\\)\\s*\\nLANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'),
    'the resolver returns exactly world, item identity and time - never content, never a count');
  assert.doesNotMatch(BODY[RESOLVE_FN], /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'it mutates nothing, locks nothing and trusts no client claim');
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) FROM PUBLIC, anon, authenticated;`, 'u'));
  // Availability dominates every mode.
  assert.match(BODY[RESOLVE_FN], /i\.availability_state = 'AVAILABLE'/u,
    'an unavailable item is never returned, whatever grant exists');
  // A. membership-period visibility: baseline audience AND truthful temporal bounds.
  assert.match(BODY[RESOLVE_FN], /shared_world_history_item_baseline_viewers b[\s\S]{0,200}b\.user_id = p_user_id/u,
    'a membership interval alone is never historical visibility');
  assert.match(BODY[RESOLVE_FN], /i\.occurred_at >= e\.joined_at\s*\n?\s*AND \(e\.ended_at IS NULL OR i\.occurred_at <= e\.ended_at\)/u,
    'the temporal bounds are truthful, so absence never becomes presence');
  // B. explicit grants.
  assert.match(BODY[RESOLVE_FN], /shared_world_history_access_grants g[\s\S]{0,200}g\.grantee_user_id = p_user_id/u,
    'an explicit committed grant contributes exact absence-period or pre-join items');
  // No active-World browsing without a currently open episode.
  assert.match(BODY[RESOLVE_FN], /shared_world_membership_episodes e\s*\n?\s*WHERE e\.world_id = p_world_id AND e\.user_id = p_user_id AND e\.ended_at IS NULL[\s\S]{0,60}RETURN;/u,
    'a human with no open episode gets no active-World browsing, however many old grants they hold');
  // Closed viewing is the 0088 entitlement snapshot, never active membership.
  assert.match(BODY[RESOLVE_FN], /world\.lifecycle = 'READ_ONLY_CLOSED'[\s\S]{0,300}resolve_shared_world_closed_history_visibility_v1\(p_world_id, p_user_id\)/u,
    'the closed branch delegates to the closure slice own entitlement reader');
  // INTRODUCTION is refused, never silently given Standard semantics.
  assert.match(BODY[RESOLVE_FN], /world\.phase <> 'STANDARD'[\s\S]{0,200}SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE/u,
    'Introduction is bounded-unsupported, never silently Standard');
  assert.ok(selfAssertions.includes('I-04F: availability must dominate every visibility mode'));
  assert.ok(selfAssertions.includes('I-04F: service_role must be the only executor of the visibility resolver'));
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0087.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0087/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0087\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0087_shared_world_selective_history_access_v1\.sql/u, 'the README records migration 0087');
  assert.match(readme, /HISTORY_ACCESS_GRANT/u);
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0087 did not create is proven from 0087 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.doesNotMatch(verifier, /c\.column_name ~\*/u,
    'no migration-wide column NAME filter over the live column list: 0087 owns the columns it created, not the vocabulary of every column that follows');
  assert.doesNotMatch(verifier, /c\.data_type IN \('json'/u, 'and no migration-wide column TYPE filter over it either');
  assert.doesNotMatch(verifier, /migrations\.length|readdirSync\(new URL\('\.\.\/migrations/u,
    'and no migration count ceiling: later migrations are not 0087 regressions');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  // The probe builds the representative authorized futures this slice must survive.
  for (const authorized of ['_shared_material', '_availability_writer', '_provenance', '_launch_gates',
    '_introduction_closed_history', 'CREATE INDEX', 'CREATE TRIGGER', '_item_consumer_metadata']) {
    assert.ok(verifier.includes(authorized), `the probe proves a later reviewed ${authorized} is not an 0087 regression`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0087 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated EXECUTE on the grant commit', (text) => text.replace(
        `REVOKE ALL ON FUNCTION public.${GRANT_FN}(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${GRANT_FN}(uuid, uuid, uuid, uuid) TO authenticated;`)],
      ['turns the history item into a material store', (text) => text.replace(
        '    registered_at timestamptz NOT NULL,', '    registered_at timestamptz NOT NULL,\n    body text,')],
      ['adds a generic payload blob to the manifest', (text) => text.replace(
        '    created_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_history_package_manifest_versions_pk',
        '    created_at timestamptz NOT NULL,\n    selection_payload jsonb,\n    CONSTRAINT shared_world_history_package_manifest_versions_pk')],
      ['lets the caller supply the approver set', (text) => text.replace(
        '  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[]',
        '  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[], p_approver_user_ids uuid[] DEFAULT NULL')],
      ['lets the grant commit derive a granting actor', (text) => text.replace(
        'DECLARE\n  committed public.shared_world_history_grant_commands;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_history_grant_commands;')],
      ['requires the approver to be a current member', (text) => text.replace(
        '     WHERE pa.manifest_version_id = manifest.id AND pa.approver_user_id = u\n',
        '     WHERE pa.manifest_version_id = manifest.id AND pa.approver_user_id = u\n'
        + '  ) OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e WHERE e.user_id = u\n')],
      ['lets an approval come from outside the derived required set', (text) => text.replace(
        '        FOREIGN KEY (manifest_version_id, approver_user_id)\n        REFERENCES public.shared_world_history_package_required_approvers\n                   (manifest_version_id, approver_user_id) ON DELETE RESTRICT',
        '        FOREIGN KEY (manifest_version_id)\n        REFERENCES public.shared_world_history_package_manifest_versions (id) ON DELETE RESTRICT')],
      ['lets one human approve twice under two ids', (text) => text.replace(
        '    CONSTRAINT shared_world_history_package_approvals_one_per_approver_key\n        UNIQUE (manifest_version_id, approver_user_id),', '')],
      ['stops binding the grantee exact episode', (text) => text.replace(
        '    grantee_membership_episode_id uuid NOT NULL,\n', '')],
      ['stops refusing a changed availability revision', (text) => text.replace(
        /\n {12}OR i\.availability_revision <> mi\.captured_availability_revision\)/gu, ')')],
      ['lets an unavailable item stay visible', (text) => text.replace(
        "       AND i.availability_state = 'AVAILABLE'\n       AND (EXISTS (", '       AND (EXISTS (')],
      ['gives a closed World active-membership semantics', (text) => text.replace(
        'resolve_shared_world_closed_history_visibility_v1(p_world_id, p_user_id) c;', 'NULL::uuid, NULL::uuid, NULL::timestamptz;')],
      ['lets a history item time be rewritten', (text) => text.replace(
        '     OR NEW.occurred_at <> OLD.occurred_at OR NEW.registered_at <> OLD.registered_at\n', '')],
      ['lets an owner-deleted item be resurrected under a higher revision', (text) => text.replace(
        /  -- OWNER DELETION IS TERMINAL, whatever revision is offered\.\n  IF OLD\.availability_state = 'DELETED_BY_OWNER'\n[\s\S]{0,320}?  END IF;\n/u, '')],
      ['drops the frozen catalog meaning of occurred_at', (text) => text.replace(
        'COMMENT ON COLUMN public.shared_world_history_items.occurred_at IS', '-- removed:')],
      ['closes the World from a history grant', (text) => text.replace(
        '    INSERT INTO public.shared_world_history_granted_events',
        "    UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = manifest.world_id;\n"
        + '    INSERT INTO public.shared_world_history_granted_events')],
      ['adds a grant withdrawal lifecycle', (text) => text.replace(
        '    granted_at timestamptz NOT NULL,', '    granted_at timestamptz NOT NULL,\n    revoked_at timestamptz,')],
      ['grants service_role a direct table privilege', (text) => text.replace(
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`,
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;\nGRANT SELECT ON TABLE public.${ITEMS} TO service_role;`)],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0087`);
      const sql = weakened.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      const body = sql.slice(0, sql.indexOf('DO $$\nDECLARE'));
      const bodies = Object.fromEntries(OWN_FUNCTIONS.map((name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const start = weakened.indexOf('AS $$', create);
        const end = weakened.indexOf('\nEND$$;', start);
        return [name, create < 0 || start < 0 || end < 0 ? '' : weakened.slice(start, end)];
      }));
      const declared = (name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const open = create + `CREATE FUNCTION public.${name}(`.length;
        return weakened.slice(open, weakened.indexOf(') RETURNS', open));
      };
      // Table-scoped, because a column declaration one relation shares with another
      // must be checked on the exact relation that owns the invariant.
      const blockOf = (name) => {
        const start = sql.indexOf(`CREATE TABLE public.${name} (`);
        if (start < 0) return '';
        const end = sql.indexOf('\n);', start);
        return end > start ? sql.slice(start, end) : '';
      };
      const grantLines = sql.split('\n').filter((line) => /\bGRANT\b/u.test(line));
      const caught = [
        () => assert.equal(grantLines.length, 1),
        () => assert.doesNotMatch(body, /^ {4}body text,$/mu),
        () => assert.doesNotMatch(body, /\b(?:json|jsonb)\b/iu),
        () => assert.doesNotMatch(declared(PREPARE_FN), /DEFAULT|approver/u),
        () => assert.doesNotMatch(bodies[GRANT_FN], /auth\.uid/u),
        () => assert.ok(!/e\.user_id = u\b/u.test(bodies[APPROVE_FN])),
        () => assert.match(body, /REFERENCES public\.shared_world_history_package_required_approvers/u),
        () => assert.match(body, /UNIQUE \(manifest_version_id, approver_user_id\)/u),
        () => assert.match(blockOf(MANIFESTS), /^ {4}grantee_membership_episode_id uuid NOT NULL,$/mu),
        () => assert.match(bodies[GRANT_FN], /i\.availability_revision <> mi\.captured_availability_revision/u),
        () => assert.match(bodies[RESOLVE_FN], /i\.availability_state = 'AVAILABLE'/u),
        () => assert.match(bodies[RESOLVE_FN], /resolve_shared_world_closed_history_visibility_v1/u),
        () => assert.match(bodies[TRIGGER_FN], /NEW\.occurred_at <> OLD\.occurred_at/u),
        () => assert.match(bodies[TRIGGER_FN], /SHARED_WORLD_HISTORY_OWNER_DELETION_TERMINAL/u),
        () => assert.match(sql, /COMMENT ON COLUMN public\.shared_world_history_items\.occurred_at IS/u),
        () => assert.ok(!bodies[GRANT_FN].includes('UPDATE public.shared_worlds')),
        () => assert.doesNotMatch(body, /revoked_at/u),
        () => assert.ok(!grantLines.some((line) => /GRANT [A-Z]+ ON TABLE/u.test(line))),
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
  const mirror = createHarnessMirror('qandeel-i04f-history-');
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

test('the I-04G material store, a later Introduction consumer and a Launch Gate leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    t.after(() => removeHarnessMirror(mirror));
    try {
      write(mirror, 'database/migrations/0089_shared_world_material_and_introduction_history_v1.sql',
        '-- A later reviewed slice: the I-04G material store bound to the history item identity,\n'
        + '-- a reviewed availability writer, a provenance relation, an Introduction closed-history\n'
        + '-- consumer, a Launch Gate and later additive history metadata.\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.shared_world_material (id uuid PRIMARY KEY, history_item_id uuid NOT NULL\n'
        + '  REFERENCES public.shared_world_history_items (id) ON DELETE RESTRICT, body text, audio_url text);\n'
        + 'CREATE TABLE public.shared_world_material_provenance (id uuid PRIMARY KEY, material_id uuid\n'
        + '  REFERENCES public.shared_world_material (id) ON DELETE SET NULL);\n'
        + 'ALTER TABLE public.shared_world_history_items ADD COLUMN consumer_metadata jsonb;\n'
        + 'ALTER TABLE public.shared_world_history_items ADD COLUMN material_class text;\n'
        + 'CREATE INDEX shared_world_history_items_availability_idx\n'
        + '  ON public.shared_world_history_items (world_id, availability_state);\n'
        + 'CREATE TABLE public.shared_world_introduction_closed_history (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL);\n'
        + 'CREATE FUNCTION public.owner_delete_shared_material_v1(p_item_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + '  UPDATE public.shared_world_history_items i\n'
        + "     SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1\n"
        + '   WHERE i.id = p_item_id;\n'
        + 'END$fn$;\n'
        + 'CREATE FUNCTION public.grant_shared_world_history_gated_v1(p_command_id uuid, p_manifest_id uuid,\n'
        + '  p_grant_id uuid, p_event_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + `BEGIN\n  PERFORM 1 FROM public.${GRANT_FN}(p_command_id, p_manifest_id, p_grant_id, p_event_id);\nEND$fn$;\n`
        + 'GRANT EXECUTE ON FUNCTION public.grant_shared_world_history_gated_v1(uuid, uuid, uuid, uuid) TO authenticated;\n'
        + 'CREATE FUNCTION public.shared_world_history_audit_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NULL; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_history_items_audit AFTER INSERT ON public.shared_world_history_items\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_history_audit_v1();\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0089.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-material-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'the I-04G material store bound to the history item identity, a reviewed owner-delete availability writer, '
        + 'a provenance relation, later additive history columns, an Introduction closed-history consumer, a Launch Gate, '
        + 'a gated wrapper, a later index, a later audit trigger and migration 0089 must all leave this contract passing');

      const regressions = [
        ['0087 itself grants EXECUTE to an application role', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid[]) TO authenticated;`)],
        ['a frozen predecessor migration is edited', () => patch(mirror, 'database/migrations/0084_shared_world_governance_approval_foundation_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0087 turns the history item into a material store', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '    registered_at timestamptz NOT NULL,', '    registered_at timestamptz NOT NULL,\n    transcript text,')],
        ['0087 alters a predecessor table', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'CREATE TABLE public.shared_world_history_items (',
          'ALTER TABLE public.shared_world_governance_proposals ADD COLUMN history_note text;\nCREATE TABLE public.shared_world_history_items (')],
        ['0087 lets the caller supply the derived approver set', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[]\n)',
          '  p_manifest_version_id uuid, p_world_id uuid, p_grantee_user_id uuid, p_history_item_ids uuid[],\n  p_approver_user_ids uuid[] DEFAULT NULL\n)')],
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
