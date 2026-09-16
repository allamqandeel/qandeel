// Real-PostgreSQL verifier for migration 0102 - I-06B analytical projection,
// render truth contract and the FIRST COMPLETE REPLAY_VERSION (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live rows written as the table owner (PART A has no writer), that:
//
//   catalog / posture
//     * every relation is postgres-owned, RLS-enabled with zero policies and
//       revoked from every application role; the three trigger functions return
//       trigger and are executable by nobody;
//     * no relation carries a World, distribution, Safety, Launch, content or
//       codec column, and every foreign key is restrictive;
//
//   structure proven by rows
//     * V01 a complete Replay Version binds ALL FOUR components, and an
//           incomplete one is unrepresentable;
//     * V02 a component of another Replay cannot be bound into a composition;
//     * V03 every truth component is append-only for the OWNER;
//     * V04 an unsealed represented point is unrepresentable, and the
//           represented TC must be the selected item's OWN Session Position;
//     * V05 a partial text cut can never be SAFE, and a SAFE assessment must
//           name the exact anchor kind of the exact selected item;
//     * V06 a fabricated gap over a contiguous pair is unrepresentable, and a
//           discontinuity's ranks must be the exact captured ranks;
//     * V07 a render contract that claims an undeliverable medium, a weakened
//           truth policy or a foreign composition is unrepresentable;
//     * V08 the lifecycle moves only along the frozen transitions, and the
//           current-version pointer moves forward exactly one revision;
//     * V09 finalization evidence is exact-version keyed and creator-bound;
//
//   forward safety inside a rolled-back SAVEPOINT: the I-06C / I-06D additions
//   leave the catalog proof passing, and five deliberate weakenings are each
//   refused - each proven non-vacuous by the row the weakened shape admits.
//
// Every independent scenario reports its own outcome through the permanent
// aggregator, so one defect can never hide the ones after it.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  APP_ROLES, I06B_IMMUTABLE, R, V, VFN, createReplayVersionRuntime, runVerifier,
} from './replay-version-verifier-support.mjs';

const rt = createReplayVersionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const OWN_TABLES = [V.PROJECTIONS, V.POINTS, V.CUTS, V.GAPS, V.CONTRACTS, V.VERSIONS,
  V.POINTER, V.FINALIZATIONS, V.LIFECYCLE];
const TRIGGER_FUNCTIONS = ['public.reject_replay_version_component_mutation_v1()',
  'public.replay_current_version_forward_only_v1()', 'public.replay_lifecycle_transition_v1()'];
const WORLD_BAN = /(world_type|phase|birth_basis|member|episode|governance|proposal|approv|coordinate|embedding|vitality|ranking)/u;
const DISTRIBUTION_BAN = /(public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|approver|audience)/u;
const CONTENT_BAN = /(body|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|caption_text|statement|moment|committed)/u;
const CRAFT_BAN = /(codec|container|bitrate|resolution|frame_rate|framerate|cdn|storage_|bucket|object_key|watermark|drm|template|font|typograph|choreograph|easing|palette)/u;
const FORBIDDEN_PARENTS = ['public.publication_package_item_provenance', 'public.shared_world_text_material_bodies',
  'public.shared_world_voice_note_material_bodies', 'public.public_experience_text_derivative_bodies',
  'public.conversation_turns'];
const DIGEST = `sha256:${'a'.repeat(64)}`;
const OTHER_DIGEST = `sha256:${'b'.repeat(64)}`;
const SCHEMA = 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1';
const CUT_ALGORITHM = 'QANDEEL_REPLAY_SEMANTIC_CUT_SAFETY_V1';

const columnsOf = (table) => rows(
  `SELECT a.attname name, ty.typname type, a.attgenerated generated, a.attnotnull required
     FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [table]);
const constraintDefinition = async (table, name) => (await rows(
  'SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2',
  [table, name]))[0]?.def ?? '';

// --------------------------------------------------------------- direct rows
const insertProjection = (s) => q(
  `INSERT INTO ${V.PROJECTIONS}
     (id, replay_id, source_manifest_version_id, selection_spec_version_id, projection_revision,
      source_class, projection_capability, projection_schema_id, point_count, projection_digest, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, clock_timestamp())`,
  [s.id, s.replay, s.manifest, s.selection, s.revision ?? 1, s.sourceClass ?? 'MY_WORLD',
    s.capability ?? 'PERSONAL_SESSION_HISTORICAL_PROJECTION', s.schema ?? SCHEMA, s.points, s.digest ?? DIGEST]);

const insertPoint = (s) => q(
  `INSERT INTO ${V.POINTS}
     (projection_version_id, selected_ordinal, selection_spec_version_id, source_manifest_version_id,
      source_item_ordinal, represented_session_position, projection_sealed, projection_live_head,
      projection_world_version, projection_same_sp_event_sequence, point_digest)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
  [s.projection, s.selected, s.selection, s.manifest, s.sourceItem, s.tc, s.sealed ?? true,
    s.liveHead ?? s.tc + 1, s.world ?? 1, s.sequence ?? 0, s.digest ?? DIGEST]);

