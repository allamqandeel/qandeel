// S6-06 (CP1) - live proof of the Introduction photo path THROUGH a real PostgREST server and a real S3 server, driven by
// the API's OWN compiled code (apps/api/dist, built earlier in the same CI job).
//
// verify-migration-0162.mjs proves the database. This proves what only the whole path can: the compiled Nest module on
// a real HTTP port, its S3 adapter against `rclone serve s3` (a real S3-protocol server, not a mock), PostgREST for the
// database, and the erasure worker - with the storage server's own access log and its data directory as the
// independent witnesses. ListObjects is never taken as proof that storage is empty: every emptiness claim below is a
// scan of the server's data directory, hidden files included (condition 2).
//
//   P01  production shape: with every seam NOT_EVALUATED an upload answers NOT_AVAILABLE_NOW and nothing is stored
//   P02  an upload stores exactly three objects, under the database's keys, with no EXIF / GPS and not the uploaded bytes
//   P03  stage by stage, the other human receives exactly the shared stage's bytes and nothing clearer is ever READ from
//        storage on their behalf (the server's access log); the response is no-store, private
//   P04  removal: refused at once while the objects still exist; the worker then erases them, proven by HEAD and by the
//        data directory; no trace of the keys or handles survives in the database
//   P05  failures: the storage delete fails twice, the key is deferred and kept, and erased on the retry
//   P06  condition 1: an upload still in flight when the photo is removed (its first object held, the three written one
//        at a time) - its keys wait out the upload deadline, all three land late and are erased; and an object written
//        after its erasure is found by the listing reconciliation
//   P07  condition 2: an aborted upload leaves no partial or hidden file (the server removes it, and the directory scan
//        confirms); a storage server KILLED mid-upload leaves a hidden temporary file that ListObjects does not show -
//        the harness janitor removes it, and only the directory scan can prove that
//   P08  the storage server refuses unsigned requests; the media route refuses a request without a token
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL, POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container), QANDEEL_MEDIA_S3_ENDPOINT / _REGION / _BUCKET / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY (the
// CI-only rclone credentials), RCLONE_DATA_DIR (the directory rclone serves; the bucket is its sub-directory),
// RCLONE_LOG_FILE (its DEBUG log) and RCLONE_BIN (the verified binary, for the kill scenario).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { I07D_SEAMS, PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
const dataDir = process.env.RCLONE_DATA_DIR;
const logFile = process.env.RCLONE_LOG_FILE;
const rcloneBin = process.env.RCLONE_BIN;
const bucket = process.env.QANDEEL_MEDIA_S3_BUCKET;
for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, POSTGREST_JWT_SECRET: secret, RCLONE_DATA_DIR: dataDir,
  RCLONE_LOG_FILE: logFile, RCLONE_BIN: rcloneBin, QANDEEL_MEDIA_S3_BUCKET: bucket, QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT })) {
  if (!value) throw new Error(`${name} is required.`);
}
process.env.NODE_ENV = 'test';

