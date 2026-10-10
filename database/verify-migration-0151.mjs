// INTEL-TM-01 - Personal Evidence Truth Maintenance (PG-02): the real-PostgreSQL verifier for migration 0151.
//
// It proves, against a fully migrated database (API CI applies every migration first), the WP0R2 acceptance matrix:
//   catalog   the record table (owner-only RLS, no client write, immutable, erasure-only DELETE, CASCADE), every
//             function's owner / security mode / empty search_path, EXECUTE only on the three entry points, the two
//             triggers with their exact WHEN conditions; the selector is migration 0063's body plus exactly the three
//             marked reliance lines, with its posture unchanged; finalize v2 and the canonical Evidence projection are
//             byte-identical to their defining migrations (L2 unchanged);
//   T1-T8     the reliance value on real rows: withdrawn link + remaining support (REVIEW_PENDING), only support
//             withdrawn (NO_REMAINING_SUPPORT), contradicting-only withdrawal and correction, supporting correction
//             (link kept, no record), expiry (only when no support is left), CURRENT out of the 64-row window and a
//             deduplication loser (NONE; Confidence unchanged), provisional items (NONE) - each identical BEFORE and
//             AFTER the housekeeping; the invariant L2 subset-of CURRENT; and monotonic withholding through lifecycle
//             moves, new support, a fresh Confidence and a PG-01 disagree / resolve;
//   T9        a link leaves a Hypothesis only through the recorded withdrawal step; records are immutable;
//   CC-4      the housekeeping: record + detach + version + 1 + exact-version Confidence in one step, idempotent,
//             bounded, refusing a bad bound, decides nothing;
//   T14       the selector: a withheld candidate is never selected, a same-turn re-return answers NO_ELIGIBLE_GAP with the
//             row untouched (then released by the existing trigger), a BOUND row on a withheld item no longer blocks;
//   T12/T13   the bind-time guard on two real connections: a withdrawal / correction committed or in flight before the
//             bind makes finalization fail closed (42501 QUESTION_BINDING_RELIANCE_WITHHELD, no assistant turn, the
//             reservation RELEASED when the turn fails); a withdrawal that rolls back lets the bind through; a bind that
//             commits first keeps BOUND history and then blocks nothing; duplicate housekeeping serializes; no deadlock;
//   T15       two-sided RLS on the record table and both reliance entry points; account erasure with a populated
//             record table leaves zero rows and is not BLOCKED.
// Committed race fixtures are removed and the removal is checked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationText = (name) => readFileSync(join(root, 'database/migrations', name), 'utf8').replace(/\r\n/gu, '\n');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
const MARK = ' -- INTEL-TM-01 (0151)';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];

/** Expect `operation` to be refused with one of `codes` (and, optionally, a message). Runs inside an open transaction. */
async function rejected(operation, codes, message, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try { await operation(); } catch (error) { refusal = error; } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  if (message) assert.match(refusal.message, message);
  return refusal;
}

async function actAs(role, userId = null, on = client, extra = {}) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role, ...extra }) : '{}']);
}
async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}
/** Runs `work` as service_role. After a failure nothing more is sent: the caller's savepoint or rollback restores the role. */
async function asServer(work, on = client) {
  await actAs('service_role', null, on);
  const value = await work();
  await asOwner(on);
  return value;
}

// ------------------------------------------------------------------------------------------------------------------
// Fixtures (owner-side inserts, exactly as earlier verifiers build canonical rows).
// ------------------------------------------------------------------------------------------------------------------
async function reader(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}
let memorySequence = 0;
/** One owned Memory. `age` days back sets created/updated, so the 64-row window order is controllable. */
async function memory(userId, { status = 'ACTIVE', source = 'USER_STATED', type = 'PERSONAL_FACT', expiresIn = null, age = 0, content, on = client } = {}) {
  const id = randomUUID();
  memorySequence += 1;
  await on.query(
    `INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, created_at, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 0.9, 0.8, $6, now() - make_interval(days => $7 + 2), now() - make_interval(days => $7),
             CASE WHEN $8::integer IS NULL THEN NULL ELSE now() + make_interval(days => $8::integer) END)`,
    [id, userId, type, content ?? `verifier-0151 fact ${memorySequence} ${id.slice(0, 8)}`, source, status, age, expiresIn],
  );
  return id;
}
const link = (memoryId) => `memory:${memoryId}`;
async function hypothesis(userId, { supporting = [], contradicting = [], status = 'ACTIVE', scope = 'verifier-0151 scope', id = randomUUID(), on = client } = {}) {
  await on.query(
    `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, supporting_evidence_ids, contradicting_evidence_ids, assumptions)
     VALUES ($1, $2, $3, 'BEHAVIORAL', 'WORK', $4, 'SYSTEM_GENERATED', $5, $6, $7, ARRAY['Deadlines matter to you.'])`,
    [id, userId, `verifier-0151 statement (${id.slice(-4)}).`, scope, status, supporting.map(link), contradicting.map(link)],
  );
  return id;
}
const itemOf = async (id, on = client) => one('SELECT status, version, supporting_evidence_ids AS s, contradicting_evidence_ids AS c, statement FROM public.hypotheses WHERE id = $1', [id], on);
/** The reliance value as the core computes it on the current row (owner-side). */
const change = async (id, on = client) => (await one(`SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids,
  h.contradicting_evidence_ids, CURRENT_TIMESTAMP) AS value FROM public.hypotheses h WHERE h.id = $1`, [id], on)).value;
/** The reliance value through the authenticated entry point, as the reader. */
async function relianceAs(userId, ids, on = client) {
  await actAs('authenticated', userId, on);
  try {
    return Object.fromEntries((await rows('SELECT hypothesis_id, hypothesis_version, evidence_change FROM public.hypothesis_evidence_reliance_v1($1::uuid[])', [ids], on))
      .map((row) => [row.hypothesis_id, [row.hypothesis_version, row.evidence_change]]));
  } finally { await asOwner(on); }
}
const records = async (id, on = client) => rows(`SELECT before_version, after_version, detached_supporting_evidence_ids AS s, detached_contradicting_evidence_ids AS c, confidence_evaluation_id
  FROM public.hypothesis_evidence_withdrawal_reevaluations WHERE hypothesis_id = $1 ORDER BY before_version`, [id], on);
