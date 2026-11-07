// S8B-07 CP1-B step 4 — V-24a, First Audio isolation (INFRA-07, P-2; D-06.7 APPROVED as the binding criterion).
//
// NOT A PROOF OF POOL SEPARATION. One machine runs both sides and shares its CPUs, its memory and its PostgreSQL. This
// proves that the shared-resource bounds hold (the Replay role's connection limit and timeouts, its queue bounds, the
// store's separate clients and caps) while the Replay pool is saturated at its approved bounds. The isolation itself, on
// two separate compute pools against the hosted database and store, is V-24b: before any hosted Replay or any gate.
//
// The live side is the S8B-05 CP3 synthetic live-call harness, run unchanged in the measured modes M0 (analysis off) and
// M1_SHIPPED (the shipped analysis profile), with its seeded fake providers (no provider, no paid call). The Replay side is a
// separate OS process, prove-0196-first-audio-isolation-replay-load.mjs, the Replay pool's shipped parts as the Replay role.
//
//   sequence   B1 L1 B2 L2 B3 L3 (REPS, at least 3): baseline B with no Replay process at all, load L with the Replay pool
//              saturated from before the harness starts until after it ends; interleaved, in one session, one database
//   criterion  D-06.7: for M0 and for M1_SHIPPED, each against its own baseline, the median over the repetitions of the
//              load runs' First Audio p50 minus the baselines' median p50 is <= +25 ms, and the same for p95 <= +50 ms; the
//              absolute targets hold too (p50 <= 1.5 s, p95 <= 2.5 s, every sample < 3 s). Never widened.
//   reported   per run: First Audio p50 / p95 / max and the raw samples; the call path's database latency (its statements,
//              and the commit / Safety / begin / activate / end commands); the store upload latency of the call writer's
//              client against the store the Replay pool uses (S3 runs; there is no shared store locally); every 500 ms
//              the PostgreSQL sessions by role, lock waits, the Replay queue, the machine's CPU and memory; the load's
//              own counters (requests, BUSY, 429, mixes, Range requests, bytes streamed, releases, erasures, watchdog
//              runs); the natural listener's resume gaps and its 429s (the rate limit and the 10-minute cap under load)
//   placement  every Replay database session is the Replay role, named by the pool's application_name; no other session
//              ever runs a transient definer; after the Replay process is killed with work pending, nothing claims or
//              finishes that work: no fallback to the live side (V-33 proves the module graphs statically)
//
// Synthetic only: random UUID people, a 440 Hz tone, fake providers. Never a hosted database: the harness refuses anything
// but loopback. The Replay role is given LOGIN for this run only and returned to NOLOGIN in `finally`; every fixture is
// removed; the Replay gate is reset.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireApi = createRequire(join(ROOT, 'apps/api/package.json'));
const POOL = 'qandeel_replay_media';
const POOL_APPLICATION = 'qandeel-replay';
const STORE_MODE = process.env.REPLAY_PROOF_STORE === 's3' ? 's3' : 'memory';
/** At least 3 (mandatory). V24A_TRIAL=1 allows fewer, for iterating on the proof only: such a run is never a V-24a result. */
const TRIAL = process.env.V24A_TRIAL === '1';
const REPS = TRIAL ? Math.max(1, Number(process.env.V24A_REPS ?? 1)) : Math.max(3, Number(process.env.V24A_REPS ?? 3));
const MODES = ['M0', 'M1_SHIPPED'];
/** D-06.7, binding (2026-11-07): never widened here. */
const MARGIN = Object.freeze({ p50: 25, p95: 50 });
const ABSOLUTE = Object.freeze({ p50: 1_500, p95: 2_500, max: 3_000 });
const MINUTE = 60_000;
/** The load: 28 phones with a 10-minute call, 4 with a 60-minute call, 6 with a Replay of one 6-minute window (76 request loops for a queue of 32 pending), 1 natural listener. */
const LOAD = Object.freeze({ tenMinute: 28, hour: 4, replays: 6, replayMinutes: 6 });
const BIN = { ffmpeg: process.env.FFMPEG_BIN, ffprobe: process.env.FFPROBE_BIN };
assert.ok(BIN.ffmpeg && BIN.ffprobe, 'FFMPEG_BIN and FFPROBE_BIN name the pinned ffmpeg 9.0.2');
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
};
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const summary = (values) => ({ n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: values.length ? Math.round(Math.max(...values)) : null });

