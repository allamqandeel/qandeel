// Real-PostgreSQL verifier for migration 0196 (S8B-07 CP1-B, the transient media authority).
//
// The database part of the CP1-B Execution Order §3 matrix, with the R5.1 continuation rules (contract §20) and the
// approval sheet §2.8 concurrency cases, on PostgreSQL 17 with separate connections released together:
//
//   C1  catalogue: the relations and their keys (no nullable key column), the live index, the CHECKs, the guards; no
//       role (anon, authenticated, service_role, qandeel_replay_media) holds any privilege on a new relation (s1); only
//       the request inserts an artifact (s1); the Replay pool role's approved initial limits (P-3, V-33); the transient
//       definers are the pool role's only, the finished-call read v2 the API's only; no wire result names a key, URL,
//       path or text (V-18); no relation references an artifact (V-16); the shared erasure queue is unchanged; the
//       Replay census stays 36 and no public replay* function is added (0169 A03); the gates stay closed (V-19); the
//       account-erasure coverage (ACCOUNT_CASCADE); 0196 follows 0195 and is forward-only
//   V31 idempotency (a, e, f, g, h, k, i, j), the enforcement (s1, s2, s3), the source's end (r1, r3, r4, r5)
//   V27h continuation (1 - 8)
//   V01 owner-exact at every definer; V12 expiry at the instant; V14 retention never extended, readable before E and
//       never at or after it; V11 / V15 failure, lease lapse, attempts; V26 recording_status and the proven reason;
//       V27 the erasure timetable (release, cap, source end, outage: erasure_late_at once, the watchdog's backstop);
//       V34 no start during a live call; V36 the content-free health and the heartbeats; C-B4 the job reads only the
//       plan's run and only intersecting segments; the map carries no recording
//   R   on COMMITTED fixtures, separate connections released together by a lock barrier: V-31 b, c, d, e (race), l, m,
//       n, q, r2; the property tests p and t (1000 rounds each); V-13 the completion and the owner's deletion serialize
//
// Every scenario but R runs inside one transaction that is rolled back; R commits its fixtures and removes them
// (session_replication_role = replica, fixture surgery only). No media byte exists anywhere: objects are rows only.
// "Moving the clock" is fixture surgery on the instants of the disposable database (an expiry or a retention moved
// earlier), never a policy change.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const M0195 = '0195_s8b_07_replay_original_audio_source_truth_v1.sql';
const M0196 = '0196_s8b_07_transient_media_v1.sql';
const POOL = 'qandeel_replay_media';
const L_MS = 300_000;
const CAP_MS = 58 * 60_000;
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');

const F = Object.freeze({
  REQUEST: 'public.server_request_transient_media_v1(uuid,text,uuid,uuid)',
  MAP: 'public.server_read_transient_media_map_v1(uuid,uuid,uuid)',
  CLAIM: 'public.server_claim_transient_media_jobs_v1(integer)',
  JOB: 'public.server_read_transient_media_job_v1(uuid,uuid)',
  HEARTBEAT: 'public.server_heartbeat_transient_media_job_v1(uuid,uuid)',
  COMPLETE: 'public.server_complete_transient_media_job_v1(uuid,uuid,bigint,bigint,text,bigint,bigint,bigint,integer)',
  FAIL: 'public.server_fail_transient_media_job_v1(uuid,uuid,text,bigint,bigint,bigint,integer)',
  READ: 'public.server_read_transient_media_v1(uuid,uuid)',
  CHECK: 'public.server_check_transient_media_v1(uuid,uuid)',
  RELEASE: 'public.server_release_transient_media_v1(uuid,uuid)',
  SWEEP: 'public.server_sweep_transient_media_v1(integer)',
  ERASURES: 'public.server_claim_transient_media_erasures_v1(integer,integer)',
  ERASED: 'public.server_complete_transient_media_erasure_v1(text,uuid)',
  BEAT: 'public.server_beat_transient_media_pool_v1(uuid,text)',
  HEALTH: 'public.server_read_transient_media_health_v1()',
  CALLS2: 'public.server_read_session_finished_calls_v2(uuid,uuid,timestamp with time zone,timestamp with time zone)',
});
const HELPERS = Object.freeze([
  'voice_private.guard_transient_media_artifact_v1()', 'voice_private.guard_transient_media_erasure_v1()',
  'voice_private.transient_media_artifact_removed_v1()', 'voice_private.transient_source_readable_v1(uuid,text,uuid)',
  'voice_private.transient_plan_runs_v1(uuid,uuid)', 'voice_private.transient_readable_for_ms_v1(text,timestamp with time zone,boolean)',
  'voice_private.transient_set_rows_v1(uuid,uuid)', 'voice_private.end_transient_set_v1(uuid,text,text,timestamp with time zone)',
  'voice_private.transient_source_end_instant_v1(text,uuid)',
]);
const RELATIONS = Object.freeze(['voice_private.transient_media_policy', 'voice_private.transient_media_artifacts',
  'voice_private.transient_media_requests', 'voice_private.transient_media_erasures', 'voice_private.replay_pool_heartbeats']);
const NO_KEY = /storage_key|object_key|url|path|bucket|recording_id|_text$|^text|transcript|content|body|digest/u;
const DIGEST = (c) => `sha256:${c.repeat(64)}`;

// The SQLSTATE a statement on an AUTOCOMMIT connection was refused with (null when it succeeded). Never used inside an
// open transaction: there the savepoint-taking rejected() is the only way to catch a refusal.
const codeOf = (statement) => statement.then(() => null, (error) => error.code ?? 'NO_CODE');

async function rejected(operation, codes, message = null) {
  await q('SAVEPOINT rj');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally { await q('ROLLBACK TO SAVEPOINT rj'); await q('RELEASE SAVEPOINT rj'); }
  await owner();
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection ${error.code}: ${error.message}`);
  if (message) assert.match(`${error.message} ${error.constraint ?? ''}`, message);
  return error;
}
/** One call as the Replay pool's role (inside the open transaction). */
// No finally: after a refusal the transaction is aborted, and rejected() restores the role after its rollback.
async function tm(sql, values = []) {
  await asRole(POOL);
  const result = await rows(sql, values);
  await owner();
  return result;
}
async function service(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const num = (v) => (v === null || v === undefined ? v : Number(v));

// ------------------------------------------------------------------ fixtures (direct rows, as verify-0195; the definers are proven there)
async function human() {
  const id = randomUUID();
  await rt.provisionHumans([id]);
  return id;
}
async function newSession(user) {
  const id = randomUUID();
  await owner();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]);
  return id;
}
async function noteRecording(user, session) {
  const id = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', gen_random_uuid(), n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', 2048, clock_timestamp(), clock_timestamp())`, [id, `voice-note/${randomUUID()}`]);
  return id;
}
/** A sealed call recording; `tracks` maps USER / QANDEEL to ['S', a, b] stored segments or [GAP_KIND, a, b] gaps. */
async function callRecording(user, session, tracks, { state = 'STORED' } = {}) {
  const id = randomUUID();
  await owner();
  const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
  const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
  await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
             seat_lease_until = NULL WHERE id = $1`, [call]);
  await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                                 recording_state, sealed_by, writer_lease_until)
           VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', $6,
                   CASE WHEN $6 = 'STORED' THEN 'WRITER' END, CASE WHEN $6 = 'RECORDING' THEN clock_timestamp() + interval '1 minute' END)`,
  [id, user, session, call, t, state]);
  for (const [track, pieces] of Object.entries(tracks)) {
    let index = 0;
    for (const [kind, start, end] of pieces) {
      if (kind === 'S') {
        await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                   byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
                 VALUES ($1, $2, $3, $4, 'STORED', 'audio/ogg', 1000, $5, $6, clock_timestamp(), clock_timestamp())`,
        [id, track, index, `voice-call/${randomUUID()}`, start, end]);
        index += 1;
      } else {
        await q(`INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind)
                 VALUES ($1, $2, $3, $4, $5)`, [id, track, start, end, kind]);
      }
    }
  }
  return { recording: id, call };
}
const TWO_TRACKS = { USER: [['S', 0, 4000], ['MUTED', 4000, 4500], ['S', 4500, 6000]], QANDEEL: [['S', 1000, 3000]] };
/** A person with one sealed call: { user, session, call, recording }. */
async function listener() {
  const user = await human();
  const session = await newSession(user);
  const { recording, call } = await callRecording(user, session, TWO_TRACKS);
  return { user, session, call, recording };
}
async function conversation(user, session, turns) {
  await owner();
  let sp = Number((await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp',
    [session]))[0].sp);
  const out = [];
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
        v.a, v.b, assistant ? true : null, assistant ? (v.delivery ?? 'COMPLETE') : null]);
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
    out.push({ id });
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
  return out;
}
const withTail = (turns) => [...turns, { role: turns.length % 2 === 0 ? 'USER' : 'ASSISTANT', units: 1 }];
async function replayOf(user, session, first, last) {
  const created = await rt.create(user, randomUUID(), session, first, last);
  assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
  const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
  assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the draft previews (${previewed.outcome})`);
  return { replay: created.replay_id, version: previewed.replay_version_id };
}
/**
 * A V2 Replay of three runs: a note (run 1), text, then a call's USER + QANDEEL windows with a MIX and a long HELD
 * interval (run 2), text, then a second call (run 3, CROSS_RECORDING). Returns the people, recordings and version.
 */
async function threeRunReplay(user = null) {
  const A = user ?? await human();
  const session = await newSession(A);
  const note = await noteRecording(A, session);
  const c1 = await callRecording(A, session, {
    USER: [['S', 0, 4000], ['S', 4000, 9000], ['S', 20000, 26000]], QANDEEL: [['S', 2000, 6000], ['S', 30000, 40000]],
  });
  const c2 = await callRecording(A, session, { USER: [['S', 0, 3000]], QANDEEL: [] });
  await conversation(A, session, withTail([
    { role: 'USER', units: 1, voice: { recording: note, modality: 'VOICE_NOTE', a: 0, b: 3000 }, duration: 3000 },
    { role: 'ASSISTANT', units: 1 },
    { role: 'USER', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 1000, b: 3000 } },
    { role: 'ASSISTANT', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 2500, b: 5000 } },
    { role: 'USER', units: 1, voice: { recording: c1.recording, modality: 'LIVE_CALL_SPEECH', a: 21000, b: 25000 } },
    { role: 'ASSISTANT', units: 1 },
    { role: 'USER', units: 1, voice: { recording: c2.recording, modality: 'LIVE_CALL_SPEECH', a: 500, b: 2500 } }]));
  await rt.setGate();
  const r = await replayOf(A, session, 1, 7);
  return { user: A, session, note, c1, c2, ...r };
}
// Run 1: note [0, 3000) → 3000 ms. Run 2: [1000, 25000) with HELD 16000 → 24000 − 16000 + 1500 = 9500 ms.
// Run 3: [500, 2500) → 2000 ms.
const THREE_RUN_EXPECTED = [3000, 9500, 2000];

