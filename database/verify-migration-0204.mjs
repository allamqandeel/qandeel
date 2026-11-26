// Real-PostgreSQL verifier for migration 0204 (INTEL-LIVE-01 CP1: continuous in-speech understanding — the call's
// provisional attention, its evidence coverage and its settlement), under the Product Owner's "INTEL-LIVE-01 — Final PO
// Execution Authorization" of 2026-11-25 on the CP0 stack v1.0 -> v1.1 -> A1 -> A2. No provider is called. The world is
// COMMITTED; every fixture person is removed at the end THROUGH the account erasure itself.
//
//   C  catalogue
//      C-01  the three relations are sealed (RLS, no grant); every definer is postgres-owned and pinned; service_role
//            reaches exactly the five public functions
//      C-02  the census: the three relations are ACCOUNT_CASCADE, every reference cascades, nothing referencing the account
//            is unregistered; an attention event holds no transcript column
//      C-03  the narrow widenings: the permit kind PROVISIONAL_ATTENTION is granted (and an unknown kind refused); the
//            cost family LIVE_ATTENTION_EVALUATION is admitted (and an unknown family refused)
//   W  the one writer
//      W-01  a DEVELOPMENTS result writes its coverage row and its events in ONE transaction, in the model's order, and
//            advances the watermark; produced is the evaluation's instant
//      W-02  a resend of the same span's success is ALREADY_COVERED: nothing is written
//      W-03  TIMEOUT / REFUSED / PROVIDER_FAILED / DEFERRED_PERMIT are recorded and never advance the watermark; the next
//            success covers everything since the watermark
//      W-04  a success that starts before the watermark is recorded STALE_RESULT and writes no event
//      W-05  MISSED_HANDOVER and DEGRADED_SUSPENDED are explicit misses: recorded, and they account for their span
//      W-06  malformed input is refused whole (22023 / 23514): an anchor outside the span, evidence after production, a
//            Thread reference that is not the person's own, events on NONE, an empty DEVELOPMENTS, an over-long label
//      W-07  an older connection is FENCED and another person's call is NOT_FOUND: nothing is written
//      W-08  two writers of one call are serialised by the call's lock: the second resend of a span waits, then answers
//            ALREADY_COVERED; numbers are gap-free
//   R  the readers
//      R-01  the state: per-track watermark and open subjects; WITHDRAW closes, a later SET reopens; the tracks are
//            independent; an ENDED call reports nothing open and a late success is STALE_AFTER_END
//      R-02  the evaluator's Threads: the person's own Threads of the call's session under the name COSMOS shows (the
//            newest alias), most recently bound first; an unnamed Thread, another session's and another person's are not
//            listed; the limit is bounded
//   S  settlement (identity by Thread id, never by text)
//      S-01  a half not yet terminal is NOT_READY and writes nothing
//      S-02  a COMPLETE USER half: an open SET whose Thread the turn's unit established is CONFIRMED; no Thread, or
//            another Thread of the person, is EXPIRED; a SET anchored past the window (+ slack) stays open; idempotent
//      S-03  a COMPLETE ASSISTANT half settles the QANDEEL track only
//      S-04  an ABANDONED_INTEGRITY half expires even a matching Thread
//      S-05  a success wholly inside a settled region is STALE_AFTER_SETTLEMENT
//      S-06  the sweep: a terminal half of a call with events and no marker (a crash between completion and settlement)
//            is settled once; a call without attention is not touched
//   E  erasure: the account erasure removes every attention row (cascade)
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

const MIGRATION = '0204_intel_live_01_call_attention_v1.sql';
const RECORD = 'public.server_record_call_attention_evaluation_v1(uuid,uuid,bigint,text,bigint,bigint,text,bigint,bigint,integer,integer,integer,integer,jsonb)';
const READ = 'public.server_read_call_attention_state_v1(uuid,uuid)';
const SETTLE = 'public.server_settle_call_attention_v1(uuid,uuid,integer,text)';
const SWEEP = 'public.server_settle_due_call_attention_v1(integer)';
const THREADS = 'public.server_read_call_attention_threads_v1(uuid,uuid,integer)';
const PUBLIC_FNS = [RECORD, READ, THREADS, SETTLE, SWEEP];
const INTERNAL_FNS = [
  'voice_private.call_attention_settlement_slack_ms_v1()',
  'voice_private.lock_call_attention_v1(uuid)',
  'voice_private.call_attention_accounted_to_v1(uuid,text)',
  'voice_private.call_attention_settled_through_v1(uuid,text)',
  'voice_private.call_attention_open_v1(uuid,text)',
  'voice_private.call_attention_turn_threads_v1(uuid)',
  'voice_private.settle_call_attention_half_v1(uuid,integer,text)',
];
const RELATIONS = ['voice_private.call_attention_evaluations', 'voice_private.call_attention_events',
  'voice_private.call_attention_settlements'];
const ROLES = ['anon', 'authenticated', 'service_role', 'qandeel_replay_media'];

const fixtureHumans = [];
const erasedHumans = new Set();
const releasedKeys = [];
const seededThreads = [];

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
/** The operation must be refused with one of the codes, and leave nothing behind (its own transaction rolls back). */
async function refusedTx(operation, codes) {
  let error;
  await q('BEGIN');
  try { await operation(); } catch (caught) { error = caught; } finally { await q('ROLLBACK').catch(() => undefined); }
  assert.ok(error, 'the operation was unexpectedly admitted');
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
}

