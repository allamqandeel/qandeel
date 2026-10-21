// S8A-01 - verifies migration 0170 (DeepSeek admission to the AI-COST-01 ledger) against real PostgreSQL.
//
// It proves, on a database migrated through 0170: the three replaced functions keep their 0135 posture (signature,
// SECURITY, empty search_path, owner postgres) and the executable surface stays exactly the five service-role
// functions; DEEPSEEK is admitted with exactly its operation and its three-kind partition while every 0135 provider
// keeps its own; an unlisted provider now answers an empty partition and fails closed; begin admits DEEPSEEK and still
// refuses the TEST_PROVIDER and unknown names; a DeepSeek settlement is COMPLETE only with exactly its three kinds and
// is UNPRICED without a Price Card; and a reviewed DeepSeek Price Card rates its usage exactly. Every fixture is
// written inside one transaction that is rolled back.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
const q = (text, values = []) => client.query(text, values);
const one = async (text, values = []) => (await q(text, values)).rows[0];

async function identity(role) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
}
async function rejected(operation, codes) {
  await q('SAVEPOINT expected_refusal');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT expected_refusal');
    await q('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(error, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(error.code), `expected one of ${codes.join(', ')}, got ${error.code} (${error.message})`);
}

const BEGIN = 'SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
const SETTLE = 'SELECT * FROM public.settle_ai_provider_call_v1($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb)';
const DEEPSEEK = ['DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CONVERSATION_REPLY'];
const DEEPSEEK_COMPLETE = { INPUT_TOKEN: 360, CACHE_READ_INPUT_TOKEN: 640, OUTPUT_TOKEN: 300 };
const REPLACED = [
  ['public.ai_provider_operation_is_known_v1(text,text)', false],
  ['public.ai_complete_usage_kinds_v1(text)', false],
  ['public.begin_ai_provider_call_v1(uuid,uuid,uuid,uuid,text,text,text,text,text)', true],
];

async function begin(user, fields = DEEPSEEK, path = 'FAST') {
  const call = randomUUID();
  await identity('service_role');
  const row = await one(BEGIN, [call, user, null, null, ...fields, path]);
  await identity('postgres');
  return { call, row };
}
async function settle(call, user, outcome, completeness, usage) {
  await identity('service_role');
  const row = await one(SETTLE, [call, user, outcome, completeness, JSON.stringify(usage)]);
  await identity('postgres');
  return row;
}

async function verify() {
  stage = 'catalog: the replaced functions keep the 0135 posture';
  for (const [signature, definer] of REPLACED) {
    const fn = await one(`SELECT p.prosecdef AS definer, p.proconfig::text[] AS config, pg_get_userbyid(p.proowner) AS owner, p.provolatile AS volatility
      FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [signature]);
    assert.ok(fn, `${signature} exists`);
    assert.equal(fn.definer, definer, `${signature} keeps its SECURITY posture`);
    assert.deepEqual(fn.config, ['search_path=""'], `${signature} pins an empty search_path`);
    assert.equal(fn.owner, 'postgres', `${signature} is owned by postgres`);
    assert.equal(fn.volatility, definer ? 'v' : 'i', `${signature} keeps its volatility`);
  }
  const reachable = (await q(`SELECT r AS role, p.oid::regprocedure::text AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
     WHERE n.nspname = 'public' AND (p.proname LIKE 'ai\\_%' OR p.proname LIKE '%\\_ai\\_%') AND has_function_privilege(r, p.oid, 'EXECUTE')`)).rows;
  assert.deepEqual(reachable.map((r) => `${r.role}:${r.fn}`).sort(), [
    'service_role:public.begin_ai_provider_call_v1(uuid,uuid,uuid,uuid,text,text,text,text,text)',
    'service_role:public.server_read_ai_cost_aggregates_v1(timestamp with time zone,timestamp with time zone)',
    'service_role:public.server_read_ai_credit_policy_state_v1()',
    'service_role:public.server_read_ai_usage_operations_summary_v1()',
    'service_role:public.settle_ai_provider_call_v1(uuid,uuid,text,text,jsonb)',
  ], 'the executable surface is still exactly the five service-role functions');

  stage = 'registries: DEEPSEEK admitted with its own operation and partition; every 0135 provider unchanged';
  const known = async (provider, operation) => (await one('SELECT public.ai_provider_operation_is_known_v1($1, $2) AS ok', [provider, operation])).ok;
  const kinds = async (provider) => (await one('SELECT public.ai_complete_usage_kinds_v1($1) AS k', [provider])).k;
  assert.equal(await known('DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'), true);
  for (const operation of ['OPENAI_RESPONSES_CREATE', 'ANTHROPIC_MESSAGES_CREATE', 'GEMINI_GENERATE_CONTENT', 'TEST_OPERATION']) {
    assert.equal(await known('DEEPSEEK', operation), false, `DEEPSEEK cannot claim ${operation}`);
  }
  for (const [provider, operation] of [['OPENAI', 'OPENAI_RESPONSES_CREATE'], ['ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'], ['GEMINI', 'GEMINI_GENERATE_CONTENT'], ['TEST_PROVIDER', 'TEST_OPERATION']]) {
    assert.equal(await known(provider, operation), true, `${provider} keeps ${operation}`);
  }
  assert.equal(await known('OPENAI', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'), false);
  assert.deepEqual(await kinds('DEEPSEEK'), ['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']);
  assert.deepEqual(await kinds('OPENAI'), ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']);
  assert.deepEqual(await kinds('ANTHROPIC'), ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']);
  assert.deepEqual(await kinds('GEMINI'), ['CACHE_READ_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']);
  assert.deepEqual(await kinds('TEST_PROVIDER'), ['CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN', 'INPUT_TOKEN', 'OUTPUT_TOKEN']);
  assert.deepEqual(await kinds('QWEN'), [], 'an unlisted provider has an EMPTY partition, never NULL');

  await q('BEGIN');
  try {
    const user = randomUUID();
    await q('INSERT INTO auth.users (id) VALUES ($1)', [user]);

    stage = 'begin: DEEPSEEK is admitted; the TEST_PROVIDER, unknown names and a wrong operation are still refused';
    const first = await begin(user);
    assert.deepEqual([first.row.begin_outcome, first.row.attempt_number], ['BEGUN', 1]);
    const row = await one('SELECT provider, requested_model, operation, feature_family, processing_path, call_state FROM public.ai_provider_calls WHERE id = $1', [first.call]);
    assert.deepEqual(row, { provider: 'DEEPSEEK', requested_model: 'deepseek-flash', operation: 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', feature_family: 'CONVERSATION_REPLY', processing_path: 'FAST', call_state: 'PENDING' },
      'the intent is PENDING before the provider is contacted');
    await identity('service_role');
    await rejected(() => q(BEGIN, [randomUUID(), user, null, null, 'TEST_PROVIDER', 'test-model', 'TEST_OPERATION', 'CONVERSATION_REPLY', null]), ['22023']);
    await rejected(() => q(BEGIN, [randomUUID(), user, null, null, 'QWEN', 'qwen', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CONVERSATION_REPLY', null]), ['22023']);
    await rejected(() => q(BEGIN, [randomUUID(), user, null, null, 'DEEPSEEK', 'deepseek-flash', 'OPENAI_RESPONSES_CREATE', 'CONVERSATION_REPLY', null]), ['23514']);
    for (const role of ['anon', 'authenticated']) {
      await identity(role);
      await rejected(() => q(BEGIN, [randomUUID(), user, null, null, ...DEEPSEEK, null]), ['42501']);
    }
    await identity('postgres');

    stage = 'settle: a DeepSeek usage is COMPLETE with exactly its three kinds, and UNPRICED without a Price Card';
    assert.deepEqual(await settle(first.call, user, 'SUCCEEDED', 'COMPLETE', DEEPSEEK_COMPLETE),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' }, 'no Price Card is UNPRICED - never $0');
    for (const usage of [{ ...DEEPSEEK_COMPLETE, CACHE_WRITE_INPUT_TOKEN: 1 }, { INPUT_TOKEN: 360, OUTPUT_TOKEN: 300 }]) {
      const { call } = await begin(user);
      await identity('service_role');
      await rejected(() => q(SETTLE, [call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify(usage)]), ['22023']);
      await identity('postgres');
    }
    const partial = await begin(user, DEEPSEEK, 'DEEP');
    assert.deepEqual(await settle(partial.call, user, 'SUCCEEDED', 'INCOMPLETE', { OUTPUT_TOKEN: 300 }),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'USAGE_UNKNOWN' }, 'partial usage is never rated');
    const failed = await begin(user);
    assert.deepEqual(await settle(failed.call, user, 'FAILED', 'ABSENT', {}),
      { settle_outcome: 'SETTLED', call_state: 'FAILED_USAGE_UNKNOWN', rating_state: 'USAGE_UNKNOWN' }, 'a failure is never free');

    stage = 'fail-closed: an unlisted provider, or a kind outside the DeepSeek partition, cannot carry a Price Card';
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'QWEN', 'qwen', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'INPUT_TOKEN', 1, 1000000, 'USD', now(), 'x')"), ['23514']);
    await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CACHE_WRITE_INPUT_TOKEN', 1, 1000000, 'USD', now(), 'x')"), ['23514']);

    stage = 'rating: a reviewed DeepSeek Price Card rates the three kinds exactly (fixture rolled back)';
    const from = new Date(Date.now() - 60_000).toISOString();
    for (const [kind, price] of [['INPUT_TOKEN', '0.30'], ['CACHE_READ_INPUT_TOKEN', '0.006'], ['OUTPUT_TOKEN', '1.20']]) {
      await q("SELECT public.register_ai_price_card_v1('PRODUCTION', 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', $1::text, $2::numeric, 1000000, 'USD', $3::timestamptz, 'S8A-01 verifier fixture')", [kind, price, from]);
    }
    const priced = await begin(user);
    assert.deepEqual(await settle(priced.call, user, 'SUCCEEDED', 'COMPLETE', DEEPSEEK_COMPLETE),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'RATED' });
    const rating = await one('SELECT currency, total_amount::text AS total FROM public.ai_cost_ratings WHERE provider_call_id = $1 AND is_canonical', [priced.call]);
    // 360 x 0.30 + 640 x 0.006 + 300 x 1.20, per million tokens.
    assert.equal(rating.currency, 'USD');
    assert.match(rating.total, /^0\.000471840*$/u, 'exact numeric: 0.00047184 USD');
  } finally {
    await q('ROLLBACK');
  }
}

async function main() {
  await client.connect();
  try {
    await q("SET search_path = ''");
    await verify();
    console.log('Verified migration 0170: DEEPSEEK is admitted to the AI-COST-01 ledger with exactly its operation and its three-kind partition, every 0135 provider is unchanged, an unlisted provider fails closed, begin still refuses the TEST_PROVIDER and unknown names, a DeepSeek settlement is COMPLETE only with its three kinds and is UNPRICED until a reviewed Price Card rates it exactly, and the executable surface is still the five service-role functions.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration 0170 verification failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
