// Real-PostgreSQL verifier for migration 0203 (S8B-07 RB-2 / M-2: Direct Historical Binding — the live call's certified
// clock marks), under the Product Owner's execution authorization "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION — Direct
// Historical Binding" of 2026-11-24 (CP2 / CP4). No provider is called. The world is COMMITTED (the ledger and the slot
// snapshots exist only across real commits); every committed fixture person is removed at the end THROUGH the account
// erasure itself, and every fixture instance's snapshots are removed by instance id.
//
//   C  catalogue      relations sealed (RLS, no grant), definers postgres-owned and pinned, service_role reaches exactly
//                     the slot batch, the seam stays STABLE, the census registers the marks and the ranges
//   M  acceptance
//      M-01  a commit visible in the slot snapshot is certified at the echo; the seam answers it
//      M-02  a snapshot never certifies a commit made after it (a future commit)
//      M-03  a transaction in flight when the snapshot was taken is not certified by it, even once it commits
//      M-04  the visible prefix stops at the first row the snapshot does not see (a hole is never jumped)
//      M-05  write-on-change: an equal-or-later echo of the same prefix writes nothing; a longer prefix writes one row;
//            a requeued OLDER echo of a shorter prefix still lands (never dominated)
//      M-06  optimized (write-on-change + compaction) vs unoptimized (every echo kept) on IDENTICAL data: the certified
//            position of every ledger row is identical, with lost, delayed, reordered, duplicated echoes and a reconnect
//      M-07  compaction: only an ENDED call; positions preserved; idempotent; marks persisted after it are merged
//      M-08  instance isolation and validation: another instance's, an expired or an unknown snapshot, an unknown call,
//            a malformed echo certify nothing; a malformed batch is refused whole (22023)
//      M-09  snapshot collection: own snapshots past 120 s and anyone's past one hour go; others' recent ones stay
//      M-10  the S3 read end to end with real marks: a certified moment IN_RECORDING at its echo; after-call analysis
//            AFTER_END; a rolled-back analysis never appears; AFTER_END never moves backward
//      M-11  erasure: the account erasure removes the marks and the ranges (cascade); no user content in a mark
//      M-12  storage and WAL: bytes per slot (no change, change), per unoptimized echo, marks vs compacted ranges
//   D  planted defects, each refused by the canonical check that proves the rule
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

const MIGRATION = '0203_s8b_07_live_call_clock_marks_v1.sql';
const SLOT = 'public.server_call_clock_slot_v1(uuid,uuid[],bigint[],integer[],bigint[],bigint[],uuid[])';
const SEAM = 'voice_private.replay_call_certified_capture_ms_v1(uuid,integer,bigint)';
const HELD = 'voice_private.call_clock_held_prefix_v1(uuid,bigint)';
const VISIBLE = 'voice_private.call_clock_visible_prefix_v1(uuid,pg_snapshot,integer,bigint)';
const COMPACT = 'voice_private.compact_call_clock_marks_v1(uuid)';
const LEDGER = 'public.session_semantic_commit_instants';
const RELATIONS = ['voice_private.call_clock_snapshots', 'voice_private.call_clock_marks', 'voice_private.call_clock_cert_ranges'];
const ROLES = ['anon', 'authenticated', 'service_role', 'qandeel_replay_media'];

const fixtureHumans = [];
const erasedHumans = new Set();
/** The storage keys each governed erasure of a fixture human released to the shared erasure queue (see removeFixtures). */
const releasedKeys = [];
const fixtureInstances = [];
const metrics = {};

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
const instance = () => { const id = randomUUID(); fixtureInstances.push(id); return id; };
/** One slot batch as service_role, in the caller's open transaction. echoes: [call, epoch, markSeq, snapshotId, echoMs]. */
const slotIn = (inst, echoes = [], compact = []) => asRoleLocal('service_role', async () => {
  const col = (i) => echoes.map((e) => e[i]);
  const [r] = await rows(`SELECT snapshot_id::text AS snapshot, persisted, compacted
      FROM public.server_call_clock_slot_v1($1, $2::uuid[], $3::bigint[], $4::integer[], $5::bigint[], $6::bigint[], $7::uuid[])`,
  [inst, col(0), col(1), col(2), col(3), col(4), compact]);
  return { snapshot: Number(r.snapshot), persisted: r.persisted, compacted: r.compacted };
});
/** A COMMITTED slot batch: its snapshot is what a mark of that slot is sent against. */
const slot = (inst, echoes, compact) => tx(() => slotIn(inst, echoes, compact));
const seam = async (call, sp, seq) => {
  const [{ x }] = await rows(`SELECT voice_private.replay_call_certified_capture_ms_v1($1, $2, $3)::text AS x`, [call, sp, seq]);
  return x === null ? null : Number(x);
};
const marksOf = (call) => rows(`SELECT certified_through_sp AS sp, certified_through_event_sequence::text AS seq, echo_capture_ms::text AS echo,
  connection_epoch::text AS epoch, mark_seq FROM voice_private.call_clock_marks WHERE call_id = $1 ORDER BY 1, 2`, [call]);
