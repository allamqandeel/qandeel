// Real-PostgreSQL verifier for migration 0205 (INTEL-LIVE-01 CP3: the Replay read of a live call's provisional attention,
// Lane B, under the Product Owner's CP3 authorisation and D-CP3 of 2026-11-26). No provider is called. The world (people,
// Sessions, calls, recordings, Replays) is COMMITTED, as 0202's verifier builds it; every attention row is written inside
// a scenario's own rolled-back transaction. Every committed fixture person is removed at the end THROUGH the account
// erasure itself.
//
//   C  catalogue     the read: a postgres-owned STABLE definer, the Replay pool's only, writes nothing, reads no wall
//                    clock or transaction id as a time, adds no relation
//   A  acceptance
//      A-01  no attention: the VERSION row alone, bound to the version, its revision and its source window digest
//      A-02  the in-speech progression: every SET / WITHDRAW at its server-PRODUCED position inside the turn, never at
//            its anchor, never deferred to the end of the turn; corrections and withdrawals in event_seq order
//      A-03  per track: an event whose words lie in no presented window of its OWN track is not returned
//      A-04  hold and tail: a position inside a held interval is kept (the media service maps its elapsed offset); a
//            tail produced after the speech end is placed there
//      A-05  a position after every run of its own recording is AFTER_END, never pulled into a run or another call
//      A-06  settlements: at the settlement's source-order position; one of an unreturned SET is not returned; no window:
//            AFTER_END
//      A-07  C10: an event of a non-DEVELOPMENTS evaluation is never returned
//      A-08  calls: ranked by their first presented run; a call of another Session is never read
//      A-09  owner, Replay identity and role isolation: zero rows, indistinguishable
//      A-10  deletion: a deleted recording or a due account erasure answers zero rows
//      A-11  a V1 (text-only) version: the VERSION row alone, no binding digest
//      A-12  the read writes nothing and sees no uncommitted row
//   D  planted defects of the read, each refused by the canonical check that proves the rule
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import pg from 'pg';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { fixtureCall } from './live-call-0189-anchor.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows } = rt;

const MIGRATION = '0205_intel_live_01_replay_attention_read_v1.sql';
const READ = 'public.server_read_replay_version_attention_v1(uuid,uuid,uuid)';
const POOL = 'qandeel_replay_media';
const CLIENT_ROLES = ['anon', 'authenticated', 'service_role'];

const fixtureHumans = [];
const erasedHumans = new Set();
/** The storage keys each governed erasure of a fixture human released to the shared erasure queue (see removeFixtures). */
const releasedKeys = [];

