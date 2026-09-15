// I-04A - Direct Shared Invitation Credential + Prospective Invitation Runtime
// v1: the secret-free structural contract for migration 0081.
//
// Live semantics - ACLs, real denials, compare-and-swap, old-epoch invalidation,
// non-enumeration, idempotency and the two-connection races - are proven by
// database/verify-migration-0081.mjs against real PostgreSQL, which this file
// pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04A: that THIS slice created the
// prospective direct-invitation substrate and nothing beyond it - no Shared
// World, no membership episode, no world id, no acceptance command, no expiry
// policy, no Matching state, no Personal context read, no generic invitation
// engine - and that it modified no frozen predecessor migration.
//
// It deliberately does NOT prove that any of those may never appear later.
// I-04B's acceptance transaction WILL insert into public.shared_worlds and
// public.shared_world_membership_episodes; a later slice WILL add decline /
// cancel commands, an expiry policy, an API controller and mobile UI; I-07 WILL
// add Matching. A historical contract that froze today's absences would fail on
// all of it (task I-04A section 33). So every assertion below is scoped to one
// of exactly two things:
//
//   (a) migration 0081 itself, the verifier it added, and the two registration
//       lines it added (package.json and API CI);
//   (b) the frozen predecessor migrations it was required not to modify, pinned
//       by content hash - which proves immutability without banning additions.
//
// The two pre-existing historical database contracts are deliberately NOT
// appended to. They used to enumerate every migration after the one each owns,
// so a new migration failed them merely by existing; I-04A retired those
// censuses instead of extending them, and the R3 probe at the end of this file
// proves both halves of that - a hypothetical 0082 and 0083 leave them passing,
// while a real edit to, or removal of, the migration each one owns still fails.
//
// There is no assertion of the form "no migration after 0081 may exist", "no
// function named accept... may ever exist", "this directory contains exactly N
// files" or "shared_worlds may never be inserted into anywhere". The last test
// proves that by mutation: it mirrors the database tree, adds the hypothetical
// I-04B acceptance migration that creates a Shared World and a membership
// episode, plus a decline command, an expiry policy and their registrations, and
// requires this contract to still pass - then plants the regressions it must
// still refuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-direct-invitation-runtime-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so the probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04A_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0081_shared_direct_invitation_runtime_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0081.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

/** Executable SQL only: every "must not contain" assertion below runs against this, never against prose. */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * Executable SQL MINUS the terminal self-assertion block.
 *
 * That block legitimately NAMES every shape it refuses - `world_birth`,
 * `expires`, `ttl`, `matching` - so scanning it for those names would make this
 * contract fail on the very code that enforces them. Negative assertions run
 * against the deployable statements; the self-assertions are checked positively,
 * by the phrases they raise.
 */
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
/**
 * The body of one CREATE FUNCTION with its `--` comments removed.
 *
 * Every "must not contain" assertion about a command runs against THIS, because
 * a command's comments necessarily describe the shapes it refuses: the rotation
 * command explains that its collision answer never says "another human holds
 * it", and a ban scanning that prose would fail on the very sentence that
 * documents the guarantee.
 */
const executableFunction = (name) => functionBody(name).split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

/** The body of one CREATE FUNCTION, comments included - the function source PostgreSQL itself stores. */
const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration creates ${name}`);
  const end = migration.indexOf('END$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start, end);
};
/**
 * Exactly what PostgreSQL stores as `prosrc`: the body between the `$$` delimiters, COMMENTS
 * INCLUDED.
 *
 * The real-PostgreSQL verifier reads this string, not the comment-stripped code, so prose inside a
 * command is behaviour as far as every prosrc-based check is concerned - a comment that merely
 * MENTIONS a row-lock clause, a Shared World table or a delete reads exactly like one.
 */
const storedSource = (name) => {
  const body = functionBody(name);
  const start = body.indexOf('AS $$');
  assert.ok(start > 0, `${name} has a $$-delimited body`);
  return body.slice(start + 'AS $$'.length);
};

/** The declared column names of one CREATE TABLE block, in order. Constraint lines are not columns. */
const columnNames = (block) => (block.match(/^ {4}(\w+) (?:uuid|text|bigint|timestamptz)\b/gmu) ?? [])
  .map((line) => line.trim().split(' ')[0]);

/** One CREATE TABLE block, comments stripped. */
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};

const CREDENTIAL = 'shared_world_invite_credential_state';
const INVITATIONS = 'shared_world_direct_invitations';
const COMMANDS = 'shared_world_invitation_commands';
const OWN_TABLES = [CREDENTIAL, INVITATIONS, COMMANDS];
const ROTATE_FN = 'rotate_shared_world_invite_credential_v1';
const SUBMIT_FN = 'submit_shared_world_direct_invitation_v1';
const OWN_FUNCTIONS = [ROTATE_FN, SUBMIT_FN];
const OWN_SCRIPT = 'verify:shared-direct-invitation-runtime:integration';

/**
 * The two pre-existing historical database contracts that used to enumerate
 * every migration after 0071 / 0072, mapped to the migration each one OWNS.
 *
 * I-04A retired those censuses rather than appending 0081 to them, so a future
 * 0082 can exist without editing a historical file - and the R3 probe at the end
 * of this file proves both halves of that: a hypothetical later migration leaves
 * them passing, and a real edit to the migration each one owns still fails.
 */
const HISTORICAL_OWNERSHIP = {
  'historical-projection-v1.test.mjs': 'database/migrations/0072_historical_coverage_projection_disclosure_v1.sql',
  'effective-live-focus-final-semantic-chain-cutover-v1.test.mjs': 'database/migrations/0071_effective_live_focus_final_semantic_chain_cutover_v1.sql',
};
const HISTORICAL_CONTRACTS = Object.keys(HISTORICAL_OWNERSHIP);
/** A predecessor both of them pin by content hash. */
const HISTORICAL_PINNED = 'database/migrations/0070_thread_lifecycle_cross_session_continuity_v1.sql';

/** Exactly the frozen CW2-03 section 3 conceptual invitation states. */
const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'INVALIDATED'];

// ---------------------------------------------------------------------------

test('0081 is the forward migration after 0080 and edits no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0081 exists');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0080_shared_pre_model_world_state_resolution_v1.sql'), '0081 orders after 0080');
  assert.equal(migrations.filter((name) => name.startsWith('0081_')).length, 1, 'exactly one migration carries the 0081 number');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  // Forward-only: nothing existing is dropped, altered, rewritten or renumbered.
  // The only ALTER statements are this migration's own OWNER / RLS statements on
  // the three tables it just created.
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0081 drops nothing');
  for (const statement of deployableSql.match(/^ALTER TABLE public\.\w+/gmu) ?? []) {
    assert.ok(OWN_TABLES.some((name) => statement.endsWith(name)), `${statement} touches only a table 0081 created`);
  }
  assert.doesNotMatch(deployableSql, /CREATE\s+(?:OR REPLACE\s+)?(?:TRIGGER|POLICY|EXTENSION|TYPE|VIEW|MATERIALIZED VIEW)\b/iu,
    '0081 adds no trigger, policy, extension, type or view');
  // I-04C FIX-02A. The complete claim about what 0081 did NOT create lives HERE,
  // in 0081's own text. The real-PostgreSQL verifier used to assert it as a LIVE
  // absence census over a fixed list that included `matching_proposals` and
  // `introduction_records` - objects a later authorized Matching or Introduction
  // slice legitimately creates - which froze the future namespace rather than
  // proving anything about migration 0081.
  const createdTables = [...deployableSql.matchAll(/^CREATE TABLE public\.(\w+)/gmu)].map((match) => match[1]).sort();
  assert.deepEqual(createdTables, [...OWN_TABLES].map((name) => name.replace('public.', '')).sort(),
    '0081 creates exactly its own three tables, and no others');
  for (const generic of ['invitations', 'invites', 'world_invitations', 'shared_invitations', 'generic_invitations',
    'invitation_credentials', 'matching_proposals', 'introduction_records', 'shared_world_invitation_expiry']) {
    assert.ok(!createdTables.includes(generic),
      `0081 creates no ${generic}: no generic invitation / credential / Matching / Introduction / expiry substrate`);
  }
  // Frozen predecessors: content pins prove immutability of what exists. They
  // say nothing about migrations that do not exist yet.
  for (const [name, blob] of [
    ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
    ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
    ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
    ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
    ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
    ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical to its merged blob`);
  }
});

