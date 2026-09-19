// QAN-CW-REM-03 - Public / Replay current-consent composition and Public
// historical command truth v1: secret-free structural contract over 0121.
//
// Migration 0121 corrects two accepted phase-wide assurance findings that are
// the same mistake in two shapes - a CURRENT answer and a HISTORICAL answer read
// from the same mutable place:
//
//   ASSURE-F03  a Replay distribution consent to the Public World is ONE human
//               act recorded in two evidence stores, and the Replay
//               effective-state derivation consulted only its own half. A human
//               who withdrew the exact linked canonical Public approval through
//               the frozen Public primitive left the Replay half answering
//               EFFECTIVE.
//   ASSURE-F09  five Public command families answered a committed retry by
//               reading `public_experiences.current_lifecycle`, the current
//               `experience_revision`, the current display label or the current
//               disappearance record - live values with nothing to do with what
//               the command returned when it committed.
//
// This contract proves the SHAPE before deploy. Live semantics - the direct
// Public withdrawal, the supersession, the refusal of the distribution, the
// non-Public non-regression, and every corrected retry after the Experience has
// really moved - are proven by database/verify-migration-0121.mjs against real
// PostgreSQL, which this file also pins into CI, the package manifest and the
// database README.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against EXECUTABLE SQL only, never
// against the terminal self-assertion block, which names the words it refuses
// and would otherwise make every such assertion match itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAME = '0121_public_replay_consistency_historical_retry_remediation_v1.sql';
const SOURCE = read(`../migrations/${NAME}`);
const SOURCE_0093 = read('../migrations/0093_public_experience_review_ready_runtime_v1.sql');
const SOURCE_0095 = read('../migrations/0095_public_experience_publication_visibility_serving_v1.sql');
const SOURCE_0099 = read('../migrations/0099_public_experience_disappearance_runtime_v1.sql');
const SOURCE_0105 = read('../migrations/0105_replay_distribution_runtime_export_public_bridge_v1.sql');
const VERIFIER = read('../verify-migration-0121.mjs');
const PREDECESSOR_CONTRACT = read('./matching-proposal-temporal-exact-view-remediation-v1.test.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const sliceOf = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `the source contains "${from}"`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `the source contains "${to}" after "${from}"`);
  return stripComments(source.slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
/** The executable statements of the migration, its terminal self-assertions excluded. */
const body = () => sliceOf(SOURCE, 'BEGIN;', 'TERMINAL SELF-ASSERTIONS');
/** One function's `prosrc` as PostgreSQL will store it: comments included. */
const prosrcOf = (name, source = SOURCE) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const open = source.indexOf('AS $$', start);
  assert.ok(open > start, `${name} has a body`);
  const close = source.indexOf('END$$;', open);
  assert.ok(close > open, `${name} has a body terminator`);
  return source.slice(open + 'AS $$'.length, close + 'END'.length);
};
/** One function's prologue - name, parameters and result shape - normalised. */
const prologueOf = (source, name) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const end = source.indexOf('LANGUAGE plpgsql', start);
  assert.ok(end > start, `${name} has a language clause`);
  return source.slice(start, end).trim();
};
/** The git blob id of one file's LF content: what `git rev-parse HEAD:<path>` prints. */
const blobIdOf = (content) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');

/** The five Public command families 0121 corrects, and the two it proves safe. */
const CORRECTED = [
  'ensure_public_identity_v1',
  'update_public_display_label_v1',
  'create_public_experience_draft_v1',
  'commit_public_experience_ready_for_review_v1',
  'publish_public_experience_v1',
  'remove_public_experience_from_public_world_v1',
  'reconcile_public_experience_disappearance_v1',
];
const REPLAY_STATE = 'derive_replay_distribution_approval_effective_state_v1';
const DERIVATIONS = [
  'derive_public_command_lifecycle_v1',
  'derive_public_experience_lifecycle_at_v1',
  'derive_public_identity_command_answer_v1',
  'derive_public_disappearance_command_answer_v1',
];
/** The mutable reads that were the defect, in the exact spellings 0121 removed. */
const LIVE_LIFECYCLE = /SELECT e\.current_lifecycle FROM public\.public_experiences/u;
const LIVE_REVISION = /SELECT e\.experience_revision FROM public\.public_experiences/u;

