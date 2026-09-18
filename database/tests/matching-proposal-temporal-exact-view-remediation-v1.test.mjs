// QAN-CW-REM-02 - Matching proposal temporal correctness and exact-view
// decision identity v1: secret-free structural contract over migration 0120.
//
// Migration 0120 corrects two accepted phase-wide assurance findings that I-07C
// had already found and fixed at ONE site each while the sibling I-07B sites
// kept them:
//
//   ASSURE-F01  the two proposal-delivery paths decided `expires_at` against a
//               TRANSACTION-start clock, which PostgreSQL settles before the
//               command ever waits on the canonical two-human lock
//   ASSURE-F08  three of the four human decision retries returned historical
//               success from the transition alone, proving no exact recipient
//               view
//
// This contract proves the SHAPE before deploy. Live semantics - the two
// barrier-pinned cross-deadline races, the pre-fix demonstration, every retry
// direction, the missing-binding refusal, the structural unrepresentability of a
// wrong binding, and the I-07B/I-07C non-regressions - are proven by
// database/verify-migration-0120.mjs against real PostgreSQL, which this file
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
const NAME = '0120_matching_proposal_temporal_exact_view_remediation_v1.sql';
const SOURCE = read(`../migrations/${NAME}`);
const SOURCE_0112 = read('../migrations/0112_matching_proposal_choreography_runtime_v1.sql');
const SOURCE_0113 = read('../migrations/0113_matching_mutual_match_introduction_persistence_v1.sql');
const VERIFIER = read('../verify-migration-0120.mjs');
const PROPOSAL_SUPPORT = read('../matching-proposal-verifier-support.mjs');
const SETUP_SUPPORT = read('../matching-setup-verifier-support.mjs');
const PREDECESSOR_CONTRACT = read('./shared-historical-authority-remediation-v1.test.mjs');
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
const body = () => sliceOf(SOURCE, 'BEGIN;', 'TERMINAL SELF-ASSERTIONS');
/**
 * One function's `prosrc` as PostgreSQL will store it: exactly the text between
 * `AS $$` and the closing `$$`, with no CREATE header.
 *
 * The terminal self-assertions read `pg_proc.prosrc`, so a simulation that fed
 * them the whole declaration would be testing something the database never sees -
 * and, crucially, `prosrc` INCLUDES the body's own comments, which is what makes
 * a "this function names no transaction clock" assertion able to match itself.
 */
const prosrcOf = (name, source = SOURCE) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const open = source.indexOf('AS $$', start);
  assert.ok(open > start, `${name} has a body`);
  const close = source.indexOf('END$$;', open);
  assert.ok(close > open, `${name} has a body terminator`);
  return source.slice(open + 'AS $$'.length, close + 'END'.length);
};
/** The comment-stripped form the terminal self-assertions compare positions over. */
const cleanedOf = (prosrc) => prosrc.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * One function's PROLOGUE - its name, parameter list and result shape -
 * normalised so a forward replacement can be compared with the declaration it
 * replaces. This is how "the signature did not change" is proven: by equality
 * with the frozen predecessor's own text.
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

const RELATION = 'matching_proposal_decision_view_bindings';
const DELIVERIES = ['offer_matching_proposal_to_first_core_v1', 'forward_matching_proposal_to_second_core_v1'];
const DECISIONS = [
  'decline_matching_proposal_as_first_core_v1',
  'decline_matching_proposal_as_second_core_v1',
  'withdraw_matching_proposal_core_v1',
];
const REPLACED = [...DELIVERIES, ...DECISIONS];
/** Every clock PostgreSQL settles at the START of a transaction, in any spelling. */
const TRANSACTION_CLOCK = /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu;

// Every Connected Worlds migration from the I-02A foundation to the
// QAN-CW-REM-01 tip, pinned by git blob id at the QAN-CW-REM-02 canonical
// baseline `d367101986cc5f9d66a142fc3738c62ae63de459`. "Forward-only" is the
// load-bearing claim of this task, and a claim nobody checks is a claim nobody
// notices losing.
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
  '0119_shared_historical_authority_remediation_v1.sql': '77f01566a8e1070fd038cefc52e70d3fe5ef7bba',
};

