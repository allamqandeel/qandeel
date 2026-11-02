// Real-PostgreSQL verifier for migration 0188 (S8B-04 CP2, the automatic voice reply and the Fast Voice Path for Personal
// Voice Notes; controlled amendment FVP v1.0). No provider is called; every scenario but PRC runs in one transaction that
// is rolled back.
//
//   P0   catalogue: the five relations postgres-owned, RLS on, no policy, no grant; every new definer service_role only,
//        internal helpers no role's; coverage ACCOUNT_CASCADE; VOICE_RECORDING_V3 current with its digests (the file text
//        is the installed text), V1 / V2 historical and byte-identical; four scopes DISABLED
//   P1   live note (D-S1, FVP-1): consent to V3 only (a V1 or V2 grant is VERSION_NOT_CURRENT and refused), gate, session, one per
//        person, replay idempotent, another human NOT_FOUND; the realtime ledger row begins with the note and settles
//        GATEWAY_MEASURED audio, or usage unknown (never zero)
//   P2   accept-first: accept v1 + the READY live transcript in ONE transaction; the batch claim never sees it; the
//        unchanged commit admits the turn from it; an unqualified / foreign / cancelled live note leaves the batch path
//   P3   one automatic reply per voice-note turn; never for a typed turn or another human
//   P4   one ledger row per attempt bound to the voice-note turn; repeats free; the busy bound counts Listen + live
//   P5   completion / failure: UNKNOWN is final (never re-synthesized); one retry after a known failure, its own row
//   P6   finish: the contiguous READY prefix; the assistant turn must answer the voice-note turn; reads re-check gate and
//        consent; late completions after finish keep no audio but stay accounted
//   P7   withheld tail (D-S2): the released part stored, delivery recorded, NO outbox event, SELECTED question RELEASED
//   P8   sweep: expired leases FAILED_UNKNOWN + usage unknown, expired replies deleted, abandoned live notes settled
//   P9   account erasure removes every new row
//   PRC  races on two connections: the same turn's reply opened twice, the same segment admitted twice, accept-live vs
//        the batch claim
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { MIGRATION_0188, VOICE_CONSENT_V3, VOICE_CONSENT_V3_AR_SHA256, VOICE_CONSENT_V3_EN_SHA256 } from './qandeel-voice-0188-anchor.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
const owner = () => asRole('postgres');
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
// A third string argument is a note for the reader; only a RegExp is matched against the error.
const rejected = (operation, codes, message = null) => rt.rejected(operation, codes, message instanceof RegExp ? message : null);

const V1_AR_SHA256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d';
const V1_EN_SHA256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426';
const V2_AR_SHA256 = '84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740';
const V2_EN_SHA256 = 'c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce';
const RELATIONS = ['voice_private.live_voice_notes', 'voice_private.note_live_transcriptions', 'voice_private.live_reply_streams',
  'voice_private.live_reply_segments', 'voice_private.voice_note_reply_deliveries'];
const DEFINERS = [
  'public.server_open_live_voice_note_v1(uuid,uuid,uuid,uuid,text)',
  'public.server_close_live_voice_note_v1(uuid,uuid,text,bigint)',
  'public.server_accept_live_voice_note_v1(uuid,uuid,bigint,uuid,bigint,text,text,text[],text)',
  'public.server_open_live_reply_v1(uuid,uuid,uuid,uuid)',
  'public.server_admit_live_reply_segment_v1(uuid,uuid,integer,uuid,text,integer,integer)',
  'public.server_retry_live_reply_segment_v1(uuid,uuid,integer,uuid,uuid,text,integer)',
  'public.server_complete_live_reply_segment_v1(uuid,uuid,bytea,text,jsonb)',
  'public.server_fail_live_reply_segment_v1(uuid,uuid,text,boolean)',
  'public.server_finish_live_reply_v1(uuid,uuid,text,integer,bigint,uuid)',
  'public.server_read_live_reply_v1(uuid,uuid)',
  'public.server_read_live_reply_segment_v1(uuid,uuid,integer)',
  'public.server_finalize_voice_note_withheld_tail_v1(uuid,uuid,uuid,uuid,text,text,text,uuid,uuid)',
  'public.server_sweep_fast_voice_v1(integer)',
];
const INTERNAL = ['voice_private.fast_voice_policy_v1()', 'voice_private.lock_live_voice_v1(uuid)',
  'voice_private.settle_live_voice_note_call_v1(uuid,uuid,boolean,bigint)', 'voice_private.live_reply_source_ok_v1(uuid,uuid,uuid)'];