// ------------------------------------------------------------------ fixtures (committed; the Replay pool reads them on its own connections)
const humans = [];
async function committed(fn) {
  await owner();
  await q('BEGIN');
  try { const v = await fn(); await q('COMMIT'); return v; } catch (error) { await q('ROLLBACK'); throw error; }
}
/**
 * A person (or `owner`, a second subject of the same person), a session and a sealed call recording of `minutes` USER-track
 * segments (keys only; the bytes are put by the pool).
 */
async function sealedCall(minutes, owner = null) {
  return committed(async () => {
    const user = owner ?? randomUUID();
    if (owner === null) {
      await rt.provisionHumans([user]);
      humans.push(user);
    }
    const session = randomUUID();
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
    const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
    await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
               seat_lease_until = NULL WHERE id = $1`, [call]);
    const recording = randomUUID();
    await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                   recording_state, sealed_by)
             VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
    [recording, user, session, call, t]);
    const keys = [];
    for (let m = 0; m < minutes; m += 1) {
      const key = `voice-call/${randomUUID()}`;
      keys.push(key);
      await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                 byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
               VALUES ($1, 'USER', $2, $3, 'STORED', 'audio/ogg', $4, $5, $6, clock_timestamp(), clock_timestamp())`,
      [recording, m, key, SEGMENT_BYTES, m * MINUTE, (m + 1) * MINUTE]);
    }
    return { user, session, call, recording, keys, minutes };
  });
}
/** A Replay of one USER voice turn over the whole call (the step 3 proof's shape), previewed: its playback set is one run. */
async function replayOf(minutes, owner = null) {
  const c = await sealedCall(minutes, owner);
  return committed(async () => {
    const { user, session } = c;
    let sp = Number((await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp',
      [session]))[0].sp);
    for (const [t, turn] of [{ role: 'USER', voice: true }, { role: 'ASSISTANT' }, { role: 'USER' }].entries()) {
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
                 VALUES ($1, $2, $3, 'USER', 'LIVE_CALL_SPEECH', 'MACHINE_ASR', 'HIGH', $4, 0, $5, NULL, NULL)`,
        [id, user, session, c.recording, minutes * MINUTE]);
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
    return { ...c, replay: created.replay_id, version: previewed.replay_version_id };
  });
}
/** The size of the pool's one-minute source segment (it makes the bytes; the row must carry their exact length). */
let SEGMENT_BYTES = 0;
function segmentBytes() {
  const { OpusPacketEncoder, UPLINK_OPUS } = requireApi(join(ROOT, 'apps/api/dist/voice/call/codec/opus-codec.js'));
  const { muxOggOpus } = requireApi(join(ROOT, 'apps/api/dist/voice/call/codec/ogg-opus.js'));
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
  return muxOggOpus(packets, { serial: 1, inputRate: rate }).length;
}

/** Every transient row of the load's people, and their store objects, removed between runs (a new run starts empty). */
async function resetTransient(storeRemove) {
  await owner();
  const keys = (await rows('SELECT storage_key FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])', [humans]))
    .map((r) => r.storage_key);
  if (storeRemove) for (const key of keys) await storeRemove(key);
  await q('BEGIN');
  return q("SET LOCAL session_replication_role = 'replica'")
    .then(() => q(`DELETE FROM voice_private.transient_media_erasures WHERE storage_key IN
                     (SELECT storage_key FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[]))`, [humans]))
    .then(() => q('DELETE FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])', [humans]))
    .then(() => q('DELETE FROM voice_private.transient_media_requests WHERE user_id = ANY($1::uuid[])', [humans]))
    .then(() => q('DELETE FROM voice_private.replay_pool_heartbeats'))
    .then(() => q('COMMIT'), async (error) => { await q('ROLLBACK'); throw error; });
}
async function removeFixtures(storeRemove) {
  await resetTransient(storeRemove);
  const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
  if (storeRemove) {
    for (const r of await rows(`SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans])) {
      await storeRemove(r.storage_key);
    }
  }
  await q('BEGIN');
  await q("SET LOCAL session_replication_role = 'replica'")
    .then(() => q(`DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key IN
                     (SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordings}))`, [humans]))
    .then(() => q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]))
    .then(() => q(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]))
    .then(() => q(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]))
    .then(() => q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]))
    .then(() => q('DELETE FROM voice_private.calls WHERE user_id = ANY($1::uuid[])', [humans]))
    .then(() => q('COMMIT'), async (error) => { await q('ROLLBACK'); throw error; });
  await rt.removeCommittedFixtures(humans);
  await rt.resetGate();
}

