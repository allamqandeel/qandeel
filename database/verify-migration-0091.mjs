// Real-PostgreSQL verifier for migration 0091 - I-05A Public World / Public
// Identity / Public Experience Foundation v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the eight relations exist once and still carry every column they
//     OWN - name, type, nullability AND the absence of a default - unchanged and
//     in their original positions; every owned unique binding, check and foreign
//     key is pinned by name, local columns, parent and restrictive deletion; RLS
//     is on with zero policies; and PUBLIC, anon, authenticated and service_role
//     hold no privilege at all;
//   * P01 exactly one logical Public World exists, and a second is
//     UNREPRESENTABLE rather than merely absent;
//   * P02 a Public Experience is not a World row or a World type, and every
//     Experience binds the one Public World structurally;
//   * P03 the Public Identity ref is stable and is not the private account id;
//   * P05 no relation carries a contact endpoint, and the display label is not
//     forced to be unique;
//   * P06 stable Experience identity survives many immutable versions;
//   * P07 Experience control and content rights are structurally distinct;
//   * an Experience Version and a committed lifecycle transition are immutable
//     for EVERY role, the table owner included;
//   * the Public audience policy is a gate: nothing references it, and its
//     signed-out launch requirement is UNRESOLVED and fails closed;
//   * PART A installs no writer, so no application role can reach any of it;
//   * forward safety: a later reviewed semantic placement table, public
//     discussion, Public QANDEEL producer, vitality and search projection,
//     Replay source adapter, owner-deletion writer, PUBLISHED transition, launch
//     gate, additive column, index and audit trigger are created for real inside
//     a rolled-back SAVEPOINT and this verifier still passes - then every
//     regression to something 0091 OWNS is planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent
// or a catalog sweep for future names would be a ceiling on the whole roadmap
// rather than a fact about migration 0091. What 0091 itself did NOT create is
// proven from 0091's own text, by
// database/tests/public-world-experience-foundation-v1.test.mjs.
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

const WORLD = 'public.public_world_state';
const POLICY = 'public.public_audience_policy_state';
const IDENTITIES = 'public.public_identities';
const DISPLAY = 'public.public_identity_display_state';
const EXPERIENCES = 'public.public_experiences';
const CONTROLLERS = 'public.public_experience_controllers';
const VERSIONS = 'public.public_experience_versions';
const LIFECYCLE = 'public.public_experience_lifecycle_events';
const OWN = [WORLD, POLICY, IDENTITIES, DISPLAY, EXPERIENCES, CONTROLLERS, VERSIONS, LIFECYCLE];

const APP_ROLES = ['anon', 'authenticated', 'service_role'];

/** The exact columns each relation OWNS, in their original positions. */
const OWNED_COLUMNS = {
  [WORLD]: [['singleton', 'boolean', false], ['world_type', 'text', false],
    ['state_version', 'bigint', false], ['established_at', 'timestamp with time zone', false]],
  [POLICY]: [['singleton', 'boolean', false], ['registered_viewing_policy', 'text', false],
    ['signed_out_viewing_policy', 'text', false], ['policy_revision', 'bigint', false],
    ['updated_at', 'timestamp with time zone', false]],
  [IDENTITIES]: [['public_identity_ref', 'uuid', false], ['user_id', 'uuid', false],
    ['created_at', 'timestamp with time zone', false]],
  [DISPLAY]: [['public_identity_ref', 'uuid', false], ['label_mode', 'text', false],
    ['display_label', 'text', false], ['label_revision', 'bigint', false],
    ['updated_at', 'timestamp with time zone', false]],
  [EXPERIENCES]: [['id', 'uuid', false], ['public_world_singleton', 'boolean', false],
    ['created_by_public_identity_ref', 'uuid', false], ['current_lifecycle', 'text', false],
    ['current_experience_version_id', 'uuid', true], ['experience_revision', 'bigint', false],
    ['created_at', 'timestamp with time zone', false]],
  [CONTROLLERS]: [['experience_id', 'uuid', false], ['controller_public_identity_ref', 'uuid', false],
    ['controller_user_id', 'uuid', false], ['control_basis', 'text', false],
    ['established_at', 'timestamp with time zone', false]],
  [VERSIONS]: [['id', 'uuid', false], ['experience_id', 'uuid', false],
    ['package_manifest_version_id', 'uuid', false], ['version_ordinal', 'integer', false],
    ['created_at', 'timestamp with time zone', false]],
  [LIFECYCLE]: [['id', 'uuid', false], ['experience_id', 'uuid', false],
    ['experience_version_id', 'uuid', true], ['from_lifecycle', 'text', true],
    ['to_lifecycle', 'text', false], ['occurred_at', 'timestamp with time zone', false]],
};

