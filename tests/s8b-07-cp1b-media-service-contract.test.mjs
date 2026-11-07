// S8B-07 CP1-B step 3 — the Replay Media Service (INFRA-07 P-1, contract §6, §14.3, §15, §18.3, §19, §0.3 F-1). A static
// pin of what step 3 shipped, so a later change cannot quietly undo it:
//
//   placement  the service starts only under QANDEEL_COMPUTE_ROLE=REPLAY_MEDIA with QANDEEL_REPLAY_PLACEMENT=REPLAY_POOL,
//              as the Replay role, with the bearer check configured; the API declares none of its routes (V-28, V-33)
//   wire       the five routes behind the shipped SupabaseAuthGuard; no-store on every answer, a refusal too; the bounded
//              refusal words; no Content-Disposition (V-16)
//   stream     the serve_until timer, the 5 s re-check with its 2 s fail-closed budget, destroy never end, the 10 min
//              response lifetime cap that only lowers (§15, §19)
//   F-1        the Voice Media object route serves NOTE only; a call track is 404 (narrowed, not stopped)
//   proof      prove-0196-media-service.mjs wired twice in API CI: the in-memory store, and the S3 adapter against rclone
//
// Behaviour is proven by the API's jest specs (transient-*.spec.ts, replay-module-graph.spec.ts, voice-media.spec.ts) and
// by the integration proof on real PostgreSQL; this contract only pins that they exist and are wired.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8').replace(/\r\n/gu, '\n');
const RM = 'apps/api/src/replay-media';
const workflow = read('.github/workflows/api-ci.yml');
const pkg = JSON.parse(read('package.json'));
const api = JSON.parse(read('apps/api/package.json'));

