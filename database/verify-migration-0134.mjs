// W3-CORR-U — QANDEEL Understanding Integrity: the real-PostgreSQL verifier for migration 0134.
//
// It proves, against a fully migrated database (API CI applies every migration first):
//   1. the catalog: the four nullable resolution facts, the two-state lifecycle check, the resolution-shape check, the
//      resolution command key, 0127's partial one-under-review index unchanged; the forward-only lifecycle trigger and
//      the withdrawal trigger on the lifecycle audit (WHEN REJECTED / RETIRED only); the resolve command DEFINER in the
//      non-exposed `understanding_private` with a `public` INVOKER pass-through; every grant explicit — EXECUTE for
//      `authenticated` only, the two trigger functions executable by no role, no client write on either table;
//   2. U-1 focus continuity (rolled back): the open focus follows the disagreement's re-evaluation step to v+1 in the
//      same transaction with opened_at unchanged; a closed focus is never reopened; another item's focus never moves;
//      an unrelated lifecycle step never slides a focus; an item already MIXED moves nothing; a replay and an
//      ALREADY_UNDER_REVIEW answer repair a qualifying stale focus and nothing else; the migration's own forward
//      reconciliation (executed from its text) repairs exactly the qualifying rows; U-3 — a direct exact-owned
//      disagreement needs no open discussion;
//   3. U-2 contest lifecycle (rolled back): only UNDER_REVIEW → RESOLVED; original facts immutable; the explicit
//      resolution records version / time / server-owned reason / command once, changes no Hypothesis and creates no
//      Confidence; replay, command conflict, stale, NOT_UNDER_REVIEW, NOT_FOUND; at most one contest under review; a
//      later disagreement creates a NEW contest and never reopens the old one;
//   4. withdrawal (rolled back): REJECTED and RETIRED resolve as INTERPRETATION_WITHDRAWN with no command identity;
//      SUPPORTED, WEAK, ACTIVE, MIXED and REOPENED resolve nothing; a later REOPENED never mutates a resolved contest;
//   5. the combined 10-hypothesis proof (rolled back): real rows read under the reader's RLS and handed to the REAL
//      compiled HypothesisReasoningContextService (apps/api/dist, built earlier in the same CI job) — the focused item
//      first before and after the disagreement, carrying both markers after it; another contest promoted ahead of
//      ordinary items inside the bound of 8; resolving removes only userContest; closing removes only userDiscussion;
//   6. isolation and privileges (rolled back): another reader, anon and an unauthenticated caller;
//   7. races on committed state across two connections, each second attempt shown to block: disagreement vs close
//      (both orders), disagreement vs a new discussion selection (both orders), two disagreement replays, two
//      resolutions (different and same command), resolution vs withdrawal (both orders). Fixtures are removed and the
//      removal is checked.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = join(root, 'database/migrations/0134_understanding_integrity_v1.sql');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}`);
  return refusal;
}

async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : '{}']);
}

async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}

const record = async (commandId, hypothesisId, version, on = client) =>
  (await rows('SELECT outcome, contested_version, reevaluated_version FROM public.record_understanding_disagreement_v1($1, $2, $3)', [commandId, hypothesisId, version], on))[0];
const resolve = async (commandId, hypothesisId, version, on = client) =>
  (await rows('SELECT outcome, resolved_version FROM public.resolve_understanding_disagreement_v1($1, $2, $3)', [commandId, hypothesisId, version], on))[0];
const open = async (hypothesisId, version, on = client) =>
  (await rows('SELECT public.open_understanding_discussion_v1($1, $2) AS answer', [hypothesisId, version], on))[0].answer;
const close = async (hypothesisId, on = client) =>
  (await rows('SELECT public.close_understanding_discussion_v1($1) AS answer', [hypothesisId], on))[0].answer;
/** Owner-side reads (run as the table owner). */
const focusOf = async (userId, on = client) =>
  (await rows('SELECT hypothesis_id, hypothesis_version, opened_at, closed_at FROM public.understanding_discussion_focus WHERE user_id = $1', [userId], on))[0] ?? null;
const itemOf = async (id, on = client) => (await rows('SELECT status, version, statement FROM public.hypotheses WHERE id = $1', [id], on))[0];
const contestsOn = async (id, on = client) => rows(`SELECT id, command_id, contested_version, lifecycle, reevaluation_before_status, reevaluation_after_version,
    confidence_evaluation_id, created_at, resolved_at, resolved_version, resolution_reason, resolution_command_id
  FROM public.understanding_contests WHERE hypothesis_id = $1 ORDER BY created_at, id`, [id], on);
const auditCount = async (id, on = client) => Number((await rows('SELECT count(*)::int AS n FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1', [id], on))[0].n);
const confidenceCount = async (userId, on = client) => Number((await rows('SELECT count(*)::int AS n FROM public.confidence_evaluations WHERE user_id = $1', [userId], on))[0].n);

