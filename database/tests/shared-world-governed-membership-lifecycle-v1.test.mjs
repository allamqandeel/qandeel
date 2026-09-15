// I-04E - Governed Standard Membership Lifecycle v1: the secret-free structural
// contract for migration 0085.
//
// Live semantics - ACLs, real denials, the whole add / remove / rejoin journey, the
// staleness law, the exact count deltas that show no history access is created, the
// multi-connection races and forward safety - are proven by
// database/verify-migration-0085.mjs against real PostgreSQL, which this file pins
// into the toolchain and CI. What is proven HERE is the structure a migration must
// already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04E PART A: that THIS slice consumed the
// frozen I-04D governance substrate to implement add-member, removal and rejoin -
// and nothing beyond them. No World closure or end; no history-access grant,
// absence-period grant or closed-world entitlement; no Shared conversation, message
// or material; no Introduction, Matching, Public or Replay path; no Launch Gate,
// feature flag, entitlement or moderation policy; no application wrapper, controller
// or route; no owner, admin or initiator authority; no Personal-context read; no
// Standing Context or consent mutation - and that it modified no frozen predecessor
// migration.
//
// It deliberately does NOT prove that any of those may never appear later. I-04F is
// expected to bring exactly the history-access and closure substrate this file
// refuses to invent, and I-04G the Shared material runtime. A historical contract
// that froze today's absences would fail on all of it. So every assertion below is
// scoped to one of exactly two things:
//
//   (a) migration 0085 itself, the verifier it added, the four predecessor verifiers
//       it repaired, and the registration lines it added;
//   (b) the frozen predecessor migrations it was required not to modify, pinned by
//       content hash, which proves immutability without banning additions.
//
// There is no census of the migration list, of a directory, of the function catalog
// or of any table's live column set. The last test proves that by mutation: it
// mirrors the repository, adds the I-04F closure substrate, the I-04G material
// substrate, a Launch Gate, later migrations and later verifiers, and requires this
// contract to still pass - then plants the regressions it must still refuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-world-governed-membership-lifecycle-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04E_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0085_shared_world_governed_membership_lifecycle_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0085.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

/** Executable SQL only: every "must not contain" assertion below runs against this, never against prose. */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * Executable SQL MINUS the terminal self-assertion block.
 *
 * That block legitimately NAMES every shape it refuses - the launch gate, the
 * history-access literals, the Standing Context tables - so scanning it for those
 * names would make this contract fail on the very code that enforces them.
 */
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
/** The terminal self-assertion block alone, checked POSITIVELY by what it raises. */
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const ADD_PAYLOADS = 'shared_world_add_member_payload_versions';
const REMOVE_PAYLOADS = 'shared_world_remove_member_payload_versions';
const REJOIN_PAYLOADS = 'shared_world_rejoin_payload_versions';
const MEMBER_INVITATIONS = 'shared_world_member_invitations';
const JOINED_EVENTS = 'shared_world_member_joined_events';
const ACCEPT_COMMANDS = 'shared_world_member_acceptance_commands';
const REMOVED_EVENTS = 'shared_world_member_removed_events';
const REMOVAL_COMMANDS = 'shared_world_member_removal_commands';
const REJOINED_EVENTS = 'shared_world_member_rejoined_events';
const REJOIN_COMMANDS = 'shared_world_member_rejoin_commands';
const OWN_TABLES = [ADD_PAYLOADS, REMOVE_PAYLOADS, REJOIN_PAYLOADS, MEMBER_INVITATIONS, JOINED_EVENTS,
  ACCEPT_COMMANDS, REMOVED_EVENTS, REMOVAL_COMMANDS, REJOINED_EVENTS, REJOIN_COMMANDS];

const TRIGGER_FN = 'terminalize_stale_shared_world_member_invitations_v1';
const PREPARE_ADD_FN = 'prepare_shared_world_add_member_governance_v1';
const PREPARE_REMOVE_FN = 'prepare_shared_world_remove_member_governance_v1';
const PREPARE_REJOIN_FN = 'prepare_shared_world_rejoin_governance_v1';
const DISPATCH_FN = 'dispatch_shared_world_member_invitation_v1';
const ACCEPT_FN = 'accept_shared_world_member_invitation_v1';
const REMOVE_FN = 'commit_shared_world_member_removal_v1';
const REJOIN_FN = 'commit_shared_world_member_rejoin_v1';
const PREPARE_FUNCTIONS = [PREPARE_ADD_FN, PREPARE_REMOVE_FN, PREPARE_REJOIN_FN];
const OWN_FUNCTIONS = [...PREPARE_FUNCTIONS, DISPATCH_FN, ACCEPT_FN, REMOVE_FN, REJOIN_FN];

const OWN_SCRIPT = 'verify:shared-world-governed-membership-lifecycle:integration';

/**
 * The stored body of one CREATE FUNCTION, comments INCLUDED.
 *
 * pg_proc.prosrc keeps the function's comments, so the migration's own prosrc-level
 * checks run against comments as well as code. This is exactly the text PostgreSQL
 * will store, which is what the mirror test at the end needs.
 */
const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0085 creates ${name}`);
  const start = migration.indexOf("SET search_path='' AS $$", create);
  assert.ok(start > create, `${name} pins an empty search_path`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + "SET search_path='' AS $$".length, end + '\nEND'.length);
};
const BODY = Object.fromEntries([...OWN_FUNCTIONS, TRIGGER_FN].map((name) => [name, functionBody(name)]));

/** One CREATE TABLE block, comments stripped. */
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0085 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};

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
  ['0084_shared_world_governance_approval_foundation_v1.sql', '7b77087dc229b3dfee10ce1b175ffc9b16008aca'],
];

// ---------------------------------------------------------------------------

test('0085 is the forward migration after 0084, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0085 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0085_')).length, 1, 'exactly one migration carries the 0085 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0084_shared_world_governance_approval_foundation_v1.sql'),
    '0085 orders after 0084');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04E reopens no predecessor`);
  }
  // Forward-only: nothing existing is dropped, rewritten or renumbered.
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0085 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0085 touches exactly ONE predecessor table, and only by adding a structural key', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(
    foreign.map((statement) => /ALTER TABLE\s+public\.(\w+)/u.exec(statement)[1]),
    ['shared_world_governance_proposals', 'shared_world_governance_proposals'],
    'the only predecessor table 0085 alters is the I-04D proposal');
  for (const statement of foreign) {
    assert.match(statement, /ADD CONSTRAINT shared_world_governance_proposals_\w+_binding_key\s*\n?\s*UNIQUE \(/u,
      'and only by ADDING a UNIQUE key so an operation payload can bind it structurally');
  }
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  // The two composite keys the payload tables reference, named exactly.
  assert.match(deployableSql, /UNIQUE \(id, world_id, operation_kind, proposed_payload_version_id\)/u);
  assert.match(deployableSql, /UNIQUE \(id, excluded_membership_episode_id\)/u);
});

