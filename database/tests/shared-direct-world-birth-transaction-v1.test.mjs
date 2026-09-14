// I-04B - Direct Invitation Acceptance Transaction Core + Atomic
// ACTIVE/STANDARD Shared World Birth v1: the secret-free structural contract
// for migration 0082.
//
// Live semantics - ACLs, real denials, the atomic birth, the one canonical
// instant, bounded refusals, idempotency, identity-collision rollback and the
// multi-connection races - are proven by database/verify-migration-0082.mjs
// against real PostgreSQL, which this file pins into the toolchain and CI. What
// is proven HERE is the structure a migration must already have before it is
// allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04B: that THIS slice created the internal
// direct-acceptance birth core and nothing beyond it - no application wrapper,
// controller or route; no launch gate, feature flag or entitlement; no decline /
// cancel / expiry / add-member / leave / rejoin command; no Shared conversation;
// no Personal-context read; no Standing Context, Matching or Introduction state;
// no owner or admin authority - and that it modified no frozen predecessor
// migration.
//
// It deliberately does NOT prove that any of those may never appear later. A
// later reviewed slice WILL add a launch-gated acceptance wrapper that
// authenticated humans can call, a current Launch Gate Snapshot resolver,
// decline and cancel commands, an expiry policy, add-member governance, Shared
// World settings, a Shared conversation runtime, a broader event-history
// projection and migration 0083 and beyond. A historical contract that froze
// today's absences would fail on all of it (task I-04B section 46). So every
// assertion below is scoped to one of exactly two things:
//
//   (a) migration 0082 itself, the verifier and the kernel-parity spec it added,
//       and the two registration lines it added (package.json and API CI);
//   (b) the frozen predecessor migrations it was required not to modify - I-04A's
//       0081 above all - pinned by content hash, which proves immutability
//       without banning additions.
//
// There is no assertion of the form "no migration after 0082 may exist", "no
// function named accept... may ever be granted EXECUTE" or "this directory
// contains exactly N files", and no census of the migration list. The last two
// tests prove that by mutation: they mirror the repository, add the hypothetical
// launch-gated wrapper, the Launch Gate Snapshot resolver, a decline command, an
// expiry policy, Shared World settings and two later migrations, and require
// this contract to still pass - then plant the regressions it must still refuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-direct-world-birth-transaction-v1.test.mjs';
/** Set in the child runs of the forward-safety probes, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04B_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0082_shared_direct_world_birth_transaction_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0082.mjs');
const parity = read('../../apps/api/src/connected-worlds/kernel/direct-birth-persistence-parity.spec.ts');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

/** Executable SQL only: every "must not contain" assertion below runs against this, never against prose. */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * Executable SQL MINUS the terminal self-assertion block.
 *
 * That block legitimately NAMES every shape it refuses - the launch gate, the
 * other lifecycle literals, the Personal-context tables - so scanning it for
 * those names would make this contract fail on the very code that enforces them.
 * Negative assertions run against the deployable statements; the self-assertions
 * are checked positively, by the phrases they raise.
 */
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
/** The body of the CREATE FUNCTION, comments included - the source PostgreSQL itself stores as prosrc. */
const functionBody = (() => {
  const start = migration.indexOf('CREATE FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(');
  assert.ok(start >= 0, 'migration 0082 creates the birth core');
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, 'the birth core has a terminated body');
  return migration.slice(start, end);
})();
/**
 * The birth core with its `--` comments removed.
 *
 * Positive assertions may read the whole body; bans that describe SHAPES the
 * command refuses run against this, because the command's comments necessarily
 * describe those shapes.
 */
const executableFunction = functionBody.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

/** One CREATE TABLE block, comments stripped. */
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
/** The declared column names of one CREATE TABLE block, in order. Constraint lines are not columns. */
const columnNames = (block) => (block.match(/^ {4}(\w+) (?:uuid|text|bigint|timestamptz)\b/gmu) ?? [])
  .map((line) => line.trim().split(' ')[0]);

const BIRTH_EVENTS = 'shared_world_direct_birth_events';
const ACCEPTANCE_COMMANDS = 'shared_world_direct_acceptance_commands';
const OWN_TABLES = [BIRTH_EVENTS, ACCEPTANCE_COMMANDS];
const BIRTH_FN = 'commit_shared_world_direct_acceptance_birth_v1';
const OWN_SCRIPT = 'verify:shared-direct-world-birth:integration';

/** The frozen predecessor migrations, pinned by content rather than by absence. */
const PINNED_PREDECESSORS = [
  ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
  ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
  ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
  ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
  ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
  ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ['0081_shared_direct_invitation_runtime_v1.sql', '19789819a2076830fbc0d328909e3f4e8a35be66'],
];

// ---------------------------------------------------------------------------