test('THE load-bearing invariant: I-04A creates no Shared World, no membership episode and no acceptance path', () => {
  // CW2-01 section 5 / A4, CW2-03 section 2: no Shared World exists before the
  // valid creation event, and a PENDING invitation is not a dormant World.
  // Scoped to this migration's own executable SQL: I-04B's acceptance
  // transaction is expected to insert into both of these tables.
  for (const pattern of [
    /INSERT\s+INTO\s+public\.shared_worlds\b/iu,
    /INSERT\s+INTO\s+public\.shared_world_membership_episodes\b/iu,
    /UPDATE\s+public\.shared_worlds\b/iu,
    /UPDATE\s+public\.shared_world_membership_episodes\b/iu,
    /\bWORLD_BIRTH\b/u,
    /\bbirth_basis\b/u,
    /attemptSharedWorldBirth/iu,
  ]) {
    assert.doesNotMatch(deployableSql, pattern, '0081 creates no Shared World and no membership episode');
  }
  // The prospective object carries no World identity of any kind.
  assert.doesNotMatch(tableBlock(INVITATIONS), /\bworld_id\b|\blifecycle\b|\bphase\b/u, 'a prospective invitation has no world id, lifecycle or phase');
  // Neither command can reach the 0075 substrate.
  for (const name of OWN_FUNCTIONS) {
    assert.doesNotMatch(executableFunction(name), /public\.shared_worlds\b|public\.shared_world_membership_episodes/u,
      `${name} never references the Shared World substrate`);
  }
  // And the migration asserts it about itself at deploy time.
  assert.match(migration, /must not create or touch a Shared World or a membership episode/u);
  // The 0075 seal is re-proven, not weakened: no privilege is granted on either table.
  assert.doesNotMatch(deployableSql, /GRANT[^;]*\bON\s+TABLE\s+public\.shared_worlds/iu);
  assert.doesNotMatch(deployableSql, /GRANT[^;]*\bON\s+TABLE\s+public\.shared_world_membership_episodes/iu);
  assert.match(migration, /the Shared World substrate stays sealed/u);
});

test('the credential is private user state: opaque, rotatable, never a World, never an alias', () => {
  const block = tableBlock(CREDENTIAL);
  assert.match(block, /user_id uuid NOT NULL/u);
  assert.match(block, /credential_lookup_ref text NOT NULL/u);
  assert.match(block, /epoch bigint NOT NULL/u);
  assert.match(block, /updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP/u);
  assert.match(block, /CONSTRAINT shared_world_invite_credential_pk PRIMARY KEY \(user_id\)/u, 'one current credential state per human');
  assert.match(block, /CONSTRAINT shared_world_invite_credential_ref_key UNIQUE \(credential_lookup_ref\)/u, 'exact-match lookup identity');
  assert.match(block, /FOREIGN KEY \(user_id\) REFERENCES public\.users \(id\) ON DELETE RESTRICT/u, 'restrictive: a human with credential state is never silently cascaded away');
  assert.match(block, /CHECK \(epoch >= 1\)/u, 'the epoch is monotonic from 1');
  assert.match(block, /CHECK \(length\(btrim\(credential_lookup_ref\)\) > 0\)/u, 'the reference is non-empty');
  assert.match(block, /CHECK \(credential_lookup_ref <> user_id::text\)/u, 'the reference is opaque and is specifically not the user id');
  // No World column, no alias, no searchable profile projection, no owner
  // semantics. Scanned over COLUMN NAMES only: the table and its constraints are
  // necessarily named `shared_world_invite_credential_*`, and scanning those
  // would make the guard fail on its own identity.
  assert.deepEqual(columnNames(block), ['user_id', 'credential_lookup_ref', 'epoch', 'updated_at'],
    'exactly the four columns this slice created');
  for (const column of columnNames(block)) {
    assert.doesNotMatch(column, /world|alias|display|handle|username|profile|search|owner|admin/iu,
      `${column}: the credential is user/account state, never a World, alias or profile projection`);
  }
});

