// S8B-07 CP1-B step 4 (V-24a) — the separate Replay load generator: ONE OS process standing in for the Replay pool, started
// and stopped by prove-0196-first-audio-isolation.mjs around the S8B-05 CP3 live-call harness. It never runs by itself.
//
// It passes the shipped pool guard (QANDEEL_COMPUTE_ROLE=REPLAY_MEDIA on QANDEEL_REPLAY_PLACEMENT=REPLAY_POOL) and connects
// to PostgreSQL ONLY as qandeel_replay_media (its own LOGIN session; the shipped preflight refuses anything else), with the
// role's whole CONNECTION LIMIT of 10 split over its parts. It saturates every Replay path at its approved bounds:
//
//   requests    every simulated phone runs two request loops (the per-person bound of 2 active), more phones than the queue's
//               32 pending, so BUSY is answered while the queue is full; status polled at 4 / s per loop
//   claims, heartbeats, plan resolution, mixes
//               two media worker instances at the configurable maximum concurrency of 2 (D-06.1), polling at 250 ms, the
//               pinned ffmpeg, 10-minute and 60-minute listening files and Replay playback sets; the job leases and the
//               pool heartbeat run as shipped
//   the reaper  each worker's reaper (10 s) erases every released file through the Replay-owned ledger; the independent
//               watchdog runs every 10 s (its deployment runs it every 60 s)
//   store       source reads and file writes by the workers, Range reads by the service; in CI the S3 adapter against the
//               same rclone server the call path's upload probe writes to, with a separate client and operation gate per
//               part, as deployed; locally an in-memory store (there is no shared store locally)
//   streaming   two service instances (the shipped ReplayMediaServiceModule over real HTTP, the shipped bearer guard and the
//               same HTTP security and rate limit as the API); every READY file read at full speed in one to three Range
//               parts, then released
//
// Each simulated phone has its own loopback source address, as phones have their own addresses, so the per-address rate
// limit applies to each as it would. One more phone, the natural listener, plays a 60-minute file at a phone's pace and
// resumes with Range every 5 s, as it would at each 10-minute response cap, so the resume gap under load is measured and a
// 429 on that path would show.
//
// Output: content-free JSON lines `V24A_LOAD {...}` (counters, this process's memory and CPU) every 2 s, `V24A_LOAD_READY`
// once the load is flowing, `V24A_LOAD_FINAL {...}` after `stop` on stdin. Nothing printed names an id, key, token or URL.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/api/dist');
const requireApi = createRequire(join(ROOT, 'apps/api/package.json'));
const load = (path) => requireApi(join(DIST, path));
const { Test } = requireApi('@nestjs/testing');
const { assertReplayPoolProcess } = load('replay-media/replay-compute-role.js');
const { PgReplayDatabase } = load('replay-media/replay-database.js');
const { MediaWorkerService } = load('replay-media/media-worker.service.js');
const { ReplayWatchdogService } = load('replay-media/replay-watchdog.service.js');
const { TransientMediaRepository } = load('replay-media/transient-media.repository.js');
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

// The shipped guard first: this process is the Replay pool or it does not start.
assertReplayPoolProcess('REPLAY_MEDIA', process.env);
const fixtures = JSON.parse(readFileSync(process.env.V24A_LOAD_FIXTURES, 'utf8'));
const STORE_MODE = process.env.REPLAY_PROOF_STORE === 's3' ? 's3' : 'memory';
const BIN = { ffmpeg: process.env.FFMPEG_BIN, ffprobe: process.env.FFPROBE_BIN };
const PUBLISHABLE = 'proof-only-publishable-key';
const MINUTE = 60_000;
const out = (tag, value) => process.stdout.write(`${tag}${value === undefined ? '' : ` ${JSON.stringify(value)}`}\n`);

// ------------------------------------------------------------------ the sources (the call writer's real Ogg Opus, a tone)
function userMinute() {
  const rate = UPLINK_OPUS.rate;
  const per = (rate * 20) / 1000;
  const encoder = new OpusPacketEncoder(rate, UPLINK_OPUS.bitrate);
  const packets = [];
  for (let start = 0; start < MINUTE; start += 20) {
    const pcm = Buffer.alloc(per * 2);
    for (let i = 0; i < per; i += 1) {
      pcm.writeInt16LE(Math.round(0.25 * Math.sin((2 * Math.PI * 440 * (start + (i * 1000) / rate)) / 1000) * 32767), i * 2);
    }
    packets.push(encoder.encode(pcm));
  }
  encoder.close();
  return muxOggOpus(packets, { serial: 1, inputRate: rate });
}

