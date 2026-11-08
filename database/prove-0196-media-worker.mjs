// S8B-07 CP1-B step 2 — the media worker, the reaper and the independent watchdog, proven with the COMPILED Replay pool
// code against a disposable PostgreSQL 17 (migration 0196 applied), the pinned ffmpeg 9.0.2 and a store: in memory, or
// the S3 adapter against rclone in CI (REPLAY_PROOF_STORE=s3 with the QANDEEL_MEDIA_S3_* loopback values).
//
// Real audio, synthetic only: every call segment is written by the shipped call writer (real libopus packets through
// muxOggOpus), every Voice Note is an AAC file made by the pinned ffmpeg, and every tone is a pure frequency. The output
// is decoded back and measured with a Hann-windowed Goertzel bank, so "absent" and "present" are measured amplitudes.
//
//   W01  V-28 / V-33 / V-36 (1)  start-up: each compiled entry point refuses the wrong role, NONE, DEDICATED, SHARED; the
//        worker refuses a session that is not the Replay role and an ffmpeg that is not the pin; with the Replay role
//        the worker starts and beats, the watchdog runs once and exits 0
//   W02  V-09 / V-07  listening: two tracks on one clock, the barge-in overlap as it happened, a MUTED gap silent at its
//        true length, the length = the clock end, AAC-LC mono 24 kHz faststart; P-5 resource facts; V-02 keys read
//   W03  V-10  a segment container whose timestamps do not start at 0 → the same PCM as the one that does
//   W04  V-02 / V-03 / V-04 / V-05 / V-07 / V-25  a three-run Replay (note, call with gaps and a long HELD, a second call):
//        markers outside the windows absent, an unselected QANDEEL reply absent, MIX exactly the intersection, every gap
//        kind silent, the HELD shortened to 1.5 s, nothing outside the plan read
//   W05  V-06  a 30-minute HELD → the run file is the windows + 1.5 s
//   W06  V-11  fail closed: a corrupt page, a missing object, a length off by > 20 ms, the time cap, the scratch cap →
//        FAILED with the class, scratch empty, nothing readable, the key due and erased
//   W07  V-13  the owner deletes the source while the job mixes → FAILED SOURCE_UNAVAILABLE, the uploaded file erased
//   W08  V-15  a claim whose holder died (its lease lapsed) is claimed again and completes; a third lapse fails TIME_CAP;
//        the scratch root is emptied at boot
//   W09  V-27  the erasure timetable: release, the source's end, the cap; the outage (erasure_late_at once,
//        TRANSIENT_ERASURE_LATE every cycle, reads refused, the watchdog's backstop erases once the store is back)
//   W10  V-27 (h) (8)  generation 2's PCM equals generation 1's, bit for bit; a forced mismatch → GENERATION_MISMATCH
//   W11  V-33 runtime  with no worker, a request's rows stay PENDING (no job runs anywhere else)
//   W12  V-36 (2) – (4)  with every pool instance stopped the watchdog expires, marks late, erases, and reports the pool
//        heartbeat absent; a stopped watchdog's own heartbeat goes stale; every metric label is content-free
//   P01  P-5 / D-06  a 60-minute listening file: wall time against the D-06.5 cap, CPU, bytes, store operations, RSS
//
// Fixtures are COMMITTED (the worker runs on its own connections as the Replay role) and removed at the end; the Replay
// role is given LOGIN for this run only and returned to NOLOGIN in `finally`. Never a hosted database: 0196 and this proof
// run only on a disposable PostgreSQL. No gate is left open; no provider is called; nothing here prints a key or an id.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/api/dist');
const requireApi = createRequire(join(ROOT, 'apps/api/package.json'));
const load = (path) => requireApi(join(DIST, path));
const { MediaWorkerService, jobWallCapMs } = load('replay-media/media-worker.service.js');
const { ReplayWatchdogService } = load('replay-media/replay-watchdog.service.js');
const { TransientMediaRepository } = load('replay-media/transient-media.repository.js');
const { PgReplayDatabase } = load('replay-media/replay-database.js');
const { S3TransientAudioStore, SourceTooLargeError } = load('replay-media/transient-audio.store.js');
const { assertPinnedFfmpeg, moovBeforeMdat } = load('replay-media/replay-ffmpeg.js');
const { OpusPacketEncoder, UPLINK_OPUS, DOWNLINK_OPUS } = load('voice/call/codec/opus-codec.js');
const { muxOggOpus, oggCrc32 } = load('voice/call/codec/ogg-opus.js');

const POOL = 'qandeel_replay_media';
const L_MS = 300_000;
const STORE_MODE = process.env.REPLAY_PROOF_STORE === 's3' ? 's3' : 'memory';
const BIN = { ffmpeg: process.env.FFMPEG_BIN, ffprobe: process.env.FFPROBE_BIN };
assert.ok(BIN.ffmpeg && BIN.ffprobe, 'FFMPEG_BIN and FFPROBE_BIN name the pinned ffmpeg 9.0.2');
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

// ------------------------------------------------------------------ measurement
/** Tone frequencies: USER, QANDEEL, NOTE, the USER-track marker, the QANDEEL-track marker, a control bin. */
const HZ = Object.freeze({ U: 440, Q: 620, N: 770, MU: 1000, MQ: 1730, CONTROL: 2900 });
const AMP = 0.25;
/**
 * The measurement's own thresholds (not acceptance thresholds of the contract): a tone is PRESENT at ≥ 0.08 of full scale
 * (it is written at 0.25; the note at 0.125 with ≥ 0.04), and ABSENT at ≤ 0.004 (−36 dB below the tone). A window that
 * straddles a piece edge is not used for an absence: a hard cut splatters energy for a few ms, and the call writer's own
 * codec delay (Opus pre-skip 0, 6.5 ms) is inside ±1 frame. Edges are measured separately, as onsets (±1 AAC frame).
 */
const PRESENT = 0.08;
const PRESENT_NOTE = 0.04;
const ABSENT = 0.004;
const EDGE_MS = 40;
const AAC_FRAME_MS = 43;
const measured = { maxAbsent: 0, minPresent: Infinity, onsets: [] };

function amplitude(samples, fromMs, toMs, hz) {
  const a = Math.max(0, Math.round(fromMs * 24));
  const b = Math.min(samples.length, Math.round(toMs * 24));
  const n = b - a;
  if (n < 240) return 0;
  let re = 0;
  let im = 0;
  let weight = 0;
  for (let i = 0; i < n; i += 1) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const phase = (2 * Math.PI * hz * i) / 24_000;
    re += samples[a + i] * w * Math.cos(phase);
    im += samples[a + i] * w * Math.sin(phase);
    weight += w;
  }
  return (2 * Math.hypot(re, im)) / weight;
}
function present(samples, fromMs, toMs, hz, floor = PRESENT) {
  const v = amplitude(samples, fromMs + EDGE_MS, toMs - EDGE_MS, hz);
  measured.minPresent = Math.min(measured.minPresent, v);
  assert.ok(v >= floor, `${hz} Hz present in [${fromMs}, ${toMs}) ms (measured ${v.toFixed(4)})`);
}
/** Absent in every 100 ms window of [from, to), away from the listed piece edges. */
function absent(samples, fromMs, toMs, hz, edges = []) {
  for (let t = fromMs; t + 100 <= toMs; t += 50) {
    if (edges.some((e) => e > t - EDGE_MS && e < t + 100 + EDGE_MS)) continue;
    const v = amplitude(samples, t, t + 100, hz);
    measured.maxAbsent = Math.max(measured.maxAbsent, v);
    assert.ok(v <= ABSENT, `${hz} Hz absent at [${t}, ${t + 100}) ms (measured ${v.toFixed(5)})`);
  }
}
/** Every tone absent in [from, to): silence at its true length. */
function silent(samples, fromMs, toMs) {
  for (const hz of Object.values(HZ)) absent(samples, fromMs + EDGE_MS, toMs - EDGE_MS, hz);
}
/** The first 5 ms step at which `hz` reaches half its tone amplitude, searched in [from, to). */
function onsetMs(samples, fromMs, toMs, hz, level = AMP / 2) {
  for (let t = fromMs; t + 20 <= toMs; t += 1) if (amplitude(samples, t, t + 20, hz) >= level) return t + 10;
  return null;
}
function assertEdge(samples, expectedMs, hz, label) {
  const at = onsetMs(samples, expectedMs - 120, expectedMs + 120, hz);
  measured.onsets.push({ label, expectedMs, at });
  assert.ok(at !== null && Math.abs(at - expectedMs) <= AAC_FRAME_MS, `${label}: onset at ${at} ms, expected ${expectedMs} ± ${AAC_FRAME_MS}`);
}

