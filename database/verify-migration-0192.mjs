// Real-PostgreSQL verifier for migration 0192 (S8B-05 CP4: full barge-in, the typed turn inside the call and the guard
// of the text paths around a call; Integrated Live Call Contract v1.2 FINAL). No provider is called; every scenario but
// TRC runs in one transaction that is rolled back.
//
//   T0   catalogue: the exchange's new columns and checks; every new definer service_role only, every internal no role's;
//        every forward-replaced function its origin statement plus exactly the declared edits, in 0192 and live; the
//        admission guard on the RECEIVED user row only; the two text paths insert exactly that shape; four scopes DISABLED;
//        the census clean
//   T1   BARGE_IN (P4): fenced by the epoch; the first onset kept (RECORDED, then ALREADY_RECORDED with the first value);
//        it closes nothing; a BARGE_IN for a closed exchange is late (P3): rejected, counted, nothing changed
//   T2   a spoken reply interrupted by a barge-in and closed by the next turn (N1) keeps only what was heard: INTERRUPTED,
//        the heard text, the anchor of the heard part; one close; the next turn in order
//   T3   the typed exchange (D-05-07): COMPLETE / WITHHELD_TAIL with its text and terms, FAILED with none; no playout, no
//        anchor, no voice source; the ASSISTANT call turn TEXT, the delivery read answers it, its half queued, one
//        ConversationTurnCompleted with the stored Safety; the first close wins (ALREADY_CLOSED, nothing rewritten); not
//        fenced by the epoch (a resumed connection closes it); S2 (never without Safety); every refusal writes nothing
//   T4   a typed exchange closed first by N1 or by the call's end is INTERRUPTED with no text, and its late text close
//        answers ALREADY_CLOSED; a spoken exchange is never closed by text, a typed one never by a playout
//   T5   the text paths around a call (A1 C2): a typed REST turn into the live call's session is refused
//        LIVE_CALL_IN_PROGRESS, nothing written, while CONNECTING, ACTIVE and RECONNECTING within the grace; admitted in
//        another session, after the end, and when the call has lapsed (call-truth's reading); the call's own turns unaffected
//   TRC  races on two connections: a typed REST turn vs a call beginning, both orders, serialized by the person's call lock
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';
import { VOICE_CONSENT_V3 } from './qandeel-voice-0188-anchor.mjs';
import { MIGRATION_0192, SUBSTITUTIONS, substitutedStatement } from './live-call-0192-substitutions.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const rejected = (operation, codes, message) => rt.rejected(operation, codes, message);

const DEFINERS = [
  'public.server_record_call_barge_in_v1(uuid,uuid,bigint,integer,bigint)',
  'public.server_read_open_call_exchange_v1(uuid,uuid,bigint)',
  'public.server_close_live_call_text_exchange_v1(uuid,uuid,integer,text,text,text[],uuid,uuid)',
  'public.server_read_call_reply_delivery_v1(uuid,uuid,uuid[])',
];
const INTERNAL = [
  'voice_private.close_call_exchange_core_v1(uuid,integer,text,uuid,uuid)',
  'voice_private.refuse_turn_admission_during_call_v1()',
];
const LIVE = 'PERSONAL_LIVE_CALL';

