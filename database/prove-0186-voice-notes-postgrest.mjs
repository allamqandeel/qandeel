// S8B-03 (CP1) - live proof of Personal Voice Notes transcription THROUGH a real PostgREST server and a real S3 server,
// driven by the API's OWN compiled code (apps/api/dist, built earlier in the same CI job): the compiled VoiceMediaModule
// on a real HTTP port, its S3 adapter against `rclone serve s3` (a CI stand-in, never a hosted proof), the compiled
// transcription worker and the compiled Speechmatics batch adapter - pointed at a LOOPBACK fake of the batch API that
// this script runs. No paid call is made, no provider key exists, and every audio byte is a synthetic M4A container
// (zero frames; nothing here is a voice).
//
//   P01  on the wire: anon and authenticated never reach a 0186 server definer
//   P02  A19  a 24 MiB note streams from the store to the batch API while the payload bytes the process still holds
//             (live ArrayBuffer memory after a collection, sampled throughout) never exceed 16 MiB; a deliberately held
//             24 MiB buffer exceeds the bound (the instrument can fail); the fake received every byte; the note is READY,
//             the job deleted, the attempt settled; the owner's status route carries no text, band or job
//   P03  A24  consent withdrawn while a job runs: the worker holds the note (HELD_CONSENT), keeps no text and deletes the
//             job; the attempt is settled as a failure
//   P04       the gates are closed again and nothing of this run is stored
//
// It needs DATABASE_URL, POSTGREST_URL, POSTGREST_JWT_SECRET, the CI-only QANDEEL_MEDIA_S3_* values, RCLONE_DATA_DIR and a
// built API. Every fixture is removed afterwards; the gates are restored exactly. The approved consent text
// (VOICE_RECORDING_V1, installed by 0186) is used as it is and never changed.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { createPersonalReplayRuntime } from './replay-personal-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
const dataDir = process.env.RCLONE_DATA_DIR;
const bucket = process.env.QANDEEL_MEDIA_S3_BUCKET;
for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, POSTGREST_JWT_SECRET: secret, RCLONE_DATA_DIR: dataDir,
  QANDEEL_MEDIA_S3_BUCKET: bucket, QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT })) {
  if (!value) throw new Error(`${name} is required.`);
}
process.env.NODE_ENV = 'test';

const rt = createPersonalReplayRuntime(databaseUrl);
const { rows } = rt;
let stage = 'load the compiled API';
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');
const { VoiceMediaModule } = require('../apps/api/dist/voice-media/voice-media.module.js');
const { VoiceMediaService } = require('../apps/api/dist/voice-media/voice-media.service.js');
const { VoiceNotesRepository } = require('../apps/api/dist/voice-media/voice-notes.repository.js');
const { PRIVATE_AUDIO_OBJECT_STORE } = require('../apps/api/dist/voice-media/private-audio-object.store.js');
const { VoiceNoteTranscriptionWorker } = require('../apps/api/dist/voice/voice-note-transcription.worker.js');
const { SpeechmaticsBatchJobsAdapter } = require('../apps/api/dist/voice/speechmatics/speechmatics-batch-jobs.adapter.js');
const { loadSpeechmaticsBatchConfig } = require('../apps/api/dist/voice/speechmatics/speechmatics-batch.config.js');
const { m4aFixtureParts, streamM4aFixture } = require('../apps/api/dist/voice/testing/m4a-fixture.writer.js');

