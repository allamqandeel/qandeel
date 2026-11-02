// S8B-04 (CP1, contract v1.2 §8.4, AC-12 / AC-13) - «استمع» proven end to end, FREE: the API's OWN compiled Listen service
// (apps/api/dist, built earlier in the same CI job), the compiled repository and sweeper over real PostgreSQL with 0187,
// and the compiled Vertex adapter pointed at a LOOPBACK fake of `streamGenerateContent` that COUNTS every request. No paid
// call is made, no Google credential exists (a fixed fake token reaches the fake only), and the audio is synthetic.
//
// Transport: with POSTGREST_URL and POSTGREST_JWT_SECRET set (the CI PostgREST loop) every repository call goes over the
// WIRE through the real PostgREST engine (bytea, jsonb and timestamptz as PostgREST encodes them); otherwise (the DB step,
// and locally) through a service_role connection calling the same definers by name. Either way the service, the database
// and the adapter are the real ones.
//
//   L01  start is free and idempotent: no provider call, no ledger row; the same listen answers ALREADY_STARTED
//   L02  two concurrent synthesis requests for one segment: ONE provider call, ONE ledger row; the other answers IN_PROGRESS
//   L03  a lost synthesis answer, asked again: READY, no new call; GET ten times: the same bytes, no new call
//   L04  re-listening within the TTL (the same listen): zero calls
//   L05  one retry before audio (503 then audio): two calls, two ledger rows (FAILED, SUCCEEDED), attempts 1 and 2
//   L06  failure after audio started: no retry, one call, FAILED; asked again: FAILED, free
//   L07  a crash after admission: the sweeper settles the PENDING row FAILED_USAGE_UNKNOWN; asking again calls nobody
//   L08  DELETE removes the segments; the TTL makes the store unreadable at its instant and the sweeper deletes it
//   L09  refusals before anything is written or sent: a typed reply, another human, the gate closed, consent withdrawn
//   L10  every request body was exactly the allowlist, carried no user, session or turn identity, and the style rode only
//        in speechMetadata; the expression recorded with the reply chose the style; nothing was written to the recordings
//        or the object store, and every provider call has exactly one ledger row
//
// It needs DATABASE_URL (0187 applied) and a built API. Every fixture is removed afterwards; the gate is restored exactly.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import process from 'node:process';
import { createPersonalReplayRuntime } from './replay-personal-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const postgrestUrl = process.env.POSTGREST_URL?.replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const wire = Boolean(postgrestUrl && secret);
process.env.NODE_ENV = 'test';

require('reflect-metadata');
const pg = require('pg');
const { ReplySpeechRepository } = require('../apps/api/dist/voice-media/reply-speech.repository.js');
const { ReplySpeechSweepWorker } = require('../apps/api/dist/voice-media/reply-speech-sweep.worker.js');
const { SupabaseServiceRoleApiService } = require('../apps/api/dist/conversation/supabase-service-role-api.service.js');
const { ReplyListenService, speechSegments } = require('../apps/api/dist/voice/listen/reply-listen.service.js');
const { SpeechAdmissionGuard } = require('../apps/api/dist/voice/speech-admission.guard.js');
const { VertexSpeechAdapter } = require('../apps/api/dist/voice/vertex-speech/vertex-speech.adapter.js');
const { segmentTimeoutMs, VERTEX_SPEECH_LIMITS, VERTEX_SPEECH_MODEL, VERTEX_SPEECH_VOICE } = require('../apps/api/dist/voice/vertex-speech/vertex-speech.config.js');
const { jsonPaths, VERTEX_SPEECH_REQUEST_PATHS } = require('../apps/api/dist/voice/vertex-speech/vertex-speech.request.js');
const { FakeVertexSpeechServer } = require('../apps/api/dist/voice/vertex-speech/testing/fake-vertex-speech.server.js');
const { SPEECH_STYLE_SENTENCES } = require('../apps/api/dist/speech-rendering/speech-styles.js');

const rt = createPersonalReplayRuntime(databaseUrl);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
// Two sentences, long enough for two segments (the first ~120 characters, then the rest).
const REPLY = 'طبخت الأرز في القدر الكبير، وبعدين قعدنا نتكلم عن الرحلة اللي جاية وإزاي هنرتب كل حاجة قبلها بيومين على الأقل. '
  + 'وفي الآخر اتفقنا إننا نتقابل يوم الخميس الساعة ستة، ونكمل الكلام على العشا لو الجو كان حلو والطريق فاضي.';