const forget = (userId, memoryId, on = client) => asServer(() => rows('SELECT id FROM public.server_mark_memory_deleted_v1($1, $2)', [userId, memoryId], on), on);
const disable = (userId, memoryId, on = client) => asServer(() => rows('SELECT id FROM public.server_disable_memory_v1($1, $2)', [userId, memoryId], on), on);
const correct = (userId, memoryId, on = client) => asServer(() => rows(
  `SELECT id FROM public.server_supersede_memory_v1($1, $2, $3, 'PERSONAL_FACT', $4, 'USER_STATED', 0.9, 0.8, 'ACTIVE', NULL)`,
  [userId, memoryId, randomUUID(), `verifier-0151 corrected ${randomUUID().slice(0, 8)}`], on), on);
const housekeep = async (userId, limit = 32, on = client) => (await asServer(() => one('SELECT public.background_reevaluate_withdrawn_hypothesis_evidence_v1($1, $2) AS n', [userId, limit], on), on)).n;
const transition = (userId, id, version, status, on = client) => on.query('SELECT 1 FROM public.transition_hypothesis_core_v1($1, $2, $3, $4, $5)', [userId, id, version, status, 'AUTHENTICATED_TRANSITION']);

// ------------------------------------------------------------------------------------------------------------------
// 1. Catalog.
// ------------------------------------------------------------------------------------------------------------------
const FUNCTIONS = {
  'public.personal_evidence_memory_id_v1(text)': { definer: false, executors: [] },
  'public.personal_evidence_ids_valid_v1(text[])': { definer: false, executors: [] },
  'public.personal_evidence_standing_v1(uuid,text,timestamp with time zone)': { definer: false, executors: [] },
  'public.guard_hypothesis_evidence_withdrawal_reevaluation_v1()': { definer: false, executors: [] },
  'public.hypothesis_evidence_change_core_v1(uuid,uuid,text[],text[],timestamp with time zone)': { definer: false, executors: [] },
  'public.hypothesis_reliance_usable_v1(uuid,uuid)': { definer: false, executors: [] },
  'public.hypothesis_evidence_reliance_v1(uuid[])': { definer: true, executors: ['authenticated'] },
  'public.background_hypothesis_evidence_reliance_v1(uuid,uuid[])': { definer: true, executors: ['service_role'] },
  'public.guard_hypothesis_evidence_link_removal_v1()': { definer: true, executors: [] },
  'public.reevaluate_withdrawn_hypothesis_evidence_core_v1(uuid,integer)': { definer: true, executors: [] },
  'public.background_reevaluate_withdrawn_hypothesis_evidence_v1(uuid,integer)': { definer: true, executors: ['service_role'] },
  'public.guard_formal_question_binding_reliance_v1()': { definer: true, executors: [] },
};
const ROLES = ['anon', 'authenticated', 'service_role'];

/** The body of a CREATE FUNCTION statement in a migration text, between its AS $$ and $$. */
function bodyOf(text, header) {
  const start = text.indexOf(header);
  assert.ok(start >= 0, `${header} is defined`);
  const open = text.indexOf('$$', start);
  const close = text.indexOf('$$', open + 2);
  return text.slice(open + 2, close);
}

