// I-06B - Replay analytical projection, render truth contract and the first
// complete REPLAY_VERSION: the secret-free structural contract for migration
// 0102.
//
// Live semantics - which source classes can be projected, what a sealed
// coordinate means, the anti-oracle refusals, the race matrix - are proven by
// database/verify-migration-0102.mjs and database/verify-migration-0103.mjs
// against real PostgreSQL. What is proven HERE is the structure a migration
// must already have before it deploys: that a complete Replay Version binds ALL
// FOUR components as ONE composition with no nullable truth; that the
// represented TC is the selected item's own canonical Session Position by
// foreign key; that only a SEALED coordinate is representable; that only an
// untrimmed WHOLE_ITEM cut can be SAFE; that a discontinuity is a GENERATED gap
// carrying no omitted content; that the render contract is a truth contract and
// not a codec; that every truth component is append-only for every role
// including the table owner; and that migrations 0001-0101 are byte-identical.
//
// The slice-wide forward-safety and anti-vacuity probe lives in the sibling
// contract for 0103, and runs BOTH I-06B contracts against a mutated tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { FROZEN_PREDECESSORS } from './replay-frozen-predecessors.mjs';
import { I06A_FROZEN } from './replay-version-frozen-predecessors.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0102_replay_analytical_projection_render_contract_versioning_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0102.mjs');
const support = read('../replay-version-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const PROJECTIONS = 'replay_analytical_projection_versions';
const POINTS = 'replay_analytical_projection_points';
const CUTS = 'replay_semantic_cut_assessments';
const GAPS = 'replay_temporal_discontinuities';
const CONTRACTS = 'replay_render_contract_versions';
const VERSIONS = 'replay_versions';
const POINTER = 'replay_current_version_state';
const FINALIZATIONS = 'replay_version_finalizations';
const LIFECYCLE = 'replay_lifecycle_events';
const OWN_TABLES = [PROJECTIONS, POINTS, CUTS, GAPS, CONTRACTS, VERSIONS, POINTER, FINALIZATIONS, LIFECYCLE];
/** Append-only for EVERY role, including the table owner. The pointer is not. */
const APPEND_ONLY = [PROJECTIONS, POINTS, CUTS, GAPS, CONTRACTS, VERSIONS, FINALIZATIONS, LIFECYCLE];
const OWN_SCRIPT = 'verify:replay-analytical-projection-render-contract:integration';

/** The four truth-relevant components every canonical Replay Version binds. */
const COMPONENTS = ['source_manifest_version_id', 'selection_spec_version_id',
  'analytical_projection_version_id', 'render_contract_version_id'];

const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0102 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0102 creates ${name}`);
  const open = migration.indexOf('AS $$', start);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > start && end > open, `${name} has a terminated dollar-quoted body`);
  return migration.slice(open + 'AS $$'.length, end);
};

// ---------------------------------------------------------------------------

test('0102 is the forward migration after 0101, every frozen predecessor is byte-identical, and no predecessor relation is rewritten', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0102_')).length, 1, 'exactly one migration carries the 0102 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0101_replay_authorized_draft_runtime_v1.sql'),
    '0102 is the forward migration after the I-06A draft runtime');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of [...FROZEN_PREDECESSORS, ...I06A_FROZEN]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0102 drops nothing');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?FUNCTION public\.(?!reject_replay_version_component_mutation_v1|replay_current_version_forward_only_v1|replay_lifecycle_transition_v1)/u,
    '0102 replaces no predecessor function');
  assert.doesNotMatch(installedSql, /INSERT INTO/u, 'PART A writes no row');
  assert.doesNotMatch(installedSql, /\bGRANT\b/u, 'PART A grants nothing');

  // THE ONLY PREDECESSOR RELATIONS IT TOUCHES ARE THE FOUR I-06A COMPONENT
  // relations, and it touches them ONLY to ADD a candidate key. No column is
  // added, no constraint is changed and no row is rewritten.
  const I06A_COMPONENTS = ['replay_source_manifest_versions', 'replay_source_manifest_items',
    'replay_selection_spec_items', 'replay_selection_spec_versions'];
  const additive = [...executableSql.matchAll(/ALTER TABLE public\.(\w+)\s+ADD CONSTRAINT (\w+)\s+UNIQUE/gu)];
  assert.equal(additive.length, 6, '0102 adds exactly six additive candidate keys');
  for (const [, table] of additive) {
    assert.ok(I06A_COMPONENTS.includes(table),
      `an additive key is added only to an I-06A component relation, not to ${table}`);
  }
  // EVERY OTHER `ALTER TABLE` NAMES A RELATION THIS MIGRATION JUST CREATED.
  for (const [, altered] of executableSql.matchAll(/ALTER TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(altered) || I06A_COMPONENTS.includes(altered),
      `0102 alters only its own relations and the I-06A relations it adds a key to, not ${altered}`);
  }
  assert.doesNotMatch(executableSql, /ALTER TABLE public\.\w+\s+(?:ADD COLUMN|DROP COLUMN|ALTER COLUMN|DROP CONSTRAINT)/u,
    '0102 adds, drops and alters no column and drops no constraint of any predecessor relation');
});

test('a complete Replay Version binds all four truth components as ONE composition, with no nullable truth', () => {
  const versions = tableBlock(VERSIONS);
  for (const component of COMPONENTS) {
    assert.match(versions, new RegExp(`^\\s+${component} uuid NOT NULL,`, 'mu'),
      `a complete Replay Version binds ${component} and it can never be null`);
  }
  // No placeholder, no PENDING projection, no partial version.
  assert.doesNotMatch(versions, /\bPENDING\b|placeholder|_pending\b/iu, 'no truth component may be PENDING');
  // The composition, as composite foreign keys rather than four independent
  // references that could each name a row of a different Replay.
  assert.match(versions, /FOREIGN KEY \(source_manifest_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_source_manifest_versions \(id, replay_id\)/u);
  assert.match(versions, /FOREIGN KEY \(selection_spec_version_id, source_manifest_version_id\)\s*\n\s*REFERENCES public\.replay_selection_spec_versions \(id, source_manifest_version_id\)/u);
  assert.match(versions, /FOREIGN KEY \(analytical_projection_version_id, selection_spec_version_id,\s*\n\s*source_manifest_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_analytical_projection_versions/u);
  assert.match(versions, /FOREIGN KEY \(render_contract_version_id, analytical_projection_version_id,\s*\n\s*selection_spec_version_id, source_manifest_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_render_contract_versions/u);
  // One complete version per exact render contract, and one revision per Replay.
  assert.match(versions, /CONSTRAINT replay_versions_contract_key UNIQUE \(render_contract_version_id\)/u);
  assert.match(versions, /CONSTRAINT replay_versions_revision_key UNIQUE \(replay_id, replay_version_revision\)/u);
  // And the projection binds its selection the same way: ONE exact row.
  assert.match(tableBlock(PROJECTIONS), /FOREIGN KEY \(selection_spec_version_id, source_manifest_version_id, replay_id, point_count\)\s*\n\s*REFERENCES public\.replay_selection_spec_versions\s*\n\s*\(id, source_manifest_version_id, replay_id, selected_item_count\)/u);
});

test('the analytical projection commits the canonical Personal historical truth and can never carry content', () => {
  const projections = tableBlock(PROJECTIONS);
  const points = tableBlock(POINTS);
  // THE CAPABILITY MATRIX, AS A CONSTRAINT: the only canonical historical
  // analytical substrate this repository has, bound to its exact source class.
  assert.match(projections, /CHECK \(projection_capability = 'PERSONAL_SESSION_HISTORICAL_PROJECTION' AND source_class = 'MY_WORLD'\)/u);
  // The class is READ FROM the manifest, so a Shared or Public manifest can
  // never carry a Personal historical projection however the row is produced.
  assert.match(projections, /FOREIGN KEY \(source_manifest_version_id, source_class\)\s*\n\s*REFERENCES public\.replay_source_manifest_versions \(id, source_class\)/u);
  assert.match(projections, /CHECK \(projection_schema_id = 'QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1'\)/u,
    'the canonicalization schema identity is pinned, so a later reviewed algorithm is a NEW identity');
  assert.match(projections, /CHECK \(projection_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);

  // ONLY A SEALED REPRESENTED POINT IS REPRESENTABLE, and sealed means exactly
  // TC < Live Head, which is checked structurally too.
  assert.match(points, /CONSTRAINT replay_analytical_projection_points_sealed_check CHECK \(projection_sealed\)/u);
  assert.match(points, /CHECK \(projection_live_head > represented_session_position\)/u);
  // THE REPRESENTED TC IS THE SELECTED ITEM'S OWN CANONICAL SESSION POSITION.
  assert.match(points, /FOREIGN KEY \(source_manifest_version_id, source_item_ordinal, represented_session_position\)\s*\n\s*REFERENCES public\.replay_source_manifest_items\s*\n\s*\(manifest_version_id, source_item_ordinal, personal_session_position\)/u);
  assert.match(points, /FOREIGN KEY \(selection_spec_version_id, selected_ordinal, source_manifest_version_id, source_item_ordinal\)\s*\n\s*REFERENCES public\.replay_selection_spec_items/u);
  // THE SOURCE BODY IS NOT SHADOW-COPIED INTO THE ANALYTICAL LAYER. The
  // commitment is a one-way digest and there is no column that could hold text.
  for (const table of [PROJECTIONS, POINTS]) {
    assert.doesNotMatch(tableBlock(table), /^\s+\w*(?:body|content|payload|statement|moment|committed|excerpt|snippet|transcript|caption)\w*\s+\w/mu,
      `${table} carries no source or analytical content column`);
    assert.doesNotMatch(tableBlock(table), /\b(?:json|jsonb|bytea)\b/u, `${table} carries no JSON or binary payload`);
  }
  // NO REPLAY-SPECIFIC HISTORICAL CLOCK, BASELINE OR COVERAGE: migration 0072
  // is the ONE temporal constitution and this slice creates no competitor.
  assert.doesNotMatch(executableSql, /CREATE TABLE public\.replay_\w*(?:semantic_clock|world_version|baseline|coverage)/u);
  assert.ok(selfAssertions.includes('migration 0072 is the ONE temporal constitution'),
    'and the deploy-time guard refuses one');
});

test('Semantic Cut Safety is conservative by structure: only an untrimmed item can be SAFE', () => {
  const cuts = tableBlock(CUTS);
  assert.match(cuts, /CHECK \(assessment_algorithm = 'QANDEEL_REPLAY_SEMANTIC_CUT_SAFETY_V1'\)/u,
    'the assessment algorithm identity is versioned and pinned');
  assert.match(cuts, /CHECK \(assessment_result IN \('SAFE', 'UNPROVEN', 'REQUIRES_EXPANSION', 'REJECTED'\)\)/u,
    'the result vocabulary is complete, so a later reviewed boundary substrate is additive');
  // SAFE requires WHOLE_ITEM, and a partial range can be nothing but UNPROVEN
  // or REJECTED at a baseline with no canonical boundary / attribution substrate.
  assert.match(cuts, /CHECK \(assessment_result <> 'SAFE' OR anchor_kind = 'WHOLE_ITEM'\)/u);
  assert.match(cuts, /CHECK \(anchor_kind <> 'TEXT_CODE_POINT_RANGE' OR assessment_result IN \('UNPROVEN', 'REJECTED'\)\)/u);
  // The assessment names one selected item AND its exact anchor kind as ONE
  // row, so a row that claimed a different anchor kind would not resolve.
  assert.match(cuts, /FOREIGN KEY \(selection_spec_version_id, source_item_ordinal, anchor_kind\)\s*\n\s*REFERENCES public\.replay_selection_spec_items\s*\n\s*\(selection_spec_version_id, source_item_ordinal, anchor_kind\)/u);
  // NO NLP AUTHORITY IS INVENTED to make partial ranges pass.
  assert.doesNotMatch(executableSql, /\b\w*(?:nlp|tokeni[sz]|clause_boundary|sentence_split|parser|segmenter)\w*\b/iu,
    'no semantic-boundary engine is invented here');
});

test('a temporal discontinuity is a derived gap that names no omitted item and copies no omitted content', () => {
  const gaps = tableBlock(GAPS);
  assert.match(gaps, /omitted_source_item_count integer\s*\n\s*GENERATED ALWAYS AS \(right_source_universe_rank - left_source_universe_rank - 1\) STORED/u,
    'the omitted count is GENERATED from the two captured ranks and can never be written');
  assert.match(gaps, /CHECK \(omitted_source_item_count > 0\)/u, 'a contiguous pair is not a discontinuity');
  assert.match(gaps, /CHECK \(right_selected_ordinal = after_selected_ordinal \+ 1\)/u,
    'the right endpoint is the NEXT selected item and nothing else');
  assert.match(gaps, /CHECK \(right_source_item_ordinal > left_source_item_ordinal\s*\n\s*AND right_source_universe_rank > left_source_universe_rank\)/u);
  // Both endpoints, and both captured ranks, are exact rows.
  assert.equal((gaps.match(/REFERENCES public\.replay_selection_spec_items/gu) ?? []).length, 2);
  assert.equal((gaps.match(/REFERENCES public\.replay_source_manifest_items/gu) ?? []).length, 2);
  // NOTHING ABOUT WHAT WAS OMITTED: no identity, body, digest, medium, author
  // or classification of an omitted item exists on this relation.
  assert.doesNotMatch(gaps, /^\s+\w*(?:omitted_(?:item_id|body|text|digest|author|kind|medium|classification))\w*\s+\w/mu,
    'a gap records how many authorized items were omitted and nothing about them');
  assert.doesNotMatch(gaps, /\b(?:json|jsonb|bytea)\b/u);
});

test('the render contract is a truth contract with exact versioned policies, and never a codec', () => {
  const contracts = tableBlock(CONTRACTS);
  assert.match(contracts, /CHECK \(contract_schema_id = 'QANDEEL_REPLAY_RENDER_CONTRACT_V1'\)/u);
  // Every frozen policy family is declared, NOT NULL.
  for (const policy of ['original_medium_policy', 'source_text_policy', 'semantic_cut_policy',
    'temporal_discontinuity_policy', 'timing_integrity_policy', 'analytical_projection_policy',
    'camera_emphasis_policy', 'motion_policy', 'caption_provenance_policy',
    'accessibility_parity_policy', 'reduced_motion_parity_policy', 'editorial_annotation_policy']) {
    assert.match(contracts, new RegExp(`^\\s+${policy} text NOT NULL,`, 'mu'), `the contract declares ${policy}`);
  }
  // ORIGINAL MEDIUM: text only. An opaque audio identity is not a media-fetch
  // capability, so an audio-bearing source has no truthful render at all here.
  assert.match(contracts, /CHECK \(source_medium_class = 'ORIGINAL_TEXT_ONLY'\s*\n\s*AND original_medium_policy = 'PRESERVE_ORIGINAL_MEDIUM_ONLY'\s*\n\s*AND source_text_policy = 'EXACT_SOURCE_TEXT'\)/u);
  // TIMING SEMANTIC INTEGRITY: a text event has no original voice timing, so
  // pacing is declared as PRESENTATION behaviour and never as source timing.
  assert.match(contracts, /CHECK \(timing_integrity_policy = 'PRESENTATION_PACING_DECLARED'\)/u);
  assert.ok(migration.includes('a text event has no original voice timing'),
    'and the migration says why, rather than leaving the reader to guess');
  // THE TRUTH POLICIES, each an exact versioned value.
  for (const value of ['WHOLE_ITEM_ONLY_PROVEN_SAFE', 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
    'BOUND_HISTORICAL_PROJECTION_DIGEST', 'EMPHASIS_WITHOUT_MEANING_CREATION', 'EXPLANATORY_MOTION_ONLY',
    'DERIVED_CAPTION_DISTINCT_FROM_SOURCE', 'EQUIVALENT_TRUTH_REQUIRED', 'NO_EDITORIAL_ANNOTATION']) {
    assert.ok(contracts.includes(value), `the render contract pins ${value}`);
  }
  // AND IT DEFINES NO FINAL VISUAL CRAFT, CODEC, CONTAINER OR STORAGE.
  assert.doesNotMatch(executableSql, /^\s+\w*(?:codec|container|bitrate|resolution|frame_rate|framerate|cdn|storage_|bucket|object_key|watermark|drm|template|font|typograph|choreograph|easing|palette)\w*\s+\w/mu,
    'CW2-05 defers codec, storage, export resolution and final visual craft, and none of it appears here');
  // The contract belongs to ONE exact composition.
  assert.match(contracts, /FOREIGN KEY \(analytical_projection_version_id, selection_spec_version_id,\s*\n\s*source_manifest_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_analytical_projection_versions/u);
});

test('the lifecycle moves only along the frozen transitions and its history cannot be rewritten', () => {
  const lifecycle = tableBlock(LIFECYCLE);
  const transitions = /CONSTRAINT replay_lifecycle_events_transition_check CHECK \(([\s\S]*?)\)\),/u.exec(lifecycle);
  assert.ok(transitions, 'the lifecycle history carries a transition CHECK');
  for (const pair of [["DRAFT", 'PREVIEW_READY'], ['PREVIEW_READY', 'FINALIZED'],
    ['PREVIEW_READY', 'DRAFT'], ['FINALIZED', 'DRAFT']]) {
    assert.ok(transitions[1].includes(`from_lifecycle = '${pair[0]}' AND to_lifecycle = '${pair[1]}'`),
      `the history admits ${pair[0]} -> ${pair[1]}`);
  }
  assert.ok(!transitions[1].includes("from_lifecycle = 'DRAFT' AND to_lifecycle = 'FINALIZED'"),
    'and never a jump straight from DRAFT to FINALIZED');
  // The same law, on the stable Replay, for every role including the owner.
  const guard = functionBody('replay_lifecycle_transition_v1');
  assert.match(guard, /OLD\.current_lifecycle = 'DRAFT' AND NEW\.current_lifecycle = 'PREVIEW_READY'/u);
  assert.match(guard, /OLD\.current_lifecycle = 'PREVIEW_READY' AND NEW\.current_lifecycle = 'FINALIZED'/u);
  assert.match(guard, /OLD\.current_lifecycle = 'PREVIEW_READY' AND NEW\.current_lifecycle = 'DRAFT'/u);
  assert.match(guard, /OLD\.current_lifecycle = 'FINALIZED' AND NEW\.current_lifecycle = 'DRAFT'/u);
  assert.match(guard, /REPLAY_LIFECYCLE_TRANSITION_INVALID/u);
  assert.match(executableSql, /CREATE TRIGGER replays_lifecycle_transition\s*\n\s*BEFORE UPDATE ON public\.replays/u);

  // FINALIZATION EVIDENCE IS KEYED BY THE EXACT VERSION, so I-06C never infers
  // historical finalization from a current lifecycle, and a later edit cannot
  // rewrite whether THIS version was finalized.
  const finalizations = tableBlock(FINALIZATIONS);
  assert.match(finalizations, /CONSTRAINT replay_version_finalizations_pk PRIMARY KEY \(replay_version_id\)/u);
  assert.match(finalizations, /FOREIGN KEY \(replay_id, finalized_by_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u,
    'the finalizing human is bound to the exact Replay creator structurally');
  assert.match(lifecycle, /FOREIGN KEY \(replay_id, actor_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u);
  // The pointer moves forward only and never changes which Replay it belongs to.
  const forward = functionBody('replay_current_version_forward_only_v1');
  assert.match(forward, /NEW\.pointer_revision <> OLD\.pointer_revision \+ 1/u);
  assert.match(forward, /NEW\.replay_id <> OLD\.replay_id/u);
});

test('a Replay Version is never a World, never a distribution artifact and never a Safety or Launch claim', () => {
  for (const table of OWN_TABLES) {
    const block = tableBlock(table);
    assert.doesNotMatch(block, /^\s+\w*(?:world_type|phase|birth_basis|member|episode|governance|proposal|coordinate|embedding|vitality|ranking)\w*\s+(?:uuid|text|integer|bigint|boolean|timestamptz)/mu,
      `${table} carries no World, membership, governance or semantic column`);
    assert.doesNotMatch(block, /^\s+\w*(?:public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|approver|audience)\w*\s+(?:uuid|text|integer|bigint|boolean|timestamptz)/mu,
      `${table} carries no distribution, Safety, Launch or entitlement column: finalized is not distributed`);
  }
  // NO RELATION IN THE SLICE IS A DISTRIBUTION PACKAGE, AN APPROVER SET OR A
  // PUBLIC SURFACE: those are I-06C, and this migration creates none of them.
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0102 creates only its nine relations, not ${created}`);
    assert.doesNotMatch(created, /distribution|approval|approver|publication|publish|share|download|export|sanitiz/u,
      `${created} would be an I-06C distribution relation`);
  }
  // Every foreign key is restrictive: source truth and Replay truth never
  // cascade away, and I-06D keeps the lineage it needs.
  for (const [, action] of executableSql.matchAll(/REFERENCES public\.[\w ,()\n]+? ON DELETE (\w+)/gu)) {
    assert.equal(action, 'RESTRICT', 'every Replay foreign key is restrictive');
  }
  assert.equal((executableSql.match(/REFERENCES public\./gu) ?? []).length,
    (executableSql.match(/ON DELETE RESTRICT/gu) ?? []).length,
    'every REFERENCES in 0102 carries an explicit RESTRICT');
});