function decodeFile(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'qandeel-proof-'));
  try {
    const path = join(dir, 'out.m4a');
    writeFileSync(path, bytes);
    const raw = execFileSync(BIN.ffmpeg, ['-nostdin', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1'],
      { maxBuffer: 1 << 30 });
    const out = new Float32Array(raw.length / 4);
    new Uint8Array(out.buffer).set(raw);
    const probe = JSON.parse(execFileSync(BIN.ffprobe, ['-v', 'error', '-show_entries',
      'stream=codec_name,profile,channels,sample_rate:format=duration', '-of', 'json', path]).toString('utf8'));
    return { samples: out, probe, faststart: moovBeforeMdat(path), dir };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
async function measure(bytes) {
  const d = decodeFile(bytes);
  try {
    const faststart = await d.faststart;
    const [s] = d.probe.streams;
    assert.deepEqual([s.codec_name, s.profile, s.channels, s.sample_rate, faststart], ['aac', 'LC', 1, '24000', true],
      'mono AAC-LC at 24 kHz with moov before mdat');
    return { samples: d.samples, durationMs: Math.round(Number(d.probe.format.duration) * 1000) };
  } finally {
    rmSync(d.dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ audio fixtures (the shipped writer; pure tones)
/** 20 ms frames of PCM s16le at `rate` for clock [a, b) ms; `tones` are [from, to, hz] on the same clock. */
function tonePcm(rate, a, b, tones, amp = AMP) {
  const per = (rate * 20) / 1000;
  const frames = [];
  for (let start = a; start < b; start += 20) {
    const pcm = Buffer.alloc(per * 2);
    for (let i = 0; i < per; i += 1) {
      const t = start + (i * 1000) / rate;
      let v = 0;
      for (const [from, to, hz] of tones) if (t >= from && t < to) v += amp * Math.sin((2 * Math.PI * hz * t) / 1000);
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
    }
    frames.push(pcm);
  }
  return frames;
}
/** One call segment exactly as the call writer writes it: real libopus packets, one Ogg stream, granules from 0. */
function callSegment(track, a, b, tones, serial) {
  assert.equal((b - a) % 20, 0, 'a segment is whole 20 ms frames');
  const { rate, bitrate } = track === 'USER' ? UPLINK_OPUS : DOWNLINK_OPUS;
  const encoder = new OpusPacketEncoder(rate, bitrate);
  try {
    return muxOggOpus(tonePcm(rate, a, b, tones).map((pcm) => encoder.encode(pcm)), { serial, inputRate: rate });
  } finally {
    encoder.close();
  }
}
/** A container whose timestamps do not start at 0: every data page's granule moved, every CRC re-sealed (V-10). */
function withGranuleOffset(file, offset) {
  const copy = Buffer.from(file);
  let at = 0;
  let page = 0;
  while (at < copy.length) {
    const count = copy.readUInt8(at + 26);
    const size = 27 + count + [...copy.subarray(at + 27, at + 27 + count)].reduce((x, y) => x + y, 0);
    if (page >= 2) copy.writeBigInt64LE(copy.readBigInt64LE(at + 6) + offset, at + 6);
    copy.writeUInt32LE(0, at + 22);
    copy.writeUInt32LE(oggCrc32(copy.subarray(at, at + size)), at + 22);
    at += size;
    page += 1;
  }
  return copy;
}
/** A Voice Note as the phone uploads one: AAC in MP4, made by the pinned ffmpeg (a pure tone). */
function noteFile(ms, hz) {
  const dir = mkdtempSync(join(tmpdir(), 'qandeel-note-'));
  try {
    const path = join(dir, 'note.m4a');
    execFileSync(BIN.ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${hz}:sample_rate=24000:duration=${ms / 1000}`,
      '-ac', '1', '-c:a', 'aac', '-b:a', '32k', '-movflags', '+faststart', '-f', 'mp4', '-y', path]);
    return readFileSync(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ the store (in memory, or S3 against rclone), instrumented
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
  };
}
/** The proof's view of the bucket: source uploads, reads of any key, and the worker's store wrapped in a log + faults. */
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
    // Teardown only: the proof's own source and processing objects leave the CI bucket, so a later proof that lists the
    // bucket (the S8B-02 reconciliation) never sees them.
    removeAny = async (key) => { await client.send(new DeleteObjectCommand({ Bucket, Key: key })).catch(() => undefined); };
  }
  const log = [];
  const faults = { erase: false, onRead: null };

  const store = {
    isConfigured: () => inner.isConfigured(),
    async readSource(key, maxBytes, meter, signal) {
      log.push(['read', key]);
      const body = await inner.readSource(key, maxBytes, meter, signal);
      if (faults.onRead) await faults.onRead(key);
      return body;
    },
    putTransient(key, body, byteSize, meter, signal) {
      log.push(['put', key]);
      return inner.putTransient(key, body, byteSize, meter, signal);
    },
    headTransient(key, meter, signal) {
      log.push(['head', key]);
      if (faults.erase) return Promise.reject(new Error('store outage'));
      return inner.headTransient(key, meter, signal);
    },
    removeTransient(key, meter, signal) {
      log.push(['remove', key]);
      if (faults.erase) return Promise.reject(new Error('store outage'));
      return inner.removeTransient(key, meter, signal);
    },
  };
  return { store, putSource, get, log, faults, removeAny };
}

// ------------------------------------------------------------------ telemetry (a recorder: labels only)
function recorderTelemetry() {
  const calls = [];
  return {
    calls,
    recordOperationalOutcome: (domain, operation, outcome, failureClass) => calls.push({ kind: 'outcome', domain, operation, outcome, failureClass }),
    recordReplayHealth: (metric, value) => calls.push({ kind: 'health', metric, value }),
  };
}

// ------------------------------------------------------------------ fixtures (committed)
const humans = [];
const instances = [];
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
    return id;
  });
}
async function newSession(user) {
  const id = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
/**
 * A sealed call recording of real segments. `tracks` maps USER / QANDEEL to pieces: ['S', a, b, tones, options] (a
 * segment the writer writes; options: { offset } re-stamps its container, { lie: ms } records a different clock end,
 * { corrupt } flips a byte of one page, { missing } stores nothing) or [GAP_KIND, a, b].
 */
async function realCall(ps, user, session, tracks) {
  const id = randomUUID();
  const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
  const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
  await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
             seat_lease_until = NULL WHERE id = $1`, [call]);
  await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                 recording_state, sealed_by)
           VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
  [id, user, session, call, t]);
  const keys = { USER: [], QANDEEL: [] };
  for (const [track, pieces] of Object.entries(tracks)) {
    let index = 0;
    for (const [kind, a, b, tones = [], options = {}] of pieces) {
      if (kind !== 'S') {
        await q(`INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind)
                 VALUES ($1, $2, $3, $4, $5)`, [id, track, a, b, kind]);
        continue;
      }
      let bytes = options.bytes ?? callSegment(track, a, options.audioEnd ?? b, tones, index + 1);
      if (options.offset) bytes = withGranuleOffset(bytes, options.offset);
      if (options.corrupt) {
        bytes = Buffer.from(bytes);
        bytes[Math.floor(bytes.length / 2)] ^= 0x40;
      }
      const key = `voice-call/${randomUUID()}`;
      if (!options.missing) await ps.putSource(key, bytes);
      await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                 byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
               VALUES ($1, $2, $3, $4, 'STORED', 'audio/ogg', $5, $6, $7, clock_timestamp(), clock_timestamp())`,
      [id, track, index, key, bytes.length, a, b]);
      keys[track].push(key);
      index += 1;
    }
  }
  return { recording: id, call, keys };
}
async function realNote(ps, user, session, ms, hz) {
  const id = randomUUID();
  const bytes = noteFile(ms, hz);
  const key = `voice-note/${randomUUID()}`;
  await ps.putSource(key, bytes);
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', $3, clock_timestamp(), clock_timestamp())`, [id, key, bytes.length]);
  return { recording: id, key };
}
/** The verify-0196 conversation fixture: turns with committed units, voice sources and note transcriptions. */
async function conversation(user, session, turns) {
  let sp = Number((await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp',
    [session]))[0].sp);
  for (const [t, turn] of turns.entries()) {
    const id = randomUUID();
    const batch = randomUUID();
    const content = `message ${t + 1}`;
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`, [id, session, user, turn.role, content]);
    await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
               source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
               segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), $6, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, user, session, id, Buffer.from(`${session}:${id}`), turn.units]);
    const v = turn.voice;
    if (v) {
      const assistant = turn.role === 'ASSISTANT';
      await q(`INSERT INTO public.conversation_turn_voice_sources
                 (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
                  anchor_start_ms, anchor_end_ms, spoken, delivery_state)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, user, session, turn.role, v.modality, assistant ? null : 'MACHINE_ASR', assistant ? null : 'HIGH', v.recording,
        v.a, v.b, assistant ? true : null, assistant ? 'COMPLETE' : null]);
      if (turn.duration !== undefined) {
        await q(`INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state, duration_ms, committed_turn_id)
                 VALUES ($1, $2, $3, 'COMMITTED', $4, $5)`, [v.recording, user, session, turn.duration, id]);
      }
    }
    for (let u = 0; u < turn.units; u += 1) {
      sp += 1;
      const body = `${content}, sentence ${u + 1}`;
      await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
                 source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'RESOLVED', $6, $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
      [user, session, id, batch, turn.role, v ? v.modality : 'TEXT', u, [...body].length, body, sp]);
    }
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
}
const withTail = (turns) => [...turns, { role: turns.length % 2 === 0 ? 'USER' : 'ASSISTANT', units: 1 }];
async function replayOf(user, session, first, last) {
  const created = await rt.create(user, randomUUID(), session, first, last);
  assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
  const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
  assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the draft previews (${previewed.outcome})`);
  return previewed.replay_version_id;
}

// ------------------------------------------------------------------ the pool role's side
let db;
let repo;
const request = async (user, kind, ref, command = randomUUID()) =>
  db.query('SELECT * FROM public.server_request_transient_media_v1($1, $2, $3, $4)', [user, kind, ref, command]);
const readFile = async (user, artifact) => db.query('SELECT * FROM public.server_read_transient_media_v1($1, $2)', [user, artifact]);
const release = async (user, artifact) => db.query('SELECT * FROM public.server_release_transient_media_v1($1, $2)', [user, artifact]);
async function artifact(id) {
  await owner();
  const [a] = await rows(`SELECT a.*, e.due_at, e.erased_at, e.erasure_late_at, a.terminal_at
                            FROM voice_private.transient_media_artifacts a
                            LEFT JOIN voice_private.transient_media_erasures e ON e.storage_key = a.storage_key WHERE a.id = $1`, [id]);
  return a;
}
const ms = (a, b) => new Date(a).getTime() - new Date(b).getTime();

function newWorker(ps, telemetry, options = {}) {
  const instanceId = randomUUID();
  instances.push(instanceId);
  return new MediaWorkerService(repo, options.repository ?? ps.store, BIN, {
    concurrency: 1, pollMs: 1000, scratchRoot: options.scratchRoot, instanceId, ...options.overrides,
  }, telemetry);
}
/** Runs jobs until none is left to claim; returns every result. Output written during it is captured and scanned. */
async function drain(worker) {
  const results = [];
  for (;;) {
    const batch = await captured(() => worker.runJobsOnce());
    if (batch.length === 0) return results;
    results.push(...batch);
  }
}
const printedDuringWork = [];
/** Captures whatever the Replay pool code prints while `fn` runs (V-18 / no key, id or content in any log). */
async function captured(fn) {
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  const keep = (chunk) => { printedDuringWork.push(String(chunk)); return true; };
  process.stdout.write = keep;
  process.stderr.write = keep;
  try { return await fn(); } finally { process.stdout.write = out; process.stderr.write = err; }
}
const scratchEmpty = (root) => readdirSync(root).length === 0;

// ------------------------------------------------------------------ scenarios
async function w01Startup(report, env) {
  await report.section('W01 V-28 / V-33 / V-36 (1): every entry point refuses the wrong role and placement; the pins hold', async () => {
    const node = process.execPath;
    const run = (entry, extra, waitMs = 60_000) => new Promise((done) => {
      const child = spawn(node, [join(DIST, entry)], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let text = '';
      child.stdout.on('data', (c) => { text += c; });
      child.stderr.on('data', (c) => { text += c; });
      const timer = setTimeout(() => child.kill('SIGKILL'), waitMs);
      child.on('close', (code) => { clearTimeout(timer); done({ code, text }); });
    });
    const refuses = async (entry, extra, pattern) => {
      const { code, text } = await run(entry, extra);
      assert.notEqual(code, 0, `${entry} with ${JSON.stringify(extra)} refuses`);
      assert.match(text, pattern, `${entry}: the refusal names its check`);
      assert.doesNotMatch(text, /postgres(?:ql)?:\/\/|password|secret/iu, `${entry}: the refusal prints no URL or secret`);
    };
    const W = 'replay-media/media-worker.main.js';
    const D = 'replay-media/replay-watchdog.main.js';
    await refuses(W, { QANDEEL_COMPUTE_ROLE: '' }, /runs only as REPLAY_MEDIA/u);
    await refuses(W, { QANDEEL_COMPUTE_ROLE: 'API' }, /runs only as REPLAY_MEDIA/u);
    await refuses(W, { QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' }, /runs only as REPLAY_MEDIA/u);
    await refuses(W, { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'NONE' }, /REPLAY_PLACEMENT=REPLAY_POOL/u);
    await refuses(W, { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: '' }, /REPLAY_PLACEMENT=REPLAY_POOL/u);
    for (const placement of ['DEDICATED', 'SHARED', 'API_HOST']) {
      await refuses(W, { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: placement }, /no same-host placement/u);
      await refuses('main.js', { QANDEEL_REPLAY_PLACEMENT: placement }, /no same-host placement/u);
    }
    await refuses(D, { QANDEEL_COMPUTE_ROLE: '' }, /runs only as REPLAY_WATCHDOG/u);
    await refuses(D, { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' }, /runs only as REPLAY_WATCHDOG/u);
    await refuses('main.js', { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' }, /runs only as API/u);
    await refuses('main.js', { QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' }, /runs only as API/u);
    // The database session must be the Replay role (a superuser session refuses), and ffmpeg the pin.
    const pool = { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL' };
    await refuses(W, { ...pool, REPLAY_MEDIA_DATABASE_URL: process.env.DATABASE_URL }, /connects only as qandeel_replay_media/u);
    // A superuser login that only sets the role at connection time (current_user = the Replay role, session_user = postgres)
    // could leave it again: refused, as is any session not authenticated as the Replay role itself.
    const roleOption = new URL(process.env.DATABASE_URL);
    roleOption.searchParams.set('options', `-c role=${POOL}`);
    await refuses(W, { ...pool, REPLAY_MEDIA_DATABASE_URL: roleOption.toString() }, /connects only as qandeel_replay_media/u);
    await refuses(D, { ...pool, QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG', REPLAY_MEDIA_DATABASE_URL: process.env.DATABASE_URL },
      /connects only as qandeel_replay_media/u);
    await refuses(W, { ...pool, FFMPEG_BIN: node }, /pinned ffmpeg 9\.0\.2/u);
    await assert.rejects(assertPinnedFfmpeg({ ffmpeg: node, ffprobe: node }, AbortSignal.timeout(10_000)), /pinned ffmpeg/u);
    await assertPinnedFfmpeg(BIN, AbortSignal.timeout(10_000));
    // With the Replay role, the pool, the store and the pin: the worker starts and beats; the watchdog runs once, exits 0.
    const [{ before }] = await rows("SELECT count(*)::int before FROM voice_private.replay_pool_heartbeats WHERE role = 'REPLAY_MEDIA'");
    const started = run(W, pool, 8_000);
    let beat = false;
    for (let i = 0; i < 70 && !beat; i += 1) {
      await sleep(100);
      const [{ n }] = await rows("SELECT count(*)::int n FROM voice_private.replay_pool_heartbeats WHERE role = 'REPLAY_MEDIA'");
      beat = n > before;
    }
    assert.ok(beat, 'the compiled worker started under REPLAY_MEDIA / REPLAY_POOL and wrote its heartbeat');
    const worker = await started;
    assert.doesNotMatch(worker.text, UUID, 'the worker printed no id');
    const watchdog = await run(D, { ...pool, QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' });
    assert.equal(watchdog.code, 0, `the watchdog ran once and exited 0 (${watchdog.text.trim().split('\n')[0] ?? ''})`);
    const [{ w }] = await rows("SELECT count(*)::int w FROM voice_private.replay_pool_heartbeats WHERE role = 'REPLAY_WATCHDOG'");
    assert.ok(w >= 1, 'the watchdog wrote its run heartbeat');
    await committed(() => q("DELETE FROM voice_private.replay_pool_heartbeats"));
  });
}

/**
 * The production authentication model, on the real server: the pool's sessions are LOGINs of qandeel_replay_media itself
 * (session_user = current_user, no SET ROLE), with the role's own settings in force, no way into another role, no table
 * access, and CONNECTION LIMIT 10 enforced by PostgreSQL for those logins.
 */
async function w01bAuthentication(report, replayUrl) {
  await report.section('W01b P-3 / V-33: the pool logs in AS the Replay role; its limits hold; no way into postgres or service_role', async () => {
    const { Client } = requireApi('pg');
    const [who] = await db.query(`SELECT session_user, current_user, current_setting('statement_timeout') st,
      current_setting('lock_timeout') lt, current_setting('idle_in_transaction_session_timeout') it`, []);
    assert.deepEqual([who.session_user, who.current_user, who.st, who.lt, who.it], [POOL, POOL, '5s', '1s', '10s'],
      'authenticated as the Replay role itself, its role settings in force');
    const client = new Client({ connectionString: replayUrl });
    await client.connect();
    const codeOf = (statement) => statement.then(() => null, (error) => error.code ?? 'NO_CODE');
    try {
      assert.equal(await codeOf(client.query('SET ROLE postgres')), '42501', 'no SET ROLE into postgres');
      assert.equal(await codeOf(client.query('SET ROLE service_role')), '42501', 'no SET ROLE into service_role');
      assert.equal(await codeOf(client.query('SELECT 1 FROM voice_private.transient_media_artifacts LIMIT 1')), '42501', 'no table read');
      assert.equal(await codeOf(client.query('SELECT 1 FROM public.users LIMIT 1')), '42501', 'no read of the API tables');
      assert.equal(await codeOf(client.query("SELECT public.server_delete_voice_recording_v1(gen_random_uuid(), gen_random_uuid())")), '42501',
        'no service_role definer');
    } finally {
      await client.end();
    }
    // CONNECTION LIMIT 10, enforced by the server for these logins (the pool's own open sessions count).
    await owner();
    const [{ open }] = await rows('SELECT count(*)::int open FROM pg_stat_activity WHERE usename = $1', [POOL]);
    const extra = [];
    try {
      for (let i = open; i < 10; i += 1) {
        const c = new Client({ connectionString: replayUrl });
        await c.connect();
        extra.push(c);
      }
      const over = new Client({ connectionString: replayUrl });
      assert.equal(await codeOf(over.connect()), '53300', 'the eleventh login is refused (too many connections for role)');
      await over.end().catch(() => undefined);
    } finally {
      for (const c of extra) await c.end().catch(() => undefined);
    }
  });
}

async function listenTo(ps, tracks) {
  const user = await human();
  const call = await committed(async () => {
    const session = await newSession(user);
    return realCall(ps, user, session, tracks);
  });
  return { user, ...call };
}
async function readyListening(ps, worker, tracks) {
  const l = await listenTo(ps, tracks);
  const [row] = await request(l.user, 'LISTENING', l.call);
  const results = await drain(worker);
  assert.deepEqual(results, ['READY'], 'the one job completes');
  const a = await artifact(row.artifact_id);
  assert.equal(a.job_state, 'READY');
  return { ...l, row, a };
}
const LISTENING = {
  USER: [['S', 0, 4000, [[0, 4000, HZ.U]]], ['MUTED', 4000, 4500], ['S', 4500, 10000, [[4500, 10000, HZ.U]]]],
  QANDEEL: [['S', 3000, 7000, [[3000, 7000, HZ.Q]]]],
};

async function w02Listening(report, ps, worker) {
  let pcm = null;
  await report.section('W02 V-09 / V-07 / P-5: listening, two tracks on one clock; the barge-in as it happened; MUTED silent', async () => {
    const { user, row, a, keys } = await readyListening(ps, worker, LISTENING);
    assert.equal(Number(a.expected_duration_ms), 10_000);
    assert.ok(Math.abs(Number(a.duration_ms) - 10_000) <= 43, `length = the clock end ± 43 ms (${a.duration_ms})`);
    const [file] = await readFile(user, row.artifact_id);
    assert.equal(Number(file.byte_size), Number(a.byte_size));
    const bytes = await ps.get(file.storage_key);
    assert.equal(bytes.length, Number(a.byte_size), 'the stored file is exactly the recorded size');
    const { samples } = await measure(bytes);
    present(samples, 0, 3000, HZ.U);
    absent(samples, 0, 3000, HZ.Q, [0, 3000]);
    present(samples, 3000, 4000, HZ.U);
    present(samples, 3000, 7000, HZ.Q);
    assertEdge(samples, 3000, HZ.Q, 'the QANDEEL barge-in starts at its clock');
    absent(samples, 4000, 4500, HZ.U, [4000, 4500]);
    present(samples, 4500, 10_000, HZ.U);
    absent(samples, 7000, 10_000, HZ.Q, [7000, 10_000]);
    // P-5: the resource facts are recorded, content-free; bytes read = the segments' sizes, nothing else read.
    assert.ok(Number(a.wall_ms) > 0 && Number(a.cpu_ms) >= 0 && Number(a.store_ops) >= 5, 'wall, CPU and store operations recorded');
    await owner();
    const [{ sum }] = await rows(`SELECT sum(byte_size)::bigint sum FROM voice_private.recording_objects o JOIN voice_private.recordings r
                                    ON r.id = o.recording_id WHERE r.user_id = $1`, [user]);
    assert.equal(Number(a.bytes_read), Number(sum), 'bytes read = exactly the recording\'s segments');
    const reads = ps.log.filter(([op]) => op === 'read').map(([, k]) => k);
    for (const k of [...keys.USER, ...keys.QANDEEL]) assert.ok(reads.includes(k), 'every segment of the call read once');
    pcm = a.pcm_digest;
  });
  return pcm;
}

async function w03Offset(report, ps, worker, reference) {
  await report.section('W03 V-10: a segment container whose timestamps do not start at 0 → the same output', async () => {
    assert.ok(reference, 'W02 produced the reference');
    const offset = { ...LISTENING, QANDEEL: [['S', 3000, 7000, [[3000, 7000, HZ.Q]], { offset: 48_000n * 37n }]] };
    const { a } = await readyListening(ps, worker, offset);
    assert.equal(a.pcm_digest, reference, 'bit-identical PCM: the container\'s timestamps place nothing');
  });
}

async function w04Replay(report, ps, worker) {
  await report.section('W04 V-02 / V-03 / V-04 / V-05 / V-07 / V-25: a three-run Replay; nothing unselected heard or read', async () => {
    const user = await human();
    const fx = await committed(async () => {
      const session = await newSession(user);
      const note = await realNote(ps, user, session, 3000, HZ.N);
      // Run 2: USER [1000, 3000) inside a [0, 6500) segment with markers outside it; QANDEEL [2500, 5000) with an unselected
      // marked head [2000, 2500) overlapping the USER window, NOT_SPEAKING and WRITER_LOSS gaps; then a 16 s HELD; then USER
      // [21000, 25000) with RECONNECTION and MUTED gaps. Segments the plan does not touch carry markers too.
      const c1 = await realCall(ps, user, session, {
        USER: [
          ['S', 0, 6500, [[0, 1000, HZ.MU], [1000, 3000, HZ.U], [3000, 6500, HZ.MU]]],
          ['S', 6500, 9000, [[6500, 9000, HZ.MU]]],
          ['S', 20000, 22000, [[20000, 21000, HZ.MU], [21000, 22000, HZ.U]]],
          ['RECONNECTION', 22000, 22600],
          ['S', 22600, 23000, [[22600, 23000, HZ.U]]],
          ['MUTED', 23000, 23500],
          ['S', 23500, 26000, [[23500, 25000, HZ.U], [25000, 26000, HZ.MU]]],
        ],
        QANDEEL: [
          ['S', 2000, 3500, [[2000, 2500, HZ.MQ], [2500, 3500, HZ.Q]]],
          ['NOT_SPEAKING', 3500, 3900],
          ['S', 3900, 4400, [[3900, 4400, HZ.Q]]],
          ['WRITER_LOSS', 4400, 4700],
          ['S', 4700, 6000, [[4700, 5000, HZ.Q], [5000, 6000, HZ.MQ]]],
          ['S', 30000, 40000, [[30000, 40000, HZ.MQ]]],
        ],
      });
      const c2 = await realCall(ps, user, session, { USER: [['S', 0, 3000, [[0, 500, HZ.MU], [500, 2500, HZ.U], [2500, 3000, HZ.MU]]]], QANDEEL: [] });
      await conversation(user, session, withTail([
        { role: 'USER', units: 1, voice: { recording: note.recording, modality: 'VOICE_NOTE', a: 0, b: 3000 }, duration: 3000 },
        { role: 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 1000, b: 3000 } },
        { role: 'ASSISTANT', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 2500, b: 5000 } },
        { role: 'USER', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 21000, b: 25000 } },
        { role: 'ASSISTANT', units: 1 },
        { role: 'USER', units: 1, voice: { recording: c2.recording, modality: 'LIVE_CALL_SPEECH', a: 500, b: 2500 } }]));
      await rt.setGate();
      const version = await replayOf(user, session, 1, 7);
      return { note, c1, c2, version };
    });
    ps.log.length = 0;
    const set = await request(user, 'REPLAY_PLAYBACK', fx.version);
    assert.deepEqual(set.map((r) => [r.run_ordinal, Number(r.expected_duration_ms)]), [[1, 3000], [2, 9500], [3, 2000]],
      'three runs: the note, the call with its HELD shortened (24000 − 16000 + 1500), the second call');
    assert.deepEqual(await drain(worker), ['READY', 'READY', 'READY']);
    const files = [];
    for (const r of set) {
      const [file] = await readFile(user, r.artifact_id);
      files.push((await measure(await ps.get(file.storage_key))));
    }
    // Run 1, the note: its tone, its length (± one AAC frame).
    assert.ok(Math.abs(files[0].durationMs - 3000) <= 43, `the note run is 3000 ms ± 43 (${files[0].durationMs})`);
    present(files[0].samples, 0, 3000, HZ.N, PRESENT_NOTE);
    // Run 2 on the file's clock: USER [0, 2000) (clock [1000, 3000)); QANDEEL [1500, 4000) (clock [2500, 5000)), so the MIX
    // is [1500, 2000); inside it NOT_SPEAKING [2500, 2900) and WRITER_LOSS [3400, 3700); the HELD [4000, 5500) (16 s → 1.5 s);
    // USER [5500, 9500) (clock [21000, 25000)) with RECONNECTION [6500, 7100) and MUTED [7500, 8000).
    const r2 = files[1].samples;
    assert.ok(Math.abs(files[1].durationMs - 9500) <= 43, `run 2 is 9500 ms ± 43 (${files[1].durationMs})`);
    const edges = [0, 1500, 2000, 2500, 2900, 3400, 3700, 4000, 5500, 6500, 7100, 7500, 8000, 9500];
    absent(r2, 0, 9500, HZ.MU, edges); // V-03 / V-25: the USER markers outside the windows
    absent(r2, 0, 9500, HZ.MQ, edges); // V-04: the unselected QANDEEL head and tail
    present(r2, 0, 2000, HZ.U);
    absent(r2, 0, 1500, HZ.Q, edges);
    present(r2, 1500, 2000, HZ.U); // V-05: the MIX, both
    present(r2, 1500, 2000, HZ.Q);
    assertEdge(r2, 1500, HZ.Q, 'the MIX begins where the QANDEEL window begins');
    absent(r2, 2000, 4000, HZ.U, edges);
    present(r2, 2000, 2500, HZ.Q);
    silent(r2, 2500, 2900); // V-07: NOT_SPEAKING at its true length
    present(r2, 2900, 3400, HZ.Q);
    silent(r2, 3400, 3700); // V-07: WRITER_LOSS
    present(r2, 3700, 4000, HZ.Q);
    silent(r2, 4000, 5500); // the HELD, 1.5 s
    present(r2, 5500, 6500, HZ.U);
    silent(r2, 6500, 7100); // V-07: RECONNECTION
    present(r2, 7100, 7500, HZ.U);
    silent(r2, 7500, 8000); // V-07: MUTED
    present(r2, 8000, 9500, HZ.U);
    // Run 3: the second call, cut to [500, 2500).
    assert.ok(Math.abs(files[2].durationMs - 2000) <= 43);
    present(files[2].samples, 0, 2000, HZ.U);
    absent(files[2].samples, 0, 2000, HZ.MU, [0, 2000]);
    // The control: the detector does hear both markers where the sources carry them, so "absent" above is a measurement.
    const control = (bytes) => {
      const dir = mkdtempSync(join(tmpdir(), 'qandeel-control-'));
      try {
        writeFileSync(join(dir, 'in.ogg'), bytes);
        const raw = execFileSync(BIN.ffmpeg, ['-nostdin', '-v', 'error', '-i', join(dir, 'in.ogg'), '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1']);
        const out = new Float32Array(raw.length / 4);
        new Uint8Array(out.buffer).set(raw);
        return out;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
    present(control(await ps.get(fx.c1.keys.USER[0])), 0, 1000, HZ.MU);
    present(control(await ps.get(fx.c1.keys.QANDEEL[0])), 0, 500, HZ.MQ);
    // V-02 (C-B4): only segments intersecting an AUDIBLE span were read, each once; nothing else of either call.
    const reads = ps.log.filter(([op]) => op === 'read').map(([, k]) => k);
    const expected = [fx.note.key, fx.c1.keys.USER[0], fx.c1.keys.USER[2], fx.c1.keys.USER[3], fx.c1.keys.USER[4],
      fx.c1.keys.QANDEEL[0], fx.c1.keys.QANDEEL[1], fx.c1.keys.QANDEEL[2], fx.c2.keys.USER[0]];
    assert.deepEqual([...reads].sort(), [...expected].sort(), 'the store access log: exactly the plan\'s segments');
    assert.ok(!reads.includes(fx.c1.keys.USER[1]) && !reads.includes(fx.c1.keys.QANDEEL[3]), 'never a segment outside the plan');
  });
}

async function w05LongHeld(report, ps, worker) {
  await report.section('W05 V-06: a 30-minute HELD → the run file is the windows + 1.5 s', async () => {
    const user = await human();
    const version = await committed(async () => {
      const session = await newSession(user);
      const far = 30 * 60_000;
      const c = await realCall(ps, user, session, {
        USER: [['S', 0, 2000, [[0, 2000, HZ.U]]], ['S', far + 4000, far + 6000, [[far + 4000, far + 6000, HZ.U]]]],
        QANDEEL: [['S', 2000, 4000, [[2000, 4000, HZ.Q]]]],
      });
      await conversation(user, session, withTail([
        { role: 'USER', units: 1, voice: { recording: c.recording, modality: 'LIVE_CALL_SPEECH', a: 0, b: 2000 } },
        { role: 'ASSISTANT', units: 1, voice: { recording: c.recording, modality: 'LIVE_CALL_SPEECH', a: 2000, b: 4000 } },
        { role: 'USER', units: 1, voice: { recording: c.recording, modality: 'LIVE_CALL_SPEECH', a: far + 4000, b: far + 6000 } }]));
      await rt.setGate();
      return replayOf(user, session, 1, 3);
    });
    const [run] = await request(user, 'REPLAY_PLAYBACK', version);
    assert.equal(Number(run.expected_duration_ms), 2000 + 2000 + 1500 + 2000, 'the windows + 1.5 s, never the 30 minutes');
    assert.deepEqual(await drain(worker), ['READY']);
    const [file] = await readFile(user, run.artifact_id);
    const { samples, durationMs } = await measure(await ps.get(file.storage_key));
    assert.ok(Math.abs(durationMs - 7500) <= 43, `7500 ms ± 43 (${durationMs})`);
    present(samples, 0, 2000, HZ.U);
    present(samples, 2000, 4000, HZ.Q);
    silent(samples, 4000, 5500);
    present(samples, 5500, 7500, HZ.U);
    assertEdge(samples, 5500, HZ.U, 'the next window begins 1.5 s after the last');
  });
}

async function w06FailClosed(report, ps, worker, scratchRoot) {
  const one = (options, audio = [[0, 2000, HZ.U]]) => ({ USER: [['S', 0, 2000, audio, options]], QANDEEL: [] });
  const cases = [
    ['a corrupt Ogg page', one({ corrupt: true }), 'DECODE_FAILED', worker],
    ['a missing object', one({ missing: true }), 'OBJECT_MISSING', worker],
    ['a decoded length off by > 20 ms (the clock says 2000, the audio is 1960)', one({ audioEnd: 1960 }, [[0, 1960, HZ.U]]), 'LENGTH_MISMATCH', worker],
    ['the time cap', one({}), 'TIME_CAP', newWorker(ps, undefined, { scratchRoot, overrides: { wallCapMs: 1 } })],
    ['the scratch cap (free space below the floor)', one({}), 'SCRATCH_CAP',
      newWorker(ps, undefined, { scratchRoot, overrides: { minFreeBytes: Number.MAX_SAFE_INTEGER } })],
  ];
  for (const [name, tracks, failure, w] of cases) {
    await report.section(`W06 V-11 fail closed: ${name} → FAILED ${failure}, scratch empty, unreadable, erased`, async () => {
      const l = await listenTo(ps, tracks);
      const [row] = await request(l.user, 'LISTENING', l.call);
      assert.deepEqual(await drain(w), ['FAILED']);
      const a = await artifact(row.artifact_id);
      assert.deepEqual([a.job_state, a.failure_class], ['FAILED', failure]);
      assert.ok(scratchEmpty(scratchRoot), 'the job\'s scratch directory is gone');
      assert.deepEqual(await readFile(l.user, row.artifact_id), [], 'nothing readable');
      assert.ok(a.due_at !== null && a.erased_at === null && ms(a.due_at, a.terminal_at) <= 0, 'the key is due at once');
      assert.equal(await ps.get(a.storage_key), null, 'nothing was uploaded');
      await captured(() => worker.reapOnce());
      const after = await artifact(row.artifact_id);
      assert.ok(after.erased_at !== null, 'the reaper proved the key gone (DELETE, then HEAD 404)');
    });
  }
}

async function w07DeleteMidMix(report, ps, worker) {
  await report.section('W07 V-13: the owner deletes the source while the job mixes → FAILED SOURCE_UNAVAILABLE, the upload erased', async () => {
    const l = await listenTo(ps, LISTENING);
    const [row] = await request(l.user, 'LISTENING', l.call);
    let deleted = false;
    ps.faults.onRead = async () => {
      if (deleted) return;
      deleted = true;
      await owner();
      const [{ outcome }] = await rows('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [l.user, l.recording]);
      assert.equal(outcome, 'DELETED');
    };
    try {
      assert.deepEqual(await drain(worker), ['FAILED']);
    } finally {
      ps.faults.onRead = null;
    }
    const a = await artifact(row.artifact_id);
    assert.deepEqual([a.job_state, a.failure_class], ['FAILED', 'SOURCE_UNAVAILABLE']);
    assert.ok(ps.log.some(([op, k]) => op === 'put' && k === a.storage_key), 'the job had uploaded its file before completion refused it');
    await owner();
    const [{ terminal }] = await rows('SELECT terminal_at::text terminal FROM voice_private.recordings WHERE id = $1', [l.recording]);
    assert.ok(ms(a.due_at, terminal) <= 0, 'due at the source\'s end instant');
    assert.deepEqual(await readFile(l.user, row.artifact_id), []);
    await captured(() => worker.reapOnce());
    assert.ok((await artifact(row.artifact_id)).erased_at !== null, 'erased: DELETE, then HEAD 404');
    assert.equal(await ps.get(a.storage_key), null, 'the uploaded file is gone from the store');
  });
}

async function w08Recovery(report, ps, worker, scratchRoot) {
  await report.section('W08 V-15: a dead holder\'s lapsed lease is claimed again and completes; attempts ≤ 3; scratch emptied at boot', async () => {
    const l = await listenTo(ps, { USER: [['S', 0, 2000, [[0, 2000, HZ.U]]]], QANDEEL: [] });
    const [row] = await request(l.user, 'LISTENING', l.call);
    // A worker claimed the job and died: its lease is the only trace, and it lapses.
    const [claim] = await repo.claimJobs(1);
    assert.equal(claim.job_id, row.artifact_id);
    await committed(() => q("UPDATE voice_private.transient_media_artifacts SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1",
      [row.artifact_id]));
    assert.deepEqual(await drain(worker), ['READY'], 'claimed again after the lease and completed');
    const a = await artifact(row.artifact_id);
    assert.equal(a.attempts, 2);
    // The last allowed lease lapsing fails the set (TIME_CAP), never a fourth attempt.
    const m = await listenTo(ps, { USER: [['S', 0, 2000, [[0, 2000, HZ.U]]]], QANDEEL: [] });
    const [r2] = await request(m.user, 'LISTENING', m.call);
    for (let i = 0; i < 3; i += 1) {
      const [c] = await repo.claimJobs(1);
      assert.equal(c.job_id, r2.artifact_id);
      await committed(() => q("UPDATE voice_private.transient_media_artifacts SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1",
        [r2.artifact_id]));
    }
    assert.deepEqual(await drain(worker), []);
    const b = await artifact(r2.artifact_id);
    assert.deepEqual([b.job_state, b.failure_class, b.attempts], ['FAILED', 'TIME_CAP', 3]);
    // Boot: whatever a dead process left in the scratch root is removed.
    mkdirSync(join(scratchRoot, randomUUID()), { recursive: true });
    writeFileSync(join(scratchRoot, 'left-by-a-dead-process'), randomBytes(1024));
    await worker.cleanScratchRoot();
    assert.ok(scratchEmpty(scratchRoot));
    await captured(() => worker.reapOnce());
  });
}

async function w09Timetable(report, ps, worker, watchdog, telemetry) {
  await report.section('W09 V-27 release: RELEASED, due at the release instant, erased ≤ due + 120 s, never read again', async () => {
    const { user, row } = await readyListening(ps, worker, LISTENING);
    const [{ job_state: state }] = await release(user, row.artifact_id);
    assert.equal(state, 'RELEASED');
    const a = await artifact(row.artifact_id);
    assert.ok(Math.abs(ms(a.due_at, a.terminal_at)) <= 1, 'due at the release instant');
    assert.deepEqual(await readFile(user, row.artifact_id), []);
    await captured(() => worker.reapOnce());
    const e = await artifact(row.artifact_id);
    assert.ok(e.erased_at !== null && ms(e.erased_at, e.due_at) <= 120_000, `erased ${ms(e.erased_at, e.due_at)} ms after due`);
    assert.equal(await ps.get(a.storage_key), null);
  });
  await report.section('W09 V-27 the source\'s end: refused at once, due at the end instant, erased ≤ due + 120 s', async () => {
    const { user, row, recording } = await readyListening(ps, worker, LISTENING);
    await owner();
    await rows('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [user, recording]);
    assert.deepEqual(await readFile(user, row.artifact_id), [], 'refused at once, before any sweep');
    await captured(() => worker.reapOnce());
    const a = await artifact(row.artifact_id);
    const [{ terminal }] = await rows('SELECT terminal_at::text terminal FROM voice_private.recordings WHERE id = $1', [recording]);
    assert.equal(a.job_state, 'EXPIRED');
    assert.ok(Math.abs(ms(a.due_at, terminal)) <= 1, 'due at the deletion instant');
    assert.ok(a.erased_at !== null && ms(a.erased_at, a.due_at) <= 120_000);
    assert.equal(await ps.get(a.storage_key), null);
  });
  await report.section('W09 V-27 the cap: expires_at = created_at + 58 min; at the cap refused, expired, erased', async () => {
    const { user, row, a } = await readyListening(ps, worker, LISTENING);
    assert.equal(ms(a.expires_at, a.created_at), 58 * 60_000, 'the source outlives the cap: created_at + 58 min');
    await committed(() => q(`UPDATE voice_private.transient_media_artifacts SET expires_at = clock_timestamp() + interval '300 milliseconds'
                              WHERE set_id = $1`, [a.set_id]));
    await sleep(400);
    assert.deepEqual(await readFile(user, row.artifact_id), [], 'refused at the cap, before any sweep');
    await captured(() => worker.reapOnce());
    const e = await artifact(row.artifact_id);
    assert.equal(e.job_state, 'EXPIRED');
    assert.ok(Math.abs(ms(e.due_at, e.expires_at)) <= 1, 'due at the cap');
    assert.ok(e.erased_at !== null && ms(e.erased_at, e.due_at) <= 120_000);
  });
  await report.section('W09 V-27 the outage: erasure_late_at once, TRANSIENT_ERASURE_LATE every cycle, the watchdog\'s backstop', async () => {
    const { user, row } = await readyListening(ps, worker, LISTENING);
    await release(user, row.artifact_id);
    ps.faults.erase = true;
    let late;
    try {
      const first = await captured(() => worker.reapOnce());
      assert.equal(first.erased, 0);
      assert.equal(first.deferred, 1, 'the store failed: the key stays due');
      // The clock moved past erase_by (fixture surgery: due earlier and the failed claim's lease lapsed, both allowed).
      await committed(() => q(`UPDATE voice_private.transient_media_erasures SET due_at = due_at - interval '130 seconds',
                                 lease_until = clock_timestamp() - interval '1 second'
                               WHERE storage_key = (SELECT storage_key FROM voice_private.transient_media_artifacts WHERE id = $1)`, [row.artifact_id]));
      const before = telemetry.calls.filter((c) => c.domain === 'TRANSIENT_ERASURE_LATE').length;
      const second = await captured(() => worker.reapOnce());
      assert.ok(second.lateOutstanding >= 1, 'a recorded violation is outstanding');
      late = (await artifact(row.artifact_id)).erasure_late_at;
      assert.ok(late !== null, 'erasure_late_at marked');
      await captured(() => worker.reapOnce());
      assert.equal(String((await artifact(row.artifact_id)).erasure_late_at), String(late), 'marked once, never moved');
      const after = telemetry.calls.filter((c) => c.domain === 'TRANSIENT_ERASURE_LATE').length;
      assert.ok(after - before >= 2, 'TRANSIENT_ERASURE_LATE on every cycle while outstanding');
      assert.deepEqual(await readFile(user, row.artifact_id), [], 'reads still refused');
      const blocked = await captured(() => watchdog.runOnce());
      assert.equal(blocked.erased, 0, 'the backstop keeps retrying while the store fails');
    } finally {
      ps.faults.erase = false;
    }
    await committed(() => q(`UPDATE voice_private.transient_media_erasures SET lease_until = clock_timestamp() - interval '1 second'
                             WHERE storage_key = (SELECT storage_key FROM voice_private.transient_media_artifacts WHERE id = $1)`, [row.artifact_id]));
    const run = await captured(() => watchdog.runOnce());
    assert.ok(run.erased >= 1, 'the independent watchdog\'s backstop erased it once the store was back');
    const e = await artifact(row.artifact_id);
    assert.ok(e.erased_at !== null && String(e.erasure_late_at) === String(late));
    assert.equal(await ps.get(e.storage_key), null);
  });
}

async function w10Generations(report, ps, worker, scratchRoot) {
  await report.section('W10 V-27 (h) (8): generation 2\'s PCM equals generation 1\'s; a forced mismatch → GENERATION_MISMATCH', async () => {
    const g = await readyListening(ps, worker, LISTENING);
    await committed(() => q(`UPDATE voice_private.transient_media_artifacts SET expires_at = clock_timestamp() + make_interval(secs => $2)
                              WHERE set_id = $1`, [g.a.set_id, (L_MS - 1000) / 1000]));
    const [g2] = await request(g.user, 'LISTENING', g.call);
    assert.equal(g2.generation, 2, 'a new command at L − 1 s creates generation 2');
    assert.deepEqual(await drain(worker), ['READY']);
    const b = await artifact(g2.artifact_id);
    assert.equal(b.pcm_digest, g.a.pcm_digest, 'the same PCM, bit for bit');
    assert.ok((await ps.get(b.storage_key)).equals(await ps.get(g.a.storage_key)), 'byte-identical files (bit-exact encode)');
    // Forced mismatch: the same plan, a digest that is not generation 1's.
    const h = await readyListening(ps, worker, LISTENING);
    await committed(() => q(`UPDATE voice_private.transient_media_artifacts SET expires_at = clock_timestamp() + make_interval(secs => $2)
                              WHERE set_id = $1`, [h.a.set_id, (L_MS - 1000) / 1000]));
    const [h2] = await request(h.user, 'LISTENING', h.call);
    const tampering = Object.create(repo);
    tampering.complete = (job, lease, size, duration, _digest, facts) => repo.complete(job, lease, size, duration, `sha256:${'0'.repeat(64)}`, facts);
    const forced = new MediaWorkerService(tampering, ps.store, BIN, { concurrency: 1, pollMs: 1000, scratchRoot, instanceId: randomUUID() });
    assert.deepEqual(await drain(forced), ['FAILED']);
    const c = await artifact(h2.artifact_id);
    assert.deepEqual([c.job_state, c.failure_class], ['FAILED', 'GENERATION_MISMATCH']);
    assert.deepEqual(await readFile(h.user, h2.artifact_id), [], 'never served');
    assert.equal((await readFile(h.user, h.row.artifact_id)).length, 1, 'generation 1 stays readable until its own cap');
    await captured(() => worker.reapOnce());
    assert.equal(await ps.get(c.storage_key), null, 'the refused file is erased');
  });
}

async function w11NoWorker(report, ps) {
  await report.section('W11 V-33 runtime: with no worker running, a request\'s rows stay PENDING (no job runs anywhere else)', async () => {
    const l = await listenTo(ps, LISTENING);
    const [row] = await request(l.user, 'LISTENING', l.call);
    await sleep(2000);
    const a = await artifact(row.artifact_id);
    assert.deepEqual([a.job_state, a.attempts, a.lease_id], ['PENDING', 0, null]);
    await release(l.user, row.artifact_id);
  });
}

async function w12Watchdog(report, ps, worker, watchdog, telemetry) {
  await report.section('W12 V-36 (2) – (4): every pool instance stopped; the watchdog expires, erases, reports absence; staleness', async () => {
    const { user, row, a } = await readyListening(ps, worker, LISTENING);
    // Every pool instance stopped (no heartbeat row), and the file past its cap (moved earlier only, as the guard allows).
    await committed(async () => {
      await q('DELETE FROM voice_private.replay_pool_heartbeats');
      await q(`UPDATE voice_private.transient_media_artifacts SET expires_at = greatest(created_at + interval '1 millisecond', clock_timestamp())
                WHERE set_id = $1`, [a.set_id]);
    });
    await sleep(50);
    // Past erase_by as well, so the backstop (keys overdue by 120 s) takes it with no worker alive.
    await committed(() => q(`UPDATE voice_private.transient_media_erasures SET due_at = least(due_at, clock_timestamp()) - interval '130 seconds'
                             WHERE storage_key = $1`, [a.storage_key]));
    const run = await captured(() => watchdog.runOnce());
    const e = await artifact(row.artifact_id);
    assert.equal(e.job_state, 'EXPIRED', 'the watchdog\'s sweep expired it with no pool instance alive');
    assert.ok(e.erasure_late_at !== null && e.erased_at !== null, 'marked late, then erased by the backstop');
    assert.ok(run.erased >= 1);
    assert.equal(run.health.pool_heartbeat_age_ms, null, 'the pool heartbeat is reported absent');
    assert.ok(!telemetry.calls.some((c) => c.kind === 'health' && c.metric === 'pool_heartbeat_age_ms' && c.value === null),
      'an absent heartbeat is not emitted (its absence is the dead-man input)');
    assert.deepEqual(await readFile(user, row.artifact_id), []);
    // (3) The watchdog stopped: its own run heartbeat goes stale.
    await committed(() => q(`UPDATE voice_private.replay_pool_heartbeats SET seen_at = clock_timestamp() - interval '5 minutes'
                             WHERE role = 'REPLAY_WATCHDOG'`));
    const health = await repo.health();
    assert.ok(Number(health.watchdog_heartbeat_age_ms) >= 300_000, `stale watchdog heartbeat (${health.watchdog_heartbeat_age_ms} ms)`);
    // (4) Every metric label content-free: closed names only, no id, no key, no digit run.
    for (const c of telemetry.calls) {
      for (const v of [c.domain, c.operation, c.outcome, c.failureClass, c.metric].filter((x) => x !== undefined)) {
        assert.match(String(v), /^[A-Za-z][A-Za-z0-9_]{0,40}$/u, `a label is a closed name (${String(v).slice(0, 12)})`);
        assert.doesNotMatch(String(v), /d{3,}|[0-9a-f]{8}-/u, 'a label carries no id or number');
      }
      if (c.kind === 'health') assert.ok(Number.isSafeInteger(c.value) && c.value >= 0, 'a health value is a count or an age');
    }
  });
}

async function p01Performance(report, ps, worker) {
  let facts = null;
  await report.section('P01 P-5 / D-06: a 60-minute listening file inside the D-06.5 wall cap; resources measured', async () => {
    const minute = 60_000;
    const userMinute = callSegment('USER', 0, minute, [[0, minute, HZ.U]], 1);
    const qandeelMinute = callSegment('QANDEEL', 0, minute, [[0, minute, HZ.Q]], 1);
    const tracks = { USER: [], QANDEEL: [] };
    for (let m = 0; m < 60; m += 1) {
      tracks.USER.push(['S', m * minute, (m + 1) * minute, [], { bytes: userMinute }]);
      if (m % 2 === 0) tracks.QANDEEL.push(['S', m * minute, (m + 1) * minute, [], { bytes: qandeelMinute }]);
    }
    const l = await listenTo(ps, tracks);
    const [row] = await request(l.user, 'LISTENING', l.call);
    let peak = 0;
    const sampler = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 100);
    const t0 = Date.now();
    let results;
    try {
      results = await drain(worker);
    } finally {
      clearInterval(sampler);
    }
    const wall = Date.now() - t0;
    assert.deepEqual(results, ['READY']);
    const a = await artifact(row.artifact_id);
    assert.ok(Math.abs(Number(a.duration_ms) - 3_600_000) <= 43, `60 min ± 43 ms (${a.duration_ms})`);
    assert.ok(wall < jobWallCapMs(3_600_000), `inside the D-06.5 cap: ${wall} ms < ${jobWallCapMs(3_600_000)} ms`);
    facts = { wallMs: wall, jobWallMs: Number(a.wall_ms), cpuMs: Number(a.cpu_ms), bytesRead: Number(a.bytes_read), storeOps: a.store_ops,
      fileBytes: Number(a.byte_size), proofProcessPeakRssMiB: Math.round(peak / 1048576) };
    await release(l.user, row.artifact_id);
    await captured(() => worker.reapOnce());
  });
  return facts;
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
    await q('DELETE FROM voice_private.note_transcriptions WHERE user_id = ANY($1::uuid[])', [humans]);
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
runVerifier('prove-0196-media-worker', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('prove-0196', { query: q, restore: () => owner() });
  // The Replay role logs in for this run only (a throwaway password on a disposable database), as a deployment grants.
  setStage('login');
  const password = randomBytes(18).toString('hex');
  await owner();
  await q(`ALTER ROLE ${POOL} LOGIN PASSWORD '${password}'`);
  loginGranted = true;
  const url = new URL(process.env.DATABASE_URL);
  url.username = POOL;
  url.password = password;
  db = new PgReplayDatabase(url.toString(), 4);
  repo = new TransientMediaRepository(db);
  const ps = await createProofStore();
  const scratchRoot = mkdtempSync(join(tmpdir(), 'qandeel-replay-scratch-'));
  const telemetry = recorderTelemetry();
  const worker = newWorker(ps, telemetry, { scratchRoot });
  const watchdog = new ReplayWatchdogService(repo, ps.store, telemetry, randomUUID());
  const childEnv = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, HOME: process.env.HOME,
    NODE_ENV: 'test', REPLAY_MEDIA_DATABASE_URL: url.toString(), FFMPEG_BIN: BIN.ffmpeg, FFPROBE_BIN: BIN.ffprobe,
    REPLAY_SCRATCH_ROOT: mkdtempSync(join(tmpdir(), 'qandeel-replay-child-')),
    QANDEEL_MEDIA_S3_ENDPOINT: process.env.QANDEEL_MEDIA_S3_ENDPOINT ?? 'http://127.0.0.1:9',
    QANDEEL_MEDIA_S3_REGION: process.env.QANDEEL_MEDIA_S3_REGION ?? 'us-east-1',
    QANDEEL_MEDIA_S3_BUCKET: process.env.QANDEEL_MEDIA_S3_BUCKET ?? 'qandeel-media',
    QANDEEL_MEDIA_S3_ACCESS_KEY_ID: process.env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID ?? 'proof-only',
    QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY: process.env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY ?? 'proof-only-throwaway',
  };
  let perf = null;
  try {
    await MediaWorkerService.preflight(db, ps.store, BIN);
    await ReplayWatchdogService.preflight(db, ps.store);
    setStage('startup');
    await w01Startup(report, childEnv);
    await w01bAuthentication(report, url.toString());
    setStage('worker');
    const reference = await w02Listening(report, ps, worker);
    await w03Offset(report, ps, worker, reference);
    await w04Replay(report, ps, worker);
    await w05LongHeld(report, ps, worker);
    await w06FailClosed(report, ps, worker, scratchRoot);
    await w07DeleteMidMix(report, ps, worker);
    await w08Recovery(report, ps, worker, scratchRoot);
    await w09Timetable(report, ps, worker, watchdog, telemetry);
    await w10Generations(report, ps, worker, scratchRoot);
    await w11NoWorker(report, ps);
    await w12Watchdog(report, ps, worker, watchdog, telemetry);
    if (process.env.REPLAY_PROOF_SKIP_PERF !== '1') perf = await p01Performance(report, ps, worker);
    await report.section('V-18: nothing the Replay pool printed while it worked names an id, a key or a digest', async () => {
      const text = printedDuringWork.join('');
      assert.doesNotMatch(text, UUID);
      assert.doesNotMatch(text, /voice-(?:call|note|transient)\/|sha256:/u);
    });
  } finally {
    setStage('teardown');
    await db.close().catch(() => undefined);
    await removeFixtures(ps);
    rmSync(scratchRoot, { recursive: true, force: true });
    rmSync(childEnv.REPLAY_SCRATCH_ROOT, { recursive: true, force: true });
    if (loginGranted) await q(`ALTER ROLE ${POOL} NOLOGIN PASSWORD NULL`);
  }
  console.log(`prove-0196 store: ${STORE_MODE}`);
  console.log(`prove-0196 measurement: max absent amplitude ${measured.maxAbsent.toFixed(5)} (≤ ${ABSENT}), min present ${measured.minPresent.toFixed(4)}`);
  for (const o of measured.onsets) console.log(`prove-0196 onset: ${o.label}: ${o.at} ms (expected ${o.expectedMs} ± ${AAC_FRAME_MS})`);
  if (perf) console.log(`prove-0196 P01 facts: ${JSON.stringify(perf)}`);
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