async function verifyCatalog() {
  stage = 'catalog: functions, owners, security, search_path and EXECUTE';
  for (const [signature, expected] of Object.entries(FUNCTIONS)) {
    const fn = await one(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig::text AS config FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [signature]);
    assert.ok(fn, `${signature} exists`);
    assert.deepEqual([fn.owner, fn.definer, fn.config], ['postgres', expected.definer, '{"search_path=\\"\\""}'], `${signature} posture`);
    for (const role of ROLES) {
      const { allowed } = await one("SELECT has_function_privilege($1, to_regprocedure($2), 'EXECUTE') AS allowed", [role, signature]);
      assert.equal(allowed, expected.executors.includes(role), `${role} EXECUTE on ${signature}`);
    }
    const { publicGrant } = await one("SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure($1) AND a.grantee = 0) AS \"publicGrant\"", [signature]);
    assert.equal(publicGrant, false, `PUBLIC holds nothing on ${signature}`);
  }

  stage = 'catalog: the record table';
  const table = await one(`SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = 'public.hypothesis_evidence_withdrawal_reevaluations'::regclass`);
  assert.deepEqual(table, { rls: true, owner: 'postgres' });
  for (const role of ROLES) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      const { allowed } = await one("SELECT has_table_privilege($1, 'public.hypothesis_evidence_withdrawal_reevaluations', $2) AS allowed", [role, privilege]);
      assert.equal(allowed, role === 'authenticated' && privilege === 'SELECT', `${role} ${privilege} on the record table`);
    }
  }
  const policies = await rows(`SELECT policyname, cmd, roles::text, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hypothesis_evidence_withdrawal_reevaluations'`);
  assert.equal(policies.length, 1, 'exactly one policy');
  assert.deepEqual([policies[0].cmd, policies[0].roles], ['SELECT', '{authenticated}']);
  assert.match(policies[0].qual, /user_id = \( SELECT auth\.uid\(\)/u);
  const constraints = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'public.hypothesis_evidence_withdrawal_reevaluations'::regclass`)).map((c) => [c.conname, c.def]));
  assert.match(constraints.hypothesis_evidence_withdrawal_hypothesis_owner_fk, /FOREIGN KEY \(hypothesis_id, user_id\) REFERENCES hypotheses\(id, user_id\) ON DELETE CASCADE/u);
  assert.match(constraints.hypothesis_evidence_withdrawal_one_step_per_version, /UNIQUE \(hypothesis_id, before_version\)/u);
  assert.match(constraints.hypothesis_evidence_withdrawal_confidence_evaluation_key, /UNIQUE \(confidence_evaluation_id\)/u);
  assert.match(constraints.hypothesis_evidence_withdrawal_version_step_check, /after_version = \(before_version \+ 1\)/u);
  const columns = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'hypothesis_evidence_withdrawal_reevaluations' ORDER BY ordinal_position`)).map((c) => c.column_name);
  assert.deepEqual(columns, ['id', 'user_id', 'hypothesis_id', 'before_version', 'after_version', 'detached_supporting_evidence_ids',
    'detached_contradicting_evidence_ids', 'confidence_evaluation_id', 'created_at'], 'no statement, content, reason or payload column');

  stage = 'catalog: the triggers';
  const triggers = Object.fromEntries((await rows(`SELECT t.tgname, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgname IN ('hypotheses_evidence_link_removal_guard', 'formal_question_turn_binding_reliance_guard',
      'hypothesis_evidence_withdrawal_reevaluations_immutable')`)).map((t) => [t.tgname, t.def]));
  assert.match(triggers.hypotheses_evidence_link_removal_guard, /BEFORE UPDATE OF supporting_evidence_ids, contradicting_evidence_ids ON public\.hypotheses FOR EACH ROW WHEN \(\(NOT \(\(old\.supporting_evidence_ids <@ new\.supporting_evidence_ids\) AND \(old\.contradicting_evidence_ids <@ new\.contradicting_evidence_ids\)\)\)\)/u);
  assert.match(triggers.formal_question_turn_binding_reliance_guard, /BEFORE UPDATE ON public\.formal_question_turn_bindings FOR EACH ROW WHEN \(\(\(old\.state = 'SELECTED'::text\) AND \(new\.state = 'BOUND'::text\)\)\)/u);
  assert.match(triggers.hypothesis_evidence_withdrawal_reevaluations_immutable, /BEFORE DELETE OR UPDATE ON public\.hypothesis_evidence_withdrawal_reevaluations/u);
  const enabled = await rows(`SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('hypotheses_evidence_link_removal_guard',
    'formal_question_turn_binding_reliance_guard', 'hypothesis_evidence_withdrawal_reevaluations_immutable') ORDER BY tgname`);
  assert.deepEqual(enabled.map((t) => t.tgenabled), ['O', 'O', 'O'], 'all three triggers are enabled');

  stage = 'catalog: the selector is 0063 plus exactly the three marked lines; finalize v2 and L2 are unchanged';
  const m0063 = migrationText('0063_question_information_gap_closed_loop_v1.sql');
  const m0151 = migrationText('0151_personal_evidence_truth_maintenance_v1.sql');
  const selectorLive = (await one("SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.select_formal_question_opportunity_v1(uuid,uuid,uuid)')")).prosrc.replace(/\r\n/gu, '\n');
  const selector0063 = bodyOf(m0063, 'CREATE FUNCTION public.select_formal_question_opportunity_v1(');
  assert.equal(selectorLive, bodyOf(m0151, 'CREATE OR REPLACE FUNCTION public.select_formal_question_opportunity_v1('), 'the live selector is the 0151 body');
  const added = selectorLive.split('\n').filter((line) => line.endsWith(MARK));
  assert.equal(added.length, 3, 'exactly three INTEL-TM-01 lines');
  assert.equal(selectorLive.split('\n').filter((line) => !line.endsWith(MARK)).join('\n'), selector0063, 'every other line is 0063 byte for byte');
  assert.deepEqual(added.map((line) => line.trim()), [
    "IF NOT public.hypothesis_reliance_usable_v1(existing.user_id, existing.hypothesis_id) THEN RETURN QUERY SELECT 'NO_ELIGIBLE_GAP'::text, NULL::uuid, NULL::text; RETURN; END IF;" + MARK,
    "AND public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)='NONE'" + MARK,
    "AND public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)='NONE'" + MARK,
  ]);
  const selectorPosture = await one(`SELECT pg_get_userbyid(proowner) AS owner, prosecdef AS definer, proconfig::text AS config,
    has_function_privilege('service_role', oid, 'EXECUTE') AS service, has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated,
    has_function_privilege('anon', oid, 'EXECUTE') AS anon FROM pg_proc WHERE oid = to_regprocedure('public.select_formal_question_opportunity_v1(uuid,uuid,uuid)')`);
  assert.deepEqual(selectorPosture, { owner: 'postgres', definer: true, config: '{"search_path=\\"\\""}', service: true, authenticated: false, anon: false });
  const finalizeLive = (await one("SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid)')")).prosrc.replace(/\r\n/gu, '\n');
  assert.equal(finalizeLive, bodyOf(m0063, 'CREATE FUNCTION public.finalize_conversation_turn_v2('), 'finalize v2 is not redefined');
  const projectionLive = (await one("SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.canonical_eligible_memory_ids_v1(uuid,timestamp with time zone)')")).prosrc.replace(/\r\n/gu, '\n');
  assert.equal(projectionLive, bodyOf(migrationText('0028_canonical_evidence_eligibility_v1.sql'), 'CREATE FUNCTION public.canonical_eligible_memory_ids_v1('), 'the canonical Evidence projection (L2) is unchanged');
  assert.doesNotMatch(m0151.replace(/--[^\n]*/gu, ''), /ERRCODE\s*=\s*'(?:40001|40P01|PT409)'/u, 'no retryable or PROD-RETRY-01-tracked SQLSTATE is raised');
  assert.doesNotMatch(m0151.replace(/--[^\n]*/gu, ''), /'(?:REJECTED|RETIRED)'/u, 'no lifecycle status is ever written');
}