const request = (user, kind, ref, command = randomUUID()) =>
  tm('SELECT * FROM public.server_request_transient_media_v1($1, $2, $3, $4)', [user, kind, ref, command]);
const listen = (l, command = randomUUID()) => request(l.user, 'LISTENING', l.call, command);
async function artifactsOf(user) {
  await owner();
  return rows(`SELECT a.*, e.due_at, e.erased_at, e.erasure_late_at FROM voice_private.transient_media_artifacts a
                 LEFT JOIN voice_private.transient_media_erasures e ON e.storage_key = a.storage_key
                WHERE a.user_id = $1 ORDER BY a.generation, a.created_at, a.run_ordinal`, [user]);
}
async function ledgerOf(user) {
  await owner();
  return rows('SELECT * FROM voice_private.transient_media_requests WHERE user_id = $1 ORDER BY created_at', [user]);
}
const liveGenerations = async (user) => {
  await owner();
  return (await rows(`SELECT DISTINCT generation FROM voice_private.transient_media_artifacts
                       WHERE user_id = $1 AND job_state IN ('PENDING', 'RUNNING', 'READY') ORDER BY 1`, [user])).map((r) => r.generation);
};
/** Moves a set's cap to `ms` from now (earlier only: the guard refuses a later one). */
async function capIn(set, ms) {
  await owner();
  await q(`UPDATE voice_private.transient_media_artifacts SET expires_at = greatest(created_at + interval '1 millisecond',
             clock_timestamp() + make_interval(secs => $2::double precision / 1000)) WHERE set_id = $1`, [set, ms]);
}
/** Moves a recording's own end (its retention and start together, as the CHECK binds them) to `ms` from now. */
async function sourceEndsIn(recording, ms) {
  await owner();
  await q("SET LOCAL session_replication_role = 'replica'");
  await q(`WITH n AS (SELECT clock_timestamp() + make_interval(secs => $2::double precision / 1000) AS e)
           UPDATE voice_private.recordings r SET retention_expires_at = n.e,
                  started_at = CASE WHEN r.recording_kind = 'LIVE_CALL' THEN n.e - interval '30 days' END,
                  accepted_at = CASE WHEN r.recording_kind = 'VOICE_NOTE' THEN n.e - interval '30 days' END
             FROM n WHERE r.id = $1`, [recording, ms]);
  await q("SET LOCAL session_replication_role = 'origin'");
}
async function retentionOf(recording) {
  await owner();
  return (await rows('SELECT retention_expires_at::text AS r FROM voice_private.recordings WHERE id = $1', [recording]))[0].r;
}
/** Claims every PENDING job of `set` and completes it with its expected length and the given PCM digest. */
async function makeReady(set, pcm = DIGEST('a')) {
  const out = [];
  for (const job of await claimSet(set)) {
    out.push((await tm(`SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 10, 5, 100, 3) AS o`,
      [job.id, job.lease_id, job.expected_duration_ms, pcm]))[0].o);
  }
  return out;
}
async function claimSet(set) {
  const claimed = await tm('SELECT * FROM public.server_claim_transient_media_jobs_v1(25)');
  await owner();
  const mine = await rows(`SELECT id, lease_id, expected_duration_ms FROM voice_private.transient_media_artifacts
                            WHERE set_id = $1 AND job_state = 'RUNNING' AND id = ANY($2::uuid[]) ORDER BY run_ordinal`,
  [set, claimed.map((c) => c.job_id)]);
  return mine;
}
const readOf = (user, artifact) => tm('SELECT * FROM public.server_read_transient_media_v1($1, $2)', [user, artifact]);
const checkOf = async (user, artifact) => (await tm('SELECT * FROM public.server_check_transient_media_v1($1, $2)', [user, artifact]))[0];
const releaseOf = (user, artifact) => tm('SELECT * FROM public.server_release_transient_media_v1($1, $2)', [user, artifact]);
const sweep = async (n = 100) => (await tm('SELECT * FROM public.server_sweep_transient_media_v1($1)', [n]))[0];

