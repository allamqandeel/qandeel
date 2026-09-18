// QAN-CW-REM-01 - Shared historical authority resolution v1: secret-free
// structural contract over migration 0119.
//
// Migration 0119 corrects an accepted fail-open authority defect (ASSURE-F02):
// the canonical QANDEEL Shared material producer recorded a POSITIVELY RESOLVED
// EMPTY human requirement for material about which it had established nothing.
// The correction is one arm of one CASE, plus the forward reconciliation of rows
// already written under it, plus two consequential boundaries that must re-ask.
//
// This contract proves the SHAPE before deploy. Live semantics - refusals, ACL
// behaviour, the reconciliation on a real pre-remediation row, effective
// visibility, the Public composition and the ASSURE-F04 verdict - are proven by
// database/verify-migration-0119.mjs against real PostgreSQL, which this file
// also pins into the toolchain, CI and the database README.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against EXECUTABLE SQL only, and never
// against the terminal self-assertion block, which names the words it refuses and
// would otherwise make every such assertion match itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAME = '0119_shared_historical_authority_remediation_v1.sql';
const SOURCE = read(`../migrations/${NAME}`);
const VERIFIER = read('../verify-migration-0119.mjs');
const PREDECESSOR_0090 = read('../verify-migration-0090.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/** One migration's text between two markers, comments and COMMENT literals removed. */
const sliceOf = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `the source contains "${from}"`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `the source contains "${to}" after "${from}"`);
  return stripComments(source.slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
/** The executable statements of the migration, its terminal self-assertions excluded. */
const body = () => sliceOf(SOURCE, 'BEGIN;', 'Terminal self-assertions');
/** One function's declaration through to the statement that follows it. */
const functionOf = (signature, until) => sliceOf(SOURCE, signature, until);
/**
 * One function's PROLOGUE - its name, parameter list and result shape - from any
 * migration, normalised so a forward replacement can be compared with the
 * declaration it replaces.
 *
 * This is how "the signature did not change" is proven: by equality with the
 * frozen predecessor's own text, rather than by a word list that would have to
 * guess which parameter names are suspicious. `p_authority_revalidation_ref` is
 * a frozen I-03 evidence reference and must stay; a new `p_required_approvers`
 * must never appear; only the predecessor can settle which is which.
 */
const prologueOf = (source, name) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const end = source.indexOf('LANGUAGE plpgsql', start);
  assert.ok(end > start, `${name} has a language clause`);
  return source.slice(start, end).trim();
};
/** The git blob id of one file's LF content: what `git rev-parse HEAD:<path>` prints. */
const blobIdOf = (content) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');

const QANDEEL_CORE = 'CREATE OR REPLACE FUNCTION public.commit_shared_world_qandeel_material_v1(';
const GRANT_CORE = 'CREATE OR REPLACE FUNCTION public.commit_shared_world_history_access_grant_v1(';
const ENTRY_POINT = 'CREATE OR REPLACE FUNCTION public.resolve_shared_world_history_visibility_v1(';
const CLOSED_READER = 'CREATE OR REPLACE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(';
const RECONCILE = 'CREATE FUNCTION public.reconcile_shared_world_material_historical_authority_v1(';