test('0085 creates exactly the ten relations it owns, and no generic membership or payload engine', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the ten relations, and nothing else');
  for (const name of OWN_TABLES) {
    const block = tableBlock(name);
    assert.doesNotMatch(block, /\b(?:json|jsonb)\b|\[\]/iu, `${name} as 0085 created it stores no JSON and no array`);
    assert.doesNotMatch(block, /(owner|admin|creator|initiator|proposer|survivor|privilege|capability|permission|scope|metadata|vote|weight|token|entitlement|history_access)/iu,
      `${name} as 0085 created it is no permission store and carries no superior authority`);
    assert.match(block, /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(block, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
  }
  // The three payload identities ARE the opaque I-04D payload version, bound
  // structurally to their exact proposal, World and operation.
  for (const name of [ADD_PAYLOADS, REMOVE_PAYLOADS, REJOIN_PAYLOADS]) {
    const block = tableBlock(name);
    assert.match(block, /^\s{4}id uuid NOT NULL,/mu, `${name} is keyed on the opaque payload version identity`);
    assert.match(block, /FOREIGN KEY \(governance_proposal_id, world_id, governance_operation_kind, id\)\s*\n?\s*REFERENCES public\.shared_world_governance_proposals \(id, world_id, operation_kind, proposed_payload_version_id\) ON DELETE RESTRICT/u,
      `${name} binds its exact proposal, World, operation and payload version structurally`);
    assert.match(block, /CHECK \(governance_operation_kind = '(?:ADD_MEMBER|REMOVE_MEMBER|REJOIN_MEMBER)'\)/u,
      `${name} pins its operation to exactly one literal`);
  }
  // A removal payload's target episode IS the proposal's own excluded episode.
  assert.match(tableBlock(REMOVE_PAYLOADS),
    /FOREIGN KEY \(governance_proposal_id, target_membership_episode_id\)\s*\n?\s*REFERENCES public\.shared_world_governance_proposals \(id, excluded_membership_episode_id\) ON DELETE RESTRICT/u,
    'a removal can never close an episode the approvers did not exclude');
  // Uniqueness is per EPISODE, per EVENT and per PROPOSAL - never a permanent
  // (world, human) pair, which would forbid the very lifecycle this slice implements.
  assert.doesNotMatch(executableSql, /UNIQUE \(world_id, (?:target_|actor_)?user_id\)/u,
    'no permanent (world, human) key exists: a human may join, leave, rejoin and be removed over time');
});

test('the member invitation freezes its state CONSISTENCY without freezing the future state vocabulary', () => {
  const block = tableBlock(MEMBER_INVITATIONS);
  // Forward safety: a later reviewed decline, cancel or expiry state must not need a
  // superseding migration, exactly as 0083 left end_reason and 0084 left the
  // operation and rule vocabularies unconstrained.
  assert.doesNotMatch(block, /CHECK \(invitation_state IN/u,
    'the invitation state vocabulary carries no CHECK: a later reviewed terminal state supersedes nothing');
  assert.doesNotMatch(block, /CREATE TYPE|ENUM/iu, 'and it is not an enum type either');
  // What IS frozen is the consistency, in both directions.
  assert.match(block, /CHECK \(\(invitation_state = 'PENDING'\) = \(terminal_at IS NULL\)\)/u,
    'PENDING is the only non-terminal state, in both directions');
  assert.match(block, /CHECK \(terminal_at IS NULL OR terminal_at >= created_at\)/u,
    'an invitation can never become terminal before it existed');
  assert.match(block, /CHECK \(\(accepted_membership_episode_id IS NOT NULL\) = \(invitation_state = 'ACCEPTED'\)\)/u,
    'a membership episode is carried exactly when the invitation was accepted');
  assert.match(block, /CONSTRAINT shared_world_member_invitations_proposal_key UNIQUE \(governance_proposal_id\)/u,
    'one proposal dispatches at most ONE effective invitation');
  assert.match(block, /CONSTRAINT shared_world_member_invitations_episode_key UNIQUE \(accepted_membership_episode_id\)/u,
    'one acceptance produces at most ONE membership episode');
  // The exact target is the payload's target, and the payload is the proposal's own.
  assert.match(block, /FOREIGN KEY \(add_member_payload_version_id, target_user_id\)/u);
  assert.match(block, /FOREIGN KEY \(governance_proposal_id, add_member_payload_version_id\)/u);
  assert.match(block, /FOREIGN KEY \(governance_proposal_id, membership_snapshot_id\)/u);
  // The v1 states appear only where they belong: inside the sealed writers.
  assert.match(BODY[DISPATCH_FN], /'PENDING'/u);
  assert.match(BODY[ACCEPT_FN], /'ACCEPTED'/u);
  assert.match(BODY[TRIGGER_FN], /'STALE_GOVERNANCE'/u);
});

test('0085 installs exactly two narrow topology triggers, on exactly the canonical membership table', () => {
  const triggers = [...executableSql.matchAll(/CREATE TRIGGER (\w+)\s+([\s\S]*?)EXECUTE FUNCTION public\.(\w+)\(\);/gu)];
  assert.equal(triggers.length, 2, '0085 installs exactly two triggers');
  for (const [, , definition, fn] of triggers) {
    assert.equal(fn, TRIGGER_FN, 'and both call exactly the one terminalization mechanism this slice owns');
    assert.match(definition, /ON public\.shared_world_membership_episodes/u,
      'on exactly the canonical membership table, where topology actually changes');
    assert.match(definition, /^\s*AFTER /u, 'AFTER the write, so it can never suppress or rewrite a membership row');
    assert.match(definition, /FOR EACH ROW WHEN \(/u, 'with a WHEN clause, so it reacts to nothing else');
  }
  assert.match(triggers[0][2], /AFTER INSERT ON public\.shared_world_membership_episodes\s*\n\s*FOR EACH ROW WHEN \(NEW\.ended_at IS NULL\)/u,
    'the first reacts only to a NEW OPEN episode appearing');
  assert.match(triggers[1][2], /AFTER UPDATE OF ended_at ON public\.shared_world_membership_episodes\s*\n\s*FOR EACH ROW WHEN \(OLD\.ended_at IS NULL AND NEW\.ended_at IS NOT NULL\)/u,
    'the second reacts only to an OPEN episode actually becoming closed');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger exists');
  // The mechanism writes member invitations and nothing else.
  assert.match(BODY[TRIGGER_FN], /UPDATE public\.shared_world_member_invitations i/u);
  assert.equal((BODY[TRIGGER_FN].match(/UPDATE public\./gu) ?? []).length, 1,
    'the terminalization mechanism writes exactly one relation');
  assert.doesNotMatch(BODY[TRIGGER_FN], /INSERT INTO|DELETE FROM/u, 'it creates and deletes nothing');
  assert.match(BODY[TRIGGER_FN], /AND i\.invitation_state = 'PENDING'/u, 'only a still-PENDING invitation transitions');
  assert.match(BODY[TRIGGER_FN], /WHERE i\.world_id = changed_world/u, 'and never in another World');
  assert.doesNotMatch(BODY[TRIGGER_FN], /shared_world_direct_invitations|shared_world_invite_credential_state/u,
    'it never touches an I-04A direct-world invitation');
  assert.doesNotMatch(BODY[TRIGGER_FN], /shared_world_standing_context|shared_world_governance_(?:proposals|approvals)/u,
    'and never governance, grant or consent state');
  // EXACT SET EQUALITY, in BOTH directions, over EPISODE identity.
  assert.match(BODY[TRIGGER_FN], /AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_snapshot_members m/u);
  assert.match(BODY[TRIGGER_FN], /AND NOT EXISTS \(SELECT 1 FROM public\.shared_world_membership_episodes e/u);
  assert.match(BODY[TRIGGER_FN], /AND m\.membership_episode_id = e\.id/u);
  assert.match(BODY[TRIGGER_FN], /WHERE e\.id = m\.membership_episode_id/u);
  assert.doesNotMatch(BODY[TRIGGER_FN], /count\(\*\)|e\.user_id/u,
    'a count or a user-id comparison would accept a leave followed by a rejoin');
});

test('every primitive is sealed, pinned and executable by no application role at all', () => {
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'migration 0085 grants nothing to anybody');
  for (const name of [...OWN_FUNCTIONS, TRIGGER_FN]) {
    assert.match(executableSql, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, 'u'), `0085 creates ${name}`);
    assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${name}\\([^)]*\\) OWNER TO postgres;`, 'u'),
      `${name} is owned by postgres`);
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'),
      `${name} is revoked from PUBLIC, anon and authenticated`);
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role`, 'u'),
      `${name} is revoked from service_role too, because the frozen Launch Gate precondition is unimplemented`);
    assert.match(executableSql, new RegExp(`public\\.${name}\\([\\s\\S]{0,600}?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'),
      `${name} is SECURITY DEFINER with an empty search_path`);
  }
  for (const phrase of [
    'I-04E: PUBLIC must not execute the governed membership lifecycle before the launch gate exists',
    'I-04E: % must not execute the governed membership lifecycle before the launch gate exists',
    'I-04E: % must be owned by postgres',
    'I-04E: % must be SECURITY DEFINER',
    'I-04E: % must pin an empty search_path',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0085 refuses to deploy without: ${phrase}`);
  // Every new table is sealed too.
  for (const name of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
    assert.ok(executableSql.includes(`public.${name},`) || executableSql.includes(`public.${name}\n  FROM PUBLIC`),
      `${name} appears in the REVOKE list`);
  }
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'no RLS policy is created');
});

