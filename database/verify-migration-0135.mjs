// Real-PostgreSQL verifier for migration 0135 - AI-COST-01 Provider-Neutral AI Usage & Cost Ledger + Credit Accounting
// Foundation v1. It proves, against live semantics (never grep alone):
//   1. catalog and authority: seven tables, row-level security on with zero policies, no privilege for any application
//      role; exactly five service-role functions; every internal function executable by nobody; no price, no Credit
//      policy and no balance seeded; no column able to hold prompt, response, transcript, email or error text;
//   2. begin (task §18.1, 2, 7, 8): one intent per attempt id, replay idempotent, a different identity refused, a retry
//      that contacts the provider again is its own numbered row, cross-account correlation refused, TEST_PROVIDER and an
//      erased or unknown account refused (so no provider call can start for them);
//   3. settle (§18.3-6, 13, 14): one settlement per call, replay idempotent with no duplicate usage or rating, a
//      conflicting settlement refused, unknown usage stays USAGE_UNKNOWN, a failure is never free, cancelled is never
//      rated, malformed or float quantities refused, another account's call refused;
//   4. Price Cards and exact rating (§18.10-12, §19): per-kind pricing, no double charge, bases 1 / 1 000 / 1 000 000,
//      exact sub-cent sums, the card effective at the call's start, overlaps refused, history stable after a later price,
//      a referenced card immutable and its window closable only where no rated event would fall outside it, explicit
//      versioned re-rating that keeps the old version, mixed currencies UNPRICED, TEST_ONLY isolated from production;
//   5. the simulator (apps/api/dist, compiled from the same source) equals the database for identical inputs, and the
//      Credit formula function equals the simulator's;
//   6. Credits: CREDIT_POLICY_NOT_ACTIVATED, the activation gate refuses ACTIVE, no Credit rating can be written;
//   7. the operational summary sees a stale PENDING (§18.15) and the attribution aggregate carries no account identity;
//   8. the governed Personal erasure removes every accounting row of the account and nothing of another (§18.16);
//   9. committed multi-connection races: concurrent settles converge, conflicting ones refuse one, concurrent begins of
//      one id converge, one account's attempts are numbered without gaps, and two accounts never wait on each other.
// Everything except the committed races runs inside rolled-back transactions; the race fixtures are removed after.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;
const one = async (text, values = [], on = client) => (await rows(text, values, on))[0];
const count = async (text, values = []) => Number((await one(text, values)).n);

async function identity(role, uid = null, on = client) {
  await on.query('RESET ROLE');
  if (role !== 'postgres') await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}
async function refusal(operation, on = client) {
  await on.query('SAVEPOINT expected_refusal');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(error, 'the operation was expected to be refused, and it succeeded');
  return error;
}
async function rejected(operation, codes, on = client) {
  const error = await refusal(operation, on);
  assert.ok(codes.includes(error.code), `expected one of ${codes.join(', ')}, got ${error.code} (${error.message})`);
  return error;
}
/** numeric text -> canonical text without trailing fractional zeros. */
const canonical = (value) => {
  const text = String(value);
  return text.includes('.') ? text.replace(/0+$/u, '').replace(/\.$/u, '') : text;
};

const TABLES = ['ai_provider_calls', 'ai_provider_call_usage', 'ai_price_cards', 'ai_cost_ratings', 'ai_cost_rating_components', 'ai_credit_policies', 'ai_credit_ratings'];
const SERVICE_FUNCTIONS = [
  'public.begin_ai_provider_call_v1(uuid,uuid,uuid,uuid,text,text,text,text,text)',
  'public.settle_ai_provider_call_v1(uuid,uuid,text,text,jsonb)',
  'public.server_read_ai_usage_operations_summary_v1()',
  'public.server_read_ai_cost_aggregates_v1(timestamp with time zone,timestamp with time zone)',
  'public.server_read_ai_credit_policy_state_v1()',
];
const INTERNAL_FUNCTIONS = [
  'public.ai_provider_operation_is_known_v1(text,text)', 'public.ai_complete_usage_kinds_v1(text)',
  'public.guard_ai_provider_call_mutation_v1()', 'public.reject_ai_accounting_fact_mutation_v1()',
  'public.guard_ai_cost_rating_mutation_v1()', 'public.require_active_ai_credit_policy_v1()', 'public.guard_ai_price_card_v1()',
  'public.ai_rated_component_amount_v1(bigint,numeric,bigint)', 'public.ai_credits_for_rated_cost_v1(numeric,numeric,integer,text)',
  'public.ai_rate_provider_call_v1(uuid,text)',
  'public.register_ai_price_card_v1(text,text,text,text,text,numeric,bigint,text,timestamp with time zone,text)',
  'public.rerate_ai_provider_call_v1(uuid,text)',
];
const ROLES = ['anon', 'authenticated', 'service_role', 'public'];
const may = async (role, signature) => (await one("SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok", [role, signature])).ok;

const BEGIN = 'SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
const SETTLE = 'SELECT * FROM public.settle_ai_provider_call_v1($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb)';
const OPENAI_COMPLETE = { INPUT_TOKEN: 300, CACHE_READ_INPUT_TOKEN: 600, CACHE_WRITE_INPUT_TOKEN: 100, OUTPUT_TOKEN: 250 };

async function reader(on = client) {
  const user = randomUUID();
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [user]);
  return user;
}
async function sessionWithTurn(user, on = client) {
  const session = randomUUID();
  const turn = randomUUID();
  await on.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
  await on.query("INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'accounting fixture')", [turn, session, user]);
  return { session, turn };
}
async function begin(fields, on = client) {
  const f = { call: randomUUID(), session: null, turn: null, provider: 'OPENAI', model: 'gpt-5-mini', operation: 'OPENAI_RESPONSES_CREATE', family: 'CU_SEGMENTATION', path: null, ...fields };
  await identity('service_role', null, on);
  const row = await one(BEGIN, [f.call, f.user, f.session, f.turn, f.provider, f.model, f.operation, f.family, f.path], on);
  await identity('postgres', null, on);
  return { ...row, call: f.call };
}
async function settle(call, user, outcome, completeness, usage, on = client) {
  await identity('service_role', null, on);
  const row = await one(SETTLE, [call, user, outcome, completeness, JSON.stringify(usage)], on);
  await identity('postgres', null, on);
  return row;
}
/** A synthetic TEST_PROVIDER call at a chosen instant (database owner; no API path can create one). */
async function testCall(user, startedAt, on = client) {
  const id = randomUUID();
  await on.query(`INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
                  VALUES ($1, $2, 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', 'CU_SEGMENTATION', 1, 'PENDING', $3::timestamptz)`, [id, user, startedAt]);
  return id;
}
const register = async (kind, price, basis, from, currency = 'USD', on = client) =>
  (await one(`SELECT public.register_ai_price_card_v1('TEST_ONLY', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', $1::text, $2::numeric, $3::bigint, $4::text, $5::timestamptz, 'TEST_ONLY synthetic fixture') AS id`,
    [kind, price, basis, currency, from], on)).id;