test('migration 0120 is one forward-only transaction at the tip of the chain', () => {
  const migrations = readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((name) => name.startsWith('0120_')).length, 1, 'exactly one migration carries 0120');
  assert.equal(migrations.at(-1), NAME, 'and it is the current tip of the chain');
  assert.equal(migrations.indexOf(NAME),
    migrations.indexOf('0119_shared_historical_authority_remediation_v1.sql') + 1,
    'ordering directly after the reviewed QAN-CW-REM-01 tip');
  assert.match(SOURCE, /^-- QAN-CW-REM-02/u, 'the migration declares its task');
  assert.equal((SOURCE.match(/\nBEGIN;\n/gu) ?? []).length, 1, 'it is one transaction');
  assert.match(SOURCE, /COMMIT;\n$/u, 'and it commits');

  const executable = body();
  // A CORRECTION THAT DROPPED, REWROTE OR RENAMED SCHEMA WOULD NOT BE A
  // CORRECTION. Every change is a forward function replacement, one additive
  // relation and one additive candidate key over an existing primary key.
  assert.doesNotMatch(executable, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|COLUMN|CONSTRAINT|SCHEMA|ROLE)/iu,
    'it drops no object');
  assert.doesNotMatch(executable, /ADD COLUMN|DROP COLUMN|ALTER COLUMN|RENAME/iu,
    'it adds, drops, alters or renames no column');
  assert.doesNotMatch(executable, /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
    'it introduces no policy, view, extension or enum type');
  assert.doesNotMatch(executable, /TRUNCATE|DELETE FROM|UPDATE public\./iu,
    'it destroys and rewrites nothing: no pre-0120 transition, reason or lifecycle is touched');
  // The ONLY predecessor relation it alters is the one whose candidate key the
  // new binding needs, and the only thing it does to it is ADD that key.
  const altered = [...executable.matchAll(/ALTER TABLE public\.(\w+)\s+ADD CONSTRAINT (\w+)\s+([\s\S]*?);/gu)];
  assert.deepEqual(altered.map((m) => [m[1], m[2], m[3].trim()]),
    [['matching_recipient_proposal_views', 'matching_recipient_proposal_views_role_identity_key',
      'UNIQUE (id, recipient_role)']],
    'exactly one additive candidate key is added, to exactly one predecessor relation');
  assert.equal((executable.match(/ALTER TABLE public\./gu) ?? []).length,
    // the additive key, plus the new relation's own owner and RLS statements
    1 + 2, 'and no other ALTER TABLE touches anything');
  assert.doesNotMatch(executable, /ALTER TABLE public\.(?!matching_)/u, 'no non-Matching relation is touched at all');
});

test('migrations 0075 - 0119 are byte-identical: the chain is forward-only', () => {
  const pinned = Object.keys(FROZEN_MIGRATIONS);
  assert.equal(pinned.length, 45, 'every Connected Worlds migration from 0075 to 0119 is pinned');
  for (const [file, blob] of Object.entries(FROZEN_MIGRATIONS)) {
    assert.equal(blobIdOf(read(`../migrations/${file}`)), blob,
      `${file} is byte-identical to the QAN-CW-REM-02 canonical baseline`);
  }
  // And the pinned set really is the contiguous range it claims to be, so a
  // migration cannot escape the pin by being left out of the map.
  const numbers = pinned.map((file) => Number(file.slice(0, 4))).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 45 }, (_, i) => 75 + i),
    'the pin covers 0075 through 0119 with no gap');
});

test('the five replaced boundaries keep their exact 0112 signatures', () => {
  // A forward replacement that quietly changed a parameter, a result column or a
  // posture clause would be a NEW boundary wearing an old name, and every caller
  // and every frozen contract would still be pointed at the old one.
  for (const name of REPLACED) {
    assert.equal(prologueOf(SOURCE, name), prologueOf(SOURCE_0112, name),
      `${name}: the parameters, the result columns and the posture are byte-identical to 0112`);
    assert.ok(SOURCE.includes(`CREATE OR REPLACE FUNCTION public.${name}(`),
      `${name} is replaced forward-only rather than dropped and recreated`);
  }
  assert.equal((SOURCE.match(/CREATE OR REPLACE FUNCTION/gu) ?? []).length, REPLACED.length,
    'and exactly the five boundaries the two findings name are replaced');
  assert.equal((body().match(/CREATE FUNCTION/gu) ?? []).length, 0,
    'the migration creates no new function at all: the correction is in the five that already exist');
});

test('ASSURE-F01: each delivery decides its deadline on a wall clock read after the lock wait', () => {
  for (const name of DELIVERIES) {
    const prosrc = prosrcOf(name);
    // OVER THE WHOLE SOURCE INCLUDING COMMENTS, because that is what
    // `pg_proc.prosrc` holds and what the terminal self-assertion reads. A body
    // whose prose spelled `CURRENT_TIMESTAMP` in order to explain the defect
    // would make the migration refuse to deploy - which is exactly the
    // self-matching trap this class of assertion keeps falling into.
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK,
      `${name}: a delivery path may not even NAME a transaction-fixed clock, because every one of them is settled before the canonical pair lock wait`);
    assert.equal(prosrc.split('clock_timestamp()').length - 1, 1,
      `${name}: the real delivery instant is captured exactly once`);
    assert.ok(prosrc.includes('delivery_at := clock_timestamp();'),
      `${name}: into one named instant`);
    assert.ok(prosrc.includes('IF proposal.expires_at <= delivery_at THEN'),
      `${name}: and the deadline is decided against exactly that instant`);
    assert.ok(prosrc.includes('MATCHING_PROPOSAL_EXPIRED'),
      `${name}: with the exact existing refusal, unchanged`);

    // THE PLACEMENT IS THE PROPERTY: after the lock, after the historical retry
    // path, after revalidation, after the CW2-08 gate, and immediately before
    // the first irreversible delivery write.
    const cleaned = cleanedOf(prosrc);
    const at = (needle) => {
      const position = cleaned.indexOf(needle);
      assert.ok(position >= 0, `${name} carries ${needle}`);
      return position;
    };
    const order = [
      'lock_matching_pair_humans_v1',
      'FROM public.matching_proposal_transitions t',
      'resolve_matching_proposal_validity_v1',
      "gate.clearance <> 'CLEARED'",
      'delivery_at := clock_timestamp()',
      'proposal.expires_at <= delivery_at',
      'materialize_matching_recipient_view_core_v1',
      'append_matching_proposal_transition_v1',
    ].map(at);
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i] > order[i - 1], `${name}: delivery step ${i} follows step ${i - 1}`);
    }
    // AND THE HISTORICAL RETRY STILL COMES FIRST. Moving the expiry decision in
    // front of the idempotency path would make a committed delivery answer its
    // own retry differently once the deadline passed.
    assert.ok(cleaned.indexOf('MATCHING_COMMAND_ID_CONFLICT') < cleaned.indexOf('proposal.expires_at'),
      `${name}: the equivalent-retry answer is never re-decided against today's deadline`);
  }
});