/** One primitive's declared parameter list, from the migration text. */
const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0085 creates ${name}`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const close = migration.indexOf(') RETURNS', open);
  assert.ok(close > open, `${name} has a terminated parameter list`);
  return migration.slice(open, close);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_]+)\s+(?:uuid|text)/gu)].map((m) => m[1]);

test('every primitive accepts exactly its frozen list of opaque identities, and no authority parameter at all', () => {
  // The exact lists first, so the negative bans below can never pass vacuously
  // against a renamed or widened parameter list - which is the one weakening a
  // body-only check cannot see.
  assert.deepEqual(parameters(PREPARE_ADD_FN),
    ['p_proposal_id', 'p_membership_snapshot_id', 'p_payload_version_id', 'p_world_id', 'p_target_user_id']);
  assert.deepEqual(parameters(PREPARE_REMOVE_FN), parameters(PREPARE_ADD_FN));
  assert.deepEqual(parameters(PREPARE_REJOIN_FN), parameters(PREPARE_ADD_FN));
  assert.deepEqual(parameters(DISPATCH_FN), ['p_invitation_id', 'p_proposal_id']);
  assert.deepEqual(parameters(ACCEPT_FN),
    ['p_command_id', 'p_invitation_id', 'p_membership_episode_id', 'p_member_joined_event_id']);
  assert.deepEqual(parameters(REMOVE_FN), ['p_command_id', 'p_proposal_id', 'p_member_removed_event_id']);
  assert.deepEqual(parameters(REJOIN_FN),
    ['p_command_id', 'p_proposal_id', 'p_membership_episode_id', 'p_member_rejoined_event_id']);
  // No caller may supply an actor, an approver set, a topology, a count or a clock.
  for (const name of OWN_FUNCTIONS) {
    for (const parameter of parameters(name)) {
      assert.doesNotMatch(parameter, /actor|initiator|proposer|owner|admin|approver|approval|audience|count|launch|gate|timestamp|instant|_at$/u,
        `${name} must not accept ${parameter}: an authority, topology, count or clock parameter`);
    }
    assert.doesNotMatch(signature(name), /DEFAULT/u,
      `${name} declares no defaulted parameter, so a widened list cannot arrive silently`);
  }
  // Only the two operations that name a human take one, and it is the OPERATION
  // target rather than the acting human.
  for (const name of [DISPATCH_FN, ACCEPT_FN, REMOVE_FN, REJOIN_FN]) {
    assert.doesNotMatch(signature(name), /user_id/u,
      `${name} names no human at all: the acting human is the session subject and the target is already durable`);
  }
});

test('the human-authority primitives derive their human from the session subject, and removal derives none', () => {
  // Acceptance and rejoin: the acting human is auth.uid(), with no actor parameter.
  for (const name of [ACCEPT_FN, REJOIN_FN]) {
    assert.match(BODY[name], /u uuid := auth\.uid\(\)/u, `${name} derives its human from the session subject`);
    assert.match(BODY[name], /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_MEMBERSHIP_AUTHENTICATION_REQUIRED'/u,
      `${name} fails closed with no session, so QANDEEL can never act for a human`);
  }
  assert.match(BODY[ACCEPT_FN], /invitation\.target_user_id <> u/u, 'only the exact invited human may accept');
  assert.match(BODY[REJOIN_FN], /payload\.target_user_id <> u/u,
    'current members may approve an exact rejoin but may never force a human back into a World');
  // Removal and the three preparations derive NOBODY: preparation is not authority,
  // and a removal's authority is the approval set rather than whoever transmits it.
  for (const name of [...PREPARE_FUNCTIONS, DISPATCH_FN, REMOVE_FN]) {
    assert.doesNotMatch(BODY[name], /auth\.uid/u, `${name} derives and records no actor`);
  }
  for (const phrase of [
    'I-04E: % must not derive or record an initiator: preparation is not authority',
    'I-04E: removal derives no remover: the authority is the exact approval set I-04D recorded',
    'I-04E: dispatch records no dispatcher: transmitting a satisfied proposal is not authority',
    'I-04E: the accepting human must be derived from the session subject, never supplied',
    'I-04E: the rejoining human must be derived from the session subject, never supplied',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0085 refuses to deploy without: ${phrase}`);
});