test('every truth component is append-only for every role, and every relation is sealed by default', () => {
  for (const table of APPEND_ONLY) {
    assert.match(executableSql,
      new RegExp(`CREATE TRIGGER ${table}_immutable\\s*\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${table}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_replay_version_component_mutation_v1\\(\\)`, 'u'),
      `${table} refuses UPDATE and DELETE by trigger, because privileges do not bind the table owner`);
  }
  assert.match(functionBody('reject_replay_version_component_mutation_v1'), /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
  for (const table of OWN_TABLES) {
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`), `${table} is postgres-owned`);
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`), `${table} has RLS enabled`);
    assert.ok(executableSql.includes(`public.${table}`), `${table} appears in the REVOKE list`);
  }
  assert.doesNotMatch(executableSql, /CREATE POLICY/u, 'zero policies');
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated;/u);
  assert.ok(executableSql.includes('public.replay_lifecycle_events FROM service_role'),
    'the service tier holds no direct table privilege either');
  // Every function 0102 owns returns `trigger`: PART A creates no writer.
  const created = [...executableSql.matchAll(/CREATE FUNCTION public\.(\w+)\(\)\s*\nRETURNS (\w+)/gu)];
  assert.equal(created.length, 3, '0102 creates exactly three functions');
  for (const [, name, returns] of created) {
    assert.equal(returns, 'trigger', `${name} is a trigger function and nothing else: PART A creates no writer`);
    assert.ok(executableSql.includes(`ALTER FUNCTION public.${name}() OWNER TO postgres;`));
    assert.ok(executableSql.includes(`REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC;`));
  }
  for (const [, name] of executableSql.matchAll(/CREATE FUNCTION public\.(\w+)/gu)) {
    assert.doesNotMatch(name, /^(?:create|revise|prepare|finalize|reopen|publish|distribute|export)_/u,
      `${name} would be a writer, and PART A creates none`);
  }
  assert.equal((executableSql.match(/LANGUAGE plpgsql SET search_path=''/gu) ?? []).length, 3);
});

