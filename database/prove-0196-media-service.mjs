// S8B-07 CP1-B step 3 — the Replay Media Service, proven over real HTTP with the COMPILED module, against a disposable
// PostgreSQL 17 (migration 0196 applied), the pinned ffmpeg 9.0.2 (the shipped worker makes every file the service reads)
// and a store: in memory, or the S3 adapter against rclone in CI (REPLAY_PROOF_STORE=s3 with the QANDEEL_MEDIA_S3_*
// loopback values).
//
// The service is the shipped ReplayMediaServiceModule. Only its edges are replaced: the database is the Replay role's own
// LOGIN session, the store is the proof's instrumented one, the repository is the real one counted, and the content-free
// stream reports reach a sink. The bearer check is the shipped SupabaseAuthGuard against a loopback `/auth/v1/user`.
//
//   S01  V-28 / V-33  the compiled entry point refuses every role but REPLAY_MEDIA, every placement but REPLAY_POOL, a
//        session that is not the Replay role, and a missing bearer check; with all of them it starts: /health 200, 401
//        without a bearer or with a bad one, nothing printed that names a URL, a secret or an id
//   S02  the wire: 401 on every route without a bearer, 400 / 404 on malformed ids, another person's file → 404 on every
//        route (default-deny), 416 on an unsatisfiable Range, the exact answer keys, no-store everywhere
//   S03  V-31 (API)  parallel POSTs of one command → one artifactId, one ledger row; a reused command → 409 COMMAND_REUSED
//        with nothing else, nothing created
//   S04  V-34  the person's call ACTIVE → listening and playback 409 LIVE_CALL_ACTIVE, nothing created; ended → allowed
//   S05  V-32 (h)  the control: a slow full read (≤ 16 KiB/s) completes, every byte, the re-checks answered true
//   S06  V-32 (a) – (g)  a slow read (≤ 16 KiB/s) cut by: the owner's deletion, a known end, a release elsewhere, account
//        erasure, the version leaving CURRENT, a re-check held by a lock past its budget, a re-check whose connection is
//        killed, and a release through instance A while the stream is on instance B. Each: destroyed (an error, never an
//        end), the measured cut time inside its bound, no write after the termination instant (an instrumented counter on
//        the response), bytes received < the file, the next Range → 404 (or 206 where the source is still readable)
//   S07  V-35a (1) – (5) server parts  a request timeout, a network drop and an instance restart mid-response, each resumed
//        with Range to a byte-identical file; every resumed request re-runs the read; the 10 min cap lowered to 1 s
//        serves one file as ≥ 6 bounded responses; the source ending between two Range requests refuses the second
//   S08  V-16 / V-18  every answer private and no-store, no Content-Disposition; no id, key, digest or URL in any answer
//        or anything the service printed
//
// Fixtures are COMMITTED (the service runs on its own connections as the Replay role) and removed at the end; the Replay
// role is given LOGIN for this run only and returned to NOLOGIN in `finally`. Never a hosted database. No gate is left
// open; no provider is called; nothing here prints a key or an id.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/api/dist');
const requireApi = createRequire(join(ROOT, 'apps/api/package.json'));
const load = (path) => requireApi(join(DIST, path));
const { Test } = requireApi('@nestjs/testing');
const { MediaWorkerService } = load('replay-media/media-worker.service.js');
const { TransientMediaRepository } = load('replay-media/transient-media.repository.js');
const { PgReplayDatabase } = load('replay-media/replay-database.js');
const { S3TransientAudioStore, SourceTooLargeError } = load('replay-media/transient-audio.store.js');
const { ReplayMediaServiceModule } = load('replay-media/replay-media-service.module.js');
const { REPLAY_DATABASE, TRANSIENT_AUDIO_STORE, TRANSIENT_STREAM_TIMING } = load('replay-media/replay-tokens.js');
const { TRANSIENT_STREAM_REPORTS } = load('replay-media/transient-media.controller.js');
const { TransientPlaybackService } = load('replay-media/transient-playback.service.js');
const { DEFAULT_STREAM_TIMING } = load('replay-media/transient-stream.js');
const { configureHttpSecurity } = load('http-security/http-security.js');
const { parseProxyConfiguration } = load('http-security/client-address.js');
const { OpusPacketEncoder, UPLINK_OPUS } = load('voice/call/codec/opus-codec.js');
const { muxOggOpus } = load('voice/call/codec/ogg-opus.js');

const POOL = 'qandeel_replay_media';
const STORE_MODE = process.env.REPLAY_PROOF_STORE === 's3' ? 's3' : 'memory';
const BIN = { ffmpeg: process.env.FFMPEG_BIN, ffprobe: process.env.FFPROBE_BIN };
assert.ok(BIN.ffmpeg && BIN.ffprobe, 'FFMPEG_BIN and FFPROBE_BIN name the pinned ffmpeg 9.0.2');
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const PUBLISHABLE = 'proof-only-publishable-key';
/** V-32's slow reading client: at most 16 KiB/s. */
const SLOW = 16 * 1024;
/** The contract's bounds (A-2), proven here, never widened: ≤ 7 s after a commit, ± 1 s around a known end. */
const COMMIT_BOUND_MS = 7_000;
const KNOWN_END_BOUND_MS = 1_000;
const MINUTE = 60_000;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const measured = [];

// ------------------------------------------------------------------ audio fixtures (the shipped call writer; a pure tone)
function tonePcm(rate, a, b, hz) {
  const per = (rate * 20) / 1000;
  const frames = [];
  for (let start = a; start < b; start += 20) {
    const pcm = Buffer.alloc(per * 2);
    for (let i = 0; i < per; i += 1) {
      const t = start + (i * 1000) / rate;
      pcm.writeInt16LE(Math.round(0.25 * Math.sin((2 * Math.PI * hz * t) / 1000) * 32767), i * 2);
    }
    frames.push(pcm);
  }
  return frames;
}
let minuteSegment = null;
/** One minute of the USER track exactly as the call writer writes it (real libopus packets, one Ogg stream). */
function userMinute() {
  if (minuteSegment) return minuteSegment;
  const encoder = new OpusPacketEncoder(UPLINK_OPUS.rate, UPLINK_OPUS.bitrate);
  try {
    minuteSegment = muxOggOpus(tonePcm(UPLINK_OPUS.rate, 0, MINUTE, 440).map((pcm) => encoder.encode(pcm)), { serial: 1, inputRate: UPLINK_OPUS.rate });
  } finally {
    encoder.close();
  }
  return minuteSegment;
}

