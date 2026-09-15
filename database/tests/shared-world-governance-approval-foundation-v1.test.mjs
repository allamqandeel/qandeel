// I-04D - Exact Membership Snapshot + Shared Governance Approval Foundation v1:
// the secret-free structural contract for migration 0084.
//
// Live semantics - ACLs, real denials, the exact captured topology, the
// leave-then-rejoin staleness, the removal exclusion, the empty-set refusals,
// idempotency and the multi-connection races - are proven by
// database/verify-migration-0084.mjs against real PostgreSQL, which this file pins
// into the toolchain and CI. What is proven HERE is the structure a migration must
// already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04D: that THIS slice created the shared
// governance authority substrate - an exact membership snapshot, an exact proposal
// binding, an exact human approval and a current satisfaction proof - and nothing
// beyond it. No add-member, removal, rejoin, settings mutation or World end; no
// MEMBER_INVITATION; no history access; no closed-world entitlement; no Launch
// Gate; no application wrapper, controller or route; no generic permission engine
// spanning Public, Replay or Matching; no Personal-context read; no Standing
// Context or consent mutation; no owner, admin or initiator authority - and that it
// modified no frozen predecessor migration.
//
// It deliberately does NOT prove that any of those may never appear later. The
// whole point of this slice is that add-member is expected to arrive next, with its
// own immutable payload/version table, its own foreign key into a proposal, its own
// operation-specific function and eventually a launch-gated wrapper. A historical
// contract that froze today's absences would fail on all of it. So every assertion
// below is scoped to one of exactly two things:
//
//   (a) migration 0084 itself, the verifier it added, and the two registration
//       lines it added (package.json and API CI);
//   (b) the frozen predecessor migrations it was required not to modify, pinned by
//       content hash, which proves immutability without banning additions.
//
// There is no census of the migration list, of a directory, of the function catalog
// or of any table's live column set. The last two tests prove that by mutation:
// they mirror the repository, add the hypothetical add-member consumer, a Launch
// Gate, a member-invitation table, a later operation-specific function and two
// later migrations, and require this contract to still pass - then plant the
// regressions it must still refuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-world-governance-approval-foundation-v1.test.mjs';
/** Set in the child runs of the forward-safety probes, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04D_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0084_shared_world_governance_approval_foundation_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0084.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

/** Executable SQL only: every "must not contain" assertion below runs against this, never against prose. */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * Executable SQL MINUS the terminal self-assertion block.
 *
 * That block legitimately NAMES every shape it refuses - the launch gate, the other
 * lifecycle literals, the Standing Context tables - so scanning it for those names
 * would make this contract fail on the very code that enforces them.
 */
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
/** The terminal self-assertion block alone, checked POSITIVELY by what it raises. */
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const CAPTURE_FN = 'capture_shared_world_governance_proposal_v1';
const APPROVE_FN = 'commit_shared_world_governance_approval_v1';
const RESOLVE_FN = 'resolve_shared_world_governance_approval_v1';
const OWN_FUNCTIONS = [CAPTURE_FN, APPROVE_FN, RESOLVE_FN];

/**
 * The stored body of one CREATE FUNCTION, comments INCLUDED.
 *
 * pg_proc.prosrc keeps the function's comments, so the migration's own prosrc-level
 * checks run against comments as well as code. This is exactly the text PostgreSQL
 * will store, which is what the mirror test at the end needs.
 */
const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0084 creates ${name}`);
  const start = migration.indexOf("SET search_path='' AS $$", create);
  assert.ok(start > create, `${name} pins an empty search_path`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + "SET search_path='' AS $$".length, end + '\nEND'.length);
};
const BODY = Object.fromEntries(OWN_FUNCTIONS.map((name) => [name, functionBody(name)]));
/** One function body with its `--` comments removed. */
const code = (name) => BODY[name].split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const CODE = Object.fromEntries(OWN_FUNCTIONS.map((name) => [name, code(name)]));

/** One CREATE TABLE block, comments stripped. */
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
const columnNames = (block) => (block.match(/^ {4}(\w+) (?:uuid|text|bigint|integer|timestamptz)\b/gmu) ?? [])
  .map((line) => line.trim().split(' ')[0]);

const SNAPSHOTS = 'shared_world_membership_snapshots';
const SNAPSHOT_MEMBERS = 'shared_world_membership_snapshot_members';
const PROPOSALS = 'shared_world_governance_proposals';
const APPROVALS = 'shared_world_governance_approvals';
const OWN_TABLES = [SNAPSHOTS, SNAPSHOT_MEMBERS, PROPOSALS, APPROVALS];
const OWN_SCRIPT = 'verify:shared-world-governance-approval-foundation:integration';

/** The frozen predecessor migrations, pinned by content rather than by absence. */
const PINNED_PREDECESSORS = [
  ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
  ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
  ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
  ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
  ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
  ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ['0081_shared_direct_invitation_runtime_v1.sql', '19789819a2076830fbc0d328909e3f4e8a35be66'],
  ['0082_shared_direct_world_birth_transaction_v1.sql', 'c7c575b246f01ce05944c7270428bea89d151a68'],
  ['0083_shared_world_standard_voluntary_leave_v1.sql', '91e4e427a2cfb7071a68bd59e0a9d2e37559d950'],
];

/** The exact frozen v1 operation / rule mapping (CW2-03 sections 16, 25, 28, 30, 31). */
const OPERATION_RULES = [
  ['ADD_MEMBER', 'ALL_CURRENT_MEMBERS'],
  ['REMOVE_MEMBER', 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'],
  ['REJOIN_MEMBER', 'ALL_CURRENT_MEMBERS'],
  ['WORLD_SETTINGS_CHANGE', 'ALL_CURRENT_MEMBERS'],
  ['END_WORLD', 'ALL_CURRENT_MEMBERS'],
];

// ---------------------------------------------------------------------------

test('0084 is the forward migration after 0083, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0084 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0084_')).length, 1, 'exactly one migration carries the 0084 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0083_shared_world_standard_voluntary_leave_v1.sql'), '0084 orders after 0083');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04D reopens no predecessor`);
  }
  // Forward-only: nothing existing is dropped, rewritten or renumbered.
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0084 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0084 touches no predecessor table at all: it is purely additive', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0084 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  // I-04D adds no membership, lifecycle or consent mutation of any kind.
  for (const forbidden of [
    'UPDATE public.shared_worlds', 'INSERT INTO public.shared_worlds',
    'UPDATE public.shared_world_membership_episodes', 'INSERT INTO public.shared_world_membership_episodes',
    'UPDATE public.shared_world_standing_context_grants', 'INSERT INTO public.shared_world_standing_context_consent_events',
    'DELETE FROM public.shared_world_standing_context_grant_audience',
  ]) {
    assert.ok(!deployableSql.includes(forbidden), `0084 never performs: ${forbidden}`);
  }
  assert.doesNotMatch(deployableSql, /DELETE FROM|TRUNCATE/iu, '0084 deletes no canonical history');
});