test('the prospective invitation carries the frozen status vocabulary and two distinct humans', () => {
  const block = tableBlock(INVITATIONS);
  for (const status of INVITATION_STATUSES) assert.ok(block.includes(`'${status}'`), `${status} is part of the frozen vocabulary`);
  const declared = [...block.matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]);
  assert.deepEqual([...new Set(declared)].sort(), [...INVITATION_STATUSES].sort(), 'exactly the six frozen conceptual states, no more');
  assert.match(block, /CHECK \(inviter_user_id <> target_user_id\)/u, 'an invitation is always between two distinct humans');
  assert.match(block, /CHECK \(target_credential_epoch >= 1\)/u);
  assert.match(block, /CHECK \(\(status = 'PENDING' AND terminal_at IS NULL\)\s*\n\s*OR \(status <> 'PENDING' AND terminal_at IS NOT NULL\)\)/u,
    'PENDING <=> terminal_at IS NULL; every terminal status carries its moment');
  assert.match(block, /CHECK \(terminal_at IS NULL OR terminal_at >= created_at\)/u);
  for (const column of ['inviter_user_id', 'target_user_id']) {
    assert.match(block, new RegExp(`FOREIGN KEY \\(${column}\\) REFERENCES public\\.users \\(id\\) ON DELETE RESTRICT`, 'u'));
  }
  // The inviter's factual identity confers no superior authority, and no expiry
  // policy is invented (CW2-03 section 50 defers invitation expiry duration).
  assert.deepEqual(columnNames(block),
    ['id', 'inviter_user_id', 'target_user_id', 'target_credential_epoch', 'status', 'created_at', 'terminal_at'],
    'exactly the seven columns this slice created, and no world id among them');
  for (const column of columnNames(block)) {
    assert.doesNotMatch(column, /owner|admin|creator|initiator|privilege|world|expire/iu,
      `${column}: initiating creates no owner or admin authority, and a prospective invitation is not a World`);
  }
  // CW2-03 section 50 defers invitation expiry duration, so no timeout, TTL,
  // scheduler or expiry column is chosen here.
  assert.doesNotMatch(deployableSql, /expires_at|expiry|\bttl\b|pg_cron|interval\s*'/iu, '0081 invents no expiry duration, TTL or scheduler');
  // Only the known access patterns are indexed; nothing supports search or discovery.
  const indexes = deployableSql.match(/CREATE (?:UNIQUE )?INDEX (\w+)/gu) ?? [];
  assert.equal(indexes.length, 3, '0081 creates exactly its own three indexes');
  assert.match(deployableSql, /CREATE INDEX shared_world_direct_invitations_target_pending_idx\s+ON public\.shared_world_direct_invitations \(target_user_id, target_credential_epoch\)\s+WHERE status = 'PENDING'/u,
    'the rotation-invalidation and target-pending access pattern');
  assert.match(deployableSql, /CREATE INDEX shared_world_direct_invitations_inviter_idx\s+ON public\.shared_world_direct_invitations \(inviter_user_id, created_at\)/u);
  // A credential is non-searchable (CW2-03 section 4): no text-search, fuzzy or
  // case-folded index over the reference exists. Spelled with the USING clause
  // so the guard cannot be satisfied or broken by the "gin" inside `BEGIN;`.
  assert.doesNotMatch(deployableSql, /USING\s+(?:gin|gist|spgist)\b|tsvector|trgm|lower\(credential_lookup_ref\)/iu,
    'a credential is non-searchable: no text-search or fuzzy index exists');
});

