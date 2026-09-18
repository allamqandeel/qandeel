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
const HISTORY_PREPARE = 'CREATE OR REPLACE FUNCTION public.prepare_shared_world_history_package_v1(';
const PUBLIC_PREPARE = 'CREATE OR REPLACE FUNCTION public.prepare_public_experience_manifest_v1(';

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
  // RECONCILED BY QAN-CW-REM-02. This asserted that 0119 was the TIP of the
  // chain, which was true when it was written and is not a property any
  // migration keeps: `QAN-CW-REM-02` adds 0120 directly after it. The claim
  // worth keeping is the forward-only ORDERING - that 0119 came after the
  // reviewed 0118 tip and renumbered nothing - so that is what is asserted, and
  // the tip claim is retired rather than moved to whichever migration is last
  // today.
  assert.equal(migrations.indexOf(NAME),
    migrations.indexOf('0118_introduction_ordinary_shared_material_v1.sql') + 1,
    'and it orders directly after the reviewed 0118 tip it was written against');
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
  const core = functionOf(QANDEEL_CORE, HISTORY_PREPARE);

  // ALL THREE ARMS ARE PINNED. Migration 0118 pinned only the reasoning arm, and
  // the arm it left unpinned is the one that shipped the defect - so this
  // contract pins the whole CASE rather than the half that happened to be quoted.
  assert.ok(core.includes("WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'a reasoning dependency still records an unresolvable additional human requirement');
  assert.ok(core.includes("WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'"),
    'known exact material owners still resolve the exact human requirement');
  assert.ok(core.includes("ELSE 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' END;"),
    'and a commit with no enumerable required human records UNRESOLVED');

  // AND THE ARM THAT STOPS THE LAUNDERING (REM01-AUTH-01). Without it the
  // unresolved state is erasable in one MATERIAL_DEPENDENCY edge - commit an
  // analysis over an unresolved analysis, declare no reasoning of your own, and
  // the known-owner arm would have resolved it - and then transitively.
  assert.ok(core.includes("WHEN unresolved_sources > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'a MATERIAL_DEPENDENCY source whose own additional human requirement is unresolved makes its target unresolved');
  assert.ok(core.indexOf('WHEN unresolved_sources > 0') < core.indexOf('WHEN approvers > 0'),
    'and it is evaluated BEFORE the known-owner arm: the order is the semantics');
  // IT IS DERIVED FROM THE CANONICAL RELATION, positively, with absent metadata
  // failing closed - the exact predicate the frozen Public gates already use.
  assert.ok(core.includes('INTO unresolved_sources'), 'source authority is read, not inferred from approver rows');
  assert.match(core, /INTO unresolved_sources[\s\S]{0,400}NOT EXISTS \(SELECT 1 FROM public\.shared_world_material_historical_authority a/u,
    'and a source counts as unresolved unless it POSITIVELY records a resolved state');
  assert.match(core, /INTO unresolved_sources[\s\S]{0,500}a\.resolution_state IN \('RESOLVED_EXACT_HUMAN_REQUIREMENT',\s*\n?\s*'RESOLVED_NO_HUMAN_REQUIREMENT'\)/u,
    'using the exact two-state predicate migrations 0093 and 0105 already use');
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
  assert.ok(fn.includes("WHERE a.resolution_state <> 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'"),
    'in the fail-closed direction only, so it is idempotent by construction and can never become a clearance tool');
  assert.ok(fn.includes("AND m.producer_kind = 'QANDEEL'"),
    'and only for QANDEEL-produced material, stated structurally rather than trusted');

  // IT REACHES THE LAUNDERING DESCENDANTS, transitively, to a fixed point. The
  // old producer classified a target from its known approver COUNT alone, so a
  // target of an unresolved source inherited the known half and dropped the
  // unknown half; repairing only the ancestors would repair nothing widenable.
  assert.ok(fn.includes('WITH RECURSIVE tainted'), 'it computes a transitive closure');
  assert.ok(fn.includes('JOIN tainted t ON t.material_id = d.source_material_id'),
    'following MATERIAL_DEPENDENCY edges FORWARD from every source that is not positively resolved');
  assert.ok(fn.includes("WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'"),
    'over MATERIAL_DEPENDENCY alone: an analytical derivative is not a reproduction');
  assert.ok(fn.includes('INTO laundered'),
    'and it reports the residue that still claims an exact resolution its ancestry does not support');

  // IT REWRITES NO SOURCE HISTORY. The frozen authority_requirement_mode
  // immutability trigger is neither disabled nor bypassed: a reconciled item
  // keeps the mode its original commit really used.
  assert.doesNotMatch(fn, /authority_requirement_mode/u,
    'it never touches the frozen history-item authority mode');
  assert.doesNotMatch(fn, /shared_world_history_items|_material_bodies/u,
    'and never names a history item or a material body at all');
  assert.doesNotMatch(fn, /shared_world_history_item_baseline_viewers|shared_world_history_item_required_approvers/u,
    'and no baseline viewer or required approver');
  // Provenance is READ, to walk the closure, and never written: the single
  // `UPDATE public.` asserted above is the whole of what this function writes.
  assert.ok(fn.includes('FROM public.shared_world_material_dependencies d'),
    'the dependency graph is read to find the laundering descendants');
  assert.doesNotMatch(fn, /UPDATE public\.shared_world_material_dependencies/u,
    'and never rewritten: provenance is evidence, not a thing a correction edits');
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
  assert.match(executable, /IF laundered <> 0 THEN\s*\n\s*RAISE EXCEPTION 'QAN-CW-REM-01: % historical-authority row\(s\) still claim an exact resolution/u,
    'or if any row still claims an exact resolution its own ancestry does not support');
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
    'prepare_public_experience_manifest_v1',
    'prepare_shared_world_history_package_v1',
    'reconcile_shared_world_material_historical_authority_v1',
    'resolve_shared_world_closed_history_visibility_v1',
    'resolve_shared_world_history_visibility_v1',
  ], 'exactly six frozen functions are replaced forward-only, and exactly one is new');
});

test('ASSURE-F04: no statement locks a row identity without pinning the World it already holds', () => {
  // The finding was PROVISIONAL. It was reproduced on real PostgreSQL by this
  // slice's own verifier, on the head before this correction, which is what
  // authorizes the change: the task forbids repairing it blind. The correction
  // is one scoping predicate per statement, and nothing else moves.
  const producer = functionOf(QANDEEL_CORE, HISTORY_PREPARE);
  assert.ok(producer.includes('WHERE m.id = ANY(sources) AND m.world_id = p_world_id ORDER BY m.id FOR UPDATE'),
    'the QANDEEL producer locks its sources only inside the World it locked first');
  // World containment moves AHEAD of the lock, because a material World is
  // immutable and the answer cannot go stale - and that ordering is what keeps
  // a foreign-World source answering SHARED_WORLD_MATERIAL_STALE rather than a
  // missing-row class, which migration 0090's verifier pins.
  const containsAt = producer.indexOf('WHERE m.id = ANY(sources) AND m.world_id <> p_world_id');
  const locksAt = producer.indexOf('WHERE m.id = ANY(sources) AND m.world_id = p_world_id ORDER BY m.id FOR UPDATE');
  assert.ok(containsAt > 0 && locksAt > containsAt, 'and decides containment before taking the lock');
  assert.ok(producer.includes("RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE' USING ERRCODE='40001'"),
    'with the frozen refusal class unchanged');
  // Availability stays UNDER the lock, because it is mutable.
  assert.match(producer, /ORDER BY m\.id FOR UPDATE[\s\S]*i\.availability_state <> 'AVAILABLE'/u,
    'while availability stays under the lock, where a mutable fact belongs');

  const historyPrepare = functionOf(
    'CREATE OR REPLACE FUNCTION public.prepare_shared_world_history_package_v1(',
    'CREATE OR REPLACE FUNCTION public.prepare_public_experience_manifest_v1(');
  assert.ok(historyPrepare.includes('WHERE i.id = ANY(selected) AND i.world_id = p_world_id ORDER BY i.id FOR UPDATE'),
    'history package preparation locks items only inside the World it locked first');
  assert.ok(historyPrepare.includes('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE'),
    'and still takes that World row first');

  const publicPrepare = functionOf(
    'CREATE OR REPLACE FUNCTION public.prepare_public_experience_manifest_v1(', GRANT_CORE);
  assert.ok(publicPrepare.includes('AND m.world_id = ANY(p_shared_source_world_ids) ORDER BY m.id FOR SHARE'),
    'Public package preparation locks Shared materials only inside the Worlds it named and locked');
  assert.ok(publicPrepare.includes('AND i.world_id = ANY(p_shared_source_world_ids)'),
    'and their history items the same way');
  assert.match(publicPrepare, /FROM public\.shared_worlds w\s*WHERE w\.id = ANY\(p_shared_source_world_ids\) ORDER BY w\.id FOR SHARE/u,
    'with those World rows still taken FIRST');
  assert.ok(publicPrepare.includes("RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002'"),
    'and the frozen refusal for a mismatched request unchanged');

  // NOTHING WAS TRADED FOR IT.
  const executable = body();
  assert.doesNotMatch(executable, /pg_advisory|LOCK TABLE|SELECT pg_sleep/iu,
    'no advisory lock, no table lock and no sleep was introduced anywhere');
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
  // The ONE Public function it touches is `prepare_public_experience_manifest_v1`,
  // and it is touched for the ASSURE-F04 lock scoping alone: no Public AUTHORITY
  // derivation is redefined, and every authority gate inside it is verbatim.
  assert.doesNotMatch(executable, /CREATE (?:OR REPLACE )?FUNCTION public\.(?:derive_public|publish_public|resolve_public|commit_public)/u,
    'it redefines no Public authority, publication, visibility or serving function');
  // AND THE TWO F04 REPLACEMENTS CHANGE NOTHING BUT THEIR LOCK PREDICATES,
  // proven as a line-level diff against the frozen text rather than by spot
  // checks: every executable line the predecessor had is still there, and every
  // line this file adds is a scoping predicate.
  for (const [label, mine, frozen] of [
    ['the Public preparation', functionOf(PUBLIC_PREPARE, GRANT_CORE),
      sliceOf(read('../migrations/0093_public_experience_review_ready_runtime_v1.sql'),
        'CREATE FUNCTION public.prepare_public_experience_manifest_v1(', '-- 6. APPROVE AN EXACT PUBLICATION PACKAGE.')],
    ['the history preparation', functionOf(HISTORY_PREPARE, PUBLIC_PREPARE),
      sliceOf(read('../migrations/0087_shared_world_selective_history_access_v1.sql'),
        'CREATE FUNCTION public.prepare_shared_world_history_package_v1(', '-- 13. PRIMITIVE B')],
  ]) {
    const normalise = (text) => text.replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION')
      .split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);
    const mineLines = normalise(mine);
    const frozenLines = normalise(frozen);
    const removed = frozenLines.filter((line) => !mineLines.includes(line));
    const added = mineLines.filter((line) => !frozenLines.includes(line));
    for (const line of removed) {
      assert.match(line, /ORDER BY (m|i)\.id FOR (UPDATE|SHARE);|WHERE m\.id = ANY\(p_shared_source_material_ids\)\)/u,
        `${label} removed a line that is not one of the unscoped lock statements: ${line}`);
    }
    for (const line of added) {
      assert.match(line,
        /world_id = (ANY\(p_shared_source_world_ids\)|p_world_id)|ORDER BY (m|i)\.id FOR (UPDATE|SHARE);|WHERE (m|i)\.id = ANY\((p_shared_source_material_ids|selected|sources)\)$/u,
        `${label} added a line that is not a scoping predicate or its own re-wrapping: ${line}`);
    }
    assert.ok(added.length > 0 && added.length <= 6,
      `${label} changed a bounded number of lines, and really did change some`);
  }
  assert.doesNotMatch(executable, /recall|retroactive|unpublish|ABSENT_FROM_PUBLIC_WORLD/iu,
    'and invents no Public recall or removal policy: this task is about authority invalidity, not source deletion');

  // AND THE TERMINAL BLOCK PROVES THE PUBLIC CHAIN IS STILL FAIL-CLOSED.
  assert.match(SOURCE, /prepare_public_experience_manifest_v1[\s\S]{0,600}PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u,
    'the migration refuses to deploy unless Public package preparation still fails closed on unresolved source authority');
  assert.match(SOURCE, /derive_public_continuing_eligibility_v1[\s\S]{0,400}PUBLICATION_AUTHORITY_INVALIDATED/u,
    'and unless continuing Public eligibility still fails closed through the ONE authority derivation');
});

