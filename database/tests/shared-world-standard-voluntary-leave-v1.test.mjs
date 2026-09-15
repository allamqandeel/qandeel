// I-04C - Standard Voluntary Leave + Membership Episode Closure v1: the
// secret-free structural contract for migration 0083.
//
// Live semantics - ACLs, real denials, the atomic closure, the one canonical
// instant, bounded refusals, the audience transition, Standing Context Grant
// survival, idempotency and the multi-connection races - are proven by
// database/verify-migration-0083.mjs against real PostgreSQL, which this file
// pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04C: that THIS slice created the internal
// Standard voluntary-leave core and nothing beyond it - no application wrapper,
// controller or route; no launch gate, feature flag or entitlement; no
// remove-member, add-member, rejoin, World-end or closed-world-viewing command;
// no Introduction exit; no Shared conversation; no Personal-context read; no
// Standing Context or consent mutation; no owner, admin or sole-survivor
// authority - and that it modified no frozen predecessor migration.
//
// It deliberately does NOT prove that any of those may never appear later. A
// later reviewed slice WILL add a launch-gated leave wrapper, removal, rejoin,
// World closure, a broader end-reason vocabulary and migration 0084 and beyond.
// A historical contract that froze today's absences would fail on all of it. So
// every assertion below is scoped to one of exactly two things:
//
//   (a) migration 0083 itself, the verifier and the staleness spec it added, and
//       the two registration lines it added (package.json and API CI);
//   (b) the frozen predecessor migrations it was required not to modify, pinned
//       by content hash, which proves immutability without banning additions.
//
// There is no census of the migration list, of a directory, of the function
// catalog or of any table's live column set. The last two tests prove that by
// mutation: they mirror the repository, add the hypothetical launch-gated
// wrapper, a removal command, a rejoin command, a World-closure command, a
// broader end-reason CHECK and two later migrations, and require this contract
// to still pass - then plant the regressions it must still refuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, harnessChildCwd, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const SELF = 'shared-world-standard-voluntary-leave-v1.test.mjs';
/** Set in the child runs of the forward-safety probes, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04C_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0083_shared_world_standard_voluntary_leave_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0083.mjs');
const staleness = read('../../apps/api/src/connected-worlds/delivery-authority/voluntary-leave-audience-staleness.spec.ts');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

/** Executable SQL only: every "must not contain" assertion below runs against this, never against prose. */
const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/**
 * Executable SQL MINUS the terminal self-assertion block.
 *
 * That block legitimately NAMES every shape it refuses - the launch gate, the
 * other lifecycle literals, the Standing Context tables - so scanning it for
 * those names would make this contract fail on the very code that enforces them.
 */
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
/** The terminal self-assertion block alone, checked POSITIVELY by what it raises. */
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));
/** The body of the CREATE FUNCTION, comments included - the source PostgreSQL itself stores as prosrc. */
const functionBody = (() => {
  const start = migration.indexOf("SET search_path='' AS $$");
  assert.ok(start >= 0, 'migration 0083 creates the leave core');
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, 'the leave core has a terminated body');
  return migration.slice(start + "SET search_path='' AS $$".length, end + '\nEND'.length);
})();
/** The leave core with its `--` comments removed. */
const executableFunction = functionBody.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

/** One CREATE TABLE block, comments stripped. */
const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
const columnNames = (block) => (block.match(/^ {4}(\w+) (?:uuid|text|bigint|timestamptz)\b/gmu) ?? [])
  .map((line) => line.trim().split(' ')[0]);

const LEFT_EVENTS = 'shared_world_member_left_events';
const LEAVE_COMMANDS = 'shared_world_voluntary_leave_commands';
const OWN_TABLES = [LEFT_EVENTS, LEAVE_COMMANDS];
const EPISODES = 'shared_world_membership_episodes';
const LEAVE_FN = 'commit_shared_world_standard_voluntary_leave_v1';
const OWN_SCRIPT = 'verify:shared-world-standard-voluntary-leave:integration';

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
];

// ---------------------------------------------------------------------------

