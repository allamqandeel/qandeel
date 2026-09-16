// Real-PostgreSQL verifier for migration 0104 - I-06C Replay Distribution
// Package, Distribution Authority and the Public REPLAY_ARTIFACT bridge (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that the PERSISTENCE this slice owns makes the wrong distribution
// unrepresentable rather than merely refused:
//
//   D01 every package names an exact historically FINALIZED Replay Version
//   D02 an unfinalized Replay Version cannot be bound at all
//   D03 a mismatched Replay and Replay Version is structurally refused
//   D04 reopening a Replay to DRAFT leaves its old version distributable
//   D05 a package and its destination are immutable for every role
//   D06 unresolved authority is unrepresentable on both halves and the union
//   D07 an exact human requirement can never be recorded as an empty set
//   D08 the audience-safe reference is opaque and reproduces no internal identity
//   D09 an approval outside the derived required set is structurally impossible
//   D10 an approval for one destination cannot resolve against another
//   D11 a withdrawal names ONE exact approval, through one composite key
//   D12 the sanitized export descriptor carries no private identifier class
//   D13 a sanitized descriptor cannot move to another package or destination
//   D14 the Public bridge binds the exact item, its RESERVED form and its
//       REPLAY_ARTIFACT provenance
//   D15 one Public package item binds exactly ONE Replay distribution package
//   D16 an authorization records authorization and never a delivery
//   D17 an authorization cannot exist with an unevaluated CW2-08 dimension
//   D18 every I-06C relation is append-only for every role including the owner
//   D19 no application role holds any privilege on any I-06C relation
//   D20 the four additive candidate keys exist and every frozen guard survives
//   D21 PART A writes no row and creates no writer
//
//   f1..f3 the refused weakenings: a guard that no longer fires, an opaque
//          reference that is an internal uuid in disguise, and a package whose
//          finalization binding was removed
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them, so one defect cannot hide the
// rest and cost a whole focused round per finding.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createReplayDistributionRuntime, D, DFN, I06C_IMMUTABLE, runVerifier, APP_ROLES, R, V, T,
} from './replay-distribution-verifier-support.mjs';

const rt = createReplayDistributionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const OWN_TABLES = [D.PACKAGES, D.REQUIRED, D.APPROVALS, D.WITHDRAWALS, D.DESCRIPTORS,
  D.ARTIFACTS, D.AUTHORIZATIONS];
const TRIGGER_FUNCTIONS = [DFN.MUTATION_TRIGGER, DFN.OPAQUE_TRIGGER];
/** The additive candidate keys this migration needed, each trivially unique. */
const ADDITIVE_KEYS = [
  ['public.replay_version_finalizations', 'replay_version_finalizations_exact_key'],
  ['public.replay_versions', 'replay_versions_composition_key'],
  ['public.publication_package_manifest_items', 'publication_package_manifest_items_exact_key'],
  ['public.publication_package_item_provenance', 'publication_package_item_provenance_class_key'],
];
/** Column-name classes that may never appear on the ONE audience-visible relation. */
const FORBIDDEN_DESCRIPTOR_COLUMNS = /(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|user_id|approver|participant|captured_|manifest_version|selection_spec|projection_version|render_contract|experience|package_item|replay_id|replay_version|provenance_|source_id|source_ref)/u;