const rangesOf = (call) => rows(`SELECT through_sp, through_event_sequence::text[] AS seq, echo_capture_ms::text[] AS echo
  FROM voice_private.call_clock_cert_ranges WHERE call_id = $1`, [call]);

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
/** An ACTIVE call (no recording), committed. */
async function liveCall(user, session) {
  return tx(async () => {
    const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
    return fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
  });
}
const endCall = (call) => tx(() => q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(),
  grace_until = NULL, seat_lease_until = NULL WHERE id = $1 AND state <> 'ENDED'`, [call]));
/** An ACTIVE call with a STORED recording holding one segment per listed track: { recording, call }. */
async function callRecording(user, session, tracks) {
  return tx(async () => {
    const id = randomUUID();
    const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
    const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
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
/** One turn of one unit, committed in its OWN transaction: exactly one ledger row. */
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
const ledgerOf = (session) => rows(`SELECT through_sp, through_event_sequence::text AS through_seq, xact_id::text AS xact
  FROM ${LEDGER} WHERE session_id = $1 ORDER BY through_sp, through_event_sequence`, [session]);
const seqOf = (ledger, sp) => Number(ledger.find((r) => r.through_sp === sp).through_seq);
async function replayOf(user, session, first, last) {
  return tx(async () => {
    await rt.setGate();
    const created = await rt.create(user, randomUUID(), session, first, last);
    assert.equal(created.outcome, 'CREATED', `fixture: the draft is created (${created.outcome})`);
    const previewed = await rt.preview(user, randomUUID(), created.replay_id, created.draft_revision);
    assert.equal(previewed.outcome, 'PREVIEW_READY', `fixture: the draft previews (${previewed.outcome})`);
    return { replay: created.replay_id, version: previewed.replay_version_id };
  });
}
const availability = (user, replay, version) => tx(() => asRoleLocal('qandeel_replay_media', () =>
  rows(`SELECT selected_ordinal, availability_state, placement, run_ordinal, clock_ms::text AS clock_ms
          FROM public.server_read_replay_version_availability_v1($1, $2, $3)`, [user, replay, version])))
  .then((answer) => answer.map((r) => [r.selected_ordinal, r.availability_state, r.placement, r.run_ordinal,
    r.clock_ms === null ? null : Number(r.clock_ms)]));

/** The REFERENCE model: the contiguous prefix a snapshot sees, from the raw ledger, never from 0203's functions. */
async function referencePrefix(session, snapshotId) {
  const seen = await rows(`SELECT l.through_sp, l.through_event_sequence::text AS seq, pg_visible_in_snapshot(l.xact_id, s.snapshot) AS v
      FROM ${LEDGER} l, voice_private.call_clock_snapshots s
     WHERE l.session_id = $1 AND s.snapshot_id = $2 ORDER BY 1, 2`, [session, snapshotId]);
  let w = null;
  for (const r of seen) { if (!r.v) break; w = [r.through_sp, Number(r.seq)]; }
  return w;
}
const geq = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1]);
const certifiedByModel = (pairs, key) => {
  const xs = pairs.filter((p) => p.w !== null && geq(p.w, key)).map((p) => p.x);
  return xs.length === 0 ? null : Math.min(...xs);
};
async function seamOfEveryRow(call, ledger) {
  const out = [];
  for (const r of ledger) out.push(await seam(call, r.through_sp, Number(r.through_seq)));
  return out;
}

// ------------------------------------------------------------------ canonical checks (also the planted-defect detectors)
/** M-04: a hole in what a snapshot sees stops the prefix there, whatever is visible after it. */
async function checkHole(session) {
  const ledger = await ledgerOf(session);
  assert.ok(ledger.length >= 3, 'fixture: three rows');
  const hole = ledger[1].xact;
  const xmax = Math.max(...ledger.map((r) => Number(r.xact))) + 1;
  // xmin at the hole, the hole in progress, every later xact committed: rows 1 and 3+ visible, row 2 not.
  const snapshot = `${hole}:${xmax}:${hole}`;
  const [got] = await rows(`SELECT sp, seq::text AS seq FROM voice_private.call_clock_visible_prefix_v1($1, $2::pg_snapshot, NULL, NULL)`, [session, snapshot]);
  assert.deepEqual([got.sp, got.seq === null ? null : Number(got.seq)], [ledger[0].through_sp, Number(ledger[0].through_seq)],
    'the prefix stops before the first row the snapshot does not see');
}
/** M-08: another instance's snapshot never certifies. */
async function checkInstanceIsolation(call, session) {
  void session;
  const mine = instance();
  const other = instance();
  const theirs = await slotIn(other);
  const before = await marksOf(call);
  const r = await slotIn(mine, [[call, 1, 900, theirs.snapshot, 999980]]);
  assert.equal(r.persisted, 0, 'another instance\'s snapshot is dropped');
  assert.deepEqual(await marksOf(call), before);
}
/** M-07: a live call is never compacted. */
async function checkLiveNotCompacted(call) {
  const before = await marksOf(call);
  assert.ok(before.length > 0, 'fixture: the live call holds marks');
  const r = await slotIn(instance(), [], [call]);
  assert.equal(r.compacted, 0, 'a live call is not compacted');
  assert.deepEqual(await marksOf(call), before, 'its marks are untouched');
  assert.deepEqual(await rangesOf(call), []);
}
/** M-06 / M-07: the optimized certification equals the reference, row for row (rolled back by the caller). */
async function checkModel(m) {
  assert.deepEqual(await seamOfEveryRow(m.call, m.ledger), m.expected, 'optimized == unoptimized for every ledger row');
}
async function checkCompactionPreserves(m) {
  await endCallIn(m.call);
  const r = await slotIn(instance(), [], [m.call]);
  assert.equal(r.compacted, 1);
  assert.deepEqual(await marksOf(m.call), [], 'the marks were absorbed');
  assert.deepEqual(await seamOfEveryRow(m.call, m.ledger), m.expected, 'compaction preserves every certified position');
}
const endCallIn = (call) => q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(),
  grace_until = NULL, seat_lease_until = NULL WHERE id = $1 AND state <> 'ENDED'`, [call]);