// Every Connected Worlds migration from the I-02A foundation to the I-07D tip,
// pinned by git blob id at the QAN-CW-REM-01 canonical baseline. "Forward-only"
// is the load-bearing claim of this task, and a claim nobody checks is a claim
// nobody notices losing.
const FROZEN_MIGRATIONS = {
  '0075_connected_worlds_shared_persistence_foundation_v1.sql': '3119d34a4edd4c934067393eb278077fd294852b',
  '0076_shared_world_standing_context_grant_persistence_v1.sql': '3b2e1f35f1a7441ac09c482877294df5d42b9693',
  '0077_shared_standing_context_grant_resolution_boundary_v1.sql': '2d14702f11fda7379d911e275c4e4c6ce1f6732d',
  '0078_shared_standing_context_consent_commands_v1.sql': '9f5d169627b1b888ba1ddb1ab1151d1895eb07da',
  '0079_shared_human_audience_snapshot_resolution_v1.sql': 'e3b3f6397d02a82e4f472da26795913b0b67ae7b',
  '0080_shared_pre_model_world_state_resolution_v1.sql': '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0',
  '0081_shared_direct_invitation_runtime_v1.sql': '19789819a2076830fbc0d328909e3f4e8a35be66',
  '0082_shared_direct_world_birth_transaction_v1.sql': 'c7c575b246f01ce05944c7270428bea89d151a68',
  '0083_shared_world_standard_voluntary_leave_v1.sql': '91e4e427a2cfb7071a68bd59e0a9d2e37559d950',
  '0084_shared_world_governance_approval_foundation_v1.sql': '7b77087dc229b3dfee10ce1b175ffc9b16008aca',
  '0085_shared_world_governed_membership_lifecycle_v1.sql': 'd9d05ca2ec7dd11deea7426c80afc06571ec263c',
  '0086_shared_world_governed_settings_v1.sql': '2e78d1b751b5158b3ccf04ebaf1e614d76593f77',
  '0087_shared_world_selective_history_access_v1.sql': '46606903867c8cc3570d61ee068d0baf6b9d65d8',
  '0088_shared_world_standard_closure_v1.sql': 'dff71de8fbfc2f834d2d267949359d2ebbd3effe',
  '0089_shared_world_material_persistence_v1.sql': '82d6d5f0c293528649198efee2305ca0baa7b685',
  '0090_shared_world_material_commit_owner_deletion_v1.sql': 'c65bb170449e98454b4ba248dad3793b6ea363f8',
  '0091_public_world_experience_identity_foundation_v1.sql': '9fd901f7bbb8f6046af87e6a70bb5b2a0823e5c9',
  '0092_public_experience_publication_package_authority_v1.sql': 'c9fb25926dd86127de275a296cf4bbcf04ea5ab9',
  '0093_public_experience_review_ready_runtime_v1.sql': 'e9a2d94f9a113f0864b98ab9753ac600afb6300a',
  '0094_public_publication_effective_approval_state_v1.sql': '0369e74387b17daaf7343d730c9040b1203a3c09',
  '0095_public_experience_publication_visibility_serving_v1.sql': '1932ee0b07d6c3f686ef865975ab77306c6602fb',
  '0096_public_semantic_placement_discussion_qandeel_v1.sql': '047136c5c780b7d4d314bc7321fa01621707e1a5',
  '0097_public_vitality_search_lens_panel_projections_v1.sql': 'a5c58da00c77d4951da7396bd7d4db7ddc723f71',
  '0098_public_continuing_eligibility_visibility_closure_v1.sql': 'eb854567202f7906ba98ae1384493e577704ea4f',
  '0099_public_experience_disappearance_runtime_v1.sql': '953d9e91691a48e19d9b7d7e4aef4397f69bc721',
  '0100_replay_foundation_source_manifest_selection_v1.sql': '5fb034265015e5b353a1118db3ed41080880a541',
  '0101_replay_authorized_draft_runtime_v1.sql': '01cc9eb759d4ebe8d86eda479e248ddfb7d21259',
  '0102_replay_analytical_projection_render_contract_versioning_v1.sql': '942e60e3f57cecf56e54ed9f176f5926567d488f',
  '0103_replay_preview_finalization_runtime_v1.sql': 'b78a3ebc017ba4d428ecd8187b7b93ec7be4c7d9',
  '0104_replay_distribution_package_authority_v1.sql': '359ef107ab8ebe6888e8c545a2b8f0fe98cbec79',
  '0105_replay_distribution_runtime_export_public_bridge_v1.sql': 'b61deb0f83a08e28af61631b4b78fab30dc29d8e',
  '0106_replay_post_finalization_source_availability_v1.sql': 'a1815449d3369621f5be48ecc7e34adff65b8f98',
  '0107_replay_distribution_current_eligibility_reconciliation_v1.sql': 'e3ea3059db574a1f3c58e640560b8914fbfd881f',
  '0108_matching_participation_private_setup_foundation_v1.sql': '88845e0290809d1fd9949db1a5ebf3973bacdbb3',
  '0109_matching_setup_human_authority_commands_v1.sql': '030de6db8d7982a4503cc2200927511f1c212e60',
  '0110_matching_pair_eligibility_proposal_persistence_v1.sql': '5cf4dab35b921fa1d2f60a2875a5863964ca9139',
  '0111_matching_candidate_evaluation_disclosure_gate_v1.sql': '7e2df716f935b1f8be378c0c1fd1d232b6165956',
  '0112_matching_proposal_choreography_runtime_v1.sql': 'd806ddf5683048a830638bd264282fee09f39d53',
  '0113_matching_mutual_match_introduction_persistence_v1.sql': '56fdb8f961047cf2848deda2f991cf436897ccb7',
  '0114_matching_mutual_match_commit_transaction_v1.sql': 'c1f45248f37a0f0f30cc62ac1ccb4e1397797632',
  '0115_introduction_progressive_disclosure_history_visibility_v1.sql': '06d6528e1d03443d53aa040a555a437a458c7cb4',
  '0116_introduction_terminal_lifecycle_v1.sql': '93cd217f96c2b3562e94cb1eaead0019097d654f',
  '0117_post_introduction_matching_reactivation_v1.sql': 'b996771f8742ed0a71b3244b73088448f99e3740',
  '0118_introduction_ordinary_shared_material_v1.sql': '4a5e81de210007f905a2fc6012becdcd90bffa3a',
};