test('0083 is the forward migration after 0082, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0083 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0083_')).length, 1, 'exactly one migration carries the 0083 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0082_shared_direct_world_birth_transaction_v1.sql'), '0083 orders after 0082');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04C repairs verifiers, never history`);
  }
  // Forward-only: nothing existing is dropped, rewritten or renumbered.
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0083 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('the ONLY change to a predecessor table is the additive, unconstrained end_reason column', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.equal(foreign.length, 1, 'exactly one statement touches a table 0083 did not create');
  assert.match(foreign[0], /^ALTER TABLE public\.shared_world_membership_episodes\s*\n\s*ADD COLUMN end_reason text;$/u,
    'and it is exactly: ADD COLUMN end_reason text - nullable, with no default');
  // No NOT NULL, no DEFAULT, no CHECK and no backfill: CW2-03 §25 removal and
  // §32 closure must be able to write their own canonical reasons later, and an
  // open episode must keep carrying NULL.
  assert.doesNotMatch(deployableSql, /ADD COLUMN end_reason[^;]*(?:NOT NULL|DEFAULT)/iu, 'end_reason is nullable with no default');
  assert.doesNotMatch(deployableSql, /(?:ADD CONSTRAINT|CHECK)[^;]*end_reason/iu, 'no CHECK freezes the set of future end reasons');
  assert.doesNotMatch(deployableSql, /UPDATE public\.shared_world_membership_episodes[^;]*SET[^;]*end_reason[^;]*WHERE[^;]*ended_at IS NOT NULL/iu,
    'no invented reason is backfilled onto historical data');
  // The one reason this slice owns, and nothing else.
  const reasons = [...new Set([...deployableSql.matchAll(/'([A-Z][A-Z_]{4,})'/gu)].map((match) => match[1]))];
  for (const reason of ['REMOVED', 'WORLD_CLOSED', 'MEMBER_REMOVED', 'MEMBER_REJOINED', 'WORLD_ENDED', 'INTRODUCTION_ENDED']) {
    assert.ok(!reasons.includes(reason), `0083 writes no ${reason}: that belongs to a later reviewed slice`);
  }
  assert.match(executableFunction, /SET ended_at = leave_at, end_reason = 'VOLUNTARY_LEAVE'/u,
    'a closure sets the instant and the reason together, in one statement');
});

test('0083 creates exactly its own two narrow tables, and neither is a generic engine', () => {
  const created = [...executableSql.matchAll(/^CREATE TABLE public\.(\w+)/gmu)].map((match) => match[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly two tables, both new');
  // The complete claim about what 0083 did NOT create lives HERE, in 0083's own
  // text, and nowhere else. The real-PostgreSQL verifier deliberately makes no
  // such claim: it runs against a FULLY migrated database, so a live absence
  // census there would reject exactly the later authorized objects the roadmap
  // requires - a governance proposal table, a Launch Gate snapshot table,
  // removal / rejoin / closure / history-grant substrate - the moment any of
  // them legitimately landed.
  for (const absent of [
    'shared_world_events', 'world_events', 'shared_world_event_log', 'shared_world_removals',
    'shared_world_member_removals', 'shared_world_rejoins', 'shared_world_closures',
    'shared_world_end_commands', 'shared_world_governance_proposals', 'shared_world_member_approvals',
    'closed_world_view_entitlements', 'shared_world_history_grants', 'shared_world_settings',
    'shared_world_launch_gates', 'launch_gate_snapshots', 'feature_flags', 'introduction_records',
  ]) {
    assert.ok(!created.includes(absent), `migration 0083 creates no ${absent}: no governance, removal, rejoin, closure, entitlement or launch substrate`);
  }
  assert.deepEqual(columnNames(tableBlock(LEFT_EVENTS)), ['id', 'world_id', 'membership_episode_id', 'actor_user_id', 'occurred_at'],
    'the MEMBER_LEFT fact carries only its four facts and its identity');
  assert.deepEqual(columnNames(tableBlock(LEAVE_COMMANDS)),
    ['id', 'actor_user_id', 'world_id', 'membership_episode_id', 'member_left_event_id', 'committed_at'],
    'the durable command carries only the identities it bound and when it committed');
  for (const name of OWN_TABLES) {
    const block = tableBlock(name);
    assert.doesNotMatch(block, /json|jsonb|\[\]/iu, `${name} stores no JSON and no array`);
    assert.doesNotMatch(block, /(owner|admin|creator|survivor|privilege|role|capability|kind|event_type|payload|metadata|scope|permission|approval|vote|reason)/iu,
      `${name} creates no superior authority and is not a generic event engine - its identity IS the event`);
    for (const fk of block.match(/FOREIGN KEY[\s\S]*?(?=,\n|$)/gu) ?? []) {
      assert.match(fk, /ON DELETE RESTRICT/u, `every ${name} foreign key is restrictive: canonical history never cascades away`);
    }
  }
  // Uniqueness is per EPISODE and per EVENT. A permanent (world, user) key would
  // make a human unable to hold a future episode - and CW2-03 §28 / C25 says a
  // rejoin creates exactly that.
  assert.match(tableBlock(LEFT_EVENTS), /UNIQUE \(membership_episode_id\)/u);
  assert.match(tableBlock(LEAVE_COMMANDS), /UNIQUE \(membership_episode_id\)/u);
  assert.match(tableBlock(LEAVE_COMMANDS), /UNIQUE \(member_left_event_id\)/u);
  for (const name of OWN_TABLES) {
    assert.doesNotMatch(tableBlock(name), /UNIQUE \((?:world_id, actor_user_id|actor_user_id, world_id)\)/u,
      `${name} must not make a (World, human) pair permanently unable to leave again after a future rejoin`);
  }
});

test('the leave core is executable by no application role, and 0083 grants EXECUTE to nobody at all', () => {
  assert.doesNotMatch(executableSql, /^\s*GRANT\s/imu, 'migration 0083 contains no GRANT statement of any kind');
  assert.match(deployableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${LEAVE_FN}\\(uuid, uuid, uuid\\) FROM PUBLIC, anon, authenticated`, 'u'));
  assert.match(deployableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${LEAVE_FN}\\(uuid, uuid, uuid\\) FROM service_role`, 'u'));
  assert.match(deployableSql, new RegExp(`ALTER FUNCTION public\\.${LEAVE_FN}\\(uuid, uuid, uuid\\) OWNER TO postgres`, 'u'));
  assert.match(deployableSql, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u);
  for (const table of OWN_TABLES) {
    assert.match(deployableSql, new RegExp(`ALTER TABLE public\\.${table} OWNER TO postgres;`, 'u'));
    assert.match(deployableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.doesNotMatch(deployableSql, /CREATE POLICY/iu, 'zero RLS policies');
  assert.doesNotMatch(deployableSql, /CREATE TRIGGER/iu, 'no trigger anywhere');
  // The deployment refuses itself if any of the four roles can execute it.
  for (const phrase of [
    'I-04C: PUBLIC must not execute the leave core before the launch gate exists',
    'I-04C: % must not execute the leave core before the launch gate exists',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
  assert.match(selfAssertions, /FOREACH target_role IN ARRAY ARRAY\['anon','authenticated','service_role'\]/u);
  // And the Launch Gate is absent, not implemented and not pretended satisfied.
  assert.doesNotMatch(executableSql, /launch_gate|feature_flag|LAUNCH_GATE_SNAPSHOT|entitlement|emergency_disable/iu,
    'I-04C neither implements the Launch Gate nor invents a stand-in for it');
  // Nothing here forbids the later reviewed wrapper that will call this.
  assert.doesNotMatch(executableSql, /must never exist|may never be granted|no function named/iu,
    'no assertion forbids the launch-gated wrapper a later slice will legitimately add');
});

test('the leaving human is exactly auth.uid(), with no caller-supplied identity, episode, instant or reason', () => {
  assert.match(executableFunction, /u uuid := auth\.uid\(\)/u, 'the actor is derived, never supplied');
  const signature = migration.slice(migration.indexOf(`CREATE FUNCTION public.${LEAVE_FN}(`));
  const parameters = signature.slice(signature.indexOf('(') + 1, signature.indexOf(')'));
  assert.deepEqual(parameters.split(',').map((part) => part.trim()),
    ['p_command_id uuid', 'p_world_id uuid', 'p_member_left_event_id uuid'],
    'exactly three opaque uuid identities');
  assert.doesNotMatch(parameters, /actor|target|leaver|user_id|episode|reason|audience|count|status|lifecycle|phase|_at\b/iu,
    'no actor, target, episode, reason, audience, count or clock parameter');
  // OPAQUE means opaque: no meaning is inferred from a UUID value, INCLUDING
  // from one value equalling another. The three parameters address three
  // different domains - a command, a World and an event - and nothing frozen
  // assigns them cross-domain inequality semantics, so a pairwise-distinctness
  // rule would be invented identifier algebra. What must actually hold is
  // enforced by the primary keys, the unique bindings and the canonical-state
  // checks; database/verify-migration-0083.mjs proves cross-domain equality
  // commits with exact persisted bindings.
  assert.doesNotMatch(executableFunction, /count\(DISTINCT[^)]*\)\s*FROM unnest\(ARRAY\[p_/u,
    'no cross-domain pairwise-distinctness rule is invented over the opaque identities');
  assert.doesNotMatch(executableFunction, /p_command_id\s*(?:=|<>)\s*p_(?:world_id|member_left_event_id)/u,
    'and no identity is compared against another identity');
  assert.doesNotMatch(executableFunction, /p_world_id\s*(?:=|<>)\s*p_member_left_event_id/u);
  // The only structural refusal over the parameters is the one that really is
  // structural: a missing identity.
  assert.match(executableFunction, /IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_left_event_id IS NULL THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_INVALID'/u);
  // QANDEEL and an unauthenticated caller both fail closed.
  assert.match(executableFunction, /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_AUTHENTICATION_REQUIRED'/u,
    'a call with no human session identity fails closed, so QANDEEL can never leave for a human');
  // The episode is RESOLVED from canonical state, never accepted from a caller.
  assert.match(executableFunction, /WHERE e\.world_id = p_world_id AND e\.user_id = u AND e\.ended_at IS NULL/u,
    "the episode is exactly the caller's own open one");
  // Unilateral: no approval, no quorum, no counterpart, no owner.
  assert.doesNotMatch(executableFunction, /approval|approve|unanimous|quorum|consent_of|owner|admin|permission/iu,
    'voluntary leave requires no group approval and no superior authority');
  // The committed result is immutable history, not current state.
  assert.match(executableFunction, /RETURN QUERY SELECT 'LEFT'::text, p_command_id, p_world_id, episode\.id,\s*\n\s*p_member_left_event_id, 'VOLUNTARY_LEAVE'::text, leave_at;/u);
  assert.doesNotMatch(executableFunction, /RETURN QUERY SELECT[^;]*(?:world\.(?:lifecycle|phase)|open_episodes|count\()/u,
    'the committed result carries no current World lifecycle, audience or active-human count');
});

test('ordinary leave mechanics are ACTIVE / STANDARD only, and no Introduction exit is invented', () => {
  assert.match(executableFunction, /IF world\.lifecycle <> 'ACTIVE' OR world\.phase <> 'STANDARD' THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE'/u,
    'every state that is not ACTIVE / STANDARD reaches the one bounded class');
  assert.doesNotMatch(executableFunction, /INTRODUCTION|MUTUAL_MATCH|INTRODUCTION_ENDED|introduction_record/iu,
    'CW2-03 §14 keeps ordinary mechanics out of INTRODUCTION; this slice guesses no exit for it');
  assert.doesNotMatch(executableFunction, /READ_ONLY_CLOSED|closed_at|birth_basis/u, 'and touches no closure or birth state');
  assert.doesNotMatch(deployableSql, /matching|mutual_match|introduction_record/iu, '0083 contains no Matching or Introduction substrate');
});

test('the canonical lock order is the World row first, then the actor own open episode', () => {
  const worldLock = executableFunction.indexOf('FROM public.shared_worlds w');
  const episodeLock = executableFunction.indexOf('FROM public.shared_world_membership_episodes e');
  const write = executableFunction.indexOf('UPDATE public.shared_world_membership_episodes');
  const event = executableFunction.indexOf('INSERT INTO public.shared_world_member_left_events');
  assert.ok(worldLock > 0 && episodeLock > worldLock && write > episodeLock && event > write,
    'World row, then the actor own open episode, then the closure, then the MEMBER_LEFT fact');
  assert.equal((executableFunction.match(/FOR UPDATE/gu) ?? []).length, 2, 'exactly two row locks');
  assert.doesNotMatch(executableFunction, /pg_advisory|LOCK TABLE/iu, 'no advisory key and no table lock');
  // The World row is what the frozen I-03C consent commands also take first,
  // which is what makes a leave and a grant serialize rather than interleave.
  assert.match(migration, /I-03C commands take first/u, 'the migration states why the World row must be first');
  for (const phrase of [
    'I-04C: leave must lock the exact World row, then the actor own open episode, before any write',
    'I-04C: the leave core takes exactly two row locks: the World and the actor own open episode',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
});

test('ONE database-owned leave instant, captured exactly once and reused for all three persisted moments', () => {
  assert.equal((executableFunction.match(/leave_at := /gu) ?? []).length, 1, 'captured exactly once');
  assert.match(executableFunction, /leave_at := clock_timestamp\(\);/u, 'from the database clock');
  assert.doesNotMatch(executableFunction, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u, 'and never read a second time');
  assert.match(executableFunction, /SET ended_at = leave_at/u);
  assert.match(executableFunction, /VALUES \(p_member_left_event_id, p_world_id, episode\.id, u, leave_at\)/u);
  assert.match(executableFunction, /VALUES \(p_command_id, u, p_world_id, episode\.id, p_member_left_event_id, leave_at\)/u);
  assert.ok(selfAssertions.includes('I-04C: the canonical leave instant must be captured exactly once'));
});

test('the episode is CLOSED IN PLACE - never deleted, never replaced, never re-dated', () => {
  assert.doesNotMatch(executableFunction, /DELETE FROM|TRUNCATE/iu, 'no membership row is ever deleted');
  assert.doesNotMatch(executableFunction, /INSERT INTO public\.shared_world_membership_episodes/u,
    'a leave closes the existing episode rather than writing a replacement');
  assert.doesNotMatch(executableFunction, /SET[^;]*(?:joined_at|world_id|user_id)\s*=/u, 'the historical join moment, World and human are never rewritten');
  assert.match(executableFunction, /WHERE e\.id = episode\.id AND e\.ended_at IS NULL/u, 'and only an OPEN episode can be closed');
});

test('voluntary leave never closes, deletes or converts the World, and zero active humans is valid', () => {
  assert.doesNotMatch(executableFunction, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
    'the World row is read under lock and never written');
  // No member-count logic of any kind: neither a "must retain one member" rule
  // nor an auto-close on the last leave (CW2-03 §26, §27, C22 - C24).
  assert.doesNotMatch(executableFunction, /count\(\*\)[^;]*ended_at IS NULL[^;]*<>\s*0|remaining|survivor|last_member|sole/iu,
    'no rule blocks the final leave and none closes the World when it happens');
  // The only count in the body is the contradictory-state probe for ONE human.
  const counts = executableFunction.match(/count\(\*\)/gu) ?? [];
  assert.equal(counts.length, 1, 'the body counts exactly one thing');
  assert.match(executableFunction, /SELECT count\(\*\) INTO open_episodes\s*\n\s*FROM public\.shared_world_membership_episodes probe\s*\n\s*WHERE probe\.world_id = p_world_id AND probe\.user_id = u AND probe\.ended_at IS NULL/u,
    'and it is the impossible-state probe for the caller own episodes, not a membership quorum');
  assert.match(executableFunction, /IF open_episodes > 1 THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE'/u);
  for (const phrase of [
    'I-04C: % must not create, close or mutate a Shared World',
    'I-04C: % must not close a World or touch its birth state',
  ]) assert.ok(selfAssertions.includes(phrase), `the migration refuses to deploy without: ${phrase}`);
});

test('leave mutates NO Standing Context state, and invents no grantor-membership rule', () => {
  // The binding correction: membership loss and grant revocation are separate
  // canonical truths (CW2-02 §32 - there is no universal retroactive revocation
  // rule and a Standing Context Grant is revocable for FUTURE reasoning, by its
  // owner; frozen I-03E - a valid current grant IS an independent authority
  // basis for a departed owner where all frozen conditions permit).
  assert.doesNotMatch(executableFunction, /standing_context|consent|grant/iu,
    'the leave core names no grant, ceiling or consent table at all');
  assert.doesNotMatch(executableSql, /UPDATE public\.shared_world_standing_context_grants|DELETE FROM public\.shared_world_standing_context_grant_audience|INSERT INTO public\.shared_world_standing_context_consent_events/u,
    'nothing in 0083 revokes a grant, contracts a ceiling or appends a consent event');
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'and no trigger could do it implicitly');
  // Asserted positively too: the deployment refuses a coupling in either direction.
  assert.ok(selfAssertions.includes('I-04C: no trigger may couple membership to Standing Context state on %'));
  assert.ok(selfAssertions.includes("I-04C: % must not read Personal context or touch Standing Context / consent state"));
  // And no membership condition is introduced into the frozen authority layers.
  assert.doesNotMatch(executableSql, /grantor[^;\n]*current[^;\n]*member|must remain (?:an? )?(?:active |current )?member/iu,
    'no "grantor must still be a member" rule is invented anywhere');
  // I-04C touches no Connected Worlds production TypeScript. The only .ts it adds
  // is a test-only spec, and that spec wires no service.
  assert.match(staleness, /\.spec\.ts|describe\(|it\(/u, 'the staleness proof is a test');
  assert.doesNotMatch(staleness, /@Injectable|@Controller|@Get\(|@Post\(|NestFactory|Module/u, 'and wires no production service');
  assert.match(staleness, /fingerprintSharedHumanAudience/u, 'it uses the FROZEN audience fingerprint, unchanged');
  assert.match(staleness, /AUDIENCE_CHANGED/u, 'and the frozen stale reasons');
  assert.match(staleness, /NO_ACTIVE_HUMANS/u);
  assert.doesNotMatch(staleness, /SHARED_DELIVERY_AUTHORITY_STALE_REASONS\s*=/u, 'it defines no new authority code');
});

test('no Personal context, and no substrate this slice does not own', () => {
  assert.doesNotMatch(executableFunction, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context/iu,
    'the leave core reads no Personal context of any kind');
  // No command, table or event beyond the one this slice owns.
  assert.doesNotMatch(deployableSql, /CREATE FUNCTION public\.\w*(?:remove|reject|rejoin|add_member|end_world|close_world|decline|cancel|expire|entitlement|history_grant|setting)\w*/iu,
    '0083 creates no removal, rejoin, add-member, closure, entitlement, history-grant or settings command');
  const functions = [...executableSql.matchAll(/CREATE FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(functions, [LEAVE_FN], 'exactly one function, and it is the leave core');
  assert.doesNotMatch(deployableSql, /message|conversation|qandeel_output|replay|public_world/iu, 'no Shared conversation runtime');
});

test('every prosrc-level self-assertion the migration makes is true of the body it will actually store', () => {
  // pg_proc.prosrc INCLUDES the function's comments, so the migration's own
  // checks run against comments as well as code. This mirrors each of them
  // locally, so a prose slip fails here instead of failing a CI deployment.
  const stored = functionBody;
  const occurrences = (needle) => stored.split(needle).length - 1;
  assert.match(stored, /auth\.uid\(\)/u);
  assert.doesNotMatch(stored, /conversation_|\Wmemor|human_intelligence|hypothes|effective_context|standing_context|consent|matching|introduction/iu,
    'no banned word appears anywhere in the stored body, comments included');
  assert.doesNotMatch(stored, /DELETE FROM|TRUNCATE/iu);
  assert.doesNotMatch(stored, /pg_advisory|LOCK TABLE/iu);
  assert.doesNotMatch(stored, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u);
  assert.doesNotMatch(stored, /READ_ONLY_CLOSED|closed_at|MUTUAL_MATCH|birth_basis/u);
  assert.doesNotMatch(stored, /REMOVED|WORLD_CLOSED|MEMBER_REMOVED|MEMBER_REJOINED|WORLD_ENDED|INTRODUCTION_ENDED/u);
  assert.match(stored, /world\.lifecycle <> 'ACTIVE' OR world\.phase <> 'STANDARD'/u);
  assert.match(stored, /SET ended_at = leave_at, end_reason = 'VOLUNTARY_LEAVE'/u);
  assert.equal(occurrences("'VOLUNTARY_LEAVE'"), 8, 'the reason constant appears on every path the migration counts');
  assert.doesNotMatch(stored, /RETURN QUERY SELECT[^;]*(world\.|episode\.ended_at|open_episodes)/u);
  assert.equal(occurrences("RETURN QUERY SELECT 'LEFT'::text, committed.id, committed.world_id, committed.membership_episode_id,"), 3,
    'three idempotency passes, each returning what the command committed');
  assert.equal(occurrences('JOIN public.shared_world_membership_episodes ep ON ep.id = ev.membership_episode_id'), 3,
    'and each failing closed on a fact that stopped being coherent');
  assert.equal(occurrences('FOR UPDATE'), 2);
  assert.equal(occurrences('leave_at := '), 1);
  assert.doesNotMatch(stored, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u);
});

test('every RAISE in the migration has as many % placeholders as arguments', () => {
  // A RAISE carrying an argument with no placeholder is a COMPILE-time error
  // ("too many parameters specified for RAISE"), so one slip anywhere stops the
  // whole migration from deploying. Caught here rather than in CI.
  let checked = 0;
  for (const match of migration.matchAll(/RAISE\s+EXCEPTION\s+'((?:[^']|'')*)'((?:\s*,\s*[A-Za-z_][\w.]*)*)/gu)) {
    checked += 1;
    const placeholders = (match[1].match(/%/gu) ?? []).length;
    const args = match[2].trim() === '' ? 0 : match[2].split(',').filter((part) => part.trim() !== '').length;
    assert.equal(placeholders, args, `RAISE "${match[1].slice(0, 60)}" has ${placeholders} placeholders and ${args} arguments`);
  }
  assert.ok(checked >= 40, `every RAISE was audited, found ${checked}`);
});

test('the bounded refusal classes are exactly the ones this slice owns, and none enumerates', () => {
  const raised = [...new Set([...executableFunction.matchAll(/RAISE EXCEPTION '([A-Z_]+)'/gu)].map((match) => match[1]))].sort();
  assert.deepEqual(raised, [
    'SHARED_WORLD_LEAVE_CONTRADICTORY_STATE',
    'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE',
    'SHARED_WORLD_VOLUNTARY_LEAVE_AUTHENTICATION_REQUIRED',
    'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_ID_CONFLICT',
    'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_INVALID',
    'SHARED_WORLD_VOLUNTARY_LEAVE_ID_CONFLICT',
  ], 'six bounded classes and no more');
  // The unavailable class is raised for every distinguishable cause, so a future
  // wrapper cannot tell a non-member from an absent World from a wrong state.
  assert.ok((executableFunction.match(/SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE/gu) ?? []).length >= 3,
    'the same bounded class answers the missing World, the wrong state and the absent episode');
  assert.doesNotMatch(executableFunction, /RAISE EXCEPTION[^;]*(?:USING MESSAGE|%'\s*,\s*(?:u|episode|world))/u,
    'no refusal interpolates a human, a World or a topology fact into its message');
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0083.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0083/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0083\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  // Flow-mapping step names must carry no comma (the repository's CI convention).
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.doesNotMatch(workflow, /Mobile CI/u, 'I-04C adds no Mobile CI step');
  assert.match(readme, /0083_shared_world_standard_voluntary_leave_v1\.sql/u, 'the README records migration 0083');
  assert.match(readme, /VOLUNTARY_LEAVE/u);
  // Anti-drift: the README's count of repaired predecessor verifiers is derived
  // from the actual set, not written by hand.
  const repairedVerifiers = ['0075', '0076', '0078', '0081', '0082']
    .filter((name) => read(`../verify-migration-${name}.mjs`).includes('FORWARD SAFETY (I-04C)'));
  assert.equal(repairedVerifiers.length, 5, 'five predecessor verifiers carry the I-04C forward-safety repair');
  const repairParagraph = readme.slice(readme.indexOf('Five predecessor verifiers were repaired'));
  assert.ok(repairParagraph.startsWith('Five predecessor verifiers were repaired'), 'the README says five, not four');
  const named = repairParagraph.slice(0, 400);
  for (const name of repairedVerifiers) assert.ok(named.includes(name), `and names ${name} among them`);
  assert.doesNotMatch(readme, /Four predecessor verifiers were repaired/u, 'no stale count remains');
  // The README must not describe the removed distinctness rule either.
  const leaveSection = readme.slice(readme.indexOf('## Standard voluntary leave'));
  assert.doesNotMatch(leaveSection, /pairwise distinct/u, 'the README describes no cross-domain distinctness rule for I-04C');
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  // FIX-01 and FIX-02. This verifier runs against a FULLY migrated database, so
  // any absence census or exact-count assertion in it is a ceiling on the whole
  // roadmap rather than a fact about migration 0083.
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES/u,
    'no live future-table absence census: what 0083 did not create is proven from 0083 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*foreignKeys\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraints\.length/u, 'and neither are constraints');
  // Each foreign key 0083 owns is pinned by name, local columns, parent and
  // restrictive deletion - which is strictly stronger than a count of seven.
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  for (const [name, columns, parent] of [
    ['shared_world_member_left_events_world_fk', 'world_id', 'shared_worlds'],
    ['shared_world_member_left_events_episode_fk', 'membership_episode_id', 'shared_world_membership_episodes'],
    ['shared_world_member_left_events_actor_fk', 'actor_user_id', 'users'],
    ['shared_world_voluntary_leave_commands_actor_fk', 'actor_user_id', 'users'],
    ['shared_world_voluntary_leave_commands_world_fk', 'world_id', 'shared_worlds'],
    ['shared_world_voluntary_leave_commands_episode_fk', 'membership_episode_id', 'shared_world_membership_episodes'],
    ['shared_world_voluntary_leave_commands_event_fk', 'member_left_event_id', 'shared_world_member_left_events'],
  ]) {
    assert.ok(verifier.includes(`${name}: 'FOREIGN KEY (${columns}) REFERENCES ${parent}(id) ON DELETE RESTRICT'`),
      `${name} is pinned exactly: local columns, parent and restrictive deletion`);
    assert.match(migration, new RegExp(`CONSTRAINT ${name}\\s*\\n?\\s*FOREIGN KEY \\(${columns}\\) REFERENCES public\\.${parent} \\(id\\) ON DELETE RESTRICT`, 'u'),
      `and migration 0083 really declares ${name} that way`);
  }
  // FIX-02's second half: the forward safety is proven by the real-PostgreSQL
  // verifier itself, not only by the static mirror below.
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  for (const authorized of ['_proposals (id uuid PRIMARY KEY)', 'ADD COLUMN', 'ADD CONSTRAINT', 'CREATE INDEX']) {
    assert.ok(verifier.includes(authorized), `the probe performs a later authorized ${authorized}`);
  }
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires the real regressions to still be refused');
  assert.ok((verifier.match(/ALTER TABLE \$\{(?:LEAVE_COMMANDS|LEFT_EVENTS|EPISODES)\} (?:DROP|ADD)/gu) ?? []).length >= 5,
    'the probe plants both the authorized evolution and the regressions');
});

test('the repaired predecessor verifiers keep every invariant they owned, and stop censusing the live schema', () => {
  // I-04C's additive end_reason is legal canon (CW2-03 §15) and was blocked only
  // by four verifiers asserting the EXACT live shape of tables they do not own
  // forever. Each was narrowed to what its own migration created. The invariants
  // themselves are untouched, which is what these assertions check.
  const repaired = {
    '../verify-migration-0075.mjs': [
      'still carries every column migration 0075 owns, unchanged and in its original position',
      "still carries migration 0075's",
      'shared_world_membership_episodes_one_open_idx',
      'shared_worlds_closure_consistency_check',
    ],
    '../verify-migration-0076.mjs': [
      'still carries every column migration 0076 owns, unchanged and in its original position',
      "still carries migration 0076's",
      'shared_world_standing_context_grants_one_active_idx',
    ],
    '../verify-migration-0078.mjs': [
      'still carries every column migration 0078 owns, unchanged and in its original position',
      "still carries migration 0078's",
      'shared_world_standing_context_consent_events_prior_grant_check',
    ],
    '../verify-migration-0081.mjs': [
      'still carries every column migration 0081 owns, unchanged and in its original position',
      "0081's",
      'shared_world_direct_invitations_target_pending_idx',
    ],
  };
  for (const [file, phrases] of Object.entries(repaired)) {
    const text = read(file);
    for (const phrase of phrases) assert.ok(text.includes(phrase), `${file} still proves: ${phrase}`);
  }
  // 0078's global function census is narrowed to the two functions it created.
  const consent = read('../verify-migration-0078.mjs');
  assert.doesNotMatch(consent, /pr\.proname ~ 'standing_context'/u, "0078 no longer censuses every Standing Context function in the database");
  assert.match(consent, /pr\.proname IN \('grant_shared_world_standing_context_v1','revoke_shared_world_standing_context_v1'\)/u,
    'it names exactly the two commands migration 0078 created');
  assert.match(consent, /exactly the two commands migration 0078 created exist/u);
});

test('no Connected Worlds verifier censuses the live schema or the function catalog', () => {
  // The defect class, in both of its costumes: an exact live-column / live-
  // constraint / live-index comparison, and a pattern-matched count of every
  // function in the database. Either one fails the moment a later authorized
  // slice evolves the schema, which is never a fact about the historical
  // migration whose verifier carries it.
  const verifiers = readdirSync(new URL('../', import.meta.url))
    .filter((name) => /^verify-migration-00(?:7[5-9]|8\d)\.mjs$/u.test(name));
  assert.ok(verifiers.length >= 8, `the Connected Worlds verifiers are present, found ${verifiers.length}`);
  for (const file of verifiers) {
    const text = read(`../${file}`);
    assert.doesNotMatch(text,
      /assert\.deepEqual\(\s*(?:\(await [^)]+\)|[A-Za-z_$][\w$]*)\s*\.map\(\([a-z]+\) => (?:\[[a-z]+\.(?:column_name|name|indexname|conname)|[a-z]+\.(?:name|conname|indexname)\))/u,
      `${file} must not compare a whole live column / constraint / index list to a fixed one`);
    assert.doesNotMatch(text, /count\(\*\)[^;]*pg_(?:proc|class)[^;]*proname\s*~/u,
      `${file} must not count every function in the database whose name matches a pattern`);
    assert.doesNotMatch(text, /proname\s*~\*?\s*'[^']*(?:accept|decline|cancel|expire|birth|leave|remove|rejoin|close|launch|wrapper)/u,
      `${file} must not census the catalog for names later authorized work will legitimately use`);

    // FIX-02D, class 1: a LIVE future-object absence census. The structural
    // signature is a query against the TABLE catalog - information_schema.tables
    // or pg_class - whose name predicate is a fixed list, asserted to be empty.
    // Deliberately narrow: an owned-shape query over a verifier's OWN tables
    // (`information_schema.columns ... table_name = ANY(OWN_TABLES)`) is a
    // legitimate owned invariant and must keep passing, and so must a single
    // named architectural ban such as 0075's `relname='worlds'`.
    assert.doesNotMatch(text, /FROM (?:information_schema\.tables|pg_class)[^;]*\b(?:relname|table_name)\s*=\s*ANY\(/u,
      `${file} must not require a fixed list of table names to stay absent from the fully migrated database`);
    assert.doesNotMatch(text, /const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST|NONEXISTENT)\w*\s*=\s*\[/u,
      `${file} declares no fixed future-object list: what a migration did not create is proven from its own text`);

    // FIX-02D, class 2: an exact total count of a live schema object on a table a
    // later reviewed slice may extend. Counting is weaker than naming AND it is a
    // ceiling; each owned object is asserted individually instead.
    assert.doesNotMatch(text, /assert\.(?:equal|strictEqual)\(\s*\w*(?:[Ff]oreign[Kk]ey|[Cc]onstraint|[Ii]ndex|[Pp]olic|[Cc]olumn)\w*\.length\s*,\s*\d+/u,
      `${file} must not assert an exact total count of live foreign keys, constraints, indexes or columns`);
    assert.doesNotMatch(text, /\w*(?:[Ff]oreign[Kk]ey|[Cc]onstraint|[Ii]ndex)\w*\.length\s*===\s*\d+/u,
      `${file} must not compare a live schema-object count to a fixed number`);
  }
});

test('the historical 0081 and 0082 verifiers prove their own forward safety against real PostgreSQL', () => {
  // FIX-02D's executable half. A detector alone would only stop the class coming
  // back; these probes show the repaired verifiers actually survive the future
  // they used to forbid, and still refuse a real regression to what they own.
  const invitation = read('../verify-migration-0081.mjs');
  const birth = read('../verify-migration-0082.mjs');
  for (const [name, text] of [['0081', invitation], ['0082', birth]]) {
    assert.match(text, /async function verifyForwardSafety\(/u, `verifier ${name} proves forward safety against real PostgreSQL`);
    assert.match(text, /await verifyForwardSafety\(\);/u, `and verifier ${name} actually runs it`);
    assert.match(text, /await assert\.rejects\(verifyCatalog\(\), refuses/u, `and verifier ${name} requires real regressions to still be refused`);
    assert.match(text, /SAVEPOINT forward_safety/u, `and verifier ${name} rolls the hypothetical future back`);
  }
  // The probes create exactly the objects each file used to forbid for ever.
  for (const future of ['matching_proposals', 'introduction_records', 'invitations', 'invitation_credentials']) {
    assert.ok(invitation.includes(`'${future}'`), `0081's probe creates a later ${future}`);
  }
  for (const future of ['shared_world_settings', 'shared_world_launch_gates', 'launch_gate_snapshots', 'feature_flags', 'introduction_records']) {
    assert.ok(birth.includes(`'${future}'`), `0082's probe creates a later ${future}`);
  }
  // And 0082's probe adds a later additive foreign key on one of its OWN tables,
  // with a deletion rule 0082 has no authority over.
  assert.match(birth, /ADD CONSTRAINT \$\{probe\}_fk[\s\S]{0,200}ON DELETE SET NULL/u,
    "0082's probe proves a later additive foreign key with its own deletion rule is not an 0082 regression");
  // Each of the seven foreign keys 0082 owns is named, and a regression to one is refused.
  for (const owned of ['shared_direct_acceptance_actor_fk', 'shared_direct_acceptance_inviter_episode_fk',
    'shared_direct_acceptance_invitation_fk', 'shared_direct_acceptance_target_episode_fk',
    'shared_direct_acceptance_world_fk', 'shared_world_direct_birth_events_invitation_fk',
    'shared_world_direct_birth_events_world_fk']) {
    assert.ok(birth.includes(`['${owned}',`), `0082 asserts ${owned} individually, by name`);
  }
  for (const refused of ['one of the seven owned foreign keys is removed', 'an owned foreign key stops being restrictive',
    'an owned foreign key is repointed at another table']) {
    assert.ok(birth.includes(refused), `0082 still refuses: ${refused}`);
  }
});

