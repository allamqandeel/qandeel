// Real-PostgreSQL verifier for migration 0202 (S8B-07 RB-2 / S3: the Replay historical availability read, under the
// Product Owner's execution authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct Historical Binding" of
// 2026-11-24, CP1). No provider is called. The world (people, Sessions, calls, recordings, Replays) is COMMITTED, because
// the ledger (0201) writes one row per committing transaction; every scenario then runs in a transaction that is rolled
// back. Every committed fixture person is removed at the end THROUGH the account erasure itself.
//
// In 0202 the certification seam answers NULL (M-2 is 0203). The placement rules of the read are proven here with a
// PLANTED seam, installed inside the scenario's own rolled-back transaction: the planted seam certifies a ledger prefix
// at a capture position, exactly the contract 0203 fulfils with marks; 0203's verifier proves the marks themselves.
//
//   C  catalogue     the seam and the read: postgres-owned STABLE definers, the read to the Replay pool only
//   A  acceptance    the PO's historical-accuracy list as it applies to the read:
//      A-01  0202 alone: every moment RECORDED / AFTER_END, bound to its version, at the ledger watermark
//      A-02  a certified commit is placed at its certified position (in the run, at max(X, run start))
//      A-03  the completing row is the row that SEALS TC, never the projection's live-head sequence (conservative)
//      A-04  a certified position after every run of its recording is AFTER_END, never pulled back into a run
//      A-05  of several calls, the earliest PRESENTED placement wins; a call of another Session never certifies
//      A-06  an uncommitted / rolled-back commit never appears (MVCC), the read writes nothing
//      A-07  a chain gap fails closed (BROKEN); a missing completing row is BROKEN for that moment only
//      A-08  a deploy-boundary Session and a Session with no ledger are UNESTABLISHED for every moment
//      A-09  AFTER_END never moves backward: later commits, a later call and a re-read change no placement
//      A-10  a revised version is bound to its own identity and revision, never to the earlier one's
//      A-11  owner, Replay identity and role isolation: zero rows, indistinguishable; no client role executes it
//      A-12  a V1 version is ORDINAL_ONLY with no time claim
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

const MIGRATION = '0202_s8b_07_replay_historical_availability_v1.sql';
const READ = 'public.server_read_replay_version_availability_v1(uuid,uuid,uuid)';
const SEAM = 'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)';
const LEDGER = 'public.session_semantic_commit_instants';
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
const availability = (user, replay, version) => asRoleLocal(POOL, () =>
  rows(`SELECT replay_id, replay_version_id, replay_version_revision, source_window_binding_digest, ledger_through_sp,
               ledger_through_event_sequence::text AS ledger_seq, selected_ordinal, availability_state, placement, run_ordinal,
               clock_ms::text AS clock_ms
          FROM public.server_read_replay_version_availability_v1($1, $2, $3)`, [user, replay, version]));
/** [ordinal, state, placement, run, clock] per moment: the comparable shape of an answer. */
const shape = (answer) => answer.map((r) => [r.selected_ordinal, r.availability_state, r.placement, r.run_ordinal,
  r.clock_ms === null ? null : Number(r.clock_ms)]);

// ------------------------------------------------------------------ the committed world
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
/** A sealed, ENDED call with one stored segment per listed track, in the caller's transaction: { recording, call }. */
async function callRecordingIn(user, session, tracks) {
  {
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
  }
}
const callRecording = (user, session, tracks) => tx(() => callRecordingIn(user, session, tracks));
/**
 * One turn of one unit, committed in its OWN transaction (so the ledger records exactly one row for it), its clock moved
 * by the fixture's own UPDATE (the recorder of 0201 records it at COMMIT). `replica` moves it with ONLY the recorder
 * disabled for that one transaction (every other trigger fires): the clock of a Session that moved before 0201 existed.
 */