const TTS = 'gemini-3.8-flash-tts';
const RT_MODEL = 'speechmatics-rt-enhanced';
const TRANSCRIPT = 'طبخت الأرز في القدر الكبير وبعدين أكلنا سوا';
const PCM = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
const USAGE = { INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900 };
const W = 'prove-0188';

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
async function setVoiceGate(flag = 'ENABLED', requirements = 'SATISFIED') {
  await owner();
  await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_VOICE_NOTE', $1, $2, 'prove-0188', 'real-PostgreSQL proof')`,
    [flag, requirements]);
}
const grant = async (user, version = VOICE_CONSENT_V3) =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), version])).outcome;
const revoke = async (user) => (await one('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()])).outcome;
async function turn(user, session, { role, status = 'COMPLETED', content, source = null }) {
  const id = randomUUID();
  await owner();
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason, source_turn_id, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT', $7, CASE WHEN $5 = 'COMPLETED' THEN clock_timestamp() END)`,
  [id, session, user, role, status, content, source]);
  return id;
}
async function storedNote(user, session) {
  const id = randomUUID();
  await owner();
  await q(`WITH n AS (SELECT clock_timestamp() AS t)
           INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, accepted_at,
                                                 retention_expires_at, recording_state)
           SELECT $1, $2, $3, 'VOICE_NOTE', $4, n.t, n.t + interval '30 days', 'STORED' FROM n`, [id, user, session, randomUUID()]);
  await q(`INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state,
                                                        content_type, byte_size, upload_deadline, stored_at)
           VALUES ($1, 'NOTE', 0, $2, 'STORED', 'audio/mp4', 2048, clock_timestamp(), clock_timestamp())`, [id, `voice-note/${randomUUID()}`]);
  return id;
}
/** A voice-note USER turn (GENERATING: its reply is being produced). */
async function voiceTurn(user, session, status = 'GENERATING') {
  const userTurn = await turn(user, session, { role: 'USER', status, content: TRANSCRIPT });
  const recording = await storedNote(user, session);
  await q(`INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality, transcript_origin,
             asr_confidence_band, recording_id, anchor_start_ms, anchor_end_ms) VALUES ($1, $2, $3, 'USER', 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH', $4, 0, 4200)`,
  [userTurn, user, session, recording]);
  return userTurn;
}
async function ready() {
  const user = await human();
  const session = await newSession(user);
  await setVoiceGate();
  assert.equal(await grant(user), 'GRANTED');
  return { user, session };
}
const openNote = async (user, session, live = randomUUID(), call = randomUUID()) =>
  ({ live, call, outcome: (await one('SELECT * FROM public.server_open_live_voice_note_v1($1, $2, $3, $4, $5)', [user, session, live, call, RT_MODEL])).outcome });
const closeNote = async (user, live, state, ms) => (await one('SELECT * FROM public.server_close_live_voice_note_v1($1, $2, $3, $4)', [user, live, state, ms])).outcome;
const beginUpload = async (user, session) => (await one('SELECT * FROM public.server_begin_voice_note_upload_v1($1, $2, $3, 2048)', [user, session, randomUUID()])).recording_id;
const acceptLive = (user, recording, live, { text = TRANSCRIPT, band = 'HIGH', tokens = [], digest = sha256(text), ms = 4200 } = {}) =>
  one('SELECT * FROM public.server_accept_live_voice_note_v1($1, $2, 2048, $3, $4, $5, $6, $7::text[], $8)', [user, recording, live, ms, text, band, tokens, digest]);
const commit = (user, recording) => one('SELECT * FROM public.server_commit_voice_note_turn_v1($1, $2)', [user, recording]);
const claim = () => server('SELECT * FROM public.server_claim_voice_note_transcription_v1($1, 60, 4)', [W]);
async function claimed(recording) {
  for (let i = 0; i < 100; i += 1) {
    const got = await claim();
    if (got.some((r) => r.recording_id === recording)) return true;
    if (got.length === 0) return false;
  }
  return false;
}
const openReply = async (user, session, source, reply = randomUUID()) =>
  ({ reply, outcome: (await one('SELECT * FROM public.server_open_live_reply_v1($1, $2, $3, $4)', [user, reply, session, source])).outcome });
const admit = async (user, reply, index, call = randomUUID(), chars = 40, lease = 60) =>
  (await one('SELECT * FROM public.server_admit_live_reply_segment_v1($1, $2, $3, $4, $5, $6, $7)', [user, reply, index, call, TTS, chars, lease])).outcome;
const retry = async (user, reply, index, previous, call = randomUUID()) =>
  (await one('SELECT * FROM public.server_retry_live_reply_segment_v1($1, $2, $3, $4, $5, $6, 60)', [user, reply, index, previous, call, TTS])).outcome;
const complete = async (user, call, usage = USAGE, completeness = 'COMPLETE', pcm = PCM) =>
  (await one('SELECT * FROM public.server_complete_live_reply_segment_v1($1, $2, $3, $4, $5::jsonb)', [user, call, pcm, completeness, JSON.stringify(usage)])).outcome;
const fail = async (user, call, outcome, final = false) =>
  (await one('SELECT * FROM public.server_fail_live_reply_segment_v1($1, $2, $3, $4)', [user, call, outcome, final])).outcome;
const finish = async (user, reply, state, count, ms, assistant = null) =>
  (await one('SELECT * FROM public.server_finish_live_reply_v1($1, $2, $3, $4, $5, $6)', [user, reply, state, count, ms, assistant])).outcome;
const readReply = (user, reply) => one('SELECT * FROM public.server_read_live_reply_v1($1, $2)', [user, reply]);
const readSegment = (user, reply, index) => one('SELECT * FROM public.server_read_live_reply_segment_v1($1, $2, $3)', [user, reply, index]);
const sweep = (limit = 100) => one('SELECT * FROM public.server_sweep_fast_voice_v1($1)', [limit]);
const calls = (user) => rows(`SELECT id, call_state, provider, operation, feature_family, source_turn_id, session_id, attempt_number, requested_model,
    (SELECT coalesce(jsonb_object_agg(u.usage_kind, u.quantity), '{}'::jsonb) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id) AS usage
    FROM public.ai_provider_calls c WHERE c.user_id = $1 ORDER BY c.started_at, c.attempt_number`, [user]);
const call = async (user, id) => (await calls(user)).find((c) => c.id === id);
const segmentState = async (user, reply, index) =>
  (await rows('SELECT state FROM voice_private.live_reply_segments WHERE user_id = $1 AND reply_id = $2 AND segment_index = $3', [user, reply, index]))[0]?.state ?? null;

// ------------------------------------------------------------------ P0 catalogue
async function verifyCatalogue(report) {
  await report.section('P0a five relations: postgres-owned, RLS on, no policy, no client grant, cascading account FK, ACCOUNT_CASCADE', async () => {
    for (const relation of RELATIONS) {
      const [p] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
          (SELECT count(*)::int FROM information_schema.role_table_grants g WHERE g.table_schema || '.' || g.table_name = $1
              AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')) AS grants,
          (SELECT coverage FROM account_erasure_private.coverage_registry WHERE relation = $1) AS coverage
          FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(p, { owner: 'postgres', rls: true, policies: 0, grants: 0, coverage: 'ACCOUNT_CASCADE' }, relation);
      const fks = await rows(`SELECT confdeltype FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'`, [relation]);
      assert.ok(fks.length > 0 && fks.every((f) => f.confdeltype === 'c'), `${relation}: every FK cascades`);
    }
    const text = await rows(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'voice_private'
        AND table_name IN ('live_voice_notes', 'live_reply_streams', 'live_reply_segments') AND data_type = 'text' AND column_name NOT IN ('state')`);
    assert.deepEqual(text, [], 'no text column (no words) in the live note or the reply store');
  });
  await report.section('P0b every new definer postgres-owned, pinned search_path, service_role only; internal helpers no client role', async () => {
    for (const fn of [...DEFINERS, ...INTERNAL]) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.equal(p.owner, 'postgres', fn);
      assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
      assert.equal(p.anon || p.auth, false, `${fn}: no client role`);
      assert.equal(p.service, DEFINERS.includes(fn), `${fn}: service_role ${DEFINERS.includes(fn) ? 'only' : 'never'}`);
    }
  });
  await report.section('P0c VOICE_RECORDING_V3 current (K-01 ... K-15, the file text); V1 and V2 historical, byte-identical; the four scopes DISABLED / UNSATISFIED; the census clean', async () => {
    const texts = await rows(`SELECT version, is_current, text_ar_sha256, text_en_sha256, encode(sha256(convert_to(text_ar, 'UTF8')), 'hex') AS ar,
        encode(sha256(convert_to(text_en, 'UTF8')), 'hex') AS en FROM voice_private.consent_texts ORDER BY version`);
    assert.deepEqual(texts.map((t) => [t.version, t.is_current, t.ar, t.en]), [
      ['VOICE_RECORDING_V1', false, V1_AR_SHA256, V1_EN_SHA256], ['VOICE_RECORDING_V2', false, V2_AR_SHA256, V2_EN_SHA256],
      [VOICE_CONSENT_V3, true, VOICE_CONSENT_V3_AR_SHA256, VOICE_CONSENT_V3_EN_SHA256]]);
    assert.ok(texts.every((t) => t.ar === t.text_ar_sha256 && t.en === t.text_en_sha256), 'the recorded digests are the stored words');
    const v3 = await rows('SELECT text_ar, text_en FROM voice_private.consent_texts WHERE version = $1', [VOICE_CONSENT_V3]);
    assert.deepEqual([v3[0].text_ar.split('\n').length, v3[0].text_en.split('\n').length], [15, 15], 'K-01 ... K-15, one row per line');
    const sql = readFileSync(new URL(`./migrations/${MIGRATION_0188}`, import.meta.url), 'utf8');
    assert.deepEqual([sha256(sql.split('$consent_ar$')[1]), sha256(sql.split('$consent_en$')[1])], [VOICE_CONSENT_V3_AR_SHA256, VOICE_CONSENT_V3_EN_SHA256],
      'the file text is the installed text');
    const [served] = await server('SELECT * FROM public.server_read_voice_consent_text_v1()');
    assert.deepEqual([served.consent_version, sha256(served.text_ar)], [VOICE_CONSENT_V3, VOICE_CONSENT_V3_AR_SHA256], 'the served text is V3');
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
    await report.isolated('P1a live note admission: consent to V3, gate, session; a V1 or V2 consent opens nothing (D4)', async () => {
      const user = await human();
      const session = await newSession(user);
      await setVoiceGate();
      assert.equal((await openNote(user, session)).outcome, 'CONSENT_REQUIRED', 'no grant');
      assert.equal(await grant(user), 'GRANTED');
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await openNote(user, session)).outcome, 'NOT_AVAILABLE_NOW', 'gate closed');
      await setVoiceGate();
      await owner();
      await q("UPDATE public.conversation_sessions SET status = 'CLOSED' WHERE id = $1", [session]);
      assert.equal((await openNote(user, session)).outcome, 'SESSION_NOT_ACTIVE');
      const other = await newSession(user);
      assert.equal((await openNote(user, randomUUID())).outcome, 'NOT_FOUND', 'unknown session');
      // A consent held to an earlier version (V2, or V1) is VERSION_NOT_CURRENT: no microphone sample may reach the
      // provider on it (FVP-1). Neither version can be granted any more; consent to V3 opens the note.
      assert.equal(await revoke(user), 'WITHDRAWN');
      for (const version of ['VOICE_RECORDING_V2', 'VOICE_RECORDING_V1']) {
        await owner();
        await q(`INSERT INTO voice_private.recording_consents (id, user_id, purpose, consent_version, grant_command_id, granted_at)
                 VALUES (gen_random_uuid(), $1, 'VOICE_RECORDING', $2, gen_random_uuid(), clock_timestamp())`, [user, version]);
        assert.equal((await one('SELECT * FROM public.server_voice_consent_state_v1($1)', [user])).consent_state, 'VERSION_NOT_CURRENT', version);
        assert.equal((await openNote(user, other)).outcome, 'CONSENT_REQUIRED', `a ${version} consent opens no live note`);
        assert.notEqual(await grant(user, version), 'GRANTED', `${version} cannot be granted`);
        assert.equal(await revoke(user), 'WITHDRAWN');
      }
      assert.equal(await grant(user), 'GRANTED');
      assert.equal((await openNote(user, other)).outcome, 'OPENED', 'V3 grant');
      assert.equal((await calls(user)).length, 1, 'refusals begin no ledger row');
    });

    await report.isolated('P1b one live note per person; replay idempotent; another human NOT_FOUND; ledger settles measured audio or unknown', async () => {
      const { user, session } = await ready();
      const stranger = (await ready()).user;
      const a = await openNote(user, session);
      assert.equal(a.outcome, 'OPENED');
      const ca = await call(user, a.call);
      assert.deepEqual([ca.call_state, ca.provider, ca.operation, ca.feature_family, ca.source_turn_id, ca.requested_model],
        ['PENDING', 'SPEECHMATICS', 'SPEECHMATICS_REALTIME_TRANSCRIPTION', 'VOICE_NOTE_TRANSCRIPTION', null, RT_MODEL]);
      assert.equal((await openNote(user, session, a.live, randomUUID())).outcome, 'OPENED', 'replay');
      assert.equal((await calls(user)).length, 1, 'a replay begins nothing');
      assert.equal((await openNote(stranger, session, a.live)).outcome, 'NOT_FOUND', "another human's live id");
      assert.equal(await closeNote(stranger, a.live, 'FINISHED', 100), 'NOT_FOUND');
      // A second note for the same person replaces an abandoned one: closed, its call settled usage unknown.
      const b = await openNote(user, session);
      assert.equal(b.outcome, 'OPENED');
      assert.equal((await call(user, a.call)).call_state, 'FAILED_USAGE_UNKNOWN', 'abandoned: usage unknown');
      assert.equal(await closeNote(user, a.live, 'FINISHED', 100), 'ALREADY_CLOSED');
      assert.equal(await closeNote(user, b.live, 'FINISHED', 4200), 'CLOSED');
      const cb = await call(user, b.call);
      assert.equal(cb.call_state, 'SUCCEEDED_USAGE_REPORTED');
      assert.deepEqual(cb.usage, { AUDIO_INPUT_MS: 4200 });
      const [m] = await rows('SELECT usage_source FROM public.ai_provider_calls WHERE id = $1', [b.call]);
      assert.equal(m.usage_source, 'GATEWAY_MEASURED', 'never a provider-billed claim');
      const c = await openNote(user, session);
      assert.equal(await closeNote(user, c.live, 'FAILED', null), 'CLOSED');
      assert.equal((await call(user, c.call)).call_state, 'FAILED_USAGE_UNKNOWN', 'unknown is never zero');
      await rejected(() => closeNote(user, c.live, 'OPEN', 1), ['22023']);
    });

    await report.isolated('P2a accept-first: accept v1 + READY live transcript in ONE transaction; the claim never sees it; commit admits it', async () => {
      const { user, session } = await ready();
      const note = await openNote(user, session);
      const recording = await beginUpload(user, session);
      const accepted = await acceptLive(user, recording, note.live, { band: 'MEDIUM', tokens: ['القدر'] });
      assert.deepEqual([accepted.outcome, accepted.transcript_state], ['ACCEPTED', 'READY'], JSON.stringify(accepted));
      const [n] = await rows('SELECT state, transcript_text, asr_confidence_band, uncertain_tokens, duration_ms FROM voice_private.note_transcriptions WHERE recording_id = $1', [recording]);
      assert.deepEqual({ ...n, duration_ms: Number(n.duration_ms) }, { state: 'READY', transcript_text: TRANSCRIPT, asr_confidence_band: 'MEDIUM', uncertain_tokens: ['القدر'], duration_ms: 4200 }, JSON.stringify(n));
      const [p] = await rows('SELECT live_id FROM voice_private.note_live_transcriptions WHERE recording_id = $1', [recording]);
      assert.equal(p.live_id, note.live, 'provenance');
      assert.equal(await claimed(recording), false, 'the batch claim never takes an adopted note');
      const again = await acceptLive(user, recording, note.live);
      assert.deepEqual([again.outcome, again.transcript_state], ['ACCEPTED', 'READY'], 'replay: ' + JSON.stringify(again));
      const c = await commit(user, recording);
      assert.equal(c.outcome, 'COMMITTED', JSON.stringify(c));
      const [t] = await rows(`SELECT t.content, t.status, vs.asr_confidence_band, vs.anchor_end_ms FROM public.conversation_turns t
          JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = t.id WHERE t.id = $1`, [c.turn_id]);
      assert.deepEqual({ ...t, anchor_end_ms: Number(t.anchor_end_ms) }, { content: TRANSCRIPT, status: 'RECEIVED', asr_confidence_band: 'MEDIUM', anchor_end_ms: 4200 }, JSON.stringify(t));
      assert.equal((await rows('SELECT transcript_text FROM voice_private.note_transcriptions WHERE recording_id = $1', [recording]))[0].transcript_text, null,
        'the transcript leaves the note store at commit, as on the batch path');
    });

    await report.isolated('P2b an unqualified, foreign, cancelled or other-session live note leaves the note on the batch path', async () => {
      const { user, session } = await ready();
      const note = await openNote(user, session);
      const r1 = await beginUpload(user, session);
      await rejected(() => acceptLive(user, r1, note.live, { band: 'LOW' }), ['22023'], 'LOW never adopted');
      await rejected(() => acceptLive(user, r1, note.live, { digest: sha256('x') }), ['22023'], 'digest must match');
      await rejected(() => acceptLive(user, r1, note.live, { text: '   ', digest: sha256('   ') }), ['22023']);
      // Another session's live note.
      const otherSession = await newSession(user);
      const r2 = await beginUpload(user, otherSession);
      const a2 = await acceptLive(user, r2, note.live);
      assert.deepEqual([a2.outcome, a2.transcript_state], ['ACCEPTED', null], JSON.stringify(a2));
      assert.equal(await claimed(r2), true, 'other session: batch path');
      // Another human's live note.
      const stranger = await ready();
      const theirs = await openNote(stranger.user, stranger.session);
      const r3 = await beginUpload(user, session);
      assert.equal((await acceptLive(user, r3, theirs.live)).transcript_state, null, 'foreign live note');
      // A cancelled live note.
      assert.equal(await closeNote(user, note.live, 'CANCELLED', null), 'CLOSED');
      const r4 = await beginUpload(user, session);
      assert.equal((await acceptLive(user, r4, note.live)).transcript_state, null, 'cancelled live note');
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.note_live_transcriptions WHERE user_id = $1', [user]))[0].n, 0);
      // Consent withdrawn: acceptance itself refuses, nothing adopted.
      const n2 = await openNote(user, session);
      const r5 = await beginUpload(user, session);
      assert.equal(await revoke(user), 'WITHDRAWN');
      const a5 = await acceptLive(user, r5, n2.live);
      assert.notEqual(a5.transcript_state, 'READY');
    });

    await report.isolated('P3 one automatic reply per voice-note turn; never for a typed turn or another human', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      const a = await openReply(user, session, source);
      assert.equal(a.outcome, 'OPENED');
      assert.equal((await openReply(user, session, source)).outcome, 'REFUSED', 'a second reply for the same turn');
      assert.equal((await openReply(user, session, source, a.reply)).outcome, 'REFUSED', 'the same reply id again');
      const typed = await turn(user, session, { role: 'USER', status: 'GENERATING', content: 'مكتوب' });
      assert.equal((await openReply(user, session, typed)).outcome, 'REFUSED', 'typed turn: text only');
      const stranger = await ready();
      assert.equal((await openReply(stranger.user, session, source)).outcome, 'REFUSED');
      assert.equal((await calls(user)).length, 0, 'opening is costless');
    });

    await report.isolated('P4 one ledger row per attempt bound to the voice-note turn; repeats free; busy bound counts Listen + live', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      const { reply } = await openReply(user, session, source);
      const c0 = randomUUID();
      assert.equal(await admit(user, reply, 0, c0), 'ADMITTED');
      const r0 = await call(user, c0);
      assert.deepEqual([r0.call_state, r0.provider, r0.operation, r0.feature_family, r0.source_turn_id, r0.session_id],
        ['PENDING', 'GEMINI', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', source, session]);
      assert.equal(await admit(user, reply, 0), 'GONE', 'the same segment twice');
      assert.equal(await admit(user, reply, 1), 'ADMITTED');
      assert.equal(await admit(user, reply, 2), 'BUSY', 'at most two synthesizing');
      assert.equal((await calls(user)).length, 2, 'a refusal begins nothing');
      await rejected(() => admit(user, reply, 24), ['22023']);
      await rejected(() => admit(user, reply, 3, randomUUID(), 0), ['22023']);
      // Listen (0187) and live replies share the bound.
      const typedReply = await turn(user, session, { role: 'ASSISTANT', content: 'رد', source: await voiceTurn(user, session, 'COMPLETED') });
      const listen = randomUUID();
      await one('SELECT * FROM public.server_start_reply_listen_v1($1, $2, $3, 2, $4)', [user, typedReply, listen, 'S8B-04-SR-v1']);
      await complete(user, c0);
      const l0 = (await one('SELECT * FROM public.server_admit_reply_speech_synthesis_v1($1, $2, 0, $3, $4, 60)', [user, listen, randomUUID(), TTS])).outcome;
      assert.equal(l0, 'ADMITTED', 'a Listen segment takes the freed slot');
      assert.equal(await admit(user, reply, 2), 'BUSY', 'one live + one Listen = the bound');
      await revoke(user);
      assert.equal(await admit(user, reply, 3), 'GONE', 'consent re-read at every admission');
    });

    await report.isolated('P5 UNKNOWN is final and never re-synthesized; one retry after a known failure (its own row); usage ABSENT is unknown', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      const { reply } = await openReply(user, session, source);
      const u = randomUUID();
      await admit(user, reply, 0, u);
      assert.equal(await fail(user, u, 'UNKNOWN'), 'FAILED');
      assert.equal(await segmentState(user, reply, 0), 'FAILED_UNKNOWN');
      assert.equal((await call(user, u)).call_state, 'FAILED_USAGE_UNKNOWN');
      assert.equal(await retry(user, reply, 0, u), 'GONE', 'never after UNKNOWN');
      assert.equal(await admit(user, reply, 0), 'GONE');
      const k = randomUUID();
      await admit(user, reply, 1, k);
      assert.equal(await retry(user, reply, 1, k), 'GONE', 'not before the failed call settled');
      assert.equal(await fail(user, k, 'FAILED'), 'RETRYABLE');
      const k2 = randomUUID();
      assert.equal(await retry(user, reply, 1, k, k2), 'RETRY_BEGUN');
      assert.equal((await calls(user)).filter((c) => [k, k2].includes(c.id)).length, 2, 'the retry is its own ledger row');
      // The second attempt's failure is final (the service knows the attempts are spent); a further retry is refused anyway.
      assert.equal(await fail(user, k2, 'FAILED', true), 'FAILED');
      assert.equal(await segmentState(user, reply, 1), 'FAILED');
      assert.equal(await retry(user, reply, 1, k2), 'GONE', 'never twice');
      const ab = randomUUID();
      await admit(user, reply, 2, ab);
      assert.equal(await complete(user, ab, {}, 'ABSENT'), 'READY');
      const cab = await call(user, ab);
      assert.notEqual(cab.call_state, 'SUCCEEDED_USAGE_REPORTED');
      assert.deepEqual(cab.usage, {}, 'ABSENT is unknown, never zero');
      assert.equal(await complete(user, ab, {}, 'ABSENT'), 'READY', 'a replayed completion is free');
      await rejected(() => complete(user, randomUUID(), USAGE, 'COMPLETE', Buffer.from([1, 2, 3])), ['22023'], 'odd PCM');
    });

    await report.isolated('P6 finish: contiguous READY prefix, assistant must answer the voice turn; reads re-check gate + consent; late completion', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      const { reply } = await openReply(user, session, source);
      const s0 = randomUUID();
      const s1 = randomUUID();
      await admit(user, reply, 0, s0);
      await admit(user, reply, 1, s1);
      await complete(user, s0);
      const assistant = await turn(user, session, { role: 'ASSISTANT', content: 'رد', source });
      const foreign = await turn(user, session, { role: 'ASSISTANT', content: 'رد', source: await voiceTurn(user, session, 'COMPLETED') });
      await rejected(() => finish(user, reply, 'COMPLETE', 2, 600, assistant), ['22023'], 'segment 1 is not READY');
      await rejected(() => finish(user, reply, 'COMPLETE', 1, 300, foreign), ['42501'], 'another turn\'s answer');
      await rejected(() => finish(user, reply, 'COMPLETE', 1, 300, null), ['22023']);
      assert.equal(await finish(user, reply, 'COMPLETE', 1, 300, assistant), 'FINISHED');
      assert.equal(await finish(user, reply, 'COMPLETE', 1, 300, assistant), 'ALREADY_FINISHED');
      assert.equal(await segmentState(user, reply, 1), 'DISCARDED', 'a running attempt past the length');
      assert.equal(await complete(user, s1), 'GONE', 'late audio is not kept');
      assert.equal(await segmentState(user, reply, 1), null);
      assert.equal((await call(user, s1)).call_state, 'SUCCEEDED_USAGE_REPORTED', 'but stays accounted');
      const status = await readReply(user, reply);
      assert.deepEqual([status.state, status.segment_count, Number(status.audio_ms), status.assistant_turn_id], ['COMPLETE', 1, 300, assistant]);
      assert.equal((await readSegment(user, reply, 0)).outcome, 'READY');
      assert.ok((await readSegment(user, reply, 0)).pcm.equals(PCM));
      const stranger = await ready();
      assert.equal(await readReply(stranger.user, reply), undefined, "another human's reply does not exist for them");
      assert.equal((await readSegment(stranger.user, reply, 0)).outcome, 'NOT_FOUND');
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await readSegment(user, reply, 0)).outcome, 'NOT_AVAILABLE_NOW');
      await setVoiceGate();
      await revoke(user);
      assert.equal((await readSegment(user, reply, 0)).outcome, 'CONSENT_REQUIRED', 'a withdrawal stops stored playback too');
      await owner();
      await q("UPDATE voice_private.live_reply_streams SET created_at = clock_timestamp() - interval '16 minutes', expires_at = clock_timestamp() - interval '1 minute' WHERE reply_id = $1", [reply]);
      assert.equal(await readReply(user, reply), undefined, 'expired: nothing');
      assert.equal(await calls(user).then((c) => c.length), 2, 'GET-only reads never touch the ledger');
    });

    await report.isolated('P7 withheld tail: part stored, delivery recorded, NO outbox event, SELECTED question RELEASED; typed turn refused', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      // A SELECTED reservation, seeded with FK checks off for this one insert (the proof needs only the row's state).
      const binding = randomUUID();
      await owner();
      // (PostgreSQL re-checks the FKs of a row inserted in the same transaction when the 0063 trigger updates it, so the
      // three ownership FKs are dropped inside this rolled-back savepoint instead.)
      for (const fk of ['formal_question_binding_gap_owner_fk', 'formal_question_binding_automatic_source_fk', 'formal_question_binding_hypothesis_owner_fk']) {
        await q(`ALTER TABLE public.formal_question_turn_bindings DROP CONSTRAINT ${fk}`);
      }
      await q(`INSERT INTO public.formal_question_turn_bindings (id, user_id, session_id, source_turn_id, information_gap_id, gap_open_epoch,
                 hypothesis_id, hypothesis_version, missing_information_code, question_type) VALUES ($1, $2, $3, $4, gen_random_uuid(), 1,
                 gen_random_uuid(), 1, 'NO_ELIGIBLE_EVIDENCE', 'FACT_FINDING')`, [binding, user, session, source]);
      const before = (await rows('SELECT count(*)::int AS n FROM public.runtime_event_outbox'))[0].n;
      const assistant = randomUUID();
      const [r] = await server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, $5, 'ALLOW', 'TRUNCATED')`,
        [session, user, source, assistant, 'طبخت الأرز.']);
      assert.equal(r.assistant_turn.status, 'COMPLETED');
      assert.equal(r.user_turn.status, 'COMPLETED');
      assert.equal(r.assistant_turn.content, 'طبخت الأرز.');
      assert.equal((await rows('SELECT count(*)::int AS n FROM public.runtime_event_outbox'))[0].n, before, 'no ConversationTurnCompleted: no Memory');
      const [d] = await rows('SELECT delivery, reason, source_turn_id FROM voice_private.voice_note_reply_deliveries WHERE assistant_turn_id = $1', [assistant]);
      assert.deepEqual(d, { delivery: 'WITHHELD_TAIL', reason: 'TRUNCATED', source_turn_id: source });
      assert.equal((await rows('SELECT state FROM public.formal_question_turn_bindings WHERE id = $1', [binding]))[0].state, 'RELEASED', 'never BOUND to a cut reply');
      const replay = await server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, 'x', 'ALLOW', 'TRUNCATED')`, [session, user, source, randomUUID()]);
      assert.deepEqual(replay, [], 'a turn no longer GENERATING writes nothing');
      const typed = await turn(user, session, { role: 'USER', status: 'GENERATING', content: 'مكتوب' });
      await rejected(() => server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, 'x', 'ALLOW', 'TRUNCATED')`,
        [session, user, typed, randomUUID()]), ['42501'], 'a typed turn never takes this path');
      const stranger = await ready();
      await rejected(() => server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, 'x', 'ALLOW', 'TRUNCATED')`,
        [session, stranger.user, source, randomUUID()]), ['42501']);
      await rejected(() => server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, 'x', 'BLOCK', 'TRUNCATED')`,
        [session, user, source, randomUUID()]), ['22023']);
    });

    await report.isolated('P8 sweep: expired leases FAILED_UNKNOWN + usage unknown, expired replies deleted, abandoned live notes settled', async () => {
      const { user, session } = await ready();
      const source = await voiceTurn(user, session);
      const { reply } = await openReply(user, session, source);
      const crashed = randomUUID();
      await admit(user, reply, 0, crashed, 40, 5);
      await owner();
      await q("UPDATE voice_private.live_reply_segments SET lease_until = clock_timestamp() - interval '1 second' WHERE call_id = $1", [crashed]);
      const note = await openNote(user, session);
      await owner();
      await q("UPDATE voice_private.live_voice_notes SET opened_at = clock_timestamp() - interval '13 minutes' WHERE live_id = $1", [note.live]);
      const s1 = await sweep();
      assert.deepEqual([s1.leases_expired, s1.live_notes_closed], [1, 1]);
      assert.equal(await segmentState(user, reply, 0), 'FAILED_UNKNOWN');
      assert.equal((await call(user, crashed)).call_state, 'FAILED_USAGE_UNKNOWN');
      await rejected(() => complete(user, crashed), ['PT409'], 'a late completion after the crash is refused (as 0187), no audio kept');
      assert.equal(await admit(user, reply, 0), 'GONE', 'never re-synthesized');
      assert.equal((await call(user, note.call)).call_state, 'FAILED_USAGE_UNKNOWN');
      await owner();
      await q("UPDATE voice_private.live_reply_streams SET created_at = clock_timestamp() - interval '16 minutes', expires_at = clock_timestamp() - interval '1 minute' WHERE reply_id = $1", [reply]);
      assert.equal((await sweep()).replies_deleted, 1);
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.live_reply_segments WHERE reply_id = $1', [reply]))[0].n, 0);
    });

    await report.isolated('P9 account erasure removes every new row', async () => {
      const { user, session } = await ready();
      const note = await openNote(user, session);
      const recording = await beginUpload(user, session);
      await acceptLive(user, recording, note.live);
      const source = await voiceTurn(user, session);
      const { reply } = await openReply(user, session, source);
      const c = randomUUID();
      await admit(user, reply, 0, c);
      await complete(user, c);
      const other = await voiceTurn(user, session);
      await server(`SELECT * FROM public.server_finalize_voice_note_withheld_tail_v1($1, $2, $3, $4, 'جزء', 'ALLOW', 'PROVIDER_FAILED')`, [session, user, other, randomUUID()]);
      await owner();
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
      const [{ outcome }] = await server('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]);
      assert.equal(outcome, 'ERASED');
      for (const relation of RELATIONS) {
        const [{ n }] = await rows(`SELECT count(*)::int AS n FROM ${relation} WHERE user_id = $1`, [user]);
        assert.equal(n, 0, relation);
      }
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ races (committed fixtures, removed afterwards)
async function verifyRaces(report) {
  const { q2, close } = await rt.openSecondary();
  const sr = async (client, sql, values) => {
    await client('BEGIN');
    await client('SET LOCAL ROLE service_role');
    return client(sql, values);
  };
  const P = randomUUID();
  await owner();
  const [gate] = await rows("SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = 'PERSONAL_VOICE_NOTE'");
  try {
    await rt.provisionHumans([P]);
    await owner();
    await setVoiceGate();
    assert.equal(await grant(P), 'GRANTED');
    const session = await newSession(P);
    const source = await voiceTurn(P, session);

    await report.section('PRC-1 two connections open the reply of the same turn: one OPENED, one REFUSED', async () => {
      const a = (await sr(q, 'SELECT * FROM public.server_open_live_reply_v1($1, $2, $3, $4)', [P, randomUUID(), session, source])).rows[0];
      const b = sr(q2, 'SELECT * FROM public.server_open_live_reply_v1($1, $2, $3, $4)', [P, randomUUID(), session, source]);
      assert.equal(await rt.stillPending(b), true, 'the second waits on the per-person lock');
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['OPENED', 'REFUSED']);
    });

    await report.section('PRC-2 two connections admit the same segment: one ADMITTED, one ledger row', async () => {
      const [{ reply_id: reply }] = await rows('SELECT reply_id FROM voice_private.live_reply_streams WHERE source_turn_id = $1', [source]);
      const sql = 'SELECT * FROM public.server_admit_live_reply_segment_v1($1, $2, 0, $3, $4, 40, 60)';
      const a = (await sr(q, sql, [P, reply, randomUUID(), TTS])).rows[0];
      const b = sr(q2, sql, [P, reply, randomUUID(), TTS]);
      assert.equal(await rt.stillPending(b), true);
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.deepEqual([a.outcome, r.outcome], ['ADMITTED', 'GONE']);
      const [{ n }] = await rows("SELECT count(*)::int AS n FROM public.ai_provider_calls WHERE user_id = $1 AND provider = 'GEMINI'", [P]);
      assert.equal(n, 1);
    });

    await report.section('PRC-3 accept-live vs the batch claim: the note is either READY (live) or claimed (batch), never both', async () => {
      const note = await openNote(P, session);
      const recording = await beginUpload(P, session);
      const accepting = (await sr(q, 'SELECT * FROM public.server_accept_live_voice_note_v1($1, $2, 2048, $3, 4200, $4, \'HIGH\', \'{}\'::text[], $5)',
        [P, recording, note.live, TRANSCRIPT, sha256(TRANSCRIPT)])).rows[0];
      // The claim runs while the acceptance is uncommitted: it cannot see the note STORED yet, or waits on its row.
      const claiming = sr(q2, 'SELECT * FROM public.server_claim_voice_note_transcription_v1($1, 60, 4)', [W]);
      const pending = await rt.stillPending(claiming);
      await q('COMMIT');
      await owner();
      const got = (await claiming).rows;
      await q2('COMMIT');
      assert.equal(accepting.transcript_state, 'READY');
      assert.equal(got.some((r) => r.recording_id === recording), false, `the claim never takes it (claim waited: ${pending})`);
      const later = await server('SELECT * FROM public.server_claim_voice_note_transcription_v1($1, 60, 4)', [W]);
      assert.equal(later.some((r) => r.recording_id === recording), false, 'nor afterwards');
      const [n] = await rows('SELECT state FROM voice_private.note_transcriptions WHERE recording_id = $1', [recording]);
      assert.equal(n.state, 'READY');
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await close();
    await removeRaceFixtures([P], gate);
  }
}

// The PRC fixtures are committed, and in CI the next steps (prove-0185 first) share this database: the gate goes back to
// the state it had and every row of the fixture human goes, so the run leaves nothing behind.
async function removeRaceFixtures(humans, gate) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.live_reply_segments WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.live_reply_streams WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.note_live_transcriptions WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.live_voice_notes WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.note_transcriptions WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.ai_provider_call_usage WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM public.ai_cost_ratings WHERE provider_call_id IN (SELECT id FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.conversation_turn_voice_sources WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_objects WHERE recording_id IN (SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.recording_consents WHERE user_id = ANY($1::uuid[])', [humans]);
    if (gate) {
      await q(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
                 restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await q('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2', [gate.capability_scope, gate.restriction_version]);
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

runVerifier('0188', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0188', { query: q, restore: () => owner() });
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('races');
  await verifyRaces(report);
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