test('0085 consumes the frozen I-04D governance rather than duplicating or manufacturing it', () => {
  for (const name of PREPARE_FUNCTIONS) {
    assert.match(BODY[name], /public\.capture_shared_world_governance_proposal_v1\(/u,
      `${name} opens its proposal through the frozen I-04D capture`);
    assert.match(BODY[name], /captured\.snapshot_captured_at/u,
      `${name} persists the exact instant the frozen capture owned, reading no clock of its own`);
    assert.doesNotMatch(BODY[name], /clock_timestamp/u, `${name} reads no clock of its own`);
  }
  for (const [name, operation] of [[DISPATCH_FN, 'ADD_MEMBER'], [ACCEPT_FN, 'ADD_MEMBER'],
    [REMOVE_FN, 'REMOVE_MEMBER'], [REJOIN_FN, 'REJOIN_MEMBER']]) {
    assert.match(BODY[name], new RegExp(`public\\.resolve_shared_world_governance_approval_v1\\([\\s\\S]{0,80}'${operation}'`, 'u'),
      `${name} revalidates the exact ${operation} governance inside its own transaction`);
  }
  // Nothing here writes a proposal, an approval or a captured topology.
  for (const name of [...OWN_FUNCTIONS, TRIGGER_FN]) {
    assert.doesNotMatch(BODY[name], /INSERT INTO public\.shared_world_governance_(?:proposals|approvals)|UPDATE public\.shared_world_governance_(?:proposals|approvals)/u,
      `${name} manufactures no governance: proposals and approvals belong to I-04D`);
    assert.doesNotMatch(BODY[name], /INSERT INTO public\.shared_world_membership_snapshot/u,
      `${name} captures no topology of its own`);
  }
  // The exact v1 operation / rule mapping is named where each preparation uses it,
  // and the exclusion belongs to REMOVE_MEMBER alone.
  assert.match(BODY[PREPARE_ADD_FN], /'ADD_MEMBER', p_payload_version_id,\s*\n\s*'ALL_CURRENT_MEMBERS', NULL\)/u);
  assert.match(BODY[PREPARE_REJOIN_FN], /'REJOIN_MEMBER', p_payload_version_id,\s*\n\s*'ALL_CURRENT_MEMBERS', NULL\)/u);
  assert.match(BODY[PREPARE_REMOVE_FN], /'REMOVE_MEMBER', p_payload_version_id,\s*\n\s*'ALL_CURRENT_MEMBERS_EXCEPT_TARGET', p_target_user_id\)/u);
});

