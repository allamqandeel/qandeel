// S8B-02 CP1 - verifies migration 0184 (AI-COST-01 / VA-5 as amended: the voice providers, operations, billable units,
// families and the source of a usage quantity) against real PostgreSQL. Acceptance A12 of the S8B-02 Implementation
// Task Contract v1.0 FINAL.
//
// It proves, on a database migrated through 0184:
//   1. posture: the six new functions are owned by postgres with an empty search_path; the four API functions are
//      service_role alone and the partition and the trigger function are nobody's; begin v1 / v2, settle v1, the v1
//      summary, the v1 aggregates, the v1 partition, the rater and the call guard are byte-identical to the migration
//      that last defined them;
//   2. partitions: every pair 0170 knew keeps exactly its v1 partition; Speechmatics is [AUDIO_INPUT_MS], Gemini speech
//      is [AUDIO_OUTPUT_TOKEN, INPUT_TOKEN]; an unknown pair is empty; a Price Card outside the v2 partition is refused;
//   3. begin v3: only the voice operations and families, only the payer's own recording in the named session, one row
//      per provider session (a reconnect is attempt 2), idempotent replay and PT409 on a changed identity;
//   4. D-2: a Speechmatics session settles AUDIO_INPUT_MS as GATEWAY_MEASURED, rates UNPRICED (never $0), is immutable
//      after settlement and is reported apart (summary v2 counts it, aggregates v2 never merge the two sources);
//      GATEWAY_MEASURED is refused for any other operation and with ABSENT usage;
//   5. D-1: a Gemini speech call is COMPLETE only with exactly INPUT_TOKEN + AUDIO_OUTPUT_TOKEN, whichever settle runs;
//      a text kind is refused on a voice call and a voice kind on a text call (the usage-kind trigger);
//   6. a crashed session ends FAILED_USAGE_UNKNOWN / USAGE_UNKNOWN, never zero; the transcription stale bound is the
//      controlled maximum session length while every other family keeps five minutes;
//   7. text unchanged: a DeepSeek call through begin v1 / settle v1 is still PROVIDER_REPORTED with v1's digest;
//   8. Credits unchanged: CREDIT_POLICY_NOT_ACTIVATED, no Credit rating written, no voice Price Card.
// Every fixture is written inside one transaction that is rolled back.

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
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

const MIGRATIONS = new URL('./migrations/', import.meta.url);
const FILES = readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
/** The body of a function as the last migration before 0184 that defines it wrote it. */
function definedBody(name) {
  const header = new RegExp(`FUNCTION public\\.${name}\\(`, 'u');
  const file = FILES.filter((f) => f < '0184' && header.test(readFileSync(new URL(f, MIGRATIONS), 'utf8'))).at(-1);
  assert.ok(file, `a migration before 0184 defines ${name}`);
  const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
  const at = text.search(header);
  const open = text.indexOf('$$', at);
  const close = text.indexOf('$$', open + 2);
  return { file, body: text.slice(open + 2, close) };
}