const opaque = () => `rdx1_${randomUUID().replace(/-/gu, '')}`;

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    triggers: TRIGGER_FUNCTIONS,
    tables: OWN_TABLES,
    immutable: I06C_IMMUTABLE,
  });
  // PART A CREATES NO WRITER: the only two functions it owns return `trigger`.
  const [{ others }] = await rows(
    `SELECT count(*) others FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname ~ '^(reject_replay_distribution|replay_distribution_audience)'
        AND p.prorettype <> 'trigger'::regtype`);
  assert.equal(Number(others), 0, 'D21 PART A owns trigger functions and nothing else');
  // THE FOUR ADDITIVE CANDIDATE KEYS EXIST AND ARE TRIVIALLY UNIQUE: each one
  // contains its relation's primary key, so it constrains no row that the
  // primary key did not already constrain.
  for (const [table, name] of ADDITIVE_KEYS) {
    const columns = await rt.uniqueKeyColumns(table, name);
    assert.ok(Array.isArray(columns) && columns.length >= 2,
      `D20 the additive candidate key ${name} exists with a composite column list`);
    const [{ primary }] = await rows(
      `SELECT (SELECT array_agg(a.attname::text) FROM unnest(c.conkey) k(attnum)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) primary
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'p'`, [table]);
    for (const key of primary) {
      assert.ok(columns.includes(key),
        `D20 ${name} contains ${table}'s primary key column ${key}, so it is trivially unique`);
    }
  }
  // THE EXACT BINDINGS, as ONE row each rather than independent partial keys.
  await rt.assertExactBinding(D.PACKAGES, 'public.replay_version_finalizations',
    ['replay_version_id', 'replay_id'], ['replay_version_id', 'replay_id']);
  await rt.assertExactBinding(D.PACKAGES, 'public.replay_versions',
    ['replay_version_id', 'replay_id', 'source_manifest_version_id'],
    ['id', 'replay_id', 'source_manifest_version_id']);
  await rt.assertExactBinding(D.PACKAGES, 'public.replay_source_manifest_versions',
    ['source_manifest_version_id', 'source_class'], ['id', 'source_class']);
  await rt.assertExactBinding(D.APPROVALS, 'public.replay_distribution_required_approvers',
    ['distribution_package_version_id', 'approver_user_id'],
    ['distribution_package_version_id', 'approver_user_id']);
  await rt.assertExactBinding(D.WITHDRAWALS, 'public.replay_distribution_approvals',
    ['approval_id', 'distribution_package_version_id', 'approver_user_id'],
    ['id', 'distribution_package_version_id', 'approver_user_id']);
  await rt.assertExactBinding(D.ARTIFACTS, 'public.publication_package_manifest_items',
    ['public_manifest_version_id', 'package_item_id', 'public_body_form'],
    ['manifest_version_id', 'package_item_id', 'public_body_form']);
  await rt.assertExactBinding(D.ARTIFACTS, 'public.publication_package_item_provenance',
    ['package_item_id', 'public_source_class'], ['package_item_id', 'source_class']);
  await rt.assertExactBinding(D.AUTHORIZATIONS, D.PACKAGES,
    ['distribution_package_version_id', 'destination_action', 'replay_id', 'replay_version_id'],
    ['id', 'destination_action', 'replay_id', 'replay_version_id']);
  // D12 THE SANITIZED SURFACE IS A POSITIVE ALLOWLIST: no private identifier
  // class, and no JSON escape hatch through which one could arrive later.
  const descriptorColumns = await rows(
    `SELECT a.attname, ty.typname FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`, [D.DESCRIPTORS]);
  assert.ok(descriptorColumns.length > 0, 'D12 the export descriptor declares columns to check');
  for (const column of descriptorColumns) {
    assert.doesNotMatch(column.attname, FORBIDDEN_DESCRIPTOR_COLUMNS,
      `D12 the sanitized export descriptor may not carry ${column.attname}`);
    assert.ok(!['json', 'jsonb', 'bytea'].includes(column.typname),
      `D12 ${column.attname} may not be an untyped payload column`);
  }
  // D16 AND NO COLUMN ANYWHERE RECORDS A DELIVERY NOBODY PERFORMED.
  for (const table of OWN_TABLES) {
    const columns = await rows(
      `SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass
        AND a.attnum > 0 AND NOT a.attisdropped`, [table]);
    for (const { attname } of columns) {
      assert.doesNotMatch(attname, /(delivered|downloaded|sent_at|recipient|endpoint|codec|bitrate|cdn|bucket|object_key|watermark)/u,
        `D16 ${table} may not carry ${attname}: authorization is not delivery`);
    }
  }
}

// ------------------------------------------------------- 2. the row scenarios
/**
 * A committed fixture: one human, one covered Personal Session, one historically
 * FINALIZED Replay Version whose two selected segments are that human's OWN
 * committed sentences at sealed positions.
 */
async function provisionFixture(humans) {
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
  const finalized = await rt.provisionFinalizedReplay(humans[0]);
  await asRole('postgres');
  return finalized;
}