const rt = createIntroductionRuntime(databaseUrl);
const { rows } = rt;
let stage = 'load the compiled API';
const sharp = require('sharp');
const { NestFactory } = require('@nestjs/core');
const { IntroductionsDisclosureModule } = require('../apps/api/dist/introductions-disclosure/introductions-disclosure.module.js');
const { IntroductionDisclosureRepository } = require('../apps/api/dist/introductions-disclosure/introduction-disclosure.repository.js');
const { IntroductionDisclosureService } = require('../apps/api/dist/introductions-disclosure/introduction-disclosure.service.js');
const { IntroductionMediaErasureWorker } = require('../apps/api/dist/introductions-disclosure/introduction-media-erasure.worker.js');
const { S3IntroductionMediaStore } = require('../apps/api/dist/introductions-disclosure/introduction-media.store.js');
const { SupabaseDataApiService } = require('../apps/api/dist/conversation/supabase-data-api.service.js');
const { SupabaseServiceRoleApiService } = require('../apps/api/dist/conversation/supabase-service-role-api.service.js');

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 900 }))}`;
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
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: sub }));
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

// ---- the independent witnesses
/** Every file under a directory, hidden files included, as paths relative to it. */
function filesUnder(root) {
  if (!existsSync(root)) return [];
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path.slice(root.length + 1).replace(/\\/gu, '/')];
  });
  return walk(root);
}
const stored = () => filesUnder(join(dataDir, bucket)).filter((f) => f.startsWith('intro-media/'));
const fileOf = (key) => join(dataDir, bucket, ...key.split('/'));
const logSize = () => (existsSync(logFile) ? statSync(logFile).size : 0);
/** The storage keys the server READ (GET OBJECT) since a log offset. */
function readsSince(offset) {
  const text = readFileSync(logFile).subarray(offset).toString('utf8');
  return [...text.matchAll(/GET OBJECT Bucket: \S+ Object: (intro-media\/[0-9a-f-]{36})/gu)].map((m) => m[1]);
}

async function photo() {
  const pixels = Buffer.alloc(900 * 1200 * 3);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = (i / 3) % 251; pixels[i + 1] = (i / 7) % 253; pixels[i + 2] = 90; }
  return sharp(pixels, { raw: { width: 900, height: 1200, channels: 3 } })
    .withExif({ IFD0: { Artist: 'prove-0162' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '30/1 2/1 0/1' } }).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  await rt.client.connect();
  const [a, b, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const humans = [a, b, outsider];
  const seams = [];
  let app = null;
  let gateway = null;
  let failure = null;
  const started = new Date();
  try {
    stage = 'gateway and compiled module';
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'prove-0162-gateway';
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role' });
    app = await NestFactory.create(IntroductionsDisclosureModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const tokens = { a: jwt({ sub: a, role: 'authenticated' }), b: jwt({ sub: b, role: 'authenticated' }), outsider: jwt({ sub: outsider, role: 'authenticated' }) };
    const call = async (token, method, path, body, type = 'application/json') => {
      const response = await fetch(`${api}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': type } : {}) },
        body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(60_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const json = (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(bytes.toString('utf8') || 'null') : null;
      return { status: response.status, headers: response.headers, bytes, json };
    };
    const store = new S3IntroductionMediaStore();
    const repository = new IntroductionDisclosureRepository(new SupabaseDataApiService(), new SupabaseServiceRoleApiService());
    const worker = new IntroductionMediaErasureWorker(repository, store);
    assert.equal(store.isConfigured(), true, 'the S3 adapter is configured from the CI-only environment');

    stage = 'fixtures';
    await rt.provisionHumans(humans);
    for (const seam of [PFN.PREREQUISITES, ...I07D_SEAMS]) seams.push(await rt.captureMatchingSeam(seam));
    await rt.clearProposalPrerequisites();
    await rt.recordFacts(a, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(b, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToIntroduction(a, b);
    await rt.asRole('postgres');
    const world = f.world;
    const before = stored();

    stage = 'P01 production shape: nothing is stored';
    const closed = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image/${randomUUID()}`, await photo(), 'image/jpeg');
    assert.deepEqual([closed.status, closed.json], [200, { outcome: 'NOT_AVAILABLE_NOW' }]);
    assert.deepEqual(stored(), before, 'P01 the data directory is unchanged');
    assert.equal(Number((await rows('SELECT count(*) n FROM introduction_sharing_private.image_series WHERE world_id = $1', [world]))[0].n), 0, 'P01 no intent');

    stage = 'P02 upload: three objects under the database keys, cleaned';
    await rt.clearAllSeams();
    const original = await photo();
    const up = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image/${randomUUID()}`, original, 'image/jpeg');
    assert.equal(up.json?.outcome, 'READY', `P02 READY (${JSON.stringify(up.json)})`);
    const series = up.json.seriesId;
    const renditions = await rows('SELECT handle, stage, storage_key FROM introduction_sharing_private.image_renditions WHERE series_id = $1 ORDER BY stage', [series]);
    const keys = renditions.map((r) => r.storage_key);
    const handles = renditions.map((r) => r.handle);
    assert.deepEqual(stored().filter((k) => !before.includes(k)).sort(), [...keys].sort(), 'P02 exactly the three keys the database chose');
    for (const key of keys) {
      const bytes = readFileSync(fileOf(key));
      const meta = await sharp(bytes).metadata();
      assert.deepEqual([meta.format, meta.exif, meta.icc], ['jpeg', undefined, undefined], `P02 ${key} carries no EXIF / GPS / ICC`);
      assert.notEqual(bytes.equals(original), true, 'P02 the uploaded bytes are never stored');
    }
    assert.deepEqual(JSON.stringify(up.json).match(/intro-media/gu), null, 'P02 the client never sees a storage key');

    stage = 'P03 stage by stage, only the shared stage is read for the other human';
    for (const handle of handles) {
      const r = await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handle}`);
      assert.equal(r.status, 404, 'P03 nothing before a stage is shared');
    }
    const share = async (n) => (await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-stages`, { commandId: randomUUID(), seriesId: series, stage: n })).json;
    assert.equal((await share(1)).outcome, 'DISCLOSED');
    let mark = logSize();
    const s1 = await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handles[0]}`);
    assert.equal(s1.status, 200);
    assert.equal(s1.headers.get('cache-control'), 'no-store, private', 'P03 no-store, private');
    assert.equal(s1.headers.get('content-type'), 'image/jpeg');
    assert.equal(s1.bytes.equals(readFileSync(fileOf(keys[0]))), true, 'P03 exactly the stage-1 rendition');
    for (const handle of handles.slice(1)) assert.equal((await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handle}`)).status, 404);
    assert.equal((await call(tokens.outsider, 'GET', `/introductions/worlds/${world}/media/${handles[0]}`)).status, 404, 'P03 an outsider receives nothing');
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    assert.deepEqual([...new Set(readsSince(mark))], [keys[0]], 'P03 the storage server read only the stage-1 object');
    assert.equal((await share(2)).outcome, 'DISCLOSED');
    mark = logSize();
    assert.equal((await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handles[1]}`)).status, 200);
    assert.equal((await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handles[2]}`)).status, 404, 'P03 never the clear photo before stage 3');
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    assert.equal(readsSince(mark).includes(keys[2]), false, 'P03 the clear object was never read');

    stage = 'P04 removal: refused at once, erased by the worker, no trace';
    const removed = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-removal`, { commandId: randomUUID(), seriesId: series });
    assert.equal(removed.json?.outcome, 'REMOVED');
    for (const handle of handles) assert.equal((await call(tokens.b, 'GET', `/introductions/worlds/${world}/media/${handle}`)).status, 404, 'P04 refused at once');
    assert.equal(keys.every((key) => existsSync(fileOf(key))), true, 'P04 refused while the objects still exist');
    await worker.runOnce();
    for (const key of keys) {
      assert.equal(existsSync(fileOf(key)), false, `P04 ${key} is gone from the data directory`);
      assert.equal(await store.exists(key, AbortSignal.timeout(5000)), false, 'P04 HEAD 404');
    }
    const traces = await rows(`SELECT
        (SELECT count(*) FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[]))
      + (SELECT count(*) FROM introduction_sharing_private.image_renditions WHERE handle = ANY($2::uuid[]))
      + (SELECT count(*) FROM public.introduction_disclosure_media_payloads WHERE media_object_ref = ANY($3::text[])) AS n`,
    [keys, handles, handles.map((h) => `qmedia:${h}`)]);
    assert.equal(Number(traces[0].n), 0, 'P04 no key, handle or media reference survives');

    stage = 'P05 a failing storage delete is deferred, kept and retried';
    const second = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image/${randomUUID()}`, await photo(), 'image/jpeg');
    assert.equal(second.json?.outcome, 'READY');
    const keys2 = (await rows('SELECT storage_key FROM introduction_sharing_private.image_renditions WHERE series_id = $1', [second.json.seriesId])).map((r) => r.storage_key);
    await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-removal`, { commandId: randomUUID(), seriesId: second.json.seriesId });
    let failures = 2 * keys2.length;
    const flaky = { ...store, isConfigured: () => true, exists: (k, s) => store.exists(k, s), listOlderThan: (...x) => store.listOlderThan(...x),
      remove: async (k, s) => { if (failures > 0) { failures -= 1; throw new Error('injected storage failure'); } return store.remove(k, s); } };
    const flakyWorker = new IntroductionMediaErasureWorker(repository, flaky);
    for (let round = 0; round < 2; round += 1) {
      const result = await flakyWorker.runOnce();
      assert.equal(result.erased, 0, 'P05 nothing confirmed while the delete fails');
      const [{ held, attempts }] = await rows(`SELECT count(*)::int held, min(attempts)::int attempts FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])`, [keys2]);
      assert.deepEqual([held, attempts], [3, round + 1], 'P05 every key kept, its attempt counted');
      assert.equal(keys2.every((k) => existsSync(fileOf(k))), true);
      await rows(`UPDATE introduction_sharing_private.media_erasure_queue SET not_before = clock_timestamp() WHERE storage_key = ANY($1::text[])`, [keys2]);
    }
    assert.equal((await flakyWorker.runOnce()).erased, 3, 'P05 erased on the retry');
    assert.equal(keys2.some((k) => existsSync(fileOf(k))), false);

    stage = 'P06 condition 1: an upload in flight when the photo is removed';
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let entered = 0;
    const slowStore = { ...flaky, remove: (k, s) => store.remove(k, s), get: (k, s) => store.get(k, s), put: async (k, bytes, s) => { entered += 1; await gate; return store.put(k, bytes, s); } };
    const slowService = new IntroductionDisclosureService(repository, slowStore);
    const command = randomUUID();
    const pending = slowService.uploadImage(tokens.a, world, command, await photo());
    let inflight = null;
    for (let i = 0; i < 200 && entered < 1; i += 1) await new Promise((resolve) => { setTimeout(resolve, 100); });
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    // The renditions are written one at a time: the first is held in flight and the other two have not started.
    assert.equal(entered, 1, 'P06 the upload is in flight, one object at a time');
    inflight = (await rows('SELECT id FROM introduction_sharing_private.image_series WHERE begin_command_id = $1', [command]))[0]?.id ?? null;
    assert.ok(inflight, 'P06 the intent exists before any byte is stored');
    const lateKeys = (await rows('SELECT storage_key FROM introduction_sharing_private.image_renditions WHERE series_id = $1', [inflight])).map((r) => r.storage_key);
    assert.equal(lateKeys.length, 3, 'P06 the intent holds all three keys');
    assert.equal(lateKeys.some((k) => existsSync(fileOf(k))), false, 'P06 nothing has landed yet');
    assert.equal((await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-removal`, { commandId: randomUUID(), seriesId: inflight })).json?.outcome, 'REMOVED');
    const due = await worker.runOnce();
    assert.equal(due.erased, 0, 'P06 the keys of an upload still in flight are not erased before its deadline');
    release();
    assert.equal((await pending).outcome, 'UNAVAILABLE', 'P06 the late completion is refused');
    assert.equal(entered, 3, 'P06 all three objects were written after the removal');
    assert.equal(lateKeys.every((k) => existsSync(fileOf(k))), true, 'P06 the late objects did land');
    await rows(`UPDATE introduction_sharing_private.media_erasure_queue SET not_before = clock_timestamp() WHERE storage_key = ANY($1::text[])`, [lateKeys]);
    assert.equal((await worker.runOnce()).erased, 3, 'P06 and are erased once the deadline has passed');
    assert.equal(lateKeys.some((k) => existsSync(fileOf(k))), false);
    const orphan = `intro-media/${randomUUID()}`;
    await store.put(orphan, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), AbortSignal.timeout(5000));
    assert.equal(existsSync(fileOf(orphan)), true, 'P06 an object written after every erasure');
    assert.equal(await worker.reconcile(new Date(Date.now() + 11 * 60_000)), 1, 'P06 the listing reconciliation finds exactly the unknown object');
    assert.equal((await worker.runOnce()).erased, 1);
    assert.equal(existsSync(fileOf(orphan)), false, 'P06 and it is erased');

    stage = 'P07 condition 2: aborted and killed uploads';
    const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const client = (endpoint) => new S3Client({ endpoint, region: process.env.QANDEEL_MEDIA_S3_REGION, forcePathStyle: true, maxAttempts: 1,
      credentials: { accessKeyId: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    const { Readable } = await import('node:stream');
    const abortedKey = `intro-media/${randomUUID()}`;
    mark = logSize();
    const controller = new AbortController();
    const body = new Readable({ read() {} });
    body.push(Buffer.alloc(256 * 1024, 7));
    const aborted = client(process.env.QANDEEL_MEDIA_S3_ENDPOINT).send(new PutObjectCommand({ Bucket: bucket, Key: abortedKey, Body: body, ContentLength: 4 * 1024 * 1024 }),
      { abortSignal: controller.signal }).then(() => 'stored', (e) => e.name);
    await new Promise((resolve) => { setTimeout(resolve, 800); });
    controller.abort();
    assert.notEqual(await aborted, 'stored');
    await new Promise((resolve) => { setTimeout(resolve, 1500); });
    assert.deepEqual(filesUnder(join(dataDir, bucket)).filter((p) => /rclone_temp|\.partial/u.test(p)), [], 'P07 no hidden temporary file after an aborted upload');
    assert.equal(existsSync(fileOf(abortedKey)), false, 'P07 and no partial object');
    assert.match(readFileSync(logFile).subarray(mark).toString('utf8'), /Removing partially written file on error/u, 'P07 the server reports removing the partial file');
    // A storage server killed part-way through: rclone documents that its hidden temporary object may stay behind.
    const killDir = mkdtempSync(join(tmpdir(), 'prove-0162-kill-'));
    mkdirSync(join(killDir, bucket));
    const port = 9400 + Math.floor(Math.random() * 400);
    const killed = spawn(rcloneBin, ['serve', 's3', '--addr', `127.0.0.1:${port}`, '--auth-key',
      `${process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID},${process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY}`, killDir], { stdio: 'ignore' });
    try {
      for (let i = 0; i < 50; i += 1) {
        const up2 = await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false);
        if (up2) break;
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      }
      const slow = new Readable({ read() {} });
      slow.push(Buffer.alloc(512 * 1024, 9));
      const hanging = client(`http://127.0.0.1:${port}`).send(new PutObjectCommand({ Bucket: bucket, Key: `intro-media/${randomUUID()}`, Body: slow, ContentLength: 8 * 1024 * 1024 }))
        .then(() => 'stored', (e) => e.name);
      let temp = [];
      for (let i = 0; i < 50 && temp.length === 0; i += 1) {
        temp = filesUnder(join(killDir, bucket)).filter((p) => /rclone_temp_put_/u.test(p));
        if (temp.length === 0) await new Promise((resolve) => { setTimeout(resolve, 100); });
      }
      killed.kill('SIGKILL');
      await hanging;
      await new Promise((resolve) => { setTimeout(resolve, 500); });
      const left = filesUnder(join(killDir, bucket)).filter((p) => /rclone_temp_put_/u.test(p));
      console.log(`P07 kill: hidden temporary files left on disk after the kill: ${left.length}`);
      const restarted = spawn(rcloneBin, ['serve', 's3', '--addr', `127.0.0.1:${port}`, '--auth-key',
        `${process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID},${process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY}`, killDir], { stdio: 'ignore' });
      try {
        for (let i = 0; i < 50; i += 1) {
          if (await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false)) break;
          await new Promise((resolve) => { setTimeout(resolve, 100); });
        }
        const listed = await client(`http://127.0.0.1:${port}`).send(new ListObjectsV2Command({ Bucket: bucket }));
        assert.equal((listed.Contents ?? []).some((o) => /rclone_temp/u.test(o.Key ?? '')), false, 'P07 ListObjects never shows the hidden file');
      } finally {
        restarted.kill('SIGKILL');
      }
      // The harness janitor: hidden temporary files are rclone's own, so the CI harness that runs rclone removes them.
      for (const path of left) rmSync(join(killDir, bucket, ...path.split('/')), { force: true });
      assert.deepEqual(filesUnder(join(killDir, bucket)), [], 'P07 after the janitor the directory scan is empty');
    } finally {
      killed.kill('SIGKILL');
      rmSync(killDir, { recursive: true, force: true });
    }

    stage = 'P08 refusals';
    const unsigned = await fetch(`${process.env.QANDEEL_MEDIA_S3_ENDPOINT}/${bucket}?list-type=2`).then((r) => r.status);
    assert.ok([400, 401, 403].includes(unsigned), `P08 an unsigned request is refused (${unsigned})`);
    const anonymous = await fetch(`${api}/introductions/worlds/${world}/media/${randomUUID()}`).then((r) => r.status);
    assert.equal(anonymous, 401, 'P08 the media route refuses a request without a token');

    stage = 'P09 on the wire: the human boundaries refuse anon and service_role; the storage boundaries refuse a human';
    const wire = async (token, name, body) => {
      const response = await fetch(`${postgrestUrl}/rpc/${name}`, { method: 'POST', body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    };
    const refused = (r, label) => assert.ok(([401, 403].includes(r.status) && r.body?.code === '42501') || (r.status === 404 && r.body?.code === 'PGRST202'),
      `${label} is not callable (${r.status} ${JSON.stringify(r.body)})`);
    for (const token of [jwt({ role: 'anon' }), jwt({ role: 'service_role' })]) {
      refused(await wire(token, 'begin_my_introduction_image_v1', { p_command_id: randomUUID(), p_world_id: world }), 'begin');
      refused(await wire(token, 'read_my_introduction_disclosures_v1', { p_world_id: world }), 'read');
      refused(await wire(token, 'authorize_my_introduction_media_v1', { p_world_id: world, p_handle: randomUUID() }), 'authorize');
    }
    for (const token of [tokens.a, jwt({ role: 'anon' })]) {
      refused(await wire(token, 'server_read_introduction_media_key_v1', { p_handle: randomUUID() }), 'the key lookup');
      refused(await wire(token, 'server_claim_introduction_media_erasures_v1', { p_limit: 1, p_lease_seconds: 30 }), 'the erasure lease');
    }
    refused(await wire(tokens.a, 'commit_introduction_progressive_disclosure_v1', {}), 'the frozen core');

    stage = 'the data directory holds nothing of this run';
    const leftover = stored().filter((k) => !before.includes(k));
    assert.deepEqual(leftover, [], 'every object this run wrote is gone - proven by the directory, not by a listing');
    console.log(`Verified S6-06 CP1 media path through live PostgREST ${version} and rclone serve s3, with the compiled API: production stores nothing; three cleaned objects under database keys; per-stage reads witnessed by the storage log; removal refused at once and erased by the worker; failing deletes deferred and retried; an in-flight upload outlived by its erasure; a post-erasure orphan reconciled; aborted and killed uploads cleaned and proven by directory scan.`);
  } catch (error) {
    failure = { stage, error };
  }
  stage = 'fixture removal';
  const removal = await (async () => {
    if (app) await app.close();
    if (gateway) { gateway.closeAllConnections(); await new Promise((resolve) => { gateway.close(() => resolve()); }); }
    await rt.asRole('postgres');
    for (const seam of seams.reverse()) await rt.restoreMatchingSeam(seam);
    await rows('BEGIN');
    try {
      await rows('ALTER TABLE introduction_sharing_private.name_display_events DISABLE TRIGGER name_display_events_immutable');
      const worlds = `(SELECT r.world_id FROM public.introduction_records r WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
      const seriesOf = `(SELECT s.id FROM introduction_sharing_private.image_series s WHERE s.world_id IN ${worlds})`;
      await rows(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
        (SELECT r.storage_key FROM introduction_sharing_private.image_renditions r WHERE r.series_id IN ${seriesOf})`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.name_display_state WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.name_display_events WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_stage_disclosures WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_renditions WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_series WHERE world_id IN ${worlds}`, [humans]);
      await rows('ALTER TABLE introduction_sharing_private.name_display_events ENABLE TRIGGER name_display_events_immutable');
      await rows('COMMIT');
    } catch (error) {
      await rows('ROLLBACK').catch(() => undefined);
      throw error;
    }
    await rt.cleanupIntroductionRace(humans);
    await rt.removeFixtureHumans(humans);
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure && removal) {
    stage = failure.stage;
    throw new AggregateError([failure.error, removal], `${failure.error?.message ?? failure.error}; the fixture removal ALSO failed: ${removal?.message ?? removal}`);
  }
  if (failure) { stage = failure.stage; throw failure.error; }
  if (removal) throw removal;
  void started;
}

try {
  await main();
} catch (error) {
  console.error(`S6-06 CP1 media proof (PostgREST ${version}) failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