// ------------------------------------------------------------------------------------------------------------------
// 2. T1-T9 + CC-4 on real rows (one rolled-back transaction).
// ------------------------------------------------------------------------------------------------------------------
async function verifySemantics() {
  const me = await reader();
  const other = await reader();

  stage = 'T7: a provisional item (no links), never tainted, is NONE';
  const provisional = await hypothesis(me);
  assert.equal(await change(provisional), 'NONE');

  stage = 'T1: a withdrawn link with remaining CURRENT support is REVIEW_PENDING before and after the housekeeping';
  const [m1, m2] = [await memory(me), await memory(me)];
  const t1 = await hypothesis(me, { supporting: [m1, m2] });
  assert.equal(await change(t1), 'NONE');
  await forget(me, m1);
  assert.equal(await change(t1), 'REVIEW_PENDING', 'before the housekeeping, from the withdrawn link alone');
  assert.deepEqual(await relianceAs(me, [t1]), { [t1]: [1, 'REVIEW_PENDING'] }, 'the authenticated read agrees');

  stage = 'T2: the only support disabled is NO_REMAINING_SUPPORT before and after';
  const m3 = await memory(me);
  const t2 = await hypothesis(me, { supporting: [m3] });
  await disable(me, m3);
  assert.equal(await change(t2), 'NO_REMAINING_SUPPORT');

  stage = 'T3: a contradicting-only withdrawal, and a contradicting correction, are REVIEW_PENDING';
  const [m4, m5, m6, m6b] = [await memory(me), await memory(me), await memory(me), await memory(me)];
  const t3a = await hypothesis(me, { supporting: [m4], contradicting: [m5] });
  const t3b = await hypothesis(me, { supporting: [m6b], contradicting: [m6] });
  await forget(me, m5);
  await correct(me, m6);
  assert.equal(await change(t3a), 'REVIEW_PENDING');
  assert.equal(await change(t3b), 'REVIEW_PENDING');

  stage = 'T4: a supporting correction is REVIEW_PENDING; the link is kept and no record is written';
  const [m7, m8] = [await memory(me), await memory(me)];
  const t4 = await hypothesis(me, { supporting: [m7, m8] });
  await correct(me, m7);
  assert.equal(await change(t4), 'REVIEW_PENDING');

  stage = 'T5: expiry withholds only when no support is left, and taints nothing';
  const lapsed = await memory(me, { expiresIn: -1, age: 3 });
  const expiredStatus = await memory(me, { status: 'EXPIRED' });
  const current = await memory(me);
  const t5all = await hypothesis(me, { supporting: [lapsed, expiredStatus] });
  const t5partial = await hypothesis(me, { supporting: [lapsed, current] });
  assert.equal(await change(t5all), 'NO_REMAINING_SUPPORT');
  assert.equal(await change(t5partial), 'NONE', 'partial expiry leaves it usable');

  stage = 'CC-4: one housekeeping call detaches exactly the WITHDRAWN links, with record, version + 1 and the exact Confidence';
  const before = { t1: await itemOf(t1), t2: await itemOf(t2), t3a: await itemOf(t3a), t4: await itemOf(t4), t5all: await itemOf(t5all) };
  assert.equal(await housekeep(me), 3, 't1, t2 and t3a are the only items naming a forgotten or disabled Memory');
  assert.equal(await housekeep(me), 0, 'a second call finds nothing: idempotent');
  for (const [key, id, kept, detached] of [
    ['t1', t1, { s: [link(m2)], c: [] }, { s: [link(m1)], c: [] }],
    ['t2', t2, { s: [], c: [] }, { s: [link(m3)], c: [] }],
    ['t3a', t3a, { s: [link(m4)], c: [] }, { s: [], c: [link(m5)] }],
  ]) {
    const now = await itemOf(id);
    assert.deepEqual([now.s, now.c, now.version, now.status, now.statement], [kept.s, kept.c, before[key].version + 1, before[key].status, before[key].statement], `${key}: links detached, one version step, nothing else`);
    const [record] = await records(id);
    assert.deepEqual([record.before_version, record.after_version, record.s, record.c], [before[key].version, before[key].version + 1, detached.s, detached.c], `${key}: the record names exactly the detached links`);
    const evaluation = await one('SELECT target_version, supporting_evidence_ids FROM public.confidence_evaluations WHERE id = $1', [record.confidence_evaluation_id]);
    assert.deepEqual([evaluation.target_version, evaluation.supporting_evidence_ids], [before[key].version + 1, kept.s], `${key}: the same-transaction exact-version Confidence, canonical Evidence only`);
  }
  assert.deepEqual([(await itemOf(t4)).s, (await itemOf(t4)).version, (await records(t4)).length], [before.t4.s, before.t4.version, 0], 'T4: a correction is never detached');
  assert.deepEqual([(await itemOf(t5all)).s, (await records(t5all)).length], [before.t5all.s, 0], 'T5: expiry is never detached');
  for (const [id, value] of [[t1, 'REVIEW_PENDING'], [t2, 'NO_REMAINING_SUPPORT'], [t3a, 'REVIEW_PENDING'], [t4, 'REVIEW_PENDING'], [t5all, 'NO_REMAINING_SUPPORT'], [t5partial, 'NONE'], [provisional, 'NONE']]) {
    assert.equal(await change(id), value, 'after the housekeeping the value is identical');
  }
  for (const limit of [0, 33, null]) await rejected(() => housekeep(me, limit), ['22023']);

  stage = 'T6: CURRENT support outside the 64-row window, or a deduplication loser, stays NONE; Confidence stays window-based';
  const windowed = await reader();
  const old = await memory(windowed, { age: 5 });
  for (let i = 0; i < 64; i += 1) await memory(windowed);
  const t6 = await hypothesis(windowed, { supporting: [old] });
  const inWindow = await one('SELECT count(*)::int AS n FROM public.canonical_eligible_memory_ids_v1($1, now()) c WHERE c.memory_id = $2', [windowed, old]);
  assert.equal(inWindow.n, 0, 'the old Memory is outside the canonical window');
  assert.equal(await change(t6), 'NONE', 'reliance does not use the window');
  const t6eval = await one('SELECT * FROM public.background_create_confidence_evaluation_v1($1, $2, $3, 1)', [windowed, randomUUID(), t6]);
  assert.ok(t6eval.missing_information_codes.includes('NO_ELIGIBLE_EVIDENCE'), 'Confidence is unchanged: window-based, so no Evidence');
  const dedup = await reader();
  const [twinA, twinB] = [await memory(dedup, { content: 'I run every morning.' }), await memory(dedup, { content: 'I run every morning.' })];
  const kept = (await rows('SELECT memory_id FROM public.canonical_eligible_memory_ids_v1($1, now())', [dedup])).map((r) => r.memory_id);
  const loser = kept.includes(twinA) ? twinB : twinA;
  assert.ok(!kept.includes(loser), 'one twin lost the exact deduplication');
  assert.equal(await change(await hypothesis(dedup, { supporting: [loser] })), 'NONE');
  for (const userId of [me, windowed, dedup]) {
    const { violations } = await one(`SELECT count(*)::int AS violations FROM public.canonical_eligible_memory_ids_v1($1, now()) c
      WHERE public.personal_evidence_standing_v1($1, c.evidence_id, now()) <> 'CURRENT'`, [userId]);
    assert.equal(violations, 0, 'invariant: every L2 id has L1 standing CURRENT');
  }

  stage = 'T5 restoration: an untainted NO_REMAINING_SUPPORT lifts only when CURRENT support is attached';
  const fresh = await memory(me);
  await asServer(() => client.query('SELECT 1 FROM public.background_attach_hypothesis_evidence_v1($1, $2, $3, $4)', [me, t5all, link(fresh), 'SUPPORTING']));
  assert.equal(await change(t5all), 'NONE');

  stage = 'T8: tainted stays withheld through WEAK->ACTIVE, RETIRED->REOPENED->ACTIVE, new support, a fresh Confidence and PG-01';
  let v = (await itemOf(t1)).version;
  for (const status of ['WEAK', 'ACTIVE', 'RETIRED', 'REOPENED', 'ACTIVE']) {
    await transition(me, t1, v, status);
    v += 1;
    assert.equal(await change(t1), 'REVIEW_PENDING', `still withheld after -> ${status}`);
  }
  const extra = await memory(me);
  await asServer(() => client.query('SELECT 1 FROM public.background_attach_hypothesis_evidence_v1($1, $2, $3, $4)', [me, t1, link(extra), 'SUPPORTING']));
  v += 1;
  assert.equal(await change(t1), 'REVIEW_PENDING', 'still withheld after a new supporting attach');
  await client.query('SELECT 1 FROM public.background_create_confidence_evaluation_v1($1, $2, $3, $4)', [me, randomUUID(), t1, v]);
  assert.equal(await change(t1), 'REVIEW_PENDING', 'still withheld after a fresh Confidence');
  await actAs('authenticated', me);
  assert.equal((await one('SELECT outcome FROM public.record_understanding_disagreement_v1($1, $2, $3)', [randomUUID(), t1, v])).outcome, 'RECORDED');
  v += 1;
  assert.equal((await one('SELECT outcome FROM public.resolve_understanding_disagreement_v1($1, $2, $3)', [randomUUID(), t1, v])).outcome, 'RESOLVED');
  await asOwner();
  assert.equal(await change(t1), 'REVIEW_PENDING', 'still withheld after a PG-01 disagree and resolve');
  const t2support = await memory(me);
  await asServer(() => client.query('SELECT 1 FROM public.background_attach_hypothesis_evidence_v1($1, $2, $3, $4)', [me, t2, link(t2support), 'SUPPORTING']));
  assert.equal(await change(t2), 'REVIEW_PENDING', 'a record-tainted item with new support is still withheld (no longer unsupported, still tainted)');

  stage = 'T11: a contested item that is also withdrawn keeps its contest; the housekeeping leaves the contest alone';
  const [mc, mc2] = [await memory(me), await memory(me)];
  const contested = await hypothesis(me, { supporting: [mc, mc2] });
  await actAs('authenticated', me);
  assert.equal((await one('SELECT outcome FROM public.record_understanding_disagreement_v1($1, $2, 1)', [randomUUID(), contested])).outcome, 'RECORDED');
  await asOwner();
  await forget(me, mc);
  assert.equal(await housekeep(me), 1);
  assert.equal(await change(contested), 'REVIEW_PENDING');
  assert.deepEqual((await rows("SELECT lifecycle FROM public.understanding_contests WHERE hypothesis_id = $1", [contested])).map((r) => r.lifecycle), ['UNDER_REVIEW']);
  assert.equal((await itemOf(contested)).status, 'MIXED', 'the status the disagreement set is untouched');

  stage = 'T9: a link leaves only through the recorded withdrawal step; records are immutable';
  const [g1, g2] = [await memory(me), await memory(me)];
  const guarded = await hypothesis(me, { supporting: [g1, g2] });
  await rejected(() => client.query("UPDATE public.hypotheses SET supporting_evidence_ids = $2, version = version + 1 WHERE id = $1", [guarded, [link(g2)]]), ['42501'], /HYPOTHESIS_EVIDENCE_LINK_REMOVAL_REQUIRES_RECORDED_WITHDRAWAL/u);
  await forget(me, g1);
  await rejected(() => client.query("UPDATE public.hypotheses SET supporting_evidence_ids = $2, version = version + 1 WHERE id = $1", [guarded, [link(g2)]]), ['42501'], /RECORDED_WITHDRAWAL/u);
  await client.query(`INSERT INTO public.hypothesis_evidence_withdrawal_reevaluations (user_id, hypothesis_id, before_version, after_version,
    detached_supporting_evidence_ids, detached_contradicting_evidence_ids, confidence_evaluation_id) VALUES ($1, $2, 1, 2, $3, '{}', gen_random_uuid())`, [me, guarded, [link(g2)]]);
  await rejected(() => client.query("UPDATE public.hypotheses SET supporting_evidence_ids = $2, version = version + 1 WHERE id = $1", [guarded, [link(g1)]]), ['42501'], /RECORDED_WITHDRAWAL/u);
  const roleSwap = await hypothesis(me, { supporting: [await memory(me)] });
  await rejected(() => client.query('UPDATE public.hypotheses SET contradicting_evidence_ids = supporting_evidence_ids, supporting_evidence_ids = \'{}\' WHERE id = $1', [roleSwap]), ['42501']);
  const [record] = await records(t1);
  await rejected(() => client.query('UPDATE public.hypothesis_evidence_withdrawal_reevaluations SET after_version = after_version WHERE confidence_evaluation_id = $1', [record.confidence_evaluation_id]), ['55000'], /IMMUTABLE/u);
  await rejected(() => client.query('DELETE FROM public.hypothesis_evidence_withdrawal_reevaluations WHERE confidence_evaluation_id = $1', [record.confidence_evaluation_id]), ['55000']);
  await rejected(() => client.query('DELETE FROM public.hypotheses WHERE id = $1', [t1]), ['55000'], /PRESERVED/u);
  await client.query('SELECT 1 FROM public.background_attach_hypothesis_evidence_v1($1, $2, $3, $4)', [me, guarded, link(await memory(me)), 'CONTRADICTING']);

  stage = 'T15: two-sided isolation of the record table and both reliance reads';
  await actAs('authenticated', other);
  assert.equal((await one('SELECT count(*)::int AS n FROM public.hypothesis_evidence_withdrawal_reevaluations')).n, 0, 'another reader sees no record');
  assert.deepEqual(await rows('SELECT * FROM public.hypothesis_evidence_reliance_v1($1::uuid[])', [[t1, t2]]), [], 'another reader is answered nothing for foreign ids');
  await actAs('authenticated', me);
  assert.equal((await one('SELECT count(*)::int AS n FROM public.hypothesis_evidence_withdrawal_reevaluations')).n, 5, 'the owner reads exactly their own records (t1, t2, t3a, contested, the forged T9 one)');
  await rejected(() => client.query('INSERT INTO public.hypothesis_evidence_withdrawal_reevaluations (user_id, hypothesis_id, before_version, after_version, detached_supporting_evidence_ids, detached_contradicting_evidence_ids, confidence_evaluation_id) VALUES ($1, $2, 9, 10, $3, \'{}\', gen_random_uuid())', [me, t4, [link(m7)]]), ['42501']);
  await rejected(() => client.query('SELECT public.background_reevaluate_withdrawn_hypothesis_evidence_v1($1, 32)', [me]), ['42501']);
  await rejected(() => client.query('SELECT * FROM public.background_hypothesis_evidence_reliance_v1($1, $2::uuid[])', [me, [t1]]), ['42501']);
  await rejected(() => client.query('SELECT * FROM public.hypothesis_evidence_reliance_v1($1::uuid[])', [Array.from({ length: 33 }, () => randomUUID())]), ['22023']);
  await actAs('authenticated', null);
  await rejected(() => client.query('SELECT * FROM public.hypothesis_evidence_reliance_v1($1::uuid[])', [[t1]]), ['42501']);
  await actAs('anon', null);
  await rejected(() => client.query('SELECT * FROM public.hypothesis_evidence_reliance_v1($1::uuid[])', [[t1]]), ['42501']);
  await rejected(() => client.query('SELECT count(*) FROM public.hypothesis_evidence_withdrawal_reevaluations'), ['42501']);
  await asOwner();
  const twin = await asServer(() => rows('SELECT hypothesis_id, evidence_change FROM public.background_hypothesis_evidence_reliance_v1($1, $2::uuid[])', [other, [t1, t2]]));
  assert.deepEqual(twin, [], 'the service twin answers only the named owner\'s items');
  assert.deepEqual(Object.fromEntries((await asServer(() => rows('SELECT hypothesis_id, evidence_change FROM public.background_hypothesis_evidence_reliance_v1($1, $2::uuid[])', [me, [t1, t5all, provisional]]))).map((r) => [r.hypothesis_id, r.evidence_change])),
    { [t1]: 'REVIEW_PENDING', [t5all]: 'NONE', [provisional]: 'NONE' });
}