test('the temporal sweep is a CLASS correction, not a global clock replacement', () => {
  // The other three transaction clocks in the proposal choreography were
  // classified and deliberately left alone: in each, a stale clock can only
  // refuse, delay or SHORTEN - never widen authority or exposure. Replacing
  // preparation's would have LENGTHENED every proposal by minting its deadline
  // from a later instant, which is the wrong direction entirely.
  for (const name of ['prepare_matching_proposal_core_v1', 'expire_matching_proposal_core_v1',
    'revalidate_matching_proposal_core_v1', 'approve_matching_proposal_forward_core_v1']) {
    assert.ok(!SOURCE.includes(`FUNCTION public.${name}(`),
      `${name} is out of scope and migration 0120 does not touch it`);
  }
  // NON-VACUITY: the two it left in place really do still carry the clock this
  // sweep classified as safe, in the frozen predecessor it left untouched.
  assert.match(prosrcOf('prepare_matching_proposal_core_v1', SOURCE_0112),
    /deadline := CURRENT_TIMESTAMP \+ make_interval\(hours => expiry_hours\)/u,
    'preparation still mints its deadline from the one coherent transaction instant');
  assert.match(prosrcOf('prepare_matching_proposal_core_v1', SOURCE_0112),
    /p\.prepared_at > CURRENT_TIMESTAMP - make_interval\(days => cadence_window\)/u,
    'and still derives the cadence window from it, where an older clock only ever refuses MORE');
  assert.match(prosrcOf('expire_matching_proposal_core_v1', SOURCE_0112),
    /IF proposal\.expires_at > CURRENT_TIMESTAMP THEN/u,
    'and the protective expiry terminal still refuses on it, where an older clock only ever declines to fire');
  // The terminal self-assertion says so out loud, so a later sweep cannot
  // "tidy" them away without the migration refusing to deploy.
  const terminal = SOURCE.slice(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS'));
  assert.match(terminal, /keeps its classified-safe transaction clock/u,
    'and the migration refuses to deploy if either of them was rewritten here');
  assert.match(terminal, /was classified SAFE and is out of scope; it may not have gained a wall clock/u,
    'or if either of them gained a wall clock it was never meant to have');
});

test('ASSURE-F08: the binding relation makes a wrong binding unrepresentable', () => {
  const ddl = sliceOf(SOURCE, `CREATE TABLE public.${RELATION} (`, `CREATE INDEX ${RELATION}_decider_idx`);

  // ONE ROW PER TERMINAL DECISION, and all three ARE terminal.
  assert.match(ddl, /decision_transition_id uuid PRIMARY KEY/u, 'the transition id IS the decision command id');
  assert.match(ddl, /CONSTRAINT matching_proposal_decision_view_bindings_proposal_key UNIQUE \(proposal_id\)/u,
    'and a proposal carries at most one, because all three decisions are terminal');
  assert.match(ddl, /UNIQUE \(decision_transition_id, proposal_id, decided_view_id\)/u,
    'the composite identity a retry compares is a candidate key');

  // THE STRUCTURAL CHAIN. Each link is a real foreign key or CHECK, not a
  // remembered rule, so a binding to another proposal's view, another human's
  // view or a role the decision does not permit cannot be written at all.
  assert.match(ddl, /CHECK \(decision_state IN \('FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN'\)\)/u,
    'exactly the three affected decision classes are representable');
  assert.match(ddl, /CHECK \(decider_role = CASE decision_state\s+WHEN 'SECOND_DECLINED' THEN 'CANDIDATE'\s+ELSE 'FIRST_RECIPIENT' END\)/u,
    'which role may have decided is fixed by the decision itself');
  assert.match(ddl, /FOREIGN KEY \(decision_transition_id, proposal_id, decision_state\)\s+REFERENCES public\.matching_proposal_transitions \(id, proposal_id, resulting_state\)/u,
    'the bound transition is THIS proposal transition into exactly THAT decision');
  assert.match(ddl, /FOREIGN KEY \(decided_view_id, proposal_id, decider_user_id\)\s+REFERENCES public\.matching_recipient_proposal_views \(id, proposal_id, recipient_user_id\)/u,
    'the decided view is a view of THIS proposal held by THAT human');
  assert.match(ddl, /FOREIGN KEY \(decided_view_id, decider_role\)\s+REFERENCES public\.matching_recipient_proposal_views \(id, recipient_role\)/u,
    'and it is a view of exactly the role the decision fixes');
  // Which the frozen 0110 audience CHECK then pins to exactly one of the
  // proposal's two members - so role, human and view cannot disagree.
  assert.match(read('../migrations/0110_matching_pair_eligibility_proposal_persistence_v1.sql'),
    /CONSTRAINT matching_recipient_proposal_views_audience_check/u,
    'the 0110 audience CHECK that closes the chain is still there');

  // NOTHING IS OPTIONAL, NOTHING CASCADES, AND NOTHING IS UNTYPED.
  assert.equal((ddl.match(/FOREIGN KEY/gu) ?? []).length, 3, 'the binding carries exactly three foreign keys');
  assert.equal((ddl.match(/ON DELETE RESTRICT/gu) ?? []).length, 3, 'and every one of them is ON DELETE RESTRICT');
  assert.doesNotMatch(ddl, /\b(jsonb?|bytea)\b|\w+\s+(?:uuid|text|integer)\[\]/iu,
    'no untyped payload column and no array column exists');
  const columns = [...ddl.matchAll(/^ {4}(\w+) (uuid|text|timestamptz)\b/gmu)].map((m) => m[1]);
  assert.deepEqual(columns,
    ['decision_transition_id', 'proposal_id', 'decision_state', 'decider_role', 'decider_user_id',
      'decided_view_id', 'bound_at'],
    'and the relation carries exactly the evidence it exists for, in order');
  for (const column of columns) {
    assert.doesNotMatch(column, /score|rank|weight|priorit|percent|rating|reason|private|world|replay|public_/u,
      `${column} would duplicate Product truth or leak private state into authority evidence`);
  }

  // APPEND-ONLY, SEALED, AND THROUGH THE GUARD 0110 ALREADY INSTALLED for
  // exactly this: a decision's authorizing view is history the moment it is
  // written, and no new trigger function is invented to say so.
  const executable = body();
  assert.match(executable,
    new RegExp(`CREATE TRIGGER ${RELATION}_immutable\\s+BEFORE UPDATE OR DELETE ON public\\.${RELATION}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.reject_matching_proposal_mutation_v1\\(\\);`, 'u'),
    'the binding is append-only through the frozen 0110 mutation guard');
  assert.doesNotMatch(executable, /CREATE FUNCTION public\.\w+\(\)\nRETURNS trigger/u,
    'and no new trigger function is created');
  assert.ok(executable.includes(`ALTER TABLE public.${RELATION} ENABLE ROW LEVEL SECURITY;`),
    'row level security is on');
  assert.ok(executable.includes(`REVOKE ALL ON TABLE public.${RELATION} FROM PUBLIC, anon, authenticated;`),
    'and PUBLIC, anon and authenticated hold nothing');
  assert.ok(executable.includes(`EXECUTE 'REVOKE ALL ON TABLE public.${RELATION} FROM service_role'`),
    'service_role included: a system credential never manufactures human consent');
});

test('ASSURE-F08: each corrected decision binds its exact view and proves it on retry', () => {
  for (const name of DECISIONS) {
    const prosrc = prosrcOf(name);
    const cleaned = cleanedOf(prosrc);
    const at = (needle) => {
      const position = cleaned.indexOf(needle);
      assert.ok(position >= 0, `${name} carries ${needle}`);
      return position;
    };
    // I07B-CONC-01 IS NON-REGRESSED: the serialization region is entered before
    // any currentness is read, and the pair lock is reached only through it.
    const order = [
      'enter_matching_proposal_decision_v1',
      `FROM public.${RELATION} b`,
      "'MATCHING_DECISION_CONTRADICTORY_STATE'",
      'bound.decided_view_id IS DISTINCT FROM p_expected_view_id',
      "'CLOSED_BY_YOU'::text; RETURN;",
      'assert_matching_recipient_view_current_v1',
      'append_matching_proposal_transition_v1',
      `INSERT INTO public.${RELATION}`,
    ].map(at);
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i] > order[i - 1], `${name}: decision step ${i} follows step ${i - 1}`);
    }
    assert.doesNotMatch(cleaned, /lock_matching_pair_humans_v1|INSERT INTO public\.matching_setup_locks/u,
      `${name} reaches the setup locks only through the one entry point`);
    assert.match(prosrc, /auth\.uid\(\)/u, `${name} derives its human from auth.uid()`);
    // A RETRY IS ANSWERED FROM DURABLE ROWS AND NOTHING ELSE. It must not
    // re-read launch clearance, the current view, the current proposal state,
    // the current deadline or the Matching setup - a retry that consulted any of
    // them could answer differently from the call it repeats.
    const retry = cleaned.slice(order[1], order[4]);
    assert.doesNotMatch(retry,
      /current_view_id|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state/u,
      `${name}: the retry path reads no current truth at all`);
    assert.doesNotMatch(retry, /INSERT INTO|UPDATE |DELETE /u,
      `${name}: and nothing is inferred, reconstructed or backfilled on it`);
    // A MISSING BINDING IS REFUSED BEFORE ANY VIEW IS COMPARED, so no historical
    // view is ever inferred from the one the caller happens to name.
    assert.ok(order[2] < order[3], `${name}: a committed decision with no binding fails closed first`);
    assert.match(prosrc, /MATCHING_COMMAND_ID_CONFLICT/u,
      `${name}: and a retry naming another view is a different request under a reused id`);
    // The binding is written in the SAME transaction as the transition, after
    // it, so no successful decision can exist without its authorizing view.
    assert.ok(order[7] - order[6] < 400,
      `${name}: the binding is written immediately after the transition, in one transaction`);
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK, `${name} reads no transaction clock`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u, `${name} reads no wall clock either`);
  }
  // WITHDRAWAL ALONE ALSO BINDS ITS PRIOR STATE, because WITHDRAWN is legal from
  // three of them and the prior state is therefore part of its command identity.
  const withdrawal = prosrcOf('withdraw_matching_proposal_core_v1');
  assert.match(withdrawal, /committed\.prior_state IS DISTINCT FROM p_expected_state\s*\n\s*OR bound\.decided_view_id IS DISTINCT FROM p_expected_view_id/u,
    'a withdrawal retry proves BOTH the exact prior state and the exact view, as one bounded conflict');
  assert.match(withdrawal, /p_expected_state NOT IN \('OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND'\)/u,
    'and the three legal prior states are exactly the ones 0112 froze');
  // THE OTHER TWO HAVE NOTHING TO COMPARE: the 0110 legal-transition CHECK
  // leaves FIRST_DECLINED and SECOND_DECLINED exactly one lawful prior state
  // each, so it is derived from immutable committed truth rather than missing.
  const legal = SOURCE_0112.length > 0 && read('../migrations/0110_matching_pair_eligibility_proposal_persistence_v1.sql');
  assert.equal((legal.match(/\('OFFERED_TO_FIRST', 'FIRST_DECLINED'\)/gu) ?? []).length, 1,
    'FIRST_DECLINED is reachable from exactly one prior state');
  assert.equal((legal.match(/\('FORWARDED_TO_SECOND', 'SECOND_DECLINED'\)/gu) ?? []).length, 1,
    'and SECOND_DECLINED from exactly one');
});