// ------------------------------------------------------------------ C: catalogue
async function verifyCatalogue(report) {
  await report.section('C-01 the relations are sealed and the definers pinned; service_role reaches exactly the slot batch', async () => {
    for (const rel of RELATIONS) {
      const [t] = await rows(`SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = $1::regclass`, [rel]);
      assert.deepEqual([t.rls, t.owner], [true, 'postgres'], `${rel} is postgres-owned with RLS`);
      for (const role of ROLES) {
        const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
            OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, rel]);
        assert.equal(any, false, `${role} holds nothing on ${rel}`);
      }
    }
    for (const fn of [SLOT, SEAM, HELD, VISIBLE, COMPACT]) {
      const [p] = await rows(`SELECT p.prosecdef AS def, pg_get_userbyid(p.proowner) AS owner, p.proconfig AS cfg, p.provolatile AS vol
          FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [fn]);
      assert.deepEqual([p.def, p.owner, p.cfg], [true, 'postgres', ['search_path=""']], `${fn} is a pinned postgres definer`);
      for (const role of ROLES) {
        const [{ x }] = await rows(`SELECT has_function_privilege($1, to_regprocedure($2), 'EXECUTE') AS x`, [role, fn]);
        assert.equal(x, role === 'service_role' && fn === SLOT, `${role} on ${fn}`);
      }
      if (fn === SEAM) assert.equal(p.vol, 's', 'the seam stays STABLE');
    }
  });
  await report.section('C-02 the census: the marks and the ranges are ACCOUNT_CASCADE; nothing referencing the account is unregistered', async () => {
    const reg = await rows(`SELECT relation, coverage FROM account_erasure_private.coverage_registry
                             WHERE relation LIKE 'voice_private.call_clock_%' ORDER BY 1`);
    assert.deepEqual(reg.map((r) => [r.relation, r.coverage]), [
      ['voice_private.call_clock_cert_ranges', 'ACCOUNT_CASCADE'], ['voice_private.call_clock_marks', 'ACCOUNT_CASCADE']]);
    const missing = await rows(`SELECT DISTINCT c.conrelid::regclass::text AS r FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
          AND c.conrelid::regclass::text NOT IN (SELECT relation FROM account_erasure_private.coverage_registry)`);
    assert.deepEqual(missing, []);
    const fks = await rows(`SELECT c.conrelid::regclass::text AS r, c.confrelid::regclass::text AS target, c.confdeltype AS del
        FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid::regclass::text LIKE 'voice_private.call_clock_%' ORDER BY 1, 2`);
    assert.ok(fks.every((f) => f.del === 'c'), 'every reference cascades');
    const [{ n }] = await rows(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
        WHERE c.relkind = 'r' AND ((s.nspname = 'public' AND c.relname ~ '^replay') OR s.nspname = 'replay_private')`);
    assert.equal(n, 36, 'the Replay census is unchanged');
    const cols = await rows(`SELECT attname FROM pg_attribute WHERE attrelid = 'voice_private.call_clock_marks'::regclass AND attnum > 0
        AND NOT attisdropped ORDER BY attnum`);
    assert.deepEqual(cols.map((c) => c.attname), ['call_id', 'certified_through_sp', 'certified_through_event_sequence', 'user_id',
      'connection_epoch', 'mark_seq', 'echo_capture_ms'], 'a mark holds no user content');
  });
}