// ------------------------------------------------------------------ the call writer's store upload probe (S3 runs only)
function uploadProbe() {
  if (STORE_MODE !== 's3') return null;
  const { S3PrivateAudioObjectStore } = requireApi(join(ROOT, 'apps/api/dist/voice-media/private-audio-object.store.js'));
  // The call writer's own store class: its own client, nothing shared with the Replay pool's adapter (P-3).
  const store = new S3PrivateAudioObjectStore();
  assert.ok(store.isConfigured(), 'the call writer\'s store is configured for the probe');
  const segment = randomBytes(40_960); // a 10-second call segment's size at 32 kbit/s
  const samples = [];
  let on = true;
  const loop = (async () => {
    while (on) {
      const key = `voice-call/${randomUUID()}`;
      const at = performance.now();
      const ok = await store.putStream(key, 'audio/ogg', Readable.from([segment]), segment.length, AbortSignal.timeout(10_000))
        .then(() => true, () => false);
      samples.push(ok ? performance.now() - at : Number.POSITIVE_INFINITY);
      await store.remove(key, AbortSignal.timeout(10_000)).catch(() => undefined);
      await sleep(500);
    }
  })();
  return { samples, stop: async () => { on = false; await loop; } };
}

// ------------------------------------------------------------------ the monitor (every 500 ms; content-free)
function startMonitor() {
  const samples = [];
  const lockWaits = {};
  let on = true;
  let last = os.cpus().map((c) => c.times);
  const loop = (async () => {
    while (on) {
      const now = os.cpus().map((c) => c.times);
      let busy = 0;
      let total = 0;
      now.forEach((t, i) => {
        const p = last[i];
        const d = (k) => t[k] - p[k];
        const all = d('user') + d('nice') + d('sys') + d('idle') + d('irq');
        busy += all - d('idle');
        total += all;
      });
      last = now;
      const [db] = await rows(`SELECT
          count(*) FILTER (WHERE usename = $1)::int AS replay_sessions,
          count(*) FILTER (WHERE usename = $1 AND state = 'active')::int AS replay_active,
          -- A session still starting (state NULL) has no application name yet (seen in L3 of the first local run, and
          -- reproduced alone: 1 in 300 connects); it is counted apart, and named or not once it has started.
          count(*) FILTER (WHERE usename = $1 AND state IS NULL)::int AS replay_starting,
          count(*) FILTER (WHERE usename = $1 AND state IS NOT NULL AND application_name <> $2)::int AS replay_unnamed,
          count(*) FILTER (WHERE usename <> $1 AND application_name = $2)::int AS foreign_named,
          count(*) FILTER (WHERE usename <> $1 AND backend_type = 'client backend')::int AS other_sessions,
          count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS lock_waits,
          count(*) FILTER (WHERE wait_event_type = 'Lock' AND usename <> $1)::int AS live_lock_waits,
          -- A call of one of the pool's definers by anyone else. Not a table name: the harness's own teardown deletes its
          -- people's rows from every table with a user_id, the transient tables included (seen in L3 of the second run).
          count(*) FILTER (WHERE usename <> $1 AND pid <> pg_backend_pid() AND state = 'active'
                             AND query ~ 'server_[a-z_]*transient_media[a-z_]*_v[0-9]+ *[(]')::int AS foreign_transient
        FROM pg_stat_activity WHERE datname = current_database()`, [POOL, POOL_APPLICATION]);
      // A live session waiting on a lock: which command, on what, and whose session blocks it (names and roles only).
      if (db.live_lock_waits > 0) {
        for (const w of await rows(`SELECT coalesce(substring(a.query from '(server_[a-z0-9_]+|[a-z_]+_v[0-9]+)'), 'other') AS fn, a.wait_event,
              coalesce((SELECT string_agg(DISTINCT CASE WHEN b.usename = $1 THEN 'replay' ELSE 'live' END, '+') FROM pg_stat_activity b
                        WHERE b.pid = ANY(pg_blocking_pids(a.pid))), 'none') AS blockers
            FROM pg_stat_activity a WHERE a.datname = current_database() AND a.wait_event_type = 'Lock' AND a.usename <> $1`, [POOL])) {
          const key = `${w.fn} on ${w.wait_event} blocked by ${w.blockers}`;
          lockWaits[key] = (lockWaits[key] ?? 0) + 1;
        }
      }
      // The queue as D-06.4 bounds it: pending SETS (a Replay set of n runs is one), and the jobs running.
      const [queue] = await rows(`SELECT count(DISTINCT set_id) FILTER (WHERE job_state = 'PENDING')::int AS pending,
          count(*) FILTER (WHERE job_state = 'RUNNING')::int AS running FROM voice_private.transient_media_artifacts`);
      samples.push({ cpu: total ? Math.round((busy / total) * 1000) / 10 : 0, memUsedMiB: Math.round((os.totalmem() - os.freemem()) / 1048576), ...db, ...queue });
      await sleep(500);
    }
  })();
  return { samples, lockWaits, stop: async () => { on = false; await loop; } };
}
const maxOf = (samples, key) => Math.max(0, ...samples.map((s) => s[key]));
const meanOf = (samples, key) => (samples.length ? Math.round((samples.reduce((n, s) => n + s[key], 0) / samples.length) * 10) / 10 : 0);

