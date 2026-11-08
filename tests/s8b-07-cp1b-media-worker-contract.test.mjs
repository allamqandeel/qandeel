// S8B-07 CP1-B step 2 — the Replay pool's media worker, reaper and independent watchdog (INFRA-07, contract §0.2, §4 –
// §5, §9, §10, §17, §18; D-06). A static pin of what step 2 shipped, so a later change cannot quietly undo it:
//
//   placement  the worker and the watchdog start only under their own role with QANDEEL_REPLAY_PLACEMENT=REPLAY_POOL;
//              the API refuses every Replay role and every same-host placement before anything is built (V-28, V-33)
//   database   the Replay pool connects directly as qandeel_replay_media (pg pinned exactly), and checks the role's
//              approved limits at start-up; it never uses the service-role API channel
//   ffmpeg     the BtbN 9.0.2 LGPL asset at one autobuild tag, sha256-checked with --check --strict in CI; the process
//              refuses any other version line; every output bit-exact with one thread
//   store      the Replay pool reads voice-call/ and voice-note/ sources only and writes, HEADs and DELETEs
//              voice-transient/ only; the API's private audio store keeps its key rule unchanged
//   proof      prove-0196-media-worker.mjs wired twice in API CI: the in-memory store, and the S3 adapter against rclone
//
// Behaviour is proven by the API's jest specs (replay-media/*.spec.ts, including the V-33 import-graph walk) and by the
// integration proof; this contract only pins that they exist and are wired.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const RM = 'apps/api/src/replay-media';
const workflow = read('.github/workflows/api-ci.yml');
const pkg = JSON.parse(read('package.json'));
const api = JSON.parse(read('apps/api/package.json'));

test('the ffmpeg pin: one BtbN 9.0.2 LGPL asset at one tag, refused unless its sha256 matches (--check --strict)', () => {
  assert.match(workflow, /ffmpeg_tag=autobuild-2026-10-31-12-59\n/u);
  assert.match(workflow, /ffmpeg_asset=ffmpeg-n9\.0\.2-39-g7adfbe40dc-linux64-lgpl-9\.0\.tar\.xz\n/u);
  assert.match(workflow, /ffmpeg_sha256=6046d6731b26f58887e953561551d254a6eec9fbca4100dfeab56e19af8328d5\n/u);
  assert.match(workflow, /https:\/\/github\.com\/BtbN\/FFmpeg-Builds\/releases\/download\/\$ffmpeg_tag\/\$ffmpeg_asset/u);
  assert.match(workflow, /echo "\$ffmpeg_sha256  \$RUNNER_TEMP\/\$ffmpeg_asset" \| sha256sum --check --strict/u);
  assert.doesNotMatch(workflow, /apt-get install[^\n]*ffmpeg|setup-ffmpeg|ffmpeg-static/u, 'no unpinned ffmpeg from a package manager');
  const ff = read(`${RM}/replay-ffmpeg.ts`);
  assert.ok(ff.includes('export const REQUIRED_FFMPEG_LINE = /^ffmpeg version (?:n)?9\\.0\\.2[-\\s]/u;'), 'the process refuses any other version line');
  assert.ok(ff.includes("const BOUNDS = ['-threads', '1', '-filter_threads', '1'];"));
  assert.ok(ff.includes("const BITEXACT = ['-fflags', '+bitexact', '-flags', '+bitexact'];"));
});

test('the proof is wired twice in API CI: the in-memory store, then the S3 adapter against rclone', () => {
  assert.equal(pkg.scripts['prove:s8b-07-media-worker:integration'], 'node --env-file-if-exists=.env database/prove-0196-media-worker.mjs');
  assert.ok(existsSync(join(root, 'database/prove-0196-media-worker.mjs')));
  assert.match(workflow, /\n {8}run: npm run prove:s8b-07-media-worker:integration\n/u);
  assert.match(workflow, /REPLAY_PROOF_STORE=s3 npm run --silent prove:s8b-07-media-worker:integration/u);
  const install = workflow.indexOf('Install the pinned ffmpeg 9.0.2');
  assert.ok(install > workflow.indexOf('run: npm run verify:s8b-07-transient-media:integration'));
  assert.ok(install < workflow.indexOf('\n        run: npm run prove:s8b-07-media-worker:integration\n'), 'ffmpeg is installed before the proof runs');
});