/**
 * One function's `prosrc` as PostgreSQL will store it: exactly the text between
 * `AS $$` and the closing `$$`, with no CREATE header.
 *
 * The terminal self-assertions read `pg_proc.prosrc`, so a simulation that fed
 * them the whole declaration would be testing something the database never sees.
 */
const prosrcOf = (name) => {
  const start = SOURCE.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const open = SOURCE.indexOf('AS $$', start);
  assert.ok(open > start, `${name} has a body`);
  const close = SOURCE.indexOf('END$$;', open);
  assert.ok(close > open, `${name} has a body terminator`);
  return SOURCE.slice(open + 'AS $$'.length, close + 'END'.length);
};

test('the migration self-assertions accept the migration itself', () => {
  // THE DEFECT CLASS THIS EXISTS FOR. A terminal self-assertion is executed by
  // PostgreSQL at deploy time, so one that is wrong costs a whole CI round and
  // verifies nothing - the chain never even applies. I-04F spent FIX-02 and
  // FIX-03 on exactly that, and this change spent two rounds on it again: once
  // on a parameter-name ban that rejected the frozen `p_authority_revalidation_
  // ref`, and once on `body ~ 'a' || 'b'`, which parses as `(body ~ 'a') || 'b'`
  // because `~` and `||` share a precedence class in PostgreSQL.
  //
  // So every text assertion the terminal block makes is simulated HERE, against
  // the exact `prosrc` the database will hold, and the run costs milliseconds.
  const bodies = {
    producer: prosrcOf('commit_shared_world_qandeel_material_v1'),
    grant: prosrcOf('commit_shared_world_history_access_grant_v1'),
    entry: prosrcOf('resolve_shared_world_history_visibility_v1'),
    closed: prosrcOf('resolve_shared_world_closed_history_visibility_v1'),
    reconcile: prosrcOf('reconcile_shared_world_material_historical_authority_v1'),
  };
  // PostgreSQL's `~` matches `.` across newlines; JavaScript's does not, so the
  // `s` flag is what makes these two engines agree.
  const must = (key, pattern, why) => assert.match(bodies[key], new RegExp(pattern, 'su'), `${key}: ${why}`);
  const mustNot = (key, pattern, why, flags = 'su') =>
    assert.doesNotMatch(bodies[key], new RegExp(pattern, flags), `${key}: ${why}`);
  const occurrences = (key, pattern) => (bodies[key].match(new RegExp(pattern, 'gsu')) ?? []).length;

  // --- the producer
  must('producer', "WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'", 'the reasoning arm');
  must('producer', "WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'", 'the known-owner arm');
  must('producer', "WHEN unresolved_sources > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'", 'the unresolved-source arm');
  must('producer', "ELSE 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' END;", 'the corrected arm');
  assert.ok(bodies.producer.indexOf('WHEN unresolved_sources > 0') < bodies.producer.indexOf('WHEN approvers > 0'),
    'producer: the unresolved-source arm is evaluated first');
  must('producer', 'INTO unresolved_sources', 'source authority is read');
  must('producer', 'FROM public\\.shared_world_material_historical_authority a', 'from the canonical relation');
  must('producer', "a\\.resolution_state IN \\('RESOLVED_EXACT_HUMAN_REQUIREMENT'", 'positively');
  must('producer', 'NOT EXISTS \\(SELECT 1 FROM public\\.shared_world_material_historical_authority a', 'failing closed on absence');
  mustNot('producer', 'authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT', 'no arm reaches the unproven clearance');
  must('producer', "authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'", 'the mode derivation is unchanged');
  must('producer', 'IF material_edges = 0 AND reasoning_edges = 0 THEN', 'the zero-dependency branch survives');
  must('producer', "'INDEPENDENT_TARGET_TRUTH'", 'and still writes provenance');
  mustNot('producer', 'auth\\.uid', 'QANDEEL derives no human');
  must('producer', "IF world\\.lifecycle <> 'ACTIVE' THEN", 'the lifecycle gate');
  must('producer', "ELSIF world\\.phase = 'INTRODUCTION' THEN", 'the Introduction branch');
  must('producer', "r\\.world_id = p_world_id AND r\\.introduction_status = 'ACTIVE'", 'its live-Record floor');
  must('producer', "IF world\\.phase = 'INTRODUCTION' AND array_length\\(audience, 1\\) <> 2 THEN", 'its two-human floor');
  must('producer', "ELSIF world\\.phase <> 'STANDARD' THEN", 'and an unspelled mode is still refused');
  must('producer', 'FROM public\\.shared_worlds w WHERE w\\.id = p_world_id FOR UPDATE', 'the World row is locked first');
  must('producer', 'public\\.resolve_shared_world_human_audience_snapshot_v1\\(p_world_id\\)', 'the frozen audience boundary');
  assert.equal(occurrences('producer', 'clock_timestamp\\(\\)'), 1, 'producer: one instant, read once');
  mustNot('producer', 'DELETE FROM', 'it destroys nothing', 'siu');
  mustNot('producer', 'pg_advisory|LOCK TABLE', 'only canonical row locks', 'siu');

  // --- the grant boundary
  must('grant', 'public\\.shared_world_material_historical_authority', 'it revalidates current authority');
  must('grant', 'SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED', 'with the frozen bounded class');
  mustNot('grant', 'auth\\.uid', 'a grant has no granting actor');
  must('grant', 'FROM public\\.shared_worlds w WHERE w\\.id = target_world FOR UPDATE', 'World-first order');
  must('grant', 'SHARED_WORLD_HISTORY_APPROVALS_INCOMPLETE', 'approval completeness survives');
  assert.equal(occurrences('grant', 'clock_timestamp\\(\\)'), 1, 'grant: one instant, read once');

  // --- the ONE entry point
  must('entry', 'public\\.shared_world_material_historical_authority', 'the widened basis consumes current authority');
  must('entry', 'i\\.occurred_at >= e\\.joined_at', 'membership-period bounds survive');
  must('entry', 'e\\.ended_at IS NULL OR i\\.occurred_at <= e\\.ended_at', 'in both directions');
  must('entry', 'shared_world_history_item_baseline_viewers', 'a membership interval alone is still not visibility');
  assert.equal(occurrences('entry', 'shared_world_history_package_manifest_items'), 1,
    'entry: the grant basis appears exactly once');
  must('entry', 'SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE', 'an unspelled mode is refused');
  must('entry', 'resolve_shared_world_closed_history_visibility_v1', 'closed viewing still delegates');

  // --- the closed reader
  mustNot('closed', 'shared_world_membership_episodes', 'closed viewing is entitlement, never membership');
  must('closed', 'shared_world_standard_closed_view_entitlement_items', 'the Standard branch survives');
  must('closed', 'introduction_closed_view_entitlement_items', 'and the Introduction branch');
  must('closed', "i\\.availability_state = 'AVAILABLE'", 'availability still dominates');
  must('closed', 'public\\.shared_world_material_historical_authority', 'and a snapshot no longer preserves an invalid widening');

  // --- the reconciliation
  must('reconcile', 'UPDATE public\\.shared_world_material_historical_authority', 'it writes the authority relation');
  must('reconcile', "SET resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'", 'forward only');
  must('reconcile', "a\\.resolution_state <> 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'", 'in the fail-closed direction');
  must('reconcile', 'WITH RECURSIVE tainted', 'it computes a closure');
  must('reconcile', 'JOIN tainted t ON t\\.material_id = d\\.source_material_id', 'following edges forward');
  must('reconcile', "d\\.dependency_kind = 'MATERIAL_DEPENDENCY'", 'over MATERIAL_DEPENDENCY alone');
  must('reconcile', 'INTO laundered', 'and reports the one-edge residue');
  assert.equal(occurrences('reconcile', 'UPDATE public\\.'), 1, 'reconcile: exactly one relation is written');
  mustNot('reconcile', 'DELETE FROM|INSERT INTO|TRUNCATE', 'it destroys nothing', 'siu');
  mustNot('reconcile',
    'authority_requirement_mode|shared_world_history_items'
    + '|shared_world_history_item_baseline_viewers|shared_world_history_item_required_approvers'
    + '|_material_bodies|DISABLE TRIGGER|ALTER TABLE',
    'and rewrites no source history');
  mustNot('reconcile', 'UPDATE public\\.shared_world_material_dependencies', 'provenance is read, never rewritten');
});