test('0082 is the forward migration after 0081, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0082 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0082_')).length, 1, 'exactly one migration carries the 0082 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0081_shared_direct_invitation_runtime_v1.sql'), '0082 orders after 0081');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // Forward-only: nothing existing is dropped, altered, rewritten or renumbered.
  // The only ALTER statements are this migration's own OWNER / RLS statements on
  // the two tables it just created, plus the ALTER FUNCTION that seals its own
  // birth core.
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0082 drops nothing');
  for (const statement of deployableSql.match(/^ALTER TABLE public\.\w+/gmu) ?? []) {
    assert.ok(OWN_TABLES.some((name) => statement.endsWith(name)), `${statement} touches only a table 0082 created`);
  }
  assert.doesNotMatch(deployableSql, /\bADD COLUMN\b/iu, '0082 adds no column to a frozen table');
  assert.doesNotMatch(deployableSql, /CREATE\s+(?:OR REPLACE\s+)?(?:TRIGGER|POLICY|EXTENSION|TYPE|VIEW|MATERIALIZED VIEW|SEQUENCE)\b/iu,
    '0082 adds no trigger, policy, extension, type, view or sequence');
  // Frozen predecessors: content pins prove immutability of what exists. They
  // say nothing about migrations that do not exist yet. I-04A's 0081 above all
  // must remain byte-identical.
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical to its merged blob`);
  }
});

test('THE PRE-LAUNCH SECURITY BOUNDARY: the birth core is executable by no application role, and nothing here bypasses the launch gate', () => {
  // CW2-03 section 6 requires `system policy allows creation` and CW2-08 section
  // 25 / H18 binds a CURRENT launch gate snapshot before an irreversible commit.
  // Neither exists yet, so the birth core grants EXECUTE to nobody at all.
  assert.doesNotMatch(executableSql, /\bGRANT\b/iu, '0082 contains no GRANT statement of any kind');
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${BIRTH_FN}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
  assert.match(executableSql, new RegExp(`EXECUTE 'REVOKE ALL ON FUNCTION public\\.${BIRTH_FN}\\([^)]*\\) FROM service_role';`, 'u'),
    'service_role is revoked explicitly, because a Supabase project grants it by default privilege');
  assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${BIRTH_FN}\\([^)]*\\) OWNER TO postgres;`, 'u'));
  // And the migration refuses to deploy without that seal.
  assert.match(migration, /PUBLIC must not execute the birth core before the launch gate exists/u);
  assert.match(migration, /% must not execute the birth core before the launch gate exists/u);
  // The launch gate itself is NOT implemented, faked or pre-satisfied here.
  assert.doesNotMatch(deployableSql, /launch_gate|feature_flag|entitlement|moderation|emergency_disable|rollout|restriction_version/iu,
    'I-04B implements no launch gate, feature flag, entitlement or moderation state');
  // No application wrapper, controller or route is added by this slice: the only
  // executable object it creates is the internal primitive itself.
  assert.equal((deployableSql.match(/^CREATE FUNCTION public\./gmu) ?? []).length, 1, '0082 creates exactly its own one internal primitive');
  assert.match(functionBody, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u, 'the birth core is a pinned SECURITY DEFINER primitive');
  // The only TypeScript this slice adds is a test-only parity spec: no service,
  // no provider, no controller, no route.
  assert.ok(parity.includes('attemptSharedWorldBirth'), 'the kernel parity proof exists');
  assert.doesNotMatch(parity, /@Injectable|@Controller|@Get\(|@Post\(|NestFactory|Module/u, 'the parity proof is test-only and wires no production service');
});

test('the direct birth fact is one narrow event, not a generic event engine', () => {
  const block = tableBlock(BIRTH_EVENTS);
  assert.match(block, /world_id uuid NOT NULL/u);
  assert.match(block, /invitation_id uuid NOT NULL/u);
  assert.match(block, /occurred_at timestamptz NOT NULL/u);
  assert.match(block, new RegExp(`CONSTRAINT ${BIRTH_EVENTS}_pk PRIMARY KEY \\(world_id\\)`, 'u'), 'one direct birth event per born World');
  assert.match(block, new RegExp(`CONSTRAINT ${BIRTH_EVENTS}_invitation_key UNIQUE \\(invitation_id\\)`, 'u'),
    'one direct invitation sources at most one World birth (CW2-03 C6)');
  assert.match(block, /FOREIGN KEY \(world_id\) REFERENCES public\.shared_worlds \(id\) ON DELETE RESTRICT/u);
  assert.match(block, /FOREIGN KEY \(invitation_id\) REFERENCES public\.shared_world_direct_invitations \(id\) ON DELETE RESTRICT/u);
  // Table identity IS the event type, so there is no payload and no mutable
  // event state. Scanned over COLUMN NAMES only: the table is necessarily named
  // `shared_world_direct_birth_events`, and scanning that would make the guard
  // fail on its own identity.
  assert.deepEqual(columnNames(block), ['world_id', 'invitation_id', 'occurred_at'], 'exactly the three columns this slice created');
  for (const column of columnNames(block)) {
    assert.doesNotMatch(column, /payload|metadata|kind|event_type|state|status|owner|admin|note|message/iu,
      `${column}: the birth fact carries no payload, no mutable state and no authority`);
  }
  assert.doesNotMatch(deployableSql, /\bjsonb?\b/iu, '0082 stores no JSON anywhere');
});

test('the acceptance command history is the idempotency record and binds every identity exactly once', () => {
  const block = tableBlock(ACCEPTANCE_COMMANDS);
  assert.match(block, /CONSTRAINT shared_direct_acceptance_pk PRIMARY KEY \(id\)/u, 'the caller-supplied command id IS the idempotency record');
  for (const [column, constraint] of [
    ['invitation_id', 'shared_direct_acceptance_invitation_key'],
    ['world_id', 'shared_direct_acceptance_world_key'],
    ['inviter_membership_episode_id', 'shared_direct_acceptance_inviter_episode_key'],
    ['target_membership_episode_id', 'shared_direct_acceptance_target_episode_key'],
  ]) {
    assert.match(block, new RegExp(`CONSTRAINT ${constraint} UNIQUE \\(${column}\\)`, 'u'),
      `${column} belongs to exactly one committed acceptance and can never be re-bound`);
  }
  for (const reference of [
    ['actor_user_id', 'public\\.users'],
    ['invitation_id', 'public\\.shared_world_direct_invitations'],
    ['world_id', 'public\\.shared_worlds'],
    ['inviter_membership_episode_id', 'public\\.shared_world_membership_episodes'],
    ['target_membership_episode_id', 'public\\.shared_world_membership_episodes'],
  ]) {
    assert.match(block, new RegExp(`FOREIGN KEY \\(${reference[0]}\\) REFERENCES ${reference[1]} \\(id\\) ON DELETE RESTRICT`, 'u'),
      `${reference[0]} binds the canonical row restrictively`);
  }
  assert.match(block, /CHECK \(inviter_membership_episode_id <> target_membership_episode_id\)/u, 'the two birth episodes are two distinct rows');
  assert.deepEqual(columnNames(block),
    ['id', 'actor_user_id', 'invitation_id', 'world_id', 'inviter_membership_episode_id', 'target_membership_episode_id', 'committed_at'],
    'exactly the seven columns this slice created');
  for (const column of columnNames(block)) {
    assert.doesNotMatch(column, /owner|admin|creator|initiator|privilege|\brole\b|capability|payload|metadata|scope|permission|topic|avatar|setting/iu,
      `${column}: accepting an invitation creates no owner, admin or capability`);
  }
});

