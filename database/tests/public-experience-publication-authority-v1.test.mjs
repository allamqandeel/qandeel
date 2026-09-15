// I-05A - Public Experience Publication Package and Authority v1: the
// secret-free structural contract for migration 0092.
//
// Live semantics - real ACLs, real immutability, the derived rightsholder set,
// the fail-closed source authority and forward safety - are proven by
// database/verify-migration-0092.mjs against real PostgreSQL. What is proven HERE
// is the structure a migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-05A PART B: that THIS slice created the
// immutable publication package - its manifest, its exact item set, the bounded
// PUBLIC derivative, the SEALED internal provenance, the per-item authority
// resolution, the derived content rightsholder set and the manifest-bound
// approvals - and nothing beyond it. No writer, no public serving, no semantic
// placement, no discussion, no Replay producer, no media storage provider, no
// Safety, Launch or entitlement decision.
//
// It deliberately does NOT prove that a later reviewed semantic placement table,
// public discussion, Public QANDEEL producer, search or vitality projection,
// owner-deletion writer, Replay source adapter, launch wrapper or additive
// column, index or audit trigger may never appear. Every assertion is scoped to
// migration 0092 itself and to the frozen predecessors it was required not to
// modify. Migrations 0091 and 0093 are deliberately NOT content-pinned: they are
// this slice's own siblings and pinning a sibling pins a hash that is still
// moving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0092_public_experience_publication_package_authority_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0092.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.indexOf('DO $$\nDECLARE');
const deployableSql = executableSql.slice(0, SELF_ASSERT_START);
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const MANIFESTS = 'publication_package_manifest_versions';
const ITEMS = 'publication_package_manifest_items';
const BODIES = 'public_experience_text_derivative_bodies';
const PROVENANCE = 'publication_package_item_provenance';
const ITEM_AUTHORITY = 'publication_package_item_authority';
const REQUIRED = 'publication_manifest_required_approvers';
const APPROVALS = 'publication_manifest_approvals';
const OWN_TABLES = [MANIFESTS, ITEMS, BODIES, PROVENANCE, ITEM_AUTHORITY, REQUIRED, APPROVALS];
/** The two relations whose columns a PUBLIC audience may one day see. */
const PUBLIC_FACING = [ITEMS, BODIES];

const OWN_SCRIPT = 'verify:public-experience-publication-authority:integration';

/** The three frozen source classes (CW2-01 section 28, CW2-04 section 5). */
const SOURCE_CLASSES = ['MY_WORLD', 'SHARED_WORLD', 'REPLAY_ARTIFACT'];
/** The two frozen derivative classes (CW2-02 section 27 / B20). */
const DERIVATIVE_CLASSES = ['SOURCE_CONTENT_BEARING_DERIVATIVE', 'ANALYTICAL_DERIVATIVE'];
/** The canonical availability vocabulary, in parity with the merged I-01A kernel. */
const AVAILABILITY = ['AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE'];

const PINNED_PREDECESSORS = [
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0088_shared_world_standard_closure_v1.sql', 'dff71de8fbfc2f834d2d267949359d2ebbd3effe'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
  // The canonical durable Personal source I-05A binds: the committed
  // Conversational Unit substrate and the session position added to it.
  ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
  ['0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
];

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0092 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
const columnNames = (name) => tableBlock(name).split('\n')
  .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line))
  .map((line) => line.trim().split(/\s+/u)[0]);

// ---------------------------------------------------------------------------

test('0092 is the forward migration after 0091, and every frozen Shared and Personal predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0092_')).length, 1, 'exactly one migration carries the 0092 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0091_public_world_experience_identity_foundation_v1.sql'),
    '0092 orders after the Public foundation it binds to');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob,
      `${name} is byte-identical: I-05A consumes this source truth and reopens none of it`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+public\.\w+\s+(?:RENAME|DROP)\b/iu);
});