// Every migration of the whole chain, pinned by the git blob id of its
// LF-NORMALIZED content at the QAN-CW-REM-03 canonical baseline
// `407bba4675661325e514b50de5d7c66e8943976c`. "Historical migrations 0001-0120
// are immutable" is the load-bearing claim of this task, and a claim nobody
// checks is a claim nobody notices losing.
//
// Normalized rather than raw, for the same reason `read` normalizes: a Windows
// checkout is CRLF and CI is LF, so a raw pin would fail on one of them for
// every developer. For all but one file the two are the same value anyway -
// `0010_initial_him_metrics_v1.sql` is the single migration in the chain that
// carries a CRLF, and pinning its normalized form is what lets this contract
// cover 0001 rather than starting at the Connected Worlds range like its
// predecessor did.
const FROZEN_MIGRATIONS = {
  '0001_core_conversation_schema.sql': '7d0f4809045dd695ef3897d1c214cfdd2537747a',
  '0002_supabase_auth_identity_rls.sql': '744fb5f817465036d4e19aded66d1ffede95b4f1',
  '0003_conversation_orchestration.sql': 'fac7b1ecfad0db33c0293a81dfdb7c76c828b71e',
  '0004_memory_runtime.sql': '6d7bddd97f9eb0d6bd121fbbafd17ef0b023840d',
  '0005_hypothesis_runtime.sql': 'a32e666d7c5bcba20ddee66855d3696af4666dca',
  '0006_confidence_runtime.sql': '5a45add43b961a7bb423aac1c8dc162b139d3b0b',
  '0007_question_information_gap_runtime.sql': '8462667fd1faa522cbe15cdb64d417cb41baaf87',
  '0008_hypothesis_update_loop.sql': 'c8e508239c96cebb3a13eb2e6c8e3fbe9770b1a4',
  '0009_human_model_him_runtime.sql': '8bbc8e3b5763bcc68518062bfef2af584bd4fe6b',
  '0010_initial_him_metrics_v1.sql': '432a46a01e94ce9e5feeedd0b3ff0bce6a818d15',
  '0011_him_metric_calculation_calibration_runtime_v1.sql': 'c10afce3582c3798d9da9830d01ed983ec60a237',
  '0012_hse_energy_measurement_model_v1.sql': '7e74e4cb659536d0eda4a75d6fe5ffc0cc0b9230',
  '0013_hse_motivation_measurement_model_v1.sql': '995a1551c3e39059247769fd5805e5f253c7e9f1',
  '0014_hse_attention_measurement_model_v1.sql': '95609517c1d62167baa286a65fe542e2c70f5000',
  '0015_hse_self_confidence_measurement_model_v1.sql': '13cf463278a1c15c6cf6b474115dccfc286786c6',
  '0016_hse_stress_measurement_model_v1.sql': '0ea3ee24aec7be2ff314c43ee3e564ad0cbe318e',
  '0017_him_temporal_comparability_trends_v1.sql': 'cb400fb6097551093bdbce667e66cc34c354a2cd',
  '0018_him_intelligence_snapshot_foundation_v1.sql': 'dac0c1d0987141da2722286c8bbaaccecd0cee37',
  '0019_runtime_event_outbox_publisher_v1.sql': 'a85d6605ea17e61f7a790c1b3d82a8e48516265a',
  '0020_hypothesis_constraint_function_acl.sql': '6309c9d5cf5337e07f225ee22eab0fa34a932e55',
  '0021_background_intelligence_repository_adapters_v1.sql': '274a139c91ed2c7afa15babc79dc3025655ff60f',
  '0022_post_response_intelligence_dispatch_v1.sql': 'ee07f4d247eb70a49e15699e719dda1923f189d6',
  '0023_association_provider_effect_key_v1.sql': 'c49eba800e0313e96df0b8739110d143ae4bfbe8',
  '0024_durable_memory_effect_result_v1.sql': '6324024883e9dd52c2b56cdb91f573061b23ec95',
  '0025_conversation_authority_hardening_v1.sql': '764fdd29c8abf1f890d23a7e9ae3c5c9d935645e',
  '0026_memory_authority_hardening_v1.sql': '70e6d487349fd00d71a1797e3755b1589854676a',
  '0027_hypothesis_authority_hardening_v1.sql': 'f349ad2aa7c3b193b6a0204b154563f8e2884f67',
  '0028_canonical_evidence_eligibility_v1.sql': '4fc6b7ae5377fd0d9d93fcca288d5d7d6b137397',
  '0029_durable_intent_provider_result_v1.sql': 'a5896589efb002a8ec8369254ab1f7edeb9a112d',
  '0030_conversation_session_authority_hardening_v1.sql': '677311f6b23b5ac6593757b8c9c7f59ca5bc9d13',
  '0031_durable_association_provider_result_v1.sql': '89bafd760eb2c571c5f773f3ade8696c33cd4539',
  '0032_server_authorized_hypothesis_update_invocation_v1.sql': '759427f372f9c843dfcf0faf5cb08b6cd0ce4d0a',
  '0033_hypothesis_generation_atomicity_recovery_v1.sql': 'ddee34b9c7b167fcae36e3f406957ba8c3b272fa',
  '0034_automatic_hypothesis_update_invocation_recovery_v1.sql': '864b19c636a91a91800a30b66dc2f3e6f26f3544',
  '0035_confidence_batch_reliability_v1.sql': '109365c62c4cc4a01fc351f5b88d9fc98e3b6d73',
  '0036_hypothesis_lifecycle_completion_v1.sql': 'fc92d4d59112bbce442cc96343cec0e6b1a413ed',
  '0037_background_him_runtime_consumption_v1.sql': '48e77a6bd9f114a86c350c4c1d3a5974542d30d8',
  '0038_information_gap_question_integration_v1.sql': '9440e1d9cbfcaf6cd444a43e89aecc44c89a986a',
  '0039_foreground_generating_turn_recovery_v1.sql': 'aabdb44db7edc4b04ae773cdf767f2e372fbb566',
  '0040_hbs_avoidance_measurement_model_v1.sql': '54c428a95d2ed221eb4cf6e2cdbac80dc7cc9c38',
  '0041_hbs_consistency_initiative_measurement_models_v1.sql': '5a8613050f26f778c60c29b8d38887303ed3efe1',
  '0042_hbs_reflection_measurement_model_v1.sql': 'c06cee967b2dbbf351e266c52f759b338b6c93d2',
  '0043_hrs_relationship_trust_measurement_model_v1.sql': 'a5f344a6e78b13f096de757dc36ffcb06b38a0bf',
  '0044_hrs_communication_repair_measurement_models_v1.sql': '2743ca40a2ead6d52f3e254df3f1d71f18be2820',
  '0045_hrs_emotional_safety_measurement_model_v1.sql': 'a8f3b3597e81de8f5989daebe00bce6541a9f77b',
  '0046_hgs_self_awareness_measurement_model_v1.sql': '2c0e921244a7e391c66e50c1610cf5ede8f7fa56',
  '0047_hgs_resilience_measurement_model_v1.sql': 'bb6100759a2553f3e6a71b76e0aed35a43d72053',
  '0048_hgs_purpose_alignment_measurement_model_v1.sql': '35d74b71d5a4e66f6143b6ff138c55ad41b5c0cf',
  '0049_hgs_habit_strength_measurement_model_v1.sql': '14a387e21e74ce405ff99ec9a32d2f61ad4049e9',
  '0050_him_structured_current_binding_transition_safety_v1.sql': 'b805c1fff302a336edbe524700f9aac5ebdb7537',
  '0051_him_legacy_snapshot_authority_energy_context_reconciliation_v1.sql': '04981d148cbe3534d0fb5bc38a81d81d5b861c24',
  '0052_him_canonical_latest_measurement_read_semantics_v1.sql': '39213a0bda92d55df75c68a51a08235935cce8bd',
  '0053_him_legacy_energy_current_authority_reconciliation_v1.sql': 'f50461a2f4dbb0ebdec6fee597792f21cb4e8d00',
  '0054_him_contextual_current_intelligence_batch_read_v1.sql': '42b457bc6be49adee65a42157720a9b6e12626e8',
  '0055_him_session_context_binding_relevance_v1.sql': '4e30120f2255af75591c837be92a9548943e03cc',
  '0056_him_situation_stress_foreground_consumption_v1.sql': '71a9aa4c529b786b5bc9d2bc9581b0193c2e2ea5',
  '0057_him_decision_attention_foreground_consumption_v1.sql': 'c7f5fec0a98fb77b78b99a77db8659d8ab429cc4',
  '0058_him_cross_context_foreground_aggregation_v1.sql': '321bfd1d23a17ebb8afd2850c46711a1da74de69',
  '0059_him_goal_motivation_foreground_consumption_v1.sql': 'e2caeccdc1c8f6280ee0592680631609a6227b74',
  '0060_him_relationship_communication_foreground_consumption_v1.sql': '9410ad14c94e3090ac1abfeeb7d6347198845eb1',
  '0061_him_brain_context_bridge_v1.sql': 'f20af0c0f1e2841c18386a5871559d40aa12a628',
  '0062_fast_deep_runtime_decision_policy_v2.sql': '9fd914ec2dfff24205c660b73435784bbd361682',
  '0063_question_information_gap_closed_loop_v1.sql': 'c2902cc58d0037cf8487a443945a437e272e4c5e',
  '0064_committed_conversational_unit_substrate_v1.sql': '0a2ee63980e59072b3e9f52a643efa8220e95b08',
  '0065_session_semantic_clock_sp_lh_delivery_v1.sql': '3dc061c71bcb237cec648abb2d1fa02f450cd57f',
  '0066_durable_reference_emerging_focus_sp_substrate_v1.sql': '9f0588d5ca46329a8721ee30302f49d227a357ae',
  '0067_conversation_focus_runtime_integration_readiness_v1.sql': 'd12a3f552e80709ee1d20887f55f1c84e84f9208',
  '0068_durable_thread_home_same_sp_substrate_v1.sql': '5ea270424059acd40c0a6bf7dc040efc3aa693d3',
  '0069_thread_runtime_integration_readiness_v1.sql': 'fc2531a5a880f440b7086a3a63ba6557527413a7',
  '0070_thread_lifecycle_cross_session_continuity_v1.sql': '8436717bcf23877e1c1048b248b51717f5a9a8a6',
  '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql': '0e258100c9030f2ce652e18700638ee90b0e68e6',
  '0072_historical_coverage_projection_disclosure_v1.sql': 'c48286e575960ac3693f75b77324597b723089fc',
  '0073_supabase_free_plan_keepalive_v1.sql': '23138c7727d08d7bf75e7de78acccc737b8453fd',
  '0074_supabase_keepalive_permission_correction_v1.sql': '40bb05d9b1ab5ef2b8172fda6e66cf79510ea44b',
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
  '0119_shared_historical_authority_remediation_v1.sql': '77f01566a8e1070fd038cefc52e70d3fe5ef7bba',
  '0120_matching_proposal_temporal_exact_view_remediation_v1.sql': 'b233c8bc4405e8f54668ed6306ef781227746e97',
};