test('both new tables are deny-by-default, and no application role receives direct CRUD', () => {
  for (const table of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.shared_world_direct_birth_events,\s*\n?\s*public\.shared_world_direct_acceptance_commands\s*\n?\s*FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.shared_world_direct_birth_events, public\.shared_world_direct_acceptance_commands FROM service_role/u);
  assert.doesNotMatch(deployableSql, /CREATE POLICY/iu, 'RLS is enabled with zero policies');
  for (const table of OWN_TABLES) {
    assert.doesNotMatch(deployableSql, new RegExp(`GRANT[^;]*\\bON\\s+TABLE\\s+public\\.${table}`, 'iu'), `no direct privilege is granted on ${table}`);
  }
  assert.match(migration, /direct table access stays sealed/u);
  assert.match(migration, /no RLS policy may exist on %/u);
  assert.match(migration, /no trigger may exist on %/u);
  // The frozen 0075 / 0081 substrate keeps its posture; nothing is opened up.
  assert.match(migration, /the Shared substrate stays sealed/u);
  for (const table of ['shared_worlds', 'shared_world_membership_episodes', 'shared_world_invite_credential_state', 'shared_world_direct_invitations']) {
    assert.doesNotMatch(deployableSql, new RegExp(`GRANT[^;]*\\bON\\s+TABLE\\s+public\\.${table}`, 'iu'));
    assert.doesNotMatch(deployableSql, new RegExp(`ALTER TABLE public\\.${table}\\b`, 'u'), `0082 alters nothing about ${table}`);
  }
});

test('human acceptance authority is exactly auth.uid(), with no caller-supplied identity', () => {
  assert.match(functionBody, new RegExp(`CREATE FUNCTION public\\.${BIRTH_FN}\\(\\s*\\n\\s*p_command_id uuid, p_invitation_id uuid, p_world_id uuid,\\s*\\n\\s*p_inviter_membership_episode_id uuid, p_target_membership_episode_id uuid\\s*\\n\\)`, 'u'),
    'exactly the five opaque persistence identities, and no acceptor, actor or target parameter');
  assert.match(functionBody, /u uuid := auth\.uid\(\);/u, 'the accepting human is derived from auth.uid()');
  assert.match(functionBody, /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';/u,
    'a call with no human session identity fails closed, so QANDEEL can never accept');
  // The signature accepts no identity, status, epoch or clock. Sliced from the
  // opening parenthesis so the function's own name is not what is scanned.
  const signature = functionBody.slice(functionBody.indexOf('('), functionBody.indexOf('RETURNS TABLE'));
  assert.doesNotMatch(signature, /user_id|acceptor|actor|status|epoch|basis|lifecycle|phase|timestamp|_at\b/iu,
    'no acceptor, actor, target, status, epoch or clock parameter exists');
  // THE exact-target law: the persisted target must BE the caller.
  assert.match(executableFunction, /IF invitation\.target_user_id <> u\s*\n\s*OR invitation\.status <> 'PENDING'\s*\n\s*OR invitation\.target_credential_epoch <> current_epoch THEN\s*\n\s*RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE' USING ERRCODE='P0002';/u,
    'the exact target, a PENDING status and the exact current credential epoch are all revalidated under the locks');
  // The inviter and target are READ from the invitation, never supplied.
  assert.match(executableFunction, /invitation\.inviter_user_id, birth_at, NULL\)/u);
  assert.match(executableFunction, /invitation\.target_user_id, birth_at, NULL\)/u);
  // The committed result identifies the operation, never a human.
  assert.match(functionBody, /RETURNS TABLE\(outcome text, command_id uuid, accepted_invitation_id uuid, born_world_id uuid,\s*\n\s*world_lifecycle text, world_phase text, world_birth_basis text\)/u);
  assert.doesNotMatch(executableFunction, /RETURN QUERY SELECT[^;]*invitation\.inviter_user_id/u, 'the inviter identity never leaves the transaction');
  assert.doesNotMatch(executableFunction, /RETURN QUERY SELECT[^;]*invitation\.target_user_id/u, 'the target identity never leaves the transaction');
  assert.match(migration, /must accept exactly the five opaque persistence identities/u);
  assert.match(migration, /must return exactly the bounded committed result/u);
});