// ------------------------------------------------------------------ M: acceptance
async function verifyAcceptance(report, w) {
  const { user, session, call } = w.m;
  // M-01 .. M-03 and M-05 commit: they are the path a real call takes.
  await report.section('M-01 a commit visible in the slot snapshot is certified at the echo', async () => {
    const inst = instance();
    await commitTurn(user, session, 'USER');
    await commitTurn(user, session, 'ASSISTANT');
    const s1 = await slot(inst);
    const r = await slot(inst, [[call, 1, 1, s1.snapshot, 4000]]);
    assert.equal(r.persisted, 1);
    const ledger = await ledgerOf(session);
    assert.equal(await seam(call, 2, seqOf(ledger, 2)), 4000, 'the second row is certified at 4000');
    assert.equal(await seam(call, 1, seqOf(ledger, 1)), 4000, 'so is every row before it');
    w.m.inst = inst;
  });
  await report.section('M-02 a snapshot never certifies a commit made after it', async () => {
    const s = await slot(w.m.inst);
    await commitTurn(user, session, 'USER');
    const r = await slot(w.m.inst, [[call, 1, 2, s.snapshot, 6000]]);
    assert.equal(r.persisted, 0, 'the snapshot saw no longer prefix: nothing to write');
    const ledger = await ledgerOf(session);
    assert.equal(await seam(call, 3, seqOf(ledger, 3)), null, 'the later commit is not certified');
    const s2 = await slot(w.m.inst);
    await slot(w.m.inst, [[call, 1, 3, s2.snapshot, 7000]]);
    assert.equal(await seam(call, 3, seqOf(ledger, 3)), 7000, 'a snapshot after it certifies it');
  });
  await report.section('M-03 a transaction in flight at the snapshot is not certified by it, even once committed', async () => {
    const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await other.connect();
    let s;
    try {
      await other.query('BEGIN');
      await other.query('SET CONSTRAINTS ALL IMMEDIATE');
      await other.query('UPDATE public.session_semantic_clocks SET current_sp = current_sp + 1 WHERE session_id = $1', [session]);
      s = await slot(w.m.inst);
      await other.query('COMMIT');
    } finally {
      await other.end().catch(() => undefined);
    }
    const ledger = await ledgerOf(session);
    const last = ledger[ledger.length - 1];
    const r = await slot(w.m.inst, [[call, 1, 4, s.snapshot, 9000]]);
    assert.equal(r.persisted, 0, 'the in-flight row was not visible to that snapshot');
    assert.equal(await seam(call, last.through_sp, Number(last.through_seq)), null);
  });
  await q('BEGIN');
  try {
    await report.isolated('M-04 the visible prefix stops at the first row the snapshot does not see', () => checkHole(session));
  } finally { await q('ROLLBACK').catch(() => undefined); }
  await report.section('M-05 write-on-change: an equal-or-later echo writes nothing; a longer prefix one row; an older shorter one still lands', async () => {
    const s1 = await slot(w.m.inst);
    const r1 = await slot(w.m.inst, [[call, 1, 5, s1.snapshot, 11000]]);
    const marks = (await marksOf(call)).length;
    // s1 sees the M-03 row; 11000 is its first certification.
    assert.equal(r1.persisted, 1, 'the M-03 row is certified by the next snapshot');
    const s2 = await slot(w.m.inst);
    const r2 = await slot(w.m.inst, [[call, 1, 6, s2.snapshot, 12000], [call, 1, 6, s2.snapshot, 12000]]);
    assert.equal(r2.persisted, 0, 'the same prefix at a later echo (and its duplicate) writes nothing');
    assert.equal((await marksOf(call)).length, marks);
    // An older snapshot whose shorter prefix arrives LATE but with an earlier echo is not dominated: it lands.
    await commitTurn(user, session, 'ASSISTANT');
    const old = await slot(w.m.inst);
    await commitTurn(user, session, 'USER');
    const young = await slot(w.m.inst);
    assert.equal((await slot(w.m.inst, [[call, 1, 8, young.snapshot, 15000]])).persisted, 1, 'the longer prefix lands');
    assert.equal((await slot(w.m.inst, [[call, 1, 7, old.snapshot, 14000]])).persisted, 1, 'the requeued older echo still lands');
    const ledger = await ledgerOf(session);
    const n = ledger.length;
    assert.equal(await seam(call, ledger[n - 2].through_sp, Number(ledger[n - 2].through_seq)), 14000, 'its row keeps the earlier echo');
    assert.equal(await seam(call, ledger[n - 1].through_sp, Number(ledger[n - 1].through_seq)), 15000);
  });

  // M-06 builds the model world: identical data, the reference keeps every echo.
  await report.section('M-06 optimized == unoptimized on identical data (lost, delayed, reordered, duplicated echoes; a reconnect)', async () => {
    const u = await human();
    const sess = await newSession(u);
    const c = await liveCall(u, sess);
    const inst = instance();
    const pairs = [];
    const pending = [];
    let x = 0;
    let epoch = 1;
    let seq = 0;
    let unoptimizedRows = 0;
    for (let i = 0; i < 48; i += 1) {
      if (i % 3 !== 0) await commitTurn(u, sess, i % 2 === 0 ? 'USER' : 'ASSISTANT');
      if (i % 11 === 5) await commitTurn(u, sess, 'ASSISTANT');
      if (i === 24) { epoch = 2; seq = 0; }
      const due = pending.filter((p) => p.at <= i);
      const batch = due.map((p) => p.echo);
      if (i % 13 === 7 && batch.length > 0) batch.push(batch[0]);
      if (i % 2 === 1) batch.reverse();
      const s = await slot(inst, batch);
      for (const p of due) pending.splice(pending.indexOf(p), 1);
      seq += 1;
      x += 1000;
      const echo = [c, epoch, seq, s.snapshot, x];
      if (i % 7 === 3) continue;                                   // lost: never echoed
      const ref = await referencePrefix(sess, s.snapshot);
      pairs.push({ w: ref, x });
      unoptimizedRows += 1;
      pending.push({ at: i % 5 === 2 ? i + 3 : i + 1, echo });     // every fifth arrives three slots late
    }
    await slot(inst, pending.map((p) => p.echo));
    await commitTurn(u, sess, 'USER');                             // a tail no echoed snapshot saw
    await slot(inst);
    const ledger = await ledgerOf(sess);
    const expected = ledger.map((r) => certifiedByModel(pairs, [r.through_sp, Number(r.through_seq)]));
    assert.ok(expected.some((e) => e !== null) && expected.filter((e) => e === null).length >= 1, 'fixture: certified rows and a tail');
    w.model = { user: u, session: sess, call: c, ledger, expected };
    await checkModel(w.model);
    metrics.unoptimizedRows = unoptimizedRows;
    metrics.optimizedRows = (await marksOf(c)).length;
    assert.ok(metrics.optimizedRows < unoptimizedRows, `write-on-change stores fewer rows (${metrics.optimizedRows} < ${unoptimizedRows})`);
  });
  await q('BEGIN');
  try {
    await report.isolated('M-07a a live call is never compacted', () => checkLiveNotCompacted(w.model.call));
    await report.isolated('M-07b compaction preserves every certified position', () => checkCompactionPreserves(w.model));
  } finally { await q('ROLLBACK').catch(() => undefined); }
  await report.section('M-07c compaction is idempotent and merges marks persisted after it', async () => {
    const m = w.model;
    const [{ b: marksBytes }] = await rows(`SELECT coalesce(sum(pg_column_size(t.*)), 0)::int AS b FROM voice_private.call_clock_marks t WHERE call_id = $1`, [m.call]);
    await endCall(m.call);
    const first = await slot(instance(), [], [m.call]);
    assert.equal(first.compacted, 1);
    const once = await rangesOf(m.call);
    const [{ b: rangeBytes }] = await rows(`SELECT pg_column_size(t.*)::int AS b FROM voice_private.call_clock_cert_ranges t WHERE call_id = $1`, [m.call]);
    metrics.marksBytes = marksBytes;
    metrics.rangeBytes = rangeBytes;
    await slot(instance(), [], [m.call]);
    assert.deepEqual(await rangesOf(m.call), once, 'a second compaction changes nothing');
    assert.deepEqual(await seamOfEveryRow(m.call, m.ledger), m.expected);
    // A late echo of the ended call (captured during it) is persisted, then merged by the next compaction.
    await commitTurn(m.user, m.session, 'USER');
    const inst = instance();
    const s = await slot(inst);
    assert.equal((await slot(inst, [[m.call, 2, 99, s.snapshot, 999000]])).persisted, 1);
    await slot(instance(), [], [m.call]);
    assert.deepEqual(await marksOf(m.call), [], 'merged into the range');
    const ledger = await ledgerOf(m.session);
    const last = ledger[ledger.length - 1];
    assert.equal(await seam(m.call, last.through_sp, Number(last.through_seq)), 999000);
    const now = (await seamOfEveryRow(m.call, ledger)).slice(0, m.expected.length);
    assert.deepEqual(now.map((v, i) => (m.expected[i] === null ? null : v)), m.expected, 'every earlier position is unchanged');
    assert.ok(now.every((v, i) => m.expected[i] !== null || v === 999000), 'and only the uncertified tail gains the late echo');
    m.expected = now;
  });

  await commitTurn(user, session, 'ASSISTANT');            // a prefix nobody has certified yet
  await q('BEGIN');
  try {
    await report.isolated('M-08a another instance\'s snapshot never certifies', () => checkInstanceIsolation(call, session));
    await report.isolated('M-08b an expired or unknown snapshot, an unknown call or a malformed echo certifies nothing', async () => {
      const inst = instance();
      const s = await slotIn(inst);
      const before = await marksOf(call);
      const bad = [
        [call, 1, 50, s.snapshot + 1000000, 50000],            // unknown snapshot
        [randomUUID(), 1, 50, s.snapshot, 50000],              // unknown call
        [call, 1, 50, s.snapshot, 50010],                      // not a 20 ms frame
        [call, 1, 50, s.snapshot, -20],                        // negative
        [call, 0, 50, s.snapshot, 50000],                      // epoch 0
        [call, 1, 0, s.snapshot, 50000],                       // mark 0
        [call, 1, 50, s.snapshot, null],                       // NOCLOCK
      ];
      assert.equal((await slotIn(inst, bad)).persisted, 0);
      await q(`UPDATE voice_private.call_clock_snapshots SET taken_at = clock_timestamp() - interval '121 seconds' WHERE snapshot_id = $1`, [s.snapshot]);
      assert.equal((await slotIn(inst, [[call, 1, 50, s.snapshot, 50000]])).persisted, 0, 'an expired snapshot certifies nothing');
      assert.deepEqual(await marksOf(call), before);
      await refused(() => asRoleLocal('service_role', () => rows(`SELECT * FROM public.server_call_clock_slot_v1($1, $2::uuid[], '{1}'::bigint[],
        '{50}'::integer[], ARRAY[$3]::bigint[], '{}'::bigint[], '{}'::uuid[])`, [inst, [call], s.snapshot])), ['22023']);
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.call_clock_snapshots WHERE snapshot_id = $1', [s.snapshot]))[0].n, 0,
        'the expired snapshot was collected by that same batch');
      const fresh = await slotIn(inst);
      assert.equal((await slotIn(inst, [[call, 1, 50, fresh.snapshot, 50000]])).persisted, 1, 'control: a well-formed echo of a live snapshot certifies');
      await refused(() => slotIn(null), ['22023']);
    });
    await report.isolated('M-09 snapshot collection is bounded and per instance', async () => {
      const mine = instance();
      const other = instance();
      const a = await slotIn(mine);
      const b = await slotIn(other);
      const c = await slotIn(other);
      await q(`UPDATE voice_private.call_clock_snapshots SET taken_at = clock_timestamp() - interval '2 minutes 1 second' WHERE snapshot_id = ANY($1::bigint[])`, [[a.snapshot, b.snapshot]]);
      await q(`UPDATE voice_private.call_clock_snapshots SET taken_at = clock_timestamp() - interval '2 hours' WHERE snapshot_id = $1`, [c.snapshot]);
      // The anyone-sweep takes the 50 oldest ids: make c among them by moving it to the front.
      await q(`DELETE FROM voice_private.call_clock_snapshots WHERE snapshot_id < $1 AND instance_id <> ALL($2::uuid[])`, [a.snapshot, [mine, other]]);
      await slotIn(mine);
      const left = (await rows(`SELECT snapshot_id::text AS id FROM voice_private.call_clock_snapshots WHERE snapshot_id = ANY($1::bigint[]) ORDER BY 1`,
        [[a.snapshot, b.snapshot, c.snapshot]])).map((r) => Number(r.id));
      assert.deepEqual(left, [b.snapshot], 'mine past 120 s and anyone\'s past an hour go; another instance\'s recent one stays');
    });
  } finally { await q('ROLLBACK').catch(() => undefined); }

  await report.section('M-10 the S3 read with real marks: certified IN_RECORDING; after-call AFTER_END; rolled back never; never backward', async () => {
    const u = await human();
    const sess = await newSession(u);
    const c = await callRecording(u, sess, { USER: [0, 30000], QANDEEL: [0, 30000] });
    const inst = instance();
    await commitTurn(u, sess, 'USER', { recording: c.recording, a: 1000, b: 3000 });
    await commitTurn(u, sess, 'ASSISTANT', { recording: c.recording, a: 3000, b: 6000 });
    const s1 = await slot(inst);
    await commitTurn(u, sess, 'USER', { recording: c.recording, a: 8000, b: 10000 });
    const s2 = await slot(inst, [[c.call, 1, 1, s1.snapshot, 5000]]);
    await commitTurn(u, sess, 'ASSISTANT');
    await slot(inst, [[c.call, 1, 2, s2.snapshot, 9000]]);
    await endCall(c.call);
    await commitTurn(u, sess, 'USER');                      // after the call: analysis with no mark
    await commitTurn(u, sess, 'ASSISTANT');
    const r = await replayOf(u, sess, 1, 4);
    const answer = await availability(u, r.replay, r.version);
    assert.deepEqual(answer, [
      [1, 'RECORDED', 'IN_RECORDING', 1, 5000],           // sealed by row 2, certified at 5000
      [2, 'RECORDED', 'IN_RECORDING', 1, 9000],           // sealed by row 3, certified at 9000
      [3, 'RECORDED', 'AFTER_END', null, null],           // sealed by row 4: no snapshot of it was echoed
      [4, 'RECORDED', 'AFTER_END', null, null],           // after-call analysis
    ]);
    // A rolled-back analysis never appears; compaction and a re-read move nothing.
    const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await other.connect();
    try {
      await other.query('BEGIN');
      await other.query('SET CONSTRAINTS ALL IMMEDIATE');
      await other.query('UPDATE public.session_semantic_clocks SET current_sp = current_sp + 1 WHERE session_id = $1', [sess]);
      assert.deepEqual(await availability(u, r.replay, r.version), answer, 'an uncommitted commit changes nothing');
      await other.query('ROLLBACK');
    } finally { await other.end().catch(() => undefined); }
    await slot(instance(), [], [c.call]);
    await commitTurn(u, sess, 'USER');
    assert.deepEqual(await availability(u, r.replay, r.version), answer, 'compaction, a later commit and a re-read change no placement');
    w.e = { user: u, call: c.call };
  });
  await report.section('M-11 the account erasure removes the marks and the ranges', async () => {
    const before = await rows(`SELECT (SELECT count(*) FROM voice_private.call_clock_marks WHERE user_id = $1)::int AS m,
        (SELECT count(*) FROM voice_private.call_clock_cert_ranges WHERE user_id = $1)::int AS r`, [w.e.user]);
    assert.ok(before[0].r === 1, 'fixture: the M-10 call is compacted');
    await erase(w.e.user);
    const after = await rows(`SELECT (SELECT count(*) FROM voice_private.call_clock_marks WHERE user_id = $1)::int AS m,
        (SELECT count(*) FROM voice_private.call_clock_cert_ranges WHERE user_id = $1 OR call_id = $2)::int AS r`, [w.e.user, w.e.call]);
    assert.deepEqual([after[0].m, after[0].r], [0, 0]);
  });
  await q('BEGIN');
  try {
    await report.isolated('M-12 storage and WAL per slot, per echo and per compacted call', async () => {
      const inst = instance();
      const lsn = async () => (await rows('SELECT pg_current_wal_insert_lsn()::text AS l'))[0].l;
      const diff = async (a, b) => Number((await rows('SELECT pg_wal_lsn_diff($1::pg_lsn, $2::pg_lsn)::bigint AS d', [b, a]))[0].d);
      let s = await slotIn(inst);
      const a0 = await lsn();
      for (let i = 0; i < 100; i += 1) s = await slotIn(inst);
      metrics.walPerEmptySlot = Math.round((await diff(a0, await lsn())) / 100);
      // A slot that persists one unchanged echo (write-on-change: nothing written) vs one that changes.
      const a1 = await lsn();
      for (let i = 0; i < 100; i += 1) s = await slotIn(inst, [[call, 1, 1000 + i, s.snapshot, 2000000 + 20 * i]]);
      metrics.walPerUnchangedEchoSlot = Math.round((await diff(a1, await lsn())) / 100);
      await q('CREATE TABLE public.rb2_m2_unoptimized (LIKE voice_private.call_clock_marks INCLUDING ALL)');  // logged, rolled back
      await q('ALTER TABLE public.rb2_m2_unoptimized DROP CONSTRAINT IF EXISTS rb2_m2_unoptimized_pkey');
      await q('ALTER TABLE public.rb2_m2_unoptimized ADD PRIMARY KEY (call_id, connection_epoch, mark_seq)');
      const a2 = await lsn();
      for (let i = 0; i < 100; i += 1) {
        await q(`INSERT INTO public.rb2_m2_unoptimized VALUES ($1, 1, $2, $3, 1, $4, $5)`, [call, i, user, 2000 + i, 3000000 + 20 * i]);
      }
      metrics.walPerUnoptimizedEcho = Math.round((await diff(a2, await lsn())) / 100);
      const a3 = await lsn();
      for (let i = 0; i < 100; i += 1) {
        await q(`INSERT INTO voice_private.call_clock_marks VALUES ($1, 1, $2, $3, 1, $4, $5)`, [call, 100000 + i, user, 3000 + i, 4000000 + 20 * i]);
      }
      metrics.walPerChangedMark = Math.round((await diff(a3, await lsn())) / 100);
      const [{ b }] = await rows(`SELECT avg(pg_column_size(t.*))::int AS b FROM public.rb2_m2_unoptimized t`);
      metrics.bytesPerUnoptimizedRow = b;
      assert.ok(metrics.walPerUnchangedEchoSlot < metrics.walPerEmptySlot + metrics.walPerChangedMark,
        'an unchanged echo adds no mark row');
    });
  } finally { await q('ROLLBACK').catch(() => undefined); }
}