// ------------------------------------------------------------------------------------------------------------------
// 3. Questions: the selector (rolled back) and the bind guard on one connection.
// ------------------------------------------------------------------------------------------------------------------
async function session(userId, on = client) {
  const id = randomUUID();
  await on.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, userId]);
  return id;
}
async function generatingTurn(userId, sessionId, on = client) {
  const id = randomUUID();
  await on.query("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason) VALUES ($1, $2, $3, 'USER', 'GENERATING', 'verifier-0151 turn', 'FAST', 'FAST_DEFAULT')", [id, sessionId, userId]);
  return id;
}
/** One automatic gap for (hypothesis, version), materialized through the canonical synchronization authority. */
async function gapFor(userId, hypothesisId, version, on = client) {
  const evaluationId = randomUUID();
  const executionId = randomUUID();
  await on.query(`INSERT INTO public.confidence_evaluations (id, user_id, target_id, target_type, target_version, version, lifecycle_state, numeric_score, confidence_band,
      calibration_state, stability, supporting_evidence_ids, contradicting_evidence_ids, assumptions, alternative_hypothesis_ids, missing_information_codes, policy_version, provenance)
    VALUES ($1, $2, $3, 'HYPOTHESIS', $4, 1, 'EVALUATED', NULL, NULL, 'UNCALIBRATED', 'UNASSESSED', '{}', '{}', '{}', '{}',
      ARRAY['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED'], 'confidence-foundation-v1', 'QANDEEL_CONFIDENCE_RUNTIME')`, [evaluationId, userId, hypothesisId, version]);
  await on.query(`INSERT INTO public.post_response_intelligence_executions (id, event_id, user_id, session_id, source_turn_id, event_version, processing_path,
      safety_disposition, state, current_stage, outcome_code, terminal_at) VALUES ($1, $2, $3, $4, $5, '2.0', 'FAST', 'ALLOW', 'RUNNING', 'VERIFIER_0151', NULL, NULL)`,
  [executionId, randomUUID(), userId, randomUUID(), randomUUID()]);
  await on.query(`INSERT INTO public.post_response_intelligence_effects (execution_id, effect_key, state, completed_at, result_code, result_payload)
    VALUES ($1, 'CONFIDENCE_BATCH', 'COMPLETED', CURRENT_TIMESTAMP, 'CONFIDENCE_BATCH_EVALUATED', $2)`,
  [executionId, JSON.stringify([{ ordinal: 1, hypothesisId, targetVersion: version, confidenceEvaluationId: evaluationId }])]);
  await asServer(() => on.query('SELECT public.sync_post_response_information_gaps_v1($1)', [executionId]), on);
  return (await one(`SELECT g.id FROM public.information_gaps g JOIN public.information_gap_confidence_sources s ON s.information_gap_id = g.id
    WHERE s.hypothesis_id = $1 AND s.target_version = $2`, [hypothesisId, version], on)).id;
}
const select = (userId, sessionId, turnId, on = client) => asServer(() => one('SELECT * FROM public.select_formal_question_opportunity_v1($1, $2, $3)', [userId, sessionId, turnId], on), on);
const finalize = (userId, sessionId, turnId, bindingId, on = client) => asServer(() => rows('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
  [sessionId, userId, turnId, randomUUID(), 'verifier-0151 reply', 'ALLOW', randomUUID(), null, null, bindingId], on), on);