test('the I-07C first-acceptance binding is neither replaced nor weakened', () => {
  // `matching_forward_approval_view_bindings` remains authoritative for
  // FIRST_FORWARD_APPROVED and is consumed by the Mutual Match. The new relation
  // is a SECOND, separate binding for the three terminal decisions.
  assert.doesNotMatch(body(), /matching_forward_approval_view_bindings/u,
    'migration 0120 does not touch the I-07C binding relation at all');
  assert.ok(!SOURCE.includes('FUNCTION public.approve_matching_proposal_forward_core_v1('),
    'and does not replace the boundary that writes it');
  assert.match(SOURCE_0113, /CREATE TABLE public\.matching_forward_approval_view_bindings/u,
    'the 0113 relation is still declared exactly where it was');
  // The terminal self-assertion holds both halves live, so a later slice cannot
  // quietly unify them without the migration refusing to deploy.
  const terminal = SOURCE.slice(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS'));
  assert.match(terminal, /exactly the forward approval still writes a first-acceptance view binding/u,
    'the migration asserts the I-07C producer law live');
  assert.match(terminal, /the forward approval keeps its own 0114 binding relation and gains nothing from this correction/u,
    'and that the approval gained nothing from this correction');
  assert.match(terminal, /exactly one function writes a proposal transition/u,
    'and that exactly one function still writes a proposal transition');
});

test('no application role gains anything, and no actor parameter appears anywhere', () => {
  const executable = body();
  assert.deepEqual([...executable.matchAll(/GRANT\s+\w+/giu)].map((m) => m[0]), [],
    'the migration grants nothing to anybody');
  assert.doesNotMatch(executable, /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL|EXECUTE)/iu,
    'not a table privilege and not an EXECUTE');
  // NON-VACUITY: it really does revoke, so "no grants" is a statement about a
  // file that revokes rather than about a file that is empty.
  assert.ok((executable.match(/REVOKE ALL ON FUNCTION/gu) ?? []).length >= 1,
    'and it revokes function execution explicitly');
  assert.ok(executable.includes('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated'),
    'from PUBLIC, anon and authenticated');
  assert.ok(executable.includes("EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary)"),
    'and from service_role, because CREATE OR REPLACE preserves an ACL rather than resetting it');
  // The three decisions still derive their human and take no identity input.
  for (const name of DECISIONS) {
    const prologue = prologueOf(SOURCE, name);
    assert.doesNotMatch(prologue.slice(0, prologue.indexOf(') RETURNS')),
      /p_\w*(?:user|human|actor|grantor|owner|subject|on_behalf|candidate)\w*/u,
      `${name} accepts no identity parameter`);
    assert.doesNotMatch(prologue.slice(0, prologue.indexOf(') RETURNS')),
      /p_\w*(?:timestamp|_at|occurred|clock|now|deadline|expir)\w*/u,
      `${name} accepts no caller-supplied instant`);
  }
  for (const name of DELIVERIES) {
    const prologue = prologueOf(SOURCE, name);
    assert.doesNotMatch(prologue.slice(0, prologue.indexOf(') RETURNS')),
      /p_\w*(?:timestamp|_at|occurred|clock|deadline|expir)\w*/u,
      `${name} accepts no caller-supplied instant: the database clock decides`);
  }
});