test('migration 0121 is one forward-only transaction, ordered after its predecessor', () => {
  const migrations = readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((name) => name.startsWith('0121_')).length, 1, 'exactly one migration carries 0121');
  assert.equal(migrations.indexOf(NAME),
    migrations.indexOf('0120_matching_proposal_temporal_exact_view_remediation_v1.sql') + 1,
    'ordering directly after the reviewed QAN-CW-REM-02 tip');
  assert.match(SOURCE, /^-- QAN-CW-REM-03/u, 'the migration declares its task');
  assert.equal((SOURCE.match(/\nBEGIN;\n/gu) ?? []).length, 1, 'it is one transaction');
  assert.match(SOURCE, /COMMIT;\n$/u, 'and it commits');

  const executable = body();
  // A CORRECTION THAT DROPPED OR REWROTE SCHEMA WOULD NOT BE A CORRECTION.
  assert.doesNotMatch(executable, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|COLUMN|CONSTRAINT|SCHEMA|ROLE)/iu,
    'it drops no object');
  assert.doesNotMatch(executable, /TRUNCATE|DELETE FROM/iu, 'it destroys nothing');
  assert.doesNotMatch(executable, /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
    'it introduces no policy, view, extension or enum type');
  assert.doesNotMatch(executable, /\bGRANT\b/u, 'and it grants nothing to anybody');
  // THE ONLY PREDECESSOR RELATIONS IT ALTERS are the two command histories that
  // had nowhere to keep the answer they committed, and the only thing it does to
  // either is ADD the answer their own frozen law says they should always have
  // carried.
  const altered = [...executable.matchAll(/ALTER TABLE public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(altered)].sort(),
    ['public_experience_disappearance_commands', 'public_identity_commands'],
    'exactly the two command histories that store an answer are altered');
  assert.doesNotMatch(executable, /DROP COLUMN|ALTER COLUMN|RENAME/iu, 'and no column is dropped, altered or renamed');
});

test('historical migrations 0001-0120 are byte-identical to the canonical baseline', () => {
  const pinned = Object.keys(FROZEN_MIGRATIONS);
  const present = readdirSync(new URL('../migrations', import.meta.url))
    .filter((file) => file.endsWith('.sql') && Number(file.slice(0, 4)) <= 120).sort();
  assert.deepEqual(present, pinned.slice().sort(),
    'every migration numbered 0120 or below is pinned, and the pin names no file that is gone');
  for (const [file, blob] of Object.entries(FROZEN_MIGRATIONS)) {
    assert.equal(blobIdOf(read(`../migrations/${file}`)), blob,
      `${file} is byte-identical to the QAN-CW-REM-03 canonical baseline`);
  }
  const numbers = pinned.map((file) => Number(file.slice(0, 4))).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 120 }, (_, i) => 1 + i),
    'the pin covers 0001 through 0120 with no gap');
});