// ------------------------------------------------------------------ transports
/** service_role over a pool: each definer by name, its arguments named; bytea and timestamps encoded as PostgREST does. */
function databaseTransport(pool) {
  return {
    async rpc(name, body) {
      if (!/^server_[a-z0-9_]+_v1$/u.test(name)) throw new Error('not a server definer');
      const keys = Object.keys(body);
      const values = keys.map((k) => (body[k] !== null && typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]));
      const client = await pool.connect();
      try {
        await client.query('SET ROLE service_role');
        const result = await client.query(`SELECT * FROM public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, values);
        return result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k,
          Buffer.isBuffer(v) ? `\\x${v.toString('hex')}` : v instanceof Date ? v.toISOString() : v])));
      } finally {
        await client.query('RESET ROLE').catch(() => undefined);
        client.release();
      }
    },
  };
}

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 1800 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST. */
function startGateway() {
  const server = http.createServer(async (request, response) => {
    try {
      if (!request.url?.startsWith('/rest/v1/')) { response.writeHead(404).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(Object.entries(request.headers).filter(([n]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(n)));
      const upstream = await fetch(`${postgrestUrl}${request.url.slice('/rest/v1'.length)}`, { method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ------------------------------------------------------------------ fixtures (committed; removed in teardown)
async function human(humans) {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  humans.push(id);
  return id;
}
async function session(user) {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
async function turn(user, sessionId, role, content, source = null) {
  const id = randomUUID();
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, source_turn_id, completed_at)
           VALUES ($1, $2, $3, $4, 'COMPLETED', $5, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $6, clock_timestamp())`, [id, sessionId, user, role, content, source]);
  return id;
}
/** A completed exchange: a user turn (voice-note sourced when `voice`) and QANDEEL's reply to it. */
async function exchange(user, sessionId, voice = true) {
  await owner();
  const userTurn = await turn(user, sessionId, 'USER', 'سؤال');
  if (voice) {
    const recording = randomUUID();
    await q(`WITH n AS (SELECT clock_timestamp() AS t)
             INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at, retention_expires_at, recording_state)
             SELECT $1, $2, $3, 'VOICE_NOTE', $4, n.t, n.t + interval '30 days', 'STORED' FROM n`, [recording, user, sessionId, randomUUID()]);
    await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type, byte_size, upload_deadline, stored_at)
             VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', 2048, clock_timestamp(), clock_timestamp())`, [recording, `voice-note/${randomUUID()}`]);
    await q(`INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality, transcript_origin,
               asr_confidence_band, recording_id, anchor_start_ms, anchor_end_ms) VALUES ($1, $2, $3, 'USER', 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH', $4, 0, 4200)`,
    [userTurn, user, sessionId, recording]);
  }
  return turn(user, sessionId, 'ASSISTANT', REPLY, userTurn);
}
async function grantCurrent(user) {
  await asRole('service_role');
  // S8B-04 CP2 re-anchor (migration 0188): the current approved version (VOICE_RECORDING_V3 once 0188 is applied).
  const [{ consent_version: current }] = await rows('SELECT consent_version FROM public.server_read_voice_consent_text_v1()');
  const [{ outcome }] = await rows('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), current]);
  await owner();
  assert.equal(outcome, 'GRANTED');
}
async function setGate(flag, requirements) {
  await owner();
  await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_VOICE_NOTE', $1, $2, 'prove-0187', 'free Listen proof')`, [flag, requirements]);
}
const ledger = async (user) => { await owner(); return rows(`SELECT c.call_state, c.attempt_number, c.requested_model, c.operation, c.provider,
    (SELECT coalesce(jsonb_object_agg(u.usage_kind, u.quantity), '{}'::jsonb) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id) AS usage
    FROM public.ai_provider_calls c WHERE c.user_id = $1 AND c.operation = 'GEMINI_SPEECH_GENERATION' ORDER BY c.started_at, c.attempt_number`, [user]); };
const segmentRows = async (user) => { await owner(); return rows('SELECT listen_id, segment_index, state FROM voice_private.reply_speech_segments WHERE user_id = $1 ORDER BY 1, 2', [user]); };
async function status(promise) {
  try {
    const value = await promise;
    return { status: 200, value };
  } catch (error) {
    if (typeof error?.getStatus !== 'function') throw error;
    return { status: error.getStatus(), body: error.getResponse() };
  }
}

async function removeFixtures(humans, gate) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.reply_speech_segments WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.reply_speech_hints WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.ai_provider_call_usage WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM public.ai_cost_ratings WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_objects WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
    if (gate) {
      await q(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
                 restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await q('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2', [gate.capability_scope, gate.restriction_version]);
    }
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeHistoricalFixture(humans);
  await rt.removeFixtureHumans(humans);
}

// ------------------------------------------------------------------ the proof
const results = [];
async function scenario(name, work) {
  try {
    await work();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

let stage = 'connect';
const humans = [];
let gate = null;
let pool = null;
let gateway = null;
const fake = new FakeVertexSpeechServer();
try {
  await rt.client.connect();
  await q("SET statement_timeout = '60s'");
  await owner();
  [gate] = await rows(`SELECT capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at
                         FROM voice_private.voice_launch_capability_states WHERE capability_scope = 'PERSONAL_VOICE_NOTE'`);
  stage = 'transport, the fake Vertex server and the compiled service';
  let transport;
  if (wire) {
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role' });
    transport = new SupabaseServiceRoleApiService();
  } else {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 6 });
    transport = databaseTransport(pool);
  }
  const repository = new ReplySpeechRepository(transport);
  const sweeper = new ReplySpeechSweepWorker(repository);
  const baseUrl = await fake.start();
  const route = {
    adapter: new VertexSpeechAdapter({ projectId: 'qandeel-proof-0187', baseUrl }, { accessToken: async () => 'fake-loopback-token-not-a-credential-0187' }),
    admission: new SpeechAdmissionGuard(VERTEX_SPEECH_LIMITS),
    model: VERTEX_SPEECH_MODEL,
    voiceId: VERTEX_SPEECH_VOICE,
    segmentTimeoutMs,
    retryDelayMs: () => VERTEX_SPEECH_LIMITS.retryJitterMinMs,
  };
  const listen = new ReplyListenService(repository, route);
  const before = async () => { await owner(); return (await rows(`SELECT (SELECT count(*) FROM voice_private.recordings)::int AS r, (SELECT count(*) FROM voice_private.recording_objects)::int AS o,
      (SELECT count(*) FROM introduction_sharing_private.media_erasure_queue)::int AS e`))[0]; };

  stage = 'fixtures';
  const A = await human(humans);
  const B = await human(humans);
  const sessionA = await session(A);
  await setGate('ENABLED', 'SATISFIED');
  await grantCurrent(A);
  await grantCurrent(B);
  const reply = await exchange(A, sessionA);
  const typedReply = await exchange(A, sessionA, false);
  assert.equal((await repository.recordChannel(A, reply, 'JOY', [])).outcome, 'RECORDED');
  const storeBefore = await before();
  const expected = speechSegments(REPLY, []);
  assert.ok(Array.isArray(expected) && expected.length === 2, `the proof reply renders into two segments (got ${JSON.stringify(expected)})`);

  stage = 'scenarios';
  const listenId = randomUUID();
  await scenario('L01 start is free and idempotent', async () => {
    const first = await listen.start(A, reply, { listenId });
    assert.equal(first.segmentCount, 2);
    const again = await listen.start(A, reply, { listenId });
    assert.deepEqual([again.segmentCount, again.expiresAt], [2, first.expiresAt]);
    assert.equal(fake.calls, 0);
    assert.equal((await ledger(A)).length, 0);
  });

  await scenario('L02 two concurrent synthesis requests: one provider call, one ledger row', async () => {
    let release;
    fake.next({ kind: 'gate', release: new Promise((r) => { release = r; }) });
    const first = listen.synthesize(A, reply, listenId, '0');
    await new Promise((r) => setTimeout(r, 150));
    const second = await listen.synthesize(A, reply, listenId, '0');
    release();
    assert.deepEqual(second, { segmentIndex: 0, state: 'IN_PROGRESS' });
    assert.deepEqual(await first, { segmentIndex: 0, state: 'READY' });
    assert.equal(fake.calls, 1);
    const calls = await ledger(A);
    assert.equal(calls.length, 1);
    assert.deepEqual([calls[0].call_state, calls[0].provider, calls[0].requested_model, calls[0].attempt_number], ['SUCCEEDED_USAGE_REPORTED', 'GEMINI', 'gemini-3.8-flash-tts', 1]);
    assert.deepEqual(Object.keys(calls[0].usage).sort(), ['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN']);
    assert.deepEqual(Object.values(calls[0].usage).map(Number).sort((a, b) => a - b), [41, 75]);
  });

  let firstAudio;
  await scenario('L03 a lost answer asked again is READY for free; GET ten times returns the same bytes for free', async () => {
    assert.deepEqual(await listen.synthesize(A, reply, listenId, '0'), { segmentIndex: 0, state: 'READY' });
    firstAudio = await listen.audio(A, reply, listenId, '0');
    assert.equal(firstAudio.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(firstAudio.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(firstAudio.readUInt32LE(24), 24000);
    assert.equal(firstAudio.length, 44 + 960);
    for (let i = 0; i < 10; i += 1) assert.ok((await listen.audio(A, reply, listenId, '0')).equals(firstAudio));
    assert.equal(fake.calls, 1);
    assert.equal((await ledger(A)).length, 1);
  });

  await scenario('L04 re-listening within the TTL: zero calls', async () => {
    const again = await listen.start(A, reply, { listenId });
    assert.equal(again.segmentCount, 2);
    assert.ok((await listen.audio(A, reply, listenId, '0')).equals(firstAudio));
    assert.equal(fake.calls, 1);
  });

  await scenario('L05 one retry before audio: two calls, two ledger rows (FAILED, SUCCEEDED)', async () => {
    fake.next({ kind: 'status', status: 503 }, { kind: 'ok' });
    assert.deepEqual(await listen.synthesize(A, reply, listenId, '1'), { segmentIndex: 1, state: 'READY' });
    assert.equal(fake.calls, 3);
    const calls = (await ledger(A)).slice(1);
    // attempt_number counts the turn's speech calls (0187 begin): the retry is the next one.
    assert.deepEqual(calls.map((c) => c.call_state), ['FAILED_USAGE_UNKNOWN', 'SUCCEEDED_USAGE_REPORTED']);
    assert.equal(calls[1].attempt_number, calls[0].attempt_number + 1);
  });

  const listen2 = randomUUID();
  await scenario('L06 failure after audio: no retry, FAILED; asked again: FAILED for free', async () => {
    assert.equal((await listen.start(A, reply, { listenId: listen2 })).segmentCount, 2);
    fake.next({ kind: 'dropAfterAudio' });
    assert.deepEqual(await listen.synthesize(A, reply, listen2, '0'), { segmentIndex: 0, state: 'FAILED' });
    assert.equal(fake.calls, 4);
    assert.deepEqual(await listen.synthesize(A, reply, listen2, '0'), { segmentIndex: 0, state: 'FAILED' });
    assert.equal(fake.calls, 4);
    const last = (await ledger(A)).at(-1);
    assert.equal(last.call_state, 'FAILED_USAGE_UNKNOWN');
    // The earlier listen was replaced by this one (one listen per human): its audio is gone.
    assert.equal((await status(listen.audio(A, reply, listenId, '0'))).status, 404);
  });

  await scenario('L07 a crash after admission: the sweeper settles it unknown; asking again calls nobody', async () => {
    const crashedCall = randomUUID();
    const admitted = await repository.admitSynthesis(A, listen2, 1, crashedCall, VERTEX_SPEECH_MODEL, 5);
    assert.equal(admitted.outcome, 'ADMITTED');
    await owner();
    await q("UPDATE voice_private.reply_speech_segments SET lease_until = clock_timestamp() - interval '1 second' WHERE user_id = $1 AND listen_id = $2 AND segment_index = 1", [A, listen2]);
    const swept = await sweeper.runOnce();
    assert.equal(swept.leasesExpired, 1);
    // The lease's own call is settled in the lease pass; callsSettled counts orphaned PENDING calls only.
    assert.equal(swept.callsSettled, 0);
    const last = (await ledger(A)).at(-1);
    assert.equal(last.call_state, 'FAILED_USAGE_UNKNOWN');
    const callsBefore = fake.calls;
    assert.deepEqual(await listen.synthesize(A, reply, listen2, '1'), { segmentIndex: 1, state: 'FAILED' });
    assert.equal(fake.calls, callsBefore);
  });

  await scenario('L08 DELETE removes the segments; the TTL closes the store at its instant and the sweeper deletes it', async () => {
    await listen.cancel(A, reply, listen2);
    assert.deepEqual(await segmentRows(A), []);
    assert.equal((await status(listen.audio(A, reply, listen2, '0'))).status, 404);
    const listen3 = randomUUID();
    await listen.start(A, reply, { listenId: listen3 });
    fake.next({ kind: 'ok' });
    assert.equal((await listen.synthesize(A, reply, listen3, '0')).state, 'READY');
    await owner();
    await q("UPDATE voice_private.reply_speech_segments SET expires_at = clock_timestamp() - interval '1 second', created_at = clock_timestamp() - interval '16 minutes' WHERE user_id = $1", [A]);
    assert.equal((await status(listen.audio(A, reply, listen3, '0'))).status, 404);
    await sweeper.runOnce();
    assert.deepEqual(await segmentRows(A), []);
  });

  await scenario('L09 refusals before anything is written or sent', async () => {
    const calls = fake.calls;
    const rowsBefore = (await ledger(A)).length;
    assert.equal((await status(listen.start(A, typedReply, { listenId: randomUUID() }))).status, 404, 'a typed reply is not a voice-note reply');
    assert.equal((await status(listen.start(B, reply, { listenId: randomUUID() }))).status, 404, 'another human\'s reply is 404');
    await setGate('DISABLED', 'UNSATISFIED');
    assert.equal((await status(listen.start(A, reply, { listenId: randomUUID() }))).status, 503, 'the gate closed');
    await setGate('ENABLED', 'SATISFIED');
    await asRole('service_role');
    await rows('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [A, randomUUID()]);
    await owner();
    assert.equal((await status(listen.start(A, reply, { listenId: randomUUID() }))).status, 403, 'consent withdrawn');
    assert.equal(fake.calls, calls);
    assert.equal((await ledger(A)).length, rowsBefore);
    assert.deepEqual(await segmentRows(A), []);
  });

  await scenario('L10 the allowlist, no identity, the recorded style; no recording write; one ledger row per call', async () => {
    const identities = [A, B, sessionA, reply, typedReply];
    for (const request of fake.requests) {
      assert.deepEqual(jsonPaths(request.body).sort(), [...VERTEX_SPEECH_REQUEST_PATHS].sort());
      const text = JSON.stringify(request.body);
      for (const id of identities) assert.equal(text.includes(id), false, 'no identity reaches the provider');
      const part = request.body.contents[0].parts[0];
      assert.equal(part.speechMetadata.style, SPEECH_STYLE_SENTENCES.JOY.style, 'the expression recorded with the reply chose S-02');
      assert.equal(part.text.includes(part.speechMetadata.style), false, 'the style never rides in the spoken text');
      assert.ok(expected.includes(part.text), 'the spoken text is one of the reply\'s rendered segments');
      assert.equal(request.body.generationConfig.speechConfig.voiceConfig.voice, 'Achird');
    }
    assert.deepEqual(await before(), storeBefore, 'nothing written to the recordings, the objects or the erasure queue');
    // Every provider call has exactly one ledger row; the one extra row is L07's admission that crashed before any call.
    assert.equal((await ledger(A)).length, fake.calls + 1, 'every provider call has exactly one ledger row');
  });
} catch (error) {
  results.push({ name: `stage: ${stage}`, ok: false, error });
} finally {
  await fake.stop().catch(() => undefined);
  try {
    await removeFixtures(humans, gate);
  } catch (error) {
    results.push({ name: 'teardown', ok: false, error });
  }
  await pool?.end().catch(() => undefined);
  gateway?.close();
  await rt.client.end().catch(() => undefined);
}

console.log(`prove-0187 Listen (transport: ${wire ? `PostgREST ${process.env.POSTGREST_VERSION ?? ''}`.trim() : 'service_role connection'})`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n        ${r.error?.stack ?? r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`  ${results.length} scenario(s), ${results.length - failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