test('the self-assertions refuse to deploy a migration that lost any of this, and ban nothing the roadmap needs', () => {
  assert.ok(SELF_ASSERT_START > 0, '0102 carries a deploy-time self-assertion block');
  for (const phrase of [
    'a Replay is a source-bound artifact, never a World',
    'may carry no distribution Safety Launch or entitlement column',
    'may carry no source or analytical content column',
    'may define no codec container storage or visual craft column',
    'must bind no body relation no sealed provenance and no raw turn',
    'every Replay foreign key is restrictive',
    'a complete Replay Version must bind % and it can never be null',
    'must bind its projection and render contract as ONE exact composition',
    'must bind its selection its manifest its Replay and its point count as ONE exact selection row',
    'must bind its represented TC to the exact manifest item canonical Session Position',
    'only a SEALED represented point may be frozen',
    'only an untrimmed WHOLE_ITEM selection may be SAFE',
    'must bind the exact selected item AND its exact anchor kind as ONE row',
    'the omitted count must be GENERATED from the two captured ranks, never written',
    'a contiguous pair can never be recorded as a discontinuity',
    'every render contract must declare %',
    'original audio cannot be rendered without an authorized media path',
    'the analytical projection capability must be the canonical Personal one',
    'the analytical projection canonicalization schema identity must be pinned',
    'finalization evidence must be keyed by the EXACT Replay Version',
    'must bind the acting human to the exact Replay creator through the identity key',
    'the lifecycle guard must admit exactly the frozen transitions and no jump',
    'must be append-only for every role',
    'the forward-only pointer and the lifecycle transition guards must be installed',
    'must be a trigger function and nothing else',
    'must have row level security enabled',
    'must carry zero policies',
    'must be postgres-owned',
    'must hold no privilege for',
    'PART A is persistence and writes no row',
    'the additive candidate key % must exist',
    'the frozen I-06A immutability chronology and same-row guards must still be in place',
    'the canonical Personal historical projection must exist',
    'the canonical coverage decision must still distinguish a LEGACY UNCOVERED Session',
    'an identifier on % exceeds the PostgreSQL 63-byte limit',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the self-assertions refuse a migration missing: ${phrase}`);
  }
  // A CONTRACT, NOT A CEILING. No assertion may ban the additions I-06C and
  // I-06D must make, or a later slice could only proceed by deleting it.
  for (const future of ['distribution_package', 'distribution_approval', 'required_approver',
    'publish_to_public_world', 'share_externally', 'download', 'export_privacy',
    'source_loss', 'launch_gate']) {
    assert.doesNotMatch(selfAssertions, new RegExp(`RAISE EXCEPTION[^;]*${future}`, 'iu'),
      `no self-assertion may forbid a later reviewed ${future}`);
  }
  // The census is scoped to the relations this migration owns, never to the
  // database - except the ONE narrow ban on a Replay-owned historical clock,
  // which is scoped by an exact `replay_` name prefix and is the whole point.
  assert.ok(selfAssertions.includes("own_tables text[] := ARRAY['replay_analytical_projection_versions'"),
    'the assertions walk 0102 relations only');
  assert.doesNotMatch(selfAssertions, /FROM pg_proc p\s*\n?[^;]*WHERE[^;]*count\(\*\)\s*[<>=]/u,
    'no assertion pins a global catalog count');
});

test('0102 is registered in the toolchain, the focused gate, the I-06B CI group and the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0102\\.mjs"`, 'u'));
  assert.match(readme, /0102_replay_analytical_projection_render_contract_versioning_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.ok(readme.includes('PERSONAL_SESSION_HISTORICAL_PROJECTION'),
    'the README records the one proven analytical projection capability');
  assert.ok(readme.includes('NOT AVAILABLE - no canonical historical analytical substrate'),
    'and states the Shared / Public absence truthfully rather than optimistically');
  assert.match(verifier, /verifier for migration 0102/iu);
  // THE FOCUSED GATE, in migration order, so full API CI is never the debugger.
  const groups = JSON.parse(focused).groups;
  assert.deepEqual(groups['i06b-0102'].verifiers, ['database/verify-migration-0102.mjs']);
  assert.deepEqual(groups['i06b-0103'].verifiers, ['database/verify-migration-0103.mjs']);
  assert.deepEqual(groups['i06b-all'].verifiers,
    ['database/verify-migration-0102.mjs', 'database/verify-migration-0103.mjs'],
    'i06b-all runs both verifiers in migration order');
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0102=PASS; else status=1; fi`));
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06B Replay analytical projection and preview finalization verifiers'));
  assert.ok(step.slice(0, step.indexOf('\n      - ')).includes('exit "$status"'),
    'the grouped I-06B step fails the job when either verifier failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier proves the structure from live rows and refuses the weakenings', () => {
  // The DECLARED scenario, not a code and not the phrase: a code survives
  // deleting the proof under it, and the verifier's own header describes every
  // scenario in prose, so a bare phrase is satisfied by the description of a
  // scenario that no longer runs.
  for (const scenario of [
    'V01 a complete Replay Version binds all four components',
    'V02 a component of another Replay cannot enter a composition',
    'V03 every truth component is append-only for the table owner',
    'V04 an unsealed represented point is unrepresentable',
    'V05 a partial text cut can never be marked SAFE',
    'V06 a fabricated gap over a contiguous pair is unrepresentable',
    'V07 a render contract that claims what it cannot deliver is unrepresentable',
    'V08 the lifecycle moves only along the frozen transitions',
    'V09 finalization evidence is exact-version keyed and creator-bound',
  ]) {
    assert.ok(verifier.includes(`report.isolated('${scenario}'`),
      `the 0102 verifier RUNS the scenario: ${scenario}`);
  }
  for (const needle of ['SAVEPOINT forward_safety', 'anti-vacuity',
    // The concrete refusals, not only the section codes: a section code survives
    // deleting the proof under it, and these do not.
    'REPLAY_VERSION_COMPONENT_IS_IMMUTABLE',
    'REPLAY_LIFECYCLE_TRANSITION_INVALID',
    'REPLAY_CURRENT_VERSION_MUST_ADVANCE',
    'replay_analytical_projection_points_sealed_check',
    'replay_analytical_projection_points_manifest_position_fk',
    'replay_semantic_cut_assessments_safe_check',
    'replay_semantic_cut_assessments_partial_check',
    'replay_temporal_discontinuities_gap_check',
    'replay_versions_projection_fk',
    'replay_versions_contract_fk']) {
    assert.ok(verifier.includes(needle), `the 0102 verifier proves ${needle}`);
  }
  assert.ok(support.includes('removeCommittedReplayVersions') && support.includes('I06B_IMMUTABLE'),
    'the shared I-06B harness knows the new relations and the guards it must lift for teardown');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
});