/** An owned Hypothesis moved along `path` only through the canonical lifecycle core. Returns its id and version. */
async function hypothesisAlong(userId, path, { id = randomUUID(), on = client } = {}) {
  await on.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, assumptions)
     VALUES ($1, $2, $3, 'BEHAVIORAL', 'WORK', 'verifier scope', 'SYSTEM_GENERATED', ARRAY['Deadlines matter to you.'])`,
    [id, userId, `You prepare early for deadlines (${id.slice(-4)}).`],
  );
  let version = 1;
  for (const next of path) {
    await on.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, id, version, next, 'AUTHENTICATED_TRANSITION']);
    version += 1;
  }
  return { id, version };
}
/** One more lawful lifecycle step through the core, as the owner. */
async function step(userId, item, status, on = client) {
  await on.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, item.id, item.version, status, 'AUTHENTICATED_TRANSITION']);
  item.version += 1;
  return item;
}
async function reader(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}

// ------------------------------------------------------------------------------------------------------------------
// 1. Catalog.
// ------------------------------------------------------------------------------------------------------------------
async function verifyCatalog() {
  stage = 'catalog: the resolution facts and the lifecycle rules';
  const columns = Object.fromEntries((await rows(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'understanding_contests'`)).map((c) => [c.column_name, c]));
  for (const [name, type] of [['resolved_at', 'timestamp with time zone'], ['resolved_version', 'integer'], ['resolution_reason', 'text'], ['resolution_command_id', 'uuid']]) {
    assert.deepEqual([columns[name]?.data_type, columns[name]?.is_nullable], [type, 'YES'], `${name} is a nullable ${type}`);
  }
  for (const name of ['id', 'user_id', 'hypothesis_id', 'command_id', 'contested_version', 'lifecycle', 'created_at', 'confidence_evaluation_id']) {
    assert.equal(columns[name]?.is_nullable, 'NO', `0127's ${name} is still required`);
  }
  const constraints = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.understanding_contests'::regclass`)).map((c) => [c.conname, c.def]));
  assert.match(constraints.understanding_contests_lifecycle_check, /'UNDER_REVIEW'.*'RESOLVED'/u);
  assert.doesNotMatch(constraints.understanding_contests_lifecycle_check, /CLEARED|CLOSED|REOPENED/u);
  assert.match(constraints.understanding_contests_resolution_check, /USER_CONFIRMED_CURRENT_INTERPRETATION/u);
  assert.match(constraints.understanding_contests_resolution_check, /INTERPRETATION_WITHDRAWN/u);
  assert.match(constraints.understanding_contests_resolution_command_key, /UNIQUE \(user_id, resolution_command_id\)/u);
  assert.match(constraints.understanding_contests_command_key, /UNIQUE \(user_id, command_id\)/u, '0127 command key kept');
  const [index] = await rows("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'understanding_contests_one_under_review_idx'");
  assert.match(index.indexdef, /CREATE UNIQUE INDEX .* \(user_id, hypothesis_id\) WHERE \(lifecycle = 'UNDER_REVIEW'::text\)/u, 'one under review, any number resolved');

  stage = 'catalog: the two triggers';
  const triggers = await rows(`SELECT t.tgname, c.relname, n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE t.tgname IN ('understanding_contests_lifecycle_forward_only', 'hypothesis_lifecycle_transitions_withdraw_understanding_contest') AND NOT t.tgisinternal
     ORDER BY t.tgname`);
  assert.deepEqual(triggers.map((tr) => [tr.tgname, tr.relname, `${tr.schema}.${tr.proname}`, tr.prosecdef]), [
    ['hypothesis_lifecycle_transitions_withdraw_understanding_contest', 'hypothesis_lifecycle_transitions', 'understanding_private.resolve_withdrawn_understanding_contest_v1', true],
    ['understanding_contests_lifecycle_forward_only', 'understanding_contests', 'understanding_private.understanding_contest_lifecycle_forward_only_v1', false],
  ]);
  assert.match(triggers[0].def, /AFTER INSERT ON public\.hypothesis_lifecycle_transitions FOR EACH ROW WHEN \(.*after_status.*'REJECTED'.*'RETIRED'.*\)/u);
  assert.doesNotMatch(triggers[0].def, /SUPPORTED|ACTIVE|MIXED|WEAK|REOPENED/u, 'no other status resolves a contest');
  assert.match(triggers[1].def, /BEFORE UPDATE ON public\.understanding_contests FOR EACH ROW/u);
  for (const tr of triggers) assert.deepEqual(tr.proconfig, ['search_path=""']);
  const [{ hypothesesTriggers }] = await rows(`SELECT count(*)::int AS "hypothesesTriggers" FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.hypotheses'::regclass AND NOT t.tgisinternal AND p.proname ~ 'understanding'`);
  assert.equal(hypothesesTriggers, 0, 'no read or write of the Hypothesis row itself is intercepted');

  stage = 'catalog: the command boundary and every grant';
  const fns = await rows(`SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname IN ('resolve_understanding_disagreement_v1', 'record_understanding_disagreement_v1') ORDER BY 2, 1`);
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname}(${f.args}) ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`), [
    'public.record_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) INVOKER',
    'understanding_private.record_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) DEFINER',
    'public.resolve_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) INVOKER',
    'understanding_private.resolve_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) DEFINER',
  ], 'no caller identity or reason parameter; every DEFINER is private');
  for (const fn of fns) assert.deepEqual(fn.proconfig, ['search_path=""']);
  const [{ exposedDefiners }] = await rows(`SELECT count(*)::int AS "exposedDefiners" FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'graphql_public') AND p.prosecdef AND p.proname ~ 'understanding'`);
  assert.equal(exposedDefiners, 0, 'no Understanding SECURITY DEFINER function in an exposed schema');
  const can = async (role, fn) => (await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, fn]))[0].allowed;
  for (const fn of ['public.resolve_understanding_disagreement_v1(uuid, uuid, integer)', 'understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer)',
    'public.record_understanding_disagreement_v1(uuid, uuid, integer)', 'understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer)']) {
    assert.equal(await can('authenticated', fn), true, fn);
    for (const role of ['anon', 'public', 'service_role']) assert.equal(await can(role, fn), false, `${role} EXECUTE ${fn}`);
  }
  for (const fn of ['understanding_private.understanding_contest_lifecycle_forward_only_v1()', 'understanding_private.resolve_withdrawn_understanding_contest_v1()']) {
    for (const role of ['anon', 'authenticated', 'public', 'service_role']) assert.equal(await can(role, fn), false, `${role} EXECUTE ${fn}`);
  }
  for (const table of ['understanding_contests', 'understanding_discussion_focus']) {
    const grants = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = $1 AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC') ORDER BY 1, 2`, [table]);
    assert.deepEqual(grants, [{ grantee: 'authenticated', privilege_type: 'SELECT' }], `no client role may write ${table}`);
  }
}