const canonicalRating = (call) => one('SELECT * FROM public.ai_cost_ratings WHERE provider_call_id = $1 AND is_canonical', [call]);

// ------------------------------------------------------------------------------------------------------
// 1. Catalog and authority.
// ------------------------------------------------------------------------------------------------------
async function verifyCatalog() {
  stage = 'catalog: tables, row-level security, zero policies, zero privileges';
  const tables = await rows(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ai\\_%' ORDER BY 1`);
  assert.deepEqual(tables.map((t) => t.relname), [...TABLES].sort());
  assert.ok(tables.every((t) => t.relrowsecurity), 'row-level security on every accounting table');
  assert.equal(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'ai\\_%'"), 0, 'no policy: no role reads a row');
  for (const role of ROLES) {
    for (const table of TABLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS ok', [role, `public.${table}`, privilege])).ok, false, `${role} holds no ${privilege} on ${table}`);
      }
    }
  }
  assert.equal(await count("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'ai\\_%'"), 0, 'no sequence');

  stage = 'catalog: functions - posture and the exact executable surface';
  for (const signature of [...SERVICE_FUNCTIONS, ...INTERNAL_FUNCTIONS]) {
    const fn = await one(`SELECT p.prosecdef AS definer, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner
      FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [signature]);
    assert.ok(fn, `${signature} exists`);
    assert.deepEqual(fn.config, ['search_path=""'], `${signature} pins an empty search_path`);
    assert.equal(fn.owner, 'postgres', `${signature} is owned by postgres`);
  }
  for (const signature of SERVICE_FUNCTIONS) {
    assert.equal((await one('SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure($1)', [signature])).prosecdef, true, `${signature} is SECURITY DEFINER`);
    assert.equal(await may('service_role', signature), true, `service_role executes ${signature}`);
    for (const role of ['anon', 'authenticated', 'public']) assert.equal(await may(role, signature), false, `${role} must not execute ${signature}`);
  }
  for (const signature of INTERNAL_FUNCTIONS) {
    for (const role of ROLES) assert.equal(await may(role, signature), false, `${role} must not execute internal ${signature}`);
  }
  const reachable = await rows(`SELECT p.oid::regprocedure::text AS fn, r AS role FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
     WHERE n.nspname = 'public' AND (p.proname LIKE 'ai\\_%' OR p.proname LIKE '%\\_ai\\_%')
       AND has_function_privilege(r, p.oid, 'EXECUTE') ORDER BY 1, 2`);
  assert.deepEqual(reachable.map((r) => `${r.role}:${r.fn}`).sort(),
    ['service_role:public.begin_ai_provider_call_v1(uuid,uuid,uuid,uuid,text,text,text,text,text)', 'service_role:public.server_read_ai_cost_aggregates_v1(timestamp with time zone,timestamp with time zone)',
      'service_role:public.server_read_ai_credit_policy_state_v1()', 'service_role:public.server_read_ai_usage_operations_summary_v1()',
      'service_role:public.settle_ai_provider_call_v1(uuid,uuid,text,text,jsonb)'],
    'exactly five accounting functions are executable by an application role, all by service_role');

  stage = 'catalog: nothing seeded - no price, no Credit policy, no balance';
  for (const table of ['ai_price_cards', 'ai_credit_policies', 'ai_credit_ratings']) assert.equal(await count(`SELECT count(*) AS n FROM public.${table}`), 0, `${table} is empty after migration`);
  assert.equal(await count("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname ~ '(credit|balance|allowance|top_?up|wallet)' AND c.relname NOT IN ('ai_credit_policies', 'ai_credit_ratings')"), 0, 'no balance, allowance or top-up table');
  const gate = await one("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ai_credit_policies_activation_gate_check'");
  assert.match(gate.def, /'DRAFT'/u);
  assert.doesNotMatch(gate.def, /ACTIVE/u, 'the activation gate admits DRAFT only');

  stage = 'catalog: no column can carry private content';
  const columns = await rows(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY 1, 2`, [TABLES]);
  for (const c of columns) {
    assert.doesNotMatch(c.column_name, /prompt|response|content|transcript|message|text|body|email|login|public_id|error|raw|payload|statement/u, `${c.table_name}.${c.column_name} names no content`);
    assert.notEqual(c.data_type, 'json', `${c.table_name}.${c.column_name} is not raw JSON`);
    assert.notEqual(c.data_type, 'jsonb', `${c.table_name}.${c.column_name} is not raw JSON`);
  }
  const unboundedText = columns.filter((c) => c.data_type === 'text').map((c) => `${c.table_name}.${c.column_name}`);
  // Every text column is closed by a CHECK: a vocabulary, an identity pattern, a digest or a bounded operator note.
  for (const name of unboundedText) {
    const [table, column] = name.split('.');
    const checked = await count(`SELECT count(*) AS n FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ~ $2`, [`public.${table}`, `\\m${column}\\M`]);
    assert.ok(checked > 0, `${name} is closed by a CHECK constraint`);
  }
  const fk = await one(`SELECT confdeltype, confrelid::regclass::text AS target FROM pg_constraint WHERE conrelid = 'public.ai_provider_calls'::regclass AND contype = 'f'`);
  assert.deepEqual(fk, { confdeltype: 'c', target: 'public.users' }, 'the account link cascades from public.users (erased last by the governed erasure)');
}

// ------------------------------------------------------------------------------------------------------
// 2. Begin.
// ------------------------------------------------------------------------------------------------------
async function verifyBegin() {
  stage = 'begin: intent, replay, conflict, attempts, isolation';
  await q('BEGIN');
  try {
    const alice = await reader();
    const bob = await reader();
    const { session, turn } = await sessionWithTurn(alice);
    const other = await sessionWithTurn(bob);
    const first = await begin({ user: alice, session, turn, family: 'CONVERSATION_REPLY', path: 'DEEP' });
    assert.deepEqual([first.begin_outcome, first.attempt_number], ['BEGUN', 1]);
    const row = await one('SELECT * FROM public.ai_provider_calls WHERE id = $1', [first.call]);
    assert.equal(row.call_state, 'PENDING', 'the intent is PENDING: written before the provider is contacted');
    assert.equal(row.settled_at, null);
    assert.ok(row.started_at instanceof Date, 'the database owns the start instant');
    const replay = await begin({ call: first.call, user: alice, session, turn, family: 'CONVERSATION_REPLY', path: 'DEEP' });
    assert.deepEqual([replay.begin_outcome, replay.attempt_number], ['ALREADY_BEGUN', 1], 'a replayed begin is idempotent');
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_provider_calls WHERE id = $1', [first.call]), 1, 'one row per attempt id');
    await identity('service_role');
    const conflict = await rejected(() => q(BEGIN, [first.call, alice, session, turn, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CONVERSATION_REPLY', 'FAST']), ['PT409']);
    assert.equal(conflict.message, 'AI_PROVIDER_CALL_IDENTITY_CONFLICT');
    await identity('postgres');

    stage = 'begin: a retry that contacts the provider again is its own numbered row';
    const retry = await begin({ user: alice, session, turn, family: 'CONVERSATION_REPLY', path: 'DEEP' });
    assert.deepEqual([retry.begin_outcome, retry.attempt_number], ['BEGUN', 2]);
    assert.notEqual(retry.call, first.call);
    const otherFamily = await begin({ user: alice, session, turn, family: 'FOCUS_RESOLUTION' });
    assert.equal(otherFamily.attempt_number, 1, 'attempts are numbered per work and feature');

    stage = 'begin: refusals before any provider call';
    await identity('service_role');
    const call = (args) => q(BEGIN, args);
    await rejected(() => call([randomUUID(), alice, other.session, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['42501']);
    await rejected(() => call([randomUUID(), alice, null, other.turn, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['42501']);
    await rejected(() => call([randomUUID(), alice, session, other.turn, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['42501']);
    await rejected(() => call([randomUUID(), alice, null, null, 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', 'CU_SEGMENTATION', null]), ['22023']);
    await rejected(() => call([randomUUID(), alice, null, null, 'QWEN', 'q', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['22023']);
    await rejected(() => call([randomUUID(), alice, null, null, 'OPENAI', 'gpt-5-mini', 'GEMINI_GENERATE_CONTENT', 'CU_SEGMENTATION', null]), ['23514']);
    await rejected(() => call([randomUUID(), alice, null, null, 'OPENAI', 'gpt 5 <script>', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['23514']);
    await rejected(() => call([randomUUID(), alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'TELEMETRY', null]), ['23514']);
    await rejected(() => call([randomUUID(), alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CONVERSATION_REPLY', null]), ['23514']);
    await rejected(() => call([randomUUID(), randomUUID(), null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['23503']);
    for (const role of ['anon', 'authenticated']) {
      await identity(role, role === 'authenticated' ? alice : null);
      await rejected(() => call([randomUUID(), alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['42501']);
      await rejected(() => q('SELECT * FROM public.ai_provider_calls'), ['42501']);
    }
    await identity('postgres');
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 3. Settle.
// ------------------------------------------------------------------------------------------------------
async function verifySettle() {
  stage = 'settle: exactly once, replay idempotent, conflicts refused';
  await q('BEGIN');
  try {
    const alice = await reader();
    const bob = await reader();
    const { call } = await begin({ user: alice });
    const settled = await settle(call, alice, 'SUCCEEDED', 'COMPLETE', OPENAI_COMPLETE);
    assert.deepEqual(settled, { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' },
      'reported usage with no Price Card is UNPRICED - never $0');
    const rating = await canonicalRating(call);
    assert.deepEqual([rating.unpriced_reason, rating.total_amount, rating.currency, rating.cost_basis], ['NO_EFFECTIVE_PRICE_CARD', null, null, 'RATED_APPLICATION_COST']);
    const replay = await settle(call, alice, 'SUCCEEDED', 'COMPLETE', { OUTPUT_TOKEN: 250, INPUT_TOKEN: 300, CACHE_WRITE_INPUT_TOKEN: 100, CACHE_READ_INPUT_TOKEN: 600 });
    assert.deepEqual(replay, { settle_outcome: 'ALREADY_SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' }, 'the same settlement (any key order) replays');
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_provider_call_usage WHERE provider_call_id = $1', [call]), 4, 'usage written once');
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_cost_ratings WHERE provider_call_id = $1', [call]), 1, 'rated once');
    await identity('service_role');
    const conflict = await rejected(() => q(SETTLE, [call, alice, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ ...OPENAI_COMPLETE, OUTPUT_TOKEN: 251 })]), ['PT409']);
    assert.equal(conflict.message, 'AI_PROVIDER_CALL_SETTLEMENT_CONFLICT');
    await rejected(() => q(SETTLE, [call, alice, 'FAILED', 'ABSENT', '{}']), ['PT409']);
    await rejected(() => q(SETTLE, [call, bob, 'SUCCEEDED', 'COMPLETE', JSON.stringify(OPENAI_COMPLETE)]), ['42501']);
    await identity('postgres');

    stage = 'settle: unknown stays unknown, failure is never free, cancelled is never rated';
    const failed = (await begin({ user: alice })).call;
    assert.deepEqual(await settle(failed, alice, 'FAILED', 'ABSENT', {}), { settle_outcome: 'SETTLED', call_state: 'FAILED_USAGE_UNKNOWN', rating_state: 'USAGE_UNKNOWN' });
    const silent = (await begin({ user: alice })).call;
    assert.deepEqual(await settle(silent, alice, 'SUCCEEDED', 'ABSENT', {}), { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_UNKNOWN', rating_state: 'USAGE_UNKNOWN' });
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_provider_call_usage WHERE provider_call_id = ANY($1::uuid[])', [[failed, silent]]), 0, 'no zero is written for unknown usage');
    const partial = (await begin({ user: alice })).call;
    assert.deepEqual(await settle(partial, alice, 'SUCCEEDED', 'INCOMPLETE', { CACHE_READ_INPUT_TOKEN: 600, OUTPUT_TOKEN: 5 }),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'USAGE_UNKNOWN' }, 'partial usage is never rated as if the rest were zero');
    const cancelled = (await begin({ user: alice })).call;
    assert.deepEqual(await settle(cancelled, alice, 'CANCELLED_BEFORE_PROVIDER', 'ABSENT', {}), { settle_outcome: 'SETTLED', call_state: 'CANCELLED_BEFORE_PROVIDER', rating_state: null });
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_cost_ratings WHERE provider_call_id = $1', [cancelled]), 0);

    stage = 'settle: malformed settlements are refused';
    await identity('service_role');
    const fresh = async () => { await identity('postgres'); const c = (await begin({ user: alice })).call; await identity('service_role'); return c; };
    for (const [outcome, completeness, usage] of [
      ['SUCCEEDED', 'COMPLETE', { INPUT_TOKEN: 1, OUTPUT_TOKEN: 1 }],
      ['SUCCEEDED', 'COMPLETE', { ...OPENAI_COMPLETE, INPUT_TOKEN: 1.5 }],
      ['SUCCEEDED', 'COMPLETE', { ...OPENAI_COMPLETE, INPUT_TOKEN: -1 }],
      ['SUCCEEDED', 'COMPLETE', { ...OPENAI_COMPLETE, INPUT_TOKEN: '1' }],
      ['SUCCEEDED', 'INCOMPLETE', OPENAI_COMPLETE],
      ['SUCCEEDED', 'INCOMPLETE', { AUDIO_SECOND: 1 }],
      ['SUCCEEDED', 'ABSENT', { OUTPUT_TOKEN: 0 }],
      ['SUCCEEDED', 'INCOMPLETE', {}],
      ['CANCELLED_BEFORE_PROVIDER', 'INCOMPLETE', { OUTPUT_TOKEN: 1 }],
      ['MAYBE', 'ABSENT', {}],
    ]) {
      const target = await fresh();
      await rejected(() => q(SETTLE, [target, alice, outcome, completeness, JSON.stringify(usage)]), ['22023']);
    }
    const arrayTarget = await fresh();
    await rejected(() => q(SETTLE, [arrayTarget, alice, 'SUCCEEDED', 'COMPLETE', '[1]']), ['22023']);
    await identity('postgres');

    stage = 'settle: the state shape is enforced by the table itself';
    await rejected(() => q("INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, usage_completeness, started_at) VALUES ($1, $2, 'OPENAI', 'm', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', 1, 'PENDING', 'COMPLETE', now())", [randomUUID(), alice]), ['23514']);
    await rejected(() => q("INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, usage_completeness, started_at, settled_at, settlement_digest) VALUES ($1, $2, 'OPENAI', 'm', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', 1, 'SUCCEEDED_USAGE_UNKNOWN', 'COMPLETE', now(), now(), repeat('a', 64))", [randomUUID(), alice]), ['23514']);
    await rejected(() => q("UPDATE public.ai_provider_calls SET call_state = 'PENDING', usage_completeness = NULL, settled_at = NULL, settlement_digest = NULL WHERE id = $1", [call]), ['55000']);
    await rejected(() => q("UPDATE public.ai_provider_calls SET user_id = $2 WHERE id = $1", [call, bob]), ['55000']);
    await rejected(() => q('DELETE FROM public.ai_provider_calls WHERE id = $1', [call]), ['55000']);
    await rejected(() => q("UPDATE public.ai_provider_call_usage SET quantity = 0 WHERE provider_call_id = $1", [call]), ['55000']);
    await rejected(() => q('DELETE FROM public.ai_provider_call_usage WHERE provider_call_id = $1', [call]), ['55000']);
    await rejected(() => q("UPDATE public.ai_cost_ratings SET rating_state = 'RATED', currency = 'USD', total_amount = 0, unpriced_reason = NULL WHERE provider_call_id = $1", [call]), ['55000']);
    await rejected(() => q('DELETE FROM public.ai_cost_ratings WHERE provider_call_id = $1', [call]), ['55000']);
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 4 + 5. Price Cards, exact rating, re-rating, and the simulator.
// ------------------------------------------------------------------------------------------------------
function loadSimulator() {
  const path = join(root, 'apps/api/dist/ai-usage/ai-cost-simulation.js');
  // API CI builds apps/api/dist before the database steps; the focused gate installs but does not build, so build here.
  if (!existsSync(path)) execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:api'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  if (!existsSync(path)) throw new Error('apps/api/dist could not be built: npm run build:api');
  return createRequire(import.meta.url)(path);
}

const T0 = '2026-01-01T00:00:00Z';
const T1 = '2026-07-01T00:00:00Z';
const FOUR = { INPUT_TOKEN: 1234, CACHE_READ_INPUT_TOKEN: 5000, CACHE_WRITE_INPUT_TOKEN: 100, OUTPUT_TOKEN: 789 };
const PRICES = { INPUT_TOKEN: '0.15', CACHE_READ_INPUT_TOKEN: '0.015', CACHE_WRITE_INPUT_TOKEN: '0.1875', OUTPUT_TOKEN: '0.6' };

async function verifyRating(simulator) {
  stage = 'price cards: TEST_ONLY isolation and exact per-kind rating';
  await q('BEGIN');
  try {
    const alice = await reader();
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', 'INPUT_TOKEN', 1, 1, 'USD', now(), 'x')"), ['23514']);
    await rejected(() => q("SELECT public.register_ai_price_card_v1('TEST_ONLY', 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'INPUT_TOKEN', 1, 1, 'USD', now(), 'x')"), ['23514']);
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'GEMINI', 'gemini-x', 'GEMINI_GENERATE_CONTENT', 'CACHE_WRITE_INPUT_TOKEN', 1, 1, 'USD', now(), 'x')"), ['23514']);
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'INPUT_TOKEN', 1, 100, 'USD', now(), 'x')"), ['23514']);
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'INPUT_TOKEN', -1, 1, 'USD', now(), 'x')"), ['23514']);
    for (const [kind, price] of Object.entries(PRICES)) await register(kind, price, 1000000, T0);

    const early = await testCall(alice, '2026-06-01T00:00:00Z');
    const result = await settle(early, alice, 'SUCCEEDED', 'COMPLETE', FOUR);
    assert.deepEqual(result, { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'RATED' });
    const rating = await canonicalRating(early);
    assert.equal(canonical(rating.total_amount), '0.00075225', 'exact sub-cent sum of four independently priced kinds');
    assert.equal(rating.currency, 'USD');
    const components = await rows('SELECT usage_kind, quantity::int AS quantity, amount::text AS amount FROM public.ai_cost_rating_components WHERE cost_rating_id = $1 ORDER BY usage_kind', [rating.id]);
    assert.deepEqual(components.map((c) => [c.usage_kind, c.quantity, canonical(c.amount)]), [
      ['CACHE_READ_INPUT_TOKEN', 5000, '0.000075'], ['CACHE_WRITE_INPUT_TOKEN', 100, '0.00001875'], ['INPUT_TOKEN', 1234, '0.0001851'], ['OUTPUT_TOKEN', 789, '0.0004734'],
    ], 'each kind priced on its own; cached tokens are not also charged as uncached input');
    const [{ total }] = await rows('SELECT sum(amount)::text AS total FROM public.ai_cost_rating_components WHERE cost_rating_id = $1', [rating.id]);
    assert.equal(canonical(total), canonical(rating.total_amount), 'components sum exactly to the total');

    stage = 'simulator: equals the database for identical inputs';
    const scenario = {
      scenarioLabel: 'TEST_ONLY verifier fixture', provider: 'TEST_PROVIDER', model: 'test-model', eventAt: '2026-06-01T00:00:00Z',
      usage: { completeness: 'COMPLETE', quantities: FOUR },
      priceCards: Object.entries(PRICES).map(([usageKind, unitPrice]) => ({ usageKind, unitPrice, priceBasisUnits: 1000000, currency: 'USD', effectiveFrom: T0, source: 'TEST_ONLY' })),
    };
    const simulated = simulator.simulateAiCost(scenario);
    assert.equal(simulated.pricingState, 'RATED');
    assert.equal(simulated.ratedCost, canonical(rating.total_amount), 'the simulator reproduces the stored rating digit for digit');
    assert.deepEqual(simulated.components.map((c) => [c.usageKind, c.amount]), components.map((c) => [c.usage_kind, canonical(c.amount)]));

    stage = 'price basis: per 1, per 1 000 and per 1 000 000 are exact';
    for (const [quantity, price, basis] of [[3, '0.5', 1], [1234, '0.002', 1000], [1, '0.15', 1000000], [999999999, '0.000000001', 1000000], [7, '0.123456789', 1000]]) {
      const [{ amount }] = await rows('SELECT public.ai_rated_component_amount_v1($1::bigint, $2::numeric, $3::bigint)::text AS amount', [quantity, price, basis]);
      const fromSimulator = simulator.ratedComponentAmount(quantity, price, basis);
      assert.equal(canonical(amount), `${canonical(formatExactText(fromSimulator))}`, `${quantity} x ${price} / ${basis} agrees exactly`);
    }

    stage = 'price cards: the card effective at the call\'s start, history stable, no overlap';
    await register('OUTPUT_TOKEN', '0.9', 1000000, T1);
    const closed = await one("SELECT effective_to FROM public.ai_price_cards WHERE usage_kind = 'OUTPUT_TOKEN' AND unit_price = 0.6");
    assert.equal(closed.effective_to.toISOString(), new Date(T1).toISOString(), 'a new price closed the previous window at its start');
    assert.equal(canonical((await canonicalRating(early)).total_amount), '0.00075225', 'the earlier call keeps its historical rating after a later price');
    const late = await testCall(alice, T1);
    await settle(late, alice, 'SUCCEEDED', 'COMPLETE', FOUR);
    assert.equal(canonical((await canonicalRating(late)).total_amount), '0.00098895', 'a call starting at the new window takes the new price');
    const beforeAny = await testCall(alice, '2025-06-01T00:00:00Z');
    assert.equal((await settle(beforeAny, alice, 'SUCCEEDED', 'COMPLETE', FOUR)).rating_state, 'UNPRICED', 'before any window there is no price - never today\'s');
    await rejected(() => q(`INSERT INTO public.ai_price_cards (card_class, provider, model, operation, usage_kind, unit_price, price_basis_units, currency, effective_from, effective_to, source_reference)
      VALUES ('TEST_ONLY', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', 'INPUT_TOKEN', 9, 1000000, 'USD', '2026-03-01', '2026-04-01', 'overlap')`), ['23P01']);
    await rejected(() => register('INPUT_TOKEN', '9', 1000000, '2025-12-01T00:00:00Z'), ['23P01']);

    stage = 'price cards: immutable once used; a window closes only where no rated event falls outside it';
    const used = (await one("SELECT id FROM public.ai_price_cards WHERE usage_kind = 'INPUT_TOKEN'")).id;
    await rejected(() => q('UPDATE public.ai_price_cards SET unit_price = 0 WHERE id = $1', [used]), ['55000']);
    await rejected(() => q('DELETE FROM public.ai_price_cards WHERE id = $1', [used]), ['23503']);
    await rejected(() => q("UPDATE public.ai_price_cards SET effective_to = '2026-05-01' WHERE id = $1", [used]), ['55000']);
    await rejected(() => register('INPUT_TOKEN', '0.2', 1000000, '2026-05-01T00:00:00Z'), ['55000']);
    await register('INPUT_TOKEN', '0.2', 1000000, '2026-08-01T00:00:00Z');

    stage = 're-rating: explicit, versioned, the old version kept';
    const backfill = await one(`INSERT INTO public.ai_price_cards (card_class, provider, model, operation, usage_kind, unit_price, price_basis_units, currency, effective_from, effective_to, source_reference)
      SELECT 'TEST_ONLY', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', k, p, 1000000, 'USD', '2025-01-01', $1::timestamptz, 'TEST_ONLY backfill'
        FROM (VALUES ('INPUT_TOKEN', 1::numeric), ('CACHE_READ_INPUT_TOKEN', 0.1), ('CACHE_WRITE_INPUT_TOKEN', 1.25), ('OUTPUT_TOKEN', 4)) v(k, p) RETURNING 1 AS ok`, [T0]);
    assert.ok(backfill);
    assert.equal((await canonicalRating(beforeAny)).rating_state, 'UNPRICED', 'adding a price never silently rewrites an existing rating');
    await identity('service_role');
    await rejected(() => q("SELECT public.rerate_ai_provider_call_v1($1, 'EXPLICIT_RERATE_PRICE_CARD_BACKFILL')", [beforeAny]), ['42501']);
    await identity('postgres');
    await rejected(() => q("SELECT public.rerate_ai_provider_call_v1($1, 'BECAUSE')", [beforeAny]), ['22023']);
    assert.equal((await one("SELECT public.rerate_ai_provider_call_v1($1, 'EXPLICIT_RERATE_PRICE_CARD_BACKFILL') AS s", [beforeAny])).s, 'RATED');
    const versions = await rows('SELECT rating_version, rating_state, is_canonical, canonical_reason FROM public.ai_cost_ratings WHERE provider_call_id = $1 ORDER BY rating_version', [beforeAny]);
    assert.deepEqual(versions, [
      { rating_version: 1, rating_state: 'UNPRICED', is_canonical: false, canonical_reason: 'INITIAL_SETTLEMENT' },
      { rating_version: 2, rating_state: 'RATED', is_canonical: true, canonical_reason: 'EXPLICIT_RERATE_PRICE_CARD_BACKFILL' },
    ]);
    assert.equal(canonical((await canonicalRating(beforeAny)).total_amount), '0.005015', 'the backfill window rated it exactly');
    await rejected(() => q('UPDATE public.ai_cost_ratings SET is_canonical = true WHERE provider_call_id = $1 AND rating_version = 1', [beforeAny]), ['55000']);
    const stillPending = (await begin({ user: alice })).call;
    await rejected(() => q("SELECT public.rerate_ai_provider_call_v1($1, 'EXPLICIT_RERATE_PRICE_CARD_CORRECTION')", [stillPending]), ['55000']);

    stage = 'rating: mixed currencies are UNPRICED, never summed';
    await q("SELECT public.register_ai_price_card_v1('TEST_ONLY', 'TEST_PROVIDER', 'test-eur', 'TEST_OPERATION', k, 1, 1, c, '2026-01-01', 'TEST_ONLY') FROM (VALUES ('INPUT_TOKEN', 'USD'), ('CACHE_READ_INPUT_TOKEN', 'USD'), ('CACHE_WRITE_INPUT_TOKEN', 'USD'), ('OUTPUT_TOKEN', 'EUR')) v(k, c)");
    const mixed = randomUUID();
    await q(`INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
             VALUES ($1, $2, 'TEST_PROVIDER', 'test-eur', 'TEST_OPERATION', 'CU_SEGMENTATION', 1, 'PENDING', '2026-06-01')`, [mixed, alice]);
    await settle(mixed, alice, 'SUCCEEDED', 'COMPLETE', FOUR);
    const mixedRating = await canonicalRating(mixed);
    assert.deepEqual([mixedRating.rating_state, mixedRating.unpriced_reason, mixedRating.total_amount], ['UNPRICED', 'MIXED_CURRENCY', null]);
  } finally {
    await q('ROLLBACK');
  }
}

/** The simulator's exact decimal, formatted the way its own module does (units x 10^-scale). */
function formatExactText(value) {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.scale + 1, '0');
  const whole = digits.slice(0, digits.length - value.scale);
  const fraction = digits.slice(digits.length - value.scale);
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

// ------------------------------------------------------------------------------------------------------
// 6. Credits.
// ------------------------------------------------------------------------------------------------------
async function verifyCredits(simulator) {
  stage = 'credits: not activated, the gate holds, no Credit rating can exist';
  await q('BEGIN');
  try {
    await identity('service_role');
    assert.equal((await one('SELECT public.server_read_ai_credit_policy_state_v1() AS s')).s, 'CREDIT_POLICY_NOT_ACTIVATED');
    await identity('postgres');
    const insertPolicy = (lifecycle) => q(`INSERT INTO public.ai_credit_policies (policy_key, policy_version, lifecycle, formula_kind, cost_currency, credits_per_cost_unit, credit_scale, rounding_mode, effective_from)
      VALUES ('test_policy', $1::integer, $2::text, 'RATED_COST_LINEAR_V1', 'USD', 1000, 2, 'CEILING', now()) RETURNING id`, [lifecycle === 'ACTIVE' ? 2 : 1, lifecycle]);
    await rejected(() => insertPolicy('ACTIVE'), ['23514']);
    const draft = (await insertPolicy('DRAFT')).rows[0].id;
    await identity('service_role');
    assert.equal((await one('SELECT public.server_read_ai_credit_policy_state_v1() AS s')).s, 'CREDIT_POLICY_NOT_ACTIVATED', 'a DRAFT policy activates nothing');
    await identity('postgres');
    await rejected(() => q("UPDATE public.ai_credit_policies SET lifecycle = 'ACTIVE' WHERE id = $1", [draft]), ['55000', '23514']);
    await rejected(() => q('UPDATE public.ai_credit_policies SET credits_per_cost_unit = 1 WHERE id = $1', [draft]), ['55000']);

    const alice = await reader();
    const call = await testCall(alice, '2026-06-01');
    await q("INSERT INTO public.ai_price_cards (card_class, provider, model, operation, usage_kind, unit_price, price_basis_units, currency, effective_from, source_reference) SELECT 'TEST_ONLY', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', k, 1, 1, 'USD', '2026-01-01', 'TEST_ONLY' FROM unnest(ARRAY['INPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'OUTPUT_TOKEN']) k");
    await settle(call, alice, 'SUCCEEDED', 'COMPLETE', FOUR);
    const rating = await canonicalRating(call);
    const credit = await rejected(() => q('INSERT INTO public.ai_credit_ratings (cost_rating_id, credit_policy_id, credits) VALUES ($1, $2, 1)', [rating.id, draft]), ['55000']);
    assert.equal(credit.message, 'CREDIT_POLICY_NOT_ACTIVATED', 'no Credit is rated, and nothing can be debited, before a Product-authorized activation');

    stage = 'credits: the formula function equals the simulator\'s';
    for (const [amount, rate, scale, mode] of [['0.00075225', '1000', 2, 'CEILING'], ['0.00075225', '1000', 2, 'HALF_UP'], ['0.00075225', '1000', 2, 'FLOOR'],
      ['0.00075225', '1000', 0, 'CEILING'], ['2', '1000', 3, 'CEILING'], ['1.005', '1', 2, 'HALF_UP'], ['0', '7.5', 4, 'CEILING']]) {
      const [{ credits }] = await rows('SELECT public.ai_credits_for_rated_cost_v1($1::numeric, $2::numeric, $3::integer, $4::text)::text AS credits', [amount, rate, scale, mode]);
      const simulated = simulator.creditsForRatedCost(amount, { policyKey: 'p', policyVersion: 1, costCurrency: 'USD', creditsPerCostUnit: rate, creditScale: scale, roundingMode: mode });
      assert.equal(canonical(credits), canonical(simulated), `${amount} x ${rate} at ${scale} ${mode}`);
    }
    await rejected(() => q("SELECT public.ai_credits_for_rated_cost_v1(1, 0, 2, 'CEILING')"), ['22023']);
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 7. Operational summary and attribution aggregate.
// ------------------------------------------------------------------------------------------------------
const SUMMARY_COLUMNS = ['pending_calls', 'stale_pending_calls', 'stale_pending_oldest_age_seconds', 'settled_calls_24h', 'failed_calls_24h',
  'cancelled_calls_24h', 'usage_unknown_calls_24h', 'rated_calls_24h', 'unpriced_calls_24h'];

async function summaryNow() {
  await identity('service_role');
  const answer = await rows('SELECT * FROM public.server_read_ai_usage_operations_summary_v1()');
  await identity('postgres');
  assert.equal(answer.length, 1);
  assert.deepEqual(Object.keys(answer[0]), SUMMARY_COLUMNS, 'numbers only: no identity of any kind');
  return Object.fromEntries(Object.entries(answer[0]).map(([key, value]) => [key, Number(value)]));
}

async function verifyOperations() {
  stage = 'operations: a stale PENDING (a crash between begin and settle) is visible, and unknown / unpriced are counted';
  await q('BEGIN');
  try {
    const before = await summaryNow();
    const alice = await reader();
    await q(`INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
             VALUES ($1, $2, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', 1, 'PENDING', now() - interval '10 minutes')`, [randomUUID(), alice]);
    await begin({ user: alice });
    const unpriced = (await begin({ user: alice })).call;
    await settle(unpriced, alice, 'SUCCEEDED', 'COMPLETE', OPENAI_COMPLETE);
    const unknown = (await begin({ user: alice })).call;
    await settle(unknown, alice, 'FAILED', 'ABSENT', {});
    const after = await summaryNow();
    const delta = Object.fromEntries(SUMMARY_COLUMNS.filter((c) => !c.endsWith('_seconds')).map((c) => [c, after[c] - before[c]]));
    assert.deepEqual(delta, { pending_calls: 2, stale_pending_calls: 1, settled_calls_24h: 2, failed_calls_24h: 1, cancelled_calls_24h: 0, usage_unknown_calls_24h: 1, rated_calls_24h: 0, unpriced_calls_24h: 1 },
      'a fresh PENDING is not stale; the ten-minute one is; the unknown and the unpriced call are each counted - never as zero cost');
    assert.ok(after.stale_pending_oldest_age_seconds >= 595, 'the stale age is reported');
    for (const role of ['anon', 'authenticated']) {
      await identity(role, role === 'authenticated' ? alice : null);
      await rejected(() => q('SELECT * FROM public.server_read_ai_usage_operations_summary_v1()'), ['42501']);
      await rejected(() => q("SELECT * FROM public.server_read_ai_cost_aggregates_v1(now() - interval '1 day', now())"), ['42501']);
      await rejected(() => q('SELECT public.server_read_ai_credit_policy_state_v1()'), ['42501']);
    }
    await identity('postgres');

    stage = 'attribution: aggregates by day / provider / model / feature / path / state with no account identity';
    await identity('service_role');
    const aggregates = await rows("SELECT * FROM public.server_read_ai_cost_aggregates_v1(now() - interval '1 day', now() + interval '1 minute')");
    await rejected(() => q("SELECT * FROM public.server_read_ai_cost_aggregates_v1(now(), now() - interval '1 day')"), ['22023']);
    await rejected(() => q("SELECT * FROM public.server_read_ai_cost_aggregates_v1(now() - interval '200 days', now())"), ['22023']);
    await identity('postgres');
    assert.ok(aggregates.length > 0);
    assert.deepEqual(Object.keys(aggregates[0]), ['usage_day', 'provider', 'requested_model', 'feature_family', 'processing_path', 'call_state', 'rating_state', 'currency',
      'calls', 'input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_write_input_tokens', 'rated_total_amount']);
    assert.doesNotMatch(JSON.stringify(aggregates), new RegExp(alice, 'u'), 'no account identity in the aggregate');
    const unpricedRow = aggregates.find((a) => a.call_state === 'SUCCEEDED_USAGE_REPORTED' && a.rating_state === 'UNPRICED');
    assert.ok(unpricedRow && Number(unpricedRow.input_tokens) >= 300, 'reported quantities aggregate');
    assert.ok(aggregates.some((a) => a.call_state === 'PENDING' && a.rating_state === 'PENDING'), 'a pending call is PENDING, not zero');
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 8. Account deletion.
// ------------------------------------------------------------------------------------------------------
async function verifyErasure() {
  stage = 'erasure: the governed Personal erasure removes every accounting row of the account and nothing of another';
  await q('BEGIN');
  try {
    const alice = await reader();
    const bob = await reader();
    for (const user of [alice, bob]) {
      const priced = await testCall(user, '2026-06-01');
      void priced;
      const { call } = await begin({ user });
      await settle(call, user, 'SUCCEEDED', 'COMPLETE', OPENAI_COMPLETE);
      await begin({ user });
    }
    await q("INSERT INTO public.ai_price_cards (card_class, provider, model, operation, usage_kind, unit_price, price_basis_units, currency, effective_from, source_reference) SELECT 'TEST_ONLY', 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', k, 1, 1, 'USD', '2026-01-01', 'TEST_ONLY' FROM unnest(ARRAY['INPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'OUTPUT_TOKEN']) k");
    const aliceTest = (await one("SELECT id FROM public.ai_provider_calls WHERE user_id = $1 AND provider = 'TEST_PROVIDER'", [alice])).id;
    await settle(aliceTest, alice, 'SUCCEEDED', 'COMPLETE', FOUR);
    const footprint = async (user) => Number((await one(`SELECT
        (SELECT count(*) FROM public.ai_provider_calls c WHERE c.user_id = $1)
      + (SELECT count(*) FROM public.ai_provider_call_usage u JOIN public.ai_provider_calls c ON c.id = u.provider_call_id WHERE c.user_id = $1)
      + (SELECT count(*) FROM public.ai_cost_ratings r JOIN public.ai_provider_calls c ON c.id = r.provider_call_id WHERE c.user_id = $1) AS n`, [user])).n);
    const bobBefore = await footprint(bob);
    assert.ok(await footprint(alice) > 0 && bobBefore > 0);
    const deletionId = randomUUID();
    await q(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, alice, randomUUID()]);
    await identity('service_role');
    assert.equal((await one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId])).outcome, 'ERASED');
    await identity('postgres');
    assert.equal(await footprint(alice), 0, 'no call, usage or rating of the erased account remains');
    assert.equal(await count(`SELECT count(*) AS n FROM public.ai_cost_rating_components x WHERE NOT EXISTS (SELECT 1 FROM public.ai_cost_ratings r WHERE r.id = x.cost_rating_id)`), 0, 'no orphan component');
    assert.equal(await footprint(bob), bobBefore, 'another account is untouched');
    assert.equal(await count("SELECT count(*) AS n FROM public.ai_price_cards WHERE provider = 'TEST_PROVIDER'"), 4, 'price cards are not personal data and stay');
    await identity('service_role');
    await rejected(() => q(BEGIN, [randomUUID(), alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]), ['23503']);
    await identity('postgres');
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------------------------------------------
// 9. Committed races.
// ------------------------------------------------------------------------------------------------------
async function connectAs(role) {
  const connection = new Client({ connectionString: databaseUrl });
  await connection.connect();
  await connection.query("SET lock_timeout = '10s'");
  await connection.query(`SET ROLE ${role}`);
  return connection;
}
const blockedFor = (pending, ms = 750) => Promise.race([pending.then(() => 'COMPLETED', () => 'COMPLETED'), new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), ms))]);
const settled = (pending) => pending.then((r) => r.rows[0].settle_outcome ?? r.rows[0].begin_outcome, (error) => error.code);

async function verifyCommittedRaces() {
  stage = 'committed races: fixtures';
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const connections = [];
  const sessions = [];
  try {
    for (const user of users) await q('INSERT INTO auth.users (id) VALUES ($1)', [user]);
    const [alice, bob, carol] = users;
    const fixture = await sessionWithTurn(alice);
    sessions.push(fixture.session);
    const service = async () => { const c = await connectAs('service_role'); connections.push(c); return c; };
    const a = await service(); const b = await service(); const c = await service(); const d = await service();

    stage = 'committed race: concurrent identical settlements converge on one';
    const call = randomUUID();
    await a.query(BEGIN, [call, alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]);
    const usage = JSON.stringify(OPENAI_COMPLETE);
    const outcomes = await Promise.all([a, b, c, d].map((connection) => settled(connection.query(SETTLE, [call, alice, 'SUCCEEDED', 'COMPLETE', usage]))));
    assert.deepEqual(outcomes.sort(), ['ALREADY_SETTLED', 'ALREADY_SETTLED', 'ALREADY_SETTLED', 'SETTLED']);
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_provider_call_usage WHERE provider_call_id = $1', [call]), 4);
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_cost_ratings WHERE provider_call_id = $1', [call]), 1);

    stage = 'committed race: conflicting settlements - exactly one wins, the other is refused';
    const contested = randomUUID();
    await a.query(BEGIN, [contested, alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]);
    const contest = await Promise.all([
      settled(a.query(SETTLE, [contested, alice, 'SUCCEEDED', 'COMPLETE', usage])),
      settled(b.query(SETTLE, [contested, alice, 'FAILED', 'ABSENT', '{}'])),
    ]);
    assert.deepEqual(contest.filter((o) => o === 'SETTLED').length, 1, `one settlement wins (${contest.join(',')})`);
    assert.deepEqual(contest.filter((o) => o === 'PT409').length, 1, 'the other is a typed conflict, never a second row');

    stage = 'committed race: concurrent begins of one attempt id converge';
    const same = randomUUID();
    const begins = await Promise.all([a, b, c].map((connection) => settled(connection.query(BEGIN, [same, alice, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]))));
    assert.deepEqual(begins.sort(), ['ALREADY_BEGUN', 'ALREADY_BEGUN', 'BEGUN']);

    stage = 'committed race: one account\'s concurrent attempts are numbered without gaps or duplicates';
    const attempts = await Promise.all([a, b, c, d].map((connection) => connection.query(BEGIN,
      [randomUUID(), alice, fixture.session, fixture.turn, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CONVERSATION_REPLY', 'FAST']).then((r) => r.rows[0].attempt_number)));
    assert.deepEqual(attempts.sort(), [1, 2, 3, 4], 'four attempts, four rows, numbered once each');

    stage = 'committed race: two accounts never wait on each other; one account serializes';
    await a.query('BEGIN');
    await a.query(BEGIN, [randomUUID(), bob, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]);
    const otherAccount = b.query(BEGIN, [randomUUID(), carol, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]);
    assert.equal(await blockedFor(otherAccount), 'COMPLETED', 'another account is not blocked by an open begin');
    const sameAccount = c.query(BEGIN, [randomUUID(), bob, null, null, 'OPENAI', 'gpt-5-mini', 'OPENAI_RESPONSES_CREATE', 'CU_SEGMENTATION', null]);
    assert.equal(await blockedFor(sameAccount), 'BLOCKED', 'the same account\'s begin waits for the open one');
    await a.query('COMMIT');
    assert.equal((await sameAccount).rows[0].begin_outcome, 'BEGUN', 'and proceeds once it commits - no deadlock');

    stage = 'committed race: a price window never closes under a rating being written';
    await q(`INSERT INTO public.ai_price_cards (card_class, provider, model, operation, usage_kind, unit_price, price_basis_units, currency, effective_from, source_reference)
             SELECT 'TEST_ONLY', 'TEST_PROVIDER', 'race-model', 'TEST_OPERATION', k, 1, 1000000, 'USD', '2026-01-01', 'TEST_ONLY race fixture'
               FROM unnest(ARRAY['INPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'OUTPUT_TOKEN']) k`);
    const raceCall = randomUUID();
    await q(`INSERT INTO public.ai_provider_calls (id, user_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
             VALUES ($1, $2, 'TEST_PROVIDER', 'race-model', 'TEST_OPERATION', 'CU_SEGMENTATION', 1, 'PENDING', '2026-06-01')`, [raceCall, alice]);
    const owner = new Client({ connectionString: databaseUrl });
    await owner.connect();
    connections.push(owner);
    await owner.query("SET lock_timeout = '10s'");
    await a.query('BEGIN');
    await a.query(SETTLE, [raceCall, alice, 'SUCCEEDED', 'COMPLETE', JSON.stringify(FOUR)]);
    const closing = owner.query("SELECT public.register_ai_price_card_v1('TEST_ONLY', 'TEST_PROVIDER', 'race-model', 'TEST_OPERATION', 'INPUT_TOKEN', 9, 1000000, 'USD', '2026-03-01', 'TEST_ONLY race')");
    assert.equal(await blockedFor(closing), 'BLOCKED', 'closing the window waits for the rating being written against it');
    await a.query('COMMIT');
    const closed = await closing.then(() => 'CLOSED', (error) => error.code);
    assert.equal(closed, '55000', 'and is then refused: the committed rating falls inside the window it would have cut');
    assert.equal(await count("SELECT count(*) AS n FROM public.ai_price_cards WHERE model = 'race-model' AND effective_to IS NOT NULL"), 0, 'no window was closed');
  } finally {
    for (const connection of connections) await connection.end().catch(() => undefined);
    // The accounting rows are append-only by design; the fixture owner removes them, then the fixture accounts, with
    // triggers off (as the 0039 / 0064 / 0065 / 0131 teardowns do).
    await q("SET session_replication_role = 'replica'");
    try {
      await q('DELETE FROM public.ai_cost_rating_components WHERE cost_rating_id IN (SELECT r.id FROM public.ai_cost_ratings r JOIN public.ai_provider_calls c ON c.id = r.provider_call_id WHERE c.user_id = ANY($1::uuid[]))', [users]);
      await q('DELETE FROM public.ai_cost_ratings WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [users]);
      await q('DELETE FROM public.ai_provider_call_usage WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [users]);
      await q('DELETE FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [users]);
      await q("DELETE FROM public.ai_price_cards WHERE model = 'race-model'");
      await q('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM public.conversation_turns WHERE user_id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM public.session_historical_baselines WHERE session_id = ANY($1::uuid[])', [sessions]);
      await q('DELETE FROM public.session_historical_coverage WHERE session_id = ANY($1::uuid[])', [sessions]);
      await q('DELETE FROM public.historical_world_semantic_clocks WHERE user_id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM public.session_semantic_clocks WHERE session_id = ANY($1::uuid[])', [sessions]);
      await q('DELETE FROM public.conversation_sessions WHERE id = ANY($1::uuid[])', [sessions]);
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [users]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await q("SET session_replication_role = 'origin'");
    }
    assert.equal(await count('SELECT count(*) AS n FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [users]), 0, 'race fixtures removed');
  }
}

async function main() {
  await client.connect();
  try {
    await q("SET search_path = ''");
    await verifyCatalog();
    await verifyBegin();
    await verifySettle();
    const simulator = loadSimulator();
    await verifyRating(simulator);
    await verifyCredits(simulator);
    await verifyOperations();
    await verifyErasure();
    await verifyCommittedRaces();
    console.log('Verified migration 0135: every provider attempt is one durable PENDING intent before the call and exactly one idempotent settlement after it; unknown usage, failures and missing prices stay USAGE_UNKNOWN / UNPRICED and are never zero; each normalized kind is rated exactly by the Price Card effective at the call\'s start, history is stable and re-rating is explicit and versioned; the simulator equals the database digit for digit; Credits are CREDIT_POLICY_NOT_ACTIVATED and no Credit can be rated; the ledger is reachable only through five service-role functions, carries no content and leaves no row of an erased account; concurrent settlements converge and two accounts never wait on each other.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration 0135 verification failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