test('no database contract - this one included - carries a migration census, so 0084 can exist without editing one', () => {
  for (const file of readdirSync(new URL('./', import.meta.url)).filter((name) => name.endsWith('.test.mjs'))) {
    const text = read(`./${file}`);
    assert.doesNotMatch(text, /migrations\.slice\(-\d+\)/u, `${file} runs no migration tail census`);
    assert.doesNotMatch(text, /migrations\.filter\(\(name\) => name > '\d{4}_/u, `${file} enumerates no exhaustive successor list`);
  }
});

// ---------------------------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0083 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  const weakenings = [
    ['grants authenticated EXECUTE', (text) => text.replace(
      `REVOKE ALL ON FUNCTION public.${LEAVE_FN}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
      `GRANT EXECUTE ON FUNCTION public.${LEAVE_FN}(uuid, uuid, uuid) TO authenticated;`)],
    ['accepts a caller-supplied actor', (text) => text.replace(
      'p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid',
      'p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid, p_actor_user_id uuid')],
    ['accepts a caller-supplied episode', (text) => text.replace(
      'p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid',
      'p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid, p_membership_episode_id uuid')],
    ['processes an INTRODUCTION World', (text) => text.replace(
      "IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN",
      "IF world.lifecycle <> 'ACTIVE' THEN")],
    ['closes the World automatically', (text) => text.replace(
      'INSERT INTO public.shared_world_member_left_events (id, world_id, membership_episode_id, actor_user_id, occurred_at)',
      "UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = p_world_id;\n"
      + '    INSERT INTO public.shared_world_member_left_events (id, world_id, membership_episode_id, actor_user_id, occurred_at)')],
    ['refuses the final leave', (text) => text.replace(
      'IF open_episodes > 1 THEN',
      "IF (SELECT count(*) FROM public.shared_world_membership_episodes survivor WHERE survivor.world_id = p_world_id AND survivor.ended_at IS NULL) < 2 THEN\n"
      + "    RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;\n  IF open_episodes > 1 THEN")],
    ['DELETES the episode', (text) => text.replace(
      'UPDATE public.shared_world_membership_episodes e\n       SET ended_at = leave_at, end_reason = \'VOLUNTARY_LEAVE\'\n     WHERE e.id = episode.id AND e.ended_at IS NULL;',
      'DELETE FROM public.shared_world_membership_episodes e WHERE e.id = episode.id;')],
    ['replaces the episode instead of closing it', (text) => text.replace(
      'UPDATE public.shared_world_membership_episodes e\n       SET ended_at = leave_at, end_reason = \'VOLUNTARY_LEAVE\'\n     WHERE e.id = episode.id AND e.ended_at IS NULL;',
      'INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at, end_reason)\n'
      + "     VALUES (p_member_left_event_id, p_world_id, u, leave_at, leave_at, 'VOLUNTARY_LEAVE');")],
    ['omits end_reason', (text) => text.replace(
      "SET ended_at = leave_at, end_reason = 'VOLUNTARY_LEAVE'", 'SET ended_at = leave_at')],
    ['writes a reason this slice does not own', (text) => text.replace(
      "SET ended_at = leave_at, end_reason = 'VOLUNTARY_LEAVE'", "SET ended_at = leave_at, end_reason = 'MEMBER_REMOVED'")],
    ['reads the clock twice', (text) => text.replace(
      'VALUES (p_member_left_event_id, p_world_id, episode.id, u, leave_at)',
      'VALUES (p_member_left_event_id, p_world_id, episode.id, u, clock_timestamp())')],
    ['omits the MEMBER_LEFT fact', (text) => text.replace(
      /    INSERT INTO public\.shared_world_member_left_events \(id, world_id, membership_episode_id, actor_user_id, occurred_at\)\n    VALUES \([^;]*\);\n/u, '')],
    ['auto-revokes the departed grantor Standing Context Grant', (text) => text.replace(
      'INSERT INTO public.shared_world_voluntary_leave_commands',
      "UPDATE public.shared_world_standing_context_grants SET status='REVOKED', revoked_at = leave_at\n"
      + '     WHERE world_id = p_world_id AND grantor_user_id = u;\n'
      + '    INSERT INTO public.shared_world_voluntary_leave_commands')],
    ['contracts the grant audience ceiling', (text) => text.replace(
      'INSERT INTO public.shared_world_voluntary_leave_commands',
      'DELETE FROM public.shared_world_standing_context_grant_audience WHERE audience_user_id = u;\n'
      + '    INSERT INTO public.shared_world_voluntary_leave_commands')],
    ['requires the grantor to remain in the current audience', (text) => text.replace(
      "IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN",
      "IF NOT EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants g\n"
      + "                  WHERE g.world_id = p_world_id AND g.grantor_user_id = u AND g.status = 'ACTIVE') THEN\n"
      + "    RAISE EXCEPTION 'SHARED_WORLD_STANDARD_LEAVE_NOT_AVAILABLE' USING ERRCODE='P0002';\n  END IF;\n"
      + "  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'STANDARD' THEN")],
    ['reverses the lock order', (text) => text.replace(
      'SELECT * INTO world\n    FROM public.shared_worlds w\n   WHERE w.id = p_world_id\n   FOR UPDATE;',
      'SELECT * INTO episode\n    FROM public.shared_world_membership_episodes e\n   WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL\n   FOR UPDATE;\n'
      + '  SELECT * INTO world\n    FROM public.shared_worlds w\n   WHERE w.id = p_world_id;')],
    ['makes a (World, human) pair permanently unable to leave again', (text) => text.replace(
      'CONSTRAINT shared_world_voluntary_leave_commands_episode_key UNIQUE (membership_episode_id),',
      'CONSTRAINT shared_world_voluntary_leave_commands_episode_key UNIQUE (membership_episode_id),\n'
      + '    CONSTRAINT shared_world_voluntary_leave_commands_pair_key UNIQUE (world_id, actor_user_id),')],
    ['constrains the future end-reason vocabulary', (text) => text.replace(
      'ADD COLUMN end_reason text;',
      "ADD COLUMN end_reason text CHECK (end_reason IS NULL OR end_reason = 'VOLUNTARY_LEAVE');")],
    ['makes end_reason NOT NULL with a default', (text) => text.replace(
      'ADD COLUMN end_reason text;', "ADD COLUMN end_reason text NOT NULL DEFAULT 'VOLUNTARY_LEAVE';")],
    ['returns the current World lifecycle as the committed result', (text) => text.replace(
      "RETURN QUERY SELECT 'LEFT'::text, p_command_id, p_world_id, episode.id,\n                      p_member_left_event_id, 'VOLUNTARY_LEAVE'::text, leave_at;",
      "RETURN QUERY SELECT 'LEFT'::text, p_command_id, p_world_id, episode.id,\n                      p_member_left_event_id, world.lifecycle, leave_at;")],
    ['invents a cross-domain pairwise-distinctness rule over the opaque identities', (text) => text.replace(
      '  -- Durable idempotency, first pass: before any lock, so an equivalent retry of',
      '  IF (SELECT count(DISTINCT supplied) FROM unnest(ARRAY[p_command_id, p_world_id, p_member_left_event_id]) AS supplied) <> 3 THEN\n'
      + "    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_INVALID' USING ERRCODE='22023';\n  END IF;\n\n"
      + '  -- Durable idempotency, first pass: before any lock, so an equivalent retry of')],
    ['compares one opaque identity against another', (text) => text.replace(
      '  IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_left_event_id IS NULL THEN',
      '  IF p_command_id = p_world_id THEN\n'
      + "    RAISE EXCEPTION 'SHARED_WORLD_VOLUNTARY_LEAVE_COMMAND_INVALID' USING ERRCODE='22023';\n  END IF;\n"
      + '  IF p_command_id IS NULL OR p_world_id IS NULL OR p_member_left_event_id IS NULL THEN')],
    ['adds a membership-to-grant trigger', (text) => text.replace(
      'CREATE FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(',
      'CREATE TRIGGER shared_world_leave_revokes_grants AFTER UPDATE ON public.shared_world_membership_episodes\n'
      + '  FOR EACH ROW EXECUTE FUNCTION public.commit_shared_world_standard_voluntary_leave_v1();\n'
      + 'CREATE FUNCTION public.commit_shared_world_standard_voluntary_leave_v1(')],
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
    removeHarnessMirror(mirror);
  }
});

// ---------------------------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
// ---------------------------------------------------------------------------------------------

/** Only the paths this contract actually reads. */
const MIRRORED = ['database', 'apps/api/src/connected-worlds', '.github/workflows/api-ci.yml', 'package.json',
  'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04c-forward-');
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
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'database', 'tests', file)], { cwd: harnessChildCwd(mirror), encoding: 'utf8', env });
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

test('the launch-gated wrapper and every later authorized lifecycle slice leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    // Registered the moment the mirror exists, so no path out of this test can leave the tree behind.
    t.after(() => removeHarnessMirror(mirror));
    try {
      // The repository, several authorized steps into its future.
      write(mirror, 'database/migrations/0084_shared_world_member_removal_v1.sql',
        '-- A later reviewed slice: governed removal (CW2-03 section 25).\n'
        + 'BEGIN;\n'
        + 'ALTER TABLE public.shared_world_membership_episodes\n'
        + "  ADD CONSTRAINT shared_world_membership_episodes_end_reason_check\n"
        + "  CHECK (end_reason IS NULL OR end_reason IN ('VOLUNTARY_LEAVE','REMOVED','WORLD_CLOSED'));\n"
        + 'CREATE TABLE public.shared_world_governance_proposals (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'CREATE FUNCTION public.commit_shared_world_member_removal_v1(p_command_id uuid, p_world_id uuid, p_target_user_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "BEGIN\n  UPDATE public.shared_world_membership_episodes e SET ended_at = clock_timestamp(), end_reason = 'REMOVED'\n"
        + '   WHERE e.world_id = p_world_id AND e.user_id = p_target_user_id AND e.ended_at IS NULL;\nEND$fn$;\n'
        + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_member_removal_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/migrations/0085_shared_world_launch_gate_and_leave_wrapper_v1.sql',
        '-- The launch-gated wrapper this slice deliberately did not add.\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL);\n'
        + 'CREATE FUNCTION public.resolve_current_launch_gate_snapshot_v1(p_capability text)\n'
        + "RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$ SELECT 'SATISFIED'::text $fn$;\n"
        + 'CREATE FUNCTION public.leave_shared_world_v1(p_command_id uuid, p_world_id uuid, p_member_left_event_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + "  IF public.resolve_current_launch_gate_snapshot_v1('SHARED_VOLUNTARY_LEAVE') <> 'SATISFIED' THEN\n"
        + "    RAISE EXCEPTION 'LAUNCH_GATE_UNSATISFIED' USING ERRCODE='42501';\n  END IF;\n"
        + '  PERFORM public.commit_shared_world_standard_voluntary_leave_v1(p_command_id, p_world_id, p_member_left_event_id);\n'
        + 'END$fn$;\n'
        + 'GRANT EXECUTE ON FUNCTION public.leave_shared_world_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0084.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-member-removal-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      write(mirror, 'apps/api/src/connected-worlds/leave/shared-leave.controller.ts',
        "import { Controller, Post } from '@nestjs/common';\n@Controller('shared-worlds')\nexport class SharedLeaveController { @Post('leave') leave(): void {} }\n");
      assert.ok(runInMirror(mirror).ok,
        'a launch-gated wrapper, a governed removal with a broader end-reason vocabulary, a controller and migrations 0084/0085 must all leave this contract passing');

      // And the regressions it must still refuse.
      const regressions = [
        ['0083 itself grants EXECUTE', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${LEAVE_FN}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${LEAVE_FN}(uuid, uuid, uuid) TO authenticated;`)],
        ["a frozen predecessor migration is edited", () => patch(mirror, 'database/migrations/0082_shared_direct_world_birth_transaction_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0083 revokes a Standing Context Grant', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'INSERT INTO public.shared_world_voluntary_leave_commands',
          "UPDATE public.shared_world_standing_context_grants SET status='REVOKED' WHERE grantor_user_id = u;\n"
          + '    INSERT INTO public.shared_world_voluntary_leave_commands')],
        ['0083 closes the World on the last leave', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'INSERT INTO public.shared_world_member_left_events (id,',
          "UPDATE public.shared_worlds SET lifecycle='READ_ONLY_CLOSED' WHERE id = p_world_id;\n"
          + '    INSERT INTO public.shared_world_member_left_events (id,')],
        ['a predecessor verifier restores its live-column census', () => patch(mirror, 'database/verify-migration-0075.mjs',
          'assert.deepEqual(\n      observed.slice(0, owned.length),\n      owned,',
          'assert.deepEqual(\n      columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]),\n      owned,')],
        ["0078 restores its global function count ceiling", () => patch(mirror, 'database/verify-migration-0078.mjs',
          "WHERE n.nspname='public' AND pr.proname IN ('grant_shared_world_standing_context_v1','revoke_shared_world_standing_context_v1')`);\n  assert.equal(commands, 2,",
          "WHERE n.nspname='public' AND pr.proname ~ 'standing_context' AND pr.proname !~ '^resolve_'`);\n  assert.equal(commands, 2,")],
      ];
      for (const [reason, plant] of regressions) {
        const snapshot = buildMirror();
        try {
          plant(mirror);
          assert.equal(runInMirror(mirror).ok, false, `a repository where ${reason} must still be refused`);
        } finally {
          // The wipe-and-restore has to actually happen: a mirror that kept a planted regression
          // would make every scenario after this one prove the wrong thing. This is the one place
          // where a cleanup failure must fail, so it is asserted rather than only warned about.
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