test('0084 creates exactly its own four narrow tables, and none is a generic permission engine', () => {
  const created = [...executableSql.matchAll(/^CREATE TABLE public\.(\w+)/gmu)].map((match) => match[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly four tables, all new');
  // The complete claim about what 0084 did NOT create lives HERE, in 0084's own
  // text, and nowhere else. The real-PostgreSQL verifier deliberately makes no such
  // claim: it runs against a FULLY migrated database, so a live absence census
  // there would reject exactly the later authorized objects this foundation exists
  // to serve - the add-member consumer and its payload table first of all.
  for (const absent of [
    'shared_world_member_invitations', 'member_invitations', 'shared_world_add_member_payloads',
    'shared_world_removals', 'shared_world_rejoins', 'shared_world_closures', 'shared_world_end_commands',
    'shared_world_settings', 'shared_world_history_grants', 'closed_world_view_entitlements',
    'shared_world_launch_gates', 'launch_gate_snapshots', 'feature_flags', 'introduction_records',
    'governance_permissions', 'permission_grants', 'public_experiences', 'replay_artifacts', 'matching_proposals',
  ]) {
    assert.ok(!created.includes(absent), `migration 0084 creates no ${absent}: no consumer, entitlement, launch or permission substrate`);
  }
  assert.deepEqual(columnNames(tableBlock(SNAPSHOTS)), ['id', 'world_id', 'captured_at'],
    'a captured topology is an identity, a World and an instant - no status, no current flag, no member list');
  assert.deepEqual(columnNames(tableBlock(SNAPSHOT_MEMBERS)), ['membership_snapshot_id', 'membership_episode_id'],
    'the captured set is EPISODE identity, and the human is not duplicated beside it');
  assert.deepEqual(columnNames(tableBlock(PROPOSALS)),
    ['id', 'world_id', 'membership_snapshot_id', 'operation_kind', 'proposed_payload_version_id',
      'approval_rule', 'excluded_membership_episode_id', 'created_at'],
    'a proposal is one operation, one opaque payload version, one rule, one exclusion and one captured topology');
  assert.deepEqual(columnNames(tableBlock(APPROVALS)),
    ['id', 'proposal_id', 'membership_snapshot_id', 'membership_episode_id', 'approved_at'],
    'an approval names the exact proposal, the exact topology and the exact approver episode - and no user id');
  for (const name of OWN_TABLES) {
    const block = tableBlock(name);
    assert.doesNotMatch(block, /json|jsonb|\[\]/iu, `${name} stores no JSON and no array: I-04D owns no future payload schema`);
    assert.doesNotMatch(block, /(owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|vote|weight|token)/iu,
      `${name} creates no superior authority and is not a generic permission store`);
    for (const fk of block.match(/FOREIGN KEY[\s\S]*?(?=,\n|$)/gu) ?? []) {
      assert.match(fk, /ON DELETE RESTRICT/u, `every ${name} foreign key is restrictive: canonical history never cascades away`);
    }
  }
  // No actor_user_id anywhere: the exact human IS the immutable membership episode.
  assert.doesNotMatch(tableBlock(APPROVALS), /actor_user_id|\buser_id\b/u,
    'the approver is identified by the membership episode, never by a duplicated human id');
  assert.doesNotMatch(tableBlock(SNAPSHOT_MEMBERS), /actor_user_id|\buser_id\b/u,
    'and the captured set duplicates no human id either');
  // No revocation, decline or cancel lifecycle exists in this slice.
  assert.doesNotMatch(deployableSql, /revoked_at|declined_at|cancelled_at|withdrawn_at|approval_status|proposal_status/iu,
    'I-04D has no revocation, decline or cancel lifecycle, and stamps no mutable status on a governance row');
});

test('the operation and rule vocabularies are NOT frozen into a table constraint', () => {
  // The same forward-safety choice migration 0083 made for end_reason: a CHECK here
  // would force a superseding migration on the first later authorized governance
  // operation, which is exactly the future this slice must not decide. The v1
  // vocabulary is enforced in the sealed primitives, which are the only writers.
  assert.doesNotMatch(tableBlock(PROPOSALS), /CHECK\s*\(/iu, 'the proposal table carries no CHECK constraint at all');
  assert.doesNotMatch(deployableSql, /(?:ADD CONSTRAINT|CHECK)[^;]*operation_kind/iu, 'no CHECK freezes the set of future operations');
  assert.doesNotMatch(deployableSql, /(?:ADD CONSTRAINT|CHECK)[^;]*approval_rule/iu, 'and none freezes the set of future approval rules');
  assert.doesNotMatch(deployableSql, /CREATE TYPE/iu, 'and no enum type freezes it either');
  // But the v1 mapping IS enforced, exactly, in the only writer.
  for (const [operation, rule] of OPERATION_RULES) {
    assert.ok(CODE[CAPTURE_FN].includes(`WHEN '${operation}' THEN '${rule}'`),
      `capture maps ${operation} to exactly ${rule}`);
    assert.ok(CODE[RESOLVE_FN].includes(`WHEN '${operation}' THEN '${rule}'`),
      `and the resolver revalidates the same mapping for ${operation}`);
  }
  assert.match(CODE[CAPTURE_FN], /IF expected_rule IS NULL OR expected_rule <> p_approval_rule THEN/u,
    'an unsupported operation and a mismatched rule are both refused');
  // No Introduction operation belongs in this vocabulary.
  assert.doesNotMatch(executableSql, /INTRODUCTION_ENDED|INTRODUCTION_COMPLETED|INTRODUCTION_STARTED/u,
    'no Introduction transition is governed here');
});

test('the exact binding of CW2-02 section 31 is STRUCTURAL, not only procedural', () => {
  // (proposal_id, membership_snapshot_id) can only name a proposal that really
  // carries that captured topology, and (membership_snapshot_id,
  // membership_episode_id) can only name an episode really inside it. Together they
  // make an approval against a foreign snapshot, or by a non-member episode,
  // impossible however the row is produced.
  assert.match(tableBlock(PROPOSALS), /UNIQUE \(membership_snapshot_id\)/u,
    'one captured topology carries at most one proposal');
  assert.match(tableBlock(PROPOSALS), /UNIQUE \(id, membership_snapshot_id\)/u,
    'and exposes the composite binding an approval must reference');
  assert.match(tableBlock(APPROVALS),
    /FOREIGN KEY \(proposal_id, membership_snapshot_id\)\s*\n\s*REFERENCES public\.shared_world_governance_proposals \(id, membership_snapshot_id\) ON DELETE RESTRICT/u,
    'an approval can only bind the snapshot its proposal actually captured');
  assert.match(tableBlock(APPROVALS),
    /FOREIGN KEY \(membership_snapshot_id, membership_episode_id\)\s*\n\s*REFERENCES public\.shared_world_membership_snapshot_members \(membership_snapshot_id, membership_episode_id\) ON DELETE RESTRICT/u,
    'and only by an episode that is really inside that captured topology');
  assert.match(tableBlock(APPROVALS), /UNIQUE \(proposal_id, membership_episode_id\)/u,
    'one snapshot episode is worth exactly one effective approval, whatever id it arrives under');
  assert.match(tableBlock(SNAPSHOT_MEMBERS), /PRIMARY KEY \(membership_snapshot_id, membership_episode_id\)/u,
    'a captured topology can never name one episode twice');
  // A per-(World, human) or per-(proposal, human) key would survive a leave and a
  // rejoin, which is precisely what episode identity exists to prevent.
  for (const name of [SNAPSHOT_MEMBERS, APPROVALS]) {
    assert.doesNotMatch(tableBlock(name), /UNIQUE \([^)]*user_id[^)]*\)/u,
      `${name} must not key governance on a human id, which survives a leave and a rejoin`);
  }
});

test('the three primitives are executable by no application role, and 0084 grants EXECUTE to nobody', () => {
  assert.doesNotMatch(executableSql, /^\s*GRANT\s/imu, 'migration 0084 contains no GRANT statement of any kind');
  for (const [name, signature] of [
    [CAPTURE_FN, 'uuid, uuid, uuid, text, uuid, text, uuid'],
    [APPROVE_FN, 'uuid, uuid'],
    [RESOLVE_FN, 'uuid, text, uuid'],
  ]) {
    assert.ok(deployableSql.includes(`ALTER FUNCTION public.${name}(${signature}) OWNER TO postgres;`), `${name} is owned by postgres`);
    assert.ok(deployableSql.includes(`REVOKE ALL ON FUNCTION public.${name}(${signature}) FROM PUBLIC, anon, authenticated;`), `${name} is revoked from every client role`);
    assert.ok(deployableSql.includes(`REVOKE ALL ON FUNCTION public.${name}(${signature}) FROM service_role`), `${name} is revoked from service_role too`);
  }
  assert.equal((deployableSql.match(/LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/gu) ?? []).length, 3,
    'all three primitives are SECURITY DEFINER with an empty pinned search_path');
  for (const table of OWN_TABLES) {
    assert.ok(deployableSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`));
    assert.ok(deployableSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
  }
  assert.doesNotMatch(deployableSql, /CREATE POLICY/iu, 'zero RLS policies');
  assert.doesNotMatch(deployableSql, /CREATE TRIGGER/iu, 'no trigger anywhere');
  assert.doesNotMatch(deployableSql, /CREATE VIEW|CREATE MATERIALIZED VIEW/iu, 'and no read view slipping past the seal');
  // The deployment refuses itself if any role can execute any of the three.
  for (const phrase of [
    'I-04D: PUBLIC must not execute the governance foundation before the launch gate exists',
    'I-04D: % must not execute the governance foundation before the launch gate exists',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
  // The Launch Gate is absent, not implemented and not pretended satisfied.
  assert.doesNotMatch(executableSql, /launch_gate|feature_flag|LAUNCH_GATE_SNAPSHOT|entitlement|emergency_disable/iu,
    'I-04D neither implements the Launch Gate nor invents a stand-in for it');
  // Nothing here forbids the later reviewed consumer that will call these.
  assert.doesNotMatch(executableSql, /must never exist|may never be granted|no function named/iu,
    'no assertion forbids the add-member consumer or launch-gated wrapper a later slice will legitimately add');
});

test('exactly three functions, and none of them is a generic governance service', () => {
  const functions = [...executableSql.matchAll(/CREATE FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(functions, OWN_FUNCTIONS, 'exactly the capture, approval and resolution primitives, in that order');
  assert.doesNotMatch(deployableSql, /CREATE FUNCTION public\.\w*(?:add_member|remove_member|rejoin|end_world|close_world|invite|invitation|setting|entitlement|history_grant|launch)\w*/iu,
    '0084 creates no add-member, removal, rejoin, closure, invitation, settings, entitlement, history-grant or launch command');
  // Not a permission engine spanning the other domains.
  assert.doesNotMatch(deployableSql, /public_world|public_experience|replay|matching|publication|distribution/iu,
    'this is Shared World governance, not a permission engine across Public, Replay or Matching');
  assert.doesNotMatch(deployableSql, /message|conversation|qandeel_output/iu, 'and no Shared conversation runtime');
});

test('the caller supplies no topology, no approver set and no authority', () => {
  const signature = (name) => {
    const at = migration.indexOf(`CREATE FUNCTION public.${name}(`);
    const open = migration.indexOf('(', at);
    return migration.slice(open + 1, migration.indexOf(')', open)).split(',').map((part) => part.trim());
  };
  assert.deepEqual(signature(CAPTURE_FN), [
    'p_proposal_id uuid', 'p_membership_snapshot_id uuid', 'p_world_id uuid', 'p_operation_kind text',
    'p_proposed_payload_version_id uuid', 'p_approval_rule text', 'p_excluded_target_user_id uuid DEFAULT NULL',
  ], 'capture accepts two opaque identities, the World, the operation, its opaque payload version, the rule, and - for a removal only - the exact human');
  assert.deepEqual(signature(APPROVE_FN), ['p_approval_id uuid', 'p_proposal_id uuid'],
    'an approval accepts exactly two opaque identities: no actor, no episode, no instant');
  assert.deepEqual(signature(RESOLVE_FN), ['p_proposal_id uuid', 'p_expected_operation_kind text', 'p_expected_payload_version_id uuid'],
    'the resolver accepts the proposal and exactly what the caller expects it to be');
  // What no caller may ever supply.
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(signature(name).join(','), /initiator|proposer|p_actor|approver|member_ids|episode_ids|p_membership_episode|required_|p_captured|p_count|p_now|p_at\b/iu,
      `${name} accepts no topology, approver set, count, clock or initiator parameter`);
  }
  // The topology is DERIVED, by episode identity, from canonical current state.
  assert.match(CODE[CAPTURE_FN],
    /INSERT INTO public\.shared_world_membership_snapshot_members \(membership_snapshot_id, membership_episode_id\)\s*\n\s*SELECT p_membership_snapshot_id, e\.id\s*\n\s*FROM public\.shared_world_membership_episodes e\s*\n\s*WHERE e\.world_id = p_world_id AND e\.ended_at IS NULL;/u,
    'the captured set is exactly the open episodes of the exact World, read under the lock');
  assert.match(CODE[CAPTURE_FN], /GET DIAGNOSTICS captured_members = ROW_COUNT;/u,
    'and the member count is what was actually captured, never what a caller claimed');
});

test('INITIATION IS NOT AUTHORITY: capture records no actor and consults no session identity', () => {
  assert.doesNotMatch(BODY[CAPTURE_FN], /auth\.uid/u,
    'capture derives no initiator: who may open a proposal is a later reviewed consumer question');
  assert.doesNotMatch(BODY[RESOLVE_FN], /auth\.uid/u, 'and the resolver proves governance, not the identity of whoever asks');
  assert.doesNotMatch(tableBlock(PROPOSALS), /initiator|proposer|actor|owner|admin|created_by/iu,
    'and no proposal row records who opened it');
  assert.ok(selfAssertions.includes('I-04D: capture must not derive or record an initiator: initiation is not authority'));
  // The approving human, by contrast, is exactly the session subject.
  assert.match(CODE[APPROVE_FN], /u uuid := auth\.uid\(\)/u, 'the approver is derived, never supplied');
  assert.match(CODE[APPROVE_FN], /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_AUTHENTICATION_REQUIRED'/u,
    'a call with no human session identity fails closed, so QANDEEL and service execution can never manufacture a human approval');
  assert.match(CODE[APPROVE_FN], /WHERE e\.world_id = proposal\.world_id AND e\.user_id = u AND e\.ended_at IS NULL/u,
    "the approver episode is the caller's OWN current open episode of the exact World");
});

test('exact topology equality is a SET comparison in both directions, never a count and never a user id', () => {
  for (const name of [APPROVE_FN, RESOLVE_FN]) {
    // Current topology has nothing the captured topology lacks ...
    assert.match(CODE[name],
      /SELECT 1 FROM public\.shared_world_membership_episodes e\s*\n\s*WHERE e\.world_id = proposal\.world_id AND e\.ended_at IS NULL\s*\n\s*AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_snapshot_members m/u,
      `${name} refuses a current episode that the captured topology does not contain`);
    // ... and the captured topology has nothing current topology lacks.
    assert.match(CODE[name],
      /SELECT 1 FROM public\.shared_world_membership_snapshot_members m\s*\n\s*WHERE m\.membership_snapshot_id = proposal\.membership_snapshot_id\s*\n\s*AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_episodes e/u,
      `${name} refuses a captured episode that is no longer currently open`);
    assert.match(CODE[name], /RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE'/u, `${name} calls a topology mismatch stale governance`);
    // Neither substitute is present.
    assert.doesNotMatch(CODE[name], /count\(\*\)[^;]*shared_world_membership_snapshot_members[^;]*=[^;]*count\(\*\)/u,
      `${name} must not compare the two topologies by size`);
    assert.doesNotMatch(CODE[name], /m\.membership_episode_id[^;\n]*=[^;\n]*e\.user_id|e\.user_id[^;\n]*=[^;\n]*m\./u,
      `${name} must not compare the two topologies by human identity, which survives a leave and a rejoin`);
  }
  for (const phrase of [
    'I-04D: % must compare the captured topology to current topology in BOTH directions',
    'I-04D: % must compare EPISODE identity, never a count and never a user id',
    'I-04D: % must not substitute a count or a user-id comparison for exact topology equality',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
  // A stale proposal is never rebound to current topology: nothing rewrites a
  // captured snapshot, its members, or a proposal's snapshot reference.
  assert.doesNotMatch(executableSql, /UPDATE public\.shared_world_membership_snapshots|UPDATE public\.shared_world_membership_snapshot_members|UPDATE public\.shared_world_governance_proposals/u,
    'a captured topology and the proposal bound to it are immutable: neither is ever re-pointed at current state');
  assert.doesNotMatch(executableSql, /UPDATE public\.shared_world_governance_approvals/u,
    'and an approval is never mutated: there is no UPDATE path at all');
});

test('the removal exclusion: the target stays inside the topology and out of the required set', () => {
  assert.match(CODE[CAPTURE_FN], /\(p_operation_kind = 'REMOVE_MEMBER'\) <> \(p_excluded_target_user_id IS NOT NULL\)/u,
    'the exclusion belongs to REMOVE_MEMBER and to nothing else, in both directions');
  // The supplied human is resolved to their exact CURRENT open episode, under the
  // lock, and must resolve to exactly one.
  assert.match(CODE[CAPTURE_FN],
    /WHERE probe\.world_id = p_world_id AND probe\.user_id = p_excluded_target_user_id\s*\n\s*AND probe\.ended_at IS NULL\) <> 1 THEN/u,
    'the removal target must resolve to exactly one current open episode');
  assert.match(CODE[CAPTURE_FN],
    /SELECT e\.id INTO excluded_episode\s*\n\s*FROM public\.shared_world_membership_episodes e\s*\n\s*WHERE e\.world_id = p_world_id AND e\.user_id = p_excluded_target_user_id AND e\.ended_at IS NULL;/u,
    'and it is the episode - never a caller-supplied episode id - that is stored');
  // The target is INSIDE the captured topology: the capture inserts every open
  // episode without excluding anybody, and then asserts the target is among them.
  assert.doesNotMatch(CODE[CAPTURE_FN], /INSERT INTO public\.shared_world_membership_snapshot_members[\s\S]{0,400}excluded_episode/u,
    'the captured topology is not filtered by the exclusion: a removal target WAS a current member');
  assert.match(CODE[CAPTURE_FN],
    /IF excluded_episode IS NOT NULL AND NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.shared_world_membership_snapshot_members m/u,
    'and the capture fails closed if the target is somehow not inside it');
  // Only the REQUIRED set excludes them - in the count, in the approval refusal and
  // in the resolver's derivation.
  assert.match(CODE[CAPTURE_FN], /required := members - \(CASE WHEN excluded_episode IS NULL THEN 0 ELSE 1 END\);/u,
    'the required set is the captured topology minus the exclusion');
  assert.match(CODE[APPROVE_FN], /proposal\.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode/u,
    'the excluded target can never approve their own removal');
  assert.match(CODE[RESOLVE_FN], /m\.membership_episode_id IS DISTINCT FROM proposal\.excluded_membership_episode_id/u,
    'and the resolver derives the required set from the rule and the exclusion rather than storing it');
  assert.ok(selfAssertions.includes('I-04D: the excluded removal target must never be able to approve their own removal'));
});

test('empty-set unanimity is never approval, at every point it could be claimed', () => {
  // Zero current humans cannot open ordinary governance at all.
  assert.match(CODE[CAPTURE_FN], /IF members = 0 THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE'/u,
    'a proposal cannot be captured when no current human remains');
  // A sole current human cannot be removed through a vacuously satisfied rule.
  assert.match(CODE[CAPTURE_FN], /IF required = 0 THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE'/u,
    'and a removal may never be captured with an empty required approval set');
  // And the resolver refuses a required count of zero rather than calling it satisfied.
  assert.match(CODE[RESOLVE_FN], /IF required = 0 THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE'/u,
    'a required approval count of zero is never satisfied governance');
  for (const phrase of [
    'I-04D: a proposal must be refused when no current human remains: empty-set unanimity is never approval',
    'I-04D: a removal may never be captured with an empty required approval set',
    'I-04D: a required approval count of zero is never satisfied governance',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
});

test('satisfaction is a CURRENT proof, never a stored permission and never a reusable token', () => {
  assert.doesNotMatch(CODE[RESOLVE_FN], /INSERT INTO|UPDATE public\./u, 'the resolver persists nothing at all');
  assert.doesNotMatch(executableSql, /\bapproved\s+boolean|is_approved|satisfied\s+boolean|approval_state/iu,
    'no permanent approved flag is stored anywhere');
  // The caller must name the exact operation AND the exact payload version it is
  // about to commit, and a mismatch is never a successful proof of something else.
  assert.match(CODE[RESOLVE_FN],
    /IF proposal\.operation_kind <> p_expected_operation_kind\s*\n\s*OR proposal\.proposed_payload_version_id <> p_expected_payload_version_id THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE'/u,
    'approvals for one operation or one payload version can never authorize another');
  // Every required episode must carry an approval of THIS exact proposal under THIS
  // exact captured topology.
  assert.match(CODE[RESOLVE_FN],
    /NOT EXISTS \(SELECT 1 FROM public\.shared_world_governance_approvals a\s*\n\s*WHERE a\.proposal_id = proposal\.id\s*\n\s*AND a\.membership_snapshot_id = proposal\.membership_snapshot_id\s*\n\s*AND a\.membership_episode_id = m\.membership_episode_id\)/u,
    'every required snapshot episode is checked individually, not counted in aggregate alone');
  assert.match(CODE[RESOLVE_FN], /IF recorded <> required THEN/u, 'and the totals must agree exactly');
  assert.match(CODE[RESOLVE_FN], /RETURN QUERY SELECT 'SATISFIED'::text/u, 'success is the only row the resolver ever returns');
  assert.equal((CODE[RESOLVE_FN].match(/RETURN QUERY/gu) ?? []).length, 1,
    'there is exactly one success path: every stale or incomplete case raises instead of returning a weaker outcome');
});

test('the canonical lock order is the World row FIRST, in all three primitives', () => {
  const capture = CODE[CAPTURE_FN];
  const worldLock = capture.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
  const topology = capture.indexOf('WHERE e.world_id = p_world_id AND e.ended_at IS NULL');
  const snapshot = capture.indexOf('INSERT INTO public.shared_world_membership_snapshots');
  const members = capture.indexOf('INSERT INTO public.shared_world_membership_snapshot_members');
  const proposal = capture.indexOf('INSERT INTO public.shared_world_governance_proposals');
  assert.ok(worldLock > 0 && topology > worldLock && snapshot > topology && members > snapshot && proposal > members,
    'capture: the World row, then current topology, then the snapshot, its members and the proposal');
  assert.equal((capture.match(/FOR UPDATE/gu) ?? []).length, 1, 'capture takes exactly one row lock');

  for (const name of [APPROVE_FN, RESOLVE_FN]) {
    const body = CODE[name];
    const preRead = body.indexOf('SELECT pr.world_id INTO target_world');
    const worldAt = body.indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
    const proposalAt = body.indexOf('WHERE pr.id = p_proposal_id FOR UPDATE');
    assert.ok(preRead > 0 && worldAt > preRead && proposalAt > worldAt,
      `${name}: only enough of the proposal is pre-read to discover the World, and the World is locked before the proposal`);
    assert.equal((body.match(/FOR UPDATE/gu) ?? []).length, 2, `${name} takes exactly two row locks`);
    assert.doesNotMatch(body.slice(0, worldAt), /FOR UPDATE/u, `${name} never locks the proposal before the World`);
  }
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(CODE[name], /pg_advisory|LOCK TABLE/iu, `${name} uses no advisory key and no table lock`);
  }
  // The World row is what the frozen I-03C consent commands and the frozen I-04C
  // leave also take first, which is what makes governance and topology serialize.
  assert.match(migration, /the frozen I-03C consent commands and the frozen I-04C leave already take/u,
    'the migration states why the World row must be first');
  for (const phrase of [
    'I-04D: capture must lock the exact World row, then read current topology, before any write',
    'I-04D: an approval must lock the exact World row, then the exact proposal, before any write',
    'I-04D: the resolver must lock the exact World row before the exact proposal',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
});

test('ONE database-owned instant per committed transaction, and no client clock', () => {
  assert.equal((CODE[CAPTURE_FN].match(/capture_instant := /gu) ?? []).length, 1, 'the capture instant is read exactly once');
  assert.match(CODE[CAPTURE_FN], /capture_instant := clock_timestamp\(\);/u, 'from the database clock');
  assert.equal((CODE[APPROVE_FN].match(/approval_instant := /gu) ?? []).length, 1, 'and so is the approval instant');
  assert.match(CODE[APPROVE_FN], /approval_instant := clock_timestamp\(\);/u);
  // The snapshot's captured_at and the proposal's created_at are the SAME instant.
  assert.match(CODE[CAPTURE_FN], /VALUES \(p_membership_snapshot_id, p_world_id, capture_instant\);/u);
  assert.match(CODE[CAPTURE_FN], /p_proposed_payload_version_id, p_approval_rule, excluded_episode, capture_instant\);/u);
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(CODE[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${name} never reads a second clock`);
  }
  assert.doesNotMatch(deployableSql, /DEFAULT CURRENT_TIMESTAMP|DEFAULT now\(\)/iu,
    'and no column defaults a governance instant behind the primitives that own it');
});

test('durable idempotency: three passes, each answering from immutable history', () => {
  // A retry is answered before the lock, under the lock, and inside the uniqueness
  // conflict that two commands sharing an id across different Worlds have as their
  // only serialization point.
  assert.equal(
    (CODE[CAPTURE_FN].match(/RETURN QUERY SELECT 'CAPTURED'::text, committed\.id, committed\.membership_snapshot_id, committed\.world_id,/gu) ?? []).length,
    3, 'three capture idempotency passes, each returning what the proposal committed');
  assert.equal(
    (CODE[APPROVE_FN].match(/RETURN QUERY SELECT 'APPROVED'::text, committed\.id, committed\.proposal_id,/gu) ?? []).length,
    3, 'three approval idempotency passes, each returning what the command committed');
  assert.equal((CODE[CAPTURE_FN].match(/AND s\.captured_at = committed\.created_at/gu) ?? []).length, 3,
    'and each failing closed on a captured topology that stopped being coherent');
  // A historical answer must never start differing because topology moved on.
  assert.doesNotMatch(CODE[CAPTURE_FN], /RETURN QUERY SELECT[^;]*(?:world\.|captured_members)/u,
    'a committed capture result carries no current World state and no live count');
  assert.doesNotMatch(CODE[APPROVE_FN], /RETURN QUERY SELECT[^;]*world\./u,
    'and a committed approval result carries no current World state');
  // Both durable identities are inspected before any lock, and neither is re-bound.
  assert.match(CODE[CAPTURE_FN], /IF EXISTS \(SELECT 1 FROM public\.shared_world_membership_snapshots s WHERE s\.id = p_membership_snapshot_id\) THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_ID_CONFLICT'/u,
    'a captured topology id is never re-bound to a second proposal or to current topology');
  assert.equal((CODE[CAPTURE_FN].match(/WHERE s\.id = p_membership_snapshot_id\) THEN/gu) ?? []).length, 2,
    'and that is checked both before the lock and under it');
});

test('the bounded refusal classes are exactly the ones this slice owns, and none enumerates', () => {
  const raised = [...new Set(OWN_FUNCTIONS.flatMap((name) =>
    [...CODE[name].matchAll(/RAISE EXCEPTION '([A-Z_]+)'/gu)].map((match) => match[1])))].sort();
  assert.deepEqual(raised, [
    'SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE',
    'SHARED_WORLD_GOVERNANCE_AUTHENTICATION_REQUIRED',
    'SHARED_WORLD_GOVERNANCE_COMMAND_INVALID',
    'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE',
    'SHARED_WORLD_GOVERNANCE_ID_CONFLICT',
    'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE',
    'SHARED_WORLD_GOVERNANCE_STALE',
  ], 'seven bounded classes and no more');
  // The unavailable class answers every distinguishable cause, so no future wrapper
  // can tell a non-member from an absent World from an absent proposal from a wrong
  // state - and a removal target learns nothing about the topology either.
  assert.ok((CODE[APPROVE_FN].match(/SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/gu) ?? []).length >= 4,
    'the same bounded class answers the missing proposal, the missing World, the non-member and the excluded target');
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(CODE[name], /RAISE EXCEPTION[^;]*(?:USING MESSAGE|%'\s*,\s*(?:u|proposal|world|members|required))/u,
      `${name} interpolates no human, World, proposal or topology fact into a refusal`);
  }
});

test('no Personal context, no Standing Context state, and no Product mutation of any kind', () => {
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(BODY[name], /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
      `${name} names no Personal, Standing Context or Matching state anywhere in its stored body, comments included`);
    assert.doesNotMatch(BODY[name], /DELETE FROM|TRUNCATE/iu, `${name} deletes nothing`);
    assert.doesNotMatch(BODY[name], /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u, `${name} never creates, closes or mutates a World`);
    assert.doesNotMatch(BODY[name], /UPDATE public\.shared_world_membership_episodes|INSERT INTO public\.shared_world_membership_episodes/u,
      `${name} never opens or closes a membership episode`);
    assert.doesNotMatch(BODY[name], /READ_ONLY_CLOSED|closed_at|birth_basis|VOLUNTARY_LEAVE|MEMBER_JOINED|MEMBER_LEFT|WORLD_ENDED/u,
      `${name} writes no lifecycle, closure or membership-event literal it does not own`);
  }
  // Governance never widens a Standing Context Grant, and no trigger could do it.
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'no trigger couples governance to membership or consent state');
  assert.ok(selfAssertions.includes('I-04D: no trigger may couple governance to membership or Standing Context state on %'));
  assert.ok(selfAssertions.includes('I-04D: % must not read Personal context or touch Standing Context state'));
  assert.ok(selfAssertions.includes('I-04D: % must not open or close a membership episode'));
  assert.ok(selfAssertions.includes('I-04D: % must not create, close or mutate a Shared World'));
});

