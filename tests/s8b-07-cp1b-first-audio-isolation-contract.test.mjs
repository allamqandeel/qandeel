// S8B-07 CP1-B step 4 — V-24a, First Audio isolation (INFRA-07 P-2, D-06.7 APPROVED as the binding criterion). A static pin
// of what the proof measures and decides, so a later change cannot quietly widen it, lighten it or drop it:
//
//   criterion  +25 ms p50 / +50 ms p95 against the same session's baseline, medians of >= 3 interleaved repetitions, for
//              M0 and M1_SHIPPED; the absolute targets 1.5 s / 2.5 s / 3 s; fewer repetitions only in a marked trial
//   live side  the S8B-05 CP3 harness run unchanged in its own modes; its only V-24a additions report, never steer
//   load       a separate Replay pool process, behind the shipped guard, as the Replay role with its whole connection
//              limit, both workers at the D-06.1 maximum, the queue kept above its bound, every path exercised
//   honesty    every report says it is not a proof of pool separation; saturation is asserted, or nothing is compared
//   0196       the admission lock V-24a showed was missing, and its verifier scenario
//   CI         wired once, in the rclone step: the S3 adapter and the call writer's client on the same store
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8').replace(/\r\n/gu, '\n');
const proof = read('database/prove-0196-first-audio-isolation.mjs');
const load = read('database/prove-0196-first-audio-isolation-replay-load.mjs');
const harness = read('apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts');
const workflow = read('.github/workflows/api-ci.yml');
const pkg = JSON.parse(read('package.json'));

test('D-06.7 as approved: +25 / +50 ms, medians of at least 3 interleaved repetitions, both modes, the absolute targets', () => {
  assert.ok(proof.includes('const MARGIN = Object.freeze({ p50: 25, p95: 50 });'));
  assert.ok(proof.includes('const ABSOLUTE = Object.freeze({ p50: 1_500, p95: 2_500, max: 3_000 });'));
  assert.ok(proof.includes("const MODES = ['M0', 'M1_SHIPPED'];"));
  assert.ok(proof.includes("const REPS = TRIAL ? Math.max(1, Number(process.env.V24A_REPS ?? 1)) : Math.max(3, Number(process.env.V24A_REPS ?? 3));"),
    'never fewer than 3 repetitions outside a marked trial');
  assert.ok(proof.includes("for (const kind of ['B', 'L'])"), 'baseline and load interleaved in every repetition');
  assert.ok(proof.includes('deltaP50: median(L.p50) - median(B.p50), deltaP95: median(L.p95) - median(B.p95),'), 'medians against medians');
  assert.ok(proof.includes('d.passP50 = d.deltaP50 <= MARGIN.p50;') && proof.includes('d.passP95 = d.deltaP95 <= MARGIN.p95;'));
  assert.doesNotMatch(workflow, /V24A_TRIAL/u, 'CI never runs a trial');
});

test('the live side is the S8B-05 CP3 harness, unchanged in what it measures; its V-24a additions only report', () => {
  assert.ok(proof.includes("S8B05_CP3_PROFILES: 'SHIPPED', S8B05_CP3_M2: '0', S8B05_CP3_MODES: MODES.join(',')"));
  assert.ok(harness.includes('if (MEASURE_ONLY.length > 0) {'), 'the measured modes are filtered, not changed');
  assert.ok(harness.includes("const MEASURE_ONLY = (process.env.S8B05_CP3_MODES ?? '').split(',')"));
  // The workload stays the one the record measured.
  for (const pin of ['shortCalls: 6,', 'shortTurns: 8,', 'longTurns: 20,', 'replyFirstTokenMs: [380, 160] as const,', 'ttsFirstAudioMs: 120,', 'providerSlots: 8,']) {
    assert.ok(harness.includes(pin), pin);
  }
  assert.ok(harness.includes('try { return await sql(text, values); } finally { callPathMs.push(now() - at); }'), 'the call path is only timed');
  assert.ok(harness.includes('samples[mode.key] = firstAudio[mode.key]!.map((v) => Math.round(v * 10) / 10);'), 'the raw samples are reported');
});

