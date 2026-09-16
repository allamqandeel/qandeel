// I-06C - Replay Distribution Package and Distribution Authority: the
// secret-free structural contract for migration 0104.
//
// Live semantics - what a package refuses, who may approve, what a distribution
// revalidates, the race matrix - are proven by database/verify-migration-0104.mjs
// and database/verify-migration-0105.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that a
// package binds ONE exact historically FINALIZED Replay Version of ONE exact
// Replay; that the destination is part of package identity and every field is
// immutable; that unresolved authority is UNREPRESENTABLE rather than refused;
// that an approval outside the derived required set cannot exist; that the
// sanitized export descriptor is a positive allowlist with no private identifier
// class and no JSON escape hatch; that the Public REPLAY_ARTIFACT seam is
// activated narrowly through composite keys and carries no private source
// pointer; and that an authorization records authorization rather than a
// delivery no transport performed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0104_replay_distribution_package_authority_v1.sql';
const PREDECESSOR_NAME = '0103_replay_preview_finalization_runtime_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0104.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const OWN_TABLES = ['replay_distribution_package_versions', 'replay_distribution_required_approvers',
  'replay_distribution_approvals', 'replay_distribution_approval_withdrawal_events',
  'replay_distribution_export_descriptors', 'replay_public_distribution_artifacts',
  'replay_distribution_authorizations'];
/** The frozen relations 0104 may touch, and ONLY to add a candidate key. */
const ALTERED_PREDECESSORS = ['replay_version_finalizations', 'replay_versions',
  'publication_package_manifest_items', 'publication_package_item_provenance'];
const OWN_SCRIPT = 'verify:replay-distribution-package-authority:integration';
const PART_B_SCRIPT = 'verify:replay-distribution-runtime-export-public-bridge:integration';

const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0104 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
/** The declared columns of one relation this migration creates. */
const columnsOf = (table) => [...tableBlock(table).matchAll(/^\s{4}(\w+)\s+(uuid|text|integer|bigint|boolean|timestamptz|jsonb|json|bytea)\b/gmu)]
  .map((m) => ({ name: m[1], type: m[2] }));

test('0104 is the forward migration after 0103, the frozen I-06B predecessors are byte-identical, and nothing is rewritten', async () => {
  const { I06B_FROZEN } = await import('./replay-distribution-frozen-predecessors.mjs');
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0104_')).length, 1, 'exactly one migration carries the 0104 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf(PREDECESSOR_NAME));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of I06B_FROZEN) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0104 drops nothing');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE FUNCTION/u, '0104 replaces no predecessor function');
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0104 creates only its own relations, not ${created}`);
  }
  // A FROZEN RELATION IS TOUCHED ONLY TO ADD A CANDIDATE KEY, and only these four.
  for (const match of executableSql.matchAll(/ALTER TABLE public\.(\w+)\n?\s*(ADD CONSTRAINT|OWNER TO|ENABLE ROW)/gu)) {
    const [, table, action] = match;
    if (OWN_TABLES.includes(table)) continue;
    assert.ok(ALTERED_PREDECESSORS.includes(table),
      `0104 alters no predecessor relation but the four it adds a candidate key to, not ${table}`);
    assert.equal(action, 'ADD CONSTRAINT', `0104 only ADDs a constraint to ${table}`);
  }
  for (const table of ALTERED_PREDECESSORS) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table}\\s*\\n?\\s*ADD CONSTRAINT \\w+\\s*\\n?\\s*UNIQUE`, 'u'),
      `the additive candidate key on ${table} is a UNIQUE constraint and nothing else`);
  }
});