/** Insert one package row directly, as the table owner, with overridable fields. */
function packageRow(base, overrides = {}) {
  return {
    id: randomUUID(), replay_id: base.replay, replay_version_id: base.version,
    source_manifest_version_id: base.manifest, source_class: 'MY_WORLD',
    destination_action: 'SHARE_EXTERNALLY', package_revision: 1,
    authority_requirement_state: 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
    source_authority_resolution: 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
    analytical_authority_resolution: 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
    required_approver_count: 1,
    authority_request_fingerprint: `sha256:${'a'.repeat(64)}`,
    sanitization_contract_id: 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1',
    audience_safe_reference: opaque(),
    ...overrides,
  };
}
const insertPackage = (row) => q(
  `INSERT INTO ${D.PACKAGES} (id, replay_id, replay_version_id, source_manifest_version_id, source_class,
     destination_action, package_revision, authority_requirement_state, source_authority_resolution,
     analytical_authority_resolution, required_approver_count, authority_request_fingerprint,
     sanitization_contract_id, audience_safe_reference, created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, clock_timestamp())`,
  [row.id, row.replay_id, row.replay_version_id, row.source_manifest_version_id, row.source_class,
    row.destination_action, row.package_revision, row.authority_requirement_state,
    row.source_authority_resolution, row.analytical_authority_resolution, row.required_approver_count,
    row.authority_request_fingerprint, row.sanitization_contract_id, row.audience_safe_reference]);