// ------------------------------------------------------------------ the RPCs, as service_role
const ev = (op, subjectKey, anchorClockMs, evidenceClockMs, extra = {}) => ({
  op, subjectKey, label: extra.label ?? `subject ${subjectKey}`, kind: extra.kind ?? 'TOPIC', confidence: extra.confidence ?? 'HIGH',
  threadRef: extra.threadRef ?? null, anchorClockMs, evidenceClockMs,
});
/** One writer call in the caller's open transaction. */
const recordIn = (r) => asRoleLocal('service_role', async () => {
  const [x] = await rows(`SELECT outcome, eval_seq::text AS eval_seq, accounted_to_clock_ms::text AS accounted,
      first_event_seq::text AS first, last_event_seq::text AS last
      FROM public.server_record_call_attention_evaluation_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
  [r.user, r.call, r.epoch ?? 1, r.track ?? 'USER', r.from, r.to, r.outcome, r.admitted ?? null, r.produced ?? null,
    r.providerMs ?? null, r.prompt ?? null, r.cached ?? null, r.completion ?? null,
    r.events === undefined || r.events === null ? null : JSON.stringify(r.events)]);
  const n = (v) => (v === null ? null : Number(v));
  return { outcome: x.outcome, evalSeq: n(x.eval_seq), accounted: n(x.accounted), first: n(x.first), last: n(x.last) };
});
const record = (r) => tx(() => recordIn(r));
/** A successful evaluation's measurements (admitted before produced; produced after every evidence instant). */
const success = (base, from, to, events, produced = to + 400) => ({
  ...base, from, to, outcome: events ? 'DEVELOPMENTS' : 'NONE', events, admitted: to + 50, produced,
  providerMs: 300, prompt: 1200, cached: 900, completion: 60,
});
const state = (user, call) => tx(() => asRoleLocal('service_role', () => rows(`SELECT track, accounted_to_clock_ms::text AS accounted,
    settled_through_clock_ms::text AS settled, last_eval_seq::text AS last_eval, last_event_seq::text AS last_event, call_ended,
    open_subjects FROM public.server_read_call_attention_state_v1($1, $2) ORDER BY track`, [user, call])))
  .then((answer) => Object.fromEntries(answer.map((r) => [r.track, {
    accounted: Number(r.accounted), settled: Number(r.settled), lastEval: r.last_eval === null ? null : Number(r.last_eval),
    lastEvent: r.last_event === null ? null : Number(r.last_event), ended: r.call_ended,
    open: r.open_subjects.map((o) => o.subjectKey),
  }])));
const settle = (user, call, idx, half) => tx(() => asRoleLocal('service_role', async () => {
  const [x] = await rows('SELECT outcome, confirmed, expired FROM public.server_settle_call_attention_v1($1, $2, $3, $4)', [user, call, idx, half]);
  return [x.outcome, x.confirmed, x.expired];
}));
const sweep = (limit = 500) => tx(() => asRoleLocal('service_role', () =>
  rows('SELECT call_id, call_turn_index, half, outcome, confirmed, expired FROM public.server_settle_due_call_attention_v1($1)', [limit])));
const eventsOf = (call) => rows(`SELECT event_seq::int AS seq, track, op, subject_key AS key, thread_ref::text AS thread,
    eval_seq::int AS eval, anchor_clock_ms::int AS anchor, evidence_clock_ms::int AS evidence, produced_clock_ms::int AS produced,
    settles_event_seq::int AS settles, call_turn_index AS idx
    FROM voice_private.call_attention_events WHERE call_id = $1 ORDER BY event_seq`, [call]);
const evaluationsOf = (call) => rows(`SELECT eval_seq::int AS seq, track, covers_from_clock_ms::int AS "from", covers_to_clock_ms::int AS "to",
    outcome FROM voice_private.call_attention_evaluations WHERE call_id = $1 ORDER BY eval_seq`, [call]);

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
/** An ACTIVE call with a STORED recording: { recording, call }. */
async function callRecording(user, session) {
  return tx(async () => {
    const id = randomUUID();
    const [{ t }] = await rows('SELECT clock_timestamp()::text AS t');
    const call = await fixtureCall(q, rows, { id: randomUUID(), user, session, startedAt: t });
    await q(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
               recording_state, sealed_by)
             VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`,
    [id, user, session, call, t]);
    for (const track of ['USER', 'QANDEEL']) {
      await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                 byte_size, clock_start_ms, clock_end_ms, upload_deadline, stored_at)
               VALUES ($1, $2, 0, $3, 'STORED', 'audio/ogg', 1000, 0, 600000, clock_timestamp(), clock_timestamp())`,
      [id, track, `voice-call/${randomUUID()}`]);
    }
    return { recording: id, call };
  });
}
const endCall = (call) => tx(() => q(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(),
  grace_until = NULL, seat_lease_until = NULL WHERE id = $1 AND state <> 'ENDED'`, [call]));