// ------------------------------------------------------------------------------------------------------------------
// 2. U-1 focus continuity and U-3.
// ------------------------------------------------------------------------------------------------------------------
async function verifyFocusContinuity() {
  stage = 'U-1 fixtures';
  const me = await reader();
  const other = await reader();
  const item = await hypothesisAlong(me, ['ACTIVE']);
  const closedItem = await hypothesisAlong(me, ['ACTIVE']);
  const elsewhere = await hypothesisAlong(me, ['ACTIVE']);
  const contestedElsewhere = await hypothesisAlong(me, ['ACTIVE']);
  const sliding = await hypothesisAlong(me, ['ACTIVE']);
  const mixed = await hypothesisAlong(me, ['ACTIVE', 'MIXED']);
  const theirs = await hypothesisAlong(other, ['ACTIVE']);

  stage = 'U-1: the open focus follows the re-evaluation step, in the same transaction, with opened_at unchanged';
  await actAs('authenticated', me);
  assert.equal(await open(item.id, item.version), 'OPENED');
  await asOwner();
  const before = await focusOf(me);
  await actAs('authenticated', me);
  const cmd = randomUUID();
  assert.deepEqual(await record(cmd, item.id, item.version), { outcome: 'RECORDED', contested_version: item.version, reevaluated_version: item.version + 1 });
  await asOwner();
  assert.equal((await contestsOn(item.id))[0].lifecycle, 'UNDER_REVIEW');
  let focus = await focusOf(me);
  assert.deepEqual([focus.hypothesis_id, focus.hypothesis_version, focus.closed_at], [item.id, item.version + 1, null], 'the focus names the re-evaluated version');
  assert.equal(focus.opened_at.getTime(), before.opened_at.getTime(), 'opened_at — and so the bounded window — is preserved');
  item.version += 1;

  stage = 'U-1: a closed focus is never reopened';
  await actAs('authenticated', me);
  assert.equal(await open(closedItem.id, closedItem.version), 'OPENED');
  assert.equal(await close(closedItem.id), 'CLOSED');
  await asOwner();
  const closedBefore = await focusOf(me);
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), closedItem.id, closedItem.version)).outcome, 'RECORDED');
  await asOwner();
  assert.deepEqual(await focusOf(me), closedBefore, 'closed, unmoved, untouched');

  stage = 'U-1: another item’s focus never moves, and an unrelated lifecycle step never slides a focus';
  await actAs('authenticated', me);
  assert.equal(await open(elsewhere.id, elsewhere.version), 'OPENED');
  await asOwner();
  const elsewhereBefore = await focusOf(me);
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), contestedElsewhere.id, contestedElsewhere.version)).outcome, 'RECORDED');
  await asOwner();
  assert.deepEqual(await focusOf(me), elsewhereBefore, 'a disagreement on another item moves nothing');
  await step(me, elsewhere, 'SUPPORTED');
  assert.deepEqual(await focusOf(me), elsewhereBefore, 'an ordinary lifecycle step on the focused item slides nothing');
  await actAs('authenticated', me);
  assert.equal(await open(sliding.id, sliding.version), 'OPENED');
  await asOwner();
  await step(me, sliding, 'WEAK');
  assert.equal((await focusOf(me)).hypothesis_version, sliding.version - 1, 'never slid onto the newer version');

  stage = 'U-1: an item already MIXED makes no version step, so the focus does not move';
  await actAs('authenticated', me);
  assert.equal(await open(mixed.id, mixed.version), 'OPENED');
  assert.deepEqual(await record(randomUUID(), mixed.id, mixed.version), { outcome: 'RECORDED', contested_version: mixed.version, reevaluated_version: mixed.version });
  await asOwner();
  assert.equal((await focusOf(me)).hypothesis_version, mixed.version);

  stage = 'U-1: a replay and an ALREADY_UNDER_REVIEW answer repair a qualifying stale focus — and nothing else';
  // A pre-0134 state: the reader's open focus still names the contested version of a contested item.
  const stale = async () => {
    await asOwner();
    await client.query('UPDATE public.understanding_discussion_focus SET hypothesis_id = $2, hypothesis_version = $3, closed_at = NULL WHERE user_id = $1',
      [me, item.id, item.version - 1]);
  };
  await actAs('authenticated', other);
  assert.equal(await open(theirs.id, theirs.version), 'OPENED');
  await asOwner();
  const theirsBefore = await focusOf(other);
  await stale();
  const staleOpenedAt = (await focusOf(me)).opened_at.getTime();
  await actAs('authenticated', me);
  assert.equal((await record(cmd, item.id, item.version - 1)).outcome, 'RECORDED', 'the replay');
  await asOwner();
  focus = await focusOf(me);
  assert.deepEqual([focus.hypothesis_version, focus.opened_at.getTime()], [item.version, staleOpenedAt], 'repaired, opened_at kept');
  await stale();
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'ALREADY_UNDER_REVIEW');
  await asOwner();
  assert.equal((await focusOf(me)).hypothesis_version, item.version, 'ALREADY_UNDER_REVIEW repairs it too');
  assert.deepEqual(await focusOf(other), theirsBefore, 'another reader’s focus is never touched');
  // A CLOSED stale focus is not repaired, and an item that moved past the after-version is not a qualifying fact.
  await stale();
  await client.query('UPDATE public.understanding_discussion_focus SET closed_at = clock_timestamp() WHERE user_id = $1', [me]);
  const closedStale = await focusOf(me);
  await actAs('authenticated', me);
  assert.equal((await record(cmd, item.id, item.version - 1)).outcome, 'RECORDED');
  await asOwner();
  assert.deepEqual(await focusOf(me), closedStale, 'a closed focus is never repaired or reopened');

  stage = 'U-1: the migration’s own forward reconciliation repairs exactly the qualifying rows';
  await stale();
  await client.query('UPDATE public.understanding_discussion_focus SET hypothesis_id = $2, hypothesis_version = $3 WHERE user_id = $1', [other, theirs.id, theirs.version]);
  const text = readFileSync(MIGRATION, 'utf8').replace(/\r\n/gu, '\n');
  const reconciliation = text.slice(text.indexOf('-- 6. Forward reconciliation'), text.indexOf('-- 7. Privileges'));
  assert.ok(reconciliation.includes('UPDATE public.understanding_discussion_focus f'), 'the reconciliation section was found');
  await client.query(reconciliation.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n'));
  assert.equal((await focusOf(me)).hypothesis_version, item.version, 'the qualifying stale focus is repaired');
  assert.equal((await focusOf(other)).hypothesis_version, theirs.version, 'a non-qualifying focus is untouched');
  assert.equal((await contestsOn(item.id))[0].lifecycle, 'UNDER_REVIEW', 'a contest on a current item is left under review');

  stage = 'U-3: a direct exact-owned disagreement needs no open discussion; owner and version checks hold';
  const direct = await hypothesisAlong(me, ['ACTIVE']);
  await client.query('DELETE FROM public.understanding_discussion_focus WHERE user_id = $1', [me]);
  await actAs('authenticated', me);
  assert.deepEqual(await record(randomUUID(), direct.id, direct.version), { outcome: 'RECORDED', contested_version: direct.version, reevaluated_version: direct.version + 1 });
  assert.equal((await record(randomUUID(), theirs.id, theirs.version)).outcome, 'NOT_FOUND', 'never another reader’s item');
  const staleItem = await (async () => { await asOwner(); return hypothesisAlong(me, ['ACTIVE', 'SUPPORTED']); })();
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), staleItem.id, staleItem.version - 1)).outcome, 'STALE', 'never a stale revision');
  await asOwner();
  assert.equal(await focusOf(me), null, 'and no focus was created by it');
}