test('the eight replaced boundaries keep their exact frozen signatures', () => {
  // A forward replacement that quietly changed a parameter or a result column
  // would be a NEW boundary wearing an old name, and every caller and every
  // frozen contract would still be pointed at the old one.
  for (const [name, predecessor] of [
    ['ensure_public_identity_v1', SOURCE_0093],
    ['update_public_display_label_v1', SOURCE_0093],
    ['create_public_experience_draft_v1', SOURCE_0093],
    ['commit_public_experience_ready_for_review_v1', SOURCE_0093],
    ['publish_public_experience_v1', SOURCE_0095],
    ['remove_public_experience_from_public_world_v1', SOURCE_0099],
    ['reconcile_public_experience_disappearance_v1', SOURCE_0099],
    [REPLAY_STATE, SOURCE_0105],
  ]) {
    const replaced = prologueOf(SOURCE, name).replace(/^CREATE OR REPLACE /u, 'CREATE ');
    assert.equal(replaced, prologueOf(predecessor, name).replace(/^CREATE OR REPLACE /u, 'CREATE '),
      `${name} is byte-identical to its frozen declaration apart from OR REPLACE`);
  }
  for (const name of [...CORRECTED, REPLAY_STATE]) {
    assert.match(SOURCE, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, 'u'),
      `${name} is forward-replaced rather than created anew`);
  }
});

// ---------------------------------------------------------------- ASSURE-F03
test('the Replay effective state COMPOSES the canonical Public derivation', () => {
  const state = prosrcOf(REPLAY_STATE);
  assert.match(state, /public\.derive_publication_approval_effective_state_v1\(a\.linked_public_approval_id\)/u,
    'it consumes the canonical 0094 derivation for the EXACT linked approval');
  // NOT A SEARCH. The consent act committed one exact Public approval identity,
  // and an approval that reached the same manifest another way is not it.
  assert.doesNotMatch(state, /manifest_version_id\s*=/u,
    'it never looks for "some approval on this manifest"');
  // PUBLIC CONSENT LAW IS NOT RE-IMPLEMENTED HERE.
  for (const forbidden of ['publication_approval_withdrawal_events', 'public_experience_versions',
    'current_experience_version_id', 'package_manifest_version_id']) {
    assert.ok(!state.includes(forbidden),
      `Public withdrawal and supersession stay 0094's rules: ${forbidden} does not appear`);
  }
});

test('human withdrawal dominates, and structural staleness comes after it', () => {
  const state = stripComments(prosrcOf(REPLAY_STATE));
  const replayWithdrawal = state.indexOf("WHEN w.id IS NOT NULL THEN 'WITHDRAWN'");
  const publicWithdrawal = state.indexOf("WHEN linked.effective_state = 'WITHDRAWN' THEN 'WITHDRAWN'");
  const fingerprint = state.indexOf('bound_authority_fingerprint IS DISTINCT FROM');
  const publicStale = state.indexOf("linked.effective_state IS DISTINCT FROM 'EFFECTIVE'");
  const effective = state.lastIndexOf("ELSE 'EFFECTIVE'");
  assert.ok(replayWithdrawal >= 0 && publicWithdrawal >= 0 && fingerprint >= 0 && publicStale >= 0 && effective >= 0,
    'every branch of the precedence exists');
  assert.ok(replayWithdrawal < publicWithdrawal, 'the Replay withdrawal is tested first');
  assert.ok(publicWithdrawal < fingerprint, 'EITHER human withdrawal dominates every structural fact');
  assert.ok(fingerprint < publicStale, 'then the Replay half own staleness');
  assert.ok(publicStale < effective, 'then the linked Public staleness, and EFFECTIVE is last');
  // THE PRECEDENCE IS WHAT KEEPS THE TWO WITHDRAWAL COMMANDS' OWN ANSWERS PINNED:
  // both answer WITHDRAWN, and the Replay event is tested before anything else.
  assert.match(prosrcOf('withdraw_replay_distribution_approval_v1', SOURCE_0105),
    /derive_replay_distribution_approval_effective_state_v1/u,
    'the Replay withdrawal retry reads this derivation, so its first branch must stay first');
});

test('a non-Public destination acquires no Public dependency', () => {
  const state = prosrcOf(REPLAY_STATE);
  // BOTH Public branches are guarded. The withdrawal branch cannot fire for a
  // NULL link because `NULL = 'WITHDRAWN'` is not true; the staleness branch is
  // guarded explicitly, because `NULL IS DISTINCT FROM 'EFFECTIVE'` IS true and
  // would otherwise supersede every external share and every download.
  assert.match(state, /a\.linked_public_approval_id IS NOT NULL\s*\n\s*AND linked\.effective_state IS DISTINCT FROM 'EFFECTIVE'/u,
    'the supersession branch fires only when a linked Public approval exists');
  assert.match(state, /LEFT JOIN LATERAL[\s\S]*?ON a\.linked_public_approval_id IS NOT NULL/u,
    'and the lateral join itself is conditional on the link');
  // The 0104 shape check is what makes "no link" mean "not Public".
  assert.match(read('../migrations/0104_replay_distribution_package_authority_v1.sql'),
    /destination_action <> 'PUBLISH_TO_PUBLIC_WORLD'\s*\n\s*AND linked_public_approval_id IS NULL/u,
    'a non-Public approval structurally cannot carry a linked Public approval');
});