const failTurn = (userId, sessionId, turnId, on = client) => asServer(() => rows('SELECT * FROM public.fail_conversation_turn($1, $2, $3, $4, NULL, NULL)', [sessionId, userId, turnId, randomUUID()], on), on);
const bindingOf = async (id, on = client) => one('SELECT state, assistant_turn_id, hypothesis_id FROM public.formal_question_turn_bindings WHERE id = $1', [id], on);
const assistantsOf = async (turnId, on = client) => (await one("SELECT count(*)::int AS n FROM public.conversation_turns WHERE source_turn_id = $1 AND role = 'ASSISTANT'", [turnId], on)).n;
/** A questioning target in `sessionId`, supported by one fresh Memory, with its open gap. */
async function target(userId, sessionId, on = client) {
  const support = await memory(userId, { on });
  const id = await hypothesis(userId, { supporting: [support], scope: `CONVERSATION_SESSION:${sessionId}`, on });
  await gapFor(userId, id, 1, on);
  return { id, support };
}

async function verifySelection() {
  const me = await reader();

  stage = 'T14: a reservation whose Hypothesis became withheld is not re-offered to the same turn; the row is untouched, then released';
  const s1 = await session(me);
  const a = await target(me, s1);
  const turn = await generatingTurn(me, s1);
  const first = await select(me, s1, turn);
  assert.equal(first.outcome, 'SELECTED');
  assert.equal((await bindingOf(first.binding_id)).hypothesis_id, a.id);
  assert.deepEqual(await select(me, s1, turn), first, 'idempotent while usable');
  await forget(me, a.support);
  assert.deepEqual(await select(me, s1, turn), { outcome: 'NO_ELIGIBLE_GAP', binding_id: null, question_type: null });
  assert.equal((await bindingOf(first.binding_id)).state, 'SELECTED', 'the row is untouched by the selector');
  await finalize(me, s1, turn, null);
  assert.equal((await bindingOf(first.binding_id)).state, 'RELEASED', 'the existing trigger released it when the turn finalized unbound');

  stage = 'T14: a withheld candidate is never selected; a usable one in the same session is';
  const s2 = await session(me);
  const withheld = await target(me, s2);
  await correct(me, withheld.support);
  const t2turn = await generatingTurn(me, s2);
  assert.deepEqual(await select(me, s2, t2turn), { outcome: 'NO_ELIGIBLE_GAP', binding_id: null, question_type: null }, 'the only open gap is withheld');
  const usable = await target(me, s2);
  const pick = await select(me, s2, t2turn);
  assert.equal(pick.outcome, 'SELECTED');
  assert.equal((await bindingOf(pick.binding_id)).hypothesis_id, usable.id, 'the withheld gap is passed over');

  stage = 'T13: a BOUND question on an item that becomes withheld stays BOUND as history and stops blocking the session';
  const s3 = await session(me);
  const bound = await target(me, s3);
  const t1 = await generatingTurn(me, s3);
  const reserved = await select(me, s3, t1);
  await finalize(me, s3, t1, reserved.binding_id);
  assert.equal((await bindingOf(reserved.binding_id)).state, 'BOUND');
  const next = await target(me, s3);
  assert.equal((await select(me, s3, await generatingTurn(me, s3))).outcome, 'OUTSTANDING_OPEN_QUESTION', 'while usable, the BOUND question blocks');
  await forget(me, bound.support);
  const afterWithdrawal = await select(me, s3, await generatingTurn(me, s3));
  assert.equal(afterWithdrawal.outcome, 'SELECTED', 'once withheld it blocks nothing');
  assert.equal((await bindingOf(afterWithdrawal.binding_id)).hypothesis_id, next.id);
  assert.equal((await bindingOf(reserved.binding_id)).state, 'BOUND', 'history is preserved');

  stage = 'T12 (one connection): a committed withdrawal before finalization fails it closed; nothing is delivered; failing the turn releases';
  const s4 = await session(me);
  const b = await target(me, s4);
  const t4 = await generatingTurn(me, s4);
  const r4 = await select(me, s4, t4);
  await disable(me, b.support);
  await rejected(() => finalize(me, s4, t4, r4.binding_id), ['42501'], /QUESTION_BINDING_RELIANCE_WITHHELD/u);
  assert.equal(await assistantsOf(t4), 0, 'no assistant turn exists');
  assert.equal((await bindingOf(r4.binding_id)).state, 'SELECTED');
  await failTurn(me, s4, t4);
  assert.equal((await bindingOf(r4.binding_id)).state, 'RELEASED', 'the existing release trigger frees it');
  assert.equal((await one('SELECT status FROM public.conversation_turns WHERE id = $1', [t4])).status, 'FAILED');
}