test('0092 alters exactly one table, its own sibling, and only to add one binding', () => {
  const alters = [...deployableSql.matchAll(/^ALTER TABLE public\.(\w+)\n?\s*ADD CONSTRAINT (\w+)/gmu)]
    .map((m) => [m[1], m[2]]);
  assert.deepEqual(alters, [['public_experience_versions', 'public_experience_versions_manifest_fk']],
    'the ONE structural addition is the bijective manifest binding on the version relation migration 0091 created');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no table gains a column');
  assert.doesNotMatch(deployableSql, /INSERT INTO|UPDATE public\.\w+\s+SET|DELETE FROM/iu,
    '0092 writes nothing: every writer is migration 0093');
  const created = [...executableSql.matchAll(/^CREATE FUNCTION public\.(\w+)/gmu)].map((m) => m[1]);
  assert.deepEqual(created, ['reject_publication_package_mutation_v1'],
    'the ONE function PART B owns is the append-only trigger function');
});

test('a manifest is immutable, non-empty, and binds exactly one Experience, publisher and audience', () => {
  const manifest = tableBlock(MANIFESTS);
  assert.match(manifest, /CHECK \(item_count > 0\)/u, 'a package is never empty');
  // FIX-B. The manifest binds the PROTECTED ACTION the rightsholders consent to,
  // which is the frozen audience-expansion action - never the command that is
  // being executed now. Preparing a package is explicitly not audience expansion,
  // so `PREPARE_PUBLICATION` is not a value this column may hold, and a frozen
  // authority decision may not be replayed for a different action (CW2-02 B6).
  assert.match(manifest, /intended_publication_action text NOT NULL,/u);
  assert.match(manifest, /CHECK \(intended_publication_action = 'PUBLISH_TO_PUBLIC_WORLD'\)/u);
  assert.ok(!tableBlock(MANIFESTS).includes('PREPARE_PUBLICATION'),
    'a manifest can never intend the preparation command as its protected action');
  assert.match(manifest, /CHECK \(target_audience_class = 'PUBLIC_WORLD_AUDIENCE'\)/u);
  assert.match(manifest, /CHECK \(authority_readiness = 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY'\)/u,
    'I-05A proves PRIVACY and OWNERSHIP readiness only');
  assert.match(manifest, /CHECK \(public_world_singleton\)/u);
  assert.match(manifest,
    /FOREIGN KEY \(publisher_public_identity_ref, publisher_user_id\)\s*\n\s*REFERENCES public\.public_identities \(public_identity_ref, user_id\)/u,
    'a manifest can never attribute one human public identity to another human account');
  assert.doesNotMatch(manifest, /jsonb|json\b/iu, 'there is no manifest JSON blob and no generic payload column');
  // Every package relation is append-only for every role, the table owner included.
  for (const table of OWN_TABLES) {
    assert.ok(executableSql.includes(
      `BEFORE UPDATE OR DELETE ON public.${table}`), `${table} is append-only: a changed payload is a NEW manifest`);
  }
  assert.match(executableSql, /RAISE EXCEPTION 'PUBLICATION_PACKAGE_IS_IMMUTABLE'/u);
});

test('the manifest and its Experience Version are bijective and describe the same Experience', () => {
  assert.match(deployableSql,
    /FOREIGN KEY \(package_manifest_version_id, experience_id\)\s*\n\s*REFERENCES public\.publication_package_manifest_versions \(id, experience_id\) ON DELETE RESTRICT/u);
  assert.match(tableBlock(MANIFESTS), /UNIQUE \(id, experience_id\)/u);
  assert.match(selfAssertions, /a manifest and its Experience Version must be bijective and same-Experience/u);
});

test('a public-facing relation carries the payload and NO route back to its source', () => {
  for (const table of PUBLIC_FACING) {
    for (const column of columnNames(table)) {
      assert.doesNotMatch(column,
        /session|turn|conversation_unit|world_id|shared_|material_id|history_item|source_id|owner_user|audio_object|transcript|context_ref/u,
        `${table}.${column} would be a source identifier in a public row`);
    }
    const refs = [...tableBlock(table).matchAll(/REFERENCES public\.(\w+)/gu)].map((m) => m[1]);
    for (const ref of refs) {
      assert.ok([MANIFESTS, ITEMS].includes(ref),
        `${table} references ${ref}: a public-serving relation may reference nothing outside its own package`);
    }
  }
  // The public body is a SNAPSHOT: its own bytes, in its own row.
  assert.match(tableBlock(BODIES), /public_text_body text NOT NULL,/u);
  assert.match(tableBlock(BODIES), /CHECK \(length\(btrim\(public_text_body\)\) > 0\)/u);
  assert.doesNotMatch(tableBlock(BODIES), /<= \d+\)/u,
    'no invented Product copy limit: no frozen contract states one');
  // The kind-to-body binding is structural, exactly as migration 0089 does it.
  assert.match(tableBlock(ITEMS), /UNIQUE \(package_item_id, public_body_form\)/u);
  assert.match(tableBlock(BODIES), /CHECK \(public_body_form = 'PUBLIC_TEXT'\)/u);
  assert.match(tableBlock(BODIES),
    /FOREIGN KEY \(package_item_id, public_body_form\)\s*\n\s*REFERENCES public\.publication_package_manifest_items \(package_item_id, public_body_form\)/u);
});