// ------------------------------------------------------------------ the two sides
function harness(reportPath, logPath) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(ROOT, 'node_modules/ts-node/dist/bin.js'), '--transpile-only', '--project',
      join(ROOT, 'apps/api/tsconfig.scripts.json'), join(ROOT, 'apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts')], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, S8B05_CP3_PROFILES: 'SHIPPED', S8B05_CP3_M2: '0', S8B05_CP3_MODES: MODES.join(','), S8B05_CP3_REPORT: reportPath },
    });
    let text = '';
    child.stdout.on('data', (c) => { text += c; });
    child.stderr.on('data', (c) => { text += c; });
    child.on('close', (code) => { writeFileSync(logPath, text); done({ code, text, pid: child.pid }); });
  });
}
function replayPool(env, fixturesPath) {
  const child = spawn(process.execPath, [join(ROOT, 'database/prove-0196-first-audio-isolation-replay-load.mjs')], {
    cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...env, V24A_LOAD_FIXTURES: fixturesPath },
  });
  const state = { last: null, final: null, failed: null, text: '', ready: null };
  let buffered = '';
  const onLine = (line) => {
    if (line.startsWith('V24A_LOAD_READY')) state.ready = JSON.parse(line.slice(16));
    else if (line.startsWith('V24A_LOAD_FINAL ')) state.final = JSON.parse(line.slice(16));
    else if (line.startsWith('V24A_LOAD_FAILED ')) state.failed = JSON.parse(line.slice(17));
    else if (line.startsWith('V24A_LOAD ')) state.last = JSON.parse(line.slice(10));
    else state.text += `${line}\n`;
  };
  child.stdout.on('data', (c) => {
    buffered += c;
    let i;
    while ((i = buffered.indexOf('\n')) >= 0) { onLine(buffered.slice(0, i).trim()); buffered = buffered.slice(i + 1); }
  });
  child.stderr.on('data', (c) => { state.text += c; });
  const closed = new Promise((done) => child.on('close', (code) => done(code)));
  return {
    child, state, closed,
    async ready() {
      for (let i = 0; i < 1200 && !state.ready && !state.failed && child.exitCode === null; i += 1) await sleep(100);
      assert.ok(state.ready, `the Replay pool started and its load is flowing (${JSON.stringify(state.failed)} ${state.text.slice(-400)})`);
    },
    async stop() {
      child.stdin.end('stop\n');
      const code = await closed;
      assert.equal(code, 0, `the Replay pool stopped cleanly (${JSON.stringify(state.failed)} ${state.text.slice(-400)})`);
      return state.final;
    },
  };
}