// ------------------------------------------------------------------------------------------------------------------
// 4. Races on committed state across two connections.
// ------------------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 400; i += 1) {
    const row = await one('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error('the second transaction never blocked on the first');
}
/** `first` runs and holds its transaction; `second` is shown to block on it; then `first` ends (COMMIT or ROLLBACK). */
async function race(first, second, { firstEnds = 'COMMIT' } = {}) {
  const one_ = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one_.connect();
  await two.connect();
  try {
    const [{ pid }] = (await two.query('SELECT pg_backend_pid() AS pid')).rows;
    await one_.query('BEGIN');
    const a = await first(one_);
    await two.query('BEGIN');
    const pending = second(two).then((value) => ({ value }), (error) => ({ error }));
    await waitUntilBlocked(pid);
    await one_.query(firstEnds);
    const b = await pending;
    await two.query(b.error ? 'ROLLBACK' : 'COMMIT');
    if (b.error?.code === '40P01') throw new Error('a deadlock was detected');
    return [a, b];
  } finally {
    await one_.end();
    await two.end();
  }
}
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
/** A fresh session with one usable questioning target and a GENERATING turn holding its SELECTED reservation. */
const reservation = (userId) => committed(async () => {
  const s = await session(userId);
  const t = await target(userId, s);
  const turn = await generatingTurn(userId, s);
  const selected = await select(userId, s, turn);
  assert.equal(selected.outcome, 'SELECTED');
  return { session: s, turn, binding: selected.binding_id, ...t };
});