test('PUBLIC_VOICE and RESERVED are reserved body kinds with no body relation and no producer', () => {
  assert.match(tableBlock(ITEMS), /CHECK \(public_body_form IN \('PUBLIC_TEXT', 'PUBLIC_VOICE', 'RESERVED'\)\)/u);
  const bodyRelations = [...executableSql.matchAll(/CREATE TABLE public\.(\w*derivative_bodies)/gu)].map((m) => m[1]);
  assert.deepEqual(bodyRelations, [BODIES],
    'PUBLIC_TEXT is the only body form with a relation: a public voice derivative needs a reviewed public media '
    + 'boundary that does not exist, and inventing a storage provider would be inventing Product logic');
  for (const invented of ['storage_provider', 'upload', 'bucket', 'signed_url', 'public_audio_object_ref']) {
    assert.ok(!executableSql.includes(invented), `and no ${invented} is invented`);
  }
});

test('sealed provenance binds the exact source, in exactly one shape per class, to relations that survive deletion', () => {
  const provenance = tableBlock(PROVENANCE);
  for (const cls of SOURCE_CLASSES) assert.ok(provenance.includes(`'${cls}'`), `${cls} is representable`);
  for (const state of AVAILABILITY) assert.ok(provenance.includes(`'${state}'`), `${state} is representable`);
  // Exactly one shape per class: a Personal row cannot carry Shared identifiers.
  assert.match(provenance, /source_class = 'MY_WORLD'\s*\n\s*AND personal_conversation_unit_id IS NOT NULL AND personal_owner_user_id IS NOT NULL\s*\n\s*AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL/u);
  assert.match(provenance, /source_class = 'SHARED_WORLD'\s*\n\s*AND shared_world_id IS NOT NULL AND shared_material_id IS NOT NULL/u);
  assert.match(provenance, /source_class = 'REPLAY_ARTIFACT'\s*\n\s*AND personal_conversation_unit_id IS NULL/u,
    'REPLAY_ARTIFACT is reserved with no identifier to bind: no Replay runtime exists and I-05A fabricates none');
  // The Shared bindings name relations owner deletion PRESERVES, never a body.
  const refs = [...provenance.matchAll(/REFERENCES public\.(\w+)/gu)].map((m) => m[1]);
  assert.ok(refs.includes('shared_world_materials') && refs.includes('shared_world_history_items'));
  assert.ok(refs.includes('conversation_units'), 'the Personal binding is the canonical committed source');
  for (const body of ['shared_world_text_material_bodies', 'shared_world_voice_note_material_bodies']) {
    assert.ok(!refs.includes(body),
      `provenance must never reference ${body}: owner deletion removes it, and a RESTRICT here would let a public `
      + 'package block a human from deleting their own material');
  }
  assert.match(selfAssertions, /provenance must never reference a Shared body relation owner deletion destroys/u);
});