test('migration 0119 is one forward-only transaction that alters no predecessor schema', () => {
  const migrations = readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((name) => name.startsWith('0119_')).length, 1, 'exactly one migration carries 0119');
  assert.equal(migrations.at(-1), NAME, 'and it is the current tip of the chain');
  assert.match(SOURCE, /^-- QAN-CW-REM-01/u, 'the migration declares its task');
  assert.equal((SOURCE.match(/\nBEGIN;\n/gu) ?? []).length, 1, 'it is one transaction');
  assert.match(SOURCE, /COMMIT;\n$/u, 'and it commits');

  const executable = body();
  // A CORRECTION THAT DROPPED, ALTERED OR REPLACED SCHEMA WOULD NOT BE A
  // CORRECTION. Every change is a forward function replacement plus one UPDATE.
  assert.doesNotMatch(executable, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|COLUMN|CONSTRAINT|SCHEMA|ROLE)/iu,
    'it drops no object');
  assert.doesNotMatch(executable, /ADD COLUMN|DROP COLUMN|ALTER COLUMN|RENAME/iu,
    'it adds, drops, alters or renames no column');
  assert.doesNotMatch(executable, /CREATE (?:TABLE|POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE|TRIGGER)|EXCLUDE USING/iu,
    'it creates no table, policy, view, extension, type or trigger: the substrate it needs already exists');
  assert.doesNotMatch(executable, /CREATE (?:UNIQUE )?INDEX/iu, 'and no index');
  assert.doesNotMatch(executable, /TRUNCATE|DELETE FROM/iu, 'it destroys nothing');
  assert.doesNotMatch(executable, /ALTER TABLE/iu,
    'and it alters no relation at all: the authority-resolution relation it writes is used exactly as frozen');
});

test('migrations 0075 - 0118 are byte-identical: the chain is forward-only', () => {
  const pinned = Object.keys(FROZEN_MIGRATIONS);
  assert.equal(pinned.length, 44, 'every Connected Worlds migration from 0075 to 0118 is pinned');
  for (const [file, blob] of Object.entries(FROZEN_MIGRATIONS)) {
    assert.equal(blobIdOf(read(`../migrations/${file}`)), blob,
      `${file} is byte-identical to the QAN-CW-REM-01 canonical baseline`);
  }
  // And the pinned set really is the contiguous range it claims to be, so a
  // migration cannot escape the pin by being left out of the map.
  const numbers = pinned.map((file) => Number(file.slice(0, 4))).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 44 }, (_, i) => 75 + i),
    'the pin covers 0075 through 0118 with no gap');
});