async function verifyRaces() {
  const me = randomUUID();
  try {
    await committed(() => client.query('INSERT INTO auth.users (id) VALUES ($1)', [me]));

    stage = 'T12 race: a forget in flight during the bind - finalization waits, then fails closed; nothing delivered; released on failure';
    const x = await reservation(me);
    const [, bind1] = await race((on) => forget(me, x.support, on), (on) => finalize(me, x.session, x.turn, x.binding, on));
    assert.equal(bind1.error?.code, '42501');
    assert.match(bind1.error?.message ?? '', /QUESTION_BINDING_RELIANCE_WITHHELD/u);
    assert.equal(await assistantsOf(x.turn), 0, 'no assistant turn committed');
    await committed(() => failTurn(me, x.session, x.turn));
    assert.equal((await bindingOf(x.binding)).state, 'RELEASED');

    stage = 'T12 race: a correction in flight during the bind - the same';
    const y = await reservation(me);
    const [, bind2] = await race((on) => correct(me, y.support, on), (on) => finalize(me, y.session, y.turn, y.binding, on));
    assert.equal(bind2.error?.code, '42501');
    assert.equal(await assistantsOf(y.turn), 0);
    await committed(() => failTurn(me, y.session, y.turn));
    assert.equal((await bindingOf(y.binding)).state, 'RELEASED');

    stage = 'T12 race: a withdrawal that rolls back lets the waiting bind through';
    const z = await reservation(me);
    const [, bind3] = await race((on) => disable(me, z.support, on), (on) => finalize(me, z.session, z.turn, z.binding, on), { firstEnds: 'ROLLBACK' });
    assert.equal(bind3.error, undefined, 'the bind committed');
    assert.equal((await bindingOf(z.binding)).state, 'BOUND');
    assert.equal(await assistantsOf(z.turn), 1);

    stage = 'T13 race: the bind commits first - the withdrawal waits for it; BOUND is history and blocks nothing afterwards';
    const w = await reservation(me);
    const [bind4, withdrawal] = await race((on) => finalize(me, w.session, w.turn, w.binding, on), (on) => forget(me, w.support, on));
    assert.equal(bind4.length, 1, 'the question was delivered with its reply');
    assert.equal(withdrawal.error, undefined, 'the withdrawal committed after it');
    assert.equal((await bindingOf(w.binding)).state, 'BOUND');
    const following = await committed(async () => {
      const next = await target(me, w.session);
      const outcome = await select(me, w.session, await generatingTurn(me, w.session));
      return { next, outcome };
    });
    assert.equal(following.outcome.outcome, 'SELECTED', 'the withheld BOUND question does not block the session');
    assert.equal((await bindingOf(following.outcome.binding_id)).hypothesis_id, following.next.id, 'and the withheld item is not selected again');

    stage = 'CC-4 race: two housekeeping calls serialize - one re-evaluates, the other finds nothing; no double record';
    await committed(() => housekeep(me));
    const h = await committed(async () => {
      const support = await memory(me);
      const keep = await memory(me);
      const id = await hypothesis(me, { supporting: [support, keep] });
      await forget(me, support);
      return id;
    });
    const [n1, n2] = await race((on) => housekeep(me, 32, on), (on) => housekeep(me, 32, on));
    assert.deepEqual([n1, n2.value], [1, 0], 'the first call re-evaluated it; the waiting duplicate found nothing');
    assert.equal((await records(h)).length, 1, 'one record');

    stage = 'race: the housekeeping holding the Hypothesis while a bind waits on it - the bind fails closed, no deadlock';
    const q = await reservation(me);
    await committed(() => forget(me, q.support));
    const [, bind5] = await race((on) => housekeep(me, 32, on), (on) => finalize(me, q.session, q.turn, q.binding, on));
    assert.equal(bind5.error?.code, '42501');
    await committed(() => failTurn(me, q.session, q.turn));
  } finally {
    stage = 'races: fixture removal';
    await removeCommittedReader(me);
  }
}

/** Committed fixtures are removed as the table owner with triggers suspended for THIS session only (the 0134 pattern). */
async function removeCommittedReader(userId) {
  await client.query('BEGIN');
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = await rows(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`);
  // The effect ledger names its execution, not the user: it goes first, while the executions still say whose it is.
  await client.query(`DELETE FROM public.post_response_intelligence_effects WHERE execution_id IN (
    SELECT e.id FROM public.post_response_intelligence_executions e WHERE e.user_id = $1)`, [userId]);
  for (const { table_name: table } of tables) await client.query(`DELETE FROM public.${table} WHERE user_id = $1`, [userId]);
  await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = $1', [userId]);
  await client.query('DELETE FROM public.users WHERE id = $1', [userId]);
  await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
  await client.query('COMMIT');
  const { residue } = await one(`SELECT (SELECT count(*) FROM public.hypotheses WHERE user_id = $1)
    + (SELECT count(*) FROM public.hypothesis_evidence_withdrawal_reevaluations WHERE user_id = $1)
    + (SELECT count(*) FROM public.memories WHERE user_id = $1) + (SELECT count(*) FROM public.formal_question_turn_bindings WHERE user_id = $1)
    + (SELECT count(*) FROM public.runtime_event_outbox WHERE subject_user_id = $1)
    + (SELECT count(*) FROM public.post_response_intelligence_effects f
        WHERE NOT EXISTS (SELECT 1 FROM public.post_response_intelligence_executions e WHERE e.id = f.execution_id))
    + (SELECT count(*) FROM public.users WHERE id = $1) + (SELECT count(*) FROM auth.users WHERE id = $1) AS residue`, [userId]);
  assert.equal(Number(residue), 0, 'the committed fixtures are gone');
}

// ------------------------------------------------------------------------------------------------------------------
// 5. T15: account erasure with a populated record table (rolled back).
// ------------------------------------------------------------------------------------------------------------------
async function verifyErasure() {
  stage = 'T15: the governed erasure removes the records with their Hypotheses and is not BLOCKED';
  const alice = await reader();
  const bob = await reader();
  for (const userId of [alice, bob]) {
    const [m1, m2] = [await memory(userId), await memory(userId)];
    await hypothesis(userId, { supporting: [m1, m2] });
    await forget(userId, m1);
    assert.equal(await housekeep(userId), 1);
  }
  const count = async (userId) => (await one('SELECT count(*)::int AS n FROM public.hypothesis_evidence_withdrawal_reevaluations WHERE user_id = $1', [userId])).n;
  assert.deepEqual([await count(alice), await count(bob)], [1, 1], 'the fixture really populates the record table');
  await actAs('authenticated', alice, client, { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 1 }] });
  assert.equal((await one('SELECT * FROM public.request_own_account_deletion_v1($1)', [randomUUID()])).outcome, 'ACCEPTED');
  await asOwner();
  await client.query(`UPDATE personal_data_private.account_deletions SET requested_at = clock_timestamp() - interval '8 days', final_at = clock_timestamp() - interval '1 day'
    WHERE user_id = $1 AND status = 'SCHEDULED'`, [alice]);
  const { id: deletionId } = await one("SELECT id FROM personal_data_private.account_deletions WHERE user_id = $1 AND status <> 'CANCELLED'", [alice]);
  await asServer(() => rows('SELECT * FROM public.server_claim_due_account_deletions_v1(20)'));
  assert.equal((await asServer(() => one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]))).outcome, 'ERASED');
  assert.deepEqual([await count(alice), await count(bob)], [0, 1], 'zero rows of the account remain; another reader is untouched');
  assert.equal((await one('SELECT count(*)::int AS n FROM public.hypotheses WHERE user_id = $1', [alice])).n, 0);
}

async function main() {
  try {
    await client.connect();
    await verifyCatalog();
    for (const step of [verifySemantics, verifySelection, verifyErasure]) {
      await client.query('BEGIN');
      try { await step(); } finally { await client.query('ROLLBACK'); }
    }
    await verifyRaces();
    console.log('Verified migration 0151 Personal Evidence Truth Maintenance: reliance derived from committed facts only and identical before and after the housekeeping, permanent withholding for withdrawn or corrected evidence, L2 unchanged and contained in CURRENT, links removed only with an immutable record, the selector and the bind guard fail closed under every race without deadlock, owner-only, erased with the account.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  else if (error instanceof Error && !error.code) console.error(error.message);
  else if (error instanceof Error) console.error(error.message);
  process.exitCode = 1;
});