// ------------------------------------------------------------------ catalogue
async function verifyCatalogue(report) {
  await report.section('C1a relations: every key column NOT NULL, the live index with generation, the CHECKs and the guards', async () => {
    await owner();
    const notNull = async (rel, cols) => {
      for (const c of cols) {
        const [{ nn }] = await rows(`SELECT a.attnotnull nn FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attname = $2`, [rel, c]);
        assert.equal(nn, true, `${rel}.${c} is NOT NULL (§14: no key column may be nullable)`);
      }
    };
    await notNull('voice_private.transient_media_artifacts', ['id', 'user_id', 'owner_kind', 'set_id', 'subject_id', 'run_ordinal',
      'generation', 'plan_digest', 'job_state', 'storage_key', 'expected_duration_ms', 'created_at', 'expires_at']);
    await notNull('voice_private.transient_media_requests', ['user_id', 'command_id', 'owner_kind', 'subject_id', 'set_id', 'created_at']);
    await notNull('voice_private.transient_media_erasures', ['storage_key', 'due_at']);
    const [{ def }] = await rows("SELECT pg_get_indexdef('voice_private.transient_media_live_uq'::regclass) def");
    assert.match(def, /UNIQUE INDEX transient_media_live_uq ON voice_private\.transient_media_artifacts USING btree \(user_id, owner_kind, subject_id, run_ordinal, generation\) WHERE \(job_state = ANY \(ARRAY\['PENDING'::text, 'RUNNING'::text, 'READY'::text\]\)\)/u);
    const [{ pk }] = await rows(`SELECT pg_get_constraintdef(oid) pk FROM pg_constraint WHERE conname = 'transient_media_requests_pk'`);
    assert.equal(pk, 'PRIMARY KEY (user_id, command_id)');
    const cols = (await rows(`SELECT a.attname FROM pg_attribute a WHERE a.attrelid = 'voice_private.transient_media_erasures'::regclass
                                AND a.attnum > 0 AND NOT a.attisdropped`)).map((r) => r.attname);
    assert.ok(!cols.some((c) => /user|session|recording|replay|call/u.test(c)), 'the Replay erasure ledger holds no user id (§18.1)');
    for (const t of ['transient_media_artifacts_guard', 'transient_media_erasures_guard', 'transient_media_artifacts_removed']) {
      const [{ enabled }] = await rows('SELECT tgenabled enabled FROM pg_trigger WHERE tgname = $1', [t]);
      assert.equal(enabled, 'O', `${t} is enabled`);
    }
    const fks = await rows(`SELECT conrelid::regclass::text rel FROM pg_constraint
                             WHERE contype = 'f' AND confrelid IN ('voice_private.transient_media_artifacts'::regclass,
                                   'voice_private.transient_media_requests'::regclass, 'voice_private.transient_media_erasures'::regclass)`);
    assert.deepEqual(fks, [], 'V-16: no relation (no I-06C relation, nothing) references a transient file');
    const own = await rows(`SELECT conrelid::regclass::text rel, confrelid::regclass::text ref, confdeltype del FROM pg_constraint
                             WHERE contype = 'f' AND conrelid IN ('voice_private.transient_media_artifacts'::regclass,
                                   'voice_private.transient_media_requests'::regclass) ORDER BY 1`);
    assert.deepEqual(own.map((r) => [r.rel, r.ref, r.del]), [
      ['voice_private.transient_media_artifacts', 'users', 'c'], ['voice_private.transient_media_requests', 'users', 'c']],
    'the artifacts and the ledger reference only the account, ON DELETE CASCADE (no FK to a recording or a Replay)');
    const reg = await rows(`SELECT relation, coverage FROM account_erasure_private.coverage_registry
                             WHERE relation LIKE 'voice_private.transient%' ORDER BY 1`);
    assert.deepEqual(reg.map((r) => [r.relation, r.coverage]), [
      ['voice_private.transient_media_artifacts', 'ACCOUNT_CASCADE'], ['voice_private.transient_media_requests', 'ACCOUNT_CASCADE']]);
    const [policy] = await rows('SELECT * FROM voice_private.transient_media_policy');
    assert.deepEqual([policy.continuation_lead_seconds, policy.active_sets_per_user, policy.pending_sets_max, policy.lease_seconds,
      policy.max_attempts], [300, 2, 32, 60, 3], 'L = 5 min; ≤ 2 per user, ≤ 32 pending; lease 60 s; 3 attempts');
  });

  await report.section('C1b s1: no role writes or reads a new relation; only the request inserts an artifact', async () => {
    await owner();
    for (const rel of RELATIONS) {
      for (const role of ['anon', 'authenticated', 'service_role', POOL]) {
        const [{ any }] = await rows('SELECT has_table_privilege($1, $2, $3) "any"', [role, rel, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER']);
        assert.equal(any, false, `${role} holds no privilege on ${rel}`);
      }
    }
    const writers = (await rows(`SELECT p.proname FROM pg_proc p
                                  WHERE p.prosrc ~* 'INSERT\\s+INTO\\s+voice_private\\.transient_media_artifacts' ORDER BY 1`)).map((r) => r.proname);
    assert.deepEqual(writers, ['server_request_transient_media_v1'], 's1: the only function that inserts a generation');
    const [{ conn, login, inherit }] = await rows(`SELECT rolconnlimit conn, rolcanlogin login, rolinherit inherit FROM pg_roles WHERE rolname = $1`, [POOL]);
    assert.deepEqual([conn, login, inherit], [10, false, false], 'P-3: CONNECTION LIMIT 10, no login granted by a migration');
    const [{ cfg }] = await rows(`SELECT s.setconfig cfg FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                                   WHERE r.rolname = $1 AND s.setdatabase = 0`, [POOL]);
    for (const c of ['statement_timeout=5s', 'lock_timeout=1s', 'idle_in_transaction_session_timeout=10s']) assert.ok(cfg.includes(c), `P-3: ${c}`);
    const members = await rows(`SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
                                 WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)`, [POOL]);
    assert.deepEqual(members, [], 'the pool role inherits no other role');
  });

  await report.section('C1c the definers: postgres-owned, search_path pinned, the pool role only (v2: the API only); no key on the wire', async () => {
    await owner();
    for (const [name, fn] of Object.entries(F)) {
      const [p] = await rows(`SELECT pg_get_userbyid(proowner) AS owner, prosecdef, proconfig FROM pg_proc WHERE oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
      assert.equal(p.prosecdef, true, `${fn} is SECURITY DEFINER`);
      assert.ok((p.proconfig ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins search_path`);
      for (const role of ['public', 'anon', 'authenticated', 'service_role', POOL]) {
        const expected = name === 'CALLS2' ? role === 'service_role' : role === POOL;
        assert.equal(await rt.canExecute(role, fn), expected, `${role} on ${fn}`);
      }
    }
    for (const fn of HELPERS) {
      for (const role of ['public', 'anon', 'authenticated', 'service_role', POOL]) assert.equal(await rt.canExecute(role, fn), false, `${role} on ${fn}`);
    }
    // V-18: what reaches the phone (the request, the status, the release, the map, the health and the API's read) names no
    // key, URL, path, text, recording or digest. The read, the job read and the erasure claim name a key, server side only.
    for (const fn of [F.REQUEST, F.CHECK, F.RELEASE, F.MAP, F.HEALTH, F.SWEEP, F.CALLS2]) {
      const cols = await rt.resultColumns(fn);
      assert.ok(cols.length > 0, `${fn} declares its result`);
      assert.deepEqual(cols.filter((c) => NO_KEY.test(c)), [], `${fn} declares no key, URL, path, text, recording or digest`);
    }
    assert.deepEqual(await rt.resultColumns(F.READ), ['storage_key', 'byte_size', 'duration_ms', 'serve_until', 'db_now']);
    const src = (await rows(`SELECT string_agg(p.prosrc, E'\\n') s FROM pg_proc p
                              WHERE p.proname ~ 'transient' OR p.proname = 'server_read_session_finished_calls_v2'`))[0].s;
    assert.doesNotMatch(src, /retention_expires_at\s*=|UPDATE voice_private\.recordings|media_erasure_queue|pg_advisory|LOCK TABLE|\bEXECUTE\s/u,
      'V-14: nothing writes a retention; nothing touches the shared queue; no advisory or table lock; no dynamic SQL');
    const replayFns = (await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                    WHERE n.nspname = 'public' AND p.proname ~ 'transient|finished_calls_v2' AND p.proname ~ 'replay'`));
    assert.deepEqual(replayFns, [], '0169 A03: no new public function is named replay');
    const [{ n: replayTables }] = await rows(`SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND ((n.nspname = 'public' AND c.relname ~ '^replay') OR n.nspname = 'replay_private')`);
    assert.equal(replayTables, 36, '0169 A03: the Replay census is unchanged');
  });

  await report.section('C1d V-19 the gates; the shared queue unchanged; 0196 follows 0195, forward-only', async () => {
    await owner();
    const gates = await rows(`SELECT count(*)::int n FROM voice_private.voice_launch_capability_states
                               WHERE feature_flag_state = 'DISABLED' AND launch_requirements_state = 'UNSATISFIED'`);
    assert.equal(gates[0].n, 4, 'every voice gate DISABLED / UNSATISFIED');
    assert.deepEqual(await rows('SELECT * FROM replay_private.replay_launch_capability_states'), [], 'no Personal Replay gate state');
    const [{ def }] = await rows(`SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conname = 'media_erasure_queue_key_check'`);
    assert.match(def, /\^\(intro-media\|voice-note\|voice-call\)\/\[0-9a-f-\]\{36\}\$/u, 'the shared queue still refuses voice-transient/ keys');
    await q('BEGIN');
    try {
      await rejected(() => q(`INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
                              VALUES ($1, clock_timestamp())`, [`voice-transient/${randomUUID()}`]), ['23514']);
    } finally { await q('ROLLBACK'); }
    const files = readdirSync(new URL('./migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    assert.equal(files.at(-1), M0196, '0196 is the last migration');
    assert.equal(files.at(-2), M0195, 'exactly 0196 follows 0195');
    const sql = readFileSync(new URL(`./migrations/${M0196}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    const code = sql.replace(/^\s*--.*$/gmu, '').replace(/\$\$[\s\S]*?\$\$/gu, '$$$$');
    assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
    assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
    assert.doesNotMatch(code, /GRANT [^;]*TO (?:anon|authenticated|PUBLIC)\b/u, 'no client role is granted anything');
    assert.doesNotMatch(code, /CREATE OR REPLACE|DROP FUNCTION|ALTER TABLE (?!%)/u, 'no earlier function or relation is replaced or altered');
    assert.doesNotMatch(sql, /set_voice_launch_capability_v1\(|set_replay_launch_capability_v1\(/u, 'no gate is set');
  });
}

// ------------------------------------------------------------------ the rolled-back behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('V31a/h/k the same command three times → one ledger row, one artifact; terminal returned; a new command after release → a new set', async () => {
      const l = await listener();
      const command = randomUUID();
      const first = await listen(l, command);
      assert.equal(first.length, 1);
      assert.deepEqual([first[0].run_ordinal, first[0].generation, first[0].job_state], [0, 1, 'PENDING']);
      assert.ok(num(first[0].readable_for_ms) > CAP_MS - 5000 && num(first[0].readable_for_ms) <= CAP_MS, 'readable_for_ms is the cap left');
      for (let i = 0; i < 2; i += 1) assert.equal((await listen(l, command))[0].artifact_id, first[0].artifact_id, 'a retry returns the same artifact');
      assert.equal((await ledgerOf(l.user)).length, 1, 'one ledger row');
      assert.equal((await artifactsOf(l.user)).length, 1, 'one artifact');
      const [{ due_at: due, expires_at: expires, storage_key: key }] = await artifactsOf(l.user);
      assert.equal(String(due), String(expires), 'the key is in the Replay erasure ledger at once, due at its cap');
      assert.match(key, /^voice-transient\/[0-9a-f-]{36}$/u);
      assert.deepEqual(await releaseOf(l.user, first[0].artifact_id), [{ job_state: 'RELEASED' }]);
      const retry = await listen(l, command);
      assert.deepEqual([retry[0].artifact_id, retry[0].job_state, num(retry[0].readable_for_ms)], [first[0].artifact_id, 'RELEASED', 0],
        'h: a retry after RELEASED returns the terminal state and creates nothing');
      assert.equal((await artifactsOf(l.user)).length, 1);
      const fresh = await listen(l);
      assert.notEqual(fresh[0].artifact_id, first[0].artifact_id, 'k: a new command after release makes a new set');
      assert.notEqual(fresh[0].set_id, first[0].set_id);
      const all = await artifactsOf(l.user);
      assert.equal(new Set(all.map((a) => a.storage_key)).size, 2, 'k: with a new storage key');
      assert.deepEqual(await readOf(l.user, first[0].artifact_id), [], 'k: the released artifact is never read again');
    });

    await report.isolated('V31e/f/g another kind or subject → COMMAND_REUSED, nothing returned or created; another user → independent', async () => {
      const l = await listener();
      const command = randomUUID();
      await listen(l, command);
      const r = await threeRunReplay(l.user);
      const reused = await rejected(() => request(l.user, 'REPLAY_PLAYBACK', r.version, command), ['P0001'], /COMMAND_REUSED/u);
      assert.equal(reused.message, 'COMMAND_REUSED', 'e: the refusal carries no artifact id, state or reason');
      const c2 = await callRecording(l.user, l.session, TWO_TRACKS);
      await rejected(() => request(l.user, 'LISTENING', c2.call, command), ['P0001'], /COMMAND_REUSED/u);
      const rc = randomUUID();
      await request(l.user, 'REPLAY_PLAYBACK', r.version, rc);
      await rejected(() => listen(l, rc), ['P0001'], /COMMAND_REUSED/u);
      assert.equal((await ledgerOf(l.user)).length, 2, 'no new ledger row');
      const B = await listener();
      const theirs = await listen(B, command);
      assert.equal(theirs.length, 1, 'g: another user, the same command id → an independent row');
      assert.notEqual(theirs[0].set_id, (await ledgerOf(l.user))[0].set_id);
      await rejected(() => request(B.user, 'LISTENING', l.call, randomUUID()), ['P0002'], /TRANSIENT_NOT_AVAILABLE/u);
    });

    await report.isolated('V31i/j/s3 as postgres: NULL and wrong ordinals refused; a second live set refused by the index; the R1.1 negative control; a third generation number IS accepted by the index', async () => {
      const l = await listener();
      const [a] = await listen(l);
      const [row] = await artifactsOf(l.user);
      const clone = (patch) => q(`INSERT INTO voice_private.transient_media_artifacts
          SELECT (jsonb_populate_record(a, $2::jsonb)).* FROM voice_private.transient_media_artifacts a WHERE a.id = $1`,
      [row.id, JSON.stringify({ id: randomUUID(), set_id: randomUUID(), storage_key: `voice-transient/${randomUUID()}`, ...patch })]);
      await rejected(() => clone({ run_ordinal: null }), ['23502']);
      await rejected(() => clone({ run_ordinal: 1 }), ['23514'], /kind_check/u);
      await rejected(() => clone({}), ['23505'], /transient_media_live_uq/u);
      await q('SAVEPOINT s3');
      await clone({ generation: 2 });
      await clone({ generation: 3 });
      assert.deepEqual(await liveGenerations(l.user), [1, 2, 3], 's3: three live generations with different numbers pass the index');
      await q('ROLLBACK TO SAVEPOINT s3');
      await q(`CREATE TEMPORARY TABLE r11_negative (user_id uuid NOT NULL, command_id uuid NOT NULL, run_ordinal integer,
                 UNIQUE (user_id, command_id, run_ordinal)) ON COMMIT DROP`);
      const u = randomUUID();
      const c = randomUUID();
      await q('INSERT INTO r11_negative VALUES ($1, $2, NULL), ($1, $2, NULL)', [u, c]);
      const [{ n }] = await rows('SELECT count(*)::int n FROM r11_negative');
      assert.equal(n, 2, 'j: R1.1\'s UNIQUE (user_id, command_id, run_ordinal) admitted two LISTENING rows (why the design changed)');
      await q('DROP TABLE r11_negative');
      assert.ok(a.artifact_id);
    });

    await report.isolated('V31s1 every role is refused a direct write (42501); s2 two live generations, the newest short of L → the request raises (e), nothing kept', async () => {
      const l = await listener();
      const [g1] = await listen(l);
      for (const role of ['anon', 'authenticated', 'service_role', POOL]) {
        for (const sql of [`INSERT INTO voice_private.transient_media_artifacts (id) VALUES (gen_random_uuid())`,
          `UPDATE voice_private.transient_media_artifacts SET job_state = 'READY' WHERE id = '${g1.artifact_id}'`,
          `DELETE FROM voice_private.transient_media_artifacts WHERE id = '${g1.artifact_id}'`,
          `INSERT INTO voice_private.transient_media_requests (user_id) VALUES (gen_random_uuid())`,
          `UPDATE voice_private.transient_media_erasures SET erased_at = clock_timestamp()`]) {
          await rejected(async () => { await asRole(role); await q(sql); }, ['42501']);
        }
      }
      // s2: a fixture the rules never produce: generation 1 READY and generation 2 READY, the newest with < L left.
      await makeReady(g1.set_id);
      const [row] = await artifactsOf(l.user);
      await q(`INSERT INTO voice_private.transient_media_artifacts
          SELECT (jsonb_populate_record(a, $2::jsonb)).* FROM voice_private.transient_media_artifacts a WHERE a.id = $1`,
      [row.id, JSON.stringify({ id: randomUUID(), set_id: randomUUID(), storage_key: `voice-transient/${randomUUID()}`, generation: 2 })]);
      const [g2] = (await artifactsOf(l.user)).filter((a) => a.generation === 2);
      await capIn(g2.set_id, L_MS - 60_000);
      const before = [(await artifactsOf(l.user)).length, (await ledgerOf(l.user)).length];
      await rejected(() => listen(l), ['P0001'], /TRANSIENT_GENERATION_LIMIT/u);
      assert.deepEqual([(await artifactsOf(l.user)).length, (await ledgerOf(l.user)).length], before, 's2: no row and no ledger row is kept');
    });

    await report.isolated('V27h(1-4,7) READY with L − 1 s → generation 2, then reused; its cap; a past-cap row expired inline; release due at once', async () => {
      const l = await listener();
      const retention = await retentionOf(l.recording);
      const [g1] = await listen(l);
      await makeReady(g1.set_id);
      await capIn(g1.set_id, L_MS - 1000);
      const [g2] = await listen(l);
      assert.equal(g2.generation, 2, '(1) L − 1 s left and not covering → generation 2, no reuse');
      assert.notEqual(g2.set_id, g1.set_id);
      assert.equal((await listen(l))[0].set_id, g2.set_id, '(1) a second request reuses generation 2');
      assert.deepEqual(await liveGenerations(l.user), [1, 2], '(2) two live generations');
      const [{ ok }] = await rows(`SELECT expires_at = created_at + interval '58 minutes' ok FROM voice_private.transient_media_artifacts WHERE id = $1`,
        [g2.artifact_id]);
      assert.equal(ok, true, '(3) its cap is created_at + 58 min (the source outlives it)');
      assert.equal(await retentionOf(l.recording), retention, '(3) retention_expires_at unchanged');
      await capIn(g1.set_id, -1);
      await listen(l);
      const g1row = (await artifactsOf(l.user)).find((a) => a.id === g1.artifact_id);
      assert.equal(g1row.job_state, 'EXPIRED', '(4) a past-cap READY row is expired inline by the request, never reused');
      assert.deepEqual(await liveGenerations(l.user), [2]);
      // (7) release: due at the release instant.
      await makeReady(g2.set_id);
      const [{ t0 }] = await rows('SELECT clock_timestamp() t0');
      await releaseOf(l.user, g2.artifact_id);
      const [{ t1 }] = await rows('SELECT clock_timestamp() t1');
      const g2row = (await artifactsOf(l.user)).find((a) => a.id === g2.artifact_id);
      assert.equal(g2row.job_state, 'RELEASED');
      assert.ok(g2row.due_at >= t0 && g2row.due_at <= t1, '(7) due_at is the release instant');
      assert.deepEqual(await readOf(l.user, g2.artifact_id), [], 'the released file is never read again');
    });

    await report.isolated('V27h(5,6,8) source ended → no set; live call → LIVE_CALL_ACTIVE; PCM equal across generations, a mismatch → GENERATION_MISMATCH', async () => {
      const l = await listener();
      const [g1] = await listen(l);
      assert.deepEqual(await makeReady(g1.set_id, DIGEST('b')), ['READY']);
      await capIn(g1.set_id, 60_000);
      const [g2] = await listen(l);
      assert.deepEqual(await makeReady(g2.set_id, DIGEST('b')), ['READY'], '(8) generation 2 with the same PCM is READY');
      await capIn(g1.set_id, -1);
      await capIn(g2.set_id, 60_000);
      const [g3] = await listen(l);
      assert.equal(g3.generation, 3);
      assert.deepEqual(await makeReady(g3.set_id, DIGEST('c')), ['FAILED'], '(8) a PCM mismatch is refused');
      const g3row = (await artifactsOf(l.user)).find((a) => a.id === g3.artifact_id);
      assert.deepEqual([g3row.job_state, g3row.failure_class, g3row.pcm_digest], ['FAILED', 'GENERATION_MISMATCH', null]);
      assert.deepEqual(await readOf(l.user, g3.artifact_id), [], 'never served');
      // (6) a live call: refused, nothing created.
      await owner();
      const live = await fixtureCall(q, rows, { id: randomUUID(), user: l.user, session: l.session, startedAt: new Date().toISOString() });
      const before = (await artifactsOf(l.user)).length;
      await rejected(() => listen(l), ['P0001'], /LIVE_CALL_ACTIVE/u);
      assert.equal((await artifactsOf(l.user)).length, before, '(6) nothing created');
      await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
                 seat_lease_until = NULL WHERE id = $1`, [live]);
      // (5) the source ended: no new set.
      await sourceEndsIn(l.recording, -1);
      await rejected(() => listen(l), ['P0002'], /TRANSIENT_NOT_AVAILABLE/u);
    });

    await report.isolated('V31r1/r3/r4 near the source end: G covers E → reuse; a first request 2 min before E → expires_at = E; the exact boundaries', async () => {
      const l = await listener();
      await sourceEndsIn(l.recording, 30 * 60_000);
      const [g1] = await listen(l);
      const [{ e }] = await rows('SELECT retention_expires_at e FROM voice_private.recordings WHERE id = $1', [l.recording]);
      const g1row = (await artifactsOf(l.user))[0];
      assert.equal(g1row.expires_at.getTime(), e.getTime(), 'a file made within 58 min of E has expires_at = E');
      await sourceEndsIn(l.recording, 60_000);
      await capIn(g1.set_id, 60_000);
      await q('UPDATE voice_private.transient_media_artifacts a SET expires_at = r.retention_expires_at FROM voice_private.recordings r WHERE a.set_id = $1 AND r.id = $2',
        [g1.set_id, l.recording]);
      assert.equal((await listen(l))[0].set_id, g1.set_id, 'r1 / r4: G.expires_at = E exactly, 1 min left → reuse, no new row');
      assert.equal((await artifactsOf(l.user)).length, 1);
      // r3: a first request with E two minutes away.
      const m = await listener();
      await sourceEndsIn(m.recording, 120_000);
      const [first] = await listen(m);
      const [{ ok }] = await rows(`SELECT a.expires_at = r.retention_expires_at ok FROM voice_private.transient_media_artifacts a
                                     JOIN voice_private.recordings r ON r.id = $2 WHERE a.id = $1`, [first.artifact_id, m.recording]);
      assert.equal(ok, true, 'r3: generation 1 with expires_at = E');
      // r4: L left within ±50 ms of the boundary (the database clock moves; v_now is read inside the function).
      const n = await listener();
      const [n1] = await listen(n);
      await capIn(n1.set_id, L_MS + 250);
      assert.equal((await listen(n))[0].set_id, n1.set_id, 'r4: G.expires_at − v_now ≥ L → reuse');
      await capIn(n1.set_id, L_MS - 50);
      assert.equal((await listen(n))[0].generation, 2, 'r4: G.expires_at − v_now < L → G + 1');
      // r4: E − v_now = a few ms → the request still makes generation 1 bounded by E.
      const o = await listener();
      await sourceEndsIn(o.recording, 400);
      const [o1] = await listen(o);
      assert.equal(o1.generation, 1);
      assert.ok(num(o1.readable_for_ms) <= 400, 'readable_for_ms never exceeds the time to E');
    });

    await report.isolated('V31r5 / V12 / V14 not ready before E: heartbeat and completion refuse (SOURCE_UNAVAILABLE); readable before E, never at or after it; retention unchanged', async () => {
      const l = await listener();
      const retention0 = await retentionOf(l.recording);
      const [a] = await listen(l);
      await makeReady(a.set_id);
      await sourceEndsIn(l.recording, 1500);
      const [{ e }] = await rows('SELECT retention_expires_at e FROM voice_private.recordings WHERE id = $1', [l.recording]);
      let lastReadable = null;
      let refusedAt = null;
      for (let i = 0; i < 400 && refusedAt === null; i += 1) {
        const r = await readOf(l.user, a.artifact_id);
        if (r.length === 1) {
          assert.ok(r[0].serve_until.getTime() <= e.getTime(), 'serve_until never passes E');
          lastReadable = r[0].db_now;
        } else {
          refusedAt = (await rows('SELECT clock_timestamp() t'))[0].t;
        }
        await sleep(5);
      }
      assert.ok(lastReadable && refusedAt, 'the file was readable, then refused');
      assert.ok(lastReadable.getTime() <= e.getTime(), 'V-14: every successful read happened before E');
      assert.ok(refusedAt.getTime() >= e.getTime(), 'V-14: refused at E');
      assert.ok(e.getTime() - lastReadable.getTime() < 100, `V-14: readable until close to E (${e.getTime() - lastReadable.getTime()} ms)`);
      const status = await checkOf(l.user, a.artifact_id);
      assert.deepEqual([status.readable, status.job_state, num(status.readable_for_ms)], [false, 'EXPIRED', 0],
        'V-12: refused at once, with no sweep run');
      // r5: a job not READY before E.
      const m = await listener();
      const [b] = await listen(m);
      const [job] = await claimSet(b.set_id);
      await sourceEndsIn(m.recording, 300);
      await sleep(400);
      assert.equal((await tm('SELECT public.server_heartbeat_transient_media_job_v1($1, $2) AS ok', [job.id, job.lease_id]))[0].ok, false,
        'r5: the heartbeat refuses');
      const bRow = (await artifactsOf(m.user))[0];
      assert.deepEqual([bRow.job_state, bRow.failure_class], ['FAILED', 'SOURCE_UNAVAILABLE']);
      const [{ due }] = await rows('SELECT due_at <= clock_timestamp() due FROM voice_private.transient_media_erasures WHERE storage_key = $1',
        [bRow.storage_key]);
      assert.equal(due, true, 'erasure due');
      const n = await listener();
      const [c] = await listen(n);
      const [job2] = await claimSet(c.set_id);
      await sourceEndsIn(n.recording, 200);
      await sleep(300);
      assert.equal((await tm(`SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o`,
        [job2.id, job2.lease_id, job2.expected_duration_ms, DIGEST('a')]))[0].o, 'FAILED', 'r5: the completion refuses');
      assert.equal((await artifactsOf(n.user))[0].failure_class, 'SOURCE_UNAVAILABLE');
      assert.deepEqual(await readOf(n.user, c.artifact_id), [], 'a read after E is refused');
      // Retention: only the fixture surgery above moved it; no definer did.
      const p = await listener();
      const r0 = await retentionOf(p.recording);
      const [d] = await listen(p);
      await makeReady(d.set_id);
      await readOf(p.user, d.artifact_id);
      await checkOf(p.user, d.artifact_id);
      await releaseOf(p.user, d.artifact_id);
      await sweep();
      assert.equal(await retentionOf(p.recording), r0, 'V-14: request, completion, read, release and sweep leave retention unchanged');
      assert.ok(retention0);
    });

    await report.isolated('V01 owner-exact: another person reaches nothing at any definer', async () => {
      const l = await listener();
      const B = await human();
      const [a] = await listen(l);
      await makeReady(a.set_id);
      const r = await threeRunReplay();
      await rejected(() => request(B, 'LISTENING', l.call), ['P0002']);
      await rejected(() => request(B, 'REPLAY_PLAYBACK', r.version), ['P0002']);
      assert.deepEqual(await readOf(B, a.artifact_id), []);
      assert.deepEqual(await tm('SELECT * FROM public.server_check_transient_media_v1($1, $2)', [B, a.artifact_id]), []);
      assert.deepEqual(await releaseOf(B, a.artifact_id), []);
      assert.deepEqual(await tm('SELECT * FROM public.server_read_transient_media_map_v1($1, $2, $3)', [B, r.replay, r.version]), []);
      assert.equal((await readOf(l.user, a.artifact_id)).length, 1, 'the owner still reads');
      assert.deepEqual(await service('SELECT * FROM public.server_read_session_finished_calls_v2($1, $2, NULL, NULL)', [B, l.session]), []);
    });

    await report.isolated('Replay: one artifact per RUN with the plan\'s presented length; the map without recordings; the job reads only its run and only intersecting segments (C-B4)', async () => {
      const r = await threeRunReplay();
      const set = await request(r.user, 'REPLAY_PLAYBACK', r.version);
      assert.deepEqual(set.map((x) => [x.run_ordinal, x.generation, x.job_state, num(x.expected_duration_ms)]),
        THREE_RUN_EXPECTED.map((ms, i) => [i + 1, 1, 'PENDING', ms]), 'L-6: one file per run; a held interval over 3 s presents 1.5 s');
      const [{ e }] = await rows('SELECT min(retention_expires_at) e FROM voice_private.recordings WHERE id = ANY($1::uuid[])',
        [[r.note, r.c1.recording, r.c2.recording]]);
      assert.ok((await artifactsOf(r.user)).every((a) => a.expires_at <= e), 'every run is bounded by the earliest recording');
      const map = await tm('SELECT * FROM public.server_read_transient_media_map_v1($1, $2, $3)', [r.user, r.replay, r.version]);
      assert.deepEqual([...new Set(map.filter((m) => m.row_kind === 'RUN').map((m) => m.run_ordinal))], [1, 2, 3]);
      assert.ok(map.filter((m) => ['TEXT', 'BOUNDARY'].includes(m.row_kind)).every((m) => m.run_ordinal === null));
      assert.deepEqual(map.filter((m) => m.row_kind === 'BOUNDARY').map((m) => m.boundary_kind), ['CROSS_RECORDING', 'CROSS_RECORDING']);
      assert.deepEqual(await tm('SELECT * FROM public.server_read_transient_media_map_v1($1, $2, $3)', [r.user, randomUUID(), r.version]), [],
        'another Replay id → nothing');
      const jobs = await claimSet(set[0].set_id);
      assert.equal(jobs.length, 3);
      const inputs = await tm('SELECT * FROM public.server_read_transient_media_job_v1($1, $2)', [jobs[1].id, jobs[1].lease_id]);
      const [head] = inputs.filter((x) => x.entry === 'JOB');
      assert.deepEqual([head.owner_kind, head.generation, num(head.expected_duration_ms), num(head.clock_start_ms), num(head.clock_end_ms)],
        ['REPLAY_PLAYBACK', 1, 9500, 1000, 25000]);
      await owner();
      const runKeys = new Set((await rows(`SELECT storage_key FROM voice_private.recording_objects WHERE recording_id = $1
                                             AND ((track = 'USER' AND segment_index IN (0, 2)) OR (track = 'QANDEEL' AND segment_index = 0))`,
      [r.c1.recording])).map((x) => x.storage_key));
      const named = inputs.filter((x) => x.entry === 'SEGMENT').map((x) => x.storage_key);
      assert.deepEqual(new Set(named), runKeys,
        'C-B4: only segments intersecting an AUDIBLE span (USER 0 and 2, QANDEEL 0); USER [4000, 9000) and QANDEEL [30000, 40000) never named');
      assert.deepEqual(inputs.filter((x) => x.entry === 'HELD').map((x) => num(x.elapsed_ms)), [16000]);
      assert.ok(inputs.filter((x) => x.entry === 'MIX').length === 1);
      const noteJob = await tm('SELECT * FROM public.server_read_transient_media_job_v1($1, $2)', [jobs[0].id, jobs[0].lease_id]);
      assert.deepEqual(noteJob.filter((x) => x.entry === 'SEGMENT').map((x) => x.track), ['NOTE'], 'run 1 names only the note');
      assert.deepEqual(await tm('SELECT * FROM public.server_read_transient_media_job_v1($1, $2)', [jobs[0].id, randomUUID()]), [],
        'another lease reads nothing');
      // Listening: every stored USER / QANDEEL segment and gap, the clock end as the length.
      const l = await listener();
      const [la] = await listen(l);
      const [lj] = await claimSet(la.set_id);
      const li = await tm('SELECT * FROM public.server_read_transient_media_job_v1($1, $2)', [lj.id, lj.lease_id]);
      assert.deepEqual([li.filter((x) => x.entry === 'SEGMENT').length, li.filter((x) => x.entry === 'GAP').length,
        num(li.find((x) => x.entry === 'JOB').expected_duration_ms)], [3, 1, 6000]);
      // A failed run fails its set whole (a complete set or nothing).
      assert.equal((await tm(`SELECT public.server_fail_transient_media_job_v1($1, $2, 'DECODE_FAILED', 1, 1, 1, 1) AS ok`,
        [jobs[2].id, jobs[2].lease_id]))[0].ok, true);
      assert.deepEqual((await artifactsOf(r.user)).map((a) => [a.job_state, a.failure_class]),
        [['FAILED', 'DECODE_FAILED'], ['FAILED', 'DECODE_FAILED'], ['FAILED', 'DECODE_FAILED']]);
      const [{ due }] = await rows(`SELECT bool_and(e.due_at <= clock_timestamp()) due FROM voice_private.transient_media_artifacts a
          JOIN voice_private.transient_media_erasures e ON e.storage_key = a.storage_key WHERE a.user_id = $1`, [r.user]);
      assert.equal(due, true, 'V-11: erasure due at once');
    });

    await report.isolated('V11/V15 completion length check; lease lapse re-claimed; three attempts then TIME_CAP; a bad class is refused', async () => {
      const l = await listener();
      const [a] = await listen(l);
      let [job] = await claimSet(a.set_id);
      assert.equal((await tm(`SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o`,
        [job.id, job.lease_id, Number(job.expected_duration_ms) + 44, DIGEST('a')]))[0].o, 'FAILED', 'a length off by 44 ms fails');
      assert.equal((await artifactsOf(l.user))[0].failure_class, 'LENGTH_MISMATCH');
      const m = await listener();
      const [b] = await listen(m);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        [job] = await claimSet(b.set_id);
        assert.ok(job, `attempt ${attempt} is claimed`);
        await q("UPDATE voice_private.transient_media_artifacts SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1", [job.id]);
        assert.equal((await tm('SELECT public.server_heartbeat_transient_media_job_v1($1, $2) AS ok', [job.id, job.lease_id]))[0].ok, false,
          'a lapsed lease refuses its heartbeat');
      }
      await tm('SELECT * FROM public.server_claim_transient_media_jobs_v1(25)');
      const row = (await artifactsOf(m.user))[0];
      assert.deepEqual([row.job_state, row.failure_class, row.attempts], ['FAILED', 'TIME_CAP', 3], 'after 3 attempts the job fails');
      await rejected(() => tm(`SELECT public.server_fail_transient_media_job_v1($1, $2, 'BUSY', 1, 1, 1, 1)`, [job.id, job.lease_id]), ['22023']);
      await rejected(() => tm('SELECT * FROM public.server_claim_transient_media_jobs_v1(26)'), ['22023'], /TRANSIENT_REQUEST_INVALID/u);
      await rejected(() => sweep(101), ['22023']);
    });

    await report.isolated('Backpressure: ≤ 2 sets in preparation per person, ≤ 32 pending sets, otherwise BUSY (nothing kept)', async () => {
      const A = await human();
      const session = await newSession(A);
      const calls = [];
      for (let i = 0; i < 3; i += 1) calls.push((await callRecording(A, session, TWO_TRACKS)).call);
      await request(A, 'LISTENING', calls[0]);
      await request(A, 'LISTENING', calls[1]);
      await rejected(() => request(A, 'LISTENING', calls[2]), ['P0001'], /BUSY/u);
      assert.equal((await ledgerOf(A)).length, 2, 'the refused request kept no ledger row');
      await q("UPDATE voice_private.transient_media_policy SET pending_sets_max = 2");
      const B = await listener();
      await rejected(() => listen(B), ['P0001'], /BUSY/u);
    });

    await report.isolated('V26 the finished-call read v2: PREPARING, AVAILABLE with its deadline, UNAVAILABLE with a PROVEN reason only', async () => {
      const A = await human();
      const session = await newSession(A);
      const stored = await callRecording(A, session, TWO_TRACKS);
      const preparing = await callRecording(A, session, TWO_TRACKS, { state: 'RECORDING' });
      const owned = await callRecording(A, session, TWO_TRACKS);
      const erased = await callRecording(A, session, TWO_TRACKS);
      const expired = await callRecording(A, session, TWO_TRACKS);
      const clockExpired = await callRecording(A, session, TWO_TRACKS);
      await owner();
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE voice_private.recordings SET recording_state = 'DELETED', deleted_reason = 'OWNER', terminal_at = clock_timestamp() WHERE id = $1`, [owned.recording]);
      await q(`UPDATE voice_private.recordings SET recording_state = 'DELETED', deleted_reason = 'ACCOUNT_ERASURE', terminal_at = clock_timestamp() WHERE id = $1`, [erased.recording]);
      await q(`UPDATE voice_private.recordings SET recording_state = 'EXPIRED', terminal_at = clock_timestamp() WHERE id = $1`, [expired.recording]);
      await q("SET LOCAL session_replication_role = 'origin'");
      await sourceEndsIn(clockExpired.recording, -1000);
      const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
      const never = await fixtureCall(q, rows, { id: randomUUID(), user: A, session, startedAt: t });
      await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
                 seat_lease_until = NULL WHERE id = $1`, [never]);
      const got = Object.fromEntries((await service('SELECT * FROM public.server_read_session_finished_calls_v2($1, $2, NULL, NULL)', [A, session]))
        .map((r) => [r.call_id, [r.recording_status, r.available_until === null ? null : 'SET', r.unavailable_reason]]));
      assert.deepEqual(got[stored.call], ['AVAILABLE', 'SET', null]);
      assert.deepEqual(got[preparing.call], ['PREPARING', null, null]);
      assert.deepEqual(got[owned.call], ['UNAVAILABLE', null, 'DELETED'], 'DELETED only for the owner\'s deletion');
      assert.deepEqual(got[erased.call], ['UNAVAILABLE', null, null], 'an account erasure is not a proven DELETED');
      assert.deepEqual(got[expired.call], ['UNAVAILABLE', null, 'EXPIRED']);
      assert.deepEqual(got[clockExpired.call], ['UNAVAILABLE', null, 'EXPIRED'], 'a clock-expired STORED recording is EXPIRED');
      assert.deepEqual(got[never], ['UNAVAILABLE', null, null], 'never stored → no reason');
      const v1 = await service('SELECT * FROM public.server_read_session_finished_calls_v1($1, $2, NULL, NULL)', [A, session]);
      assert.equal(v1.length, 7, 'v1 is unchanged and returns the same calls');
      const [{ until }] = await rows('SELECT retention_expires_at until FROM voice_private.recordings WHERE id = $1', [stored.recording]);
      const [row] = (await service('SELECT * FROM public.server_read_session_finished_calls_v2($1, $2, NULL, NULL)', [A, session]))
        .filter((r) => r.call_id === stored.call);
      assert.equal(row.available_until.getTime(), until.getTime(), 'available_until is the recording\'s own expiry');
    });

    await report.isolated('V34 no start during a live call; after the call ends and the recording is sealed: PREPARING then AVAILABLE, then allowed', async () => {
      const A = await human();
      const session = await newSession(A);
      const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
      const call = await fixtureCall(q, rows, { id: randomUUID(), user: A, session, startedAt: t });
      const rec = randomUUID();
      await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                 recording_state, writer_lease_until) VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days',
                 'RECORDING', clock_timestamp() + interval '1 minute')`, [rec, A, session, call, t]);
      await rejected(() => request(A, 'LISTENING', call), ['P0002'], /TRANSIENT_NOT_AVAILABLE/u);
      await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
                 seat_lease_until = NULL WHERE id = $1`, [call]);
      const status = async () => (await service('SELECT * FROM public.server_read_session_finished_calls_v2($1, $2, NULL, NULL)', [A, session]))
        .find((r) => r.call_id === call).recording_status;
      assert.equal(await status(), 'PREPARING');
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE voice_private.recordings SET recording_state = 'STORED', sealed_by = 'WRITER', writer_lease_until = NULL WHERE id = $1`, [rec]);
      await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                 byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
               VALUES ($1, 'USER', 0, $2, 'STORED', 'audio/ogg', 1000, 0, 2000, clock_timestamp(), clock_timestamp())`, [rec, `voice-call/${randomUUID()}`]);
      await q("SET LOCAL session_replication_role = 'origin'");
      assert.equal(await status(), 'AVAILABLE');
      assert.equal((await request(A, 'LISTENING', call)).length, 1, 'allowed once the call ended');
      // With another call live, the person's requests are refused, and nothing is created.
      const live = await fixtureCall(q, rows, { id: randomUUID(), user: A, session, startedAt: new Date().toISOString() });
      await rejected(() => request(A, 'LISTENING', call), ['P0001'], /LIVE_CALL_ACTIVE/u);
      await q("UPDATE voice_private.calls SET state = 'RECONNECTING', grace_until = clock_timestamp() + interval '10 seconds' WHERE id = $1", [live]);
      await rejected(() => request(A, 'LISTENING', call), ['P0001'], /LIVE_CALL_ACTIVE/u);
      assert.equal((await artifactsOf(A)).length, 1);
    });

    await report.isolated('V27 erasure timetable: cap, source end, release; the reaper and the watchdog backstop; an outage marks erasure_late_at once', async () => {
      const l = await listener();
      const [a] = await listen(l);
      await makeReady(a.set_id);
      // Early deletion: reads refused at once, due at the deletion's own instant once swept.
      await service('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [l.user, l.recording]);
      assert.deepEqual(await readOf(l.user, a.artifact_id), [], 'refused at once');
      const s = await sweep();
      assert.ok(s.expired >= 1, 'the sweep expires it');
      const [row] = await artifactsOf(l.user);
      const [{ terminal }] = await rows('SELECT terminal_at terminal FROM voice_private.recordings WHERE id = $1', [l.recording]);
      assert.deepEqual([row.job_state, row.due_at.getTime()], ['EXPIRED', terminal.getTime()], 'due_at = the deletion\'s terminal instant');
      // The reaper claims it; the watchdog's backstop (overdue 120 s) does not yet.
      assert.deepEqual(await tm('SELECT * FROM public.server_claim_transient_media_erasures_v1(100, 120)'), [], 'not yet past erase_by');
      const claimed = await tm('SELECT * FROM public.server_claim_transient_media_erasures_v1(100, 0)');
      const mine = claimed.find((c) => c.storage_key === row.storage_key);
      assert.ok(mine, 'the reaper claims the due key');
      assert.equal((await tm('SELECT public.server_complete_transient_media_erasure_v1($1, $2) AS ok', [mine.storage_key, mine.lease_id]))[0].ok, true);
      assert.ok((await artifactsOf(l.user))[0].erased_at, 'erased_at recorded after DELETE + HEAD 404');
      // A live file's key is never claimed, and the cap is the default due instant.
      const m = await listener();
      const [b] = await listen(m);
      await makeReady(b.set_id);
      const bRow = (await artifactsOf(m.user))[0];
      assert.equal(bRow.expires_at.getTime() - bRow.created_at.getTime(), CAP_MS, 'expires_at = created_at + 58 min');
      assert.ok(!(await tm('SELECT * FROM public.server_claim_transient_media_erasures_v1(100, 0)')).some((c) => c.storage_key === bRow.storage_key));
      // Outage: due long ago, never erased → erasure_late_at once, still due, the backstop retries.
      await capIn(b.set_id, -1);
      await sweep();
      await q("UPDATE voice_private.transient_media_erasures SET due_at = clock_timestamp() - interval '5 minutes' WHERE storage_key = $1", [bRow.storage_key]);
      const s1 = await sweep();
      const late1 = (await artifactsOf(m.user))[0].erasure_late_at;
      assert.ok(s1.late_marked >= 1 && late1, 'erasure_late_at set when erase_by is missed');
      const s2 = await sweep();
      assert.equal((await artifactsOf(m.user))[0].erasure_late_at.getTime(), late1.getTime(), 'set once');
      assert.ok(s2.late_outstanding >= 1, 'still outstanding (TRANSIENT_ERASURE_LATE every cycle)');
      const backstop = await tm('SELECT * FROM public.server_claim_transient_media_erasures_v1(100, 120)');
      assert.ok(backstop.some((c) => c.storage_key === bRow.storage_key), 'the watchdog\'s backstop claims it');
      assert.deepEqual(await readOf(m.user, b.artifact_id), [], 'reads stay refused');
      await rejected(() => q("UPDATE voice_private.transient_media_erasures SET due_at = due_at + interval '1 second' WHERE storage_key = $1", [bRow.storage_key]),
        ['42501'], /TRANSIENT_MEDIA_IMMUTABLE/u);
      await rejected(() => q("UPDATE voice_private.transient_media_artifacts SET expires_at = expires_at + interval '1 second' WHERE id = $1", [b.artifact_id]),
        ['42501'], /TRANSIENT_MEDIA_IMMUTABLE/u);
    });

    await report.isolated('V13 account erasure: the rows leave with the account, each key due at once; reads refused from the due instant', async () => {
      const l = await listener();
      const [a] = await listen(l);
      await makeReady(a.set_id);
      const [{ storage_key: key }] = await artifactsOf(l.user);
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
               VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second')`, [l.user]);
      assert.deepEqual(await readOf(l.user, a.artifact_id), [], 'refused once the account erasure is due');
      await q('DELETE FROM voice_private.transient_media_requests WHERE user_id = $1', [l.user]);
      await q('DELETE FROM voice_private.transient_media_artifacts WHERE user_id = $1', [l.user]);
      const [{ due }] = await rows('SELECT due_at <= clock_timestamp() AS due FROM voice_private.transient_media_erasures WHERE storage_key = $1', [key]);
      assert.equal(due, true, 'the removed artifact\'s key is due at once in the Replay erasure ledger');
      const [{ cascades }] = await rows(`SELECT bool_and(confdeltype = 'c') cascades FROM pg_constraint WHERE contype = 'f'
          AND conrelid IN ('voice_private.transient_media_artifacts'::regclass, 'voice_private.transient_media_requests'::regclass)`);
      assert.equal(cascades, true, 'the account row removes both (ON DELETE CASCADE, registered ACCOUNT_CASCADE)');
    });

    await report.isolated('V36 heartbeats and health: content-free ages and counts; the sweep runs with no pool', async () => {
      const pool = randomUUID();
      const watch = randomUUID();
      await tm('SELECT public.server_beat_transient_media_pool_v1($1, $2)', [pool, 'REPLAY_MEDIA']);
      await tm('SELECT public.server_beat_transient_media_pool_v1($1, $2)', [watch, 'REPLAY_WATCHDOG']);
      await rejected(() => tm("SELECT public.server_beat_transient_media_pool_v1($1, 'API')", [randomUUID()]), ['22023']);
      const l = await listener();
      await listen(l);
      const [h] = await tm('SELECT * FROM public.server_read_transient_media_health_v1()');
      assert.deepEqual(Object.keys(h), ['oldest_pending_age_ms', 'pending_over_60s', 'pool_heartbeat_age_ms', 'watchdog_heartbeat_age_ms',
        'erasures_due', 'erasures_late']);
      assert.ok(num(h.pool_heartbeat_age_ms) >= 0 && num(h.pool_heartbeat_age_ms) < 5000);
      assert.ok(num(h.oldest_pending_age_ms) >= 0);
      await q("UPDATE voice_private.replay_pool_heartbeats SET seen_at = clock_timestamp() - interval '10 minutes'");
      const [stale] = await tm('SELECT * FROM public.server_read_transient_media_health_v1()');
      assert.ok(num(stale.pool_heartbeat_age_ms) >= 600_000 && num(stale.watchdog_heartbeat_age_ms) >= 600_000,
        'a dead pool and a dead watchdog read as stale heartbeats (the dead-man input)');
      assert.ok(await sweep(), 'the sweep runs with no pool instance alive');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ R: committed fixtures, separate connections released together
const clients = [];
async function poolClients(n) {
  while (clients.length < n) {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query(`SET ROLE ${POOL}`);
    await c.query("SET lock_timeout = '30s'");
    clients.push(c);
  }
  return clients.slice(0, n);
}
/** Every call blocks on the ledger behind one lock, then all are released at once. */
async function together(n, call) {
  const cs = await poolClients(n);
  await owner();
  await q('BEGIN');
  await q('LOCK TABLE voice_private.transient_media_requests IN SHARE ROW EXCLUSIVE MODE');
  const runs = cs.map((c, i) => call(c, i).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e })));
  for (let t = 0; t < 400; t += 1) {
    const [{ n: waiting }] = await rows(`SELECT count(*)::int n FROM pg_stat_activity WHERE datname = current_database()
                                           AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`);
    if (waiting >= n) break;
    await sleep(10);
  }
  await q('COMMIT');
  return Promise.all(runs);
}
const req = (c, user, kind, ref, command) => c.query('SELECT * FROM public.server_request_transient_media_v1($1, $2, $3, $4)',
  [user, kind, ref, command]).then((r) => r.rows);