// ------------------------------------------------------------------ the store (in memory, or S3 against rclone)
/** A store body read in 16 KiB pieces, pulled as the response drains (the S3 body's own behaviour), never one buffer. */
function pulled(bytes) {
  let at = 0;
  return new Readable({
    read() {
      if (at >= bytes.length) {
        this.push(null);
        return;
      }
      const next = bytes.subarray(at, at + 16_384);
      at += next.length;
      this.push(Buffer.from(next));
    },
  });
}
function memoryStore(objects) {
  return {
    isConfigured: () => true,
    async readSource(key, maxBytes, meter) {
      meter.ops += 1;
      const body = objects.get(key);
      if (!body) return null;
      meter.bytesRead += Math.min(body.length, maxBytes + 1);
      if (body.length > maxBytes) throw new SourceTooLargeError();
      return Buffer.from(body);
    },
    async putTransient(key, body, byteSize, meter) {
      meter.ops += 1;
      const chunks = [];
      for await (const chunk of body) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      if (bytes.length !== byteSize) throw new Error('length mismatch');
      objects.set(key, bytes);
    },
    async headTransient(key, meter) {
      if (meter) meter.ops += 1;
      return objects.has(key) ? objects.get(key).length : null;
    },
    async removeTransient(key, meter) {
      if (meter) meter.ops += 1;
      objects.delete(key);
    },
    async openTransient(key, range) {
      const body = objects.get(key);
      if (!body) return null;
      return pulled(range ? body.subarray(range.start, range.end + 1) : body);
    },
  };
}
async function createProofStore() {
  let inner;
  let putSource;
  let get;
  let removeAny;
  if (STORE_MODE === 'memory') {
    const objects = new Map();
    inner = memoryStore(objects);
    putSource = async (key, bytes) => { objects.set(key, Buffer.from(bytes)); };
    get = async (key) => (objects.has(key) ? Buffer.from(objects.get(key)) : null);
    removeAny = async (key) => { objects.delete(key); };
  } else {
    inner = new S3TransientAudioStore(process.env);
    assert.ok(inner.isConfigured(), 'the S3 proof store is configured (QANDEEL_MEDIA_S3_* loopback values)');
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = requireApi('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: process.env.QANDEEL_MEDIA_S3_ENDPOINT, region: process.env.QANDEEL_MEDIA_S3_REGION, forcePathStyle: true,
      credentials: { accessKeyId: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY },
    });
    const Bucket = process.env.QANDEEL_MEDIA_S3_BUCKET;
    putSource = async (key, bytes) => {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentLength: bytes.length }));
    };
    get = async (key) => {
      try {
        const answer = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return Buffer.from(await answer.Body.transformToByteArray());
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    };
    // Teardown only: the proof's own objects leave the CI bucket, so a later proof that lists the bucket never sees them.
    removeAny = async (key) => { await client.send(new DeleteObjectCommand({ Bucket, Key: key })).catch(() => undefined); };
  }
  const opens = [];
  const store = {
    isConfigured: () => inner.isConfigured(),
    readSource: (key, maxBytes, meter, signal) => inner.readSource(key, maxBytes, meter, signal),
    putTransient: (key, body, byteSize, meter, signal) => inner.putTransient(key, body, byteSize, meter, signal),
    headTransient: (key, meter, signal) => inner.headTransient(key, meter, signal),
    removeTransient: (key, meter, signal) => inner.removeTransient(key, meter, signal),
    openTransient(key, range, signal) {
      opens.push(key);
      return inner.openTransient(key, range, signal);
    },
  };
  return { store, putSource, get, removeAny, opens };
}

// ------------------------------------------------------------------ the instrumented response (V-32: no write after the termination)
/** Every audio response's writes and its first destroy, counted on the response itself (independent of the gate). */
const wire = [];
{
  const proto = http.ServerResponse.prototype;
  const stats = new WeakMap();
  const audio = (res) => String(res.getHeader('content-type') ?? '').startsWith('audio/');
  const statOf = (res) => {
    let s = stats.get(res);
    if (!s) {
      s = { writes: 0, bytes: 0, destroyedAt: null, writesAfterDestroy: 0, ended: false };
      stats.set(res, s);
      wire.push(s);
    }
    return s;
  };
  const { write, end, destroy } = proto;
  proto.write = function patchedWrite(chunk, ...rest) {
    if (audio(this)) {
      const s = statOf(this);
      if (s.destroyedAt !== null) s.writesAfterDestroy += 1;
      s.writes += 1;
      s.bytes += chunk?.length ?? 0;
    }
    return write.call(this, chunk, ...rest);
  };
  proto.end = function patchedEnd(...args) {
    if (audio(this)) {
      const s = statOf(this);
      if (s.destroyedAt !== null && args[0] !== undefined && typeof args[0] !== 'function') s.writesAfterDestroy += 1;
      s.ended = true;
    }
    return end.apply(this, args);
  };
  proto.destroy = function patchedDestroy(...args) {
    if (audio(this)) {
      const s = statOf(this);
      if (s.destroyedAt === null) s.destroyedAt = Date.now();
    }
    return destroy.apply(this, args);
  };
}

// ------------------------------------------------------------------ the bearer check's peer (a loopback /auth/v1/user)
const tokens = new Map();
function tokenFor(user) {
  const token = randomBytes(24).toString('hex');
  tokens.set(token, user);
  return token;
}
function startGateway() {
  const server = http.createServer((request, response) => {
    const token = (request.headers.authorization ?? '').replace(/^Bearer\s+/iu, '');
    if (request.url !== '/auth/v1/user' || request.headers.apikey !== PUBLISHABLE || !tokens.has(token)) {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: tokens.get(token) }));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

// ------------------------------------------------------------------ fixtures (committed)
const humans = [];
const forbidden = new Set();
async function committed(fn) {
  await owner();
  await q('BEGIN');
  try { const v = await fn(); await q('COMMIT'); return v; } catch (error) { await q('ROLLBACK'); throw error; }
}
async function human() {
  return committed(async () => {
    const id = randomUUID();
    await rt.provisionHumans([id]);
    humans.push(id);
    forbidden.add(id);
    return id;
  });
}
async function newSession(user) {
  const id = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  forbidden.add(id);
  return id;
}
/** A sealed call recording: `minutes` USER-track segments of the call writer's real Ogg Opus, nothing on the QANDEEL track. */
async function realCall(ps, user, session, minutes) {
  const id = randomUUID();
  const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
  const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
  await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
             seat_lease_until = NULL WHERE id = $1`, [call]);
  await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                 recording_state, sealed_by)
           VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
  [id, user, session, call, t]);
  const bytes = userMinute();
  for (let m = 0; m < minutes; m += 1) {
    const key = `voice-call/${randomUUID()}`;
    await ps.putSource(key, bytes);
    await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
               byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
             VALUES ($1, 'USER', $2, $3, 'STORED', 'audio/ogg', $4, $5, $6, clock_timestamp(), clock_timestamp())`,
    [id, m, key, bytes.length, m * MINUTE, (m + 1) * MINUTE]);
  }
  forbidden.add(id);
  forbidden.add(call);
  return { recording: id, call };
}
async function listener(ps, minutes) {
  const user = await human();
  const fx = await committed(async () => {
    const session = await newSession(user);
    return { session, ...(await realCall(ps, user, session, minutes)) };
  });
  return { user, token: tokenFor(user), ...fx };
}
/** A one-run Replay: one USER voice turn over the whole call, then a text reply (the verify-0196 fixture's shape). */
async function replayFixture(ps, minutes) {
  const user = await human();
  const fx = await committed(async () => {
    const session = await newSession(user);
    const c = await realCall(ps, user, session, minutes);
    let sp = Number((await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp',
      [session]))[0].sp);
    const turns = [
      { role: 'USER', voice: { a: 0, b: minutes * MINUTE } },
      { role: 'ASSISTANT' },
      { role: 'USER' },
    ];
    for (const [t, turn] of turns.entries()) {
      const id = randomUUID();
      const batch = randomUUID();
      const content = `message ${t + 1}`;
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
               VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [id, session, user, turn.role, content]);
      await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
                 source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                 segmentation_prompt_version)
               VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
      [batch, user, session, id, Buffer.from(`${session}:${id}`)]);
      if (turn.voice) {
        await q(`INSERT INTO public.conversation_turn_voice_sources
                   (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
                    anchor_start_ms, anchor_end_ms, spoken, delivery_state)
                 VALUES ($1, $2, $3, 'USER', 'LIVE_CALL_SPEECH', 'MACHINE_ASR', 'HIGH', $4, $5, $6, NULL, NULL)`,
        [id, user, session, c.recording, turn.voice.a, turn.voice.b]);
      }
      sp += 1;
      const body = `${content}, sentence 1`;
      await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                 source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'RESOLVED', $6, 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
      [user, session, id, batch, turn.role, turn.voice ? 'LIVE_CALL_SPEECH' : 'TEXT', [...body].length, body, sp]);
    }
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
    await rt.setGate();
    const created = await rt.create(user, randomUUID(), session, 1, 2);
    assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
    const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
    assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the draft previews (${previewed.outcome})`);
    forbidden.add(created.replay_id);
    return { session, ...c, replay: created.replay_id, version: previewed.replay_version_id };
  });
  return { user, token: tokenFor(user), ...fx };
}
async function fileOf(ps, artifact) {
  await owner();
  const [a] = await rows('SELECT storage_key, byte_size, job_state FROM voice_private.transient_media_artifacts WHERE id = $1', [artifact]);
  forbidden.add(a.storage_key);
  const bytes = await ps.get(a.storage_key);
  assert.equal(bytes.length, Number(a.byte_size), 'the stored file is exactly the recorded size');
  return { size: bytes.length, bytes, digest: sha(bytes) };
}
const counts = async (user) => {
  await owner();
  const [c] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.transient_media_artifacts WHERE user_id = $1) AS artifacts,
                                 (SELECT count(*)::int FROM voice_private.transient_media_requests WHERE user_id = $1) AS requests`, [user]);
  return c;
};