// ------------------------------------------------------------------ the store (in memory, or the S3 adapter against rclone)
function pulled(bytes) {
  let at = 0;
  return new Readable({
    read() {
      if (at >= bytes.length) { this.push(null); return; }
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
    async headTransient(key, meter) { if (meter) meter.ops += 1; return objects.has(key) ? objects.get(key).length : null; },
    async removeTransient(key, meter) { if (meter) meter.ops += 1; objects.delete(key); },
    async openTransient(key, range) {
      const body = objects.get(key);
      if (!body) return null;
      return pulled(range ? body.subarray(range.start, range.end + 1) : body);
    },
  };
}
const memoryObjects = new Map();
/** One store per part, as deployed: in S3 mode each has its own client and its own operation gate (P-3). */
const storeForPart = () => (STORE_MODE === 'memory' ? memoryStore(memoryObjects) : new S3TransientAudioStore(process.env));
async function putSources() {
  const bytes = userMinute();
  const keys = fixtures.listeners.concat(fixtures.replays, [fixtures.natural]).flatMap((f) => f.keys.concat(f.twin?.keys ?? []));
  if (STORE_MODE === 'memory') {
    for (const key of keys) memoryObjects.set(key, bytes);
    return keys.length;
  }
  const { S3Client, PutObjectCommand } = requireApi('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: process.env.QANDEEL_MEDIA_S3_ENDPOINT, region: process.env.QANDEEL_MEDIA_S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY },
  });
  for (let i = 0; i < keys.length; i += 8) {
    await Promise.all(keys.slice(i, i + 8).map((Key) => client.send(new PutObjectCommand({
      Bucket: process.env.QANDEEL_MEDIA_S3_BUCKET, Key, Body: bytes, ContentLength: bytes.length,
    }))));
  }
  client.destroy();
  return keys.length;
}

// ------------------------------------------------------------------ the bearer check's peer (a loopback /auth/v1/user)
const tokens = new Map();
const tokenFor = (user) => { const t = randomBytes(24).toString('hex'); tokens.set(t, user); return t; };
function startGateway() {
  const server = http.createServer((request, response) => {
    const token = (request.headers.authorization ?? '').replace(/^Bearer\s+/iu, '');
    if (request.url !== '/auth/v1/user' || request.headers.apikey !== PUBLISHABLE || !tokens.has(token)) {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: tokens.get(token) }));
  });
  server.keepAliveTimeout = 30_000;
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

// ------------------------------------------------------------------ counters (content-free)
const stats = {
  requests: 0, accepted: 0, busy: 0, rateLimited: 0, otherRefusals: 0, statusPolls: 0, ready: 0, failed: 0,
  streams: 0, rangeRequests: 0, bytesStreamed: 0, streamErrors: 0, sizeMismatches: 0, releases: 0, watchdogRuns: 0,
  watchdogErased: 0, statuses: {}, byRoute: { request: {}, poll: {}, read: {}, release: {} },
  natural: { requests: 0, rangeResumes: 0, rateLimited: 0, refusals: 0, resumeFirstByteMs: [], completedFiles: 0, bytes: 0 },
};
/** Each route's time to its first byte (a refusal's too), and this process's own event-loop delay: the generator and the
 * services share one process here, so a slow answer is traced to the database, the pool or the process itself. */
const routeMs = { request: [], poll: [], read: [], release: [] };
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
const summary = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const at = (p) => (s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]) : null);
  return { n: s.length, p50: at(0.5), p95: at(0.95), max: s.length ? Math.round(s.at(-1)) : null };
};
const count = (status, route) => {
  stats.statuses[status] = (stats.statuses[status] ?? 0) + 1;
  stats.byRoute[route][status] = (stats.byRoute[route][status] ?? 0) + 1;
};

