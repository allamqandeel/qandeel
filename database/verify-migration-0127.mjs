// W3-MEGA-U U3 — QANDEEL Understanding: the real-PostgreSQL verifier for migration 0127 (explicit user disagreement →
// Contested / Under Review, E2E-D-15, PG-01).
//
// It proves, against a fully migrated database:
//   1. the catalog: the contest table, its owner-scoped foreign key, command key, row rules and the one-under-review
//      partial unique index; RLS with an owner-only SELECT policy and no client write; the command DEFINER in the
//      non-exposed `understanding_private`, its `public` INVOKER pass-through, empty search_path, `authenticated` only;
//   2. the command, inside ONE rolled-back transaction:
//        - RECORDED binds the contest to the exact version and performs the re-evaluation step through the audited
//          lifecycle core: ACTIVE / SUPPORTED / WEAK → MIXED at version + 1 with one AUTHENTICATED_TRANSITION audit row;
//          an item already MIXED keeps its version and gets no transition; statement, Evidence and assumptions are
//          untouched and the item is never deleted or withdrawn;
//        - the same command replayed answers the committed truth and mutates nothing;
//        - a second command on an item under review is ALREADY_UNDER_REVIEW and mutates nothing;
//        - a command id spent on another item is COMMAND_CONFLICT; a stale version is STALE; another reader's, a
//          withdrawn and a missing item are NOT_FOUND — each writing nothing;
//        - another reader sees no contest; direct writes, `anon` and an unauthenticated caller are refused;
//   3. concurrency on committed state, across two connections whose second attempt is shown to block: two different
//      commands on one item → exactly one RECORDED and one ALREADY_UNDER_REVIEW, one contest, one version step; the
//      same command twice → RECORDED twice, one contest. Its fixtures are removed and the removal is checked;
//   4. R2 — every contest owns ONE immutable confidence_evaluation_id, answered unchanged on replay, on
//      ALREADY_UNDER_REVIEW and to both sides of a race; ensuring the canonical Confidence evaluation under it converges
//      on exactly ONE row when two connections that both saw "none yet" create at once (the second blocks, then meets
//      the primary key and re-reads the same id), after a lost response, and after a transient failure; and Confidence
//      history otherwise keeps no (target, version) uniqueness.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
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
  (await rows('SELECT * FROM public.record_understanding_disagreement_v1($1, $2, $3)', [commandId, hypothesisId, version], on))[0];
const bare = ({ confidence_evaluation_id: _id, ...answer }) => answer;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const itemOf = async (id) => (await rows('SELECT status, version, statement, supporting_evidence_ids, assumptions FROM public.hypotheses WHERE id = $1', [id]))[0];
const contestsOf = async (userId) => rows('SELECT hypothesis_id, command_id, contested_version, lifecycle, reevaluation_before_status, reevaluation_after_status, reevaluation_after_version FROM public.understanding_contests WHERE user_id = $1 ORDER BY created_at, id', [userId]);
const transitionsOf = async (id) => rows('SELECT before_status, after_status, before_version, after_version, source FROM public.hypothesis_lifecycle_transitions WHERE hypothesis_id = $1 ORDER BY created_at, id', [id]);