test('durable command history is the idempotency record and never a second way to learn the target', () => {
  const block = tableBlock(COMMANDS);
  assert.match(block, /CONSTRAINT shared_world_invitation_commands_pk PRIMARY KEY \(id\)/u, 'the caller-supplied command id IS the idempotency record');
  assert.match(block, /CHECK \(command_type IN \('CREDENTIAL_ROTATION', 'DIRECT_INVITATION_SUBMISSION'\)\)/u, 'exactly the two consequential operations');
  assert.doesNotMatch(block, /target_user_id|inviter_user_id/u, 'the command history stores no target identity');
  assert.match(block, /FOREIGN KEY \(invitation_id\) REFERENCES public\.shared_world_direct_invitations \(id\) ON DELETE RESTRICT/u);
  assert.match(block, /CHECK \(\(command_type = 'CREDENTIAL_ROTATION'[\s\S]*?invitation_id IS NULL\)\s*\n\s*OR \(command_type = 'DIRECT_INVITATION_SUBMISSION'[\s\S]*?invitation_id IS NOT NULL\)\)/u,
    'each command kind carries exactly its own result');
  assert.match(deployableSql, /CREATE UNIQUE INDEX shared_world_invitation_commands_invitation_idx\s+ON public\.shared_world_invitation_commands \(invitation_id\)\s+WHERE invitation_id IS NOT NULL/u,
    'one invitation identity is created by exactly one command, so it can never be re-bound');
  // No raw human-facing credential is stored anywhere: only the derived ref, and
  // no format policy - length, alphabet, QR, URL or alias reuse - is chosen.
  assert.doesNotMatch(deployableSql, /credential_secret|raw_credential|invite_code|short_code|plaintext|\bqr\b|char\(\d|varchar\(\d/iu);
});

test('all three tables are deny-by-default, and no application role receives direct CRUD', () => {
  for (const table of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.shared_world_invite_credential_state,\s*\n?\s*public\.shared_world_direct_invitations,\s*\n?\s*public\.shared_world_invitation_commands\s*\n?\s*FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /REVOKE ALL ON TABLE public\.shared_world_invite_credential_state, public\.shared_world_direct_invitations, public\.shared_world_invitation_commands FROM service_role/u,
    'service_role is revoked explicitly, because a Supabase project grants it by default privilege');
  assert.doesNotMatch(deployableSql, /CREATE POLICY/iu, 'RLS is enabled with zero policies');
  for (const table of OWN_TABLES) {
    assert.doesNotMatch(deployableSql, new RegExp(`GRANT[^;]*\\bON\\s+TABLE\\s+public\\.${table}`, 'iu'), `no direct privilege is granted on ${table}`);
  }
  // The migration refuses to deploy a reachable substrate.
  assert.match(migration, /direct table access stays sealed/u);
  assert.match(migration, /no RLS policy may exist on %/u);
  assert.match(migration, /no trigger may exist on %/u);
});

test('both commands are authenticated human self-authority, with no caller-supplied identity', () => {
  for (const name of OWN_FUNCTIONS) {
    const body = functionBody(name);
    assert.match(body, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u, `${name} is a pinned SECURITY DEFINER command`);
    assert.match(body, /u uuid := auth\.uid\(\);/u, `${name} derives the actor from auth.uid()`);
    assert.match(body, /IF u IS NULL THEN RAISE EXCEPTION 'SHARED_INVITE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'/u);
    // The signature accepts no actor, inviter, target, status, World or clock.
    // Sliced from the opening parenthesis so the function's own name - which
    // necessarily contains "shared_world" - is not what is being scanned.
    const signature = body.slice(body.indexOf('('), body.indexOf('LANGUAGE plpgsql'));
    assert.doesNotMatch(signature, /inviter|target|actor|user_id|status|world|timestamp|_at\b/iu, `${name} accepts no identity, status, World or timestamp parameter`);
    // Personal context, Standing Context authority and Matching stay out.
    const code = executableFunction(name);
    assert.doesNotMatch(code, /conversation_|\Wmemor|human_intelligence|hypothes|standing_context|matching|introduction_record/iu,
      `${name} reads no Personal context and creates no Standing Context or Matching state`);
    assert.doesNotMatch(code, /DELETE FROM|TRUNCATE/iu, `${name} deletes nothing`);
    assert.doesNotMatch(code, /SET target_user_id|SET inviter_user_id/u, `${name} never re-binds an invitation to another human`);
    // Least privilege: authenticated only, with an explicit service_role revoke.
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executableSql, new RegExp(`EXECUTE 'REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role';`, 'u'));
    assert.match(executableSql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO authenticated;`, 'u'));
  }
  assert.equal((deployableSql.match(/^CREATE FUNCTION public\./gmu) ?? []).length, 2, '0081 creates exactly its own two commands');
  // No accept / decline / cancel / expire command is invented in this slice.
  // Scoped to 0081's own CREATE FUNCTION statements: I-04B is expected to add
  // exactly such a command in its own migration.
  assert.doesNotMatch(deployableSql, /CREATE FUNCTION public\.\w*(?:accept|decline|cancel|expire)\w*/iu,
    'I-04A creates the prospective substrate only; I-04B owns acceptance');
});

test('rotation is compare-and-swap and atomically invalidates every PENDING old-epoch invitation', () => {
  const body = functionBody(ROTATE_FN);
  assert.match(body, /p_command_id uuid, p_new_credential_lookup_ref text, p_expected_epoch bigint DEFAULT NULL/u);
  assert.match(body, /RETURNS TABLE\(command_id uuid, credential_epoch bigint\)/u, 'the result carries the caller their own new epoch and nothing else');
  assert.match(body, /new_epoch := COALESCE\(p_expected_epoch, 0\) \+ 1;/u, 'first setup yields 1; rotation yields N + 1');
  assert.match(body, /IF p_expected_epoch IS NULL THEN\s*\n\s*IF has_state THEN RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001'/u,
    'expected NULL requires no current credential state');
  assert.match(body, /IF NOT has_state OR current_epoch <> p_expected_epoch THEN\s*\n\s*RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001'/u,
    'expected N requires exactly N: nothing is applied to whatever is current');
  // The frozen CW2-03 section 5 consequence, in the same transaction.
  assert.match(body, /UPDATE public\.shared_world_direct_invitations i\s*\n\s*SET status = 'INVALIDATED', terminal_at = CURRENT_TIMESTAMP\s*\n\s*WHERE i\.target_user_id = u AND i\.status = 'PENDING' AND i\.target_credential_epoch < new_epoch;/u,
    'every PENDING invitation bound to an older epoch is invalidated, on the database clock');
  // Only PENDING rows move, and only this human's.
  const code = executableFunction(ROTATE_FN);
  assert.doesNotMatch(code, /status <> 'PENDING'|status IN \(/u, 'no already-terminal invitation is touched');
  // A reference collision is bounded: the raised message names no human and no
  // relationship, so rotation is not an enumeration oracle either.
  assert.match(code, /RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE' USING ERRCODE='23505'/u);
  for (const raised of code.match(/RAISE EXCEPTION '[^']+'/gu) ?? []) {
    assert.doesNotMatch(raised, /TAKEN|BELONGS|ANOTHER|OTHER_USER|EXISTS/iu, `${raised} names no other human`);
  }
});

test('submission resolves the target only from the exact current lookup reference, and reveals nothing', () => {
  const body = functionBody(SUBMIT_FN);
  assert.match(body, /p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text/u, 'no inviter parameter and no target parameter exists');
  assert.match(body, /RETURNS TABLE\(outcome text, command_id uuid, requested_invitation_id uuid\)/u);
  // The result identifies the operation, never the target.
  assert.match(body, /RETURN QUERY SELECT 'SUBMITTED'::text, p_command_id, p_invitation_id;/u);
  const code = executableFunction(SUBMIT_FN);
  assert.doesNotMatch(code, /RETURN QUERY SELECT[^;]*resolved_user_id/u, 'the resolved target id never leaves the transaction');
  assert.doesNotMatch(code, /RETURN QUERY SELECT[^;]*resolved_epoch/u, 'the target epoch never leaves the transaction');
  // Exact-match resolution under the row lock, then revalidation.
  assert.match(body, /WHERE s\.credential_lookup_ref = p_credential_lookup_ref\s*\n\s*FOR UPDATE;/u);
  assert.match(body, /WHERE s\.user_id = resolved_user_id AND s\.credential_lookup_ref = p_credential_lookup_ref;/u,
    'the reference is revalidated under the lock: a rotation that committed while this waited retires it');
  // ONE bounded non-enumerating class for every unusable case.
  assert.equal((code.match(/RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'/gu) ?? []).length, 3,
    'nonexistent, retired and self-target collapse into the same bounded answer');
  assert.match(code, /IF resolved_user_id = u THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE'/u, 'a self-target credential is the same bounded answer');
  // Every message this command can raise is one of exactly four bounded classes,
  // and none of them says WHY a reference was unusable.
  assert.deepEqual([...new Set((code.match(/RAISE EXCEPTION '([^']+)'/gu) ?? []))].sort(), [
    "RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_ID_CONFLICT'",
    "RAISE EXCEPTION 'SHARED_INVITE_AUTHENTICATION_REQUIRED'",
    "RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT'",
    "RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID'",
    "RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE'",
  ], 'the submission command raises exactly the five bounded classes and never an enumerating one');
  // The epoch is read under the lock, never supplied.
  assert.match(code, /VALUES \(p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING'\);/u);
  // An invitation identity is owned by one command forever.
  assert.match(code, /RAISE EXCEPTION 'SHARED_DIRECT_INVITATION_ID_CONFLICT' USING ERRCODE='23505'/u);
  assert.doesNotMatch(code, /UPDATE public\.shared_world_direct_invitations/u, 'submission never updates an existing invitation row');
});

test('idempotency is durable and semantic, and a reused command id fails closed', () => {
  // Two passes: one before any lock so a retry stays answerable after state
  // moved on, one under the lock so concurrent identical retries serialize.
  // Rotation needs a THIRD, inside its uniqueness-conflict handler: a FIRST
  // setup has no credential row, so `FOR UPDATE` locks nothing and two
  // concurrent executions of the same command both legitimately observe
  // absence. There the conflict itself is the serialization point.
  const IDEMPOTENCY_PASSES = { [ROTATE_FN]: 3, [SUBMIT_FN]: 2 };
  for (const name of OWN_FUNCTIONS) {
    const body = functionBody(name);
    assert.equal((body.match(/SELECT \* INTO committed FROM public\.shared_world_invitation_commands c WHERE c\.id = p_command_id;/gu) ?? []).length,
      IDEMPOTENCY_PASSES[name], `${name} checks durable idempotency at every point where an equivalent retry can arrive`);
    assert.equal((body.match(/RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505'/gu) ?? []).length,
      IDEMPOTENCY_PASSES[name], `${name} fails closed on a reused command id with different semantics at every one of them`);
    assert.match(body, /committed\.actor_user_id = u/u, `${name} binds equivalence to the same actor`);
    // Nothing process-local.
    assert.doesNotMatch(executableFunction(name), /pg_advisory|pg_try_advisory|SET LOCAL lock_timeout|temp table/iu,
      `${name} uses no advisory lock or process-local cache`);
  }
  assert.match(functionBody(ROTATE_FN), /committed\.credential_lookup_ref = p_new_credential_lookup_ref\s*\n\s*AND committed\.resulting_credential_epoch = new_epoch/u,
    'a rotation retry is equivalent only for the same reference and the same resulting epoch');
  assert.match(functionBody(SUBMIT_FN), /committed\.invitation_id = p_invitation_id\s*\n\s*AND committed\.credential_lookup_ref = p_credential_lookup_ref/u,
    'a submission retry is equivalent only for the same invitation identity and the same submitted reference');
  // The third pass lives INSIDE the uniqueness-conflict handler, ahead of both
  // bounded conflict answers, so a concurrent identical FIRST setup returns the
  // committed epoch instead of a stale-state error - while a DIFFERENT command
  // that lost the same race still gets bounded stale state, and the same command
  // id carrying different semantics still fails closed.
  const rotate = functionBody(ROTATE_FN);
  const handler = rotate.slice(rotate.indexOf('EXCEPTION WHEN unique_violation'));
  assert.ok(handler.length > 0, 'rotation handles the uniqueness conflict itself');
  const thirdPass = handler.indexOf('SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;');
  assert.ok(thirdPass > 0, 'the conflict handler consults durable command history');
  assert.ok(thirdPass < handler.indexOf("RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE'")
    && thirdPass < handler.indexOf("RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE'"),
    'an equivalent retry is answered from durable history BEFORE either bounded conflict answer');
  assert.match(handler, /RETURN QUERY SELECT committed\.id, committed\.resulting_credential_epoch;/u,
    'and it returns the committed result, not a second current state');
  assert.match(handler, /RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001';/u,
    'a DIFFERENT first-setup command that lost the race keeps bounded stale state');
  assert.match(migration, /a concurrent identical first setup must be answered from durable command history, never as stale state/u,
    'and the migration refuses to deploy without it');
});

test('a rotation must actually rotate: a no-op credential value is refused before any mutation', () => {
  const body = functionBody(ROTATE_FN);
  const code = executableFunction(ROTATE_FN);
  // The current reference is read under the SAME row lock that the epoch is read
  // under, so the comparison cannot race the state it is comparing against.
  assert.match(body, /SELECT s\.epoch, s\.credential_lookup_ref INTO current_epoch, current_ref\s*\n\s*FROM public\.shared_world_invite_credential_state s\s*\n\s*WHERE s\.user_id = u\s*\n\s*FOR UPDATE;/u,
    'the current reference is read under the credential-state row lock');
  assert.match(code, /IF has_state AND current_ref = p_new_credential_lookup_ref THEN\s*\n\s*RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';/u,
    'presenting the reference that is already current is not a rotation');
  // Before EVERY mutation: no epoch advance, no updated_at, no invalidation
  // sweep and no command-history row can have happened when it fires.
  const refusal = code.indexOf("RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED'");
  for (const [what, mutation] of [
    ['the credential state update', 'UPDATE public.shared_world_invite_credential_state s'],
    ['the first-setup insert', 'INSERT INTO public.shared_world_invite_credential_state'],
    ['the old-epoch invalidation sweep', 'UPDATE public.shared_world_direct_invitations i'],
    ['the command-history row', 'INSERT INTO public.shared_world_invitation_commands'],
  ]) {
    assert.ok(code.indexOf(mutation) > refusal, `the refusal precedes ${what}`);
  }
  // It is the caller's OWN locked row that is compared, so nothing about any
  // other human is disclosed, and the class stays bounded and non-retryable -
  // never 40001, which would tell a client to re-read and try again.
  assert.equal((code.match(/\bcurrent_ref\b/gu) ?? []).length, 3,
    'the current reference is declared, read once under the lock and compared once - it never leaves the transaction');
  assert.doesNotMatch(code, /RETURN QUERY SELECT[^;]*current_ref/u, 'and it is never returned to the caller');
  assert.doesNotMatch(code, /SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='40001'/u,
    'the refusal is a bounded invalid-command class, never a 40001 that would tell a client to retry the same no-op');
  assert.match(migration, /rotation must refuse a no-op credential value: re-presenting the current reference is not a rotation/u);
  assert.match(migration, /the no-op credential refusal must precede every mutation/u);
});

test('the canonical lock order is credential-state first, invitation rows second', () => {
  const rotate = functionBody(ROTATE_FN);
  const submit = functionBody(SUBMIT_FN);
  // Rotation: lock own credential row, then invalidate invitation rows.
  const rotateLock = rotate.indexOf('FROM public.shared_world_invite_credential_state s');
  const rotateInvitations = rotate.indexOf('UPDATE public.shared_world_direct_invitations');
  assert.ok(rotateLock > 0 && rotateInvitations > rotateLock, 'rotation locks the credential-state row before touching invitation rows');
  assert.match(rotate, /WHERE s\.user_id = u\s*\n\s*FOR UPDATE;/u);
  // Submission: lock the resolved credential row, then insert the invitation row.
  const submitLock = submit.indexOf('FROM public.shared_world_invite_credential_state s');
  const submitInvitations = submit.indexOf('INSERT INTO public.shared_world_direct_invitations');
  assert.ok(submitLock > 0 && submitInvitations > submitLock, 'submission locks the credential-state row before inserting an invitation row');
  // No opposing order, no advisory lock, exactly one row lock per command.
  for (const name of OWN_FUNCTIONS) {
    const code = executableFunction(name);
    assert.equal((code.match(/FOR UPDATE/gu) ?? []).length, 1, `${name} takes exactly one row lock`);
    // Counted again over the source PostgreSQL actually stores - comments and
    // all - because that is what the verifier reads from prosrc, where a comment
    // that merely MENTIONS the row-lock clause is indistinguishable from a
    // second lock. Prose about locking must not read as locking.
    assert.equal((functionBody(name).match(/FOR UPDATE/gu) ?? []).length, 1,
      `${name} names the row-lock clause exactly once in its stored source, so no comment can be mistaken for a second lock`);
    assert.doesNotMatch(code, /LOCK TABLE|pg_advisory/iu, `${name} locks one row, never a table and never an advisory key`);
  }
  // The invariant is documented for I-04B to continue, and asserted at deploy time.
  assert.match(migration, /CANONICAL LOCK ORDER - a transaction invariant I-04B must continue/u);
  assert.match(migration, /must lock the credential-state row before invalidating invitation rows/u);
  assert.match(migration, /must lock the credential-state row before inserting an invitation row/u);
  assert.match(readme, /\*\*Canonical lock order\*\*, a transaction invariant I-04B must continue/u);
});

test('the stored source states nothing that a prosrc-based check would read as behaviour', () => {
  // Every assertion here mirrors one the real-PostgreSQL verifier makes against `prosrc`. Making
  // them locally too is not redundancy: it is the difference between catching a comment that reads
  // as code here, and catching it one CI round trip later.
  for (const name of OWN_FUNCTIONS) {
    const src = storedSource(name);
    assert.match(src, /auth\.uid\(\)/u, `${name} derives the actor from auth.uid()`);
    assert.doesNotMatch(src, /public\.shared_worlds\b|public\.shared_world_membership_episodes/u,
      `${name} must not even NAME the Shared World substrate in its stored source`);
    assert.doesNotMatch(src, /conversation_|\Wmemor|human_intelligence|hypothes|standing_context|matching|introduction_record/iu,
      `${name} names no Personal context, Standing Context or Matching object`);
    assert.doesNotMatch(src, /DELETE FROM|TRUNCATE|pg_advisory/iu, `${name} names no delete and no advisory lock`);
    assert.equal((src.match(/FOR UPDATE/gu) ?? []).length, 1, `${name} names the row-lock clause exactly once`);
    const lockAt = src.indexOf('FROM public.shared_world_invite_credential_state s');
    const invitationAt = src.search(/(?:UPDATE|INSERT INTO) public\.shared_world_direct_invitations/u);
    assert.ok(lockAt >= 0 && invitationAt > lockAt,
      `${name}: the canonical lock order must hold in the stored source the verifier reads`);
  }
});

test('the verifier is wired into the toolchain, API CI after fresh migrations and the 0075 - 0080 verifiers, and the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0081\\.mjs"`, 'u'));
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
  ]) {
    assert.ok(step > workflow.indexOf(`run: npm run ${predecessor}`), `the verifier runs after ${predecessor}`);
  }
  assert.match(workflow, /Verify Direct Shared invitation prospective runtime against real PostgreSQL/u);
  assert.match(readme, /## Direct Shared invitation credential and prospective invitation runtime \(migration 0081, I-04A\)/u);
  assert.match(readme, new RegExp(`npm run ${OWN_SCRIPT}`, 'u'));
  assert.match(readme, /\*\*No Shared\s+World is created here\*\*/u);
  assert.match(readme, /\*\*an invitation is not a dormant World\*\*/u);
  assert.match(readme, /\*\*The human-facing credential format is not frozen and is not invented here\.\*\*/u);
  assert.match(readme, /\*\*Inviter-side behaviour is\s+non-enumerating\*\*/u);
  assert.match(readme, /\*\*no target parameter\*\*/u);
  // The two pre-existing historical contracts are NOT appended to. They used to
  // enumerate every migration after 0071 / 0072, which made each new migration
  // fail merely by existing until somebody edited a historical file; that
  // ceiling is retired rather than extended, so 0081 appears in neither of them.
  for (const manifest of HISTORICAL_CONTRACTS) {
    const text = read(`./${manifest}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${manifest} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${manifest} enumerates no exhaustive successor list`);
    assert.doesNotMatch(text, new RegExp(MIGRATION_NAME.replace(/\./gu, '\\.'), 'u'),
      `${manifest} does not have to name this slice's migration, and must not have to name the next one either`);
  }
  // The verifier is a real-PostgreSQL proof, not a re-reading of the migration
  // text: it reads live catalogs, executes both commands under real roles, and
  // opens extra connections for the races.
  assert.ok(verifier.length > 15000, 'the real-PostgreSQL verifier is substantial');
  assert.match(verifier, /import pg from 'pg';/u);
  assert.match(verifier, /new Client\(\{ connectionString: databaseUrl \}\)/u);
  assert.doesNotMatch(verifier, /readFileSync|migrations\//u, 'the verifier proves live behaviour, never the migration text');
  for (const proof of ['SET LOCAL ROLE', 'has_function_privilege', 'has_table_privilege', 'pg_policy', 'information_schema.columns',
    'BLOCKED', 'SHARED_INVITE_TARGET_NOT_USABLE', 'SHARED_INVITE_CREDENTIAL_STALE_STATE', 'no fixture row remains after completion',
    // The two targeted corrections are proven against real PostgreSQL, not here.
    'SHARED_INVITE_CREDENTIAL_UNCHANGED', 'a no-op rotation does not increment the epoch', 'a no-op rotation does not move updated_at',
    'a no-op rotation invalidates no PENDING invitation', 'a no-op rotation writes no command-history row',
    'two IDENTICAL first credential setups are idempotent', 'both callers receive the SAME committed epoch-1 result',
    'SHARED_INVITE_COMMAND_ID_CONFLICT']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
  // It counts the 0075 substrate before and after, so "no World is ever created"
  // is measured rather than assumed.
  assert.match(verifier, /no race created a Shared World or a membership episode/u);
});

test('the contract is not vacuous: every deliberate weakening of migration 0081 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  // Each entry rewrites the migration text and must break at least one assertion
  // above. Without this the whole file could be satisfied by a migration that
  // says nothing.
  const weakenings = [
    ['a World is created by the invitation command', (text) => text.replace(
      "  VALUES (p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING');",
      "  INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES (p_invitation_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION');\n  VALUES (p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING');")],
    ['the invitation gains a world id', (text) => text.replace('    target_credential_epoch bigint NOT NULL,', '    world_id uuid,\n    target_credential_epoch bigint NOT NULL,')],
    ['service_role may execute a human command', (text) => text.replace(
      "GRANT EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) TO authenticated;",
      "GRANT EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) TO authenticated, service_role;")],
    ['the target is supplied by the caller', (text) => text.replace(
      'p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text',
      'p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text, p_target_user_id uuid')],
    ['the unusable-target answer becomes an enumeration oracle', (text) => text.replace(
      "  IF resolved_user_id = u THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'; END IF;",
      "  IF resolved_user_id = u THEN RAISE EXCEPTION 'SELF_INVITE' USING ERRCODE='P0002'; END IF;")],
    ['rotation stops invalidating old-epoch invitations', (text) => text.replace(
      "   WHERE i.target_user_id = u AND i.status = 'PENDING' AND i.target_credential_epoch < new_epoch;",
      "   WHERE i.target_user_id = u AND i.status = 'PENDING' AND FALSE;")],
    ['rotation applies to whatever is current', (text) => text.replace(
      "    IF NOT has_state OR current_epoch <> p_expected_epoch THEN\n      RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='40001';\n    END IF;",
      '    NULL;')],
    ['the lock order is reversed', (text) => text.replace(
      '  -- CANONICAL LOCK ORDER, STEP 1: the caller',
      "  UPDATE public.shared_world_direct_invitations i SET status = status WHERE i.target_user_id = u;\n  -- CANONICAL LOCK ORDER, STEP 1: the caller")],
    ['a direct table privilege is granted', (text) => text.replace(
      'ALTER TABLE public.shared_world_invitation_commands ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.shared_world_invitation_commands ENABLE ROW LEVEL SECURITY;\nGRANT SELECT ON TABLE public.shared_world_direct_invitations TO authenticated;')],
    ['an expiry policy is invented', (text) => text.replace('    terminal_at timestamptz,', '    terminal_at timestamptz,\n    expires_at timestamptz,')],
    ['the credential becomes the user id', (text) => text.replace('        CHECK (credential_lookup_ref <> user_id::text)', '        CHECK (length(credential_lookup_ref) > 0)')],
    ['the command history learns the target', (text) => text.replace('    invitation_id uuid,', '    invitation_id uuid,\n    target_user_id uuid,')],
    ['rotation accepts a no-op credential value', (text) => text.replace(
      "  IF has_state AND current_ref = p_new_credential_lookup_ref THEN\n    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';\n  END IF;",
      '  NULL;')],
    ['the no-op refusal moves after the epoch has already advanced', (text) => text.replace(
      "  IF has_state AND current_ref = p_new_credential_lookup_ref THEN\n    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';\n  END IF;\n",
      '').replace(
      "  INSERT INTO public.shared_world_invitation_commands\n    (id, actor_user_id, command_type, credential_lookup_ref, resulting_credential_epoch)",
      "  IF has_state AND current_ref = p_new_credential_lookup_ref THEN\n    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';\n  END IF;\n"
      + '  INSERT INTO public.shared_world_invitation_commands\n    (id, actor_user_id, command_type, credential_lookup_ref, resulting_credential_epoch)')],
    ['a concurrent identical first setup is reported as stale state', (text) => text.replace(
      "    SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;\n    IF FOUND THEN\n      IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u\n         AND committed.credential_lookup_ref = p_new_credential_lookup_ref\n         AND committed.resulting_credential_epoch = new_epoch THEN\n        RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;\n        RETURN;\n      END IF;\n      -- The same command id carrying different semantics is still a conflict.\n      RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';\n    END IF;\n",
      '')],
  ];
  // One mirror, reused: the weakenings differ only in the migration text, and
  // re-copying the tree twelve times would cost seconds for nothing.
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
    // And the mirror is back to where it started, so the refusals were real.
    assert.ok(runInMirror(mirror).ok, 'every weakening was reverted');
  } finally {
    removeHarnessMirror(mirror);
  }
});