// ------------------------------------------------------------------ the HTTP client (each phone from its own source address)
const agents = new Map();
const agentOf = (address) => {
  if (!agents.has(address)) agents.set(address, new http.Agent({ keepAlive: true, maxSockets: 4, localAddress: address }));
  return agents.get(address);
};
function send(port, method, path, phone, { range = null, onData = null, signal = undefined } = {}) {
  return new Promise((done) => {
    const started = performance.now();
    let firstByteMs = null;
    let response = null;
    let bytes = 0;
    const chunks = [];
    // One answer per request: the response's status even when the client cut it (an intended Range cut is not a refusal).
    const finish = (error) => done({
      status: response?.statusCode ?? 0, headers: response?.headers ?? {}, bytes, error, firstByteMs,
      body: onData ? null : Buffer.concat(chunks),
    });
    const request = http.request({
      host: '127.0.0.1', port, path, method, agent: agentOf(phone.address), signal,
      headers: { Authorization: `Bearer ${phone.token}`, ...(range ? { Range: range } : {}) },
    }, (answer) => {
      response = answer;
      answer.on('data', (chunk) => {
        if (firstByteMs === null) firstByteMs = performance.now() - started;
        bytes += chunk.length;
        if (onData) onData(chunk, answer);
        else chunks.push(chunk);
      });
      answer.on('end', () => finish(!answer.complete));
      answer.on('error', () => finish(true));
      answer.on('aborted', () => finish(true));
    });
    request.on('error', () => finish(true));
    request.end();
  });
}
const json = (answer) => { try { return answer.body?.length ? JSON.parse(answer.body.toString('utf8')) : null; } catch { return null; } };

let running = true;
/** Resolved once the natural listener's file is READY (the load phones start after it). */
let naturalStarted = () => undefined;
/** A refusal or an answer, counted; BUSY and 429 are the bounds working, never an error of the generator. */
function tally(answer, route) {
  count(answer.status, route);
  if (answer.firstByteMs !== null) routeMs[route].push(answer.firstByteMs);
  if (answer.status === 429) stats.rateLimited += 1;
  else if (answer.status === 503) stats.busy += 1;
  else if (answer.status !== 200 && answer.status !== 206) stats.otherRefusals += 1;
}

/** Reads one READY file at full speed in one to three Range parts (each a new request, each re-checked by the database). */
async function streamWhole(port, phone, artifact) {
  stats.streams += 1;
  let size = null;
  let at = 0;
  const parts = 1 + Math.floor(Math.random() * 3);
  for (let part = 0; running && (size === null || at < size); part += 1) {
    const controller = new AbortController();
    const cutAt = part < parts - 1 ? 64 * 1024 + Math.floor(Math.random() * 512 * 1024) : Infinity;
    let got = 0;
    const answer = await send(port, 'GET', `/voice/transient/${artifact}`, phone, {
      range: at > 0 ? `bytes=${at}-` : null, signal: controller.signal,
      onData: (chunk) => { got += chunk.length; if (got >= cutAt) controller.abort(); },
    });
    stats.rangeRequests += 1;
    tally(answer, 'read');
    if (answer.status !== 200 && answer.status !== 206) return false;
    if (size === null) {
      const total = answer.status === 206 ? Number(String(answer.headers['content-range']).split('/')[1]) : Number(answer.headers['content-length']);
      size = total;
    }
    at += got;
    stats.bytesStreamed += got;
    if (answer.error && got < cutAt) stats.streamErrors += 1;
  }
  if (size !== null && at !== size && running) stats.sizeMismatches += 1;
  return true;
}

/** One request loop of a phone on one of its two subjects: request, poll, stream, release, again (the per-person bound of 2). */
async function phoneLoop(port, person, subject) {
  const phone = { ...person, call: subject.call, replay: subject.replay, version: subject.version };
  while (running) {
    const command = randomUUID();
    const path = phone.kind === 'replay' ? `/replay/${phone.replay}/versions/${phone.version}/playback/${command}`
      : `/voice/listening/${phone.call}/${command}`;
    stats.requests += 1;
    const asked = await send(port, 'POST', path, phone);
    tally(asked, 'request');
    if (asked.status !== 200) { await sleep(250); continue; }
    stats.accepted += 1;
    let body = json(asked);
    let artifacts = phone.kind === 'replay' ? [] : [body.artifactId];
    let state = body.state;
    while (running && (state === 'PENDING' || state === 'RUNNING')) {
      await sleep(250);
      stats.statusPolls += 1;
      const polled = phone.kind === 'replay' ? await send(port, 'POST', path, phone) : await send(port, 'GET', `/voice/transient/${artifacts[0]}/status`, phone);
      tally(polled, 'poll');
      if (polled.status !== 200) { if (polled.status === 404) break; continue; }
      body = json(polled);
      state = body.state;
    }
    if (!running) return;
    if (state === 'READY') {
      stats.ready += 1;
      if (phone.kind === 'replay') artifacts = body.runs.map((r) => r.artifactId);
      for (const artifact of artifacts) if (running) await streamWhole(port, phone, artifact);
    } else if (state === 'FAILED') stats.failed += 1;
    if (phone.kind === 'replay' && artifacts.length === 0) {
      // A set that did not become READY: its artifact ids were never presented, so it is left to its expiry.
      continue;
    }
    for (const artifact of artifacts) {
      const released = await send(port, 'DELETE', `/voice/transient/${artifact}`, phone);
      tally(released, 'release');
      if (released.status === 200) stats.releases += 1;
    }
  }
}

