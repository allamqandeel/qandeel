// S8B-02 (CP2) - live proof of the voice media lifecycle THROUGH a real PostgREST server and a real S3 server, driven by
// the API's OWN compiled code (apps/api/dist, built earlier in the same CI job): the compiled VoiceMediaModule on a real
// HTTP port, its S3 adapter against `rclone serve s3` (a real S3-protocol server, not a mock), PostgREST for the
// database, the shared erasure worker, the retention and recovery workers, and Export My Data's voice manifest - with
// the storage server's data directory and access log as the independent witnesses. Every audio byte is synthetic.
// Nothing here is a hosted proof: rclone is a CI stand-in for the private store (B13; QAN-BL-PROD-08 owns the hosted one).
//
//   V01  B12      every gate DISABLED: an upload answers NOT_AVAILABLE_NOW; nothing is stored, no recording exists
//   V02  B1       gate open, no consent: CONSENT_REQUIRED, nothing stored
//   V03  B1       a note is streamed to exactly the database's key, byte for byte; no key reaches the client; expiry is
//                 accepted_at + 30 days; every answer is no-store, private
//   V04  B1 B8    whole (200) and Range (206 / suffix / 416) reads, the bytes the store holds; reads never extend retention
//   V05  B11 B10  another human: 404 on read, object and delete (nothing read from storage for them, the log); a client-sent
//                 key is never an identifier; an error answer carries only its outcome; without a token: 401
//   V06  B10 B6   a 24 MiB note flows to the store while the client is still sending (never held whole); a client that
//                 disconnects mid-upload leaves no object and a DISCARDED note; TOO_LARGE / UNSUPPORTED store nothing
//   V06m B10      bounded memory, the acceptance bound: 50 MiB of synthetic notes (24 + 24 + 2 MiB, each under the 25 MiB
//                 ceiling) streamed up and read back whole; the payload bytes the process still holds (live ArrayBuffer
//                 memory after a collection, sampled throughout) never exceed STREAM_MEMORY_BOUND (16 MiB, less than one
//                 note); a deliberately held 24 MiB note exceeds the bound (the instrument can fail); RSS is reported;
//                 the notes are then deleted and erased
//   V07  B3       owner deletion: refused at once while the object still exists; the shared worker erases it (DELETE, HEAD
//                 404, the data directory); a second deletion is ALREADY_GONE
//   V07b B7       storage failures on the live path: a failing PUT discards the note (503, nothing readable); a failing GET
//                 is 503 with nothing partial; a failing DELETE or HEAD is never confirmed, and the retry erases
//   V08  B1 B8    expiry at the instant: readable a moment before, refused at the instant with NO worker run; the retention
//                 worker expires it and the shared worker erases it
//   V09  B2 B6 B8 a call: USER and QANDEEL segments in order, an out-of-order index refused, a RECONNECTION gap kept, the
//                 owner's deletion erases every segment; a call RECORDING past its expiry is sealed RECOVERY by the sweep
//                 (its pending segment a WRITER_LOSS gap) and erased; a writer that went silent is sealed by the recovery
//                 worker and stays readable; neither reconnection nor recovery moves the expiry
//   V10  B5       PRIV-W races on live connections: a withdrawal during an upload discards the note (the landed object waits
//                 out its deadline, then is erased); a withdrawal between a segment's PUT and its store refuses the store;
//                 a late PUT under a terminal key and an unknown orphan are found by the listing reconciliation; live keys
//                 are never queued
//   V11  B9       Export My Data: the voice manifest beside the photo manifest (no key, no id, no base64); every listed file
//                 byte for byte by the per-file route; another reader's file is NO_LONGER_AVAILABLE; a deleted one too
//   V12  B4 B6 B7 account erasure: photos and voice together through the one queue; reads end at the due instant; a voice
//                 store outage defers voice keys and media_erased_at waits; a crashed worker's leases are re-claimed after
//                 they lapse; media_erased_at is set only when the last key is proven gone
//   V13  B11      on the wire: no client role reaches a voice definer; the storage server refuses unsigned requests
//   V14  B12 B13  every gate is back to DISABLED; the data directory holds nothing of this run; rclone is never claimed as
//                 a hosted proof
//
// It needs DATABASE_URL, POSTGREST_URL, POSTGREST_JWT_SECRET, the CI-only QANDEEL_MEDIA_S3_* values, RCLONE_DATA_DIR and
// RCLONE_LOG_FILE (as prove-0162), and a built API. Every fixture is removed afterwards; the gates, consent texts and
// seams are restored exactly.
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { PassThrough, Readable } from 'node:stream';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { I07D_SEAMS, PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
const dataDir = process.env.RCLONE_DATA_DIR;
const logFile = process.env.RCLONE_LOG_FILE;
const bucket = process.env.QANDEEL_MEDIA_S3_BUCKET;
for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, POSTGREST_JWT_SECRET: secret, RCLONE_DATA_DIR: dataDir,
  RCLONE_LOG_FILE: logFile, QANDEEL_MEDIA_S3_BUCKET: bucket, QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT })) {
  if (!value) throw new Error(`${name} is required.`);
}
process.env.NODE_ENV = 'test';

const rt = createIntroductionRuntime(databaseUrl);
const { rows } = rt;
let stage = 'load the compiled API';
const sharp = require('sharp');
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');
const { IntroductionsDisclosureModule } = require('../apps/api/dist/introductions-disclosure/introductions-disclosure.module.js');
const { IntroductionDisclosureRepository } = require('../apps/api/dist/introductions-disclosure/introduction-disclosure.repository.js');
const { IntroductionMediaErasureWorker } = require('../apps/api/dist/introductions-disclosure/introduction-media-erasure.worker.js');
const { S3IntroductionMediaStore } = require('../apps/api/dist/introductions-disclosure/introduction-media.store.js');
const { VoiceMediaModule } = require('../apps/api/dist/voice-media/voice-media.module.js');
const { VoiceMediaService } = require('../apps/api/dist/voice-media/voice-media.service.js');
const { VoiceMediaRepository } = require('../apps/api/dist/voice-media/voice-media.repository.js');
const { VoiceRetentionWorker } = require('../apps/api/dist/voice-media/voice-retention.worker.js');
const { VoiceRecordingRecoveryWorker } = require('../apps/api/dist/voice-media/voice-recording-recovery.worker.js');
const { PRIVATE_AUDIO_OBJECT_STORE } = require('../apps/api/dist/voice-media/private-audio-object.store.js');
const { PrivacyDataController } = require('../apps/api/dist/account/privacy-data.controller.js');
const { PrivacyDataService } = require('../apps/api/dist/account/privacy-data.service.js');
const { PrivacyDataRepository } = require('../apps/api/dist/account/privacy-data.repository.js');
const { SupabasePasswordGrantService } = require('../apps/api/dist/account/supabase-password-grant.service.js');
const { SupabaseAuthGuard } = require('../apps/api/dist/auth/supabase-auth.guard.js');
const { SupabaseAuthService } = require('../apps/api/dist/auth/supabase-auth.service.js');
const { SupabaseDataApiService } = require('../apps/api/dist/conversation/supabase-data-api.service.js');
const { SupabaseServiceRoleApiService } = require('../apps/api/dist/conversation/supabase-service-role-api.service.js');

const MiB = 1024 * 1024;
/**
 * B10's acceptance bound: the payload bytes the process may still hold at any instant while 50 MiB of voice is streamed.
 *
 * It is measured as live ArrayBuffer memory, not as RSS. RSS growth counts allocator churn from bytes already released.
 * At loopback speed this was measured at 8 - 22 MiB with a server that only discards the body (no SDK) and RSS back to
 * ~0 after a collection. So it cannot tell a held note from bytes passing through (record §11.7).
 */