// ------------------------------------------------------------------ transaction and role helpers
async function tx(work) {
  await q('BEGIN');
  try {
    const result = await work();
    await q('COMMIT');
    return result;
  } catch (error) {
    await q('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
async function asRoleLocal(role, work) {
  await q(`SET LOCAL ROLE ${role}`);
  try { return await work(); } finally { await q('RESET ROLE').catch(() => undefined); }
}
async function refused(operation, codes) {
  await q('SAVEPOINT refusal');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT refusal');
    await q('RELEASE SAVEPOINT refusal');
  }
  assert.ok(error, 'the operation was unexpectedly admitted');
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
}
/** The read, as the Replay pool's own role, inside the caller's open transaction. */
const attention = (user, replay, version) => asRoleLocal(POOL, () =>
  rows(`SELECT entry, replay_id, replay_version_id, replay_version_revision, source_window_binding_digest, call_ordinal,
               event_seq::int AS event_seq, track, op, subject_key, label, kind, confidence, thread_ref, anchor_run_ordinal,
               anchor_clock_ms::int AS anchor_clock_ms, floor_basis, floor_placement, floor_run_ordinal, floor_clock_ms::int AS floor_clock_ms
          FROM public.server_read_replay_version_attention_v1($1, $2, $3)`, [user, replay, version]));
/** The comparable shape of the EVENT rows: [call, seq, track, op, subject, anchor run, anchor clock, basis, placement, run, clock]. */
const shape = (answer) => answer.filter((r) => r.entry === 'EVENT').map((r) => [r.call_ordinal, r.event_seq, r.track, r.op, r.subject_key,
  r.anchor_run_ordinal, r.anchor_clock_ms, r.floor_basis, r.floor_placement, r.floor_run_ordinal, r.floor_clock_ms]);

// ------------------------------------------------------------------ the committed world (0202's world A)
async function human() {
  const id = randomUUID();
  await tx(() => rt.provisionHumans([id]));
  fixtureHumans.push(id);
  return id;
}
async function newSession(user) {
  const id = randomUUID();
  await tx(() => q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [id, user]));
  return id;
}
/** A sealed, ENDED call with one stored segment per listed track: { recording, call }. */
async function callRecording(user, session, tracks) {
  return tx(async () => {
    const id = randomUUID();
    const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
    const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
    await q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
               seat_lease_until = NULL WHERE id = $1`, [call]);
    await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
               recording_state, sealed_by)
             VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
    [id, user, session, call, t]);
    for (const [track, [a, b]] of Object.entries(tracks)) {
      await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                 byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
               VALUES ($1, $2, 0, $3, 'STORED', 'audio/ogg', 1000, $4, $5, clock_timestamp(), clock_timestamp())`,
      [id, track, `voice-call/${randomUUID()}`, a, b]);
    }
    return { recording: id, call };
  });
}
/** One turn of one unit, committed in its own transaction. */
async function commitTurn(user, session, role, voice = null) {
  return tx(async () => {
    const [{ sp: before }] = await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp', [session]);
    const sp = Number(before) + 1;
    const turn = randomUUID();
    const batch = randomUUID();
    const content = `turn at ${sp}`;
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`,
      [turn, session, user, role, content]);
    await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
               source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
               segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, user, session, turn, Buffer.from(`${session}:${turn}`)]);
    if (voice) {
      const assistant = role === 'ASSISTANT';
      await q(`INSERT INTO public.conversation_turn_voice_sources
                 (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
                  anchor_start_ms, anchor_end_ms, spoken, delivery_state)
               VALUES ($1, $2, $3, $4, 'LIVE_CALL_SPEECH', $5, $6, $7, $8, $9, $10, $11)`,
      [turn, user, session, role, assistant ? null : 'MACHINE_ASR', assistant ? null : 'HIGH', voice.recording, voice.a, voice.b,
        assistant ? true : null, assistant ? 'COMPLETE' : null]);
    }
    await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
               source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'RESOLVED', $6, 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
    [user, session, turn, batch, role, voice ? 'LIVE_CALL_SPEECH' : 'TEXT', [...content].length, content, sp]);
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
    return sp;
  });
}
async function replayOf(user, session, first, last) {
  return tx(async () => {
    await rt.setGate();
    const created = await rt.create(user, randomUUID(), session, first, last);
    assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
    const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
    assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the draft previews (${previewed.outcome})`);
    return { replay: created.replay_id, version: previewed.replay_version_id, revision: Number(previewed.replay_version_revision) };
  });
}

/**
 * World A (0202's): one Session, two calls, one text turn.
 *   SP1 USER c1 [1000, 3000) · SP2 QANDEEL c1 [3000, 6000) · SP3 USER c1 [20000, 24000) · SP4 text · SP5 USER c2 [1000, 4000)
 * The Replay selects SP1..SP5: run 1 = c1 [1000, 24000) (a held 14 s interval [6000, 20000) inside), the text item, run 2 =
 * c2 [1000, 4000).
 */