test('ordinary governance is ACTIVE / STANDARD only, and no Introduction transition is invented', () => {
  for (const name of [CAPTURE_FN, RESOLVE_FN]) {
    assert.match(CODE[name], /IF world\.lifecycle <> 'ACTIVE' OR world\.phase <> 'STANDARD' THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE'/u,
      `${name} refuses every state that is not ACTIVE / STANDARD`);
  }
  // The approval primitive deliberately does not repeat the check, and the
  // migration says so rather than leaving the asymmetry unexplained.
  assert.match(migration, /The approval primitive deliberately does not repeat the check/u,
    'the asymmetry is stated, not accidental');
  assert.ok(selfAssertions.includes("IF fn_name <> approve_fn AND p.prosrc !~ 'world\\.lifecycle <> ''ACTIVE'' OR world\\.phase <> ''STANDARD'''"),
    'and the deployment asserts it for exactly the two primitives that must carry it');
  assert.doesNotMatch(executableSql, /MUTUAL_MATCH|introduction_record/iu, '0084 contains no Matching or Introduction substrate');
});

test('every prosrc-level self-assertion the migration makes is true of the bodies it will actually store', () => {
  // pg_proc.prosrc INCLUDES the function's comments, so the migration's own checks
  // run against comments as well as code. This mirrors each of them locally, so a
  // prose slip fails here instead of failing a CI deployment.
  const occurrences = (text, needle) => text.split(needle).length - 1;
  for (const name of OWN_FUNCTIONS) {
    const stored = BODY[name];
    assert.doesNotMatch(stored, /pg_advisory|LOCK TABLE/iu);
    assert.doesNotMatch(stored, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u);
  }
  const capture = BODY[CAPTURE_FN];
  assert.doesNotMatch(capture, /auth\.uid/u);
  assert.equal(occurrences(capture, 'FOR UPDATE'), 1);
  assert.equal(occurrences(capture, 'capture_instant := '), 1);
  assert.equal(occurrences(capture, 'AND s.captured_at = committed.created_at'), 3);
  assert.equal(occurrences(capture,
    "RETURN QUERY SELECT 'CAPTURED'::text, committed.id, committed.membership_snapshot_id, committed.world_id,"), 3);
  assert.doesNotMatch(capture, /RETURN QUERY SELECT[^;]*(world\.|e\.ended_at|captured_members)/u);
  assert.match(capture, /world\.lifecycle <> 'ACTIVE' OR world\.phase <> 'STANDARD'/u);
  assert.ok(capture.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE') > 0);
  assert.ok(capture.indexOf('WHERE e.world_id = p_world_id AND e.ended_at IS NULL')
    > capture.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE'),
    'the FIRST occurrence of the current-topology predicate really is under the World lock');
  for (const [operation, rule] of OPERATION_RULES) {
    assert.ok(capture.includes(`WHEN '${operation}' THEN '${rule}'`));
  }

  const approve = BODY[APPROVE_FN];
  assert.match(approve, /u uuid := auth\.uid\(\)/u);
  assert.equal(occurrences(approve, 'FOR UPDATE'), 2);
  assert.equal(occurrences(approve, 'approval_instant := '), 1);
  assert.equal(occurrences(approve, "RETURN QUERY SELECT 'APPROVED'::text, committed.id, committed.proposal_id,"), 3);
  assert.doesNotMatch(approve, /world\.lifecycle <> 'ACTIVE'/u, 'the approval primitive carries no lifecycle check, exactly as asserted');
  assert.ok(approve.indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE') > 0);
  assert.ok(approve.indexOf('WHERE pr.id = p_proposal_id FOR UPDATE')
    > approve.indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE'));

  const resolve = BODY[RESOLVE_FN];
  assert.doesNotMatch(resolve, /auth\.uid/u);
  assert.doesNotMatch(resolve, /INSERT INTO|UPDATE public\./u);
  assert.equal(occurrences(resolve, 'FOR UPDATE'), 2);
  assert.match(resolve, /world\.lifecycle <> 'ACTIVE' OR world\.phase <> 'STANDARD'/u);

  // Both halves of the exact both-directions comparison, exactly as the migration
  // requires them, in exactly the two primitives that consult current topology.
  for (const name of [APPROVE_FN, RESOLVE_FN]) {
    assert.ok(BODY[name].includes('AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_snapshot_members m'));
    assert.ok(BODY[name].includes('AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e'));
    assert.match(BODY[name], /AND m\.membership_episode_id = e\.id/u);
    assert.match(BODY[name], /WHERE e\.id = m\.membership_episode_id/u);
  }
});

test('every RAISE in the migration has as many % placeholders as arguments', () => {
  // A RAISE carrying an argument with no placeholder is a COMPILE-time error ("too
  // many parameters specified for RAISE"), so one slip anywhere stops the whole
  // migration from deploying. Caught here rather than in CI.
  let checked = 0;
  for (const match of migration.matchAll(/RAISE\s+EXCEPTION\s+'((?:[^']|'')*)'((?:\s*,\s*[A-Za-z_][\w.]*)*)/gu)) {
    checked += 1;
    const placeholders = (match[1].match(/%/gu) ?? []).length;
    const args = match[2].trim() === '' ? 0 : match[2].split(',').filter((part) => part.trim() !== '').length;
    assert.equal(placeholders, args, `RAISE "${match[1].slice(0, 60)}" has ${placeholders} placeholders and ${args} arguments`);
  }
  assert.ok(checked >= 60, `every RAISE was audited, found ${checked}`);
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0084.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0084/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0084\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  // Flow-mapping step names must carry no comma (the repository's CI convention).
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.doesNotMatch(workflow, /Mobile CI/u, 'I-04D adds no Mobile CI step');
  assert.match(readme, /0084_shared_world_governance_approval_foundation_v1\.sql/u, 'the README records migration 0084');
  assert.match(readme, /ALL_CURRENT_MEMBERS_EXCEPT_TARGET/u);
  assert.match(readme, new RegExp(`npm run ${OWN_SCRIPT}`, 'u'));
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  // This verifier runs against a FULLY migrated database, so any absence census or
  // exact-count assertion in it would be a ceiling on the whole roadmap rather than
  // a fact about migration 0084 - and the first thing it would reject is the
  // add-member consumer this very foundation exists to serve.
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES/u,
    'no live future-table absence census: what 0084 did not create is proven from 0084 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*foreignKeys\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraints\.length/u, 'and neither are constraints');
  // Each foreign key 0084 owns is pinned by name, local columns, parent and
  // restrictive deletion - which is strictly stronger than a count.
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  for (const [name, columns, parent, parentColumns] of [
    ['shared_world_membership_snapshots_world_fk', 'world_id', 'shared_worlds', 'id'],
    ['shared_world_membership_snapshot_members_snapshot_fk', 'membership_snapshot_id', 'shared_world_membership_snapshots', 'id'],
    ['shared_world_membership_snapshot_members_episode_fk', 'membership_episode_id', 'shared_world_membership_episodes', 'id'],
    ['shared_world_governance_proposals_world_fk', 'world_id', 'shared_worlds', 'id'],
    ['shared_world_governance_proposals_snapshot_fk', 'membership_snapshot_id', 'shared_world_membership_snapshots', 'id'],
    ['shared_world_governance_proposals_excluded_episode_fk', 'excluded_membership_episode_id', 'shared_world_membership_episodes', 'id'],
    ['shared_world_governance_approvals_proposal_fk', 'proposal_id, membership_snapshot_id', 'shared_world_governance_proposals', 'id, membership_snapshot_id'],
    ['shared_world_governance_approvals_snapshot_member_fk', 'membership_snapshot_id, membership_episode_id', 'shared_world_membership_snapshot_members', 'membership_snapshot_id, membership_episode_id'],
  ]) {
    assert.ok(verifier.includes(`${name}: 'FOREIGN KEY (${columns}) REFERENCES ${parent}(${parentColumns}) ON DELETE RESTRICT'`),
      `${name} is pinned exactly: local columns, parent and restrictive deletion`);
    assert.match(migration, new RegExp(`CONSTRAINT ${name}\\s*\\n?\\s*FOREIGN KEY \\(${columns}\\)\\s*\\n?\\s*REFERENCES public\\.${parent} \\(${parentColumns}\\) ON DELETE RESTRICT`, 'u'),
      `and migration 0084 really declares ${name} that way`);
  }
  // Forward safety is proven by the real-PostgreSQL verifier itself, not only by
  // the static mirror below.
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  for (const authorized of ['_invitations (id uuid PRIMARY KEY)', 'ADD COLUMN', 'ADD CONSTRAINT', 'CREATE INDEX']) {
    assert.ok(verifier.includes(authorized), `the probe performs a later authorized ${authorized}`);
  }
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires the real regressions to still be refused');

  // REVIEW FIX-01A / FIX-01B. The two ceiling shapes the independent review found,
  // kept out by detector rather than only by having been deleted once.
  //
  // Scoped to THIS verifier deliberately. A predecessor verifier carrying the same
  // shape is that slice's record to repair, and silently re-owning it here would be
  // the "repairing a predecessor's closure record is a governance task" mistake
  // AGENTS.md section 10 names.
  assert.doesNotMatch(verifier, /FROM pg_trigger/u,
    'no live trigger census: that 0084 installs no trigger is proven from 0084 own text, and a later reviewed audit trigger is not an 0084 regression');
  assert.doesNotMatch(verifier, /assert\.doesNotMatch\(column,/u,
    'no migration-wide column NAME filter over the live column list: 0084 owns the columns it created, not the vocabulary of every column that follows');
  assert.doesNotMatch(verifier, /\['json', 'jsonb', 'ARRAY'\]\.includes\(type\)/u,
    'and no migration-wide column TYPE filter over it either');
  // What replaced them: the owned columns pinned by name, type, nullability AND the
  // absence of a default, which is strictly stronger than the filter it removed.
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u,
    'the owned-column proof reads the default too');
  for (const owned of [
    "['captured_at', 'timestamp with time zone', 'NO', null]",
    "['excluded_membership_episode_id', 'uuid', 'YES', null]",
    "['proposed_payload_version_id', 'uuid', 'NO', null]",
    "['membership_episode_id', 'uuid', 'NO', null]",
  ]) assert.ok(verifier.includes(owned), `an 0084-owned column is pinned exactly: ${owned}`);
  // And the durable rule the task really froze is still live, on the two tables it is
  // about rather than as a vocabulary sweep.
  assert.match(verifier, /c\.column_name IN \('user_id','actor_user_id'\)\) AS duplicated/u,
    'the no-duplicated-human-id rule stays a live invariant');

  // REVIEW FIX-01C. The probe must actually exercise both ceiling shapes, or their
  // removal is unproven.
  for (const [shape, needle] of [
    ['a later column whose name the old filter banned', '_consumer_metadata jsonb'],
    ['a later column whose name the old filter banned', '_reviewer_scope text'],
    ['a later audit trigger on a table 0084 owns', `CREATE TRIGGER \${probe}_audit AFTER INSERT ON \${APPROVALS}`],
    ['a later audit trigger on the evolvable membership table', `CREATE TRIGGER \${probe}_episode_audit AFTER UPDATE ON \${EPISODES}`],
  ]) assert.ok(verifier.includes(needle), `the probe proves historical 0084 survives ${shape}: ${needle}`);
  // REVIEW FIX-01D. Narrowing the column proof did not weaken it: every way an OWNED
  // column can be damaged is planted and must still be refused.
  for (const owned of [
    'an 0084-owned column is dropped',
    'an 0084-owned NOT NULL column becomes nullable',
    'an 0084-owned column gains a default the primitives never write',
    'an 0084-owned column changes type',
    'the opaque payload version stops being an opaque uuid',
  ]) assert.ok(verifier.includes(owned), `the probe still refuses: ${owned}`);
});

