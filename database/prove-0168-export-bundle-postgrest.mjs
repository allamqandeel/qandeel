// S6-07 (CP4) - live proof of Export My Data's bundle (QAN-BL-PRIV-04, Q7' / Q7'') THROUGH a real PostgREST server and a
// real S3 server, driven by the API's OWN compiled code (apps/api/dist, built earlier in the same CI job): the compiled
// PrivacyDataController / PrivacyDataService on a real HTTP port, the compiled sharing module for the photos, PostgREST for
// the database, `rclone serve s3` for the private store, and the storage server's own access log as the witness of what
// was read for whom.
//
//   X01  the package: requested on a password-proof token, prepared by the server pass (0130), downloaded; the existing
//        route's answer carries no photo key and its package deep-equals the bundle's package
//   X02  the reader's OWN photo: the manifest names exactly A's three renditions, joined to the package by the very start
//        instant it prints; the files are byte-for-byte the stored renditions; B's photo is never read for A (the log)
//   X03  B's bundle holds only B's photo; neither bundle carries a handle, key, World id or URL
//   X04  beyond the 32 MiB guard (A's three stored renditions replaced by 12 MiB objects, 36 MiB in all): the bundle carries
//        the leading two, and the third arrives by the file route under the token, byte for byte - every photo exported
//   X05  a store with no object for a live key: 503, nothing partial
//   X06  the photo removed between the manifest and a file: CHANGED (409); a fresh bundle exports nothing of it
//   X07  a reader with no ready export: the null shape; a request without a token is refused
//
// It needs DATABASE_URL, POSTGREST_URL, POSTGREST_JWT_SECRET, the CI-only QANDEEL_MEDIA_S3_* values, RCLONE_DATA_DIR and
// RCLONE_LOG_FILE (as prove-0162), and a built API. Every fixture is removed afterwards and the seams are restored.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import process from 'node:process';
import { I07D_SEAMS, PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
const logFile = process.env.RCLONE_LOG_FILE;
for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, POSTGREST_JWT_SECRET: secret, RCLONE_LOG_FILE: logFile,
  QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT, QANDEEL_MEDIA_S3_BUCKET: process.env.QANDEEL_MEDIA_S3_BUCKET })) {
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
const { S3IntroductionMediaStore } = require('../apps/api/dist/introductions-disclosure/introduction-media.store.js');
const { PrivacyDataController } = require('../apps/api/dist/account/privacy-data.controller.js');
const { PrivacyDataService, EXPORT_BUNDLE_INLINE_MAX_BYTES } = require('../apps/api/dist/account/privacy-data.service.js');
const { PrivacyDataRepository } = require('../apps/api/dist/account/privacy-data.repository.js');
const { SupabasePasswordGrantService } = require('../apps/api/dist/account/supabase-password-grant.service.js');
const { SupabaseAuthGuard } = require('../apps/api/dist/auth/supabase-auth.guard.js');
const { SupabaseAuthService } = require('../apps/api/dist/auth/supabase-auth.service.js');
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
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST, and `/auth/v1/user` answering a verified token. */
function startGateway() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === '/auth/v1/user') {
        const sub = verifiedSubject((request.headers.authorization ?? '').replace(/^Bearer\s+/iu, ''));
        if (!sub) { response.writeHead(401).end(); return; }
        response.writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ id: sub, email: 'reader@prove-0168.test', email_confirmed_at: '2026-10-01T00:00:00Z' }));
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
const logSize = () => (existsSync(logFile) ? statSync(logFile).size : 0);
function readsSince(offset) {
  const text = readFileSync(logFile).subarray(offset).toString('utf8');
  return [...text.matchAll(/GET OBJECT Bucket: \S+ Object: (intro-media\/[0-9a-f-]{36})/gu)].map((m) => m[1]);
}
async function photo(shade) {
  const pixels = Buffer.alloc(700 * 900 * 3);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = (i / 3 + shade) % 251; pixels[i + 1] = (i / 5) % 253; pixels[i + 2] = shade; }
  return sharp(pixels, { raw: { width: 700, height: 900, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}
async function wire(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, { method: 'POST', body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  await rt.client.connect();
  const [a, b, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const humans = [a, b, outsider];
  const seams = [];
  let app = null;
  let gateway = null;
  let failure = null;
  const touchedKeys = [];
  try {
    stage = 'gateway and the compiled modules';
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'prove-0168-gateway';
    process.env.SUPABASE_SECRET_KEY = 'prove-0168-gateway-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role' });
    // Exactly the Privacy & Data providers AccountModule composes, beside the sharing module it imports.
    class ProveExportModule {}
    Module({
      imports: [IntroductionsDisclosureModule],
      controllers: [PrivacyDataController],
      providers: [SupabaseAuthService, SupabaseAuthGuard, SupabaseDataApiService, SupabaseServiceRoleApiService,
        PrivacyDataRepository, SupabasePasswordGrantService, PrivacyDataService],
    })(ProveExportModule);
    app = await NestFactory.create(ProveExportModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const tokens = { a: jwt({ sub: a, role: 'authenticated' }), b: jwt({ sub: b, role: 'authenticated' }), outsider: jwt({ sub: outsider, role: 'authenticated' }) };
    const call = async (token, method, path, body, { type = 'application/json', headers = {} } = {}) => {
      const response = await fetch(`${api}${path}`, {
        method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': type } : {}), ...headers },
        body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(120_000),
      });
      const text = Buffer.from(await response.arrayBuffer()).toString('utf8');
      return { status: response.status, headers: response.headers, text, json: text ? JSON.parse(text) : null };
    };
    const store = new S3IntroductionMediaStore();
    assert.equal(store.isConfigured(), true, 'the S3 adapter is configured from the CI-only environment');

    stage = 'fixtures: a real Introduction with two real photos';
    await rt.provisionHumans(humans);
    for (const seam of [PFN.PREREQUISITES, ...I07D_SEAMS]) seams.push(await rt.captureMatchingSeam(seam));
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    await rt.recordFacts(a, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(b, { sex: 'MALE', firstName: 'Omar' });
    const f = await rt.bringToIntroduction(a, b);
    await rt.asRole('postgres');
    const world = f.world;
    const upA = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image/${randomUUID()}`, await photo(40), { type: 'image/jpeg' });
    const upB = await call(tokens.b, 'POST', `/introductions/worlds/${world}/image/${randomUUID()}`, await photo(200), { type: 'image/jpeg' });
    assert.deepEqual([upA.json?.outcome, upB.json?.outcome], ['READY', 'READY'], `both photos are READY (${upA.text} / ${upB.text})`);
    const shared = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-stages`, { commandId: randomUUID(), seriesId: upA.json.seriesId, stage: 1 });
    assert.equal(shared.json?.outcome, 'DISCLOSED', `A shares stage 1 (${shared.text})`);
    const keysOf = async (series) => (await rows('SELECT stage, storage_key FROM introduction_sharing_private.image_renditions WHERE series_id = $1 ORDER BY stage', [series]));
    const aKeys = await keysOf(upA.json.seriesId);
    const bKeys = await keysOf(upB.json.seriesId);
    touchedKeys.push(...aKeys.map((k) => k.storage_key), ...bKeys.map((k) => k.storage_key));

    stage = 'X01 the package: requested on a proof token, prepared by the server pass, the existing route unchanged';
    for (const [who, token] of [[a, tokens.a], [b, tokens.b]]) {
      const proof = jwt({ sub: who, role: 'authenticated', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] });
      const requested = await wire(proof, 'request_own_data_export_v1', { p_command_id: randomUUID() });
      assert.equal(requested.body?.[0]?.outcome, 'ACCEPTED', `X01 the export is requested (${JSON.stringify(requested.body)})`);
      void token;
    }
    const prepared = await wire(jwt({ role: 'service_role' }), 'server_prepare_data_exports_v1', { p_limit: 10 });
    assert.equal(prepared.status, 200, `X01 the server pass prepares (${JSON.stringify(prepared.body)})`);
    const old = await call(tokens.a, 'GET', '/account/privacy/export/download');
    const bundle = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle');
    assert.equal(old.status, 200);
    assert.equal(bundle.status, 200, `X01 the bundle answers (${bundle.text.slice(0, 200)})`);
    assert.equal(old.json.status, 'READY');
    assert.deepEqual(Object.keys(old.json).sort(), ['availableUntil', 'package', 'status'], 'X01 the existing route carries no photo key');
    assert.deepEqual(bundle.json.package, old.json.package, 'X01 the bundle\'s package IS the existing route\'s package');
    assert.equal(bundle.headers.get('cache-control'), 'no-store', 'X01 no cache keeps the bundle');
    assert.deepEqual(bundle.json.package.notYetIncluded, ['shared', 'public', 'replay']);

    stage = 'X02 A\'s own photo, joined by the start instant, byte for byte, and nothing of B read for A';
    const [intro] = bundle.json.package.matchingAndIntroductions.introductions;
    assert.equal(intro.yourPhotos[0].state, 'live');
    const manifest = bundle.json.photoManifest;
    assert.deepEqual(manifest.files.map((x) => [x.fileName, x.stage, x.shared]),
      [['qandeel-photo-01-stage-1.jpg', 1, true], ['qandeel-photo-01-stage-2.jpg', 2, false], ['qandeel-photo-01-stage-3.jpg', 3, false]]);
    for (const x of manifest.files) assert.equal(x.introductionStartedAt, intro.startedAt, 'X02 the manifest joins the package by the instant it prints');
    assert.deepEqual(manifest.notIncluded, []);
    assert.deepEqual(bundle.json.photoFiles.map((x) => x.fileName), manifest.files.map((x) => x.fileName), 'X02 all three fit the one answer');
    for (const [i, x] of bundle.json.photoFiles.entries()) {
      const storedBytes = await store.get(aKeys[i].storage_key, AbortSignal.timeout(15_000));
      assert.ok(Buffer.from(x.bytesBase64, 'base64').equals(storedBytes), `X02 ${x.fileName} is the stored rendition, byte for byte`);
      assert.equal(x.bytes, storedBytes.length);
    }
    const offset = logSize();
    await call(tokens.a, 'GET', '/account/privacy/export/download/bundle');
    const readForA = readsSince(offset);
    assert.ok(readForA.length >= 3, 'X02 the storage log witnesses the reads');
    assert.deepEqual(readForA.filter((k) => bKeys.some((bk) => bk.storage_key === k)), [], 'X02 nothing of B\'s photo is ever read for A');

    stage = 'X03 B\'s bundle: only B\'s photo; no identifier anywhere';
    const bundleB = await call(tokens.b, 'GET', '/account/privacy/export/download/bundle');
    assert.equal(bundleB.json.photoManifest.files.length, 3);
    for (const [i, x] of bundleB.json.photoFiles.entries()) {
      assert.ok(Buffer.from(x.bytesBase64, 'base64').equals(await store.get(bKeys[i].storage_key, AbortSignal.timeout(15_000))), `X03 B's ${x.fileName}`);
    }
    for (const answer of [bundle, bundleB]) {
      const text = JSON.stringify({ m: answer.json.photoManifest, f: answer.json.photoFiles.map((x) => x.fileName), t: answer.json.photoManifestToken });
      assert.doesNotMatch(text, UUID, 'X03 no handle or World id');
      assert.doesNotMatch(text, /intro-media\/|qmedia:|https?:/u, 'X03 no key or URL');
      assert.doesNotMatch(JSON.stringify(answer.json.package.matchingAndIntroductions), UUID, 'X03 the package section holds no identifier');
    }

    stage = 'X04 beyond the 32 MiB guard: every photo exported, the rest by the file route under the token';
    const big = (n) => Buffer.alloc(12 * 1024 * 1024, n);
    for (const [i, k] of aKeys.entries()) await store.put(k.storage_key, big(i + 1), AbortSignal.timeout(60_000));
    const large = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle');
    assert.equal(large.status, 200, `X04 the bundle answers (${large.text.slice(0, 120)})`);
    assert.equal(large.json.photoManifest.files.length, 3, 'X04 the manifest still names all three');
    assert.deepEqual(large.json.photoFiles.map((x) => x.fileName), ['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg'], 'X04 the leading two inline');
    assert.ok(large.json.photoFiles.reduce((n, x) => n + x.bytes, 0) <= EXPORT_BUNDLE_INLINE_MAX_BYTES, 'X04 within the one-answer guard');
    const third = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle/files/qandeel-photo-01-stage-3.jpg', undefined,
      { headers: { 'x-qandeel-export-manifest': large.json.photoManifestToken } });
    assert.equal(third.status, 200, `X04 the file route answers (${third.text.slice(0, 120)})`);
    assert.ok(Buffer.from(third.json.bytesBase64, 'base64').equals(big(3)), 'X04 the third file, 12 MiB, byte for byte');
    assert.equal(third.headers.get('cache-control'), 'no-store');
    const otherReader = await call(tokens.b, 'GET', '/account/privacy/export/download/bundle/files/qandeel-photo-01-stage-3.jpg', undefined,
      { headers: { 'x-qandeel-export-manifest': large.json.photoManifestToken } });
    assert.equal(otherReader.status, 409, 'X04 the other human cannot use A\'s token: their manifest is not A\'s');

    stage = 'X05 a store with no object for a live key: 503, nothing partial';
    await store.remove(aKeys[2].storage_key, AbortSignal.timeout(15_000));
    const missing = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle/files/qandeel-photo-01-stage-3.jpg', undefined,
      { headers: { 'x-qandeel-export-manifest': large.json.photoManifestToken } });
    assert.deepEqual([missing.status, missing.json], [503, { outcome: 'UNAVAILABLE' }], 'X05 503 UNAVAILABLE');

    stage = 'X06 the photo removed between the manifest and a file: CHANGED; a fresh bundle lists nothing removed';
    const removed = await call(tokens.a, 'POST', `/introductions/worlds/${world}/image-removal`, { commandId: randomUUID(), seriesId: upA.json.seriesId });
    assert.equal(removed.json?.outcome, 'REMOVED', `X06 removed (${removed.text})`);
    const stale = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle/files/qandeel-photo-01-stage-2.jpg', undefined,
      { headers: { 'x-qandeel-export-manifest': large.json.photoManifestToken } });
    assert.deepEqual([stale.status, stale.json?.outcome], [409, 'CHANGED'], 'X06 CHANGED');
    const after = await call(tokens.a, 'GET', '/account/privacy/export/download/bundle');
    assert.equal(after.status, 200);
    // Removal deletes every shared stage through the owner deletion and releases every rendition (0162): nothing of the
    // photo is the owner's to download any more, so nothing is exported - only the fact that it was removed.
    assert.deepEqual([after.json.photoManifest.files, after.json.photoManifest.notIncluded, after.json.photoFiles], [[], [], []], 'X06 nothing removed is exported');

    stage = 'X07 not ready, and no token';
    const none = await call(tokens.outsider, 'GET', '/account/privacy/export/download/bundle');
    // RE-ANCHORED by S8B-02 (CP2, B9): the voice manifest beside the photo manifest is null with it while nothing is READY.
    assert.deepEqual(none.json, { status: 'NONE', availableUntil: null, package: null, photoManifest: null, photoFiles: null, photoManifestToken: null, voiceManifest: null });
    assert.equal((await call(null, 'GET', '/account/privacy/export/download/bundle')).status, 401, 'X07 a request without a token is refused');
    console.log(`prove-0168 (${version}): X01-X07 passed`);
  } catch (error) {
    failure = { stage, error };
  }

  stage = 'fixture removal';
  const removal = await (async () => {
    if (app) await app.close();
    if (gateway) { gateway.closeAllConnections(); await new Promise((resolve) => { gateway.close(() => resolve()); }); }
    const store = new S3IntroductionMediaStore();
    for (const key of touchedKeys) await store.remove(key, AbortSignal.timeout(15_000)).catch(() => undefined);
    await rt.asRole('postgres');
    for (const seam of seams.reverse()) await rt.restoreMatchingSeam(seam);
    await rows('BEGIN');
    try {
      await rows('ALTER TABLE introduction_sharing_private.name_display_events DISABLE TRIGGER name_display_events_immutable');
      const worlds = `(SELECT r.world_id FROM public.introduction_records r WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
      const seriesOf = `(SELECT s.id FROM introduction_sharing_private.image_series s WHERE s.world_id IN ${worlds})`;
      await rows(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])`, [touchedKeys]);
      await rows(`DELETE FROM introduction_sharing_private.name_display_state WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.name_display_events WHERE world_id IN ${worlds}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_stage_disclosures WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_renditions WHERE series_id IN ${seriesOf}`, [humans]);
      await rows(`DELETE FROM introduction_sharing_private.image_series WHERE world_id IN ${worlds}`, [humans]);
      await rows('ALTER TABLE introduction_sharing_private.name_display_events ENABLE TRIGGER name_display_events_immutable');
      await rows('DELETE FROM personal_data_private.data_exports WHERE user_id = ANY($1::uuid[])', [humans]);
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
}

try {
  await main();
} catch (error) {
  console.error(`prove-0168 (${version}) failed at stage: ${stage}`);
  console.error(error);
  process.exitCode = 1;
}