async function worldA() {
  const user = await human();
  const session = await newSession(user);
  const c1 = await callRecording(user, session, { USER: [0, 30000], QANDEEL: [0, 30000] });
  const c2 = await callRecording(user, session, { USER: [0, 10000] });
  await commitTurn(user, session, 'USER', { recording: c1.recording, a: 1000, b: 3000 });
  await commitTurn(user, session, 'ASSISTANT', { recording: c1.recording, a: 3000, b: 6000 });
  await commitTurn(user, session, 'USER', { recording: c1.recording, a: 20000, b: 24000 });
  await commitTurn(user, session, 'ASSISTANT');
  await commitTurn(user, session, 'USER', { recording: c2.recording, a: 1000, b: 4000 });
  await commitTurn(user, session, 'ASSISTANT');
  const r = await replayOf(user, session, 1, 5);
  return { user, session, c1, c2, ...r };
}

// ------------------------------------------------------------------ attention rows (inside the scenario's transaction)
const THREAD = '5b0c1f7e-2a3d-4c5e-8f90-1a2b3c4d5e6f';
/**
 * World A's attention, as the 0204 writer and settlement would leave it: [seq, track, op, subject, anchor, evidence, produced,
 * outcome] for producer events (one evaluation each), then the settlements.
 */
const PRODUCER = [
  [1, 'USER', 'SET', 'manager', 1200, 1600, 1700],
  [2, 'USER', 'SET', 'trip', 1900, 2300, 2400],
  [3, 'USER', 'SET', 'manager', 2500, 2700, 2800],        // a correction of subject 1
  [4, 'USER', 'WITHDRAW', 'trip', 2600, 2900, 2950],
  [5, 'USER', 'SET', 'tail', 2800, 2990, 3400],           // the tail: produced after the user's speech end (3000)
  [6, 'USER', 'SET', 'held', 2900, 2990, 10000],          // produced inside the held interval [6000, 20000)
  [7, 'QANDEEL', 'SET', 'reply', 3500, 4000, 4100],       // QANDEEL's own words, in its window
  [8, 'QANDEEL', 'SET', 'nowin', 1500, 1800, 1900],       // QANDEEL anchored where only the USER track is presented: out
  [9, 'USER', 'SET', 'unheard', 4000, 4200, 4300],        // USER anchored in QANDEEL's window only: out
  [10, 'USER', 'SET', 'late', 21000, 23500, 25000],       // produced after run 1 (ends 24000): AFTER_END
];
async function insertAttention(w, { staleSeq = null } = {}) {
  for (const [seq, track, op, subject, anchor, evidence, produced] of PRODUCER) {
    const outcome = seq === staleSeq ? 'STALE_RESULT' : 'DEVELOPMENTS';
    await q(`INSERT INTO voice_private.call_attention_evaluations (call_id, eval_seq, user_id, session_id, connection_epoch, track,
               covers_from_clock_ms, covers_to_clock_ms, outcome, admitted_clock_ms, produced_clock_ms, produced_at)
             VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, clock_timestamp())`,
    [w.c1.call, seq, w.user, w.session, track, seq * 10, evidence, outcome, evidence, produced]);
    await q(`INSERT INTO voice_private.call_attention_events (call_id, event_seq, user_id, session_id, track, op, subject_key, label, kind,
               confidence, thread_ref, eval_seq, anchor_clock_ms, evidence_clock_ms, produced_clock_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TOPIC', 'HIGH', $9, $2, $10, $11, $12)`,
    [w.c1.call, seq, w.user, w.session, track, op, subject, `L ${subject}`, seq === 3 ? THREAD : null, anchor, evidence, produced]);
  }
  // Turn 1 settled through 3600: subject "manager" CONFIRMED (its SET 3), "nowin" EXPIRED (its SET 8 is not presented);
  // turn 2 abandoned (no window): subject "tail" EXPIRED.
  await q(`INSERT INTO voice_private.call_attention_settlements (call_id, track, call_turn_index, user_id, half_state, window_start_ms,
             window_end_ms, settled_through_clock_ms, confirmed, expired)
           VALUES ($1, 'USER', 1, $2, 'COMPLETE', 1000, 3000, 3600, 1, 0), ($1, 'QANDEEL', 1, $2, 'COMPLETE', 3000, 6000, 6500, 0, 1),
                  ($1, 'USER', 2, $2, 'ABANDONED_INTEGRITY', NULL, NULL, NULL, 0, 1)`, [w.c1.call, w.user]);
  const settle = [[11, 'CONFIRMED', 'manager', 3, 1, 'USER', THREAD], [12, 'EXPIRED', 'nowin', 8, 1, 'QANDEEL', null], [13, 'EXPIRED', 'tail', 5, 2, 'USER', null]];
  for (const [seq, op, subject, settles, turn, track, ref] of settle) {
    await q(`INSERT INTO voice_private.call_attention_events (call_id, event_seq, user_id, session_id, track, op, subject_key, label, kind,
               confidence, thread_ref, settles_event_seq, call_turn_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TOPIC', 'HIGH', $9, $10, $11)`,
    [w.c1.call, seq, w.user, w.session, track, op, subject, `L ${subject}`, ref, settles, turn]);
  }
  // The second call: one SET in its own window.
  await q(`INSERT INTO voice_private.call_attention_evaluations (call_id, eval_seq, user_id, session_id, connection_epoch, track,
             covers_from_clock_ms, covers_to_clock_ms, outcome, admitted_clock_ms, produced_clock_ms, produced_at)
           VALUES ($1, 1, $2, $3, 1, 'USER', 1000, 1800, 'DEVELOPMENTS', 1800, 2000, clock_timestamp())`, [w.c2.call, w.user, w.session]);
  await q(`INSERT INTO voice_private.call_attention_events (call_id, event_seq, user_id, session_id, track, op, subject_key, label, kind,
             confidence, thread_ref, eval_seq, anchor_clock_ms, evidence_clock_ms, produced_clock_ms)
           VALUES ($1, 1, $2, $3, 'USER', 'SET', 'second', 'L second', 'TOPIC', 'HIGH', NULL, 1, 1500, 1800, 2000)`, [w.c2.call, w.user, w.session]);
}