test('that 0084 ITSELF installs no trigger, no coupling and no generic engine is proven from its own text', () => {
  // REVIEW FIX-01B. This is the home of the claim the live trigger census used to
  // make. It is a statement about migration 0084, so it belongs where 0084's text is,
  // and it stays true forever no matter what a later reviewed slice installs.
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'migration 0084 creates no trigger at all');
  assert.doesNotMatch(deployableSql, /RETURNS trigger/iu, 'and no trigger function for one to call');
  assert.doesNotMatch(deployableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger either');
  // No coupling INTO membership, lifecycle or Standing Context state, in either
  // direction, by any statement 0084 deploys.
  for (const coupled of [
    'UPDATE public.shared_world_membership_episodes', 'INSERT INTO public.shared_world_membership_episodes',
    'UPDATE public.shared_worlds', 'INSERT INTO public.shared_worlds',
    'UPDATE public.shared_world_standing_context_grants',
    'INSERT INTO public.shared_world_standing_context_grant_audience',
    'DELETE FROM public.shared_world_standing_context_grant_audience',
    'INSERT INTO public.shared_world_standing_context_consent_events',
  ]) assert.ok(!deployableSql.includes(coupled), `0084 never performs: ${coupled}`);
  // And the deployment itself refuses to install without those guarantees.
  for (const phrase of [
    'I-04D: no trigger may exist on %',
    'I-04D: no trigger may couple governance to membership or Standing Context state on %',
    'I-04D: % must not open or close a membership episode',
    'I-04D: % must not create, close or mutate a Shared World',
    'I-04D: % must not read Personal context or touch Standing Context state',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0084 refuses to deploy without: ${phrase}`);

  // REVIEW FIX-01A. Likewise the "no generic metadata / payload / permission engine"
  // claim: it is about the four tables 0084 CREATED, read out of 0084's own CREATE
  // TABLE blocks, and it does not reach a single column a later slice appends.
  for (const name of OWN_TABLES) {
    const block = tableBlock(name);
    assert.doesNotMatch(block, /\b(?:json|jsonb)\b|\[\]/iu, `${name} as 0084 created it stores no JSON and no array`);
    assert.doesNotMatch(block, /(owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|vote|weight|token|status)/iu,
      `${name} as 0084 created it is no permission store and carries no superior authority`);
  }
  // The one opaque identity, pinned positively rather than by what it is not.
  assert.match(tableBlock(PROPOSALS), /proposed_payload_version_id uuid NOT NULL,/u,
    'the proposed payload version is an opaque uuid: I-04D owns no future payload schema');
  assert.ok(selfAssertions.includes('I-04D: governance creates no owner, admin or initiator, stores no payload blob and is not a permission engine'));
  assert.ok(selfAssertions.includes('I-04D: the proposed payload version must be an opaque non-null uuid identity'));
});

test('no database contract - this one included - carries a migration census, so 0085 can exist without editing one', () => {
  for (const file of readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.mjs'))) {
    const text = read(`./${file}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${file} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${file} enumerates no exhaustive successor list`);
  }
});

// ---------------------------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0084 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  const weakenings = [
    ['grants authenticated EXECUTE', (text) => text.replace(
      `REVOKE ALL ON FUNCTION public.${APPROVE_FN}(uuid, uuid) FROM PUBLIC, anon, authenticated;`,
      `GRANT EXECUTE ON FUNCTION public.${APPROVE_FN}(uuid, uuid) TO authenticated;`)],
    ['lets the caller supply the captured topology', (text) => text.replace(
      'p_approval_rule text,\n  p_excluded_target_user_id uuid DEFAULT NULL',
      'p_approval_rule text,\n  p_membership_episode_ids uuid[] DEFAULT NULL,\n  p_excluded_target_user_id uuid DEFAULT NULL')],
    ['lets the caller supply the approving human', (text) => text.replace(
      'p_approval_id uuid, p_proposal_id uuid\n)', 'p_approval_id uuid, p_proposal_id uuid, p_actor_user_id uuid\n)')],
    ['captures topology by HUMAN identity instead of episode identity', (text) => text.replace(
      'SELECT p_membership_snapshot_id, e.id\n      FROM public.shared_world_membership_episodes e\n     WHERE e.world_id = p_world_id AND e.ended_at IS NULL;',
      'SELECT p_membership_snapshot_id, e.user_id\n      FROM public.shared_world_membership_episodes e\n     WHERE e.world_id = p_world_id AND e.ended_at IS NULL;')],
    ['compares topology by COUNT instead of by exact set', (text) => text.replace(
      /  IF EXISTS \(\n       SELECT 1 FROM public\.shared_world_membership_episodes e\n        WHERE e\.world_id = proposal\.world_id AND e\.ended_at IS NULL\n          AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_snapshot_members m\n[\s\S]*?RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';\n  END IF;\n\n  -- The approver/u,
      "  IF (SELECT count(*) FROM public.shared_world_membership_episodes e\n       WHERE e.world_id = proposal.world_id AND e.ended_at IS NULL)\n     <> (SELECT count(*) FROM public.shared_world_membership_snapshot_members m\n          WHERE m.membership_snapshot_id = proposal.membership_snapshot_id) THEN\n"
      + "    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';\n  END IF;\n\n  -- The approver")],
    ['compares only one direction of the topology', (text) => text.replace(
      '     OR EXISTS (\n       SELECT 1 FROM public.shared_world_membership_snapshot_members m\n        WHERE m.membership_snapshot_id = proposal.membership_snapshot_id\n          AND NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e\n                           WHERE e.id = m.membership_episode_id\n                             AND e.world_id = proposal.world_id AND e.ended_at IS NULL)) THEN\n    RAISE EXCEPTION \'SHARED_WORLD_GOVERNANCE_STALE\' USING ERRCODE=\'40001\';\n  END IF;\n\n  -- The approver',
      "     THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';\n  END IF;\n\n  -- The approver")],
    ['lets the excluded removal target approve their own removal', (text) => text.replace(
      '     OR proposal.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode THEN',
      '     THEN')],
    ['excludes the removal target from the captured topology as well', (text) => text.replace(
      'SELECT p_membership_snapshot_id, e.id\n      FROM public.shared_world_membership_episodes e\n     WHERE e.world_id = p_world_id AND e.ended_at IS NULL;',
      'SELECT p_membership_snapshot_id, e.id\n      FROM public.shared_world_membership_episodes e\n     WHERE e.world_id = p_world_id AND e.ended_at IS NULL\n       AND e.id IS DISTINCT FROM excluded_episode;')],
    ['captures a proposal with zero current humans', (text) => text.replace(
      "  IF members = 0 THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;", '')],
    ['captures a removal with an empty required set', (text) => text.replace(
      "  IF required = 0 THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;", '')],
    ['calls an empty required set satisfied', (text) => text.replace(
      "  IF required = 0 THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';\n  END IF;", '')],
    ['accepts any payload version once the operation matches', (text) => text.replace(
      '  IF proposal.operation_kind <> p_expected_operation_kind\n     OR proposal.proposed_payload_version_id <> p_expected_payload_version_id THEN',
      '  IF proposal.operation_kind <> p_expected_operation_kind THEN')],
    ['accepts a partial approval set', (text) => text.replace(
      '  IF recorded <> required THEN', '  IF recorded > required THEN')],
    ['maps a removal to plain unanimity', (text) => text.replace(
      "WHEN 'REMOVE_MEMBER' THEN 'ALL_CURRENT_MEMBERS_EXCEPT_TARGET'\n                     WHEN 'REJOIN_MEMBER' THEN 'ALL_CURRENT_MEMBERS'\n                     WHEN 'WORLD_SETTINGS_CHANGE' THEN 'ALL_CURRENT_MEMBERS'\n                     WHEN 'END_WORLD' THEN 'ALL_CURRENT_MEMBERS'\n                   END;\n  IF expected_rule IS NULL OR expected_rule <> p_approval_rule THEN",
      "WHEN 'REMOVE_MEMBER' THEN 'ALL_CURRENT_MEMBERS'\n                     WHEN 'REJOIN_MEMBER' THEN 'ALL_CURRENT_MEMBERS'\n                     WHEN 'WORLD_SETTINGS_CHANGE' THEN 'ALL_CURRENT_MEMBERS'\n                     WHEN 'END_WORLD' THEN 'ALL_CURRENT_MEMBERS'\n                   END;\n  IF expected_rule IS NULL OR expected_rule <> p_approval_rule THEN")],
    ['freezes the future governance vocabulary in a CHECK constraint', (text) => text.replace(
      '    operation_kind text NOT NULL,',
      "    operation_kind text NOT NULL CHECK (operation_kind IN ('ADD_MEMBER','REMOVE_MEMBER','REJOIN_MEMBER','WORLD_SETTINGS_CHANGE','END_WORLD')),")],
    ['stores a JSON governance payload', (text) => text.replace(
      '    proposed_payload_version_id uuid NOT NULL,', '    proposed_payload_version_id uuid NOT NULL,\n    proposed_payload jsonb NOT NULL,')],
    ['duplicates the approver human beside the episode', (text) => text.replace(
      '    membership_episode_id uuid NOT NULL,\n    approved_at timestamptz NOT NULL,',
      '    membership_episode_id uuid NOT NULL,\n    actor_user_id uuid NOT NULL,\n    approved_at timestamptz NOT NULL,')],
    ['records an initiator on the proposal', (text) => text.replace(
      '    created_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_governance_proposals_pk',
      '    created_at timestamptz NOT NULL,\n    initiator_user_id uuid NOT NULL,\n    CONSTRAINT shared_world_governance_proposals_pk')],
    ['makes capture derive an initiator', (text) => text.replace(
      'DECLARE\n  committed public.shared_world_governance_proposals;',
      'DECLARE\n  initiator uuid := auth.uid();\n  committed public.shared_world_governance_proposals;')],
    ['drops the one-effective-approval rule', (text) => text.replace(
      '    CONSTRAINT shared_world_governance_approvals_one_per_episode_key UNIQUE (proposal_id, membership_episode_id),\n', '')],
    ['drops the proposal-to-snapshot binding', (text) => text.replace(
      '    CONSTRAINT shared_world_governance_approvals_proposal_fk\n        FOREIGN KEY (proposal_id, membership_snapshot_id)\n        REFERENCES public.shared_world_governance_proposals (id, membership_snapshot_id) ON DELETE RESTRICT,',
      '    CONSTRAINT shared_world_governance_approvals_proposal_fk\n        FOREIGN KEY (proposal_id) REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,')],
    ['drops the snapshot-membership binding', (text) => text.replace(
      '    CONSTRAINT shared_world_governance_approvals_snapshot_member_fk\n        FOREIGN KEY (membership_snapshot_id, membership_episode_id)\n        REFERENCES public.shared_world_membership_snapshot_members (membership_snapshot_id, membership_episode_id) ON DELETE RESTRICT',
      '    CONSTRAINT shared_world_governance_approvals_snapshot_member_fk\n        FOREIGN KEY (membership_snapshot_id) REFERENCES public.shared_world_membership_snapshots (id) ON DELETE RESTRICT')],
    ['makes a foreign key cascade', (text) => text.replace(
      'FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE RESTRICT',
      'FOREIGN KEY (membership_episode_id) REFERENCES public.shared_world_membership_episodes (id) ON DELETE CASCADE')],
    ['reverses the lock order in the approval primitive', (text) => text.replace(
      '  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION \'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE\' USING ERRCODE=\'P0002\';\n  END IF;\n\n  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock.',
      '  SELECT * INTO proposal FROM public.shared_world_governance_proposals pr WHERE pr.id = p_proposal_id FOR UPDATE;\n  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = target_world;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION \'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE\' USING ERRCODE=\'P0002\';\n  END IF;\n\n  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock.')],
    ['takes an advisory lock instead of the canonical row lock', (text) => text.replace(
      'SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;',
      "PERFORM pg_advisory_xact_lock(hashtext(p_world_id::text));\n  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;")],
    ['reads the clock twice', (text) => text.replace(
      'VALUES (p_membership_snapshot_id, p_world_id, capture_instant);',
      'VALUES (p_membership_snapshot_id, p_world_id, clock_timestamp());')],
    ['processes an INTRODUCTION World', (text) => text.replace(
      "  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;\n\n  -- THE EXACT CURRENT TOPOLOGY",
      "  IF world.lifecycle <> 'ACTIVE' THEN\n    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;\n\n  -- THE EXACT CURRENT TOPOLOGY")],
    ['closes the World when governance is satisfied', (text) => text.replace(
      "  RETURN QUERY SELECT 'SATISFIED'::text,",
      "  UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = proposal.world_id;\n  RETURN QUERY SELECT 'SATISFIED'::text,")],
    ['ends a membership episode when governance is satisfied', (text) => text.replace(
      "  RETURN QUERY SELECT 'SATISFIED'::text,",
      "  UPDATE public.shared_world_membership_episodes SET ended_at = clock_timestamp() WHERE id = proposal.excluded_membership_episode_id;\n  RETURN QUERY SELECT 'SATISFIED'::text,")],
    ['widens a Standing Context Grant from governance', (text) => text.replace(
      'INSERT INTO public.shared_world_governance_approvals\n      (id, proposal_id,',
      "INSERT INTO public.shared_world_standing_context_grant_audience (grant_id, audience_user_id)\n      SELECT g.id, u FROM public.shared_world_standing_context_grants g WHERE g.world_id = proposal.world_id;\n    INSERT INTO public.shared_world_governance_approvals\n      (id, proposal_id,")],
    ['persists a permanent approved flag', (text) => text.replace(
      '    approved_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_governance_approvals_pk',
      '    approved_at timestamptz NOT NULL,\n    approval_state text NOT NULL,\n    CONSTRAINT shared_world_governance_approvals_pk')],
    ['rebinds a stale proposal to current topology', (text) => text.replace(
      "    RAISE EXCEPTION 'SHARED_WORLD_GOVERNANCE_STALE' USING ERRCODE='40001';\n  END IF;\n\n  -- The approver",
      "    UPDATE public.shared_world_governance_proposals pr SET membership_snapshot_id = pr.membership_snapshot_id WHERE pr.id = p_proposal_id;\n  END IF;\n\n  -- The approver")],
    ['adds a trigger from governance onto membership', (text) => text.replace(
      `CREATE FUNCTION public.${CAPTURE_FN}(`,
      'CREATE TRIGGER shared_world_governance_ends_membership AFTER INSERT ON public.shared_world_governance_approvals\n'
      + `  FOR EACH ROW EXECUTE FUNCTION public.${CAPTURE_FN}();\n`
      + `CREATE FUNCTION public.${CAPTURE_FN}(`)],
    ['adds a member-invitation substrate this slice does not own', (text) => text.replace(
      'CREATE TABLE public.shared_world_governance_approvals (',
      'CREATE TABLE public.shared_world_member_invitations (id uuid PRIMARY KEY);\nCREATE TABLE public.shared_world_governance_approvals (')],
    ['adds the add-member consumer command', (text) => text.replace(
      `CREATE FUNCTION public.${RESOLVE_FN}(`,
      'CREATE FUNCTION public.commit_shared_world_add_member_v1(p_command_id uuid) RETURNS void\n'
      + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
      + `CREATE FUNCTION public.${RESOLVE_FN}(`)],
  ];
  const mirror = buildMirror();
  const mirrored = join(mirror, 'database', 'migrations', MIGRATION_NAME);
  try {
    assert.ok(runInMirror(mirror).ok, 'the untouched mirror must reproduce this contract exactly');
    for (const [reason, mutate] of weakenings) {
      const mutated = mutate(migration);
      assert.notEqual(mutated, migration, `the "${reason}" mutation matched nothing`);
      writeFileSync(mirrored, mutated);
      assert.equal(runInMirror(mirror).ok, false, `a migration that ${reason} must be refused by this contract`);
      writeFileSync(mirrored, migration);
    }
    assert.ok(runInMirror(mirror).ok, 'every weakening was reverted');
  } finally {
    rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
  }
});

// ---------------------------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
// ---------------------------------------------------------------------------------------------

/** Only the paths this contract actually reads. */
const MIRRORED = ['database', '.github/workflows/api-ci.yml', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = mkdtempSync(join(tmpdir(), 'qandeel-i04d-forward-'));
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    const to = join(mirror, entry);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}

/**
 * Runs THIS contract against the mirrored tree, in a child that does not run the probes again.
 *
 * `NODE_TEST_CONTEXT` is stripped deliberately. Inherited, it makes the spawned Node believe it is
 * a reporting child of this runner: it switches to the parent's serialization protocol and exits 0
 * whatever its tests did, which would make every refusal above and below read as an acceptance.
 */
function runInMirror(mirror, file = SELF) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'database', 'tests', file)], { cwd: mirror, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `the mirrored contract could not be started: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

const write = (mirror, relative, content) => {
  const target = join(mirror, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
};
const patch = (mirror, relative, from, to) => {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the regression probe needs ${from} in ${relative}`);
  writeFileSync(target, text.replace(from, to));
};

test('the add-member consumer, a Launch Gate and every later authorized governance slice leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, () => {
    const mirror = buildMirror();
    try {
      // The repository, several authorized steps into its future - which is the
      // future this foundation exists to serve.
      write(mirror, 'database/migrations/0085_shared_world_add_member_governance_consumer_v1.sql',
        '-- A later reviewed slice: the first governance consumer (CW2-03 section 16).\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.shared_world_add_member_payload_versions (\n'
        + '  id uuid PRIMARY KEY, world_id uuid NOT NULL, target_user_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.shared_world_member_invitations (\n'
        + '  id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT,\n'
        + '  membership_snapshot_id uuid NOT NULL REFERENCES public.shared_world_membership_snapshots (id) ON DELETE RESTRICT,\n'
        + '  state text NOT NULL);\n'
        + 'ALTER TABLE public.shared_world_governance_proposals\n'
        + "  ADD CONSTRAINT shared_world_governance_proposals_operation_check\n"
        + "  CHECK (operation_kind IN ('ADD_MEMBER','REMOVE_MEMBER','REJOIN_MEMBER','WORLD_SETTINGS_CHANGE','END_WORLD','GRANT_HISTORY_ACCESS'));\n"
        + 'ALTER TABLE public.shared_world_governance_approvals ADD COLUMN client_epoch bigint;\n'
        + 'CREATE INDEX shared_world_governance_proposals_world_idx ON public.shared_world_governance_proposals (world_id, created_at);\n'
        + 'CREATE FUNCTION public.commit_shared_world_add_member_v1(p_command_id uuid, p_proposal_id uuid, p_payload_version_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + '  PERFORM 1 FROM public.resolve_shared_world_governance_approval_v1(p_proposal_id, $lit$ADD_MEMBER$lit$, p_payload_version_id);\n'
        + 'END$fn$;\n'
        + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_add_member_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/migrations/0086_shared_world_launch_gate_and_governance_wrapper_v1.sql',
        '-- The launch-gated consumer this slice deliberately did not add.\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL);\n'
        + 'CREATE FUNCTION public.propose_shared_world_governance_v1(p_proposal_id uuid, p_membership_snapshot_id uuid, p_world_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.propose_shared_world_governance_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0085.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-add-member-governance-consumer-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'the add-member consumer with its own payload table, its own foreign keys into this substrate, a broader operation vocabulary, '
        + 'an additive column, an additive index, a launch-gated wrapper and migrations 0085/0086 must all leave this contract passing');

      // And the regressions it must still refuse.
      const regressions = [
        ['0084 itself grants EXECUTE', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${APPROVE_FN}(uuid, uuid) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${APPROVE_FN}(uuid, uuid) TO authenticated;`)],
        ['a frozen predecessor migration is edited', () => patch(mirror, 'database/migrations/0083_shared_world_standard_voluntary_leave_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0084 drops the one-effective-approval rule', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '    CONSTRAINT shared_world_governance_approvals_one_per_episode_key UNIQUE (proposal_id, membership_episode_id),\n', '')],
        ['0084 ends a membership episode', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          "  RETURN QUERY SELECT 'SATISFIED'::text,",
          "  UPDATE public.shared_world_membership_episodes SET ended_at = clock_timestamp() WHERE id = proposal.excluded_membership_episode_id;\n  RETURN QUERY SELECT 'SATISFIED'::text,")],
        ['0084 freezes the future governance vocabulary in a CHECK', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '    operation_kind text NOT NULL,',
          "    operation_kind text NOT NULL CHECK (operation_kind IN ('ADD_MEMBER','REMOVE_MEMBER')),")],
        ['0084 lets the excluded removal target approve their own removal', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '     OR proposal.excluded_membership_episode_id IS NOT DISTINCT FROM actor_episode THEN', '     THEN')],
      ];
      for (const [reason, plant] of regressions) {
        const snapshot = buildMirror();
        try {
          plant(mirror);
          assert.equal(runInMirror(mirror).ok, false, `a repository where ${reason} must still be refused`);
        } finally {
          rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
          cpSync(snapshot, mirror, { recursive: true });
          rmSync(snapshot, { recursive: true, force: true, maxRetries: 3 });
        }
      }
    } finally {
      rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
    }
  });