test('the load: a separate Replay pool process, the shipped guard, the Replay role\'s whole connection limit, every path at its bound', () => {
  assert.ok(load.includes("assertReplayPoolProcess('REPLAY_MEDIA', process.env);"), 'the shipped guard first');
  assert.ok(proof.includes("QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL',"));
  assert.ok(proof.includes('url.username = POOL;'), 'it connects as the Replay role itself');
  assert.ok(load.includes('const dbs = { a: new PgReplayDatabase(url, 3), b: new PgReplayDatabase(url, 2), w1: new PgReplayDatabase(url, 2),'));
  assert.ok(load.includes('w2: new PgReplayDatabase(url, 2), dog: new PgReplayDatabase(url, 1) };'), '3 + 2 + 2 + 2 + 1 = the limit of 10');
  assert.ok(load.includes('{ concurrency: 2, pollMs: 250, scratchRoot:'), 'both workers at the D-06.1 maximum');
  for (const pin of ['await MediaWorkerService.preflight(db, storeForPart(), BIN);', 'await ReplayWatchdogService.preflight(dbs.dog, storeForPart());',
    'await TransientPlaybackService.preflight(db, storeForPart(), process.env);', 'configureHttpSecurity(app, parseProxyConfiguration({',
    "await app.listen(0, '127.0.0.1');"]) assert.ok(load.includes(pin), pin);
  assert.ok(proof.includes('const LOAD = Object.freeze({ tenMinute: 28, hour: 4, replays: 6, replayMinutes: 6 });'), '76 request loops for 32 places');
  assert.ok(load.includes('phoneLoop(i % 2 ? B.port : A.port, p, p), phoneLoop(i % 2 ? A.port : B.port, p, p.twin)'), 'two loops per phone, each its own subject');
});

test('honesty: not a proof of pool separation, saturation asserted, placement and no fallback checked', () => {
  assert.ok(proof.includes("notice: 'NOT a proof of pool separation"));
  assert.ok(proof.includes('NOT A PROOF OF POOL SEPARATION.'));
  for (const section of ['V24A-1 the Replay pool was saturated at its bounds', 'V24A-2 placement:', 'V24A-3 no fallback:', 'V24A-4 the rate limit and the 10-minute cap under load',
    'V24A-5 D-06.7 First Audio margin, M0', 'V24A-6 D-06.7 First Audio margin, M1_SHIPPED']) assert.ok(proof.includes(section), section);
  assert.ok(proof.includes('r.monitor.pendingMax >= 24 && r.monitor.pendingMax <= 32'), 'the queue full and within its bound');
  assert.ok(proof.includes("pool.child.kill('SIGKILL');"), 'the pool dies abruptly with work pending');
  assert.ok(proof.includes("assert.deepEqual(refusedReads, [], "), 'no read of a READY file refused under load');
  assert.ok(proof.includes('assert.equal(n.refusals, 0, '), 'no refusal of the natural listener');
});

test('0196: the admission lock V-24a found missing, alone, with its verifier scenario', () => {
  const m = read('database/migrations/0196_s8b_07_transient_media_v1.sql');
  const lock = "PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.transient-admission.v1', 0));";
  assert.equal(m.split(lock).length - 1, 1);
  assert.ok(m.indexOf(lock) < m.indexOf("WHERE a.job_state = 'PENDING') >= v_policy.pending_sets_max THEN"), 'taken before the bound is counted');
  assert.ok(read('database/verify-migration-0196.mjs').includes("'V31u D-06.4 under concurrency:"));
});

test('wired once in API CI, in the rclone step: the S3 adapter and the call writer\'s client share the store', () => {
  assert.equal(pkg.scripts['prove:s8b-07-first-audio-isolation:integration'], 'node --env-file-if-exists=.env database/prove-0196-first-audio-isolation.mjs');
  assert.equal(pkg.scripts['test:s8b-07-cp1b-first-audio-isolation-contract'], 'node --test tests/s8b-07-cp1b-first-audio-isolation-contract.test.mjs');
  assert.equal(workflow.split('npm run --silent prove:s8b-07-first-audio-isolation:integration').length - 1, 1);
  assert.match(workflow, /REPLAY_PROOF_STORE=s3 npm run --silent prove:s8b-07-first-audio-isolation:integration/u);
  assert.ok(workflow.indexOf('prove:s8b-07-first-audio-isolation:integration') > workflow.indexOf('rclone_pid=$!'), 'after the S3 server starts');
  assert.ok(workflow.includes('run: npm run test:s8b-07-cp1b-first-audio-isolation-contract'));
  assert.ok(proof.includes("const { S3PrivateAudioObjectStore } = requireApi(join(ROOT, 'apps/api/dist/voice-media/private-audio-object.store.js'));"),
    'the upload probe is the call writer\'s own store class');
});
