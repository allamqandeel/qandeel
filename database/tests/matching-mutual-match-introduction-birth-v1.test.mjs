// I-07C - Atomic Mutual Match, Introduction birth and Match handoff runtime v1:
// secret-free structural contract over migrations 0113 and 0114.
//
// ONE file for two migrations, as the I-07B contract is one file for three:
// the properties worth a static contract are slice-wide - "the migration chain
// is forward-only and every frozen predecessor is byte-identical", "nothing in
// I-07C can spell a second acceptance", "the one Match core enters the
// serialized region before it reads any currentness and requires CLEARED as
// its last gate", "the frozen vocabularies are identical in PostgreSQL and in
// TypeScript" - and splitting them would either repeat each one or leave each
// file checking half a property. Live semantics - refusals, ACL behaviour,
// trigger behaviour, races, the no-ghost rollback - are proven by the two real
// PostgreSQL verifiers this file also pins into the toolchain and CI.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against EXECUTABLE SQL only, and
// never against a terminal self-assertion block, which names the words it
// refuses and would otherwise make every such assertion match itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAMES = {
  '0113': '0113_matching_mutual_match_introduction_persistence_v1.sql',
  '0114': '0114_matching_mutual_match_commit_transaction_v1.sql',
};
const SOURCE = Object.fromEntries(Object.entries(NAMES).map(([n, file]) => [n, read(`../migrations/${file}`)]));
const VERIFIER = Object.fromEntries(Object.keys(NAMES).map((n) => [n, read(`../verify-migration-${n}.mjs`)]));
const PREDECESSOR = Object.fromEntries(['0082', '0108', '0109', '0110', '0112'].map((n) => [n, read(`../verify-migration-${n}.mjs`)]));
const matchSupport = read('../matching-match-verifier-support.mjs');
const proposalSupport = read('../matching-proposal-verifier-support.mjs');
const setupSupport = read('../matching-setup-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const vocabulary = read('../../apps/api/src/connected-worlds/matching/matching-match.types.ts');
const proposalVocabulary = read('../../apps/api/src/connected-worlds/matching/matching-proposal.types.ts');
const setupVocabulary = read('../../apps/api/src/connected-worlds/matching/matching-setup.types.ts');
const source0110 = read('../migrations/0110_matching_pair_eligibility_proposal_persistence_v1.sql');
const source0112 = read('../migrations/0112_matching_proposal_choreography_runtime_v1.sql');
const source0075 = read('../migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const EXECUTABLE = Object.fromEntries(Object.entries(SOURCE).map(([n, sql]) => [n, stripComments(sql)]));
/** One migration's text between two markers, comments and COMMENT literals removed. */
const sliceOf = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `the source contains "${from}"`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `the source contains "${to}" after "${from}"`);
  return stripComments(source.slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
/** The executable statements of one migration, its terminal self-assertions excluded. */
const bodyOf = (n) => sliceOf(SOURCE[n], 'BEGIN;', 'TERMINAL SELF-ASSERTIONS');
/** The literals of one IN-list CHECK constraint. */
const vocabularyOf = (source, constraint) => {
  const match = stripComments(source).match(new RegExp(`CONSTRAINT ${constraint}\\s+CHECK \\([^)]*IN\\s*\\(([^)]+)\\)\\)`, 'u'));
  assert.ok(match, `${constraint} exists as an IN-list CHECK`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The literals of one TypeScript `as const` array. */
const typescriptVocabularyOf = (name, source = vocabulary) => {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, 'u'));
  assert.ok(match, `the vocabulary module exports ${name}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The git blob id of one file's LF content: what `git rev-parse HEAD:<path>` prints. */
const blobIdOf = (content) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');

const CORE = sliceOf(SOURCE['0114'], 'CREATE FUNCTION public.commit_matching_mutual_match_v1(', 'COMMENT ON FUNCTION public.commit_matching_mutual_match_v1');
const APPROVAL = sliceOf(SOURCE['0114'], 'CREATE OR REPLACE FUNCTION public.approve_matching_proposal_forward_core_v1(', 'COMMENT ON FUNCTION public.approve_matching_proposal_forward_core_v1');
const DDL = sliceOf(SOURCE['0113'], 'BEGIN;', '-- 11. IMMUTABILITY AND TRUTH TRIGGERS.');

const TABLES_0113 = [
  'introduction_records', 'matching_active_introduction_claims', 'matching_forward_approval_view_bindings',
  'matching_match_commits', 'matching_match_competing_cancellations', 'matching_match_handoff_fields',
  'matching_match_handoff_package_versions', 'matching_match_handoff_subjects',
  'shared_world_introduction_started_events', 'shared_world_matching_birth_events',
];
const RESULT_COLUMNS = [
  'outcome', 'committed_match_id', 'matched_proposal_id', 'born_world_id', 'born_introduction_record_id',
  'world_lifecycle', 'world_phase', 'world_birth_basis', 'introduction_record_status',
];
const DEFERRED = [
  'introduction_records_match_commit_fk', 'shared_world_matching_birth_events_commit_fk',
  'shared_world_introduction_started_events_commit_fk', 'matching_active_introduction_claims_commit_fk',
  'matching_match_competing_cancellations_commit_fk', 'matching_match_handoff_packages_commit_fk',
];

/**
 * The frozen predecessors this slice reads, reconciles against and may not edit,
 * pinned by git blob id: a byte changed anywhere in one of them fails here before
 * any database is involved. The I-07A and I-07B TypeScript vocabulary modules are
 * frozen records of their own slices and are pinned the same way.
 */
const FROZEN = {
  '../migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql': '3119d34a4edd4c934067393eb278077fd294852b',
  '../migrations/0082_shared_direct_world_birth_transaction_v1.sql': 'c7c575b246f01ce05944c7270428bea89d151a68',
  '../migrations/0108_matching_participation_private_setup_foundation_v1.sql': '88845e0290809d1fd9949db1a5ebf3973bacdbb3',
  '../migrations/0109_matching_setup_human_authority_commands_v1.sql': '030de6db8d7982a4503cc2200927511f1c212e60',
  '../migrations/0110_matching_pair_eligibility_proposal_persistence_v1.sql': '5cf4dab35b921fa1d2f60a2875a5863964ca9139',
  '../migrations/0111_matching_candidate_evaluation_disclosure_gate_v1.sql': '7e2df716f935b1f8be378c0c1fd1d232b6165956',
  '../migrations/0112_matching_proposal_choreography_runtime_v1.sql': 'd806ddf5683048a830638bd264282fee09f39d53',
  '../../apps/api/src/connected-worlds/matching/matching-proposal.types.ts': 'd23da2af56b727f90e5b717f6c2e97b575d7d335',
  '../../apps/api/src/connected-worlds/matching/matching-setup.types.ts': '946731fbd8c869529bc3bcb8c363926e94bed619',
};

test('the two migrations order directly after the reviewed 0112 tip, are forward-only, and edit no frozen predecessor', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.indexOf(NAMES['0113']),
    migrations.indexOf('0112_matching_proposal_choreography_runtime_v1.sql') + 1, '0113 orders directly after the reviewed 0112 tip');
  assert.equal(migrations.indexOf(NAMES['0114']), migrations.indexOf(NAMES['0113']) + 1, '0114 follows 0113');
  assert.equal(migrations.length - 1, migrations.indexOf(NAMES['0114']), '0114 is the migration tip');
  for (const [n, file] of Object.entries(NAMES)) {
    assert.equal(migrations.filter((name) => name.startsWith(`${n}_`)).length, 1, `exactly one migration carries ${n}`);
    assert.match(SOURCE[n], /^-- I-07C/u, `${file} declares its slice`);
    assert.equal((SOURCE[n].match(/\nBEGIN;\n/gu) ?? []).length, 1, `${file} is one transaction`);
    assert.match(SOURCE[n], /COMMIT;\n$/u, `${file} commits`);
    assert.doesNotMatch(EXECUTABLE[n], /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|COLUMN|SCHEMA|ROLE)/iu, `${file} drops no object`);
    assert.doesNotMatch(EXECUTABLE[n], /ADD COLUMN|DROP COLUMN|ALTER COLUMN|RENAME/iu, `${file} adds, drops, alters or renames no column`);
    assert.doesNotMatch(EXECUTABLE[n], /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
      `${file} introduces no policy, view, extension or enum type`);
  }
  // THE ONE REVIEWED DROP: the 0110 private-reason CHECK is rebuilt in place with
  // exactly one more code. Nothing else in the slice is dropped, and the rebuild
  // is adjacent to the drop, so the vocabulary is never unguarded between statements.
  assert.equal((EXECUTABLE['0113'].match(/\bDROP\b/gu) ?? []).length, 1, '0113 drops exactly one thing');
  assert.match(EXECUTABLE['0113'],
    /DROP CONSTRAINT matching_proposal_transitions_reason_check;\nALTER TABLE public\.matching_proposal_transitions\n\s+ADD CONSTRAINT matching_proposal_transitions_reason_check\n\s+CHECK \(private_reason_code IS NULL OR private_reason_code IN \(/u,
    'the private-reason CHECK is dropped and rebuilt under the same name in adjacent statements');
  assert.doesNotMatch(EXECUTABLE['0114'], /\bDROP\b|CREATE TABLE|ALTER TABLE/u, '0114 drops nothing, creates no relation and restructures nothing');
  // The additive candidate keys touch exactly the reviewed predecessor relations.
  const altered = [...new Set([...DDL.matchAll(/ALTER TABLE public\.(\w+)/gu)].map((m) => m[1]))].sort();
  assert.deepEqual(altered, ['matching_match_commits', 'matching_proposal_transitions', 'matching_proposals',
    'matching_recipient_proposal_views', 'shared_world_membership_episodes'],
  '0113 alters exactly its own commit relation and the four reviewed predecessor relations, each additively');
  const predecessorStatements = DDL.match(/ALTER TABLE public\.(?:matching_proposal_transitions|matching_proposals|matching_recipient_proposal_views|shared_world_membership_episodes)[\s\S]*?;/gu) ?? [];
  assert.equal(predecessorStatements.length, 6, 'four additive statements, the one drop and the one rebuild touch predecessor relations');
  for (const statement of predecessorStatements) {
    // The reason CHECK drop and rebuild are asserted above; everything else is additive.
    if (statement.includes('matching_proposal_transitions_reason_check')) continue;
    assert.match(statement, /^ALTER TABLE public\.\w+\n(?:\s+ADD CONSTRAINT \w+\n\s+UNIQUE \(id, [\w, ]+\),?\n?)+;$/u,
      `a predecessor relation gains only candidate keys over its own primary key: ${statement.split('\n')[0]}`);
  }
  // THE FROZEN PREDECESSORS ARE BYTE-IDENTICAL.
  for (const [path, blob] of Object.entries(FROZEN)) {
    assert.equal(blobIdOf(read(path)), blob, `${path.split('/').pop()} is exactly the frozen file this slice was reconciled against`);
  }
});

test('every identifier the two migrations create fits the PostgreSQL 63-byte limit and is unique', () => {
  for (const [n, file] of Object.entries(NAMES)) {
    const identifiers = [...bodyOf(n).matchAll(
      /(?:CREATE TABLE public\.|(?<!DROP )CONSTRAINT |CREATE (?:UNIQUE )?INDEX |CREATE TRIGGER |CREATE (?:OR REPLACE )?FUNCTION public\.)(\w+)/gu)]
      .map((m) => m[1]);
    assert.ok(identifiers.length >= (n === '0113' ? 60 : 2), `${file} names its objects explicitly, found ${identifiers.length}`);
    for (const identifier of identifiers) {
      assert.ok(Buffer.byteLength(identifier) <= 63,
        `${identifier} (${Buffer.byteLength(identifier)} bytes) would be silently truncated by PostgreSQL`);
    }
    assert.equal(new Set(identifiers).size, identifiers.length, `every identifier ${file} creates is unique`);
  }
});

test('0113 introduces exactly the ten I-07C relations, only trigger functions, and no callable boundary', () => {
  const tables = [...EXECUTABLE['0113'].matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, TABLES_0113);
  const functions = [...EXECUTABLE['0113'].matchAll(/CREATE FUNCTION public\.(\w+)\(\)\nRETURNS (\w+)/gu)];
  assert.equal(functions.length, 5, '0113 creates exactly five functions');
  for (const [, , returns] of functions) assert.equal(returns, 'trigger', 'and every one of them is a trigger function');
  assert.doesNotMatch(EXECUTABLE['0113'], /SECURITY DEFINER/u, '0113 creates no callable boundary at all');
  assert.doesNotMatch(EXECUTABLE['0113'], /\bGRANT\b/u, 'and no GRANT of any kind');
  // The shared census list names exactly these ten, so no I-07C relation can
  // escape the predecessor censuses by being unnamed.
  const start = setupSupport.indexOf('export const I07C_LIFECYCLE_RELATIONS = [');
  assert.ok(start >= 0, 'the setup support names the I-07C half of the shared census list');
  const listed = [...setupSupport.slice(start, setupSupport.indexOf('];', start)).matchAll(/^ {2}'([a-z_]+)',$/gmu)].map((m) => m[1]);
  assert.deepEqual(listed.sort(), TABLES_0113, 'the I-07C census half is exactly the ten relations 0113 creates');
  assert.match(setupSupport,
    /export const LATER_SLICE_LIFECYCLE_RELATIONS = \[\.\.\.I07B_LIFECYCLE_RELATIONS, \.\.\.I07C_LIFECYCLE_RELATIONS\]\.sort\(\);/u,
    'the shared census list is exactly the union of the reviewed per-slice arrays');
  // 0114 creates exactly one function and revises exactly one.
  assert.deepEqual([...bodyOf('0114').matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]), ['commit_matching_mutual_match_v1'],
    '0114 creates exactly the Match core');
  assert.deepEqual([...bodyOf('0114').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]),
    ['approve_matching_proposal_forward_core_v1'], 'and revises exactly the forward approval');
});

test('no I-07C migration grants anything to any application role', () => {
  // THE PRE-LAUNCH PROPERTY. The Match commit creates an irreversible Shared
  // World and the CW2-08 Launch Gate that must clear it does not exist here, so
  // nothing in this slice may hand a production caller a path to it.
  for (const [n, file] of Object.entries(NAMES)) {
    assert.deepEqual([...EXECUTABLE[n].matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]{0,160}?TO\s+(\w+)/giu)].map((m) => m[1]), [],
      `${file} grants EXECUTE to nobody`);
    assert.doesNotMatch(EXECUTABLE[n], /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE/iu, `${file} grants no direct table privilege`);
  }
  assert.match(EXECUTABLE['0113'], /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated/u, '0113 revokes every relation from PUBLIC, anon and authenticated');
  assert.match(EXECUTABLE['0113'], /FROM service_role/u, 'and from service_role');
  assert.match(EXECUTABLE['0114'], /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u, '0114 revokes both boundaries from PUBLIC, anon and authenticated');
  assert.match(EXECUTABLE['0114'], /REVOKE ALL ON FUNCTION %s FROM service_role/u,
    '0114 revokes service_role too: a system credential never manufactures a human acceptance');
  assert.match(EXECUTABLE['0114'], /'public\.approve_matching_proposal_forward_core_v1\(uuid,uuid,uuid\)',\n\s+'public\.commit_matching_mutual_match_v1\(uuid(?:,uuid){11}\)'\]/u,
    'the revocation loop names exactly the revised approval and the twelve-identity core, so CREATE OR REPLACE inherits no ACL');
});

test('there is no SECOND_ACCEPTED anywhere in I-07C, in any spelling, and no accepted-but-not-matched row', () => {
  // The state the architecture deliberately does not have. The second acceptance
  // is durable only as a successful Match commit: proven exact view, revalidated
  // truth, one winner, one World, both pauses and every competitor cancelled,
  // in one transaction. Persisting it earlier would be the thing that makes
  // splitting the transaction look possible.
  for (const [n, file] of Object.entries(NAMES)) {
    for (const state of ['SECOND_ACCEPTED', 'ACCEPTED_PENDING_MATCH', 'MATCH_PENDING', 'INTRODUCTION_RESERVED', 'SLOT_RESERVED']) {
      assert.ok(!bodyOf(n).includes(state), `${file} cannot spell ${state}`);
    }
  }
  const columns = [...DDL.matchAll(/^ {4}(\w+) (uuid|text|timestamptz|integer|boolean)\b/gmu)].map((m) => m[1]);
  assert.ok(columns.length > 60, `the I-07C relations declare columns to check, found ${columns.length}`);
  const BANNED = /(^|_)(score|rank|ranking|weight|weighted|priority|percent|percentage|rating|percentile|leaderboard|ordinal|position|owner|admin|creator|initiator|role|accepted_pending|match_pending|reserved|reason|evidence|provenance|refusal|snapshot|grant|requirement|note|source_class|phone|email|contact|handle)(_|$)/u;
  for (const column of columns) {
    assert.doesNotMatch(column, BANNED, `${column} is a ranking, owner, reason, evidence, authority or contact column and I-07C may carry none`);
  }
  assert.doesNotMatch(DDL, /\b(jsonb?|bytea)\b/iu, 'no untyped payload column exists');
  assert.doesNotMatch(DDL, /\w+\s+(uuid|text|integer)\[\]/u, 'and no array column');
  assert.match('match_percentage', BANNED, 'the detector is exercised rather than vacuous');
  assert.match('private_reason_code', BANNED, 'and would refuse a private reason column on a handoff relation');
  // The 0110 proposal relation is not extended: the I-07B column ban is
  // preserved, not dodged, and the Match is a separate durable row.
  assert.doesNotMatch(EXECUTABLE['0113'], /ALTER TABLE public\.matching_proposals\n\s+ADD COLUMN/u, 'matching_proposals gains no column');
  assert.match(DDL, /ALTER TABLE public\.matching_proposals\n\s+ADD CONSTRAINT matching_proposals_pair_identity_key\n\s+UNIQUE \(id, pair_id, lower_user_id, higher_user_id\);/u,
    'it gains exactly the candidate key later rows bind exactly');
});

test('the Match core is caller-anonymous, enters before it reads, locks in canonical order, gates last and writes once', () => {
  // THE PUBLISHED ORDER IS THE PROPERTY. A materialization supersedes a recipient
  // view while holding the two-human lock; a human decision that read the view
  // before taking that lock would act on a superseded one (the I-07B I07B-CONC-01
  // finding). The Match core adds the row locks over every proposal it may
  // mutate, in ascending id, so two Matches sharing a human serialize on the
  // human locks and two disjoint Matches sharing a competitor serialize on its row.
  const header = CORE.slice(0, CORE.indexOf(') RETURNS TABLE('));
  const inputs = [...header.matchAll(/(p_\w+) (\w+)/gu)];
  assert.equal(inputs.length, 12, 'the core accepts exactly twelve parameters');
  assert.deepEqual([...new Set(inputs.map((m) => m[2]))], ['uuid'], 'every one of them an opaque uuid identity');
  for (const [, name] of inputs) {
    assert.doesNotMatch(name, /user|human|actor|grantor|owner|subject|on_behalf|recipient_user|status|state|reason|basis|lifecycle|phase|timestamp|_at$|occurred|clock/u,
      `${name} would let a caller name a human, a state, a reason or a clock`);
  }
  const returns = CORE.slice(CORE.indexOf(') RETURNS TABLE(') + ') RETURNS TABLE('.length, CORE.indexOf(')\nLANGUAGE plpgsql'));
  assert.deepEqual([...returns.matchAll(/(\w+) (?:uuid|text)/gu)].map((m) => m[1]), RESULT_COLUMNS,
    'the core returns exactly the bounded committed result');
  assert.match(CORE, /u uuid := auth\.uid\(\);/u, 'the accepting human is auth.uid()');
  const at = (needle) => { const i = CORE.indexOf(needle); assert.ok(i >= 0, `the core carries ${needle}`); return i; };
  const order = [
    'enter_matching_proposal_decision_v1(p_proposal_id, u)',
    'ORDER BY p.id',
    "assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'CANDIDATE')",
    "proposal.proposal_state <> 'FORWARDED_TO_SECOND'",
    'proposal.expires_at <= CURRENT_TIMESTAMP',
    'FROM public.matching_forward_approval_view_bindings b',
    'first_current_view IS DISTINCT FROM binding.approved_view_id',
    'resolve_matching_proposal_validity_v1(p_proposal_id)',
    "c.claim_state = 'HELD'",
    'FROM public.matching_participation_state s',
    "gate.clearance <> 'CLEARED'",
    'birth_at := clock_timestamp()',
    'DEFERRED;',
    "'FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED', NULL, u, NULL",
    "VALUES (p_world_id, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', birth_at, NULL)",
    'INSERT INTO public.shared_world_membership_episodes',
    'INSERT INTO public.introduction_records',
    'INSERT INTO public.shared_world_matching_birth_events',
    'INSERT INTO public.shared_world_introduction_started_events',
    'INSERT INTO public.matching_active_introduction_claims',
    "'PAUSE', 'PAUSED',\n            'ACTIVE_INTRODUCTION'",
    "'CANCELLED_BY_COMPETING_MATCH',\n        NULL, NULL, 'COMPETING_MATCH_COMMITTED'",
    'INSERT INTO public.matching_match_handoff_package_versions',
    'INSERT INTO public.matching_match_handoff_subjects',
    'INSERT INTO public.matching_match_handoff_fields',
    'INSERT INTO public.matching_match_commits',
    'IMMEDIATE;',
    'EXCEPTION WHEN unique_violation THEN',
  ].map(at);
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i] > order[i - 1], `step ${i} of the published order follows step ${i - 1}`);
  }
  assert.equal((CORE.match(/enter_matching_proposal_decision_v1/gu) ?? []).length, 1, 'the core enters the serialized region exactly once');
  assert.doesNotMatch(CORE, /lock_matching_pair_humans_v1|INSERT INTO public\.matching_setup_locks/u, 'and reaches the setup locks only through that entry point');
  assert.equal((CORE.match(/clock_timestamp\(\)/gu) ?? []).length, 1, 'exactly one instant is captured');
  assert.equal((CORE.match(/CURRENT_TIMESTAMP/gu) ?? []).length, 1, 'the transaction clock is read once, to compare the deadline, and persisted never');
  assert.doesNotMatch(CORE, /now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/u, 'and no other clock exists');
  assert.doesNotMatch(CORE, /pg_advisory|LOCK TABLE|DELETE FROM|TRUNCATE/u, 'no advisory lock, no table lock, no deletion');
  assert.doesNotMatch(CORE, /INSERT INTO public\.matching_proposal_transitions/u, 'every transition goes through the one writer');
  assert.equal((CORE.match(/append_matching_proposal_transition_v1\(/gu) ?? []).length, 2, 'the winner and each competitor, through the one writer, and nothing else');
  assert.equal((CORE.match(/gen_random_uuid\(\)/gu) ?? []).length, 1, 'exactly the competing cancellation ids are database-generated');
  assert.ok(CORE.indexOf('gen_random_uuid()') < CORE.indexOf("'CANCELLED_BY_COMPETING_MATCH'")
    && CORE.indexOf("'CANCELLED_BY_COMPETING_MATCH'") - CORE.indexOf('gen_random_uuid()') < 400,
  'and only for them, because their number is private');
  const deferredSets = [...CORE.matchAll(/SET CONSTRAINTS ([\s\S]*?) (DEFERRED|IMMEDIATE);/gu)]
    .map((m) => [m[2], [...m[1].matchAll(/public\.(\w+)/gu)].map((x) => x[1]).sort()]);
  assert.deepEqual(deferredSets, [['DEFERRED', [...DEFERRED].sort()], ['IMMEDIATE', [...DEFERRED].sort()]],
    'exactly the six reverse bindings are deferred for the write region and flushed immediately after the commit row');
  assert.doesNotMatch(CORE, /READ_ONLY_CLOSED|'STANDARD'|ACCEPTED_INVITATION|'COMPLETED'|'CLOSED'|'RELEASED'|USER_PAUSED|POST_INTRODUCTION|POST_SUCCESS|SYSTEM_POLICY/u,
    'the core names no I-07D lifecycle, no direct birth, no claim release and no pause but ACTIVE_INTRODUCTION');
  assert.doesNotMatch(CORE, /matching_private_reasoning_notes|matching_safe_conclusion_candidates|matching_sensitive_filter_refusals|matching_hard_requirement_results|introduction_profile_field_values|pre_match_disclosure_authorit|matching_context_grant|standing_context|personal_|public_|replay_/u,
    'the core reads no private Matching relation, no authority relation, no Personal, Public or Replay state');
  // Durable idempotency compares the WHOLE request, three times, and answers
  // from the committed row with the frozen birth constants - never the live World.
  assert.equal((CORE.match(/committed\.handoff_package_version_id = p_handoff_package_version_id/gu) ?? []).length, 3,
    'every idempotency pass compares the whole immutable request');
  assert.equal((CORE.match(/'MATCHED'::text, committed\.id, committed\.proposal_id, committed\.world_id/gu) ?? []).length, 3,
    'every equivalent retry answers with the identities this command committed');
  assert.equal((CORE.match(/JOIN public\.shared_world_matching_birth_events b ON b\.world_id = w\.id/gu) ?? []).length, 3,
    'and fails closed on a World, birth fact or record that has vanished');
  assert.doesNotMatch(CORE, /w\.lifecycle|w\.phase|r\.introduction_status/u, 'never returning the World or record current state');
  // The published lock order is written down where the next reviewer looks.
  assert.match(SOURCE['0114'], /LOCK ORDER/u, 'the header publishes the lock order');
  assert.match(SOURCE['0114'], /ascending proposal/u, 'including the proposal-row order');
});

test('the revised forward approval keeps its 0112 signature and order and adds exactly the exact-view binding', () => {
  const signature = (source, keyword) => {
    const start = source.indexOf(`${keyword} public.approve_matching_proposal_forward_core_v1(`);
    assert.ok(start >= 0, `${keyword} approve_matching_proposal_forward_core_v1 exists`);
    return source.slice(start + keyword.length, source.indexOf("SET search_path='' AS $$", start));
  };
  assert.equal(signature(SOURCE['0114'], 'CREATE OR REPLACE FUNCTION'), signature(source0112, 'CREATE FUNCTION'),
    'the parameters, the result columns and the posture are byte-identical to 0112');
  const at = (needle) => { const i = APPROVAL.indexOf(needle); assert.ok(i >= 0, `the approval carries ${needle}`); return i; };
  const order = [
    'enter_matching_proposal_decision_v1(p_proposal_id, u)',
    "assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT')",
    'resolve_matching_proposal_validity_v1(p_proposal_id)',
    "gate.clearance <> 'CLEARED'",
    "'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', u, NULL, NULL",
    'INSERT INTO public.matching_forward_approval_view_bindings',
  ].map(at);
  for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], `approval step ${i} follows step ${i - 1}`);
  // The committed answer is returned twice - from the retry path before any
  // lock, and after the binding is written - and both are the same literal.
  assert.equal((APPROVAL.match(/'FIRST_FORWARD_APPROVED'::text, 'IN_PROGRESS'::text/gu) ?? []).length, 2, 'the approval answers the same bounded result on both paths');
  assert.ok(APPROVAL.lastIndexOf("'FIRST_FORWARD_APPROVED'::text, 'IN_PROGRESS'::text") > order[order.length - 1],
    'and the fresh answer follows the binding write');
  assert.doesNotMatch(APPROVAL, /lock_matching_pair_humans_v1/u, 'it reaches the two-human lock only through the one entry point');
  assert.doesNotMatch(APPROVAL, /MUTUAL_MATCH|shared_worlds|introduction_record|handoff|claim|participation_events/u,
    'forward approval is not a Mutual Match: no World, no record, no claim, no handoff, no pause');
  assert.match(APPROVAL, /bound\.approved_view_id IS DISTINCT FROM p_expected_view_id[\s\S]{0,120}MATCHING_COMMAND_ID_CONFLICT/u,
    'a retry naming a different view under a reused command id fails closed');
  // The binding relation is the only new thing the approval writes, and it is
  // one exact row: the approving transition, the approving human and the exact view.
  const bindings = sliceOf(SOURCE['0113'], 'CREATE TABLE public.matching_forward_approval_view_bindings', 'CREATE TABLE public.matching_match_commits');
  assert.match(bindings, /REFERENCES public\.matching_proposal_transitions \(id, proposal_id, resulting_state\)/u, 'bound to the exact approving transition');
  assert.match(bindings, /REFERENCES public\.matching_proposal_transitions \(id, first_recipient_actor_id\)/u, 'and its exact human actor');
  assert.match(bindings, /REFERENCES public\.matching_recipient_proposal_views \(id, proposal_id, recipient_user_id\)/u, 'and the exact view that human held');
  assert.match(bindings, /approval_state text NOT NULL DEFAULT 'FIRST_FORWARD_APPROVED'[\s\S]*?CHECK \(approval_state = 'FIRST_FORWARD_APPROVED'\)/u,
    'and it can bind nothing but a forward approval');
});

test('the handoff ceiling is structural: a handoff row can only be a copy of an exact recipient-view row', () => {
  const subjects = sliceOf(SOURCE['0113'], 'CREATE TABLE public.matching_match_handoff_subjects', 'CREATE TABLE public.matching_match_handoff_fields');
  const fields = sliceOf(SOURCE['0113'], 'CREATE TABLE public.matching_match_handoff_fields', '-- 10. THE COMMIT BINDS ITS CHILDREN');
  assert.match(subjects, /REFERENCES public\.matching_recipient_proposal_views \(id, recipient_user_id, subject_user_id\)/u, 'the subject is the view subject');
  assert.match(subjects, /REFERENCES public\.matching_recipient_proposal_views \(id, subject_first_name\)/u, 'the presented name is the view name');
  assert.match(subjects, /REFERENCES public\.matching_recipient_proposal_views \(id, permitted_conclusion_id\)/u, 'the conclusion is the view conclusion');
  assert.match(subjects, /REFERENCES public\.matching_permitted_safe_conclusions \(id\)/u, 'and a conclusion the filter permitted');
  assert.match(subjects, /matching_match_handoff_subjects_route_ban_check/u, 'the conclusion text carries a route ban');
  assert.match(subjects, /matching_match_handoff_subjects_provenance_ban_check/u, 'and a source-identifier ban');
  assert.match(fields, /REFERENCES public\.matching_recipient_proposal_view_fields \(view_id, field_key\)/u, 'a handoff field is a real field of the exact view');
  assert.match(fields, /matching_match_handoff_fields_value_check/u, 'its value is bounded');
  assert.match(fields, /matching_match_handoff_fields_route_ban_check/u, 'route-banned');
  assert.match(fields, /matching_match_handoff_fields_provenance_ban_check/u, 'and provenance-banned');
  // The handoff relations reach ONLY the exact-view sources and their own commit
  // chain: no private note, refusal, snapshot, grant, authority or profile.
  const handoff = sliceOf(SOURCE['0113'], '-- 9. THE MATCH HANDOFF PACKAGE', '-- 10. THE COMMIT BINDS ITS CHILDREN');
  const parents = [...new Set([...handoff.matchAll(/REFERENCES public\.(\w+)/gu)].map((m) => m[1]))].sort();
  for (const parent of parents) {
    assert.ok(['introduction_records', 'matching_match_commits', 'matching_match_handoff_package_versions', 'matching_match_handoff_subjects',
      'matching_permitted_safe_conclusions', 'matching_proposals', 'matching_recipient_proposal_view_fields', 'matching_recipient_proposal_views',
      'shared_worlds', 'users'].includes(parent), `a handoff relation may not reach ${parent}`);
  }
  assert.ok(parents.includes('matching_recipient_proposal_view_fields') && parents.includes('matching_recipient_proposal_views'),
    'and it really does reach the exact-view sources');
  // The core copies from the two exact views and composes nothing.
  assert.match(CORE, /WHERE v\.id IN \(binding\.approved_view_id, p_expected_view_id\)/u, 'the subjects are the two exact views');
  assert.match(CORE, /WHERE f\.view_id IN \(binding\.approved_view_id, p_expected_view_id\)/u, 'and the fields are those views\' fields');
  assert.doesNotMatch(CORE, /introduction_profile|profile_version|field_value\b/u, 'no field is fetched from a profile');
});

test('every regex whose pattern is built by concatenation parenthesizes it', () => {
  // PostgreSQL puts `~`, `~*`, `!~`, `!~*` and `||` in the SAME precedence class,
  // so `col ~* 'A' || 'B'` parses as `(col ~* 'A') || 'B'`. I-07A lost a focused
  // round to exactly this; the detector is the I-07B one, applied to this slice.
  const executableOnly = (sql) => sql.split('\n').map((line) => (line.trim().startsWith('--') ? ' '.repeat(line.length) : line)).join('\n');
  const endOfLiteral = (text, from) => {
    for (let i = from + 1; i < text.length; i += 1) {
      if (text[i] !== "'") continue;
      if (text[i + 1] === "'") { i += 1; continue; }
      return i + 1;
    }
    return -1;
  };
  const scan = (text, file) => {
    const offenders = [];
    let concatenated = 0;
    for (const match of text.matchAll(/(!?~\*?)(\s*)(\(?)\s*'/gu)) {
      const quoteAt = match.index + match[0].length - 1;
      const after = endOfLiteral(text, quoteAt);
      if (after < 0 || !/^\s*\|\|/u.test(text.slice(after, after + 40))) continue;
      concatenated += 1;
      if (match[3] !== '(') offenders.push(`${file} line ${text.slice(0, match.index).split('\n').length}: ${match[1]}`);
    }
    return { offenders, concatenated };
  };
  // NON-VACUITY: the detector really fires on the broken shape and stays quiet on the parenthesized one.
  assert.equal(scan("IF x ~* 'a' || 'b' THEN", 'sample').offenders.length, 1, 'the detector catches the unparenthesized shape');
  assert.equal(scan("IF x ~* ('a' || 'b') THEN", 'sample').offenders.length, 0, 'and accepts the parenthesized one');
  let concatenated = 0;
  for (const [n, file] of Object.entries(NAMES)) {
    const result = scan(executableOnly(SOURCE[n]), file);
    concatenated += result.concatenated;
    assert.deepEqual(result.offenders, [], 'a regex pattern built by concatenation must be parenthesized, or it parses as (regex-match) || text');
  }
  assert.ok(concatenated >= 1, `the slice builds at least one pattern by concatenation, found ${concatenated}, so the scan is exercised`);
});

test('the frozen I-07C vocabularies are identical in the database and in the TypeScript contract', () => {
  assert.deepEqual(vocabularyOf(SOURCE['0113'], 'introduction_records_status_check'), typescriptVocabularyOf('INTRODUCTION_RECORD_STATUSES'));
  assert.deepEqual(vocabularyOf(SOURCE['0113'], 'matching_active_introduction_claims_state_check'), typescriptVocabularyOf('ACTIVE_INTRODUCTION_CLAIM_STATES'));
  // The rebuilt private-reason vocabulary is the eleven 0110 codes plus exactly one.
  const rebuilt = vocabularyOf(SOURCE['0113'], 'matching_proposal_transitions_reason_check');
  assert.deepEqual(rebuilt, [...vocabularyOf(source0110, 'matching_proposal_transitions_reason_check'), ...typescriptVocabularyOf('I07C_PROPOSAL_PRIVATE_REASONS')],
    'the rebuilt CHECK is the 0110 vocabulary followed by exactly the I-07C code');
  assert.deepEqual(rebuilt, [...typescriptVocabularyOf('MATCHING_PROPOSAL_PRIVATE_REASONS', proposalVocabulary), ...typescriptVocabularyOf('I07C_PROPOSAL_PRIVATE_REASONS')],
    'and the TypeScript contracts of the two slices compose to the same list');
  assert.deepEqual(typescriptVocabularyOf('I07C_PROPOSAL_PRIVATE_REASONS'), ['COMPETING_MATCH_COMMITTED']);
  // Produced and reserved partition each vocabulary exactly.
  const partition = (all, produced, reserved) => {
    assert.deepEqual([...produced, ...reserved].sort(), [...all].sort(), `${produced} and ${reserved} partition ${all}`);
    assert.equal(produced.filter((s) => reserved.includes(s)).length, 0, 'and are disjoint');
  };
  partition(typescriptVocabularyOf('INTRODUCTION_RECORD_STATUSES'), typescriptVocabularyOf('I07C_PRODUCED_INTRODUCTION_RECORD_STATUSES'),
    typescriptVocabularyOf('I07D_RESERVED_INTRODUCTION_RECORD_STATUSES'));
  assert.deepEqual(typescriptVocabularyOf('I07C_PRODUCED_CLAIM_STATES'), ['HELD']);
  assert.deepEqual(typescriptVocabularyOf('ACTIVE_INTRODUCTION_CLAIM_STATES').filter((s) => s !== 'HELD'), ['RELEASED'], 'RELEASED is representable and produced by nothing here');
  assert.deepEqual(typescriptVocabularyOf('I07C_PRODUCED_PROPOSAL_STATES'), typescriptVocabularyOf('I07C_RESERVED_PROPOSAL_STATES', proposalVocabulary),
    'I-07C produces exactly the two states I-07B reserved');
  const pauses = typescriptVocabularyOf('MATCHING_PAUSE_REASONS', setupVocabulary);
  const produced = typescriptVocabularyOf('I07C_PRODUCED_PAUSE_REASONS');
  assert.deepEqual(produced, ['ACTIVE_INTRODUCTION']);
  assert.ok(pauses.includes('ACTIVE_INTRODUCTION'), 'the produced pause reason is one I-07A reserved');
  assert.ok(!typescriptVocabularyOf('I07A_USER_RESUMABLE_PAUSE_REASONS', setupVocabulary).includes('ACTIVE_INTRODUCTION'),
    'and it is not user-resumable, exactly as I-07A froze it');
  // The birth constants are the 0075 vocabularies, and the core writes exactly them.
  assert.ok(vocabularyOf(source0075, 'shared_worlds_lifecycle_check').includes(typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_LIFECYCLE')[0]));
  assert.ok(vocabularyOf(source0075, 'shared_worlds_phase_check').includes(typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_PHASE')[0]));
  assert.ok(vocabularyOf(source0075, 'shared_worlds_birth_basis_check').includes(typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_BASIS')[0]));
  assert.deepEqual([typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_LIFECYCLE'), typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_PHASE'), typescriptVocabularyOf('MUTUAL_MATCH_BIRTH_BASIS')],
    [['ACTIVE'], ['INTRODUCTION'], ['MUTUAL_MATCH']]);
  // The committed result interface is the RETURNS TABLE, field for field.
  const iface = vocabulary.slice(vocabulary.indexOf('export interface MutualMatchCommitResult {'), vocabulary.indexOf('}', vocabulary.indexOf('export interface MutualMatchCommitResult {')));
  const fields = [...iface.matchAll(/readonly (\w+):/gu)].map((m) => m[1].replace(/[A-Z]/gu, (c) => `_${c.toLowerCase()}`));
  assert.deepEqual(fields, RESULT_COLUMNS, 'the TypeScript result carries exactly the nine bounded columns');
  assert.match(iface, /readonly outcome: 'MATCHED';/u, 'and the one outcome');
  // The vocabulary module is import-closed and evaluates nothing.
  assert.doesNotMatch(vocabulary, /^import\b/mu, 'the vocabulary module imports nothing at all');
  assert.doesNotMatch(vocabulary, /\bfunction\b|=>|\bclass\b|\brequire\(/u, 'and defines no behaviour');
  const executableTypescript = vocabulary.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('/*')).join('\n');
  assert.doesNotMatch(executableTypescript, /SECOND_ACCEPTED|ACCEPTED_PENDING_MATCH|MATCH_PENDING|INTRODUCTION_RESERVED|Score|SCORE|Rank|RANK|Percent|PERCENT|Weight|WEIGHT/u,
    'no second-acceptance state and no ranking identifier exists');
  const exported = [...executableTypescript.matchAll(/export (?:const|type|interface) (\w+)/gu)].map((m) => m[1]);
  assert.ok(exported.length >= 18, `the vocabulary module exports names to check, found ${exported.length}`);
});

test('the predecessor forward-safety seams were reconciled in this slice rather than dodged', () => {
  // 0110 P06 predicted the I-07C relations as ABSENT from the Matching namespace.
  // The honest repair is an EQUALITY against the named I-07C list, non-vacuous,
  // with the column ban on the proposal relation preserved.
  assert.match(PREDECESSOR['0110'], /I07C_LIFECYCLE_RELATIONS\.filter\(\(name\) => \/\^\(matching_\|introduction_\|pre_match_\)\/u\.test\(name\) && MATCH_SCOPE_WORDS\.test\(name\)\)/u,
    'the 0110 future-relation census is an equality against the named I-07C list');
  assert.match(PREDECESSOR['0110'], /_claim/u, 'and its regex reaches the claim relation by the name I-07C gave the slot');
  assert.match(PREDECESSOR['0110'], /forbidden\.length > 0/u, 'and is proven non-vacuous');
  assert.match(PREDECESSOR['0110'], /const COLUMN_BAN = \/[^\n]*match_commit\|introduction_slot/u, 'the I-07B proposal column ban is preserved');
  // 0112 asserted "no producer" for the reserved states and for acceptance; both
  // are now equalities against the one reviewed producer, and the one-writer law stands.
  assert.equal((PREDECESSOR['0112'].match(/\[I07C_MATCH_PRODUCER\]/gu) ?? []).length, 2,
    'the 0112 producer census and the acceptance census are equalities against the reviewed I-07C producer');
  assert.match(PREDECESSOR['0112'], /assert\.deepEqual\(writers\.map\(\(r\) => r\.proname\), \['append_matching_proposal_transition_v1'\]/u,
    'and the one-writer law is still an equality');
  assert.match(proposalSupport, /export const I07C_MATCH_PRODUCER = 'commit_matching_mutual_match_v1';/u, 'the producer name is owned by the support module');
  // 0108 / 0109 compare the live catalog against the shared list filtered by
  // their own regexes, so the union can grow without either census going vacuous.
  assert.match(PREDECESSOR['0108'], /LATER_SLICE_LIFECYCLE_RELATIONS\.filter\(\(name\) => MATCHING_LIFECYCLE_WORDS\.test\(name\)\)/u);
  assert.match(PREDECESSOR['0109'], /LATER_SLICE_LIFECYCLE_RELATIONS\.filter\(\(name\) => EVALUATION_WORDS\.test\(name\)\)/u);
  // 0082 predicted `introduction_records` as a name to plant; it has arrived, and
  // the probe now counts arrivals instead of planting over a real relation.
  assert.match(PREDECESSOR['0082'], /'introduction_records'/u, 'the 0082 forward-safety list still names the record relation');
  assert.match(PREDECESSOR['0082'], /assert\.equal\(planted \+ arrived, predicted\.length/u, 'and counts an arrived relation as arrived rather than planting it');
  // The I-07B teardown removes the I-07C rows first, because they bind the I-07B rows restrictively.
  const teardown = proposalSupport.slice(proposalSupport.indexOf('async function removeCommittedProposalState('));
  assert.ok(teardown.indexOf('await removeCommittedMatchState(humans);') < teardown.indexOf('DISABLE TRIGGER'),
    'the I-07B teardown removes the I-07C rows before it lifts a single I-07B guard');
  // Historical migrations were not touched: the byte pins above are the proof;
  // this only makes the intent explicit where a reader looks for it.
  assert.doesNotMatch(SOURCE['0113'], /CREATE OR REPLACE FUNCTION/u, '0113 replaces nothing');
});

test('the two real-PostgreSQL verifiers are pinned into the toolchain and into CI, and the races are barrier-pinned', () => {
  for (const [n, script] of [
    ['0113', 'verify:matching-mutual-match-introduction-persistence:integration'],
    ['0114', 'verify:matching-mutual-match-commit-transaction:integration'],
  ]) {
    assert.ok(packageJson.includes(`"${script}"`), `${script} exists in package.json`);
    assert.ok(packageJson.includes(`database/verify-migration-${n}.mjs`), `and runs the ${n} verifier`);
    assert.ok(workflow.includes(`npm run ${script}`), `${script} runs in API CI`);
    assert.ok(readme.includes(NAMES[n]), `${NAMES[n]} is documented in the database README`);
    assert.ok(readme.includes(script), `and so is ${script}`);
    assert.match(VERIFIER[n], /createScenarioReport/u, `the ${n} verifier reports every scenario independently`);
    assert.match(VERIFIER[n], /report\.assertAllPassed\(\)/u, `and fails once with all of them named`);
  }
  assert.ok(workflow.indexOf('verify:matching-mutual-match-introduction-persistence:integration')
    > workflow.indexOf('verify:matching-proposal-choreography-runtime:integration'),
  'the I-07C verifier group runs after the I-07B group in API CI');
  // Every race pins its interleaving: the primary is released only once the
  // competitor is OBSERVABLY waiting for a lock, observed from another connection.
  assert.match(matchSupport, /wait_event_type = 'Lock'/u, 'the barrier observes a real lock wait');
  assert.ok((VERIFIER['0114'].match(/await waitExtra\(\)/gu) ?? []).length >= 5, 'every race path waits for the barrier before releasing');
  assert.ok((VERIFIER['0114'].match(/report\.section\('C\d\d /gu) ?? []).length >= 15, 'fifteen concurrency scenarios exist');
  assert.match(VERIFIER['0114'], /'40P01'/u, 'and a deadlock is a named failure, never a timeout');
  // The no-ghost proof injects a late failure and asserts ZERO surviving effects.
  assert.match(VERIFIER['0114'], /i07c_probe_late_failure/u, 'the late-failure probe exists');
  assert.match(VERIFIER['0114'], /const NOTHING = Object\.freeze\(\{\n\s+commits: 0, matchTransitions: 0, worlds: 0, episodes: 0, records: 0, births: 0, starts: 0,\n\s+claims: 0, pauses: 0, cancellations: 0, packages: 0, subjects: 0,/u,
    'and zero effects is spelled as twelve zero cardinalities');
  assert.match(VERIFIER['0114'], /DROP FUNCTION IF EXISTS public\.i07c_probe_late_failure_v1\(\)/u, 'the probe is removed on every path');
  // The verifiers exercise the real boundaries and never write a Match row directly in the runtime verifier.
  assert.doesNotMatch(VERIFIER['0114'].replace(/\/\/[^\n]*/gu, ''), /(?:q|rows)\(\s*`\s*INSERT INTO (?:\$\{MATCH\.COMMITS\}|public\.matching_match_commits)/u,
    'the runtime verifier never writes a commit row itself');
  assert.match(VERIFIER['0113'].replace(/\/\/[^\n]*/gu, ''), /INSERT INTO \$\{MATCH\.COMMITS\}/u,
    'while the persistence verifier writes it directly as the owner, which is what proves the database refuses the owner too');
});

test('the verifier support module names every relation and both boundaries the slice creates or revises', () => {
  for (const table of TABLES_0113) {
    assert.ok(proposalSupport.includes(`public.${table}`), `the support module names ${table}`);
  }
  assert.ok(matchSupport.includes('public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'),
    'the support module names the Match core');
  assert.ok(proposalSupport.includes('public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)'), 'and the revised approval');
  for (const name of DEFERRED) {
    assert.ok(matchSupport.includes(`'${name}'`), `the support module names the deferred binding ${name}`);
    assert.ok(EXECUTABLE['0113'].includes(`CONSTRAINT ${name}`), `and 0113 declares it`);
  }
  assert.equal((bodyOf('0113').match(/DEFERRABLE INITIALLY DEFERRED/gu) ?? []).length, DEFERRED.length,
    'exactly the six reverse bindings onto the commit are deferred');
});