test('the canonical World-first lock order and ONE database-owned instant per transaction', () => {
  for (const name of OWN_FUNCTIONS) {
    assert.match(BODY[name], /FROM public\.shared_worlds w WHERE w\.id = (?:p_world_id|target_world) FOR UPDATE/u,
      `${name} locks the exact World row`);
    assert.doesNotMatch(BODY[name], /pg_advisory|LOCK TABLE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(BODY[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${name} accepts no clock but the database's own`);
    assert.ok((BODY[name].match(/clock_timestamp\(\)/gu) ?? []).length <= 1,
      `${name} reads the database clock at most once`);
  }
  // The preparations take exactly one row lock of their own; acceptance takes two.
  for (const name of PREPARE_FUNCTIONS) {
    assert.equal((BODY[name].match(/FOR UPDATE/gu) ?? []).length, 1, `${name} takes exactly one row lock: the World`);
  }
  assert.equal((BODY[ACCEPT_FN].match(/FOR UPDATE/gu) ?? []).length, 2,
    'acceptance takes exactly two row locks: the World, then the invitation');
  // ORDERING IS LOAD-BEARING: the invitation becomes terminal BEFORE the episode
  // exists, so the topology trigger the insert fires can never see it PENDING.
  const accepted = BODY[ACCEPT_FN].indexOf("SET invitation_state = 'ACCEPTED'");
  const episode = BODY[ACCEPT_FN].indexOf('INSERT INTO public.shared_world_membership_episodes');
  const lock = BODY[ACCEPT_FN].indexOf('WHERE i.id = p_invitation_id FOR UPDATE');
  const world = BODY[ACCEPT_FN].indexOf('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  assert.ok(world >= 0 && lock > world && accepted > lock && episode > accepted,
    'World -> invitation -> ACCEPTED -> episode, in that order, inside one transaction');
  for (const phrase of [
    'I-04E: acceptance must lock the World then the invitation, and mark it ACCEPTED before the episode exists',
    'I-04E: a removal must lock the exact World row, then the exact target episode, before any write',
    'I-04E: % must lock the exact World row first',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0085 refuses to deploy without: ${phrase}`);
});

test('removal closes the exact excluded episode in place, and rejoin never reopens one', () => {
  assert.match(BODY[REMOVE_FN], /SET ended_at = removal_instant, end_reason = 'REMOVED'/u,
    'a removal closes the episode IN PLACE with the REMOVED reason');
  assert.match(BODY[REMOVE_FN], /payload\.target_membership_episode_id/u,
    'and it is the exact episode the approvers excluded, never a later successor');
  assert.match(BODY[REMOVE_FN], /IF remaining = 0 THEN/u,
    'a removal may never manufacture a zero-human World through empty-set authority');
  assert.doesNotMatch(BODY[REMOVE_FN], /INSERT INTO public\.shared_world_membership_episodes/u, 'a removal opens no episode');
  assert.doesNotMatch(BODY[REJOIN_FN], /UPDATE public\.shared_world_membership_episodes/u,
    'a rejoin creates a NEW episode and never reopens, re-dates or rewrites a closed one');
  assert.match(BODY[REJOIN_FN], /INSERT INTO public\.shared_world_membership_episodes \(id, world_id, user_id, joined_at, ended_at, end_reason\)/u,
    'a rejoin opens exactly one new membership episode');
  // ADD is for a human who was never a member; REJOIN is for a former one.
  assert.match(BODY[PREPARE_ADD_FN], /WHERE e\.world_id = p_world_id AND e\.user_id = p_target_user_id\)/u,
    'ADD_MEMBER refuses a human who already holds ANY membership episode of that World');
  assert.match(BODY[PREPARE_REJOIN_FN], /AND e\.ended_at IS NOT NULL/u,
    'REJOIN binds one exact prior CLOSED episode as its historical proof of former membership');
  assert.match(tableBlock(REJOINED_EVENTS), /CHECK \(membership_episode_id <> prior_membership_episode_id\)/u,
    'the new episode is never the prior one');
  // Nothing deletes canonical history, anywhere.
  for (const name of [...OWN_FUNCTIONS, TRIGGER_FN]) {
    assert.doesNotMatch(BODY[name], /DELETE FROM|TRUNCATE/iu, `${name} deletes no canonical history`);
  }
});

test('0085 invents no closure, no history access, no Shared material and no Launch Gate', () => {
  // Proven from 0085's OWN text, which is where a claim about what a migration did
  // not create belongs. It says nothing about whether I-04F or I-04G may add them.
  for (const absent of [
    'history_access', 'HISTORY_ACCESS_GRANT', 'CLOSED_WORLD_VIEW_ENTITLEMENT', 'READ_ONLY_CLOSED',
    'closed_at', 'WORLD_ENDED', 'launch_gate', 'feature_flag', 'entitlement', 'moderation',
    'introduction', 'matching', 'replay',
  ]) {
    assert.ok(!deployableSql.toLowerCase().includes(absent.toLowerCase()),
      `migration 0085 never writes ${absent}: I-04F and I-04G own those, and this slice invents neither`);
  }
  for (const coupled of [
    'UPDATE public.shared_worlds', 'INSERT INTO public.shared_worlds',
    'UPDATE public.shared_world_standing_context_grants',
    'INSERT INTO public.shared_world_standing_context_grant_audience',
    'DELETE FROM public.shared_world_standing_context_grant_audience',
    'INSERT INTO public.shared_world_standing_context_consent_events',
  ]) assert.ok(!deployableSql.includes(coupled), `0085 never performs: ${coupled}`);
  // FROM_JOIN_FORWARD is the ABSENCE of a grant, never a stored entitlement.
  assert.doesNotMatch(deployableSql, /FROM_JOIN_FORWARD/u,
    'the default boundary is the new episode joined_at and the absence of a retrospective grant, not a literal');
  for (const phrase of [
    'I-04E: % must not create, close or mutate a Shared World',
    'I-04E: % must not write a closure, history-access or entitlement literal it does not own',
    'I-04E: % must not read Personal context or touch grant and consent state',
    'I-04E: % may never delete canonical history',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0085 refuses to deploy without: ${phrase}`);
});

test('no route, controller, module registration or production Connected Worlds TypeScript is added', () => {
  const connectedWorlds = readdirSync(new URL('../../apps/api/src/connected-worlds/', import.meta.url), { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'));
  for (const entry of connectedWorlds) {
    const source = read(`../../apps/api/src/connected-worlds/${entry.replace(/\\/gu, '/')}`);
    assert.doesNotMatch(source, new RegExp(`${ACCEPT_FN}|${REMOVE_FN}|${REJOIN_FN}|${DISPATCH_FN}`, 'u'),
      `${entry} does not reach the I-04E primitives: no application path exists before the Launch Gate`);
  }
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0085.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0085/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0085\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  // Flow-mapping step names must carry no comma (the repository's CI convention).
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0085_shared_world_governed_membership_lifecycle_v1\.sql/u, 'the README records migration 0085');
  assert.match(readme, /MEMBER_INVITATION/u);
  assert.match(readme, /Four predecessor verifiers were narrowed/u, 'and records the predecessor repair');
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  // This verifier runs against a FULLY migrated database, so any absence census or
  // exact-count assertion in it would be a ceiling on the whole roadmap rather than a
  // fact about migration 0085. Scoped to THIS verifier deliberately.
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0085 did not create is proven from 0085 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  // The owned-column proof reads the DEFAULT too, and is a PREFIX so later additive
  // columns are permitted while a drop, a retype or a reorder still fails.
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  // Forward safety is proven by the real-PostgreSQL verifier itself.
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  for (const authorized of ['_history_access_grants', '_closed_world_view_entitlements', '_shared_material',
    '_launch_gates', 'ADD COLUMN', 'ADD CONSTRAINT', 'CREATE INDEX', 'CREATE TRIGGER']) {
    assert.ok(verifier.includes(authorized), `the probe builds the authorized future: ${authorized}`);
  }
});

test('the four repaired predecessor verifiers keep every invariant they owned, and stop censusing a table they do not own', () => {
  // I-04E's reviewed topology triggers are legal canon (CW2-03 sections 16 and 28)
  // and were blocked only by four verifiers asserting that
  // shared_world_membership_episodes carried NO trigger at all - against a FULLY
  // migrated database, which makes it a ceiling on the roadmap rather than a fact
  // about their own migrations. 0078 had already excluded exactly this claim for
  // exactly this table, and the I-04D FIX-01 correction removed it from 0084. Each of
  // the four was narrowed to the invariant it really owns; the invariants themselves
  // are untouched, which is what these assertions check.
  const repaired = {
    '../verify-migration-0075.mjs': [
      'FORWARD SAFETY (I-04E)',
      'still carries every column migration 0075 owns, unchanged and in its original position',
      'shared_world_membership_episodes_one_open_idx',
      'shared_worlds_closure_consistency_check',
      'deletes canonical Shared history',
    ],
    '../verify-migration-0076.mjs': [
      'FORWARD SAFETY (I-04E)',
      'still carries every column migration 0076 owns, unchanged and in its original position',
      'shared_world_standing_context_grants_one_active_idx',
      'for (const table of [...TABLES, EPISODES])',
      'if (table === EPISODES) {',
      'reaches Standing Context state',
    ],
    '../verify-migration-0077.mjs': [
      'FORWARD SAFETY (I-04E)',
      'the resolver returns exactly the five minimal columns',
      'reaches Standing Context state',
    ],
    '../verify-migration-0083.mjs': [
      'FORWARD SAFETY (I-04E)',
      'no trigger couples membership to Standing Context state',
      'reaches Standing Context state',
    ],
  };
  for (const [file, phrases] of Object.entries(repaired)) {
    const text = read(file);
    for (const phrase of phrases) assert.ok(text.includes(phrase), `${file} still proves: ${phrase}`);
  }
  // The Standing Context relations KEEP their live zero-trigger census: there, an
  // automatic authority / ceiling mutation path is exactly what CW2-02 B13 / B14
  // forbid, so the absence IS the invariant.
  assert.match(read('../verify-migration-0083.mjs'), /\[\[GRANTS, CEILING, CONSENT_EVENTS\]\]/u,
    '0083 still refuses any trigger on the three Standing Context relations');
  assert.match(read('../verify-migration-0076.mjs'), /assert\.equal\(n, 0, `\$\{table\} has no trigger`\)/u,
    '0076 still refuses any trigger on the grant and audience tables');
  // And the precise replacement really does look at what a trigger DOES.
  for (const file of ['../verify-migration-0075.mjs', '../verify-migration-0076.mjs',
    '../verify-migration-0077.mjs', '../verify-migration-0083.mjs']) {
    assert.match(read(file), /pg_get_functiondef\(t\.tgfoid\)/u,
      `${file} inspects what a trigger actually does, which is strictly stronger than counting them`);
  }
});

test('no Connected Worlds verifier censuses the live schema or the function catalog', () => {
  // The defect class, swept across every Connected Worlds verifier including the two
  // this slice adds, so it cannot come back through a new file either.
  const verifiers = readdirSync(new URL('../', import.meta.url))
    .filter((name) => /^verify-migration-00(?:7[5-9]|8\d)\.mjs$/u.test(name));
  assert.ok(verifiers.length >= 10, `the Connected Worlds verifiers are present, found ${verifiers.length}`);
  for (const file of verifiers) {
    const text = read(`../${file}`);
    assert.doesNotMatch(text,
      /assert\.deepEqual\(\s*(?:\(await [^)]+\)|[A-Za-z_$][\w$]*)\s*\.map\(\([a-z]+\) => (?:\[[a-z]+\.(?:column_name|name|indexname|conname)|[a-z]+\.(?:name|conname|indexname)\))/u,
      `${file} must not compare a whole live column / constraint / index list to a fixed one`);
    assert.doesNotMatch(text, /count\(\*\)[^;]*pg_(?:proc|class)[^;]*proname\s*~/u,
      `${file} must not count every function in the database whose name matches a pattern`);
    assert.doesNotMatch(text, /proname\s*~\*?\s*'[^']*(?:accept|decline|cancel|expire|birth|leave|remove|rejoin|close|launch|wrapper)/u,
      `${file} must not census the catalog for names later authorized work will legitimately use`);
    assert.doesNotMatch(text, /FROM (?:information_schema\.tables|pg_class)[^;]*\b(?:relname|table_name)\s*=\s*ANY\(/u,
      `${file} must not require a fixed list of table names to stay absent from the fully migrated database`);
    assert.doesNotMatch(text, /const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST|NONEXISTENT)\w*\s*=\s*\[/u,
      `${file} declares no fixed future-object list`);
    assert.doesNotMatch(text, /assert\.(?:equal|strictEqual)\(\s*\w*(?:[Ff]oreign[Kk]ey|[Cc]onstraint|[Ii]ndex|[Pp]olic|[Cc]olumn)\w*\.length\s*,\s*\d+/u,
      `${file} must not assert an exact total count of live foreign keys, constraints, indexes or columns`);
    // The new class this slice must keep out: a live census of the TRIGGER catalog on
    // an evolvable predecessor table. A verifier may still refuse a trigger on a table
    // its own migration created or sealed; it may not forbid one on the canonical
    // membership table, which every future lifecycle slice legitimately writes.
    assert.doesNotMatch(text, /assert\.equal\(\s*\w*[Tt]rigger\w*,\s*0[^)]*\)\s*;?\s*\n?[^\n]*EPISODES/u,
      `${file} must not require the canonical membership table to carry no trigger`);
  }
});

test('no database contract - this one included - carries a migration census, so 0087 can exist without editing one', () => {
  for (const file of readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.mjs'))) {
    const text = read(`./${file}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${file} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${file} enumerates no exhaustive successor list`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0085 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated EXECUTE on the acceptance primitive', (text) => text.replace(
        `REVOKE ALL ON FUNCTION public.${ACCEPT_FN}(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${ACCEPT_FN}(uuid, uuid, uuid, uuid) TO authenticated;`)],
      ['lets a caller supply the accepting human', (text) => text.replace(
        '  p_command_id uuid, p_invitation_id uuid, p_membership_episode_id uuid, p_member_joined_event_id uuid\n) RETURNS TABLE(outcome text, accepted_command_id uuid',
        '  p_command_id uuid, p_invitation_id uuid, p_membership_episode_id uuid, p_member_joined_event_id uuid,\n  p_actor_user_id uuid DEFAULT NULL\n) RETURNS TABLE(outcome text, accepted_command_id uuid')],
      ['lets a human other than the target accept', (text) => text.replace(
        "  IF invitation.target_user_id <> u OR invitation.invitation_state <> 'PENDING' THEN",
        "  IF invitation.invitation_state <> 'PENDING' THEN")],
      ['freezes the future invitation state vocabulary in a CHECK', (text) => text.replace(
        '    invitation_state text NOT NULL,',
        "    invitation_state text NOT NULL CHECK (invitation_state IN ('PENDING','ACCEPTED','STALE_GOVERNANCE')),")],
      ['drops the one-effective-invitation rule', (text) => text.replace(
        '    CONSTRAINT shared_world_member_invitations_proposal_key UNIQUE (governance_proposal_id),\n', '')],
      ['reduces a payload-to-proposal binding to a single column', (text) => text.replace(
        '        FOREIGN KEY (governance_proposal_id, world_id, governance_operation_kind, id)\n        REFERENCES public.shared_world_governance_proposals (id, world_id, operation_kind, proposed_payload_version_id) ON DELETE RESTRICT\n);\n\n-- The removal payload',
        '        FOREIGN KEY (governance_proposal_id)\n        REFERENCES public.shared_world_governance_proposals (id) ON DELETE RESTRICT\n);\n\n-- The removal payload')],
      ['lets a rejoin reopen a closed episode', (text) => text.replace(
        '    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at, end_reason)\n    VALUES (p_membership_episode_id, payload.world_id, u, rejoin_instant, NULL, NULL);',
        '    UPDATE public.shared_world_membership_episodes SET ended_at = NULL WHERE id = payload.prior_membership_episode_id;')],
      ['lets a removal manufacture a zero-human World', (text) => text.replace(
        '  IF remaining = 0 THEN\n    RAISE EXCEPTION \'SHARED_WORLD_MEMBERSHIP_CONTRADICTORY_STATE\' USING ERRCODE=\'P0001\';\n  END IF;', '')],
      ['creates a retrospective history-access grant on acceptance', (text) => text.replace(
        '    INSERT INTO public.shared_world_member_joined_events',
        '    INSERT INTO public.shared_world_history_access_grants (id) VALUES (p_command_id);\n'
        + '    INSERT INTO public.shared_world_member_joined_events')],
      ['closes the World when a removal empties it', (text) => text.replace(
        '    INSERT INTO public.shared_world_member_removed_events',
        "    UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = payload.world_id;\n"
        + '    INSERT INTO public.shared_world_member_removed_events')],
      ['lets the terminalization mechanism reach another World', (text) => text.replace(
        '   WHERE i.world_id = changed_world\n', '   WHERE true\n')],
      ['lets the terminalization mechanism rewrite a terminal invitation', (text) => text.replace(
        "     AND i.invitation_state = 'PENDING'\n", '')],
      ['makes the topology trigger fire on every episode write', (text) => text.replace(
        '  FOR EACH ROW WHEN (NEW.ended_at IS NULL)\n', '  FOR EACH ROW\n')],
      ['inserts the episode before the invitation becomes terminal', (text) => text.replace(
        "    UPDATE public.shared_world_member_invitations i\n       SET invitation_state = 'ACCEPTED', terminal_at = join_instant,",
        "    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at, end_reason)\n"
        + '    VALUES (p_membership_episode_id, invitation.world_id, u, join_instant, NULL, NULL);\n'
        + "    UPDATE public.shared_world_member_invitations i\n       SET invitation_state = 'ACCEPTED', terminal_at = join_instant,")],
      ['adds a permanent (world, human) key that would forbid a rejoin', (text) => text.replace(
        '    CONSTRAINT shared_world_member_joined_events_episode_key UNIQUE (membership_episode_id),',
        '    CONSTRAINT shared_world_member_joined_events_episode_key UNIQUE (membership_episode_id),\n'
        + '    CONSTRAINT shared_world_member_joined_events_pair_key UNIQUE (world_id, actor_user_id),')],
      ['stores a payload blob on a governed membership table', (text) => text.replace(
        '    created_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_add_member_payload_versions_pk',
        '    created_at timestamptz NOT NULL,\n    payload jsonb,\n    CONSTRAINT shared_world_add_member_payload_versions_pk')],
      ['records a remover identity', (text) => text.replace(
        'DECLARE\n  committed public.shared_world_member_removal_commands;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_member_removal_commands;')],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0085`);
      const sql = weakened.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      const body = sql.slice(0, sql.indexOf('DO $$\nDECLARE'));
      const bodies = Object.fromEntries([...OWN_FUNCTIONS, TRIGGER_FN].map((name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const start = weakened.indexOf("SET search_path='' AS $$", create);
        const end = weakened.indexOf('\nEND$$;', start);
        return [name, create < 0 || start < 0 || end < 0 ? '' : weakened.slice(start, end)];
      }));
      const caught = [
        () => assert.doesNotMatch(sql, /\bGRANT\b/u),
        () => {
          const create = weakened.indexOf(`CREATE FUNCTION public.${ACCEPT_FN}(`);
          const open = create + `CREATE FUNCTION public.${ACCEPT_FN}(`.length;
          const declared = weakened.slice(open, weakened.indexOf(') RETURNS', open));
          assert.deepEqual([...declared.matchAll(/(p_[a-z_]+)\s+uuid/gu)].map((m) => m[1]),
            ['p_command_id', 'p_invitation_id', 'p_membership_episode_id', 'p_member_joined_event_id']);
        },
        () => assert.match(bodies[ACCEPT_FN], /invitation\.target_user_id <> u/u),
        () => assert.doesNotMatch(sql, /CHECK \(invitation_state IN/u),
        () => assert.match(sql, /CONSTRAINT shared_world_member_invitations_proposal_key UNIQUE \(governance_proposal_id\)/u),
        () => assert.equal((sql.match(/FOREIGN KEY \(governance_proposal_id, world_id, governance_operation_kind, id\)/gu) ?? []).length, 3),
        () => assert.doesNotMatch(bodies[REJOIN_FN], /UPDATE public\.shared_world_membership_episodes/u),
        () => assert.match(bodies[REMOVE_FN], /IF remaining = 0 THEN/u),
        () => assert.ok(!body.toLowerCase().includes('history_access')),
        () => assert.ok(!body.includes('UPDATE public.shared_worlds')),
        () => assert.match(bodies[TRIGGER_FN], /WHERE i\.world_id = changed_world/u),
        () => assert.match(bodies[TRIGGER_FN], /AND i\.invitation_state = 'PENDING'/u),
        () => assert.match(sql, /FOR EACH ROW WHEN \(NEW\.ended_at IS NULL\)/u),
        () => assert.ok(bodies[ACCEPT_FN].indexOf("SET invitation_state = 'ACCEPTED'")
          < bodies[ACCEPT_FN].indexOf('INSERT INTO public.shared_world_membership_episodes')),
        () => assert.doesNotMatch(sql, /UNIQUE \(world_id, (?:target_|actor_)?user_id\)/u),
        () => assert.doesNotMatch(sql, /^\s{4}payload jsonb,/mu),
        () => assert.doesNotMatch(bodies[REMOVE_FN], /auth\.uid/u),
      ];
      let refused = false;
      for (const check of caught) {
        try { check(); } catch { refused = true; break; }
      }
      assert.ok(refused, `a migration that ${reason} must be refused by at least one structural check`);
    }
  });

// ---------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
// ---------------------------------------------------------------------------

/** Only the paths this contract actually reads. */
const MIRRORED = ['database', 'apps/api/src/connected-worlds', '.github/workflows/api-ci.yml', 'package.json',
  'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04e-forward-');
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

test('I-04F, I-04G, a Launch Gate and every later authorized slice leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    // Registered the moment the mirror exists, so no path out of this test can leave the tree behind.
    t.after(() => removeHarnessMirror(mirror));
    try {
      // The repository, several authorized steps into its future - which is the future
      // this slice exists to serve.
      write(mirror, 'database/migrations/0087_shared_world_historical_access_and_closure_v1.sql',
        '-- A later reviewed slice: selective past history and Standard World closure (I-04F).\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.shared_world_history_access_grants (id uuid PRIMARY KEY, world_id uuid NOT NULL,\n'
        + '  audience_user_id uuid NOT NULL, from_at timestamptz, to_at timestamptz);\n'
        + 'CREATE TABLE public.shared_world_closed_view_entitlements (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'ALTER TABLE public.shared_world_membership_episodes\n'
        + "  ADD CONSTRAINT shared_world_membership_episodes_end_reason_check\n"
        + "  CHECK (end_reason IS NULL OR end_reason IN ('VOLUNTARY_LEAVE','REMOVED','WORLD_CLOSED'));\n"
        + 'ALTER TABLE public.shared_world_member_invitations ADD COLUMN closure_note text;\n'
        + 'CREATE FUNCTION public.commit_shared_world_end_v1(p_command_id uuid, p_proposal_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "BEGIN\n  UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED', closed_at=clock_timestamp() WHERE id = p_proposal_id;\n"
        + 'END$fn$;\n'
        + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_end_v1(uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/migrations/0088_shared_conversation_runtime_and_launch_gate_v1.sql',
        '-- A later reviewed slice: the Shared material runtime (I-04G) and the Launch Gate (CW2-08).\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.shared_world_material (id uuid PRIMARY KEY, world_id uuid NOT NULL, body text);\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL);\n'
        + 'CREATE FUNCTION public.accept_shared_world_member_invitation_gated_v1(p_command_id uuid, p_invitation_id uuid,\n'
        + '  p_membership_episode_id uuid, p_member_joined_event_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + `  PERFORM 1 FROM public.${ACCEPT_FN}(p_command_id, p_invitation_id, p_membership_episode_id, p_member_joined_event_id);\n`
        + 'END$fn$;\n'
        + 'GRANT EXECUTE ON FUNCTION public.accept_shared_world_member_invitation_gated_v1(uuid, uuid, uuid, uuid) TO authenticated;\n'
        + 'CREATE TRIGGER shared_world_material_audit AFTER INSERT ON public.shared_world_membership_episodes\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.commit_shared_world_end_v1();\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0087.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/verify-migration-0088.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-historical-access-and-closure-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      write(mirror, 'apps/api/src/connected-worlds/closure/shared-closure.controller.ts',
        "import { Controller, Post } from '@nestjs/common';\n@Controller('shared-worlds')\nexport class SharedClosureController { @Post('end') end(): void {} }\n");
      assert.ok(runInMirror(mirror).ok,
        'the I-04F history and closure substrate, the I-04G material runtime, a Launch Gate with a gated wrapper, '
        + 'a broader end-reason vocabulary, an additive column on a table 0085 owns, a later trigger, a controller '
        + 'and migrations 0087/0088 must all leave this contract passing');

      // And the regressions it must still refuse.
      const regressions = [
        ['0085 itself grants EXECUTE', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${REMOVE_FN}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${REMOVE_FN}(uuid, uuid, uuid) TO authenticated;`)],
        ['a frozen predecessor migration is edited', () => patch(mirror, 'database/migrations/0084_shared_world_governance_approval_foundation_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0085 adds a column to a predecessor table', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'ALTER TABLE public.shared_world_governance_proposals\n  ADD CONSTRAINT shared_world_governance_proposals_excluded_episode_binding_key',
          'ALTER TABLE public.shared_world_governance_proposals ADD COLUMN proposer_user_id uuid;\nALTER TABLE public.shared_world_governance_proposals\n  ADD CONSTRAINT shared_world_governance_proposals_excluded_episode_binding_key')],
        ['0085 drops the invitation terminal-consistency rule', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          "    CONSTRAINT shared_world_member_invitations_terminal_consistency_check\n        CHECK ((invitation_state = 'PENDING') = (terminal_at IS NULL)),\n", '')],
        ['0085 lets a non-target accept an invitation', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          "  IF invitation.target_user_id <> u OR invitation.invitation_state <> 'PENDING' THEN",
          "  IF invitation.invitation_state <> 'PENDING' THEN")],
        ['0085 lets the trigger terminalize invitations of another World', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '   WHERE i.world_id = changed_world\n', '   WHERE true\n')],
        ['a repaired predecessor verifier restores its membership-table trigger census',
          () => patch(mirror, 'database/verify-migration-0076.mjs',
            'if (table === EPISODES) {', 'if (false) {')],
        ['the CI step for this slice is removed', () => patch(mirror, '.github/workflows/api-ci.yml',
          `run: npm run ${OWN_SCRIPT}}`, 'run: echo skipped}')],
      ];
      for (const [reason, plant] of regressions) {
        const snapshot = buildMirror();
        try {
          plant(mirror);
          assert.equal(runInMirror(mirror).ok, false, `a repository where ${reason} must still be refused`);
        } finally {
          // The wipe-and-restore has to actually happen: a mirror that kept a planted
          // regression would make every scenario after this one prove the wrong thing.
          const wiped = removeHarnessMirror(mirror);
          assert.ok(wiped.removed,
            `the mirror must be wiped before the snapshot is restored: ${wiped.error?.message ?? wiped.refused ?? ''}`);
          cpSync(snapshot, mirror, { recursive: true });
          removeHarnessMirror(snapshot);
        }
      }
    } finally {
      removeHarnessMirror(mirror);
    }
  });