const MiB = 1024 * 1024;
/** A19: the payload bytes the process may still hold while a 24 MiB note is sent - less than the note. */
const STREAM_MEMORY_BOUND = 16 * MiB;
const FAKE_KEY = 'prove-0186-loopback-only';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 1800 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
function verifiedSubject(token) {
  const [head, body, signature] = String(token).split('.');
  if (!signature || createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url') !== signature) return null;
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  return claims.role === 'authenticated' && typeof claims.sub === 'string' ? claims.sub : null;
}

/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST, and `/auth/v1/user` answering a verified token. */
function startGateway() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === '/auth/v1/user') {
        const sub = verifiedSubject((request.headers.authorization ?? '').replace(/^Bearer\s+/iu, ''));
        if (!sub) { response.writeHead(401).end(); return; }
        response.writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ id: sub, email: 'owner@prove-0186.test', email_confirmed_at: '2026-10-01T00:00:00Z' }));
        return;
      }
      if (!request.url?.startsWith('/rest/v1/')) { response.writeHead(404).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(name)));
      const upstream = await fetch(`${postgrestUrl}${request.url.slice('/rest/v1'.length)}`, {
        method: request.method, headers, body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * A loopback fake of the batch API: it reads every uploaded byte as it arrives (counted, never kept), and answers each
 * job by the plan set for it. It refuses any request without the fake key. No real provider is ever reached.
 */
function startFakeBatchApi() {
  const jobs = new Map();
  const state = { received: 0, deletes: [], plan: 'done', unauthorized: 0 };
  const transcript = {
    job: { duration: 3.2 },
    results: [
      { type: 'word', start_time: 0.1, end_time: 0.5, alternatives: [{ content: 'أنا', confidence: 0.99 }] },
      { type: 'word', start_time: 0.6, end_time: 1.2, alternatives: [{ content: 'بشتغل', confidence: 0.98 }] },
      { type: 'word', start_time: 1.3, end_time: 1.9, alternatives: [{ content: 'مهندس', confidence: 0.97 }] },
    ],
  };
  const server = http.createServer(async (request, response) => {
    const json = (status, body) => response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    if (request.headers.authorization !== `Bearer ${FAKE_KEY}`) { state.unauthorized += 1; request.resume(); json(401, {}); return; }
    const url = new URL(request.url, 'http://fake');
    const id = url.pathname.match(/^\/v2\/jobs\/([A-Za-z0-9_-]+)/u)?.[1];
    if (request.method === 'POST' && url.pathname === '/v2/jobs/') {
      let bytes = 0;
      for await (const chunk of request) bytes += chunk.length;
      state.received += bytes;
      const job = `job${randomUUID().replace(/-/gu, '').slice(0, 16)}`;
      jobs.set(job, { status: state.plan === 'done' ? 'done' : 'running', bytes });
      json(201, { id: job });
      return;
    }
    request.resume();
    const job = id ? jobs.get(id) : undefined;
    if (!job) { json(404, {}); return; }
    if (request.method === 'DELETE') { state.deletes.push(id); jobs.delete(id); json(200, {}); return; }
    if (url.pathname.endsWith('/transcript')) { json(200, transcript); return; }
    json(200, { job: { id, status: job.status } });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, jobs })));
}

async function wire(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, { method: 'POST', body: JSON.stringify(body),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  await response.text();
  return response.status;
}
function filesUnder(root) {
  if (!existsSync(root)) return [];
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path.slice(root.length + 1).replace(/\\/gu, '/')];
  });
  return walk(root);
}
const voiceFiles = () => filesUnder(join(dataDir, bucket)).filter((f) => f.startsWith('voice-'));

/** A valid synthetic M4A of exactly `size` bytes: about ten minutes of zero frames, padded by a top-level `free` box. */
function noteOptions(size, durationMs) {
  const base = { durationMs, frameBytes: 512 };
  const plain = m4aFixtureParts(base).byteSize;
  const freeBytes = size - plain - 8;
  assert.ok(freeBytes > 0, 'the note is larger than its frames');
  const options = { ...base, freeBytes };
  assert.equal(m4aFixtureParts(options).byteSize, size, 'the fixture is exactly the asked size');
  return options;
}