// ------------------------------------------------------------------------------------------------------------------
// 3. U-2 contest lifecycle.
// ------------------------------------------------------------------------------------------------------------------
async function verifyLifecycle() {
  stage = 'U-2 fixtures';
  const me = await reader();
  const other = await reader();
  const item = await hypothesisAlong(me, ['ACTIVE', 'SUPPORTED']);
  const second = await hypothesisAlong(me, ['ACTIVE']);
  const quiet = await hypothesisAlong(me, ['ACTIVE']);
  const withdrawn = await hypothesisAlong(me, ['ACTIVE', 'REJECTED']);
  const theirs = await hypothesisAlong(other, ['ACTIVE']);
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'RECORDED');
  assert.equal((await record(randomUUID(), second.id, second.version)).outcome, 'RECORDED');
  item.version += 1;
  second.version += 1;
  await asOwner();
  const [original] = await contestsOn(item.id);
  const audits = await auditCount(item.id);
  const evaluations = await confidenceCount(me);
  const itemBefore = await itemOf(item.id);

  stage = 'U-2: the stale, not-found and not-under-review refusals write nothing';
  await actAs('authenticated', me);
  const cmd = randomUUID();
  assert.deepEqual(await resolve(randomUUID(), item.id, item.version - 1), { outcome: 'STALE', resolved_version: null });
  assert.deepEqual(await resolve(randomUUID(), quiet.id, quiet.version), { outcome: 'NOT_UNDER_REVIEW', resolved_version: null });
  assert.deepEqual(await resolve(randomUUID(), withdrawn.id, withdrawn.version), { outcome: 'NOT_FOUND', resolved_version: null });
  assert.deepEqual(await resolve(randomUUID(), theirs.id, theirs.version), { outcome: 'NOT_FOUND', resolved_version: null });
  assert.deepEqual(await resolve(randomUUID(), randomUUID(), 1), { outcome: 'NOT_FOUND', resolved_version: null });
  await rejected(() => resolve(randomUUID(), item.id, 0), ['22023']);
  await asOwner();
  assert.deepEqual(await contestsOn(item.id), [original], 'nothing was written');

  stage = 'U-2: the explicit resolution records version, time, the server-owned reason and the command, once';
  await actAs('authenticated', me);
  assert.deepEqual(await resolve(cmd, item.id, item.version), { outcome: 'RESOLVED', resolved_version: item.version });
  await asOwner();
  const [resolved] = await contestsOn(item.id);
  assert.deepEqual(
    [resolved.lifecycle, resolved.resolved_version, resolved.resolution_reason, resolved.resolution_command_id],
    ['RESOLVED', item.version, 'USER_CONFIRMED_CURRENT_INTERPRETATION', cmd]);
  assert.ok(resolved.resolved_at >= resolved.created_at, 'resolved after it was contested');
  for (const fact of ['id', 'command_id', 'contested_version', 'reevaluation_before_status', 'reevaluation_after_version', 'confidence_evaluation_id', 'created_at']) {
    assert.deepEqual(resolved[fact], original[fact], `the original fact ${fact} is unchanged`);
  }
  assert.deepEqual(await itemOf(item.id), itemBefore, 'the Hypothesis is not moved — never forced to SUPPORTED, never rewritten');
  assert.deepEqual([itemBefore.status, itemBefore.version], ['MIXED', item.version]);
  assert.equal(await auditCount(item.id), audits, 'no lifecycle step');
  assert.equal(await confidenceCount(me), evaluations, 'no Confidence created');

  stage = 'U-2: replay, conflict';
  await actAs('authenticated', me);
  assert.deepEqual(await resolve(cmd, item.id, item.version), { outcome: 'RESOLVED', resolved_version: item.version }, 'the same command replayed');
  assert.deepEqual(await resolve(cmd, second.id, second.version), { outcome: 'COMMAND_CONFLICT', resolved_version: null }, 'one identity, another item');
  assert.deepEqual(await resolve(cmd, item.id, item.version + 1), { outcome: 'COMMAND_CONFLICT', resolved_version: null }, 'one identity, another version');
  assert.deepEqual(await resolve(randomUUID(), item.id, item.version), { outcome: 'NOT_UNDER_REVIEW', resolved_version: null }, 'never resolved twice');
  await asOwner();
  assert.deepEqual(await contestsOn(item.id), [resolved], 'the replay changed nothing');
  assert.equal((await contestsOn(second.id))[0].lifecycle, 'UNDER_REVIEW', 'the conflicting call left the other contest open');

  stage = 'U-2: only UNDER_REVIEW → RESOLVED; a resolved row is final; the original facts are immutable';
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'UNDER_REVIEW', resolved_at = NULL, resolved_version = NULL, resolution_reason = NULL, resolution_command_id = NULL WHERE id = $1", [resolved.id]), ['55000']);
  await rejected(() => client.query("UPDATE public.understanding_contests SET resolution_reason = 'INTERPRETATION_WITHDRAWN', resolution_command_id = NULL WHERE id = $1", [resolved.id]), ['55000']);
  await rejected(() => client.query('UPDATE public.understanding_contests SET resolved_at = clock_timestamp() WHERE id = $1', [resolved.id]), ['55000']);
  const [open2] = await contestsOn(second.id);
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'CLEARED' WHERE id = $1", [open2.id]), ['23514']);
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'RESOLVED' WHERE id = $1", [open2.id]), ['23514']);
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'RESOLVED', resolved_at = clock_timestamp(), resolved_version = $2, resolution_reason = 'INTERPRETATION_WITHDRAWN', resolution_command_id = gen_random_uuid() WHERE id = $1", [open2.id, second.version]), ['23514']);
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'RESOLVED', resolved_at = clock_timestamp(), resolved_version = $2, resolution_reason = 'BECAUSE_CONFIDENT', resolution_command_id = NULL WHERE id = $1", [open2.id, second.version]), ['23514']);
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'RESOLVED', resolved_at = created_at - interval '1 second', resolved_version = $2, resolution_reason = 'INTERPRETATION_WITHDRAWN' WHERE id = $1", [open2.id, second.version]), ['23514']);
  await rejected(() => client.query('UPDATE public.understanding_contests SET resolved_at = clock_timestamp() WHERE id = $1', [open2.id]), ['23514']);
  for (const id of [resolved.id, open2.id]) {
    await rejected(() => client.query('UPDATE public.understanding_contests SET contested_version = contested_version + 1 WHERE id = $1', [id]), ['55000']);
    await rejected(() => client.query('UPDATE public.understanding_contests SET created_at = clock_timestamp() WHERE id = $1', [id]), ['55000']);
  }

  stage = 'U-2: at most one contest under review; a later disagreement is a NEW contest and never reopens the old one';
  await rejected(() => client.query(`INSERT INTO public.understanding_contests (id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
      reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, confidence_evaluation_id, created_at)
    VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, 'UNDER_REVIEW', 'MIXED', 'MIXED', $3, gen_random_uuid(), clock_timestamp())`, [me, second.id, second.version]), ['23505']);
  await actAs('authenticated', me);
  const again = randomUUID();
  assert.deepEqual(await record(again, item.id, item.version), { outcome: 'RECORDED', contested_version: item.version, reevaluated_version: item.version },
    'a new disagreement on the (still MIXED) item makes no synthetic version step');
  await asOwner();
  const history = await contestsOn(item.id);
  assert.equal(history.length, 2, 'two rows: the old resolved one and the new one');
  assert.deepEqual(history[0], resolved, 'the old contest is unchanged history');
  assert.deepEqual([history[1].command_id, history[1].lifecycle, history[1].resolved_at], [again, 'UNDER_REVIEW', null]);
  assert.notEqual(history[1].confidence_evaluation_id, resolved.confidence_evaluation_id, 'its own evaluation identity');
  await actAs('authenticated', me);
  assert.deepEqual(await resolve(randomUUID(), item.id, item.version), { outcome: 'RESOLVED', resolved_version: item.version }, 'and it can be resolved in its turn');
  await asOwner();
  assert.equal((await contestsOn(item.id)).filter((row) => row.lifecycle === 'RESOLVED').length, 2, 'any number of resolved contests');
}