/** One voiced turn of one unit, committed: { turn, unit, sp }. */
async function commitTurn(user, session, role, voice) {
  return tx(async () => {
    const [{ sp: before }] = await rows('SELECT coalesce((SELECT current_sp FROM public.session_semantic_clocks WHERE session_id = $1), 0) AS sp', [session]);
    const sp = Number(before) + 1;
    const turn = randomUUID();
    const batch = randomUUID();
    const unit = randomUUID();
    const content = `turn at ${sp}`;
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`,
      [turn, session, user, role, content]);
    await q(`INSERT INTO public.conversation_unit_commit_batches (id, user_id, session_id, source_turn_id, canonical_fingerprint,
               source_content_sha256, unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
               segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256($5::bytea), sha256($5::bytea), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, user, session, turn, Buffer.from(`${session}:${turn}`)]);
    const assistant = role === 'ASSISTANT';
    await q(`INSERT INTO public.conversation_turn_voice_sources
               (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
                anchor_start_ms, anchor_end_ms, spoken, delivery_state)
             VALUES ($1, $2, $3, $4, 'LIVE_CALL_SPEECH', $5, $6, $7, $8, $9, $10, $11)`,
    [turn, user, session, role, assistant ? null : 'MACHINE_ASR', assistant ? null : 'HIGH', voice.recording, voice.a, voice.b,
      assistant ? true : null, assistant ? 'COMPLETE' : null]);
    await q(`INSERT INTO public.conversation_units (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
               source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
             VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'LIVE_CALL_SPEECH', 0, 0, $7, $8, sha256(convert_to($8, 'UTF8')), $9)`,
    [unit, user, session, turn, batch, role, [...content].length, content, sp]);
    await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
    return { turn, unit, sp };
  });
}
/**
 * A durable Thread established at a unit. Fixture surgery, never Product behaviour: the establishment pipeline (focus,
 * grounding, evidence, the World authority) is not what this migration reads, so only the rows the settlement reads by id
 * are seeded, with the Thread guards and references standing aside. They are removed again before the erasure (removeFixtures).
 */
async function seedThread(user, session, unit, sp) {
  const thread = randomUUID();
  const focus = randomUUID();
  await tx(async () => {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q(`INSERT INTO public.conversation_emerging_focuses (id, user_id, session_id, grounding_handle_id, started_cu_id, started_sp,
               started_event_sequence) VALUES ($1, $2, $3, gen_random_uuid(), $4, $5, 1)`, [focus, user, session, unit, sp]);
    await q(`INSERT INTO public.conversation_threads (id, user_id, grounding_emerging_focus_id, established_session_id, established_cu_id,
               established_sp, established_event_sequence, establishment_path) VALUES ($1, $2, $3, $4, $5, $6, 2, 'TE-01')`,
    [thread, user, focus, session, unit, sp]);
  });
  seededThreads.push({ thread, focus, user });
  return thread;
}
/** The durable analysis half of a call turn, in a given state. */
const queueHalf = (call, idx, half, user, session, turn, queueState) => tx(() => q(`INSERT INTO voice_private.call_analysis_queue
    (call_id, call_turn_index, half, user_id, session_id, turn_id, queue_state, settled_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 IN ('COMPLETE', 'ABANDONED_INTEGRITY') THEN clock_timestamp() END)
  ON CONFLICT (call_id, call_turn_index, half) DO UPDATE SET queue_state = excluded.queue_state, settled_at = excluded.settled_at`,
[call, idx, half, user, session, turn, queueState]));

// ------------------------------------------------------------------ C: catalogue
async function verifyCatalogue(report) {
  await report.section('C-01 the relations are sealed and the definers pinned; service_role reaches exactly the five public functions', async () => {
    for (const rel of RELATIONS) {
      const [t] = await rows('SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid = $1::regclass', [rel]);
      assert.deepEqual([t.rls, t.owner], [true, 'postgres'], `${rel} is postgres-owned with RLS`);
      for (const role of ROLES) {
        const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
            OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, rel]);
        assert.equal(any, false, `${role} holds nothing on ${rel}`);
      }
    }
    for (const fn of [...PUBLIC_FNS, ...INTERNAL_FNS]) {
      const [p] = await rows(`SELECT p.prosecdef AS def, pg_get_userbyid(p.proowner) AS owner, p.proconfig AS cfg
          FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [fn]);
      assert.ok(p, `${fn} exists`);
      assert.deepEqual([p.def, p.owner, p.cfg], [true, 'postgres', ['search_path=""']], `${fn} is a pinned postgres definer`);
      for (const role of ROLES) {
        const [{ x }] = await rows(`SELECT has_function_privilege($1, to_regprocedure($2), 'EXECUTE') AS x`, [role, fn]);
        assert.equal(x, role === 'service_role' && PUBLIC_FNS.includes(fn), `${role} on ${fn}`);
      }
    }
  });
  await report.section('C-02 the census: ACCOUNT_CASCADE, every reference cascades, nothing unregistered, no transcript column', async () => {
    const reg = await rows(`SELECT relation, coverage FROM account_erasure_private.coverage_registry
                             WHERE relation LIKE 'voice_private.call_attention_%' ORDER BY 1`);
    assert.deepEqual(reg.map((r) => [r.relation, r.coverage]), [
      ['voice_private.call_attention_evaluations', 'ACCOUNT_CASCADE'], ['voice_private.call_attention_events', 'ACCOUNT_CASCADE'],
      ['voice_private.call_attention_settlements', 'ACCOUNT_CASCADE']]);
    const missing = await rows(`SELECT DISTINCT c.conrelid::regclass::text AS r FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
          AND c.conrelid::regclass::text NOT IN (SELECT relation FROM account_erasure_private.coverage_registry)`);
    assert.deepEqual(missing, []);
    const fks = await rows(`SELECT c.conrelid::regclass::text AS r, c.confdeltype AS del FROM pg_constraint c
        WHERE c.contype = 'f' AND c.conrelid::regclass::text LIKE 'voice_private.call_attention_%'`);
    assert.ok(fks.length >= 7 && fks.every((f) => f.del === 'c'), 'every reference cascades');
    const cols = await rows(`SELECT attname FROM pg_attribute WHERE attrelid = 'voice_private.call_attention_events'::regclass AND attnum > 0
        AND NOT attisdropped ORDER BY attnum`);
    assert.deepEqual(cols.map((c) => c.attname), ['call_id', 'event_seq', 'user_id', 'session_id', 'track', 'op', 'subject_key', 'label',
      'kind', 'confidence', 'thread_ref', 'eval_seq', 'anchor_clock_ms', 'evidence_clock_ms', 'produced_clock_ms', 'settles_event_seq',
      'call_turn_index', 'xact_id', 'recorded_at'], 'an attention event holds a bounded label, never a transcript');
    const [{ n }] = await rows(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
        WHERE c.relkind = 'r' AND ((s.nspname = 'public' AND c.relname ~ '^replay') OR s.nspname = 'replay_private')`);
    assert.equal(n, 36, 'the Replay census is unchanged');
  });
  await report.section('C-03 the permit kind PROVISIONAL_ATTENTION and the cost family LIVE_ATTENTION_EVALUATION are admitted', async () => {
    const user = await human();
    const holder = randomUUID();
    const [granted] = await tx(() => asRoleLocal('service_role', () =>
      rows("SELECT outcome FROM public.server_acquire_background_permit_v1($1, 'PROVISIONAL_ATTENTION', $2, false)", [user, holder])));
    assert.equal(granted.outcome, 'GRANTED');
    const [{ kind }] = await rows('SELECT work_kind AS kind FROM voice_private.background_provider_permits WHERE holder = $1', [holder]);
    assert.equal(kind, 'PROVISIONAL_ATTENTION');
    await tx(() => asRoleLocal('service_role', () => q('SELECT public.server_release_background_permit_v1($1)', [holder])));
    await refusedTx(() => asRoleLocal('service_role', () =>
      q("SELECT public.server_acquire_background_permit_v1($1, 'PROVISIONAL_GUESS', $2, false)", [user, randomUUID()])), ['22023']);
    const [{ admitted, refused }] = await rows(`SELECT pg_get_constraintdef(c.oid) ~ 'LIVE_ATTENTION_EVALUATION' AS admitted,
        pg_get_constraintdef(c.oid) ~ 'LIVE_ATTENTION_GUESS' AS refused
        FROM pg_constraint c WHERE c.conname = 'ai_provider_calls_feature_family_check'`);
    assert.deepEqual([admitted, refused], [true, false]);
    for (const family of ['CONVERSATION_REPLY', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_RENDERING']) {
      const [{ kept }] = await rows(`SELECT pg_get_constraintdef(c.oid) ~ $1 AS kept FROM pg_constraint c
          WHERE c.conname = 'ai_provider_calls_feature_family_check'`, [family]);
      assert.ok(kept, `${family} is still admitted`);
    }
  });
}