// ---------------------------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
//
// I-04A is the FIRST slice of a phase whose whole point is to create Shared Worlds. A historical
// contract that froze today's absences would fail on I-04B by design. The only honest way to show
// this one does not is to build the repository one authorized step into its future - the acceptance
// transaction that inserts a World and two membership episodes, a decline command, an expiry policy
// and their registrations - and require this contract to still pass. Then the regressions it must
// still refuse are planted, so the forward safety is not bought by asserting nothing.
// ---------------------------------------------------------------------------------------------

/**
 * Only the paths this contract - and the two historical database contracts the
 * R3 probe below runs in the same mirror - actually read.
 */
const MIRRORED = ['database', '.github/workflows/api-ci.yml', 'package.json',
  'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04a-forward-');
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
 * Runs THIS contract against the mirrored tree, in a child that does not run the probe again.
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

const FUTURE_MIGRATION = 'database/migrations/0082_shared_direct_invitation_acceptance_v1.sql';
const FUTURE_CONTRACT = 'database/tests/shared-direct-invitation-acceptance-v1.test.mjs';
const FUTURE_VERIFIER = 'database/verify-migration-0082.mjs';
const SCENARIO_PATHS = [FUTURE_MIGRATION, FUTURE_CONTRACT, FUTURE_VERIFIER, 'package.json', '.github/workflows/api-ci.yml',
  `database/migrations/${MIGRATION_NAME}`, 'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql', 'database/README.md'];