// ------------------------------------------------------------------------------------------------------------------
// 4. Withdrawal.
// ------------------------------------------------------------------------------------------------------------------
async function verifyWithdrawal() {
  stage = 'withdrawal fixtures';
  const me = await reader();
  const contested = async (path = ['ACTIVE']) => {
    await asOwner();
    const item = await hypothesisAlong(me, path);
    await actAs('authenticated', me);
    assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'RECORDED');
    await asOwner();
    if (!path.includes('MIXED')) item.version += 1;
    return item;
  };

  stage = 'withdrawal: REJECTED and RETIRED resolve once as INTERPRETATION_WITHDRAWN, never attributed to the reader';
  for (const status of ['REJECTED', 'RETIRED']) {
    const item = await contested();
    await step(me, item, status);
    const [row] = await contestsOn(item.id);
    assert.deepEqual([row.lifecycle, row.resolution_reason, row.resolved_version, row.resolution_command_id],
      ['RESOLVED', 'INTERPRETATION_WITHDRAWN', item.version, null], `${status} withdraws the interpretation`);
    // A later REOPENED never mutates the resolved contest; reconsidering it never revives the old contest.
    await step(me, item, 'REOPENED');
    await step(me, item, 'ACTIVE');
    assert.deepEqual(await contestsOn(item.id), [row], `${status}: the resolved contest is untouched by REOPENED → ACTIVE`);
    // The reader may disagree again: a NEW contest.
    await actAs('authenticated', me);
    assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'RECORDED');
    await asOwner();
    assert.deepEqual((await contestsOn(item.id)).map((c) => c.lifecycle), ['RESOLVED', 'UNDER_REVIEW']);
  }

  stage = 'withdrawal: SUPPORTED, WEAK, ACTIVE and MIXED never resolve a reader’s contest — system confidence cannot overrule it';
  const item = await contested();
  for (const status of ['SUPPORTED', 'WEAK', 'ACTIVE', 'MIXED']) {
    await step(me, item, status);
    assert.deepEqual((await contestsOn(item.id)).map((c) => [c.lifecycle, c.resolved_at]), [['UNDER_REVIEW', null]], `${status} resolves nothing`);
  }

  stage = 'withdrawal: REOPENED resolves nothing either';
  const parked = await hypothesisAlong(me, ['ACTIVE', 'REJECTED']);
  // Only constructible as the owner: a contest left under review on a withdrawn item (the pre-0134 shape §6a repairs).
  await client.query(`INSERT INTO public.understanding_contests (id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
      reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, confidence_evaluation_id, created_at)
    VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), 2, 'UNDER_REVIEW', 'MIXED', 'MIXED', 2, gen_random_uuid(), clock_timestamp())`, [me, parked.id]);
  await step(me, parked, 'REOPENED');
  assert.deepEqual((await contestsOn(parked.id)).map((c) => c.lifecycle), ['UNDER_REVIEW'], 'REOPENED resolves nothing');
  // The forward reconciliation (§6a, executed from the migration text) is idempotent on resolved rows and resolves only
  // a contest whose item was withdrawn after it, at that withdrawal's own version.
  const text = readFileSync(MIGRATION, 'utf8').replace(/\r\n/gu, '\n');
  const reconciliation = text.slice(text.indexOf('-- 6. Forward reconciliation'), text.indexOf('-- 7. Privileges'));
  const resolvedBefore = (await rows("SELECT id, resolved_at FROM public.understanding_contests WHERE user_id = $1 AND lifecycle = 'RESOLVED' ORDER BY id", [me]));
  await client.query(reconciliation.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n'));
  assert.deepEqual(await rows("SELECT id, resolved_at FROM public.understanding_contests WHERE user_id = $1 AND lifecycle = 'RESOLVED' AND id = ANY($2::uuid[]) ORDER BY id", [me, resolvedBefore.map((r) => r.id)]), resolvedBefore,
    'a resolved row is never rewritten by the reconciliation');
  assert.deepEqual((await contestsOn(item.id)).map((c) => c.lifecycle), ['UNDER_REVIEW'], 'a contest on a current item is left open');
  // The parked contest's item was withdrawn at version 3, but its contest names after-version 2 → it qualifies.
  const [parkedRow] = await contestsOn(parked.id);
  assert.deepEqual([parkedRow.lifecycle, parkedRow.resolution_reason, parkedRow.resolved_version], ['RESOLVED', 'INTERPRETATION_WITHDRAWN', 3]);
}