// ------------------------------------------------------------------ helpers
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
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
async function setGate(scope = LIVE, flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  await rows("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'verify-0192', 'real-PostgreSQL proof')",
    [scope, flag, requirements]);
}
async function setCapacity(capacity) {
  await owner();
  await rows(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'verify-0192', 'real-PostgreSQL proof') FROM voice_private.live_call_policy p`, [capacity]);
}
const grant = async (user) =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), VOICE_CONSENT_V3])).outcome;
/** A call begun (and activated unless `connecting`), optionally in an existing session of the person. */
async function activeCall(existing = null, o = {}) {
  const user = existing?.user ?? await human();
  const session = existing?.session ?? await newSession(user);
  await setGate();
  if (!existing) assert.equal(await grant(user), 'GRANTED');
  const client = randomUUID();
  const call = randomUUID();
  assert.equal((await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, client])).outcome, 'BEGUN');
  const x = { user, session, client, call, recording: null, epoch: 1, next: { USER: 0, QANDEEL: 0 }, end: { USER: 0, QANDEEL: 0 } };
  if (o.connecting) return x;
  const a = await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [user, call]);
  assert.equal(a.outcome, 'ACTIVE');
  x.recording = a.recording_id;
  return x;
}
async function audio(x, track, endMs) {
  const r = await one('SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)',
    [x.user, x.recording, x.epoch, track, x.next[track], x.end[track], endMs]);
  assert.equal(r.outcome, 'ADDED', `${track} ${x.end[track]}-${endMs}`);
  x.next[track] += 1;
  x.end[track] = endMs;
}
const COMMIT_SQL = 'SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)';
const safety = async (x, idx, disposition = 'ALLOW') =>
  (await one('SELECT * FROM public.server_store_call_turn_safety_v1($1, $2, $3, $4)', [x.user, x.call, idx, disposition])).outcome;
const segment = async (x, idx, seq, text, start, endMs) =>
  (await one('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [x.user, x.call, x.epoch, idx, seq, text, start, endMs, []])).outcome;
const finish = async (x, idx, state, produced) =>
  (await one('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, x.epoch, idx, state, produced])).outcome;
const playout = (x, idx, mark, clockStart) =>
  one('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, x.epoch, idx, mark, clockStart]);
const close = (x, idx, reason) =>
  one('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, $3, $4, $5, $6, $7)', [x.user, x.call, x.epoch, idx, reason, randomUUID(), randomUUID()]);
const bargeIn = (x, idx, captureMs, epoch = x.epoch) =>
  one('SELECT * FROM public.server_record_call_barge_in_v1($1, $2, $3, $4, $5)', [x.user, x.call, epoch, idx, captureMs]);
const textClose = (x, idx, state, text, terms = [], assistant = randomUUID(), event = randomUUID()) =>
  one('SELECT * FROM public.server_close_live_call_text_exchange_v1($1, $2, $3, $4, $5, $6, $7, $8)', [x.user, x.call, idx, state, text, terms, assistant, event]);
const endCall = async (x, reason = 'USER_ENDED') => (await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, x.epoch, reason])).outcome;
const exchange = async (x, idx) => (await rows('SELECT * FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = $2', [x.call, idx]))[0];
const turnRow = async (id) => (await rows('SELECT role, status, content FROM public.conversation_turns WHERE id = $1', [id]))[0];
const callTurn = async (id) => (await rows('SELECT turn_role, turn_channel, call_turn_index, retrieval_terms FROM public.conversation_call_turns WHERE turn_id = $1', [id]))[0];
const voiceSources = async (id) => (await rows('SELECT count(*)::int AS n FROM public.conversation_turn_voice_sources WHERE turn_id = $1', [id]))[0].n;
const outboxCount = async (turn) =>
  (await rows("SELECT count(*)::int AS n, max(payload->>'safety_disposition') AS safety FROM public.runtime_event_outbox WHERE subject_turn_id = $1 AND event_type = 'ConversationTurnCompleted'", [turn]))[0];
const halfOf = async (x, idx, half) => (await rows('SELECT turn_id, queue_state FROM voice_private.call_analysis_queue WHERE call_id = $1 AND call_turn_index = $2 AND half = $3', [x.call, idx, half]))[0];
const delivery = async (x, ids) => server('SELECT * FROM public.server_read_call_reply_delivery_v1($1, $2, $3)', [x.user, x.session, ids]);
/** A spoken turn committed with Safety stored. */
async function spokenTurn(x, o = {}) {
  await audio(x, 'USER', x.end.USER + 1000);
  const r = await one(COMMIT_SQL, [x.user, x.call, x.epoch, randomUUID(), randomUUID(), 'SPEECH', o.content ?? 'أنا بخير والحمد لله', 'HIGH',
    x.end.USER - 1000, x.end.USER, [], randomUUID(), randomUUID()]);
  assert.equal(r.outcome, 'COMMITTED');
  if (o.safety !== null) assert.equal(await safety(x, r.call_turn_index, o.safety ?? 'ALLOW'), 'STORED');
  return { idx: r.call_turn_index, turn: r.turn_id };
}
/** A typed turn of the call (TEXT_TURN) committed with Safety stored unless `safety: null`. */
async function typedTurn(x, o = {}) {
  const r = await one(COMMIT_SQL, [x.user, x.call, x.epoch, randomUUID(), o.commit ?? randomUUID(), 'TEXT', o.content ?? 'مكتوب أثناء المكالمة',
    null, null, null, [], randomUUID(), randomUUID()]);
  assert.equal(r.outcome, 'COMMITTED');
  if (o.safety !== null) assert.equal(await safety(x, r.call_turn_index, o.safety ?? 'ALLOW'), 'STORED');
  return { idx: r.call_turn_index, turn: r.turn_id };
}
/** A typed REST turn through the 0131 path, as the person. */
async function restTurn(user, session, content = 'رسالة عادية.') {
  const id = randomUUID();
  await asRole('authenticated', user);
  const result = await rows('SELECT * FROM create_user_conversation_turn($1, $2, $3, $4)', [id, session, content, null]);
  await owner();
  return { id, result };
}
const turnsOf = async (session) => (await rows('SELECT count(*)::int AS n FROM public.conversation_turns WHERE session_id = $1', [session]))[0].n;

// ------------------------------------------------------------------ T0 catalogue
async function verifyCatalogue(report) {
  await report.section('T0a the exchange: barge_in_capture_ms and the text reply columns with their checks; TEXT_REPLIED in the shape; nothing else changed', async () => {
    const columns = await rows(`SELECT column_name AS c, data_type AS t FROM information_schema.columns
        WHERE table_schema = 'voice_private' AND table_name = 'call_exchanges' AND column_name IN ('barge_in_capture_ms', 'text_reply', 'text_reply_terms', 'text_reply_state') ORDER BY 1`);
    assert.deepEqual(columns.map((r) => [r.c, r.t].join()), ['barge_in_capture_ms,bigint', 'text_reply,text', 'text_reply_state,text', 'text_reply_terms,ARRAY']);
    const defs = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'voice_private.call_exchanges'::regclass AND contype = 'c'`)).map((r) => [r.conname, r.def]));
    assert.match(defs.call_exchanges_shape_check, /'TEXT_REPLIED'/u);
    assert.match(defs.call_exchanges_barge_in_check, /barge_in_capture_ms % \(?20\)?/u);
    assert.match(defs.call_exchanges_text_reply_check, /'COMPLETE'.*'WITHHELD_TAIL'/u);
    assert.doesNotMatch(defs.call_exchanges_text_reply_check, /'FAILED'/u, 'a failed text reply stores no text');
    assert.match(defs.call_exchanges_audio_check, /produced_audio_ms = 0/u, 'the 0190 audio check is unchanged');
    const [{ n }] = await rows("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'voice_private' AND c.relkind = 'r' AND c.relname LIKE '%0192%'");
    assert.equal(n, 0);
  });
  await report.section('T0b every new definer postgres-owned, pinned, service_role only; every internal no role\'s', async () => {
    for (const fn of [...DEFINERS, ...INTERNAL]) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config, p.prosecdef AS definer,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', fn);
      assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
      assert.equal(p.definer, true, `${fn}: definer`);
      assert.deepEqual([p.anon, p.auth, p.service], [false, false, DEFINERS.includes(fn)], `${fn}: roles`);
    }
  });
  await report.section('T0c every forward-replaced function is its origin statement plus exactly the declared edits, in 0192 and live', async () => {
    const text = readFileSync(new URL(`./migrations/${MIGRATION_0192}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    assert.equal(SUBSTITUTIONS.length, 2);
    for (const substitution of SUBSTITUTIONS) {
      const declared = substitutedStatement(substitution);
      const written = extractStatement(text, substitution.header);
      assert.equal(written.statement, declared, `${substitution.key}: the 0192 statement is the derived one`);
      assert.ok(substitution.edits.every(([, to]) => to.includes('S8B-05 CP4 (0192')), `${substitution.key}: the edit names its task`);
      const name = /FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/u.exec(substitution.header)[1];
      const live = await rows("SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = $1", [name]);
      assert.ok(live.some((r) => r.prosrc.replace(/\r\n/gu, '\n') === written.body), `${substitution.key}: the live body is the 0192 body`);
    }
    for (const frozen of ['public.create_user_conversation_turn', 'public.server_commit_voice_note_turn_v1', 'public.server_commit_live_call_turn_v1',
      'public.server_close_live_call_exchange_v1', 'public.server_confirm_call_playout_v1', 'public.finalize_conversation_turn_v2']) {
      assert.doesNotMatch(text, new RegExp(`FUNCTION ${frozen.replace('.', '\\.')}\\(`, 'u'), `${frozen} is not redefined`);
    }
  });
  await report.section('T0d the admission guard: one BEFORE INSERT trigger on the RECEIVED user row; the two text paths insert exactly that shape', async () => {
    const [t] = await rows(`SELECT pg_get_triggerdef(t.oid) AS def, t.tgenabled AS enabled FROM pg_trigger t
        WHERE t.tgrelid = 'public.conversation_turns'::regclass AND t.tgname = 'conversation_turns_live_call_admission' AND NOT t.tgisinternal`);
    assert.equal(t.enabled, 'O');
    assert.match(t.def, /BEFORE INSERT ON public\.conversation_turns FOR EACH ROW WHEN \(\(\(new\.role = 'USER'::text\) AND \(new\.status = 'RECEIVED'::text\)\)\)/u);
    assert.match(t.def, /EXECUTE FUNCTION voice_private\.refuse_turn_admission_during_call_v1\(\)/u);
    for (const fn of ['create_user_conversation_turn', 'server_commit_voice_note_turn_v1']) {
      const [{ src }] = await rows("SELECT p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1", [fn]);
      assert.match(src.replace(/\s+/gu, ''), /INSERTINTOpublic\.conversation_turns\(.*VALUES\([^)]*'USER','RECEIVED'/u, `${fn}: inserts the guarded shape`);
    }
    const [{ src }] = await rows("SELECT p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'voice_private' AND p.proname = 'refuse_turn_admission_during_call_v1'");
    assert.match(src, /hashtextextended\('qandeel\.live-call\.v1:' \|\| NEW\.user_id::text, 0\)/u, 'the call lock server_begin_call_v1 takes');
    const [{ begin }] = await rows("SELECT p.prosrc AS begin FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'server_begin_call_v1'");
    assert.match(begin, /hashtextextended\('qandeel\.live-call\.v1:' \|\| p_user_id::text, 0\)/u, 'the same key');
  });
  await report.section('T0e four scopes DISABLED / UNSATISFIED; the census clean', async () => {
    const scopes = await rows('SELECT feature_flag_state AS f, launch_requirements_state AS r FROM voice_private.voice_launch_capability_states');
    assert.equal(scopes.length, 4);
    assert.ok(scopes.every((s) => s.f === 'DISABLED' && s.r === 'UNSATISFIED'));
    const census = await rows(`SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c WHERE c.contype = 'f'
        AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
        AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)`);
    assert.deepEqual(census, []);
  });
}

// ------------------------------------------------------------------ behaviour
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await setCapacity(64);
    await report.isolated('T1 BARGE_IN: fenced; the first onset kept; it closes nothing; late for a closed exchange: rejected, counted, nothing changed', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      await rejected(() => bargeIn(x, t.idx, 1010), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => bargeIn(x, t.idx, -20), ['22023'], /VOICE_REQUEST_INVALID/u);
      assert.equal((await bargeIn(x, t.idx, 1000, 0)).outcome, 'FENCED', 'an older epoch');
      assert.equal((await bargeIn(x, t.idx + 5, 1000)).outcome, 'NOT_FOUND');
      const other = await activeCall();
      assert.equal((await one('SELECT * FROM public.server_record_call_barge_in_v1($1, $2, 1, $3, 1000)', [other.user, x.call, t.idx])).outcome, 'NOT_FOUND', 'another person');
      assert.deepEqual(Object.values(await bargeIn(x, t.idx, 1000)), ['RECORDED', '1000']);
      assert.deepEqual(Object.values(await bargeIn(x, t.idx, 1500)), ['ALREADY_RECORDED', '1000'], 'the first onset stands');
      const e = await exchange(x, t.idx);
      assert.deepEqual([e.exchange_state, e.barge_in_capture_ms, e.close_reason], ['OPEN', '1000', null], 'it closes nothing');
      assert.equal((await finish(x, t.idx, 'FAILED', 0)), 'FINISHED');
      assert.equal((await close(x, t.idx, 'GENERATION_FAILED')).outcome, 'CLOSED');
      const before = (await exchange(x, t.idx)).late_rejections;
      assert.deepEqual(Object.values(await bargeIn(x, t.idx, 2000)), ['CLOSED', '1000'], 'late (P3)');
      const after = await exchange(x, t.idx);
      assert.deepEqual([after.late_rejections, after.barge_in_capture_ms, after.delivery_state], [before + 1, '1000', 'FAILED'], 'counted, nothing changed');
      assert.equal((await endCall(x)), 'ENDED');
      assert.equal((await bargeIn(x, t.idx, 2000)).outcome, 'FENCED', 'an ended call');
    });

    await report.isolated('T2 a barge-in, then the next turn (N1): only what was heard, INTERRUPTED, the heard anchor; the next turn in order', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      assert.equal(await segment(x, t.idx, 0, 'أولًا، ', 0, 400), 'REGISTERED');
      assert.equal(await segment(x, t.idx, 1, 'وبعدين كلام لم يسمع.', 400, 1200), 'REGISTERED');
      const start = x.end.QANDEEL;
      assert.equal((await playout(x, t.idx, 400, start)).outcome, 'ADVANCED');
      await audio(x, 'QANDEEL', start + 400);
      // The person speaks over QANDEEL: the phone stops playback, the server records the onset and stops generating (the
      // generation is never finished: nothing more is produced, the exchange stays open until N1).
      assert.equal((await bargeIn(x, t.idx, x.end.USER + 60)).outcome, 'RECORDED');
      const n = await spokenTurn(x, { content: 'لا استنى' });
      assert.equal(n.idx, t.idx + 1, 'the next index');
      const e = await exchange(x, t.idx);
      assert.deepEqual([e.exchange_state, e.close_reason, e.delivery_state, e.heard_mark_ms], ['CLOSED', 'NEXT_TURN', 'INTERRUPTED', '400']);
      assert.equal((await turnRow(e.assistant_turn_id)).content, 'أولًا، ', 'only the heard segment');
      const [vs] = await rows('SELECT anchor_start_ms, anchor_end_ms, delivery_state FROM public.conversation_turn_voice_sources WHERE turn_id = $1', [e.assistant_turn_id]);
      assert.deepEqual([vs.anchor_start_ms, vs.anchor_end_ms, vs.delivery_state], [String(start), String(start + 400), 'INTERRUPTED']);
      assert.equal((await outboxCount(t.turn)).n, 1, 'one close');
      assert.equal((await close(x, t.idx, 'PLAYED_OUT')).outcome, 'ALREADY_CLOSED');
    });

    await report.isolated('T2b a barge-in before anything was heard: INTERRUPTED with no text and no anchor; never FAILED (CA-05-02)', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x);
      assert.equal((await bargeIn(x, t.idx, x.end.USER + 20)).outcome, 'RECORDED');
      await spokenTurn(x, { content: 'لحظة' });
      const e = await exchange(x, t.idx);
      assert.deepEqual([e.delivery_state, e.heard_mark_ms, e.generation_state], ['INTERRUPTED', '0', 'GENERATING']);
      assert.equal((await turnRow(e.assistant_turn_id)).content, '');
      const [vs] = await rows('SELECT anchor_start_ms, anchor_end_ms FROM public.conversation_turn_voice_sources WHERE turn_id = $1', [e.assistant_turn_id]);
      assert.deepEqual([vs.anchor_start_ms, vs.anchor_end_ms], [null, null]);
    });

    await report.isolated('T3 the typed exchange: COMPLETE with its text and terms; no playout, no anchor, no voice source; TEXT call turn, delivery read, half queued, one event with the stored Safety; first close wins', async () => {
      const x = await activeCall();
      const before = await spokenTurn(x);
      assert.equal(await segment(x, before.idx, 0, 'تمام.', 0, 400), 'REGISTERED');
      assert.equal(await finish(x, before.idx, 'COMPLETE', 400), 'FINISHED');
      const start = x.end.QANDEEL;
      assert.equal((await playout(x, before.idx, 400, start)).outcome, 'ADVANCED');
      await audio(x, 'QANDEEL', start + 400);
      assert.equal((await close(x, before.idx, 'PLAYED_OUT')).outcome, 'CLOSED');
      const t = await typedTurn(x, { safety: 'GUIDED' });
      assert.equal(t.idx, before.idx + 1);
      assert.deepEqual(await callTurn(t.turn), { turn_role: 'USER', turn_channel: 'TEXT', call_turn_index: t.idx, retrieval_terms: [] });
      assert.equal(await voiceSources(t.turn), 0, 'a typed turn has no voice source');
      const assistant = randomUUID();
      await rejected(() => textClose(x, t.idx, 'COMPLETE', '   '), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => textClose(x, t.idx, 'FAILED', 'نص'), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => textClose(x, t.idx, 'FAILED', '', ['كلمة']), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => textClose(x, t.idx, 'COMPLETE', 'نص', ['UPPER']), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => textClose(x, t.idx, 'COMPLETE', 'ن'.repeat(4001)), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => textClose(x, t.idx, 'INTERRUPTED', 'نص'), ['22023'], /VOICE_REQUEST_INVALID/u);
      await rejected(() => close(x, t.idx, 'PLAYED_OUT'), ['22023'], /VOICE_REQUEST_INVALID/u);
      assert.equal((await exchange(x, t.idx)).exchange_state, 'OPEN', 'every refusal wrote nothing');
      const c = await textClose(x, t.idx, 'COMPLETE', 'فاهمك. تحب تحكيلي أكتر؟', ['فاهمك', 'تحكيلي'], assistant);
      assert.deepEqual([c.outcome, c.assistant_turn_id, c.delivery_state], ['CLOSED', assistant, 'COMPLETE']);
      const e = await exchange(x, t.idx);
      assert.deepEqual([e.close_reason, e.heard_mark_ms, e.produced_audio_ms, e.playout_mark_ms, e.reply_clock_start_ms, e.text_reply_state],
        ['TEXT_REPLIED', '0', '0', '0', null, 'COMPLETE']);
      assert.deepEqual(await turnRow(assistant), { role: 'ASSISTANT', status: 'COMPLETED', content: 'فاهمك. تحب تحكيلي أكتر؟' });
      assert.equal((await turnRow(t.turn)).status, 'COMPLETED');
      assert.deepEqual(await callTurn(assistant), { turn_role: 'ASSISTANT', turn_channel: 'TEXT', call_turn_index: t.idx, retrieval_terms: ['فاهمك', 'تحكيلي'] }, 'the reply call turn keeps its terms as given');
      assert.equal(await voiceSources(assistant), 0, 'a text reply was never spoken');
      assert.deepEqual((await delivery(x, [assistant, e.assistant_turn_id])).map((r) => [r.turn_id, r.delivery_state].join()), [[assistant, 'COMPLETE'].join()]);
      const spokenReply = (await exchange(x, before.idx)).assistant_turn_id;
      assert.deepEqual((await delivery(x, [spokenReply, assistant])).map((r) => r.delivery_state).sort(), ['COMPLETE', 'COMPLETE'], 'both kinds, one read');
      assert.deepEqual(await halfOf(x, t.idx, 'ASSISTANT'), { turn_id: assistant, queue_state: 'PENDING' }, 'the reply half queued (R7′)');
      assert.deepEqual(await outboxCount(t.turn), { n: 1, safety: 'GUIDED' }, 'one event with the stored Safety');
      const again = await textClose(x, t.idx, 'COMPLETE', 'نص مختلف', [], randomUUID());
      assert.deepEqual([again.outcome, again.assistant_turn_id, again.delivery_state], ['ALREADY_CLOSED', assistant, 'COMPLETE']);
      assert.equal((await exchange(x, t.idx)).text_reply, 'فاهمك. تحب تحكيلي أكتر؟', 'nothing rewritten');
      // The next spoken turn follows in order.
      assert.equal((await spokenTurn(x)).idx, t.idx + 1);
    });

    await report.isolated('T3b WITHHELD_TAIL and FAILED; S2: no close without Safety; not fenced by the epoch (a resumed connection, another instance)', async () => {
      const x = await activeCall();
      const w = await typedTurn(x);
      assert.equal((await textClose(x, w.idx, 'WITHHELD_TAIL', 'الجزء الأول فقط.')).delivery_state, 'WITHHELD_TAIL');
      const f = await typedTurn(x);
      const failed = await textClose(x, f.idx, 'FAILED', '');
      assert.equal(failed.delivery_state, 'FAILED');
      const fe = await exchange(x, f.idx);
      assert.deepEqual([fe.close_reason, fe.text_reply, (await turnRow(fe.assistant_turn_id)).content], ['GENERATION_FAILED', null, '']);
      const u = await typedTurn(x, { safety: null });
      await rejected(() => textClose(x, u.idx, 'COMPLETE', 'رد'), ['55000'], /CALL_EXCHANGE_SAFETY_UNSETTLED/u);
      assert.equal((await exchange(x, u.idx)).text_reply, null, 'the refusal stored nothing');
      assert.equal(await safety(x, u.idx), 'STORED');
      // The connection drops and resumes: the epoch moves; the text reply still closes its exchange.
      assert.equal((await one('SELECT * FROM public.server_suspend_call_v1($1, $2, $3)', [x.user, x.call, 1])).outcome, 'SUSPENDED');
      const r = await one('SELECT * FROM public.server_resume_call_v1($1, $2, $3)', [x.user, x.call, x.client]);
      assert.deepEqual([r.outcome, r.connection_epoch], ['RESUMED', '2']);
      assert.equal((await textClose(x, u.idx, 'COMPLETE', 'رد بعد الاستئناف.')).outcome, 'CLOSED');
      const other = await activeCall();
      assert.equal((await one('SELECT * FROM public.server_close_live_call_text_exchange_v1($1, $2, $3, $4, $5, $6, $7, $8)',
        [other.user, x.call, u.idx, 'COMPLETE', 'x', [], randomUUID(), randomUUID()])).outcome, 'NOT_FOUND', 'another person');
    });

    await report.isolated('T4 a typed exchange closed first by N1 or the call\'s end: INTERRUPTED, no text; the late text close ALREADY_CLOSED; a spoken exchange never by text', async () => {
      const x = await activeCall();
      const t = await typedTurn(x);
      const n = await spokenTurn(x);
      const e = await exchange(x, t.idx);
      assert.deepEqual([e.close_reason, e.delivery_state, e.text_reply], ['NEXT_TURN', 'INTERRUPTED', null]);
      assert.equal((await turnRow(e.assistant_turn_id)).content, '');
      assert.deepEqual(await callTurn(e.assistant_turn_id), { turn_role: 'ASSISTANT', turn_channel: 'TEXT', call_turn_index: t.idx, retrieval_terms: [] });
      assert.equal(await voiceSources(e.assistant_turn_id), 0);
      const late = await textClose(x, t.idx, 'COMPLETE', 'متأخر.');
      assert.deepEqual([late.outcome, late.delivery_state], ['ALREADY_CLOSED', 'INTERRUPTED']);
      assert.equal((await exchange(x, t.idx)).text_reply, null, 'a late text is never stored');
      await rejected(() => textClose(x, n.idx, 'COMPLETE', 'رد مكتوب'), ['22023'], /VOICE_REQUEST_INVALID/u);
      const t2 = await typedTurn(x);
      assert.equal(await endCall(x), 'ENDED');
      const e2 = await exchange(x, t2.idx);
      assert.deepEqual([e2.close_reason, e2.delivery_state], ['CALL_ENDING', 'INTERRUPTED']);
      assert.equal((await textClose(x, t2.idx, 'COMPLETE', 'بعد النهاية.')).outcome, 'ALREADY_CLOSED');
    });

    await report.isolated('T5 the text paths around a call: refused while CONNECTING, ACTIVE and RECONNECTING within the grace, nothing written; admitted elsewhere, after the end, when lapsed', async () => {
      const user = await human();
      const session = await newSession(user);
      assert.equal(await grant(user), 'GRANTED');
      const otherSession = await newSession(user);
      assert.equal((await restTurn(user, session)).result.length, 1, 'before the call: admitted');
      await owner();
      await q("UPDATE public.conversation_turns SET status = 'FAILED', completed_at = clock_timestamp() WHERE session_id = $1", [session]);
      const x = await activeCall({ user, session }, { connecting: true });
      const n0 = await turnsOf(session);
      await rejected(() => restTurn(user, session), ['55000'], /LIVE_CALL_IN_PROGRESS/u);
      assert.equal((await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [user, x.call])).outcome, 'ACTIVE');
      x.recording = (await rows('SELECT id FROM voice_private.recordings WHERE call_id = $1', [x.call]))[0].id;
      await rejected(() => restTurn(user, session), ['55000'], /LIVE_CALL_IN_PROGRESS/u);
      // The raw shape the Voice Note commit inserts is refused the same way.
      await rejected(() => q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content) VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'ملاحظة')`,
        [randomUUID(), session, user]), ['55000'], /LIVE_CALL_IN_PROGRESS/u);
      assert.equal(await turnsOf(session), n0, 'nothing written');
      // The call's own turns are unaffected (inserted GENERATING).
      const t = await typedTurn(x);
      assert.equal((await textClose(x, t.idx, 'COMPLETE', 'تمام.')).outcome, 'CLOSED');
      // Another session of the same person is the text path's own.
      assert.equal((await restTurn(user, otherSession)).result.length, 1, 'another session: admitted');
      assert.equal((await one('SELECT * FROM public.server_suspend_call_v1($1, $2, $3)', [user, x.call, 1])).outcome, 'SUSPENDED');
      await rejected(() => restTurn(user, session), ['55000'], /LIVE_CALL_IN_PROGRESS/u);
      // A lapsed call the sweep has not ended yet does not block typing (call-truth's reading).
      await q("UPDATE voice_private.calls SET grace_until = clock_timestamp() - interval '1 second' WHERE id = $1", [x.call]);
      assert.equal((await one('SELECT * FROM public.server_read_call_truth_v1($1)', [user])).call_truth, 'NO_CALL_KNOWN');
      const lapsed = await restTurn(user, session);
      assert.equal(lapsed.result.length, 1, 'lapsed: admitted');
      await q("UPDATE public.conversation_turns SET status = 'FAILED', completed_at = clock_timestamp() WHERE id = $1", [lapsed.id]);
      // After the end: admitted.
      const y = await activeCall();
      assert.equal(await endCall(y), 'ENDED');
      assert.equal((await restTurn(y.user, y.session)).result.length, 1, 'after the end: admitted');
    });

    await report.isolated('T6 P5: the open exchange an older connection left, read by the connection now holding the call (fenced); NONE once closed', async () => {
      const x = await activeCall();
      const readOpen = (epoch = x.epoch, user = x.user) => one('SELECT * FROM public.server_read_open_call_exchange_v1($1, $2, $3)', [user, x.call, epoch]);
      assert.equal((await readOpen()).outcome, 'NONE');
      const t = await spokenTurn(x, { content: 'كنت بقول', safety: null });
      assert.equal((await one('SELECT * FROM public.server_suspend_call_v1($1, $2, $3)', [x.user, x.call, 1])).outcome, 'SUSPENDED');
      assert.equal((await readOpen()).outcome, 'FENCED', 'RECONNECTING');
      assert.equal((await one('SELECT * FROM public.server_resume_call_v1($1, $2, $3)', [x.user, x.call, x.client])).outcome, 'RESUMED');
      assert.equal((await readOpen(1)).outcome, 'FENCED', 'the older epoch');
      x.epoch = 2;
      const open = await readOpen();
      assert.deepEqual([open.outcome, open.call_turn_index, open.user_turn_id, open.content, open.turn_channel, open.safety_disposition],
        ['OPEN', t.idx, t.turn, 'كنت بقول', 'SPEECH', null]);
      const other = await activeCall();
      assert.equal((await readOpen(2, other.user)).outcome, 'NOT_FOUND', 'another person');
      assert.equal(await safety(x, t.idx), 'STORED');
      assert.equal((await readOpen()).safety_disposition, 'ALLOW');
      await typedTurn(x);
      assert.equal((await readOpen()).turn_channel, 'TEXT', 'N1 closed the older one; the typed one is open');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ TRC races
async function verifyRaces(report) {
  const { q2, close: closeSecondary } = await rt.openSecondary();
  const fixtures = [];
  await owner();
  const [gate] = await rows('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = $1', [LIVE]);
  const [policy] = await rows('SELECT * FROM voice_private.live_call_policy');
  const asUser2 = async (user) => {
    await q2('BEGIN');
    await q2('SET LOCAL ROLE authenticated');
    await q2("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated' })]);
  };
  try {
    await setCapacity(64);
    await setGate();
    await report.section('TRC-1 a call begins while a typed REST turn is admitted: the turn waits on the call lock, then is refused; nothing written', async () => {
      const user = await human();
      const session = await newSession(user);
      assert.equal(await grant(user), 'GRANTED');
      const call = randomUUID();
      fixtures.push({ user, call });
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      assert.equal((await rows('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, randomUUID()]))[0].outcome, 'BEGUN');
      await asUser2(user);
      const turn = randomUUID();
      const pending = q2('SELECT * FROM create_user_conversation_turn($1, $2, $3, $4)', [turn, session, 'وأنا كمان', null]).then(() => 'ADMITTED', (e) => e.message);
      assert.equal(await rt.stillPending(pending), true, 'serialized by the call lock');
      await q('COMMIT');
      await owner();
      assert.equal(await pending, 'LIVE_CALL_IN_PROGRESS');
      await q2('ROLLBACK');
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.conversation_turns WHERE id = $1', [turn]))[0].n, 0);
    });
    await report.section('TRC-2 a typed REST turn admitted while a call begins: the call waits on the lock, then begins after it; the turn is the session\'s, before the call', async () => {
      const user = await human();
      const session = await newSession(user);
      assert.equal(await grant(user), 'GRANTED');
      const call = randomUUID();
      fixtures.push({ user, call });
      await asUser2(user);
      const turn = randomUUID();
      await q2('SELECT * FROM create_user_conversation_turn($1, $2, $3, $4)', [turn, session, 'قبل المكالمة', null]);
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      const pending = q('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, randomUUID()]).then((r) => r.rows[0].outcome, (e) => e.message);
      assert.equal(await rt.stillPending(pending), true, 'serialized by the call lock');
      await q2('COMMIT');
      const outcome = await pending;
      await q('COMMIT');
      await owner();
      assert.equal(outcome, 'BEGUN');
      const [r] = await rows('SELECT t.created_at < c.created_at AS before FROM public.conversation_turns t, voice_private.calls c WHERE t.id = $1 AND c.id = $2', [turn, call]);
      assert.equal(r.before, true);
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await closeSecondary();
    await removeRaceFixtures(fixtures, gate, policy);
  }
}

// The TRC fixtures are committed, and in CI the next steps share this database: every fixture call ends, every fixture
// person is erased through the account erasure itself, the deletion records and the people go, and the gate and the
// policy return to the state they had.
async function removeRaceFixtures(fixtures, gate, policy) {
  await owner();
  const humans = [...new Set(fixtures.map((x) => x.user))];
  for (const x of fixtures) {
    const [c] = await rows('SELECT connection_epoch FROM voice_private.calls WHERE id = $1', [x.call]);
    if (!c) continue;
    const ended = await one('SELECT * FROM public.server_end_call_v1($1, $2, $3, $4)', [x.user, x.call, c.connection_epoch, 'USER_ENDED']);
    assert.ok(['ENDED', 'ALREADY_ENDED'].includes(ended.outcome), ended.outcome);
  }
  for (const user of humans) {
    const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
    assert.equal((await one('SELECT public.server_erase_account_v1($1) AS outcome', [del.id])).outcome, 'ERASED');
  }
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [humans]);
    if (gate) {
      await q(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
                 restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await q('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2', [gate.capability_scope, gate.restriction_version]);
    }
    if (policy) {
      await q(`UPDATE voice_private.live_call_policy SET realtime_session_capacity = $1, reconnect_grace_seconds = $2, connect_timeout_seconds = $3,
                 seat_lease_seconds = $4, max_call_seconds = $5, policy_version = $6, decided_by = $7, policy_basis = $8, decided_at = $9`,
      [policy.realtime_session_capacity, policy.reconnect_grace_seconds, policy.connect_timeout_seconds, policy.seat_lease_seconds,
        policy.max_call_seconds, policy.policy_version, policy.decided_by, policy.policy_basis, policy.decided_at]);
    }
    await q("SET LOCAL session_replication_role = 'origin'");
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  await rt.removeFixtureHumans(humans);
  const [left] = await rows("SELECT count(*)::int AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED' OR launch_requirements_state <> 'UNSATISFIED'");
  assert.equal(left.n, 0, 'every scope DISABLED / UNSATISFIED again');
}

runVerifier('0192', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0192', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('races');
  await verifyRaces(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