test('an item whose source authority is unresolved is unrepresentable inside a package', () => {
  const itemAuthority = tableBlock(ITEM_AUTHORITY);
  assert.match(itemAuthority,
    /CHECK \(resolution_state IN \('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT'\)\)/u);
  assert.ok(!itemAuthority.includes('UNRESOLVED'),
    'the unresolved state is a property of the SOURCE and already has one canonical home in '
    + 'shared_world_material_historical_authority; a second copy here could drift from it');
  // The state and the count agree in BOTH directions, so an exact requirement can
  // never be recorded as empty and an empty one can never masquerade as exact.
  assert.match(itemAuthority,
    /resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT' AND required_approver_count > 0/u);
  assert.match(itemAuthority,
    /resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT' AND required_approver_count = 0/u);
  assert.match(selfAssertions, /an item with unresolved source authority must be unrepresentable inside a package/u);
  assert.match(selfAssertions, /the frozen I-04G source historical-authority state must exist/u);
});

test('an approval is structurally impossible outside the derived required set and grants no Experience control', () => {
  const approvals = tableBlock(APPROVALS);
  assert.match(approvals, /UNIQUE \(manifest_version_id, approver_user_id\)/u, 'one effective approval per manifest and approver');
  assert.match(approvals,
    /FOREIGN KEY \(manifest_version_id, approver_user_id\)\s*\n\s*REFERENCES public\.publication_manifest_required_approvers\s*\n\s*\(manifest_version_id, approver_user_id\) ON DELETE RESTRICT/u,
    'the composite foreign key into the DERIVED set is the binding law');
  assert.match(approvals, /CHECK \(bound_authority_fingerprint ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u,
    'an approval binds the authority request fingerprint as derived at the moment of approval');
  // Experience control and content rights never reference each other.
  assert.ok(!executableSql.includes('REFERENCES public.public_experience_controllers'),
    'nothing in the package reaches Experience control');
  assert.match(selfAssertions, /Experience control and content rights must not reference each other/u);
  // The rightsholder set is derived, never named by a caller: it has no basis,
  // reason, source or origin column a caller could have supplied.
  assert.deepEqual(columnNames(REQUIRED), ['manifest_version_id', 'approver_user_id']);
});

test('no Safety, Launch, entitlement, semantic, serving or discussion state is created', () => {
  for (const table of OWN_TABLES) {
    for (const column of columnNames(table)) {
      assert.doesNotMatch(column, /safety|moderation|launch|entitlement|premium|feature_flag|allow/u,
        `${table}.${column} would be a Safety Launch or entitlement decision I-05A has no authority to make`);
      assert.doesNotMatch(column, /semantic|placement|coordinate|embedding|vitality|ranking|reply|discussion|thread/u,
        `${table}.${column} belongs to I-05B`);
    }
  }
  for (const cls of DERIVATIVE_CLASSES) assert.ok(tableBlock(ITEMS).includes(`'${cls}'`), `${cls} is representable`);
  assert.doesNotMatch(executableSql, /@Controller|@Get|@Post|@Module|CREATE POLICY|CREATE EVENT TRIGGER|CREATE RULE/u);
});

test('every relation is postgres-owned, RLS-enabled with zero policies, and revoked from every application role', () => {
  for (const table of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM service_role/u);
  assert.doesNotMatch(executableSql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE/u);
  assert.doesNotMatch(executableSql, /GRANT EXECUTE/u, 'PART B grants EXECUTE on nothing at all');
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'public-serving relation % may carry no source identifier',
    'public-serving relation % may reference nothing outside its own package',
    'provenance must never reference a Shared body relation owner deletion destroys',
    'provenance must bind its exact source by restrictive foreign key',
    'an item with unresolved source authority must be unrepresentable inside a package',
    'the frozen I-04G source historical-authority state must exist',
    'an approval must bind the DERIVED required approver set by composite foreign key',
    'Experience control and content rights must not reference each other',
    'a manifest and its Experience Version must be bijective and same-Experience',
    'may carry no Safety Launch or entitlement decision',
    'may carry no semantic placement or discussion column',
    'the ONE function PART B owns must be the append-only trigger function',
    'must be append-only for every role',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
});

test('0092 is registered in the toolchain, in CI and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0092\\.mjs"`, 'u'));
  assert.match(readme, /0092_public_experience_publication_package_authority_v1\.sql/u);
  assert.match(verifier, /verifier for migration 0092/iu);
  // One grouped CI step runs all three I-05A verifiers so that a failure in 0091
  // no longer skips this one. See the 0091 contract for why the old flow-mapping
  // shape check was replaced rather than dropped.
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0092=PASS; else status=1; fi`),
    'the verifier runs in API CI and its failure is recorded rather than swallowed');
  assert.ok(workflow.includes('exit $status'),
    'the grouped I-05A step still fails the job when any of the three verifiers failed');
  // The KEY not the word: this file's own comments explain why it is absent.
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu,
    'no API CI step continues on error: diagnostic continuation must never turn the job green');
});