/** Every returned event of world A, in order. */
const EXPECTED = [
  [1, 1, 'USER', 'SET', 'manager', 1, 1200, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 1700],
  [1, 2, 'USER', 'SET', 'trip', 1, 1900, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 2400],
  [1, 3, 'USER', 'SET', 'manager', 1, 2500, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 2800],
  [1, 4, 'USER', 'WITHDRAW', 'trip', 1, 2600, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 2950],
  [1, 5, 'USER', 'SET', 'tail', 1, 2800, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 3400],
  [1, 6, 'USER', 'SET', 'held', 1, 2900, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 10000],
  [1, 7, 'QANDEEL', 'SET', 'reply', 1, 3500, 'PRODUCED_POSITION', 'IN_RECORDING', 1, 4100],
  [1, 10, 'USER', 'SET', 'late', 1, 21000, 'PRODUCED_POSITION', 'AFTER_END', null, null],
  [1, 11, 'USER', 'CONFIRMED', 'manager', 1, null, 'SETTLED_THROUGH', 'IN_RECORDING', 1, 3600],
  [1, 13, 'USER', 'EXPIRED', 'tail', 1, null, 'SETTLED_THROUGH', 'AFTER_END', null, null],
  [2, 1, 'USER', 'SET', 'second', 2, 1500, 'PRODUCED_POSITION', 'IN_RECORDING', 2, 2000],
];