const insertCut = (s) => q(
  `INSERT INTO ${V.CUTS}
     (selection_spec_version_id, source_item_ordinal, anchor_kind, assessment_algorithm, assessment_result, assessed_at)
   VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
  [s.selection, s.sourceItem, s.anchorKind, s.algorithm ?? CUT_ALGORITHM, s.result]);

const insertGap = (s) => q(
  `INSERT INTO ${V.GAPS}
     (selection_spec_version_id, after_selected_ordinal, right_selected_ordinal, source_manifest_version_id,
      left_source_item_ordinal, right_source_item_ordinal, left_source_universe_rank, right_source_universe_rank)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [s.selection, s.left, s.right ?? s.left + 1, s.manifest, s.leftItem, s.rightItem, s.leftRank, s.rightRank]);

const insertContract = (s) => q(
  `INSERT INTO ${V.CONTRACTS}
     (id, replay_id, source_manifest_version_id, selection_spec_version_id, analytical_projection_version_id,
      contract_revision, contract_schema_id, source_medium_class, original_medium_policy, source_text_policy,
      semantic_cut_policy, temporal_discontinuity_policy, timing_integrity_policy, analytical_projection_policy,
      camera_emphasis_policy, motion_policy, caption_provenance_policy, accessibility_parity_policy,
      reduced_motion_parity_policy, editorial_annotation_policy, discontinuity_count, contract_digest, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1', $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19, $20, $21, clock_timestamp())`,
  [s.id, s.replay, s.manifest, s.selection, s.projection, s.revision ?? 1,
    s.medium ?? 'ORIGINAL_TEXT_ONLY', s.originalMedium ?? 'PRESERVE_ORIGINAL_MEDIUM_ONLY',
    s.sourceText ?? 'EXACT_SOURCE_TEXT', s.semanticCut ?? 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
    s.discontinuityPolicy ?? 'PERCEPTIBLE_DISCONTINUITY_REQUIRED', s.timing ?? 'PRESENTATION_PACING_DECLARED',
    s.projectionPolicy ?? 'BOUND_HISTORICAL_PROJECTION_DIGEST', s.camera ?? 'EMPHASIS_WITHOUT_MEANING_CREATION',
    s.motion ?? 'EXPLANATORY_MOTION_ONLY', s.caption ?? 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
    s.accessibility ?? 'EQUIVALENT_TRUTH_REQUIRED', s.reducedMotion ?? 'EQUIVALENT_TRUTH_REQUIRED',
    s.editorial ?? 'NO_EDITORIAL_ANNOTATION', s.gaps ?? 0, s.digest ?? OTHER_DIGEST]);

const insertVersion = (s) => q(
  `INSERT INTO ${V.VERSIONS}
     (id, replay_id, replay_version_revision, source_manifest_version_id, selection_spec_version_id,
      analytical_projection_version_id, render_contract_version_id, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())`,
  [s.id, s.replay, s.revision ?? 1, s.manifest, s.selection, s.projection, s.contract]);