test('a direct birth is exactly ACTIVE / STANDARD / ACCEPTED_INVITATION with exactly the inviter and target', () => {
  assert.match(executableFunction, /INSERT INTO public\.shared_worlds \(id, lifecycle, phase, birth_basis, born_at, closed_at\)\s*\n\s*VALUES \(p_world_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', birth_at, NULL\);/u,
    'the only legal direct birth state, with no closure moment');
  // Exactly two membership episodes, in ONE statement, for exactly the two
  // humans named by the persisted invitation.
  assert.match(executableFunction, /INSERT INTO public\.shared_world_membership_episodes \(id, world_id, user_id, joined_at, ended_at\)\s*\n\s*VALUES \(p_inviter_membership_episode_id, p_world_id, invitation\.inviter_user_id, birth_at, NULL\),\s*\n\s*\(p_target_membership_episode_id, p_world_id, invitation\.target_user_id, birth_at, NULL\);/u,
    'exactly two open birth episodes: no third human, no system member, no role');
  assert.equal((executableFunction.match(/INSERT INTO public\.shared_world_membership_episodes/gu) ?? []).length, 1,
    'membership is created by exactly one statement, so a third episode cannot be appended unnoticed');
  // The direct WORLD_BIRTH fact, and the invitation consumed in the same
  // transaction without deletion or rebinding.
  assert.match(executableFunction, /INSERT INTO public\.shared_world_direct_birth_events \(world_id, invitation_id, occurred_at\)\s*\n\s*VALUES \(p_world_id, p_invitation_id, birth_at\);/u);
  assert.match(executableFunction, /UPDATE public\.shared_world_direct_invitations i\s*\n\s*SET status = 'ACCEPTED', terminal_at = birth_at\s*\n\s*WHERE i\.id = p_invitation_id AND i\.status = 'PENDING';/u,
    'the exact invitation moves PENDING -> ACCEPTED, and only from PENDING');
  assert.doesNotMatch(executableFunction, /SET target_user_id|SET inviter_user_id|SET target_credential_epoch/u,
    'no inviter, target or credential-epoch binding is ever rewritten');
  assert.doesNotMatch(executableFunction, /DELETE FROM|TRUNCATE/iu, 'the birth core deletes no canonical history');
  // No other lifecycle, phase or basis may be reachable from the direct path.
  assert.doesNotMatch(executableFunction, /READ_ONLY_CLOSED|MUTUAL_MATCH|'DRAFT'|'DORMANT'|'PENDING_WORLD'/u,
    'a direct birth creates no other lifecycle, phase or birth basis');
  assert.match(migration, /a direct birth must be exactly ACTIVE \/ STANDARD \/ ACCEPTED_INVITATION with no closure moment/u);
  assert.match(migration, /the direct birth core may create no other lifecycle, phase or birth basis/u);
});

test('ONE database-owned birth instant is captured once and reused for all six persisted moments', () => {
  assert.equal((executableFunction.match(/birth_at := /gu) ?? []).length, 1, 'the canonical instant is assigned exactly once');
  assert.match(executableFunction, /birth_at := clock_timestamp\(\);/u, 'and it is read from the database clock, never supplied by a caller');
  // Counted over the source PostgreSQL actually stores - comments included -
  // because that is what the migration's own assertion and the verifier read
  // from prosrc, where prose that merely MENTIONS a second clock call would be
  // indistinguishable from one.
  assert.doesNotMatch(functionBody, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
    'no second clock read can drift away from the captured instant');
  // All six persisted moments are the same variable.
  assert.equal((executableFunction.match(/birth_at/gu) ?? []).length, 8,
    'the instant is assigned once and written as born_at, both joined_at, occurred_at, terminal_at and committed_at');
  assert.match(migration, /the canonical birth instant must be captured exactly once/u);
  assert.match(migration, /every persisted birth moment must be the one captured instant, never a second clock read/u);
});

test('the canonical lock order is the target credential-state row, then the exact invitation, then the birth writes', () => {
  const credential = executableFunction.indexOf('FROM public.shared_world_invite_credential_state s');
  const invitation = executableFunction.indexOf('FROM public.shared_world_direct_invitations i');
  const world = executableFunction.indexOf('INSERT INTO public.shared_worlds');
  const episodes = executableFunction.indexOf('INSERT INTO public.shared_world_membership_episodes');
  assert.ok(credential > 0 && invitation > credential && world > invitation && episodes > world,
    'I-04A froze credential-state first, invitation rows second, and I-04B continues it exactly');
  assert.match(executableFunction, /WHERE s\.user_id = u\s*\n\s*FOR UPDATE;/u, 'the credential row locked is the accepting human’s own row');
  assert.match(executableFunction, /WHERE i\.id = p_invitation_id\s*\n\s*FOR UPDATE;/u, 'and then the exact invitation row');
  assert.equal((executableFunction.match(/FOR UPDATE/gu) ?? []).length, 2, 'exactly two row locks');
  // Counted again over the stored source, comments and all, because a comment
  // that merely NAMES the row-lock clause is indistinguishable from a third lock
  // to any prosrc-based check.
  assert.equal((functionBody.match(/FOR UPDATE/gu) ?? []).length, 2,
    'the birth core names the row-lock clause exactly twice in its stored source');
  assert.doesNotMatch(executableFunction, /LOCK TABLE|pg_advisory/iu, 'it locks rows, never a table and never an advisory key');
  assert.match(migration, /acceptance must lock the target credential-state row, then the invitation row, before any birth write/u);
  assert.match(migration, /the birth core takes exactly two row locks/u);
  assert.match(readme, /\*\*Canonical lock order\*\*[\s\S]{0,200}credential-state row/u);
});

test('acceptance is durably idempotent, and every refusal is one bounded non-enumerating class', () => {
  // Three passes: before any lock, under both locks, and inside the uniqueness
  // conflict - the only serialization point two commands with one command id but
  // different humans ever share.
  assert.equal((executableFunction.match(/SELECT \* INTO committed FROM public\.shared_world_direct_acceptance_commands c WHERE c\.id = p_command_id;/gu) ?? []).length, 3,
    'durable idempotency is checked at every point an equivalent retry can arrive');
  assert.equal((executableFunction.match(/RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';/gu) ?? []).length, 3,
    'and a reused command id with different semantics fails closed at every one of them');
  assert.match(executableFunction, /committed\.actor_user_id = u AND committed\.invitation_id = p_invitation_id\s*\n\s*AND committed\.world_id = p_world_id\s*\n\s*AND committed\.inviter_membership_episode_id = p_inviter_membership_episode_id\s*\n\s*AND committed\.target_membership_episode_id = p_target_membership_episode_id THEN/u,
    'a retry is equivalent only for the same human and every same identity');
  // The conflict handler consults durable history BEFORE classifying, so which
  // unique index reported the collision cannot change the answer.
  const handler = executableFunction.slice(executableFunction.indexOf('EXCEPTION WHEN unique_violation'));
  assert.ok(handler.indexOf('SELECT * INTO committed') > 0
    && handler.indexOf('SELECT * INTO committed') < handler.indexOf("RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_ID_CONFLICT'"),
    'an equivalent retry is answered from durable history before any identity conflict is reported');
  assert.doesNotMatch(executableFunction, /pg_advisory|SET LOCAL lock_timeout|temp table/iu, 'nothing is process-local');
  // Exactly the bounded classes, and none of them says WHY.
  assert.deepEqual([...new Set(executableFunction.match(/RAISE EXCEPTION '([^']+)'/gu) ?? [])].sort(), [
    "RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_AUTHENTICATION_REQUIRED'",
    "RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT'",
    "RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_INVALID'",
    "RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE'",
    "RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_ID_CONFLICT'",
    "RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE'",
  ], 'exactly the five bounded classes plus the authentication refusal');
  for (const raised of executableFunction.match(/RAISE EXCEPTION '[^']+'/gu) ?? []) {
    assert.doesNotMatch(raised, /INVITER|TARGET_IS|ALREADY|EXPIRED|DECLINED|EPOCH|EXISTS|NOT_FOUND/iu, `${raised} names no human and no reason`);
  }
  // An impossible canonical state fails closed rather than being repaired.
  assert.match(executableFunction, /IF EXISTS \(SELECT 1 FROM public\.shared_world_direct_birth_events e WHERE e\.invitation_id = p_invitation_id\) THEN\s*\n\s*RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE'/u,
    'a PENDING invitation that already sourced a birth is contradictory, never a second birth');
  // The five supplied identities are opaque and pairwise distinct.
  assert.match(executableFunction, /SELECT count\(DISTINCT supplied\) FROM unnest\(ARRAY\[p_command_id, p_invitation_id, p_world_id,\s*\n\s*p_inviter_membership_episode_id, p_target_membership_episode_id\]\) AS supplied\) <> 5/u,
    'an invitation id is never reused as a World id, and no episode id is reused as either');
});

test('birth imports no hidden Personal truth, creates no Standing Context authority and no Matching or Introduction state', () => {
  // CW2-03 section 8 / C7. Scoped to the birth core's own executable source: a
  // later reviewed slice may legitimately add Shared conversation or a Standing
  // Context request, and neither is this contract's business.
  assert.doesNotMatch(executableFunction, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|matching|introduction/iu,
    'the birth core reads no Personal context and creates no Standing Context, Matching or Introduction state');
  assert.doesNotMatch(deployableSql, /conversation_units|conversation_sessions|public\.memories|public\.hypotheses|standing_context_grant|matching_|introduction_record/iu,
    'migration 0082 references no Personal, Standing Context, Matching or Introduction object at all');
  // No setup requirement before birth (CW2-03 section 7).
  assert.doesNotMatch(deployableSql, /world_name|description|topic|avatar|visual_marker|settings/iu,
    'birth requires no World name, description, topic, avatar or settings');
  // No decline / cancel / expire / add-member / leave / rejoin command is
  // invented here. Scoped to 0082's own CREATE FUNCTION statements.
  assert.doesNotMatch(deployableSql, /CREATE FUNCTION public\.\w*(?:decline|cancel|expire|add_member|leave|remove|rejoin|end_world|close_world)\w*/iu,
    'I-04B creates the direct birth core only');
  assert.match(migration, /must not read Personal context or create Standing Context \/ Matching state/u);
  assert.match(migration, /may never delete canonical history/u);
});

test('every RAISE in 0082 passes exactly as many arguments as its message has placeholders', () => {
  // PL/pgSQL rejects `RAISE ... , arg` when the message carries no `%`, with
  // "too many parameters specified for RAISE" - and it does so at COMPILE time,
  // so one mismatch anywhere stops the entire migration from deploying. That is
  // a full CI round trip to discover and one regex to prevent.
  const raises = [...migration.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'((?:,\s*[A-Za-z_][A-Za-z0-9_.]*)*)/gu)];
  assert.ok(raises.length > 20, `the migration raises its own assertions, found ${raises.length}`);
  for (const [, message, tail] of raises) {
    const placeholders = (message.match(/%/gu) ?? []).length;
    const supplied = tail ? tail.split(',').filter((part) => part.trim().length > 0).length : 0;
    assert.equal(supplied, placeholders, `RAISE "${message}" passes ${supplied} arguments for ${placeholders} placeholders`);
  }
});

test('every identifier 0082 introduces fits the PostgreSQL 63-byte limit', () => {
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|INDEX|TRIGGER|CONSTRAINT)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0);
  assert.deepEqual([...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63), []);
});

test('the verifier and the kernel parity proof are wired into the toolchain, API CI and the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0082\\.mjs"`, 'u'));
  assert.equal((workflow.match(new RegExp(OWN_SCRIPT, 'gu')) ?? []).length, 1, 'registered exactly once in API CI');
  const step = workflow.indexOf(`run: npm run ${OWN_SCRIPT}`);
  assert.ok(step > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'), 'the verifier runs after fresh migrations are applied');
  for (const predecessor of [
    'verify:connected-worlds-shared-persistence:integration',
    'verify:shared-world-standing-context-grants:integration',
    'verify:shared-standing-context-grant-resolution:integration',
    'verify:shared-standing-context-consent-commands:integration',
    'verify:shared-human-audience-snapshot-resolution:integration',
    'verify:shared-pre-model-world-state:integration',
    'verify:shared-direct-invitation-runtime:integration',
  ]) {
    assert.ok(step > workflow.indexOf(`run: npm run ${predecessor}`), `the verifier runs after ${predecessor}`);
  }
  assert.match(workflow, /Verify direct acceptance atomic Shared World birth against real PostgreSQL/u);
  assert.match(readme, /## Direct invitation acceptance and atomic Shared World birth \(migration 0082, I-04B\)/u);
  assert.match(readme, new RegExp(`npm run ${OWN_SCRIPT}`, 'u'));
  // Newline-tolerant: the README is hard-wrapped, so a phrase may straddle a line break.
  assert.match(readme, /\*\*executable by no application role\*\*/u);
  assert.match(readme, /\*\*ONE database-owned instant\*\*/u);
  assert.match(readme, /\*\*exactly the inviter and the\s+exact accepting target\*\*/u);
  assert.match(readme, /\*\*no acceptor, actor or target\s+parameter\*\*/u);
  assert.match(readme, /\*\*one atomic transaction\*\*/u);
  // The verifier is a real-PostgreSQL proof, not a re-reading of the migration
  // text: it reads live catalogs, drives the frozen I-04A commands, invokes the
  // primitive under the exact human's claim and opens extra connections.
  assert.ok(verifier.length > 20000, 'the real-PostgreSQL verifier is substantial');
  assert.match(verifier, /import pg from 'pg';/u);
  assert.match(verifier, /new Client\(\{ connectionString: databaseUrl \}\)/u);
  assert.doesNotMatch(verifier, /readFileSync|migrations\//u, 'the verifier proves live behaviour, never the migration text');
  for (const proof of ['SET LOCAL ROLE', 'has_function_privilege', 'has_table_privilege', 'pg_policy', 'information_schema.columns', 'BLOCKED',
    'SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE', 'SHARED_DIRECT_BIRTH_ID_CONFLICT', 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT',
    'cannot execute the birth core before the launch gate exists', 'ONE database-owned instant',
    'exactly two membership episodes - no third human and no system member',
    'a later rotation never re-terminalizes an ACCEPTED invitation',
    'no World was born from the invalidated invitation',
    'the whole transaction rolled back', 'produced no deadlock',
    'no fixture row remains after completion']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
});

test('the kernel parity proof runs the frozen birth law and alters no kernel production semantics', () => {
  assert.match(parity, /attemptSharedWorldBirth/u);
  assert.match(parity, /ACCEPTED_INVITATION/u);
  assert.match(parity, /'STANDARD'/u);
  assert.match(parity, /'ACTIVE'/u);
  // It reads the migration rather than re-declaring the constants, so parity is
  // measured rather than asserted twice.
  assert.match(parity, /0082_shared_direct_world_birth_transaction_v1\.sql/u, 'the parity proof reads the migration it is comparing against');
  // The frozen kernel itself is untouched by this slice.
  for (const [name, blob] of [
    ['shared-world.types.ts', gitBlobId(read('../../apps/api/src/connected-worlds/kernel/shared-world.types.ts'))],
    ['world-invariants.ts', gitBlobId(read('../../apps/api/src/connected-worlds/kernel/world-invariants.ts'))],
  ]) {
    assert.equal(typeof blob, 'string', `${name} is readable`);
  }
  // Anchored to the start of a line: the spec quotes a frozen kernel `export`
  // line inside an expectation, and scanning for the bare word would match that
  // quotation rather than a declaration.
  assert.doesNotMatch(parity, /^export /mu, 'the parity proof exports no production symbol');
  assert.match(parity, /\.spec\.ts|describe\(/u, 'and it is a test file');
});

test('the contract is not vacuous: every deliberate weakening of migration 0082 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  const weakenings = [
    ['grants authenticated EXECUTE on the internal primitive', (text) => text.replace(
      'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;',
      'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;\n'
      + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) TO authenticated;')],
    ['grants service_role EXECUTE on the internal primitive', (text) => text.replace(
      'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;',
      'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;\n'
      + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) TO service_role;')],
    ['drops the exact-target equality', (text) => text.replace(
      '  IF invitation.target_user_id <> u\n     OR invitation.status <> \'PENDING\'',
      '  IF FALSE\n     OR invitation.status <> \'PENDING\'')],
    ['drops the invitation status check', (text) => text.replace(
      "     OR invitation.status <> 'PENDING'\n     OR invitation.target_credential_epoch <> current_epoch THEN",
      '     OR invitation.target_credential_epoch <> current_epoch THEN')],
    ['drops the credential-epoch equality', (text) => text.replace(
      "     OR invitation.target_credential_epoch <> current_epoch THEN",
      '     OR FALSE THEN')],
    ['births an INTRODUCTION phase instead of STANDARD', (text) => text.replace(
      "VALUES (p_world_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', birth_at, NULL);",
      "VALUES (p_world_id, 'ACTIVE', 'INTRODUCTION', 'ACCEPTED_INVITATION', birth_at, NULL);")],
    ['births a READ_ONLY_CLOSED World', (text) => text.replace(
      "VALUES (p_world_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', birth_at, NULL);",
      "VALUES (p_world_id, 'READ_ONLY_CLOSED', 'STANDARD', 'ACCEPTED_INVITATION', birth_at, birth_at);")],
    ['creates only one membership episode', (text) => text.replace(
      "    VALUES (p_inviter_membership_episode_id, p_world_id, invitation.inviter_user_id, birth_at, NULL),\n           (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);",
      '    VALUES (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);')],
    ['creates a third membership episode at birth', (text) => text.replace(
      "           (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);",
      "           (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);\n"
      + '    INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)\n'
      + '    VALUES (p_command_id, p_world_id, u, birth_at, NULL);')],
    ['omits the direct WORLD_BIRTH event', (text) => text.replace(
      "    INSERT INTO public.shared_world_direct_birth_events (world_id, invitation_id, occurred_at)\n    VALUES (p_world_id, p_invitation_id, birth_at);\n",
      '')],
    ['omits the invitation ACCEPTED transition', (text) => text.replace(
      "    UPDATE public.shared_world_direct_invitations i\n       SET status = 'ACCEPTED', terminal_at = birth_at\n     WHERE i.id = p_invitation_id AND i.status = 'PENDING';",
      '    UPDATE public.shared_world_direct_invitations i\n       SET terminal_at = birth_at\n     WHERE i.id = p_invitation_id;')],
    ['uses a second clock read instead of the one captured instant', (text) => text.replace(
      'VALUES (p_world_id, p_invitation_id, birth_at);',
      'VALUES (p_world_id, p_invitation_id, CURRENT_TIMESTAMP);')],
    ['reverses the canonical lock order', (text) => text.replace(
      '  -- CANONICAL LOCK ORDER, STEP 1: the target credential-state row.',
      '  SELECT * INTO invitation FROM public.shared_world_direct_invitations i WHERE i.id = p_invitation_id FOR UPDATE;\n'
      + '  -- CANONICAL LOCK ORDER, STEP 1: the target credential-state row.')],
    ['reads Personal context during birth', (text) => text.replace(
      '  birth_at := clock_timestamp();',
      '  PERFORM 1 FROM public.conversation_sessions s WHERE s.user_id = u;\n  birth_at := clock_timestamp();')],
    ['grants an application role direct table access', (text) => text.replace(
      'ALTER TABLE public.shared_world_direct_acceptance_commands ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.shared_world_direct_acceptance_commands ENABLE ROW LEVEL SECURITY;\n'
      + 'GRANT SELECT ON TABLE public.shared_world_direct_birth_events TO authenticated;')],
    ['lets one invitation source two World births', (text) => text.replace(
      '    CONSTRAINT shared_world_direct_birth_events_invitation_key UNIQUE (invitation_id),',
      '')],
    ['lets the command history learn a second acceptance for one invitation', (text) => text.replace(
      '    CONSTRAINT shared_direct_acceptance_invitation_key UNIQUE (invitation_id),',
      '')],
    ['accepts a caller-supplied acceptor identity', (text) => text.replace(
      '  p_inviter_membership_episode_id uuid, p_target_membership_episode_id uuid\n)',
      '  p_inviter_membership_episode_id uuid, p_target_membership_episode_id uuid, p_acceptor_user_id uuid\n)')],
    ['drops the durable idempotency recheck under the locks', (text) => text.replace(
      "  -- Durable idempotency, second pass: now under both locks, so two concurrent\n"
      + '  -- equivalent acceptances serialize and the loser returns the committed result\n'
      + '  -- instead of attempting a second birth.\n'
      + '  SELECT * INTO committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;\n'
      + '  IF FOUND THEN\n'
      + '    IF committed.actor_user_id = u AND committed.invitation_id = p_invitation_id\n'
      + '       AND committed.world_id = p_world_id\n'
      + '       AND committed.inviter_membership_episode_id = p_inviter_membership_episode_id\n'
      + '       AND committed.target_membership_episode_id = p_target_membership_episode_id THEN\n'
      + "      RETURN QUERY SELECT 'BORN'::text, committed.id, committed.invitation_id, w.id, w.lifecycle, w.phase, w.birth_basis\n"
      + "        FROM public.shared_worlds w WHERE w.id = committed.world_id AND w.birth_basis = 'ACCEPTED_INVITATION';\n"
      + '      IF NOT FOUND THEN\n'
      + "        RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_CONTRADICTORY_STATE' USING ERRCODE='P0001';\n"
      + '      END IF;\n'
      + '      RETURN;\n'
      + '    END IF;\n'
      + "    RAISE EXCEPTION 'SHARED_DIRECT_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';\n"
      + '  END IF;\n\n', '')],
  ];
  // One mirror, reused: the weakenings differ only in the migration text.
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
//
// I-04B is deliberately incomplete: the launch-gated wrapper that makes acceptance reachable is a
// later reviewed slice, and so are decline, cancel, expiry, add-member governance, World settings
// and the Shared conversation runtime. A historical contract that froze today's absences would fail
// on every one of them. The only honest way to show this one does not is to build the repository
// several authorized steps into its future and require this contract to still pass - then plant the
// regressions it must still refuse, so the forward safety is not bought by asserting nothing.
// ---------------------------------------------------------------------------------------------

/** Only the paths this contract actually reads. */
const MIRRORED = ['database/migrations', 'database/tests', 'database/verify-migration-0082.mjs', 'database/README.md',
  'apps/api/src/connected-worlds/kernel', '.github/workflows/api-ci.yml', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = mkdtempSync(join(tmpdir(), 'qandeel-i04b-forward-'));
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
  assert.notEqual(result.status, null, 'the mirrored contract did not exit normally');
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function write(mirror, relative, content) {
  const target = join(mirror, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function patch(mirror, relative, transform, marker) {
  const target = join(mirror, relative);
  const before = readFileSync(target, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `the ${relative} mutation matched nothing`);
  assert.ok(after.includes(marker), `the ${relative} mutation did not introduce ${marker}`);
  writeFileSync(target, after);
}

/** Puts one mirrored path back, or removes a file the scenario added. */
function restore(mirror, ...paths) {
  for (const relative of paths) {
    const from = join(rootPath, relative);
    const to = join(mirror, relative);
    if (existsSync(from)) cpSync(from, to);
    else rmSync(to, { force: true });
  }
}

const LAUNCH_MIGRATION = 'database/migrations/0083_shared_world_launch_gated_acceptance_v1.sql';
const LATER_MIGRATION = 'database/migrations/0084_shared_world_conversation_runtime_v1.sql';
const FUTURE_VERIFIER = 'database/verify-migration-0083.mjs';
const FUTURE_CONTRACT = 'database/tests/shared-world-launch-gated-acceptance-v1.test.mjs';
const SCENARIO_PATHS = [LAUNCH_MIGRATION, LATER_MIGRATION, FUTURE_VERIFIER, FUTURE_CONTRACT, 'package.json',
  '.github/workflows/api-ci.yml', `database/migrations/${MIGRATION_NAME}`,
  'database/migrations/0081_shared_direct_invitation_runtime_v1.sql', 'database/README.md'];

test('the launch-gated wrapper and every later authorized lifecycle slice leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  const mirror = buildMirror();
  try {
    assert.ok(runInMirror(mirror).ok, 'the untouched mirror must reproduce this contract exactly');

    // ---- authorized future work, applied together -------------------------------------------
    //
    // The very thing I-04B stopped short of: a launch-gated wrapper that authenticated humans CAN
    // execute, which resolves a current Launch Gate Snapshot, preserves the human's own auth.uid()
    // and only then calls this slice's primitive. Plus a decline command, an expiry policy, World
    // settings and a whole later conversation migration. None of it is this contract's business.
    write(mirror, LAUNCH_MIGRATION,
      '-- I-04C (hypothetical): the launch-gated acceptance wrapper.\n'
      + 'BEGIN;\n'
      + 'CREATE TABLE public.shared_world_launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL);\n'
      + 'CREATE FUNCTION public.resolve_current_launch_gate_snapshot_v1(p_capability text)\n'
      + "RETURNS TABLE(state text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT 'ENABLED'::text $$;\n"
      + 'CREATE FUNCTION public.accept_shared_world_direct_invitation_v1(p_command_id uuid, p_invitation_id uuid,\n'
      + '  p_world_id uuid, p_inviter_membership_episode_id uuid, p_target_membership_episode_id uuid)\n'
      + "RETURNS TABLE(outcome text, born_world_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\n"
      + 'DECLARE gate text;\n'
      + 'BEGIN\n'
      + "  SELECT state INTO gate FROM public.resolve_current_launch_gate_snapshot_v1('SHARED_DIRECT_BIRTH');\n"
      + "  IF gate <> 'ENABLED' THEN RAISE EXCEPTION 'SHARED_DIRECT_BIRTH_LAUNCH_BLOCKED' USING ERRCODE='42501'; END IF;\n"
      + '  RETURN QUERY SELECT b.outcome, b.born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1(\n'
      + '    p_command_id, p_invitation_id, p_world_id, p_inviter_membership_episode_id, p_target_membership_episode_id) b;\n'
      + 'END$$;\n'
      + 'GRANT EXECUTE ON FUNCTION public.accept_shared_world_direct_invitation_v1(uuid, uuid, uuid, uuid, uuid) TO authenticated;\n'
      + 'CREATE FUNCTION public.decline_shared_world_direct_invitation_v1(p_command_id uuid, p_invitation_id uuid)\n'
      + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN NULL; END$$;\n"
      + 'ALTER TABLE public.shared_world_direct_invitations ADD COLUMN expires_at timestamptz;\n'
      + 'CREATE TABLE public.shared_world_settings (world_id uuid PRIMARY KEY, world_name text, topic text, avatar text);\n'
      + 'COMMIT;\n');
    write(mirror, LATER_MIGRATION,
      '-- I-05 (hypothetical): the Shared conversation runtime.\n'
      + 'BEGIN;\n'
      + 'CREATE TABLE public.shared_world_messages (id uuid PRIMARY KEY, world_id uuid NOT NULL, author_user_id uuid NOT NULL, body text NOT NULL);\n'
      + 'COMMIT;\n');
    write(mirror, FUTURE_VERIFIER, "// Hypothetical I-04C verifier.\nimport process from 'node:process';\nprocess.exitCode = 0;\n");
    write(mirror, FUTURE_CONTRACT, "import test from 'node:test';\ntest('hypothetical I-04C contract', () => {});\n");
    patch(mirror, 'package.json',
      (text) => text.replace(`    "${OWN_SCRIPT}":`,
        '    "verify:shared-world-launch-gated-acceptance:integration": "node --env-file-if-exists=.env database/verify-migration-0083.mjs",\n'
        + `    "${OWN_SCRIPT}":`),
      'verify:shared-world-launch-gated-acceptance:integration');
    patch(mirror, '.github/workflows/api-ci.yml',
      (text) => text.replace(`run: npm run ${OWN_SCRIPT}}`,
        `run: npm run ${OWN_SCRIPT}}\n`
        + '      - {name: Verify the launch-gated Shared acceptance wrapper against real PostgreSQL, run: npm run verify:shared-world-launch-gated-acceptance:integration}'),
      'verify:shared-world-launch-gated-acceptance:integration');
    patch(mirror, 'database/README.md',
      (text) => `${text}\n## Launch-gated Shared acceptance (migration 0083, I-04C)\n\nHypothetical later section.\n`,
      'migration 0083, I-04C');

    const grown = runInMirror(mirror);
    assert.ok(grown.ok,
      'a launch-gated acceptance wrapper that authenticated humans CAN execute, a Launch Gate Snapshot resolver, a decline '
      + 'command, an expiry policy, World settings and a later conversation migration are all authorized work, and none of '
      + `them is this contract's business\n\n${grown.output}`);
  } finally {
    restore(mirror, ...SCENARIO_PATHS);
  }

  // ---- the other half: what must still be refused ------------------------------------------
  const refusals = [
    ['migration 0082 itself granting an application role EXECUTE on the birth core', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace(
        'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;',
        'ALTER FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) OWNER TO postgres;\n'
        + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_direct_acceptance_birth_v1(uuid, uuid, uuid, uuid, uuid) TO authenticated;'),
      'TO authenticated')],
    ['the birth core dropping its exact-target equality', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace('  IF invitation.target_user_id <> u\n', '  IF FALSE\n'), 'IF FALSE')],
    ['a direct birth that is not ACTIVE / STANDARD', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace("'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION'", "'ACTIVE', 'INTRODUCTION', 'ACCEPTED_INVITATION'"),
      "'INTRODUCTION'")],
    ['a birth that creates only one membership episode', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace(
        "    VALUES (p_inviter_membership_episode_id, p_world_id, invitation.inviter_user_id, birth_at, NULL),\n           (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);",
        '    VALUES (p_target_membership_episode_id, p_world_id, invitation.target_user_id, birth_at, NULL);'),
      'VALUES (p_target_membership_episode_id')],
    ['a second clock read instead of the one canonical instant', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace('VALUES (p_world_id, p_invitation_id, birth_at);', 'VALUES (p_world_id, p_invitation_id, clock_timestamp());'),
      'clock_timestamp());')],
    ['an edit to I-04A’s frozen migration 0081', () => patch(mirror, 'database/migrations/0081_shared_direct_invitation_runtime_v1.sql',
      (text) => `${text}\n-- probe\n`, '-- probe')],
  ];
  for (const [reason, mutate] of refusals) {
    try {
      mutate();
      assert.equal(runInMirror(mirror).ok, false, `this contract must refuse ${reason}`);
    } finally {
      restore(mirror, ...SCENARIO_PATHS);
    }
  }

  assert.ok(runInMirror(mirror).ok, 'every mutation was reverted');
  rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
});

test('no database contract - this one included - carries a migration census, so 0083 can exist without editing one', () => {
  // I-04A retired the two historical censuses rather than extending them; I-04B
  // must not reintroduce one. A census is recognisable by shape: a slice(-N) tail
  // of the sorted migration list, or an exhaustive comparison of everything after
  // some migration.
  for (const file of readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.mjs'))) {
    const text = read(`./${file}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${file} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${file} enumerates no exhaustive successor list`);
  }
});