// ------------------------------------------------------------------ canonical checks (also the planted-defect detectors)
async function checkProgression(w) {
  await insertAttention(w);
  const got = shape(await attention(w.user, w.replay, w.version));
  assert.deepEqual(got, EXPECTED, 'every event at its produced (or settled) position, in (call, event_seq) order');
  for (const e of got.filter((r) => r[7] === 'PRODUCED_POSITION' && r[8] === 'IN_RECORDING')) {
    assert.ok(e[10] > e[6], `event ${e[1]} is placed after its own words, never at its anchor`);
  }
  const inTurn = got.filter((r) => r[0] === 1 && r[1] <= 4).map((r) => r[10]);
  assert.deepEqual(inTurn, [1700, 2400, 2800, 2950], 'the in-speech progression keeps its own positions inside the turn (never deferred to its end, 3000)');
}
async function checkTrack(w) {
  await insertAttention(w);
  const got = shape(await attention(w.user, w.replay, w.version));
  assert.ok(!got.some((r) => r[4] === 'nowin' || r[4] === 'unheard'), 'an event outside every presented window of its own track is not returned');
  assert.ok(got.some((r) => r[2] === 'QANDEEL' && r[4] === 'reply'), "QANDEEL's own event in its own window is returned");
}
async function checkRunEnd(w) {
  await insertAttention(w);
  const late = shape(await attention(w.user, w.replay, w.version)).find((r) => r[4] === 'late');
  assert.deepEqual(late.slice(8), ['AFTER_END', null, null], 'a position after every run of its own recording is AFTER_END');
}
async function checkCoverage(w) {
  await insertAttention(w, { staleSeq: 2 });
  const got = shape(await attention(w.user, w.replay, w.version));
  assert.ok(!got.some((r) => r[0] === 1 && r[1] === 2), 'an event of a STALE_RESULT evaluation is never returned (C10)');
  assert.equal(got.length, EXPECTED.length - 1);
}
async function checkSession(w, otherSession) {
  await insertAttention(w);
  await q("SET LOCAL session_replication_role = 'replica'");
  await q('UPDATE voice_private.calls SET session_id = $2 WHERE id = $1', [w.c2.call, otherSession]);
  await q("SET LOCAL session_replication_role = 'origin'");
  const got = shape(await attention(w.user, w.replay, w.version));
  assert.ok(!got.some((r) => r[4] === 'second'), "a call of another Session is never read");
}
async function checkOwner(w, stranger, t) {
  await insertAttention(w);
  assert.deepEqual(await attention(stranger, t.replay, t.version), [], 'a stranger reads nothing of a V1 version');
  assert.deepEqual(await attention(stranger, w.replay, w.version), [], 'a stranger reads nothing');
  assert.deepEqual(await attention(w.user, randomUUID(), w.version), [], 'another Replay id reads nothing');
  assert.deepEqual(await attention(w.user, w.replay, randomUUID()), [], 'an unknown version reads nothing');
}

