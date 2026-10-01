// Real-PostgreSQL verifier for migration 0132 - PROD-OPS-01 Operational Readiness & Silent-Failure Visibility v1.
//
// It proves, against a fully migrated database (never grep alone):
//   1. the catalog: the readiness RPC is a zero-parameter, read-only, row-free SQL function answering `true`, owned by
//      postgres with an empty search_path, executable by service_role ONLY; the aggregate summary is the same posture
//      (DEFINER, STABLE) and returns numbers only; the failure classifier is executable by no role; the redefined
//      preparation pass keeps 0130's posture, grants and the private schema's exact executable census; the new
//      operational columns are invisible to every client and server role and absent from every owner answer;
//   2. readiness: service_role gets `true` inside a READ ONLY transaction; anon and authenticated are refused;
//   3. the closed classification of every SQLSTATE class that matters, and INTERNAL_OTHER for everything else;
//   4. export preparation through real injected failures: each failure is classified from the closed registry and
//      timestamped; the SQLSTATE and the exception text are NEVER persisted; the request stays PREPARING with the
//      unchanged one-minute backoff until the third attempt makes it FAILED exactly as 0130 did (owner answer FAILED);
//      a FAILED request is never touched again; a successful retry clears the stale classification and is READY;
//   5. the aggregate summary with synthetic timestamps: fresh work is not stuck; an aged PREPARING export, an aged
//      due deletion and an aged ERASED-waiting-for-provider deletion are; terminal FAILED exports are counted (in
//      total and recently) and recent failures by class; Connected Worlds BLOCKED is never counted (a stuck due
//      deletion that becomes BLOCKED leaves the count); no identity of any kind is returned; clients are refused;
//   6. the governed Personal erasure still removes an export row carrying the new operational fields: no orphan.
// Every fixture lives inside a transaction that is rolled back.
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
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];

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
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
}

async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}
async function asOwner(on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', '{}', true)");
}

const may = async (role, signature) => (await one("SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok", [role, signature])).ok;

async function reader(on = client) {
  const id = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}

const READY = 'public.server_database_ready_v1()';
const SUMMARY = 'public.server_read_privacy_operations_summary_v1()';
const CLASSIFY = 'personal_data_private.export_failure_class_v1(text)';
const PREPARE = 'personal_data_private.prepare_data_exports_v1(integer)';
const CLASSES = ['TRANSIENT_DATABASE', 'CONSTRAINT_OR_INTEGRITY', 'RESOURCE_OR_CAPACITY', 'INTERNAL_OTHER'];
const SUMMARY_COLUMNS = [
  'export_preparing', 'export_retrying', 'export_stuck_preparing', 'export_stuck_preparing_oldest_age_seconds',
  'export_failed_total', 'export_failed_recent', 'export_recent_failures_transient_database',
  'export_recent_failures_constraint_or_integrity', 'export_recent_failures_resource_or_capacity',
  'export_recent_failures_internal_other', 'deletion_stuck_due', 'deletion_stuck_due_oldest_age_seconds',
  'deletion_stuck_provider_pending', 'deletion_stuck_provider_pending_oldest_age_seconds',
];

