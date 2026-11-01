// Real-PostgreSQL verifier for migration 0187 (S8B-04 CP1, QANDEEL's Voice: server and intelligence).
//
// The acceptance of the S8B-04 contract v1.2 that a database can prove:
//
//   C0    catalogue: both relations postgres-owned, RLS on, no policy, no grant, no text column in the Listen store, both
//         FKs ON DELETE CASCADE; every new function postgres-owned and pinned, the server_* definers service_role only,
//         the internal ones no role's; VOICE_RECORDING_V2 current with its digests, V1 historical and unchanged; the four
//         scopes DISABLED; the erasure census clean, both relations ACCOUNT_CASCADE
//   V-H   the speech channel of a voice-note reply: recorded once, never for a typed reply or another user, validated
//   V-L   Listen eligibility (AC-13): gate, consent V2 (a V1 grant is VERSION_NOT_CURRENT, AC-14), owner, voice-note reply
//   V-S   start: costless, idempotent, conflicts, one active listen per user (replacement)
//   V-A   admission (§8.3): one ledger row per attempt in the same transaction as the segment; repeats free; the per-user
//         bound; gate and consent re-read
//   V-C   completion: audio + settlement in one transaction; usage ABSENT is unknown, never zero; replays free; GET-only
//         reads never touch the ledger
//   V-R   the one pre-audio retry: its own ledger row, only after the failed call settled, never twice
//   V-K   a crash: the expired lease settles FAILED_USAGE_UNKNOWN, the segment is FAILED_UNKNOWN, never re-synthesized; a
//         late completion is refused
//   V-X   cancel, TTL, stale calls and account erasure remove everything; nothing is written to the recordings or the
//         object store
//   V-RC  two connections admitting the same segment: one admission, one ledger row (committed fixtures removed after)
//
// Every scenario but V-RC runs in one transaction that is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole } = rt;
async function rejected(operation, codes, message = null) {
  const where = (new Error().stack.split('\n')[2] ?? '').trim().replace(/^at .*verify-migration-0187\.mjs:/u, 'line ');
  return rt.rejected(operation, codes, message).then(undefined, (error) => {
    error.message = `${error.message} [${where}]`;
    throw error;
  });
}
const owner = () => asRole('postgres');
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const migration = (prefix) => readFileSync(new URL(readdirSync(MIGRATIONS).find((f) => f.startsWith(prefix)), MIGRATIONS), 'utf8');
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const V1_AR_SHA256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d';
const V1_EN_SHA256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426';
const V2_AR_SHA256 = '84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740';
const V2_EN_SHA256 = 'c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce';
const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION', 'SHARED_VOICE_NOTE'];
const RELATIONS = ['voice_private.reply_speech_hints', 'voice_private.reply_speech_segments'];
const DEFINERS = [
  'public.server_record_reply_speech_channel_v1(uuid,uuid,text,jsonb)',
  'public.server_read_reply_for_listen_v1(uuid,uuid)',
  'public.server_start_reply_listen_v1(uuid,uuid,uuid,integer,text)',
  'public.server_admit_reply_speech_synthesis_v1(uuid,uuid,integer,uuid,text,integer)',
  'public.server_retry_reply_speech_synthesis_v1(uuid,uuid,integer,uuid,uuid,text,integer)',
  'public.server_complete_reply_speech_synthesis_v1(uuid,uuid,bytea,text,jsonb)',
  'public.server_fail_reply_speech_synthesis_v1(uuid,uuid,text,text,jsonb,boolean)',
  'public.server_read_reply_speech_audio_v1(uuid,uuid,integer)',
  'public.server_cancel_reply_listen_v1(uuid,uuid)',
  'public.server_sweep_reply_speech_v1(integer)',
];
const INTERNAL = [
  'voice_private.reply_listen_policy_v1()', 'voice_private.reply_speech_hints_valid_v1(jsonb)',
  'voice_private.voice_reply_eligibility_v1(uuid,uuid)', 'voice_private.lock_reply_listen_v1(uuid)',
  'voice_private.begin_reply_speech_call_v1(uuid,uuid,uuid,uuid,text)', 'voice_private.settle_reply_speech_call_unknown_v1(uuid)',
];
const CENSUS = `SELECT c.conrelid::regclass::text AS relation FROM pg_constraint c
  WHERE c.contype = 'f'
    AND (c.confrelid = 'public.users'::regclass
         OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
    AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)
  ORDER BY 1`;