// ------------------------------------------------------------------ D: planted defects
async function verifyPlantedDefects(report, w) {
  const def = async (fn) => (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) AS d', [fn]))[0].d;
  const apply = (sql) => q(sql);
  const pristine = { visible: await def(VISIBLE), slot: await def(SLOT), held: await def(HELD), seam: await def(SEAM), compact: await def(COMPACT) };
  await q('BEGIN');
  try {
    const defects = [
      ['D-01 the prefix jumps a hole', 'visible', (s) => s.replace('WHERE a.seen AND NOT EXISTS', 'WHERE a.seen AND EXISTS'), () => checkHole(w.m.session)],
      ['D-02 another instance\'s snapshot admitted', 'slot', (s) => s.replace('AND s.instance_id = p_instance_id\n', '\n'), () => checkInstanceIsolation(w.m.call, w.m.session)],
      ['D-03 write-on-change compares against every held echo', 'held', (s) => s.split(' <= p_echo_capture_ms').join(' >= 0'), () => replayModel(w.model)],
      ['D-04 the seam takes the latest echo', 'seam', (s) => s.split('min(').join('max('), () => checkModel(w.model)],
      ['D-05 compaction keeps a dominated pair instead of the dominating one', 'compact', (s) => s.replace('p.e < p.later', 'p.e > p.later'), () => checkCompactionPreserves(w.model)],
      ['D-06 a live call compacted', 'compact', (s) => s.replace(" AND c.state = 'ENDED'", ''), () => checkLiveNotCompacted(w.live)],
    ];
    for (const [name, key, mutate, check] of defects) {
      await report.isolated(`C-${name.slice(0, 4)} canonical control passes`, check);
      await report.probe(name, { pristine: pristine[key], mutate, apply, reject: check });
    }
  } finally {
    await q('ROLLBACK').catch(() => undefined);
  }
}
/** D-03's control: replays the model's echoes into a fresh call inside the caller's transaction and compares. */
async function replayModel(m) {
  const c = await fixtureCall(q, rows, { id: randomUUID(), user: m.user, session: m.session, startedAt: new Date().toISOString() });
  const inst = instance();
  const ledger = m.ledger;
  // Two snapshots: an OLD one seeing a shorter prefix and a YOUNG one seeing all; the young echo lands first.
  const young = await slotIn(inst);
  const all = ledger.length;
  const oldSnap = `${ledger[all - 1].xact}:${Number(ledger[all - 1].xact) + 1}:${ledger[all - 1].xact}`;
  const [{ id: old }] = await rows(`INSERT INTO voice_private.call_clock_snapshots (instance_id, snapshot) VALUES ($1, $2::pg_snapshot)
      RETURNING snapshot_id::text AS id`, [inst, oldSnap]);
  await slotIn(inst, [[c, 1, 2, young.snapshot, 8000]]);
  await slotIn(inst, [[c, 1, 1, Number(old), 6000]]);
  assert.equal(await seam(c, ledger[all - 2].through_sp, Number(ledger[all - 2].through_seq)), 6000, 'the requeued older echo still certifies its shorter prefix');
  assert.equal(await seam(c, ledger[all - 1].through_sp, Number(ledger[all - 1].through_seq)), 8000);
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
  // RE-ANCHORED by S8B-07 RB-2 / M-2 (PR #408 CI, 2026-11-24): each governed erasure of a fixture human queued its
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
  await q('DELETE FROM voice_private.call_clock_snapshots WHERE instance_id = ANY($1::uuid[])', [fixtureInstances]);
  const [{ n }] = await rows(`SELECT (SELECT count(*) FROM voice_private.call_clock_marks WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.call_clock_cert_ranges WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM ${LEDGER} WHERE user_id = ANY($1::uuid[])) AS n`, [fixtureHumans]);
  assert.equal(Number(n), 0, 'no fixture mark, range or ledger row is left behind');
}

runVerifier('0203', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  assert.ok(readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').includes('server_call_clock_slot_v1'));
  const report = createScenarioReport('0203', { query: q, restore: async () => { await q('RESET ROLE').catch(() => undefined); } });
  try {
    setStage('C catalogue');
    await verifyCatalogue(report);
    setStage('world');
    const w = {};
    {
      const user = await human();
      const session = await newSession(user);
      const call = await liveCall(user, session);
      w.m = { user, session, call };
    }
    setStage('M acceptance');
    await verifyAcceptance(report, w);
    w.live = w.m.call;
    setStage('D planted defects');
    await verifyPlantedDefects(report, w);
  } finally {
    setStage('fixture removal');
    await removeFixtures();
  }
  console.log(`0203 metrics ${JSON.stringify(metrics)}`);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