const insertLifecycle = (s) => q(
  `INSERT INTO ${V.LIFECYCLE}
     (id, replay_id, event_ordinal, from_lifecycle, to_lifecycle, replay_version_id, actor_user_id, occurred_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())`,
  [s.id ?? randomUUID(), s.replay, s.ordinal ?? 1, s.from, s.to, s.version, s.actor]);

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  for (const table of OWN_TABLES) {
    const [posture] = await rows(
      `SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner,
              (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) policies
         FROM pg_class c WHERE c.oid = $1::regclass`, [table]);
    assert.equal(posture.rls, true, `${table} has RLS enabled`);
    assert.equal(posture.owner, 'postgres', `${table} is postgres-owned`);
    assert.equal(Number(posture.policies), 0, `${table} carries zero policies`);
    for (const role of ['public', ...APP_ROLES]) {
      const [{ any_privilege }] = await rows(
        `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, table]);
      assert.equal(any_privilege, false, `${role} holds no privilege on ${table}`);
    }
    for (const column of await columnsOf(table)) {
      assert.doesNotMatch(column.name, WORLD_BAN, `${table}.${column.name} would be World state`);
      assert.doesNotMatch(column.name, DISTRIBUTION_BAN, `${table}.${column.name} would be distribution or Launch state`);
      assert.doesNotMatch(column.name, CONTENT_BAN, `${table}.${column.name} would be content`);
      assert.doesNotMatch(column.name, CRAFT_BAN, `${table}.${column.name} would be codec or visual craft`);
      assert.ok(!['json', 'jsonb', 'bytea'].includes(column.type), `${table}.${column.name} is no payload`);
    }
    const keys = await rows(
      `SELECT c.conname, c.confdeltype, c.confrelid::regclass::text parent
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f'`, [table]);
    for (const key of keys) {
      assert.equal(key.confdeltype, 'r', `${key.conname} is restrictive`);
      assert.ok(!FORBIDDEN_PARENTS.includes(key.parent),
        `${key.conname} must not bind ${key.parent}: a Replay Version binds identity and never a body`);
    }
  }
  // The three trigger functions: trigger-returning, pinned, executable by nobody.
  for (const fn of TRIGGER_FUNCTIONS) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins an empty search_path`);
    const [{ returns }] = await rows('SELECT pr.prorettype::regtype::text returns FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fn]);
    assert.equal(returns, 'trigger', `${fn} returns trigger and is callable as nothing else`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `${role} must not execute ${fn}`);
    }
  }
  for (const [table, trigger] of I06B_IMMUTABLE) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} guards ${table}`);
  }
  assert.equal(await rt.triggerEnabled(V.POINTER, 'replay_current_version_state_forward_only'), true);
  assert.equal(await rt.triggerEnabled(R.REPLAYS, 'replays_lifecycle_transition'), true);
  // ALL FOUR COMPONENTS ARE REQUIRED, AND THE COMPOSITION IS ONE EXACT ROW.
  const versionColumns = await columnsOf(V.VERSIONS);
  for (const component of ['source_manifest_version_id', 'selection_spec_version_id',
    'analytical_projection_version_id', 'render_contract_version_id']) {
    const column = versionColumns.find((c) => c.name === component);
    assert.ok(column && column.required, `a complete Replay Version requires ${component}`);
  }
  // The exact composite keys, by name and by column count, so deleting one is
  // not silently compensated by another key that happens to reach the same parent.
  for (const [table, name, columns] of [
    [V.VERSIONS, 'replay_versions_projection_fk', 4],
    [V.VERSIONS, 'replay_versions_contract_fk', 5],
    [V.PROJECTIONS, 'replay_analytical_projection_versions_selection_fk', 4],
    [V.PROJECTIONS, 'replay_analytical_projection_versions_class_fk', 2],
    [V.POINTS, 'replay_analytical_projection_points_manifest_position_fk', 3],
    [V.POINTS, 'replay_analytical_projection_points_selected_item_fk', 4],
    [V.CUTS, 'replay_semantic_cut_assessments_item_fk', 3],
    [V.CONTRACTS, 'replay_render_contract_versions_projection_fk', 4],
  ]) {
    const [key] = await rows(
      `SELECT cardinality(c.confkey) n FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.conname = $2 AND c.contype = 'f'`, [table, name]);
    assert.ok(key, `${table} carries ${name}`);
    assert.equal(Number(key.n), columns, `${name} binds its parent as ONE exact row of ${columns} columns`);
  }
  await rt.assertExactBinding(V.VERSIONS, V.PROJECTIONS,
    ['analytical_projection_version_id', 'selection_spec_version_id', 'source_manifest_version_id', 'replay_id'],
    ['id', 'selection_spec_version_id', 'source_manifest_version_id', 'replay_id']);
  await rt.assertExactBinding(V.VERSIONS, V.CONTRACTS,
    ['render_contract_version_id', 'analytical_projection_version_id', 'selection_spec_version_id',
      'source_manifest_version_id', 'replay_id'],
    ['id', 'analytical_projection_version_id', 'selection_spec_version_id', 'source_manifest_version_id', 'replay_id']);
  await rt.assertExactBinding(V.POINTS, R.MANIFEST_ITEMS,
    ['source_manifest_version_id', 'source_item_ordinal', 'represented_session_position'],
    ['manifest_version_id', 'source_item_ordinal', 'personal_session_position']);
  await rt.assertExactBinding(V.CUTS, R.SPEC_ITEMS,
    ['selection_spec_version_id', 'source_item_ordinal', 'anchor_kind'],
    ['selection_spec_version_id', 'source_item_ordinal', 'anchor_kind']);
  // The generated gap count, the sealed pin and the conservative cut rule.
  assert.equal((await columnsOf(V.GAPS)).find((c) => c.name === 'omitted_source_item_count').generated, 's',
    'the omitted count is GENERATED from the captured ranks, never written');
  assert.match(await constraintDefinition(V.POINTS, 'replay_analytical_projection_points_sealed_check'),
    /projection_sealed/u);
  assert.match(await constraintDefinition(V.CUTS, 'replay_semantic_cut_assessments_safe_check'), /WHOLE_ITEM/u);
  assert.match(await constraintDefinition(V.CUTS, 'replay_semantic_cut_assessments_partial_check'), /UNPROVEN/u);
  assert.match(await constraintDefinition(V.GAPS, 'replay_temporal_discontinuities_gap_check'),
    /omitted_source_item_count > 0/u);
  assert.match(await constraintDefinition(V.CONTRACTS, 'replay_render_contract_versions_medium_check'),
    /ORIGINAL_TEXT_ONLY/u);
  assert.match(await constraintDefinition(V.PROJECTIONS, 'replay_analytical_projection_versions_capability_check'),
    /PERSONAL_SESSION_HISTORICAL_PROJECTION/u);
  // AND THE CANONICAL TEMPORAL CONSTITUTION IS STILL THE ONLY ONE.
  assert.notEqual(await rows("SELECT to_regprocedure($1) fn", [VFN.CANONICAL]).then((r) => r[0].fn), null,
    'the canonical Personal historical projection exists and I-06B reuses it');
  assert.equal(Number((await rows(
    `SELECT count(*) n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind = 'r'
        AND c.relname ~ '^replay_.*(semantic_clock|world_version|baseline|coverage)'`))[0].n), 0,
  'and no Replay-owned historical clock, baseline or coverage exists');
}