const MODEL = 'gemini-3.8-flash-tts';
const REPLY = 'طبخت الأرز في القدر الكبير. وبعدين أكلنا سوا.';
const VERSION = 'S8B-04-SR-v1';
const USAGE = { INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900 };
// A minimal valid WAV: a 44-byte header and four PCM bytes.
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(40), Buffer.from([1, 2, 3, 4])]);

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
  await rows(`SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_VOICE_NOTE', $1, $2, 'verify-0187', 'real-PostgreSQL proof')`,
    [flag, requirements]);
}
const grant = async (user, version = 'VOICE_RECORDING_V2') =>
  (await one('SELECT * FROM public.server_grant_voice_recording_consent_v1($1, $2, $3)', [user, randomUUID(), version])).outcome;
const revoke = async (user) => (await one('SELECT * FROM public.server_revoke_voice_recording_consent_v1($1, $2)', [user, randomUUID()])).outcome;
const consentState = async (user) => (await one('SELECT * FROM public.server_voice_consent_state_v1($1)', [user])).consent_state;

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
/** A completed exchange: a user turn (voice-note sourced when `voice`) and the assistant reply to it. */
async function exchange(user, session, { voice = true, reply = REPLY, replyStatus = 'COMPLETED' } = {}) {
  const userTurn = await turn(user, session, { role: 'USER', content: 'سؤال' });
  if (voice) {
    const recording = await storedNote(user, session);
    await q(`INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality, transcript_origin,
               asr_confidence_band, recording_id, anchor_start_ms, anchor_end_ms) VALUES ($1, $2, $3, 'USER', 'VOICE_NOTE', 'MACHINE_ASR', 'HIGH', $4, 0, 4200)`,
    [userTurn, user, session, recording]);
  }
  const replyTurn = await turn(user, session, { role: 'ASSISTANT', status: replyStatus, content: reply, source: userTurn });
  return { userTurn, reply: replyTurn };
}
/** A human with a session, the gate open, consent V2 current and a voice-note exchange (inside the rolled-back transaction). */
async function ready() {
  const user = await human();
  const session = await newSession(user);
  await setVoiceGate();
  assert.equal(await grant(user), 'GRANTED');
  const { userTurn, reply } = await exchange(user, session);
  return { user, session, userTurn, reply };
}
const readForListen = (user, reply) => one('SELECT * FROM public.server_read_reply_for_listen_v1($1, $2)', [user, reply]);
const start = (user, reply, listen, count = 3, version = VERSION) =>
  one('SELECT * FROM public.server_start_reply_listen_v1($1, $2, $3, $4, $5)', [user, reply, listen, count, version]);
const admit = (user, listen, index, call = randomUUID(), lease = 60) =>
  one('SELECT * FROM public.server_admit_reply_speech_synthesis_v1($1, $2, $3, $4, $5, $6)', [user, listen, index, call, MODEL, lease]);
const complete = (user, call, usage = USAGE, completeness = 'COMPLETE', audio = WAV) =>
  one('SELECT * FROM public.server_complete_reply_speech_synthesis_v1($1, $2, $3, $4, $5::jsonb)', [user, call, audio, completeness, JSON.stringify(usage)]);
const fail = (user, call, final, outcome = 'FAILED') =>
  one(`SELECT * FROM public.server_fail_reply_speech_synthesis_v1($1, $2, $3, 'ABSENT', '{}'::jsonb, $4)`, [user, call, outcome, final]);
const retry = (user, listen, index, failed, call = randomUUID()) =>
  one('SELECT * FROM public.server_retry_reply_speech_synthesis_v1($1, $2, $3, $4, $5, $6, 60)', [user, listen, index, failed, call, MODEL]);
const readAudio = (user, listen, index) => one('SELECT * FROM public.server_read_reply_speech_audio_v1($1, $2, $3)', [user, listen, index]);
const cancel = (user, listen) => one('SELECT * FROM public.server_cancel_reply_listen_v1($1, $2)', [user, listen]);
const sweep = (limit = 100) => one('SELECT * FROM public.server_sweep_reply_speech_v1($1)', [limit]);
const segment = async (user, listen, index) =>
  (await rows('SELECT state, call_id, attempts, audio IS NOT NULL AS has_audio FROM voice_private.reply_speech_segments WHERE user_id = $1 AND listen_id = $2 AND segment_index = $3', [user, listen, index]))[0];
const calls = (user) => rows(`SELECT id, call_state, provider, operation, feature_family, source_turn_id, session_id, attempt_number, requested_model,
    processing_path, (SELECT coalesce(jsonb_object_agg(u.usage_kind, u.quantity), '{}'::jsonb) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id) AS usage
    FROM public.ai_provider_calls c WHERE c.user_id = $1 ORDER BY c.started_at, c.attempt_number`, [user]);

