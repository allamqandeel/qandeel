// Real-PostgreSQL verifier for migration 0092 - I-05A Public Experience
// Publication Package and Authority v1 (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the seven relations exist once and still carry every column they
//     OWN - name, type, nullability AND the absence of a default; every owned
//     unique binding, check and foreign key is pinned by name, local columns,
//     parent and restrictive deletion; RLS is on with zero policies; and PUBLIC,
//     anon, authenticated and service_role hold no privilege at all;
//   * P22 a manifest is non-empty and immutable for EVERY role, the owner included;
//   * the manifest and its Experience Version are bijective and same-Experience;
//   * the kind-to-body binding is STRUCTURAL: a public body cannot attach to a
//     reserved form, and a reserved form has no body relation at all;
//   * a public-facing relation carries NO source identifier and reaches nothing
//     outside its own package;
//   * sealed provenance accepts exactly one shape per source class, binds Shared
//     identity to relations that SURVIVE owner deletion, and never to a body
//     relation owner deletion destroys;
//   * an item whose source authority is unresolved is UNREPRESENTABLE inside a
//     package, and the resolved state and its count agree in both directions;
//   * P19 an approval by a human the exact manifest does not require is
//     structurally impossible, however the row is produced;
//   * P07 / P21 Experience control and content rights reference each other in
//     neither direction;
//   * PART B installs no writer;
//   * forward safety inside a rolled-back SAVEPOINT, then every regression to
//     something 0092 OWNS planted and still refused;
//   * zero fixture residue after completion.
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

async function rejected(operation, codes, message = null) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

const MANIFESTS = 'public.publication_package_manifest_versions';
const ITEMS = 'public.publication_package_manifest_items';
const BODIES = 'public.public_experience_text_derivative_bodies';
const PROVENANCE = 'public.publication_package_item_provenance';
const ITEM_AUTHORITY = 'public.publication_package_item_authority';
const REQUIRED = 'public.publication_manifest_required_approvers';
const APPROVALS = 'public.publication_manifest_approvals';
const OWN = [MANIFESTS, ITEMS, BODIES, PROVENANCE, ITEM_AUTHORITY, REQUIRED, APPROVALS];
/** The two relations whose columns a PUBLIC audience may one day see. */
const PUBLIC_FACING = [ITEMS, BODIES];

const EXPERIENCES = 'public.public_experiences';
const VERSIONS = 'public.public_experience_versions';
const CONTROLLERS = 'public.public_experience_controllers';
const IDENTITIES = 'public.public_identities';
const APP_ROLES = ['anon', 'authenticated', 'service_role'];

const digest = (n) => `sha256:${n.toString().padStart(64, '0')}`;

const OWNED_COLUMNS = {
  [MANIFESTS]: [['id', 'uuid', false], ['experience_id', 'uuid', false],
    ['public_world_singleton', 'boolean', false], ['publisher_public_identity_ref', 'uuid', false],
    ['publisher_user_id', 'uuid', false], ['intended_publication_action', 'text', false],
    ['target_audience_class', 'text', false], ['authority_readiness', 'text', false],
    ['prepared_authority_snapshot_version', 'bigint', false], ['item_count', 'integer', false],
    ['created_at', 'timestamp with time zone', false]],
  [ITEMS]: [['manifest_version_id', 'uuid', false], ['experience_id', 'uuid', false],
    ['package_item_id', 'uuid', false], ['item_ordinal', 'integer', false],
    ['derivative_classification', 'text', false], ['public_body_form', 'text', false],
    ['public_body_digest', 'text', false]],
  [BODIES]: [['package_item_id', 'uuid', false], ['public_body_form', 'text', false],
    ['public_text_body', 'text', false]],
  [PROVENANCE]: [['package_item_id', 'uuid', false], ['manifest_version_id', 'uuid', false],
    ['source_class', 'text', false], ['personal_conversation_unit_id', 'uuid', true],
    ['personal_owner_user_id', 'uuid', true], ['shared_world_id', 'uuid', true],
    ['shared_material_id', 'uuid', true], ['shared_history_item_id', 'uuid', true],
    ['captured_availability_state', 'text', false], ['captured_availability_revision', 'bigint', true],
    ['captured_source_digest', 'text', false]],
  [ITEM_AUTHORITY]: [['package_item_id', 'uuid', false], ['manifest_version_id', 'uuid', false],
    ['resolution_state', 'text', false], ['required_approver_count', 'integer', false]],
  [REQUIRED]: [['manifest_version_id', 'uuid', false], ['approver_user_id', 'uuid', false]],
  [APPROVALS]: [['id', 'uuid', false], ['manifest_version_id', 'uuid', false],
    ['approver_user_id', 'uuid', false], ['bound_authority_fingerprint', 'text', false],
    ['approved_at', 'timestamp with time zone', false]],
};