// ---------------------------------------------------------------- ASSURE-F09
test('no corrected Public retry path reads the mutable current state it used to', () => {
  for (const name of ['create_public_experience_draft_v1', 'commit_public_experience_ready_for_review_v1',
    'publish_public_experience_v1']) {
    const source = prosrcOf(name);
    assert.doesNotMatch(source, LIVE_LIFECYCLE, `${name} no longer reads the mutable current lifecycle`);
    assert.match(source, /public\.derive_public_command_lifecycle_v1\(\s*\n?\s*committed\.id, committed\.experience_id/u,
      `${name} answers its retry from the lifecycle event ITS OWN command id names`);
  }
  assert.doesNotMatch(prosrcOf('create_public_experience_draft_v1'), LIVE_REVISION,
    'the draft retry no longer reads the mutable experience revision either');
  for (const name of ['remove_public_experience_from_public_world_v1', 'reconcile_public_experience_disappearance_v1']) {
    const source = prosrcOf(name);
    const retries = [...source.matchAll(/'ALREADY_COMMITTED'::text/gu)];
    assert.equal(retries.length, 2, `${name} has exactly its two frozen idempotency passes`);
    assert.equal((source.match(/derive_public_disappearance_command_answer_v1/gu) ?? []).length, 2,
      `${name} answers BOTH of them from the committed-answer derivation`);
  }
  for (const name of ['ensure_public_identity_v1', 'update_public_display_label_v1']) {
    const source = prosrcOf(name);
    assert.match(source, /derive_public_identity_command_answer_v1\(committed\.id\)/u,
      `${name} answers its retry from the committed label answer`);
    assert.match(source, /committed_label_mode, committed_display_label/u,
      `${name} records the answer it committed, for every future retry`);
  }
});

// REM03-HIST-01. The exact truth already existed; the correction must bind it.
test('a lifecycle retry binds the exact event its command id names, never a time', () => {
  const source = prosrcOf('derive_public_command_lifecycle_v1');
  assert.match(source, /FROM public\.public_experience_lifecycle_events le WHERE le\.id = p_command_id/u,
    'the event is found by the COMMAND identity and by nothing else');
  // The instant is an EQUALITY check on the command's own committed instant,
  // never a bound: no ordering, no limit and no "latest" anywhere in it.
  assert.doesNotMatch(source, /\bmax\s*\(|ORDER BY|LIMIT|occurred_at <=|occurred_at >=/iu,
    'an instant is not a command identity, so nothing here searches by time');
  assert.match(source, /moved\.occurred_at <> p_committed_at/u, 'it compares the instant for EQUALITY');
  // Every axis the event can be checked on, so a right-id wrong-event answers nothing.
  for (const [clause, what] of [
    [/moved\.experience_id <> p_experience_id/u, 'the Experience the command bound'],
    [/moved\.experience_version_id IS DISTINCT FROM p_experience_version_id/u, 'the version it bound'],
    [/moved\.to_lifecycle <> p_committed_lifecycle/u, 'the lifecycle that family commits'],
    [/moved\.occurred_at <> p_committed_at/u, 'the command own committed instant'],
  ]) {
    assert.match(source, clause, `the exact binding validates ${what}`);
  }
  assert.match(source, /PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY/u,
    'and anything else is contradictory history rather than another plausible event');

  // THE THREE FAMILIES REALLY WRITE THE EVENT UNDER THE COMMAND IDENTITY, which
  // is what makes the binding available at all. Read from the FROZEN sources.
  for (const [name, source0, expected] of [
    ['create_public_experience_draft_v1', SOURCE_0093, "VALUES (p_command_id, p_experience_id, NULL, NULL, 'DRAFT'"],
    ['commit_public_experience_ready_for_review_v1', SOURCE_0093,
      "VALUES (p_command_id, p_experience_id, p_experience_version_id, 'DRAFT', 'READY_FOR_REVIEW'"],
    ['publish_public_experience_v1', SOURCE_0095,
      "VALUES (p_command_id, p_experience_id, p_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED'"],
  ]) {
    assert.ok(prosrcOf(name, source0).includes(expected),
      `the frozen ${name} already wrote its lifecycle event under the command identity`);
    assert.ok(prosrcOf(name).includes(expected), `and the replacement still does`);
  }
});

test('the temporal reconstruction is the LEGACY fallback and has exactly one caller', () => {
  const source = prosrcOf('derive_public_experience_lifecycle_at_v1');
  assert.match(source, /FROM public\.public_experience_lifecycle_events/u, 'it reads the append-only event log');
  assert.doesNotMatch(source, /public\.public_experiences\b/u, 'and never the mutable current pointer');
  assert.match(source, /le\.occurred_at <= p_at/u, 'bounded at the instant asked about');
  // BOTH fail-closed branches: no evidence, and ambiguous evidence. The second
  // is why it can never be the primary store - `occurred_at` is not unique.
  assert.equal((source.match(/PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY/gu) ?? []).length, 2,
    'it fails closed on no event at or before the instant, and on two events sharing the latest instant');
  assert.match(source, /IF events <> 1 THEN/u, 'the ambiguity check is an exact-count check');

  // AND NOTHING ELSE MAY REACH IT. A future family that answered by time would
  // be caught here rather than by a silently weaker answer.
  const body_ = body();
  const callers = [...body_.matchAll(/derive_public_experience_lifecycle_at_v1/gu)];
  // One declaration, one REVOKE pair, one COMMENT, and exactly one call site.
  assert.match(prosrcOf('derive_public_disappearance_command_answer_v1'),
    /derive_public_experience_lifecycle_at_v1\(committed\.experience_id, committed\.committed_at\)/u,
    'the one caller is the legacy branch of the disappearance answer');
  for (const name of ['create_public_experience_draft_v1', 'commit_public_experience_ready_for_review_v1',
    'publish_public_experience_v1', 'remove_public_experience_from_public_world_v1',
    'reconcile_public_experience_disappearance_v1', 'derive_public_identity_command_answer_v1']) {
    assert.ok(!prosrcOf(name).includes('derive_public_experience_lifecycle_at_v1'),
      `${name} does not reconstruct a historical answer by time`);
  }
  assert.ok(callers.length >= 1, 'the fallback is declared and reachable');
});

test('the disappearance family STORES its exact answer, and reads it first', () => {
  const executable = body();
  // REM03-HIST-01: temporal inference is not the primary store for a command
  // that commits an answer without moving a lifecycle.
  assert.match(executable, /ADD COLUMN committed_absent_experience_version_id uuid/u, 'the version it returned');
  assert.match(executable, /ADD COLUMN committed_disappearance_basis text/u, 'the basis it returned');
  assert.match(executable, /ADD COLUMN committed_lifecycle text/u, 'and the lifecycle it returned');
  assert.doesNotMatch(executable, /\b(json|jsonb)\b/iu, 'no generic JSON response blob is introduced anywhere');
  assert.match(executable, /committed_absent_experience_version_id = target_experience_version_id/u,
    'an answer that reported an absence names the EXACT publication the command bound');
  assert.match(executable, /CREATE TRIGGER public_experience_disappearance_commands_answer_required\s*\n\s*BEFORE INSERT/u,
    'and a future command that does not carry its answer is refused structurally');

  const source = prosrcOf('derive_public_disappearance_command_answer_v1');
  const stored = source.indexOf('IF committed.committed_lifecycle IS NOT NULL THEN');
  const exact = source.indexOf('WHERE le.id = p_command_id');
  const legacy = source.indexOf('derive_public_experience_lifecycle_at_v1');
  assert.ok(stored >= 0 && exact > stored && legacy > exact,
    'three tiers, strongest first: the stored answer, then the event this command wrote, then the legacy fallback');
  assert.match(source, /d\.absent_experience_version_id = committed\.target_experience_version_id/u,
    'the sealed record is bound by the exact version the command committed against');
  assert.doesNotMatch(source, /public\.public_experiences\b/u, 'nothing here reads the mutable pointer');

  // AND EVERY WRITER RECORDS IT. A branch that inserted without the answer
  // would fall through to the fallback forever.
  for (const name of ['remove_public_experience_from_public_world_v1',
    'reconcile_public_experience_disappearance_v1']) {
    const writer = prosrcOf(name);
    const inserts = (writer.match(/INSERT INTO public\.public_experience_disappearance_commands/gu) ?? []).length;
    const answers = (writer.match(/committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle/gu) ?? []).length;
    assert.equal(answers, inserts, `${name} records its answer on every one of its ${inserts} command writes`);
  }
});

test('the Public Identity answer is typed, bounded and required of every future command', () => {
  const executable = body();
  assert.match(executable, /ADD COLUMN committed_label_mode text/u, 'the committed mode is a typed column');
  assert.match(executable, /ADD COLUMN committed_display_label text/u, 'and so is the committed label');
  assert.doesNotMatch(executable, /\b(json|jsonb)\b/iu, 'no generic JSON response blob is introduced anywhere');
  assert.match(executable, /committed_label_mode IN \('PSEUDONYM', 'REAL_NAME'\)/u, 'the mode vocabulary is bounded');
  assert.match(executable, /\(committed_label_mode IS NULL\) = \(committed_display_label IS NULL\)/u,
    'the answer is whole or absent, never half-recorded');
  assert.match(executable, /CREATE TRIGGER public_identity_commands_answer_required\s*\n\s*BEFORE INSERT/u,
    'a future command that does not carry its answer is refused structurally, not by discipline');

  // AND THE LEGACY PATH RECONSTRUCTS FROM A WITNESS, or fails closed.
  const answer = prosrcOf('derive_public_identity_command_answer_v1');
  assert.match(answer, /IF committed\.committed_label_mode IS NOT NULL THEN/u,
    'a command that carries its answer returns exactly that');
  assert.match(answer, /display\.label_revision IS DISTINCT FROM committed\.label_revision/u,
    'and a pre-0121 one is reconstructed only while the committed revision witness still holds');
  assert.match(answer, /PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY/u,
    'otherwise it fails closed rather than substituting the current label');
});

test('the two already-immutable families are left alone, with their proof recorded', () => {
  // P07 and P08 of the census. Changing a correct answer's spelling would be
  // churn; asserting it is correct without saying WHY would be a comment.
  assert.ok(!SOURCE.includes('CREATE OR REPLACE FUNCTION public.withdraw_publication_approval_v1'),
    'the Public withdrawal is not replaced');
  assert.ok(!SOURCE.includes('CREATE OR REPLACE FUNCTION public.prepare_public_experience_manifest_v1'),
    'and neither is the package preparation');
  assert.match(SOURCE, /PROVEN\s*\n--\s*PINNED/u,
    'the withdrawal answer is recorded as proven pinned rather than merely assumed');
  // The proof itself, asked of the frozen sources: the event is append-only and
  // the derivation reports WITHDRAWN first, so the answer cannot be anything else.
  const frozen = read('../migrations/0094_public_publication_effective_approval_state_v1.sql');
  assert.match(frozen, /CREATE TRIGGER publication_approval_withdrawal_events_immutable/u,
    'the withdrawal event relation is append-only');
  assert.match(frozen, /CASE WHEN w\.id IS NOT NULL THEN 'WITHDRAWN'/u,
    'and the canonical derivation reports a withdrawal before anything else');
  // The preparation's `version_ordinal` comes from a relation nothing may rewrite.
  assert.match(read('../migrations/0091_public_world_experience_identity_foundation_v1.sql'),
    /CREATE TRIGGER public_experience_versions_immutable/u,
    'the version row the preparation retry reads is immutable for every role');
});

// ------------------------------------------------------------ REM03-HIST-02
test('both answer-carrying command histories are append-only for EVERY role', () => {
  // The two relations 0121 makes authoritative for an exact historical answer
  // had RLS and revoked privileges and nothing else. A privilege binds roles;
  // it does not bind the owner, and it says nothing about what a row may
  // become. Neither predecessor installed a mutation guard, which is precisely
  // why this one is new rather than inherited.
  assert.ok(!SOURCE_0093.includes('public_identity_commands_immutable'),
    '0093 created the Public Identity command history with no UPDATE / DELETE guard');
  assert.ok(!SOURCE_0099.includes('public_experience_disappearance_commands_immutable'),
    'and 0099 created the disappearance command history with none either');

  const executable = body();
  assert.match(executable, /CREATE FUNCTION public\.reject_public_command_history_mutation_v1\(\)/u,
    '0121 installs one guard function for both histories');
  for (const relation of ['public_identity_commands', 'public_experience_disappearance_commands']) {
    assert.match(executable,
      new RegExp(`CREATE TRIGGER ${relation}_immutable\\s*\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${relation}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_public_command_history_mutation_v1\\(\\)`, 'u'),
      `${relation} refuses every UPDATE and every DELETE, one row at a time`);
  }
  // ONE function for both, so the two relations cannot drift into different rules.
  assert.equal((executable.match(/reject_public_command_history_mutation_v1\(\)/gu) ?? []).length, 4,
    'the guard is declared once, owned once and installed on exactly two relations');

  // NO EXCEPTION FOR THE ANSWER COLUMNS, and no conditional escape: the guard
  // takes no column list and no WHEN clause, and its body only ever raises.
  const guard = prosrcOf('reject_public_command_history_mutation_v1');
  assert.match(guard, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE'/u,
    'it refuses with the class the Public domain already uses for immutable history');
  assert.doesNotMatch(guard, /RETURN NEW|RETURN OLD|IF /u, 'and there is no path through it that permits anything');
  assert.doesNotMatch(executable, /BEFORE UPDATE OF |CREATE TRIGGER [a-z_]+_immutable[\s\S]{0,200}?WHEN \(/u,
    'no column-scoped or conditional variant of either guard exists');

  // AND NO MUTATION PATH WAS ADDED ANYWHERE - not a primitive, not a backfill.
  for (const relation of ['public_identity_commands', 'public_experience_disappearance_commands']) {
    assert.ok(!new RegExp(`(UPDATE|DELETE FROM)\\s+public\\.${relation}\\b`, 'u').test(executable),
      `nothing in 0121 UPDATEs or DELETEs public.${relation}`);
  }
  assert.doesNotMatch(executable, /ALTER COLUMN committed_(label_mode|display_label|lifecycle) SET NOT NULL/u,
    'a pre-0121 row keeps its NULL answer: an unknown answer is not made known by freezing the row');

  // The catalog assertion, so a later migration that dropped or disabled either
  // guard fails at the end of THIS one rather than silently later.
  const assertions = SOURCE.slice(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS'));
  assert.match(assertions, /tg\.tgtype = 27/u,
    'the terminal assertion pins BEFORE + ROW + UPDATE + DELETE rather than "a trigger exists"');
  assert.match(assertions, /tg\.tgenabled = 'O'/u, 'and pins that it is ENABLED');
  assert.match(assertions, /fn\.proname = 'reject_public_command_history_mutation_v1'/u,
    'and that it is the shared guard rather than some permissive replacement');
});

// ------------------------------------------------------------ REM03-CONC-01
test('the cross-domain withdrawal race rests on revalidation, not on a new lock', () => {
  // The invariant the race proves is a COMPOSITION of two frozen orderings, and
  // both halves are pinned here so a future edit that broke either would fail
  // this contract as well as the race.
  //
  //   the Replay authorization checks the composed consent EARLY, under the
  //   Replay locks, and reaches the Public destination LATE
  const authorize = stripComments(prosrcOf('authorize_replay_distribution_v1', SOURCE_0105));
  const replayConsent = authorize.indexOf('derive_replay_distribution_effective_approvals_v1');
  const publicWorld = authorize.indexOf('public.public_world_state w WHERE w.singleton FOR UPDATE');
  const publish = authorize.indexOf('public.publish_public_experience_v1');
  assert.ok(replayConsent >= 0 && publicWorld > replayConsent,
    'the authorization composes consent BEFORE it reaches the Public World row - which is the race window');
  assert.ok(publish > publicWorld,
    'and performs the publication through the canonical Public boundary, under that lock');

  //   and the canonical Public boundary re-derives every required approval's
  //   CURRENT effective state AFTER taking that same row
  const publishing = stripComments(prosrcOf('publish_public_experience_v1'));
  const lock = publishing.indexOf('public.public_world_state w WHERE w.singleton FOR UPDATE');
  const revalidation = publishing.indexOf('derive_publication_manifest_effective_approvals_v1');
  assert.ok(lock >= 0 && revalidation > lock,
    'the Public publish revalidates consent under the Public World lock, which is what closes the window');
  assert.match(publishing, /PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE/u,
    'and refuses with the class the race pins');

  // NO NEW LOCK WAS ADDED TO MAKE THIS TRUE. 0121 does not replace the Replay
  // authorization at all, and adds no lock to the boundary it does replace.
  assert.ok(!SOURCE.includes('CREATE OR REPLACE FUNCTION public.authorize_replay_distribution_v1'),
    '0121 does not touch the Replay authorization');
  assert.equal((stripComments(prosrcOf('publish_public_experience_v1')).match(/FOR UPDATE|FOR SHARE/gu) ?? []).length,
    (stripComments(prosrcOf('publish_public_experience_v1', SOURCE_0095)).match(/FOR UPDATE|FOR SHARE/gu) ?? []).length,
    'and the replaced Public publish takes exactly the row locks it always took');
});

// -------------------------------------------------------------- lock posture
test('0121 adds no lock of any kind', () => {
  const executable = body();
  assert.doesNotMatch(executable, /pg_advisory|LOCK TABLE|SET TRANSACTION|SERIALIZABLE/iu,
    'no advisory lock, no table lock and no isolation change');
  for (const name of DERIVATIONS) {
    const source = prosrcOf(name);
    assert.doesNotMatch(source, /FOR UPDATE|FOR SHARE/u, `${name} takes no row lock`);
    assert.match(SOURCE, new RegExp(`FUNCTION public\\.${name}\\([^)]*\\)[\\s\\S]{0,400}?STABLE`, 'u'),
      `${name} is STABLE`);
  }
  // The canonical lock order of every replaced consequential boundary is
  // unchanged: the ONE Public World first, then the exact Experience.
  for (const name of ['create_public_experience_draft_v1', 'commit_public_experience_ready_for_review_v1',
    'publish_public_experience_v1', 'remove_public_experience_from_public_world_v1',
    'reconcile_public_experience_disappearance_v1']) {
    const source = stripComments(prosrcOf(name));
    const world = source.indexOf('public.public_world_state w WHERE w.singleton FOR UPDATE');
    assert.ok(world >= 0, `${name} still takes the ONE Public World first`);
    const experience = source.indexOf('public.public_experiences e WHERE e.id');
    if (experience >= 0) assert.ok(world < experience, `${name} takes the World before the Experience`);
  }
});

test('0121 widens no application-role execution and implements no ASSURE-F05', () => {
  const executable = body();
  assert.match(executable, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u,
    'every replaced boundary is re-revoked');
  assert.match(executable, /REVOKE ALL ON FUNCTION %s FROM service_role/u, 'service_role included');
  // ASSURE-F05 is Public DRAFT recall on source deletion. Nothing here recalls,
  // deletes or invalidates a Public derivative for any reason.
  for (const forbidden of ['shared_world_material_deleted_events', 'availability_state', 'DELETED_BY_OWNER',
    'recall', 'RECALL']) {
    assert.ok(!executable.includes(forbidden),
      `0121 implements no Public source-deletion policy: ${forbidden} does not appear`);
  }
});

// ------------------------------------------------------- registration + pins
test('the 0121 verifier is registered everywhere it has to run', () => {
  assert.match(packageJson,
    /"verify:public-replay-consistency-historical-retry-remediation:integration": "node --env-file-if-exists=\.env database\/verify-migration-0121\.mjs"/u,
    'the verifier has an npm script');
  assert.match(workflow, /run: npm run verify:public-replay-consistency-historical-retry-remediation:integration/u,
    'and API CI runs it: an unregistered verifier is a file nobody executes');
  assert.match(readme, /QAN-CW-REM-03[\s\S]{0,4000}migration 0121/u,
    'and the database README documents it');
});

test('the verifier proves the semantics this contract only shapes', () => {
  // A structural contract cannot prove that a direct Public withdrawal really
  // makes a distribution refuse. These are the scenarios that do.
  for (const scenario of ['R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10',
    'F01', 'F02', 'F03p', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09n', 'F10', 'F11',
    'H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08',
    'H-IMM-01', 'H-IMM-02', 'H-IMM-03', 'H-IMM-04', 'H-IMM-05', 'H-IMM-06',
    'C01', 'C02']) {
    assert.ok(VERIFIER.includes(`'${scenario} `), `the verifier carries scenario ${scenario}`);
  }
  // REM03-HIST-02: the guard is proved against the LIVE trigger, as the owner,
  // on both relations, for UPDATE and for DELETE - and the canonical writes are
  // proved still to work, because a guard that broke INSERT would pass the rest.
  assert.match(VERIFIER, /PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE/u,
    'the verifier pins the append-only refusal class');
  assert.match(VERIFIER, /asPre0121Row/u,
    'and reaches a pre-0121 row by lifting the guard inside the rolled-back verifier transaction, never by leaving a mutation path');
  // REM03-CONC-01: the interleaving is PINNED, and pinned by queue position
  // rather than by hope, and the refusal is the canonical Public one.
  assert.match(VERIFIER, /pg_blocking_pids/u,
    'the race observes the real lock queue rather than assuming an order');
  assert.match(VERIFIER, /blockedBehind\(authorizePid, withdrawPid\)/u,
    'and proves the authorization is queued BEHIND the withdrawal specifically');
  assert.match(VERIFIER, /awaitedLocks\(authorizePid\)[\s\S]{0,200}?public_world_state/u,
    'and that it is waiting at the Public destination, which is proof it passed every Replay-side gate');
  assert.match(VERIFIER, /PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE/u,
    'and that the canonical Public revalidation is what refuses it');
  assert.match(VERIFIER, /C01 no Replay withdrawal event exists/u,
    'and that no synthetic Replay withdrawal was invented to make the refusal happen');
  assert.match(VERIFIER, /another plausible event exists at\s*\n\s*\/\/\s*the same instant|plant another one for the same/u,
    'and it plants a plausible event a temporal reconstruction would have answered from');
  assert.match(VERIFIER, /withdraw_publication_approval_v1/u,
    'and it withdraws the Public half through the CANONICAL primitive, by its own name');
  assert.match(VERIFIER, /REPLAY_DISTRIBUTION_APPROVAL_NOT_EFFECTIVE/u,
    'and requires the distribution to refuse with the frozen class');
  assert.match(VERIFIER, /assertAllPassed/u, 'and reports every independent scenario in one round');
});

test('the QAN-CW-REM-02 contract is reconciled forward rather than left contradicting the chain', () => {
  // Migration 0120 asserted it was the TIP of the chain, which was true when it
  // was written and is not a property any migration keeps - exactly as 0119's
  // identical assertion was reconciled by 0120. It is reconciled to the thing it
  // actually meant, forward-only ordering, rather than deleted.
  assert.ok(PREDECESSOR_CONTRACT.includes('QAN-CW-REM-03'),
    'the 0120 contract names the task that moved its expectation');
  assert.doesNotMatch(PREDECESSOR_CONTRACT, /assert\.equal\(migrations\.at\(-1\), NAME/u,
    'the stale tip assertion is gone');
  assert.match(PREDECESSOR_CONTRACT, /migrations\.indexOf\('0119_shared_historical_authority_remediation_v1\.sql'\) \+ 1/u,
    'and is replaced by the forward-only ordering it was really asserting');
  // NON-VACUITY: everything else 0120 owned is untouched.
  assert.match(PREDECESSOR_CONTRACT, /ASSURE-F01/u, 'its temporal verdict is unchanged');
  assert.match(PREDECESSOR_CONTRACT, /ASSURE-F08/u, 'and its exact-view verdict is unchanged');
});