test('the migration self-assertions accept the migration itself', () => {
  // THE DEFECT CLASS THIS EXISTS FOR. A terminal self-assertion is executed by
  // PostgreSQL at deploy time, so one that is wrong costs a whole CI round and
  // verifies nothing - the chain never even applies. Every text assertion the
  // terminal block makes is therefore simulated HERE, against the exact `prosrc`
  // the database will hold, and the run costs milliseconds.
  //
  // The sharpest case is the clock ban: it runs over `prosrc`, which INCLUDES
  // the body's own comments, so a body that explained the defect by naming
  // `CURRENT_TIMESTAMP` would make the migration refuse to deploy itself.
  for (const name of DELIVERIES) {
    const prosrc = prosrcOf(name);
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK, `${name}: the migration's own clock ban accepts its own body`);
    assert.equal(prosrc.split('clock_timestamp()').length - 1, 1, `${name}: exactly one capture, as the assertion requires`);
    assert.doesNotMatch(prosrc, /DELETE FROM|TRUNCATE|pg_advisory|LOCK TABLE/iu, `${name}: the mutation bans accept it`);
    assert.doesNotMatch(prosrc, /INSERT INTO public\.matching_proposal_transitions/u,
      `${name}: the one-writer ban accepts it`);
    const cleaned = cleanedOf(prosrc);
    for (const needle of ['lock_matching_pair_humans_v1', 'FROM public.matching_proposal_transitions t',
      'resolve_matching_proposal_validity_v1', "gate.clearance <> 'CLEARED'",
      'delivery_at := clock_timestamp()', 'proposal.expires_at <= delivery_at',
      'materialize_matching_recipient_view_core_v1', 'append_matching_proposal_transition_v1']) {
      assert.ok(cleaned.includes(needle), `${name}: the ordering assertion can find ${needle}`);
    }
  }
  for (const name of DECISIONS) {
    const prosrc = prosrcOf(name);
    const cleaned = cleanedOf(prosrc);
    assert.doesNotMatch(prosrc, /current_timestamp|clock_timestamp|now\(\)|transaction_timestamp|statement_timestamp/iu,
      `${name}: the migration's own clock ban accepts its own body`);
    for (const needle of ['enter_matching_proposal_decision_v1', 'assert_matching_recipient_view_current_v1',
      `FROM public.${RELATION} b`, "'MATCHING_DECISION_CONTRADICTORY_STATE'",
      'bound.decided_view_id IS DISTINCT FROM p_expected_view_id', "'CLOSED_BY_YOU'::text; RETURN;",
      'append_matching_proposal_transition_v1', `INSERT INTO public.${RELATION}`]) {
      assert.ok(cleaned.includes(needle), `${name}: the ordering assertion can find ${needle}`);
    }
    // The historical answer really is distinguishable from the final one, or the
    // position comparison would find the wrong occurrence.
    assert.equal(cleaned.split("'CLOSED_BY_YOU'::text; RETURN;").length - 1, 1,
      `${name}: exactly one historical return carries the RETURN terminator`);
  }
  // The producer census the terminal block asserts is an EQUALITY against three
  // exact names, in the order `ORDER BY pr.proname` produces.
  const producers = [...SOURCE.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1])
    .filter((name) => prosrcOf(name).includes(`INSERT INTO public.${RELATION}`)).sort();
  assert.deepEqual(producers, DECISIONS, 'the three producers the census names are exactly the three that write the binding');
  const terminal = SOURCE.slice(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS'));
  for (const name of DECISIONS) {
    assert.ok(terminal.includes(name), `the census literal names ${name}`);
  }
  // And the input-parameter equality it asserts really is the 0112 list, in the
  // SAME ORDER as the array of boundaries it is indexed against - a reordering
  // of either array alone would make the migration refuse to deploy itself.
  const declaredInputs = REPLACED.map((name) => {
    const prologue = prologueOf(SOURCE, name);
    return prologue.slice(prologue.indexOf('(') + 1, prologue.indexOf(') RETURNS'))
      .split(',').map((part) => part.trim().split(/\s+/u)[0]).filter(Boolean)
      .join(', ');
  });
  const expectedBlock = SOURCE.match(/expected_inputs text\[\] := ARRAY\[([\s\S]*?)\];/u);
  assert.ok(expectedBlock, 'the terminal block declares its expected input lists');
  assert.deepEqual([...expectedBlock[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]), declaredInputs,
    'the expected input lists are exactly what the five declarations carry, in the same order');
  const replacedBlock = SOURCE.match(/replaced text\[\] := ARRAY\[([\s\S]*?)\];/u);
  assert.ok(replacedBlock, 'the terminal block declares the boundaries it replaces');
  assert.deepEqual([...replacedBlock[1].matchAll(/public\.(\w+)\(/gu)].map((m) => m[1]), REPLACED,
    'and the boundary array it indexes them against is in that same order');
});