/**
 * The natural listener: a 60-minute file read at a phone's pace (64 KiB/s, far above the 4 KiB/s it plays at, so the
 * buffer leads), cut every 5 s and resumed with Range from the exact byte, as at each 10-minute response cap.
 */
async function naturalLoop(port, phone) {
  const n = stats.natural;
  while (running) {
    const asked = await send(port, 'POST', `/voice/listening/${phone.call}/${randomUUID()}`, phone);
    n.requests += 1;
    if (asked.status === 429) n.rateLimited += 1;
    if (asked.status !== 200) { n.refusals += 1; await sleep(1000); continue; }
    const artifact = json(asked).artifactId;
    let state = json(asked).state;
    while (running && (state === 'PENDING' || state === 'RUNNING')) {
      await sleep(1000);
      const polled = await send(port, 'GET', `/voice/transient/${artifact}/status`, phone);
      n.requests += 1;
      if (polled.status === 429) n.rateLimited += 1;
      if (polled.status === 200) state = json(polled).state;
      else n.refusals += 1;
    }
    if (!running) return;
    naturalStarted();
    let at = 0;
    let size = null;
    while (running && (size === null || at < size)) {
      const controller = new AbortController();
      const began = performance.now();
      let got = 0;
      const answer = await send(port, 'GET', `/voice/transient/${artifact}`, phone, {
        range: at > 0 ? `bytes=${at}-` : null, signal: controller.signal,
        onData: (chunk, response) => {
          got += chunk.length;
          if (performance.now() - began > 5_000) { controller.abort(); return; }
          const wait = (got / (64 * 1024)) * 1000 - (performance.now() - began);
          if (wait > 0) { response.pause(); setTimeout(() => response.resume(), wait); }
        },
      });
      n.requests += 1;
      if (at > 0) {
        n.rangeResumes += 1;
        if (answer.firstByteMs !== null) n.resumeFirstByteMs.push(Math.round(answer.firstByteMs * 10) / 10);
      }
      if (answer.status === 429) n.rateLimited += 1;
      if (answer.status !== 200 && answer.status !== 206) { n.refusals += 1; break; }
      if (size === null) size = answer.status === 206 ? Number(String(answer.headers['content-range']).split('/')[1]) : Number(answer.headers['content-length']);
      at += got;
      n.bytes += got;
    }
    if (size !== null && at === size) n.completedFiles += 1;
    const released = await send(port, 'DELETE', `/voice/transient/${artifact}`, phone);
    n.requests += 1;
    if (released.status === 429) n.rateLimited += 1;
  }
}

// ------------------------------------------------------------------ the pool
async function startService(db) {
  const moduleRef = await Test.createTestingModule({ imports: [ReplayMediaServiceModule] })
    .overrideProvider(REPLAY_DATABASE).useValue(db)
    .overrideProvider(TRANSIENT_AUDIO_STORE).useValue(storeForPart())
    .overrideProvider(TRANSIENT_STREAM_TIMING).useValue(DEFAULT_STREAM_TIMING)
    .overrideProvider(TRANSIENT_STREAM_REPORTS).useValue(null)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureHttpSecurity(app, parseProxyConfiguration({ NODE_ENV: 'test' }));
  await TransientPlaybackService.preflight(db, storeForPart(), process.env);
  await app.listen(0, '127.0.0.1');
  return { app, port: app.getHttpServer().address().port };
}