// ------------------------------------------------------------------ the service instances (the shipped module, its edges replaced)
const answers = [];
const printed = [];
async function captured(fn) {
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  const keep = (chunk) => { printed.push(String(chunk)); return true; };
  process.stdout.write = keep;
  process.stderr.write = keep;
  try { return await fn(); } finally { process.stdout.write = out; process.stderr.write = err; }
}
/**
 * The paced reads' link: a local stream socket (a Unix socket; a named pipe on Windows) whose connections are handed to
 * the instance's own HTTP server, so the compiled service, its controller and its stream run unchanged. Its buffer is
 * fixed, where TCP loopback auto-tunes: on the Linux CI runner the loopback path took a whole 6-minute file within
 * 5 ms, so the server had COMPLETED before any cut and a slow reader exerted no back-pressure at all (PR #385, API CI
 * at 644a73b7). `linkCapacity` measures both, and the stream stage refuses to run on a link that could absorb a file.
 */
let links = 0;
function newLinkPath() {
  links += 1;
  return process.platform === 'win32' ? `\\\\.\\pipe\\qandeel-prove-0196-${process.pid}-${links}`
    : join(tmpdir(), `qandeel-prove-0196-${process.pid}-${links}.sock`);
}
async function listenLink(onSocket, path = newLinkPath()) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    onSocket(socket);
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(path, () => done());
  });
  return {
    link: { socketPath: path },
    close: () => new Promise((closed) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => closed());
    }),
  };
}
/**
 * The bytes a server can hand to a link while its reader is paused, before back-pressure reaches it: what a slow reader
 * can never hold back (capped at 16 MiB).
 */
async function linkCapacity(kind) {
  const total = 16 * 1024 * 1024;
  let accepted = 0;
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Length', String(total));
    const piece = Buffer.alloc(16 * 1024);
    const pump = () => {
      while (accepted < total) {
        accepted += piece.length;
        if (!response.write(piece)) {
          response.once('drain', pump);
          return;
        }
      }
      response.end();
    };
    pump();
  });
  const piped = kind === 'link' ? await listenLink((socket) => server.emit('connection', socket)) : null;
  if (!piped) await new Promise((done) => server.listen(0, '127.0.0.1', () => done()));
  const target = piped ? piped.link : { host: '127.0.0.1', port: server.address().port };
  await new Promise((done) => {
    const request = http.request({ ...target, path: '/', agent: false }, (response) => {
      response.once('data', () => response.pause());
      setTimeout(() => {
        response.destroy();
        done();
      }, 1_500);
    });
    request.on('error', () => done());
    request.end();
  });
  server.closeAllConnections();
  if (piped) await piped.close();
  else await new Promise((done) => server.close(() => done()));
  return accepted;
}
async function startInstance(ps, db, timing, { port = 0, linkPath } = {}) {
  const reports = [];
  const counter = { reads: 0, checks: 0 };
  // The Replay role's own connection, counted at the statement: every per-request read and every in-stream re-check.
  const counted = {
    query(text, values) {
      if (text.includes('server_read_transient_media_v1(')) counter.reads += 1;
      if (text.includes('server_check_transient_media_v1(')) counter.checks += 1;
      return db.query(text, values);
    },
    close: () => db.close(),
  };
  const moduleRef = await Test.createTestingModule({ imports: [ReplayMediaServiceModule] })
    .overrideProvider(REPLAY_DATABASE).useValue(counted)
    .overrideProvider(TRANSIENT_AUDIO_STORE).useValue(ps.store)
    .overrideProvider(TRANSIENT_STREAM_TIMING).useValue(timing)
    .overrideProvider(TRANSIENT_STREAM_REPORTS).useValue((r) => reports.push(r))
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureHttpSecurity(app, parseProxyConfiguration({ NODE_ENV: 'test' }));
  await TransientPlaybackService.preflight(counted, ps.store, process.env);
  await app.listen(port, '127.0.0.1');
  const httpServer = app.getHttpServer();
  const paced = await listenLink((socket) => httpServer.emit('connection', socket), linkPath);
  return { app, db, port: httpServer.address().port, link: paced.link, closeLink: paced.close, reports, counter };
}
/** Kills an instance as a crash or a rollout would: every open connection dropped, then the server closed. */
async function killInstance(instance) {
  await instance.closeLink();
  instance.app.getHttpServer().closeAllConnections();
  await instance.app.close();
}
async function call(instance, method, path, token, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${instance.port}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  const answer = { status: response.status, headers: Object.fromEntries(response.headers), text };
  answers.push(answer);
  return { status: answer.status, headers: answer.headers, body: text ? JSON.parse(text) : null };
}
const listen = (i, l, command = randomUUID()) => call(i, 'POST', `/voice/listening/${l.call}/${command}`, l.token);
const play = (i, r, command = randomUUID()) => call(i, 'POST', `/replay/${r.replay}/versions/${r.version}/playback/${command}`, r.token);
const statusOf = (i, l, artifact) => call(i, 'GET', `/voice/transient/${artifact}/status`, l.token);
const releaseOf = (i, l, artifact) => call(i, 'DELETE', `/voice/transient/${artifact}`, l.token);

/**
 * One GET of the audio by a client that reads at most `rate` bytes per second. It pauses the socket, and `link` is an
 * instance's paced link (see `newLinkPath`), so the server sees real back-pressure once that link's fixed buffer is full.
 * Resolves when the response closes: its status, headers, bytes, and whether it ended in an error.
 */
function slowGet(link, artifact, token, { range = null, rate = SLOW, onFirstByte = null } = {}) {
  assert.ok(typeof link?.socketPath === 'string', 'a paced read goes over a paced link');
  return new Promise((done) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; done(value); } };
    const request = http.request({
      socketPath: link.socketPath, path: `/voice/transient/${artifact}`, method: 'GET', agent: false,
      headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      let first = null;
      let error = false;
      response.on('data', (chunk) => {
        if (first === null) {
          first = Date.now();
          onFirstByte?.();
        }
        chunks.push(chunk);
        bytes += chunk.length;
        const wait = first + (bytes / rate) * 1000 - Date.now();
        if (wait > 0) {
          response.pause();
          setTimeout(() => response.resume(), wait);
        }
      });
      response.on('error', () => { error = true; });
      response.on('close', () => finish({
        status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), bytes, closedAt: Date.now(),
        error: error || !response.complete,
      }));
    });
    request.on('error', () => finish({ status: 0, headers: {}, body: Buffer.alloc(0), bytes: 0, closedAt: Date.now(), error: true }));
    request.end();
  });
}
async function reportAfter(instance, count) {
  for (let i = 0; i < 200 && instance.reports.length <= count; i += 1) await sleep(25);
  assert.ok(instance.reports.length > count, 'the stream reported its end');
  return instance.reports[count];
}