test('I-04B and every later authorized invitation slice leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, (t) => {
  const mirror = buildMirror();
  // Registered the moment the mirror exists, so no path out of this test can leave the tree behind.
  t.after(() => removeHarnessMirror(mirror));
  try {
    // The baseline. Every claim below is worthless if the untouched mirror does not already pass.
    assert.ok(runInMirror(mirror).ok, 'the untouched mirror must reproduce this contract exactly');

    // ---- authorized future work, applied together -------------------------------------------
    //
    // I-04B: the acceptance transaction that DOES everything this slice was forbidden to do - it
    // consumes the PENDING invitation, creates the Shared World, creates both membership episodes
    // and marks the invitation ACCEPTED. Plus the decline command and the expiry policy CW2-03
    // deferred, and their registrations. None of it is this contract's business.
    write(mirror, FUTURE_MIGRATION,
      '-- I-04B (hypothetical): atomic exact-target acceptance and direct World birth.\n'
      + 'BEGIN;\n'
      + 'ALTER TABLE public.shared_world_direct_invitations ADD COLUMN world_id uuid;\n'
      + 'CREATE FUNCTION public.accept_shared_world_direct_invitation_v1(p_command_id uuid, p_invitation_id uuid, p_world_id uuid)\n'
      + "RETURNS TABLE(world_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$\n"
      + 'DECLARE u uuid := auth.uid();\n'
      + 'BEGIN\n'
      + "  INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES (p_world_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION');\n"
      + '  INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)\n'
      + '  SELECT gen_random_uuid(), p_world_id, i.inviter_user_id, CURRENT_TIMESTAMP FROM public.shared_world_direct_invitations i WHERE i.id = p_invitation_id;\n'
      + "  UPDATE public.shared_world_direct_invitations i SET status = 'ACCEPTED', terminal_at = CURRENT_TIMESTAMP, world_id = p_world_id WHERE i.id = p_invitation_id;\n"
      + '  RETURN QUERY SELECT p_world_id;\n'
      + 'END$$;\n'
      + "CREATE FUNCTION public.decline_shared_world_direct_invitation_v1(p_command_id uuid, p_invitation_id uuid)\n"
      + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN NULL; END$$;\n"
      + 'ALTER TABLE public.shared_world_direct_invitations ADD COLUMN expires_at timestamptz;\n'
      + 'GRANT EXECUTE ON FUNCTION public.accept_shared_world_direct_invitation_v1(uuid, uuid, uuid) TO authenticated;\n'
      + 'COMMIT;\n');
    write(mirror, FUTURE_VERIFIER, "// Hypothetical I-04B verifier.\nimport process from 'node:process';\nprocess.exitCode = 0;\n");
    write(mirror, FUTURE_CONTRACT, "import test from 'node:test';\ntest('hypothetical I-04B contract', () => {});\n");
    patch(mirror, 'package.json',
      (text) => text.replace(`    "${OWN_SCRIPT}":`,
        '    "verify:shared-direct-invitation-acceptance:integration": "node --env-file-if-exists=.env database/verify-migration-0082.mjs",\n'
        + `    "${OWN_SCRIPT}":`),
      'verify:shared-direct-invitation-acceptance:integration');
    patch(mirror, '.github/workflows/api-ci.yml',
      (text) => text.replace(`run: npm run ${OWN_SCRIPT}}`,
        `run: npm run ${OWN_SCRIPT}}\n`
        + '      - {name: Verify Direct Shared invitation acceptance and World birth against real PostgreSQL, run: npm run verify:shared-direct-invitation-acceptance:integration}'),
      'verify:shared-direct-invitation-acceptance:integration');
    patch(mirror, 'database/README.md',
      (text) => `${text}\n## Direct Shared invitation acceptance and World birth (migration 0082, I-04B)\n\nHypothetical later section.\n`,
      'migration 0082, I-04B');

    const grown = runInMirror(mirror);
    assert.ok(grown.ok,
      "I-04B's acceptance transaction creating a Shared World and both membership episodes, a decline command, an "
      + `expiry policy and their registrations are all authorized work, and none of them is this contract's business\n\n${grown.output}`);
  } finally {
    restore(mirror, ...SCENARIO_PATHS);
  }

  // ---- the other half: what must still be refused ------------------------------------------
  const refusals = [
    ['migration 0081 itself creating a Shared World', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace(
        "  VALUES (p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING');",
        "  INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES (p_invitation_id, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION');\n"
        + "  VALUES (p_invitation_id, u, resolved_user_id, resolved_epoch, 'PENDING');"),
      'INSERT INTO public.shared_worlds')],
    ['a caller-supplied target on the I-04A command', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace('p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text',
        'p_command_id uuid, p_invitation_id uuid, p_credential_lookup_ref text, p_target_user_id uuid'),
      'p_target_user_id')],
    ['service_role executing a human invitation command', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace('GRANT EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) TO authenticated;',
        'GRANT EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) TO authenticated, service_role;'),
      'TO authenticated, service_role')],
    ['rotation that no longer invalidates old-epoch invitations', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace("   WHERE i.target_user_id = u AND i.status = 'PENDING' AND i.target_credential_epoch < new_epoch;",
        "   WHERE i.target_user_id = u AND i.status = 'PENDING' AND FALSE;"),
      'AND FALSE;')],
    ['an enumerating failure class', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace("  IF resolved_user_id = u THEN RAISE EXCEPTION 'SHARED_INVITE_TARGET_NOT_USABLE' USING ERRCODE='P0002'; END IF;",
        "  IF resolved_user_id = u THEN RAISE EXCEPTION 'SELF_INVITE' USING ERRCODE='P0002'; END IF;"),
      'SELF_INVITE')],
    ['a direct table privilege for an application role', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
      (text) => text.replace('ALTER TABLE public.shared_world_invitation_commands ENABLE ROW LEVEL SECURITY;',
        'ALTER TABLE public.shared_world_invitation_commands ENABLE ROW LEVEL SECURITY;\nGRANT SELECT ON TABLE public.shared_world_direct_invitations TO authenticated;'),
      'GRANT SELECT ON TABLE')],
    ['an edit to a frozen Connected Worlds migration', () => patch(mirror, 'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql',
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

  // And the mirror is back to where it started, so the refusals above were real.
  assert.ok(runInMirror(mirror).ok, 'every mutation was reverted');
});