test('no self-assertion concatenates a regex operand without parentheses', () => {
  // `~` and `||` share a precedence class in PostgreSQL, so
  //     body ~ 'a' || 'b'
  // parses as `(body ~ 'a') || 'b'` and fails at DEPLOY time with "invalid input
  // syntax for type boolean". It is invisible in review and costs a whole CI
  // round, so it is banned structurally rather than remembered.
  const lines = SOURCE.split('\n');
  let inspected = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!/[!]?~\*?\s*'/u.test(lines[i])) continue;
    inspected += 1;
    const continues = /^\s*\|\|/u.test(lines[i + 1] ?? '');
    if (!continues) continue;
    assert.match(lines[i], /[!]?~\*?\s*\(/u,
      `line ${i + 1} concatenates a regex operand and must parenthesise it: ${lines[i].trim()}`);
  }
  assert.ok(inspected >= 8, `the detector inspected ${inspected} regex operand(s), so it is exercised rather than vacuous`);
  // The same trap through a plain comparison: `IS DISTINCT FROM` binds LOOSER
  // than `||`, so the census equality is parenthesised anyway rather than relying
  // on a precedence table nobody re-reads.
  assert.match(SOURCE, /IS DISTINCT FROM \('decline_matching_proposal_as_first_core_v1, '/u,
    'the multi-line producer-census equality parenthesises its concatenated operand');
});

test('the migration refuses to deploy if its own architecture is absent', () => {
  const terminal = SOURCE.slice(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS'));
  for (const claim of [
    'must be postgres-owned',
    'must be SECURITY DEFINER',
    'must pin an empty search_path',
    'PUBLIC must not execute',
    'must keep its exact 0112 input parameters',
    'may read no transaction-fixed clock',
    'must capture the real delivery instant exactly once',
    'must keep the exact existing expiry refusal',
    'must enter the canonical two-human serialization region BEFORE it checks the exact recipient view',
    'must read its durable exact-view binding',
    'may read no current view, clearance, validity, deadline or proposal state',
    'a withdrawal retry must still prove the exact prior state its command named',
    'withdrawal ends exposure rather than creating it',
    'must require exactly CLEARED from the CW2-08 prerequisite seam',
    'exactly the three corrected decisions write a decision view binding',
    'the I-07C Mutual Match must still decide its deadline against its one captured birth instant',
    'must exist with row level security enabled',
    'carries no policy',
    'must hold no privilege on the decision view binding relation',
    'append-only history the moment it is written',
    'every decision binding foreign key is ON DELETE RESTRICT',
    'the additive recipient-view role identity key must exist over the primary key',
    'a recipient projection may not read the decision view binding',
    'must be exactly as 0109 and 0112 left them',
  ]) {
    assert.ok(terminal.includes(claim), `the terminal self-assertion refuses to deploy without: ${claim}`);
  }
  // It is ONE block, at the end, inside the same transaction, so a failure rolls
  // the whole correction back rather than leaving half of it installed.
  assert.equal((terminal.match(/DO \$\$/gu) ?? []).length, 1, 'the terminal self-assertions are one block');
  assert.ok(SOURCE.indexOf('TERMINAL SELF-ASSERTIONS') < SOURCE.indexOf('\nCOMMIT;'),
    'and they run before the transaction commits');
});

test('the 0120 verifier proves live semantics and is wired into the toolchain, CI and the database README', () => {
  // THE PROOF MATRIX THE TASK REQUIRED, each case named in the verifier so a
  // silently-removed scenario is visible in this contract rather than only in a
  // green CI log.
  for (const label of [
    'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08',
    'T01', 'T02', 'T02P', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08',
    'V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08',
    'N01', 'N02', 'N03', 'N04', 'N05',
  ]) {
    assert.ok(VERIFIER.includes(label), `the verifier carries case ${label}`);
  }
  // IT DRIVES THE REAL BOUNDARIES rather than writing the rows it then reads.
  for (const boundary of ['offer_matching_proposal_to_first_core_v1', 'forward_matching_proposal_to_second_core_v1',
    'commit_matching_mutual_match_v1', 'materialize_matching_recipient_view_core_v1',
    'lock_matching_pair_humans_v1']) {
    assert.ok(VERIFIER.includes(boundary), `it exercises the real ${boundary}`);
  }
  // BOTH CROSS-DEADLINE RACES ARE BARRIER-PINNED on observable PostgreSQL lock
  // evidence and on the real database clock - never on a sleep.
  assert.match(VERIFIER, /waitForLockWait/u, 'the cross-deadline races are pinned on an observable lock-wait barrier');
  assert.match(VERIFIER, /pg_stat_activity/u, 'read from PostgreSQL activity rather than guessed');
  assert.match(VERIFIER, /waitForInstant/u, 'and the deadline crossing is read from the database clock');
  assert.match(VERIFIER, /xact_start/u,
    "and each waiter's own transaction clock is proven to PRECEDE the deadline it is refused against");
  // THE PRE-FIX HALF EXISTS, is proven to have changed the definition, and is
  // restored byte for byte.
  assert.match(VERIFIER, /assert\.notEqual\(weakened, pristine\.definition/u,
    'the pre-fix weakening is proven to have changed the text rather than matching nothing');
  assert.match(VERIFIER, /restoreMatchingSeam\(pristine\)/u, 'and the canonical definition is restored on every path');
  assert.match(VERIFIER, /the corrected delivery clock is installed again after the pre-fix probe/u,
    'which the teardown re-reads rather than trusting');

  // WIRED, so it actually runs.
  assert.match(packageJson,
    /"verify:matching-proposal-temporal-exact-view-remediation:integration": "node --env-file-if-exists=\.env database\/verify-migration-0120\.mjs"/u,
    'the verifier has a toolchain entry');
  assert.ok(workflow.includes('npm run verify:matching-proposal-temporal-exact-view-remediation:integration'),
    'and API CI runs it');
  assert.ok(workflow.indexOf('npm run verify:matching-proposal-temporal-exact-view-remediation:integration')
    > workflow.indexOf('npm run verify:shared-historical-authority-remediation:integration'),
  'after the 0119 verifier, in migration order');
  assert.ok(readme.includes(NAME), 'and the database README documents the migration');
  assert.ok(readme.includes('verify-migration-0120.mjs'), 'and its verifier');
});

test('the shared verifier support is reconciled narrowly rather than dodged', () => {
  // A CENSUS COMPARES THE LIVE CATALOG, which is what lets it catch a lifecycle
  // relation nobody declared - and this remediation legitimately adds one that
  // carries the census word `proposal`. The intended answer is to NAME it, under
  // its own reviewed slice, exactly as I-07C and I-07D named theirs. Renaming out
  // of the pattern is the dodge a census exists to prevent.
  assert.match(SETUP_SUPPORT, /export const REM02_LIFECYCLE_RELATIONS = \[\n\s+'matching_proposal_decision_view_bindings',\n\];/u,
    'the remediation owns exactly the one relation it adds, under its own name');
  const union = SETUP_SUPPORT.match(/export const LATER_SLICE_LIFECYCLE_RELATIONS = \[([\s\S]*?)\]\.sort\(\);/u);
  assert.ok(union, 'the setup support builds the shared census list as one sorted union');
  const members = union[1].split(',').map((part) => part.trim()).filter(Boolean);
  assert.deepEqual(members.filter((name) => !/^\.\.\.\w+_LIFECYCLE_RELATIONS$/u.test(name)), [],
    'and the shared census list is still exactly the union of named per-slice arrays and nothing else');
  assert.ok(members.includes('...REM02_LIFECYCLE_RELATIONS'),
    'with this remediation as one of them rather than folded into a predecessor slice');
  // The 0110 census is an EQUALITY against that union, so naming it there is
  // what keeps the 0108, 0109 and 0110 censuses true rather than merely quiet.
  for (const n of ['0108', '0109', '0110']) {
    assert.match(read(`../verify-migration-${n}.mjs`), /LATER_SLICE_LIFECYCLE_RELATIONS/u,
      `the ${n} census still asserts an equality against the named list`);
  }
  // THE TEARDOWN PEELS THE BINDING BEFORE THE ROWS IT BINDS. A committed decline
  // or withdrawal now binds a transition, a view and a proposal restrictively, so
  // a race fixture that removed its proposals first would be refused row by row -
  // in EVERY verifier that commits a decision, not only this one.
  assert.match(PROPOSAL_SUPPORT, /export const REM02_IMMUTABLE = \[\n\s+\[P\.DECISION_BINDINGS, 'matching_proposal_decision_view_bindings_immutable'\],\n\];/u,
    'the new relation and its guard are named separately from the 0110 census');
  // NOT folded into the 0110 census lists, which would make the 0110 verifier
  // claim 0110 created a relation this remediation added. The array literals
  // themselves are read, rather than an unbounded span that would match the
  // separate REM02 declaration further down the file.
  const literalOf = (name) => {
    const start = PROPOSAL_SUPPORT.indexOf(`export const ${name} = [`);
    assert.ok(start >= 0, `the support module declares ${name}`);
    return PROPOSAL_SUPPORT.slice(start, PROPOSAL_SUPPORT.indexOf('];', start));
  };
  for (const list of ['PROPOSAL_TABLES', 'PROPOSAL_IMMUTABLE', 'PROPOSAL_GUARDED']) {
    assert.doesNotMatch(literalOf(list), /DECISION_BINDINGS/u,
      `${list} is the 0110 census and must not claim a relation migration 0120 added`);
  }
  const teardown = PROPOSAL_SUPPORT.slice(PROPOSAL_SUPPORT.indexOf('async function removeCommittedProposalState'));
  const peel = teardown.indexOf(`DELETE FROM \${P.DECISION_BINDINGS}`);
  assert.ok(peel >= 0, 'the teardown removes the binding');
  assert.ok(peel < teardown.indexOf(`DELETE FROM \${P.VIEWS}`), 'before the views it binds');
  assert.ok(peel < teardown.indexOf(`DELETE FROM \${P.TRANSITIONS}`), 'before the transitions it binds');
  assert.ok(peel < teardown.indexOf(`DELETE FROM \${P.PROPOSALS}`), 'and before the proposals it binds');
  assert.match(teardown, /\[\.\.\.PROPOSAL_IMMUTABLE, \.\.\.PROPOSAL_GUARDED, \.\.\.REM02_IMMUTABLE\]/u,
    'and its append-only guard is lifted and restored with the rest');
});

test('the QAN-CW-REM-01 contract is reconciled forward rather than left contradicting the chain', () => {
  // Migration 0119 asserted it was the TIP of the chain, which was true when it
  // was written and is not a property any migration keeps. It is reconciled to
  // the thing it actually meant - forward-only ordering - rather than deleted,
  // because the ordering claim is the one worth keeping.
  assert.ok(PREDECESSOR_CONTRACT.includes('QAN-CW-REM-02'),
    'the 0119 contract names the task that moved its expectation');
  assert.doesNotMatch(PREDECESSOR_CONTRACT, /assert\.equal\(migrations\.at\(-1\), NAME/u,
    'the stale tip assertion is gone');
  assert.match(PREDECESSOR_CONTRACT, /migrations\.indexOf\('0118_introduction_ordinary_shared_material_v1\.sql'\) \+ 1/u,
    'and is replaced by the forward-only ordering it was really asserting');
  // NON-VACUITY: everything else 0119 owned is untouched, including its own
  // byte-identity pin and its ASSURE-F04 verdict.
  assert.match(PREDECESSOR_CONTRACT, /migrations 0075 - 0118 are byte-identical/u,
    'the 0119 forward-only pin is unchanged');
  assert.match(PREDECESSOR_CONTRACT, /ASSURE-F04/u, 'and its cross-World lock verdict is unchanged');
});