test('the entry point: REPLAY_MEDIA on the Replay pool, the Replay role, the bearer check; never loaded by the API', () => {
  const main = read(`${RM}/replay-media-service.main.ts`);
  assert.match(main, /async function bootstrap\(\): Promise<void> \{\n {2}assertReplayPoolProcess\('REPLAY_MEDIA', process\.env\);\n/u);
  assert.ok(main.includes('await TransientPlaybackService.preflight(db, app.get<TransientAudioStore>(TRANSIENT_AUDIO_STORE), process.env)'));
  assert.ok(main.includes('configureHttpSecurity(app, proxy);'), 'the same HTTP boundary as the API');
  const service = read(`${RM}/transient-playback.service.ts`);
  assert.ok(service.includes('await assertReplayDatabaseRole(db);'), 'the session is the Replay role itself');
  assert.ok(service.includes("throw new Error('the Replay pool bearer verification is not configured');"));
  assert.equal(api.scripts['start:replay-media-service'], 'node dist/replay-media/replay-media-service.main.js');
  assert.doesNotMatch(read('apps/api/src/app.module.ts'), /ReplayMediaServiceModule|TransientMediaController/u, 'the API never loads it');
});

test('the wire: five routes behind the shipped bearer guard, no-store on every answer, the bounded refusal words', () => {
  const controller = read(`${RM}/transient-media.controller.ts`);
  assert.match(controller, /@Controller\(\)\n@UseGuards\(SupabaseAuthGuard\)\nexport class TransientMediaController/u);
  for (const route of ["@Post('voice/listening/:callId/:commandId')", "@Post('replay/:replayId/versions/:versionId/playback/:commandId')",
    "@Get('voice/transient/:artifactId/status')", "@Get('voice/transient/:artifactId')", "@Delete('voice/transient/:artifactId')"]) {
    assert.ok(controller.includes(route), route);
  }
  for (const file of [controller, read(`${RM}/transient-stream.ts`)]) {
    assert.doesNotMatch(file, /(?:setHeader|@Header)\(\s*'Content-Disposition'/iu, 'never a download (V-16)');
  }
  const module = read(`${RM}/replay-media-service.module.ts`);
  assert.ok(module.includes("response.setHeader('Cache-Control', 'no-store, private');"), 'no-store before the guard runs');
  assert.ok(module.includes(".forRoutes('{*splat}');"));
  const service = read(`${RM}/transient-playback.service.ts`);
  for (const word of ["{ outcome: 'NOT_FOUND', reason }", "{ outcome: 'BUSY' }", "{ outcome: 'COMMAND_REUSED' }", "{ outcome: 'LIVE_CALL_ACTIVE' }",
    "{ outcome: 'INVALID_REQUEST' }", "{ outcome: 'RANGE_NOT_SATISFIABLE' }"]) assert.ok(service.includes(word), word);
  // The key is handed to the store only; no answer interface names it (the integration proof scans every answer, S08).
  assert.equal((service.match(/row\.storage_key/gu) ?? []).length, 1, 'the key is used once: the store open');
  assert.doesNotMatch(service, /storageKey|storage_key:/u, 'no answer carries a key');
});

test('the stream: the known end, the 5 s re-check with a 2 s fail-closed budget, destroy never end, the 10 min cap', () => {
  const stream = read(`${RM}/transient-stream.ts`);
  assert.ok(stream.includes('export const DEFAULT_STREAM_TIMING: TransientStreamTiming = {'));
  for (const pin of ['lifetimeMs: 600_000', 'recheckEveryMs: 5_000', 'recheckTimeoutMs: 2_000',
    "boundedInteger(env, 'REPLAY_RESPONSE_LIFETIME_MS', DEFAULT_STREAM_TIMING.lifetimeMs, 1_000, 600_000)",
    "timers.push(setTimeout(() => terminate('SOURCE_END'), Math.max(0, opened.serveForMs)));",
    "timers.push(setTimeout(() => terminate('LIFETIME'), timing.lifetimeMs));",
    'opened.body.destroy();', 'response.destroy();']) assert.ok(stream.includes(pin), pin);
  assert.doesNotMatch(stream, /response\.end\(/u, 'a clean end is never used to stop a response');
  const service = read(`${RM}/transient-playback.service.ts`);
  assert.ok(service.includes('const serveForMs = row === null ? 0 : row.serve_until.getTime() - row.db_now.getTime();'), 'database time, no skew');
});

test('F-1 narrowed: the Voice Media object route serves NOTE only', () => {
  const voice = read('apps/api/src/voice-media/voice-media.service.ts');
  assert.ok(voice.includes("const READABLE_OBJECT_TRACKS: readonly string[] = ['NOTE'];"));
  assert.ok(voice.includes('!READABLE_OBJECT_TRACKS.includes(track)'));
  const prove = read('database/prove-0185-voice-media-lifecycle-postgrest.mjs');
  assert.ok(prove.includes("'V09 F-1: a call track is not served by the object route'"), 'the PostgREST proof is re-anchored');
});

test('the proof is wired twice in API CI: the in-memory store, then the S3 adapter against rclone', () => {
  assert.equal(pkg.scripts['prove:s8b-07-media-service:integration'], 'node --env-file-if-exists=.env database/prove-0196-media-service.mjs');
  assert.equal(pkg.scripts['test:s8b-07-cp1b-media-service-contract'], 'node --test tests/s8b-07-cp1b-media-service-contract.test.mjs');
  assert.ok(existsSync(join(root, 'database/prove-0196-media-service.mjs')));
  assert.match(workflow, /\n {8}run: npm run prove:s8b-07-media-service:integration\n/u);
  assert.match(workflow, /REPLAY_PROOF_STORE=s3 npm run --silent prove:s8b-07-media-service:integration/u);
  assert.ok(workflow.indexOf('Install the pinned ffmpeg 9.0.2') < workflow.indexOf('\n        run: npm run prove:s8b-07-media-service:integration\n'),
    'ffmpeg is installed before the proof (the shipped worker makes its files)');
  assert.ok(workflow.includes('run: npm run test:s8b-07-cp1b-media-service-contract'));
  const proof = read('database/prove-0196-media-service.mjs');
  assert.ok(proof.includes('ALTER ROLE ${POOL} LOGIN PASSWORD'), 'the proof logs in as the Replay role itself');
  assert.ok(proof.includes('const SLOW = 16 * 1024;'), 'V-32 with a client at ≤ 16 KiB/s');
  assert.ok(proof.includes('const COMMIT_BOUND_MS = 7_000;') && proof.includes('const KNOWN_END_BOUND_MS = 1_000;'), 'the A-2 bounds, unwidened');
});

test('the specs that prove the behaviour exist', () => {
  for (const spec of ['transient-stream', 'transient-playback.service', 'transient-presentation-map', 'replay-module-graph']) {
    assert.ok(existsSync(join(root, `${RM}/${spec}.spec.ts`)), spec);
  }
});