async function commitTurn(user, session, role, voice = null, { replica = false } = {}) {
  return tx(async () => {
    if (replica) await q('ALTER TABLE public.session_semantic_clocks DISABLE TRIGGER session_semantic_clocks_record_commit_instant');
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
    if (replica) await q('ALTER TABLE public.session_semantic_clocks ENABLE TRIGGER session_semantic_clocks_record_commit_instant');
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
const ledgerOf = (session) => rows(`SELECT from_sp, from_event_sequence::text AS from_seq, through_sp, through_event_sequence::text AS through_seq
  FROM ${LEDGER} WHERE session_id = $1 ORDER BY through_sp, through_event_sequence`, [session]);

/**
 * World A: one Session, two calls, one text turn.
 *   SP1 USER c1 [1000, 3000) · SP2 QANDEEL c1 [3000, 6000) · SP3 USER c1 [20000, 24000) · SP4 text · SP5 USER c2 [1000, 4000)
 *   · SP6 the tail (so SP5 is sealed). One ledger row per SP: rN = (N-1, s) → (N, s).
 * The Replay selects SP1..SP5: run 1 = c1 [1000, 24000) (a held 14 s interval inside), the text item, run 2 = c2 [1000, 4000).
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
  const ledger = await ledgerOf(session);
  assert.equal(ledger.length, 6, 'fixture: one ledger row per committed turn');
  const r = await replayOf(user, session, 1, 5);
  return { user, session, c1, c2, ledger, ...r };
}

// ------------------------------------------------------------------ the planted seam (rolled back with its scenario)
/** Installs a seam that certifies `plants` = [[call, through_sp, through_seq, x]]: the earliest x whose prefix covers. */
async function plantSeam(plants) {
  await q('CREATE TABLE public.rb2_s3_planted_certification (call uuid, sp integer, seq bigint, x bigint)');
  for (const [call, sp, seq, x] of plants) await q('INSERT INTO public.rb2_s3_planted_certification VALUES ($1, $2, $3, $4)', [call, sp, seq, x]);
  await q(`CREATE OR REPLACE FUNCTION voice_private.replay_call_certified_capture_ms_v1(
             p_call_id uuid, p_through_sp integer, p_through_event_sequence bigint)
           RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
             SELECT min(c.x) FROM public.rb2_s3_planted_certification c
              WHERE c.call = p_call_id AND (c.sp, c.seq) >= (p_through_sp, p_through_event_sequence) $$`);
}
const seqOf = (w, sp) => Number(w.ledger.find((r) => r.through_sp === sp).through_seq);

// ------------------------------------------------------------------ canonical checks (also the planted-defect detectors)
/** A-02 / A-03 / A-05: a full plant of world A, with the expected placement of every moment. */
async function checkPlacement(w) {
  const s = (sp) => seqOf(w, sp);
  await plantSeam([
    [w.c1.call, 2, s(2), 3500],   // r2 (seals SP1) certified in c1 at 3500
    [w.c1.call, 4, s(4), 22000],  // r3, r4 (seal SP2, SP3) at 22000
    [w.c2.call, 6, s(6), 2000],   // everything through r6 in c2 at 2000
  ]);
  const got = shape(await availability(w.user, w.replay, w.version));
  assert.deepEqual(got, [
    [1, 'RECORDED', 'IN_RECORDING', 1, 3500],   // c1 run 1 is presented before c2's run 2
    [2, 'RECORDED', 'IN_RECORDING', 1, 22000],
    [3, 'RECORDED', 'IN_RECORDING', 1, 22000],
    [4, 'RECORDED', 'IN_RECORDING', 2, 2000],   // r5 is not certified in c1, only in c2
    [5, 'RECORDED', 'IN_RECORDING', 2, 2000],
  ], 'every moment at its certified position, the earliest presented placement first');
}
/** A-03: certifying the row that ENDS at TC (not the one that seals it) places nothing. */
async function checkSealingRow(w) {
  await plantSeam([[w.c1.call, 1, seqOf(w, 1), 1500]]);
  const got = shape(await availability(w.user, w.replay, w.version));
  assert.deepEqual(got[0], [1, 'RECORDED', 'AFTER_END', null, null], 'the row ending at TC does not complete K(TC)');
  await q('DELETE FROM public.rb2_s3_planted_certification');
  await q('INSERT INTO public.rb2_s3_planted_certification VALUES ($1, 2, $2, 1500)', [w.c1.call, seqOf(w, 2)]);
  assert.deepEqual(shape(await availability(w.user, w.replay, w.version))[0], [1, 'RECORDED', 'IN_RECORDING', 1, 1500],
    'the sealing row completes it');
}
/** A-04: a position after every run of its recording is AFTER_END; a position before a run starts is the run start. */
async function checkRunEnd(w) {
  await plantSeam([[w.c1.call, 6, seqOf(w, 6), 25000], [w.c2.call, 2, seqOf(w, 2), 0]]);
  const got = shape(await availability(w.user, w.replay, w.version));
  assert.deepEqual(got[0], [1, 'RECORDED', 'IN_RECORDING', 2, 1000], 'c2 at 0 is placed at its run start, 1000');
  assert.deepEqual(got[4], [5, 'RECORDED', 'AFTER_END', null, null], 'c1 at 25000 is after run 1 (ends 24000): AFTER_END');
}
/** A-05: earliest PRESENTED placement wins over a smaller clock in a later run. */
async function checkEarliestPresented(w) {
  await plantSeam([[w.c1.call, 2, seqOf(w, 2), 23000], [w.c2.call, 2, seqOf(w, 2), 1200]]);
  assert.deepEqual(shape(await availability(w.user, w.replay, w.version))[0], [1, 'RECORDED', 'IN_RECORDING', 1, 23000]);
}
/** A-05: a call that is not of the version's Session never certifies. */
async function checkForeignSession(w, otherSession) {
  await plantSeam([[w.c2.call, 6, seqOf(w, 6), 2000]]);
  await q("SET LOCAL session_replication_role = 'replica'");
  await q('UPDATE voice_private.calls SET session_id = $2 WHERE id = $1', [w.c2.call, otherSession]);
  await q("SET LOCAL session_replication_role = 'origin'");
  const got = shape(await availability(w.user, w.replay, w.version));
  assert.ok(got.every((m) => m[2] === 'AFTER_END'), `a foreign Session's call certified something: ${JSON.stringify(got)}`);
}
/** A-07: a gap in the chain is BROKEN for every moment. */
async function checkGap(w) {
  await q("SET LOCAL session_replication_role = 'replica'");
  await q(`DELETE FROM ${LEDGER} WHERE session_id = $1 AND through_sp = 3`, [w.session]);
  await q("SET LOCAL session_replication_role = 'origin'");
  const got = shape(await availability(w.user, w.replay, w.version));
  assert.deepEqual(got.map((m) => m[1]), ['BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN'], 'a broken chain answers nothing');
  assert.ok(got.every((m) => m[2] === null && m[3] === null && m[4] === null), 'BROKEN carries no placement');
}
/** A-08: a deploy-boundary Session is UNESTABLISHED for every moment. */
async function checkBoundary(b) {
  const got = shape(await availability(b.user, b.replay, b.version));
  assert.ok(got.length > 0 && got.every((m) => m[1] === 'UNESTABLISHED' && m[2] === null), `deploy boundary: ${JSON.stringify(got)}`);
}
/** A-12: a V1 version (a text-only selection) carries no time claim. */
async function checkOrdinalOnly(t) {
  const [{ schema }] = await rows(`SELECT c.contract_schema_id AS schema FROM public.replay_versions v
      JOIN public.replay_render_contract_versions c ON c.id = v.render_contract_version_id WHERE v.id = $1`, [t.version]);
  assert.equal(schema, 'QANDEEL_REPLAY_RENDER_CONTRACT_V1', 'fixture: a text-only selection is a V1 version');
  const answer = await availability(t.user, t.replay, t.version);
  assert.deepEqual(shape(answer), [1, 2].map((k) => [k, 'ORDINAL_ONLY', null, null, null]));
  assert.ok(answer.every((r) => r.source_window_binding_digest === null));
}
/** A-11: another person, another Replay id: zero rows, indistinguishable — on a V2 and on a V1 version. */
async function checkOwner(w, stranger, t) {
  assert.deepEqual(await availability(stranger, t.replay, t.version), [], 'a stranger reads nothing of a V1 version');
  assert.deepEqual(await availability(stranger, w.replay, w.version), [], 'a stranger reads nothing');
  assert.deepEqual(await availability(w.user, randomUUID(), w.version), [], 'another Replay id reads nothing');
  assert.deepEqual(await availability(w.user, w.replay, randomUUID()), [], 'an unknown version reads nothing');
}

// ------------------------------------------------------------------ C: catalogue
async function verifyCatalogue(report) {
  await q('BEGIN');
  try {
    await report.isolated('C-01 the seam and the read are postgres-owned STABLE definers pinned to an empty search_path; nothing is written', async () => {
      for (const fn of [READ, SEAM]) {
        const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.provolatile AS v, p.proconfig AS cfg,
            p.prosrc AS src FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [fn]);
        assert.ok(p, `${fn} exists`);
        assert.deepEqual([p.owner, p.definer, p.v, p.cfg], ['postgres', true, 's', ['search_path=""']], fn);
        assert.doesNotMatch(p.src, /EXCEPTION\s+WHEN|\bEXECUTE\b|40001|40P01|PT409/u, `${fn}: no handler, dynamic SQL or retryable SQLSTATE`);
        assert.doesNotMatch(p.src, /observed_at|trigger_at/u, `${fn}: no wall clock of the ledger is read`);
        assert.doesNotMatch(p.src, /INSERT\s+INTO|\bUPDATE\s|DELETE\s+FROM/iu, `${fn}: writes nothing`);
      }
      assert.equal((await rows(`SELECT voice_private.replay_call_certified_capture_ms_v1(gen_random_uuid(), 1, 0) AS x`))[0].x, null,
        'in 0202 the seam certifies nothing');
    });
    await report.isolated('C-02 the read is the Replay pool\'s only; the seam is nobody\'s; no client role executes either', async () => {
      const [g] = await rows(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS read, has_function_privilege($1, $3, 'EXECUTE') AS seam`, [POOL, READ, SEAM]);
      assert.deepEqual(g, { read: true, seam: false });
      for (const role of CLIENT_ROLES) {
        await refused(() => asRoleLocal(role, () => q('SELECT * FROM public.server_read_replay_version_availability_v1($1, $2, $3)',
          [randomUUID(), randomUUID(), randomUUID()])), ['42501']);
        await refused(() => asRoleLocal(role, () => q('SELECT voice_private.replay_call_certified_capture_ms_v1($1, 1, 0)', [randomUUID()])), ['42501', '3F000']);
      }
      await refused(() => availability(null, randomUUID(), randomUUID()), ['22023']);
      const tables = await rows(`SELECT c.oid::regclass::text rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND ((n.nspname = 'public' AND c.relname ~ '^replay') OR n.nspname = 'replay_private')`);
      assert.equal(tables.length, 36, 'the Replay relation census stays 36 (the 0169 census query): 0202 adds no relation');
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
}

// ------------------------------------------------------------------ A: acceptance (rolled back over the committed world)
async function verifyAcceptance(report, world) {
  const { a: w, b, n, stranger, otherSession } = world;
  await q('BEGIN');
  try {
    await report.isolated('A-01 0202 alone: every moment RECORDED / AFTER_END, bound to its version, revision and digest, at the ledger watermark', async () => {
      const answer = await availability(w.user, w.replay, w.version);
      assert.deepEqual(shape(answer), [1, 2, 3, 4, 5].map((k) => [k, 'RECORDED', 'AFTER_END', null, null]));
      const [binding] = await rows(`SELECT v.replay_id, v.id, v.replay_version_revision AS rev, c.source_window_binding_digest AS digest
          FROM public.replay_versions v JOIN public.replay_render_contract_versions c ON c.id = v.render_contract_version_id WHERE v.id = $1`, [w.version]);
      const head = w.ledger.at(-1);
      for (const r of answer) {
        assert.deepEqual([r.replay_id, r.replay_version_id, r.replay_version_revision, r.source_window_binding_digest, r.ledger_through_sp, r.ledger_seq],
          [binding.replay_id, binding.id, binding.rev, binding.digest, head.through_sp, head.through_seq], 'every row carries the binding and the watermark');
      }
      assert.match(binding.digest, /^sha256:/u, 'a V2 version carries its source window binding digest');
    });
    await report.isolated('A-02 a certified commit is placed at its certified position; the earliest presented placement wins', () => checkPlacement(w));
    await report.isolated('A-03 the completing row SEALS TC: certifying the row that ends at TC places nothing', () => checkSealingRow(w));
    await report.isolated('A-04 after every run of its recording: AFTER_END; before a run starts: the run start', () => checkRunEnd(w));
    await report.isolated('A-05a of two calls, the earliest PRESENTED placement wins over a smaller clock in a later run', () => checkEarliestPresented(w));
    await report.isolated('A-05b a call of another Session never certifies', () => checkForeignSession(w, otherSession));
    await report.isolated('A-06 an uncommitted or rolled-back commit never appears; the read writes nothing', async () => {
      const before = await availability(w.user, w.replay, w.version);
      const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await other.connect();
      try {
        await other.query('BEGIN');
        await other.query("SET CONSTRAINTS ALL IMMEDIATE");
        await other.query('UPDATE public.session_semantic_clocks SET current_sp = current_sp + 1 WHERE session_id = $1', [w.session]);
        const [{ n: own }] = (await other.query(`SELECT count(*)::int AS n FROM ${LEDGER} WHERE session_id = $1`, [w.session])).rows;
        assert.equal(own, 7, 'the uncommitted transaction holds its own (folded) ledger row');
        const during = await availability(w.user, w.replay, w.version);
        assert.deepEqual(during, before, 'an uncommitted ledger row is invisible: the answer and its watermark are unchanged');
        await other.query('ROLLBACK');
      } finally {
        await other.end().catch(() => undefined);
      }
      assert.deepEqual(await availability(w.user, w.replay, w.version), before, 'a rolled-back commit leaves nothing');
      const fresh = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await fresh.connect();
      try {
        await fresh.query('BEGIN');
        await fresh.query(`SET LOCAL ROLE ${POOL}`);
        const read = await fresh.query('SELECT * FROM public.server_read_replay_version_availability_v1($1, $2, $3)', [w.user, w.replay, w.version]);
        assert.equal(read.rows.length, 5);
        const [{ x }] = (await fresh.query('SELECT pg_current_xact_id_if_assigned()::text AS x')).rows;
        assert.equal(x, null, 'a transaction that only read was assigned no transaction id: the read wrote nothing');
        await fresh.query('ROLLBACK');
      } finally {
        await fresh.end().catch(() => undefined);
      }
    });
    await report.isolated('A-07a a gap in the chain is BROKEN for every moment', () => checkGap(w));
    await report.isolated('A-07b a missing completing row is BROKEN for its moment only', async () => {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`DELETE FROM ${LEDGER} WHERE session_id = $1 AND through_sp = 6`, [w.session]);
      await q("SET LOCAL session_replication_role = 'origin'");
      const got = shape(await availability(w.user, w.replay, w.version));
      assert.deepEqual(got.map((m) => m[1]), ['RECORDED', 'RECORDED', 'RECORDED', 'RECORDED', 'BROKEN']);
    });
    await report.isolated('A-08a a deploy-boundary Session is UNESTABLISHED for every moment', () => checkBoundary(b));
    await report.isolated('A-08b a Session with no ledger row is UNESTABLISHED for every moment', () => checkBoundary(n));
    await report.isolated('A-09 AFTER_END never moves backward: a later commit, a later call\'s certification and a re-read change no placement', async () => {
      await plantSeam([[w.c1.call, 2, seqOf(w, 2), 3500]]);
      const before = shape(await availability(w.user, w.replay, w.version));
      assert.deepEqual(before.slice(1).map((m) => m[2]), ['AFTER_END', 'AFTER_END', 'AFTER_END', 'AFTER_END']);
      const later = await callRecordingIn(w.user, w.session, { USER: [0, 5000] });
      await q("SET CONSTRAINTS ALL IMMEDIATE");
      await q('UPDATE public.session_semantic_clocks SET current_sp = current_sp + 1 WHERE session_id = $1', [w.session]);
      await q('INSERT INTO public.rb2_s3_planted_certification VALUES ($1, 99, 0, 0)', [later.call]);
      const after = await availability(w.user, w.replay, w.version);
      assert.deepEqual(shape(after), before, 'the placements are unchanged');
      assert.equal(after[0].ledger_through_sp, 7, 'only the watermark moves forward');
      assert.deepEqual(shape(await availability(w.user, w.replay, w.version)), before, 'a re-read is identical');
    });
    await report.isolated('A-11 a stranger, another Replay id and an unknown version read zero rows, indistinguishably', () => checkOwner(w, stranger, world.t));
    await report.isolated('A-12 a V1 (text-only) version is ORDINAL_ONLY with no time claim and no binding digest', () => checkOrdinalOnly(world.t));
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
  // A-10 commits: a revision is a new version of the same Replay.
  await report.section('A-10 a revised version is bound to its own identity and revision; the earlier version keeps its own', async () => {
    const revised = await tx(async () => {
      await rt.setGate();
      const finalized = await rt.finalize(w.user, randomUUID(), w.replay, w.version);
      assert.equal(finalized.outcome, 'FINALIZED', `fixture: finalized (${finalized.outcome})`);
      const reopened = await rt.reopen(w.user, randomUUID(), w.replay, w.version);
      assert.equal(reopened.outcome, 'REOPENED', `fixture: reopened (${reopened.outcome})`);
      const [state] = await rt.read(w.user, w.replay);
      const r = await rt.revise(w.user, randomUUID(), w.replay, Number(state.draft_revision), 2, 5);
      assert.equal(r.outcome, 'REVISED', `fixture: revised (${r.outcome})`);
      const p = await rt.preview(w.user, randomUUID(), w.replay, Number(r.draft_revision));
      assert.equal(p.outcome, 'PREVIEW_READY');
      return { version: p.replay_version_id, revision: Number(p.replay_version_revision) };
    });
    await q('BEGIN');
    try {
      const oldAnswer = await availability(w.user, w.replay, w.version);
      const newAnswer = await availability(w.user, w.replay, revised.version);
      assert.notEqual(revised.version, w.version);
      assert.equal(revised.revision, w.revision + 1);
      assert.ok(oldAnswer.every((r) => r.replay_version_id === w.version && r.replay_version_revision === w.revision), 'the old answer is bound to the old version');
      assert.ok(newAnswer.every((r) => r.replay_version_id === revised.version && r.replay_version_revision === revised.revision), 'the new answer to the new');
      assert.equal(newAnswer.length, 4, 'the revised selection has its own moments');
      await plantSeam([[w.c1.call, 3, seqOf(w, 3), 5000]]);
      const placedNew = shape(await availability(w.user, w.replay, revised.version));
      assert.deepEqual(placedNew[0], [1, 'RECORDED', 'IN_RECORDING', 1, 5000], 'the new version\'s first moment (SP2) is completed by r3, its own coordinate');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
    }
  });
}

// ------------------------------------------------------------------ D: planted defects of the read
async function verifyPlantedDefects(report, world) {
  const { a: w, b, stranger, otherSession } = world;
  void b;
  const [{ d: pristine }] = await rows('SELECT pg_get_functiondef(to_regprocedure($1)) AS d', [READ]);
  const apply = (sql) => q(sql);
  await q('BEGIN');
  try {
    const defects = [
      ['D-01 the row ending at TC taken as its completion', (s) => s.replace('l.through_sp > pt.tc', 'l.through_sp >= pt.tc'), () => checkSealingRow(w)],
      ['D-02 the chain continuity check removed', (s) => s.replace("WHEN v_breaks > 0 THEN 'BROKEN'", "WHEN false THEN 'BROKEN'"), () => checkGap(w)],
      ['D-03 the deploy boundary ignored', (s) => s.replace('OR v_first_from_sp <> 0', 'OR false'), () => checkBoundary(b)],
      ['D-04 a position after the run end pulled into the run', (s) => s.replace('ru.b > ce.x', 'true'), () => checkRunEnd(w)],
      ['D-05 the latest presented placement wins', (s) => s.replace('ORDER BY ce.ord, ru.n,', 'ORDER BY ce.ord, ru.n DESC,'), () => checkEarliestPresented(w)],
      ['D-06 a call of another Session admitted', (s) => s.replace('AND c.session_id = v_session ', ''), () => checkForeignSession(w, otherSession)],
      ['D-07 the owner check removed', (s) => s.replace('AND r.created_by_user_id = p_user_id', ''), () => checkOwner(w, stranger, world.t)],
      ['D-08 the seam bypassed: every moment placed at its run start', (s) => s.replace(
        'voice_private.replay_call_certified_capture_ms_v1(cl.call, k.sp, k.seq) AS x', '0::bigint AS x'), () => checkSealingRow(w)],
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
  // RE-ANCHORED by S8B-07 RB-2 / S3 (PR #408 CI, 2026-11-24): each governed erasure of a fixture human queued its
  // storage keys in the shared erasure queue. Their objects never existed, so the fixture discharges exactly those rows,
  // as verify-0183 / 0195 / 0196 do: left due, they pushed the later storage proofs on this database (prove-0162 P04) past
  // the erasure worker's 25-key batch.
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
  const [{ n }] = await rows(`SELECT count(*)::int AS n FROM ${LEDGER} WHERE user_id = ANY($1::uuid[])`, [fixtureHumans]);
  assert.equal(n, 0, 'no fixture ledger row is left behind');
}

runVerifier('0202', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  assert.ok(readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').includes('replay_call_certified_capture_ms_v1'));
  const report = createScenarioReport('0202', { query: q, restore: async () => { await q('RESET ROLE').catch(() => undefined); } });
  try {
    setStage('C catalogue');
    await verifyCatalogue(report);
    setStage('world');
    const world = {};
    world.a = await worldA();
    world.stranger = await human();
    world.otherSession = await newSession(world.a.user);
    // B: the deploy boundary (the first move happened before the ledger), then ordinary commits.
    {
      const user = await human();
      const session = await newSession(user);
      const c = await callRecording(user, session, { USER: [0, 10000] });
      await commitTurn(user, session, 'USER', { recording: c.recording, a: 0, b: 2000 }, { replica: true });
      await commitTurn(user, session, 'ASSISTANT');
      await commitTurn(user, session, 'USER', { recording: c.recording, a: 4000, b: 6000 });
      await commitTurn(user, session, 'ASSISTANT');
      assert.equal((await ledgerOf(session))[0].from_sp, 1, 'fixture: the first ledger row is the deploy boundary');
      world.b = { user, ...(await replayOf(user, session, 1, 3)) };
    }
    // N: a Session whose clock never moved under the ledger.
    {
      const user = await human();
      const session = await newSession(user);
      const c = await callRecording(user, session, { USER: [0, 10000] });
      await commitTurn(user, session, 'USER', { recording: c.recording, a: 0, b: 2000 }, { replica: true });
      await commitTurn(user, session, 'ASSISTANT', null, { replica: true });
      await commitTurn(user, session, 'USER', null, { replica: true });
      assert.equal((await ledgerOf(session)).length, 0, 'fixture: no ledger row');
      world.n = { user, ...(await replayOf(user, session, 1, 2)) };
    }
    // T: a text-only Session, whose selection is a V1 version.
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