// -------------------------------------------------------------- 2. fixtures
/** One Replay draft over the Personal historical Session, with the given selection. */
async function draftOver(f, history, { items, selected, starts = null, ends = null }) {
  const spec = {
    command: randomUUID(), replay: randomUUID(), manifest: randomUUID(), selection: randomUUID(),
    sourceClass: 'MY_WORLD', context: history.session, items, selected,
    starts: starts ?? selected.map(() => null), ends: ends ?? selected.map(() => null),
    coverage: 'SELECTED_EXCERPT',
  };
  await actAs(f.mohamed);
  const [created] = await rt.createDraft(spec);
  assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED', 'the I-06A draft path still creates a private draft');
  await asRole('postgres');
  const specItems = await rows(
    `SELECT si.selected_ordinal, si.source_item_ordinal, si.anchor_kind, mi.source_universe_rank,
            mi.personal_session_position
       FROM ${R.SPEC_ITEMS} si JOIN ${R.MANIFEST_ITEMS} mi
         ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
      WHERE si.selection_spec_version_id = $1 ORDER BY si.selected_ordinal`, [spec.selection]);
  return { ...spec, specItems };
}

// ------------------------------------------------------------- 3. structure
async function verifyStructure(report, f, fixtures) {
  const { whole, gap, range } = fixtures;

  await report.isolated('V01 a complete Replay Version binds all four components', async () => {
    const projection = randomUUID();
    const contract = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    for (const item of whole.specItems) {
      await insertPoint({ projection, selected: item.selected_ordinal, selection: whole.selection,
        manifest: whole.manifest, sourceItem: item.source_item_ordinal, tc: item.personal_session_position });
    }
    await insertContract({ id: contract, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection });
    const version = randomUUID();
    await insertVersion({ id: version, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection, contract });
    assert.equal(await count(V.VERSIONS, 'id = $1', [version]), 1, 'the first complete Replay Version exists');
    // AND AN INCOMPLETE ONE IS UNREPRESENTABLE: every component is NOT NULL.
    for (const [column, value] of [['analytical_projection_version_id', null], ['render_contract_version_id', null]]) {
      await rejected(() => q(
        `INSERT INTO ${V.VERSIONS} (id, replay_id, replay_version_revision, source_manifest_version_id,
           selection_spec_version_id, analytical_projection_version_id, render_contract_version_id, created_at)
         VALUES ($1, $2, 9, $3, $4, $5, $6, clock_timestamp())`,
        [randomUUID(), whole.replay, whole.manifest, whole.selection,
          column === 'analytical_projection_version_id' ? value : projection,
          column === 'render_contract_version_id' ? value : contract]), ['23502']);
    }
  });

  await report.isolated('V02 a component of another Replay cannot enter a composition', async () => {
    const projection = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    // The projection must belong to the selection AND the manifest AND the
    // Replay AND carry the selection's own selected count, as ONE row.
    await rejected(() => insertProjection({ id: randomUUID(), replay: gap.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length, revision: 2 }), ['23503']);
    await rejected(() => insertProjection({ id: randomUUID(), replay: whole.replay, manifest: gap.manifest,
      selection: whole.selection, points: whole.specItems.length, revision: 3 }), ['23503']);
    await rejected(() => insertProjection({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length + 1, revision: 4 }), ['23503']);
    // A Shared or Public manifest could never carry this capability, and a
    // capability this repository cannot prove is unrepresentable.
    await rejected(() => insertProjection({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length, revision: 5,
      capability: 'SHARED_WORLD_HISTORICAL_PROJECTION' }), ['23514']);
    await rejected(() => insertProjection({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length, revision: 6, sourceClass: 'SHARED_WORLD' }), ['23514']);
    await rejected(() => insertProjection({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length, revision: 7, schema: 'SOMETHING_ELSE_V1' }), ['23514']);
    // A render contract of a foreign projection cannot be bound.
    await insertContract({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection });
    await rejected(() => insertContract({ id: randomUUID(), replay: gap.replay, manifest: whole.manifest,
      selection: whole.selection, projection, revision: 2 }), ['23503']);
  });

  await report.isolated('V03 every truth component is append-only for the table owner', async () => {
    const projection = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    await rejected(() => q(`UPDATE ${V.PROJECTIONS} SET projection_digest = $2 WHERE id = $1`, [projection, OTHER_DIGEST]),
      ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
    await rejected(() => q(`DELETE FROM ${V.PROJECTIONS} WHERE id = $1`, [projection]),
      ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
    const item = whole.specItems[0];
    await insertPoint({ projection, selected: item.selected_ordinal, selection: whole.selection,
      manifest: whole.manifest, sourceItem: item.source_item_ordinal, tc: item.personal_session_position });
    await rejected(() => q(`UPDATE ${V.POINTS} SET point_digest = $2 WHERE projection_version_id = $1`,
      [projection, OTHER_DIGEST]), ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
    await insertCut({ selection: whole.selection, sourceItem: item.source_item_ordinal,
      anchorKind: item.anchor_kind, result: 'SAFE' });
    await rejected(() => q(`UPDATE ${V.CUTS} SET assessment_result = 'REJECTED' WHERE selection_spec_version_id = $1`,
      [whole.selection]), ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
  });

  await report.isolated('V04 an unsealed represented point is unrepresentable', async () => {
    const projection = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    const item = whole.specItems[0];
    const base = { projection, selected: item.selected_ordinal, selection: whole.selection,
      manifest: whole.manifest, sourceItem: item.source_item_ordinal, tc: item.personal_session_position };
    // Sealed is pinned TRUE, and sealed MEANS the represented position is
    // strictly before the Live Head.
    await rejected(() => insertPoint({ ...base, sealed: false }), ['23514'],
      /replay_analytical_projection_points_sealed_check/u);
    await rejected(() => insertPoint({ ...base, liveHead: item.personal_session_position }), ['23514'],
      /replay_analytical_projection_points_live_head_check/u);
    // AND THE REPRESENTED TC IS THE SELECTED ITEM'S OWN CANONICAL SESSION
    // POSITION: another real position of the same Session is refused.
    const other = whole.specItems[1];
    await rejected(() => insertPoint({ ...base, tc: other.personal_session_position }), ['23503'],
      /replay_analytical_projection_points_manifest_position_fk/u);
    await insertPoint(base);
    assert.equal(await count(V.POINTS, 'projection_version_id = $1', [projection]), 1,
      'V04 the point whose represented TC IS its own item position is accepted');
  });

  await report.isolated('V05 a partial text cut can never be marked SAFE', async () => {
    const partial = range.specItems.find((i) => i.anchor_kind === 'TEXT_CODE_POINT_RANGE');
    assert.ok(partial, 'V05 the fixture carries a code-point range selection');
    await rejected(() => insertCut({ selection: range.selection, sourceItem: partial.source_item_ordinal,
      anchorKind: 'TEXT_CODE_POINT_RANGE', result: 'SAFE' }), ['23514'],
    /replay_semantic_cut_assessments_(safe|partial)_check/u);
    // Claiming the WHOLE_ITEM anchor it does not have does not help: the
    // assessment binds the selected item AND its anchor kind as ONE row.
    await rejected(() => insertCut({ selection: range.selection, sourceItem: partial.source_item_ordinal,
      anchorKind: 'WHOLE_ITEM', result: 'SAFE' }), ['23503'], /replay_semantic_cut_assessments_item_fk/u);
    // UNPROVEN is what it is, and it is recordable.
    await insertCut({ selection: range.selection, sourceItem: partial.source_item_ordinal,
      anchorKind: 'TEXT_CODE_POINT_RANGE', result: 'UNPROVEN' });
    assert.equal(await count(V.CUTS, 'selection_spec_version_id = $1', [range.selection]), 1,
      'V05 an unproven partial cut is recorded truthfully');
    // And an unversioned algorithm is refused.
    const whole0 = range.specItems.find((i) => i.anchor_kind === 'WHOLE_ITEM');
    if (whole0) {
      await rejected(() => insertCut({ selection: range.selection, sourceItem: whole0.source_item_ordinal,
        anchorKind: 'WHOLE_ITEM', result: 'SAFE', algorithm: 'ad-hoc' }), ['23514']);
    }
  });

  await report.isolated('V06 a fabricated gap over a contiguous pair is unrepresentable', async () => {
    const [left, right] = gap.specItems;
    assert.ok(right.source_universe_rank > left.source_universe_rank + 1,
      'V06 the fixture selection really is non-contiguous in the captured universe');
    await insertGap({ selection: gap.selection, left: left.selected_ordinal, manifest: gap.manifest,
      leftItem: left.source_item_ordinal, rightItem: right.source_item_ordinal,
      leftRank: left.source_universe_rank, rightRank: right.source_universe_rank });
    const [recorded] = await rows(
      `SELECT omitted_source_item_count omitted FROM ${V.GAPS} WHERE selection_spec_version_id = $1`, [gap.selection]);
    assert.equal(Number(recorded.omitted), right.source_universe_rank - left.source_universe_rank - 1,
      'V06 the omitted count is derived from the two captured ranks');
    // A CONTIGUOUS PAIR IS NOT A DISCONTINUITY: the generated count would be 0.
    const contiguous = whole.specItems;
    await rejected(() => insertGap({ selection: whole.selection, left: contiguous[0].selected_ordinal,
      manifest: whole.manifest, leftItem: contiguous[0].source_item_ordinal,
      rightItem: contiguous[1].source_item_ordinal, leftRank: contiguous[0].source_universe_rank,
      rightRank: contiguous[1].source_universe_rank }), ['23514'],
    /replay_temporal_discontinuities_gap_check/u);
    // A RANK THAT IS NOT THE ITEM'S OWN CAPTURED RANK IS REFUSED.
    await rejected(() => insertGap({ selection: gap.selection, left: left.selected_ordinal, manifest: gap.manifest,
      leftItem: left.source_item_ordinal, rightItem: right.source_item_ordinal,
      leftRank: left.source_universe_rank, rightRank: right.source_universe_rank + 1 }), ['23503', '23505']);
    // And the right endpoint is the NEXT selected item and nothing else.
    await rejected(() => insertGap({ selection: gap.selection, left: left.selected_ordinal, right: 9,
      manifest: gap.manifest, leftItem: left.source_item_ordinal, rightItem: right.source_item_ordinal,
      leftRank: left.source_universe_rank, rightRank: right.source_universe_rank }), ['23514', '23505']);
  });

  await report.isolated('V07 a render contract that claims what it cannot deliver is unrepresentable', async () => {
    const projection = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    const base = { replay: whole.replay, manifest: whole.manifest, selection: whole.selection, projection };
    // AN UNDELIVERABLE ORIGINAL MEDIUM: an opaque audio identity is not a media
    // delivery capability, so an audio-bearing contract cannot exist at all.
    await rejected(() => insertContract({ ...base, id: randomUUID(), medium: 'ORIGINAL_AUDIO_BEARING' }),
      ['23514'], /replay_render_contract_versions_medium_check/u);
    // A TEXT EVENT HAS NO ORIGINAL VOICE TIMING.
    await rejected(() => insertContract({ ...base, id: randomUUID(), revision: 2,
      timing: 'ORIGINAL_CONVERSATIONAL_TIMING' }), ['23514'], /replay_render_contract_versions_timing_check/u);
    // EVERY TRUTH POLICY IS AN EXACT VERSIONED VALUE.
    for (const weakened of [{ semanticCut: 'ANY_CUT_ALLOWED' }, { discontinuityPolicy: 'GAPS_MAY_BE_INVISIBLE' },
      { camera: 'CAMERA_MAY_CREATE_IMPORTANCE' }, { caption: 'CAPTION_IS_SOURCE_TRUTH' },
      { accessibility: 'BEST_EFFORT' }, { reducedMotion: 'BEST_EFFORT' },
      { editorial: 'EDITORIAL_NARRATION_ALLOWED' }, { projectionPolicy: 'CURRENT_UNDERSTANDING' }]) {
      await rejected(() => insertContract({ ...base, id: randomUUID(), revision: 3, ...weakened }),
        ['23514'], /replay_render_contract_versions_truth_check/u);
    }
    await insertContract({ ...base, id: randomUUID(), revision: 4 });
    assert.equal(await count(V.CONTRACTS, 'analytical_projection_version_id = $1', [projection]), 1,
      'V07 exactly the truthful contract is representable');
  });

  await report.isolated('V08 the lifecycle moves only along the frozen transitions', async () => {
    const projection = randomUUID();
    const contract = randomUUID();
    const version = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    await insertContract({ id: contract, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection });
    await insertVersion({ id: version, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection, contract });
    // A JUMP IS UNREPRESENTABLE, for the table owner too.
    await rejected(() => q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'FINALIZED' WHERE id = $1`, [whole.replay]),
      ['55000'], /REPLAY_LIFECYCLE_TRANSITION_INVALID/u);
    await q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'PREVIEW_READY' WHERE id = $1`, [whole.replay]);
    await q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'FINALIZED' WHERE id = $1`, [whole.replay]);
    await q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'DRAFT' WHERE id = $1`, [whole.replay]);
    await rejected(() => q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'FINALIZED' WHERE id = $1`, [whole.replay]),
      ['55000'], /REPLAY_LIFECYCLE_TRANSITION_INVALID/u);
    // The history admits exactly those transitions, and no invented one.
    await insertLifecycle({ replay: whole.replay, ordinal: 1, from: 'DRAFT', to: 'PREVIEW_READY',
      version, actor: whole.actor });
    await rejected(() => insertLifecycle({ replay: whole.replay, ordinal: 2, from: 'DRAFT', to: 'FINALIZED',
      version, actor: whole.actor }), ['23514'], /replay_lifecycle_events_transition_check/u);
    // The current-version pointer moves forward exactly one revision.
    await q(`INSERT INTO ${V.POINTER} (replay_id, current_replay_version_id, pointer_revision, updated_at)
             VALUES ($1, $2, 1, clock_timestamp())`, [whole.replay, version]);
    await rejected(() => q(`UPDATE ${V.POINTER} SET pointer_revision = 5 WHERE replay_id = $1`, [whole.replay]),
      ['55000'], /REPLAY_CURRENT_VERSION_MUST_ADVANCE/u);
    await q(`UPDATE ${V.POINTER} SET pointer_revision = 2, updated_at = clock_timestamp() WHERE replay_id = $1`,
      [whole.replay]);
    assert.equal(Number((await rows(`SELECT pointer_revision r FROM ${V.POINTER} WHERE replay_id = $1`,
      [whole.replay]))[0].r), 2, 'V08 the pointer advanced exactly one revision');
  });

  await report.isolated('V09 finalization evidence is exact-version keyed and creator-bound', async () => {
    const projection = randomUUID();
    const contract = randomUUID();
    const version = randomUUID();
    await insertProjection({ id: projection, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, points: whole.specItems.length });
    await insertContract({ id: contract, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection });
    await insertVersion({ id: version, replay: whole.replay, manifest: whole.manifest,
      selection: whole.selection, projection, contract });
    const evidence = (actor) => q(
      `INSERT INTO ${V.FINALIZATIONS} (replay_version_id, replay_id, finalized_by_user_id, finalized_at)
       VALUES ($1, $2, $3, clock_timestamp())`, [version, whole.replay, actor]);
    // ANOTHER HUMAN CANNOT BE RECORDED AS THE FINALIZER.
    await rejected(() => evidence(whole.stranger), ['23503'], /replay_version_finalizations_creator_fk/u);
    await evidence(whole.actor);
    // ONE FINALIZATION PER EXACT VERSION, AND IT CAN NEVER BE REBOUND.
    await rejected(() => evidence(whole.actor), ['23505']);
    await rejected(() => q(`UPDATE ${V.FINALIZATIONS} SET finalized_at = clock_timestamp() WHERE replay_version_id = $1`,
      [version]), ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
    await rejected(() => q(`DELETE FROM ${V.FINALIZATIONS} WHERE replay_version_id = $1`, [version]),
      ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
  });
}

// --------------------------------------------------------- 4. forward safety
async function verifyForwardSafety(report, fixtures) {
  const { whole } = fixtures;
  await asRole('postgres');

  await report.isolated('forward safety: the I-06C and I-06D additions leave the catalog proof passing', async () => {
    await q(`CREATE TABLE public.replay_distribution_package_versions (
               id uuid PRIMARY KEY,
               replay_version_id uuid NOT NULL REFERENCES ${V.VERSIONS} (id) ON DELETE RESTRICT,
               destination_class text NOT NULL, prepared_at timestamptz NOT NULL)`);
    await q(`CREATE TABLE public.replay_distribution_approvals (
               id uuid PRIMARY KEY,
               package_version_id uuid NOT NULL REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,
               approver_user_id uuid NOT NULL, approved_at timestamptz NOT NULL)`);
    await q(`CREATE TABLE public.replay_source_loss_records (
               source_manifest_version_id uuid PRIMARY KEY REFERENCES ${R.MANIFESTS} (id) ON DELETE RESTRICT,
               noted_at timestamptz NOT NULL)`);
    await q(`ALTER TABLE ${V.PROJECTIONS} ADD COLUMN client_ref text`);
    await q(`CREATE INDEX replay_versions_created_probe_idx ON ${V.VERSIONS} (created_at)`);
    await verifyCatalog();
  });

  const probes = [
    ['f1 a complete Replay Version stops requiring its analytical projection',
      async () => q(`ALTER TABLE ${V.VERSIONS} ALTER COLUMN analytical_projection_version_id DROP NOT NULL`),
      async (weak) => {
        await q(`INSERT INTO ${V.VERSIONS} (id, replay_id, replay_version_revision, source_manifest_version_id,
                   selection_spec_version_id, analytical_projection_version_id, render_contract_version_id, created_at)
                 VALUES ($1, $2, 8, $3, $4, NULL, $5, clock_timestamp())`,
        [randomUUID(), whole.replay, whole.manifest, whole.selection, weak.contract]);
        return count(V.VERSIONS, 'replay_id = $1 AND analytical_projection_version_id IS NULL', [whole.replay]);
      }],
    ['f2 an unsealed represented point becomes freezable',
      async () => q(`ALTER TABLE ${V.POINTS} DROP CONSTRAINT replay_analytical_projection_points_sealed_check`),
      async (weak) => {
        const item = whole.specItems[0];
        await insertPoint({ projection: weak.projection, selected: item.selected_ordinal,
          selection: whole.selection, manifest: whole.manifest, sourceItem: item.source_item_ordinal,
          tc: item.personal_session_position, sealed: false, liveHead: item.personal_session_position + 1 });
        return count(V.POINTS, 'projection_version_id = $1 AND NOT projection_sealed', [weak.projection]);
      }],
    ['f3 a partial text cut becomes markable SAFE',
      async () => {
        await q(`ALTER TABLE ${V.CUTS} DROP CONSTRAINT replay_semantic_cut_assessments_safe_check`);
        await q(`ALTER TABLE ${V.CUTS} DROP CONSTRAINT replay_semantic_cut_assessments_partial_check`);
      },
      async (weak) => {
        await insertCut({ selection: weak.rangeSelection, sourceItem: weak.rangeItem,
          anchorKind: 'TEXT_CODE_POINT_RANGE', result: 'SAFE' });
        return count(V.CUTS, "selection_spec_version_id = $1 AND assessment_result = 'SAFE'", [weak.rangeSelection]);
      }],
    ['f4 a contiguous pair becomes recordable as a discontinuity',
      async () => q(`ALTER TABLE ${V.GAPS} DROP CONSTRAINT replay_temporal_discontinuities_gap_check`),
      async () => {
        const [left, right] = whole.specItems;
        await insertGap({ selection: whole.selection, left: left.selected_ordinal, manifest: whole.manifest,
          leftItem: left.source_item_ordinal, rightItem: right.source_item_ordinal,
          leftRank: left.source_universe_rank, rightRank: right.source_universe_rank });
        return count(V.GAPS, 'selection_spec_version_id = $1 AND omitted_source_item_count = 0', [whole.selection]);
      }],
    ['f5 a Shared manifest becomes able to carry a Personal historical projection',
      async () => q(`ALTER TABLE ${V.PROJECTIONS} DROP CONSTRAINT replay_analytical_projection_versions_capability_check`),
      async () => {
        await insertProjection({ id: randomUUID(), replay: whole.replay, manifest: whole.manifest,
          selection: whole.selection, points: whole.specItems.length, revision: 8,
          capability: 'SHARED_WORLD_HISTORICAL_PROJECTION', sourceClass: 'MY_WORLD' });
        return count(V.PROJECTIONS, "replay_id = $1 AND projection_capability <> 'PERSONAL_SESSION_HISTORICAL_PROJECTION'",
          [whole.replay]);
      }],
  ];

  // Each probe is anti-vacuity by construction: it proves the canonical catalog
  // check PASSES on the intact schema, proves the weakening ADMITS a row the
  // intact schema refuses, and only then requires the check to refuse. A probe
  // whose weakening matched nothing would fail on the middle step instead of
  // reporting a refusal that never happened.
  for (const [name, weaken, admit] of probes) {
    await report.isolated(name, async () => {
      const weak = {
        projection: randomUUID(), contract: randomUUID(),
        rangeSelection: fixtures.range.selection,
        rangeItem: fixtures.range.specItems.find((i) => i.anchor_kind === 'TEXT_CODE_POINT_RANGE').source_item_ordinal,
      };
      await insertProjection({ id: weak.projection, replay: whole.replay, manifest: whole.manifest,
        selection: whole.selection, points: whole.specItems.length, revision: 20 });
      await insertContract({ id: weak.contract, replay: whole.replay, manifest: whole.manifest,
        selection: whole.selection, projection: weak.projection, revision: 20 });
      // BEFORE the weakening the canonical catalog proof passes.
      await verifyCatalog();
      await weaken();
      // The weakening ADMITS the row the intact shape refuses - which is what
      // makes this probe non-vacuous - and the catalog proof then FAILS.
      const admitted = Number(await admit(weak));
      assert.ok(admitted >= 1, `${name}: the weakened shape must admit the row the intact shape refuses`);
      let refused = false;
      try { await verifyCatalog(); } catch { refused = true; }
      assert.ok(refused, `${name}: the canonical catalog proof ACCEPTED the weakened state`);
    });
  }
}

// -------------------------------------------------------------------- main
runVerifier('0102', async (stage) => {
  await rt.client.connect();
  const f = rt.newFixture();
  const report = createScenarioReport('0102', { query: q, restore: () => asRole('postgres') });
  await q('BEGIN');
  try {
    stage('fixtures');
    await rt.provision(f);
    const history = await rt.provisionHistoricalSession(f.mohamed, { units: 5 });
    const units = history.units;
    // THREE DRAFTS, ONE SOURCE: a contiguous whole-item selection, a
    // non-contiguous one, and one that trims a text item.
    const whole = { ...await draftOver(f, history, { items: units.slice(0, 3), selected: units.slice(0, 3) }),
      actor: f.mohamed, stranger: f.hadir };
    const gap = { ...await draftOver(f, history, { items: units, selected: [units[0], units[3]] }),
      actor: f.mohamed, stranger: f.hadir };
    const range = { ...await draftOver(f, history, { items: units.slice(0, 2), selected: units.slice(0, 2),
      starts: [null, 0], ends: [null, 4] }), actor: f.mohamed, stranger: f.hadir };
    await asRole('postgres');

    stage('catalog');
    await report.section('catalog posture, composition bindings and the one temporal constitution', verifyCatalog);

    stage('structure');
    await verifyStructure(report, f, { whole, gap, range });

    stage('forward safety');
    await q('SAVEPOINT forward_safety');
    try {
      await verifyForwardSafety(report, { whole, gap, range });
    } finally {
      await q('ROLLBACK TO SAVEPOINT forward_safety').catch(() => undefined);
      await q('RELEASE SAVEPOINT forward_safety').catch(() => undefined);
      await asRole('postgres');
    }

    stage('report');
    report.print();
    report.assertAllPassed();
  } finally {
    // The whole run is ONE transaction that never commits: nothing this
    // verifier wrote survives it, so it needs no teardown and leaves the
    // database exactly as it found it.
    await q('ROLLBACK').catch(() => undefined);
  }
}, () => rt.client.end().catch(() => undefined));