// ---------------------------------------------------------------------- catalog

async function verifyCatalog() {
  for (const table of OWN) {
    const columns = await rows(
      `SELECT a.attname name, format_type(a.atttypid, a.atttypmod) type, a.attnotnull AS is_not_null,
              (a.atthasdef OR a.attidentity <> '') has_default
         FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`, [table]);
    for (const [index, [name, type, nullable]] of OWNED_COLUMNS[table].entries()) {
      const column = columns[index];
      assert.ok(column, `${table} still has a column at position ${index + 1}`);
      assert.equal(column.name, name, `${table} position ${index + 1} is still ${name}`);
      assert.equal(column.type, type, `${table}.${name} is still ${type}`);
      // Harness shape before semantics: a catalog alias that stops arriving must fail as itself,
      // not silently compare undefined and look like a nullability regression.
      assert.equal(typeof column.is_not_null, 'boolean',
        `${table}.${name}: the catalog query returned no boolean is_not_null, so the comparison below would be vacuous`);
      assert.equal(typeof column.has_default, 'boolean',
        `${table}.${name}: the catalog query returned no boolean has_default, so the comparison below would be vacuous`);
      assert.equal(column.is_not_null, !nullable, `${table}.${name} nullability is unchanged`);
      assert.equal(column.has_default, false, `${table}.${name} carries no default`);
    }

    const [{ rls, owner }] = await rows(
      'SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `${table} has RLS enabled`);
    assert.equal(owner, 'postgres', `${table} is postgres-owned`);
    const [{ policies }] = await rows('SELECT count(*) policies FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.equal(Number(policies), 0, `${table} carries zero policies`);
    for (const role of ['public', ...APP_ROLES]) {
      const [{ any_privilege }] = await rows(
        `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [role, table]);
      assert.equal(any_privilege, false, `${role} holds no privilege at all on ${table}`);
    }

    // Every package relation is append-only for every role, the owner included.
    const [tg] = await rows(
      `SELECT tg.tgtype, tg.tgenabled FROM pg_trigger tg
        WHERE tg.tgrelid = $1::regclass AND NOT tg.tgisinternal
          AND tg.tgfoid = 'public.reject_publication_package_mutation_v1'::regproc`, [table]);
    assert.ok(tg, `${table} carries the append-only trigger`);
    assert.equal(tg.tgenabled, 'O', `${table}'s append-only trigger is enabled`);
    assert.equal(tg.tgtype & 8, 8, `${table} refuses DELETE`);
    assert.equal(tg.tgtype & 16, 16, `${table} refuses UPDATE`);
  }

  const EXPECTED_FKS = [
    [MANIFESTS, 'publication_package_manifest_versions_world_fk', 'public_world_singleton', 'public.public_world_state'],
    [MANIFESTS, 'publication_package_manifest_versions_exp_fk', 'experience_id', EXPERIENCES],
    [MANIFESTS, 'publication_package_manifest_versions_pub_fk', 'publisher_public_identity_ref,publisher_user_id', IDENTITIES],
    [ITEMS, 'publication_package_manifest_items_manifest_fk', 'manifest_version_id,experience_id', MANIFESTS],
    [BODIES, 'public_experience_text_derivative_bodies_item_fk', 'package_item_id,public_body_form', ITEMS],
    [PROVENANCE, 'publication_package_item_provenance_item_fk', 'manifest_version_id,package_item_id', ITEMS],
    [PROVENANCE, 'publication_package_item_provenance_unit_fk', 'personal_conversation_unit_id', 'public.conversation_units'],
    [PROVENANCE, 'publication_package_item_provenance_owner_fk', 'personal_owner_user_id', 'public.users'],
    [PROVENANCE, 'publication_package_item_provenance_material_fk', 'shared_material_id,shared_world_id', 'public.shared_world_materials'],
    [PROVENANCE, 'publication_package_item_provenance_history_fk', 'shared_world_id,shared_history_item_id', 'public.shared_world_history_items'],
    [ITEM_AUTHORITY, 'publication_package_item_authority_item_fk', 'manifest_version_id,package_item_id', ITEMS],
    [REQUIRED, 'publication_manifest_required_approvers_manifest_fk', 'manifest_version_id', MANIFESTS],
    [REQUIRED, 'publication_manifest_required_approvers_user_fk', 'approver_user_id', 'public.users'],
    [APPROVALS, 'publication_manifest_approvals_required_fk', 'manifest_version_id,approver_user_id', REQUIRED],
    [VERSIONS, 'public_experience_versions_manifest_fk', 'package_manifest_version_id,experience_id', MANIFESTS],
  ];
  for (const [table, name, local, parent] of EXPECTED_FKS) {
    const [fk] = await rows(
      `SELECT (SELECT string_agg(a.attname, ',' ORDER BY x.ord)
                 FROM unnest(c.conkey) WITH ORDINALITY x(att, ord)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.att) local,
              c.confrelid::regclass::text parent, c.confdeltype
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2 AND c.contype = 'f'`, [table, name]);
    assert.ok(fk, `${table} still carries foreign key ${name}`);
    assert.equal(fk.local, local, `${name} binds exactly ${local}`);
    assert.equal(fk.parent, parent, `${name} points at ${parent}`);
    assert.equal(fk.confdeltype, 'r', `${name} is RESTRICT`);
  }

  // Provenance NEVER binds a Shared body relation, which owner deletion destroys.
  const [{ bodyBindings }] = await rows(
    `SELECT count(*) "bodyBindings" FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.contype = 'f'
        AND c.confrelid IN ('public.shared_world_text_material_bodies'::regclass,
                            'public.shared_world_voice_note_material_bodies'::regclass)`, [PROVENANCE]);
  assert.equal(Number(bodyBindings), 0,
    'provenance binds no Shared body relation: a public package can never block an owner deletion');

  // A public-facing relation reaches nothing outside its own package.
  for (const table of PUBLIC_FACING) {
    const parents = (await rows(
      `SELECT DISTINCT c.confrelid::regclass::text parent FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.contype = 'f'`, [table])).map((r) => r.parent);
    for (const parent of parents) {
      assert.ok([MANIFESTS, ITEMS].includes(parent), `${table} references ${parent}, which is outside its own package`);
    }
    const columns = (await rows(
      'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
      [table])).map((r) => r.attname);
    for (const column of columns) {
      assert.doesNotMatch(column,
        /session|turn|conversation_unit|world_id|shared_|material_id|history_item|source_id|owner_user|audio_object|transcript|context_ref/u,
        `${table}.${column} would be a source identifier in a public row`);
    }
  }

  // Experience control and content rights reference each other in NEITHER direction.
  const [{ crossed }] = await rows(
    `SELECT count(*) crossed FROM pg_constraint c
      WHERE c.contype = 'f'
        AND ((c.conrelid = $1::regclass AND c.confrelid IN ($2::regclass, $3::regclass))
          OR (c.confrelid = $1::regclass AND c.conrelid IN ($2::regclass, $3::regclass)))`,
    [CONTROLLERS, REQUIRED, APPROVALS]);
  assert.equal(Number(crossed), 0,
    'P07 / P21 Experience control and content rights are distinct authorities with no path between them');

  // The unresolved state is UNREPRESENTABLE inside a package.
  const [{ def: authorityDef }] = await rows(
    `SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.conname = 'publication_package_item_authority_state_check'`, [ITEM_AUTHORITY]);
  assert.ok(!authorityDef.includes('UNRESOLVED'),
    'an item with unresolved source authority cannot exist inside a package');
  for (const resolved of ['RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT']) {
    assert.ok(authorityDef.includes(resolved), `${resolved} is representable`);
  }
  // And the frozen I-04G source-side state this depends on still exists.
  const [{ n: sourceState }] = await rows(
    "SELECT count(*) n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname='shared_world_material_historical_authority'");
  assert.equal(Number(sourceState), 1, 'the frozen I-04G source historical-authority state is intact');

  // The complete frozen vocabularies, read from the live constraints.
  const vocabulary = async (table, name) => (await rows(
    'SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2',
    [table, name]))[0].def;
  const forms = await vocabulary(ITEMS, 'publication_package_manifest_items_form_check');
  for (const form of ['PUBLIC_TEXT', 'PUBLIC_VOICE', 'RESERVED']) assert.ok(forms.includes(form));
  const classes = await vocabulary(ITEMS, 'publication_package_manifest_items_class_check');
  for (const cls of ['SOURCE_CONTENT_BEARING_DERIVATIVE', 'ANALYTICAL_DERIVATIVE']) assert.ok(classes.includes(cls));
  const sources = await vocabulary(PROVENANCE, 'publication_package_item_provenance_class_check');
  for (const cls of ['MY_WORLD', 'SHARED_WORLD', 'REPLAY_ARTIFACT']) assert.ok(sources.includes(cls));
  const availability = await vocabulary(PROVENANCE, 'publication_package_item_provenance_avail_check');
  for (const state of ['AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE']) assert.ok(availability.includes(state));

  // PART B installs no writer: the ONE function it owns returns `trigger`.
  const [{ n: guard }] = await rows(
    `SELECT count(*) n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = 'reject_publication_package_mutation_v1'
        AND p.prorettype = 'trigger'::regtype`);
  assert.equal(Number(guard), 1, 'the ONE function PART B owns is its append-only trigger function');
}

// -------------------------------------------------------------------- behaviour

async function verifyBehaviour(f) {
  const world = (await rows('SELECT state_version FROM public.public_world_state'))[0].state_version;
  const manifest = async (id, items) => {
    await q(`INSERT INTO ${MANIFESTS}
               (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
                intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version,
                item_count, created_at)
             VALUES ($1, $2, true, $3, $4, 'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE',
                     'PRIVACY_OWNERSHIP_AUTHORITY_ONLY', $5, $6, now())`,
      [id, f.experience, f.mohamedRef, f.mohamed, world, items]);
  };

  // P22 a package is never empty, and the readiness can assert nothing else.
  await rejected(() => manifest(randomUUID(), 0), ['23514'], /publication_package_manifest_versions_count_check/u);
  await rejected(() => q(`INSERT INTO ${MANIFESTS}
               (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
                intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version,
                item_count, created_at)
             VALUES ($1, $2, true, $3, $4, 'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE',
                     'SAFETY_AND_LAUNCH_CLEARED', 1, 1, now())`,
  [randomUUID(), f.experience, f.mohamedRef, f.mohamed]), ['23514'],
  /publication_package_manifest_versions_ready_check/u);
  // AB03 the intended protected action is pinned: a manifest cannot intend the
  // PREPARATION command, because preparing is not audience expansion and an
  // approval of one action may not be replayed for another.
  await rejected(() => q(`INSERT INTO ${MANIFESTS}
               (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
                intended_publication_action, target_audience_class, authority_readiness,
                prepared_authority_snapshot_version, item_count, created_at)
             VALUES ($1, $2, true, $3, $4, 'PREPARE_PUBLICATION', 'PUBLIC_WORLD_AUDIENCE',
                     'PRIVACY_OWNERSHIP_AUTHORITY_ONLY', 1, 1, now())`,
  [randomUUID(), f.experience, f.mohamedRef, f.mohamed]), ['23514'],
  /publication_package_manifest_versions_action_check/u);
  await rejected(() => q(`INSERT INTO ${MANIFESTS}
               (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
                intended_publication_action, target_audience_class, authority_readiness,
                prepared_authority_snapshot_version, item_count, created_at)
             VALUES ($1, $2, true, $3, $4, 'DISTRIBUTE_REPLAY_EXTERNALLY', 'PUBLIC_WORLD_AUDIENCE',
                     'PRIVACY_OWNERSHIP_AUTHORITY_ONLY', 1, 1, now())`,
  [randomUUID(), f.experience, f.mohamedRef, f.mohamed]), ['23514'],
  /publication_package_manifest_versions_action_check/u);

  // A manifest can never attribute one human's public identity to another account.
  await rejected(() => q(`INSERT INTO ${MANIFESTS}
               (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
                intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version,
                item_count, created_at)
             VALUES ($1, $2, true, $3, $4, 'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE',
                     'PRIVACY_OWNERSHIP_AUTHORITY_ONLY', 1, 1, now())`,
  [randomUUID(), f.experience, f.mohamedRef, f.hadir]), ['23503'],
  /publication_package_manifest_versions_pub_fk/u);

  await manifest(f.manifest, 2);
  // P22 a manifest is immutable for EVERY role, and this connection is the owner.
  await rejected(() => q(`UPDATE ${MANIFESTS} SET item_count = 3 WHERE id = $1`, [f.manifest]),
    ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${MANIFESTS} WHERE id = $1`, [f.manifest]),
    ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);

  // The manifest and its Experience Version are bijective and same-Experience.
  await q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 1, now())`, [f.version, f.experience, f.manifest]);
  await rejected(() => q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 2, now())`, [randomUUID(), f.experience, f.manifest]), ['23505'],
  /public_experience_versions_manifest_key/u);
  await rejected(() => q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
           VALUES ($1, $2, $3, 1, now())`, [randomUUID(), f.otherExperience, f.manifest]), ['23503', '23505']);

  // The items, their public bodies and their sealed provenance.
  const addItem = async (item, ordinal, classification, form, bodyDigest) =>
    q(`INSERT INTO ${ITEMS} (manifest_version_id, experience_id, package_item_id, item_ordinal,
                             derivative_classification, public_body_form, public_body_digest)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [f.manifest, f.experience, item, ordinal, classification, form, bodyDigest]);

  await addItem(f.personalItem, 1, 'SOURCE_CONTENT_BEARING_DERIVATIVE', 'PUBLIC_TEXT', digest(1));
  await addItem(f.sharedItem, 2, 'ANALYTICAL_DERIVATIVE', 'PUBLIC_TEXT', digest(2));
  await rejected(() => addItem(randomUUID(), 1, 'ANALYTICAL_DERIVATIVE', 'PUBLIC_TEXT', digest(3)),
    ['23505'], /publication_package_manifest_items_order_key/u);
  await rejected(() => addItem(randomUUID(), 3, 'INVENTED_CLASS', 'PUBLIC_TEXT', digest(3)),
    ['23514'], /publication_package_manifest_items_class_check/u);
  await rejected(() => addItem(randomUUID(), 3, 'ANALYTICAL_DERIVATIVE', 'PUBLIC_TEXT', 'not-a-digest'),
    ['23514'], /publication_package_manifest_items_digest_check/u);
  // A package item identity belongs to exactly one manifest, forever.
  await manifest(f.secondManifest, 1);
  await rejected(() => q(`INSERT INTO ${ITEMS} (manifest_version_id, experience_id, package_item_id, item_ordinal,
                             derivative_classification, public_body_form, public_body_digest)
       VALUES ($1, $2, $3, 1, 'ANALYTICAL_DERIVATIVE', 'PUBLIC_TEXT', $4)`,
  [f.secondManifest, f.experience, f.personalItem, digest(4)]), ['23505'],
  /publication_package_manifest_items_item_key/u);

  // THE KIND-TO-BODY BINDING IS STRUCTURAL.
  await q(`INSERT INTO ${BODIES} (package_item_id, public_body_form, public_text_body)
           VALUES ($1, 'PUBLIC_TEXT', 'the exact committed source text')`, [f.personalItem]);
  await rejected(() => q(`INSERT INTO ${BODIES} (package_item_id, public_body_form, public_text_body)
           VALUES ($1, 'PUBLIC_VOICE', 'a body on a reserved form')`, [f.sharedItem]),
  ['23514'], /public_experience_text_derivative_bodies_form_check/u);
  await rejected(() => q(`INSERT INTO ${BODIES} (package_item_id, public_body_form, public_text_body)
           VALUES ($1, 'PUBLIC_TEXT', '   ')`, [f.sharedItem]),
  ['23514'], /public_experience_text_derivative_bodies_body_check/u);
  // A reserved body form has no body relation that will accept it.
  const reservedItem = randomUUID();
  await addItem(reservedItem, 3, 'SOURCE_CONTENT_BEARING_DERIVATIVE', 'PUBLIC_VOICE', digest(5));
  await rejected(() => q(`INSERT INTO ${BODIES} (package_item_id, public_body_form, public_text_body)
           VALUES ($1, 'PUBLIC_VOICE', 'reserved')`, [reservedItem]),
  ['23514'], /public_experience_text_derivative_bodies_form_check/u);
  // A public body is a SNAPSHOT: it is immutable, for the owner too.
  await rejected(() => q(`UPDATE ${BODIES} SET public_text_body = 'rewritten' WHERE package_item_id = $1`,
    [f.personalItem]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);

  // SEALED PROVENANCE: exactly one shape per class.
  const provenance = (item, columns) =>
    q(`INSERT INTO ${PROVENANCE} (package_item_id, manifest_version_id, source_class,
         personal_conversation_unit_id, personal_owner_user_id, shared_world_id, shared_material_id,
         shared_history_item_id, captured_availability_state, captured_availability_revision, captured_source_digest)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [item, f.manifest, ...columns]);

  await provenance(f.personalItem, ['MY_WORLD', f.unit, f.mohamed, null, null, null, 'AVAILABLE', null, digest(1)]);
  await provenance(f.sharedItem, ['SHARED_WORLD', null, null, f.world, f.material, f.historyItem, 'AVAILABLE', 1, digest(2)]);
  // A Personal row cannot carry Shared identifiers, and vice versa.
  await rejected(() => provenance(reservedItem,
    ['MY_WORLD', f.unit, f.mohamed, f.world, f.material, f.historyItem, 'AVAILABLE', 1, digest(5)]),
  ['23514'], /publication_package_item_provenance_shape_check/u);
  await rejected(() => provenance(reservedItem,
    ['SHARED_WORLD', null, null, f.world, f.material, f.historyItem, 'AVAILABLE', null, digest(5)]),
  ['23514'], /publication_package_item_provenance_shape_check/u);
  // REPLAY_ARTIFACT is reserved with no identifier to bind at all.
  await provenance(reservedItem, ['REPLAY_ARTIFACT', null, null, null, null, null, 'AVAILABLE', null, digest(5)]);
  await rejected(() => q(`UPDATE ${PROVENANCE} SET source_class = 'MY_WORLD' WHERE package_item_id = $1`,
    [reservedItem]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);

  // The per-item authority agrees with its count in BOTH directions.
  const itemAuthority = (item, state, count) =>
    q(`INSERT INTO ${ITEM_AUTHORITY} (package_item_id, manifest_version_id, resolution_state, required_approver_count)
       VALUES ($1, $2, $3, $4)`, [item, f.manifest, state, count]);
  await itemAuthority(f.personalItem, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 1);
  await itemAuthority(f.sharedItem, 'RESOLVED_NO_HUMAN_REQUIREMENT', 0);
  await rejected(() => itemAuthority(reservedItem, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 0),
    ['23514'], /publication_package_item_authority_count_check/u);
  await rejected(() => itemAuthority(reservedItem, 'RESOLVED_NO_HUMAN_REQUIREMENT', 2),
    ['23514'], /publication_package_item_authority_count_check/u);
  await rejected(() => itemAuthority(reservedItem, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', 0),
    ['23514'], /publication_package_item_authority_state_check/u);

  // P19 an approval by a human this exact manifest does not require is
  // STRUCTURALLY impossible, however the row is produced - and this connection is
  // the table owner writing the row directly.
  await q(`INSERT INTO ${REQUIRED} (manifest_version_id, approver_user_id) VALUES ($1, $2)`, [f.manifest, f.mohamed]);
  await rejected(() => q(`INSERT INTO ${APPROVALS}
             (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
           VALUES ($1, $2, $3, $4, now())`, [randomUUID(), f.manifest, f.hadir, digest(9)]),
  ['23503'], /publication_manifest_approvals_required_fk/u);
  await q(`INSERT INTO ${APPROVALS}
             (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
           VALUES ($1, $2, $3, $4, now())`, [f.approval, f.manifest, f.mohamed, digest(9)]);
  // One effective approval per manifest and approver.
  await rejected(() => q(`INSERT INTO ${APPROVALS}
             (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
           VALUES ($1, $2, $3, $4, now())`, [randomUUID(), f.manifest, f.mohamed, digest(9)]),
  ['23505'], /publication_manifest_approvals_one_per_approver_key/u);
  // P24 an approval for manifest A cannot be moved onto manifest B: it is immutable.
  await rejected(() => q(`UPDATE ${APPROVALS} SET manifest_version_id = $2 WHERE id = $1`,
    [f.approval, f.secondManifest]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);
  await rejected(() => q(`INSERT INTO ${APPROVALS}
             (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
           VALUES ($1, $2, $3, $4, now())`, [randomUUID(), f.secondManifest, f.mohamed, digest(9)]),
  ['23503'], /publication_manifest_approvals_required_fk/u);
  // And a bound fingerprint is a real fingerprint. Proven on the SECOND manifest,
  // where the approver is now required and the one-per-approver key cannot fire
  // first, so the rejection can only be the fingerprint check.
  await q(`INSERT INTO ${REQUIRED} (manifest_version_id, approver_user_id) VALUES ($1, $2)`,
    [f.secondManifest, f.mohamed]);
  await rejected(() => q(`INSERT INTO ${APPROVALS}
             (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)
           VALUES ($1, $2, $3, 'not-a-fingerprint', now())`, [randomUUID(), f.secondManifest, f.mohamed]),
  ['23514'], /publication_manifest_approvals_fingerprint_check/u);

  // No application role can read a single row of any of it.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT r');
    await identity(role, f.mohamed);
    for (const table of OWN) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await identity('postgres');
    await q('ROLLBACK TO SAVEPOINT r'); await q('RELEASE SAVEPOINT r');
  }
}

// ---------------------------------------------------------------- forward safety

async function verifyForwardSafety() {
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE TABLE public.i05a92_probe_semantic_placement (
               experience_version_id uuid PRIMARY KEY REFERENCES ${VERSIONS} (id), placement_ref text NOT NULL)`);
    await q(`CREATE TABLE public.i05a92_probe_public_discussion (
               id uuid PRIMARY KEY, experience_id uuid NOT NULL REFERENCES ${EXPERIENCES} (id))`);
    await q('CREATE TABLE public.i05a92_probe_public_qandeel (id uuid PRIMARY KEY, thread_id uuid NOT NULL)');
    await q('CREATE TABLE public.i05a92_probe_vitality (experience_id uuid PRIMARY KEY, heat integer NOT NULL)');
    await q('CREATE TABLE public.i05a92_probe_search_projection (experience_id uuid PRIMARY KEY, lens text NOT NULL)');
    await q(`CREATE TABLE public.i05a92_probe_replay_source (
               package_item_id uuid PRIMARY KEY REFERENCES ${ITEMS} (package_item_id), replay_id uuid NOT NULL)`);
    await q('CREATE TABLE public.i05a92_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${MANIFESTS} ADD COLUMN i05a92_probe_provider_metadata text`);
    await q(`CREATE INDEX i05a92_probe_items_idx ON ${ITEMS} (derivative_classification)`);
    await q(`CREATE FUNCTION public.i05a92_probe_owner_deletion_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`CREATE FUNCTION public.i05a92_probe_audit_v1() RETURNS trigger
             LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END$fn$`);
    await q(`CREATE TRIGGER i05a92_probe_audit AFTER INSERT ON ${MANIFESTS}
             FOR EACH ROW EXECUTE FUNCTION public.i05a92_probe_audit_v1()`);

    await verifyCatalog();

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT SELECT ON TABLE ${PROVENANCE} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'sealed provenance becoming readable is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');

    await q('SAVEPOINT r2');
    await q(`ALTER TABLE ${ITEMS} ADD COLUMN shared_world_id uuid`);
    await assert.rejects(verifyCatalog(), refuses, 'a source identifier in a public row is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');

    await q('SAVEPOINT r3');
    await q(`ALTER TABLE ${MANIFESTS} DISABLE TRIGGER publication_package_manifest_versions_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'a mutable manifest is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');

    await q('SAVEPOINT r4');
    await q(`ALTER TABLE ${ITEM_AUTHORITY} DROP CONSTRAINT publication_package_item_authority_state_check`);
    await q(`ALTER TABLE ${ITEM_AUTHORITY} ADD CONSTRAINT publication_package_item_authority_state_check
             CHECK (resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT',
                                         'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'))`);
    await assert.rejects(verifyCatalog(), refuses,
      'an unresolved item becoming representable inside a package is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');

    await q('SAVEPOINT r5');
    await q(`ALTER TABLE ${APPROVALS} DROP CONSTRAINT publication_manifest_approvals_required_fk`);
    await assert.rejects(verifyCatalog(), refuses,
      'an approval escaping the derived required set is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');

    await q('SAVEPOINT r6');
    // An approval that could reach Experience control - the exact collapse
    // CW2-04's freeze review F1 exists to prevent. The parent key is the
    // controller relation's own (experience, controller ref) primary key, so this
    // mutation is deterministic rather than opportunistic.
    await q(`ALTER TABLE ${APPROVALS} ADD COLUMN i05a92_probe_experience uuid`);
    await q(`ALTER TABLE ${APPROVALS} ADD COLUMN i05a92_probe_controller_ref uuid`);
    await q(`ALTER TABLE ${APPROVALS} ADD CONSTRAINT i05a92_probe_control_fk
             FOREIGN KEY (i05a92_probe_experience, i05a92_probe_controller_ref)
             REFERENCES ${CONTROLLERS} (experience_id, controller_public_identity_ref)`);
    await assert.rejects(verifyCatalog(), refuses,
      'content rights reaching Experience control is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');

    await q('SAVEPOINT r7');
    await q(`ALTER TABLE ${PROVENANCE} ADD COLUMN i05a92_probe_body uuid
             REFERENCES public.shared_world_text_material_bodies (material_id)`);
    await assert.rejects(verifyCatalog(), refuses,
      'provenance binding a Shared body owner deletion destroys is a regression');
    await q('ROLLBACK TO SAVEPOINT r7');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

// --------------------------------------------------------------------------

async function main() {
  try {
    await client.connect();
    stage = 'catalog';
    await identity('postgres');
    await verifyCatalog();

    stage = 'behaviour';
    const f = {
      mohamed: randomUUID(), hadir: randomUUID(),
      mohamedRef: randomUUID(), hadirRef: randomUUID(),
      experience: randomUUID(), otherExperience: randomUUID(),
      manifest: randomUUID(), secondManifest: randomUUID(), version: randomUUID(),
      personalItem: randomUUID(), sharedItem: randomUUID(), approval: randomUUID(),
      session: randomUUID(), turn: randomUUID(), batch: randomUUID(), unit: randomUUID(),
      world: randomUUID(), historyItem: randomUUID(), material: randomUUID(),
    };
    // Everything below is rolled back: `conversation_units` and this slice's own
    // package relations are append-only for every role, so a committed fixture
    // here could never be removed afterwards.
    await q('BEGIN');
    try {
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir]]);
      // The canonical durable Personal source, exactly as migration 0064 and 0065 shape it.
      await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')",
        [f.session, f.mohamed]);
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
               VALUES ($1, $2, $3, 'USER', 'COMPLETED', 'a committed human sentence')`, [f.turn, f.session, f.mohamed]);
      await q(`INSERT INTO public.conversation_unit_commit_batches
                 (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                  unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                  segmentation_prompt_version)
               VALUES ($1, $2, $3, $4, sha256('fp'::bytea), sha256('src'::bytea), 1,
                       'v1', 'v1', 'PROBE', 'probe', 'v1')`, [f.batch, f.mohamed, f.session, f.turn]);
      await q(`INSERT INTO public.conversation_units
                 (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                  source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
                  source_content_sha256, session_position)
               VALUES ($1, $2, $3, $4, $5, 'USER', 'RESOLVED', 'TEXT', 0, 0, 27,
                       'a committed human sentence', sha256('src'::bytea), 1)`,
      [f.unit, f.mohamed, f.session, f.turn, f.batch]);
      // A minimal Shared source, exactly as I-04F and I-04G shape it.
      await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at)
               VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', now())`, [f.world]);
      await q(`INSERT INTO public.shared_world_history_items
                 (id, world_id, occurred_at, authority_requirement_mode, availability_state,
                  availability_revision, registered_at)
               VALUES ($1, $2, now(), 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE', 1, now())`, [f.historyItem, f.world]);
      await q(`INSERT INTO public.shared_world_materials
                 (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
               SELECT $1, $2, $3, 'HUMAN_TEXT', 'HUMAN', 'TEXT', $4, i.occurred_at
                 FROM public.shared_world_history_items i WHERE i.id = $3`,
      [f.material, f.world, f.historyItem, f.hadir]);
      // Public foundation rows the package binds to.
      await q('INSERT INTO public.public_identities (public_identity_ref, user_id, created_at) VALUES ($1, $2, now())',
        [f.mohamedRef, f.mohamed]);
      await q('INSERT INTO public.public_identities (public_identity_ref, user_id, created_at) VALUES ($1, $2, now())',
        [f.hadirRef, f.hadir]);
      for (const [id, ref] of [[f.experience, f.mohamedRef], [f.otherExperience, f.hadirRef]]) {
        await q(`INSERT INTO ${EXPERIENCES}
                   (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
                    current_experience_version_id, experience_revision, created_at)
                 VALUES ($1, true, $2, 'DRAFT', NULL, 1, now())`, [id, ref]);
      }
      await q(`INSERT INTO ${CONTROLLERS}
                 (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
               VALUES ($1, $2, $3, 'EXPERIENCE_CREATION', now())`, [f.experience, f.mohamedRef, f.mohamed]);

      await verifyBehaviour(f);
      stage = 'forward safety';
      await verifyForwardSafety();
    } finally {
      await q('ROLLBACK');
    }

    stage = 'fixture residue';
    await identity('postgres');
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${MANIFESTS} WHERE publisher_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.conversation_units WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.shared_worlds WHERE id = $2)
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [[f.mohamed, f.hadir], f.world]);
    assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back');

    console.log('migration 0092 verified: the package is immutable, its provenance sealed, and its approvals bound to the derived set');
  } catch (error) {
    console.error(`migration 0092 verification failed at stage: ${stage}`);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