test('the QANDEEL producer is replaced forward-only, and no arm of its resolution can claim an unproven clearance', () => {
  const core = functionOf(QANDEEL_CORE, GRANT_CORE);

  // ALL THREE ARMS ARE PINNED. Migration 0118 pinned only the reasoning arm, and
  // the arm it left unpinned is the one that shipped the defect - so this
  // contract pins the whole CASE rather than the half that happened to be quoted.
  assert.ok(core.includes("WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'a reasoning dependency still records an unresolvable additional human requirement');
  assert.ok(core.includes("WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'"),
    'known exact material owners still resolve the exact human requirement');
  assert.ok(core.includes("ELSE 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' END;"),
    'and a commit with no enumerable required human records UNRESOLVED');
  // The assignment is bounded by its own terminating semicolon, so this is a
  // claim about the CASE rather than about the whole body - the mode derivation
  // below it still names the value, and still should.
  assert.doesNotMatch(core, /authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT/u,
    'no arm of the resolution can reach the clearance this repository cannot establish');

  // THE MODE DERIVATION IS UNCHANGED, so "approval-free is written ONLY for a
  // genuinely resolved empty requirement" survives verbatim and a later reviewed
  // subject-authority resolver re-enables it without reopening this file.
  assert.ok(core.includes("authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'"),
    'the approval-free mode is still derived from a genuinely resolved empty requirement and nothing else');

  // PROVENANCE IS UNTOUCHED. INDEPENDENT_TARGET_TRUTH is a statement about
  // SOURCES; it was never an authority clearance, and removing it would have
  // destroyed true provenance to fix an authority defect.
  assert.ok(core.includes('IF material_edges = 0 AND reasoning_edges = 0 THEN'),
    'the zero-dependency branch still exists');
  assert.ok(core.includes("'INDEPENDENT_TARGET_TRUTH', p_material_id, commit_instant"),
    'and still persists INDEPENDENT_TARGET_TRUTH provenance');

  // AND NOTHING ELSE IN THE CORE MOVED.
  assert.doesNotMatch(core, /auth\.uid/u, 'QANDEEL is still a system actor that derives no human');
  assert.ok(core.includes('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE'),
    'the World row is still locked FIRST');
  assert.ok(core.includes("ELSIF world.phase = 'INTRODUCTION' THEN"),
    'the I-07D Introduction extension survives the correction');
  assert.ok(core.includes("IF world.phase = 'INTRODUCTION' AND array_length(audience, 1) <> 2 THEN"),
    'including its exactly-two-humans floor');
  assert.equal((stripComments(core).match(/clock_timestamp\(\)/gu) ?? []).length, 1,
    'and one database-owned instant is still read exactly once');
  assert.doesNotMatch(stripComments(core), /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
    'never a transaction clock');
});

test('the reconciliation moves one column of one relation, in the fail-closed direction, rewriting no source history', () => {
  const fn = functionOf(RECONCILE, 'ALTER FUNCTION public.reconcile_shared_world_material_historical_authority_v1');
  assert.ok(fn.includes('UPDATE public.shared_world_material_historical_authority'),
    'it writes the authority-resolution relation migration 0090 created for exactly this');
  assert.equal((fn.match(/UPDATE public\./gu) ?? []).length, 1, 'and nothing else');
  assert.ok(fn.includes("SET resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'it moves a row forward to unresolved');
  assert.ok(fn.includes("WHERE a.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'"),
    'from exactly the unproven clearance, so it can only ever be fail-closed and is idempotent by construction');
  assert.ok(fn.includes("AND m.producer_kind = 'QANDEEL'"),
    'and only for QANDEEL-produced material, stated structurally rather than trusted');

  // IT REWRITES NO SOURCE HISTORY. The frozen authority_requirement_mode
  // immutability trigger is neither disabled nor bypassed: a reconciled item
  // keeps the mode its original commit really used.
  assert.doesNotMatch(fn, /authority_requirement_mode/u,
    'it never touches the frozen history-item authority mode');
  assert.doesNotMatch(fn, /shared_world_history_items|shared_world_material_dependencies|_material_bodies/u,
    'and no history item, provenance edge or material body');
  assert.doesNotMatch(fn, /shared_world_history_item_baseline_viewers|shared_world_history_item_required_approvers/u,
    'and no baseline viewer or required approver');
  assert.doesNotMatch(fn, /DISABLE TRIGGER|ALTER TABLE|DELETE FROM|INSERT INTO|TRUNCATE/iu,
    'it disables no guard and destroys nothing');
  assert.doesNotMatch(fn, /auth\.uid|request\.jwt/u, 'and trusts no client claim');

  // IT IS EXECUTABLE BY NOBODY, exactly like every other consequential primitive.
  const executable = body();
  assert.ok(executable.includes('REVOKE ALL ON FUNCTION public.reconcile_shared_world_material_historical_authority_v1()\n  FROM PUBLIC, anon, authenticated;'),
    'no application role may call the reconciliation');
  assert.ok(executable.includes("EXECUTE 'REVOKE ALL ON FUNCTION public.reconcile_shared_world_material_historical_authority_v1() FROM service_role'"),
    'service_role included');

  // AND IT RUNS ONCE, AT DEPLOY, WITH ITS RESULT PROVEN RATHER THAN TRUSTED.
  assert.ok(executable.includes('FROM public.reconcile_shared_world_material_historical_authority_v1() r;'),
    'the migration calls it');
  assert.match(executable, /IF remaining <> 0 THEN\s*\n\s*RAISE EXCEPTION 'QAN-CW-REM-01: % historical-authority row\(s\) still record/u,
    'and refuses to deploy if it left an unproven clearance behind');
});

test('every widening boundary re-asks the current authority state, and none of them is a second model', () => {
  // THE GRANT BOUNDARY. The frozen preparation-time trigger cannot cover a
  // manifest prepared BEFORE the correction, and a manifest is immutable, so the
  // consequential commit is the only place left that can.
  const grant = functionOf(GRANT_CORE, ENTRY_POINT);
  assert.ok(grant.includes('public.shared_world_material_historical_authority'),
    'the grant boundary reads the authority-resolution relation');
  assert.ok(grant.includes("a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'and refuses exactly the unresolved state');
  assert.ok(grant.includes("RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED' USING ERRCODE='55000'"),
    'with the SAME bounded class the frozen preparation gate raises: one model, asked twice');
  const lockAt = grant.indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  const checkAt = grant.indexOf("a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'");
  const writeAt = grant.indexOf('INSERT INTO public.shared_world_history_access_grants');
  assert.ok(lockAt > 0 && checkAt > lockAt && writeAt > checkAt,
    'and it asks under the World lock, before the grant is written');
  assert.doesNotMatch(grant, /auth\.uid/u, 'a history grant still has no granting actor');
  // The 0087 predecessor contract forbids this primitive from naming Personal
  // context or any grant/consent state, and forbids inventing a withdrawal
  // vocabulary. The added gate stays inside both.
  assert.doesNotMatch(grant,
    /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
    'the added gate names no Personal context and no grant or consent state');
  assert.doesNotMatch(grant, /revoke[d_]|withdraw|rescind|retroactive/iu,
    'and invents no history-grant withdrawal: frozen canon defers that policy');

  // EFFECTIVE VISIBILITY. An existing grant is durable evidence and is never
  // deleted; what it no longer does is carry currently-unresolved material.
  const entry = functionOf(ENTRY_POINT, CLOSED_READER);
  assert.ok(entry.includes('public.shared_world_material_historical_authority'),
    'the widened basis consumes current authority state');
  assert.ok(entry.includes('i.occurred_at >= e.joined_at')
    && entry.includes('e.ended_at IS NULL OR i.occurred_at <= e.ended_at'),
  'the membership-period basis keeps its exact frozen temporal bounds');
  assert.equal((stripComments(entry).match(/shared_world_history_package_manifest_items/gu) ?? []).length, 1,
    'and the grant basis is still STANDARD-only: it appears exactly once, so the Introduction branch gained nothing');
  assert.doesNotMatch(stripComments(entry), /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'the resolver still mutates nothing, locks nothing and trusts no client claim');

  // THE CLOSED SNAPSHOT. A closure taken before the correction must not preserve
  // the widening forever; a baseline viewer must lose nothing.
  const closed = functionOf(CLOSED_READER, 'ALTER FUNCTION public.commit_shared_world_qandeel_material_v1');
  assert.ok(closed.includes('public.shared_world_material_historical_authority'),
    'the closed Standard branch consumes current authority state too');
  assert.ok(closed.includes('public.shared_world_history_item_baseline_viewers'),
    'and re-derives the baseline basis from the exact original audience');
  assert.doesNotMatch(stripComments(closed), /shared_world_membership_episodes/u,
    'closed viewing is still entitlement, never membership');
  assert.ok(closed.includes('shared_world_standard_closed_view_entitlement_items')
    && closed.includes('introduction_closed_view_entitlement_items'),
  'both frozen closed branches survive');
  assert.doesNotMatch(stripComments(closed), /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'and it still mutates nothing and locks nothing');

  // NO SECOND HISTORY RESOLVER AND NO SECOND AUTHORITY MODEL WERE CREATED.
  const executable = body();
  const created = [...executable.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(created, [
    'commit_shared_world_history_access_grant_v1',
    'commit_shared_world_qandeel_material_v1',
    'reconcile_shared_world_material_historical_authority_v1',
    'resolve_shared_world_closed_history_visibility_v1',
    'resolve_shared_world_history_visibility_v1',
  ], 'exactly four frozen functions are replaced forward-only, and exactly one is new');
});

test('no actor, approver or privilege is added anywhere, and the Public chain is composed rather than modified', () => {
  const executable = body();
  // NO NEW APP-ROLE EXECUTE. The only GRANT in the whole file re-states the ONE
  // frozen service_role grant on the ONE historical visibility entry point.
  const grants = [...executable.matchAll(/GRANT [^;]*/gu)].map((m) => m[0]);
  assert.equal(grants.length, 1, 'the migration issues exactly one GRANT');
  assert.match(grants[0], /GRANT EXECUTE ON FUNCTION public\.resolve_shared_world_history_visibility_v1\(uuid, uuid\) TO service_role/u,
    'and it is the frozen one it must not take away');
  assert.doesNotMatch(executable, /GRANT [^;]*TO (?:PUBLIC|anon|authenticated)/iu,
    'no application role gains anything');

  // NO SIGNATURE CHANGED AT ALL, proven by equality with the frozen declaration
  // each replacement replaces rather than by a word list. An authority
  // correction that accepted a claim from its caller would be the opposite of a
  // correction - and only the predecessor can settle which parameter names are
  // frozen I-03 evidence references and which would be a new claim.
  for (const [name, predecessor] of [
    ['commit_shared_world_qandeel_material_v1', '0118_introduction_ordinary_shared_material_v1.sql'],
    ['commit_shared_world_history_access_grant_v1', '0087_shared_world_selective_history_access_v1.sql'],
    ['resolve_shared_world_history_visibility_v1', '0115_introduction_progressive_disclosure_history_visibility_v1.sql'],
    ['resolve_shared_world_closed_history_visibility_v1', '0115_introduction_progressive_disclosure_history_visibility_v1.sql'],
  ]) {
    assert.equal(prologueOf(SOURCE, name), prologueOf(read(`../migrations/${predecessor}`), name),
      `${name} keeps the exact parameter list and result shape of the declaration it replaces, in ${predecessor}`);
  }

  // THE PUBLIC HALF IS COMPOSITION. This migration must not contain a Public
  // rule of its own, and must not invent recall, withdrawal or deletion.
  assert.doesNotMatch(executable, /CREATE (?:OR REPLACE )?FUNCTION public\.(?:prepare_public|derive_public|publish_public|resolve_public|commit_public)/u,
    'it defines no Public function: the frozen Public derivations are consumed unchanged');
  assert.doesNotMatch(executable, /public_experiences|public_experience_publication_state|publication_package_item_authority/u,
    'it writes no Public relation');
  assert.doesNotMatch(executable, /recall|retroactive|unpublish|ABSENT_FROM_PUBLIC_WORLD/iu,
    'and invents no Public recall or removal policy: this task is about authority invalidity, not source deletion');

  // AND THE TERMINAL BLOCK PROVES THE PUBLIC CHAIN IS STILL FAIL-CLOSED.
  assert.match(SOURCE, /prepare_public_experience_manifest_v1[\s\S]{0,600}PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u,
    'the migration refuses to deploy unless Public package preparation still fails closed on unresolved source authority');
  assert.match(SOURCE, /derive_public_continuing_eligibility_v1[\s\S]{0,400}PUBLICATION_AUTHORITY_INVALIDATED/u,
    'and unless continuing Public eligibility still fails closed through the ONE authority derivation');
});

test('the migration refuses to deploy if its own architecture is absent', () => {
  const terminal = SOURCE.slice(SOURCE.indexOf('Terminal self-assertions'));
  for (const claim of [
    // the correction itself, all three arms
    "WHEN reasoning_edges > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''",
    "WHEN approvers > 0 THEN ''RESOLVED_EXACT_HUMAN_REQUIREMENT''",
    "ELSE ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'' END;",
    'authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT',
    // provenance, signature and posture
    "''INDEPENDENT_TARGET_TRUTH''",
    'must keep its exact 14 inputs and 11 result columns',
    'accepts no actor, approver, viewer or authority claim from a caller',
    'must stay ONE function: no overload was authorized',
    // the consumers
    'the frozen preparation-time widening gate must still be installed and enabled',
    'must revalidate current historical authority at the instant it widens',
    'the widened visibility basis must consume current historical authority state',
    'membership-period visibility must survive this correction exactly as frozen',
    'the explicit grant basis must remain exactly once, in the STANDARD branch alone',
    'closed viewing is entitlement, never membership',
    'a closure snapshot must not preserve a widening whose authority is now unresolved',
    // the reconciliation and its post-state
    'the reconciliation must move exactly the unproven clearance forward, and nothing else',
    'the reconciliation rewrites no source history and disables no frozen immutability guard',
    'no Shared material may still record a proven-empty human requirement after this migration',
    'exactly one reviewed function may move a historical authority resolution',
    // privilege
    'must not execute % before the CW2-08 Launch Gate exists',
    'service_role must still execute the ONE historical visibility entry point',
  ]) {
    assert.ok(terminal.includes(claim), `the terminal block pins: ${claim}`);
  }
});

test('the 0119 verifier proves live semantics and is wired into the toolchain, CI and the database README', () => {
  // THE PROOF MATRIX THE TASK REQUIRED, each case named in the verifier so a
  // silently-removed scenario is visible in this contract rather than only in a
  // green CI log.
  for (const label of [
    'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10',
    'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21',
    'R01', 'R02', 'R03', 'R04', 'C01', 'C02', 'C03', 'C04',
  ]) {
    assert.ok(VERIFIER.includes(label), `the verifier carries case ${label}`);
  }
  // It drives the REAL boundaries rather than writing the rows it then reads.
  assert.match(VERIFIER, /commit_shared_world_qandeel_material_v1/u, 'it commits through the real QANDEEL boundary');
  assert.match(VERIFIER, /prepare_shared_world_history_package_v1/u, 'and packages through the real I-04F boundary');
  assert.match(VERIFIER, /commit_shared_world_history_access_grant_v1/u, 'and grants through the real one');
  assert.match(VERIFIER, /commit_shared_world_standard_end_v1/u, 'and closes a World through the real closure primitive');
  assert.match(VERIFIER, /publish_public_experience_v1/u, 'and publishes through the real Public primitive');
  assert.match(VERIFIER, /bringToIntroduction/u, 'and reaches a live Introduction through the real I-07 ladder');
  // The ASSURE-F04 decision is a real-PostgreSQL verdict pinned on an observable
  // lock wait and on PostgreSQL's own deadlock accounting - never on a sleep.
  assert.match(VERIFIER, /waitForLockWait/u, 'the F04 race is pinned on an observable lock-wait barrier');
  assert.match(VERIFIER, /pg_stat_database/u, 'and its verdict is read from PostgreSQL deadlock accounting');
  assert.match(VERIFIER, /REPRODUCED/u, 'and it can report either verdict');
  assert.doesNotMatch(VERIFIER, /setTimeout\(\s*\(\)\s*=>\s*resolveRace/u, 'with no sleep-only timing decision');

  // WIRED, so it actually runs.
  assert.match(packageJson,
    /"verify:shared-historical-authority-remediation:integration": "node --env-file-if-exists=\.env database\/verify-migration-0119\.mjs"/u,
    'the verifier has a toolchain entry');
  assert.ok(workflow.includes('npm run verify:shared-historical-authority-remediation:integration'),
    'and API CI runs it');
  assert.ok(workflow.indexOf('npm run verify:shared-historical-authority-remediation:integration')
    > workflow.indexOf('npm run verify:introduction-ordinary-shared-material:integration'),
  'after the 0118 verifier, in migration order');
  assert.ok(readme.includes(NAME), 'and the database README documents the migration');
  assert.ok(readme.includes('verify-migration-0119.mjs'), 'and its verifier');
});

test('the 0090 predecessor regression is reconciled narrowly rather than deleted', () => {
  // Migration 0090's verifier asserted the OLD law directly: a zero-dependency
  // QANDEEL commit was RESOLVED_NO_HUMAN_REQUIREMENT, approval-free, and
  // packageable. That assertion cannot survive a correction that makes the state
  // unreachable - but deleting it would throw away the only place the whole
  // zero-dependency path is exercised against the real boundary. It is reconciled
  // forward instead, and this contract holds the reconciliation to being narrow.
  assert.ok(PREDECESSOR_0090.includes('QAN-CW-REM-01'),
    'the 0090 verifier names the task that moved its expectation');
  assert.ok(!/assert\.equal\(independentState, 'RESOLVED_NO_HUMAN_REQUIREMENT'\)/u.test(PREDECESSOR_0090),
    'the old proven-empty expectation is gone');
  assert.match(PREDECESSOR_0090, /assert\.equal\(independentState, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'and is replaced by the corrected one, still asserted against the same real commit');
  // NON-VACUITY. The block must still prove the three things it always proved:
  // the material commits, its baseline audience is unaffected, and the widening
  // decision is exercised - now in the other direction.
  assert.match(PREDECESSOR_0090, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u,
    'the widening path is still exercised, now as a refusal');
  assert.match(PREDECESSOR_0090, /current baseline-audience delivery of unresolved material is UNAFFECTED/u,
    'and current delivery is still proven unaffected');
  // And the reasoning and mixed cases it already owned are untouched.
  assert.match(PREDECESSOR_0090, /assert\.equal\(reasoningState, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'\)/u,
    'the reasoning case is unchanged');
  assert.match(PREDECESSOR_0090, /a known owner does not resolve the whole requirement/u,
    'and so is the mixed case');
});