async function main() {
  await rt.client.connect();
  const [a, b] = [randomUUID(), randomUUID()];
  const humans = [a, b];
  let gates = null;
  let app = null;
  let gateway = null;
  let fake = null;
  let failure = null;
  const owner = () => rt.asRole('postgres');
  const svc = async (sql, values = []) => {
    await rt.asRole('service_role');
    try { return await rows(sql, values); } finally { await owner(); }
  };
  const setGate = async (scope, flag, requirements) => {
    await owner();
    await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'prove-0186', 'live CP1 proof')`, [scope, flag, requirements]);
  };
  const grant = async (user) => (await svc('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), 'VOICE_RECORDING_V1']))[0].outcome;
  const revoke = async (user) => (await svc('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()]))[0].outcome;
  const noteOf = async (id) => (await rows(`SELECT state, failure_class, transcript_text IS NOT NULL AS has_text, asr_confidence_band
      FROM voice_private.note_transcriptions WHERE recording_id = $1`, [id]))[0];
  const newSession = async (user) => {
    const id = randomUUID();
    await owner();
    await rows("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
    return id;
  };

  try {
    stage = 'gateway, the fake batch API and the compiled modules';
    gateway = await startGateway();
    fake = await startFakeBatchApi();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'prove-0186-gateway';
    process.env.SUPABASE_SECRET_KEY = 'prove-0186-gateway-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role' });
    class ProveVoiceNotesModule {}
    Module({ imports: [VoiceMediaModule] })(ProveVoiceNotesModule);
    app = await NestFactory.create(ProveVoiceNotesModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const tokens = { a: jwt({ sub: a, role: 'authenticated' }), b: jwt({ sub: b, role: 'authenticated' }) };
    const media = app.get(VoiceMediaService);
    const notes = app.get(VoiceNotesRepository);
    assert.equal(app.get(PRIVATE_AUDIO_OBJECT_STORE).isConfigured(), true, 'the S3 audio adapter is configured from the CI-only environment');
    // The compiled adapter, pointed at the loopback fake (the config refuses plain http anywhere else).
    const batchConfig = loadSpeechmaticsBatchConfig({ SPEECHMATICS_API_KEY: FAKE_KEY, SPEECHMATICS_BATCH_BASE_URL: `http://127.0.0.1:${fake.server.address().port}` });
    const adapter = new SpeechmaticsBatchJobsAdapter(batchConfig);
    const worker = new VoiceNoteTranscriptionWorker(notes, media, { enabled: true, concurrency: 1, thresholds: { high: 0.85, medium: 0.65 } }, adapter);

    const send = (token, method, path, { headers = {}, body = null } = {}) => new Promise((resolve, reject) => {
      const request = http.request(`${api}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const bytes = Buffer.concat(chunks);
          resolve({ status: response.statusCode, json: bytes.length > 0 && String(response.headers['content-type'] ?? '').includes('json') ? JSON.parse(bytes.toString('utf8')) : null });
        });
      });
      request.on('error', reject);
      if (body === null) request.end();
      else if (Buffer.isBuffer(body)) request.end(body);
      else body.pipe(request);
    });
    const uploadNote = async (token, session, size, durationMs) => {
      const answer = await send(token, 'POST', `/voice/notes/${session}/${randomUUID()}`, {
        headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(size) }, body: Readable.from(streamM4aFixture(noteOptions(size, durationMs))) });
      assert.equal(answer.json?.outcome, 'ACCEPTED', `the note is accepted (${JSON.stringify(answer.json)})`);
      return answer.json.recordingId;
    };

    stage = 'fixtures: two humans, two conversations, the gates captured';
    await rt.provisionHumans(humans);
    const sessionA = await newSession(a);
    const sessionB = await newSession(b);
    gates = {
      states: await rows('SELECT * FROM voice_private.voice_launch_capability_states ORDER BY capability_scope'),
      lastEvent: Number((await rows('SELECT coalesce(max(id), 0) AS id FROM voice_private.voice_launch_capability_events'))[0].id),
    };
    const before = voiceFiles();

    stage = 'P01 on the wire: no client role reaches a 0186 server definer';
    for (const [token, label] of [[null, 'anon'], [tokens.a, 'authenticated']]) {
      for (const [name, body] of [
        ['server_claim_voice_note_transcription_v1', { p_worker: 'x', p_lease_seconds: 60, p_limit: 1 }],
        ['server_read_voice_note_status_v1', { p_user_id: a, p_recording_id: randomUUID() }],
        ['server_commit_voice_note_turn_v1', { p_user_id: a, p_recording_id: randomUUID() }],
        ['server_read_memory_command_voice_v1', { p_user_id: a, p_session_id: sessionA, p_turn_id: randomUUID(), p_command_id: null }],
        ['server_read_machine_asr_memory_confidence_v1', {}],
        ['server_list_voice_note_unsettled_attempts_v1', { p_grace_seconds: 900, p_limit: 1 }],
      ]) {
        const status = await wire(token, name, body);
        assert.ok([401, 403, 404].includes(status), `P01 ${label} is refused ${name} (${status})`);
      }
    }

    stage = 'P02 A19 a 24 MiB note streams to the batch API within the memory bound';
    await setGate('PERSONAL_VOICE_NOTE', 'ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
    assert.deepEqual([await grant(a), await grant(b)], ['GRANTED', 'GRANTED']);
    const size = 24 * MiB;
    const large = await uploadNote(tokens.a, sessionA, size, 590_000);
    // An accepted recording has no transcription row until the worker claims it; the owner status RPC derives PROCESSING.
    const accepted = await send(tokens.a, 'GET', `/voice/notes/${large}/status`);
    assert.equal(accepted.status, 200, 'P02 the owner can read an accepted note before transcription');
    assert.equal(accepted.json?.status, 'PROCESSING', 'P02 an accepted note waits for transcription');
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc');
    const liveBuffers = () => { gc(); gc(); return process.memoryUsage().arrayBuffers; };
    const measure = async (run) => {
      for (let i = 0; i < 3; i += 1) { gc(); await sleep(50); }
      const base = liveBuffers();
      let peak = 0;
      let samples = 0;
      let running = true;
      const sampler = (async () => { while (running) { peak = Math.max(peak, liveBuffers() - base); samples += 1; await sleep(20); } })();
      try { await run(); } finally { running = false; await sampler; }
      return { growth: peak, samples };
    };
    fake.state.plan = 'done';
    fake.state.received = 0;
    const transfer = await measure(async () => { await worker.runOnce(); });
    console.log(`P02 A19: ${size} bytes sent, live payload growth peak ${transfer.growth} bytes over ${transfer.samples} samples (bound ${STREAM_MEMORY_BOUND})`);
    assert.ok(transfer.samples >= 5, 'P02 the instrument sampled throughout the send');
    assert.ok(fake.state.received > size, `P02 the fake received the whole note in its multipart body (${fake.state.received})`);
    assert.ok(transfer.growth <= STREAM_MEMORY_BOUND, `P02 the payload held stayed within ${STREAM_MEMORY_BOUND} bytes (${transfer.growth})`);
    const held = await measure(async () => { const whole = Buffer.alloc(size, 1); await sleep(200); assert.equal(whole.length, size); });
    assert.ok(held.growth > STREAM_MEMORY_BOUND, `P02 a deliberately held note exceeds the bound - the instrument can fail (${held.growth})`);
    const ready = await noteOf(large);
    assert.deepEqual([ready.state, ready.has_text, ready.asr_confidence_band], ['READY', true, 'HIGH'], 'P02 the note is READY with its text and band');
    assert.equal(fake.state.deletes.length, 1, 'P02 the job was deleted after the result');
    const [call] = await rows(`SELECT c.call_state FROM public.ai_provider_calls c WHERE c.user_id = $1 AND c.provider = 'SPEECHMATICS'`, [a]);
    assert.ok(call && call.call_state !== 'PENDING', `P02 the attempt is settled (${call?.call_state})`);
    const status = await send(tokens.a, 'GET', `/voice/notes/${large}/status`);
    assert.equal(status.json?.status, 'READY', 'P02 the owner sees READY');
    assert.doesNotMatch(JSON.stringify(status.json), /مهندس|HIGH|job/u, 'P02 the status carries no text, band or job');
    assert.equal((await send(tokens.b, 'GET', `/voice/notes/${large}/status`)).status, 404, 'P02 another human: 404');

    stage = 'P03 A24 consent withdrawn while a job runs: held, no text kept, the job deleted';
    const small = await uploadNote(tokens.b, sessionB, 256 * 1024, 4_000);
    fake.state.plan = 'running';
    const deletesBefore = fake.state.deletes.length;
    const run = worker.runOnce();
    for (let i = 0; i < 100 && fake.jobs.size === 0; i += 1) await sleep(50);
    assert.equal(fake.jobs.size, 1, 'P03 the job was created');
    assert.equal(await revoke(b), 'WITHDRAWN');
    await run;
    const heldNote = await noteOf(small);
    assert.deepEqual([heldNote.state, heldNote.has_text], ['HELD_CONSENT', false], 'P03 the note is held and keeps no text');
    assert.equal(fake.state.deletes.length, deletesBefore + 1, 'P03 the running job was deleted');
    const [heldCall] = await rows(`SELECT c.call_state FROM public.ai_provider_calls c WHERE c.user_id = $1 AND c.provider = 'SPEECHMATICS'`, [b]);
    assert.ok(heldCall && heldCall.call_state.startsWith('FAILED'), `P03 the attempt is settled as a failure (${heldCall?.call_state})`);
    assert.equal(fake.state.unauthorized, 0, 'the fake never saw a request without its key');

    stage = 'P04 the gates closed again';
    await setGate('PERSONAL_VOICE_NOTE', 'DISABLED', 'UNSATISFIED');
    console.log(`Verified S8B-03 CP1 Personal Voice Notes through live PostgREST ${version} and rclone serve s3 (a CI stand-in, not a hosted proof) with the compiled API, worker and batch adapter against a loopback fake: wire refusals, a 24 MiB note streamed within the memory bound, and consent withdrawn mid-job.`);
    void before;
  } catch (error) {
    failure = { stage, error };
  }

  stage = 'fixture removal';
  const removal = await (async () => {
    const audioStore = app ? app.get(PRIVATE_AUDIO_OBJECT_STORE) : null;
    if (app) await app.close();
    if (gateway) { gateway.closeAllConnections(); await new Promise((resolve) => { gateway.close(() => resolve()); }); }
    if (fake) { fake.server.closeAllConnections(); await new Promise((resolve) => { fake.server.close(() => resolve()); }); }
    await owner();
    const voiceKeys = (await rows(`SELECT o.storage_key FROM voice_private.recording_objects o
        JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.user_id = ANY($1::uuid[])`, [humans])).map((r) => r.storage_key);
    if (audioStore) for (const key of voiceKeys) await audioStore.remove(key, AbortSignal.timeout(15_000)).catch(() => undefined);
    await rows('BEGIN');
    try {
      await rows("SET LOCAL session_replication_role = 'replica'");
      const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
      const calls = 'SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])';
      await rows('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [voiceKeys]);
      await rows(`DELETE FROM voice_private.note_transcription_attempts WHERE recording_id IN (${recordings})`, [humans]);
      await rows(`DELETE FROM voice_private.note_transcriptions WHERE recording_id IN (${recordings})`, [humans]);
      const ratings = `SELECT id FROM public.ai_cost_ratings WHERE provider_call_id IN (${calls})`;
      await rows(`DELETE FROM public.ai_credit_ratings WHERE cost_rating_id IN (${ratings})`, [humans]);
      await rows(`DELETE FROM public.ai_cost_rating_components WHERE cost_rating_id IN (${ratings})`, [humans]);
      await rows(`DELETE FROM public.ai_cost_ratings WHERE provider_call_id IN (${calls})`, [humans]);
      await rows(`DELETE FROM public.ai_provider_call_usage WHERE provider_call_id IN (${calls})`, [humans]);
      await rows('DELETE FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
      await rows(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
      await rows('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
      if (gates) {
        await rows('DELETE FROM voice_private.voice_launch_capability_events WHERE id > $1', [gates.lastEvent]);
        for (const s of gates.states) {
          await rows(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
              restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
          [s.capability_scope, s.feature_flag_state, s.launch_requirements_state, s.restriction_version, s.decided_by, s.policy_basis, s.decided_at]);
        }
      }
      await rows('DELETE FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows("SET LOCAL session_replication_role = 'origin'");
      await rows('COMMIT');
    } catch (error) {
      await rows('ROLLBACK').catch(() => undefined);
      throw error;
    }
    await rt.removeFixtureHumans(humans);
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM voice_private.note_transcriptions WHERE user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED')
        + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
    assert.equal(Number(residue), 0, 'the run leaves no voice row, ledger row, open gate or fixture human behind');
    assert.deepEqual(voiceFiles().filter((k) => voiceKeys.some((key) => k === key)), [], 'every voice object of this run is gone - by the directory');
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure && removal) {
    stage = failure.stage;
    throw new AggregateError([failure.error, removal], `${failure.error?.message ?? failure.error}; the fixture removal ALSO failed: ${removal?.message ?? removal}`);
  }
  if (failure) { stage = failure.stage; throw failure.error; }
  if (removal) throw removal;
}

try {
  await main();
} catch (error) {
  console.error(`S8B-03 CP1 voice notes proof (PostgREST ${version}) failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