// ---------------------------------------------------------------------------------------------
// R3: the two pre-existing historical database contracts no longer carry a migration ceiling.
//
// Both used to enumerate every migration after the one they own - a `slice(-N)` tail in one, an
// exhaustive successor list in the other - so every new migration failed a historical contract
// merely by existing until somebody edited it. I-04A retired those censuses instead of appending
// 0081 to them. Retiring a ceiling is only worth anything if both halves are shown: a hypothetical
// later migration must leave them passing, AND a real edit to the migration each one owns, or to a
// predecessor it pins by content hash, must still fail. Asserting the first alone would be
// satisfied by a contract that checks nothing.
// ---------------------------------------------------------------------------------------------

const LATER_MIGRATIONS = ['database/migrations/0082_shared_direct_invitation_acceptance_v1.sql',
  'database/migrations/0083_some_later_authorized_slice_v1.sql'];

test('R3: a future migration may exist without editing either historical contract, and a real edit to the migration each one owns still fails',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  // No database contract carries a migration census any more - not just the two this slice had to
  // touch. A census is recognisable by shape: a `slice(-N)` tail of the sorted migration list, or
  // an exhaustive comparison of everything after some migration. (A CONTENT sweep over later
  // migrations is a different thing and stays: it does not break by existence.)
  for (const file of readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.mjs') && name !== SELF)) {
    const text = read(`./${file}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${file} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${file} enumerates no exhaustive successor list`);
  }

  const mirror = buildMirror();
  try {
    // The baseline: both historical contracts pass on the untouched mirror. Every claim below is
    // worthless without it.
    for (const manifest of HISTORICAL_CONTRACTS) {
      const baseline = runInMirror(mirror, manifest);
      assert.ok(baseline.ok, `${manifest} must pass on the untouched mirror\n\n${baseline.output}`);
    }

    // ---- the ceiling is gone: later migrations are not their business ------------------------
    LATER_MIGRATIONS.forEach((later, index) => {
      write(mirror, later, `-- Hypothetical later authorized slice.\nBEGIN;\nCREATE TABLE public.later_authorized_probe_${index} (id uuid PRIMARY KEY);\nCOMMIT;\n`);
    });
    for (const manifest of HISTORICAL_CONTRACTS) {
      const grown = runInMirror(mirror, manifest);
      assert.ok(grown.ok,
        `I-04B's 0082 and a later 0083 are authorized work; ${manifest} owns ${HISTORICAL_OWNERSHIP[manifest]} and must not `
        + `have to be edited for either of them to exist\n\n${grown.output}`);
    }
    for (const later of LATER_MIGRATIONS) rmSync(join(mirror, later), { force: true });

    // ---- the other half: what each contract must still refuse --------------------------------
    for (const manifest of HISTORICAL_CONTRACTS) {
      const owned = HISTORICAL_OWNERSHIP[manifest];
      // An edit to the migration it owns.
      patch(mirror, owned, (text) => `${text}\n-- probe\n`, '-- probe');
      assert.equal(runInMirror(mirror, manifest).ok, false, `${manifest} must still refuse an edit to ${owned}`);
      restore(mirror, owned);
      // The migration it owns removed outright.
      rmSync(join(mirror, owned), { force: true });
      assert.equal(runInMirror(mirror, manifest).ok, false, `${manifest} must still refuse ${owned} being removed`);
      restore(mirror, owned);
      // And an edit to a frozen predecessor it pins by content hash.
      patch(mirror, HISTORICAL_PINNED, (text) => `${text}\n-- probe\n`, '-- probe');
      assert.equal(runInMirror(mirror, manifest).ok, false, `${manifest} must still refuse an edit to ${HISTORICAL_PINNED}`);
      restore(mirror, HISTORICAL_PINNED);
    }

    // And the mirror is back to where it started, so the refusals above were real.
    for (const manifest of HISTORICAL_CONTRACTS) {
      assert.ok(runInMirror(mirror, manifest).ok, `every mutation of ${manifest}'s inputs was reverted`);
    }
  } finally {
    removeHarnessMirror(mirror);
  }
});