// ------------------------------------------------------------------ catalogue
async function verifyCatalogue(report) {
  await report.section('C0a the two relations: postgres-owned, RLS on, no policy, no grant, no text column, cascading FKs', async () => {
    for (const relation of RELATIONS) {
      const [posture] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname || '.' || p.tablename = $1) AS policies FROM pg_class c WHERE c.oid = $1::regclass`, [relation]);
      assert.deepEqual(posture, { owner: 'postgres', rls: true, policies: 0 }, `C0a ${relation}`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, relation, privilege]);
          assert.equal(allowed, false, `C0a ${role} has no ${privilege} on ${relation}`);
        }
      }
      const fks = await rows(`SELECT confrelid::regclass::text AS target, confdeltype FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f' ORDER BY 1`, [relation]);
      assert.deepEqual(fks, [{ target: 'conversation_turns', confdeltype: 'c' }, { target: 'users', confdeltype: 'c' }], `C0a ${relation} cascades`);
    }
    const columns = (await rows(`SELECT attname FROM pg_attribute WHERE attrelid = 'voice_private.reply_speech_segments'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum`)).map((r) => r.attname);
    assert.deepEqual(columns, ['user_id', 'listen_id', 'segment_index', 'assistant_turn_id', 'session_id', 'segment_count', 'renderer_version',
      'state', 'call_id', 'attempts', 'audio', 'lease_until', 'created_at', 'expires_at', 'updated_at'], 'C0a the Listen store holds no text (NO-PERSIST)');
    const textual = await rows(`SELECT attname FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
        WHERE attrelid = 'voice_private.reply_speech_segments'::regclass AND attnum > 0 AND t.typname IN ('text', 'varchar', 'jsonb')
          AND attname NOT IN ('state', 'renderer_version')`);
    assert.deepEqual(textual, [], 'C0a no free-text column');
  });

  await report.section('C0b every new function: postgres-owned, pinned; the definers service_role only; internal functions no role', async () => {
    for (const sig of [...DEFINERS, ...INTERNAL]) {
      const [f] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config,
          EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS to_public
          FROM pg_proc p WHERE p.oid = $1::regprocedure`, [sig]);
      assert.equal(f.owner, 'postgres', `C0b ${sig} owner`);
      assert.deepEqual(f.config, ['search_path=""'], `C0b ${sig} pinned`);
      assert.equal(f.to_public, false, `C0b ${sig} not PUBLIC`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS allowed', [role, sig]);
        assert.equal(allowed, role === 'service_role' && DEFINERS.includes(sig), `C0b ${role} on ${sig}`);
      }
    }
    for (const [sig, volatility] of [['voice_private.reply_listen_policy_v1()', 'i'], ['voice_private.reply_speech_hints_valid_v1(jsonb)', 'i']]) {
      const [{ provolatile }] = await rows('SELECT provolatile FROM pg_proc WHERE oid = $1::regprocedure', [sig]);
      assert.equal(provolatile, volatility, `C0b ${sig} IMMUTABLE`);
    }
  });

  await report.section('C0c VOICE_RECORDING_V2 current (K-01 ... K-15, both digests); VOICE_RECORDING_V1 historical and unchanged', async () => {
    const texts = await rows('SELECT version, is_current, text_ar, text_en, text_ar_sha256, text_en_sha256 FROM voice_private.consent_texts ORDER BY version');
    assert.equal(texts.length, 2, 'C0c exactly two texts');
    assert.deepEqual(texts.map((t) => [t.version, t.is_current]), [['VOICE_RECORDING_V1', false], ['VOICE_RECORDING_V2', true]]);
    assert.deepEqual([texts[0].text_ar_sha256, texts[0].text_en_sha256], [V1_AR_SHA256, V1_EN_SHA256], 'C0c V1 unchanged');
    assert.deepEqual([texts[1].text_ar_sha256, texts[1].text_en_sha256], [V2_AR_SHA256, V2_EN_SHA256], 'C0c V2 digests');
    assert.equal(texts[1].text_ar.split('\n').length, 15, 'C0c V2 Arabic: K-01 ... K-15, one row per line');
    assert.equal(texts[1].text_en.split('\n').length, 15, 'C0c V2 English: K-01 ... K-15, one row per line');
    const sql = migration('0187');
    assert.equal(sha256(sql.split('$consent_ar$')[1]), V2_AR_SHA256, 'C0c the file text is the installed text');
    assert.equal(sha256(sql.split('$consent_en$')[1]), V2_EN_SHA256, 'C0c the file text is the installed text');
    const [{ text_ar: served }] = await server('SELECT * FROM public.server_read_voice_consent_text_v1()');
    assert.equal(sha256(served), V2_AR_SHA256, 'C0c the served consent text is V2');
  });

  await report.section('C0d four scopes DISABLED; erasure census clean; both relations ACCOUNT_CASCADE', async () => {
    const states = await rows('SELECT capability_scope, feature_flag_state, launch_requirements_state FROM voice_private.voice_launch_capability_states ORDER BY 1');
    assert.deepEqual(states.map((s) => s.capability_scope), SCOPES);
    assert.ok(states.every((s) => s.feature_flag_state === 'DISABLED' && s.launch_requirements_state === 'UNSATISFIED'), 'C0d closed');
    assert.deepEqual(await rows(CENSUS), [], 'C0d census');
    const coverage = await rows('SELECT relation, coverage FROM account_erasure_private.coverage_registry WHERE relation = ANY($1::text[]) ORDER BY 1', [RELATIONS]);
    assert.deepEqual(coverage, RELATIONS.map((relation) => ({ relation, coverage: 'ACCOUNT_CASCADE' })));
  });
}

// ------------------------------------------------------------------ behaviour
async function verifyBehaviour(report) {
  await q('BEGIN');
  try {
    await report.isolated('V-H the speech channel: once per voice-note reply, never for a typed reply or another user, validated', async () => {
      const { user, session, reply } = await ready();
      const record = (u, r, e = 'PLAYFUL', h = [{ offset: 14, word: 'القِدْر' }]) =>
        one('SELECT * FROM public.server_record_reply_speech_channel_v1($1, $2, $3, $4::jsonb)', [u, r, e, JSON.stringify(h)]);
      assert.equal((await record(user, reply)).outcome, 'RECORDED');
      assert.equal((await record(user, reply, 'CALM', [])).outcome, 'ALREADY_RECORDED');
      const [kept] = await rows('SELECT expression, hints FROM voice_private.reply_speech_hints WHERE assistant_turn_id = $1', [reply]);
      assert.deepEqual(kept, { expression: 'PLAYFUL', hints: [{ offset: 14, word: 'القِدْر' }] }, 'V-H the first record stands');
      const typed = await exchange(user, session, { voice: false });
      assert.equal((await record(user, typed.reply)).outcome, 'NOT_VOICE_REPLY');
      const other = await human();
      assert.equal((await record(other, reply)).outcome, 'NOT_VOICE_REPLY');
      const fresh = await exchange(user, session);
      await rejected(() => record(user, fresh.reply, 'ANGRY'), ['22023']);
      await rejected(() => record(user, fresh.reply, 'CALM', [{ offset: 1, word: 'قدر' }]), ['22023']);
      await rejected(() => record(user, fresh.reply, 'CALM', [{ offset: 1, word: 'qidr' }]), ['22023']);
      await rejected(() => record(user, fresh.reply, 'CALM', Array.from({ length: 5 }, () => ({ offset: 1, word: 'القِدْر' }))), ['22023']);
      await rejected(() => record(user, fresh.reply, 'CALM', [{ offset: 999, word: 'القِدْر' }]), ['22023']);
      await rejected(() => record(user, fresh.reply, 'CALM', [{ offset: 1, word: 'القِدْر', spoken: 'x' }]), ['22023']);
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.reply_speech_hints WHERE user_id = $1', [user]))[0].n, 1);
    });

    await report.isolated('V-L Listen eligibility (AC-13 / AC-14): gate, consent V2, owner, voice-note reply, completed', async () => {
      const user = await human();
      const session = await newSession(user);
      const { userTurn, reply } = await exchange(user, session);
      assert.equal((await readForListen(user, reply)).outcome, 'NOT_AVAILABLE_NOW', 'V-L gate closed');
      await setVoiceGate();
      assert.equal((await readForListen(user, reply)).outcome, 'CONSENT_REQUIRED', 'V-L no consent');
      // A V1 grant is VERSION_NOT_CURRENT once V2 is installed; V1 can no longer be granted.
      await owner();
      await q(`INSERT INTO voice_private.recording_consents (id, user_id, purpose, consent_version, grant_command_id, granted_at)
               VALUES (gen_random_uuid(), $1, 'VOICE_RECORDING', 'VOICE_RECORDING_V1', gen_random_uuid(), clock_timestamp())`, [user]);
      assert.equal(await consentState(user), 'VERSION_NOT_CURRENT', 'V-L a V1 grant is not current');
      assert.equal((await readForListen(user, reply)).outcome, 'CONSENT_REQUIRED', 'V-L V1 does not open Listen');
      assert.equal((await start(user, reply, randomUUID())).outcome, 'CONSENT_REQUIRED');
      await revoke(user);
      assert.notEqual(await grant(user, 'VOICE_RECORDING_V1'), 'GRANTED', 'V-L V1 cannot be granted');
      assert.equal(await grant(user), 'GRANTED');
      const ok = await readForListen(user, reply);
      assert.deepEqual(ok, { outcome: 'ELIGIBLE', content: REPLY, expression: 'CALM', hints: [] }, 'V-L eligible, CALM without a channel');
      const other = await human();
      assert.equal((await readForListen(other, reply)).outcome, 'NOT_FOUND', 'V-L another user\'s reply');
      assert.equal((await readForListen(user, userTurn)).outcome, 'NOT_FOUND', 'V-L a user turn');
      assert.equal((await readForListen(user, randomUUID())).outcome, 'NOT_FOUND', 'V-L no turn');
      const typed = await exchange(user, session, { voice: false });
      assert.equal((await readForListen(user, typed.reply)).outcome, 'NOT_VOICE_REPLY', 'V-L a typed reply');
      const generating = await exchange(user, session, { replyStatus: 'GENERATING' });
      assert.equal((await readForListen(user, generating.reply)).outcome, 'NOT_FOUND', 'V-L an unfinished reply');
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await readForListen(user, reply)).outcome, 'NOT_AVAILABLE_NOW');
    });

    await report.isolated('V-S start: costless, idempotent, conflicts, one active listen per user', async () => {
      const { user, session, reply } = await ready();
      const listen = randomUUID();
      const first = await start(user, reply, listen, 3);
      assert.equal(first.outcome, 'STARTED');
      assert.equal(first.segment_count, 3);
      const again = await start(user, reply, listen, 3);
      assert.deepEqual({ ...again, expires_at: String(again.expires_at) }, { outcome: 'ALREADY_STARTED', segment_count: 3, expires_at: String(first.expires_at) });
      assert.equal((await start(user, reply, listen, 4)).outcome, 'LISTEN_CONFLICT');
      assert.equal((await start(user, reply, listen, 3, 'S8B-04-SR-v2')).outcome, 'LISTEN_CONFLICT');
      const states = await rows('SELECT state FROM voice_private.reply_speech_segments WHERE user_id = $1 AND listen_id = $2 ORDER BY segment_index', [user, listen]);
      assert.deepEqual(states.map((s) => s.state), ['PENDING', 'PENDING', 'PENDING']);
      assert.equal((await calls(user)).length, 0, 'V-S no ledger row before an admission');
      const [{ ttl }] = await rows("SELECT (expires_at - created_at) = interval '15 minutes' AS ttl FROM voice_private.reply_speech_segments WHERE listen_id = $1 LIMIT 1", [listen]);
      assert.equal(ttl, true, 'V-S 15 minutes');
      // A second listen replaces the first: a synthesizing segment is DISCARDED, the rest deleted.
      const call = randomUUID();
      assert.equal((await admit(user, listen, 0, call)).outcome, 'ADMITTED');
      const other = await exchange(user, session);
      const second = randomUUID();
      assert.equal((await start(user, other.reply, second, 1)).outcome, 'STARTED');
      const left = await rows('SELECT listen_id, segment_index, state FROM voice_private.reply_speech_segments WHERE user_id = $1 ORDER BY listen_id = $2, segment_index', [user, second]);
      assert.deepEqual(left.map((r) => [r.listen_id === second, r.state]), [[false, 'DISCARDED'], [true, 'PENDING']]);
      await rejected(() => start(user, reply, randomUUID(), 17), ['22023']);
      await rejected(() => start(user, reply, randomUUID(), 0), ['22023']);
    });

    await report.isolated('V-A admission: one ledger row with the segment, repeats free, the per-user bound, gate and consent re-read', async () => {
      const { user, session, reply } = await ready();
      await one(`SELECT * FROM public.server_record_reply_speech_channel_v1($1, $2, 'EMPATHY', '[{"offset":14,"word":"القِدْر"}]'::jsonb)`, [user, reply]);
      const listen = randomUUID();
      await start(user, reply, listen, 3);
      const call = randomUUID();
      const a = await admit(user, listen, 0, call);
      assert.deepEqual(a, { outcome: 'ADMITTED', call_id: call, assistant_turn_id: reply, segment_count: 3, renderer_version: VERSION,
        content: REPLY, expression: 'EMPATHY', hints: [{ offset: 14, word: 'القِدْر' }] });
      const [row] = await calls(user);
      assert.deepEqual({ ...row, usage: undefined }, { id: call, call_state: 'PENDING', provider: 'GEMINI', operation: 'GEMINI_SPEECH_GENERATION',
        feature_family: 'SPEECH_SYNTHESIS', source_turn_id: reply, session_id: session, attempt_number: 1, requested_model: MODEL,
        processing_path: null, usage: undefined });
      assert.deepEqual(await segment(user, listen, 0), { state: 'SYNTHESIZING', call_id: call, attempts: 1, has_audio: false });
      // Repeats (a double press, a lost response, a new call id) never admit again and never write a ledger row.
      for (const again of [call, randomUUID(), randomUUID()]) {
        const r = await admit(user, listen, 0, again);
        assert.equal(r.outcome, 'IN_PROGRESS');
        assert.equal(r.call_id, call);
        assert.equal(r.content, null, 'V-A a repeat carries no text');
      }
      assert.equal((await calls(user)).length, 1, 'V-A one ledger row');
      assert.equal((await admit(user, listen, 1)).outcome, 'ADMITTED');
      assert.equal((await admit(user, listen, 2)).outcome, 'BUSY', 'V-A at most two synthesizing per user');
      assert.equal((await calls(user)).length, 2);
      assert.equal((await admit(user, randomUUID(), 0)).outcome, 'NOT_FOUND');
      assert.equal((await admit(await human(), listen, 0)).outcome, 'NOT_FOUND', 'V-A another user');
      await complete(user, call);
      // V-A identity: a provider call id already in the ledger is the one AI-usage identity conflict (PT409 with the exact
      // reason; the one 0187 site verify-migration-0150's PT409 census admits). It writes no cost row and admits nothing.
      const ledger = async () => (await rows('SELECT (SELECT count(*) FROM public.ai_provider_calls) + (SELECT count(*) FROM public.ai_provider_call_usage) AS n'))[0].n;
      const ledgerBefore = await ledger();
      const pending = await segment(user, listen, 2);
      await rejected(() => admit(user, listen, 2, call), ['PT409'], /^AI_PROVIDER_CALL_IDENTITY_CONFLICT$/u);
      assert.equal(await ledger(), ledgerBefore, 'V-A the identity conflict writes no cost row');
      assert.deepEqual(await segment(user, listen, 2), pending, 'V-A the identity conflict admits nothing');
      assert.equal(pending.state, 'PENDING');
      await setVoiceGate('DISABLED', 'UNSATISFIED');
      assert.equal((await admit(user, listen, 2)).outcome, 'NOT_AVAILABLE_NOW', 'V-A the gate is re-read');
      await setVoiceGate();
      await revoke(user);
      assert.equal((await admit(user, listen, 2)).outcome, 'CONSENT_REQUIRED', 'V-A consent is re-read');
      await rejected(() => admit(user, listen, 2, randomUUID(), 121), ['22023']);
    });

    await report.isolated('V-C completion: audio and settlement together; ABSENT is unknown, never zero; replays and reads are free', async () => {
      const { user, reply } = await ready();
      const listen = randomUUID();
      await start(user, reply, listen, 2);
      const call = randomUUID();
      await admit(user, listen, 0, call);
      assert.equal((await readAudio(user, listen, 0)).outcome, 'IN_PROGRESS');
      assert.equal((await readAudio(user, listen, 1)).outcome, 'NOT_STARTED', 'V-C a read never starts a synthesis');
      assert.equal((await complete(user, call)).outcome, 'READY');
      const [settled] = await calls(user);
      assert.equal(settled.call_state, 'SUCCEEDED_USAGE_REPORTED');
      assert.deepEqual(settled.usage, USAGE);
      assert.equal((await complete(user, call)).outcome, 'READY', 'V-C a replayed completion is READY');
      await rejected(() => complete(user, call, { INPUT_TOKEN: 41, AUDIO_OUTPUT_TOKEN: 900 }), ['PT409']);
      for (let i = 0; i < 10; i += 1) {
        const r = await readAudio(user, listen, 0);
        assert.equal(r.outcome, 'READY');
        assert.ok(Buffer.from(r.audio).equals(WAV), 'V-C the stored audio');
      }
      const r = await admit(user, listen, 0);
      assert.equal(r.outcome, 'READY', 'V-C a repeated synthesis after READY is free');
      assert.equal((await calls(user)).length, 1, 'V-C one ledger row after ten reads and a repeat');
      const absent = randomUUID();
      await admit(user, listen, 1, absent);
      assert.equal((await complete(user, absent, {}, 'ABSENT')).outcome, 'READY');
      const unknown = (await calls(user)).find((c) => c.id === absent);
      assert.equal(unknown.call_state, 'SUCCEEDED_USAGE_UNKNOWN', 'V-C missing usage is unknown');
      assert.deepEqual(unknown.usage, {}, 'V-C never a zero');
      await rejected(() => complete(user, randomUUID()), ['42501']);
      await rejected(() => complete(user, absent, USAGE, 'COMPLETE', Buffer.alloc(10)), ['22023']);
    });

    await report.isolated('V-R the one pre-audio retry: its own ledger row, only after the failed call settled, never twice', async () => {
      const { user, reply } = await ready();
      const listen = randomUUID();
      await start(user, reply, listen, 1);
      const first = randomUUID();
      await admit(user, listen, 0, first);
      assert.equal((await retry(user, listen, 0, first)).outcome, 'NOT_ALLOWED', 'V-R not while the failed call is PENDING');
      assert.equal((await fail(user, first, false)).outcome, 'RETRYABLE');
      const second = randomUUID();
      assert.equal((await retry(user, listen, 0, first, second)).outcome, 'RETRY_BEGUN');
      assert.deepEqual(await segment(user, listen, 0), { state: 'SYNTHESIZING', call_id: second, attempts: 2, has_audio: false });
      const ledger = await calls(user);
      assert.deepEqual(ledger.map((c) => [c.id, c.call_state, c.attempt_number]), [[first, 'FAILED_USAGE_UNKNOWN', 1], [second, 'PENDING', 2]]);
      assert.equal((await fail(user, second, false)).outcome, 'RETRYABLE');
      assert.equal((await retry(user, listen, 0, second)).outcome, 'NOT_ALLOWED', 'V-R at most two attempts');
      assert.equal((await fail(user, second, true)).outcome, 'FAILED');
      assert.equal((await segment(user, listen, 0)).state, 'FAILED');
      assert.equal((await admit(user, listen, 0)).outcome, 'FAILED', 'V-R a failed segment is not re-admitted');
      assert.equal((await calls(user)).length, 2);
      assert.equal((await readAudio(user, listen, 0)).outcome, 'FAILED');
    });

    await report.isolated('V-K a crash: the expired lease is FAILED_UNKNOWN with usage unknown, never re-synthesized; a late completion refused', async () => {
      const { user, reply } = await ready();
      const listen = randomUUID();
      await start(user, reply, listen, 1);
      const call = randomUUID();
      await admit(user, listen, 0, call);
      assert.deepEqual(await sweep(), { leases_expired: 0, calls_settled: 0, segments_deleted: 0 }, 'V-K a live lease is left alone');
      await owner();
      await q("UPDATE voice_private.reply_speech_segments SET lease_until = clock_timestamp() - interval '1 second' WHERE call_id = $1", [call]);
      assert.deepEqual(await sweep(), { leases_expired: 1, calls_settled: 0, segments_deleted: 0 });
      assert.equal((await calls(user))[0].call_state, 'FAILED_USAGE_UNKNOWN', 'V-K usage unknown');
      assert.equal((await segment(user, listen, 0)).state, 'FAILED_UNKNOWN');
      assert.equal((await admit(user, listen, 0)).outcome, 'FAILED', 'V-K never re-synthesized automatically');
      await rejected(() => complete(user, call), ['PT409']);
      assert.equal((await segment(user, listen, 0)).has_audio, false, 'V-K the late audio is not kept');
      assert.equal((await calls(user)).length, 1);
    });

    await report.isolated('V-X cancel, TTL, stale calls and erasure remove everything; nothing reaches the recordings or the object store', async () => {
      const { user, session, reply } = await ready();
      const footprint = async () => (await rows(`SELECT (SELECT count(*)::int FROM voice_private.recordings) AS recordings,
          (SELECT count(*)::int FROM voice_private.recording_objects) AS objects,
          (SELECT count(*)::int FROM introduction_sharing_private.media_erasure_queue) AS queue`))[0];
      const before = await footprint();
      const listen = randomUUID();
      await start(user, reply, listen, 3);
      const ready0 = randomUUID();
      await admit(user, listen, 0, ready0);
      await complete(user, ready0);
      const busy = randomUUID();
      await admit(user, listen, 1, busy);
      const c = await cancel(user, listen);
      assert.deepEqual(c, { outcome: 'CANCELLED', deleted: 2, discarded: 1 });
      assert.equal((await readAudio(user, listen, 0)).outcome, 'NOT_FOUND', 'V-X cancelled audio is gone');
      assert.equal((await complete(user, busy)).outcome, 'DROPPED', 'V-X a discarded synthesis keeps no audio');
      assert.equal((await rows('SELECT count(*)::int AS n FROM voice_private.reply_speech_segments WHERE user_id = $1', [user]))[0].n, 0);
      assert.equal((await calls(user)).find((x) => x.id === busy).call_state, 'SUCCEEDED_USAGE_REPORTED', 'V-X still accounted');
      // TTL
      const ttl = randomUUID();
      await start(user, reply, ttl, 1);
      const late = randomUUID();
      await admit(user, ttl, 0, late);
      await complete(user, late);
      await owner();
      await q("UPDATE voice_private.reply_speech_segments SET created_at = clock_timestamp() - interval '16 minutes', expires_at = clock_timestamp() - interval '1 minute' WHERE listen_id = $1", [ttl]);
      assert.equal((await readAudio(user, ttl, 0)).outcome, 'NOT_FOUND', 'V-X expired audio is not served');
      assert.equal((await admit(user, ttl, 0)).outcome, 'NOT_FOUND');
      assert.equal((await start(user, reply, ttl, 1)).outcome, 'EXPIRED');
      assert.equal((await sweep()).segments_deleted, 1, 'V-X the sweeper deletes expired audio');
      // A stale PENDING synthesis call whose segment left (the reply or listen went) settles unknown.
      const orphan = randomUUID();
      await owner();
      await q(`INSERT INTO public.ai_provider_calls (id, user_id, session_id, source_turn_id, provider, requested_model, operation, feature_family,
                 attempt_number, call_state, started_at) VALUES ($1, $2, $3, $4, 'GEMINI', $5, 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 9, 'PENDING',
                 clock_timestamp() - interval '10 minutes')`, [orphan, user, session, reply, MODEL]);
      assert.equal((await sweep()).calls_settled, 1);
      assert.equal((await calls(user)).find((x) => x.id === orphan).call_state, 'FAILED_USAGE_UNKNOWN');
      assert.deepEqual(await footprint(), before, 'V-X no recording, object or erasure-queue write');
      // Account erasure.
      const keep = randomUUID();
      await start(user, reply, keep, 1);
      await one(`SELECT * FROM public.server_record_reply_speech_channel_v1($1, $2, 'CALM', '[]'::jsonb)`, [user, reply]);
      await owner();
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
      const [{ outcome }] = await server('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]);
      assert.equal(outcome, 'ERASED', 'V-X ERASED');
      const [left] = await rows(`SELECT (SELECT count(*)::int FROM voice_private.reply_speech_hints WHERE user_id = $1) AS hints,
          (SELECT count(*)::int FROM voice_private.reply_speech_segments WHERE user_id = $1) AS segments,
          (SELECT count(*)::int FROM public.ai_provider_calls WHERE user_id = $1) AS calls`, [user]);
      assert.deepEqual(left, { hints: 0, segments: 0, calls: 0 });
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ concurrency (committed fixtures, removed after)
async function verifyConcurrency(report, P) {
  const { q2, close } = await rt.openSecondary();
  try {
    await report.section('V-RC two connections admitting the same segment: one admission, one ledger row', async () => {
      await rt.provisionHumans([P]);
      await owner();
      await q('BEGIN');
      await setVoiceGate();
      assert.equal(await grant(P), 'GRANTED');
      const session = await newSession(P);
      const { reply } = await exchange(P, session);
      const listen = randomUUID();
      await start(P, reply, listen, 1);
      await q('COMMIT');
      await owner();
      const first = randomUUID();
      const second = randomUUID();
      await q('BEGIN');
      await q('SET LOCAL ROLE service_role');
      const a = (await q('SELECT * FROM public.server_admit_reply_speech_synthesis_v1($1, $2, 0, $3, $4, 60)', [P, listen, first, MODEL])).rows[0];
      assert.equal(a.outcome, 'ADMITTED');
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      const b = q2('SELECT * FROM public.server_admit_reply_speech_synthesis_v1($1, $2, 0, $3, $4, 60)', [P, listen, second, MODEL]);
      assert.equal(await rt.stillPending(b), true, 'V-RC the second admission waits');
      await q('COMMIT');
      await owner();
      const r = (await b).rows[0];
      await q2('COMMIT');
      assert.equal(r.outcome, 'IN_PROGRESS');
      assert.equal(r.call_id, first);
      const [{ n }] = await rows('SELECT count(*)::int AS n FROM public.ai_provider_calls WHERE user_id = $1', [P]);
      assert.equal(n, 1, 'V-RC exactly one ledger row');
    });
  } finally {
    // A failed probe may leave either transaction open: end both before the teardown.
    await q('ROLLBACK').catch(() => undefined);
    await q2('ROLLBACK').catch(() => undefined);
    await close();
    await owner();
  }
}

async function removeConcurrencyFixtures(humans, gate) {
  await owner();
  await q('BEGIN');
  try {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM voice_private.reply_speech_segments WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM voice_private.reply_speech_hints WHERE user_id = ANY($1::uuid[])', [humans]);
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

runVerifier('0187', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0187', { query: q, restore: () => owner() });
  const humans = [randomUUID()];
  setStage('catalogue');
  await verifyCatalogue(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('concurrency');
  const [gate] = await rows("SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = 'PERSONAL_VOICE_NOTE'");
  try {
    await verifyConcurrency(report, humans[0]);
  } finally {
    setStage('teardown');
    await removeConcurrencyFixtures(humans, gate);
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM voice_private.reply_speech_segments) + (SELECT count(*) FROM voice_private.reply_speech_hints)
      + (SELECT count(*) FROM voice_private.recording_consents) + (SELECT count(*) FROM voice_private.recordings)
      + (SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state <> 'DISABLED') AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
