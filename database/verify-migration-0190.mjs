// Real-PostgreSQL verifier for migration 0190 (S8B-05 CP2: the live call's spoken turn, QANDEEL's spoken reply and playout
// truth; Integrated Live Call Contract v1.2 FINAL). No provider is called; every scenario but TRC runs in one transaction
// that is rolled back.
//
//   T0   catalogue: the call turn order (owner SELECT under RLS only), the three voice_private relations (no grant, no
//        policy), all four ACCOUNT_CASCADE with cascading keys; one OPEN exchange per call; the voice-source shapes (FAILED,
//        the NULL anchor); the R2-G trigger; every definer service_role only, the six internals no role's, the two reads
//        SECURITY INVOKER for authenticated only; every forward-replaced function its origin statement plus exactly the
//        declared edits, in 0190 and live; four scopes DISABLED; the census clean
//   T1   commit: fenced by the epoch, the gate and the consent; the USER anchor inside the USER track; the USER turn
//        GENERATING (FAST) with its MACHINE_ASR band and anchor, numbered, its exchange OPEN and its USER half queued in the
//        same transaction; idempotent by the commit id; a TEXT turn takes the same order without a voice source
//   T2   R2-G: fail / cancel / recover and any status write refuse a call turn (CALL_TURN_OWNED_BY_CALL_AUTHORITY); a
//        typed turn outside a call still fails as before
//   T3   Safety S1 – S3: stored once, SAME again, a different value is a Safety error; no close without it; the stored
//        value is the one ConversationTurnCompleted v2 carries
//   T4   CA-05-02, the five cases: COMPLETE, WITHHELD_TAIL, INTERRUPTED after a complete chunk, INTERRUPTED before the first
//        (heard audio, or none), FAILED; the heard mark bounded by the QANDEEL track; text = chunks whose end ≤ the mark
//   T5   PLAYOUT P1 – P3: the highest mark only; the reply's call-clock start once, never before the QANDEEL track's end;
//        late PLAYOUT / segment / finish / close after the close: rejected, counted, nothing changed; one close wins
//   T6   N1 and the long call: a new turn closes the open exchange in its transaction; 40 turns in a row, never stopped
//        by the text windows; the call's own turn bound
//   T7   context (C2) and in-call retrieval under the owner's RLS: the session's earlier exchanges, then the call's by
//        call_turn_index, each reply the heard part only; two distinct terms, or one with a recall cue; at most two
//   T8   AI-COST-01: one TTS ledger row per attempt bound to the exchange's USER turn, only while it is open; the call's
//        recognition row GATEWAY_MEASURED; settled once
//   T9   Export My Data and the history read carry deliveryState; account erasure removes every new row
//   TRC  races on two connections: natural close vs N1 commit (both orders), late PLAYOUT vs close, two closes, a spoken
//        and a typed commit (one call_turn_index order)
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';
import { VOICE_CONSENT_V3 } from './qandeel-voice-0188-anchor.mjs';
import { MIGRATION_0190, SUBSTITUTIONS, substitutedStatement, voiceInternals0190 } from './live-call-0190-substitutions.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const rejected = (operation, codes) => rt.rejected(operation, codes);

const NEW_PUBLIC = 'public.conversation_call_turns';
const PRIVATE = ['voice_private.call_exchanges', 'voice_private.call_reply_segments', 'voice_private.call_analysis_queue'];
const DEFINERS = [
  'public.server_commit_live_call_turn_v1(uuid,uuid,bigint,uuid,uuid,text,text,text,bigint,bigint,text[],uuid,uuid)',
  'public.server_store_call_turn_safety_v1(uuid,uuid,integer,text)',
  'public.server_register_call_reply_segment_v1(uuid,uuid,bigint,integer,integer,text,bigint,bigint,text[])',
  'public.server_finish_call_reply_generation_v1(uuid,uuid,bigint,integer,text,bigint)',
  'public.server_confirm_call_playout_v1(uuid,uuid,bigint,integer,bigint,bigint)',
  'public.server_close_live_call_exchange_v1(uuid,uuid,bigint,integer,text,uuid,uuid)',
  'public.server_begin_call_reply_speech_v1(uuid,uuid,bigint,integer,uuid,text)',
  'public.server_begin_call_transcription_v1(uuid,uuid,bigint,uuid,text)',
  'public.server_settle_call_provider_call_v1(uuid,uuid,text,text,jsonb)',
  'public.server_read_call_reply_delivery_v1(uuid,uuid,uuid[])',
];
const READS = ['public.call_context_exchanges_v1(uuid,uuid,integer)', 'public.call_turn_retrieval_v1(uuid,text[],boolean,integer)'];
const INTERNAL = voiceInternals0190();
const LIVE = 'PERSONAL_LIVE_CALL';