// ------------------------------------------------------------------------------------------------------------------
// 5. The combined 10-hypothesis proof through the REAL compiled provider-context selection.
// ------------------------------------------------------------------------------------------------------------------
function compiledReasoningContext() {
  const path = join(root, 'apps/api/dist/hypothesis/hypothesis-reasoning-context.service.js');
  // API CI builds apps/api/dist before the database steps; the focused gate installs but does not build, so build here.
  if (!existsSync(path)) execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:api'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  if (!existsSync(path)) throw new Error('apps/api/dist could not be built: npm run build:api');
  const require = createRequire(import.meta.url);
  try { require('reflect-metadata'); } catch { /* the compiled decorators tolerate its absence */ }
  return require(path).HypothesisReasoningContextService;
}

async function verifyCombinedProviderContext() {
  stage = 'combined: ten owned hypotheses whose repository order puts i and j past slot 8';
  const Service = compiledReasoningContext();
  const me = await reader();
  // One transaction, so every updated_at is equal and the repository order (updated_at DESC, id ASC) is the id order.
  const ids = Object.fromEntries('abcdefghij'.split('').map((key, index) => [key, `00000000-0000-4000-8000-0000000000${(index + 16).toString(16)}`]));
  const items = {};
  for (const key of Object.keys(ids)) items[key] = await hypothesisAlong(me, ['ACTIVE'], { id: ids[key] });

  // The reader's own data, read under their RLS exactly as the API's repositories select it.
  const ACTIVE = ['CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REOPENED'];
  const service = new Service(
    { listActiveForUser: async (userId) => rows(`SELECT id, user_id, statement, type, domain, scope, origin, status, version, supporting_evidence_ids,
        contradicting_evidence_ids, competing_hypothesis_ids, assumptions, disconfirming_conditions
        FROM public.hypotheses WHERE user_id = $1 AND status = ANY($2::text[]) ORDER BY updated_at DESC, id ASC LIMIT 32`, [userId, ACTIVE]) },
    { listEligibleForUser: async () => [] },
    { listExactVersionsForTargets: async () => [] },
    {
      readOpenDiscussionFocus: async (_token, userId) => (await rows(`SELECT hypothesis_id, hypothesis_version, to_json(opened_at) #>> '{}' AS opened_at
        FROM public.understanding_discussion_focus WHERE user_id = $1 AND closed_at IS NULL LIMIT 1`, [userId]))[0] ?? null,
      listUnderReview: async (_token, userId, hypothesisIds) => new Set((await rows(`SELECT hypothesis_id FROM public.understanding_contests
        WHERE user_id = $1 AND lifecycle = 'UNDER_REVIEW' AND hypothesis_id = ANY($2::uuid[])`, [userId, hypothesisIds])).map((row) => row.hypothesis_id)),
    },
  );
  const build = async () => {
    await actAs('authenticated', me);
    const result = await service.build(me, 'token');
    assert.equal(result.coverageState, 'AVAILABLE');
    return result.context;
  };
  // Statements end with "(xxxx)." — mapped back to their key through the id suffix; the context carries no id.
  const statementKey = Object.fromEntries(Object.entries(ids).map(([key, id]) => [`(${id.slice(-4)}).`, key]));
  const keys = (context) => context.hypotheses.map((h) => [statementKey[h.statement.slice(-7)], h.hypothesisVersion, h.userDiscussion ?? '-', h.userContest ?? '-']);

  stage = 'combined: before — i was disagreed with earlier; the reader opens j from Understanding';
  await actAs('authenticated', me);
  assert.equal((await record(randomUUID(), items.i.id, items.i.version)).outcome, 'RECORDED');
  assert.equal(await open(items.j.id, items.j.version), 'OPENED');
  let context = await build();
  assert.deepEqual(keys(context), [
    ['j', 2, 'OPENED_FROM_UNDERSTANDING', '-'], ['i', 3, '-', 'UNDER_REVIEW'],
    ['a', 2, '-', '-'], ['b', 2, '-', '-'], ['c', 2, '-', '-'], ['d', 2, '-', '-'], ['e', 2, '-', '-'], ['f', 2, '-', '-'],
  ]);
  assert.deepEqual([context.candidateHypothesisCount, context.includedHypothesisCount, context.truncated], [10, 8, true], 'the hard bound of 8 holds');

  stage = 'combined: the reader disagrees with j — j moves to a new version, the focus is re-bound atomically, j stays first';
  assert.deepEqual(await record(randomUUID(), items.j.id, items.j.version), { outcome: 'RECORDED', contested_version: 2, reevaluated_version: 3 });
  await asOwner();
  assert.equal((await focusOf(me)).hypothesis_version, 3, 'the focus names j’s new version');
  context = await build();
  assert.deepEqual(keys(context), [
    ['j', 3, 'OPENED_FROM_UNDERSTANDING', 'UNDER_REVIEW'], ['i', 3, '-', 'UNDER_REVIEW'],
    ['a', 2, '-', '-'], ['b', 2, '-', '-'], ['c', 2, '-', '-'], ['d', 2, '-', '-'], ['e', 2, '-', '-'], ['f', 2, '-', '-'],
  ]);

  stage = 'combined: resolving j removes only userContest while the discussion stays open';
  await actAs('authenticated', me);
  assert.deepEqual(await resolve(randomUUID(), items.j.id, 3), { outcome: 'RESOLVED', resolved_version: 3 });
  context = await build();
  assert.deepEqual(keys(context).slice(0, 2), [['j', 3, 'OPENED_FROM_UNDERSTANDING', '-'], ['i', 3, '-', 'UNDER_REVIEW']]);

  stage = 'combined: closing the discussion removes only userDiscussion';
  await actAs('authenticated', me);
  assert.equal(await close(items.j.id), 'CLOSED');
  context = await build();
  assert.deepEqual(keys(context), [
    ['i', 3, '-', 'UNDER_REVIEW'], ['a', 2, '-', '-'], ['b', 2, '-', '-'], ['c', 2, '-', '-'], ['d', 2, '-', '-'], ['e', 2, '-', '-'],
    ['f', 2, '-', '-'], ['g', 2, '-', '-'],
  ]);
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------------------
// 6. Isolation and privileges.
// ------------------------------------------------------------------------------------------------------------------
async function verifyIsolationAndPrivileges() {
  stage = 'isolation fixtures';
  const me = await reader();
  const other = await reader();
  const item = await hypothesisAlong(me, ['ACTIVE']);
  await actAs('authenticated', me);
  assert.equal(await open(item.id, item.version), 'OPENED');
  assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'RECORDED');
  await asOwner();
  const mine = await contestsOn(item.id);
  const myFocus = await focusOf(me);

  stage = 'isolation: another reader can neither read nor mutate the contest, nor move the focus';
  await actAs('authenticated', other);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.understanding_contests'))[0].n, 0);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.understanding_discussion_focus'))[0].n, 0);
  assert.deepEqual(await resolve(randomUUID(), item.id, item.version + 1), { outcome: 'NOT_FOUND', resolved_version: null });
  assert.equal((await record(randomUUID(), item.id, item.version + 1)).outcome, 'NOT_FOUND');
  assert.equal(await open(item.id, item.version + 1), 'NOT_FOUND');
  assert.equal(await close(item.id), 'NONE');
  await asOwner();
  assert.deepEqual(await contestsOn(item.id), mine);
  assert.deepEqual(await focusOf(me), myFocus);

  stage = 'privileges: no direct write on either table for a client role; anon and an unauthenticated caller are refused';
  for (const role of ['authenticated', 'anon']) {
    await actAs(role, role === 'authenticated' ? me : null);
    for (const table of ['understanding_contests', 'understanding_discussion_focus']) {
      await rejected(() => client.query(`UPDATE public.${table} SET user_id = user_id`), ['42501']);
      await rejected(() => client.query(`DELETE FROM public.${table}`), ['42501']);
    }
  }
  await actAs('anon');
  await rejected(() => resolve(randomUUID(), item.id, item.version + 1), ['42501']);
  await rejected(() => record(randomUUID(), item.id, item.version + 1), ['42501']);
  await actAs('authenticated', null);
  await rejected(() => resolve(randomUUID(), item.id, item.version + 1), ['42501']);
  await actAs('authenticated', me);
  await rejected(() => client.query('SELECT understanding_private.resolve_withdrawn_understanding_contest_v1()'), ['42501', '0A000']);
  await asOwner();
  assert.deepEqual(await contestsOn(item.id), mine, 'nothing changed');
}