// ------------------------------------------------------------------ the run
let loginGranted = false;
runVerifier('prove-0196-first-audio-isolation', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('prove-0196-v24a', { query: q, restore: () => owner() });
  const work = mkdtempSync(join(os.tmpdir(), 'qandeel-v24a-'));
  let storeRemove = null;
  if (STORE_MODE === 's3') {
    const { S3Client, DeleteObjectCommand } = requireApi('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: process.env.QANDEEL_MEDIA_S3_ENDPOINT, region: process.env.QANDEEL_MEDIA_S3_REGION, forcePathStyle: true,
      credentials: { accessKeyId: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY },
    });
    storeRemove = (Key) => client.send(new DeleteObjectCommand({ Bucket: process.env.QANDEEL_MEDIA_S3_BUCKET, Key })).catch(() => undefined);
  }
  const runs = [];
  const machine = { platform: process.platform, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, memGiB: Math.round(os.totalmem() / 1073741824) };
  try {
    setStage('login');
    const password = randomBytes(18).toString('hex');
    await owner();
    await q(`ALTER ROLE ${POOL} LOGIN PASSWORD '${password}'`);
    loginGranted = true;
    const url = new URL(process.env.DATABASE_URL);
    url.username = POOL;
    url.password = password;

    setStage('fixtures');
    SEGMENT_BYTES = segmentBytes();
    const listeners = [];
    // Each phone's two loops have their own subject (found by V-24a): two loops on one subject share its live set (0196 (b)),
    // and one loop's release ended the other's read with 404; no phone plays one recording in two players.
    const twinned = async (make) => { const first = await make(null); return { ...first, twin: await make(first.user) }; };
    for (let i = 0; i < LOAD.tenMinute; i += 1) listeners.push(await twinned((u) => sealedCall(10, u)));
    for (let i = 0; i < LOAD.hour; i += 1) listeners.push(await twinned((u) => sealedCall(60, u)));
    const replays = [];
    for (let i = 0; i < LOAD.replays; i += 1) replays.push(await twinned((u) => replayOf(LOAD.replayMinutes, u)));
    const natural = await sealedCall(60);
    const fixturesPath = join(work, 'fixtures.json');
    writeFileSync(fixturesPath, JSON.stringify({ listeners, replays, natural }), { mode: 0o600 });
    const poolEnv = {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, HOME: process.env.HOME,
      NODE_ENV: 'test', QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL',
      REPLAY_MEDIA_DATABASE_URL: url.toString(), FFMPEG_BIN: BIN.ffmpeg, FFPROBE_BIN: BIN.ffprobe, REPLAY_PROOF_STORE: STORE_MODE,
      ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('QANDEEL_MEDIA_S3_') || k === 'REPLAY_STORE_MAX_CONCURRENT')),
    };

    for (let rep = 1; rep <= REPS; rep += 1) {
      for (const kind of ['B', 'L']) {
        const label = `${kind}${rep}`;
        setStage(label);
        const pool = kind === 'L' ? replayPool(poolEnv, fixturesPath) : null;
        if (pool) await pool.ready();
        const monitor = startMonitor();
        const probe = uploadProbe();
        const startedAt = new Date();
        const reportPath = join(work, `${label}.json`);
        const result = await harness(reportPath, join(work, `${label}.log`));
        await monitor.stop();
        await probe?.stop();
        let load = null;
        let fallback = null;
        if (pool && rep === REPS) {
          // The last load run ends with the pool killed abruptly while work is pending: nothing else may take it.
          fallback = await noFallback(pool);
        } else if (pool) {
          load = await pool.stop();
        }
        if (pool && rep === REPS) load = pool.state.last;
        const [jobs] = await rows(`SELECT count(*) FILTER (WHERE ready_at >= $2)::int AS made,
            coalesce(sum(wall_ms) FILTER (WHERE ready_at >= $2), 0)::bigint AS wall_ms,
            coalesce(sum(cpu_ms) FILTER (WHERE ready_at >= $2), 0)::bigint AS cpu_ms,
            coalesce(sum(bytes_read) FILTER (WHERE ready_at >= $2), 0)::bigint AS bytes_read,
            coalesce(sum(byte_size) FILTER (WHERE ready_at >= $2), 0)::bigint AS bytes_written,
            coalesce(sum(store_ops) FILTER (WHERE ready_at >= $2), 0)::bigint AS store_ops,
            (SELECT count(*)::int FROM voice_private.transient_media_erasures e WHERE e.erased_at >= $2) AS erased
          FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])`, [humans, startedAt]);
        await resetTransient(storeRemove);
        assert.equal(result.code, 0, `${label}: the S8B-05 CP3 harness passed every check (${result.text.split('\n').filter((l) => /FAIL/u.test(l)).slice(0, 3).join(' | ')})`);
        const h = JSON.parse(readFileSync(reportPath, 'utf8'));
        const run = {
          label, kind, rep,
          modes: Object.fromEntries(MODES.map((m) => [m, {
            firstAudio: h.modes[m].firstAudioMs, callPathStatementMs: h.modes[m].callPathStatementMs, callPathRpcMs: h.modes[m].callPathRpcMs,
            samples: h.firstAudioSamplesMs[m],
          }])),
          monitor: {
            samples: monitor.samples.length, cpuMeanPct: meanOf(monitor.samples, 'cpu'), cpuMaxPct: maxOf(monitor.samples, 'cpu'),
            memUsedMaxMiB: maxOf(monitor.samples, 'memUsedMiB'), replaySessionsMax: maxOf(monitor.samples, 'replay_sessions'),
            replayActiveMax: maxOf(monitor.samples, 'replay_active'), otherSessionsMax: maxOf(monitor.samples, 'other_sessions'),
            lockWaitsMax: maxOf(monitor.samples, 'lock_waits'), liveLockWaitsMax: maxOf(monitor.samples, 'live_lock_waits'),
            pendingMax: maxOf(monitor.samples, 'pending'), runningMax: maxOf(monitor.samples, 'running'),
            runningAtBoundPct: monitor.samples.length ? Math.round((monitor.samples.filter((s) => s.running >= 4).length / monitor.samples.length) * 100) : 0,
            replayUnnamed: maxOf(monitor.samples, 'replay_unnamed'), replayStartingSeen: monitor.samples.filter((s) => s.replay_starting > 0).length,
            foreignNamed: maxOf(monitor.samples, 'foreign_named'),
            foreignTransient: maxOf(monitor.samples, 'foreign_transient'), liveLockWaitsSeen: monitor.lockWaits,
          },
          storeUploadMs: probe ? summary(probe.samples.filter(Number.isFinite)) : null,
          storeUploadFailures: probe ? probe.samples.filter((v) => !Number.isFinite(v)).length : null,
          jobs: { made: jobs.made, wallMs: Number(jobs.wall_ms), cpuMs: Number(jobs.cpu_ms), bytesRead: Number(jobs.bytes_read), bytesWritten: Number(jobs.bytes_written), storeOps: Number(jobs.store_ops), erased: jobs.erased },
          load, fallback,
        };
        runs.push(run);
        console.log(`prove-0196-v24a run ${label}: ${JSON.stringify({
          M0: run.modes.M0.firstAudio, M1_SHIPPED: run.modes.M1_SHIPPED.firstAudio, cpuMeanPct: run.monitor.cpuMeanPct,
          replaySessionsMax: run.monitor.replaySessionsMax, pendingMax: run.monitor.pendingMax, runningAtBoundPct: run.monitor.runningAtBoundPct,
          made: run.jobs.made, busy: load?.busy ?? null, rateLimited: load?.rateLimited ?? null, bytesStreamed: load?.bytesStreamed ?? null,
        })}`);
        await sleep(3_000);
      }
    }

    setStage('decide');
    const decision = {};
    for (const m of MODES) {
      const of = (kind, q) => runs.filter((r) => r.kind === kind).map((r) => r.modes[m].firstAudio[q]);
      const B = { p50: of('B', 'p50'), p95: of('B', 'p95'), max: of('B', 'max') };
      const L = { p50: of('L', 'p50'), p95: of('L', 'p95'), max: of('L', 'max') };
      const pooled = (kind) => summary(runs.filter((r) => r.kind === kind).flatMap((r) => r.modes[m].samples));
      decision[m] = {
        baseline: { p50: B.p50, p95: B.p95, medianP50: median(B.p50), medianP95: median(B.p95), pooled: pooled('B') },
        load: { p50: L.p50, p95: L.p95, medianP50: median(L.p50), medianP95: median(L.p95), pooled: pooled('L') },
        deltaP50: median(L.p50) - median(B.p50), deltaP95: median(L.p95) - median(B.p95),
        perRepDelta: L.p50.map((v, i) => ({ p50: v - B.p50[i], p95: L.p95[i] - B.p95[i] })),
        absolute: { worstP50: Math.max(...L.p50, ...B.p50), worstP95: Math.max(...L.p95, ...B.p95), worstMax: Math.max(...L.max, ...B.max) },
      };
      const d = decision[m];
      d.passP50 = d.deltaP50 <= MARGIN.p50;
      d.passP95 = d.deltaP95 <= MARGIN.p95;
      d.passAbsolute = d.absolute.worstP50 <= ABSOLUTE.p50 && d.absolute.worstP95 <= ABSOLUTE.p95 && d.absolute.worstMax < ABSOLUTE.max;
    }
    const loads = runs.filter((r) => r.kind === 'L');
    const loadTotals = (key) => loads.reduce((n, r) => n + (r.load?.[key] ?? 0), 0);

    await report.section('V24A-1 the Replay pool was saturated at its bounds in every load run (else the comparison proves nothing)', async () => {
      for (const r of loads) {
        assert.ok(r.load.busy > 0, `${r.label}: the queue's bound answered BUSY (${r.load.busy})`);
        assert.ok(r.monitor.pendingMax >= 24 && r.monitor.pendingMax <= 32,
          `${r.label}: the queue was kept full and never above its bound of 32 pending sets (max ${r.monitor.pendingMax})`);
        assert.ok(r.monitor.runningAtBoundPct >= 70, `${r.label}: both workers ran at their maximum concurrency of 2 most of the time (${r.monitor.runningAtBoundPct} %)`);
        assert.ok(r.monitor.replaySessionsMax >= 8, `${r.label}: the Replay role used its connections (max ${r.monitor.replaySessionsMax} of 10)`);
        assert.ok(r.jobs.made > 0 && r.load.rangeRequests > 0 && r.load.bytesStreamed > 0 && r.load.releases > 0, `${r.label}: mixes, Range reads and releases ran`);
        assert.ok(r.load.watchdogRuns > 0, `${r.label}: the watchdog ran`);
      }
      assert.ok(loads.reduce((n, r) => n + r.jobs.erased, 0) > 0, 'the reaper erased released files through the ledger');
      for (const r of runs.filter((x) => x.kind === 'B')) assert.equal(r.monitor.replaySessionsMax, 0, `${r.label}: no Replay session at all in a baseline`);
    });
    await report.section('V24A-2 placement: every Replay session is the Replay role under the pool\'s name; no other session ran Replay work; the role never exceeded 10; no live session waited on a Replay lock', async () => {
      for (const r of runs) {
        assert.equal(r.monitor.replayUnnamed, 0, `${r.label}: every Replay role session carried the pool's application name`);
        assert.equal(r.monitor.foreignNamed, 0, `${r.label}: no other role used the pool's application name`);
        assert.equal(r.monitor.foreignTransient, 0, `${r.label}: no session but the Replay role ran a transient definer`);
        const byReplay = Object.entries(r.monitor.liveLockWaitsSeen).filter(([k]) => /blocked by .*replay/u.test(k));
        assert.deepEqual(byReplay, [], `${r.label}: no live session ever waited on a lock the Replay role held`);
        assert.ok(r.monitor.replaySessionsMax <= 10, `${r.label}: the Replay role stayed within its connection limit (${r.monitor.replaySessionsMax})`);
      }
    });
    await report.section('V24A-3 no fallback: the Replay pool killed with work pending → the work stays pending, nothing else claims or finishes it', async () => {
      const f = loads.at(-1).fallback;
      assert.ok(f.pendingAtKill > 0, `work was pending when the pool died (${f.pendingAtKill})`);
      assert.equal(f.replaySessionsAfter, 0, 'the pool\'s sessions are gone');
      assert.equal(f.claimedAfter, 0, 'no job was claimed after the kill');
      assert.equal(f.madeAfter, 0, 'no file was finished after the kill');
    });
    await report.section('V24A-4 the rate limit and the 10-minute cap under load: the natural listener\'s resumes are never refused, its gaps measured', async () => {
      for (const r of loads) {
        const n = r.load.natural;
        assert.equal(n.rateLimited, 0, `${r.label}: no 429 on a phone's own listening (${n.requests} requests)`);
        assert.equal(n.refusals, 0, `${r.label}: no refusal of the natural listener (${n.requests} requests)`);
        assert.ok(n.rangeResumes > 0, `${r.label}: the natural listener resumed with Range (${n.rangeResumes})`);
        // Every phone's read of a READY file, each Range part included: answered, never refused (BUSY is admission's word only).
        const refusedReads = Object.entries(r.load.byRoute.read).filter(([status]) => !['200', '206'].includes(status));
        assert.deepEqual(refusedReads, [], `${r.label}: no refused read (${JSON.stringify(r.load.byRoute.read)})`);
      }
    });
    await report.section('V24A-5 D-06.7 First Audio margin, M0: median Δp50 <= +25 ms, median Δp95 <= +50 ms, absolute targets', async () => {
      const d = decision.M0;
      assert.ok(d.passP50, `M0 Δp50 ${d.deltaP50} ms`);
      assert.ok(d.passP95, `M0 Δp95 ${d.deltaP95} ms`);
      assert.ok(d.passAbsolute, `M0 absolute ${JSON.stringify(d.absolute)}`);
    });
    await report.section('V24A-6 D-06.7 First Audio margin, M1_SHIPPED: median Δp50 <= +25 ms, median Δp95 <= +50 ms, absolute targets', async () => {
      const d = decision.M1_SHIPPED;
      assert.ok(d.passP50, `M1_SHIPPED Δp50 ${d.deltaP50} ms`);
      assert.ok(d.passP95, `M1_SHIPPED Δp95 ${d.deltaP95} ms`);
      assert.ok(d.passAbsolute, `M1_SHIPPED absolute ${JSON.stringify(d.absolute)}`);
    });

    const resumeGaps = loads.flatMap((r) => r.load.natural.resumeFirstByteMs ?? []);
    const out = {
      trial: TRIAL,
      notice: 'NOT a proof of pool separation: one machine, shared CPUs, memory and PostgreSQL. V-24b (two separate pools, hosted) is required before any hosted Replay or any gate.',
      machine, store: STORE_MODE, reps: REPS, sequence: runs.map((r) => r.label), margin: MARGIN, absolute: ABSOLUTE, load: LOAD,
      decision,
      callPath: Object.fromEntries(MODES.map((m) => [m, runs.map((r) => ({ run: r.label, statements: r.modes[m].callPathStatementMs, commands: r.modes[m].callPathRpcMs }))])),
      storeUpload: runs.map((r) => ({ run: r.label, ms: r.storeUploadMs, failures: r.storeUploadFailures })),
      resources: runs.map((r) => ({ run: r.label, ...r.monitor, jobs: r.jobs })),
      loadCounters: loads.map((r) => ({ run: r.label, ...r.load, natural: { ...r.load.natural, resumeFirstByteMs: summary(r.load.natural.resumeFirstByteMs ?? []) } })),
      naturalResumeFirstByteMs: summary(resumeGaps),
      totals: { requests: loadTotals('requests'), busy: loadTotals('busy'), rateLimited: loadTotals('rateLimited'), rangeRequests: loadTotals('rangeRequests'), bytesStreamed: loadTotals('bytesStreamed') },
      fallback: loads.at(-1).fallback,
      runs: runs.map((r) => ({ label: r.label, modes: r.modes })),
    };
    const text = JSON.stringify(out, null, 2);
    assert.doesNotMatch(text, UUID, 'the report names no id');
    if (process.env.V24A_REPORT) writeFileSync(process.env.V24A_REPORT, `${text}\n`);
    console.log('prove-0196-v24a NOTICE: not a proof of pool separation (one machine; V-24b is the isolation proof, before any hosted Replay or any gate)');
    for (const m of MODES) {
      const d = decision[m];
      console.log(`prove-0196-v24a ${m}: baseline p50 ${JSON.stringify(d.baseline.p50)} p95 ${JSON.stringify(d.baseline.p95)} | load p50 ${JSON.stringify(d.load.p50)} p95 ${JSON.stringify(d.load.p95)} | median Δp50 ${d.deltaP50} (<= ${MARGIN.p50}) Δp95 ${d.deltaP95} (<= ${MARGIN.p95}) | absolute ${JSON.stringify(d.absolute)}`);
    }
    console.log(`prove-0196-v24a natural listener resume first byte: ${JSON.stringify(out.naturalResumeFirstByteMs)}`);
    // The whole report but the raw samples, in the log (CI keeps no file): every number the record cites.
    console.log(`prove-0196-v24a report: ${JSON.stringify({ ...out, runs: undefined })}`);
    report.print();
    report.assertAllPassed();
  } finally {
    setStage('teardown');
    await removeFixtures(storeRemove);
    rmSync(work, { recursive: true, force: true });
    if (loginGranted) await q(`ALTER ROLE ${POOL} NOLOGIN PASSWORD NULL`);
  }
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

/** Kills the Replay pool abruptly with work pending, then watches 15 s: no claim, no finished file, no Replay session. */
async function noFallback(pool) {
  await owner();
  const shape = async () => new Map((await rows('SELECT id, job_state, lease_id FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])', [humans]))
    .map((r) => [r.id, `${r.job_state}:${r.lease_id}`]));
  pool.child.kill('SIGKILL');
  await pool.closed;
  const atKill = await shape();
  const pendingAtKill = [...atKill.values()].filter((v) => v.startsWith('PENDING')).length;
  await sleep(15_000);
  const after = await shape();
  const changed = [...after].filter(([id, v]) => atKill.get(id) !== v);
  const [{ n }] = await rows('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = $1', [POOL]);
  return {
    pendingAtKill, replaySessionsAfter: n, watchedMs: 15_000,
    claimedAfter: changed.filter(([, v]) => v.startsWith('RUNNING')).length,
    madeAfter: changed.filter(([, v]) => v.startsWith('READY')).length,
    changedAfter: changed.length,
  };
}