// ------------------------------------------------------------------------------------------------------
// 1. Catalog.
// ------------------------------------------------------------------------------------------------------
async function verifyCatalog() {
  stage = 'catalog: readiness RPC posture';
  const fn = async (signature) => one(`SELECT p.prosecdef AS definer, p.provolatile AS volatility, p.proconfig::text[] AS config,
      pg_get_userbyid(p.proowner) AS owner, l.lanname AS language, p.pronargs AS args, p.prosrc AS src,
      pg_get_function_result(p.oid) AS result
      FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = to_regprocedure($1)`, [signature]);
  const ready = await fn(READY);
  assert.ok(ready, 'the readiness RPC exists');
  assert.deepEqual({ ...ready, src: ready.src.trim() }, {
    definer: false, volatility: 's', config: ['search_path=""'], owner: 'postgres', language: 'sql', args: 0, src: 'SELECT true', result: 'boolean',
  }, 'zero parameters, read-only, reads nothing, answers true, INVOKER, pinned search_path');
  assert.equal(await may('service_role', READY), true, 'service_role executes the readiness RPC');
  for (const role of ['anon', 'authenticated', 'public']) assert.equal(await may(role, READY), false, `${role} must not execute the readiness RPC`);

  stage = 'catalog: aggregate summary posture';
  const summary = await fn(SUMMARY);
  assert.ok(summary, 'the summary exists');
  assert.equal(summary.definer, true);
  assert.equal(summary.volatility, 's', 'the summary is read-only');
  assert.deepEqual(summary.config, ['search_path=""']);
  assert.equal(summary.owner, 'postgres');
  assert.equal(summary.args, 0, 'no parameter: nobody can ask about one account');
  const columns = [...summary.result.matchAll(/(\w+) (integer|bigint)/gu)].map((m) => m[1]);
  assert.deepEqual(columns, SUMMARY_COLUMNS, 'exactly the fourteen aggregate columns');
  assert.doesNotMatch(summary.result.replace(/^TABLE\(|\)$/gu, '').replace(/\w+ (integer|bigint)(, )?/gu, ''), /\S/u, 'every column is a number: no uuid, text or json');
  assert.equal(await may('service_role', SUMMARY), true);
  for (const role of ['anon', 'authenticated', 'public']) assert.equal(await may(role, SUMMARY), false, `${role} must not execute the summary`);

  stage = 'catalog: the classifier and the redefined preparation pass';
  const classify = await fn(CLASSIFY);
  assert.deepEqual({ definer: classify.definer, volatility: classify.volatility, config: classify.config, owner: classify.owner },
    { definer: false, volatility: 'i', config: ['search_path=""'], owner: 'postgres' });
  for (const role of ['anon', 'authenticated', 'service_role', 'public']) assert.equal(await may(role, CLASSIFY), false, `${role} must not execute the classifier`);
  const prepare = await fn(PREPARE);
  assert.equal(prepare.definer, true);
  assert.deepEqual(prepare.config, ['search_path=""']);
  assert.equal(prepare.owner, 'postgres');
  assert.equal(await may('service_role', PREPARE), true);
  for (const role of ['anon', 'authenticated', 'public']) assert.equal(await may(role, PREPARE), false);
  assert.match(prepare.src, /CASE WHEN e\.attempt_count >= 3 THEN 'FAILED' ELSE 'PREPARING' END/u, 'three attempts, then FAILED: unchanged');
  assert.match(prepare.src, /clock_timestamp\(\) \+ interval '1 minute'/u, 'the one-minute backoff: unchanged');
  assert.match(prepare.src, /lease_until = clock_timestamp\(\) \+ interval '5 minutes'/u, 'the five-minute lease: unchanged');
  assert.match(prepare.src, /GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;/u);
  assert.doesNotMatch(prepare.src, /MESSAGE_TEXT|SQLERRM|PG_EXCEPTION_DETAIL|PG_EXCEPTION_CONTEXT|failure_class = v_sqlstate/u, 'no exception text and no raw SQLSTATE is ever read into the row');
  const executable = await rows(`SELECT r.rolname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role' UNION ALL SELECT 'public') r
    WHERE n.nspname = 'personal_data_private' AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(executable.map((e) => `${e.rolname}:${e.proname}`), [
    'authenticated:cancel_own_account_deletion_v1', 'authenticated:read_own_data_export_v1', 'authenticated:read_own_privacy_state_v1',
    'authenticated:request_own_account_deletion_v1', 'authenticated:request_own_data_export_v1',
    'service_role:claim_due_account_deletions_v1', 'service_role:complete_account_deletion_v1', 'service_role:erase_personal_account_v1',
    'service_role:prepare_data_exports_v1',
  ], 'the private schema\'s executable surface is exactly 0130\'s');

  stage = 'catalog: the operational fields are private';
  const added = await rows(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'personal_data_private' AND table_name = 'data_exports' AND column_name IN ('failure_class', 'last_failure_at') ORDER BY 1`);
  assert.deepEqual(added, [{ column_name: 'failure_class', data_type: 'text' }, { column_name: 'last_failure_at', data_type: 'timestamp with time zone' }]);
  const textColumns = await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'personal_data_private'
    AND table_name = 'data_exports' AND data_type IN ('text', 'character varying', 'json', 'jsonb') ORDER BY 1`);
  assert.deepEqual(textColumns.map((c) => c.column_name), ['content', 'failure_class', 'status'],
    'no free-text column: status and failure_class are closed by checks, content is the READY artifact only');
  for (const role of ['anon', 'authenticated', 'service_role', 'public']) {
    for (const column of ['failure_class', 'last_failure_at']) {
      const [{ allowed }] = await rows("SELECT has_column_privilege($1, 'personal_data_private.data_exports', $2, 'SELECT') AS allowed", [role, column]);
      assert.equal(allowed, false, `${role} cannot read ${column}`);
    }
  }
  const constraint = await one(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'personal_data_private.data_exports'::regclass AND conname = 'data_exports_failure_class_check'`);
  for (const value of CLASSES) assert.ok(constraint.def.includes(`'${value}'`), `the closed registry holds ${value}`);
  assert.equal([...constraint.def.matchAll(/'([A-Z_]+)'/gu)].length, 4, 'exactly four classes');
  const ownerAnswers = await rows(`SELECT pg_get_function_result(p.oid) AS result FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'personal_data_private') AND p.proname IN ('read_own_privacy_state_v1', 'read_own_data_export_v1', 'request_own_data_export_v1')`);
  assert.equal(ownerAnswers.length, 6);
  for (const { result } of ownerAnswers) assert.doesNotMatch(result, /failure|attempt/u, 'no owner answer carries operational state');
}