// ------------------------------------------------------------------ C: catalogue
async function verifyCatalogue(report) {
  await q('BEGIN');
  try {
    await report.isolated('C-01 the read is a postgres-owned STABLE definer pinned to an empty search_path; it writes nothing and reads no wall clock or transaction id', async () => {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.provolatile AS v, p.proconfig AS cfg,
          p.prosrc AS src FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [READ]);
      assert.ok(p, `${READ} exists`);
      assert.deepEqual([p.owner, p.definer, p.v, p.cfg], ['postgres', true, 's', ['search_path=""']]);
      assert.doesNotMatch(p.src, /EXCEPTION\s+WHEN|\bEXECUTE\b|40001|40P01|PT409/u, 'no handler, dynamic SQL or retryable SQLSTATE');
      assert.doesNotMatch(p.src, /INSERT\s+INTO|\bUPDATE\s|DELETE\s+FROM/iu, 'writes nothing');
      assert.doesNotMatch(p.src, /recorded_at|produced_at|xact_id|settled_at|clock_timestamp|now\(\)/u, 'no wall clock and no transaction id is read as a time');
    });
    await report.isolated("C-02 the read is the Replay pool's only; no client role executes it; a missing argument is refused", async () => {
      const [g] = await rows(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS read`, [POOL, READ]);
      assert.deepEqual(g, { read: true });
      for (const role of CLIENT_ROLES) {
        await refused(() => asRoleLocal(role, () => q('SELECT * FROM public.server_read_replay_version_attention_v1($1, $2, $3)',
          [randomUUID(), randomUUID(), randomUUID()])), ['42501']);
      }
      await refused(() => attention(null, randomUUID(), randomUUID()), ['22023']);
    });
    await report.isolated('C-03 0205 adds no relation: the Replay census stays 36 and no voice_private relation is new', async () => {
      const tables = await rows(`SELECT c.oid::regclass::text rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND ((n.nspname = 'public' AND c.relname ~ '^replay') OR n.nspname = 'replay_private')`);
      assert.equal(tables.length, 36, 'the Replay relation census (the 0169 census query)');
      const text = readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').replace(/^\s*--.*$/gmu, '');
      assert.doesNotMatch(text, /CREATE\s+(TABLE|INDEX|VIEW|TYPE|SEQUENCE|TRIGGER|POLICY)|ALTER\s+TABLE/iu, '0205 creates no relation and alters none');
      assert.equal([...text.matchAll(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/giu)].length, 1, '0205 creates exactly one function and replaces none');
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
}

// ------------------------------------------------------------------ A: acceptance (rolled back over the committed world)
async function verifyAcceptance(report, world) {
  const { a: w, stranger, otherSession, t } = world;
  await q('BEGIN');
  try {
    await report.isolated('A-01 no attention: the VERSION row alone, bound to the version, its revision and its source window digest', async () => {
      const answer = await attention(w.user, w.replay, w.version);
      const [binding] = await rows(`SELECT v.replay_id, v.id, v.replay_version_revision AS rev, c.source_window_binding_digest AS digest
          FROM public.replay_versions v JOIN public.replay_render_contract_versions c ON c.id = v.render_contract_version_id WHERE v.id = $1`, [w.version]);
      assert.equal(answer.length, 1);
      assert.deepEqual([answer[0].entry, answer[0].replay_id, answer[0].replay_version_id, answer[0].replay_version_revision, answer[0].source_window_binding_digest],
        ['VERSION', binding.replay_id, binding.id, binding.rev, binding.digest]);
      assert.match(binding.digest, /^sha256:/u);
    });
    await report.isolated('A-02 the in-speech progression at the produced positions, never at an anchor, corrections and withdrawals in order', async () => {
      await checkProgression(w);
      const answer = await attention(w.user, w.replay, w.version);
      assert.equal(answer[0].entry, 'VERSION', 'the VERSION row first');
      for (const r of answer) assert.deepEqual([r.replay_id, r.replay_version_id, r.replay_version_revision], [w.replay, w.version, w.revision], 'every row carries the binding');
      const ev = answer.find((r) => r.event_seq === 3 && r.call_ordinal === 1);
      assert.deepEqual([ev.label, ev.kind, ev.confidence, ev.thread_ref], ['L manager', 'TOPIC', 'HIGH', THREAD], "0204's row, unchanged");
    });
    await report.isolated('A-03 per track: an event outside every presented window of its own track is not returned', () => checkTrack(w));
    await report.isolated('A-04 hold and tail: a position inside a held interval is kept; a tail produced after speech end is placed there', async () => {
      await insertAttention(w);
      const got = shape(await attention(w.user, w.replay, w.version));
      assert.deepEqual(got.find((r) => r[4] === 'held').slice(8), ['IN_RECORDING', 1, 10000], 'the held position itself (the media service maps its elapsed offset)');
      assert.deepEqual(got.find((r) => r[4] === 'tail' && r[3] === 'SET').slice(8), ['IN_RECORDING', 1, 3400], 'the tail after the speech end (3000)');
    });
    await report.isolated('A-05 after every run of its own recording: AFTER_END, never in a run or another call', () => checkRunEnd(w));
    await report.isolated("A-06 settlements at their source-order position; one of an unreturned SET is not returned; no window: AFTER_END", async () => {
      await insertAttention(w);
      const got = shape(await attention(w.user, w.replay, w.version));
      assert.deepEqual(got.filter((r) => r[7] === 'SETTLED_THROUGH'), EXPECTED.filter((r) => r[7] === 'SETTLED_THROUGH'));
      assert.ok(!got.some((r) => r[4] === 'nowin'), 'the settlement of an unreturned SET is not returned');
    });
    await report.isolated('A-07 C10: an event of a non-DEVELOPMENTS evaluation is never returned', () => checkCoverage(w));
    await report.isolated('A-08a calls are ranked by their first presented run', async () => {
      await insertAttention(w);
      const got = shape(await attention(w.user, w.replay, w.version));
      assert.deepEqual([...new Set(got.map((r) => r[0]))], [1, 2]);
    });
    await report.isolated('A-08b a call of another Session is never read', () => checkSession(w, otherSession));
    await report.isolated('A-09 a stranger, another Replay id and an unknown version read zero rows, indistinguishably', () => checkOwner(w, stranger, t));
    await report.isolated('A-10a a deleted call recording answers zero rows', async () => {
      await insertAttention(w);
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE voice_private.recordings SET recording_state = 'DELETED', deleted_reason = 'OWNER', terminal_at = clock_timestamp()
                WHERE id = $1`, [w.c2.recording]);
      await q("SET LOCAL session_replication_role = 'origin'");
      assert.deepEqual(await attention(w.user, w.replay, w.version), []);
    });
    await report.isolated('A-10b a due account erasure answers zero rows', async () => {
      await insertAttention(w);
      await q(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
               VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 second')`, [w.user]);
      assert.deepEqual(await attention(w.user, w.replay, w.version), []);
    });
    await report.isolated('A-11 a V1 (text-only) version: the VERSION row alone, no binding digest', async () => {
      const answer = await attention(t.user, t.replay, t.version);
      assert.equal(answer.length, 1);
      assert.deepEqual([answer[0].entry, answer[0].source_window_binding_digest, answer[0].replay_version_id], ['VERSION', null, t.version]);
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
  await report.section('A-12 the read writes nothing and sees no uncommitted attention row', async () => {
    const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await other.connect();
    try {
      await other.query('BEGIN');
      await other.query(`INSERT INTO voice_private.call_attention_evaluations (call_id, eval_seq, user_id, session_id, connection_epoch, track,
               covers_from_clock_ms, covers_to_clock_ms, outcome, admitted_clock_ms, produced_clock_ms, produced_at)
             VALUES ($1, 1, $2, $3, 1, 'USER', 1000, 1600, 'DEVELOPMENTS', 1600, 1700, clock_timestamp())`, [w.c1.call, w.user, w.session]);
      await other.query(`INSERT INTO voice_private.call_attention_events (call_id, event_seq, user_id, session_id, track, op, subject_key, label,
               kind, confidence, eval_seq, anchor_clock_ms, evidence_clock_ms, produced_clock_ms)
             VALUES ($1, 1, $2, $3, 'USER', 'SET', 'pending', 'L pending', 'TOPIC', 'HIGH', 1, 1200, 1600, 1700)`, [w.c1.call, w.user, w.session]);
      await q('BEGIN');
      try {
        assert.equal((await attention(w.user, w.replay, w.version)).length, 1, 'an uncommitted event is invisible');
      } finally {
        await q('ROLLBACK').catch(() => undefined);
      }
      await other.query('ROLLBACK');
    } finally {
      await other.end().catch(() => undefined);
    }
    const fresh = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await fresh.connect();
    try {
      await fresh.query('BEGIN');
      await fresh.query(`SET LOCAL ROLE ${POOL}`);
      const read = await fresh.query('SELECT * FROM public.server_read_replay_version_attention_v1($1, $2, $3)', [w.user, w.replay, w.version]);
      assert.equal(read.rows.length, 1);
      const [{ x }] = (await fresh.query('SELECT pg_current_xact_id_if_assigned()::text AS x')).rows;
      assert.equal(x, null, 'a transaction that only read was assigned no transaction id: the read wrote nothing');
      await fresh.query('ROLLBACK');
    } finally {
      await fresh.end().catch(() => undefined);
    }
  });
}

// ------------------------------------------------------------------ D: planted defects of the read
async function verifyPlantedDefects(report, world) {
  const { a: w, stranger, otherSession, t } = world;
  const [{ d: pristine }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) AS d', [READ]);
  const apply = (sql) => q(sql);
  await q('BEGIN');
  try {
    const defects = [
      ['D-01 the floor taken at the anchor', (s) => s.replace('pr.produced_clock_ms AS position', 'pr.anchor_clock_ms AS position'), () => checkProgression(w)],
      ['D-02 the own-track window rule removed', (s) => s.replace('AND w.tr = e.track ', ''), () => checkTrack(w)],
      ['D-03 a position after the run end pulled into the run', (s) => s.replace('AND ru.b > x.position', ''), () => checkRunEnd(w)],
      ['D-04 a non-DEVELOPMENTS evaluation admitted', (s) => s.replace("AND ev.outcome = 'DEVELOPMENTS'", ''), () => checkCoverage(w)],
      ['D-05 a call of another Session admitted', (s) => s.replace('AND c.session_id = v_session ', ''), () => checkSession(w, otherSession)],
      ['D-06 the owner check removed', (s) => s.replace('AND r.created_by_user_id = p_user_id', ''), () => checkOwner(w, stranger, t)],
    ];
    for (const [name, mutate, check] of defects) {
      await report.isolated(`C-${name.slice(0, 4)} canonical control passes`, check);
      await report.probe(name, { pristine, mutate, apply, reject: check });
    }
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
}

// ------------------------------------------------------------------ fixture removal through the account erasure itself
async function erase(user) {
  await tx(async () => {
    const released = (await rows(`SELECT o.storage_key FROM voice_private.recording_objects o
        JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.user_id = $1`, [user])).map((r) => r.storage_key);
    const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
    const outcome = await asRoleLocal('service_role', async () => (await rows('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]))[0].outcome);
    assert.equal(outcome, 'ERASED');
    releasedKeys.push(...released);
  });
  erasedHumans.add(user);
}
async function removeFixtures() {
  await q('ROLLBACK').catch(() => undefined);
  await q('RESET ROLE').catch(() => undefined);
  for (const user of fixtureHumans) if (!erasedHumans.has(user)) await erase(user);
  // As verify-0202: each governed erasure queued its storage keys in the shared erasure queue; their objects never existed,
  // so the fixture discharges exactly those rows.
  const keys = [...releasedKeys].sort();
  const queued = await rows(`SELECT storage_key FROM introduction_sharing_private.media_erasure_queue
     WHERE storage_key = ANY($1::text[]) ORDER BY storage_key COLLATE "C"`, [keys]);
  assert.deepEqual(queued.map((r) => r.storage_key), keys, 'every governed erasure queued each storage key it released');
  await tx(async () => {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [keys]);
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [fixtureHumans]);
  });
  await rt.removeFixtureHumans(fixtureHumans);
  await rt.resetGate();
}

runVerifier('0205', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  assert.ok(readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').includes('server_read_replay_version_attention_v1'));
  const report = createScenarioReport('0205', { query: q, restore: async () => { await q('RESET ROLE').catch(() => undefined); } });
  try {
    setStage('C catalogue');
    await verifyCatalogue(report);
    setStage('world');
    const world = {};
    world.a = await worldA();
    world.stranger = await human();
    world.otherSession = await newSession(world.a.user);
    {
      const user = await human();
      const session = await newSession(user);
      for (const role of ['USER', 'ASSISTANT', 'USER']) await commitTurn(user, session, role);
      world.t = { user, ...(await replayOf(user, session, 1, 2)) };
    }
    setStage('A acceptance');
    await verifyAcceptance(report, world);
    setStage('D planted defects');
    await verifyPlantedDefects(report, world);
  } finally {
    setStage('fixture removal');
    await removeFixtures();
  }
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