const STREAM_MEMORY_BOUND = 16 * MiB;
const VOICE_KEY = /^voice-(note|call)\/[0-9a-f-]{36}$/u;
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
          .end(JSON.stringify({ id: sub, email: 'reader@prove-0185.test', email_confirmed_at: '2026-10-01T00:00:00Z' }));
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
async function wire(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, { method: 'POST', body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// ---- the independent witnesses
function filesUnder(root) {
  if (!existsSync(root)) return [];
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path.slice(root.length + 1).replace(/\\/gu, '/')];
  });
  return walk(root);
}
const bucketDir = () => join(dataDir, bucket);
const voiceFiles = () => filesUnder(bucketDir()).filter((f) => f.startsWith('voice-'));
const fileOf = (key) => join(bucketDir(), ...key.split('/'));
const onDisk = (key) => existsSync(fileOf(key));
const logSize = () => (existsSync(logFile) ? statSync(logFile).size : 0);
function voiceReadsSince(offset) {
  const text = readFileSync(logFile).subarray(offset).toString('utf8');
  return [...text.matchAll(/GET OBJECT Bucket: \S+ Object: (voice-(?:note|call)\/[0-9a-f-]{36})/gu)].map((m) => m[1]);
}
/** Synthetic audio: a fixed container-like prefix and a deterministic body. Never a human voice. */
function synth(bytes, seed) {
  const out = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i += 1) out[i] = (i * 31 + seed * 17) % 251;
  Buffer.from('....ftypM4A synthetic').copy(out, 0);
  return out;
}
async function photo() {
  const pixels = Buffer.alloc(700 * 900 * 3);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = (i / 3) % 251; pixels[i + 1] = (i / 5) % 253; pixels[i + 2] = 60; }
  return sharp(pixels, { raw: { width: 700, height: 900, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  await rt.client.connect();
  const [a, b, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const humans = [a, b, outsider];
  const consentVersion = `PROVE_0185_${randomUUID().replace(/-/gu, '').slice(0, 12).toUpperCase()}`;
  const seams = [];
  const strayKeys = [];
  let gates = null;
  let app = null;
  let gateway = null;
  let failure = null;

  // ---- database helpers (the fixture owner; service_role only where a server definer is called)
  const owner = () => rt.asRole('postgres');
  const svc = async (sql, values = []) => {
    await rt.asRole('service_role');
    try { return await rows(sql, values); } finally { await owner(); }
  };
  const surgery = async (sql, values = []) => {
    await owner();
    await rows('BEGIN');
    try {
      await rows("SET LOCAL session_replication_role = 'replica'");
      const result = await rows(sql, values);
      await rows('COMMIT');
      return result;
    } catch (error) {
      await rows('ROLLBACK').catch(() => undefined);
      throw error;
    }
  };
  const setGate = async (scope, flag, requirements) => {
    await owner();
    await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'prove-0185', 'live CP2 proof')`, [scope, flag, requirements]);
  };
  const grant = async (user) => (await svc('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), consentVersion]))[0].outcome;
  const revoke = async (user) => (await svc('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()]))[0].outcome;
  const recording = async (id) => (await rows(`SELECT recording_state, sealed_by, accepted_at, started_at, retention_expires_at
      FROM voice_private.recordings WHERE id = $1`, [id]))[0];
  const keysOf = async (id) => (await rows('SELECT track, segment_index, storage_key, object_state FROM voice_private.recording_objects WHERE recording_id = $1 ORDER BY track, segment_index', [id]));
  const queuedOf = async (keys) => (await rows('SELECT storage_key, not_before > clock_timestamp() AS waiting FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]) ORDER BY 1', [keys]));
  const dueNow = (keys) => rows('UPDATE introduction_sharing_private.media_erasure_queue SET not_before = clock_timestamp(), lease_id = NULL, lease_until = NULL WHERE storage_key = ANY($1::text[])', [keys]);
  const newSession = async (user) => {
    const id = randomUUID();
    await owner();
    await rows("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
    return id;
  };

  try {
    stage = 'gateway and the compiled modules';
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'prove-0185-gateway';
    process.env.SUPABASE_SECRET_KEY = 'prove-0185-gateway-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role' });
    // The sharing module (photos and the shared erasure worker, which imports the voice module) and Privacy & Data as
    // AccountModule composes it, with the voice module's routes.
    class ProveVoiceModule {}
    Module({
      imports: [IntroductionsDisclosureModule, VoiceMediaModule],
      controllers: [PrivacyDataController],
      providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService,
        PrivacyDataRepository, SupabasePasswordGrantService, PrivacyDataService],
    })(ProveVoiceModule);
    app = await NestFactory.create(ProveVoiceModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const tokens = { a: jwt({ sub: a, role: 'authenticated' }), b: jwt({ sub: b, role: 'authenticated' }), outsider: jwt({ sub: outsider, role: 'authenticated' }) };
    const voice = app.get(VoiceMediaService);
    const audioStore = app.get(PRIVATE_AUDIO_OBJECT_STORE);
    const eraser = app.get(IntroductionMediaErasureWorker);
    const retention = app.get(VoiceRetentionWorker);
    const recovery = app.get(VoiceRecordingRecoveryWorker);
    assert.equal(audioStore.isConfigured(), true, 'the S3 audio adapter is configured from the CI-only environment');

    /** One HTTP exchange; the body may be a Buffer or a Readable (streamed, never buffered by the harness). */
    const send = (token, method, path, { headers = {}, body = null } = {}) => new Promise((resolve, reject) => {
      const request = http.request(`${api}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const bytes = Buffer.concat(chunks);
          const json = String(response.headers['content-type'] ?? '').includes('json') && bytes.length > 0 ? JSON.parse(bytes.toString('utf8')) : null;
          resolve({ status: response.statusCode, headers: response.headers, bytes, json });
        });
      });
      request.on('error', reject);
      if (body === null) request.end();
      else if (Buffer.isBuffer(body)) request.end(body);
      else body.pipe(request);
    });
    /** A note upload whose body the harness feeds piece by piece. */
    const streamed = (token, session, command, length, type = 'audio/mp4') => {
      const source = new PassThrough();
      let request;
      const done = new Promise((resolve, reject) => {
        request = http.request(`${api}/voice/notes/${session}/${command}`, { method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': type, 'Content-Length': String(length) } }, (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
            json: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null }));
        });
        request.on('error', reject);
        source.pipe(request);
      });
      return { done, request: () => request,
        write: async (buffer) => { if (!source.write(buffer)) await once(source, 'drain'); },
        end: () => source.end() };
    };
    const upload = (token, session, bytes, type = 'audio/mp4', command = randomUUID()) =>
      send(token, 'POST', `/voice/notes/${session}/${command}`, { headers: { 'Content-Type': type, 'Content-Length': String(bytes.length) }, body: bytes });
    const noStore = (r, label) => assert.equal(r.headers['cache-control'], 'no-store, private', `${label}: no-store, private`);

    stage = 'fixtures: a real Introduction with a real photo, two conversations, the gates captured';
    await rt.provisionHumans(humans);
    for (const seam of [PFN.PREREQUISITES, ...I07D_SEAMS]) seams.push(await rt.captureMatchingSeam(seam));
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    await rt.recordFacts(a, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(b, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToIntroduction(a, b);
    await owner();
    const sessionA = await newSession(a);
    const sessionB = await newSession(b);
    gates = {
      states: await rows('SELECT * FROM voice_private.voice_launch_capability_states ORDER BY capability_scope'),
      lastEvent: Number((await rows('SELECT coalesce(max(id), 0) AS id FROM voice_private.voice_launch_capability_events'))[0].id),
    };
    const photoUp = await send(tokens.a, 'POST', `/introductions/worlds/${f.world}/image/${randomUUID()}`, { headers: { 'Content-Type': 'image/jpeg' }, body: await photo() });
    assert.equal(photoUp.json?.outcome, 'READY', `A's photo is READY (${JSON.stringify(photoUp.json)})`);
    const photoKeys = (await rows('SELECT storage_key FROM introduction_sharing_private.image_renditions WHERE series_id = $1', [photoUp.json.seriesId])).map((r) => r.storage_key);
    const before = voiceFiles();

    stage = 'V01 B12 every gate DISABLED: nothing is stored';
    assert.equal(Number((await rows("SELECT count(*) n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'DISABLED'"))[0].n), 4, 'V01 the four scopes start DISABLED');
    const closed = await upload(tokens.a, sessionA, synth(4096, 1));
    assert.deepEqual([closed.status, closed.json], [200, { outcome: 'NOT_AVAILABLE_NOW' }], 'V01 NOT_AVAILABLE_NOW');
    noStore(closed, 'V01');
    assert.deepEqual(voiceFiles(), before, 'V01 the data directory is unchanged');
    assert.equal(Number((await rows('SELECT count(*) n FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]))[0].n), 0, 'V01 no recording');

    stage = 'V02 B1 gate open, no consent: nothing is stored';
    await setGate('PERSONAL_VOICE_NOTE', 'ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
    await setGate('PERSONAL_LIVE_CALL', 'ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
    assert.deepEqual((await upload(tokens.a, sessionA, synth(4096, 2))).json, { outcome: 'CONSENT_REQUIRED' }, 'V02 CONSENT_REQUIRED');
    assert.deepEqual(voiceFiles(), before, 'V02 the data directory is unchanged');
    await owner();
    await rows("SELECT * FROM voice_private.install_consent_text_v1($1, 'نص موافقة للإثبات فقط', 'proof-only consent text')", [consentVersion]);
    assert.deepEqual([await grant(a), await grant(b)], ['GRANTED', 'GRANTED']);

    stage = 'V03 B1 a note: exactly the database key, byte for byte, no key to the client, 30 days from acceptance';
    const noteBytes = synth(300 * 1024, 3);
    const up = await upload(tokens.a, sessionA, noteBytes);
    assert.equal(up.json?.outcome, 'ACCEPTED', `V03 ACCEPTED (${JSON.stringify(up.json)})`);
    noStore(up, 'V03');
    assert.equal(/voice-(note|call)\//u.test(JSON.stringify(up.json)), false, 'V03 the client never sees a storage key');
    const note = up.json.recordingId;
    const [noteKey] = (await keysOf(note)).map((k) => k.storage_key);
    assert.deepEqual(voiceFiles().filter((k) => !before.includes(k)), [noteKey], 'V03 exactly the key the database chose');
    assert.equal(readFileSync(fileOf(noteKey)).equals(noteBytes), true, 'V03 the stored object is the uploaded bytes');
    const n0 = await recording(note);
    assert.equal(n0.recording_state, 'STORED');
    assert.equal(n0.retention_expires_at.getTime() - n0.accepted_at.getTime(), 30 * 86_400_000, 'V03 expiry is accepted_at + 30 days');
    assert.equal(Date.parse(up.json.availableUntil), n0.retention_expires_at.getTime(), 'V03 the answer names that expiry');

    stage = 'V04 B1 B8 whole and Range reads';
    const listed = await send(tokens.a, 'GET', `/voice/recordings/${note}`);
    assert.deepEqual(listed.json, { objects: [{ track: 'NOTE', segmentIndex: 0, contentType: 'audio/mp4', bytes: noteBytes.length, clockStartMs: null, clockEndMs: null }] });
    noStore(listed, 'V04 listing');
    const objectPath = `/voice/recordings/${note}/objects/NOTE/0`;
    const whole = await send(tokens.a, 'GET', objectPath);
    assert.deepEqual([whole.status, whole.headers['content-type'], whole.headers['accept-ranges']], [200, 'audio/mp4', 'bytes']);
    assert.equal(whole.bytes.equals(noteBytes), true, 'V04 the whole object');
    noStore(whole, 'V04 whole');
    const part = await send(tokens.a, 'GET', objectPath, { headers: { Range: 'bytes=100-1099' } });
    assert.deepEqual([part.status, part.headers['content-range'], part.bytes.length], [206, `bytes 100-1099/${noteBytes.length}`, 1000]);
    assert.equal(part.bytes.equals(noteBytes.subarray(100, 1100)), true, 'V04 the range is the stored bytes');
    noStore(part, 'V04 range');
    const tail = await send(tokens.a, 'GET', objectPath, { headers: { Range: 'bytes=-500' } });
    assert.deepEqual([tail.status, tail.bytes.equals(noteBytes.subarray(noteBytes.length - 500))], [206, true], 'V04 a suffix range');
    const beyond = await send(tokens.a, 'GET', objectPath, { headers: { Range: `bytes=${noteBytes.length}-` } });
    assert.equal(beyond.status, 416, 'V04 an unsatisfiable range is 416');
    noStore(beyond, 'V04 416');
    assert.equal((await recording(note)).retention_expires_at.getTime(), n0.retention_expires_at.getTime(), 'V04 reads never extend retention');

    stage = 'V05 B11 B10 another human, a client-sent key, no token';
    let mark = logSize();
    for (const [method, path] of [['GET', `/voice/recordings/${note}`], ['GET', objectPath], ['DELETE', `/voice/recordings/${note}`]]) {
      const r = await send(tokens.b, method, path);
      assert.equal(r.status, 404, `V05 ${method} ${path} is 404 for another human`);
      noStore(r, `V05 ${method}`);
    }
    assert.deepEqual((await send(tokens.b, 'GET', objectPath)).json, { outcome: 'NOT_FOUND' }, 'V05 an error answer carries only its outcome');
    await sleep(300);
    assert.deepEqual(voiceReadsSince(mark), [], 'V05 nothing was read from storage for another human');
    assert.equal((await recording(note)).recording_state, 'STORED', 'V05 their deletion changed nothing');
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${encodeURIComponent(noteKey)}`)).status, 404, 'V05 a storage key is never an identifier');
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${noteKey.split('/')[1]}`)).status, 404, 'V05 nor is the key\'s uuid');
    for (const [method, path] of [['POST', `/voice/notes/${sessionA}/${randomUUID()}`], ['GET', `/voice/recordings/${note}`], ['GET', objectPath], ['DELETE', `/voice/recordings/${note}`],
      ['GET', '/account/privacy/export/download/bundle/voice/qandeel-voice-note-20261030T000000000000Z.m4a']]) {
      assert.equal((await send(null, method, path)).status, 401, `V05 ${method} ${path} without a token is 401`);
    }

    stage = 'V06 B10 B6 streaming: never held whole; a disconnect leaves nothing; ceilings';
    const bigLength = 24 * MiB;
    const bigCommand = randomUUID();
    const big = streamed(tokens.a, sessionA, bigCommand, bigLength);
    const digest = createHash('sha256');
    const sample = { rss: process.memoryUsage().rss, peak: process.memoryUsage().rss };
    const sampler = setInterval(() => { sample.peak = Math.max(sample.peak, process.memoryUsage().rss); }, 20);
    let sent = 0;
    const chunkAt = (i) => Buffer.alloc(64 * 1024, (i * 7) % 251);
    for (; sent < 8 * MiB; sent += 64 * 1024) { const c = chunkAt(sent / 65536); digest.update(c); await big.write(c); }
    // The client has sent a third of the note and pauses: the store must already be receiving it.
    let landing = 0;
    for (let i = 0; i < 100 && landing < 4 * MiB; i += 1) {
      await sleep(100);
      landing = filesUnder(bucketDir()).filter((p) => p.startsWith('voice-note/') && !before.includes(p) && p !== noteKey)
        .reduce((sum, p) => sum + statSync(join(bucketDir(), ...p.split('/'))).size, 0);
    }
    assert.ok(landing >= 4 * MiB, `V06 the storage server holds ${landing} bytes while the client is still sending: the body is streamed, not buffered`);
    for (; sent < bigLength; sent += 64 * 1024) { const c = chunkAt(sent / 65536); digest.update(c); await big.write(c); }
    big.end();
    const bigAnswer = await big.done;
    clearInterval(sampler);
    assert.equal(bigAnswer.json?.outcome, 'ACCEPTED', `V06 the 24 MiB note is ACCEPTED (${JSON.stringify(bigAnswer.json)})`);
    const [bigKey] = (await keysOf(bigAnswer.json.recordingId)).map((k) => k.storage_key);
    assert.equal(createHash('sha256').update(readFileSync(fileOf(bigKey))).digest('hex'), digest.digest('hex'), 'V06 stored byte for byte');
    console.log(`V06 memory: API process RSS ${Math.round(sample.rss / MiB)} MiB before, peak ${Math.round(sample.peak / MiB)} MiB during a ${bigLength / MiB} MiB upload (informational; the landing witness above is the proof)`);
    const ranged = await send(tokens.a, 'GET', `/voice/recordings/${bigAnswer.json.recordingId}/objects/NOTE/0`, { headers: { Range: `bytes=${20 * MiB}-${20 * MiB + 9}` } });
    assert.deepEqual([ranged.status, ranged.bytes.length], [206, 10], 'V06 a range deep in a large object');
    // A client that goes away mid-upload.
    const dropCommand = randomUUID();
    const drop = streamed(tokens.a, sessionA, dropCommand, 4 * MiB);
    drop.done.catch(() => undefined);
    await drop.write(Buffer.alloc(MiB, 5));
    let dropped = null;
    for (let i = 0; i < 50 && !dropped; i += 1) {
      await sleep(100);
      dropped = (await rows('SELECT id FROM voice_private.recordings WHERE begin_command_id = $1', [dropCommand]))[0]?.id ?? null;
    }
    assert.ok(dropped, 'V06 the note was begun');
    const [dropKey] = (await keysOf(dropped)).map((k) => k.storage_key);
    drop.request().destroy();
    let dropState = null;
    for (let i = 0; i < 100 && dropState !== 'DISCARDED'; i += 1) { await sleep(100); dropState = (await recording(dropped)).recording_state; }
    assert.equal(dropState, 'DISCARDED', 'V06 the disconnect discards the note');
    for (let i = 0; i < 50 && filesUnder(bucketDir()).some((p) => /rclone_temp/u.test(p)); i += 1) await sleep(100);
    assert.equal(onDisk(dropKey), false, 'V06 no object under the key');
    assert.deepEqual(filesUnder(bucketDir()).filter((p) => /rclone_temp|\.partial/u.test(p)), [], 'V06 and no partial or hidden file');
    assert.equal((await queuedOf([dropKey])).length, 1, 'V06 its key is queued in case a late write lands');
    const tooLarge = await send(tokens.a, 'POST', `/voice/notes/${sessionA}/${randomUUID()}`, { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(26_214_401), Connection: 'close' }, body: Readable.from([Buffer.alloc(1024)]) }).catch((error) => ({ error }));
    if (!tooLarge.error) assert.deepEqual(tooLarge.json, { outcome: 'TOO_LARGE' }, 'V06 TOO_LARGE before any database act');
    assert.deepEqual((await upload(tokens.a, sessionA, synth(2048, 6), 'audio/wav')).json, { outcome: 'UNSUPPORTED' }, 'V06 UNSUPPORTED');
    assert.equal(Number((await rows("SELECT count(*) n FROM voice_private.recordings WHERE user_id = $1 AND recording_state = 'PENDING_UPLOAD'", [a]))[0].n), 0, 'V06 no refused upload left a pending note');

    stage = 'V06m B10 bounded memory: 50 MiB streamed, the payload held never over the bound';
    // The collector, without a command-line flag. A held note is reachable and is counted. Garbage awaiting a collection
    // is not counted.
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc');
    const settle = async () => { for (let i = 0; i < 3; i += 1) { gc(); await sleep(50); } return process.memoryUsage().rss; };
    // Live payload memory: two synchronous collections and the reading in ONE tick, so nothing is allocated between them
    // and the second completes the first's ArrayBuffer sweep.
    const liveBuffers = () => { gc(); gc(); return process.memoryUsage().arrayBuffers; };
    const measure = async (run) => {
      const rssBase = await settle();
      const base = liveBuffers();
      let peak = 0;
      let samples = 0;
      let rssPeak = rssBase;
      let running = true;
      const rssSampler = setInterval(() => { rssPeak = Math.max(rssPeak, process.memoryUsage().rss); }, 10);
      const sampler = (async () => {
        while (running) { peak = Math.max(peak, liveBuffers() - base); samples += 1; await sleep(20); }
      })();
      try { await run(); } finally { running = false; clearInterval(rssSampler); await sampler; }
      return { growth: peak, samples, after: liveBuffers() - base, rssBase, rssGrowth: rssPeak - rssBase };
    };
    // The harness allocates nothing per chunk: sixteen fixed, never-mutated 64 KiB patterns, varied by position.
    const patterns = Array.from({ length: 16 }, (_, i) => Buffer.alloc(64 * 1024, (i * 37 + 11) % 251));
    function* noteBody(length, digest) {
      for (let at = 0; at < length; at += 64 * 1024) {
        const chunk = patterns[(at / 65536) % 16].subarray(0, Math.min(64 * 1024, length - at));
        digest.update(chunk);
        yield chunk;
      }
    }
    /** A whole-object read consumed as it arrives: hashed and counted, never collected. */
    const drain = (path) => new Promise((resolve, reject) => {
      http.get(`${api}${path}`, { headers: { Authorization: `Bearer ${tokens.a}` } }, (response) => {
        const digest = createHash('sha256');
        let length = 0;
        response.on('data', (chunk) => { digest.update(chunk); length += chunk.length; });
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, length, sha: digest.digest('hex') }));
      }).on('error', reject);
    });
    const sizes = [24 * MiB, 24 * MiB, 2 * MiB];
    assert.equal(sizes.reduce((sum, n) => sum + n, 0), 50 * MiB, 'V06m 50 MiB of synthetic voice in all');
    assert.ok(sizes.every((n) => n <= 26_214_400), 'V06m every note under the 25 MiB object ceiling');
    const streamedNotes = [];
    const transfer = await measure(async () => {
      for (const size of sizes) {
        const digest = createHash('sha256');
        const answer = await send(tokens.a, 'POST', `/voice/notes/${sessionA}/${randomUUID()}`, {
          headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(size) }, body: Readable.from(noteBody(size, digest)) });
        assert.equal(answer.json?.outcome, 'ACCEPTED', `V06m a ${size / MiB} MiB note is ACCEPTED (${JSON.stringify(answer.json)})`);
        const sha = digest.digest('hex');
        const back = await drain(`/voice/recordings/${answer.json.recordingId}/objects/NOTE/0`);
        assert.deepEqual([back.status, back.length, back.sha], [200, size, sha], `V06m the ${size / MiB} MiB note reads back whole, byte for byte`);
        streamedNotes.push(answer.json.recordingId);
      }
    });
    const mib = (n) => (n / MiB).toFixed(1);
    console.log(`V06m memory: 50 MiB up and 50 MiB down; payload held at most ${mib(transfer.growth)} MiB over ${transfer.samples} samples, ${mib(transfer.after)} MiB after; bound ${STREAM_MEMORY_BOUND / MiB} MiB (RSS ${mib(transfer.rssBase)} MiB before, peak growth ${mib(transfer.rssGrowth)} MiB, reported only)`);
    assert.ok(transfer.samples >= 10, `V06m the instrument sampled throughout the transfer (${transfer.samples} samples)`);
    assert.ok(transfer.growth <= STREAM_MEMORY_BOUND, `V06m B10 the process held ${mib(transfer.growth)} MiB of payload while 50 MiB was streamed: over the ${STREAM_MEMORY_BOUND / MiB} MiB bound`);
    assert.ok(transfer.after <= STREAM_MEMORY_BOUND, 'V06m and nothing of the payload is held afterwards');
    // The control: the same instrument sees a note held whole.
    let held = null;
    const control = await measure(async () => { held = Buffer.alloc(24 * MiB, 9); await sleep(300); });
    assert.ok(control.growth > STREAM_MEMORY_BOUND, `V06m the control: a 24 MiB note held whole is seen as ${mib(control.growth)} MiB held, over the bound`);
    held = null;
    const streamedKeys = [];
    for (const id of streamedNotes) {
      streamedKeys.push(...(await keysOf(id)).map((k) => k.storage_key));
      assert.deepEqual((await send(tokens.a, 'DELETE', `/voice/recordings/${id}`)).json, { outcome: 'DELETED' }, 'V06m the measured notes are deleted');
    }
    await dueNow(streamedKeys);
    await eraser.runOnce();
    assert.deepEqual([streamedKeys.some(onDisk), (await queuedOf(streamedKeys)).length], [false, 0], 'V06m and erased');

    stage = 'V07 B3 owner deletion: refused at once, erased by the shared worker';
    const second = await upload(tokens.a, sessionA, synth(64 * 1024, 7));
    const deleted = second.json.recordingId;
    const [deletedKey] = (await keysOf(deleted)).map((k) => k.storage_key);
    const del = await send(tokens.a, 'DELETE', `/voice/recordings/${deleted}`);
    assert.deepEqual([del.status, del.json], [200, { outcome: 'DELETED' }]);
    noStore(del, 'V07');
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${deleted}/objects/NOTE/0`)).status, 404, 'V07 refused at once');
    assert.equal(onDisk(deletedKey), true, 'V07 while the object still exists');
    await eraser.runOnce();
    assert.equal(onDisk(deletedKey), false, 'V07 the data directory no longer holds it');
    assert.equal(await audioStore.exists(deletedKey, AbortSignal.timeout(5000)), false, 'V07 HEAD 404');
    assert.deepEqual(await queuedOf([deletedKey]), [], 'V07 confirmed only after the proof of absence');
    assert.deepEqual((await send(tokens.a, 'DELETE', `/voice/recordings/${deleted}`)).json, { outcome: 'ALREADY_GONE' }, 'V07 idempotent');

    stage = 'V07b B7 storage failures on the live path';
    // The composed store instance is the one the service holds: each failure is injected into it and removed at once.
    const inject = async (method, run) => {
      const original = audioStore[method];
      audioStore[method] = async () => { throw new Error(`injected ${method} failure`); };
      try { return await run(); } finally { audioStore[method] = original; }
    };
    const putCommand = randomUUID();
    const putFailed = await inject('putStream', () => upload(tokens.a, sessionA, synth(16 * 1024, 70), 'audio/mp4', putCommand));
    assert.deepEqual([putFailed.status, putFailed.json], [503, { outcome: 'UNAVAILABLE' }], 'V07b a failing PUT answers 503');
    noStore(putFailed, 'V07b PUT');
    const putFailedId = (await rows('SELECT id FROM voice_private.recordings WHERE begin_command_id = $1', [putCommand]))[0].id;
    assert.equal((await recording(putFailedId)).recording_state, 'DISCARDED', 'V07b and the note is discarded, never STORED');
    const getFailed = await inject('getRange', () => send(tokens.a, 'GET', objectPath));
    assert.deepEqual([getFailed.status, getFailed.json], [503, { outcome: 'UNAVAILABLE' }], 'V07b a failing GET is 503, nothing partial');
    noStore(getFailed, 'V07b GET');
    const failing = await upload(tokens.a, sessionA, synth(16 * 1024, 71));
    const failingKey = (await keysOf(failing.json.recordingId))[0].storage_key;
    assert.deepEqual((await send(tokens.a, 'DELETE', `/voice/recordings/${failing.json.recordingId}`)).json, { outcome: 'DELETED' });
    for (const method of ['remove', 'exists']) {
      await dueNow([failingKey]);
      await inject(method, () => eraser.runOnce());
      assert.equal((await queuedOf([failingKey])).length, 1, `V07b a failing ${method === 'remove' ? 'DELETE' : 'HEAD'} is never confirmed`);
    }
    assert.equal(Number((await rows('SELECT attempts FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = $1', [failingKey]))[0].attempts) >= 2, true, 'V07b each failure is counted');
    await dueNow([failingKey]);
    await eraser.runOnce();
    assert.deepEqual([onDisk(failingKey), (await queuedOf([failingKey])).length], [false, 0], 'V07b the retry erases it and only then confirms');

    stage = 'V08 B1 B8 expiry at the instant, before any worker';
    const third = await upload(tokens.a, sessionA, synth(32 * 1024, 8));
    const expiring = third.json.recordingId;
    const [expiringKey] = (await keysOf(expiring)).map((k) => k.storage_key);
    // now() is the transaction's one instant, so the 0183 CHECK (expiry = accepted_at + 30 days) holds exactly.
    await surgery(`UPDATE voice_private.recordings SET accepted_at = now() - interval '30 days' + interval '3 seconds',
                   retention_expires_at = now() + interval '3 seconds' WHERE id = $1`, [expiring]);
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${expiring}/objects/NOTE/0`)).status, 200, 'V08 readable a moment before its expiry');
    const [{ wait }] = await rows('SELECT greatest(0, extract(epoch FROM retention_expires_at - clock_timestamp()) * 1000)::int AS wait FROM voice_private.recordings WHERE id = $1', [expiring]);
    await sleep(wait + 200);
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${expiring}/objects/NOTE/0`)).status, 404, 'V08 refused at the instant');
    assert.equal((await recording(expiring)).recording_state, 'STORED', 'V08 with no worker having run');
    await retention.runOnce();
    assert.equal((await recording(expiring)).recording_state, 'EXPIRED', 'V08 the retention worker expires it');
    await eraser.runOnce();
    assert.equal(onDisk(expiringKey), false, 'V08 and the shared worker erases it');

    stage = 'V09 B2 B6 B8 a call: order, gaps, deletion; a RECORDING past its expiry; a silent writer';
    const segment = (seed) => synth(8000, seed);
    const openCall = async (startedSql, lease = 30) => (await svc(`SELECT * FROM public.server_open_call_recording_v1($1, $2, $3, ${startedSql}, $4)`, [a, sessionA, randomUUID(), lease]))[0];
    const call0 = await openCall('clock_timestamp()');
    assert.equal(call0.outcome, 'OPENED');
    const write = (rec, track, index, start, end, bytes) => voice.writeCallSegment(a, rec, track, index, start, end, Readable.from([bytes]), bytes.length, AbortSignal.timeout(30_000));
    const [cu0, cu1, cq0] = [segment(80), segment(81), segment(82)];
    assert.deepEqual(await write(call0.recording_id, 'USER', 0, 0, 1000, cu0), { outcome: 'STORED' });
    assert.deepEqual(await write(call0.recording_id, 'QANDEEL', 0, 0, 1200, cq0), { outcome: 'STORED' });
    assert.deepEqual(await write(call0.recording_id, 'USER', 2, 1500, 2500, cu1), { outcome: 'OUT_OF_ORDER' }, 'V09 an index out of order is refused, nothing stored');
    assert.deepEqual(await write(call0.recording_id, 'USER', 1, 1500, 2500, cu1), { outcome: 'DISCONTINUOUS' }, 'V09 a hole in the clock needs its gap first');
    assert.equal((await svc('SELECT * FROM public.server_record_call_gap_v1($1, $2, $3, $4, $5, $6)', [a, call0.recording_id, 'USER', 1000, 1500, 'RECONNECTION']))[0].outcome, 'RECORDED');
    assert.deepEqual(await write(call0.recording_id, 'USER', 1, 1500, 2500, cu1), { outcome: 'STORED' }, 'V09 after the reconnection gap the next segment is admitted');
    assert.equal((await svc('SELECT * FROM public.server_seal_call_recording_v1($1, $2)', [a, call0.recording_id]))[0].outcome, 'SEALED');
    const c0 = await recording(call0.recording_id);
    assert.equal(c0.retention_expires_at.getTime() - c0.started_at.getTime(), 30 * 86_400_000, 'V09 started_at + 30 days, unmoved by the reconnection');
    assert.deepEqual((await send(tokens.a, 'GET', `/voice/recordings/${call0.recording_id}`)).json.objects.map((o) => [o.track, o.segmentIndex, o.clockStartMs, o.clockEndMs]),
      [['QANDEEL', 0, 0, 1200], ['USER', 0, 0, 1000], ['USER', 1, 1500, 2500]], 'V09 both tracks, in order, on the recording clock');
    const userOne = await send(tokens.a, 'GET', `/voice/recordings/${call0.recording_id}/objects/USER/1`);
    assert.deepEqual([userOne.status, userOne.headers['content-type'], userOne.bytes.equals(cu1)], [200, 'audio/ogg', true]);
    const call0Keys = (await keysOf(call0.recording_id)).map((k) => k.storage_key);
    assert.deepEqual((await send(tokens.a, 'DELETE', `/voice/recordings/${call0.recording_id}`)).json, { outcome: 'DELETED' }, 'V09 the owner deletes the call');
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${call0.recording_id}/objects/QANDEEL/0`)).status, 404, 'V09 refused at once');
    await eraser.runOnce();
    assert.equal(call0Keys.some(onDisk), false, 'V09 every segment is erased');
    const call1 = await openCall("clock_timestamp() - interval '30 days' + interval '6 seconds'");
    assert.equal(call1.outcome, 'OPENED');
    const s0 = segment(91);
    assert.deepEqual(await voice.writeCallSegment(a, call1.recording_id, 'USER', 0, 0, 1000, Readable.from([s0]), s0.length, AbortSignal.timeout(30_000)), { outcome: 'STORED' });
    const added = (await svc('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, $7, $8)', [a, call1.recording_id, 'USER', 1, 1000, 2000, 8000, 30]))[0];
    assert.equal(added.outcome, 'ADDED', 'V09 a second segment is pending');
    const call1Keys = (await keysOf(call1.recording_id)).map((k) => k.storage_key);
    assert.equal(onDisk(call1Keys[0]), true);
    for (let i = 0; i < 100; i += 1) {
      if ((await rows('SELECT retention_expires_at <= clock_timestamp() AS past FROM voice_private.recordings WHERE id = $1', [call1.recording_id]))[0].past) break;
      await sleep(100);
    }
    await retention.runOnce();
    const c1 = await recording(call1.recording_id);
    assert.deepEqual([c1.recording_state, c1.sealed_by], ['EXPIRED', 'RECOVERY'], 'V09 sealed RECOVERY, then expired');
    const [gap] = await rows("SELECT clock_start_ms::int s, clock_end_ms::int e FROM voice_private.recording_gaps WHERE recording_id = $1 AND gap_kind = 'WRITER_LOSS'", [call1.recording_id]);
    assert.deepEqual(gap, { s: 1000, e: 2000 }, 'V09 the pending segment became a WRITER_LOSS gap');
    assert.equal((await queuedOf(call1Keys)).length, 2, 'V09 both keys queued');
    await dueNow(call1Keys);
    await eraser.runOnce();
    assert.equal(call1Keys.some(onDisk), false, 'V09 erased');
    assert.deepEqual(await queuedOf(call1Keys), [], 'V09 both confirmed (the never-written one by HEAD 404 too)');
    const call2 = await openCall('clock_timestamp()');
    const u0 = segment(92);
    const q0 = segment(93);
    assert.deepEqual(await voice.writeCallSegment(a, call2.recording_id, 'USER', 0, 0, 1000, Readable.from([u0]), u0.length, AbortSignal.timeout(30_000)), { outcome: 'STORED' });
    assert.deepEqual(await voice.writeCallSegment(a, call2.recording_id, 'QANDEEL', 0, 0, 1000, Readable.from([q0]), q0.length, AbortSignal.timeout(30_000)), { outcome: 'STORED' });
    await surgery("UPDATE voice_private.recordings SET writer_lease_until = clock_timestamp() - interval '5 minutes' WHERE id = $1", [call2.recording_id]);
    await recovery.runOnce();
    const c2 = await recording(call2.recording_id);
    assert.deepEqual([c2.recording_state, c2.sealed_by], ['STORED', 'RECOVERY'], 'V09 the silent writer\'s recording is sealed RECOVERY');
    assert.equal(c2.retention_expires_at.getTime() - c2.started_at.getTime(), 30 * 86_400_000, 'V09 recovery does not move the expiry');
    const callRead = await send(tokens.a, 'GET', `/voice/recordings/${call2.recording_id}/objects/QANDEEL/0`);
    assert.deepEqual([callRead.status, callRead.headers['content-type'], callRead.bytes.equals(q0)], [200, 'audio/ogg', true], 'V09 and stays readable');

    stage = 'V10 B5 PRIV-W races, late writes and orphans';
    // (a) A withdrawal while the note is uploading.
    const raceCommand = randomUUID();
    const race = streamed(tokens.a, sessionA, raceCommand, 512 * 1024);
    await race.write(synth(128 * 1024, 10));
    let raced = null;
    for (let i = 0; i < 50 && !raced; i += 1) {
      await sleep(100);
      raced = (await rows('SELECT id FROM voice_private.recordings WHERE begin_command_id = $1', [raceCommand]))[0]?.id ?? null;
    }
    assert.ok(raced, 'V10 the upload has begun');
    const [raceKey] = (await keysOf(raced)).map((k) => k.storage_key);
    assert.equal(await revoke(a), 'WITHDRAWN');
    await race.write(synth(384 * 1024, 11));
    race.end();
    assert.deepEqual((await race.done).json, { outcome: 'CONSENT_REQUIRED' }, 'V10 the withdrawal wins: the note is refused');
    assert.equal((await recording(raced)).recording_state, 'DISCARDED', 'V10 and discarded, never STORED');
    assert.equal(onDisk(raceKey), true, 'V10 its object did land');
    assert.deepEqual(await queuedOf([raceKey]), [{ storage_key: raceKey, waiting: true }], 'V10 queued, waiting out the upload deadline');
    await eraser.runOnce();
    assert.equal(onDisk(raceKey), true, 'V10 not erased before the deadline');
    await dueNow([raceKey]);
    await eraser.runOnce();
    assert.equal(onDisk(raceKey), false, 'V10 erased after it');
    assert.equal(await grant(a), 'GRANTED');
    // (b) A withdrawal between a segment's PUT and its store.
    const call3 = await openCall('clock_timestamp()');
    const add3 = (await svc('SELECT * FROM public.server_add_call_segment_v1($1, $2, $3, $4, $5, $6, $7, $8)', [a, call3.recording_id, 'USER', 0, 0, 1000, 8000, 30]))[0];
    await audioStore.putStream(add3.storage_key, 'audio/ogg', Readable.from([segment(94)]), 8000, AbortSignal.timeout(30_000));
    assert.equal(await revoke(a), 'WITHDRAWN');
    assert.equal((await svc('SELECT * FROM public.server_store_call_segment_v1($1, $2, $3, $4, $5)', [a, call3.recording_id, 'USER', 0, 8000]))[0].outcome, 'CONSENT_REQUIRED', 'V10 the store is refused');
    assert.equal((await svc('SELECT * FROM public.server_seal_call_recording_v1($1, $2)', [a, call3.recording_id]))[0].outcome, 'SEALED', 'V10 the seal still works');
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${call3.recording_id}/objects/USER/0`)).status, 404, 'V10 the unstored segment is never readable');
    await dueNow([add3.storage_key]);
    await eraser.runOnce();
    assert.equal(onDisk(add3.storage_key), false, 'V10 its landed object is erased');
    assert.equal(await grant(a), 'GRANTED');
    // (c) A late PUT under a terminal key, and an orphan nobody knows.
    await audioStore.putStream(deletedKey, 'audio/mp4', Readable.from([synth(2048, 12)]), 2048, AbortSignal.timeout(10_000));
    const orphan = `voice-call/${randomUUID()}`;
    strayKeys.push(orphan);
    await audioStore.putStream(orphan, 'audio/ogg', Readable.from([synth(2048, 13)]), 2048, AbortSignal.timeout(10_000));
    assert.deepEqual([onDisk(deletedKey), onDisk(orphan)], [true, true]);
    const liveKeys = [noteKey, bigKey, ...(await keysOf(call2.recording_id)).map((k) => k.storage_key)];
    assert.ok(await eraser.reconcileVoice(new Date(Date.now() + 11 * 60_000)) >= 2, 'V10 the listing finds both');
    assert.deepEqual((await queuedOf([deletedKey, orphan])).map((r) => r.storage_key), [deletedKey, orphan].sort(), 'V10 both queued');
    assert.deepEqual(await queuedOf(liveKeys), [], 'V10 no live key is ever queued');
    await eraser.runOnce();
    assert.deepEqual([onDisk(deletedKey), onDisk(orphan)], [false, false], 'V10 both erased');
    assert.equal(liveKeys.every(onDisk), true, 'V10 every live object is untouched');

    stage = 'V11 B9 Export My Data: the voice manifest beside the photo manifest';
    for (const who of [a, b]) {
      const proof = jwt({ sub: who, role: 'authenticated', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] });
      assert.equal((await wire(proof, 'request_own_data_export_v1', { p_command_id: randomUUID() })).body?.[0]?.outcome, 'ACCEPTED');
    }
    assert.equal((await wire(jwt({ role: 'service_role' }), 'server_prepare_data_exports_v1', { p_limit: 10 })).status, 200);
    const bundle = await send(tokens.a, 'GET', '/account/privacy/export/download/bundle');
    assert.equal(bundle.json?.status, 'READY', `V11 READY (${bundle.bytes.toString('utf8').slice(0, 200)})`);
    assert.equal(bundle.json.photoManifest.files.length, 3, 'V11 the photo manifest is unchanged: A\'s three renditions');
    const manifest = bundle.json.voiceManifest;
    assert.equal(manifest.format, 'qandeel.personal-data-export.voice.v1');
    assert.deepEqual(manifest.files.map((x) => [x.recordingKind, x.track, x.mimeType]).sort(),
      [['LIVE_CALL', 'QANDEEL', 'audio/ogg'], ['LIVE_CALL', 'USER', 'audio/ogg'], ['VOICE_NOTE', 'NOTE', 'audio/mp4'], ['VOICE_NOTE', 'NOTE', 'audio/mp4']],
      'V11 exactly the readable recordings: the two notes and the recovered call (nothing expired, deleted or discarded)');
    const flat = JSON.stringify(manifest);
    assert.equal(/voice-(note|call)\/|base64|[0-9a-f]{8}-[0-9a-f]{4}-/iu.test(flat), false, 'V11 no key, no recording id, no inline bytes');
    const expected = new Map([[noteKey, noteBytes], [bigKey, null], ...(await keysOf(call2.recording_id)).map((k) => [k.storage_key, k.track === 'USER' ? u0 : q0])]);
    for (const file of manifest.files) {
      const r = await send(tokens.a, 'GET', `/account/privacy/export/download/bundle/voice/${file.fileName}`);
      assert.equal(r.status, 200, `V11 ${file.fileName}`);
      noStore(r, 'V11 file');
      assert.equal(r.headers['content-disposition'], `attachment; filename="${file.fileName}"`);
      assert.equal(r.bytes.length, file.bytes);
      const match = [...expected.keys()].find((k) => readFileSync(fileOf(k)).equals(r.bytes));
      assert.ok(match, `V11 ${file.fileName} is byte for byte a stored object`);
    }
    const noteFile = manifest.files.find((x) => x.recordingKind === 'VOICE_NOTE' && x.bytes === noteBytes.length).fileName;
    const otherReader = await send(tokens.b, 'GET', `/account/privacy/export/download/bundle/voice/${noteFile}`);
    assert.deepEqual([otherReader.status, otherReader.json], [404, { outcome: 'NO_LONGER_AVAILABLE' }], 'V11 another reader never receives it');
    assert.deepEqual((await send(tokens.b, 'GET', '/account/privacy/export/download/bundle')).json?.voiceManifest?.files, [], 'V11 B\'s manifest holds nothing of A\'s');
    assert.deepEqual((await send(tokens.a, 'DELETE', `/voice/recordings/${note}`)).json, { outcome: 'DELETED' });
    const gone = await send(tokens.a, 'GET', `/account/privacy/export/download/bundle/voice/${noteFile}`);
    assert.deepEqual([gone.status, gone.json], [404, { outcome: 'NO_LONGER_AVAILABLE' }], 'V11 a deleted recording is no longer exported');
    assert.equal((await send(tokens.a, 'GET', '/account/privacy/export/download/bundle')).json.voiceManifest.files.length, 3, 'V11 a fresh manifest omits it');
    await eraser.runOnce();
    assert.equal(onDisk(noteKey), false);

    stage = 'V12 B4 B6 B7 account erasure: photos and voice through the one queue';
    const aVoiceKeys = (await rows(`SELECT o.storage_key FROM voice_private.recording_objects o JOIN voice_private.recordings r ON r.id = o.recording_id
        WHERE r.user_id = $1 AND o.object_state = 'STORED' AND r.recording_state = 'STORED'`, [a])).map((r) => r.storage_key);
    assert.equal(aVoiceKeys.length, 3, 'V12 A still holds three voice objects (the large note and the call\'s two)');
    // The erasure tracks every key A's recordings ever named (0183 erase_voice_v1), history included: an absent one is
    // confirmed by DELETE then HEAD 404 like any other.
    const allVoiceKeys = (await rows(`SELECT o.storage_key FROM voice_private.recording_objects o JOIN voice_private.recordings r ON r.id = o.recording_id
        WHERE r.user_id = $1`, [a])).map((r) => r.storage_key);
    const [{ id: deletion }] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second') RETURNING id`, [a]);
    assert.equal((await send(tokens.a, 'GET', `/voice/recordings/${bigAnswer.json.recordingId}`)).status, 404, 'V12 reads end at the due instant, before the erasure runs');
    assert.equal((await wire(jwt({ role: 'service_role' }), 'server_erase_account_v1', { p_deletion_id: deletion })).body, 'ERASED', 'V12 ERASED');
    const pending = (await rows('SELECT storage_key FROM account_erasure_private.media_pending WHERE deletion_id = $1 ORDER BY 1', [deletion])).map((r) => r.storage_key);
    assert.deepEqual(pending, [...photoKeys, ...allVoiceKeys].sort(), 'V12 every photo and voice key of A is pending on this request');
    const progress = async () => (await rows('SELECT media_erased_at FROM account_erasure_private.deletion_progress WHERE deletion_id = $1', [deletion]))[0].media_erased_at;
    await dueNow(pending);
    const voiceRepository = app.get(VoiceMediaRepository);
    const photoRepository = new IntroductionDisclosureRepository(new SupabaseDataApiService(), new SupabaseServiceRoleApiService());
    const outage = { isConfigured: () => true, exists: (k, s) => audioStore.exists(k, s), listOlderThan: (...x) => audioStore.listOlderThan(...x),
      remove: async () => { throw new Error('injected voice store outage'); } };
    const outageWorker = new IntroductionMediaErasureWorker(photoRepository, new S3IntroductionMediaStore(), undefined, outage, voiceRepository);
    const r1 = await outageWorker.runOnce();
    assert.deepEqual([r1.erased >= 3, photoKeys.some(onDisk), aVoiceKeys.every(onDisk)], [true, false, true], 'V12 the photos are erased, the voice objects kept');
    assert.deepEqual((await queuedOf(allVoiceKeys)).map((r) => r.storage_key), [...allVoiceKeys].sort(), 'V12 every voice key is deferred, never confirmed');
    assert.equal(await progress(), null, 'V12 media_erased_at waits: a storage failure is never a success');
    // A worker that claims the keys and crashes: its leases hold, then lapse, and a fresh worker finishes.
    await dueNow(allVoiceKeys);
    const crashed = await wire(jwt({ role: 'service_role' }), 'server_claim_introduction_media_erasures_v1', { p_limit: 200, p_lease_seconds: 600 });
    assert.ok(allVoiceKeys.every((k) => crashed.body.some((c) => c.storage_key === k)), 'V12 the crashed worker held every voice key');
    const fresh = () => new IntroductionMediaErasureWorker(photoRepository, new S3IntroductionMediaStore(), undefined, audioStore, voiceRepository);
    await fresh().runOnce();
    assert.equal(aVoiceKeys.every(onDisk), true, 'V12 nothing is taken from under a live lease');
    assert.equal(await progress(), null);
    await rows("UPDATE introduction_sharing_private.media_erasure_queue SET lease_until = clock_timestamp() - interval '1 second', not_before = clock_timestamp() WHERE storage_key = ANY($1::text[])", [allVoiceKeys]);
    await fresh().runOnce();
    assert.equal(aVoiceKeys.some(onDisk), false, 'V12 after the lapse a fresh worker erases them');
    assert.notEqual(await progress(), null, 'V12 media_erased_at is set only now, after the last key');
    assert.equal(Number((await rows('SELECT count(*) n FROM account_erasure_private.media_pending WHERE deletion_id = $1', [deletion]))[0].n), 0, 'V12 nothing pending');
    assert.equal(Number((await rows('SELECT count(*) n FROM voice_private.recordings WHERE user_id = $1', [a]))[0].n), 0, 'V12 no voice row of A survives');

    stage = 'V13 B11 on the wire';
    const refused = (r, label) => assert.ok(([401, 403].includes(r.status) && r.body?.code === '42501') || (r.status === 404 && r.body?.code === 'PGRST202'),
      `${label} is not callable (${r.status} ${JSON.stringify(r.body)})`);
    for (const token of [tokens.b, jwt({ role: 'anon' })]) {
      refused(await wire(token, 'server_begin_voice_note_upload_v1', { p_user_id: b, p_session_id: sessionB, p_command_id: randomUUID(), p_byte_size: 10 }), 'begin');
      refused(await wire(token, 'server_read_voice_recording_objects_v1', { p_user_id: b, p_recording_id: randomUUID() }), 'read objects');
      refused(await wire(token, 'server_list_voice_recordings_v1', { p_user_id: b }), 'the export listing');
      refused(await wire(token, 'server_enqueue_unknown_voice_media_v1', { p_storage_keys: [] }), 'the reconciliation');
      refused(await wire(token, 'server_delete_voice_recording_v1', { p_user_id: b, p_recording_id: randomUUID() }), 'delete');
    }
    const unsigned = await fetch(`${process.env.QANDEEL_MEDIA_S3_ENDPOINT}/${bucket}?list-type=2&prefix=voice-`).then((r) => r.status);
    assert.ok([400, 401, 403].includes(unsigned), `V13 an unsigned request is refused (${unsigned})`);

    stage = 'V14 B12 B13 the gates closed again; nothing of this run is stored';
    await setGate('PERSONAL_VOICE_NOTE', 'DISABLED', 'UNSATISFIED');
    await setGate('PERSONAL_LIVE_CALL', 'DISABLED', 'UNSATISFIED');
    assert.deepEqual((await upload(tokens.b, sessionB, synth(2048, 14))).json, { outcome: 'NOT_AVAILABLE_NOW' }, 'V14 closed again');
    assert.deepEqual(voiceFiles().filter((k) => !before.includes(k) && VOICE_KEY.test(k)), [], 'V14 every voice object of this run is gone - by the directory');
    console.log(`Verified S8B-02 CP2 voice media lifecycle through live PostgREST ${version} and rclone serve s3 (a CI stand-in, not a hosted proof), with the compiled API: gates, consent, streamed upload and Range reads, isolation, owner deletion, expiry at the instant, RECORDING recovery, PRIV-W races, late writes and orphans, the voice export, and account erasure through the shared queue.`);
  } catch (error) {
    failure = { stage, error };
  }

  stage = 'fixture removal';
  const removal = await (async () => {
    const audioStore = app ? app.get(PRIVATE_AUDIO_OBJECT_STORE) : null;
    if (app) await app.close();
    if (gateway) { gateway.closeAllConnections(); await new Promise((resolve) => { gateway.close(() => resolve()); }); }
    await owner();
    const voiceKeys = [...strayKeys, ...(await rows(`SELECT o.storage_key FROM voice_private.recording_objects o
        JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.user_id = ANY($1::uuid[])`, [humans])).map((r) => r.storage_key)];
    if (audioStore) for (const key of voiceKeys) await audioStore.remove(key, AbortSignal.timeout(15_000)).catch(() => undefined);
    const photoStore = new S3IntroductionMediaStore();
    const photoKeys = (await rows(`SELECT storage_key FROM introduction_sharing_private.image_renditions WHERE series_id IN
        (SELECT s.id FROM introduction_sharing_private.image_series s WHERE s.world_id IN (SELECT world_id FROM public.introduction_records
          WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])))`, [humans])).map((r) => r.storage_key);
    for (const key of photoKeys) await photoStore.remove(key, AbortSignal.timeout(15_000)).catch(() => undefined);
    for (const seam of seams.reverse()) await rt.restoreMatchingSeam(seam);
    await rows('BEGIN');
    try {
      await rows("SET LOCAL session_replication_role = 'replica'");
      const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
      await rows('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [[...voiceKeys, ...photoKeys]]);
      await rows(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
      await rows(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
      await rows('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows('DELETE FROM voice_private.consent_texts WHERE version = $1', [consentVersion]);
      if (gates) {
        await rows('DELETE FROM voice_private.voice_launch_capability_events WHERE id > $1', [gates.lastEvent]);
        for (const s of gates.states) {
          await rows(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
              restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
          [s.capability_scope, s.feature_flag_state, s.launch_requirements_state, s.restriction_version, s.decided_by, s.policy_basis, s.decided_at]);
        }
      }
      const worlds = '(SELECT r.world_id FROM public.introduction_records r WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))';
      const seriesOf = `(SELECT s.id FROM introduction_sharing_private.image_series s WHERE s.world_id IN ${worlds})`;
      await rows(`DELETE FROM introduction_sharing_private.name_display_state WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.name_display_events WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_stage_disclosures WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_renditions WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_series WHERE world_id IN ${worlds}`, [humans]);
      await rows('DELETE FROM personal_data_private.data_exports WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows('DELETE FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[])', [humans]);
      await rows("SET LOCAL session_replication_role = 'origin'");
      await rows('COMMIT');
    } catch (error) {
      await rows('ROLLBACK').catch(() => undefined);
      throw error;
    }
    // V12's account erasure released the counterpart's matching anchor (0164). Both release tables reference the
    // participation events that cleanupIntroductionRace removes, and both are immutable. So the fixture's own rows go
    // first, under replica mode: the reactivation commands, then the releases.
    // The FK (anchor_event_id, participant_user_id) ties every release to its own participant's event, so the scope is
    // exactly the fixture humans. No other user's row is touched, and the count below witnesses it.
    const releasesOfOthers = async () => (await rows(`SELECT
        (SELECT count(*) FROM public.matching_counterpart_erasure_releases WHERE participant_user_id <> ALL($1::uuid[]))
      + (SELECT count(*) FROM public.matching_counterpart_erasure_reactivation_commands WHERE participant_user_id <> ALL($1::uuid[])) AS n`, [humans]))[0].n;
    const othersBefore = await releasesOfOthers();
    await surgery('DELETE FROM public.matching_counterpart_erasure_reactivation_commands WHERE participant_user_id = ANY($1::uuid[])', [humans]);
    await surgery('DELETE FROM public.matching_counterpart_erasure_releases WHERE participant_user_id = ANY($1::uuid[])', [humans]);
    assert.equal(await releasesOfOthers(), othersBefore, 'the release cleanup touched no row outside the fixture');
    await rt.cleanupIntroductionRace(humans);
    const deletions = '(SELECT id FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[]))';
    await rows(`DELETE FROM account_erasure_private.media_pending WHERE deletion_id IN ${deletions}`, [humans]);
    await rows(`DELETE FROM account_erasure_private.deletion_progress WHERE deletion_id IN ${deletions}`, [humans]);
    await rows('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [humans]);
    await rt.removeFixtureHumans(humans);
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM voice_private.consent_texts WHERE version = $2)
        + (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED')
        + (SELECT count(*) FROM public.matching_counterpart_erasure_releases WHERE participant_user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM public.matching_counterpart_erasure_reactivation_commands WHERE participant_user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans, consentVersion]);
    assert.equal(Number(residue), 0, 'the run leaves no voice row, consent text, open gate, release, deletion or fixture human behind');
    assert.equal(Number(othersBefore), Number(await releasesOfOthers()), 'and every other user\'s release rows are as they were');
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
  console.error(`S8B-02 CP2 voice media proof (PostgREST ${version}) failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