/** An owned Hypothesis moved along `path` only through the canonical lifecycle core. Returns its id and version. */
async function hypothesisAlong(userId, path, on = client) {
  const id = randomUUID();
  await on.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, assumptions)
     VALUES ($1, $2, 'You prepare early for deadlines.', 'BEHAVIORAL', 'WORK', 'verifier scope', 'SYSTEM_GENERATED', ARRAY['Deadlines matter to you.'])`,
    [id, userId],
  );
  let version = 1;
  for (const next of path) {
    await on.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, id, version, next, 'AUTHENTICATED_TRANSITION']);
    version += 1;
  }
  return { id, version };
}

async function verifyCatalog() {
  stage = 'catalog: the contest table and its rules';
  const columns = await rows(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'understanding_contests' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map((c) => c.column_name), [
    'id', 'user_id', 'hypothesis_id', 'command_id', 'contested_version', 'lifecycle',
    'reevaluation_before_status', 'reevaluation_after_status', 'reevaluation_after_version', 'confidence_evaluation_id', 'created_at',
  ], 'facts only: no conversation text, no reasoning, no score');
  assert.ok(columns.every((c) => c.is_nullable === 'NO'));
  const constraints = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.understanding_contests'::regclass`)).map((c) => [c.conname, c.def]));
  assert.match(constraints.understanding_contests_owner_fk, /FOREIGN KEY \(hypothesis_id, user_id\) REFERENCES hypotheses\(id, user_id\)/u);
  assert.match(constraints.understanding_contests_command_key, /UNIQUE \(user_id, command_id\)/u);
  assert.match(constraints.understanding_contests_lifecycle_check, /UNDER_REVIEW/u);
  assert.match(constraints.understanding_contests_confidence_evaluation_key, /UNIQUE \(confidence_evaluation_id\)/u, 'R2: one evaluation identity per contest');

  stage = 'catalog: R2 — contest facts are immutable, and Confidence history gains no global uniqueness';
  const triggers = await rows(`SELECT t.tgname, n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE t.tgrelid = 'public.understanding_contests'::regclass AND NOT t.tgisinternal`);
  assert.deepEqual(triggers.map((tr) => [tr.tgname, `${tr.schema}.${tr.proname}`, tr.prosecdef]),
    [['understanding_contests_facts_immutable', 'understanding_private.understanding_contest_facts_immutable_v1', false]]);
  assert.match(triggers[0].def, /BEFORE UPDATE ON public\.understanding_contests FOR EACH ROW/u);
  assert.deepEqual(triggers[0].proconfig, ['search_path=""']);
  const [{ confidenceUnique }] = await rows(`SELECT count(*)::int AS "confidenceUnique" FROM pg_index i
     WHERE i.indrelid = 'public.confidence_evaluations'::regclass AND i.indisunique
       AND (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'target_version') = ANY (i.indkey::int2[])`);
  assert.equal(confidenceUnique, 0, 'no (target, version) uniqueness was added to the immutable Confidence history');
  const [index] = await rows("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'understanding_contests_one_under_review_idx'");
  assert.match(index.indexdef, /CREATE UNIQUE INDEX .* \(user_id, hypothesis_id\) WHERE \(lifecycle = 'UNDER_REVIEW'::text\)/u);

  stage = 'catalog: row-level security and grants';
  const [{ rls }] = await rows("SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.understanding_contests'::regclass");
  assert.equal(rls, true);
  const policies = await rows("SELECT policyname, cmd, roles::text AS roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'understanding_contests'");
  assert.deepEqual(policies.map((p) => [p.policyname, p.cmd, p.roles]), [['understanding_contests_select_own', 'SELECT', '{authenticated}']]);
  const grants = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'understanding_contests' AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC') ORDER BY 1, 2`);
  assert.deepEqual(grants, [{ grantee: 'authenticated', privilege_type: 'SELECT' }], 'no client role may write a contest');

  stage = 'catalog: the command boundary';
  const fns = await rows(`SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'record_understanding_disagreement_v1' ORDER BY 1`);
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname}(${f.args}) ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`), [
    'public.record_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) INVOKER',
    'understanding_private.record_understanding_disagreement_v1(p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer) DEFINER',
  ], 'no caller identity parameter; the DEFINER is private');
  for (const fn of fns) assert.deepEqual(fn.proconfig, ['search_path=""']);
  const [{ exposedDefiners }] = await rows(`SELECT count(*)::int AS "exposedDefiners" FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'graphql_public') AND p.prosecdef AND p.proname ~ 'understanding'`);
  assert.equal(exposedDefiners, 0, 'no Understanding SECURITY DEFINER function in an exposed schema');
  const can = async (role, fn) => (await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, fn]))[0].allowed;
  for (const fn of ['public.record_understanding_disagreement_v1(uuid, uuid, integer)', 'understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer)']) {
    assert.equal(await can('authenticated', fn), true, fn);
    for (const role of ['anon', 'public', 'service_role']) assert.equal(await can(role, fn), false, `${role} EXECUTE ${fn}`);
  }
}

async function verifyCommand() {
  stage = 'fixtures: two readers and their items';
  const reader = randomUUID();
  const other = randomUUID();
  for (const id of [reader, other]) await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  const active = await hypothesisAlong(reader, ['ACTIVE']);
  const supported = await hypothesisAlong(reader, ['ACTIVE', 'SUPPORTED']);
  const mixed = await hypothesisAlong(reader, ['ACTIVE', 'MIXED']);
  const weak = await hypothesisAlong(reader, ['ACTIVE', 'WEAK']);
  const withdrawn = await hypothesisAlong(reader, ['ACTIVE', 'REJECTED']);
  const theirs = await hypothesisAlong(other, ['ACTIVE']);
  const before = await itemOf(active.id);
  const cmd1 = randomUUID();

  stage = 'command: RECORDED binds to the exact version and re-evaluates through the audited lifecycle core';
  await actAs('authenticated', reader);
  const firstAnswer = await record(cmd1, active.id, active.version);
  assert.deepEqual(bare(firstAnswer), { outcome: 'RECORDED', contested_version: active.version, reevaluated_version: active.version + 1 });
  assert.match(firstAnswer.confidence_evaluation_id, UUID, 'R2: the contest answers its one evaluation identity');
  const evaluationId = firstAnswer.confidence_evaluation_id;
  await asOwner();
  let item = await itemOf(active.id);
  assert.equal(item.status, 'MIXED');
  assert.equal(item.version, active.version + 1);
  assert.equal(item.statement, before.statement, 'the statement is never rewritten');
  assert.deepEqual(item.supporting_evidence_ids, before.supporting_evidence_ids);
  assert.deepEqual(item.assumptions, before.assumptions);
  const audit = (await transitionsOf(active.id)).at(-1);
  assert.deepEqual(audit, { before_status: 'ACTIVE', after_status: 'MIXED', before_version: active.version, after_version: active.version + 1, source: 'AUTHENTICATED_TRANSITION' });
  let contests = await contestsOf(reader);
  assert.equal(contests.length, 1);
  assert.deepEqual(contests[0], {
    hypothesis_id: active.id, command_id: cmd1, contested_version: active.version, lifecycle: 'UNDER_REVIEW',
    reevaluation_before_status: 'ACTIVE', reevaluation_after_status: 'MIXED', reevaluation_after_version: active.version + 1,
  });
  const auditCount = (await transitionsOf(active.id)).length;

  stage = 'command: the same command replayed answers the committed truth and mutates nothing';
  await actAs('authenticated', reader);
  assert.deepEqual(await record(cmd1, active.id, active.version), { outcome: 'RECORDED', contested_version: active.version, reevaluated_version: active.version + 1, confidence_evaluation_id: evaluationId },
    'R2: a replay answers the SAME evaluation identity, never a fresh one');
  stage = 'command: a second command on an item under review mutates nothing';
  for (const version of [active.version + 1, active.version]) {
    const again = await record(randomUUID(), active.id, version);
    assert.deepEqual([again.outcome, again.confidence_evaluation_id], ['ALREADY_UNDER_REVIEW', evaluationId], 'R2: the existing contest’s identity');
  }
  await asOwner();
  item = await itemOf(active.id);
  assert.equal(item.version, active.version + 1, 'never a second version step');
  assert.equal((await transitionsOf(active.id)).length, auditCount, 'never a second lifecycle audit');
  assert.equal((await contestsOf(reader)).length, 1, 'never a second contest');

  stage = 'command: a spent command id, a stale version, and items that are not the caller’s current ones';
  await actAs('authenticated', reader);
  assert.deepEqual(await record(cmd1, supported.id, supported.version), { outcome: 'COMMAND_CONFLICT', contested_version: null, reevaluated_version: null, confidence_evaluation_id: null });
  assert.deepEqual(await record(randomUUID(), supported.id, supported.version - 1), { outcome: 'STALE', contested_version: null, reevaluated_version: null, confidence_evaluation_id: null });
  assert.deepEqual(await record(randomUUID(), withdrawn.id, withdrawn.version), { outcome: 'NOT_FOUND', contested_version: null, reevaluated_version: null, confidence_evaluation_id: null });
  assert.equal((await record(randomUUID(), theirs.id, theirs.version)).outcome, 'NOT_FOUND');
  assert.equal((await record(randomUUID(), randomUUID(), 1)).outcome, 'NOT_FOUND');
  await rejected(() => record(randomUUID(), supported.id, 0), ['22023']);
  await asOwner();
  assert.equal((await itemOf(supported.id)).status, 'SUPPORTED', 'a refused disagreement changes nothing');
  assert.equal((await itemOf(withdrawn.id)).status, 'REJECTED');
  assert.equal((await itemOf(theirs.id)).status, 'ACTIVE');
  assert.equal((await contestsOf(reader)).length, 1);
  assert.equal((await contestsOf(other)).length, 0);

  stage = 'command: SUPPORTED and WEAK become MIXED; an item already MIXED keeps its version';
  await actAs('authenticated', reader);
  assert.deepEqual(bare(await record(randomUUID(), supported.id, supported.version)), { outcome: 'RECORDED', contested_version: supported.version, reevaluated_version: supported.version + 1 });
  assert.deepEqual(bare(await record(randomUUID(), weak.id, weak.version)), { outcome: 'RECORDED', contested_version: weak.version, reevaluated_version: weak.version + 1 });
  const mixedAudit = (await transitionsOf(mixed.id)).length;
  assert.deepEqual(bare(await record(randomUUID(), mixed.id, mixed.version)), { outcome: 'RECORDED', contested_version: mixed.version, reevaluated_version: mixed.version });
  await asOwner();
  assert.equal((await itemOf(supported.id)).status, 'MIXED');
  assert.equal((await itemOf(weak.id)).status, 'MIXED');
  assert.deepEqual([(await itemOf(mixed.id)).status, (await itemOf(mixed.id)).version], ['MIXED', mixed.version]);
  assert.equal((await transitionsOf(mixed.id)).length, mixedAudit, 'no transition for an item already MIXED');
  const identities = await rows('SELECT confidence_evaluation_id AS id FROM public.understanding_contests WHERE user_id = $1', [reader]);
  assert.equal(new Set(identities.map((row) => row.id)).size, identities.length, 'R2: every contest owns its own evaluation identity');
  assert.ok(identities.some((row) => row.id === evaluationId), 'the answered identity is the stored one');

  stage = 'R2: a contest’s facts — its evaluation identity above all — can never change';
  await rejected(() => client.query('UPDATE public.understanding_contests SET confidence_evaluation_id = gen_random_uuid() WHERE user_id = $1', [reader]), ['55000']);
  await rejected(() => client.query('UPDATE public.understanding_contests SET contested_version = contested_version + 1 WHERE user_id = $1', [reader]), ['55000']);
  const [{ present }] = await rows('SELECT count(*)::int AS present FROM public.hypotheses WHERE id = ANY($1::uuid[])', [[active.id, supported.id, weak.id, mixed.id]]);
  assert.equal(present, [active, supported, weak, mixed].length, 'a contested item is never deleted');

  stage = 'isolation: another reader, direct writes, anon, an unauthenticated caller';
  const owned = (await contestsOf(reader)).length;
  await actAs('authenticated', other);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.understanding_contests'))[0].n, 0, 'another reader sees no contest');
  await actAs('authenticated', reader);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.understanding_contests'))[0].n, owned, 'the reader sees exactly their own');
  await rejected(() => client.query("UPDATE public.understanding_contests SET lifecycle = 'UNDER_REVIEW'"), ['42501']);
  await rejected(() => client.query('DELETE FROM public.understanding_contests'), ['42501']);
  await rejected(() => client.query(`INSERT INTO public.understanding_contests (id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
    reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, created_at)
    VALUES ($1, $2, $3, $4, 2, 'UNDER_REVIEW', 'ACTIVE', 'MIXED', 3, clock_timestamp())`, [randomUUID(), reader, theirs.id, randomUUID()]), ['42501']);
  await actAs('anon');
  await rejected(() => record(randomUUID(), supported.id, 2), ['42501']);
  await actAs('authenticated', null);
  await rejected(() => record(randomUUID(), supported.id, 2), ['42501']);
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------
// Concurrency on committed state, across two connections.
// ------------------------------------------------------------------------------------------------------

async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second attempt never blocked on the first');
}

async function race(userId, firstCall, secondCall) {
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one.query('BEGIN');
    await actAs('authenticated', userId, one);
    const a = await record(...firstCall, one);
    await two.query('BEGIN');
    await actAs('authenticated', userId, two);
    const pending = record(...secondCall, two);
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

async function verifyConcurrency() {
  const reader = randomUUID();
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users (id) VALUES ($1)', [reader]);
    const first = await hypothesisAlong(reader, ['ACTIVE']);
    const second = await hypothesisAlong(reader, ['ACTIVE']);
    const third = await hypothesisAlong(reader, ['ACTIVE']);
    const fourth = await hypothesisAlong(reader, ['ACTIVE']);
    await client.query('COMMIT');

    stage = 'concurrency: two different commands on one item — exactly one records, one version step';
    const [x, y] = await race(reader, [randomUUID(), first.id, first.version], [randomUUID(), first.id, first.version]);
    assert.deepEqual([x.outcome, y.outcome], ['RECORDED', 'ALREADY_UNDER_REVIEW']);
    assert.equal(y.confidence_evaluation_id, x.confidence_evaluation_id, 'R2: the loser is told the winner’s evaluation identity');
    assert.equal((await itemOf(first.id)).version, first.version + 1);
    assert.equal((await contestsOf(reader)).filter((c) => c.hypothesis_id === first.id).length, 1);

    stage = 'concurrency: the same command twice — one contest, answered twice';
    const command = randomUUID();
    const [p, q] = await race(reader, [command, second.id, second.version], [command, second.id, second.version]);
    assert.deepEqual([p.outcome, q.outcome, q.reevaluated_version], ['RECORDED', 'RECORDED', second.version + 1]);
    assert.equal(q.confidence_evaluation_id, p.confidence_evaluation_id, 'R2: one command, one evaluation identity, however often it is answered');
    assert.equal((await itemOf(second.id)).version, second.version + 1);
    assert.equal((await contestsOf(reader)).filter((c) => c.hypothesis_id === second.id).length, 1);

    stage = 'concurrency: one command id on two items at once — one records, the other is COMMAND_CONFLICT and undone';
    const shared = randomUUID();
    const [r, s] = await race(reader, [shared, third.id, third.version], [shared, fourth.id, fourth.version]);
    assert.deepEqual([r.outcome, s.outcome], ['RECORDED', 'COMMAND_CONFLICT']);
    assert.deepEqual([(await itemOf(fourth.id)).status, (await itemOf(fourth.id)).version], ['ACTIVE', fourth.version], 'the losing MIXED step is undone with its contest');
    assert.equal((await transitionsOf(fourth.id)).filter((row) => row.after_status === 'MIXED').length, 0);
    assert.equal((await contestsOf(reader)).filter((c) => c.hypothesis_id === fourth.id).length, 0);
  } finally {
    stage = 'concurrency: fixture removal';
    await removeCommittedReader(reader);
  }
}

/**
 * Hypotheses and their history are append-only by design (0072), so committed fixtures are removed as the table owner
 * with triggers suspended for THIS session only, from every public table that names the reader. A failure part-way
 * through the fixtures may have left a transaction aborted: it is ended first, so the original error is the one reported.
 */
async function removeCommittedReader(reader) {
  await client.query('ROLLBACK');
  await client.query('BEGIN');
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = await rows(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`);
  for (const { table_name: table } of tables) await client.query(`DELETE FROM public.${table} WHERE user_id = $1`, [reader]);
  await client.query('DELETE FROM public.users WHERE id = $1', [reader]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [reader]);
  await client.query('COMMIT');
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.hypotheses WHERE user_id = $1)
    + (SELECT count(*) FROM public.understanding_contests WHERE user_id = $1)
    + (SELECT count(*) FROM public.confidence_evaluations WHERE user_id = $1)
    + (SELECT count(*) FROM public.users WHERE id = $1) + (SELECT count(*) FROM auth.users WHERE id = $1) AS residue`, [reader]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}

// ------------------------------------------------------------------------------------------------------
// R2 — exactly-once contest Confidence, on committed state, across two real connections.
//
// The API ensures the Confidence Runtime's canonical evaluation (public.create_confidence_evaluation, 0006 / 0028)
// under the contest's ONE confidence_evaluation_id: find that id; if absent, create under it; if the create loses the
// primary key to a concurrent request, re-read the SAME id. These steps are run here, statement for statement, on
// two connections that have BOTH observed "no evaluation yet" before either creates.
// ------------------------------------------------------------------------------------------------------

const createEvaluation = (id, hypothesisId, version, on) =>
  rows('SELECT id, user_id, target_id, target_type, target_version, numeric_score, confidence_band, calibration_state, stability, policy_version, provenance FROM public.create_confidence_evaluation($1::jsonb)',
    [JSON.stringify({ id, target_id: hypothesisId, target_version: version })], on);
const evaluationById = async (id, on = client) => rows('SELECT id, target_id, target_version, provenance, numeric_score, confidence_band FROM public.confidence_evaluations WHERE id = $1', [id], on);
const evaluationCount = async (where, values) => Number((await rows(`SELECT count(*)::int AS n FROM public.confidence_evaluations WHERE ${where}`, values))[0].n);

async function verifyContestConfidenceExactlyOnce() {
  const reader = randomUUID();
  try {
    stage = 'R2 confidence: committed fixtures and two committed contests';
    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users (id) VALUES ($1)', [reader]);
    const raced = await hypothesisAlong(reader, ['ACTIVE']);
    const retried = await hypothesisAlong(reader, ['ACTIVE']);
    await client.query('COMMIT');
    await client.query('BEGIN');
    await actAs('authenticated', reader);
    const command = randomUUID();
    const contest = await record(command, raced.id, raced.version);
    const other = await record(randomUUID(), retried.id, retried.version);
    await client.query('COMMIT');
    assert.equal(contest.outcome, 'RECORDED');
    assert.match(contest.confidence_evaluation_id, UUID);
    assert.notEqual(other.confidence_evaluation_id, contest.confidence_evaluation_id);
    const evaluationId = contest.confidence_evaluation_id;
    const version = contest.reevaluated_version;

    stage = 'R2 confidence: Case C — two simultaneous ensures that both saw "none yet" converge on ONE row';
    const one = new Client({ connectionString: databaseUrl });
    const two = new Client({ connectionString: databaseUrl });
    await one.connect();
    await two.connect();
    let loserCode;
    try {
      const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
      for (const on of [one, two]) {
        await on.query('BEGIN');
        await actAs('authenticated', reader, on);
        assert.deepEqual(await evaluationById(evaluationId, on), [], 'each request observes no evaluation yet');
      }
      const [won] = await createEvaluation(evaluationId, raced.id, version, one);
      assert.equal(won.id, evaluationId);
      const pending = createEvaluation(evaluationId, raced.id, version, two).then(() => null, (error) => error);
      await waitUntilBlocked(pid);
      await one.query('COMMIT');
      const lost = await pending;
      assert.ok(lost, 'the second create under the same identity must not also succeed');
      loserCode = lost.code;
      await two.query('ROLLBACK');
      // The loser re-reads the SAME identity and converges on the winner's committed row.
      await two.query('BEGIN');
      await actAs('authenticated', reader, two);
      const [converged] = await evaluationById(evaluationId, two);
      await two.query('COMMIT');
      assert.deepEqual(converged, { id: evaluationId, target_id: raced.id, target_version: version, provenance: 'QANDEEL_CONFIDENCE_RUNTIME', numeric_score: null, confidence_band: null });
    } finally {
      await one.end();
      await two.end();
    }
    assert.equal(loserCode, '23505', 'the loser met the primary key, i.e. the identity itself');
    assert.equal(await evaluationCount('id = $1', [evaluationId]), 1, 'exactly one contest-owned Confidence row');
    assert.equal(await evaluationCount("user_id = $1 AND target_id = $2 AND target_version = $3 AND provenance = 'QANDEEL_CONFIDENCE_RUNTIME'", [reader, raced.id, version]), 1,
      'and no second evaluation of the re-evaluated version under another identity');
    const [canonical] = await rows('SELECT user_id, target_type, calibration_state, stability, policy_version, missing_information_codes FROM public.confidence_evaluations WHERE id = $1', [evaluationId]);
    assert.deepEqual({ ...canonical, missing_information_codes: undefined }, { user_id: reader, target_type: 'HYPOTHESIS', calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED', policy_version: 'confidence-foundation-v1', missing_information_codes: undefined });
    assert.ok(canonical.missing_information_codes.includes('CONFIDENCE_MODEL_UNCALIBRATED'));

    stage = 'R2 confidence: Case A — a lost-response replay answers the same identity and finds the row; nothing new';
    await client.query('BEGIN');
    await actAs('authenticated', reader);
    const replay = await record(command, raced.id, raced.version);
    const repair = await record(randomUUID(), raced.id, version);
    assert.deepEqual([replay.outcome, replay.confidence_evaluation_id], ['RECORDED', evaluationId]);
    assert.deepEqual([repair.outcome, repair.confidence_evaluation_id], ['ALREADY_UNDER_REVIEW', evaluationId]);
    assert.equal((await evaluationById(evaluationId)).length, 1, 'found: the ensure creates nothing');
    await client.query('COMMIT');
    assert.equal(await evaluationCount('id = $1', [evaluationId]), 1);

    stage = 'R2 confidence: Case B — a transient failure before any row exists, then a retry under the SAME identity';
    const retryId = other.confidence_evaluation_id;
    await client.query('BEGIN');
    await actAs('authenticated', reader);
    await createEvaluation(retryId, retried.id, other.reevaluated_version);
    await client.query('ROLLBACK');
    assert.equal(await evaluationCount('id = $1', [retryId]), 0, 'the failed attempt left no row');
    await client.query('BEGIN');
    await actAs('authenticated', reader);
    assert.equal((await record(randomUUID(), retried.id, other.reevaluated_version)).confidence_evaluation_id, retryId, 'the retry is told the same identity');
    await createEvaluation(retryId, retried.id, other.reevaluated_version);
    await client.query('COMMIT');
    assert.equal(await evaluationCount('id = $1', [retryId]), 1);

    stage = 'R2 confidence: general Confidence history is unchanged — it is still free to hold another evaluation';
    await client.query('BEGIN');
    await actAs('authenticated', reader);
    await createEvaluation(randomUUID(), raced.id, version);
    await client.query('COMMIT');
    assert.equal(await evaluationCount('user_id = $1 AND target_id = $2 AND target_version = $3', [reader, raced.id, version]), 2,
      'no global (target, version) uniqueness: only the contest-owned identity is exactly-once');
    assert.equal(await evaluationCount('id = $1', [evaluationId]), 1);
  } finally {
    stage = 'R2 confidence: fixture removal';
    await removeCommittedReader(reader);
  }
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyCatalog();
      await verifyCommand();
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    await verifyContestConfidenceExactlyOnce();
    console.log('Verified migration 0127 Understanding contest: exact-version, audited re-evaluation, idempotent, one under review, concurrent, owner-only, one contest-owned Confidence evaluation.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
});