// ------------------------------------------------------------------ helpers
async function server(sql, values = []) {
  await asRole('service_role');
  const result = await rows(sql, values);
  await owner();
  return result;
}
const one = async (sql, values = []) => (await server(sql, values))[0];
async function asOwner(user, sql, values = []) {
  await asRole('authenticated', user);
  const result = await rows(sql, values);
  await owner();
  return result;
}
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
  await rows("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, 'verify-0190', 'real-PostgreSQL proof')",
    [scope, flag, requirements]);
}
/** Sets the realtime seat capacity (each fixture call holds a seat until it ends). */
async function setCapacity(capacity) {
  await owner();
  await rows(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds, p.seat_lease_seconds,
      p.max_call_seconds, 'verify-0190', 'real-PostgreSQL proof') FROM voice_private.live_call_policy p`, [capacity]);
}
const grant = async (user) =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), VOICE_CONSENT_V3])).outcome;
/** A call begun and activated, with track counters: { user, session, client, call, recording, epoch, next: {USER, QANDEEL} }. */
async function activeCall() {
  const user = await human();
  const session = await newSession(user);
  await setGate();
  assert.equal(await grant(user), 'GRANTED');
  const client = randomUUID();
  const call = randomUUID();
  assert.equal((await one('SELECT * FROM public.server_begin_call_v1($1, $2, $3, $4)', [user, session, call, client])).outcome, 'BEGUN');
  const a = await one('SELECT * FROM public.server_activate_call_v1($1, $2, 1)', [user, call]);
  assert.equal(a.outcome, 'ACTIVE');
  return { user, session, client, call, recording: a.recording_id, epoch: 1, next: { USER: 0, QANDEEL: 0 }, end: { USER: 0, QANDEEL: 0 } };
}
/** Extends a track with one segment up to `endMs` (the CP1 writer's fenced entry). */
async function audio(x, track, endMs) {
  const start = x.end[track];
  const r = await one('SELECT * FROM public.server_add_call_segment_v2($1, $2, $3, $4, $5, $6, $7, 4096, 20)',
    [x.user, x.recording, x.epoch, track, x.next[track], start, endMs]);
  assert.equal(r.outcome, 'ADDED', `${track} ${start}-${endMs}`);
  x.next[track] += 1;
  x.end[track] = endMs;
}
/** A NOT_SPEAKING gap on the QANDEEL track up to `endMs` (never artificial silence). */
async function notSpeaking(x, endMs) {
  const r = await one('SELECT * FROM public.server_record_call_gap_v2($1, $2, $3, $4, $5, $6, $7)',
    [x.user, x.recording, x.epoch, 'QANDEEL', x.end.QANDEEL, endMs, 'NOT_SPEAKING']);
  assert.equal(r.outcome, 'RECORDED');
  x.end.QANDEEL = endMs;
}
const COMMIT_SQL = 'SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)';
const commitArgs = (x, o) => [x.user, x.call, o.epoch ?? x.epoch, o.turn ?? randomUUID(), o.commit ?? randomUUID(), o.channel ?? 'SPEECH',
  o.content ?? 'أنا بخير والحمد لله', o.channel === 'TEXT' ? null : (o.band ?? 'HIGH'),
  o.channel === 'TEXT' ? null : (o.start ?? 0), o.channel === 'TEXT' ? null : (o.end ?? x.end.USER),
  o.terms ?? [], o.closeTurn ?? randomUUID(), o.closeEvent ?? randomUUID()];
const commit = (x, o = {}) => one(COMMIT_SQL, commitArgs(x, o));
const safety = async (x, idx, disposition = 'ALLOW') =>
  (await one('SELECT * FROM public.server_store_call_turn_safety_v1($1, $2, $3, $4)', [x.user, x.call, idx, disposition])).outcome;
const segment = async (x, idx, seq, text, start, endMs, terms = [], epoch = x.epoch) =>
  (await one('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [x.user, x.call, epoch, idx, seq, text, start, endMs, terms])).outcome;
const finish = async (x, idx, state, produced, epoch = x.epoch) =>
  (await one('SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, epoch, idx, state, produced])).outcome;
const playout = (x, idx, played, clockStart = null, epoch = x.epoch) =>
  one('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, epoch, idx, played, clockStart]);
const close = (x, idx, reason, epoch = x.epoch) =>
  one('SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, $3, $4, $5, $6, $7)', [x.user, x.call, epoch, idx, reason, randomUUID(), randomUUID()]);
const exchange = async (x, idx) => (await rows('SELECT * FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = $2', [x.call, idx]))[0];
const turnRow = async (id) => (await rows('SELECT * FROM public.conversation_turns WHERE id = $1', [id]))[0];
const sourceRow = async (id) => (await rows('SELECT * FROM public.conversation_turn_voice_sources WHERE turn_id = $1', [id]))[0];
const n = Number;
/** One spoken turn committed with its Safety stored: returns its index and USER turn id. */
async function spokenTurn(x, o = {}) {
  if (o.audioTo) await audio(x, 'USER', o.audioTo);
  const r = await commit(x, o);
  assert.equal(r.outcome, 'COMMITTED');
  assert.equal(await safety(x, r.call_turn_index, o.safety ?? 'ALLOW'), 'STORED');
  return { idx: r.call_turn_index, turn: r.turn_id, closed: r };
}
/** The reply of exchange `idx`: segments [text, ms] in order; produced in full when `finish` is given. */
async function reply(x, idx, pieces, finishState = null) {
  let at = 0;
  for (const [seq, [text, ms, terms]] of pieces.entries()) {
    assert.equal(await segment(x, idx, seq, text, at, at + ms, terms ?? []), 'REGISTERED');
    at += ms;
  }
  if (finishState) assert.equal(await finish(x, idx, finishState, at), 'FINISHED');
  return at;
}
/** The phone confirmed `played` ms of the reply; the server writes heard audio to the QANDEEL track up to the mark. */
async function heard(x, idx, played, clockStart = null) {
  const start = clockStart ?? x.end.QANDEEL;
  const r = await playout(x, idx, played, start);
  assert.equal(r.outcome, 'ADVANCED');
  const replyStart = n(r.reply_clock_start_ms);
  if (x.end.QANDEEL < replyStart) await notSpeaking(x, replyStart);
  if (replyStart + played > x.end.QANDEEL) await audio(x, 'QANDEEL', replyStart + played);
  return replyStart;
}
async function outboxFor(turn) {
  return rows(`SELECT event_type, event_version, schema_ref, subject_turn_id, payload FROM public.runtime_event_outbox
                WHERE subject_turn_id = $1 ORDER BY created_at`, [turn]);
}

// ------------------------------------------------------------------ T0 catalogue
async function verifyCatalogue(report) {
  await report.section('T0a the call turn order: postgres-owned, RLS on, one owner SELECT policy, SELECT for authenticated only; the three voice_private relations: RLS, no policy, no grant; all four ACCOUNT_CASCADE', async () => {
    const [p] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
        (SELECT array_agg(polname::text) FROM pg_policy WHERE polrelid = c.oid) AS policies FROM pg_class c WHERE c.oid = $1::regclass`, [NEW_PUBLIC]);
    assert.deepEqual(p, { owner: 'postgres', rls: true, policies: ['conversation_call_turns_owner_select'] });
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, NEW_PUBLIC, privilege]);
        assert.equal(allowed, role === 'authenticated' && privilege === 'SELECT', `${role} ${privilege} ${NEW_PUBLIC}`);
      }
    }
    for (const relation of PRIVATE) {
      const [r] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
          (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema || '.' || g.table_name = $1
              AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) AS grants FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(r, { owner: 'postgres', rls: true, policies: 0, grants: 0 }, relation);
    }
    const coverage = await rows(`SELECT relation, coverage FROM account_erasure_private.coverage_registry
        WHERE relation = ANY($1::text[]) ORDER BY relation`, [['conversation_call_turns', ...PRIVATE]]);
    assert.deepEqual(coverage.map((c) => c.coverage), ['ACCOUNT_CASCADE', 'ACCOUNT_CASCADE', 'ACCOUNT_CASCADE', 'ACCOUNT_CASCADE']);
    for (const relation of [NEW_PUBLIC, ...PRIVATE]) {
      const fks = await rows(`SELECT confrelid::regclass::text AS target, confdeltype AS del FROM pg_constraint
          WHERE conrelid = $1::regclass AND contype = 'f'`, [relation]);
      assert.ok(fks.length > 0 && fks.every((f) => f.del === 'c'), `${relation}: every key cascades`);
      assert.ok(fks.some((f) => f.target === 'users'), `${relation}: cascades from the account`);
    }
    const [{ idx }] = await rows("SELECT indexdef AS idx FROM pg_indexes WHERE schemaname = 'voice_private' AND indexname = 'call_exchanges_one_open_idx'");
    assert.match(idx, /UNIQUE INDEX .* \(call_id\) WHERE \(exchange_state = 'OPEN'::text\)/u);
    const [{ gin }] = await rows("SELECT indexdef AS gin FROM pg_indexes WHERE indexname = 'conversation_call_turns_terms_idx'");
    assert.match(gin, /USING gin \(retrieval_terms\)/u);
  });
  await report.section('T0b the voice-source shapes: delivery_state FAILED; an anchor NULL only for a reply nothing of which was heard; the R2-G trigger', async () => {
    const defs = Object.fromEntries((await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'public.conversation_turn_voice_sources'::regclass AND contype = 'c'`)).map((r) => [r.conname, r.def]));
    assert.match(defs.conversation_turn_voice_sources_role_shape_check, /'FAILED'/u);
    assert.match(defs.conversation_turn_voice_sources_anchor_check, /anchor_start_ms IS NULL/u);
    const nullable = await rows(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = 'conversation_turn_voice_sources' AND column_name IN ('anchor_start_ms', 'anchor_end_ms') ORDER BY 1`);
    assert.deepEqual(nullable.map((c) => c.is_nullable), ['YES', 'YES']);
    const [trigger] = await rows(`SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def FROM pg_trigger
        WHERE tgrelid = 'public.conversation_turns'::regclass AND tgname = 'conversation_turns_call_turn_terminal'`);
    assert.equal(trigger.tgenabled, 'O');
    assert.match(trigger.def, /BEFORE UPDATE OF status .* voice_private\.guard_call_turn_terminal_v1\(\)/u);
  });
  await report.section('T0c every new definer postgres-owned, pinned, service_role only; the six internals no role; the two reads SECURITY INVOKER for authenticated only', async () => {
    assert.equal(INTERNAL.length, 6);
    for (const fn of [...DEFINERS, ...INTERNAL, ...READS]) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config, p.prosecdef AS definer,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', fn);
      assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
      const read = READS.includes(fn);
      assert.equal(p.definer, !read, `${fn}: ${read ? 'invoker' : 'definer'}`);
      assert.deepEqual([p.anon, p.auth, p.service], [false, read, DEFINERS.includes(fn)], `${fn}: roles`);
    }
  });
  await report.section('T0d every forward-replaced function is its origin statement plus exactly the declared edits, in 0190 and live; the coordinator and finalize v2 untouched', async () => {
    const text = readFileSync(new URL(`./migrations/${MIGRATION_0190}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
    for (const substitution of SUBSTITUTIONS) {
      const declared = substitutedStatement(substitution);
      const written = extractStatement(text, substitution.header);
      assert.equal(written.statement, declared, `${substitution.key}: the 0190 statement is the derived one`);
      assert.ok(substitution.edits.every(([, to]) => to.includes('S8B-05 CP2 (0190')), `${substitution.key}: the edit names its task`);
      const name = /FUNCTION ([a-z_]+\.[a-z_0-9]+)\(/u.exec(substitution.header)[1];
      const live = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = $1`, [name]);
      assert.ok(live.some((r) => r.prosrc.replace(/\r\n/gu, '\n') === written.body), `${substitution.key}: the live body is the 0190 body`);
    }
    assert.doesNotMatch(text, /FUNCTION public\.finalize_conversation_turn_v2\(/u, 'finalize v2 is not redefined');
    assert.doesNotMatch(text, /FUNCTION public\.commit_finalized_exchange_with_full_semantic_chain_v1\(/u, 'the coordinator is untouched');
    assert.doesNotMatch(text, /ALTER TABLE public\.conversation_turns\b/u, 'the conversation_turns constraints are untouched');
  });
  await report.section('T0e the call turn policy; four scopes DISABLED / UNSATISFIED; the census clean', async () => {
    const [p] = await rows('SELECT * FROM voice_private.live_call_turn_policy_v1()');
    assert.deepEqual([p.max_turn_chars, p.max_segment_chars, p.max_segments, p.max_call_turns, p.max_terms, p.max_term_length], [4000, 2000, 64, 2000, 64, 48]);
    const scopes = await rows('SELECT feature_flag_state AS f, launch_requirements_state AS r FROM voice_private.voice_launch_capability_states');
    assert.equal(scopes.length, 4);
    assert.ok(scopes.every((s) => s.f === 'DISABLED' && s.r === 'UNSATISFIED'));
    const census = await rows(`SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c WHERE c.contype = 'f'
        AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
        AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)`);
    assert.deepEqual(census, []);
  });
}

// ------------------------------------------------------------------ behaviour (one rolled-back transaction)
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await setCapacity(64);
    await report.isolated('T1 commit: fenced, gated, consented; the USER anchor inside the USER track; turn, source, number, exchange and USER half in one transaction; idempotent; a TEXT turn in the same order', async () => {
      const x = await activeCall();
      await audio(x, 'USER', 2000);
      const stranger = await activeCall();
      assert.equal((await commit({ ...x, user: stranger.user })).outcome, 'NOT_FOUND', 'another human\'s call');
      assert.equal((await commit(x, { epoch: 2 })).outcome, 'FENCED', 'an epoch the call never had');
      await rejected(() => commit(x, { end: 2020 }), ['22023']);
      await owner();
      await rejected(() => commit(x, { content: '   ' }), ['22023']);
      await owner();
      await rejected(() => commit(x, { band: 'UNSURE' }), ['22023']);
      await owner();
      await rejected(() => commit(x, { terms: ['Upper'] }), ['22023']);
      await owner();
      await setGate(LIVE, 'DISABLED', 'UNSATISFIED');
      assert.equal((await commit(x)).outcome, 'NOT_AVAILABLE_NOW');
      await setGate();
      const commitId = randomUUID();
      const r = await commit(x, { commit: commitId, start: 0, end: 2000, band: 'MEDIUM', terms: ['ليلى', 'مدرسة'] });
      assert.deepEqual([r.outcome, r.call_turn_index, r.closed_call_turn_index], ['COMMITTED', 1, null]);
      const t = await turnRow(r.turn_id);
      assert.deepEqual([t.role, t.status, t.processing_path, t.routing_reason, t.session_id, t.source_turn_id, t.generation_lease_expires_at],
        ['USER', 'GENERATING', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', x.session, null, null], 'the same Personal Conversation');
      const s = await sourceRow(r.turn_id);
      assert.deepEqual([s.source_role, s.source_modality, s.transcript_origin, s.asr_confidence_band, s.recording_id, n(s.anchor_start_ms), n(s.anchor_end_ms)],
        ['USER', 'LIVE_CALL_SPEECH', 'MACHINE_ASR', 'MEDIUM', x.recording, 0, 2000]);
      const [ct] = await rows('SELECT * FROM public.conversation_call_turns WHERE turn_id = $1', [r.turn_id]);
      assert.deepEqual([ct.call_id, ct.call_turn_index, ct.turn_role, ct.turn_channel, ct.retrieval_terms], [x.call, 1, 'USER', 'SPEECH', ['ليلى', 'مدرسة']]);
      const ex = await exchange(x, 1);
      assert.deepEqual([ex.exchange_state, ex.safety_disposition, ex.generation_state, ex.user_turn_id], ['OPEN', null, 'GENERATING', r.turn_id]);
      const queue = await rows('SELECT half, queue_state, turn_id FROM voice_private.call_analysis_queue WHERE call_id = $1', [x.call]);
      assert.deepEqual(queue, [{ half: 'USER', queue_state: 'PENDING', turn_id: r.turn_id }], 'R7′: the USER half in the commit transaction');
      const again = await commit(x, { commit: commitId });
      assert.deepEqual([again.outcome, again.call_turn_index, again.turn_id], ['ALREADY_COMMITTED', 1, r.turn_id]);
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.conversation_call_turns WHERE call_id = $1', [x.call]))[0].n, 1);
      // A typed turn during the call (C2): the next index, no voice source; it closes the open exchange like a spoken one.
      assert.equal(await safety(x, 1), 'STORED');
      await rejected(() => one(COMMIT_SQL, [x.user, x.call, 1, randomUUID(), randomUUID(), 'TEXT', 'نص', 'HIGH', null, null, [], randomUUID(), randomUUID()]), ['22023']);
      await owner();
      const typed = await one(COMMIT_SQL, [x.user, x.call, 1, randomUUID(), randomUUID(), 'TEXT', 'وكمان حاجة', null, null, null, [], randomUUID(), randomUUID()]);
      assert.deepEqual([typed.outcome, typed.call_turn_index, typed.closed_call_turn_index, typed.closed_delivery_state], ['COMMITTED', 2, 1, 'INTERRUPTED']);
      assert.equal(await sourceRow(typed.turn_id), undefined);
      assert.equal((await rows('SELECT turn_channel FROM public.conversation_call_turns WHERE turn_id = $1', [typed.turn_id]))[0].turn_channel, 'TEXT');
      // The call's end fences the next commit; a replay still answers.
      assert.equal((await one('SELECT * FROM public.server_end_call_v1($1, $2, 1, $3)', [x.user, x.call, 'USER_ENDED'])).outcome, 'ENDED');
      assert.equal((await commit(x)).outcome, 'FENCED');
      assert.equal((await commit(x, { commit: commitId })).outcome, 'ALREADY_COMMITTED');
    });

    await report.isolated('T2 R2-G: fail / cancel / recover and any status write refuse a call turn; a typed turn outside a call fails as before', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x, { audioTo: 1000 });
      const args = [x.session, x.user, t.turn, randomUUID()];
      await rejected(() => server('SELECT * FROM public.fail_conversation_turn($1, $2, $3, $4)', args), ['55000']);
      await owner();
      await rejected(() => server('SELECT * FROM public.recover_expired_generating_conversation_turn_v1($1, $2, $3, $4)', args), ['55000']);
      await owner();
      await rejected(() => asOwner(x.user, 'SELECT * FROM public.cancel_conversation_turn($1, $2, $3, $4)', args), ['55000']);
      await owner();
      for (const status of ['FAILED', 'CANCELLED', 'SUPERSEDED']) {
        await rejected(() => q('UPDATE public.conversation_turns SET status = $2 WHERE id = $1', [t.turn, status]), ['55000']);
      }
      assert.equal((await turnRow(t.turn)).status, 'GENERATING');
      // The closed reply turn is the call authority's too.
      await reply(x, t.idx, [['تمام', 400]], 'COMPLETE');
      await heard(x, t.idx, 400);
      const closed = await close(x, t.idx, 'PLAYED_OUT');
      await rejected(() => q("UPDATE public.conversation_turns SET status = 'FAILED' WHERE id = $1", [closed.assistant_turn_id]), ['55000']);
      // A typed GENERATING turn outside any call: fail_conversation_turn still fails it.
      const typed = randomUUID();
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason)
               VALUES ($1, $2, $3, 'USER', 'GENERATING', 'مكتوب', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT')`, [typed, x.session, x.user]);
      const failed = await server('SELECT * FROM public.fail_conversation_turn($1, $2, $3, $4)', [x.session, x.user, typed, randomUUID()]);
      assert.equal(failed[0].status, 'FAILED');
    });

    await report.isolated('T3 Safety S1 – S3: stored once, SAME again, a different value an error; no close or N1 without it; the stored value is the event\'s', async () => {
      const x = await activeCall();
      await audio(x, 'USER', 1000);
      const r = await commit(x);
      await rejected(() => close(x, r.call_turn_index, 'PLAYED_OUT'), ['55000']);
      await owner();
      const before = n((await rows('SELECT next_call_turn_index FROM voice_private.calls WHERE id = $1', [x.call]))[0].next_call_turn_index);
      await audio(x, 'USER', 2000);
      await rejected(() => commit(x, { start: 1000, end: 2000 }), ['55000']);
      await owner();
      assert.equal(n((await rows('SELECT next_call_turn_index FROM voice_private.calls WHERE id = $1', [x.call]))[0].next_call_turn_index), before,
        'the refused N1 commit consumed nothing');
      assert.equal(await safety(x, r.call_turn_index, 'GUIDED'), 'STORED');
      assert.equal(await safety(x, r.call_turn_index, 'GUIDED'), 'SAME', 'a deterministic recompute after a crash');
      await rejected(() => safety(x, r.call_turn_index, 'ALLOW'), ['55000']);
      await owner();
      assert.equal(await safety({ ...x, user: randomUUID() }, r.call_turn_index, 'GUIDED'), 'NOT_FOUND');
      await reply(x, r.call_turn_index, [['خلّينا نهدى شوية', 600]], 'COMPLETE');
      await heard(x, r.call_turn_index, 600);
      await close(x, r.call_turn_index, 'PLAYED_OUT');
      const [event] = await outboxFor(r.turn_id);
      assert.deepEqual([event.event_type, event.event_version, event.schema_ref, event.payload.safety_disposition, event.payload.terminal_status],
        ['ConversationTurnCompleted', '2.0', 'qandeel.runtime.conversation-turn-completed.v2', 'GUIDED', 'COMPLETED']);
      assert.deepEqual(Object.keys(event.payload).sort(), ['orchestration_id', 'processing_path', 'routing_reason', 'safety_disposition',
        'session_id', 'source_turn_id', 'terminal_status', 'user_id'], 'the finalize_conversation_turn_v2 payload shape');
      assert.equal(await safety(x, r.call_turn_index, 'GUIDED'), 'SAME');
      await rejected(() => safety(x, r.call_turn_index, 'BLOCK'), ['55000']);
    });

    await report.isolated('T4 CA-05-02: the five cases, the heard mark bounded by the QANDEEL track, text = chunks whose end ≤ the mark', async () => {
      const check = async (x, closed, idx, userTurn, expected) => {
        assert.equal(closed.delivery_state, expected.delivery, `${expected.label}: delivery_state`);
        const a = await turnRow(closed.assistant_turn_id);
        assert.deepEqual([a.role, a.status, a.content, a.source_turn_id], ['ASSISTANT', 'COMPLETED', expected.text, userTurn], `${expected.label}: reply turn`);
        const s = await sourceRow(closed.assistant_turn_id);
        assert.deepEqual([s.source_role, s.delivery_state, s.spoken, s.anchor_start_ms === null ? null : n(s.anchor_start_ms), s.anchor_end_ms === null ? null : n(s.anchor_end_ms)],
          ['ASSISTANT', expected.delivery, true, ...expected.anchor], `${expected.label}: voice source`);
        assert.equal((await turnRow(userTurn)).status, 'COMPLETED', `${expected.label}: the user turn completes`);
        const events = await outboxFor(userTurn);
        assert.equal(events.length, 1, `${expected.label}: one ConversationTurnCompleted v2 (R5′)`);
        assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.call_reply_segments WHERE call_id = $1 AND call_turn_index = $2', [x.call, idx]))[0].n, 0);
        const [ct] = await rows('SELECT call_turn_index, turn_role FROM public.conversation_call_turns WHERE turn_id = $1', [closed.assistant_turn_id]);
        assert.deepEqual([ct.call_turn_index, ct.turn_role], [idx, 'ASSISTANT']);
      };
      // 1. COMPLETE: all produced audio heard.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 2000 });
        await reply(x, t.idx, [['أهلًا. ', 1000], ['إزيك؟', 1000]], 'COMPLETE');
        const start = await heard(x, t.idx, 1000, 2000);
        await heard(x, t.idx, 2000);
        const c = await close(x, t.idx, 'PLAYED_OUT');
        assert.equal(c.outcome, 'CLOSED');
        await check(x, c, t.idx, t.turn, { label: 'COMPLETE', delivery: 'COMPLETE', text: 'أهلًا. إزيك؟', anchor: [start, start + 2000] });
      }
      // 2. WITHHELD_TAIL: the guard stopped after a released part, all of which was heard.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1500 });
        await reply(x, t.idx, [['اللي فهمته إنك تعبان. ', 1200]], 'WITHHELD_TAIL');
        const start = await heard(x, t.idx, 1200, 1500);
        const c = await close(x, t.idx, 'PLAYED_OUT');
        await check(x, c, t.idx, t.turn, { label: 'WITHHELD_TAIL', delivery: 'WITHHELD_TAIL', text: 'اللي فهمته إنك تعبان. ', anchor: [start, start + 1200] });
      }
      // 3. INTERRUPTED after one complete chunk: the next turn closes it at the mark.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1000 });
        await reply(x, t.idx, [['ماشي. ', 1000], ['وبعدين؟', 1000]], 'COMPLETE');
        const start = await heard(x, t.idx, 1500, 1000);
        await audio(x, 'USER', 4000);
        const next = await commit(x, { start: 2600, end: 4000 });
        assert.deepEqual([next.closed_call_turn_index, next.closed_delivery_state, n(next.closed_heard_mark_ms)], [t.idx, 'INTERRUPTED', 1500]);
        const ex = await exchange(x, t.idx);
        await check(x, { delivery_state: ex.delivery_state, assistant_turn_id: ex.assistant_turn_id }, t.idx, t.turn,
          { label: 'INTERRUPTED (one chunk)', delivery: 'INTERRUPTED', text: 'ماشي. ', anchor: [start, start + 1500] });
        assert.equal(ex.close_reason, 'NEXT_TURN');
      }
      // 4a. INTERRUPTED before the first chunk, part of it heard: no text, the heard audio anchored.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1000 });
        await reply(x, t.idx, [['بص يا سيدي', 1000]]);
        const start = await heard(x, t.idx, 600, 1000);
        await audio(x, 'USER', 3000);
        await commit(x, { start: 2000, end: 3000 });
        const ex = await exchange(x, t.idx);
        await check(x, ex, t.idx, t.turn, { label: 'INTERRUPTED (part of the first chunk)', delivery: 'INTERRUPTED', text: '', anchor: [start, start + 600] });
      }
      // 4b. INTERRUPTED before any audio: no text, no anchor.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1000 });
        await audio(x, 'USER', 2000);
        await commit(x, { start: 1000, end: 2000 });
        const ex = await exchange(x, t.idx);
        await check(x, ex, t.idx, t.turn, { label: 'INTERRUPTED (nothing heard)', delivery: 'INTERRUPTED', text: '', anchor: [null, null] });
      }
      // 5. FAILED: the generation failed with no audio.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1000 });
        assert.equal(await finish(x, t.idx, 'FAILED', 0), 'FINISHED');
        await rejected(() => finish(x, t.idx, 'FAILED', 20), ['22023']);
        await owner();
        const c = await close(x, t.idx, 'GENERATION_FAILED');
        await check(x, c, t.idx, t.turn, { label: 'FAILED', delivery: 'FAILED', text: '', anchor: [null, null] });
      }
      // The mark is bounded by what the QANDEEL track holds: a PLAYOUT past the recorded audio counts only what is recorded.
      {
        const x = await activeCall();
        const t = await spokenTurn(x, { audioTo: 1000 });
        await reply(x, t.idx, [['أول. ', 1000], ['تاني.', 1000]], 'COMPLETE');
        const r = await playout(x, t.idx, 2000, 1000);
        assert.equal(r.outcome, 'ADVANCED');
        await notSpeaking(x, 1000);
        await audio(x, 'QANDEEL', 2000);
        const c = await close(x, t.idx, 'PLAYED_OUT');
        assert.deepEqual([c.delivery_state, n(c.heard_mark_ms), n(c.anchor_start_ms), n(c.anchor_end_ms)], ['INTERRUPTED', 1000, 1000, 2000]);
        assert.equal((await turnRow(c.assistant_turn_id)).content, 'أول. ');
      }
    });

    await report.isolated('T5 PLAYOUT P1 – P3: the highest mark only; the clock start once and never before the QANDEEL track; after the close every late command rejected and counted; one close', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x, { audioTo: 1000 });
      await reply(x, t.idx, [['واحد. ', 1000], ['اتنين.', 1000]]);
      await notSpeaking(x, 1000);
      assert.equal((await playout(x, t.idx, 0, 1000)).outcome, 'IGNORED', 'nothing played yet');
      await rejected(() => playout(x, t.idx, 400, null), ['22023']);
      await owner();
      await rejected(() => playout(x, t.idx, 400, 990), ['22023']);
      await owner();
      await rejected(() => playout(x, t.idx, 400, 980), ['22023']);
      await owner();
      assert.equal((await playout(x, t.idx, 800, 1000, 2)).outcome, 'FENCED');
      const a = await playout(x, t.idx, 800, 1000);
      assert.deepEqual([a.outcome, n(a.playout_mark_ms), n(a.reply_clock_start_ms)], ['ADVANCED', 800, 1000]);
      assert.equal((await playout(x, t.idx, 600, 1000)).outcome, 'IGNORED', 'an older mark');
      assert.equal((await playout(x, t.idx, 800, 1000)).outcome, 'IGNORED', 'a repeated mark');
      const b = await playout(x, t.idx, 1400, 4000);
      assert.deepEqual([b.outcome, n(b.reply_clock_start_ms)], ['ADVANCED', 1000], 'the clock start is fixed once');
      await audio(x, 'QANDEEL', 2400);
      await rejected(() => segment(x, t.idx, 5, 'خطأ', 2000, 2400), ['55000']);
      await owner();
      assert.equal(await finish(x, t.idx, 'COMPLETE', 2000), 'FINISHED');
      assert.equal(await finish(x, t.idx, 'COMPLETE', 2000), 'ALREADY_FINISHED');
      assert.equal(await finish(x, t.idx, 'WITHHELD_TAIL', 2000), 'CONFLICT');
      await rejected(() => close(x, t.idx, 'NEXT_TURN'), ['22023']);
      await owner();
      assert.equal((await close(x, t.idx, 'CALL_ENDING', 2)).outcome, 'FENCED');
      const c = await close(x, t.idx, 'CALL_ENDING');
      assert.deepEqual([c.outcome, c.delivery_state, n(c.heard_mark_ms)], ['CLOSED', 'INTERRUPTED', 1400]);
      const frozen = await exchange(x, t.idx);
      assert.equal((await playout(x, t.idx, 2000)).outcome, 'CLOSED');
      assert.equal(await segment(x, t.idx, 2, 'متأخر', 2000, 2400), 'CLOSED');
      assert.equal(await finish(x, t.idx, 'COMPLETE', 2000), 'CLOSED');
      const again = await close(x, t.idx, 'PLAYED_OUT');
      assert.deepEqual([again.outcome, again.assistant_turn_id, again.delivery_state, n(again.heard_mark_ms), n(again.anchor_start_ms), n(again.anchor_end_ms)],
        ['ALREADY_CLOSED', c.assistant_turn_id, 'INTERRUPTED', 1400, 1000, 2400]);
      const after = await exchange(x, t.idx);
      assert.deepEqual({ ...after, late_rejections: frozen.late_rejections }, frozen, 'nothing changes after the close');
      assert.equal(after.late_rejections, 3, 'the late PLAYOUT, segment and finish counted');
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.conversation_turns WHERE source_turn_id = $1', [t.turn]))[0].n, 1);
      assert.equal((await outboxFor(t.turn)).length, 1);
    });

    await report.isolated('T6 N1 and the long call: one open exchange; a new turn closes the previous one in its transaction; 40 turns never stopped by the text windows; the call\'s own bound', async () => {
      const x = await activeCall();
      for (let i = 1; i <= 40; i += 1) {
        const t = await spokenTurn(x, { audioTo: i * 500, start: (i - 1) * 500, end: i * 500, content: `جملة رقم ${i}` });
        assert.equal(t.idx, i);
        if (i > 1) assert.equal(t.closed.closed_call_turn_index, i - 1);
        await reply(x, t.idx, [[`رد ${i}`, 200]], 'COMPLETE');
      }
      const states = await rows(`SELECT exchange_state, count(*)::int AS n FROM voice_private.call_exchanges WHERE call_id = $1 GROUP BY 1 ORDER BY 1`, [x.call]);
      assert.deepEqual(states, [{ exchange_state: 'CLOSED', n: 39 }, { exchange_state: 'OPEN', n: 1 }]);
      const order = await rows(`SELECT call_turn_index AS i FROM public.conversation_call_turns WHERE call_id = $1 AND turn_role = 'USER' ORDER BY 1`, [x.call]);
      assert.deepEqual(order.map((o) => o.i), Array.from({ length: 40 }, (_, k) => k + 1));
      await rejected(() => q(`INSERT INTO voice_private.call_exchanges (call_id, call_turn_index, user_id, session_id, user_turn_id, committed_epoch)
          SELECT call_id, 999, user_id, session_id, $2, 1 FROM voice_private.call_exchanges WHERE call_id = $1 LIMIT 1`, [x.call, randomUUID()]), ['23505', '23503']);
      await q("SET LOCAL session_replication_role = 'replica'");
      await q('UPDATE voice_private.calls SET next_call_turn_index = 2000 WHERE id = $1', [x.call]);
      await q("SET LOCAL session_replication_role = 'origin'");
      assert.equal((await commit(x, { start: 19500, end: 20000 })).outcome, 'CALL_TURN_LIMIT');
    });

    await report.isolated('T7 context and retrieval under the owner\'s RLS: earlier exchanges, then the call\'s by index with the heard reply only; two terms, or one with a recall cue; at most two', async () => {
      const x = await activeCall();
      // A typed exchange before the call, in the same Personal Conversation.
      const [u0, a0] = [randomUUID(), randomUUID()];
      await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, completed_at, created_at)
               VALUES ($1, $3, $4, 'USER', 'COMPLETED', 'قبل المكالمة', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', clock_timestamp(), clock_timestamp() - interval '1 hour'),
                      ($2, $3, $4, 'ASSISTANT', 'COMPLETED', 'رد مكتوب', 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', clock_timestamp(), clock_timestamp() - interval '1 hour')`,
      [u0, a0, x.session, x.user]);
      await q('UPDATE public.conversation_turns SET source_turn_id = $1 WHERE id = $2', [u0, a0]);
      const t1 = await spokenTurn(x, { audioTo: 1000, content: 'بنتي ليلى دخلت المدرسة', terms: ['ليلى', 'مدرسة'] });
      await reply(x, t1.idx, [['ربنا يوفقها. ', 600], ['هي في سنة كام؟', 600]], 'COMPLETE');
      await heard(x, t1.idx, 600, 1000);
      const t2 = await spokenTurn(x, { audioTo: 2000, start: 1000, end: 2000, content: 'أولى ابتدائي', terms: ['ابتدائي'] });
      await reply(x, t2.idx, [['حلو.', 400]], 'COMPLETE');
      await heard(x, t2.idx, 400);
      const t3 = await spokenTurn(x, { audioTo: 3000, start: 2000, end: 3000, content: 'ليلى بتحب الرسم', terms: ['ليلى', 'رسم'] });
      await reply(x, t3.idx, [['جميل.', 400]], 'COMPLETE');
      await heard(x, t3.idx, 400);
      await spokenTurn(x, { audioTo: 4000, start: 3000, end: 4000, content: 'فاكر قلتلك على ليلى؟', terms: ['ليلى'] });
      const context = await asOwner(x.user, 'SELECT * FROM public.call_context_exchanges_v1($1, $2, 12)', [x.session, x.call]);
      assert.deepEqual(context.map((c) => [c.exchange_kind, c.call_turn_index, c.user_content, c.reply_content]), [
        ['PRE_CALL', null, 'قبل المكالمة', 'رد مكتوب'],
        ['CALL', 3, 'ليلى بتحب الرسم', 'جميل.'],
        ['CALL', 2, 'أولى ابتدائي', 'حلو.'],
        ['CALL', 1, 'بنتي ليلى دخلت المدرسة', 'ربنا يوفقها. '],
      ], 'C2/C3: N+1 sees N\'s words and only N\'s heard reply; the open exchange is not context');
      const stranger = await human();
      assert.deepEqual(await asOwner(stranger, 'SELECT * FROM public.call_context_exchanges_v1($1, $2, 12)', [x.session, x.call]), [], 'RLS');
      const retrieve = (terms, cue, before) => asOwner(x.user, 'SELECT * FROM public.call_turn_retrieval_v1($1, $2, $3, $4)', [x.call, terms, cue, before]);
      assert.deepEqual((await retrieve(['ليلى', 'مدرسة'], false, 4)).map((r) => [r.call_turn_index, r.matched_terms]), [[1, 2]]);
      assert.deepEqual(await retrieve(['مدرسة'], false, 4), [], 'one term without a recall cue');
      assert.deepEqual((await retrieve(['مدرسة'], true, 4)).map((r) => [r.call_turn_index, r.reply_content]), [[1, 'ربنا يوفقها. ']]);
      assert.deepEqual((await retrieve(['ليلى'], true, 4)).map((r) => r.call_turn_index), [3, 1], 'at most two, the newest first');
      assert.deepEqual(await retrieve(['ليلى', 'مدرسة'], false, 1), [], 'only earlier exchanges');
      assert.deepEqual(await asOwner(stranger, 'SELECT * FROM public.call_turn_retrieval_v1($1, $2, true, 9)', [x.call, ['ليلى']]), [], 'RLS');
      // The reply's terms join its turn's: the heard segments' terms only.
      const [assistant] = await rows(`SELECT retrieval_terms FROM public.conversation_call_turns WHERE call_id = $1 AND call_turn_index = 1 AND turn_role = 'ASSISTANT'`, [x.call]);
      assert.deepEqual(assistant.retrieval_terms, []);
    });

    await report.isolated('T8 AI-COST-01: one TTS ledger row per attempt on the USER turn while open; the recognition row GATEWAY_MEASURED; settled once', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x, { audioTo: 1000 });
      const speech = (id, idx = t.idx, epoch = x.epoch) =>
        one('SELECT * FROM public.server_begin_call_reply_speech_v1($1, $2, $3, $4, $5, $6)', [x.user, x.call, epoch, idx, id, 'gemini-2.5-flash-tts']);
      const [s1, s2] = [randomUUID(), randomUUID()];
      assert.equal((await speech(s1)).outcome, 'BEGUN');
      assert.equal((await speech(s2)).outcome, 'BEGUN');
      await rejected(() => speech(s1), ['PT409']);
      await owner();
      assert.equal((await speech(randomUUID(), t.idx, 2)).outcome, 'FENCED');
      const ledger = await rows(`SELECT provider, operation, feature_family, source_turn_id, attempt_number, call_state FROM public.ai_provider_calls
          WHERE id = ANY($1::uuid[]) ORDER BY attempt_number`, [[s1, s2]]);
      assert.deepEqual(ledger.map((l) => [l.provider, l.feature_family, l.source_turn_id, l.attempt_number, l.call_state]),
        [['GEMINI', 'SPEECH_SYNTHESIS', t.turn, 1, 'PENDING'], ['GEMINI', 'SPEECH_SYNTHESIS', t.turn, 2, 'PENDING']]);
      const settle = async (id, outcome, completeness, usage = {}) =>
        (await one('SELECT * FROM public.server_settle_call_provider_call_v1($1, $2, $3, $4, $5)', [x.user, id, outcome, completeness, usage])).outcome;
      assert.equal(await settle(s1, 'SUCCEEDED', 'ABSENT'), 'SETTLED');
      assert.equal(await settle(s1, 'SUCCEEDED', 'ABSENT'), 'ALREADY_SETTLED');
      assert.equal(await settle(s2, 'UNKNOWN', 'ABSENT'), 'SETTLED');
      assert.equal((await rows('SELECT call_state FROM public.ai_provider_calls WHERE id = $1', [s2]))[0].call_state, 'FAILED_USAGE_UNKNOWN');
      assert.equal(await settle(randomUUID(), 'SUCCEEDED', 'ABSENT'), 'NOT_FOUND');
      const asr = randomUUID();
      assert.equal((await one('SELECT * FROM public.server_begin_call_transcription_v1($1, $2, $3, $4, $5)', [x.user, x.call, 1, asr, 'speechmatics-rt-enhanced'])).outcome, 'BEGUN');
      assert.equal(await settle(asr, 'SUCCEEDED', 'COMPLETE', { AUDIO_INPUT_MS: 61000 }), 'SETTLED');
      const [row] = await rows('SELECT provider, feature_family, source_turn_id, call_state, usage_source, usage_completeness FROM public.ai_provider_calls WHERE id = $1', [asr]);
      assert.deepEqual(row, { provider: 'SPEECHMATICS', feature_family: 'LIVE_CALL_TRANSCRIPTION', source_turn_id: null, call_state: 'SUCCEEDED_USAGE_REPORTED',
        usage_source: 'GATEWAY_MEASURED', usage_completeness: 'COMPLETE' });
      assert.equal(await finish(x, t.idx, 'FAILED', 0), 'FINISHED');
      await close(x, t.idx, 'GENERATION_FAILED');
      assert.equal((await speech(randomUUID())).outcome, 'CLOSED', 'no attempt after the close');
    });

    await report.isolated('T9 Export My Data and the history read carry deliveryState; account erasure removes every new row', async () => {
      const x = await activeCall();
      const t = await spokenTurn(x, { audioTo: 1000 });
      await reply(x, t.idx, [['تمام', 400]], 'COMPLETE');
      await heard(x, t.idx, 400, 1000);
      await close(x, t.idx, 'PLAYED_OUT');
      await spokenTurn(x, { audioTo: 2000, start: 1000, end: 2000 });
      const [{ doc }] = await rows('SELECT personal_data_private.build_personal_export_v1($1) AS doc', [x.user]);
      const text = JSON.stringify(doc);
      assert.match(text, /"deliveryState":"complete"/u);
      assert.match(text, /"confidenceBand":"high"/u);
      assert.equal(text.split('"deliveryState"').length - 1, 1, 'only the closed reply states a delivery (a USER source and the open exchange none)');
      // The history's additive deliveryState: the owner's call reply only, never a USER turn or another person's session.
      const turns = (await rows('SELECT turn_id, source_role FROM public.conversation_turn_voice_sources WHERE user_id = $1 ORDER BY attached_at', [x.user]));
      const replyTurn = turns.find((r) => r.source_role === 'ASSISTANT').turn_id;
      const ids = turns.map((r) => r.turn_id);
      assert.deepEqual(await server('SELECT * FROM public.server_read_call_reply_delivery_v1($1, $2, $3)', [x.user, x.session, ids]),
        [{ turn_id: replyTurn, delivery_state: 'COMPLETE' }]);
      const stranger = await activeCall();
      assert.deepEqual(await server('SELECT * FROM public.server_read_call_reply_delivery_v1($1, $2, $3)', [stranger.user, x.session, ids]), []);
      await rejected(() => server('SELECT * FROM public.server_read_call_reply_delivery_v1($1, $2, $3)', [x.user, x.session, Array.from({ length: 101 }, () => randomUUID())]), ['22023']);
      assert.equal((await one('SELECT * FROM public.server_end_call_v1($1, $2, 1, $3)', [x.user, x.call, 'USER_ENDED'])).outcome, 'ENDED');
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [x.user]);
      assert.equal((await one('SELECT public.server_erase_account_v1($1) AS outcome', [del.id])).outcome, 'ERASED');
      for (const relation of [NEW_PUBLIC, ...PRIVATE]) {
        assert.equal((await rows(`SELECT count(*)::int AS n FROM ${relation} WHERE user_id = $1`, [x.user]))[0].n, 0, relation);
      }
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ races (committed fixtures, removed afterwards)
async function verifyRaces(report) {
  const { q2, close: closeSecondary } = await rt.openSecondary();
  const sr = async (client, sql, values) => {
    await client('BEGIN');
    await client('SET LOCAL ROLE service_role');
    return (await client(sql, values)).rows[0];
  };
  const people = [];
  await owner();
  const [gate] = await rows('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = $1', [LIVE]);
  const [policy] = await rows('SELECT * FROM voice_private.live_call_policy');
  const fresh = async () => {
    const x = await activeCall();
    people.push(x.user);
    return x;
  };
  const closeSql = 'SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, $3, $4, $5, $6, $7)';
  const playoutSql = 'SELECT * FROM public.server_confirm_call_playout_v1($1, $2, $3, $4, $5, $6)';
  try {
    await setCapacity(64);
    await report.section('TRC-1 natural close holds the exchange; the N1 commit waits, then finds nothing open: one close, one reply turn', async () => {
      const x = await fresh();
      const t = await spokenTurn(x, { audioTo: 1000 });
      await reply(x, t.idx, [['أكيد', 400]], 'COMPLETE');
      await heard(x, t.idx, 400, 1000);
      await audio(x, 'USER', 2000);
      await owner();
      const a = await sr(q, closeSql, [x.user, x.call, 1, t.idx, 'PLAYED_OUT', randomUUID(), randomUUID()]);
      const b = sr(q2, COMMIT_SQL, commitArgs(x, { start: 1000, end: 2000 }));
      assert.equal(await rt.stillPending(b), true, 'the commit waits on the call row');
      await q('COMMIT');
      await owner();
      const r = await b;
      await q2('COMMIT');
      assert.deepEqual([a.outcome, a.delivery_state, r.outcome, r.closed_call_turn_index], ['CLOSED', 'COMPLETE', 'COMMITTED', null]);
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.conversation_turns WHERE source_turn_id = $1', [t.turn]))[0].n, 1);
    });

    await report.section('TRC-2 the N1 commit holds the call; the natural close waits and answers ALREADY_CLOSED with the NEXT_TURN truth', async () => {
      const x = await fresh();
      const t = await spokenTurn(x, { audioTo: 1000 });
      await reply(x, t.idx, [['طيب. ', 400], ['وبعدين؟', 400]], 'COMPLETE');
      await heard(x, t.idx, 400, 1000);
      await audio(x, 'USER', 2000);
      await owner();
      const a = await sr(q, COMMIT_SQL, commitArgs(x, { start: 1000, end: 2000 }));
      const b = sr(q2, closeSql, [x.user, x.call, 1, t.idx, 'PLAYED_OUT', randomUUID(), randomUUID()]);
      assert.equal(await rt.stillPending(b), true, 'the close waits');
      await q('COMMIT');
      await owner();
      const r = await b;
      await q2('COMMIT');
      assert.deepEqual([a.closed_delivery_state, n(a.closed_heard_mark_ms), r.outcome, r.delivery_state, n(r.heard_mark_ms)],
        ['INTERRUPTED', 400, 'ALREADY_CLOSED', 'INTERRUPTED', 400]);
      assert.equal((await outboxFor(t.turn)).length, 1);
    });

    await report.section('TRC-3 a late PLAYOUT waits for the close and is rejected; two closes: one CLOSED, one ALREADY_CLOSED', async () => {
      const x = await fresh();
      const t = await spokenTurn(x, { audioTo: 1000 });
      await reply(x, t.idx, [['حاضر. ', 400], ['خلاص.', 400]], 'COMPLETE');
      await heard(x, t.idx, 400, 1000);
      await owner();
      const a = await sr(q, closeSql, [x.user, x.call, 1, t.idx, 'CALL_ENDING', randomUUID(), randomUUID()]);
      const late = sr(q2, playoutSql, [x.user, x.call, 1, t.idx, 800, null]);
      assert.equal(await rt.stillPending(late), true, 'the PLAYOUT waits on the exchange row');
      await q('COMMIT');
      await owner();
      const l = await late;
      await q2('COMMIT');
      assert.deepEqual([a.outcome, n(a.heard_mark_ms), l.outcome, n(l.playout_mark_ms)], ['CLOSED', 400, 'CLOSED', 400]);
      await owner();
      const c1 = await sr(q, closeSql, [x.user, x.call, 1, t.idx, 'PLAYED_OUT', randomUUID(), randomUUID()]);
      await q('COMMIT');
      await owner();
      assert.equal(c1.outcome, 'ALREADY_CLOSED');
      const [ex] = await rows('SELECT heard_mark_ms, close_reason, late_rejections FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = $2', [x.call, t.idx]);
      assert.deepEqual([n(ex.heard_mark_ms), ex.close_reason, ex.late_rejections], [400, 'CALL_ENDING', 1]);
    });

    await report.section('TRC-4 a spoken and a typed commit of one call: one waits for the other; consecutive call_turn_index, the typed one closes the spoken one', async () => {
      const x = await fresh();
      await audio(x, 'USER', 1000);
      await owner();
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      const spoken = (await q(COMMIT_SQL, commitArgs(x, { start: 0, end: 1000 }))).rows[0];
      await q('SELECT * FROM public.server_store_call_turn_safety_v1($1, $2, $3, $4)', [x.user, x.call, spoken.call_turn_index, 'ALLOW']);
      const typed = sr(q2, COMMIT_SQL, [x.user, x.call, 1, randomUUID(), randomUUID(), 'TEXT', 'مكتوب أثناء المكالمة', null, null, null, [], randomUUID(), randomUUID()]);
      assert.equal(await rt.stillPending(typed), true, 'the typed commit waits on the call row');
      await q('COMMIT');
      await owner();
      const t = await typed;
      await q2('COMMIT');
      assert.deepEqual([spoken.call_turn_index, t.call_turn_index, t.closed_call_turn_index, t.closed_delivery_state],
        [spoken.call_turn_index, spoken.call_turn_index + 1, spoken.call_turn_index, 'INTERRUPTED']);
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await closeSecondary();
    await removeRaceFixtures(people, gate, policy);
  }
}

// The TRC fixtures are committed, and in CI the next steps share this database: the gate and the policy go back to the state they had and
// every row of the fixture humans goes, so the run leaves nothing behind.
async function removeRaceFixtures(humans, gate, policy) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.call_analysis_queue WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.call_reply_segments WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.call_exchanges WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.conversation_call_turns WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_gaps WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recording_objects WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
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
  await rt.removeHistoricalFixture(humans);
  await rt.removeFixtureHumans(humans);
}

runVerifier('0190', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0190', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('races');
  await verifyRaces(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