async function verifyStructure(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('D01 a package binds the exact historical finalization evidence of its exact version', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      const [stored] = await rows(`SELECT * FROM ${D.PACKAGES} WHERE id = $1`, [row.id]);
      assert.equal(stored.replay_version_id, base.version, 'D01 the exact Replay Version is bound');
      assert.equal(stored.replay_id, base.replay, 'D01 of the exact Replay');
      assert.equal(await count('public.replay_version_finalizations',
        'replay_version_id = $1 AND replay_id = $2', [base.version, base.replay]), 1,
      'D01 and the finalization evidence that makes it distributable exists');
    });

    await report.isolated('D02 a Replay Version that was never finalized cannot be bound at all', async () => {
      // A SECOND complete Replay Version that reached PREVIEW_READY and was never
      // finalized: real state, written by the real I-06B primitives.
      await actAs(f.creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION', 'D02 the Replay reopened for revision');
      const next = rt.freshPreview(base.replay, 1);
      const [previewed] = await rt.preview(next);
      assert.equal(previewed.outcome, 'REPLAY_PREVIEW_READY', 'D02 a second Replay Version was built');
      await asRole('postgres');
      await rejected(() => insertPackage(packageRow(base, { replay_version_id: next.version })),
        ['23503'], /replay_distribution_package_versions_finalized_fk/u);
    });

    await report.isolated('D03 a package cannot pair one Replay with another Replay version', async () => {
      const other = randomUUID();
      await q(`INSERT INTO ${R.REPLAYS} (id, created_by_user_id, current_lifecycle, created_at)
               VALUES ($1, $2, 'DRAFT', clock_timestamp())`, [other, f.creator]);
      await rejected(() => insertPackage(packageRow(base, { replay_id: other })),
        ['23503'], /replay_distribution_package_versions_(finalized|version)_fk/u);
    });

    await report.isolated('D04 reopening a Replay to DRAFT leaves the old version historically finalized', async () => {
      await actAs(f.creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION');
      await asRole('postgres');
      const [replay] = await rows(`SELECT current_lifecycle FROM ${R.REPLAYS} WHERE id = $1`, [base.replay]);
      assert.equal(replay.current_lifecycle, 'DRAFT', 'D04 the stable Replay really is back in DRAFT');
      assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [base.version]), 1,
        'D04 and the exact version stays historically finalized');
      const row = packageRow(base);
      await insertPackage(row);
      assert.equal(await count(D.PACKAGES, 'id = $1', [row.id]), 1,
        'D04 so the old finalized version is still bindable while the Replay is being revised');
    });

    await report.isolated('D05 a package and its destination are immutable for every role', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      for (const [column, value] of [['destination_action', 'DOWNLOAD'],
        ['replay_version_id', base.version], ['required_approver_count', 9],
        ['audience_safe_reference', opaque()]]) {
        await rejected(() => q(`UPDATE ${D.PACKAGES} SET ${column} = $2 WHERE id = $1`, [row.id, value]),
          ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
      }
      await rejected(() => q(`DELETE FROM ${D.PACKAGES} WHERE id = $1`, [row.id]),
        ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
    });

    await report.isolated('D06 unresolved authority is unrepresentable on both halves and on the union', async () => {
      const unresolved = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT';
      await rejected(() => insertPackage(packageRow(base, { analytical_authority_resolution: unresolved })),
        ['23514'], /analytical_authority_check/u);
      await rejected(() => insertPackage(packageRow(base, { source_authority_resolution: unresolved })),
        ['23514'], /source_authority_check/u);
      // An unresolved UNION violates three CHECKs at once - the state vocabulary,
      // the state-count agreement and the union rule - and which of them
      // PostgreSQL names for simultaneous violations is undocumented and is not
      // the invariant being frozen. The proof is exact in the way that matters:
      // the refusal is 23514 and it comes from one of exactly those three.
      await rejected(() => insertPackage(packageRow(base, { authority_requirement_state: unresolved })),
        ['23514'], /_state_check|_count_check|_union_check/u);
      // AND A RESOLVED-EMPTY UNION OVER A HALF THAT NAMES HUMANS IS REFUSED.
      await rejected(() => insertPackage(packageRow(base, {
        authority_requirement_state: 'RESOLVED_NO_HUMAN_REQUIREMENT', required_approver_count: 0 })),
      ['23514'], /_union_check/u);
    });

    await report.isolated('D07 an exact human requirement can never be recorded as an empty approver set', async () => {
      await rejected(() => insertPackage(packageRow(base, { required_approver_count: 0 })),
        ['23514'], /_count_check|_union_check/u);
      await rejected(() => insertPackage(packageRow(base, {
        authority_requirement_state: 'RESOLVED_NO_HUMAN_REQUIREMENT',
        source_authority_resolution: 'RESOLVED_NO_HUMAN_REQUIREMENT',
        analytical_authority_resolution: 'RESOLVED_NO_HUMAN_REQUIREMENT',
        required_approver_count: 2 })),
      ['23514'], /_count_check/u);
    });

    await report.isolated('D08 an audience reference that reproduces an internal identity is unrepresentable', async () => {
      for (const internal of [base.version, base.replay, base.manifest]) {
        await rejected(() => insertPackage(packageRow(base,
          { audience_safe_reference: `rdx1_${internal.replace(/-/gu, '')}` })),
        ['P0001'], /REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE/u);
      }
      // A package id in disguise is refused too, and the check reads the row's
      // own columns rather than a parameter.
      const id = randomUUID();
      await rejected(() => insertPackage(packageRow(base,
        { id, audience_safe_reference: `rdx1_${id.replace(/-/gu, '')}` })),
      ['P0001'], /REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE/u);
      // And a reference in any other shape is refused by the CHECK.
      await rejected(() => insertPackage(packageRow(base, { audience_safe_reference: base.version })),
        ['23514'], /_reference_check/u);
    });

    await report.isolated('D09 an approval by a human the package does not require is structurally impossible', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      await q(`INSERT INTO ${D.REQUIRED} (distribution_package_version_id, approver_user_id) VALUES ($1, $2)`,
        [row.id, f.creator]);
      await rejected(() => q(
        `INSERT INTO ${D.APPROVALS} (id, distribution_package_version_id, destination_action,
           approver_user_id, bound_authority_fingerprint, approved_at)
         VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
        [randomUUID(), row.id, row.destination_action, f.stranger, `sha256:${'b'.repeat(64)}`]),
      ['23503'], /replay_distribution_approvals_required_fk/u);
    });

    await report.isolated('D10 an approval for one destination cannot resolve against another', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      await q(`INSERT INTO ${D.REQUIRED} (distribution_package_version_id, approver_user_id) VALUES ($1, $2)`,
        [row.id, f.creator]);
      await rejected(() => q(
        `INSERT INTO ${D.APPROVALS} (id, distribution_package_version_id, destination_action,
           approver_user_id, bound_authority_fingerprint, approved_at)
         VALUES ($1, $2, 'PUBLISH_TO_PUBLIC_WORLD', $3, $4, clock_timestamp())`,
        [randomUUID(), row.id, f.creator, `sha256:${'c'.repeat(64)}`]),
      ['23503'], /replay_distribution_approvals_destination_fk/u);
    });

    await report.isolated('D11 a withdrawal names ONE exact approval through one composite key', async () => {
      const first = packageRow(base);
      const second = packageRow(base, { package_revision: 2 });
      await insertPackage(first);
      await insertPackage(second);
      const approval = randomUUID();
      for (const row of [first, second]) {
        await q(`INSERT INTO ${D.REQUIRED} (distribution_package_version_id, approver_user_id) VALUES ($1, $2)`,
          [row.id, f.creator]);
      }
      await q(`INSERT INTO ${D.APPROVALS} (id, distribution_package_version_id, destination_action,
                 approver_user_id, bound_authority_fingerprint, approved_at)
               VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
      [approval, first.id, first.destination_action, f.creator, `sha256:${'d'.repeat(64)}`]);
      // Approval A's id beside package B is unrepresentable: one composite key,
      // never two independent partial ones.
      await rejected(() => q(
        `INSERT INTO ${D.WITHDRAWALS} (id, approval_id, distribution_package_version_id, approver_user_id, occurred_at)
         VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [randomUUID(), approval, second.id, f.creator]),
      ['23503'], /_approval_fk/u);
      await rejected(() => q(
        `INSERT INTO ${D.WITHDRAWALS} (id, approval_id, distribution_package_version_id, approver_user_id, occurred_at)
         VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [randomUUID(), approval, first.id, f.stranger]),
      ['23503'], /_approval_fk/u);
      await q(`INSERT INTO ${D.WITHDRAWALS} (id, approval_id, distribution_package_version_id, approver_user_id, occurred_at)
               VALUES ($1, $2, $3, $4, clock_timestamp())`,
      [randomUUID(), approval, first.id, f.creator]);
      await rejected(() => q(
        `INSERT INTO ${D.WITHDRAWALS} (id, approval_id, distribution_package_version_id, approver_user_id, occurred_at)
         VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [randomUUID(), approval, first.id, f.creator]),
      ['23505'], /_approval_key/u);
    });

    await report.isolated('D13 a sanitized descriptor cannot move to another package or destination', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      const other = packageRow(base, { package_revision: 2 });
      await insertPackage(other);
      const descriptor = (packageId, destination, reference) => q(
        `INSERT INTO ${D.DESCRIPTORS} (distribution_package_version_id, destination_action,
           audience_safe_reference, sanitization_contract_id, coverage_class, selected_segment_count,
           temporal_gap_count, source_medium_class, original_medium_policy, exact_text_policy,
           semantic_cut_policy, temporal_gap_policy, timing_integrity_policy, analytical_projection_policy,
           camera_emphasis_policy, motion_policy, caption_policy, accessibility_parity_policy,
           reduced_motion_parity_policy, editorial_annotation_policy, descriptor_digest, created_at)
         VALUES ($1, $2, $3, 'QANDEEL_REPLAY_EXPORT_SANITIZATION_V1', 'SELECTED_EXCERPT', 2, 1,
                 'ORIGINAL_TEXT_ONLY', 'PRESERVE_ORIGINAL_MEDIUM_ONLY', 'EXACT_SOURCE_TEXT',
                 'WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
                 'PRESENTATION_PACING_DECLARED', 'BOUND_HISTORICAL_PROJECTION_DIGEST',
                 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
                 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED',
                 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION', $4, clock_timestamp())`,
        [packageId, destination, reference, `sha256:${'e'.repeat(64)}`]);
      await rejected(() => descriptor(row.id, 'DOWNLOAD', row.audience_safe_reference),
        ['23503'], /_package_fk/u);
      await rejected(() => descriptor(row.id, row.destination_action, other.audience_safe_reference),
        ['23503'], /_package_fk/u);
      await descriptor(row.id, row.destination_action, row.audience_safe_reference);
      await rejected(() => q(
        `UPDATE ${D.DESCRIPTORS} SET coverage_class = 'FULL_SOURCE' WHERE distribution_package_version_id = $1`,
        [row.id]), ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
    });

    await report.isolated('D16 an authorization records authorization and never a delivery', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      const authorization = (state, published) => q(
        `INSERT INTO ${D.AUTHORIZATIONS} (distribution_package_version_id, destination_action, replay_id,
           replay_version_id, authorized_by_user_id, authority_request_fingerprint, effective_approval_count,
           distribution_state, safety_state, moderation_state, entitlement_state, feature_state, launch_state,
           prerequisite_clearance_basis, published_experience_version_id, authorized_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 'SAFETY_ALLOW', 'MODERATION_ALLOW', 'ENTITLED',
                 'FEATURE_ENABLED', 'LAUNCH_CLEARED', 'a stated basis', $8, clock_timestamp())`,
        [row.id, row.destination_action, row.replay_id, row.replay_version_id, base.creator,
          `sha256:${'f'.repeat(64)}`, state, published]);
      for (const claim of ['DELIVERED', 'SHARED', 'DOWNLOADED', 'PUBLIC_PUBLICATION_COMMITTED']) {
        await rejected(() => authorization(claim, null), ['23514'], /_state_check/u);
      }
      await authorization('AUTHORIZED_FOR_DELIVERY', null);
      assert.equal(await count(D.AUTHORIZATIONS, 'distribution_package_version_id = $1', [row.id]), 1,
        'D16 an external destination reaches AUTHORIZED_FOR_DELIVERY and nothing more');
    });

    await report.isolated('D17 an authorization cannot exist with an unevaluated CW2-08 dimension', async () => {
      const row = packageRow(base);
      await insertPackage(row);
      const dimensions = ['safety_state', 'moderation_state', 'entitlement_state', 'feature_state', 'launch_state'];
      for (const dimension of dimensions) {
        const values = Object.fromEntries(dimensions.map((name) => [name,
          name === dimension ? 'NOT_EVALUATED'
            : { safety_state: 'SAFETY_ALLOW', moderation_state: 'MODERATION_ALLOW',
              entitlement_state: 'ENTITLED', feature_state: 'FEATURE_ENABLED',
              launch_state: 'LAUNCH_CLEARED' }[name]]));
        await rejected(() => q(
          `INSERT INTO ${D.AUTHORIZATIONS} (distribution_package_version_id, destination_action, replay_id,
             replay_version_id, authorized_by_user_id, authority_request_fingerprint, effective_approval_count,
             distribution_state, safety_state, moderation_state, entitlement_state, feature_state, launch_state,
             prerequisite_clearance_basis, published_experience_version_id, authorized_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, 'AUTHORIZED_FOR_DELIVERY', $7, $8, $9, $10, $11,
                   'a stated basis', NULL, clock_timestamp())`,
          [row.id, row.destination_action, row.replay_id, row.replay_version_id, base.creator,
            `sha256:${'a'.repeat(64)}`, values.safety_state, values.moderation_state,
            values.entitlement_state, values.feature_state, values.launch_state]),
        ['23514'], /_clearance_check/u);
      }
    });

    await report.isolated('D18 every I-06C relation is append-only for every role including the owner', async () => {
      for (const [table, trigger] of I06C_IMMUTABLE) {
        assert.equal(await rt.triggerEnabled(table, trigger), true,
          `D18 ${trigger} guards ${table} right now`);
      }
    });

    await report.isolated('D19 no application role holds any privilege on any I-06C relation', async () => {
      for (const table of OWN_TABLES) {
        for (const role of ['public', ...APP_ROLES]) {
          const [{ any_privilege }] = await rows(
            `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
               FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, table]);
          assert.equal(any_privilege, false, `D19 ${role} holds no privilege on ${table}`);
        }
      }
    });
  } finally {
    await q('ROLLBACK');
  }
}

// -------------------------------------------- 3. the Public bridge structure
async function verifyPublicBridge(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('D14 the Public bridge binds the exact item its RESERVED form and its REPLAY_ARTIFACT provenance', async () => {
      const row = packageRow(base, { destination_action: 'PUBLISH_TO_PUBLIC_WORLD' });
      await insertPackage(row);
      const manifest = randomUUID();
      const experienceVersion = randomUUID();
      const item = randomUUID();
      const textItem = randomUUID();
      await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton,
                 publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                 target_audience_class, authority_readiness, prepared_authority_snapshot_version,
                 item_count, created_at)
               SELECT $1, $2, true, c.controller_public_identity_ref, c.controller_user_id,
                      'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
                      w.state_version, 2, clock_timestamp()
                 FROM public.public_experience_controllers c, public.public_world_state w
                WHERE c.experience_id = $2 AND w.singleton`, [manifest, f.experience]);
      await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
               SELECT $1, $2, $3, coalesce(max(v.version_ordinal), 0) + 1, clock_timestamp()
                 FROM ${T.VERSIONS} v WHERE v.experience_id = $2`, [experienceVersion, f.experience, manifest]);
      const addItem = (id, ordinal, form) => q(
        `INSERT INTO ${T.ITEMS} (manifest_version_id, experience_id, package_item_id, item_ordinal,
           derivative_classification, public_body_form, public_body_digest)
         VALUES ($1, $2, $3, $4, 'SOURCE_CONTENT_BEARING_DERIVATIVE', $5, $6)`,
        [manifest, f.experience, id, ordinal, form, `sha256:${'1'.repeat(64)}`]);
      await addItem(item, 1, 'RESERVED');
      await addItem(textItem, 2, 'PUBLIC_TEXT');
      await q(`INSERT INTO ${T.PROVENANCE} (package_item_id, manifest_version_id, source_class,
                 captured_availability_state, captured_source_digest)
               VALUES ($1, $2, 'REPLAY_ARTIFACT', 'AVAILABLE', $3)`,
      [item, manifest, `sha256:${'1'.repeat(64)}`]);
      await q(`INSERT INTO ${T.PROVENANCE} (package_item_id, manifest_version_id, source_class,
                 personal_conversation_unit_id, personal_owner_user_id,
                 captured_availability_state, captured_source_digest)
               VALUES ($1, $2, 'MY_WORLD', $3, $4, 'AVAILABLE', $5)`,
      [textItem, manifest, base.selectedUnits[0], f.creator, `sha256:${'1'.repeat(64)}`]);

      const bridge = (packageItem, form, sourceClass) => q(
        `INSERT INTO ${D.ARTIFACTS} (package_item_id, public_manifest_version_id, public_experience_id,
           public_body_form, public_source_class, distribution_package_version_id, destination_action,
           replay_version_id, audience_safe_reference, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISH_TO_PUBLIC_WORLD', $7, $8, clock_timestamp())`,
        [packageItem, manifest, f.experience, form, sourceClass, row.id, row.replay_version_id,
          row.audience_safe_reference]);
      // A PUBLIC_TEXT item is not a Replay artifact, and a MY_WORLD provenance
      // row can never be classed REPLAY_ARTIFACT: both halves are structural.
      await rejected(() => bridge(textItem, 'RESERVED', 'REPLAY_ARTIFACT'),
        ['23503'], /_item_fk|_provenance_fk/u);
      await rejected(() => bridge(item, 'PUBLIC_TEXT', 'REPLAY_ARTIFACT'),
        ['23514', '23503'], /_form_check|_item_fk/u);
      await rejected(() => bridge(item, 'RESERVED', 'MY_WORLD'),
        ['23514'], /_source_check/u);
      await bridge(item, 'RESERVED', 'REPLAY_ARTIFACT');
      assert.equal(await count(D.ARTIFACTS, 'package_item_id = $1', [item]), 1,
        'D14 the reserved seam is activated for the exact item and only through it');
    });

    await report.isolated('D15 one Public package item binds exactly ONE Replay distribution package', async () => {
      const [{ existing }] = await rows(
        `SELECT count(*) existing FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.contype = 'u'
            AND c.conname = 'replay_public_distribution_artifacts_package_key'`, [D.ARTIFACTS]);
      assert.equal(Number(existing), 1,
        'D15 a Replay distribution package corresponds to at most one Public artifact, structurally');
      const [{ primary }] = await rows(
        `SELECT (SELECT array_agg(a.attname::text) FROM unnest(c.conkey) k(attnum)
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) primary
           FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'p'`, [D.ARTIFACTS]);
      assert.deepEqual(primary, ['package_item_id'],
        'D15 and one Public package item carries at most one Replay artifact binding');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------- 4. the refused weakenings
/**
 * The refused weakenings, each proven in BOTH directions inside one rolled-back
 * transaction: the refusal really comes from the guard named, because removing
 * that guard makes the refused state possible, and putting it back refuses again.
 *
 * A one-sided proof - "the bad insert failed" - cannot tell a guard that fires
 * from a foreign key, a CHECK or a typo that would have failed anyway.
 */
async function verifyForwardSafety(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    const [guard] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [DFN.OPAQUE_TRIGGER]);
    await report.isolated('f1 the opacity guard is what refuses an internal identity in disguise', async () => {
      const disguised = () => packageRow(base,
        { audience_safe_reference: `rdx1_${base.version.replace(/-/gu, '')}` });
      await rejected(() => insertPackage(disguised()), ['P0001'], /REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE/u);
      const weakened = guard.definition.replace('IF opaque IN (', 'IF false AND opaque IN (');
      assert.notEqual(weakened, guard.definition, 'f1 the weakening changed the guard');
      assert.ok(weakened.includes('IF false AND opaque IN ('), 'f1 and it introduced the dead condition');
      await q(weakened);
      await insertPackage(disguised());
      assert.equal(await count(D.PACKAGES, "audience_safe_reference = $1",
        [`rdx1_${base.version.replace(/-/gu, '')}`]), 1,
      'f1 without the guard the disguised reference really is insertable, so the guard is load-bearing');
      await q(guard.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [DFN.OPAQUE_TRIGGER]);
      assert.equal(prosrc, guard.prosrc, 'f1 the production opacity guard is restored byte for byte');
      await rejected(() => insertPackage(disguised()), ['P0001'], /REPLAY_DISTRIBUTION_REFERENCE_NOT_OPAQUE/u);
    });

    const [mutation] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [DFN.MUTATION_TRIGGER]);
    await report.isolated('f2 the append-only guard is what refuses a mutation by the table owner', async () => {
      const first = packageRow(base);
      await insertPackage(first);
      await rejected(() => q(`UPDATE ${D.PACKAGES} SET required_approver_count = 7 WHERE id = $1`, [first.id]),
        ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
      const weakened = mutation.definition.replace(
        "RAISE EXCEPTION 'REPLAY_DISTRIBUTION_IS_IMMUTABLE'",
        "RETURN NEW; RAISE EXCEPTION 'REPLAY_DISTRIBUTION_IS_IMMUTABLE'");
      assert.notEqual(weakened, mutation.definition, 'f2 the weakening changed the guard');
      assert.ok(weakened.includes('RETURN NEW; RAISE EXCEPTION'), 'f2 and it introduced the early return');
      await q(weakened);
      await q(`UPDATE ${D.PACKAGES} SET required_approver_count = 7 WHERE id = $1`, [first.id]);
      assert.equal(await count(D.PACKAGES, 'id = $1 AND required_approver_count = 7', [first.id]), 1,
        'f2 without the guard the owner really can rewrite an immutable package, so the guard is load-bearing');
      await q(mutation.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [DFN.MUTATION_TRIGGER]);
      assert.equal(prosrc, mutation.prosrc, 'f2 the production append-only guard is restored byte for byte');
      await rejected(() => q(`UPDATE ${D.PACKAGES} SET required_approver_count = 3 WHERE id = $1`, [first.id]),
        ['55000'], /REPLAY_DISTRIBUTION_IS_IMMUTABLE/u);
    });

    await report.isolated('f3 the catalog check refuses a tree whose finalization binding was dropped', async () => {
      await rt.assertExactBinding(D.PACKAGES, 'public.replay_version_finalizations',
        ['replay_version_id', 'replay_id'], ['replay_version_id', 'replay_id']);
      await q(`ALTER TABLE ${D.PACKAGES} DROP CONSTRAINT replay_distribution_package_versions_finalized_fk`);
      let refused = false;
      try {
        await rt.assertExactBinding(D.PACKAGES, 'public.replay_version_finalizations',
          ['replay_version_id', 'replay_id'], ['replay_version_id', 'replay_id']);
      } catch {
        refused = true;
      }
      assert.ok(refused, 'f3 the catalog check really fails when the finalization binding is gone');
      // And an unfinalized version becomes bindable without it, which is the
      // regression the binding exists to make unrepresentable.
      await rejected(() => insertPackage(packageRow(base, { replay_version_id: randomUUID() })),
        ['23503'], /replay_distribution_package_versions_version_fk/u);
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back weakenings', verifyCatalog);
}

// ---------------------------------------------------------------------- main
await runVerifier('0104', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0104', { query: q, restore: () => asRole('postgres') });

  stage('catalog');
  await report.section('the catalog is exactly what the migration installed', verifyCatalog);

  stage('fixture');
  const f = {
    creator: randomUUID(), stranger: randomUUID(), reader: randomUUID(),
    creatorRef: randomUUID(), experience: null,
  };
  f.humans = [f.creator, f.stranger, f.reader];
  let base = null;
  try {
    await q('BEGIN');
    try {
      base = await provisionFixture(f.humans);
      f.experience = await rt.provisionControlledExperience(f.creator, f.creatorRef, 'the replay publisher');
      base.creator = f.creator;
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }

    stage('structure');
    await verifyStructure(report, f, base);
    stage('public bridge');
    await verifyPublicBridge(report, f, base);
    stage('forward safety');
    await verifyForwardSafety(report, f, base);
  } finally {
    stage('fixture removal');
    await rt.removeCommittedDistributions(f.humans);
    await rt.removeCommittedReplayVersions(f.humans);
    await rt.removeCommittedReplays(f.humans);
    await rt.removePublicReplayFixture([f.experience].filter(Boolean));
    await rt.removePublicIdentities(f.humans);
    await rt.removeHistoricalFixture(f.humans);
    await rt.removeFixtureHumans(f.humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyCatalog);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.PACKAGES} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.EXPERIENCES} WHERE id = ANY($2::uuid[])) AS residue`,
    [f.humans, [f.experience].filter(Boolean)]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