test('the entry points: each refuses every role but its own, and the API refuses first', () => {
  assert.match(read('apps/api/src/main.ts'), /async function bootstrap\(\): Promise<void> \{\n(?: *\/\/[^\n]*\n)* {2}assertApiProcess\(process\.env\);\n/u);
  assert.match(read(`${RM}/media-worker.main.ts`), /async function bootstrap\(\): Promise<void> \{\n {2}assertReplayPoolProcess\('REPLAY_MEDIA', process\.env\);\n/u);
  assert.match(read(`${RM}/replay-watchdog.main.ts`), /assertReplayPoolProcess\('REPLAY_WATCHDOG', process\.env\);/u);
  const role = read(`${RM}/replay-compute-role.ts`);
  assert.ok(role.includes("export const REPLAY_PLACEMENTS = ['REPLAY_POOL', 'NONE'] as const;"), 'no DEDICATED, no SHARED');
  assert.equal(api.scripts['start:replay-media-worker'], 'node --max-old-space-size=384 dist/replay-media/media-worker.main.js');
  assert.equal(api.scripts['start:replay-watchdog'], 'node dist/replay-media/replay-watchdog.main.js');
});

test('the database: the Replay role directly, pg pinned exactly, the limits checked at start-up, no service-role channel', () => {
  assert.equal(api.dependencies.pg, '8.23.0');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages['node_modules/pg'].version, '8.23.0');
  assert.equal(lock.packages['apps/api'].dependencies.pg, '8.23.0');
  const db = read(`${RM}/replay-database.ts`);
  for (const pin of ["export const REPLAY_DATABASE_ROLE = 'qandeel_replay_media';", 'REPLAY_MEDIA_DATABASE_URL', 'rolconnlimit',
    'information_schema.role_table_grants', 'FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid',
    "role.session_user !== REPLAY_DATABASE_ROLE || role.current_user !== REPLAY_DATABASE_ROLE"]) assert.ok(db.includes(pin), pin);
  assert.doesNotMatch(db, /env\.DATABASE_URL\b|query\(\s*['"`]SET ROLE|set_config\('role'/u, 'no fallback to the API database URL and no role switching');
  const proof = read('database/prove-0196-media-worker.mjs');
  assert.ok(proof.includes("ALTER ROLE ${POOL} LOGIN PASSWORD"), 'the proof logs in as the Replay role itself');
  assert.ok(proof.includes("roleOption.searchParams.set('options', `-c role=${POOL}`)"), 'and proves a superuser login with a role option is refused');
  for (const file of ['media-worker.module.ts', 'replay-watchdog.module.ts', 'transient-media.repository.ts']) {
    assert.doesNotMatch(read(`${RM}/${file}`), /SupabaseServiceRoleApiService|SUPABASE_SERVICE_ROLE_KEY|redis/u, file);
  }
});

test('the store: sources read-only by key class, processing files only under voice-transient/, the API key rule unchanged', () => {
  const store = read(`${RM}/transient-audio.store.ts`);
  assert.ok(store.includes('const SOURCE_KEY = /^voice-(?:note|call)\\/[0-9a-f-]{36}$/u;'));
  assert.ok(store.includes('const TRANSIENT_KEY = /^voice-transient\\/[0-9a-f-]{36}$/u;'));
  assert.doesNotMatch(store, /PutObjectCommand\(\{[^}]*SOURCE|DeleteObjectCommand\(\{[^}]*SOURCE/u);
  const voice = read('apps/api/src/voice-media/private-audio-object.store.ts');
  assert.ok(voice.includes("const VOICE_KEY = /^voice-(?:note|call)\\/[0-9a-f-]{36}$/u;"), 'the API store still refuses voice-transient/');
});

test('the specs that prove the behaviour exist', () => {
  for (const spec of ['transient-mix-plan', 'replay-compute-role', 'replay-module-graph', 'media-worker.service', 'ogg-page-check']) {
    assert.ok(existsSync(join(root, `${RM}/${spec}.spec.ts`)), spec);
  }
});