test('no self-assertion concatenates a regex operand without parentheses', () => {
  // `~` and `||` share a precedence class in PostgreSQL, so
  //     body ~ 'a' || 'b'
  // parses as `(body ~ 'a') || 'b'` and fails at DEPLOY time with "invalid input
  // syntax for type boolean". It is invisible in review and costs a whole CI
  // round, so it is banned structurally rather than remembered.
  const lines = SOURCE.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/[!]?~\*?\s*'/u.test(lines[i])) continue;
    const continues = /^\s*\|\|/u.test(lines[i + 1] ?? '');
    if (!continues) continue;
    assert.match(lines[i], /[!]?~\*?\s*\(/u,
      `line ${i + 1} concatenates a regex operand and must parenthesise it: ${lines[i].trim()}`);
  }
});

test('the migration refuses to deploy if its own architecture is absent', () => {
  const terminal = SOURCE.slice(SOURCE.indexOf('Terminal self-assertions'));
  for (const claim of [
    // the correction itself, all three arms
    "WHEN reasoning_edges > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''",
    "WHEN approvers > 0 THEN ''RESOLVED_EXACT_HUMAN_REQUIREMENT''",
    "WHEN unresolved_sources > 0 THEN ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT''",
    'the unresolved-source arm must be evaluated BEFORE the known-owner arm',
    'source authority must be read from the canonical relation, with missing metadata failing closed',
    "ELSE ''UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'' END;",
    'authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT',
    // provenance, signature and posture
    "''INDEPENDENT_TARGET_TRUTH''",
    'must keep its exact 14 inputs and 11 result columns',
    'must keep the EXACT frozen input list',
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
    'the reconciliation must move authority forward in the fail-closed direction, and nothing else',
    'the reconciliation must propagate transitively over MATERIAL_DEPENDENCY to a fixed point',
    'the reconciliation rewrites no source history and disables no frozen immutability guard',
    'no Shared material may still record a proven-empty human requirement after this migration',
    'no Shared material may still claim an exact resolution its own MATERIAL_DEPENDENCY ancestry does not support',
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
    'A22', 'A23', 'A24', 'A25', 'A26',
    'R01', 'R02', 'R03', 'R04',
    'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08',
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