async function committed(fn) {
  await owner();
  await q('BEGIN');
  try { const v = await fn(); await q('COMMIT'); return v; } catch (error) { await q('ROLLBACK'); throw error; }
}

async function verifyRace(report, humans) {
  const listenerCommitted = () => committed(async () => { const l = await listener(); humans.push(l.user); return l; });
  const readyCommitted = (set, pcm) => committed(() => makeReady(set, pcm));

  await report.section('V31b the same command from 16 connections → one ledger row, one artifact, the same id for every caller, no error', async () => {
    const l = await listenerCommitted();
    const command = randomUUID();
    const out = await together(16, (c) => req(c, l.user, 'LISTENING', l.call, command));
    assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.e.message), [], 'no error escapes');
    assert.equal(new Set(out.map((o) => o.v[0].artifact_id)).size, 1);
    assert.equal((await ledgerOf(l.user)).length, 1);
    assert.equal((await artifactsOf(l.user)).length, 1);
  });

  await report.section('V31c 16 different commands for one subject → exactly one live set; every ledger row points to it', async () => {
    const l = await listenerCommitted();
    const out = await together(16, (c) => req(c, l.user, 'LISTENING', l.call, randomUUID()));
    assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.e.message), []);
    const sets = new Set((await ledgerOf(l.user)).map((r) => r.set_id));
    assert.equal(sets.size, 1, 'one set');
    assert.equal((await artifactsOf(l.user)).length, 1, 'one artifact');
    assert.equal(new Set(out.map((o) => o.v[0].set_id)).size, 1);
  });

  let replay = null;
  await report.section('V31d / q a Replay of n runs from 16 connections → exactly n artifacts, ordinals 1..n once; the race for generation 2 → n rows of generation 2, no partial set', async () => {
    const A = await committed(() => human());
    humans.push(A);
    replay = await committed(() => threeRunReplay(A));
    const command = randomUUID();
    const out = await together(16, (c) => req(c, replay.user, 'REPLAY_PLAYBACK', replay.version, command));
    assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.e.message), []);
    const rowsNow = await artifactsOf(replay.user);
    assert.deepEqual(rowsNow.map((a) => a.run_ordinal), [1, 2, 3], 'd: n artifacts, ordinals 1..n once each');
    await readyCommitted(rowsNow[0].set_id);
    await committed(() => capIn(rowsNow[0].set_id, L_MS - 1000));
    const race = await together(16, (c) => req(c, replay.user, 'REPLAY_PLAYBACK', replay.version, randomUUID()));
    assert.deepEqual(race.filter((o) => !o.ok).map((o) => o.e.message), []);
    const g2 = (await artifactsOf(replay.user)).filter((a) => a.generation === 2);
    assert.deepEqual(g2.map((a) => a.run_ordinal), [1, 2, 3], 'q: exactly n rows of generation 2');
    assert.equal(new Set(g2.map((a) => a.set_id)).size, 1, 'q: one set, no partial set');
    assert.equal(new Set(race.map((o) => o.v[0].set_id)).size, 1, 'every caller got generation 2\'s set');
  });

  await report.section('V31e (race) one command id for two kinds at once → exactly one succeeds; the other COMMAND_REUSED, nothing returned', async () => {
    const l = await listenerCommitted();
    const r = await committed(() => threeRunReplay(l.user));
    const command = randomUUID();
    const out = await together(2, (c, i) => (i === 0 ? req(c, l.user, 'LISTENING', l.call, command)
      : req(c, l.user, 'REPLAY_PLAYBACK', r.version, command)));
    assert.equal(out.filter((o) => o.ok).length, 1, 'exactly one succeeds');
    const [loser] = out.filter((o) => !o.ok);
    assert.equal(loser.e.message, 'COMMAND_REUSED');
    assert.equal((await ledgerOf(l.user)).length, 1);
  });

  await report.section('V31l / m at L − 1 s: 16 different commands → exactly one generation 2; the same command from 16 → one ledger row, one set', async () => {
    const l = await listenerCommitted();
    const [g1] = await committed(() => listen(l));
    await readyCommitted(g1.set_id);
    await committed(() => capIn(g1.set_id, L_MS - 1000));
    const out = await together(16, (c) => req(c, l.user, 'LISTENING', l.call, randomUUID()));
    assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.e.message), []);
    const g2 = (await artifactsOf(l.user)).filter((a) => a.generation === 2);
    assert.equal(g2.length, 1, 'l: exactly one generation 2');
    assert.ok((await ledgerOf(l.user)).slice(1).every((r) => r.set_id === g2[0].set_id), 'l: every new ledger row points to it');
    const m = await listenerCommitted();
    const [h1] = await committed(() => listen(m));
    await readyCommitted(h1.set_id);
    await committed(() => capIn(h1.set_id, L_MS - 1000));
    const command = randomUUID();
    const same = await together(16, (c) => req(c, m.user, 'LISTENING', m.call, command));
    assert.deepEqual(same.filter((o) => !o.ok).map((o) => o.e.message), []);
    assert.equal((await ledgerOf(m.user)).length, 2, 'm: one new ledger row');
    assert.equal((await artifactsOf(m.user)).length, 2, 'm: one new set');
  });

  await report.section('V31n a lost answer: the commit happened; the same command → the same set; a new command → reuse of generation 2', async () => {
    const l = await listenerCommitted();
    const [g1] = await committed(() => listen(l));
    await readyCommitted(g1.set_id);
    await committed(() => capIn(g1.set_id, L_MS - 1000));
    const command = randomUUID();
    const [c] = await poolClients(1);
    const lost = await req(c, l.user, 'LISTENING', l.call, command);
    void lost; // the client "never saw" this answer
    assert.equal((await req(c, l.user, 'LISTENING', l.call, command))[0].set_id, lost[0].set_id, 'the same command → the same set');
    const fresh = await req(c, l.user, 'LISTENING', l.call, randomUUID());
    assert.deepEqual([fresh[0].set_id, fresh[0].generation], [lost[0].set_id, 2], 'a new command reuses generation 2');
  });

  await report.section('V31r2 G ends in 1 min, the source in 3 min → one generation G + 1 with expires_at = E; then 16 concurrent → reuse, no third', async () => {
    const l = await listenerCommitted();
    const [g1] = await committed(() => listen(l));
    await readyCommitted(g1.set_id);
    await committed(async () => { await sourceEndsIn(l.recording, 180_000); await capIn(g1.set_id, 60_000); });
    const [g2] = await committed(() => listen(l));
    assert.equal(g2.generation, 2);
    const [{ ok }] = await rows(`SELECT a.expires_at = r.retention_expires_at ok FROM voice_private.transient_media_artifacts a
                                   JOIN voice_private.recordings r ON r.id = $2 WHERE a.id = $1`, [g2.artifact_id, l.recording]);
    assert.equal(ok, true, 'expires_at = E');
    const out = await together(16, (c) => req(c, l.user, 'LISTENING', l.call, randomUUID()));
    assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.e.message), []);
    assert.ok(out.every((o) => o.v[0].set_id === g2.set_id), 'every caller reuses G + 1 (it covers the source)');
    assert.deepEqual(await liveGenerations(l.user), [1, 2], 'no third generation');
  });

  // V31p / t: 1000 random rounds over several connections; the invariants after every step.
  const property = async (label, nearEnd) => {
    const l = await listenerCommitted();
    let seed = nearEnd ? 7331 : 1337;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const cs = await poolClients(4);
    const commands = [];
    let retention = await retentionOf(l.recording);
    const counts = { request: 0, retry: 0, release: 0, advance: 0, read: 0, sweep: 0, ready: 0, refused: 0, served: 0 };
    if (nearEnd) {
      await committed(() => sourceEndsIn(l.recording, Math.floor(rand() * (L_MS + 120_000)) + 1000));
      retention = await retentionOf(l.recording);
    }
    for (let round = 0; round < 1000; round += 1) {
      const c = cs[Math.floor(rand() * cs.length)];
      const x = rand();
      const [{ before }] = await rows('SELECT clock_timestamp() AS before');
      try {
        if (x < 0.35) {
          const command = randomUUID();
          const got = await req(c, l.user, 'LISTENING', l.call, command);
          commands.push(command);
          counts.request += 1;
          await owner();
          const set = await rows('SELECT created_at, expires_at FROM voice_private.transient_media_artifacts WHERE set_id = $1', [got[0].set_id]);
          for (const s of set) if (s.created_at < before) assert.ok(s.expires_at > before, `${label}: never a reuse of a row with expires_at ≤ v_now`);
        } else if (x < 0.45 && commands.length > 0) {
          await req(c, l.user, 'LISTENING', l.call, commands[Math.floor(rand() * commands.length)]);
          counts.retry += 1;
        } else if (x < 0.55) {
          const [live] = await rows(`SELECT id FROM voice_private.transient_media_artifacts WHERE user_id = $1
                                       AND job_state IN ('PENDING', 'RUNNING', 'READY') ORDER BY random() LIMIT 1`, [l.user]);
          if (live) await c.query('SELECT * FROM public.server_release_transient_media_v1($1, $2)', [l.user, live.id]);
          counts.release += 1;
        } else if (x < 0.72) {
          const ms = Math.floor(rand() * 20 * 60_000);
          await committed(async () => {
            await q(`UPDATE voice_private.transient_media_artifacts SET expires_at = greatest(created_at + interval '1 millisecond',
                expires_at - make_interval(secs => $2::double precision / 1000)) WHERE user_id = $1`, [l.user, ms]);
            if (nearEnd) {
              // The source's end comes closer by the same amount; once passed, a new end is drawn inside the last L + 2 min.
              await q("SET LOCAL session_replication_role = 'replica'");
              await q(`UPDATE voice_private.recordings SET retention_expires_at = retention_expires_at - make_interval(secs => $2::double precision / 1000),
                         started_at = started_at - make_interval(secs => $2::double precision / 1000) WHERE id = $1`, [l.recording, ms]);
              await q("SET LOCAL session_replication_role = 'origin'");
              const [{ past }] = await rows('SELECT retention_expires_at <= clock_timestamp() AS past FROM voice_private.recordings WHERE id = $1', [l.recording]);
              if (past && rand() < 0.5) await sourceEndsIn(l.recording, Math.floor(rand() * (L_MS + 120_000)) + 1000);
            }
          });
          retention = await retentionOf(l.recording);
          counts.advance += 1;
        } else if (x < 0.82) {
          const [any] = await rows(`SELECT id FROM voice_private.transient_media_artifacts WHERE user_id = $1
                                       ORDER BY (job_state = 'READY') DESC, random() LIMIT 1`, [l.user]);
          if (any) {
            const r = (await c.query('SELECT * FROM public.server_read_transient_media_v1($1, $2)', [l.user, any.id])).rows;
            if (r.length === 1) {
              counts.served += 1;
              const [{ e }] = await rows('SELECT retention_expires_at e FROM voice_private.recordings WHERE id = $1', [l.recording]);
              assert.ok(r[0].db_now < e && r[0].serve_until <= e, `${label}: no file is read at or after E`);
            }
          }
          counts.read += 1;
        } else if (x < 0.9) {
          await c.query('SELECT * FROM public.server_sweep_transient_media_v1(100)');
          counts.sweep += 1;
        } else {
          const claimed = (await c.query('SELECT * FROM public.server_claim_transient_media_jobs_v1(25)')).rows;
          for (const j of claimed) {
            const [{ expected }] = await rows('SELECT expected_duration_ms expected FROM voice_private.transient_media_artifacts WHERE id = $1', [j.job_id]);
            await c.query('SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1)', [j.job_id, j.lease_id, expected, DIGEST('a')]);
          }
          counts.ready += 1;
        }
      } catch (error) {
        if (!/BUSY|TRANSIENT_NOT_AVAILABLE/u.test(error.message)) throw error;
        counts.refused += 1;
      }
      await owner();
      assert.ok((await liveGenerations(l.user)).length <= 2, `${label}: ≤ 2 live generations after round ${round}`);
      assert.equal(await retentionOf(l.recording), retention, `${label}: retention_expires_at unchanged`);
    }
    console.log(`0196 ${label} rounds: ${JSON.stringify(counts)}`);
    assert.ok(counts.request > 200 && counts.advance > 100, `${label}: the rounds exercised requests and clock moves`);
  };
  await report.section('V31p property: 1000 random rounds of requests, retries, releases, reads, sweeps, completions and clock moves', () => property('p', false));
  await report.section('V31t property with E inside the last L + 2 min: the same invariants, and no file read after E', () => property('t', true));

  await report.section('V13 two sessions: a completion holding the recording FOR SHARE serializes the owner\'s deletion; deleted first → the completion fails closed', async () => {
    const l = await listenerCommitted();
    const [a] = await committed(() => listen(l));
    const [job] = await committed(() => claimSet(a.set_id));
    const [c] = await poolClients(1);
    const second = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await second.connect();
    try {
      await c.query('BEGIN');
      const done = (await c.query('SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o',
        [job.id, job.lease_id, job.expected_duration_ms, DIGEST('a')])).rows[0].o;
      assert.equal(done, 'READY');
      await second.query("SET lock_timeout = '700ms'");
      await second.query('SET ROLE service_role');
      // `second` runs in autocommit, so its refused statement aborts no transaction: only its SQLSTATE is read.
      let blocked = await codeOf(second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [l.user, l.recording]));
      assert.equal(blocked, '55P03', 'the deletion waits for the completion (FOR SHARE held until it commits)');
      await c.query('COMMIT');
      const [{ outcome }] = (await second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [l.user, l.recording])).rows;
      assert.equal(outcome, 'DELETED');
      assert.deepEqual((await c.query('SELECT * FROM public.server_read_transient_media_v1($1, $2)', [l.user, a.artifact_id])).rows, [],
        'the READY file is refused at once after the deletion');
      // Deleted first: the completion fails closed.
      const m = await listenerCommitted();
      const [b] = await committed(() => listen(m));
      const [job2] = await committed(() => claimSet(b.set_id));
      await second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [m.user, m.recording]);
      const late = (await c.query('SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o',
        [job2.id, job2.lease_id, job2.expected_duration_ms, DIGEST('a')])).rows[0].o;
      assert.equal(late, 'FAILED');
      assert.equal((await artifactsOf(m.user))[0].failure_class, 'SOURCE_UNAVAILABLE');
      // A Replay run: its completion locks the version's bound recordings FOR SHARE (0195 H's pattern, inline).
      const A = await committed(() => human());
      humans.push(A);
      const r = await committed(() => threeRunReplay(A));
      const set = await committed(() => request(A, 'REPLAY_PLAYBACK', r.version));
      const jobs = await committed(() => claimSet(set[0].set_id));
      await c.query('BEGIN');
      const run1 = (await c.query('SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o',
        [jobs[0].id, jobs[0].lease_id, jobs[0].expected_duration_ms, DIGEST('a')])).rows[0].o;
      assert.equal(run1, 'READY');
      blocked = await codeOf(second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, r.c2.recording]));
      assert.equal(blocked, '55P03', 'a deletion of any recording the version binds waits for the Replay completion');
      await c.query('COMMIT');
      await second.query('SELECT * FROM public.server_delete_voice_recording_v1($1, $2)', [A, r.c2.recording]);
      const run2 = (await c.query('SELECT public.server_complete_transient_media_job_v1($1, $2, 1000, $3, $4, 1, 1, 1, 1) AS o',
        [jobs[1].id, jobs[1].lease_id, jobs[1].expected_duration_ms, DIGEST('a')])).rows[0].o;
      assert.equal(run2, 'FAILED', 'after the deletion the version is no longer CURRENT: the next run fails closed');
      assert.deepEqual((await c.query('SELECT * FROM public.server_read_transient_media_v1($1, $2)', [A, jobs[0].id])).rows, [],
        'and the READY run is refused at once');
    } finally {
      await c.query('ROLLBACK').then(() => undefined, () => undefined);
      await second.end();
    }
  });
}

async function removeRaceFixtures(humans) {
  if (humans.length === 0) return;
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q(`DELETE FROM voice_private.transient_media_erasures WHERE storage_key IN
               (SELECT storage_key FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[]))`, [humans]);
    await q('DELETE FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.transient_media_requests WHERE user_id = ANY($1::uuid[])', [humans]);
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

runVerifier('0196', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0196', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  const humans = [];
  setStage('race');
  try {
    await verifyRace(report, humans);
  } finally {
    setStage('teardown');
    for (const c of clients.splice(0)) await c.end().catch(() => undefined);
    await removeRaceFixtures(humans);
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.transient_media_artifacts WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.transient_media_requests WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM replay_private.replay_launch_capability_states) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