// ------------------------------------------------------------------------------------------------------
// 2. Readiness.
// ------------------------------------------------------------------------------------------------------
async function verifyReadiness() {
  stage = 'readiness: the server role reads true inside a READ ONLY transaction';
  await client.query('BEGIN READ ONLY');
  try {
    await actAs('service_role');
    assert.deepEqual(await rows('SELECT public.server_database_ready_v1() AS ready'), [{ ready: true }]);
    for (const role of ['anon', 'authenticated']) {
      await actAs(role, role === 'authenticated' ? randomUUID() : null);
      await rejected(() => client.query('SELECT public.server_database_ready_v1()'), ['42501']);
      await rejected(() => client.query('SELECT * FROM public.server_read_privacy_operations_summary_v1()'), ['42501']);
    }
  } finally {
    await client.query('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 3. Classification.
// ------------------------------------------------------------------------------------------------------
async function verifyClassification() {
  stage = 'classification: every SQLSTATE class maps into the closed registry';
  const expected = {
    '08006': 'TRANSIENT_DATABASE', '40001': 'TRANSIENT_DATABASE', '40P01': 'TRANSIENT_DATABASE', '55P03': 'TRANSIENT_DATABASE',
    '55006': 'TRANSIENT_DATABASE', '57P01': 'TRANSIENT_DATABASE', '58030': 'TRANSIENT_DATABASE',
    '22P02': 'CONSTRAINT_OR_INTEGRITY', '22001': 'CONSTRAINT_OR_INTEGRITY', '23505': 'CONSTRAINT_OR_INTEGRITY', '23503': 'CONSTRAINT_OR_INTEGRITY',
    '27000': 'CONSTRAINT_OR_INTEGRITY', '44000': 'CONSTRAINT_OR_INTEGRITY',
    '53200': 'RESOURCE_OR_CAPACITY', '53100': 'RESOURCE_OR_CAPACITY', '54000': 'RESOURCE_OR_CAPACITY', '54001': 'RESOURCE_OR_CAPACITY',
    P0001: 'INTERNAL_OTHER', '42501': 'INTERNAL_OTHER', '42P01': 'INTERNAL_OTHER', '55000': 'INTERNAL_OTHER', XX000: 'INTERNAL_OTHER',
    '': 'INTERNAL_OTHER', 'not a state': 'INTERNAL_OTHER',
  };
  for (const [state, cls] of Object.entries(expected)) {
    const [{ value }] = await rows('SELECT personal_data_private.export_failure_class_v1($1) AS value', [state]);
    assert.equal(value, cls, `${state || '(empty)'} is ${cls}`);
  }
  const [{ value }] = await rows('SELECT personal_data_private.export_failure_class_v1(NULL) AS value');
  assert.equal(value, 'INTERNAL_OTHER');
}

// ------------------------------------------------------------------------------------------------------
// 4. Export preparation through real injected failures.
// ------------------------------------------------------------------------------------------------------
const SECRET = 'RAW_EXCEPTION_SECRET_TEXT';

/** Make the real build fail with `state` (and a secret message naming the account) while the fault is set. */
async function plantFaultableBuild(on) {
  await on.query('ALTER FUNCTION personal_data_private.build_personal_export_v1(uuid) RENAME TO build_personal_export_v1_verifier_original');
  await on.query(`CREATE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid) RETURNS jsonb
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
    DECLARE v_state text := pg_catalog.current_setting('qandeel.verifier_export_fault', true);
    BEGIN
      IF v_state IS NOT NULL AND v_state <> '' THEN
        RAISE EXCEPTION USING ERRCODE = v_state, MESSAGE = '${SECRET} for ' || p_subject::text, DETAIL = '${SECRET} detail';
      END IF;
      RETURN personal_data_private.build_personal_export_v1_verifier_original(p_subject);
    END $$`);
}

async function prepareWith(on, state) {
  await asOwner(on);
  await on.query("SELECT set_config('qandeel.verifier_export_fault', $1, true)", [state ?? '']);
  // A failed attempt is backed off for one minute; the verifier lets the backoff pass instead of waiting it out.
  await on.query("UPDATE personal_data_private.data_exports SET lease_until = clock_timestamp() - interval '1 second' WHERE status = 'PREPARING' AND lease_until IS NOT NULL");
  await actAs('service_role', null, on);
  const [{ prepared }] = await rows('SELECT public.server_prepare_data_exports_v1(20) AS prepared', [], on);
  await asOwner(on);
  return prepared;
}

const exportRow = async (on, user) => one(`SELECT status, attempt_count, failure_class, last_failure_at, lease_until, content,
    lease_until > clock_timestamp() + interval '50 seconds' AND lease_until <= clock_timestamp() + interval '61 seconds' AS one_minute_backoff,
    to_jsonb(e)::text AS whole FROM personal_data_private.data_exports e WHERE user_id = $1`, [user], on);

async function verifyExportFailures() {
  stage = 'export failures: fixtures';
  // Its own connection, so the planted build is resolved fresh by the preparation pass's plan.
  const on = new Client({ connectionString: databaseUrl });
  await on.connect();
  try {
    await on.query('BEGIN');
    await plantFaultableBuild(on);
    const alice = await reader(on);
    await on.query("INSERT INTO personal_data_private.data_exports (user_id, command_id, status) VALUES ($1, $2, 'PREPARING')", [alice, randomUUID()]);
    const ownerSees = async (user) => {
      await actAs('authenticated', user, on);
      const state = await one('SELECT * FROM public.read_own_privacy_state_v1()', [], on);
      await asOwner(on);
      return state.export_status;
    };

    stage = 'export failures: each failed attempt is classified, timestamped and retried exactly as before';
    const steps = [['40001', 'TRANSIENT_DATABASE', 1, 'PREPARING'], ['23505', 'CONSTRAINT_OR_INTEGRITY', 2, 'PREPARING'], ['53200', 'RESOURCE_OR_CAPACITY', 3, 'FAILED']];
    for (const [state, cls, attempts, status] of steps) {
      await prepareWith(on, state);
      const row = await exportRow(on, alice);
      assert.equal(row.status, status, `attempt ${attempts} leaves the request ${status}`);
      assert.equal(row.attempt_count, attempts);
      assert.equal(row.failure_class, cls, `${state} is recorded as ${cls}`);
      assert.ok(row.last_failure_at instanceof Date, 'the failure is timestamped');
      assert.equal(row.content, null, 'no partial artifact');
      if (status === 'PREPARING') assert.equal(row.one_minute_backoff, true, 'the unchanged one-minute backoff');
      else assert.equal(row.lease_until, null, 'a FAILED request holds no lease');
      // The only free values on the row are the closed status and class (catalog above); the class is never the state.
      assert.ok(!row.whole.includes(SECRET) && !row.whole.includes(`for ${alice}`), 'the exception text is never persisted');
      assert.notEqual(row.failure_class, state, 'the raw SQLSTATE is never persisted');
      assert.equal(await ownerSees(alice), status, 'the owner sees exactly 0130\'s state');
    }

    stage = 'export failures: FAILED is terminal';
    await prepareWith(on, null);
    const failed = await exportRow(on, alice);
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.attempt_count, 3, 'a FAILED request is never attempted again');
    assert.equal(failed.failure_class, 'RESOURCE_OR_CAPACITY', 'its last class is kept for operations');

    stage = 'export failures: a successful retry clears the stale classification';
    const carol = await reader(on);
    await on.query("INSERT INTO personal_data_private.data_exports (user_id, command_id, status) VALUES ($1, $2, 'PREPARING')", [carol, randomUUID()]);
    await prepareWith(on, 'P0001');
    assert.equal((await exportRow(on, carol)).failure_class, 'INTERNAL_OTHER');
    await prepareWith(on, '54000');
    const carolRetrying = await exportRow(on, carol);
    assert.deepEqual([carolRetrying.status, carolRetrying.attempt_count, carolRetrying.failure_class], ['PREPARING', 2, 'RESOURCE_OR_CAPACITY']);
    await prepareWith(on, null);
    const carolReady = await exportRow(on, carol);
    assert.equal(carolReady.status, 'READY', 'the third attempt succeeds');
    assert.equal(carolReady.attempt_count, 3);
    assert.equal(carolReady.failure_class, null, 'a success clears the stale class');
    assert.equal(carolReady.last_failure_at, null, 'and its time');
    assert.ok(carolReady.content && typeof carolReady.content === 'object', 'the artifact is the real, complete package');

    stage = 'export failures: no exception text anywhere in the private state';
    const [{ leaked }] = await rows(`SELECT count(*)::int AS leaked FROM personal_data_private.data_exports e
      WHERE to_jsonb(e)::text LIKE '%' || $1 || '%'`, [SECRET], on);
    assert.equal(leaked, 0);
    const [{ unknown }] = await rows(`SELECT count(*)::int AS unknown FROM personal_data_private.data_exports e
      WHERE e.failure_class IS NOT NULL AND e.failure_class <> ALL ($1::text[])`, [CLASSES], on);
    assert.equal(unknown, 0, 'every recorded class is from the closed registry');
    await rejected(() => on.query("UPDATE personal_data_private.data_exports SET failure_class = '40001', last_failure_at = now() WHERE user_id = $1", [alice]), ['23514'], on);
    await rejected(() => on.query("UPDATE personal_data_private.data_exports SET failure_class = 'INTERNAL_OTHER', last_failure_at = NULL WHERE user_id = $1", [alice]), ['23514'], on);
    await rejected(() => on.query("UPDATE personal_data_private.data_exports SET failure_class = 'INTERNAL_OTHER', last_failure_at = now() WHERE user_id = $1", [carol]), ['23514'], on);
  } finally {
    await on.query('ROLLBACK').catch(() => undefined);
    await on.end();
  }
}

// ------------------------------------------------------------------------------------------------------
// 5. The aggregate summary.
// ------------------------------------------------------------------------------------------------------
async function summaryNow() {
  await actAs('service_role');
  const answer = await rows('SELECT * FROM public.server_read_privacy_operations_summary_v1()');
  await asOwner();
  assert.equal(answer.length, 1, 'exactly one aggregate row');
  const [row] = answer;
  assert.deepEqual(Object.keys(row), SUMMARY_COLUMNS, 'exactly the aggregate columns: no identity of any kind');
  const numbers = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
  for (const [key, value] of Object.entries(numbers)) assert.ok(Number.isSafeInteger(value) && value >= 0, `${key} is a non-negative whole number`);
  return numbers;
}

async function verifySummary() {
  stage = 'summary: synthetic state';
  await client.query('BEGIN');
  try {
    const before = await summaryNow();
    const [stuckExport, freshRetrying, failedRecent, failedOld, failedLegacy] = [await reader(), await reader(), await reader(), await reader(), await reader()];
    const insertExport = (user, status, extra = {}) => client.query(
      `INSERT INTO personal_data_private.data_exports (user_id, command_id, status, requested_at, attempt_count, failure_class, last_failure_at)
       VALUES ($1, $2, $3, now() - $4::interval, $5, $6, now() - $7::interval)`,
      [user, randomUUID(), status, extra.age ?? '0 seconds', extra.attempts ?? 0, extra.cls ?? null, extra.cls ? (extra.failedAgo ?? '0 seconds') : null]);
    // last_failure_at is NULL whenever the class is (the shape check): `now() - NULL` is NULL.
    await insertExport(stuckExport, 'PREPARING', { age: '2 hours' });
    await insertExport(freshRetrying, 'PREPARING', { attempts: 1, cls: 'TRANSIENT_DATABASE' });
    await insertExport(failedRecent, 'FAILED', { age: '2 hours', attempts: 3, cls: 'INTERNAL_OTHER', failedAgo: '1 hour' });
    await insertExport(failedOld, 'FAILED', { age: '4 days', attempts: 3, cls: 'CONSTRAINT_OR_INTEGRITY', failedAgo: '3 days' });
    await insertExport(failedLegacy, 'FAILED', { age: '9 days', attempts: 3 });

    const deletion = async (status, columns) => {
      const id = randomUUID();
      const names = Object.keys(columns);
      await client.query(
        `INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, ${names.join(', ')})
         VALUES ($1, $2, $3, $4, ${names.map((_, i) => `now() - $${i + 5}::interval`).join(', ')})`,
        [id, randomUUID(), randomUUID(), status, ...Object.values(columns)]);
      return id;
    };
    const stuckDue = await deletion('SCHEDULED', { requested_at: '8 days', final_at: '1 hour' });
    await deletion('SCHEDULED', { requested_at: '7 days', final_at: '1 minute' });
    await deletion('SCHEDULED', { requested_at: '1 day', final_at: '-6 days' });
    await deletion('ERASED', { requested_at: '8 days', final_at: '3 hours', erased_at: '2 hours' });
    await deletion('ERASED', { requested_at: '8 days', final_at: '2 minutes', erased_at: '1 minute' });
    await deletion('BLOCKED', { requested_at: '20 days', final_at: '13 days', blocked_at: '13 days' });
    await deletion('COMPLETED', { requested_at: '20 days', final_at: '13 days', erased_at: '13 days', completed_at: '13 days' });
    await deletion('CANCELLED', { requested_at: '20 days', final_at: '13 days', cancelled_at: '19 days' });

    stage = 'summary: aged work is stuck, fresh work is not, FAILED and recent classes are counted';
    const after = await summaryNow();
    const delta = Object.fromEntries(SUMMARY_COLUMNS.filter((c) => !c.endsWith('_seconds')).map((c) => [c, after[c] - before[c]]));
    assert.deepEqual(delta, {
      export_preparing: 2, export_retrying: 1, export_stuck_preparing: 1, export_failed_total: 3, export_failed_recent: 1,
      export_recent_failures_transient_database: 1, export_recent_failures_constraint_or_integrity: 0,
      export_recent_failures_resource_or_capacity: 0, export_recent_failures_internal_other: 1,
      deletion_stuck_due: 1, deletion_stuck_provider_pending: 1,
    }, 'exactly the aged, failed and classified fixtures; the fresh, not-due, BLOCKED, COMPLETED and CANCELLED ones are not stuck');
    assert.ok(after.export_stuck_preparing_oldest_age_seconds >= 7195, 'the stuck export\'s age (2 hours)');
    assert.ok(after.deletion_stuck_due_oldest_age_seconds >= 3595, 'the stuck deletion\'s age since it became due (1 hour)');
    assert.ok(after.deletion_stuck_provider_pending_oldest_age_seconds >= 7195, 'the provider-pending age since erasure (2 hours)');

    stage = 'summary: Connected Worlds BLOCKED is never an operational failure';
    await client.query("UPDATE personal_data_private.account_deletions SET status = 'BLOCKED', blocked_at = now() WHERE id = $1", [stuckDue]);
    assert.equal((await summaryNow()).deletion_stuck_due - before.deletion_stuck_due, 0, 'a stuck due deletion that the database BLOCKED leaves the count');

    stage = 'summary: fresh work is not stuck';
    await client.query('UPDATE personal_data_private.data_exports SET requested_at = now() WHERE user_id = $1', [stuckExport]);
    const fresh = await summaryNow();
    assert.equal(fresh.export_stuck_preparing - before.export_stuck_preparing, 0);
    assert.equal(fresh.export_preparing - before.export_preparing, 2, 'still preparing, just not stuck');
  } finally {
    await client.query('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 6. The governed erasure still removes the export row and its operational fields.
// ------------------------------------------------------------------------------------------------------
async function verifyErasureCompleteness() {
  stage = 'erasure: an export with operational fields leaves no orphan';
  await client.query('BEGIN');
  try {
    const user = await reader();
    await client.query(`INSERT INTO personal_data_private.data_exports (user_id, command_id, status, attempt_count, failure_class, last_failure_at)
      VALUES ($1, $2, 'FAILED', 3, 'TRANSIENT_DATABASE', now())`, [user, randomUUID()]);
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, user, randomUUID()]);
    await actAs('service_role');
    const [{ outcome }] = await rows('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId]);
    await asOwner();
    assert.equal(outcome, 'ERASED');
    assert.equal((await one('SELECT count(*)::int AS n FROM personal_data_private.data_exports WHERE user_id = $1', [user])).n, 0, 'the export row and its operational fields are gone');
    assert.equal((await one(`SELECT count(*)::int AS n FROM personal_data_private.data_exports e
      WHERE e.failure_class IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = e.user_id)`)).n, 0, 'no orphan anywhere');
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  await client.connect();
  try {
    await verifyCatalog();
    await verifyReadiness();
    await verifyClassification();
    await verifyExportFailures();
    await verifySummary();
    await verifyErasureCompleteness();
    console.log('Verified migration 0132: the readiness RPC is a zero-parameter, read-only, row-free `true` executable by service_role only; export preparation failures are classified into a closed four-class registry with no SQLSTATE or exception text persisted, three attempts and FAILED exactly as before, and a successful retry clears the class; the aggregate summary counts stuck, failed and recently classified work by number only, never counts Connected Worlds BLOCKED, and is refused to every client; the governed erasure leaves no operational orphan.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration 0132 verification failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