async function main() {
  const url = process.env.REPLAY_MEDIA_DATABASE_URL;
  // The role's CONNECTION LIMIT of 10, split: two service instances (3 + 2), two workers (2 + 2), the watchdog (1).
  const dbs = { a: new PgReplayDatabase(url, 3), b: new PgReplayDatabase(url, 2), w1: new PgReplayDatabase(url, 2),
    w2: new PgReplayDatabase(url, 2), dog: new PgReplayDatabase(url, 1) };
  const sources = await putSources();
  const gateway = await startGateway();
  process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  const A = await startService(dbs.a);
  const B = await startService(dbs.b);
  const scratch = mkdtempSync(join(tmpdir(), 'qandeel-v24a-scratch-'));
  const workers = [dbs.w1, dbs.w2].map((db, i) => new MediaWorkerService(new TransientMediaRepository(db), storeForPart(), BIN,
    { concurrency: 2, pollMs: 250, scratchRoot: join(scratch, `w${i}`), instanceId: randomUUID() }));
  // The shipped start-up checks of each part: the Replay role itself, a configured store, the pinned ffmpeg.
  for (const db of [dbs.w1, dbs.w2]) await MediaWorkerService.preflight(db, storeForPart(), BIN);
  for (const w of workers) await w.start();
  const watchdog = new ReplayWatchdogService(new TransientMediaRepository(dbs.dog), storeForPart());
  await ReplayWatchdogService.preflight(dbs.dog, storeForPart());
  const dogTimer = setInterval(() => {
    void watchdog.runOnce().then((run) => { stats.watchdogRuns += 1; stats.watchdogErased += run.erased; }, () => undefined);
  }, 10_000);

  // The phones: each its own loopback address; half on each service instance.
  let octet = 2;
  const phoneOf = (f) => ({ ...f, token: tokenFor(f.user), address: `127.0.1.${octet++}` });
  const phones = fixtures.listeners.map((f) => ({ ...phoneOf(f), kind: 'listen' }))
    .concat(fixtures.replays.map((f) => ({ ...phoneOf(f), kind: 'replay' })));
  const natural = { ...fixtures.natural, token: tokenFor(fixtures.natural.user), address: '127.0.2.2' };
  // The natural listener asks first, so its long file is made before the queue fills; then every phone starts.
  const naturalPlaying = new Promise((done) => { naturalStarted = done; });
  const loops = [naturalLoop(A.port, natural)];
  await Promise.race([naturalPlaying, sleep(120_000)]);
  loops.push(...phones.flatMap((p, i) => [phoneLoop(i % 2 ? B.port : A.port, p, p), phoneLoop(i % 2 ? A.port : B.port, p, p.twin)]));

  loopDelay.enable();
  const started = performance.now();
  const startCpu = process.cpuUsage();
  const snapshot = () => {
    const cpu = process.cpuUsage(startCpu);
    const { natural: n, ...rest } = stats;
    return {
      atMs: Math.round(performance.now() - started), store: STORE_MODE, sources, phones: phones.length, ...rest,
      natural: { ...n, resumeFirstByteMs: [...n.resumeFirstByteMs] },
      routeFirstByteMs: Object.fromEntries(Object.entries(routeMs).map(([route, v]) => [route, summary(v)])),
      eventLoopDelayMs: { p50: Math.round(loopDelay.percentile(50) / 1e6), p99: Math.round(loopDelay.percentile(99) / 1e6), max: Math.round(loopDelay.max / 1e6) },
      rssMiB: Math.round(process.memoryUsage().rss / 1048576), nodeCpuMs: Math.round((cpu.user + cpu.system) / 1000),
    };
  };
  const ticker = setInterval(() => out('V24A_LOAD', snapshot()), 2_000);
  // Ready once files are being made and streamed.
  for (let i = 0; i < 600 && stats.streams < 2; i += 1) await sleep(100);
  out('V24A_LOAD_READY', { atMs: Math.round(performance.now() - started), streams: stats.streams });

  await new Promise((done) => {
    let buffered = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buffered += c; if (buffered.includes('stop')) done(); });
    process.stdin.on('end', done);
  });
  running = false;
  clearInterval(ticker);
  clearInterval(dogTimer);
  await Promise.race([Promise.allSettled(loops), sleep(15_000)]);
  for (const w of workers) await w.stop();
  for (const i of [A, B]) {
    i.app.getHttpServer().closeAllConnections();
    await i.app.close();
  }
  for (const agent of agents.values()) agent.destroy();
  await new Promise((done) => gateway.close(() => done()));
  for (const db of Object.values(dbs)) await db.close().catch(() => undefined);
  rmSync(scratch, { recursive: true, force: true });
  const final = snapshot();
  out('V24A_LOAD_FINAL', { ...final, natural: { ...stats.natural } });
  process.exit(0);
}

main().catch((error) => {
  // Content-free: the error's class and a digest of its message, never the message (it may carry a URL).
  out('V24A_LOAD_FAILED', { name: error?.name ?? 'Error', digest: createHash('sha256').update(String(error?.message)).digest('hex').slice(0, 12),
    stack: String(error?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim().replace(/\(.*[\\/]/u, '(')) });
  process.exit(1);
});