// ---------------------------------------------------------------------- catalog

async function verifyCatalog() {
  for (const table of OWN) {
    const [{ n }] = await rows(
      "SELECT count(*) n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname='public' AND c.relname=$1",
      [table.replace('public.', '')]);
    assert.equal(Number(n), 1, `${table} exists exactly once`);

    const columns = await rows(
      `SELECT a.attname name, format_type(a.atttypid, a.atttypmod) type, a.attnotnull notnull,
              (a.atthasdef OR a.attidentity <> '') has_default, a.attnum
         FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`, [table]);
    const owned = OWNED_COLUMNS[table];
    for (const [index, [name, type, nullable]] of owned.entries()) {
      const column = columns[index];
      assert.ok(column, `${table} still has a column at position ${index + 1}`);
      assert.equal(column.name, name, `${table} position ${index + 1} is still ${name}`);
      assert.equal(column.type, type, `${table}.${name} is still ${type}`);
      assert.equal(column.notnull, !nullable, `${table}.${name} nullability is unchanged`);
      assert.equal(column.has_default, false, `${table}.${name} carries no default: no value is ever implied`);
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
  }

  // Every owned constraint, pinned by name, local columns, parent and deletion rule.
  const EXPECTED_FKS = [
    [EXPERIENCES, 'public_experiences_world_fk', 'public_world_singleton', WORLD],
    [EXPERIENCES, 'public_experiences_creator_fk', 'created_by_public_identity_ref', IDENTITIES],
    [EXPERIENCES, 'public_experiences_current_version_fk', 'current_experience_version_id,id', VERSIONS],
    [IDENTITIES, 'public_identities_user_fk', 'user_id', 'public.users'],
    [DISPLAY, 'public_identity_display_state_identity_fk', 'public_identity_ref', IDENTITIES],
    [CONTROLLERS, 'public_experience_controllers_experience_fk', 'experience_id', EXPERIENCES],
    [CONTROLLERS, 'public_experience_controllers_identity_fk', 'controller_public_identity_ref,controller_user_id', IDENTITIES],
    [VERSIONS, 'public_experience_versions_experience_fk', 'experience_id', EXPERIENCES],
    [LIFECYCLE, 'public_experience_lifecycle_events_experience_fk', 'experience_id', EXPERIENCES],
    [LIFECYCLE, 'public_experience_lifecycle_events_version_fk', 'experience_version_id,experience_id', VERSIONS],
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
    assert.equal(fk.confdeltype, 'r', `${name} is RESTRICT: nothing is silently cascaded away`);
  }

  const EXPECTED_UNIQUE = [
    [WORLD, 'public_world_state_pk', 'singleton'],
    [POLICY, 'public_audience_policy_state_pk', 'singleton'],
    [IDENTITIES, 'public_identities_pk', 'public_identity_ref'],
    [IDENTITIES, 'public_identities_user_key', 'user_id'],
    [IDENTITIES, 'public_identities_ref_user_key', 'public_identity_ref,user_id'],
    [DISPLAY, 'public_identity_display_state_pk', 'public_identity_ref'],
    [EXPERIENCES, 'public_experiences_pk', 'id'],
    [EXPERIENCES, 'public_experiences_creator_key', 'id,created_by_public_identity_ref'],
    [CONTROLLERS, 'public_experience_controllers_pk', 'experience_id,controller_public_identity_ref'],
    [CONTROLLERS, 'public_experience_controllers_user_key', 'experience_id,controller_user_id'],
    [VERSIONS, 'public_experience_versions_pk', 'id'],
    [VERSIONS, 'public_experience_versions_manifest_key', 'package_manifest_version_id'],
    [VERSIONS, 'public_experience_versions_ordinal_key', 'experience_id,version_ordinal'],
    [VERSIONS, 'public_experience_versions_experience_key', 'id,experience_id'],
    [VERSIONS, 'public_experience_versions_manifest_experience_key', 'package_manifest_version_id,experience_id'],
    [LIFECYCLE, 'public_experience_lifecycle_events_pk', 'id'],
  ];
  for (const [table, name, columns] of EXPECTED_UNIQUE) {
    const [key] = await rows(
      `SELECT c.contype, (SELECT string_agg(a.attname, ',' ORDER BY x.ord)
                            FROM unnest(c.conkey) WITH ORDINALITY x(att, ord)
                            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.att) cols
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2`, [table, name]);
    assert.ok(key, `${table} still carries ${name}`);
    assert.ok(['p', 'u'].includes(key.contype), `${name} is a primary or unique key`);
    assert.equal(key.cols, columns, `${name} binds exactly ${columns}`);
  }

  const EXPECTED_CHECKS = [
    [WORLD, 'public_world_state_singleton_check'],
    [WORLD, 'public_world_state_type_check'],
    [WORLD, 'public_world_state_version_check'],
    [POLICY, 'public_audience_policy_singleton_check'],
    [POLICY, 'public_audience_policy_registered_check'],
    [POLICY, 'public_audience_policy_signed_out_check'],
    [IDENTITIES, 'public_identities_ref_not_account_check'],
    [DISPLAY, 'public_identity_display_mode_check'],
    [DISPLAY, 'public_identity_display_label_check'],
    [DISPLAY, 'public_identity_display_revision_check'],
    [EXPERIENCES, 'public_experiences_world_check'],
    [EXPERIENCES, 'public_experiences_lifecycle_check'],
    [EXPERIENCES, 'public_experiences_revision_check'],
    [CONTROLLERS, 'public_experience_controllers_basis_check'],
    [VERSIONS, 'public_experience_versions_ordinal_check'],
    [LIFECYCLE, 'public_experience_lifecycle_events_from_check'],
    [LIFECYCLE, 'public_experience_lifecycle_events_to_check'],
    [LIFECYCLE, 'public_experience_lifecycle_events_move_check'],
    [LIFECYCLE, 'public_experience_lifecycle_events_birth_check'],
  ];
  for (const [table, name] of EXPECTED_CHECKS) {
    const [check] = await rows(
      "SELECT 1 FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2 AND c.contype = 'c'", [table, name]);
    assert.ok(check, `${table} still carries check ${name}`);
  }

  // The complete frozen lifecycle vocabulary, read from the live constraint.
  const [{ def }] = await rows(
    "SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = 'public_experiences_lifecycle_check'",
    [EXPERIENCES]);
  for (const state of ['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD']) {
    assert.ok(def.includes(state), `${state} is representable, so I-05B and I-05C are additive`);
  }

  // Immutability is a trigger, because a privilege does not bind the table owner.
  for (const [table, trigger] of [[VERSIONS, 'public_experience_versions_immutable'],
    [LIFECYCLE, 'public_experience_lifecycle_events_immutable']]) {
    const [tg] = await rows(
      `SELECT tg.tgtype, tg.tgenabled FROM pg_trigger tg
        WHERE tg.tgrelid = $1::regclass AND tg.tgname = $2 AND NOT tg.tgisinternal`, [table, trigger]);
    assert.ok(tg, `${table} still carries ${trigger}`);
    assert.equal(tg.tgenabled, 'O', `${trigger} is enabled`);
    // BEFORE (bit 1 set), ROW (bit 0), UPDATE (bit 4) and DELETE (bit 3).
    assert.equal(tg.tgtype & 1, 1, `${trigger} is FOR EACH ROW`);
    assert.equal(tg.tgtype & 2, 2, `${trigger} is BEFORE`);
    assert.equal(tg.tgtype & 8, 8, `${trigger} guards DELETE`);
    assert.equal(tg.tgtype & 16, 16, `${trigger} guards UPDATE`);
  }

  // P01 exactly one logical Public World, and one audience-policy envelope.
  const [{ worlds }] = await rows(`SELECT count(*) worlds FROM ${WORLD}`);
  assert.equal(Number(worlds), 1, 'P01 exactly one logical Public World exists');
  const [world] = await rows(`SELECT * FROM ${WORLD}`);
  assert.equal(world.world_type, 'PUBLIC_WORLD');
  assert.equal(world.singleton, true);
  assert.ok(Number(world.state_version) >= 1, 'the Public World carries an authority snapshot version');
  const [policy] = await rows(`SELECT * FROM ${POLICY}`);
  assert.equal(policy.registered_viewing_policy, 'REGISTERED_ONLY');
  assert.equal(policy.signed_out_viewing_policy, 'UNRESOLVED',
    'the frozen CW2-08 signed-out launch requirement stays unresolved and fails closed');

  // The audience policy is a GATE: nothing binds its identity to it.
  const [{ referencing }] = await rows(
    "SELECT count(*) referencing FROM pg_constraint c WHERE c.contype='f' AND c.confrelid = $1::regclass", [POLICY]);
  assert.equal(Number(referencing), 0, 'no object binds its identity to the Public audience policy');

  // P02 a Public Experience is not a World row: it is not `shared_worlds`, and it
  // carries none of a World's identity columns.
  const experienceColumns = (await rows(
    'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
    [EXPERIENCES])).map((r) => r.attname);
  for (const banned of ['world_type', 'phase', 'birth_basis', 'world_id', 'member_count', 'membership_episode_id']) {
    assert.ok(!experienceColumns.includes(banned), `P02 a Public Experience carries no ${banned}`);
  }

  // P05 no relation here carries a contact endpoint or a credential.
  for (const table of OWN) {
    const columns = (await rows(
      'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
      [table])).map((r) => r.attname);
    for (const column of columns) {
      assert.doesNotMatch(column, /email|phone|msisdn|address|contact|credential|invite|secret|token|password/u,
        `P05 ${table}.${column} would be a contact endpoint`);
    }
  }
  // Display labels are deliberately NOT unique: uniqueness would invent a namespace.
  const [{ labelUnique }] = await rows(
    `SELECT count(*) "labelUnique" FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.contype = 'u'
        AND (SELECT string_agg(a.attname, ',') FROM unnest(c.conkey) k JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = k) = 'display_label'`, [DISPLAY]);
  assert.equal(Number(labelUnique), 0, 'a display label is not forced to be unique');

  // PART A installs no writer at all.
  const [{ writers }] = await rows(
    `SELECT count(*) writers FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = 'reject_public_experience_history_mutation_v1'
        AND p.prorettype = 'trigger'::regtype`);
  assert.equal(Number(writers), 1, 'the ONE function PART A owns is its append-only trigger function');
}

// -------------------------------------------------------------------- behaviour

async function verifyBehaviour(f) {
  // P01 a second Public World is UNREPRESENTABLE, not merely absent.
  await rejected(() => q(`INSERT INTO ${WORLD} (singleton, world_type, state_version, established_at)
                          VALUES (false, 'PUBLIC_WORLD', 1, now())`), ['23514'],
    /public_world_state_singleton_check/u);
  await rejected(() => q(`INSERT INTO ${WORLD} (singleton, world_type, state_version, established_at)
                          VALUES (true, 'PUBLIC_WORLD', 2, now())`), ['23505']);
  await rejected(() => q(`UPDATE ${WORLD} SET world_type = 'SHARED_WORLD'`), ['23514'],
    /public_world_state_type_check/u);

  // P03 the Public Identity ref is opaque and is NOT the private account id.
  await rejected(() => q(`INSERT INTO ${IDENTITIES} (public_identity_ref, user_id, created_at) VALUES ($1, $1, now())`,
    [f.mohamed]), ['23514'], /public_identities_ref_not_account_check/u);

  await q(`INSERT INTO ${IDENTITIES} (public_identity_ref, user_id, created_at) VALUES ($1, $2, now())`,
    [f.mohamedRef, f.mohamed]);
  await q(`INSERT INTO ${DISPLAY} (public_identity_ref, label_mode, display_label, label_revision, updated_at)
           VALUES ($1, 'PSEUDONYM', 'a chosen name', 1, now())`, [f.mohamedRef]);
  // One stable Public Identity per human in v1.
  await rejected(() => q(`INSERT INTO ${IDENTITIES} (public_identity_ref, user_id, created_at) VALUES ($1, $2, now())`,
    [randomUUID(), f.mohamed]), ['23505'], /public_identities_user_key/u);
  // Both frozen label modes, and no third.
  await q(`UPDATE ${DISPLAY} SET label_mode = 'REAL_NAME', label_revision = label_revision + 1 WHERE public_identity_ref = $1`,
    [f.mohamedRef]);
  await rejected(() => q(`UPDATE ${DISPLAY} SET label_mode = 'VERIFIED_REAL_NAME' WHERE public_identity_ref = $1`,
    [f.mohamedRef]), ['23514'], /public_identity_display_mode_check/u);
  await rejected(() => q(`UPDATE ${DISPLAY} SET display_label = '   ' WHERE public_identity_ref = $1`,
    [f.mohamedRef]), ['23514'], /public_identity_display_label_check/u);
  // A second human may choose the SAME label: no public namespace is invented.
  await q(`INSERT INTO ${IDENTITIES} (public_identity_ref, user_id, created_at) VALUES ($1, $2, now())`,
    [f.hadirRef, f.hadir]);
  await q(`INSERT INTO ${DISPLAY} (public_identity_ref, label_mode, display_label, label_revision, updated_at)
           VALUES ($1, 'PSEUDONYM', 'a chosen name', 1, now())`, [f.hadirRef]);

  // An Experience belongs to the ONE Public World, structurally.
  await q(`INSERT INTO ${EXPERIENCES}
             (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
              current_experience_version_id, experience_revision, created_at)
           VALUES ($1, true, $2, 'DRAFT', NULL, 1, now())`, [f.experience, f.mohamedRef]);
  await rejected(() => q(`INSERT INTO ${EXPERIENCES}
             (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
              current_experience_version_id, experience_revision, created_at)
           VALUES ($1, false, $2, 'DRAFT', NULL, 1, now())`, [randomUUID(), f.mohamedRef]), ['23514'],
    /public_experiences_world_check/u);

  // P07 Experience control is a different authority from content rights, and a
  // controller row can never pair one human's public identity with another's account.
  await q(`INSERT INTO ${CONTROLLERS}
             (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
           VALUES ($1, $2, $3, 'EXPERIENCE_CREATION', now())`, [f.experience, f.mohamedRef, f.mohamed]);
  await rejected(() => q(`INSERT INTO ${CONTROLLERS}
             (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
           VALUES ($1, $2, $3, 'EXPERIENCE_CREATION', now())`, [f.experience, f.mohamedRef, f.hadir]), ['23503'],
    /public_experience_controllers_identity_fk/u);
  await rejected(() => q(`INSERT INTO ${CONTROLLERS}
             (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
           VALUES ($1, $2, $3, '   ', now())`, [f.experience, f.hadirRef, f.hadir]), ['23514'],
    /public_experience_controllers_basis_check/u);

  // P06 stable Experience identity survives many immutable versions, and the
  // ordinal relation is deterministic.
  const manifests = [randomUUID(), randomUUID(), randomUUID()];
  const versions = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, version] of versions.entries()) {
    await q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
             VALUES ($1, $2, $3, $4, now())`, [version, f.experience, manifests[index], index + 1]);
  }
  const [{ n: versionCount }] = await rows(`SELECT count(*) n FROM ${VERSIONS} WHERE experience_id = $1`, [f.experience]);
  assert.equal(Number(versionCount), 3, 'P06 one stable Experience carries many versions');
  const [{ id: stillTheSame }] = await rows(`SELECT id FROM ${EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(stillTheSame, f.experience, 'P06 and its identity is unchanged by any of them');
  await rejected(() => q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
                          VALUES ($1, $2, $3, 2, now())`, [randomUUID(), f.experience, randomUUID()]), ['23505'],
    /public_experience_versions_ordinal_key/u);
  await rejected(() => q(`INSERT INTO ${VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
                          VALUES ($1, $2, $3, 4, now())`, [randomUUID(), f.experience, manifests[0]]), ['23505'],
    /public_experience_versions_manifest_key/u);

  // A version and a committed transition are immutable for EVERY role - and this
  // connection is the table OWNER, which is exactly the role a privilege cannot bind.
  await rejected(() => q(`UPDATE ${VERSIONS} SET version_ordinal = 99 WHERE id = $1`, [versions[0]]),
    ['55000'], /PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${VERSIONS} WHERE id = $1`, [versions[0]]),
    ['55000'], /PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE/u);

  await q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
           VALUES ($1, $2, NULL, NULL, 'DRAFT', now())`, [randomUUID(), f.experience]);
  await rejected(() => q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
           VALUES ($1, $2, NULL, 'DRAFT', 'READY_FOR_REVIEW', now())`, [randomUUID(), f.experience]), ['23514'],
    /public_experience_lifecycle_events_birth_check/u);
  await rejected(() => q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
           VALUES ($1, $2, $3, 'DRAFT', 'DRAFT', now())`, [randomUUID(), f.experience, versions[0]]), ['23514'],
    /public_experience_lifecycle_events_move_check/u);
  const transition = randomUUID();
  await q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
           VALUES ($1, $2, $3, 'DRAFT', 'READY_FOR_REVIEW', now())`, [transition, f.experience, versions[2]]);
  await rejected(() => q(`UPDATE ${LIFECYCLE} SET to_lifecycle = 'PUBLISHED' WHERE id = $1`, [transition]),
    ['55000'], /PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${LIFECYCLE} WHERE id = $1`, [transition]),
    ['55000'], /PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE/u);

  // The current version pointer never makes a historical version mutable, and it
  // can only ever point at a version of THIS Experience.
  await q(`UPDATE ${EXPERIENCES} SET current_experience_version_id = $2, experience_revision = experience_revision + 1
            WHERE id = $1`, [f.experience, versions[2]]);
  const otherExperience = randomUUID();
  await q(`INSERT INTO ${EXPERIENCES}
             (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
              current_experience_version_id, experience_revision, created_at)
           VALUES ($1, true, $2, 'DRAFT', NULL, 1, now())`, [otherExperience, f.hadirRef]);
  await rejected(() => q(`UPDATE ${EXPERIENCES} SET current_experience_version_id = $2 WHERE id = $1`,
    [otherExperience, versions[0]]), ['23503'], /public_experiences_current_version_fk/u);

  // No application role can read a single row of any of it.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT r');
    await identity(role, f.mohamed);
    for (const table of OWN) {
      await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    }
    await identity('postgres');
    await q('ROLLBACK TO SAVEPOINT r'); await q('RELEASE SAVEPOINT r');
  }
}

// ---------------------------------------------------------------- forward safety

async function verifyForwardSafety(f) {
  await q('SAVEPOINT forward_safety');
  try {
    // Everything I-05B, I-05C and CW2-08 are already scheduled to build, created
    // for real. None of it is an 0091 regression.
    await q(`CREATE TABLE public.i05a_probe_semantic_placement (
               experience_version_id uuid PRIMARY KEY REFERENCES ${VERSIONS} (id), placement_ref text NOT NULL)`);
    await q(`CREATE TABLE public.i05a_probe_public_discussion (
               id uuid PRIMARY KEY, experience_id uuid NOT NULL REFERENCES ${EXPERIENCES} (id))`);
    await q('CREATE TABLE public.i05a_probe_public_qandeel (id uuid PRIMARY KEY, thread_id uuid NOT NULL)');
    await q('CREATE TABLE public.i05a_probe_vitality (experience_id uuid PRIMARY KEY, heat integer NOT NULL)');
    await q('CREATE TABLE public.i05a_probe_search_projection (experience_id uuid PRIMARY KEY, lens text NOT NULL)');
    await q('CREATE TABLE public.i05a_probe_replay_source (package_item_id uuid PRIMARY KEY, replay_id uuid NOT NULL)');
    await q('CREATE TABLE public.i05a_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${EXPERIENCES} ADD COLUMN i05a_probe_published_at timestamptz`);
    await q(`CREATE INDEX i05a_probe_lifecycle_idx ON ${EXPERIENCES} (current_lifecycle)`);
    await q(`CREATE FUNCTION public.i05a_probe_owner_deletion_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' WHERE e.id = p_id; END$fn$`);
    await q(`CREATE FUNCTION public.i05a_probe_audit_v1() RETURNS trigger
             LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END$fn$`);
    await q(`CREATE TRIGGER i05a_probe_audit AFTER INSERT ON ${EXPERIENCES}
             FOR EACH ROW EXECUTE FUNCTION public.i05a_probe_audit_v1()`);
    // A later reviewed PUBLISHED transition, on a real Experience. I-05A only had
    // to not CREATE one; the lifecycle vocabulary it froze must already admit it.
    const published = await q(`UPDATE ${EXPERIENCES} SET current_lifecycle = 'PUBLISHED',
                                 experience_revision = experience_revision + 1 WHERE id = $1`, [f.experience]);
    assert.equal(published.rowCount, 1, 'a later reviewed PUBLISHED transition is representable');
    await q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
             SELECT $1, $2, e.current_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED', now()
               FROM ${EXPERIENCES} e WHERE e.id = $2`, [randomUUID(), f.experience]);
    await q(`INSERT INTO ${LIFECYCLE} (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
             SELECT $1, $2, e.current_experience_version_id, 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD', now()
               FROM ${EXPERIENCES} e WHERE e.id = $2`, [randomUUID(), f.experience]);

    await verifyCatalog();

    // Now every regression to something 0091 OWNS must still be refused.
    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT SELECT ON TABLE ${EXPERIENCES} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'an application role gaining a table privilege is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');

    await q('SAVEPOINT r2');
    await q(`ALTER TABLE ${EXPERIENCES} DISABLE ROW LEVEL SECURITY`);
    await assert.rejects(verifyCatalog(), refuses, 'row level security being disabled is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');

    await q('SAVEPOINT r3');
    await q(`ALTER TABLE ${VERSIONS} DISABLE TRIGGER public_experience_versions_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'a version becoming mutable is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');

    await q('SAVEPOINT r4');
    await q(`ALTER TABLE ${IDENTITIES} DROP CONSTRAINT public_identities_ref_not_account_check`);
    await assert.rejects(verifyCatalog(), refuses,
      'the public ref becoming the private account id is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');

    await q('SAVEPOINT r5');
    await q(`ALTER TABLE ${WORLD} DROP CONSTRAINT public_world_state_singleton_check`);
    await assert.rejects(verifyCatalog(), refuses, 'a second Public World becoming representable is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');

    await q('SAVEPOINT r6');
    await q(`ALTER TABLE ${EXPERIENCES} ADD COLUMN world_type text`);
    await assert.rejects(verifyCatalog(), refuses, 'a Public Experience becoming a World row is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');

    await q('SAVEPOINT r7');
    await q(`ALTER TABLE ${DISPLAY} ADD COLUMN contact_email text`);
    await assert.rejects(verifyCatalog(), refuses, 'a contact endpoint appearing on a public identity is a regression');
    await q('ROLLBACK TO SAVEPOINT r7');

    await q('SAVEPOINT r8');
    await q(`ALTER TABLE ${EXPERIENCES} ADD CONSTRAINT i05a_probe_policy_fk
             FOREIGN KEY (public_world_singleton) REFERENCES ${POLICY} (singleton)`);
    await assert.rejects(verifyCatalog(), refuses,
      'the viewing policy becoming part of Experience identity is a regression');
    await q('ROLLBACK TO SAVEPOINT r8');

    await q('SAVEPOINT r9');
    await q(`UPDATE ${POLICY} SET signed_out_viewing_policy = 'ALLOWED'`);
    await assert.rejects(verifyCatalog(), refuses,
      'guessing the unresolved signed-out launch requirement is a regression');
    await q('ROLLBACK TO SAVEPOINT r9');
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
      experience: randomUUID(),
    };
    // Every fixture and every write below is rolled back: `conversation_units` and
    // this slice's own version and lifecycle relations are append-only for every
    // role, so a committed fixture here could never be removed afterwards.
    await q('BEGIN');
    try {
      // The frozen 0002 trigger provisions public.users from auth.users.
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir]]);
      await verifyBehaviour(f);
      stage = 'forward safety';
      await verifyForwardSafety(f);
    } finally {
      await q('ROLLBACK');
    }

    stage = 'fixture residue';
    await identity('postgres');
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${IDENTITIES} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EXPERIENCES} WHERE id = $2)
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [[f.mohamed, f.hadir], f.experience]);
    assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back');
    const [{ worlds }] = await rows(`SELECT count(*) worlds FROM ${WORLD}`);
    assert.equal(Number(worlds), 1, 'and exactly one logical Public World still exists');

    console.log('migration 0091 verified: one Public World, one stable identity per human, an Experience that is not a World');
  } catch (error) {
    console.error(`migration 0091 verification failed at stage: ${stage}`);
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