// ------------------------------------------------------------------ scenarios
async function s01Startup(report, env) {
  await report.section('S01 V-28 / V-33: the compiled service refuses every wrong role, placement, session and bearer check; then it serves', async () => {
    const entry = join(DIST, 'replay-media/replay-media-service.main.js');
    const run = (extra, waitMs = 30_000) => {
      const child = spawn(process.execPath, [entry], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let text = '';
      child.stdout.on('data', (c) => { text += c; });
      child.stderr.on('data', (c) => { text += c; });
      const timer = setTimeout(() => child.kill('SIGKILL'), waitMs);
      const closed = new Promise((done) => child.on('close', (code) => { clearTimeout(timer); done({ code, text }); }));
      return { child, closed };
    };
    const refuses = async (extra, pattern) => {
      const { code, text } = await run(extra).closed;
      assert.notEqual(code, 0, `the service with ${JSON.stringify(Object.keys(extra))} refuses`);
      assert.match(text, pattern, 'the refusal names its check');
      assert.doesNotMatch(text, /postgres(?:ql)?:\/\/|password|secret|https?:\/\//iu, 'the refusal prints no URL or secret');
      assert.doesNotMatch(text, UUID, 'the refusal prints no id');
    };
    await refuses({ QANDEEL_COMPUTE_ROLE: '' }, /runs only as REPLAY_MEDIA/u);
    await refuses({ QANDEEL_COMPUTE_ROLE: 'API' }, /runs only as REPLAY_MEDIA/u);
    await refuses({ QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' }, /runs only as REPLAY_MEDIA/u);
    await refuses({ QANDEEL_REPLAY_PLACEMENT: 'NONE' }, /REPLAY_PLACEMENT=REPLAY_POOL/u);
    for (const placement of ['DEDICATED', 'SHARED', 'API_HOST']) await refuses({ QANDEEL_REPLAY_PLACEMENT: placement }, /no same-host placement/u);
    await refuses({ REPLAY_MEDIA_DATABASE_URL: process.env.DATABASE_URL }, /connects only as qandeel_replay_media/u);
    const roleOption = new URL(process.env.DATABASE_URL);
    roleOption.searchParams.set('options', `-c role=${POOL}`);
    await refuses({ REPLAY_MEDIA_DATABASE_URL: roleOption.toString() }, /connects only as qandeel_replay_media/u);
    await refuses({ SUPABASE_URL: '' }, /bearer verification is not configured/u);
    // With every check satisfied: it listens, /health answers, and a request without a valid bearer is refused.
    const started = run({});
    const base = `http://127.0.0.1:${env.PORT}`;
    let health = null;
    for (let i = 0; i < 150 && health === null; i += 1) {
      await sleep(100);
      health = await fetch(`${base}/health`).then(async (r) => ({ status: r.status, body: await r.json(), cache: r.headers.get('cache-control') }),
        () => null);
    }
    try {
      assert.deepEqual(health, { status: 200, body: { status: 'ok' }, cache: 'no-store, private' }, 'the compiled service started and its database answers');
      const bare = await fetch(`${base}/voice/listening/${randomUUID()}/${randomUUID()}`, { method: 'POST' });
      assert.equal(bare.status, 401, 'no bearer → 401');
      const bad = await fetch(`${base}/voice/transient/${randomUUID()}`, { headers: { Authorization: 'Bearer not-a-token' } });
      assert.equal(bad.status, 401, 'a bearer the check refuses → 401');
    } finally {
      started.child.kill('SIGTERM');
    }
    const { text } = await started.closed;
    assert.doesNotMatch(text, UUID, 'the running service printed no id');
    assert.doesNotMatch(text, /voice-(?:call|note|transient)\/|postgres(?:ql)?:\/\//u, 'the running service printed no key or URL');
  });
}

async function s02Wire(report, A, ps, L, other) {
  let artifact = null;
  await report.section('S02 the wire: 401 without a bearer, 400 / 404 on malformed ids, default-deny on another person\'s file, 416, exact keys', async () => {
    const id = randomUUID();
    for (const [method, path] of [['POST', `/voice/listening/${id}/${id}`], ['POST', `/replay/${id}/versions/${id}/playback/${id}`],
      ['GET', `/voice/transient/${id}/status`], ['GET', `/voice/transient/${id}`], ['DELETE', `/voice/transient/${id}`]]) {
      assert.equal((await call(A, method, path, null)).status, 401, `${method} without a bearer → 401`);
    }
    const before = await counts(L.user);
    assert.deepEqual([(await listen(A, L, 'not-a-uuid')).status, (await listen(A, L, 'not-a-uuid')).body], [400, { outcome: 'INVALID_REQUEST' }]);
    assert.deepEqual((await call(A, 'POST', `/voice/listening/not-a-call/${randomUUID()}`, L.token)).body, { outcome: 'NOT_FOUND', reason: null });
    assert.deepEqual(await counts(L.user), before, 'nothing created by a refused request');
    const first = await listen(A, L);
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(first.body).sort(), ['artifactId', 'durationMs', 'readableForMs', 'reason', 'state'], 'the listening answer, exactly');
    assert.deepEqual([first.body.state, first.body.durationMs, first.body.reason], ['PENDING', L.minutes * MINUTE, null]);
    const st = await statusOf(A, L, first.body.artifactId);
    assert.deepEqual(Object.keys(st.body).sort(), ['failure', 'readableForMs', 'reason', 'state']);
    // Another person's file: every route answers 404, and the file is untouched.
    const theirs = { ...other };
    assert.equal((await statusOf(A, theirs, first.body.artifactId)).status, 404);
    assert.equal((await slowGet(A.link, first.body.artifactId, theirs.token, { rate: 1 << 30 })).status, 404);
    assert.equal((await releaseOf(A, theirs, first.body.artifactId)).status, 404);
    assert.equal((await statusOf(A, L, first.body.artifactId)).body.state, 'PENDING', 'their DELETE released nothing');
    assert.equal((await call(A, 'GET', '/voice/transient/not-an-id', L.token)).status, 404);
    // A file not READY is not read.
    assert.equal((await slowGet(A.link, first.body.artifactId, L.token, { rate: 1 << 30 })).status, 404, 'a PENDING file → 404');
    artifact = first.body.artifactId;
  });
  return artifact;
}

async function s03Idempotency(report, A, Y, R) {
  let artifact = null;
  await report.section('S03 V-31 (API): parallel POSTs of one command → one artifactId; a reused command → 409 COMMAND_REUSED and nothing else', async () => {
    const command = randomUUID();
    const answered = await Promise.all(Array.from({ length: 8 }, () => listen(A, Y, command)));
    assert.deepEqual(answered.map((a) => a.status), Array(8).fill(200), 'every parallel POST answers 200');
    const ids = new Set(answered.map((a) => a.body.artifactId));
    assert.equal(ids.size, 1, 'one artifactId for every caller');
    [artifact] = ids;
    assert.equal((await listen(A, Y, command)).body.artifactId, artifact, 'a retry of the command → the same artifactId');
    assert.deepEqual(await counts(Y.user), { artifacts: 1, requests: 1 }, 'one artifact, one ledger row');
    // The same command for another kind: refused with the bounded word only, nothing created.
    const k = randomUUID();
    const l = await listen(A, R, k);
    assert.equal(l.status, 200);
    assert.equal((await releaseOf(A, R, l.body.artifactId)).body.state, 'RELEASED');
    const before = await counts(R.user);
    const reused = await play(A, R, k);
    assert.equal(reused.status, 409);
    assert.equal(reused.headers['content-type'].split(';')[0], 'application/json');
    assert.deepEqual(reused.body, { outcome: 'COMMAND_REUSED' }, '409 carries no artifact id, state or reason');
    assert.deepEqual(await counts(R.user), before, 'nothing created');
  });
  return artifact;
}

async function s04LiveCall(report, A, R) {
  await report.section('S04 V-34: the person\'s call ACTIVE → listening and playback 409 LIVE_CALL_ACTIVE, nothing created; ended → allowed', async () => {
    const live = await committed(() => fixtureCall(q, rows, { id: randomUUID(), user: R.user, session: R.session, startedAt: new Date().toISOString() }));
    forbidden.add(live);
    const before = await counts(R.user);
    const l = await listen(A, R);
    const p = await play(A, R);
    assert.deepEqual([l.status, l.body, p.status, p.body],
      [409, { outcome: 'LIVE_CALL_ACTIVE' }, 409, { outcome: 'LIVE_CALL_ACTIVE' }]);
    assert.deepEqual(await counts(R.user), before, 'nothing created during the call');
    await committed(() => q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(),
                               grace_until = NULL, seat_lease_until = NULL WHERE id = $1`, [live]));
  });
}

/** Requests the Replay's playback (after V-34 allowed it); returns the command so a retry reads the READY set. */
async function requestReplay(A, R) {
  const command = randomUUID();
  const p = await play(A, R, command);
  assert.equal(p.status, 200);
  assert.deepEqual(Object.keys(p.body).sort(), ['boundaries', 'readableForMs', 'reason', 'runs', 'state'], 'the playback answer, exactly');
  assert.equal(p.body.state, 'PENDING');
  assert.deepEqual(p.body.runs.map((r) => [r.artifactId, r.durationMs]), [[undefined, R.minutes * MINUTE]], 'one run, no artifactId until READY');
  assert.deepEqual(p.body.boundaries, []);
  return command;
}

async function s05Control(report, A, ps, X, artifact) {
  await report.section('S05 V-32 (h) control: a slow full read (≤ 16 KiB/s) completes with every byte; every re-check answered true', async () => {
    const file = await fileOf(ps, artifact);
    const checks = A.counter.checks;
    const reported = A.reports.length;
    const started = Date.now();
    const r = await slowGet(A.link, artifact, X.token);
    const rep = await reportAfter(A, reported);
    assert.deepEqual([r.status, r.error, r.bytes, sha(r.body)], [200, false, file.size, file.digest], 'every byte, a clean end');
    assert.equal(rep.outcome, 'COMPLETE');
    assert.equal(r.headers['content-length'], String(file.size));
    const rechecks = A.counter.checks - checks;
    const wallMs = Date.now() - started;
    // The re-check runs while the server is still sending (the paced link holds back all but its fixed capacity).
    const sendingMs = rep.endedAt - started;
    assert.ok(rechecks >= 3 && rechecks >= Math.floor(sendingMs / DEFAULT_STREAM_TIMING.recheckEveryMs) - 1,
      `the re-check ran every 5 s while sending (${rechecks} in ${sendingMs} ms)`);
    assert.ok(file.size / (wallMs / 1000) <= SLOW * 1.05, 'the client read at ≤ 16 KiB/s');
    measured.push({ case: 'h control', outcome: rep.outcome, bytes: r.bytes, size: file.size, rechecks, sendingMs, wallMs });
  });
}

/**
 * One V-32 cut: a slow read of `artifact` on `instance`; `trigger` runs 1.5 s after the first byte and resolves with the
 * instant its change was committed. The response must be destroyed within `boundMs` of that instant (or of `endAt`).
 */
async function cut(label, instance, ps, person, artifact, trigger, { expect = 'RECHECK', boundMs = COMMIT_BOUND_MS, nextStatus = 404, endAt = null,
  afterCut = null } = {}) {
  const file = await fileOf(ps, artifact);
  const reported = instance.reports.length;
  const wired = wire.length;
  let fired = null;
  const r = await slowGet(instance.link, artifact, person.token, {
    onFirstByte: () => {
      if (!trigger) return;
      fired = sleep(1_500).then(trigger);
      // Awaited below; a failing trigger fails the case there, never as an unhandled rejection.
      fired.catch(() => undefined);
    },
  });
  const committedAt = fired ? await fired : endAt;
  const rep = await reportAfter(instance, reported);
  if (afterCut) await afterCut();
  const stat = wire[wired];
  assert.ok(stat, 'the response was instrumented');
  assert.equal(r.status, 200);
  assert.notEqual(rep.outcome, 'COMPLETE', `${label}: the server was still sending when the cut came (precondition)`);
  assert.equal(r.error, true, `${label}: destroyed (an error, never a clean end)`);
  assert.equal(rep.outcome, expect, `${label}: terminated by ${expect}`);
  assert.equal(stat.ended, false, `${label}: end() never called`);
  assert.equal(stat.writesAfterDestroy, 0, `${label}: no write after the termination instant`);
  assert.equal(rep.bytesRefusedAfterTermination >= 0, true);
  assert.ok(r.bytes < file.size, `${label}: bytes received ${r.bytes} < the file ${file.size}`);
  assert.ok(rep.bytesSent < file.size, `${label}: the server stopped sending (${rep.bytesSent} of ${file.size})`);
  assert.ok(r.bytes <= rep.bytesSent, `${label}: nothing arrived that the gate did not pass`);
  const cutMs = rep.endedAt - committedAt;
  if (endAt !== null) {
    assert.ok(Math.abs(cutMs) <= boundMs, `${label}: cut ${cutMs} ms from the known end (± ${boundMs})`);
  } else {
    assert.ok(cutMs >= 0 && cutMs <= boundMs, `${label}: cut ${cutMs} ms after the commit (≤ ${boundMs})`);
  }
  const next = await slowGet(instance.link, artifact, person.token, { range: `bytes=${r.bytes}-`, rate: 1 << 30 });
  assert.equal(next.status, nextStatus, `${label}: the next Range → ${nextStatus}`);
  measured.push({ case: label, outcome: rep.outcome, cutMs, bytesReceived: r.bytes, bytesSent: rep.bytesSent, size: file.size,
    writesAfterTermination: stat.writesAfterDestroy, nextRange: next.status });
  return { r, next };
}

async function s06Cuts(report, ctx) {
  const { A, ps } = ctx;
  await report.section('S06 V-32 (a): the owner\'s deletion committed mid-stream → destroyed ≤ 7 s; the next Range 404; the proven reason DELETED', async () => {
    const { Y, yArtifact } = ctx;
    await cut('a owner deletion', A, ps, Y, yArtifact, async () => {
      await asRole('service_role');
      const [{ outcome }] = await rows('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [Y.user, Y.recording]);
      const at = Date.now();
      await owner();
      assert.ok(outcome, 'the deletion committed');
      return at;
    });
    const st = await statusOf(A, Y, yArtifact);
    assert.deepEqual([st.body.state, st.body.reason], ['EXPIRED', 'DELETED'], 'status: the proven cause');
    const again = await listen(A, Y);
    assert.deepEqual([again.status, again.body], [404, { outcome: 'NOT_FOUND', reason: 'DELETED' }], 'a new request: 404 with the proven reason');
  });
  await report.section('S06 V-32 (b) + V-35 (4): a known end → destroyed at serve_until ± 1 s; a Range before it served, the next refused', async () => {
    const { Z, zArtifact } = ctx;
    await committed(async () => {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`WITH n AS (SELECT clock_timestamp() + interval '4 seconds' AS e)
               UPDATE voice_private.recordings r SET retention_expires_at = n.e, started_at = n.e - interval '30 days' FROM n WHERE r.id = $1`,
      [Z.recording]);
    });
    const [{ e }] = await rows('SELECT retention_expires_at AS e FROM voice_private.recordings WHERE id = $1', [Z.recording]);
    const early = await slowGet(A.link, zArtifact, Z.token, { range: 'bytes=0-1023', rate: 1 << 30 });
    assert.deepEqual([early.status, early.bytes, early.error], [206, 1024, false], 'a Range before the end is served');
    await cut('b known end', A, ps, Z, zArtifact, null, { expect: 'SOURCE_END', boundMs: KNOWN_END_BOUND_MS, endAt: e.getTime() });
    const st = await statusOf(A, Z, zArtifact);
    assert.deepEqual([st.body.state, st.body.reason], ['EXPIRED', 'EXPIRED'], 'status: the proven cause');
  });
  await report.section('S06 V-32 (f): a re-check held past its budget by a lock, and one whose connection is killed → destroyed (fail-closed)', async () => {
    const { X, xArtifact } = ctx;
    // The owner's session takes the artifacts table ACCESS EXCLUSIVE and holds it until the stream is cut: the re-check
    // cannot answer (the role's lock_timeout 1 s, the 2 s budget). With `kill`, the re-check's own waiting backend is
    // terminated instead (a killed connection). Either way the response must be destroyed; the lock ends right after.
    const lockedCut = async (label, kill) => {
      let release = null;
      let killed = false;
      const trigger = async () => {
        await owner();
        await q('BEGIN');
        await q('LOCK TABLE voice_private.transient_media_artifacts IN ACCESS EXCLUSIVE MODE');
        const at = Date.now();
        let holding = true;
        const loop = (async () => {
          while (holding) {
            if (kill && !killed) {
              const [w] = await rows("SELECT pid FROM pg_stat_activity WHERE usename = $1 AND wait_event_type = 'Lock' LIMIT 1", [POOL]);
              if (w) killed = (await rows('SELECT pg_terminate_backend($1) AS k', [w.pid]))[0].k;
            }
            await sleep(10);
          }
          await q('ROLLBACK');
        })();
        release = async () => { holding = false; await loop; };
        return at;
      };
      try {
        await cut(label, A, ps, X, xArtifact, trigger, { nextStatus: 206, afterCut: () => release?.() });
      } finally {
        await release?.();
      }
      return killed;
    };
    await lockedCut('f re-check held by a lock', false);
    assert.equal(await lockedCut('f re-check connection killed', true), true, "the re-check's own backend was terminated while it waited");
  });
  await report.section('S06 V-32 (d): account erasure due mid-stream → destroyed ≤ 7 s; the next Range 404; no proven cause', async () => {
    const { U, uArtifact } = ctx;
    await cut('d account erasure', A, ps, U, uArtifact, async () => {
      await committed(() => q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
               VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second')`, [U.user]));
      return Date.now();
    });
  });
  await report.section('S06 V-32 (e): the Replay version leaving CURRENT (its source message changed) → destroyed ≤ 7 s; the next Range 404', async () => {
    const { R, rArtifact } = ctx;
    await cut('e version not CURRENT', A, ps, R, rArtifact, async () => {
      await committed(async () => {
        await q("SET LOCAL session_replication_role = 'replica'");
        const changed = await rows(`UPDATE public.conversation_units SET committed_text = overlay(committed_text PLACING 'M' FROM 1 FOR 1),
                                      source_content_sha256 = sha256(convert_to(overlay(committed_text PLACING 'M' FROM 1 FOR 1), 'UTF8'))
                                     WHERE session_id = $1 AND source_modality = 'LIVE_CALL_SPEECH' RETURNING id`, [R.session]);
        assert.equal(changed.length, 1, 'the voice turn\'s unit changed');
      });
      return Date.now();
    });
    const again = await play(A, R);
    assert.deepEqual([again.status, again.body], [404, { outcome: 'NOT_FOUND', reason: null }], 'a stale version is not a proven cause');
  });
  await report.section('S06 V-32 (g): two instances: the stream on B, the release through A → B cuts it ≤ 7 s; B refuses the next Range', async () => {
    const { G, gArtifact } = ctx;
    await cut('g release through A, stream on B', ctx.B, ps, G, gArtifact, async () => {
      const released = await releaseOf(A, G, gArtifact);
      const at = Date.now();
      assert.deepEqual(released.body, { state: 'RELEASED' });
      return at;
    });
  });
  await report.section('S06 V-32 (c): a release from another request on the same instance → destroyed ≤ 7 s; the next Range 404', async () => {
    const { X, xArtifact } = ctx;
    await cut('c release elsewhere', A, ps, X, xArtifact, async () => {
      const released = await releaseOf(A, X, xArtifact);
      const at = Date.now();
      assert.deepEqual(released.body, { state: 'RELEASED' });
      return at;
    });
    assert.equal((await statusOf(A, X, xArtifact)).body.state, 'RELEASED');
  });
}

/**
 * A hop in front of an instance's paced link, itself a paced link (so neither leg can absorb the file): it can enforce a
 * request timeout, and drop the network for a while once a connection has carried a given number of bytes
 * (`dropAfter`, one entry per new connection), then let it back.
 */
function startProxy(target) {
  const open = new Set();
  const state = { timeoutMs: 0, down: false, dropAfter: [], dropForMs: 800, drops: 0 };
  const drop = (forMs) => {
    state.down = true;
    state.drops += 1;
    for (const [c, u] of open) { c.destroy(); u.destroy(); }
    open.clear();
    setTimeout(() => { state.down = false; }, forMs);
  };
  const server = net.createServer((client) => {
    if (state.down) {
      client.destroy();
      return;
    }
    const upstream = net.connect(target.socketPath);
    const pair = [client, upstream];
    open.add(pair);
    const close = () => { client.destroy(); upstream.destroy(); open.delete(pair); };
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', close);
    upstream.on('close', close);
    client.pipe(upstream);
    upstream.pipe(client);
    if (state.timeoutMs > 0) setTimeout(close, state.timeoutMs);
    const limit = state.dropAfter.shift() ?? 0;
    let forwarded = 0;
    if (limit > 0) {
      upstream.on('data', (chunk) => {
        forwarded += chunk.length;
        if (forwarded >= limit && !state.down) drop(state.dropForMs);
      });
    }
  });
  const socketPath = newLinkPath();
  return new Promise((done) => server.listen(socketPath, () => done({
    link: { socketPath },
    state,
    close: () => new Promise((closed) => { for (const [c, u] of open) { c.destroy(); u.destroy(); } server.close(() => closed()); }),
  })));
}
/** The phone's resume rule, server side: after an early end, ask the status, then resume with Range from the byte reached. */
async function resumableRead(link, statusInstance, person, artifact, size, { rate, during = null }) {
  const parts = [];
  let offset = 0;
  let answered = 0;
  let refusedConnections = 0;
  const contentRanges = [];
  for (let attempt = 0; offset < size && attempt < 200; attempt += 1) {
    const r = await slowGet(link, artifact, person.token, { range: `bytes=${offset}-`, rate, onFirstByte: during ? () => during(answered) : null });
    if (r.status === 0) {
      refusedConnections += 1;
      await sleep(200);
      continue;
    }
    answered += 1;
    assert.equal(r.status, 206, 'every answered resume is a 206');
    contentRanges.push(r.headers['content-range']);
    assert.equal(r.headers['content-range'], `bytes ${offset}-${size - 1}/${size}`, 'the Range continues at the exact byte');
    parts.push(r.body);
    offset += r.bytes;
    if (offset < size) {
      const st = await statusOf(statusInstance(), person, artifact);
      assert.equal(st.body.state, 'READY', 'status first: still READY, so resume');
    }
  }
  return { bytes: Buffer.concat(parts), answered, refusedConnections, contentRanges };
}

async function s07Resume(report, ctx) {
  // A 6-minute file read at 64 KiB/s: the server is still sending long after the first cut (a paced link absorbs
  // a few hundred KiB, so a smaller file would leave the server finished before any cut).
  const { A, ps, X: H, xArtifact: hArtifact } = ctx;
  const FAST_READ = 64 * 1024;
  await report.section('S07 V-35a (1) (2) (3): a request timeout, a network drop and an instance restart mid-response → byte-identical resumes', async () => {
    const file = await fileOf(ps, hArtifact);
    const rate = FAST_READ;
    // (1) a hop that ends every request after 3 s (the Cloud Run request timeout, lowered).
    const proxy = await startProxy(A.link);
    try {
      proxy.state.timeoutMs = 3_000;
      const reads = A.counter.reads;
      const t = await resumableRead(proxy.link, () => A, H, hArtifact, file.size, { rate });
      assert.equal(sha(t.bytes), file.digest, '(1) the resumed file is byte-identical: no gap, no overlap');
      assert.ok(t.answered >= 2, `(1) the timeout ended a response and the read resumed (${t.answered} responses)`);
      assert.equal(A.counter.reads - reads, t.answered, '(3) every answered request re-ran server_read_transient_media_v1');
      measured.push({ case: 'V-35 (1) request timeout 3 s', responses: t.answered, overlapBytes: 0, gapBytes: 0 });
      // (2) the network drops twice mid-response (after 200 kB of each of the next two connections), for 0.8 s each.
      proxy.state.timeoutMs = 0;
      proxy.state.dropAfter = [200_000, 200_000];
      const n = await resumableRead(proxy.link, () => A, H, hArtifact, file.size, { rate });
      assert.equal(proxy.state.drops, 2, '(2) the network dropped twice mid-response');
      assert.equal(sha(n.bytes), file.digest, '(2) byte-identical across the drops');
      assert.ok(n.answered >= 3, `(2) resumed after each drop (${n.answered} responses, ${n.refusedConnections} refused connects)`);
      measured.push({ case: 'V-35 (2) network drop ×2', responses: n.answered, refusedConnects: n.refusedConnections, overlapBytes: 0, gapBytes: 0 });
    } finally {
      await proxy.close();
    }
    // An instance restart mid-response (a rollout or a scale-in): B is killed, B′ starts on the same address.
    let restarted = null;
    const { port, link } = ctx.B;
    const r = await resumableRead(link, () => A, H, hArtifact, file.size, {
      rate,
      during: (i) => {
        if (i !== 0) return;
        restarted = sleep(1_000).then(async () => {
          await killInstance(ctx.B);
          await ctx.B.db.close();
          await sleep(400);
          const db = new PgReplayDatabase(ctx.replayUrl, 2);
          ctx.B = await startInstance(ps, db, DEFAULT_STREAM_TIMING, { port, linkPath: link.socketPath });
        });
      },
    });
    await restarted;
    assert.equal(sha(r.bytes), file.digest, 'byte-identical across the instance restart');
    assert.ok(r.answered >= 2, `resumed on the new instance (${r.answered} responses)`);
    measured.push({ case: 'V-35 instance restart', responses: r.answered, refusedConnects: r.refusedConnections, overlapBytes: 0, gapBytes: 0 });
  });
  await report.section('S07 V-35a (5): a 60-minute file, the response lifetime cap lowered to 1 s → ≥ 6 bounded responses, byte-identical', async () => {
    const { S, sArtifact } = ctx;
    const file = await fileOf(ps, sArtifact);
    const db = new PgReplayDatabase(ctx.replayUrl, 2);
    const L = await startInstance(ps, db, { ...DEFAULT_STREAM_TIMING, lifetimeMs: 1_000 });
    try {
      const reads = L.counter.reads;
      // Read at 512 KiB/s: each response then carries more than a paced link buffers, so the cap, not the file's
      // end, ends every response but the last.
      const t = await resumableRead(L.link, () => A, S, sArtifact, file.size, { rate: 8 * FAST_READ });
      assert.equal(sha(t.bytes), file.digest, 'byte-identical');
      assert.ok(t.answered >= 6, `≥ 6 bounded responses (${t.answered})`);
      assert.equal(L.counter.reads - reads, t.answered, 'every response re-ran the read');
      const outcomes = L.reports.map((x) => x.outcome);
      assert.ok(outcomes.slice(0, -1).every((o) => o === 'LIFETIME') && outcomes.at(-1) === 'COMPLETE', `each cut by the cap, the last complete (${outcomes.join(',')})`);
      measured.push({ case: 'V-35 (5) 60-min file, lifetime cap 1 s', responses: t.answered, size: file.size });
    } finally {
      await killInstance(L);
      await db.close();
    }
  });
}

// ------------------------------------------------------------------ teardown
async function removeFixtures(ps) {
  await owner();
  const recordingsOf = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
  const keys = (await rows(`SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordingsOf})
                            UNION SELECT storage_key FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])`, [humans]))
    .map((r) => r.storage_key);
  for (const key of keys) await ps.removeAny(key);
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q(`DELETE FROM voice_private.transient_media_erasures WHERE storage_key IN
               (SELECT storage_key FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[]))`, [humans]);
    await q('DELETE FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.transient_media_requests WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.replay_pool_heartbeats');
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    await q(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
               (SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordings}))`, [humans]);
    await q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]);
    await q(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    await q(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeCommittedFixtures(humans);
  await rt.resetGate();
}

let loginGranted = false;
runVerifier('prove-0196-media-service', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('prove-0196-service', { query: q, restore: () => owner() });
  setStage('login');
  const password = randomBytes(18).toString('hex');
  await owner();
  await q(`ALTER ROLE ${POOL} LOGIN PASSWORD '${password}'`);
  loginGranted = true;
  const url = new URL(process.env.DATABASE_URL);
  url.username = POOL;
  url.password = password;
  const replayUrl = url.toString();
  const db = new PgReplayDatabase(replayUrl, 4);
  const ps = await createProofStore();
  const gateway = await startGateway();
  process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  const scratchRoot = mkdtempSync(join(tmpdir(), 'qandeel-replay-scratch-'));
  const worker = new MediaWorkerService(new TransientMediaRepository(db), ps.store, BIN,
    { concurrency: 1, pollMs: 1000, scratchRoot, instanceId: randomUUID() });
  const drain = async () => {
    const results = [];
    for (;;) {
      const batch = await captured(() => worker.runJobsOnce());
      if (batch.length === 0) return results;
      results.push(...batch);
    }
  };
  const freePort = await new Promise((done) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => done(port)); }); });
  const childEnv = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, HOME: process.env.HOME,
    NODE_ENV: 'test', PORT: String(freePort), QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL',
    REPLAY_MEDIA_DATABASE_URL: replayUrl, REPLAY_MEDIA_DB_POOL_MAX: '2',
    SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT ?? 'http://127.0.0.1:9',
    QANDEEL_MEDIA_S3_REGION: process.env.QANDEEL_MEDIA_S3_REGION ?? 'us-east-1',
    QANDEEL_MEDIA_S3_BUCKET: process.env.QANDEEL_MEDIA_S3_BUCKET ?? 'qandeel-media',
    QANDEEL_MEDIA_S3_ACCESS_KEY_ID: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID ?? 'proof-only',
    QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY ?? 'proof-only-throwaway',
  };
  const ctx = { ps, replayUrl };
  const run = (fn) => captured(fn);
  try {
    setStage('startup');
    await s01Startup(report, childEnv);
    setStage('fixtures');
    ctx.A = await startInstance(ps, db, DEFAULT_STREAM_TIMING);
    ctx.B = await startInstance(ps, new PgReplayDatabase(replayUrl, 2), DEFAULT_STREAM_TIMING);
    const { A } = ctx;
    const long = 6;
    const H = { ...(await listener(ps, 2)), minutes: 2 };
    const X = { ...(await listener(ps, long)), minutes: long };
    const Y = { ...(await listener(ps, long)), minutes: long };
    const Z = { ...(await listener(ps, long)), minutes: long };
    const U = { ...(await listener(ps, long)), minutes: long };
    const G = { ...(await listener(ps, long)), minutes: long };
    const R = { ...(await replayFixture(ps, long)), minutes: long };
    const S = { ...(await listener(ps, 60)), minutes: 60 };
    Object.assign(ctx, { H, X, Y, Z, U, G, R, S });
    setStage('wire');
    await run(async () => {
      ctx.hArtifact = await s02Wire(report, A, ps, H, X);
      ctx.yArtifact = await s03Idempotency(report, A, Y, R);
      await s04LiveCall(report, A, R);
    });
    const replayCommand = await run(() => requestReplay(A, R));
    for (const [key, person] of [['xArtifact', X], ['zArtifact', Z], ['uArtifact', U], ['gArtifact', G], ['sArtifact', S]]) {
      const answer = await run(() => listen(A, person));
      assert.equal(answer.status, 200, 'fixture: the listening request is accepted');
      ctx[key] = answer.body.artifactId;
    }
    setStage('mix');
    const mixed = await drain();
    assert.ok(mixed.length >= 8 && mixed.every((m) => m === 'READY'), `fixture: every file is READY (${mixed.join(',')})`);
    const ready = await run(() => play(A, R, replayCommand));
    assert.equal(ready.body.state, 'READY', 'the retried command reads the READY set');
    assert.ok(typeof ready.body.runs[0].artifactId === 'string', 'a READY run carries its artifactId');
    assert.deepEqual(ready.body.runs[0].spans.map((s) => s.kind), ['WINDOW'], 'one window, nothing else');
    ctx.rArtifact = ready.body.runs[0].artifactId;
    for (const [person, key] of [[H, 'hArtifact'], [X, 'xArtifact'], [Z, 'zArtifact'], [U, 'uArtifact'], [G, 'gArtifact'], [Y, 'yArtifact'], [S, 'sArtifact']]) {
      const st = await run(() => statusOf(A, person, ctx[key]));
      assert.equal(st.body?.state, 'READY', `fixture: READY (${key}: ${st.status} ${JSON.stringify(st.body)})`);
    }
    await run(async () => {
      const big = await fileOf(ps, ctx.hArtifact);
      const unsatisfiable = await slowGet(A.link, ctx.hArtifact, H.token, { range: `bytes=${big.size}-`, rate: 1 << 30 });
      assert.equal(unsatisfiable.status, 416, 'a Range past the end → 416');
    });
    setStage('stream');
    // V-32's and V-35a's precondition: a cut must find the server still sending. A paced reader holds back all but the
    // link's capacity, so the server is still sending until the reader has taken size − capacity. 20 s at 16 KiB/s
    // covers the 1.5 s trigger, the 7 s bound and S05's three 5 s re-checks; S07's 3 s timeout at 64 KiB/s crosses two
    // links (the hop's and the instance's). TCP loopback is measured beside it, for the record only.
    const capacity = { link: await linkCapacity('link'), tcpLoopback: await linkCapacity('tcp') };
    measured.push({ case: 'paced link capacity (bytes a paused reader cannot hold back)', ...capacity });
    const sizes = [];
    for (const key of ['xArtifact', 'yArtifact', 'zArtifact', 'uArtifact', 'gArtifact', 'rArtifact']) sizes.push((await fileOf(ps, ctx[key])).size);
    const smallest = Math.min(...sizes);
    assert.ok(capacity.link + SLOW * 20 < smallest,
      `precondition: the paced link holds ${capacity.link} bytes, so a ${smallest}-byte file is still being sent 20 s into a 16 KiB/s read`);
    assert.ok(2 * capacity.link + 64 * 1024 * 3 < sizes[0],
      `precondition: two paced links hold ${2 * capacity.link} bytes, so S07's 3 s timeout at 64 KiB/s cuts a response still being sent`);
    await run(() => s05Control(report, A, ps, X, ctx.xArtifact));
    await run(() => s07Resume(report, ctx));
    await run(() => s06Cuts(report, ctx));
    await report.section('S08 V-16 / V-18: every answer private and no-store, never a download; no id, key, digest or URL out', async () => {
      assert.ok(answers.length > 40, `${answers.length} answers scanned`);
      for (const a of answers) {
        assert.equal(a.headers['cache-control'], 'no-store, private', `every answer no-store (status ${a.status})`);
        assert.equal(a.headers['content-disposition'], undefined, 'never a download');
        const text = `${a.text} ${JSON.stringify(a.headers)}`;
        for (const id of forbidden) assert.ok(!text.includes(id), 'no fixture id, recording, call, session, Replay or storage key in an answer');
        assert.doesNotMatch(text, /voice-(?:call|note|transient)\/|sha256:|https?:\/\/|storage|recording/iu);
      }
      const audio = wire.length;
      assert.ok(audio > 10, `${audio} audio responses instrumented`);
      assert.equal(wire.reduce((n, s) => n + s.writesAfterDestroy, 0), 0, 'no audio response was written after its termination');
      const text = printed.join('');
      assert.doesNotMatch(text, UUID, 'nothing printed names an id');
      assert.doesNotMatch(text, /voice-(?:call|note|transient)\/|sha256:/u, 'nothing printed names a key or a digest');
    });
  } finally {
    setStage('teardown');
    for (const i of [ctx.A, ctx.B]) if (i) await killInstance(i).catch(() => undefined);
    await ctx.B?.db.close().catch(() => undefined);
    await db.close().catch(() => undefined);
    await new Promise((done) => gateway.close(() => done()));
    await removeFixtures(ps);
    rmSync(scratchRoot, { recursive: true, force: true });
    if (loginGranted) await q(`ALTER ROLE ${POOL} NOLOGIN PASSWORD NULL`);
  }
  console.log(`prove-0196-service store: ${STORE_MODE}`);
  for (const m of measured) console.log(`prove-0196-service measured: ${JSON.stringify(m)}`);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.replay_pool_heartbeats)
      + (SELECT count(*) FROM replay_private.replay_launch_capability_states)
      + (SELECT count(*) FROM pg_roles WHERE rolname = $2 AND rolcanlogin) AS residue`, [humans, POOL]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind (no fixture, no heartbeat, no gate, no login)');
}, async () => {
  if (loginGranted) await q(`ALTER ROLE ${POOL} NOLOGIN PASSWORD NULL`).catch(() => undefined);
  await rt.client.end().catch(() => undefined);
});