const BEGIN_V1 = 'SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
const BEGIN_V3 = 'SELECT * FROM public.begin_ai_provider_call_v3($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
const SETTLE_V1 = 'SELECT * FROM public.settle_ai_provider_call_v1($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb)';
const SETTLE_V2 = 'SELECT * FROM public.settle_ai_provider_call_v2($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb,$6::text)';
const REALTIME = ['SPEECHMATICS', 'speechmatics-enhanced', 'SPEECHMATICS_REALTIME_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION'];
const BATCH = ['SPEECHMATICS', 'speechmatics-enhanced', 'SPEECHMATICS_BATCH_TRANSCRIPTION', 'VOICE_NOTE_TRANSCRIPTION'];
const SPEECH = ['GEMINI', 'gemini-flash-tts', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS'];
const DEEPSEEK = ['DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CONVERSATION_REPLY'];
const API = [
  'public.begin_ai_provider_call_v3(uuid,uuid,uuid,uuid,text,text,text,text,text)',
  'public.settle_ai_provider_call_v2(uuid,uuid,text,text,jsonb,text)',
  'public.server_read_ai_usage_operations_summary_v2(integer)',
  'public.server_read_ai_cost_aggregates_v2(timestamp with time zone,timestamp with time zone)',
];
const INTERNAL = ['public.ai_complete_usage_kinds_v2(text,text)', 'public.guard_ai_provider_call_usage_kind_v1()'];
const UNCHANGED = ['begin_ai_provider_call_v1', 'begin_ai_provider_call_v2', 'settle_ai_provider_call_v1',
  'server_read_ai_usage_operations_summary_v1', 'server_read_ai_cost_aggregates_v1', 'ai_complete_usage_kinds_v1',
  'ai_rate_provider_call_v1', 'guard_ai_provider_call_mutation_v1', 'register_ai_price_card_v1'];

async function beginV3(user, session, recording, fields, call = randomUUID()) {
  await identity('service_role');
  const row = await one(BEGIN_V3, [call, user, session, recording, ...fields, null]);
  await identity('postgres');
  return { call, row };
}
async function settleV2(call, user, outcome, completeness, usage, source) {
  await identity('service_role');
  const row = await one(SETTLE_V2, [call, user, outcome, completeness, JSON.stringify(usage), source]);
  await identity('postgres');
  return row;
}
async function refusedAs(role, sql, values, codes) {
  await identity(role);
  await rejected(() => q(sql, values), codes);
  await identity('postgres');
}
const v1Digest = (outcome, completeness, usage) => createHash('sha256').update(
  `${outcome}|${completeness}|${Object.keys(usage).sort().map((k) => `${k}=${usage[k]}`).join(',')}`, 'utf8').digest('hex');

async function verifyCatalogue() {
  stage = 'posture: the six new functions, their owner, search_path and grants';
  for (const signature of [...API, ...INTERNAL]) {
    const fn = await one(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig::text[] AS config, p.prosecdef AS definer
      FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [signature]);
    assert.ok(fn, `${signature} exists`);
    assert.equal(fn.owner, 'postgres', `${signature} is owned by postgres`);
    assert.deepEqual(fn.config, ['search_path=""'], `${signature} pins an empty search_path`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const can = (await one('SELECT has_function_privilege($1, to_regprocedure($2), \'EXECUTE\') AS can', [role, signature])).can;
      assert.equal(can, role === 'service_role' && API.includes(signature), `${role} EXECUTE on ${signature}`);
    }
  }
  for (const signature of API) {
    const definer = (await one('SELECT prosecdef AS d FROM pg_proc WHERE oid = to_regprocedure($1)', [signature])).d;
    assert.equal(definer, true, `${signature} is SECURITY DEFINER`);
  }

  stage = 'text unchanged: the v1 ledger functions are byte-identical to the migration that last defined them';
  for (const name of UNCHANGED) {
    const { file, body } = definedBody(name);
    const live = await one("SELECT p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1", [name]);
    assert.equal(live.src.replace(/\r\n/gu, '\n'), body, `${name} is byte-identical to ${file}`);
  }

  stage = 'partitions: every 0170 pair keeps its v1 partition; the voice pairs have their own; unknown is empty';
  const v2 = async (provider, operation) => (await one('SELECT public.ai_complete_usage_kinds_v2($1, $2) AS k', [provider, operation])).k;
  const v1 = async (provider) => (await one('SELECT public.ai_complete_usage_kinds_v1($1) AS k', [provider])).k;
  for (const [provider, operation] of [['OPENAI', 'OPENAI_RESPONSES_CREATE'], ['ANTHROPIC', 'ANTHROPIC_MESSAGES_CREATE'],
    ['GEMINI', 'GEMINI_GENERATE_CONTENT'], ['DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE'], ['TEST_PROVIDER', 'TEST_OPERATION']]) {
    assert.deepEqual(await v2(provider, operation), await v1(provider), `${provider}/${operation} keeps its v1 partition`);
  }
  assert.deepEqual(await v2('SPEECHMATICS', 'SPEECHMATICS_REALTIME_TRANSCRIPTION'), ['AUDIO_INPUT_MS']);
  assert.deepEqual(await v2('SPEECHMATICS', 'SPEECHMATICS_BATCH_TRANSCRIPTION'), ['AUDIO_INPUT_MS']);
  assert.deepEqual(await v2('GEMINI', 'GEMINI_SPEECH_GENERATION'), ['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN']);
  assert.deepEqual(await v2('SPEECHMATICS', 'GEMINI_SPEECH_GENERATION'), [], 'a crossed pair has an EMPTY partition');
  assert.deepEqual(await v2('OPENAI', 'SPEECHMATICS_BATCH_TRANSCRIPTION'), []);
  assert.deepEqual(await v2('QWEN', 'QWEN_CHAT'), [], 'an unknown pair has an EMPTY partition, never NULL');
  assert.deepEqual(await v1('SPEECHMATICS'), [], 'the v1 partition is unchanged: it does not know Speechmatics');

  stage = 'Credits and prices: nothing seeded, nothing activated';
  assert.equal((await one('SELECT public.server_read_ai_credit_policy_state_v1() AS s')).s, 'CREDIT_POLICY_NOT_ACTIVATED');
  assert.equal(Number((await one("SELECT count(*) AS n FROM public.ai_price_cards WHERE provider = 'SPEECHMATICS' OR operation = 'GEMINI_SPEECH_GENERATION'")).n), 0, 'no voice Price Card');
  assert.equal(Number((await one("SELECT count(*) AS n FROM public.ai_provider_calls WHERE usage_source <> 'PROVIDER_REPORTED'")).n), 0, 'every existing call reads PROVIDER_REPORTED');
}

async function verifyBehaviour() {
  await q('BEGIN');
  try {
    const credits = Number((await one('SELECT count(*) AS n FROM public.ai_credit_ratings')).n);
    const summaryBefore = await one('SELECT * FROM public.server_read_ai_usage_operations_summary_v2(3600)');
    const [user, other] = [randomUUID(), randomUUID()];
    await q('INSERT INTO auth.users (id) VALUES ($1), ($2)', [user, other]);
    const [session, otherSession, secondSession] = [randomUUID(), randomUUID(), randomUUID()];
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT'), ($3, $2, 'ACTIVE', 'TEXT'), ($4, $5, 'ACTIVE', 'TEXT')",
      [session, user, secondSession, otherSession, other]);
    const recording = randomUUID();
    const otherRecording = randomUUID();
    for (const [id, owner, ownerSession] of [[recording, user, session], [otherRecording, other, otherSession]]) {
      await q(`WITH n AS (SELECT clock_timestamp() AS t)
               INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at,
                                                     retention_expires_at, recording_state, writer_lease_until)
               SELECT $1, $2, $3, 'LIVE_CALL', gen_random_uuid(), n.t, n.t + interval '30 days', 'RECORDING', n.t + interval '60 seconds' FROM n`,
        [id, owner, ownerSession]);
    }

    stage = 'begin v3: only the voice operations and families, only the payer\'s own recording in its session';
    const first = await beginV3(user, session, recording, REALTIME);
    assert.deepEqual([first.row.begin_outcome, first.row.attempt_number], ['BEGUN', 1]);
    assert.deepEqual(await one('SELECT call_state, usage_source, source_voice_recording_id, source_turn_id, source_world_id FROM public.ai_provider_calls WHERE id = $1', [first.call]),
      { call_state: 'PENDING', usage_source: 'PROVIDER_REPORTED', source_voice_recording_id: recording, source_turn_id: null, source_world_id: null });
    const replay = await beginV3(user, session, recording, REALTIME, first.call);
    assert.deepEqual([replay.row.begin_outcome, replay.row.attempt_number], ['ALREADY_BEGUN', 1], 'a replayed begin is idempotent');
    await refusedAs('service_role', BEGIN_V3, [first.call, user, session, recording, ...BATCH, null], ['PT409']);
    const reconnect = await beginV3(user, session, recording, REALTIME);
    assert.equal(reconnect.row.attempt_number, 2, 'a reconnect is a new provider session: a new row, attempt 2');
    for (const fields of [DEEPSEEK, ['GEMINI', 'gemini-flash', 'GEMINI_GENERATE_CONTENT', 'SPEECH_SYNTHESIS'],
      ['SPEECHMATICS', 'speechmatics-enhanced', 'SPEECHMATICS_REALTIME_TRANSCRIPTION', 'CONVERSATION_REPLY']]) {
      await refusedAs('service_role', BEGIN_V3, [randomUUID(), user, session, recording, ...fields, null], ['22023']);
    }
    await refusedAs('service_role', BEGIN_V3, [randomUUID(), user, session, otherRecording, ...REALTIME, null], ['42501']);
    await refusedAs('service_role', BEGIN_V3, [randomUUID(), user, secondSession, recording, ...REALTIME, null], ['42501']);
    await refusedAs('service_role', BEGIN_V3, [randomUUID(), user, session, null, ...REALTIME, null], ['22023']);
    for (const role of ['anon', 'authenticated']) {
      await refusedAs(role, BEGIN_V3, [randomUUID(), user, session, recording, ...REALTIME, null], ['42501']);
    }
    await refusedAs('service_role', BEGIN_V1, [randomUUID(), user, session, null, ...REALTIME, null], ['22023']);
    await rejected(() => q(`INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, source_voice_recording_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
      SELECT gen_random_uuid(), $1, $2, t.id, $3, 'SPEECHMATICS', 'speechmatics-enhanced', 'SPEECHMATICS_BATCH_TRANSCRIPTION', 'VOICE_NOTE_TRANSCRIPTION', 1, 'PENDING', clock_timestamp()
        FROM (SELECT gen_random_uuid() AS id) t`, [user, session, recording]), ['23514', '23503']);

    stage = 'D-2: a Speechmatics session settles AUDIO_INPUT_MS as GATEWAY_MEASURED and rates UNPRICED, never $0';
    assert.deepEqual(await settleV2(first.call, user, 'SUCCEEDED', 'COMPLETE', { AUDIO_INPUT_MS: 61250 }, 'GATEWAY_MEASURED'),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' });
    const settled = await one(`SELECT c.usage_source, c.usage_completeness, c.settlement_digest, u.usage_kind, u.quantity::text AS quantity, r.unpriced_reason, r.total_amount
      FROM public.ai_provider_calls c JOIN public.ai_provider_call_usage u ON u.provider_call_id = c.id
      JOIN public.ai_cost_ratings r ON r.provider_call_id = c.id AND r.is_canonical WHERE c.id = $1`, [first.call]);
    assert.deepEqual(settled, {
      usage_source: 'GATEWAY_MEASURED', usage_completeness: 'COMPLETE', usage_kind: 'AUDIO_INPUT_MS', quantity: '61250',
      unpriced_reason: 'NO_EFFECTIVE_PRICE_CARD', total_amount: null,
      settlement_digest: createHash('sha256').update('SUCCEEDED|COMPLETE|AUDIO_INPUT_MS=61250|GATEWAY_MEASURED', 'utf8').digest('hex'),
    }, 'the gateway-measured digest is distinguishable from a provider report of the same quantity');
    assert.deepEqual(await settleV2(first.call, user, 'SUCCEEDED', 'COMPLETE', { AUDIO_INPUT_MS: 61250 }, 'GATEWAY_MEASURED'),
      { settle_outcome: 'ALREADY_SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' });
    await refusedAs('service_role', SETTLE_V2, [first.call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ AUDIO_INPUT_MS: 61250 }), 'PROVIDER_REPORTED'], ['PT409']);
    await rejected(() => q("UPDATE public.ai_provider_calls SET usage_source = 'PROVIDER_REPORTED' WHERE id = $1", [first.call]), ['55000']);
    await rejected(() => q("UPDATE public.ai_provider_call_usage SET quantity = 0 WHERE provider_call_id = $1", [first.call]), ['55000']);

    stage = 'D-2: GATEWAY_MEASURED is refused for every non-transcription operation and with ABSENT usage';
    const speechForGateway = await beginV3(user, session, recording, SPEECH);
    await refusedAs('service_role', SETTLE_V2, [speechForGateway.call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900 }), 'GATEWAY_MEASURED'], ['22023']);
    await identity('service_role');
    const text = await one(BEGIN_V1, [randomUUID(), user, session, null, ...DEEPSEEK, 'FAST']);
    await identity('postgres');
    const textCall = (await one('SELECT id FROM public.ai_provider_calls WHERE user_id = $1 AND provider = \'DEEPSEEK\'', [user])).id;
    assert.equal(text.begin_outcome, 'BEGUN');
    await refusedAs('service_role', SETTLE_V2, [textCall, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ INPUT_TOKEN: 1, CACHE_READ_INPUT_TOKEN: 1, OUTPUT_TOKEN: 1 }), 'GATEWAY_MEASURED'], ['22023']);
    const absent = await beginV3(user, session, recording, BATCH);
    await refusedAs('service_role', SETTLE_V2, [absent.call, user, 'FAILED', 'ABSENT', '{}', 'GATEWAY_MEASURED'], ['22023']);
    await refusedAs('service_role', SETTLE_V2, [absent.call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ AUDIO_INPUT_MS: 1 }), null], ['22023']);
    await refusedAs('service_role', SETTLE_V2, [absent.call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ AUDIO_INPUT_MS: 1 }), 'ESTIMATED'], ['22023']);
    await rejected(() => q("UPDATE public.ai_provider_calls SET usage_source = 'GATEWAY_MEASURED' WHERE id = $1", [textCall]), ['55000']);
    await rejected(() => q(`INSERT INTO public.ai_provider_calls (id, user_id, session_id, provider, requested_model, operation, feature_family, processing_path, attempt_number, call_state, started_at, usage_source)
      VALUES (gen_random_uuid(), $1, $2, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CONVERSATION_REPLY', 'FAST', 9, 'PENDING', clock_timestamp(), 'GATEWAY_MEASURED')`,
      [user, session]), ['23514']);

    stage = 'D-1: a Gemini speech call is COMPLETE only with exactly INPUT_TOKEN + AUDIO_OUTPUT_TOKEN';
    for (const usage of [{ INPUT_TOKEN: 40 }, { INPUT_TOKEN: 40, OUTPUT_TOKEN: 900 }, { INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900, OUTPUT_TOKEN: 1 },
      { AUDIO_INPUT_MS: 10 }]) {
      await refusedAs('service_role', SETTLE_V2, [speechForGateway.call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify(usage), 'PROVIDER_REPORTED'], ['22023']);
    }
    assert.deepEqual(await settleV2(speechForGateway.call, user, 'SUCCEEDED', 'COMPLETE', { INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900 }, 'PROVIDER_REPORTED'),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' });
    const partialSpeech = await beginV3(user, session, recording, SPEECH);
    assert.deepEqual(await settleV2(partialSpeech.call, user, 'SUCCEEDED', 'INCOMPLETE', { INPUT_TOKEN: 40 }, 'PROVIDER_REPORTED'),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'USAGE_UNKNOWN' }, 'partial speech usage is never rated');
    await refusedAs('service_role', SETTLE_V2, [(await beginV3(user, session, recording, BATCH)).call, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ INPUT_TOKEN: 5 }), 'PROVIDER_REPORTED'], ['22023']);

    stage = 'the usage-kind trigger: settle v1 cannot write a kind outside its call\'s v2 partition';
    await identity('service_role');
    const legacySpeech = randomUUID();
    assert.equal((await one(BEGIN_V1, [legacySpeech, user, session, null, ...SPEECH, null])).begin_outcome, 'BEGUN',
      'begin v1 still admits the route-neutral Gemini speech operation (recorded deviation; settlement is partition-guarded)');
    await rejected(() => q(SETTLE_V1, [legacySpeech, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify({ CACHE_READ_INPUT_TOKEN: 1, INPUT_TOKEN: 1, OUTPUT_TOKEN: 1 })]), ['22023']);
    await identity('postgres');
    await rejected(() => q("INSERT INTO public.ai_provider_call_usage (provider_call_id, usage_kind, quantity) VALUES ($1, 'AUDIO_INPUT_MS', 5)", [textCall]), ['22023']);
    await rejected(() => q("INSERT INTO public.ai_provider_call_usage (provider_call_id, usage_kind, quantity) VALUES ($1, 'AUDIO_SECONDS', 5)", [textCall]), ['23514', '22023']);

    stage = 'crash: a session whose usage is unknown ends FAILED_USAGE_UNKNOWN, never zero';
    const crashed = await beginV3(user, session, recording, REALTIME);
    assert.deepEqual(await settleV2(crashed.call, user, 'FAILED', 'ABSENT', {}, 'PROVIDER_REPORTED'),
      { settle_outcome: 'SETTLED', call_state: 'FAILED_USAGE_UNKNOWN', rating_state: 'USAGE_UNKNOWN' });
    assert.equal(Number((await one('SELECT count(*) AS n FROM public.ai_provider_call_usage WHERE provider_call_id = $1', [crashed.call])).n), 0, 'no zero quantity is invented');
    await refusedAs('service_role', SETTLE_V2, [randomUUID(), user, 'FAILED', 'ABSENT', '{}', 'PROVIDER_REPORTED'], ['42501']);
    await refusedAs('service_role', SETTLE_V2, [reconnect.call, other, 'FAILED', 'ABSENT', '{}', 'PROVIDER_REPORTED'], ['42501']);

    stage = 'text unchanged: a DeepSeek call through settle v1 keeps v1\'s digest and PROVIDER_REPORTED';
    const textUsage = { INPUT_TOKEN: 360, CACHE_READ_INPUT_TOKEN: 640, OUTPUT_TOKEN: 300 };
    await identity('service_role');
    assert.deepEqual(await one(SETTLE_V1, [textCall, user, 'SUCCEEDED', 'COMPLETE', JSON.stringify(textUsage)]),
      { settle_outcome: 'SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' });
    await identity('postgres');
    assert.deepEqual(await one('SELECT usage_source, settlement_digest FROM public.ai_provider_calls WHERE id = $1', [textCall]),
      { usage_source: 'PROVIDER_REPORTED', settlement_digest: v1Digest('SUCCEEDED', 'COMPLETE', textUsage) });
    assert.deepEqual(await settleV2(textCall, user, 'SUCCEEDED', 'COMPLETE', textUsage, 'PROVIDER_REPORTED'),
      { settle_outcome: 'ALREADY_SETTLED', call_state: 'SUCCEEDED_USAGE_REPORTED', rating_state: 'UNPRICED' },
      'a PROVIDER_REPORTED v2 settlement has exactly v1\'s digest');

    stage = 'reads: the summary v2 counts the gateway-measured call and keeps the stale bound per family';
    const backdated = async (fields, minutes) => {
      const id = randomUUID();
      await q(`INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_voice_recording_id, provider, requested_model, operation, feature_family, attempt_number, call_state, started_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 99, 'PENDING', clock_timestamp() - make_interval(mins => $9))`,
        [id, user, session, fields[0] === 'DEEPSEEK' ? null : recording, ...fields, minutes]);
      return id;
    };
    await backdated(REALTIME, 10);
    await backdated(['DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'CU_SEGMENTATION'], 10);
    await identity('service_role');
    const long = await one('SELECT * FROM public.server_read_ai_usage_operations_summary_v2(3600)');
    const short = await one('SELECT * FROM public.server_read_ai_usage_operations_summary_v2(300)');
    await rejected(() => q('SELECT * FROM public.server_read_ai_usage_operations_summary_v2(60)'), ['22023']);
    await rejected(() => q('SELECT * FROM public.server_read_ai_usage_operations_summary_v2(NULL)'), ['22023']);
    await identity('postgres');
    const delta = (row, key) => Number(row[key]) - Number(summaryBefore[key]);
    assert.equal(delta(long, 'stale_pending_calls'), 1, 'a ten-minute transcription is not stale under a one-hour session bound; the text call is');
    assert.equal(delta(short, 'stale_pending_calls'), 2, 'under a five-minute bound both are stale');
    assert.equal(delta(long, 'gateway_measured_calls_24h'), 1, 'the one gateway-measured settlement is counted apart');

    stage = 'reads: the aggregates v2 never merge the two usage sources';
    await identity('service_role');
    const aggregates = (await q(`SELECT * FROM public.server_read_ai_cost_aggregates_v2(now() - interval '1 day', now() + interval '1 day')
      WHERE provider = 'SPEECHMATICS' AND call_state = 'SUCCEEDED_USAGE_REPORTED'`)).rows;
    const v1Aggregates = await q("SELECT * FROM public.server_read_ai_cost_aggregates_v1(now() - interval '1 day', now() + interval '1 day')");
    await identity('postgres');
    assert.deepEqual(aggregates.map((r) => [r.usage_source, r.rating_state, r.calls, r.audio_input_ms, r.input_tokens]),
      [['GATEWAY_MEASURED', 'UNPRICED', '1', '61250', null]]);
    assert.ok(!v1Aggregates.fields.some((f) => f.name === 'usage_source'), 'the v1 aggregates keep their v1 shape');

    stage = 'prices: a Price Card outside the v2 partition is refused; no Credit is written';
    for (const [provider, model, operation, kind] of [['SPEECHMATICS', 'speechmatics-enhanced', 'SPEECHMATICS_REALTIME_TRANSCRIPTION', 'INPUT_TOKEN'],
      ['GEMINI', 'gemini-flash-tts', 'GEMINI_SPEECH_GENERATION', 'OUTPUT_TOKEN'],
      ['GEMINI', 'gemini-flash', 'GEMINI_GENERATE_CONTENT', 'AUDIO_OUTPUT_TOKEN'],
      ['DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'AUDIO_INPUT_MS']]) {
      await rejected(() => q("SELECT public.register_ai_price_card_v1('PRODUCTION', $1, $2, $3, $4, 1, 1000000, 'USD', now(), 'S8B-02 verifier fixture')",
        [provider, model, operation, kind]), ['23514']);
    }
    assert.equal(Number((await one('SELECT count(*) AS n FROM public.ai_credit_ratings')).n), credits, 'no Credit rating is written');
    assert.equal((await one('SELECT public.server_read_ai_credit_policy_state_v1() AS s')).s, 'CREDIT_POLICY_NOT_ACTIVATED');
  } finally {
    await q('ROLLBACK');
  }
}

async function main() {
  await client.connect();
  try {
    await q("SET search_path = ''");
    await verifyCatalogue();
    await verifyBehaviour();
    console.log('Verified migration 0184: the voice operations, kinds, families and usage source are admitted to the AI-COST-01 ledger; every existing pair keeps its v1 partition and the v1 functions are byte-identical; begin v3 binds a voice session to the payer\'s own recording; a Speechmatics session settles AUDIO_INPUT_MS as GATEWAY_MEASURED, UNPRICED, immutable and reported apart; GATEWAY_MEASURED is refused elsewhere; Gemini speech is COMPLETE only with INPUT_TOKEN + AUDIO_OUTPUT_TOKEN; a crash is FAILED_USAGE_UNKNOWN; Credits are unchanged.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration 0184 verification failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