// ------------------------------------------------------------------ W: the one writer
async function verifyWriter(report, w) {
  const { user, call } = w.a;
  const base = { user, call };
  await report.section('W-01 one transaction: the coverage row and its events in the model\'s order; the watermark advances', async () => {
    const r = await record(success(base, 0, 4200, [ev('SET', 'job-change', 800, 2100), ev('SET', 'sister-cairo', 3100, 4200,
      { kind: 'PERSON' })]));
    assert.deepEqual(r, { outcome: 'RECORDED', evalSeq: 1, accounted: 4200, first: 1, last: 2 });
    const events = await eventsOf(call);
    assert.deepEqual(events.map((e) => [e.seq, e.op, e.key, e.eval, e.anchor, e.evidence, e.produced]), [
      [1, 'SET', 'job-change', 1, 800, 2100, 4600], [2, 'SET', 'sister-cairo', 1, 3100, 4200, 4600]]);
    const [row] = await rows(`SELECT outcome, admitted_clock_ms::int AS a, produced_clock_ms::int AS p, produced_at IS NOT NULL AS at,
        prompt_tokens AS pt, cache_hit_tokens AS ch, completion_tokens AS ct FROM voice_private.call_attention_evaluations
        WHERE call_id = $1 AND eval_seq = 1`, [call]);
    assert.deepEqual(row, { outcome: 'DEVELOPMENTS', a: 4250, p: 4600, at: true, pt: 1200, ch: 900, ct: 60 });
    const [{ same }] = await rows(`SELECT count(DISTINCT xact_id) = 1 AS same FROM (
        SELECT xact_id FROM voice_private.call_attention_evaluations WHERE call_id = $1 AND eval_seq = 1
        UNION ALL SELECT xact_id FROM voice_private.call_attention_events WHERE call_id = $1 AND eval_seq = 1) x`, [call]);
    assert.ok(same, 'the coverage row and its events committed in one transaction');
  });
  await report.section('W-02 a resend of the same span\'s success is ALREADY_COVERED and writes nothing', async () => {
    const r = await record(success(base, 0, 4200, [ev('SET', 'job-change', 800, 2100)]));
    assert.deepEqual([r.outcome, r.evalSeq, r.accounted], ['ALREADY_COVERED', 1, 4200]);
    const none = await record(success(base, 0, 4200, null));
    assert.equal(none.outcome, 'ALREADY_COVERED', 'a NONE resend of a covered span is also ALREADY_COVERED');
    assert.equal((await evaluationsOf(call)).length, 1);
    assert.equal((await eventsOf(call)).length, 2);
  });
  await report.section('W-03 TIMEOUT / REFUSED / PROVIDER_FAILED / DEFERRED_PERMIT never advance; the next success covers it all', async () => {
    let to = 6000;
    for (const outcome of ['TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT']) {
      const r = await record({ ...base, from: 4200, to, outcome, admitted: outcome === 'DEFERRED_PERMIT' ? null : to });
      assert.deepEqual([r.outcome, r.accounted], ['RECORDED', 4200], `${outcome} leaves the watermark at 4200`);
      to += 1500;
    }
    const all = await record(success(base, 4200, 12000, null));
    assert.deepEqual([all.outcome, all.accounted], ['RECORDED', 12000], 'the success after the failures covers (4200, 12000]');
    const ev2 = await evaluationsOf(call);
    assert.deepEqual(ev2.map((e) => e.outcome), ['DEVELOPMENTS', 'TIMEOUT', 'REFUSED', 'PROVIDER_FAILED', 'DEFERRED_PERMIT', 'NONE']);
    assert.deepEqual(ev2.map((e) => e.seq), [1, 2, 3, 4, 5, 6], 'evaluation numbers are gap-free');
  });
  await report.section('W-04 a success starting before the watermark is STALE_RESULT and writes no event', async () => {
    // (4200 itself is ALREADY_COVERED: a success of that span exists.) A span overlapping the covered region from inside it:
    const r = await record(success(base, 5000, 9000, [ev('WITHDRAW', 'job-change', 5000, 9000)]));
    assert.equal(r.outcome, 'STALE_RESULT');
    assert.equal(r.accounted, 12000, 'a stale result never moves the watermark');
    assert.equal((await eventsOf(call)).length, 2, 'no event of a late evaluation overwrites newer understanding');
    const [{ outcome }] = await rows('SELECT outcome FROM voice_private.call_attention_evaluations WHERE call_id = $1 AND eval_seq = $2', [call, r.evalSeq]);
    assert.equal(outcome, 'STALE_RESULT', 'the refusal is recorded');
  });
  await report.section('W-05 MISSED_HANDOVER and DEGRADED_SUSPENDED are explicit misses that account for their span', async () => {
    const m = await record({ ...base, from: 12000, to: 15000, outcome: 'MISSED_HANDOVER' });
    assert.deepEqual([m.outcome, m.accounted], ['RECORDED', 15000]);
    const d = await record({ ...base, from: 15000, to: 16000, outcome: 'DEGRADED_SUSPENDED' });
    assert.deepEqual([d.outcome, d.accounted], ['RECORDED', 16000]);
    // Every millisecond of evidence up to the watermark is covered or explicitly missed: the accounted spans tile it.
    const spans = (await evaluationsOf(call)).filter((e) => ['DEVELOPMENTS', 'NONE', 'MISSED_HANDOVER', 'DEGRADED_SUSPENDED'].includes(e.outcome));
    let at = 0;
    for (const s of spans) { assert.equal(s.from, at, `the accounted spans are contiguous at ${at}`); at = s.to; }
    assert.equal(at, 16000);
  });
  await report.section('W-06 malformed input is refused whole and leaves nothing', async () => {
    const before = [(await evaluationsOf(call)).length, (await eventsOf(call)).length];
    const other = w.b.user;
    const foreignThread = w.b.thread;
    for (const [name, r, codes] of [
      ['anchor outside the span', success(base, 16000, 18000, [ev('SET', 'x', 15999, 17000)]), ['22023']],
      ['evidence after production', success(base, 16000, 18000, [ev('SET', 'x', 16500, 18500)], 18400), ['22023']],
      ['a Thread that is not the person\'s', success(base, 16000, 18000, [ev('SET', 'x', 16500, 17000, { threadRef: foreignThread })]), ['22023']],
      ['an unknown Thread', success(base, 16000, 18000, [ev('SET', 'x', 16500, 17000, { threadRef: randomUUID() })]), ['22023']],
      ['events on NONE', { ...success(base, 16000, 18000, null), events: [ev('SET', 'x', 16500, 17000)] }, ['22023']],
      ['an empty DEVELOPMENTS', { ...success(base, 16000, 18000, []), outcome: 'DEVELOPMENTS' }, ['22023']],
      ['an over-long label', success(base, 16000, 18000, [ev('SET', 'x', 16500, 17000, { label: 'x'.repeat(41) })]), ['23514']],
      ['a control character in a label', success(base, 16000, 18000, [ev('SET', 'x', 16500, 17000, { label: 'a\nb' })]), ['23514']],
      ['a malformed subject key', success(base, 16000, 18000, [ev('SET', 'Job Change', 16500, 17000)]), ['23514']],
      ['an unknown op', success(base, 16000, 18000, [ev('CONFIRMED', 'x', 16500, 17000)]), ['22023']],
      ['an empty span', success(base, 16000, 16000, null), ['22023']],
      ['a success without production', { ...base, from: 16000, to: 18000, outcome: 'NONE' }, ['22023']],
      ['a settlement outcome from the writer', { ...base, from: 16000, to: 18000, outcome: 'STALE_RESULT' }, ['22023']],
    ]) await refusedTx(() => recordIn(r), codes).catch((e) => { throw new Error(`${name}: ${e.message}`); });
    assert.deepEqual([(await evaluationsOf(call)).length, (await eventsOf(call)).length], before, 'nothing was written');
    assert.ok(other);
  });
  await report.section('W-07 an older connection is FENCED and another person\'s call is NOT_FOUND', async () => {
    await tx(() => q('UPDATE voice_private.calls SET connection_epoch = 2 WHERE id = $1', [call]));
    const fenced = await record(success({ ...base, epoch: 1 }, 16000, 18000, null));
    assert.deepEqual([fenced.outcome, fenced.evalSeq], ['FENCED', null]);
    const foreign = await record(success({ user: w.b.user, call, epoch: 2 }, 16000, 18000, null));
    assert.equal(foreign.outcome, 'NOT_FOUND');
    const current = await record(success({ ...base, epoch: 2 }, 16000, 18000, null));
    assert.deepEqual([current.outcome, current.accounted], ['RECORDED', 18000], 'the current connection continues from the watermark');
    w.a.epoch = 2;
  });
  await report.section('W-08 two writers of one call are serialised by its lock: the second resend waits, then ALREADY_COVERED', async () => {
    const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await other.connect();
    try {
      await q('BEGIN');
      const first = await recordIn(success({ ...base, epoch: 2 }, 18000, 20000, [ev('SET', 'exam-plan', 18500, 20000, { kind: 'PLAN' })]));
      assert.equal(first.outcome, 'RECORDED');
      await other.query('BEGIN');
      await other.query('SET LOCAL ROLE service_role');
      const pending = other.query(`SELECT outcome FROM public.server_record_call_attention_evaluation_v1($1, $2, 2, 'USER', 18000, 20000,
          'NONE', 20050, 20400, 300, 1200, 900, 60, NULL)`, [user, call]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const [{ waiting }] = await rows(`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
        [other.processID]);
      assert.equal(waiting, 1, 'the second writer waits for the call\'s lock');
      await q('COMMIT');
      const second = await pending;
      assert.equal(second.rows[0].outcome, 'ALREADY_COVERED');
      await other.query('COMMIT');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await other.query('ROLLBACK').catch(() => undefined);
      await other.end().catch(() => undefined);
    }
    const seqs = (await evaluationsOf(call)).map((e) => e.seq);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1), 'evaluation numbers are gap-free');
  });
}

// ------------------------------------------------------------------ R: the state reader
async function verifyReader(report, w) {
  await report.section('R-01 watermark and open subjects per track; WITHDRAW closes, a later SET reopens; tracks independent; ENDED', async () => {
    const { user, call } = w.a;
    const base = { user, call, epoch: w.a.epoch };
    let s = await state(user, call);
    assert.deepEqual(s.USER.open, ['job-change', 'sister-cairo', 'exam-plan']);
    assert.equal(s.USER.accounted, 20000);
    assert.equal(s.USER.settled, -1);
    assert.deepEqual([s.QANDEEL.accounted, s.QANDEEL.open], [0, []], 'the QANDEEL track is independent');
    const r = await record(success(base, 20000, 23000, [ev('WITHDRAW', 'job-change', 21000, 23000), ev('SET', 'sister-cairo', 22000, 23000,
      { kind: 'PERSON', confidence: 'MEDIUM' })]));
    assert.equal(r.outcome, 'RECORDED');
    s = await state(user, call);
    assert.deepEqual(s.USER.open, ['exam-plan', 'sister-cairo'], 'WITHDRAW closes; the re-SET subject is open at its latest event');
    const q1 = await record(success({ ...base, track: 'QANDEEL' }, 0, 3000, [ev('SET', 'job-change', 500, 3000)]));
    assert.deepEqual([q1.outcome, q1.accounted], ['RECORDED', 3000]);
    s = await state(user, call);
    assert.deepEqual([s.QANDEEL.open, s.USER.accounted], [['job-change'], 23000]);
    assert.equal(s.USER.ended, false);
    await endCall(call);
    s = await state(user, call);
    assert.deepEqual([s.USER.ended, s.USER.open, s.QANDEEL.open], [true, [], []], 'attention expires with the call');
    const late = await record(success(base, 23000, 25000, [ev('SET', 'late', 23500, 25000)]));
    assert.equal(late.outcome, 'STALE_AFTER_END');
    assert.equal(late.accounted, 23000);
    assert.deepEqual(await state(w.b.user, call), {}, 'another person reads nothing of this call');
  });
}

async function verifyThreadsReader(report, w) {
  await report.section("R-02 the evaluator's Threads: own, of the session, named as COSMOS names them, most recent first", async () => {
    const { user, session, recording, call } = w.s;
    const read = (u, c, limit = 64) => tx(() => asRoleLocal('service_role', () =>
      rows('SELECT thread_id::text AS id, name FROM public.server_read_call_attention_threads_v1($1, $2, $3)', [u, c, limit])));
    const t1 = await commitTurn(user, session, 'USER', { recording, a: 100, b: 200 });
    const named = await seedThread(user, session, t1.unit, t1.sp);
    const t2 = await commitTurn(user, session, 'USER', { recording, a: 300, b: 400 });
    const newer = await seedThread(user, session, t2.unit, t2.sp);
    const t3 = await commitTurn(user, session, 'USER', { recording, a: 500, b: 600 });
    await seedThread(user, session, t3.unit, t3.sp); // no alias, no grounding wording: nothing truthful to name it by
    await alias(named, user, 'شغل جديد');
    await alias(named, user, '  الشغل   الجديد ');
    await alias(newer, user, 'Cairo move');
    assert.deepEqual(await read(user, call), [{ id: newer, name: 'Cairo move' }, { id: named, name: '  الشغل   الجديد ' }],
      'the newest alias names the Thread; the most recently bound first; the unnamed one is not listed');
    assert.deepEqual(await read(user, call, 1), [{ id: newer, name: 'Cairo move' }]);
    assert.deepEqual(await read(w.b.user, call), [], 'another person reads nothing of this call');
    assert.deepEqual(await read(user, w.s.quiet.call), [], "a call of another person's session lists nothing");
    await alias(w.b.thread, w.b.user, 'not yours');
    assert.ok(!(await read(user, call)).some((t) => t.id === w.b.thread), "another person's Thread is never listed");
    for (const limit of [0, 65]) {
      await refusedTx(() => asRoleLocal('service_role', () => q('SELECT * FROM public.server_read_call_attention_threads_v1($1, $2, $3)',
        [user, call, limit])), ['22023']);
    }
  });
}
/** A Thread's alias, as the person's own rename ledger holds it (0198; inserted directly: fixture surgery). */
const alias = (thread, user, text) => tx(() => q('INSERT INTO public.conversation_thread_aliases (thread_id, user_id, alias) VALUES ($1, $2, $3)',
  [thread, user, text]));

// ------------------------------------------------------------------ S: settlement
async function verifySettlement(report, w) {
  const { user, session, recording, call } = w.s;
  const base = { user, call };
  // Turn 1: USER speech on [1000, 9000]; its unit establishes Thread T. Turn 1's reply: QANDEEL on [9500, 14000].
  const userTurn = await commitTurn(user, session, 'USER', { recording, a: 1000, b: 9000 });
  const thread = await seedThread(user, session, userTurn.unit, userTurn.sp);
  const replyTurn = await commitTurn(user, session, 'ASSISTANT', { recording, a: 9500, b: 14000 });
  const otherThread = w.s.otherThread;
  await record(success(base, 0, 6000, [ev('SET', 'cairo-move', 2000, 6000, { threadRef: thread, kind: 'PLACE' }),
    ev('SET', 'new-colleague', 3000, 6000, { kind: 'PERSON' }), ev('SET', 'old-topic', 4000, 6000, { threadRef: otherThread })]));
  await record(success(base, 6000, 12000, [ev('SET', 'after-window', 10500, 12000)]));
  await record(success({ ...base, track: 'QANDEEL' }, 9500, 14000, [ev('SET', 'cairo-move', 10000, 14000, { threadRef: thread })]));

  await report.section('S-01 a half not yet terminal is NOT_READY and writes nothing', async () => {
    assert.deepEqual(await settle(user, call, 1, 'USER'), ['NOT_READY', 0, 0], 'no queue row at all');
    await queueHalf(call, 1, 'USER', user, session, userTurn.turn, 'PENDING');
    assert.deepEqual(await settle(user, call, 1, 'USER'), ['NOT_READY', 0, 0], 'PENDING');
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM voice_private.call_attention_settlements WHERE call_id = $1', [call]);
    assert.equal(n, 0);
    assert.deepEqual(await settle(w.a.user, call, 1, 'USER'), ['NOT_FOUND', 0, 0], 'another person cannot settle this call');
  });
  await report.section('S-02 a COMPLETE USER half: CONFIRMED by Thread id, EXPIRED otherwise, past-window stays open; idempotent', async () => {
    await queueHalf(call, 1, 'USER', user, session, userTurn.turn, 'COMPLETE');
    assert.deepEqual(await settle(user, call, 1, 'USER'), ['SETTLED', 1, 2]);
    const closing = (await eventsOf(call)).filter((e) => e.settles !== null);
    assert.deepEqual(closing.map((e) => [e.track, e.op, e.key, e.thread, e.idx]), [
      ['USER', 'CONFIRMED', 'cairo-move', thread, 1], ['USER', 'EXPIRED', 'new-colleague', null, 1],
      ['USER', 'EXPIRED', 'old-topic', otherThread, 1]], 'identity by Thread id: the same person\'s other Thread does not confirm');
    const s = await state(user, call);
    assert.deepEqual(s.USER.open, ['after-window'], 'a SET anchored past window end + slack (10000) stays open');
    assert.equal(s.USER.settled, 10000);
    assert.deepEqual(s.QANDEEL.open, ['cairo-move'], 'the QANDEEL track is untouched by the USER half');
    assert.deepEqual(await settle(user, call, 1, 'USER'), ['ALREADY_SETTLED', 0, 0]);
    assert.equal((await eventsOf(call)).filter((e) => e.settles !== null).length, 3, 'a second settlement writes nothing');
  });
  await report.section('S-03 a COMPLETE ASSISTANT half settles the QANDEEL track only', async () => {
    await queueHalf(call, 1, 'ASSISTANT', user, session, replyTurn.turn, 'COMPLETE');
    // The reply's unit established no Thread: the QANDEEL SET referencing T expires (its Thread is not one the reply bound).
    assert.deepEqual(await settle(user, call, 1, 'ASSISTANT'), ['SETTLED', 0, 1]);
    const s = await state(user, call);
    assert.deepEqual([s.QANDEEL.open, s.QANDEEL.settled, s.USER.open], [[], 15000, ['after-window']]);
  });
  await report.section('S-04 an ABANDONED_INTEGRITY half expires even a matching Thread', async () => {
    const turn2 = await commitTurn(user, session, 'USER', { recording, a: 15000, b: 20000 });
    const t2 = await seedThread(user, session, turn2.unit, turn2.sp);
    await record(success(base, 12000, 20000, [ev('SET', 'second-thread', 16000, 20000, { threadRef: t2 })]));
    await queueHalf(call, 2, 'USER', user, session, turn2.turn, 'ABANDONED_INTEGRITY');
    assert.deepEqual(await settle(user, call, 2, 'USER'), ['SETTLED', 0, 2], 'both open USER SETs inside the window expire');
    const [m] = await rows(`SELECT half_state, window_start_ms::int AS a, window_end_ms::int AS b, settled_through_clock_ms::int AS t
        FROM voice_private.call_attention_settlements WHERE call_id = $1 AND track = 'USER' AND call_turn_index = 2`, [call]);
    assert.deepEqual(m, { half_state: 'ABANDONED_INTEGRITY', a: 15000, b: 20000, t: 21000 });
  });
  await report.section('S-05 a success wholly inside a settled region is STALE_AFTER_SETTLEMENT', async () => {
    // QANDEEL accounted to 14000 and settled through 15000: a result covering (14000, 15000] arrived after settlement.
    const r = await record(success({ ...base, track: 'QANDEEL' }, 14000, 15000, [ev('SET', 'too-late', 14200, 15000)]));
    assert.deepEqual([r.outcome, r.accounted], ['STALE_AFTER_SETTLEMENT', 14000]);
    const after = await record(success({ ...base, track: 'QANDEEL' }, 14000, 17000, null));
    assert.deepEqual([after.outcome, after.accounted], ['RECORDED', 17000], 'a span reaching past the settled region is accepted');
  });
  await report.section('S-06 the sweep settles a terminal half left without a marker, once; a call without attention is untouched', async () => {
    const turn3 = await commitTurn(user, session, 'USER', { recording, a: 22000, b: 26000 });
    await record(success(base, 20000, 26000, [ev('SET', 'crash-window', 23000, 26000)]));
    // The worker completed the half and crashed before settling it.
    await queueHalf(call, 3, 'USER', user, session, turn3.turn, 'COMPLETE');
    const quiet = w.s.quiet;
    const quietTurn = await commitTurn(quiet.user, quiet.session, 'USER', { recording: quiet.recording, a: 1000, b: 4000 });
    await queueHalf(quiet.call, 1, 'USER', quiet.user, quiet.session, quietTurn.turn, 'COMPLETE');
    const swept = (await sweep()).filter((r) => [call, quiet.call].includes(r.call_id));
    assert.deepEqual(swept.map((r) => [r.call_id, r.call_turn_index, r.half, r.outcome, r.confirmed, r.expired]),
      [[call, 3, 'USER', 'SETTLED', 0, 1]], 'the crash window is closed; the call without attention is not swept');
    assert.deepEqual((await sweep()).filter((r) => [call, quiet.call].includes(r.call_id)), [], 'a second sweep finds nothing');
    await refusedTx(() => asRoleLocal('service_role', () => q('SELECT * FROM public.server_settle_due_call_attention_v1(0)')), ['22023']);
  });
}

// ------------------------------------------------------------------ E: erasure
async function verifyErasure(report, w) {
  await report.section('E-01 the account erasure removes every attention row of the person (cascade)', async () => {
    const user = w.s.user;
    const count = async () => Number((await rows(`SELECT (SELECT count(*) FROM voice_private.call_attention_evaluations WHERE user_id = $1)
        + (SELECT count(*) FROM voice_private.call_attention_events WHERE user_id = $1)
        + (SELECT count(*) FROM voice_private.call_attention_settlements WHERE user_id = $1) AS n`, [user]))[0].n);
    assert.ok(await count() > 0, 'the person holds attention rows before the erasure');
    await unseedThreads(user);
    await erase(user);
    assert.equal(await count(), 0, 'the erasure removed them');
  });
}

// ------------------------------------------------------------------ fixture removal through the account erasure itself
async function unseedThreads(user) {
  const mine = seededThreads.filter((t) => t.user === user);
  if (!mine.length) return;
  await tx(async () => {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM public.conversation_thread_aliases WHERE thread_id = ANY($1::uuid[])', [mine.map((t) => t.thread)]);
    await q('DELETE FROM public.conversation_threads WHERE id = ANY($1::uuid[])', [mine.map((t) => t.thread)]);
    await q('DELETE FROM public.conversation_emerging_focuses WHERE id = ANY($1::uuid[])', [mine.map((t) => t.focus)]);
  });
  for (const t of mine) seededThreads.splice(seededThreads.indexOf(t), 1);
}
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
  for (const user of fixtureHumans) await unseedThreads(user);
  for (const user of fixtureHumans) if (!erasedHumans.has(user)) await erase(user);
  // As verify-0203: each governed erasure queued its storage keys in the shared erasure queue; their objects never existed.
  const keys = [...releasedKeys].sort();
  await tx(async () => {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [keys]);
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [fixtureHumans]);
  });
  await rt.removeFixtureHumans(fixtureHumans);
  const [{ n }] = await rows(`SELECT (SELECT count(*) FROM voice_private.call_attention_evaluations WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.call_attention_events WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.call_attention_settlements WHERE user_id = ANY($1::uuid[])) AS n`, [fixtureHumans]);
  assert.equal(Number(n), 0, 'no fixture attention row is left behind');
}

runVerifier('0204', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  assert.ok(readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').includes('server_record_call_attention_evaluation_v1'));
  const report = createScenarioReport('0204', { query: q, restore: async () => { await q('RESET ROLE').catch(() => undefined); } });
  try {
    setStage('C catalogue');
    await verifyCatalogue(report);
    setStage('world');
    const w = {};
    {
      const user = await human();
      const session = await newSession(user);
      const { call, recording } = await callRecording(user, session);
      w.a = { user, session, call, recording };
    }
    {
      const user = await human();
      const session = await newSession(user);
      const { call, recording } = await callRecording(user, session);
      const turn = await commitTurn(user, session, 'USER', { recording, a: 1000, b: 2000 });
      w.b = { user, session, call, thread: await seedThread(user, session, turn.unit, turn.sp) };
    }
    {
      const user = await human();
      const session = await newSession(user);
      const { call, recording } = await callRecording(user, session);
      const other = await commitTurn(user, session, 'USER', { recording, a: 100, b: 900 });
      // One open call per person: the call without attention belongs to a fourth person.
      const quietUser = await human();
      const quietSession = await newSession(quietUser);
      const quiet = await callRecording(quietUser, quietSession);
      w.s = { user, session, call, recording, quiet: { ...quiet, user: quietUser, session: quietSession } };
      w.s.otherThread = await seedThread(user, session, other.unit, other.sp);
    }
    setStage('W writer');
    await verifyWriter(report, w);
    setStage('R reader');
    await verifyReader(report, w);
    setStage('R threads reader');
    await verifyThreadsReader(report, w);
    setStage('S settlement');
    await verifySettlement(report, w);
    setStage('E erasure');
    await verifyErasure(report, w);
  } finally {
    setStage('fixture removal');
    await removeFixtures();
  }
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