// ------------------------------------------------------------------------------------------------------------------
// 7. Races on committed state, across two connections.
// ------------------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

/** `first` runs and holds its transaction; `second` is shown to block on it; then both commit in order. */
async function race(userId, first, second) {
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one.query('BEGIN');
    await actAs('authenticated', userId, one);
    const a = await first(one);
    await two.query('BEGIN');
    await actAs('authenticated', userId, two);
    const pending = second(two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    const b = await pending;
    await two.query('COMMIT');
    return [a, b];
  } finally {
    await one.end();
    await two.end();
  }
}

/** Commit a fixture step as the owner, or as the reader. */
async function committed(work) {
  await client.query('BEGIN');
  try {
    const value = await work();
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function verifyRaces() {
  const me = randomUUID();
  try {
    stage = 'races: committed fixtures';
    const items = await committed(async () => {
      await client.query('INSERT INTO auth.users (id) VALUES ($1)', [me]);
      const made = {};
      for (const key of ['closeAfter', 'closeFirst', 'moveAfter', 'moveFirst', 'target', 'replay', 'resolveTwice', 'resolveSame', 'resolveFirst', 'withdrawFirst']) {
        made[key] = await hypothesisAlong(me, ['ACTIVE']);
      }
      return made;
    });
    const openNow = (item) => committed(async () => { await actAs('authenticated', me); assert.equal(await open(item.id, item.version), 'OPENED'); await asOwner(); });
    const contestNow = (item) => committed(async () => {
      await actAs('authenticated', me);
      assert.equal((await record(randomUUID(), item.id, item.version)).outcome, 'RECORDED');
      await asOwner();
      item.version += 1;
    });

    stage = 'races: disagreement first, close second — the close waits, then closes the re-bound focus; never reopened';
    await openNow(items.closeAfter);
    const [d1, c1] = await race(me, (on) => record(randomUUID(), items.closeAfter.id, items.closeAfter.version, on), (on) => close(items.closeAfter.id, on));
    assert.deepEqual([d1.outcome, c1], ['RECORDED', 'CLOSED']);
    let focus = await focusOf(me);
    assert.deepEqual([focus.hypothesis_id, focus.hypothesis_version, focus.closed_at !== null], [items.closeAfter.id, items.closeAfter.version + 1, true]);

    stage = 'races: close first, disagreement second — the disagreement waits and does not reopen or move the closed focus';
    await openNow(items.closeFirst);
    const [c2, d2] = await race(me, (on) => close(items.closeFirst.id, on), (on) => record(randomUUID(), items.closeFirst.id, items.closeFirst.version, on));
    assert.deepEqual([c2, d2.outcome], ['CLOSED', 'RECORDED']);
    focus = await focusOf(me);
    assert.deepEqual([focus.hypothesis_id, focus.hypothesis_version, focus.closed_at !== null], [items.closeFirst.id, items.closeFirst.version, true]);

    stage = 'races: a new discussion selection first, the disagreement second — the newer selection is never stolen';
    await openNow(items.moveAfter);
    const [o3, d3] = await race(me, (on) => open(items.target.id, items.target.version, on), (on) => record(randomUUID(), items.moveAfter.id, items.moveAfter.version, on));
    assert.deepEqual([o3, d3.outcome], ['OPENED', 'RECORDED']);
    focus = await focusOf(me);
    assert.deepEqual([focus.hypothesis_id, focus.hypothesis_version, focus.closed_at], [items.target.id, items.target.version, null], 'the newer selection stands');

    stage = 'races: the disagreement first, a new selection second — the selection waits, then wins cleanly';
    await openNow(items.moveFirst);
    const [d4, o4] = await race(me, (on) => record(randomUUID(), items.moveFirst.id, items.moveFirst.version, on), (on) => open(items.target.id, items.target.version, on));
    assert.deepEqual([d4.outcome, o4], ['RECORDED', 'OPENED']);
    focus = await focusOf(me);
    assert.deepEqual([focus.hypothesis_id, focus.hypothesis_version], [items.target.id, items.target.version]);

    stage = 'races: two replays of one disagreement converge — one contest, one version step, the focus re-bound once';
    await openNow(items.replay);
    const command = randomUUID();
    const [r1, r2] = await race(me, (on) => record(command, items.replay.id, items.replay.version, on), (on) => record(command, items.replay.id, items.replay.version, on));
    assert.deepEqual([r1.outcome, r2.outcome, r2.reevaluated_version], ['RECORDED', 'RECORDED', items.replay.version + 1]);
    assert.equal((await contestsOn(items.replay.id)).length, 1);
    assert.equal((await itemOf(items.replay.id)).version, items.replay.version + 1);
    assert.equal((await focusOf(me)).hypothesis_version, items.replay.version + 1);

    stage = 'races: two different resolutions — exactly one resolves, the other finds nothing under review';
    await contestNow(items.resolveTwice);
    const [s1, s2] = await race(me, (on) => resolve(randomUUID(), items.resolveTwice.id, items.resolveTwice.version, on), (on) => resolve(randomUUID(), items.resolveTwice.id, items.resolveTwice.version, on));
    assert.deepEqual([s1.outcome, s2.outcome], ['RESOLVED', 'NOT_UNDER_REVIEW']);
    assert.deepEqual((await contestsOn(items.resolveTwice.id)).map((c) => c.lifecycle), ['RESOLVED']);

    stage = 'races: the same resolution twice — resolved once, answered twice';
    await contestNow(items.resolveSame);
    const same = randomUUID();
    const [t1, t2] = await race(me, (on) => resolve(same, items.resolveSame.id, items.resolveSame.version, on), (on) => resolve(same, items.resolveSame.id, items.resolveSame.version, on));
    assert.deepEqual([t1.outcome, t2.outcome], ['RESOLVED', 'RESOLVED']);
    const [once] = await contestsOn(items.resolveSame.id);
    assert.deepEqual([once.lifecycle, once.resolution_command_id], ['RESOLVED', same]);

    stage = 'races: resolution first, withdrawal second — one set of facts: the reader’s';
    await contestNow(items.resolveFirst);
    const withdraw = (item) => (on) => rows('SELECT version FROM public.transition_hypothesis_v2($1, $2, $3)', [item.id, item.version, 'REJECTED'], on);
    const [u1, w1] = await race(me, (on) => resolve(randomUUID(), items.resolveFirst.id, items.resolveFirst.version, on), withdraw(items.resolveFirst));
    assert.deepEqual([u1.outcome, w1[0].version], ['RESOLVED', items.resolveFirst.version + 1]);
    const [first] = await contestsOn(items.resolveFirst.id);
    assert.deepEqual([first.resolution_reason, first.resolved_version], ['USER_CONFIRMED_CURRENT_INTERPRETATION', items.resolveFirst.version]);

    stage = 'races: withdrawal first, resolution second — one set of facts: the withdrawal’s; the resolution finds no current item';
    await contestNow(items.withdrawFirst);
    const [w2, u2] = await race(me, withdraw(items.withdrawFirst), (on) => resolve(randomUUID(), items.withdrawFirst.id, items.withdrawFirst.version, on));
    assert.deepEqual([w2[0].version, u2.outcome], [items.withdrawFirst.version + 1, 'NOT_FOUND']);
    const [second] = await contestsOn(items.withdrawFirst.id);
    assert.deepEqual([second.resolution_reason, second.resolved_version, second.resolution_command_id], ['INTERPRETATION_WITHDRAWN', items.withdrawFirst.version + 1, null]);
  } finally {
    stage = 'races: fixture removal';
    await removeCommittedReader(me);
  }
}

/**
 * Hypotheses and their history are append-only by design (0072), so committed fixtures are removed as the table owner
 * with triggers suspended for THIS session only, from every public table that names the reader.
 */
async function removeCommittedReader(userId) {
  await client.query('ROLLBACK');
  await client.query('BEGIN');
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = await rows(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`);
  for (const { table_name: table } of tables) await client.query(`DELETE FROM public.${table} WHERE user_id = $1`, [userId]);
  await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  await client.query('COMMIT');
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.hypotheses WHERE user_id = $1)
    + (SELECT count(*) FROM public.understanding_contests WHERE user_id = $1)
    + (SELECT count(*) FROM public.understanding_discussion_focus WHERE user_id = $1)
    + (SELECT count(*) FROM public.users WHERE id = $1) + (SELECT count(*) FROM auth.users WHERE id = $1) AS residue`, [userId]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyCatalog();
      await verifyFocusContinuity();
      await asOwner();
      await verifyLifecycle();
      await asOwner();
      await verifyWithdrawal();
      await asOwner();
      await verifyCombinedProviderContext();
      await asOwner();
      await verifyIsolationAndPrivileges();
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyRaces();
    console.log('Verified migration 0134 Understanding integrity: atomic focus continuity, forward-only UNDER_REVIEW → RESOLVED by explicit agreement or withdrawal only, history preserved, bounded provider priority on real rows, owner-only, serial under every race.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  else if (error instanceof Error && !error.code) console.error(error.message);
  process.exitCode = 1;
});