test('a package binds ONE exact historically finalized Replay Version of ONE exact Replay', () => {
  const block = tableBlock('replay_distribution_package_versions');
  // Historical finalization, as ONE row of the append-only evidence.
  assert.match(block, /FOREIGN KEY \(replay_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_version_finalizations \(replay_version_id, replay_id\) ON DELETE RESTRICT/u,
    'the package binds the EXACT finalization evidence of its exact version and Replay');
  // The exact complete version and its own manifest, as ONE row.
  assert.match(block, /FOREIGN KEY \(replay_version_id, replay_id, source_manifest_version_id\)\s*\n\s*REFERENCES public\.replay_versions \(id, replay_id, source_manifest_version_id\)/u,
    'and the exact Replay Version composition');
  // The source class is READ from the manifest, never declared.
  assert.match(block, /FOREIGN KEY \(source_manifest_version_id, source_class\)\s*\n\s*REFERENCES public\.replay_source_manifest_versions \(id, source_class\)/u);
  assert.match(block, /CHECK \(source_class = 'MY_WORLD'\)/u,
    'and it is pinned to the ONE class a complete Replay Version can carry at this baseline');
  // NEVER a current lifecycle: I-06B legitimately reopens a finalized Replay.
  assert.ok(!columnsOf('replay_distribution_package_versions').some((c) => /lifecycle/u.test(c.name)),
    'a package carries no Replay lifecycle at all');
  assert.ok(!installedSql.includes('current_lifecycle'),
    '0104 never reads the stable Replay current lifecycle to decide distributability');
});

test('the destination is part of package identity, and every field of a package is immutable', () => {
  const block = tableBlock('replay_distribution_package_versions');
  assert.match(block, /CHECK \(destination_action IN \('PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'DOWNLOAD'\)\)/u);
  assert.ok(!block.includes('PREPARE'), 'preparing is not a destination a package may hold');
  assert.match(block, /UNIQUE \(id, destination_action\)/u,
    'an approval can bind the package AND its destination as ONE row');
  // Append-only for every role INCLUDING the owner, by BEFORE trigger.
  for (const table of OWN_TABLES) {
    assert.match(installedSql, new RegExp(`CREATE TRIGGER ${table}_immutable\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${table}`, 'u'),
      `${table} is append-only for every role`);
  }
  assert.match(installedSql, /RAISE EXCEPTION 'REPLAY_DISTRIBUTION_IS_IMMUTABLE'/u);
});

test('unresolved authority is UNREPRESENTABLE inside a package, on both halves and on the union', () => {
  const block = tableBlock('replay_distribution_package_versions');
  for (const column of ['authority_requirement_state', 'source_authority_resolution',
    'analytical_authority_resolution']) {
    const check = new RegExp(`CHECK \\(${column} IN \\('RESOLVED_EXACT_HUMAN_REQUIREMENT',\\s*\\n?\\s*'RESOLVED_NO_HUMAN_REQUIREMENT'\\)\\)`, 'u');
    assert.match(block, check, `${column} admits only the two RESOLVED states`);
  }
  assert.ok(!block.includes('UNRESOLVED'),
    'no column of a package may hold an unresolved authority state at all');
  // The state and the count agree in BOTH directions, and the union is EXACT
  // whenever either half is.
  assert.match(block, /required_approver_count > 0/u);
  assert.match(block, /required_approver_count = 0/u);
  assert.match(block, /_union_check\s*\n?\s*CHECK \(authority_requirement_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'/u);
});

test('the audience-safe reference is opaque, in its own shape, and cannot be an internal identity', () => {
  const block = tableBlock('replay_distribution_package_versions');
  const [reference] = columnsOf('replay_distribution_package_versions').filter((c) => c.name === 'audience_safe_reference');
  assert.equal(reference.type, 'text',
    'the audience reference is TEXT, structurally distinct from every internal uuid identity');
  assert.match(block, /CHECK \(audience_safe_reference ~ '\^rdx1_\[0-9a-f\]\{32\}\$'\)/u);
  assert.match(installedSql, /CREATE TRIGGER replay_distribution_package_versions_opaque_reference\n\s*BEFORE INSERT ON public\.replay_distribution_package_versions/u,
    'and a guard refuses a reference that reproduces an internal identity of its own row');
  assert.match(installedSql, /REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE/u);
  // The guard reads the row's OWN columns and nothing else.
  const guard = installedSql.slice(installedSql.indexOf('replay_distribution_audience_reference_v1()'));
  for (const column of ['NEW.id', 'NEW.replay_id', 'NEW.replay_version_id', 'NEW.source_manifest_version_id']) {
    assert.ok(guard.includes(column), `the opacity guard compares ${column}`);
  }
});

test('an approval is structurally impossible outside the derived required set and its exact destination', () => {
  const block = tableBlock('replay_distribution_approvals');
  assert.match(block, /FOREIGN KEY \(distribution_package_version_id, approver_user_id\)\s*\n\s*REFERENCES public\.replay_distribution_required_approvers/u,
    'an approval binds the DERIVED required set by composite foreign key');
  assert.match(block, /FOREIGN KEY \(distribution_package_version_id, destination_action\)\s*\n\s*REFERENCES public\.replay_distribution_package_versions \(id, destination_action\)/u,
    'and the exact package AND destination as one row');
  assert.match(block, /UNIQUE \(distribution_package_version_id, approver_user_id\)/u,
    'one effective approval per human per package');
  assert.match(block, /UNIQUE \(id, distribution_package_version_id, approver_user_id\)/u,
    'and an exact identity key a withdrawal can bind');
  // The withdrawal binds ONE approval through ONE composite key, never two
  // independent partial ones.
  const withdrawal = tableBlock('replay_distribution_approval_withdrawal_events');
  assert.match(withdrawal, /FOREIGN KEY \(approval_id, distribution_package_version_id, approver_user_id\)\s*\n\s*REFERENCES public\.replay_distribution_approvals \(id, distribution_package_version_id, approver_user_id\)/u);
  assert.match(withdrawal, /UNIQUE \(approval_id\)/u, 'one effective withdrawal per approval, forever');
  assert.equal((withdrawal.match(/FOREIGN KEY/gu) ?? []).length, 1,
    'and exactly one foreign key into the immutable evidence');
});

test('EXPORT_PRIVACY_SANITIZATION is a positive allowlist with no private identifier and no payload column', () => {
  const columns = columnsOf('replay_distribution_export_descriptors');
  assert.ok(columns.length >= 18, 'the sanitized surface declares its columns explicitly');
  const FORBIDDEN = /(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|user_id|approver|participant|captured_|manifest_version|selection_spec|projection_version|render_contract|experience|package_item|replay_id|replay_version|provenance_|source_id|source_ref|url|uri|path|filename|object_key|bucket|storage|credential|audio|transcript|body)/u;
  for (const column of columns) {
    assert.doesNotMatch(column.name, FORBIDDEN,
      `the audience-visible relation may not carry ${column.name}`);
    assert.ok(!['json', 'jsonb', 'bytea'].includes(column.type),
      `${column.name} may not be an untyped payload column a client could fill`);
  }
  // Every policy is the exact versioned value the frozen 0102 render contract pins.
  const block = tableBlock('replay_distribution_export_descriptors');
  for (const value of ['ORIGINAL_TEXT_ONLY', 'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT',
    'WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', 'PRESENTATION_PACING_DECLARED',
    'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
    'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION']) {
    assert.ok(block.includes(value), `the sanitized surface pins the exact policy ${value}`);
  }
  // And it binds its exact package, destination and own reference as ONE row.
  assert.match(block, /FOREIGN KEY \(distribution_package_version_id, destination_action, audience_safe_reference\)\s*\n\s*REFERENCES public\.replay_distribution_package_versions \(id, destination_action, audience_safe_reference\)/u);
});

test('the Public REPLAY_ARTIFACT seam is activated narrowly, with no generic pointer and no private source', () => {
  const block = tableBlock('replay_public_distribution_artifacts');
  assert.match(block, /CHECK \(public_body_form = 'RESERVED'\)/u);
  assert.match(block, /CHECK \(public_source_class = 'REPLAY_ARTIFACT'\)/u);
  assert.match(block, /CHECK \(destination_action = 'PUBLISH_TO_PUBLIC_WORLD'\)/u);
  assert.match(block, /FOREIGN KEY \(public_manifest_version_id, package_item_id, public_body_form\)\s*\n\s*REFERENCES public\.publication_package_manifest_items/u,
    'the exact Public item, its manifest and its RESERVED form as ONE row');
  assert.match(block, /FOREIGN KEY \(package_item_id, public_source_class\)\s*\n\s*REFERENCES public\.publication_package_item_provenance \(package_item_id, source_class\)/u,
    'and that item own sealed provenance row, classed exactly REPLAY_ARTIFACT');
  assert.match(block, /FOREIGN KEY \(distribution_package_version_id, destination_action, replay_version_id,\s*\n\s*audience_safe_reference\)/u,
    'and the exact Replay distribution package, destination, Replay Version and audience reference');
  assert.match(block, /UNIQUE \(distribution_package_version_id\)/u,
    'one Replay distribution package corresponds to at most ONE Public artifact');
  for (const column of columnsOf('replay_public_distribution_artifacts')) {
    assert.doesNotMatch(column.name, /(session|conversation_unit|shared_|material|history_item|owner_user|user_id|source_manifest|selection_spec|projection_version|render_contract|url|uri|path)/u,
      `the Public bridge may carry no private source identifier: ${column.name}`);
  }
  assert.ok(!block.includes('artifact_id'), 'there is no generic artifact pointer');
});

test('an authorization records AUTHORIZATION, never a delivery, and never a fabricated clearance', () => {
  const block = tableBlock('replay_distribution_authorizations');
  assert.match(block, /distribution_state = 'PUBLIC_PUBLICATION_COMMITTED'/u);
  assert.equal((block.match(/distribution_state = 'AUTHORIZED_FOR_DELIVERY'/gu) ?? []).length, 2,
    'both transport-free destinations reach AUTHORIZED_FOR_DELIVERY and nothing more');
  for (const claim of ['DELIVERED', 'SHARED', 'DOWNLOADED']) {
    assert.ok(!block.includes(`'${claim}'`), `no state may claim ${claim} without a transport boundary`);
  }
  for (const column of columnsOf('replay_distribution_authorizations')) {
    assert.doesNotMatch(column.name, /(delivered|downloaded|sent_at|recipient|endpoint|url|uri|path|filename|object_key|bucket|storage|codec|bitrate|cdn|watermark)/u,
      `no column may record a delivery or a transport: ${column.name}`);
  }
  // EVERY APPLICABLE CW2-08 DIMENSION CLEARED, or no row exists at all.
  assert.match(block, /safety_state = 'SAFETY_ALLOW' AND moderation_state = 'MODERATION_ALLOW'/u);
  assert.match(block, /entitlement_state = 'ENTITLED' AND feature_state = 'FEATURE_ENABLED'/u);
  assert.match(block, /launch_state = 'LAUNCH_CLEARED'/u);
  // And a Public publish BINDS the canonical publication record rather than restating it.
  assert.match(block, /FOREIGN KEY \(published_experience_version_id\)\s*\n\s*REFERENCES public\.public_experience_publication_state \(published_experience_version_id\)/u);
  assert.ok(!columnsOf('replay_distribution_authorizations').some((c) => /visib|published_at|ordinal/u.test(c.name)),
    'and it restates no Public publication truth of its own');
});

test('every I-06C relation is postgres-owned, RLS-enabled with zero policies and revoked from every application role', () => {
  for (const table of OWN_TABLES) {
    assert.ok(installedSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`), `${table} is postgres-owned`);
    assert.ok(installedSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`), `${table} enables RLS`);
    assert.ok(installedSql.includes(`public.${table}`), `${table} appears in the REVOKE list`);
  }
  assert.match(installedSql, /REVOKE ALL ON TABLE public\.replay_distribution_package_versions,[\s\S]*?FROM PUBLIC, anon, authenticated;/u);
  assert.match(installedSql, /FROM service_role'/u, 'and from service_role where that role exists');
  assert.doesNotMatch(installedSql, /CREATE POLICY/u, 'no relation carries a policy');
  assert.doesNotMatch(installedSql, /GRANT (SELECT|INSERT|UPDATE|DELETE)/u, '0104 grants no table privilege');
  // PART A CREATES NO WRITER.
  const created = [...installedSql.matchAll(/CREATE FUNCTION public\.(\w+)\(\)/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(),
    ['reject_replay_distribution_mutation_v1', 'replay_distribution_audience_reference_v1'],
    'PART A owns exactly two functions, and both are trigger functions');
  assert.equal((installedSql.match(/RETURNS trigger/gu) ?? []).length, 2);
});

test('the 0104 self-assertions refuse a migration that lost any of this, and ban nothing the roadmap needs', () => {
  for (const anchor of ['_finalized_fk', '_version_fk', 'lifecycle', 'UNRESOLVED',
    'required_approver_count > 0', '_class_fk', 'rdx1_', '_opaque_reference',
    'replay_distribution_approvals_required_fk', 'replay_distribution_approvals_destination_fk',
    'AUTHORIZED_FOR_DELIVERY', 'SAFETY_ALLOW', 'REPLAY_ARTIFACT', 'RESERVED', 'NOT_EVALUATED']) {
    assert.ok(selfAssertions.includes(anchor), `the self-assertions check ${anchor}`);
  }
  // FORWARD SAFETY: nothing here forbids a later reviewed I-06D relation, a media
  // provider, a Safety runtime or a Shared / Public analytical capability from
  // existing ANYWHERE. Every ban is scoped to the relations this migration owns.
  assert.ok(!/relname ~|pg_class c JOIN pg_namespace/u.test(selfAssertions),
    'no assertion is a census of the whole database');
  for (const roadmap of ['source_loss', 'recall', 'i06d', 'media_provider']) {
    assert.ok(!selfAssertions.toLowerCase().includes(roadmap),
      `the self-assertions never forbid ${roadmap} anywhere in the database`);
  }
  assert.match(selfAssertions, /FOREACH t IN ARRAY own_tables LOOP/u,
    'and every column ban is applied to the relations this migration owns');
});

test('0104 is registered in the toolchain, the focused gate, the I-06C CI group, the README and the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0104\\.mjs"`, 'u'));
  assert.match(readme, /0104_replay_distribution_package_authority_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0104/iu);
  const groups = JSON.parse(focused).groups;
  assert.ok(groups['i06c-0104'], 'the focused gate can select 0104 alone');
  assert.deepEqual(groups['i06c-all'].verifiers,
    ['database/verify-migration-0104.mjs', 'database/verify-migration-0105.mjs']);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0104=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_B_SCRIPT}; then result_0105=PASS; else status=1; fi`),
    'both I-06C verifiers run, and one failing never silently skips the other');
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06C Replay distribution'));
  const body = step.slice(0, step.indexOf('\n      - '));
  assert.ok(body.includes('exit "$status"'), 'the grouped I-06C step fails the job when either verifier failed');
  assert.ok(body.indexOf(OWN_SCRIPT) < body.indexOf(PART_B_SCRIPT), '0104 is reported before 0105');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
  assert.ok(doc.includes('I-06C'), 'the phase document records the slice');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and never claims I-06 is closed');
});

test('the 0104 verifier RUNS the scenarios it claims, through the permanent aggregator', () => {
  for (const scenario of [
    'D01 a package binds the exact historical finalization evidence of its exact version',
    'D02 a Replay Version that was never finalized cannot be bound at all',
    'D03 a package cannot pair one Replay with another Replay version',
    'D04 reopening a Replay to DRAFT leaves the old version historically finalized',
    'D05 a package and its destination are immutable for every role',
    'D06 unresolved authority is unrepresentable on both halves and on the union',
    'D07 an exact human requirement can never be recorded as an empty approver set',
    'D08 an audience reference that reproduces an internal identity is unrepresentable',
    'D09 an approval by a human the package does not require is structurally impossible',
    'D10 an approval for one destination cannot resolve against another',
    'D11 a withdrawal names ONE exact approval through one composite key',
    'D13 a sanitized descriptor cannot move to another package or destination',
    'D14 the Public bridge binds the exact item its RESERVED form and its REPLAY_ARTIFACT provenance',
    'D15 one Public package item binds exactly ONE Replay distribution package',
    'D16 an authorization records authorization and never a delivery',
    'D17 an authorization cannot exist with an unevaluated CW2-08 dimension',
    'D18 every I-06C relation is append-only for every role including the owner',
    'D19 no application role holds any privilege on any I-06C relation',
    'f1 the opacity guard is what refuses an internal identity in disguise',
    'f2 the append-only guard is what refuses a mutation by the table owner',
    'f3 the catalog check refuses a tree whose finalization binding was dropped',
  ]) {
    assert.ok(verifier.includes(`report.isolated('${scenario}'`),
      `the 0104 verifier RUNS the scenario: ${scenario}`);
  }
  assert.match(verifier, /createScenarioReport/u, 'the verifier reports scenarios independently');
  assert.match(verifier, /assertAllPassed\(\)/u, 'and fails once at the end, naming every scenario that failed');
  assert.ok(verifier.indexOf('createScenarioReport') < verifier.indexOf("stage('catalog')"),
    'the report exists before the first catalog check, so a catalog defect does not stop the run');
  // BOTH HALVES of every weakening are proven: a one-sided probe cannot tell a
  // guard that fires from a foreign key that would have refused anyway.
  assert.ok(verifier.includes('assert.notEqual(weakened, guard.definition'),
    'the opacity weakening is proven to have landed');
  assert.ok(verifier.includes('assert.notEqual(weakened, mutation.definition'),
    'and so is the append-only weakening');
  assert.ok(verifier.includes('is load-bearing'), 'and each weakening proves the guard was load-bearing');
});
